const collectionUtils = window.cardUtils || {};
const collectionSiteData = window.__CARDS_VIEWER_DATA__ || {};
const {
  loadCardsFromAssetsProgressively,
  normalizeBankTag,
  resolveIssuerLogoUrl,
} = collectionUtils;

const collectionGroupsRoot = document.querySelector("#collectionGroups");
const collectionStatus = document.querySelector("#collectionStatus");
const collectionExportButton = document.querySelector(
  "#collectionExportButton",
);
const collectionViewToggle = document.querySelector("#collectionViewToggle");
const collectionSimpleLabel = document.querySelector("#collectionSimpleLabel");
const collectionDetailedLabel = document.querySelector(
  "#collectionDetailedLabel",
);
const collectionQrCodeUrl = new URL(
  "assets/qrcode_collection.png",
  document.baseURI,
).href;

const NATIONAL_TAGS = new Set(["state", "stock"]);
const RETIRED_STATUSES = new Set(["expired", "cancelled"]);
const NATIONAL_TAG_ORDER = ["state", "stock"];
const PROVINCE_TAG_ORDER = ["city", "rural", "private", "village"];
const PINYIN_COLLATOR = new Intl.Collator("zh-Hans-u-co-pinyin", {
  sensitivity: "base",
});

let collectionGroups = [];
let collectionIssuers = [];
let collectionViewMode = "simple";

const REGION_DEFINITIONS = (collectionSiteData.regions?.continents || []).flatMap(
  (continent) => continent?.countries || [],
);
const REGION_LABELS = new Map(
  REGION_DEFINITIONS.map((region) => [
    region.code,
    region.name_zh || region.name || region.code,
  ]),
);

function getRegionLabel(region) {
  return REGION_LABELS.get(region) || region || "其他区域";
}

function getRegionRank(region) {
  const index = REGION_DEFINITIONS.findIndex((item) => item.code === region);
  return index === -1 ? REGION_DEFINITIONS.length : index;
}

function getExportLogoSource(src) {
  try {
    const source = new URL(src, window.location.href);
    const assetOrigin = String(
      collectionSiteData.assetOrigin || "https://cards-cdn.gtbro.vip",
    ).replace(/\/+$/, "");
    if (
      source.origin === assetOrigin &&
      source.pathname.startsWith("/issuers/logo/")
    ) {
      return `/proxy/issuer-logo${source.pathname.slice("/issuers/logo".length)}${source.search}`;
    }
  } catch {
    // Keep the original URL when it cannot be normalized.
  }
  return src;
}

function setCollectionStatus(message, hidden = false) {
  if (!collectionStatus) return;
  collectionStatus.textContent = message;
  collectionStatus.hidden = hidden;
}

function mapCollectedCard(bankKey, bankInfo, entry) {
  const card = entry.card || entry;
  const rawTag = String(bankInfo.tag || "").trim();
  if (!rawTag) return null;
  const tag = normalizeBankTag(rawTag);

  return {
    issuerKey: bankKey,
    name: bankInfo.nativeName || bankInfo.native_name || bankKey,
    logoUrl: resolveIssuerLogoUrl(
      bankKey,
      bankInfo.logo || "",
      bankInfo.region,
    ),
    region: String(bankInfo.region || "").trim(),
    province: String(bankInfo.province || "").trim(),
    status: String(card.status || "").toLowerCase(),
    tag,
    parent: String(bankInfo.parent || "").trim(),
    parentName: String(bankInfo.parentBankName || "").trim(),
    parentLogoUrl: bankInfo.parentBankLogoUrl || "",
    aliases: [
      bankKey,
      bankInfo.nativeName,
      bankInfo.native_name,
      bankInfo.englishName,
      bankInfo.english_name,
    ].filter(Boolean),
  };
}

function getCollectionCategory(issuer, viewMode) {
  if (NATIONAL_TAGS.has(issuer.tag)) {
    return { key: "national", title: "全国性", kind: "national" };
  }
  if (viewMode === "simple") {
    return issuer.tag === "foreign" ||
      (issuer.tag === "digital" && issuer.region !== "CN")
      ? { key: "foreign", title: "外资", kind: "foreign" }
      : { key: "regional", title: "区域性", kind: "regional" };
  }
  if (issuer.region === "CN") {
    const province = issuer.province || "中国大陆";
    return {
      key: `CN:${province}`,
      title: province,
      kind: "china-province",
      region: "CN",
    };
  }
  return {
    key: `region:${issuer.region || "other"}`,
    title: getRegionLabel(issuer.region),
    kind: "region",
    region: issuer.region,
  };
}

