(() => {
  function editButtonForRow(row) {
    return row?.querySelector?.('[data-edit-item]') || null;
  }

  document.addEventListener("click", (event) => {
    if (event.target.closest('[data-edit-item]')) return;
    if (event.target.closest("button, a, input, select, textarea, label")) return;

    const row = event.target.closest("#inventoryResults .data-table tbody tr");
    if (!row) return;

    const editButton = editButtonForRow(row);
    if (!editButton) return;

    event.preventDefault();
    editButton.click();
  });

  document.addEventListener("keydown", (event) => {
    if (!['Enter', ' '].includes(event.key)) return;
    const row = event.target.closest?.("#inventoryResults .data-table tbody tr");
    if (!row) return;
    const editButton = editButtonForRow(row);
    if (!editButton) return;
    event.preventDefault();
    editButton.click();
  });

  function decorateRows() {
    document.querySelectorAll("#inventoryResults .data-table tbody tr").forEach((row) => {
      if (!editButtonForRow(row)) return;
      row.tabIndex = 0;
      row.setAttribute("role", "button");
      row.setAttribute("aria-label", "Open item for editing");
      row.style.cursor = "pointer";
    });
  }

  const observer = new MutationObserver(decorateRows);
  observer.observe(document.documentElement, { childList: true, subtree: true });
  window.addEventListener("pageshow", () => setTimeout(decorateRows, 100));
  window.addEventListener("hashchange", () => setTimeout(decorateRows, 100));
  setTimeout(decorateRows, 250);
})();