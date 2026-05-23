"use client";

import { useState } from "react";
import { useEmbedded } from "../lib/embedded";

/// Fixed bottom-right badge showing the content hash of this build. Lets a
/// visitor verify the deployed code by recomputing the same hash locally.
///
/// `NEXT_PUBLIC_BUILD_CID` is set by `docker-entrypoint.dev.sh` — it's a
/// sha256 over the sorted source-file manifest (`sha256:<64 hex>`). For a
/// real IPFS CID (bafk...), have the prod build script set this env var
/// instead.
export default function BuildBadge() {
  const [copied, setCopied] = useState(false);
  const embedded = useEmbedded();
  const cid = process.env.NEXT_PUBLIC_BUILD_CID || "dev";
  const builtAt = process.env.NEXT_PUBLIC_BUILD_TIME || "";

  // Embedded panes already display the same badge from the host, so suppress
  // it inside iframes to avoid the double-badge clutter.
  if (embedded) return null;

  const display = cid.startsWith("sha256:")
    ? `sha256:${cid.slice(7, 7 + 12)}...`
    : cid.length > 20
      ? `${cid.slice(0, 12)}...${cid.slice(-6)}`
      : cid;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(cid);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {}
  };

  const tooltip = [
    "Content hash of the served bundle.",
    `Full: ${cid}`,
    builtAt && `Built: ${builtAt}`,
    "",
    cid.startsWith("sha256:")
      ? "Verify: clone the repo, run the same sha256-over-manifest script in mod/orbit/polymarket/docker-entrypoint.dev.sh and confirm the digest matches."
      : "Verify: re-pin the build output to IPFS and confirm the CID matches.",
  ]
    .filter(Boolean)
    .join("\n");

  return (
    <button
      onClick={handleCopy}
      title={tooltip}
      className="fixed bottom-2 right-2 z-40 pixel-btn text-[10px] px-2 py-1 font-mono border-pixel-border text-pixel-gray bg-pixel-black/80 hover:text-green-400 hover:border-green-400 backdrop-blur-sm"
    >
      {copied ? "COPIED" : display}
    </button>
  );
}