function sortIssuers(a, b, group) {
  const tagOrder =
    group.kind === "national"
      ? NATIONAL_TAG_ORDER
      : group.kind === "china-province"
        ? PROVINCE_TAG_ORDER
        : [];
  const tagDiff = tagOrder.indexOf(a.tag) - tagOrder.indexOf(b.tag);
  if (tagDiff !== 0) {
    const fallbackRank = tagOrder.length;
    const rankA = tagOrder.indexOf(a.tag);
    const rankB = tagOrder.indexOf(b.tag);
    return (
      (rankA === -1 ? fallbackRank : rankA) -
      (rankB === -1 ? fallbackRank : rankB)
    );
  }
  return PINYIN_COLLATOR.compare(a.name, b.name);
}

function sortCategories(a, b, viewMode) {
  if (viewMode === "simple") {
    const order = ["national", "foreign", "regional"];
    return order.indexOf(a.kind) - order.indexOf(b.kind);
  }
  if (a.kind === "national" || b.kind === "national") {
    return a.kind === "national" ? -1 : 1;
  }
  if (a.kind === "china-province" || b.kind === "china-province") {
    if (a.kind !== b.kind) return a.kind === "china-province" ? -1 : 1;
    return PINYIN_COLLATOR.compare(a.title, b.title);
  }
  const regionDiff = getRegionRank(a.region) - getRegionRank(b.region);
  return regionDiff || PINYIN_COLLATOR.compare(a.title, b.title);
}

function buildCollectionGroups(issuers, viewMode) {
  const grouped = new Map();
  buildRuralIssuerItems(issuers).forEach((issuer) => {
    const category = getCollectionCategory(issuer, viewMode);
    const group = grouped.get(category.key) || { ...category, items: [] };
    group.items.push(issuer);
    grouped.set(category.key, group);
  });

  return [...grouped.values()]
    .map((group) => ({
      ...group,
      items: group.items.sort((a, b) => sortIssuers(a, b, group)),
    }))
    .sort((a, b) => sortCategories(a, b, viewMode));
}

function updateCollectionViewToggle() {
  const isDetailed = collectionViewMode === "detailed";
  collectionViewToggle?.setAttribute("aria-checked", String(isDetailed));
  collectionViewToggle?.setAttribute(
    "aria-label",
    isDetailed ? "切换为简易模式" : "切换为详细模式",
  );
  collectionSimpleLabel?.classList.toggle("is-active", !isDetailed);
  collectionDetailedLabel?.classList.toggle("is-active", isDetailed);
}

function updateCollectionGroups() {
  collectionGroups = buildCollectionGroups(collectionIssuers, collectionViewMode);
  renderCollectionGroups();
}

function getCollectionIssuers(cards) {
  const issuers = new Map();
  cards.filter(Boolean).forEach((card) => {
    const issuer = issuers.get(card.issuerKey) || {
      ...card,
      statuses: new Set(),
    };
    issuer.statuses.add(card.status);
    issuers.set(card.issuerKey, issuer);
  });

  return [...issuers.values()].map((issuer) => ({
    ...issuer,
    isRetired:
      issuer.statuses.size > 0 &&
      [...issuer.statuses].every((status) => RETIRED_STATUSES.has(status)),
  }));
}

function normalizeIssuerAlias(value) {
  return String(value || "").trim().toLowerCase();
}

