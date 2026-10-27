import { NextRequest, NextResponse } from 'next/server';

const MARKETING_HOSTS = ['marketing.drwprime.com', 'marketing.localhost'];
const TREATMENT_HOSTS = ['admin.drwprime.com', 'admin.localhost'];

function hostname(request: NextRequest): string {
  return request.headers.get('host')?.split(':')[0] || '';
}

function isMarketingHost(request: NextRequest): boolean {
  const host = hostname(request);
  return MARKETING_HOSTS.includes(host) || host.startsWith('marketing.');
}

function isTreatmentHost(request: NextRequest): boolean {
  return TREATMENT_HOSTS.includes(hostname(request));
}

function matchesPath(path: string, prefix: string): boolean {
  return path === prefix || path.startsWith(`${prefix}/`);
}

const PUBLIC_EXACT = new Set([
  '/', '/sitemap.xml', '/robots.txt', '/api/health', '/api/user',
  '/api/user/affiliate-code', '/api/profile', '/api/membership', '/api/member-qr',
  '/api/withdrawals', '/api/products', '/api/staff/session',
  '/api/products/doku/create-session', '/api/products/doku/notification',
  '/api/payment/dummy-confirm', '/api/internal/aido-sync', '/api/internal/aido-browser-sync',
]);
const PUBLIC_PREFIXES = [
  '/treatments', '/home-treatment', '/products', '/product-gallery', '/best-deal',
  '/blog', '/sign-in', '/sign-up', '/privacy-policy', '/staff/sign-in',
  '/my-prime', '/affiliate-dashboard', '/api/member-auth', '/reservation',
  '/cms', '/cms-api', '/api/cron', '/treatment-ops', '/api/treatment-ops',
  '/api/treatments', '/api/best-deals', '/api/blog', '/api/reservations',
  '/api/categories', '/api/vouchers', '/api/webhooks', '/api/products/orders', '/payment',
];
const STAFF_PREFIXES = [
  '/staff/profile', '/front-office', '/marketing', '/admin', '/api/staff', '/api/front-office',
  '/api/marketing', '/api/affiliate-codes', '/api/user', '/api/blog', '/api/cms-auto-login',
];

function isPublicRoute(path: string): boolean {
  return PUBLIC_EXACT.has(path) || PUBLIC_PREFIXES.some((prefix) => matchesPath(path, prefix))
    || /\.(?:mp4|webm|png|jpe?g|svg|ico)$/.test(path);
}

function isStaffRoute(path: string): boolean {
  return STAFF_PREFIXES.some((prefix) => matchesPath(path, prefix));
}

export default function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname;
  if (isTreatmentHost(request)) {
    if (path.startsWith('/treatment-ops') || path.startsWith('/api/')) return NextResponse.next();
    const rewritten = request.nextUrl.clone();
    rewritten.pathname = `/treatment-ops${path === '/' ? '' : path}`;
    return NextResponse.rewrite(rewritten);
  }
  if (path.startsWith('/treatment-ops') || path.startsWith('/api/treatment-ops')) return NextResponse.next();

  if (isMarketingHost(request) && !path.startsWith('/marketing') && !path.startsWith('/api/')
    && !path.startsWith('/sign-in') && !path.startsWith('/sign-up') && !path.startsWith('/staff/')) {
    const rewritten = request.nextUrl.clone();
    rewritten.pathname = `/marketing${path === '/' ? '' : path}`;
    return NextResponse.rewrite(rewritten);
  }

  // Server layouts and handlers verify opaque staff/member sessions. The
  // middleware only routes public pages; it never trusts a cookie as a role.
  if (isStaffRoute(path) && path.startsWith('/api/') && !['GET', 'HEAD', 'OPTIONS'].includes(request.method)) {
    const allowedOrigins = [new URL(process.env.NEXT_PUBLIC_APP_URL || request.url).origin];
    if (isMarketingHost(request)) allowedOrigins.push(request.nextUrl.origin);
    if (process.env.NODE_ENV !== 'production') allowedOrigins.push(request.nextUrl.origin);
    if (!allowedOrigins.includes(request.headers.get('origin') || '')) {
      return NextResponse.json({ error: 'Origin tidak valid.' }, { status: 403 });
    }
  }
  if (isPublicRoute(path) || isStaffRoute(path)) return NextResponse.next();
  if (path.startsWith('/api/')) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  return NextResponse.redirect(new URL(`/staff/sign-in?redirect_url=${encodeURIComponent(path + request.nextUrl.search)}`, request.url));
}

export const config = {
  matcher: [
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|json|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    '/(api|trpc)(.*)',
  ],
};
