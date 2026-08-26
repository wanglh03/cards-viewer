import { ArrowLeft, ArrowRight, Check, Copy, Download, Filter, Search, Sparkles, X } from "lucide-react";
import type { ReactNode } from "react";
import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { CardArtwork, CardImageGallery, CardModal, CardTile } from "../components/CardTile";
import { PageHeading, Shell } from "../components/Shell";
import { SmartLink } from "../components/SmartLink";
import { CardFilterControls, type CardFilterValues, cardMatchesFilters, readGalleryUrlState } from "./gallery";
import { useCards } from "../components/filters";
import { Empty, Loading } from "../components/ui";
import regions from "../config/regions.json";
import { bankTagLabels, buildCollectionGroups, cardRegionName, compareCards, fetchJson, formatBin, getCollectionIssuers, issuerLogo, loadMyIssuers, siteData, tierAccentClass, tierRank, typeLabels } from "../lib/data";
import type { Card, CollectedIssuer, CollectionGroup, IssuerData, MyIssuersData } from "../lib/types";

function creditAmount(value: unknown) {
  const number = Number(String(value ?? "").replace(/[^\d.-]/g, ""));
  return Number.isFinite(number) ? number : 0;
}

function formatCreditMoney(currency: string, amount: number) {
  return `${currency} ${amount.toLocaleString("zh-CN", { maximumFractionDigits: 2 })}`;
}

export function CreditPage({ cards, loading }: { cards: Card[]; loading: boolean }) {
  const creditCards = useMemo(
    () => cards.filter((card) => card.type === "Credit"),
    [cards],
  );
  const initialUrlState = useMemo(readGalleryUrlState, []);
  const [filters, setFilters] = useState<CardFilterValues>(() => ({
    query: initialUrlState.search,
    organization: initialUrlState.organization,
    type: "all",
    issuer: initialUrlState.issuer,
    issuerTag: initialUrlState.issuerTag,
    region: initialUrlState.region,
  }));
  const filtered = useMemo(
    () =>
      creditCards
        .filter((card) => cardMatchesFilters(creditCards, card, filters))
        .sort((a, b) => compareCards(a, b, "tier")),
    [creditCards, filters],
  );
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
    const next = `${location.pathname}${params.toString() ? `?${params}` : ""}${location.hash}`;
    if (`${location.pathname}${location.search}${location.hash}` !== next)
      history.replaceState(null, "", next);
  }, [filters]);
  const totals = useMemo(() => {
    const map = new Map<string, number>();
    const shared = new Set<string>();
    filtered
      .filter((card) => !card.supplementary)
      .forEach((card) => {
        if (card.sharedLimit && shared.has(card.bankKey)) return;
        if (card.sharedLimit) shared.add(card.bankKey);
        Object.entries(card.limitMap || {}).forEach(([currency, value]) =>
          map.set(currency, (map.get(currency) || 0) + creditAmount(value)),
        );
      });
    return [...map.entries()];
  }, [filtered]);
  return (
    <Shell title="现持信用卡">
      <PageHeading
        title="现持信用卡"
        description="查看现持信用卡的额度、账单日、还款日、费用与权益。"
        action={
          <div className="flex flex-wrap items-center gap-2">
            {totals.length ? (
              totals.map(([currency, amount]) => (
                <span
                  key={currency}
                  className="rounded-full bg-accent/10 px-3 py-2 text-sm font-semibold text-accent"
                >
                  {formatCreditMoney(currency, amount)}
                </span>
              ))
            ) : (
              <span className="rounded-full bg-soft px-3 py-2 text-sm text-muted">
                总授信 -
              </span>
            )}
            <span className="rounded-full bg-soft px-3 py-2 text-sm text-muted">
              {loading ? "加载中" : `${filtered.length} 张`}
            </span>
          </div>
        }
      />
      <CardFilterControls
        cards={creditCards}
        filters={filters}
        onChange={setFilters}
        placeholder="搜索卡片、BIN、发行方或卡组织"
        includeType={false}
      />
      {loading ? (
        <Loading />
      ) : filtered.length ? (
        <div className="table-scrollbar panel overflow-x-auto">
          <table className="w-full min-w-[1180px] text-left text-sm">
            <thead className="bg-soft text-muted">
              <tr>
                {[
                  "卡片",
                  "卡组织",
                  "等级",
                  "BIN",
                  "发行方",
                  "地区",
                  "额度",
                  "账单日",
                  "还款日",
                  "年费",
                  "境外手续费",
                  "权益",
                ].map((label) => (
                  <th key={label} className="px-4 py-3 font-semibold">
                    {label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((card) => (
                <tr
                  key={card.id}
                  className="border-t border-line hover:bg-soft/60"
                >
                  <td className="px-4 py-3">
                    <div className="flex min-w-[150px] flex-col items-start gap-2 font-semibold">
                      <div className="w-[112px] shrink-0 overflow-hidden rounded-md">
                        <CardArtwork
                          src={card.altImageUrl || card.image}
                          alt={`${card.name} 卡面`}
                        />
                      </div>
                      <span className="max-w-[180px] whitespace-normal">
                        {card.name}
                        {card.supplementary ? "（附卡）" : ""}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    {card.organizationIconUrl ? (
                      <img
                        src={card.organizationIconUrl}
                        alt={card.organization || "卡组织"}
                        title={card.organization || "卡组织"}
                        className="organization-logo object-contain"
                      />
                    ) : (
                      "-"
                    )}
                  </td>
                  <td className="px-4 py-3">{card.tier || "-"}</td>
                  <td className="px-4 py-3 font-mono">
                    {formatBin(card.bin) || "-"}
                  </td>
                  <td className="min-w-[170px] px-4 py-3">
                    <span className="inline-flex items-center gap-2">
                      {card.bankLogoUrl && (
                        <img
                          src={card.bankLogoUrl}
                          alt=""
                          className="size-7 shrink-0 object-contain"
                        />
                      )}
                      <span>{card.bankNativeName || card.issuer || "-"}</span>
                    </span>
                  </td>
                  <td className="px-4 py-3">{card.region || "-"}</td>
                  <td className="px-4 py-3">
                    {Object.entries(card.limitMap || {}).length
                      ? Object.entries(card.limitMap || {}).map(
                          ([currency, value]) => (
                            <div key={currency}>
                              {card.sharedLimit ? "共享" : ""}
                              {formatCreditMoney(currency, creditAmount(value))}
                            </div>
                          ),
                        )
                      : "-"}
                  </td>
                  <td className="px-4 py-3">{card.billingDay || "-"}</td>
                  <td className="px-4 py-3">{card.dueDay || "-"}</td>
                  <td className="px-4 py-3">{card.annualFee || "-"}</td>
                  <td className="max-w-[180px] px-4 py-3">{card.ftf || "-"}</td>
                  <td className="max-w-[260px] whitespace-normal px-4 py-3 text-muted">
                    {card.benefit || "-"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <Empty text="暂无符合条件的信用卡。" />
      )}
    </Shell>
  );
}
