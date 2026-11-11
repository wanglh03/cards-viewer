import { useEffect } from "react";
import {
  buildIssuerIndex,
  getIssuerOptions,
  issuerMatches,
  organizations,
  statusLabels,
  types,
} from "./data";
import type { Card } from "./types";

export type RegionSelection = {
  kind: "all" | "region" | "province" | "issuer";
  region?: string;
  province?: string;
  issuer?: string;
};

export type CardFilterValues = {
  query: string;
  organization: string;
  type: string;
  status?: string;
  issuer: string;
  issuerTag: string;
  region: RegionSelection;
};

function cardSearchText(card: Card) {
  return [
    card.name,
    card.bin,
    card.issuer,
    card.bankNativeName,
    card.bankEnglishName,
    card.organization,
    card.tier,
    card.type,
    card.status,
    card.region,
    card.province,
  ]
    .join(" ")
    .toLowerCase();
}

export function cardMatchesFilters(
  cards: Card[],
  card: Card,
  filters: CardFilterValues,
  issuerIndex = buildIssuerIndex(cards),
) {
  const { region } = filters;
  const matchesRegion =
    region.kind === "all" ||
    (region.kind === "region" && card.region === region.region) ||
    (region.kind === "province" &&
      card.region === "CN" &&
      card.province === region.province) ||
    (region.kind === "issuer" &&
      card.region === region.region &&
      (!region.province || card.province === region.province) &&
      issuerMatches(cards, card, region.issuer || "all", issuerIndex));
  return (
    (!filters.query || cardSearchText(card).includes(filters.query.toLowerCase())) &&
    (filters.organization === "all" ||
      card.organization === filters.organization) &&
    (filters.type === "all" || card.type === filters.type) &&
    (!filters.status ||
      filters.status === "all" ||
      card.status === filters.status) &&
    (filters.issuerTag === "all" || card.bankTag === filters.issuerTag) &&
    (filters.issuer === "all" ||
      issuerMatches(cards, card, filters.issuer, issuerIndex)) &&
    matchesRegion
  );
}

export type CardFilterDimension =
  | "issuer"
  | "region"
  | "organization"
  | "type"
  | "status";

/** Cards that could still match if the given filter dimension were reset. */
export function getPotentialFilterCards(
  cards: Card[],
  filters: CardFilterValues,
  dimension: CardFilterDimension,
  issuerIndex = buildIssuerIndex(cards),
) {
  const candidateFilters: CardFilterValues = {
    ...filters,
    issuer: dimension === "issuer" ? "all" : filters.issuer,
    issuerTag: dimension === "issuer" ? "all" : filters.issuerTag,
    region: dimension === "region" ? { kind: "all" } : filters.region,
    organization: dimension === "organization" ? "all" : filters.organization,
    type: dimension === "type" ? "all" : filters.type,
    status: dimension === "status" ? "all" : filters.status,
  };
  return cards.filter((card) =>
    cardMatchesFilters(cards, card, candidateFilters, issuerIndex),
  );
}

export function parseRegionSelection(value: string): RegionSelection {
  const parts = value.split(":");
  const region = parts[0] || "";
  if (!/^[A-Za-z]{2}$/.test(region)) return { kind: "all" };
  const rest = parts.slice(1);
  if (region === "CN") {
    if (rest.length === 1) return { kind: "province", region, province: rest[0] };
    if (rest.length >= 2)
      return {
        kind: "issuer",
        region,
        province: rest[0],
        issuer: rest.slice(1).join(":"),
      };
  }
  if (rest.length)
    return { kind: "issuer", region, province: "", issuer: rest.join(":") };
  return { kind: "region", region };
}

export function readFiltersFromUrl(
  overrides: Partial<CardFilterValues> = {},
): CardFilterValues {
  const params = new URLSearchParams(location.search);
  const issuerQuery = params.get("issuer") || "all";
  const organization = params.get("organization") || "";
  const type = params.get("type") || "";
  const status = params.get("status") || "";
  return {
    query: params.get("search") || "",
    organization: organizations.includes(organization) ? organization : "all",
    type: types.includes(type) ? type : "all",
    status: Object.prototype.hasOwnProperty.call(statusLabels, status)
      ? status
      : "all",
    issuer: issuerQuery.startsWith("bank:") ? issuerQuery.slice(5) : "all",
    issuerTag: issuerQuery.startsWith("tag:") ? issuerQuery.slice(4) : "all",
    region: parseRegionSelection(params.get("region") || "all"),
    ...overrides,
  };
}

export function buildFilterSearch(filters: CardFilterValues) {
  const params = new URLSearchParams();
  if (filters.query.trim()) params.set("search", filters.query.trim());
  if (filters.issuer !== "all") params.set("issuer", `bank:${filters.issuer}`);
  else if (filters.issuerTag !== "all")
    params.set("issuer", `tag:${filters.issuerTag}`);
  if (filters.organization !== "all")
    params.set("organization", filters.organization);
  const { region } = filters;
  if (region.kind === "region" && region.region)
    params.set("region", region.region);
  if (region.kind === "province" && region.province)
    params.set("region", `CN:${region.province}`);
  if (region.kind === "issuer" && region.region && region.issuer)
    params.set(
      "region",
      `${region.region}:${region.province ? `${region.province}:` : ""}${region.issuer}`,
    );
  if (filters.type !== "all") params.set("type", filters.type);
  if (filters.status && filters.status !== "all")
    params.set("status", filters.status);
  return params;
}

export type ExtraFilterParams = Record<string, string | number | undefined>;

/** Mirror the current filter state into the address bar without a reload. */
export function useFilterUrlSync(
  filters: CardFilterValues,
  extras: ExtraFilterParams = {},
) {
  const extrasKey = JSON.stringify(extras);
  useEffect(() => {
    const params = buildFilterSearch(filters);
    Object.entries(JSON.parse(extrasKey) as ExtraFilterParams).forEach(
      ([key, value]) => {
        if (value === undefined || value === "" || value === "all") return;
        params.set(key, String(value));
      },
    );
    const query = params.toString();
    const next = `${location.pathname}${query ? `?${query}` : ""}${location.hash}`;
    const current = `${location.pathname}${location.search}${location.hash}`;
    if (current !== next) history.replaceState(null, "", next);
  }, [filters, extrasKey]);
}

export function filterOptionLists(
  cards: Card[],
  filters: CardFilterValues,
  issuerIndex = buildIssuerIndex(cards),
) {
  const potential = (dimension: CardFilterDimension) =>
    getPotentialFilterCards(cards, filters, dimension, issuerIndex);
  const organizationCards = potential("organization");
  const typeCards = potential("type");
  const statusCards = potential("status");
  return {
    issuerOptions: getIssuerOptions(potential("issuer")),
    regionCards: potential("region"),
    organizationOptions: organizations.filter((organization) =>
      organizationCards.some((card) => card.organization === organization),
    ),
    typeOptions: types.filter((type) =>
      typeCards.some((card) => card.type === type),
    ),
    statusOptions: Object.keys(statusLabels).filter((status) =>
      statusCards.some((card) => card.status === status),
    ),
  };
}
