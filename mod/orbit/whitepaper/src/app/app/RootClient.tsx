"use client";

import { useEffect, useState } from "react";

type RootInfo = { root: string | null; epoch: number | null; count?: number } | null;

const API = process.env.NEXT_PUBLIC_API_URL || "/api/whitepaper";

export default function RootClient({ initialRoot }: { initialRoot: RootInfo }) {
  const [root, setRoot] = useState<RootInfo>(initialRoot);
  const [refreshing, setRefreshing] = useState(false);

  async function refresh() {
    setRefreshing(true);
    try {
      const r = await fetch(`${API}/tree/root`, { cache: "no-store" });
      if (r.ok) setRoot(await r.json());
    } finally {
      setRefreshing(false);
    }
  }

  useEffect(() => {
    const t = setInterval(refresh, 15_000);
    return () => clearInterval(t);
  }, []);

  return (
    <article className="prose-paper">
      <header className="border-b border-black/10 pb-6 mb-8">
        <p className="text-xs uppercase tracking-widest text-modblue/70">
          MOD Protocol · Whitepaper v0.1
        </p>
        <h1>Scaling Off-Chain Open-Source Management</h1>
        <p className="text-modblue/80 -mt-1">
          Storing the tree, not the leaves: a Merkle-root registry for the MOD orbit ecosystem.
        </p>
        <div className="mt-6 grid grid-cols-2 gap-4 text-sm">
          <div className="border border-black/10 rounded p-3 bg-white/60">
            <div className="text-[10px] uppercase tracking-wider text-modblue/70">
              On-chain root
            </div>
            <code className="break-all text-[12px]">
              {root?.root ?? "— (no tree built)"}
            </code>
          </div>
          <div className="border border-black/10 rounded p-3 bg-white/60">
            <div className="text-[10px] uppercase tracking-wider text-modblue/70">
              Epoch / records
            </div>
            <code className="text-[12px]">
              {root?.epoch ?? "—"} / {root?.count ?? "—"}
            </code>
            <button
              onClick={refresh}
              disabled={refreshing}
              className="ml-3 text-[10px] underline text-modblue"
            >
              {refreshing ? "…" : "refresh"}
            </button>
          </div>
        </div>
      </header>

      <h2>Motivation</h2>
      <p>
        The current <code>Registry.sol</code> stores each module as an independent row keyed by
        an IPFS CID. With 200+ modules already deployed and agent-driven publishing on the
        horizon, the linear per-row gas cost has become the binding constraint on ecosystem
        scale.
      </p>
      <p>
        Re-registering a module costs <strong>80,000–110,000 gas</strong> on Base today. Every
        new version is a fresh write. Off-chain indexers that want to expose the registry over
        HTTP must replay every <code>ModRegistered</code> event since genesis — a quadratic
        cost in time and disk.
      </p>

      <h2>Construction</h2>
      <p>
        We replace the per-module hash table with a single 32-byte Merkle root anchored on
        chain. The full tree — module metadata, code CIDs, owner addresses, prices, version
        history — lives entirely off chain in an IPFS-pinned manifest. Authenticity is
        preserved by Merkle inclusion proofs; updates are batched into a single root-rotation
        transaction.
      </p>
      <p>Records are serialised as canonical JSON and hashed with keccak256:</p>
      <pre>{`record = {name, owner, cid, price, version, updatedAt}
leaf(r)  = keccak256(canonical_json(r))
tree     = sorted-pair Merkle tree (OpenZeppelin-compatible)
root     = tree.root()              // 1 SSTORE on chain`}</pre>

      <h3>On-chain anchor</h3>
      <pre>{`contract TreeRegistry {
    bytes32 public root;
    uint256 public epoch;
    mapping(bytes32 => bool) public revoked;

    function rotate(bytes32 newRoot, bytes32 manifestCid) external onlyPublisher {
        root = newRoot;
        epoch++;
        emit Rotated(epoch, newRoot, manifestCid);
    }

    function verify(bytes32 leaf, bytes32[] calldata proof) external view returns (bool) {
        if (revoked[leaf]) return false;
        return MerkleProof.verifyCalldata(proof, root, leaf);
    }
}`}</pre>

      <h2>Gas analysis</h2>
      <table>
        <thead>
          <tr>
            <th>Operation</th>
            <th>Current</th>
            <th>Tree</th>
          </tr>
        </thead>
        <tbody>
          <tr><td>Register</td><td>80k–110k</td><td>~30k / N</td></tr>
          <tr><td>Update CID</td><td>30k–50k</td><td>~30k / N</td></tr>
          <tr><td>Enumerate</td><td>O(N) event replay</td><td>1 IPFS fetch</td></tr>
          <tr><td>Storage growth</td><td>O(N)</td><td>O(1) + revocations</td></tr>
        </tbody>
      </table>
      <p>
        For a batch of <code>N = 100</code> updates, the amortised per-update cost drops to
        ~300 gas — two orders of magnitude below the current floor.
      </p>

      <h2>Verifiability</h2>
      <p>
        To verify that module <code>X</code> belongs to owner <code>O</code> with CID{" "}
        <code>C</code>, a client reads the on-chain root, pulls the manifest from any IPFS
        gateway, recomputes <code>leaf(r)</code>, and checks the Merkle proof. No trust is
        placed in any single gateway — a tampered manifest will fail to verify against the
        on-chain root.
      </p>

      <h2>Reference implementation</h2>
      <p>
        This page is served by the <code>whitepaper</code> orbit module. The Merkle tree
        endpoints are backed by a Rust API (<code>axum</code> + <code>tiny-keccak</code>)
        that shares state with the Python <code>Mod</code> class via{" "}
        <code>~/.mod/whitepaper/tree.json</code>.
      </p>
      <pre>{`POST /api/whitepaper/tree/build
POST /api/whitepaper/tree/proof   { "name": "agent" }
POST /api/whitepaper/tree/verify  { "leaf": "0x..", "proof": ["0x..", ...] }
GET  /api/whitepaper/tree/root
POST /api/whitepaper/mod/call     { "fn": "agent/info" }`}</pre>

      <h2>Migration</h2>
      <ol>
        <li>Shadow mode — <code>TreeRegistry</code> deployed alongside legacy <code>Registry</code>; both serve.</li>
        <li>Indexer flip — readers cut over to the tree-based view.</li>
        <li>Write deprecation — new registrations route through the tree pool.</li>
        <li>Sunset — legacy registry is frozen, <code>setOwnerless()</code>, mirrored into genesis manifest.</li>
      </ol>

      <footer className="border-t border-black/10 mt-12 pt-6 text-xs text-modblue/70 flex justify-between">
        <span>MOD Protocol — whitepaper module · v0.1</span>
        <a className="underline" href={`${API}/paper.tex`} target="_blank" rel="noreferrer">
          download .tex
        </a>
      </footer>
    </article>
  );
}
