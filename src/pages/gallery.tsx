import { Search } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type { Dispatch, SetStateAction } from "react";
import { motion } from "motion/react";
import { CardModal, CardTile } from "../components/CardTile";
import { PageHeading, Shell } from "../components/Shell";
import { IssuerFilter, RegionIssuerFilter, RegionSelection, useCards } from "../components/filters";
import { Empty, GalleryPagination, Loading, Pagination, Select } from "../components/ui";
import {
  compareCards,
  formatBin,
  getIssuerOptions,
  issuerMatches,
  organizations,
  tierAccentClass,
  tierRank,
  typeLabels,
  types,
} from "../lib/data";
import type { Card } from "../lib/types";

type GalleryPageSize = number | "all";

export function GalleryPage() {
  const { cards, loading } = useCards();
  const initialUrlState = useMemo(readGalleryUrlState, []);
  const [query, setQuery] = useState(initialUrlState.search);
  const [org, setOrg] = useState(initialUrlState.organization);
  const [type, setType] = useState(initialUrlState.type);
  const [issuer, setIssuer] = useState(initialUrlState.issuer);
  const [issuerTag, setIssuerTag] = useState(initialUrlState.issuerTag);
  const [regionSelection, setRegionSelection] = useState<RegionSelection>(
    initialUrlState.region,
  );
  const [page, setPage] = useState(initialUrlState.page);
  const [pageSize, setPageSize] = useState<GalleryPageSize>(
    initialUrlState.pageSize,
  );
  const [active, setActive] = useState<Card | null>(null);
  const issuerOptions = useMemo(() => getIssuerOptions(cards), [cards]);
  const filtered = useMemo(
    () =>
      cards
        .filter((card) => {
          const searchText = [
            card.name,
            card.bin,
            card.issuer,
            card.bankNativeName,
            card.bankEnglishName,
            card.organization,
            card.tier,
            card.type,
            card.region,
            card.province,
          ]
            .join(" ")
            .toLowerCase();
          const matchesRegion =
            regionSelection.kind === "all" ||
            (regionSelection.kind === "region" &&
              card.region === regionSelection.region) ||
            (regionSelection.kind === "province" &&
              card.region === "CN" &&
              card.province === regionSelection.province) ||
            (regionSelection.kind === "issuer" &&
              card.region === regionSelection.region &&
              (!regionSelection.province ||
                card.province === regionSelection.province) &&
              issuerMatches(cards, card, regionSelection.issuer || "all"));
          return (
            (!query || searchText.includes(query.toLowerCase())) &&
            (org === "all" || card.organization === org) &&
            (type === "all" || card.type === type) &&
            (issuerTag === "all" || card.bankTag === issuerTag) &&
            (issuer === "all" || issuerMatches(cards, card, issuer)) &&
            matchesRegion
          );
        })
        .sort((a, b) => compareCards(a, b, "tier")),
    [cards, query, org, type, issuer, issuerTag, regionSelection],
  );
  const pages =
    pageSize === "all" ? 1 : Math.max(1, Math.ceil(filtered.length / pageSize));
  const visible =
    pageSize === "all" ? filtered : filtered.slice((page - 1) * pageSize, page * pageSize);
  useEffect(() => {
    if (!loading) setPage((current) => Math.min(current, pages));
  }, [loading, pages]);
  useEffect(() => {
    const params = new URLSearchParams();
    if (query.trim()) params.set("search", query.trim());
    if (issuer !== "all") params.set("issuer", `bank:${issuer}`);
    else if (issuerTag !== "all") params.set("issuer", `tag:${issuerTag}`);
    if (org !== "all") params.set("organization", org);
    if (regionSelection.kind === "region" && regionSelection.region)
      params.set("region", regionSelection.region);
    if (regionSelection.kind === "province" && regionSelection.province)
      params.set("region", `CN:${regionSelection.province}`);
    if (
      regionSelection.kind === "issuer" &&
      regionSelection.region &&
      regionSelection.issuer
    )
      params.set(
        "region",
        `${regionSelection.region}:${regionSelection.province ? `${regionSelection.province}:` : ""}${regionSelection.issuer}`,
      );
    if (type !== "all") params.set("type", type);
    if (page > 1) params.set("page", String(page));
    if (pageSize !== 12) params.set("pageSize", String(pageSize));
    const nextQuery = params.toString();
    const nextUrl = `${location.pathname}${nextQuery ? `?${nextQuery}` : ""}${location.hash}`;
    if (`${location.pathname}${location.search}${location.hash}` !== nextUrl)
      history.replaceState(null, "", nextUrl);
  }, [query, org, type, issuer, issuerTag, regionSelection, page, pageSize]);
  const issuerFilterActive = issuer !== "all" || issuerTag !== "all";
  const regionIssuerFilterActive = regionSelection.kind !== "all";
  return (
    <Shell title="卡面图鉴">
      <PageHeading
        title="卡面图鉴"
        description="浏览发行方、卡组织与地区资料，快速找到你要的卡面。"
        action={
          <span className="rounded-full bg-accent/10 px-3 py-2 text-sm font-semibold text-accent">
            {loading ? "加载中" : `${filtered.length} 张卡面`}
          </span>
        }
      />
      <label className="relative mb-4 block">
        <Search
          size={17}
          className="absolute left-3 top-1/2 -translate-y-1/2 text-muted"
        />
        <input
          value={query}
          onChange={(e) => {
            setPage(1);
            setQuery(e.target.value);
          }}
          className="control w-full pl-10"
          placeholder="搜索卡片、发行方或卡组织"
        />
      </label>
      <section
        aria-label="主筛选"
        className="mb-6 grid gap-3 md:grid-cols-2 lg:grid-cols-4"
      >
        <IssuerFilter
          disabled={regionIssuerFilterActive}
          value={issuer}
          onChange={(value) => {
            setPage(1);
            setIssuer(value);
            setIssuerTag("all");
            if (value !== "all") setRegionSelection({ kind: "all" });
          }}
          options={issuerOptions}
          tag={issuerTag}
          onTagChange={(value) => {
            setPage(1);
            setIssuerTag(value);
            setIssuer("all");
            if (value !== "all") setRegionSelection({ kind: "all" });
          }}
        />
        <RegionIssuerFilter
          disabled={issuerFilterActive}
          cards={cards}
          value={regionSelection}
          onChange={(next) => {
            setPage(1);
            setRegionSelection(next);
            if (next.kind !== "all") {
              setIssuer("all");
              setIssuerTag("all");
            }
          }}
        />
        <Select
          value={org}
          onChange={(value) => {
            setPage(1);
            setOrg(value);
          }}
          options={organizations}
          label="全部卡组织"
        />
        <Select
          value={type}
          onChange={(value) => {
            setPage(1);
            setType(value);
          }}
          options={types}
          label="全部卡类型"
          labelMap={typeLabels}
        />
      </section>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3 text-sm text-muted">
        <span>
          第 {Math.min(page, pages)} / {pages} 页 · {visible.length} 项
        </span>
        <label className="flex items-center gap-2">
          每页{" "}
          <select
            className="control min-h-9 py-1"
            value={pageSize}
            onChange={(e) => {
              setPage(1);
              setPageSize(Number(e.target.value));
            }}
          >
            <option value="12">12</option>
            <option value="20">20</option>
            <option value="60">60</option>
            <option value="100">100</option>
          </select>
        </label>
      </div>
      {loading ? (
        <Loading />
      ) : visible.length ? (
        <motion.div
          layout
          className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
        >
          {visible.map((card) => (
            <CardTile key={card.id} card={card} onOpen={setActive} />
          ))}
        </motion.div>
      ) : (
        <Empty text="没有符合条件的卡片。" />
      )}
      <GalleryPagination
        page={Math.min(page, pages)}
        pages={pages}
        pageSize={pageSize}
        onPageChange={setPage}
        onPageSizeChange={(nextPageSize) => {
          setPage(1);
          setPageSize(nextPageSize);
        }}
      />
      <CardModal card={active} onClose={() => setActive(null)} />
    </Shell>
  );
}

