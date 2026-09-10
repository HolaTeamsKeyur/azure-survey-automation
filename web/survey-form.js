(() => {
  const money = new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" });
  const rows = [...document.querySelectorAll(".product-row")];
  const search = document.querySelector("#product-search");
  const toggle = document.querySelector("#toggle-products");
  const resultCount = document.querySelector("#product-result-count");
  const noResults = document.querySelector("#no-product-results");
  let expanded = false;

  const refreshVisibility = () => {
    const query = search?.value.trim().toLowerCase() ?? "";
    let visible = 0;
    let matching = 0;
    rows.forEach(row => {
      const matches = !query || row.dataset.productSearch.includes(query);
      if (matches) matching++;
      const quantity = Number(row.querySelector("input[type=number]").value || 0);
      const isInitial = Number(row.dataset.productIndex) < 10;
      const show = matches && (Boolean(query) || expanded || isInitial || quantity > 0);
      row.hidden = !show;
      if (show) visible++;
    });
    if (resultCount) {
      resultCount.textContent = query
        ? `${matching} product${matching === 1 ? "" : "s"} found`
        : `Showing ${visible} of ${rows.length} products`;
    }
    if (toggle) {
      toggle.hidden = Boolean(query);
      toggle.textContent = expanded ? "Show top 10" : "Show all products";
      toggle.setAttribute("aria-expanded", String(expanded));
    }
    if (noResults) noResults.hidden = matching !== 0;
  };

  const refreshTotals = () => {
    let subtotal = 0;
    let selectedCount = 0;
    rows.forEach(row => {
      const quantity = Number(row.querySelector("input[type=number]").value || 0);
      const total = Math.round((Number(row.dataset.unitPrice) * quantity + Number.EPSILON) * 100) / 100;
      row.querySelector(".line-total").textContent = quantity > 0 ? money.format(total) : "—";
      row.classList.toggle("is-selected", quantity > 0);
      subtotal += total;
      if (quantity > 0) selectedCount++;
    });
    const vat = Math.round((subtotal * 0.2 + Number.EPSILON) * 100) / 100;
    const subtotalOutput = document.querySelector("#subtotal");
    const vatOutput = document.querySelector("#vat-total");
    const grandOutput = document.querySelector("#grand-total");
    const selectedOutput = document.querySelector("#selected-product-count");
    if (subtotalOutput) subtotalOutput.textContent = money.format(subtotal);
    if (vatOutput) vatOutput.textContent = money.format(vat);
    if (grandOutput) grandOutput.textContent = money.format(subtotal + vat);
    if (selectedOutput) selectedOutput.textContent = String(selectedCount);
    refreshVisibility();
  };

  rows.forEach(row => row.querySelector("input[type=number]").addEventListener("input", refreshTotals));
  search?.addEventListener("input", refreshVisibility);
  toggle?.addEventListener("click", () => { expanded = !expanded; refreshVisibility(); });

  document.querySelector("#survey-form")?.addEventListener("submit", event => {
    if (!event.currentTarget.checkValidity()) {
      event.preventDefault();
      event.currentTarget.reportValidity();
      return;
    }
    const submit = event.currentTarget.querySelector("button[type=submit]");
    submit.disabled = true;
    submit.textContent = "Submitting survey…";
  });

  refreshTotals();
})();
