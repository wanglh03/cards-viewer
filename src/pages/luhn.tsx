import { Check, Copy, Sparkles } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { PageHeading, Shell } from "../components/Shell";
import { Field, Pagination } from "../components/ui";
import {
  formatLuhnNumber,
  generateLuhnPage,
  generateSpecifiedLuhnPage,
  getLuhnPatterns,
  getSpecifiedLuhnCount,
  LUHN_AUTO_CALCULATE_DIGITS,
  LUHN_MAX_KNOWN_DIGITS,
  LUHN_MIN_KNOWN_DIGITS,
  LUHN_PAGE_SIZE,
} from "../lib/luhn";

export function LuhnPage() {
  const [length, setLength] = useState(16);
  const [prefix, setPrefix] = useState("");
  const [suffix, setSuffix] = useState("");
  const [force, setForce] = useState(false);
  const [page, setPage] = useState(1);
  const [patternKey, setPatternKey] = useState("");
  const [digit, setDigit] = useState(0);
  const [copied, setCopied] = useState("");
  const known = prefix.replace(/\D/g, "").slice(0, LUHN_MAX_KNOWN_DIGITS);
  const cleanSuffix = suffix
    .replace(/\D/g, "")
    .slice(0, Math.max(0, length - known.length));
  const patterns = useMemo(
    () =>
      known.length >= LUHN_MIN_KNOWN_DIGITS &&
      (force || known.length >= LUHN_AUTO_CALCULATE_DIGITS) &&
      !cleanSuffix
        ? getLuhnPatterns(known, length)
        : [],
    [known, length, force, cleanSuffix],
  );
  const activePattern =
    patterns.find((item) => String(item.runLength) === patternKey) ||
    patterns[0];
  const activeDigit =
    activePattern?.digits.find((item) => item.suffixDigit === digit) ||
    activePattern?.digits.find((item) => item.suffixDigit === 0) ||
    activePattern?.digits[0];
  const specifiedReady =
    (cleanSuffix.length >= 4 &&
      known.length >= LUHN_MIN_KNOWN_DIGITS &&
      length - known.length <= 11) ||
    (cleanSuffix.length >= 4 &&
      length - known.length - cleanSuffix.length <= 7);
  const results = useMemo(
    () =>
      cleanSuffix && specifiedReady
        ? generateSpecifiedLuhnPage(known, length, cleanSuffix, page)
        : activePattern && activeDigit
          ? generateLuhnPage(
              known,
              length,
              activePattern.runLength,
              activeDigit.suffixDigit,
              page,
            )
          : [],
    [
      cleanSuffix,
      specifiedReady,
      known,
      length,
      page,
      activePattern,
      activeDigit,
    ],
  );
  const total =
    cleanSuffix && specifiedReady
      ? getSpecifiedLuhnCount(known, length, cleanSuffix)
      : activeDigit?.count || 0;
  const pages = Math.max(1, Math.ceil(total / LUHN_PAGE_SIZE));
  useEffect(() => {
    setPage(1);
  }, [known, length, cleanSuffix, patternKey, digit, force]);
  useEffect(() => {
    if (activePattern && !patternKey)
      setPatternKey(String(activePattern.runLength));
  }, [activePattern, patternKey]);
  const status =
    known.length < LUHN_MIN_KNOWN_DIGITS
      ? "等待输入"
      : cleanSuffix && !specifiedReady
        ? "等待更多剩余位数"
        : !force && known.length < LUHN_AUTO_CALCULATE_DIGITS && !cleanSuffix
          ? "等待确认"
          : "已完成计算";
  const message =
    known.length < LUHN_MIN_KNOWN_DIGITS
      ? "输入 6 位数字后自动开始计算，也可以点击计算按钮。"
      : known.length >= length
        ? "已知数字需要少于卡号总位数，才能补全后缀。"
        : cleanSuffix && !specifiedReady
          ? "后缀或者前缀位数不够长，无法开始计算。"
          : !patterns.length && !cleanSuffix
            ? "没有符合 Luhn 校验的后缀模式。"
            : "";
  return (
    <Shell title="卡号计算">
      <PageHeading
        title="卡号计算"
        description="查询符合 Luhn 校验的卡号。"
        action={
          <span
            className={`rounded-full px-3 py-2 text-sm font-semibold ${status === "已完成计算" ? "bg-accent/10 text-accent" : "bg-soft text-muted"}`}
          >
            {status}
          </span>
        }
      />
      <div className="grid gap-6">
        <section className="panel p-5">
          <div className="flex items-center justify-between">
            <label className="font-semibold">卡号位数</label>
            <output className="font-mono text-accent">{length} 位</output>
          </div>
          <input
            className="mt-5 w-full accent-accent"
            type="range"
            min="15"
            max="19"
            value={length}
            onChange={(e) => {
              setLength(Number(e.target.value));
              setForce(false);
            }}
          />
          <div className="mt-1 flex justify-between text-xs text-muted">
            <span>15</span>
            <span>16</span>
            <span>17</span>
            <span>18</span>
            <span>19</span>
          </div>
          <Field
            label="前缀"
            value={known}
            onChange={(value) => {
              setPrefix(value);
              setForce(
                value.replace(/\D/g, "").length >= LUHN_AUTO_CALCULATE_DIGITS,
              );
            }}
            placeholder="至少 6 位数字"
          />
          <Field
            label="指定后缀（可选）"
            value={cleanSuffix}
            onChange={setSuffix}
            placeholder="至少 4 位数字"
          />
          <p className="mt-2 text-xs leading-6 text-muted">
            后缀模式要求：剩余位数不多于 11，或去除后缀后的中间位数不多于 7。
          </p>
          <button
            className="primary-button mt-5 w-full"
            onClick={() => setForce(true)}
          >
            <Sparkles size={17} />
            计算
          </button>
        </section>
        <section className="panel min-w-0 p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-accent">
                {cleanSuffix ? `后缀 ${cleanSuffix}` : "后缀模式"}
              </p>
              <h2 className="mt-1 text-2xl font-bold">可能结果</h2>
            </div>
            <span className="text-sm text-muted">
              {total ? `共 ${total.toLocaleString("zh-CN")} 条` : "等待输入"}
            </span>
          </div>
          {!cleanSuffix && patterns.length > 0 && (
            <>
              <div className="mt-5 flex flex-wrap gap-2">
                {patterns.map((item) => (
                  <button
                    key={item.runLength}
                    className={`quiet-button ${activePattern?.runLength === item.runLength ? "border-accent text-accent" : ""}`}
                    onClick={() => {
                      setPatternKey(String(item.runLength));
                      setDigit(0);
                    }}
                  >
                    {item.runLength}a{" "}
                    <span className="text-xs">
                      {item.count.toLocaleString("zh-CN")} 条
                    </span>
                  </button>
                ))}
              </div>
              {activePattern && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {activePattern.digits.map((item) => (
                    <button
                      key={item.suffixDigit}
                      className={`quiet-button ${activeDigit?.suffixDigit === item.suffixDigit ? "border-accent text-accent" : ""}`}
                      onClick={() => setDigit(item.suffixDigit)}
                    >
                      {activePattern.runLength}a{item.suffixDigit}{" "}
                      <span className="text-xs">
                        {item.count.toLocaleString("zh-CN")}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </>
          )}
          {message ? (
            <div className="mt-5 rounded-lg border border-dashed border-line p-8 text-center text-sm text-muted">
              {message}
            </div>
          ) : (
            <>
              <div className="mt-5 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                {results.map((number) => (
                  <button
                    key={number}
                    className="flex items-center justify-between rounded-lg border border-line bg-soft px-3 py-3 text-left font-mono text-sm hover:border-accent"
                    onClick={() => {
                      navigator.clipboard?.writeText(number);
                      setCopied(number);
                    }}
                  >
                    <span className="luhn-number">
                      {formatLuhnNumber(number, length)}
                    </span>
                    {copied === number ? (
                      <Check size={15} className="text-accent" />
                    ) : (
                      <Copy size={15} className="text-muted" />
                    )}
                  </button>
                ))}
              </div>
              <p className="mt-4 text-sm text-muted">
                显示第 {(page - 1) * LUHN_PAGE_SIZE + (results.length ? 1 : 0)}-
                {Math.min(page * LUHN_PAGE_SIZE, total)} 条
              </p>
              <Pagination page={page} pages={pages} onChange={setPage} />
            </>
          )}
        </section>
      </div>
    </Shell>
  );
}
