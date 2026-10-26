    function mostrarLegal(tipo) {
      const t = {
        terminos: ['Términos y condiciones', 'NecoVende es un directorio que conecta clientes con comercios de Necochea y Quequén. Cada comercio es responsable de sus productos, precios, stock, horarios y entregas; los pedidos se acuerdan directamente entre cliente y comercio por WhatsApp. Los planes pagos se activan una vez confirmado el pago y vencen a los 30 días si no se renuevan, volviendo al plan Gratis. NecoVende puede desactivar comercios que incumplan estas condiciones o publiquen contenido ilegal o engañoso.'],
        privacidad: ['Política de privacidad', 'Al ingresar con Google guardamos tu nombre, email y foto para identificar tu cuenta y los comercios que administrás. Los comercios publican datos de contacto que ellos mismos cargan. Tus favoritos y pedidos se guardan en tu dispositivo. No vendemos tus datos. Podés pedir la corrección o eliminación de tus datos escribiéndonos por WhatsApp.']
      }[tipo];
      document.getElementById('legal-titulo').innerText = t[0];
      document.getElementById('legal-texto').innerText = t[1];
      abrirModal('modal-legal');
    }

    function toggleFiltroRapido(tipo) {
      if (tipo === 'abierto') filtroAbierto = !filtroAbierto;
      if (tipo === 'envio') filtroEnvio = !filtroEnvio;
      if (tipo === 'populares') ordenPopulares = !ordenPopulares;
      if (tipo === 'ofertas') {
        filtroOfertas = !filtroOfertas;
        // En modo Ofertas el buscador pasa a buscar solo entre las ofertas y promos
        document.getElementById('input-buscar').placeholder = filtroOfertas ? 'Buscar entre las ofertas...' : 'Buscar por local, empanadas, ropa, helados...';
        document.getElementById('seccion-locales').classList.toggle('hidden', filtroOfertas);
        document.getElementById('seccion-rubros').classList.toggle('hidden', filtroOfertas);
        if (filtroOfertas) document.getElementById('seccion-subcategorias').classList.add('hidden');
        else if (categoriaPrincipalSeleccionada !== 'Todas' && categoriaPrincipalSeleccionada !== 'Favoritos ❤️') document.getElementById('seccion-subcategorias').classList.remove('hidden');
      }
      const estados = { 'chip-ofertas': filtroOfertas, 'chip-abierto': filtroAbierto, 'chip-envio': filtroEnvio, 'chip-populares': ordenPopulares };
      Object.entries(estados).forEach(([id, on]) => {
        document.getElementById(id).className = 'chip-filtro whitespace-nowrap text-xs font-bold px-3.5 py-2 rounded-full border shadow-sm transition ' +
          (on ? 'bg-brand-500 text-white border-brand-500' : 'bg-white text-slate-600 border-slate-200');
      });
      aplicarFiltros();
    }

    function cambiarOrdenPrecio(valor) {
      ordenPrecio = valor === 'asc' || valor === 'desc' ? valor : '';
      aplicarFiltros();
    }

    function mostrarMasComercios() {
      limiteComercios += 12;
      renderizarComercios(ultimaListaComercios);
    }

    async function cargarEstadisticasPanel(lista) {
      const hace = d => new Date(Date.now() - d * 864e5).toISOString();
      const desde7 = hace(7), desde30 = hace(30);
      for (const c of lista) {
        const el = document.getElementById('stats-' + c.id);
        if (!el) continue;
        let vis7 = null, vis30 = null, ped7 = null, ped30 = null, solicitudes = 0, top = '';
        const contar = async (tabla, desde) => {
          const r = await _supabase.from(tabla).select('id', { count: 'exact', head: true }).eq('comercio_id', c.id).gte('creado_en', desde);
          return r.error ? null : (r.count || 0);
        };
        try {
          [vis7, vis30, ped7, ped30] = await Promise.all([
            contar('visitas_comercio', desde7), contar('visitas_comercio', desde30),
            contar('pedidos_comercio', desde7), contar('pedidos_comercio', desde30)
          ]);
          const { data } = await _supabase.from('productos').select('titulo, solicitudes_count').eq('comercio_id', c.id);
          const prods = (data || []).filter(p => (p.solicitudes_count || 0) > 0).sort((a, b) => b.solicitudes_count - a.solicitudes_count);
          solicitudes = prods.reduce((s, p) => s + p.solicitudes_count, 0);
          if (prods[0]) top = ` · Más pedido: ${escSeccion(prods[0].titulo)} (${prods[0].solicitudes_count})`;
        } catch (e) {}
        const linea7 = vis7 !== null
          ? `<div class="mt-1 inline-block bg-brand-50 border border-brand-100 text-brand-700 rounded-lg px-2.5 py-1 font-black">Esta semana: 👁 ${vis7} ${vis7 === 1 ? 'visita' : 'visitas'}${ped7 !== null ? ` · 🧾 ${ped7} ${ped7 === 1 ? 'pedido' : 'pedidos'} por WhatsApp` : ''}</div><br>`
          : '';
        const mes = `${vis30 !== null ? '30 días: 👁 ' + vis30 + (ped30 !== null ? ' · 🧾 ' + ped30 : '') + ' · ' : ''}`;
        el.innerHTML = `${linea7}${mes}👍 ${c.likes_count || 0} · 🛒 ${solicitudes} solicitudes${top}`;
      }
    }

    async function sincronizarCuenta(user) {
      try {
        const { data } = await _supabase.from('favoritos_usuario').select('comercio_id').eq('user_id', user.id);
        if (data) {
          const remotos = data.map(f => f.comercio_id);
          const union = [...new Set([...remotos, ...obtenerFavoritos()])];
          const faltan = union.filter(id => !remotos.includes(id));
          if (faltan.length) await _supabase.from('favoritos_usuario').upsert(faltan.map(id => ({ user_id: user.id, comercio_id: id })));
          localStorage.setItem('necovende_favoritos', JSON.stringify(union));
          if (comerciosGlobales.length) aplicarFiltros();
        }
      } catch (e) { console.warn('No se pudieron sincronizar favoritos:', e); }
      await restaurarCarrito();
    }

    async function restaurarCarrito() {
      if (!comerciosGlobales.length) return;
      if (carrito.length > 0) { carritoListo = true; return; }
      let guardado = null;
      try {
        if (usuarioActual) {
          const { data } = await _supabase.from('carritos_usuario').select('comercio_id, items').eq('user_id', usuarioActual.id).maybeSingle();
          if (data && Array.isArray(data.items) && data.items.length) guardado = { comercioId: data.comercio_id, items: data.items };
        }
        if (!guardado) guardado = JSON.parse(localStorage.getItem('necovende_carrito') || 'null');
      } catch (e) {}
      carritoListo = true;
      if (!guardado || !guardado.items || !guardado.items.length || carrito.length > 0) return;
      const c = comerciosGlobales.find(x => String(x.id) === String(guardado.comercioId));
      if (!c || c.activo !== true) return;
      carrito = guardado.items;
      comercioCarrito = c;
      actualizarCarrito();
    }

    function guardarCarrito() {
      if (!carritoListo) return;
      try {
        if (carrito.length && comercioCarrito) localStorage.setItem('necovende_carrito', JSON.stringify({ comercioId: comercioCarrito.id, items: carrito }));
        else localStorage.removeItem('necovende_carrito');
      } catch (e) {}
      if (!usuarioActual) return;
      clearTimeout(_tGuardarCarrito);
      _tGuardarCarrito = setTimeout(async () => {
        try {
          if (carrito.length && comercioCarrito) await _supabase.from('carritos_usuario').upsert({ user_id: usuarioActual.id, comercio_id: comercioCarrito.id, items: carrito, updated_at: new Date().toISOString() });
          else await _supabase.from('carritos_usuario').delete().eq('user_id', usuarioActual.id);
        } catch (e) {}
      }, 800);
    }

    function abrirModal(id) { 
      if (id === 'modal-historial') renderizarHistorialModal();
      document.getElementById(id).classList.remove('hidden'); 
    }
    function cerrarModal(id) {
      document.getElementById(id).classList.add('hidden');
      // Si cierra el selector de opciones sin agregar, se descarta la aclaración que había escrito en el detalle
      if (id === 'modal-sabores') notaPendienteProducto = null;
    }

    function mostrarInicio() {
      if (modoEstrictoEnlace) return;
      if (history.state && history.state.vistaComercio) { history.back(); return; }
      window.history.replaceState({}, '', window.location.pathname);
      document.getElementById('vista-comercio').classList.add('hidden');
      document.getElementById('vista-inicio').classList.remove('hidden');
      document.body.style.backgroundColor = '#f8fafc';
      comercioActivo = null;
      window.scrollTo(0, 0);
    }

    function filtrarProductosComercioActual() {
      if (!comercioActivo || !comercioActivo.productos) return;
      const q = document.getElementById('input-buscar-comercio').value.toLowerCase().trim();
      
      const esDuenio = usuarioActual && comercioActivo.user_id === usuarioActual.id;
      const colorAcentoBtn = comercioActivo.color_acento || '#f97316';

      let productosFiltrados = comercioActivo.productos;
      if (q !== '') {
        // Talles con stock de un producto, en minúscula (ej: ['s','m','xl'] o ['38','40'])
        const tallesConStock = p => {
          const st = p.stock_talles && typeof p.stock_talles === 'object' ? p.stock_talles : null;
          return (p.talles_disponibles || [])
            .filter(t => !st || !Object.prototype.hasOwnProperty.call(st, t) || Number(st[t]) > 0)
            .map(t => String(t).toLowerCase().trim());
        };
        const coincideTexto = (p, t) => p.titulo.toLowerCase().includes(t) || (p.descripcion && p.descripcion.toLowerCase().includes(t)) || (p.colores_disponibles || []).some(c => String(c).toLowerCase().includes(t));
        const tokens = q.split(/\s+/);
        productosFiltrados = productosFiltrados.filter(p => {
          const talles = tallesConStock(p);
          // Cada palabra buscada debe coincidir: o es un talle que hay con stock, o aparece en el nombre/descripción.
          // Una palabra corta que es un talle (ej "m", "xl", "42") se busca solo como talle, para no traer todo lo que la contenga.
          return tokens.every(t => {
            const esTalleDelLocal = comercioActivo.productos.some(x => (x.talles_disponibles || []).some(tt => String(tt).toLowerCase().trim() === t));
            if (esTalleDelLocal && t.length <= 3) return talles.includes(t);
            return coincideTexto(p, t) || talles.includes(t);
          });
        });
      }

      renderizarProductosComercio(productosFiltrados, esDuenio, colorAcentoBtn);
    }
