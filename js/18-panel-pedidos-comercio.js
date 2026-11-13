/* NecoVende - Panel de pedidos del comercio
 *
 * Botón fijo abajo ("Pedidos") con contador de nuevos + panel a pantalla completa en el celular.
 * Todo cambio pasa por las funciones de la base (04-pedidos.sql):
 *   pv_comercio_aceptar · pv_comercio_fijar_envio · pv_comercio_despachar
 *   pv_comercio_cancelar · pv_comercio_marcar_pago
 * En vivo: Supabase Realtime sobre pv_pedidos (+ refresco cada 30 s por si se corta la conexión).
 * Lectura: columnas por nombre (04b-pedidos-token.sql ya no permite select * en pv_pedidos).
 */
(function () {
  'use strict';

  var COLUMNAS = 'id, numero, comercio_id, cliente_id, cliente_nombre, cliente_telefono, tipo_entrega, direccion, direccion_notas, ' +
    'medio_pago, nota, subtotal, envio_modo, costo_envio, total, estado, motivo_cancelacion, cancelado_por, cierre_automatico, ' +
    'puntos_otorgados, creado_en, actualizado_en, pago_recibido_en, comprobante_path, comprobante_en';
  var COLUMNAS_AVISO = COLUMNAS + ', pago_avisado_en, pago_titular, comprobante_pedido_en';   // la columna nueva existe una vez corrido 10-pago-avisado.sql
  var NUEVOS = ['esperando_confirmacion', 'esperando_total_comercio'];
  var EN_CURSO = ['esperando_confirmar_cliente', 'preparando', 'en_camino', 'listo_retirar'];
  var TERMINADOS = ['entregado', 'cancelado'];
  var PAGO_TRANSF = ['transferencia', 'qr', 'cuenta_dni'];
  var MEDIO_TXT = { efectivo: 'Efectivo', transferencia: 'Transferencia', qr: 'MercadoPago / QR', cuenta_dni: 'Cuenta DNI', tarjeta: 'Tarjeta', a_convenir: 'A convenir' };
  var CLASES = {
    amber: 'bg-amber-50 text-amber-800 border-amber-300', brand: 'bg-orange-50 text-orange-800 border-orange-300',
    sky: 'bg-sky-50 text-sky-800 border-sky-300', emerald: 'bg-emerald-50 text-emerald-800 border-emerald-300',
    rose: 'bg-rose-50 text-rose-800 border-rose-300', slate: 'bg-slate-100 text-slate-700 border-slate-300'
  };
  var ESTADOS = {
    esperando_confirmacion:      { t: 'Para confirmar', k: 'amber', d: 'Un cliente espera que aceptes su pedido.' },
    esperando_total_comercio:    { t: 'Falta el envío', k: 'amber', d: 'Cargá el costo del envío para que el cliente confirme el total.' },
    esperando_confirmar_cliente: { t: 'Cliente confirma total', k: 'brand', d: 'Esperando que el cliente acepte el total con envío.' },
    preparando:                  { t: 'Preparando', k: 'sky', d: 'Cuando esté listo, avisale al cliente.' },
    en_camino:                   { t: 'En camino', k: 'sky', d: 'Esperando que el cliente lo marque como recibido (si no, se cierra solo a las 24 hs).' },
    listo_retirar:               { t: 'Listo para retirar', k: 'emerald', d: 'Esperando que el cliente lo marque como recibido (si no, se cierra solo a las 24 hs).' },
    entregado:                   { t: 'Entregado', k: 'emerald', d: '' },
    cancelado:                   { t: 'Cancelado', k: 'rose', d: '' }
  };

  var P = {
    comercios: [],            // [{id, nombre}] del usuario
    pedidos: [],              // cache (más nuevos primero)
    comercioSel: 'todos',
    tab: 'nuevos',
    detalleId: null,
    detalle: null,            // { items, historial }
    canal: null, timer: null, deb: null, ocupado: false, uid: null, cargado: false
  };

  /* ------------------------------------------------------------ utilidades */
  function el(id) { return document.getElementById(id); }
  function icono() { if (window.lucide) { try { lucide.createIcons(); } catch (e) { /* ok */ } } }
  function fmtFecha(iso) {
    try { return new Date(iso).toLocaleString('es-AR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }); } catch (e) { return ''; }
  }
  function hace(iso) {
    var m = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 60000));
    if (m < 1) return 'recién'; if (m < 60) return 'hace ' + m + ' min';
    var h = Math.floor(m / 60); if (h < 24) return 'hace ' + h + ' h';
    return 'hace ' + Math.floor(h / 24) + ' d';
  }
  function digitos(t) { return String(t || '').replace(/\D/g, ''); }
  function waCliente(tel) {            // número local de Argentina → formato internacional de WhatsApp
    var d = digitos(tel).replace(/^0+/, '');
    if (d.indexOf('54') === 0) return d;
    if (d.length >= 10) return '549' + d.replace(/^(\d{2,4})15/, '$1');
    return d;
  }
  function msgError(e) {
    var m = e && e.message ? String(e.message) : '';
    if (!m || /fetch|network|failed|load failed/i.test(m)) return 'No pudimos conectar. Revisá tu internet e intentá de nuevo.';
    return m;
  }
  function mios(x) { return P.comercios.some(function (c) { return c.id === x.comercio_id; }); }
  // Enlace a NecoEnvíos con las direcciones ya cargadas: retiro = la del comercio, entrega = la que puso el cliente
  function enlaceRepartidor(x) {
    var c = P.comercios.find(function (k) { return k.id === x.comercio_id; }) || {};
    var q = new URLSearchParams({
      retiro: c.direccion || '', entrega: x.direccion || '',
      nombre: c.nombre || '', whatsapp: c.whatsapp || '', comercio: c.nombre || ''
    });
    return 'https://neco-envios.vercel.app/?' + q.toString();
  }
  function nombreComercio(id) { var c = P.comercios.find(function (x) { return x.id === id; }); return c ? c.nombre : ''; }
  function cuentaNuevos() { return P.pedidos.filter(function (x) { return NUEVOS.indexOf(x.estado) >= 0; }).length + (window.NV_RES_PEND || 0); }

  /* ------------------------------------------------------------ botón fijo y contador */
  function pintarBoton() {
    var b = el('btn-panel-pedidos'); if (!b) return;
    var n = cuentaNuevos(), badge = el('panel-pedidos-badge');
    // El botón flotante aparece solo si el usuario tiene comercio Y hay algo para responder.
    // El resto del tiempo se entra desde el Panel de Control ("Pedidos y reservas de mi comercio").
    b.classList.toggle('hidden', P.comercios.length === 0 || n === 0);
    if (badge) { badge.innerText = n > 99 ? '99+' : String(n); badge.classList.toggle('hidden', n === 0); }
    b.classList.toggle('animate-pulse', n > 0);
    var pb = el('panel-btn-pedidos-comercio'), pbb = el('panel-btn-pedidos-badge');
    if (pb) pb.classList.toggle('hidden', P.comercios.length === 0);
    if (pbb) { pbb.innerText = n > 99 ? '99+' : String(n); pbb.classList.toggle('hidden', n === 0); }
  }
  function ubicarBoton() {             // no tapar la barra del carrito
    var b = el('btn-panel-pedidos'), c = el('barra-flotante-carrito'); if (!b) return;
    var base = c && !c.classList.contains('hidden') ? 6.5 : 1.25;
    b.style.bottom = 'calc(' + (base + 3.6) + 'rem + env(safe-area-inset-bottom))';   // sube sobre la botonera inferior
  }

  /* ------------------------------------------------------------ carga de datos */
  async function cargarComercios(user) {
    if (!user) { P.comercios = []; P.pedidos = []; P.uid = null; P.cargado = false; detener(); pintarBoton(); return; }
    if (P.uid === user.id && P.cargado) return;
    P.uid = user.id;
    try {
      var r = await _supabase.from('comercios').select('id, nombre, direccion, telefono_whatsapp').eq('user_id', user.id);
      P.comercios = (r.data || []).map(function (c) { return { id: c.id, nombre: c.nombre, direccion: c.direccion || '', whatsapp: c.telefono_whatsapp || '' }; });
    } catch (e) { P.comercios = []; }
    P.cargado = true;
    pintarBoton();
    if (P.comercios.length) { await cargarPedidos(); iniciar(); }
  }

  async function cargarPedidos() {
    if (!P.comercios.length) return;
    try {
      try { await _supabase.rpc('pv_refrescar'); } catch (e) { /* opcional */ }
      var ids = P.comercios.map(function (c) { return c.id; });
      var r = await _supabase.from('pv_pedidos').select(COLUMNAS_AVISO).in('comercio_id', ids).order('creado_en', { ascending: false }).limit(150);
      if (r.error) r = await _supabase.from('pv_pedidos').select(COLUMNAS).in('comercio_id', ids).order('creado_en', { ascending: false }).limit(150);   // sin el SQL 10 todavía
      if (r.error) throw r.error;
      var antes = {}; P.pedidos.forEach(function (x) { antes[x.id] = true; });
      var nuevos = (r.data || []).filter(function (x) { return !antes[x.id] && NUEVOS.indexOf(x.estado) >= 0; });
      P.pedidos = r.data || [];
      if (P.avisar && nuevos.length) avisarNuevo(nuevos[0], nuevos.length);
      P.avisar = true;
    } catch (e) { console.error('panel pedidos', e); }
    try { if (window.nvResCargarPend) await nvResCargarPend(P.comercios); } catch (e) { console.warn('reservas', e); }
    pintarBoton();
    if (panelAbierto()) { renderPanel(); if (P.detalleId) refrescarDetalle(true); }
  }

  function avisarNuevo(x, n) {
    try { if (navigator.vibrate) navigator.vibrate([200, 100, 200]); } catch (e) { /* ok */ }
    mostrarToast(n > 1 ? 'Tenés ' + n + ' pedidos nuevos' : 'Pedido nuevo #' + x.numero + ' de ' + x.cliente_nombre);
  }

  function pedirDebounced() { clearTimeout(P.deb); P.deb = setTimeout(cargarPedidos, 400); }

  function iniciar() {
    if (P.canal) return;
    try {
      P.canal = _supabase.channel('pv-panel-' + P.uid)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'pv_pedidos' }, function (pl) {
          var f = pl.new && pl.new.comercio_id ? pl.new : (pl.old || {});
          if (f.comercio_id && !mios(f)) return;
          pedirDebounced();
        })
        .subscribe();
    } catch (e) { console.error('realtime', e); }
    clearInterval(P.timer);
    P.timer = setInterval(function () { if (!document.hidden) cargarPedidos(); }, 30000);
  }
  function detener() {
    try { if (P.canal) _supabase.removeChannel(P.canal); } catch (e) { /* ok */ }
    P.canal = null; clearInterval(P.timer); P.timer = null;
  }

  /* ------------------------------------------------------------ panel (lista) */
  function panelAbierto() { var m = el('modal-panel-pedidos'); return m && !m.classList.contains('hidden'); }

  function abrirPanelPedidos(pedidoId) {
    if (!P.comercios.length) { mostrarToast('Tu cuenta no tiene un comercio.'); return; }
    abrirModal('modal-panel-pedidos');
    P.detalleId = null; P.detalle = null;
    renderPanel();
    cargarPedidos().then(function () { if (pedidoId) abrirDetallePedido(pedidoId); });
  }
  function cerrarPanelPedidos() { cerrarModal('modal-panel-pedidos'); P.detalleId = null; P.detalle = null; }

  function lista() {
    return P.pedidos.filter(function (x) {
      if (P.comercioSel !== 'todos' && x.comercio_id !== P.comercioSel) return false;
      var g = P.tab === 'nuevos' ? NUEVOS : (P.tab === 'curso' ? EN_CURSO : TERMINADOS);
      return g.indexOf(x.estado) >= 0;
    });
  }
  function contar(g) {
    return P.pedidos.filter(function (x) { return (P.comercioSel === 'todos' || x.comercio_id === P.comercioSel) && g.indexOf(x.estado) >= 0; }).length;
  }

  function renderPanel() {
    var cont = el('panel-pedidos-contenido'); if (!cont) return;
    if (P.detalleId) { renderDetalle(); return; }
    var h = '';
    if (P.comercios.length > 1) {
      h += '<select onchange="panelPedidosComercio(this.value)" class="w-full clean-input px-3.5 py-3 rounded-xl text-sm font-bold"><option value="todos">Todos mis comercios</option>' +
           P.comercios.map(function (c) { return '<option value="' + esc(c.id) + '"' + (P.comercioSel === c.id ? ' selected' : '') + '>' + esc(c.nombre) + '</option>'; }).join('') + '</select>';
    }
    var hayRes = window.nvResHayReservas && nvResHayReservas(P.comercios.map(function (c) { return c.id; }));
    var tabs = [['nuevos', 'Nuevos', contar(NUEVOS)], ['curso', 'En curso', contar(EN_CURSO)], ['fin', 'Terminados', contar(TERMINADOS)]];
    if (hayRes) tabs.push(['reservas', 'Reservas', window.NV_RES_PEND || 0]);
    h += '<div class="grid ' + (hayRes ? 'grid-cols-4' : 'grid-cols-3') + ' gap-1.5 bg-slate-100 p-1 rounded-2xl">' + tabs.map(function (t) {
      var on = P.tab === t[0];
      return '<button type="button" onclick="panelPedidosTab(\'' + t[0] + '\')" class="py-3 rounded-xl text-xs font-black transition active:scale-95 ' +
             (on ? 'bg-white text-slate-900 shadow' : 'text-slate-500') + '">' + t[1] +
             (t[2] ? ' <span class="ml-0.5 inline-block min-w-[18px] px-1 rounded-full text-[10px] ' + ((t[0] === 'nuevos' || t[0] === 'reservas') && t[2] ? 'bg-rose-500 text-white' : 'bg-slate-300 text-slate-700') + '">' + t[2] + '</span>' : '') + '</button>';
    }).join('') + '</div>';

    if (P.tab === 'reservas' && hayRes) {
      h += '<div id="panel-reservas-box"></div>';
      cont.innerHTML = h;
      nvResPanelRender('panel-reservas-box', P.comercioSel);
      el('panel-pedidos-titulo').innerText = 'Pedidos';
      el('panel-pedidos-volver').classList.add('hidden');
      icono();
      return;
    }

    var ls = lista();
    if (!ls.length) {
      h += '<p class="text-sm text-slate-400 text-center py-12 font-semibold">' + (P.tab === 'nuevos' ? 'No hay pedidos nuevos.' : (P.tab === 'curso' ? 'No hay pedidos en curso.' : 'Todavía no hay pedidos terminados.')) + '</p>';
    }
    ls.forEach(function (x) {
      var e = ESTADOS[x.estado] || { t: x.estado, k: 'slate' };
      var urgente = NUEVOS.indexOf(x.estado) >= 0;
      h += '<button type="button" onclick="abrirDetallePedido(\'' + x.id + '\')" class="w-full text-left border-2 rounded-2xl p-4 space-y-2 transition active:scale-[.99] ' +
           (urgente ? 'border-amber-300 bg-amber-50/60' : 'border-slate-200 bg-white') + '">' +
           '<div class="flex justify-between items-start gap-2"><div class="min-w-0"><p class="text-base font-black text-slate-900 truncate">#' + x.numero + ' · ' + esc(x.cliente_nombre) + '</p>' +
           '<p class="text-xs text-slate-500">' + (x.tipo_entrega === 'envio' ? 'Envío' : 'Retiro') + ' · ' + esc(MEDIO_TXT[x.medio_pago] || x.medio_pago) + ' · ' + hace(x.creado_en) +
           (P.comercios.length > 1 ? ' · ' + esc(nombreComercio(x.comercio_id)) : '') + '</p></div>' +
           '<span class="text-base font-black text-brand-600 flex-shrink-0">' + (x.total != null ? fmtPrecio(x.total) : fmtPrecio(x.subtotal) + '+') + '</span></div>' +
           '<div class="flex items-center gap-2 flex-wrap"><span class="inline-flex text-xs font-black px-3 py-1.5 rounded-full border ' + CLASES[e.k] + '">' + esc(e.t) + '</span>' +
           (PAGO_TRANSF.indexOf(x.medio_pago) >= 0 && x.estado !== 'cancelado' ? (x.pago_recibido_en ? '<span class="text-xs font-bold text-emerald-700">✓ Pago recibido</span>' : (x.comprobante_path ? '<span class="text-xs font-bold text-sky-700">📎 Con comprobante</span>' : (x.pago_avisado_en ? '<span class="text-xs font-black text-amber-700">💬 Dice que ya pagó</span>' : '<span class="text-xs font-bold text-slate-400">Pago pendiente</span>'))) : '') +
           '</div></button>';
    });
    cont.innerHTML = h;
    el('panel-pedidos-titulo').innerText = 'Pedidos';
    el('panel-pedidos-volver').classList.add('hidden');
    icono();
  }
  function panelPedidosTab(t) { P.tab = t; renderPanel(); }
  function panelPedidosComercio(v) { P.comercioSel = v; renderPanel(); }

  /* ------------------------------------------------------------ detalle */
  async function abrirDetallePedido(id) {
    P.detalleId = id; P.detalle = null;
    if (!panelAbierto()) abrirModal('modal-panel-pedidos');
    if (!P.pedidos.some(function (x) { return x.id === id; })) await cargarPedidos();
    renderDetalle();
    refrescarDetalle(false);
  }
  function volverALista() { P.detalleId = null; P.detalle = null; renderPanel(); }

  async function refrescarDetalle(silencioso) {
    var id = P.detalleId; if (!id) return;
    try {
      var cols = 'titulo, cantidad, precio_unitario, subtotal, nota, talle, color, sabores';
      var a = await _supabase.from('pv_pedido_items').select(cols + ', canje, puntos_costo').eq('pedido_id', id).order('id');
      if (a.error) a = await _supabase.from('pv_pedido_items').select(cols).eq('pedido_id', id).order('id');   // todavía sin 07-puntos.sql
      var b = await _supabase.from('pv_pedido_historial').select('estado_nuevo, actor, nota, creado_en').eq('pedido_id', id).order('id');
      if (id !== P.detalleId) return;
      var nuevo = { items: a.data || [], historial: b.data || [] };
      var igual = P.detalle && JSON.stringify(P.detalle) === JSON.stringify(nuevo);
      P.detalle = nuevo;
      if (!(silencioso && igual)) renderDetalle();
    } catch (e) { /* se muestra lo que haya */ }
  }

  function renderDetalle() {
    var x = P.pedidos.find(function (p) { return p.id === P.detalleId; });
    var cont = el('panel-pedidos-contenido');
    if (!x) { cont.innerHTML = '<p class="text-sm text-slate-500 text-center py-12 font-semibold">No encontramos este pedido.</p>'; el('panel-pedidos-volver').classList.remove('hidden'); return; }
    var e = ESTADOS[x.estado] || { t: x.estado, k: 'slate', d: '' };
    var det = P.detalle || { items: [], historial: [] };
    var BIG = 'w-full font-black py-4 rounded-2xl text-base active:scale-[.98] transition ';
    var h = '';
    el('panel-pedidos-titulo').innerText = 'Pedido #' + x.numero;
    el('panel-pedidos-volver').classList.remove('hidden');

    var info = e.d;
    if (x.estado === 'cancelado') info = 'Cancelado por ' + (x.cancelado_por === 'comercio' ? 'el comercio' : (x.cancelado_por === 'cliente' ? 'el cliente' : 'el sistema')) + (x.motivo_cancelacion ? '. Motivo: ' + x.motivo_cancelacion : '.');
    if (x.estado === 'entregado') info = x.cierre_automatico ? 'Se cerró solo a las 24 hs.' : 'El cliente lo marcó como recibido.' + (x.puntos_otorgados > 0 ? ' Sumó ' + x.puntos_otorgados + ' puntos.' : '');
    h += '<div class="rounded-2xl border-2 p-4 ' + CLASES[e.k] + '"><p class="text-base font-black">' + esc(e.t) + '</p>' + (info ? '<p class="text-sm mt-1 leading-snug">' + esc(info) + '</p>' : '') + '</div>';

    // ----- Acciones principales
    if (x.estado === 'esperando_confirmacion') {
      h += '<button type="button" onclick="panelAceptar()" class="' + BIG + 'bg-gradient-to-r from-emerald-500 to-emerald-600 text-white shadow-lg shadow-emerald-500/25">✓ Aceptar pedido</button>';
    }
    if (x.estado === 'esperando_total_comercio' || x.estado === 'esperando_confirmar_cliente') {
      h += '<div class="border-2 border-orange-200 bg-orange-50/60 rounded-2xl p-4 space-y-3">' +
           '<p class="text-sm font-black text-orange-800">' + (x.estado === 'esperando_total_comercio' ? 'Costo del envío' : 'Corregir costo del envío') + '</p>' +
           '<p class="text-xs text-orange-700 leading-snug">Productos: ' + fmtPrecio(x.subtotal) + '. Cargá solo el envío; el cliente va a ver y confirmar el total.</p>' +
           '<div class="flex items-center gap-2"><span class="text-xl font-black text-slate-500">$</span>' +
           '<input id="panel-envio" type="number" inputmode="decimal" min="0" step="1" value="' + (x.costo_envio != null ? x.costo_envio : '') + '" placeholder="0" class="flex-1 clean-input px-4 py-3.5 rounded-xl text-xl font-black" oninput="panelEnvioPreview()"></div>' +
           '<p id="panel-envio-total" class="text-sm font-bold text-slate-600"></p>' +
           '<button type="button" onclick="panelFijarEnvio()" class="' + BIG + 'bg-gradient-to-r from-orange-500 to-amber-500 text-white shadow-lg shadow-orange-500/25">' + (x.estado === 'esperando_total_comercio' ? 'Enviar total al cliente' : 'Actualizar costo de envío') + '</button></div>';
    }
    if (x.estado === 'preparando') {
      h += '<button type="button" onclick="panelDespachar()" class="' + BIG + 'bg-gradient-to-r from-sky-500 to-sky-600 text-white shadow-lg shadow-sky-500/25">' +
           (x.tipo_entrega === 'envio' ? '🛵 Marcar “En camino”' : '🏪 Marcar “Listo para retirar”') + '</button>';
    }
    if (x.tipo_entrega === 'envio' && x.estado !== 'cancelado' && x.estado !== 'entregado') {
      h += '<a href="' + esc(enlaceRepartidor(x)) + '" target="_blank" rel="noopener" class="' + BIG + 'bg-gradient-to-r from-violet-500 to-violet-600 text-white shadow-lg shadow-violet-500/25 block text-center">🛵 Solicitar repartidor YA</a>' +
           '<p class="text-[11px] text-slate-500 text-center -mt-1.5">Te lleva a NecoEnvíos con el retiro (tu local) y la entrega (' + esc(x.direccion || 'dirección del cliente') + ') ya cargados.</p>';
    }
    if (PAGO_TRANSF.indexOf(x.medio_pago) >= 0 && x.estado !== 'cancelado') {
      if (x.pago_recibido_en) {
        h += '<p class="text-sm font-black text-emerald-700 bg-emerald-50 border-2 border-emerald-200 rounded-2xl p-3.5 text-center">✓ Pago recibido</p>';
      } else {
        h += '<div class="border-2 border-emerald-200 bg-emerald-50/60 rounded-2xl p-4 space-y-3"><p class="text-sm font-black text-emerald-800">Pago por ' + esc(MEDIO_TXT[x.medio_pago]) + '</p>' +
             (x.pago_avisado_en ? '<p class="text-sm font-black text-amber-800 bg-amber-100 border border-amber-300 rounded-xl p-3">💬 Dice que ya transfirió ' + (x.total != null ? fmtPrecio(x.total) : '') + ' a nombre de <u>' + esc(x.pago_titular || 'sin nombre') + '</u> (' + esc(hace(x.pago_avisado_en)) + '). Revisá tus movimientos y confirmá.</p>' : '') +
             (x.comprobante_pedido_en && !x.comprobante_path ? '<p class="text-xs font-bold text-rose-700 bg-rose-50 border border-rose-200 rounded-xl p-3">📎 Le pediste el comprobante al cliente (' + esc(hace(x.comprobante_pedido_en)) + '). Cuando lo suba lo vas a ver acá.</p>' : '') +
             (x.comprobante_path ? '<button type="button" onclick="panelVerComprobante()" class="' + BIG + 'bg-white border-2 border-sky-300 text-sky-700">📎 Ver comprobante</button>' : '') +
             '<button type="button" onclick="panelMarcarPago()" class="' + BIG + 'bg-emerald-600 text-white">Marcar “Pago recibido”</button>' +
             '<button type="button" onclick="panelPedirComprobante()" class="' + BIG + 'bg-white border-2 border-rose-300 text-rose-700">No llegó el pago · pedir comprobante</button></div>';
      }
    }

    // ----- Cliente
    var wa = waCliente(x.cliente_telefono);
    h += '<div class="border-2 border-slate-200 rounded-2xl p-4 space-y-2.5"><p class="text-xs font-black text-slate-500 uppercase tracking-wider">Cliente</p>' +
         '<p class="text-base font-black text-slate-900">' + esc(x.cliente_nombre) + '</p>' +
         '<p class="text-sm text-slate-600">' + esc(x.cliente_telefono) + '</p>' +
         '<div class="grid grid-cols-2 gap-2"><a href="https://wa.me/' + wa + '" target="_blank" rel="noopener" class="text-center py-3.5 rounded-xl bg-emerald-50 border-2 border-emerald-200 text-emerald-700 font-black text-sm active:scale-95 transition">WhatsApp</a>' +
         '<a href="tel:+' + wa + '" class="text-center py-3.5 rounded-xl bg-slate-50 border-2 border-slate-200 text-slate-700 font-black text-sm active:scale-95 transition">Llamar</a></div>' +
         '<p class="text-sm text-slate-700 pt-1">' + (x.tipo_entrega === 'envio' ? '<b>Envío a:</b> ' + esc(x.direccion || '') + (x.direccion_notas ? ' (' + esc(x.direccion_notas) + ')' : '') : '<b>Retira en el local</b>') + '</p>' +
         (x.nota ? '<p class="text-sm text-slate-700 bg-amber-50 border border-amber-200 rounded-xl p-3"><b>Aclaración:</b> ' + esc(x.nota) + '</p>' : '') + '</div>';

    // ----- Productos y total
    h += '<div class="border-2 border-slate-200 rounded-2xl p-4 space-y-3"><p class="text-xs font-black text-slate-500 uppercase tracking-wider">Productos</p>';
    if (!P.detalle) h += '<p class="text-xs text-slate-400">Cargando…</p>';
    det.items.forEach(function (it) {
      var extra = [it.sabores, it.nota ? '📝 ' + it.nota : ''].filter(Boolean).join(' · ');
      h += '<div class="flex justify-between gap-3"><div class="min-w-0"><p class="text-sm font-black text-slate-800 leading-tight">' + it.cantidad + 'x ' + esc(it.titulo) + '</p>' +
           (extra ? '<p class="text-xs text-slate-500 leading-snug break-words">' + esc(extra) + '</p>' : '') + '</div><span class="text-sm font-bold flex-shrink-0 ' + (it.canje ? 'text-violet-600' : 'text-slate-700') + '">' + (it.canje ? '🎁 ' + (it.puntos_costo * it.cantidad) + ' pts' : fmtPrecio(it.subtotal)) + '</span></div>';
    });
    h += '<div class="border-t border-slate-100 pt-3 space-y-1.5 text-sm font-semibold text-slate-600">' +
         '<div class="flex justify-between"><span>Productos</span><span>' + fmtPrecio(x.subtotal) + '</span></div>' +
         (x.envio_modo === 'retiro' ? '' : '<div class="flex justify-between"><span>Envío</span><span>' + (x.envio_modo === 'gratis' ? 'Gratis' : (x.costo_envio != null ? fmtPrecio(x.costo_envio) : 'A confirmar')) + '</span></div>') +
         '<div class="flex justify-between text-lg font-black text-slate-900"><span>Total</span><span>' + (x.total != null ? fmtPrecio(x.total) : 'A confirmar') + '</span></div></div></div>';

    // ----- Cancelar
    if (TERMINADOS.indexOf(x.estado) < 0) {
      h += '<div><button id="panel-btn-cancelar" type="button" onclick="panelAbrirCancelar()" class="' + BIG + 'bg-rose-50 border-2 border-rose-200 text-rose-600">Cancelar pedido</button>' +
           '<div id="panel-cancel-box" class="hidden mt-2 border-2 border-rose-200 rounded-2xl p-4 space-y-3 bg-rose-50/50">' +
           '<label for="panel-motivo" class="block text-sm font-black text-slate-700">Motivo de la cancelación <span class="font-normal text-slate-400">(se lo mostramos al cliente)</span></label>' +
           '<input id="panel-motivo" type="text" maxlength="200" placeholder="Ej: nos quedamos sin stock" class="w-full clean-input px-4 py-3.5 rounded-xl text-sm font-semibold">' +
           '<div class="grid grid-cols-2 gap-2"><button type="button" onclick="panelConfirmarCancelar()" class="py-4 rounded-2xl bg-rose-600 text-white font-black text-sm active:scale-95 transition">Sí, cancelar</button>' +
           '<button type="button" onclick="panelCerrarCancelar()" class="py-4 rounded-2xl bg-white border-2 border-slate-300 text-slate-700 font-black text-sm active:scale-95 transition">Volver</button></div></div></div>';
    }

    // ----- Historial
    if (det.historial.length) {
      h += '<div class="space-y-2"><p class="text-xs font-black text-slate-500 uppercase tracking-wider">Historial</p><ol class="space-y-2 border-l-2 border-slate-200 ml-1.5 pl-3.5">';
      det.historial.forEach(function (z) {
        var ee = ESTADOS[z.estado_nuevo] || { t: z.estado_nuevo };
        h += '<li class="text-sm"><span class="font-bold text-slate-700">' + esc(ee.t) + '</span> <span class="text-slate-400 text-xs">· ' + esc(fmtFecha(z.creado_en)) + '</span>' +
             (z.nota ? '<p class="text-xs text-slate-500">' + esc(z.nota) + '</p>' : '') + '</li>';
      });
      h += '</ol></div>';
    }
    h += '<p class="text-[11px] text-slate-400 text-center pb-2">Pedido hecho el ' + esc(fmtFecha(x.creado_en)) + (P.comercios.length > 1 ? ' · ' + esc(nombreComercio(x.comercio_id)) : '') + '</p>';

    // No pisar lo que se está escribiendo si llega un refresco en vivo
    var escribiendo = document.activeElement && /^panel-(envio|motivo)$/.test(document.activeElement.id || '');
    if (escribiendo && P.renderizadoId === x.id + '|' + x.estado + '|' + x.actualizado_en) return;
    var envioVal = el('panel-envio') && el('panel-envio').value, motivoVal = el('panel-motivo') && el('panel-motivo').value;
    var cancelAbierto = el('panel-cancel-box') && !el('panel-cancel-box').classList.contains('hidden');
    cont.innerHTML = h;
    P.renderizadoId = x.id + '|' + x.estado + '|' + x.actualizado_en;
    if (envioVal != null && el('panel-envio') && envioVal !== '' && escribiendo) el('panel-envio').value = envioVal;
    if (cancelAbierto) { panelAbrirCancelar(true); if (el('panel-motivo')) el('panel-motivo').value = motivoVal || ''; }
    panelEnvioPreview();
    icono();
  }

  /* ------------------------------------------------------------ acciones */
  function actual() { return P.pedidos.find(function (p) { return p.id === P.detalleId; }); }

  async function accion(fn, args, ok) {
    if (P.ocupado) return false;
    P.ocupado = true;
    var btns = document.querySelectorAll('#panel-pedidos-contenido button'); btns.forEach(function (b) { b.disabled = true; b.classList.add('opacity-60'); });
    try {
      var r = await _supabase.rpc(fn, args);
      if (r.error) throw r.error;
      if (ok) mostrarToast(ok);
      P.ocupado = false;
      await cargarPedidos(); await refrescarDetalle(false);
      return true;
    } catch (e) {
      P.ocupado = false;
      alert(msgError(e));
      await cargarPedidos();
      return false;
    }
  }

  function panelAceptar() { var x = actual(); if (x) accion('pv_comercio_aceptar', { p_pedido: x.id }, 'Pedido aceptado.'); }
  function panelDespachar() {
    var x = actual(); if (!x) return;
    accion('pv_comercio_despachar', { p_pedido: x.id }, x.tipo_entrega === 'envio' ? 'Marcado “En camino”.' : 'Marcado “Listo para retirar”.');
  }
  function panelPedirComprobante() {
    var x = actual(); if (!x) return;
    if (!confirm('Le avisamos al cliente que no encontraste su pago y le pedimos que suba el comprobante. ¿Seguimos?')) return;
    accion('pv_comercio_pedir_comprobante', { p_pedido: x.id }, 'Le pedimos el comprobante al cliente.');
  }
  function panelMarcarPago() { var x = actual(); if (x) accion('pv_comercio_marcar_pago', { p_pedido: x.id }, 'Pago registrado.'); }
  function panelEnvioPreview() {
    var x = actual(), i = el('panel-envio'), t = el('panel-envio-total'); if (!x || !i || !t) return;
    var v = parseFloat(i.value);
    t.innerText = isFinite(v) && v >= 0 ? 'Total para el cliente: ' + fmtPrecio(Number(x.subtotal) + v) : '';
  }
  function panelFijarEnvio() {
    var x = actual(), i = el('panel-envio'); if (!x || !i) return;
    var v = parseFloat(i.value);
    if (!isFinite(v) || v < 0 || i.value === '') { alert('Escribí el costo del envío (si es gratis, poné 0).'); i.focus(); return; }
    if (!confirm('¿Cargar envío de ' + fmtPrecio(v) + '? El cliente va a ver un total de ' + fmtPrecio(Number(x.subtotal) + v) + '.')) return;
    accion('pv_comercio_fijar_envio', { p_pedido: x.id, p_costo: v }, 'Total enviado al cliente.');
  }
  function panelAbrirCancelar(sinFoco) {
    var b = el('panel-cancel-box'), btn = el('panel-btn-cancelar'); if (!b) return;
    b.classList.remove('hidden'); if (btn) btn.classList.add('hidden');
    if (!sinFoco) { b.scrollIntoView({ block: 'center', behavior: 'smooth' }); var i = el('panel-motivo'); if (i) i.focus(); }
  }
  function panelCerrarCancelar() {
    var b = el('panel-cancel-box'), btn = el('panel-btn-cancelar');
    if (b) b.classList.add('hidden'); if (btn) btn.classList.remove('hidden');
  }
  function panelConfirmarCancelar() {
    var x = actual(); if (!x) return;
    var m = (el('panel-motivo').value || '').trim();
    if (m.length < 3) { alert('Escribí el motivo de la cancelación.'); el('panel-motivo').focus(); return; }
    accion('pv_comercio_cancelar', { p_pedido: x.id, p_motivo: m }, 'Pedido cancelado.');
  }
  async function panelVerComprobante() {
    var x = actual(); if (!x || !x.comprobante_path) return;
    var w = window.open('', '_blank');             // se abre antes para que el navegador no lo bloquee
    try {
      var r = await _supabase.storage.from('pv-comprobantes').createSignedUrl(x.comprobante_path, 300);
      if (r.error || !r.data) throw (r.error || new Error('Sin acceso'));
      if (w) w.location.href = r.data.signedUrl; else window.location.href = r.data.signedUrl;
    } catch (e) { if (w) w.close(); alert('No pudimos abrir el comprobante. ' + msgError(e)); }
  }

  /* ------------------------------------------------------------ arranque */
  window.addEventListener('DOMContentLoaded', function () {
    _supabase.auth.getSession().then(function (r) { cargarComercios(r.data.session && r.data.session.user); });
    _supabase.auth.onAuthStateChange(function (ev, s) { cargarComercios(s && s.user); });
    var c = el('barra-flotante-carrito');
    if (c && window.MutationObserver) new MutationObserver(ubicarBoton).observe(c, { attributes: true, attributeFilter: ['class'] });
    ubicarBoton();
  });
  document.addEventListener('visibilitychange', function () { if (!document.hidden && P.comercios.length) cargarPedidos(); });

  Object.assign(window, {
    abrirPanelPedidos: abrirPanelPedidos, cerrarPanelPedidos: cerrarPanelPedidos, abrirDetallePedido: abrirDetallePedido,
    ubicarBotonPanel: ubicarBoton, panelPedidosTab: panelPedidosTab, panelPedidosComercio: panelPedidosComercio, panelVolver: volverALista,
    panelAceptar: panelAceptar, panelDespachar: panelDespachar, panelMarcarPago: panelMarcarPago, panelPedirComprobante: panelPedirComprobante,
    panelFijarEnvio: panelFijarEnvio, panelEnvioPreview: panelEnvioPreview, panelAbrirCancelar: panelAbrirCancelar,
    panelRefrescar: cargarPedidos, panelCerrarCancelar: panelCerrarCancelar, panelConfirmarCancelar: panelConfirmarCancelar, panelVerComprobante: panelVerComprobante
  });
})();
