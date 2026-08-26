import regions from "../config/regions.json";
import navigation from "../config/navigation.json";
import footerLinks from "../config/footer-links.json";
import type {
  Card,
  CollectionGroup,
  CollectedIssuer,
  IssuerData,
  IssuerOption,
  MyIssuersData,
  NavigationItem,
  SiteData,
} from "./types";

export const siteData: SiteData = {
  navigation: {
    brand: navigation.brand,
    items: navigation.items as NavigationItem[],
    github: navigation.github,
  },
  regions,
  assetOrigin: "https://cards-cdn.gtbro.vip",
};

export const navigationFooter = footerLinks.columns;

export const organizations = [
  "Mastercard",
  "VISA",
  "AMEX",
  "UnionPay",
  "JCB",
  "China T-Union",
  "RAILPLUS",
];
export const types = ["Debit", "Credit", "Prepaid", "Transit"];
export const typeLabels: Record<string, string> = {
  Debit: "借记卡",
  Credit: "信用卡",
  Prepaid: "预付卡",
  Transit: "交通卡",
};
export const statusLabels: Record<string, string> = {
  active: "已激活",
  inactive: "未激活",
  expired: "过期",
  cancelled: "注销",
};
export const bankTagLabels: Record<string, string> = {
  state: "国有商行",
  stock: "全国性商行",
  city: "城商行",
  rural: "农商行",
  village: "村镇银行",
  foreign: "外资银行",
  private: "民营银行",
  digital: "数字银行",
  others: "其他",
};
export const bankTagOrder = [
  "state",
  "stock",
  "city",
  "rural",
  "village",
  "foreign",
  "private",
  "digital",
  "others",
];
export const organizationOrder = organizations;
const organizationIcons: Record<string, string> = {
  Mastercard: "Mastercard.png",
  VISA: "VISA.png",
  AMEX: "AMEX.png",
  UnionPay: "UnionPay.png",
  JCB: "JCB.png",
  "China T-Union": "China_T-union.svg",
  RAILPLUS: "RAILPLUS.jpg",
};
const provinceAssetNames: Record<string, string> = {
  安徽: "Anhui",
  anhui: "Anhui",
  北京: "Beijing",
  beijing: "Beijing",
  重庆: "Chongqing",
  chongqing: "Chongqing",
  福建: "Fujian",
  fujian: "Fujian",
  甘肃: "Gansu",
  gansu: "Gansu",
  广东: "Guangdong",
  guangdong: "Guangdong",
  广西: "Guangxi",
  广西壮族自治区: "Guangxi",
  guangxi: "Guangxi",
  贵州: "Guizhou",
  guizhou: "Guizhou",
  海南: "Hainan",
  hainan: "Hainan",
  河北: "Hebei",
  hebei: "Hebei",
  黑龙江: "Heilongjiang",
  heilongjiang: "Heilongjiang",
  河南: "Henan",
  henan: "Henan",
  湖北: "Hubei",
  hubei: "Hubei",
  湖南: "Hunan",
  hunan: "Hunan",
  江苏: "Jiangsu",
  jiangsu: "Jiangsu",
  江西: "Jiangxi",
  jiangxi: "Jiangxi",
  吉林: "Jilin",
  jilin: "Jilin",
  辽宁: "Liaoning",
  liaoning: "Liaoning",
  内蒙古: "Inner Mongolia",
  内蒙古自治区: "Inner Mongolia",
  "inner mongolia": "Inner Mongolia",
  宁夏: "Ningxia",
  宁夏回族自治区: "Ningxia",
  ningxia: "Ningxia",
  青海: "Qinghai",
  qinghai: "Qinghai",
  陕西: "Shaanxi",
  shaanxi: "Shaanxi",
  山东: "Shandong",
  shandong: "Shandong",
  山西: "Shanxi",
  shanxi: "Shanxi",
  四川: "Sichuan",
  sichuan: "Sichuan",
  天津: "Tianjin",
  tianjin: "Tianjin",
  西藏: "Tibet",
  西藏自治区: "Tibet",
  tibet: "Tibet",
  新疆: "Xinjiang",
  新疆维吾尔自治区: "Xinjiang",
  xinjiang: "Xinjiang",
  云南: "Yunnan",
  yunnan: "Yunnan",
  浙江: "Zhejiang",
  zhejiang: "Zhejiang",
  香港: "Hong Kong",
  "hong kong": "Hong Kong",
  澳门: "Macau",
  macau: "Macau",
  台湾: "Taiwan",
  taiwan: "Taiwan",
};
export const globalTierOrder = [
  "World Legend",
  "World Elite",
  "World Black",
  "World",
  "World Business",
  "Infinite",
  "Infinite Business",
  "Signature",
  "Signature Business",
  "Centurion",
  "Centurion Business",
  "Icon",
  "Icon Business",
  "Diamond",
  "Diamond Business",
  "The Class",
  "The Class Business",
  "Titanium",
  "Titanium Business",
  "Platinum",
  "Platinum Business",
  "Gold",
  "Gold Business",
  "Classic",
  "Standard",
  "Basic",
];
const tierAccentTiers: Record<string, string[]> = {
  "tier-accent-diamond": [
    "World Legend",
    "World Elite",
    "World Black",
    "Infinite",
    "Centurion",
    "Icon",
    "Diamond",
    "The Class",
  ],
  "tier-accent-spectrum": ["World", "Signature"],
  "tier-accent-platinum": [
    "Titanium",
    "Titanium Business",
    "Platinum",
    "Platinum Business",
    "Max",
    "Max Business",
  ],
  "tier-accent-gold": ["Gold", "Select"],
};

