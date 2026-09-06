#!/usr/bin/env bash
set -euo pipefail

AWS_REGION="${AWS_REGION:-$(aws configure get region)}"
AWS_REGION="${AWS_REGION:-us-east-1}"
ECR_REPOSITORY="${ECR_REPOSITORY:-niriksh-api}"
ECS_SERVICE="${ECS_SERVICE:-niriksh-api}"
ECS_CLUSTER="${ECS_CLUSTER:-default}"
TARGET_PLATFORM="${TARGET_PLATFORM:-linux/amd64}"
FRONTEND_ORIGINS="${FRONTEND_ORIGINS:-https://niriksh.scopophobic.xyz}"
PUBLIC_APP_URL="${PUBLIC_APP_URL:-https://niriksh.scopophobic.xyz}"
TRACKING_TOKEN_DAYS="${TRACKING_TOKEN_DAYS:-180}"
NIRIKSH_API_SECRET_ARN="${NIRIKSH_API_SECRET_ARN:?Set NIRIKSH_API_SECRET_ARN to one AWS Secrets Manager JSON secret ARN}"

ACCOUNT_ID="$(aws sts get-caller-identity --query Account --output text --region "$AWS_REGION")"
if [ -n "${IMAGE_TAG:-}" ]; then
  IMAGE_TAG="$IMAGE_TAG"
elif [ -n "$(git status --porcelain 2>/dev/null)" ]; then
  IMAGE_TAG="$(git rev-parse --short=12 HEAD 2>/dev/null || echo dev)-$(date -u +%Y%m%d%H%M%S)"
else
  IMAGE_TAG="$(git rev-parse --short=12 HEAD 2>/dev/null || date -u +%Y%m%d%H%M%S)"
fi
ECR_REGISTRY="${ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com"
IMAGE_URI="${ECR_REGISTRY}/${ECR_REPOSITORY}:${IMAGE_TAG}"
EXECUTION_ROLE="ecsTaskExecutionRole"
INFRASTRUCTURE_ROLE="ecsInfrastructureRoleForExpressServices"
EXECUTION_ROLE_ARN="arn:aws:iam::${ACCOUNT_ID}:role/${EXECUTION_ROLE}"
INFRASTRUCTURE_ROLE_ARN="arn:aws:iam::${ACCOUNT_ID}:role/${INFRASTRUCTURE_ROLE}"
SERVICE_ARN="arn:aws:ecs:${AWS_REGION}:${ACCOUNT_ID}:service/${ECS_CLUSTER}/${ECS_SERVICE}"

TASK_TRUST='{"Version":"2012-10-17","Statement":[{"Effect":"Allow","Principal":{"Service":"ecs-tasks.amazonaws.com"},"Action":"sts:AssumeRole"}]}'
INFRA_TRUST='{"Version":"2012-10-17","Statement":[{"Sid":"AllowAccessInfrastructureForECSExpressServices","Effect":"Allow","Principal":{"Service":"ecs.amazonaws.com"},"Action":"sts:AssumeRole"}]}'

created_role=false
if ! aws iam get-role --role-name "$EXECUTION_ROLE" --region "$AWS_REGION" >/dev/null 2>&1; then
  aws iam create-role --role-name "$EXECUTION_ROLE" --assume-role-policy-document "$TASK_TRUST" --region "$AWS_REGION" >/dev/null
  created_role=true
fi
aws iam attach-role-policy --role-name "$EXECUTION_ROLE" --policy-arn arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy --region "$AWS_REGION"

SECRET_POLICY="$(jq -nc --arg arn "$NIRIKSH_API_SECRET_ARN" '{Version:"2012-10-17",Statement:[{Effect:"Allow",Action:["secretsmanager:GetSecretValue"],Resource:$arn}]}')"
aws iam put-role-policy --role-name "$EXECUTION_ROLE" --policy-name NirikshApiReadDeploymentSecret --policy-document "$SECRET_POLICY" --region "$AWS_REGION"

if ! aws iam get-role --role-name "$INFRASTRUCTURE_ROLE" --region "$AWS_REGION" >/dev/null 2>&1; then
  aws iam create-role --role-name "$INFRASTRUCTURE_ROLE" --assume-role-policy-document "$INFRA_TRUST" --region "$AWS_REGION" >/dev/null
  created_role=true
fi
aws iam attach-role-policy --role-name "$INFRASTRUCTURE_ROLE" --policy-arn arn:aws:iam::aws:policy/service-role/AmazonECSInfrastructureRoleforExpressGatewayServices --region "$AWS_REGION"

if [ "$created_role" = true ]; then
  echo "Waiting for new IAM roles to propagate..."
  sleep 15
