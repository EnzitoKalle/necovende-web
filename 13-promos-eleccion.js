    // =====================================================================
    // PROMOS "A ELECCIÓN" y "LLEVÁ N, PAGÁ M"
    // (la columna productos.promo_config se crea con sql/06-promos-a-eleccion.sql)
    //   promo_config = { tipo: 'eleccion' | 'nxm', cantidad: N, paga: M (solo nxm),
    //                    alcance: 'todos' | 'secciones' | 'seleccion', secciones: [...], prodIds: [...] }
    // =====================================================================

    function configPromo(p) {
      if (!p || !p.es_combo || !p.promo_config) return null;
      let cfg = p.promo_config;
      if (typeof cfg === 'string') { try { cfg = JSON.parse(cfg); } catch (e) { return null; } }
      return cfg && (cfg.tipo === 'eleccion' || cfg.tipo === 'nxm') ? cfg : null;
    }

    // Lo que se muestra como "precio" de una promo (en el catálogo, el detalle y el buscador)
    function precioTextoPromo(p) {
      const cfg = configPromo(p);
      if (!cfg) return fmtPrecio(p.precio);
      if (cfg.tipo === 'nxm') return `Llevá ${cfg.cantidad}, pagá ${cfg.paga}`;
      return `Llevá ${cfg.cantidad} por ${fmtPrecio(p.precio)}`;
    }

    function tieneStockPromoElegible(p) {
      if (p.disponible === false) return false;
      if (p.stock !== null && p.stock !== undefined && parseInt(p.stock) <= 0) return false;
      const talles = p.talles_disponibles || [];
      const st = p.stock_talles && typeof p.stock_talles === 'object' ? p.stock_talles : null;
      if (talles.length && st && talles.every(t => Object.prototype.hasOwnProperty.call(st, t))) {
        return talles.some(t => parseInt(st[t]) > 0);
      }
      return true;
    }

    // Productos entre los que se puede elegir en una promo (según el alcance configurado)
    function productosElegiblesPromo(cfg, soloConStock) {
      if (!cfg || !comercioActivo || !comercioActivo.productos) return [];
      const subs = comercioActivo.subcategorias || comercioActivo.categorias || [comercioActivo.categoria];
      const flagsCat = flagsDeSubcategorias(subs);
      const secciones = new Set((cfg.secciones || []).map(x => String(x)));
      const ids = new Set((cfg.prodIds || []).map(x => String(x)));
      return comercioActivo.productos.filter(p => {
        if (p.es_combo || p.es_solo_promo) return false;
        const pideSabores = p.requiere_sabores !== undefined ? Boolean(p.requiere_sabores) : flagsCat.sabores;
        if (pideSabores || p.requiere_coccion || (p.opciones_custom && p.opciones_custom.length)) return false;
        if (cfg.alcance === 'secciones' && !secciones.has(String(p.seccion || ''))) return false;
        if (cfg.alcance === 'seleccion' && !ids.has(String(p.id))) return false;
        return soloConStock ? tieneStockPromoElegible(p) : true;
      });
    }

    // ---------------------------------------------------------------
    // ARMADOR (comerciante)
    // ---------------------------------------------------------------
    let promoAlcanceSel = { secciones: new Set(), prodIds: new Set() };

    function elegirTipoPromo(tipo) {
      document.getElementById('promo-tipo').value = tipo;
      ['fijo', 'eleccion', 'nxm'].forEach(t => {
        const b = document.getElementById('promo-tipo-' + t);
        b.className = 'text-left p-3 rounded-xl border text-xs transition ' +
          (t === tipo ? 'bg-amber-50 border-amber-400 text-amber-800 ring-2 ring-amber-200' : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50');
      });
      document.getElementById('box-promo-fijo').classList.toggle('hidden', tipo !== 'fijo');
      document.getElementById('box-promo-eleccion').classList.toggle('hidden', tipo === 'fijo');
      document.getElementById('box-promo-paga').classList.toggle('hidden', tipo !== 'nxm');
      document.getElementById('box-promo-precio').classList.toggle('hidden', tipo === 'nxm');
      document.getElementById('box-promo-badge').classList.toggle('hidden', tipo !== 'fijo');
      document.getElementById('box-promo-precio').className = tipo === 'fijo' ? 'grid grid-cols-2 gap-3' : 'grid grid-cols-1 gap-3' + (tipo === 'nxm' ? ' hidden' : '');
      document.getElementById('lbl-promo-precio').innerText = tipo === 'eleccion' ? 'Precio total de la promo ($)' : 'Precio Promocional ($)';
      document.getElementById('lbl-promo-cantidad').innerText = tipo === 'nxm' ? 'Cantidad que lleva (N)' : 'Cantidad que lleva';
      if (tipo !== 'fijo') cambiarAlcancePromo();
    }

    function cambiarAlcancePromo() {
      const alcance = document.getElementById('promo-alcance').value;
      const cont = document.getElementById('promo-alcance-lista');
      const prods = (comercioActivo?.productos || []).filter(p => !p.es_combo && !p.es_solo_promo);
      if (alcance === 'secciones') {
        const secs = [...new Set(prods.map(p => p.seccion || ''))];
        cont.innerHTML = secs.length ? secs.map(sec => `
          <label class="flex items-center gap-2.5 bg-white p-2.5 rounded-xl border border-slate-200 cursor-pointer text-xs font-semibold text-slate-700">
            <input type="checkbox" ${promoAlcanceSel.secciones.has(sec) ? 'checked' : ''} onchange="marcarAlcancePromo('secciones', this.dataset.v, this.checked)" data-v="${esc(sec)}" class="w-4 h-4 rounded border-slate-300 text-brand-500">
            <span>${esc(sec || 'Sin sección')}</span>
          </label>`).join('') : '<p class="text-xs text-slate-400 text-center py-2">Todavía no tenés productos.</p>';
      } else if (alcance === 'seleccion') {
        cont.innerHTML = prods.length ? prods.map(p => `
          <label class="flex items-center gap-2.5 bg-white p-2.5 rounded-xl border border-slate-200 cursor-pointer text-xs font-semibold text-slate-700">
            <input type="checkbox" ${promoAlcanceSel.prodIds.has(String(p.id)) ? 'checked' : ''} onchange="marcarAlcancePromo('prodIds', this.dataset.v, this.checked)" data-v="${esc(String(p.id))}" class="w-4 h-4 rounded border-slate-300 text-brand-500">
            <span class="truncate flex-1">${esc(p.titulo)}</span><span class="text-[10px] font-black text-amber-600">${fmtPrecio(p.precio)}</span>
          </label>`).join('') : '<p class="text-xs text-slate-400 text-center py-2">Todavía no tenés productos.</p>';
      } else {
        cont.innerHTML = '';
      }
      actualizarResumenPromo();
    }

    function marcarAlcancePromo(grupo, valor, marcado) {
      const set = promoAlcanceSel[grupo];
      if (marcado) set.add(valor); else set.delete(valor);
      actualizarResumenPromo();
    }

    // Arma la configuración a partir del formulario (o devuelve un error para mostrar)
    function leerConfigPromoForm() {
      const tipo = document.getElementById('promo-tipo').value;
      const cantidad = parseInt(document.getElementById('promo-cantidad').value);
      if (!(cantidad >= 2 && cantidad <= 10)) return { error: 'La cantidad que lleva tiene que ser entre 2 y 10.' };
      const cfg = { tipo, cantidad, alcance: document.getElementById('promo-alcance').value };
      if (tipo === 'nxm') {
        const paga = parseInt(document.getElementById('promo-paga').value);
        if (!(paga >= 1 && paga < cantidad)) return { error: 'La cantidad que paga tiene que ser menor a la que lleva (ej: lleva 3, paga 2).' };
        cfg.paga = paga;
      }
      if (cfg.alcance === 'secciones') cfg.secciones = [...promoAlcanceSel.secciones];
      if (cfg.alcance === 'seleccion') cfg.prodIds = [...promoAlcanceSel.prodIds];
      if (cfg.alcance === 'secciones' && !cfg.secciones.length) return { error: 'Marcá al menos una sección.' };
      if (cfg.alcance === 'seleccion' && !cfg.prodIds.length) return { error: 'Marcá al menos un producto.' };
      const cuantos = productosElegiblesPromo(cfg, false).length;
      if (cuantos < 1) return { error: 'Con esa selección no queda ningún producto para elegir (no entran los que tienen sabores, cocción u opciones personalizadas).' };
      let precio = 0;
      if (tipo === 'eleccion') {
        precio = parseFloat(document.getElementById('promo-precio-final').value);
        if (!(precio > 0)) return { error: 'Poné el precio total de la promo.' };
      }
      return { config: cfg, precio };
    }

    function actualizarResumenPromo() {
      const tipo = document.getElementById('promo-tipo').value;
      const el = document.getElementById('promo-resumen');
      if (!el || tipo === 'fijo') return;
      const cantidad = parseInt(document.getElementById('promo-cantidad').value) || 0;
      const cfg = { tipo, cantidad, alcance: document.getElementById('promo-alcance').value,
        secciones: [...promoAlcanceSel.secciones], prodIds: [...promoAlcanceSel.prodIds] };
      const n = productosElegiblesPromo(cfg, false).length;
      const paga = parseInt(document.getElementById('promo-paga').value) || 0;
      const que = tipo === 'nxm' ? `Llevá ${cantidad || 'N'}, pagá ${paga || 'M'}` : `Llevá ${cantidad || 'N'} a elección`;
      el.innerText = `${que} · el cliente podrá elegir entre ${n} ${n === 1 ? 'producto' : 'productos'}.`;
    }

    // Deja el formulario de promo listo (nueva o editando una existente)
    function prepararFormPromoTipo(p) {
      const cfg = configPromo(p);
      promoAlcanceSel = { secciones: new Set((cfg?.secciones || []).map(String)), prodIds: new Set((cfg?.prodIds || []).map(String)) };
      document.getElementById('promo-cantidad').value = cfg ? cfg.cantidad : '';
      document.getElementById('promo-paga').value = cfg && cfg.paga ? cfg.paga : '';
      document.getElementById('promo-alcance').value = cfg ? cfg.alcance : 'todos';
      elegirTipoPromo(cfg ? cfg.tipo : 'fijo');
      if (cfg && cfg.tipo === 'nxm') document.getElementById('promo-precio-final').value = '';
    }

    // ---------------------------------------------------------------
    // CLIENTE: elegir los productos de la promo
    // ---------------------------------------------------------------
    let promoEleccionActual = null;

    function opcionesTalleEleccion(prod) {
      const st = prod.stock_talles && typeof prod.stock_talles === 'object' ? prod.stock_talles : {};
      const opts = (prod.talles_disponibles || []).map(t => {
        const n = Object.prototype.hasOwnProperty.call(st, t) ? parseInt(st[t]) : null;
        if (n !== null && n <= 0) return { v: t, off: true, txt: `${t} (sin stock)` };
        return { v: t, off: false, txt: `${t}${n !== null && n <= 3 ? ` (quedan ${n})` : ''}` };
      });
      const primero = opts.find(o => !o.off);
      return opts.map(o => `<option value="${esc(o.v)}"${o.off ? ' disabled' : ''}${primero && o === primero ? ' selected' : ''}>${esc(o.txt)}</option>`).join('');
    }

    function abrirPromoEleccion(p) {
      const cfg = configPromo(p);
      const elig = productosElegiblesPromo(cfg, true);
      if (!elig.length) { alert('Por ahora no hay productos disponibles para esta promo.'); return; }
      promoEleccionActual = { promo: p, cfg, elig };
      document.getElementById('pe-titulo').innerText = p.titulo;
      document.getElementById('pe-sub').innerText = cfg.tipo === 'nxm'
        ? `Elegí ${cfg.cantidad} productos y pagás solo ${cfg.paga} (los más baratos salen gratis).`
        : `Elegí ${cfg.cantidad} productos por ${fmtPrecio(p.precio)} en total.`;
      const cont = document.getElementById('pe-bloques');
      let html = '';
      for (let i = 1; i <= cfg.cantidad; i++) {
        html += `
          <div class="bg-slate-50 p-3.5 rounded-2xl border border-amber-200 space-y-2.5">
            <span class="text-xs font-black text-amber-700 uppercase tracking-wide">Producto #${i}</span>
            <select id="pe-prod-${i}" onchange="cambiarProductoPromoEleccion(${i})" class="w-full clean-input px-3 py-2.5 rounded-xl text-xs font-bold">
              <option value="">Elegí un modelo...</option>
              ${elig.map(x => `<option value="${esc(String(x.id))}">${esc(x.titulo)} · ${fmtPrecio(x.precio)}</option>`).join('')}
            </select>
            <div id="pe-var-${i}" class="grid grid-cols-2 gap-2"></div>
          </div>`;
      }
      cont.innerHTML = html;
      recalcularTotalPromoEleccion();
      abrirModal('modal-promo-eleccion');
      if (window.lucide) lucide.createIcons();
    }

    function productoElegidoPE(i) {
      const id = document.getElementById('pe-prod-' + i)?.value;
      return id ? promoEleccionActual.elig.find(x => String(x.id) === String(id)) : null;
    }

    function cambiarProductoPromoEleccion(i) {
      const prod = productoElegidoPE(i);
      const cont = document.getElementById('pe-var-' + i);
      let html = '';
      if (prod && (prod.talles_disponibles || []).length) {
        html += `<div><label class="block text-[11px] font-bold text-slate-600 mb-1">Talle</label><select id="pe-talle-${i}" class="w-full clean-input px-3 py-2.5 rounded-xl text-xs font-bold">${opcionesTalleEleccion(prod)}</select></div>`;
      }
      if (prod && (prod.colores_disponibles || []).length) {
        html += `<div><label class="block text-[11px] font-bold text-slate-600 mb-1">Color</label><select id="pe-color-${i}" class="w-full clean-input px-3 py-2.5 rounded-xl text-xs font-bold">${prod.colores_disponibles.map(c => `<option value="${esc(c)}">${esc(c)}</option>`).join('')}</select></div>`;
      }
      cont.innerHTML = html;
      recalcularTotalPromoEleccion();
    }

    // Total según lo elegido hasta ahora: precio fijo, o los M más caros en "llevá N, pagá M"
    function calcularTotalPromoEleccion(precios) {
      const { promo, cfg } = promoEleccionActual;
      const suma = precios.reduce((a, b) => a + b, 0);
      if (cfg.tipo === 'nxm') {
        const pagados = precios.slice().sort((a, b) => b - a).slice(0, cfg.paga).reduce((a, b) => a + b, 0);
        return { total: pagados, suma };
      }
      return { total: Number(promo.precio), suma };
    }

    function recalcularTotalPromoEleccion() {
      if (!promoEleccionActual) return;
      const { cfg } = promoEleccionActual;
      const precios = [];
      for (let i = 1; i <= cfg.cantidad; i++) { const pr = productoElegidoPE(i); if (pr) precios.push(Number(pr.precio)); }
      const completo = precios.length === cfg.cantidad;
      const r = calcularTotalPromoEleccion(precios);
      document.getElementById('pe-total').innerText = completo || cfg.tipo === 'eleccion' ? fmtPrecio(r.total) : (precios.length ? `${fmtPrecio(r.total)} (faltan ${cfg.cantidad - precios.length})` : '-');
      document.getElementById('pe-ahorro').innerText = completo && r.suma > r.total ? `Te ahorrás ${fmtPrecio(r.suma - r.total)} (sin promo: ${fmtPrecio(r.suma)})` : '';
    }

    function confirmarPromoEleccion() {
      if (!promoEleccionActual) return;
      const { promo, cfg } = promoEleccionActual;
      const entradas = [];
      const precios = [];
      for (let i = 1; i <= cfg.cantidad; i++) {
        const prod = productoElegidoPE(i);
        if (!prod) { alert(`Elegí el producto #${i}.`); return; }
        const selT = document.getElementById('pe-talle-' + i);
        if (selT && (!selT.value || (selT.selectedOptions[0] && selT.selectedOptions[0].disabled))) { alert(`Elegí un talle con stock para "${prod.titulo}" (#${i}).`); return; }
        const selC = document.getElementById('pe-color-' + i);
        entradas.push({ prodId: prod.id, titulo: prod.titulo, talle: selT ? selT.value : '', color: selC ? selC.value : '' });
        precios.push(Number(prod.precio));
      }
      const { total } = calcularTotalPromoEleccion(precios);
      const detalle = entradas.map((e, i) => {
        const partes = [e.talle ? 'Talle ' + e.talle : '', e.color].filter(Boolean);
        return `[#${i + 1} ${e.titulo}${partes.length ? ': ' + partes.join(', ') : ''}]`;
      }).join(' ');
      agregarAlCarrito(promo.id, `${promo.titulo} - ${detalle}`, total, 1, { eleccion: entradas });
      cerrarModal('modal-promo-eleccion');
      promoEleccionActual = null;
    }
