/*!
 * 결과지 원장 페이지 편집기 (page-editor.js)
 *
 * 톱니(오른쪽 위) → 원장 관리자 모드 → "페이지 수정하기"를 켜면 페이지를 보이는 그대로 고친다(Tiptap v3 위지윅).
 * 저장하면 지금 보이는 페이지 전체를 정적 HTML로 굳혀 공개 저장소(acmebld2026/eduplexge-vlt, master)의
 * 같은 파일에 커밋한다. 그 커밋이 곧 정본이다(GitHub Pages가 1~2분 안에 다시 배포, 캐시 때문에 최대 10분).
 *
 * - 쓰기 권한은 비밀번호가 아니라 원장이 이 브라우저에 한 번 등록한 GitHub 저장 키(fine-grained token)로 확인한다.
 *   비밀번호는 화면 잠금일 뿐이다. 키는 이 브라우저의 localStorage에만 있고 페이지·저장소에는 쓰지 않는다.
 * - 굳힌 페이지에는 <html data-page-edited>와 잠금 스크립트가 들어간다. 잠금 스크립트는 페이지를 여는 동안
 *   본문을 다시 그리려는 렌더러(REPORT_DATA → innerHTML)를 막아, 원장이 고친 글자가 그대로 보이게 한다.
 * - 토글 서랍(<details>)은 수정 중 우클릭으로 "기본으로 펼쳐 두기 / 접어 두기"를 정한다.
 *
 * 운영 규칙·복구: 비공개 저장소 `분석/결과지_원장_페이지편집기_운영기준.md`
 */
