"use client";

import { useSplit } from "../context/SplitContext";
import { useEmbedded } from "../lib/embedded";

/// Top-bar button that adds a new split pane. Hidden when running inside an
/// embedded iframe (panes don't recursively split).
export default function SplitButton() {
  const { addPane, panes } = useSplit();
  const embedded = useEmbedded();
  if (embedded) return null;

  return (
    <button
      onClick={() => addPane()}
      title="Open the current page in a new split pane"
      className="pixel-btn text-[13px] px-2 py-1 transition-colors flex items-center gap-1.5 border-pixel-border text-pixel-gray hover:text-pixel-white hover:border-pixel-white"
    >
      <span className="font-mono">SPLIT{panes.length > 0 ? ` +${panes.length}` : ""}</span>
    </button>
  );
}
