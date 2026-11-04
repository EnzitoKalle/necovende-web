/* NecoVende - Pedidos (lado cliente)
 *
 * Todo el pedido pasa por funciones de la base (archivo SQL 04-pedidos.sql):
 *   pv_crear_pedido · pv_ver_pedido · pv_refrescar · pv_cliente_responder_total
 *   pv_cliente_cancelar · pv_cliente_recibido · pv_cliente_comprobante
 * El precio lo calcula el servidor: acá solo se manda qué producto y cuántos.
 *
 * Qué hace este archivo:
 *   - enviarPedido()        botón "Hacer pedido" del carrito
 *   - abrirPedido(token)    seguimiento de un pedido (por link o desde "Mis pedidos")
 *   - abrirMisPedidos()     lista de pedidos (con sesión: todos; sin sesión: los de este dispositivo)
 *   - links ?pedido_token=<uuid> (invitado) y ?pedido=<id> (avisos push)
 */
(function () {
  'use strict';

  var LS_PEDIDOS = 'necovende_pedidos_v1';   // pedidos hechos en este dispositivo (con el token del link)
  var LS_CLIENTE = 'necovende_cliente_v1';   // nombre y teléfono para no escribirlos cada vez
  var UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  var SEGUNDOS_REFRESCO = 15;
  var MINUTOS_DEMORA = 15;

  var MEDIO_COD = {
    'Efectivo': 'efectivo', 'Transferencia': 'transferencia', 'MercadoPago / QR': 'qr',
    'Cuenta DNI': 'cuenta_dni', 'Tarjeta Débito/Crédito': 'tarjeta', 'A convenir': 'a_convenir'
  };
  var MEDIO_TXT = {
    efectivo: 'Efectivo', transferencia: 'Transferencia', qr: 'MercadoPago / QR',
    cuenta_dni: 'Cuenta DNI', tarjeta: 'Tarjeta Débito / Crédito', a_convenir: 'A convenir con el comercio'
  };
  var PAGO_CON_COMPROBANTE = ['transferencia', 'qr', 'cuenta_dni'];

  var CLASES = {
    amber: 'bg-amber-50 text-amber-800 border-amber-200',
    brand: 'bg-orange-50 text-orange-800 border-orange-200',
    sky: 'bg-sky-50 text-sky-800 border-sky-200',
    emerald: 'bg-emerald-50 text-emerald-800 border-emerald-200',
    rose: 'bg-rose-50 text-rose-800 border-rose-200',
    slate: 'bg-slate-100 text-slate-700 border-slate-200'
  };
  // t = título completo · c = corto (listas) · d = explicación · i = ícono · k = color
  var ESTADOS = {
    esperando_confirmacion:      { t: 'Esperando confirmación del comercio', c: 'Esperando al comercio', i: 'clock', k: 'amber',
                                   d: 'El comercio tiene que aceptar tu pedido.' },
    esperando_total_comercio:    { t: 'Esperando que el comercio confirme el total', c: 'Esperando al comercio', i: 'clock', k: 'amber',
                                   d: 'El comercio te va a pasar el costo del envío para que confirmes el total.' },
    esperando_confirmar_cliente: { t: 'Esperando que confirmes el total', c: 'Confirmá el total', i: 'receipt', k: 'brand',
                                   d: 'Revisá el total con el envío y confirmalo para que lo empiecen a preparar.' },
    preparando:                  { t: 'Preparando tu pedido', c: 'Preparando', i: 'chef-hat', k: 'sky',
                                   d: 'El comercio ya lo confirmó y lo está preparando.' },
    en_camino:                   { t: 'En camino', c: 'En camino', i: 'truck', k: 'sky',
                                   d: 'Cuando lo recibas, marcalo como recibido.' },
    listo_retirar:               { t: 'Listo para retirar', c: 'Listo para retirar', i: 'store', k: 'emerald',
                                   d: 'Ya podés pasar a buscarlo. Cuando lo tengas, marcalo como recibido.' },
    entregado:                   { t: 'Entregado', c: 'Entregado', i: 'check-circle-2', k: 'emerald', d: '' },
    cancelado:                   { t: 'Cancelado', c: 'Cancelado', i: 'x-circle', k: 'rose', d: '' }
  };
  var PUEDE_CANCELAR = ['esperando_confirmacion', 'esperando_total_comercio', 'esperando_confirmar_cliente', 'preparando'];
  var ESPERANDO_COMERCIO = ['esperando_confirmacion', 'esperando_total_comercio'];
  var NECESITA_RESPUESTA = ['esperando_confirmar_cliente', 'en_camino', 'listo_retirar'];

  var PED = { token: null, data: null, sig: '', timer: null, nuevo: false, ocupado: false };
  var enviando = false;

  /* ---------------------------------------------------------------- utilidades */
  function leerJSON(clave, defecto) {
    try { var v = JSON.parse(localStorage.getItem(clave)); return v == null ? defecto : v; } catch (e) { return defecto; }
  }
  function guardarJSON(clave, valor) {
    try { localStorage.setItem(clave, JSON.stringify(valor)); } catch (e) { /* sin almacenamiento: no pasa nada */ }
  }
  function pedidosLocales() { var l = leerJSON(LS_PEDIDOS, []); return Array.isArray(l) ? l : []; }
  function guardarPedidoLocal(p) {
    var l = pedidosLocales().filter(function (x) { return x.id !== p.id; });
    l.unshift(p);
    guardarJSON(LS_PEDIDOS, l.slice(0, 30));
  }
  function entradaLocal(id) {
    return pedidosLocales().find(function (x) { return x.id === id; }) || null;
  }
  function el(id) { return document.getElementById(id); }
  function icono() { if (window.lucide) { try { lucide.createIcons(); } catch (e) { /* ok */ } } }
  function digitos(t) { return String(t || '').replace(/\D/g, ''); }
  function fmtFecha(iso) {
    try {
      return new Date(iso).toLocaleString('es-AR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
    } catch (e) { return ''; }
  }
  function minutosDesde(iso) { return Math.floor((Date.now() - new Date(iso).getTime()) / 60000); }
  function mensajeError(e, porDefecto) {
    var m = e && e.message ? String(e.message) : '';
    if (!m || /fetch|network|failed|load failed/i.test(m)) return porDefecto || 'No pudimos conectar. Revisá tu internet e intentá de nuevo.';
    if (e.code === 'PGRST202' || /could not find the function/i.test(m)) return 'Los pedidos todavía no están activados. Probá de nuevo en un rato.';
    return m;
  }
  async function rpc(nombre, args) {
    var r = await _supabase.rpc(nombre, args);
    if (r.error) throw r.error;
    return r.data;
  }
  function esUltra(comercioId) {
    var lista = (typeof comerciosGlobales !== 'undefined' && comerciosGlobales) || [];
    var c = lista.find(function (x) { return String(x.id) === String(comercioId); });
    if (!c || (c.plan || 'gratis') !== 'ultra') return false;
    if (c.plan_vence && new Date(c.plan_vence) < new Date()) return false;
    return true;
  }
  function linkSeguimiento(token) { return location.origin + '/?pedido_token=' + token; }

  /* ---------------------------------------------------------------- crear pedido */
  function armarItems() {
    return carrito.map(function (it) {
      var prod = (comercioCarrito.productos || []).find(function (p) { return String(p.id) === String(it.id); });
      var sabores = '';
      // Las opciones (talle, sabores, cocción, packs) viajan escritas en el título del carrito: "Producto - [Talle: M] ..."
      if (prod && String(it.titulo).indexOf(prod.titulo + ' - ') === 0) sabores = String(it.titulo).slice(prod.titulo.length + 3).replace(/ \(Canje\)$/, '');
      var o = {
        id: String(it.id), cant: it.cantidad, talle: it.talle || '',
        nota: it.nota || '', sabores: sabores.slice(0, 400)
      };
      if (it.canje) o.canje = true;
      if (it.eleccion) o.eleccion = it.eleccion.map(function (e) { return { prodId: e.prodId, talle: e.talle || '', color: e.color || '' }; });
      if (it.comboTalles) { o.comboTalles = it.comboTalles; o.comboBase = it.comboBase || it.cantidad; }
      return o;
    });
  }

  function reflejarStockLocal(necesidades) {
    necesidades.forEach(function (n) {
      var prod = (comercioCarrito.productos || []).find(function (p) { return String(p.id) === String(n.id); });
      if (!prod) return;
      if (n.talle && prod.stock_talles && Object.prototype.hasOwnProperty.call(prod.stock_talles, n.talle)) {
        prod.stock_talles[n.talle] = Math.max(0, (parseInt(prod.stock_talles[n.talle]) || 0) - n.cant);
      }
      if (prod.stock !== null && prod.stock !== undefined) prod.stock = Math.max(0, parseInt(prod.stock) - n.cant);
    });
  }

  function botonEnviar(ocupado) {
    var b = el('btn-enviar-pedido'); if (!b) return;
    b.disabled = ocupado;
    b.classList.toggle('opacity-60', ocupado);
    var t = el('btn-enviar-pedido-txt'); if (t) t.innerText = ocupado ? 'Enviando pedido…' : 'Hacer pedido';
  }

  async function enviarPedido() {
    if (enviando || !carrito.length || !comercioCarrito) return;

    var medioTxt = el('cart-medio-pago').value;
    var nombre = el('cart-input-nombre-retira').value.trim();
    var telefono = (el('cart-input-telefono').value || '').trim();
    var permiteEnvios = Boolean(comercioCarrito.hace_envios || comercioCarrito.envio_gratis);
    var tipo = permiteEnvios ? el('cart-tipo-entrega').value : 'retiro';
    var direccion = tipo === 'envio' ? el('cart-input-direccion').value.trim() : '';

    if (!nombre) { alert('Por favor, ingresá el nombre correspondiente.'); el('cart-input-nombre-retira').focus(); return; }
    var nd = digitos(telefono).length;
    if (nd < 8 || nd > 15) { alert('Ingresá un teléfono válido, con código de área (ej: 2262 123456).'); el('cart-input-telefono').focus(); return; }
    if (tipo === 'envio' && !direccion) { alert('Por favor, ingresá tu dirección para poder realizar el envío.'); el('cart-input-direccion').focus(); return; }
    var subtotal = totalCarritoActual();
    var minimo = Number(comercioCarrito.pedido_minimo) || 0;
    if (minimo > 0 && subtotal < minimo) {
      alert('El pedido mínimo de este comercio es ' + fmtPrecio(minimo) + '. Te faltan ' + fmtPrecio(minimo - subtotal) + '.');
      return;
    }

    if (window.nvValidarCanjeCarrito && !nvValidarCanjeCarrito()) return;

    enviando = true; botonEnviar(true);
    try {
      var necesidades = calcularNecesidadesStock();   // antes de vaciar el carrito (para reflejar el stock en pantalla)
      var res = await rpc('pv_crear_pedido', {
        p_comercio: String(comercioCarrito.id),
        p_items: armarItems(),
        p_nombre: nombre,
        p_telefono: telefono,
        p_tipo_entrega: tipo,
        p_direccion: tipo === 'envio' ? direccion : null,
        p_direccion_notas: null,
        p_medio_pago: MEDIO_COD[medioTxt] || 'efectivo',
        p_nota: (el('cart-nota-general').value || '').trim().slice(0, 200) || null
      });

      if (!res || res.ok !== true) {
        if (res && res.error === 'stock') { avisarFaltantesStock(res.faltantes || []); return; }
        alert((res && res.error) || 'No se pudo enviar el pedido. Revisá tu carrito e intentá de nuevo.');
        return;
      }

      // Guardado en este dispositivo (sirve para ver el pedido sin sesión y para "Mis pedidos")
      guardarPedidoLocal({
        id: res.id, token: res.token, numero: res.numero, comercio: comercioCarrito.nombre,
        total: res.total, creado: new Date().toISOString(), sesion: Boolean(usuarioActual)
      });
      guardarJSON(LS_CLIENTE, { nombre: nombre, telefono: telefono });
      try {
        guardarPedidoEnHistorial({
          comercioId: comercioCarrito.id, comercioNombre: comercioCarrito.nombre,
          items: carrito.map(function (i) { return { id: i.id, titulo: i.titulo, precio: i.precio, cantidad: i.cantidad }; }),
          total: subtotal,
          fecha: new Date().toLocaleDateString() + ' ' + new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        });
      } catch (e) { /* el historial de "repetir pedido" es opcional */ }

      reflejarStockLocal(necesidades);
      el('cart-nota-general').value = '';
      carrito = []; comercioCarrito = null;
      actualizarCarrito();
      cerrarModal('modal-carrito');
      try { refrescarProductosPorStock(); } catch (e) { /* ok */ }
      abrirPedido(res.token, { nuevo: true });
      if (window.nvCargarPuntos && usuarioActual) nvCargarPuntos();   // un canje descuenta puntos
    } catch (e) {
      console.error('pv_crear_pedido', e);
      alert(mensajeError(e, 'No pudimos enviar el pedido. Revisá tu internet e intentá de nuevo.'));
    } finally {
      enviando = false; botonEnviar(false);
    }
  }

  /* ---------------------------------------------------------------- seguimiento */
  function tituloPedido(t, sub) {
    var a = el('ped-titulo'), b = el('ped-sub');
    if (a) a.innerText = t; if (b) b.innerText = sub || '';
  }

  async function abrirPedido(token, opciones) {
    if (!token || !UUID.test(String(token))) { mostrarToast('El link del pedido no es válido.'); return; }
    PED.token = String(token).toLowerCase(); PED.data = null; PED.sig = '';
    PED.nuevo = Boolean(opciones && opciones.nuevo);
    tituloPedido('Tu pedido', '');
    el('pedido-contenido').innerHTML = '<p class="text-xs text-slate-400 text-center py-10 font-semibold">Cargando tu pedido…</p>';
    abrirModal('modal-pedido');
    await cargarPedido(false);
    clearInterval(PED.timer);
    PED.timer = setInterval(function () {
      if (document.hidden || el('modal-pedido').classList.contains('hidden')) return;
      cargarPedido(true);
    }, SEGUNDOS_REFRESCO * 1000);
  }

  function cerrarPedido() {
    clearInterval(PED.timer); PED.timer = null; PED.token = null; PED.nuevo = false;
    cerrarModal('modal-pedido');
    var lista = el('modal-mis-pedidos');
    if (lista && !lista.classList.contains('hidden')) cargarMisPedidos();
  }

  async function cargarPedido(silencioso) {
    if (!PED.token || PED.ocupado) return;
    var token = PED.token;
    try {
      try { await _supabase.rpc('pv_refrescar'); } catch (e) { /* el mantenimiento es opcional */ }
      var d = await rpc('pv_ver_pedido', { p_token: token });
      if (token !== PED.token) return;
      if (!d || !d.pedido) {
        tituloPedido('Pedido no encontrado', '');
        el('pedido-contenido').innerHTML = '<p class="text-xs text-slate-500 text-center py-10 font-semibold">No encontramos este pedido. Revisá que el link esté completo.</p>';
        return;
      }
      var p = d.pedido;
      var sig = [p.actualizado_en, p.estado, p.comprobante_path, p.pago_recibido_en,
                 ESPERANDO_COMERCIO.indexOf(p.estado) >= 0 && minutosDesde(p.creado_en) >= MINUTOS_DEMORA ? 'demora' : ''].join('|');
      PED.data = d;
      if (silencioso && sig === PED.sig) return;     // nada cambió: no se redibuja (así no se pierde lo que está escribiendo)
      PED.sig = sig;
      renderPedido(d);
    } catch (e) {
      if (!silencioso) {
        el('pedido-contenido').innerHTML = '<p class="text-xs text-rose-600 text-center py-10 font-bold">' + esc(mensajeError(e)) + '</p>';
      }
    }
  }

  function fila(etiqueta, valor, fuerte) {
    return '<div class="flex justify-between items-baseline text-xs ' + (fuerte ? 'font-black text-slate-900 text-sm' : 'font-semibold text-slate-600') + '">' +
           '<span>' + etiqueta + '</span><span>' + valor + '</span></div>';
  }

  function renderPedido(d) {
    var p = d.pedido, c = d.comercio || {}, items = d.items || [], hist = d.historial || [];
    var e = ESTADOS[p.estado] || { t: p.estado, c: p.estado, i: 'package', k: 'slate', d: '' };
    var abierto = p.estado !== 'entregado' && p.estado !== 'cancelado';
    var h = '';

    tituloPedido('Pedido #' + p.numero, c.nombre || '');

    if (PED.nuevo) {
      h += '<div class="bg-emerald-50 border border-emerald-200 rounded-2xl p-3.5 text-xs text-emerald-800 space-y-1">' +
           '<p class="font-black text-sm flex items-center gap-1.5"><i data-lucide="party-popper" class="w-4 h-4"></i> ¡Pedido enviado!</p>' +
           '<p class="leading-snug">Te avisamos acá cada vez que el comercio avance. ' +
           (usuarioActual ? 'Lo vas a encontrar siempre en <b>Mis pedidos</b>.' :
             'Guardá este link para seguirlo (también queda en <b>Mis pedidos</b> en este dispositivo).') + '</p></div>';
    }

    // Estado actual
    var detalleEstado = e.d;
    if (p.estado === 'cancelado') {
      var quien = p.cancelado_por === 'comercio' ? 'el comercio' : (p.cancelado_por === 'cliente' ? 'vos' : 'el sistema');
      detalleEstado = 'Lo canceló ' + quien + '.' + (p.motivo_cancelacion ? ' Motivo: ' + p.motivo_cancelacion : '');
    } else if (p.estado === 'entregado') {
      if (p.cierre_automatico) detalleEstado = 'Se cerró solo: pasaron 24 hs sin que lo marques como recibido (sin puntos).';
      else if (p.puntos_otorgados > 0) detalleEstado = '¡Sumaste ' + p.puntos_otorgados + ' puntos con este pedido!';
      else detalleEstado = '¡Que lo disfrutes!';
    }
    h += '<div class="rounded-2xl border p-3.5 ' + CLASES[e.k] + '">' +
         '<p class="text-sm font-black flex items-center gap-1.5"><i data-lucide="' + e.i + '" class="w-4 h-4"></i> ' + esc(e.t) + '</p>' +
         (detalleEstado ? '<p class="text-xs mt-1 leading-snug">' + esc(detalleEstado) + '</p>' : '') + '</div>';

    // Aviso de demora (15 min sin respuesta del comercio)
    var minEspera = Math.max(minutosDesde(p.creado_en), d.minutos_sin_respuesta || 0);
    if (ESPERANDO_COMERCIO.indexOf(p.estado) >= 0 && minEspera >= MINUTOS_DEMORA) {
      h += '<div class="bg-amber-50 border border-amber-300 rounded-2xl p-3.5 text-xs text-amber-800 space-y-2">' +
           '<p class="font-black flex items-center gap-1.5"><i data-lucide="bell-ring" class="w-4 h-4"></i> El comercio todavía no respondió</p>' +
           '<p class="leading-snug">Pasaron más de ' + MINUTOS_DEMORA + ' minutos. Podés seguir esperando o cancelar el pedido.</p>' +
           '<div class="flex gap-2 flex-wrap">' +
           '<button type="button" onclick="pedidoAbrirCancelar()" class="text-xs font-black px-3.5 py-2 rounded-xl bg-white border border-rose-300 text-rose-700 active:scale-95 transition">Cancelar pedido</button>' +
           (c.telefono_whatsapp ? '<button type="button" onclick="pedidoWhatsApp()" class="text-xs font-black px-3.5 py-2 rounded-xl bg-white border border-emerald-300 text-emerald-700 active:scale-95 transition">Escribirle por WhatsApp</button>' : '') +
           '</div></div>';
    }

    // El cliente confirma el total con envío
    if (p.estado === 'esperando_confirmar_cliente') {
      h += '<div class="bg-orange-50 border border-orange-200 rounded-2xl p-3.5 space-y-3">' +
           '<p class="text-xs font-black text-orange-800">El comercio cargó el costo del envío</p>' +
           fila('Productos', fmtPrecio(p.subtotal)) + fila('Envío', fmtPrecio(p.costo_envio)) + fila('Total a pagar', fmtPrecio(p.total), true) +
           '<div class="grid grid-cols-2 gap-2">' +
           '<button type="button" onclick="pedidoResponderTotal(true)" class="bg-gradient-to-r from-emerald-500 to-emerald-600 text-white font-black py-3 rounded-xl text-xs shadow active:scale-95 transition">Confirmar total</button>' +
           '<button type="button" onclick="pedidoResponderTotal(false)" class="bg-white border border-rose-300 text-rose-700 font-black py-3 rounded-xl text-xs active:scale-95 transition">No lo acepto</button>' +
           '</div></div>';
    }

    // Marcar recibido
    if (p.estado === 'en_camino' || p.estado === 'listo_retirar') {
      h += '<div class="space-y-2">' +
           '<button id="ped-btn-recibido" type="button" onclick="pedidoRecibidoClick()" class="w-full bg-gradient-to-r from-emerald-500 to-emerald-600 text-white font-black py-3.5 rounded-2xl text-sm shadow-lg shadow-emerald-500/25 active:scale-95 transition flex items-center justify-center gap-2">' +
           '<i data-lucide="package-check" class="w-4 h-4"></i> Ya lo recibí</button>' +
           '<div id="ped-puntos-box" class="hidden bg-amber-50 border border-amber-200 rounded-2xl p-3.5 space-y-2.5">' +
           '<p class="text-xs font-black text-amber-800 flex items-center gap-1.5"><i data-lucide="sparkles" class="w-4 h-4"></i> ¿Querés sumar ' + (PED.data && PED.data.puntos_a_sumar) + ' puntos por este pedido?</p>' +
           '<div class="grid grid-cols-2 gap-2">' +
           '<button type="button" onclick="pedidoRecibido(true)" class="bg-amber-500 text-white font-black py-2.5 rounded-xl text-xs active:scale-95 transition">Sí, sumar puntos</button>' +
           '<button type="button" onclick="pedidoRecibido(false)" class="bg-white border border-slate-300 text-slate-700 font-black py-2.5 rounded-xl text-xs active:scale-95 transition">No, gracias</button>' +
           '</div></div></div>';
    }

    // Pago por transferencia: alias y comprobante opcional
    var conComprobante = PAGO_CON_COMPROBANTE.indexOf(p.medio_pago) >= 0;
    if (conComprobante && abierto) {
      h += '<div class="bg-emerald-50 border border-emerald-200 rounded-2xl p-3.5 text-xs space-y-2">';
      if (p.pago_recibido_en) {
        h += '<p class="font-black text-emerald-800 flex items-center gap-1.5"><i data-lucide="badge-check" class="w-4 h-4"></i> El comercio confirmó que recibió tu pago</p>';
      } else {
        if (c.alias) {
          h += '<div class="flex justify-between items-center gap-2"><span class="font-black text-emerald-800">Alias para pagar' + (c.titular_alias ? ' · ' + esc(c.titular_alias) : '') + '</span>' +
               '<button type="button" onclick="pedidoCopiarAlias()" class="bg-emerald-600 text-white text-[10px] font-bold px-2.5 py-1 rounded-lg flex items-center gap-1 flex-shrink-0"><i data-lucide="copy" class="w-3 h-3"></i> Copiar</button></div>' +
               '<p class="font-mono font-bold text-emerald-900 text-sm select-all break-all">' + esc(c.alias) + '</p>';
        }
        if (p.comprobante_path) {
          h += '<p class="font-bold text-emerald-700 flex items-center gap-1.5"><i data-lucide="check" class="w-4 h-4"></i> Comprobante enviado. El comercio lo va a revisar.</p>';
        } else {
          h += '<p class="text-emerald-700 leading-snug">Si ya pagaste, podés adjuntar el comprobante <span class="font-semibold">(es opcional)</span>.</p>';
        }
        h += '<label class="block"><span class="inline-flex items-center gap-1.5 bg-white border border-emerald-300 text-emerald-700 font-black text-xs px-3.5 py-2.5 rounded-xl cursor-pointer active:scale-95 transition">' +
             '<i data-lucide="paperclip" class="w-3.5 h-3.5"></i> ' + (p.comprobante_path ? 'Cambiar comprobante' : 'Adjuntar comprobante') + '</span>' +
             '<input type="file" accept="image/jpeg,image/png,image/webp,application/pdf" class="hidden" onchange="pedidoSubirComprobante(this)"></label>';
      }
      h += '</div>';
    }

    // Detalle del pedido
    h += '<div class="border border-slate-200 rounded-2xl p-3.5 space-y-2.5">' +
         '<p class="text-[11px] font-black text-slate-500 uppercase tracking-wider">Tu pedido</p>';
    items.forEach(function (it) {
      var extra = [it.sabores, it.nota ? '📝 ' + it.nota : ''].filter(Boolean).join(' · ');
      h += '<div class="flex justify-between gap-3 text-xs"><div class="min-w-0"><p class="font-bold text-slate-800 leading-tight">' + it.cantidad + 'x ' + esc(it.titulo) + '</p>' +
           (extra ? '<p class="text-[11px] text-slate-500 leading-snug break-words">' + esc(extra) + '</p>' : '') + '</div>' +
           '<span class="font-bold flex-shrink-0 ' + (it.canje ? 'text-violet-600' : 'text-slate-700') + '">' + (it.canje ? '🎁 ' + (it.puntos_costo * it.cantidad) + ' pts' : fmtPrecio(it.subtotal)) + '</span></div>';
    });
    h += '<div class="border-t border-slate-100 pt-2.5 space-y-1.5">' + fila('Productos', fmtPrecio(p.subtotal));
    if (p.envio_modo === 'gratis') h += fila('Envío', 'Gratis');
    else if (p.envio_modo === 'fijo' || p.envio_modo === 'a_convenir') h += fila('Envío', p.costo_envio != null ? fmtPrecio(p.costo_envio) : 'A confirmar');
    h += fila('Total', p.total != null ? fmtPrecio(p.total) : 'A confirmar', true) + '</div></div>';

    // Puntos del pedido
    if (Number(d.puntos_canje) > 0) h += '<div class="bg-violet-50 border border-violet-200 rounded-2xl p-3 text-xs font-bold text-violet-700">🎁 Canjeaste ' + d.puntos_canje + ' puntos en este pedido' + (p.estado === 'cancelado' ? ' (te los devolvimos)' : '') + '.</div>';
    if (Number(d.puntos_a_sumar) > 0 && abierto) {
      h += d.con_sesion
        ? '<div class="bg-amber-50 border border-amber-200 rounded-2xl p-3 text-xs font-bold text-amber-800">✨ Este pedido suma ' + d.puntos_a_sumar + ' puntos cuando lo marques como recibido.</div>'
        : '<div class="bg-amber-50 border border-amber-200 rounded-2xl p-3 text-xs font-bold text-amber-800">✨ Este pedido sumaría ' + d.puntos_a_sumar + ' puntos, pero lo hiciste sin sesión. En tu próximo pedido, registrate con Google para sumar.</div>';
    }

    // Entrega y pago
    h += '<div class="bg-slate-50 border border-slate-200 rounded-2xl p-3.5 text-xs space-y-1.5 text-slate-600">' +
         '<p><b class="text-slate-700">A nombre de:</b> ' + esc(p.cliente_nombre) + '</p>' +
         (p.tipo_entrega === 'envio'
           ? '<p><b class="text-slate-700">Entrega:</b> envío a ' + esc(p.direccion || '') + '</p>'
           : '<p><b class="text-slate-700">Entrega:</b> retiro en el local' + (c.direccion ? ' (' + esc(c.direccion) + ')' : '') + '</p>') +
         '<p><b class="text-slate-700">Pago:</b> ' + esc(MEDIO_TXT[p.medio_pago] || p.medio_pago) + '</p>' +
         (p.nota ? '<p><b class="text-slate-700">Aclaración:</b> ' + esc(p.nota) + '</p>' : '') +
         '<p class="text-slate-400">Hecho el ' + esc(fmtFecha(p.creado_en)) + '</p></div>';

    // Acciones
    h += '<div class="flex gap-2 flex-wrap">';
    if (c.telefono_whatsapp) h += '<button type="button" onclick="pedidoWhatsApp()" class="flex-1 min-w-[140px] bg-white border border-emerald-300 text-emerald-700 font-black text-xs py-3 rounded-xl flex items-center justify-center gap-1.5 active:scale-95 transition"><i data-lucide="message-circle" class="w-4 h-4"></i> Avisar por WhatsApp</button>';
    h += '<button type="button" onclick="pedidoCopiarLink()" class="flex-1 min-w-[140px] bg-white border border-slate-300 text-slate-700 font-black text-xs py-3 rounded-xl flex items-center justify-center gap-1.5 active:scale-95 transition"><i data-lucide="link" class="w-4 h-4"></i> Copiar link</button></div>';

    // Cancelar
    if (PUEDE_CANCELAR.indexOf(p.estado) >= 0) {
      h += '<div><button id="ped-btn-cancelar" type="button" onclick="pedidoAbrirCancelar()" class="w-full text-xs font-black text-rose-600 py-2.5 rounded-xl border border-rose-200 bg-rose-50 active:scale-95 transition">Cancelar pedido</button>' +
           '<div id="ped-cancel-box" class="hidden mt-2 border border-rose-200 rounded-2xl p-3.5 space-y-2.5 bg-rose-50/50">' +
           '<label for="ped-motivo" class="block text-xs font-bold text-slate-700">¿Por qué lo cancelás? <span class="font-normal text-slate-400">(opcional)</span></label>' +
           '<input type="text" id="ped-motivo" maxlength="200" placeholder="Ej: me equivoqué de dirección" class="w-full clean-input px-3.5 py-2.5 rounded-xl text-xs font-semibold">' +
           '<div class="grid grid-cols-2 gap-2">' +
           '<button type="button" onclick="pedidoConfirmarCancelar()" class="bg-rose-600 text-white font-black py-2.5 rounded-xl text-xs active:scale-95 transition">Sí, cancelar</button>' +
           '<button type="button" onclick="pedidoCerrarCancelar()" class="bg-white border border-slate-300 text-slate-700 font-black py-2.5 rounded-xl text-xs active:scale-95 transition">Volver</button>' +
           '</div></div></div>';
    } else if (abierto) {
      h += '<p class="text-[11px] text-slate-400 text-center leading-snug">Ya salió, así que no se puede cancelar desde acá. Si hay un problema, escribile al comercio.</p>';
    }

    // Historial
    if (hist.length) {
      h += '<div class="space-y-2"><p class="text-[11px] font-black text-slate-500 uppercase tracking-wider">Historial</p><ol class="space-y-2 border-l-2 border-slate-200 ml-1.5 pl-3.5">';
      hist.forEach(function (x) {
        var ee = ESTADOS[x.estado] || { c: x.estado };
        h += '<li class="text-xs"><span class="font-bold text-slate-700">' + esc(ee.c) + '</span> <span class="text-slate-400">· ' + esc(fmtFecha(x.fecha)) + '</span>' +
             (x.nota ? '<p class="text-[11px] text-slate-500 leading-snug">' + esc(x.nota) + '</p>' : '') + '</li>';
      });
      h += '</ol></div>';
    }

    el('pedido-contenido').innerHTML = h;
    icono();
  }

  /* ---------------------------------------------------------------- acciones del cliente */
  function ctx() {
    if (!PED.data || !PED.data.pedido) return null;
    return { id: PED.data.pedido.id, token: PED.token, p: PED.data.pedido, c: PED.data.comercio || {} };
  }
  async function accion(fn, args, okTexto) {
    if (PED.ocupado) return null;
    PED.ocupado = true;
    try {
      var r = await rpc(fn, args);
      if (okTexto) mostrarToast(okTexto);
      PED.ocupado = false;
      PED.sig = '';
      await cargarPedido(false);
      return r || true;
    } catch (e) {
      PED.ocupado = false;
      alert(mensajeError(e));
      PED.sig = '';
      cargarPedido(false);
      return null;
    }
  }

  function pedidoResponderTotal(acepta) {
    var x = ctx(); if (!x) return;
    if (!acepta && !confirm('¿Seguro que no querés aceptar el costo del envío? El pedido se va a cancelar.')) return;
    accion('pv_cliente_responder_total', { p_pedido: x.id, p_acepta: Boolean(acepta), p_token: x.token },
           acepta ? '¡Listo! El comercio ya puede prepararlo.' : 'Pedido cancelado.');
  }
  function pedidoAbrirCancelar() {
    var box = el('ped-cancel-box'), btn = el('ped-btn-cancelar');
    if (!box) return;
    box.classList.remove('hidden'); if (btn) btn.classList.add('hidden');
    box.scrollIntoView({ block: 'center', behavior: 'smooth' });
    var i = el('ped-motivo'); if (i) i.focus();
  }
  function pedidoCerrarCancelar() {
    var box = el('ped-cancel-box'), btn = el('ped-btn-cancelar');
    if (box) box.classList.add('hidden'); if (btn) btn.classList.remove('hidden');
  }
  function pedidoConfirmarCancelar() {
    var x = ctx(); if (!x) return;
    var m = (el('ped-motivo') && el('ped-motivo').value || '').trim();
    accion('pv_cliente_cancelar', { p_pedido: x.id, p_motivo: m || null, p_token: x.token }, 'Pedido cancelado.');
  }
  function pedidoRecibidoClick() {
    var x = ctx(); if (!x) return;
    var conSesion = Boolean(usuarioActual) && (function () { var l = entradaLocal(x.id); return l ? l.sesion !== false : true; })();
    if (conSesion && esUltra(x.p.comercio_id) && Number(PED.data.puntos_a_sumar) > 0) {
      var box = el('ped-puntos-box'), btn = el('ped-btn-recibido');
      if (box) box.classList.remove('hidden'); if (btn) btn.classList.add('hidden');
      return;
    }
    if (confirm('¿Confirmás que ya recibiste tu pedido?')) pedidoRecibido(false);
  }
  async function pedidoRecibido(quierePuntos) {
    var x = ctx(); if (!x) return;
    var r = await accion('pv_cliente_recibido', { p_pedido: x.id, p_quiere_puntos: Boolean(quierePuntos), p_token: x.token }, null);
    if (window.nvCargarPuntos && usuarioActual) nvCargarPuntos();
    if (r && r.puntos > 0) mostrarToast('¡Sumaste ' + r.puntos + ' puntos!');
    else if (r) mostrarToast('¡Gracias! Pedido marcado como recibido.');
  }

  async function pedidoSubirComprobante(input) {
    var x = ctx(); var f = input && input.files && input.files[0];
    if (!x || !f) return;
    var tipos = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'application/pdf': 'pdf' };
    if (!tipos[f.type]) { alert('El comprobante tiene que ser una foto (JPG, PNG, WebP) o un PDF.'); input.value = ''; return; }
    if (f.size > 5 * 1024 * 1024) { alert('El archivo pesa más de 5 MB. Probá con una captura más liviana.'); input.value = ''; return; }
    if (PED.ocupado) return;
    PED.ocupado = true;
    mostrarToast('Subiendo comprobante…');
    try {
      var path = x.id.toLowerCase() + '/comprobante-' + Date.now() + '.' + tipos[f.type];
      var up = await _supabase.storage.from('pv-comprobantes').upload(path, f, { contentType: f.type, upsert: false });
      if (up.error) throw up.error;
      await rpc('pv_cliente_comprobante', { p_pedido: x.id, p_path: path, p_token: x.token });
      mostrarToast('¡Comprobante enviado!');
    } catch (e) {
      alert('No pudimos subir el comprobante. ' + mensajeError(e, 'Revisá tu internet e intentá de nuevo.'));
    }
    PED.ocupado = false; PED.sig = '';
    cargarPedido(false);
  }

  function pedidoCopiarAlias() {
    var x = ctx(); if (!x || !x.c.alias) return;
    try { navigator.clipboard.writeText(x.c.alias).then(function () { mostrarToast('¡Alias copiado!'); }); } catch (e) { /* ok */ }
  }
  function pedidoCopiarLink() {
    if (!PED.token) return;
    var url = linkSeguimiento(PED.token);
    try { navigator.clipboard.writeText(url).then(function () { mostrarToast('¡Link copiado!'); }, function () { prompt('Copiá este link:', url); }); }
    catch (e) { prompt('Copiá este link:', url); }
  }
  function pedidoWhatsApp() {
    var x = ctx(); if (!x || !x.c.telefono_whatsapp) return;
    var texto = '¡Hola *' + (x.c.nombre || '') + '*! Hice el pedido *#' + x.p.numero + '* en *NecoVende*.\n' +
                'Total: ' + (x.p.total != null ? fmtPrecio(x.p.total) : 'a confirmar') + '\n' +
                'Seguimiento: ' + linkSeguimiento(x.token);
    var url = 'https://wa.me/' + digitos(x.c.telefono_whatsapp) + '?text=' + encodeURIComponent(texto);
    var w = window.open(url, '_blank');
    if (!w) window.location.href = url;
  }

  /* ---------------------------------------------------------------- Mis pedidos */
  function abrirMisPedidos() {
    abrirModal('modal-mis-pedidos');
    el('mis-pedidos-contenido').innerHTML = '<p class="text-xs text-slate-400 text-center py-10 font-semibold">Cargando tus pedidos…</p>';
    cargarMisPedidos();
  }
  function cerrarMisPedidos() { cerrarModal('modal-mis-pedidos'); }

  async function cargarMisPedidos() {
    var cont = el('mis-pedidos-contenido');
    try {
      try { await _supabase.rpc('pv_refrescar'); } catch (e) { /* opcional */ }
      var lista = [], vistos = {};

      if (usuarioActual) {
        var r = await _supabase.from('pv_pedidos')
          .select('id, numero, estado, total, subtotal, creado_en, comercio_id')
          .eq('cliente_id', usuarioActual.id)         // sin este filtro un comercio vería también los pedidos que recibe
          .order('creado_en', { ascending: false }).limit(30);
        if (r.error) throw r.error;
        var ids = Array.from(new Set((r.data || []).map(function (x) { return x.comercio_id; })));
        var nombres = {};
        (typeof comerciosGlobales !== 'undefined' ? comerciosGlobales : []).forEach(function (c) { nombres[c.id] = c.nombre; });
        var faltan = ids.filter(function (i) { return !nombres[i]; });
        if (faltan.length) {
          var rc = await _supabase.from('comercios').select('id, nombre').in('id', faltan);
          (rc.data || []).forEach(function (c) { nombres[c.id] = c.nombre; });
        }
        (r.data || []).forEach(function (x) {
          vistos[x.id] = true;
          var loc = entradaLocal(x.id);
          lista.push({ id: x.id, token: loc ? loc.token : null, numero: x.numero, estado: x.estado,
                       total: x.total != null ? x.total : null, subtotal: x.subtotal, creado: x.creado_en, comercio: nombres[x.comercio_id] || 'Comercio' });
        });
      }

      // Pedidos hechos en este dispositivo (sin sesión, o antes de iniciarla)
      var locales = pedidosLocales().filter(function (x) { return !vistos[x.id]; }).slice(0, 8);
      var det = await Promise.all(locales.map(function (x) {
        return rpc('pv_ver_pedido', { p_token: x.token }).then(function (d) { return { x: x, d: d }; }, function () { return null; });
      }));
      det.forEach(function (o) {
        if (!o || !o.d || !o.d.pedido) return;
        var p = o.d.pedido;
        lista.push({ id: p.id, token: o.x.token, numero: p.numero, estado: p.estado, total: p.total, subtotal: p.subtotal,
                     creado: p.creado_en, comercio: (o.d.comercio && o.d.comercio.nombre) || o.x.comercio });
      });

      lista.sort(function (a, b) { return new Date(b.creado) - new Date(a.creado); });
      renderMisPedidos(lista);
    } catch (e) {
      cont.innerHTML = '<p class="text-xs text-rose-600 text-center py-10 font-bold">' + esc(mensajeError(e)) + '</p>';
    }
  }

  function renderMisPedidos(lista) {
    var h = '';
    if (!usuarioActual) {
      h += '<div class="bg-amber-50 border border-amber-200 rounded-2xl p-3.5 text-xs text-amber-800 space-y-2">' +
           '<p class="leading-snug"><b>Estás sin sesión.</b> Acá ves los pedidos de este dispositivo. Iniciá sesión para tenerlos en todos tus dispositivos, recibir avisos y sumar puntos.</p>' +
           '<button type="button" onclick="iniciarSesionGoogle()" class="bg-white border border-amber-300 text-amber-800 font-black text-xs px-3.5 py-2 rounded-xl active:scale-95 transition">Iniciar sesión con Google</button></div>';
    }
    if (!lista.length) {
      h += '<p class="text-xs text-slate-400 text-center py-8 font-semibold">Todavía no hiciste pedidos.</p>';
    }
    lista.forEach(function (x) {
      var e = ESTADOS[x.estado] || { c: x.estado, k: 'slate' };
      var atencion = NECESITA_RESPUESTA.indexOf(x.estado) >= 0;
      var abrir = x.token ? 'abrirPedido(\'' + x.token + '\')' : 'abrirPedidoPorId(\'' + x.id + '\')';
      h += '<button type="button" onclick="' + abrir + '" class="w-full text-left border rounded-2xl p-3.5 space-y-1.5 transition active:scale-[.99] ' +
           (atencion ? 'border-orange-300 bg-orange-50/60' : 'border-slate-200 bg-white hover:bg-slate-50') + '">' +
           '<div class="flex justify-between items-start gap-2"><div class="min-w-0"><p class="text-sm font-black text-slate-900 truncate">' + esc(x.comercio) + '</p>' +
           '<p class="text-[11px] text-slate-400">Pedido #' + x.numero + ' · ' + esc(fmtFecha(x.creado)) + '</p></div>' +
           '<span class="text-sm font-black text-brand-600 flex-shrink-0">' + (x.total != null ? fmtPrecio(x.total) : fmtPrecio(x.subtotal) + ' + envío') + '</span></div>' +
           '<span class="inline-flex text-[11px] font-black px-2.5 py-1 rounded-full border ' + CLASES[e.k] + '">' + esc(e.c) + '</span>' +
           (atencion ? '<p class="text-[11px] font-bold text-orange-700">Necesita tu respuesta</p>' : '') + '</button>';
    });
    el('mis-pedidos-contenido').innerHTML = h;
    icono();
  }

  // Con sesión, el token del pedido se pide a la base (solo lo devuelve si el pedido es tuyo)
  async function abrirPedidoPorId(id) {
    try {
      var tk = null;
      try { tk = await rpc('pv_mi_token', { p_pedido: id }); }
      catch (e) {
        if (e && (e.code === 'PGRST202' || /could not find the function/i.test(e.message || ''))) {
          var r = await _supabase.from('pv_pedidos').select('token_invitado').eq('id', id).eq('cliente_id', usuarioActual.id).maybeSingle();
          tk = r.data && r.data.token_invitado;
        } else throw e;
      }
      if (!tk) { mostrarToast('No encontramos ese pedido.'); return; }
      var loc = entradaLocal(id);
      if (!loc) guardarPedidoLocal({ id: id, token: tk, numero: '', comercio: '', total: null, creado: new Date().toISOString(), sesion: true });
      abrirPedido(tk);
    } catch (e) { mostrarToast(mensajeError(e)); }
  }

  /* ---------------------------------------------------------------- links de entrada */
  function limpiarUrl() {
    try {
      var u = new URL(location.href);
      if (!u.searchParams.has('pedido') && !u.searchParams.has('pedido_token')) return;
      u.searchParams.delete('pedido'); u.searchParams.delete('pedido_token');
      history.replaceState(history.state, '', u.pathname + u.search + u.hash);
    } catch (e) { /* ok */ }
  }

  async function manejarLinkPedido() {
    var q = new URLSearchParams(location.search);
    var tok = q.get('pedido_token'), pid = q.get('pedido');
    if (!tok && !pid) return;
    limpiarUrl();
    if (tok && UUID.test(tok)) { abrirPedido(tok); return; }
    if (!pid || !UUID.test(pid)) return;
    pid = pid.toLowerCase();

    var loc = entradaLocal(pid);
    if (loc) { abrirPedido(loc.token); return; }
    var s = (await _supabase.auth.getSession()).data.session;
    if (!s) { abrirMisPedidos(); mostrarToast('Iniciá sesión para ver tu pedido.'); return; }
    try {
      var r = await _supabase.from('pv_pedidos').select('id, cliente_id').eq('id', pid).maybeSingle();
      if (r.data && r.data.cliente_id === s.user.id) { abrirPedidoPorId(pid); return; }
      if (r.data) {                                   // es un pedido que recibió tu comercio
        if (typeof window.abrirPanelPedidos === 'function') window.abrirPanelPedidos(pid);
        else mostrarToast('Tenés un pedido nuevo en tu comercio.');
        return;
      }
      abrirMisPedidos();
    } catch (e) { abrirMisPedidos(); }
  }

  /* ---------------------------------------------------------------- arranque */
  window.addEventListener('DOMContentLoaded', function () {
    var cli = leerJSON(LS_CLIENTE, null);
    if (cli) {
      var n = el('cart-input-nombre-retira'), t = el('cart-input-telefono');
      if (n && !n.value && cli.nombre) n.value = cli.nombre;
      if (t && !t.value && cli.telefono) t.value = cli.telefono;
    }
    manejarLinkPedido();
  });
  document.addEventListener('visibilitychange', function () {
    if (!document.hidden && PED.token && !el('modal-pedido').classList.contains('hidden')) cargarPedido(true);
  });

  Object.assign(window, {
    enviarPedido: enviarPedido, abrirPedido: abrirPedido, cerrarPedido: cerrarPedido,
    abrirMisPedidos: abrirMisPedidos, cerrarMisPedidos: cerrarMisPedidos, abrirPedidoPorId: abrirPedidoPorId,
    pedidoResponderTotal: pedidoResponderTotal, pedidoAbrirCancelar: pedidoAbrirCancelar,
    pedidoCerrarCancelar: pedidoCerrarCancelar, pedidoConfirmarCancelar: pedidoConfirmarCancelar,
    pedidoRecibidoClick: pedidoRecibidoClick, pedidoRecibido: pedidoRecibido,
    pedidoSubirComprobante: pedidoSubirComprobante, pedidoCopiarAlias: pedidoCopiarAlias,
    pedidoCopiarLink: pedidoCopiarLink, pedidoWhatsApp: pedidoWhatsApp
  });
})();
