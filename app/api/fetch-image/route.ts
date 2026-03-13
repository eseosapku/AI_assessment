import { NextRequest, NextResponse } from 'next/server'

// Uses the free Wikimedia Commons API – no API key required.
// Rate limit: generous (educational/non-commercial use).
// Attribution required: "Wikimedia Commons" or per-image license.

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.get('query')
  if (!query) {
    return NextResponse.json({ error: 'Query parameter required' }, { status: 400 })
  }

  try {
    // First: try Wikipedia REST API for a page summary (has thumbnail)
    const wikiUrl = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(query)}`
    const wikiRes = await fetch(wikiUrl, {
      headers: { 'User-Agent': 'BrainInkAssessment/1.0 (educational)' },
      next: { revalidate: 86400 }, // cache 24h
    })

    if (wikiRes.ok) {
      const data = await wikiRes.json()
      if (data.thumbnail?.source) {
        return NextResponse.json({
          url: data.thumbnail.source,
          alt: data.title,
          credit: `Wikimedia Commons – ${data.title}`,
          creditUrl: data.content_urls?.desktop?.page ?? 'https://commons.wikimedia.org',
        })
      }
    }

    // Fallback: search Wikimedia Commons directly for an image file
    const commonsUrl = new URL('https://commons.wikimedia.org/w/api.php')
    commonsUrl.searchParams.set('action', 'query')
    commonsUrl.searchParams.set('generator', 'search')
    commonsUrl.searchParams.set('gsrsearch', `${query} diagram`)
    commonsUrl.searchParams.set('gsrnamespace', '6') // File namespace
    commonsUrl.searchParams.set('gsrlimit', '3')
    commonsUrl.searchParams.set('prop', 'imageinfo')
    commonsUrl.searchParams.set('iiprop', 'url|mime|size')
    commonsUrl.searchParams.set('format', 'json')
    commonsUrl.searchParams.set('origin', '*')

    const commonsRes = await fetch(commonsUrl.toString(), {
      headers: { 'User-Agent': 'BrainInkAssessment/1.0 (educational)' },
      next: { revalidate: 86400 },
    })

    if (commonsRes.ok) {
      const commonsData = await commonsRes.json()
      const pages = commonsData?.query?.pages
      if (pages) {
        for (const page of Object.values(pages) as any[]) {
          const info = page?.imageinfo?.[0]
          if (info?.url && (info.mime?.startsWith('image/') ?? false)) {
            const title = page.title?.replace('File:', '') ?? query
            return NextResponse.json({
              url: info.url,
              alt: title,
              credit: `Wikimedia Commons – ${title}`,
              creditUrl: `https://commons.wikimedia.org/wiki/${encodeURIComponent(page.title)}`,
            })
          }
        }
      }
    }

    // No image found
    return NextResponse.json({ url: null, alt: null, credit: null }, { status: 404 })
  } catch (error: any) {
    console.error('Image fetch error:', error)
    return NextResponse.json({ error: 'Failed to fetch image' }, { status: 500 })
  }
}
