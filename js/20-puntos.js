/* NecoVende - Sistema de puntos (solo comercios Ultra, saldo separado por comercio)
 *
 * Datos: tabla pv_puntos_mov (historial de movimientos; el saldo es la suma de los movimientos de
 * ESE comercio). Los puntos se suman cuando el cliente marca "Recibido" (lo hace la base, 07-puntos.sql).
 * Este archivo: barra fija "Mis puntos", historial, insignias "Suma X puntos", avisos a invitados,
 * campos del formulario de producto y canje de productos con puntos.
 */
(function () {
  'use strict';

  var PTS = { saldo: {}, reservado: {}, cargado: false, uid: null, reintentos: 0 };
  window.NV_CANJE_PEND = null;

  function el(id) { return document.getElementById(id); }
  function esc(t) {
    return String(t == null ? '' : t).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; });
  }
  function lista() { return (typeof comerciosGlobales !== 'undefined' && comerciosGlobales) || []; }
  function comercioPorId(id) { return lista().find(function (c) { return String(c.id) === String(id); }); }
  function esUltraC(c) {
    return Boolean(c) && (typeof planPermite === 'function' ? planPermite('puntos', c) : (c.plan === 'ultra'));
  }
  function nPuntos(n) { n = Number(n) || 0; return n + (n === 1 ? ' punto' : ' puntos'); }
  function sesion() { return (typeof usuarioActual !== 'undefined') ? usuarioActual : null; }

  /* ------------------------------------------------------------ saldo */
  async function cargarPuntos() {
    var u = sesion();
    if (!u) { PTS.saldo = {}; PTS.reservado = {}; PTS.cargado = false; PTS.uid = null; pintarBarra(); return; }
    try {
      var r = await _supabase.rpc('pv_mis_puntos');
      if (r.error) throw r.error;
      var s = {}, rs = {};
      (r.data || []).forEach(function (f) { s[f.comercio_id] = Number(f.saldo) || 0; rs[f.comercio_id] = Number(f.reservado) || 0; });
      PTS.saldo = s; PTS.reservado = rs; PTS.cargado = true; PTS.uid = u.id;
    } catch (e) { console.warn('No se pudieron cargar los puntos:', e && e.message); }
    pintarBarra();
    refrescarVistas();
  }

  // Comercios con puntos visibles: solo Ultra (si el plan venció, el saldo se conserva pero no se muestra)
  function saldosVisibles() {
    var out = [];
    Object.keys(PTS.saldo).forEach(function (id) {
      var c = comercioPorId(id);
      if (c && esUltraC(c)) out.push({ id: id, nombre: c.nombre || 'Comercio', pts: PTS.saldo[id], res: PTS.reservado[id] || 0 });
    });
    out.sort(function (a, b) { return b.pts - a.pts; });
    return out;
  }
  function saldoDe(comercioId) { return Number(PTS.saldo[comercioId]) || 0; }

  // Botonera inferior: el botón "Puntos" muestra el saldo (si hay uno solo) o cuántos comercios tienen puntos
  function pintarBarra() {
    var sub = el('nav-puntos-sub');
    var ls = sesion() ? saldosVisibles() : [];
    if (sesion() && !lista().length && PTS.reintentos < 15) { PTS.reintentos++; setTimeout(pintarBarra, 2000); }
    if (sub) {
      if (!ls.length) { sub.classList.add('hidden'); sub.textContent = ''; }
      else {
        sub.textContent = ls.length === 1 ? ls[0].pts + ' pts' : ls.length + ' comercios';
        sub.classList.remove('hidden');
      }
    }
    var lab = el('nav-cuenta-label');
    if (lab) lab.textContent = sesion() ? 'Cuenta' : 'Ingresar';
    if (typeof ubicarBotonPanel === 'function') ubicarBotonPanel();
  }

  function refrescarVistas() {
    try { nvResumenPuntosCarrito(); } catch (e) {}
    try { if (typeof comercioActivo !== 'undefined' && comercioActivo && comercioActivo.productos) nvAvisoPuntosComercio(comercioActivo.productos); } catch (e) {}
  }

  /* ------------------------------------------------------------ historial */
  var MOTIVOS = { pedido: 'Sumaste por el pedido', canje: 'Canjeaste en el pedido', canje_devuelto: 'Te devolvimos por cancelar el pedido' };
  function etiquetaMov(m) {
    if (m.motivo === 'canje' && m.estado === 'reservado') return 'Reservados para el pedido (se descuentan al marcar Recibido)';
    if (m.motivo === 'canje' && m.estado === 'devuelto') return 'Reserva del pedido cancelado';
    return MOTIVOS[m.motivo] || 'Movimiento';
  }

  async function abrirMisPuntos() {
    var box = el('mis-puntos-contenido');
    abrirModal('modal-mis-puntos');
    if (!sesion()) {
      box.innerHTML = '<p class="text-sm text-slate-600 leading-relaxed text-center">Los comercios Ultra te regalan puntos por tus compras para canjearlos por productos.</p>' + cajaInvitado('¿Querés sumar puntos? Registrate con Google');
      return;
    }
    box.innerHTML = '<p class="text-xs text-slate-400 text-center py-6">Cargando…</p>';
    try {
      await cargarPuntos();
      var r = await _supabase.from('pv_puntos_mov').select('id, comercio_id, pedido_id, puntos, motivo, estado, creado_en').order('creado_en', { ascending: false }).limit(300);
      if (r.error) r = await _supabase.from('pv_puntos_mov').select('id, comercio_id, pedido_id, puntos, motivo, creado_en').order('creado_en', { ascending: false }).limit(300);   // sin 08 todavía
      if (r.error) throw r.error;
      var movs = (r.data || []).filter(function (m) { return esUltraC(comercioPorId(m.comercio_id)); });
      var nums = {};
      var ids = movs.map(function (m) { return m.pedido_id; }).filter(Boolean);
      if (ids.length) {
        var rp = await _supabase.from('pv_pedidos').select('id, numero').in('id', ids);
        (rp.data || []).forEach(function (p) { nums[p.id] = p.numero; });
      }
      var porC = {};
      movs.forEach(function (m) { (porC[m.comercio_id] = porC[m.comercio_id] || []).push(m); });
      var ids2 = saldosVisibles();
      if (!ids2.length) { box.innerHTML = '<p class="text-sm text-slate-500 text-center py-6">Todavía no tenés puntos. Los sumás cuando marcás “Recibido” en pedidos de comercios que dan puntos.</p>'; return; }
      box.innerHTML = ids2.map(function (f) {
        var filas = (porC[f.id] || []).map(function (m) {
          var pos = m.puntos >= 0;
          var num = m.pedido_id && nums[m.pedido_id] ? ' #' + nums[m.pedido_id] : '';
          var f1 = new Date(m.creado_en).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: '2-digit' });
          return '<li class="flex justify-between items-center gap-3 py-2 text-xs"><span class="min-w-0"><span class="font-semibold text-slate-700">' +
                 esc(etiquetaMov(m) + num) +
                 '</span><br><span class="text-[10px] text-slate-400">' + f1 + '</span></span>' +
                 '<span class="font-black flex-shrink-0 ' + (pos ? 'text-emerald-600' : 'text-rose-500') + '">' + (pos ? '+' : '') + m.puntos + '</span></li>';
        }).join('');
        return '<div class="border border-slate-200 rounded-2xl overflow-hidden">' +
               '<div class="bg-slate-900 text-white px-4 py-3 flex justify-between items-center gap-3"><button type="button" onclick="nvIrAComercio(\'' + esc(f.id) + '\')" class="font-black text-sm text-left underline decoration-dotted underline-offset-4 min-w-0 truncate">' + esc(f.nombre) + ' ›</button>' +
               '<span class="font-black text-amber-300 text-sm flex-shrink-0">' + nPuntos(f.pts) + '</span></div>' +
               (f.res > 0 ? '<div class="bg-amber-50 text-amber-800 text-[11px] font-bold px-4 py-2">🔒 ' + nPuntos(f.res) + ' reservados en pedidos en curso. Tu saldo ya los descontó; se confirman al marcar “Recibido” y vuelven si se cancela.</div>' : '') +
               '<ul class="px-4 divide-y divide-slate-100">' + (filas || '<li class="py-3 text-xs text-slate-400">Sin movimientos.</li>') + '</ul></div>';
      }).join('');
    } catch (e) {
      box.innerHTML = '<p class="text-sm text-rose-600 text-center py-6">No pudimos cargar tus puntos. Probá de nuevo en un rato.</p>';
    }
  }

  /* ------------------------------------------------------------ formulario de producto */
  function nvAjustarCamposPuntos(plan, p) {
    var ok = typeof planPermite === 'function' ? planPermite('puntos', plan) : plan === 'ultra';
    var a = el('prod-puntos-suma'), b = el('prod-puntos-canje'), box = el('box-prod-puntos'), ay = el('prod-puntos-ayuda');
    if (!a || !b) return;
    a.value = ok && p && p.puntos_suma != null ? p.puntos_suma : '';
    b.value = ok && p && p.puntos_canje != null ? p.puntos_canje : '';
    a.disabled = b.disabled = !ok;
    if (box) {
      box.classList.toggle('opacity-60', !ok);
      box.onclick = ok ? null : function () { avisoPlan('ultra', 'El sistema de puntos'); };
    }
    if (ay) ay.innerText = ok
      ? 'Por unidad. Los puntos se suman cuando el cliente marca “Recibido”. Dejalo vacío si no aplica.'
      : '🔒 Disponible en el plan Ultra.';
  }

  function nvLeerCamposPuntos() {
    var a = el('prod-puntos-suma'), b = el('prod-puntos-canje');
    if (!a || !b || a.disabled) return { habilitado: false };
    function leer(inp, max, nombre) {
      var t = String(inp.value).trim();
      if (t === '') return { v: null };
      var n = Number(t);
      if (!Number.isInteger(n) || n < 0 || n > max) return { error: nombre + ': ingresá un número entero entre 0 y ' + max + '.' };
      return { v: n === 0 ? null : n };
    }
    var s = leer(a, 100000, 'Puntos que suma'); if (s.error) return { error: s.error };
    var c = leer(b, 1000000, 'Puntos para canjearlo'); if (c.error) return { error: c.error };
    return { habilitado: true, suma: s.v, canje: c.v };
  }

  /* ------------------------------------------------------------ insignias en tarjetas */
  function nvBadgesPuntos(p, c) {
    if (!p || !esUltraC(c || (typeof comercioActivo !== 'undefined' ? comercioActivo : null))) return '';
    var h = '';
    if (Number(p.puntos_suma) > 0) h += '<span class="text-[9px] font-black bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-md whitespace-nowrap">✨ Suma ' + nPuntos(p.puntos_suma) + '</span>';
    if (Number(p.puntos_canje) > 0) h += '<span class="text-[9px] font-black bg-violet-100 text-violet-700 px-1.5 py-0.5 rounded-md whitespace-nowrap">🎁 Canje ' + Number(p.puntos_canje) + ' pts</span>';
    return h;
  }

  function comercioSumaPuntos(productos, c) {
    return esUltraC(c) && (productos || []).some(function (p) { return Number(p.puntos_suma) > 0 || Number(p.puntos_canje) > 0; });
  }

  function cajaInvitado(texto) {
    return '<div class="bg-amber-50 border border-amber-200 rounded-2xl p-3.5 flex items-center justify-between gap-3">' +
           '<p class="text-xs font-bold text-amber-800 leading-snug">' + texto + '</p>' +
           '<button type="button" onclick="iniciarSesionGoogle()" class="flex-shrink-0 bg-white border border-amber-300 text-amber-800 font-black text-xs px-3.5 py-2 rounded-xl active:scale-95 transition">Registrarme con Google</button></div>';
  }

  // Banner arriba de los productos del comercio
  function nvAvisoPuntosComercio(productos) {
    var box = el('aviso-puntos-comercio'); if (!box) return;
    var c = (typeof comercioActivo !== 'undefined') ? comercioActivo : null;
    if (!c || !comercioSumaPuntos(productos, c)) { box.classList.add('hidden'); box.innerHTML = ''; return; }
    if (!sesion()) box.innerHTML = cajaInvitado('✨ ¿Querés sumar puntos? Registrate con Google');
    else box.innerHTML = '<div class="bg-amber-50 border border-amber-200 rounded-2xl p-3 text-xs font-bold text-amber-800">✨ Tenés <b>' + nPuntos(saldoDe(c.id)) + '</b> en ' + esc(c.nombre) + '</div>';
    box.classList.remove('hidden');
    box.classList.add('mb-3');
  }

  /* ------------------------------------------------------------ detalle del producto + canje */
  function nvDetalleProductoPuntos(p) {
    var box = el('view-prod-puntos');
    if (!box) return;
    var c = (typeof comercioActivo !== 'undefined') ? comercioActivo : null;
    box.classList.add('hidden'); box.innerHTML = '';
    if (!p || !esUltraC(c)) return;
    var suma = Number(p.puntos_suma) > 0, canje = Number(p.puntos_canje) > 0;
    if (!suma && !canje) return;
    var h = '<div class="flex flex-wrap gap-1.5">' + nvBadgesPuntos(p, c) + '</div>';
    if (!sesion()) h += cajaInvitado('¿Querés sumar puntos? Registrate con Google');
    if (canje) h += '<p class="text-[11px] font-semibold text-violet-700">🎁 Para canjearlo con puntos, tocá “Agregar al carrito” y elegí “Canjear”.</p>';
    box.innerHTML = h; box.classList.remove('hidden');
  }

  // Opción "Canjear" dentro del modal de opciones (el mismo que se abre al tocar Agregar / Elegir opciones)
  function nvPrepararCanjeModal(p) {
    var btn = el('btn-canjear-sabores'); if (!btn) return;
    var c = (typeof comercioActivo !== 'undefined') ? comercioActivo : null;
    btn.classList.add('hidden'); btn.onclick = null;
    if (!p || p.es_combo || !esUltraC(c) || !(Number(p.puntos_canje) > 0)) return;
    var costo = Number(p.puntos_canje), tiene = sesion() ? saldoDe(c.id) : 0;
    btn.innerText = !sesion() ? '🎁 Canjear por ' + costo + ' puntos (iniciá sesión)'
      : (tiene >= costo ? '🎁 Canjear por ' + costo + ' puntos (tenés ' + tiene + ')' : '🎁 Canje: ' + costo + ' puntos (tenés ' + tiene + ')');
    btn.classList.toggle('opacity-60', sesion() && tiene < costo);
    btn.classList.remove('hidden');
    btn.onclick = function () { nvCanjearDesdeModal(p); };
  }

  function nvCanjearDesdeModal(p) {
    var c = (typeof comercioActivo !== 'undefined') ? comercioActivo : null; if (!c || !p) return;
    if (!sesion()) { if (confirm('Para canjear puntos tenés que iniciar sesión con Google. ¿Querés hacerlo ahora?')) iniciarSesionGoogle(); return; }
    var costo = Number(p.puntos_canje) || 0;
    var cant = (typeof cantidadSeleccionadaModalSabores !== 'undefined' && cantidadSeleccionadaModalSabores > 0) ? cantidadSeleccionadaModalSabores : 1;
    var enCarrito = (typeof carrito !== 'undefined' ? carrito : []).filter(function (i) { return i.canje; })
      .reduce(function (s, i) { return s + (Number(i.puntosCosto) || 0) * i.cantidad; }, 0);
    var disponibles = saldoDe(c.id) - enCarrito;
    if (disponibles < costo * cant) {
      alert('No te alcanzan los puntos: ' + (cant > 1 ? cant + ' unidades cuestan ' : 'cuesta ') + nPuntos(costo * cant) + ' y tenés ' + nPuntos(Math.max(disponibles, 0)) + ' disponibles.');
      return;
    }
    window.NV_CANJE_PEND = String(p.id);
    confirmarAgregarConSabores();
    var ms = el('modal-sabores');
    if (ms && !ms.classList.contains('hidden')) window.NV_CANJE_PEND = null;   // no se agregó (faltaba elegir algo): se descarta el canje pendiente
  }

  function nvIrAComercio(id) {
    cerrarModal('modal-mis-puntos');
    if (typeof mostrarInicio === 'function' && typeof modoEstrictoEnlace !== 'undefined' && modoEstrictoEnlace) return;
    abrirVistaComercio(id);
    window.scrollTo(0, 0);
  }

  /* ------------------------------------------------------------ carrito */
  function puntosDelCarrito() {
    var suma = 0, canje = 0;
    var c = (typeof comercioCarrito !== 'undefined') ? comercioCarrito : null;
    (typeof carrito !== 'undefined' ? carrito : []).forEach(function (it) {
      if (it.canje) { canje += (Number(it.puntosCosto) || 0) * it.cantidad; return; }
      var p = c && (c.productos || []).find(function (x) { return String(x.id) === String(it.id); });
      if (p && Number(p.puntos_suma) > 0) suma += Number(p.puntos_suma) * it.cantidad;
    });
    return { suma: suma, canje: canje };
  }

  function nvResumenPuntosCarrito() {
    var box = el('cart-puntos'); if (!box) return;
    var c = (typeof comercioCarrito !== 'undefined') ? comercioCarrito : null;
    if (!c || !esUltraC(c) || !(carrito || []).length) { box.classList.add('hidden'); box.innerHTML = ''; return; }
    var t = puntosDelCarrito();
    var hay = t.suma > 0 || t.canje > 0 || comercioSumaPuntos(c.productos, c);
    if (!hay) { box.classList.add('hidden'); box.innerHTML = ''; return; }
    var h = '';
    if (t.suma > 0) h += '<p class="text-xs font-bold text-amber-800">✨ Este pedido suma <b>' + nPuntos(t.suma) + '</b> cuando marques “Recibido”.</p>';
    if (t.canje > 0) {
      var tiene = saldoDe(c.id), ok = tiene >= t.canje;
      h += '<p class="text-xs font-bold ' + (ok ? 'text-violet-700' : 'text-rose-600') + '">🎁 Canje: <b>' + nPuntos(t.canje) + '</b> de tus ' + tiene + ' disponibles' + (ok ? '. Quedan reservados al pedir y se descuentan al marcar “Recibido”; si cancelás, se devuelven.' : ' — no te alcanzan, sacá algún canje.') + '</p>';
    }
    if (!sesion() && (t.suma > 0 || comercioSumaPuntos(c.productos, c))) h += cajaInvitado('¿Querés sumar puntos? Registrate con Google');
    box.innerHTML = '<div class="bg-amber-50 border border-amber-200 rounded-2xl p-3 space-y-2">' + h + '</div>';
    box.classList.remove('hidden');
  }

  // Devuelve true si el carrito puede enviarse (los canjes necesitan sesión y saldo)
  function nvValidarCanjeCarrito() {
    var t = puntosDelCarrito();
    if (t.canje <= 0) return true;
    var c = comercioCarrito;
    if (!sesion()) { alert('Para canjear puntos tenés que iniciar sesión con Google.'); return false; }
    if (saldoDe(c.id) < t.canje) { alert('No te alcanzan los puntos para este canje. Tenés ' + nPuntos(saldoDe(c.id)) + ' y necesitás ' + nPuntos(t.canje) + '.'); return false; }
    return true;
  }

  /* ------------------------------------------------------------ arranque */
  window.addEventListener('DOMContentLoaded', function () {
    try {
      _supabase.auth.getSession().then(function (r) { if (r && r.data && r.data.session) setTimeout(cargarPuntos, 600); });
      _supabase.auth.onAuthStateChange(function (ev, s) { if (s && s.user) setTimeout(cargarPuntos, 400); else { PTS.saldo = {}; pintarBarra(); } });
    } catch (e) {}
    // Con el teclado abierto la botonera se esconde (si no, tapa lo que se escribe)
    document.addEventListener('focusin', function (e) { if (/^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName)) document.body.classList.add('teclado-abierto'); });
    document.addEventListener('focusout', function () { setTimeout(function () { var a = document.activeElement; if (!a || !/^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName)) document.body.classList.remove('teclado-abierto'); }, 150); });
    if (new URLSearchParams(location.search).get('menu')) document.body.classList.add('modo-menu');
    document.addEventListener('visibilitychange', function () { if (!document.hidden && sesion()) cargarPuntos(); });
  });

  Object.assign(window, {
    nvCargarPuntos: cargarPuntos, abrirMisPuntos: abrirMisPuntos,
    nvAjustarCamposPuntos: nvAjustarCamposPuntos, nvLeerCamposPuntos: nvLeerCamposPuntos,
    nvBadgesPuntos: nvBadgesPuntos, nvAvisoPuntosComercio: nvAvisoPuntosComercio,
    nvDetalleProductoPuntos: nvDetalleProductoPuntos, nvPrepararCanjeModal: nvPrepararCanjeModal,
    nvResumenPuntosCarrito: nvResumenPuntosCarrito, nvValidarCanjeCarrito: nvValidarCanjeCarrito,
    navCuenta: function () { if (sesion()) abrirPanelControl(); else iniciarSesionGoogle(); },
    nvIrAComercio: nvIrAComercio,
    nvSaldoPuntos: saldoDe
  });
})();
