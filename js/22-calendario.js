// =====================================================================
// CALENDARIO DE TURNOS (salones de eventos, peloteros, etc.)
// - El comercio activa el calendario y elige sus turnos (mañana / mediodía / tarde / noche).
// - Lo que no está marcado como ocupado figura como disponible.
// - El cliente ve días y turnos libres. Solo el dueño edita (RPC nv_calendario_guardar_dia, SQL 12).
// =====================================================================
(function () {
  var TURNOS = { manana: '🌅 Mañana', mediodia: '☀️ Mediodía', tarde: '🌇 Tarde', noche: '🌙 Noche' };
  var ORDEN = ['manana', 'mediodia', 'tarde', 'noche'];
  var MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
  var S = { com: null, ocup: {}, mes: null, sel: null, modo: 'cliente', box: null };

  function E(t) { return (typeof esc === 'function') ? esc(t) : String(t == null ? '' : t).replace(/[&<>"']/g, function (m) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]; }); }
  function p2(n) { return (n < 10 ? '0' : '') + n; }
  function clave(d) { return d.getFullYear() + '-' + p2(d.getMonth() + 1) + '-' + p2(d.getDate()); }
  function hoy() { var d = new Date(); return new Date(d.getFullYear(), d.getMonth(), d.getDate()); }
  function turnosDe(c) {
    var t = (c && Array.isArray(c.calendario_turnos)) ? c.calendario_turnos.filter(function (x) { return TURNOS[x]; }) : ORDEN.slice();
    return t.length ? ORDEN.filter(function (x) { return t.indexOf(x) >= 0; }) : ORDEN.slice();
  }
  function fechaLinda(k) {
    var p = k.split('-'); var d = new Date(+p[0], +p[1] - 1, +p[2]);
    return ['domingo','lunes','martes','miércoles','jueves','viernes','sábado'][d.getDay()] + ' ' + d.getDate() + ' de ' + MESES[d.getMonth()].toLowerCase();
  }
  function estadoDia(k) {
    var T = turnosDe(S.com), O = S.ocup[k] || [];
    var libres = T.filter(function (t) { return O.indexOf(t) < 0; });
    return { libres: libres, total: T.length, tipo: libres.length === T.length ? 'libre' : (libres.length === 0 ? 'lleno' : 'parcial') };
  }

  async function cargar(c) {
    S.ocup = {};
    try {
      var r = await _supabase.from('nv_calendario').select('fecha,turno').eq('comercio_id', c.id).gte('fecha', clave(hoy())).limit(5000);
      if (r.error) throw r.error;
      (r.data || []).forEach(function (f) { (S.ocup[f.fecha] = S.ocup[f.fecha] || []).push(f.turno); });
      return true;
    } catch (e) { console.warn('Calendario no disponible', e); return false; }
  }

  function grilla() {
    var m = S.mes, h = hoy(), prim = new Date(m.getFullYear(), m.getMonth(), 1);
    var offset = (prim.getDay() + 6) % 7; // lunes primero
    var dias = new Date(m.getFullYear(), m.getMonth() + 1, 0).getDate();
    var puedeAtras = (m.getFullYear() * 12 + m.getMonth()) > (h.getFullYear() * 12 + h.getMonth());
    var html = '<div class="flex items-center justify-between mb-2">' +
      '<button type="button" onclick="nvCalMes(-1)" class="w-9 h-9 rounded-xl bg-slate-100 font-black text-slate-600 ' + (puedeAtras ? '' : 'opacity-30 pointer-events-none') + '">‹</button>' +
      '<p class="font-black text-sm text-slate-800">' + MESES[m.getMonth()] + ' ' + m.getFullYear() + '</p>' +
      '<button type="button" onclick="nvCalMes(1)" class="w-9 h-9 rounded-xl bg-slate-100 font-black text-slate-600">›</button></div>' +
      '<div class="grid grid-cols-7 gap-1 text-center text-[10px] font-bold text-slate-400 mb-1">' +
      ['L','M','M','J','V','S','D'].map(function (x) { return '<div>' + x + '</div>'; }).join('') + '</div>' +
      '<div class="grid grid-cols-7 gap-1">';
    for (var i = 0; i < offset; i++) html += '<div></div>';
    for (var d = 1; d <= dias; d++) {
      var f = new Date(m.getFullYear(), m.getMonth(), d), k = clave(f);
      var pasado = f < h, st = estadoDia(k), sel = S.sel === k;
      var cls = pasado ? 'bg-slate-50 text-slate-300 pointer-events-none'
        : st.tipo === 'libre' ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
        : st.tipo === 'parcial' ? 'bg-amber-100 text-amber-800 border-amber-300'
        : 'bg-rose-100 text-rose-700 border-rose-300';
      html += '<button type="button" onclick="nvCalDia(\'' + k + '\')" class="aspect-square rounded-xl border text-xs font-black flex items-center justify-center ' + cls + (sel ? ' ring-2 ring-slate-800' : '') + '">' + d + '</button>';
    }
    html += '</div><div class="flex flex-wrap gap-x-3 gap-y-1 mt-3 text-[10px] font-bold text-slate-500">' +
      '<span><i class="inline-block w-2.5 h-2.5 rounded bg-emerald-300 align-middle"></i> Libre</span>' +
      '<span><i class="inline-block w-2.5 h-2.5 rounded bg-amber-300 align-middle"></i> Algún turno libre</span>' +
      '<span><i class="inline-block w-2.5 h-2.5 rounded bg-rose-300 align-middle"></i> Ocupado</span></div>';
    return html;
  }

  function detalle() {
    if (!S.sel) return '<p class="text-[11px] text-slate-400 mt-3 text-center">' + (S.modo === 'dueno' ? 'Tocá un día para marcar qué turnos están ocupados.' : 'Tocá un día para ver los turnos disponibles.') + '</p>';
    var k = S.sel, O = S.ocup[k] || [], T = turnosDe(S.com);
    var h = '<div class="mt-3 rounded-2xl border border-slate-200 bg-slate-50 p-3"><p class="text-xs font-black text-slate-800 mb-2 capitalize">' + fechaLinda(k) + '</p><div class="grid grid-cols-2 gap-2">';
    T.forEach(function (t) {
      var oc = O.indexOf(t) >= 0;
      if (S.modo === 'dueno') {
        h += '<button type="button" onclick="nvCalTurno(\'' + t + '\')" class="py-2.5 rounded-xl border-2 text-xs font-black ' + (oc ? 'bg-rose-100 border-rose-300 text-rose-700' : 'bg-emerald-50 border-emerald-300 text-emerald-700') + '">' + TURNOS[t] + '<br><span class="font-semibold">' + (oc ? 'Ocupado' : 'Libre') + '</span></button>';
      } else {
        h += '<div class="py-2.5 rounded-xl border text-center text-xs font-black ' + (oc ? 'bg-slate-100 border-slate-200 text-slate-400 line-through' : 'bg-emerald-50 border-emerald-300 text-emerald-700') + '">' + TURNOS[t] + '<br><span class="font-semibold no-underline">' + (oc ? 'Ocupado' : 'Disponible') + '</span></div>';
      }
    });
    h += '</div>';
    if (S.modo === 'cliente') {
      var libres = T.filter(function (t) { return O.indexOf(t) < 0; });
      if (libres.length && S.com.telefono_whatsapp) h += '<button type="button" onclick="nvCalConsultar()" class="mt-3 w-full py-3 rounded-xl bg-emerald-500 text-white text-xs font-black">Consultar por esta fecha</button>';
      else if (!libres.length) h += '<p class="mt-2 text-[11px] text-slate-500 text-center">Ese día no tiene turnos libres.</p>';
    } else {
      h += '<div class="flex gap-2 mt-3"><button type="button" onclick="nvCalDiaTodo(true)" class="flex-1 py-2 rounded-xl bg-rose-50 text-rose-700 text-[11px] font-black border border-rose-200">Marcar todo ocupado</button><button type="button" onclick="nvCalDiaTodo(false)" class="flex-1 py-2 rounded-xl bg-emerald-50 text-emerald-700 text-[11px] font-black border border-emerald-200">Liberar el día</button></div>';
    }
    return h + '</div>';
  }

  function pintar() {
    if (!S.box) return;
    var b = document.getElementById(S.box); if (!b) return;
    b.innerHTML = grilla() + detalle();
  }

  window.nvCalMes = function (n) { S.mes = new Date(S.mes.getFullYear(), S.mes.getMonth() + n, 1); S.sel = null; pintar(); };
  window.nvCalDia = function (k) { S.sel = (S.sel === k ? null : k); pintar(); };

  window.nvCalConsultar = function () {
    var c = S.com, k = S.sel; if (!c || !k) return;
    var libres = turnosDe(c).filter(function (t) { return (S.ocup[k] || []).indexOf(t) < 0; }).map(function (t) { return TURNOS[t].replace(/^\S+\s/, ''); });
    var tel = String(c.telefono_whatsapp || '').replace(/\D/g, '');
    var msg = 'Hola! Vi en NecoVende que el ' + fechaLinda(k) + ' tienen disponible: ' + libres.join(', ') + '. Quería consultar por esa fecha.';
    window.open('https://wa.me/' + tel + '?text=' + encodeURIComponent(msg), '_blank');
  };

  async function guardarDia(k, ocupados) {
    var r = await _supabase.rpc('nv_calendario_guardar_dia', { p_comercio: S.com.id, p_fecha: k, p_ocupados: ocupados });
    if (r.error) { alert('No se pudo guardar el calendario. ¿Corriste el SQL 12? (' + (r.error.message || '') + ')'); return false; }
    if (ocupados.length) S.ocup[k] = ocupados.slice(); else delete S.ocup[k];
    return true;
  }
  window.nvCalTurno = async function (t) {
    var k = S.sel; if (!k) return;
    var O = (S.ocup[k] || []).slice(), i = O.indexOf(t);
    if (i >= 0) O.splice(i, 1); else O.push(t);
    if (await guardarDia(k, O)) pintar();
  };
  window.nvCalDiaTodo = async function (ocupar) {
    var k = S.sel; if (!k) return;
    if (await guardarDia(k, ocupar ? turnosDe(S.com) : [])) pintar();
  };

  // ---- Vista del cliente (dentro de la página del comercio)
  window.nvCalRenderEnComercio = async function (c, header) {
    var viejo = document.getElementById('cal-cliente-wrap'); if (viejo) viejo.remove();
    if (!c || c.calendario_activo !== true || !header) return;
    header.insertAdjacentHTML('beforeend', '<div id="cal-cliente-wrap" class="px-5 pb-5 bg-white"><div class="rounded-2xl border border-slate-200 p-4"><h3 class="text-xs font-black uppercase tracking-wide text-slate-700 mb-3">📅 Fechas disponibles</h3><div id="cal-cliente"><p class="text-xs text-slate-400">Cargando…</p></div></div></div>');
    S.com = c; S.modo = 'cliente'; S.box = 'cal-cliente'; S.sel = null;
    var d = hoy(); S.mes = new Date(d.getFullYear(), d.getMonth(), 1);
    var ok = await cargar(c);
    if (S.com !== c) return; // cambió de comercio mientras cargaba
    if (!ok) { var b = document.getElementById('cal-cliente'); if (b) b.innerHTML = '<p class="text-xs text-slate-400">El calendario no está disponible por ahora.</p>'; return; }
    pintar();
  };

  // ---- Editor del dueño
  window.nvAbrirCalendario = async function (id) {
    var c = (comerciosGlobales || []).find(function (x) { return String(x.id) === String(id); });
    if (!c || !usuarioActual || c.user_id !== usuarioActual.id) return;
    S.com = c; S.modo = 'dueno'; S.box = 'cal-editor'; S.sel = null;
    var d = hoy(); S.mes = new Date(d.getFullYear(), d.getMonth(), 1);
    document.getElementById('cal-editor-nombre').textContent = c.nombre;
    document.getElementById('cal-editor').innerHTML = '<p class="text-xs text-slate-400">Cargando…</p>';
    abrirModal('modal-calendario');
    await cargar(c);
    pintar();
  };

  // ---- Campos del formulario del comercio
  window.nvCalCargarForm = function (c) {
    var chk = document.getElementById('comercio-calendario'); if (!chk) return;
    chk.checked = !!(c && c.calendario_activo);
    var t = c ? turnosDe(c) : ORDEN;
    ORDEN.forEach(function (x) { var i = document.getElementById('cal-turno-' + x); if (i) i.checked = t.indexOf(x) >= 0; });
    nvCalToggleForm();
  };
  window.nvCalToggleForm = function () {
    var chk = document.getElementById('comercio-calendario'), box = document.getElementById('cal-turnos-form');
    if (chk && box) box.classList.toggle('hidden', !chk.checked);
  };
  // Devuelve los campos a guardar (vacío si no corresponde, para no romper si todavía no corriste el SQL 12)
  window.nvCalLeerForm = function (existente, subs) {
    var chk = document.getElementById('comercio-calendario'); if (!chk) return {};
    var activo = chk.checked;
    if (!existente && typeof flagsDeSubcategorias === 'function' && flagsDeSubcategorias(subs).calendario && !chk.dataset.tocado) activo = true;
    var tiene = existente && existente.calendario_activo !== undefined;
    if (!activo && !(tiene && existente.calendario_activo)) return {};
    var t = ORDEN.filter(function (x) { var i = document.getElementById('cal-turno-' + x); return i && i.checked; });
    if (activo && !t.length) t = ORDEN.slice();
    return { calendario_activo: activo, calendario_turnos: t };
  };
})();
