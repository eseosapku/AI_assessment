/**
 * The owner's verdicts from /dev/scenes, kept in a git-ignored file so the next
 * round of fixes can read them. Dev only: there is nothing to store in production.
 */
import { promises as fs } from 'node:fs'
import path from 'node:path'
import { NextResponse } from 'next/server'

const FILE = path.join(process.cwd(), '.superpowers', 'scene-notes.json')
const off = () => process.env.NODE_ENV === 'production'

export async function GET() {
  if (off()) return new NextResponse(null, { status: 404 })
  try {
    return NextResponse.json(JSON.parse(await fs.readFile(FILE, 'utf8')))
  } catch {
    return NextResponse.json({})
  }
}

export async function POST(request: Request) {
  if (off()) return new NextResponse(null, { status: 404 })
  const notes = await request.json()
  if (!notes || typeof notes !== 'object' || Array.isArray(notes)) return new NextResponse(null, { status: 400 })
  await fs.mkdir(path.dirname(FILE), { recursive: true })
  await fs.writeFile(FILE, JSON.stringify(notes, null, 2))
  return NextResponse.json({ ok: true })
}
