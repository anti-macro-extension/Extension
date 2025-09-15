
const keyBuf = [];        // { timestamp_ms|timestamp, timestamp_iso?, key, type, code? ... }
const mousePosBuf = [];   // { timestamp_ms|timestamp, t, x, y, type, ... }

function escCSV(v){
  if (v == null) return "";
  const s = String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g,'""')}"` : s;
}
function getMs(r){
  if (typeof r.timestamp_ms === "number") return r.timestamp_ms;
  if (typeof r.timestamp === "number")    return r.timestamp;
  return NaN;
}
function getIso(r){
  if (typeof r.timestamp_iso === "string" && r.timestamp_iso) return r.timestamp_iso;
  const ms = getMs(r);
  return Number.isFinite(ms) ? new Date(ms).toISOString() : new Date().toISOString();
}
function cpHex(s){
  if (!s) return "";
  return [...String(s)]
    .map(ch => "U+" + ch.codePointAt(0).toString(16).toUpperCase().padStart(4,"0"))
    .join(" ");
}
function notifyCount(){
  try { chrome.runtime.sendMessage({ type: "COUNT_UPDATE", count: mousePosBuf.length }); } catch {}
}

function downloadCSV(filename, lines){
  try{
    const CRLF = "\r\n";
    const text = ["sep=,", ...lines].join(CRLF); // CRLF 줄바꿈

    // UTF-16LE 바이트(FF FE BOM 포함) → base64 data URL
    const bytes = toUtf16LEBytes(text);
    const b64   = bytesToBase64(bytes);
    const url   = "data:text/csv;charset=utf-16le;base64," + b64;

    chrome.downloads.download({ url, filename, saveAs: true }, id=>{
      const err = chrome.runtime.lastError?.message;
      if (err) console.error("[bg] downloads.download error:", err);
      else     console.log("[bg] download started:", id);
    });
  }catch(e){
    console.error("[bg] downloadCSV error:", e);
  }
}
function toUtf16LEBytes(str){
  const out = new Uint8Array(2 + str.length * 2);
  out[0] = 0xFF; out[1] = 0xFE; // BOM
  let o = 2;
  for (let i = 0; i < str.length; i++){
    const c = str.charCodeAt(i);   // JS는 UTF-16 코드유닛
    out[o++] =  c        & 0xFF;   // LE: low byte
    out[o++] = (c >>> 8) & 0xFF;   //     high byte
  }
  return out;
}
function bytesToBase64(u8){
  let bin = "";
  const CHUNK = 0x8000;
  for (let i = 0; i < u8.length; i += CHUNK){
    bin += String.fromCharCode.apply(null, u8.subarray(i, i + CHUNK));
  }
  return btoa(bin);
}


function exportKeyEventsCSV(){
  const rows = keyBuf
    .filter(r => r.type === "keydown" || r.type === "keyup") 
    .sort((a,b) => (getMs(a)||0) - (getMs(b)||0));

  const out = ["timestamp_ms,timestamp_iso,key,type"];
  for (const r of rows){
    const ms  = getMs(r);
    const iso = getIso(r);
    out.push([
      Number.isFinite(ms) ? `="${ms}"` : "",
      iso,
      escCSV(r.key ?? ""),
      escCSV(r.type ?? "")
    ].join(","));
  }
  const ts = new Date().toISOString().replace(/[:.]/g,"-");
  downloadCSV(`key_events_${ts}.csv`, out);
}


function exportTextCommitsCSV(){
  const rows = keyBuf
    .filter(r => r.type === "text")
    .sort((a,b) => (getMs(a)||0) - (getMs(b)||0));

  const out = ["timestamp_ms,timestamp_iso,text"];
  for (const r of rows){
    const ms  = getMs(r);
    const iso = getIso(r);
    out.push([
      Number.isFinite(ms) ? `="${ms}"` : "",
      iso,
      escCSV(r.key ?? "")
    ].join(","));
  }
  const ts = new Date().toISOString().replace(/[:.]/g,"-");
  downloadCSV(`text_commits_${ts}.csv`, out);
}


// function exportMouseCSV(){
//   const rows = [...mousePosBuf].sort((a,b) => (getMs(a)||0) - (getMs(b)||0));
//   const out = ["timestamp_ms,t_ms,type,x,y,speed_per_step,button,amount,cum_scroll"];
//   for (const r of rows){
//     const ms   = getMs(r);
//     const tms  = typeof r.t === "number" ? r.t.toFixed(3) : "";
//     out.push([
//       Number.isFinite(ms) ? `="${ms}"` : "",
//       tms,
//       escCSV(r.type || "move"),
//       escCSV(r.x),
//       escCSV(r.y),
//       escCSV(r.speed_per_step ?? ""),
//       escCSV(r.button ?? ""),
//       escCSV(r.amount ?? ""),
//       escCSV(r.cum_scroll ?? "")
//     ].join(","));
//   }
//   const ts = new Date().toISOString().replace(/[:.]/g,"-");
//   downloadCSV(`mouse_positions_${ts}.csv`, out);
// }


chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  try{

    if (msg?.kind === "MOUSE" || msg?.type === "MOUSE_EVENT"){
      if (msg.payload) mousePosBuf.push(msg.payload);
      notifyCount();
      sendResponse?.({ ok: true });
      return true;
    }

    if (msg?.kind === "KEYS" && Array.isArray(msg.payload)){
      keyBuf.push(...msg.payload);
      sendResponse?.({ ok: true });
      return true;
    }

    if (msg?.kind === "EXPORT_CSV"){
      sendResponse?.({ ok: true }); 
      if (msg.what === "mouse") exportMouseCSV();
      else if (msg.what === "keys") exportKeyEventsCSV();   
      else if (msg.what === "text") exportTextCommitsCSV();
      else exportMouseCSV();
      return true;
    }


    if (msg?.kind === "CLEAR_BUFFERS" || msg?.kind === "CLEAR_DATA"){
      keyBuf.length = 0;
      mousePosBuf.length = 0;
      notifyCount();
      sendResponse?.({ ok: true });
      return true;
    }
  }catch(e){
    console.error("[bg] onMessage error:", e);
    try{ sendResponse?.({ ok:false, error:String(e?.message || e) }); }catch{}
    return true;
  }
  return false;
});


chrome.runtime.onInstalled.addListener(() => {
  reinjectAllTabs().catch(()=>{});
});
async function reinjectAllTabs(){
  try{
    const tabs = await chrome.tabs.query({ url: ["http://*/*","https://*/*","file://*/*"] });
    for (const t of tabs){
      try{
        await chrome.scripting.executeScript({ target: { tabId: t.id }, files: ["keyboard.js"] });
      }catch{}
    }
  }catch{}
}
