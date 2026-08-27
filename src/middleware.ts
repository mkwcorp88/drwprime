import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextFetchEvent, NextRequest, NextResponse } from "next/server";

// Host(s) that serve the Derma Rich Wellness marketing dashboard.
// Requests here are rewritten into the /marketing route group.
const MARKETING_HOSTS = ["marketing.drwprime.com", "marketing.localhost"];
const TREATMENT_HOSTS = ["admin.drwprime.com", "admin.localhost"];

function isMarketingHost(host: string | null): boolean {
  if (!host) return false;
  const hostname = host.split(":")[0];
  return MARKETING_HOSTS.includes(hostname) || hostname.startsWith("marketing.");
}

function isTreatmentHost(host: string | null): boolean {
  if (!host) return false;
  const hostname = host.split(":")[0];
  return TREATMENT_HOSTS.includes(hostname);
}

function isTreatmentRequest(request: NextRequest): boolean {
  const pathname = request.nextUrl.pathname;
  return isTreatmentHost(request.headers.get("host")) ||
    pathname.startsWith("/treatment-ops") ||
    pathname.startsWith("/api/treatment-ops");
}

function handleTreatmentRequest(request: NextRequest): NextResponse {
  if (!isTreatmentHost(request.headers.get("host"))) return NextResponse.next();

  const url = request.nextUrl;
  if (url.pathname.startsWith("/treatment-ops") || url.pathname.startsWith("/api/")) {
    return NextResponse.next();
  }

  const rewritten = url.clone();
  rewritten.pathname = `/treatment-ops${url.pathname === "/" ? "" : url.pathname}`;
  return NextResponse.rewrite(rewritten);
}

const isPublicRoute = createRouteMatcher([
  '/',
  '/treatments(.*)',
  '/home-treatment(.*)',
  '/products(.*)',
  '/product-gallery(.*)',
  '/best-deal(.*)',
  '/blog(.*)',
  '/sitemap.xml',
  '/robots.txt',
  '/sign-in(.*)',
  '/sign-up(.*)',
  '/reservation(.*)',
  // Payload CMS (has its own auth)
  '/cms(.*)',
  '/cms-api(.*)',
  '/api/cms-auto-login',
  // SEO cron jobs (Cronicle .159) — guarded by CRON_SECRET Bearer, not Clerk.
  '/api/cron(.*)',
  '/api/health',
  // Treatment operations uses its own username/password session.
  '/treatment-ops(.*)',
  '/api/treatment-ops(.*)',
  '/api/treatments(.*)',
  '/api/best-deals(.*)',
  '/api/blog(.*)',
  '/api/reservations(.*)',
  '/api/categories(.*)',
  '/api/vouchers(.*)',
  '/api/webhooks(.*)',
  // Authenticated with a dedicated bearer secret inside the route.
  '/api/internal/aido-sync',
  // Clerk OAuth callbacks
  '/api/auth(.*)',
  // Public product commerce routes
  '/api/products',
  '/api/products/doku/create-session',
  '/api/products/doku/notification',
  '/api/products/orders/(.*)',
  '/api/payment/dummy-confirm',
  // Front Office API routes (own auth via requireAdmin)
  '/api/front-office(.*)',
  '/payment(.*)',
  // Static files
  '/(.*\\.mp4$)',
  '/(.*\\.webm$)',
  '/(.*\\.png$)',
  '/(.*\\.jpg$)',
  '/(.*\\.jpeg$)',
  '/(.*\\.svg$)',
  '/(.*\\.ico$)',
]);

const withClerk = clerkMiddleware(async (auth, req: NextRequest) => {
  // Auto-login for Payload CMS — bypass the login page
  if (req.nextUrl.pathname === '/cms/login') {
    return Response.redirect(new URL('/api/cms-auto-login', req.url));
  }

  const url = req.nextUrl;

  // Subdomain routing: marketing.* → /marketing/*
  if (isMarketingHost(req.headers.get("host"))) {
    if (
      !url.pathname.startsWith("/marketing") &&
      !url.pathname.startsWith("/api") &&
      !url.pathname.startsWith("/sign-in") &&
      !url.pathname.startsWith("/sign-up")
    ) {
      const rewritten = url.clone();
      rewritten.pathname = `/marketing${url.pathname === "/" ? "" : url.pathname}`;
      const res = NextResponse.rewrite(rewritten);
      if (!isPublicRoute(req)) await auth.protect();
      return res;
    }
  }

  if (!isPublicRoute(req)) {
    await auth.protect();
  }
});

// Admin treatment operations has its own internal authentication. Bypass Clerk
// completely for its pages, APIs, and admin subdomain assets.
export default function middleware(request: NextRequest, event: NextFetchEvent) {
  if (isTreatmentRequest(request)) return handleTreatmentRequest(request);
  return withClerk(request, event);
}

export const config = {
  matcher: [
    // Skip Next.js internals and all static files, unless found in search params
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|json|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    // Always run for API routes
    "/(api|trpc)(.*)",
  ],
};
