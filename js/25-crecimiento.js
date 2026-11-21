/* NecoVende - Crecimiento: reseñas, "responde rápido", demora, resultados del comercio,
 * duplicar producto / precios en bloque, local completo %, números públicos, "Cómo funciona" y datos para Google.
 * Necesita sql/20-crecimiento.sql (si falta, cada parte se oculta sola en vez de romper nada).
 */
(function () {
  'use strict';
  var esc = function (t) { return typeof window.esc === 'function' ? window.esc(t) : String(t == null ? '' : t).replace(/[&<>"']/g, function (m) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]; }); };
  var money = function (n) { return typeof fmtPrecio === 'function' ? fmtPrecio(n) : '$' + Math.round(n); };
  var pill = function (cls, txt, tit) { return '<span class="text-[10px] font-black px-2 py-0.5 rounded-full border ' + cls + '"' + (tit ? ' title="' + esc(tit) + '"' : '') + '>' + txt + '</span>'; };

  /* ---------- chips de la tarjeta / ficha del comercio ---------- */
  window.nvChipsComercio = function (c, ficha) {
    if (!c) return '';
    var h = '';
    var n = Number(c.rating_cant) || 0, r = Number(c.rating_prom) || 0;
    if (n > 0) h += pill('bg-amber-50 text-amber-700 border-amber-200', '⭐ ' + r.toFixed(1).replace('.', ',') + ' (' + n + ')', 'Opiniones de clientes que recibieron su pedido');
    if (Number(c.demora_min) > 0) h += pill('bg-slate-50 text-slate-700 border-slate-200', '⏱ ~' + Number(c.demora_min) + ' min', 'Tiempo estimado de preparación');
    var rm = Number(c.resp_min);
    if (c.resp_min != null && rm >= 0 && rm <= 30) h += pill('bg-emerald-50 text-emerald-700 border-emerald-200', '⚡ Responde en ~' + Math.max(rm, 1) + ' min', 'Tiempo promedio en aceptar los pedidos');
    if (!h) return '';
    return '<div class="flex flex-wrap items-center gap-1.5' + (ficha ? ' mt-1.5' : '') + '">' + h + '</div>';
  };
  // Botón "Ver opiniones" para la ficha del comercio
  window.nvBotonOpiniones = function (c) {
    if (!c || !(Number(c.rating_cant) > 0)) return '';
    return '<button type="button" onclick="nvVerOpiniones()" class="mt-1.5 text-[11px] font-bold text-brand-600 underline">Ver opiniones</button>';
  };

  /* ---------- ventana flotante genérica ---------- */
  function ventana(titulo, cuerpo) {
    cerrarVentana();
    var d = document.createElement('div');
    d.id = 'nv-ventana';
    d.style.cssText = 'position:fixed;inset:0;z-index:80;background:rgba(15,23,42,.5);display:flex;align-items:flex-end;justify-content:center';
    d.innerHTML = '<div style="background:#fff;width:100%;max-width:520px;max-height:88vh;overflow:auto;border-radius:24px 24px 0 0;padding:20px 20px 28px" role="dialog" aria-modal="true">' +
      '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px"><h3 style="font-weight:900;font-size:16px;color:#0f172a">' + esc(titulo) + '</h3>' +
      '<button type="button" id="nv-ventana-x" aria-label="Cerrar" style="font-size:20px;color:#64748b;padding:4px 10px">✕</button></div><div id="nv-ventana-c">' + cuerpo + '</div></div>';
    d.addEventListener('click', function (e) { if (e.target === d) cerrarVentana(); });
    document.body.appendChild(d);
    document.getElementById('nv-ventana-x').onclick = cerrarVentana;
    return document.getElementById('nv-ventana-c');
  }
  function cerrarVentana() { var d = document.getElementById('nv-ventana'); if (d) d.remove(); }
  window.nvCerrarVentana = cerrarVentana;
  var estrellas = function (n) { n = Math.round(n); return '★★★★★'.slice(0, n) + '☆☆☆☆☆'.slice(0, 5 - n); };

  /* ---------- opiniones ---------- */
  window.nvVerOpiniones = async function () {
    if (typeof comercioActivo === 'undefined' || !comercioActivo) return;
    var c = comercioActivo, box = ventana('Opiniones de ' + c.nombre, '<p class="text-xs text-slate-500">Cargando…</p>');
    var r = await _supabase.rpc('nv_resenas_comercio', { p_comercio: c.id, p_limite: 30 });
    if (r.error) { box.innerHTML = '<p class="text-xs text-slate-500">No se pudieron cargar las opiniones.</p>'; return; }
    var f = r.data || [];
    box.innerHTML = '<p style="font-size:14px;font-weight:900;color:#b45309;margin-bottom:10px">⭐ ' + (Number(c.rating_prom) || 0).toFixed(1).replace('.', ',') + ' · ' + (Number(c.rating_cant) || 0) + ' opiniones</p>' +
      (f.length ? f.map(function (x) {
        return '<div style="border:1px solid #e2e8f0;border-radius:14px;padding:10px 12px;margin-bottom:8px"><div style="display:flex;justify-content:space-between;font-size:12px;font-weight:800;color:#0f172a"><span>' + esc(x.nombre || 'Cliente') + '</span><span style="color:#f59e0b">' + estrellas(x.estrellas) + '</span></div>' +
          (x.comentario ? '<p style="font-size:12px;color:#475569;margin-top:4px;line-height:1.4">' + esc(x.comentario) + '</p>' : '') +
          '<p style="font-size:10px;color:#94a3b8;margin-top:4px">' + new Date(x.creado_en).toLocaleDateString('es-AR') + '</p></div>';
      }).join('') : '<p class="text-xs text-slate-500">Todavía no hay opiniones.</p>') +
      '<p style="font-size:10px;color:#94a3b8;margin-top:8px">Solo opinan los clientes que marcaron su pedido como recibido.</p>';
  };

  // Bloque "¿Cómo te fue?" dentro del seguimiento del pedido (solo cuando ya lo recibió)
  window.nvResenaPintar = async function (p, token) {
    var box = document.getElementById('nv-resena-box'); if (!box || !p || p.estado !== 'entregado') return;
    var r = await _supabase.rpc('nv_resena_de_pedido', { p_pedido: p.id, p_token: token || null });
    if (r.error) return;                       // SQL 20 sin correr: no se muestra nada
    if (r.data) { box.innerHTML = '<div class="border border-amber-200 bg-amber-50 rounded-2xl p-3 text-xs font-bold text-amber-800">⭐ Gracias por tu opinión (' + r.data + '/5)</div>'; return; }
    var sel = 0;
    box.innerHTML = '<div class="border-2 border-amber-200 bg-amber-50/60 rounded-2xl p-4 space-y-2"><p class="text-sm font-black text-amber-900">¿Cómo te fue con este pedido?</p>' +
      '<div id="nv-estr" style="font-size:32px;letter-spacing:4px;color:#d1d5db;cursor:pointer">' + [1, 2, 3, 4, 5].map(function (i) { return '<span data-i="' + i + '">★</span>'; }).join('') + '</div>' +
      '<textarea id="nv-rs-txt" maxlength="300" rows="2" placeholder="Contanos (opcional)" class="w-full clean-input px-3 py-2 rounded-xl text-xs font-medium"></textarea>' +
      '<button type="button" id="nv-rs-ok" class="w-full py-2.5 rounded-xl bg-amber-500 text-white text-xs font-black">Enviar opinión</button></div>';
    var pinta = function () { box.querySelectorAll('#nv-estr span').forEach(function (s) { s.style.color = Number(s.dataset.i) <= sel ? '#f59e0b' : '#d1d5db'; }); };
    box.querySelectorAll('#nv-estr span').forEach(function (s) { s.onclick = function () { sel = Number(s.dataset.i); pinta(); }; });
    document.getElementById('nv-rs-ok').onclick = async function () {
      if (!sel) { alert('Elegí de 1 a 5 estrellas.'); return; }
      var b = this; b.disabled = true;
      var x = await _supabase.rpc('nv_resena_crear', { p_pedido: p.id, p_token: token || null, p_estrellas: sel, p_comentario: (document.getElementById('nv-rs-txt').value || '').trim() || null });
      if (x.error || !x.data || x.data.ok !== true) { b.disabled = false; alert((x.data && x.data.error) || 'No se pudo enviar. Probá de nuevo.'); return; }
      box.innerHTML = '<div class="border border-amber-200 bg-amber-50 rounded-2xl p-3 text-xs font-bold text-amber-800">⭐ ¡Gracias por tu opinión!</div>';
    };
  };

  /* ---------- resultados del comercio ---------- */
  window.nvResultados = async function (comercioId, dias) {
    dias = dias || 30;
    var c = (typeof comerciosGlobales !== 'undefined' ? comerciosGlobales : []).find(function (x) { return String(x.id) === String(comercioId); }) || (typeof comercioActivo !== 'undefined' ? comercioActivo : null);
    var box = ventana('📊 Resultados' + (c ? ' · ' + c.nombre : ''), '<p class="text-xs text-slate-500">Cargando…</p>');
    var r = await _supabase.rpc('nv_resumen_comercio', { p_comercio: comercioId, p_dias: dias });
    if (r.error || !r.data) { box.innerHTML = '<p class="text-xs text-slate-500">No se pudo cargar. Si es la primera vez, falta correr el SQL 20 en Supabase.</p>'; return; }
    var d = r.data;
    var tile = function (t, v) { return '<div style="border:1px solid #e2e8f0;border-radius:14px;padding:10px 12px"><p style="font-size:10px;font-weight:800;color:#64748b;text-transform:uppercase">' + t + '</p><p style="font-size:20px;font-weight:900;color:#0f172a">' + v + '</p></div>'; };
    var tabs = [7, 30, 90].map(function (n) { return '<button type="button" onclick="nvResultados(\'' + comercioId + '\',' + n + ')" style="font-size:11px;font-weight:800;padding:6px 12px;border-radius:99px;border:1px solid ' + (n === dias ? '#f97316' : '#e2e8f0') + ';background:' + (n === dias ? '#f97316' : '#fff') + ';color:' + (n === dias ? '#fff' : '#475569') + '">' + n + ' días</button>'; }).join(' ');
    var conv = d.visitas > 0 ? Math.round(100 * d.pedidos / d.visitas) : null;
    box.innerHTML = '<div style="display:flex;gap:6px;margin-bottom:12px">' + tabs + '</div>' +
      '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">' + tile('👁 Visitas', d.visitas) + tile('🧾 Pedidos', d.pedidos) + tile('✅ Entregados', d.entregados) + tile('❌ Cancelados', d.cancelados) +
      tile('💰 Ventas', money(d.ventas)) + tile('🎟 Ticket promedio', money(d.ticket)) + tile('👥 Clientes', d.clientes) + tile('📈 Pedidos / visitas', conv === null ? '—' : conv + '%') + '</div>' +
      '<h4 style="font-size:12px;font-weight:900;margin:14px 0 6px;color:#0f172a">Lo más vendido</h4>' +
      ((d.top || []).length ? d.top.map(function (t, i) { return '<div style="display:flex;justify-content:space-between;font-size:12px;padding:5px 0;border-bottom:1px solid #f1f5f9"><span>' + (i + 1) + '. ' + esc(t.titulo) + '</span><b>' + t.cant + ' u.</b></div>'; }).join('') : '<p class="text-xs text-slate-500">Todavía no hay pedidos entregados en este período.</p>') +
      '<p style="font-size:10px;color:#94a3b8;margin-top:10px">Las ventas cuentan los pedidos que el cliente marcó como recibidos.</p>';
  };

  /* ---------- duplicar producto y precios en bloque ---------- */
  window.nvDuplicarProducto = async function (id) {
    var c = typeof comercioActivo !== 'undefined' ? comercioActivo : null; if (!c) return;
    var p = (c.productos || []).find(function (x) { return String(x.id) === String(id); }); if (!p) return;
    if (!confirm('¿Duplicar "' + p.titulo + '"? Se crea una copia que después podés editar.')) return;
    var copia = Object.assign({}, p);
    ['id', 'created_at', 'creado_en', 'solicitudes_count', 'orden', 'actualizado_en'].forEach(function (k) { delete copia[k]; });
    copia.titulo = (p.titulo + ' (copia)').slice(0, 100);
    var r = await _supabase.from('productos').insert([copia]).select();
    if (r.error) { alert('No se pudo duplicar: ' + r.error.message); return; }
    if (typeof mostrarToast === 'function') mostrarToast('Producto duplicado');
    if (typeof abrirVistaComercio === 'function') await abrirVistaComercio(String(c.slug || c.id), false);
  };
  window.nvAjustePrecios = async function () {
    var c = typeof comercioActivo !== 'undefined' ? comercioActivo : null; if (!c) return;
    var prods = (c.productos || []).filter(function (p) { return !p.es_combo && Number(p.precio) > 0; });
    if (!prods.length) { alert('No hay productos con precio para ajustar.'); return; }
    var v = prompt('Ajustar TODOS los precios (' + prods.length + ' productos) en un porcentaje.\nEjemplos: 10 (sube 10%) · -5 (baja 5%)', '10');
    if (v === null) return;
    var pct = Number(String(v).replace(',', '.').replace('%', ''));
    if (!isFinite(pct) || pct === 0 || pct < -90 || pct > 300) { alert('Poné un porcentaje válido, por ejemplo 10 o -5.'); return; }
    var ej = prods[0], nuevo = function (x) { return Math.max(1, Math.round(Number(x) * (1 + pct / 100) / 10) * 10); };
    if (!confirm('Se van a ' + (pct > 0 ? 'subir' : 'bajar') + ' ' + Math.abs(pct) + '% los precios.\nEjemplo: ' + ej.titulo + ' pasa de ' + money(ej.precio) + ' a ' + money(nuevo(ej.precio)) + '.\n¿Confirmás?')) return;
    var fallos = 0;
    for (var i = 0; i < prods.length; i++) {
      var p = prods[i], upd = { precio: nuevo(p.precio) };
      if (Number(p.precio_anterior) > 0) upd.precio_anterior = nuevo(p.precio_anterior);
      var r = await _supabase.from('productos').update(upd).eq('id', p.id);
      if (r.error) fallos++;
    }
    alert(fallos ? 'Se actualizaron los precios, pero ' + fallos + ' productos fallaron.' : '¡Listo! Precios actualizados.');
    if (typeof abrirVistaComercio === 'function') await abrirVistaComercio(String(c.slug || c.id), false);
  };

  /* ---------- "Tu local está completo al X%" ---------- */
  window.nvCompletitudHtml = function (c) {
    var pasos = [
      ['logo', !!c.logo_url, 'Subí tu logo'], ['portada', !!c.portada_url, 'Agregá una foto de portada'],
      ['dir', !!(c.direccion && String(c.direccion).trim()), 'Cargá tu dirección'], ['wsp', !!(c.telefono_whatsapp && String(c.telefono_whatsapp).trim()), 'Cargá tu WhatsApp'],
      ['hor', !!c.horarios_dias && Object.keys(c.horarios_dias).length > 0, 'Cargá tus horarios'],
      ['pago', !!(c.pagos_efectivo || c.pagos_transferencia || c.pagos_qr || c.pagos_cuenta_dni || c.pagos_tarjeta), 'Elegí cómo cobrás'],
      ['prod', (c.productos || []).length >= 3 || Number(c._nprod) >= 3, 'Cargá al menos 3 productos']
    ];
    var ok = pasos.filter(function (x) { return x[1]; }).length, pct = Math.round(100 * ok / pasos.length);
    if (pct >= 100) return '';
    var falta = pasos.filter(function (x) { return !x[1]; }).map(function (x) { return x[2]; });
    return '<div class="mt-1.5"><div class="flex items-center gap-2"><div class="flex-1 h-1.5 rounded-full bg-slate-100 overflow-hidden"><div class="h-full bg-brand-500" style="width:' + pct + '%"></div></div><span class="text-[10px] font-black text-brand-600">' + pct + '%</span></div>' +
      '<p class="text-[10px] text-slate-500 leading-snug mt-0.5">Para completar tu local: ' + esc(falta.slice(0, 2).join(' · ')) + (falta.length > 2 ? ' · +' + (falta.length - 2) : '') + '</p></div>';
  };

  /* ---------- números públicos en el inicio (solo si ya son significativos) ---------- */
  async function numerosPublicos() {
    var el = document.getElementById('nv-stats-home'); if (!el) return;
    try {
      var r = await _supabase.rpc('nv_stats_publicas'); if (r.error || !r.data) return;
      var h = [];
      if (r.data.comercios >= 10) h.push('🏪 ' + r.data.comercios + ' comercios');
      if (r.data.pedidos >= 25) h.push('🧾 ' + r.data.pedidos + ' pedidos entregados');
      if (h.length) { el.textContent = h.join(' · '); el.classList.remove('hidden'); }
    } catch (e) { /* sin números */ }
  }
  window.addEventListener('load', function () { setTimeout(numerosPublicos, 1200); });

  /* ---------- Cómo funciona ---------- */
  window.nvComoFunciona = function () {
    var it = function (e, t, d) { return '<div style="display:flex;gap:10px;margin-bottom:12px"><div style="font-size:22px">' + e + '</div><div><p style="font-size:13px;font-weight:900;color:#0f172a">' + t + '</p><p style="font-size:12px;color:#475569;line-height:1.45">' + d + '</p></div></div>'; };
    ventana('¿Cómo funciona NecoVende?',
      it('🛍️', 'Pedís directo al comercio', 'Elegís los productos, hacés el pedido y el comercio lo acepta. No hay intermediarios en el medio.') +
      it('💸', 'Sin comisiones', 'Los comercios no pagan comisión por venta. Vos le pagás directamente al comercio, con el medio de pago que él ofrezca.') +
      it('📦', 'Seguís tu pedido', 'Ves en qué estado está: aceptado, en camino o listo para retirar. Cuando lo recibís, lo marcás como "Recibido".') +
      it('✨', 'Puntos en comercios Ultra', 'En los comercios que los ofrecen, sumás puntos al recibir tu pedido y los canjeás por productos.') +
      it('📅', 'Reservá turnos', 'En canchas, salones y servicios podés reservar día y horario desde la misma página.') +
      it('🏪', '¿Tenés un comercio?', 'Registrate gratis, cargá tus productos y compartí tu link o tu QR. Te avisamos de cada pedido en el momento.'));
  };

  /* ---------- Datos para Google (se agregan al abrir un local) ---------- */
  window.nvJsonLd = function (c) {
    try {
      var old = document.getElementById('nv-jsonld'); if (old) old.remove();
      if (!c || !c.nombre) return;
      var d = { '@context': 'https://schema.org', '@type': 'LocalBusiness', name: c.nombre, url: location.origin + '/?menu=' + encodeURIComponent(c.slug || c.id) };
      if (c.logo_url) d.image = c.logo_url;
      if (c.direccion) d.address = { '@type': 'PostalAddress', streetAddress: c.direccion, addressLocality: 'Necochea', addressRegion: 'Buenos Aires', addressCountry: 'AR' };
      if (c.telefono_whatsapp) d.telephone = '+' + String(c.telefono_whatsapp).replace(/\D/g, '');
      if (Number(c.rating_cant) > 0) d.aggregateRating = { '@type': 'AggregateRating', ratingValue: Number(c.rating_prom), reviewCount: Number(c.rating_cant) };
      var s = document.createElement('script'); s.type = 'application/ld+json'; s.id = 'nv-jsonld'; s.textContent = JSON.stringify(d);
      document.head.appendChild(s);
    } catch (e) { /* ok */ }
  };
})();
