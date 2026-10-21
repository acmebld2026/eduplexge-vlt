/*!
 * guide 페이지 원장 편집기 로더 (page-editor.js) — 2판
 *
 * 톱니(오른쪽 위) → 원장 관리자 모드 → "페이지 수정하기"를 켜면 홈페이지(eduplexge.sangsangplex.com) 편집기와
 * 같은 Tiptap 편집 환경(도구 막대·말풍선 막대·슬래시(/) 넣기 메뉴·우클릭 메뉴·블록 손잡이·단축키 표·도움말)을
 * 이 페이지 위에 그대로 띄운다(editor.bundle.js · editor.css). 편집기 원본: 비공개 저장소 결과지/page-editor.
 *
 * - 저장(Ctrl+S)은 이 기기 임시본, 게시는 공개 저장소(acmebld2026/eduplexge-vlt, master)에 커밋이다.
 * - 쓰기 권한은 비밀번호가 아니라 원장이 이 브라우저에 한 번 등록한 GitHub 저장 키(fine-grained token)다.
 * - 이 파일은 학부모 화면에서도 돈다: 홈페이지 블록(이미지 확대·유튜브)의 작은 동작만 맡고, 편집기는 수정할 때만 내려받는다.
 *
 * 운영 규칙·복구: 비공개 저장소 `분석/결과지_원장_페이지편집기_운영기준.md`
 */
