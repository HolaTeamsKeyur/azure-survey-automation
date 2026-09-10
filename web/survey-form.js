(() => {
  const money = new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" });
  const refresh = () => {
    let subtotal = 0;
    document.querySelectorAll(".product-row").forEach(row => {
      const quantity = Number(row.querySelector("input[type=number]").value || 0);
      const total = Math.round((Number(row.dataset.unitPrice) * quantity + Number.EPSILON) * 100) / 100;
      row.querySelector(".line-total").textContent = quantity > 0 ? money.format(total) : "—";
      subtotal += total;
    });
    const vat = Math.round((subtotal * 0.2 + Number.EPSILON) * 100) / 100;
    document.querySelector("#subtotal").textContent = money.format(subtotal);
    document.querySelector("#vat-total").textContent = money.format(vat);
    document.querySelector("#grand-total").textContent = money.format(subtotal + vat);
  };
  document.querySelectorAll(".product-row input[type=number]").forEach(input => input.addEventListener("input", refresh));
  refresh();
})();
