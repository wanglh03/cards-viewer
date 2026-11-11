import { useEffect, useMemo, useRef, useState } from "react";
import type { Card } from "../lib/types";
import { PageHeading, Shell } from "../components/Shell";
import { SmartImage } from "../components/SmartImage";
import { Empty, Loading } from "../components/ui";
import regions from "../config/regions.json";
import { useCards } from "../lib/hooks";

const regionItems = regions.continents.flatMap(
  (continent) => continent.countries || [],
);
const MAX_AMOUNT = 100_000_000;

type Fees = Record<string, unknown>;
type RateCache = Map<string, number | null>;
type WithdrawalOption = {
  card: Card;
  network: string;
  fee: number;
  total: number;
  converted: boolean;
};
type ExchangeResult = { value: number; converted: boolean };

function withdrawalSides(value: unknown) {
  if (value && typeof value === "object" && !Array.isArray(value))
    return {
      local: (value as Fees).local || {},
      overseas: (value as Fees).overseas || {},
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
  return Object.entries(value as Fees).map(([network, fee]) => {
    const detail = Array.isArray(fee)
      ? fee.join("；")
      : fee && typeof fee === "object"
        ? Object.values(fee).filter(Boolean).join("；")
        : String(fee);
    return `${network}：${detail}`;
  });
}

function feeEntries(value: unknown): [string, unknown][] {
  return value && typeof value === "object" && !Array.isArray(value)
    ? Object.entries(value as Fees)
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
  cache: RateCache,
): Promise<ExchangeResult> {
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
          ? payload.find((item: { quote?: string }) => item.quote === quote)?.rate
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
  fee: unknown,
  amount: number,
  cardCurrency: string,
  cache: RateCache,
  mode: "max" | "add" = "max",
) {
  const values =
    fee && typeof fee === "object" && !Array.isArray(fee)
      ? [(fee as Fees).fixed, (fee as Fees).percent].filter(Boolean)
      : Array.isArray(fee)
        ? fee
        : [fee];
  const calculated = await Promise.all(
    values.map(async (value) => {
      const number = parseFeeNumber(value);
      if (number === null) return null;
      if (String(value).includes("%"))
        return { value: (amount * number) / 100, converted: true };
      const currency =
        String(value).match(/[A-Z]{3}(?=\b|$)/)?.[0] || cardCurrency;
      return exchangeAmount(number, currency, cardCurrency, cache);
    }),
  );
  const valid = calculated.filter(Boolean) as ExchangeResult[];
  if (!valid.length) return null;
  const cardFee =
    mode === "add"
      ? valid.reduce((sum, item) => sum + item.value, 0)
      : Math.max(...valid.map((item) => item.value));
  const converted = await exchangeAmount(cardFee, cardCurrency, cardCurrency, cache);
  return {
    cardFee,
    converted: valid.every((item) => item.converted) && converted.converted,
  };
}

export function WithdrawalPage() {
  const { cards, loading } = useCards("withdrawal");
  const [region, setRegion] = useState("CN");
  const [currency, setCurrency] = useState("CNY");
  const [amount, setAmount] = useState(1000);
  const [continent, setContinent] = useState("AS");
  const [pickerOpen, setPickerOpen] = useState(false);
  const [summary, setSummary] = useState<WithdrawalOption[]>([]);
  const [calculating, setCalculating] = useState(false);
  const pickerRef = useRef<HTMLDivElement>(null);

  const selectedRegion =
    regionItems.find((item) => item.code === region) || regionItems[0];
  const currencies = useMemo(
    () =>
      [
        ...new Map(
          regionItems
            .filter((item) => item.currency)
            .map((item) => [item.currency, item.currency_zh || item.currency]),
        ).entries(),
      ].sort(([a], [b]) => a.localeCompare(b)),
    [],
  );
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
    const close = (event: PointerEvent) => {
      if (!pickerRef.current?.contains(event.target as Node)) setPickerOpen(false);
    };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, []);

  useEffect(() => {
    let active = true;
    const run = async () => {
      setCalculating(true);
      const cache: RateCache = new Map();
      const options: WithdrawalOption[] = [];
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
            ] as [string, unknown][])
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
          const feeMode = (fee as { mode?: "max" | "add" })?.mode || "max";
          const calculation = await calculateWithdrawalFee(
            fee,
            cardAmount.value,
            cardCurrency,
            cache,
            feeMode,
          );
          if (!calculation) continue;
          let exchangePercent = 0;
          const exchangeRule = card.withdrawalExchange;
          if (exchangeRule && cardCurrency !== currency) {
            let exchangeNetwork: string = network;
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
          const convertedFee = await exchangeAmount(
            calculation.cardFee + exchangeFee,
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
      <section className="mb-6 grid gap-3 lg:grid-cols-[minmax(0,1fr)_210px_200px]">
        <div ref={pickerRef} className="relative">
          <button
            className="control flex w-full items-center justify-between gap-2 text-left"
            onClick={() => setPickerOpen((value) => !value)}
            aria-expanded={pickerOpen}
            aria-label="选择取款地区"
          >
            <span className="truncate">
              {selectedRegion
                ? `${selectedRegion.name_zh}（${selectedRegion.code}）`
                : "选择地区"}
            </span>
            <span className="text-muted" aria-hidden="true">
              ⌄
            </span>
          </button>
          {pickerOpen && (
            <div className="absolute z-30 mt-1 grid max-h-[min(20rem,60dvh)] w-full grid-cols-[100px_minmax(0,1fr)] overflow-hidden rounded-xl border border-line bg-surface p-2 shadow-panel sm:grid-cols-[110px_minmax(0,1fr)]">
              <div className="filter-scrollbar grid content-start gap-1 overflow-y-auto">
                {regions.continents.map((item) => (
                  <button
                    key={item.code}
                    className={`rounded-lg px-2 py-2 text-left text-sm transition ${
                      continent === item.code
                        ? "bg-accent/10 text-accent"
                        : "hover:bg-soft"
                    }`}
                    onClick={() => setContinent(item.code)}
                  >
                    {item.name_zh}
                  </button>
                ))}
              </div>
              <div className="filter-scrollbar grid max-h-[min(20rem,52dvh)] content-start gap-1 overflow-y-auto border-l border-line pl-2">
                {(regions.continents.find((item) => item.code === continent)
                  ?.countries || []
                ).map((item) => (
                  <button
                    key={item.code}
                    className={`rounded-lg px-2 py-2 text-left text-sm transition ${
                      region === item.code
                        ? "bg-accent/10 text-accent"
                        : "hover:bg-soft"
                    }`}
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
          onChange={(event) => setCurrency(event.target.value)}
          aria-label="取款币种"
        >
          {currencies.map(([code, label]) => (
            <option key={code} value={code}>
              {label}（{code}）
            </option>
          ))}
        </select>
        <label className="control flex items-center gap-2">
          <span className="shrink-0 text-sm text-muted">金额</span>
          <input
            className="min-w-0 flex-1 bg-transparent outline-none"
            type="number"
            min="0"
            max={MAX_AMOUNT}
            inputMode="decimal"
            value={amount}
            onChange={(event) =>
              setAmount(
                Math.min(
                  MAX_AMOUNT,
                  Math.max(0, Number(event.target.value) || 0),
                ),
              )
            }
          />
          <span className="shrink-0 text-xs text-muted">{currency}</span>
        </label>
      </section>

      <section className="mb-8 rounded-xl border border-accent/20 bg-accent/5 p-5">
        <h2 className="text-sm font-bold text-ink sm:text-base">
          {calculating
            ? "正在比较方案…"
            : `于${selectedRegion?.name_zh || region}取出 ${amount.toLocaleString()}${currency} 的前三方案`}
        </h2>
        {summary.length ? (
          <ol className="mt-3 grid gap-2 text-sm">
            {summary.map((item) => (
              <li key={`${item.card.id}-${item.network}`} className="text-ink">
                <span className="font-semibold text-accent-ink">
                  {item.fee.toFixed(2)} {currency}
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
        <>
          <div className="grid gap-4 lg:hidden">
            {withdrawalCards.map((card) => (
              <article key={card.id} className="panel p-4">
                <div className="flex gap-3">
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
                  </div>
                </div>
                <dl className="mt-3 grid gap-3 border-t border-line pt-3">
                  {(["local", "overseas"] as const).map((side) => (
                    <div key={side}>
                      <dt className="text-xs font-bold text-muted">
                        {side === "local" ? "本地取款" : "海外取款"}
                      </dt>
                      <dd className="mt-1 text-sm leading-6 text-muted">
                        {sideText(card, side).length
                          ? sideText(card, side).map((line) => (
                              <div key={line}>{line}</div>
                            ))
                          : "-"}
                      </dd>
                    </div>
                  ))}
                </dl>
              </article>
            ))}
          </div>

          <div className="panel table-scrollbar hidden overflow-x-auto lg:block">
          <table className="w-full min-w-[880px] text-left text-sm">
            <thead className="bg-soft text-xs uppercase tracking-wide text-muted">
              <tr>
                {["卡片", "发行方", "本地取款", "海外取款"].map((label) => (
                  <th key={label} scope="col" className="px-4 py-3 font-semibold">
                    {label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {withdrawalCards.map((card) => (
                <tr key={card.id} className="border-t border-line">
                  <td className="px-4 py-3">
                    <div className="flex min-w-[140px] flex-col items-start gap-2 font-semibold">
                      <SmartImage
                        src={card.altImageUrl || card.image}
                        fallbackSrc={card.image}
                        alt={`${card.name} 卡面`}
                        className="w-[112px] rounded-md"
                        imgClassName="w-full object-contain"
                        spinnerSize={18}
                      />
                      <span className="max-w-[180px] whitespace-normal">
                        {card.name}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center gap-2">
                      {card.bankLogoUrl && (
                        <SmartImage
                          src={card.bankLogoUrl}
                          alt=""
                          className="size-7 shrink-0"
                          imgClassName="size-full object-contain"
                          spinnerSize={12}
                        />
                      )}
                      <span>{card.bankNativeName || card.issuer || "-"}</span>
                    </span>
                  </td>
                  <td className="px-4 py-3 text-muted">
                    {sideText(card, "local").length
                      ? sideText(card, "local").map((line) => (
                          <div key={line}>{line}</div>
                        ))
                      : "-"}
                  </td>
                  <td className="px-4 py-3 text-muted">
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
        </>
      ) : (
        <Empty text="暂无取款手续费数据。" />
      )}
    </Shell>
  );
}
