import { NextRequest, NextResponse } from 'next/server'

const TESTLAB_PREFIX = '/testlab'

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  if (!pathname.startsWith(TESTLAB_PREFIX)) {
    return NextResponse.next()
  }

  const rewrittenUrl = request.nextUrl.clone()
  rewrittenUrl.pathname = pathname === TESTLAB_PREFIX ? '/' : pathname.replace(TESTLAB_PREFIX, '')

  const requestHeaders = new Headers(request.headers)
  requestHeaders.set('x-app-mount-path', TESTLAB_PREFIX)

  return NextResponse.rewrite(rewrittenUrl, {
    request: {
      headers: requestHeaders,
    },
  })
}

export const config = {
  matcher: ['/testlab', '/testlab/:path*'],
}