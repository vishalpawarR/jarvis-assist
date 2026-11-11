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

    const url = URL.createObjectURL(read.result);
    const viewer = document.createElement("iframe");
    viewer.id = "resume";
    viewer.title = "Saved resume PDF";
    viewer.src = url;
    document.getElementById("message").replaceWith(viewer);
  };
};
