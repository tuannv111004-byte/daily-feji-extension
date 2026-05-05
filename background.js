const DAILY_URL = "https://dailychronicle.cfx.bz/backend/posts";
const FEJI_CREATE_URL = "https://s.feji.io/app/links/create";
const FEJI_LIST_URL = "https://s.feji.io/app/links?page=1";
const STATE_KEY = "dailyFejiState";
const DOMAIN_RULE = [
  "headlinebriefs.com",
  "greendailys.com",
  "greenwnbas.com",
  "wnbatime.us"
];

let stopRequested = false;
let running = false;

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === "START_BATCH") {
    if (!running) {
      runBatch(message.payload).catch((error) => {
        setState({ status: "error", message: error.message });
        running = false;
      });
    }
    sendResponse({ ok: true });
    return true;
  }

  if (message?.type === "STOP_BATCH") {
    stopRequested = true;
    setState({ status: "stopping", message: "Đang dừng sau bước hiện tại..." });
    sendResponse({ ok: true });
    return true;
  }

  return false;
});

async function runBatch(payload) {
  running = true;
  stopRequested = false;
  const items = payload.items || [];
  const options = payload.options || {};
  const results = [];

  await setState({ status: "running", message: `Chuẩn bị chạy ${items.length} bài...`, results });

  const dailyTab = await getOrCreateTab(DAILY_URL, "dailychronicle.cfx.bz");
  await waitForTabComplete(dailyTab.id);

  for (let i = 0; i < items.length; i += 1) {
    if (stopRequested) break;
    const item = items[i];
    const row = {
      title: item.title,
      image: item.image || "",
      dailyLink: "",
      shortLink: "",
      domain: "",
      status: "running",
      error: ""
    };
    results.push(row);

    try {
      await setState({
        status: "running",
        message: `[${i + 1}/${items.length}] Tạo Daily post: ${item.title}`,
        results
      });

      row.dailyLink = await createDailyPost(dailyTab.id, item, options);
      row.domain = domainForNow();

      await setState({
        status: "running",
        message: `[${i + 1}/${items.length}] Tạo Feji link: ${row.dailyLink}`,
        results
      });

      row.shortLink = await createFejiLink(item, row.dailyLink, row.domain);
      row.status = "done";
    } catch (error) {
      row.status = "error";
      row.error = error.message;
    }

    await setState({
      status: stopRequested ? "stopping" : "running",
      message: `[${i + 1}/${items.length}] ${row.status}: ${item.title}`,
      results
    });
  }

  await setState({
    status: stopRequested ? "stopped" : "done",
    message: stopRequested ? "Đã dừng." : `Hoàn tất ${results.filter((r) => r.status === "done").length}/${items.length} bài.`,
    results
  });
  running = false;
}

async function setState(patch) {
  const current = (await chrome.storage.local.get(STATE_KEY))[STATE_KEY] || {};
  await chrome.storage.local.set({ [STATE_KEY]: { ...current, ...patch } });
}

function domainForNow(date = new Date()) {
  const quarter = Math.min(3, Math.floor(date.getMinutes() / 15));
  return DOMAIN_RULE[quarter];
}

async function getOrCreateTab(url, host) {
  const tabs = await chrome.tabs.query({});
  const existing = tabs.find((tab) => {
    try {
      return new URL(tab.url || "").host === host;
    } catch {
      return false;
    }
  });

  if (existing) {
    await chrome.tabs.update(existing.id, { url, active: true });
    await waitForTabComplete(existing.id);
    return existing;
  }

  return chrome.tabs.create({ url, active: true });
}

async function navigateTab(tabId, url) {
  await chrome.tabs.update(tabId, { url, active: true });
  await waitForTabComplete(tabId);
}

function waitForTabComplete(tabId, timeoutMs = 45000) {
  return new Promise((resolve, reject) => {
    const started = Date.now();
    const timer = setInterval(async () => {
      try {
        const tab = await chrome.tabs.get(tabId);
        if (tab.status === "complete") {
          clearInterval(timer);
          resolve();
        } else if (Date.now() - started > timeoutMs) {
          clearInterval(timer);
          reject(new Error("Trang tải quá lâu"));
        }
      } catch (error) {
        clearInterval(timer);
        reject(error);
      }
    }, 300);
  });
}