export function readGalleryUrlState(): {
  search: string;
  organization: string;
  issuer: string;
  issuerTag: string;
  region: RegionSelection;
  type: string;
  page: number;
  pageSize: GalleryPageSize;
} {
  const params = new URLSearchParams(location.search);
  const issuerQuery = params.get("issuer") || "all";
  const issuerTag = issuerQuery.startsWith("tag:")
    ? issuerQuery.slice(4)
    : "all";
  const issuer = issuerQuery.startsWith("bank:") ? issuerQuery.slice(5) : "all";
  const regionQuery = params.get("region") || "all";
  let region: RegionSelection = { kind: "all" };
  const regionParts = regionQuery.split(":");
  if (/^[A-Za-z]{2}$/.test(regionParts[0] || "")) {
    if (regionParts.length > 1)
      region = {
        kind: "issuer",
        region: regionParts[0],
        province: regionParts[0] === "CN" ? regionParts[1] || "" : "",
        issuer: regionParts.slice(regionParts[0] === "CN" ? 2 : 1).join(":"),
      };
    else region = { kind: "region", region: regionParts[0] };
    if (regionParts[0] === "CN" && regionParts.length === 2)
      region = { kind: "province", region: "CN", province: regionParts[1] };
  }
  const requestedPageSize = params.get("pageSize");
  return {
    search: params.get("search") || "",
    organization: organizations.includes(params.get("organization") || "")
      ? (params.get("organization") as string)
      : "all",
    issuer,
    issuerTag,
    region,
    type: types.includes(params.get("type") || "")
      ? (params.get("type") as string)
      : "all",
    page: Math.max(1, Number(params.get("page")) || 1),
    pageSize:
      requestedPageSize === "all"
        ? "all"
        : [12, 20, 60, 100].includes(Number(requestedPageSize))
          ? Number(requestedPageSize)
          : 12,
  };
}

