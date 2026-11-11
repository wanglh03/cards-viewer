import { useEffect, useMemo, useRef, useState } from "react";
import type { Dispatch, RefObject, SetStateAction } from "react";
import regions from "../config/regions.json";
import {
  bankTagLabels,
  bankTagOrder,
  buildIssuerIndex,
  getIssuerOptions,
  statusLabels,
  typeLabels,
} from "../lib/data";
import {
  filterOptionLists,
  type CardFilterValues,
  type RegionSelection,
} from "../lib/filters";
import { useIsMobile } from "../lib/hooks";
import type { Card } from "../lib/types";
import { SearchField, Select } from "./ui";
import { SmartImage } from "./SmartImage";

function filterMenuItemClass(highlighted: boolean) {
  return `rounded-lg px-3 py-2 text-left text-sm transition ${
    highlighted
      ? "bg-accent/10 text-accent"
      : "text-ink hover:bg-soft"
  }`;
}

function useDismissOnOutside(
  ref: RefObject<HTMLDivElement | null>,
  onDismiss: () => void,
) {
  useEffect(() => {
    const close = (event: PointerEvent) => {
      if (!ref.current?.contains(event.target as Node)) onDismiss();
    };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, [ref, onDismiss]);
}

const dropdownClass =
  "absolute left-0 top-[calc(100%+4px)] z-40 grid w-[min(560px,calc(100vw-2rem))] gap-2 rounded-xl border border-line bg-surface p-2 shadow-panel";

function IssuerLogo({ src }: { src?: string }) {
  if (!src) return null;
  return (
    <SmartImage
      src={src}
      alt=""
      className="size-5 shrink-0"
      imgClassName="size-full object-contain"
      spinnerSize={12}
    />
  );
}

export function IssuerFilter({
  value,
  onChange,
  options,
  tag,
  onTagChange,
  disabled = false,
}: {
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string; tag: string; logoUrl?: string }[];
  tag: string;
  onTagChange: (value: string) => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [activeTag, setActiveTag] = useState("all");
  const [hoveredTag, setHoveredTag] = useState("");
  const [previewTag, setPreviewTag] = useState<string | null>(null);
  const isMobile = useIsMobile();
  const rootRef = useRef<HTMLDivElement>(null);
  const selected = options.find((option) => option.value === value);
  const tags = bankTagOrder.filter((item) =>
    options.some((option) => option.tag === item),
  );
  const activeOptions = options.filter((option) => option.tag === activeTag);
  const label =
    selected?.label ||
    (tag === "all" ? "全部发行方(分类)" : bankTagLabels[tag]) ||
    "全部发行方(分类)";

  useEffect(() => {
    const preferred =
      tag !== "all" ? tag : selected?.tag || bankTagOrder.find((item) => options.some((option) => option.tag === item)) || "all";
    setActiveTag(preferred);
  }, [tag, selected?.tag, options]);

  useDismissOnOutside(rootRef, () => setOpen(false));

  const resetHover = () => {
    const selectedTag = tag !== "all" ? tag : selected?.tag || "";
    setActiveTag(selectedTag || "all");
    setHoveredTag(selectedTag);
  };

  const chooseTag = (next: string) => {
    if (isMobile && previewTag !== next) {
      setActiveTag(next);
      setHoveredTag(next);
      setPreviewTag(next);
      return;
    }
    setActiveTag(next);
    onChange("all");
    onTagChange(next);
    setOpen(false);
    setPreviewTag(null);
  };

  if (disabled)
    return (
      <div className="relative opacity-45">
        <button
          type="button"
          disabled
          className="control flex w-full cursor-not-allowed items-center justify-between bg-soft text-left text-muted"
        >
          <span className="truncate">{label}</span>
          <span aria-hidden="true">⌄</span>
        </button>
      </div>
    );

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        aria-expanded={open}
        aria-label={`发行方筛选：${label}`}
        onClick={() => {
          setHoveredTag(tag !== "all" ? tag : selected?.tag || "");
          setPreviewTag(null);
          setOpen((current) => !current);
        }}
        className="control flex w-full items-center justify-between gap-2 text-left"
      >
        <span className="flex min-w-0 items-center gap-2">
          {selected?.logoUrl && <IssuerLogo src={selected.logoUrl} />}
          <span className="truncate">{label}</span>
        </span>
        <span className="text-muted" aria-hidden="true">
          ⌄
        </span>
      </button>

      {open && (
        <div
          onMouseLeave={resetHover}
          className={`${dropdownClass} grid-cols-[104px_minmax(0,1fr)] lg:grid-cols-[136px_minmax(190px,1fr)]`}
        >
          <div className="filter-scrollbar grid max-h-[min(20rem,50dvh)] content-start gap-1 overflow-y-auto">
            <button
              type="button"
              className={filterMenuItemClass(tag === "all" && value === "all")}
              onClick={() => {
                if (isMobile && previewTag !== "all") {
                  setActiveTag("all");
                  setHoveredTag("all");
                  setPreviewTag("all");
                  return;
                }
                onChange("all");
                onTagChange("all");
                setActiveTag("all");
                setHoveredTag("");
                setOpen(false);
                setPreviewTag(null);
              }}
            >
              全部发行方(分类)
            </button>
            {tags.map((item) => (
              <button
                type="button"
                key={item}
                className={`${filterMenuItemClass(hoveredTag === item)} flex items-center justify-between gap-2`}
                onMouseEnter={() => {
                  setActiveTag(item);
                  setHoveredTag(item);
                }}
                onFocus={() => {
                  setActiveTag(item);
                  setHoveredTag(item);
                }}
                onClick={() => chooseTag(item)}
              >
                <span className="truncate">{bankTagLabels[item]}</span>
                <span className="text-xs text-muted">
                  {options.filter((option) => option.tag === item).length}
                </span>
              </button>
            ))}
          </div>
          <div className="filter-scrollbar grid max-h-[min(20rem,50dvh)] content-start gap-1 overflow-y-auto border-l border-line pl-2">
            {activeTag === "all" ? (
              <p className="px-3 py-2 text-sm text-muted">选择左侧分类</p>
            ) : (
              activeOptions.map((option) => (
                <button
                  type="button"
                  key={option.value}
                  className={`${filterMenuItemClass(value === option.value)} flex items-center gap-2`}
                  onClick={() => {
                    onChange(option.value);
                    setOpen(false);
                  }}
                >
                  <IssuerLogo src={option.logoUrl} />
                  <span className="truncate">{option.label}</span>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

const regionDefinitions = regions.continents.flatMap(
  (continent) => continent.countries || [],
);

export function RegionIssuerFilter({
  cards,
  allCards,
  value,
  onChange,
  disabled = false,
  align = "left",
}: {
  cards: Card[];
  allCards?: Card[];
  value: RegionSelection;
  onChange: (value: RegionSelection) => void;
  disabled?: boolean;
  align?: "left" | "right";
}) {
  const [open, setOpen] = useState(false);
  const [activeRegion, setActiveRegion] = useState(value.region || "");
  const [activeProvince, setActiveProvince] = useState(value.province || "");
  const [hoveredRegion, setHoveredRegion] = useState("");
  const [hoveredProvince, setHoveredProvince] = useState("");
  const [previewRegion, setPreviewRegion] = useState<string | null>(null);
  const [previewProvince, setPreviewProvince] = useState<string | null>(null);
  const isMobile = useIsMobile();
  const rootRef = useRef<HTMLDivElement>(null);

  const regionInfo = (code: string) =>
    regionDefinitions.find((item) => item.code === code);
  const availableRegions = useMemo(
    () =>
      [...new Set(cards.map((card) => card.region).filter(Boolean))].sort(
        (a, b) => {
          const rankA = regionDefinitions.findIndex((item) => item.code === a);
          const rankB = regionDefinitions.findIndex((item) => item.code === b);
          return (
            (rankA < 0 ? Number.MAX_SAFE_INTEGER : rankA) -
            (rankB < 0 ? Number.MAX_SAFE_INTEGER : rankB)
          );
        },
      ),
    [cards],
  );
  const provinces = useMemo(
    () =>
      [
        ...new Set(
          cards
            .filter((card) => card.region === "CN")
            .map((card) => card.province)
            .filter(Boolean),
        ),
      ].sort((a, b) => a.localeCompare(b, "zh-Hans-CN")),
    [cards],
  );
  const issuerCards = useMemo(
    () =>
      activeRegion === "CN" && activeProvince
        ? cards.filter(
            (card) =>
              card.region === "CN" && card.province === activeProvince,
          )
        : cards.filter((card) => card.region === activeRegion),
    [cards, activeRegion, activeProvince],
  );
  const issuerOptions = useMemo(
    () => getIssuerOptions(issuerCards),
    [issuerCards],
  );
  const selectedRegion = regionInfo(value.region || "");
  const selectedIssuer = useMemo(() => {
    if (value.kind !== "issuer") return undefined;
    const source = allCards || cards;
    return getIssuerOptions(
      source.filter(
        (card) =>
          card.region === value.region &&
          (!value.province || card.province === value.province),
      ),
    ).find((item) => item.value === value.issuer);
  }, [allCards, cards, value]);
  const label =
    value.kind === "all"
      ? "全部发行方(地区)"
      : value.kind === "issuer"
        ? `${selectedRegion?.name_zh || value.region}/${selectedIssuer?.label || value.issuer}`
        : value.kind === "province"
          ? `中国/${value.province}`
          : selectedRegion?.name_zh || value.region;
  const selectedLogo =
    value.kind === "issuer" ? selectedIssuer?.logoUrl : undefined;

  useDismissOnOutside(rootRef, () => setOpen(false));

  const select = (next: RegionSelection) => {
    onChange(next);
    setOpen(false);
    setPreviewRegion(null);
    setPreviewProvince(null);
  };
  const showRegion = (region: string) => {
    setActiveRegion(region);
    setHoveredRegion(region);
    setActiveProvince(region === "CN" ? activeProvince || provinces[0] || "" : "");
  };
  const showProvince = (province: string) => {
    setActiveProvince(province);
    setHoveredProvince(province);
  };
  const resetHover = () => {
    const selected = value.kind === "all" ? "" : value.region || "";
    setActiveRegion(selected);
    setActiveProvince(value.province || "");
    setHoveredRegion(selected);
    setHoveredProvince(
      value.kind === "province" || value.kind === "issuer"
        ? value.province || ""
        : "",
    );
  };

  if (disabled)
    return (
      <div className="relative opacity-45">
        <button
          type="button"
          disabled
          className="control flex w-full cursor-not-allowed items-center justify-between bg-soft text-left text-muted"
        >
          <span className="truncate">{label}</span>
          <span aria-hidden="true">⌄</span>
        </button>
      </div>
    );

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        aria-expanded={open}
        aria-label={`地区筛选：${label}`}
        onClick={() => {
          setActiveRegion(value.kind === "all" ? "" : value.region || "");
          setActiveProvince(value.province || "");
          setHoveredRegion(value.kind === "all" ? "" : value.region || "");
          setHoveredProvince(
            value.kind === "province" || value.kind === "issuer"
              ? value.province || ""
              : "",
          );
          setPreviewRegion(null);
          setPreviewProvince(null);
          setOpen((current) => !current);
        }}
        className="control flex w-full items-center justify-between gap-2 text-left"
      >
        <span className="flex min-w-0 items-center gap-2">
          {selectedLogo && <IssuerLogo src={selectedLogo} />}
          <span className="truncate">{label}</span>
        </span>
        <span className="text-muted" aria-hidden="true">
          ⌄
        </span>
      </button>

      {open && (
        <div
          onMouseLeave={resetHover}
          className={`${dropdownClass} ${
            align === "right"
              ? "left-auto right-0 lg:left-0 lg:right-auto"
              : ""
          } ${
            activeRegion === "CN"
              ? "grid-cols-[104px_88px_minmax(0,1fr)] lg:grid-cols-[120px_110px_minmax(0,1fr)]"
              : "grid-cols-[104px_minmax(0,1fr)] lg:grid-cols-[120px_minmax(0,1fr)]"
          }`}
        >
          <div className="filter-scrollbar grid max-h-[min(20rem,50dvh)] content-start gap-1 overflow-y-auto">
            <button
              type="button"
              className={filterMenuItemClass(value.kind === "all")}
              onClick={() => {
                if (isMobile && previewRegion !== "all") {
                  setActiveRegion("all");
                  setActiveProvince("");
                  setHoveredRegion("all");
                  setHoveredProvince("");
                  setPreviewRegion("all");
                  return;
                }
                select({ kind: "all" });
              }}
            >
              全部发行方(地区)
            </button>
            {availableRegions.map((code) => (
              <button
                type="button"
                key={code}
                className={`${filterMenuItemClass(hoveredRegion === code)} flex items-center justify-between gap-2`}
                onMouseEnter={() => showRegion(code)}
                onFocus={() => showRegion(code)}
                onClick={() => {
                  if (isMobile && previewRegion !== code) {
                    showRegion(code);
                    setPreviewRegion(code);
                    return;
                  }
                  select({ kind: "region", region: code });
                }}
              >
                <span className="truncate">
                  {regionInfo(code)?.name_zh || code}
                </span>
                <span className="shrink-0 text-xs text-muted">
                  {getIssuerOptions(
                    cards.filter((card) => card.region === code),
                  ).length}
                </span>
              </button>
            ))}
          </div>

          {activeRegion === "CN" && (
            <div className="filter-scrollbar grid max-h-[min(20rem,50dvh)] content-start gap-1 overflow-y-auto border-l border-line pl-2">
              {provinces.map((province) => (
                <button
                  type="button"
                  key={province}
                  className={`${filterMenuItemClass(hoveredProvince === province)} flex items-center justify-between gap-2`}
                  onMouseEnter={() => showProvince(province)}
                  onFocus={() => showProvince(province)}
                  onClick={() => {
                    if (isMobile && previewProvince !== province) {
                      showProvince(province);
                      setPreviewProvince(province);
                      return;
                    }
                    select({ kind: "province", region: "CN", province });
                  }}
                >
                  <span className="truncate">{province}</span>
                  <span className="shrink-0 text-xs text-muted">
                    {
                      getIssuerOptions(
                        cards.filter(
                          (card) =>
                            card.region === "CN" &&
                            card.province === province,
                        ),
                      ).length
                    }
                  </span>
                </button>
              ))}
            </div>
          )}

          {activeRegion && activeRegion !== "all" ? (
            <div className="filter-scrollbar grid max-h-[min(20rem,50dvh)] content-start gap-1 overflow-y-auto border-l border-line pl-2">
              {issuerOptions.length ? (
                issuerOptions.map((option) => (
                  <button
                    type="button"
                    key={option.value}
                    className={`${filterMenuItemClass(
                      value.kind === "issuer" && value.issuer === option.value,
                    )} flex items-center gap-2`}
                    onClick={() =>
                      select({
                        kind: "issuer",
                        region: activeRegion,
                        province:
                          activeRegion === "CN" ? activeProvince : undefined,
                        issuer: option.value,
                      })
                    }
                  >
                    <IssuerLogo src={option.logoUrl} />
                    <span className="truncate">{option.label}</span>
                  </button>
                ))
              ) : (
                <p className="px-2 py-2 text-sm text-muted">暂无发行方</p>
              )}
            </div>
          ) : (
            <div className="grid content-start border-l border-line pl-2">
              <p className="px-3 py-2 text-sm text-muted">选择左侧地区</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function CardFilterControls({
  cards,
  filters,
  onChange,
  placeholder,
  includeType = true,
  fourthFilter = "type",
}: {
  cards: Card[];
  filters: CardFilterValues;
  onChange: Dispatch<SetStateAction<CardFilterValues>>;
  placeholder: string;
  includeType?: boolean;
  fourthFilter?: "type" | "status";
}) {
  const issuerIndex = useMemo(() => buildIssuerIndex(cards), [cards]);
  const lists = useMemo(
    () => filterOptionLists(cards, filters, issuerIndex),
    [cards, filters, issuerIndex],
  );
  const issuerActive = filters.issuer !== "all" || filters.issuerTag !== "all";
  const regionActive = filters.region.kind !== "all";
  const update = (next: Partial<CardFilterValues>) =>
    onChange((current) => ({ ...current, ...next }));

  return (
    <>
      <SearchField
        value={filters.query}
        onChange={(query) => update({ query })}
        placeholder={placeholder}
      />
      <section
        aria-label="主筛选"
        className={`mb-6 grid grid-cols-2 gap-2.5 sm:gap-3 ${includeType ? "lg:grid-cols-4" : "lg:grid-cols-3"}`}
      >
        <IssuerFilter
          disabled={regionActive}
          value={filters.issuer}
          onChange={(issuer) =>
            update({
              issuer,
              issuerTag: "all",
              ...(issuer !== "all" ? { region: { kind: "all" } } : {}),
            })
          }
          options={lists.issuerOptions}
          tag={filters.issuerTag}
          onTagChange={(issuerTag) =>
            update({
              issuerTag,
              issuer: "all",
              ...(issuerTag !== "all" ? { region: { kind: "all" } } : {}),
            })
          }
        />
        <RegionIssuerFilter
          disabled={issuerActive}
          align="right"
          cards={lists.regionCards}
          allCards={cards}
          value={filters.region}
          onChange={(region) =>
            update({
              region,
              ...(region.kind !== "all"
                ? { issuer: "all", issuerTag: "all" }
                : {}),
            })
          }
        />
        <Select
          value={filters.organization}
          onChange={(organization) => update({ organization })}
          options={lists.organizationOptions}
          label="全部卡组织"
        />
        {includeType && fourthFilter === "type" && (
          <Select
            value={filters.type}
            onChange={(type) => update({ type })}
            options={lists.typeOptions}
            label="全部卡类型"
            labelMap={typeLabels}
          />
        )}
        {includeType && fourthFilter === "status" && (
          <Select
            value={filters.status || "all"}
            onChange={(status) => update({ status })}
            options={lists.statusOptions}
            label="全部卡状态"
            labelMap={statusLabels}
          />
        )}
      </section>
    </>
  );
}
