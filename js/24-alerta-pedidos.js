/* NecoVende - Alerta de pedidos nuevos (sonido largo + título parpadeante)
 * - Sonido generado con WebAudio (no necesita archivos): "ding-dong" que se repite hasta que el comercio lo atiende.
 * - Los navegadores bloquean el audio hasta que la persona toca la página una vez: se desbloquea solo
 *   con el primer toque, y si todavía no pasó, se muestra un cartel "Tocá para activar el sonido".
 * - Window.NvAlerta = { sonar(), parar(), chequear(tieneComercio) }
 */
(function () {
  'use strict';
  var ctx = null, timer = null, tope = 0, tituloOrig = document.title, parp = null, aviso = null;
  var TOPE_MS = 3 * 60 * 1000;      // como máximo 3 minutos seguidos

  function crear() {
    if (ctx) return ctx;
    var AC = window.AudioContext || window.webkitAudioContext; if (!AC) return null;
    try { ctx = new AC(); } catch (e) { ctx = null; }
    return ctx;
  }
  function listo() { return !!ctx && ctx.state === 'running'; }
  function desbloquear() {
    var c = crear(); if (!c) return;
    var fin = function () { if (listo()) { quitarAviso(); } };
    if (c.state !== 'running') { try { c.resume().then(fin, function () {}); } catch (e) {} } else fin();
    // un "tic" mudo para que iOS/Safari lo den por activado
    try { var o = c.createOscillator(), g = c.createGain(); g.gain.value = 0.0001; o.connect(g); g.connect(c.destination); o.start(); o.stop(c.currentTime + 0.02); } catch (e) {}
  }
  ['pointerdown', 'touchstart', 'keydown', 'click'].forEach(function (ev) { document.addEventListener(ev, desbloquear, { passive: true }); });

  function tono(f, t0, dur, vol) {
    var o = ctx.createOscillator(), g = ctx.createGain();
    o.type = 'sine'; o.frequency.value = f;
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(vol, t0 + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g); g.connect(ctx.destination); o.start(t0); o.stop(t0 + dur + 0.05);
    // armónico para que se escuche más "campana"
    var o2 = ctx.createOscillator(), g2 = ctx.createGain();
    o2.type = 'triangle'; o2.frequency.value = f * 2;
    g2.gain.setValueAtTime(0.0001, t0); g2.gain.exponentialRampToValueAtTime(vol * 0.35, t0 + 0.02); g2.gain.exponentialRampToValueAtTime(0.0001, t0 + dur * 0.8);
    o2.connect(g2); g2.connect(ctx.destination); o2.start(t0); o2.stop(t0 + dur + 0.05);
  }
  // una vuelta del timbre: ding-dong-ding-dong (~2 segundos)
  function timbre() {
    if (!listo()) return;
    var t = ctx.currentTime + 0.05;
    tono(988, t, 0.5, 0.55); tono(784, t + 0.45, 0.6, 0.55);
    tono(988, t + 1.1, 0.5, 0.55); tono(784, t + 1.55, 0.7, 0.55);
  }

  function parpadeo() {
    if (parp) return;
    var on = false;
    parp = setInterval(function () { on = !on; document.title = on ? '🔴 ¡PEDIDO NUEVO!' : tituloOrig; }, 900);
  }
  function quitarParpadeo() { if (parp) { clearInterval(parp); parp = null; document.title = tituloOrig; } }

  function sonar() {
    parpadeo();
    crear();
    if (!listo()) { mostrarAviso(); return; }       // todavía no tocaron la página: no se puede sonar
    if (timer) return;
    tope = Date.now() + TOPE_MS;
    timbre();
    timer = setInterval(function () {
      if (Date.now() > tope) { parar(); return; }
      timbre();
    }, 2600);
  }
  function parar() {
    if (timer) { clearInterval(timer); timer = null; }
    quitarParpadeo();
  }

  /* ---- cartel para desbloquear el sonido (solo comercios) ---- */
  function mostrarAviso() {
    if (aviso || !document.body) return;
    aviso = document.createElement('button');
    aviso.type = 'button';
    aviso.id = 'nv-aviso-sonido';
    aviso.style.cssText = 'position:fixed;top:10px;left:50%;transform:translateX(-50%);z-index:90;background:#e11d48;color:#fff;border:0;border-radius:999px;padding:10px 18px;font:800 13px/1.2 inherit;box-shadow:0 6px 20px rgba(0,0,0,.3);cursor:pointer;max-width:92vw';
    aviso.textContent = '🔊 Tocá acá para activar el sonido de los pedidos';
    aviso.onclick = function () { desbloquear(); setTimeout(function () { if (listo()) { quitarAviso(); timbre(); } }, 120); };
    document.body.appendChild(aviso);
  }
  function quitarAviso() { if (aviso && aviso.parentNode) aviso.parentNode.removeChild(aviso); aviso = null; }

  // Se llama cuando sabemos si la cuenta tiene comercio: si todavía no se desbloqueó el audio, se pide un toque.
  function chequear(tieneComercio) {
    if (!tieneComercio) { quitarAviso(); return; }
    crear();
    if (!listo()) mostrarAviso(); else quitarAviso();
  }

  document.addEventListener('visibilitychange', function () { if (!document.hidden && ctx && ctx.state === 'suspended') { try { ctx.resume(); } catch (e) {} } });
  window.NvAlerta = { sonar: sonar, parar: parar, chequear: chequear, probar: function () { desbloquear(); setTimeout(timbre, 150); } };
})();
