/* 상상플렉스 Clarity (Kit 06) — behaviors v5.0
   bundle.css의 컴포넌트에 동작과 키보드 접근성을 붙입니다. 의존성 없음.
   불러오면 문서가 준비되는 대로 자동으로 연결되고, 새로 그린 영역은 SangsangClarity.init(요소)로 다시 연결합니다.
   공개 API: SangsangClarity.init(root), .toast(message, options), .chart(element, config), .setTheme(light|dark|light-hc|dark-hc|auto), .setAccent(eduplex|green|ink), .motion(spring·animate·enter·exit·stagger·flip·tracker·project), .audit(root), .version */
(function () {
  'use strict';
  var NS = { version: '6.0' };
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
      var c = svg('circle', { cx: last[0], cy: last[1], r: 4, class: 'spark-end' });
      s.appendChild(c);
    });
  }

  /* ============ 차트 v6: 강조 하나, 나머지는 같은 색의 옅은 톤 ============
     type: bar | line | combo | stack | range | waterfall | bullet | barlist | dumbbell | heatmap | ring | share
     색은 역할로만 정합니다: focus(강조, cl-accent) · context(강조색의 옅은 톤) · ink(파생 선) · muted(비교·기타) · ref(기준선) · series(범주 chart-1…4).
     자세한 약속은 charts.md. */
  function nice(max) {
    if (max <= 0) return 1;
    var e = Math.pow(10, Math.floor(Math.log10(max))), f = max / e;
    return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10) * e;
  }
  function fmt(n) { var a = Math.abs(n); return a >= 1000 ? (Math.round(n / 100) / 10) + 'K' : String(Math.round(n * 10) / 10); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  var CHART_N = 0;
  var TONE = { focus: 'var(--chart-focus)', context: 'var(--chart-context)', ink: 'var(--chart-ink)', muted: 'var(--chart-muted)', ref: 'var(--chart-ref)' };
  function toneOf(t, si) { if (TONE[t]) return TONE[t]; var m = /^series(\d)$/.exec(t || ''); return 'var(--chart-' + (m ? m[1] : Math.min(si + 1, 4)) + ')'; }
  function sum(a) { return a.reduce(function (s, v) { return s + (v || 0); }, 0); }
  function derive(s, all) {
    if (!s.derive) return s.values;
    var src = all.filter(function (x) { return !x.derive; })[0].values, out = [];
    var m = /^movingAvg:(\d+)$/.exec(s.derive), k = m ? +m[1] : 0, acc = 0;
    src.forEach(function (v, i) {
      if (s.derive === 'cumulative') { acc += v; out.push(acc); }
      else if (k) { var w = src.slice(Math.max(0, i - k + 1), i + 1); out.push(w.length < k ? null : Math.round(sum(w) / w.length * 10) / 10); }
    });
    return out;
  }
  /* 강조할 위치: last(기본) | max | min | none | target | {index} | {category} | {categories:[]} */
  function emphasisMask(cfg, values, cats) {
    var e = cfg.emphasis == null ? 'last' : cfg.emphasis, n = values.length, mask = values.map(function () { return false; });
    var last = cfg.incomplete ? n - 2 : n - 1;
    if (e === 'none') return values.map(function () { return true; });
    if (e === 'last') mask[last] = true;
    else if (e === 'max' || e === 'min') { var vv = values.slice(0, cfg.incomplete ? n - 1 : n), t = Math[e].apply(null, vv); vv.forEach(function (v, i) { if (v === t) mask[i] = true; }); }
    else if (e === 'target') { var tr = (cfg.rules || []).filter(function (r) { return r.kind === 'target'; })[0]; values.forEach(function (v, i) { mask[i] = tr ? v >= tr.value : false; }); }
    else if (typeof e === 'object') {
      if (e.index != null) mask[e.index] = true;
      (e.categories || (e.category != null ? [e.category] : [])).forEach(function (c) { var i = cats.indexOf(c); if (i >= 0) mask[i] = true; });
    }
    return mask;
  }
  function rpath(x, y, w, h, r, ends) {
    /* ends: 'top' 막대 끝만 둥글게(기준선 쪽은 각지게) | 'right' 가로 막대 | 'all' 떠 있는 막대 */
    if (h <= 0 || w <= 0) return '';
    r = Math.max(0, Math.min(r, w / 2, h / (ends === 'all' ? 2 : 1)));
    if (ends === 'right') { r = Math.min(r, h / 2); return 'M' + x + ' ' + y + ' H' + (x + w - r) + ' Q' + (x + w) + ' ' + y + ' ' + (x + w) + ' ' + (y + r) + ' V' + (y + h - r) + ' Q' + (x + w) + ' ' + (y + h) + ' ' + (x + w - r) + ' ' + (y + h) + ' H' + x + ' Z'; }
    var bl = ends === 'all' ? r : 0;
    return 'M' + x + ' ' + (y + h - bl) + ' V' + (y + r) + ' Q' + x + ' ' + y + ' ' + (x + r) + ' ' + y + ' H' + (x + w - r) + ' Q' + (x + w) + ' ' + y + ' ' + (x + w) + ' ' + (y + r) +
      ' V' + (y + h - bl) + (bl ? ' Q' + (x + w) + ' ' + (y + h) + ' ' + (x + w - bl) + ' ' + (y + h) + ' H' + (x + bl) + ' Q' + x + ' ' + (y + h) + ' ' + x + ' ' + (y + h - bl) : ' H' + x) + ' Z';
  }
  function txt(parent, x, y, s, cls, anchor) { var t = svg('text', { x: x, y: y, class: cls || 'tick', 'text-anchor': anchor || 'start' }); t.textContent = s; parent.appendChild(t); return t; }

  NS.chart = function (el, cfg) {
    cfg = cfg || JSON.parse(el.getAttribute('data-chart'));
    el.clChart = cfg;
    if (cfg.labelMax && cfg.emphasis == null) cfg.emphasis = 'max'; /* v5 이전 설정 호환 */
    var id = 'clc' + (++CHART_N), type = cfg.type || 'bar', unit = cfg.unit || '';
    var host = el.querySelector('.cl-chart__plot');
    if (!host) { host = doc.createElement('div'); host.className = 'cl-chart__plot'; el.appendChild(host); }
    host.style.position = 'relative'; host.innerHTML = '';
    var W = Math.max(280, host.clientWidth || el.clientWidth - 40);
    var tip = doc.createElement('div'); tip.className = 'cl-chart__tip cl-glass cl-glass--thick'; tip.setAttribute('role', 'status');
    var legendItems = [], table = { head: [], rows: [] }, summary = [];
    function showTip(html, px, py, Wd) {
      tip.innerHTML = html; tip.setAttribute('data-show', 'true');
      var tw = tip.offsetWidth, left = Math.min(Math.max(0, px - tw / 2), (Wd || W) - tw);
      tip.style.left = left + 'px'; tip.style.top = Math.max(0, py - tip.offsetHeight - 12) + 'px';
    }
    function hideTip() { tip.setAttribute('data-show', 'false'); }
    function key(color, kind) { return '<span class="cl-chart__key' + (kind ? ' cl-chart__key--' + kind : '') + '" style="--k:' + color + '"></span>'; }
    function row(color, name, val, kind) { return '<div>' + key(color, kind) + '<span>' + esc(name) + '</span><span>' + esc(val) + '</span></div>'; }
    var root, H;
    var R = {
      bar: axisChart, line: axisChart, combo: axisChart, stack: axisChart, range: axisChart, waterfall: axisChart,
      bullet: bulletChart, barlist: barlistChart, dumbbell: dumbbellChart, heatmap: heatmapChart, ring: ringChart, share: shareChart
    }[type] || axisChart;
    R();
    host.appendChild(root); host.appendChild(tip);
    root.setAttribute('role', 'img');
    root.setAttribute('aria-label', (cfg.title || '차트') + (summary.length ? '. ' + summary.join(' ') : '') + ' 자세한 값은 표로 보기에 있습니다.');
    var legend = el.querySelector('.cl-chart__legend');
    if (legend) legend.innerHTML = legendItems.map(function (l) { return '<li>' + key(l.color, l.kind) + esc(l.name) + '</li>'; }).join('');
    var det = el.querySelector('details.cl-chart__table');
    if (!det) { det = doc.createElement('details'); det.className = 'cl-chart__table'; el.appendChild(det); }
    var wasOpen = det.open;
    det.innerHTML = '<summary>표로 보기</summary><div class="cl-table-wrap" style="--table-max:260px;margin-top:8px"><table class="cl-table"><thead><tr>' +
      table.head.map(function (h, i) { return '<th scope="col"' + (i ? ' class="num"' : '') + '>' + esc(h) + '</th>'; }).join('') + '</tr></thead><tbody>' +
      table.rows.map(function (r) { return '<tr>' + r.map(function (c, i) { return i ? '<td class="num">' + esc(c) + '</td>' : '<th scope="row">' + esc(c) + '</th>'; }).join('') + '</tr>'; }).join('') + '</tbody></table></div>';
    det.open = wasOpen;

    /* ---------- 축이 있는 차트: 막대, 선, 콤보, 누적, 범위, 증감 ---------- */
    function axisChart() {
      var cats = cfg.categories, S0 = cfg.series || [], panel = cfg.panel;
      var S = S0.map(function (s, si) { return { s: s, i: si, v: derive(s, S0), mark: s.mark || (type === 'line' ? 'line' : type === 'combo' ? (si === 0 ? 'bar' : 'line') : 'bar') }; });
      var rules = (cfg.rules || []).slice(), base = S.filter(function (x) { return x.mark === 'bar'; })[0] || S[0];
      if (cfg.average && base) { var vv = base.v.slice(0, cfg.incomplete ? base.v.length - 1 : base.v.length); rules.push({ kind: 'average', value: Math.round(sum(vv) / vv.length * 10) / 10, label: '평균' }); }
      var ph = cfg.height || 220, pnH = panel ? (panel.height || 96) : 0, gap = panel ? 46 : 0;
      var hasLine = S.some(function (x) { return x.mark !== 'bar'; });
      H = ph + gap + pnH + 26;
      /* 오른쪽 여백: 선 끝 값 라벨, 또는 막대 차트의 기준선 라벨 자리 */
      var M = { l: 40, r: hasLine ? 52 : rules.length ? 68 : 12, t: 18, b: 26 };
      var iw = W - M.l - M.r, ih = ph - M.t, band = iw / cats.length;
      var lo = 0, hi = 0;
      if (type === 'stack') cats.forEach(function (c, ci) { hi = Math.max(hi, sum(S.map(function (x) { return x.v[ci]; }))); });
      else if (type === 'range') S.forEach(function (x) { x.v.forEach(function (p) { hi = Math.max(hi, p[1]); lo = Math.min(lo, p[0]); }); });
      else if (type === 'waterfall') { var run = 0; S[0].v.forEach(function (v, i) { run = (cfg.totals || []).indexOf(i) >= 0 ? v : run + v; hi = Math.max(hi, run, (cfg.totals || []).indexOf(i) >= 0 ? v : 0); lo = Math.min(lo, run); }); }
      else S.forEach(function (x) { x.v.forEach(function (v) { if (v != null) { hi = Math.max(hi, v); lo = Math.min(lo, v); } }); });
      rules.forEach(function (r) { hi = Math.max(hi, r.value); });
      if (cfg.band) hi = Math.max(hi, cfg.band.to);
      if (cfg.yMax) hi = cfg.yMax;
      if (type === 'range' && cfg.yMin != null) lo = cfg.yMin;
      var stepV = nice((hi - lo) / 4), max = stepV * Math.ceil(hi / stepV), min = lo < 0 ? -stepV * Math.ceil(-lo / stepV) : (type === 'range' && cfg.yMin != null ? cfg.yMin : 0);
      var y = function (v) { return M.t + ih - ((v - min) / (max - min)) * ih; };
      var X = function (ci) { return M.l + band * ci + band / 2; };
      root = svg('svg', { viewBox: '0 0 ' + W + ' ' + H });
      var defs = svg('defs', {}); root.appendChild(defs);
      var pat = svg('pattern', { id: id + 'h', width: 6, height: 6, patternUnits: 'userSpaceOnUse', patternTransform: 'rotate(45)' });
      pat.appendChild(svg('rect', { width: 6, height: 6, fill: 'var(--chart-context)' }));
      pat.appendChild(svg('line', { x1: 0, y1: 0, x2: 0, y2: 6, stroke: 'var(--chart-focus)', 'stroke-width': 2 }));
      defs.appendChild(pat);
      var hl = svg('rect', { class: 'colhi', y: M.t, height: ih, width: band, rx: 8 }); root.appendChild(hl);
      var grid = svg('g', { class: 'grid' }); root.appendChild(grid);
      for (var v = min; v <= max + 1e-9; v += stepV) {
        var yy = Math.round(y(v)) + 0.5;
        grid.appendChild(svg('line', { x1: M.l, x2: W - M.r, y1: yy, y2: yy, class: v === 0 ? 'zero' : '' }));
        txt(grid, M.l - 8, yy + 4, fmt(v), 'tick', 'end');
      }
      if (unit) txt(root, M.l - 8, 10, '(' + unit + ')', 'tick', 'end');
      var labelEvery = Math.ceil(cats.length / Math.max(1, Math.floor(iw / 44)));
      cats.forEach(function (c, ci) { if (ci % labelEvery === 0 || ci === cats.length - 1) txt(root, X(ci), ph + 2 + 14, c, 'tick', 'middle'); });
      if (cfg.band) {
        var b = cfg.band, by = y(b.to);
        root.insertBefore(svg('rect', { x: M.l, y: by, width: iw, height: y(b.from) - by, class: 'band' }), grid.nextSibling);
        if (b.label) txt(root, M.l + 6, by + 13, b.label, 'rlbl');
      }
      var marks = svg('g', {}); root.appendChild(marks);
      var focusMask = null, singleBar = S.filter(function (x) { return x.mark === 'bar'; }).length === 1 && type !== 'stack' && type !== 'waterfall';
      var barsS = S.filter(function (x) { return x.mark === 'bar'; }), nb = barsS.length;
      var bw = Math.min(type === 'range' ? 10 : 24, (band * (nb > 1 ? 0.72 : 0.56) - (nb - 1) * 2) / Math.max(1, nb));
      if (type === 'stack') bw = Math.min(28, band * 0.56);
      var focusSeries = cfg.emphasis && cfg.emphasis.series;
      /* 막대 */
      if (type === 'stack') {
        cats.forEach(function (c, ci) {
          var acc = 0, x = X(ci) - bw / 2;
          S.forEach(function (x2, si) {
            var v = x2.v[ci] || 0; if (!v) return;
            var y0 = y(acc), y1 = y(acc + v), top = si === S.length - 1 || !S.slice(si + 1).some(function (z) { return z.v[ci]; });
            var hgt = y0 - y1 - (acc > 0 ? 2 : 0);
            marks.appendChild(svg('path', { d: rpath(x, y1, bw, Math.max(0, hgt), top ? 4 : 0, 'top'), fill: toneOf(x2.s.tone || 'series' + Math.min(si + 1, 5), si), class: 'mk', opacity: focusSeries && focusSeries !== x2.s.name ? 0.32 : 1 }));
            acc += v;
          });
        });
      } else if (type === 'range') {
        var rs = S[0], mask = emphasisMask(cfg, rs.v.map(function (p) { return p[1]; }), cats);
        rs.v.forEach(function (p, ci) {
          var t = y(p[1]), btm = y(p[0]), x = X(ci) - bw / 2;
          marks.appendChild(svg('rect', { x: x, y: t, width: bw, height: Math.max(bw, btm - t), rx: bw / 2, fill: mask[ci] ? TONE.focus : TONE.context, class: 'mk' }));
          if (rs.s.mid) { var my = y(rs.s.mid[ci]); marks.appendChild(svg('circle', { cx: X(ci), cy: my, r: 3, fill: 'var(--cl-surface)' })); }
          if (mask[ci]) { txt(marks, X(ci), t - 6, p[0] + '–' + p[1] + unit, 'lbl', 'middle'); }
        });
        focusMask = mask;
      } else if (type === 'waterfall') {
        var run = 0, tot = cfg.totals || [0, S[0].v.length - 1], prevTop = null;
        S[0].v.forEach(function (v, ci) {
          var isT = tot.indexOf(ci) >= 0, from = isT ? 0 : run, to = isT ? v : run + v; run = to;
          var a = Math.min(y(from), y(to)), h = Math.abs(y(from) - y(to)), x = X(ci) - bw / 2;
          var fill = isT ? TONE.focus : v >= 0 ? 'var(--chart-2)' : 'var(--chart-4)';
          marks.appendChild(svg('path', { d: rpath(x, a, bw, Math.max(1, h), 3, isT ? 'top' : 'all'), fill: fill, class: 'mk' }));
          if (prevTop != null) marks.appendChild(svg('line', { x1: x - (band - bw), x2: x, y1: Math.round(y(prevTop)) + .5, y2: Math.round(y(prevTop)) + .5, class: 'conn' }));
          prevTop = to;
          txt(marks, X(ci), a - 6, isT ? fmt(v) : (v > 0 ? '▲' + fmt(v) : '▼' + fmt(-v)), 'lbl', 'middle');
        });
      } else {
        barsS.forEach(function (x2, bi) {
          var mask = emphasisMask(cfg, x2.v, cats);
          if (singleBar) focusMask = mask;
          x2.v.forEach(function (v, ci) {
            if (v == null) return;
            var x = X(ci) - (nb * bw + (nb - 1) * 2) / 2 + bi * (bw + 2), top = y(Math.max(0, v)), bot = y(Math.min(0, v));
            var inc = cfg.incomplete && ci === x2.v.length - 1;
            var fill = singleBar ? (inc ? 'url(#' + id + 'h)' : mask[ci] ? TONE.focus : TONE.context) : toneOf(x2.s.tone || 'series', x2.i);
            var op = !singleBar && (focusSeries ? focusSeries !== x2.s.name : (cfg.emphasis && typeof cfg.emphasis === 'object' && (cfg.emphasis.category != null || cfg.emphasis.index != null) && !mask[ci])) ? 0.32 : 1;
            marks.appendChild(svg('path', { d: rpath(x, top, bw, bot - top, 4, 'top'), fill: fill, opacity: op, class: 'mk' }));
            if (singleBar && (mask[ci] && cfg.labels !== 'none' && cfg.emphasis !== 'none' || cfg.labels === 'all')) txt(marks, x + bw / 2, top - 6, fmt(v) + unit, 'lbl', 'middle');
            if (inc) txt(marks, x + bw / 2, top - 6, '진행 중', 'tick', 'middle');
          });
        });
      }
      /* 기준선: 목표(실선) · 평균(점선) */
      rules.forEach(function (r) {
        var ry = Math.round(y(r.value)) + 0.5;
        marks.appendChild(svg('line', { x1: M.l, x2: W - M.r, y1: ry, y2: ry, class: 'rule rule--' + (r.kind || 'target') }));
        var rl = (r.label || (r.kind === 'average' ? '평균' : '목표')) + ' ' + fmt(r.value) + unit;
        /* 막대만 있으면 오른쪽 여백에, 선이 있으면(끝 값 라벨과 겹치지 않게) 왼쪽 위에 둡니다. */
        if (hasLine) txt(marks, M.l + 4, ry - 5, rl, 'rlbl'); else { txt(marks, W - M.r + 6, ry - 1, rl.split(' ')[0], 'rlbl'); txt(marks, W - M.r + 6, ry + 12, fmt(r.value) + unit, 'rlbl'); }
        summary.push((r.label || '기준') + ' ' + r.value + unit + '.');
      });
      /* 선·면·점 */
      var lineS = S.filter(function (x) { return x.mark !== 'bar'; });
      var endLabels = [];
      lineS.forEach(function (x2) {
        var multi = type === 'line' && lineS.length > 1;
        var t = x2.s.tone || (type === 'combo' ? 'ink' : multi ? 'series' : 'focus');
        if (multi && focusSeries) t = focusSeries === x2.s.name ? (x2.s.tone || 'series') : 'muted';
        var col = toneOf(t, x2.i), pts = [];
        x2.v.forEach(function (v, i) { if (v != null) pts.push([X(i), y(v), i]); });
        if (!pts.length) return;
        var inc = cfg.incomplete && type === 'line' && pts.length > 1 && pts[pts.length - 1][2] === cats.length - 1;
        var solid = inc ? pts.slice(0, -1) : pts;
        if ((x2.mark === 'area' || (cfg.area && lineS.length === 1)) && solid.length > 1)
          {
            /* 면: 선 쪽 16%에서 기준선 쪽 0%로 사라지는 옅은 그라데이션 */
            var gid = id + 'g' + x2.i, lg = svg('linearGradient', { id: gid, x1: 0, y1: 0, x2: 0, y2: 1 });
            lg.appendChild(svg('stop', { offset: '0%', 'stop-color': col, 'stop-opacity': 0.16 }));
            lg.appendChild(svg('stop', { offset: '100%', 'stop-color': col, 'stop-opacity': 0 }));
            defs.appendChild(lg);
            marks.appendChild(svg('path', { d: 'M' + pts[0][0] + ' ' + y(Math.max(0, min)) + ' L' + pts.map(function (p) { return p[0] + ' ' + p[1]; }).join(' L') + ' L' + pts[pts.length - 1][0] + ' ' + y(Math.max(0, min)) + ' Z', fill: 'url(#' + gid + ')' }));
          }
        if (x2.mark !== 'point') {
          var thin = multi && focusSeries && focusSeries !== x2.s.name;
          marks.appendChild(svg('path', { d: 'M' + solid.map(function (p) { return p[0] + ' ' + p[1]; }).join(' L'), class: 'line' + (thin ? ' line--thin' : '') + (x2.s.dashed ? ' line--dash' : ''), stroke: col }));
          if (inc) marks.appendChild(svg('path', { d: 'M' + solid[solid.length - 1][0] + ' ' + solid[solid.length - 1][1] + ' L' + pts[pts.length - 1][0] + ' ' + pts[pts.length - 1][1], class: 'line line--dash', stroke: col }));
        }
        if (x2.mark === 'point' || type === 'combo') pts.forEach(function (p) { marks.appendChild(svg('circle', { cx: p[0], cy: p[1], r: 3.5, class: 'dot', fill: col })); });
        var lp = pts[pts.length - 1];
        marks.appendChild(svg('circle', { cx: lp[0], cy: lp[1], r: 4.5, class: 'dot' + (inc ? ' dot--open' : ''), fill: inc ? 'var(--cl-surface)' : col, stroke: inc ? col : null }));
        if (lineS.length <= 4) endLabels.push({ y: lp[1], x: lp[0], s: fmt(x2.v[lp[2]]) + unit });
      });
      endLabels.sort(function (a, b) { return a.y - b.y; });
      for (var k = 1; k < endLabels.length; k++) if (endLabels[k].y - endLabels[k - 1].y < 14) endLabels[k].y = endLabels[k - 1].y + 14;
      endLabels.forEach(function (l) { txt(marks, l.x + 9, l.y + 4, l.s, 'lbl'); });
      /* 맞춘 아래 칸: 단위가 다른 두 번째 지표. y축을 겹치지 않고 x만 공유합니다. */
      var py = null, pTop = ph + gap, pS = [];
      if (panel) {
        pS = panel.series.map(function (s, si) { return { s: s, v: s.values }; });
        var pmaxRaw = panel.yMax || Math.max.apply(null, pS.map(function (x) { return Math.max.apply(null, x.v.filter(function (v) { return v != null; })); }).concat((panel.rules || []).map(function (r) { return r.value; })));
        var pmin = (panel.type || 'line') === 'bar' ? 0 : (panel.yMin || 0);
        var pst = nice((pmaxRaw - pmin) / 2), pmax = pst * Math.ceil(pmaxRaw / pst);
        py = function (v) { return pTop + pnH - ((v - pmin) / (pmax - pmin)) * (pnH - 8); };
        var pg = svg('g', { class: 'grid' }); root.appendChild(pg);
        for (var pv = pmin; pv <= pmax + 1e-9; pv += pst) { var pyy = Math.round(py(pv)) + .5; pg.appendChild(svg('line', { x1: M.l, x2: W - M.r, y1: pyy, y2: pyy })); txt(pg, M.l - 8, pyy + 4, fmt(pv), 'tick', 'end'); }
        txt(root, M.l, pTop - 8, (panel.title || '') + (panel.unit ? ' (' + panel.unit + ')' : ''), 'ptitle');
        (panel.rules || []).forEach(function (r) { var ry = Math.round(py(r.value)) + .5; root.appendChild(svg('line', { x1: M.l, x2: W - M.r, y1: ry, y2: ry, class: 'rule rule--' + (r.kind || 'target') })); txt(root, M.l + 4, ry - 5, (r.label || '목표') + ' ' + fmt(r.value) + (panel.unit || ''), 'rlbl'); });
        pS.forEach(function (x2, si) {
          var col = toneOf(x2.s.tone || (si ? 'muted' : 'ink'), si), pts = [];
          x2.v.forEach(function (v, i) { if (v != null) pts.push([X(i), py(v), i]); });
          if ((panel.type || 'line') === 'bar') pts.forEach(function (p) { var bw2 = Math.min(12, band * .4); root.appendChild(svg('path', { d: rpath(p[0] - bw2 / 2, p[1], bw2, py(0) - p[1], 3, 'top'), fill: col, class: 'mk' })); });
          else { root.appendChild(svg('path', { d: 'M' + pts.map(function (p) { return p[0] + ' ' + p[1]; }).join(' L'), class: 'line', stroke: col })); pts.forEach(function (p) { root.appendChild(svg('circle', { cx: p[0], cy: p[1], r: 3.5, class: 'dot', fill: col })); }); }
          var lp = pts[pts.length - 1]; txt(root, lp[0] + 9, lp[1] + 4, fmt(x2.v[lp[2]]) + (panel.unit || ''), 'lbl');
        });
        hl.setAttribute('height', pTop + pnH - M.t);
      }
      /* 범례: 2계열 이상, 기준선·진행 중 표시 포함 */
      var named = S.concat(pS.map(function (x, i) { return { s: x.s, i: i, mark: (panel.type || 'line'), panel: true }; }));
      if (type === 'stack' || (S.length + pS.length) > 1) named.forEach(function (x2) {
        var t = x2.panel ? toneOf(x2.s.tone || (x2.i ? 'muted' : 'ink'), x2.i) : (singleBar && x2.mark === 'bar') ? TONE.focus : toneOf(x2.s.tone || (type === 'combo' && x2.mark !== 'bar' ? 'ink' : type === 'stack' ? 'series' + Math.min(x2.i + 1, 5) : 'series'), x2.i);
        if (!x2.panel && type === 'line' && focusSeries && focusSeries !== x2.s.name) t = TONE.muted;
        if (!x2.panel && type === 'line' && S.length === 1) t = toneOf(x2.s.tone || 'focus', 0);
        legendItems.push({ name: x2.s.name, color: t, kind: x2.mark === 'bar' ? '' : 'line' });
      });
      if (cfg.incomplete) legendItems.push({ name: '진행 중', color: TONE.focus, kind: hasLine && !singleBar ? 'avg' : 'hatch' });
      rules.forEach(function (r) { legendItems.push({ name: r.label || (r.kind === 'average' ? '평균' : '목표'), color: 'var(--chart-ref)', kind: r.kind === 'average' ? 'avg' : 'rule' }); });
      /* 값 살펴보기: 열 전체가 대상, 키보드 좌우 */
      var ov = svg('rect', { x: M.l, y: M.t, width: iw, height: (panel ? pTop + pnH : ph) - M.t, fill: 'transparent', tabindex: 0, class: 'hit', 'aria-label': '값 살펴보기, 좌우 화살표' });
      var cur = cats.length - 1;
      function valStr(x2, ci) { var v = x2.v[ci]; if (v == null) return '–'; if (type === 'range') return v[0] + '–' + v[1] + unit; return fmt(v) + unit; }
      function at(ci) {
        cur = ci; hl.setAttribute('x', M.l + band * ci); hl.style.opacity = 1;
        var h = '<b>' + esc(cats[ci]) + (cfg.incomplete && ci === cats.length - 1 ? ' · 진행 중' : '') + '</b>';
        S.forEach(function (x2) { h += row(type === 'stack' ? toneOf(x2.s.tone || 'series' + Math.min(x2.i + 1, 5), x2.i) : x2.mark === 'bar' && singleBar ? TONE.focus : type === 'line' && focusSeries && focusSeries !== x2.s.name ? TONE.muted : toneOf(x2.s.tone || (type === 'combo' && x2.mark !== 'bar' ? 'ink' : type === 'line' && S.length === 1 ? 'focus' : 'series'), x2.i), x2.s.name, valStr(x2, ci), x2.mark === 'bar' ? '' : 'line'); });
        if (type === 'stack') h += row('transparent', '합계', fmt(sum(S.map(function (x2) { return x2.v[ci] || 0; }))) + unit);
        pS.forEach(function (x2, si) { h += row(toneOf(x2.s.tone || (si ? 'muted' : 'ink'), si), x2.s.name, x2.v[ci] == null ? '–' : fmt(x2.v[ci]) + (panel.unit || ''), 'line'); });
        rules.forEach(function (r) {
          var bv = base && typeof base.v[ci] === 'number' ? base.v[ci] : null;
          var d = bv == null ? '' : (bv - r.value >= 0 ? ' ▲' : ' ▼') + fmt(Math.abs(bv - r.value));
          h += row('var(--chart-ref)', (r.label || (r.kind === 'average' ? '평균' : '목표')) + ' 대비', d.trim() || '–', r.kind === 'average' ? 'avg' : 'rule');
        });
        showTip(h, X(ci), M.t + 4);
      }
      function off() { hl.style.opacity = 0; hideTip(); }
      ov.addEventListener('mousemove', function (e) { var r = root.getBoundingClientRect(), sx = (e.clientX - r.left) * (W / r.width); at(Math.max(0, Math.min(cats.length - 1, Math.floor((sx - M.l) / band)))); });
      ov.addEventListener('mouseleave', off); ov.addEventListener('blur', off); ov.addEventListener('focus', function () { at(cur); });
      ov.addEventListener('keydown', function (e) { if (e.key === 'ArrowRight') { e.preventDefault(); at(Math.min(cats.length - 1, cur + 1)); } if (e.key === 'ArrowLeft') { e.preventDefault(); at(Math.max(0, cur - 1)); } if (e.key === 'Escape') off(); });
      root.appendChild(ov);
      /* 표, 요약 */
      table.head = ['구분'].concat(S.map(function (x) { return x.s.name + (unit ? '(' + unit + ')' : ''); }), pS.map(function (x) { return x.s.name + (panel.unit ? '(' + panel.unit + ')' : ''); }));
      table.rows = cats.map(function (c, ci) { return [c].concat(S.map(function (x) { var v = x.v[ci]; return v == null ? '–' : type === 'range' ? v[0] + '–' + v[1] : String(v); }), pS.map(function (x) { return x.v[ci] == null ? '–' : String(x.v[ci]); })); });
      if (base && type !== 'range' && type !== 'stack') {
        var li = cfg.incomplete ? cats.length - 2 : cats.length - 1;
        summary.unshift(cats[li] + ' ' + base.s.name + ' ' + base.v[li] + unit + '.');
      }
      if (focusMask && cfg.emphasis && cfg.emphasis !== 'last') summary.push('강조: ' + cats.filter(function (c, i) { return focusMask[i]; }).join(', ') + '.');
    }

    /* ---------- 불릿: 목표 대비 달성(게이지 대신) ---------- */
    function bulletChart() {
      var items = cfg.items, rh = 44, lw = Math.min(120, W * 0.3), M = { l: lw, r: 64 }, iw = W - M.l - M.r;
      H = items.length * rh + 8;
      root = svg('svg', { viewBox: '0 0 ' + W + ' ' + H });
      table.head = ['항목', '실적' + (unit ? '(' + unit + ')' : ''), '목표', '달성'];
      items.forEach(function (it, i) {
        var max = it.max || cfg.max || Math.max(it.target, it.value) * 1.15, x = function (v) { return M.l + (v / max) * iw; };
        var y0 = i * rh + 8, g = svg('g', { tabindex: 0, class: 'rowhit', 'aria-label': it.label + ' ' + it.value + unit + ', 목표 ' + it.target + unit });
        txt(g, 0, y0 + 16, it.label, 'rname');
        g.appendChild(svg('rect', { x: M.l, y: y0 + 6, width: iw, height: 14, rx: 7, class: 'track' }));
        (it.bands || cfg.bands || []).forEach(function (b, bi) { g.appendChild(svg('rect', { x: M.l, y: y0 + 6, width: Math.max(0, x(b) - M.l), height: 14, rx: 7, class: 'qband', opacity: 1 - bi * 0.35 })); });
        var met = it.value >= it.target;
        g.appendChild(svg('path', { d: rpath(M.l, y0 + 9, Math.max(4, x(Math.min(it.value, max)) - M.l), 8, 4, 'right'), fill: met ? TONE.focus : TONE.context, class: 'mk' }));
        var tx = Math.round(x(it.target)) + .5; g.appendChild(svg('line', { x1: tx, x2: tx, y1: y0 + 2, y2: y0 + 24, class: 'tgt' }));
        txt(g, W - M.r + 10, y0 + 17, fmt(it.value) + unit, 'lbl');
        txt(g, M.l, y0 + 38, met ? '목표 ' + fmt(it.target) + unit + ' 달성' : '목표까지 ▼' + fmt(it.target - it.value) + unit, met ? 'tick' : 'tick tick--warn');
        g.addEventListener('mouseenter', function () { showTip('<b>' + esc(it.label) + '</b>' + row(met ? TONE.focus : TONE.context, '실적', fmt(it.value) + unit) + row('var(--chart-ref)', '목표', fmt(it.target) + unit, 'rule'), x(it.value), y0); });
        g.addEventListener('focus', function () { g.dispatchEvent(new Event('mouseenter')); });
        g.addEventListener('mouseleave', hideTip); g.addEventListener('blur', hideTip);
        root.appendChild(g);
        table.rows.push([it.label, String(it.value), String(it.target), Math.round(it.value / it.target * 100) + '%']);
      });
      legendItems.push({ name: '달성', color: TONE.focus }, { name: '미달', color: TONE.context }, { name: '목표', color: 'var(--chart-ref)', kind: 'rule' });
    }

    /* ---------- 막대 목록: 순위(정렬 기본, 강조 1~2개) ---------- */
    function barlistChart() {
      var items = cfg.items.slice(); if (cfg.sort !== false) items.sort(function (a, b) { return b.value - a.value; });
      var max = cfg.max || items[0].value, rh = 38, mask = emphasisMask({ emphasis: cfg.emphasis == null ? 'max' : cfg.emphasis, rules: cfg.rules }, items.map(function (x) { return x.value; }), items.map(function (x) { return x.label; }));
      H = items.length * rh;
      root = svg('svg', { viewBox: '0 0 ' + W + ' ' + H });
      table.head = ['항목', '값' + (unit ? '(' + unit + ')' : '')];
      items.forEach(function (it, i) {
        var y0 = i * rh, g = svg('g', { tabindex: 0, class: 'rowhit', 'aria-label': it.label + ' ' + it.value + unit });
        txt(g, 0, y0 + 15, it.label, mask[i] ? 'rname rname--strong' : 'rname');
        txt(g, W, y0 + 15, fmt(it.value) + unit, mask[i] ? 'lbl' : 'tick', 'end');
        g.appendChild(svg('rect', { x: 0, y: y0 + 22, width: W, height: 6, rx: 3, class: 'track' }));
        g.appendChild(svg('rect', { x: 0, y: y0 + 22, width: Math.max(6, W * it.value / max), height: 6, rx: 3, fill: mask[i] ? TONE.focus : TONE.context, class: 'mk' }));
        root.appendChild(g);
        table.rows.push([it.label, String(it.value)]);
      });
    }

    /* ---------- 덤벨: 전 → 후 ---------- */
    function dumbbellChart() {
      var items = cfg.items, rh = 36, lw = Math.min(110, W * 0.28), M = { l: lw, r: 56 }, iw = W - M.l - M.r;
      var lo = cfg.min != null ? cfg.min : 0, hi = cfg.max || Math.max.apply(null, items.map(function (x) { return Math.max(x.from, x.to); }));
      var x = function (v) { return M.l + ((v - lo) / (hi - lo)) * iw; };
      H = items.length * rh + 24;
      root = svg('svg', { viewBox: '0 0 ' + W + ' ' + H });
      var g0 = svg('g', { class: 'grid' }); root.appendChild(g0);
      var st = nice((hi - lo) / 4);
      for (var v = lo; v <= hi + 1e-9; v += st) { var xx = Math.round(x(v)) + .5; g0.appendChild(svg('line', { x1: xx, x2: xx, y1: 0, y2: H - 20 })); txt(g0, xx, H - 4, fmt(v), 'tick', 'middle'); }
      table.head = ['항목', cfg.fromLabel || '이전', cfg.toLabel || '이후', '변화'];
      items.forEach(function (it, i) {
        var cy = i * rh + rh / 2, up = it.to >= it.from, g = svg('g', { tabindex: 0, class: 'rowhit', 'aria-label': it.label + ' ' + it.from + '에서 ' + it.to + unit });
        txt(g, 0, cy + 4, it.label, 'rname');
        g.appendChild(svg('line', { x1: x(it.from), x2: x(it.to), y1: cy, y2: cy, class: 'stem' }));
        g.appendChild(svg('circle', { cx: x(it.from), cy: cy, r: 5, class: 'dot', fill: TONE.context }));
        g.appendChild(svg('circle', { cx: x(it.to), cy: cy, r: 5.5, class: 'dot', fill: TONE.focus }));
        txt(g, W - M.r + 12, cy + 4, (up ? '▲' : '▼') + fmt(Math.abs(it.to - it.from)) + unit, up ? 'lbl' : 'lbl lbl--warn');
        root.appendChild(g);
        table.rows.push([it.label, String(it.from), String(it.to), (up ? '+' : '') + (it.to - it.from)]);
      });
      legendItems.push({ name: cfg.fromLabel || '이전', color: TONE.context, kind: 'dot' }, { name: cfg.toLabel || '이후', color: TONE.focus, kind: 'dot' });
    }

    /* ---------- 달력 히트맵: 날마다의 양(한 색 명도 5단계) ---------- */
    function heatmapChart() {
      var start = new Date(cfg.start + 'T00:00:00'), vals = cfg.values, cell = 14, gp = 3, dow = (start.getDay() + 6) % 7;
      var weeks = Math.ceil((vals.length + dow) / 7), lw = 22;
      var mx = cfg.max || Math.max.apply(null, vals.filter(function (v) { return v != null; }));
      H = 7 * (cell + gp) + 22; var w = lw + weeks * (cell + gp);
      root = svg('svg', { viewBox: '0 0 ' + Math.max(W, w) + ' ' + H });
      ['월', '', '수', '', '금', '', ''].forEach(function (d, i) { if (d) txt(root, 0, 18 + i * (cell + gp) + 10, d, 'tick'); });
      var todayIdx = cfg.today != null ? cfg.today : vals.length - 1, lastMonth = -1;
      table.head = ['날짜', '값' + (unit ? '(' + unit + ')' : '')];
      vals.forEach(function (v, i) {
        var k = i + dow, cx = lw + Math.floor(k / 7) * (cell + gp), cy = 18 + (k % 7) * (cell + gp), d = new Date(start.getTime() + i * 864e5);
        if (d.getMonth() !== lastMonth && d.getDate() <= 7) { lastMonth = d.getMonth(); txt(root, cx, 10, (d.getMonth() + 1) + '월', 'tick'); }
        var lvl = v == null ? -1 : v === 0 ? 0 : Math.min(4, Math.ceil(v / mx * 4));
        var r = svg('rect', { x: cx, y: cy, width: cell, height: cell, rx: 3, class: 'hm hm--' + lvl + (i === todayIdx ? ' hm--today' : ''), tabindex: i === todayIdx ? 0 : -1 });
        var label = (d.getMonth() + 1) + '월 ' + d.getDate() + '일';
        r.setAttribute('aria-label', label + ' ' + (v == null ? '기록 없음' : v + unit));
        r.addEventListener('mouseenter', function () { showTip('<b>' + label + '</b>' + row('var(--chart-seq-' + Math.max(1, lvl) + ')', cfg.seriesName || '값', v == null ? '기록 없음' : fmt(v) + unit), cx + cell / 2, cy, Math.max(W, w)); });
        r.addEventListener('mouseleave', hideTip);
        root.appendChild(r);
        table.rows.push([label, v == null ? '–' : String(v)]);
      });
      legendItems.push({ name: '적음', color: 'var(--chart-seq-1)' }, { name: '많음', color: 'var(--chart-seq-4)' }, { name: '오늘', color: 'transparent', kind: 'today' });
    }

    /* ---------- 링: 하나의 지표를 목표 대비(최대 3겹, 피트니스 링 방식) ---------- */
    function ringChart() {
      var rings = cfg.rings.slice(0, 3), sz = Math.min(W, cfg.size || 168), c = sz / 2, sw = sz * 0.11, gapR = 3;
      H = sz; root = svg('svg', { viewBox: '0 0 ' + W + ' ' + H });
      var cx = rings.length === 1 ? W / 2 : c;
      var tones = ['focus', 'series2', 'series3'];
      table.head = ['지표', '실적', '목표', '달성'];
      rings.forEach(function (rg, i) {
        var r = c - sw / 2 - i * (sw + gapR), circ = 2 * Math.PI * r, p = Math.min(rg.value / rg.goal, 1), col = toneOf(rg.tone || tones[i], i);
        root.appendChild(svg('circle', { cx: cx, cy: c, r: r, fill: 'none', stroke: col, 'stroke-width': sw, opacity: .18 }));
        root.appendChild(svg('circle', { cx: cx, cy: c, r: r, fill: 'none', stroke: col, 'stroke-width': sw, 'stroke-linecap': 'round', 'stroke-dasharray': (circ * p) + ' ' + circ, transform: 'rotate(-90 ' + cx + ' ' + c + ')', class: 'mk' }));
        table.rows.push([rg.label, String(rg.value), String(rg.goal), Math.round(rg.value / rg.goal * 100) + '%']);
        legendItems.push({ name: rg.label, color: col });
      });
      if (rings.length === 1) { var p0 = Math.round(rings[0].value / rings[0].goal * 100); txt(root, cx, c + 2, p0 + '%', 'ringv', 'middle'); txt(root, cx, c + 22, rings[0].label, 'tick', 'middle'); }
      else rings.forEach(function (rg, i) {
        var tx = sz + 20, ty = 28 + i * 44;
        txt(root, tx, ty, rg.label, 'rname'); txt(root, tx, ty + 20, fmt(rg.value) + ' / ' + fmt(rg.goal) + (rg.unit || unit), 'lbl');
      });
    }

    /* ---------- 구성비 한 줄(100%): 2~5조각, 직접 라벨 ---------- */
    function shareChart() {
      var items = cfg.items, tot = sum(items.map(function (x) { return x.value; })), x = 0;
      H = 64; root = svg('svg', { viewBox: '0 0 ' + W + ' ' + H });
      table.head = ['항목', '값' + (unit ? '(' + unit + ')' : ''), '비율'];
      items.forEach(function (it, i) {
        var w = W * it.value / tot, col = toneOf(it.tone || 'series' + Math.min(i + 1, 5), i), last = i === items.length - 1;
        var seg = svg('rect', { x: x, y: 0, width: Math.max(0, w - (last ? 0 : 2)), height: 14, rx: 0, fill: col, class: 'mk' });
        root.appendChild(seg);
        var pct = Math.round(it.value / tot * 100);
        if (w > 56) { txt(root, x, 36, it.label, 'tick'); txt(root, x, 54, pct + '%', 'lbl'); }
        legendItems.push({ name: it.label, color: col });
        table.rows.push([it.label, String(it.value), pct + '%']);
        x += w;
      });
      var clip = svg('clipPath', { id: id + 'c' }); clip.appendChild(svg('rect', { x: 0, y: 0, width: W, height: 14, rx: 7 }));
      var defs = svg('defs', {}); defs.appendChild(clip); root.insertBefore(defs, root.firstChild);
      Array.prototype.forEach.call(root.querySelectorAll('rect.mk'), function (r) { r.setAttribute('clip-path', 'url(#' + id + 'c)'); });
    }
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

    /* 3-1) 정의되지 않은 토큰: var(--토큰)이 빈 값이면 그 선언 전체가 무효가 되어 여백·색이 0이나 기본값으로 떨어집니다. */
    var TOKEN_RE = /var\((--(?:space|radius|dur|ease|spring|motion|material|shadow|cl|edu|brand|chart|accent|on|font|layout|z|hit|margin|bar)-[\w-]*|--(?:hit-min|margin))\s*\)/g, missing = {};
    Array.prototype.forEach.call(doc.styleSheets, function (ss) {
      var rules; try { rules = ss.cssRules; } catch (e) { return; }
      (function walk(list) {
        Array.prototype.forEach.call(list || [], function (ru) {
          if (ru.cssRules) walk(ru.cssRules);
          if (!ru.style) return;
          var m, txt = ru.style.cssText, target = null; TOKEN_RE.lastIndex = 0;
          if (!TOKEN_RE.test(txt)) return; TOKEN_RE.lastIndex = 0;
          /* 규칙이 실제로 적용되는 요소에서 값을 확인합니다(컴포넌트 안에서만 정의되는 값은 오류가 아님). 쓰이지 않는 규칙은 건너뜁니다. */
          (ru.selectorText || '').split(',').some(function (sel) {
            sel = sel.replace(/::?(before|after|placeholder|selection|marker|-webkit-[\w-]+|-moz-[\w-]+)/g, '').replace(/:(hover|active|focus|focus-visible|focus-within|checked|disabled|visited|first-child|last-child|empty)/g, '').trim();
            try { target = sel ? doc.querySelector(sel) : null; } catch (e) { target = null; }
            return !!target;
          });
          if (!target) return;
          var tcs = getComputedStyle(target);
          while ((m = TOKEN_RE.exec(txt))) { if (!tcs.getPropertyValue(m[1]).trim() && !missing[m[1]]) missing[m[1]] = ru.selectorText; }
        });
      })(rules);
    });
    all(root, '[style*="var(--"]').forEach(function (el) {
      var m, txt = el.getAttribute('style'); TOKEN_RE.lastIndex = 0;
      while ((m = TOKEN_RE.exec(txt))) { if (!getComputedStyle(el).getPropertyValue(m[1]).trim() && !missing[m[1]]) missing[m[1]] = where(el); }
    });
    Object.keys(missing).forEach(function (n) { err('정의되지 않은 토큰 ' + n, null, missing[n] + '에서 사용. tokens.css에 없는 이름입니다. 있는 토큰으로 바꾸거나 디자인 시스템에 토큰 추가를 요청합니다.'); });

    /* 3-2) 차트 약속(charts.md) */
    all(root, '.cl-chart').forEach(function (el) {
      var c = el.clChart; if (!c) return;
      var S = c.series || [], t = c.type || 'bar';
      if (c.y2 || c.yAxis2 || S.some(function (s) { return s.axis === 'right' || s.y2; })) err('차트 이중 축', el, '단위가 다른 지표는 panel(x축을 공유하는 아래 칸)으로 나눕니다.');
      var bars = S.filter(function (s) { return (s.mark || (t === 'line' ? 'line' : 'bar')) === 'bar'; });
      if ((t === 'bar' || t === 'combo') && bars.length === 1 && c.emphasis === 'none' && (c.categories || []).length > 3) warn('강조 없는 한 계열 막대', el, "emphasis를 지우거나(기본: 마지막 기간) 'max'·'target'·{category}로 이야기의 주인공을 정합니다.");
      if (t !== 'stack' && t !== 'share' && S.length > 4 && !(c.emphasis && c.emphasis.series)) warn('범주 색 5개 이상', el, '4계열까지만 색, 나머지는 기타로 묶거나 작은 차트로 나눕니다. 또는 emphasis: {series}로 하나만 강조합니다.');
      if (S.some(function (s) { return s.color || s.fill; }) || c.colors) err('차트 색 직접 지정', el, 'tone: focus·context·ink·muted·series1~4만 씁니다.');
      if (t === 'ring' && (c.rings || []).length > 3) err('링 4겹 이상', el, '링은 3겹까지. 여러 항목 비교는 bullet이나 barlist로.');
      if ((t === 'share') && (c.items || []).length > 5) warn('구성비 6조각 이상', el, '5조각까지, 나머지는 기타로 묶습니다.');
    });

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