export function assetUrl(path: string, origin = siteData.assetOrigin!) {
  if (!path) return "";
  if (/^(https?:)?\/\//i.test(path)) return path;
  return new URL(path.replace(/^\/+/, ""), `${origin}/`).toString();
}

export function issuerLogo(
  bankKey: string,
  logo: string,
  origin = siteData.assetOrigin!,
) {
  if (!logo) return "";
  if (/^(https?:)?\/\//i.test(logo)) return logo;
  return assetUrl(`issuers/logo/${logo.split(/[\\/]/).pop()}`, origin);
}

export function cardImage(
  bankKey: string,
  region: string,
  value: string,
  origin = siteData.assetOrigin!,
  bankTag = "",
  province = "",
) {
  if (!value) return "";
  if (/^(https?:)?\/\//i.test(value)) return value;
  const folderParts =
    region === "CN" && ["state", "stock"].includes(bankTag)
      ? [region, "Nationwide Banks", bankKey]
      : region === "CN" && bankTag === "foreign"
        ? [region, "Foreign Banks", bankKey]
        : region === "CN" && bankTag === "village"
          ? [region, "Village Banks", bankKey]
          : [region, region === "CN" ? provinceAssetName(province) : "", bankKey];
  const folder = folderParts.filter(Boolean).join("/");
  const relative = value.replace(/^\.?\//, "").replace(/^\.\.\//, "");
  return assetUrl(`issuers/${folder}/${relative}`, origin);
}

function provinceAssetName(value: string) {
  const text = String(value || "").trim();
  if (!text) return "";
  const withoutSuffix = text
    .replace(/特别行政区$/, "")
    .replace(/自治区$/, "")
    .replace(/[省市]$/, "");
  return (
    provinceAssetNames[text] ||
    provinceAssetNames[text.toLowerCase()] ||
    provinceAssetNames[withoutSuffix] ||
    provinceAssetNames[withoutSuffix.toLowerCase()] ||
    text
  );
}

export function organizationLogo(
  organization: string,
  origin = siteData.assetOrigin!,
) {
  const key = organizationIcons[organization] || "";
  return key ? assetUrl(`logo/${key}`, origin) : "";
}

function normalizedInfo(value: unknown): IssuerData {
  let info = value as any;
  for (const key of ["allCards", "allIssuers", "issuers"]) {
    if (info?.[key]) info = info[key];
  }
  if (!info || typeof info !== "object" || Array.isArray(info)) return {};

  return Object.fromEntries(
    Object.entries(info).map(([key, entry]) => [
      key,
      normalizeIssuerEntry(entry),
    ]),
  );
}

function normalizeIssuerEntry(value: unknown): IssuerData[string] {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const entry = value as IssuerData[string];
  const directCards = Array.isArray(entry.cards) ? entry.cards : [];

  // CDN v2 stores cards under their type (for example, `Debit` or `Credit`).
  // Keep the legacy `cards` array working while exposing a single card list downstream.
  const typedCards = types.flatMap((type) => {
    const group = entry[type];
    if (!Array.isArray(group)) return [];
    return group.map((raw) => withCardType(raw, type));
  });

  return { ...entry, cards: directCards.length ? directCards : typedCards };
}

function withCardType(raw: unknown, type: string) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return raw;
  const record = raw as Record<string, any>;
  if (
    record.card &&
    typeof record.card === "object" &&
    !Array.isArray(record.card)
  ) {
    return {
      ...record,
      card: { ...record.card, type: record.card.type ?? type },
    };
  }
  return { ...record, type: record.type ?? type };
}

export function normalizeCards(value: unknown, includeBinless = true): Card[] {
  const info = normalizedInfo(value);
  const metadata = new Map<string, { key: string; bank: any }>();
  Object.entries(info).forEach(([key, entry]) => {
    if (!entry?.bank) return;
    [
      key,
      entry.bank.english_name,
      entry.bank.englishName,
      entry.bank.nativeName,
      entry.bank.native_name,
    ]
      .filter(Boolean)
      .forEach((item) =>
        metadata.set(String(item).toLowerCase(), { key, bank: entry.bank }),
      );
  });
  const cards: Card[] = [];
  Object.entries(info).forEach(([bankKey, entry]) => {
    const bank = entry?.bank;
    if (!bank || !Array.isArray(entry.cards)) return;
    const parent = metadata.get(String(bank.parent || "").toLowerCase());
    entry.cards.forEach((raw, index) => {
      const item = raw?.card || raw;
      if (!item?.name || (!includeBinless && !item.bin)) return;
      const region = String(bank.region || "");
      const tag = normalizeBankTag(bank.tag);
      const nativeName = bank.nativeName || bank.native_name || "";
      const englishName = bank.english_name || bank.englishName || bankKey;
      const imageName =
        item.image || (item.ext ? `${item.name}.${item.ext}` : "");
      const issuerLimit = firstDefined(
        entry.issuer?.limit,
        entry.issuer?.credit_limit,
        entry.issuer?.creditLimit,
      );
      const limitValue = firstDefined(
        item.limit,
        item.credit_limit,
        item.creditLimit,
        issuerLimit,
      );
      const limitMap = normalizeLimitMap(
        limitValue,
        Array.isArray(item.currency)
          ? item.currency.map(String)
          : item.currency
            ? [String(item.currency)]
            : [],
      );
      const supplementary =
        item.sub_card === true || String(item.desc || "").includes("附卡");
      cards.push({
        id: `${bankKey}-${index}-${item.name}`,
        name: String(item.name),
        issuer: String(item.issuer || nativeName || englishName),
        bankKey,
        bankTag: tag,
        bankLogoUrl: issuerLogo(bankKey, String(bank.logo || "")),
        bankNativeName: String(nativeName),
        bankEnglishName: String(englishName),
        region,
        province: String(bank.province || ""),
        image: cardImage(
          bankKey,
          region,
          String(imageName),
          siteData.assetOrigin,
          tag,
          String(bank.province || ""),
        ),
        altImageUrl: cardImage(
          bankKey,
          region,
          String(item.altImage || item.altImageUrl || ""),
          siteData.assetOrigin,
          tag,
          String(bank.province || ""),
        ),
        backImageUrl: cardImage(
          bankKey,
          region,
          String(item.backImage || item.backImageUrl || ""),
          siteData.assetOrigin,
          tag,
          String(bank.province || ""),
        ),
        organization: String(item.organization || ""),
        organizationIconUrl: organizationLogo(String(item.organization || "")),
        tier: String(item.tier || ""),
        type: normalizeCardType(item.type),
        bin: String(item.bin || ""),
        length: String(item.length || ""),
        currency: Array.isArray(item.currency)
          ? item.currency.map(String)
          : item.currency
            ? [String(item.currency)]
            : [],
        desc: String(item.desc || ""),
        benefit: String(item.benefit || ""),
        status: String(item.status || "").toLowerCase(),
        virtual: item.virtual === true,
        acquired: String(item.acquired || ""),
        bankParent: parent?.key || bank.parent || "",
        bankParentTag: String(parent?.bank?.tag || ""),
        bankParentName: String(
          parent?.bank?.nativeName ||
            parent?.bank?.english_name ||
            parent?.key ||
            "",
        ),
        bankParentLogoUrl: parent
          ? issuerLogo(parent.key, String(parent.bank.logo || ""))
          : "",
        bankParentRegion: String(parent?.bank?.region || ""),
        bankParentProvince: String(parent?.bank?.province || ""),
        branch: String(item.branch || ""),
        limit:
          typeof limitValue === "object" && limitValue !== null
            ? ""
            : String(limitValue ?? ""),
        limitMap,
        sharedLimit: issuerLimit !== undefined && item.limit === undefined,
        supplementary,
        billingDay: String(
          firstDefined(
            item.billing_day,
            item.billingDay,
            item.bill_day,
            entry.issuer?.billing_day,
            entry.issuer?.billingDay,
            entry.issuer?.bill_day,
            entry.issuer?.statement_day,
          ) ?? "",
        ),
        dueDay: String(
          firstDefined(
            item.due_day,
            item.dueDay,
            item.payment_day,
            item.repayment_day,
            entry.issuer?.due_day,
            entry.issuer?.dueDay,
            entry.issuer?.payment_day,
            entry.issuer?.repayment_day,
          ) ?? "",
        ),
        annualFee: String(item.annual_fee ?? ""),
        ftf: String(item.ftf ?? ""),
        baseName: String(item.name),
        withdrawal: item.withdrawal,
        withdrawalExchange: item.withdrawal_exchange || null,
        withdrawalCurrencyRules: item.withdrawal_currency_rules || null,
        cardCurrency: Array.isArray(item.currency)
          ? String(item.currency[0] || "")
          : String(item.currency || ""),
      });
    });
  });
  return cards;
}

function normalizeLimitMap(value: unknown, currencies: string[]) {
  if (value === undefined || value === null || value === "") return {};
  if (typeof value === "object" && !Array.isArray(value))
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .filter(
          ([, amount]) =>
            amount !== undefined && amount !== null && amount !== "",
        )
        .map(([currency, amount]) => [currency, String(amount)]),
    );
  return { [currencies[0] || "CNY"]: String(value) };
}

function firstDefined<T>(...values: T[]) {
  return values.find(
    (value) => value !== undefined && value !== null && value !== "",
  );
}

export async function fetchJson<T>(url: string | undefined): Promise<T | null> {
  if (!url) return null;
  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`${response.status}`);
    return (await response.json()) as T;
  } catch (error) {
    console.warn("Unable to load remote card data", error);
    return null;
  }
}

