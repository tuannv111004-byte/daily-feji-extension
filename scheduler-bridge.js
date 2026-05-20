function postAck(ok, error = "") {
  window.postMessage(
    {
      type: "POSTOPS_DAILY_FEJI_ACK",
      ok,
      error
    },
    window.location.origin
  );
}

window.postMessage(
  {
    type: "POSTOPS_DAILY_FEJI_BRIDGE_READY",
    version: chrome.runtime?.getManifest?.().version || ""
  },
  window.location.origin
);

window.addEventListener("message", (event) => {
  if (event.source !== window) return;
  if (event.data?.type === "POSTOPS_DAILY_FEJI_PING") {
    window.postMessage(
      {
        type: "POSTOPS_DAILY_FEJI_PONG",
        version: chrome.runtime?.getManifest?.().version || ""
      },
      window.location.origin
    );
    return;
  }

  if (event.data?.type !== "POSTOPS_START_DAILY_FEJI") return;

  if (typeof chrome === "undefined" || !chrome.runtime?.id) {
    postAck(false, "Extension runtime is not available. Reload the extension and this page.");
    return;
  }

  try {
    chrome.runtime.sendMessage(
      {
        type: "START_BATCH",
        payload: event.data.payload || {}
      },
      (response) => {
        const runtimeError = chrome.runtime.lastError?.message || "";
        if (runtimeError) {
          postAck(false, runtimeError);
          return;
        }

        postAck(response?.ok === true, response?.error || "");
      }
    );
  } catch (error) {
    postAck(false, error?.message || "Cannot send message to extension background.");
  }
});
