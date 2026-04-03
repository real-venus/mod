//! ModRS CLI — entry point

use modrs::prelude::*;

#[tokio::main]
async fn main() -> Result<()> {
    modrs::cli::run().await
}