function normalizeCardType(value: unknown) {
  const text = String(value || "");
  return (
    types.find((type) => type.toLowerCase() === text.toLowerCase()) || text
  );
}

export async function loadCards(kind: "issuer" | "mine" | "credit" = "issuer") {
  if (kind === "issuer") {
    const url = siteData.allCardsUrl || "/json/allcards.json";
    return normalizeCards(await fetchJson<IssuerData>(url));
  }

  const [personalPayload, issuerPayload] = await Promise.all([
    fetchJson<IssuerData>(siteData.myCardsUrl || "/json/mycards.json"),
    fetchJson<IssuerData>("/json/allissuers.json"),
  ]);
  return enrichParentIssuerMetadata(
    normalizeCards(personalPayload, true),
    issuerPayload,
  );
}

export function enrichParentIssuerMetadata(
  cards: Card[],
  payload: unknown,
): Card[] {
  const aliases = new Map<string, {
    key: string;
    name: string;
    logoUrl: string;
    tag: string;
    region: string;
    province: string;
    parent: string;
  }>();
  Object.entries(normalizedInfo(payload)).forEach(([key, entry]) => {
    const bank = entry.bank;
    if (!bank) return;
    const metadata = {
      key,
      name: String(
        bank.nativeName ||
          bank.native_name ||
          bank.englishName ||
          bank.english_name ||
          key,
      ),
      logoUrl: issuerLogo(key, String(bank.logo || "")),
      tag: normalizeBankTag(bank.tag),
      region: String(bank.region || ""),
      province: String(bank.province || ""),
      parent: String(
        bank.parent || bank.parentBank || bank.parent_issuer || "",
      ).trim(),
    };
    [
      key,
      bank.englishName,
      bank.english_name,
      bank.nativeName,
      bank.native_name,
    ]
      .filter(Boolean)
      .forEach((alias) => aliases.set(String(alias).trim().toLowerCase(), metadata));
  });

  return cards.map((card) => {
    const issuerMetadata = [
      card.bankKey,
      card.bankEnglishName,
      card.bankNativeName,
    ]
      .filter(Boolean)
      .map((alias) => aliases.get(String(alias).trim().toLowerCase()))
      .find(Boolean);
    const parentKey = String(
      card.bankParent || issuerMetadata?.parent || "",
    ).trim();
    const parentMetadata = parentKey
      ? aliases.get(parentKey.toLowerCase())
      : undefined;
    if (!parentKey && !card.bankParentName && !card.bankParentLogoUrl) {
      return card;
    }
    return {
      ...card,
      bankParent: parentMetadata?.key || parentKey,
      bankParentTag: parentMetadata?.tag || card.bankParentTag || "",
      bankParentName:
        parentMetadata?.name || card.bankParentName || parentKey,
      bankParentLogoUrl:
        parentMetadata?.logoUrl || card.bankParentLogoUrl || "",
      bankParentRegion: parentMetadata?.region || card.bankParentRegion || "",
      bankParentProvince:
        parentMetadata?.province || card.bankParentProvince || "",
    };
  });
}

