// === popup.js (fixed ids + proper messages) ===

// HTML 요소 연결 (HTML과 동일한 id 사용)
const expMouseBtn   = document.getElementById('expMouse');
const expKeysBtn    = document.getElementById('expKeys');
const expTextBtn    = document.getElementById('expText');
const clearBtn      = document.getElementById('clear');

const throttleMoveEl = document.getElementById('throttleMove');
const minStepEl      = document.getElementById('minStep');
const countEl        = document.getElementById('eventCount');
const statusEl       = document.getElementById('status');

function sendMessage(msg, cb) {
  if (!chrome?.runtime?.id) {
    alert("확장 컨텍스트가 아닙니다. 툴바 팝업 또는 옵션 페이지로 열어주세요.");
    return;
  }
  chrome.runtime.sendMessage(msg, (resp) => {
    const err = chrome.runtime.lastError?.message;
    if (err) {
      alert("메시지 오류: " + err);
      return;
    }
    cb && cb(resp);
  });
}

// ----- 옵션(마우스) : 기존 동작 유지 -----
chrome.storage.local.get({ throttleMove: true, minStep2px: true }, (res) => {
  if (throttleMoveEl) throttleMoveEl.checked = !!res.throttleMove;
  if (minStepEl)      minStepEl.checked      = !!res.minStep2px;
});

throttleMoveEl?.addEventListener('change', () => {
  chrome.storage.local.set({ throttleMove: !!throttleMoveEl.checked });
});
minStepEl?.addEventListener('change', () => {
  chrome.storage.local.set({ minStep2px: !!minStepEl.checked });
});

// ----- 내보내기 버튼들 -----

// 마우스 CSV (그대로)
expMouseBtn?.addEventListener('click', () => {
  sendMessage({ kind: 'EXPORT_CSV', what: 'mouse' }, (resp) => {
    if (!resp?.ok && resp?.ok !== undefined) {
      alert("다운로드 실패: " + (resp?.error || "알 수 없는 오류"));
    }
  });
});

// 키 이벤트 CSV (keydown/keyup) — background.js의 exportKeyEventsCSV와 매칭
expKeysBtn?.addEventListener('click', () => {
  // 필요하면 hideProcess 옵션을 추가로 넣을 수 있음: { hideProcess: true }
  sendMessage({ kind: 'EXPORT_CSV', what: 'keys' }, (resp) => {
    if (!resp?.ok && resp?.ok !== undefined) {
      alert("다운로드 실패: " + (resp?.error || "알 수 없는 오류"));
    }
  });
});

// 텍스트 커밋 CSV (IME 확정 문자) — exportTextCommitsCSV와 매칭
expTextBtn?.addEventListener('click', () => {
  sendMessage({ kind: 'EXPORT_CSV', what: 'text' }, (resp) => {
    if (!resp?.ok && resp?.ok !== undefined) {
      alert("다운로드 실패: " + (resp?.error || "알 수 없는 오류"));
    }
  });
});

// 버퍼 비우기 — background.js의 CLEAR_BUFFERS와 매칭
clearBtn?.addEventListener('click', () => {
  sendMessage({ kind: 'CLEAR_BUFFERS' }, () => {
    if (countEl) countEl.textContent = '0';
    if (statusEl) statusEl.textContent = '버퍼 초기화 완료';
  });
});

// ----- 카운트 갱신 수신 (선택) -----
chrome.runtime.onMessage.addListener((msg) => {
  if (msg?.type === 'COUNT_UPDATE') {
    if (countEl) countEl.textContent = String(msg.count || 0);
  }
});