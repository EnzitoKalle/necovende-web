    function esc(t) { return escSeccion(t); }
    // Suma exactamente un mes de calendario (15/10 -> 15/11; 31/01 -> 28/02)
    function sumarUnMes(base) {
      const d = new Date(base);
      const dia = d.getDate();
      d.setMonth(d.getMonth() + 1);
      if (d.getDate() !== dia) d.setDate(0);
      return d;
    }

    // Estado del plan de pago de un comercio (null si es Gratis o todavía no tiene fecha)
    function infoVencimientoPlan(c) {
      const plan = c.plan_original || c.plan || 'gratis';
      if (plan === 'gratis' || !c.plan_vence) return null;
      const venc = new Date(c.plan_vence);
      const fecha = venc.toLocaleDateString('es-AR');
      const ms = venc.getTime() - Date.now();
      if (ms <= 0) return { vencido: true, dias: 0, nivel: 'vencido', fecha, texto: `venció el ${fecha}` };
      const dias = Math.ceil(ms / 864e5);
      const nivel = dias <= 3 ? 'urgente' : (dias <= 7 ? 'pronto' : 'ok');
      const texto = ms < 864e5 ? 'vence hoy' : (dias === 1 ? 'vence mañana' : `vence en ${dias} días`);
      return { vencido: false, dias, nivel, fecha, texto: `${texto} (${fecha})` };
    }

    function clasesNivelPlan(nivel) {
      return { ok: 'bg-emerald-50 text-emerald-700 border-emerald-200', pronto: 'bg-amber-50 text-amber-700 border-amber-200',
               urgente: 'bg-rose-50 text-rose-700 border-rose-200', vencido: 'bg-rose-100 text-rose-800 border-rose-300' }[nivel] || 'bg-slate-50 text-slate-600 border-slate-200';
    }

    // Cartel de plan por vencer (5 días o menos, o ya vencido). Se muestra al dueño al entrar.
    // El admin puede probarlo sin tocar datos agregando ?simular_vencimiento=3 a la URL.
    function mostrarAvisoPlanVence() {
      const caja = document.getElementById('aviso-plan-vence');
      if (!caja) return;
      caja.classList.add('hidden');
      if (!usuarioActual) return;

      let lista = comerciosGlobales.filter(c => c.user_id === usuarioActual.id);
      const sim = parseInt(new URLSearchParams(location.search).get('simular_vencimiento'));
      if (esAdministrador() && !isNaN(sim)) {
        lista = [{ id: 'simulado', nombre: (lista[0] && lista[0].nombre) || 'Comercio de prueba', plan_original: 'ultra',
                   plan_vence: new Date(Date.now() + sim * 864e5).toISOString(), activo: true }];
      }

      const urgentes = lista
        .map(c => ({ c, info: infoVencimientoPlan(c) }))
        .filter(x => x.info && (x.info.vencido || x.info.dias <= 5))
        .sort((a, b) => new Date(a.c.plan_vence) - new Date(b.c.plan_vence));
      if (urgentes.length === 0) return;

      const firma = urgentes.map(x => x.c.id + '@' + x.c.plan_vence).join('|');
      try { if (sessionStorage.getItem('aviso_plan_cerrado') === firma) return; } catch (e) {}

      const { c, info } = urgentes[0];
      const nombrePlan = { pro: 'Pro', ultra: 'Ultra' }[c.plan_original] || c.plan_original;
      const mas = urgentes.length > 1 ? ` (y ${urgentes.length - 1} comercio${urgentes.length > 2 ? 's' : ''} más)` : '';
      const texto = info.vencido
        ? `El plan ${nombrePlan} de <b>${esc(c.nombre)}</b> venció el ${info.fecha}. Hoy está en plan Gratis${mas}.`
        : `El plan ${nombrePlan} de <b>${esc(c.nombre)}</b> ${info.texto}${mas}.`;

      caja.innerHTML = `
        <div class="max-w-2xl mx-auto px-3 sm:px-4 pt-2">
          <div class="flex items-center gap-2 rounded-xl border px-3 py-2 shadow-md text-[11px] font-semibold ${clasesNivelPlan(info.vencido ? 'vencido' : (info.dias <= 3 ? 'urgente' : 'pronto'))}" style="background-color:#fffbeb">
            <span class="text-base leading-none">${info.vencido ? '⚠️' : '⏳'}</span>
            <p class="flex-1 min-w-0 leading-snug">${texto}</p>
            <button type="button" onclick="solicitarPlanWhatsApp('${nombrePlan}')" class="flex-shrink-0 bg-brand-500 hover:bg-brand-600 text-white font-black px-2.5 py-1.5 rounded-lg">Renovar</button>
            <button type="button" id="aviso-plan-cerrar" aria-label="Cerrar aviso" class="flex-shrink-0 text-slate-400 hover:text-slate-700 text-base leading-none px-1">✕</button>
          </div>
        </div>`;
      caja.classList.remove('hidden');
      document.getElementById('aviso-plan-cerrar').onclick = () => {
        caja.classList.add('hidden');
        try { sessionStorage.setItem('aviso_plan_cerrado', firma); } catch (e) {}
      };
    }

    // Bloque "Mi plan ..." que ve el comerciante en su panel
    function htmlPlanComercio(c) {
      const plan = c.plan_original || c.plan || 'gratis';
      const nombre = { gratis: 'Gratis', pro: 'Pro', ultra: 'Ultra' }[plan] || plan;
      const base = 'mt-1.5 text-[10px] font-bold px-2 py-1 rounded-lg border';
      if (plan === 'gratis') return `<div class="${base} ${clasesNivelPlan('x')}">Mi plan: Gratis</div>`;
      const info = infoVencimientoPlan(c);
      if (!info) {
        const msg = c.activo === true ? 'sin fecha de vencimiento cargada' : 'empieza a contar cuando se apruebe tu comercio';
        return `<div class="${base} ${clasesNivelPlan('x')}">Mi plan ${nombre} · ${msg}</div>`;
      }
      const aviso = info.vencido ? ' · hoy tu comercio está en plan Gratis' : '';
      const boton = info.nivel !== 'ok'
        ? ` <button type="button" onclick="event.stopPropagation(); solicitarPlanWhatsApp('${nombre}')" class="ml-1 underline font-black">Renovar</button>` : '';
      return `<div class="${base} ${clasesNivelPlan(info.nivel)}">Mi plan ${nombre} · ${info.texto}${aviso}${boton}</div>`;
    }

    // Formato de precios argentino: 12000 -> $12.000
    function fmtPrecio(n) {
      const v = Number(n);
      if (!isFinite(v)) return '$0';
      return '$' + v.toLocaleString('es-AR', { maximumFractionDigits: 2 });
    }
    function slugSeguro(t) { return String(t == null ? '' : t).replace(/[^a-zA-Z0-9_-]/g, ''); }

    function esAdministrador() {
      return usuarioActual && usuarioActual.email === EMAIL_ADMIN;
    }

    function solicitarPlanWhatsApp(nombrePlan) {
      const msg = `¡Hola! Quisiera solicitar o aumentar mi plan en *NecoVende* al *Plan ${nombrePlan}*. ¿Me dan información para activar mi comercio?`;
      window.open(`https://wa.me/${WHATSAPP_SOPORTE_PLANES}?text=${encodeURIComponent(msg)}`, '_blank');
    }

    function obtenerFavoritos() {
      try { return JSON.parse(localStorage.getItem('necovende_favoritos') || '[]'); } catch(e) { return []; }
    }

    function toggleFavoritoComercio(comercioId, event) {
      if (event) event.stopPropagation();
      let favs = obtenerFavoritos();
      if (favs.includes(comercioId)) {
        favs = favs.filter(id => id !== comercioId);
      } else {
        favs.push(comercioId);
      }
      localStorage.setItem('necovende_favoritos', JSON.stringify(favs));
      if (usuarioActual) {
        if (favs.includes(comercioId)) _supabase.from('favoritos_usuario').upsert({ user_id: usuarioActual.id, comercio_id: comercioId }).then(() => {});
        else _supabase.from('favoritos_usuario').delete().eq('user_id', usuarioActual.id).eq('comercio_id', comercioId).then(() => {});
      }
      aplicarFiltros();
      if (comercioActivo && comercioActivo.id === comercioId) {
        abrirVistaComercio(comercioActivo.slug || comercioActivo.id, false);
      }
    }

    function obtenerLikesUsuario() {
      try { return JSON.parse(localStorage.getItem('necovende_mis_likes') || '{}'); } catch(e) { return {}; }
    }

    async function darLikeComercio(comercioId, event) {
      if (event) event.stopPropagation();
      let misLikes = obtenerLikesUsuario();
      if (misLikes[comercioId]) {
        mostrarToast("¡Ya apoyaste a este comercio!");
        return;
      }

      const c = comerciosGlobales.find(x => x.id === comercioId);
      if (!c) return;

      
      const { data: likesNuevos, error } = await _supabase.rpc('dar_like', { p_comercio: String(comercioId) });
      const likesActuales = (typeof likesNuevos === 'number') ? likesNuevos : (c.likes_count || 0) + 1;
      
      if (!error) {
        c.likes_count = likesActuales;
        misLikes[comercioId] = true;
        localStorage.setItem('necovende_mis_likes', JSON.stringify(misLikes));
        aplicarFiltros();
        if (comercioActivo && comercioActivo.id === comercioId) {
          abrirVistaComercio(comercioActivo.slug || comercioActivo.id, false);
        }
        mostrarToast(`¡Gracias por apoyar a ${c.nombre}! 👍`);
      }
    }

    function obtenerHistorialPedidos() {
      try { return JSON.parse(localStorage.getItem('necovende_historial_pedidos') || '[]'); } catch(e) { return []; }
    }

    function guardarPedidoEnHistorial(pedidoObj) {
      let historial = obtenerHistorialPedidos();
      historial.unshift(pedidoObj);
      if (historial.length > 10) historial = historial.slice(0, 10);
      localStorage.setItem('necovende_historial_pedidos', JSON.stringify(historial));
    }

    function repetirPedidoHistorial(index) {
      const historial = obtenerHistorialPedidos();
      const pedido = historial[index];
      if (!pedido) return;

      if (modoEstrictoEnlace && String(pedido.comercioId) !== String(comercioBloqueadoId)) return;
      const comercioDestino = comerciosGlobales.find(c => c.id === pedido.comercioId);
      if (!comercioDestino) {
        alert("El comercio de este pedido ya no se encuentra disponible.");
        return;
      }

      comercioActivo = comercioDestino;
      comercioCarrito = comercioDestino;
      carrito = [...pedido.items];
      actualizarCarrito();
      cerrarModal('modal-historial');
      abrirVistaComercio(comercioDestino.slug || comercioDestino.id);
      abrirModal('modal-carrito');
    }

    function renderizarHistorialModal() {
      const container = document.getElementById('historial-lista-container');
      const historial = obtenerHistorialPedidos();
      container.innerHTML = '';

      if (historial.length === 0) {
        container.innerHTML = `<p class="text-xs text-slate-400 text-center py-6 font-semibold">No tenés pedidos recientes guardados.</p>`;
        return;
      }

      historial.forEach((ped, idx) => {
        let itemsTxt = ped.items.map(i => `${i.cantidad}x ${i.titulo}`).join(', ');
        container.innerHTML += `
          <div class="bg-slate-50 p-3.5 rounded-2xl border border-slate-200 space-y-2">
            <div class="flex justify-between items-center text-xs">
              <span class="font-black text-slate-900">${esc(ped.comercioNombre)}</span>
              <span class="text-[10px] text-slate-400 font-bold">${ped.fecha || ''}</span>
            </div>
            <p class="text-xs text-slate-600 truncate">${esc(itemsTxt)}</p>
            <div class="flex justify-between items-center pt-1">
              <span class="font-black text-brand-600 text-xs">${fmtPrecio(ped.total)}</span>
              <button onclick="repetirPedidoHistorial(${idx})" class="bg-brand-50 hover:bg-brand-100 text-brand-600 border border-brand-200 font-bold px-3 py-1.5 rounded-xl text-xs transition flex items-center gap-1 shadow-sm">
                <i data-lucide="repeat" class="w-3.5 h-3.5"></i> Repetir Pedido
              </button>
            </div>
          </div>
        `;
      });
      if (window.lucide) lucide.createIcons();
    }

    function mostrarToast(mensaje) {
      const toast = document.getElementById('toast-notificacion');
      document.getElementById('toast-mensaje-texto').innerText = mensaje;
      toast.classList.remove('hidden');
      setTimeout(() => { toast.classList.add('hidden'); }, 3500);
    }

    function actualizarRelojNecochea() {
      const ahora = new Date();
      const horas = String(ahora.getHours()).padStart(2, '0');
      const minutos = String(ahora.getMinutes()).padStart(2, '0');
      const relojEl = document.getElementById('widget-hora-actual');
      if (relojEl) relojEl.innerText = `${horas}:${minutos}`;
    }
    setInterval(actualizarRelojNecochea, 1000);

    // Clima real de Necochea (Open-Meteo, gratis y sin clave). Si falla, queda solo la hora.
    function iconoClima(codigo, esDia) {
      if (codigo === 0) return esDia ? '☀️' : '🌙';
      if (codigo === 1 || codigo === 2) return esDia ? '🌤️' : '☁️';
      if (codigo === 3) return '☁️';
      if (codigo === 45 || codigo === 48) return '🌫️';
      if (codigo >= 51 && codigo <= 57) return '🌦️';
      if (codigo >= 61 && codigo <= 67) return '🌧️';
      if (codigo >= 71 && codigo <= 77) return '❄️';
      if (codigo >= 80 && codigo <= 82) return '🌧️';
      if (codigo >= 95) return '⛈️';
      return '🌡️';
    }

    async function cargarClimaNecochea() {
      try {
        const url = 'https://api.open-meteo.com/v1/forecast?latitude=-38.5545&longitude=-58.7399&current=temperature_2m,weather_code,is_day&timezone=America%2FArgentina%2FBuenos_Aires';
        const resp = await fetch(url);
        if (!resp.ok) return;
        const datos = await resp.json();
        const c = datos && datos.current;
        if (!c || typeof c.temperature_2m !== 'number') return;
        const icono = document.getElementById('widget-clima-icono');
        const temp = document.getElementById('widget-clima-temp');
        const sep = document.getElementById('widget-clima-sep');
        if (!icono || !temp || !sep) return;
        icono.innerText = iconoClima(c.weather_code, c.is_day === 1);
        temp.innerText = `${Math.round(c.temperature_2m)}°C`;
        [icono, temp, sep].forEach(el => el.classList.remove('hidden'));
      } catch (e) { /* sin clima: se muestra solo la hora */ }
    }
    cargarClimaNecochea();
    setInterval(cargarClimaNecochea, 20 * 60 * 1000);
