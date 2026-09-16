const STATIC_CACHE = "drwprime-static-v4";
const RUNTIME_CACHE = "drwprime-runtime-v4";
const STATIC_ASSETS = [
  "/offline.html",
  "/drwprime-icon.png",
  "/icon-192x192.png",
  "/icon-512x512.png",
  "/drwprime-logo.png"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => {
      return cache.addAll(STATIC_ASSETS);
    })
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  const keepCaches = [STATIC_CACHE, RUNTIME_CACHE];

  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (!keepCaches.includes(cacheName)) {
            return caches.delete(cacheName);
          }
          return undefined;
        })
      );
    })
  );

  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const { request } = event;

  if (request.method !== "GET") {
    return;
  }

  const url = new URL(request.url);

  const privatePaths = ['/api', '/my-prime', '/affiliate-dashboard', '/sign-in', '/sign-up', '/staff', '/front-office', '/admin', '/marketing', '/treatment-ops', '/cms', '/cms-api'];
  const isPrivate = privatePaths.some((path) => url.pathname === path || url.pathname.startsWith(path + '/'));
  if (isPrivate) {
    if (request.mode === 'navigate') {
      event.respondWith(fetch(request).catch(() => caches.match('/offline.html')));
    }
    return;
  }

  // For page navigations, always try network first so HTML stays fresh.
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const responseClone = response.clone();
          caches.open(RUNTIME_CACHE).then((cache) => cache.put(request, responseClone));
          return response;
        })
        .catch(() => caches.match(request).then((cached) => cached || caches.match("/offline.html")))
    );
    return;
  }

  const isSameOrigin = url.origin === self.location.origin;
  const isNextStatic = isSameOrigin && url.pathname.startsWith("/_next/static/");
  const isPublicAsset = isSameOrigin && /\.(?:js|css|png|jpg|jpeg|gif|webp|svg|ico|woff2?)$/i.test(url.pathname);

  if (isNextStatic || isPublicAsset) {
    event.respondWith(
      caches.match(request).then((cachedResponse) => {
        const networkFetch = fetch(request)
          .then((response) => {
            const responseClone = response.clone();
            caches.open(RUNTIME_CACHE).then((cache) => cache.put(request, responseClone));
            return response;
          })
          .catch(() => cachedResponse);

        return cachedResponse || networkFetch;
      })
    );
  }
});
