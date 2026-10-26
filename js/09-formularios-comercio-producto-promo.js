    // FORMULARIO DE REGISTRO DE COMERCIO CON CATEGORÍA PRINCIPAL Y SUBCATEGORÍAS
    function inicializarSelectCategoriasFormulario(catPrincipalActual = '', subcatsActuales = []) {
      const selectCatPrin = document.getElementById('comercio-cat-principal');
      selectCatPrin.innerHTML = '';

      Object.keys(CATEGORIAS_JERARQUICAS).forEach(catPrin => {
        selectCatPrin.innerHTML += `<option value="${esc(catPrin)}" ${catPrincipalActual === catPrin ? 'selected' : ''}>${esc(catPrin)}</option>`;
      });

      actualizarSubcategoriasFormulario(subcatsActuales);
    }

    function actualizarSubcategoriasFormulario(subcatsActuales = []) {
      const selectCatPrin = document.getElementById('comercio-cat-principal').value;
      const grid = document.getElementById('grid-subcategorias-form');
      grid.innerHTML = '';

      const subcategoriasDisponibles = [...(CATEGORIAS_JERARQUICAS[selectCatPrin] || [])];
      // Si el comercio ya tenía una subcategoría que después se ocultó, se sigue mostrando para no perderla al guardar
      const rubroAdmin = categoriasAdmin.find(r => r.nombre === selectCatPrin);
      if (rubroAdmin) rubroAdmin.subs.filter(s => s.activa === false && subcatsActuales.includes(s.nombre)).forEach(s => subcategoriasDisponibles.push(s.nombre));

      subcategoriasDisponibles.forEach(sub => {
        const isChecked = subcatsActuales.includes(sub);
        grid.innerHTML += `
          <label class="flex items-center gap-2 cursor-pointer text-[11px] text-slate-700">
            <input type="checkbox" name="subcat-checkbox" value="${esc(sub)}" ${isChecked ? 'checked' : ''} onchange="validarLimiteSubcategorias(this)" class="rounded border-slate-300 text-brand-500 focus:ring-brand-500">
            <span class="truncate">${esc(sub)}</span>
          </label>
        `;
      });

      actualizarContadorSubcategorias();
      evaluarCamposEspecialesSegunCategoria();
    }

    function validarLimiteSubcategorias(checkbox) {
      const seleccionados = document.querySelectorAll('input[name="subcat-checkbox"]:checked');
      if (seleccionados.length > 3) {
        checkbox.checked = false;
        alert("Podés seleccionar un máximo de 3 subcategorías por comercio.");
      }
      actualizarContadorSubcategorias();
      evaluarCamposEspecialesSegunCategoria();
    }

    function actualizarContadorSubcategorias() {
      const total = document.querySelectorAll('input[name="subcat-checkbox"]:checked').length;
      document.getElementById('cat-count-badge').innerText = `${total} / 3`;
    }

    function obtenerSubcategoriasSeleccionadasModal() {
      const checkboxes = document.querySelectorAll('input[name="subcat-checkbox"]:checked');
      return Array.from(checkboxes).map(cb => cb.value);
    }

    function evaluarCamposEspecialesSegunCategoria() {
      const subcats = obtenerSubcategoriasSeleccionadasModal();
      const secSabores = document.getElementById('seccion-sabores-config');
      const secCoccion = document.getElementById('seccion-coccion-config');

      const flagsCat = flagsDeSubcategorias(subcats);
      if (flagsCat.sabores) {
        secSabores.classList.remove('hidden');
      } else {
        secSabores.classList.add('hidden');
      }

      if (flagsCat.coccion) {
        secCoccion.classList.remove('hidden');
      } else {
        secCoccion.classList.add('hidden');
      }
    }

    function actualizarVisibilidadCamposSegunPlanRegistro() {
      const planElegido = document.getElementById('comercio-plan-select').value;
      const secEnlaces = document.getElementById('seccion-enlaces-form');
      const boxEnlace1 = document.getElementById('box-enlace-1');
      const inputsUltraExtra = document.querySelectorAll('.ultra-enlace-input');
      const secUltraVisual = document.getElementById('seccion-ultra-visual');

      if (planElegido === 'gratis') {
        secEnlaces.classList.add('hidden');
        secUltraVisual.classList.add('hidden');
      } else if (planElegido === 'pro') {
        secEnlaces.classList.remove('hidden');
        boxEnlace1.classList.remove('hidden');
        inputsUltraExtra.forEach(el => el.classList.add('hidden'));
        secUltraVisual.classList.add('hidden');
      } else if (planElegido === 'ultra') {
        secEnlaces.classList.remove('hidden');
        boxEnlace1.classList.remove('hidden');
        inputsUltraExtra.forEach(el => el.classList.remove('hidden'));
        secUltraVisual.classList.remove('hidden');
      }
    }

    document.getElementById('comercio-plan-select').addEventListener('change', actualizarVisibilidadCamposSegunPlanRegistro);

    function prepararModalNuevoComercio() {
      document.getElementById('form-comercio').reset();
      document.getElementById('comercio-edit-id').value = '';
      document.getElementById('comercio-logo-existente').value = '';
      document.getElementById('comercio-portada-existente').value = '';
      document.getElementById('modal-comercio-head-title').innerText = 'Registrar mi Comercio';
      document.getElementById('modal-comercio-head-sub').innerText = 'Sumá tu negocio a NecoVende.';
      document.getElementById('btn-guardar-comercio').innerText = 'Solicitar Alta';
      document.getElementById('help-logo-edit').innerText = '';
      document.getElementById('help-portada-edit').innerText = '';
      document.getElementById('contenedor-btn-eliminar-comercio').classList.add('hidden');

      document.getElementById('box-plan-registro').classList.remove('hidden');
      document.getElementById('comercio-plan-select').value = 'gratis';

      document.getElementById('envios').checked = true;
      document.getElementById('envio-gratis').checked = false;
      toggleCampoCostoEnvio();

      document.getElementById('costo-envio').value = "A convenir según zona";
      document.getElementById('envio-min').value = "";
      document.getElementById('envio-max').value = "";
      document.getElementById('envio-gratis-desde').value = "";
      document.getElementById('pedido-minimo').value = "";
      document.getElementById('comercio-color-primario').value = "#f8fafc";
      document.getElementById('comercio-color-acento').value = "#ea580c";
      document.getElementById('comercio-posicion-portada').value = "object-center";

      document.getElementById('pago-efectivo').checked = true;
      document.getElementById('pago-transferencia').checked = true;

      actualizarVisibilidadCamposSegunPlanRegistro();
      renderizarGrillaHorarios({});
      inicializarSelectCategoriasFormulario(Object.keys(CATEGORIAS_JERARQUICAS)[0] || '', []);
      abrirModal('modal-registro');
    }

    function prepararModalEditarComercio(comercioId) {
      const c = comerciosGlobales.find(item => item.id === comercioId);
      if (!c) return;

      document.getElementById('form-comercio').reset();
      document.getElementById('comercio-edit-id').value = c.id;
      document.getElementById('comercio-logo-existente').value = c.logo_url || '';
      document.getElementById('comercio-portada-existente').value = c.portada_url || '';

      document.getElementById('box-plan-registro').classList.add('hidden');

      document.getElementById('nombre').value = c.nombre;
      document.getElementById('telefono').value = c.telefono_whatsapp;
      document.getElementById('alias-mp').value = c.alias_mp || '';
      document.getElementById('titular-alias').value = c.titular_alias || '';
      document.getElementById('direccion').value = c.direccion || '';
      
      document.getElementById('envios').checked = Boolean(c.hace_envios);
      document.getElementById('envio-gratis').checked = Boolean(c.envio_gratis);
      toggleCampoCostoEnvio();

      document.getElementById('costo-envio').value = c.costo_envio || "";
      document.getElementById('envio-min').value = c.envio_min != null ? c.envio_min : "";
      document.getElementById('envio-max').value = c.envio_max != null ? c.envio_max : "";
      document.getElementById('envio-gratis-desde').value = c.envio_gratis_desde != null ? c.envio_gratis_desde : "";
      document.getElementById('pedido-minimo').value = c.pedido_minimo != null ? c.pedido_minimo : "";
      document.getElementById('comercio-color-primario').value = c.color_primario || "#f8fafc";
      document.getElementById('comercio-color-acento').value = c.color_acento || "#ea580c";
      document.getElementById('comercio-posicion-portada').value = c.posicion_portada || "object-center";

      document.getElementById('sabores-input').value = c.sabores ? c.sabores.join(', ') : '';
      document.getElementById('tipo-coccion-select').value = c.tipo_coccion_empanadas || 'ambas';

      const plan = c.plan || 'gratis';
      const secEnlaces = document.getElementById('seccion-enlaces-form');
      const boxEnlace1 = document.getElementById('box-enlace-1');
      const secUltraVisual = document.getElementById('seccion-ultra-visual');
      const inputsUltraExtra = document.querySelectorAll('.ultra-enlace-input');

      if (plan === 'pro') {
        secEnlaces.classList.remove('hidden');
        boxEnlace1.classList.remove('hidden');
        inputsUltraExtra.forEach(el => el.classList.add('hidden'));
        secUltraVisual.classList.add('hidden');
        const redes = c.redes_sociales || [];
        if (redes[0]) {
          document.getElementById('red-tipo-1').value = redes[0].tipo || 'instagram';
          document.getElementById('red-url-1').value = redes[0].url || '';
        }
      } else if (plan === 'ultra') {
        secEnlaces.classList.remove('hidden');
        boxEnlace1.classList.remove('hidden');
        inputsUltraExtra.forEach(el => el.classList.remove('hidden'));
        secUltraVisual.classList.remove('hidden');
        const redes = c.redes_sociales || [];
        if (redes[0]) {
          document.getElementById('red-tipo-1').value = redes[0].tipo || 'instagram';
          document.getElementById('red-url-1').value = redes[0].url || '';
        }
        if (redes[1]) {
          document.getElementById('red-tipo-2').value = redes[1].tipo || 'facebook';
          document.getElementById('red-url-2').value = redes[1].url || '';
        }
        if (redes[2]) {
          document.getElementById('red-tipo-3').value = redes[2].tipo || 'web';
          document.getElementById('red-url-3').value = redes[2].url || '';
        }
      } else {
        secEnlaces.classList.add('hidden');
        secUltraVisual.classList.add('hidden');
      }

      document.getElementById('pago-efectivo').checked = Boolean(c.pagos_efectivo);
      document.getElementById('pago-transferencia').checked = Boolean(c.pagos_transferencia);
      document.getElementById('pago-qr').checked = Boolean(c.pagos_qr);
      document.getElementById('pago-cuenta-dni').checked = Boolean(c.pagos_cuenta_dni);
      document.getElementById('pago-tarjeta').checked = Boolean(c.pagos_tarjeta);

      renderizarGrillaHorarios(c.horarios_dias || {});

      const subcats = c.subcategorias || c.categorias || [c.categoria].filter(Boolean);
      const catPrin = c.categoria_principal || Object.keys(CATEGORIAS_JERARQUICAS)[0] || '';
      inicializarSelectCategoriasFormulario(catPrin, subcats);

      document.getElementById('modal-comercio-head-title').innerText = 'Editar mi Comercio';
      document.getElementById('modal-comercio-head-sub').innerText = `Modificando: ${c.nombre} (${plan.toUpperCase()})`;
      document.getElementById('btn-guardar-comercio').innerText = 'Guardar Cambios';
      document.getElementById('contenedor-btn-eliminar-comercio').classList.remove('hidden');

      document.getElementById('help-logo-edit').innerText = c.logo_url ? 'Dejá el campo vacío si querés conservar el logo actual.' : '';
      document.getElementById('help-portada-edit').innerText = c.portada_url ? 'Dejá el campo vacío si querés conservar la portada actual.' : '';

      abrirModal('modal-registro');
    }

    async function eliminarComercioActual() {
      const editId = document.getElementById('comercio-edit-id').value;
      if (!editId) return;

      const c = comerciosGlobales.find(item => item.id === editId);
      if (!confirm(`¿Estás seguro de eliminar definitivamente "${c ? c.nombre : 'este comercio'}"?`)) return;

      const { error } = await _supabase.from('comercios').delete().eq('id', editId);
      if (error) {
        alert('Error al eliminar: ' + error.message);
      } else {
        alert('Comercio eliminado con éxito.');
        cerrarModal('modal-registro');
        mostrarInicio();
        await cargarComercios();
      }
    }

    function toggleBoxConfigSabores() {
      const checkSabores = document.getElementById('prod-requiere-sabores').checked;
      const subBox = document.getElementById('sub-box-config-sabores');
      if (checkSabores) subBox.classList.remove('hidden');
      else subBox.classList.add('hidden');
    }

    function toggleBoxVariantes() {
      const checkVariantes = document.getElementById('prod-tiene-variantes').checked;
      const subBox = document.getElementById('sub-box-config-variantes');
      if (checkVariantes) subBox.classList.remove('hidden');
      else subBox.classList.add('hidden');
    }

    function toggleInputMaxSabores() {
      const sinLimite = document.getElementById('prod-sin-limite-sabores').checked;
      const boxMax = document.getElementById('box-input-max-sabores');
      if (sinLimite) boxMax.classList.add('hidden');
      else boxMax.classList.remove('hidden');
    }

    async function prepararModalProducto(comercioId, nombreComercio) {
      const comercio = comerciosGlobales.find(c => c.id === comercioId);
      if (!comercio) return;

      const { count, error } = await _supabase
        .from('productos')
        .select('*', { count: 'exact', head: true })
        .eq('comercio_id', comercioId);

      const totalProds = count || 0;
      const plan = comercio.plan || 'gratis';

      if (plan === 'gratis' && totalProds >= 5) {
        alert("⚠️ Llegaste al límite de 5 productos de la Versión Gratuita. Actualizá tu plan a Pro o Ultra para seguir publicando.");
        abrirModal('modal-planes');
        return;
      }
      if (plan === 'pro' && totalProds >= 10) {
        alert("⚠️ Llegaste al límite de 10 productos de la Versión Pro. Actualizá a Plan Ultra para productos ilimitados.");
        abrirModal('modal-planes');
        return;
      }

      document.getElementById('form-producto').reset();
      renderizarStockTalles({});
      document.getElementById('prod-comercio-id').value = comercioId;
      document.getElementById('prod-edit-id').value = '';
      document.getElementById('prod-imagen-existente').value = '';
      document.getElementById('prod-es-origen-promo').value = 'false';
      document.getElementById('prod-stock').value = '';
      renderizarStockTalles({});

      const subs = comercio?.subcategorias || comercio?.categorias || [comercio?.categoria];
      // Las opciones (sabores / cocción / talles) se definen por categoría en el panel de admin
      const flagsCat = flagsDeSubcategorias(subs);
      const esEmpanadas = flagsCat.coccion;
      const esGastronomiaConSabores = flagsCat.sabores;
      const esComercioRetail = flagsCat.talles;

      const boxSaboresProd = document.getElementById('box-check-sabores-prod');
      const boxCoccionProd = document.getElementById('box-check-coccion-prod');
      const boxVariantesProd = document.getElementById('box-check-variantes-prod');
      const boxSoloPromoWrapper = document.getElementById('box-solo-promo-wrapper');

      if (esGastronomiaConSabores) boxSaboresProd.classList.remove('hidden');
      else boxSaboresProd.classList.add('hidden');

      if (esEmpanadas) boxCoccionProd.classList.remove('hidden');
      else boxCoccionProd.classList.add('hidden');

      if (esComercioRetail) boxVariantesProd.classList.remove('hidden');
      else boxVariantesProd.classList.add('hidden');

      if (plan === 'ultra') boxSoloPromoWrapper.classList.remove('hidden');
      else boxSoloPromoWrapper.classList.add('hidden');
      ajustarCampoOferta(plan);

      document.getElementById('modal-producto-titulo-head').innerText = 'Agregar Producto';
      document.getElementById('subtitulo-comercio-prod').innerText = `Publicando en: ${nombreComercio} (${plan.toUpperCase()})`;
      document.getElementById('btn-guardar-producto').innerText = 'Publicar Producto';
      document.getElementById('help-imagen-edit').innerText = '';

      abrirModal('modal-producto');
    }

    function crearProductoDesdePromo() {
      cerrarModal('modal-promo');
      prepararModalProducto(comercioActivo.id, comercioActivo.nombre);
      document.getElementById('prod-solo-promo').checked = true;
      document.getElementById('prod-es-origen-promo').value = 'true';
    }

    // La oferta (precio anterior tachado) es exclusiva del plan Ultra
    function ajustarCampoOferta(plan) {
      const input = document.getElementById('prod-precio-anterior');
      const ayuda = document.getElementById('prod-oferta-ayuda');
      const esUltra = plan === 'ultra';
      input.disabled = !esUltra;
      if (!esUltra) input.value = '';
      ayuda.innerText = esUltra
        ? 'Se muestra tachado y con el % de descuento. Dejalo vacío si no es oferta.'
        : '🔒 Las ofertas con precio tachado son del plan Ultra.';
    }

    function prepararEditarProducto(prodId) {
      const p = comercioActivo?.productos?.find(item => item.id === prodId);
      if (!p) return;

      document.getElementById('form-producto').reset();
      document.getElementById('prod-edit-id').value = p.id;
      document.getElementById('prod-comercio-id').value = comercioActivo.id;
      document.getElementById('prod-titulo').value = p.titulo;
      document.getElementById('prod-precio').value = p.precio;
      document.getElementById('prod-stock').value = (p.stock !== null && p.stock !== undefined) ? p.stock : '';
      document.getElementById('prod-precio-anterior').value = p.precio_anterior || '';
      document.getElementById('prod-seccion').value = p.seccion || '';
      document.getElementById('prod-descripcion').value = p.descripcion || '';
      document.getElementById('prod-imagen-existente').value = p.imagen_url || '';
      document.getElementById('prod-requiere-sabores').checked = Boolean(p.requiere_sabores);
      document.getElementById('prod-sin-limite-sabores').checked = p.max_sabores === 0 || p.max_sabores === 999;
      document.getElementById('prod-max-sabores').value = p.max_sabores && p.max_sabores !== 999 ? p.max_sabores : '';
      document.getElementById('prod-sabores-especificos').value = (p.sabores_especificos || []).join(', ');
      document.getElementById('prod-opciones-custom-input').value = (p.opciones_custom || []).join(', ');
      document.getElementById('prod-requiere-coccion').checked = Boolean(p.requiere_coccion);
      document.getElementById('prod-tiene-variantes').checked = Boolean((p.talles_disponibles || []).length || (p.colores_disponibles || []).length);
      document.getElementById('prod-talles-input').value = (p.talles_disponibles || []).join(', ');
      document.getElementById('prod-colores-input').value = (p.colores_disponibles || []).join(', ');
      renderizarStockTalles(p.stock_talles && typeof p.stock_talles === 'object' ? p.stock_talles : {});
      toggleBoxConfigSabores(); toggleInputMaxSabores(); toggleBoxVariantes();
      document.getElementById('prod-es-origen-promo').value = 'false';

      const plan = comercioActivo.plan || 'gratis';
      const boxSoloPromoWrapper = document.getElementById('box-solo-promo-wrapper');
      if (plan === 'ultra') boxSoloPromoWrapper.classList.remove('hidden');
      else boxSoloPromoWrapper.classList.add('hidden');
      ajustarCampoOferta(plan);

      document.getElementById('modal-producto-titulo-head').innerText = 'Editar Producto';
      document.getElementById('subtitulo-comercio-prod').innerText = `Modificando: ${p.titulo}`;
      document.getElementById('btn-guardar-producto').innerText = 'Guardar Cambios';

      abrirModal('modal-producto');
    }

    function prepararModalPromo() {
      if (!comercioActivo || comercioActivo.plan !== 'ultra') {
        alert("⚠️ La creación de promociones y combos es exclusiva para comercios con Plan Ultra.");
        abrirModal('modal-planes');
        return;
      }
      document.getElementById('form-promo').reset();
      document.getElementById('promo-edit-id').value = '';
      promoItemsSeleccionados = {};

      renderizarPickerProductosPromo();
      calcularDescuentoPromo();
      abrirModal('modal-promo');
    }

    function renderizarPickerProductosPromo() {
      const picker = document.getElementById('lista-productos-promo-picker');
      picker.innerHTML = '';

      const prodsDisponibles = (comercioActivo.productos || []).filter(p => !p.es_combo);

      if (prodsDisponibles.length === 0) {
        picker.innerHTML = `<p class="text-xs text-slate-400 text-center py-2">No hay productos cargados aún.</p>`;
        return;
      }

      prodsDisponibles.forEach(p => {
        const cant = promoItemsSeleccionados[p.id] || 0;
        picker.innerHTML += `
          <div class="flex items-center justify-between bg-white p-2.5 rounded-xl border border-slate-200 text-xs shadow-sm">
            <div class="truncate pr-2 min-w-0 flex-1">
              <span class="font-bold text-slate-700 truncate">${esc(p.titulo)}</span>
              <span class="text-[10px] text-amber-600 font-extrabold block">${fmtPrecio(p.precio)}</span>
            </div>
            <div class="flex items-center gap-2 bg-slate-100 rounded-lg px-2 py-1 flex-shrink-0 border border-slate-200">
              <button type="button" onclick="modificarCantidadItemPromo('${p.id}', -1)" class="w-6 h-6 flex items-center justify-center bg-white border border-slate-200 rounded-md text-slate-700 font-black text-xs">-</button>
              <span id="cant-promo-item-${p.id}" class="text-xs font-black text-slate-700 w-4 text-center">${cant}</span>
              <button type="button" onclick="modificarCantidadItemPromo('${p.id}', 1)" class="w-6 h-6 flex items-center justify-center bg-amber-500 rounded-md text-white font-black text-xs">+</button>
            </div>
          </div>
        `;
      });
    }

    function modificarCantidadItemPromo(prodId, cambio) {
      const actual = promoItemsSeleccionados[prodId] || 0;
      const nuevo = actual + cambio;
      if (nuevo >= 0) {
        promoItemsSeleccionados[prodId] = nuevo;
        if (nuevo === 0) delete promoItemsSeleccionados[prodId];
        const elem = document.getElementById(`cant-promo-item-${prodId}`);
        if (elem) elem.innerText = nuevo;
        calcularDescuentoPromo();
      }
    }

    function calcularDescuentoPromo() {
      let sumaOriginal = 0;
      for (const [pId, cant] of Object.entries(promoItemsSeleccionados)) {
        const p = comercioActivo?.productos?.find(x => x.id === pId);
        if (p) sumaOriginal += (p.precio * cant);
      }

      document.getElementById('promo-precio-original-suma').innerText = `${fmtPrecio(sumaOriginal)}`;
      const precioFinalVal = parseFloat(document.getElementById('promo-precio-final').value) || 0;
      const badgeDesc = document.getElementById('badge-promo-descuento-calc');

      if (sumaOriginal > 0 && precioFinalVal > 0 && precioFinalVal < sumaOriginal) {
        const ahorro = sumaOriginal - precioFinalVal;
        const porc = Math.round((ahorro / sumaOriginal) * 100);
        badgeDesc.innerText = `🔥 ${porc}% OFF`;
      } else {
        badgeDesc.innerText = `0% OFF`;
      }
    }

    function prepararEditarPromo(promoId) {
      const p = comercioActivo?.productos?.find(item => item.id === promoId);
      if (!p) return;

      document.getElementById('form-promo').reset();
      document.getElementById('promo-edit-id').value = p.id;
      document.getElementById('promo-titulo').value = p.titulo;
      document.getElementById('promo-precio-final').value = p.precio;
      document.getElementById('promo-descripcion').value = p.descripcion || '';
      document.getElementById('promo-vence').value = p.promo_vence ? String(p.promo_vence).slice(0, 10) : '';

      promoItemsSeleccionados = {};
      if (p.items_combo) {
        try {
          const items = typeof p.items_combo === 'string' ? JSON.parse(p.items_combo) : p.items_combo;
          items.forEach(it => { promoItemsSeleccionados[it.prodId] = it.cantidad; });
        } catch(e) { console.error(e); }
      }

      renderizarPickerProductosPromo();
      calcularDescuentoPromo();
      abrirModal('modal-promo');
    }

    async function eliminarProducto(prodId) {
      if (!confirm("¿Estás seguro de eliminar este ítem?")) return;
      const { error } = await _supabase.from('productos').delete().eq('id', prodId);
      if (error) alert("Error al eliminar: " + error.message);
      else if (comercioActivo) abrirVistaComercio(comercioActivo.slug || comercioActivo.id, false);
    }
