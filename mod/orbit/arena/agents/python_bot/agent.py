"""
Example Python agent for arena.
Implements a simple heuristic Tic-Tac-Toe player.
"""

import json
import random


class Agent:
    """
    Python agent class.
    Must implement forward() method that takes state JSON and returns move JSON.
    """

    def __init__(self):
        self.name = "python_bot"

    def forward(self, state_json: str) -> str:
        """
        Forward function - make a move given the current state.

        Args:
            state_json: JSON string of current game state

        Returns:
            JSON string of move to make
        """
        state = json.loads(state_json)
        board = state.get("board", [])

        # Strategy: Try to win, block opponent, or pick center/corner
        move = self._find_winning_move(board, 0) or \
               self._find_winning_move(board, 1) or \
               self._pick_strategic_move(board)

        return json.dumps(move)

    def _find_winning_move(self, board, player):
        """Find a move that wins for the given player."""
        for row in range(3):
            for col in range(3):
                if board[row][col] is None:
                    # Try this move
                    board[row][col] = player
                    if self._check_winner(board) == player:
                        board[row][col] = None
                        return {"row": row, "col": col}
                    board[row][col] = None
        return None

    def _check_winner(self, board):
        """Check if there's a winner."""
        # Check rows
        for row in range(3):
            if board[row][0] is not None and \
               board[row][0] == board[row][1] == board[row][2]:
                return board[row][0]

        # Check columns
        for col in range(3):
            if board[0][col] is not None and \
               board[0][col] == board[1][col] == board[2][col]:
                return board[0][col]

        # Check diagonals
        if board[0][0] is not None and \
           board[0][0] == board[1][1] == board[2][2]:
            return board[0][0]
        if board[0][2] is not None and \
           board[0][2] == board[1][1] == board[2][0]:
            return board[0][2]

        return None

    def _pick_strategic_move(self, board):
        """Pick center, then corners, then any."""
        # Try center
        if board[1][1] is None:
            return {"row": 1, "col": 1}

        # Try corners
        corners = [(0, 0), (0, 2), (2, 0), (2, 2)]
        random.shuffle(corners)
        for row, col in corners:
            if board[row][col] is None:
                return {"row": row, "col": col}

        # Pick any
        for row in range(3):
            for col in range(3):
                if board[row][col] is None:
                    return {"row": row, "col": col}

        return {"row": 0, "col": 0}

    def on_match_start(self, game_name: str, num_players: int):
        """Called when a match starts."""
        print(f"{self.name} starting match in {game_name} with {num_players} players")

    def on_match_end(self, result_json: str):
        """Called when a match ends."""
        result = json.loads(result_json)
        print(f"{self.name} finished match with score: {result.get('scores', [])}")
