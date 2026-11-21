// Datos públicos de NecoVende (la clave anon es pública: la misma que usa la web)
const URL_SB = 'https://itpkfuprqihmclsqjfki.supabase.co';
const KEY_SB = 'sb_publishable_sW8WBd-hoa155VOla5xj8A__0X494yO';
const SITIO = 'https://necovende-web.vercel.app';
async function consulta(ruta) {
  const r = await fetch(URL_SB + '/rest/v1/' + ruta, { headers: { apikey: KEY_SB, Authorization: 'Bearer ' + KEY_SB } });
  if (!r.ok) return [];
  return r.json();
}
const esUuid = (s) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(s || ''));
const esc = (t) => String(t == null ? '' : t).replace(/[&<>"']/g, (m) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));
module.exports = { consulta, esUuid, esc, SITIO };
