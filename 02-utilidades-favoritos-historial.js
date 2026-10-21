    function esc(t) { return escSeccion(t); }
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
