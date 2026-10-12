import fs from 'node:fs'
import { resolveAsset } from '@/lib/figure-library/asset'

/**
 * The figure library's local files, for quizzes on this machine before S3 and CloudFront exist
 * (spec 5.6). Development only: in production FIGURE_ASSET_BASE points at CloudFront and this
 * answers 404.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ key: string[] }> }) {
  const dir = process.env.FIGURE_LIBRARY_DIR ?? ''
  if (process.env.NODE_ENV === 'production' || !dir) return new Response('Not found', { status: 404 })
  const { key = [] } = await params
  // A figure's path is "<base>/assets/...": the key starts with "assets", which is where it resolves.
  const found = resolveAsset(dir, ['assets', ...key.slice(key[0] === 'assets' ? 1 : 0)])
  if (!found) return new Response('Not found', { status: 404 })
  return new Response(new Uint8Array(fs.readFileSync(found.file)), {
    headers: { 'Content-Type': found.type, 'Cache-Control': 'private, max-age=3600', 'X-Content-Type-Options': 'nosniff',
      // An SVG opened on its own runs nothing.
      'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'; img-src data:" },
  })
}