function mergePersonalData(
  personalValue: unknown,
  fullValue: unknown,
): IssuerData {
  const personal = normalizedInfo(personalValue);
  const full = normalizedInfo(fullValue);
  const merged: IssuerData = {};
  const fullAliases = new Map<string, string>();
  Object.entries(full).forEach(([key, entry]) => {
    const bank = entry?.bank || {};
    [
      key,
      bank.english_name,
      bank.englishName,
      bank.native_name,
      bank.nativeName,
    ]
      .filter(Boolean)
      .forEach((alias) =>
        fullAliases.set(String(alias).trim().toLowerCase(), key),
      );
  });

  Object.entries(personal).forEach(([bankKey, personalEntry]) => {
    const personalBank = personalEntry?.bank || {};
    const fullKey = [
      bankKey,
      personalBank.english_name,
      personalBank.englishName,
      personalBank.native_name,
      personalBank.nativeName,
    ]
      .filter(Boolean)
      .map((value) => fullAliases.get(String(value).trim().toLowerCase()))
      .find(Boolean);
    const fullEntry = full[bankKey] || (fullKey ? full[fullKey] : {}) || {};
    const personalCards = Array.isArray(personalEntry.cards)
      ? personalEntry.cards
      : [];
    const fullCards = Array.isArray(fullEntry.cards) ? fullEntry.cards : [];
    const fullByName = new Map(
      fullCards.map((card) => [String(cardValue(card)?.name || ""), card]),
    );
    const cards = personalCards.map((raw) => {
      const card = cardValue(raw);
      const base = fullByName.get(String(card?.name || ""));
      if (!base) return raw;
      const baseCard = cardValue(base);
      return { ...baseCard, ...card };
    });
    merged[bankKey] = {
      ...fullEntry,
      ...personalEntry,
      bank: personalEntry.bank || fullEntry.bank,
      issuer: { ...(fullEntry.issuer || {}), ...(personalEntry.issuer || {}) },
      cards,
    };
  });

  return merged;
}

