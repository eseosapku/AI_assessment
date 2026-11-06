# Deploy the generation timeout fix

The old request path ran generation inside Amplify, or relayed SQS work back
through an HTTP endpoint. Raising the Lambda timeout did not remove that HTTP
gateway limit. Assessment generation now runs directly in the SQS Lambda.
The browser submits a job and polls short status requests for both styles.

## Build and deploy the worker first

From the project root:

```sh
npm ci
npm run build
npm run build:ai-worker
sam validate --lint --template-file infra/lambda/template.yaml --region eu-west-1
sam deploy --template-file infra/lambda/template.yaml --guided --region eu-west-1
```

Use the existing backend stack name when updating an existing installation.
Supply `DatabaseUrl` and the same database SSL setting as Amplify. Set
`FigureBaseUrl` to the frontend's `NEXT_PUBLIC_FIGURE_BASE_URL`. Use the same
region as Bedrock. The legacy backend relay URL/token are no longer used for
generation; `BackendInternalBaseUrl` may be empty. SAM may request
`InternalJobRunnerToken` for compatibility; it is not used by the worker.

The build command packages the engine, Node dependencies, and traced source
banks under `.ai-worker/`. It excludes `.env` files. Do not commit this folder.
The worker uses its Lambda IAM role for Bedrock and SQS; no additional model or
paid reviewer is enabled.

## Connect Amplify and deploy the frontend

1. Copy the stack's `AiJobQueueUrl` output into Amplify's `AI_JOB_QUEUE_URL`.
2. Give the credentials/role used by the Amplify runtime `sqs:SendMessage` on
   that queue. The stack exports `QueueSenderPolicyArn` for this purpose.
3. Deploy the frontend changes. The existing `amplify.yml` forwards
   `AI_JOB_QUEUE_URL` to server runtime configuration.

Deploying the frontend alone does not update the worker. The old worker must
be replaced before sending queued jobs to it. Generation no longer depends on
the `NEXT_PUBLIC_USE_ASYNC_AI_JOBS` flag; all assessment entry points use jobs.
Without the production queue configuration the API returns an explicit 503
configuration error, rather than silently falling back to the 27-second path.

## Limits and smoke check

- Worker: 900 seconds (15 minutes).
- Engine checking budget: 840 seconds; refill budget: 780 seconds.
- Browser polling: 1,200 seconds (20 minutes), including queue time.
- SQS visibility: 5,400 seconds, with batch size one and partial batch failures.
- Individual primary Bedrock requests: 90 seconds, within the worker budget.

Confirm that `POST /api/generate-assessment` returns **202** with a job ID
promptly. The browser should then call `GET /api/jobs/{id}` until completion.
It must not hold a request to `/api/jobs/{id}/execute` or the generation route
open throughout generation. Test one practice and one exam quiz exceeding
30 seconds and check the worker's CloudWatch log for the same job IDs.

The local regression tests simulate 35-second generations without paid AI
calls. They verify immediate submission, polling beyond the gateway window,
direct worker execution, subscription error propagation, and duplicate
delivery protection. A deployed smoke check still requires the worker and
Amplify configuration above to be deployed.
