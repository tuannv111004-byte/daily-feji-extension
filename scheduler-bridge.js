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

function getRuntime() {
  try {
    if (typeof chrome === "undefined" || !chrome.runtime?.id) return null;
    return chrome.runtime;
  } catch {
    return null;
  }
}

function getExtensionVersion() {
  try {
    return getRuntime()?.getManifest?.().version || "";
  } catch {
    return "";
  }
}

window.postMessage(
  {
    type: "POSTOPS_DAILY_FEJI_BRIDGE_READY",
    version: getExtensionVersion()
  },
  window.location.origin
);

window.addEventListener("message", (event) => {
  if (event.source !== window) return;
  if (event.data?.type === "POSTOPS_DAILY_FEJI_PING") {
    window.postMessage(
      {
        type: "POSTOPS_DAILY_FEJI_PONG",
        version: getExtensionVersion()
      },
      window.location.origin
    );
    return;
  }

  if (event.data?.type !== "POSTOPS_START_DAILY_FEJI") return;

  const runtime = getRuntime();
  if (!runtime) {
    postAck(false, "Extension runtime is not available. Reload the extension and this page.");
    return;
  }

  try {
    runtime.sendMessage(
      {
        type: "START_BATCH",
        payload: event.data.payload || {}
      },
      (response) => {
        const runtimeError = runtime.lastError?.message || "";
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
