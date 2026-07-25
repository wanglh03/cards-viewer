(() => {
  const ORGANIZATIONS = [
    { name: "Mastercard", icon: "Mastercard.png", credit: true },
    { name: "VISA", icon: "VISA.png", credit: true },
    { name: "AMEX", icon: "AMEX.png", credit: true },
    { name: "UnionPay", icon: "UnionPay.png", credit: true },
    { name: "JCB", icon: "JCB.png", credit: true },
    {
      name: "China T-Union",
      icon: "China_T-union.svg",
      credit: false,
    },
    {
      name: "RAILPLUS",
      icon: "RAILPLUS.jpg",
      credit: false,
    },
  ];

  const TIER_ORDER_MAP = {
    Mastercard: [
      "World Legend",
      "World Elite",
      "World",
      "Titanium",
      "Platinum",
      "Gold",
      "Standard",
    ],
    VISA: ["Infinite", "Signature", "Platinum", "Gold", "Classic"],
    AMEX: [
      "Centurion",
      "Icon",
      "Platinum",
      "Max",
      "Gold",
      "Select",
      "Green",
      "Member",
    ],
    UnionPay: ["Diamond", "Platinum", "Gold", "Standard"],
    JCB: ["The Class", "Platinum", "Gold", "Standard"],
    "China T-Union": [],
  };

  const GLOBAL_TIER_ORDER = [
    ["World Legend"],
    ["World Elite"],
    ["World"],
    ["Infinite"],
    ["Signature"],
    ["Centurion"],
    ["Icon"],
    ["Diamond"],
    ["The Class"],
    ["Titanium"],
    ["Platinum"],
    ["Max"],
    ["Gold"],
    ["Select"],
    ["Classic"],
    ["Standard"],
    ["Green"],
    ["Member"],
  ];

  const TIER_ACCENT_CLASS = {
    "tier-accent-diamond": [
      "World Legend",
      "World Elite",
      "Infinite",
      "Centurion",
      "Icon",
      "Diamond",
      "The Class",
    ],
    "tier-accent-spectrum": ["World", "Signature"],
    "tier-accent-platinum": ["Platinum", "Max"],
    "tier-accent-gold": ["Gold", "Select"],
  };

  window.cardConfig = Object.freeze({
    ORGANIZATIONS,
    TIER_ORDER_MAP,
    TIER_ACCENT_CLASS,
    GLOBAL_TIER_ORDER,
  });
})();
