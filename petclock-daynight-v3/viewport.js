
(function () {
  'use strict';
  var root = document.documentElement, refH = 0, lastW = 0;
  function typing() {
    var a = document.activeElement;
    while (a && a.shadowRoot && a.shadowRoot.activeElement) a = a.shadowRoot.activeElement; 
    return !!a && /^(INPUT|TEXTAREA)$/.test(a.tagName);
  }
  var tries = 0;
  function apply() {
    var w = window.innerWidth, h = window.innerHeight;
    /* 车机 WebView 在 head 里执行时经常还是 0×0，而且撑开后不一定发 resize。尺寸没出来就继续等，否则横竖屏类加不上，表盘会一直 display:none */
    if (!w || !h) {
      if (tries < 40) { tries++; setTimeout(apply, 50); }
      return;
    }
    tries = 0;
    if (!refH || w !== lastW || h > refH || !typing()) refH = h;
    lastW = w;
    root.style.fontSize = (refH / 10.52) + 'px';
    root.style.height = h + 'px';
    if (document.body) document.body.style.height = h + 'px';
    var cls = root.className.replace(/(^|\s)(portrait|landscape)(?=\s|$)/g, '');
    root.className = (cls ? cls + ' ' : '') + (w < refH ? 'portrait' : 'landscape');
  }
  apply();
  window.addEventListener('resize', apply);
  window.addEventListener('orientationchange', apply);
  window.addEventListener('pageshow', apply);
  window.addEventListener('load', apply);
  document.addEventListener('visibilitychange', apply);
  if (window.visualViewport) window.visualViewport.addEventListener('resize', apply);
  window.addEventListener('focusout', function () { setTimeout(apply, 300); }); 
  window.VIEWPORT = { refHeight: function () { return refH; }, typing: typing };
})();
