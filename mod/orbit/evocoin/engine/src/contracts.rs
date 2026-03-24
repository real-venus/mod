use alloy::providers::{Provider, ProviderBuilder};
use alloy::sol;
use eyre::Result;

pub type EthProvider = alloy::providers::fillers::FillProvider<
    alloy::providers::fillers::JoinFill<
        alloy::providers::Identity,
        alloy::providers::fillers::JoinFill<
            alloy::providers::fillers::GasFiller,
            alloy::providers::fillers::JoinFill<
                alloy::providers::fillers::BlobGasFiller,
                alloy::providers::fillers::JoinFill<
                    alloy::providers::fillers::NonceFiller,
                    alloy::providers::fillers::ChainIdFiller,
                >,
            >,
        >,
    >,
    alloy::providers::RootProvider,
>;

#[derive(Clone, Debug)]
pub struct ContractAddresses {
    pub evo_token: String,
    pub hub_exchange: String,
    pub evo_registry: String,
    pub token_factory: String,
}

pub fn create_provider(rpc_url: &str) -> Result<EthProvider> {
    let url = rpc_url.parse()?;
    let provider = ProviderBuilder::new().on_http(url);
    Ok(provider)
}

// ABI bindings via alloy sol! macro
sol! {
    #[sol(rpc)]
    interface IEvoToken {
        function name() external view returns (string);
        function symbol() external view returns (string);
        function totalSupply() external view returns (uint256);
        function balanceOf(address account) external view returns (uint256);
        function decimals() external view returns (uint8);
    }

    #[sol(rpc)]
    interface IHubExchange {
        function getSpotPrice(address spoke) external view returns (uint256);
        function getSpokeInfo(address spoke) external view returns (
            bool active,
            uint8 curveType,
            uint256 curveParam,
            uint16 buyFeeBps,
            uint16 sellFeeBps,
            address creator,
            uint256 reserveBalance,
            uint256 totalVolume,
            uint256 totalTrades,
            uint256 totalSupply
        );
        function buy(address spoke, uint256 evoAmount, uint256 minTokensOut) external returns (uint256);
        function sell(address spoke, uint256 tokenAmount, uint256 minEvoOut) external returns (uint256);
    }

    #[sol(rpc)]
    interface IEvoRegistry {
        struct TokenInfo {
            address tokenAddress;
            address creator;
            string name;
            string symbol;
            uint8 curveType;
            uint256 curveParam;
            string metadata;
            uint256 createdAt;
            bool active;
            uint256 fitnessScore;
        }

        function getToken(uint256 id) external view returns (TokenInfo);
        function getTokenByAddress(address addr) external view returns (TokenInfo);
        function getTokenCount() external view returns (uint256);
        function getAllTokens() external view returns (address[]);
        function getTokensPaginated(uint256 offset, uint256 limit) external view returns (TokenInfo[]);
        function getCreatorTokens(address creator) external view returns (uint256[]);
    }

    #[sol(rpc)]
    interface ITokenFactory {
        function createToken(
            string name,
            string symbol,
            uint8 curveType,
            uint256 curveParam,
            uint16 buyFeeBps,
            uint16 sellFeeBps,
            uint16 burnBps,
            string metadata
        ) external returns (address);
        function creationFee() external view returns (uint256);
    }
}
