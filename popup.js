<<<<<<< HEAD
const exportBtn = document.getElementById('exportBtn');
const clearBtn = document.getElementById('clearBtn');
const throttleMoveEl = document.getElementById('throttleMove');
const minStepEl = document.getElementById('minStep');
const countEl = document.getElementById('eventCount');

function sendMessage(msg, cb) {
  if (!chrome?.runtime?.id) {
    alert("확장 컨텍스트가 아닙니다. 툴바 팝업 또는 옵션 페이지로 열어주세요.");
    return;
  }
  chrome.runtime.sendMessage(msg, (resp) => {
    const err = chrome.runtime.lastError?.message;
    if (err) {
      alert("메시지 오류: " + err);
=======
// popup.html 전용 — 버튼 wiring
(function(){
  function send(kind, payload){
    if (!chrome?.runtime?.id) {
      alert("확장 컨텍스트가 아닙니다. 툴바 팝업으로 열어주세요.");
>>>>>>> 464215f (feature/mouse)
      return;
    }
    cb && cb(resp);
  });
}

// 초기 설정 로드
chrome.storage.local.get({ throttleMove: true, minStep2px: true }, (res) => {
  throttleMoveEl.checked = !!res.throttleMove;
  minStepEl.checked = !!res.minStep2px;
});

throttleMoveEl.addEventListener('change', () => {
  chrome.storage.local.set({ throttleMove: !!throttleMoveEl.checked });
});
minStepEl.addEventListener('change', () => {
  chrome.storage.local.set({ minStep2px: !!minStepEl.checked });
});

exportBtn.addEventListener('click', () => {
  sendMessage({ kind: 'EXPORT_CSV' }, (resp) => {
    if (!resp?.ok) alert("다운로드 실패: " + (resp?.error || "알 수 없는 오류"));
  });
});

clearBtn.addEventListener('click', () => {
  sendMessage({ kind: 'CLEAR_DATA' }, () => {
    countEl.textContent = '0';
  });
});

// 카운트 갱신 수신
chrome.runtime.onMessage.addListener((msg) => {
  if (msg?.type === 'COUNT_UPDATE') {
    countEl.textContent = String(msg.count || 0);
  }
});
