# StudySquare Admin Analytics and AWS Cost Dashboard Design

**Date:** 2026-08-19  
**Status:** Approved in chat  
**Primary application:** `C:\Users\Stephen\AI_assessment`  
**Connected platform:** `C:\Users\Stephen\BrainInk-Backend-1`

## 1. Purpose

Build a protected `/admin` area inside the StudySquare Next.js application that gives platform owners a reliable view of:

- student engagement, performance, progress, and improvement;
- assessment, grading, and AI-operation health;
- AWS spending across StudySquare and the BrainInk grading platform;
- production versus development expenditure;
- measured and estimated cost per student, assessment, grading operation, platform, and period;
- data freshness, allocation coverage, and cost-reconciliation quality.

The dashboard must distinguish measured facts from estimates. It must not present simulated engagement metrics, inferred historical attribution, or allocated shared infrastructure as directly measured per-student cost.

## 2. Confirmed decisions

- The dashboard lives at `/admin` in the StudySquare Next.js application.
- The first release is restricted to StudySquare platform owners/admins.
- Cost reporting covers AWS only.
- Historical AWS totals are exact where Cost Explorer supplies them.
- Historical per-student costs are estimated from recorded product activity.
- Precise student and workload attribution starts when new usage instrumentation is deployed.
- Production and development resources are currently mixed or inconsistently identified.
- The first release balances security, core learning analytics, AWS totals, and forward cost instrumentation.
- The architecture is a hybrid analytics layer rather than live federation or a full S3/Athena warehouse.

## 3. Scope

### 3.1 Included in the first release

- Server-side platform-admin authentication and authorization.
- Admin navigation and overview page.
- Student and engagement analytics.
- Learning-performance analytics.
- Assessment and grading analytics.
- School and cohort filters where source data supports them.
- AWS cost totals and trends by service, platform, and environment.
- Unit economics for active students, assessments, and grading operations.
- Bedrock usage instrumentation in both platforms.
- Scheduled analytics and AWS cost imports.
- Historical cost-attribution backfill with visible confidence labels.
- Data-quality, reconciliation, freshness, and sync-status views.
- Allocation-rule management with audit history.

### 3.2 Explicitly excluded

- Non-AWS vendors such as Google Gemini, Azure TTS, Google TTS, Render, and Flutterwave.
- Principal, teacher, finance, or school-admin access in the first release.
- A separate admin application.
- A full S3, Glue, and Athena analytics warehouse.
- Real-time financial reporting; AWS billing data is delayed by AWS.
- Automated AWS budget or resource mutations.
- Predictive student-risk models in the first release.
- Claims that historical per-student cost is exact.

## 4. Current-state findings

### 4.1 StudySquare Next.js application

The StudySquare application already stores users, assessments, results, classrooms, assignments, topic mastery, daily activity, and asynchronous AI jobs. It has student and teacher dashboards but no platform-admin role or platform-wide analytics API.

Relevant existing areas include:

- `migrations/full-platform-schema.sql`
- `app/api/dashboard/student/route.ts`
- `app/api/classrooms/[id]/analytics/route.ts`
- `lib/bedrock.ts`
- `lib/ai-jobs.ts`
- `app/api/generate-assessment/route.ts`
- `app/api/grade-longform/route.ts`
- `app/api/generate-feedback/route.ts`
- `app/api/studylab/tutor/route.ts`

The current identity is stored in browser `localStorage`, and many API routes trust client-supplied user identifiers. This is not acceptable for platform-wide admin access.

### 4.2 BrainInk grading backend

The FastAPI backend stores schools, roles, students, assignments, grades, grading sessions, asynchronous grading jobs, after-school courses, study sessions, AI submissions, tutor interactions, and processing logs.

Relevant existing areas include:

- `users_micro/main.py`
- `users_micro/models/study_area_models.py`
- `users_micro/models/afterschool_models.py`
- `users_micro/models/ai_tutor_models.py`
- `users_micro/Endpoints/academic_management.py`
- `users_micro/Endpoints/school_management.py`
- `users_micro/services/gemma_services/gemma_services.py`
- `users_micro/services/gemini_service.py`

Some existing daily-active and session-time values are simulated. They must be excluded until replaced by persisted activity events.

### 4.3 Cost-data gap

Neither platform currently records a complete AI usage ledger. Model token usage, model identifiers, request correlation, per-operation cost, platform, and environment are not consistently persisted. AWS Cost Explorer is not integrated.

## 5. Architecture

### 5.1 Overview

The hybrid architecture has three layers:

