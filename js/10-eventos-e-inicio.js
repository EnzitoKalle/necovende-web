    document.getElementById('input-buscar').addEventListener('input', aplicarFiltros);

    document.getElementById('form-comercio').addEventListener('submit', async (e) => {
      e.preventDefault();
      if (!usuarioActual) return;

      const editId = document.getElementById('comercio-edit-id').value;
      const nombreVal = document.getElementById('nombre').value.trim();
      const slugVal = crearSlug(nombreVal);

      const slugExistente = comerciosGlobales.find(c => c.slug === slugVal && c.id !== editId);
      if (slugExistente) {
        alert(`Ya existe un comercio con el nombre "${nombreVal}". Elegí otro.`);
        return;
      }

      const logoExistente = document.getElementById('comercio-logo-existente').value;
      const portadaExistente = document.getElementById('comercio-portada-existente').value;
      
      const logoInput = document.getElementById('logo-input');
      const portadaInput = document.getElementById('portada-input');

      const catPrincipalVal = document.getElementById('comercio-cat-principal').value;
      const subcategoriasVal = obtenerSubcategoriasSeleccionadasModal();
      const categoriaNuevaEscrita = document.getElementById('comercio-categoria-nueva').value.trim();
      
      if (subcategoriasVal.length === 0 && !categoriaNuevaEscrita) {
        alert("Elegí al menos 1 subcategoría o escribí una categoría nueva.");
        return;
      }

      let logo_url = logoExistente;
      if (logoInput.files.length > 0) {
        const sub = await subirImagen(logoInput);
        if (sub) logo_url = sub;
      }

      let portada_url = portadaExistente;
      const comercioExistente = comerciosGlobales.find(c => c.id === editId);
      const planElegidoVal = editId 
        ? (comercioExistente ? comercioExistente.plan_original || comercioExistente.plan || 'gratis' : 'gratis') 
        : document.getElementById('comercio-plan-select').value;

      if (planElegidoVal === 'ultra' && portadaInput.files.length > 0) {
        const subP = await subirImagen(portadaInput);
        if (subP) portada_url = subP;
      }

      const saboresTxt = document.getElementById('sabores-input').value.trim();
      const saboresArr = saboresTxt ? saboresTxt.split(',').map(s => s.trim()).filter(Boolean) : [];
      const horariosGrillaVal = obtenerHorariosFormulario();

      let redesArray = [];
      let limitePermitidoLinks = (planElegidoVal === 'ultra') ? 3 : ((planElegidoVal === 'pro') ? 1 : 0);

      if (limitePermitidoLinks >= 1) {
        const url1 = document.getElementById('red-url-1').value.trim();
        if (url1) redesArray.push({ tipo: document.getElementById('red-tipo-1').value, url: url1 });
      }
      if (limitePermitidoLinks >= 3) {
        const url2 = document.getElementById('red-url-2').value.trim();
        const url3 = document.getElementById('red-url-3').value.trim();
        if (url2) redesArray.push({ tipo: document.getElementById('red-tipo-2').value, url: url2 });
        if (url3) redesArray.push({ tipo: document.getElementById('red-tipo-3').value, url: url3 });
      }

      const aliasMpVal = document.getElementById('alias-mp').value.trim();
      const titularAliasVal = document.getElementById('titular-alias').value.trim();
      const telefonoVal = document.getElementById('telefono').value.trim();

      const datosComercio = {
        user_id: usuarioActual.id,
        nombre: nombreVal,
        slug: slugVal,
        plan: planElegidoVal,
        telefono_whatsapp: telefonoVal,
        alias_mp: aliasMpVal,
        titular_alias: titularAliasVal,
        direccion: document.getElementById('direccion').value.trim(),
        categoria_principal: catPrincipalVal,
        categoria: subcategoriasVal[0] || categoriaNuevaEscrita || 'General',
        subcategorias: subcategoriasVal,
        hace_envios: document.getElementById('envios').checked,
        envio_gratis: document.getElementById('envio-gratis').checked,
        costo_envio: document.getElementById('costo-envio').value.trim(),
        horarios_dias: horariosGrillaVal,
        color_primario: planElegidoVal === 'ultra' ? document.getElementById('comercio-color-primario').value : '#f8fafc',
        color_acento: planElegidoVal === 'ultra' ? document.getElementById('comercio-color-acento').value : '#ea580c',
        posicion_portada: planElegidoVal === 'ultra' ? document.getElementById('comercio-posicion-portada').value : 'object-center',
        pagos_efectivo: document.getElementById('pago-efectivo').checked,
        pagos_transferencia: document.getElementById('pago-transferencia').checked,
        pagos_qr: document.getElementById('pago-qr').checked,
        pagos_cuenta_dni: document.getElementById('pago-cuenta-dni').checked,
        pagos_tarjeta: document.getElementById('pago-tarjeta').checked,
        sabores: saboresArr,
        redes_sociales: redesArray,
        tipo_coccion_empanadas: document.getElementById('tipo-coccion-select').value,
        logo_url,
        portada_url,
        activo: editId ? (comercioExistente ? comercioExistente.activo : true) : false
      };

      // Rango estimativo de envío (solo si aplica). Las columnas envio_min/envio_max se crean con sql/02-envio-estimado.sql
      const pideEnvioPago = document.getElementById('envios').checked && !document.getElementById('envio-gratis').checked;
      const envioMinVal = pideEnvioPago ? parseFloat(document.getElementById('envio-min').value) : NaN;
      const envioMaxVal = pideEnvioPago ? parseFloat(document.getElementById('envio-max').value) : NaN;
      if (!isNaN(envioMinVal) && !isNaN(envioMaxVal) && envioMaxVal < envioMinVal) {
        alert("En el rango estimativo del envío, el valor \"Hasta\" tiene que ser mayor o igual que \"Desde\".");
        return;
      }
      const columnaEnvioExiste = Boolean(comercioExistente && ('envio_min' in comercioExistente));
      if (!isNaN(envioMinVal) || !isNaN(envioMaxVal) || columnaEnvioExiste) {
        datosComercio.envio_min = isNaN(envioMinVal) ? null : envioMinVal;
        datosComercio.envio_max = isNaN(envioMaxVal) ? null : envioMaxVal;
      }

      // Condiciones de venta (columnas de sql/04-extras-comercios.sql)
      const pedMinVal = parseFloat(document.getElementById('pedido-minimo').value);
      const gratisDesdeVal = pideEnvioPago ? parseFloat(document.getElementById('envio-gratis-desde').value) : NaN;
      const columnasCondicionesExisten = Boolean(comercioExistente && ('pedido_minimo' in comercioExistente));
      if (!isNaN(pedMinVal) || !isNaN(gratisDesdeVal) || columnasCondicionesExisten) {
        datosComercio.pedido_minimo = isNaN(pedMinVal) ? null : pedMinVal;
        datosComercio.envio_gratis_desde = isNaN(gratisDesdeVal) ? null : gratisDesdeVal;
      }

      // Gustos destildados (columna opciones_ocultas de sql/06-listas-editables.sql)
      if (leTieneOcultos(['sabores-input']) || (comercioExistente && 'opciones_ocultas' in comercioExistente)) {
        datosComercio.opciones_ocultas = leOcultosObjeto(['sabores-input']);
      }

      let res;
      if (editId) {
        res = await _supabase.from('comercios').update(datosComercio).eq('id', editId);
      } else {
        res = await _supabase.from('comercios').insert([datosComercio]);
      }

      if (res.error) {
        if (/opciones_ocultas/i.test(res.error.message || '')) alert('Falta un paso en Supabase: corré el archivo sql/06-listas-editables.sql (una sola vez) en el SQL Editor y probá de nuevo.');
        else alert("Error al guardar: " + res.error.message);
      } else {
        cerrarModal('modal-registro');
        await cargarComercios();

        if (!editId) {
          const planTxt = planElegidoVal.toUpperCase();
          let mensajeAlta = `¡Hola! Solicito el alta del comercio *${nombreVal}*, plan *${planTxt}*.\n`;
          mensajeAlta += `• Categoría Principal: *${catPrincipalVal}*\n`;
          if (subcategoriasVal.length > 0) {
            mensajeAlta += `• Subcategorías elegidas: *${subcategoriasVal.join(', ')}*\n`;
          }
          if (categoriaNuevaEscrita) {
            mensajeAlta += `• 📌 SOLICITO CATEGORÍA NUEVA: *${categoriaNuevaEscrita}*\n`;
          }
          mensajeAlta += `• Alias de pago: *${aliasMpVal || 'No especificado'}*\n`;
          mensajeAlta += `• Titular: *${titularAliasVal || 'No especificado'}*\n\n¿Qué me faltaría para que activen mi comercio?`;

          window.open(`https://wa.me/${WHATSAPP_SOPORTE_PLANES}?text=${encodeURIComponent(mensajeAlta)}`, '_blank');
        } else {
          abrirVistaComercio(slugVal || editId, false);
        }
      }
    });

    document.getElementById('form-producto').addEventListener('submit', async (e) => {
      e.preventDefault();
      
      const comercioId = document.getElementById('prod-comercio-id').value;
      const prodEditId = document.getElementById('prod-edit-id').value;
      const comercioParaLimite = comerciosGlobales.find(c => String(c.id) === String(comercioId));
      const limiteProductos = comercioParaLimite?.plan === 'ultra' ? Infinity : (comercioParaLimite?.plan === 'pro' ? 10 : 5);
      if (!prodEditId && document.getElementById('prod-es-origen-promo').value !== 'true' && limiteProductos !== Infinity) {
        const { count, error: countError } = await _supabase.from('productos').select('id', { count: 'exact', head: true }).eq('comercio_id', comercioId).eq('es_combo', false);
        if (countError) { alert('No se pudo verificar el límite de productos. Intentá nuevamente.'); return; }
        if ((count || 0) >= limiteProductos) {
          alert(`Tu plan ${comercioParaLimite?.plan || 'gratis'} permite hasta ${limiteProductos} productos por comercio. Elegí un plan superior para publicar más.`);
          abrirModal('modal-planes'); return;
        }
      }
      const imgExistente = document.getElementById('prod-imagen-existente').value;
      const fileInput = document.getElementById('prod-imagen');
      const esOrigenPromo = document.getElementById('prod-es-origen-promo').value === 'true';

      let imagen_url = imgExistente;
      if (fileInput.files.length > 0) {
        const subida = await subirImagen(fileInput);
        if (subida) imagen_url = subida;
      }

      const requiereSabores = document.getElementById('prod-requiere-sabores').checked;
      const sinLimiteSabores = document.getElementById('prod-sin-limite-sabores').checked;
      const maxSaboresVal = document.getElementById('prod-max-sabores').value;

      let maxSaboresFinal = null;
      if (requiereSabores) {
        if (sinLimiteSabores) maxSaboresFinal = 0;
        else maxSaboresFinal = maxSaboresVal ? parseInt(maxSaboresVal) : null;
      }

      const stockVal = document.getElementById('prod-stock').value.trim();
      const stockFinal = stockVal !== '' ? parseInt(stockVal) : null;

      const saboresEspecificosTxt = document.getElementById('prod-sabores-especificos').value.trim();
      const saboresEspecificos = saboresEspecificosTxt ? [...new Set(saboresEspecificosTxt.split(',').map(x => x.trim()).filter(Boolean))] : [];
      const opcionesCustomTxt = document.getElementById('prod-opciones-custom-input').value.trim();
      const opcionesCustom = opcionesCustomTxt ? [...new Set(opcionesCustomTxt.split(',').map(x => x.trim()).filter(Boolean))] : [];
      const tallesTxt = document.getElementById('prod-talles-input').value.trim();
      const coloresTxt = document.getElementById('prod-colores-input').value.trim();
      const datosProducto = {
        comercio_id: comercioId,
        titulo: document.getElementById('prod-titulo').value.trim(),
        precio: parseFloat(document.getElementById('prod-precio').value),
        stock: stockFinal,
        descripcion: document.getElementById('prod-descripcion').value.trim(),
        requiere_sabores: requiereSabores,
        requiere_coccion: document.getElementById('prod-requiere-coccion').checked,
        max_sabores: maxSaboresFinal,
        sabores_especificos: saboresEspecificos,
        opciones_custom: opcionesCustom,
        talles_disponibles: tallesTxt ? tallesTxt.split(',').map(x => x.trim()).filter(Boolean) : [],
        colores_disponibles: coloresTxt ? coloresTxt.split(',').map(x => x.trim()).filter(Boolean) : [],
        es_solo_promo: document.getElementById('prod-solo-promo').checked,
        seccion: (document.getElementById('prod-seccion').value || '').trim() || null,
        es_combo: false,
        disponible: true,
        imagen_url
      };

      // Oferta: solo si el campo está habilitado (plan Ultra). Vacío = sin oferta.
      const campoAntes = document.getElementById('prod-precio-anterior');
      if (!campoAntes.disabled) {
        const antes = parseFloat(campoAntes.value);
        if (campoAntes.value !== '' && !(antes > datosProducto.precio)) {
          alert('El precio anterior tiene que ser mayor al precio actual (el de oferta).');
          return;
        }
        const prevExistente = (comercioActivo?.productos || []).find(x => String(x.id) === String(prodEditId));
        // Solo se manda la columna si hay algo que guardar o borrar (así no falla si todavía no corriste el SQL 05)
        if (campoAntes.value !== '') datosProducto.precio_anterior = antes;
        else if (prevExistente && prevExistente.precio_anterior) datosProducto.precio_anterior = null;
      }

      // Stock por talle (columna de sql/04-extras-comercios.sql)
      const stockTalles = leerStockTalles(datosProducto.talles_disponibles);
      if (!stockTalles.ok) { alert(stockTalles.error); return; }
      const prodExistente = (comercioActivo?.productos || []).find(x => String(x.id) === String(prodEditId));
      if (stockTalles.valor) datosProducto.stock = stockTalles.total;
      if (stockTalles.valor || (prodExistente && 'stock_talles' in prodExistente)) datosProducto.stock_talles = stockTalles.valor;

      // Talles / gustos / colores / opciones destildados (columna opciones_ocultas de sql/06-listas-editables.sql)
      const idsListasProd = ['prod-sabores-especificos', 'prod-opciones-custom-input', 'prod-talles-input', 'prod-colores-input'];
      if (leTieneOcultos(idsListasProd) || (prodExistente && 'opciones_ocultas' in prodExistente)) {
        datosProducto.opciones_ocultas = leOcultosObjeto(idsListasProd);
      }

      let res;
      if (prodEditId) {
        delete datosProducto.disponible;   // editar no debe reactivar un producto que se marcó como agotado
        res = await _supabase.from('productos').update(datosProducto).eq('id', prodEditId);
      } else {
        res = await _supabase.from('productos').insert([datosProducto]).select();
      }

      if (res.error) {
        if (/precio_anterior/i.test(res.error.message || '') && res.error.code !== 'P0001') alert('Falta un paso en Supabase: corré el archivo sql/05-ofertas-y-pedidos.sql (una sola vez) en el SQL Editor y probá de nuevo.');
        else if (/opciones_ocultas/i.test(res.error.message || '')) alert('Falta un paso en Supabase: corré el archivo sql/06-listas-editables.sql (una sola vez) en el SQL Editor y probá de nuevo.');
        else alert("Error al guardar producto: " + res.error.message);
      } else {
        cerrarModal('modal-producto');
        if (esOrigenPromo && res.data && res.data[0]) {
          const nuevoId = res.data[0].id;
          promoItemsSeleccionados[nuevoId] = 1;
          renderizarPickerProductosPromo();
          calcularDescuentoPromo();
          abrirModal('modal-promo');
        } else if (comercioActivo) {
          abrirVistaComercio(comercioActivo.slug || comercioActivo.id, false);
        }
      }
    });

    document.getElementById('form-promo').addEventListener('submit', async (e) => {
      e.preventDefault();

      const tipoPromo = document.getElementById('promo-tipo').value || 'fijo';
      const itemsArray = [];
      let promoConfig = null;
      let precioPromo = parseFloat(document.getElementById('promo-precio-final').value);

      if (tipoPromo === 'fijo') {
        for (const [prodId, cant] of Object.entries(promoItemsSeleccionados)) {
          if (cant > 0) itemsArray.push({ prodId, cantidad: cant });
        }
        if (itemsArray.length === 0) {
          alert("Elegí al menos 1 producto para la promo.");
          return;
        }
        if (!(precioPromo > 0)) { alert('Poné el precio de la promo.'); return; }
      } else {
        const r = leerConfigPromoForm();
        if (r.error) { alert(r.error); return; }
        promoConfig = r.config;
        precioPromo = tipoPromo === 'nxm' ? 0 : r.precio;   // en "llevá N, pagá M" el precio sale de lo que elija el cliente
      }

      const promoEditId = document.getElementById('promo-edit-id').value;
      const fileInput = document.getElementById('promo-imagen');

      let imagen_url = null;
      if (fileInput.files.length > 0) {
        const subida = await subirImagen(fileInput);
        if (subida) imagen_url = subida;
      }

      const datosPromo = {
        comercio_id: comercioActivo.id,
        titulo: document.getElementById('promo-titulo').value.trim(),
        precio: precioPromo,
        descripcion: document.getElementById('promo-descripcion').value.trim(),
        es_combo: true,
        promo_vence: document.getElementById('promo-vence').value || null,
        items_combo: itemsArray,
        stock: null,
        disponible: true,
        orden: 0,
        imagen_url
      };
      if (promoEditId && !imagen_url) delete datosPromo.imagen_url;
      if (promoEditId) delete datosPromo.disponible;
      // Solo se manda la columna si hace falta (así no falla si todavía no corriste el SQL 06)
      const promoPrevia = promoEditId ? (comercioActivo?.productos || []).find(x => String(x.id) === String(promoEditId)) : null;
      if (promoConfig) datosPromo.promo_config = promoConfig;
      else if (promoPrevia && promoPrevia.promo_config) datosPromo.promo_config = null;

      let res;
      if (promoEditId) {
        res = await _supabase.from('productos').update(datosPromo).eq('id', promoEditId);
      } else {
        res = await _supabase.from('productos').insert([datosPromo]);
      }

      if (res.error) {
        if (/promo_config/i.test(res.error.message || '') && res.error.code !== 'P0001') alert('Falta un paso en Supabase: corré el archivo sql/06-promos-a-eleccion.sql (una sola vez) en el SQL Editor y probá de nuevo.');
        else alert("Error al guardar promo: " + res.error.message);
      } else {
        cerrarModal('modal-promo');
        if (comercioActivo) abrirVistaComercio(comercioActivo.slug || comercioActivo.id, false);
      }
    });

    window.addEventListener('DOMContentLoaded', async () => {
      if (new URLSearchParams(location.search).get('menu')) {
        modoEstrictoEnlace = true;
        document.getElementById('vista-inicio').classList.add('hidden');
        ['btn-header-planes', 'btn-sumar-comercio', 'btn-historial']
          .forEach(id => document.getElementById(id)?.classList.add('hidden'));
      }
      actualizarRelojNecochea();
      const { data: { session } } = await _supabase.auth.getSession();
      actualizarInterfazUsuario(session?.user || null);

      _supabase.auth.onAuthStateChange((_event, session) => {
        actualizarInterfazUsuario(session?.user || null);
      });

      await cargarComercios();
      if (window.lucide) lucide.createIcons();
    });

    window.onpopstate = () => {
      if (modoEstrictoEnlace) return;
      const params = new URLSearchParams(window.location.search);
      const idUrl = params.get('comercio');
      if (idUrl) {
        abrirVistaComercio(idUrl, false);
      } else {
        mostrarInicio();
      }
    };
  