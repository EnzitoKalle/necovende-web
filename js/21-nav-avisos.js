/* NecoVende - Avisos de la botonera inferior
 *  1) "Pedidos": puntito rojo con la cantidad de pedidos que cambiaron de estado y todavía no viste
 *     (ej: "en camino"), además de la notificación push.
 *  2) "Mi plan": muestra el plan que TENÉS y cuánto falta para que venza (no la lista de planes).
 */
(function () {
  'use strict';

  var LS_VISTO = 'nv_pedidos_visto_v1';   // {pedidoId: estado que ya viste}
  var LS_ULT = 'nv_pedidos_ultimo_v1';    // {pedidoId: último estado conocido}
  var FINALES = ['entregado', 'cancelado'];
  var SEGUNDOS = 60;
  var canal = null, uidCanal = null, ocupado = false;

  function el(id) { return document.getElementById(id); }
  function esc(t) { return String(t == null ? '' : t).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function leer(k) { try { var v = JSON.parse(localStorage.getItem(k)); return v && typeof v === 'object' ? v : {}; } catch (e) { return {}; } }
  function guardar(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* sin almacenamiento */ } }
  function sesion() { return (typeof usuarioActual !== 'undefined') ? usuarioActual : null; }

  /* ------------------------------------------------------------ pedidos: puntito rojo */
  function hayNovedad(id, estado) {
    var v = leer(LS_VISTO);
    return Object.prototype.hasOwnProperty.call(v, id) && v[id] !== estado;
  }
  function pintarPuntito() {
    var ult = leer(LS_ULT), vis = leer(LS_VISTO), n = 0;
    Object.keys(ult).forEach(function (id) { if (Object.prototype.hasOwnProperty.call(vis, id) && vis[id] !== ult[id]) n++; });
    var d = el('nav-pedidos-dot'); if (!d) return;
    d.textContent = n > 9 ? '9+' : String(n);
    d.classList.toggle('hidden', n === 0);
  }
  // El cliente abrió el pedido: ya vio su estado actual
  function pedidoVisto(id, estado) {
    var v = leer(LS_VISTO), u = leer(LS_ULT);
    v[id] = estado; u[id] = estado;
    guardar(LS_VISTO, v); guardar(LS_ULT, u);
    pintarPuntito();
  }
  // Estados vistos en una lista (Mis pedidos): se anotan; los que nunca se vieron quedan como "ya vistos"
  function registrarEstados(lista) {
    var v = leer(LS_VISTO), u = leer(LS_ULT);
    (lista || []).forEach(function (x) {
      u[x.id] = x.estado;
      if (!Object.prototype.hasOwnProperty.call(v, x.id)) v[x.id] = x.estado;
    });
    guardar(LS_VISTO, v); guardar(LS_ULT, u);
    pintarPuntito();
  }

  async function revisarPedidos() {
    if (ocupado || document.hidden) return;
    ocupado = true;
    try {
      var u = leer(LS_ULT), v = leer(LS_VISTO), cambios = {};
      var user = sesion();
      if (user) {
        var r = await _supabase.from('pv_pedidos').select('id, estado').eq('cliente_id', user.id).order('creado_en', { ascending: false }).limit(30);
        (r.data || []).forEach(function (x) { cambios[x.id] = x.estado; });
      }
      // Pedidos de este dispositivo (sin sesión): solo los que siguen abiertos
      var locales = [];
      try { locales = JSON.parse(localStorage.getItem('necovende_pedidos_v1')) || []; } catch (e) { locales = []; }
      var abiertos = locales.filter(function (x) { return x && x.token && !(x.id in cambios) && FINALES.indexOf(u[x.id]) < 0; }).slice(0, 6);
      await Promise.all(abiertos.map(function (x) {
        return _supabase.rpc('pv_ver_pedido', { p_token: x.token }).then(function (res) {
          if (res && res.data && res.data.pedido) cambios[res.data.pedido.id] = res.data.pedido.estado;
        }, function () { /* sin red: se reintenta */ });
      }));
      Object.keys(cambios).forEach(function (id) {
        u[id] = cambios[id];
        if (!Object.prototype.hasOwnProperty.call(v, id)) v[id] = cambios[id];   // primera vez que lo vemos: no es "novedad"
      });
      guardar(LS_ULT, u); guardar(LS_VISTO, v);
      pintarPuntito();
    } catch (e) { /* se reintenta en un minuto */ }
    ocupado = false;
  }

  function suscribirTiempoReal() {
    var user = sesion();
    try {
      if (canal && (!user || uidCanal !== user.id)) { _supabase.removeChannel(canal); canal = null; uidCanal = null; }
      if (!user || canal) return;
      uidCanal = user.id;
      canal = _supabase.channel('nv-mis-pedidos-' + user.id)
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'pv_pedidos', filter: 'cliente_id=eq.' + user.id }, function () { revisarPedidos(); })
        .subscribe();
    } catch (e) { /* queda el refresco cada minuto */ }
  }

  /* ------------------------------------------------------------ mi plan */
  var NOMBRE = { gratis: 'Gratis', pro: 'Pro', ultra: 'Ultra' };
  var ORDEN = { gratis: 1, pro: 2, ultra: 3 };

  function misComercios() {
    var u = sesion(); if (!u || typeof comerciosGlobales === 'undefined') return [];
    return comerciosGlobales.filter(function (c) { return c.user_id === u.id; });
  }
  function resumenPlan(c) {
    var plan = c.plan_original || c.plan || 'gratis';
    var info = (typeof infoVencimientoPlan === 'function') ? infoVencimientoPlan(c) : null;
    return { plan: plan, nombre: NOMBRE[plan] || plan, info: info, vencido: Boolean(info && info.vencido) };
  }
  // Texto corto para la botonera: "Ultra · 12 días" / "Pro · vence hoy" / "Gratis"
  function textoCorto(r) {
    if (r.plan === 'gratis') return 'Gratis';
    if (!r.info) return r.nombre;
    if (r.vencido) return 'Venció';
    var d = r.info.dias;
    return r.nombre + ' · ' + (d <= 1 ? (r.info.texto.indexOf('hoy') >= 0 ? 'hoy' : '1 día') : d + ' días');
  }
  function pintarPlan() {
    var sub = el('nav-plan-sub'), lab = el('nav-plan-label'); if (!sub || !lab) return;
    var cs = misComercios();
    if (!cs.length) { sub.classList.add('hidden'); lab.textContent = 'Planes'; return; }
    // El más urgente: primero los vencidos / por vencer, si no el plan más alto
    var rs = cs.map(function (c) { return { c: c, r: resumenPlan(c) }; });
    rs.sort(function (a, b) {
      var ua = a.r.info ? (a.r.vencido ? -1e6 : a.r.info.dias) : 1e9, ub = b.r.info ? (b.r.vencido ? -1e6 : b.r.info.dias) : 1e9;
      if (ua !== ub) return ua - ub;
      return (ORDEN[b.r.plan] || 0) - (ORDEN[a.r.plan] || 0);
    });
    lab.textContent = 'Mi plan';
    sub.textContent = textoCorto(rs[0].r);
    sub.classList.remove('hidden');
    sub.classList.toggle('nav-alerta', Boolean(rs[0].r.vencido || (rs[0].r.info && rs[0].r.info.dias <= 5)));
  }

  function abrirMiPlan() {
    var cs = misComercios();
    if (!cs.length) { abrirModal('modal-planes'); return; }
    var h = cs.map(function (c) {
      var r = resumenPlan(c), i = r.info;
      var linea, clase = 'bg-slate-50 border-slate-200 text-slate-600';
      if (r.plan === 'gratis') linea = 'Plan Gratis: sin vencimiento.';
      else if (!i) linea = c.activo === true ? 'Sin fecha de vencimiento cargada.' : 'Empieza a contar cuando se apruebe tu comercio.';
      else if (i.vencido) { linea = 'Venció el ' + i.fecha + '. Hoy tu comercio está en plan Gratis.'; clase = 'bg-rose-50 border-rose-200 text-rose-700'; }
      else {
        linea = (i.dias === 1 ? 'Te queda 1 día' : 'Te quedan ' + i.dias + ' días') + ' · vence el ' + i.fecha + '.';
        clase = i.dias <= 3 ? 'bg-rose-50 border-rose-200 text-rose-700' : (i.dias <= 7 ? 'bg-amber-50 border-amber-200 text-amber-700' : 'bg-emerald-50 border-emerald-200 text-emerald-700');
      }
      var renovar = r.plan !== 'gratis' && i && (i.vencido || i.dias <= 7);
      return '<div class="border border-slate-200 rounded-2xl p-4 space-y-2.5">' +
             '<div class="flex justify-between items-center gap-2"><p class="text-sm font-black text-slate-900 truncate">' + esc(c.nombre) + '</p>' +
             '<span class="text-xs font-black px-2.5 py-1 rounded-full bg-amber-100 text-amber-700 flex-shrink-0">' + esc(r.nombre) + '</span></div>' +
             '<p class="text-xs font-bold px-3 py-2 rounded-xl border ' + clase + '">' + esc(linea) + '</p>' +
             (renovar ? '<button type="button" onclick="solicitarPlanWhatsApp(\'' + esc(r.nombre) + '\')" class="w-full bg-brand-500 text-white font-black text-xs py-3 rounded-xl active:scale-95 transition">Renovar plan ' + esc(r.nombre) + '</button>' : '') +
             (r.plan === 'gratis' ? '<button type="button" onclick="solicitarPlanWhatsApp(\'Pro\')" class="w-full bg-brand-500 text-white font-black text-xs py-3 rounded-xl active:scale-95 transition">Quiero mejorar mi plan</button>' : '') +
             '</div>';
    }).join('');
    el('mi-plan-contenido').innerHTML = h;
    abrirModal('modal-mi-plan');
  }

  /* ------------------------------------------------------------ arranque */
  window.addEventListener('DOMContentLoaded', function () {
    setTimeout(function () { pintarPuntito(); revisarPedidos(); suscribirTiempoReal(); pintarPlan(); }, 1500);
    setInterval(function () { revisarPedidos(); suscribirTiempoReal(); }, SEGUNDOS * 1000);
    setInterval(pintarPlan, 5000);   // los comercios cargan después del inicio
    document.addEventListener('visibilitychange', function () { if (!document.hidden) { revisarPedidos(); pintarPlan(); } });
    window.addEventListener('focus', function () { revisarPedidos(); });
    try { _supabase.auth.onAuthStateChange(function () { setTimeout(function () { revisarPedidos(); suscribirTiempoReal(); pintarPlan(); }, 500); }); } catch (e) { /* ok */ }
  });

  Object.assign(window, {
    nvPedidoVisto: pedidoVisto, nvRegistrarEstados: registrarEstados, nvHayNovedad: hayNovedad,
    nvRevisarPedidos: revisarPedidos, abrirMiPlan: abrirMiPlan
  });
})();
