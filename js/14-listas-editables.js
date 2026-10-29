    // ---------- Listas editables (gustos, talles, colores, opciones) ----------
    // Reemplaza los campos "separados por coma" por: campo + botón Agregar + panel con la lista.
    // Cada ítem tiene una tilde (disponible / no disponible por ahora) y una ✕ (eliminar).
    //
    // El campo de texto original sigue existiendo (oculto) y guarda SOLO los ítems tildados separados por coma,
    // así el guardado, el stock por talle y todo lo que ve el cliente siguen funcionando igual.
    // Los ítems destildados se guardan aparte, en la columna `opciones_ocultas` (jsonb) de comercios / productos.
    const LISTAS_EDITABLES = {
      'sabores-input':               { clave: 'sabores',             titulo: 'Gustos / sabores del comercio', uno: 'gusto',  ej: 'Ej: Dulce de leche' },
      'prod-sabores-especificos':    { clave: 'sabores_especificos', titulo: 'Gustos de este producto',       uno: 'gusto',  ej: 'Ej: Chocolate' },
      'prod-opciones-custom-input':  { clave: 'opciones_custom',     titulo: 'Opciones personalizadas',       uno: 'opción', ej: 'Ej: Sin cebolla' },
      'prod-talles-input':           { clave: 'talles',              titulo: 'Talles',                        uno: 'talle',  ej: 'Ej: XL' },
      'prod-colores-input':          { clave: 'colores',             titulo: 'Colores',                       uno: 'color',  ej: 'Ej: Negro' }
    };
    const LE_MAX_ITEMS = 100, LE_MAX_LARGO = 40;
    const leEstado = {};      // inputId -> [{ t: 'texto', on: true|false }]
    let leActual = null;      // inputId abierto en el panel

    function leItems(id) { return leEstado[id] || (leEstado[id] = []); }

    // Escribe en el campo original solo los tildados (y avisa para que el stock por talle se actualice)
    function leSincronizar(id, avisar) {
      const input = document.getElementById(id);
      if (!input) return;
      input.value = leItems(id).filter(i => i.on).map(i => i.t).join(', ');
      if (avisar) input.dispatchEvent(new Event('input', { bubbles: true }));
      leResumen(id);
      if (leActual === id) lePintarPanel();
    }

    function leResumen(id) {
      const btn = document.getElementById('le-btn-' + id);
      if (!btn) return;
      const items = leItems(id), off = items.filter(i => !i.on).length;
      btn.querySelector('span').textContent = items.length
        ? `Ver lista (${items.length}${off ? ' · ' + off + ' sin stock' : ''})`
        : 'Lista vacía';
    }

    // Parte lo escrito por comas, limpia y agrega. Si ya existe (aunque esté destildado) lo vuelve a tildar.
    function leAgregar(id, texto) {
      const cfg = LISTAS_EDITABLES[id], items = leItems(id);
      const nuevos = String(texto || '').split(',').map(x => x.trim().slice(0, LE_MAX_LARGO)).filter(Boolean);
      let repetidos = 0;
      for (const t of nuevos) {
        const ya = items.find(i => i.t.toLowerCase() === t.toLowerCase());
        if (ya) { ya.on = true; repetidos++; continue; }
        if (items.length >= LE_MAX_ITEMS) { alert(`Máximo ${LE_MAX_ITEMS} ${cfg.uno}s por lista.`); break; }
        items.push({ t, on: true });
      }
      if (nuevos.length && repetidos === nuevos.length) mostrarToast(`Ese ${cfg.uno} ya estaba en la lista.`);
      leSincronizar(id, true);
      return nuevos.length > 0;
    }

    function leCargar(id, activos, ocultos) {
      if (!LISTAS_EDITABLES[id]) return;
      const vistos = new Set(), items = [];
      const poner = (arr, on) => (Array.isArray(arr) ? arr : []).forEach(t => {
        const s = String(t).trim();
        if (!s || vistos.has(s.toLowerCase())) return;
        vistos.add(s.toLowerCase()); items.push({ t: s, on });
      });
      poner(activos, true); poner(ocultos, false);
      leEstado[id] = items;
      leSincronizar(id, false);
    }

    function leOcultos(id) { return leItems(id).filter(i => !i.on).map(i => i.t); }

    // Arma el objeto para guardar en la columna opciones_ocultas, solo con las claves de los ids pedidos
    function leOcultosObjeto(ids) {
      const o = {};
      ids.forEach(id => { const arr = leOcultos(id); if (arr.length) o[LISTAS_EDITABLES[id].clave] = arr; });
      return o;
    }
    function leTieneOcultos(ids) { return ids.some(id => leOcultos(id).length > 0); }

    // ---- Panel ----
    function leAbrirPanel(id) {
      leActual = id;
      document.getElementById('le-titulo').textContent = LISTAS_EDITABLES[id].titulo;
      document.getElementById('le-input').placeholder = LISTAS_EDITABLES[id].ej;
      document.getElementById('le-input').value = '';
      lePintarPanel();
      abrirModal('modal-lista-editable');
    }
    function leCerrarPanel() { leActual = null; cerrarModal('modal-lista-editable'); }

    function lePintarPanel() {
      if (!leActual) return;
      const items = leItems(leActual), cont = document.getElementById('le-lista');
      if (!items.length) {
        cont.innerHTML = '<p class="text-xs text-slate-400 text-center py-6">Todavía no agregaste nada.</p>';
        return;
      }
      cont.innerHTML = items.map((it, i) => `
        <div class="flex items-center gap-3 py-2 border-b border-slate-100 last:border-0">
          <input type="checkbox" ${it.on ? 'checked' : ''} onchange="leTildar(${i}, this.checked)" id="le-chk-${i}" class="w-5 h-5 rounded border-slate-300 text-brand-500 cursor-pointer shrink-0">
          <label for="le-chk-${i}" class="flex-1 text-sm font-semibold cursor-pointer break-words ${it.on ? 'text-slate-800' : 'text-slate-400 line-through'}">${esc(it.t)}</label>
          <button type="button" onclick="leEliminar(${i})" aria-label="Eliminar ${esc(it.t)}" class="w-8 h-8 shrink-0 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 font-black text-sm">✕</button>
        </div>`).join('');
    }

    function leTildar(i, on) {
      const it = leItems(leActual)[i]; if (!it) return;
      it.on = on; leSincronizar(leActual, true);
    }
    function leEliminar(i) {
      const items = leItems(leActual), it = items[i]; if (!it) return;
      if (!confirm(`¿Eliminar "${it.t}" de la lista? Si solo no tenés por ahora, destildalo.`)) return;
      items.splice(i, 1); leSincronizar(leActual, true);
    }
    function leAgregarDesdePanel() {
      const inp = document.getElementById('le-input');
      if (leAgregar(leActual, inp.value)) { inp.value = ''; }
      inp.focus();
    }

    // ---- Armado inicial: oculta el campo original y pone el nuevo control justo debajo ----
    function leIniciar() {
      Object.keys(LISTAS_EDITABLES).forEach(id => {
        const original = document.getElementById(id);
        if (!original || document.getElementById('le-box-' + id)) return;
        const cfg = LISTAS_EDITABLES[id];
        original.classList.add('hidden');
        const box = document.createElement('div');
        box.id = 'le-box-' + id;
        box.className = 'space-y-2';
        box.innerHTML = `
          <div class="flex gap-2">
            <input type="text" id="le-in-${id}" maxlength="${LE_MAX_LARGO * 5}" autocomplete="off" enterkeyhint="done" placeholder="${esc(cfg.ej)}" class="flex-1 min-w-0 clean-input px-3 py-2 rounded-xl text-xs font-semibold">
            <button type="button" id="le-add-${id}" class="shrink-0 bg-brand-500 hover:bg-brand-600 text-white px-4 rounded-xl text-xs font-black active:scale-95 transition">Agregar</button>
          </div>
          <button type="button" id="le-btn-${id}" class="w-full flex items-center justify-between bg-white border border-slate-200 hover:border-brand-300 rounded-xl px-3 py-2 text-xs font-bold text-brand-600 transition">
            <span>Lista vacía</span><span aria-hidden="true">›</span>
          </button>`;
        original.insertAdjacentElement('afterend', box);

        const inp = box.querySelector('#le-in-' + id);
        const agregar = () => { if (leAgregar(id, inp.value)) inp.value = ''; inp.focus(); };
        box.querySelector('#le-add-' + id).addEventListener('click', agregar);
        inp.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); agregar(); } });
        // el segundo <span> del botón es la flecha: el resumen escribe en el primero
        box.querySelector('#le-btn-' + id).addEventListener('click', () => leAbrirPanel(id));

        // Al limpiar el formulario (nuevo comercio / producto) se vacía también la lista
        const form = original.closest('form');
        if (form) form.addEventListener('reset', () => setTimeout(() => { leEstado[id] = []; box.querySelector('#le-in-' + id).value = ''; leSincronizar(id, false); }, 0));
        leCargar(id, [], []);
      });

      const pin = document.getElementById('le-input');
      if (pin) pin.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); leAgregarDesdePanel(); } });
    }
    document.addEventListener('DOMContentLoaded', leIniciar);
    if (document.readyState !== 'loading') leIniciar();
