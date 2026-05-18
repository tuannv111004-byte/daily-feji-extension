window.addEventListener("message", (event) => {
  if (event.source !== window) return;
  if (event.data?.type !== "POSTOPS_START_DAILY_FEJI") return;

  chrome.runtime.sendMessage(
    {
      type: "START_BATCH",
      payload: event.data.payload || {}
    },
    (response) => {
      window.postMessage(
        {
          type: "POSTOPS_DAILY_FEJI_ACK",
          ok: response?.ok === true,
          error: response?.error || ""
        },
        window.location.origin
      );
    }
  );
});
