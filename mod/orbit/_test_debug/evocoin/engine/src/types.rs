use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize)]
pub struct ApiError {
    pub error: String,
}

#[derive(Debug, Serialize)]
pub struct HealthResponse {
    pub status: String,
    pub chain_id: u64,
    pub rpc_url: String,
    pub contracts: ContractStatus,
}

#[derive(Debug, Serialize)]
pub struct ContractStatus {
    pub evo_token: String,
    pub hub_exchange: String,
    pub evo_registry: String,
    pub token_factory: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct SpokeInfo {
    pub address: String,
    pub name: String,
    pub symbol: String,
    pub curve_type: u8,
    pub curve_param: String,
    pub creator: String,
    pub reserve_balance: String,
    pub total_volume: String,
    pub total_trades: String,
    pub total_supply: String,
    pub spot_price: String,
    pub fitness_score: String,
    pub active: bool,
    pub metadata: String,
    pub created_at: String,
}

#[derive(Debug, Deserialize)]
pub struct CreateTokenRequest {
    pub name: String,
    pub symbol: String,
    pub curve_type: u8,
    pub curve_param: String,
    pub buy_fee_bps: u16,
    pub sell_fee_bps: u16,
    pub burn_bps: u16,
    pub metadata: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct BuyRequest {
    pub spoke: String,
    pub evo_amount: String,
    pub min_tokens_out: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct SellRequest {
    pub spoke: String,
    pub token_amount: String,
    pub min_evo_out: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct FitnessUpdateRequest {
    pub token_ids: Vec<u64>,
    pub scores: Vec<u64>,
}

#[derive(Debug, Deserialize)]
pub struct PaginationQuery {
    pub offset: Option<u64>,
    pub limit: Option<u64>,
}
