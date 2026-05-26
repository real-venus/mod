"use client";

import { ReactNode, useCallback, useEffect, useRef, useState } from "react";
import { useSplit } from "../context/SplitContext";
import { useEmbedded } from "../lib/embedded";

/// Wraps the app shell. When extra panes have been added via SplitContext,
/// the viewport is divided into resizable columns, with the main app on the
/// left and an iframe per extra pane on the right.
///
/// Panes render the same origin via iframe; localStorage is shared so token
/// persistence + auth state survive across panes. Embedded iframes get
/// `?embedded=1` in their URL and skip the SplitShell themselves to prevent
/// runaway nesting.
export default function SplitShell({ children }: { children: ReactNode }) {
  const { panes, widths, closePane, setPaneUrl, setWidths } = useSplit();
  const embedded = useEmbedded();
  const dragRef = useRef<{ idx: number; startX: number; startWidths: number[] } | null>(null);
  const [draggingIdx, setDraggingIdx] = useState<number | null>(null);

  const startDrag = useCallback((idx: number, startX: number) => {
    dragRef.current = { idx, startX, startWidths: [...widths] };
    setDraggingIdx(idx);
  }, [widths]);

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      const d = dragRef.current;
      if (!d) return;
      const vw = window.innerWidth;
      const deltaPct = ((e.clientX - d.startX) / vw) * 100;
      const next = [...d.startWidths];
      // Resize between column d.idx and d.idx+1.
      const left = next[d.idx] + deltaPct;
      const right = next[d.idx + 1] - deltaPct;
      const MIN = 12;
      if (left < MIN || right < MIN) return;
      next[d.idx] = left;
      next[d.idx + 1] = right;
      setWidths(next);
    };
    const onUp = () => {
      if (dragRef.current) {
        dragRef.current = null;
        setDraggingIdx(null);
      }
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [setWidths]);

  // Embedded panes never split further.
  if (embedded || panes.length === 0) {
    return <>{children}</>;
  }

  return (
    <div
      className="flex items-stretch"
      style={{
        height: "calc(100vh - 3rem)",
        userSelect: draggingIdx !== null ? "none" : undefined,
        cursor: draggingIdx !== null ? "col-resize" : undefined,
      }}
    >
      {/* Main column */}
      <div className="min-w-0 overflow-auto" style={{ width: `${widths[0]}%` }}>
        {children}
      </div>

      {panes.map((pane, i) => {
        const sepIdx = i; // separator between col i and col i+1 (main is col 0)
        const url = pane.url + (pane.url.includes("?") ? "&" : "?") + "embedded=1";
        return (
          <SplitPaneFragment
            key={pane.id}
            width={widths[i + 1]}
            url={url}
            displayUrl={pane.url}
            onUrlChange={(u) => setPaneUrl(pane.id, u)}
            onClose={() => closePane(pane.id)}
            onSeparatorDrag={(e) => startDrag(sepIdx, e.clientX)}
            dragging={draggingIdx === sepIdx}
          />
        );
      })}
    </div>
  );
}

interface PaneProps {
  width: number;
  url: string;
  displayUrl: string;
  onUrlChange: (u: string) => void;
  onClose: () => void;
  onSeparatorDrag: (e: React.MouseEvent) => void;
  dragging: boolean;
}

function SplitPaneFragment({ width, url, displayUrl, onUrlChange, onClose, onSeparatorDrag, dragging }: PaneProps) {
  const [draft, setDraft] = useState(displayUrl);
  useEffect(() => { setDraft(displayUrl); }, [displayUrl]);

  return (
    <>
      <div
        onMouseDown={onSeparatorDrag}
        className={`w-1.5 shrink-0 cursor-col-resize transition-colors ${
          dragging ? "bg-pixel-white/60" : "bg-pixel-border hover:bg-pixel-white/40"
        }`}
        role="separator"
        aria-orientation="vertical"
        title="Drag to resize"
      />
      <div className="min-w-0 flex flex-col border-l-2 border-pixel-border" style={{ width: `${width}%` }}>
        <div className="shrink-0 flex items-center gap-1 px-1.5 py-1 border-b-2 border-pixel-border bg-pixel-black/80">
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") onUrlChange(draft); }}
            onBlur={() => { if (draft !== displayUrl) onUrlChange(draft); }}
            className="pixel-input-sm flex-1 font-mono text-[12px]"
            spellCheck={false}
          />
          <button
            onClick={onClose}
            title="Close pane"
            className="pixel-btn text-[12px] px-1.5 py-0.5 border-red-400 text-red-400 hover:bg-red-400/10"
          >
            X
          </button>
        </div>
        <iframe
          src={url}
          className="flex-1 w-full border-0 bg-pixel-black"
          // Pointer events get swallowed inside the iframe while dragging the
          // separator (mouse leaves the parent). Block them so the drag works.
          style={{ pointerEvents: dragging ? "none" : undefined }}
        />
      </div>
    </>
  );
}
