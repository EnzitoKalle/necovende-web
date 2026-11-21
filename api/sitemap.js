// Mapa del sitio para Google: la portada + un link por cada comercio activo.
const { consulta, esc, SITIO } = require('./_supabase');

module.exports = async (req, res) => {
  let filas = [];
  try { filas = await consulta('comercios?select=id,slug&activo=eq.true&limit=1000'); } catch (e) { /* solo portada */ }
  const urls = [SITIO + '/'].concat(filas.map((c) => SITIO + '/?menu=' + encodeURIComponent(c.slug || c.id)));
  res.setHeader('Content-Type', 'application/xml; charset=utf-8');
  res.setHeader('Cache-Control', 'public, s-maxage=3600, stale-while-revalidate=86400');
  res.status(200).send('<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">' +
    urls.map((u) => '<url><loc>' + esc(u) + '</loc></url>').join('') + '</urlset>');
};
