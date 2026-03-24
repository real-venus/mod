/**
 * EvoCoin Local Testnet Simulation
 *
 * Deploys the full protocol on hardhat local network, spawns creator + investor
 * agents, runs for N generations, and produces a leaderboard.
 *
 * Usage: npx hardhat run scripts/simulate.js
 */
const hre = require("hardhat");

const CURVE_NAMES = ["LINEAR", "EXPONENTIAL", "SIGMOID", "FIXED"];

// Agent personality archetypes for token creation
const CREATOR_ARCHETYPES = [
  { name: "GrowthCoin", symbol: "GROW", curveType: 0, curveParam: "500000000000000", buyFee: 50, sellFee: 200, burnBps: 3000, style: "steady growth, low entry fee, higher exit" },
  { name: "MoonShot", symbol: "MOON", curveType: 1, curveParam: "100000000000000", buyFee: 100, sellFee: 100, burnBps: 5000, style: "exponential, early buyers rewarded" },
  { name: "StablYield", symbol: "STBL", curveType: 3, curveParam: "1000000000000000000", buyFee: 25, sellFee: 25, burnBps: 8000, style: "fixed price, minimal fees, high burn" },
  { name: "SigmoidRise", symbol: "SIGR", curveType: 2, curveParam: "5000000000000000000", buyFee: 150, sellFee: 50, burnBps: 4000, style: "sigmoid, cheap to sell, expensive to buy" },
  { name: "BurnEngine", symbol: "BURN", curveType: 0, curveParam: "2000000000000000", buyFee: 300, sellFee: 300, burnBps: 9000, style: "high fees, most burned = deflationary" },
  { name: "FairLaunch", symbol: "FAIR", curveType: 0, curveParam: "100000000000000", buyFee: 0, sellFee: 0, burnBps: 0, style: "zero fees, pure bonding curve" },
  { name: "CreatorPay", symbol: "CPAY", curveType: 1, curveParam: "300000000000000", buyFee: 500, sellFee: 200, burnBps: 1000, style: "high buy fee, creator-funded" },
  { name: "DiamondHands", symbol: "DIAM", curveType: 0, curveParam: "800000000000000", buyFee: 50, sellFee: 800, burnBps: 5000, style: "cheap to buy, expensive to sell = hold incentive" },
];

// Investor agent strategies
const INVESTOR_STRATEGIES = [
  { name: "ValueHunter", style: "prefers low fees and linear curves" },
  { name: "DgenApe", style: "prefers exponential curves, goes all-in on moonshots" },
  { name: "ConservativeCarl", style: "prefers fixed price and low fees" },
  { name: "FeeFarmer", style: "avoids high-fee tokens" },
  { name: "Diversifier", style: "spreads evenly across all tokens" },
];

function mutateParam(value, range = 0.3) {
  const v = BigInt(value);
  const delta = v * BigInt(Math.floor(range * 100)) / 100n;
  const sign = Math.random() > 0.5 ? 1n : -1n;
  const mutated = v + sign * (delta * BigInt(Math.floor(Math.random() * 100)) / 100n);
  return mutated > 0n ? mutated : 1n;
}

function mutateFee(fee, maxDelta = 100) {
  const delta = Math.floor(Math.random() * maxDelta * 2) - maxDelta;
  return Math.max(0, Math.min(1000, fee + delta));
}

function investorScore(token, strategy) {
  // Simple heuristic scoring based on strategy
  let score = 50; // base
  const { curveType, buyFee, sellFee, burnBps } = token;
  const totalFee = buyFee + sellFee;

  switch (strategy.name) {
    case "ValueHunter":
      score += (1000 - totalFee) / 10; // prefer low fees
      if (curveType === 0) score += 20; // prefer linear
      break;
    case "DgenApe":
      if (curveType === 1) score += 50; // love exponential
      score += totalFee / 20; // doesn't mind fees
      break;
    case "ConservativeCarl":
      if (curveType === 3) score += 40; // loves fixed
      score += (1000 - totalFee) / 5;
      break;
    case "FeeFarmer":
      score += (1000 - totalFee) / 3; // strongly prefers low fees
      break;
    case "Diversifier":
      score = 50 + Math.random() * 30; // roughly equal
      break;
  }
  // Add randomness
  score += Math.random() * 20 - 10;
  return Math.max(1, Math.floor(score));
}

