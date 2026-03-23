use async_trait::async_trait;
use serde::{Deserialize, Serialize};
use std::any::Any;
use std::fmt::Debug;

/// Represents a move in a game
pub trait Move: Debug + Clone + Serialize + for<'de> Deserialize<'de> + Send + Sync {
    fn as_any(&self) -> &dyn Any;
}

/// Represents the state of a game
pub trait GameState: Debug + Clone + Serialize + for<'de> Deserialize<'de> + Send + Sync {
    fn as_any(&self) -> &dyn Any;
}

/// Core trait for defining games
#[async_trait]
pub trait Game: Send + Sync {
    /// The type of moves in this game
    type Move: Move;

    /// The type of game state
    type State: GameState;

    /// Name of the game
    fn name(&self) -> &str;

    /// Description of the game rules
    fn description(&self) -> &str;

    /// Initialize a new game state
    fn init(&self) -> Self::State;

    /// Apply a move to the current state
    fn apply_move(&self, state: &Self::State, player: usize, mv: &Self::Move) -> crate::Result<Self::State>;

    /// Check if the game is over
    fn is_terminal(&self, state: &Self::State) -> bool;

    /// Get valid moves for the current player
    fn valid_moves(&self, state: &Self::State, player: usize) -> Vec<Self::Move>;

    /// Get the current player (0-indexed)
    fn current_player(&self, state: &Self::State) -> usize;

    /// Number of players in the game
    fn num_players(&self) -> usize;

    /// Render the current state as a string
    fn render(&self, state: &Self::State) -> String {
        format!("{:?}", state)
    }
}

/// Helper macro to implement Move trait for simple types
#[macro_export]
macro_rules! impl_move {
    ($type:ty) => {
        impl Move for $type {
            fn as_any(&self) -> &dyn std::any::Any {
                self
            }
        }
    };
}

/// Helper macro to implement GameState trait for simple types
#[macro_export]
macro_rules! impl_game_state {
    ($type:ty) => {
        impl GameState for $type {
            fn as_any(&self) -> &dyn std::any::Any {
                self
            }
        }
    };
}
