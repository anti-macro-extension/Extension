// === mouse.js — 마우스 이동/클릭만 수집 (wheel 제외, 우/중클릭 중복 억제) ===
(() => {
  "use strict";

  // 샘플링/필터 옵션 (popup 체크박스와 연동)
  let THROTTLE_MS = 50;      // ~20Hz
  let IGNORE_STEP_2PX = true;

  try {
    chrome.storage?.local.get({ throttleMove: true, minStep2px: true }, (res) => {
      THROTTLE_MS     = res.throttleMove ? 50 : 0;
      IGNORE_STEP_2PX = !!res.minStep2px;
    });
    chrome.storage?.local.onChanged.addListener((chg, area) => {
      if (area !== "local") return;
      if (chg.throttleMove) THROTTLE_MS     = chg.throttleMove.newValue ? 50 : 0;
      if (chg.minStep2px)   IGNORE_STEP_2PX = !!chg.minStep2px.newValue;
    });
  } catch {}

  const hasRuntime = () => typeof chrome !== "undefined" && chrome?.runtime?.id;
  const safeSend = (payload) => {
    if (!hasRuntime()) return;
    try { chrome.runtime.sendMessage({ kind: "MOUSE", payload }, () => void chrome.runtime.lastError); } catch {}
  };

  const mapBtn = (b) => (b === 0 ? "l" : b === 1 ? "m" : b === 2 ? "r" : String(b));

  // 이동 샘플링 상태
  let lastX = null, lastY = null;
  let lastMoveTs = 0;

  function emitMove(e) {
    const now = performance.now();
    if (THROTTLE_MS > 0 && (now - lastMoveTs) < THROTTLE_MS) return;

    const x = e.clientX, y = e.clientY;
    let speed = "";

    if (lastX != null && lastY != null) {
      const dx = x - lastX, dy = y - lastY;
      const dist = Math.hypot(dx, dy);
      if (IGNORE_STEP_2PX && dist < 2) return;
      speed = Number.isFinite(dist) ? dist.toFixed(2) : "";
    }

    lastMoveTs = now; lastX = x; lastY = y;

    safeSend({
      timestamp: Date.now(),
      t: now / 1000,
      x, y,
      type: "move",
      speed_per_step: speed
    });
  }

  addEventListener("mousemove", emitMove, { passive: true, capture: true });

  // 버튼 다운/업 (참고용 이벤트)
  addEventListener("mousedown", (e) => {
    safeSend({
      timestamp: Date.now(),
      t: performance.now() / 1000,
      x: e.clientX, y: e.clientY,
      type: "down",
      button: mapBtn(e.button)
    });
  }, { passive: true, capture: true });

  addEventListener("mouseup", (e) => {
    safeSend({
      timestamp: Date.now(),
      t: performance.now() / 1000,
      x: e.clientX, y: e.clientY,
      type: "up",
      button: mapBtn(e.button)
    });
  }, { passive: true, capture: true });

  // --- 클릭 이벤트 중복 방지 규칙 ---
  // 1) 왼쪽 클릭은 click 에서만 기록 (Ctrl+Click 제외)
  // 2) 중/오른쪽은 auxclick 에서 기록
  // 3) contextmenu는 Mac의 Ctrl+Click 등 보강용.
  //    직전 auxclick(right)와 시간/거리 근접하면 무시하여 중복 억제.

  // 직전 right-auxclick 기록 (contextmenu 중복 억제용)
  let lastRightAux = { t: 0, x: 0, y: 0 };
  const DUP_TIME_MS = 120;      // 시간 임계
  const DUP_DIST_PX = 6;        // 위치 임계

  // (1) 왼쪽 클릭만 기록 (Ctrl+Click은 제외: contextmenu가 처리)
  addEventListener("click", (e) => {
    if (e.button !== 0) return;          // 주버튼만
    if (e.ctrlKey) return;               // Mac Ctrl+Click → contextmenu에서 우클릭 처리
    safeSend({
      timestamp: Date.now(),
      t: performance.now() / 1000,
      x: e.clientX, y: e.clientY,
      type: "click",
      button: "l"
    });
  }, { passive: true, capture: true });

  // (2) 중/오른쪽 클릭 기록
  addEventListener("auxclick", (e) => {
    const btn = mapBtn(e.button);
    if (btn !== "m" && btn !== "r") return;   // 비-주버튼만 처리
    const now = performance.now();

    if (btn === "r") {
      lastRightAux = { t: now, x: e.clientX, y: e.clientY };
    }

    safeSend({
      timestamp: Date.now(),
      t: now / 1000,
      x: e.clientX, y: e.clientY,
      type: "click",
      button: btn
    });
  }, { passive: true, capture: true });

  // (3) contextmenu: 우클릭 보강(특히 Mac Ctrl+Click)
  addEventListener("contextmenu", (e) => {
    const now = performance.now();

    // 직전 auxclick(right)와 매우 가깝다면 중복으로 판단하고 무시
    const dt = now - lastRightAux.t;
    const dx = e.clientX - lastRightAux.x;
    const dy = e.clientY - lastRightAux.y;
    const dist = Math.hypot(dx, dy);
    if (dt >= 0 && dt <= DUP_TIME_MS && dist <= DUP_DIST_PX) {
      return; // 이미 auxclick으로 기록됨 → 중복 억제
    }

    // Ctrl+Click 등에서 우클릭으로 기록
    safeSend({
      timestamp: Date.now(),
      t: now / 1000,
      x: e.clientX, y: e.clientY,
      type: "click",
      button: "r"
    });
    // 메뉴는 그대로 뜨게 두기 위해 preventDefault()는 호출하지 않음
  }, { passive: true, capture: true });
})();
