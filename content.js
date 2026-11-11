(() => {
  if (window.top !== window || document.getElementById("jarvis-assistant-host")) {
    return;
  }

  const TRACKED_SITES_KEY = "jarvisTrackedSites";
  const SAVED_PAGES_KEY = "jarvisSavedPages";
  const PERSONAL_INFO_KEY = "jarvisPersonalInfo";
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
    .header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px; }
    h2 { margin: 0; font-size: 19px; letter-spacing: -.03em; }
    h3 { margin: 16px 0 7px; font-size: 14px; }
    .close { border: 0; background: transparent; color: #626782; cursor: pointer; font: inherit; }
    .close { font-size: 21px; }
    .row { display: flex; gap: 8px; margin-top: 9px; }
    button.action {
      min-height: 36px; border: 1px solid #dfe2ee; border-radius: 9px; padding: 7px 10px;
      background: #f7f8fc; color: #323550; cursor: pointer; font: 600 12px/1.3 system-ui, sans-serif;
    }
    button.primary { border-color: #5146d8; background: #5146d8; color: white; }
    button.action:hover { filter: brightness(.97); }
    .details { border-top: 1px solid #eceef5; }
    .detail {
      display: flex; width: 100%; align-items: center; justify-content: space-between; gap: 10px;
      padding: 10px 0; border: 0; border-bottom: 1px solid #eceef5; background: transparent;
      color: #3931a3; cursor: pointer; text-align: left; font: 600 13px/1.4 system-ui, sans-serif;
    }
    .detail-value { min-width: 0; overflow-wrap: anywhere; }
    .detail-label { flex: 0 0 auto; color: #777b91; font-size: 11px; font-weight: 500; }
    .empty { margin: 4px 0 10px; color: #777b91; font: 12px/1.4 system-ui, sans-serif; }
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
    const selection = window.getSelection()?.toString().trim() ?? "";

    const controls = document.createElement("div");
    controls.className = "row";
    const savePageButton = makeButton("Save this page", () => savePage(title, selection, savePageButton), true);
    const trackSiteButton = makeButton("Save as job site", () => trackCurrentSite(trackSiteButton));
    controls.append(savePageButton, trackSiteButton);
    panel.append(controls);
    const resumeButton = makeButton("Open resume", () => openResume(resumeButton));
    panel.append(resumeButton);

    const result = await chrome.storage.local.get(PERSONAL_INFO_KEY);
    const personalInfo = result[PERSONAL_INFO_KEY] ?? {};
    const labels = {
      fullName: "Full name",
      email: "Email",
      phone: "Mobile",
      location: "Location",
      linkedin: "LinkedIn",
    };
    const entries = Object.entries(labels).filter(([key]) => personalInfo[key]);
    addText(panel, "h3", "My details");
    if (!entries.length) {
      addText(panel, "p", "Add your details in the Jarvis extension popup.", "empty");
    } else {
      const details = document.createElement("div");
      details.className = "details";
      for (const [key, label] of entries) {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "detail";
        button.setAttribute("aria-label", `Copy ${label}: ${personalInfo[key]}`);
        addText(button, "span", personalInfo[key], "detail-value");
        const caption = addText(button, "span", label, "detail-label");
        button.addEventListener("click", async () => {
          try {
            await navigator.clipboard.writeText(personalInfo[key]);
            caption.textContent = "Copied";
            setTimeout(() => { caption.textContent = label; }, 1200);
          } catch (error) {
            console.error(`Jarvis could not copy ${label}.`, error);
            caption.textContent = "Copy failed";
            setTimeout(() => { caption.textContent = label; }, 1600);
          }
        });
        details.append(button);
      }
      panel.append(details);
    }
  }

  function showButtonResult(button, message, originalLabel) {
    button.textContent = message;
    setTimeout(() => { button.textContent = originalLabel; }, 1400);
  }

  async function openResume(button) {
    try {
      const response = await chrome.runtime.sendMessage({ type: "jarvis:open-resume" });
      showButtonResult(button, response?.ok ? "Resume opened" : "Could not open", "Open resume");
    } catch (error) {
      console.error("Jarvis could not open the saved resume.", error);
      showButtonResult(button, "Could not open", "Open resume");
    }
  }

  async function savePage(title, selection, button) {
    try {
      const result = await chrome.storage.local.get(SAVED_PAGES_KEY);
      const pages = result[SAVED_PAGES_KEY] ?? [];
      if (!pages.some((page) => page.url === location.href)) {
        pages.unshift({ id: crypto.randomUUID(), title, url: location.href, selection, savedAt: Date.now() });
        await chrome.storage.local.set({ [SAVED_PAGES_KEY]: pages });
      }
      showButtonResult(button, "Page saved", "Save this page");
    } catch (error) {
      console.error("Jarvis could not save this page.", error);
      showButtonResult(button, "Save failed", "Save this page");
    }
  }

  async function trackCurrentSite(button) {
    try {
      const hostname = location.hostname;
      const result = await chrome.storage.local.get(TRACKED_SITES_KEY);
      const sites = result[TRACKED_SITES_KEY] ?? [];
      if (sites.some((site) => site.hostname === hostname)) {
        showButtonResult(button, "Already tracked", "Save as job site");
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
      showButtonResult(button, "Job site saved", "Save as job site");
    } catch (error) {
      console.error("Jarvis could not save this job site.", error);
      showButtonResult(button, "Save failed", "Save as job site");
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
