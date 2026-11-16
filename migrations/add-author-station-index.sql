-- Stations written ahead (ai_jobs rows of job_type 'author_station') are found
-- by the lesson, step and version in their payload, on every author request and
-- every authored turn. Without this the lookup filtered the jsonb of every
-- station row ever written. Rows older than 30 days are cleared by the author
-- route's sweep (lib/studylab/stationJobs.ts sweepStations).
--
-- CONCURRENTLY: built without locking the table; run outside a transaction.
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_ai_jobs_author_station
  ON ai_jobs (job_type, (input_payload->>'spaceId'), (input_payload->>'stepId'), (input_payload->>'version'));
