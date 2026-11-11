import { useEffect, useMemo, useState } from "react";
import type { Dispatch, SetStateAction } from "react";
import { CardModal, CardTile } from "../components/CardTile";
import { CardFilterControls } from "../components/filters";
import { PageHeading, Shell } from "../components/Shell";
import { Empty, GalleryPagination, Loading } from "../components/ui";
import { buildIssuerIndex, compareCards } from "../lib/data";
import {
  cardMatchesFilters,
  readFiltersFromUrl,
  useFilterUrlSync,
  type CardFilterValues,
} from "../lib/filters";
import { useCards } from "../lib/hooks";
import type { Card } from "../lib/types";

const PAGE_SIZES = [12, 20, 60, 100];
export type GalleryPageSize = number | "all";

export function GalleryPage() {
  const { cards, loading } = useCards("gallery");
  const [initial] = useState(readGalleryUrlState);
  const [filters, setFiltersState] = useState<CardFilterValues>(initial.filters);
  const [page, setPage] = useState(initial.page);
  const [pageSize, setPageSize] = useState<GalleryPageSize>(initial.pageSize);
  const [active, setActive] = useState<Card | null>(null);
  const issuerIndex = useMemo(() => buildIssuerIndex(cards), [cards]);

  const setFilters: Dispatch<SetStateAction<CardFilterValues>> = (action) => {
    setPage(1);
    setFiltersState(action);
  };

  const filtered = useMemo(
    () =>
      cards
        .filter((card) =>
          cardMatchesFilters(cards, card, filters, issuerIndex),
        )
        .sort((a, b) => compareCards(a, b, "tier")),
    [cards, filters, issuerIndex],
  );

  const pages =
    pageSize === "all" ? 1 : Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, pages);
  const visible =
    pageSize === "all"
      ? filtered
      : filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  useFilterUrlSync(filters, {
    page: page > 1 ? page : undefined,
    pageSize: pageSize !== 12 ? pageSize : undefined,
  });

  useEffect(() => {
    if (!loading) setPage((value) => Math.min(value, pages));
  }, [loading, pages]);

  return (
    <Shell title="卡面图鉴">
      <PageHeading
        title="卡面图鉴"
        description="浏览发行方、卡组织与地区资料，快速找到你要的卡面。"
        action={
          <span className="count-badge">
            {loading ? "加载中" : `${filtered.length} 张卡面`}
          </span>
        }
      />

      <CardFilterControls
        cards={cards}
        filters={filters}
        onChange={setFilters}
        placeholder="搜索卡片、发行方或卡组织"
      />

      <div
        className="mb-5 flex flex-wrap items-center justify-between gap-3 text-sm text-muted"
        aria-live="polite"
      >
        <span>
          第 {currentPage} / {pages} 页 · 本页 {visible.length} 张
        </span>
      </div>

      {loading ? (
        <Loading />
      ) : visible.length ? (
        <div className="card-grid">
          {visible.map((card) => (
            <CardTile key={card.id} card={card} onOpen={setActive} />
          ))}
        </div>
      ) : (
        <Empty text="没有符合条件的卡片。" />
      )}

      <GalleryPagination
        page={currentPage}
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

function readGalleryUrlState() {
  const params = new URLSearchParams(location.search);
  const requestedPageSize = params.get("pageSize");
  return {
    filters: readFiltersFromUrl(),
    page: Math.max(1, Number(params.get("page")) || 1),
    pageSize: (requestedPageSize === "all"
      ? "all"
      : PAGE_SIZES.includes(Number(requestedPageSize))
        ? Number(requestedPageSize)
        : 12) as GalleryPageSize,
  };
}
