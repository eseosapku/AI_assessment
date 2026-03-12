import { NextResponse } from 'next/server'

export async function GET() {
  return NextResponse.json({
    status: 'ok',
    groq_key_set: !!process.env.GROQ_API_KEY,
    groq_key_prefix: process.env.GROQ_API_KEY?.substring(0, 8) || 'MISSING',
    node_env: process.env.NODE_ENV,
  })
}