function buildRuralIssuerItems(issuers) {
  const issuerByKey = new Map(
    issuers.map((issuer) => [issuer.issuerKey, issuer]),
  );
  const issuerAliases = new Map();
  issuers.forEach((issuer) => {
    [issuer.issuerKey, issuer.name, ...(issuer.aliases || [])].forEach(
      (alias) => {
        const key = normalizeIssuerAlias(alias);
        if (key) issuerAliases.set(key, issuer.issuerKey);
      },
    );
  });

  const families = new Map();
  const nestedIssuerKeys = new Set();
  issuers.forEach((issuer) => {
    if (issuer.tag !== "rural" || !issuer.parent) return;

    const parentKey =
      issuerAliases.get(normalizeIssuerAlias(issuer.parent)) ||
      `parent:${normalizeIssuerAlias(issuer.parent)}`;
    const parent = issuerByKey.get(parentKey) || {
      issuerKey: parentKey,
      name: issuer.parentName || issuer.parent,
      logoUrl: issuer.parentLogoUrl,
      region: issuer.region,
      province: issuer.province,
      tag: issuer.tag,
      isRetired: false,
      aliases: [],
    };
    const family = families.get(parentKey) || { ...parent, children: [] };
    family.children.push(issuer);
    families.set(parentKey, family);
    nestedIssuerKeys.add(issuer.issuerKey);
  });

  const items = issuers
    .filter((issuer) => !nestedIssuerKeys.has(issuer.issuerKey))
    .map(
      (issuer) =>
        families.get(issuer.issuerKey) || { ...issuer, children: [] },
    );
  families.forEach((family, parentKey) => {
    if (!issuerByKey.has(parentKey)) items.push(family);
  });

  return items.map((item) => {
    const children = item.children.sort((a, b) =>
      PINYIN_COLLATOR.compare(a.name, b.name),
    );
    return {
      ...item,
      children,
      isRetired:
        item.isRetired ||
        (children.length > 0 && children.every((child) => child.isRetired)),
    };
  });
}

function renderIssuer(issuer) {
  const item = document.createElement("span");
  item.className = "collection-issuer";
  if (issuer.isRetired) item.classList.add("is-retired");

  if (issuer.logoUrl) {
    const logo = document.createElement("img");
    logo.className = "collection-issuer-logo";
    logo.src = issuer.logoUrl;
    logo.alt = "";
    logo.setAttribute("aria-hidden", "true");
    item.append(logo);
  }

  item.append(document.createTextNode(issuer.name));
  return item;
}

function renderIssuerItem(issuer) {
  if (!issuer.children?.length) return renderIssuer(issuer);

  const family = document.createElement("span");
  family.className = "collection-issuer-family";
  const parent = renderIssuer(issuer);
  parent.classList.add("collection-issuer-family-parent");
  family.append(parent, document.createTextNode("（"));
  issuer.children.forEach((child, index) => {
    if (index) family.append(document.createTextNode(" "));
    const childItem = renderIssuer(child);
    childItem.classList.add("collection-issuer-family-child");
    family.append(childItem);
  });
  family.append(document.createTextNode("）"));
  return family;
}

function renderCollectionGroups() {
  if (!collectionGroupsRoot) return;
  collectionGroupsRoot.replaceChildren();
  collectionGroups.forEach((group) => {
    const section = document.createElement("section");
    section.className = "collection-group";

    const title = document.createElement("h2");
    title.className = "collection-group-title";
    title.textContent = group.title;

    const paragraph = document.createElement("p");
    paragraph.className = "collection-issuer-paragraph";
    group.items.forEach((issuer) => paragraph.append(renderIssuerItem(issuer)));

    section.append(title, paragraph);
    collectionGroupsRoot.append(section);
  });
}

function loadImageForExport(src) {
  if (!src) return Promise.resolve(null);
  return fetch(src, { mode: "cors", cache: "force-cache" })
    .then((response) => {
      if (!response.ok)
        throw new Error(`Logo request failed: ${response.status}`);
      return response.blob();
    })
    .then(
      (blob) =>
        new Promise((resolve) => {
          const image = new Image();
          const objectUrl = URL.createObjectURL(blob);
          image.onload = () => {
            URL.revokeObjectURL(objectUrl);
            resolve(image);
          };
          image.onerror = () => {
            URL.revokeObjectURL(objectUrl);
            resolve(null);
          };
          image.src = objectUrl;
        }),
    )
    .catch(() => null);
}

function createExportIssuerToken(context, issuer, logoSize) {
  const name = String(issuer.name || "-");
  return {
    type: "issuer",
    issuer,
    name,
    width: logoSize + 8 + context.measureText(name).width,
  };
}

function createExportTextToken(context, text) {
  return {
    type: "text",
    text,
    width: context.measureText(text).width,
  };
}

