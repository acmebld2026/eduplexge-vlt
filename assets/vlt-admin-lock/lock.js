/*
 * VLT 페이지 톱니(관리자 모드) 잠금.
 *
 * - 해제는 에듀큐브 아이디·비밀번호로 한다. 확인은 guide.sangsangplex.com의
 *   기존 직원 로그인(/_assessment/api login_educube)이 서버에서 하고,
 *   이어서 /_assessment/context의 소속 지점에 길음이 있는지 본다.
 *   이 파일은 그 계약을 쓰기만 하며 가이드 사이트를 바꾸지 않는다.
 * - 한 번 해제한 브라우저는 12시간 동안 열린다(같은 주소의 VLT 페이지 공통).
 * - github.io 주소에서는 로그인 서버에 닿을 수 없으므로 같은 문서의
 *   guide.sangsangplex.com/eduplexge/<주소>/ 로 옮겨 확인한다.
 * - 관리자 내용은 페이지 소스에 그대로 있다. 이 잠금은 화면 표시만 막는다.
 *
 * 사용: <button id="adminBtn" ...> 와 [data-admin] 루트를 두고
 *       <script src="../assets/vlt-admin-lock/lock.js"></script> 를 본문 끝에 넣는다.
 *       페이지는 VltAdminLock.onChange(fn)으로 상태 변화를 받을 수 있다.
 */
