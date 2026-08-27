import { Calculator } from "lucide-react";
import { useMemo, useState } from "react";
import { PageHeading, Shell } from "../components/Shell";
import { calculateDepositInterest, type InterestUnit } from "../lib/interest";

type PresetTerm = { value: number; unit: InterestUnit; label: string };

const TERM_PRESETS: PresetTerm[] = [
  { value: 1, unit: "month", label: "1 个月" },
  { value: 3, unit: "month", label: "3 个月" },
  { value: 6, unit: "month", label: "6 个月" },
  { value: 1, unit: "year", label: "1 年" },
  { value: 2, unit: "year", label: "2 年" },
  { value: 3, unit: "year", label: "3 年" },
  { value: 5, unit: "year", label: "5 年" },
];

const unitLabels: Record<InterestUnit, string> = {
  day: "日",
  month: "月",
  year: "年",
};

function numberValue(value: string) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function formatCurrency(value: number) {
  return value.toLocaleString("zh-CN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function InterestPage() {
  const [principalWan, setPrincipalWan] = useState("1");
  const [termSelection, setTermSelection] = useState("1-month");
  const [customTerm, setCustomTerm] = useState("1");
  const [customUnit, setCustomUnit] = useState<InterestUnit>("month");
  const [rateInteger, setRateInteger] = useState(1);
  const [rateDecimal, setRateDecimal] = useState("80");
  const isCustom = termSelection === "custom";
  const selectedTerm = TERM_PRESETS.find(
    (term) => `${term.value}-${term.unit}` === termSelection,
  );
  const term = isCustom ? numberValue(customTerm) : selectedTerm?.value || 0;
  const unit = isCustom ? customUnit : selectedTerm?.unit || "month";
  const showMonthlyInterest = !(isCustom && unit === "day");
  const annualRate =
    rateInteger + numberValue(rateDecimal.padEnd(2, "0")) / 100;
  const results = useMemo(
    () =>
      calculateDepositInterest({
        principalWan: numberValue(principalWan),
        annualRate,
        term,
        unit,
      }),
    [annualRate, principalWan, term, unit],
  );

  return (
    <Shell title="利息计算">
      <PageHeading title="利息计算" description="按存款年利率计算单利。" />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
        <section className="panel p-5 sm:p-6">
          <label className="block text-sm font-semibold text-ink dark:text-white">
            本金
            <span className="ml-2 text-xs font-normal text-muted">
              单位：万
            </span>
            <input
              className="control mt-2 w-full font-mono"
              type="number"
              min="0"
              step="1"
              inputMode="decimal"
              value={principalWan}
              onChange={(event) => setPrincipalWan(event.target.value)}
              onWheel={(event) => {
                event.preventDefault();
                const current = numberValue(principalWan);
                const next = Math.max(0, current + (event.deltaY < 0 ? 1 : -1));
                setPrincipalWan(String(Number(next.toFixed(10))));
              }}
            />
          </label>

          <label className="mt-5 block text-sm font-semibold text-ink dark:text-white">
            存款期限
            <select
              className="control mt-2 w-full"
              value={termSelection}
              onChange={(event) => setTermSelection(event.target.value)}
            >
              {TERM_PRESETS.map((preset) => (
                <option
                  key={`${preset.value}-${preset.unit}`}
                  value={`${preset.value}-${preset.unit}`}
                >
                  {preset.label}
                </option>
              ))}
              <option value="custom">自定义</option>
            </select>
          </label>

          {isCustom && (
            <div className="mt-3 grid grid-cols-[minmax(0,1fr)_7rem] gap-3">
              <label className="text-sm font-semibold text-ink dark:text-white">
                自定义期限
                <input
                  className="control mt-2 w-full font-mono"
                  type="number"
                  min="0"
                  step="1"
                  inputMode="decimal"
                  value={customTerm}
                  onChange={(event) => setCustomTerm(event.target.value)}
                />
              </label>
              <label className="text-sm font-semibold text-ink dark:text-white">
                单位
                <select
                  className="control mt-2 w-full"
                  value={customUnit}
                  onChange={(event) =>
                    setCustomUnit(event.target.value as InterestUnit)
                  }
                >
                  {(Object.keys(unitLabels) as InterestUnit[]).map((item) => (
                    <option key={item} value={item}>
                      {unitLabels[item]}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          )}

          <fieldset className="mt-5">
            <legend className="text-sm font-semibold text-ink dark:text-white">
              年利率
            </legend>
            <div className="mt-2 grid grid-cols-2 gap-3">
              <label className="text-sm font-semibold text-ink dark:text-white">
                整数部分
                <select
                  className="control mt-2 w-full font-mono"
                  value={rateInteger}
                  onChange={(event) =>
                    setRateInteger(Number(event.target.value))
                  }
                  aria-label="年利率整数部分"
                >
                  {Array.from({ length: 9 }, (_, value) => (
                    <option key={value} value={value}>
                      {value}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-sm font-semibold text-ink dark:text-white">
                小数部分
                <input
                  className="control mt-2 w-full font-mono"
                  type="number"
                  min="0"
                  max="99"
                  step="1"
                  inputMode="numeric"
                  value={rateDecimal}
                  onChange={(event) =>
                    setRateDecimal(
                      event.target.value.replace(/\D/g, "").slice(0, 2),
                    )
                  }
                  aria-label="年利率小数部分"
                />
              </label>
            </div>
            <p className="mt-2 text-sm text-muted">
              当前年利率：{annualRate.toFixed(2)}%
            </p>
          </fieldset>
        </section>

        <section className="panel p-5 sm:p-6">
          <div className="flex items-center gap-3">
            <span className="grid size-10 place-items-center rounded-lg bg-accent/10 text-accent">
              <Calculator size={20} />
            </span>
            <div>
              <p className="text-xs font-bold tracking-[0.12em] text-accent">
                计算结果
              </p>
              <h2 className="text-2xl font-bold text-ink dark:text-white">
                存款收益
              </h2>
            </div>
          </div>
          <dl
            className={`mt-7 grid gap-3 ${showMonthlyInterest ? "sm:grid-cols-2 xl:grid-cols-4" : "sm:grid-cols-3"}`}
          >
            <Result label="到期利息" value={formatCurrency(results.interest)} />
            <Result
              label="到期总额"
              value={formatCurrency(results.maturityAmount)}
            />
            <Result label="收益率" value={`${results.yieldRate.toFixed(2)}%`} />
            {showMonthlyInterest && (
              <Result
                label="按月付息"
                value={formatCurrency(results.monthlyInterest)}
              />
            )}
          </dl>
          <p className="mt-6 border-t border-line pt-4 text-sm leading-6 text-muted">
            本金 {numberValue(principalWan).toLocaleString("zh-CN")} 万元，存期{" "}
            {term || 0} {unitLabels[unit]}。
          </p>
        </section>
      </div>
    </Shell>
  );
}

function Result({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-line bg-soft p-4">
      <dt className="text-sm text-muted">{label}</dt>
      <dd className="mt-2 text-xl font-bold tabular-nums text-ink dark:text-white">
        {value}
      </dd>
    </div>
  );
}
