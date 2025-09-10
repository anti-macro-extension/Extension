// === background.js (MV3 service worker-safe) ===

<<<<<<< HEAD
// 버퍼: CSV 행 그대로 만들 수 있도록 "통합 6컬럼" 구조로 누적
// 각 이벤트는 필요한 필드만 채우고 나머지는 빈칸으로 둡니다.
let rows = []; // [x, y, speed_per_step, button, amount, cum_scroll]
=======
// 버퍼
const keyBuf = [];        // {timestamp, key, type}  // type: 'keydown'|'keyup'|'text'
const mousePosBuf = [];   // {timestamp, x, y, t, type, speed_per_step, button, amount, cum_scroll}
>>>>>>> 464215f (feature/mouse)

// 팝업 카운트 갱신
function notifyCount() {
  try { chrome.runtime.sendMessage({ type: 'COUNT_UPDATE', count: rows.length }); } catch {}
}

// CSV 유틸
const CSV_HEADER = ['x','y','speed_per_step','button','amount','cum_scroll'];

function escCSV(val) {
  if (val == null) return '';
  const s = String(val);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g,'""')}"` : s;
}
function toCSVLine(arr) { return arr.map(escCSV).join(','); }

function makeCSVRows() {
  const out = [toCSVLine(CSV_HEADER)];
  for (const r of rows) out.push(toCSVLine(r));
  return out;
}

// 다운로드 (data URL 사용)
function downloadCSV(filename, csvLines) {
  return new Promise((resolve, reject) => {
    try {
      const csv = csvLines.join('\n');
      const url = 'data:text/csv;charset=utf-8,' + encodeURIComponent(csv);
      chrome.downloads.download({ url, filename, saveAs: true }, (id) => {
        const err = chrome.runtime.lastError?.message;
        if (err) {
          console.error('[bg] downloads.download error:', err);
          reject(new Error(err));
        } else {
          console.log('[bg] download started:', id);
          resolve({ id });
        }
      });
    } catch (e) {
      reject(e);
    }
  });
}

<<<<<<< HEAD
// 행 추가
function pushRow(payload = {}) {
  const row = [
    payload.x ?? '',
    payload.y ?? '',
    payload.speed_per_step ?? '',
    payload.button ?? '',
    payload.amount ?? '',
    payload.cum_scroll ?? ''
  ];
  rows.push(row);
  notifyCount();
=======
// 키 이벤트만 (keydown/keyup)
function exportKeyEventsCSV() {
  const rows = keyBuf.filter(r => r.type === "keydown" || r.type === "keyup")
                     .sort((a,b) => (a.timestamp||0)-(b.timestamp||0));
  const out = ["timestamp_ms,timestamp_iso,key,type"];
  for (const r of rows) {
    const msText = "=\"" + String(r.timestamp) + "\"";     // 엑셀 지수표기 방지
    const iso = new Date(r.timestamp || Date.now()).toISOString();
    out.push([msText, iso, escCSV(r.key), r.type].join(","));
  }
  const ts = new Date().toISOString().replace(/[:.]/g, "-");
  downloadCSV(`key_events_${ts}.csv`, out);
>>>>>>> 464215f (feature/mouse)
}

// 메시지 수신 (신/구 포맷 모두 지원)
chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  (async () => {
    try {
      // 신 포맷: kind: 'MOUSE'
      if (msg?.kind === 'MOUSE') {
        pushRow(msg.payload || {});
        return sendResponse?.({ ok: true });
      }
      // 구 포맷: type: 'MOUSE_EVENT'
      if (msg?.type === 'MOUSE_EVENT') {
        pushRow(msg.payload || {});
        return sendResponse?.({ ok: true });
      }

      if (msg?.kind === 'EXPORT_CSV') {
        const ts = new Date().toISOString().replace(/[:.]/g, '-');
        const csvLines = makeCSVRows();
        const res = await downloadCSV(`mouse_log_${ts}.csv`, csvLines);
        return sendResponse?.({ ok: true, ...res });
      }

      if (msg?.kind === 'CLEAR_DATA') {
        rows = [];
        notifyCount();
        return sendResponse?.({ ok: true });
      }
    } catch (e) {
      console.error('[bg] onMessage error:', e);
      return sendResponse?.({ ok: false, error: String(e?.message || e) });
    }
  })();
  return true; // async 응답
});

// 설치/시작 시 기존 탭에도 재주입(구스크립트 잔존 최소화)
async function reinjectAllTabs() {
  try {
    const tabs = await chrome.tabs.query({ url: ['http://*/*', 'https://*/*', 'file://*/*'] });
    for (const t of tabs) {
      try {
        await chrome.scripting.executeScript({
          target: { tabId: t.id },
          files: ['keyboard.js']
        });
      } catch {}
    }
  } catch {}
}

<<<<<<< HEAD
chrome.runtime.onInstalled.addListener(() => reinjectAllTabs());
chrome.runtime.onStartup.addListener(() => reinjectAllTabs());
=======
// 마우스 (확장된 컬럼 포함)
function exportMouseCSV() {
  const rows = [...mousePosBuf].sort((a,b) => (a.timestamp||0)-(b.timestamp||0));
  const out = ["timestamp_ms,t_ms,type,x,y,speed_per_step,button,amount,cum_scroll"];
  for (const r of rows) {
    const msText = "=\"" + String(r.timestamp) + "\"";
    const t_ms   = typeof r.t === "number" ? r.t.toFixed(3) : "";
    out.push([
      msText,
      t_ms,
      escCSV(r.type || "move"),
      escCSV(r.x),
      escCSV(r.y),
      escCSV(r.speed_per_step ?? ""),
      escCSV(r.button ?? ""),
      escCSV(r.amount ?? ""),
      escCSV(r.cum_scroll ?? "")
    ].join(","));
  }
  const ts = new Date().toISOString().replace(/[:.]/g, "-");
  downloadCSV(`mouse_positions_${ts}.csv`, out);
}
>>>>>>> 464215f (feature/mouse)
