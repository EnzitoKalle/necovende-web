// =====================================================================
// RESERVAS POR HORARIO (canchas de pádel, fútbol, etc.) — SQL 13
// Cliente: elige espacio, día y horario → solicita. Dueño: acepta / confirma seña / carga a mano.
// Los nombres de los clientes solo los ve el dueño (las funciones del SQL lo garantizan).
// =====================================================================
(function () {
  var DIAS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
  var MESES = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];
  var R = { c: null, esp: null, fecha: null, ocup: [], sel: null, box: null, modo: 'cliente', lista: [] };

  function usr() { return (typeof usuarioActual !== 'undefined' && usuarioActual) ? usuarioActual : null; }
  function E(t) { return (typeof esc === 'function') ? esc(t) : String(t == null ? '' : t).replace(/[&<>"']/g, function (m) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]; }); }
  function p2(n) { return (n < 10 ? '0' : '') + n; }
  function hhmm(m) { return p2(Math.floor(m / 60)) + ':' + p2(m % 60); }
  function aMin(s) { var p = String(s || '0:0').split(':'); return (+p[0]) * 60 + (+p[1] || 0); }
  function clave(d) { return d.getFullYear() + '-' + p2(d.getMonth() + 1) + '-' + p2(d.getDate()); }
  function deClave(k) { var p = k.split('-'); return new Date(+p[0], +p[1] - 1, +p[2]); }
  function hoy() { var d = new Date(); return new Date(d.getFullYear(), d.getMonth(), d.getDate()); }
  function ahoraMin() { var d = new Date(); return d.getHours() * 60 + d.getMinutes(); }
  function lindaFecha(k) { var d = deClave(k); return DIAS[d.getDay()] + ' ' + d.getDate() + '/' + (d.getMonth() + 1); }
  function plata(n) { return '$' + Math.round(Number(n) || 0).toLocaleString('es-AR'); }
  var DK = ['dom', 'lun', 'mar', 'mie', 'jue', 'vie', 'sab'];
  function cfg(c) {
    return { bloque: +c.cal_bloque_min || 60, esp: (Array.isArray(c.cal_espacios) && c.cal_espacios.length) ? c.cal_espacios : ['Cancha 1'] };
  }
  // Tramos de atención de un día de la semana (usa el horario de atención que el comercio ya cargó)
  function rangos(c, dow) {
    var hd = c.horarios_dias, out = [];
    if (!hd) {
      var dias = Array.isArray(c.cal_dias) ? c.cal_dias : [0,1,2,3,4,5,6];
      return dias.indexOf(dow) >= 0 ? [{ d: aMin(c.cal_desde || '09:00'), h: aMin(c.cal_hasta || '23:00') }] : [];
    }
    var j = hd[DK[dow]]; if (!j || j.cerrado) return out;
    [['desde', 'hasta'], ['desde2', 'hasta2']].forEach(function (p) {
      if (j[p[0]] && j[p[1]]) { var d = aMin(j[p[0]]), h = aMin(j[p[1]]); if (h <= d) h = 1440; out.push({ d: d, h: h }); }
    });
    return out;
  }
  function atiende(c, dow) { return rangos(c, dow).length > 0; }
  function msgErr(e) { return (e && e.message) ? e.message.replace(/^.*?:\s*/, '') : 'Error'; }
  function minutosTxt(m) { return m >= 60 && m % 60 === 0 ? (m / 60) + ' h' : m + ' min'; }

  // ---------- ocupación del día
  async function cargarDia() {
    if (R.modo === 'dueno') {
      var p = await _supabase.rpc('nv_res_panel', { p_comercio: R.c.id });
      R.lista = p.error ? [] : (p.data || []); R.ocup = [];
      if (p.error) alert('No se pudo cargar el calendario (¿corriste el SQL 13?): ' + msgErr(p.error));
      return;
    }
    if (!R.fecha) { R.ocup = []; return; }
    var r = await _supabase.rpc('nv_res_ocupacion', { p_comercio: R.c.id, p_desde: R.fecha, p_hasta: R.fecha });
    R.ocup = r.error ? [] : (r.data || []);
  }
  function estadoBloque(ini, fin) {
    var q = R.ocup.filter(function (o) { return o.espacio === R.esp && o.fecha === R.fecha && o.inicio_min < fin && o.fin_min > ini; });
    if (q.some(function (o) { return o.estado === 'ocupado'; })) return 'ocupado';
    if (q.length) return 'pendiente';
    return 'libre';
  }

  // ---------- piezas visuales comunes
  function selectorEspacio() {
    var k = cfg(R.c); if (k.esp.length < 2) return '';
    return '<div class="flex gap-1.5 overflow-x-auto pb-1 mb-2">' + k.esp.map(function (e, i) {
      return '<button type="button" onclick="nvResEsp(' + i + ')" class="flex-shrink-0 px-3 py-1.5 rounded-xl text-xs font-black border ' + (e === R.esp ? 'bg-slate-800 text-white border-slate-800' : 'bg-white text-slate-600 border-slate-200') + '">' + E(e) + '</button>';
    }).join('') + '</div>';
  }
  function tiraFechas() {
    var k = cfg(R.c), h = hoy(), out = '<div class="flex gap-1.5 overflow-x-auto pb-1">';
    for (var i = 0; i < 14; i++) {
      var d = new Date(h.getFullYear(), h.getMonth(), h.getDate() + i), key = clave(d), ok = atiende(R.c, d.getDay()), sel = key === R.fecha;
      out += '<button type="button" ' + (ok ? '' : 'disabled') + ' onclick="nvResFecha(\'' + key + '\')" class="flex-shrink-0 w-14 py-2 rounded-xl border text-center ' +
        (sel ? 'bg-slate-800 text-white border-slate-800' : (ok ? 'bg-white text-slate-700 border-slate-200' : 'bg-slate-50 text-slate-300 border-slate-100')) + '"><span class="block text-[10px] font-bold">' + DIAS[d.getDay()] + '</span><span class="block text-base font-black leading-tight">' + d.getDate() + '</span><span class="block text-[9px] font-semibold opacity-70">' + MESES[d.getMonth()] + '</span></button>';
    }
    var max = new Date(h.getFullYear(), h.getMonth(), h.getDate() + 90);
    return out + '</div><label class="block mt-1 text-[10px] font-bold text-slate-400">Otra fecha: <input type="date" min="' + clave(h) + '" max="' + clave(max) + '" onchange="nvResFecha(this.value)" class="border border-slate-200 rounded-lg px-1.5 py-0.5 text-[11px] text-slate-600"></label>';
  }

  // ---------- CLIENTE
  function bloquesCliente() {
    var k = cfg(R.c), hoyKey = clave(hoy()), rg = rangos(R.c, deClave(R.fecha).getDay());
    if (!rg.length) return '<p class="text-xs text-slate-400 text-center mt-3">Ese día el comercio no atiende.</p>';
    var out = '<div class="grid grid-cols-3 gap-1.5 mt-3">';
    rg.forEach(function (r) {
      for (var m = r.d; m + k.bloque <= r.h; m += k.bloque) {
        var fin = m + k.bloque, st = estadoBloque(m, fin), pasado = R.fecha === hoyKey && m <= ahoraMin();
        var sel = R.sel && m >= R.sel.ini && fin <= R.sel.fin;
        var cls, txt = '';
        if (pasado || st === 'ocupado') { cls = 'bg-slate-100 text-slate-300 line-through border-slate-100'; }
        else if (st === 'pendiente') { cls = 'bg-amber-50 text-amber-600 border-amber-200'; txt = '<span class="block text-[9px] font-semibold no-underline">en trámite</span>'; }
        else if (sel) { cls = 'bg-emerald-500 text-white border-emerald-600'; }
        else { cls = 'bg-emerald-50 text-emerald-700 border-emerald-300'; }
        var libre = !pasado && st === 'libre';
        out += '<button type="button" ' + (libre ? '' : 'disabled') + ' onclick="nvResBloque(' + m + ')" class="py-2 rounded-xl border text-xs font-black ' + cls + '">' + hhmm(m) + txt + '</button>';
      }
    });
    return out + '</div>';
  }
  function resumenCliente() {
    if (!R.sel) return '<p class="text-[11px] text-slate-400 text-center mt-3">Tocá un horario libre. Para más de un bloque seguido, tocá el siguiente.</p>';
    var c = R.c, k = cfg(c), n = (R.sel.fin - R.sel.ini) / k.bloque, precio = c.cal_precio_bloque ? Number(c.cal_precio_bloque) * n : null;
    var nombre = ''; var tel = '';
    try { nombre = localStorage.getItem('nv_res_nombre') || ''; tel = localStorage.getItem('nv_res_tel') || ''; } catch (e) {}
    if (!nombre && usr() && usr().user_metadata) nombre = usr().user_metadata.full_name || usr().user_metadata.name || '';
    var modoTxt = c.cal_confirmacion === 'automatica' ? 'Reserva automática: queda confirmada al instante.' :
      (c.cal_confirmacion === 'sena' ? 'Para confirmar hay que transferir una seña (te mostramos los datos al solicitar).' : 'El comercio tiene que aceptar tu solicitud.');
    if (!usr()) return '<div class="mt-3 rounded-2xl border border-emerald-200 bg-emerald-50/60 p-3 space-y-2"><p class="text-xs font-black text-slate-800">' + E(R.esp) + ' · ' + lindaFecha(R.fecha) + ' · ' + hhmm(R.sel.ini) + ' a ' + hhmm(R.sel.fin) + (precio ? ' · ' + plata(precio) : '') + '</p><p class="text-[11px] text-slate-500">Para reservar entrás con tu cuenta de Google (un toque). Así el comercio sabe quién sos y te avisamos cuando responda. Guardamos lo que elegiste y al volver solo tenés que enviar.</p><button type="button" onclick="nvResLogin()" class="w-full py-3 rounded-xl bg-slate-800 text-white text-xs font-black">Entrar con Google (vas a volver acá con tu horario elegido)</button></div>';
    return '<div class="mt-3 rounded-2xl border border-emerald-200 bg-emerald-50/60 p-3 space-y-2">' +
      '<p class="text-xs font-black text-slate-800">' + E(R.esp) + ' · ' + lindaFecha(R.fecha) + ' · ' + hhmm(R.sel.ini) + ' a ' + hhmm(R.sel.fin) + (precio ? ' · ' + plata(precio) : '') + '</p>' +
      '<input id="res-nombre" type="text" maxlength="80" placeholder="Tu nombre" value="' + E(nombre) + '" class="w-full clean-input px-3 py-2 rounded-xl text-xs font-semibold">' +
      '<input id="res-tel" type="tel" maxlength="30" placeholder="Tu teléfono (opcional)" value="' + E(tel) + '" class="w-full clean-input px-3 py-2 rounded-xl text-xs font-semibold">' +
      '<p class="text-[10px] text-slate-500">' + modoTxt + '</p>' +
      '<button type="button" id="res-btn" onclick="nvResSolicitar()" class="w-full py-3 rounded-xl bg-emerald-500 text-white text-xs font-black">' + (c.cal_confirmacion === 'automatica' ? 'Reservar' : 'Solicitar horario') + '</button></div>';
  }
  function pintarCliente() {
    var b = document.getElementById(R.box); if (!b) return;
    b.innerHTML = selectorEspacio() + tiraFechas() + bloquesCliente() + resumenCliente() +
      '<button type="button" onclick="nvResMis()" class="mt-3 w-full py-2 rounded-xl bg-slate-100 text-slate-600 text-[11px] font-black">📋 Mis reservas</button>';
  }

  window.nvResRenderEnComercio = async function (c, header) {
    var viejo = document.getElementById('cal-cliente-wrap'); if (viejo) viejo.remove();
    if (!c || c.calendario_activo !== true || !header) return;
    header.insertAdjacentHTML('beforeend', '<div id="cal-cliente-wrap" class="px-5 pb-5 bg-white"><div class="rounded-2xl border border-slate-200 p-4"><h3 class="text-xs font-black uppercase tracking-wide text-slate-700 mb-3">📅 Reservar horario</h3><div id="cal-cliente"></div></div></div>');
    var k = cfg(c), h = hoy(), f = null;
    for (var i = 0; i < 14; i++) { var d = new Date(h.getFullYear(), h.getMonth(), h.getDate() + i); if (atiende(c, d.getDay())) { f = clave(d); break; } }
    R = { c: c, esp: k.esp[0], fecha: f, ocup: [], sel: null, box: 'cal-cliente', modo: 'cliente', lista: [] };
    var pend = leerPend(), restaurar = pend && String(pend.cid) === String(c.id);
    if (restaurar) { R.esp = k.esp.indexOf(pend.esp) >= 0 ? pend.esp : R.esp; if (pend.fecha && pend.fecha >= clave(h)) R.fecha = pend.fecha; }
    pintarCliente();
    await cargarDia(); if (R.c !== c) return;
    if (restaurar) {
      if (pend.ini != null && estadoBloque(pend.ini, pend.fin) === 'libre') R.sel = { ini: pend.ini, fin: pend.fin };
      pintarCliente();
      var wrap = document.getElementById('cal-cliente-wrap'); if (wrap) wrap.scrollIntoView({ block: 'center', behavior: 'instant' });
      var nom = document.getElementById('res-nombre'), tl = document.getElementById('res-tel');
      if (nom && !nom.value && pend.nombre) nom.value = pend.nombre; if (tl && !tl.value && pend.tel) tl.value = pend.tel;
      if (usr()) borrarPend();
      else { var n = 0, w = setInterval(function () { n++; if (usr()) { clearInterval(w); pintarCliente(); borrarPend(); } else if (n > 25) clearInterval(w); }, 300); }
    } else pintarCliente();
    if (usr() && usr().id === c.user_id) nvResBadge(c);
  };
  window.nvResBadge = async function (c) {
    var r = await _supabase.rpc('nv_res_panel', { p_comercio: c.id }); if (r.error) return;
    var n = (r.data || []).filter(function (x) { return x.estado === 'pendiente' || x.estado === 'sena_avisada'; }).length;
    var b = document.getElementById('res-badge'); if (b && n) { b.textContent = n; b.classList.remove('hidden'); }
  };
  var CLAVE = 'nv_res_pend';
  window.nvResLogin = function () {
    try {
      localStorage.setItem(CLAVE, JSON.stringify({ cid: R.c.id, slug: R.c.slug || R.c.id, esp: R.esp, fecha: R.fecha, ini: R.sel ? R.sel.ini : null, fin: R.sel ? R.sel.fin : null,
        nombre: (document.getElementById('res-nombre') || {}).value || '', tel: (document.getElementById('res-tel') || {}).value || '', t: Date.now() }));
    } catch (e) {}
    if (typeof iniciarSesionGoogle === 'function') iniciarSesionGoogle();
  };
  function leerPend() { try { var p = JSON.parse(localStorage.getItem(CLAVE) || 'null'); if (p && Date.now() - p.t < 60 * 60 * 1000) return p; } catch (e) {} return null; }
  function borrarPend() { try { localStorage.removeItem(CLAVE); } catch (e) {} }
  // Al volver de Google: si caímos en el inicio, reabre el comercio; la selección se restaura al dibujar el calendario
  window.nvResRestaurar = function () {
    var p = leerPend(); if (!p) return;
    if (typeof comercioActivo !== 'undefined' && comercioActivo && String(comercioActivo.id) === String(p.cid)) return; // ya está abierto: lo restaura el dibujo del calendario
    var intentos = 0, t = setInterval(function () {
      intentos++;
      if (usr()) { clearInterval(t); if (typeof abrirVistaComercio === 'function') abrirVistaComercio(p.slug, false); }
      else if (intentos > 25) { clearInterval(t); }
    }, 300);
  };
  window.nvResEsp = function (i) { R.esp = cfg(R.c).esp[i]; R.sel = null; pintarCliente(); if (R.modo === 'dueno') pintarDueno(); };
  window.nvResFecha = async function (k) { if (!k) return; R.fecha = k; R.sel = null; if (R.modo === 'dueno') { pintarDueno(); await cargarDia(); pintarDueno(); } else { pintarCliente(); await cargarDia(); pintarCliente(); } };
  window.nvResBloque = function (m) {
    var b = cfg(R.c).bloque, s = R.sel, max = b * 6;
    if (s && m === s.fin && (s.fin + b - s.ini) <= max && estadoBloque(m, m + b) === 'libre') s = { ini: s.ini, fin: m + b };
    else if (s && s.ini === m && s.fin - s.ini === b) s = null;
    else s = { ini: m, fin: m + b };
    R.sel = s; pintarCliente();
  };

  window.nvResSolicitar = async function () {
    if (!usr()) { nvResLogin(); return; }
    var nombre = (document.getElementById('res-nombre').value || '').trim(), tel = (document.getElementById('res-tel').value || '').trim();
    if (nombre.length < 3) { alert('Ingresá tu nombre.'); return; }
    try { localStorage.setItem('nv_res_nombre', nombre); localStorage.setItem('nv_res_tel', tel); } catch (e) {}
    var btn = document.getElementById('res-btn'); btn.disabled = true; btn.textContent = 'Enviando…';
    var r = await _supabase.rpc('nv_res_solicitar', { p_comercio: R.c.id, p_espacio: R.esp, p_fecha: R.fecha, p_inicio: R.sel.ini, p_fin: R.sel.fin, p_nombre: nombre, p_telefono: tel });
    if (r.error) { alert(msgErr(r.error)); R.sel = null; await cargarDia(); pintarCliente(); return; }
    var d = r.data || {}, res = { espacio: R.esp, fecha: R.fecha, ini: R.sel.ini, fin: R.sel.fin };
    R.sel = null; await cargarDia(); pintarCliente();
    mostrarResultado(d, res);
  };

  function mostrarResultado(d, res) {
    var cuando = E(res.espacio) + ' · ' + lindaFecha(res.fecha) + ' · ' + hhmm(res.ini) + ' a ' + hhmm(res.fin);
    var h;
    if (d.estado === 'confirmada') h = '<p class="text-4xl text-center">✅</p><p class="text-center font-black text-slate-900">¡Reservado!</p><p class="text-center text-xs text-slate-600">' + cuando + '</p>';
    else h = '<p class="text-4xl text-center">⏳</p><p class="text-center font-black text-slate-900">Solicitud enviada</p><p class="text-center text-xs text-slate-600">' + cuando + '</p>' +
      '<p class="text-center text-xs text-slate-500">El horario queda reservado para vos mientras el comercio la confirma. ' + (d.confirmacion === 'sena' ? 'Cuando la acepte te avisamos y ahí te mostramos cómo pagar la seña' + (d.sena_monto ? ' de ' + plata(d.sena_monto) : '') + '.' : 'Te avisamos apenas responda.') + '</p>';
    var el = document.getElementById('res-resultado');
    if (!el) { var m = document.createElement('div'); m.id = 'res-resultado'; m.className = 'modal-bottom-sheet fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4 z-50'; document.body.appendChild(m); el = m; }
    el.classList.remove('hidden');
    el.innerHTML = '<div class="clean-modal rounded-3xl p-6 w-full max-w-md space-y-3 shadow-2xl text-slate-800 bg-white">' + h +
      '<button type="button" onclick="document.getElementById(\'res-resultado\').classList.add(\'hidden\'); nvResMis()" class="w-full py-3 rounded-xl bg-slate-800 text-white text-xs font-black">Ver el estado en Mis reservas</button>' +
      '<button type="button" onclick="document.getElementById(\'res-resultado\').classList.add(\'hidden\')" class="w-full py-2.5 rounded-xl bg-slate-100 text-slate-600 text-xs font-bold">Cerrar</button></div>';
  }

  window.nvResYaTransferi = async function (id, inputId) {
    var t = (document.getElementById(inputId).value || '').trim();
    if (t.length < 3) { alert('Escribí a nombre de quién hiciste la transferencia.'); return; }
    var r = await _supabase.rpc('nv_res_cliente_sena', { p_id: id, p_titular: t });
    if (r.error) { alert(msgErr(r.error)); return; }
    var el = document.getElementById('res-resultado'); if (el) el.classList.add('hidden');
    nvResMis();
  };

  // ---------- Mis reservas (cliente)
  var ET = {
    pendiente: ['⏳ Esperando confirmación del comercio', 'text-amber-700 bg-amber-50'],
    esperando_sena: ['⏳ Reserva en proceso · falta la seña', 'text-amber-700 bg-amber-50'],
    sena_avisada: ['💸 Seña avisada · esperando que el comercio la confirme', 'text-sky-700 bg-sky-50'],
    confirmada: ['✅ Reserva aceptada', 'text-emerald-700 bg-emerald-50'],
    rechazada: ['❌ Reserva rechazada', 'text-rose-700 bg-rose-50'],
    cancelada: ['❌ Reserva cancelada', 'text-rose-700 bg-rose-50'],
    vencida: ['Venció (se liberó el horario)', 'text-slate-500 bg-slate-100']
  };
  window.nvResCopiar = function (texto, btn) {
    var ok = function () { if (btn) { var t = btn.textContent; btn.textContent = '¡Copiado!'; setTimeout(function () { btn.textContent = t; }, 1500); } };
    try { if (navigator.clipboard && navigator.clipboard.writeText) { navigator.clipboard.writeText(texto).then(ok, function () { copiaVieja(texto); ok(); }); return; } } catch (e) {}
    copiaVieja(texto); ok();
  };
  function copiaVieja(t) { var a = document.createElement('textarea'); a.value = t; a.style.position = 'fixed'; a.style.opacity = '0'; document.body.appendChild(a); a.select(); try { document.execCommand('copy'); } catch (e) {} a.remove(); }

  window.nvResMis = async function () {
    if (!usr()) { alert('Iniciá sesión para ver tus reservas.'); return; }
    abrirModal('modal-mis-reservas');
    var cont = document.getElementById('mis-reservas-lista'); cont.innerHTML = '<p class="text-xs text-slate-400">Cargando…</p>';
    var r = await _supabase.rpc('nv_res_mis');
    if (r.error) { cont.innerHTML = '<p class="text-xs text-slate-400">No se pudieron cargar (¿corriste el SQL 13?).</p>'; return; }
    var l = r.data || [];
    if (!l.length) { cont.innerHTML = '<p class="text-xs text-slate-400 text-center py-4">Todavía no reservaste ningún horario.</p>'; return; }
    cont.innerHTML = l.map(function (x) {
      var e = ET[x.estado] || [x.estado, 'bg-slate-100 text-slate-500'], act = '', det = '';
      var vence = x.vence_en ? new Date(x.vence_en).toLocaleString('es-AR', { weekday: 'short', hour: '2-digit', minute: '2-digit' }) : '';
      if (x.estado === 'pendiente') det = '<p class="text-[11px] text-slate-500 mt-2">El horario está reservado para vos' + (vence ? ' hasta ' + vence + ' hs' : '') + ' mientras el comercio responde.' + (x.confirmacion === 'sena' && x.sena_monto ? ' Si la acepta, vas a tener que transferir una seña de ' + plata(x.sena_monto) + '.' : '') + '</p>';
      if (x.estado === 'esperando_sena') {
        var al = x.alias || '';
        det = '<div class="rounded-xl bg-emerald-50 border border-emerald-200 p-3 mt-2 space-y-1.5 text-xs">' +
          '<p class="font-black text-slate-800">Falta la seña' + (x.sena_monto ? ' de ' + plata(x.sena_monto) : '') + '</p>' +
          (al ? '<p class="flex items-center justify-between gap-2"><span>Transferí al alias <b>' + E(al) + '</b></span><button type="button" onclick="nvResCopiar(\'' + E(al).replace(/'/g, '') + '\', this)" class="px-2.5 py-1 rounded-lg bg-white border border-emerald-300 text-emerald-700 text-[11px] font-black">Copiar</button></p>' : '<p>Consultá con el comercio los datos para transferir.</p>') +
          (x.titular_alias ? '<p class="text-slate-600">Titular: <b>' + E(x.titular_alias) + '</b></p>' : '') +
          (vence ? '<p class="text-slate-500">Tenés hasta ' + vence + ' hs; después el horario se libera.</p>' : '') + '</div>' +
          '<input id="mt-' + x.id + '" type="text" maxlength="80" placeholder="A nombre de quién hiciste la transferencia" class="w-full clean-input px-3 py-2 rounded-xl text-xs font-semibold mt-2">' +
          '<button type="button" onclick="nvResYaTransferi(\'' + x.id + '\', \'mt-' + x.id + '\')" class="w-full mt-1.5 py-2.5 rounded-xl bg-emerald-500 text-white text-xs font-black">Ya transferí</button>';
      }
      if (x.estado === 'sena_avisada') det = '<p class="text-[11px] text-slate-500 mt-2">Avisaste que transferiste' + (x.titular ? ' a nombre de <b>' + E(x.titular) + '</b>' : '') + '. Cuando el comercio la confirme queda reservado.</p>';
      if ((x.estado === 'rechazada' || x.estado === 'cancelada') && x.motivo) det = '<p class="text-[11px] text-slate-600 mt-2">Motivo: ' + E(x.motivo) + '</p>';
      if (['pendiente', 'esperando_sena', 'sena_avisada', 'confirmada'].indexOf(x.estado) >= 0) act = '<button type="button" onclick="nvResCancelarMia(\'' + x.id + '\')" class="w-full mt-1.5 py-2 rounded-xl bg-white border border-slate-200 text-slate-500 text-[11px] font-bold">Cancelar reserva</button>';
      return '<div class="rounded-2xl border border-slate-200 p-3"><p class="text-xs font-black text-slate-800">' + E(x.comercio_nombre) + '</p><p class="text-xs text-slate-600">' + E(x.espacio) + ' · ' + lindaFecha(x.fecha) + ' · ' + hhmm(x.inicio_min) + ' a ' + hhmm(x.fin_min) + (x.precio_total ? ' · ' + plata(x.precio_total) : '') + '</p><span class="inline-block mt-1 text-[10px] font-black px-2 py-0.5 rounded ' + e[1] + '">' + e[0] + '</span>' + det + act + '</div>';
    }).join('');
  };
  window.nvResCancelarMia = async function (id) {
    if (!confirm('¿Cancelar esta reserva?')) return;
    var r = await _supabase.rpc('nv_res_cliente_cancelar', { p_id: id });
    if (r.error) { alert(msgErr(r.error)); return; }
    nvResMis();
  };

  // ---------- DUEÑO
  var FILTROS = [['pend', 'Pendientes'], ['sena', 'Esperando seña'], ['ok', 'Aceptadas'], ['todas', 'Todas']];
  var filtro = 'pend';
  function enFiltro(x, f) {
    if (f === 'pend') return x.estado === 'pendiente' || x.estado === 'sena_avisada';
    if (f === 'sena') return x.estado === 'esperando_sena';
    if (f === 'ok') return x.estado === 'confirmada';
    return true;
  }
  var ETD = { pendiente: 'Pendiente', esperando_sena: 'Esperando la transferencia', sena_avisada: 'Seña avisada', confirmada: 'Aceptada', rechazada: 'Rechazada', cancelada: 'Cancelada', vencida: 'Vencida' };
  function filaSolicitud(x) {
    var b = '';
    if (x.estado === 'pendiente') b = btn(x.id, 'aceptar', 'Aceptar', 'bg-emerald-500 text-white') + btn(x.id, 'rechazar', 'Rechazar', 'bg-rose-50 border border-rose-200 text-rose-700');
    else if (x.estado === 'sena_avisada') b = btn(x.id, 'confirmar_sena', 'Confirmar seña', 'bg-emerald-500 text-white') + btn(x.id, 'no_llego', 'No llegó', 'bg-rose-50 border border-rose-200 text-rose-700');
    else if (x.estado === 'esperando_sena') b = btn(x.id, 'confirmar_sena', 'Ya me llegó la seña', 'bg-emerald-500 text-white') + btn(x.id, 'rechazar', 'Rechazar', 'bg-rose-50 border border-rose-200 text-rose-700');
    else if (x.estado === 'confirmada') b = btn(x.id, 'cancelar', 'Cancelar reserva', 'bg-white border border-slate-200 text-slate-500');
    else if (x.estado === 'vencida' && x.sena_monto != null && x.titular) b = btn(x.id, 'confirmar_sena', 'Confirmar igual (si sigue libre)', 'bg-emerald-500 text-white');
    var col = x.estado === 'confirmada' ? 'border-emerald-200 bg-emerald-50/40' : (x.estado === 'pendiente' || x.estado === 'sena_avisada' ? 'border-amber-200 bg-amber-50/50' : 'border-slate-200 bg-white');
    return '<div class="rounded-xl border ' + col + ' p-2.5"><div class="flex items-start justify-between gap-2"><p class="text-xs font-black text-slate-800 min-w-0">' + E(x.cliente_nombre) + (x.cliente_telefono ? ' · ' + E(x.cliente_telefono) : '') + '</p><span class="text-[9px] font-black text-slate-500 flex-shrink-0">' + (ETD[x.estado] || x.estado) + '</span></div>' +
      '<p class="text-[11px] text-slate-600">' + E(x.espacio) + ' · ' + lindaFecha(x.fecha) + ' · ' + hhmm(x.inicio_min) + ' a ' + hhmm(x.fin_min) + (x.sena_monto ? ' · seña ' + plata(x.sena_monto) : '') + (x.origen === 'comercio' ? ' · cargada a mano' : '') + '</p>' +
      (x.titular && x.estado !== 'confirmada' ? '<p class="text-[11px] font-bold text-emerald-700">Transfirió a nombre de: ' + E(x.titular) + '</p>' : '') +
      (x.motivo ? '<p class="text-[11px] text-slate-500">Motivo: ' + E(x.motivo) + '</p>' : '') +
      (b ? '<div class="flex gap-1.5 mt-1.5">' + b + '</div>' : '') + '</div>';
  }
  function btn(id, acc, txt, cls) { return '<button type="button" onclick="nvResResp(\'' + id + '\',\'' + acc + '\')" class="flex-1 py-2 rounded-xl text-[11px] font-black ' + cls + '">' + txt + '</button>'; }
  window.nvResFiltro = function (f) { filtro = f; pintarDueno(); };
  function agendaDueno() {
    var k = cfg(R.c), rg = rangos(R.c, deClave(R.fecha).getDay());
    if (!rg.length) return '<p class="text-xs text-slate-400 text-center mt-3">Ese día no atendés según tus horarios.</p>';
    var out = '<div class="space-y-1 mt-2">';
    rg.forEach(function (t) {
      for (var m = t.d; m + k.bloque <= t.h; m += k.bloque) {
        var fin = m + k.bloque, ini = m;
        var r = R.lista.find(function (x) { return x.espacio === R.esp && x.fecha === R.fecha && x.inicio_min < fin && x.fin_min > ini && (x.estado === 'confirmada' || x.estado === 'pendiente' || x.estado === 'sena_avisada'); });
        var cont;
        if (r && r.estado === 'confirmada') cont = '<span class="font-black text-rose-700">' + E(r.cliente_nombre) + '</span>' + (r.origen === 'comercio' ? ' <span class="text-[9px] text-slate-400">(cargada a mano)</span>' : '') + (r.inicio_min >= ini && r.inicio_min < fin ? ' <button type="button" onclick="nvResResp(\'' + r.id + '\',\'cancelar\')" class="ml-1 text-[10px] font-bold text-slate-400 underline">cancelar</button>' : '');
        else if (r) cont = '<span class="font-bold text-amber-600">En trámite: ' + E(r.cliente_nombre) + '</span>';
        else cont = '<button type="button" onclick="nvResBloquear(' + m + ')" class="text-emerald-600 font-bold">Libre · tocá para ocupar</button>';
        out += '<div class="flex items-center gap-2 text-xs rounded-lg px-2 py-1.5 ' + (r ? (r.estado === 'confirmada' ? 'bg-rose-50' : 'bg-amber-50') : 'bg-emerald-50/60') + '"><span class="w-12 font-black text-slate-600">' + hhmm(m) + '</span><span class="flex-1 min-w-0 truncate">' + cont + '</span></div>';
      }
    });
    return out + '</div>';
  }
  function pintarDueno() {
    var b = document.getElementById('cal-editor'); if (!b) return;
    var chips = FILTROS.map(function (f) {
      var n = R.lista.filter(function (x) { return enFiltro(x, f[0]) && x.estado !== 'vencida' || (f[0] === 'todas' && x.estado === 'vencida'); }).length;
      return '<button type="button" onclick="nvResFiltro(\'' + f[0] + '\')" class="flex-shrink-0 px-3 py-1.5 rounded-xl text-[11px] font-black border ' + (filtro === f[0] ? 'bg-slate-800 text-white border-slate-800' : 'bg-white text-slate-600 border-slate-200') + '">' + f[1] + (n ? ' (' + n + ')' : '') + '</button>';
    }).join('');
    var lista = R.lista.filter(function (x) { return enFiltro(x, filtro); });
    var h = '<p class="text-xs font-black uppercase tracking-wide text-slate-700 mb-1.5">Reservas</p><div class="flex gap-1.5 overflow-x-auto pb-1">' + chips + '</div>' +
      '<div class="space-y-1.5 mt-2 max-h-72 overflow-y-auto">' + (lista.length ? lista.map(filaSolicitud).join('') : '<p class="text-xs text-slate-400 text-center py-3">No hay reservas en esta lista.</p>') + '</div>';
    h += '<p class="text-xs font-black uppercase tracking-wide text-slate-700 mt-4 mb-1">Agenda</p>' + selectorEspacio() + tiraFechas() + agendaDueno() +
      '<div id="res-bloq" class="hidden mt-2 rounded-xl border border-slate-200 p-2.5 space-y-1.5"><p id="res-bloq-t" class="text-xs font-black"></p><input id="res-bloq-nombre" type="text" maxlength="80" placeholder="Nombre (ej: Marcos, por teléfono)" class="w-full clean-input px-3 py-2 rounded-xl text-xs font-semibold"><button type="button" onclick="nvResBloquearOk()" class="w-full py-2.5 rounded-xl bg-slate-800 text-white text-xs font-black">Marcar ocupado</button></div>';
    b.innerHTML = h;
  }
  window.nvResAbrirPanel = async function (c) {
    var k = cfg(c), h = hoy(), f = clave(h);
    R = { c: c, esp: k.esp[0], fecha: f, ocup: [], sel: null, box: 'cal-editor', modo: 'dueno', lista: [] }; filtro = 'pend';
    document.getElementById('cal-editor-nombre').textContent = c.nombre;
    document.getElementById('cal-editor').innerHTML = '<p class="text-xs text-slate-400">Cargando…</p>';
    abrirModal('modal-calendario');
    await cargarDia(); pintarDueno();
  };
  window.nvResResp = async function (id, accion) {
    var motivo = null;
    if (accion === 'no_llego') { if (!confirm('¿Avisarle al cliente que no llegó la seña y liberar el horario?')) return; accion = 'rechazar'; motivo = 'No llegó la seña'; }
    else if (accion === 'rechazar' || accion === 'cancelar') {
      while (true) {
        motivo = prompt('Motivo (se lo mostramos al cliente):', '');
        if (motivo === null) return;
        if (motivo.trim().length >= 3) break;
        alert('Escribí el motivo para avisarle al cliente.');
      }
    }
    var r = await _supabase.rpc('nv_res_responder', { p_id: id, p_accion: accion, p_motivo: motivo });
    if (r.error) { alert(msgErr(r.error)); }
    await cargarDia(); pintarDueno();
  };
  var _bloq = null;
  window.nvResBloquear = function (m) {
    _bloq = m; var b = document.getElementById('res-bloq'); b.classList.remove('hidden');
    document.getElementById('res-bloq-t').textContent = R.esp + ' · ' + lindaFecha(R.fecha) + ' · ' + hhmm(m) + ' a ' + hhmm(m + cfg(R.c).bloque);
    document.getElementById('res-bloq-nombre').focus();
  };
  window.nvResBloquearOk = async function () {
    if (_bloq == null) return;
    var n = document.getElementById('res-bloq-nombre').value;
    var r = await _supabase.rpc('nv_res_bloquear', { p_comercio: R.c.id, p_espacio: R.esp, p_fecha: R.fecha, p_inicio: _bloq, p_fin: _bloq + cfg(R.c).bloque, p_nombre: n });
    if (r.error) alert(msgErr(r.error));
    _bloq = null; await cargarDia(); pintarDueno();
  };
})();
