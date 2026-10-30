/* NecoVende - Instalar la app (PWA)
 * - Registra el service worker (sw.js) con control de versión.
 * - Muestra un cartel arriba de todo: "Instalar NecoVende".
 *     Android / Chrome: usa el botón real de instalación del navegador.
 *     iPhone / iPad:    muestra las instrucciones (Compartir → Agregar a pantalla de inicio).
 * - Si lo cierran, no vuelve a molestar por DIAS_SIN_MOLESTAR días.
 * - Si la app ya está instalada (o se abre desde el ícono), no aparece.
 */
(function () {
  'use strict';

  var DIAS_SIN_MOLESTAR = 5;
  var CLAVE_CIERRE = 'necovende_pwa_cierre';
  var CLAVE_INSTALADA = 'necovende_pwa_instalada';

  /* ---------- localStorage seguro ---------- */
  function lsGet(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function lsSet(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* ignorar */ } }

  /* ---------- Service worker ---------- */
  if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
    window.addEventListener('load', function () {
      navigator.serviceWorker.register('/sw.js', { scope: '/', updateViaCache: 'none' })
        .then(function (reg) {
          // Busca versión nueva al volver a la app (por si quedó abierta mucho tiempo).
          document.addEventListener('visibilitychange', function () {
            if (document.visibilityState === 'visible') reg.update().catch(function () {});
          });
        })
        .catch(function () { /* si falla, la página funciona igual */ });
    });
  }

  /* ---------- ¿Ya está instalada? ---------- */
  function estaInstalada() {
    try {
      if (window.matchMedia('(display-mode: standalone)').matches) return true;
      if (window.matchMedia('(display-mode: fullscreen)').matches) return true;
      if (window.matchMedia('(display-mode: minimal-ui)').matches) return true;
    } catch (e) { /* ignorar */ }
    if (window.navigator.standalone === true) return true;        // iOS desde el ícono
    if (lsGet(CLAVE_INSTALADA) === '1') return true;              // se instaló desde el cartel
    return false;
  }

  function enPausa() {
    var t = parseInt(lsGet(CLAVE_CIERRE) || '0', 10);
    return t > 0 && (Date.now() - t) < DIAS_SIN_MOLESTAR * 86400000;
  }

  if (estaInstalada()) return;

  /* ---------- Plataforma ---------- */
  var ua = navigator.userAgent || '';
  var esIOS = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  // Navegadores dentro de otras apps (Instagram, Facebook, etc.): ahí no se puede instalar.
  var enAppInterna = /FBAN|FBAV|FB_IAB|Instagram|Line\/|MicroMessenger|TikTok|; wv\)/i.test(ua);

  var promptDiferido = null;   // evento beforeinstallprompt (Android / Chrome)
  var cartel = null;

  /* ---------- Estilos propios (no dependen de Tailwind) ---------- */
  function inyectarEstilos() {
    if (document.getElementById('nv-pwa-css')) return;
    var s = document.createElement('style');
    s.id = 'nv-pwa-css';
    s.textContent =
      '#nv-pwa-cartel{position:relative;z-index:45;background:#f97316;color:#fff;font-family:inherit;box-shadow:0 2px 10px rgba(0,0,0,.18)}' +
      '#nv-pwa-cartel .nv-in{max-width:42rem;margin:0 auto;display:flex;align-items:center;gap:10px;padding:10px 12px}' +
      '#nv-pwa-cartel img{width:38px;height:38px;border-radius:10px;background:#fff;flex:none}' +
      '#nv-pwa-cartel .nv-tx{flex:1;min-width:0;line-height:1.2}' +
      '#nv-pwa-cartel .nv-tx b{display:block;font-size:14px;font-weight:800}' +
      '#nv-pwa-cartel .nv-tx span{display:block;font-size:11.5px;opacity:.95}' +
      '#nv-pwa-cartel .nv-btn{flex:none;background:#fff;color:#c2410c;border:0;border-radius:999px;padding:8px 14px;font-weight:800;font-size:12.5px;cursor:pointer}' +
      '#nv-pwa-cartel .nv-x{flex:none;background:transparent;border:0;color:#fff;font-size:20px;line-height:1;padding:4px 6px;cursor:pointer;opacity:.9}' +
      '#nv-pwa-ios{position:fixed;inset:0;z-index:100;background:rgba(15,23,42,.55);display:flex;align-items:flex-end;justify-content:center;font-family:inherit}' +
      '#nv-pwa-ios .nv-hoja{background:#fff;color:#0f172a;width:100%;max-width:28rem;border-radius:22px 22px 0 0;padding:20px 18px calc(22px + env(safe-area-inset-bottom));box-shadow:0 -10px 30px rgba(0,0,0,.25)}' +
      '#nv-pwa-ios h3{margin:0 0 4px;font-size:17px;font-weight:800}' +
      '#nv-pwa-ios p{margin:0 0 12px;font-size:13px;color:#475569}' +
      '#nv-pwa-ios ol{margin:0 0 16px;padding:0;list-style:none;counter-reset:p}' +
      '#nv-pwa-ios li{counter-increment:p;display:flex;gap:10px;align-items:flex-start;font-size:14px;margin-bottom:10px;line-height:1.35}' +
      '#nv-pwa-ios li:before{content:counter(p);flex:none;width:24px;height:24px;border-radius:50%;background:#ffedd5;color:#c2410c;font-weight:800;font-size:13px;display:flex;align-items:center;justify-content:center}' +
      '#nv-pwa-ios .nv-cerrar{width:100%;background:#0f172a;color:#fff;border:0;border-radius:12px;padding:12px;font-weight:800;font-size:13px;cursor:pointer}' +
      '#nv-pwa-ios svg{width:16px;height:16px;vertical-align:-3px}';
    document.head.appendChild(s);
  }

  /* ---------- Cartel ---------- */
  function mostrarCartel() {
    if (cartel || estaInstalada() || enPausa() || enAppInterna) return;
    if (!document.body) return;
    inyectarEstilos();

    cartel = document.createElement('div');
    cartel.id = 'nv-pwa-cartel';
    cartel.setAttribute('role', 'region');
    cartel.setAttribute('aria-label', 'Instalar NecoVende');
    cartel.innerHTML =
      '<div class="nv-in">' +
        '<img src="img/icon-192.png" alt="" width="38" height="38">' +
        '<div class="nv-tx"><b>Instalar NecoVende</b><span>' +
          (esIOS ? 'Agregala a tu pantalla de inicio' : 'Entrá más rápido, como una app') +
        '</span></div>' +
        '<button type="button" class="nv-btn" id="nv-pwa-instalar">' + (esIOS ? 'Cómo instalar' : 'Instalar') + '</button>' +
        '<button type="button" class="nv-x" id="nv-pwa-cerrar" aria-label="Cerrar">✕</button>' +
      '</div>';
    document.body.insertBefore(cartel, document.body.firstChild);

    document.getElementById('nv-pwa-cerrar').addEventListener('click', function () {
      lsSet(CLAVE_CIERRE, String(Date.now()));
      ocultarCartel();
    });
    document.getElementById('nv-pwa-instalar').addEventListener('click', function () {
      if (esIOS) { mostrarInstruccionesIOS(); return; }
      instalarAndroid();
    });
  }

  function ocultarCartel() {
    if (cartel && cartel.parentNode) cartel.parentNode.removeChild(cartel);
    cartel = null;
  }

  /* ---------- Android / Chrome: botón real de instalar ---------- */
  function instalarAndroid() {
    if (!promptDiferido) return;
    var p = promptDiferido;
    promptDiferido = null;
    p.prompt();
    p.userChoice.then(function (r) {
      if (r && r.outcome === 'accepted') {
        lsSet(CLAVE_INSTALADA, '1');
      } else {
        lsSet(CLAVE_CIERRE, String(Date.now()));   // lo rechazó: no insistir por unos días
      }
      ocultarCartel();
    }).catch(function () { ocultarCartel(); });
  }

  window.addEventListener('beforeinstallprompt', function (e) {
    e.preventDefault();                 // guardamos el evento para usarlo con nuestro botón
    promptDiferido = e;
    if (!esIOS) mostrarCartel();
  });

  window.addEventListener('appinstalled', function () {
    lsSet(CLAVE_INSTALADA, '1');
    promptDiferido = null;
    ocultarCartel();
  });

  /* ---------- iPhone / iPad: instrucciones ---------- */
  var ICONO_COMPARTIR =
    '<svg viewBox="0 0 24 24" fill="none" stroke="#2563eb" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
    '<path d="M12 3v12"/><path d="M8 7l4-4 4 4"/><path d="M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7"/></svg>';

  function mostrarInstruccionesIOS() {
    if (document.getElementById('nv-pwa-ios')) return;
    inyectarEstilos();
    var m = document.createElement('div');
    m.id = 'nv-pwa-ios';
    m.setAttribute('role', 'dialog');
    m.setAttribute('aria-modal', 'true');
    m.innerHTML =
      '<div class="nv-hoja">' +
        '<h3>Instalá NecoVende en tu iPhone</h3>' +
        '<p>Son 3 pasos y queda como una app más.</p>' +
        '<ol>' +
          '<li><span>Tocá el botón <b>Compartir</b> ' + ICONO_COMPARTIR + ' (abajo en Safari, o arriba a la derecha).</span></li>' +
          '<li><span>Deslizá y elegí <b>Agregar a pantalla de inicio</b>.</span></li>' +
          '<li><span>Tocá <b>Agregar</b>. ¡Listo!</span></li>' +
        '</ol>' +
        '<button type="button" class="nv-cerrar" id="nv-pwa-ios-ok">Entendido</button>' +
      '</div>';
    document.body.appendChild(m);
    function cerrar() {
      if (m.parentNode) m.parentNode.removeChild(m);
      lsSet(CLAVE_CIERRE, String(Date.now()));
      ocultarCartel();
    }
    document.getElementById('nv-pwa-ios-ok').addEventListener('click', cerrar);
    m.addEventListener('click', function (ev) { if (ev.target === m) cerrar(); });
  }

  /* En iOS no existe el evento de instalación: mostramos el cartel apenas carga la página. */
  if (esIOS) {
    window.addEventListener('load', function () { setTimeout(mostrarCartel, 1500); });
  }
})();
