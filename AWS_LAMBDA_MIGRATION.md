# Brain Ink AWS Migration (Enterprise Lambda Path)

This migration moves the platform to:

- Frontend: separate deployment (recommended: Amplify Hosting)
- Backend API: AWS Lambda
- Long-running AI work: asynchronous jobs via SQS + Lambda worker (180s timeout)
- Database: Amazon RDS / Aurora PostgreSQL

## 1) What was changed in code

The repository now includes:

- Async AI job client helpers:
  - `lib/client-ai-jobs.ts`
- Async AI job server utilities:
  - `lib/ai-jobs.ts`
- Job API endpoints (for queue/poll model):
  - `app/api/jobs/route.ts`
  - `app/api/jobs/[id]/route.ts`
  - `app/api/jobs/[id]/execute/route.ts`
- Frontend async fallback support (feature flag):
  - `components/FlowForm.tsx`
  - `app/assessment/page.tsx`
  - `app/assignments/from-pdf/page.tsx`
- Database migration for job orchestration:
  - `supabase-ai-jobs-migration.sql`
- Lambda IaC + handlers:
  - `infra/lambda/template.yaml`
  - `infra/lambda/handlers/*`

This is backward-compatible. Existing synchronous behavior stays active until you enable:

- `NEXT_PUBLIC_USE_ASYNC_AI_JOBS=true`

## 2) Why this architecture

API Gateway cannot hold 180-second request/response sessions for standard APIs.
To safely run 180-second AI tasks, the backend must use:

1. quick submit endpoint (`POST /api/jobs`)
2. background worker (SQS-triggered Lambda, timeout 180s)
3. status endpoint (`GET /api/jobs/{id}`)

The frontend polls status instead of waiting on one long HTTP call.

## 3) Step-by-step AWS deployment

## Step A - Database preparation

1. Run `supabase-ai-jobs-migration.sql` in your RDS/Aurora SQL client.
2. Confirm table exists:
   - `ai_jobs`
3. Verify indexes/policy are created.

## Step B - Secrets and parameters

Create these secrets/parameters (Secrets Manager or SSM):

- `DATABASE_URL`
- `PG_DISABLE_SSL` (`false` for RDS default TLS)
- `INTERNAL_JOB_RUNNER_TOKEN` (long random string)
- `BACKEND_INTERNAL_BASE_URL` (private base URL for internal execute calls)
- `AWS_REGION`
- Bedrock model envs you use:
  - `AWS_BEDROCK_MODEL_ID`
  - `AWS_GENERATION_MODEL_ID` (optional)
  - `AWS_GRADING_MODEL_ID` (optional)
  - `AWS_FEEDBACK_MODEL_ID` (optional)

## Step C - IAM roles

For Lambda execution role:

- Basic logs:
  - `AWSLambdaBasicExecutionRole`
- SQS read/write for job queue
- Bedrock invoke:
  - `bedrock:InvokeModel`
  - `bedrock:InvokeModelWithResponseStream`
- (If using VPC + RDS) ENI permissions for Lambda VPC access

## Step D - Deploy backend stack (SAM)

From repo root:

```bash
cd infra/lambda
sam build
sam deploy --guided
```

During guided deploy, set:

- `StageName` -> `prod`
- `DatabaseUrl`
- `PgDisableSsl`
- `InternalJobRunnerToken`
- `BackendInternalBaseUrl`
- `AwsRegion`

After deploy, capture output:

- `ApiBaseUrl`

## Step E - Configure backend worker runtime

Set Lambda env vars for worker and related functions:

- `INTERNAL_JOB_RUNNER_TOKEN`
- `BACKEND_INTERNAL_BASE_URL`
- `DATABASE_URL`
- `PG_DISABLE_SSL`
- `AWS_REGION`
- Bedrock model IDs

Set worker Lambda timeout to **180 seconds** (already in template).

## Step F - Frontend deployment

Deploy frontend separately (Amplify recommended).

Frontend env vars:

- `NEXT_PUBLIC_USE_ASYNC_AI_JOBS=true`
- `NEXT_PUBLIC_SUPABASE_URL=...` and `NEXT_PUBLIC_SUPABASE_ANON_KEY=...` only while legacy routes still rely on Supabase client

If frontend calls backend on another domain, set your API base in frontend config and enable CORS at API.

## Step G - DNS and TLS

Use Route53 + ACM:

- `app.yourdomain.com` -> frontend
- `api.yourdomain.com` -> backend API

## Step H - Validation checklist

1. Submit new assessment generation.
2. Confirm `ai_jobs` row appears as:
   - `queued` -> `running` -> `succeeded`
3. Confirm worker logs in CloudWatch.
4. Test long-form grading and feedback generation.
5. Validate failure path:
   - worker error -> `status=failed`, `error_message` populated.
6. Confirm no blocking requests near API Gateway timeout.

## 4) Production hardening (recommended next)

- Add API authorization (JWT/Cognito/custom authorizer) for all backend routes.
- Stop trusting user IDs from request body without validation.
- Restrict `/api/health` output in production.
- Continue replacing remaining Supabase route handlers with direct RDS access.
- Add CloudWatch alarms:
  - Lambda errors
  - SQS DLQ depth
  - job failure rate
- Add WAF on API endpoints.

## 5) Rollout strategy

1. Deploy stack with async jobs OFF in frontend.
2. Run shadow testing (call async APIs from test users).
3. Enable `NEXT_PUBLIC_USE_ASYNC_AI_JOBS=true` in staging.
4. Validate for 24-48h.
5. Enable in production.
