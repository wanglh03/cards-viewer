import { useMemo, useState } from "react";
import { CardFilterControls } from "../components/filters";
import { PageHeading, Shell } from "../components/Shell";
import { SmartImage } from "../components/SmartImage";
import { Empty, Loading } from "../components/ui";
import { formatBin } from "../lib/data";
import {
  cardMatchesFilters,
  readFiltersFromUrl,
  useFilterUrlSync,
  type CardFilterValues,
} from "../lib/filters";
import type { Card } from "../lib/types";

const COLUMNS = [
  "卡片",
  "卡组织",
  "等级",
  "发行方",
  "地区",
  "额度",
  "账单日",
  "还款日",
  "年费",
  "境外手续费",
  "权益",
  "BIN",
];

function creditAmount(value: unknown) {
  const number = Number(String(value ?? "").replace(/[^\d.-]/g, ""));
  return Number.isFinite(number) ? number : 0;
}

function formatMoney(currency: string, amount: number) {
  return `${currency} ${amount.toLocaleString("zh-CN", {
    maximumFractionDigits: 2,
  })}`;
}

export function CreditPage({
  cards,
  loading,
}: {
  cards: Card[];
  loading: boolean;
}) {
  const creditCards = useMemo(
    () =>
      cards.filter(
        (card) =>
          card.type === "Credit" && card.status?.toLowerCase() === "active",
      ),
    [cards],
  );
  const [filters, setFilters] = useState<CardFilterValues>(() =>
    readFiltersFromUrl({ type: "all" }),
  );
  const filtered = useMemo(
    () =>
      creditCards.filter((card) =>
        cardMatchesFilters(creditCards, card, filters),
      ),
    [creditCards, filters],
  );
  const totals = useMemo(() => {
    const map = new Map<string, number>();
    const counted = new Set<string>();
    filtered
      .filter((card) => !card.supplementary)
      .forEach((card) => {
        const groupKey = card.sharedLimit
          ? `shared:${card.bankKey}`
          : `card:${card.id}`;
        if (counted.has(groupKey)) return;
        counted.add(groupKey);
        Object.entries(card.limitMap || {}).forEach(([currency, value]) => {
          map.set(currency, (map.get(currency) || 0) + creditAmount(value));
        });
      });
    return [...map.entries()];
  }, [filtered]);

  useFilterUrlSync(filters);

  return (
    <Shell title="现持信用卡">
      <PageHeading
        title="现持信用卡"
        description="查看现持信用卡的额度、账单日、还款日、费用与权益。"
        action={
          <div className="flex flex-wrap items-center gap-2">
            {totals.length ? (
              totals.map(([currency, amount]) => (
                <span key={currency} className="count-badge">
                  {formatMoney(currency, amount)}
                </span>
              ))
            ) : (
              <span className="count-badge-muted">总授信 -</span>
            )}
            <span className="count-badge-muted">
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
        <>
          <div className="grid gap-4 lg:hidden">
            {filtered.map((card) => (
              <article key={card.id} className="panel overflow-hidden">
                <div className="flex gap-3 p-4">
                  <SmartImage
                    src={card.altImageUrl || card.image}
                    fallbackSrc={card.image}
                    alt={`${card.name} 卡面`}
                    className="h-[84px] w-[132px] shrink-0 rounded-lg bg-soft"
                    imgClassName="size-full object-contain"
                    spinnerSize={20}
                  />
                  <div className="min-w-0">
                    <h3 className="font-bold leading-snug text-ink">
                      {card.name}
                      {card.supplementary ? "（附卡）" : ""}
                    </h3>
                    <p className="mt-1 flex items-center gap-1.5 text-xs text-muted">
                      {card.bankLogoUrl && (
                        <SmartImage
                          src={card.bankLogoUrl}
                          alt=""
                          className="size-4 shrink-0"
                          imgClassName="size-full object-contain"
                          spinnerSize={10}
                        />
                      )}
                      <span className="truncate">
                        {card.bankNativeName || card.issuer}
                      </span>
                    </p>
                    <p className="mt-1 truncate text-xs text-muted">
                      {[card.organization, card.tier, formatBin(card.bin)]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                  </div>
                </div>
                <dl className="grid grid-cols-2 gap-x-3 gap-y-2 border-t border-line px-4 py-3 text-sm">
                  <MobileField
                    label="额度"
                    value={
                      Object.keys(card.limitMap || {}).length
                        ? Object.entries(card.limitMap || {})
                            .map(
                              ([currency, value]) =>
                                `${card.sharedLimit ? "共享 " : ""}${formatMoney(currency, creditAmount(value))}`,
                            )
                            .join(" / ")
                        : "-"
                    }
                  />
                  <MobileField label="账单日" value={card.billingDay || "-"} />
                  <MobileField label="还款日" value={card.dueDay || "-"} />
                  <MobileField label="年费" value={card.annualFee || "-"} />
                  <MobileField
                    label="境外手续费"
                    value={card.ftf || "-"}
                  />
                  <MobileField
                    label="地区"
                    value={card.region || "-"}
                  />
                </dl>
                {card.benefit && (
                  <p className="whitespace-pre-line border-t border-line px-4 py-3 text-xs leading-6 text-muted">
                    {card.benefit}
                  </p>
                )}
              </article>
            ))}
          </div>

          <div className="panel table-scrollbar hidden overflow-x-auto lg:block">
            <table className="w-full min-w-[1360px] table-fixed text-left text-sm">
            <colgroup>
              <col className="w-[190px]" />
              <col className="w-[64px]" />
              <col className="w-[88px]" />
              <col className="w-[160px]" />
              <col className="w-[60px]" />
              <col className="w-[140px]" />
              <col className="w-[72px]" />
              <col className="w-[72px]" />
              <col className="w-[120px]" />
              <col className="w-[120px]" />
              <col className="w-[170px]" />
              <col className="w-[104px]" />
            </colgroup>
            <caption className="sr-only">现持信用卡明细</caption>
            <thead className="bg-soft text-xs uppercase tracking-wide text-muted">
              <tr>
                {COLUMNS.map((label) => (
                  <th
                    key={label}
                    scope="col"
                    className="whitespace-nowrap px-2 py-3 font-semibold"
                  >
                    {label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((card) => (
                <tr
                  key={card.id}
                  className="border-t border-line align-top hover:bg-soft/60"
                >
                  <td className="px-3 py-3">
                    <div className="flex flex-col items-start gap-2 font-semibold">
                      <SmartImage
                        src={card.altImageUrl || card.image}
                        fallbackSrc={card.image}
                        alt={`${card.name} 卡面`}
                        className="h-[95px] w-[150px] rounded-md bg-soft"
                        imgClassName="size-full object-contain"
                        spinnerSize={20}
                      />
                      <span className="max-w-[300px] whitespace-normal">
                        {card.name}
                        {card.supplementary ? "（附卡）" : ""}
                      </span>
                    </div>
                  </td>
                  <td className="px-2 py-3">
                    {card.organizationIconUrl ? (
                      <SmartImage
                        src={card.organizationIconUrl}
                        alt={card.organization || "卡组织"}
                        className="size-7"
                        imgClassName="size-full object-contain"
                        spinnerSize={12}
                      />
                    ) : (
                      "-"
                    )}
                  </td>
                  <td className="px-2 py-3">
                    {card.tier || "-"}
                  </td>
                  <td className="px-3 py-3 whitespace-normal">
                    <span className="flex items-start gap-2">
                      {card.bankLogoUrl && (
                        <SmartImage
                          src={card.bankLogoUrl}
                          alt=""
                          className="size-7 shrink-0"
                          imgClassName="size-full object-contain"
                          spinnerSize={12}
                        />
                      )}
                      <span className="min-w-0">
                        {card.bankNativeName || card.issuer || "-"}
                      </span>
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-2 py-3">
                    {card.region || "-"}
                  </td>
                  <td className="px-3 py-3">
                    {Object.keys(card.limitMap || {}).length
                      ? Object.entries(card.limitMap || {}).map(
                          ([currency, value]) => (
                            <div key={currency}>
                              {card.sharedLimit ? "共享 " : ""}
                              {formatMoney(currency, creditAmount(value))}
                            </div>
                          ),
                        )
                      : "-"}
                  </td>
                  <td className="px-3 py-3">{card.billingDay || "-"}</td>
                  <td className="px-3 py-3">{card.dueDay || "-"}</td>
                  <td className="px-3 py-3 whitespace-normal">
                    {card.annualFee || "-"}
                  </td>
                  <td className="px-3 py-3 whitespace-normal">
                    {card.ftf || "-"}
                  </td>
                  <td className="px-3 py-3 whitespace-normal text-muted">
                    {card.benefit || "-"}
                  </td>
                  <td className="px-3 py-3 font-mono whitespace-nowrap">
                    {formatBin(card.bin) || "-"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        </>
      ) : (
        <Empty text="暂无符合条件的信用卡。" />
      )}
    </Shell>
  );
}

function MobileField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-muted">{label}</dt>
      <dd className="mt-0.5 font-medium text-ink">{value}</dd>
    </div>
  );
}
