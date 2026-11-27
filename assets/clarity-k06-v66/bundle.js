/* 상상플렉스 Clarity (Kit 06) — behaviors v6.5
   bundle.css의 컴포넌트에 동작과 키보드 접근성을 붙입니다. 의존성 없음.
   불러오면 문서가 준비되는 대로 자동으로 연결되고, 새로 그린 영역은 SangsangClarity.init(요소)로 다시 연결합니다.
   React 등 앱이 직접 그리는 영역은 data-cl-managed로 표시하면 손끝 빛만 붙이고 나머지 동작은 건너뜁니다(workspace.md 6절).
   공개 API: SangsangClarity.init(root), .toast(message, options), .chart(element, config), .setTheme(light|dark|light-hc|dark-hc|auto), .setAccent(eduplex|green|ink), .loading(el, on, label), .month(el, config), .week(el, config), .agenda(el, config), .motion(spring·animate·enter·exit·stagger·flip·tracker·project), .tabs(open·close·select·dirty), .panel(open·close), .focus(on), .preview(frame·fit·zoom·refresh), .badges(fit), .audit(root), .version */
(function () {
  'use strict';
  var NS = { version: '6.5' };
  var doc = document;
  /* 앱이 관리하는 영역(data-cl-managed): 연결 단계에서 그 안의 요소를 건너뜁니다. 손끝 빛(bindGlow)만 예외입니다. */
  var SKIP_MANAGED = false;
  function managed(el) { return !!(el && el.closest && el.closest('[data-cl-managed]')); }
  function all(root, sel) {
    var a = Array.prototype.slice.call((root || doc).querySelectorAll(sel));
    return SKIP_MANAGED ? a.filter(function (el) { return !managed(el); }) : a;
  }
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
      var f = opts.focus || (panel.classList.contains('cl-popover') ? panel : null) || panel.querySelector('[role="menuitem"], .cl-actionsheet__btn, [aria-selected="true"], button');
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
  /* 사이드바 상태: 펼침(속성 없음 또는 "expanded") · 레일("rail", 기호만) · 숨김("hidden").
     data-sidebar-auto="rail"이면 속성이 없을 때 768~1279px에서 레일로 보입니다. data-cl-remember="키"면 고른 상태를 기억합니다. */
  function sideRail(sp) {
    var st = sp.getAttribute('data-sidebar');
    if (st === 'rail') return true;
    if (st) return false;
    return sp.getAttribute('data-sidebar-auto') === 'rail' && !!window.matchMedia && matchMedia('(min-width: 768px) and (max-width: 1279.98px)').matches;
  }
  function sideSync(sp) {
    var rail = sideRail(sp);
    all(sp, '.cl-side__item').forEach(function (it) {
      var lb = it.querySelector('.cl-side__label');
      if (rail && lb) { if (!it.hasAttribute('title')) { it.setAttribute('title', lb.textContent.trim()); it.dataset.clRailTitle = '1'; } }
      else if (it.dataset.clRailTitle) { it.removeAttribute('title'); delete it.dataset.clRailTitle; }
    });
    all(sp, '[data-cl-sidebar="rail"]').forEach(function (b) { b.setAttribute('aria-expanded', String(!rail)); });
  }
  function sideSet(sp, state) {
    if (state === 'expanded' || state === 'rail' || state === 'hidden') sp.setAttribute('data-sidebar', state); else sp.removeAttribute('data-sidebar');
    var key = sp.getAttribute('data-cl-remember'); if (key && state !== 'hidden') store2('side:' + key, state || 'expanded');
    sideSync(sp);
    emit(sp, 'cl-change', { sidebar: sp.getAttribute('data-sidebar') || 'expanded' });
  }
  function bindSidebar(root) {
    all(root, '.cl-split').forEach(function (sp) {
      if (!once(sp, 'Split')) return;
      /* 레일에서 이름을 숨기려면 글자가 .cl-side__label 안에 있어야 합니다. 맨 글자는 감싸 둡니다. */
      all(sp, '.cl-side__item').forEach(function (it) {
        if (it.querySelector('.cl-side__label')) return;
        Array.prototype.slice.call(it.childNodes).forEach(function (n) {
          if (n.nodeType === 3 && n.textContent.trim()) { var s = doc.createElement('span'); s.className = 'cl-side__label'; n.parentNode.insertBefore(s, n); s.appendChild(n); }
        });
      });
      var key = sp.getAttribute('data-cl-remember'), saved = key && store2('side:' + key);
      if (saved === 'expanded' || saved === 'rail') sp.setAttribute('data-sidebar', saved);
      sideSync(sp);
      if (window.matchMedia) { var mq = matchMedia('(min-width: 768px) and (max-width: 1279.98px)'); var on = function () { sideSync(sp); }; if (mq.addEventListener) mq.addEventListener('change', on); else if (mq.addListener) mq.addListener(on); }
    });
    all(root, '[data-cl-sidebar]').forEach(function (b) {
      if (!once(b, 'Side')) return;
      b.addEventListener('click', function () {
        var sp = b.closest('.cl-split') || doc.querySelector('.cl-split');
        if (!sp) return;
        var mode = b.getAttribute('data-cl-sidebar');
        if (mode === 'rail') { sideSet(sp, sideRail(sp) ? 'expanded' : 'rail'); return; }
        var hide = mode === 'hide';
        if (hide) sideSet(sp, 'hidden');
        else { var k = sp.getAttribute('data-cl-remember'), back = k && store2('side:' + k); sideSet(sp, back === 'rail' ? 'rail' : null); }
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
     type: bar | line | combo | stack | range | waterfall | bullet | barlist | dumbbell | heatmap | ring | share | strip(v6.6)
     색은 역할로만 정합니다: focus(강조, cl-accent) · context(강조색의 옅은 톤) · ink(파생 선) · muted(비교·기타) · ref(기준선) · self(학생 기준선, v6.6)
     · series(범주 chart-cat-1…10: 빡빡한 기준은 4색 뒤 회색, 완화된 기준 data-cl-palette="open"은 조화 스펙트럼 10색).
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
  function toneOf(t, si) { if (TONE[t]) return TONE[t]; var m = /^series(\d+)$/.exec(t || ''); return 'var(--chart-cat-' + Math.min(10, m ? +m[1] : si + 1) + ')'; }
  /* 기준선 이름과 색: 목표(실선 회색) · 평균(점선) · 학생(진한 실선, v6.6) */
  function ruleName(r) { return r.label || (r.kind === 'average' ? '평균' : r.kind === 'self' ? '학생' : '목표'); }
  function ruleColor(r) { return r.kind === 'self' ? 'var(--chart-self)' : 'var(--chart-ref)'; }
  function ruleKey(r) { return r.kind === 'average' ? 'avg' : r.kind === 'self' ? 'self' : 'rule'; }
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
      bullet: bulletChart, barlist: barlistChart, dumbbell: dumbbellChart, heatmap: heatmapChart, ring: ringChart, share: shareChart, strip: stripChart
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
      /* 기준선: 목표(실선) · 평균(점선) · 학생(진한 실선) */
      rules.forEach(function (r) {
        var ry = Math.round(y(r.value)) + 0.5;
        marks.appendChild(svg('line', { x1: M.l, x2: W - M.r, y1: ry, y2: ry, class: 'rule rule--' + (r.kind || 'target') }));
        var rl = ruleName(r) + ' ' + fmt(r.value) + unit;
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
      rules.forEach(function (r) { legendItems.push({ name: ruleName(r), color: ruleColor(r), kind: ruleKey(r) }); });
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
          h += row(ruleColor(r), ruleName(r) + ' 대비', d.trim() || '–', ruleKey(r));
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
      /* v6.6: items[].parts(강도별 조각, partNames) · items[].group(묶음 머리, 교과군이면 교과군 색 점) */
      var items = cfg.items.slice(), parts = items.some(function (x) { return Array.isArray(x.parts); }), grouped = items.some(function (x) { return x.group; });
      if (parts) items.forEach(function (x) { if (x.value == null) x.value = sum(x.parts || []); });
      var gOrder = [];
      items.forEach(function (x) { if (grouped && gOrder.indexOf(x.group) < 0) gOrder.push(x.group); });
      if (cfg.groupOrder) gOrder = cfg.groupOrder.concat(gOrder.filter(function (g) { return cfg.groupOrder.indexOf(g) < 0; }));
      if (cfg.sort !== false) items.sort(function (a, b) { return (grouped ? gOrder.indexOf(a.group) - gOrder.indexOf(b.group) : 0) || b.value - a.value; });
      var max = cfg.max || Math.max.apply(null, items.map(function (x) { return x.value; })), rh = 38, gh = 30;
      var mask = emphasisMask({ emphasis: cfg.emphasis == null ? 'max' : cfg.emphasis, rules: cfg.rules }, items.map(function (x) { return x.value; }), items.map(function (x) { return x.label; }));
      var nG = grouped ? gOrder.filter(function (g) { return items.some(function (x) { return x.group === g; }); }).length : 0;
      var pn = cfg.partNames || ['핵심', '권장', '반영'], np = parts ? Math.max.apply(null, items.map(function (x) { return (x.parts || []).length; })) : 0;
      /* 조각 색은 강도마다 고정(핵심 진하게 · 권장 옅게 · 반영 회색). 1위 강조는 굵은 이름·값 라벨로 */
      var ptone = [[TONE.focus, TONE.context, TONE.muted], [TONE.focus, TONE.context, TONE.muted]];
      H = items.length * rh + nG * gh;
      root = svg('svg', { viewBox: '0 0 ' + W + ' ' + H });
      table.head = ['항목'].concat(grouped ? ['묶음'] : []).concat(parts ? pn.slice(0, np) : []).concat([(parts ? '합계' : '값') + (unit ? '(' + unit + ')' : '')]);
      var yy = 0, lastG = null;
      items.forEach(function (it, i) {
        if (grouped && it.group !== lastG) {
          lastG = it.group;
          var gg = svg('g', { class: 'rgroup' }), hue = NS.colors.groupHue(it.group);
          if (hue) gg.appendChild(svg('rect', { x: 0, y: yy + 11, width: 10, height: 10, rx: 3, fill: 'var(--cl-hue-' + hue + '-mark)' }));
          txt(gg, hue ? 16 : 0, yy + 20, it.group, 'gname');
          root.appendChild(gg); yy += gh;
        }
        var y0 = yy, desc = parts ? (it.parts || []).map(function (v, pi) { return (pn[pi] || '') + ' ' + v; }).join(', ') : '';
        var g = svg('g', { tabindex: 0, class: 'rowhit', 'aria-label': it.label + ' ' + it.value + unit + (desc ? ' (' + desc + ')' : '') });
        txt(g, 0, y0 + 15, it.label, mask[i] ? 'rname rname--strong' : 'rname');
        txt(g, W, y0 + 15, fmt(it.value) + unit, mask[i] ? 'lbl' : 'tick', 'end');
        g.appendChild(svg('rect', { x: 0, y: y0 + 22, width: W, height: 6, rx: 3, class: 'track' }));
        if (parts) {
          var x = 0, segs = it.parts || [];
          segs.forEach(function (pv, pi) {
            var w = W * pv / max; if (w <= 0) return;
            g.appendChild(svg('rect', { x: x, y: y0 + 22, width: Math.max(2, w - (pi < segs.length - 1 ? 2 : 0)), height: 6, rx: pi === 0 || pi === segs.length - 1 ? 3 : 0, fill: ptone[mask[i] ? 0 : 1][Math.min(pi, 2)], class: 'mk' }));
            x += w;
          });
          g.addEventListener('mouseenter', function () { showTip('<b>' + esc(it.label) + '</b>' + segs.map(function (pv, pi) { return row(ptone[0][Math.min(pi, 2)], pn[pi] || '', fmt(pv) + unit); }).join('') + row('transparent', '합계', fmt(it.value) + unit), W / 2, y0); });
          g.addEventListener('mouseleave', hideTip); g.addEventListener('focus', function () { g.dispatchEvent(new Event('mouseenter')); }); g.addEventListener('blur', hideTip);
        } else g.appendChild(svg('rect', { x: 0, y: y0 + 22, width: Math.max(6, W * it.value / max), height: 6, rx: 3, fill: mask[i] ? TONE.focus : TONE.context, class: 'mk' }));
        root.appendChild(g);
        table.rows.push([it.label].concat(grouped ? [it.group || ''] : []).concat(parts ? pn.slice(0, np).map(function (_, pi) { return String((it.parts || [])[pi] || 0); }) : []).concat([String(it.value)]));
        yy += rh;
      });
      if (parts) pn.slice(0, np).forEach(function (n, pi) { legendItems.push({ name: n, color: ptone[0][Math.min(pi, 2)] }); });
      summary.push(items.length + '개 항목. 가장 큰 값 ' + items.filter(function (x, i) { return mask[i]; }).map(function (x) { return x.label + ' ' + x.value + unit; }).join(', ') + '.');
    }
    function stripChart() {
      /* v6.6 점 띠: 묶음마다 여러 값의 분포와 학생 기준선. rows[{label, points[{label, value}]}], min, max, reverse,
         rules[{kind:'self'|'target'|'average', value, label}], emphasis {near: n}(학생 기준 ±n) | {labels:[]}, band{from,to} */
      var rows = cfg.rows || [], rules = cfg.rules || [], L = Math.round(Math.min(160, Math.max(88, W * 0.28))), x0 = L + 10, x1 = W - 14, rh = 34, top = 26;
      var vals = []; rows.forEach(function (r) { (r.points || []).forEach(function (p) { vals.push(p.value); }); }); rules.forEach(function (r) { vals.push(r.value); });
      var lo = cfg.min != null ? cfg.min : Math.min.apply(null, vals), hi = cfg.max != null ? cfg.max : Math.max.apply(null, vals);
      if (hi === lo) { hi += 1; lo -= 1; }
      function X(v) { var t = (v - lo) / (hi - lo); if (cfg.reverse) t = 1 - t; return x0 + t * (x1 - x0); }
      var bottom = top + rows.length * rh;
      H = bottom + 24;
      root = svg('svg', { viewBox: '0 0 ' + W + ' ' + H });
      var grid = svg('g', { class: 'grid' });
      for (var k = 0; k <= 4; k++) { var gv = lo + (hi - lo) * k / 4, gx = Math.round(X(gv)) + 0.5; grid.appendChild(svg('line', { x1: gx, x2: gx, y1: top - 6, y2: bottom })); txt(root, gx, H - 6, fmt(gv) + unit, 'tick', 'middle'); }
      root.appendChild(grid);
      var self = rules.filter(function (r) { return r.kind === 'self'; })[0], em = cfg.emphasis || {}, near = em.near, labs = em.labels;
      var band = cfg.band || (self && near != null ? { from: self.value - near, to: self.value + near } : null);
      if (band) root.appendChild(svg('rect', { x: Math.min(X(band.from), X(band.to)), y: top - 6, width: Math.abs(X(band.to) - X(band.from)), height: bottom - top + 6, class: 'band' }));
      table.head = ['묶음', '항목', '값' + (unit ? '(' + unit + ')' : '')];
      var nFocus = 0;
      rows.forEach(function (r, ri) {
        var cy = top + ri * rh + rh / 2, pts = (r.points || []).slice().sort(function (a, b) { return a.value - b.value; }), fc = 0;
        var g = svg('g', { tabindex: 0, class: 'rowhit' });
        var name = txt(g, 0, cy + 4, r.label, 'rname');
        if (r.label.length * 13 > L) { name.textContent = r.label.slice(0, Math.max(3, Math.floor(L / 13) - 1)) + '…'; var tt = svg('title', {}); tt.textContent = r.label; name.appendChild(tt); }
        g.appendChild(svg('line', { x1: x0, x2: x1, y1: cy, y2: cy, class: 'stripline' }));
        pts.forEach(function (p) {
          var f = self && near != null ? Math.abs(p.value - self.value) <= near + 1e-9 : labs ? labs.indexOf(p.label) >= 0 : false;
          if (f) { fc++; nFocus++; }
          var c = svg('circle', { cx: X(p.value), cy: cy, r: f ? 5.5 : 4, fill: f ? TONE.focus : TONE.context, class: 'pt' + (f ? ' pt--focus' : '') });
          c.addEventListener('mouseenter', function () { showTip('<b>' + esc(r.label) + '</b>' + row(f ? TONE.focus : TONE.context, p.label, fmt(p.value) + unit) + (self ? row(ruleColor(self), ruleName(self) + ' 대비', (p.value - self.value >= 0 ? '▲' : '▼') + fmt(Math.abs(p.value - self.value))) : ''), X(p.value), cy - 8); });
          c.addEventListener('mouseleave', hideTip);
          g.appendChild(c);
          table.rows.push([r.label, p.label, String(p.value)]);
        });
        var ki = -1;
        g.addEventListener('keydown', function (e) {
          if (e.key === 'Escape') { hideTip(); return; }
          if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
          e.preventDefault(); ki = Math.max(0, Math.min(pts.length - 1, ki + (e.key === 'ArrowRight' ? 1 : -1))); var p = pts[ki];
          showTip('<b>' + esc(r.label) + '</b>' + row(TONE.context, p.label, fmt(p.value) + unit), X(p.value), cy - 8);
        });
        g.addEventListener('blur', hideTip);
        g.setAttribute('aria-label', r.label + ', ' + pts.length + '개' + (pts.length ? ' ' + fmt(pts[0].value) + '~' + fmt(pts[pts.length - 1].value) + unit : '') + (fc ? ', 기준 가까이 ' + fc + '개' : '') + '. 좌우 화살표로 값 보기');
        root.appendChild(g);
      });
      rules.forEach(function (r) {
        var rx = Math.round(X(r.value)) + 0.5;
        root.appendChild(svg('line', { x1: rx, x2: rx, y1: top - 8, y2: bottom, class: 'rule rule--' + (r.kind || 'target') }));
        txt(root, Math.min(Math.max(rx, x0 + 24), x1 - 24), top - 12, ruleName(r) + ' ' + fmt(r.value) + unit, 'rlbl' + (r.kind === 'self' ? ' rlbl--self' : ''), 'middle');
        legendItems.push({ name: ruleName(r), color: ruleColor(r), kind: ruleKey(r) });
        summary.push(ruleName(r) + ' ' + r.value + unit + '.');
      });
      if (nFocus) legendItems.unshift({ name: self && near != null ? ruleName(self) + ' ±' + fmt(near) : '고른 항목', color: TONE.focus });
      summary.unshift(rows.length + '개 묶음, 값 ' + table.rows.length + '개' + (nFocus ? ', 강조 ' + nFocus + '개' : '') + '.');
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

  /* ============ 작업 공간: 트리 · 경로 · 문서 탭 · 컬럼 브라우저 · 칸 나누기 · 쌓이는 칸 · 명령 팔레트 ============
     규칙은 workspace.md. 모두 마크업(또는 JSON)만 맞추면 자동 연결됩니다. */
  function store2(k, v) { try { if (v === undefined) return JSON.parse(localStorage.getItem('cl-ws:' + k) || 'null'); localStorage.setItem('cl-ws:' + k, JSON.stringify(v)); } catch (e) { return null; } }

  /* 한글 글자 찾기: 완성 글자 또는 초성(ㄱ → 고등)으로 맞춥니다. */
  var CHO = 'ㄱㄲㄴㄷㄸㄹㅁㅂㅃㅅㅆㅇㅈㅉㅊㅋㅌㅍㅎ';
  function initials(str) { return str.split('').map(function (ch) { var c = ch.charCodeAt(0); return c >= 0xAC00 && c <= 0xD7A3 ? CHO[Math.floor((c - 0xAC00) / 588)] : ch; }).join(''); }
  function startsWithKo(label, typed) { label = label.trim().toLowerCase(); return label.indexOf(typed) === 0 || initials(label).indexOf(typed) === 0; }

  /* ---------- 트리: WAI-ARIA Tree View(화살표, Home/End, 글자 찾기, * 형제 펼치기) ---------- */
  function bindTree(root) {
    all(root, '.cl-tree[role="tree"]').forEach(function (tree) {
      if (!once(tree, 'Tree')) return;
      var key = tree.getAttribute('data-cl-remember'), saved = key ? store2('tree:' + key) : null;
      function items() { return all(tree, '[role="treeitem"]'); }
      function visible() { return items().filter(function (it) { var p = it.parentElement.closest('[role="treeitem"]'); while (p) { if (p.getAttribute('aria-expanded') !== 'true') return false; p = p.parentElement.closest('[role="treeitem"]'); } return true; }); }
      items().forEach(function (it) {
        var lvl = 1, p = it.parentElement.closest('[role="treeitem"]'); while (p) { lvl++; p = p.parentElement.closest('[role="treeitem"]'); }
        it.setAttribute('aria-level', lvl);
        var row = it.querySelector(':scope > .cl-tree__row'); if (row) row.style.setProperty('--lvl', lvl - 1);
        var hasKids = !!it.querySelector(':scope > [role="group"]');
        if (hasKids) {
          if (saved && saved[it.id] != null) it.setAttribute('aria-expanded', String(saved[it.id]));
          else if (!it.hasAttribute('aria-expanded')) it.setAttribute('aria-expanded', 'false');
          if (row && !row.querySelector('.cl-tree__twisty')) row.insertAdjacentHTML('afterbegin', '<span class="cl-tree__twisty" aria-hidden="true">' + icon('chev') + '</span>');
        } else { it.removeAttribute('aria-expanded'); if (row && !row.querySelector('.cl-tree__twisty')) row.insertAdjacentHTML('afterbegin', '<span class="cl-tree__twisty cl-tree__twisty--leaf" aria-hidden="true"></span>'); }
        it.tabIndex = -1;
      });
      var cur = tree.querySelector('[role="treeitem"][aria-selected="true"]') || visible()[0];
      if (cur) cur.tabIndex = 0;
      function save() { if (!key) return; var m = {}; items().forEach(function (it) { if (it.hasAttribute('aria-expanded') && it.id) m[it.id] = it.getAttribute('aria-expanded') === 'true'; }); store2('tree:' + key, m); }
      function focus(it) { if (!it) return; if (cur) cur.tabIndex = -1; cur = it; it.tabIndex = 0; it.focus({ preventScroll: true }); it.scrollIntoView({ block: 'nearest' }); }
      function toggle(it, open) { if (!it.hasAttribute('aria-expanded')) return; it.setAttribute('aria-expanded', String(open == null ? it.getAttribute('aria-expanded') !== 'true' : open)); save(); emit(tree, 'cl-change', { item: it, expanded: it.getAttribute('aria-expanded') === 'true' }); }
      function select(it, how) {
        items().forEach(function (x) { x.setAttribute('aria-selected', String(x === it)); });
        emit(tree, 'cl-select', { item: it, id: it.id, label: (it.querySelector('.cl-tree__label') || it).textContent.trim(), permanent: how === 'dbl', leaf: !it.hasAttribute('aria-expanded') });
      }
      tree.addEventListener('click', function (e) {
        var it = e.target.closest('[role="treeitem"]'); if (!it || !tree.contains(it)) return;
        e.stopPropagation(); focus(it);
        if (e.target.closest('.cl-tree__twisty') || (it.hasAttribute('aria-expanded') && !it.hasAttribute('data-selectable'))) {
          toggle(it);
          if (e.altKey && it.getAttribute('aria-expanded') === 'true') all(it, '[aria-expanded]').forEach(function (x) { x.setAttribute('aria-expanded', 'true'); });
        } else select(it, 'click');
      });
      tree.addEventListener('dblclick', function (e) { var it = e.target.closest('[role="treeitem"]'); if (it && !it.hasAttribute('aria-expanded')) select(it, 'dbl'); });
      var typed = '', tt = 0;
      tree.addEventListener('keydown', function (e) {
        var vis = visible(), i = vis.indexOf(cur), it = cur; if (!it) return;
        var exp = it.getAttribute('aria-expanded');
        switch (e.key) {
          case 'ArrowDown': focus(vis[Math.min(vis.length - 1, i + 1)]); break;
          case 'ArrowUp': focus(vis[Math.max(0, i - 1)]); break;
          case 'ArrowRight': if (exp === 'false') toggle(it, true); else if (exp === 'true') focus(it.querySelector('[role="group"] > [role="treeitem"]')); else return; break;
          case 'ArrowLeft': if (exp === 'true') toggle(it, false); else focus(it.parentElement.closest('[role="treeitem"]')); break;
          case 'Home': focus(vis[0]); break;
          case 'End': focus(vis[vis.length - 1]); break;
          case 'Enter': case ' ': if (exp != null && !it.hasAttribute('data-selectable')) toggle(it); else select(it, e.key === 'Enter' && (e.metaKey || e.ctrlKey) ? 'dbl' : 'key'); break;
          case '*': all(it.parentElement, ':scope > [role="treeitem"][aria-expanded]').forEach(function (x) { x.setAttribute('aria-expanded', 'true'); }); save(); break;
          default:
            if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
              clearTimeout(tt); typed += e.key.toLowerCase(); tt = setTimeout(function () { typed = ''; }, 600);
              var order = vis.slice(i + 1).concat(vis.slice(0, i + 1));
              var hit = order.filter(function (x) { return startsWithKo((x.querySelector('.cl-tree__label') || x).textContent, typed); })[0];
              if (hit) focus(hit);
            } else return;
        }
        e.preventDefault();
      });
    });
  }

  /* ---------- 경로(path): 본문 안, 넘치면 가운데를 … 로 접음 ---------- */
  function bindPath(root) {
    all(root, '.cl-path').forEach(function (nav) {
      if (!once(nav, 'Path')) return;
      var ol = nav.querySelector('ol'); if (!ol) return;
      function fit() {
        var lis = all(ol, ':scope > li:not(.cl-path__more)');
        lis.forEach(function (li) { li.hidden = false; });
        var more = ol.querySelector('.cl-path__more'); if (more) more.remove();
        var hidden = [];
        ol.classList.add('is-measuring');
        for (var k = 1; k < lis.length - 1 && ol.scrollWidth > ol.clientWidth + 1; k++) { lis[k].hidden = true; hidden.push(lis[k].textContent.trim()); }
        ol.classList.remove('is-measuring');
        if (hidden.length) {
          var m = doc.createElement('li'); m.className = 'cl-path__more';
          m.innerHTML = '<button type="button" class="cl-path__btn" aria-label="숨긴 경로: ' + hidden.join(', ') + '" title="' + hidden.join(' › ') + '">…</button>';
          lis[0].after(m);
        }
      }
      fit();
      if (window.ResizeObserver) new ResizeObserver(fit).observe(nav);
    });
  }

  /* ---------- 문서 탭: 미리보기(기울임) · 고정 · 저장 안 됨 표시 · 닫기 · 끌어서 순서 바꾸기 ---------- */
  function tabSelect(list, tab, silent) {
    var panels = [];
    all(list, '[role="tab"]').forEach(function (t) {
      var on = t === tab; t.setAttribute('aria-selected', String(on)); t.tabIndex = on ? 0 : -1;
      var p = t.getAttribute('aria-controls') && doc.getElementById(t.getAttribute('aria-controls')); if (p) { p.hidden = true; panels.push(p); }
    });
    /* 여러 탭이 한 패널을 함께 쓸 수 있으므로, 모두 숨긴 뒤 고른 탭의 패널만 엽니다. */
    var sp = tab && tab.getAttribute('aria-controls') && doc.getElementById(tab.getAttribute('aria-controls')); if (sp) sp.hidden = false;
    if (tab) tab.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    if (!silent) emit(list, 'cl-change', { tab: tab, id: tab && tab.dataset.id, label: tab && tab.querySelector('.cl-doctab__label').textContent });
  }
  function tabClose(list, tab) {
    /* 섹션 탭(--plain)과 정보 칸 모드 탭은 닫지 않습니다(Delete·Alt+W·가운데 클릭 포함). */
    if (!tab || tab.hasAttribute('data-pinned') || list.classList.contains('cl-doctabs--plain')) return;
    if (tab.hasAttribute('data-dirty') && !tab.hasAttribute('data-confirmed')) { emit(list, 'cl-tab-dirty', { tab: tab }); return; }
    var tabs = all(list, '[role="tab"]'), i = tabs.indexOf(tab), was = tab.getAttribute('aria-selected') === 'true';
    var next = tabs[i + 1] || tabs[i - 1];
    var rest = tabs.filter(function (t) { return t !== tab; });
    NS.motion.exit(tab, 'pop').then(function () {
      NS.motion.flip(rest, function () { tab.remove(); });
      if (was && next) { tabSelect(list, next); next.focus(); }
      emit(list, 'cl-tab-close', { id: tab.dataset.id });
    });
  }
  function tabMake(o) {
    var t = doc.createElement('div');
    t.className = 'cl-doctab'; t.setAttribute('role', 'tab'); t.dataset.id = o.id;
    if (o.preview) t.setAttribute('data-preview', '');
    if (o.controls) t.setAttribute('aria-controls', o.controls);
    t.innerHTML = '<span class="cl-doctab__label">' + esc(o.label) + '</span><button type="button" class="cl-doctab__close" tabindex="-1" aria-label="' + esc(o.label) + ' 닫기"><svg class="cl-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M7 7l10 10M17 7L7 17"/></svg></button>';
    return t;
  }
  NS.tabs = {
    /* 열기: 같은 id가 있으면 그 탭으로, 미리보기면 기존 미리보기 탭 자리를 재사용합니다. */
    open: function (list, o) {
      var ex = list.querySelector('[role="tab"][data-id="' + o.id + '"]');
      if (ex) { if (!o.preview) ex.removeAttribute('data-preview'); tabSelect(list, ex); return ex; }
      var pv = o.preview && list.querySelector('[role="tab"][data-preview]');
      var t = tabMake(o);
      if (pv) list.replaceChild(t, pv); else list.appendChild(t);
      tabSelect(list, t); NS.motion.enter(t, 'pop');
      return t;
    },
    close: function (list, id) { tabClose(list, list.querySelector('[role="tab"][data-id="' + id + '"]')); },
    select: function (list, id) { tabSelect(list, list.querySelector('[role="tab"][data-id="' + id + '"]')); },
    dirty: function (list, id, on) { var t = list.querySelector('[role="tab"][data-id="' + id + '"]'); if (t) { if (on) { t.setAttribute('data-dirty', ''); t.removeAttribute('data-preview'); } else t.removeAttribute('data-dirty'); } }
  };
  function bindDocTabs(root) {
    all(root, '.cl-doctabs[role="tablist"]').forEach(function (list) {
      if (!once(list, 'DocTabs')) return;
      all(list, '[role="tab"]').forEach(function (t) { if (!t.querySelector('.cl-doctab__close')) t.insertAdjacentHTML('beforeend', '<button type="button" class="cl-doctab__close" tabindex="-1" aria-label="닫기"><svg class="cl-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M7 7l10 10M17 7L7 17"/></svg></button>'); });
      tabSelect(list, list.querySelector('[role="tab"][aria-selected="true"]') || list.querySelector('[role="tab"]'), true);
      list.addEventListener('click', function (e) {
        var t = e.target.closest('[role="tab"]'); if (!t) return;
        if (e.target.closest('.cl-doctab__close')) { e.stopPropagation(); tabClose(list, t); return; }
        tabSelect(list, t);
      });
      list.addEventListener('auxclick', function (e) { var t = e.target.closest('[role="tab"]'); if (t && e.button === 1) tabClose(list, t); });
      list.addEventListener('dblclick', function (e) { var t = e.target.closest('[role="tab"]'); if (t) t.removeAttribute('data-preview'); });
      list.addEventListener('keydown', function (e) {
        var tabs = all(list, '[role="tab"]'), t = e.target.closest('[role="tab"]'), i = tabs.indexOf(t); if (i < 0) return;
        if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
          e.preventDefault(); var n = tabs[(i + (e.key === 'ArrowRight' ? 1 : tabs.length - 1)) % tabs.length];
          if (e.altKey && e.shiftKey) { NS.motion.flip(tabs, function () { if (e.key === 'ArrowRight' && tabs[i + 1]) tabs[i + 1].after(t); if (e.key === 'ArrowLeft' && tabs[i - 1]) tabs[i - 1].before(t); }); t.focus(); return; }
          tabSelect(list, n); n.focus();
        } else if (e.key === 'Home' || e.key === 'End') { e.preventDefault(); var m = e.key === 'Home' ? tabs[0] : tabs[tabs.length - 1]; tabSelect(list, m); m.focus(); }
        else if (e.key === 'Delete' || (e.key === 'w' && e.altKey)) { e.preventDefault(); tabClose(list, t); }
      });
      /* 끌어서 순서 바꾸기: 6px 넘게 움직이면 시작, 이웃 탭은 flip으로 비켜 줌 */
      var drag = null;
      list.addEventListener('pointerdown', function (e) {
        var t = e.target.closest('[role="tab"]'); if (!t || e.target.closest('.cl-doctab__close') || e.button !== 0) return;
        drag = { t: t, x: e.clientX, on: false };
      });
      list.addEventListener('pointermove', function (e) {
        if (!drag) return;
        if (!drag.on && Math.abs(e.clientX - drag.x) < 6) return;
        if (!drag.on) { drag.on = true; drag.t.setAttribute('data-dragging', ''); drag.t.setPointerCapture(e.pointerId); }
        var tabs = all(list, '[role="tab"]'), over = tabs.filter(function (x) { var r = x.getBoundingClientRect(); return x !== drag.t && e.clientX > r.left && e.clientX < r.right; })[0];
        if (over && !(over.hasAttribute('data-pinned') && !drag.t.hasAttribute('data-pinned'))) {
          var r = over.getBoundingClientRect(), after = e.clientX > r.left + r.width / 2;
          NS.motion.flip(tabs.filter(function (x) { return x !== drag.t; }), function () { if (after) over.after(drag.t); else over.before(drag.t); });
        }
      });
      function end() { if (drag && drag.on) { drag.t.removeAttribute('data-dragging'); emit(list, 'cl-tab-reorder', { order: all(list, '[role="tab"]').map(function (x) { return x.dataset.id; }) }); } drag = null; }
      list.addEventListener('pointerup', end); list.addEventListener('pointercancel', end);
    });
  }

  /* ---------- 컬럼 브라우저: 깊은 계층을 단계마다 한 칸씩(데스크톱) ---------- */
  function bindColumns(root) {
    all(root, '.cl-columns[data-columns]').forEach(function (box) {
      if (!once(box, 'Columns')) return;
      var data = JSON.parse(box.getAttribute('data-columns')), path = (box.getAttribute('data-path') || '').split(',').filter(function (x) { return x !== ''; }).map(Number);
      function render(focusCol) {
        box.innerHTML = '';
        var node = data, cols = [];
        for (var d = 0; d <= path.length; d++) {
          if (!node || !node.children) break;
          cols.push({ node: node, sel: path[d] });
          node = path[d] != null ? node.children[path[d]] : null;
        }
        cols.forEach(function (c, ci) {
          var col = doc.createElement('div'); col.className = 'cl-columns__col'; col.setAttribute('role', 'listbox'); col.setAttribute('aria-label', c.node.label || '목록');
          c.node.children.forEach(function (ch, ii) {
            var b = doc.createElement('div'); b.className = 'cl-columns__item'; b.setAttribute('role', 'option');
            b.setAttribute('aria-selected', String(c.sel === ii)); b.tabIndex = (c.sel === ii || (c.sel == null && ii === 0)) ? 0 : -1;
            b.innerHTML = '<span class="cl-columns__label">' + esc(ch.label) + '</span>' + (ch.count != null ? '<span class="cl-columns__count">' + esc(ch.count) + '</span>' : '') + (ch.children ? '<span class="cl-columns__chev" aria-hidden="true">' + icon('chev') + '</span>' : '');
            b.addEventListener('click', function () { choose(ci, ii, false); });
            b.addEventListener('keydown', function (e) {
              var opts = all(col, '[role="option"]');
              if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); var n = opts[Math.max(0, Math.min(opts.length - 1, ii + (e.key === 'ArrowDown' ? 1 : -1)))]; n.click(); }
              else if (e.key === 'ArrowRight' && ch.children) { e.preventDefault(); choose(ci, ii, true); }
              else if (e.key === 'ArrowLeft' && ci > 0) { e.preventDefault(); path = path.slice(0, ci); render(ci - 1); }
            });
            col.appendChild(b);
          });
          box.appendChild(col);
        });
        if (node && !node.children) {
          var pv = doc.createElement('div'); pv.className = 'cl-columns__preview';
          pv.innerHTML = '<h4>' + esc(node.label) + '</h4>' + (node.meta ? '<dl>' + Object.keys(node.meta).map(function (k) { return '<dt>' + esc(k) + '</dt><dd>' + esc(node.meta[k]) + '</dd>'; }).join('') + '</dl>' : '') + (node.action ? '<button type="button" class="cl-btn cl-btn--tinted cl-btn--sm">' + esc(node.action) + '</button>' : '');
          box.appendChild(pv);
        }
        var last = box.lastElementChild; if (last) box.scrollTo({ left: box.scrollWidth, behavior: reduced() ? 'auto' : 'smooth' });
        if (focusCol != null) { var fc = box.children[focusCol]; var f = fc && (fc.querySelector('[aria-selected="true"]') || fc.querySelector('[role="option"]')); if (f) f.focus(); }
        emit(box, 'cl-change', { path: path.slice(), node: node });
      }
      function choose(ci, ii, into) { path = path.slice(0, ci); path[ci] = ii; render(into ? ci + 1 : ci); }
      render(null);
    });
  }

  /* ---------- 칸 나누기: 얇은 1px 경계를 끌어 너비 조절, 두 번 누르면 접기, 화살표로도 조절 ---------- */
  function bindPanes(root) {
    all(root, '.cl-divider[role="separator"]').forEach(function (dv) {
      if (!once(dv, 'Divider')) return;
      /* 경계는 본문이 아닌 쪽 칸을 조절합니다: 왼쪽이 본문이면(정보 칸 경계) 오른쪽 칸을, 끌기 방향도 반대로. */
      var pane = dv.previousElementSibling, min = +(dv.dataset.min || 160), max = +(dv.dataset.max || 480), key = dv.getAttribute('data-cl-remember');
      var after = dv.getAttribute('data-side') === 'next' || !!(pane && pane.classList.contains('cl-pane--main'));
      if (after) pane = dv.nextElementSibling;
      var sign = after ? -1 : 1;
      if (!pane) return;
      dv.tabIndex = 0; dv.setAttribute('aria-orientation', 'vertical');
      /* 정보 칸 '인쇄' 모드(v6.5)는 작업대 너비의 30~75%이고 다른 모드와 따로 기억합니다. */
      function printMode() { return pane.getAttribute('data-mode') === 'print'; }
      function lim() { if (!printMode()) return [min, max]; var bw = (pane.parentElement && pane.parentElement.getBoundingClientRect().width) || 1000; return [Math.round(bw * .3), Math.round(bw * .75)]; }
      function skey() { return key ? 'pane:' + key + (printMode() ? ':print' : '') : null; }
      function limits() { var L = lim(); dv.setAttribute('aria-valuemin', L[0]); dv.setAttribute('aria-valuemax', L[1]); }
      limits();
      var w0 = key && store2('pane:' + key); if (w0) pane.style.flexBasis = w0 + 'px';
      function set(w) { var L = lim(); w = Math.max(L[0], Math.min(L[1], Math.round(w))); pane.style.flexBasis = w + 'px'; dv.setAttribute('aria-valuenow', w); pane.removeAttribute('data-collapsed'); var k = skey(); if (k) store2(k, w); else (pane._clW = pane._clW || {})[printMode() ? 'print' : 'normal'] = w + 'px'; }
      pane._clDividerKey = key; pane._clLimits = limits;
      if (pane.hasAttribute('data-collapsed')) dv.setAttribute('aria-valuenow', 0); else set(pane.getBoundingClientRect().width || min);
      var sx = 0, sw = 0, on = false;
      dv.addEventListener('pointerdown', function (e) { on = true; sx = e.clientX; sw = pane.getBoundingClientRect().width; dv.setPointerCapture(e.pointerId); dv.setAttribute('data-active', ''); });
      dv.addEventListener('pointermove', function (e) { if (on) set(sw + sign * (e.clientX - sx)); });
      dv.addEventListener('pointerup', function () { on = false; dv.removeAttribute('data-active'); });
      dv.addEventListener('dblclick', function () { var c = pane.hasAttribute('data-collapsed'); if (c) pane.removeAttribute('data-collapsed'); else pane.setAttribute('data-collapsed', ''); dv.setAttribute('aria-valuenow', c ? Math.round(pane.getBoundingClientRect().width) : 0); });
      dv.addEventListener('keydown', function (e) {
        var w = pane.getBoundingClientRect().width;
        var step = e.shiftKey ? 64 : 16;
        if (e.key === 'ArrowLeft') { e.preventDefault(); set(w - step * sign); } else if (e.key === 'ArrowRight') { e.preventDefault(); set(w + step * sign); }
        else if (e.key === 'Home') { e.preventDefault(); set(lim()[0]); } else if (e.key === 'End') { e.preventDefault(); set(lim()[1]); }
        else if (e.key === 'Enter') { e.preventDefault(); dv.dispatchEvent(new MouseEvent('dblclick')); }
      });
    });
  }

  /* ---------- 두 줄 탭(.cl-tabrows): 1줄 열린 작업 · 2줄 보기. 줄마다 접고, 접힌 줄은 손잡이에서 그대로 바꿉니다 ---------- */
  var TAB_ROWS = ['work', 'view'];
  function rowsCollapsed(tr) { return (tr.getAttribute('data-collapsed') || '').split(/\s+/).filter(function (x) { return TAB_ROWS.indexOf(x) >= 0; }); }
  function rowList(tr, row) { var r = tr.querySelector('.cl-tabrows__row[data-row="' + row + '"]'); return r && r.querySelector('[role="tablist"]'); }
  function rowsLabel(tr) {
    all(tr, '[data-cl-tabpick]').forEach(function (p) {
      var list = rowList(tr, p.getAttribute('data-cl-tabpick')), t = list && list.querySelector('[role="tab"][aria-selected="true"]');
      var lb = p.querySelector('.cl-tabrows__pick-label') || p;
      lb.textContent = t ? (t.querySelector('.cl-doctab__label') || t).textContent.trim() : '';
    });
  }
  function rowsSet(tr, list, keep) {
    var names = TAB_ROWS.filter(function (n) { return list.indexOf(n) >= 0 && tr.querySelector('.cl-tabrows__row[data-row="' + n + '"]'); });
    if (names.length) tr.setAttribute('data-collapsed', names.join(' ')); else tr.removeAttribute('data-collapsed');
    all(tr, '[data-cl-tabrow]').forEach(function (b) {
      var r = b.getAttribute('data-cl-tabrow');
      b.setAttribute('aria-expanded', String(r === 'all' ? !names.length : names.indexOf(r) < 0));
    });
    rowsLabel(tr);
    var key = tr.getAttribute('data-cl-remember'); if (key && !keep) store2('tabrows:' + key, names);
    emit(tr, 'cl-change', { collapsed: names });
  }
  function bindTabRows(root) {
    all(root, '.cl-tabrows').forEach(function (tr) {
      if (!once(tr, 'TabRows')) return;
      var key = tr.getAttribute('data-cl-remember'), saved = key && store2('tabrows:' + key);
      rowsSet(tr, Array.isArray(saved) ? saved : rowsCollapsed(tr), true);
      tr.addEventListener('click', function (e) {
        var b = e.target.closest('[data-cl-tabrow]'); if (!b || !tr.contains(b)) return;
        var r = b.getAttribute('data-cl-tabrow'), cur = rowsCollapsed(tr), next;
        if (r === 'all') next = cur.length ? [] : TAB_ROWS.slice();
        else next = cur.indexOf(r) >= 0 ? cur.filter(function (x) { return x !== r; }) : cur.concat(r);
        rowsSet(tr, next);
        /* 포커스가 사라진 단추에 남지 않게: 펼친 줄은 고른 탭으로, 접은 줄은 손잡이의 고르기 단추로 옮깁니다. */
        setTimeout(function () {
          var f = null;
          if (r !== 'all' && next.indexOf(r) < 0) { var l = rowList(tr, r); f = l && l.querySelector('[role="tab"][aria-selected="true"]'); }
          else if (r !== 'all') f = tr.querySelector('[data-cl-tabpick="' + r + '"]');
          else f = next.length ? tr.querySelector('.cl-tabrows__handle [data-cl-tabrow="all"]') : (function () { var l = rowList(tr, 'work') || rowList(tr, 'view'); return l && l.querySelector('[role="tab"][aria-selected="true"]'); })();
          if (f && f.getClientRects().length) f.focus();
        }, 30);
      });
      tr.addEventListener('cl-change', function (e) { if (e.target !== tr) rowsLabel(tr); });
      tr.addEventListener('cl-tab-close', function () { setTimeout(function () { rowsLabel(tr); }, 0); });
      all(tr, '[data-cl-tabpick][aria-controls]').forEach(function (p) {
        var menu = doc.getElementById(p.getAttribute('aria-controls')); if (!menu) return;
        /* bindPopovers보다 먼저 연결되므로, 메뉴가 열리기 직전에 그 줄의 탭으로 항목을 채웁니다. */
        p.addEventListener('click', function () {
          var list = rowList(tr, p.getAttribute('data-cl-tabpick')); menu.innerHTML = ''; if (!list) return;
          all(list, '[role="tab"]').forEach(function (t, i) {
            var bt = doc.createElement('button'); bt.type = 'button'; bt.className = 'cl-menu__item'; bt.setAttribute('role', 'menuitem'); bt.dataset.index = i;
            if (t.getAttribute('aria-selected') === 'true') bt.setAttribute('aria-current', 'true');
            bt.textContent = (t.querySelector('.cl-doctab__label') || t).textContent.trim();
            menu.appendChild(bt);
          });
        });
        menu.addEventListener('cl-select', function (e) {
          var list = rowList(tr, p.getAttribute('data-cl-tabpick')), it = e.detail && e.detail.item;
          var t = list && it && all(list, '[role="tab"]')[+it.dataset.index];
          if (t) tabSelect(list, t);
        });
      });
    });
  }

  /* ---------- 정보 칸(.cl-pane--info): 오른쪽 칸 하나에 기능(모드)을 바꿔 끼웁니다. 서랍 위에 서랍을 쌓지 않습니다 ---------- */
  function infoOf(x) {
    if (!x) return doc.querySelector('.cl-pane--info');
    if (typeof x === 'string') return doc.getElementById(x);
    return (x.closest && x.closest('.cl-pane--info')) || x;
  }
  function infoSync(pane) {
    var open = !pane.hasAttribute('data-collapsed');
    var dv = pane.previousElementSibling;
    if (dv && dv.classList.contains('cl-divider')) dv.setAttribute('aria-valuenow', open ? Math.round(pane.getBoundingClientRect().width) : 0);
    Array.prototype.slice.call(doc.querySelectorAll('[data-cl-info-toggle]')).forEach(function (b) {
      if (infoOf(b.getAttribute('data-cl-info-target')) === pane) b.setAttribute('aria-expanded', String(open));
    });
  }
  function infoMode(pane, mode, silent) {
    var modes = pane.querySelector('.cl-info__modes'); if (!modes || !mode) return null;
    var t = modes.querySelector('[role="tab"][data-mode="' + mode + '"]');
    if (t && t.getAttribute('aria-selected') !== 'true') tabSelect(modes, t, silent);
    infoModeAttr(pane);
    return t;
  }
  function infoCurrent(pane) { var t = pane.querySelector('.cl-info__modes [role="tab"][aria-selected="true"]'); return t ? t.getAttribute('data-mode') : null; }
  /* 칸에 지금 모드를 data-mode로 적고, '인쇄' 모드로 드나들 때 너비를 바꿔 끼웁니다(v6.5). */
  function infoModeAttr(pane) {
    var m = infoCurrent(pane), was = pane.getAttribute('data-mode');
    if (m === was) return;
    if (m) pane.setAttribute('data-mode', m); else pane.removeAttribute('data-mode');
    var wasP = was === 'print', isP = m === 'print';
    if (wasP !== isP) {
      var W = pane._clW = pane._clW || {}, key = pane._clDividerKey;
      if (was !== null) W[wasP ? 'print' : 'normal'] = pane.style.flexBasis;
      var nx = W[isP ? 'print' : 'normal'];
      if (nx == null && key) { var st = store2('pane:' + key + (isP ? ':print' : '')); if (st) nx = st + 'px'; }
      pane.style.flexBasis = nx || '';
      if (pane._clLimits) pane._clLimits();
    }
    if (isP) setTimeout(function () { all(pane, '.cl-preview').forEach(function (b) { if (b._clPreview) b._clPreview.refresh(); }); }, 30);
  }
  function infoOpen(pane, o) {
    pane = infoOf(pane); if (!pane) return null; o = o || {};
    var key = pane.getAttribute('data-cl-remember');
    pane.removeAttribute('data-collapsed');
    infoMode(pane, o.mode);
    if (key) store2('info:' + key, 'open');
    if (o.trigger) pane._clOpener = o.trigger;
    infoSync(pane);
    var mode = infoCurrent(pane);
    setTimeout(function () {
      var panel = null, t = pane.querySelector('.cl-info__modes [role="tab"][aria-selected="true"]');
      if (t && t.getAttribute('aria-controls')) panel = doc.getElementById(t.getAttribute('aria-controls'));
      var target = o.section ? (panel || pane).querySelector('[data-section="' + o.section + '"]') : null;
      if (target) target.scrollIntoView({ block: 'start', behavior: reduced() ? 'auto' : 'smooth' });
      if (o.focus === false) return;
      var f = target && target.querySelector('input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [contenteditable="true"]');
      if (!f) { f = target || panel || pane; if (!f.hasAttribute('tabindex')) f.setAttribute('tabindex', '-1'); }
      f.focus({ preventScroll: !!target });
    }, 30);
    emit(pane, 'cl-info-open', { mode: mode, section: o.section || null });
    return pane;
  }
  function infoClose(pane) {
    pane = infoOf(pane); if (!pane || pane.hasAttribute('data-collapsed')) return;
    var key = pane.getAttribute('data-cl-remember');
    var back = pane._clOpener; pane._clOpener = null;
    var had = pane.contains(doc.activeElement);
    pane.setAttribute('data-collapsed', '');
    if (key) store2('info:' + key, 'closed');
    infoSync(pane);
    if (had && back && back.focus && doc.contains(back)) back.focus();
    emit(pane, 'cl-info-close', {});
  }
  NS.panel = {
    open: infoOpen,
    close: infoClose,
    /* 닫혀 있으면 열고, 열려 있으면 같은 모드일 때 닫고 다른 모드면 그 모드로 바꿉니다. */
    toggle: function (pane, o) {
      pane = infoOf(pane); if (!pane) return null; o = o || {};
      if (pane.hasAttribute('data-collapsed') || (o.mode && o.mode !== infoCurrent(pane))) return infoOpen(pane, o);
      infoClose(pane); return pane;
    }
  };
  function bindInfo(root) {
    all(root, '.cl-pane--info').forEach(function (pane) {
      if (!once(pane, 'Info')) return;
      var key = pane.getAttribute('data-cl-remember');
      var st = key && store2('info:' + key);
      if (st === 'closed') pane.setAttribute('data-collapsed', ''); else if (st === 'open') pane.removeAttribute('data-collapsed');
      var modes = pane.querySelector('.cl-info__modes');
      if (modes) {
        var m = key && store2('info-mode:' + key); if (m) infoMode(pane, m, true);
        modes.addEventListener('cl-change', function (e) { var t = e.detail && e.detail.tab; if (key && t && t.getAttribute('data-mode')) store2('info-mode:' + key, t.getAttribute('data-mode')); infoModeAttr(pane); });
      }
      infoModeAttr(pane);
      /* 좁아서 본문 위에 덮여 있을 때만 Esc로 닫습니다(메뉴가 열려 있으면 메뉴가 먼저). */
      pane.addEventListener('keydown', function (e) {
        if (e.key !== 'Escape' || openLayer || pane.hasAttribute('data-collapsed')) return;
        if (getComputedStyle(pane).position !== 'absolute') return;
        e.preventDefault(); infoClose(pane);
      });
      infoSync(pane);
    });
    all(root, '[data-cl-info-open], [data-cl-info-toggle]').forEach(function (b) {
      if (!once(b, 'InfoOpen')) return;
      b.addEventListener('click', function () {
        var v = (b.getAttribute('data-cl-info-open') || b.getAttribute('data-cl-info-toggle') || '').split('#');
        var o = { mode: v[0] || undefined, section: v[1] || undefined, trigger: b };
        var p = infoOf(b.getAttribute('data-cl-info-target'));
        if (b.hasAttribute('data-cl-info-toggle')) NS.panel.toggle(p, o); else infoOpen(p, o);
      });
    });
    all(root, '[data-cl-info-close]').forEach(function (b) {
      if (!once(b, 'InfoClose')) return;
      b.addEventListener('click', function () { infoClose(b.closest('.cl-pane--info') || infoOf(b.getAttribute('data-cl-info-target'))); });
    });
  }

  /* ---------- 집중 모드: 작업대만 남기고 모두 접었다가, 다시 누르면 직전 배치로 돌아갑니다 ---------- */
  function focusScope(el) { return (el && el.closest && el.closest('.cl-split')) || doc.querySelector('.cl-split') || doc.body; }
  function focusSet(scope, on) {
    var was = scope.getAttribute('data-focus') === 'on';
    if (on == null) on = !was;
    if (on === was) return;
    if (on) {
      var snap = { side: scope.getAttribute('data-sidebar'), panes: [], rows: [] };
      Array.prototype.slice.call(scope.querySelectorAll('.cl-pane:not(.cl-pane--main)')).forEach(function (p) { snap.panes.push({ el: p, c: p.hasAttribute('data-collapsed') }); p.setAttribute('data-collapsed', ''); });
      Array.prototype.slice.call(scope.querySelectorAll('.cl-tabrows')).forEach(function (tr) { snap.rows.push({ el: tr, c: rowsCollapsed(tr) }); rowsSet(tr, TAB_ROWS.slice(), true); });
      scope._clFocus = snap;
      if (scope.classList.contains('cl-split')) scope.setAttribute('data-sidebar', 'hidden');
      scope.setAttribute('data-focus', 'on'); doc.documentElement.setAttribute('data-cl-focus-mode', 'on');
    } else {
      var s = scope._clFocus || { panes: [], rows: [] };
      s.panes.forEach(function (x) { if (x.c) x.el.setAttribute('data-collapsed', ''); else x.el.removeAttribute('data-collapsed'); });
      s.rows.forEach(function (x) { rowsSet(x.el, x.c, true); });
      if (scope.classList.contains('cl-split')) { if (s.side) scope.setAttribute('data-sidebar', s.side); else scope.removeAttribute('data-sidebar'); sideSync(scope); }
      scope.removeAttribute('data-focus'); doc.documentElement.removeAttribute('data-cl-focus-mode'); scope._clFocus = null;
    }
    Array.prototype.slice.call(scope.querySelectorAll('.cl-pane--info')).forEach(infoSync);
    Array.prototype.slice.call(doc.querySelectorAll('[data-cl-focus]')).forEach(function (b) { if (focusScope(b) === scope) b.setAttribute('aria-pressed', String(on)); });
    emit(scope, 'cl-change', { focus: on });
  }
  NS.focus = function (on, el) { focusSet(focusScope(el), on); return NS; };
  function bindFocus(root) {
    all(root, '[data-cl-focus]').forEach(function (b) {
      if (!once(b, 'Focus')) return;
      b.setAttribute('aria-pressed', String(focusScope(b).getAttribute('data-focus') === 'on'));
      b.addEventListener('click', function () { focusSet(focusScope(b)); });
    });
  }

  /* ---------- 쌓이는 칸: 연속된 위계(목록 → 기록 → 상세)를 오른쪽으로 쌓고, 지나간 칸은 세로 등줄기로 접힘 ---------- */
  function bindStack(root) {
    all(root, '.cl-cascade').forEach(function (stk) {
      if (!once(stk, 'Stack')) return;
      function index() { all(stk, '.cl-cascade__pane').forEach(function (p, i) { p.style.setProperty('--i', i); }); }
      index();
      stk.addEventListener('click', function (e) {
        var a = e.target.closest('[data-cl-open-pane]'); if (!a) return;
        e.preventDefault();
        var from = a.closest('.cl-cascade__pane'), tpl = doc.getElementById(a.getAttribute('data-cl-open-pane')); if (!tpl) return;
        all(from.parentElement, ':scope > .cl-cascade__pane').forEach(function (p) { if (p.compareDocumentPosition(from) & Node.DOCUMENT_POSITION_PRECEDING) p.remove(); });
        all(from, '[data-cl-open-pane]').forEach(function (x) { x.removeAttribute('aria-current'); }); a.setAttribute('aria-current', 'true');
        var pane = tpl.content.firstElementChild.cloneNode(true);
        stk.appendChild(pane); index(); NS.init(pane);
        NS.motion.enter(pane, 'rise');
        stk.scrollTo({ left: stk.scrollWidth, behavior: reduced() ? 'auto' : 'smooth' });
        var h = pane.querySelector('h2, h3'); if (h) { h.tabIndex = -1; h.focus({ preventScroll: true }); }
      });
      stk.addEventListener('click', function (e) {
        var sp = e.target.closest('.cl-cascade__spine'); if (!sp) return;
        var p = sp.closest('.cl-cascade__pane'); stk.scrollTo({ left: Math.max(0, p.offsetLeft - (+p.style.getPropertyValue('--i') || 0) * 40), behavior: reduced() ? 'auto' : 'smooth' });
      });
    });
  }

  /* ---------- 명령 팔레트: Ctrl/⌘+K, 글자로 거르기, 화살표, Enter ---------- */
  function bindPalette(root) {
    all(root, '.cl-palette').forEach(function (pal) {
      if (!once(pal, 'Palette')) return;
      var input = pal.querySelector('input'), list = pal.querySelector('[role="listbox"]'), scrim = pal.previousElementSibling && pal.previousElementSibling.classList.contains('cl-scrim') ? pal.previousElementSibling : null, opener = null;
      var opts = all(list, '[role="option"]');
      opts.forEach(function (o, i) { if (!o.id) o.id = (pal.id || 'pal') + '-o' + i; });
      function shown() { return opts.filter(function (o) { return !o.hidden; }); }
      function act(o) { opts.forEach(function (x) { x.setAttribute('aria-selected', String(x === o)); }); if (o) { input.setAttribute('aria-activedescendant', o.id); o.scrollIntoView({ block: 'nearest' }); } }
      function filter() {
        var q = input.value.trim().toLowerCase();
        opts.forEach(function (o) { o.hidden = q && o.textContent.toLowerCase().indexOf(q) < 0; });
        all(list, '.cl-palette__group').forEach(function (g) { g.hidden = !all(g, '[role="option"]').some(function (o) { return !o.hidden; }); });
        var empty = pal.querySelector('.cl-palette__empty'); if (empty) empty.hidden = shown().length > 0;
        act(shown()[0]);
      }
      function open() { opener = doc.activeElement; pal.setAttribute('data-open', 'true'); pal.removeAttribute('hidden'); if (scrim) scrim.setAttribute('data-show', 'true'); input.value = ''; filter(); setTimeout(function () { input.focus(); }, 30); }
      function close() { pal.setAttribute('data-open', 'false'); if (scrim) scrim.setAttribute('data-show', 'false'); if (opener && opener.focus) opener.focus(); }
      function run(o) { if (!o) return; emit(pal, 'cl-select', { item: o, value: o.getAttribute('data-value') || o.textContent.trim() }); close(); }
      pal.clOpen = open;
      input.setAttribute('role', 'combobox'); input.setAttribute('aria-expanded', 'true'); input.setAttribute('aria-controls', list.id || (list.id = (pal.id || 'pal') + '-list'));
      input.addEventListener('input', filter);
      input.addEventListener('keydown', function (e) {
        var s = shown(), i = s.indexOf(list.querySelector('[aria-selected="true"]'));
        if (e.key === 'ArrowDown') { e.preventDefault(); act(s[Math.min(s.length - 1, i + 1)]); }
        else if (e.key === 'ArrowUp') { e.preventDefault(); act(s[Math.max(0, i - 1)]); }
        else if (e.key === 'Enter') { e.preventDefault(); run(s[i]); }
        else if (e.key === 'Escape') { e.preventDefault(); close(); }
      });
      list.addEventListener('click', function (e) { var o = e.target.closest('[role="option"]'); if (o) run(o); });
      if (scrim) scrim.addEventListener('click', close);
      all(doc, '[data-cl-palette="' + pal.id + '"]').forEach(function (b) { b.addEventListener('click', open); });
      if (pal.hasAttribute('data-cl-hotkey')) doc.addEventListener('keydown', function (e) { if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); if (pal.getAttribute('data-open') === 'true') close(); else open(); } });
    });
  }

  /* ============ 자가 점검: SangsangClarity.audit() ============
     화면을 다 만든 뒤, 움직임이 멈춘 상태에서 브라우저 콘솔(또는 Playwright page.evaluate)로 실행합니다. errors가 0이어야 완료입니다.
     검사: 유리 다섯 층(흐림·둘레·반사광·손끝 빛·그림자)과 연결, 콘텐츠 층 유리, 밝은 페이지의 어두운 띠,
     시스템 밖 색, 장식 애니메이션, 토큰 밖 전환 시간, 화면당 채움 버튼, 금지 용어. */
  /* ============ 도움말: 툴팁·도움말 팝오버·팁 (v6.5, help.md) ============
     1) 툴팁 [data-cl-tip="문구"]: 아이콘 단추 같은 컨트롤 하나의 짧은 설명(60자 안쪽).
        마우스는 600ms 뒤, 다른 툴팁에서 넘어오면 바로(300ms 안). 키보드 포커스는 바로. Esc로 닫음, 툴팁 위로 마우스를 옮겨도 유지.
        터치에서는 띄우지 않습니다(문구는 aria-describedby로 화면 낭독기에 그대로 전달).
     2) 도움말 팝오버 .cl-help + .cl-popover: 패널·화면 전체 설명은 "?"를 눌러 엽니다(마우스 올림 아님).
     3) 팁 .cl-hint[data-cl-hint="키"]: 새 기능을 한 번 알려 주는 안쪽 팁. 닫으면 다시 나오지 않음(data-max 회까지). */
  var TIP = { el: null, timer: 0, hideTimer: 0, lastHide: 0, owner: null, n: 0 };
  function tipEl() {
    if (TIP.el) return TIP.el;
    var t = doc.createElement('div'); t.className = 'cl-tooltip cl-glass cl-glass--thick'; t.setAttribute('aria-hidden', 'true'); t.setAttribute('data-show', 'false');
    t.addEventListener('pointerenter', function () { clearTimeout(TIP.hideTimer); });
    t.addEventListener('pointerleave', function () { hideTip(); });
    doc.body.appendChild(t); TIP.el = t; return t;
  }
  function placeTip(trigger, t) {
    var r = trigger.getBoundingClientRect(), pref = trigger.getAttribute('data-cl-tip-place') || 'top', gap = 8, vw = window.innerWidth, vh = window.innerHeight;
    t.style.left = '0px'; t.style.top = '0px';
    var w = t.offsetWidth, h = t.offsetHeight, side = pref;
    if (side === 'top' && r.top - h - gap < 4) side = 'bottom';
    else if (side === 'bottom' && r.bottom + h + gap > vh - 4) side = 'top';
    else if (side === 'start' && r.left - w - gap < 4) side = 'end';
    else if (side === 'end' && r.right + w + gap > vw - 4) side = 'start';
    var x, y;
    if (side === 'top' || side === 'bottom') { x = r.left + r.width / 2 - w / 2; y = side === 'top' ? r.top - h - gap : r.bottom + gap; }
    else { y = r.top + r.height / 2 - h / 2; x = side === 'start' ? r.left - w - gap : r.right + gap; }
    x = Math.max(8, Math.min(x, vw - w - 8)); y = Math.max(8, Math.min(y, vh - h - 8));
    t.style.left = Math.round(x + window.scrollX) + 'px'; t.style.top = Math.round(y + window.scrollY) + 'px';
    t.setAttribute('data-side', side);
  }
  function showTip(trigger, instant) {
    clearTimeout(TIP.timer); clearTimeout(TIP.hideTimer);
    var go = function () {
      var t = tipEl(); t.textContent = trigger.getAttribute('data-cl-tip'); TIP.owner = trigger;
      placeTip(trigger, t); t.setAttribute('data-show', 'true');
    };
    var skip = Date.now() - TIP.lastHide < cssNum('--tip-skip', 300);
    if (instant || skip || (TIP.owner && TIP.el && TIP.el.getAttribute('data-show') === 'true')) go();
    else TIP.timer = setTimeout(go, cssNum('--tip-delay', 600));
  }
  function hideTip(now) {
    clearTimeout(TIP.timer);
    var go = function () { if (TIP.el && TIP.el.getAttribute('data-show') === 'true') { TIP.el.setAttribute('data-show', 'false'); TIP.lastHide = Date.now(); } TIP.owner = null; };
    if (now) go(); else { clearTimeout(TIP.hideTimer); TIP.hideTimer = setTimeout(go, 120); }
  }
  doc.addEventListener('keydown', function (e) { if (e.key === 'Escape' && TIP.owner) hideTip(true); }, true);
  window.addEventListener('scroll', function () { if (TIP.owner) hideTip(true); }, true);
  function bindTips(root) {
    all(root, '[data-cl-tip]').forEach(function (el) {
      if (!once(el, 'Tip')) return;
      /* 화면 낭독기용 설명: 눈에는 안 보이는 요소에 같은 문구를 두고 aria-describedby로 연결 */
      if (!el.getAttribute('aria-describedby')) {
        var d = doc.createElement('span'), id = 'cltip' + (++TIP.n); d.id = id; d.className = 'cl-sr'; d.textContent = el.getAttribute('data-cl-tip');
        el.insertAdjacentElement('afterend', d); el.setAttribute('aria-describedby', id);
      }
      el.addEventListener('pointerenter', function (e) { if (e.pointerType === 'mouse' || e.pointerType === 'pen') showTip(el, false); });
      el.addEventListener('pointerleave', function () { hideTip(false); });
      el.addEventListener('pointerdown', function () { hideTip(true); });
      el.addEventListener('focus', function () { if (el.matches(':focus-visible')) showTip(el, true); });
      el.addEventListener('blur', function () { hideTip(true); });
    });
  }
  /* 팁·첫 안내: 상태 셋
     - 처음 1회: data-max(기본 1)번 보이면 끝. "확인"(data-cl-hint-done)을 누르면 끝.
     - 1주일간 다시 보지 않기: data-cl-hint-snooze="7" 단추 → 7일 뒤 다시 보임(끝난 것으로 치지 않음).
     - 다시 열기: data-cl-hint-open="키" 단추 또는 SangsangClarity.hint.open(키). 끝난 팁도 사용자가 열면 보입니다. */
  function hintState(key) { var st = null; try { st = JSON.parse(localStorage.getItem(key) || 'null'); } catch (e) {} return st || { seen: 0, done: false, until: 0 }; }
  function hintSave(key, st) { try { localStorage.setItem(key, JSON.stringify(st)); } catch (e) {} }
  function bindHints(root) {
    all(root, '.cl-hint[data-cl-hint]').forEach(function (h) {
      if (!once(h, 'Hint')) return;
      var key = 'cl-hint:' + h.getAttribute('data-cl-hint'), st = hintState(key), max = +h.getAttribute('data-max') || 1;
      if (st.done || st.seen >= max || (st.until && Date.now() < st.until)) h.hidden = true;
      else { st.seen++; hintSave(key, st); h.hidden = false; }
      function close(mark) {
        mark(st); hintSave(key, st);
        var tk = h._clHintTk = (h._clHintTk || 0) + 1;
        exit(h, 'pop').then(function () { if (h._clHintTk !== tk) return; h.hidden = true; h.style.transform = ''; h.style.opacity = ''; });
        emit(h, 'cl-hint-close', { key: key, state: st });
      }
      all(h, '[data-cl-hint-done], [data-cl-hint-close]').forEach(function (b) { b.addEventListener('click', function () { close(function (x) { x.done = true; }); }); });
      all(h, '[data-cl-hint-snooze]').forEach(function (b) { b.addEventListener('click', function () { var d = +b.getAttribute('data-cl-hint-snooze') || 7; close(function (x) { x.until = Date.now() + d * 864e5; }); }); });
    });
    all(root, '[data-cl-hint-open]').forEach(function (b) {
      if (!once(b, 'HintOpen')) return;
      b.addEventListener('click', function () { NS.hint.open(b.getAttribute('data-cl-hint-open')); });
    });
  }
  NS.hint = {
    reset: function (k) { try { localStorage.removeItem('cl-hint:' + k); } catch (e) {} },
    open: function (k) { var h = doc.querySelector('.cl-hint[data-cl-hint="' + k + '"]'); if (!h) return; h._clHintTk = (h._clHintTk || 0) + 1; h.style.pointerEvents = ''; h.hidden = false; enter(h, 'pop'); var f = h.querySelector('button, a'); if (f) f.focus(); },
    state: function (k) { return hintState('cl-hint:' + k); }
  };

  /* ============ 카드 배치 .cl-cards (v6.5, layout.md) ============
     열 수는 화면이 아니라 카드 묶음 자신의 폭으로 정합니다(사이드바를 접거나 정보 칸을 열면 같은 규칙으로 다시 배치).
     CSS가 열을 계산하고, 이 스크립트는 1) 지금 열 수와 크기 단계를 data-cols·data-size로 알려 주고
     2) 사람이 누른 직후(사이드바 접기·칸 열기)에 열 수가 바뀌면 카드를 스프링으로 제자리에 옮깁니다(flip).
     창을 끌어 크기를 바꾸는 중에는 움직이지 않고 바로 배치합니다. */
  var LAST_ACT = 0;
  doc.addEventListener('pointerdown', function () { LAST_ACT = Date.now(); }, true);
  doc.addEventListener('keydown', function () { LAST_ACT = Date.now(); }, true);
  function sizeClass(w) { return w < 600 ? 'compact' : w < 840 ? 'medium' : w < 1200 ? 'expanded' : w < 1600 ? 'large' : 'xlarge'; }
  function countCols(g) {
    var kids = Array.prototype.filter.call(g.children, function (k) { return k.offsetParent !== null; });
    if (!kids.length) return 0;
    var cs = getComputedStyle(g).gridTemplateColumns; return cs && cs !== 'none' ? cs.split(' ').filter(Boolean).length : 1;
  }
  function bindCards(root) {
    all(root, '.cl-cards').forEach(function (g) {
      if (!once(g, 'Cards')) return;
      var prevRects = null, prevCols = 0;
      function snap() { return Array.prototype.map.call(g.children, function (k) { return k.getBoundingClientRect(); }); }
      function update() {
        var w = g.clientWidth, cols = countCols(g);
        g.setAttribute('data-size', sizeClass(w)); g.setAttribute('data-cols', String(cols));
        if (prevCols && cols !== prevCols) {
          emit(g, 'cl-change', { cols: cols, size: sizeClass(w) });
          var explicit = Date.now() - LAST_ACT < 900;
          if (explicit && prevRects && !reduced() && !g.hasAttribute('data-cl-static')) {
            Array.prototype.forEach.call(g.children, function (k, i) {
              var a = prevRects[i]; if (!a) return; var b = k.getBoundingClientRect();
              var dx = a.left - b.left, dy = a.top - b.top; if (Math.abs(dx) < 1 && Math.abs(dy) < 1) return;
              animate(k, { x: 0, y: 0 }, { from: { x: dx, y: dy }, spring: 'smooth' });
            });
          }
        }
        prevCols = cols; prevRects = snap();
      }
      update();
      if (window.ResizeObserver) new ResizeObserver(function () { update(); }).observe(g);
      /* 사이드바 접기처럼 폭이 미끄러지며 바뀌는 동안의 마지막 위치를 계속 기억 */
      g.addEventListener('transitionend', function () { prevRects = snap(); });
    });
  }

  /* ============ 업무 패턴 (v6.5, business-patterns.md) ============
     NS.colors   : 데이터 색(과목 기본색·색 세트), 바탕에 맞춘 글자색
     NS.timetable: 위치가 뜻인 격자(시간표). 고정열, 칸 편집기, 합치기·줄이기, 옮기기, 키보드
     NS.save     : 저장 상태와 복구(서버 확인 뒤에만 저장됨, 사유·고칠 곳·다시 시도·변경 취소·계속 편집)
     NS.sync     : 가져오기·골라 가져오기·동기화 미리보기와 결과(같은 요청 키로 중복 생성 막기)
     NS.a4       : 화면 미리보기와 인쇄를 같은 내용으로 */
  var COLORS = {
    /* v6.6: 과목 기본색은 조화 스펙트럼(--cl-hue-*)의 밝은 면(fill) 값. 배정은 AIO 과목 상징색과 같은 색상
       (국어 빨강·수학 주황·영어 하늘·사회 보라·과학 초록). 테마와 무관한 문서색이라 HEX로 둡니다. */
    subjects: { '국어': '#FED9D3', '수학': '#FFDBC1', '영어': '#B9ECFF', '과학': '#CEEFBD', '사회': '#EADBFE', '자습': '#E9ECEF' },
    /* 2022 개정 교과군 → 스펙트럼 색 이름. 화면에서는 var(--cl-hue-<이름>-fill|tint|mark|ink)로 씁니다. */
    groups: { '국어': 'red', '수학': 'orange', '영어': 'sky', '사회': 'purple', '역사': 'purple', '도덕': 'purple', '과학': 'green', '정보': 'teal',
      '기술·가정': 'lime', '체육': 'blue', '예술': 'pink', '음악': 'pink', '미술': 'pink', '제2외국어': 'yellow', '한문': 'yellow', '교양': '' },
    hues: ['blue', 'sky', 'teal', 'green', 'lime', 'yellow', 'orange', 'red', 'pink', 'purple'],
    sets: [
      { name: '연한 색', colors: ['#FFE3E3', '#FFE8CC', '#FFF3BF', '#D3F9D8', '#D0EBFF'] },
      { name: '중간 색', colors: ['#FFA8A8', '#FFC078', '#FFE066', '#8CE99A', '#74C0FC'] },
      { name: '진한 색', colors: ['#E03131', '#E8590C', '#F08C00', '#2F9E44', '#1971C2'] },
      { name: '브랜드·무채색', colors: ['#0054A7', '#0788C7', '#6ABD2E', '#E43D68', '#868E96'] }
    ]
  };
  function hexLum(hex) {
    var h = String(hex || '').replace('#', ''); if (h.length === 3) h = h.replace(/./g, '$&$&'); if (!/^[0-9a-f]{6}$/i.test(h)) return 1;
    var c = [0, 2, 4].map(function (i) { var v = parseInt(h.substr(i, 2), 16) / 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); });
    return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
  }
  /* 저장한 바탕색은 그대로 두고(다크에서도), 글자만 대비가 높은 쪽(검정 #0F1216 / 흰색)으로 */
  function inkFor(hex) { var L = hexLum(hex); return (L + 0.05) / (0.0062 + 0.05) >= (1.05) / (L + 0.05) ? '#0F1216' : '#FFFFFF'; }
  NS.colors = { subjects: COLORS.subjects, sets: COLORS.sets, groups: COLORS.groups, hues: COLORS.hues, ink: inkFor, isHex: function (v) { return /^#?[0-9a-f]{6}$/i.test(String(v || '').trim()); },
    /* 교과군 이름(또는 과목 앞부분)을 스펙트럼 색 이름으로. 모르면 ''(무채색) */
    groupHue: function (name) { name = String(name || ''); if (COLORS.groups[name] != null) return COLORS.groups[name]; var k = Object.keys(COLORS.groups).filter(function (g) { return name.indexOf(g) === 0; })[0]; return k ? COLORS.groups[k] : ''; } };
  function typingTarget(e) {
    var t = e.target; if (e.isComposing || e.keyCode === 229) return true;
    return !!(t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName)) && !(t.type === 'checkbox' || t.type === 'radio' || t.type === 'button'));
  }

  /* ---------- 시간표 ----------
     cfg = { days:[{key,label,split?:['응시','대비']}], slots:[{key,label}], blocks:[{id,col,start,span,subject,book,method,one,color}],
             subjects: ['국어',...], editable:true, label:'주간시간표' }
     col은 펼친 열 번호(나눈 날은 두 열). 반환: {data(), set(blocks), select(col,row), open(), on(evt,fn)} */
  NS.timetable = function (wrap, cfg) {
    var cols = [], api = {}, sel = { c: 0, r: 0 }, move = null, editor = null, listeners = {};
    cfg.days.forEach(function (d, di) { (d.split || [null]).forEach(function (sub, si) { cols.push({ day: di, sub: sub, label: d.label, last: !d.split || si === d.split.length - 1, splitL: d.split && si < d.split.length - 1 }); }); });
    var R = cfg.slots.length, C = cols.length;
    function fire(n, d) { (listeners[n] || []).forEach(function (f) { f(d); }); emit(wrap, 'cl-change', { kind: n, detail: d }); }
    api.on = function (n, f) { (listeners[n] = listeners[n] || []).push(f); return api; };
    function at(c, r) { for (var i = 0; i < cfg.blocks.length; i++) { var b = cfg.blocks[i]; if (b.col === c && r >= b.start && r < b.start + b.span) return b; } return null; }
    function render() {
      var h = '<table class="cl-tt" role="grid" aria-label="' + esc(cfg.label || '시간표') + '" aria-rowcount="' + (R + 1) + '"><colgroup><col style="width:var(--tt-head)">' + cols.map(function () { return '<col>'; }).join('') + '</colgroup><thead><tr><th scope="col">시간</th>';
      cfg.days.forEach(function (d) { h += '<th scope="colgroup" colspan="' + (d.split ? d.split.length : 1) + '"' + (d.split ? '' : ' rowspan="2"') + '>' + esc(d.label) + '</th>'; });
      h += '</tr>';
      if (cfg.days.some(function (d) { return d.split; })) { h += '<tr><th aria-hidden="true"></th>'; cfg.days.forEach(function (d) { if (d.split) d.split.forEach(function (s) { h += '<th scope="col">' + esc(s) + '</th>'; }); }); h += '</tr>'; }
      h += '</thead><tbody>';
      for (var r = 0; r < R; r++) {
        h += '<tr><th scope="row">' + esc(cfg.slots[r].label) + '</th>';
        for (var c = 0; c < C; c++) {
          var b = at(c, r); if (b && b.start !== r) continue;
          var cls = cols[c].splitL ? ' class="is-split-l"' : '';
          var dayLab = cfg.days[cols[c].day].label + (cols[c].sub ? ' ' + cols[c].sub : '');
          var lab = dayLab + ' ' + cfg.slots[r].label + (b ? ', ' + (b.subject || '') + (b.book ? ' ' + b.book : '') + (b.method ? ' ' + b.method : '') + (b.one ? ', 개별지도' : '') + (b.span > 1 ? ', ' + b.span + '칸' : '') : ', 빈 칸');
          h += '<td role="gridcell"' + cls + ' data-c="' + c + '" data-r="' + r + '"' + (b ? ' rowspan="' + b.span + '"' : '') + ' tabindex="-1" aria-label="' + esc(lab) + '">';
          if (b) { var bg = b.color || (cfg.subjectColors || COLORS.subjects)[b.subject] || '#E9ECEF'; h += '<span class="cl-tt__block" data-cl-data data-span="' + b.span + '" style="--cell-bg:' + bg + ';--cell-ink:' + inkFor(bg) + '"><b>' + esc(b.subject || '') + '</b>' + (b.book ? '<small>' + esc(b.book) + '</small>' : '') + (b.method ? '<small>' + esc(b.method) + '</small>' : '') + '</span>' + (b.one ? '<span class="cl-tt__one" aria-hidden="true">개</span>' : '') + (b.changed ? '<span class="cl-tt__changed" aria-hidden="true"></span>' : ''); }
          h += '</td>';
        }
        h += '</tr>';
      }
      wrap.innerHTML = h + '</tbody></table>';
      paintSel(false);
    }
    function cellEl(c, r) {
      var b = at(c, r); if (b) r = b.start;
      return wrap.querySelector('td[data-c="' + c + '"][data-r="' + r + '"]');
    }
    /* 고정열 뒤로 숨지 않게: 칸 왼쪽이 고정열 오른쪽보다 왼쪽이면 그만큼 스크롤 */
    function reveal(td) {
      var head = wrap.querySelector('th[scope="row"]'), hw = head ? head.getBoundingClientRect().width : 0;
      var wr = wrap.getBoundingClientRect(), r = td.getBoundingClientRect(), pad = 4;
      if (r.left < wr.left + hw + pad) wrap.scrollLeft -= (wr.left + hw + pad - r.left);
      else if (r.right > wr.right - pad) wrap.scrollLeft += (r.right - wr.right + pad);
      var th = wrap.querySelector('thead'), hh = th ? th.getBoundingClientRect().height : 0;
      if (r.top < wr.top + hh + pad) wrap.scrollTop -= (wr.top + hh + pad - r.top);
      else if (r.bottom > wr.bottom - pad) wrap.scrollTop += (r.bottom - wr.bottom + pad);
    }
    api.reveal = reveal;
    function paintSel(focus) {
      all(wrap, 'td[aria-selected]').forEach(function (x) { x.removeAttribute('aria-selected'); x.tabIndex = -1; });
      all(wrap, 'td[data-move]').forEach(function (x) { x.removeAttribute('data-move'); });
      var td = cellEl(sel.c, sel.r); if (!td) return;
      td.setAttribute('aria-selected', 'true'); td.tabIndex = 0;
      if (move) { var f = cellEl(move.c, move.r); if (f) f.setAttribute('data-move', 'from'); if (f !== td) td.setAttribute('data-move', 'to'); }
      if (focus) { td.focus({ preventScroll: true }); reveal(td); }
    }
    api.select = function (c, r, focus) { sel.c = Math.max(0, Math.min(C - 1, c)); sel.r = Math.max(0, Math.min(R - 1, r)); paintSel(focus !== false); fire('select', { c: sel.c, r: sel.r, block: at(sel.c, sel.r) }); };
    api.selected = function () { return { c: sel.c, r: sel.r, block: at(sel.c, sel.r), day: cfg.days[cols[sel.c].day], sub: cols[sel.c].sub, slot: cfg.slots[sel.r] }; };
    api.data = function () { return cfg.blocks; };
    api.set = function (blocks) { cfg.blocks = blocks; render(); };
    api.columns = function () { return cols; };
    function changed(b) { b.changed = true; render(); fire('edit', { block: b, blocks: cfg.blocks }); }
    function free(c, r, ignore) { var b = at(c, r); return r < R && (!b || b === ignore); }
    api.merge = function (b, d) {
      if (!b) return false;
      if (d > 0) { if (!free(b.col, b.start + b.span, b)) { NS.toast && NS.toast('아래 칸이 비어 있지 않아 합칠 수 없습니다.', { tone: 'warning' }); return false; } b.span++; }
      else { if (b.span <= 1) return false; b.span--; }
      changed(b); return true;
    };
    wrap.addEventListener('click', function (e) { var td = e.target.closest('td[data-c]'); if (!td) return; sel.c = +td.dataset.c; sel.r = +td.dataset.r; paintSel(true); });
    wrap.addEventListener('contextmenu', function (e) { var td = e.target.closest('td[data-c]'); if (!td || cfg.editable === false) return; e.preventDefault(); sel.c = +td.dataset.c; sel.r = +td.dataset.r; paintSel(true); api.open(); });
    wrap.addEventListener('dblclick', function (e) { var td = e.target.closest('td[data-c]'); if (td && cfg.editable !== false) api.open(); });
    wrap.addEventListener('keydown', function (e) {
      if (!e.target.closest('td[data-c]')) return;
      var k = e.key, b = at(sel.c, sel.r), dr = 0, dc = 0;
      if (k === 'ArrowUp') dr = -1; if (k === 'ArrowDown') dr = 1; if (k === 'ArrowLeft') dc = -1; if (k === 'ArrowRight') dc = 1;
      if (dr || dc) {
        e.preventDefault();
        var nr = sel.r + dr; if (dr > 0 && b && !move) nr = b.start + b.span; if (dr < 0 && b && !move) nr = b.start - 1;
        api.select(sel.c + dc, nr); return;
      }
      if (k === 'Home') { e.preventDefault(); api.select(0, sel.r); return; }
      if (k === 'End') { e.preventDefault(); api.select(C - 1, sel.r); return; }
      if (cfg.editable === false) return;
      if (k === 'Enter' && move) { e.preventDefault(); api.drop(); return; }
      if (k === 'Escape' && move) { e.preventDefault(); move = null; paintSel(true); NS.toast && NS.toast('옮기기를 취소했습니다.'); return; }
      if (k === 'Enter' || k === 'F2' || k === 'ContextMenu' || (k === 'F10' && e.shiftKey)) { e.preventDefault(); api.open(); return; }
      if ((k === '+' || k === '=') && b) { e.preventDefault(); api.merge(b, 1); api.select(sel.c, b.start); return; }
      if (k === '-' && b) { e.preventDefault(); api.merge(b, -1); api.select(sel.c, b.start); return; }
      if ((k === 'Delete' || k === 'Backspace') && b) { e.preventDefault(); cfg.blocks.splice(cfg.blocks.indexOf(b), 1); render(); fire('edit', { removed: b, blocks: cfg.blocks }); api.select(sel.c, sel.r); return; }
      if ((k === 'm' || k === 'ㅡ') && b && !e.ctrlKey && !e.metaKey) { e.preventDefault(); api.startMove(); }
    });
    api.startMove = function () { var b = at(sel.c, sel.r); if (!b) return; move = { c: b.col, r: b.start, block: b }; paintSel(true); NS.toast && NS.toast('옮길 칸으로 이동한 뒤 Enter. 취소는 Esc.'); };
    api.drop = function () {
      if (!move) return; var b = move.block;
      for (var i = 0; i < b.span; i++) if (!free(sel.c, sel.r + i, b)) { NS.toast && NS.toast('그 자리에 다른 일정이 있어 옮길 수 없습니다.', { tone: 'warning' }); return; }
      b.col = sel.c; b.start = sel.r; move = null; changed(b); api.select(b.col, b.start);
    };

    /* 칸 편집기: 우클릭·Enter·F2·더블클릭 → 같은 칸 옆에 */
    function buildEditor() {
      var ed = doc.createElement('div'); ed.className = 'cl-editor cl-glass cl-glass--thick'; ed.setAttribute('role', 'dialog'); ed.setAttribute('aria-modal', 'false'); ed.tabIndex = -1;
      ed.innerHTML = '<div class="cl-editor__head"><span class="cl-editor__where"></span><button class="cl-btn cl-btn--icon cl-btn--sm cl-btn--plain" data-ed="close" aria-label="편집 닫기">✕</button></div>' +
        '<label class="cl-editor__row"><span>개별지도</span><span><input type="checkbox" data-ed="one"> 개별지도 시간</span></label>' +
        '<label class="cl-editor__row"><span>과목</span><select class="cl-input" data-ed="subject">' + (cfg.subjects || Object.keys(COLORS.subjects)).map(function (s) { return '<option>' + esc(s) + '</option>'; }).join('') + '</select></label>' +
        '<label class="cl-editor__row"><span>교재</span><input class="cl-input" data-ed="book" placeholder="교재 이름"></label>' +
        '<label class="cl-editor__row"><span>방식·분량</span><input class="cl-input" data-ed="method" placeholder="예: 개념 2단원"></label>' +
        '<div class="cl-swatches"><div class="cl-swatches__head"><button class="cl-btn cl-btn--icon cl-btn--sm cl-btn--plain" data-ed="setprev" aria-label="이전 색 세트">‹</button><span class="cl-swatches__name" aria-live="polite"></span><button class="cl-btn cl-btn--icon cl-btn--sm cl-btn--plain" data-ed="setnext" aria-label="다음 색 세트">›</button></div><div class="cl-swatches__row" role="group" aria-label="색"></div>' +
        '<div class="cl-colorcode" hidden><input class="cl-input" data-ed="hex" placeholder="#A5D8FF" aria-label="색코드" maxlength="7"><button class="cl-btn cl-btn--gray cl-btn--sm" data-ed="eyedrop">스포이트</button></div></div>' +
        '<div class="cl-toolbar"><button class="cl-btn cl-btn--gray cl-btn--sm" data-ed="merge">합치기 +</button><button class="cl-btn cl-btn--gray cl-btn--sm" data-ed="shrink">줄이기 −</button><button class="cl-btn cl-btn--gray cl-btn--sm" data-ed="move">옮기기</button><span class="cl-toolbar__spacer"></span><button class="cl-btn cl-btn--plain cl-btn--sm cl-btn--destructive-plain" data-ed="clear">비우기</button></div>' +
        '<div class="cl-toolbar"><span class="cl-editor__keys"><kbd>1</kbd>~<kbd>5</kbd> 색 · <kbd>←</kbd><kbd>→</kbd><kbd>`</kbd> 세트 · <kbd>+</kbd><kbd>−</kbd> 칸 · <kbd>Esc</kbd> 닫기</span><span class="cl-toolbar__spacer"></span><button class="cl-btn cl-btn--filled cl-btn--sm" data-ed="done">완료</button></div>';
      doc.body.appendChild(ed); return ed;
    }
    var setIx = 0;
    function drawSwatches(ed, b) {
      var set = COLORS.sets[setIx];
      ed.querySelector('.cl-swatches__name').textContent = '세트 ' + (setIx + 1) + '/' + COLORS.sets.length + ' · ' + set.name;
      ed.querySelector('.cl-swatches__row').innerHTML = set.colors.map(function (c, i) { return '<button class="cl-swatch" style="--sw:' + c + '" data-color="' + c + '" data-key="' + (i + 1) + '" aria-label="색 ' + (i + 1) + ' ' + c + '" aria-pressed="' + (b && String(b.color).toUpperCase() === c) + '"></button>'; }).join('');
    }
    api.open = function () {
      var td = cellEl(sel.c, sel.r); if (!td) return;
      var b = at(sel.c, sel.r), isNew = !b;
      if (!b) { b = { id: 'b' + Date.now(), col: sel.c, start: sel.r, span: 1, subject: (cfg.subjects || Object.keys(COLORS.subjects))[0], book: '', method: '', one: false, color: '' }; }
      var ed = editor || (editor = buildEditor()), work = JSON.parse(JSON.stringify(b));
      var d = api.selected(); ed.querySelector('.cl-editor__where').textContent = d.day.label + (d.sub ? ' ' + d.sub : '') + ' · ' + d.slot.label + (isNew ? ' · 새 일정' : '');
      ed.setAttribute('aria-label', '칸 편집 ' + ed.querySelector('.cl-editor__where').textContent);
      ed.querySelector('[data-ed="one"]').checked = !!work.one;
      ed.querySelector('[data-ed="subject"]').value = work.subject;
      ed.querySelector('[data-ed="book"]').value = work.book || '';
      ed.querySelector('[data-ed="method"]').value = work.method || '';
      ed.querySelector('.cl-colorcode').hidden = true;
      drawSwatches(ed, work);
      td.setAttribute('data-editing', 'true');
      /* 칸 오른쪽(모자라면 왼쪽·아래)에 */
      ed.setAttribute('data-open', 'true');
      var r = td.getBoundingClientRect(), w = ed.offsetWidth, h = ed.offsetHeight, x = r.right + 8, y = r.top;
      /* 좁은 화면: 아래쪽 시트처럼 붙이고, 고른 칸이 시트 위에 보이도록 화면을 올립니다 */
      if (window.innerWidth < 600) {
        ed.setAttribute('data-docked', 'true'); ed.style.left = ''; ed.style.top = '';
        var top = window.innerHeight - ed.offsetHeight - 8; doc.body.style.paddingBottom = (ed.offsetHeight + 16) + 'px';
        if (r.bottom > top - 8) window.scrollBy(0, r.bottom - top + 16);
        if (td.getBoundingClientRect().top < 8) window.scrollBy(0, td.getBoundingClientRect().top - 60);
      } else ed.removeAttribute('data-docked');
      if (x + w > window.innerWidth - 8) x = r.left - w - 8;
      if (x < 8) { x = Math.max(8, Math.min(r.left, window.innerWidth - w - 8)); y = r.bottom + 8; }
      if (y + h > window.innerHeight - 8) y = Math.max(8, window.innerHeight - h - 8);
      if (!ed.hasAttribute('data-docked')) { ed.style.left = x + 'px'; ed.style.top = y + 'px'; }
      setTimeout(function () { ed.querySelector('[data-ed="subject"]').focus(); }, 20);
      function commit(close) {
        work.one = ed.querySelector('[data-ed="one"]').checked;
        work.subject = ed.querySelector('[data-ed="subject"]').value;
        work.book = ed.querySelector('[data-ed="book"]').value.trim();
        work.method = ed.querySelector('[data-ed="method"]').value.trim();
        if (isNew) { cfg.blocks.push(work); b = work; isNew = false; } else Object.keys(work).forEach(function (k) { b[k] = work[k]; });
        changed(b);
        if (close) shut(); else { api.select(b.col, b.start, false); var t2 = cellEl(b.col, b.start); if (t2) t2.setAttribute('data-editing', 'true'); }
      }
      function shut() { ed.setAttribute('data-open', 'false'); doc.body.style.paddingBottom = ''; all(wrap, '[data-editing]').forEach(function (x) { x.removeAttribute('data-editing'); }); ed.onkeydown = ed.onclick = ed.oncontextmenu = null; api.select(sel.c, sel.r); }
      function pick(c) { work.color = c; drawSwatches(ed, work); }
      ed.onclick = function (e) {
        var t = e.target.closest('[data-ed], .cl-swatch'); if (!t) return;
        var a = t.getAttribute('data-ed');
        if (t.classList.contains('cl-swatch')) { pick(t.dataset.color); return; }
        if (a === 'close') shut();
        if (a === 'done') commit(true);
        if (a === 'setprev') { setIx = (setIx + COLORS.sets.length - 1) % COLORS.sets.length; drawSwatches(ed, work); }
        if (a === 'setnext') { setIx = (setIx + 1) % COLORS.sets.length; drawSwatches(ed, work); }
        if (a === 'merge' || a === 'shrink') { commit(false); api.merge(b, a === 'merge' ? 1 : -1); var t3 = cellEl(b.col, b.start); if (t3) t3.setAttribute('data-editing', 'true'); }
        if (a === 'move') { commit(true); api.startMove(); }
        if (a === 'clear') { if (!isNew) { cfg.blocks.splice(cfg.blocks.indexOf(b), 1); render(); fire('edit', { removed: b, blocks: cfg.blocks }); } shut(); }
        if (a === 'eyedrop') {
          if (window.EyeDropper) new window.EyeDropper().open().then(function (r) { pick(r.sRGBHex.toUpperCase()); ed.querySelector('[data-ed="hex"]').value = r.sRGBHex.toUpperCase(); }).catch(function () {});
          else NS.toast && NS.toast('이 브라우저는 스포이트를 지원하지 않습니다. 색코드를 입력해 주세요.');
        }
      };
      /* 색 칸의 보조 메뉴: 우클릭·길게 누르기·Shift+F10 → 색코드와 스포이트 */
      ed.oncontextmenu = function (e) { if (e.target.closest('.cl-swatch, .cl-swatches')) { e.preventDefault(); var cc = ed.querySelector('.cl-colorcode'); cc.hidden = false; var i = cc.querySelector('input'); i.value = work.color || ''; i.focus(); } };
      ed.querySelector('[data-ed="hex"]').oninput = function (e) { var v = e.target.value.trim(); if (/^#?[0-9a-f]{6}$/i.test(v)) pick(('#' + v.replace('#', '')).toUpperCase()); };
      ed.onkeydown = function (e) {
        if (e.key === 'Escape') { e.preventDefault(); shut(); return; }
        if (e.key === 'Tab') { var f = all(ed, 'button, input, select').filter(function (x) { return x.offsetParent !== null; }); var i = f.indexOf(doc.activeElement); if (e.shiftKey && i <= 0) { e.preventDefault(); f[f.length - 1].focus(); } else if (!e.shiftKey && i === f.length - 1) { e.preventDefault(); f[0].focus(); } return; }
        if (e.key === 'F10' && e.shiftKey && e.target.classList.contains('cl-swatch')) { e.preventDefault(); ed.oncontextmenu({ target: e.target, preventDefault: function () {} }); return; }
        /* 글자를 입력하는 칸·한글 조합 중에는 단축키를 가로채지 않습니다 */
        if (typingTarget(e)) { if (e.key === 'Enter' && e.target.tagName === 'INPUT' && e.target.dataset.ed !== 'hex') { e.preventDefault(); commit(true); } return; }
        if (e.ctrlKey || e.metaKey || e.altKey) return;
        if (/^[1-5]$/.test(e.key)) { e.preventDefault(); pick(COLORS.sets[setIx].colors[+e.key - 1]); return; }
        if (e.key === 'ArrowRight' || e.key === '`') { e.preventDefault(); setIx = (setIx + 1) % COLORS.sets.length; drawSwatches(ed, work); return; }
        if (e.key === 'ArrowLeft' || e.key === '~') { e.preventDefault(); setIx = (setIx + COLORS.sets.length - 1) % COLORS.sets.length; drawSwatches(ed, work); return; }
        if (e.key === '+' || e.key === '=') { e.preventDefault(); ed.querySelector('[data-ed="merge"]').click(); return; }
        if (e.key === '-') { e.preventDefault(); ed.querySelector('[data-ed="shrink"]').click(); return; }
        if (e.key === 'Enter' && !e.target.matches('button')) { e.preventDefault(); commit(true); }
      };
    };
    doc.addEventListener('pointerdown', function (e) { if (editor && editor.getAttribute('data-open') === 'true' && !editor.contains(e.target) && !wrap.contains(e.target)) { editor.setAttribute('data-open', 'false'); doc.body.style.paddingBottom = ''; all(wrap, '[data-editing]').forEach(function (x) { x.removeAttribute('data-editing'); }); } });
    render();
    wrap.clTimetable = api;
    return api;
  };

  /* ---------- 저장 상태와 복구 ----------
     NS.save(bar, { snapshot(): 문자열, restore(saved), save(snap): Promise<{ok, savedAt} | {ok:false, reason, issues:[{label, field, target}]}> })
     · 서버가 확인하기 전에는 "저장됨"을 쓰지 않습니다. · 되돌려 저장본과 같아지면 바로 "변경 없음". */
  NS.save = function (bar, o) {
    var saved = o.snapshot(), state = 'clean', last = null, api = {};
    bar.classList.add('cl-save'); bar.setAttribute('role', 'region'); bar.setAttribute('aria-label', '저장 상태');
    function t(d) { if (!d) return ''; return ('0' + d.getHours()).slice(-2) + ':' + ('0' + d.getMinutes()).slice(-2); }
    function draw() {
      bar.setAttribute('data-state', state);
      var h = '<div class="cl-save__row"><span class="cl-save__state" role="status">' +
        ({ clean: last ? '저장됨 · ' + t(last) : '변경 없음', dirty: '저장하지 않은 변경 ' + api.count() + '건', saving: '저장하는 중', saved: '저장됨 · ' + t(last), failed: '저장하지 못했습니다' })[state] + '</span>';
      if (state === 'dirty') h += '<span class="cl-save__actions"><button class="cl-btn cl-btn--gray cl-btn--sm" data-sv="revert">변경 취소</button><button class="cl-btn cl-btn--filled cl-btn--sm" data-sv="save">저장</button></span>';
      if (state === 'saving') h += '<span class="cl-save__actions"><span class="cl-spinner" aria-hidden="true"></span></span>';
      h += '</div>';
      if (state === 'failed') {
        h += '<p class="cl-save__detail">' + esc(api.fail.reason || '저장 중 문제가 생겼습니다.') + ' 변경한 내용은 이 화면에 그대로 남아 있습니다.</p>';
        if (api.fail.issues && api.fail.issues.length) h += '<ul class="cl-save__issues">' + api.fail.issues.map(function (x, i) { return '<li><span class="cl-badge cl-badge--danger">' + esc(x.label) + '</span>' + (x.target ? '<button class="cl-btn cl-btn--plain cl-btn--sm" data-sv="go" data-i="' + i + '">고치러 가기 ›</button>' : '') + '</li>'; }).join('') + '</ul>';
        h += '<div class="cl-save__row"><span class="cl-save__actions" style="margin-left:0"><button class="cl-btn cl-btn--filled cl-btn--sm" data-sv="save">다시 시도</button><button class="cl-btn cl-btn--gray cl-btn--sm" data-sv="revert">변경 취소</button><button class="cl-btn cl-btn--gray cl-btn--sm" data-sv="keep">계속 편집</button></span></div>';
      }
      bar.innerHTML = h;
    }
    api.count = function () { return o.count ? o.count() : 1; };
    api.state = function () { return state; };
    api.dirty = function () { return o.snapshot() !== saved; };
    api.change = function () { if (state === 'saving') return; state = api.dirty() ? 'dirty' : (last ? 'saved' : 'clean'); draw(); emit(bar, 'cl-change', { state: state }); };
    api.save = function () {
      if (!api.dirty()) { api.change(); return Promise.resolve(true); }
      var snap = o.snapshot(); state = 'saving'; draw();
      return Promise.resolve(o.save(snap)).then(function (r) {
        if (r && r.ok) { saved = snap; last = r.savedAt ? new Date(r.savedAt) : new Date(); state = api.dirty() ? 'dirty' : 'saved'; draw(); emit(bar, 'cl-saved', r); return true; }
        api.fail = r || {}; state = 'failed'; draw(); emit(bar, 'cl-save-failed', r); var b = bar.querySelector('[data-sv="go"], [data-sv="save"]'); if (b) b.focus(); return false;
      }, function (err) { api.fail = { reason: '서버에 연결하지 못했습니다(' + (err && err.message || '네트워크') + ').' }; state = 'failed'; draw(); return false; });
    };
    api.revert = function () { o.restore(saved); state = last ? 'saved' : 'clean'; draw(); emit(bar, 'cl-change', { state: state, reverted: true }); };
    /* 나가도 되는지: 저장본과 같으면 바로 true. 다르면 false(화면이 선택지를 보여 줌) */
    api.canLeave = function () { return !api.dirty(); };
    bar.addEventListener('click', function (e) {
      var b = e.target.closest('[data-sv]'); if (!b) return; var a = b.dataset.sv;
      if (a === 'save') api.save(); if (a === 'revert') api.revert(); if (a === 'keep') { state = 'dirty'; draw(); }
      if (a === 'go') { var x = api.fail.issues[+b.dataset.i], el = typeof x.target === 'string' ? doc.querySelector(x.target) : x.target; if (el) { if (el.closest('[data-col]')) emit(el, 'cl-reveal', {}); el.scrollIntoView({ block: 'center' }); el.focus(); el.setAttribute('aria-invalid', 'true'); } }
    });
    window.addEventListener('beforeunload', function (e) { if (api.dirty()) { e.preventDefault(); e.returnValue = ''; } });
    draw();
    return api;
  };

  /* ---------- 버전 목록 ----------
     NS.versions(ul, { items:[{id,name}], current:id, select(id), rename(id,name), remove(id) })
     · 이름 바꾸기: 더블클릭 또는 F2 → Enter 저장, Esc 취소(한글 조합 중 Enter는 무시)
     · 삭제: 마우스 올림·포커스·터치에서 보이는 단추 → 같은 줄에서 확인 */
  NS.versions = function (ul, o) {
    ul.classList.add('cl-versions'); ul.setAttribute('role', 'list');
    function draw() {
      ul.innerHTML = o.items.map(function (v) {
        return '<li class="cl-version" data-id="' + esc(v.id) + '"' + (v.id === o.current ? ' aria-current="true"' : '') + '><button class="cl-version__name" type="button" title="더블클릭 또는 F2로 이름 바꾸기">' + esc(v.name) + '</button>' +
          '<button class="cl-btn cl-btn--icon cl-btn--sm cl-btn--plain cl-version__del" type="button" aria-label="' + esc(v.name) + ' 삭제"><svg class="cl-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 7h14M10 7V5h4v2M7 7l1 12h8l1-12"/></svg></button></li>';
      }).join('');
    }
    function find(id) { return o.items.filter(function (v) { return v.id === id; })[0]; }
    function rename(li) {
      var n = li.querySelector('.cl-version__name'), v = find(li.dataset.id), old = v.name;
      n.contentEditable = 'true'; n.focus(); var r = doc.createRange(); r.selectNodeContents(n); var s = window.getSelection(); s.removeAllRanges(); s.addRange(r);
      function end(save) {
        n.removeEventListener('keydown', key); n.removeEventListener('blur', blur); n.contentEditable = 'false';
        var nv = n.textContent.trim(); if (save && nv && nv !== old) { v.name = nv; o.rename && o.rename(v.id, nv); } draw(); var b = ul.querySelector('[data-id="' + v.id + '"] .cl-version__name'); if (b) b.focus();
      }
      function key(e) { if (e.isComposing || e.keyCode === 229) return; if (e.key === 'Enter') { e.preventDefault(); end(true); } if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); end(false); } }
      function blur() { end(true); }
      n.addEventListener('keydown', key); n.addEventListener('blur', blur);
    }
    ul.addEventListener('click', function (e) {
      var li = e.target.closest('.cl-version'); if (!li) return;
      if (e.target.closest('[data-v="yes"]')) { var id = li.dataset.id; o.items = o.items.filter(function (v) { return v.id !== id; }); if (o.current === id && o.items[0]) { o.current = o.items[0].id; o.select && o.select(o.current); } o.remove && o.remove(id); draw(); NS.toast && NS.toast('버전을 삭제했습니다.'); return; }
      if (e.target.closest('[data-v="no"]')) { draw(); var b0 = ul.querySelector('[data-id="' + li.dataset.id + '"] .cl-version__del'); if (b0) b0.focus(); return; }
      if (e.target.closest('.cl-version__del')) {
        var d = e.target.closest('.cl-version__del'); var c = doc.createElement('span'); c.className = 'cl-version__confirm';
        c.innerHTML = '<button class="cl-btn cl-btn--destructive cl-btn--sm" data-v="yes">삭제</button><button class="cl-btn cl-btn--gray cl-btn--sm" data-v="no">취소</button>';
        d.replaceWith(c); c.querySelector('[data-v="no"]').focus(); return;
      }
      if (e.target.closest('.cl-version__name') && e.target.closest('.cl-version__name').contentEditable !== 'true' && li.dataset.id !== o.current) { o.current = li.dataset.id; draw(); o.select && o.select(o.current); var b2 = ul.querySelector('[data-id="' + o.current + '"] .cl-version__name'); if (b2) b2.focus(); }
    });
    ul.addEventListener('dblclick', function (e) { var li = e.target.closest('.cl-version'); if (li && e.target.closest('.cl-version__name')) rename(li); });
    ul.addEventListener('keydown', function (e) { var li = e.target.closest('.cl-version'); if (li && e.key === 'F2' && e.target.classList.contains('cl-version__name')) { e.preventDefault(); rename(li); } });
    draw();
    return { redraw: draw, current: function () { return o.current; } };
  };

  /* ---------- 가져오기·골라 가져오기·동기화 ----------
     NS.sync(el, { modes:{import|sample|sync:true}, mode, source:{label,detail}, target:{label,detail}, rows:[{id,label,kind:'add'|'change'|'same'|'conflict', before, after}],
                   apply(plan):Promise<{ok, results:[{id,status:'created'|'updated'|'skipped'|'failed', ref}]} | {ok:false, error}> })
     같은 미리보기의 요청 키(key)를 apply에 넘깁니다. 서버는 같은 키를 두 번 받으면 다시 만들지 않고 첫 결과를 돌려줘야 합니다. */
  var SYNC_NAMES = { 'import': { title: '새 버전으로 가져오기', btn: '새 버전 만들기', help: '원본 전체를 읽어 새 버전으로 만듭니다. 지금 버전은 바뀌지 않습니다.' },
    sample: { title: '골라 가져오기', btn: '고른 항목 넣기', help: '원본에서 필요한 항목만 골라 지금 버전에 넣고 이어서 고칩니다.' },
    sync: { title: '연결된 일정 갱신', btn: '연결된 일정 갱신', help: '이미 연결된 대상 일정을 지금 내용으로 고칩니다. 같은 일정을 새로 만들지 않습니다.' } };
  NS.sync = function (el, o) {
    var mode = o.mode || 'sync', key = 'k' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7), result = null, busy = false;
    var KIND = { add: '추가', change: '변경', same: '그대로', conflict: '충돌' }, cache = {};
    function val(x) { return typeof x === 'function' ? x(mode) : x; }
    function rowsOf() { return cache[mode] || (cache[mode] = val(o.rows)); }
    function draw() {
      var nm = SYNC_NAMES[mode], modes = Object.keys(o.modes || { sync: 1 });
      var h = '<div class="cl-sync">';
      if (modes.length > 1) h += '<span class="cl-seg" role="radiogroup" aria-label="방법"><span class="cl-seg__thumb" aria-hidden="true"></span>' + modes.map(function (m) { return '<button class="cl-seg__item" role="radio" data-mode="' + m + '" aria-checked="' + (m === mode) + '">' + SYNC_NAMES[m].title + '</button>'; }).join('') + '</span>';
      h += '<p class="cl-popover__text">' + nm.help + '</p>';
      h += '<div class="cl-sync__route"><div class="cl-sync__end"><b>어디서</b>' + esc(val(o.source).label) + '<br><small>' + esc(val(o.source).detail || '') + '</small></div><span aria-hidden="true">→</span><div class="cl-sync__end"><b>어디로</b>' + esc(val(o.target).label) + '<br><small>' + esc(val(o.target).detail || '') + '</small></div></div>';
      var rows = rowsOf(), cnt = { add: 0, change: 0, same: 0, conflict: 0 }; rows.forEach(function (r) { cnt[r.kind]++; });
      h += '<p class="cl-save__detail" role="status">추가 ' + cnt.add + ' · 변경 ' + cnt.change + ' · 충돌 ' + cnt.conflict + ' · 그대로 ' + cnt.same + '</p>';
      h += '<ul class="cl-sync__diff">' + rows.map(function (r, i) {
        var res = result && result.results ? result.results.filter(function (x) { return x.id === r.id; })[0] : null;
        return '<li>' + (mode === 'sample' ? '<input type="checkbox" data-row="' + i + '"' + (r.pick !== false ? ' checked' : '') + ' aria-label="' + esc(r.label) + ' 고르기">' : '<span></span>') +
          '<span class="cl-sync__kind" data-k="' + r.kind + '">' + KIND[r.kind] + '</span><span>' + esc(r.label) + (r.before != null ? ' <small style="color:var(--cl-label-3)">' + esc(r.before) + ' → ' + esc(r.after) + '</small>' : r.after ? ' <small style="color:var(--cl-label-3)">' + esc(r.after) + '</small>' : '') +
          (res ? ' <span class="cl-badge cl-badge--' + (res.status === 'failed' ? 'danger' : res.status === 'skipped' ? 'info' : 'success') + '">' + ({ created: '만듦', updated: '갱신함', skipped: '이미 있음', failed: '실패' })[res.status] + '</span>' : '') + '</span></li>';
      }).join('') + '</ul>';
      if (result && !result.ok) h += '<div class="cl-notice cl-notice--danger" role="alert"><span class="cl-notice__glyph" aria-hidden="true">!</span><div><b>' + esc(result.error || '보내지 못했습니다.') + '</b><p style="margin:2px 0 0">' + (result.uncertain ? '서버 응답을 받지 못했습니다. 같은 요청으로 다시 보내면 이미 반영된 항목은 다시 만들지 않습니다.' : '바뀐 것은 없습니다. 다시 시도할 수 있습니다.') + '</p></div></div>';
      if (result && result.ok) h += '<div class="cl-notice cl-notice--success" role="status"><span class="cl-notice__glyph" aria-hidden="true">✓</span><div><b>서버에 반영했습니다.</b><p style="margin:2px 0 0">위 목록의 표시는 서버가 돌려준 실제 결과입니다.</p></div></div>';
      h += '<div class="cl-toolbar"><span class="cl-toolbar__spacer"></span><button class="cl-btn cl-btn--gray" data-sy="cancel">' + (result && result.ok ? '닫기' : '취소') + '</button>' + (result && result.ok ? '' : '<button class="cl-btn cl-btn--filled" data-sy="apply"' + (cnt.conflict && mode === 'sync' ? ' disabled' : '') + '>' + (result && !result.ok ? '다시 시도' : nm.btn) + '</button>') + '</div>';
      if (cnt.conflict && mode === 'sync') h += '<p class="cl-save__detail">충돌 항목을 먼저 확인해야 갱신할 수 있습니다.</p>';
      el.innerHTML = h + '</div>';
      try { bindSegmented(el); } catch (e) {}
    }
    el.addEventListener('click', function (e) {
      var m = e.target.closest('[data-mode]'); if (m) { mode = m.dataset.mode; result = null; cache = {}; key = 'k' + Date.now().toString(36); draw(); return; }
      var b = e.target.closest('[data-sy]'); if (!b) return;
      if (b.dataset.sy === 'cancel') { emit(el, 'cl-sync-close', { result: result }); return; }
      if (busy) return; busy = true; b.setAttribute('aria-busy', 'true'); b.disabled = true;
      var picked = rowsOf().filter(function (r, i) { var c = el.querySelector('[data-row="' + i + '"]'); return mode !== 'sample' || (c && c.checked); });
      Promise.resolve(o.apply({ mode: mode, key: key, rows: picked })).then(function (r) { result = r; }, function (err) { result = { ok: false, error: '연결이 끊겼습니다.', uncertain: true }; }).then(function () { busy = false; draw(); emit(el, 'cl-sync-result', result); });
    });
    el.addEventListener('change', function (e) { if (e.target.matches('[data-row]')) rowsOf()[+e.target.dataset.row].pick = e.target.checked; });
    draw();
    return { redraw: function () { cache = {}; result = null; key = 'k' + Date.now().toString(36); draw(); }, key: function () { return key; }, mode: function () { return mode; } };
  };

  /* ---------- A4 미리보기와 인쇄 ----------
     NS.a4.fit(box): 상자 폭에 맞춰 A4를 줄여 보여 줌. NS.a4.print(sheets, 'portrait'|'landscape'): 같은 요소를 인쇄 */
  NS.a4 = {
    fit: function (box) {
      var a = box.querySelector('.cl-a4'); if (!a) return;
      var land = a.getAttribute('data-orient') === 'landscape', w = land ? 1123 : 794, h = land ? 794 : 1123;
      box.style.setProperty('--a4-w-px', w + 'px'); box.style.setProperty('--a4-h-px', (a.scrollHeight > h ? a.scrollHeight : h) + 'px');
      box.style.setProperty('--scale', Math.min(1, (box.parentNode.clientWidth || w) / w).toFixed(4));
    },
    print: function (sheets, orient) {
      var st = doc.getElementById('cl-page-size'); if (!st) { st = doc.createElement('style'); st.id = 'cl-page-size'; doc.head.appendChild(st); }
      st.textContent = '@media print { @page { size: A4 ' + (orient || 'portrait') + '; margin: 0; } }';
      var root = doc.createElement('div'); root.className = 'cl-print-root'; root.style.display = 'none';
      (sheets.length != null ? Array.prototype.slice.call(sheets) : [sheets]).forEach(function (s) { root.appendChild(s.cloneNode(true)); });
      doc.body.appendChild(root); doc.body.classList.add('cl-printing');
      var done = function () { doc.body.classList.remove('cl-printing'); root.remove(); st.textContent = ''; window.removeEventListener('afterprint', done); };
      window.addEventListener('afterprint', done); window.print(); setTimeout(done, 1500);
    }
  };

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
    var hueColors = {};
    Object.keys(names).forEach(function (n) { probe.style.color = 'var(' + n + ')'; var cv = getComputedStyle(probe).color; allowed[cv] = 1; if (/^--cl-hue-/.test(n)) hueColors[cv] = n; });
    probe.remove();
    var tokenized = Object.keys(allowed).length > 10;
    if (!tokenized) err('토큰을 읽지 못함', null, 'tokens.css를 불러옵니다.');
    var stray = {}, strictHue = {};
    if (tokenized) all(root, '*').forEach(function (el) {
      if (el.closest('svg, img, video, picture, canvas, iframe, .cl-plate, [data-cl-content], .cl-preview__page, [data-cl-paper], .cl-a4, [data-cl-data]') || !visible(el)) return; /* data-cl-data: 과목색·사용자 지정색 같은 데이터 의미색 */
      var cs = getComputedStyle(el);
      [['color', cs.color], ['background', cs.backgroundColor]].forEach(function (pair) {
        var v = pair[1], c = rgba(v);
        if (c && c.a !== 0 && hueColors[v] && el.closest('[data-cl-palette="strict"]')) { var hk = pair[0] + ' ' + v; if (!strictHue[hk]) strictHue[hk] = el; return; }
        if (!c || c.a === 0 || allowed[v]) return;
        if (pair[0] === 'color' && !(el.childNodes.length && Array.prototype.some.call(el.childNodes, function (n) { return n.nodeType === 3 && n.textContent.trim(); }))) return;
        var key = pair[0] + ' ' + v; if (!stray[key]) stray[key] = el;
      });
    });
    Object.keys(strictHue).slice(0, 10).forEach(function (k) { warn('빡빡한 기준에서 스펙트럼 색 ' + k, strictHue[k], '문서·안내 화면은 브랜드 3단계 색만 씁니다. 업무 화면이면 data-cl-palette="open"으로 바꿉니다.'); });
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

    /* 3-4) 업무 패턴(business-patterns.md) */
    all(root, '.cl-tt-wrap').forEach(function (w) {
      var sel = w.querySelector('td[aria-selected="true"]'), head = w.querySelector('th[scope="row"]');
      if (sel && head && visible(sel)) { var a = sel.getBoundingClientRect(), b = head.getBoundingClientRect(); if (a.left < b.right - 1 && a.right > b.right) err('고정열 뒤에 가려진 선택 칸(' + Math.round(b.right - a.left) + 'px)', sel, '선택할 때 NS.timetable의 reveal로 고정열 오른쪽까지 스크롤합니다. scroll-padding-left = 고정열 폭.'); }
      if (getComputedStyle(w).overflowX === 'visible') err('위치가 뜻인 표가 넘침', w, '.cl-tt-wrap 안에서만 가로 스크롤합니다. 격자를 카드로 바꾸지 않습니다.');
    });
    (function () {
      var names = all(root, 'nav a, nav button, .cl-side__item, .cl-drill__item').filter(visible).map(function (x) { return x.textContent.trim(); }).filter(function (t) { return /전략\s*보고서/.test(t); });
      if (names.length > 1) err('비슷한 전략보고서 메뉴가 함께 보임: ' + names.join(', '), root, '대표 보고서 하나만 두고 시즌에 따라 이름(시험/방학 전략보고서)을 바꿉니다.');
    })();
    all(root, '.cl-save').forEach(function (b) {
      if (/저장됨/.test((b.querySelector('.cl-save__state') || b).textContent) && b.getAttribute('data-state') !== 'saved' && b.getAttribute('data-state') !== 'clean') err('서버 확인 전 "저장됨" 표시', b, 'NS.save가 서버 응답 ok 뒤에만 저장됨으로 바꿉니다.');
    });
    /* 3-3) 도움말·카드 배치(help.md, layout.md) */
    all(root, '[data-cl-tip]').forEach(function (el) {
      var t = el.getAttribute('data-cl-tip') || '';
      if (t.length > 60) warn('툴팁 문구가 김(' + t.length + '자)', el, '60자 안쪽 한 문장으로. 길면 도움말 팝오버(.cl-help)나 안쪽 설명으로.');
      if (/<[a-z]/i.test(t)) err('툴팁 안에 마크업', el, '툴팁은 글자만. 링크·버튼이 필요하면 .cl-popover.');
      var name = (el.getAttribute('aria-label') || el.textContent || '').trim();
      if (name && t.trim() === name) warn('툴팁이 이름을 되풀이', el, '이름 말고 무엇을 하는지(동사로) 씁니다.');
    });
    all(root, '.cl-help').forEach(function (b) { if (!b.getAttribute('aria-controls')) err('도움말 단추에 팝오버 연결 없음', b, 'aria-haspopup="dialog" aria-controls="팝오버 id". 마우스 올림 툴팁으로 패널 설명을 대신하지 않습니다.'); });
    all(root, '.cl-cards').forEach(function (g) {
      var cs = getComputedStyle(g);
      if (/dense/.test(cs.gridAutoFlow)) err('카드 묶음에 dense 배치', g, '읽는 순서가 바뀝니다. 기본 배치로 두고 순서는 마크업 순서로 정합니다.');
      if (g.style.gridTemplateColumns) err('카드 열 수를 직접 고정', g, '--card-min(카드 최소 폭)과 --cols-max(최대 열)로만 조절합니다.');
      all(g, ':scope > * .cl-cards').forEach(function () {});
      all(g, ':scope > .cl-card .cl-card').forEach(function (c) { warn('카드 안에 카드', c, '안쪽은 구획(.cl-card__body 묶음)이나 목록으로 나눕니다.'); });
    });
    all(root, '.cl-grid').forEach(function (g) { if (g.style.gridTemplateColumns) warn('.cl-grid 열 수 직접 고정', g, '.cl-cards로 바꾸고 --cols-max를 씁니다.'); });

    /* 3-2) 차트 약속(charts.md) */
    all(root, '.cl-chart').forEach(function (el) {
      var c = el.clChart; if (!c) return;
      var S = c.series || [], t = c.type || 'bar';
      if (c.y2 || c.yAxis2 || S.some(function (s) { return s.axis === 'right' || s.y2; })) err('차트 이중 축', el, '단위가 다른 지표는 panel(x축을 공유하는 아래 칸)으로 나눕니다.');
      var bars = S.filter(function (s) { return (s.mark || (t === 'line' ? 'line' : 'bar')) === 'bar'; });
      if ((t === 'bar' || t === 'combo') && bars.length === 1 && c.emphasis === 'none' && (c.categories || []).length > 3) warn('강조 없는 한 계열 막대', el, "emphasis를 지우거나(기본: 마지막 기간) 'max'·'target'·{category}로 이야기의 주인공을 정합니다.");
      var openPal = !!el.closest('[data-cl-palette="open"]'), catMax = openPal ? 10 : 4;
      if (t !== 'stack' && t !== 'share' && S.length > catMax && !(c.emphasis && c.emphasis.series)) warn('범주 색 ' + (catMax + 1) + '개 이상', el, (openPal ? '완화된 기준도 10계열까지. ' : '빡빡한 기준은 4계열까지(업무 화면이면 data-cl-palette="open"). ') + '4계열까지만 색, 나머지는 기타로 묶거나 작은 차트로 나눕니다. 또는 emphasis: {series}로 하나만 강조합니다.');
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

    /* 6) 표 칸 정렬: 기본은 가로·세로 가운데 (v6.5) */
    var misT = new Set();
    all(root, 'table th, table td').forEach(function (c) {
      var t = c.closest('table'); if (!t || misT.has(t) || c.closest('.cl-month, [data-cl-content], .cl-preview__page') || c.classList.contains('start') || c.classList.contains('end') || !visible(c) || !(c.textContent || '').trim()) return;
      var cs = getComputedStyle(c), ta = cs.textAlign, va = cs.verticalAlign;
      var stack = t.getAttribute('data-cl-cells') === 'stack' && c.parentElement && c.parentElement.parentElement && c.parentElement.parentElement.tagName === 'TBODY';
      if (!(ta === 'center' || ta === '-webkit-center') || !(va === 'middle' || (stack && va === 'top'))) { misT.add(t); warn('표 칸 정렬 ' + ta + '/' + va, c, '표 칸은 가로·세로 가운데(text-align: center; vertical-align: middle). 긴 문장 열만 .start.'); }
    });

    /* 7) 뱃지 한 줄, 인쇄 미리보기 (v6.5) */
    var wrapped = new Set();
    all(root, '.cl-badge').forEach(function (b) {
      var p = b.parentElement; if (!p || wrapped.has(p) || !visible(b)) return;
      var sib = Array.prototype.filter.call(p.children, function (x) { return x.classList.contains('cl-badge') && !x.hasAttribute('data-overflow') && !x.hidden && visible(x); });
      if (sib.length < 2) return;
      var t0 = sib[0].getBoundingClientRect().top;
      if (sib.some(function (x) { return Math.abs(x.getBoundingClientRect().top - t0) > 4; })) { wrapped.add(p); err('뱃지 줄바꿈', p, '.cl-badges로 묶어 한 줄로 두고, 모자라면 compact·아이콘·"+n"으로 줄입니다.'); }
    });
    all(root, '.cl-preview').forEach(function (b) {
      if (!b.getAttribute('data-cl-preview-of')) warn('인쇄 미리보기 원본 없음', b, 'data-cl-preview-of="원본 id"와 본문의 data-cl-print-source="같은 id".');
      else if (!previewSource(b)) err('인쇄 미리보기 원본을 찾지 못함', b, '본문 인쇄 영역에 data-cl-print-source="' + b.getAttribute('data-cl-preview-of') + '".');
      if (!b.closest('.cl-pane--info')) warn('인쇄 미리보기가 정보 칸 밖에 있음', b, '정보 칸의 인쇄 모드(data-mode="print") 안에 둡니다(print.md).');
    });

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

  /* ============ 입장·불러오기 ============
     .cl-gate[data-cl-gate]: 입장 비밀번호 화면(daily 입장 화면을 Clarity로).
       data-seconds(기본 10) 안에 입력이 없으면 data-redirect로 이동, "연장" 버튼은 data-extend초(기본 30) 추가.
       iframe 안(업무 공간에 띄운 경우)에서는 시간 제한을 숨깁니다.
       제출하면 cl-gate-submit 이벤트 {value, done(ok)}가 납니다. done(true)면 통과, done(false)면 오류 문구.
       data-endpoint가 있으면 그 주소로 POST {password}를 보내고 응답 ok로 판정합니다(같은 출처만).
     SangsangClarity.loading(요소, true|false): 영역을 불러오는 중으로 표시(이전 내용을 옅게 두고 위에 표시). */
  function bindGate(root) {
    all(root, '[data-cl-gate]').forEach(function (g) {
      if (!once(g, 'Gate')) return;
      var form = g.querySelector('form'), input = g.querySelector('input'), btn = form && form.querySelector('[type="submit"]');
      var timer = g.querySelector('.cl-gate__timer'), left = g.querySelector('.cl-gate__left'), meter = g.querySelector('.cl-gate__meter i');
      var ext = g.querySelector('[data-cl-gate-extend]'), msg = g.querySelector('.cl-gate__msg');
      var total = (+g.dataset.seconds || 10) * 1000, add = (+g.dataset.extend || 30) * 1000, span = total;
      var deadline = Date.now() + total, busy = false, done = false, framed = false;
      try { framed = window.self !== window.top; } catch (e) { framed = true; }
      if (framed && g.dataset.framed !== 'timed' && timer) timer.hidden = true;
      function say(text, tone) { if (!msg) return; msg.textContent = text || ''; msg.setAttribute('data-tone', tone || 'danger'); }
      function leave() {
        if (done || (framed && g.dataset.framed !== 'timed')) return;
        done = true; clearInterval(iv);
        g.setAttribute('data-state', 'expired');
        emit(g, 'cl-gate-expired', {});
        if (g.dataset.redirect) window.location.replace(g.dataset.redirect);
        else say('시간이 지나 입장 화면을 닫았습니다.', 'info');
      }
      function tick() {
        if (done) return;
        var ms = Math.max(0, deadline - Date.now()), s = Math.ceil(ms / 1000);
        if (left) left.textContent = s + '초';
        if (meter) meter.style.transform = 'scaleX(' + (ms / span).toFixed(4) + ')';
        if (timer) timer.setAttribute('data-low', String(s <= 3));
        if (ms === 0 && !busy) leave();
      }
      var iv = setInterval(tick, 200); tick();
      if (ext) ext.addEventListener('click', function () {
        if (done) return;
        var now = Date.now(); deadline = Math.max(deadline, now) + add; span = deadline - now; tick(); if (input) input.focus();
      });
      if (input) input.addEventListener('input', function () { input.removeAttribute('aria-invalid'); say(''); });
      if (form) form.addEventListener('submit', function (e) {
        e.preventDefault();
        if (busy || done) return;
        busy = true; if (btn) { btn.setAttribute('aria-busy', 'true'); btn.disabled = true; }
        g.setAttribute('data-state', 'checking'); say('');
        function finish(ok) {
          busy = false; if (btn) { btn.removeAttribute('aria-busy'); btn.disabled = false; }
          if (ok) { done = true; clearInterval(iv); g.setAttribute('data-state', 'passed'); say('확인했습니다.', 'success'); emit(g, 'cl-gate-pass', {}); return; }
          g.setAttribute('data-state', 'idle');
          if (input) { input.setAttribute('aria-invalid', 'true'); input.value = ''; input.focus(); }
          say(g.dataset.errorText || '비밀번호가 올바르지 않습니다.');
          tick();
        }
        if (g.dataset.endpoint) {
          fetch(g.dataset.endpoint, { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password: input ? input.value : '' }) })
            .then(function (r) { return r.ok; }).catch(function () { return false; }).then(finish);
        } else emit(g, 'cl-gate-submit', { value: input ? input.value : '', done: finish });
      });
      if (input && g.hasAttribute('data-autofocus')) input.focus();
    });
  }
  NS.loading = function (el, on, label, opts) {
    if (!el) return;
    clearTimeout(el.clBusyTimer);
    if (on) {
      el.setAttribute('aria-busy', 'true');
      /* 0.3초 안에 끝나는 불러오기는 표시하지 않습니다(깜빡임 방지). */
      el.clBusyTimer = setTimeout(function () {
        el.classList.add('cl-busy');
        if (!el.querySelector(':scope > .cl-busy__veil')) {
          var v = doc.createElement('div'); v.className = 'cl-busy__veil'; v.setAttribute('role', 'status');
          v.innerHTML = '<span class="cl-busy__pill"><span class="cl-spinner" aria-hidden="true"></span><span>' + esc(label || '불러오는 중') + '</span></span>';
          el.appendChild(v);
        }
      }, opts && opts.delay != null ? opts.delay : 300);
    } else {
      el.removeAttribute('aria-busy'); el.classList.remove('cl-busy');
      var old = el.querySelector(':scope > .cl-busy__veil'); if (old) old.remove();
    }
  };
  /* 기다림 카드: data-cl-wait="초" 동안 막대가 채워지고 남은 초를 보여 줍니다. 끝나면 cl-wait-done. */
  function bindWait(root) {
    all(root, '[data-cl-wait]').forEach(function (w) {
      if (!once(w, 'Wait')) return;
      var sec = +w.getAttribute('data-cl-wait') || 5, t0 = Date.now(), bar = w.querySelector('.cl-progress__fill'), out = w.querySelector('.cl-wait__sec');
      var iv = setInterval(function () {
        var p = Math.max(0, Math.min(1, (Date.now() - t0) / (sec * 1000)));
        if (bar) bar.style.setProperty('--value', Math.round(p * 100));
        if (out) out.textContent = p < 1 ? '약 ' + Math.ceil(sec * (1 - p)) + '초 남음' : '거의 다 됐습니다';
        if (p < 1) return;
        emit(w, 'cl-wait-done', {});
        if (w.hasAttribute('data-loop')) t0 = Date.now() + 1200; /* 미리보기용: 잠시 멈췄다 다시 */
        else clearInterval(iv);
      }, 200);
    });
  }
  /* ============ 월력 .cl-month: 애플 캘린더 방식 ============
     data-calendar JSON:
       month 'YYYY-MM', today, selected, weekStart(0 일요일 | 1 월요일, 기본 0), view('compact' | 'details', 기본 'details'),
       hours { weekday, sat, sun }  요일별 기본 운영 시간(없으면 표시 안 함),
       days { 'YYYY-MM-DD': { hours, note, closed } }  날짜별 예외,
       closed ['YYYY-MM-DD'] 휴원일, holidays [{date, title}] 공휴일(일정처럼 이름을 보임),
       events [{date, title, time}] 하루 일정(작은 점 / 제목),
       spans [{from, to, title, phase: 'past' | 'now' | 'next'}] 여러 날 기간(얇은 capsule 막대)
     규칙은 calendar.md. */
  var KDOW = ['일', '월', '화', '수', '목', '금', '토'];
  function ymd(d) { return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2); }
  function pd(s) { var p = s.split('-'); return new Date(+p[0], +p[1] - 1, +(p[2] || 1)); }
  NS.month = function (el, cfg) {
    cfg = cfg || el.clMonth || JSON.parse(el.getAttribute('data-calendar'));
    el.clMonth = cfg;
    var ws = cfg.weekStart || 0, view = cfg.view || 'details', m0 = pd(cfg.month), Y = m0.getFullYear(), Mo = m0.getMonth();
    var today = cfg.today || ymd(new Date()), sel = cfg.selected || today;
    var ci = cfg.items ? calMonth(cfg.items, cfg, today) : { events: [], spans: [], holidays: [], slots: {} }, SP = (cfg.spans || []).concat(ci.spans);
    var closed = {}; (cfg.closed || []).forEach(function (d) { closed[d] = 1; });
    var hol = {}; (cfg.holidays || []).concat(ci.holidays).forEach(function (h) { hol[h.date] = h.title; });
    var evs = {}; (cfg.events || []).concat(ci.events).forEach(function (e) { (evs[e.date] = evs[e.date] || []).push(e); });
    function info(ds) {
      var d = pd(ds), dow = d.getDay(), x = (cfg.days || {})[ds] || {};
      var isClosed = !!(x.closed || closed[ds] || (cfg.hours && hol[ds] && x.hours == null));
      var h = x.hours != null ? x.hours : !cfg.hours ? null : dow === 0 ? cfg.hours.sun : dow === 6 ? cfg.hours.sat : cfg.hours.weekday;
      if (isClosed) h = null;
      return { closed: !!(isClosed || (cfg.hours && !h && !x.hours)), hours: h, note: x.note, holiday: hol[ds], events: evs[ds] || [], weekend: dow === 0 || dow === 6 };
    }
    var first = new Date(Y, Mo, 1), lead = (first.getDay() - ws + 7) % 7, ndays = new Date(Y, Mo + 1, 0).getDate();
    var weeks = Math.ceil((lead + ndays) / 7);
    var title = (Mo + 1) + '월', id = el.id || ('clm' + (++CHART_N));
    var h = '<div class="cl-month__head"><h3 class="cl-month__title" id="' + id + '-t">' + title + ' <small>' + Y + '년</small></h3>' +
      '<div class="cl-month__tools">' +
      (cfg.switchable !== false ? '<span class="cl-seg cl-seg--sm cl-month__views" role="radiogroup" aria-label="보기"><span class="cl-seg__thumb" aria-hidden="true"></span><button class="cl-seg__item" role="radio" data-view="compact" aria-checked="' + (view === 'compact') + '">간단히</button><button class="cl-seg__item" role="radio" data-view="details" aria-checked="' + (view === 'details') + '">자세히</button></span>' : '') +
      '<button class="cl-btn cl-btn--gray cl-btn--sm" data-mo="today">오늘</button>' +
      '<span class="cl-month__nav"><button class="cl-btn cl-btn--icon cl-btn--plain" data-mo="-1" aria-label="이전 달">‹</button><button class="cl-btn cl-btn--icon cl-btn--plain" data-mo="1" aria-label="다음 달">›</button></span></div></div>';
    if (cfg.summary) h += '<p class="cl-month__summary">' + esc(cfg.summary) + '</p>';
    h += '<div class="cl-month__grid" role="grid" aria-labelledby="' + id + '-t" data-view="' + view + '"><div class="cl-month__dows" role="row">';
    for (var i = 0; i < 7; i++) { var dw = (ws + i) % 7; h += '<span role="columnheader" class="cl-month__dow' + (dw === 0 || dw === 6 ? ' is-weekend' : '') + '" aria-label="' + KDOW[dw] + '요일">' + KDOW[dw] + '</span>'; }
    h += '</div>';
    var spans = SP.map(function (s) { return { a: pd(s.from), b: pd(s.to), s: s }; });
    for (var w = 0; w < weeks; w++) {
      var wStart = new Date(Y, Mo, 1 - lead + w * 7);
      /* 이 주를 지나는 기간 막대: 한 주 안에서 시작·끝 열을 계산, 겹치면 줄을 나눔 */
      var bars = [], lanes = [];
      spans.forEach(function (sp) {
        /* 달 밖 날짜에는 막대를 그리지 않습니다(애플 월 보기는 달 밖 칸을 비워 둠). */
        var mFirst = new Date(Y, Mo, 1), mLast = new Date(Y, Mo, ndays);
        var ws2 = wStart < mFirst ? mFirst : wStart, we0 = new Date(wStart.getFullYear(), wStart.getMonth(), wStart.getDate() + 6), we = we0 > mLast ? mLast : we0;
        if (sp.b < ws2 || sp.a > we) return;
        var s0 = Math.round(((sp.a > ws2 ? sp.a : ws2) - wStart) / 864e5), s1 = Math.round(((sp.b < we ? sp.b : we) - wStart) / 864e5);
        var lane = 0; while ((lanes[lane] || []).some(function (r) { return !(s1 < r[0] || s0 > r[1]); })) lane++;
        (lanes[lane] = lanes[lane] || []).push([s0, s1]);
        bars.push({ c0: s0, c1: s1, lane: lane, head: sp.a >= ws2, tail: sp.b <= we, s: sp.s, cut: sp.a < ws2 });
      });
      h += '<div class="cl-month__week" role="row" style="--lanes:' + lanes.length + '">';
      for (var dI = 0; dI < 7; dI++) {
        var d = new Date(wStart.getFullYear(), wStart.getMonth(), wStart.getDate() + dI), ds = ymd(d), inM = d.getMonth() === Mo;
        if (!inM) { h += '<span class="cl-month__day is-out" role="gridcell" aria-hidden="true"></span>'; continue; }
        var f = info(ds), cls = 'cl-month__day' + (f.weekend ? ' is-weekend' : '') + (f.closed ? ' is-closed' : '') + (ds === today ? ' is-today' : '');
        var lab = (Mo + 1) + '월 ' + d.getDate() + '일 ' + KDOW[d.getDay()] + '요일' + (ds === today ? ', 오늘' : '') + (f.holiday ? ', ' + f.holiday : '') + (f.closed ? ', 휴원' : f.hours ? ', ' + f.hours + ' 운영' : '') + (f.events.length ? ', 일정 ' + f.events.length + '개' : '');
        h += '<span class="' + cls + '" role="gridcell" tabindex="' + (ds === sel ? 0 : -1) + '" data-date="' + ds + '" aria-selected="' + (ds === sel) + '"' + (ds === today ? ' aria-current="date"' : '') + ' aria-label="' + esc(lab) + '">' +
          '<span class="cl-month__num">' + d.getDate() + '</span>' +
          '<span class="cl-month__sub">' + (f.holiday ? '<span class="cl-month__hol">' + esc(f.holiday) + '</span>' : '') + (f.closed ? '<span class="cl-month__closed">휴원</span>' : f.hours ? '<span class="cl-month__hours">' + esc(f.hours) + '</span>' : '') +
          f.events.slice(0, 2).map(function (e) { return '<span class="cl-month__ev">' + esc(e.title) + '</span>'; }).join('') + (f.events.length > 2 ? '<span class="cl-month__more">+' + (f.events.length - 2) + '</span>' : '') + (f.note ? '<span class="cl-month__ev">' + esc(f.note) + '</span>' : '') + '</span>' +
          '<span class="cl-month__dots" aria-hidden="true">' + f.events.slice(0, 3).map(function (e) { return '<i' + (e.c ? ' data-c="' + e.c + '"' : '') + '></i>'; }).join('') + '</span></span>';
      }
      h += '<span class="cl-month__bars" aria-hidden="true">' + bars.map(function (b) {
        return '<span class="cl-month__bar is-' + (b.s.phase || 'now') + (b.head ? ' is-head' : '') + (b.tail ? ' is-tail' : '') + '" style="--c0:' + (b.c0 + 1) + ';--c1:' + (b.c1 + 2) + ';--lane:' + b.lane + '">' + (b.head || b.cut ? esc(b.s.title) : '') + '</span>';
      }).join('') + '</span></div>';
    }
    h += '</div><div class="cl-month__detail" aria-live="polite"></div>';
    var legend = [];
    if (SP.length) legend.push('<span><i class="k-now"></i>지금 기간</span>' + (SP.some(function (s) { return s.phase === 'next'; }) ? '<span><i class="k-next"></i>다음 기간</span>' : '') + (SP.some(function (s) { return s.phase === 'past'; }) ? '<span><i class="k-past"></i>지난 기간</span>' : ''));
    if (legend.length) h += '<p class="cl-month__legend">' + legend.join('') + '</p>';
    el.innerHTML = h;
    var grid = el.querySelector('.cl-month__grid'), detail = el.querySelector('.cl-month__detail');
    function showDetail(ds) {
      var f = info(ds), d = pd(ds), sp = SP.filter(function (s) { return pd(s.from) <= d && d <= pd(s.to); });
      var rows = [];
      if (f.holiday) rows.push(['공휴일', f.holiday]);
      if (cfg.hours || f.closed) rows.push(['운영', f.closed ? '휴원' : f.hours || '–']);
      sp.forEach(function (s) { rows.push(['기간', s.title + ' (' + s.from.slice(5).replace('-', '/') + '–' + s.to.slice(5).replace('-', '/') + ')']); });
      f.events.forEach(function (e) { rows.push([e.time || '하루 종일', e.title]); });
      if (ci.slots[ds]) rows.push(['열린 시간', ci.slots[ds] + '개']);
      if (f.note) rows.push(['메모', f.note]);
      detail.innerHTML = '<p class="cl-month__dtitle">' + (d.getMonth() + 1) + '월 ' + d.getDate() + '일 ' + KDOW[d.getDay()] + '요일' + (ds === today ? ' · 오늘' : '') + '</p><ul>' + rows.map(function (r) { return '<li><span>' + esc(r[0]) + '</span><span>' + esc(r[1]) + '</span></li>'; }).join('') + '</ul>';
    }
    showDetail(sel);
    function select(ds, focus) {
      var c = grid.querySelector('[data-date="' + ds + '"]');
      if (!c) { var nd = pd(ds); cfg.month = nd.getFullYear() + '-' + ('0' + (nd.getMonth() + 1)).slice(-2); cfg.selected = ds; NS.month(el, cfg); var c2 = el.querySelector('[data-date="' + ds + '"]'); if (c2 && focus) c2.focus(); emit(el, 'cl-change', { date: ds }); return; }
      all(grid, '[data-date]').forEach(function (x) { x.setAttribute('aria-selected', 'false'); x.tabIndex = -1; });
      c.setAttribute('aria-selected', 'true'); c.tabIndex = 0; if (focus) c.focus();
      cfg.selected = ds; showDetail(ds); emit(el, 'cl-change', { date: ds });
    }
    grid.addEventListener('click', function (e) { var c = e.target.closest('[data-date]'); if (c) select(c.dataset.date, true); });
    grid.addEventListener('keydown', function (e) {
      var c = e.target.closest('[data-date]'); if (!c) return;
      var d = pd(c.dataset.date), k = e.key, n = null;
      if (k === 'ArrowLeft') n = new Date(d.getFullYear(), d.getMonth(), d.getDate() - 1);
      if (k === 'ArrowRight') n = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1);
      if (k === 'ArrowUp') n = new Date(d.getFullYear(), d.getMonth(), d.getDate() - 7);
      if (k === 'ArrowDown') n = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 7);
      if (k === 'Home') n = new Date(d.getFullYear(), d.getMonth(), d.getDate() - (d.getDay() - ws + 7) % 7);
      if (k === 'End') n = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 6 - (d.getDay() - ws + 7) % 7);
      if (k === 'PageUp' || k === 'PageDown') { var dm = (k === 'PageUp' ? -1 : 1) * (e.shiftKey ? 12 : 1); n = new Date(d.getFullYear(), d.getMonth() + dm, Math.min(d.getDate(), new Date(d.getFullYear(), d.getMonth() + dm + 1, 0).getDate())); }
      if (k === 'Enter' || k === ' ') { e.preventDefault(); select(c.dataset.date, true); return; }
      if (n) { e.preventDefault(); select(ymd(n), true); }
    });
    all(el, '[data-mo]').forEach(function (b) {
      b.addEventListener('click', function () {
        var v = b.dataset.mo;
        if (v === 'today') { select(today, true); return; }
        var nd = new Date(Y, Mo + (+v), 1); cfg.month = nd.getFullYear() + '-' + ('0' + (nd.getMonth() + 1)).slice(-2);
        var keep = pd(cfg.selected || today); cfg.selected = ymd(new Date(nd.getFullYear(), nd.getMonth(), Math.min(keep.getDate(), new Date(nd.getFullYear(), nd.getMonth() + 1, 0).getDate())));
        NS.month(el, cfg); var f = el.querySelector('[data-mo="' + v + '"]'); if (f) f.focus();
      });
    });
    all(el, '.cl-month__views [data-view]').forEach(function (b) {
      b.addEventListener('click', function () { cfg.view = b.dataset.view; grid.setAttribute('data-view', cfg.view); all(el, '.cl-month__views [data-view]').forEach(function (x) { x.setAttribute('aria-checked', String(x === b)); }); });
    });
    try { bindSegmented(el); } catch (e2) {}
  };
  function bindMonth(root) {
    all(root, '.cl-month[data-calendar]').forEach(function (el) { if (!once(el, 'Month')) return; NS.month(el); });
  }

  /* ============ CalItem 공통 입력 · 주·일 시간 격자 .cl-week · 목록 .cl-agenda ============
     CalItem { id, provider, kind: event|slot|span|task|marker, title, when, status, calendar, resource, privacy, readOnly, booking, task }
       when: { allDay: true, start: 'YYYY-MM-DD', end: 끝나는 다음 날 'YYYY-MM-DD' } | { allDay: false, start, end: 'YYYY-MM-DDTHH:mm[:ss]+09:00', tz }
     설정 calendars [{ id, label, color: 1~4 }]: 색은 일정 묶음(calendar) 단위로 차트 범주색 chart-1…4까지만. 5번째 묶음·묶음 없음은 무채색.
     privacy 'busy'는 어디에서도 "일정 있음"만 보이고 제목·세부를 그리지 않습니다.
     data-week / data-agenda JSON. 키트는 어떤 데이터도 직접 가져오지 않고, 화면이 cl-nav를 받아 items를 다시 넘깁니다. 규칙은 calendar.md 7·8절. */
  var CAL_BUSY = '일정 있음', CAL_STATUS = { confirmed: '확정', tentative: '미확정', cancelled: '취소' };
  function calTwo(n) { return ('0' + n).slice(-2); }
  function calDn(ds) { var p = ds.split('-'); return Math.round(Date.UTC(+p[0], +p[1] - 1, +p[2]) / 864e5); }
  function calStr(n) { var d = new Date(n * 864e5); return d.getUTCFullYear() + '-' + calTwo(d.getUTCMonth() + 1) + '-' + calTwo(d.getUTCDate()); }
  function calDow(n) { return new Date(n * 864e5).getUTCDay(); }
  function calHm(m) { m = ((m % 1440) + 1440) % 1440; return calTwo(Math.floor(m / 60)) + ':' + calTwo(m % 60); }
  function calMd(n) { var d = new Date(n * 864e5); return (d.getUTCMonth() + 1) + '월 ' + d.getUTCDate() + '일'; }
  function calIso(am) { return calStr(Math.floor(am / 1440)) + 'T' + calHm(am) + ':00+09:00'; }
  /* 'YYYY-MM-DD' 또는 'YYYY-MM-DDTHH:mm[:ss][오프셋]' → 한국 시각 기준 분(1970-01-01부터). 오프셋이 없으면 한국 시각으로 봅니다. */
  function calMin(s) {
    var m = /^(\d{4}-\d\d-\d\d)(?:[T ](\d\d):(\d\d)(?::\d\d(?:\.\d+)?)?(Z|[+-]\d\d(?::?\d\d)?)?)?$/.exec(String(s || ''));
    if (!m) return NaN;
    var base = calDn(m[1]) * 1440;
    if (m[2] == null) return base;
    base += +m[2] * 60 + +m[3];
    if (!m[4]) return base;
    var off = 0, q = /^([+-])(\d\d):?(\d\d)?$/.exec(m[4]);
    if (q) off = (q[1] === '-' ? -1 : 1) * (+q[2] * 60 + (+q[3] || 0));
    return base - off + 540;
  }
  function calCalendars(calendars) {
    return (calendars || []).map(function (c, i) {
      var k = Math.round(+c.color);
      if (!(k >= 1 && k <= 4)) k = c.color == null && i < 4 ? i + 1 : 0;
      return { id: c.id, label: c.label || String(c.id), c: k };
    });
  }
  function calNorm(items, calendars) {
    var cals = {}, out = [];
    calCalendars(calendars).forEach(function (c) { cals[c.id] = c; });
    (items || []).forEach(function (it, i) {
      var w = it.when || {}, kind = it.kind || 'event', row = !!w.allDay || kind === 'marker' || kind === 'task' || kind === 'span', a = calMin(w.start), b = w.end ? calMin(w.end) : NaN;
      if (isNaN(a)) return;
      if (row) { a = Math.floor(a / 1440) * 1440; b = isNaN(b) ? a + 1440 : Math.ceil(b / 1440) * 1440; if (b <= a) b = a + 1440; }
      else if (isNaN(b) || b <= a) b = a + 30;
      var cal = cals[it.calendar], busy = it.privacy === 'busy', bk = it.booking;
      out.push({ raw: it, id: it.id != null ? String(it.id) : 'i' + i, kind: kind, row: row, a: a, b: b, title: busy ? CAL_BUSY : String(it.title || ''), status: CAL_STATUS[it.status] ? it.status : 'confirmed',
        type: it.type, c: busy || !cal ? 0 : cal.c, cal: cal ? cal.label : '', resource: it.resource, busy: busy, slot: kind === 'slot',
        cap: bk && bk.capacity != null ? { used: bk.used || 0, capacity: bk.capacity } : null, done: !!(it.task && it.task.done) });
    });
    return out;
  }
  NS.calItems = calNorm;
  function calTime(x) { return x.row ? '종일' : calHm(x.a) + '~' + calHm(x.b); }
  function calAria(x) {
    var n = Math.floor(x.a / 1440), t = calMd(n) + ' ' + KDOW[calDow(n)] + '요일 ' + calTime(x) + ', ' + x.title;
    if (x.kind === 'task') t += ', 할 일' + (x.done ? ' 완료' : '');
    if (x.slot && x.cap) t += ', 예약 ' + x.cap.used + '/' + x.cap.capacity;
    if (x.cal && !x.busy) t += ', ' + x.cal;
    if (!x.busy && (x.status !== 'confirmed' || x.kind === 'event')) t += ', ' + CAL_STATUS[x.status];
    return t;
  }
  /* 월력이 받는 모양(events·spans·holidays)으로 바꿉니다. 열린 시간(slot)은 점·막대 없이 고른 날 목록에 "열린 시간 n개"로만 보입니다. */
  function calMonth(items, cfg, today) {
    var out = { events: [], spans: [], holidays: [], slots: {} }, t0 = calDn(today);
    calNorm(items, cfg.calendars).forEach(function (x) {
      var d0 = Math.floor(x.a / 1440), last = x.row ? x.b / 1440 - 1 : d0, ds = calStr(d0);
      var tail = x.status === 'cancelled' ? ' (취소)' : x.status === 'tentative' ? ' (미확정)' : '';
      if (x.slot) { out.slots[ds] = (out.slots[ds] || 0) + 1; return; }
      if (x.kind === 'marker' && x.type === 'holiday') { for (var n = d0; n <= last; n++) out.holidays.push({ date: calStr(n), title: x.title }); return; }
      if (x.kind === 'marker') { for (var m = d0; m <= last; m++) out.events.push({ date: calStr(m), title: x.title + tail, c: x.c }); return; }
      if (x.kind === 'span' || (x.row && last > d0 && x.kind !== 'task')) { out.spans.push({ from: ds, to: calStr(last), title: x.title + tail, phase: last < t0 ? 'past' : d0 > t0 ? 'next' : 'now' }); return; }
      out.events.push({ date: ds, title: x.title + tail, time: x.kind === 'task' ? (x.done ? '할 일 · 완료' : '할 일') : x.row ? undefined : calHm(x.a), c: x.c });
    });
    return out;
  }

  /* ---------- 주·일 시간 격자 .cl-week ---------- */
  function weekGo(el, cfg) { NS.week(el, cfg); emit(el, 'cl-nav', el.clWeekSt.nav); }
  NS.week = function (el, cfg) {
    cfg = cfg || el.clWeek || JSON.parse(el.getAttribute('data-week'));
    el.clWeek = cfg; el.classList.add('cl-week');
    var st = el.clWeekSt || (el.clWeekSt = { cur: null, rng: null, open: {} });
    function qa(root, sel) { return Array.prototype.slice.call(root.querySelectorAll(sel)); }
    /* 다시 그리기 전에 포커스와 스크롤 위치를 적어 둡니다. */
    var grid0 = el.querySelector('.cl-week__grid'), act = doc.activeElement, hadFocus = !!(grid0 && act && grid0.contains(act)), actSel = null;
    if (!hadFocus && act && el.contains(act)) {
      if (act.dataset.wk) actSel = '[data-wk="' + act.dataset.wk + '"]';
      else if (act.dataset.view && act.closest('.cl-week__views')) actSel = '.cl-week__views [data-view="' + act.dataset.view + '"]';
      else if (act.classList.contains('cl-week__sd')) actSel = '.cl-week__sd[data-n="' + act.dataset.n + '"]';
    }
    var sc0 = el.querySelector('.cl-week__scroll'), prevTop = sc0 ? sc0.scrollTop : null;

    var byRes = (cfg.columns || el.getAttribute('data-columns')) === 'resource' && (cfg.resources || []).length > 0;
    var view = byRes || cfg.view === 'day' ? 'day' : 'week';
    var real = new Date(), nowM = cfg.now ? calMin(cfg.now) : NaN;
    var nowAm = isNaN(nowM) ? calDn(ymd(real)) * 1440 + real.getHours() * 60 + real.getMinutes() : nowM;
    var today = cfg.today || calStr(Math.floor(nowAm / 1440));
    var date = cfg.date || today, dnum = calDn(date);
    var ws = (cfg.weekStart || 0) % 7, hrs = cfg.hours || {}, h0 = hrs.start != null ? +hrs.start : 8, h1 = hrs.end != null ? +hrs.end : 22;
    if (!(h1 > h0)) { h0 = 8; h1 = 22; }
    var narrow = !byRes && view === 'week' && el.clientWidth > 0 && el.clientWidth < 600;
    var hpx = view === 'day' ? 64 : 48, sh = hpx / 2, nslot = (h1 - h0) * 2;
    var wk0 = dnum - (calDow(dnum) - ws + 7) % 7;
    var cols = [];
    if (byRes) cfg.resources.forEach(function (r) { cols.push({ n: dnum, res: r.id, label: r.label }); });
    else if (view === 'day' || narrow) cols.push({ n: dnum });
    else for (var i0 = 0; i0 < 7; i0++) cols.push({ n: wk0 + i0 });
    var N = cols.length, n0 = cols[0].n, n1 = cols[N - 1].n + 1;
    var items = calNorm(cfg.items, cfg.calendars), reg = [];
    var hol = {}; (cfg.holidays || []).forEach(function (x) { hol[x.date] = x.title; });
    items = items.filter(function (x) { if (x.kind === 'marker' && x.type === 'holiday') { for (var q = Math.floor(x.a / 1440); q < x.b / 1440; q++) hol[calStr(q)] = x.title; return false; } return true; });
    var closedDow = {}; (cfg.closed || []).forEach(function (d) { closedDow[d] = 1; });
    var id = el.id || st.id || (st.id = 'clw' + (++CHART_N)), step = view === 'week' ? 7 : 1;

    /* 머리: 기간 이름, 주|일, 오늘, ‹ › */
    var title = view === 'day' ? calMd(dnum) + ' ' + KDOW[calDow(dnum)] + '요일' : calMd(wk0) + ' – ' + (new Date(wk0 * 864e5).getUTCMonth() === new Date((wk0 + 6) * 864e5).getUTCMonth() ? new Date((wk0 + 6) * 864e5).getUTCDate() + '일' : calMd(wk0 + 6));
    var Y = new Date((view === 'day' ? dnum : wk0) * 864e5).getUTCFullYear();
    var h = '<div class="cl-week__head"><h3 class="cl-week__title" id="' + id + '-t">' + title + ' <small>' + Y + '년</small></h3><div class="cl-week__tools">' +
      (byRes ? '' : '<span class="cl-seg cl-seg--sm cl-week__views" role="radiogroup" aria-label="보기"><span class="cl-seg__thumb" aria-hidden="true"></span><button class="cl-seg__item" role="radio" data-view="week" aria-checked="' + (view === 'week') + '">주</button><button class="cl-seg__item" role="radio" data-view="day" aria-checked="' + (view === 'day') + '">일</button></span>') +
      '<button class="cl-btn cl-btn--gray cl-btn--sm" data-wk="today">오늘</button>' +
      '<span class="cl-week__nav"><button class="cl-btn cl-btn--icon cl-btn--plain" data-wk="-1" aria-label="' + (step === 7 ? '이전 주' : '이전 날') + '">‹</button><button class="cl-btn cl-btn--icon cl-btn--plain" data-wk="1" aria-label="' + (step === 7 ? '다음 주' : '다음 날') + '">›</button></span></div></div>';
    /* 좁은 화면: 하루만 보이고 7일 띠로 날을 바꿉니다. */
    if (narrow) {
      h += '<div class="cl-week__strip" role="group" aria-label="요일 선택">';
      for (var si = 0; si < 7; si++) {
        var sn = wk0 + si, sd = calStr(sn), sw = calDow(sn);
        h += '<button type="button" class="cl-week__sd' + (sw === 0 || sw === 6 || closedDow[sw] ? ' is-weekend' : '') + (sd === today ? ' is-today' : '') + (sn === dnum ? ' is-sel' : '') + '" data-n="' + sn + '" aria-pressed="' + (sn === dnum) + '" aria-label="' + calMd(sn) + ' ' + KDOW[sw] + '요일' + (sd === today ? ', 오늘' : '') + '"><span>' + KDOW[sw] + '</span><b>' + new Date(sn * 864e5).getUTCDate() + '</b></button>';
      }
      h += '</div>';
    }

    /* 열 머리 */
    var hdr = '<div class="cl-week__hdr" role="row"><span class="cl-week__g" role="columnheader"><span class="cl-sr">시간</span></span>';
    cols.forEach(function (c) {
      if (c.res != null) { hdr += '<span role="columnheader" class="cl-week__dh is-res"><span class="cl-week__dlabel">' + esc(c.label) + '</span></span>'; return; }
      var ds = calStr(c.n), dw = calDow(c.n), isT = ds === today;
      var lab = calMd(c.n) + ' ' + KDOW[dw] + '요일' + (isT ? ', 오늘' : '') + (hol[ds] ? ', ' + hol[ds] : '') + (closedDow[dw] ? ', 휴원' : '');
      var inner = '<span class="cl-week__dow">' + KDOW[dw] + '</span><span class="cl-week__dnum">' + new Date(c.n * 864e5).getUTCDate() + '</span>' + (closedDow[dw] ? '<span class="cl-week__dnote">휴원</span>' : '');
      hdr += '<span role="columnheader" class="cl-week__dh' + (dw === 0 || dw === 6 ? ' is-weekend' : '') + (closedDow[dw] ? ' is-closed' : '') + (hol[ds] ? ' is-holiday' : '') + (isT ? ' is-today' : '') + '"' + (isT ? ' aria-current="date"' : '') + (view === 'week' && !narrow ? '' : ' aria-label="' + esc(lab) + '"') + '>' +
        (view === 'week' && !narrow ? '<button type="button" class="cl-week__dhb" data-n="' + c.n + '" aria-label="' + esc(lab + ', 일 보기') + '">' + inner + '</button>' : '<span class="cl-week__dhb">' + inner + '</span>') + '</span>';
    });
    hdr += '</div>';

    /* 종일 줄: 종일 일정·여러 날 기간·표시(공휴일)·할 일 */
    var resIds = byRes ? cfg.resources.map(function (r) { return r.id; }) : [];
    var adl = [];
    items.forEach(function (x) { if (x.row && x.a / 1440 < n1 && x.b / 1440 > n0) adl.push({ x: x }); });
    for (var hn = n0; hn < n1; hn++) { var hs = calStr(hn); if (hol[hs]) adl.push({ hol: true, x: { title: hol[hs], kind: 'marker', a: hn * 1440, b: hn * 1440 + 1440 } }); }
    adl.forEach(function (p) {
      var x = p.x, ri = byRes && x.resource != null ? resIds.indexOf(x.resource) : -1;
      if (byRes) { p.c0 = ri >= 0 ? ri : 0; p.c1 = ri >= 0 ? ri + 1 : N; }
      else { p.c0 = Math.max(0, Math.floor(x.a / 1440) - n0); p.c1 = Math.min(N, x.b / 1440 - n0); }
      p.rank = x.kind === 'marker' ? 2 : x.kind === 'task' ? 1 : 0;
    });
    adl.sort(function (p, q) { return p.rank - q.rank || p.c0 - q.c0 || (q.c1 - q.c0) - (p.c1 - p.c0); });
    var lanes = [], ad = '';
    adl.forEach(function (p) {
      var l = 0; while ((lanes[l] || []).some(function (r) { return !(p.c1 <= r[0] || p.c0 >= r[1]); })) l++;
      (lanes[l] = lanes[l] || []).push([p.c0, p.c1]); p.lane = l;
    });
    adl.forEach(function (p) {
      var x = p.x, style = 'grid-column:' + (p.c0 + 1) + '/' + (p.c1 + 1) + ';grid-row:' + (p.lane + 1);
      if (p.hol) { ad += '<span class="cl-week__ai is-marker" style="' + style + '" aria-label="공휴일, ' + esc(x.title) + '"><span class="cl-week__ai-t">' + esc(x.title) + '</span></span>'; return; }
      var k = reg.push(x) - 1, type = x.kind === 'marker' ? 'marker' : x.kind === 'task' ? 'task' : 'bar';
      ad += '<button type="button" class="cl-week__ai is-' + type + ' is-' + x.status + (x.busy ? ' is-busy' : '') + (x.done ? ' is-done' : '') + '" data-k="' + k + '" data-id="' + esc(x.id) + '" data-col="' + p.c0 + '" data-a="' + x.a + '" data-row="1" data-c="' + x.c + '" tabindex="-1" style="' + style + '" aria-label="' + esc(calAria(x)) + '" title="' + esc(x.title) + '">' +
        (type === 'task' ? '<i class="cl-week__chk" aria-hidden="true">' + (x.done ? icon('check') : '') + '</i>' : '') + '<span class="cl-week__ai-t">' + esc(x.title) + '</span></button>';
    });
    var adRow = adl.length ? '<div class="cl-week__ad" role="row"><span class="cl-week__g" role="rowheader">종일</span><div class="cl-week__adc" role="gridcell" aria-label="종일 일정">' + ad + '</div></div>' : '';

    /* 시각이 있는 일정: 열마다 겹치는 묶음을 나란히 배치, 열이 3개를 넘으면 2개 + "+n" */
    var cellHtml = [], minStart = Infinity;
    cols.forEach(function (c, ci) {
      cellHtml[ci] = [];
      var cs = c.n * 1440 + h0 * 60, ce = c.n * 1440 + h1 * 60, list = [], cl = null, cls = [];
      items.forEach(function (x) { if (!x.row && x.a < ce && x.b > cs && (!byRes || x.resource === c.res)) list.push({ x: x, a: Math.max(x.a, cs), b: Math.min(x.b, ce) }); });
      list.sort(function (p, q) { return p.a - q.a || q.b - p.b; });
      list.forEach(function (p) {
        if (!cl || p.a >= cl.end) { cl = { items: [], end: p.b, cols: [], key: ci + ':' + p.a }; cls.push(cl); }
        if (p.b > cl.end) cl.end = p.b;
        var k = 0; while (cl.cols[k] !== undefined && cl.cols[k] > p.a) k++;
        cl.cols[k] = p.b; p.k = k; cl.items.push(p);
      });
      function put(s, html) { (cellHtml[ci][s] = cellHtml[ci][s] || []).push(html); }
      cls.forEach(function (g) {
        var M = g.cols.length, folded = M > 3 && !st.open[g.key], hidden = 0, hid0 = Infinity;
        if (folded) M = 3;
        g.items.forEach(function (p) {
          if (folded && p.k >= 2) { hidden++; hid0 = Math.min(hid0, p.a); return; }
          var x = p.x, s = Math.floor((p.a - cs) / 30), top = (p.a - cs - s * 30) / 60 * hpx, hgt = Math.max((p.b - p.a) / 60 * hpx - 2, 20), ki = reg.push(x) - 1;
          minStart = Math.min(minStart, p.a - cs);
          var meta = calTime(x) + (x.slot && x.cap ? ' · <b class="cl-week__cap">' + x.cap.used + '/' + x.cap.capacity + '</b>' : '') + (!x.busy && x.status !== 'confirmed' ? ' · ' + CAL_STATUS[x.status] : '');
          put(s, '<button type="button" class="cl-week__ev' + (x.slot ? ' is-slot' : '') + (x.busy ? ' is-busy' : '') + ' is-' + x.status + (hgt < 40 ? ' is-short' : M === 1 ? ' is-wide' : '') + '" data-k="' + ki + '" data-id="' + esc(x.id) + '" data-col="' + ci + '" data-a="' + x.a + '" data-c="' + x.c + '" tabindex="-1" style="top:' + top + 'px;height:' + hgt + 'px;--wk-k:' + p.k + ';--wk-m:' + M + '" aria-label="' + esc(calAria(x)) + '" title="' + esc(x.title + ' ' + calTime(x)) + '"><span class="cl-week__ev-t">' + esc(x.title) + '</span><span class="cl-week__ev-m">' + meta + '</span></button>');
        });
        if (hidden) { var s2 = Math.floor((hid0 - cs) / 30); put(s2, '<button type="button" class="cl-week__more" data-more="' + g.key + '" data-col="' + ci + '" tabindex="-1" style="top:' + (hid0 - cs - s2 * 30) / 60 * hpx + 'px;--wk-k:2;--wk-m:3" aria-label="겹치는 일정 ' + hidden + '개 더 보기">+' + hidden + '</button>'); }
      });
    });
    var body = '';
    for (var s = 0; s < nslot; s++) {
      var mm = h0 * 60 + s * 30, hr = mm % 60 === 0;
      body += '<div class="cl-week__row' + (hr ? ' is-hour' : '') + '" role="row"><span class="cl-week__g" role="rowheader">' + (hr ? calHm(mm) : '<span class="cl-sr">' + calHm(mm) + '</span>') + '</span>';
      for (var ci2 = 0; ci2 < N; ci2++) {
        var c2 = cols[ci2];
        body += '<div class="cl-week__cell" role="gridcell" tabindex="-1" data-col="' + ci2 + '" data-slot="' + s + '" aria-label="' + esc(calMd(c2.n) + ' ' + KDOW[calDow(c2.n)] + '요일 ' + calHm(mm) + (c2.res != null ? ', ' + c2.label : '')) + '">' + (cellHtml[ci2][s] || []).join('') + '</div>';
      }
      body += '</div>';
    }
    /* 지금 시각: 오늘 열에만 강조색 선 */
    var nowMin = nowAm % 1440, ti = byRes ? (calStr(dnum) === today ? 0 : -1) : cols.findIndex(function (c) { return calStr(c.n) === today; });
    if (ti >= 0 && nowMin >= h0 * 60 && nowMin < h1 * 60) body += '<div class="cl-week__now" aria-hidden="true" style="top:' + (nowMin - h0 * 60) / 60 * hpx + 'px;--wk-i:' + ti + ';--wk-s:' + (byRes ? N : 1) + '"></div>';

    h += '<div class="cl-week__scroll"><div class="cl-week__grid" role="grid" aria-labelledby="' + id + '-t" style="--wk-n:' + N + '"><div class="cl-week__top" role="rowgroup">' + hdr + adRow + '</div><div class="cl-week__body" role="rowgroup" style="--wk-hpx:' + hpx + 'px">' + body + '</div></div></div>';
    var leg = calCalendars(cfg.calendars).filter(function (c) { return c.c; });
    if (leg.length) h += '<p class="cl-week__legend">' + leg.map(function (c) { return '<span data-c="' + c.c + '"><i></i>' + esc(c.label) + '</span>'; }).join('') + '</p>';
    el.innerHTML = h;
    if (byRes) el.setAttribute('data-columns', 'resource'); else el.removeAttribute('data-columns');
    el.setAttribute('data-view', view);
    if (narrow) el.setAttribute('data-narrow', ''); else el.removeAttribute('data-narrow');
    st.narrow = narrow; st.byRes = byRes; st.view = view;
    st.nav = { date: date, view: view, from: calStr(view === 'week' ? wk0 : dnum), to: calStr(view === 'week' ? wk0 + 7 : dnum + 1) };

    var grid = el.querySelector('.cl-week__grid'), sc = el.querySelector('.cl-week__scroll'), bodyEl = el.querySelector('.cl-week__body'), top = el.querySelector('.cl-week__top');
    function cellAt(ci, sl) { return grid.querySelector('.cl-week__cell[data-col="' + ci + '"][data-slot="' + sl + '"]'); }
    function setCur(t) {
      var o = grid.querySelector('[tabindex="0"]'); if (o && o !== t) o.tabIndex = -1;
      t.tabIndex = 0; st.cur = t.hasAttribute('data-k') ? 'i:' + t.dataset.id : 'c:' + t.dataset.col + ':' + t.dataset.slot;
    }
    function focusEl(t) { setCur(t.hasAttribute('data-more') ? t.parentNode : t); t.focus(); }
    function paint() {
      var r = st.rng, lo = r ? Math.min(r.a, r.h) : -1, hi = r ? Math.max(r.a, r.h) : -1;
      qa(grid, '.cl-week__cell').forEach(function (x) {
        var on = !!r && +x.dataset.col === r.ci && +x.dataset.slot >= lo && +x.dataset.slot <= hi;
        x.classList.toggle('is-range', on);
        if (on) x.setAttribute('aria-selected', 'true'); else x.removeAttribute('aria-selected');
      });
    }
    function emitRange() {
      var r = st.rng; if (!r) return;
      var base = cols[r.ci].n * 1440 + h0 * 60, lo = Math.min(r.a, r.h), hi = Math.max(r.a, r.h), d = { start: calIso(base + lo * 30), end: calIso(base + (hi + 1) * 30) };
      if (cols[r.ci].res != null) d.resource = cols[r.ci].res;
      emit(el, 'cl-range', d);
    }
    function shift(days, ci, sl) { st.cur = 'c:' + ci + ':' + sl; st.rng = null; cfg.date = calStr(dnum + days); weekGo(el, cfg); }
    paint();

    /* 커서 자리(롤링 tabindex): 이전 자리 → 없으면 날짜 열의 09:00 */
    var tgt = null, pp = st.cur ? st.cur.split(':') : null;
    if (pp && pp[0] === 'c') tgt = cellAt(+pp[1], +pp[2]);
    else if (pp) tgt = qa(grid, '[data-k]').filter(function (x) { return x.dataset.id === st.cur.slice(2); })[0];
    if (!tgt) tgt = cellAt(Math.max(0, cols.findIndex(function (c) { return c.n === dnum; })), Math.max(0, Math.min(nslot - 1, (9 - h0) * 2)));
    setCur(tgt);
    sc.style.scrollPaddingTop = top.offsetHeight + 'px';
    if (prevTop != null) sc.scrollTop = prevTop; else if (isFinite(minStart)) sc.scrollTop = Math.max(0, (minStart - 60) / 60 * hpx);
    if (hadFocus) tgt.focus();
    else if (actSel) { var af = el.querySelector(actSel); if (af) af.focus(); }

    /* 머리 단추, 요일 띠, 보기 전환 */
    qa(el, '[data-wk]').forEach(function (b) {
      b.addEventListener('click', function () { var v = b.dataset.wk; cfg.date = v === 'today' ? today : calStr(dnum + (+v) * step); st.rng = null; weekGo(el, cfg); });
    });
    qa(el, '.cl-week__sd').forEach(function (b) { b.addEventListener('click', function () { cfg.date = calStr(+b.dataset.n); st.rng = null; weekGo(el, cfg); }); });
    qa(el, '.cl-week__views [data-view]').forEach(function (b) { b.addEventListener('click', function () { if (cfg.view === b.dataset.view) return; cfg.view = b.dataset.view; st.rng = null; weekGo(el, cfg); }); });

    /* 고르기: 일정, "+n", 요일 머리, 빈 시간 */
    grid.addEventListener('click', function (e) {
      var m = e.target.closest('[data-more]');
      if (m) {
        if (view === 'week' && !narrow) { cfg.date = calStr(cols[+m.dataset.col].n); cfg.view = 'day'; st.rng = null; weekGo(el, cfg); }
        else { st.open[m.dataset.more] = 1; NS.week(el, cfg); }
        return;
      }
      var it = e.target.closest('[data-k]');
      if (it) { setCur(it); emit(el, 'cl-select', { item: reg[+it.dataset.k].raw }); return; }
      var hb = e.target.closest('.cl-week__dhb[data-n]');
      if (hb) { cfg.date = calStr(+hb.dataset.n); cfg.view = 'day'; st.rng = null; weekGo(el, cfg); return; }
      var c = e.target.closest('.cl-week__cell');
      if (c && Date.now() - (st.dragAt || 0) > 500) { st.rng = { ci: +c.dataset.col, a: +c.dataset.slot, h: +c.dataset.slot }; paint(); focusEl(c); emitRange(); }
    });
    /* 빈 시간 끌기: 같은 열 안에서 30분 단위로 범위를 잡고 놓을 때 cl-range (터치는 위아래 쓸기가 스크롤이라 누르기만) */
    grid.addEventListener('pointerdown', function (e) {
      if (e.button !== 0 || e.pointerType === 'touch') return;
      var c = e.target.closest('.cl-week__cell'); if (!c || e.target.closest('[data-k], [data-more]')) return;
      var ci = +c.dataset.col, s0 = +c.dataset.slot;
      st.rng = { ci: ci, a: s0, h: s0 }; paint(); focusEl(c); e.preventDefault();
      function mv(ev) { var r = bodyEl.getBoundingClientRect(), s1 = Math.max(0, Math.min(nslot - 1, Math.floor((ev.clientY - r.top) / sh))); if (st.rng && st.rng.h !== s1) { st.rng.h = s1; paint(); } }
      function end() { doc.removeEventListener('pointermove', mv); doc.removeEventListener('pointerup', up); doc.removeEventListener('pointercancel', cancel); }
      function up() { end(); st.dragAt = Date.now(); emitRange(); }
      function cancel() { end(); st.rng = null; paint(); }
      doc.addEventListener('pointermove', mv); doc.addEventListener('pointerup', up); doc.addEventListener('pointercancel', cancel);
    });
    grid.addEventListener('focusin', function (e) { var t = e.target.closest('.cl-week__cell, [data-k]'); if (t && grid.contains(t)) setCur(t); });

    /* 키보드(WAI-ARIA 격자): 빈 시간은 ↑↓ 30분 · ←→ 열, 일정은 ↑↓ 같은 열의 이전·다음 일정 · ←→ 옆 열의 가까운 일정 */
    grid.addEventListener('keydown', function (e) {
      var t = e.target, k = e.key, it = t.closest('[data-k]'), c = t.closest('.cl-week__cell'), ci, n = null;
      if (it) {
        ci = +it.dataset.col;
        var lst = qa(grid, '[data-k][data-col="' + ci + '"]').sort(function (p, q) { return (q.dataset.row ? 1 : 0) - (p.dataset.row ? 1 : 0) || p.dataset.a - q.dataset.a; }), i = lst.indexOf(it);
        if (k === 'ArrowDown') n = lst[i + 1]; else if (k === 'ArrowUp') n = lst[i - 1];
        else if (k === 'Home') n = lst[0]; else if (k === 'End') n = lst[lst.length - 1];
        else if (k === 'ArrowLeft' || k === 'ArrowRight') {
          var cj = ci + (k === 'ArrowLeft' ? -1 : 1);
          if (cj < 0 || cj >= N) { e.preventDefault(); return; }
          var a0 = it.dataset.a % 1440, pool = qa(grid, '[data-k][data-col="' + cj + '"]'), same = pool.filter(function (p) { return !!p.dataset.row === !!it.dataset.row; }), near = (same.length ? same : pool).sort(function (p, q) { return Math.abs(p.dataset.a % 1440 - a0) - Math.abs(q.dataset.a % 1440 - a0); })[0];
          var ic = it.closest('.cl-week__cell');
          n = near || cellAt(cj, ic ? +ic.dataset.slot : 0);
        }
        else if (k === 'Escape') { if (st.rng) { st.rng = null; paint(); } var oc = it.closest('.cl-week__cell') || cellAt(ci, 0); if (oc) focusEl(oc); e.preventDefault(); return; }
        else return;
        e.preventDefault(); if (n) focusEl(n); return;
      }
      if (!c) return;
      ci = +c.dataset.col; var s1 = +c.dataset.slot, ns = s1, nc = ci;
      if (k === 'ArrowUp') ns--; else if (k === 'ArrowDown') ns++; else if (k === 'ArrowLeft') nc--; else if (k === 'ArrowRight') nc++;
      else if (k === 'Home') nc = 0; else if (k === 'End') nc = N - 1;
      else if (k === 'PageUp' || k === 'PageDown') { e.preventDefault(); shift((k === 'PageUp' ? -1 : 1) * step, ci, s1); return; }
      else if (k === 'Escape') { if (st.rng) { st.rng = null; paint(); e.preventDefault(); } return; }
      else if (k === 'Enter' || k === ' ') {
        e.preventDefault();
        var here = qa(c, '[data-k], [data-more]');
        if (st.rng && st.rng.ci === ci && s1 >= Math.min(st.rng.a, st.rng.h) && s1 <= Math.max(st.rng.a, st.rng.h)) emitRange();
        else if (here.length) focusEl(here[0]);
        else { st.rng = { ci: ci, a: s1, h: s1 }; paint(); emitRange(); }
        return;
      }
      else return;
      e.preventDefault();
      if (e.shiftKey) {
        if (k !== 'ArrowUp' && k !== 'ArrowDown') return;
        if (!st.rng || st.rng.ci !== ci) st.rng = { ci: ci, a: s1, h: s1 };
        st.rng.h = Math.max(0, Math.min(nslot - 1, st.rng.h + (k === 'ArrowUp' ? -1 : 1))); paint();
        var hc = cellAt(ci, st.rng.h); setCur(hc); hc.focus(); emitRange(); return;
      }
      if (nc < 0 || nc >= N) {
        if (byRes) return;
        if (view === 'day' || narrow) { shift(nc < 0 ? -1 : 1, 0, s1); return; }
        shift(nc < 0 ? n0 - 1 - dnum : n1 - dnum, nc < 0 ? N - 1 : 0, s1); return;
      }
      ns = Math.max(0, Math.min(nslot - 1, ns));
      if (st.rng) { st.rng = null; paint(); }
      focusEl(cellAt(nc, ns));
    });

    /* 지금 시각 선은 1분마다 옮깁니다(now를 넘겼으면 고정). */
    st.tick = function () { var ln = el.querySelector('.cl-week__now'); if (!ln) return; var r = new Date(), m = r.getHours() * 60 + r.getMinutes(); ln.hidden = m < h0 * 60 || m >= h1 * 60; ln.style.top = (m - h0 * 60) / 60 * hpx + 'px'; };
    if (!cfg.now && !el.clWeekTimer) el.clWeekTimer = setInterval(function () { if (!el.isConnected) { clearInterval(el.clWeekTimer); el.clWeekTimer = 0; return; } if (st.tick) st.tick(); }, 60000);
    /* 600px 아래로 좁아지거나 넓어지면 보기를 바꿉니다. */
    if (window.ResizeObserver && !el.clWeekRO) {
      el.clWeekRO = new ResizeObserver(function () { var nw = !st.byRes && st.view === 'week' && el.clientWidth > 0 && el.clientWidth < 600; if (nw !== st.narrow) NS.week(el); });
      el.clWeekRO.observe(el);
    }
    try { bindSegmented(el); } catch (e2) {}
  };
  function bindWeek(root) {
    all(root, '.cl-week[data-week]').forEach(function (el) { if (!once(el, 'Week')) return; NS.week(el); });
  }

  /* ---------- 목록 .cl-agenda ---------- */
  NS.agenda = function (el, cfg) {
    cfg = cfg || el.clAgenda || JSON.parse(el.getAttribute('data-agenda'));
    el.clAgenda = cfg; el.classList.add('cl-agenda');
    var items = calNorm(cfg.items, cfg.calendars), today = cfg.today || ymd(new Date()), from = cfg.from ? calDn(cfg.from) : -Infinity, to = cfg.to ? calDn(cfg.to) : Infinity;
    var days = {}, reg = [];
    items.forEach(function (x) {
      var d0 = Math.floor(x.a / 1440), d1 = x.row ? x.b / 1440 - 1 : d0;
      for (var n = Math.max(d0, from); n <= Math.min(d1, to); n++) (days[n] = days[n] || []).push(x);
    });
    var keys = Object.keys(days).map(Number).sort(function (p, q) { return p - q; }), h = '', first = true, t0 = calDn(today);
    keys.forEach(function (n) {
      var list = days[n].sort(function (p, q) { return (q.row ? 1 : 0) - (p.row ? 1 : 0) || p.a - q.a; });
      h += '<section class="cl-agenda__day' + (n === t0 ? ' is-today' : '') + '"><h4 class="cl-agenda__date">' + calMd(n) + ' ' + KDOW[calDow(n)] + '요일' + (n === t0 ? ' <span class="cl-agenda__today">오늘</span>' : '') + '</h4><ul class="cl-agenda__list">';
      list.forEach(function (x) {
        var st = x.busy ? '' : x.kind === 'task' ? (x.done ? '완료' : '할 일') : x.slot && x.cap ? '예약 ' + x.cap.used + '/' + x.cap.capacity : x.kind === 'marker' || x.kind === 'span' ? '' : CAL_STATUS[x.status];
        h += '<li><button type="button" class="cl-agenda__row is-' + x.status + (x.busy ? ' is-busy' : '') + (x.slot ? ' is-slot' : '') + (x.done ? ' is-done' : '') + '" data-k="' + (reg.push(x) - 1) + '" data-c="' + x.c + '" tabindex="' + (first ? 0 : -1) + '" aria-label="' + esc(calAria(x)) + '">' +
          '<span class="cl-agenda__time">' + (x.row ? '종일' : '<b>' + calHm(x.a) + '</b><span>' + calHm(x.b) + '</span>') + '</span><i class="cl-agenda__dot" aria-hidden="true"></i>' +
          '<span class="cl-agenda__title">' + esc(x.title) + '</span><span class="cl-agenda__status">' + st + '</span></button></li>';
        first = false;
      });
      h += '</ul></section>';
    });
    if (!keys.length) h = '<div class="cl-empty"><span class="cl-empty__icon"><svg class="cl-icon" viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="5.5" width="16" height="14" rx="3"/><path d="M4 10h16M8.5 3.5v4M15.5 3.5v4"/></svg></span><p class="cl-empty__title">이 기간에는 일정이 없습니다.</p></div>';
    el.innerHTML = h;
    if (!el.hasAttribute('aria-label') && !el.hasAttribute('aria-labelledby')) el.setAttribute('aria-label', '일정 목록');
    var rows = Array.prototype.slice.call(el.querySelectorAll('.cl-agenda__row'));
    rows.forEach(function (r) {
      r.addEventListener('click', function () { rows.forEach(function (x) { x.tabIndex = x === r ? 0 : -1; }); emit(el, 'cl-select', { item: reg[+r.dataset.k].raw }); });
      r.addEventListener('keydown', function (e) {
        var i = rows.indexOf(r), n = e.key === 'ArrowDown' ? rows[i + 1] : e.key === 'ArrowUp' ? rows[i - 1] : e.key === 'Home' ? rows[0] : e.key === 'End' ? rows[rows.length - 1] : null;
        if (!/^(ArrowDown|ArrowUp|Home|End)$/.test(e.key)) return;
        e.preventDefault(); if (n) { rows.forEach(function (x) { x.tabIndex = x === n ? 0 : -1; }); n.focus(); }
      });
    });
  };
  function bindAgenda(root) {
    all(root, '.cl-agenda[data-agenda]').forEach(function (el) { if (!once(el, 'Agenda')) return; NS.agenda(el); });
  }

  /* ============ 인쇄 미리보기 .cl-preview (v6.5, print.md) ============
     정보 칸 '인쇄' 모드의 보드입니다. 보이는 그대로 인쇄하고, 빨간 크롭 프레임이 본문 칸에 지금 보이는 범위를 따라갑니다.
     원본: [data-cl-print-source="id"], 보드: .cl-preview[data-cl-preview-of="id"]. 쪽(.cl-preview__page)을 앱이 그리지 않으면 원본을 복제해 이어진 한 장으로 보여 줍니다. */
  function previewSource(board) {
    var id = board && board.getAttribute('data-cl-preview-of'); if (!id) return null;
    return doc.querySelector('[data-cl-print-source="' + (window.CSS && CSS.escape ? CSS.escape(id) : id) + '"]');
  }
  function previewParts(board) {
    var stage = board.querySelector('.cl-preview__stage'); if (!stage) return null;
    var sheets = stage.querySelector('.cl-preview__sheets');
    if (!sheets) { sheets = doc.createElement('div'); sheets.className = 'cl-preview__sheets'; stage.appendChild(sheets); }
    var frame = stage.querySelector('.cl-preview__frame');
    if (!frame) { frame = doc.createElement('div'); frame.className = 'cl-preview__frame'; frame.setAttribute('aria-hidden', 'true'); frame.hidden = true; stage.appendChild(frame); }
    return { stage: stage, sheets: sheets, frame: frame, pages: all(sheets, '.cl-preview__page') };
  }
  /* 원본에서 지금 보이는 범위(0~1 비율). 원본을 감싼 스크롤 칸(없으면 창) 기준입니다. */
  function previewRange(src) {
    var sp = scrollParent(src), r = src.getBoundingClientRect(), h = r.height || 1;
    var vt = sp === window ? 0 : sp.getBoundingClientRect().top;
    var vb = sp === window ? (window.innerHeight || doc.documentElement.clientHeight) : sp.getBoundingClientRect().bottom;
    return { from: Math.max(0, Math.min(h, vt - r.top)) / h, to: Math.max(0, Math.min(h, vb - r.top)) / h };
  }
  /* 쪽 경계: 이어진 한 장(data-flow="continuous")에 쪽 높이마다 점선과 "n쪽 끝". 쪽 수를 돌려줍니다. */
  function previewBreaks(pg) {
    Array.prototype.slice.call(pg.children).forEach(function (x) { if (x.classList.contains('cl-preview__break')) x.remove(); });
    if (pg.getAttribute('data-flow') !== 'continuous') return 1;
    var cs = getComputedStyle(pg), pad = parseFloat(cs.paddingTop) || 0, ph = parseFloat(cs.minHeight) || 1123, body = Math.max(40, ph - 2 * pad), H = pg.offsetHeight;
    var k = 1;
    for (var y = pad + body; y < H - pad - 1; k++, y += body) {
      var b = doc.createElement('div'); b.className = 'cl-preview__break'; b.style.top = Math.round(y) + 'px'; b.setAttribute('aria-hidden', 'true');
      var t = doc.createElement('span'); t.textContent = k + '쪽 끝'; b.appendChild(t); pg.appendChild(b);
    }
    return k;
  }
  /* 크롭 프레임 놓기. range {from, to}(0~1). follow면 프레임이 보이도록 보드를 스크롤합니다. 앱 영역(data-cl-managed)에서도 쓸 수 있습니다. */
  function previewFrame(board, range, follow) {
    var P = previewParts(board); if (!P) return;
    var f = P.frame;
    if (!range || !P.pages.length || !(range.to > range.from)) { f.hidden = true; return; }
    /* 원본에 맞대는 대상: 종이 안 내용(.cl-preview__content)이 있으면 그것, 없으면 종이 묶음. 빈 여백까지 비율에 넣지 않습니다. */
    var M = all(P.sheets, '.cl-preview__content'); if (!M.length) M = P.pages;
    var sr = P.stage.getBoundingClientRect(), a = M[0].getBoundingClientRect(), z = M[M.length - 1].getBoundingClientRect();
    a = { top: a.top, left: P.pages[0].getBoundingClientRect().left, width: P.pages[0].getBoundingClientRect().width };
    var top = a.top - sr.top + P.stage.scrollTop, total = z.bottom - a.top;
    var y1 = top + range.from * total, y2 = top + range.to * total;
    f.hidden = false;
    f.style.left = Math.round(a.left - sr.left + P.stage.scrollLeft - 4) + 'px'; f.style.width = Math.round(a.width + 8) + 'px';
    f.style.top = Math.round(y1) + 'px'; f.style.height = Math.max(4, Math.round(y2 - y1)) + 'px';
    if (follow && (y1 < P.stage.scrollTop || y2 > P.stage.scrollTop + P.stage.clientHeight)) {
      P.stage.scrollTo({ top: Math.max(0, y1 - 24), behavior: reduced() ? 'auto' : 'smooth' });
    }
  }
  /* 배율: 'fit'(보드 너비에 맞춤) 또는 숫자(0.25~2). */
  function previewZoom(board, z) {
    var P = previewParts(board); if (!P) return 1;
    var pg = P.pages[0];
    if (z === 'fit' || z == null) {
      var pw = pg ? parseFloat(getComputedStyle(pg).width) || 794 : 794, cs = getComputedStyle(P.stage);
      var avail = P.stage.clientWidth - (parseFloat(cs.paddingLeft) || 0) - (parseFloat(cs.paddingRight) || 0);
      z = Math.min(1.5, avail / pw); board._clFit = true;
    } else board._clFit = false;
    z = Math.max(0.25, Math.min(2, Math.round(z * 100) / 100));
    P.sheets.style.setProperty('--preview-zoom', z);
    board._clZoom = z;
    all(board, '.cl-preview__zoom').forEach(function (o) { o.textContent = Math.round(z * 100) + '%'; });
    return z;
  }
  function previewPrint(id) {
    var src = id ? doc.querySelector('[data-cl-print-source="' + (window.CSS && CSS.escape ? CSS.escape(id) : id) + '"]') : null;
    var h = doc.documentElement;
    if (src) { h.setAttribute('data-cl-printing', id); src.setAttribute('data-cl-printing-on', ''); }
    var done = function () { h.removeAttribute('data-cl-printing'); if (src) src.removeAttribute('data-cl-printing-on'); window.removeEventListener('afterprint', done); };
    window.addEventListener('afterprint', done);
    window.print();
    setTimeout(done, 1000);
  }
  NS.preview = {
    frame: function (board, range) { previewFrame(board, range, true); return board; },
    fit: function (board) { return previewZoom(board, 'fit'); },
    zoom: function (board, z) { return previewZoom(board, z); },
    refresh: function (board) { if (board && board._clPreview) board._clPreview.refresh(); return board; },
    print: function (id) { previewPrint(id); }
  };
  function bindPreview(root) {
    all(root, '.cl-preview').forEach(function (board) {
      if (!once(board, 'Preview')) return;
      var P = previewParts(board); if (!P) return;
      var auto = !P.pages.length, src = null, rafId = 0, mo = null, ro = null, t = 0;
      var meta = board.querySelector('.cl-preview__meta');
      function sizeName(pg) { return pg && pg.getAttribute('data-size') === 'A4-landscape' ? 'A4 가로' : 'A4'; }
      function build() {
        src = previewSource(board);
        if (auto) {
          P.sheets.innerHTML = '';
          if (!src) { var e = doc.createElement('p'); e.className = 'cl-preview__empty'; e.textContent = '인쇄할 내용을 찾지 못했습니다.'; P.sheets.appendChild(e); }
          else {
            var pg = doc.createElement('div'); pg.className = 'cl-preview__page'; pg.setAttribute('data-flow', 'continuous');
            if (board.getAttribute('data-size')) pg.setAttribute('data-size', board.getAttribute('data-size'));
            var c = src.cloneNode(true);
            [c].concat(Array.prototype.slice.call(c.querySelectorAll('[id], [data-cl-print-source]'))).forEach(function (x) { x.removeAttribute('id'); x.removeAttribute('data-cl-print-source'); });
            c.setAttribute('inert', ''); c.setAttribute('aria-hidden', 'true'); c.classList.add('cl-preview__content');
            pg.appendChild(c); P.sheets.appendChild(pg);
          }
        }
        P = previewParts(board);
        /* 종이는 모든 테마에서 흰 종이: 종이 안은 밝은 테마 토큰으로 그립니다(고대비면 light-hc). */
        var paper = /-hc$/.test(doc.documentElement.getAttribute('data-theme') || '') ? 'light-hc' : 'light';
        /* 본문의 원본도 종이로 그립니다(앱이 정한 data-theme이 있으면 그대로). */
        if (src && (!src.hasAttribute('data-theme') || src.hasAttribute('data-cl-paper'))) { src.setAttribute('data-theme', paper); src.setAttribute('data-cl-paper', ''); }
        var n = 0; P.pages.forEach(function (pg) { if (!pg.hasAttribute('data-theme') || pg.hasAttribute('data-cl-paper')) { pg.setAttribute('data-theme', paper); pg.setAttribute('data-cl-paper', ''); } n += previewBreaks(pg); });
        if (meta) meta.textContent = P.pages.length ? sizeName(P.pages[0]) + ' · ' + n + '쪽' : '';
        if (board._clFit !== false) previewZoom(board, 'fit'); else previewZoom(board, board._clZoom || 1);
        watch(); place(false);
      }
      function place(follow) { rafId = 0; previewFrame(board, src ? previewRange(src) : null, follow); }
      /* 원본을 감싼 어느 칸이 스크롤되든(창 포함) 따라갑니다. 스크롤 칸이 나중에 생겨도 놓치지 않게 문서에서 잡습니다. */
      doc.addEventListener('scroll', function (e) {
        var tg = e.target;
        if (!src || !(tg === doc || tg === doc.documentElement || (tg.contains && tg.contains(src)))) return;
        if (rafId) cancelAnimationFrame(rafId);
        rafId = requestAnimationFrame(function () { place(true); });
      }, { capture: true, passive: true });
      function watch() {
        if (mo) mo.disconnect();
        if (src && auto && window.MutationObserver) { mo = new MutationObserver(function () { clearTimeout(t); t = setTimeout(build, 200); }); mo.observe(src, { childList: true, subtree: true, characterData: true, attributes: true }); }
        if (ro) ro.disconnect();
        if (window.ResizeObserver) { ro = new ResizeObserver(function () { if (board._clFit !== false) previewZoom(board, 'fit'); place(false); }); ro.observe(P.stage); if (src) ro.observe(src); }
      }
      board._clPreview = { refresh: build };
      /* 테마가 바뀌면 종이 테마만 다시 맞춥니다(고대비 ↔ 보통). */
      if (window.MutationObserver) new MutationObserver(function () {
        var paper = /-hc$/.test(doc.documentElement.getAttribute('data-theme') || '') ? 'light-hc' : 'light';
        all(board, '.cl-preview__page[data-cl-paper]').forEach(function (pg) { pg.setAttribute('data-theme', paper); });
        if (src && src.hasAttribute('data-cl-paper')) src.setAttribute('data-theme', paper);
      }).observe(doc.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
      /* 종이를 누르면 본문이 그 위치로 갑니다. */
      P.stage.addEventListener('click', function (e) {
        var Q = previewParts(board); if (!src || !Q.pages.length) return;
        var M = all(Q.sheets, '.cl-preview__content'); if (!M.length) M = Q.pages;
        var a = M[0].getBoundingClientRect(), z = M[M.length - 1].getBoundingClientRect();
        var f = Math.max(0, Math.min(1, (e.clientY - a.top) / ((z.bottom - a.top) || 1)));
        var r = src.getBoundingClientRect(), s = scrollParent(src), vt = s === window ? 0 : s.getBoundingClientRect().top;
        var dy = r.top + f * r.height - vt - 16;
        (s === window ? window : s).scrollBy({ top: dy, behavior: reduced() ? 'auto' : 'smooth' });
      });
      if (!P.stage.hasAttribute('tabindex')) P.stage.tabIndex = 0;
      if (!P.stage.hasAttribute('aria-label')) P.stage.setAttribute('aria-label', '인쇄 미리보기. 종이를 누르면 본문이 그 위치로 갑니다. + − 0으로 배율');
      P.stage.addEventListener('wheel', function (e) {
        if (!(e.ctrlKey || e.metaKey)) return;
        e.preventDefault(); previewZoom(board, (board._clZoom || 1) + (e.deltaY < 0 ? .1 : -.1)); place(false);
      }, { passive: false });
      P.stage.addEventListener('keydown', function (e) {
        var k = e.key;
        if (k === '+' || k === '=') { e.preventDefault(); previewZoom(board, (board._clZoom || 1) + .1); place(false); }
        else if (k === '-') { e.preventDefault(); previewZoom(board, (board._clZoom || 1) - .1); place(false); }
        else if (k === '0') { e.preventDefault(); previewZoom(board, 'fit'); place(false); }
      });
      Array.prototype.slice.call(board.querySelectorAll('[data-cl-preview-zoom]')).forEach(function (b) {
        b.addEventListener('click', function () {
          var v = b.getAttribute('data-cl-preview-zoom');
          previewZoom(board, v === 'fit' ? 'fit' : (board._clZoom || 1) + (v === 'in' ? .1 : -.1)); place(false);
        });
      });
      build();
    });
    all(root, '[data-cl-print-now]').forEach(function (b) {
      if (!once(b, 'PrintNow')) return;
      b.addEventListener('click', function () {
        var board = b.closest('.cl-preview');
        previewPrint(b.getAttribute('data-cl-print-now') || (board && board.getAttribute('data-cl-preview-of')) || '');
      });
    });
  }

  /* ============ 뱃지 한 줄 .cl-badges (v6.5) ============
     줄을 바꾸지 않습니다. 넘치면 compact → icon(이름은 title·낭독기에) → 뒤에서부터 "+n"으로 접습니다. */
  function badgesFit(g) {
    var kids = Array.prototype.slice.call(g.children);
    var bs = kids.filter(function (b) { return b.classList.contains('cl-badge') && !b.classList.contains('cl-badge--more'); });
    var more = kids.filter(function (b) { return b.classList.contains('cl-badge--more'); })[0];
    bs.forEach(function (b) { b.removeAttribute('data-overflow'); });
    g.removeAttribute('data-fit'); if (more) more.hidden = true;
    function over() { return g.scrollWidth > g.clientWidth + 1; }
    if (!over()) return 'none';
    g.setAttribute('data-fit', 'compact'); if (!over()) return 'compact';
    g.setAttribute('data-fit', 'icon');
    bs.forEach(function (b) { var l = b.querySelector('.cl-badge__label'); if (l && !b.title) b.title = l.textContent.trim(); });
    if (!over()) return 'icon';
    if (g.classList.contains('cl-badges--scroll')) return 'scroll';
    if (!more) { more = doc.createElement('span'); more.className = 'cl-badge cl-badge--more'; g.appendChild(more); }
    more.hidden = false;
    var hid = [];
    for (var i = bs.length - 1; i > 0 && over(); i--) {
      bs[i].setAttribute('data-overflow', '');
      hid.unshift((bs[i].querySelector('.cl-badge__label') || bs[i]).textContent.trim());
      more.textContent = '+' + hid.length; more.title = hid.join(', '); more.setAttribute('aria-label', '그 밖에 ' + hid.join(', '));
    }
    return 'more';
  }
  NS.badges = { fit: badgesFit };
  function bindBadges(root) {
    all(root, '.cl-badges').forEach(function (g) {
      if (!once(g, 'Badges')) return;
      badgesFit(g);
      if (window.ResizeObserver) { var w = g.clientWidth; new ResizeObserver(function () { if (Math.abs(g.clientWidth - w) > 1) { w = g.clientWidth; badgesFit(g); } }).observe(g); }
    });
  }

  /* ---------- 매트릭스(.cl-matrix-box[data-matrix], v6.6): 행 × 열의 요구 강도. 모양으로 말합니다(● 핵심 · ○ 권장 · ■ 반영) ----------
     cfg: title, rowHeader, levels[{key,label,mark: dot|ring|square}], colGroups[{label, group, hue, cols[{id,label,short}]}],
          rowGroups[{label, rows[{id,label,sub,cells{colId:levelKey}}]}], required(충족 계산에 넣는 강도, 기본 앞의 둘),
          focus[colId…](학생 선택 등), focusLabel, coverage(true면 행 끝 충족 수), action{label}(행 끝 단추)
     이벤트: cl-select {id}(행 머리), cl-matrix-action {id}(행 단추). 767px 이하에서는 행 카드 목록으로 바뀝니다. */
  var MATRIX_LEVELS = [{ key: 'core', label: '핵심', mark: 'dot' }, { key: 'rec', label: '권장', mark: 'ring' }, { key: 'ref', label: '반영', mark: 'square' }];
  NS.matrix = function (el, cfg) {
    cfg = cfg || JSON.parse(el.getAttribute('data-matrix')); el.clMatrix = cfg;
    var levels = cfg.levels || MATRIX_LEVELS, lv = {};
    levels.forEach(function (l, i) { lv[l.key] = l; if (!l.mark) l.mark = ['dot', 'ring', 'square'][i] || 'dot'; });
    var required = cfg.required || levels.slice(0, 2).map(function (l) { return l.key; });
    var focus = cfg.focus || [], focusLabel = cfg.focusLabel || '학생 선택', cover = !!(cfg.coverage && focus.length), act = cfg.action;
    var groups = cfg.colGroups || [], cols = [];
    groups.forEach(function (g) { g._hue = g.hue != null ? g.hue : NS.colors.groupHue(g.group || g.label); (g.cols || []).forEach(function (c) { cols.push({ c: c, g: g }); }); });
    var rows = []; (cfg.rowGroups || []).forEach(function (rg) { (rg.rows || []).forEach(function (r) { rows.push(r); }); });
    function cellOf(r, c) { return (r.cells || {})[c.id]; }
    function isReq(v) { return v && required.indexOf(v) >= 0; }
    function cov(r) { var req = cols.filter(function (x) { return isReq(cellOf(r, x.c)); }), hit = req.filter(function (x) { return focus.indexOf(x.c.id) >= 0; }); return { n: req.length, k: hit.length }; }
    function dot(key) { var l = lv[key]; return l ? '<span class="cl-mark-dot cl-mark-dot--' + l.mark + '" aria-hidden="true"></span><span class="cl-sr">' + esc(l.label) + '</span>' : ''; }
    var span = 1 + cols.length + (cover ? 1 : 0) + (act ? 1 : 0);
    var h = '<div class="cl-matrix-wrap" role="region" tabindex="0" aria-label="' + esc(cfg.title || '매트릭스') + ', 가로로 넘겨 봅니다"><table class="cl-matrix"><thead><tr class="cl-matrix__groups"><th scope="col" rowspan="2" class="cl-matrix__corner start">' + esc(cfg.rowHeader || '항목') + '</th>';
    groups.forEach(function (g) { h += '<th scope="colgroup" colspan="' + (g.cols || []).length + '" class="cl-matrix__group"' + (g._hue ? ' data-hue="' + g._hue + '"' : '') + '>' + esc(g.label) + '</th>'; });
    if (cover) h += '<th scope="col" rowspan="2" class="cl-matrix__cov">' + esc(cfg.coverageLabel || focusLabel + ' 충족') + '</th>';
    if (act) h += '<th scope="col" rowspan="2" class="cl-matrix__act"><span class="cl-sr">' + esc(act.label) + '</span></th>';
    h += '</tr><tr class="cl-matrix__cols">';
    cols.forEach(function (x, ci) {
      var n = rows.filter(function (r) { return isReq(cellOf(r, x.c)); }).length;
      h += '<th scope="col" data-col="' + ci + '"' + (focus.indexOf(x.c.id) >= 0 ? ' data-focus' : '') + (x.g._hue ? ' data-hue="' + x.g._hue + '"' : '') + ' title="' + esc(x.c.label) + '"><span aria-hidden="true">' + esc(x.c.short || x.c.label) + '</span><span class="cl-sr">' + esc(x.c.label) + '</span><small>' + n + '</small></th>';
    });
    h += '</tr></thead><tbody>';
    (cfg.rowGroups || []).forEach(function (rg) {
      if (rg.label) h += '<tr class="cl-matrix__rowgroup"><th scope="rowgroup" class="start" colspan="' + span + '">' + esc(rg.label) + ' <span>' + (rg.rows || []).length + '</span></th></tr>';
      (rg.rows || []).forEach(function (r) {
        h += '<tr data-row="' + esc(r.id) + '"><th scope="row" class="cl-matrix__row start" tabindex="-1"><b>' + esc(r.label) + '</b>' + (r.sub ? '<small>' + esc(r.sub) + '</small>' : '') + '</th>';
        cols.forEach(function (x, ci) { var v = cellOf(r, x.c); h += '<td data-col="' + ci + '"' + (focus.indexOf(x.c.id) >= 0 ? ' data-focus' : '') + ' tabindex="-1">' + (v ? dot(v) : '') + '</td>'; });
        if (cover) { var cv = cov(r); h += '<td class="cl-matrix__cov' + (cv.n && cv.k === cv.n ? ' is-full' : '') + '"><span aria-hidden="true">' + (cv.n ? (cv.k === cv.n ? '✓ ' : '') + cv.k + '/' + cv.n : '–') + '</span><span class="cl-sr">' + esc(focusLabel + ' ' + cv.n + '개 중 ' + cv.k + '개 충족') + '</span></td>'; }
        if (act) h += '<td class="cl-matrix__act"><button type="button" class="cl-btn cl-btn--plain cl-btn--sm" data-matrix-action="' + esc(r.id) + '" aria-label="' + esc(r.label + (r.sub ? ' ' + r.sub : '') + ' ' + act.label) + '">' + esc(act.label) + '</button></td>';
        h += '</tr>';
      });
    });
    h += '</tbody></table></div><ul class="cl-matrix__legend">' + levels.map(function (l) { return '<li><span class="cl-mark-dot cl-mark-dot--' + l.mark + '" aria-hidden="true"></span>' + esc(l.label) + '</li>'; }).join('') +
      (focus.length ? '<li><span class="cl-matrix__keyfocus" aria-hidden="true"></span>' + esc(focusLabel) + '</li>' : '') + '</ul><ol class="cl-matrix__list">';
    rows.forEach(function (r) {
      var cv = cover ? cov(r) : null;
      h += '<li><div class="cl-matrix__lhead"><b>' + esc(r.label) + '</b>' + (r.sub ? '<small>' + esc(r.sub) + '</small>' : '') + (cv && cv.n ? '<span class="cl-matrix__lcov' + (cv.k === cv.n ? ' is-full' : '') + '">' + esc(focusLabel) + ' ' + cv.k + '/' + cv.n + '</span>' : '') + '</div>';
      levels.forEach(function (l) {
        var cs = cols.filter(function (x) { return cellOf(r, x.c) === l.key; }); if (!cs.length) return;
        h += '<p><span class="cl-matrix__lvl"><span class="cl-mark-dot cl-mark-dot--' + l.mark + '" aria-hidden="true"></span>' + esc(l.label) + '</span>' + cs.map(function (x) { return '<span class="cl-matrix__chip"' + (x.g._hue ? ' data-hue="' + x.g._hue + '"' : '') + (focus.indexOf(x.c.id) >= 0 ? ' data-focus' : '') + '>' + esc(x.c.label) + '</span>'; }).join('') + '</p>';
      });
      if (act) h += '<button type="button" class="cl-btn cl-btn--plain cl-btn--sm" data-matrix-action="' + esc(r.id) + '">' + esc(act.label) + '</button>';
      h += '</li>';
    });
    h += '</ol>';
    var body = el.querySelector('.cl-matrix__body'); if (!body) { body = doc.createElement('div'); body.className = 'cl-matrix__body'; el.appendChild(body); }
    body.innerHTML = h;
    var first = body.querySelector('tbody th[scope="row"]'); if (first) first.tabIndex = 0;
    if (el._clMatrixBound) return; el._clMatrixBound = true;
    function colHi(ci) { Array.prototype.forEach.call(body.querySelectorAll('table [data-col]'), function (x) { x.classList.toggle('is-col', ci != null && x.getAttribute('data-col') === String(ci)); }); }
    body.addEventListener('mouseover', function (e) { var c = e.target.closest('table [data-col]'); colHi(c ? c.getAttribute('data-col') : null); });
    body.addEventListener('mouseleave', function () { colHi(null); });
    body.addEventListener('focusin', function (e) { var c = e.target.closest('td[data-col]'); colHi(c ? c.getAttribute('data-col') : null); });
    body.addEventListener('keydown', function (e) {
      var cell = e.target.closest('tbody th[scope="row"], tbody td[data-col]'); if (!cell) return;
      var trs = Array.prototype.slice.call(body.querySelectorAll('tbody tr[data-row]')), ri = trs.indexOf(cell.parentElement), nc = el.clMatrix ? body.querySelectorAll('thead .cl-matrix__cols th').length : 0;
      var ci = cell.tagName === 'TH' ? -1 : +cell.getAttribute('data-col'), to = null;
      if (e.key === 'ArrowRight') to = [ri, Math.min(nc - 1, ci + 1)]; else if (e.key === 'ArrowLeft') to = [ri, Math.max(-1, ci - 1)];
      else if (e.key === 'ArrowDown') to = [Math.min(trs.length - 1, ri + 1), ci]; else if (e.key === 'ArrowUp') to = [Math.max(0, ri - 1), ci];
      else if (e.key === 'Home') to = [e.ctrlKey ? 0 : ri, -1]; else if (e.key === 'End') to = [e.ctrlKey ? trs.length - 1 : ri, nc - 1];
      else if ((e.key === 'Enter' || e.key === ' ') && ci === -1) { e.preventDefault(); el.dispatchEvent(new CustomEvent('cl-select', { bubbles: true, detail: { id: cell.parentElement.getAttribute('data-row') } })); return; }
      if (!to) return; e.preventDefault();
      var tr = trs[to[0]], t = to[1] === -1 ? tr.querySelector('th[scope="row"]') : tr.querySelector('td[data-col="' + to[1] + '"]');
      if (!t) return; cell.tabIndex = -1; t.tabIndex = 0; t.focus(); t.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    });
    body.addEventListener('click', function (e) {
      var b = e.target.closest('[data-matrix-action]'); if (b) { el.dispatchEvent(new CustomEvent('cl-matrix-action', { bubbles: true, detail: { id: b.getAttribute('data-matrix-action') } })); return; }
      var rh = e.target.closest('tbody th[scope="row"]'); if (rh) el.dispatchEvent(new CustomEvent('cl-select', { bubbles: true, detail: { id: rh.parentElement.getAttribute('data-row') } }));
    });
  };
  function bindMatrix(root) { all(root, '.cl-matrix-box[data-matrix]').forEach(function (el) { if (once(el, 'Matrix')) NS.matrix(el); }); }

  /* ---------- 이름 펼침(v6.6, AIO에서 옮김): 기호만 보이는 단추에 마우스를 올리거나 키보드로 오면 이름이 펼쳐집니다 ----------
     흐름형 .cl-reveal(단추 자체가 넓어짐, CSS만): 막대·서랍 머리처럼 자리가 넉넉한 곳.
     덮개형 [data-cl-reveal="overlay"](단추 크기 그대로, 이름표가 단추 옆에 붙음): ⋮, 접힌 레일, 표·리본의 기호 단추처럼 촘촘한 곳.
     이름은 aria-label에서 읽고, 이름표는 aria-hidden입니다. 터치·비활성·이미 이름이 보이는 단추는 건너뜁니다. */
  var revealTag = null, revealFor = null, revealSuppressed = null;
  function revealPlace() {
    if (!revealFor || !revealTag) return;
    var r = revealFor.getBoundingClientRect(), vw = doc.documentElement.clientWidth, side = revealFor.getAttribute('data-cl-reveal-side') || 'end';
    revealTag.style.height = r.height + 'px'; revealTag.style.top = r.top + 'px';
    revealTag.style.setProperty('--reveal-radius', Math.min(r.height / 2, parseFloat(getComputedStyle(revealFor).borderTopLeftRadius) || 0) + 'px');
    var w = revealTag.offsetWidth, endFits = r.right + 8 + w <= vw - 8, startFits = r.left - 8 - w >= 8;
    var useEnd = side === 'start' ? !startFits : endFits || !startFits;
    revealTag.setAttribute('data-side', useEnd ? 'end' : 'start');
    revealTag.style.left = (useEnd ? r.right + 8 : r.left - 8 - w) + 'px';
  }
  function revealShow(btn) {
    if (btn.disabled || btn.getAttribute('aria-disabled') === 'true' || revealSuppressed === btn) return;
    var label = btn.getAttribute('aria-label') || btn.getAttribute('title'); if (!label) return;
    if (!revealTag) { revealTag = doc.createElement('div'); revealTag.className = 'cl-reveal-tag'; revealTag.setAttribute('aria-hidden', 'true'); doc.body.appendChild(revealTag); }
    revealFor = btn; revealTag.textContent = label; revealTag.setAttribute('data-show', 'true'); revealPlace();
  }
  function revealHide() { if (revealTag) revealTag.setAttribute('data-show', 'false'); revealFor = null; }
  function bindReveal(root) {
    all(root, '[data-cl-reveal="overlay"]').forEach(function (b) {
      if (!once(b, 'Reveal')) return;
      if (b.title && b.title === b.getAttribute('aria-label')) b.removeAttribute('title');
      b.addEventListener('pointerenter', function (e) { if (e.pointerType === 'mouse') revealShow(b); });
      b.addEventListener('pointerleave', function () { if (revealSuppressed === b) revealSuppressed = null; if (revealFor === b) revealHide(); });
      b.addEventListener('pointerdown', function () { revealSuppressed = b; revealHide(); });
      b.addEventListener('focus', function () { if (b.matches(':focus-visible')) revealShow(b); });
      b.addEventListener('blur', function () { if (revealFor === b) revealHide(); });
    });
    if (!doc._clRevealBound) {
      doc._clRevealBound = true;
      doc.addEventListener('keydown', function (e) { if (e.key === 'Escape' && revealFor) revealHide(); });
      window.addEventListener('scroll', revealPlace, true); window.addEventListener('resize', revealPlace);
    }
  }

  NS.init = function (root) {
    root = root || doc;
    /* 순서: bindTabRows는 bindPopovers보다 먼저(고르기 메뉴를 열기 직전에 채우기), bindInfo·bindFocus는 bindPanes 뒤. */
    [bindGlow, bindSegmented, bindTabs, bindNav, bindToggle, bindSlider, bindStepper, bindTabRows, bindPopovers, bindContext, bindSwipe,
      bindSheet, bindSidebar, bindDate, bindToastTriggers, bindTable, bindSpark, bindCharts, bindThemeControls,
      bindTree, bindPath, bindDocTabs, bindColumns, bindPanes, bindInfo, bindFocus, bindStack, bindPalette, bindGate, bindWait, bindMonth, bindWeek, bindAgenda, bindPreview, bindBadges, bindTips, bindHints, bindCards, bindMatrix, bindReveal].forEach(function (f) {
      SKIP_MANAGED = f !== bindGlow;
      try { f(root); } catch (err) { if (window.console) console.warn('[SangsangClarity]', f.name, err); }
      finally { SKIP_MANAGED = false; }
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
      /* 앱이 관리하는 영역(data-cl-managed) 안의 변화로는 다시 연결하지 않습니다. */
      if (!list.some(function (m) { return m.addedNodes.length && !managed(m.target); })) return;
      clearTimeout(pending); pending = setTimeout(function () { NS.init(); }, 40);
    }).observe(doc.documentElement, { childList: true, subtree: true });
  }
})();
