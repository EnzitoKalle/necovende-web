/* NecoVende - Service Worker
 *
 * VERSIÓN: cambiá este número cuando agregues/quites archivos de PRECACHE o
 * quieras forzar que todos los celulares limpien lo guardado. Al cambiar este
 * archivo (aunque sea un byte) el navegador instala el SW nuevo y borra los
 * cachés de versiones anteriores.
 *
 * Estrategia (para que NUNCA se quede con archivos viejos):
 *  - Páginas, JS, CSS y manifest: primero red (siempre lo último); si no hay
 *    internet, usa lo guardado.
 *  - Imágenes y fuentes propias: usa lo guardado y lo actualiza en segundo plano.
 *  - Supabase, CDNs y cualquier otro dominio: no se tocan (pasan directo).
 *  - Todo lo que no sea GET (pedidos, likes, etc.): no se toca.
 */
const VERSION = 'v1';
const CACHE = 'necovende-' + VERSION;

const PRECACHE = [
  '/',
  '/index.html',
  '/site.webmanifest',
  '/css/styles.css',
  '/js/tailwind-config.js',
  '/js/01-config-y-estado.js',
  '/js/02-utilidades-favoritos-historial.js',
  '/js/03-imagenes-horarios-envios.js',
  '/js/04-sesion-y-admin.js',
  '/js/05-interfaz-base-y-carrito-guardado.js',
  '/js/06-vista-comercio-y-productos.js',
  '/js/07-opciones-carrito-y-pedido.js',
  '/js/08-marketplace-categorias-busqueda.js',
  '/js/09-formularios-comercio-producto-promo.js',
  '/js/10-eventos-e-inicio.js',
  '/js/11-categorias.js',
  '/js/12-extras-comercio.js',
  '/js/13-promos-eleccion.js',
  '/js/14-listas-editables.js',
  '/js/15-instalar-app.js',
  '/js/16-notificaciones-push.js',
  '/img/icon-192.png',
  '/img/icon-512.png',
  '/img/apple-touch-icon.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    // Uno por uno: si un archivo falla (o no existe), el resto se guarda igual.
    await Promise.all(PRECACHE.map(async (url) => {
      try { await cache.add(new Request(url, { cache: 'reload' })); } catch (e) { /* se ignora */ }
    }));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const claves = await caches.keys();
    await Promise.all(
      claves.filter((k) => k.startsWith('necovende-') && k !== CACHE).map((k) => caches.delete(k))
    );
    await self.clients.claim();
  })());
});

async function redPrimero(request, fallbackUrl) {
  const cache = await caches.open(CACHE);
  try {
    // Revalida siempre con el servidor (no usa la copia vieja del navegador).
    const resp = request.mode === 'navigate' ? await fetch(request) : await fetch(request, { cache: 'no-cache' });
    if (resp && resp.ok) cache.put(request, resp.clone());
    return resp;
  } catch (e) {
    const guardado = await cache.match(request, { ignoreSearch: true });
    if (guardado) return guardado;
    if (fallbackUrl) {
      const base = await cache.match(fallbackUrl);
      if (base) return base;
    }
    return Response.error();
  }
}

async function guardadoYActualizar(request) {
  const cache = await caches.open(CACHE);
  const guardado = await cache.match(request);
  const actualizar = fetch(request).then((resp) => {
    if (resp && resp.ok) cache.put(request, resp.clone());
    return resp;
  }).catch(() => null);
  return guardado || (await actualizar) || Response.error();
}

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;            // Supabase, CDNs, etc.
  if (url.pathname === '/sw.js') return;                      // el SW se actualiza solo por la red

  if (req.mode === 'navigate') {
    event.respondWith(redPrimero(req, '/index.html'));
    return;
  }
  if (/\.(?:png|jpe?g|webp|gif|svg|ico|woff2?|ttf)$/i.test(url.pathname)) {
    event.respondWith(guardadoYActualizar(req));
    return;
  }
  if (/\.(?:js|css|webmanifest)$/i.test(url.pathname)) {
    event.respondWith(redPrimero(req));
  }
});

/* Avisos push (para los pedidos). Mismo formato que usa la función "notificar":
 * { title, body, url, tag } */
self.addEventListener('push', (event) => {
  let d = {};
  try { d = event.data ? event.data.json() : {}; } catch (e) { d = { body: event.data && event.data.text() }; }
  event.waitUntil(self.registration.showNotification(d.title || 'NecoVende', {
    body: d.body || '',
    icon: '/img/icon-192.png',
    badge: '/img/favicon-32x32.png',
    tag: d.tag || undefined,
    data: { url: d.url || '/' }
  }));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const destino = new URL((event.notification.data && event.notification.data.url) || '/', self.location.origin).href;
  event.waitUntil((async () => {
    const ventanas = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const w of ventanas) {
      if (new URL(w.url).origin === self.location.origin && 'focus' in w) {
        await w.focus();
        if ('navigate' in w) { try { await w.navigate(destino); } catch (e) { /* ok */ } }
        return;
      }
    }
    await self.clients.openWindow(destino);
  })());
});
