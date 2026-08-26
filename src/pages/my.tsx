import { ArrowLeft, ArrowRight, Check, Copy, Download, Filter, Search, Sparkles, X } from "lucide-react";
import type { ReactNode } from "react";
import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { CardArtwork, CardImageGallery, CardModal, CardTile } from "../components/CardTile";
import { PageHeading, Shell } from "../components/Shell";
import { SmartLink } from "../components/SmartLink";
import { CardFilterControls, type CardFilterValues, cardMatchesFilters, readGalleryUrlState } from "./gallery";
import { useCards } from "../components/filters";
import { CardTypeStats, Empty, Loading, SegmentedControl } from "../components/ui";
import regions from "../config/regions.json";
import { bankTagLabels, buildCollectionGroups, cardRegionName, compareCards, fetchJson, formatBin, getCollectionIssuers, issuerLogo, loadMyIssuers, siteData, tierAccentClass, tierRank, typeLabels } from "../lib/data";
import type { Card, CollectedIssuer, CollectionGroup, IssuerData, MyIssuersData } from "../lib/types";
const PERSONAL_CARD_TYPES = [
  { id: "Debit", label: "借记卡" },
  { id: "Credit", label: "信用卡" },
  { id: "Prepaid", label: "预付卡" },
  { id: "Transit", label: "交通卡" },
] as const;
const PERSONAL_INITIAL_VISIBLE_COUNT = 4;
export function MyPage() {
  const { cards, loading } = useCards("mine");
  const initialViewState = useMemo(() => {
    const params = new URLSearchParams(location.search);
    const cardView = params.get("cardView");
    const sort = params.get("sort");
    return {
      cardView: (cardView === "physical" || cardView === "virtual"
        ? cardView
        : "all") as "all" | "physical" | "virtual",
      sort: (sort === "organization" || sort === "acquired"
        ? sort
        : "tier") as "tier" | "organization" | "acquired",
    };
  }, []);
  const [cardView, setCardView] = useState(initialViewState.cardView);
  const [sort, setSort] = useState(initialViewState.sort);
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
  const filteredCards = useMemo(
    () =>
      cards
        .filter((card) => cardMatchesFilters(cards, card, filters))
        .filter(
          (card) =>
            cardView === "all" ||
            (cardView === "virtual" ? card.virtual : !card.virtual),
        )
        .sort((a, b) => compareCards(a, b, sort)),
    [cards, filters, cardView, sort],
  );
  const cardGroups = useMemo(
    () =>
      PERSONAL_CARD_TYPES.map((definition) => ({
        ...definition,
        cards: filteredCards.filter((card) => card.type === definition.id),
      })),
    [filteredCards],
  );
  const [active, setActive] = useState<Card | null>(null);
  const [visibleTypeCounts, setVisibleTypeCounts] = useState<
    Record<string, number>
  >({});
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
    if (cardView !== "all") params.set("cardView", cardView);
    if (sort !== "tier") params.set("sort", sort);
    const next = `${location.pathname}${params.toString() ? `?${params}` : ""}${location.hash}`;
    if (`${location.pathname}${location.search}${location.hash}` !== next)
      history.replaceState(null, "", next);
  }, [filters, cardView, sort]);
  const title = "我的卡片";
  return (
    <Shell title={title}>
      <PageHeading
        title={title}
        description="个人卡片资料。"
        action={
          <CardTypeStats
            cards={filteredCards}
            definitions={PERSONAL_CARD_TYPES}
            loading={loading}
            onSelect={(type) => {
              document.getElementById(`my-type-${type}`)?.scrollIntoView({
                behavior: "smooth",
                block: "start",
              });
            }}
          />
        }
      />
      <CardFilterControls
        cards={cards}
        filters={filters}
        onChange={setFilters}
        placeholder="搜索卡片、BIN、发行方或卡组织"
      />
      <div className="mb-7 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
        <SegmentedControl
          label="卡片显示"
          value={cardView}
          onChange={setCardView}
          options={[
            { value: "all", label: "显示所有卡" },
            { value: "physical", label: "只显示实体卡" },
            { value: "virtual", label: "只显示虚拟卡" },
          ]}
        />
        <SegmentedControl
          label="排序方式"
          value={sort}
          onChange={setSort}
          options={[
            { value: "tier", label: "按卡等级排序" },
            { value: "organization", label: "按卡组织排序" },
            { value: "acquired", label: "按获得时间排序" },
          ]}
        />
      </div>
      {loading ? (
        <Loading />
      ) : (
        <div className="grid gap-10">
          {cardGroups.map((group) => (
            <section key={group.id} id={`my-type-${group.id}`} className="scroll-mt-24">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-xl font-bold text-ink dark:text-white">
                  {group.label}
                </h2>
                <span className="text-sm text-muted">
                  {group.cards.length} 张
                </span>
              </div>
              {group.cards.length ? (
                <>
                  <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                    {group.cards
                      .slice(
                        0,
                        visibleTypeCounts[group.id] ??
                          PERSONAL_INITIAL_VISIBLE_COUNT,
                      )
                      .map((card) => (
                        <CardTile
                          key={card.id}
                          card={card}
                          onOpen={setActive}
                        />
                      ))}
                  </div>
                  {(visibleTypeCounts[group.id] ??
                    PERSONAL_INITIAL_VISIBLE_COUNT) < group.cards.length && (
                    <div className="mt-5 flex flex-wrap justify-center gap-3">
                      <button
                        className="quiet-button"
                        onClick={() =>
                          setVisibleTypeCounts((current) => ({
                            ...current,
                            [group.id]: Math.min(
                              (current[group.id] ??
                                PERSONAL_INITIAL_VISIBLE_COUNT) +
                                PERSONAL_INITIAL_VISIBLE_COUNT,
                              group.cards.length,
                            ),
                          }))
                        }
                      >
                        展示更多
                      </button>
                      <button
                        className="quiet-button"
                        onClick={() =>
                          setVisibleTypeCounts((current) => ({
                            ...current,
                            [group.id]: group.cards.length,
                          }))
                        }
                      >
                        展示全部
                      </button>
                    </div>
                  )}
                </>
              ) : (
                <div className="rounded-lg border border-dashed border-line p-6 text-center text-sm text-muted">
                  暂无符合条件的卡片。
                </div>
              )}
            </section>
          ))}
        </div>
      )}
      <CardModal card={active} onClose={() => setActive(null)} />
    </Shell>
  );
}
