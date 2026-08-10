-- Profile photos were stored only in the browser's localStorage, so a photo set
-- on one device never appeared on any other, and was lost whenever site data
-- was cleared. This gives them a home on the user record.
--
-- Stored as a compressed data URL (256px JPEG, ~20-30KB) rather than a file in
-- object storage: it keeps the whole feature to one column with no bucket,
-- signing or lifecycle to manage, at a size a TEXT column handles comfortably.

ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_url TEXT;
