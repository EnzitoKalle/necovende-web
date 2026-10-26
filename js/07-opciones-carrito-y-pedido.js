    function intentarAgregarProducto(prodId) {
      const prodContado = comercioActivo?.productos?.find(x => String(x.id) === String(prodId));
      if (prodContado) {
        prodContado.solicitudes_count = (Number(prodContado.solicitudes_count) || 0) + 1;
        _supabase.rpc('sumar_solicitud', { p_producto: String(prodId) })
          .then(({ error }) => { if (error) console.warn('No se pudo guardar el contador de solicitudes:', error.message); });
      }

      const p = comercioActivo?.productos?.find(item => item.id === prodId);
      if (!p) return;

      cantidadSeleccionadaModalSabores = 1;

      const categoriasLocal = comercioActivo?.subcategorias || comercioActivo?.categorias || [comercioActivo?.categoria];
      const flagsCat = flagsDeSubcategorias(categoriasLocal);

      const requiereSabores = (p.requiere_sabores !== undefined) 
        ? Boolean(p.requiere_sabores) 
        : flagsCat.sabores;

      const requiereCoccion = Boolean(p.requiere_coccion) && flagsCat.coccion;
      const tieneVariantes = (p.talles_disponibles || []).length > 0 || (p.colores_disponibles || []).length > 0;
      const tieneOpcionesCustom = Boolean(p.opciones_custom && p.opciones_custom.length > 0);
      const esCombo = Boolean(p.es_combo);

      let componentesPromo = [];
      if (esCombo && p.items_combo) {
        try {
          componentesPromo = typeof p.items_combo === 'string' ? JSON.parse(p.items_combo) : p.items_combo;
        } catch(e) { console.error(e); }
      }

      let listaSaboresUsar = [];
      if (p.sabores_especificos && p.sabores_especificos.length > 0) {
        listaSaboresUsar = p.sabores_especificos;
      } else if (comercioActivo.sabores && comercioActivo.sabores.length > 0) {
        listaSaboresUsar = comercioActivo.sabores;
      }

      productoPendienteSabores = {
        id: p.id,
        titulo: p.titulo,
        precio: p.precio,
        esCombo,
        componentesPromo,
        requiereSabores,
        requiereCoccion,
        maxSabores: p.max_sabores || 0,
        saboresIlimitados: p.max_sabores === 0 || p.max_sabores === 999,
        listaSaboresUsar,
        talles: p.talles_disponibles || [],
        colores: p.colores_disponibles || [],
        opcionesCustom: p.opciones_custom || []
      };

      document.getElementById('modal-sabores-titulo').innerText = p.titulo;
      document.getElementById('modal-sabores-sub').innerText = 'Elegí las opciones de tu preferencia.';
      document.getElementById('cant-modal-sabores-val').innerText = '1';
      const lblSubCantidad = document.getElementById('lbl-sub-cantidad-unidades');
      if (lblSubCantidad) lblSubCantidad.innerText = (requiereSabores || esCombo) ? 'Se abrirá 1 box de opciones por cada unidad.' : 'Elegí cuántas unidades querés.';
      const selectorCantidadSabores = document.getElementById('selector-cantidad-modal-sabores');
      if (selectorCantidadSabores) {
        selectorCantidadSabores.classList.toggle('hidden', Boolean(requiereSabores && (p.max_sabores === 0 || p.max_sabores === 999)));
      }

      const boxCustom = document.getElementById('box-oppciones-personalizadas-prod');
      const containerCustom = document.getElementById('contenedor-check-opciones-custom');
      containerCustom.innerHTML = '';

      if (p.opciones_custom && p.opciones_custom.length > 0) {
        boxCustom.classList.remove('hidden');
        p.opciones_custom.forEach(op => {
          containerCustom.innerHTML += `
            <label class="flex items-center gap-2.5 bg-white p-2.5 rounded-xl border border-slate-200 cursor-pointer text-xs font-semibold text-slate-700 shadow-sm">
              <input type="checkbox" name="opcion-custom-check" value="${esc(op)}" class="w-4 h-4 rounded border-slate-300 bg-white text-brand-500 focus:ring-brand-500">
              <span>${esc(op)}</span>
            </label>
          `;
        });
      } else {
        boxCustom.classList.add('hidden');
      }

      const boxVariantes = document.getElementById('box-variantes-indumentaria');
      const boxTalles = document.getElementById('box-select-talles');
      const boxColores = document.getElementById('box-select-colores');

      if (tieneVariantes) {
        boxVariantes.classList.remove('hidden');
        if (p.talles_disponibles && p.talles_disponibles.length > 0) {
          boxTalles.classList.remove('hidden');
          const stockT = (p.stock_talles && typeof p.stock_talles === 'object') ? p.stock_talles : {};
          document.getElementById('select-talle-opcion').innerHTML = p.talles_disponibles.map(t => {
            const n = Object.prototype.hasOwnProperty.call(stockT, t) ? parseInt(stockT[t]) : null;
            if (n !== null && n <= 0) return `<option value="${esc(t)}" disabled>${esc(t)} (sin stock)</option>`;
            return `<option value="${esc(t)}">${esc(t)}${n !== null && n <= 3 ? ` (quedan ${n})` : ''}</option>`;
          }).join('');
          const primerTalleConStock = Array.from(document.getElementById('select-talle-opcion').options).find(o => !o.disabled);
          if (primerTalleConStock) document.getElementById('select-talle-opcion').value = primerTalleConStock.value;
        } else {
          boxTalles.classList.add('hidden');
        }

        if (p.colores_disponibles && p.colores_disponibles.length > 0) {
          boxColores.classList.remove('hidden');
          document.getElementById('select-color-opcion').innerHTML = p.colores_disponibles.map(c => `<option value="${esc(c)}">${esc(c)}</option>`).join('');
        } else {
          boxColores.classList.add('hidden');
        }
      } else {
        boxVariantes.classList.add('hidden');
      }

      const boxCoccion = document.getElementById('box-opcion-coccion');
      if (requiereCoccion && comercioActivo.tipo_coccion_empanadas === 'ambas') {
        boxCoccion.classList.remove('hidden');
      } else {
        boxCoccion.classList.add('hidden');
      }

      document.getElementById('sabores-detalles').value = '';
      document.getElementById('btn-confirmar-sabores').onclick = confirmarAgregarConSabores;

      renderizarBloquesModalSabores();
      abrirModal('modal-sabores');
    }

    function cambiarCantidadModalSabores(delta) {
      cantidadSeleccionadaModalSabores = Math.max(1, cantidadSeleccionadaModalSabores + delta);
      document.getElementById('cant-modal-sabores-val').innerText = cantidadSeleccionadaModalSabores;
      
      const lbl = document.getElementById('lbl-sub-cantidad-unidades');
      if (lbl) {
        lbl.innerText = (productoPendienteSabores && (productoPendienteSabores.requiereSabores || productoPendienteSabores.esCombo)) ? `Se abrirán ${cantidadSeleccionadaModalSabores} box(es) de opciones.` : 'Elegí cuántas unidades querés.';
      }

      renderizarBloquesModalSabores();
    }

    // Fila de un sabor con sus botones - / + (antes estaba copiada 3 veces)
    function htmlFilaSabor(idB, saborClean) {
      return `
                  <div class="flex items-center justify-between bg-white p-2.5 rounded-xl border border-slate-200 shadow-sm text-xs">
                    <span class="font-bold text-slate-700 truncate pr-2">${esc(saborClean)}</span>
                    <div class="flex items-center gap-2 bg-slate-100 rounded-lg px-2 py-1 flex-shrink-0 border border-slate-200">
                      <button type="button" onclick="modificarSaborUnidad(${idB}, decodeURIComponent('${encodeURIComponent(saborClean).replace(/'/g, '%27')}'), -1)" class="w-6 h-6 flex items-center justify-center bg-white border border-slate-200 rounded-md text-slate-700 font-black text-xs hover:bg-slate-50">-</button>
                      <span id="cant-sabor-u${idB}-${encodeURIComponent(saborClean).replace(/'/g, '%27')}" class="text-xs font-black text-slate-700 w-4 text-center">0</span>
                      <button type="button" onclick="modificarSaborUnidad(${idB}, decodeURIComponent('${encodeURIComponent(saborClean).replace(/'/g, '%27')}'), 1)" class="w-6 h-6 flex items-center justify-center bg-brand-500 rounded-md text-white font-black text-xs hover:bg-brand-600">+</button>
                    </div>
                  </div>
                `;
    }

    function renderizarBloquesModalSabores() {
      if (!productoPendienteSabores) return;

      const p = productoPendienteSabores;
      const totalPacks = cantidadSeleccionadaModalSabores;
      const contenedor = document.getElementById('contenedor-bloques-unidades');
      contenedor.innerHTML = '';
      estadoSaboresPorUnidad = {};

      let indexBloqueGlobal = 1;

      for (let packNum = 1; packNum <= totalPacks; packNum++) {
        
        if (p.esCombo && p.componentesPromo) {
          p.componentesPromo.forEach(itemInfo => {
            const prodOriginal = comercioActivo.productos.find(x => x.id === itemInfo.prodId);
            if (!prodOriginal) return;

            const esIlimitado = prodOriginal.max_sabores === 0 || prodOriginal.max_sabores === 999;
            let listSab = (prodOriginal.sabores_especificos && prodOriginal.sabores_especificos.length > 0)
              ? prodOriginal.sabores_especificos
              : (comercioActivo.sabores || []);

            if (esIlimitado && prodOriginal.requiere_sabores) {
              const idB = indexBloqueGlobal++;
              const limiteTotalComboItem = itemInfo.cantidad;

              estadoSaboresPorUnidad[idB] = { 
                _max: limiteTotalComboItem, 
                _esIlimitado: false,
                _pack: packNum,
                _titulo: `${prodOriginal.titulo} (Total: ${limiteTotalComboItem})`
              };

              let htmlBloque = `
                <div class="bg-slate-50 p-4 rounded-2xl border border-amber-200 space-y-3">
                  <div class="flex justify-between items-center border-b border-slate-200 pb-2">
                    <span class="text-xs font-black text-amber-700 uppercase tracking-wide">
                      📦 Pack #${packNum}: ${esc(prodOriginal.titulo)} (x${limiteTotalComboItem})
                    </span>
                    <span id="badge-unidad-${idB}" class="text-[10px] font-black text-brand-600 bg-brand-50 px-2.5 py-1 rounded-md border border-brand-200">
                      0 / ${limiteTotalComboItem}
                    </span>
                  </div>
                  <div class="space-y-2 max-h-48 overflow-y-auto pr-1">
              `;

              listSab.forEach(sabor => {
                const saborClean = sabor.trim();
                estadoSaboresPorUnidad[idB][saborClean] = 0;

                htmlBloque += htmlFilaSabor(idB, saborClean);
              });

              htmlBloque += `</div></div>`;
              contenedor.innerHTML += htmlBloque;

            } else {
              for (let qty = 1; qty <= itemInfo.cantidad; qty++) {
                const idB = indexBloqueGlobal++;
                const maxG = prodOriginal.max_sabores || 0;

                const tallesComp = prodOriginal.talles_disponibles || [];
                const coloresComp = prodOriginal.colores_disponibles || [];
                const pideSabores = Boolean(listSab.length > 0 && prodOriginal.requiere_sabores);
                estadoSaboresPorUnidad[idB] = { 
                  _max: maxG, 
                  _esIlimitado: false,
                  _pack: packNum,
                  _titulo: `${prodOriginal.titulo} (${qty}/${itemInfo.cantidad})`,
                  _prodId: prodOriginal.id,
                  _conTalle: tallesComp.length > 0,
                  _conColor: coloresComp.length > 0
                };

                let htmlBloque = `
                  <div class="bg-slate-50 p-4 rounded-2xl border border-amber-200 space-y-3">
                    <div class="flex justify-between items-center border-b border-slate-200 pb-2">
                      <span class="text-xs font-black text-amber-700 uppercase tracking-wide">
                        📦 Pack #${packNum}: ${esc(prodOriginal.titulo)} ${itemInfo.cantidad > 1 ? `#${qty}` : ''}
                      </span>
                      <span id="badge-unidad-${idB}" class="${pideSabores ? '' : 'hidden '}text-[10px] font-black text-brand-600 bg-brand-50 px-2.5 py-1 rounded-md border border-brand-200">
                        0 / ${maxG}
                      </span>
                    </div>
                `;

                // Talle y color de ESTA unidad (ej: cada zapatilla de la promo puede ir en un talle distinto)
                if (tallesComp.length || coloresComp.length) {
                  const stockT = (prodOriginal.stock_talles && typeof prodOriginal.stock_talles === 'object') ? prodOriginal.stock_talles : {};
                  const opcTalles = tallesComp.map(t => {
                    const n = Object.prototype.hasOwnProperty.call(stockT, t) ? parseInt(stockT[t]) : null;
                    if (n !== null && n <= 0) return `<option value="${esc(t)}" disabled>${esc(t)} (sin stock)</option>`;
                    return `<option value="${esc(t)}">${esc(t)}${n !== null && n <= 3 ? ` (quedan ${n})` : ''}</option>`;
                  });
                  const primero = tallesComp.findIndex(t => { const n = Object.prototype.hasOwnProperty.call(stockT, t) ? parseInt(stockT[t]) : null; return !(n !== null && n <= 0); });
                  htmlBloque += `<div class="grid grid-cols-2 gap-2">`;
                  if (tallesComp.length) htmlBloque += `<div><label class="block text-[11px] font-bold text-slate-600 mb-1">Talle</label><select id="combo-talle-${idB}" class="w-full clean-input px-3 py-2.5 rounded-xl text-xs font-bold">${opcTalles.join('').replace(primero >= 0 ? `<option value="${esc(tallesComp[primero])}"` : '@@', primero >= 0 ? `<option value="${esc(tallesComp[primero])}" selected` : '@@')}</select></div>`;
                  if (coloresComp.length) htmlBloque += `<div><label class="block text-[11px] font-bold text-slate-600 mb-1">Color</label><select id="combo-color-${idB}" class="w-full clean-input px-3 py-2.5 rounded-xl text-xs font-bold">${coloresComp.map(c => `<option value="${esc(c)}">${esc(c)}</option>`).join('')}</select></div>`;
                  htmlBloque += `</div>`;
                }
                htmlBloque += `<div class="space-y-2 max-h-48 overflow-y-auto pr-1">`;

                if (pideSabores) {
                  listSab.forEach(sabor => {
                    const saborClean = sabor.trim();
                    estadoSaboresPorUnidad[idB][saborClean] = 0;

                    htmlBloque += htmlFilaSabor(idB, saborClean);
                  });
                } else if (!tallesComp.length && !coloresComp.length) {
                  htmlBloque += `<p class="text-xs text-slate-500 font-semibold py-1">Sin opciones adicionales requeridas.</p>`;
                }

                htmlBloque += `</div></div>`;
                contenedor.innerHTML += htmlBloque;
              }
            }
          });

        } else if (p.requiereSabores && p.listaSaboresUsar.length > 0) {
          const idB = indexBloqueGlobal++;
          const esIlimitado = p.maxSabores === 0 || p.maxSabores === 999 || p.maxSabores === null;
          const maxG = esIlimitado ? 999 : parseInt(p.maxSabores);

          estadoSaboresPorUnidad[idB] = { 
            _max: maxG, 
            _esIlimitado: esIlimitado,
            _pack: packNum,
            _titulo: p.titulo
          };

          let htmlBloque = `
            <div class="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-3">
              <div class="flex justify-between items-center border-b border-slate-200 pb-2">
                <span class="text-xs font-black text-slate-700 uppercase tracking-wide">
                  ${totalPacks > 1 ? `Unidad #${packNum} de ${totalPacks}` : 'Seleccionar Gustos'}
                </span>
                <span id="badge-unidad-${idB}" class="text-[10px] font-black text-brand-600 bg-brand-50 px-2.5 py-1 rounded-md border border-brand-200">
                  0 / ${esIlimitado ? '∞' : maxG}
                </span>
              </div>
              <div class="space-y-2 max-h-48 overflow-y-auto pr-1">
          `;

          p.listaSaboresUsar.forEach(sabor => {
            const saborClean = sabor.trim();
            estadoSaboresPorUnidad[idB][saborClean] = 0;

            htmlBloque += htmlFilaSabor(idB, saborClean);
          });

          htmlBloque += `</div></div>`;
          contenedor.innerHTML += htmlBloque;
        }
      }
    }

    function modificarSaborUnidad(numUnidad, sabor, cambio) {
      if (!productoPendienteSabores) return;

      const saboresUnidad = estadoSaboresPorUnidad[numUnidad];
      if (!saboresUnidad) return;

      const maximoPermitido = saboresUnidad._max || 999;

      let sumaActualUnidad = 0;
      for (const [k, v] of Object.entries(saboresUnidad)) {
        if (!k.startsWith('_')) sumaActualUnidad += v;
      }

      const valActual = saboresUnidad[sabor] || 0;

      if (cambio > 0 && !saboresUnidad._esIlimitado && sumaActualUnidad >= maximoPermitido) {
        alert(`Alcanzaste el máximo de ${maximoPermitido} gustos permitidos para este ítem.`);
        return;
      }

      const nuevoVal = valActual + cambio;
      if (nuevoVal >= 0) {
        saboresUnidad[sabor] = nuevoVal;
        const elemCant = document.getElementById(`cant-sabor-u${numUnidad}-${encodeURIComponent(sabor)}`);
        if (elemCant) elemCant.innerText = nuevoVal;

        let totalU = 0;
        for (const [k, v] of Object.entries(saboresUnidad)) {
          if (!k.startsWith('_')) totalU += v;
        }

        const badge = document.getElementById(`badge-unidad-${numUnidad}`);
        if (badge) {
          badge.innerText = saboresUnidad._esIlimitado 
            ? `${totalU} selec.` 
            : `${totalU} / ${maximoPermitido}`;
        }
      }
    }

    function confirmarAgregarConSabores() {
      if (!productoPendienteSabores) return;

      const totalBloques = Object.keys(estadoSaboresPorUnidad).length;
      let resumenUnidadesTexto = [];
      let cantidadPorSaboresIlimitados = 0;
      if (productoPendienteSabores.saboresIlimitados && productoPendienteSabores.requiereSabores) {
        for (const saboresU of Object.values(estadoSaboresPorUnidad)) {
          for (const [sabor, cant] of Object.entries(saboresU || {})) {
            if (!sabor.startsWith('_') && Number(cant) > 0) cantidadPorSaboresIlimitados += Number(cant);
          }
        }
        if (cantidadPorSaboresIlimitados < 1) {
          alert('Elegí al menos una unidad de sabor para continuar.');
          return;
        }
      }

      let varianteTexto = "";
      if (productoPendienteSabores.talles && productoPendienteSabores.talles.length > 0) {
        const valTalle = document.getElementById('select-talle-opcion').value;
        varianteTexto += `[Talle: ${valTalle}] `;
      }
      if (productoPendienteSabores.colores && productoPendienteSabores.colores.length > 0) {
        const valColor = document.getElementById('select-color-opcion').value;
        varianteTexto += `[Color: ${valColor}] `;
      }

      const checksCustom = document.querySelectorAll('input[name="opcion-custom-check"]:checked');
      if (checksCustom.length > 0) {
        const valsCustom = Array.from(checksCustom).map(c => c.value);
        varianteTexto += `[Opciones: ${valsCustom.join(', ')}] `;
      }

      // Promos con productos que tienen talle/color: cada unidad lleva el suyo
      const comboTalles = [];
      const variantePorBloque = {};
      for (let u = 1; u <= totalBloques; u++) {
        const sU = estadoSaboresPorUnidad[u] || {};
        const partes = [];
        if (sU._conTalle) {
          const sel = document.getElementById('combo-talle-' + u);
          if (!sel || !sel.value || (sel.selectedOptions[0] && sel.selectedOptions[0].disabled)) {
            alert(`Elegí un talle con stock para: ${(sU._titulo || 'el producto')}.`);
            return;
          }
          partes.push('Talle ' + sel.value);
          comboTalles.push({ prodId: sU._prodId, talle: sel.value });
        }
        if (sU._conColor) {
          const selC = document.getElementById('combo-color-' + u);
          if (selC && selC.value) partes.push(selC.value);
        }
        if (partes.length) variantePorBloque[u] = partes;
      }

      for (let u = 1; u <= totalBloques; u++) {
        const saboresU = estadoSaboresPorUnidad[u] || {};
        const gustosArr = [];

        for (const [sabor, cant] of Object.entries(saboresU)) {
          if (!sabor.startsWith('_') && cant > 0) {
            gustosArr.push(`${cant}x ${sabor}`);
          }
        }

        if (variantePorBloque[u]) {
          const packLabel = saboresU._pack ? `#${saboresU._pack}` : `${u}`;
          resumenUnidadesTexto.push(`[Pack ${packLabel} · ${saboresU._titulo}: ${[...variantePorBloque[u], ...gustosArr].join(', ')}]`);
        } else if (gustosArr.length > 0) {
          const packLabel = saboresU._pack ? `#${saboresU._pack}` : `${u}`;
          resumenUnidadesTexto.push(totalBloques > 1 ? `[Unidad ${packLabel}: ${gustosArr.join(', ')}]` : `Sabores: ${gustosArr.join(', ')}`);
        }
      }

      const detalles = document.getElementById('sabores-detalles').value.trim();
      let especificacion = varianteTexto;

      if (productoPendienteSabores.requiereCoccion) {
        if (comercioActivo.tipo_coccion_empanadas === 'ambas') {
          const coccion = document.querySelector('input[name="coccion-elegida"]:checked')?.value || 'Al Horno';
          especificacion += `[${coccion}] `;
        } else if (comercioActivo.tipo_coccion_empanadas) {
          especificacion += `[${comercioActivo.tipo_coccion_empanadas.toUpperCase()}] `;
        }
      }

      if (resumenUnidadesTexto.length > 0) especificacion += resumenUnidadesTexto.join(' ');
      if (detalles) especificacion += ` (${detalles})`;

      const tituloFinal = especificacion ? `${productoPendienteSabores.titulo} - ${especificacion}` : productoPendienteSabores.titulo;

      const cantidadAgregar = (productoPendienteSabores.saboresIlimitados && productoPendienteSabores.requiereSabores)
        ? cantidadPorSaboresIlimitados
        : cantidadSeleccionadaModalSabores;
      const extraCarrito = {};
      if (productoPendienteSabores.talles && productoPendienteSabores.talles.length > 0) extraCarrito.talle = document.getElementById('select-talle-opcion').value;
      if (comboTalles.length) { extraCarrito.comboTalles = comboTalles; extraCarrito.comboBase = cantidadAgregar; }
      agregarAlCarrito(productoPendienteSabores.id, tituloFinal, productoPendienteSabores.precio, cantidadAgregar, extraCarrito);
      cerrarModal('modal-sabores');
      productoPendienteSabores = null;
    }

    let prodDetalleActualId = null;
    // Link directo a un producto: abre el local y, arriba, el detalle de ese producto
    function linkDelProducto(c, prodId) {
      return `${window.location.origin}${window.location.pathname}?menu=${encodeURIComponent(c.slug || c.id)}&producto=${encodeURIComponent(prodId)}`;
    }

    function compartirProductoActual() {
      const p = comercioActivo?.productos?.find(x => String(x.id) === String(prodDetalleActualId));
      if (!p) return;
      const url = linkDelProducto(comercioActivo, p.id);
      const texto = `¡Mirá ${p.titulo} en ${comercioActivo.nombre}! ${fmtPrecio(p.precio)}`;
      if (navigator.share) {
        navigator.share({ title: p.titulo, text: texto, url }).catch(() => {});
      } else if (navigator.clipboard) {
        navigator.clipboard.writeText(url).then(() => mostrarToast('Link del producto copiado.'), () => prompt('Copiá este link:', url));
      } else {
        prompt('Copiá este link:', url);
      }
    }

    function abrirVerProducto(prodId) {
      const p = comercioActivo?.productos?.find(item => String(item.id) === String(prodId));
      if (!p) return;
      prodDetalleActualId = p.id;

      document.getElementById('view-prod-titulo').innerText = p.titulo;
      document.getElementById('view-prod-precio').innerText = `${fmtPrecio(p.precio)}`;
      const oferta = ofertaDe(p, comercioActivo);
      const tachado = document.getElementById('view-prod-precio-antes');
      if (oferta) { tachado.innerText = fmtPrecio(oferta.antes); tachado.classList.remove('hidden'); }
      else tachado.classList.add('hidden');
      document.getElementById('view-prod-descripcion').innerText = p.descripcion || 'Sin descripción adicional.';

      const porcOff = p.es_combo ? calcularAhorroPorcentualCombo(p) : (oferta ? oferta.pct : 0);
      const badgeOff = document.getElementById('view-prod-badge-off');

      if (porcOff > 0) {
        badgeOff.innerText = `🔥 ${porcOff}% OFF`;
        badgeOff.classList.remove('hidden');
      } else {
        badgeOff.classList.add('hidden');
      }

      const imgElem = document.getElementById('view-prod-img');
      const noImgElem = document.getElementById('view-prod-no-img');

      if (p.imagen_url) {
        imgElem.src = p.imagen_url;
        imgElem.classList.remove('hidden');
        noImgElem.classList.add('hidden');
      } else {
        imgElem.classList.add('hidden');
        noImgElem.classList.remove('hidden');
      }

      notaPendienteProducto = null;
      const inputNota = document.getElementById('view-prod-nota');
      if (inputNota) inputNota.value = '';

      document.getElementById('view-prod-btn-agregar').onclick = () => {
        const nota = inputNota ? inputNota.value.replace(/\s+/g, ' ').trim().slice(0, 120) : '';
        notaPendienteProducto = nota ? { id: p.id, texto: nota } : null;
        intentarAgregarProducto(p.id);
        cerrarModal('modal-ver-producto');
      };

      abrirModal('modal-ver-producto');
      if (window.lucide) lucide.createIcons();
    }

    // Aclaración escrita en el detalle del producto (ej: sin cebolla): se pega al producto cuando efectivamente se agrega
    let notaPendienteProducto = null;

    function agregarAlCarrito(id, titulo, precio, cantidadAAgregar = 1, extra = {}) {
      if (!comercioActivo) return;

      if (comercioCarrito && comercioCarrito.id !== comercioActivo.id && carrito.length > 0) {
        const confirmar = confirm(`Tu carrito actual contiene productos de "${comercioCarrito.nombre}". ¿Querés vaciar el carrito e iniciar un nuevo pedido en "${comercioActivo.nombre}"?`);
        if (confirmar) {
          carrito = [];
          comercioCarrito = comercioActivo;
        } else {
          return;
        }
      } else if (!comercioCarrito || carrito.length === 0) {
        comercioCarrito = comercioActivo;
      }

      const existe = carrito.find(item => item.titulo === titulo && item.id === id);
      const notaNueva = (notaPendienteProducto && String(notaPendienteProducto.id) === String(id)) ? notaPendienteProducto.texto : '';
      if (notaNueva) notaPendienteProducto = null;
      if (existe) {
        existe.cantidad += cantidadAAgregar;
        if (notaNueva && !(existe.nota || '').includes(notaNueva)) existe.nota = ((existe.nota ? existe.nota + ' | ' : '') + notaNueva).slice(0, 120);
      } else {
        const nuevo = { id, titulo, precio, cantidad: cantidadAAgregar };
        if (extra && extra.talle) nuevo.talle = extra.talle;
        if (extra && extra.comboTalles) { nuevo.comboTalles = extra.comboTalles; nuevo.comboBase = extra.comboBase || cantidadAAgregar; }
        if (notaNueva) nuevo.nota = notaNueva;
        carrito.push(nuevo);
      }

      actualizarCarrito();
    }

    function cambiarCantidad(indice, cambio) {
      const item = carrito[indice];
      if (!item) return;

      item.cantidad += cambio;
      if (item.cantidad <= 0) carrito.splice(indice, 1);

      if (carrito.length === 0) comercioCarrito = null;
      actualizarCarrito();
    }

    // Aclaración por producto (ej: "sin cebolla"); se guarda sin redibujar para no cortar la escritura
    function mostrarNotaItem(indice) {
      const caja = document.getElementById(`cart-nota-box-${indice}`);
      if (!caja) return;
      caja.classList.remove('hidden');
      const input = document.getElementById(`cart-nota-input-${indice}`);
      if (input) input.focus();
    }

    function guardarNotaItem(indice, texto) {
      if (!carrito[indice]) return;
      const limpio = String(texto || '').trim().slice(0, 120);
      if (limpio) carrito[indice].nota = limpio; else delete carrito[indice].nota;
      guardarCarrito();
    }

    function vaciarCarrito() {
      if (carrito.length === 0) return;
      if (confirm("¿Querés vaciar todos los productos de tu carrito?")) {
        carrito = [];
        comercioCarrito = null;
        actualizarCarrito();
        cerrarModal('modal-carrito');
      }
    }

    function toggleAliasMercadoPago() {
      const medioPago = document.getElementById('cart-medio-pago').value;
      const boxAlias = document.getElementById('box-alias-mercadopago');
      const lblAlias = document.getElementById('lbl-alias-comercio');

      if (medioPago === 'Transferencia' || medioPago === 'MercadoPago / QR') {
        if (comercioCarrito && comercioCarrito.alias_mp && comercioCarrito.alias_mp.trim() !== '') {
          lblAlias.innerText = comercioCarrito.alias_mp;
          boxAlias.classList.remove('hidden');
        } else {
          boxAlias.classList.add('hidden');
        }
      } else {
        boxAlias.classList.add('hidden');
      }
    }

    function copiarAliasPago() {
      if (!comercioCarrito || !comercioCarrito.alias_mp) return;
      navigator.clipboard.writeText(comercioCarrito.alias_mp).then(() => {
        mostrarToast("¡Alias copiado al portapapeles!");
      });
    }

    // Texto del aviso de envío que ve el cliente en el carrito
    function textoEstimadoEnvio(c) {
      const min = Number(c.envio_min), max = Number(c.envio_max);
      const tieneMin = isFinite(min) && min > 0, tieneMax = isFinite(max) && max > 0;
      if (tieneMin && tieneMax) return `Costo estimativo del envío: entre ${fmtPrecio(min)} y ${fmtPrecio(max)}, según la distancia. El comercio te confirma el valor exacto.`;
      if (tieneMin) return `Costo estimativo del envío: desde ${fmtPrecio(min)}, según la distancia. El comercio te confirma el valor exacto.`;
      if (tieneMax) return `Costo estimativo del envío: hasta ${fmtPrecio(max)}, según la distancia. El comercio te confirma el valor exacto.`;
      const texto = (c.costo_envio || '').trim();
      if (texto) return `Costo del envío: ${texto}. Se suma al total de los productos.`;
      return 'El comercio te confirma el costo del envío.';
    }

    function totalCarritoActual() {
      return carrito.reduce((acc, item) => acc + (item.precio * item.cantidad), 0);
    }

    // ¿El pedido llega al monto desde el cual el comercio regala el envío?
    function envioGratisPorMonto(c, subtotal) {
      const desde = Number(c && c.envio_gratis_desde) || 0;
      return desde > 0 && subtotal >= desde;
    }

    function toggleDireccionCarrito() {
      const tipoEntrega = document.getElementById('cart-tipo-entrega').value;
      const boxDireccion = document.getElementById('box-cart-direccion');
      const leyendaEnvio = document.getElementById('cart-leyenda-envio');
      const labelNombre = document.getElementById('cart-label-nombre');
      const inputNombre = document.getElementById('cart-input-nombre-retira');
      const avisoEnvio = document.getElementById('cart-aviso-envio');
      const labelTotal = document.getElementById('cart-label-total');
      const avisoMinimo = document.getElementById('cart-aviso-minimo');
      const btnEnviar = document.getElementById('btn-enviar-pedido');

      const subtotal = totalCarritoActual();
      const esEnvio = tipoEntrega === 'envio' && Boolean(comercioCarrito);
      const gratisPorMonto = esEnvio && !comercioCarrito.envio_gratis && envioGratisPorMonto(comercioCarrito, subtotal);
      const envioConCosto = esEnvio && !comercioCarrito.envio_gratis && !gratisPorMonto;

      if (tipoEntrega === 'envio') {
        boxDireccion.classList.remove('hidden');
        if (labelNombre) labelNombre.innerText = "Nombre de la persona que recibe";
        if (inputNombre) inputNombre.placeholder = "Ej: Juan Pérez";
      } else {
        boxDireccion.classList.add('hidden');
        if (labelNombre) labelNombre.innerText = "Nombre de la persona que retira";
        if (inputNombre) inputNombre.placeholder = "Ej: Juan Pérez";
      }

      leyendaEnvio.classList.toggle('hidden', !envioConCosto);

      if (avisoEnvio) {
        const desde = Number(comercioCarrito && comercioCarrito.envio_gratis_desde) || 0;
        const titulo = document.getElementById('cart-aviso-envio-titulo');
        const tituloWrap = document.getElementById('cart-aviso-envio-titulo-wrap');
        const detalle = document.getElementById('cart-aviso-envio-detalle');
        if (envioConCosto) {
          avisoEnvio.className = 'bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs space-y-1';
          tituloWrap.className = 'font-black text-amber-800 flex items-center gap-1.5';
          detalle.className = 'text-amber-700 leading-snug';
          titulo.innerText = 'El envío no está incluido en el total';
          detalle.innerText = textoEstimadoEnvio(comercioCarrito) + (desde > 0 ? ` Te faltan ${fmtPrecio(desde - subtotal)} para tener envío gratis (desde ${fmtPrecio(desde)}).` : '');
        } else if (gratisPorMonto) {
          avisoEnvio.className = 'bg-emerald-50 border border-emerald-200 rounded-xl p-3 text-xs space-y-1';
          tituloWrap.className = 'font-black text-emerald-800 flex items-center gap-1.5';
          detalle.className = 'text-emerald-700 leading-snug';
          titulo.innerText = '¡Tu envío es gratis!';
          detalle.innerText = `Tu pedido supera ${fmtPrecio(desde)}.`;
        } else {
          avisoEnvio.className = 'hidden';
        }
      }

      if (labelTotal) labelTotal.innerText = envioConCosto ? 'Subtotal (sin envío):' : 'Total estimado:';

      const minimo = Number(comercioCarrito && comercioCarrito.pedido_minimo) || 0;
      const faltaMinimo = minimo > 0 && subtotal < minimo;
      if (avisoMinimo) {
        avisoMinimo.classList.toggle('hidden', !faltaMinimo);
        if (faltaMinimo) avisoMinimo.innerText = `Este comercio tiene un pedido mínimo de ${fmtPrecio(minimo)}. Te faltan ${fmtPrecio(minimo - subtotal)} para poder enviarlo.`;
      }
      if (btnEnviar) {
        btnEnviar.disabled = faltaMinimo;
        btnEnviar.classList.toggle('opacity-50', faltaMinimo);
        btnEnviar.classList.toggle('cursor-not-allowed', faltaMinimo);
      }
      if (window.lucide) lucide.createIcons();
    }

    function actualizarCarrito() {
      guardarCarrito();
      const totalItems = carrito.reduce((acc, item) => acc + item.cantidad, 0);
      const totalPrecio = carrito.reduce((acc, item) => acc + (item.precio * item.cantidad), 0);

      document.getElementById('cart-count').innerText = totalItems;
      document.getElementById('cart-total-precio').innerText = `${fmtPrecio(totalPrecio)}`;

      const barraFlotante = document.getElementById('barra-flotante-carrito');
      const btnVaciar = document.getElementById('btn-vaciar-carrito');

      if (totalItems > 0) {
        barraFlotante.classList.remove('hidden');
        document.getElementById('float-cart-count').innerText = totalItems;
        document.getElementById('float-cart-total').innerText = `${fmtPrecio(totalPrecio)}`;
        if (btnVaciar) btnVaciar.classList.remove('hidden');
      } else {
        barraFlotante.classList.add('hidden');
        if (btnVaciar) btnVaciar.classList.add('hidden');
      }

      const itemsContainer = document.getElementById('carrito-items');
      const opcionesExtra = document.getElementById('carrito-opciones-extra');
      const boxEntrega = document.getElementById('box-cart-tipo-entrega');
      const boxInfoRetiroDirecto = document.getElementById('box-cart-info-retiro-directo');
      const selectPago = document.getElementById('cart-medio-pago');

      itemsContainer.innerHTML = '';

      if (carrito.length === 0) {
        itemsContainer.innerHTML = `<p class="text-xs text-slate-400 text-center py-4 font-semibold">El carrito está vacío.</p>`;
        document.getElementById('cart-comercio-nombre').innerText = "Resumen del pedido";
        opcionesExtra.classList.add('hidden');
        document.getElementById('cart-leyenda-envio').classList.add('hidden');
        return;
      }

      opcionesExtra.classList.remove('hidden');
      document.getElementById('cart-comercio-nombre').innerText = `Pedido para: ${comercioCarrito.nombre}`;

      selectPago.innerHTML = '';
      if (comercioCarrito.pagos_efectivo) selectPago.innerHTML += `<option value="Efectivo">Efectivo</option>`;
      if (comercioCarrito.pagos_transferencia) selectPago.innerHTML += `<option value="Transferencia">Transferencia</option>`;
      if (comercioCarrito.pagos_qr) selectPago.innerHTML += `<option value="MercadoPago / QR">MercadoPago / QR</option>`;
      if (comercioCarrito.pagos_cuenta_dni) selectPago.innerHTML += `<option value="Cuenta DNI">Cuenta DNI</option>`;
      if (comercioCarrito.pagos_tarjeta) selectPago.innerHTML += `<option value="Tarjeta Débito/Crédito">Tarjeta Débito / Crédito</option>`;
      if (selectPago.options.length === 0) selectPago.innerHTML = `<option value="A convenir">A convenir con el comercio</option>`;

      toggleAliasMercadoPago();

      const permiteEnvios = Boolean(comercioCarrito.hace_envios || comercioCarrito.envio_gratis);

      if (permiteEnvios) {
        boxEntrega.classList.remove('hidden');
        boxInfoRetiroDirecto.classList.add('hidden');
      } else {
        boxEntrega.classList.add('hidden');
        boxInfoRetiroDirecto.classList.remove('hidden');
        document.getElementById('cart-lbl-horario-retiro').innerText = obtenerHorarioHoyTexto(comercioCarrito);
        document.getElementById('cart-lbl-dir-retiro').innerText = comercioCarrito.direccion || 'Necochea';
      }

      toggleDireccionCarrito();

      carrito.forEach((item, i) => {
        itemsContainer.innerHTML += `
          <div class="bg-slate-50 p-3 rounded-xl border border-slate-200">
            <div class="flex items-center justify-between">
              <div class="pr-2 min-w-0 flex-1">
                <p class="font-bold text-xs text-slate-800 leading-tight">${esc(item.titulo)}</p>
                <p class="text-[11px] text-brand-600 font-extrabold mt-0.5">${fmtPrecio(item.precio * item.cantidad)}</p>
              </div>
              <div class="flex items-center gap-2 bg-white border border-slate-200 rounded-lg px-2 py-1 flex-shrink-0 shadow-sm">
                <button type="button" onclick="cambiarCantidad(${i}, -1)" class="text-slate-400 hover:text-slate-700 font-black text-sm px-1" aria-label="Quitar uno">-</button>
                <span class="text-xs font-bold text-slate-800 px-1">${item.cantidad}</span>
                <button type="button" onclick="cambiarCantidad(${i}, 1)" class="text-slate-400 hover:text-slate-700 font-black text-sm px-1" aria-label="Sumar uno">+</button>
              </div>
            </div>
            ${item.nota ? '' : `<button type="button" onclick="mostrarNotaItem(${i})" class="mt-1.5 text-[10px] font-bold text-brand-600 underline">+ Aclaración (ej: sin cebolla)</button>`}
            <div id="cart-nota-box-${i}" class="${item.nota ? '' : 'hidden'} mt-1.5">
              <input type="text" id="cart-nota-input-${i}" maxlength="120" value="${esc(item.nota || '')}" oninput="guardarNotaItem(${i}, this.value)" placeholder="Aclaración para este producto" class="w-full clean-input px-3 py-2 rounded-lg text-[11px] font-medium">
            </div>
          </div>
        `;
      });

      if (window.lucide) lucide.createIcons();
    }

    let enviandoPedido = false;

    // Cuánto necesita cada producto (si hay promos, también los productos que las componen)
    function calcularNecesidadesStock() {
      const need = {};
      const sumar = (id, n, talle) => {
        const k = `${id}|${talle || ''}`;
        if (!need[k]) need[k] = { id: String(id), cant: 0, talle: talle || '' };
        need[k].cant += n;
      };
      carrito.forEach(item => {
        sumar(item.id, item.cantidad, item.talle);
        const prod = (comercioCarrito.productos || []).find(p => String(p.id) === String(item.id));
        if (prod && prod.es_combo && prod.items_combo) {
          let comps = [];
          try { comps = typeof prod.items_combo === 'string' ? JSON.parse(prod.items_combo) : prod.items_combo; } catch (e) {}
          // Si la promo se pidió con talles (ej: 2 zapatillas), se descuenta de cada talle elegido; si no, del stock total
          const factor = Math.max(1, Math.round(item.cantidad / (item.comboBase || item.cantidad || 1)));
          (comps || []).forEach(c => {
            const elegidos = (item.comboTalles || []).filter(e => String(e.prodId) === String(c.prodId));
            if (elegidos.length) elegidos.forEach(e => sumar(c.prodId, factor, e.talle));
            else sumar(c.prodId, (Number(c.cantidad) || 0) * item.cantidad, '');
          });
        }
      });
      return Object.values(need).filter(x => x.cant > 0).map(x => x.talle ? x : { id: x.id, cant: x.cant });
    }

    function refrescarProductosPorStock() {
      if (comercioActivo) {
        renderizarProductosComercio(comercioActivo.productos, usuarioActual && comercioActivo.user_id === usuarioActual.id, comercioActivo.color_acento || '#f97316');
      }
    }

    function avisarFaltantesStock(faltantes) {
      const lineas = faltantes.map(f => {
        const prod = (comercioCarrito.productos || []).find(p => String(p.id) === String(f.id));
        if (prod && typeof f.stock === 'number') {
          if (f.talle) {
            prod.stock_talles = { ...(prod.stock_talles || {}), [f.talle]: f.stock };
            prod.stock = Object.values(prod.stock_talles).reduce((a, n) => a + (parseInt(n) || 0), 0);
          } else prod.stock = f.stock;
        }
        const nombre = (f.titulo || (prod && prod.titulo) || 'Producto') + (f.talle ? ` (talle ${f.talle})` : '');
        return Number(f.stock) > 0 ? `• ${nombre}: quedan ${f.stock}` : `• ${nombre}: sin stock`;
      });
      alert('Algunos productos ya no tienen stock suficiente:\n\n' + lineas.join('\n') + '\n\nAjustá las cantidades de tu carrito y volvé a intentar.');
      refrescarProductosPorStock();
      return false;
    }

    // Verifica el stock real en el servidor y lo descuenta en una sola operación.
    async function reservarStockCarrito() {
      const items = calcularNecesidadesStock();
      const { data, error } = await _supabase.rpc('reservar_stock_carrito', { p_items: items });

      if (error) {
        const sinFuncion = error.code === 'PGRST202' || /could not find the function/i.test(error.message || '');
        if (!sinFuncion) {
          alert('No pudimos verificar el stock en este momento. Intentá de nuevo en unos segundos.');
          return false;
        }
        // Respaldo: si todavía no corriste el SQL nuevo, verifica con datos frescos y usa la función vieja.
        const porProducto = {};
        items.forEach(i => { porProducto[i.id] = (porProducto[i.id] || 0) + i.cant; });
        const { data: frescos, error: errFrescos } = await _supabase.from('productos').select('id, titulo, stock, disponible').in('id', Object.keys(porProducto));
        if (errFrescos) { alert('No pudimos verificar el stock. Intentá de nuevo.'); return false; }
        const faltantes = [];
        (frescos || []).forEach(pf => {
          const need = { cant: porProducto[String(pf.id)] || 0 };
          const tiene = pf.stock !== null && pf.stock !== undefined;
          if (pf.disponible === false || (tiene && pf.stock < need.cant)) {
            faltantes.push({ id: pf.id, titulo: pf.titulo, stock: pf.disponible === false ? 0 : pf.stock });
          }
        });
        if (faltantes.length) return avisarFaltantesStock(faltantes);
        for (const pf of (frescos || [])) {
          if (pf.stock === null || pf.stock === undefined) continue;
          await _supabase.rpc('descontar_stock', { p_producto: String(pf.id), p_cant: porProducto[String(pf.id)] || 0 });
        }
      } else if (data && data.ok === false) {
        if (data.faltantes) return avisarFaltantesStock(data.faltantes);
        alert('No se pudo procesar el pedido. Revisá las cantidades de tu carrito.');
        return false;
      }

      // Reflejar el descuento en pantalla
      items.forEach(it => {
        const prod = (comercioCarrito.productos || []).find(p => String(p.id) === String(it.id));
        if (!prod) return;
        if (it.talle && prod.stock_talles && Object.prototype.hasOwnProperty.call(prod.stock_talles, it.talle)) {
          prod.stock_talles[it.talle] = Math.max(0, (parseInt(prod.stock_talles[it.talle]) || 0) - it.cant);
        }
        if (prod.stock !== null && prod.stock !== undefined) prod.stock = Math.max(0, parseInt(prod.stock) - it.cant);
      });
      return true;
    }

    async function enviarPedidoWhatsApp() {
      if (enviandoPedido) return;
      if (carrito.length === 0) return;
      if (!comercioCarrito) return;

      const medioPago = document.getElementById('cart-medio-pago').value;
      const nombreRetira = document.getElementById('cart-input-nombre-retira').value.trim();
      const permiteEnvios = Boolean(comercioCarrito.hace_envios || comercioCarrito.envio_gratis);
      const tipoEntrega = permiteEnvios ? document.getElementById('cart-tipo-entrega').value : 'retiro';
      const direccion = permiteEnvios && tipoEntrega === 'envio' ? document.getElementById('cart-input-direccion').value.trim() : '';

      if (!nombreRetira) {
        alert("Por favor, ingresá el nombre correspondiente.");
        document.getElementById('cart-input-nombre-retira').focus();
        return;
      }

      if (permiteEnvios && tipoEntrega === 'envio' && !direccion) {
        alert("Por favor, ingresá tu dirección para poder realizar el envío.");
        document.getElementById('cart-input-direccion').focus();
        return;
      }

      const subtotalPedido = totalCarritoActual();
      const minimoPedido = Number(comercioCarrito.pedido_minimo) || 0;
      if (minimoPedido > 0 && subtotalPedido < minimoPedido) {
        alert(`El pedido mínimo de este comercio es ${fmtPrecio(minimoPedido)}. Te faltan ${fmtPrecio(minimoPedido - subtotalPedido)}.`);
        return;
      }

      enviandoPedido = true;
      try {
        const stockOk = await reservarStockCarrito();
        if (!stockOk) return;
      } finally {
        enviandoPedido = false;
      }

      let mensaje = `¡Hola *${comercioCarrito.nombre}*! Quiero realizar el siguiente pedido desde *NecoVende*:\n\n`;
      let total = 0;
      let itemsGuardarHistorial = [];

      for (const item of carrito) {
        const subtotal = item.precio * item.cantidad;
        total += subtotal;
        mensaje += `• *${item.cantidad}x* ${item.titulo} (${fmtPrecio(subtotal)})\n`;
        if (item.nota) mensaje += `   _📝 ${item.nota}_\n`;
        itemsGuardarHistorial.push({ id: item.id, titulo: item.titulo, precio: item.precio, cantidad: item.cantidad });
      }

      mensaje += `\n📌 *Detalles del Pedido:*\n`;
      mensaje += `• *Medio de pago:* ${medioPago}\n`;
      const notaGeneral = (document.getElementById('cart-nota-general').value || '').trim().slice(0, 200);
      if (notaGeneral) mensaje += `• *Aclaración:* ${notaGeneral}\n`;

      const envioPendiente = permiteEnvios && tipoEntrega === 'envio' && !comercioCarrito.envio_gratis && !envioGratisPorMonto(comercioCarrito, total);

      if (permiteEnvios && tipoEntrega === 'envio') {
        mensaje += `• *Persona que recibe:* ${nombreRetira}\n`;
        mensaje += `• *Entrega:* Envío a domicilio\n`;
        mensaje += `• *Dirección:* ${direccion}\n`;
        if (envioPendiente) {
          mensaje += `\n*Subtotal de productos (sin envío):* ${fmtPrecio(total)}\n`;
          mensaje += `• *Costo del envío:* a confirmar\n`;
        } else {
          mensaje += `\n*Total a pagar:* ${fmtPrecio(total)} (envío gratis)\n`;
        }
      } else {
        mensaje += `• *Persona que retira:* ${nombreRetira}\n`;
        mensaje += `• *Horario de retiro:* ${obtenerHorarioHoyTexto(comercioCarrito)}\n`;
        mensaje += `• *Dirección:* ${comercioCarrito.direccion || 'Necochea'}\n`;
        mensaje += `\n*Total a pagar:* ${fmtPrecio(total)}\n`;
      }

      mensaje += envioPendiente
        ? `\n¿Me pasarías el total con el envío incluido y me confirmás la recepción del pedido? ¡Muchas gracias!`
        : `\n¿Me confirman la recepción? ¡Muchas gracias!`;

      guardarPedidoEnHistorial({
        comercioId: comercioCarrito.id,
        comercioNombre: comercioCarrito.nombre,
        items: itemsGuardarHistorial,
        total: total,
        fecha: new Date().toLocaleDateString() + ' ' + new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      });

      document.getElementById('cart-nota-general').value = '';
      cerrarModal('modal-carrito');
      mostrarToast(`Pedido enviado a ${comercioCarrito.nombre} vía WhatsApp.`);

      if (comercioActivo) {
        renderizarProductosComercio(comercioActivo.productos, usuarioActual && comercioActivo.user_id === usuarioActual.id, comercioActivo.color_acento || '#f97316');
      }

      // Se anota el pedido para las estadísticas del comerciante (si falta el SQL 05 simplemente no se cuenta)
      try { _supabase.rpc('registrar_pedido', { p_comercio: String(comercioCarrito.id), p_monto: total }).then(() => {}, () => {}); } catch (e) {}

      const url = `https://wa.me/${comercioCarrito.telefono_whatsapp}?text=${encodeURIComponent(mensaje)}`;
      const ventana = window.open(url, '_blank');
      if (!ventana) window.location.href = url;  // el navegador bloqueó la ventana nueva
    }
