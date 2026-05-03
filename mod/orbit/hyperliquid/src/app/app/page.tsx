import TopTraders from "./components/TopTraders";

export default function Home() {
  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-xl tracking-wider text-ink">Top Traders by N-day performance</h1>
          <p className="text-xs text-muted mt-1">
            Pick a window, scan the leaderboard, and copy or compose into an index.
          </p>
        </div>
      </div>
      <TopTraders />
    </div>
  );
}
