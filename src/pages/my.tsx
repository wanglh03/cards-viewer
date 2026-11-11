import { useMemo, useState } from "react";
import { CardModal, CardTile } from "../components/CardTile";
import { CardFilterControls } from "../components/filters";
import { PageHeading, Shell } from "../components/Shell";
import { CardTypeStats, Empty, Loading, SegmentedControl } from "../components/ui";
import { compareCards } from "../lib/data";
import {
  cardMatchesFilters,
  readFiltersFromUrl,
  useFilterUrlSync,
  type CardFilterValues,
} from "../lib/filters";
import { useCards } from "../lib/hooks";
import type { Card } from "../lib/types";

const PERSONAL_CARD_TYPES = [
  { id: "Debit", label: "借记卡" },
  { id: "Credit", label: "信用卡" },
  { id: "Prepaid", label: "预付卡" },
  { id: "Transit", label: "交通卡" },
] as const;

const INITIAL_VISIBLE = 4;
type CardView = "all" | "physical" | "virtual";
type SortMode = "tier" | "organization" | "acquired";

function readViewState() {
  const params = new URLSearchParams(location.search);
  const cardView = params.get("cardView");
  const sort = params.get("sort");
  return {
    cardView: (cardView === "physical" || cardView === "virtual"
      ? cardView
      : "all") as CardView,
    sort: (sort === "organization" || sort === "acquired"
      ? sort
      : "tier") as SortMode,
  };
}

export function MyPage() {
  const { cards, loading } = useCards("my");
  const [viewState, setViewState] = useState(readViewState);
  const { cardView, sort } = viewState;
  const [filters, setFilters] = useState<CardFilterValues>(() =>
    readFiltersFromUrl({ type: "all" }),
  );
  const [active, setActive] = useState<Card | null>(null);
  const [visibleCounts, setVisibleCounts] = useState<Record<string, number>>({});

  const filteredCards = useMemo(
    () =>
      cards
        .filter((card) => cardMatchesFilters(cards, card, filters))
        .filter((card) =>
          cardView === "all"
            ? true
            : cardView === "virtual"
              ? card.virtual
              : !card.virtual,
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

  useFilterUrlSync(filters, {
    cardView: cardView !== "all" ? cardView : undefined,
    sort: sort !== "tier" ? sort : undefined,
  });

  return (
    <Shell title="我的卡片">
      <PageHeading
        title="我的卡片"
        description="个人卡片资料。"
        action={
          <CardTypeStats
            cards={filteredCards}
            definitions={PERSONAL_CARD_TYPES}
            loading={loading}
            onSelect={(type) =>
              document.getElementById(`my-type-${type}`)?.scrollIntoView({
                behavior: "smooth",
                block: "start",
              })
            }
          />
        }
      />
      <CardFilterControls
        cards={cards}
        filters={filters}
        onChange={setFilters}
        placeholder="搜索卡片、BIN、发行方或卡组织"
        fourthFilter="status"
      />
      <p className="mb-7 text-sm text-muted">
        共 {loading ? "…" : filteredCards.length} 张卡片
      </p>
      <div className="mb-7 flex flex-col gap-3 lg:flex-row lg:items-center">
        <SegmentedControl
          label="卡片显示"
          value={cardView}
          onChange={(value) => setViewState((current) => ({ ...current, cardView: value }))}
          options={[
            { value: "all", label: "全部卡片" },
            { value: "physical", label: "实体卡" },
            { value: "virtual", label: "虚拟卡" },
          ]}
        />
        <SegmentedControl
          label="排序方式"
          value={sort}
          onChange={(value) => setViewState((current) => ({ ...current, sort: value }))}
          options={[
            { value: "tier", label: "按卡等级" },
            { value: "organization", label: "按卡组织" },
            { value: "acquired", label: "按获得时间" },
          ]}
        />
      </div>

      {loading ? (
        <Loading />
      ) : !filteredCards.length ? (
        <Empty text="暂无符合条件的卡片。" />
      ) : (
        <div className="grid gap-10">
          {cardGroups.map((group) => {
            if (!group.cards.length) return null;
            const visible =
              visibleCounts[group.id] ?? INITIAL_VISIBLE;
            return (
              <section
                key={group.id}
                id={`my-type-${group.id}`}
                className="scroll-mt-24"
              >
                <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                  <h2 className="text-xl font-bold text-ink">{group.label}</h2>
                  <span className="text-sm text-muted">
                    {group.cards.length} 张
                  </span>
                </div>
                <div className="card-grid">
                  {group.cards.slice(0, visible).map((card) => (
                    <CardTile key={card.id} card={card} onOpen={setActive} />
                  ))}
                </div>
                {visible < group.cards.length && (
                  <div className="mt-5 flex flex-wrap justify-center gap-3">
                    <button
                      type="button"
                      className="quiet-button"
                      onClick={() =>
                        setVisibleCounts((current) => ({
                          ...current,
                          [group.id]: Math.min(
                            visible + INITIAL_VISIBLE,
                            group.cards.length,
                          ),
                        }))
                      }
                    >
                      展示更多
                    </button>
                    <button
                      type="button"
                      className="quiet-button"
                      onClick={() =>
                        setVisibleCounts((current) => ({
                          ...current,
                          [group.id]: group.cards.length,
                        }))
                      }
                    >
                      展示全部
                    </button>
                  </div>
                )}
              </section>
            );
          })}
        </div>
      )}
      <CardModal card={active} onClose={() => setActive(null)} showPersonalDetails />
    </Shell>
  );
}