function cardValue(value: any) {
  return value?.card || value;
}

export async function loadMyIssuers() {
  return (await fetchJson<MyIssuersData>("/json/myissuers.json")) || {};
}

export function regionName(code: string) {
  for (const continent of regions.continents) {
    const match = continent.countries?.find((item) => item.code === code);
    if (match) return match.name_zh;
  }
  return code || "未知地区";
}

export function cardRegionName(card: Pick<Card, "region" | "province">) {
  return card.region === "CN" && card.province
    ? `${regionName(card.region)}/${card.province}`
    : regionName(card.region);
}

export function formatBin(bin: string) {
  return bin.length > 6 && bin.length !== 8
    ? `${bin.slice(0, 6)} ${bin.slice(6)}`
    : bin;
}

/** Returns the legacy bin-overlays label for an exact BIN match. */
export function getBinOverlayText(bin: string, payload: unknown): string {
  if (!bin || !payload || typeof payload !== "object" || Array.isArray(payload)) {
    return "";
  }
  for (const [label, bins] of Object.entries(payload as Record<string, unknown>)) {
    if (Array.isArray(bins) && bins.some((item) => item === bin)) {
      return label;
    }
  }
  return "";
}

export function compareText(a: unknown, b: unknown) {
  return String(a || "").localeCompare(String(b || ""), "zh-Hans-CN", {
    numeric: true,
    sensitivity: "base",
  });
}

