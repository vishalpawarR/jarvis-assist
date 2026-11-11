(() => {
  if (window.top !== window || document.getElementById("jarvis-assistant-host")) {
    return;
  }

  const TRACKED_SITES_KEY = "jarvisTrackedSites";
  const SAVED_PAGES_KEY = "jarvisSavedPages";
  const host = document.createElement("div");
  host.id = "jarvis-assistant-host";
  host.style.setProperty("all", "initial", "important");
  document.documentElement.append(host);
  const shadow = host.attachShadow({ mode: "closed" });

  const style = document.createElement("style");
  style.textContent = `
    :host { all: initial; }
    * { box-sizing: border-box; }
    .launcher {
      position: fixed; right: 22px; bottom: 22px; z-index: 2147483647;
      width: 54px; height: 54px; border: 0; border-radius: 50%;
      background: linear-gradient(145deg, #6d7cff, #4237c9); color: white;
      box-shadow: 0 8px 26px #17174066; cursor: pointer;
      font: 800 17px/1 system-ui, sans-serif; letter-spacing: -.06em;
    }
    .panel {
      position: fixed; right: 22px; bottom: 88px; z-index: 2147483647;
      width: min(360px, calc(100vw - 32px)); max-height: min(620px, calc(100vh - 112px));
      overflow: auto; padding: 18px; border: 1px solid #e1e4f0; border-radius: 18px;
      background: #fff; color: #20233a; box-shadow: 0 14px 48px #17174033;
      font: 14px/1.45 system-ui, sans-serif;
    }
    .hidden { display: none; }
    .header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 14px; }
    h2 { margin: 0; font-size: 19px; letter-spacing: -.03em; }
    h3 { margin: 19px 0 9px; font-size: 14px; }
    p { margin: 5px 0 10px; color: #656981; overflow-wrap: anywhere; }
    .close, .remove { border: 0; background: transparent; color: #626782; cursor: pointer; font: inherit; }
    .close { font-size: 21px; }
    .item { padding: 11px 0; border-top: 1px solid #eceef5; }
    .item strong { display: block; overflow-wrap: anywhere; }
    .muted { color: #777b91; font-size: 12px; }
    .row { display: flex; gap: 8px; margin-top: 9px; }
    button.action {
      min-height: 36px; border: 1px solid #dfe2ee; border-radius: 9px; padding: 7px 10px;
      background: #f7f8fc; color: #323550; cursor: pointer; font: 600 12px/1.3 system-ui, sans-serif;
    }
    button.primary { border-color: #5146d8; background: #5146d8; color: white; }
    button.action:hover { filter: brightness(.97); }
    .notice { min-height: 18px; margin-top: 8px; color: #3931a3; font-size: 12px; }
    .empty { color: #777b91; font-size: 13px; }
  `;
  shadow.append(style);

  const launcher = document.createElement("button");
  launcher.className = "launcher";
  launcher.type = "button";
  launcher.textContent = "J";
  launcher.title = "Open Jarvis";
  launcher.setAttribute("aria-label", "Open Jarvis job assistant");

  const panel = document.createElement("section");
  panel.className = "panel hidden";
  panel.setAttribute("aria-label", "Jarvis job assistant");
  shadow.append(launcher, panel);

  launcher.addEventListener("click", () => {
    panel.classList.toggle("hidden");
    if (!panel.classList.contains("hidden")) {
      render();
    }
  });

  function makeButton(label, callback, primary = false) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `action${primary ? " primary" : ""}`;
    button.textContent = label;
    button.addEventListener("click", callback);
    return button;
  }

  function addText(parent, tag, text, className) {
    const element = document.createElement(tag);
    element.textContent = text;
    if (className) element.className = className;
    parent.append(element);
    return element;
  }

  async function render() {
    panel.replaceChildren();
    const header = document.createElement("div");
    header.className = "header";
    addText(header, "h2", "Jarvis");
    const close = document.createElement("button");
    close.type = "button";
    close.className = "close";
    close.textContent = "×";
    close.setAttribute("aria-label", "Close Jarvis");
    close.addEventListener("click", () => panel.classList.add("hidden"));
    header.append(close);
    panel.append(header);

    const title = document.title.trim() || location.hostname;
    addText(panel, "p", title);
    addText(panel, "p", location.href, "muted");

    const selection = window.getSelection()?.toString().trim() ?? "";
    if (selection) {
      addText(panel, "h3", "Selected text");
      addText(panel, "p", selection);
    }

    const copyRow = document.createElement("div");
    copyRow.className = "row";
    const notice = addText(panel, "div", "", "notice");
    copyRow.append(
      makeButton("Copy title", () => copyText(title, notice)),
      makeButton("Copy URL", () => copyText(location.href, notice)),
    );
    if (selection) copyRow.append(makeButton("Copy selection", () => copyText(selection, notice)));
    panel.append(copyRow);

    const controls = document.createElement("div");
    controls.className = "row";
    controls.append(
      makeButton("Save this page", () => savePage(title, selection, notice), true),
      makeButton("Save as job site", () => trackCurrentSite(notice)),
    );
    panel.append(controls);
    panel.append(makeButton("Open resume", () => openResume(notice)));

    const result = await chrome.storage.local.get(SAVED_PAGES_KEY);
    const savedPages = result[SAVED_PAGES_KEY] ?? [];
    addText(panel, "h3", `Saved pages (${savedPages.length})`);
    if (!savedPages.length) {
      addText(panel, "p", "Saved pages stay on this device.", "empty");
    }
    for (const page of savedPages.slice(0, 5)) {
      const item = document.createElement("div");
      item.className = "item";
      addText(item, "strong", page.title);
      const link = document.createElement("a");
      link.href = page.url;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      link.textContent = page.url;
      link.className = "muted";
      item.append(link);
      if (page.selection) addText(item, "p", page.selection);
      panel.append(item);
    }
  }

  async function copyText(value, notice) {
    try {
      await navigator.clipboard.writeText(value);
      notice.textContent = "Copied to clipboard.";
    } catch (error) {
      console.error("Jarvis could not copy the text.", error);
      notice.textContent = "Copy failed. Check this site's clipboard permission.";
    }
  }

  async function savePage(title, selection, notice) {
    const result = await chrome.storage.local.get(SAVED_PAGES_KEY);
    const pages = result[SAVED_PAGES_KEY] ?? [];
    if (!pages.some((page) => page.url === location.href)) {
      pages.unshift({ id: crypto.randomUUID(), title, url: location.href, selection, savedAt: Date.now() });
      await chrome.storage.local.set({ [SAVED_PAGES_KEY]: pages });
    }
    notice.textContent = "Page saved on this device.";
    render();
  }

  async function trackCurrentSite(notice) {
    const hostname = location.hostname;
    const result = await chrome.storage.local.get(TRACKED_SITES_KEY);
    const sites = result[TRACKED_SITES_KEY] ?? [];
    if (sites.some((site) => site.hostname === hostname)) {
      notice.textContent = "This site is already tracked.";
      return;
    }
    sites.unshift({
      id: crypto.randomUUID(),
      hostname,
      label: document.title.trim() || hostname,
      url: location.origin,
      lastTitle: document.title,
      createdAt: Date.now(),
      lastVisitedAt: Date.now(),
    });
    await chrome.storage.local.set({ [TRACKED_SITES_KEY]: sites });
    notice.textContent = "Site added to your tracker.";
    render();
  }

  async function openResume(notice) {
    try {
      const response = await chrome.runtime.sendMessage({ type: "jarvis:open-resume" });
      if (!response?.ok) notice.textContent = "Could not open the resume.";
    } catch (error) {
      console.error("Jarvis could not open the saved resume.", error);
      notice.textContent = "Could not open the resume. Try the extension menu.";
    }
  }

  chrome.runtime.sendMessage({ type: "jarvis:site-visited" }).catch((error) => {
    console.error("Jarvis could not report this site visit.", error);
  });

  chrome.runtime.onMessage.addListener((message) => {
    if (message?.type !== "jarvis:toggle-panel") {
      return false;
    }
    const isOpening = panel.classList.contains("hidden");
    panel.classList.toggle("hidden", !isOpening);
    if (isOpening) {
      render();
    }
    return false;
  });
})();
