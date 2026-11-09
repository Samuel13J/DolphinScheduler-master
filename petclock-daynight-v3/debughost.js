
(function () {
  'use strict';
  if (window.uiplus) return;

  function own(o, k) { return Object.prototype.hasOwnProperty.call(o, k); }

  // ================= 调试歌：完整一首、带重复的副歌（看滚动歌词），一句 3.5 秒 =================
  var TRACKS = [
    { title: '夜航星', artist: '3xCard 调试', colors: ['#2a3f7a', '#0c1230', '#f6e9bd'],
      lines: ['把星星装进后备箱', '沿着环路慢慢开', '车灯照亮一小段路', '剩下的交给月亮', '收音机里有人在唱', '唱一首没有名字的歌', '红绿灯一盏一盏亮', '像在给我数着心跳', '夜航星 夜航星', '你在高处陪我走', '不管开出多远', '抬头就能看见你', '隧道把城市藏起来',
        '出口又把灯火还给我', '夜航星 夜航星', '你在高处陪我走', '不管开出多远', '抬头就能看见你', '熄火之前再看一眼', '今晚的天很亮'] },
    { title: '早高峰', artist: '3xCard 调试', colors: ['#ff9a52', '#c8325a', '#ffe48f'],
      lines: ['红灯还有三十秒', '收音机在放老歌', '前车的尾灯一闪一闪', '像在打着拍子', '咖啡还有一点烫', '导航说前面在修路', '那就换一条小路', '路边的早餐摊冒着热气', '慢一点也没关系', '今天的风刚刚好', '车窗开一条缝', '让早晨进来', '慢一点也没关系',
        '今天的风刚刚好', '绿灯亮了', '我们出发'] },
    { title: '回家', artist: '3xCard 调试', colors: ['#3a9b8c', '#123446', '#ffd27a'],
      lines: ['熄火之前', '再听完这一首', '车库的灯亮了', '今天也辛苦了', '后视镜里的自己', '有一点累 也有一点笑', '手机里有条消息', '说饭已经做好', '回家 回家', '路再远也有尽头', '回家 回家', '有人在等我', '把座椅调回原位', '把音乐调小一点',
        '回家 回家', '有人在等我'] }
  ];
  var LINE = 3500, covers = {};
  /** 调试歌的封面：渐变天空 + 一轮太阳 / 月亮 + 两层山 + 歌名（画一次留着，data: 地址） */
  function cover(i) {
    if (own(covers, i)) return covers[i];
    var t = TRACKS[i], n = 256, c = document.createElement('canvas');
    c.width = c.height = n;
    var x = c.getContext('2d'), g = x.createLinearGradient(0, 0, 0, n);
    g.addColorStop(0, t.colors[0]); g.addColorStop(1, t.colors[1]);
    x.fillStyle = g; x.fillRect(0, 0, n, n);
    x.fillStyle = t.colors[2]; x.beginPath(); x.arc(n * 0.66, n * 0.38, n * 0.15, 0, Math.PI * 2); x.fill();
    [[0.62, 'rgba(0,0,0,.22)', 0.9], [0.74, 'rgba(0,0,0,.38)', 1.6]].forEach(function (hh) {
      x.fillStyle = hh[1]; x.beginPath(); x.moveTo(0, n);
      for (var k = 0; k <= 16; k++) x.lineTo(k / 16 * n, n * hh[0] + Math.sin(k * hh[2] + i) * n * 0.05);
      x.lineTo(n, n); x.closePath(); x.fill();
    });
    x.fillStyle = '#fff'; x.font = '600 28px "MiSans","PingFang SC","Noto Sans CJK SC","Microsoft YaHei",sans-serif';
    x.fillText(t.title, 20, n - 24);
    try { covers[i] = c.toDataURL('image/png'); } catch (e) { covers[i] = ''; }
    return covers[i];
  }
  function lyricLines(i) { return TRACKS[i].lines.map(function (s, k) { return { text: s, timeMs: k * LINE }; }); }
  function duration(i) { return TRACKS[i].lines.length * LINE + LINE; }


  var q = location.search || '';
  function qflag(name) { return new RegExp('[?&]' + name + '=1(?:&|$)').test(q); }
  function qnum(name) { var m = new RegExp('[?&]' + name + '=(\\d+)').exec(q); return m ? parseInt(m[1], 10) : 0; }
  var MP = { playing: qflag('play'), pos: qnum('at'), at: Date.now(), timer: 0 };
  var track = 0, seq = 0;
  var subs = [], frame = 0;
  function pos() { return MP.playing ? Math.min(duration(track), MP.pos + Date.now() - MP.at) : MP.pos; }
  function snap() {
    var t = TRACKS[track], p = pos(), n = Math.min(t.lines.length - 1, Math.floor(p / LINE));
    return { status: 'ok', trackId: 'debug-' + track, title: t.title, artist: t.artist, packageName: 'com.byd.mediacenter', playing: MP.playing,
      positionMs: Math.round(p), durationMs: duration(track), lyric: t.lines[n], coverUrl: cover(track), updatedAt: Date.now() };
  }
  function changed() {
    frame = 0;
    subs.forEach(function (s) {
      if (s.live && s.pend) {
        s.pend = null;
        s.cb({ type: 'change', sequence: ++seq, values: { media: snap() } });
      }
    });
  }
  function later() {
    if (frame) return;
    frame = 1;
    setTimeout(changed, 0);
  }
  function mark() { subs.forEach(function (s) { if (s.live) s.pend = 1; }); later(); }
  function tick() {
    clearTimeout(MP.timer);
    if (!MP.playing) return;
    var p = pos(), end = duration(track);
    if (p >= end) { setTrack(track + 1, true); return; } // 放完接下一首
    var next = Math.min(end, (Math.floor(p / LINE) + 1) * LINE);
    MP.timer = setTimeout(function () { mark(); tick(); }, Math.max(30, next - p + 5));
  }
  function setPlaying(on) {
    if (MP.playing === on) return;
    MP.pos = pos(); MP.at = Date.now(); MP.playing = on;
    tick(); mark();
  }
  function setTrack(i, keep) {
    track = (i + TRACKS.length) % TRACKS.length;
    MP.pos = 0; MP.at = Date.now();
    if (!keep) MP.playing = false;
    tick(); mark();
  }

  
  if (MP.playing) tick();
  if (qflag('next')) setTimeout(function () { setTrack(track + 1, true); }, 2500);
  if (qnum('pausein')) setTimeout(function () { setPlaying(false); }, qnum('pausein'));

  window.uiplus = {
    version: '1.0',
    __debug: true,
    ready: function () { return Promise.resolve(); },
    getCapabilities: function () { return Promise.resolve({ apiVersion: '1.0', fields: [], controls: [], actions: [], systemFields: [] }); },
    media: {
      get: function () { return Promise.resolve(snap()); },
      subscribe: function (cb) {
        var s = { live: true, pend: null, cb: cb };
        subs.push(s);
        setTimeout(function () { if (s.live) cb({ type: 'snapshot', sequence: ++seq, values: { media: snap() } }); }, 15); 
        return Promise.resolve({ unsubscribe: function () { s.live = false; } });
      },
      getLyrics: function () { return Promise.resolve({ trackId: 'debug-' + track, lines: lyricLines(track) }); },
      play: function () { setPlaying(true); return Promise.resolve(); },
      pause: function () { setPlaying(false); return Promise.resolve(); },
      previous: function () { setTrack(track - 1, true); return Promise.resolve(); },
      next: function () { setTrack(track + 1, true); return Promise.resolve(); }
    }
  };
})();
