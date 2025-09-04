// popup.html 전용 — 버튼 wiring
(function(){
  function send(kind, payload){
    if (!chrome?.runtime?.id) {
      alert("확장 컨텍스트가 아닙니다. 툴바 팝업 또는 옵션 페이지로 열어주세요.");
      return;
    }
    chrome.runtime.sendMessage({ kind, ...payload });
  }
  document.getElementById("expMouse").addEventListener("click", () => send("EXPORT_CSV", { what: "mouse" }));
  document.getElementById("expKeys").addEventListener("click",  () => send("EXPORT_CSV", { what: "keys"  }));
  document.getElementById("expText").addEventListener("click",  () => send("EXPORT_CSV", { what: "text"  }));
  document.getElementById("clear").addEventListener("click",    () => send("CLEAR_BUFFERS"));
})();
