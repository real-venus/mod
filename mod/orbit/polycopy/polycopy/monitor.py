"""Account monitoring for Polymarket addresses"""

import asyncio
from collections import deque
from typing import Callable, Optional


class AccountMonitor:
    """Monitors a single Polymarket address for position changes"""

    def __init__(self, address: str, client, poll_interval: int = 30):
        self.address = address
        self.client = client
        self.poll_interval = poll_interval
        self.last_positions = {}
        self.position_history = deque(maxlen=1000)
        self.is_running = False
        self.on_change: Optional[Callable] = None
        self.on_error: Optional[Callable] = None

    async def start_monitoring(self):
        """Start async polling loop"""
        self.is_running = True
        print(f"[Monitor] Starting monitoring for {self.address}")

        while self.is_running:
            try:
                current_positions = await self.fetch_positions()
                changes = self.detect_changes(current_positions)

                if changes and self.on_change:
                    await self.on_change(changes)

                self.last_positions = current_positions
                self.position_history.append({
                    'timestamp': asyncio.get_event_loop().time(),
                    'positions': current_positions
                })

            except Exception as e:
                print(f"[Monitor] Error in monitoring loop: {e}")
                if self.on_error:
                    await self.on_error(e)

            await asyncio.sleep(self.poll_interval)

    def stop(self):
        """Stop monitoring"""
        self.is_running = False
        print(f"[Monitor] Stopped monitoring for {self.address}")

    async def fetch_positions(self) -> dict:
        """Fetch current positions from API"""
        try:
            result = self.client.get_user_positions(self.address)
            positions_dict = {}
            for pos in result.get('positions', []):
                positions_dict[pos['id']] = pos
            return positions_dict
        except Exception as e:
            print(f"[Monitor] Error fetching positions: {e}")
            return {}

    def detect_changes(self, current: dict) -> dict:
        """
        Compare current vs last positions
        Returns: {
            'new': [...],      # New positions opened
            'closed': [...],   # Positions closed
            'updated': [...]   # Position size changes
        }
        """
        changes = {
            'new': [],
            'closed': [],
            'updated': []
        }

        # Detect new positions
        for pos_id, position in current.items():
            if pos_id not in self.last_positions:
                changes['new'].append(position)
            elif position['quantity'] != self.last_positions[pos_id]['quantity']:
                changes['updated'].append(position)

        # Detect closed positions
        for pos_id, position in self.last_positions.items():
            if pos_id not in current:
                changes['closed'].append(position)

        # Only return if there are actual changes
        if changes['new'] or changes['closed'] or changes['updated']:
            return changes
        return None
