#!/usr/bin/env bash
set -euo pipefail

AWS_REGION="${AWS_REGION:-$(aws configure get region)}"
AWS_REGION="${AWS_REGION:-us-east-1}"
ECR_REPOSITORY="${ECR_REPOSITORY:-niriksh}"
ECS_SERVICE="${ECS_SERVICE:-niriksh}"
ECS_CLUSTER="${ECS_CLUSTER:-default}"
TARGET_PLATFORM="${TARGET_PLATFORM:-linux/amd64}"
BACKEND_API_URL="${BACKEND_API_URL:-}"
NIRIKSH_WEB_SECRET_ARN="${NIRIKSH_WEB_SECRET_ARN:-}"
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

if [ -n "$NIRIKSH_WEB_SECRET_ARN" ]; then
  SECRET_POLICY="$(jq -nc --arg arn "$NIRIKSH_WEB_SECRET_ARN" '{Version:"2012-10-17",Statement:[{Effect:"Allow",Action:["secretsmanager:GetSecretValue"],Resource:$arn}]}')"
  aws iam put-role-policy --role-name "$EXECUTION_ROLE" --policy-name NirikshWebReadDeploymentSecret --policy-document "$SECRET_POLICY" --region "$AWS_REGION"
fi

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
  aws ecr create-repository \
    --repository-name "$ECR_REPOSITORY" \
    --image-tag-mutability IMMUTABLE \
    --image-scanning-configuration scanOnPush=true \
    --encryption-configuration encryptionType=AES256 \
    --region "$AWS_REGION" >/dev/null
fi

aws ecr get-login-password --region "$AWS_REGION" | docker login --username AWS --password-stdin "$ECR_REGISTRY"
docker buildx build --platform "$TARGET_PLATFORM" --push --tag "$IMAGE_URI" --build-arg "APP_VERSION=$IMAGE_TAG" .

PRIMARY_CONTAINER="$(jq -nc \
  --arg image "$IMAGE_URI" \
  --arg version "$IMAGE_TAG" \
  --arg backend "$BACKEND_API_URL" \
  --arg secret "$NIRIKSH_WEB_SECRET_ARN" \
  '{
    image:$image,
    containerPort:3000,
    environment:([{"name":"NODE_ENV","value":"production"},{"name":"APP_VERSION","value":$version},{"name":"GEMINI_MODEL","value":"gemini-2.5-flash"},{"name":"GEMINI_FALLBACK_MODEL","value":"gemini-3.5-flash"},{"name":"GEMINI_RESERVE_MODEL","value":"gemini-3.6-flash"}]
      + (if $backend == "" then [] else [{"name":"BACKEND_API_URL","value":$backend},{"name":"SESSION_COOKIE_SECURE","value":"true"},{"name":"BACKEND_ALLOW_DEMO_PROXY","value":"false"}] end)),
    secrets:(if $secret == "" then [] else [
      {name:"BACKEND_INTERNAL_API_KEY",valueFrom:($secret + ":INTERNAL_API_KEY::")},
      {name:"GEMINI_API_KEY",valueFrom:($secret + ":GEMINI_API_KEY::")}
    ] end)
  }')"

if aws ecs describe-express-gateway-service --service-arn "$SERVICE_ARN" --region "$AWS_REGION" >/dev/null 2>&1; then
  aws ecs update-express-gateway-service \
    --service-arn "$SERVICE_ARN" \
    --execution-role-arn "$EXECUTION_ROLE_ARN" \
    --primary-container "$PRIMARY_CONTAINER" \
    --health-check-path /api/health \
    --scaling-target minTaskCount=1,maxTaskCount=3,autoScalingMetric=AVERAGE_CPU,autoScalingTargetValue=60 \
    --monitor-resources \
    --monitor-mode TEXT-ONLY \
    --region "$AWS_REGION"
else
  aws ecs create-express-gateway-service \
    --service-name "$ECS_SERVICE" \
    --cluster "$ECS_CLUSTER" \
    --execution-role-arn "$EXECUTION_ROLE_ARN" \
    --infrastructure-role-arn "$INFRASTRUCTURE_ROLE_ARN" \
    --primary-container "$PRIMARY_CONTAINER" \
    --health-check-path /api/health \
    --scaling-target minTaskCount=1,maxTaskCount=3,autoScalingMetric=AVERAGE_CPU,autoScalingTargetValue=60 \
    --tags key=Application,value=Niriksh key=ManagedBy,value=deploy-ecs-express \
    --monitor-resources \
    --monitor-mode TEXT-ONLY \
    --region "$AWS_REGION"
fi

aws ecs describe-express-gateway-service \
  --service-arn "$SERVICE_ARN" \
  --region "$AWS_REGION" \
  --query 'service.{Status:status.statusCode,Endpoint:activeConfigurations[0].ingressPaths[0].endpoint,Image:activeConfigurations[0].primaryContainer.image}' \
  --output table
