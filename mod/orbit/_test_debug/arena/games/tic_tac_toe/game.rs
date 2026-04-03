use arena::game::{Game, Move, GameState};
use serde::{Deserialize, Serialize};
use std::any::Any;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TicTacToeMove {
    pub row: usize,
    pub col: usize,
}

impl Move for TicTacToeMove {
    fn as_any(&self) -> &dyn Any {
        self
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TicTacToeState {
    pub board: [[Option<usize>; 3]; 3],
    pub current_player: usize,
    pub winner: Option<usize>,
}

impl GameState for TicTacToeState {
    fn as_any(&self) -> &dyn Any {
        self
    }
}

pub struct TicTacToe;

impl TicTacToe {
    pub fn new() -> Self {
        Self
    }

    fn check_winner(&self, board: &[[Option<usize>; 3]; 3]) -> Option<usize> {
        // Check rows
        for row in 0..3 {
            if board[row][0].is_some()
                && board[row][0] == board[row][1]
                && board[row][1] == board[row][2]
            {
                return board[row][0];
            }
        }

        // Check columns
        for col in 0..3 {
            if board[0][col].is_some()
                && board[0][col] == board[1][col]
                && board[1][col] == board[2][col]
            {
                return board[0][col];
            }
        }

        // Check diagonals
        if board[0][0].is_some() && board[0][0] == board[1][1] && board[1][1] == board[2][2] {
            return board[0][0];
        }
        if board[0][2].is_some() && board[0][2] == board[1][1] && board[1][1] == board[2][0] {
            return board[0][2];
        }

        None
    }

    fn is_full(&self, board: &[[Option<usize>; 3]; 3]) -> bool {
        board.iter().all(|row| row.iter().all(|cell| cell.is_some()))
    }
}

impl Default for TicTacToe {
    fn default() -> Self {
        Self::new()
    }
}

#[async_trait::async_trait]
impl Game for TicTacToe {
    type Move = TicTacToeMove;
    type State = TicTacToeState;

    fn name(&self) -> &str {
        "tic_tac_toe"
    }

    fn description(&self) -> &str {
        "Classic Tic-Tac-Toe game. First player to get 3 in a row wins."
    }

    fn init(&self) -> Self::State {
        TicTacToeState {
            board: [[None; 3]; 3],
            current_player: 0,
            winner: None,
        }
    }

    fn apply_move(
        &self,
        state: &Self::State,
        player: usize,
        mv: &Self::Move,
    ) -> arena::Result<Self::State> {
        // Validate move
        if mv.row >= 3 || mv.col >= 3 {
            return Err(arena::ArenaError::Game("Move out of bounds".to_string()));
        }

        if state.board[mv.row][mv.col].is_some() {
            return Err(arena::ArenaError::Game("Cell already occupied".to_string()));
        }

        // Apply move
        let mut new_state = state.clone();
        new_state.board[mv.row][mv.col] = Some(player);

        // Check for winner
        new_state.winner = self.check_winner(&new_state.board);

        // Switch player
        new_state.current_player = 1 - player;

        Ok(new_state)
    }

    fn is_terminal(&self, state: &Self::State) -> bool {
        state.winner.is_some() || self.is_full(&state.board)
    }

    fn valid_moves(&self, state: &Self::State, _player: usize) -> Vec<Self::Move> {
        let mut moves = Vec::new();
        for row in 0..3 {
            for col in 0..3 {
                if state.board[row][col].is_none() {
                    moves.push(TicTacToeMove { row, col });
                }
            }
        }
        moves
    }

    fn current_player(&self, state: &Self::State) -> usize {
        state.current_player
    }

    fn num_players(&self) -> usize {
        2
    }

    fn render(&self, state: &Self::State) -> String {
        let mut output = String::new();
        output.push_str("\n");
        for row in 0..3 {
            for col in 0..3 {
                let cell = match state.board[row][col] {
                    Some(0) => "X",
                    Some(1) => "O",
                    _ => ".",
                };
                output.push_str(cell);
                if col < 2 {
                    output.push('|');
                }
            }
            output.push('\n');
            if row < 2 {
                output.push_str("-+-+-\n");
            }
        }
        output
    }
}
