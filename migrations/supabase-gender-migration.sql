-- Gender on the user record.
--
-- Collected at sign-up, and asked once of everyone who signed up before this
-- column existed (see components/GenderPrompt.tsx).
--
-- Deliberately NULLable with no default: NULL means "not asked yet", which is
-- what drives the prompt. Declining is a stored answer ('prefer_not_to_say'),
-- not an absent one -- otherwise the prompt would reappear every session for
-- exactly the people who already said no.
--
-- Safe for existing users: every current row stays NULL and is asked once.

ALTER TABLE users ADD COLUMN IF NOT EXISTS gender VARCHAR(20);

-- Refuse anything outside the answers the form offers. The value reaches a
-- reported figure, and a typo written straight through becomes a category
-- nobody can query and nobody notices.
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_gender_check;
ALTER TABLE users ADD CONSTRAINT users_gender_check
  CHECK (gender IS NULL OR gender IN ('female', 'male', 'other', 'prefer_not_to_say'));

COMMENT ON COLUMN users.gender IS
  'female | male | other | prefer_not_to_say. NULL means never asked -- that is what triggers the one-time prompt. prefer_not_to_say is an ANSWER and must never be reset to NULL.';
