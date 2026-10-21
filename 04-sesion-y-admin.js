    async function iniciarSesionGoogle() {
      const { error } = await _supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: window.location.origin }
      });
      if (error) alert('Error al conectar con Google: ' + error.message);
    }

    async function cerrarSesion() {
      const { error } = await _supabase.auth.signOut();
      if (!error) {
        cerrarModal('modal-panel');
        window.location.reload();
      }
    }

    function actualizarInterfazUsuario(user) {
      usuarioActual = user;
      if (user && perfilCargadoParaId !== user.id) {
        perfilCargadoParaId = user.id;
        perfilUsuarioPromise = cargarPerfilUsuario(user);
        sincronizarCuenta(user);
      } else if (!user) {
        perfilCargadoParaId = null;
        maxComerciosUsuario = 1;
      }
      actualizarBadgeAdmin();
      const btnLogin = document.getElementById('btn-login-google');
      const menuPerfil = document.getElementById('user-profile-menu');
      const imgAvatar = document.getElementById('user-avatar');
      const btnAdmin = document.getElementById('btn-admin-panel');

      if (user) {
        btnLogin.classList.add('hidden');
        menuPerfil.classList.remove('hidden');
        menuPerfil.classList.add('flex');
        imgAvatar.src = user.user_metadata?.avatar_url || 'https://via.placeholder.com/150';

        if (esAdministrador()) {
          btnAdmin.classList.remove('hidden');
          btnAdmin.classList.add('flex');
        } else {
          btnAdmin.classList.add('hidden');
        }
      } else {
        btnLogin.classList.remove('hidden');
        menuPerfil.classList.add('hidden');
        menuPerfil.classList.remove('flex');
        btnAdmin.classList.add('hidden');
      }

      if (comercioActivo) {
        abrirVistaComercio(comercioActivo.slug || comercioActivo.id, false);
      }
    }

    function abrirModalAdmin() {
      if (!esAdministrador()) return;
      const lista = document.getElementById('admin-comercios-lista');
      lista.innerHTML = '';

      if (comerciosGlobales.length === 0) {
        lista.innerHTML = `<p class="text-xs text-slate-400 text-center py-4">No hay comercios cargados.</p>`;
      } else {
        comerciosGlobales.forEach(c => {
          const planActual = c.plan || 'gratis';
          const estaActivo = c.activo === true;
          lista.innerHTML += `
            <div class="bg-slate-50 p-3 rounded-xl border border-slate-200 flex items-center justify-between gap-3 text-xs">
              <div class="truncate">
                <p class="font-black text-slate-900 truncate">${esc(c.nombre)} <span class="text-[10px] font-bold px-2 py-0.5 rounded ${estaActivo ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}">${estaActivo ? 'Activo' : 'Inactivo / Pendiente'}</span></p>
                <p class="text-[10px] text-slate-400">Titular: ${esc(c.titular_alias || 'No especificado')} | Plan: ${planActual.toUpperCase()}${c.plan_vencido ? ' (VENCIDO)' : ''}${c.plan_vence ? ' · vence ' + new Date(c.plan_vence).toLocaleDateString('es-AR') : ''}</p>
              </div>
              <div class="flex items-center gap-2 flex-shrink-0">
                <button onclick="toggleActivarComercioAdmin('${c.id}', ${estaActivo})" class="px-3 py-1.5 rounded-lg font-bold text-xs ${estaActivo ? 'bg-rose-50 text-rose-600 border border-rose-200' : 'bg-emerald-500 text-white'}">
                  ${estaActivo ? 'Desactivar' : 'Aprobar/Activar'}
                </button>
                <button onclick="renovarPlanAdmin('${c.id}')" title="Renovar 30 días" class="px-2 py-1.5 rounded-lg font-bold text-xs bg-sky-50 text-sky-700 border border-sky-200">+30d</button>
                <select onchange="cambiarPlanComercioAdmin('${c.id}', this.value)" class="clean-input px-2.5 py-1.5 rounded-lg font-bold text-xs">
                  <option value="gratis" ${planActual === 'gratis' ? 'selected' : ''}>⚪ Gratis</option>
                  <option value="pro" ${planActual === 'pro' ? 'selected' : ''}>✓ Pro</option>
                  <option value="ultra" ${planActual === 'ultra' ? 'selected' : ''}>✓✓ Ultra</option>
                </select>
              </div>
            </div>
          `;
        });
      }
      buscarUsuariosAdmin();
      abrirModal('modal-admin');
    }

    async function toggleActivarComercioAdmin(comercioId, estadoActual) {
      const nuevoEstado = !estadoActual;
      const _c = comerciosGlobales.find(x => String(x.id) === String(comercioId));
      const _extra = (nuevoEstado && _c && _c.plan_original !== 'gratis' && !_c.plan_vence) ? { plan_vence: new Date(Date.now() + 30*864e5).toISOString() } : {};
      const { error } = await _supabase.from('comercios').update({ activo: nuevoEstado, ..._extra }).eq('id', comercioId);
      if (error) {
        alert("Error al cambiar estado: " + error.message);
      } else {
        mostrarToast(`Comercio ${nuevoEstado ? 'activado' : 'desactivado'} con éxito.`);
        await cargarComercios();
        abrirModalAdmin();
      }
    }

    async function cambiarPlanComercioAdmin(comercioId, nuevoPlan) {
      const _venc = nuevoPlan === 'gratis' ? null : new Date(Date.now() + 30*864e5).toISOString();
      const { error } = await _supabase.from('comercios').update({ plan: nuevoPlan, plan_vence: _venc }).eq('id', comercioId);
      if (error) {
        alert("Error al actualizar plan: " + error.message);
      } else {
        mostrarToast(`Plan actualizado a "${nuevoPlan.toUpperCase()}" con éxito.`);
        await cargarComercios();
      }
    }

    function abrirPanelControl() {
      if (!usuarioActual) return;

      document.getElementById('panel-avatar').src = usuarioActual.user_metadata?.avatar_url || 'https://via.placeholder.com/150';
      document.getElementById('panel-nombre').innerText = usuarioActual.user_metadata?.full_name || 'Usuario registrado';
      document.getElementById('panel-email').innerText = usuarioActual.email;

      const misComercios = comerciosGlobales.filter(c => c.user_id === usuarioActual.id);
      document.getElementById('panel-stat-comercios').innerText = misComercios.length;
      document.getElementById('panel-stat-productos').innerText = "-";

      const lista = document.getElementById('panel-comercios-lista');
      lista.innerHTML = '';

      if (misComercios.length === 0) {
        lista.innerHTML = `<p class="text-xs text-slate-400 text-center py-3">Aún no registraste ningún comercio.</p>`;
      } else {
        misComercios.forEach(c => {
          const planBadge = c.plan === 'ultra' ? '✓✓ Ultra' : (c.plan === 'pro' ? '✓ Pro' : 'Gratis');
          const activoBadge = c.activo === true 
            ? '<span class="text-[9px] font-bold px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800">Activo</span>' 
            : '<span class="text-[9px] font-bold px-1.5 py-0.5 rounded bg-amber-100 text-amber-800">Pendiente de Aprobación</span>';

          lista.innerHTML += `
            <div class="bg-white p-3 rounded-xl border border-slate-200 flex items-center justify-between gap-2 shadow-sm">
              <div class="flex items-center gap-3 min-w-0 flex-1 cursor-pointer" onclick="cerrarModal('modal-panel'); abrirVistaComercio('${slugSeguro(c.slug || c.id)}');">
                ${c.logo_url 
                  ? `<img src="${esc(c.logo_url)}" class="w-12 h-12 rounded-xl object-cover flex-shrink-0">` 
                  : `<div class="w-12 h-12 bg-slate-100 rounded-xl flex items-center justify-center font-bold text-brand-600 text-xs flex-shrink-0">${esc(c.nombre.charAt(0))}</div>`}
                <div class="min-w-0">
                  <div class="flex items-center gap-1.5">
                    <p class="font-bold text-xs text-slate-800 truncate">${esc(c.nombre)}</p>
                    <span class="text-[9px] font-black px-1.5 py-0.5 rounded bg-slate-100 text-slate-600">${planBadge}</span>
                  </div>
                  <div id="stats-${c.id}" class="mt-1 text-[10px] text-slate-500 font-semibold">Cargando estadísticas...</div>
                  <div class="mt-0.5">${activoBadge}${c.plan_vencido ? ' <span class="text-[9px] font-bold px-1.5 py-0.5 rounded bg-rose-100 text-rose-700">Plan vencido: volviste a Gratis</span>' : (c.plan_vence ? ' <span class="text-[9px] text-slate-400">Vence ' + new Date(c.plan_vence).toLocaleDateString('es-AR') + '</span>' : '')}</div>
                </div>
              </div>
              <button onclick="cerrarModal('modal-panel'); prepararModalEditarComercio('${c.id}')" class="p-2 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition flex-shrink-0" title="Editar datos">
                <i data-lucide="edit-3" class="w-4 h-4 text-brand-500"></i>
              </button>
            </div>
          `;
        });
      }

      abrirModal('modal-panel');
      if (window.lucide) lucide.createIcons();
      cargarEstadisticasPanel(misComercios);
    }

    async function intentarAbrirRegistroComercio() {
      if (!usuarioActual) {
        alert("Debés iniciar sesión con Google para registrar un comercio.");
        return;
      }

      await perfilUsuarioPromise;
      const misComercios = comerciosGlobales.filter(c => c.user_id === usuarioActual.id);

      if (misComercios.length >= maxComerciosUsuario) {
        abrirModal('modal-otro-comercio');
        if (window.lucide) lucide.createIcons();
        return;
      }

      prepararModalNuevoComercio();
    }

    function solicitarOtroComercioWhatsApp() {
      let msg = 'quiero solicitar otro comercio';
      if (usuarioActual && usuarioActual.email) msg += `\n(Mi cuenta: ${usuarioActual.email})`;
      window.open(`https://wa.me/${WHATSAPP_SOPORTE_PLANES}?text=${encodeURIComponent(msg)}`, '_blank');
      cerrarModal('modal-otro-comercio');
    }

    // ===== PERFILES DE USUARIO (límite de comercios por cuenta) =====
    function escHtmlPerfil(t) { return esc(t); }

    async function cargarPerfilUsuario(user) {
      try {
        await _supabase.from('perfiles_usuarios').upsert(
          { user_id: user.id, email: user.email || null, nombre: user.user_metadata?.full_name || null },
          { onConflict: 'user_id', ignoreDuplicates: true }
        );
        const { data, error } = await _supabase.from('perfiles_usuarios').select('max_comercios').eq('user_id', user.id).maybeSingle();
        if (!error && data && Number(data.max_comercios) >= 1) maxComerciosUsuario = Number(data.max_comercios);
      } catch (e) {
        console.warn('No se pudo cargar el perfil del usuario:', e);
      }
    }

    async function buscarUsuariosAdmin() {
      if (!esAdministrador()) return;
      const cont = document.getElementById('admin-usuarios-resultados');
      if (!cont) return;
      const q = (document.getElementById('admin-usuarios-buscar').value || '').trim().toLowerCase();
      cont.innerHTML = '<p class="text-xs text-slate-400 text-center py-2">Cargando...</p>';

      const { data, error } = await _supabase.from('perfiles_usuarios').select('*').order('creado_en', { ascending: false }).limit(500);
      if (error) {
        cont.innerHTML = `<p class="text-[11px] text-rose-600 py-2">No se pudo cargar la lista. ¿Ya creaste la tabla perfiles_usuarios en Supabase? (${escHtmlPerfil(error.message)})</p>`;
        return;
      }

      let usuarios = (data || []).map(u => ({ ...u }));
      const conocidos = new Set(usuarios.map(u => u.user_id));
      comerciosGlobales.forEach(c => {
        if (c.user_id && !conocidos.has(c.user_id)) {
          conocidos.add(c.user_id);
          usuarios.push({ user_id: c.user_id, email: null, nombre: c.titular_alias || c.nombre, max_comercios: 1, sinPerfil: true });
        }
      });

      if (q) usuarios = usuarios.filter(u => ((u.email || '') + ' ' + (u.nombre || '')).toLowerCase().includes(q));

      if (usuarios.length === 0) {
        cont.innerHTML = '<p class="text-xs text-slate-400 text-center py-2">No se encontraron usuarios.</p>';
        return;
      }

      cont.innerHTML = usuarios.map(u => {
        const cant = comerciosGlobales.filter(c => c.user_id === u.user_id).length;
        const lim = Number(u.max_comercios) >= 1 ? Number(u.max_comercios) : 1;
        return `
          <div class="bg-white p-3 rounded-xl border border-slate-200 flex items-center justify-between gap-3 text-xs">
            <div class="min-w-0">
              <p class="font-black text-slate-900 truncate">${escHtmlPerfil(u.nombre || 'Sin nombre')}</p>
              <p class="text-[10px] text-slate-400 truncate">${escHtmlPerfil(u.email || 'Email no disponible aún (se completa cuando vuelva a iniciar sesión)')}</p>
              <p class="text-[10px] font-bold text-slate-500 mt-0.5">Comercios cargados: ${cant}</p>
            </div>
            <div class="flex items-center gap-2 flex-shrink-0">
              <input type="number" min="1" max="50" id="limite-com-${u.user_id}" value="${lim}" class="clean-input w-14 px-2 py-1.5 rounded-lg font-bold text-xs text-center" title="Cantidad de comercios permitidos">
              <button type="button" onclick="guardarLimiteComerciosAdmin('${u.user_id}')" class="px-3 py-1.5 rounded-lg font-bold text-xs bg-emerald-500 text-white">Guardar</button>
            </div>
          </div>
        `;
      }).join('');
    }

    async function guardarLimiteComerciosAdmin(userId) {
      if (!esAdministrador()) return;
      const input = document.getElementById('limite-com-' + userId);
      const nuevo = parseInt(input ? input.value : '1');
      if (!nuevo || nuevo < 1) { alert('Ingresá un número válido (mínimo 1).'); return; }
      const { error } = await _supabase.from('perfiles_usuarios').upsert({ user_id: userId, max_comercios: nuevo }, { onConflict: 'user_id' });
      if (error) {
        alert('Error al guardar el límite: ' + error.message);
      } else {
        mostrarToast(`Límite actualizado: ${nuevo} comercio(s) para este usuario.`);
        if (usuarioActual && usuarioActual.id === userId) maxComerciosUsuario = nuevo;
        buscarUsuariosAdmin();
      }
    }

    function actualizarBadgeAdmin() {
      const b = document.getElementById('admin-badge');
      if (!b) return;
      const n = esAdministrador() ? comerciosGlobales.filter(c => c.activo !== true).length : 0;
      b.textContent = n;
      b.classList.toggle('hidden', n === 0);
    }

    async function renovarPlanAdmin(comercioId) {
      if (!esAdministrador()) return;
      const c = comerciosGlobales.find(x => String(x.id) === String(comercioId));
      if (!c || c.plan_original === 'gratis') { alert('Elegí primero un plan Pro o Ultra para este comercio.'); return; }
      const base = Math.max(Date.now(), c.plan_vence ? new Date(c.plan_vence).getTime() : 0);
      const { error } = await _supabase.from('comercios').update({ plan: c.plan_original, plan_vence: new Date(base + 30*864e5).toISOString() }).eq('id', comercioId);
      if (error) { alert('Error al renovar: ' + error.message); return; }
      mostrarToast('Plan renovado por 30 días.');
      await cargarComercios();
      abrirModalAdmin();
    }