export type CardFilterValues = {
  query: string;
  organization: string;
  type: string;
  issuer: string;
  issuerTag: string;
  region: RegionSelection;
};

export function cardMatchesFilters(
  cards: Card[],
  card: Card,
  filters: CardFilterValues,
) {
  const searchText = [
    card.name,
    card.bin,
    card.issuer,
    card.bankNativeName,
    card.bankEnglishName,
    card.organization,
    card.tier,
    card.type,
    card.region,
    card.province,
  ]
    .join(" ")
    .toLowerCase();
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
      issuerMatches(cards, card, region.issuer || "all"));
  return (
    (!filters.query || searchText.includes(filters.query.toLowerCase())) &&
    (filters.organization === "all" ||
      card.organization === filters.organization) &&
    (filters.type === "all" || card.type === filters.type) &&
    (filters.issuerTag === "all" || card.bankTag === filters.issuerTag) &&
    (filters.issuer === "all" || issuerMatches(cards, card, filters.issuer)) &&
    matchesRegion
  );
}

export function CardFilterControls({
  cards,
  filters,
  onChange,
  placeholder,
  includeType = true,
}: {
  cards: Card[];
  filters: CardFilterValues;
  onChange: Dispatch<SetStateAction<CardFilterValues>>;
  placeholder: string;
  includeType?: boolean;
}) {
  const issuerOptions = useMemo(() => getIssuerOptions(cards), [cards]);
  const issuerActive = filters.issuer !== "all" || filters.issuerTag !== "all";
  const regionActive = filters.region.kind !== "all";
  const update = (next: Partial<CardFilterValues>) =>
    onChange((current) => ({ ...current, ...next }));
  return (
    <>
      <label className="relative mb-4 block">
        <Search
          size={17}
          className="absolute left-3 top-1/2 -translate-y-1/2 text-muted"
        />
        <input
          className="control w-full pl-10"
          value={filters.query}
          onChange={(event) => update({ query: event.target.value })}
          placeholder={placeholder}
        />
      </label>
      <section
        aria-label="主筛选"
        className={`mb-6 grid gap-3 md:grid-cols-2 ${includeType ? "lg:grid-cols-4" : "lg:grid-cols-3"}`}
      >
        <IssuerFilter
          disabled={regionActive}
          value={filters.issuer}
          onChange={(value) =>
            update({
              issuer: value,
              issuerTag: "all",
              ...(value !== "all" ? { region: { kind: "all" } } : {}),
            })
          }
          options={issuerOptions}
          tag={filters.issuerTag}
          onTagChange={(value) =>
            update({
              issuerTag: value,
              issuer: "all",
              ...(value !== "all" ? { region: { kind: "all" } } : {}),
            })
          }
        />
        <RegionIssuerFilter
          disabled={issuerActive}
          cards={cards}
          value={filters.region}
          onChange={(value) =>
            update({
              region: value,
              ...(value.kind !== "all"
                ? { issuer: "all", issuerTag: "all" }
                : {}),
            })
          }
        />
        <Select
          value={filters.organization}
          onChange={(value) => update({ organization: value })}
          options={organizations}
          label="全部卡组织"
        />
        {includeType && (
          <Select
            value={filters.type}
            onChange={(value) => update({ type: value })}
            options={types}
            label="全部卡类型"
            labelMap={typeLabels}
          />
        )}
      </section>
    </>
  );
}

export type BinRow = {
  bin: string;
  length: string;
  organizations: { url: string; label: string }[];
  tiers: string[];
  types: string[];
  issuers: { name: string; logoUrl: string }[];
  names: string[];
  accent: string;
};

export function buildBinRows(cards: Card[]) {
  const groups = new Map<string, BinRow>();
  cards.forEach((card) => {
    if (!card.bin) return;
    const row = groups.get(card.bin) || {
      bin: card.bin,
      length: card.length || (card.organization === "AMEX" ? "15" : "16"),
      organizations: [],
      tiers: [],
      types: [],
      issuers: [],
      names: [],
      accent: "tier-accent-none",
    };
    if (
      card.organizationIconUrl &&
      !row.organizations.some((item) => item.url === card.organizationIconUrl)
    )
      row.organizations.push({
        url: card.organizationIconUrl,
        label: card.organization,
      });
    if (card.tier && !row.tiers.includes(card.tier)) row.tiers.push(card.tier);
    if (card.type && !row.types.includes(card.type)) row.types.push(card.type);
    const issuerName = card.bankNativeName || card.issuer;
    if (issuerName && !row.issuers.some((item) => item.name === issuerName))
      row.issuers.push({ name: issuerName, logoUrl: card.bankLogoUrl });
    if (card.name && !row.names.includes(card.name)) row.names.push(card.name);
    groups.set(card.bin, row);
  });
  return [...groups.values()]
    .map((row) => ({
      ...row,
      tiers: [...row.tiers].sort((a, b) => tierRank(a) - tierRank(b)),
      accent: tierAccentClass(row.tiers),
    }))
    .sort((a, b) =>
      a.bin.localeCompare(b.bin, "en", { numeric: false, sensitivity: "base" }),
    );
}

