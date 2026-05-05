const jsonInput = document.getElementById("jsonInput");
const imagePlacement = document.getElementById("imagePlacement");
const statusBadge = document.getElementById("statusBadge");
const progress = document.getElementById("progress");
const results = document.getElementById("results");
const startBtn = document.getElementById("startBtn");
const stopBtn = document.getElementById("stopBtn");
const copyJsonBtn = document.getElementById("copyJsonBtn");
const copyCsvBtn = document.getElementById("copyCsvBtn");
const clearBtn = document.getElementById("clearBtn");
const schedulerEnabled = document.getElementById("schedulerEnabled");
const schedulerUrl = document.getElementById("schedulerUrl");
const schedulerToken = document.getElementById("schedulerToken");
const schedulerPageId = document.getElementById("schedulerPageId");
const schedulerStatus = document.getElementById("schedulerStatus");
const schedulerStartDate = document.getElementById("schedulerStartDate");
const schedulerStartTimeSlot = document.getElementById("schedulerStartTimeSlot");

const stateKey = "dailyFejiState";
const schedulerConfigKey = "dailyFejiSchedulerConfig";

function normalizeItems(raw) {
  const parsed = JSON.parse(raw);
  const items = Array.isArray(parsed) ? parsed : [parsed];
  return items.map((item, index) => {
    if (!item || typeof item !== "object") {
      throw new Error(`Item ${index + 1} khong phai object`);
    }
    if (!item.title || !item.description) {
      throw new Error(`Item ${index + 1} thieu title hoac description`);
    }
    return {
      title: String(item.title),
      description: String(item.description),
      image: item.image ? String(item.image) : "",
      descriptionImage: item.descriptionImage ? String(item.descriptionImage) : ""
    };
  });
}

function toCsv(rows) {
  const headers = ["title", "dailyLink", "shortLink", "domain", "image", "status", "error"];
  const escape = (value) => `"${String(value ?? "").replaceAll('"', '""')}"`;
  return [headers.join(","), ...rows.map((row) => headers.map((key) => escape(row[key])).join(","))].join("\n");
}

function renderState(state) {
  const running = state?.status === "running";
  statusBadge.textContent = state?.status || "Idle";
  startBtn.disabled = running;
  stopBtn.disabled = !running;
  progress.textContent = state?.message || "";
  results.value = JSON.stringify(state?.results || [], null, 2);
}

async function loadState() {
  const data = await chrome.storage.local.get([stateKey, schedulerConfigKey]);
  renderState(data[stateKey] || { status: "idle", results: [] });
  renderSchedulerConfig(data[schedulerConfigKey] || {});
}

function todayValue() {
  return new Date().toISOString().split("T")[0];
}

function renderSchedulerConfig(config) {
  schedulerEnabled.checked = config.enabled === true;
  schedulerUrl.value = config.schedulerUrl || "";
  schedulerToken.value = config.token || "";
  schedulerPageId.value = config.pageId || "";
  schedulerStatus.value = config.status || "draft";
  schedulerStartDate.value = config.startDate || todayValue();
  schedulerStartTimeSlot.value = config.startTimeSlot || "08:00";
}

function readSchedulerConfig() {
  return {
    enabled: schedulerEnabled.checked,
    schedulerUrl: schedulerUrl.value.trim().replace(/\/+$/, ""),
    token: schedulerToken.value.trim(),
    pageId: schedulerPageId.value.trim(),
    status: schedulerStatus.value,
    startDate: schedulerStartDate.value,
    startTimeSlot: schedulerStartTimeSlot.value
  };
}

async function saveSchedulerConfig() {
  await chrome.storage.local.set({ [schedulerConfigKey]: readSchedulerConfig() });
}

startBtn.addEventListener("click", async () => {
  try {
    const items = normalizeItems(jsonInput.value);
    const schedulerConfig = readSchedulerConfig();
    await saveSchedulerConfig();
    await chrome.runtime.sendMessage({
      type: "START_BATCH",
      payload: {
        items,
        options: {
          imagePlacement: imagePlacement.value
        },
        scheduler: schedulerConfig
      }
    });
  } catch (error) {
    progress.textContent = error.message;
  }
});

stopBtn.addEventListener("click", () => {
  chrome.runtime.sendMessage({ type: "STOP_BATCH" });
});

copyJsonBtn.addEventListener("click", async () => {
  await navigator.clipboard.writeText(results.value || "[]");
});

copyCsvBtn.addEventListener("click", async () => {
  const state = (await chrome.storage.local.get(stateKey))[stateKey] || {};
  await navigator.clipboard.writeText(toCsv(state.results || []));
});

clearBtn.addEventListener("click", async () => {
  await chrome.storage.local.set({ [stateKey]: { status: "idle", message: "", results: [] } });
  await loadState();
});

[
  schedulerEnabled,
  schedulerUrl,
  schedulerToken,
  schedulerPageId,
  schedulerStatus,
  schedulerStartDate,
  schedulerStartTimeSlot
].forEach((element) => {
  element.addEventListener("change", saveSchedulerConfig);
  element.addEventListener("input", saveSchedulerConfig);
});

chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "local" && changes[stateKey]) {
    renderState(changes[stateKey].newValue);
  }
});

loadState();
