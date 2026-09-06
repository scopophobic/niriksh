# Niriksh economical EC2 deployment

This is the canonical handoff runbook for a small demonstration or testing environment. It runs the web application and API on one ARM64 EC2 instance while keeping PostgreSQL and evidence in the existing Supabase project.

It deliberately does **not** create ECS, Fargate, an Application Load Balancer, RDS, or a NAT Gateway.

## Resulting topology

```text
Internet
  → Elastic IP :80/:443
  → Caddy (automatic HTTPS)
      ├── Next.js web/BFF
      └── protected /api/v1/integrations/bhumika/* → FastAPI
            ├── existing Supabase PostgreSQL
            ├── existing private Supabase Storage
            └── optional Gemini API
```

FastAPI is otherwise not published directly. Browser API calls go through the Next.js BFF. Bhumika remains a separate deployment and can call only its key-protected Niriksh integration path.

## What the repository provides

- `deploy/ec2/stack.yml`: EC2, Elastic IP, firewall, ECR repositories, instance IAM, GitHub OIDC deployment IAM, and an optional USD 25 budget.
- `deploy/ec2/compose.production.yml`: production web, API, and Caddy containers.
- `deploy/ec2/*.env.example`: server-only configuration templates.
- `scripts/install-ec2-runtime.sh`: installs versioned runtime files from the checkout.
- `.github/workflows/deploy-ec2.yml`: verifies pull requests and automatically deploys successful pushes to `main`.

## Important boundaries

- Use fictional information for the demo. This release is not approved for real victim evidence.
- The AWS account owner controls the server, deployment role, images, and availability. Use a project-owned account for anything beyond a trusted demo.
- Supabase remains the canonical database and object store. Deleting the CloudFormation stack does not delete Supabase data.
- GitHub contains no database, storage, Gemini, Bhumika, or application secrets. Those remain in root-readable files on EC2.
- The workflow uses GitHub OIDC and short-lived AWS credentials. Do not create GitHub secrets containing permanent AWS access keys.
- Creating this EC2 stack does not stop or delete an older ECS Express deployment in another account. Remove unused ECS services, Fargate tasks, load balancers, public IPs, and related resources there or they will continue billing.

## 1. Choose the AWS region

Use the AWS region closest to the existing Supabase project. The current storage example uses Singapore (`ap-southeast-1`); confirm the actual Supabase project region rather than copying that value blindly.

Keep CloudFormation, EC2, ECR, Systems Manager, and the GitHub repository variables in the same AWS region.

## 2. Prepare the AWS account

Before creating resources:

1. Enable MFA on the AWS root user.
2. Use an administrator identity instead of root for setup.
3. Confirm the account's Free Tier credits and expiry date in Billing.
4. Choose a public subnet with a route to an internet gateway. A default VPC public subnet is fine for this demo.
5. Have a domain or subdomain ready. Caddy needs its DNS record before it can obtain a public TLS certificate.

## 3. Create the stack

From CloudFormation in the AWS Console:

1. Create a stack with new resources.
2. Upload `deploy/ec2/stack.yml`.
3. Supply the exact GitHub owner and repository name.
4. Select the VPC and a **public** subnet.
5. Keep `t4g.small` and 30 GB unless testing proves more memory is necessary.
6. Supply a billing email to create the USD 25 budget, or leave it empty.
7. Acknowledge that the template creates named IAM resources and create the stack.

The same operation through the AWS CLI is:

```bash
aws cloudformation deploy \
  --region ap-southeast-1 \
  --stack-name niriksh-demo \
  --template-file deploy/ec2/stack.yml \
  --capabilities CAPABILITY_NAMED_IAM \
  --parameter-overrides \
    GitHubOwner=YOUR_GITHUB_OWNER \
    GitHubRepository=YOUR_REPOSITORY_NAME \
    VpcId=vpc-EXAMPLE \
    PublicSubnetId=subnet-EXAMPLE \
    BillingAlertEmail=owner@example.com
```

Wait for `CREATE_COMPLETE`. Record these stack outputs:

- `InstanceId`
- `ElasticIp`
- `GitHubActionsRoleArn`
- `EcrRegistry`
- `SessionManagerUrl`