fi

if ! aws ecr describe-repositories --repository-names "$ECR_REPOSITORY" --region "$AWS_REGION" >/dev/null 2>&1; then
  aws ecr create-repository --repository-name "$ECR_REPOSITORY" --image-tag-mutability IMMUTABLE --image-scanning-configuration scanOnPush=true --encryption-configuration encryptionType=AES256 --region "$AWS_REGION" >/dev/null
fi

aws ecr get-login-password --region "$AWS_REGION" | docker login --username AWS --password-stdin "$ECR_REGISTRY"
docker buildx build --platform "$TARGET_PLATFORM" --push --tag "$IMAGE_URI" ./backend

SECRET_NAMES="DATABASE_URL,JWT_SECRET,INTERNAL_API_KEY,DIRECTORY_HASH_SECRET,BHUMIKA_INTEGRATION_KEY,DEMO_USER_PASSWORD,GEMINI_API_KEY,EVIDENCE_S3_BUCKET,EVIDENCE_S3_REGION,EVIDENCE_S3_ENDPOINT_URL,EVIDENCE_S3_ACCESS_KEY_ID,EVIDENCE_S3_SECRET_ACCESS_KEY"
PRIMARY_CONTAINER="$(jq -nc \
  --arg image "$IMAGE_URI" \
  --arg origins "$FRONTEND_ORIGINS" \
  --arg public_app_url "$PUBLIC_APP_URL" \
  --arg tracking_token_days "$TRACKING_TOKEN_DAYS" \
  --arg secret "$NIRIKSH_API_SECRET_ARN" \
  --arg names "$SECRET_NAMES" \
  '{
    image:$image,
    containerPort:8000,
    environment:[
      {name:"APP_ENV",value:"production"},
      {name:"FRONTEND_ORIGINS",value:$origins},
      {name:"PUBLIC_APP_URL",value:$public_app_url},
      {name:"TRACKING_TOKEN_DAYS",value:$tracking_token_days},
      {name:"SEED_DEMO_USERS",value:"true"},
      {name:"AUTO_CREATE_TABLES",value:"false"},
      {name:"GEMINI_MODEL",value:"gemini-3.5-flash"},
      {name:"GEMINI_FALLBACK_MODEL",value:"gemini-3.6-flash"},
      {name:"GEMINI_RESERVE_MODEL",value:"gemini-2.5-flash"},
      {name:"EVIDENCE_STORAGE_BACKEND",value:"s3"},
      {name:"EVIDENCE_S3_FORCE_PATH_STYLE",value:"true"},
      {name:"EVIDENCE_S3_PREFIX",value:"niriksh/evidence"},
      {name:"MAX_EVIDENCE_BYTES",value:"10000000"}
    ],
    secrets:($names | split(",") | map({name:.,valueFrom:($secret + ":" + . + "::")}))
  }')"

if aws ecs describe-express-gateway-service --service-arn "$SERVICE_ARN" --region "$AWS_REGION" >/dev/null 2>&1; then
  aws ecs update-express-gateway-service \
    --service-arn "$SERVICE_ARN" \
    --execution-role-arn "$EXECUTION_ROLE_ARN" \
    --primary-container "$PRIMARY_CONTAINER" \
    --health-check-path /health \
    --scaling-target minTaskCount=1,maxTaskCount=1,autoScalingMetric=AVERAGE_CPU,autoScalingTargetValue=70 \
    --monitor-resources --monitor-mode TEXT-ONLY --region "$AWS_REGION"
else
  aws ecs create-express-gateway-service \
    --service-name "$ECS_SERVICE" \
    --cluster "$ECS_CLUSTER" \
    --execution-role-arn "$EXECUTION_ROLE_ARN" \
    --infrastructure-role-arn "$INFRASTRUCTURE_ROLE_ARN" \
    --primary-container "$PRIMARY_CONTAINER" \
    --health-check-path /health \
    --scaling-target minTaskCount=1,maxTaskCount=1,autoScalingMetric=AVERAGE_CPU,autoScalingTargetValue=70 \
    --tags key=Application,value=Niriksh key=Component,value=api key=ManagedBy,value=deploy-ecs-express-api \
    --monitor-resources --monitor-mode TEXT-ONLY --region "$AWS_REGION"
fi

aws ecs describe-express-gateway-service \
  --service-arn "$SERVICE_ARN" --region "$AWS_REGION" \
  --query 'service.{Status:status.statusCode,Endpoint:activeConfigurations[0].ingressPaths[0].endpoint,Image:activeConfigurations[0].primaryContainer.image}' \
  --output table
