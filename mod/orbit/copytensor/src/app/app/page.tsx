import Leaderboard from "./components/Leaderboard";

export default function Home() {
  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold mb-1">copytensor</h1>
        <p className="text-muted text-sm">
          Bittensor dTAO copy trading — mirror subnet allocations of top
          performers based on N-day alpha PnL
        </p>
      </div>
      <Leaderboard />
    </div>
  );
}
