/* NecoVende - Encuadrar fotos de perfil y portada (como Instagram / Facebook).
 * Al elegir una foto se abre un editor: se arrastra para moverla y se agranda o achica con el control
 * (o pellizcando / con la rueda del mouse). El resultado reemplaza el archivo elegido y se sube igual que siempre.
 */
(function () {
  'use strict';
  var TIPOS = {
    logo:    { input: 'logo-input',    existente: 'comercio-logo-existente',    titulo: 'Encuadrá tu logo',    ratio: 1,      salida: [800, 800],   redondo: false },
    portada: { input: 'portada-input', existente: 'comercio-portada-existente', titulo: 'Encuadrá tu portada', ratio: 16 / 9, salida: [1600, 900], redondo: false }
  };
  var S = null;   // estado del editor abierto

  function $(id) { return document.getElementById(id); }

  function abrir(tipo, srcUrl, alAceptar, alCancelar) {
    cerrar();
    var T = TIPOS[tipo];
    var ov = document.createElement('div');
    ov.id = 'nv-recorte';
    ov.style.cssText = 'position:fixed;inset:0;z-index:95;background:rgba(2,6,23,.88);display:flex;flex-direction:column;align-items:center;justify-content:center;padding:16px;gap:14px;touch-action:none';
    var maxW = Math.min(window.innerWidth - 32, 560), maxH = window.innerHeight * 0.5;
    var w = maxW, h = w / T.ratio;
    if (h > maxH) { h = maxH; w = h * T.ratio; }
    w = Math.round(w); h = Math.round(h);
    ov.innerHTML =
      '<p style="color:#fff;font-weight:900;font-size:15px">' + T.titulo + '</p>' +
      '<div id="nv-rc-vista" style="position:relative;width:' + w + 'px;height:' + h + 'px;overflow:hidden;border-radius:' + (tipo === 'logo' ? '24px' : '14px') + ';background:#111;cursor:grab;outline:2px solid #fff">' +
        '<img id="nv-rc-img" alt="" draggable="false" style="position:absolute;left:0;top:0;max-width:none;user-select:none;-webkit-user-drag:none;transform-origin:0 0">' +
      '</div>' +
      '<div style="width:' + w + 'px;display:flex;align-items:center;gap:10px;color:#fff;font-size:18px"><span>➖</span>' +
        '<input id="nv-rc-zoom" type="range" min="1" max="4" step="0.01" value="1" style="flex:1;accent-color:#f97316"><span>➕</span></div>' +
      '<p style="color:#cbd5e1;font-size:11px;text-align:center">Arrastrá la foto para moverla · usá el control para agrandar o achicar</p>' +
      '<div style="display:flex;gap:10px;width:' + w + 'px"><button type="button" id="nv-rc-no" style="flex:1;padding:12px;border-radius:14px;background:#334155;color:#fff;font-weight:800;font-size:13px">Cancelar</button>' +
      '<button type="button" id="nv-rc-ok" style="flex:1;padding:12px;border-radius:14px;background:#f97316;color:#fff;font-weight:900;font-size:13px">Usar esta foto</button></div>';
    document.body.appendChild(ov);

    var img = $('nv-rc-img'), vista = $('nv-rc-vista'), zoom = $('nv-rc-zoom');
    S = { tipo: tipo, T: T, w: w, h: h, img: img, zoom: 1, ox: 0, oy: 0, s0: 1, ptr: {}, url: srcUrl };
    img.onload = function () {
      S.iw = img.naturalWidth; S.ih = img.naturalHeight;
      S.s0 = Math.max(w / S.iw, h / S.ih);
      S.ox = (w - S.iw * S.s0) / 2; S.oy = (h - S.ih * S.s0) / 2;
      aplicar();
    };
    img.onerror = function () { cerrar(); alert('No se pudo abrir esa foto. Probá con otra.'); if (alCancelar) alCancelar(); };
    img.src = srcUrl;

    function setZoom(z, cx, cy) {
      z = Math.min(4, Math.max(1, z));
      var sOld = S.s0 * S.zoom, sNew = S.s0 * z;
      cx = cx == null ? w / 2 : cx; cy = cy == null ? h / 2 : cy;
      // se mantiene fijo el punto de la foto que está bajo (cx, cy)
      S.ox = cx - (cx - S.ox) * (sNew / sOld); S.oy = cy - (cy - S.oy) * (sNew / sOld);
      S.zoom = z; zoom.value = z; aplicar();
    }
    zoom.oninput = function () { setZoom(parseFloat(zoom.value)); };
    vista.addEventListener('wheel', function (e) {
      e.preventDefault();
      var r = vista.getBoundingClientRect();
      setZoom(S.zoom * (e.deltaY < 0 ? 1.08 : 1 / 1.08), e.clientX - r.left, e.clientY - r.top);
    }, { passive: false });

    // arrastrar con mouse o dedo; con dos dedos, pellizcar
    var distIni = 0, zoomIni = 1;
    vista.addEventListener('pointerdown', function (e) {
      vista.setPointerCapture(e.pointerId); S.ptr[e.pointerId] = { x: e.clientX, y: e.clientY };
      vista.style.cursor = 'grabbing';
      var ids = Object.keys(S.ptr);
      if (ids.length === 2) { var a = S.ptr[ids[0]], b = S.ptr[ids[1]]; distIni = Math.hypot(a.x - b.x, a.y - b.y); zoomIni = S.zoom; }
    });
    vista.addEventListener('pointermove', function (e) {
      var p = S.ptr[e.pointerId]; if (!p) return;
      var ids = Object.keys(S.ptr);
      if (ids.length === 2) {
        S.ptr[e.pointerId] = { x: e.clientX, y: e.clientY };
        var a = S.ptr[ids[0]], b = S.ptr[ids[1]];
        if (distIni > 0) setZoom(zoomIni * Math.hypot(a.x - b.x, a.y - b.y) / distIni);
      } else {
        S.ox += e.clientX - p.x; S.oy += e.clientY - p.y;
        S.ptr[e.pointerId] = { x: e.clientX, y: e.clientY }; aplicar();
      }
    });
    var fin = function (e) { delete S.ptr[e.pointerId]; vista.style.cursor = 'grab'; };
    vista.addEventListener('pointerup', fin); vista.addEventListener('pointercancel', fin);

    $('nv-rc-no').onclick = function () { cerrar(); if (alCancelar) alCancelar(); };
    $('nv-rc-ok').onclick = function () { exportar().then(function (file) { cerrar(); alAceptar(file); }); };
  }

  // La foto siempre tiene que cubrir todo el recuadro (sin bordes vacíos)
  function aplicar() {
    if (!S || !S.iw) return;
    var s = S.s0 * S.zoom, iw = S.iw * s, ih = S.ih * s;
    S.ox = Math.min(0, Math.max(S.w - iw, S.ox)); S.oy = Math.min(0, Math.max(S.h - ih, S.oy));
    S.img.style.width = iw + 'px'; S.img.style.height = ih + 'px';
    S.img.style.transform = 'translate(' + S.ox + 'px,' + S.oy + 'px)';
  }

  function exportar() {
    return new Promise(function (resolve) {
      var s = S.s0 * S.zoom, T = S.T;
      var c = document.createElement('canvas'); c.width = T.salida[0]; c.height = T.salida[1];
      var ctx = c.getContext('2d'); ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(S.img, -S.ox / s, -S.oy / s, S.w / s, S.h / s, 0, 0, c.width, c.height);
      c.toBlob(function (blob) {
        var f = new File([blob], 'rec_' + Date.now() + '.webp', { type: 'image/webp', lastModified: Date.now() });
        f.nvRecortada = true;           // subirImagen la sube en tamaño grande, sin volver a achicarla
        resolve(f);
      }, 'image/webp', 0.88);
    });
  }
  function cerrar() { var o = $('nv-recorte'); if (o) o.remove(); if (S && S.url && /^blob:/.test(S.url)) URL.revokeObjectURL(S.url); S = null; }

  function ponerArchivo(input, file) {
    try { var dt = new DataTransfer(); dt.items.add(file); input.files = dt.files; } catch (e) { /* navegador viejo: queda la foto sin encuadrar */ }
  }

  /* Al elegir una foto en los campos de logo / portada */
  document.addEventListener('change', function (e) {
    var t = e.target; if (!t || t.type !== 'file') return;
    var tipo = t.id === 'logo-input' ? 'logo' : (t.id === 'portada-input' ? 'portada' : null);
    if (!tipo || !t.files || !t.files[0] || t.files[0].nvRecortada) return;
    var original = t.files[0];
    if (!/^image\//.test(original.type)) return;
    abrir(tipo, URL.createObjectURL(original), function (f) { ponerArchivo(t, f); }, function () { t.value = ''; });
  }, true);

  /* Botones "Reencuadrar la foto actual" (sin tener que volver a elegir el archivo) */
  window.nvReencuadrar = async function (tipo) {
    var T = TIPOS[tipo], url = ($(T.existente) || {}).value, input = $(T.input);
    if (!url) { alert('Todavía no hay una foto cargada. Elegí una con el botón de arriba.'); return; }
    try {
      var r = await fetch(url, { mode: 'cors' }); if (!r.ok) throw new Error('http');
      var blob = await r.blob();
      abrir(tipo, URL.createObjectURL(blob), function (f) { ponerArchivo(input, f); if (typeof mostrarToast === 'function') mostrarToast('Foto encuadrada. Tocá Guardar para aplicar.'); }, null);
    } catch (err) { alert('No se pudo abrir la foto actual. Elegí el archivo de nuevo con el botón de arriba.'); }
  };
  function agregarBotones() {
    [['logo', 'help-logo-edit'], ['portada', 'help-portada-edit']].forEach(function (x) {
      var p = $(x[1]); if (!p || p.dataset.nvRc) return; p.dataset.nvRc = '1';
      p.insertAdjacentHTML('afterend', '<button type="button" onclick="nvReencuadrar(\'' + x[0] + '\')" class="mt-1 text-[11px] font-bold text-brand-600 underline">✂️ Reencuadrar la foto actual</button>');
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', agregarBotones); else agregarBotones();
})();