The instance deliberately has no inbound SSH rule. Administration uses AWS Systems Manager Session Manager.

If the account already has a GitHub Actions OIDC provider, CloudFormation will report that the provider exists. In that case, either remove the duplicate unused provider before creating this fresh demo stack or update the template to reference the existing provider. Do not delete a provider used by another deployment.

## 4. Point the domain at EC2

Create an `A` record such as:

```text
demo.example.com → <ElasticIp output>
```

Wait until this returns the Elastic IP:

```bash
dig +short demo.example.com
```

Ports 80 and 443 must remain reachable so Caddy can issue and renew HTTPS certificates.

## 5. Give the server read-only repository access

Open the `SessionManagerUrl` stack output. In the session:

```bash
sudo -iu niriksh
ssh-keygen -t ed25519 -f ~/.ssh/github_deploy -N '' -C niriksh-ec2-deploy
cat ~/.ssh/github_deploy.pub
```

In GitHub, open **Repository settings → Deploy keys → Add deploy key**. Add the displayed public key and leave write access disabled.

Back in Session Manager:

```bash
cat >> ~/.ssh/config <<'EOF'
Host github.com
  IdentityFile ~/.ssh/github_deploy
  IdentitiesOnly yes
EOF
chmod 600 ~/.ssh/config
ssh-keyscan -H github.com >> ~/.ssh/known_hosts
git clone git@github.com:YOUR_GITHUB_OWNER/YOUR_REPOSITORY.git /opt/niriksh/source
exit
```

The deployment checkout is machine-managed. Do not edit files inside `/opt/niriksh/source`; every deployment requires a clean fast-forward from `main`.

## 6. Configure server-only values

Install the runtime files and copy the templates once:

```bash
cd /opt/niriksh/source
sudo ./scripts/install-ec2-runtime.sh
sudo install -m 600 deploy/ec2/deploy.env.example /etc/niriksh/deploy.env
sudo install -m 600 deploy/ec2/proxy.env.example /etc/niriksh/proxy.env
sudo install -m 600 deploy/ec2/web.env.example /etc/niriksh/web.env
sudo install -m 600 deploy/ec2/api.env.example /etc/niriksh/api.env
```

Edit all four files with `sudoedit`. Required changes include:

### `/etc/niriksh/deploy.env`

- Set the selected AWS region.
- Set `ECR_REGISTRY` to the stack's `EcrRegistry` output.

### `/etc/niriksh/proxy.env`

- Set `APP_DOMAIN` to the DNS name created above, with no `https://` and no path.

### `/etc/niriksh/web.env`

- Generate `BACKEND_INTERNAL_API_KEY` with `openssl rand -hex 32`.
- Optionally add the Gemini key. Without it, the disclosed deterministic fallback still works.

### `/etc/niriksh/api.env`

- Use the existing Supabase IPv4 session-pooler PostgreSQL URL and `sslmode=require`.
- Set `FRONTEND_ORIGINS` and `PUBLIC_APP_URL` to the final HTTPS origin.
- Copy the exact web `BACKEND_INTERNAL_API_KEY` value into `INTERNAL_API_KEY`.
- For a fresh database, generate `JWT_SECRET`, `DIRECTORY_HASH_SECRET`, and `BHUMIKA_INTEGRATION_KEY` independently with `openssl rand -hex 32`.
- When retaining the existing database, copy the existing `JWT_SECRET` so issued tracking links remain valid and retain `DIRECTORY_HASH_SECRET` so stored identifier fingerprints remain searchable. Changing either requires an intentional token invalidation or re-indexing procedure.
- Retain the existing `BHUMIKA_INTEGRATION_KEY`, or rotate Bhumika to the new value at the same time.
- Set `DEMO_USER_PASSWORD` for missing demo users. Existing demo-user password hashes are not overwritten during startup, so retain the known password or reset those accounts deliberately before handoff.
- Add the existing private Supabase Storage S3 endpoint, bucket, access key, and secret.
- Add Gemini only if connected analysis is intended.

