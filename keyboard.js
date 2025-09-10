(() => {
  if (window.__mouseCsvRecorderLoaded) return;
  window.__mouseCsvRecorderLoaded = true;

  // ---- 설정 로드 ----
  let enabledSampling = true;   // true -> 약 20Hz, false -> ~60Hz
  let moveThrottleMs = 50;
  let minStep2px = true;        // 2px 미만 이동 무시

  chrome.storage.local.get({ throttleMove: true, minStep2px: true }, (res) => {
    enabledSampling = !!res.throttleMove;
    moveThrottleMs = enabledSampling ? 50 : 16;
    minStep2px = !!res.minStep2px;
  });

  // ---- 안전 전송 ----
  function safeSend(msg) {
    if (!chrome || !chrome.runtime || !chrome.runtime.id) return false;
    try {
      chrome.runtime.sendMessage(msg);
      return true;
    } catch (e) {
      // 확장 리로드 후 구스크립트의 전송 시 여기로 들어옴
      detachAll();
      return false;
    }
  }

  // ---- 누적/상태 ----
  let lastX = null, lastY = null, lastMoveTs = 0;
  let cumScroll = 0;

  function pushMove(e) {
    const now = performance.now();
    if (enabledSampling && (now - lastMoveTs) < moveThrottleMs) return;

    const x = e.clientX;
    const y = e.clientY;

    let speed = "";
    if (lastX !== null && lastY !== null) {
      const dx = x - lastX;
      const dy = y - lastY;
      const dist = Math.hypot(dx, dy);
      if (minStep2px && dist < 2) return; // 너무 작은 흔들림 무시
      speed = dist.toFixed(2);
    }

    lastMoveTs = now;
    lastX = x; lastY = y;

    // move: x, y, speed_per_step 만 채움
    safeSend({ kind: 'MOUSE', payload: { x, y, speed_per_step: speed } }) ||
      safeSend({ type: 'MOUSE_EVENT', payload: { x, y, speed_per_step: speed } }); // 구버전 호환(선택)
  }

  function pushClick(e) {
    let button = '';
    if (e.button === 0) button = 'l';
    else if (e.button === 1) button = 'm';
    else if (e.button === 2) button = 'r';

    // click: button + 클릭 순간 좌표
    safeSend({ kind: 'MOUSE', payload: { button, x: e.clientX, y: e.clientY } }) ||
      safeSend({ type: 'MOUSE_EVENT', payload: { button, x: e.clientX, y: e.clientY } });
  }

  function pushWheel(e) {
    // amount: 위 + / 아래 - (deltaY 기준), cum_scroll: 세션 누적
    const amount = -e.deltaY;
    cumScroll += amount;

    safeSend({ kind: 'MOUSE', payload: { amount: Math.round(amount), cum_scroll: Math.round(cumScroll) } }) ||
      safeSend({ type: 'MOUSE_EVENT', payload: { amount: Math.round(amount), cum_scroll: Math.round(cumScroll) } });
  }

  function onMouseMove(e){ try{ pushMove(e); }catch{} }
  function onMouseDown(e){ try{ pushClick(e);}catch{} }
  function onWheel(e){ try{ pushWheel(e);}catch{} }

  function detachAll() {
    try { window.removeEventListener('mousemove', onMouseMove, { passive: true }); } catch {}
    try { window.removeEventListener('mousedown', onMouseDown, { passive: true }); } catch {}
    try { window.removeEventListener('wheel', onWheel, { passive: true }); } catch {}
  }

  window.addEventListener('mousemove', onMouseMove, { passive: true });
  window.addEventListener('mousedown', onMouseDown, { passive: true });
  window.addEventListener('wheel', onWheel, { passive: true });

  window.addEventListener('beforeunload', () => { cumScroll = 0; });
})();
