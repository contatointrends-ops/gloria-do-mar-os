// ═══════════════════════════════════════════════════════
//  GLÓRIA DO MAR — Service Worker v1.0
//  Offline-first strategy com cache seletivo
// ═══════════════════════════════════════════════════════

const CACHE_NAME    = 'gloria-do-mar-v1';
const CACHE_STATIC  = 'gloria-static-v1';

const STATIC_ASSETS = [
  './',
  './index.html',
  './app.html',
  './landing.html',
  './mapa-app.html',
  './manifest.json',
  './Logo.png',
  './hero.png',
  './1.png',
  './gloria_ai_vision_tabatinga_1774727274721.jpg',
  './gloria_kds_kitchen_tech_1774727454392.jpg',
  './gloria_vip_experience_app_1774727338197.jpg',
];

// ── INSTALL ──────────────────────────────────────────────
self.addEventListener('install', event => {
  console.log('[SW] Instalando Glória do Mar PWA...');
  event.waitUntil(
    caches.open(CACHE_STATIC).then(cache => {
      return cache.addAll(STATIC_ASSETS.map(url => new Request(url, { cache: 'reload' })));
    }).catch(err => console.warn('[SW] Cache parcial:', err))
  );
  self.skipWaiting();
});

// ── ACTIVATE ─────────────────────────────────────────────
self.addEventListener('activate', event => {
  console.log('[SW] Ativando nova versão...');
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.filter(k => k !== CACHE_STATIC && k !== CACHE_NAME)
            .map(k => caches.delete(k))
      )
    )
  );
  self.clients.claim();
});

// ── FETCH ─────────────────────────────────────────────────
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // Chamadas à API NEXUS — sempre network-first (nunca cache)
  if (url.hostname.includes('railway.app') || url.pathname.includes('/invoke') || url.pathname.includes('/health')) {
    event.respondWith(
      fetch(event.request).catch(() =>
        new Response(JSON.stringify({ success: false, detail: 'NEXUS offline — modo local ativo' }),
          { headers: { 'Content-Type': 'application/json' } })
      )
    );
    return;
  }

  // Recursos externos (fonts, CDN) — network-first com fallback
  if (url.origin !== self.location.origin) {
    event.respondWith(
      fetch(event.request).catch(() => caches.match(event.request))
    );
    return;
  }

  // Recursos locais — cache-first
  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached;
      return fetch(event.request).then(response => {
        if (response && response.status === 200 && response.type === 'basic') {
          const clone = response.clone();
          caches.open(CACHE_STATIC).then(cache => cache.put(event.request, clone));
        }
        return response;
      });
    }).catch(() => {
      // Fallback para páginas HTML
      if (event.request.destination === 'document') {
        return caches.match('./app.html');
      }
    })
  );
});

// ── PUSH NOTIFICATIONS ────────────────────────────────────
self.addEventListener('push', event => {
  const data = event.data ? event.data.json() : { title: 'Glória do Mar', body: 'Nova atualização!' };
  event.waitUntil(
    self.registration.showNotification(data.title || 'Glória do Mar', {
      body:    data.body || 'Você tem uma nova notificação.',
      icon:    './Logo.png',
      badge:   './Logo.png',
      vibrate: [200, 100, 200],
      data:    { url: data.url || './app.html' }
    })
  );
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  event.waitUntil(clients.openWindow(event.notification.data.url));
});
