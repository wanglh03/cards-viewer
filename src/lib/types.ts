export type Card = {
  id: string;
  name: string;
  issuer: string;
  bankKey: string;
  bankTag: string;
  bankLogoUrl: string;
  bankNativeName: string;
  bankEnglishName: string;
  bankParent: string;
  bankParentTag?: string;
  bankParentName?: string;
  bankParentLogoUrl?: string;
  bankParentRegion?: string;
  bankParentProvince?: string;
  region: string;
  province: string;
  image: string;
  altImageUrl?: string;
  backImageUrl?: string;
  organization: string;
  tier: string;
  type: string;
  bin: string;
  length: string;
  currency: string[];
  desc?: string;
  benefit?: string;
  status?: string;
  virtual?: boolean;
  acquired?: string;
  limit?: string;
  limitMap?: Record<string, string | number>;
  sharedLimit?: boolean;
  supplementary?: boolean;
  billingDay?: string;
  dueDay?: string;
  annualFee?: string;
  ftf?: string;
  branch?: string;
  baseName?: string;
  organizationIconUrl?: string;
  withdrawal?: unknown;
  withdrawalExchange?: Record<string, any> | null;
  withdrawalCurrencyRules?: Record<string, any> | null;
  cardCurrency?: string;
};

export type SiteData = {
  navigation?: {
    brand?: { label: string; mark: string; url: string };
    items?: NavigationItem[];
    github?: { enabled?: boolean; url?: string };
  };
  regions?: {
    continents?: {
      code: string;
      name_zh: string;
      countries?: { code: string; name_zh: string }[];
    }[];
  };
  allCardsUrl?: string;
  myCardsUrl?: string;
  mycardsUrl?: string;
  assetOrigin?: string;
};

export type NavigationItem = {
  label: string;
  url?: string;
  source?: "footer";
  section?: string;
  children?: NavigationItem[];
};

export type IssuerData = Record<
  string,
  {
    bank?: Record<string, any>;
    issuer?: Record<string, any>;
    cards?: any[];
    [key: string]: unknown;
  }
>;

export type MyIssuerRecord = {
  issuer?: string;
  nativeName?: string;
  native_name?: string;
  name?: string;
  issuerName?: string;
  issuer_name?: string;
  logo?: string;
  activeCardNum?: number | string;
  virtualCardNum?: number | string;
  branch?: string | string[] | Record<string, string | string[]>;
  tel?: string | string[] | Record<string, string | string[]>;
  url?: string;
};

export type MyIssuersData = Record<string, MyIssuerRecord[]>;

export type IssuerOption = {
  value: string;
  label: string;
  tag: string;
  logoUrl?: string;
};

export type CollectedIssuer = {
  issuerKey: string;
  name: string;
  logoUrl: string;
  region: string;
  province: string;
  status: string;
  statuses: string[];
  tag: string;
  parent: string;
  parentName: string;
  parentLogoUrl: string;
  aliases: string[];
  isRetired: boolean;
  children?: CollectedIssuer[];
};

export type CollectionGroup = {
  key: string;
  title: string;
  kind: "national" | "foreign" | "regional" | "china-province" | "region";
  region?: string;
  items: CollectedIssuer[];
};
