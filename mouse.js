// === mouse.js — 마우스 이동/클릭/휠 배치 수집 → MOUSE_POS로 전송 ===
(() => {
  const BUF_MAX  = 64;
  const FLUSH_MS = 200;

  // 옵션(친구 팝업엔 없지만, 필요시 storage로 넣기 쉬운 형태)
  const THROTTLE_MS = 50;   // ~20Hz 샘플링
  const IGNORE_STEP_2PX = true;

  const buf = [];
  let lastX = null, lastY = null, lastMoveTs = 0;
  let cumScroll = 0;

  function push(row) {
    buf.push(row);
    if (buf.length >= BUF_MAX) flush();
  }
  function flush() {
    if (!buf.length) return;
    const batch = buf.splice(0);
    // 친구 코드 프로토콜: kind: 'MOUSE_POS', payload: Array<row>
    try { chrome.runtime.sendMessage({ kind: 'MOUSE_POS', payload: batch }); } catch {}
  }

  function onMove(e) {
    const now = performance.now();
    if (now - lastMoveTs < THROTTLE_MS) return;

    const x = e.clientX, y = e.clientY;
    let speed = "";
    if (lastX != null && lastY != null) {
      const dx = x - lastX, dy = y - lastY;
      const dist = Math.hypot(dx, dy);
      if (IGNORE_STEP_2PX && dist < 2) return;
      speed = Number.isFinite(dist) ? dist.toFixed(2) : "";
    }
    lastMoveTs = now; lastX = x; lastY = y;

    push({
      timestamp: Date.now(),
      t: now / 1000,       // 상대 초(참고용)
      x, y,
      type: "move",
      speed_per_step: speed
    });
  }

  function onDown(e) {
    push({
      timestamp: Date.now(),
      t: performance.now() / 1000,
      x: e.clientX, y: e.clientY,
      type: "down",
      button: e.button === 0 ? "l" : e.button === 1 ? "m" : e.button === 2 ? "r" : String(e.button)
    });
  }

  function onUp(e) {
    push({
      timestamp: Date.now(),
      t: performance.now() / 1000,
      x: e.clientX, y: e.clientY,
      type: "up",
      button: e.button === 0 ? "l" : e.button === 1 ? "m" : e.button === 2 ? "r" : String(e.button)
    });
  }

  function onClick(e) {
    push({
      timestamp: Date.now(),
      t: performance.now() / 1000,
      x: e.clientX, y: e.clientY,
      type: "click",
      button: e.button === 0 ? "l" : e.button === 1 ? "m" : e.button === 2 ? "r" : String(e.button)
    });
  }

  function onWheel(e) {
    const amount = -e.deltaY;        // 위 + / 아래 -
    cumScroll += amount;
    push({
      timestamp: Date.now(),
      t: performance.now() / 1000,
      type: "wheel",
      amount: Math.round(amount),
      cum_scroll: Math.round(cumScroll)
    });
  }

  addEventListener("mousemove", onMove, { passive: true });
  addEventListener("mousedown", onDown, { passive: true });
  addEventListener("mouseup",   onUp,   { passive: true });
  addEventListener("click",     onClick,{ passive: true });
  addEventListener("wheel",     onWheel,{ passive: true });

  const timer = setInterval(flush, FLUSH_MS);
  addEventListener("pagehide", flush);
  addEventListener("beforeunload", flush);
  addEventListener("unload", () => clearInterval(timer));
})();
