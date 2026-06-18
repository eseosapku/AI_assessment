#!/usr/bin/env node
/**
 * Create a NardoPay subscription link with webhook + redirect baked in.
 * NardoPay has no dashboard field for webhooks — they are set only via this API.
 *
 * Usage:
 *   node scripts/setup-nardopay-link.js
 *   node scripts/setup-nardopay-link.js --amount 500 --currency KES --url https://your-app.com
 *
 * Requires NARDOPAY_API_KEY in .env
 */
const fs = require('fs')
const path = require('path')

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
    const key = trimmed.slice(0, eq).trim()
    const value = trimmed.slice(eq + 1).trim()
    if (key) process.env[key] = value
  }
}

function arg(name, fallback) {
  const i = process.argv.indexOf(`--${name}`)
  if (i >= 0 && process.argv[i + 1]) return process.argv[i + 1]
  return fallback
}

async function main() {
  loadEnv()
  const apiKey = process.env.NARDOPAY_API_KEY
  if (!apiKey) {
    console.error('Missing NARDOPAY_API_KEY in .env')
    process.exit(1)
  }

  const appUrl = (arg('url', process.env.NEXT_PUBLIC_APP_URL) || 'http://localhost:3000').replace(/\/$/, '')
  const amount = Number(arg('amount', process.env.NARDOPAY_SUBSCRIPTION_AMOUNT || '5000'))
  const currency = String(arg('currency', process.env.NARDOPAY_SUBSCRIPTION_CURRENCY || 'RWF')).toUpperCase()

  if (!Number.isFinite(amount) || amount <= 0) {
    console.error('Invalid amount. Pass --amount 5000 or set NARDOPAY_SUBSCRIPTION_AMOUNT')
    process.exit(1)
  }

  const webhookUrl = `${appUrl}/api/subscription/webhook`
  const redirectUrl = `${appUrl}/subscription/success`

  console.log('Creating NardoPay subscription link for Study Square…')
  console.log('  App URL:     ', appUrl)
  console.log('  Webhook:     ', webhookUrl)
  console.log('  Redirect:    ', redirectUrl)
  console.log('  Amount:      ', amount, currency)

  const res = await fetch(
    'https://mczqwqsvumfsneoknlep.supabase.co/functions/v1/create-payment-link-api',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        link_type: 'subscription',
        plan_name: 'Study Square',
        amount,
        currency,
        billing_cycle: 'monthly',
        trial_days: 0,
        description: 'StudySquare unlimited assessments and StudyLab access',
        webhook_url: webhookUrl,
        redirect_url: redirectUrl,
      }),
    },
  )

  const json = await res.json().catch(() => ({}))
  if (!res.ok || !json.link_code) {
    console.error('NardoPay API error:', json.message || json.error || res.status)
    process.exit(1)
  }

  console.log('\n✓ Link created successfully\n')
  console.log('Add these to your .env (production + local as needed):\n')
  console.log(`NEXT_PUBLIC_NARDOPAY_LINK_CODE=${json.link_code}`)
  console.log(`NEXT_PUBLIC_NARDOPAY_SUBSCRIBE_URL=${json.url}`)
  console.log(`NEXT_PUBLIC_APP_URL=${appUrl}`)
  console.log(`NARDOPAY_SUBSCRIPTION_AMOUNT=${amount}`)
  console.log(`NARDOPAY_SUBSCRIPTION_CURRENCY=${currency}`)
  console.log('\nShare this subscribe URL with users:')
  console.log(json.url)
  console.log('\nNote: Dashboard-created links cannot set webhooks. Use this API link instead.')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
