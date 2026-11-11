const request = indexedDB.open("jarvisResume", 1);

request.onupgradeneeded = () => request.result.createObjectStore("files");
request.onerror = () => {
  document.getElementById("message").textContent = "Could not open resume storage.";
};
request.onsuccess = () => {
  const database = request.result;
  const read = database.transaction("files").objectStore("files").get("resume");
  read.onerror = () => {
    document.getElementById("message").textContent = "Could not read the saved resume.";
  };
  read.onsuccess = () => {
    if (!read.result) {
      document.getElementById("message").textContent = "No resume is saved. Choose a PDF from the Jarvis extension menu.";
      return;
    }

    const file = read.result;
    const url = URL.createObjectURL(file);
    const viewer = document.createElement("iframe");
    viewer.id = "resume";
    viewer.title = "Saved resume PDF";
    viewer.src = url;
    document.getElementById("viewer").append(viewer);
    document.getElementById("message").textContent = "The original file location is not available to the extension. You can save a copy into Downloads/Jarvis Resume and open that folder.";
    document.getElementById("file-name").textContent = file.name;

    const showFolderButton = document.getElementById("save-show-folder");
    showFolderButton.disabled = false;
    showFolderButton.addEventListener("click", async () => {
      showFolderButton.disabled = true;
      document.getElementById("message").textContent = "Saving your resume copy…";
      try {
        const downloadId = await chrome.downloads.download({
          url,
          filename: `Jarvis Resume/${file.name}`,
          conflictAction: "uniquify",
          saveAs: false,
        });
        const changed = (delta) => {
          if (delta.id !== downloadId || !delta.state?.current) return;
          chrome.downloads.onChanged.removeListener(changed);
          if (delta.state.current === "complete") {
            chrome.downloads.show(downloadId);
            document.getElementById("message").textContent = "Resume copy saved. Its folder has been opened.";
          } else {
            document.getElementById("message").textContent = "The resume download did not complete.";
          }
          showFolderButton.disabled = false;
        };
        chrome.downloads.onChanged.addListener(changed);
        const [item] = await chrome.downloads.search({ id: downloadId });
        if (item?.state === "complete") {
          chrome.downloads.onChanged.removeListener(changed);
          chrome.downloads.show(downloadId);
          document.getElementById("message").textContent = "Resume copy saved. Its folder has been opened.";
          showFolderButton.disabled = false;
        } else if (item?.state === "interrupted") {
          chrome.downloads.onChanged.removeListener(changed);
          document.getElementById("message").textContent = "The resume download did not complete.";
          showFolderButton.disabled = false;
        }
      } catch (error) {
        console.error("Jarvis could not save or reveal the resume copy.", error);
        document.getElementById("message").textContent = "Could not save or show the resume folder. Check the browser's download settings.";
        showFolderButton.disabled = false;
      }
    });
  };
};
