    // =====================================================================
    // CATEGORÍAS ADMINISTRABLES
    // Se leen de Supabase (tablas "categorias" y "subcategorias"). Si todavía
    // no existen o hay un error, el sitio usa la lista de respaldo que está
    // en 01-config-y-estado.js, así nunca se queda sin categorías.
    // =====================================================================

    let categoriasDesdeBD = false;
    let categoriasAdmin = [];   // [{ id, nombre, icono, orden, subs: [{ id, nombre, orden, activa, usa_sabores, usa_coccion, usa_talles }] }]

    // Qué opciones especiales tiene un comercio según sus subcategorías (se combinan: si una la tiene, las tiene)
    function flagsDeSubcategorias(subs) {
      const lista = Array.isArray(subs) ? subs : [];
      const tiene = campo => lista.some(s => CATEGORIAS_FLAGS[s] && CATEGORIAS_FLAGS[s][campo]);
      return { sabores: tiene('sabores'), coccion: tiene('coccion'), talles: tiene('talles') };
    }

    async function cargarCategorias() {
      try {
        const [rc, rs] = await Promise.all([
          _supabase.from('categorias').select('*').order('orden', { ascending: true }).order('id', { ascending: true }),
          _supabase.from('subcategorias').select('*').order('orden', { ascending: true }).order('id', { ascending: true })
        ]);
        if (rc.error || rs.error || !rc.data || rc.data.length === 0) { categoriasDesdeBD = false; return; }

        const jerarquia = {}, flags = {}, iconos = {};
        categoriasAdmin = rc.data.map(r => ({ ...r, subs: (rs.data || []).filter(s => s.categoria_id === r.id) }));
        categoriasAdmin.forEach(r => {
          jerarquia[r.nombre] = r.subs.filter(s => s.activa !== false).map(s => s.nombre);
          iconos[r.nombre] = r.icono || '🏷️';
          r.subs.forEach(s => { flags[s.nombre] = { sabores: !!s.usa_sabores, coccion: !!s.usa_coccion, talles: !!s.usa_talles }; });
        });
        CATEGORIAS_JERARQUICAS = jerarquia;
        CATEGORIAS_FLAGS = flags;
        CATEGORIAS_ICONOS = iconos;
        categoriasDesdeBD = true;
      } catch (e) {
        categoriasDesdeBD = false;
      }
    }

    // ---------------------------------------------------------------------
    // PANTALLA DE ADMINISTRACIÓN
    // ---------------------------------------------------------------------
    function abrirModalCategorias() {
      if (!esAdministrador()) return;
      abrirModal('modal-categorias');
      renderizarAdminCategorias();
    }

    function limpiarNombreCat(t) {
      return String(t == null ? '' : t).replace(/[<>]/g, '').replace(/\s+/g, ' ').trim().slice(0, 40);
    }

    function nombresCategoriasExistentes() {
      const set = new Set();
      categoriasAdmin.forEach(r => { set.add(r.nombre.toLowerCase()); r.subs.forEach(s => set.add(s.nombre.toLowerCase())); });
      return set;
    }

    function subsDeComercio(c) {
      return Array.isArray(c.subcategorias) ? c.subcategorias : (Array.isArray(c.categorias) ? c.categorias : []);
    }
    function contarComerciosSub(nombre) { return comerciosGlobales.filter(c => subsDeComercio(c).includes(nombre) || c.categoria === nombre).length; }
    function contarComerciosRubro(nombre) { return comerciosGlobales.filter(c => c.categoria_principal === nombre).length; }

    function errCategoriaAdmin(error) {
      if (error && error.code === '23505') alert('Ya existe una categoría con ese nombre.');
      else alert('No se pudo guardar: ' + (error && error.message ? error.message : 'error desconocido'));
    }

    function sugerenciasCategorias() {
      const conocidas = nombresCategoriasExistentes();
      const grupos = {};
      comerciosGlobales.forEach(c => {
        const t = (c.categoria || '').trim();
        if (!t || t === 'General' || conocidas.has(t.toLowerCase())) return;
        const k = t.toLowerCase();
        if (!grupos[k]) grupos[k] = { texto: t, comercios: [] };
        grupos[k].comercios.push(c);
      });
      return Object.values(grupos);
    }

    function botonIconoCat(accion, titulo, texto, extra = '') {
      return `<button type="button" onclick="${accion}" title="${titulo}" class="w-8 h-8 flex items-center justify-center rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 text-sm font-black flex-shrink-0 ${extra}">${texto}</button>`;
    }

    function chipOpcionCat(subId, campo, activo, texto) {
      return `<button type="button" onclick="adminToggleFlagSub(${subId}, '${campo}')" class="text-[10px] font-black px-2 py-1 rounded-lg border transition ${activo ? 'bg-brand-500 text-white border-brand-500' : 'bg-slate-50 text-slate-400 border-slate-200'}">${texto}</button>`;
    }

    function renderizarAdminCategorias() {
      const cont = document.getElementById('categorias-admin-contenido');
      if (!cont) return;

      if (!categoriasDesdeBD) {
        cont.innerHTML = `
          <div class="bg-amber-50 border border-amber-200 text-amber-800 rounded-xl p-4 text-xs space-y-2">
            <p class="font-black">Todavía no están creadas las tablas de categorías.</p>
            <p>Corré el archivo <b>sql/03-categorias.sql</b> en Supabase (SQL Editor), recargá la página y volvé a entrar acá. Mientras tanto el sitio usa la lista que está en el código.</p>
          </div>`;
        return;
      }

      let html = '';

      // --- Sugeridas por comercios ---
      const sugeridas = sugerenciasCategorias();
      if (sugeridas.length > 0) {
        html += `<div class="bg-sky-50 border border-sky-200 rounded-2xl p-3 space-y-2">
          <p class="text-xs font-black text-sky-800">💡 Pedidas por comercios (${sugeridas.length})</p>
          <p class="text-[10px] text-sky-700">Comercios que escribieron una categoría que todavía no existe. Creala y se les asigna sola.</p>`;
        sugeridas.forEach((g, i) => {
          html += `<div class="flex items-center justify-between gap-2 bg-white rounded-xl border border-sky-100 p-2">
            <p class="text-xs font-bold text-slate-800 truncate">${esc(g.texto)} <span class="text-[10px] font-semibold text-slate-400">· ${g.comercios.map(c => esc(c.nombre)).join(', ')}</span></p>
            <button type="button" onclick="adminCrearDesdeSugerida(${i})" class="flex-shrink-0 text-[10px] font-black px-2.5 py-1.5 rounded-lg bg-sky-600 text-white">Crear</button>
          </div>`;
        });
        html += `</div>`;
      }

      // --- Rubros ---
      categoriasAdmin.forEach((r, ri) => {
        const nRubro = contarComerciosRubro(r.nombre);
        html += `<div class="bg-slate-50 border border-slate-200 rounded-2xl p-3 space-y-2.5">
          <div class="flex items-center justify-between gap-2">
            <div class="min-w-0">
              <p class="font-black text-sm text-slate-900 truncate">${esc(r.icono || '🏷️')} ${esc(r.nombre)}</p>
              <p class="text-[10px] text-slate-400 font-semibold">${r.subs.length} subcategorías · ${nRubro} comercio${nRubro === 1 ? '' : 's'}</p>
            </div>
            <div class="flex items-center gap-1 flex-shrink-0">
              ${botonIconoCat(`adminMoverRubro(${r.id}, -1)`, 'Subir', '▲', ri === 0 ? 'opacity-30' : '')}
              ${botonIconoCat(`adminMoverRubro(${r.id}, 1)`, 'Bajar', '▼', ri === categoriasAdmin.length - 1 ? 'opacity-30' : '')}
              ${botonIconoCat(`adminEditarRubro(${r.id})`, 'Cambiar nombre o ícono', '✏️')}
              ${botonIconoCat(`adminEliminarRubro(${r.id})`, 'Eliminar rubro', '🗑️')}
            </div>
          </div>
          <div class="space-y-2">`;

        r.subs.forEach((s, si) => {
          const n = contarComerciosSub(s.nombre);
          html += `<div class="bg-white border border-slate-200 rounded-xl p-2.5 space-y-2 ${s.activa === false ? 'opacity-60' : ''}">
            <div class="flex items-center justify-between gap-2">
              <p class="font-bold text-xs text-slate-800 min-w-0 truncate">${esc(s.nombre)}
                <span class="text-[10px] font-semibold text-slate-400">· ${n} comercio${n === 1 ? '' : 's'}</span>
                ${s.activa === false ? '<span class="text-[9px] font-black px-1.5 py-0.5 rounded bg-slate-200 text-slate-600">Oculta</span>' : ''}</p>
              <div class="flex items-center gap-1 flex-shrink-0">
                ${botonIconoCat(`adminMoverSub(${s.id}, -1)`, 'Subir', '▲', si === 0 ? 'opacity-30' : '')}
                ${botonIconoCat(`adminMoverSub(${s.id}, 1)`, 'Bajar', '▼', si === r.subs.length - 1 ? 'opacity-30' : '')}
                ${botonIconoCat(`adminEditarSub(${s.id})`, 'Cambiar nombre', '✏️')}
                ${botonIconoCat(`adminToggleActivaSub(${s.id})`, s.activa === false ? 'Mostrar' : 'Ocultar', s.activa === false ? '🙈' : '👁️')}
                ${botonIconoCat(`adminEliminarSub(${s.id})`, 'Eliminar', '🗑️')}
              </div>
            </div>
            <div class="flex flex-wrap items-center gap-1.5">
              <span class="text-[10px] text-slate-400 font-bold">Opciones:</span>
              ${chipOpcionCat(s.id, 'usa_sabores', s.usa_sabores, '🍦 Sabores')}
              ${chipOpcionCat(s.id, 'usa_coccion', s.usa_coccion, '🔥 Cocción')}
              ${chipOpcionCat(s.id, 'usa_talles', s.usa_talles, '👕 Talles y colores')}
            </div>
          </div>`;
        });

        html += `</div>
          <div class="flex gap-2">
            <input type="text" id="cat-nueva-sub-${r.id}" maxlength="40" placeholder="Nueva subcategoría en este rubro" class="flex-1 min-w-0 clean-input px-3 py-2 rounded-xl text-xs font-semibold">
            <button type="button" onclick="adminAgregarSub(${r.id})" class="px-3 py-2 rounded-xl bg-brand-500 text-white text-xs font-black flex-shrink-0">Agregar</button>
          </div>
        </div>`;
      });

      // --- Nuevo rubro ---
      html += `<div class="bg-white border border-dashed border-slate-300 rounded-2xl p-3 space-y-2">
          <p class="text-xs font-black text-slate-700">Nuevo rubro</p>
          <div class="flex gap-2">
            <input type="text" id="cat-nuevo-rubro-icono" maxlength="4" placeholder="🙂" class="w-14 text-center clean-input px-2 py-2 rounded-xl text-sm font-semibold">
            <input type="text" id="cat-nuevo-rubro-nombre" maxlength="36" placeholder="Ej: Turismo y Recreación" class="flex-1 min-w-0 clean-input px-3 py-2 rounded-xl text-xs font-semibold">
            <button type="button" onclick="adminAgregarRubro()" class="px-3 py-2 rounded-xl bg-slate-800 text-white text-xs font-black flex-shrink-0">Crear</button>
          </div>
        </div>
        <p class="text-[10px] text-slate-400 leading-snug">Cambiar el nombre de una subcategoría actualiza también a los comercios que la usan. Si una subcategoría tiene comercios no se puede eliminar: ocultala (👁️) y deja de aparecer para registrar y filtrar, sin afectar a esos comercios.</p>`;

      cont.innerHTML = html;
    }

    async function refrescarCategoriasAdmin(recargarComercios = false) {
      if (recargarComercios) {
        await cargarComercios();   // también vuelve a leer las categorías y redibuja el inicio
      } else {
        await cargarCategorias();
        renderizarCategoriasPrincipales();
        if (categoriaPrincipalSeleccionada !== 'Todas' && !CATEGORIAS_JERARQUICAS[categoriaPrincipalSeleccionada] && categoriaPrincipalSeleccionada !== 'Favoritos ❤️') {
          seleccionarCategoriaPrincipal('Todas');
        } else {
          aplicarFiltros();
        }
      }
      renderizarAdminCategorias();
    }

    async function moverEnLista(tabla, lista, id, dir) {
      const i = lista.findIndex(x => x.id === id), j = i + dir;
      if (i < 0 || j < 0 || j >= lista.length) return false;
      const arr = [...lista];
      [arr[i], arr[j]] = [arr[j], arr[i]];
      for (let k = 0; k < arr.length; k++) {
        if (arr[k].orden !== k) {
          const { error } = await _supabase.from(tabla).update({ orden: k }).eq('id', arr[k].id);
          if (error) { errCategoriaAdmin(error); return false; }
        }
      }
      return true;
    }

    // ----- Rubros -----
    async function adminAgregarRubro() {
      const nombreBase = limpiarNombreCat(document.getElementById('cat-nuevo-rubro-nombre').value);
      const icono = limpiarNombreCat(document.getElementById('cat-nuevo-rubro-icono').value);
      if (!nombreBase) { alert('Escribí el nombre del rubro.'); return; }
      const nombre = icono && !nombreBase.includes(icono) ? `${nombreBase} ${icono}` : nombreBase;
      if (nombresCategoriasExistentes().has(nombre.toLowerCase())) { alert('Ya existe una categoría con ese nombre.'); return; }
      const orden = categoriasAdmin.length ? Math.max(...categoriasAdmin.map(r => r.orden)) + 1 : 0;
      const { error } = await _supabase.from('categorias').insert([{ nombre, icono: icono || '🏷️', orden }]);
      if (error) { errCategoriaAdmin(error); return; }
      mostrarToast('Rubro creado.');
      await refrescarCategoriasAdmin();
    }

    async function adminEditarRubro(id) {
      const r = categoriasAdmin.find(x => x.id === id);
      if (!r) return;
      const nuevoNombre = limpiarNombreCat(prompt('Nombre del rubro (podés incluir el emoji al final):', r.nombre));
      if (!nuevoNombre) return;
      const nuevoIcono = limpiarNombreCat(prompt('Ícono de la tarjeta en el inicio (un emoji):', r.icono || '🏷️')) || r.icono || '🏷️';
      if (nuevoNombre === r.nombre && nuevoIcono === (r.icono || '')) return;
      if (nuevoNombre.toLowerCase() !== r.nombre.toLowerCase() && nombresCategoriasExistentes().has(nuevoNombre.toLowerCase())) { alert('Ya existe una categoría con ese nombre.'); return; }

      const { error } = await _supabase.from('categorias').update({ nombre: nuevoNombre, icono: nuevoIcono }).eq('id', id);
      if (error) { errCategoriaAdmin(error); return; }
      if (nuevoNombre !== r.nombre) {
        const { error: e2 } = await _supabase.from('comercios').update({ categoria_principal: nuevoNombre }).eq('categoria_principal', r.nombre);
        if (e2) alert('El rubro se renombró, pero no se pudieron actualizar algunos comercios: ' + e2.message);
      }
      mostrarToast('Rubro actualizado.');
      await refrescarCategoriasAdmin(true);
    }

    async function adminMoverRubro(id, dir) {
      if (await moverEnLista('categorias', categoriasAdmin, id, dir)) await refrescarCategoriasAdmin();
    }

    async function adminEliminarRubro(id) {
      const r = categoriasAdmin.find(x => x.id === id);
      if (!r) return;
      if (r.subs.length > 0) { alert('Este rubro todavía tiene subcategorías. Eliminalas o pasalas primero.'); return; }
      const n = contarComerciosRubro(r.nombre);
      if (n > 0) { alert(`Hay ${n} comercio(s) con este rubro. Cambialos de rubro antes de eliminarlo.`); return; }
      if (!confirm(`¿Eliminar el rubro "${r.nombre}"?`)) return;
      const { error } = await _supabase.from('categorias').delete().eq('id', id);
      if (error) { errCategoriaAdmin(error); return; }
      mostrarToast('Rubro eliminado.');
      await refrescarCategoriasAdmin();
    }

    // ----- Subcategorías -----
    function buscarSub(id) {
      for (const r of categoriasAdmin) { const s = r.subs.find(x => x.id === id); if (s) return { rubro: r, sub: s }; }
      return null;
    }

    async function adminAgregarSub(rubroId) {
      const r = categoriasAdmin.find(x => x.id === rubroId);
      const input = document.getElementById(`cat-nueva-sub-${rubroId}`);
      const nombre = limpiarNombreCat(input && input.value);
      if (!r || !nombre) { alert('Escribí el nombre de la subcategoría.'); return; }
      if (nombresCategoriasExistentes().has(nombre.toLowerCase())) { alert('Ya existe una categoría con ese nombre.'); return; }
      const orden = r.subs.length ? Math.max(...r.subs.map(s => s.orden)) + 1 : 0;
      const { error } = await _supabase.from('subcategorias').insert([{ categoria_id: rubroId, nombre, orden, activa: true }]);
      if (error) { errCategoriaAdmin(error); return; }
      mostrarToast('Subcategoría agregada.');
      await refrescarCategoriasAdmin();
    }

    async function adminEditarSub(id) {
      const f = buscarSub(id);
      if (!f) return;
      const viejo = f.sub.nombre;
      const nuevo = limpiarNombreCat(prompt('Nuevo nombre de la subcategoría:', viejo));
      if (!nuevo || nuevo === viejo) return;
      if (nuevo.toLowerCase() !== viejo.toLowerCase() && nombresCategoriasExistentes().has(nuevo.toLowerCase())) { alert('Ya existe una categoría con ese nombre.'); return; }

      const afectados = comerciosGlobales.filter(c => subsDeComercio(c).includes(viejo) || c.categoria === viejo);
      if (afectados.length > 0 && !confirm(`${afectados.length} comercio(s) usan "${viejo}". Se van a actualizar a "${nuevo}". ¿Seguir?`)) return;

      const { error } = await _supabase.from('subcategorias').update({ nombre: nuevo }).eq('id', id);
      if (error) { errCategoriaAdmin(error); return; }

      let fallos = 0;
      for (const c of afectados) {
        const parche = {};
        if (subsDeComercio(c).includes(viejo) && Array.isArray(c.subcategorias)) parche.subcategorias = c.subcategorias.map(x => x === viejo ? nuevo : x);
        if (c.categoria === viejo) parche.categoria = nuevo;
        if (Object.keys(parche).length === 0) continue;
        const { error: e2 } = await _supabase.from('comercios').update(parche).eq('id', c.id);
        if (e2) fallos++;
      }
      if (fallos) alert(`La subcategoría se renombró, pero ${fallos} comercio(s) no se pudieron actualizar. Volvé a intentarlo o revisalos a mano.`);
      else mostrarToast('Subcategoría actualizada.');
      await refrescarCategoriasAdmin(true);
    }

    async function adminMoverSub(id, dir) {
      const f = buscarSub(id);
      if (!f) return;
      if (await moverEnLista('subcategorias', f.rubro.subs, id, dir)) await refrescarCategoriasAdmin();
    }

    async function adminToggleFlagSub(id, campo) {
      if (!['usa_sabores', 'usa_coccion', 'usa_talles'].includes(campo)) return;
      const f = buscarSub(id);
      if (!f) return;
      const { error } = await _supabase.from('subcategorias').update({ [campo]: !f.sub[campo] }).eq('id', id);
      if (error) { errCategoriaAdmin(error); return; }
      await refrescarCategoriasAdmin();
    }

    async function adminToggleActivaSub(id) {
      const f = buscarSub(id);
      if (!f) return;
      const { error } = await _supabase.from('subcategorias').update({ activa: f.sub.activa === false }).eq('id', id);
      if (error) { errCategoriaAdmin(error); return; }
      await refrescarCategoriasAdmin();
    }

    async function adminEliminarSub(id) {
      const f = buscarSub(id);
      if (!f) return;
      const n = contarComerciosSub(f.sub.nombre);
      if (n > 0) { alert(`${n} comercio(s) usan "${f.sub.nombre}", así que no se puede eliminar. Podés ocultarla con el botón 👁️.`); return; }
      if (!confirm(`¿Eliminar la subcategoría "${f.sub.nombre}"?`)) return;
      const { error } = await _supabase.from('subcategorias').delete().eq('id', id);
      if (error) { errCategoriaAdmin(error); return; }
      mostrarToast('Subcategoría eliminada.');
      await refrescarCategoriasAdmin();
    }

    // ----- Categorías pedidas por comercios -----
    async function adminCrearDesdeSugerida(indice) {
      const g = sugerenciasCategorias()[indice];
      if (!g) return;
      const rubro = categoriasAdmin.find(r => r.nombre === g.comercios[0].categoria_principal) || categoriasAdmin[0];
      if (!rubro) return;
      if (!confirm(`¿Crear "${g.texto}" dentro de "${rubro.nombre}" y asignarla a ${g.comercios.length} comercio(s)?`)) return;

      const orden = rubro.subs.length ? Math.max(...rubro.subs.map(s => s.orden)) + 1 : 0;
      const { error } = await _supabase.from('subcategorias').insert([{ categoria_id: rubro.id, nombre: g.texto, orden, activa: true }]);
      if (error) { errCategoriaAdmin(error); return; }

      for (const c of g.comercios) {
        const actuales = Array.isArray(c.subcategorias) ? c.subcategorias : [];
        if (actuales.includes(g.texto) || actuales.length >= 3) continue;
        await _supabase.from('comercios').update({ subcategorias: [...actuales, g.texto] }).eq('id', c.id);
      }
      mostrarToast('Categoría creada y asignada.');
      await refrescarCategoriasAdmin(true);
    }
