// === keyboard.js — keydown/keyup + IME 보정 + 커밋된 문자 추출 ===
(() => {
  const BUF_MAX   = 64;
  const FLUSH_MS  = 200;
  const CAPTURE_REPEAT = false;

  const buf = [];

  // ----- IME 'Process' 복원(US 레이아웃 기준) -----
  function fromCodeToChar(code, shift) {
    const m1 = /^Key([A-Z])$/.exec(code);
    if (m1) return shift ? m1[1] : m1[1].toLowerCase();
    const digit = {
      Digit1:["1","!"], Digit2:["2","@"], Digit3:["3","#"], Digit4:["4","$"],
      Digit5:["5","%"], Digit6:["6","^"], Digit7:["7","&"], Digit8:["8","*"],
      Digit9:["9","("], Digit0:["0",")"],
    };
    if (code in digit) return digit[code][shift ? 1 : 0];
    const sym = {
      Minus:["-","_"], Equal:["=","+"],
      BracketLeft:["[","{"], BracketRight:["]","}"],
      Backslash:["\\","|"],
      Semicolon:[";",":"], Quote:["'",'"'],
      Comma:[",","<"], Period:[".",">"], Slash:["/","?"],
      Backquote:["`","~"],
      Space:[" "," "],
    };
    if (code in sym) return sym[code][shift ? 1 : 0];
    return "";
  }

  // 민감 입력 제외(원하면 끄세요)
  function isSensitiveFocused() {
    const el = document.activeElement;
    if (!el) return false;
    const tag = el.tagName?.toLowerCase();
    if (tag === "input") {
      const type = (el.getAttribute("type") || "").toLowerCase();
      if (type === "password") return true;
    }
    if (el.isContentEditable) return true;
    return false;
  }

  function normalizeKey(ev) {
    if (ev.key && ev.key !== "Process") return ev.key;
    const g = fromCodeToChar(ev.code || "", ev.shiftKey);
    return g || (ev.key || "");
  }

  function pushRow(row) {
    buf.push(row);
    if (buf.length >= BUF_MAX) flush();
  }

  // ---- 물리 키(keydown/keyup) ----
  function onKey(ev) {
    if (!CAPTURE_REPEAT && ev.repeat) return;
    if (ev.type === "keydown" && ev.isComposing) return; // keydown만 필터
    if (isSensitiveFocused()) return;

    const k = normalizeKey(ev);
    if (!k) return;

    pushRow({
      timestamp: Date.now(),   // ms 정수 — 저장 자체는 정확
      key: k,
      type: ev.type            // 'keydown' | 'keyup'
    });
  }

  // ---- 커밋된 문자(IME 포함) ----
  // 최종으로 입력칸에 들어간 문자/문자열을 잡아 별도 이벤트로 보낸다.
  function onBeforeInput(e) {
    // 참고용: e.inputType, e.data
    // 여기선 기록하지 않고, 실제 커밋이 일어난 input에서 기록
  }
  function onInput(e) {
    if (isSensitiveFocused()) return;
    // 문자열이 커밋될 때만
    if (e instanceof InputEvent && typeof e.data === "string" && e.data.length > 0) {
      pushRow({
        timestamp: Date.now(),
        key: e.data,           // 실제 커밋된 문자열
        type: "text"           // 구분용: 텍스트 커밋 이벤트
      });
    }
  }
  function onCompositionEnd(e) {
    // 일부 입력기에서 compositionend 시점에 commit 문자열이 e.data로 옴
    if (isSensitiveFocused()) return;
    if (typeof e.data === "string" && e.data.length > 0) {
      pushRow({
        timestamp: Date.now(),
        key: e.data,
        type: "text"
      });
    }
  }

  function safeSend(kind, payload) {
    if (!chrome?.runtime?.id) return;
    try { chrome.runtime.sendMessage({ kind, payload }); } catch {}
  }
  function flush() {
    if (!buf.length) return;
    const batch = buf.splice(0);
    safeSend("KEYS", batch); // background에서 한 번에 처리
  }

  addEventListener("keydown", onKey, { passive: true });
  addEventListener("keyup",   onKey, { passive: true });
  addEventListener("beforeinput", onBeforeInput, { passive: true, capture: true });
  addEventListener("input",        onInput,      { passive: true, capture: true });
  addEventListener("compositionend", onCompositionEnd, { passive: true });

  const timer = setInterval(flush, FLUSH_MS);
  addEventListener("pagehide", flush);
  addEventListener("beforeunload", flush);
  addEventListener("unload", () => clearInterval(timer));
})();