function prepareExportIssuerItem(
  context,
  issuer,
  contentWidth,
  logoSize,
  lineHeight,
) {
  const tokens = [createExportIssuerToken(context, issuer, logoSize)];
  if (issuer.children?.length) {
    tokens.push(createExportTextToken(context, "（"));
    issuer.children.forEach((child, index) => {
      if (index) tokens.push(createExportTextToken(context, " "));
      tokens.push(createExportIssuerToken(context, child, logoSize));
    });
    tokens.push(createExportTextToken(context, "）"));
  }

  const lines = [];
  let line = { width: 0, tokens: [] };
  tokens.forEach((token) => {
    if (line.tokens.length && line.width + token.width > contentWidth) {
      lines.push(line);
      line = { width: 0, tokens: [] };
    }
    line.tokens.push(token);
    line.width += token.width;
  });
  if (line.tokens.length) lines.push(line);

  return {
    ...issuer,
    lines,
    width: Math.min(
      contentWidth,
      Math.max(...lines.map((currentLine) => currentLine.width)),
    ),
    height: Math.max(logoSize, lines.length * lineHeight),
  };
}

function formatExportTime(date = new Date()) {
  const pad = (value) => String(value).padStart(2, "0");
  return `${date.getFullYear()}年${pad(date.getMonth() + 1)}月${pad(
    date.getDate(),
  )}日${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function prepareExportLayout(context) {
  const padding = 22;
  const logoSize = 22;
  const lineHeight = 26;
  const itemGap = 16;
  const contentWidth = 390 - padding * 2;
  const qrSize = 100;
  const footerHeight = qrSize + 64;
  const groups = collectionGroups.map((group) => ({
    ...group,
    rows: group.items.reduce((rows, issuer) => {
      const preparedItem = prepareExportIssuerItem(
        context,
        issuer,
        contentWidth,
        logoSize,
        lineHeight,
      );
      const item = {
        ...preparedItem,
        width: Math.min(contentWidth, preparedItem.width + itemGap),
      };
      const row = rows.at(-1);
      if (row && row.width + item.width > contentWidth) {
        rows.push({ width: item.width, height: item.height, items: [item] });
      } else if (row) {
        row.width += item.width;
        row.height = Math.max(row.height, item.height);
        row.items.push(item);
      } else {
        rows.push({ width: item.width, height: item.height, items: [item] });
      }
      return rows;
    }, []),
  }));
  const height = groups.reduce(
    (total, group) =>
      total +
      40 +
      group.rows.reduce((rowTotal, row) => rowTotal + row.height + 9, 0),
    88 + footerHeight,
  );
  return {
    groups,
    height,
    padding,
    logoSize,
    lineHeight,
    itemGap,
    exportedAt: formatExportTime(),
    footerHeight,
    qrSize,
  };
}

function drawCollectionImage(context, layout, images, colors) {
  const { groups, padding, logoSize, lineHeight, itemGap } = layout;
  context.fillStyle = colors.background;
  context.fillRect(0, 0, 390, layout.height);
  context.fillStyle = colors.text;
  context.font = "700 30px system-ui, sans-serif";
  context.fillText("银行收集进度", padding, 44);
  context.fillStyle = colors.muted;
  context.font = "400 12px system-ui, sans-serif";
  context.fillText(layout.exportedAt, padding, 66);

  let y = 96;
  groups.forEach((group) => {
    context.strokeStyle = colors.line;
    context.beginPath();
    context.moveTo(padding, y - 14);
    context.lineTo(390 - padding, y - 14);
    context.stroke();
    context.fillStyle = colors.accent;
    context.font = "700 16px system-ui, sans-serif";
    context.fillText(group.title, padding, y + 3);
    y += 24;

    group.rows.forEach((row) => {
      let x = padding;
      row.items.forEach((issuer) => {
        const itemTop = y + Math.max(0, (row.height - issuer.height) / 2);
        issuer.lines.forEach((line, lineIndex) => {
          let tokenX = x;
          const lineTop = itemTop + lineIndex * lineHeight;
          line.tokens.forEach((token) => {
            if (token.type === "issuer") {
              context.globalAlpha = token.issuer.isRetired ? 0.48 : 1;
              const logo = images.get(token.issuer.logoUrl);
              if (logo) {
                context.drawImage(logo, tokenX, lineTop, logoSize, logoSize);
              }
              context.fillStyle = token.issuer.isRetired
                ? colors.muted
                : colors.text;
              context.font = "500 15px system-ui, sans-serif";
              context.fillText(
                token.name,
                tokenX + logoSize + 8,
                lineTop + 15,
              );
              context.globalAlpha = 1;
            } else {
              context.fillStyle = colors.text;
              context.font = "500 15px system-ui, sans-serif";
              context.fillText(token.text, tokenX, lineTop + 15);
            }
            tokenX += token.width;
          });
        });
        x += issuer.width;
      });
      y += row.height + 9;
    });
    y += 12;
  });

  const footerTop = layout.height - layout.footerHeight;
  context.strokeStyle = colors.line;
  context.beginPath();
  context.moveTo(padding, footerTop - 16);
  context.lineTo(390 - padding, footerTop - 16);
  context.stroke();

  const qrCode = images.get(collectionQrCodeUrl);
  if (qrCode) {
    const qrLeft = (390 - layout.qrSize) / 2;
    context.fillStyle = "#fff";
    context.fillRect(qrLeft, footerTop, layout.qrSize, layout.qrSize);
    context.drawImage(qrCode, qrLeft, footerTop, layout.qrSize, layout.qrSize);
  }

  const currentYear = new Date().getFullYear();
  const copyrightYear = currentYear === 2026 ? "2026" : `2026-${currentYear}`;
  context.textAlign = "center";
  context.fillStyle = colors.muted;
  context.font = "500 13px system-ui, sans-serif";
  context.fillText("扫描二维码查看网页版。", 195, footerTop + layout.qrSize + 22);
  context.font = "500 12px system-ui, sans-serif";
  context.fillText(
    `© ${copyrightYear} GTB. All rights reserved.`,
    195,
    footerTop + layout.qrSize + 45,
  );
  context.textAlign = "start";

}

async function exportCollectionImage() {
  if (!collectionGroups.length || !collectionExportButton) return;
  collectionExportButton.disabled = true;
  collectionExportButton.textContent = "正在导出";

  try {
    await document.fonts?.ready;
    const measureCanvas = document.createElement("canvas");
    const measureContext = measureCanvas.getContext("2d");
    if (!measureContext) throw new Error("Canvas unavailable");
    measureContext.font = "500 15px system-ui, sans-serif";
    const layout = prepareExportLayout(measureContext);
    const imageSources = [
      ...new Set([
        ...collectionGroups.flatMap((group) =>
          group.items.flatMap((issuer) =>
            [issuer, ...(issuer.children || [])]
              .map((item) => item.logoUrl)
              .filter(Boolean),
          ),
        ),
        collectionQrCodeUrl,
      ]),
    ];
    const loadedImages = await Promise.all(
      imageSources.map(async (src) => [
        src,
        await loadImageForExport(getExportLogoSource(src)),
      ]),
    );
    const images = new Map(loadedImages.filter(([, image]) => image));
    const canvas = document.createElement("canvas");
    const scale = 2;
    canvas.width = 390 * scale;
    canvas.height = Math.ceil(layout.height * scale);
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Canvas unavailable");
    context.scale(scale, scale);
    const style = getComputedStyle(document.documentElement);
    drawCollectionImage(context, layout, images, {
      background: style.getPropertyValue("--bg").trim() || "#f6f7f4",
      text: style.getPropertyValue("--text").trim() || "#19201d",
      muted: style.getPropertyValue("--muted").trim() || "#65706a",
      accent: style.getPropertyValue("--accent-strong").trim() || "#075a4b",
      line: style.getPropertyValue("--line").trim() || "rgba(24, 32, 29, 0.12)",
    });
    const blob = await new Promise((resolve) =>
      canvas.toBlob(resolve, "image/png"),
    );
    if (!blob) throw new Error("Image export failed");
    const link = document.createElement("a");
    const imageUrl = URL.createObjectURL(blob);
    link.href = imageUrl;
    link.download = "收集进度.png";
    document.body.append(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(imageUrl), 1000);
  } finally {
    collectionExportButton.disabled = false;
    collectionExportButton.textContent = "导出为图片";
  }
}

async function loadCollection() {
  const cards = await loadCardsFromAssetsProgressively(mapCollectedCard, {
    onlyMycards: true,
    warn: true,
  });
  collectionIssuers = getCollectionIssuers(cards);
  if (!collectionIssuers.length) {
    setCollectionStatus("暂无符合条件的发行方");
    return;
  }
  updateCollectionGroups();
  setCollectionStatus("", true);
}

collectionExportButton?.addEventListener("click", () => {
  exportCollectionImage().catch(() => setCollectionStatus("图片导出失败"));
});

collectionViewToggle?.addEventListener("click", () => {
  collectionViewMode =
    collectionViewMode === "simple" ? "detailed" : "simple";
  updateCollectionViewToggle();
  updateCollectionGroups();
});

updateCollectionViewToggle();
loadCollection().catch(() => setCollectionStatus("收集数据加载失败"));
