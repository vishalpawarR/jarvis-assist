import { RESUME_DB_NAME, RESUME_STORE_NAME } from "../../shared/storage.js";

const resumeMessage = document.getElementById("resume-message");

function openResumeDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(RESUME_DB_NAME, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(RESUME_STORE_NAME);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function getResume() {
  const database = await openResumeDatabase();
  return new Promise((resolve, reject) => {
    const request = database
      .transaction(RESUME_STORE_NAME)
      .objectStore(RESUME_STORE_NAME)
      .get("resume");
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function saveResume(file) {
  const database = await openResumeDatabase();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(RESUME_STORE_NAME, "readwrite");
    transaction.objectStore(RESUME_STORE_NAME).put(file, "resume");
    transaction.oncomplete = resolve;
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error);
  });
}

export async function initializeResume() {
  const chooseButton = document.getElementById("choose-resume");
  const resumeInput = document.getElementById("resume-file");
  const openButton = document.getElementById("open-resume");

  const resume = await getResume();
  openButton.disabled = !resume;
  if (resume) resumeMessage.textContent = `Saved locally: ${resume.name}`;

  chooseButton.addEventListener("click", () => resumeInput.click());
  resumeInput.addEventListener("change", async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
      resumeMessage.textContent = "Please choose a PDF file.";
      return;
    }
    try {
      await saveResume(file);
      openButton.disabled = false;
      resumeMessage.textContent = `Saved locally: ${file.name}`;
    } catch (error) {
      console.error("Jarvis could not save the selected resume.", error);
      resumeMessage.textContent = "Could not save this PDF in browser storage.";
    }
    event.target.value = "";
  });

  openButton.addEventListener("click", async () => {
    try {
      const currentResume = await getResume();
      if (!currentResume) {
        resumeMessage.textContent = "Choose a resume PDF first.";
        return;
      }
      await chrome.tabs.create({ url: chrome.runtime.getURL("src/features/resume/viewer.html") });
    } catch (error) {
      console.error("Jarvis could not open the saved resume.", error);
      resumeMessage.textContent = "Could not open the saved resume.";
    }
  });
}