1. **Operational sources**
   - StudySquare PostgreSQL and application services.
   - BrainInk PostgreSQL exposed through a narrow signed internal analytics API.
   - AWS Cost Explorer and AWS resource/tag discovery.

2. **Controlled analytics layer in StudySquare**
   - Source adapters.
   - Scheduled imports.
   - Normalized daily metric snapshots.
   - AWS cost records.
   - Usage-event aggregates.
   - Allocation and reconciliation engine.
   - Data-quality checks and sync audit records.

3. **Protected admin experience**
   - Server-rendered or authenticated client pages under `/admin`.
   - Server-only APIs under `/api/admin`.
   - No direct browser access to operational databases, internal tokens, or AWS credentials.

### 5.2 Source ownership

Each platform remains responsible for recording its own operational and Bedrock usage events. StudySquare does not write directly into the BrainInk production database, and BrainInk does not write directly into StudySquare analytics tables.

StudySquare imports normalized aggregates from BrainInk through a versioned internal API. This avoids cross-database coupling and permits either platform to change its internal schema without breaking the dashboard contract.

### 5.3 Refresh cadence

- Product analytics snapshots: every 15 to 60 minutes.
- Bedrock usage aggregates: every 15 to 60 minutes.
- AWS Cost Explorer imports: daily.
- Historical backfill: controlled batch job with checkpointing.
- Manual refresh: available to platform admins but rate-limited and audited.

## 6. Data model

Names below are logical names; implementation may follow existing repository naming conventions while preserving the fields and constraints.

### 6.1 Operational usage event in both platforms

`ai_usage_events`

- `id`: immutable UUID.
- `occurred_at`: UTC timestamp.
- `platform`: `studysquare` or `brainink_grading`.
- `environment`: normalized environment such as `production`, `staging`, `development`, or `unknown`.
- `provider`: `aws_bedrock`.
- `model_id`: exact invoked model identifier.
- `feature`: controlled feature name such as assessment generation, long-form grading, class grading, feedback, tutor, quiz, syllabus, or lesson plan.
- `request_id`: request correlation identifier.
- `job_id`: optional asynchronous job identifier.
- `user_id`: optional actor or student identifier.
- `school_id`: optional school identifier.
- `classroom_id`: optional classroom identifier.
- `assessment_id`: optional assessment identifier.
- `assignment_id`: optional assignment identifier.
- `result_id`: optional result or grade identifier.
- `input_tokens`: nullable integer supplied by the model response.
- `output_tokens`: nullable integer supplied by the model response.
- `total_tokens`: nullable integer.
- `latency_ms`: non-negative integer.
- `status`: `succeeded` or `failed`.
- `error_code`: sanitized optional code.
- `usage_metadata`: non-sensitive JSON for provider-specific usage fields.
- `created_at`: UTC insertion timestamp.

The event has a uniqueness rule based on platform and request/event identity so retries do not double count usage.

### 6.2 StudySquare analytics records

`admin_metric_snapshots`

- Metric date and optional interval.
- Platform, environment, school, cohort, subject, and assessment dimensions.
- Metric key, decimal value, unit, numerator, and denominator.
- Source version, calculation version, and generated timestamp.
- Measurement status: measured or estimated.

`aws_cost_daily`

- Usage date.
- AWS account and billing-view identifiers where available.
- Service, operation, region, usage type, resource identifier, and cost-allocation tags where available.
- Platform and environment classification.
- Unblended cost in USD using fixed-precision decimal storage.
- Import timestamp and source query fingerprint.

`cost_allocation_rules`

- Rule identifier and version.
- Effective date range.
- AWS service or resource selector.
- Platform and environment target.
- Allocation driver.
- Rule parameters.
- Explanation visible to admins.
- Creator and approval audit metadata.

`allocated_cost_daily`

- Usage date.
- Source cost record or aggregate.
- Platform, environment, user, school, feature, assessment, or grading dimensions where supportable.
- Direct, shared-allocated, historical-estimate, or unallocated classification.
- Decimal cost in USD.
- Rule version and confidence label.

`cost_reconciliation_daily`

- Usage date, platform, environment, and service.
- AWS billed total.
- Usage-derived or allocated total.
- Unallocated amount.
- Variance amount and percentage calculated deterministically.
- Reconciliation status and explanation.

`analytics_sync_runs`

- Source, job type, time range, status, attempt count, start/end timestamps.
- Rows read, inserted, updated, rejected, and deduplicated.
- Sanitized error summary.
- Checkpoint and source-version information.

`admin_audit_events`

