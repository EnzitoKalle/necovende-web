/* NecoVende - Notificaciones push (botón en "Panel de Control")
 * Guarda la suscripción de ESTE dispositivo asociada al usuario logueado
 * (comercio o cliente) usando la función de base de datos nv_guardar_push.
 * El envío lo hace la Edge Function "enviar-push" (ver nv_notificar_usuario en SQL).
 */

// Clave PÚBLICA VAPID (la misma que usa neco-envios en su push.js).
// Mientras tenga el texto de ejemplo, el botón queda oculto y nada se rompe.
const NV_VAPID_PUBLIC_KEY = 'PEGAR_ACA_LA_CLAVE_PUBLICA_VAPID';

(function () {
  'use strict';

  function claveConfigurada() {
    return typeof NV_VAPID_PUBLIC_KEY === 'string' && NV_VAPID_PUBLIC_KEY.length > 60 && !/^PEGAR/.test(NV_VAPID_PUBLIC_KEY);
  }
  function esIOS() {
    var ua = navigator.userAgent || '';
    return /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  }
  function esStandalone() {
    try { if (window.matchMedia('(display-mode: standalone)').matches) return true; } catch (e) { /* ok */ }
    return window.navigator.standalone === true;
  }
  function soportado() {
    return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
  }
  function aBytes(b64) {
    var pad = '='.repeat((4 - (b64.length % 4)) % 4);
    var raw = atob((b64 + pad).replace(/-/g, '+').replace(/_/g, '/'));
    var out = new Uint8Array(raw.length);
    for (var i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
    return out;
  }
  function mismaClave(sub) {
    try {
      var k = sub.options && sub.options.applicationServerKey;
      if (!k) return true;
      var a = new Uint8Array(k), b = aBytes(NV_VAPID_PUBLIC_KEY);
      if (a.length !== b.length) return false;
      for (var i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
      return true;
    } catch (e) { return true; }
  }

  async function suscripcionLocal() {
    if (!soportado()) return null;
    var reg = await navigator.serviceWorker.getRegistration('/');
    if (!reg) return null;
    return await reg.pushManager.getSubscription();
  }

  async function guardarEnServidor(sub) {
    var j = sub.toJSON();
    var r = await _supabase.rpc('nv_guardar_push', {
      p_endpoint: j.endpoint,
      p_p256dh: j.keys && j.keys.p256dh,
      p_auth: j.keys && j.keys.auth,
      p_ua: (navigator.userAgent || '').slice(0, 200)
    });
    if (r.error) throw new Error(r.error.message);
  }

  /* ---------- Interfaz ---------- */
  function caja() { return document.getElementById('push-bloque'); }

  function pintar(titulo, texto, botones, extra) {
    var c = caja(); if (!c) return;
    var html =
      '<h4 class="text-xs font-black text-slate-700 uppercase tracking-wider flex items-center gap-1.5">' +
        '<i data-lucide="bell" class="w-4 h-4 text-brand-500"></i> Notificaciones</h4>' +
      '<p class="text-[11px] text-slate-500 leading-snug"><b class="text-slate-700">' + titulo + '</b> ' + texto + '</p>' +
      (extra ? '<p class="text-[11px] text-rose-600 font-semibold">' + extra + '</p>' : '') +
      '<div class="flex gap-2 flex-wrap">' + (botones || '') + '</div>';
    c.innerHTML = html;
    c.classList.remove('hidden');
    if (window.lucide) try { lucide.createIcons(); } catch (e) { /* ok */ }
  }
  var BTN = 'text-xs font-black px-3.5 py-2.5 rounded-xl transition active:scale-95 ';
  var BTN_PRIN = BTN + 'bg-brand-500 hover:bg-brand-600 text-white';
  var BTN_SEC = BTN + 'bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200';

  async function refrescar(mensajeError) {
    var c = caja(); if (!c) return;
    if (!claveConfigurada()) { c.classList.add('hidden'); return; }

    if (esIOS() && !esStandalone()) {
      pintar('Primero instalá la app.',
        'En iPhone las notificaciones solo funcionan con NecoVende instalada: Compartir → Agregar a pantalla de inicio, abrila desde el ícono y activá los avisos desde acá.',
        '<button type="button" onclick="nvPushVerInstrucciones()" class="' + BTN_PRIN + '">Cómo instalar</button>');
      return;
    }
    if (!soportado()) {
      pintar('Tu navegador no permite avisos.', 'Probá con Chrome (Android) o instalá la app.', '');
      return;
    }
    if (Notification.permission === 'denied') {
      pintar('Las notificaciones están bloqueadas.',
        'Activalas desde los ajustes del navegador o de la app para este sitio y volvé a intentar.', '', mensajeError);
      return;
    }
    var sub = null;
    try { sub = await suscripcionLocal(); } catch (e) { /* ok */ }
    if (sub && Notification.permission === 'granted') {
      pintar('Activadas en este dispositivo.',
        'Te avisamos de tus pedidos aunque tengas la app cerrada.',
        '<button type="button" onclick="nvPushProbar(this)" class="' + BTN_SEC + '">Enviarme una prueba</button>' +
        '<button type="button" onclick="nvPushDesactivar()" class="' + BTN_SEC + '">Desactivar</button>', mensajeError);
    } else {
      pintar('Activá los avisos.',
        'Enterate al instante cuando haya novedades de tus pedidos.',
        '<button type="button" onclick="nvPushActivar(this)" class="' + BTN_PRIN + '">Activar notificaciones</button>', mensajeError);
    }
  }

  /* ---------- Acciones (se llaman desde los botones) ---------- */
  window.nvPushRefrescar = function () { return refrescar(); };

  window.nvPushVerInstrucciones = function () {
    if (window.NecoInstalar && window.NecoInstalar.mostrarInstruccionesIOS) window.NecoInstalar.mostrarInstruccionesIOS();
  };

  window.nvPushActivar = async function (btn) {
    if (btn) { btn.disabled = true; btn.textContent = 'Activando...'; }
    try {
      if (typeof usuarioActual === 'undefined' || !usuarioActual) throw new Error('Iniciá sesión para activar los avisos.');
      var permiso = await Notification.requestPermission();      // tiene que ser dentro del toque del botón
      if (permiso !== 'granted') { await refrescar(); return; }
      var reg = await navigator.serviceWorker.ready;
      var sub = await reg.pushManager.getSubscription();
      if (sub && !mismaClave(sub)) { await sub.unsubscribe(); sub = null; }
      if (!sub) {
        sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: aBytes(NV_VAPID_PUBLIC_KEY) });
      }
      await guardarEnServidor(sub);
      await refrescar();
    } catch (e) {
      await refrescar('No se pudo activar: ' + (e && e.message ? e.message : 'error desconocido'));
    }
  };

  window.nvPushDesactivar = async function () {
    try {
      var sub = await suscripcionLocal();
      if (sub) {
        var ep = sub.endpoint;
        await sub.unsubscribe();
        await _supabase.rpc('nv_borrar_push', { p_endpoint: ep });
      }
    } catch (e) { /* ok */ }
    await refrescar();
  };

  window.nvPushProbar = async function (btn) {
    var txt = btn ? btn.textContent : '';
    if (btn) { btn.disabled = true; btn.textContent = 'Enviando...'; }
    var r = await _supabase.rpc('nv_enviar_prueba');
    if (btn) { btn.disabled = false; btn.textContent = r.error ? txt : '¡Enviada!'; }
    if (r.error) await refrescar(r.error.message);
    else setTimeout(function () { refrescar(); }, 2500);
  };

  /* Al cerrar sesión: este dispositivo deja de recibir avisos de esa cuenta. */
  window.nvPushDesvincular = async function () {
    try {
      var sub = await suscripcionLocal();
      if (sub) await _supabase.rpc('nv_borrar_push', { p_endpoint: sub.endpoint });
    } catch (e) { /* ok */ }
  };

  /* Al iniciar sesión: si ya había permiso, el dispositivo queda asociado a esta cuenta sin pedir nada. */
  if (typeof _supabase !== 'undefined' && soportado()) {
    _supabase.auth.onAuthStateChange(function (evento, session) {
      if (!session || !session.user) return;
      if (evento !== 'SIGNED_IN' && evento !== 'INITIAL_SESSION') return;
      // fuera del callback para no trabar el cliente de Supabase
      setTimeout(async function () {
        try {
          if (!claveConfigurada() || Notification.permission !== 'granted') return;
          var sub = await suscripcionLocal();
          if (sub && mismaClave(sub)) await guardarEnServidor(sub);
        } catch (e) { /* ok */ }
      }, 0);
    });
  }
})();
