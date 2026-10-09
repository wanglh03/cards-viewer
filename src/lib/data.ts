import regions from "../config/regions.json";
import navigation from "../config/navigation.json";
import footerLinks from "../config/footer-links.json";
import type {
  Card,
  CollectionGroup,
  CollectedIssuer,
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

export function organizationLogo(
  organization: string,
  origin = siteData.assetOrigin!,
) {
  const key = organizationIcons[organization] || "";
  return key ? assetUrl(`logo/${key}`, origin) : "";
}

export type CardPage = "gallery" | "bin" | "withdrawal" | "my" | "wallet" | "credit";
type PageBank = {
  key: string; name?: string; englishName?: string; tag?: string;
  region?: string; province?: string; logo?: string; imageFolder?: string;
  parent?: string; parentName?: string; parentLogo?: string; parentTag?: string;
  parentRegion?: string; parentProvince?: string;
};
type PageCards = { issuers: PageBank[]; cards: (Partial<Card> & { issuer: number })[] };

const jsonRequests = new Map<string, Promise<unknown>>();

export function fetchJson<T>(url: string): Promise<T | null> {
  let request = jsonRequests.get(url);
  if (!request) {
    request = fetch(url).then(async (response) => {
      if (!response.ok) throw new Error(`${response.status}`);
      return response.json();
    }).catch((error) => {
      jsonRequests.delete(url);
      console.warn("Unable to load page data", error);
      return null;
    });
    jsonRequests.set(url, request);
  }
  return request as Promise<T | null>;
}

function pageImage(bank: PageBank, value: string | undefined) {
  return value ? new URL(value, assetUrl(bank.imageFolder || "issuers/")).href : "";
}

export async function loadCards(page: CardPage = "gallery"): Promise<Card[]> {
  const payload = await fetchJson<PageCards>(`/json/${page}.json`);
  if (!payload) return [];
  return payload.cards.map((raw, index) => {
    const bank = payload.issuers[raw.issuer];
    const { issuer: _issuerIndex, ...card } = raw;
    return {
      name: "", organization: "", tier: "", type: page === "credit" ? "Credit" : "",
      bin: "", length: "", currency: [], status: page === "credit" ? "active" : "",
      ...card,
      id: `${bank.key}-${index}`,
      issuer: bank.name || bank.key,
      bankKey: bank.key, bankNativeName: bank.name || bank.key,
      bankEnglishName: bank.englishName || bank.key, bankTag: bank.tag || "others",
      bankLogoUrl: issuerLogo(bank.key, bank.logo || ""),
      region: bank.region || "", province: bank.province || "",
      bankParent: bank.parent || "", bankParentName: bank.parentName || "",
      bankParentLogoUrl: issuerLogo(bank.parent || "", bank.parentLogo || ""),
      bankParentTag: bank.parentTag || "", bankParentRegion: bank.parentRegion || "",
      bankParentProvince: bank.parentProvince || "",
      image: pageImage(bank, card.image),
      altImageUrl: pageImage(bank, card.altImageUrl),
      backImageUrl: pageImage(bank, card.backImageUrl),
      organizationIconUrl: organizationLogo(card.organization || ""),
    };
  });
}

export async function loadCollection(): Promise<CollectedIssuer[]> {
  const data = await fetchJson<Partial<CollectedIssuer>[]>("/json/collection.json");
  return (data || []).map((raw) => ({
    issuerKey: "", name: "", region: "", province: "", tag: "others",
    parent: "", parentName: "", aliases: [], isRetired: false,
    ...raw,
    status: "", statuses: [],
    logoUrl: issuerLogo(raw.issuerKey || "", raw.logoUrl || ""),
    parentLogoUrl: issuerLogo(raw.parent || "", raw.parentLogoUrl || ""),
  }));
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

export type IssuerIndex = {
  aliases: Map<string, string>;
  parentMap: Map<string, string>;
};

const issuerIndexCache = new WeakMap<Card[], IssuerIndex>();

export function buildIssuerIndex(cards: Card[]): IssuerIndex {
  const cached = issuerIndexCache.get(cards);
  if (cached) return cached;

  const aliases = new Map<string, string>();
  cards.forEach((card) => {
    const value = getIssuerValue(card);
    if (!value) return;
    [value, card.bankKey, card.bankNativeName]
      .filter(Boolean)
      .forEach((alias) => aliases.set(String(alias).toLowerCase(), value));
  });

  const parentMap = new Map<string, string>();
  cards.forEach((card) => {
    if (!card.bankParent) return;
    parentMap.set(
      getIssuerValue(card),
      aliases.get(card.bankParent.toLowerCase()) || card.bankParent,
    );
  });

  const index = { aliases, parentMap };
  issuerIndexCache.set(cards, index);
  return index;
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

export function issuerMatches(
  cards: Card[],
  card: Card,
  target: string,
  index = buildIssuerIndex(cards),
) {
  if (!target || target === "all") return true;
  const resolvedTarget = index.aliases.get(target.toLowerCase()) || target;
  let value = getIssuerValue(card);
  const seen = new Set<string>();
  while (value && !seen.has(value)) {
    if (value === resolvedTarget) return true;
    seen.add(value);
    value = index.parentMap.get(value) || "";
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
