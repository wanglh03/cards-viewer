import { useMemo, useState } from "react";
import { CardFilterControls } from "../components/filters";
import { PageHeading, Shell } from "../components/Shell";
import { SmartImage } from "../components/SmartImage";
import { Empty, Loading } from "../components/ui";
import {
  formatBin,
  tierAccentClass,
  tierRank,
} from "../lib/data";
import {
  cardMatchesFilters,
  readFiltersFromUrl,
  useFilterUrlSync,
  type CardFilterValues,
} from "../lib/filters";
import { useCards } from "../lib/hooks";
import type { Card } from "../lib/types";

type BinRow = {
  bin: string;
  length: string;
  organizations: { url: string; label: string }[];
  tiers: string[];
  types: string[];
  issuers: { name: string; logoUrl: string }[];
  names: string[];
  accent: string;
};

const TABLE_HEADINGS = [
  "卡 BIN",
  "位数",
  "卡组织",
  "等级",
  "类型",
  "发行方",
  "卡片名称",
];

function binLengthPrefix(bin: string) {
  const digits = bin.match(/^\d+/)?.[0] || "";
  return digits.length >= 6 ? digits.slice(0, 6) : "";
}

function buildBinRows(cards: Card[], lengthSource: Card[] = cards) {
  const groups = new Map<string, BinRow>();
  const lengthsByPrefix = new Map<string, string>();
  lengthSource.forEach((card) => {
    if (/^\d{6}$/.test(card.bin) && card.length)
      lengthsByPrefix.set(card.bin, card.length);
  });

  cards.forEach((card) => {
    if (!card.bin) return;
    const initialLength =
      card.organization === "China T-Union"
        ? "19"
        : lengthsByPrefix.get(binLengthPrefix(card.bin)) ||
          card.length ||
          (card.organization === "AMEX" ? "15" : "16");
    const row =
      groups.get(card.bin) ||
      ({
        bin: card.bin,
        length: initialLength,
        organizations: [],
        tiers: [],
        types: [],
        issuers: [],
        names: [],
        accent: "tier-accent-none",
      } satisfies BinRow);

    if (card.organization === "China T-Union") row.length = "19";
    else if (!row.length) row.length = initialLength;

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
  const { cards, loading } = useCards("bin");
  const [filters, setFilters] = useState<CardFilterValues>(readFiltersFromUrl);
  const rows = useMemo(
    () => buildBinRows(
      cards.filter((card) => card.bin && cardMatchesFilters(cards, card, filters)),
      cards,
    ),
    [cards, filters],
  );

  useFilterUrlSync(filters);

  return (
    <Shell title="卡 BIN 一览">
      <PageHeading
        title="卡 BIN 一览"
        description="按 BIN、发行方和卡组织检索已整理的卡片信息。"
        action={
          <span className="count-badge">
            {loading ? "加载中" : `${rows.length} 个 BIN`}
          </span>
        }
      />
      <CardFilterControls
        cards={cards}
        filters={filters}
        onChange={setFilters}
        placeholder="搜索 BIN、卡片、发行方或卡组织"
      />

      {loading ? (
        <Loading />
      ) : rows.length ? (
        <>
          <div className="grid gap-3 md:hidden">
            {rows.map((row) => (
              <article
                key={row.bin}
                className={`panel p-4 ${row.accent}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-mono text-base font-semibold text-ink">
                      {formatBin(row.bin)}
                    </p>
                    <p className="mt-0.5 text-xs text-muted">
                      {row.length} 位
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-wrap justify-end gap-1.5">
                    {row.organizations.map((item) => (
                      <SmartImage
                        key={item.url}
                        src={item.url}
                        alt={item.label}
                        className="h-8 w-7"
                        imgClassName="size-full object-contain"
                        spinnerSize={12}
                      />
                    ))}
                  </div>
                </div>
                <div className="mt-3 grid gap-1.5 border-t border-line pt-3 text-sm">
                  {row.tiers.length > 0 && (
                    <p>
                      <span className="text-xs text-muted">等级 </span>
                      {row.tiers.join(" / ")}
                    </p>
                  )}
                  {row.types.length > 0 && (
                    <p>
                      <span className="text-xs text-muted">类型 </span>
                      {row.types.join(" / ")}
                    </p>
                  )}
                  <div className="mt-1 grid gap-1">
                    {row.issuers.map((item) => (
                      <span
                        key={item.name}
                        className="flex items-center gap-1.5 text-muted"
                      >
                        {item.logoUrl && (
                          <SmartImage
                            src={item.logoUrl}
                            alt=""
                            className="size-4 shrink-0"
                            imgClassName="size-full object-contain"
                            spinnerSize={10}
                          />
                        )}
                        {item.name}
                      </span>
                    ))}
                  </div>
                  {row.names.length > 0 && (
                    <p className="mt-1 break-words text-xs leading-6 text-muted">
                      {row.names.join("、")}
                    </p>
                  )}
                </div>
              </article>
            ))}
          </div>

          <div className="panel table-scrollbar hidden overflow-x-auto md:block">
            <table className="w-full min-w-[900px] text-left text-sm">
            <caption className="sr-only">卡 BIN 一览</caption>
            <thead className="bg-soft text-xs uppercase tracking-wide text-muted">
              <tr>
                {TABLE_HEADINGS.map((label) => (
                  <th
                    key={label}
                    scope="col"
                    className={`whitespace-nowrap px-4 py-3 font-bold ${label === "卡组织" ? "min-w-20" : ""}`}
                  >
                    {label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr
                  key={row.bin}
                  className={row.accent.replace("tier-accent", "bin-tier-accent")}
                >
                  <td className="px-4 py-3 font-mono font-semibold">
                    {formatBin(row.bin)}
                  </td>
                  <td className="px-4 py-3">{row.length}</td>
                  <td className="min-w-20 px-4 py-3">
                    {row.organizations.length > 0 && (
                      <div className="flex flex-wrap gap-2">
                        {row.organizations.map((item) => (
                          <SmartImage
                            key={item.url}
                            src={item.url}
                            alt={item.label}
                            className="h-12 w-10"
                            imgClassName="size-full object-contain"
                            spinnerSize={14}
                          />
                        ))}
                      </div>
                    )}
                  </td>
                  <td className="bin-tier-cell px-4 py-3">
                    {row.tiers.join("    ")}
                  </td>
                  <td className="bin-name-cell px-4 py-3">
                    {row.types.join("    ")}
                  </td>
                  <td className="px-4 py-3">
                    <div className="grid gap-2">
                      {row.issuers.map((item) => (
                        <span
                          key={item.name}
                          className="flex items-center gap-2 whitespace-nowrap"
                        >
                          {item.logoUrl && (
                            <SmartImage
                              src={item.logoUrl}
                              alt=""
                              className="size-5 shrink-0"
                              imgClassName="size-full object-contain"
                              spinnerSize={12}
                            />
                          )}
                          {item.name}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="bin-name-cell px-4 py-3">
                    {row.names.join("    ")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        </>
      ) : (
        <Empty text="没有找到 BIN 数据。" />
      )}
    </Shell>
  );
}