(function () {
  'use strict';
  var GUIDE_ORIGIN = 'https://guide.sangsangplex.com';
  var UNLOCK_KEY = 'vlt-admin-unlock';
  var HOLD_MS = 12 * 60 * 60 * 1000;
  var BRANCH = '길음';

  var root = document.documentElement;
  var btn = document.getElementById('adminBtn');
  if (!btn) return;
  var slug = (location.pathname.match(/\/([a-z0-9]{8})\/(?:index\.html)?$/) || [])[1] || '';
  var VIEW_KEY = 'vlt-admin-view:' + (slug || location.pathname);
  var listeners = [];

  function store(kind) { try { return window[kind]; } catch (e) { return null; } }
  function read(kind, key) { var s = store(kind); try { return s ? s.getItem(key) : null; } catch (e) { return null; } }
  function write(kind, key, value) { var s = store(kind); try { if (!s) return; if (value == null) s.removeItem(key); else s.setItem(key, value); } catch (e) {} }

  function unlockedUntil() {
    var raw = read('localStorage', UNLOCK_KEY), until = 0;
    try { until = Number(JSON.parse(raw || '{}').until) || 0; } catch (e) { until = 0; }
    if (until && until <= Date.now()) { write('localStorage', UNLOCK_KEY, null); return 0; }
    if (until > Date.now() + HOLD_MS) { write('localStorage', UNLOCK_KEY, null); return 0; }
    return until;
  }
  function canLoginHere() {
    if (location.origin === GUIDE_ORIGIN) return true;
    // 로컬 검증용(합성 응답 서버). 운영 주소가 아니다.
    return location.protocol === 'http:' && /^(localhost|127\.0\.0\.1)$/.test(location.hostname);
  }
  function guideUrl() {
    return slug ? GUIDE_ORIGIN + '/eduplexge/' + slug + '/#unlock' : GUIDE_ORIGIN + '/';
  }
  function toast(msg) { if (window.SangsangClarity && SangsangClarity.toast) SangsangClarity.toast(msg); }

  function setAdmin(on) {
    root.setAttribute('data-admin', on ? 'on' : 'off');
    btn.setAttribute('aria-pressed', String(on));
    btn.setAttribute('aria-label', on ? '관리자 모드 끄기' : (unlockedUntil() ? '관리자 모드 켜기' : '관리자 모드 열기 (에듀큐브 확인)'));
    for (var i = 0; i < listeners.length; i++) { try { listeners[i](on); } catch (e) {} }
  }

  /* ---------- 확인 창 ---------- */
  var style = document.createElement('style');
  style.textContent =
    '.vl-lock{position:fixed;inset:0;z-index:1000;display:grid;place-items:center;padding:16px}' +
    '.vl-lock[hidden]{display:none}' +
    '.vl-lock__scrim{position:absolute;inset:0;background:var(--cl-scrim)}' +
    '.vl-lock__card{position:relative;width:min(360px,100%);gap:var(--space-3);background:var(--cl-glass-solid)}' +
    '.vl-lock__card [hidden]{display:none !important}' +
    '.vl-lock__card .cl-field{margin-top:var(--space-1)}' +
    '.vl-lock__card .cl-alert__actions .cl-btn{text-decoration:none;display:inline-flex;align-items:center;justify-content:center}' +
    '.vl-lock__note{margin:0;font-size:.8125rem;line-height:1.5;color:var(--cl-label-3)}';
  document.head.appendChild(style);

  var wrap = document.createElement('div');
  wrap.className = 'vl-lock';
  wrap.hidden = true;
  wrap.innerHTML =
    '<div class="vl-lock__scrim" data-close></div>' +
    '<form class="cl-alert cl-glass cl-glass--thick vl-lock__card" role="dialog" aria-modal="true" aria-labelledby="vlLockTitle" aria-describedby="vlLockMsg" novalidate>' +
      '<h2 class="cl-alert__title" id="vlLockTitle">관리자 확인</h2>' +
      '<p class="cl-alert__msg" id="vlLockMsg"></p>' +
      '<div data-part="login">' +
        '<div class="cl-field"><label class="cl-field__label" for="vlLockId">에듀큐브 아이디</label>' +
          '<input class="cl-input" id="vlLockId" name="username" autocomplete="username" autocapitalize="off" spellcheck="false" required></div>' +
        '<div class="cl-field"><label class="cl-field__label" for="vlLockPw">비밀번호</label>' +
          '<input class="cl-input" id="vlLockPw" name="password" type="password" autocomplete="current-password" required></div>' +
        '<p class="cl-field__error" id="vlLockErr" role="alert" hidden></p>' +
      '</div>' +
      '<div class="cl-alert__actions">' +
        '<button class="cl-btn cl-btn--gray" type="button" data-close>취소</button>' +
        '<button class="cl-btn cl-btn--filled" type="submit" data-part="submit">확인</button>' +
        '<a class="cl-btn cl-btn--filled" data-part="move" href="#">주소 열기</a>' +
      '</div>' +
      '<p class="vl-lock__note" data-part="foot">확인한 브라우저는 12시간 동안 열려 있습니다. 비밀번호는 이 페이지에 저장하지 않습니다.</p>' +
    '</form>';
  document.body.appendChild(wrap);

  var form = wrap.querySelector('form');
  var msg = wrap.querySelector('#vlLockMsg');
  var idIn = wrap.querySelector('#vlLockId');
  var pwIn = wrap.querySelector('#vlLockPw');
  var err = wrap.querySelector('#vlLockErr');
  var loginPart = wrap.querySelector('[data-part="login"]');
  var submitBtn = wrap.querySelector('[data-part="submit"]');
  var moveLink = wrap.querySelector('[data-part="move"]');
  var busy = false;

  function showError(text) {
    err.textContent = text || '';
    err.hidden = !text;
    pwIn.setAttribute('aria-invalid', text ? 'true' : 'false');
  }
  function openDialog() {
    var here = canLoginHere();
    msg.textContent = here
      ? '에듀큐브 아이디와 비밀번호로 길음점 구성원인지 확인합니다.'
      : '관리자 확인은 길음점 안내 주소에서 진행합니다. 같은 문서를 그 주소로 열어 확인해 주세요.';
    loginPart.hidden = !here;
    submitBtn.hidden = !here;
    moveLink.hidden = here;
    moveLink.href = guideUrl();
    showError('');
    wrap.hidden = false;
    setTimeout(function () { (here ? idIn : moveLink).focus(); }, 0);
  }
  function closeDialog() {
    wrap.hidden = true;
    pwIn.value = '';
    showError('');
    btn.focus();
  }
  wrap.addEventListener('click', function (e) { if (e.target.closest('[data-close]')) closeDialog(); });
  wrap.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeDialog(); });

  var MESSAGES = {
    wrong_credentials: '아이디 또는 비밀번호가 맞지 않습니다.',
    staff_disabled: '사용이 중지된 계정입니다. 원장님께 확인해 주세요.',
    educube_profile_unavailable: '에듀큐브 소속 정보를 확인하지 못했습니다. 잠시 뒤 다시 시도해 주세요.',
    rate_limited: '시도가 많습니다. 잠시 뒤 다시 시도해 주세요.',
    not_branch: BRANCH + '점 소속 계정으로 확인해 주세요.'
  };
  function post(payload) {
    return fetch('/_assessment/api', {
      method: 'POST', credentials: 'same-origin', cache: 'no-store',
      headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload)
    }).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (j) {
        if (!r.ok || !j.ok) throw Object.assign(new Error(j.error || 'unavailable'), { status: r.status });
        return j;
      });
    });
  }
  function context() {
    return fetch('/_assessment/context', { credentials: 'same-origin', cache: 'no-store' })
      .then(function (r) { return r.json().catch(function () { return {}; }); });
  }

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    if (busy || !canLoginHere()) return;
    var username = idIn.value.trim(), password = pwIn.value;
    pwIn.value = '';
    if (!username || !password) { showError('아이디와 비밀번호를 모두 입력해 주세요.'); (username ? pwIn : idIn).focus(); return; }
    busy = true; submitBtn.disabled = true; submitBtn.textContent = '확인 중';
    post({ action: 'login_educube', username: username, password: password })
      .then(context)
      .then(function (ctx) {
        var branches = (ctx && ctx.staff && ctx.staff.branches) || [];
        var ok = branches.some(function (b) { return b && typeof b.name === 'string' && b.name.indexOf(BRANCH) !== -1; });
        if (!ok) throw Object.assign(new Error('not_branch'), { status: 403 });
        write('localStorage', UNLOCK_KEY, JSON.stringify({ until: Date.now() + HOLD_MS }));
        write('sessionStorage', VIEW_KEY, null);
        showError('');
        wrap.hidden = true;
        setAdmin(true);
        btn.focus();
        toast('확인했습니다. 이 브라우저에서 12시간 동안 관리자 모드를 쓸 수 있습니다.');
      })
      .catch(function (error) {
        var code = error && error.message;
        if (error && error.status === 429) code = 'rate_limited';
        showError(MESSAGES[code] || '확인 서버에 연결하지 못했습니다. 잠시 뒤 다시 시도해 주세요.');
        pwIn.focus();
      })
      .then(function () { busy = false; submitBtn.disabled = false; submitBtn.textContent = '확인'; });
  });

  /* ---------- 톱니 ---------- */
  btn.addEventListener('click', function () {
    if (root.getAttribute('data-admin') === 'on') {
      write('sessionStorage', VIEW_KEY, 'off');
      setAdmin(false);
      toast('관리자 모드를 껐습니다.');
      return;
    }
    if (unlockedUntil()) {
      write('sessionStorage', VIEW_KEY, null);
      setAdmin(true);
      toast('관리자 모드를 켰습니다.');
      return;
    }
    openDialog();
  });

  setAdmin(!!unlockedUntil() && read('sessionStorage', VIEW_KEY) !== 'off');
  if (location.hash === '#unlock') {
    try { history.replaceState(null, '', location.pathname + location.search); } catch (e) {}
    if (!unlockedUntil()) openDialog();
  }

  window.VltAdminLock = {
    onChange: function (fn) { if (typeof fn === 'function') listeners.push(fn); },
    isUnlocked: function () { return !!unlockedUntil(); },
    lock: function () { write('localStorage', UNLOCK_KEY, null); setAdmin(false); }
  };
})();
