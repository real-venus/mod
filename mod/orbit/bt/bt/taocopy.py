import mod as m
import bittensor as bt
import time
import json
import os
from typing import List, Dict, Any, Optional
from bittensor.utils.balance import Balance
from bittensor.core.chain_data import StakeInfo

print = m.print

# bittensor produces ~1 block every 12 seconds
BLOCKS_PER_DAY = 7200
BLOCKS_PER_MONTH = BLOCKS_PER_DAY * 30
DATA_DIR = os.path.expanduser('~/.bt/taocopy')


class TaoCopy:
    """Copy-trade the most profitable Bittensor stakers.

    Scans addresses, scores them by 30-day ROI, and mirrors their
    subnet allocations. Also lets you build a weighted subnet index.

    Usage:
        tc = TaoCopy('my_wallet', hotkey='my_hotkey')

        # --- discovery ---
        tc.scan_top(netuids=[1,3,18])          # find top stakers on subnets
        tc.rank()                               # rank by 30d ROI

        # --- copy trading ---
        tc.copy(budget_tao=50.0)               # copy top address allocations
        tc.follow('5F3x...', budget_tao=20.0)  # copy a specific address

        # --- index trading ---
        tc.create_index('defi', [1,3,8,18])    # equal-weight subnet index
        tc.create_index('top5', top_n=5)       # auto-pick top 5 by emission
        tc.buy_index('defi', 100.0)            # buy the index
        tc.rebalance('defi', 100.0)            # rebalance to target weights
        tc.sell_index('defi')                  # exit all positions
    """

    def __init__(self, wallet_name: str = 'default', hotkey: str = 'default',
                 network: str = 'finney', lookback_days: int = 30):
        self.wallet = bt.wallet(name=wallet_name, hotkey=hotkey)
        self.subtensor = bt.Subtensor(network=network)
        self.hotkey_ss58 = self.wallet.hotkey.ss58_address
        self.coldkey_ss58 = self.wallet.coldkeypub.ss58_address
        self.lookback_days = lookback_days
        self.lookback_blocks = lookback_days * BLOCKS_PER_DAY
        self.network = network
        os.makedirs(DATA_DIR, exist_ok=True)
        print(f'TaoCopy ready | wallet={wallet_name} lookback={lookback_days}d', color='green')

    # ── helpers ──────────────────────────────────────────────────────

    def _current_block(self) -> int:
        return self.subtensor.get_current_block()

    def _subnet_price(self, netuid: int) -> float:
        info = self.subtensor.subnet(netuid=netuid)
        d = info.__dict__
        tao_in = float(d.get('tao_in', Balance(0)).tao) if hasattr(d.get('tao_in', 0), 'tao') else float(d.get('tao_in', 0))
        alpha_in = float(d.get('alpha_in', Balance(0)).tao) if hasattr(d.get('alpha_in', 0), 'tao') else float(d.get('alpha_in', 0))
        return tao_in / alpha_in if alpha_in > 0 else 0

    def _save(self, name: str, data: Any):
        path = os.path.join(DATA_DIR, f'{name}.json')
        m.put(path, data)

    def _load(self, name: str, default=None):
        path = os.path.join(DATA_DIR, f'{name}.json')
        return m.get(path, default)

    # ── address scanning ─────────────────────────────────────────────

    def scan_top(self, netuids: Optional[List[int]] = None, top_n: int = 20) -> List[Dict]:
        """Find top stakers across subnets by scanning metagraph neurons.
        Returns list of {coldkey, hotkey, netuid, stake} dicts.
        """
        if netuids is None:
            netuids = self.subtensor.get_subnets()

        stakers = {}
        for netuid in netuids:
            try:
                meta = self.subtensor.metagraph(netuid)
                for uid in range(meta.n.item() if hasattr(meta.n, 'item') else int(meta.n)):
                    coldkey = meta.coldkeys[uid]
                    hotkey = meta.hotkeys[uid]
                    stake = float(meta.S[uid]) if hasattr(meta.S, '__getitem__') else 0
                    if stake <= 0:
                        continue
                    key = coldkey
                    if key not in stakers:
                        stakers[key] = {
                            'coldkey': coldkey,
                            'hotkeys': set(),
                            'positions': [],
                            'total_stake': 0,
                        }
                    stakers[key]['hotkeys'].add(hotkey)
                    stakers[key]['positions'].append({
                        'netuid': netuid, 'hotkey': hotkey, 'stake': stake
                    })
                    stakers[key]['total_stake'] += stake
            except Exception as e:
                print(f'Skip SN{netuid}: {e}', color='red')
                continue

        ranked = sorted(stakers.values(), key=lambda x: x['total_stake'], reverse=True)[:top_n]
        # convert sets for serialization
        for s in ranked:
            s['hotkeys'] = list(s['hotkeys'])

        self._save('scanned_stakers', ranked)
        for i, s in enumerate(ranked):
            print(f"#{i+1:>2} {s['coldkey'][:12]}... | {len(s['positions'])} subnets | {s['total_stake']:.2f} stake", color='cyan')
        return ranked

    def profile(self, coldkey: str) -> Dict:
        """Get full stake profile for an address across all subnets."""
        stakes = self.subtensor.get_stake_for_coldkey(coldkey)
        positions = []
        total = 0
        for si in stakes:
            amt = float(si.stake.tao) if hasattr(si.stake, 'tao') else float(si.stake)
            if amt <= 0:
                continue
            price = self._subnet_price(si.netuid)
            value = amt * price
            positions.append({
                'netuid': si.netuid,
                'hotkey': si.hotkey_ss58,
                'stake': amt,
                'price': price,
                'value_tao': value,
                'emission': float(si.emission.tao) if hasattr(si.emission, 'tao') else float(si.emission),
            })
            total += value
        result = {
            'coldkey': coldkey,
            'positions': positions,
            'total_value_tao': total,
            'n_subnets': len(positions),
        }
        print(f"{coldkey[:12]}... | {len(positions)} positions | {total:.2f} TAO value", color='cyan')
        for p in positions:
            print(f"  SN{p['netuid']:>3} | stake: {p['stake']:.4f} | value: {p['value_tao']:.4f} TAO | emission: {p['emission']:.6f}", color='white')
        return result

    # ── performance scoring ──────────────────────────────────────────

    def _snapshot_address(self, coldkey: str, block: int) -> Dict:
        """Snapshot an address's positions at a specific block."""
        stakes = self.subtensor.get_stake_for_coldkey(coldkey, block=block)
        positions = {}
        for si in stakes:
            amt = float(si.stake.tao) if hasattr(si.stake, 'tao') else float(si.stake)
            if amt <= 0:
                continue
            positions[si.netuid] = {
                'stake': amt,
                'hotkey': si.hotkey_ss58,
            }
        return positions

    def score(self, coldkey: str, days: Optional[int] = None) -> Dict:
        """Score an address by comparing current vs N-days-ago positions.
        Returns ROI normalized to 30 days.
        """
        days = days or self.lookback_days
        current_block = self._current_block()
        past_block = max(1, current_block - (days * BLOCKS_PER_DAY))

        # current positions
        now_stakes = self.subtensor.get_stake_for_coldkey(coldkey)
        now_value = 0
        now_positions = {}
        for si in now_stakes:
            amt = float(si.stake.tao) if hasattr(si.stake, 'tao') else float(si.stake)
            if amt <= 0:
                continue
            price = self._subnet_price(si.netuid)
            val = amt * price
            now_value += val
            now_positions[si.netuid] = {'stake': amt, 'value': val, 'price': price}

        # past positions
        past_stakes = self.subtensor.get_stake_for_coldkey(coldkey, block=past_block)
        past_value = 0
        for si in past_stakes:
            amt = float(si.stake.tao) if hasattr(si.stake, 'tao') else float(si.stake)
            if amt <= 0:
                continue
            price = self._subnet_price(si.netuid)
            past_value += amt * price

        # roi normalized to 30 days
        if past_value > 0:
            raw_roi = (now_value - past_value) / past_value
            normalized_roi = raw_roi * (30 / days)
        else:
            raw_roi = 0
            normalized_roi = 0

        result = {
            'coldkey': coldkey,
            'now_value': now_value,
            'past_value': past_value,
            'raw_roi': raw_roi,
            'roi_30d': normalized_roi,
            'days': days,
            'positions': now_positions,
        }
        color = 'green' if normalized_roi > 0 else 'red'
        print(f"{coldkey[:12]}... | ROI(30d): {normalized_roi*100:+.2f}% | now: {now_value:.2f} TAO | was: {past_value:.2f} TAO", color=color)
        return result

    def rank(self, addresses: Optional[List[str]] = None, days: Optional[int] = None, top_n: int = 10) -> List[Dict]:
        """Rank addresses by 30-day normalized ROI.
        If no addresses given, uses last scan_top results.
        """
        if addresses is None:
            scanned = self._load('scanned_stakers', [])
            addresses = [s['coldkey'] for s in scanned]
        if not addresses:
            print('No addresses to rank. Run scan_top() first.', color='red')
            return []

        scores = []
        for addr in addresses:
            try:
                s = self.score(addr, days=days)
                scores.append(s)
            except Exception as e:
                print(f'Skip {addr[:12]}...: {e}', color='red')
                continue

        scores.sort(key=lambda x: x['roi_30d'], reverse=True)
        scores = scores[:top_n]
        self._save('ranked', scores)

        print('\n── Leaderboard ──', color='yellow')
        for i, s in enumerate(scores):
            color = 'green' if s['roi_30d'] > 0 else 'red'
            print(f"#{i+1:>2} {s['coldkey'][:16]}... | ROI(30d): {s['roi_30d']*100:+.2f}% | {s['now_value']:.2f} TAO", color=color)
        return scores

    # ── copy trading ─────────────────────────────────────────────────

    def _allocations_from_profile(self, coldkey: str) -> Dict[int, float]:
        """Get target allocation weights from an address's current positions.
        Returns {netuid: weight} where weights sum to 1.
        """
        prof = self.profile(coldkey)
        total = prof['total_value_tao']
        if total <= 0:
            return {}
        allocs = {}
        for p in prof['positions']:
            allocs[p['netuid']] = p['value_tao'] / total
        return allocs

    def follow(self, coldkey: str, budget_tao: float, wait: bool = True) -> List[Dict]:
        """Copy a single address's allocation with the given budget.
        Buys into each subnet proportionally to their portfolio weights.
        """
        allocs = self._allocations_from_profile(coldkey)
        if not allocs:
            print(f'No positions to copy from {coldkey[:12]}...', color='red')
            return []

        print(f'\nCopying {coldkey[:12]}... with {budget_tao} TAO', color='yellow')
        trades = []
        for netuid, weight in sorted(allocs.items(), key=lambda x: x[1], reverse=True):
            amount = budget_tao * weight
            if amount < 0.01:
                continue
            print(f"  SN{netuid:>3} | weight: {weight*100:.1f}% | {amount:.4f} TAO", color='cyan')
            try:
                amt = Balance.from_tao(amount)
                ok = self.subtensor.add_stake(
                    wallet=self.wallet,
                    hotkey_ss58=self.hotkey_ss58,
                    netuid=netuid,
                    amount=amt,
                    wait_for_inclusion=wait,
                    wait_for_finalization=False,
                )
                trades.append({'netuid': netuid, 'amount': amount, 'success': ok})
                status = 'OK' if ok else 'FAIL'
                color = 'green' if ok else 'red'
                print(f"  → {status}", color=color)
            except Exception as e:
                print(f"  → ERROR: {e}", color='red')
                trades.append({'netuid': netuid, 'amount': amount, 'success': False, 'error': str(e)})

        self._save('last_copy', {'target': coldkey, 'budget': budget_tao, 'trades': trades})
        return trades

    def copy(self, budget_tao: float, top_n: int = 1, wait: bool = True) -> List[Dict]:
        """Copy the top-ranked address(es) by ROI.
        Splits budget equally among top_n addresses.
        """
        ranked = self._load('ranked', [])
        if not ranked:
            print('No ranked addresses. Run rank() first.', color='red')
            return []

        targets = ranked[:top_n]
        per_target = budget_tao / len(targets)
        all_trades = []
        for t in targets:
            coldkey = t['coldkey']
            print(f"\n── Copying #{targets.index(t)+1}: {coldkey[:16]}... (ROI: {t['roi_30d']*100:+.2f}%) ──", color='yellow')
            trades = self.follow(coldkey, per_target, wait=wait)
            all_trades.extend(trades)
        return all_trades

    # ── index trading ────────────────────────────────────────────────

    def create_index(self, name: str, netuids: Optional[List[int]] = None,
                     weights: Optional[Dict[int, float]] = None,
                     top_n: Optional[int] = None,
                     by: str = 'emission') -> Dict:
        """Create a named subnet index with custom or auto weights.

        Args:
            name: index name (e.g. 'defi', 'top5')
            netuids: explicit subnet list (equal weight if no weights given)
            weights: {netuid: weight} manual weights (will be normalized)
            top_n: auto-pick top N subnets by `by` metric
            by: metric for auto-pick ('emission', 'tao_in', 'alpha_in')
        """
        if weights:
            total_w = sum(weights.values())
            index_weights = {int(k): v / total_w for k, v in weights.items()}
        elif netuids:
            w = 1.0 / len(netuids)
            index_weights = {n: w for n in netuids}
        elif top_n:
            all_netuids = self.subtensor.get_subnets()
            scored = []
            for netuid in all_netuids:
                try:
                    info = self.subtensor.subnet(netuid=netuid)
                    d = info.__dict__
                    val = float(d.get(by, Balance(0)).tao) if hasattr(d.get(by, 0), 'tao') else float(d.get(by, 0))
                    scored.append((netuid, val))
                except Exception:
                    continue
            scored.sort(key=lambda x: x[1], reverse=True)
            picked = scored[:top_n]
            total_v = sum(v for _, v in picked)
            if total_v > 0:
                index_weights = {n: v / total_v for n, v in picked}
            else:
                w = 1.0 / len(picked)
                index_weights = {n: w for n, _ in picked}
        else:
            print('Provide netuids, weights, or top_n.', color='red')
            return {}

        index = {'name': name, 'weights': index_weights, 'created': time.time()}
        self._save(f'index_{name}', index)

        print(f'\nIndex "{name}" created ({len(index_weights)} subnets):', color='green')
        for netuid, w in sorted(index_weights.items(), key=lambda x: x[1], reverse=True):
            price = self._subnet_price(netuid)
            print(f"  SN{netuid:>3} | weight: {w*100:.1f}% | price: {price:.6f} TAO", color='cyan')
        return index

    def get_index(self, name: str) -> Dict:
        """Load a saved index."""
        idx = self._load(f'index_{name}')
        if not idx:
            print(f'Index "{name}" not found.', color='red')
            return {}
        return idx

    def list_indices(self) -> List[str]:
        """List all saved indices."""
        indices = []
        for f in os.listdir(DATA_DIR):
            if f.startswith('index_') and f.endswith('.json'):
                name = f[6:-5]
                indices.append(name)
                idx = self._load(f'index_{name}', {})
                n = len(idx.get('weights', {}))
                print(f'  {name} ({n} subnets)', color='cyan')
        return indices

    def buy_index(self, name: str, budget_tao: float, wait: bool = True) -> List[Dict]:
        """Buy into an index by allocating budget according to weights."""
        idx = self.get_index(name)
        if not idx:
            return []
        weights = idx['weights']
        # convert string keys back to int
        weights = {int(k): v for k, v in weights.items()}

        print(f'\nBuying index "{name}" with {budget_tao} TAO', color='yellow')
        trades = []
        for netuid, w in sorted(weights.items(), key=lambda x: x[1], reverse=True):
            amount = budget_tao * w
            if amount < 0.01:
                continue
            print(f"  SN{netuid:>3} | {w*100:.1f}% | {amount:.4f} TAO", color='cyan')
            try:
                amt = Balance.from_tao(amount)
                ok = self.subtensor.add_stake(
                    wallet=self.wallet,
                    hotkey_ss58=self.hotkey_ss58,
                    netuid=netuid,
                    amount=amt,
                    wait_for_inclusion=wait,
                    wait_for_finalization=False,
                )
                trades.append({'netuid': netuid, 'amount': amount, 'weight': w, 'success': ok})
                status = 'OK' if ok else 'FAIL'
                print(f"  → {status}", color='green' if ok else 'red')
            except Exception as e:
                print(f"  → ERROR: {e}", color='red')
                trades.append({'netuid': netuid, 'amount': amount, 'success': False, 'error': str(e)})

        self._save(f'index_{name}_trades', {'trades': trades, 'budget': budget_tao, 'time': time.time()})
        return trades

    def sell_index(self, name: str, wait: bool = True) -> List[Dict]:
        """Sell all positions in an index."""
        idx = self.get_index(name)
        if not idx:
            return []
        weights = {int(k): v for k, v in idx['weights'].items()}

        print(f'\nSelling index "{name}"', color='yellow')
        trades = []
        for netuid in weights:
            try:
                ok = self.subtensor.unstake(
                    wallet=self.wallet,
                    hotkey_ss58=self.hotkey_ss58,
                    netuid=netuid,
                    amount=None,
                    wait_for_inclusion=wait,
                    wait_for_finalization=False,
                )
                trades.append({'netuid': netuid, 'success': ok})
                print(f"  SN{netuid:>3} → {'SOLD' if ok else 'FAIL'}", color='green' if ok else 'red')
            except Exception as e:
                print(f"  SN{netuid:>3} → ERROR: {e}", color='red')
                trades.append({'netuid': netuid, 'success': False, 'error': str(e)})
        return trades

    def rebalance(self, name: str, total_tao: float, wait: bool = True) -> List[Dict]:
        """Rebalance holdings to match index weights.
        Unstakes overweight positions and stakes into underweight ones.
        """
        idx = self.get_index(name)
        if not idx:
            return []
        weights = {int(k): v for k, v in idx['weights'].items()}

        # get current holdings
        current = {}
        total_held = 0
        for netuid in weights:
            try:
                stake = self.subtensor.get_stake(
                    coldkey_ss58=self.coldkey_ss58,
                    hotkey_ss58=self.hotkey_ss58,
                    netuid=netuid,
                )
                amt = float(stake.tao) if hasattr(stake, 'tao') else float(stake)
                price = self._subnet_price(netuid)
                val = amt * price
                current[netuid] = {'stake': amt, 'value': val, 'price': price}
                total_held += val
            except Exception:
                current[netuid] = {'stake': 0, 'value': 0, 'price': 0}

        # compute deltas
        ref_total = max(total_tao, total_held)
        trades = []

        # first pass: sell overweight
        for netuid, w in weights.items():
            target_val = ref_total * w
            cur_val = current.get(netuid, {}).get('value', 0)
            delta = target_val - cur_val
            if delta < -0.01:
                sell_tao = abs(delta)
                print(f"  SN{netuid:>3} | overweight by {sell_tao:.4f} TAO → selling", color='yellow')
                try:
                    amt = Balance.from_tao(sell_tao)
                    ok = self.subtensor.unstake(
                        wallet=self.wallet, hotkey_ss58=self.hotkey_ss58,
                        netuid=netuid, amount=amt,
                        wait_for_inclusion=wait, wait_for_finalization=False,
                    )
                    trades.append({'netuid': netuid, 'action': 'sell', 'amount': sell_tao, 'success': ok})
                except Exception as e:
                    trades.append({'netuid': netuid, 'action': 'sell', 'amount': sell_tao, 'success': False, 'error': str(e)})

        # second pass: buy underweight
        for netuid, w in weights.items():
            target_val = ref_total * w
            cur_val = current.get(netuid, {}).get('value', 0)
            delta = target_val - cur_val
            if delta > 0.01:
                print(f"  SN{netuid:>3} | underweight by {delta:.4f} TAO → buying", color='yellow')
                try:
                    amt = Balance.from_tao(delta)
                    ok = self.subtensor.add_stake(
                        wallet=self.wallet, hotkey_ss58=self.hotkey_ss58,
                        netuid=netuid, amount=amt,
                        wait_for_inclusion=wait, wait_for_finalization=False,
                    )
                    trades.append({'netuid': netuid, 'action': 'buy', 'amount': delta, 'success': ok})
                except Exception as e:
                    trades.append({'netuid': netuid, 'action': 'buy', 'amount': delta, 'success': False, 'error': str(e)})

        return trades

    def index_value(self, name: str) -> Dict:
        """Get current value of your index holdings."""
        idx = self.get_index(name)
        if not idx:
            return {}
        weights = {int(k): v for k, v in idx['weights'].items()}

        total = 0
        positions = []
        for netuid, w in weights.items():
            try:
                stake = self.subtensor.get_stake(
                    coldkey_ss58=self.coldkey_ss58,
                    hotkey_ss58=self.hotkey_ss58,
                    netuid=netuid,
                )
                amt = float(stake.tao) if hasattr(stake, 'tao') else float(stake)
                price = self._subnet_price(netuid)
                val = amt * price
                total += val
                positions.append({'netuid': netuid, 'stake': amt, 'price': price, 'value': val, 'target_weight': w})
            except Exception:
                positions.append({'netuid': netuid, 'stake': 0, 'price': 0, 'value': 0, 'target_weight': w})

        # show actual vs target
        print(f'\nIndex "{name}" value: {total:.4f} TAO', color='green')
        for p in sorted(positions, key=lambda x: x['value'], reverse=True):
            actual_w = p['value'] / total * 100 if total > 0 else 0
            target_w = p['target_weight'] * 100
            drift = actual_w - target_w
            print(f"  SN{p['netuid']:>3} | {p['value']:.4f} TAO | actual: {actual_w:.1f}% target: {target_w:.1f}% drift: {drift:+.1f}%", color='cyan')

        return {'name': name, 'total_value': total, 'positions': positions}
