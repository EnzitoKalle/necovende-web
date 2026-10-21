    async function subirImagen(fileInput) {
      const originalFile = fileInput.files[0];
      if (!originalFile) return null;

      const compressedFile = await comprimirImagenCliente(originalFile, 800, 800, 0.8);
      const fileExt = compressedFile.name.split('.').pop();
      const fileName = `${Date.now()}_${Math.random().toString(36).substring(2)}.${fileExt}`;

      const { data, error } = await _supabase.storage.from('imagenes').upload(fileName, compressedFile);

      if (error) {
        alert('Error al subir la imagen a Supabase Storage.');
        return false;
      }

      const { data: publicData } = _supabase.storage.from('imagenes').getPublicUrl(fileName);
      return publicData.publicUrl;
    }

    async function cargarComercios() {
      // Solo trae lo necesario: el público ve activos; el dueño además los suyos; el admin todo.
      let consultaComercios = _supabase.from('comercios').select('*');
      if (!esAdministrador()) {
        consultaComercios = usuarioActual
          ? consultaComercios.or(`activo.eq.true,user_id.eq.${usuarioActual.id}`)
          : consultaComercios.eq('activo', true);
      }
      const { data: comercios, error } = await consultaComercios;

      if (error) {
        console.error("Error al cargar comercios:", error);
        return;
      }

      comerciosGlobales = comercios || [];
      const _ahora = Date.now();
      comerciosGlobales.forEach(c => {
        c.plan_original = c.plan || 'gratis';
        c.plan_vencido = false;
        if (c.plan_original !== 'gratis' && c.plan_vence && new Date(c.plan_vence).getTime() < _ahora) {
          c.plan = 'gratis';
          c.plan_vencido = true;
        }
      });
      actualizarBadgeAdmin();
      restaurarCarrito();
      renderizarCategoriasPrincipales();
      aplicarFiltros();

      const params = new URLSearchParams(window.location.search);
      const menuUrlId = params.get('menu');
      const comercioUrlId = params.get('comercio');
      if (menuUrlId) {
        modoEstrictoEnlace = true;
        const comercioMenu = comerciosGlobales.find(c => c.slug === menuUrlId || String(c.id) === String(menuUrlId));
        comercioBloqueadoId = comercioMenu ? comercioMenu.id : null;
        ['btn-header-planes', 'btn-sumar-comercio', 'btn-volver-comercios', 'btn-historial']
          .forEach(id => document.getElementById(id)?.classList.add('hidden'));
        if (comercioMenu) abrirVistaComercio(menuUrlId, false);
        else mostrarCatalogoNoDisponible();
      } else if (comercioUrlId) {
        abrirVistaComercio(comercioUrlId, false);
      }
    }

    // RENDERIZADO DE LAS TARJETAS DE CATEGORÍAS PRINCIPALES EN EL INICIO
    // Abre un comercio desde el listado; si está cerrado pide confirmación antes de entrar.
    let comercioCerradoPendiente = null;
    function intentarAbrirComercio(identificador, prodId = null) {
      const c = comerciosGlobales.find(x => x.slug === identificador || String(x.id) === String(identificador));
      const esDuenioOAdmin = c && usuarioActual && (c.user_id === usuarioActual.id || esAdministrador());
      if (c && !estaAbierto(c) && !esDuenioOAdmin) {
        comercioCerradoPendiente = { identificador, prodId };
        document.getElementById('cerrado-nombre').innerText = c.nombre;
        const hoy = obtenerHorarioHoyTexto(c);
        document.getElementById('cerrado-horario').innerText = !c.horarios_dias ? '' : (hoy === 'Cerrado hoy' ? 'Hoy el local no atiende.' : `Horario de hoy: ${hoy}`);
        abrirModal('modal-comercio-cerrado');
        if (window.lucide) lucide.createIcons();
        return;
      }
      abrirVistaComercio(identificador);
      if (prodId) setTimeout(() => abrirVerProducto(prodId), 300);
    }

    function confirmarIngresoComercioCerrado() {
      const pendiente = comercioCerradoPendiente;
      comercioCerradoPendiente = null;
      cerrarModal('modal-comercio-cerrado');
      if (!pendiente) return;
      abrirVistaComercio(pendiente.identificador);
      if (pendiente.prodId) setTimeout(() => abrirVerProducto(pendiente.prodId), 300);
    }

    function renderizarCategoriasPrincipales() {
      const grid = document.getElementById('grid-categorias-principales');
      grid.innerHTML = `
        <button onclick="seleccionarCategoriaPrincipal('Todas')" class="clean-card rounded-2xl p-3.5 text-left transition hover:border-brand-500 group flex items-center gap-3 bg-gradient-to-r from-brand-500 to-amber-500 text-white shadow-md">
          <div class="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center font-bold text-lg">✨</div>
          <div>
            <h4 class="font-black text-xs">Todos</h4>
            <p class="text-[10px] opacity-90">Ver marketplace</p>
          </div>
        </button>
      `;

      Object.keys(CATEGORIAS_JERARQUICAS).forEach(catPrincipal => {
        const isSelected = categoriaPrincipalSeleccionada === catPrincipal;
        const icono = catPrincipal.includes('Gastronomía') ? '🍔' : (catPrincipal.includes('Moda') ? '👗' : (catPrincipal.includes('Hogar') ? '🏠' : '⚡'));
        
        grid.innerHTML += `
          <button onclick="seleccionarCategoriaPrincipal('${catPrincipal}')" class="clean-card rounded-2xl p-3.5 text-left transition hover:border-brand-300 group flex items-center gap-3 bg-white shadow-sm">
            <div class="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center text-lg group-hover:scale-105 transition">${icono}</div>
            <div class="truncate">
              <h4 class="font-black text-xs text-slate-900 truncate">${catPrincipal}</h4>
              <p class="text-[10px] text-slate-400">Ver variantes</p>
            </div>
          </button>
        `;
      });

      if (window.lucide) lucide.createIcons();
    }

    function seleccionarCategoriaPrincipal(catPrincipal) {
      categoriaPrincipalSeleccionada = catPrincipal;
      subcategoriaSeleccionada = 'Todas';
      document.getElementById('categoria-activa').innerText = catPrincipal;

      const seccionSub = document.getElementById('seccion-subcategorias');
      const barSub = document.getElementById('bar-subcategorias-filtros');
      const lblCatActiva = document.getElementById('lbl-cat-principal-activa');

      if (catPrincipal === 'Todas') {
        seccionSub.classList.add('hidden');
      } else {
        seccionSub.classList.remove('hidden');
        lblCatActiva.innerText = catPrincipal;
        const subcats = CATEGORIAS_JERARQUICAS[catPrincipal] || [];
        
        barSub.innerHTML = `
          <button onclick="seleccionarSubcategoria('Todas', this)" class="btn-subcat bg-brand-500 text-white font-bold px-3 py-1.5 rounded-xl whitespace-nowrap shadow-sm">
            Todas de ${catPrincipal}
          </button>
        `;

        subcats.forEach(sub => {
          barSub.innerHTML += `
            <button onclick="seleccionarSubcategoria('${sub}', this)" class="btn-subcat clean-card text-slate-600 px-3 py-1.5 rounded-xl whitespace-nowrap transition hover:border-brand-300 shadow-sm">
              ${sub}
            </button>
          `;
        });
      }

      aplicarFiltros();
    }

    function seleccionarSubcategoria(subcat, elemento) {
      subcategoriaSeleccionada = subcat;
      document.getElementById('categoria-activa').innerText = subcat;

      document.querySelectorAll('.btn-subcat').forEach(b => {
        b.className = 'btn-subcat clean-card text-slate-600 px-3 py-1.5 rounded-xl whitespace-nowrap transition hover:border-brand-300 shadow-sm';
      });
      elemento.className = 'btn-subcat bg-brand-500 text-white font-bold px-3 py-1.5 rounded-xl whitespace-nowrap shadow-sm';

      aplicarFiltros();
    }

    function reiniciarFiltroCategorias() {
      seleccionarCategoriaPrincipal('Todas');
    }

    function renderizarComercios(lista) {
      const container = document.getElementById('comercios-container');
      const counter = document.getElementById('total-comercios');
      ultimaListaComercios = lista;
      container.innerHTML = '';

      const listaActivos = lista.filter(c => c.activo === true);

      counter.innerText = `${listaActivos.length} locales encontrados`;

      if (listaActivos.length === 0) {
        container.innerHTML = `
          <div class="p-10 clean-card rounded-3xl text-center space-y-3">
            <div class="w-12 h-12 bg-slate-100 text-slate-400 rounded-2xl flex items-center justify-center mx-auto border border-slate-200">
              <i data-lucide="store-off" class="w-6 h-6"></i>
            </div>
            <p class="text-xs font-semibold text-slate-500">No hay comercios registrados en esta categoría.</p>
          </div>
        `;
        if (window.lucide) lucide.createIcons();
        return;
      }

      let huboAbiertos = false, separadorCerradosPuesto = false;
      listaActivos.slice(0, limiteComercios).forEach(c => {
        const abierto = estaAbierto(c);
        if (abierto) huboAbiertos = true;
        if (!abierto && huboAbiertos && !separadorCerradosPuesto) {
          separadorCerradosPuesto = true;
          container.innerHTML += `<div class="flex items-center gap-3 px-1 pt-2"><span class="h-px flex-1 bg-slate-200"></span><span class="text-[10px] font-black uppercase tracking-widest text-slate-400">🔴 Cerrados ahora</span><span class="h-px flex-1 bg-slate-200"></span></div>`;
        }
        const identificador = slugSeguro(c.slug || c.id);
        const esFav = obtenerFavoritos().includes(c.id);
        const likesCount = c.likes_count || 0;

        const plan = c.plan || 'gratis';
        const esUltra = plan === 'ultra';
        const esPro = plan === 'pro';

        let insigniaTilde = '';
        if (esUltra) {
          insigniaTilde = `<span class="inline-flex items-center justify-center w-4 h-4 rounded-full bg-amber-400 text-white shadow-sm flex-shrink-0" title="Perfil Verificado Ultra"><i data-lucide="check" class="w-3 h-3 stroke-[3]"></i></span>`;
        } else if (esPro) {
          insigniaTilde = `<span class="inline-flex items-center justify-center w-4 h-4 rounded-full bg-sky-500 text-white shadow-sm flex-shrink-0" title="Perfil Verificado Pro"><i data-lucide="check" class="w-3 h-3 stroke-[3]"></i></span>`;
        }

        const listaCats = c.subcategorias && c.subcategorias.length > 0 
          ? c.subcategorias 
          : (c.categorias || [c.categoria || 'General']);

        const catPrincipal = listaCats[0];
        const catMasCount = listaCats.length > 1 ? ` +${listaCats.length - 1}` : '';

        let iconoEnvioHtml = '';
        if (c.envio_gratis) {
          iconoEnvioHtml = `<span class="inline-flex items-center text-emerald-600 bg-emerald-50 border border-emerald-200 p-1 rounded-lg" title="¡Envío Gratis!"><i data-lucide="truck" class="w-3.5 h-3.5"></i></span>`;
        } else if (c.hace_envios) {
          iconoEnvioHtml = `<span class="inline-flex items-center text-slate-500 bg-slate-100 border border-slate-200 p-1 rounded-lg" title="Envíos a domicilio"><i data-lucide="truck" class="w-3.5 h-3.5"></i></span>`;
        }

        container.innerHTML += `
          <div class="clean-card rounded-3xl p-4 sm:p-5 hover:shadow-lg transition duration-200 space-y-3.5 group relative bg-white">
            
            <div class="flex items-start justify-between gap-3">
              <div class="flex items-start gap-3.5 min-w-0 flex-1 cursor-pointer" onclick="intentarAbrirComercio('${identificador}')">
                ${c.logo_url 
                  ? `<img src="${esc(c.logo_url)}" class="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl object-cover border border-slate-100 shadow-md flex-shrink-0 group-hover:scale-105 transition duration-300">`
                  : `<div class="w-20 h-20 sm:w-24 sm:h-24 bg-slate-100 rounded-2xl border border-slate-200 flex items-center justify-center text-brand-600 font-black text-2xl group-hover:border-brand-300 transition flex-shrink-0">
                      ${esc(c.nombre.charAt(0).toUpperCase())}
                    </div>`
                }
                
                <div class="min-w-0 flex-1 pt-1">
                  <div class="flex items-center gap-1.5 flex-wrap">
                    <h4 class="font-black text-slate-900 text-base sm:text-lg tracking-tight leading-snug group-hover:text-brand-600 transition truncate">${esc(c.nombre)}</h4>
                    ${insigniaTilde}
                  </div>
                  
                  <div class="mt-2">
                    <span class="text-[9px] font-black px-2.5 py-1 rounded-full border shadow-sm ${abierto ? 'bg-emerald-50 text-emerald-600 border-emerald-200' : 'bg-slate-100 text-slate-500 border-slate-200'}">
                      ${abierto ? '🟢 ABIERTO' : '🔴 CERRADO'}
                    </span>
                  </div>
                </div>
              </div>

              <button onclick="toggleFavoritoComercio('${c.id}', event)" class="bg-slate-50 hover:bg-slate-100 p-2 rounded-full border border-slate-200 shadow-sm transition flex-shrink-0">
                <i data-lucide="heart" class="w-4 h-4 ${esFav ? 'fill-rose-500 text-rose-500' : 'text-slate-400'}"></i>
              </button>
            </div>

            <div class="pt-2.5 border-t border-slate-100 flex items-center justify-between gap-2 text-xs text-slate-500">
              <div class="flex items-center gap-2 min-w-0 flex-1 truncate">
                <button onclick="darLikeComercio('${c.id}', event)" class="bg-amber-50 hover:bg-amber-100 border border-amber-200 text-amber-700 px-2 py-0.5 rounded-lg text-[11px] font-black transition flex items-center gap-1 shadow-sm active:scale-95 flex-shrink-0">
                  👍 ${likesCount}
                </button>

                ${iconoEnvioHtml}

                <span class="text-[10px] font-bold bg-slate-100 text-slate-600 px-2.5 py-0.5 rounded-md border border-slate-200 truncate flex-shrink min-w-0">${esc(catPrincipal)}${catMasCount}</span>
              </div>

              <button onclick="intentarAbrirComercio('${identificador}')" class="font-extrabold text-brand-600 flex-shrink-0 bg-brand-50 hover:bg-brand-100 px-3.5 py-2 rounded-xl border border-brand-200 transition text-xs shadow-sm">
                Ingresar al Menú
              </button>
            </div>
          </div>
        `;
      });
      if (listaActivos.length > limiteComercios) {
        container.innerHTML += `<button type="button" onclick="mostrarMasComercios()" class="clean-card rounded-2xl py-3.5 text-xs font-black text-brand-600 hover:bg-brand-50 transition">Mostrar más locales (${listaActivos.length - limiteComercios} restantes)</button>`;
      }

      if (window.lucide) lucide.createIcons();
    }

    function aplicarFiltros() {
      limiteComercios = 12;
      const texto = document.getElementById('input-buscar').value.toLowerCase().trim();
      let resultado = [...comerciosGlobales];

      if (categoriaPrincipalSeleccionada === 'Favoritos ❤️') {
        const favs = obtenerFavoritos();
        resultado = resultado.filter(c => favs.includes(c.id));
      } else if (categoriaPrincipalSeleccionada !== 'Todas') {
        if (subcategoriaSeleccionada !== 'Todas') {
          resultado = resultado.filter(c => {
            const subs = c.subcategorias || c.categorias || [c.categoria];
            return subs.includes(subcategoriaSeleccionada);
          });
        } else {
          resultado = resultado.filter(c => {
            const subsComercio = c.subcategorias || c.categorias || [c.categoria];
            const posiblesSubsMacro = CATEGORIAS_JERARQUICAS[categoriaPrincipalSeleccionada] || [];
            return subsComercio.some(sub => posiblesSubsMacro.includes(sub) || c.categoria_principal === categoriaPrincipalSeleccionada);
          });
        }
      }

      if (texto !== '') {
        resultado = resultado.filter(c => 
          c.nombre.toLowerCase().includes(texto) || 
          (c.direccion && c.direccion.toLowerCase().includes(texto)) ||
          (c.subcategorias && c.subcategorias.some(cat => cat.toLowerCase().includes(texto))) ||
          (c.categorias && c.categorias.some(cat => cat.toLowerCase().includes(texto))) ||
          (c.categoria && c.categoria.toLowerCase().includes(texto))
        );
      }

      if (filtroAbierto) resultado = resultado.filter(c => estaAbierto(c));
      if (filtroEnvio) resultado = resultado.filter(c => c.envio_gratis);
      if (ordenPopulares) resultado.sort((a, b) => (b.likes_count || 0) - (a.likes_count || 0));
      else resultado.sort((a, b) => {
        const planPesa = { 'ultra': 3, 'pro': 2, 'gratis': 1 };
        const pesoA = planPesa[a.plan || 'gratis'] || 1;
        const pesoB = planPesa[b.plan || 'gratis'] || 1;
        if (pesoA !== pesoB) return pesoB - pesoA;

        const abiertoA = estaAbierto(a) ? 1 : 0;
        const abiertoB = estaAbierto(b) ? 1 : 0;
        if (abiertoA !== abiertoB) return abiertoB - abiertoA;

        const likesA = a.likes_count || 0;
        const likesB = b.likes_count || 0;
        return likesB - likesA;
      });

      // Los comercios cerrados van siempre al final (siguen apareciendo al buscarlos)
      resultado = [...resultado.filter(c => estaAbierto(c)), ...resultado.filter(c => !estaAbierto(c))];

      renderizarComercios(resultado);

      clearTimeout(timeoutBusquedaGlobal);
      if (texto.length >= 2) {
        timeoutBusquedaGlobal = setTimeout(() => buscarProductosGlobales(texto), 300);
      } else {
        document.getElementById('seccion-resultados-productos').classList.add('hidden');
      }
    }

    async function buscarProductosGlobales(query) {
      const { data: productos, error } = await _supabase
        .from('productos')
        .select('*, comercios(nombre, slug, logo_url, activo)')
        .ilike('titulo', `%${query}%`)
        .eq('disponible', true)
        .limit(10);

      const secProds = document.getElementById('seccion-resultados-productos');
      const container = document.getElementById('container-productos-busqueda');
      const counter = document.getElementById('total-prods-busqueda');

      const productosValidos = (productos || []).filter(p => p.comercios && p.comercios.activo === true && !promoVencida(p));

      if (error || productosValidos.length === 0) {
        secProds.classList.add('hidden');
        return;
      }

      secProds.classList.remove('hidden');
      counter.innerText = `${productosValidos.length} productos`;
      container.innerHTML = '';

      productosValidos.forEach(p => {
        const nomComercio = p.comercios?.nombre || 'Local';
        const slugComercio = slugSeguro(p.comercios?.slug || p.comercio_id);

        container.innerHTML += `
          <div onclick="intentarAbrirComercio('${slugComercio}', '${p.id}')" class="clean-card rounded-2xl p-3.5 flex items-center justify-between gap-3 cursor-pointer hover:border-brand-300 transition">
            <div class="flex items-center gap-3 min-w-0 flex-1">
              ${p.imagen_url 
                ? `<img src="${esc(p.imagen_url)}" class="w-14 h-14 rounded-xl object-cover border border-slate-200 flex-shrink-0">` 
                : `<div class="w-14 h-14 bg-slate-100 rounded-xl flex items-center justify-center text-slate-400 flex-shrink-0 border border-slate-200"><i data-lucide="package" class="w-6 h-6"></i></div>`}
              <div class="min-w-0 flex-1">
                <h4 class="font-black text-slate-900 text-sm truncate">${esc(p.titulo)}</h4>
                <p class="text-[11px] text-slate-500 truncate">Vendido por: <strong class="text-brand-600">${esc(nomComercio)}</strong></p>
                <p class="text-sm font-black text-brand-600 mt-0.5">${fmtPrecio(p.precio)}</p>
              </div>
            </div>
            <button class="bg-brand-50 text-brand-600 hover:bg-brand-500 hover:text-white px-3 py-2 rounded-xl text-xs font-bold transition flex-shrink-0 border border-brand-200">
              Ver Local
            </button>
          </div>
        `;
      });

      if (window.lucide) lucide.createIcons();
    }