export function BinPage() {
  const { cards, loading } = useCards();
  const [filters, setFilters] = useState<CardFilterValues>(() => {
    const initial = readGalleryUrlState();
    return {
      query: initial.search,
      organization: initial.organization,
      type: initial.type,
      issuer: initial.issuer,
      issuerTag: initial.issuerTag,
      region: initial.region,
    };
  });
  const rows = useMemo(() => {
    const filtered = cards.filter(
      (card) => card.bin && cardMatchesFilters(cards, card, filters),
    );
    return buildBinRows(filtered);
  }, [cards, filters]);
  useEffect(() => {
    const params = new URLSearchParams();
    if (filters.query.trim()) params.set("search", filters.query.trim());
    if (filters.issuer !== "all")
      params.set("issuer", `bank:${filters.issuer}`);
    else if (filters.issuerTag !== "all")
      params.set("issuer", `tag:${filters.issuerTag}`);
    if (filters.organization !== "all")
      params.set("organization", filters.organization);
    if (filters.region.kind === "region" && filters.region.region)
      params.set("region", filters.region.region);
    if (filters.region.kind === "province" && filters.region.province)
      params.set("region", `CN:${filters.region.province}`);
    if (
      filters.region.kind === "issuer" &&
      filters.region.region &&
      filters.region.issuer
    )
      params.set(
        "region",
        `${filters.region.region}:${filters.region.province ? `${filters.region.province}:` : ""}${filters.region.issuer}`,
      );
    if (filters.type !== "all") params.set("type", filters.type);
    const next = `${location.pathname}${params.toString() ? `?${params}` : ""}${location.hash}`;
    if (`${location.pathname}${location.search}${location.hash}` !== next)
      history.replaceState(null, "", next);
  }, [filters]);
  return (
    <Shell title="卡 BIN 一览">
      <PageHeading
        title="卡 BIN 一览"
        description="按 BIN、发行方和卡组织检索已整理的卡片信息。"
      />
      <CardFilterControls
        cards={cards}
        filters={filters}
        onChange={setFilters}
        placeholder="搜索 BIN、卡片、发行方或卡组织"
      />
      <div className="panel overflow-x-auto">
        <table className="bin-table w-full min-w-[1000px] text-left text-sm">
          <thead className="bg-soft text-sm tracking-wide text-muted">
            <tr>
              {["卡 BIN", "位数", "卡组织", "等级", "类型", "发行方", "卡片名称"].map(
                (label, index) => (
                  <th
                    key={label}
                    className={`px-4 py-3 font-bold ${index === 2 ? "min-w-[80px]" : ""}`}
                  >
                    {label}
                  </th>
                ),
              )}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={7}>
                  <Loading />
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr
                  key={row.bin}
                  className={row.accent.replace("tier-accent", "bin-tier-accent")}
                >
                  <td className="px-4 py-3 font-mono font-semibold">
                    {formatBin(row.bin)}
                  </td>
                  <td className="px-4 py-3">{row.length}</td>
                  <td className="min-w-[80px] px-4 py-3">
                    {row.organizations.length ? (
                      <div className="flex flex-wrap gap-2">
                        {row.organizations.map((item) => (
                          <img
                            key={item.url}
                            src={item.url}
                            alt={item.label}
                            title={item.label}
                            className="bin-logo"
                          />
                        ))}
                      </div>
                    ) : (
                      ""
                    )}
                  </td>
                  <td className="bin-tier-cell px-4 py-3">{row.tiers.join("    ")}</td>
                  <td className="bin-name-cell px-4 py-3">{row.types.join("    ")}</td>
                  <td className="px-4 py-3">
                    <div className="grid gap-2">
                      {row.issuers.map((item) => (
                        <span
                          key={item.name}
                          className="flex items-center gap-2 whitespace-nowrap"
                        >
                          {item.logoUrl && (
                            <img src={item.logoUrl} alt="" className="bin-issuer-logo" />
                          )}
                          {item.name}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="bin-name-cell px-4 py-3">{row.names.join("    ")}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      {!loading && !rows.length && <Empty text="没有找到 BIN 数据。" />}
    </Shell>
  );
}