export function tierRank(tier: string) {
  const index = globalTierOrder.indexOf(tier);
  return index < 0 ? globalTierOrder.length : index;
}

export function highestTier(tiers: string[]) {
  return (
    tiers.filter(Boolean).sort((a, b) => tierRank(a) - tierRank(b))[0] || ""
  );
}

export function tierAccentClass(tiers: string | string[]) {
  const highest = highestTier(Array.isArray(tiers) ? tiers : [tiers]);
  return (
    Object.entries(tierAccentTiers).find(([, values]) =>
      values.includes(highest),
    )?.[0] || "tier-accent-none"
  );
}

export function normalizeBankTag(value: unknown) {
  return (
    String(value || "")
      .trim()
      .toLowerCase() || "others"
  );
}

export function getIssuerValue(card: Card) {
  return card.bankEnglishName || card.bankKey;
}

export function getIssuerOptions(cards: Card[]): IssuerOption[] {
  const options = new Map<string, IssuerOption>();
  const aliases = new Map<string, string>();
  cards.forEach((card) => {
    const value = getIssuerValue(card);
    [value, card.bankKey, card.bankNativeName]
      .filter(Boolean)
      .forEach((alias) => aliases.set(String(alias).toLowerCase(), value));
  });
  const add = (value: string, label: string, tag: string, logoUrl = "") => {
    if (!value || options.has(value)) return;
    options.set(value, {
      value,
      label: label || value,
      tag: normalizeBankTag(tag),
      logoUrl,
    });
  };
  cards.forEach((card) =>
    add(
      getIssuerValue(card),
      card.bankNativeName || card.bankEnglishName,
      card.bankTag,
      card.bankLogoUrl,
    ),
  );
  cards.forEach((card) => {
    if (
      !["rural", "village"].includes(normalizeBankTag(card.bankTag)) ||
      !card.bankParent
    )
      return;
    const parentValue =
      aliases.get(card.bankParent.toLowerCase()) || card.bankParent;
    add(
      parentValue,
      card.bankParentName || card.bankParent,
      card.bankParentTag || "others",
      card.bankParentLogoUrl,
    );
  });
  return [...options.values()].sort(
    (a, b) =>
      bankTagOrder.indexOf(a.tag) - bankTagOrder.indexOf(b.tag) ||
      compareText(a.label, b.label),
  );
}

