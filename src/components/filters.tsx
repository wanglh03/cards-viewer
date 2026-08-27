import { useEffect, useMemo, useRef, useState } from "react";
import regions from "../config/regions.json";
import {
  bankTagLabels,
  bankTagOrder,
  getIssuerOptions,
  loadCards,
} from "../lib/data";
import type { Card } from "../lib/types";

export function useCards(
  kind: "issuer" | "mine" | "credit" = "issuer",
  enabled = true,
) {
  const [cards, setCards] = useState<Card[]>([]);
  const [loading, setLoading] = useState(enabled);
  useEffect(() => {
    let active = true;
    if (!enabled) {
      setCards([]);
      setLoading(false);
      return () => {
        active = false;
      };
    }
    setLoading(true);
    loadCards(kind).then((value) => {
      if (active) {
        setCards(value);
        setLoading(false);
      }
    });
    return () => {
      active = false;
    };
  }, [kind, enabled]);
  return { cards, loading };
}

function filterMenuItemClass(highlighted: boolean) {
  return `rounded-lg px-3 py-2 text-left text-sm ${highlighted ? "bg-accent/10 text-accent dark:bg-[#24342d] dark:text-white" : "text-ink hover:bg-soft dark:text-white dark:hover:bg-[#24342d]"}`;
}

