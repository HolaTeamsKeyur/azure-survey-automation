(() => {
  const money = new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" });
  const sections = [...document.querySelectorAll(".workflow-section")];
  const tabs = [...document.querySelectorAll(".step-tab")];
  const previous = document.querySelector("#previous-step");
  const next = document.querySelector("#next-step");
  let activeIndex = 0;

  const showStep = index => {
    activeIndex = Math.max(0, Math.min(index, sections.length - 1));
    sections.forEach((section, itemIndex) => section.classList.toggle("is-active", itemIndex === activeIndex));
    tabs.forEach((tab, itemIndex) => {
      tab.classList.toggle("is-active", itemIndex === activeIndex);
      tab.setAttribute("aria-current", itemIndex === activeIndex ? "step" : "false");
    });
    if (previous) previous.hidden = activeIndex === 0;
    if (next) next.hidden = activeIndex === sections.length - 1;
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  tabs.forEach((tab, index) => tab.addEventListener("click", () => showStep(index)));
  previous?.addEventListener("click", () => showStep(activeIndex - 1));
  next?.addEventListener("click", () => showStep(activeIndex + 1));

  const refresh = () => {
    let subtotal = 0;
    let selectedCount = 0;
    document.querySelectorAll(".product-row").forEach(row => {
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
    if (subtotalOutput) subtotalOutput.textContent = money.format(subtotal);
    if (vatOutput) vatOutput.textContent = money.format(vat);
    if (grandOutput) grandOutput.textContent = money.format(subtotal + vat);
    const selectedOutput = document.querySelector("#selected-product-count");
    if (selectedOutput) selectedOutput.textContent = String(selectedCount);
  };
  document.querySelectorAll(".product-row input[type=number]").forEach(input => input.addEventListener("input", refresh));
  document.querySelector("#product-search")?.addEventListener("input", event => {
    const query = event.currentTarget.value.trim().toLowerCase();
    document.querySelectorAll(".product-row").forEach(row => { row.hidden = Boolean(query) && !row.dataset.productName.includes(query); });
  });

  let requestIndex = 0;
  const updateRequestCount = () => {
    const count = document.querySelectorAll(".new-product-row").length;
    const output = document.querySelector("#requested-product-count");
    if (output) output.textContent = String(count);
  };
  document.querySelector("#add-new-product")?.addEventListener("click", () => {
    if (requestIndex >= 10) return;
    const template = document.querySelector("#new-product-template");
    const wrapper = document.createElement("div");
    wrapper.innerHTML = template.innerHTML.replaceAll("__INDEX__", String(requestIndex++));
    const row = wrapper.firstElementChild;
    row.querySelector("input[name^=newProductName]").required = true;
    row.querySelector("input[name^=newProductQuantity]").required = true;
    row.querySelector(".remove-new-product").addEventListener("click", () => { row.remove(); updateRequestCount(); });
    document.querySelector("#new-product-list").append(row);
    row.querySelector("input").focus();
    updateRequestCount();
  });

  const form = document.querySelector("#survey-form");
  if (form) form.noValidate = true;
  form?.addEventListener("submit", event => {
    if (!event.currentTarget.checkValidity()) {
      event.preventDefault();
      const invalid = event.currentTarget.querySelector(":invalid");
      const invalidSection = invalid?.closest(".workflow-section");
      const invalidIndex = sections.indexOf(invalidSection);
      if (invalidIndex >= 0) showStep(invalidIndex);
      invalid?.reportValidity();
      return;
    }
    const submit = event.currentTarget.querySelector("button[type=submit]");
    submit.disabled = true;
    submit.textContent = "Submitting survey…";
  });
  refresh();
  updateRequestCount();
  showStep(0);
})();