The four security purposes must use distinct values, even when preserving their existing values during migration. Do not paste any of these files into chat, issues, GitHub Actions, or Git.

The API image runs `alembic upgrade head` before starting. The database user therefore needs schema migration permissions.

## 7. Configure GitHub Actions

The workflow must first be present on the `main` branch.

In **GitHub repository settings → Secrets and variables → Actions → Variables**, create:

| Variable | Value |
| --- | --- |
| `AWS_REGION` | The CloudFormation region, for example `ap-southeast-1` |
| `AWS_ROLE_ARN` | `GitHubActionsRoleArn` stack output |
| `EC2_INSTANCE_ID` | `InstanceId` stack output |

These identifiers are configuration, not credentials. The workflow obtains short-lived AWS credentials through OIDC.

The workflow behavior is:

1. Pull requests targeting `main` run Node tests, lint, Next.js build, and backend tests.
2. A push to `main` repeats verification.
3. Only after verification succeeds, two ARM64 images are built and pushed to ECR with the immutable Git commit SHA.
4. Systems Manager tells EC2 to fast-forward its checkout, install the current runtime files, pull those exact images, and restart Compose.
5. Deployment waits for web and API health. If a replacement is unhealthy and an older SHA was running, the server attempts to roll back.

No deployment occurs from feature branches or pull requests.

For the first release, open **GitHub → Actions → Verify and deploy EC2 → Run workflow** on `main`. Subsequent merges or pushes to `main` deploy automatically.

## 8. Verify the deployment

Check:

```bash
curl -fsS https://demo.example.com/api/health
```

Then verify:

1. Landing page and `/whatsapp` load over HTTPS.
2. Officer login works with `triage@example.local` and the configured demo password.
3. A fictional complaint persists after containers restart.
4. A fictional evidence file reaches the private Supabase bucket and is not publicly enumerable.
5. `/dashboard`, a case page, routing, tracking, Related Incidents, and logout work.
6. Logs contain no credentials or signed evidence URLs.

For live Bhumika integration, configure Bhumika with:

```text
NIRIKSH_API_URL=https://demo.example.com/api/v1
NIRIKSH_INTEGRATION_KEY=<the exact BHUMIKA_INTEGRATION_KEY from api.env>
```

The browser `/whatsapp` route works without the external Bhumika service. Actual Meta WhatsApp delivery still belongs to Bhumika.

## Operations

Open Session Manager and use:

```bash
cd /opt/niriksh/runtime
sudo docker compose --env-file /etc/niriksh/deploy.env -f compose.production.yml ps
sudo docker compose --env-file /etc/niriksh/deploy.env -f compose.production.yml logs --tail=200
```

To redeploy or roll back to an ECR image that is still retained:

```bash
sudo /opt/niriksh/runtime/deploy.sh <40-character-git-sha>
```

The ECR lifecycle keeps the ten newest images. After a healthy release, the deployment script removes local images that are unused and older than seven days; retained ECR images can be pulled again for rollback. Caddy certificate state persists in a Docker volume. Application state remains in Supabase.

Apply Ubuntu security updates regularly and reboot when required. Test the demo again after every reboot.

## Cost controls

- Keep one `t4g.small` instance.
- Do not add ECS, Fargate, RDS, a load balancer, NAT Gateway, or paid Route 53 services unless deliberately approved.
- Keep ECR's ten-image lifecycle rule.
- Retain Docker's configured log rotation.
- Watch AWS credits and the budget emails; a budget alerts but does not automatically stop resources.
- An Elastic IP is billable even while attached. Delete the stack when the demo is finished.

## Tear down

Deleting the `niriksh-demo` CloudFormation stack deletes the EC2 instance, its root disk, Elastic IP, IAM deployment resources, and ECR images. It does **not** delete the external Supabase database, Supabase evidence bucket, DNS record, GitHub variables, or repository deploy key. Remove those separately when they are no longer needed.

## Production-readiness gap

This topology is economical because it is a single server and a single point of failure. Before real sensitive complaints, add jurisdiction-scoped access, tested backup/restore, immutable evidence retention, malware quarantine, rate limiting, audit monitoring, incident response, privacy review, threat modelling, and legal/agency approval.
