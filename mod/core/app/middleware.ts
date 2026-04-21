import { NextRequest, NextResponse } from 'next/server'

/**
 * Federated routing middleware.
 *
 * Checks if the first path segment matches a registered module app server.
 * If so, rewrites the request to that module's server.
 * Otherwise, falls through to the main app's routing.
 */

interface AppEntry {
  url: string
  owner: string
}

let appNamespaceCache: Record<string, AppEntry> = {}
let lastFetch = 0
const CACHE_TTL = 5000

// Use internal API URL for server-side namespace lookups (not the public proxy URL)
const API_URL = process.env.API_URL_INTERNAL || 'http://localhost:8000'

async function getAppNamespace(): Promise<Record<string, AppEntry>> {
  const now = Date.now()
  if (now - lastFetch < CACHE_TTL && Object.keys(appNamespaceCache).length > 0) {
    return appNamespaceCache
  }
  try {
    const res = await fetch(`${API_URL}/app_namespace`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    })
    if (res.ok) {
      const data = await res.json()
      const raw = data.result || data || {}
      // Normalize: support both {name: {url, owner}} and legacy {name: url_string}
      const normalized: Record<string, AppEntry> = {}
      for (const [key, val] of Object.entries(raw)) {
        if (typeof val === 'string') {
          normalized[key] = { url: val, owner: '' }
        } else if (val && typeof val === 'object') {
          normalized[key] = val as AppEntry
        }
      }
      appNamespaceCache = normalized
      lastFetch = now
    }
  } catch {
    // API not available — use cached value
  }
  return appNamespaceCache
}

// Routes that belong to the main app — never proxy these
const MAIN_APP_ROUTES = new Set([
  'api', '_next', 'favicon.ico',
  // App pages
  'mod', 'treasury', 'contracts', 'transactions', 'docs', 'chat',
  'network', 'create', 'home', 'user', 'safe', 'wallet',
  'key', 'quests', 'traders', 'jobs', 'buidl', 'cid', 'host', 'apps',
  // App internals
  'client', 'components', 'config', 'context', 'header', 'images',
  'public', 'styles', 'themes', 'types', 'ui', 'utils',
])

export async function middleware(request: NextRequest) {
  let { pathname } = request.nextUrl

  // Strip /app prefix (Caddy proxies modc2.com/app/* → localhost:3000/app/*)
  if (pathname === '/app' || pathname.startsWith('/app/')) {
    pathname = pathname.slice(4) || '/'
  }

  const segments = pathname.split('/').filter(Boolean)

  if (segments.length === 0) {
    if (request.nextUrl.pathname !== pathname) {
      const url = request.nextUrl.clone()
      url.pathname = pathname
      return NextResponse.rewrite(url)
    }
    return NextResponse.next()
  }

  const firstSegment = segments[0]

  // Skip main app routes and Next.js internals
  if (MAIN_APP_ROUTES.has(firstSegment) || firstSegment.startsWith('_')) {
    if (request.nextUrl.pathname !== pathname) {
      const url = request.nextUrl.clone()
      url.pathname = pathname
      return NextResponse.rewrite(url)
    }
    return NextResponse.next()
  }

  const namespace = await getAppNamespace()
  const entry = namespace[firstSegment]

  if (entry?.url) {
    // Rewrite to the module's server
    // Module has basePath set to /{moduleName}, so forward full path
    const target = new URL(pathname + request.nextUrl.search, entry.url)
    const response = NextResponse.rewrite(target)
    // Pass ownership info as header so frontend can use it
    response.headers.set('x-mod-owner', entry.owner || '')
    return response
  }

  // Not a registered module app — fall through to [mod] catch-all
  if (request.nextUrl.pathname !== pathname) {
    const url = request.nextUrl.clone()
    url.pathname = pathname
    return NextResponse.rewrite(url)
  }
  return NextResponse.next()
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
}
