"use client";

import { useEffect, useRef, type ReactNode } from "react";

interface ModalProps {
  /** id des Überschrift-Elements innerhalb von `children`. */
  titleId: string;
  onClose: () => void;
  children: ReactNode;
  maxWidthClass?: string;
}

/**
 * Gemeinsame Modal-Hülle: Backdrop, Escape, Fokus, Schließen-Knopf.
 * Wird von EntryDetailModal und ClusterListModal genutzt.
 */
export default function Modal({
  titleId,
  onClose,
  children,
  maxWidthClass = "max-w-lg",
}: ModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  /** Fokus nach dem Schließen zurückgeben. */
  const previousFocus = useRef<Element | null>(null);

  useEffect(() => {
    previousFocus.current = document.activeElement;
    dialogRef.current?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.stopPropagation();
        onClose();
      }
    };
    document.addEventListener("keydown", onKeyDown);

    return () => {
      document.removeEventListener("keydown", onKeyDown);
      const previous = previousFocus.current;
      if (previous instanceof HTMLElement) previous.focus();
    };
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-coal/40 p-4"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className={`card animate-fade-up relative max-h-[86dvh] w-full overflow-y-auto shadow-(--shadow-card-lg) outline-none ${maxWidthClass}`}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Schließen"
          className="absolute top-3 right-3 z-10 flex h-9 w-9 cursor-pointer items-center justify-center rounded-full border border-paper-line bg-paper-card/95 text-coal-soft shadow-(--shadow-card) transition-colors hover:text-coal focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-fox"
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 16 16"
            fill="none"
            aria-hidden="true"
          >
            <path
              d="M3.5 3.5l9 9M12.5 3.5l-9 9"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
            />
          </svg>
        </button>
        {children}
      </div>
    </div>
  );
}
