export function initializeNavigation() {
  document.querySelectorAll(".tab").forEach((tab) => {
    tab.addEventListener("click", () => {
      document.querySelectorAll(".tab").forEach((candidate) => {
        const selected = candidate === tab;
        candidate.classList.toggle("active", selected);
        candidate.setAttribute("aria-selected", String(selected));
        candidate.tabIndex = selected ? 0 : -1;
      });
      document.querySelectorAll(".tab-panel").forEach((panel) => {
        panel.hidden = panel.id !== tab.getAttribute("aria-controls");
      });
    });
  });

  const requestedTab = new URLSearchParams(location.search).get("tab");
  if (requestedTab) {
    document.querySelector(`.tab[data-tab="${CSS.escape(requestedTab)}"]`)?.click();
  }
}