async function execute(tabId, func, args = []) {
  const [result] = await chrome.scripting.executeScript({
    target: { tabId },
    func,
    args
  });

  if (result?.result?.ok === false) {
    throw new Error(result.result.error);
  }

  return result?.result?.value;
}

async function createDailyPost(tabId, item, options) {
  await navigateTab(tabId, DAILY_URL);
  return execute(tabId, dailyCreatePostScript, [item, options]);
}

async function createFejiLink(item, dailyLink, domain) {
  const tab = await chrome.tabs.create({ url: FEJI_CREATE_URL, active: false });
  try {
    await waitForTabComplete(tab.id);
    await execute(tab.id, fejiFillAndSubmitScript, [item, dailyLink, domain]);
    await delay(2500);
    await waitForTabComplete(tab.id, 45000);

    const searchUrl = `${FEJI_LIST_URL}&link=${encodeURIComponent(dailyLink)}`;
    await navigateTab(tab.id, searchUrl);
    const shortLink = await execute(tab.id, fejiFindShortLinkScript, [dailyLink, domain]);
    await chrome.tabs.remove(tab.id);
    return shortLink;
  } catch (error) {
    try {
      await chrome.tabs.remove(tab.id);
    } catch {
      // Tab may already be closed.
    }
    throw error;
  }
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function dailyCreatePostScript(item, options) {
  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  const normalize = (value) => String(value || "").trim().replace(/\s+/g, " ");
  const fire = (element) => {
    element.dispatchEvent(new Event("input", { bubbles: true }));
    element.dispatchEvent(new Event("change", { bubbles: true }));
  };
  const setValue = (selector, value) => {
    const element = document.querySelector(selector);
    if (!element) return false;
    element.focus();
    element.value = value || "";
    fire(element);
    return true;
  };
  const stripHtml = (html) => {
    const div = document.createElement("div");
    div.innerHTML = html || "";
    return normalize(div.textContent || "");
  };
  const escapeHtmlAttribute = (value) => String(value)
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
  const buildDescriptionHtml = () => {
    const description = String(item.description || "");
    const placement = options.imagePlacement || (options.prependImageToDescription ? "top" : "none");
    const imageUrl = String(item.descriptionImage || item.image || "").trim();
    if (placement === "none" || !imageUrl || /<img\b/i.test(description)) {
      return description;
    }

    const imageHtml = `<p><img src="${escapeHtmlAttribute(imageUrl)}" alt=""></p>`;
    if (placement === "top") {
      return `${imageHtml}${description}`;
    }

    const container = document.createElement("div");
    container.innerHTML = description;
    const paragraphs = [...container.querySelectorAll("p")];
    if (paragraphs.length < 3) {
      return `${description}${imageHtml}`;
    }

    const minIndex = 1;
    const maxIndex = Math.max(minIndex, paragraphs.length - 2);
    const insertAfterIndex = minIndex + Math.floor(Math.random() * (maxIndex - minIndex + 1));
    paragraphs[insertAfterIndex].insertAdjacentHTML("afterend", imageHtml);
    return container.innerHTML;
  };
  const descriptionHtml = buildDescriptionHtml();
  const existingUrls = new Set(
    [...document.querySelectorAll("button.copy-btn[data-url]")].map((button) => button.dataset.url)
  );

  try {
    setValue('input[wire\\:model\\.defer="image"], input.image-url', item.image || "");
    if (!setValue("#title", item.title)) throw new Error("Không tìm thấy field title Daily");
    setValue("#slug", "");
    setValue("#seo_title", item.title);
    setValue("#seo_description", "");

    const textarea = document.querySelector("#description-editor");
    if (!textarea) throw new Error("Không tìm thấy description editor Daily");
    textarea.value = descriptionHtml;
    fire(textarea);

    if (window.tinymce?.get("description-editor")) {
      const editor = window.tinymce.get("description-editor");
      editor.setContent(descriptionHtml);
      editor.save();
      editor.fire("change");
      editor.fire("input");
    }
    const iframeBody = document.querySelector("#description-editor_ifr")?.contentDocument?.body;
    if (iframeBody) {
      iframeBody.innerHTML = descriptionHtml;
      iframeBody.dispatchEvent(new Event("input", { bubbles: true }));
      iframeBody.dispatchEvent(new Event("change", { bubbles: true }));
      textarea.value = descriptionHtml;
      fire(textarea);
    }
    if (window.CKEDITOR?.instances?.["description-editor"]) {
      window.CKEDITOR.instances["description-editor"].setData(descriptionHtml);
    }
    const editable = textarea.closest(".col-12")?.querySelector('[contenteditable="true"]') || document.querySelector('[contenteditable="true"]');
    if (editable) {
      editable.innerHTML = descriptionHtml;
      fire(editable);
    }

    const saveButton = [...document.querySelectorAll("button")].find((button) => {
      const text = normalize(button.textContent).toLowerCase();
      return text.includes("save") || button.getAttribute("onclick")?.includes("syncAndSave");
    });
    if (!saveButton) throw new Error("Không tìm thấy nút Save Daily");
    saveButton.click();

    const started = Date.now();
    while (Date.now() - started < 60000) {
      await sleep(700);
      const rows = [...document.querySelectorAll("tbody tr")];
      for (const row of rows) {
        const titleText = normalize(row.querySelector("td:nth-child(2)")?.textContent);
        const copy = row.querySelector("button.copy-btn[data-url]");
        if (copy?.dataset.url && !existingUrls.has(copy.dataset.url) && titleText.includes(normalize(item.title))) {
          return { ok: true, value: copy.dataset.url };
        }
      }

      const anyNewCopy = [...document.querySelectorAll("button.copy-btn[data-url]")].find((button) => !existingUrls.has(button.dataset.url));
      if (anyNewCopy?.dataset.url) {
        return { ok: true, value: anyNewCopy.dataset.url };
      }
    }

    return { ok: false, error: "Không lấy được Daily link sau khi save" };
  } catch (error) {
    return { ok: false, error: error.message };
  }
}

function fejiFillAndSubmitScript(item, dailyLink, domain) {
  const fire = (element) => {
    element.dispatchEvent(new Event("input", { bubbles: true }));
    element.dispatchEvent(new Event("change", { bubbles: true }));
  };
  const setValue = (selector, value) => {
    const element = document.querySelector(selector);
    if (!element) throw new Error(`Không tìm thấy ${selector}`);
    element.focus();
    element.value = value || "";
    fire(element);
  };
  const stripHtml = (html) => {
    const div = document.createElement("div");
    div.innerHTML = html || "";
    return div.textContent.trim().replace(/\s+/g, " ");
  };

  try {
    setValue('input[name="title"]', item.title);
    setValue('input[name="link"]', dailyLink);
    setValue('input[name="shorted_link__image"]', item.image || "");
    setValue('input[name="shorted_link__title"]', item.title);
    setValue('input[name="shorted_link__description"]', stripHtml(item.description).slice(0, 240));

    const select = document.querySelector('select[name="domain_share"]');
    if (!select) throw new Error("Không tìm thấy domain_share");
    select.value = domain;
    fire(select);

    const form = document.querySelector('form[action*="/app/links/store"]') || document.querySelector("form");
    if (!form) throw new Error("Không tìm thấy form Feji create");
    form.submit();
    return { ok: true, value: true };
  } catch (error) {
    return { ok: false, error: error.message };
  }
}

async function fejiFindShortLinkScript(dailyLink, domain) {
  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  const sameUrl = (a, b) => {
    try {
      const left = new URL(a);
      const right = new URL(b);
      left.hash = "";
      right.hash = "";
      return left.toString() === right.toString();
    } catch {
      return String(a) === String(b);
    }
  };

  try {
    const started = Date.now();
    while (Date.now() - started < 30000) {
      const cards = [...document.querySelectorAll(".card-body")];
      for (const card of cards) {
        const targetLinks = [...card.querySelectorAll('a[href^="http"]')].filter((a) => !a.href.includes("s.feji.io"));
        const hasTarget = targetLinks.some((a) => sameUrl(a.href, dailyLink));
        if (!hasTarget) continue;

        const copy = card.querySelector(`a.js_copy[data-copy^="https://${domain}/"]`)
          || card.querySelector("a.js_copy[data-copy]");
        if (copy?.dataset.copy) {
          return { ok: true, value: copy.dataset.copy };
        }
      }
      await sleep(500);
    }

    return { ok: false, error: "Không tìm thấy short link Feji theo Daily link vừa tạo" };
  } catch (error) {
    return { ok: false, error: error.message };
  }
}
