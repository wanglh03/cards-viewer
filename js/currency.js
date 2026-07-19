(() => {
  const currencyMeta = {
    CNY: { label: "CN¥" },
    USD: { label: "US$" },
    EUR: { label: "EU€" },
    JPY: { label: "JP¥" },
    GBP: { label: "GB£" },
    HKD: { label: "HK$" },
    AUD: { label: "AU$" },
    CAD: { label: "CA$" },
    CHF: { label: "CHF" },
    KRW: { label: "KR₩" },
    SGD: { label: "SG$" },
    NZD: { label: "NZ$" },
    THB: { label: "TH฿" },
  };

  function getCurrencyMeta(code) {
    return currencyMeta[code] || { label: code };
  }

  function parseCurrencyAmount(value) {
    const text = String(value || "").replace(/,/g, "");
    if (!text) return 0;
    const amount = Number(text);
    return Number.isFinite(amount) ? amount : 0;
  }

  function formatCurrencyAmount(value) {
    return new Intl.NumberFormat("en-US").format(parseCurrencyAmount(value));
  }

  function formatCurrencyDisplay(code, amount) {
    const meta = getCurrencyMeta(code);
    if (amount === undefined) {
      return `${meta.label}`;
    }
    return `${meta.label}${formatCurrencyAmount(amount)}`;
  }

  function formatCurrencyList(codes) {
    return codes
      .map((code) => formatCurrencyDisplay(code))
      .join(" / ");
  }

  window.currencyUtils = {
    currencyMeta,
    getCurrencyMeta,
    parseCurrencyAmount,
    formatCurrencyAmount,
    formatCurrencyDisplay,
    formatCurrencyList,
  };
})();
