


(p) : progress
(c) : complete

foundation
    registry (c)
        - register module code and metadata relating to its ownership
    payment system (p)
        - charge users a subscription   
            - can be a credit/debit system that can be topped off with longer subscriptions
        - track costs on the backend if any (module providers need to calculate this)

    app (p)
        - allow for users to upload modules through github 
        - edit modules through the chat interface
        - tranfer tokens between users
        - fork modules
    

model 
    - openrouter (c)
    - anthropic (p)
    - openai (p)
    - chutes (p)

compute
    - primeintellect (p)
    - akash (p)
    - lium (p)

defi

    price: fetching the price
        - uniswap (p)
        - raydium (p)
        - coingecko (p)
        - coinmarketcap (p)
        - binance
    oracle
        - chainlink
        - pyth
    lending
        - aave
        - gnosis 
    lowfi (1-10% ROI for stables)
        - aave

storage:
    local : local sstorage
    ipfs : ipfs storage 

    
agent: selects tools based on the context of the query
    - tools
        - websearch (c)   
        - edit_file (c)
        - write_file (c)
    - memory 
        - memory of the user query as the agent runs through its plan
    - skill
        - the skil of the agent 

dev: an agent that uses agent to write and edit files for changing modules


    
    