import { NextResponse } from 'next/server'

export async function GET() {
  return NextResponse.json({
    status: 'ok',
    groq_key_set: !!process.env.GROQ_API_KEY,
    groq_key_prefix: process.env.GROQ_API_KEY?.substring(0, 10) || 'MISSING',
    node_env: process.env.NODE_ENV,
    port: process.env.PORT,
    all_env_keys: Object.keys(process.env).filter(k => !k.includes('SECRET') && !k.includes('KEY') && !k.includes('ANON')),
  })
}
