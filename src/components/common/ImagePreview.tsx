import { Show, createEffect, createSignal, onCleanup } from 'solid-js';
import type { JSX } from 'solid-js';
import { Portal } from 'solid-js/web';

type ImagePreviewProps = {
  src: string;
  fullSrc?: string;
  onRequestFull?: () => Promise<string>;
  onFullSrcCleanup?: (src: string) => void;
  alt?: string;
  class?: string;
  classList?: Record<string, boolean>;
  style?: string | JSX.CSSProperties;
  loading?: 'lazy' | 'eager';
};

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

export default function ImagePreview(props: ImagePreviewProps) {
  const [isOpen, setIsOpen] = createSignal(false);
  const [resolvedFullSrc, setResolvedFullSrc] = createSignal<string | null>(null);
  const [isLoadingFull, setIsLoadingFull] = createSignal(false);
  const [scale, setScale] = createSignal(1);
  const [offsetX, setOffsetX] = createSignal(0);
  const [offsetY, setOffsetY] = createSignal(0);
  const [isDragging, setIsDragging] = createSignal(false);
  const [startX, setStartX] = createSignal(0);
  const [startY, setStartY] = createSignal(0);
  const [startOffsetX, setStartOffsetX] = createSignal(0);
  const [startOffsetY, setStartOffsetY] = createSignal(0);

  const resetView = () => {
    setScale(1);
    setOffsetX(0);
    setOffsetY(0);
  };

  const openPreview = () => {
    resetView();
    setIsOpen(true);
  };

  const closePreview = () => {
    setIsOpen(false);
    setIsDragging(false);
  };

  const cleanupFullSrc = () => {
    const current = resolvedFullSrc();
    if (current && props.onFullSrcCleanup) {
      props.onFullSrcCleanup(current);
    }
    setResolvedFullSrc(null);
    setIsLoadingFull(false);
  };

  createEffect(() => {
    if (!isOpen()) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        closePreview();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    onCleanup(() => window.removeEventListener('keydown', handleKeyDown));
  });

  createEffect(() => {
    if (!isOpen()) {
      cleanupFullSrc();
      return;
    }

    if (props.fullSrc) {
      setResolvedFullSrc(props.fullSrc);
      return;
    }

    if (!props.onRequestFull || resolvedFullSrc()) return;

    let cancelled = false;
    setIsLoadingFull(true);
    props
      .onRequestFull()
      .then((src) => {
        if (!cancelled) setResolvedFullSrc(src);
      })
      .finally(() => {
        if (!cancelled) setIsLoadingFull(false);
      });

    onCleanup(() => {
      cancelled = true;
    });
  });

  onCleanup(() => cleanupFullSrc());

  const handleWheel = (event: WheelEvent) => {
    event.preventDefault();
    const delta = -event.deltaY * 0.0015;
    setScale((prev) => {
      const next = clamp(prev + delta, 1, 4);
      if (next <= 1) {
        setOffsetX(0);
        setOffsetY(0);
      }
      return next;
    });
  };

  const handlePointerDown = (event: PointerEvent) => {
    if (scale() <= 1) return;
    setIsDragging(true);
    setStartX(event.clientX);
    setStartY(event.clientY);
    setStartOffsetX(offsetX());
    setStartOffsetY(offsetY());
    (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
  };

  const handlePointerMove = (event: PointerEvent) => {
    if (!isDragging()) return;
    setOffsetX(startOffsetX() + (event.clientX - startX()));
    setOffsetY(startOffsetY() + (event.clientY - startY()));
  };

  const handlePointerUp = (event: PointerEvent) => {
    if (!isDragging()) return;
    setIsDragging(false);
    (event.currentTarget as HTMLElement).releasePointerCapture(event.pointerId);
  };

  return (
    <>
      <button
        type="button"
        class="border-0 bg-transparent p-0"
        onClick={openPreview}
        aria-label={props.alt ?? 'Open image preview'}
      >
        <img
          src={props.src}
          alt={props.alt ?? 'Image preview'}
          class={`${props.class ?? ''} cursor-zoom-in`}
          classList={props.classList}
          style={props.style}
          loading={props.loading}
        />
      </button>

      <Show when={isOpen()}>
        <Portal>
          <dialog
            open
            class="fixed inset-0 z-[999] m-0 flex h-screen w-screen max-w-none items-center justify-center border-0 bg-black/70 p-0 backdrop-blur-sm"
            aria-label="Image preview"
            onClick={(event) => {
              if (event.target === event.currentTarget) closePreview();
            }}
          >
            <button
              type="button"
              class="btn btn-sm btn-ghost text-base-100 absolute top-4 right-4"
              onClick={closePreview}
            >
              Close
            </button>

            <div class="max-h-[90vh] max-w-[90vw] overflow-hidden">
              <img
                src={resolvedFullSrc() ?? props.src}
                alt={props.alt ?? 'Image preview'}
                classList={{
                  'cursor-grab': !isDragging(),
                  'cursor-grabbing': isDragging(),
                  'opacity-60': isLoadingFull(),
                }}
                style={{
                  transform: `translate(${offsetX()}px, ${offsetY()}px) scale(${scale()})`,
                  'transform-origin': 'center',
                  'touch-action': 'none',
                  'user-select': 'none',
                }}
                onWheel={handleWheel}
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
                onPointerCancel={handlePointerUp}
              />
            </div>

            <div class="text-base-100/80 absolute bottom-4 text-xs">
              Scroll to zoom · Drag to pan · Esc to close
            </div>
          </dialog>
        </Portal>
      </Show>
    </>
  );
}
