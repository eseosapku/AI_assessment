/**
 * Bedrock/AWS credentials for app runtime.
 * Amplify blocks env vars starting with AWS_; use BEDROCK_* in production.
 * Local .env can still use AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY.
 */
export function getBedrockRegion(): string {
  return (
    process.env.BEDROCK_REGION ||
    process.env.AWS_REGION ||
    'eu-west-1'
  )
}

export function getBedrockAccessKeyId(): string | undefined {
  return process.env.BEDROCK_ACCESS_KEY_ID || process.env.AWS_ACCESS_KEY_ID
}

export function getBedrockSecretAccessKey(): string | undefined {
  return process.env.BEDROCK_SECRET_ACCESS_KEY || process.env.AWS_SECRET_ACCESS_KEY
}

export function hasBedrockCredentials(): boolean {
  return Boolean(getBedrockAccessKeyId() && getBedrockSecretAccessKey())
}

export function getBedrockCredentials():
  | { accessKeyId: string; secretAccessKey: string }
  | null {
  const accessKeyId = getBedrockAccessKeyId()
  const secretAccessKey = getBedrockSecretAccessKey()
  if (!accessKeyId || !secretAccessKey) return null
  return { accessKeyId, secretAccessKey }
}

export const BEDROCK_CREDENTIALS_ERROR =
  'AWS credentials not configured. Set BEDROCK_ACCESS_KEY_ID and BEDROCK_SECRET_ACCESS_KEY (or AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY locally).'
