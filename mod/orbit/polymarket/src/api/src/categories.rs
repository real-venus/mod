// Semantic category keywords — mirror of CATEGORY_KEYWORDS in
// app/lib/polymarket.ts. Kept in sync by hand. When the frontend changes,
// update here too.

pub fn keywords_for(category: &str) -> &'static [&'static str] {
    match category {
        "politics" => &[
            "election", "president", "congress", "senate", "party", "trump",
            "biden", "vote", "governor", "republican", "democrat", "midterm",
            "political",
        ],
        "sports" => &[
            "nba", "nfl", "mlb", "nhl", "soccer", "football", "basketball",
            "baseball", "tennis", "ufc", "championship", "playoffs",
            "super bowl", "world cup", "winner:", "score", "game handicap",
            "match", "beat the", "grand prix", "f1",
        ],
        "crypto" => &[
            "bitcoin", "btc", "eth", "ethereum", "solana", "sol", "crypto",
            "token", "altcoin", "defi", "nft", "bnb", "dogecoin", "xrp",
            "memecoin",
        ],
        "pop-culture" => &[
            "movie", "album", "oscar", "grammy", "emmy", "celebrity",
            "kardashian", "taylor swift", "drake", "rihanna", "box office",
            "tv show", "streaming",
        ],
        "business" => &[
            "stock", "market cap", "revenue", "ipo", "company", "ceo",
            "acquisition", "earnings", "nasdaq", "s&p", "dow",
        ],
        "science" => &[
            "nasa", "space", "climate", "temperature", "earthquake",
            "hurricane", "sea ice", "starship", "asteroid", "disease",
        ],
        "tech" => &[
            "apple", "google", "meta", "microsoft", "openai", "ai model",
            "launch", "release date", "tesla",
        ],
        "ai" => &[
            "ai", "gpt", "claude", "openai", "llm", "artificial intelligence",
            "chatgpt", "gemini", "machine learning",
        ],
        _ => &[],
    }
}

/// True if any of the trader's market titles match the category's keywords.
/// Unknown / empty category matches everything (filter is a no-op).
pub fn trader_in_category(market_titles: &[String], category: &str) -> bool {
    if category.is_empty() { return true; }
    let kws = keywords_for(category);
    if kws.is_empty() { return true; }
    market_titles.iter().any(|m| {
        let lower = m.to_lowercase();
        kws.iter().any(|kw| lower.contains(kw))
    })
}

/// Per-title variant. True if a single market title matches the category.
pub fn title_in_category(market_title: &str, category: &str) -> bool {
    if category.is_empty() { return true; }
    let kws = keywords_for(category);
    if kws.is_empty() { return true; }
    let lower = market_title.to_lowercase();
    kws.iter().any(|kw| lower.contains(kw))
}

/// Count how many of a trader's market titles fall in the category.
/// Used as a sort tiebreaker so traders heavier in the category rank first.
pub fn title_match_count(market_titles: &[String], category: &str) -> usize {
    if category.is_empty() { return 0; }
    let kws = keywords_for(category);
    if kws.is_empty() { return 0; }
    market_titles
        .iter()
        .filter(|m| {
            let lower = m.to_lowercase();
            kws.iter().any(|kw| lower.contains(kw))
        })
        .count()
}