(function () {
  "use strict";
  if (window.__VLT_PAGE_EDITOR__) return;
  window.__VLT_PAGE_EDITOR__ = { version: "2026-10-20.1" };

  var VERSION = "2026-10-20.1";
  var CONFIG = {
    owner: "acmebld2026",
    repo: "eduplexge-vlt",
    branch: "master",
    // 원장 확인 모드와 같은 비밀번호(원문은 저장하지 않는다). 화면 잠금용이며 쓰기 권한은 GitHub 저장 키가 가진다.
    adminHash: "a9bc05dbc28cd543e41c54e797a912e1b02184ec19fedb93249eb27917099967",
    tokenKey: "vlt-page-editor:github-token",
    sessionKey: "vlt-page-editor:admin"
  };
  var html = document.documentElement;
  var script = document.currentScript;
  var BASE = (script && script.src) ? script.src.replace(/[^/]*$/, "") : "../assets/page-editor/";

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
  // 관리자 목록은 데이터 배열로 유지하는 앱 화면이라 굳혀 저장하지 않는다.
  if (!PATH || /^admin-/.test(PATH)) return;

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
  function store(kind) { try { return kind === "local" ? window.localStorage : window.sessionStorage; } catch (e) { return null; } }
  function getItem(kind, k) { var s = store(kind); try { return s ? s.getItem(k) : null; } catch (e) { return null; } }
  function setItem(kind, k, v) { var s = store(kind); try { if (s) { if (v == null) s.removeItem(k); else s.setItem(k, v); } } catch (e) { /* 저장소 차단 */ } }
  function hex(buf) { return Array.prototype.map.call(new Uint8Array(buf), function (b) { return ("0" + b.toString(16)).slice(-2); }).join(""); }
  function sha256(text) { return crypto.subtle.digest("SHA-256", new TextEncoder().encode(text)).then(hex); }
  function gitBlobSha(bytes) {
    var head = new TextEncoder().encode("blob " + bytes.length + "\0");
    var all = new Uint8Array(head.length + bytes.length);
    all.set(head, 0); all.set(bytes, head.length);
    return crypto.subtle.digest("SHA-1", all).then(hex);
  }
  function b64(bytes) {
    var s = "", CH = 0x8000;
    for (var i = 0; i < bytes.length; i += CH) s += String.fromCharCode.apply(null, bytes.subarray(i, i + CH));
    return btoa(s);
  }
  function stamp(d) {
    function z(n) { return ("0" + n).slice(-2); }
    return d.getFullYear() + "-" + z(d.getMonth() + 1) + "-" + z(d.getDate()) + " " + z(d.getHours()) + ":" + z(d.getMinutes());
  }

  /* ───────────── 정본 저장소(GitHub Contents API) ───────────── */
  function GitHubAdapter() {
    var api = "https://api.github.com/repos/" + CONFIG.owner + "/" + CONFIG.repo + "/contents/" + PATH.split("/").map(encodeURIComponent).join("/");
    function headers(token) {
      var h = { Accept: "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28" };
      if (token) h.Authorization = "Bearer " + token;
      return h;
    }
    function explain(res, body) {
      var msg = (body && body.message) || "";
      if (res.status === 401) return "GitHub 저장 키가 맞지 않거나 만료되었습니다. 저장 키를 다시 등록해 주세요.";
      if (res.status === 403 || res.status === 404) return "이 저장 키로는 " + CONFIG.owner + "/" + CONFIG.repo + " 저장소에 쓸 수 없습니다(Contents 읽기·쓰기 권한 필요). " + msg;
      if (res.status === 409 || res.status === 422) return "그 사이 저장소의 이 페이지가 바뀌었습니다. 새로고침한 뒤 다시 고쳐 주세요.";
      return "GitHub 응답 " + res.status + " " + msg;
    }
    return {
      label: "GitHub " + CONFIG.owner + "/" + CONFIG.repo + "@" + CONFIG.branch + ":" + PATH,
      current: function (token) {
        return fetch(api + "?ref=" + encodeURIComponent(CONFIG.branch), { headers: headers(token), cache: "no-store" }).then(function (res) {
          return res.json().catch(function () { return {}; }).then(function (body) {
            if (!res.ok) throw new Error(explain(res, body));
            return { sha: body.sha };
          });
        });
      },
      served: function () {
        return fetch(location.href.split("#")[0], { cache: "no-store" }).then(function (res) {
          if (!res.ok) throw new Error("공개 페이지를 다시 읽지 못했습니다(" + res.status + ").");
          return res.arrayBuffer();
        }).then(function (buf) { return gitBlobSha(new Uint8Array(buf)); });
      },
      save: function (token, text, sha, message) {
        var bytes = new TextEncoder().encode(text);
        return fetch(api, {
          method: "PUT",
          headers: Object.assign(headers(token), { "Content-Type": "application/json" }),
          body: JSON.stringify({ message: message, content: b64(bytes), sha: sha, branch: CONFIG.branch })
        }).then(function (res) {
          return res.json().catch(function () { return {}; }).then(function (body) {
            if (!res.ok) throw new Error(explain(res, body));
            return { sha: body.content && body.content.sha, commit: body.commit && body.commit.sha, url: body.commit && body.commit.html_url };
          });
        });
      }
    };
  }
  // 로컬 시험(file:·localhost)에서만 가짜 저장소를 끼울 수 있다.
  var local = location.protocol === "file:" || /^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname);
  var adapter = (local && window.VLT_PAGE_EDITOR_TEST_ADAPTER) || GitHubAdapter();

  /* ───────────── 잠금 스크립트(굳힌 페이지의 <head> 맨 앞에 들어간다) ───────────── */
  function freezeGuard() {
    var H = document.documentElement;
    if (!H.hasAttribute("data-page-edited") || window.__VLT_FROZEN__) return;
    var locked = true;
    window.__VLT_FROZEN__ = { unlock: function () { locked = false; } };
    function live(n) {
      for (var x = n; x; x = x.parentNode) if (x.nodeType === 1 && (x.hasAttribute("data-pe-ui") || x.hasAttribute("data-live"))) return true;
      return false;
    }
    function frozen(t) {
      if (!locked || !t) return false;
      if (t.nodeType !== 1) t = t.parentNode;
      var b = document.body;
      if (!t || !b || !t.isConnected || (t !== b && !b.contains(t))) return false;
      return !live(t);
    }
    function guardSetter(proto, prop, textNode) {
      var d = Object.getOwnPropertyDescriptor(proto, prop);
      if (!d || !d.set) return;
      Object.defineProperty(proto, prop, {
        configurable: true, enumerable: d.enumerable, get: d.get,
        set: function (v) { if (frozen(textNode ? this.parentNode : this)) return; d.set.call(this, v); }
      });
    }
    // 렌더러가 처음 그릴 때 지운 요소(예: $("expertise-box").remove())는 굳힌 페이지에 없다.
    // 잠긴 동안에는 없는 id 대신 문서 밖의 빈 요소를 돌려줘, 렌더러가 오류로 멈추지 않고 그냥 지나가게 한다.
    var byId = Document.prototype.getElementById;
    Document.prototype.getElementById = function (id) {
      var found = byId.call(this, id);
      if (found || !locked || this !== document) return found;
      var stub = document.createElement("div");
      stub.setAttribute("data-frozen-stub", id);
      return stub;
    };
    guardSetter(Element.prototype, "innerHTML");
    guardSetter(Element.prototype, "outerHTML");
    guardSetter(Node.prototype, "textContent");
    guardSetter(HTMLElement.prototype, "innerText");
    guardSetter(HTMLElement.prototype, "outerText");
    guardSetter(CharacterData.prototype, "data", true);
    guardSetter(Node.prototype, "nodeValue");
    function guardMethod(proto, name, ret) {
      var f = proto[name];
      if (typeof f !== "function") return;
      proto[name] = function () {
        var a = arguments, n = a[0];
        if (frozen(this) && !(n && n.nodeType === 1 && live(n))) return ret === "arg" ? n : ret === "arg2" ? a[1] : undefined;
        return f.apply(this, a);
      };
    }
    guardMethod(Node.prototype, "appendChild", "arg");
    guardMethod(Node.prototype, "insertBefore", "arg");
    guardMethod(Node.prototype, "replaceChild", "arg2");
    guardMethod(Node.prototype, "removeChild", "arg");
    ["append", "prepend", "replaceChildren", "remove", "before", "after", "replaceWith", "insertAdjacentHTML", "insertAdjacentText"].forEach(function (m) { guardMethod(Element.prototype, m); });
    guardMethod(Element.prototype, "insertAdjacentElement", "arg2");
    window.addEventListener("load", function () { setTimeout(function () { locked = false; }, 0); });
  }

  /* ───────────── 토글 서랍 기본 상태(사용자가 열고 닫기 전의 값) ───────────── */
  var detailDefaults = new WeakMap();
  function recordDetails(root) {
    Array.prototype.forEach.call((root || document).querySelectorAll("details"), function (d) {
      if (!detailDefaults.has(d)) detailDefaults.set(d, d.hasAttribute("open"));
    });
  }
  recordDetails(document);

  /* ───────────── 상태 ───────────── */
  var state = {
    admin: false, editing: false, dirty: 0, saving: false,
    baseSha: null,        // 이 화면이 딛고 있는 저장소 판(blob sha)
    savedOnce: false,
    fresh: null,          // 공개 페이지 = 저장소 최신본?
    active: null,         // { leaf, editor, original, changed }
    bundle: null
  };

  /* ───────────── 화면 요소 ───────────── */
  function loadCss() {
    if (document.querySelector("link[data-pe-css]")) return;
    var l = ui(el("link", { rel: "stylesheet", href: BASE + "page-editor.css?v=" + VERSION, "data-pe-css": "" }));
    document.head.appendChild(l);
  }
  loadCss();

  var builtInGear = document.querySelector("#director-gear");
  var gear = null, dlg = null;
  if (!builtInGear) {
    gear = ui(el("button", { type: "button", class: "pe-gear", "aria-label": "원장 관리자 모드 열기", title: "원장 관리자 모드", "aria-haspopup": "dialog",
      html: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="3.2"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/></svg>' }));
    var passInput = el("input", { type: "password", id: "pe-pass", autocomplete: "off", required: true });
    var passErr = el("p", { class: "pe-error", role: "alert", hidden: true, text: "비밀번호가 맞지 않습니다. 다시 입력해 주세요." });
    var form = el("form", { class: "pe-dialog__box" }, [
      el("h2", { text: "원장 관리자 모드" }),
      el("p", { text: "관리자 모드에서는 이 페이지를 직접 고쳐 정본으로 저장할 수 있습니다." }),
      el("label", { for: "pe-pass", text: "비밀번호" }), passInput, passErr,
      el("div", { class: "pe-dialog__actions" }, [el("button", { type: "button", "data-close": "", text: "닫기" }), el("button", { type: "submit", class: "is-primary", text: "열기" })])
    ]);
    dlg = ui(el("div", { class: "pe-dialog", role: "dialog", "aria-modal": "true", "aria-label": "원장 관리자 모드", hidden: true }, [form]));
    function closeDlg() { dlg.hidden = true; passInput.value = ""; passErr.hidden = true; gear.focus(); }
    form.querySelector("[data-close]").addEventListener("click", closeDlg);
    dlg.addEventListener("keydown", function (e) { if (e.key === "Escape") closeDlg(); });
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      sha256(passInput.value).then(function (h) {
        if (h === CONFIG.adminHash) { setAdmin(true); closeDlg(); } else { passErr.hidden = false; passInput.select(); }
      }, function () { passErr.hidden = false; });
    });
    gear.addEventListener("click", function () {
      if (state.admin) { if (!confirmLeave()) return; setAdmin(false); return; }
      dlg.hidden = false; setTimeout(function () { passInput.focus(); }, 0);
    });
    document.body.appendChild(gear);
    document.body.appendChild(dlg);
  }

  // 관리자 막대
  var bar = ui(el("div", { class: "pe-bar", role: "region", "aria-label": "원장 페이지 수정", hidden: true }));
  var sw = el("button", { type: "button", class: "pe-switch", role: "switch", "aria-checked": "false" }, [el("span", { class: "pe-switch__track", "aria-hidden": "true" }), el("span", { text: "페이지 수정하기" })]);
  var statusText = el("span", { class: "pe-status", "aria-live": "polite" });
  var saveBtn = el("button", { type: "button", class: "pe-btn is-primary", disabled: true, text: "저장 · 정본 반영" });
  var revertBtn = el("button", { type: "button", class: "pe-btn", disabled: true, text: "수정 취소" });
  var keyBtn = el("button", { type: "button", class: "pe-btn is-ghost", title: "GitHub 저장 키 등록·변경", text: "저장 키" });
  var notice = el("p", { class: "pe-notice", hidden: true });
  bar.appendChild(el("div", { class: "pe-bar__row" }, [el("strong", { class: "pe-bar__title", text: "원장 관리자 모드" }), sw]));
  bar.appendChild(el("div", { class: "pe-bar__row pe-bar__actions" }, [statusText, revertBtn, saveBtn, keyBtn]));
  bar.appendChild(notice);
  document.body.appendChild(bar);

  function say(text, tone) {
    notice.textContent = text || "";
    notice.hidden = !text;
    notice.className = "pe-notice" + (tone ? " is-" + tone : "");
  }
  function refresh() {
    bar.hidden = !state.admin;
    html.classList.toggle("pe-admin", state.admin);
    html.classList.toggle("pe-editing", state.editing);
    sw.setAttribute("aria-checked", state.editing ? "true" : "false");
    var n = state.dirty + (state.active && state.active.changed ? 1 : 0);
    statusText.textContent = state.saving ? "저장 중…" : state.editing ? (n ? "고친 곳 " + n + "곳 · 저장 전" : (state.savedOnce ? "저장됨" : "고칠 글자를 누르세요")) : (state.savedOnce ? "저장됨" : "");
    saveBtn.disabled = state.saving || !n;
    revertBtn.disabled = state.saving || !n;
    if (gear) {
      gear.classList.toggle("is-on", state.admin);
      gear.setAttribute("aria-label", state.admin ? "원장 관리자 모드 닫기" : "원장 관리자 모드 열기");
    }
  }
  function hasUnsaved() { return state.dirty > 0 || !!(state.active && state.active.changed); }
  function confirmLeave() { return !hasUnsaved() || window.confirm("저장하지 않은 수정이 있습니다. 버리고 나갈까요?"); }

  function setAdmin(on) {
    state.admin = on;
    if (!builtInGear) setItem("session", CONFIG.sessionKey, on ? "1" : null);
    if (!on && state.editing) setEditing(false, true);
    refresh();
  }
  if (builtInGear) {
    // 이 페이지에 이미 있는 원장 확인 모드(톱니·비밀번호)를 관리자 모드로 쓴다.
    var sync = function () {
      var on = html.classList.contains("director-mode");
      if (on !== state.admin) setAdmin(on);
    };
    new MutationObserver(sync).observe(html, { attributes: true, attributeFilter: ["class"] });
    builtInGear.addEventListener("click", function (e) {
      if (html.classList.contains("director-mode") && !confirmLeave()) { e.stopImmediatePropagation(); e.preventDefault(); }
    }, true);
    sync();
  } else if (getItem("session", CONFIG.sessionKey) === "1") {
    setAdmin(true);
  }

  /* ───────────── 고칠 수 있는 글자 덩어리 찾기 ───────────── */
  var INLINE = { a: 1, b: 1, strong: 1, i: 1, em: 1, span: 1, small: 1, sup: 1, sub: 1, mark: 1, abbr: 1, cite: 1, q: 1, time: 1, kbd: 1, "var": 1, dfn: 1, ins: 1, del: 1, s: 1, u: 1, code: 1, bdi: 1, data: 1, br: 1, wbr: 1 };
  var SKIP = "script,style,template,noscript,svg,canvas,iframe,video,audio,button,select,textarea,input,option,[data-pe-ui],.director-dialog,#director-gear,.pe-gear";
  function inlineTree(node) {
    for (var c = node.firstChild; c; c = c.nextSibling) {
      if (c.nodeType === 3 || c.nodeType === 8) continue;
      if (c.nodeType !== 1) return false;
      var tag = c.tagName.toLowerCase();
      if (!INLINE[tag] || !inlineTree(c)) return false;
    }
    return true;
  }
  function markLeaves(root) {
    var found = 0;
    (function walk(n) {
      for (var c = n.firstElementChild; c; c = c.nextElementSibling) {
        if (c.matches(SKIP)) continue;
        if (c.classList.contains("pe-editable")) { found++; continue; }
        if (/\S/.test(c.textContent) && inlineTree(c)) { c.classList.add("pe-editable"); found++; continue; }
        walk(c);
      }
    })(root);
    return found;
  }

  /* ───────────── Tiptap 불러오기 ───────────── */
  function loadBundle() {
    if (window.VltTiptap) return Promise.resolve(window.VltTiptap);
    if (state.bundle) return state.bundle;
    state.bundle = new Promise(function (resolve, reject) {
      var s = ui(el("script", { src: BASE + "tiptap.bundle.js?v=" + VERSION }));
      s.onload = function () { window.VltTiptap ? resolve(window.VltTiptap) : reject(new Error("편집 엔진을 불러오지 못했습니다.")); };
      s.onerror = function () { state.bundle = null; reject(new Error("편집 엔진을 불러오지 못했습니다(네트워크).")); };
      document.head.appendChild(s);
    });
    return state.bundle;
  }

  /* ───────────── 서식 도구 막대 ───────────── */
  var COLORS = [["gray", "회색", "#787774", "#f1f1ef"], ["brown", "갈색", "#9f6b53", "#f4eeee"], ["orange", "주황", "#d9730d", "#fbecdd"], ["yellow", "노랑", "#cb912f", "#fbf3db"], ["green", "초록", "#448361", "#edf3ec"], ["blue", "파랑", "#337ea9", "#e7f3f8"], ["purple", "보라", "#9065b0", "#f6f3f9"], ["pink", "분홍", "#c14c8a", "#faf1f5"], ["red", "빨강", "#d44c47", "#fdebec"]];
  var toolbar = ui(el("div", { class: "pe-toolbar", role: "toolbar", "aria-label": "글자 서식", hidden: true }));
  var pop = ui(el("div", { class: "pe-pop", role: "menu", hidden: true }));
  document.body.appendChild(toolbar);
  document.body.appendChild(pop);
  function tb(label, text, run, isOn, cls) {
    var b = el("button", { type: "button", class: "pe-tb" + (cls ? " " + cls : ""), "aria-label": label, title: label, html: text });
    b.addEventListener("mousedown", function (e) { e.preventDefault(); });
    b.addEventListener("click", function () { if (state.active) run(state.active.editor, b); syncToolbar(); });
    b._isOn = isOn;
    toolbar.appendChild(b);
    return b;
  }
  function chain(ed) { return ed.chain().focus(); }
  tb("굵게 (Ctrl+B)", "<b>B</b>", function (ed) { chain(ed).toggleBold().run(); }, function (ed) { return ed.isActive("bold"); });
  tb("기울임 (Ctrl+I)", "<i>I</i>", function (ed) { chain(ed).toggleItalic().run(); }, function (ed) { return ed.isActive("italic"); });
  tb("밑줄 (Ctrl+U)", "<u>U</u>", function (ed) { chain(ed).toggleUnderline().run(); }, function (ed) { return ed.isActive("underline"); });
  tb("취소선", "<s>S</s>", function (ed) { chain(ed).toggleStrike().run(); }, function (ed) { return ed.isActive("strike"); });
  toolbar.appendChild(el("span", { class: "pe-tb-sep", "aria-hidden": "true" }));
  function swatches(kind, anchor) {
    pop.innerHTML = "";
    pop.appendChild(el("button", { type: "button", class: "pe-swatch is-none", title: "기본 색", "aria-label": "기본 색", text: "×", onclick: function () {
      var c = chain(state.active.editor); (kind === "color" ? c.unsetColor() : c.unsetBackgroundColor()).run(); closePop();
    } }));
    COLORS.forEach(function (c) {
      var v = kind === "color" ? c[2] : c[3];
      pop.appendChild(el("button", { type: "button", class: "pe-swatch", title: c[1], "aria-label": c[1], style: (kind === "color" ? "color:" + v + ";" : "background:" + v + ";"), text: "가", onclick: function () {
        var ch = chain(state.active.editor); (kind === "color" ? ch.setColor(v) : ch.setBackgroundColor(v)).run(); closePop();
      } }));
    });
    openPop(anchor);
  }
  tb("글자색", '<span class="pe-ico-a">가</span>▾', function (ed, b) { swatches("color", b); });
  tb("배경색(형광펜)", '<span class="pe-ico-hl">가</span>▾', function (ed, b) { swatches("bg", b); });
  tb("링크", "🔗", function (ed) {
    var prev = ed.getAttributes("link").href || "";
    var url = window.prompt("연결할 주소(비우면 링크 해제)", prev);
    if (url === null) return;
    url = url.trim();
    if (!url) { chain(ed).extendMarkRange("link").unsetLink().run(); return; }
    if (!/^(https?:|mailto:|tel:|#|\/|\.)/i.test(url)) url = "https://" + url;
    chain(ed).extendMarkRange("link").setLink({ href: url }).run();
  }, function (ed) { return ed.isActive("link"); });
  tb("서식 지우기", "⌫", function (ed) { chain(ed).unsetAllMarks().run(); });
  toolbar.appendChild(el("span", { class: "pe-tb-sep", "aria-hidden": "true" }));
  tb("되돌리기 (Ctrl+Z)", "↶", function (ed) { chain(ed).undo().run(); });
  tb("다시 하기 (Ctrl+Y)", "↷", function (ed) { chain(ed).redo().run(); });
  tb("이 글자 고치기 끝내기 (Esc)", "완료", function () { deactivate(); }, null, "is-done");

  function openPop(anchor) {
    var r = anchor.getBoundingClientRect();
    pop.hidden = false;
    pop.style.top = (r.bottom + 6) + "px";
    pop.style.left = Math.max(8, Math.min(r.left, window.innerWidth - pop.offsetWidth - 8)) + "px";
  }
  function closePop() { pop.hidden = true; pop.innerHTML = ""; }
  document.addEventListener("pointerdown", function (e) { if (!pop.hidden && !pop.contains(e.target) && !toolbar.contains(e.target)) closePop(); }, true);

  function syncToolbar() {
    if (!state.active) { toolbar.hidden = true; return; }
    Array.prototype.forEach.call(toolbar.querySelectorAll(".pe-tb"), function (b) {
      if (b._isOn) b.classList.toggle("is-on", !!b._isOn(state.active.editor));
    });
  }
  function placeToolbar() {
    if (!state.active) return;
    toolbar.hidden = false;
    var r = state.active.leaf.getBoundingClientRect();
    var h = toolbar.offsetHeight || 40, w = toolbar.offsetWidth || 360;
    var top = r.top - h - 8;
    if (top < 8) top = Math.min(window.innerHeight - h - 8, r.bottom + 8);
    toolbar.style.top = Math.max(8, top) + "px";
    toolbar.style.left = Math.max(8, Math.min(r.left, window.innerWidth - w - 8)) + "px";
  }
  window.addEventListener("scroll", placeToolbar, { passive: true });
  window.addEventListener("resize", placeToolbar);

  /* ───────────── 글자 덩어리 편집 ───────────── */
  function activate(leaf) {
    if (state.active && state.active.leaf === leaf) return;
    deactivate();
    var T = window.VltTiptap;
    var original = leaf.innerHTML;
    leaf.innerHTML = "";
    leaf.classList.add("pe-active");
    var editor;
    try {
      editor = new T.Editor({
        element: leaf,
        extensions: [
          T.StarterKit.configure({ heading: false, blockquote: false, codeBlock: false, horizontalRule: false, dropcursor: false, gapcursor: false, trailingNode: false, link: { openOnClick: false, autolink: false, linkOnPaste: true } }),
          T.TextStyle, T.Color, T.BackgroundColor, T.PreservedInline
        ],
        content: original,
        autofocus: "end",
        editorProps: { attributes: { class: "pe-pm", spellcheck: "false" } }
      });
    } catch (err) {
      leaf.innerHTML = original;
      leaf.classList.remove("pe-active");
      say("이 부분은 편집기로 열 수 없습니다: " + err.message, "warn");
      return;
    }
    var rec = { leaf: leaf, editor: editor, original: original, changed: false };
    editor.on("update", function () { if (!rec.changed) { rec.changed = true; refresh(); } });
    editor.on("selectionUpdate", syncToolbar);
    editor.on("transaction", syncToolbar);
    state.active = rec;
    if (!/is-(warn|error)/.test(notice.className)) say("");
    editor.commands.focus("end");
    placeToolbar(); syncToolbar(); refresh();
  }

  function deactivate() {
    var rec = state.active;
    if (!rec) return;
    state.active = null;
    closePop();
    toolbar.hidden = true;
    var out = rec.changed ? rec.editor.getHTML() : null;
    rec.editor.destroy();
    rec.leaf.classList.remove("pe-active");
    if (out === null) { rec.leaf.innerHTML = rec.original; refresh(); return; }
    writeBack(rec.leaf, out);
    state.dirty++;
    refresh();
  }

  function writeBack(leaf, out) {
    var t = document.createElement("template");
    t.innerHTML = out;
    var blocks = Array.prototype.filter.call(t.content.childNodes, function (n) { return n.nodeType === 1; });
    var tag = leaf.tagName.toLowerCase();
    var innerOf = function (b) { return b.tagName === "P" ? b.innerHTML : b.outerHTML; };
    leaf.classList.add("pe-changed");
    if (blocks.length <= 1) {
      leaf.innerHTML = blocks[0] ? (blocks[0].tagName === "P" ? blocks[0].innerHTML : blocks[0].outerHTML) : "";
      return;
    }
    if (tag === "p") {
      // 문단을 나누면 같은 모양의 문단을 뒤에 이어 붙인다(목록은 그대로).
      leaf.innerHTML = innerOf(blocks[0]);
      var after = leaf;
      blocks.slice(1).forEach(function (b) {
        var n;
        if (b.tagName === "P") { n = leaf.cloneNode(false); n.removeAttribute("id"); n.innerHTML = b.innerHTML; }
        else { n = b; n.classList.add("pe-editable"); }
        after.parentNode.insertBefore(n, after.nextSibling);
        n.classList.add("pe-changed");
        after = n;
      });
      return;
    }
    // 제목·목록 항목·칸 안에서는 줄바꿈으로 합친다.
    leaf.innerHTML = blocks.map(function (b) {
      if (b.tagName === "UL" || b.tagName === "OL") return Array.prototype.map.call(b.querySelectorAll("li"), function (li) { return "• " + li.textContent; }).join("<br>");
      return innerOf(b);
    }).join("<br>");
  }

  document.addEventListener("click", function (e) {
    if (!state.editing) return;
    var t = e.target;
    if (!(t instanceof Element) || t.closest("[data-pe-ui]")) return;
    var leaf = t.closest(".pe-editable");
    // 수정 중에는 링크 이동·서랍 여닫기를 막고 그 글자를 편집한다.
    if (t.closest("a, summary")) e.preventDefault();
    if (!leaf) { if (state.active && !state.active.leaf.contains(t)) deactivate(); return; }
    if (state.active && state.active.leaf === leaf) return;
    activate(leaf);
  }, true);
  document.addEventListener("keydown", function (e) {
    if (!state.editing) return;
    if (e.key === "Escape" && state.active) { e.preventDefault(); deactivate(); }
    if ((e.ctrlKey || e.metaKey) && (e.key === "s" || e.key === "S")) { e.preventDefault(); save(); }
    // 서랍 제목(summary) 안에서 띄어쓰기·Enter가 서랍을 여닫지 않게 한다.
    if (state.active && (e.key === " " || e.key === "Enter") && state.active.leaf.closest("summary")) e.stopPropagation();
  }, true);
  document.addEventListener("keyup", function (e) {
    if (state.active && e.key === " " && state.active.leaf.closest("summary")) e.preventDefault();
  }, true);

  /* ───────────── 토글 서랍 우클릭 메뉴 ───────────── */
  var menu = ui(el("div", { class: "pe-menu", role: "menu", hidden: true }));
  document.body.appendChild(menu);
  function closeMenu() { menu.hidden = true; menu.innerHTML = ""; }
  document.addEventListener("pointerdown", function (e) { if (!menu.hidden && !menu.contains(e.target)) closeMenu(); }, true);
  document.addEventListener("keydown", function (e) { if (e.key === "Escape" && !menu.hidden) closeMenu(); });
  var menuY = 0;
  window.addEventListener("scroll", function () { if (!menu.hidden && Math.abs(window.scrollY - menuY) > 40) closeMenu(); }, { passive: true });
  document.addEventListener("contextmenu", function (e) {
    if (!state.editing) return;
    var d = e.target instanceof Element && e.target.closest("details");
    if (!d || d.closest("[data-pe-ui]")) return;
    e.preventDefault();
    recordDetails(document);
    var def = !!detailDefaults.get(d);
    menu.innerHTML = "";
    var title = (d.querySelector("summary") || d).textContent.trim().replace(/\s+/g, " ").slice(0, 28);
    menu.appendChild(el("div", { class: "pe-menu__title", text: "토글 서랍 · " + (title || "제목 없음") }));
    function item(label, on, run) {
      menu.appendChild(el("button", { type: "button", role: "menuitemradio", "aria-checked": on ? "true" : "false", class: "pe-menu__item" + (on ? " is-on" : ""), onclick: function () { run(); closeMenu(); } }, [el("span", { class: "pe-check", "aria-hidden": "true", text: on ? "✓" : "" }), label]));
    }
    function setDefault(open) {
      if (detailDefaults.get(d) === open) return;
      detailDefaults.set(d, open);
      d.open = open;
      d.classList.add("pe-changed");
      state.dirty++;
      refresh();
    }
    item("기본으로 펼쳐 두기", def, function () { setDefault(true); });
    item("기본으로 접어 두기", !def, function () { setDefault(false); });
    menu.appendChild(el("div", { class: "pe-menu__sep" }));
    menu.appendChild(el("button", { type: "button", role: "menuitem", class: "pe-menu__item", onclick: function () { d.open = !d.open; closeMenu(); } }, [el("span", { class: "pe-check", "aria-hidden": "true" }), d.open ? "지금 접어 보기" : "지금 펼쳐 보기"]));
    menu.hidden = false;
    menuY = window.scrollY;
    var x = Math.min(e.clientX, window.innerWidth - menu.offsetWidth - 8), y = Math.min(e.clientY, window.innerHeight - menu.offsetHeight - 8);
    menu.style.left = Math.max(8, x) + "px";
    menu.style.top = Math.max(8, y) + "px";
  });

  /* ───────────── 수정 모드 켜고 끄기 ───────────── */
  function setEditing(on, force) {
    if (on === state.editing) return;
    if (!on) {
      if (!force && !confirmLeave()) { refresh(); return; }
      if (state.active) deactivate();
      if (hasUnsaved()) { state.dirty = 0; location.reload(); return; }
      state.editing = false; refresh(); say("");
      return;
    }
    say("편집 엔진을 불러오는 중입니다…");
    loadBundle().then(function () {
      var n = markLeaves(document.body);
      state.editing = true;
      refresh();
      say(n ? "고칠 글자를 누르면 그 자리에서 편집됩니다. 토글 서랍은 우클릭으로 기본 상태를 정합니다." : "이 페이지에서 고칠 수 있는 글자를 찾지 못했습니다.", n ? null : "warn");
      checkFresh();
    }, function (err) { say(err.message, "error"); });
  }
  sw.addEventListener("click", function () { setEditing(!state.editing); });
  revertBtn.addEventListener("click", function () {
    if (window.confirm("저장하지 않은 수정을 모두 버리고 페이지를 다시 불러올까요?")) { state.dirty = 0; if (state.active) state.active.changed = false; location.reload(); }
  });
  window.addEventListener("beforeunload", function (e) { if (hasUnsaved()) { e.preventDefault(); e.returnValue = ""; } });

  /* ───────────── 정본 확인(공개 페이지 = 저장소 최신본?) ───────────── */
  function token() { return getItem("local", CONFIG.tokenKey); }
  function checkFresh() {
    if (state.savedOnce) return Promise.resolve(true);
    return Promise.all([adapter.current(token()), adapter.served()]).then(function (r) {
      state.baseSha = r[0].sha;
      state.fresh = r[0].sha === r[1];
      if (!state.fresh) say("지금 보이는 페이지가 저장소의 최신 정본과 다릅니다(직전 저장이 아직 배포 중이거나 다른 수정이 있었습니다). 몇 분 뒤 새로고침한 다음 고쳐 주세요.", "warn");
      return state.fresh;
    }, function (err) {
      state.fresh = null;
      say("정본 상태를 확인하지 못했습니다: " + err.message, "warn");
      return null;
    });
  }

  /* ───────────── 굳혀서 저장 ───────────── */
  function snapshot() {
    var liveDetails = Array.prototype.slice.call(document.querySelectorAll("details"));
    var clone = html.cloneNode(true);
    Array.prototype.forEach.call(clone.querySelectorAll("[data-pe-ui]"), function (n) { n.parentNode.removeChild(n); });
    Array.prototype.forEach.call(clone.querySelectorAll("[class]"), function (n) {
      Array.prototype.slice.call(n.classList).forEach(function (c) { if (/^pe-/.test(c)) n.classList.remove(c); });
      if (!n.getAttribute("class")) n.removeAttribute("class");
    });
    ["pe-admin", "pe-editing", "director-mode"].forEach(function (c) { clone.classList.remove(c); });
    if (!clone.getAttribute("class")) clone.removeAttribute("class");
    var g = clone.querySelector("#director-gear");
    if (g) g.setAttribute("aria-label", "원장 확인 모드 열기");
    var dd = clone.querySelector("#director-dialog");
    if (dd) dd.setAttribute("hidden", "");
    var cloneDetails = Array.prototype.slice.call(clone.querySelectorAll("details"));
    cloneDetails.forEach(function (d, i) {
      var src = liveDetails[i];
      var open = src && detailDefaults.has(src) ? detailDefaults.get(src) : d.hasAttribute("open");
      if (open) d.setAttribute("open", ""); else d.removeAttribute("open");
    });
    clone.setAttribute("data-page-edited", new Date().toISOString());
    var head = clone.querySelector("head");
    if (!head.querySelector("script[data-page-freeze-guard]")) {
      var gs = document.createElement("script");
      gs.setAttribute("data-page-freeze-guard", VERSION);
      gs.textContent = "(" + freezeGuard.toString() + ")();";
      head.insertBefore(gs, head.firstChild);
    }
    if (!clone.querySelector("script[data-page-editor]")) {
      var ls = document.createElement("script");
      ls.setAttribute("src", "../assets/page-editor/page-editor.js");
      ls.setAttribute("defer", "");
      ls.setAttribute("data-page-editor", "");
      clone.querySelector("body").appendChild(ls);
    }
    return "<!DOCTYPE html>\n" + clone.outerHTML + "\n";
  }

  function askToken() {
    return new Promise(function (resolve) {
      var input = el("input", { type: "password", id: "pe-token", autocomplete: "off", placeholder: "github_pat_…" });
      var box = el("form", { class: "pe-dialog__box" }, [
        el("h2", { text: "GitHub 저장 키" }),
        el("p", { html: "고친 페이지를 정본(공개 저장소 <b>" + CONFIG.owner + "/" + CONFIG.repo + "</b>)에 저장하려면 원장 GitHub 계정의 저장 키가 필요합니다. 키는 <b>이 브라우저에만</b> 보관되며 페이지에는 기록되지 않습니다." }),
        el("p", { class: "pe-small", html: "GitHub → Settings → Developer settings → Fine-grained tokens → 저장소 <b>" + CONFIG.repo + "</b> 하나만, 권한 <b>Contents: Read and write</b>." }),
        el("label", { for: "pe-token", text: "저장 키" }), input,
        el("div", { class: "pe-dialog__actions" }, [
          token() ? el("button", { type: "button", "data-forget": "", text: "이 브라우저에서 지우기" }) : null,
          el("button", { type: "button", "data-close": "", text: "닫기" }),
          el("button", { type: "submit", class: "is-primary", text: "등록" })
        ])
      ]);
      var d = ui(el("div", { class: "pe-dialog", role: "dialog", "aria-modal": "true", "aria-label": "GitHub 저장 키" }, [box]));
      function done(v) { d.parentNode && d.parentNode.removeChild(d); resolve(v); }
      box.querySelector("[data-close]").addEventListener("click", function () { done(null); });
      var f = box.querySelector("[data-forget]");
      if (f) f.addEventListener("click", function () { setItem("local", CONFIG.tokenKey, null); say("이 브라우저의 저장 키를 지웠습니다."); done(null); });
      d.addEventListener("keydown", function (e) { if (e.key === "Escape") done(null); });
      box.addEventListener("submit", function (e) {
        e.preventDefault();
        var v = input.value.trim();
        if (!v) return;
        setItem("local", CONFIG.tokenKey, v);
        done(v);
      });
      document.body.appendChild(d);
      setTimeout(function () { input.focus(); }, 0);
    });
  }
  keyBtn.addEventListener("click", function () { askToken(); });

  function save() {
    if (state.saving || !state.editing) return;
    if (state.active) deactivate();
    if (!hasUnsaved()) return;
    var tk = token();
    var ready = tk ? Promise.resolve(tk) : askToken();
    ready.then(function (t) {
      if (!t) { say("저장 키가 없어 저장하지 않았습니다.", "warn"); return; }
      state.saving = true; refresh(); say("정본 상태를 확인하는 중입니다…");
      var base = state.savedOnce ? Promise.resolve(true) : checkFresh();
      return base.then(function (fresh) {
        if (fresh === false) throw new Error("지금 보이는 페이지가 저장소의 최신 정본과 달라 저장하지 않았습니다. 몇 분 뒤 새로고침한 다음 다시 고쳐 주세요.");
        if (!state.baseSha) throw new Error("저장소의 현재 판을 확인하지 못해 저장하지 않았습니다.");
        var text = snapshot();
        var title = (document.title || "").replace(/\s+/g, " ").trim().slice(0, 60);
        var msg = "원장 페이지 수정: " + PATH.replace(/\/index\.html$/, "") + " · " + title + " (" + stamp(new Date()) + ")";
        say("저장하는 중입니다…");
        return adapter.save(t, text, state.baseSha, msg).then(function (r) {
          state.baseSha = r.sha;
          state.savedOnce = true;
          state.dirty = 0;
          Array.prototype.forEach.call(document.querySelectorAll(".pe-changed"), function (n) { n.classList.remove("pe-changed"); });
          say("정본에 저장했습니다. 공개 페이지는 보통 1~2분, 늦어도 10분 안에 새 내용으로 바뀝니다." + (r.commit ? " (커밋 " + r.commit.slice(0, 7) + ")" : ""), "ok");
        });
      });
    }).catch(function (err) {
      say(err.message || String(err), "error");
    }).then(function () { state.saving = false; refresh(); });
  }
  saveBtn.addEventListener("click", save);

  refresh();
  window.__VLT_PAGE_EDITOR__.snapshot = snapshot;
  window.__VLT_PAGE_EDITOR__.state = state;
})();
