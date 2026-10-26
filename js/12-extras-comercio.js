    // =====================================================================
    // EXTRAS DEL COMERCIO: pausar por hoy, aviso, QR y stock por talle
    // (las columnas nuevas se crean con sql/04-extras-comercios.sql)
    // =====================================================================

    function esDuenioOAdminDelComercioActivo() {
      return Boolean(comercioActivo && usuarioActual && (comercioActivo.user_id === usuarioActual.id || esAdministrador()));
    }

    function avisarFaltaSql04(error) {
      if (error && (error.code === 'PGRST204' || /column|schema cache/i.test(error.message || ''))) {
        alert('Falta un paso en Supabase: corré el archivo sql/04-extras-comercios.sql (una sola vez) en el SQL Editor y probá de nuevo.');
      } else {
        alert('No se pudo guardar: ' + ((error && error.message) || 'error desconocido'));
      }
    }

    // Aplica un cambio ya guardado a las copias en memoria y redibuja el comercio
    function aplicarCambioComercioActivo(cambios) {
      const id = comercioActivo.id;
      Object.assign(comercioActivo, cambios);
      const enLista = comerciosGlobales.find(c => c.id === id);
      if (enLista && enLista !== comercioActivo) Object.assign(enLista, cambios);
      abrirVistaComercio(comercioActivo.slug || comercioActivo.id, false);
    }

    // ---------- Cerrar por hoy ----------
    // Medianoche de Argentina (UTC-3, sin horario de verano) del día siguiente
    function proximaMedianocheArgentina() {
      const ahoraAr = new Date(Date.now() - 3 * 3600 * 1000);
      return new Date(Date.UTC(ahoraAr.getUTCFullYear(), ahoraAr.getUTCMonth(), ahoraAr.getUTCDate() + 1) + 3 * 3600 * 1000);
    }

    async function alternarPausaHoy() {
      if (!esDuenioOAdminDelComercioActivo()) return;
      const pausado = estaPausado(comercioActivo);
      if (!pausado && !confirm('¿Cerrar tu local por hoy? Los clientes lo van a ver como CERRADO y se reabre solo a la medianoche. Podés reabrirlo antes cuando quieras.')) return;

      const nuevo = pausado ? null : proximaMedianocheArgentina().toISOString();
      const { error } = await _supabase.from('comercios').update({ pausado_hasta: nuevo }).eq('id', comercioActivo.id);
      if (error) { avisarFaltaSql04(error); return; }
      mostrarToast(pausado ? 'Tu local volvió a estar abierto.' : 'Tu local quedó cerrado por hoy.');
      aplicarCambioComercioActivo({ pausado_hasta: nuevo });
    }

    // ---------- Aviso del comercio ----------
    function abrirModalAvisoComercio() {
      if (!esDuenioOAdminDelComercioActivo()) return;
      document.getElementById('aviso-comercio-texto').value = comercioActivo.aviso_texto || '';
      abrirModal('modal-aviso-comercio');
    }

    async function guardarAvisoComercio(quitar) {
      if (!esDuenioOAdminDelComercioActivo()) return;
      const texto = quitar ? '' : document.getElementById('aviso-comercio-texto').value.replace(/\s+/g, ' ').trim().slice(0, 140);
      if (!quitar && !texto) { alert('Escribí el aviso o tocá "Quitar".'); return; }
      const valor = texto || null;
      const { error } = await _supabase.from('comercios').update({ aviso_texto: valor }).eq('id', comercioActivo.id);
      if (error) { avisarFaltaSql04(error); return; }
      cerrarModal('modal-aviso-comercio');
      mostrarToast(valor ? 'Aviso publicado.' : 'Aviso quitado.');
      aplicarCambioComercioActivo({ aviso_texto: valor });
    }

    // ---------- QR del local ----------
    let _promesaGeneradorQr = null;
    function cargarGeneradorQr() {
      if (typeof qrCrear === 'function') return Promise.resolve();
      if (!_promesaGeneradorQr) {
        _promesaGeneradorQr = new Promise((ok, mal) => {
          const s = document.createElement('script');
          s.src = 'js/qr-generator.js';
          s.onload = ok;
          s.onerror = () => { _promesaGeneradorQr = null; mal(new Error('No se pudo cargar el generador de QR')); };
          document.head.appendChild(s);
        });
      }
      return _promesaGeneradorQr;
    }

    function linkDelComercio(c) {
      return `${window.location.origin}${window.location.pathname}?menu=${c.slug || c.id}`;
    }

    // Dibuja la "tarjeta" imprimible: nombre del local + QR + texto de ayuda
    function dibujarTarjetaQr(canvas, nombre, url) {
      const W = 720, H = 960;
      canvas.width = W; canvas.height = H;
      const g = canvas.getContext('2d');

      g.fillStyle = '#ffffff'; g.fillRect(0, 0, W, H);

      // Franja naranja con el nombre
      const grad = g.createLinearGradient(0, 0, W, 0);
      grad.addColorStop(0, '#ea580c'); grad.addColorStop(1, '#f59e0b');
      g.fillStyle = grad; g.fillRect(0, 0, W, 170);
      g.fillStyle = '#ffffff'; g.textAlign = 'center'; g.textBaseline = 'middle';
      let tam = 56;
      g.font = `800 ${tam}px "Plus Jakarta Sans", Arial, sans-serif`;
      while (g.measureText(nombre).width > W - 80 && tam > 26) { tam -= 2; g.font = `800 ${tam}px "Plus Jakarta Sans", Arial, sans-serif`; }
      let titulo = nombre;
      while (g.measureText(titulo).width > W - 80 && titulo.length > 3) titulo = titulo.slice(0, -2);
      if (titulo !== nombre) titulo = titulo.trimEnd() + '…';
      g.fillText(titulo, W / 2, 85);

      // QR
      const qr = qrCrear(url, 'M');
      const margen = 4;
      const modulo = Math.floor(560 / (qr.size + margen * 2));
      const lado = modulo * (qr.size + margen * 2);
      const x0 = Math.floor((W - lado) / 2), y0 = 210;
      g.fillStyle = '#ffffff'; g.fillRect(x0, y0, lado, lado);
      g.strokeStyle = '#e2e8f0'; g.lineWidth = 2; g.strokeRect(x0 - 1, y0 - 1, lado + 2, lado + 2);
      g.fillStyle = '#111827';
      for (let y = 0; y < qr.size; y++) for (let x = 0; x < qr.size; x++) {
        if (qr.modules[y][x]) g.fillRect(x0 + (x + margen) * modulo, y0 + (y + margen) * modulo, modulo, modulo);
      }

      // Texto
      g.fillStyle = '#0f172a'; g.font = '800 40px "Plus Jakarta Sans", Arial, sans-serif';
      g.fillText('Escaneá y mirá nuestro menú', W / 2, y0 + lado + 70);
      g.fillStyle = '#475569'; g.font = '600 28px "Plus Jakarta Sans", Arial, sans-serif';
      g.fillText('Pedí directo por WhatsApp', W / 2, y0 + lado + 118);
      g.fillStyle = '#ea580c'; g.font = '800 30px "Plus Jakarta Sans", Arial, sans-serif';
      g.fillText('NecoVende', W / 2, H - 50);
    }

    async function abrirModalQrComercio() {
      if (!esDuenioOAdminDelComercioActivo()) return;
      try {
        await cargarGeneradorQr();
        const url = linkDelComercio(comercioActivo);
        dibujarTarjetaQr(document.getElementById('qr-canvas'), comercioActivo.nombre, url);
        document.getElementById('qr-link-txt').innerText = url;
        abrirModal('modal-qr-comercio');
        if (window.lucide) lucide.createIcons();
      } catch (e) {
        alert('No se pudo generar el QR: ' + e.message);
      }
    }

    function descargarQrComercio() {
      const canvas = document.getElementById('qr-canvas');
      const nombreArchivo = `qr-${crearSlug(comercioActivo ? comercioActivo.nombre : 'local') || 'local'}.png`;
      const bajar = (href, limpiar) => {
        const a = document.createElement('a');
        a.href = href; a.download = nombreArchivo;
        document.body.appendChild(a); a.click(); a.remove();
        if (limpiar) setTimeout(() => URL.revokeObjectURL(href), 2000);
      };
      if (canvas.toBlob) {
        canvas.toBlob(blob => { if (blob) bajar(URL.createObjectURL(blob), true); else bajar(canvas.toDataURL('image/png'), false); }, 'image/png');
      } else {
        bajar(canvas.toDataURL('image/png'), false);
      }
    }

    // ---------- Stock por talle (formulario de producto) ----------
    function talleDesdeTexto() {
      const txt = document.getElementById('prod-talles-input').value;
      return [...new Set(txt.split(',').map(x => x.trim()).filter(Boolean))];
    }

    // previo: objeto {talle: cantidad} al editar; sin argumento conserva lo que ya se escribió
    function renderizarStockTalles(previo) {
      const box = document.getElementById('box-stock-talles');
      const grid = document.getElementById('grid-stock-talles');
      if (!box || !grid) return;

      let actuales = {};
      if (previo && typeof previo === 'object' && !previo.target) actuales = previo;
      else grid.querySelectorAll('input[data-talle]').forEach(i => { actuales[i.dataset.talle] = i.value; });

      const talles = talleDesdeTexto();
      if (talles.length === 0) {
        box.classList.add('hidden');
        grid.innerHTML = '';
        actualizarTotalStockTalles();
        return;
      }
      box.classList.remove('hidden');
      grid.innerHTML = talles.map(t => {
        const v = Object.prototype.hasOwnProperty.call(actuales, t) && actuales[t] !== null && actuales[t] !== '' ? actuales[t] : '';
        return `<label class="block">
          <span class="block text-[10px] font-bold text-slate-500 mb-0.5 truncate">${esc(t)}</span>
          <input type="number" min="0" step="1" inputmode="numeric" data-talle="${esc(t)}" value="${esc(v)}" oninput="actualizarTotalStockTalles()" placeholder="—" class="w-full clean-input px-2.5 py-2 rounded-lg text-xs font-semibold text-center">
        </label>`;
      }).join('');
      actualizarTotalStockTalles();
    }

    function actualizarTotalStockTalles() {
      const llenos = [...document.querySelectorAll('#grid-stock-talles input[data-talle]')].filter(i => i.value.trim() !== '');
      const total = llenos.reduce((s, i) => s + (parseInt(i.value, 10) || 0), 0);
      const totalEl = document.getElementById('total-stock-talles');
      const stockEl = document.getElementById('prod-stock');
      if (llenos.length > 0) {
        totalEl.innerText = `Stock total: ${total} (se calcula solo)`;
        totalEl.classList.remove('hidden');
        if (stockEl) { stockEl.value = total; stockEl.readOnly = true; stockEl.classList.add('opacity-60'); }
      } else {
        totalEl.classList.add('hidden');
        if (stockEl) { stockEl.readOnly = false; stockEl.classList.remove('opacity-60'); }
      }
    }

    // Devuelve { ok, valor: {talle: n} | null, total } o { ok: false, error }
    function leerStockTalles(talles) {
      const inputs = [...document.querySelectorAll('#grid-stock-talles input[data-talle]')];
      const valor = {};
      let total = 0, hayAlguno = false, hayVacio = false;
      for (const t of talles) {
        const inp = inputs.find(i => i.dataset.talle === t);
        const txt = inp ? inp.value.trim() : '';
        if (txt === '') { hayVacio = true; continue; }
        const n = Number(txt);
        if (!Number.isInteger(n) || n < 0) return { ok: false, error: `El stock del talle ${t} tiene que ser un número entero (0 o más).` };
        valor[t] = n; total += n; hayAlguno = true;
      }
      if (!hayAlguno) return { ok: true, valor: null, total: 0 };
      if (hayVacio) return { ok: false, error: 'Completá el stock de todos los talles (poné 0 si no hay) o dejá todos vacíos.' };
      return { ok: true, valor, total };
    }
