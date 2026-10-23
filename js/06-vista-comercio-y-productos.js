    function obtenerIconoSVGRed(tipo) {
      if (tipo === 'instagram') {
        return `<svg class="w-4 h-4 fill-current" viewBox="0 0 24 24"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/></svg>`;
      }
      if (tipo === 'facebook') {
        return `<svg class="w-4 h-4 fill-current" viewBox="0 0 24 24"><path d="M9 8H6v4h3v12h5V12h3.642L18 8h-4V6.333C14 5.374 14.5 5 15.5 5H18V0h-3.808C10.592 0 9 1.583 9 4.615V8z"/></svg>`;
      }
      if (tipo === 'whatsapp') {
        return `<svg class="w-4 h-4 fill-current" viewBox="0 0 24 24"><path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946.003-6.556 5.338-11.891 11.893-11.891 3.181.001 6.167 1.24 8.413 3.488 2.245 2.248 3.481 5.236 3.48 8.414-.003 6.557-5.338 11.892-11.893 11.892-1.99-.001-3.951-.5-5.688-1.448l-6.305 1.654zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884-.001 2.225.651 3.891 1.746 5.634l-.999 3.648 3.742-.981zm11.387-5.464c-.074-.124-.272-.198-.57-.347-.297-.149-1.758-.868-2.031-.967-.272-.099-.47-.149-.669.149-.198.297-.768.967-.941 1.165-.173.198-.347.223-.644.074-.297-.149-1.255-.462-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.521.151-.172.2-.296.3-.495.099-.198.05-.372-.025-.521-.075-.148-.669-1.611-.916-2.206-.242-.579-.487-.501-.669-.51l-.57-.01c-.198 0-.52.074-.792.372s-1.04 1.016-1.04 2.479 1.065 2.876 1.213 3.074c.149.198 2.095 3.2 5.076 4.487.709.306 1.263.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.695.248-1.29.173-1.414z"/></svg>`;
      }
      return `<svg class="w-4 h-4 stroke-current fill-none" stroke-width="2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/><path d="M2 12h20"/></svg>`;
    }

    function generarBotonesRedesSociales(redesArr, plan) {
      if (plan === 'gratis') return '';
      if (!redesArr || !Array.isArray(redesArr) || redesArr.length === 0) return '';
      
      let limiteLinks = (plan === 'pro') ? 1 : 3;
      let redesFiltradas = redesArr.slice(0, limiteLinks);

      let html = `<div class="flex items-center gap-2 flex-wrap pt-1">`;
      
      redesFiltradas.forEach(item => {
        if (!item || !item.url) return;
        let urlFinal = item.url.startsWith('http') ? item.url : `https://${item.url}`;
        let claseColor = 'btn-net-web';
        let nombreRed = 'Sitio Web';

        if (item.tipo === 'instagram') {
          claseColor = 'btn-net-instagram';
          nombreRed = 'Instagram';
        } else if (item.tipo === 'facebook') {
          claseColor = 'btn-net-facebook';
          nombreRed = 'Facebook';
        } else if (item.tipo === 'whatsapp') {
          claseColor = 'btn-net-whatsapp';
          nombreRed = 'WhatsApp';
        }

        const iconSvg = obtenerIconoSVGRed(item.tipo);

        html += `
          <a href="${esc(urlFinal)}" target="_blank" rel="noopener noreferrer" class="${claseColor} text-xs font-bold px-3.5 py-2 rounded-xl transition flex items-center gap-2 shadow-sm active:scale-95">
            ${iconSvg} <span>${nombreRed}</span>
          </a>
        `;
      });

      html += `</div>`;
      return html;
    }

    function mostrarCatalogoNoDisponible() {
      document.getElementById('vista-inicio').classList.add('hidden');
      document.getElementById('vista-comercio').classList.remove('hidden');
      document.getElementById('detalle-comercio-header').innerHTML = '<div class="p-10 text-center space-y-2"><p class="text-sm font-black text-slate-800">Este cat\u00e1logo no est\u00e1 disponible</p><p class="text-xs text-slate-500">Puede que el comercio est\u00e9 pausado o que el link no sea correcto.</p></div>';
      document.getElementById('productos-container').innerHTML = '';
    }

    async function abrirVistaComercio(identificador, cambiarUrl = true) {
      const objetivo = comerciosGlobales.find(c => c.slug === identificador || String(c.id) === String(identificador));
      if (!objetivo) return;
      if (modoEstrictoEnlace && comercioBloqueadoId && String(objetivo.id) !== String(comercioBloqueadoId)) return;
      if (objetivo.activo !== true && !(usuarioActual && (objetivo.user_id === usuarioActual.id || esAdministrador()))) {
        if (modoEstrictoEnlace) mostrarCatalogoNoDisponible();
        else alert('Este comercio no est\u00e1 disponible por el momento.');
        return;
      }
      comercioActivo = objetivo;

      const slugOId = comercioActivo.slug || comercioActivo.id;
      if (cambiarUrl) window.history.pushState({ vistaComercio: true }, '', `${window.location.pathname}?comercio=${slugOId}`);

      const { data: prods } = await _supabase
        .from('productos')
        .select('*')
        .eq('comercio_id', comercioActivo.id)
        .order('orden', { ascending: true });

      comercioActivo.productos = prods || [];
      try {
        const _esDuenioVisita = usuarioActual && comercioActivo.user_id === usuarioActual.id;
        const _kVis = 'necovende_vis_' + comercioActivo.id;
        if (!_esDuenioVisita && !sessionStorage.getItem(_kVis)) {
          sessionStorage.setItem(_kVis, '1');
          _supabase.from('visitas_comercio').insert({ comercio_id: comercioActivo.id }).then(() => {});
        }
      } catch (e) {}

      const inputSearchComercio = document.getElementById('input-buscar-comercio');
      if (inputSearchComercio) inputSearchComercio.value = '';

      const esDuenio = usuarioActual && comercioActivo.user_id === usuarioActual.id;
      const abierto = estaAbierto(comercioActivo);
      const esFav = obtenerFavoritos().includes(comercioActivo.id);
      const likesCount = comercioActivo.likes_count || 0;
      const ofreceEnvios = Boolean(comercioActivo.hace_envios || comercioActivo.envio_gratis);

      const plan = comercioActivo.plan || 'gratis';
      const esUltra = plan === 'ultra';
      const esPro = plan === 'pro';

      let insigniaVerificado = '';
      if (esUltra) insigniaVerificado = '<span class="inline-flex items-center gap-1 bg-amber-50 text-amber-700 border border-amber-200 text-[10px] font-black px-2.5 py-0.5 rounded-full shadow-sm">✓✓ Comercio Verificado Ultra</span>';
      else if (esPro) insigniaVerificado = '<span class="inline-flex items-center gap-1 bg-sky-50 text-sky-700 border border-sky-200 text-[10px] font-black px-2.5 py-0.5 rounded-full shadow-sm">✓ Comercio Verificado Pro</span>';

      const pagos = [];
      if (comercioActivo.pagos_efectivo) pagos.push('Efectivo');
      if (comercioActivo.pagos_transferencia) pagos.push('Transferencia');
      if (comercioActivo.pagos_qr) pagos.push('MercadoPago / QR');
      if (comercioActivo.pagos_cuenta_dni) pagos.push('Cuenta DNI');
      if (comercioActivo.pagos_tarjeta) pagos.push('Tarjeta Débito/Crédito');

      const listaCats = comercioActivo.subcategorias && comercioActivo.subcategorias.length > 0 
        ? comercioActivo.subcategorias 
        : (comercioActivo.categorias || [comercioActivo.categoria || 'General']);

      const colorFondo = esUltra ? (comercioActivo.color_primario || '#f8fafc') : '#f8fafc';
      document.body.style.backgroundColor = colorFondo;
      const colorAcentoBtn = esUltra ? (comercioActivo.color_acento || '#f97316') : '#f97316';
      const posPortada = (esUltra && ['object-center', 'object-top', 'object-bottom'].includes(comercioActivo.posicion_portada)) ? comercioActivo.posicion_portada : 'object-center';
      const direccionLocalEsc = (comercioActivo.direccion || 'Necochea').replace(/'/g, "\\'");

      const redesHtml = generarBotonesRedesSociales(comercioActivo.redes_sociales, plan);

      let horariosHtml = `
        <div class="flex items-center justify-between">
          <span class="font-bold text-slate-400 flex items-center gap-2"><i data-lucide="clock" class="w-4 h-4 text-brand-500"></i> Horario:</span>
          <span class="font-semibold text-slate-700">${esc(obtenerHorarioHoyTexto(comercioActivo))}</span>
        </div>
      `;

      const header = document.getElementById('detalle-comercio-header');
      header.innerHTML = `
        ${(esUltra && comercioActivo.portada_url) ? `
          <div class="h-44 sm:h-60 w-full relative overflow-hidden bg-slate-100">
            <img src="${esc(comercioActivo.portada_url)}" class="w-full h-full ${posPortada} object-cover">
            <div class="absolute inset-0 bg-gradient-to-t from-slate-900/60 via-slate-900/10 to-transparent"></div>
          </div>
        ` : ''}

        <div class="p-5 sm:p-6 space-y-3.5 relative bg-white ${(esUltra && comercioActivo.portada_url) ? '-mt-8 sm:-mt-12 z-10 pt-2 rounded-3xl' : ''}">
          
          <div class="flex items-start justify-between gap-3">
            <div class="flex items-start gap-4 min-w-0 flex-1">
              ${comercioActivo.logo_url 
                ? `<img src="${esc(comercioActivo.logo_url)}" class="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl object-cover border-2 border-white shadow-md flex-shrink-0">`
                : `<div class="w-20 h-20 sm:w-24 sm:h-24 bg-slate-100 rounded-2xl border-2 border-white flex items-center justify-center font-black text-3xl sm:text-4xl flex-shrink-0 shadow-md text-brand-600">${esc(comercioActivo.nombre.charAt(0).toUpperCase())}</div>`
              }
              
              <div class="min-w-0 flex-1">
                <div class="flex items-center gap-2 flex-wrap">
                  <h2 class="text-xl sm:text-2xl font-black text-slate-900 leading-tight">${esc(comercioActivo.nombre)}</h2>
                </div>
                
                ${insigniaVerificado ? `<div class="mt-1">${insigniaVerificado}</div>` : ''}

                <div class="flex items-center gap-1.5 mt-2 flex-wrap">
                  ${listaCats.map(cat => `<span class="text-[10px] font-bold bg-slate-100 text-slate-600 px-2.5 py-0.5 rounded-md border border-slate-200">${esc(cat)}</span>`).join('')}
                </div>
              </div>
            </div>

            <div class="flex items-center gap-1.5 flex-shrink-0">
              <span class="text-[9px] font-black px-2.5 py-0.5 rounded-full border shadow-sm ${abierto ? 'bg-emerald-50 text-emerald-600 border-emerald-200' : 'bg-slate-100 text-slate-500 border-slate-200'}">
                ${abierto ? '🟢 ABIERTO' : '🔴 CERRADO'}
              </span>
              ${esDuenio ? `
                <button onclick="prepararModalEditarComercio('${comercioActivo.id}')" class="bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-700 p-1.5 rounded-xl transition flex items-center shadow-sm" title="Editar Local">
                  <i data-lucide="edit-3" class="w-4 h-4 text-brand-500"></i>
                </button>
              ` : ''}
            </div>
          </div>

          <div class="flex items-center justify-between gap-2 border-t border-slate-100 pt-2.5">
            <span class="text-xs text-slate-600 flex items-center gap-1.5 truncate cursor-pointer hover:text-brand-600 transition" data-dir="${esc(comercioActivo.direccion || 'Necochea')}" onclick="abrirMapaDireccion(this.dataset.dir)">
              <i data-lucide="map-pin" class="w-3.5 h-3.5 text-brand-500 flex-shrink-0"></i> 
              <span class="truncate underline decoration-dotted">${esc(comercioActivo.direccion || 'Necochea / Quequén')}</span>
            </span>

            <div class="flex items-center gap-2 flex-shrink-0">
              <button onclick="darLikeComercio('${comercioActivo.id}')" class="bg-amber-50 hover:bg-amber-100 border border-amber-200 text-amber-700 px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1 shadow-sm active:scale-95">
                👍 ${likesCount}
              </button>
              <button onclick="toggleFavoritoComercio('${comercioActivo.id}')" class="bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-600 p-2 rounded-xl text-xs font-bold transition flex items-center shadow-sm active:scale-95">
                <i data-lucide="heart" class="w-4 h-4 ${esFav ? 'fill-rose-500 text-rose-500' : ''}"></i>
              </button>
            </div>
          </div>

          ${redesHtml ? `<div class="pt-1">${redesHtml}</div>` : ''}

          <div class="pt-2.5 border-t border-slate-100 space-y-2 text-xs text-slate-600">
            ${horariosHtml}

            ${ofreceEnvios ? `
              <div class="flex items-center justify-between">
                <span class="font-bold text-slate-400 flex items-center gap-2"><i data-lucide="truck" class="w-4 h-4 text-brand-500"></i> Costo Envío:</span>
                <span class="${comercioActivo.envio_gratis ? 'text-emerald-600 font-bold' : 'font-semibold text-slate-700'}">${comercioActivo.envio_gratis ? 'GRATIS' : esc(comercioActivo.costo_envio || 'A convenir')}</span>
              </div>
            ` : ''}

            <div class="pt-1">
              <span class="font-bold text-slate-400 flex items-center gap-2 mb-1.5"><i data-lucide="credit-card" class="w-4 h-4 text-brand-500"></i> Medios de pago:</span>
              <div class="flex flex-wrap gap-1.5">
                ${pagos.length > 0 
                  ? pagos.map(p => `<span class="bg-slate-50 border border-slate-200 text-slate-600 text-[10px] font-semibold px-2.5 py-1 rounded-md">${p}</span>`).join('')
                  : '<span class="text-slate-400">Efectivo</span>'
                }
              </div>
            </div>
          </div>
        </div>
      `;

      const boxAccionesDuenio = document.getElementById('acciones-duenio-prod');
      const btnPromoVista = document.getElementById('btn-agregar-promo-vista');

      if (esDuenio) {
        boxAccionesDuenio.classList.remove('hidden');
        document.getElementById('btn-agregar-prod-vista').onclick = () => prepararModalProducto(comercioActivo.id, comercioActivo.nombre);
        if (esUltra) btnPromoVista.classList.remove('hidden');
        else btnPromoVista.classList.add('hidden');
      } else {
        boxAccionesDuenio.classList.add('hidden');
      }

      if (esDuenio) {
        const topSolicitados = [...(comercioActivo.productos || [])].filter(p => !p.es_combo)
          .sort((a,b) => (Number(b.solicitudes_count)||0) - (Number(a.solicitudes_count)||0)).slice(0,5);
        header.insertAdjacentHTML('beforeend', `<div class="px-5 pb-5 bg-white"><div class="rounded-2xl border border-brand-100 bg-brand-50/60 p-4"><h3 class="text-xs font-black uppercase tracking-wide text-brand-700 mb-2">📈 Productos más solicitados</h3>${topSolicitados.length && topSolicitados.some(p => Number(p.solicitudes_count)>0) ? topSolicitados.map((p,i)=>`<div class="flex justify-between gap-3 py-1.5 text-xs"><span class="font-semibold text-slate-700">${i+1}. ${esc(p.titulo)}</span><strong class="text-brand-700">${Number(p.solicitudes_count)||0} solicitudes</strong></div>`).join('') : '<p class="text-xs text-slate-500">Todavía no hay solicitudes. Cada clic en “Agregar” suma al contador.</p>'}</div></div>`);
      }
      renderizarProductosComercio(comercioActivo.productos, esDuenio, colorAcentoBtn);

      document.getElementById('vista-inicio').classList.add('hidden');
      document.getElementById('vista-comercio').classList.remove('hidden');
      window.scrollTo(0, 0);

      if (window.lucide) lucide.createIcons();
    }

    async function toggleStockExpress(prodId, estadoActual) {
      const nuevoEstado = !estadoActual;
      const { error } = await _supabase.from('productos').update({ disponible: nuevoEstado }).eq('id', prodId);
      if (!error && comercioActivo) abrirVistaComercio(comercioActivo.slug || comercioActivo.id, false);
    }

    async function cambiarOrdenProducto(prodId, direccion) {
      if (!comercioActivo || !comercioActivo.productos) return;
      
      const prods = [...comercioActivo.productos].sort((a, b) => (a.orden !== undefined ? a.orden : 0) - (b.orden !== undefined ? b.orden : 0));
      const idx = prods.findIndex(p => p.id === prodId);

      if (idx === -1) return;
      const paso = direccion === 'arriba' ? -1 : 1;
      let targetIdx = idx;
      do { targetIdx += paso; } while (targetIdx >= 0 && targetIdx < prods.length && seccionDe(prods[targetIdx]) !== seccionDe(prods[idx]));
      if (targetIdx < 0 || targetIdx >= prods.length) return;

      const actual = prods[idx];
      const objetivo = prods[targetIdx];

      const ordenActualTemp = actual.orden !== undefined ? actual.orden : idx;
      const ordenObjetivoTemp = objetivo.orden !== undefined ? objetivo.orden : targetIdx;

      actual.orden = ordenObjetivoTemp;
      objetivo.orden = ordenActualTemp;

      await _supabase.from('productos').update({ orden: actual.orden }).eq('id', actual.id);
      await _supabase.from('productos').update({ orden: objetivo.orden }).eq('id', objetivo.id);

      if (comercioActivo) abrirVistaComercio(comercioActivo.slug || comercioActivo.id, false);
    }

    function calcularAhorroPorcentualCombo(p) {
      if (!p.es_combo || !p.items_combo || !comercioActivo) return 0;
      let sumaOriginal = 0;
      try {
        const items = typeof p.items_combo === 'string' ? JSON.parse(p.items_combo) : p.items_combo;
        items.forEach(it => {
          const prodOrig = comercioActivo.productos.find(x => x.id === it.prodId);
          if (prodOrig) sumaOriginal += (prodOrig.precio * it.cantidad);
        });
      } catch(e) { return 0; }

      if (sumaOriginal > p.precio) {
        return Math.round(((sumaOriginal - p.precio) / sumaOriginal) * 100);
      }
      return 0;
    }

    // Una promo solo figura agotada si alguno de los productos que incluye se quedó sin stock
    function promoTieneProductoAgotado(promo) {
      if (!promo || !promo.items_combo || !comercioActivo || !comercioActivo.productos) return false;
      let items = [];
      try {
        items = typeof promo.items_combo === 'string' ? JSON.parse(promo.items_combo) : promo.items_combo;
      } catch (e) { return false; }
      if (!Array.isArray(items)) return false;
      return items.some(it => {
        const prod = comercioActivo.productos.find(x => String(x.id) === String(it.prodId));
        if (!prod || prod.stock === null || prod.stock === undefined) return false;
        return parseInt(prod.stock) <= 0;
      });
    }

    function promoVencida(p) {
      if (!p || !p.es_combo || !p.promo_vence) return false;
      const hoy = new Date();
      const hoyISO = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}-${String(hoy.getDate()).padStart(2, '0')}`;
      return String(p.promo_vence).slice(0, 10) < hoyISO;
    }
    // Las promos/combos siempre van a la sección "Promos" (y esa sección se muestra primero)
    function seccionDe(p) { return p.es_combo ? 'Promos' : (p.seccion || ''); }
    function escSeccion(t) {
      return String(t == null ? '' : t).replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
    }

    function renderizarProductosComercio(productos, esDuenio = false, colorBoton = '#f97316') {
      const container = document.getElementById('productos-container');
      if (!/^#[0-9a-fA-F]{6}$/.test(colorBoton || '')) colorBoton = '#f97316';
      
      const plan = comercioActivo?.plan || 'gratis';
      
      let productosFiltrados = esDuenio 
        ? productos 
        : productos.filter(p => !p.es_solo_promo && !promoVencida(p));

      if (plan === 'gratis') {
        productosFiltrados = productosFiltrados.filter(p => !p.es_combo);
        productosFiltrados = productosFiltrados.slice(0, 5);
      } else if (plan === 'pro') {
        productosFiltrados = productosFiltrados.slice(0, 10);
      }

      const _ordenSec = [];
      productosFiltrados.forEach(p => { const s = seccionDe(p); if (!_ordenSec.includes(s)) _ordenSec.push(s); });
      const _iPromos = _ordenSec.indexOf('Promos');
      if (_iPromos > 0) { _ordenSec.splice(_iPromos, 1); _ordenSec.unshift('Promos'); }
      productosFiltrados = [...productosFiltrados].sort((a, b) => _ordenSec.indexOf(seccionDe(a)) - _ordenSec.indexOf(seccionDe(b)));
      const hayVariasSecciones = _ordenSec.some(s => s !== '');
      const dl = document.getElementById('lista-secciones');
      if (dl) dl.innerHTML = [...new Set((productos || []).map(p => p.seccion).filter(Boolean))].map(s => `<option value="${escSeccion(s)}"></option>`).join('');

      if (productosFiltrados.length === 0) {
        container.innerHTML = `
          <div class="p-10 clean-card rounded-3xl text-center text-slate-400 space-y-3">
            <i data-lucide="package-open" class="w-10 h-10 mx-auto text-slate-400"></i>
            <p class="text-xs font-semibold">No se encontraron productos en este local.</p>
          </div>
        `;
        if (window.lucide) lucide.createIcons();
        return;
      }

      let htmlAcc = '';

      productosFiltrados.forEach((p, idx) => {
        if (hayVariasSecciones && (idx === 0 || seccionDe(p) !== seccionDe(productosFiltrados[idx - 1]))) {
          htmlAcc += `<h4 class="text-xs font-black text-slate-700 pt-2 px-1 flex items-center gap-2"><span class="w-1.5 h-4 rounded-full bg-brand-500"></span>${escSeccion(seccionDe(p) || 'Otros')}</h4>`;
        }
        const stockNum = (!p.es_combo && p.stock !== null && p.stock !== undefined) ? parseInt(p.stock) : null;
        const esAgotadoPorStock = p.es_combo ? promoTieneProductoAgotado(p) : (stockNum !== null && stockNum <= 0);
        const estaDisponible = (p.disponible !== false) && !esAgotadoPorStock;
        
        const esCombo = Boolean(p.es_combo);
        const porcOff = esCombo ? calcularAhorroPorcentualCombo(p) : 0;

        const categoriasLocal = comercioActivo?.subcategorias || comercioActivo?.categorias || [comercioActivo?.categoria];
        const flagsCat = flagsDeSubcategorias(categoriasLocal);

        const requiereOpcionesModal = esCombo || Boolean(p.requiere_sabores) || Boolean(p.requiere_coccion) || (p.talles_disponibles || []).length > 0 || (p.colores_disponibles || []).length > 0 || Boolean(p.opciones_custom && p.opciones_custom.length > 0) || (p.requiere_sabores === undefined && flagsCat.sabores);

        const textoBotonAccion = requiereOpcionesModal ? 'Elegir opciones' : 'Agregar';

        let badgeStock = '';
        if (esAgotadoPorStock) {
          badgeStock = '<span class="text-[9px] font-black bg-rose-50 text-rose-600 border border-rose-200 px-2 py-0.5 rounded-full">AGOTADO</span>';
        } else if (stockNum !== null && stockNum <= 5) {
          badgeStock = `<span class="text-[9px] font-black bg-amber-50 text-amber-700 border border-amber-200 px-2 py-0.5 rounded-full">Últimas ${stockNum} unidades</span>`;
        }

        htmlAcc += `
          <div class="clean-card rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 relative group transition duration-300 overflow-hidden ${!estaDisponible ? 'opacity-60 bg-slate-50' : ''} ${p.es_solo_promo ? 'border-dashed border-amber-300 bg-amber-50/40' : ''}">
            
            <div class="flex items-center gap-4 overflow-hidden cursor-pointer flex-1 z-10" onclick="abrirVerProducto('${p.id}')">
              ${p.imagen_url 
                ? `<img src="${esc(p.imagen_url)}" class="w-20 h-20 rounded-xl object-cover border border-slate-200 flex-shrink-0 group-hover:scale-105 transition duration-300 shadow-sm">` 
                : `<div class="w-20 h-20 bg-slate-100 rounded-xl flex items-center justify-center text-slate-400 flex-shrink-0 border border-slate-200"><i data-lucide="${esCombo ? 'tag' : 'package'}" class="w-7 h-7"></i></div>`}
              <div class="truncate">
                <div class="flex items-center gap-2 flex-wrap">
                  <h4 class="font-bold text-base text-slate-900 truncate group-hover:text-brand-600 transition">${esc(p.titulo)}</h4>
                  ${esCombo ? '<span class="text-[9px] font-black bg-amber-50 text-amber-700 border border-amber-200 px-2 py-0.5 rounded-full">PROMO</span>' : ''}
                  ${p.es_solo_promo ? '<span class="text-[9px] font-black bg-slate-100 text-slate-600 border border-slate-200 px-2 py-0.5 rounded-full">SOLO COMBO</span>' : ''}
                  ${promoVencida(p) ? '<span class="text-[9px] font-black bg-rose-50 text-rose-600 border border-rose-200 px-2 py-0.5 rounded-full">VENCIDA</span>' : ''}
                  ${badgeStock}
                  ${(!estaDisponible && !esAgotadoPorStock) ? '<span class="text-[9px] font-black bg-rose-50 text-rose-600 border border-rose-200 px-2 py-0.5 rounded-full">PAUSADO</span>' : ''}
                </div>
                <p class="text-xs text-slate-500 truncate mt-0.5">${esc(p.descripcion || 'Tocar para ver detalles')}</p>
                
                <div class="flex items-center gap-2 mt-1.5">
                  <p class="text-lg font-black text-brand-600">${fmtPrecio(p.precio)}</p>
                  ${porcOff > 0 ? `<span class="text-[10px] font-black bg-emerald-50 text-emerald-600 border border-emerald-200 px-2.5 py-1 rounded-md">🔥 ${porcOff}% OFF</span>` : ''}
                </div>
              </div>
            </div>

            <div class="flex items-center justify-between sm:justify-end gap-2 flex-shrink-0 pt-3 sm:pt-0 border-t sm:border-t-0 border-slate-100 z-10">
              ${esDuenio ? `
                <div class="flex items-center gap-1 border-r border-slate-200 pr-2">
                  <button onclick="cambiarOrdenProducto('${p.id}', 'arriba')" title="Subir" class="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition ${idx === 0 ? 'opacity-30 cursor-not-allowed' : ''}">
                    <i data-lucide="arrow-up" class="w-4 h-4"></i>
                  </button>
                  <button onclick="cambiarOrdenProducto('${p.id}', 'abajo')" title="Bajar" class="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition ${idx === productosFiltrados.length - 1 ? 'opacity-30 cursor-not-allowed' : ''}">
                    <i data-lucide="arrow-down" class="w-4 h-4"></i>
                  </button>
                  <button onclick="toggleStockExpress('${p.id}', ${p.disponible !== false})" title="Cambiar Disponibilidad" class="text-[10px] font-black px-2 py-1 rounded-lg border transition ${p.disponible !== false ? 'bg-emerald-50 text-emerald-600 border-emerald-200 hover:bg-rose-50 hover:text-rose-600' : 'bg-rose-50 text-rose-600 border-rose-200 hover:bg-emerald-50 hover:text-emerald-600'}">
                    ${p.disponible !== false ? 'Pausar' : 'Activar'}
                  </button>
                  <button onclick="${esCombo ? `prepararEditarPromo('${p.id}')` : `prepararEditarProducto('${p.id}')`}" title="Editar" class="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition">
                    <i data-lucide="edit-3" class="w-4 h-4"></i>
                  </button>
                  <button onclick="eliminarProducto('${p.id}')" title="Eliminar" class="p-1.5 rounded-lg text-rose-500 hover:text-rose-700 hover:bg-rose-50 transition">
                    <i data-lucide="trash-2" class="w-4 h-4"></i>
                  </button>
                </div>
              ` : ''}

              ${estaDisponible ? `
                <button onclick="intentarAgregarProducto('${p.id}')" style="background-color: ${colorBoton};" class="text-white font-black px-4 py-2.5 rounded-xl text-xs whitespace-nowrap shadow-md transition flex items-center gap-1.5 active:scale-95 hover:opacity-90">
                  <i data-lucide="plus" class="w-4 h-4"></i> ${textoBotonAccion}
                </button>
              ` : `
                <span class="text-xs font-bold text-slate-400 bg-slate-100 px-3 py-2 rounded-xl">${esAgotadoPorStock ? 'Agotado' : 'No disponible'}</span>
              `}
            </div>
          </div>
        `;
      });

      container.innerHTML = htmlAcc;
      if (window.lucide) lucide.createIcons();
    }
