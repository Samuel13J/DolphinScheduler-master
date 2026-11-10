
(function () {
  'use strict';
  var D = window.D3Data, doc = document;
  var $ = function (id) { return document.getElementById(id); };
  var el = $('pgVinyl');

  var toastT = 0;
  window.D3 = {
    toast: function (msg, ms) {
      var e = $('toast');
      clearTimeout(toastT);
      if (!msg) { e.className = 'toast'; return; }
      e.innerHTML = '';
      var p = document.createElement('p');
      p.textContent = msg;
      e.appendChild(p);
      e.className = 'toast on';
      toastT = setTimeout(function () { e.className = 'toast'; }, ms || 3200);
    }
  };

  var WD = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'];
  var els = {
    lh: $('lh'), lm: $('lm'), ldate1: $('ldate1'), ldate2: $('ldate2'), lhour: $('lhour'), lmin: $('lmin'),
    ph: $('ph'), pm: $('pm'), pdate1: $('pdate1'), pdate2: $('pdate2'), phour: $('phour'), pmin: $('pmin')
  };

  var DIAL = {
    l: { px: 911, py: 333, hourLen: 98, hourTail: 22, minLen: 155, minTail: 38 },
    p: { px: 623, py: 550, hourLen: 109, hourTail: 17, minLen: 195, minTail: 51 }
  };
  function setHand(el2, g, len, tail, angDeg) {
    if (!el2) { return; }
    var r = angDeg * Math.PI / 180;
    var dx = Math.sin(r), dy = -Math.cos(r);
    el2.setAttribute('x1', (g.px - dx * tail).toFixed(2));
    el2.setAttribute('y1', (g.py - dy * tail).toFixed(2));
    el2.setAttribute('x2', (g.px + dx * len).toFixed(2));
    el2.setAttribute('y2', (g.py + dy * len).toFixed(2));
  }
  function pad2(n) { return (n < 10 ? '0' : '') + n; }

  var fixed = /^#([01]\d|2[0-3]):([0-5]\d)(h?)$/.exec(location.hash);
  if (fixed && fixed[3]) {
    (function () {
      var ids = ['lhour', 'lmin', 'phour', 'pmin'], i;
      for (i = 0; i < ids.length; i++) { if (els[ids[i]]) els[ids[i]].setAttribute('display', 'none'); }
    })();
  }
  function clockTick() {
    var d = new Date();
    var h = d.getHours(), m = d.getMinutes(), s = d.getSeconds();
    if (fixed) { h = parseInt(fixed[1], 10); m = parseInt(fixed[2], 10); s = 0; }
    var hh = pad2(h), mm = pad2(m);
    if (els.lh) els.lh.textContent = hh;
    if (els.lm) els.lm.textContent = mm;
    if (els.ph) els.ph.textContent = hh;
    if (els.pm) els.pm.textContent = mm;
    var ha = ((h % 12) + m / 60 + s / 3600) * 30;
    var ma = (m + s / 60) * 6;
    setHand(els.lhour, DIAL.l, DIAL.l.hourLen, DIAL.l.hourTail, ha);
    setHand(els.lmin, DIAL.l, DIAL.l.minLen, DIAL.l.minTail, ma);
    setHand(els.phour, DIAL.p, DIAL.p.hourLen, DIAL.p.hourTail, ha);
    setHand(els.pmin, DIAL.p, DIAL.p.minLen, DIAL.p.minTail, ma);
    var ds = fixed ? '3月24日 星期二' : ((d.getMonth() + 1) + '月' + d.getDate() + '日 ' + WD[d.getDay()]);
    var sp = ds.indexOf(' ');
    var d1 = sp > 0 ? ds.substring(0, sp) : ds;
    var d2 = sp > 0 ? ds.substring(sp + 1) : '';
    if (els.ldate1) els.ldate1.textContent = d1;
    if (els.ldate2) els.ldate2.textContent = d2;
    if (els.pdate1) els.pdate1.textContent = d1;
    if (els.pdate2) els.pdate2.textContent = d2;
    var delay = 1000 - (Date.now() % 1000);
    setTimeout(clockTick, delay);
  }


  function fit(wrap, box, rw, rh) {
    var w = wrap.clientWidth, h = wrap.clientHeight;
    if (!w || !h) { return; }
    var s = Math.min(w / rw, h / rh);
    box.style.width = Math.round(rw * s) + 'px';
    box.style.height = Math.round(rh * s) + 'px';
  }
  function fitClock() {
    fit($('clockWrapL'), $('clockBoxL'), 1824, 1312); /* 横屏参考 1824x1312 */
    fit($('clockWrapP'), $('clockBoxP'), 1248, 1792); /* 竖屏参考 1248x1792 */
  }
  function portraitNow() { return (' ' + doc.documentElement.className + ' ').indexOf(' portrait ') >= 0; }


  var media = null, gotAt = 0, playing = false;
  var lines = [], lyrTrack = null, coverKey = '', coverSeq = 0, blobUrl = '', glowSide = 0, tint = null, bgUrl = '', dayA = null, dayB = null;
  var ly = { key: null, rows: [], idx: -1, hist: false, y: null }, lyPrev = '', lyNew = false;
  var BTN = { vPrev: 'previous', vToggle: 'toggle', vNext: 'next' };


  function clean(s) { return s ? String(s).replace(/\s+/g, ' ').trim() : ''; }
  function text(id, s) { var e = $(id); if (e.textContent !== s) e.textContent = s; }
  function tidOf(m) { return m ? m.trackId || m.title : null; }
  function clip(s, n) { s = String(s || ''); return s.length > n ? s.slice(0, n - 1) + '…' : s; }
  function hash(s) { var h = 7; for (var i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0; return Math.abs(h); }
  function hsl(h, s, l) {
    function f(n) { var k = (n + h * 12) % 12, a = s * Math.min(l, 1 - l); return 255 * (l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1))); }
    return [f(0), f(8), f(4)];
  }

  function toggleBtn() {
    $('vToggle').className = 'v-btn big' + (playing ? ' playing' : '');
    $('vToggle').setAttribute('aria-label', playing ? '暂停' : '播放');
  }
  function onMedia(m) {
    media = m; gotAt = Date.now();
    el.classList.toggle('empty', !m);
    playing = !!(m && m.playing);
    el.classList.toggle('is-paused', !playing); 
    text('vTitle', m ? m.title || '未知歌曲' : '');
    text('vArtist', m ? m.artist || '' : '');
    text('vState', playing ? '正在播放' : '已暂停');
    $('vState').className = 'v-state' + (playing ? '' : ' paused');
    var tid = m ? m.trackId || m.title : null;
    if (tid !== lyrTrack) {
      var swapped = lyrTrack != null && tid != null;
      lyrTrack = tid; lines = [];
      if (swapped) fadeSwap();
      if (m) {
       
        lyPrev = (ly.rows.length && ly.rows[ly.idx >= 0 ? ly.idx : ly.rows.length - 1]) || '';
        lyNew = true;
        loadLyrics(tid);
      }
    }
    lyric(m);
    toggleBtn();
    Object.keys(BTN).forEach(function (id) { var c = BTN[id]; $(id).classList.toggle('off', c !== 'toggle' && !D.can(c)); });
    loadCover(m);
  }
  
  var swapT = 0;
  function fadeSwap() {
    el.classList.remove('swap');
    void el.offsetWidth;
    el.classList.add('swap');
    clearTimeout(swapT);
    swapT = setTimeout(function () { el.classList.remove('swap'); }, 800);
  }
  var lyrGen = 0;
  function loadLyrics(tid) {
    var g = ++lyrGen;
    (function tryGet(n) {
      D.lyrics().then(function (l) {
        if (lyrGen !== g || lyrTrack !== tid) return;
        if (l && l.length) { lines = l; lyric(media); }
        else if (n < 12) setTimeout(function () { tryGet(n + 1); }, 350);
      });
    })(0);
  }
  function lyStop() {
    if (lyAnim) { caf(lyAnim); lyAnim = 0; }
    lyShown = null;
  }
  function lyReset() {
    lyStop();
    ly = { key: null, rows: [], idx: -1, hist: false, y: null };
    var b = $('vLy'); b.innerHTML = ''; b.style.transform = '';
  }
  function lyRows(texts) {
    lyStop();
    var box = $('vLy');
    box.innerHTML = '';
    texts.forEach(function (t) { var p = document.createElement('p'); p.textContent = t; box.appendChild(p); });
    ly.rows = texts.slice(); ly.idx = -1; ly.y = null;
  }
  function lyric(m) {
    var now = clean(m && m.lyric), full = lines.map(function (l) { return clean(l && l.text); }).filter(Boolean);
    var key = (lyrTrack || '') + '|' + full.length, i = -1, k;
    if (key !== ly.key) { ly.key = key; ly.hist = !full.length; lyRows(full); }
    if (!now) return;
    if (lyNew) {
      if (now === lyPrev) return;
      lyNew = false;
    }
    if (!ly.hist) {
      for (k = Math.max(0, ly.idx); k < ly.rows.length && i < 0; k++) if (ly.rows[k] === now) i = k;
      for (k = 0; k < ly.rows.length && i < 0; k++) if (ly.rows[k] === now) i = k;
      if (i < 0) return;
    } else {
      if (ly.rows[ly.rows.length - 1] !== now) {
        var box = $('vLy'), p = document.createElement('p');
        p.textContent = now; box.appendChild(p); ly.rows.push(now);
        if (ly.rows.length > 30) { box.removeChild(box.firstChild); ly.rows.shift(); ly.idx--; ly.y = null; }
      }
      i = ly.rows.length - 1;
    }
    lyShow(i, true);
  }
  function lyShow(i, anim) {
    var ps = $('vLy').children;
    if (i === ly.idx && ly.y !== null) return;
    if (ly.idx >= 0 && ps[ly.idx]) ps[ly.idx].className = '';
    ly.idx = i;
    if (ps[i]) ps[i].className = 'on';
    lyPlace(anim);
  }

  var lyAnim = 0, lyShown = null;
  var raf = window.requestAnimationFrame || function (fn) { return setTimeout(fn, 16); };
  var caf = window.cancelAnimationFrame || clearTimeout;
  function lyPlace(anim) {
    var box = $('vLy'), p = box.children[ly.idx];
    if (!p) return;
    var portrait = portraitNow();
    var y = Math.round($('vLyrics').clientHeight * (portrait ? 0.46 : 0.28) - (p.offsetTop + p.offsetHeight / 2));
    var from = lyShown === null ? y : lyShown;
    if (ly.y === y && lyShown === y) return;
    ly.y = y;
    if (lyAnim) { caf(lyAnim); lyAnim = 0; }
    if (!anim || from === y) {
      lyShown = y;
      box.style.transform = 'translate3d(0,' + y + 'px,0)';
      return;
    }
    var t0 = Date.now(), dur = 460;
    function frame() {
      var k = (Date.now() - t0) / dur;
      if (k > 1) k = 1;
      var e = k * k * (3 - 2 * k);
      lyShown = Math.round(from + (y - from) * e);
      box.style.transform = 'translate3d(0,' + lyShown + 'px,0)';
      lyAnim = k < 1 ? raf(frame) : 0;
    }
    frame();
  }
  function press(cmd) {
    if (!media) return;
    if (cmd === 'toggle') cmd = playing ? 'pause' : 'play';
    if (!D.can(cmd)) return;
    if (cmd === 'play' || cmd === 'pause') { playing = cmd === 'play'; el.classList.toggle('is-paused', !playing); toggleBtn(); } 
    D.send(cmd).then(null, function () { onMedia(D.media()); });
  }
  Object.keys(BTN).forEach(function (id) { $(id).addEventListener('click', function () { press(BTN[id]); }); });


  function loadCover(m) {
    var url = m && m.coverUrl, key = url ? url + '#' + (m.trackId || m.title) : 'none#' + (m ? m.title : '');
    if (key === coverKey) return;
    coverKey = key;
    var seq = ++coverSeq;
    function label(img) { glow(null, m, img); }
    if (!url || !window.fetch || !window.URL) { label(null); return; }
    fetch(url, { cache: 'no-store' }).then(function (r) { if (!r.ok) throw new Error(r.status); return r.blob(); }).then(function (b) {
      if (seq !== coverSeq) return;
      var u = URL.createObjectURL(b), img = new Image();
      img.onload = function () {
        if (seq !== coverSeq) { URL.revokeObjectURL(u); return; }
        if (blobUrl) URL.revokeObjectURL(blobUrl);
        blobUrl = u;
        glow(palette(img), m, img);
      };
      img.onerror = function () { URL.revokeObjectURL(u); if (seq === coverSeq) { label(null); } };
      img.src = u;
    }, function () { if (seq === coverSeq) { label(null); } });
  }
  /* 从封面取色：主色（有面积且够鲜）+ 辅色（整图平均），供昼夜两套配色派生 */
  function palette(img) {
    try {
      var n = 24, c = document.createElement('canvas'); c.width = c.height = n;
      var x = c.getContext('2d'); x.drawImage(img, 0, 0, n, n);
      var d = x.getImageData(0, 0, n, n).data, i, R, G, B, cnt = 0, r = 0, g = 0, b = 0, bins = {};
      for (i = 0; i < d.length; i += 4) {
        if (d[i + 3] < 128) { continue; }
        R = d[i]; G = d[i + 1]; B = d[i + 2];
        cnt++; r += R; g += G; b += B;
        var k = ((R >> 5) << 6) | ((G >> 5) << 3) | (B >> 5);   // 8x8x8 分桶
        var o = bins[k] || (bins[k] = { n: 0, r: 0, g: 0, b: 0 });
        o.n++; o.r += R; o.g += G; o.b += B;
      }
      if (!cnt) { return null; }
      var avg = [r / cnt, g / cnt, b / cnt], list = [], key, t, c2, mx, mn, lum, ch;
      for (key in bins) {
        if (!Object.prototype.hasOwnProperty.call(bins, key)) { continue; }
        t = bins[key]; c2 = [t.r / t.n, t.g / t.n, t.b / t.n];
        mx = Math.max(c2[0], c2[1], c2[2]); mn = Math.min(c2[0], c2[1], c2[2]);
        lum = (0.299 * c2[0] + 0.587 * c2[1] + 0.114 * c2[2]) / 255;
        if (lum < 0.07 || lum > 0.95) { continue; }             // 排除纯黑 / 纯白
        ch = mx ? (mx - mn) / mx : 0;
        list.push({ c: c2, score: ch * Math.pow(t.n / cnt, 0.3) });
      }
      list.sort(function (p, q) { return q.score - p.score; });
      var acc = list.length ? list[0].c : avg;
      return { a: acc, b: avg };
    } catch (e) { return null; }
  }
  function toHsl(c) {
    var r = c[0] / 255, g = c[1] / 255, b = c[2] / 255;
    var mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn, h = 0, l = (mx + mn) / 2, s = 0;
    if (d) {
      s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn);
      if (mx === r) { h = ((g - b) / d + (g < b ? 6 : 0)) / 6; }
      else if (mx === g) { h = ((b - r) / d + 2) / 6; }
      else { h = ((r - g) / d + 4) / 6; }
    }
    return [h, s, l];
  }
  /* 保留色相，只调饱和度/明度 —— 白天调浅、夜间调亮 */
  function tune(c, s, l) {
    var o = hsl(toHsl(c)[0], Math.max(0, Math.min(1, s)), Math.max(0, Math.min(1, l)));
    return [Math.round(o[0]), Math.round(o[1]), Math.round(o[2])];
  }
  function rgbStr(c) { return 'rgb(' + c[0] + ',' + c[1] + ',' + c[2] + ')'; }

  var tint = null, tint2 = null, tintD = null, tintD2 = null, deepN = null;
  var dayA = null, dayB = null, dayInk = null;
  function glow(rgb, m, img) {
    if (!rgb) {
      var hue = hash((m && m.title) || '') % 360;
      rgb = m ? { a: hsl(hue / 360, 0.55, 0.5), b: hsl(((hue + 38) % 360) / 360, 0.42, 0.46) } : { a: [150, 118, 84], b: [104, 92, 78] };
    } else if (rgb.length === 3) {
      rgb = { a: rgb, b: rgb };
    }
    var A = toHsl(rgb.a), B = toHsl(rgb.b);
    var sA = Math.max(0.24, Math.min(0.95, A[1] * 1.25));
    var sB = Math.max(0.2, Math.min(0.85, B[1] * 1.12));
    var hA = A[0], hB = B[0];
    if (Math.abs(hB - hA) < 0.05) { hB = (hA + 0.06) % 1; }        // 辅色与主色太近时错开，形成同色系层次
    var sec = hsl(hB, 0.62, 0.5);
    tint = tune(rgb.a, sA, 0.63);                                  // 夜间主光：亮而浓
    tint2 = tune(sec, sB, 0.52);                                   // 夜间辅光
    tintD = tune(rgb.a, Math.min(0.46, Math.max(0.24, sA * 0.52)), 0.885);   // 白天主晕染：浅，不压暗
    tintD2 = tune(sec, Math.min(0.42, Math.max(0.2, sB * 0.55)), 0.905);      // 白天辅晕染
    deepN = tune(rgb.a, Math.min(0.9, sA * 0.9), 0.27);            // 夜间底色 / 封面统一色调
    var inkD = tune(rgb.a, Math.min(0.34, Math.max(0.18, sA * 0.45)), 0.16);  // 白天墨色：带封面色相的深色
    var inkD2 = tune(rgb.a, Math.min(0.3, Math.max(0.16, sA * 0.4)), 0.3);
    var de = doc.documentElement.style;
    de.setProperty('--hit-day', rgbStr(tune(rgb.a, Math.min(0.92, Math.max(0.52, sA)), 0.4)));
    de.setProperty('--hit-day-2', rgbStr(tune(sec, Math.min(0.9, Math.max(0.45, sB)), 0.55)));
    de.setProperty('--ink-day', rgbStr(inkD));
    de.setProperty('--ink-day-2', rgbStr(inkD2));
    de.setProperty('--hand-day', rgbStr(tune(rgb.a, Math.min(0.46, Math.max(0.22, sA * 0.55)), 0.10)));
    de.setProperty('--hand-night', rgbStr(tune(rgb.a, Math.min(0.36, Math.max(0.16, sA * 0.4)), 0.4)));
    de.setProperty('--mute-day', 'rgba(' + inkD.join(',') + ',.58)');
    de.setProperty('--hit-night', rgbStr(tune(rgb.a, Math.min(0.96, Math.max(0.58, sA)), 0.78)));
    de.setProperty('--hit-night-2', rgbStr(tune(sec, Math.min(0.92, Math.max(0.52, sB)), 0.86)));
    var paper1 = tune(rgb.a, Math.min(0.34, Math.max(0.2, sA * 0.38)), 0.966);    // 白天纸张：带封面色相的近白
    var paper2 = tune(hsl(hB, 0.5, 0.5), Math.min(0.36, Math.max(0.22, sB * 0.4)), 0.932);
    var veilD = tune(rgb.a, Math.min(0.26, Math.max(0.12, sA * 0.3)), 0.975);
    de.setProperty('--paper-1', rgbStr(paper1));
    de.setProperty('--paper-2', rgbStr(paper2));
    dayA = tune(rgb.a, Math.min(0.72, Math.max(0.5, sA * 0.88)), 0.795);
    dayB = tune(hsl(hB, 0.5, 0.5), Math.min(0.66, Math.max(0.44, sB * 0.86)), 0.825);
    dayInk = tune(rgb.a, Math.min(0.32, Math.max(0.18, sA * 0.42)), 0.22);
    de.setProperty('--day-a', rgbStr(dayA));
    de.setProperty('--day-b', rgbStr(dayB));
    de.setProperty('--day-ink', rgbStr(dayInk));
    de.setProperty('--veil-day', 'rgba(' + veilD.join(',') + ',.38)');
    de.setProperty('--veil-day-2', 'rgba(' + veilD.join(',') + ',.58)');
    de.setProperty('--veil-day-0', 'rgba(' + veilD.join(',') + ',0)');
    bgUrl = img ? blurred(img) : '';
    glowSide = 1 - glowSide;
    var on = $(glowSide ? 'vGlowB' : 'vGlowA'), off = $(glowSide ? 'vGlowA' : 'vGlowB');
    if (on.__clr) { clearTimeout(on.__clr); on.__clr = null; }
    paintGlow(on);
    on.className = 'glow on'; off.className = 'glow';
    /* 淡出完成后清掉旧图层的背景，避免上一首歌取色残留混色 */
    if (off.__clr) { clearTimeout(off.__clr); }
    off.__clr = setTimeout(function () { off.style.background = ''; off.__clr = null; }, 1500);
  }

  /* ===== 昼夜模式：宿主字段 display.dayNightMode（16→day / 32→night），取不到时按本地时间兜底 ===== */
  var mode = null;
  var forceMode = (/[?&#]mode=(day|night)/.exec(location.search + location.hash) || [])[1] || null; // 调试用：index.html?mode=day|night 或 #mode=day
  function isDay() {
    if (mode) { return mode === 'day'; }
    var h = new Date().getHours();
    return h >= 7 && h < 18;
  }
  function applyMode(v) {
    if (forceMode) { v = forceMode; }
    if (v !== 'day' && v !== 'night') { return; }
    if (v === mode) { return; }
    mode = v;
    var de = doc.documentElement;
    de.classList.add(v);
    de.classList.remove(v === 'day' ? 'night' : 'day');
    paintGlow($(glowSide ? 'vGlowB' : 'vGlowA'));
  }

  function paintGlow(e) {
    if (!tint) { return; }
    var portrait = portraitNow(), day = isDay();
    var A = tint, B = tint2 || tint, C = tintD || tint, E = tintD2 || C, Dp = deepN || tint;
    var DA = dayA || C, DB = dayB || E;
    var p1 = portrait ? '50% 24%' : '20% 26%', p2 = portrait ? '70% 86%' : '86% 78%';
    function rg(c, size, pos, a0, a1) {
      return 'radial-gradient(ellipse ' + size + ' at ' + pos + ', rgba(' + c.join(',') + ',' + a0 + ') 0%, rgba(' + c.join(',') + ',' + a1 + ') 48%, rgba(' + c.join(',') + ',0) 100%)';
    }
    if (day) {
      /* 白天：暖纸底 + 封面色相的双角柔晕 + 中央留白保护 + 时钟区聚光 + 极轻墨角，整体明亮不发灰 */
      var d1 = portrait ? '132% 56%' : '78% 108%', d2 = portrait ? '108% 50%' : '62% 86%';
      var spot = portrait ? 'ellipse 68% 32% at 50% 16%' : 'ellipse 40% 58% at 28% 40%';
      var iK = (dayInk || C).join(',');
      var layers = [
        /* 竖屏：右上、左下两团淡色光斑，给纸底一点层次 */
        portrait ? 'radial-gradient(circle at 88% 8%, rgba(255,255,255,.7) 0%, rgba(255,255,255,0) 16%)' : '',
        portrait ? 'radial-gradient(circle at 6% 76%, rgba(' + DA.join(',') + ',.34) 0%, rgba(' + DA.join(',') + ',0) 24%)' : '',
        portrait ? 'radial-gradient(circle at 94% 68%, rgba(' + DB.join(',') + ',.26) 0%, rgba(' + DB.join(',') + ',0) 20%)' : '',
        /* ① 顶部暖光聚光，托住表盘 */
        'radial-gradient(' + spot + ', rgba(255,255,255,.46) 0%, rgba(255,255,255,.12) 56%, rgba(255,255,255,0) 100%)',
        /* ② 中央通透保护层：让文字区回到纸感，避免被色雾糊住 */
        'radial-gradient(ellipse ' + (portrait ? '92% 46%' : '56% 74%') + ' at ' + (portrait ? '50% 52%' : '52% 52%')
          + ', rgba(255,253,248,.62) 0%, rgba(255,252,245,.30) 46%, rgba(255,250,242,0) 78%)',
        /* ③ 主色柔晕（左上） */
        rg(DA, d1, p1, '.92', '.42'),
        /* ④ 辅色柔晕（右下） */
        rg(DB, d2, p2, '.86', '.36'),
        /* ⑤ 暖调对角过渡 */
        (portrait
            ? 'linear-gradient(196deg, rgba(255,250,242,.34) 0%, rgba(255,249,238,.10) 52%, rgba(255,247,235,.44) 100%)'
            : 'linear-gradient(104deg, rgba(255,250,242,.30) 0%, rgba(255,249,238,.08) 54%, rgba(255,247,235,.42) 100%)'),
        /* ⑥ 取色墨角：四边轻微收暗，增加立体感 */
        'radial-gradient(ellipse 122% 104% at 50% 44%, rgba(' + iK + ',0) 52%, rgba(' + iK + ',.085) 100%)',
        /* ⑦ 纸底 */
        'linear-gradient(' + (portrait ? '178deg' : '116deg') + ', #fffdfa 0%, var(--paper-1, #fbf8f1) 46%, var(--paper-2, #f2ece1) 100%)'
      ];
      e.style.background = layers.filter(Boolean).join(',');
      return;
    }
    /* 夜间：封面模糊铺底 + 取色统一色调 + 深色压暗 + 取色氛围光 */
    var n1 = portrait ? '140% 72%' : '88% 118%', n2 = portrait ? '120% 68%' : '72% 96%';
    var g1 = rg(A, n1, p1, '.26', '.11'), g2 = rg(B, n2, p2, '.22', '.09');
    var orbs = portrait
      ? ('radial-gradient(circle at 86% 9%, rgba(' + A.join(',') + ',.22) 0%, rgba(' + A.join(',') + ',0) 16%),'
        + 'radial-gradient(circle at 8% 80%, rgba(' + B.join(',') + ',.16) 0%, rgba(' + B.join(',') + ',0) 22%),')
      : '';
    var dp = Dp.join(',');
    var veil = 'linear-gradient(' + (portrait ? '178deg' : '116deg') + ', rgba(' + dp + ',.66) 0%, rgba(' + dp + ',.36) 50%, rgba(' + dp + ',.68) 100%)';
    var dial = portrait ? 'ellipse 74% 30% at 50% 22%' : 'ellipse 44% 58% at 30% 40%';
    var rim = 'radial-gradient(' + dial + ', rgba(' + A.join(',') + ',.14) 0%, rgba(' + A.join(',') + ',.04) 62%, rgba(' + A.join(',') + ',0) 100%)';
    var shade = portrait
      ? 'linear-gradient(180deg, rgba(9,8,7,.32) 0%, rgba(9,8,7,.5) 42%, rgba(8,7,6,.86) 74%, rgba(6,5,4,.94) 100%)'
      : 'linear-gradient(90deg, rgba(9,8,7,.32) 0%, rgba(9,8,7,.5) 44%, rgba(8,7,6,.84) 70%, rgba(6,5,4,.93) 100%)';
    e.style.background = bgUrl
      ? (orbs + g1 + ',' + g2 + ',' + rim + ',' + veil + ',' + shade + ', url(' + bgUrl + ') center / cover no-repeat')
      : (orbs + g1 + ',' + g2 + ',' + rim + ', linear-gradient(' + (portrait ? '170deg' : '110deg') + ', rgb(' + dp + ') 0%, #0a0908 70%, #070606 100%)');
  }
  function blurred(img) {
    try {
      var n = 256, c = document.createElement('canvas');
      c.width = c.height = n;
      var x = c.getContext('2d'), s = Math.max(n / img.width, n / img.height) * 1.12;
      x.filter = 'blur(8px)';
      x.drawImage(img, n / 2 - img.width * s / 2, n / 2 - img.height * s / 2, img.width * s, img.height * s);
      return c.toDataURL('image/jpeg', 0.85);
    } catch (e) { return ''; }
  }


  function resize() {
    fitClock();
    ly.y = null; lyPlace(false); 
    paintGlow($(glowSide ? 'vGlowB' : 'vGlowA'));
  }
  window.addEventListener('resize', resize);


  lyReset();
  fitClock();
  clockTick();
  applyMode(isDay() ? 'day' : 'night');   // 先用本地时间兜底，等车机字段到达再以车机为准
  D.use(['car', 'media'], ['display.dayNightMode']); // 只订昼夜这一个车况字段，不订整表
  D.onCar(function (c) { if (c) { applyMode(c['display.dayNightMode']); } });
  D.onMedia(onMedia);
  onMedia(D.media());
})();
