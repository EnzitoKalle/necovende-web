/* NecoVende - Planes: comparativa, reglas por plan y aviso "Disponible en el plan Ultra"
 *
 * UNA sola tabla (FUNCIONES) manda en tres cosas:
 *   1) la comparativa del modal de planes (tilde / valor / X por plan),
 *   2) planPermite(funcion, comercio|plan): lo que usa el código para bloquear,
 *   3) el aviso corto con botón "Ver planes" (avisoPlan / exigirPlan).
 * Si cambia una regla de planes, se cambia acá y en 06-planes.sql (la base también la aplica).
 */
(function () {
  'use strict';

  var ORDEN = { gratis: 1, pro: 2, ultra: 3 };
  var NOMBRE = { gratis: 'Gratis', pro: 'Pro', ultra: 'Ultra' };
  var TILDE = { gratis: 'bg-emerald-100 text-emerald-600', pro: 'bg-sky-100 text-sky-600', ultra: 'bg-amber-100 text-amber-600' };

  // min = plan mínimo que incluye la función · inc[plan] = texto cuando está incluida · lab = texto cuando NO
  var FUNCIONES = [
    { id: 'productos',  min: 'gratis', lab: 'Cantidad de productos',
      inc: { gratis: '<b>5 productos</b>', pro: '<b>10 productos</b>', ultra: '<b>Productos ilimitados</b>' } },
    { id: 'verificado', min: 'pro', lab: 'Insignia de verificado',
      inc: { pro: 'Insignia de verificado: <b class="text-sky-600">tilde azul</b>', ultra: 'Insignia de verificado: <b class="text-amber-600">tilde dorada</b>' } },
    { id: 'links',      min: 'pro', lab: 'Links de redes o web',
      inc: { pro: '<b>1 link</b> de redes o web', ultra: '<b>3 links</b> de redes o web' } },
    { id: 'prioridad',  min: 'pro', lab: 'Posicionamiento prioritario' },
    { id: 'portada',    min: 'ultra', lab: 'Foto de portada' },
    { id: 'colores',    min: 'ultra', lab: 'Colores de fondo y de botones personalizados' },
    { id: 'ofertas',    min: 'ultra', lab: 'Ofertas (precio anterior tachado y % de descuento)' },
    { id: 'promos',     min: 'ultra', lab: 'Promociones y combos' },
    { id: 'puntos',     min: 'ultra', lab: 'Sistema de puntos (suma y canje)' },
    { id: 'pedidos',    min: 'gratis', lab: 'Panel de pedidos y notificaciones' }
  ];
  var POR_ID = {}; FUNCIONES.forEach(function (f) { POR_ID[f.id] = f; });

  var LIMITE_PRODUCTOS = { gratis: 5, pro: 10, ultra: Infinity };
  var LIMITE_LINKS = { gratis: 0, pro: 1, ultra: 3 };

  function el(id) { return document.getElementById(id); }

  /* ---------------------------------------------------------------- reglas */
  // Plan que HOY vale para un comercio (si el pago venció, cargarComercios ya lo dejó en 'gratis')
  function planDe(x) {
    var p = (x && typeof x === 'object') ? (x.plan || 'gratis') : (x || 'gratis');
    return ORDEN[p] ? p : 'gratis';
  }
  function planPermite(funcion, x) {
    var f = POR_ID[funcion]; if (!f) return false;
    return ORDEN[planDe(x)] >= ORDEN[f.min];
  }

  /* ---------------------------------------------------------------- comparativa */
  function fila(f, plan) {
    var incluida = ORDEN[plan] >= ORDEN[f.min];
    if (incluida) {
      var txt = (f.inc && f.inc[plan]) || f.lab;
      return '<li class="flex items-start gap-2.5"><span class="flex-shrink-0 w-5 h-5 rounded-full ' + TILDE[plan] + ' flex items-center justify-center text-[11px] font-black leading-none mt-px" aria-label="Incluido">✔</span>' +
             '<span class="leading-snug">' + txt + '</span></li>';
    }
    return '<li class="flex items-start gap-2.5 text-slate-400"><span class="flex-shrink-0 w-5 h-5 rounded-full bg-rose-50 text-rose-500 flex items-center justify-center text-[11px] font-black leading-none mt-px" aria-label="No incluido">✘</span>' +
           '<span class="leading-snug">' + f.lab + '</span></li>';
  }
  function renderComparativa() {
    Object.keys(ORDEN).forEach(function (plan) {
      var ul = el('plan-lista-' + plan); if (!ul) return;
      ul.innerHTML = FUNCIONES.map(function (f) { return fila(f, plan); }).join('');
    });
  }

  /* ---------------------------------------------------------------- aviso de plan */
  var AVISO = { destino: 'ultra' };
  function avisoPlan(requerido, detalle) {
    var req = requerido === 'pro' ? 'pro' : 'ultra';
    AVISO.destino = req;
    el('aviso-plan-titulo').innerText = req === 'pro' ? 'Disponible desde el plan Pro' : 'Disponible en el plan Ultra';
    el('aviso-plan-detalle').innerText = detalle ? detalle + ' es una función del plan ' + NOMBRE[req] + '.' : '';
    el('modal-aviso-plan').classList.remove('hidden');
  }
  function cerrarAvisoPlan() { el('modal-aviso-plan').classList.add('hidden'); }
  function verPlanesDesdeAviso() { cerrarAvisoPlan(); abrirModal('modal-planes'); }
  // Atajo: true si el comercio puede usar la función; si no, muestra el aviso y devuelve false
  function exigirPlan(funcion, x) {
    if (planPermite(funcion, x)) return true;
    var f = POR_ID[funcion];
    avisoPlan(f ? f.min : 'ultra', f ? f.lab : '');
    return false;
  }

  /* ---------------------------------------------------------------- formulario del comercio */
  // Muestra el candado en lugar de los campos que el plan no incluye
  function bloqueosFormComercio(plan) {
    var p = planDe(plan);
    var le = el('lock-enlaces'), lu = el('lock-ultra-visual');
    if (le) le.classList.toggle('hidden', ORDEN[p] >= ORDEN.pro);
    if (lu) lu.classList.toggle('hidden', p === 'ultra');
  }

  /* ---------------------------------------------------------------- "Mis puntos" (solo comercios Ultra) */
  async function cargarMisPuntos() {
    var box = el('mis-puntos-box'); if (!box) return;
    box.classList.add('hidden');
    if (!usuarioActual) return;
    try {
      var r = await _supabase.from('pv_puntos_mov').select('comercio_id, puntos').eq('cliente_id', usuarioActual.id);
      if (r.error || !r.data || !r.data.length) return;
      var saldo = {};
      r.data.forEach(function (m) { saldo[m.comercio_id] = (saldo[m.comercio_id] || 0) + (Number(m.puntos) || 0); });
      var lista = (typeof comerciosGlobales !== 'undefined' ? comerciosGlobales : []);
      var filas = Object.keys(saldo).map(function (id) {
        var c = lista.find(function (x) { return String(x.id) === String(id); });
        return c && planPermite('puntos', c) ? { nombre: c.nombre, pts: saldo[id] } : null;   // si el comercio ya no es Ultra, no se muestra
      }).filter(function (x) { return x && x.pts > 0; });
      if (!filas.length) return;
      box.innerHTML = '<div class="bg-amber-50 border border-amber-200 rounded-2xl p-3.5 space-y-2">' +
        '<p class="text-xs font-black text-amber-800 flex items-center gap-1.5">✨ Mis puntos</p>' +
        filas.map(function (f) {
          return '<div class="flex justify-between items-baseline text-sm"><span class="font-bold text-slate-700 truncate pr-2">' + esc(f.nombre) + '</span>' +
                 '<span class="font-black text-amber-700 flex-shrink-0">' + f.pts + ' pts</span></div>';
        }).join('') + '</div>';
      box.classList.remove('hidden');
    } catch (e) { /* los puntos son un extra: si falla, no se muestran */ }
  }

  /* ---------------------------------------------------------------- arranque */
  window.addEventListener('DOMContentLoaded', function () {
    renderComparativa();
    // Campo de oferta bloqueado: al tocarlo avisa en vez de quedar mudo
    var box = el('box-prod-oferta'), inp = el('prod-precio-anterior');
    if (box && inp) box.addEventListener('click', function () { if (inp.disabled) avisoPlan('ultra', 'Las ofertas con precio tachado'); });
  });

  Object.assign(window, {
    planDe: planDe, planPermite: planPermite, exigirPlan: exigirPlan,
    avisoPlan: avisoPlan, cerrarAvisoPlan: cerrarAvisoPlan, verPlanesDesdeAviso: verPlanesDesdeAviso,
    bloqueosFormComercio: bloqueosFormComercio, nvCargarMisPuntos: cargarMisPuntos,
    NV_LIMITE_PRODUCTOS: LIMITE_PRODUCTOS, NV_LIMITE_LINKS: LIMITE_LINKS
  });
})();