- Admin identity.
- Timestamp.
- Action and target.
- Filter or rule-change summary.
- Request ID and network/security metadata permitted by policy.

## 7. Metric definitions

All calculations use UTC storage and an explicitly selected reporting timezone for period boundaries.

### 7.1 Active student

A distinct student with at least one qualifying persisted learning action during the selected period. Qualifying actions include assessment submission, recorded study session, assignment submission, tutor interaction, or persisted activity heartbeat. Login alone does not imply meaningful engagement unless selected as a separate metric.

### 7.2 Average assessment score

The sum of earned score divided by the sum of maximum possible score for qualifying completed assessments. The dashboard also offers an unweighted per-assessment average where useful, and labels the calculation method.

Proctor auto-submissions and invalidated results follow existing StudySquare exclusion logic.

### 7.3 Improving student

A student is classified as improving when:

- the student has at least four comparable completed assessments in the selected subject or scope;
- at least two assessments fall in the baseline half of the period;
- at least two assessments fall in the recent half;
- the recent weighted average exceeds the baseline weighted average by at least five percentage points.

The dashboard shows the threshold and sample requirements. Students without sufficient evidence are classified as insufficient data, not not-improving.

### 7.4 Assessment completion rate

Completed assigned assessments divided by eligible assigned assessments whose due date or reporting window falls within the selected period. Voluntary practice assessments are reported separately.

### 7.5 At-risk indicator

The first release uses a transparent rule, not a predictive model. A student is flagged when at least two of these conditions hold:

- recent score is below 50%;
- score has declined by at least ten percentage points from baseline;
- required-assessment completion is below 60%;
- no qualifying activity occurred in the previous 14 days.

Admins can inspect which rules triggered the flag. This is an operational signal, not a diagnosis.

### 7.6 Grading operations

- Submission count.
- Successful and failed grading jobs.
- Median and 95th-percentile processing time.
- Retry count.
- Model usage by feature.
- Grading challenge or correction count where persisted.

### 7.7 Data exclusions

- Simulated daily-active and fixed session-time values in the BrainInk backend.
- In-memory-only quiz and tutor state that cannot be reliably queried.
- Deleted, invalidated, or test records according to documented filters.
- Development and staging data from production learning metrics.

## 8. AWS cost model

### 8.1 Source of truth

AWS Cost Explorer supplies the authoritative AWS-reported totals available to the application. The default financial metric is `UnblendedCost`, excluding credits and refunds from operational comparisons while showing them separately if finance requires net-cost reporting later. Current-period values can change while AWS finalizes billing, so the dashboard labels the billing period as open or finalized and records when each import was retrieved.

The import records query parameters, date ranges, and billing-view context. Cost Explorer end dates are treated as exclusive.

### 8.2 Environment and platform classification

Classification is applied in this order:

1. validated AWS cost-allocation tags;
2. CloudFormation or SAM stack identity;
3. known resource-name and ARN mappings;
4. explicit admin mapping rule;
5. `unknown` and unallocated.

The project introduces required tags for managed resources:

- `Platform`
- `Environment`
- `Service`
- `Owner`
- `CostCenter`

Existing resources are inventoried and mapped before historical reporting is considered complete. Unknown resources are never silently assigned to production or development.

### 8.3 Cost classes

- **Direct usage-derived cost:** Bedrock usage associated with a recorded feature and entity. Token or provider usage metadata is measured; request-level currency cost is calculated from effective model pricing and reconciled to AWS billing.
- **Shared allocated cost:** RDS, Lambda, API Gateway, CloudWatch, networking, and other shared AWS costs distributed by a documented rule.
- **Historical estimate:** Past per-student or per-operation allocation based on persisted assessment, grading, and activity volumes.
- **Unallocated cost:** AWS cost for which the platform, environment, or user-level driver is not supportable.

### 8.4 First-release allocation drivers

- Bedrock: measured usage by model, feature, platform, and associated entity.
- Lambda and API Gateway: platform classification followed by qualifying request or job volume when available; otherwise monthly active students within that platform.
- RDS: platform classification followed by monthly active students.
- CloudWatch and shared networking: platform classification followed by monthly active students.
- Resources classified as development: development bucket only; never included in student-production unit economics.
- Unknown resources: unallocated.

Each dashboard value exposes its cost classes and rule version.

### 8.5 Unit economics

The dashboard provides:

- production AWS cost per active student;
- direct Bedrock cost per assessment generated;
- direct Bedrock cost per grading operation;
- total allocated production cost per assessment;
- total allocated production cost per grading operation;
- cost by school and platform where source identifiers support it;
- cumulative cost for a selected student population and period;
- production versus development spend;
- measured/allocated/estimated/unallocated composition.

