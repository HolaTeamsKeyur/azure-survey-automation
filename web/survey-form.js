(() => {
  const form = document.querySelector("#survey-form");
  const money = new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" });
  const rows = [...document.querySelectorAll(".product-row")];
  const search = document.querySelector("#product-search");
  const resultCount = document.querySelector("#product-result-count");
  const noResults = document.querySelector("#no-product-results");
  let submitting = false;

  window.addEventListener("beforeunload", event => {
    if (!submitting) return;
    event.preventDefault();
    event.returnValue = "";
  });

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

  const draftKey = `access4lofts-survey-draft:${form?.dataset.draftId || window.location.pathname}`;
  const saveDraft = () => {
    if (!form) return;
    try {
      const values = [...form.elements]
        .filter(element => element.name && element.type !== "submit")
        .map(element => ({
          name: element.name,
          value: element.value,
          checked: element.type === "checkbox" ? element.checked : undefined
        }));
      sessionStorage.setItem(draftKey, JSON.stringify(values));
    } catch {
      // The form still works when browser storage is unavailable.
    }
  };
  const restoreDraft = () => {
    if (!form) return;
    try {
      const values = JSON.parse(sessionStorage.getItem(draftKey) || "[]");
      values.forEach(saved => {
        const element = [...form.elements].find(candidate => candidate.name === saved.name);
        if (!element) return;
        if (element.type === "checkbox") element.checked = Boolean(saved.checked);
        else element.value = saved.value;
      });
    } catch {
      sessionStorage.removeItem(draftKey);
    }
  };

  restoreDraft();
  form?.addEventListener("input", saveDraft);
  form?.addEventListener("change", saveDraft);

  document.querySelectorAll("textarea").forEach(textarea => {
    const resize = () => {
      textarea.style.height = "auto";
      textarea.style.height = `${textarea.scrollHeight}px`;
    };
    textarea.addEventListener("input", resize);
    resize();
  });

  form?.addEventListener("submit", async event => {
    event.preventDefault();
    const selectedProducts = rows.filter(row => row.querySelector("input[type=checkbox]")?.checked);
    if (selectedProducts.length === 0) {
      const status = event.currentTarget.querySelector("#submission-status");
      status.hidden = false;
      status.classList.add("is-error");
      status.textContent = "Select at least one product before completing the survey.";
      document.querySelector(".products-section")?.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }
    if (!event.currentTarget.checkValidity()) {
      event.currentTarget.reportValidity();
      return;
    }
    const submit = event.currentTarget.querySelector("button[type=submit]");
    const status = event.currentTarget.querySelector("#submission-status");
    const originalLabel = submit.textContent;
    submitting = true;
    submit.disabled = true;
    submit.textContent = "Saving…";
    status.hidden = false;
    status.classList.remove("is-error");
    status.textContent = "Saving the survey and creating the draft quote in the background. Please keep this page open.";
    try {
      const response = await fetch(event.currentTarget.action, {
        method: "POST",
        body: new FormData(event.currentTarget),
        headers: { "Accept": "application/json" },
        credentials: "same-origin"
      });
      const contentType = response.headers.get("content-type") || "";
      const result = contentType.includes("application/json") ? await response.json() : {};
      if (!response.ok) {
        const reference = result.correlationId ? ` Reference: ${result.correlationId}.` : "";
        throw new Error(`${result.error || "The survey could not be saved."}${reference}`);
      }
      sessionStorage.removeItem(draftKey);
      status.textContent = "Survey saved. Opening the completed confirmation…";
      submitting = false;
      window.location.replace(result.nextUrl || window.location.href);
    } catch (error) {
      submitting = false;
      submit.disabled = false;
      submit.textContent = originalLabel;
      status.classList.add("is-error");
      status.textContent = `${error instanceof Error ? error.message : "The survey could not be saved."} Your entries have been kept. Please retry.`;
    }
  });

  refreshTotals();
  refreshSearch();
})();
