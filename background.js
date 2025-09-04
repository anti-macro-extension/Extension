// === background.js (MV3 service worker-safe) ===
chrome.runtime.onInstalled.addListener(() => {
  console.log("[bg] installed");
});

// 버퍼
const keyBuf = [];        // {timestamp, key, type}  // type: 'keydown'|'keyup'|'text'
const mousePosBuf = [];   // {timestamp, x, y, t}

// 메시지 수신
chrome.runtime.onMessage.addListener((msg) => {
  if (msg?.kind === "KEYS" && Array.isArray(msg.payload)) {
    keyBuf.push(...msg.payload);
  }

  if (msg?.kind === "MOUSE_POS" && Array.isArray(msg.payload)) {
    mousePosBuf.push(...msg.payload);
  }

  if (msg?.kind === "EXPORT_CSV") {
    if (msg.what === "keys")  exportKeyEventsCSV();
    if (msg.what === "text")  exportTextCommitsCSV();
    if (msg.what === "mouse") exportMouseCSV();
  }

  if (msg?.kind === "CLEAR_BUFFERS") {
    keyBuf.length = 0;
    mousePosBuf.length = 0;
    console.log("[bg] buffers cleared");
  }
});

// 유틸
function escCSV(val) {
  if (val == null) return "";
  const s = String(val);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

// 서비스워커 호환: data URL로 다운로드
function downloadCSV(filename, rows) {
  const csv = rows.join("\n");
  const url = "data:text/csv;charset=utf-8," + encodeURIComponent(csv);
  chrome.downloads.download({ url, filename, saveAs: true }, (id) => {
    if (chrome.runtime.lastError) {
      console.error("downloads.download error:", chrome.runtime.lastError.message);
    } else {
      console.log("download started:", id);
    }
  });
}

// 키 이벤트만 (keydown/keyup)
function exportKeyEventsCSV() {
  const rows = keyBuf.filter(r => r.type === "keydown" || r.type === "keyup")
                     .sort((a,b) => (a.timestamp||0)-(b.timestamp||0));
  const out = ["timestamp_ms,timestamp_iso,key,type"];
  for (const r of rows) {
    const msText = "=\"" + String(r.timestamp) + "\"";     // 엑셀 지수표기 방지(텍스트)
    const iso = new Date(r.timestamp || Date.now()).toISOString();
    out.push([msText, iso, escCSV(r.key), r.type].join(","));
  }
  const ts = new Date().toISOString().replace(/[:.]/g, "-");
  downloadCSV(`key_events_${ts}.csv`, out);
}

// 커밋된 텍스트만 (IME 포함)
function exportTextCommitsCSV() {
  const rows = keyBuf.filter(r => r.type === "text")
                     .sort((a,b) => (a.timestamp||0)-(b.timestamp||0));
  const out = ["timestamp_ms,timestamp_iso,text"];
  for (const r of rows) {
    const msText = "=\"" + String(r.timestamp) + "\"";
    const iso = new Date(r.timestamp || Date.now()).toISOString();
    out.push([msText, iso, escCSV(r.key)].join(","));
  }
  const ts = new Date().toISOString().replace(/[:.]/g, "-");
  downloadCSV(`text_commits_${ts}.csv`, out);
}

// 마우스 좌표(위치만)
function exportMouseCSV() {
  const rows = [...mousePosBuf].sort((a,b) => (a.timestamp||0)-(b.timestamp||0));
  const out = ["timestamp_ms,t_ms,x,y"];
  for (const r of rows) {
    const msText = "=\"" + String(r.timestamp) + "\""; // 엑셀 텍스트
    out.push([msText, typeof r.t === "number" ? r.t.toFixed(3) : "", escCSV(r.x), escCSV(r.y)].join(","));
  }
  const ts = new Date().toISOString().replace(/[:.]/g, "-");
  downloadCSV(`mouse_positions_${ts}.csv`, out);
}