Division-by-zero produces an unavailable result with an explanation, never zero cost.

### 8.6 Historical backfill

Historical AWS totals are imported without modification from the Cost Explorer response. Finalized-period totals are treated as authoritative; open-period totals retain a provisional label. Historical platform and environment classification uses available tags, stack names, ARNs, and explicit mapping rules.

Historical student attribution uses persisted daily counts of active students, assessments, submissions, and grading jobs. Every resulting value is labelled estimated and carries the applied rule version. No historical event is fabricated.

## 9. Admin application

### 9.1 Navigation

- Overview.
- Students and engagement.
- Learning performance.
- Assessments and grading.
- Schools and cohorts.
- AWS costs.
- Unit economics.
- AI operations.
- Data quality.
- Allocation rules.
- Admin audit log.

### 9.2 Global filters

- Date range.
- Platform.
- Environment.
- School.
- Cohort or classroom.
- Subject.
- Assessment or assignment type.
- Measurement status.

Filters are encoded in the URL so views can be reproduced. Authorization is applied before filters, so query parameters cannot expand the caller's access.

### 9.3 Overview

The overview prioritizes:

- active students;
- average assessment score;
- students improving;
- assessment completion;
- submissions graded;
- grading failures and latency;
- production AWS spend;
- cost per active student;
- AWS spend by service;
- measured, allocated, estimated, and unallocated proportions;
- data freshness and reconciliation status.

Each metric shows source, time range, refresh timestamp, and measurement status.

### 9.4 Drill-down behavior

Charts and headline metrics link to focused pages with the same filters. Student-level details are available only to platform admins and generate audit events. Bulk export is excluded from the first release to reduce accidental exposure.

## 10. API contracts

### 10.1 StudySquare admin APIs

All endpoints are under `/api/admin`, require server-side admin authorization, validate filters, and return source/freshness metadata.

Logical endpoint groups:

- `/api/admin/overview`
- `/api/admin/students`
- `/api/admin/performance`
- `/api/admin/assessments`
- `/api/admin/grading`
- `/api/admin/costs`
- `/api/admin/unit-economics`
- `/api/admin/ai-operations`
- `/api/admin/data-quality`
- `/api/admin/allocation-rules`
- `/api/admin/sync-runs`

### 10.2 BrainInk internal analytics API

BrainInk exposes versioned aggregate endpoints rather than unrestricted database access. Requests use a signed service credential with audience, expiry, and request correlation. Responses contain no secrets and minimize personal data.

The contract supplies:

- daily student and engagement aggregates;
- daily performance and completion aggregates;
- assessment, assignment, grading, latency, and failure aggregates;
- Bedrock usage aggregates;
- dimension dictionaries needed for filters;
- source version and freshness metadata.

## 11. Security and privacy

### 11.1 Authentication

The platform introduces a server-validated session using an HTTP-only, secure, same-site cookie or an equivalently protected server session. Browser `localStorage` identity is not used to authorize admin pages or APIs.

### 11.2 Authorization

- Add a platform-admin role distinct from student, teacher, and principal roles.
- Enforce the role in server middleware or route guards and again inside every admin API.
- Default deny for unrecognized roles and missing sessions.
- Reject client-supplied user identifiers as proof of identity.

### 11.3 AWS permissions

Use a dedicated read-only IAM role limited to required Cost Explorer, billing-view, resource inventory, and tag-discovery actions. No deployment, budget mutation, or resource mutation permissions are granted to the dashboard.

### 11.4 Internal service security

- Store service credentials in AWS Secrets Manager.
- Rotate credentials.
- Use short-lived signed requests where practical.
- Validate timestamp, audience, signature, and replay protection.
- Log successful and denied internal access without logging secrets.

### 11.5 Personal data

- Aggregate data by default.
- Return only fields needed by each view.
- Audit student-record access.
- Sanitize operational error messages.
- Never include assessment answers, tutor transcripts, credentials, or raw model prompts in cost events.

### 11.6 Existing credential risk

Production database credentials found in repository scripts such as `seed_aws.py` and `check_schema.py` must be removed from tracked files and rotated before expanding admin access.

## 12. Reliability and failure handling

- Imports are idempotent and use deterministic upserts.
- Usage-event insertion deduplicates retries.
- Sync jobs checkpoint long historical ranges.
- A failed refresh preserves the last valid snapshot.
- The UI shows last successful refresh and stale-data warnings.
- Missing values remain unavailable, not zero.
- Partial source failure is shown per platform.
- Reconciliation variance above the configured operational threshold creates a data-quality warning.
- Allocation-rule changes are versioned and do not silently rewrite prior reports; recalculation is an explicit audited operation.
- All timestamps are stored in UTC.
- All financial values use fixed-precision decimal arithmetic.