function useIsMobile() {
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const media = window.matchMedia("(max-width: 767px)");
    const update = () => setIsMobile(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);
  return isMobile;
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
  const [activeTag, setActiveTag] = useState(
    tag === "all"
      ? options.find((option) => option.value === value)?.tag ||
          bankTagOrder.find((item) =>
            options.some((option) => option.tag === item),
          ) ||
          "all"
      : tag,
  );
  const [hoveredTag, setHoveredTag] = useState("");
  const [mobilePreviewTag, setMobilePreviewTag] = useState<string | null>(null);
  const isMobile = useIsMobile();
  const rootRef = useRef<HTMLDivElement>(null);
  const tags = bankTagOrder.filter((item) =>
    options.some((option) => option.tag === item),
  );
  const selected = options.find((option) => option.value === value);
  const activeOptions = options.filter((option) => option.tag === activeTag);
  useEffect(() => {
    const close = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, []);
  useEffect(() => {
    if (tag !== "all") setActiveTag(tag);
    else if (selected?.tag) setActiveTag(selected.tag);
  }, [tag, selected?.tag]);
  const chooseTag = (nextTag: string) => {
    if (isMobile && mobilePreviewTag !== nextTag) {
      setActiveTag(nextTag);
      setHoveredTag(nextTag);
      setMobilePreviewTag(nextTag);
      return;
    }
    setActiveTag(nextTag);
    onChange("all");
    onTagChange(nextTag);
    setOpen(false);
    setMobilePreviewTag(null);
  };
  const label =
    selected?.label ||
    (tag === "all" ? "全部发行方(分类)" : bankTagLabels[tag]);
  if (disabled)
    return (
      <div ref={rootRef} className="relative opacity-45">
        <button
          type="button"
          disabled
          className="control flex w-full cursor-not-allowed items-center justify-between bg-soft text-left text-muted"
        >
          <span className="truncate">{label}</span>
          <span>⌄</span>
        </button>
      </div>
    );
  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => {
          setHoveredTag(tag !== "all" ? tag : selected?.tag || "");
          setMobilePreviewTag(null);
          setOpen((current) => !current);
        }}
        className="control flex w-full items-center justify-between text-left"
      >
        <span className="truncate">{label}</span>
        <span className="text-muted">⌄</span>
      </button>
      {open && (
        <div className="absolute left-0 top-[calc(100%+4px)] z-40 grid w-[min(560px,calc(100vw-2.5rem))] grid-cols-[minmax(140px,0.8fr)_minmax(190px,1.2fr)] gap-2 rounded-xl border border-line bg-white p-2 shadow-panel dark:bg-[#1b2420]">
          <div className="filter-scrollbar grid max-h-80 content-start gap-1 overflow-y-auto">
            <button
              type="button"
              className={filterMenuItemClass(tag === "all" && value === "all")}
              onClick={() => {
                if (isMobile && mobilePreviewTag !== "all") {
                  setActiveTag("all");
                  setHoveredTag("all");
                  setMobilePreviewTag("all");
                  return;
                }
                onChange("all");
                onTagChange("all");
                setActiveTag("all");
                setHoveredTag("");
                setOpen(false);
                setMobilePreviewTag(null);
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
                <span>{bankTagLabels[item]}</span>
                <span className="text-xs text-muted">
                  {options.filter((option) => option.tag === item).length}
                </span>
              </button>
            ))}
          </div>
          <div className="filter-scrollbar grid max-h-80 content-start gap-1 overflow-y-auto border-l border-line pl-2">
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
                  {option.logoUrl && (
                    <img
                      src={option.logoUrl}
                      alt=""
                      className="size-5 object-contain"
                    />
                  )}
                  {option.label}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export type RegionSelection = {
  kind: "all" | "region" | "province" | "issuer";
  region?: string;
  province?: string;
  issuer?: string;
};

export function RegionIssuerFilter({
  cards,
  allCards,
  value,
  onChange,
  disabled = false,
}: {
  cards: Card[];
  allCards?: Card[];
  value: RegionSelection;
  onChange: (value: RegionSelection) => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [activeRegion, setActiveRegion] = useState(value.region || "CN");
  const [activeProvince, setActiveProvince] = useState(value.province || "");
  const [hoveredRegion, setHoveredRegion] = useState("");
  const [hoveredProvince, setHoveredProvince] = useState("");
  const [mobilePreviewRegion, setMobilePreviewRegion] = useState<string | null>(null);
  const [mobilePreviewProvince, setMobilePreviewProvince] = useState<string | null>(null);
  const isMobile = useIsMobile();
  const rootRef = useRef<HTMLDivElement>(null);
  const regionDefinitions = regions.continents.flatMap(
    (item) => item.countries || [],
  );
  const regionInfo = (code: string) =>
    regionDefinitions.find((item) => item.code === code);
  const availableRegions = [
    ...new Set(cards.map((card) => card.region).filter(Boolean)),
  ].sort((a, b) => {
    const rankA = regionDefinitions.findIndex((item) => item.code === a);
    const rankB = regionDefinitions.findIndex((item) => item.code === b);
    return (
      (rankA < 0 ? Number.MAX_SAFE_INTEGER : rankA) -
      (rankB < 0 ? Number.MAX_SAFE_INTEGER : rankB)
    );
  });
  const provinces = [
    ...new Set(
      cards
        .filter((card) => card.region === "CN")
        .map((card) => card.province)
        .filter(Boolean),
    ),
  ].sort((a, b) => a.localeCompare(b, "zh-Hans-CN"));
  const regionIssuerCount = (region: string) =>
    getIssuerOptions(cards.filter((card) => card.region === region)).length;
  const provinceIssuerCount = (province: string) =>
    getIssuerOptions(
      cards.filter(
        (card) => card.region === "CN" && card.province === province,
      ),
    ).length;
  const issuerCards =
    activeRegion === "CN" && activeProvince
      ? cards.filter(
          (card) => card.region === "CN" && card.province === activeProvince,
        )
      : cards.filter((card) => card.region === activeRegion);
  const issuerOptions = getIssuerOptions(issuerCards);
  const labelCards = allCards || cards;
  const selectedRegion = regionInfo(value.region || "");
  const selectedIssuer = getIssuerOptions(
    labelCards.filter(
      (card) =>
        card.region === value.region &&
        (!value.province || card.province === value.province),
    ),
  ).find((item) => item.value === value.issuer);
  const label =
    value.kind === "all"
      ? "全部发行方(地区)"
      : value.kind === "issuer"
        ? `${selectedRegion?.name_zh || value.region}/${selectedIssuer?.label || value.issuer}`
        : value.kind === "province"
          ? `中国大陆/${value.province}`
          : selectedRegion?.name_zh || value.region;
  const select = (next: RegionSelection) => {
    onChange(next);
    setOpen(false);
    setMobilePreviewRegion(null);
    setMobilePreviewProvince(null);
  };
  const showRegion = (region: string) => {
    setActiveRegion(region);
    setHoveredRegion(region);
    setActiveProvince(
      region === "CN" ? activeProvince || provinces[0] || "" : "",
    );
  };
  const showProvince = (province: string) => {
    setActiveProvince(province);
    setHoveredProvince(province);
  };
  useEffect(() => {
    const close = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, []);
  if (disabled)
    return (
      <div ref={rootRef} className="relative opacity-45">
        <button
          type="button"
          disabled
          className="control flex w-full cursor-not-allowed items-center justify-between bg-soft text-left text-muted"
        >
          <span className="truncate">{label}</span>
          <span>⌄</span>
        </button>
      </div>
    );
  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => {
          setActiveRegion(value.region || "CN");
          setActiveProvince(value.province || provinces[0] || "");
          setHoveredRegion(value.kind === "all" ? "" : value.region || "");
          setHoveredProvince(
            value.kind === "province" || value.kind === "issuer"
              ? value.province || ""
              : "",
          );
          setMobilePreviewRegion(null);
          setMobilePreviewProvince(null);
          setOpen((current) => !current);
        }}
        className="control flex w-full items-center justify-between text-left"
      >
        <span className="truncate">{label}</span>
        <span className="text-muted">⌄</span>
      </button>
      {open && (
        <div
          className={`absolute left-0 top-[calc(100%+4px)] z-40 grid w-[min(560px,calc(100vw-2.5rem))] gap-2 rounded-xl border border-line bg-white p-2 shadow-panel dark:bg-[#1b2420] ${activeRegion === "CN" ? "grid-cols-[minmax(120px,0.8fr)_minmax(130px,0.9fr)_minmax(170px,1.1fr)]" : "grid-cols-[minmax(120px,0.8fr)_minmax(190px,1.2fr)]"}`}
        >
          <div className="filter-scrollbar grid max-h-80 content-start gap-1 overflow-y-auto">
            <button
              type="button"
              className={filterMenuItemClass(value.kind === "all")}
              onClick={() => {
                if (isMobile && mobilePreviewRegion !== "all") {
                  setActiveRegion("all");
                  setActiveProvince("");
                  setHoveredRegion("all");
                  setHoveredProvince("");
                  setMobilePreviewRegion("all");
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
                  if (isMobile && mobilePreviewRegion !== code) {
                    showRegion(code);
                    setMobilePreviewRegion(code);
                    return;
                  }
                  select({ kind: "region", region: code });
                }}
              >
                <span className="truncate">
                  {regionInfo(code)?.name_zh || code}
                </span>
                <span className="shrink-0 text-xs text-muted">
                  {regionIssuerCount(code)}
                </span>
              </button>
            ))}
          </div>
          {activeRegion === "CN" && (
            <div className="filter-scrollbar grid max-h-80 content-start gap-1 overflow-y-auto border-l border-line pl-2">
              {provinces.map((province) => (
                <button
                  type="button"
                  key={province}
                  className={`${filterMenuItemClass(hoveredProvince === province)} flex items-center justify-between gap-2`}
                  onMouseEnter={() => showProvince(province)}
                  onFocus={() => showProvince(province)}
                  onClick={() => {
                    if (isMobile && mobilePreviewProvince !== province) {
                      showProvince(province);
                      setMobilePreviewProvince(province);
                      return;
                    }
                    select({ kind: "province", region: "CN", province });
                  }}
                >
                  <span className="truncate">{province}</span>
                  <span className="shrink-0 text-xs text-muted">
                    {provinceIssuerCount(province)}
                  </span>
                </button>
              ))}
            </div>
          )}
          {
            <div className="filter-scrollbar grid max-h-80 content-start gap-1 overflow-y-auto border-l border-line pl-2">
              {activeRegion === "CN" ? (
                <>
                  {issuerOptions.length ? (
                    issuerOptions.map((option) => (
                      <button
                        type="button"
                        key={option.value}
                        className={`${filterMenuItemClass(value.kind === "issuer" && value.issuer === option.value)} flex items-center gap-2`}
                        onClick={() =>
                          select({
                            kind: "issuer",
                            region: "CN",
                            province: activeProvince,
                            issuer: option.value,
                          })
                        }
                      >
                        {option.logoUrl && (
                          <img
                            src={option.logoUrl}
                            alt=""
                            className="size-5 object-contain"
                          />
                        )}
                        {option.label}
                      </button>
                    ))
                  ) : (
                    <p className="px-2 py-2 text-sm text-muted">暂无发行方</p>
                  )}
                </>
              ) : (
                <>
                  {issuerOptions.length ? (
                    issuerOptions.map((option) => (
                      <button
                        type="button"
                        key={option.value}
                        className={`flex items-center gap-2 rounded-lg px-3 py-2 text-left text-sm ${value.kind === "issuer" && value.issuer === option.value ? "bg-accent/10 text-accent" : "text-ink hover:bg-soft dark:text-white"}`}
                        onClick={() =>
                          select({
                            kind: "issuer",
                            region: activeRegion,
                            issuer: option.value,
                          })
                        }
                      >
                        {option.logoUrl && (
                          <img
                            src={option.logoUrl}
                            alt=""
                            className="size-5 object-contain"
                          />
                        )}
                        {option.label}
                      </button>
                    ))
                  ) : (
                    <p className="px-2 py-2 text-sm text-muted">暂无发行方</p>
                  )}
                </>
              )}
            </div>
          }
        </div>
      )}
    </div>
  );
}
