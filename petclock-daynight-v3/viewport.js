
(function () {
  'use strict';
  var root = document.documentElement, refH = 0, lastW = 0;
  function typing() {
    var a = document.activeElement;
    while (a && a.shadowRoot && a.shadowRoot.activeElement) a = a.shadowRoot.activeElement; 
    return !!a && /^(INPUT|TEXTAREA)$/.test(a.tagName);
  }
  function apply() {
    var w = window.innerWidth, h = window.innerHeight;
    if (!w || !h) return;
    if (!refH || w !== lastW || h > refH || !typing()) refH = h; 
    lastW = w;
    root.style.fontSize = (refH / 10.52) + 'px';
    var cls = root.className.replace(/(^|\s)(portrait|landscape)(?=\s|$)/g, '');
    root.className = (cls ? cls + ' ' : '') + (w < refH ? 'portrait' : 'landscape');
  }
  apply();
  window.addEventListener('resize', apply);
  window.addEventListener('focusout', function () { setTimeout(apply, 300); }); 
  window.VIEWPORT = { refHeight: function () { return refH; }, typing: typing };
})();
