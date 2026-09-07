import nodemailer from 'nodemailer'

const DEFAULT_FROM = 'braininkedu@gmail.com'
const DEFAULT_FROM_NAME = 'StudySquare'

function smtpConfig() {
  const user = process.env.SMTP_USER?.trim() || DEFAULT_FROM
  // Gmail app passwords are 16 characters; Google displays them with spaces.
  const pass = process.env.SMTP_PASS?.replace(/\s+/g, '').trim()
  if (!pass) return null

  return {
    host: process.env.SMTP_HOST?.trim() || 'smtp.gmail.com',
    port: Number(process.env.SMTP_PORT || 587),
    secure: process.env.SMTP_SECURE === 'true',
    auth: { user, pass },
  }
}

export function emailFromAddress(): string {
  return process.env.EMAIL_FROM?.trim() || process.env.SMTP_USER?.trim() || DEFAULT_FROM
}

export function emailFromName(): string {
  return process.env.EMAIL_FROM_NAME?.trim() || DEFAULT_FROM_NAME
}

export function isEmailConfigured(): boolean {
  return smtpConfig() !== null
}

export async function sendPasswordResetOtp(to: string, otp: string): Promise<void> {
  const config = smtpConfig()
  if (!config) {
    throw new Error('Email is not configured')
  }

  const from = `"${emailFromName()}" <${emailFromAddress()}>`
  const transport = nodemailer.createTransport(config)

  await transport.sendMail({
    from,
    to,
    subject: 'Your password reset code',
    text: [
      'You requested a password reset for your StudySquare account.',
      '',
      `Your verification code is: ${otp}`,
      '',
      'This code expires in 15 minutes. If you did not request this, you can ignore this email.',
    ].join('\n'),
    html: [
      '<p>You requested a password reset for your StudySquare account.</p>',
      `<p style="font-size:24px;font-weight:bold;letter-spacing:4px;margin:24px 0;">${otp}</p>`,
      '<p>This code expires in 15 minutes. If you did not request this, you can ignore this email.</p>',
    ].join(''),
  })
}
