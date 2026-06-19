import { NextResponse } from 'next/server'
import { hasBedrockCredentials } from '@/lib/aws-config'
import { isFlutterwaveConfigured } from '@/lib/flutterwave'

function envKeyNames(prefix: string): string[] {
  return Object.keys(process.env)
    .filter((k) => k.startsWith(prefix))
    .sort()
}

export async function GET() {
  const flwKeys = envKeyNames('FLW_')
  return NextResponse.json({
    status: 'ok',
    bedrock_credentials_set: hasBedrockCredentials(),
    flutterwave_configured: isFlutterwaveConfigured(),
    flutterwave_env_keys_present: flwKeys,
    node_env: process.env.NODE_ENV,
    port: process.env.PORT,
    all_env_keys: Object.keys(process.env).filter(k => !k.includes('SECRET') && !k.includes('KEY') && !k.includes('ANON')),
  })
}
