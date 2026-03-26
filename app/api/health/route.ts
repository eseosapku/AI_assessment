import { NextResponse } from 'next/server'

export async function GET() {
  return NextResponse.json({
    status: 'ok',
    aws_key_set: !!process.env.AWS_ACCESS_KEY_ID,
    node_env: process.env.NODE_ENV,
    port: process.env.PORT,
    all_env_keys: Object.keys(process.env).filter(k => !k.includes('SECRET') && !k.includes('KEY') && !k.includes('ANON')),
  })
}
