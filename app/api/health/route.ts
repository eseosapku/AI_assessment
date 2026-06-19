import { NextResponse } from 'next/server'
import { hasBedrockCredentials } from '@/lib/aws-config'

export async function GET() {
  return NextResponse.json({
    status: 'ok',
    bedrock_credentials_set: hasBedrockCredentials(),
    node_env: process.env.NODE_ENV,
    port: process.env.PORT,
    all_env_keys: Object.keys(process.env).filter(k => !k.includes('SECRET') && !k.includes('KEY') && !k.includes('ANON')),
  })
}
