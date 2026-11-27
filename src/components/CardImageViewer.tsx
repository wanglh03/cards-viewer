import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import type { Card } from "../lib/types";
import { SmartImage } from "./SmartImage";

export type CardImage = {
  src: string;
  label: string;
};

export function cardImages(card: Card): CardImage[] {
  const images: CardImage[] = [
    card.image ? { src: card.image, label: "正面卡面" } : null,
    card.altImageUrl ? { src: card.altImageUrl, label: "横版卡面" } : null,
    card.backImageUrl ? { src: card.backImageUrl, label: "背面卡面" } : null,
  ].filter((image): image is CardImage => Boolean(image));

  return images.filter(
    (image, index) =>
      images.findIndex((item) => item.src === image.src) === index,
  );
}

export function CardImageViewer({
  images,
  initialIndex = 0,
  onClose,
}: {
  images: CardImage[];
  initialIndex?: number;
  onClose: () => void;
}) {
  const [index, setIndex] = useState(() =>
    Math.min(Math.max(initialIndex, 0), Math.max(0, images.length - 1)),
  );
  const [transform, setTransform] = useState({ scale: 1, x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const stageRef = useRef<HTMLElement>(null);
  const transformRef = useRef(transform);
  const dragRef = useRef<{
    pointerX: number;
    pointerY: number;
    offsetX: number;
    offsetY: number;
  } | null>(null);
  const pointersRef = useRef(new Map<number, { x: number; y: number }>());
  const pinchRef = useRef<{
    distance: number;
    scale: number;
    centerX: number;
    centerY: number;
    offsetX: number;
    offsetY: number;
  } | null>(null);

  const updateTransform = (next: { scale: number; x: number; y: number }) => {
    transformRef.current = next;
    setTransform(next);
  };

  const clampOffset = (x: number, y: number, scale: number) => {
    const stage = stageRef.current;
    if (!stage) return { x, y };
    const maxX = ((scale - 1) * stage.clientWidth) / 2;
    const maxY = ((scale - 1) * stage.clientHeight) / 2;
    return {
      x: Math.max(-maxX, Math.min(maxX, x)),
      y: Math.max(-maxY, Math.min(maxY, y)),
    };
  };

  useEffect(() => {
    updateTransform({ scale: 1, x: 0, y: 0 });
  }, [index]);

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      const current = transformRef.current;
      const nextScale = Math.min(
        5,
        Math.max(1, current.scale * Math.exp(-event.deltaY * 0.0015)),
      );
      if (Math.abs(nextScale - current.scale) < 0.001) return;
      const rect = stage.getBoundingClientRect();
      const cursorX = event.clientX - rect.left - rect.width / 2;
      const cursorY = event.clientY - rect.top - rect.height / 2;
      const ratio = nextScale / current.scale;
      const offset = clampOffset(
        cursorX - ratio * (cursorX - current.x),
        cursorY - ratio * (cursorY - current.y),
        nextScale,
      );
      updateTransform({ scale: nextScale, ...offset });
    };
    stage.addEventListener("wheel", onWheel, { passive: false });
    return () => stage.removeEventListener("wheel", onWheel);
  }, []);

  const endDrag = () => {
    dragRef.current = null;
    setDragging(false);
  };

  const onPointerDown = (event: ReactPointerEvent<HTMLElement>) => {
    if (event.button !== 0) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    pointersRef.current.set(event.pointerId, {
      x: event.clientX,
      y: event.clientY,
    });

    if (pointersRef.current.size === 2) {
      const [first, second] = [...pointersRef.current.values()];
      dragRef.current = null;
      pinchRef.current = {
        distance: Math.hypot(second.x - first.x, second.y - first.y),
        scale: transformRef.current.scale,
        centerX: (first.x + second.x) / 2,
        centerY: (first.y + second.y) / 2,
        offsetX: transformRef.current.x,
        offsetY: transformRef.current.y,
      };
      setDragging(false);
      return;
    }

    if (pointersRef.current.size > 2 || transformRef.current.scale <= 1) return;
    dragRef.current = {
      pointerX: event.clientX,
      pointerY: event.clientY,
      offsetX: transformRef.current.x,
      offsetY: transformRef.current.y,
    };
    setDragging(true);
  };

  const onPointerMove = (event: ReactPointerEvent<HTMLElement>) => {
    const pointers = pointersRef.current;
    if (!pointers.has(event.pointerId)) return;
    pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });

    const pinch = pinchRef.current;
    if (pinch && pointers.size >= 2) {
      const [first, second] = [...pointers.values()];
      if (!pinch.distance) return;
      const distance = Math.hypot(second.x - first.x, second.y - first.y);
      const scale = Math.min(
        5,
        Math.max(1, (pinch.scale * distance) / pinch.distance),
      );
      const stage = stageRef.current;
      if (!stage) return;
      const rect = stage.getBoundingClientRect();
      const ratio = scale / pinch.scale;
      const centerX = (first.x + second.x) / 2;
      const centerY = (first.y + second.y) / 2;
      const startX = pinch.centerX - rect.left - rect.width / 2;
      const startY = pinch.centerY - rect.top - rect.height / 2;
      const currentX = centerX - rect.left - rect.width / 2;
      const currentY = centerY - rect.top - rect.height / 2;
      const offset = clampOffset(
        currentX - ratio * (startX - pinch.offsetX),
        currentY - ratio * (startY - pinch.offsetY),
        scale,
      );
      updateTransform({ scale, ...offset });
      return;
    }

    const drag = dragRef.current;
    if (!drag) return;
    const offset = clampOffset(
      drag.offsetX + event.clientX - drag.pointerX,
      drag.offsetY + event.clientY - drag.pointerY,
      transformRef.current.scale,
    );
    updateTransform({ scale: transformRef.current.scale, ...offset });
  };

  const onPointerEnd = (event: ReactPointerEvent<HTMLElement>) => {
    pointersRef.current.delete(event.pointerId);
    pinchRef.current = null;
    if (pointersRef.current.size === 1 && transformRef.current.scale > 1) {
      const [remaining] = [...pointersRef.current.values()];
      dragRef.current = {
        pointerX: remaining.x,
        pointerY: remaining.y,
        offsetX: transformRef.current.x,
        offsetY: transformRef.current.y,
      };
      setDragging(true);
      return;
    }
    endDrag();
  };

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        onClose();
      } else if (event.key === "ArrowLeft" && images.length > 1) {
        event.preventDefault();
        event.stopPropagation();
        setIndex((current) => (current - 1 + images.length) % images.length);
      } else if (event.key === "ArrowRight" && images.length > 1) {
        event.preventDefault();
        event.stopPropagation();
        setIndex((current) => (current + 1) % images.length);
      }
    };
    document.addEventListener("keydown", onKeyDown, true);
    return () => document.removeEventListener("keydown", onKeyDown, true);
  }, [images.length, onClose]);

  if (!images.length) return null;

  const image = images[index];
  const go = (delta: number) => {
    if (images.length < 2) return;
    setIndex((current) => (current + delta + images.length) % images.length);
  };

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center bg-black/90 p-3 sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-label={`${image.label}大图`}
      onClick={onClose}
    >
      <button
        type="button"
        className="absolute right-3 top-3 z-10 grid size-10 place-items-center rounded-full bg-white/10 text-white transition hover:bg-white/20 sm:right-5 sm:top-5"
        onClick={(event) => {
          event.stopPropagation();
          onClose();
        }}
        aria-label="关闭大图"
      >
        <X size={22} />
      </button>

      {images.length > 1 && (
        <>
          <button
            type="button"
            className="absolute left-2 top-1/2 z-10 grid size-11 -translate-y-1/2 place-items-center rounded-full bg-white/10 text-white transition hover:bg-white/20 sm:left-5"
            onClick={(event) => {
              event.stopPropagation();
              go(-1);
            }}
            aria-label="上一张卡面"
          >
            <ChevronLeft size={28} />
          </button>
          <button
            type="button"
            className="absolute right-2 top-1/2 z-10 grid size-11 -translate-y-1/2 place-items-center rounded-full bg-white/10 text-white transition hover:bg-white/20 sm:right-5"
            onClick={(event) => {
              event.stopPropagation();
              go(1);
            }}
            aria-label="下一张卡面"
          >
            <ChevronRight size={28} />
          </button>
        </>
      )}

      <figure
        ref={stageRef}
        className="flex h-[82dvh] w-[min(92vw,1200px)] touch-none flex-col items-center justify-center"
        style={{
          cursor:
            transform.scale > 1
              ? dragging
                ? "grabbing"
                : "grab"
              : "zoom-in",
        }}
        onClick={(event) => event.stopPropagation()}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerEnd}
        onPointerCancel={onPointerEnd}
        onLostPointerCapture={onPointerEnd}
        onDoubleClick={() => updateTransform({ scale: 1, x: 0, y: 0 })}
      >
        <div className="flex min-h-0 w-full flex-1 items-center justify-center overflow-hidden">
          <SmartImage
            key={image.src}
            src={image.src}
            alt={image.label}
            eager
            className="h-full w-full"
            imgClassName="size-full object-contain"
            imgStyle={{
              transform: `translate3d(${transform.x}px, ${transform.y}px, 0) scale(${transform.scale})`,
              transition: dragging ? "none" : undefined,
            }}
            spinnerSize={34}
          />
        </div>
        <figcaption className="mt-2 shrink-0 text-center text-sm text-white/75">
          {image.label}
          {images.length > 1 ? ` · ${index + 1} / ${images.length}` : ""}
          <span className="ml-2 text-white/45">
            双指或滚轮缩放 · 拖动查看
          </span>
        </figcaption>
      </figure>
    </div>
  );
}