async function main() {
  const GENERATIONS = parseInt(process.env.GENERATIONS || "5");
  const TOP_K = parseInt(process.env.TOP_K || "3");

  console.log(`\n=== EvoCoin Evolutionary Simulation ===`);
  console.log(`Generations: ${GENERATIONS} | Survivors per gen: ${TOP_K}`);
  console.log(`Investor agents: ${INVESTOR_STRATEGIES.length}`);

  const [deployer, ...signers] = await hre.ethers.getSigners();
  const investors = signers.slice(0, INVESTOR_STRATEGIES.length);

  // Deploy protocol
  console.log("\n--- Deploying Protocol ---");
  const EvoToken = await hre.ethers.getContractFactory("EvoToken");
  const evoToken = await EvoToken.deploy(hre.ethers.parseEther("100000000"));
  await evoToken.waitForDeployment();
  console.log("EvoToken:", await evoToken.getAddress());

  const HubExchange = await hre.ethers.getContractFactory("HubExchange");
  const exchange = await HubExchange.deploy(await evoToken.getAddress());
  await exchange.waitForDeployment();

  const EvoRegistry = await hre.ethers.getContractFactory("EvoRegistry");
  const registry = await EvoRegistry.deploy();
  await registry.waitForDeployment();

  const TokenFactory = await hre.ethers.getContractFactory("TokenFactory");
  const factory = await TokenFactory.deploy(
    await exchange.getAddress(), await registry.getAddress(),
    await evoToken.getAddress(), 0
  );
  await factory.waitForDeployment();

  await exchange.setFactory(await factory.getAddress());
  await registry.setFactory(await factory.getAddress());

  // Fund investor wallets
  const investPerAgent = hre.ethers.parseEther("100000");
  for (const inv of investors) {
    await evoToken.transfer(inv.address, investPerAgent);
    await evoToken.connect(inv).approve(await exchange.getAddress(), investPerAgent);
  }
  console.log(`Funded ${investors.length} investor agents`);

  // Evolution loop
  let survivors = [];
  const allResults = [];

  for (let gen = 0; gen < GENERATIONS; gen++) {
    console.log(`\n=== Generation ${gen + 1}/${GENERATIONS} ===`);

    // Create tokens: mutated survivors + new archetypes
    const tokens = [];

    // Mutate survivors
    for (const s of survivors) {
      const mutated = {
        name: `${s.name}v${gen + 2}`,
        symbol: `${s.symbol}${gen + 2}`,
        curveType: s.curveType,
        curveParam: mutateParam(s.curveParam).toString(),
        buyFee: mutateFee(s.buyFee),
        sellFee: mutateFee(s.sellFee),
        burnBps: Math.max(0, Math.min(10000, s.burnBps + Math.floor(Math.random() * 2000 - 1000))),
      };
      tokens.push(mutated);
    }

    // Add new random archetypes to fill slots
    const newCount = CREATOR_ARCHETYPES.length - tokens.length;
    const shuffled = [...CREATOR_ARCHETYPES].sort(() => Math.random() - 0.5);
    for (let i = 0; i < Math.max(0, newCount); i++) {
      const a = shuffled[i % shuffled.length];
      tokens.push({
        name: `${a.name}G${gen + 1}`,
        symbol: `${a.symbol}${gen + 1}`,
        curveType: a.curveType,
        curveParam: mutateParam(a.curveParam, 0.5).toString(),
        buyFee: mutateFee(a.buyFee, 50),
        sellFee: mutateFee(a.sellFee, 50),
        burnBps: a.burnBps,
      });
    }

    // Deploy all tokens
    const deployed = [];
    for (const t of tokens) {
      try {
        const tx = await factory.createToken(
          t.name, t.symbol, t.curveType, t.curveParam,
          t.buyFee, t.sellFee, t.burnBps, "{}"
        );
        const receipt = await tx.wait();
        const event = receipt.logs.find(l => {
          try { return factory.interface.parseLog(l)?.name === "TokenCreated"; }
          catch { return false; }
        });
        const addr = factory.interface.parseLog(event).args.token;
        deployed.push({ ...t, address: addr, totalInvested: 0n });
        console.log(`  Created ${t.symbol} (${CURVE_NAMES[t.curveType]}) @ ${addr.slice(0, 10)}...`);
      } catch (e) {
        console.log(`  FAILED to create ${t.symbol}: ${e.message.slice(0, 60)}`);
      }
    }

    // Investor agents evaluate and trade
    for (let i = 0; i < investors.length; i++) {
      const inv = investors[i];
      const strategy = INVESTOR_STRATEGIES[i];
      const balance = await evoToken.balanceOf(inv.address);
      if (balance === 0n) continue;

      // Score each token
      const scores = deployed.map(t => ({
        token: t,
        score: investorScore(t, strategy)
      }));
      const totalScore = scores.reduce((s, x) => s + x.score, 0);

      // Allocate proportionally
      for (const { token, score } of scores) {
        const allocation = balance * BigInt(score) / BigInt(totalScore) / 2n; // invest 50% of balance
        if (allocation > 0n) {
          try {
            await exchange.connect(inv).buy(token.address, allocation, 0);
            token.totalInvested += allocation;
          } catch (e) {
            // Skip failed trades
          }
        }
      }
    }

    // Mine some blocks to simulate passage of time
    for (let b = 0; b < 10; b++) {
      await hre.network.provider.send("evm_mine");
    }

    // Rank by total investment
    deployed.sort((a, b) => {
      if (b.totalInvested > a.totalInvested) return 1;
      if (b.totalInvested < a.totalInvested) return -1;
      return 0;
    });

    // Leaderboard
    console.log(`\n  --- Leaderboard Gen ${gen + 1} ---`);
    deployed.forEach((t, i) => {
      const evo = hre.ethers.formatEther(t.totalInvested);
      const marker = i < TOP_K ? "  *" : "   ";
      console.log(`  ${marker} #${i + 1} ${t.symbol.padEnd(8)} ${CURVE_NAMES[t.curveType].padEnd(12)} fees=${t.buyFee}/${t.sellFee}bps  invested=${parseFloat(evo).toFixed(2)} EVO`);
    });

    // Select survivors
    survivors = deployed.slice(0, TOP_K).map(t => ({
      name: t.name, symbol: t.symbol, curveType: t.curveType,
      curveParam: t.curveParam, buyFee: t.buyFee, sellFee: t.sellFee,
      burnBps: t.burnBps, totalInvested: t.totalInvested.toString(),
    }));

    allResults.push({
      generation: gen + 1,
      leaderboard: deployed.map((t, i) => ({
        rank: i + 1,
        symbol: t.symbol,
        name: t.name,
        curve: CURVE_NAMES[t.curveType],
        buyFee: t.buyFee,
        sellFee: t.sellFee,
        invested: hre.ethers.formatEther(t.totalInvested),
        survived: i < TOP_K,
      })),
    });
  }

  // Final summary
  console.log(`\n\n========================================`);
  console.log(`  FINAL WINNERS (after ${GENERATIONS} generations)`);
  console.log(`========================================`);
  survivors.forEach((s, i) => {
    const evo = parseFloat(hre.ethers.formatEther(s.totalInvested)).toFixed(2);
    console.log(`  #${i + 1} ${s.symbol} (${s.name})`);
    console.log(`     Curve: ${CURVE_NAMES[s.curveType]} | Param: ${s.curveParam}`);
    console.log(`     Fees: buy=${s.buyFee}bps sell=${s.sellFee}bps burn=${s.burnBps}bps`);
    console.log(`     Total Invested: ${evo} EVO`);
  });

  // Save results
  const fs = require("fs");
  const path = require("path");
  const outPath = path.join(__dirname, "..", "simulation_results.json");
  fs.writeFileSync(outPath, JSON.stringify({ generations: GENERATIONS, results: allResults, winners: survivors }, null, 2));
  console.log(`\nResults saved to simulation_results.json`);
}

main()
  .then(() => process.exit(0))
  .catch((e) => { console.error(e); process.exit(1); });
