export function EmbedPage() {
  const params = new URLSearchParams(location.search);
  const rawValue = params.get("url") || "";
  let widthParam = params.get("width");
  let value = rawValue;

  // Older short links embedded the target's hash directly in the URL query,
  // so the browser split it off. Re-attach it, including its width hint.
  if (location.hash && rawValue) {
    let fragment = location.hash;
    const widthMatch = fragment.match(/[&?]width=(\d+)$/);
    if (widthMatch) {
      fragment = fragment.slice(0, widthMatch.index);
      widthParam ??= widthMatch[1];
    }
    value = rawValue + fragment;
  }

  let target = "";
  try {
    if (value) {
      const url = new URL(value, location.href);
      if (url.protocol === "http:" || url.protocol === "https:") {
        target = url.href;
      }
    }
  } catch {
    target = "";
  }

  const requestedWidth = Number(widthParam);
  const width =
    Number.isFinite(requestedWidth) && requestedWidth >= 320
      ? Math.min(Math.round(requestedWidth), 1600)
      : null;

  return (
    <div className="fixed inset-0 bg-soft p-2 sm:p-3">
      <iframe
        className="mx-auto block h-full w-full rounded-lg border border-line bg-surface"
        style={width ? { maxWidth: `${width}px` } : undefined}
        src={target || "about:blank"}
        title="嵌入网页"
        loading="lazy"
        referrerPolicy="no-referrer"
      />
    </div>
  );
}