(function () {
  "use strict";
  if (window.__VLT_PAGE_EDITOR__) return;
  var VERSION = "2026-10-22.1";
  window.__VLT_PAGE_EDITOR__ = { version: VERSION };

  var CONFIG = {
    // 원장 확인 모드와 같은 비밀번호(원문은 저장하지 않는다). 화면 잠금용이며 쓰기 권한은 GitHub 저장 키가 가진다.
    adminHash: "a9bc05dbc28cd543e41c54e797a912e1b02184ec19fedb93249eb27917099967",
    sessionKey: "vlt-page-editor:admin"
  };
  var html = document.documentElement;
  var script = document.currentScript;
  var BASE = (script && script.src) ? script.src.replace(/[^/]*$/, "") : "../assets/page-editor/";

  /* ───────────── 홈페이지 블록의 공개 화면 동작(누구에게나) ───────────── */
  function runtime() {
    document.addEventListener("click", function (e) {
      if (html.classList.contains("vpe-editing")) return;
      var t = e.target instanceof Element ? e.target : null;
      if (!t) return;
      // 유튜브: 누르면 그 자리에서 재생
      var yt = t.closest(".yt-btn");
      if (yt) {
        var img = yt.querySelector("img");
        var m = img && /\/vi\/([A-Za-z0-9_-]{6,})\//.exec(img.getAttribute("src") || "");
        if (!m) return;
        e.preventDefault();
        var f = document.createElement("iframe");
        f.src = "https://www.youtube-nocookie.com/embed/" + m[1] + "?autoplay=1&rel=0";
        f.title = (yt.getAttribute("aria-label") || "동영상").replace(/ 재생$/, "");
        f.setAttribute("allow", "accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture; fullscreen");
        f.setAttribute("allowfullscreen", "");
        yt.replaceWith(f);
        return;
      }
      // 이미지 확대 보기
      var z = t.closest("[data-zoom]");
      if (z) {
        e.preventDefault();
        var src = z.getAttribute("data-full") || (z.querySelector("img") || {}).src;
        if (!src) return;
        var ov = document.createElement("div");
        ov.setAttribute("data-pe-ui", "");
        ov.setAttribute("role", "dialog");
        ov.setAttribute("aria-label", "이미지 크게 보기");
        ov.style.cssText = "position:fixed;inset:0;z-index:2147483600;display:grid;place-items:center;background:rgba(10,15,25,.86);cursor:zoom-out;padding:16px";
        var big = document.createElement("img");
        big.src = src;
        big.alt = (z.querySelector("img") || {}).alt || "";
        big.style.cssText = "max-width:100%;max-height:100%;object-fit:contain;border-radius:8px";
        ov.appendChild(big);
        var close = function () { ov.remove(); document.removeEventListener("keydown", onEsc, true); };
        var onEsc = function (ev) { if (ev.key === "Escape") close(); };
        ov.addEventListener("click", close);
        document.addEventListener("keydown", onEsc, true);
        document.body.appendChild(ov);
      }
    });
  }
  runtime();

  /* ───────────── 저장소 경로 ───────────── */
  function repoPath() {
    var forced = script && script.getAttribute("data-repo-path");
    if (forced) return forced;
    var p = decodeURIComponent(location.pathname);
    var m = p.match(/^\/(?:eduplexge-vlt|eduplexge)\/(.+)$/) || p.match(/\/배포\/(.+)$/);
    if (!m) return null;
    var rel = m[1];
    if (/\/$/.test(rel)) rel += "index.html";
    if (!/\.html$/.test(rel)) rel += "/index.html";
    return rel;
  }
  var PATH = repoPath();
  if (!PATH) return;

  /* ───────────── 공용 도구 ───────────── */
  function el(tag, attrs, children) {
    var n = document.createElement(tag);
    if (attrs) Object.keys(attrs).forEach(function (k) {
      if (k === "text") n.textContent = attrs[k];
      else if (k === "html") n.innerHTML = attrs[k];
      else if (k.indexOf("on") === 0) n.addEventListener(k.slice(2), attrs[k]);
      else if (attrs[k] !== false && attrs[k] != null) n.setAttribute(k, attrs[k] === true ? "" : attrs[k]);
    });
    (children || []).forEach(function (c) { if (c) n.appendChild(typeof c === "string" ? document.createTextNode(c) : c); });
    return n;
  }
  function ui(n) { n.setAttribute("data-pe-ui", ""); return n; }
  function session(k, v) {
    try {
      if (arguments.length === 1) return window.sessionStorage.getItem(k);
      if (v == null) window.sessionStorage.removeItem(k); else window.sessionStorage.setItem(k, v);
    } catch (e) { return null; }
    return null;
  }
  function hex(buf) { return Array.prototype.map.call(new Uint8Array(buf), function (b) { return ("0" + b.toString(16)).slice(-2); }).join(""); }
  function sha256(text) { return crypto.subtle.digest("SHA-256", new TextEncoder().encode(text)).then(hex); }

  /* ───────────── 화면 요소 ───────────── */
  if (!document.querySelector("link[data-pe-css]")) document.head.appendChild(ui(el("link", { rel: "stylesheet", href: BASE + "page-editor.css?v=" + VERSION, "data-pe-css": "" })));

  var state = { admin: false, editing: false, loading: false, run: null };
  var builtInGear = document.querySelector("#director-gear");
  var gear = null;
  if (!builtInGear) {
    gear = ui(el("button", { type: "button", class: "pe-gear", "aria-label": "원장 관리자 모드 열기", title: "원장 관리자 모드", "aria-haspopup": "dialog",
      html: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="3.2"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/></svg>' }));
    var passInput = el("input", { type: "password", id: "pe-pass", autocomplete: "off", required: true });
    var passErr = el("p", { class: "pe-error", role: "alert", hidden: true, text: "비밀번호가 맞지 않습니다. 다시 입력해 주세요." });
    var form = el("form", { class: "pe-dialog__box" }, [
      el("h2", { text: "원장 관리자 모드" }),
      el("p", { text: "관리자 모드에서는 이 페이지를 홈페이지 편집기와 같은 방식으로 고쳐 정본으로 게시할 수 있습니다." }),
      el("label", { for: "pe-pass", text: "비밀번호" }), passInput, passErr,
      el("div", { class: "pe-dialog__actions" }, [el("button", { type: "button", "data-close": "", text: "닫기" }), el("button", { type: "submit", class: "is-primary", text: "열기" })])
    ]);
    var dlg = ui(el("div", { class: "pe-dialog", role: "dialog", "aria-modal": "true", "aria-label": "원장 관리자 모드", hidden: true }, [form]));
    var closeDlg = function () { dlg.hidden = true; passInput.value = ""; passErr.hidden = true; gear.focus(); };
    form.querySelector("[data-close]").addEventListener("click", closeDlg);
    dlg.addEventListener("keydown", function (e) { if (e.key === "Escape") closeDlg(); });
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      sha256(passInput.value).then(function (h) {
        if (h === CONFIG.adminHash) { setAdmin(true); closeDlg(); } else { passErr.hidden = false; passInput.select(); }
      }, function () { passErr.hidden = false; });
    });
    gear.addEventListener("click", function () {
      if (state.admin) { if (state.editing) return; setAdmin(false); return; }
      dlg.hidden = false; setTimeout(function () { passInput.focus(); }, 0);
    });
    document.body.appendChild(gear);
    document.body.appendChild(dlg);
  }

  // 관리자 막대(편집을 켜기 전까지만 보인다 — 편집 중에는 편집기 위쪽 막대가 대신한다)
  var bar = ui(el("div", { class: "pe-bar", role: "region", "aria-label": "원장 페이지 수정", hidden: true }));
  var sw = el("button", { type: "button", class: "pe-switch", role: "switch", "aria-checked": "false" }, [el("span", { class: "pe-switch__track", "aria-hidden": "true" }), el("span", { text: "페이지 수정하기" })]);
  var notice = el("p", { class: "pe-notice", hidden: true });
  bar.appendChild(el("div", { class: "pe-bar__row" }, [el("strong", { class: "pe-bar__title", text: "원장 관리자 모드" }), sw]));
  bar.appendChild(notice);
  document.body.appendChild(bar);

  function say(text, tone) {
    notice.textContent = text || "";
    notice.hidden = !text;
    notice.className = "pe-notice" + (tone ? " is-" + tone : "");
  }
  function refresh() {
    bar.hidden = !state.admin || state.editing;
    html.classList.toggle("pe-admin", state.admin);
    sw.setAttribute("aria-checked", state.editing ? "true" : "false");
    if (gear) {
      gear.classList.toggle("is-on", state.admin);
      gear.hidden = state.editing;
      gear.setAttribute("aria-label", state.admin ? "원장 관리자 모드 닫기" : "원장 관리자 모드 열기");
    }
  }
  function setAdmin(on) {
    state.admin = on;
    if (!builtInGear) session(CONFIG.sessionKey, on ? "1" : null);
    if (!on && state.run) state.run.stop();
    refresh();
  }
  if (builtInGear) {
    // 이 페이지에 이미 있는 원장 확인 모드(톱니·비밀번호)를 관리자 모드로 쓴다.
    var sync = function () {
      var on = html.classList.contains("director-mode");
      if (on !== state.admin) setAdmin(on);
    };
    new MutationObserver(sync).observe(html, { attributes: true, attributeFilter: ["class"] });
    sync();
  } else if (session(CONFIG.sessionKey) === "1") {
    setAdmin(true);
  }

  /* ───────────── 편집기 불러오기 ───────────── */
  function loadOnce(tag, attrs) {
    return new Promise(function (resolve, reject) {
      var n = ui(el(tag, attrs));
      n.onload = function () { resolve(); };
      n.onerror = function () { n.remove(); reject(new Error("편집기를 불러오지 못했습니다(네트워크).")); };
      document.head.appendChild(n);
    });
  }
  var bundle = null;
  function loadBundle() {
    if (window.VltGuideEditorBundle) return Promise.resolve(window.VltGuideEditorBundle);
    if (bundle) return bundle;
    bundle = Promise.all([
      document.querySelector("link[data-vpe-css]") ? Promise.resolve() : loadOnce("link", { rel: "stylesheet", href: BASE + "editor.css?v=" + VERSION, "data-vpe-css": "" }),
      loadOnce("script", { src: BASE + "editor.bundle.js?v=" + VERSION })
    ]).then(function () {
      if (!window.VltGuideEditorBundle) throw new Error("편집기를 불러오지 못했습니다.");
      return window.VltGuideEditorBundle;
    }, function (e) { bundle = null; throw e; });
    return bundle;
  }
  // 로컬 시험(file:·localhost)에서만 가짜 저장소를 끼울 수 있다.
  var local = location.protocol === "file:" || /^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname);

  function setEditing(on) {
    if (on === state.editing || state.loading) return;
    if (!on) { if (state.run) state.run.stop(); return; }
    state.loading = true;
    say("편집기를 불러오는 중입니다…");
    loadBundle().then(function (B) {
      state.loading = false;
      say("");
      state.editing = true;
      refresh();
      state.run = B.start({
        path: PATH,
        adapter: (local && window.VLT_PAGE_EDITOR_TEST_ADAPTER) || undefined,
        onExit: function () { state.editing = false; state.run = null; refresh(); }
      });
    }, function (err) {
      state.loading = false;
      say(err.message, "error");
    });
  }
  sw.addEventListener("click", function () { setEditing(!state.editing); });

  refresh();
  window.__VLT_PAGE_EDITOR__.setEditing = setEditing;
  window.__VLT_PAGE_EDITOR__.state = state;
})();
