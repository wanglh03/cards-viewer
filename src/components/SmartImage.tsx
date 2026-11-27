import { ImageOff } from "lucide-react";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import type { CSSProperties, ReactEventHandler } from "react";
import { Spinner } from "./ui";

type Status = "loading" | "loaded" | "error";

export type SmartImageProps = {
  src?: string;
  fallbackSrc?: string;
  alt: string;
  /** Classes for the responsive wrapper. */
  className?: string;
  /** Classes for the `<img>` itself. */
  imgClassName?: string;
  imgStyle?: CSSProperties;
  eager?: boolean;
  spinnerSize?: number;
  onLoad?: ReactEventHandler<HTMLImageElement>;
};

/**
 * Image with a spinner placeholder: the spinner stays visible until the
 * picture has actually been decoded, then fades the image in. A secondary
 * source is tried before falling back to a neutral icon.
 */
export function SmartImage({
  src,
  fallbackSrc,
  alt,
  className = "",
  imgClassName = "size-full object-contain",
  imgStyle,
  eager = false,
  spinnerSize = 20,
  onLoad,
}: SmartImageProps) {
  const initialSource = src || fallbackSrc || "";
  const [source, setSource] = useState(initialSource);
  const [status, setStatus] = useState<Status>(
    initialSource ? "loading" : "error",
  );
  const [showSpinner, setShowSpinner] = useState(false);
  const imageRef = useRef<HTMLImageElement | null>(null);

  useEffect(() => {
    const next = src || fallbackSrc || "";
    setSource(next);
    setStatus(next ? "loading" : "error");
  }, [src, fallbackSrc]);

  // A cached image can finish before React attaches its listeners, which
  // would leave the spinner running forever. Check `complete` on mount.
  const setImageRef = useCallback((node: HTMLImageElement | null) => {
    imageRef.current = node;
  }, []);

  useLayoutEffect(() => {
    const image = imageRef.current;
    if (image?.complete && image.naturalWidth > 0) setStatus("loaded");
  }, [source]);

  // Only show the spinner for genuinely slow images: cached images appear
  // instantly, without a spinner flash.
  useEffect(() => {
    if (status !== "loading") {
      setShowSpinner(false);
      return;
    }
    const timer = window.setTimeout(() => setShowSpinner(true), 150);
    return () => window.clearTimeout(timer);
  }, [status, source]);

  const handleError = () => {
    if (fallbackSrc && source !== fallbackSrc) {
      setSource(fallbackSrc);
      setStatus("loading");
      return;
    }
    setStatus("error");
  };

  return (
    <span
      className={`relative block overflow-hidden ${className}`}
      aria-busy={status === "loading"}
    >
      {source && status !== "error" && (
        <img
          ref={setImageRef}
          src={source}
          alt={alt}
          style={imgStyle}
          loading={eager ? "eager" : "lazy"}
          decoding="async"
          className={`img-fade ${imgClassName} ${
            status === "loaded" ? "opacity-100" : "opacity-0"
          }`}
          onLoad={(event) => {
            setStatus("loaded");
            onLoad?.(event);
          }}
          onError={handleError}
        />
      )}
      {status === "loading" && showSpinner && (
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 grid place-items-center"
        >
          <Spinner size={spinnerSize} />
        </span>
      )}
      {status === "error" && (
        <span
          className="absolute inset-0 grid place-items-center text-muted"
          aria-hidden="true"
        >
          <ImageOff size={Math.max(16, spinnerSize)} />
        </span>
      )}
    </span>
  );
}
