#!/usr/bin/env node
/**
 * Create a free-tier test student for paywall / subscription testing.
 * Usage: node scripts/create-test-user.js
 */
const fs = require('fs')
const path = require('path')
const bcrypt = require('bcryptjs')
const { createClient } = require('@supabase/supabase-js')

function loadEnv() {
  const envPath = path.join(__dirname, '..', '.env')
  if (!fs.existsSync(envPath)) return
  let text = fs.readFileSync(envPath, 'utf8')
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1)
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eq = trimmed.indexOf('=')
    if (eq <= 0) continue
    process.env[trimmed.slice(0, eq).trim()] = trimmed.slice(eq + 1).trim()
  }
}

async function main() {
  loadEnv()
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !key) {
    console.error('Missing Supabase env vars')
    process.exit(1)
  }

  const email = 'paywall.test@studysquare.org'
  const password = 'StudySquare-Test-2026'
  const name = 'Paywall Test User'
  const studentId = 'STD-TEST-2026'
  const className = 'S3'
  const country = 'RW'

  const supabase = createClient(url, key)

  const { data: existing } = await supabase.from('users').select('id, email').eq('email', email).maybeSingle()
  if (existing) {
    await supabase
      .from('users')
      .update({
        subscription_status: 'free',
        free_assessments_used: 2,
        subscription_started_at: null,
        subscription_expires_at: null,
        flutterwave_ref: null,
        password_hash: await bcrypt.hash(password, 10),
        name,
        class: className,
        country,
      })
      .eq('id', existing.id)
    console.log('Reset existing test user (free tier, paywall ready — 2/2 free assessments used)')
    console.log(JSON.stringify({ email, password, studentId, role: 'student', country, userId: existing.id }, null, 2))
    return
  }

  const passwordHash = await bcrypt.hash(password, 10)
  const { data: newUser, error } = await supabase
    .from('users')
    .insert({
      email,
      password_hash: passwordHash,
      name,
      student_id: studentId,
      class: className,
      role: 'student',
      country,
      subjects: ['Mathematics', 'Physics', 'Chemistry', 'Biology', 'Computer Science'],
      subscription_status: 'free',
      free_assessments_used: 0,
    })
    .select('id, email, student_id, role, country, subscription_status, free_assessments_used')
    .single()

  if (error || !newUser) {
    console.error('Failed to create user:', error?.message || error)
    process.exit(1)
  }

  console.log('Created test user:')
  console.log(
    JSON.stringify(
      {
        email,
        password,
        studentId: newUser.student_id,
        role: newUser.role,
        country: newUser.country,
        subscription: newUser.subscription_status,
        freeAssessmentsUsed: newUser.free_assessments_used,
        userId: newUser.id,
        loginUrl: 'https://studysquare.org/login',
      },
      null,
      2,
    ),
  )
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
