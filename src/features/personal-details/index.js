import { PERSONAL_INFO_KEY } from "../../shared/storage.js";
import {
  collectCustomFields,
  initializeCustomFields,
  renderCustomFields,
} from "./custom-fields.js";

const personalMessage = document.getElementById("personal-message");
const form = document.getElementById("personal-form");
const values = document.getElementById("personal-values");
const standardLabels = {
  fullName: "Full name",
  email: "Email",
  phone: "Mobile number",
  location: "Location",
  linkedin: "LinkedIn",
};

export async function renderPersonalInfo() {
  const result = await chrome.storage.local.get(PERSONAL_INFO_KEY);
  const personalInfo = result[PERSONAL_INFO_KEY] ?? {};
  for (const field of form.elements) {
    if (field.name && Object.hasOwn(personalInfo, field.name)) {
      field.value = personalInfo[field.name];
    }
  }

  const customInfo = renderCustomFields(personalInfo);

  values.replaceChildren();
  const entries = [
    ...Object.entries(standardLabels).map(([key, label]) => ({
      label,
      value: personalInfo[key],
    })),
    ...customInfo.map(({ label, value }) => ({ label, value })),
  ];
  for (const { label, value } of entries) {
    if (!value) continue;
    const button = document.createElement("button");
    button.type = "button";
    button.className = "copy-value";
    button.setAttribute("aria-label", `Copy ${label}`);
    const valueElement = document.createElement("strong");
    valueElement.textContent = value;
    const hint = document.createElement("span");
    hint.textContent = `${label} · click to copy`;
    button.append(valueElement, hint);
    button.addEventListener("click", async () => {
      try {
        await navigator.clipboard.writeText(value);
        personalMessage.textContent = `${label} copied to clipboard.`;
      } catch (error) {
        console.error(`Jarvis could not copy ${label}.`, error);
        personalMessage.textContent = `Could not copy ${label}.`;
      }
    });
    values.append(button);
  }
}

export function initializePersonalDetails() {
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const info = Object.fromEntries(new FormData(event.currentTarget).entries());
    for (const [key, value] of Object.entries(info)) {
      info[key] = value.trim();
    }
    info.customFields = collectCustomFields();
    try {
      await chrome.storage.local.set({ [PERSONAL_INFO_KEY]: info });
      personalMessage.textContent = "Personal details saved on this device.";
      await renderPersonalInfo();
    } catch (error) {
      console.error("Jarvis could not save personal details.", error);
      personalMessage.textContent = "Could not save your details.";
    }
  });

  initializeCustomFields();

  document.getElementById("clear-personal").addEventListener("click", async () => {
    try {
      await chrome.storage.local.remove(PERSONAL_INFO_KEY);
      form.reset();
      personalMessage.textContent = "Personal details cleared.";
      await renderPersonalInfo();
    } catch (error) {
      console.error("Jarvis could not clear personal details.", error);
      personalMessage.textContent = "Could not clear your details.";
    }
  });

  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName !== "local" || !changes[PERSONAL_INFO_KEY]) return;
    renderPersonalInfo().catch((error) => {
      console.error("Jarvis could not refresh personal details.", error);
      personalMessage.textContent = "Could not load your details.";
    });
  });
  return renderPersonalInfo();
}
