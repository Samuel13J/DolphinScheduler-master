
(function () {
  'use strict';
  var api = window.uiplus || null;
  var FIELDS = [
    'power.level', 'driving.gear', 'driving.speed', 'display.dayNightMode',
    'energy.batteryPercent', 'energy.fuelPercent', 'energy.electricRange', 'energy.fuelRange', 'energy.chargingState',
    'ac.outdoorTemperature', 'ac.indoorTemperature', 'driving.totalDistance',
    'body.doors.frontLeft.state', 'body.doors.frontRight.state', 'body.doors.rearLeft.state', 'body.doors.rearRight.state',
    'body.hood.state', 'body.tailgate.state', 'body.sunroof.position', 'body.windows.anyOpen',
    'body.windows.frontLeft.position', 'body.windows.frontRight.position', 'body.windows.rearLeft.position', 'body.windows.rearRight.position',
    'light.lowBeam', 'light.highBeam', 'light.turnSignal.left', 'light.turnSignal.right', 'light.hazard', 'light.brake',
    'light.daytimeRunning', 'light.side', 'light.frontFog', 'light.rearFog', 'light.ambient.color', 'light.ambient.brightness',
    'light.ambient.area', 'light.ambient.musicMode', 'light.dynamicColorful',
    'body.sunshade.position', 'energy.connectorState',
    'tyre.frontLeft.pressure', 'tyre.frontRight.pressure', 'tyre.rearLeft.pressure', 'tyre.rearRight.pressure',
    'tyre.frontLeft.state', 'tyre.frontRight.state', 'tyre.rearLeft.state', 'tyre.rearRight.state', 'tyre.displayUnit',
    'energy.charging.remainingTime', 'warning.lowVoltageBatteryFault', 'warning.keyBatteryLow', 
   
    'ac.power', 'ac.compressor', 'ac.driverTemperature', 'ac.fanLevel', 'ac.circulation', 'ac.frontDefrost', 'ac.rearDefrost',
    'seat.driver.heating', 'seat.passenger.heating', 'seat.driver.ventilation', 'seat.passenger.ventilation',
    'seat.driver.beltFastened', // 副驾、后排安全带不订：宿主报的不准（实测扣没扣都是已系），只有主驾有数据
    'energy.operationMode', 'energy.mode', 'energy.regenerationLevel', 'energy.simulator', 'energy.socSave', 'energy.socTarget',
    'energy.wirelessCharging', 'energy.wirelessChargingState', 'environment.pm25.indoor', 'environment.pm25.indoorLevel', 'environment.slope', 'engine.rpm', 'audio.muted',
    'tyre.frontLeft.temperature', 'tyre.frontRight.temperature', 'tyre.rearLeft.temperature', 'tyre.rearRight.temperature' // 胎压标签上的胎温
  ];
  // 顶栏图标要的系统数据
  var SYS = ['network.transport', 'network.validated', 'wifi.enabled', 'wifi.connected', 'wifi.signalLevel', 'bluetooth.enabled', 'bluetooth.connectionState',
    'cellular.displayType', 'cellular.signalLevel', 'cellular.simState', 'cellular.dataState', 'airplane.enabled', 'hotspot.enabled',
    'gps.enabled', 'gps.permissionGranted']; // 只订开关和授权：订位置字段宿主才开始定位
  // 新版宿主的数字编码 → 和旧版一样的值
  var B01 = { 0: false, 1: true }, B12 = { 1: true, 2: false }, OC = { 0: 'closed', 1: 'open' }, SEAT = { 1: 0, 2: 1, 3: 2 }; // 座椅档位 1/2/3 → 关 / 低 / 高 = 0/1/2
  var DEC = {
    'driving.gear': { 0: 'N', 1: 'R', 2: 'D', 3: 'P' },
    'power.level': { 0: 'off', 1: 'acc', 2: 'on', 3: 'ready', 4: 'fakeReady' },
    'energy.chargingState': { 1: 'ready', 2: 'charging', 3: 'finished', 4: 'terminated' },
    'body.doors.frontLeft.state': OC, 'body.doors.frontRight.state': OC, 'body.doors.rearLeft.state': OC, 'body.doors.rearRight.state': OC,
    'body.hood.state': OC, 'body.tailgate.state': OC, 'body.windows.anyOpen': B01,
    'light.lowBeam': B01, 'light.highBeam': B01, 'light.turnSignal.left': B01, 'light.turnSignal.right': B01, 'light.hazard': B12,
    'light.brake': { 1: 'on', 2: 'flash', 3: 'off' }, // 2 是闪烁模式（紧急制动时快闪）
    'light.daytimeRunning': B12, 'light.side': B01, 'light.frontFog': B01, 'light.rearFog': B01,
    'light.ambient.area': { 1: 'front', 2: 'rear', 3: 'all' }, 'light.ambient.musicMode': B12, 'light.dynamicColorful': B12,
    'light.ambient.color': { 1: 'iceBlue', 2: 'coldWhite', 3: 'warmWhite', 4: 'redOrange', 5: 'red', 6: 'redPurple', 7: 'darkBlue' },
    'energy.connectorState': { 1: 'none', 2: 'ac', 3: 'dc', 4: 'acDc', 5: 'vtol' },
    'tyre.displayUnit': { 1: 'bar', 2: 'psi', 3: 'kPa' },
    'display.dayNightMode': { 16: 'day', 32: 'night' },
    'warning.lowVoltageBatteryFault': B01, 'warning.keyBatteryLow': B12, // 钥匙电池：1 低电量、2 正常
    'seat.driver.beltFastened': B01,
    'seat.driver.heating': SEAT, 'seat.passenger.heating': SEAT, 'seat.driver.ventilation': SEAT, 'seat.passenger.ventilation': SEAT,
    'ac.power': B01, 'ac.compressor': B01, 'ac.frontDefrost': B01, 'ac.rearDefrost': B01, 'ac.circulation': { 0: 'outside', 1: 'inside' },
    'energy.operationMode': { 1: 'eco', 2: 'sport', 3: 'comfort' }, 'energy.mode': { 1: 'ev', 3: 'hev' }, 'energy.regenerationLevel': { 1: 'standard', 2: 'high' },
    'energy.simulator': B01, 'energy.socSave': { 1: false, 2: true }, 'energy.wirelessCharging': B12, // 保电：1 智能、2 强制（true）
    'energy.wirelessChargingState': { 0: 'charging', 1: 'full', 2: 'fault', 3: 'standby' }, 'energy.charging.type': { 1: 'default', 2: 'ac', 3: 'vtog', 4: 'gbDc', 5: 'gbNonDc' },
    'body.windows.ventilation': B01, 'body.windows.halfOpen': B01, 'audio.muted': B01
  };
  // 带单位编码的：编码 → 单位名（厂商标签，不换算）
  var UNIT_NAME = {
    'energy.consumption.averageElectric': { 1: 'kW/100km', 2: 'kW/100mi', 3: 'hp/100km', 4: 'hp/100mi' },
    'energy.consumption.instantFuel': { 1: 'L/100km', 2: 'km/L', 3: 'mpg', 4: 'L/h' },
    'driving.journeyDistance': { 1: 'km', 2: 'mi' }
  };
  var TYRE_P = { 'tyre.frontLeft.pressure': 1, 'tyre.frontRight.pressure': 1, 'tyre.rearLeft.pressure': 1, 'tyre.rearRight.pressure': 1 };
  var TYRE_S = { 'tyre.frontLeft.state': 1, 'tyre.frontRight.state': 1, 'tyre.rearLeft.state': 1, 'tyre.rearRight.state': 1 };
  // 续航：宿主没数据时报 2046（插混没油、纯电车的燃油续航都是），当成没有，不然总续航会多出 2000 多公里
  var RANGE = { 'energy.electricRange': 1, 'energy.fuelRange': 1 }, RANGE_BAD = 2046;

  var car = {}, units = {}, tree = {}, sys = {}, stree = {}, media = null, carFns = [], mediaFns = [], sysFns = [], handles = [], gen = 0, caps = null, fields = FIELDS, retryTimer = null, tries = 0;
  var want = { car: false, media: false }, extra = [], carOnly = null;
  function emitCar() { carFns.slice().forEach(function (f) { f(car); }); }
  function emitSys() { sysFns.slice().forEach(function (f) { f(sys); }); }
  function emitMedia() { mediaFns.slice().forEach(function (f) { f(media); }); }
  function listen(list, fn) { list.push(fn); return function () { var i = list.indexOf(fn); if (i >= 0) list.splice(i, 1); }; }

  /** 新版：从合并后的业务树里取一个字段，解码；没有有效数据返回 undefined */
  function fromTree(k) {
    var parts = k.split('.'), node = tree, leaf = parts.pop();
    for (var i = 0; i < parts.length && node; i++) node = node[parts[i]];
    var v = node ? node[leaf] : null;
    if (v === null || v === undefined) return undefined;
    var u = node[leaf + 'Unit'];
    if (DEC[k]) return DEC[k][v];
    if (RANGE[k] && v >= RANGE_BAD) return undefined;
    if (UNIT_NAME[k]) { if (UNIT_NAME[k][u]) units[k] = UNIT_NAME[k][u]; else delete units[k]; }
    if (k === 'ac.outdoorTemperature' || k === 'ac.indoorTemperature' || k === 'ac.driverTemperature') return u === 0 ? (v - 32) * 5 / 9 : v; // 0 = °F
    if (k === 'driving.totalDistance') return u === 'm' ? v / 1000 : u === '0.1km' ? v / 10 : v; // 单位跟着来源：米 / 公里 / 0.1 公里
    if (TYRE_P[k]) { // 厂商整数尺度：1 = 0.1 bar、2 = 0.1 psi、3 = kPa；4092 爆胎、4093 异常 → 统一成 kPa
      if (v === 4092) return 'burst';
      if (v === 4093) return 'fault';
      return u === 1 ? v * 10 : u === 2 ? v * 0.6894757 : v;
    }
    if (TYRE_S[k]) { // tyre 来源 0/1/2 = 正常/偏高/偏低；instrument 来源 1/2/3 = 正常/警告/严重
      var src = node.stateSource;
      if (src === 'instrument') return { 1: 'normal', 2: 'warning', 3: 'critical' }[v];
      if (src === 'tyre') return { 0: 'normal', 1: 'high', 2: 'low' }[v];
      return v === 0 ? 'normal' : undefined;
    }
    return v;
  }
  function merge(t, p) {
    Object.keys(p).forEach(function (k) {
      var v = p[k];
      if (v !== null && typeof v === 'object' && !Array.isArray(v)) { if (!t[k] || typeof t[k] !== 'object') t[k] = {}; merge(t[k], v); }
      else t[k] = v;
    });
  }
  function onVehicle(ev) {
    if (!ev || ev.error || ev.type === 'error') return;
    if (ev.values && ev.type) { // 旧版
      for (var k in ev.values) {
        var f = ev.values[k];
        if (f && f.status === 'ok' && !(RANGE[k] && f.value >= RANGE_BAD)) car[k] = f.value; else delete car[k];
      }
    } else if (ev.data) {        // 新版
      merge(tree, ev.data);
      fields.forEach(function (k) { var v = fromTree(k); if (v === undefined) delete car[k]; else car[k] = v; });
    } else return;
    tries = 0;
    emitCar();
  }
  function onSys(ev) {
    if (!ev || ev.error || !ev.data) return;
    merge(stree, ev.data);
    SYS.forEach(function (k) {
      var p = k.split('.'), n = stree[p[0]], v = n ? n[p[1]] : null;
      if (v === null || v === undefined) delete sys[k]; else sys[k] = v; // null 是未知（权限不足、不支持），不当成关着
    });
    emitSys();
  }
  function onMedia(ev) {
    if (!ev || ev.error || ev.type === 'error') return;
    var m = ev.values && ev.values.media;
    if (!m) return;
    if (media && m.updatedAt > 0 && media.updatedAt > 0 && m.updatedAt < media.updatedAt) return; // 晚到的旧快照
    media = m.status === 'ok' ? m : null;
    emitMedia();
  }

  function stop() {
    gen++;
    clearTimeout(retryTimer);
    handles.forEach(function (h) { try { h.unsubscribe(); } catch (e) {} });
    handles = [];
  }
  function keep(h, g) { if (g !== gen) { try { h.unsubscribe(); } catch (e) {} } else handles.push(h); }
  function fail(g) { // 订阅失败：退避重试，最多 6 次
    if (g !== gen || tries >= 6) return;
    tries++;
    clearTimeout(retryTimer);
    retryTimer = setTimeout(start, 1000 * Math.pow(2, tries));
  }
  function start() {
    stop();
    if (!api || (!want.car && !want.media)) return;
    var g = gen;
    var ready = caps ? Promise.resolve() : api.getCapabilities().then(function (c) {
      caps = {};
      ((c && c.fields) || []).forEach(function (f) { if (f && f.name) caps[f.name] = f.subscriptionMode || 'native'; });
    });
    ready.then(function () {
      if (g !== gen) return;
      var base = carOnly || FIELDS;
      fields = base.concat(extra.filter(function (k) { return base.indexOf(k) < 0; })).filter(function (k) { return caps[k] && caps[k] !== 'none'; }); // 订阅里有一个宿主没有的字段，整个订阅都会失败
      if (want.car && fields.length) api.vehicle.subscribe(fields, function (ev) { if (g === gen) onVehicle(ev); }).then(function (h) { keep(h, g); }, function () { fail(g); });
      if (want.car && !carOnly && api.system && typeof api.system.subscribe === 'function') api.system.subscribe(SYS, function (ev) { if (g === gen) onSys(ev); }).then(function (h) { keep(h, g); }, function () {}); // 系统数据订不上不影响车况。只订昼夜时不订系统字段
      if (want.media) api.media.subscribe(function (ev) { if (g === gen) onMedia(ev); }).then(function (h) { keep(h, g); }, function () { fail(g); });
    }, function () { fail(g); });
  }

  window.D3Data = {
    demo: !!(api && api.__debug), // 调试宿主：车况页标"调试数据"，点了打开调试面板
    car: function () { return car; },
    /** 这个字段同节点单位编码对应的单位名（电耗、油耗、旅程里程）；没有返回 '' */
    unit: function (k) { return units[k] || ''; },
    /** 顶栏图标要的系统数据（宿主报 null 的不在里面） */
    sys: function () { return sys; },
    onSys: function (fn) { return listen(sysFns, fn); },
    /** 底部数据选了的字段：和常驻的一起订（变了才重订） */
    extra: function (keys) {
      keys = (keys || []).filter(function (k, i, a) { return a.indexOf(k) === i; }).sort();
      if (keys.join() === extra.join()) return;
      extra = keys;
      if (want.car) start();
    },
    fields: function () { return fields.slice(); }, // 测试用：现在订着的车况字段
    media: function () { return media; },
    /** 收车况 / 媒体变化，返回取消函数 */
    onCar: function (fn) { return listen(carFns, fn); },
    onMedia: function (fn) { return listen(mediaFns, fn); },
    /** 只订阅这些：['car'] / ['media'] / []。only 给出时车况只订这几个字段，不订整表，也不订系统字段 */
    use: function (list, only) {
      var c = list.indexOf('car') >= 0, m = list.indexOf('media') >= 0;
      var next = only && only.length ? only.slice().sort() : null;
      var same = (next ? next.join() : '') === (carOnly ? carOnly.join() : '');
      if (c === want.car && m === want.media && same) return;
      want.car = c; want.media = m; carOnly = next;
      start();
    },
    /** 宿主有没有这个播放控制方法（2.1.1.12 起有 play / pause / previous / next） */
    can: function (cmd) { return !!api && !!api.media && typeof api.media[cmd] === 'function'; },
    send: function (cmd) {
      var m = api && api.media, p;
      if (!m || typeof m[cmd] !== 'function') return Promise.reject({ code: 'UNSUPPORTED' });
      try { p = m[cmd](); } catch (e) { p = Promise.reject(e); }
      return Promise.resolve(p);
    },
    /** 整首歌词 [{ text, timeMs }]，拿不到返回空数组 */
    lyrics: function () {
      if (!api || !api.media || typeof api.media.getLyrics !== 'function') return Promise.resolve([]);
      return api.media.getLyrics().then(function (r) { return (r && media && r.trackId === media.trackId && r.lines) || []; }, function () { return []; });
    }
  };

  if (api) window.addEventListener('pagehide', stop);
})();
