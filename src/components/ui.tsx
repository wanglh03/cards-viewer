import { ArrowLeft, ArrowRight, Sparkles } from "lucide-react";
import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { motion } from "motion/react";
import type { Card } from "../lib/types";

export function CardTypeStats({
  cards,
  definitions,
  loading = false,
  onSelect,
}: {
  cards: Card[];
  definitions: readonly { id: string; label: string }[];
  loading?: boolean;
  onSelect?: (type: string) => void;
}) {
  return (
    <div className="type-stats" aria-label="卡类型统计">
      {definitions.map((definition) => {
        const count = cards.filter((card) => card.type === definition.id).length;
        return (
          <button
            key={definition.id}
            type="button"
            className="type-stat"
            aria-label={`${definition.label}分组，共${count}张`}
            onClick={() => onSelect?.(definition.id)}
          >
            <strong>{loading ? "…" : count}</strong>
            <span>{definition.label}</span>
          </button>
        );
      })}
    </div>
  );
}

export function Select({
  value,
  onChange,
  options,
  label,
  labelMap = {},
}: {
  value: string;
  onChange: (value: string) => void;
  options: string[];
  label: string;
  labelMap?: Record<string, string>;
}) {
  return (
    <select
      className="control w-full"
      value={value}
      onChange={(e) => onChange(e.target.value)}
    >
      <option value="all">{label}</option>
      {options.map((option) => (
        <option key={option} value={option}>
          {labelMap[option] || option}
        </option>
      ))}
    </select>
  );
}

export function SegmentedControl<T extends string>({
  value,
  onChange,
  options,
  label,
}: {
  value: T;
  onChange: (value: T) => void;
  options: { value: T; label: string }[];
  label: string;
}) {
  return (
    <div
      className="inline-flex max-w-full flex-wrap gap-1 rounded-lg border border-line bg-soft p-1"
      role="group"
      aria-label={label}
    >
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          aria-pressed={value === option.value}
          className={`rounded-md px-3 py-2 text-sm transition ${value === option.value ? "bg-surface font-semibold text-accent shadow-sm" : "text-muted hover:text-ink dark:hover:text-white"}`}
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
export function Field({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
}) {
  return (
    <label className="mt-5 block text-sm font-semibold">
      {label}
      <input
        className="control mt-2 w-full font-mono"
        inputMode="numeric"
        value={value}
        onChange={(e) => onChange(e.target.value.replace(/\D/g, ""))}
        placeholder={placeholder}
      />
    </label>
  );
}
export function Pagination({
  page,
  pages,
  onChange,
}: {
  page: number;
  pages: number;
  onChange: (page: number) => void;
}) {
  if (pages <= 1) return null;
  return (
    <div className="mt-8 flex items-center justify-center gap-2">
      <button
        className="quiet-button px-3"
        disabled={page === 1}
        onClick={() => onChange(page - 1)}
        aria-label="上一页"
      >
        <ArrowLeft size={16} />
      </button>
      <span className="px-3 text-sm text-muted">
        {page} / {pages}
      </span>
      <button
        className="quiet-button px-3"
        disabled={page === pages}
        onClick={() => onChange(page + 1)}
        aria-label="下一页"
      >
        <ArrowRight size={16} />
      </button>
    </div>
  );
}

export function GalleryPagination({
  page,
  pages,
  pageSize,
  onPageChange,
  onPageSizeChange,
}: {
  page: number;
  pages: number;
  pageSize: number | "all";
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number | "all") => void;
}) {
  const [input, setInput] = useState(String(page));
  useEffect(() => setInput(String(page)), [page]);
  const jump = () => {
    const requested = Number.parseInt(input, 10);
    if (!Number.isFinite(requested)) {
      setInput(String(page));
      return;
    }
    onPageChange(Math.min(Math.max(requested, 1), pages));
  };
  const go = (nextPage: number) => {
    onPageChange(Math.min(Math.max(nextPage, 1), pages));
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  return (
    <nav className="gallery-pagination" aria-label="卡片分页">
      <button
        type="button"
        className="gallery-page-button"
        aria-label="第一页"
        title="第一页"
        disabled={page <= 1}
        onClick={() => go(1)}
      >
        «
      </button>
      <button
        type="button"
        className="gallery-page-button"
        aria-label="上一页"
        title="上一页"
        disabled={page <= 1}
        onClick={() => go(page - 1)}
      >
        ←
      </button>
      <span aria-live="polite">第 {page} / {pages} 页</span>
      <label className="gallery-page-jump">
        <span>跳转</span>
        <input
          type="number"
          min="1"
          max={pages}
          inputMode="numeric"
          aria-label="跳转到第几页"
          value={input}
          onChange={(event) => setInput(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") jump();
          }}
        />
        <button
          type="button"
          className="gallery-page-jump-button"
          onClick={jump}
        >
          确定
        </button>
      </label>
      <button
        type="button"
        className="gallery-page-button"
        aria-label="下一页"
        title="下一页"
        disabled={page >= pages}
        onClick={() => go(page + 1)}
      >
        →
      </button>
      <button
        type="button"
        className="gallery-page-button"
        aria-label="最后一页"
        title="最后一页"
        disabled={page >= pages}
        onClick={() => go(pages)}
      >
        »
      </button>
      <label className="gallery-page-size">
        <span>每页</span>
        <select
          aria-label="每页显示数量"
          value={String(pageSize)}
          onChange={(event) => {
            const value = event.target.value;
            onPageSizeChange(value === "all" ? "all" : Number(value));
          }}
        >
          <option value="12">12</option>
          <option value="20">20</option>
          <option value="60">60</option>
          <option value="100">100</option>
          <option value="all">全部</option>
        </select>
      </label>
    </nav>
  );
}
export function Loading() {
  return (
    <div className="grid place-items-center rounded-xl border border-dashed border-line p-14 text-sm text-muted">
      <motion.div
        animate={{ rotate: 360 }}
        transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
      >
        <Sparkles size={20} className="text-accent" />
      </motion.div>
      <span className="mt-3">正在加载数据</span>
    </div>
  );
}
export function Empty({ text }: { text: string }) {
  return (
    <div className="rounded-xl border border-dashed border-line p-14 text-center text-sm text-muted">
      {text}
    </div>
  );
}
export function checkDigit(value: string) {
  let sum = 0;
  let double = true;
  for (let i = value.length - 1; i >= 0; i -= 1) {
    let digit = Number(value[i]);
    if (double) {
      digit *= 2;
      if (digit > 9) digit -= 9;
    }
    sum += digit;
    double = !double;
  }
  return String((10 - (sum % 10)) % 10);
}
