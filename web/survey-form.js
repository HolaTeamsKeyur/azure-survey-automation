(() => {
  const money = new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" });
  const rows = [...document.querySelectorAll(".product-row")];
  const search = document.querySelector("#product-search");
  const resultCount = document.querySelector("#product-result-count");
  const noResults = document.querySelector("#no-product-results");

  const refreshSearch = () => {
    const query = search?.value.trim().toLowerCase() ?? "";
    let matches = 0;
    rows.forEach(row => {
      const visible = !query || row.dataset.productSearch.includes(query);
      row.hidden = !visible;
      if (visible) matches++;
    });
    if (resultCount) {
      resultCount.textContent = query
        ? `${matches} product${matches === 1 ? "" : "s"} found`
        : `Showing all ${rows.length} products`;
    }
    if (noResults) noResults.hidden = matches !== 0;
  };

  const refreshTotals = () => {
    let subtotal = 0;
    let selectedCount = 0;
    rows.forEach(row => {
      const checkbox = row.querySelector("input[type=checkbox]");
      const quantityInput = row.querySelector(".quantity input");
      const selected = checkbox.checked;
      quantityInput.disabled = !selected;
      quantityInput.required = selected;
      const quantity = selected ? Number(quantityInput.value || 0) : 0;
      const total = Math.round((Number(row.dataset.unitPrice) * quantity + Number.EPSILON) * 100) / 100;
      row.querySelector(".line-total").textContent = selected && quantity > 0 ? money.format(total) : "—";
      row.classList.toggle("is-selected", selected);
      if (selected && quantity > 0) subtotal += total;
      if (selected) selectedCount++;
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
  };

  rows.forEach(row => {
    row.querySelector("input[type=checkbox]").addEventListener("change", refreshTotals);
    row.querySelector(".quantity input").addEventListener("input", refreshTotals);
  });
  search?.addEventListener("input", refreshSearch);

  document.querySelectorAll("textarea").forEach(textarea => {
    const resize = () => {
      textarea.style.height = "auto";
      textarea.style.height = `${textarea.scrollHeight}px`;
    };
    textarea.addEventListener("input", resize);
    resize();
  });

  document.querySelector("#survey-form")?.addEventListener("submit", event => {
    if (!event.currentTarget.checkValidity()) {
      event.preventDefault();
      event.currentTarget.reportValidity();
      return;
    }
    const submit = event.currentTarget.querySelector("button[type=submit]");
    submit.disabled = true;
    submit.textContent = "Creating quote…";
  });

  refreshTotals();
  refreshSearch();
})();
