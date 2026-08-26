const ASSET_ORIGIN = "https://cards-cdn.gtbro.vip";

export function parseMarkdownImageAlt(value: string) {
  const match = value.trim().match(/^w:(\d+(?:\.\d+)?)px$/i);
  return {
    alt: match ? "" : value,
    width: match ? `${match[1]}px` : undefined,
  };
}

export function resolveMarkdownImageSrc(value: string) {
  const source = value.trim();
  if (/^\/issuers\//i.test(source)) {
    return `${ASSET_ORIGIN}${encodeURI(source)}`;
  }
  return source;
}
