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

function withdrawalSides(value: unknown): {
  local: unknown;
  overseas: unknown;
} {
  if (value && typeof value === "object" && !Array.isArray(value))
    return {
      local: (value as any).local || {},
      overseas: (value as any).overseas || {},
    };
  const text = String(value || "");
  const index = text.indexOf("海外");
  return index < 0
    ? { local: text ? [text] : [], overseas: [] }
    : {
        local: [text.slice(0, index).replace(/[，,]\s*$/, "")],
        overseas: [text.slice(index)],
      };
}

function withdrawalFeeText(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(String);
  if (!value || typeof value !== "object") return value ? [String(value)] : [];
  return Object.entries(value as Record<string, unknown>).map(
    ([network, fee]) =>
      `${network}：${Array.isArray(fee) ? fee.join("；") : typeof fee === "object" && fee !== null ? Object.values(fee).filter(Boolean).join("；") : String(fee)}`,
  );
}

function feeEntries(value: unknown): [string, any][] {
  return value && typeof value === "object" && !Array.isArray(value)
    ? Object.entries(value as Record<string, any>)
    : [];
}
function parseFeeNumber(value: unknown) {
  const match = String(value || "").match(/\d+(?:\.\d+)?/);
  return match ? Number(match[0]) : null;
}

async function exchangeAmount(
  value: number,
  base: string,
  quote: string,
  cache: Map<string, number | null>,
) {
  if (!base || !quote || base === quote) return { value, converted: true };
  const key = `${base}:${quote}`;
  let rate = cache.get(key);
  if (rate === undefined) {
    try {
      const response = await fetch(
        `https://api.frankfurter.dev/v2/rates?base=${encodeURIComponent(base)}&quotes=${encodeURIComponent(quote)}`,
      );
      const payload = await response.json();
      rate = Number(
        Array.isArray(payload)
          ? payload.find((item: any) => item.quote === quote)?.rate
          : payload?.rates?.[quote],
      );
      if (!Number.isFinite(rate)) rate = null;
    } catch {
      rate = null;
    }
    cache.set(key, rate);
  }
  return {
    value: rate === null ? value : value * rate,
    converted: rate !== null,
  };
}