## 13. Observability

Track:

- sync success, duration, lag, and row counts;
- rejected and duplicate usage events;
- admin API latency and errors;
- source-adapter failures;
- unmatched AWS resources;
- allocation coverage;
- Bedrock billed-versus-derived variance;
- stale snapshots;
- denied admin and internal-service requests.

Alerts are operational notifications; they do not mutate AWS resources.

## 14. Testing strategy

### 14.1 Unit tests

- Metric numerator, denominator, exclusions, and period boundaries.
- Improving-student and at-risk rules.
- Allocation rules and cost-class composition.
- Historical estimation.
- Decimal sums, division, rounding, and zero denominators.
- Environment and platform classification precedence.
- Usage-event deduplication.
- Authorization policy decisions.

### 14.2 Integration tests

- StudySquare analytics queries against controlled PostgreSQL fixtures.
- BrainInk aggregate contract against controlled SQLAlchemy fixtures.
- Signed internal requests, expiry, replay rejection, and credential rotation.
- Cost Explorer adapter with recorded response fixtures.
- Idempotent scheduled imports and retry behavior.
- Schema migrations and rollback-safe deployment checks.

### 14.3 End-to-end tests

- Unauthenticated, student, and teacher users cannot open `/admin` or call admin APIs.
- Platform admins can filter and drill down.
- URL filters reproduce a view.
- Stale and partial-source states display correctly.
- Allocation changes require authorization and create audit events.
- Student detail access creates an audit event.

### 14.4 Reconciliation tests

Use deterministic scripts to verify:

- allocated plus unallocated cost equals imported AWS cost for each reconciliation scope;
- grouped totals equal ungrouped totals within the defined precision;
- historical recalculation is reproducible for a rule version;
- no development cost enters production unit economics.

## 15. Delivery sequence

### Phase 1: Security and inventory

- Introduce server-side sessions and platform-admin authorization.
- Protect an empty `/admin` shell and admin API boundary.
- Remove and rotate exposed credentials.
- Inventory AWS accounts, stacks, resources, tags, and billing access.
- Define platform and environment mappings.

### Phase 2: Usage instrumentation

- Add `ai_usage_events` to both operational platforms.
- Instrument central Bedrock wrappers and direct Bedrock call sites.
- Propagate request and job correlation identifiers.
- Verify token/usage metadata for each active Bedrock model.

### Phase 3: Analytics and cost ingestion

- Add StudySquare analytics tables.
- Build product aggregate adapters.
- Build the signed BrainInk internal analytics API.
- Import AWS Cost Explorer data daily.
- Implement classification, allocation, reconciliation, and data-quality checks.

### Phase 4: Admin experience

- Build navigation, global filters, overview, performance, grading, AWS cost, unit-economics, AI-operations, and data-quality views.
- Add audit events and allocation-rule management.
- Add freshness and estimation labels throughout.

### Phase 5: Historical backfill and hardening

- Import available AWS history.
- Run historical activity-based estimates.
- Reconcile and document unmapped costs.
- Complete load, security, integration, and end-to-end verification.
- Roll out to platform admins only.

## 16. Acceptance criteria

The first release is accepted when:

1. Non-admin users cannot access admin pages or APIs.
2. The dashboard combines supported analytics from StudySquare and BrainInk.
3. Simulated engagement metrics are excluded.
4. New Bedrock calls create deduplicated usage events with platform, environment, feature, model, status, and available usage metadata.
5. AWS daily totals reconcile to allocated plus unallocated cost within fixed decimal precision.
6. Production and development costs are shown separately, with unknown resources visible.
7. Per-student and per-operation cost clearly separates direct, shared allocated, historical estimated, and unallocated amounts.
8. Historical AWS totals are never labelled estimated when sourced directly from Cost Explorer.
9. Failed or stale imports are visible and do not render false zeroes.
10. Core calculations, authorization, sync behavior, and admin flows are covered by automated tests.
11. Allocation-rule and student-detail access is audited.
12. Every headline metric displays source, selected period, refresh time, and measurement status.

## 17. Future evolution

Move normalized events and snapshots to S3 and Athena when data volume, retention, or cross-system query load justifies a warehouse. The event and aggregate contracts in this design are intentionally portable so the `/admin` application does not need to be redesigned during that migration.
