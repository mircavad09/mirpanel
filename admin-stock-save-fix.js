(function () {
  function runWhenReady(callback) {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", callback);
      return;
    }
    callback();
  }

  runWhenReady(() => {
    const stockInput = document.getElementById("productStock");
    const stockEnabledInput = document.getElementById("productStockEnabled");
    if (!stockInput || !stockEnabledInput) return;

    stockInput.addEventListener("input", () => {
      if (typeof selectedProduct !== "function") return;
      const product = selectedProduct();
      if (!product) return;

      if (stockInput.value === "") {
        product.stock = null;
        product.stockEnabled = false;
        stockEnabledInput.checked = false;
      } else {
        product.stock = Math.max(0, Number(stockInput.value) || 0);
        product.stockEnabled = true;
        stockEnabledInput.checked = true;
      }

      if (product.stockEnabled && Number(product.stock) > 0 && product.flow !== "out_of_stock") {
        product.soldOut = false;
      }
      if (product.stockEnabled && Number(product.stock) <= 0) {
        product.soldOut = true;
      }

      if (typeof markDirty === "function") markDirty();
      if (typeof renderProducts === "function") renderProducts();
    });
  });
})();