async function calculateWithdrawalFee(
  fee: any,
  amount: number,
  cardCurrency: string,
  targetCurrency: string,
  cache: Map<string, number | null>,
  mode = "max",
) {
  const values =
    fee && typeof fee === "object" && !Array.isArray(fee)
      ? [fee.fixed, fee.percent].filter(Boolean)
      : Array.isArray(fee)
        ? fee
        : [fee];
  const calculated = await Promise.all(
    values.map(async (value) => {
      const number = parseFeeNumber(value);
      if (number === null) return null;
      if (String(value).includes("%"))
        return { value: (amount * number) / 100, converted: true };
      return exchangeAmount(
        number,
        String(value).match(/[A-Z]{3}(?=\b|$)/)?.[0] || cardCurrency,
        cardCurrency,
        cache,
      );
    }),
  );
  const valid = calculated.filter(Boolean) as {
    value: number;
    converted: boolean;
  }[];
  if (!valid.length) return null;
  const cardFee =
    mode === "add"
      ? valid.reduce((sum, item) => sum + item.value, 0)
      : Math.max(...valid.map((item) => item.value));
  const converted = await exchangeAmount(
    cardFee,
    cardCurrency,
    targetCurrency,
    cache,
  );
  return {
    fee: converted.value,
    cardFee,
    converted: valid.every((item) => item.converted) && converted.converted,
  };
}
export function WithdrawalPage() {
  const { cards, loading } = useCards();
  const [region, setRegion] = useState("CN");
  const [currency, setCurrency] = useState("CNY");
  const [amount, setAmount] = useState(1000);
  const [continent, setContinent] = useState("AS");
  const [pickerOpen, setPickerOpen] = useState(false);
  const [summary, setSummary] = useState<any[]>([]);
  const [calculating, setCalculating] = useState(false);
  const regionItems = regions.continents.flatMap(
    (item) => item.countries || [],
  );
  const selectedRegion =
    regionItems.find((item) => item.code === region) || regionItems[0];
  const currencies = [
    ...new Map(
      regionItems
        .filter((item) => item.currency)
        .map((item) => [item.currency, item.currency_zh || item.currency]),
    ).entries(),
  ].sort(([a], [b]) => a.localeCompare(b));
  const withdrawalCards = useMemo(
    () =>
      cards
        .filter((card) => card.withdrawal)
        .sort((a, b) =>
          (a.bankEnglishName || a.issuer).localeCompare(
            b.bankEnglishName || b.issuer,
          ),
        ),
    [cards],
  );
  useEffect(() => {
    let active = true;
    const run = async () => {
      setCalculating(true);
      const cache = new Map<string, number | null>();
      const options: any[] = [];
      for (const card of withdrawalCards) {
        const sides = withdrawalSides(card.withdrawal);
        const side = card.region === region ? sides.local : sides.overseas;
        const ruleSet =
          card.withdrawalCurrencyRules?.[
            card.region === region ? "local" : "overseas"
          ];
        const entries = ruleSet
          ? ([
              [
                card.organization || "VISA",
                ruleSet[currency === "HKD" ? "HKD" : "foreign"],
              ],
            ] as [string, any][])
          : feeEntries(side);
        for (const [network, fee] of entries) {
          if (region === "PH" && network === "BancNet") continue;
          if (!fee || fee === "unsupported") continue;
          const cardCurrency = card.cardCurrency || currency;
          const cardAmount = await exchangeAmount(
            amount,
            currency,
            cardCurrency,
            cache,
          );
          const calculation = await calculateWithdrawalFee(
            fee,
            cardAmount.value,
            cardCurrency,
            cardCurrency,
            cache,
            fee?.mode || "max",
          );
          if (!calculation) continue;
          let exchangePercent = 0;
          const exchangeRule = card.withdrawalExchange;
          if (exchangeRule && cardCurrency !== currency) {
            let exchangeNetwork = network;
            if (
              exchangeNetwork === "HSBC" &&
              !(exchangeRule.hsbc_atm_regions || []).includes(region)
            )
              exchangeNetwork = card.organization || exchangeNetwork;
            exchangePercent =
              Number(
                exchangeRule.card_networks?.[exchangeNetwork] ||
                  (exchangeNetwork === "HSBC"
                    ? exchangeRule.hsbc_atm_fee_percent
                    : 0),
              ) || 0;
          }
          const exchangeFee = (cardAmount.value * exchangePercent) / 100;
          const totalCardFee = calculation.cardFee + exchangeFee;
          const convertedFee = await exchangeAmount(
            totalCardFee,
            cardCurrency,
            currency,
            cache,
          );
          options.push({
            card,
            network,
            fee: convertedFee.value,
            total: amount + convertedFee.value,
            converted:
              calculation.converted &&
              cardAmount.converted &&
              convertedFee.converted,
          });
        }
      }
      if (active) setSummary(options.sort((a, b) => a.fee - b.fee).slice(0, 3));
      setCalculating(false);
    };
    run();
    return () => {
      active = false;
    };
  }, [withdrawalCards, region, currency, amount]);
  const selectRegion = (code: string) => {
    setRegion(code);
    const item = regionItems.find((entry) => entry.code === code);
    if (item?.currency) setCurrency(item.currency);
    setContinent(
      regions.continents.find((entry) =>
        entry.countries?.some((country) => country.code === code),
      )?.code || continent,
    );
    setPickerOpen(false);
  };
  const sideText = (card: Card, side: "local" | "overseas") =>
    withdrawalFeeText(withdrawalSides(card.withdrawal)[side]);
  return (
    <Shell title="取款手续费">
      <PageHeading
        title="取款手续费"
        description="按地区、币种和金额比较各张卡的本地与海外 ATM 取款费用。"
      />
      <section className="mb-6 grid gap-3 lg:grid-cols-[minmax(0,1fr)_210px_180px]">
        <div className="relative">
          <button
            className="control flex w-full items-center justify-between text-left"
            onClick={() => setPickerOpen((value) => !value)}
            aria-expanded={pickerOpen}
          >
            <span>
              {selectedRegion
                ? `${selectedRegion.name_zh}（${selectedRegion.code}）`
                : "选择地区"}
            </span>
            <span className="text-muted">⌄</span>
          </button>
          {pickerOpen && (
            <div className="absolute z-30 mt-1 grid max-h-80 w-full grid-cols-[110px_1fr] overflow-hidden rounded-xl border border-line bg-white p-2 shadow-panel dark:bg-[#1b2420]">
              <div className="grid content-start gap-1">
                {regions.continents.map((item) => (
                  <button
                    key={item.code}
                    className={`rounded-lg px-2 py-2 text-left text-sm ${continent === item.code ? "bg-accent/10 text-accent" : "hover:bg-soft"}`}
                    onMouseEnter={() => setContinent(item.code)}
                    onClick={() => setContinent(item.code)}
                  >
                    {item.name_zh}
                  </button>
                ))}
              </div>
              <div className="filter-scrollbar grid max-h-76 content-start gap-1 overflow-y-auto border-l border-line pl-2">
                {(
                  regions.continents.find((item) => item.code === continent)
                    ?.countries || []
                ).map((item) => (
                  <button
                    key={item.code}
                    className={`rounded-lg px-2 py-2 text-left text-sm ${region === item.code ? "bg-accent/10 text-accent" : "hover:bg-soft"}`}
                    onClick={() => selectRegion(item.code)}
                  >
                    {item.name_zh}（{item.code}） {item.name}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
        <select
          className="control"
          value={currency}
          onChange={(e) => setCurrency(e.target.value)}
        >
          {currencies.map(([code, label]) => (
            <option key={code} value={code}>
              {label}（{code}）
            </option>
          ))}
        </select>
        <label className="control flex items-center gap-2">
          金额{" "}
          <input
            className="min-w-0 flex-1 bg-transparent outline-none"
            type="number"
            min="0"
            max="100000000"
            value={amount}
            onChange={(e) =>
              setAmount(
                Math.min(100000000, Math.max(0, Number(e.target.value) || 0)),
              )
            }
          />
          <span className="text-xs text-muted">{currency}</span>
        </label>
      </section>
      <section className="mb-8 rounded-xl border border-accent/20 bg-accent/5 p-5">
        <h2 className="font-bold">
          {calculating
            ? "正在比较方案…"
            : `于${selectedRegion?.name_zh || region}取出 ${amount.toLocaleString()}${currency} 的前三方案`}
        </h2>
        {summary.length ? (
          <ol className="mt-3 grid gap-2 text-sm">
            {summary.map((item) => (
              <li key={`${item.card.id}-${item.network}`}>
                <span className="font-semibold">
                  ${item.fee.toFixed(2)} {currency}
                </span>
                ：{item.card.bankNativeName || item.card.issuer}【
                {item.card.name}】透过【{item.network}】网络取款，预估总额{" "}
                {item.total.toFixed(2)} {currency}
                {item.converted ? "" : "（部分汇率无法换算）"}
              </li>
            ))}
          </ol>
        ) : (
          !calculating && (
            <p className="mt-2 text-sm text-muted">
              暂无可比较的取款手续费方案。
            </p>
          )
        )}
      </section>
      {loading ? (
        <Loading />
      ) : withdrawalCards.length ? (
        <div className="panel overflow-x-auto">
          <table className="w-full min-w-[920px] text-left text-sm">
            <thead className="bg-soft text-muted">
              <tr>
                {["卡片", "发行方", "本地取款", "海外取款"].map((label) => (
                  <th key={label} className="px-4 py-3 font-semibold">
                    {label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {withdrawalCards.map((card) => (
                <tr key={card.id} className="border-t border-line">
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
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
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
                  <td className="px-4 py-3">
                    {sideText(card, "local").length
                      ? sideText(card, "local").map((line) => (
                          <div key={line}>{line}</div>
                        ))
                      : "-"}
                  </td>
                  <td className="px-4 py-3">
                    {sideText(card, "overseas").length
                      ? sideText(card, "overseas").map((line) => (
                          <div key={line}>{line}</div>
                        ))
                      : "-"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <Empty text="暂无取款手续费数据。" />
      )}
    </Shell>
  );
}

