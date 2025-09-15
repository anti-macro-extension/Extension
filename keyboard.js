// ===== keyboard.js (content script; MV3 safe) =====
// 키/조합/텍스트 로깅 (+옵션: 한글 자모 jamo 캡처)

(() => {
  "use strict";

  // === 옵션: jamo 전송 여부 (CSV에 jamo 안 넣으려면 false) ===
  const EMIT_JAMO = false;

  // ----- safe runtime send -----
  const hasRuntime = () => typeof chrome !== "undefined" && chrome?.runtime?.id;
  const safeSend = (msg) => {
    if (!hasRuntime()) return;
    try { chrome.runtime.sendMessage(msg, () => void chrome.runtime.lastError); } catch {}
  };

  // ----- time helper -----
  const nowRec = () => {
    const ms = Date.now();
    return { timestamp_ms: ms, timestamp_iso: new Date(ms).toISOString() };
  };

  // ----- buffers -----
  let outKeys = [];
  let outTexts = [];
  let outComps = [];
  let outJamo = []; // EMIT_JAMO=false 면 실제 전송되지 않음

  // ----- 두벌식 자모 맵 -----
  const JAMO_MAP = {
    KeyQ:'ㅂ', KeyW:'ㅈ', KeyE:'ㄷ', KeyR:'ㄱ', KeyT:'ㅅ',
    KeyA:'ㅁ', KeyS:'ㄴ', KeyD:'ㅇ', KeyF:'ㄹ', KeyG:'ㅎ',
    KeyZ:'ㅋ', KeyX:'ㅌ', KeyC:'ㅊ', KeyV:'ㅍ',
    KeyY:'ㅛ', KeyU:'ㅕ', KeyI:'ㅑ', KeyO:'ㅐ', KeyP:'ㅔ',
    KeyH:'ㅗ', KeyJ:'ㅓ', KeyK:'ㅏ', KeyL:'ㅣ',
    KeyB:'ㅠ', KeyN:'ㅜ', KeyM:'ㅡ',
    "Shift+KeyO":"ㅒ", "Shift+KeyP":"ㅖ"
  };
  const codeToJamo = (code, shift) => JAMO_MAP[shift ? `Shift+${code}` : code] || JAMO_MAP[code] || "";
  const isJamoChar = (ch) =>
    typeof ch === "string" && ch.length === 1 && (/[\u3131-\u318E\u1100-\u11FF]/.test(ch));

  // ----- flush -----
  function flush(kind = "ALL") {
    try {
      if ((kind === "ALL" || kind === "KEYS") && outKeys.length) {
        const p = outKeys; outKeys = [];
        safeSend({ kind: "KEYS", payload: p });
      }
      if ((kind === "ALL" || kind === "TEXT") && outTexts.length) {
        const p = outTexts; outTexts = [];
        safeSend({ kind: "KEYS", payload: p });
      }
      if ((kind === "ALL" || kind === "COMP") && outComps.length) {
        const p = outComps; outComps = [];
        safeSend({ kind: "KEYS", payload: p });
      }
      if (EMIT_JAMO && (kind === "ALL" || kind === "JAMO") && outJamo.length) {
        const p = outJamo.map(r => {
          if (!isJamoChar(r.key)) {
            const fixed = codeToJamo(r.code, r.shift);
            if (fixed) r.key = fixed;
          }
          return r;
        });
        outJamo = [];
        safeSend({ kind: "KEYS", payload: p });
      }
    } catch {}
  }
  const AUTO_FLUSH_MS = 1200;
  let tmr = setInterval(() => flush("ALL"), AUTO_FLUSH_MS);

  // ----- IME/Process 윈도 -----
  let lastProcessTs = 0;
  const PROCESS_WINDOW_MS = 140;
  const processActive = () => (Date.now() - lastProcessTs) <= PROCESS_WINDOW_MS;

  // ----- keyboard events -----
  function onKey(ev) {
    const base = nowRec();

    // Process면 표시용 key를 물리키(code)로 치환
    const displayKey = (ev.key === "Process" && ev.code) ? ev.code : ev.key;

    // 1) raw key log
    outKeys.push({
      ...base,
      type: ev.type,
      key: displayKey,      // CSV에 나갈 표시용 키
      key_raw: ev.key,      // 원본 key (필요하면 배경에서 활용)
      code: ev.code,
      repeat: !!ev.repeat,
      ctrl: !!ev.ctrlKey, alt: !!ev.altKey, shift: !!ev.shiftKey, meta: !!ev.metaKey
    });
    if (outKeys.length >= 200) flush("KEYS");

    // 2) remember Process timing
    if (ev.type === "keydown" && ev.key === "Process") {
      lastProcessTs = Date.now();
    }

    // 3) jamo capture (옵션)
    if (EMIT_JAMO && ev.type === "keydown" && (ev.isComposing || processActive())) {
      const j = codeToJamo(ev.code, ev.shiftKey);
      if (j) {
        outJamo.push({ ...base, type: "jamo", key: j, code: ev.code, shift: !!ev.shiftKey });
        if (outJamo.length >= 120) flush("JAMO");
      }
    }
  }
  addEventListener("keydown", onKey, true);
  addEventListener("keyup",   onKey, true);

  // ----- composition / input -----
  addEventListener("compositionstart", (e) => {
    outComps.push({ ...nowRec(), type: "compstart",  key: e.data ?? "" });
    if (outComps.length >= 80) flush("COMP");
  }, true);

  addEventListener("compositionupdate", (e) => {
    outComps.push({ ...nowRec(), type: "compupdate", key: e.data ?? "" });
    if (outComps.length >= 80) flush("COMP");
  }, true);

  addEventListener("compositionend", (e) => {
    const r = nowRec(); const s = e.data ?? "";
    outComps.push({ ...r, type: "compend", key: s });
    if (s) outTexts.push({ ...r, type: "text", key: s });
    flush("COMP");
    if (outTexts.length >= 80) flush("TEXT");
  }, true);

  addEventListener("input", (e) => {
    try {
      if ((e.inputType || "").startsWith("insert")) {
        const s = typeof e.data === "string" ? e.data : "";
        if (s) { outTexts.push({ ...nowRec(), type: "text", key: s }); if (outTexts.length >= 80) flush("TEXT"); }
      }
    } catch {}
  }, true);

  // ----- lifecycle (unload/beforeunload 미사용) -----
  addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") {
      try { clearInterval(tmr); } catch {}
      flush("ALL");
      // 백그라운드 복귀 시 다시 타이머 시작
      try { tmr = setInterval(() => flush("ALL"), AUTO_FLUSH_MS); } catch {}
    }
  }, true);

  addEventListener("pagehide", () => {
    try { clearInterval(tmr); } catch {}
    flush("ALL");
  }, true);
})();
