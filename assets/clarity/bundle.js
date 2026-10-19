/* 파생 사본: 상상플렉스 Clarity(Kit 06) components/bundle.js — 정본 claude.ai Design System 아티팩트 VbTmbFkD97TkimpcPQJfRy 버전 1791803216-ff86 (sha256 45cbc8262b47324119cc821de68c71ef52df4c28019b65d416820e4acbbc8df0). 여기서 고치지 말고 정본 갱신 후 다시 옮깁니다. */
/* 상상플렉스 Clarity (Kit 06) — behaviors v5.0
   bundle.css의 컴포넌트에 동작과 키보드 접근성을 붙입니다. 의존성 없음.
   불러오면 문서가 준비되는 대로 자동으로 연결되고, 새로 그린 영역은 SangsangClarity.init(요소)로 다시 연결합니다.
   공개 API: SangsangClarity.init(root), .toast(message, options), .chart(element, config), .setTheme(light|dark|light-hc|dark-hc|auto), .setAccent(eduplex|green|ink), .motion(spring·animate·enter·exit·stagger·flip·tracker·project), .audit(root), .version */
(function () {
  'use strict';
  var NS = { version: '5.0' };
  var doc = document;
  function all(root, sel) { return Array.prototype.slice.call((root || doc).querySelectorAll(sel)); }
  function once(el, key) { var k = 'clBound' + key; if (el.dataset[k]) return false; el.dataset[k] = '1'; return true; }
  function emit(el, name, detail) { el.dispatchEvent(new CustomEvent(name, { bubbles: true, detail: detail })); }
  function reduced() { return window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches; }
  function scrollParent(el) {
    var p = el.parentElement;
    while (p && p !== doc.body) {
      var o = getComputedStyle(p).overflowY;
      if ((o === 'auto' || o === 'scroll') && p.scrollHeight > p.clientHeight) return p;
      p = p.parentElement;
    }
    return window;
  }
  function scrollTop(sp) { return sp === window ? window.scrollY : sp.scrollTop; }
  var SVGNS = 'http://www.w3.org/2000/svg';
  function svg(tag, attrs) { var e = doc.createElementNS(SVGNS, tag); for (var k in attrs) e.setAttribute(k, attrs[k]); return e; }
  var ICON = {
    check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
    alert: '<circle cx="12" cy="12" r="8"/><path d="M12 8v5M12 16v.5"/>',
    back: '<path d="M15 5l-7 7 7 7"/>', chev: '<path d="M9 5l7 7-7 7"/>'
  };
  function icon(name) { return '<svg class="cl-icon" viewBox="0 0 24 24" aria-hidden="true">' + (ICON[name] || '') + '</svg>'; }

  /* ============ 움직임 엔진: 속도를 이어받는 스프링 ============
     CSS transition은 위치만 이어받고 속도는 버립니다. 제스처를 놓는 순간, 움직이는 중에 다시 누르는 순간처럼
     속도가 중요한 곳은 아래 스프링을 씁니다. 매개변수는 애플과 같은 duration·bounce이고 tokens의 --spring-* 값을 읽습니다.
     질량 1, 강성 k = (2π/duration)², 감쇠 c = 4π(1 − bounce)/duration. */
  var SPRING_FALLBACK = { press: [0.25, 0], snappy: [0.4, 0.15], smooth: [0.5, 0], bouncy: [0.5, 0.3], fade: [0.2, 0] };
  function cssVar(name) { try { return getComputedStyle(doc.documentElement).getPropertyValue(name).trim(); } catch (e) { return ''; } }
  function cssNum(name, fb) { var v = parseFloat(cssVar(name)); return isNaN(v) ? fb : v; }
  function springParams(sp) {
    var p;
    if (sp && typeof sp === 'object') p = [sp.duration, sp.bounce];
    else { var raw = cssVar('--spring-' + (sp || 'smooth')); p = raw ? raw.split(/\s+/).map(parseFloat) : (SPRING_FALLBACK[sp] || SPRING_FALLBACK.smooth); }
    var d = p[0] > 0 ? p[0] : 0.5, b = Math.max(0, Math.min(0.4, p[1] || 0));
    return { duration: d, bounce: b };
  }
  function spring(o) {
    var sp = springParams(o.spring), w = 2 * Math.PI / sp.duration, k = w * w, c = 2 * (1 - sp.bounce) * w;
    var x = o.from, v = o.velocity || 0, to = o.to, raf = 0, last = 0, done = false;
    var eps = o.precision || Math.max(Math.abs(to - x) * 0.001, 0.001);
    var resolveFin, h = {};
    h.finished = new Promise(function (r) { resolveFin = r; });
    function finish(interrupted) { done = true; cancelAnimationFrame(raf); if (o.onComplete) o.onComplete(!!interrupted); resolveFin(!interrupted); }
    function frame(now) {
      if (done) return;
      var dt = Math.min((now - last) / 1000, 0.064); last = now;
      var n = Math.max(1, Math.ceil(dt / 0.002)), st = dt / n;
      for (var i = 0; i < n; i++) { v += (-k * (x - to) - c * v) * st; x += v * st; }
      var settled = Math.abs(x - to) < eps && Math.abs(v) < eps * 20;
      if (settled) { x = to; v = 0; }
      if (o.onUpdate) o.onUpdate(x, v);
      if (settled) finish(false); else raf = requestAnimationFrame(frame);
    }
    h.stop = function () { if (!done) finish(true); };
    h.value = function () { return x; };
    h.velocity = function () { return v; };
    h.retarget = function (nt) { to = nt; eps = o.precision || Math.max(Math.abs(to - x) * 0.001, 0.001); if (done) { done = false; last = performance.now(); raf = requestAnimationFrame(frame); } };
    if (reduced() && !o.ignoreReduced) { x = to; v = 0; if (o.onUpdate) o.onUpdate(x, 0); finish(false); return h; }
    last = performance.now(); raf = requestAnimationFrame(frame);
    return h;
  }

  /* 요소 단위: x, y(px), scale, opacity를 각각 스프링으로. 진행 중에 다시 부르면 지금 속도에서 이어집니다. */
  var MSTATE = typeof WeakMap === 'function' ? new WeakMap() : null;
  function mstate(el) {
    var s = MSTATE && MSTATE.get(el);
    if (!s) { s = { v: { x: 0, y: 0, scale: 1, opacity: 1 }, sp: {} }; if (MSTATE) MSTATE.set(el, s); }
    return s;
  }
  function paint(el, s) {
    var v = s.v, t = '';
    if (Math.abs(v.x) > 0.01 || Math.abs(v.y) > 0.01) t += 'translate(' + v.x.toFixed(2) + 'px, ' + v.y.toFixed(2) + 'px) ';
    if (Math.abs(v.scale - 1) > 0.0005) t += 'scale(' + v.scale.toFixed(4) + ')';
    el.style.transform = t;
    el.style.opacity = v.opacity >= 0.999 ? '' : String(Math.max(0, Math.min(1, v.opacity)).toFixed(3));
  }
  function animate(el, target, opts) {
    opts = opts || {};
    var s = mstate(el), keys = Object.keys(target).filter(function (k) { return k in s.v; });
    if (opts.from) { Object.keys(opts.from).forEach(function (k) { if (k in s.v) { if (s.sp[k]) s.sp[k].stop(); s.v[k] = opts.from[k]; } }); paint(el, s); }
    return new Promise(function (resolve) {
      var left = keys.length;
      if (!left) return resolve();
      el.setAttribute('data-cl-animating', '');
      function fin() { if (--left === 0) { if (!Object.keys(s.sp).length) el.removeAttribute('data-cl-animating'); resolve(); } }
      keys.forEach(function (k) {
        var old = s.sp[k], vel = old ? old.velocity() : 0;
        if (old) old.stop();
        if (opts.velocity && opts.velocity[k] != null) vel = opts.velocity[k];
        if (reduced() && k !== 'opacity') { s.v[k] = target[k]; paint(el, s); fin(); return; }
        var me = spring({
          from: s.v[k], to: target[k], velocity: vel, ignoreReduced: true,
          spring: reduced() ? 'fade' : (opts.spring || 'smooth'),
          onUpdate: function (x) { s.v[k] = x; paint(el, s); },
          onComplete: function () { if (s.sp[k] === me) delete s.sp[k]; fin(); }
        });
        s.sp[k] = me;
      });
    });
  }

  /* 등장·퇴장 프리셋. 들어올 때는 smooth/snappy, 나갈 때는 더 짧은 press. 거리는 tokens의 motion-* 값. */
  function preset(name, el) {
    var d = cssNum('--motion-enter-distance', 12), ms = cssNum('--motion-menu-scale', 0.18), ps = cssNum('--motion-pop-scale', 0.92);
    var h = el ? el.offsetHeight + 24 : 400;
    var P = {
      rise: { from: { y: d, opacity: 0 }, to: { y: 0, opacity: 1 }, spring: 'smooth', out: { y: d * 0.6, opacity: 0 } },
      pop: { from: { scale: ps, opacity: 0 }, to: { scale: 1, opacity: 1 }, spring: 'snappy', out: { scale: 0.96, opacity: 0 } },
      menu: { from: { scale: ms, opacity: 0 }, to: { scale: 1, opacity: 1 }, spring: 'smooth', out: { scale: 0.92, opacity: 0 } },
      sheet: { from: { y: h, opacity: 1 }, to: { y: 0, opacity: 1 }, spring: 'smooth', out: { y: h }, outSpring: 'smooth' },
      toast: { from: { y: -d, scale: 0.96, opacity: 0 }, to: { y: 0, scale: 1, opacity: 1 }, spring: 'snappy', out: { y: -d, opacity: 0 } }
    };
    return P[name] || P.rise;
  }
  function enter(el, name, opts) {
    var p = preset(name, el); opts = opts || {};
    return animate(el, p.to, { from: p.from, spring: opts.spring || p.spring });
  }
  function exit(el, name, opts) {
    var p = preset(name, el); opts = opts || {};
    el.style.pointerEvents = 'none';
    return animate(el, p.out, { spring: opts.spring || p.outSpring || 'press' }).then(function () { el.style.pointerEvents = ''; });
  }
  function stagger(list, name, opts) {
    opts = opts || {};
    var els = Array.prototype.slice.call(list), step = cssNum('--motion-stagger', 30), max = cssNum('--motion-stagger-max', 6);
    els.forEach(function (el) { var s = mstate(el), p = preset(name, el); Object.keys(p.from).forEach(function (k) { s.v[k] = p.from[k]; }); paint(el, s); });
    return Promise.all(els.map(function (el, i) {
      return new Promise(function (r) { setTimeout(function () { enter(el, name, opts).then(r); }, reduced() ? 0 : Math.min(i, max - 1) * step); });
    }));
  }
  /* 배치가 바뀌는 변화(정렬, 추가, 삭제, 펼침): 처음 위치 → 바꾸기 → 새 위치에서 거꾸로 되돌려 스프링으로 안착. */
  function flip(list, mutate, opts) {
    opts = opts || {};
    var els = Array.prototype.slice.call(list), first = els.map(function (el) { return el.getBoundingClientRect(); });
    mutate();
    return Promise.all(els.map(function (el, i) {
      if (!el.isConnected) return Promise.resolve();
      var s = mstate(el), keep = el.style.transform; el.style.transform = '';
      var last = el.getBoundingClientRect(); el.style.transform = keep;
      var cur = first[i], dx = cur.left - last.left, dy = cur.top - last.top;
      if (Math.abs(dx) < 0.5 && Math.abs(dy) < 0.5 && !Object.keys(s.sp).length) return Promise.resolve();
      s.v.x = dx; s.v.y = dy; paint(el, s);
      return animate(el, { x: 0, y: 0 }, { spring: opts.spring || 'smooth' });
    }));
  }
  /* 제스처 속도 측정(최근 100ms)과 놓은 뒤 미끄러질 거리 예측(애플 project, 감속률 0.998). */
  function tracker() {
    var pts = [];
    return {
      add: function (x, y) { var t = performance.now(); pts.push([t, x, y || 0]); while (pts.length > 2 && t - pts[0][0] > 100) pts.shift(); },
      velocity: function () { if (pts.length < 2) return { x: 0, y: 0 }; var a = pts[0], b = pts[pts.length - 1], dt = (b[0] - a[0]) / 1000; if (dt <= 0) return { x: 0, y: 0 }; return { x: (b[1] - a[1]) / dt, y: (b[2] - a[2]) / dt }; },
      reset: function () { pts = []; }
    };
  }
  function project(velocity, rate) { rate = rate || cssNum('--motion-deceleration', 0.998); return (velocity / 1000) * rate / (1 - rate); }

  NS.motion = { spring: spring, animate: animate, enter: enter, exit: exit, stagger: stagger, flip: flip, tracker: tracker, project: project, params: springParams, reduced: reduced };

  /* ---------- 유리: 손끝 빛 + 반사광 방향 + 젤처럼 따라오기 ----------
     1) 누르는 위치(--px, --py)에서 안쪽 빛이 퍼집니다(::after).
     2) 반사광 링(::before)의 밝은 쪽이 포인터 방향을 향합니다(--la). 기기 기울기 대신 포인터로 근사합니다.
     3) 누른 채 움직이면 최대 motion-flex px까지 손가락 쪽으로 끌려옵니다(--gx, --gy). 놓으면 스프링으로 복귀.
     4) cl-btn--glass에 cl-glass가 빠져 있으면 자동으로 붙입니다(빼먹어도 재질이 사라지지 않게). */
  function bindGlow(root) {
    all(root, '.cl-btn--glass, .cl-btn--glass-prominent').forEach(function (el) { if (!el.classList.contains('cl-glass')) { el.classList.add('cl-glass'); el.setAttribute('data-cl-autofixed', 'cl-glass'); } });
    all(root, '.cl-glass--interactive, .cl-btn--glass, .cl-btn--glass-prominent').forEach(function (el) {
      if (!once(el, 'Glow')) return;
      var pressed = false, angleAnim = null, curAngle = 155;
      function setAngle(a) { curAngle = a; el.style.setProperty('--la', a.toFixed(1) + 'deg'); }
      function local(e) { var r = el.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top, w: r.width, h: r.height }; }
      el.addEventListener('pointerdown', function (e) {
        var p = local(e); pressed = true;
        el.style.setProperty('--px', p.x + 'px'); el.style.setProperty('--py', p.y + 'px');
        el.setAttribute('data-pressed', 'true');
      });
      el.addEventListener('pointermove', function (e) {
        var p = local(e), dx = p.x - p.w / 2, dy = p.y - p.h / 2;
        if (angleAnim) { angleAnim.stop(); angleAnim = null; }
        setAngle(Math.atan2(dx, -dy) * 180 / Math.PI + 180);
        if (pressed) {
          el.style.setProperty('--px', p.x + 'px'); el.style.setProperty('--py', p.y + 'px');
          if (!reduced()) {
            var m = cssNum('--motion-flex', 3);
            el.style.setProperty('--gx', (Math.max(-1, Math.min(1, dx / (p.w / 2))) * m).toFixed(2) + 'px');
            el.style.setProperty('--gy', (Math.max(-1, Math.min(1, dy / (p.h / 2))) * m).toFixed(2) + 'px');
          }
        }
      });
      function release() {
        if (pressed) { pressed = false; el.removeAttribute('data-pressed'); el.style.removeProperty('--gx'); el.style.removeProperty('--gy'); }
      }
      el.addEventListener('pointerup', release); el.addEventListener('pointercancel', release);
      el.addEventListener('pointerleave', function () {
        release();
        var diff = ((155 - curAngle) % 360 + 540) % 360 - 180;
        if (Math.abs(diff) < 0.5) return;
        var from = curAngle;
        angleAnim = spring({ from: from, to: from + diff, spring: 'smooth', onUpdate: setAngle, onComplete: function () { angleAnim = null; } });
      });
    });
  }

  /* ---------- 하나만 고르는 묶음: 화살표·Home·End, 선택된 항목만 Tab 순서에 ---------- */
  function roving(group, itemSel, attr, onSelect) {
    var items = all(group, itemSel);
    if (!items.length) return;
    var cur = items.findIndex(function (x) { return x.getAttribute(attr) === 'true'; });
    if (cur < 0) cur = 0;
    function select(i, focus, silent) {
      items.forEach(function (x, j) { x.setAttribute(attr, String(i === j)); x.tabIndex = i === j ? 0 : -1; });
      if (focus) items[i].focus();
      if (onSelect) onSelect(i, items[i]);
      if (!silent) emit(group, 'cl-change', { index: i, item: items[i] });
    }
    items.forEach(function (x, j) {
      x.addEventListener('click', function () { select(j, false); });
      x.addEventListener('keydown', function (e) {
        var n = items.length, i = items.indexOf(x), t = null;
        if (e.key === 'ArrowRight' || e.key === 'ArrowDown') t = (i + 1) % n;
        else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') t = (i - 1 + n) % n;
        else if (e.key === 'Home') t = 0;
        else if (e.key === 'End') t = n - 1;
        if (t !== null) { e.preventDefault(); select(t, true); }
      });
    });
    select(cur, false, true);
  }
  function bindSegmented(root) {
    all(root, '.cl-seg').forEach(function (g) {
      if (!once(g, 'Seg')) return;
      var sel = g.querySelector('[role="tab"]') ? '.cl-seg__item' : '.cl-seg__item';
      var attr = g.querySelector('[aria-selected]') ? 'aria-selected' : 'aria-checked';
      g.style.setProperty('--n', all(g, sel).length);
      roving(g, sel, attr, function (i) { g.style.setProperty('--i', i); });
    });
  }
  function bindTabs(root) {
    all(root, '.cl-tabbar').forEach(function (g) {
      if (!once(g, 'Tabs')) return;
      roving(g, '.cl-tabbar__item', 'aria-selected');
    });
    all(root, '.cl-tabdock[data-cl-minimize]').forEach(function (dock) {
      if (!once(dock, 'Min')) return;
      var sp = scrollParent(dock), last = scrollTop(sp);
      (sp === window ? window : sp).addEventListener('scroll', function () {
        var y = scrollTop(sp);
        if (Math.abs(y - last) < 6) return;
        dock.setAttribute('data-minimized', String(y > last && y > 24));
        last = y;
      }, { passive: true });
    });
  }

  /* ---------- 내비게이션: 큰 제목 접기, 스크롤 가장자리 ---------- */
  function bindNav(root) {
    all(root, '.cl-nav').forEach(function (nav) {
      if (!once(nav, 'Nav')) return;
      var large = nav.parentElement.querySelector('.cl-large');
      var sp = scrollParent(nav.parentElement.querySelector('.cl-large') || nav);
      if (sp === window && nav.parentElement !== doc.body) {
        var p = nav.parentElement; if (getComputedStyle(p).overflowY === 'auto') sp = p;
      }
      function update() {
        var y = scrollTop(sp);
        if (large) {
          var c = y > large.offsetTop + large.offsetHeight - 60;
          nav.setAttribute('data-collapsed', String(c));
          large.style.opacity = c ? 0 : 1;
        }
      }
      (sp === window ? window : sp).addEventListener('scroll', update, { passive: true });
      update();
    });
    all(root, '.cl-scroll-edge').forEach(function (edge) {
      if (!once(edge, 'Edge')) return;
      var sp = edge.parentElement && getComputedStyle(edge.parentElement).overflowY === 'auto' ? edge.parentElement : scrollParent(edge);
      function update() { edge.setAttribute('data-active', String(scrollTop(sp) > 4)); }
      (sp === window ? window : sp).addEventListener('scroll', update, { passive: true });
      update();
    });
  }

  /* ---------- 토글 ---------- */
  function bindToggle(root) {
    all(root, '.cl-toggle').forEach(function (t) {
      if (!once(t, 'Toggle')) return;
      t.addEventListener('click', function () {
        if (t.getAttribute('aria-disabled') === 'true') return;
        var on = t.getAttribute('aria-checked') !== 'true';
        t.setAttribute('aria-checked', String(on));
        var s = t.querySelector('.cl-toggle__state');
        if (s) s.textContent = on ? (t.dataset.on || '켜짐') : (t.dataset.off || '꺼짐');
        emit(t, 'cl-change', { checked: on });
      });
    });
  }

  /* ---------- 슬라이더 ---------- */
  function bindSlider(root) {
    all(root, '.cl-slider').forEach(function (s) {
      if (!once(s, 'Slider')) return;
      function update() {
        var min = +s.min || 0, max = +s.max || 100, v = ((+s.value - min) / (max - min)) * 100;
        s.style.setProperty('--value', v);
        var row = s.closest('.cl-slider-row'), out = row && row.querySelector('output');
        if (out) out.textContent = s.value + (s.dataset.unit || '');
      }
      s.addEventListener('input', update); update();
    });
  }

  /* ---------- 스테퍼 ---------- */
  function bindStepper(root) {
    all(root, '.cl-stepper').forEach(function (st) {
      if (!once(st, 'Stepper')) return;
      var out = st.querySelector('.cl-stepper__value');
      var min = st.dataset.min !== undefined ? +st.dataset.min : -Infinity;
      var max = st.dataset.max !== undefined ? +st.dataset.max : Infinity;
      var step = +(st.dataset.step || 1), unit = st.dataset.unit || '';
      var val = +(st.dataset.value || out.textContent.replace(/[^\d.-]/g, '') || 0);
      out.setAttribute('aria-live', 'polite');
      function render(dir) {
        out.textContent = val + unit;
        st.dataset.value = val;
        all(st, '.cl-stepper__btn').forEach(function (b) {
          var d = +b.dataset.dir; b.disabled = d < 0 ? val - step < min : val + step > max;
        });
        if (dir && !reduced()) { out.setAttribute('data-bump', dir > 0 ? 'up' : 'down'); setTimeout(function () { out.removeAttribute('data-bump'); }, 110); }
      }
      all(st, '.cl-stepper__btn').forEach(function (b) {
        b.addEventListener('click', function () {
          var d = +b.dataset.dir, nv = Math.round((val + d * step) * 1000) / 1000;
          if (nv < min || nv > max) return;
          val = nv; render(d); emit(st, 'cl-change', { value: val });
        });
      });
      render();
    });
  }

  /* ---------- 떠 있는 창(Menu, ActionSheet, 달력): 열기·닫기·포커스 ---------- */
  var openLayer = null;
  function closeLayer(restore) {
    if (!openLayer) return;
    var L = openLayer; openLayer = null;
    L.panel.setAttribute('data-open', 'false');
    if (L.trigger) L.trigger.setAttribute('aria-expanded', 'false');
    if (L.onClose) L.onClose();
    if (restore && L.trigger) L.trigger.focus();
  }
  function openPanel(panel, trigger, opts) {
    closeLayer(false);
    opts = opts || {};
    panel.setAttribute('data-open', 'true');
    if (trigger) trigger.setAttribute('aria-expanded', 'true');
    openLayer = { panel: panel, trigger: trigger, onClose: opts.onClose };
    setTimeout(function () {
      var f = opts.focus || panel.querySelector('[role="menuitem"], .cl-actionsheet__btn, [aria-selected="true"], button');
      if (f) f.focus();
    }, 30);
  }
  doc.addEventListener('pointerdown', function (e) {
    if (!openLayer) return;
    if (openLayer.panel.contains(e.target) || (openLayer.trigger && openLayer.trigger.contains(e.target))) return;
    closeLayer(false);
  });
  doc.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && openLayer) { e.preventDefault(); closeLayer(true); }
  });
  function bindPopovers(root) {
    all(root, '[aria-haspopup][aria-controls]').forEach(function (trigger) {
      if (!once(trigger, 'Pop')) return;
      var panel = doc.getElementById(trigger.getAttribute('aria-controls'));
      if (!panel) return;
      if (panel.getAttribute('data-open') === 'true') { openLayer = { panel: panel, trigger: trigger }; }
      trigger.addEventListener('click', function (e) {
        e.stopPropagation();
        if (openLayer && openLayer.panel === panel) closeLayer(false); else openPanel(panel, trigger);
      });
    });
    all(root, '.cl-menu, .cl-actionsheet').forEach(function (panel) {
      if (!once(panel, 'Panel')) return;
      panel.addEventListener('keydown', function (e) {
        var items = all(panel, '[role="menuitem"], .cl-actionsheet__btn');
        var i = items.indexOf(doc.activeElement), t = null;
        if (e.key === 'ArrowDown') t = (i + 1) % items.length;
        else if (e.key === 'ArrowUp') t = (i - 1 + items.length) % items.length;
        else if (e.key === 'Home') t = 0; else if (e.key === 'End') t = items.length - 1;
        else if (e.key === 'Tab') { closeLayer(false); return; }
        if (t !== null) { e.preventDefault(); items[t].focus(); }
      });
      panel.addEventListener('click', function (e) {
        var it = e.target.closest('[role="menuitem"], .cl-actionsheet__btn');
        if (it) { emit(panel, 'cl-select', { item: it }); closeLayer(true); }
      });
    });
  }

  /* ---------- 길게 누르기·오른쪽 클릭 메뉴 ---------- */
  function bindContext(root) {
    all(root, '[data-cl-context]').forEach(function (el) {
      if (!once(el, 'Ctx')) return;
      var menu = doc.getElementById(el.getAttribute('data-cl-context'));
      if (!menu) return;
      menu.classList.add('cl-menu--context');
      if (!el.hasAttribute('tabindex')) el.tabIndex = 0;
      el.setAttribute('aria-haspopup', 'menu');
      var timer = null;
      function show(x, y) {
        el.setAttribute('data-lifted', 'true');
        var vw = window.innerWidth, vh = window.innerHeight, w = menu.offsetWidth || 240, h = menu.offsetHeight || 200;
        var left = Math.min(x, vw - w - 8), top = Math.min(y, vh - h - 8);
        menu.style.left = Math.max(8, left) + 'px'; menu.style.top = Math.max(8, top) + 'px';
        menu.style.setProperty('--origin', (x > vw - w - 8 ? 'right' : 'left') + ' ' + (y > vh - h - 8 ? 'bottom' : 'top'));
        openPanel(menu, el, { onClose: function () { el.removeAttribute('data-lifted'); } });
      }
      el.addEventListener('contextmenu', function (e) { e.preventDefault(); show(e.clientX, e.clientY); });
      el.addEventListener('pointerdown', function (e) {
        if (e.pointerType === 'mouse') return;
        var x = e.clientX, y = e.clientY;
        timer = setTimeout(function () { show(x, y); }, 480);
      });
      ['pointerup', 'pointercancel', 'pointermove'].forEach(function (ev) { el.addEventListener(ev, function (e) { if (ev === 'pointermove' && timer && Math.abs(e.movementX) + Math.abs(e.movementY) < 3) return; clearTimeout(timer); timer = null; }); });
      el.addEventListener('keydown', function (e) {
        if (e.key === 'ContextMenu' || (e.shiftKey && e.key === 'F10')) { e.preventDefault(); var r = el.getBoundingClientRect(); show(r.left + 16, r.bottom - 8); }
      });
    });
  }

  /* ---------- 밀어서 동작: 놓을 때의 속도로 열고 닫기를 정하고, 그 속도를 이어받아 안착 ---------- */
  var openSwipe = null;
  function bindSwipe(root) {
    all(root, '.cl-swipe').forEach(function (row) {
      if (!once(row, 'Swipe')) return;
      var content = row.querySelector('.cl-swipe__content'), actions = row.querySelector('.cl-swipe__actions');
      var startX = 0, base = 0, x = 0, dragging = false, moved = false, anim = null, tr = tracker();
      function set(v) { x = v; content.style.setProperty('--sx', v + 'px'); }
      function settle(target, vel) {
        if (anim) anim.stop();
        row.setAttribute('data-dragging', 'true');
        var me = anim = spring({ from: x, to: target, velocity: vel || 0, spring: 'snappy', onUpdate: set,
          onComplete: function (interrupted) { if (!interrupted && anim === me) { anim = null; row.removeAttribute('data-dragging'); } } });
      }
      function close(vel) { settle(0, vel); row.removeAttribute('data-open'); if (openSwipe === row) openSwipe = null; }
      row.clSwipeClose = function () { close(0); };
      content.addEventListener('pointerdown', function (e) {
        if (openSwipe && openSwipe !== row) openSwipe.clSwipeClose();
        if (anim) { anim.stop(); anim = null; }
        dragging = true; moved = false; startX = e.clientX; base = x; tr.reset(); tr.add(e.clientX);
      });
      content.addEventListener('pointermove', function (e) {
        if (!dragging) return;
        tr.add(e.clientX);
        var dx = e.clientX - startX;
        if (!moved && Math.abs(dx) < 6) return;
        if (!moved) { moved = true; row.setAttribute('data-dragging', 'true'); content.setPointerCapture(e.pointerId); }
        var w = actions.offsetWidth, v = Math.min(0, base + dx);
        if (v < -w) v = -w - (-w - v) * 0.3;
        if (v > 0) v = 0;
        set(v);
      });
      function end() {
        if (!dragging) return; dragging = false;
        if (!moved) { row.removeAttribute('data-dragging'); if (x !== 0) close(0); return; }
        var w = actions.offsetWidth, vx = tr.velocity().x, landing = x + project(vx);
        if (landing < -w / 2) { settle(-w, vx); row.setAttribute('data-open', 'true'); openSwipe = row; }
        else close(vx);
      }
      content.addEventListener('pointerup', end); content.addEventListener('pointercancel', end);
      content.addEventListener('click', function (e) { if (moved) { e.preventDefault(); e.stopPropagation(); } }, true);
      all(actions, 'button').forEach(function (b) { b.tabIndex = -1; b.addEventListener('click', function () { emit(row, 'cl-swipe-action', { action: b }); close(0); }); });
    });
  }

  /* ---------- 시트 단계, 사이드바 ---------- */
  function bindSheet(root) {
    all(root, '[data-cl-detent]').forEach(function (b) {
      if (!once(b, 'Detent')) return;
      b.addEventListener('click', function () {
        var sh = b.closest('.cl-sheet') || doc.getElementById(b.getAttribute('data-cl-detent'));
        if (!sh) return;
        var large = sh.getAttribute('data-detent') !== 'large';
        sh.setAttribute('data-detent', large ? 'large' : 'medium');
        var scrim = sh.dataset.scrim && doc.getElementById(sh.dataset.scrim);
        if (scrim) scrim.setAttribute('data-show', String(large));
        if (b.dataset.labelLarge) b.textContent = large ? b.dataset.labelMedium : b.dataset.labelLarge;
        emit(sh, 'cl-change', { detent: large ? 'large' : 'medium' });
      });
    });
  }
  function bindSidebar(root) {
    all(root, '[data-cl-sidebar]').forEach(function (b) {
      if (!once(b, 'Side')) return;
      b.addEventListener('click', function () {
        var sp = b.closest('.cl-split') || doc.querySelector('.cl-split');
        var hide = b.getAttribute('data-cl-sidebar') === 'hide';
        if (hide) sp.setAttribute('data-sidebar', 'hidden'); else sp.removeAttribute('data-sidebar');
        var other = sp.querySelector('[data-cl-sidebar="' + (hide ? 'show' : 'hide') + '"]');
        if (other) setTimeout(function () { other.focus(); }, 50);
      });
    });
  }

  /* ---------- 날짜 선택 ---------- */
  var DOW = ['일', '월', '화', '수', '목', '금', '토'];
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function iso(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function parse(s) { var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s || ''); return m ? new Date(+m[1], +m[2] - 1, +m[3]) : new Date(); }
  function label(d) { return (d.getMonth() + 1) + '월 ' + d.getDate() + '일 (' + DOW[d.getDay()] + ')'; }
  function bindDate(root) {
    all(root, '.cl-datepicker').forEach(function (dp) {
      if (!once(dp, 'Date')) return;
      var chip = dp.querySelector('.cl-datechip'), cal = dp.querySelector('.cl-calendar'), input = dp.querySelector('input[type="hidden"]');
      if (!cal.id) cal.id = 'cl-cal-' + Math.random().toString(36).slice(2, 8);
      cal.classList.add('cl-glass', 'cl-glass--thick');
      cal.setAttribute('role', 'dialog'); cal.setAttribute('aria-label', '날짜 선택');
      chip.setAttribute('aria-haspopup', 'dialog'); chip.setAttribute('aria-expanded', 'false');
      var sel = parse(dp.dataset.value), view = new Date(sel.getFullYear(), sel.getMonth(), 1), focusD = new Date(sel);
      var today = dp.dataset.today ? parse(dp.dataset.today) : new Date();
      function setValue(d) {
        sel = new Date(d); dp.dataset.value = iso(sel);
        chip.innerHTML = '<span>' + label(sel) + '</span>';
        chip.setAttribute('aria-label', '날짜 ' + label(sel) + ', 바꾸기');
        if (input) input.value = iso(sel);
      }
      function render() {
        var y = view.getFullYear(), m = view.getMonth();
        var start = new Date(y, m, 1 - new Date(y, m, 1).getDay());
        var h = '<div class="cl-calendar__head"><span class="cl-calendar__title" aria-live="polite">' + y + '년 ' + (m + 1) + '월</span>' +
          '<span class="cl-calendar__nav"><button type="button" class="cl-btn cl-btn--icon" data-nav="-1" aria-label="이전 달">' + icon('back') + '</button>' +
          '<button type="button" class="cl-btn cl-btn--icon" data-nav="1" aria-label="다음 달">' + icon('chev') + '</button></span></div>' +
          '<div class="cl-calendar__grid" role="grid">';
        DOW.forEach(function (d) { h += '<span class="cl-calendar__dow" aria-hidden="true">' + d + '</span>'; });
        for (var i = 0; i < 42; i++) {
          var d = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i), s = iso(d);
          h += '<button type="button" class="cl-calendar__day" role="gridcell" data-date="' + s + '"' +
            (d.getMonth() !== m ? ' data-outside="true"' : '') + (s === iso(today) ? ' aria-current="date"' : '') +
            ' aria-selected="' + (s === iso(sel)) + '" tabindex="' + (s === iso(focusD) ? 0 : -1) + '" aria-label="' + label(d) + '">' + d.getDate() + '</button>';
        }
        cal.innerHTML = h + '</div>';
      }
      function focusDay() { var b = cal.querySelector('[data-date="' + iso(focusD) + '"]'); if (b) b.focus(); }
      function move(days, months) {
        focusD = new Date(focusD.getFullYear(), focusD.getMonth() + (months || 0), focusD.getDate() + (days || 0));
        if (focusD.getMonth() !== view.getMonth() || focusD.getFullYear() !== view.getFullYear()) view = new Date(focusD.getFullYear(), focusD.getMonth(), 1);
        render(); focusDay();
      }
      chip.addEventListener('click', function (e) {
        e.stopPropagation();
        if (openLayer && openLayer.panel === cal) { closeLayer(false); return; }
        focusD = new Date(sel); view = new Date(sel.getFullYear(), sel.getMonth(), 1); render();
        openPanel(cal, chip, { focus: cal.querySelector('[aria-selected="true"]') });
      });
      cal.addEventListener('click', function (e) {
        var nav = e.target.closest('[data-nav]');
        if (nav) { view = new Date(view.getFullYear(), view.getMonth() + +nav.dataset.nav, 1); focusD = new Date(view); render(); return; }
        var day = e.target.closest('[data-date]');
        if (day) { setValue(parse(day.dataset.date)); emit(dp, 'cl-change', { value: dp.dataset.value }); closeLayer(true); }
      });
      cal.addEventListener('keydown', function (e) {
        if (!e.target.closest('[data-date]')) return;
        var k = e.key;
        if (k === 'ArrowRight') move(1); else if (k === 'ArrowLeft') move(-1);
        else if (k === 'ArrowDown') move(7); else if (k === 'ArrowUp') move(-7);
        else if (k === 'PageDown') move(0, 1); else if (k === 'PageUp') move(0, -1);
        else return;
        e.preventDefault();
      });
      setValue(sel);
    });
  }

  /* ---------- 알림(토스트) ---------- */
  NS.toast = function (message, opts) {
    opts = opts || {};
    var region = doc.querySelector('.cl-toast-region');
    if (!region) { region = doc.createElement('div'); region.className = 'cl-toast-region'; region.setAttribute('role', 'status'); region.setAttribute('aria-live', 'polite'); doc.body.appendChild(region); }
    var t = doc.createElement('div');
    t.className = 'cl-toast cl-glass' + (opts.tone === 'danger' ? ' cl-toast--danger' : '');
    t.innerHTML = icon(opts.tone === 'danger' ? 'alert' : 'check') + '<span></span>';
    t.lastChild.textContent = message;
    region.appendChild(t);
    requestAnimationFrame(function () { requestAnimationFrame(function () { t.setAttribute('data-show', 'true'); }); });
    var life = opts.duration || 3200;
    setTimeout(function () { t.setAttribute('data-show', 'false'); setTimeout(function () { t.remove(); }, 700); }, life);
    return t;
  };
  function bindToastTriggers(root) {
    all(root, '[data-cl-toast]').forEach(function (b) {
      if (!once(b, 'Toast')) return;
      b.addEventListener('click', function () { NS.toast(b.getAttribute('data-cl-toast'), { tone: b.dataset.tone }); });
    });
  }

  /* ---------- 표: 정렬, 머리 고정 경계 ---------- */
  function bindTable(root) {
    all(root, '.cl-table-wrap').forEach(function (w) {
      if (!once(w, 'Table')) return;
      w.addEventListener('scroll', function () { w.setAttribute('data-scrolled', String(w.scrollTop > 2)); }, { passive: true });
      all(w, 'th[aria-sort] button').forEach(function (btn) {
        btn.addEventListener('click', function () {
          var th = btn.closest('th'), table = th.closest('table'), idx = Array.prototype.indexOf.call(th.parentNode.children, th);
          var dir = th.getAttribute('aria-sort') === 'ascending' ? 'descending' : 'ascending';
          all(table, 'th[aria-sort]').forEach(function (x) { x.setAttribute('aria-sort', 'none'); });
          th.setAttribute('aria-sort', dir);
          var body = table.tBodies[0], rows = Array.prototype.slice.call(body.rows);
          var num = th.classList.contains('num');
          rows.sort(function (a, b) {
            var x = a.cells[idx].getAttribute('data-sort') || a.cells[idx].textContent, y = b.cells[idx].getAttribute('data-sort') || b.cells[idx].textContent;
            var r = num ? (parseFloat(x.replace(/[^\d.-]/g, '')) - parseFloat(y.replace(/[^\d.-]/g, ''))) : x.localeCompare(y, 'ko');
            return dir === 'ascending' ? r : -r;
          });
          rows.forEach(function (r) { body.appendChild(r); });
        });
      });
    });
  }

  /* ---------- 스탯 타일 스파크라인 ---------- */
  function bindSpark(root) {
    all(root, '.cl-stat__spark[data-values]').forEach(function (s) {
      if (!once(s, 'Spark')) return;
      var v = s.getAttribute('data-values').split(',').map(Number), W = Math.round(s.getBoundingClientRect().width) || 120, H = 36;
      var min = Math.min.apply(null, v), max = Math.max.apply(null, v), r = max - min || 1;
      s.setAttribute('viewBox', '0 0 ' + W + ' ' + H); s.setAttribute('aria-hidden', 'true');
      var pts = v.map(function (y, i) { return [4 + i * ((W - 8) / (v.length - 1)), H - 5 - ((y - min) / r) * (H - 10)]; });
      s.innerHTML = '';
      s.appendChild(svg('path', { d: 'M' + pts.map(function (p) { return p[0].toFixed(1) + ' ' + p[1].toFixed(1); }).join(' L') }));
      var last = pts[pts.length - 1];
      var c = svg('circle', { cx: last[0], cy: last[1], r: 4 });
      s.appendChild(c);
    });
  }

  /* ---------- 차트: 막대·선, 범례, 마우스 올림 설명, 표 보기 ---------- */
  function nice(max) {
    if (max <= 0) return 1;
    var e = Math.pow(10, Math.floor(Math.log10(max))), f = max / e;
    return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10) * e;
  }
  function fmt(n) { return n >= 1000 ? (Math.round(n / 100) / 10) + 'K' : String(n); }
  NS.chart = function (el, cfg) {
    cfg = cfg || JSON.parse(el.getAttribute('data-chart'));
    el.clChart = cfg;
    var host = el.querySelector('.cl-chart__plot');
    if (!host) { host = doc.createElement('div'); host.className = 'cl-chart__plot'; host.style.position = 'relative'; el.appendChild(host); }
    host.innerHTML = '';
    var W = Math.max(280, host.clientWidth || el.clientWidth - 40), H = cfg.height || 220;
    var M = { l: 36, r: cfg.type === 'line' && cfg.series.length <= 4 ? 44 : 8, t: 10, b: 26 };
    var cats = cfg.categories, S = cfg.series, unit = cfg.unit || '';
    var dmax = cfg.yMax || Math.max.apply(null, S.map(function (s) { return Math.max.apply(null, s.values); }));
    var stepV = nice(dmax / 4), max = stepV * Math.ceil(dmax / stepV), nt = Math.round(max / stepV);
    var iw = W - M.l - M.r, ih = H - M.t - M.b, band = iw / cats.length;
    var y = function (v) { return M.t + ih - (v / max) * ih; };
    var root = svg('svg', { viewBox: '0 0 ' + W + ' ' + H, role: 'img', 'aria-label': (cfg.title || '차트') + ', 자세한 값은 표로 보기에 있습니다.' });
    var grid = svg('g', { class: 'grid' });
    for (var i = 0; i <= nt; i++) {
      var v = Math.round(stepV * i * 1000) / 1000, yy = Math.round(y(v)) + 0.5;
      grid.appendChild(svg('line', { x1: M.l, x2: W - M.r, y1: yy, y2: yy }));
      var t = svg('text', { x: M.l - 8, y: yy + 4, 'text-anchor': 'end', class: 'tick' }); t.textContent = fmt(v); grid.appendChild(t);
    }
    root.appendChild(grid);
    cats.forEach(function (c, i) {
      var t = svg('text', { x: M.l + band * i + band / 2, y: H - 6, 'text-anchor': 'middle', class: 'tick' }); t.textContent = c; root.appendChild(t);
    });
    var tip = doc.createElement('div'); tip.className = 'cl-chart__tip cl-glass cl-glass--thick'; host.appendChild(tip);
    function showTip(ci, px, py) {
      var h = '<b>' + cats[ci] + '</b>';
      S.forEach(function (s, si) { h += '<div><span class="cl-chart__key" style="background:var(--chart-' + (si + 1) + ')"></span><span>' + s.name + '</span><span>' + s.values[ci] + unit + '</span></div>'; });
      tip.innerHTML = h; tip.setAttribute('data-show', 'true');
      var tw = tip.offsetWidth, left = Math.min(Math.max(0, px - tw / 2), W - tw);
      tip.style.left = left + 'px'; tip.style.top = Math.max(0, py - tip.offsetHeight - 12) + 'px';
    }
    function hideTip() { tip.setAttribute('data-show', 'false'); }
    if (cfg.type === 'bar') {
      var n = S.length, bw = Math.min(24, (band * 0.62 - (n - 1) * 2) / n), gw = n * bw + (n - 1) * 2;
      cats.forEach(function (c, ci) {
        S.forEach(function (s, si) {
          var x = M.l + band * ci + (band - gw) / 2 + si * (bw + 2), top = y(s.values[ci]), base = y(0), r = Math.min(4, (base - top));
          var d = 'M' + x + ' ' + base + ' V' + (top + r) + ' Q' + x + ' ' + top + ' ' + (x + r) + ' ' + top + ' H' + (x + bw - r) + ' Q' + (x + bw) + ' ' + top + ' ' + (x + bw) + ' ' + (top + r) + ' V' + base + ' Z';
          var p = svg('path', { d: d, class: 'bar', fill: 'var(--chart-' + (si + 1) + ')', tabindex: 0, 'aria-label': c + ' ' + s.name + ' ' + s.values[ci] + unit });
          var hit = function () { showTip(ci, x + bw / 2, top); };
          p.addEventListener('mouseenter', hit); p.addEventListener('focus', hit);
          p.addEventListener('mouseleave', hideTip); p.addEventListener('blur', hideTip);
          root.appendChild(p);
          if (cfg.labelMax && s.values[ci] === Math.max.apply(null, s.values)) {
            var lt = svg('text', { x: x + bw / 2, y: top - 6, 'text-anchor': 'middle', class: 'lbl' }); lt.textContent = s.values[ci] + unit; root.appendChild(lt);
          }
        });
      });
    } else {
      var xh = svg('line', { class: 'xhair', y1: M.t, y2: M.t + ih });
      root.appendChild(xh);
      var dots = [];
      S.forEach(function (s, si) {
        var pts = s.values.map(function (v, i) { return [M.l + band * i + band / 2, y(v)]; });
        var area = cfg.area && S.length === 1;
        if (area) root.appendChild(svg('path', { d: 'M' + pts[0][0] + ' ' + y(0) + ' L' + pts.map(function (p) { return p.join(' '); }).join(' L') + ' L' + pts[pts.length - 1][0] + ' ' + y(0) + ' Z', fill: 'var(--chart-' + (si + 1) + ')', opacity: 0.1 }));
        root.appendChild(svg('path', { d: 'M' + pts.map(function (p) { return p.join(' '); }).join(' L'), class: 'line', stroke: 'var(--chart-' + (si + 1) + ')' }));
        var last = pts[pts.length - 1];
        root.appendChild(svg('circle', { cx: last[0], cy: last[1], r: 4, class: 'dot', fill: 'var(--chart-' + (si + 1) + ')' }));
        if (S.length <= 4) { var lt = svg('text', { x: last[0] + 8, y: last[1] + 4, class: 'lbl' }); lt.textContent = s.values[s.values.length - 1] + unit; root.appendChild(lt); }
        var d = svg('circle', { r: 4, class: 'dot', fill: 'var(--chart-' + (si + 1) + ')', opacity: 0 }); root.appendChild(d); dots.push([d, pts]);
      });
      var ov = svg('rect', { x: M.l, y: M.t, width: iw, height: ih, fill: 'transparent', tabindex: 0, 'aria-label': '값 살펴보기, 좌우 화살표' });
      var cur = cats.length - 1;
      function at(ci) {
        cur = ci; var px = M.l + band * ci + band / 2;
        xh.setAttribute('x1', px); xh.setAttribute('x2', px); xh.style.opacity = 1;
        dots.forEach(function (d) { d[0].setAttribute('cx', d[1][ci][0]); d[0].setAttribute('cy', d[1][ci][1]); d[0].setAttribute('opacity', 1); });
        showTip(ci, px, Math.min.apply(null, dots.map(function (d) { return d[1][ci][1]; })));
      }
      function off() { xh.style.opacity = 0; dots.forEach(function (d) { d[0].setAttribute('opacity', 0); }); hideTip(); }
      ov.addEventListener('mousemove', function (e) { var r = root.getBoundingClientRect(), sx = (e.clientX - r.left) * (W / r.width); at(Math.max(0, Math.min(cats.length - 1, Math.floor((sx - M.l) / band)))); });
      ov.addEventListener('mouseleave', off); ov.addEventListener('blur', off);
      ov.addEventListener('focus', function () { at(cur); });
      ov.addEventListener('keydown', function (e) { if (e.key === 'ArrowRight') { e.preventDefault(); at(Math.min(cats.length - 1, cur + 1)); } if (e.key === 'ArrowLeft') { e.preventDefault(); at(Math.max(0, cur - 1)); } });
      root.appendChild(ov);
    }
    host.insertBefore(root, tip);
    var legend = el.querySelector('.cl-chart__legend');
    if (legend) legend.innerHTML = S.length < 2 ? '' : S.map(function (s, si) { return '<li><span class="cl-chart__key" style="background:var(--chart-' + (si + 1) + ')"></span>' + s.name + '</li>'; }).join('');
    var det = el.querySelector('details.cl-chart__table');
    if (!det) { det = doc.createElement('details'); det.className = 'cl-chart__table'; el.appendChild(det); }
    var tb = '<summary>표로 보기</summary><div class="cl-table-wrap" style="--table-max:240px;margin-top:8px"><table class="cl-table"><thead><tr><th scope="col">구분</th>' +
      S.map(function (s) { return '<th scope="col" class="num">' + s.name + '</th>'; }).join('') + '</tr></thead><tbody>' +
      cats.map(function (c, ci) { return '<tr><th scope="row">' + c + '</th>' + S.map(function (s) { return '<td class="num">' + s.values[ci] + unit + '</td>'; }).join('') + '</tr>'; }).join('') + '</tbody></table></div>';
    var wasOpen = det.open; det.innerHTML = tb; det.open = wasOpen;
  };
  function bindCharts(root) {
    all(root, '.cl-chart[data-chart]').forEach(function (el) {
      if (!once(el, 'Chart')) return;
      NS.chart(el);
      if (window.ResizeObserver) {
        var w = el.clientWidth;
        new ResizeObserver(function () { if (Math.abs(el.clientWidth - w) > 8) { w = el.clientWidth; NS.chart(el, el.clChart); } }).observe(el);
      }
    });
  }


  /* ---------- 테마와 강조 ----------
     정해지는 순서: 1) html의 data-theme 값 2) 값이 없으면 light(tokens.css의 :root)
     3) data-theme="auto"면 기기 설정을 따름(어두운 모드 → dark, 대비 높이기 → -hc)
     강조는 data-accent(eduplex 기본 · green · ink). 둘 다 setTheme / setAccent로 바꾸고, data-cl-remember가 있으면 기억합니다. */
  var THEMES = ['light', 'dark', 'light-hc', 'dark-hc', 'auto'], ACCENTS = ['eduplex', 'green', 'ink'];
  function store(k, v) { try { if (doc.documentElement.hasAttribute('data-cl-remember')) localStorage.setItem('cl-' + k, v); } catch (e) {} }
  function recall(k) { try { return doc.documentElement.hasAttribute('data-cl-remember') ? localStorage.getItem('cl-' + k) : null; } catch (e) { return null; } }
  function resolveAuto() {
    var dark = window.matchMedia && matchMedia('(prefers-color-scheme: dark)').matches;
    var more = window.matchMedia && matchMedia('(prefers-contrast: more)').matches;
    return (dark ? 'dark' : 'light') + (more ? '-hc' : '');
  }
  NS.setTheme = function (theme) {
    if (THEMES.indexOf(theme) < 0) return;
    var h = doc.documentElement; h.dataset.themePref = theme;
    h.setAttribute('data-theme', theme === 'auto' ? resolveAuto() : theme);
    store('theme', theme); emit(h, 'cl-theme', { theme: h.getAttribute('data-theme'), pref: theme });
  };
  NS.setAccent = function (accent) {
    if (ACCENTS.indexOf(accent) < 0) return;
    var h = doc.documentElement;
    if (accent === 'eduplex') h.removeAttribute('data-accent'); else h.setAttribute('data-accent', accent);
    store('accent', accent); emit(h, 'cl-accent', { accent: accent });
  };
  (function bootTheme() {
    var h = doc.documentElement, saved = recall('theme'), acc = recall('accent');
    var pref = saved || h.getAttribute('data-theme');
    if (pref === 'auto' || saved) NS.setTheme(pref);
    if (acc) NS.setAccent(acc);
    if (window.matchMedia) ['(prefers-color-scheme: dark)', '(prefers-contrast: more)'].forEach(function (q) {
      var m = matchMedia(q), f = function () { if (h.dataset.themePref === 'auto') NS.setTheme('auto'); };
      if (m.addEventListener) m.addEventListener('change', f); else if (m.addListener) m.addListener(f);
    });
  })();
  function bindThemeControls(root) {
    all(root, '[data-cl-set-theme], [data-cl-set-accent]').forEach(function (b) {
      if (!once(b, 'Theme')) return;
      b.addEventListener('click', function () {
        if (b.dataset.clSetTheme) NS.setTheme(b.dataset.clSetTheme);
        if (b.dataset.clSetAccent) NS.setAccent(b.dataset.clSetAccent);
      });
    });
  }

  /* ============ 자가 점검: SangsangClarity.audit() ============
     화면을 다 만든 뒤, 움직임이 멈춘 상태에서 브라우저 콘솔(또는 Playwright page.evaluate)로 실행합니다. errors가 0이어야 완료입니다.
     검사: 유리 다섯 층(흐림·둘레·반사광·손끝 빛·그림자)과 연결, 콘텐츠 층 유리, 밝은 페이지의 어두운 띠,
     시스템 밖 색, 장식 애니메이션, 토큰 밖 전환 시간, 화면당 채움 버튼, 금지 용어. */
  function audit(root) {
    root = root || doc.body;
    var errors = [], warnings = [], h = doc.documentElement, theme = h.getAttribute('data-theme') || 'light';
    function where(el) {
      var s = el.tagName.toLowerCase();
      if (el.id) s += '#' + el.id;
      var c = typeof el.className === 'string' ? el.className.trim().split(/\s+/).filter(Boolean).slice(0, 3) : [];
      if (c.length) s += '.' + c.join('.');
      var t = (el.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 24);
      return t ? s + ' "' + t + '"' : s;
    }
    function err(rule, el, fix) { errors.push({ rule: rule, where: el ? where(el) : '', fix: fix || '' }); }
    function warn(rule, el, fix) { warnings.push({ rule: rule, where: el ? where(el) : '', fix: fix || '' }); }
    function visible(el) { var r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0 && getComputedStyle(el).visibility !== 'hidden'; }
    function rgba(str) { var m = /rgba?\(([^)]+)\)/.exec(str || ''); if (!m) return null; var p = m[1].split(/[ ,\/]+/).filter(Boolean).map(parseFloat); return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 }; }
    function lum(c) { function f(v) { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); } return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b); }
    var mq = function (q) { return window.matchMedia && matchMedia(q).matches; };
    var plainMaterial = /-hc$/.test(theme) || mq('(prefers-reduced-transparency: reduce)') || mq('(prefers-contrast: more)');

    /* 1) 유리 */
    all(root, '.cl-glass, .cl-btn--glass, .cl-btn--glass-prominent').forEach(function (el) {
      if (!visible(el)) return;
      var cs = getComputedStyle(el), bf = cs.backdropFilter || cs.webkitBackdropFilter || 'none';
      if (el.getAttribute('data-cl-autofixed')) warn('유리 버튼에 cl-glass 클래스 누락(자동 보정됨)', el, 'class="cl-btn cl-glass cl-btn--glass"로 마크업을 고칩니다.');
      if (!plainMaterial && bf === 'none') err('유리 흐림 없음', el, 'backdrop-filter를 지우거나 덮어쓴 CSS를 제거합니다. .cl-glass가 처리합니다.');
      var be = getComputedStyle(el, '::before');
      if (!plainMaterial && (be.content === 'none' || !/gradient/.test(be.backgroundImage))) err('반사광 링(::before) 없음', el, '::before를 덮어쓰지 않습니다. 아이콘 등은 ::before 대신 자식 요소로 넣습니다.');
      var af = getComputedStyle(el, '::after');
      if (af.content === 'none' || !/radial-gradient/.test(af.backgroundImage)) err('손끝 빛(::after) 없음', el, '::after를 덮어쓰지 않습니다.');
      if (cs.boxShadow === 'none') err('유리 둘레·그림자 없음', el, 'box-shadow를 지우지 않습니다(둘레 rim + shadow-float).');
      if (el.matches('.cl-glass--interactive, .cl-btn--glass, .cl-btn--glass-prominent') && !el.dataset.clBoundGlow) err('손끝 빛 동작 미연결', el, 'bundle.js를 불러오고, 나중에 그린 영역은 SangsangClarity.init(영역)을 호출합니다.');
      var floating = /absolute|fixed|sticky/.test(cs.position) || !!el.closest('.cl-sheet, .cl-menu, .cl-actionsheet, .cl-calendar, dialog, [role="dialog"]');
      if (!floating && el.closest('.cl-card, .cl-list, .cl-row, article')) err('콘텐츠 층 안의 유리', el, '카드·목록 안에서는 .cl-btn--gray/--tinted를 씁니다.');
    });
    all(root, '.cl-card, .cl-list, .cl-row, .cl-notice').forEach(function (el) {
      var cs = getComputedStyle(el), bf = cs.backdropFilter || cs.webkitBackdropFilter || 'none';
      if (bf !== 'none') err('콘텐츠 층에 유리 재질', el, '카드·목록·알림에서 backdrop-filter를 제거합니다.');
      var outer = cs.boxShadow === 'none' ? [] : cs.boxShadow.split(/,(?![^(]*\))/).filter(function (x) { return !/inset/.test(x); });
      if (outer.length && !el.closest('[data-lifted="true"]')) err('콘텐츠 층에 그림자', el, '카드·목록의 box-shadow를 제거합니다. 면의 밝기로만 구분합니다.');
    });

    /* 2) 밝은 페이지 안의 어두운 띠 */
    if (!/^dark/.test(theme)) {
      var vw = window.innerWidth;
      all(root, 'section, header, footer, main, div, aside, nav').forEach(function (el) {
        if (el.matches('.cl-scrim, .cl-dim, [data-cl-content]') || el.closest('[data-cl-content], dialog, [aria-modal="true"]')) return;
        var r = el.getBoundingClientRect(); if (r.width < vw * 0.6 || r.height < 120) return;
        var c = rgba(getComputedStyle(el).backgroundColor); if (!c || c.a < 0.5) return;
        if (lum(c) < 0.12) err('밝은 페이지 안의 어두운 띠', el, 'cl-section(연회색) 또는 cl-section--raised(흰 면)로 바꿉니다. 구획에 data-theme="dark"를 주지 않습니다.');
      });
    }

    /* 3) 시스템 밖 색: 토큰 값으로 계산되지 않는 글자·면 색 */
    var allowed = {}, probe = doc.createElement('i'); probe.style.display = 'none'; root.appendChild(probe);
    var names = {};
    Array.prototype.forEach.call(doc.styleSheets, function (ss) {
      var rules; try { rules = ss.cssRules; } catch (e) { return; }
      Array.prototype.forEach.call(rules || [], function (ru) {
        if (!ru.style || !/:root|data-theme|data-accent/.test(ru.selectorText || '')) return;
        for (var i = 0; i < ru.style.length; i++) { var n = ru.style[i]; if (/^--(cl-|edu-|brand-|chart-|accent-|on-)/.test(n)) names[n] = 1; }
      });
    });
    Object.keys(names).forEach(function (n) { probe.style.color = 'var(' + n + ')'; allowed[getComputedStyle(probe).color] = 1; });
    probe.remove();
    var tokenized = Object.keys(allowed).length > 10;
    if (!tokenized) err('토큰을 읽지 못함', null, 'tokens.css를 불러옵니다.');
    var stray = {};
    if (tokenized) all(root, '*').forEach(function (el) {
      if (el.closest('svg, img, video, picture, canvas, iframe, .cl-plate, [data-cl-content]') || !visible(el)) return;
      var cs = getComputedStyle(el);
      [['color', cs.color], ['background', cs.backgroundColor]].forEach(function (pair) {
        var v = pair[1], c = rgba(v);
        if (!c || c.a === 0 || allowed[v]) return;
        if (pair[0] === 'color' && !(el.childNodes.length && Array.prototype.some.call(el.childNodes, function (n) { return n.nodeType === 3 && n.textContent.trim(); }))) return;
        var key = pair[0] + ' ' + v; if (!stray[key]) stray[key] = el;
      });
    });
    Object.keys(stray).slice(0, 20).forEach(function (k) { err('시스템 밖 색 ' + k, stray[k], 'var(--cl-*) 토큰으로 바꿉니다. 사진·지도 같은 콘텐츠는 data-cl-content로 감쌉니다.'); });

    /* 4) 움직임 */
    var durs = {};
    ['--dur-instant', '--dur-press', '--dur-snappy', '--dur-smooth', '--dur-bouncy', '--dur-fade'].forEach(function (n) { var v = cssVar(n); if (v) durs[(parseFloat(v) / (/ms/.test(v) ? 1000 : 1)).toFixed(3)] = 1; });
    durs['0.000'] = 1;
    Array.prototype.forEach.call(doc.styleSheets, function (ss) {
      var rules; try { rules = ss.cssRules; } catch (e) { return; }
      Array.prototype.forEach.call(rules || [], function (ru) { if (ru.type === 7 && ru.name !== 'cl-spin') err('장식 애니메이션 @keyframes ' + ru.name, null, 'transition + ease-* 토큰 또는 SangsangClarity.motion을 씁니다.'); });
    });
    var badDur = {};
    all(root, '*').forEach(function (el) {
      var cs = getComputedStyle(el);
      if (cs.animationName && cs.animationName !== 'none' && cs.animationName !== 'cl-spin') err('애니메이션 사용 ' + cs.animationName, el, 'transition 또는 SangsangClarity.motion으로 바꿉니다.');
      (cs.transitionDuration || '').split(',').forEach(function (d) { d = d.trim(); var s = (parseFloat(d) / (/ms/.test(d) ? 1000 : 1)).toFixed(3); if (d && !durs[s] && !badDur[s]) badDur[s] = el; });
    });
    Object.keys(badDur).forEach(function (s) { warn('토큰 밖 전환 시간 ' + s + 's', badDur[s], 'dur-* 토큰을 씁니다.'); });

    /* 5) 채움 버튼, 용어 */
    var groups = new Map();
    all(root, '.cl-btn--filled, .cl-btn--glass-prominent').forEach(function (b) {
      if (!visible(b)) return;
      var g = b.closest('section, header, nav, form, .cl-sheet, .cl-alert, dialog') || root;
      groups.set(g, (groups.get(g) || 0) + 1);
    });
    groups.forEach(function (n, g) { if (n > 1) warn('한 구획에 채움 버튼 ' + n + '개', g, '주요 행동 하나만 채움, 나머지는 .cl-btn--gray/--tinted.'); });
    var text = root.innerText || root.textContent || '';
    var bad = text.match(/학원|선생님/g);
    if (bad) err('금지 용어: ' + bad.filter(function (x, i, a) { return a.indexOf(x) === i; }).join(', '), null, '"에듀플렉스", "매니저"로 바꿉니다.');

    var result = { pass: errors.length === 0, theme: theme, errors: errors, warnings: warnings };
    if (window.console && console.groupCollapsed) {
      console.groupCollapsed('[SangsangClarity.audit] ' + (result.pass ? '통과' : '오류 ' + errors.length + '건') + ', 경고 ' + warnings.length + '건 (' + theme + ')');
      if (errors.length && console.table) console.table(errors);
      if (warnings.length && console.table) console.table(warnings);
      console.groupEnd();
    }
    return result;
  }
  NS.audit = audit;

  NS.init = function (root) {
    root = root || doc;
    [bindGlow, bindSegmented, bindTabs, bindNav, bindToggle, bindSlider, bindStepper, bindPopovers, bindContext, bindSwipe,
      bindSheet, bindSidebar, bindDate, bindToastTriggers, bindTable, bindSpark, bindCharts, bindThemeControls].forEach(function (f) {
      try { f(root); } catch (err) { if (window.console) console.warn('[SangsangClarity]', f.name, err); }
    });
    return NS;
  };
  window.SangsangClarity = NS;
  if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', function () { NS.init(); });
  else NS.init();
  /* 나중에 그려지는 화면도 자동으로 연결합니다(이미 연결된 요소는 건너뜀). */
  if (window.MutationObserver) {
    var pending = null;
    new MutationObserver(function (list) {
      if (!list.some(function (m) { return m.addedNodes.length; })) return;
      clearTimeout(pending); pending = setTimeout(function () { NS.init(); }, 40);
    }).observe(doc.documentElement, { childList: true, subtree: true });
  }
})();
