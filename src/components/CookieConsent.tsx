import { motion } from "motion/react";
import { useState } from "react";

const CONSENT_KEY = "cards-viewer-cookie-consent";
type Consent = "accepted" | "rejected";

function readConsent(): Consent | null {
  try {
    const stored = localStorage.getItem(CONSENT_KEY);
    if (stored === "accepted" || stored === "rejected") return stored;
    const cookie = document.cookie
      .split(";")
      .map((item) => item.trim())
      .find((item) => item.startsWith(`${CONSENT_KEY}=`));
    const value = cookie?.slice(CONSENT_KEY.length + 1);
    return value === "accepted" || value === "rejected" ? value : null;
  } catch {
    return null;
  }
}

export function CookieConsent() {
  const [consent, setConsent] = useState<Consent | null>(readConsent);

  const choose = (value: Consent) => {
    try {
      localStorage.setItem(CONSENT_KEY, value);
      document.cookie = `${CONSENT_KEY}=${value}; Max-Age=31536000; Path=/; SameSite=Lax`;
    } catch {
      // The notice can still be dismissed when storage is unavailable.
    }
    setConsent(value);
  };

  if (consent) return null;

  return (
    <motion.aside
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      className="fixed inset-x-4 bottom-4 z-[60] mx-auto flex max-w-3xl flex-col gap-4 rounded-xl border border-line bg-surface p-4 shadow-2xl sm:flex-row sm:items-center sm:justify-between sm:px-5"
      role="dialog"
      aria-label="Cookie 通知"
    >
      <p className="m-0 text-sm leading-6 text-ink dark:text-white">
        本网站使用 Cookies 帮助改善浏览体验。“接受”即表示阁下同意我们的数据处理。
      </p>
      <div className="flex shrink-0 gap-2">
        <button type="button" className="quiet-button" onClick={() => choose("rejected")}>
          拒绝
        </button>
        <button type="button" className="primary-button" onClick={() => choose("accepted")}>
          接受
        </button>
      </div>
    </motion.aside>
  );
}
