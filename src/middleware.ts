import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";

// Host(s) that serve the Derma Rich Wellness marketing dashboard.
// Requests here are rewritten into the /marketing route group.
const MARKETING_HOSTS = ["marketing.drwprime.com", "marketing.localhost"];

function isMarketingHost(host: string | null): boolean {
  if (!host) return false;
  const hostname = host.split(":")[0];
  return MARKETING_HOSTS.includes(hostname) || hostname.startsWith("marketing.");
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
  '/api/treatments(.*)',
  '/api/best-deals(.*)',
  '/api/blog(.*)',
  '/api/reservations(.*)',
  '/api/categories(.*)',
  '/api/vouchers(.*)',
  '/api/webhooks(.*)',
  // Clerk OAuth callbacks
  '/api/auth(.*)',
  // Static files
  '/(.*\\.mp4$)',
  '/(.*\\.webm$)',
  '/(.*\\.png$)',
  '/(.*\\.jpg$)',
  '/(.*\\.jpeg$)',
  '/(.*\\.svg$)',
  '/(.*\\.ico$)',
]);

export default clerkMiddleware(async (auth, req: NextRequest) => {
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

export const config = {
  matcher: [
    // Skip Next.js internals and all static files, unless found in search params
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|json|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    // Always run for API routes
    "/(api|trpc)(.*)",
  ],
};