export function issuerMatches(cards: Card[], card: Card, target: string) {
  if (!target || target === "all") return true;
  const aliases = new Map<string, string>();
  cards.forEach((item) =>
    [getIssuerValue(item), item.bankKey, item.bankNativeName]
      .filter(Boolean)
      .forEach((alias) =>
        aliases.set(String(alias).toLowerCase(), getIssuerValue(item)),
      ),
  );
  const parentMap = new Map<string, string>();
  cards.forEach((item) => {
    if (item.bankParent)
      parentMap.set(
        getIssuerValue(item),
        aliases.get(item.bankParent.toLowerCase()) || item.bankParent,
      );
  });
  const resolvedTarget = aliases.get(target.toLowerCase()) || target;
  let value = getIssuerValue(card);
  const seen = new Set<string>();
  while (value && !seen.has(value)) {
    if (value === resolvedTarget) return true;
    seen.add(value);
    value = parentMap.get(value) || "";
  }
  return false;
}

export function compareCards(
  a: Card,
  b: Card,
  mode: "tier" | "organization" | "acquired" | "issuer" = "tier",
): number {
  if (mode === "acquired") {
    const aTime = Date.parse(a.acquired || "") || Number.NEGATIVE_INFINITY;
    const bTime = Date.parse(b.acquired || "") || Number.NEGATIVE_INFINITY;
    return bTime - aTime || compareText(a.name, b.name);
  }
  if (mode === "organization")
    return (
      compareText(a.organization, b.organization) ||
      compareText(a.tier, b.tier) ||
      compareText(a.issuer, b.issuer) ||
      compareText(a.name, b.name)
    );
  if (mode === "issuer") {
    const issuerGroup = (value: string) =>
      /^[A-Za-z]/.test(value) ? 0 : /^\p{Script=Han}/u.test(value) ? 1 : 2;
    return (
      issuerGroup(a.issuer) - issuerGroup(b.issuer) ||
      compareText(a.issuer, b.issuer) ||
      compareCards(a, b, "acquired") ||
      compareText(a.name, b.name)
    );
  }
  const tierDiff =
    (globalTierOrder.indexOf(a.tier) < 0
      ? globalTierOrder.length
      : globalTierOrder.indexOf(a.tier)) -
    (globalTierOrder.indexOf(b.tier) < 0
      ? globalTierOrder.length
      : globalTierOrder.indexOf(b.tier));
  const organizationRank = (value: string) => {
    const index = organizationOrder.indexOf(value);
    return index < 0 ? organizationOrder.length : index;
  };
  return (
    organizationRank(a.organization) - organizationRank(b.organization) ||
    tierDiff ||
    compareText(a.issuer, b.issuer) ||
    compareText(a.name, b.name)
  );
}

export function getCollectionIssuers(cards: Card[]): CollectedIssuer[] {
  const map = new Map<string, CollectedIssuer>();
  cards.forEach((card) => {
    const existing = map.get(card.bankKey) || {
      issuerKey: card.bankKey,
      name: card.bankNativeName || card.bankEnglishName || card.bankKey,
      logoUrl: card.bankLogoUrl,
      region: card.region,
      province: card.province,
      status: card.status || "",
      statuses: [],
      tag: normalizeBankTag(card.bankTag),
      parent: card.bankParent,
      parentName: card.bankParentName || "",
      parentLogoUrl: card.bankParentLogoUrl || "",
      aliases: [card.bankKey, card.bankNativeName, card.bankEnglishName].filter(
        Boolean,
      ),
      isRetired: false,
    };
    const status = String(card.status || "").toLowerCase();
    existing.status = status;
    if (!existing.statuses.includes(status)) existing.statuses.push(status);
    existing.isRetired =
      existing.statuses.length > 0 &&
      existing.statuses.every((status) =>
        ["expired", "cancelled"].includes(status),
      );
    map.set(card.bankKey, existing);
  });
  return [...map.values()];
}

