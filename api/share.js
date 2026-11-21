// Vista previa al compartir un local o un producto (WhatsApp, Facebook, Telegram, X...).
// Vercel manda acá solo a esos "robots" (ver vercel.json); las personas siguen entrando a la web normal.
const { consulta, esUuid, esc, SITIO } = require('./_supabase');

module.exports = async (req, res) => {
  const menu = String((req.query && req.query.menu) || '').slice(0, 120);
  const prodId = String((req.query && req.query.producto) || '').slice(0, 60);
  const destino = SITIO + '/?menu=' + encodeURIComponent(menu) + (prodId ? '&producto=' + encodeURIComponent(prodId) : '');
  let titulo = 'NecoVende | Marketplace Digital de Necochea & Quequén';
  let desc = 'Pedí directo a los comercios locales, sin intermediarios.';
  let img = SITIO + '/img/og-image.jpg';
  try {
    const campos = 'id,nombre,slug,logo_url,portada_url,direccion,categoria';
    let filas = await consulta('comercios?select=' + campos + '&activo=eq.true&slug=eq.' + encodeURIComponent(menu) + '&limit=1');
    if (!filas.length && esUuid(menu)) filas = await consulta('comercios?select=' + campos + '&activo=eq.true&id=eq.' + menu + '&limit=1');
    const c = filas[0];
    if (c) {
      titulo = c.nombre + ' | NecoVende';
      desc = 'Mirá el catálogo y pedí directo a ' + c.nombre + (c.direccion ? ' · ' + c.direccion : '') + '. Sin intermediarios.';
      img = c.portada_url || c.logo_url || img;
      if (esUuid(prodId)) {
        const p = (await consulta('productos?select=titulo,descripcion,precio,imagen_url&id=eq.' + prodId + '&comercio_id=eq.' + c.id + '&limit=1'))[0];
        if (p) {
          titulo = p.titulo + ' · ' + c.nombre;
          desc = (p.precio ? '$' + Number(p.precio).toLocaleString('es-AR') + ' · ' : '') + (p.descripcion ? String(p.descripcion).slice(0, 120) : 'Pedilo en NecoVende');
          img = p.imagen_url || img;
        }
      }
    }
  } catch (e) { /* si algo falla se muestra la vista previa general */ }
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=600');
  res.status(200).send('<!doctype html><html lang="es"><head><meta charset="utf-8"><title>' + esc(titulo) + '</title>' +
    '<meta name="description" content="' + esc(desc) + '"><meta property="og:type" content="website"><meta property="og:site_name" content="NecoVende">' +
    '<meta property="og:title" content="' + esc(titulo) + '"><meta property="og:description" content="' + esc(desc) + '"><meta property="og:image" content="' + esc(img) + '">' +
    '<meta property="og:url" content="' + esc(destino) + '"><meta name="twitter:card" content="summary_large_image">' +
    '<link rel="canonical" href="' + esc(destino) + '"><meta http-equiv="refresh" content="0;url=' + esc(destino) + '"></head><body><a href="' + esc(destino) + '">Abrir en NecoVende</a></body></html>');
};
