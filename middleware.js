// Vercel Routing Middleware: cuando un "robot" de WhatsApp / Facebook / Telegram... pide un link con ?menu=...,
// se le contesta con la vista previa de ese local o producto (api/share.js). Las personas siguen entrando a la web normal.
// Hace falta porque index.html es un archivo estático y Vercel lo entrega antes que cualquier regla de vercel.json.
const BOTS = /(whatsapp|facebookexternalhit|facebot|twitterbot|telegrambot|slackbot|linkedinbot|discordbot|skypeuripreview|pinterest|embedly)/i;

export default function middleware(request) {
  try {
    const url = new URL(request.url);
    const ua = request.headers.get('user-agent') || '';
    if (url.pathname === '/' && url.searchParams.get('menu') && BOTS.test(ua)) {
      return new Response(null, { headers: { 'x-middleware-rewrite': new URL('/api/share' + url.search, request.url).toString() } });
    }
  } catch (e) { /* si algo falla, la web carga normal */ }
  return new Response(null, { headers: { 'x-middleware-next': '1' } });
}

export const config = { matcher: ['/'] };