export function buildCollectionGroups(
  issuers: CollectedIssuer[],
  mode: "simple" | "detailed",
): CollectionGroup[] {
  const aliases = new Map<string, string>();
  issuers.forEach((issuer) =>
    issuer.aliases.forEach((alias) =>
      aliases.set(alias.toLowerCase(), issuer.issuerKey),
    ),
  );
  const families = new Map<string, CollectedIssuer>();
  const nested = new Set<string>();
  issuers.forEach((issuer) => {
    if (issuer.tag !== "rural" || !issuer.parent) return;
    const parentKey =
      aliases.get(issuer.parent.toLowerCase()) ||
      `parent:${issuer.parent.toLowerCase()}`;
    const parent = issuers.find((item) => item.issuerKey === parentKey) || {
      issuerKey: parentKey,
      name: issuer.parentName || issuer.parent,
      logoUrl: issuer.parentLogoUrl,
      region: issuer.region,
      province: issuer.province,
      status: "",
      statuses: [],
      tag: issuer.tag,
      parent: "",
      parentName: "",
      parentLogoUrl: "",
      aliases: [],
      isRetired: false,
    };
    const family = families.get(parentKey) || { ...parent, children: [] };
    family.children!.push(issuer);
    families.set(parentKey, family);
    nested.add(issuer.issuerKey);
  });
  const items = issuers
    .filter((issuer) => !nested.has(issuer.issuerKey))
    .map(
      (issuer) => families.get(issuer.issuerKey) || { ...issuer, children: [] },
    );
  families.forEach((family, key) => {
    if (!issuers.some((issuer) => issuer.issuerKey === key)) items.push(family);
  });
  items.forEach((item) => {
    item.children?.sort((a, b) => compareText(a.name, b.name));
    item.isRetired =
      item.isRetired ||
      Boolean(
        item.children?.length &&
        item.children.every((child) => child.isRetired),
      );
  });
  const groups = new Map<string, CollectionGroup>();
  items.forEach((issuer) => {
    const category =
      bankTagLabels[issuer.tag] && ["state", "stock"].includes(issuer.tag)
        ? { key: "national", title: "全国性", kind: "national" as const }
        : mode === "simple"
          ? ["foreign"].includes(issuer.tag) ||
            (issuer.tag === "digital" && issuer.region !== "CN")
            ? { key: "foreign", title: "外资", kind: "foreign" as const }
            : { key: "regional", title: "区域性", kind: "regional" as const }
          : issuer.region === "CN"
            ? {
                key: `CN:${issuer.province || "中国大陆"}`,
                title: issuer.province || "中国大陆",
                kind: "china-province" as const,
                region: "CN",
              }
            : {
                key: `region:${issuer.region || "other"}`,
                title: regionName(issuer.region),
                kind: "region" as const,
                region: issuer.region,
              };
    const group = groups.get(category.key) || { ...category, items: [] };
    group.items.push(issuer);
    groups.set(category.key, group);
  });
  const simpleOrder = ["national", "foreign", "regional"];
  const tagOrder = (kind: CollectionGroup["kind"]) =>
    kind === "national"
      ? ["state", "stock"]
      : kind === "china-province"
        ? ["foreign", "city", "rural", "private", "village"]
        : [];
  const tagRank = (kind: CollectionGroup["kind"], tag: string) => {
    const index = tagOrder(kind).indexOf(tag);
    return index < 0 ? tagOrder(kind).length : index;
  };
  const regionRank = (region: string) =>
    regions.continents
      .flatMap((continent) => continent.countries || [])
      .findIndex((item) => item.code === region);
  return [...groups.values()]
    .map((group) => ({
      ...group,
      items: group.items.sort(
        (a, b) =>
          tagRank(group.kind, a.tag) - tagRank(group.kind, b.tag) ||
          compareText(a.name, b.name),
      ),
    }))
    .sort((a, b) => {
      if (mode === "simple")
        return simpleOrder.indexOf(a.kind) - simpleOrder.indexOf(b.kind);
      if (a.kind === "national" || b.kind === "national")
        return a.kind === "national" ? -1 : 1;
      if (a.kind === "china-province" || b.kind === "china-province")
        return a.kind === "china-province" && b.kind === "china-province"
          ? compareText(a.title, b.title)
          : a.kind === "china-province"
            ? -1
            : 1;
      return (
        (regionRank(a.region || "") < 0
          ? Number.MAX_SAFE_INTEGER
          : regionRank(a.region || "")) -
          (regionRank(b.region || "") < 0
            ? Number.MAX_SAFE_INTEGER
            : regionRank(b.region || "")) || compareText(a.title, b.title)
      );
    });
}
