```
 _____ _______ ______
|     |       |      \
| | | |   -   |   -  |
|_|_|_|_______|______/

MODULAR OPERATING DAEMON
========================
v0.1.0 | MIT License
```

```
+-----------------------------------------------------------+
|  > SYSTEM BOOT                                            |
|  > LOADING MODULES ................................ [OK]   |
|  > INITIALIZING CRYPTO ENGINE .................... [OK]   |
|  > CONNECTING TO CHAIN ........................... [OK]   |
|  > MOD FRAMEWORK ONLINE                                   |
+-----------------------------------------------------------+
```

## WHAT IS THIS

MOD is a **modular development framework** that combines Python
module orchestration, EVM smart contracts, and AI-powered interfaces
into one system.

Write code. Register it on-chain. Get paid when people use it.

```
+-----------+     +-----------+     +-----------+
| DEVELOPER |---->| MOD PROTO |---->|   USERS   |
| writes fn |     | registers |     | call fn   |
| sets price|     | to chain  |     | pay token |
+-----------+     +-----------+     +-----------+
      ^                                   |
      +------------ revenue --------------+
```

---

## QUICK START

```
 > TERMINAL 1
 ============
 $ pip install -e ./
 $ m mods                  # list modules
 $ m serve api             # start server on :8000

 > TERMINAL 2
 ============
 $ cd mod/core/chain
 $ npx hardhat node        # local blockchain
 $ npx hardhat run scripts/deploy.js --network localhost

 > TERMINAL 3
 ============
 $ cd mod/core/app
 $ npm install && npm run dev   # frontend on :3000
```

---

## PROJECT MAP

```
~/mod/
.
|-- mod.json                    # root config
|-- setup.py                    # python package
|
|-- mod/
|   |-- core/
|   |   |-- mod.py              # main framework     [67KB]
|   |   |-- utils.py            # utilities           [75KB]
|   |   |-- chain/              # solidity contracts
|   |   |-- app/                # next.js frontend
|   |   |-- api/                # fastapi backend
|   |   |-- server/             # process management
|   |   |-- store/              # key-value store
|   |   |-- key/                # crypto keys
|   |   |-- cli/                # command line
|   |   |-- router/             # api routing
|   |   `-- tester/             # test utils
|   |
|   `-- orbit/                  # 140+ modules
|       |-- agent/              # ai agents
|       |-- claude/             # claude integration
|       |-- web/                # web scraping
|       |-- ipfs/               # ipfs storage
|       |-- safe/               # gnosis safe
|       |-- bridge/             # cross-chain
|       |-- cache/              # caching
|       `-- ...                 # 130+ more
|
`-- scripts/                    # deploy & automation
```

---

## CLI COMMANDS

```
+------------------+------------------------------------+
| COMMAND          | DESCRIPTION                        |
+------------------+------------------------------------+
| m mods           | list all available modules         |
| m info <mod>     | get module information              |
| m code <mod>     | view module source                 |
| m dp <mod>       | get module directory path           |
| m serve <mod>    | start module server                |
| m servers        | list running servers               |
| m kill <mod>     | stop module server                 |
| m test <mod>     | run module tests                   |
| m push "msg"     | git commit and push                |
+------------------+------------------------------------+
```

---

## PYTHON API

```python
import mod as m

# load and run modules
api = m.mod('api')()
result = m.fn('api/some_function')(param='value')

# server
m.serve('api', port=8000)

# crypto
key = m.get_key('my_key')
sig = m.sign({'data': 'value'}, key='my_key')

# storage
m.put('key', {'data': 'value'}, encrypt=True)
data = m.get('key')
```

---

## SMART CONTRACTS (BLOCTIME PROTOCOL)

```
+-------------------+------------------------------------------+
| CONTRACT          | PURPOSE                                  |
+-------------------+------------------------------------------+
| Treasury          | multi-token revenue distribution         |
| Market            | marketplace w/ instant withdrawals       |
| Registry          | module registration & management         |
| BlocTime          | staking w/ multiplier rewards            |
| TokenGate         | token whitelist + oracle integration     |
| Perms             | role-based access control                |
| Oracles           | price feeds (chainlink, pyth, manual)    |
+-------------------+------------------------------------------+

CHAIN: Base Sepolia (84532) | Solidity 0.8.20 | OpenZeppelin
```

---

## DEPLOYMENT

```
 > LOCAL DEV
   $ npx hardhat node
   $ npx hardhat run scripts/deploy.js --network localhost

 > TESTNET (BASE SEPOLIA)
   $ npx hardhat run scripts/deploy.js --network baseSepolia

 > MAINNET
   $ npx hardhat run scripts/deploy.js --network base

 > DOCKER (FULL STACK)
   $ docker-compose up -d
```

---

## DOCS INDEX

```
+-------------------------------+----------------------------+
| FILE                          | CONTENTS                   |
+-------------------------------+----------------------------+
| README.md                     | this file                  |
| MOD_ARCHITECTURE.md           | architecture deep dive     |
| mod/core/chain/README.md      | smart contracts            |
| mod/core/app/README.md        | frontend application       |
| mod/core/api/README.md        | api server                 |
| mod/core/store/README.md      | key-value storage          |
| mod/core/app/docs/            | whitepaper + onepager      |
+-------------------------------+----------------------------+
```

---

## SECURITY

```
[x] OpenZeppelin contract libraries
[x] ReentrancyGuard on all state changes
[x] Signature-based authentication
[x] AES encryption for sensitive data
[x] Role-based access control
[x] Client-side key generation
[x] HTTPS enforced in production
```

---

## CONTRIBUTING

```
1. fork the repo
2. create feature branch
3. make changes
4. run tests
5. submit PR
```

---

```
+-----------------------------------------------------------+
|                                                           |
|   "simplicity is the ultimate sophistication"             |
|                                        - da vinci         |
|                                                           |
|   built by the mod team                     MIT LICENSE   |
|                                                           |
+-----------------------------------------------------------+
```
