```
 _____ _______ _______
|     |       |       \     ARCHITECTURE
| | | |   -   |   -   |    REFERENCE
|_|_|_|_______|_______/     DOCUMENT
                            v0.1.0
```

```
+-----------------------------------------------------------+
|  > cat /sys/mod/architecture.txt                          |
|  > STATUS: DECLASSIFIED                                   |
|  > CLEARANCE: PUBLIC                                      |
+-----------------------------------------------------------+
```

---

## SYSTEM OVERVIEW

```
MOD FRAMEWORK is a 5-layer stack:

  LAYER 5  [ FRONTEND ]  next.js 14 + ai chat + wallet ui
            |
  LAYER 4  [ API      ]  fastapi async endpoints
            |
  LAYER 3  [ MODULES  ]  140+ composable python modules
            |
  LAYER 2  [ CHAIN    ]  evm smart contracts (bloctime)
            |
  LAYER 1  [ CORE     ]  python framework + crypto + storage
```

---

## LAYER 1: CORE FRAMEWORK

```
FILE: ~/mod/mod/core/mod.py  [67KB]
FILE: ~/mod/mod/core/utils.py [75KB]

CAPABILITIES:
.--------------------------------------------.
| module loading   | m.mod('name')()          |
| function calls   | m.fn('mod/func')(args)   |
| server deploy    | m.serve('mod', port)     |
| crypto signing   | m.sign(data, key)        |
| encrypted store  | m.put(k, v, encrypt=1)   |
| ai integration   | m.ask(prompt)            |
| git operations   | m.push('msg')            |
'--------------------------------------------'
```

---

## LAYER 2: BLOCKCHAIN (BLOCTIME PROTOCOL)

```
CHAIN:    Base Sepolia (chainId 84532)
COMPILER: Solidity 0.8.20
LIBS:     OpenZeppelin
TOOLING:  Hardhat

CONTRACT MAP:
.---------------------------------------------------.
|                                                   |
|   +----------+    +----------+    +----------+    |
|   | TREASURY |    |  MARKET  |    | REGISTRY |    |
|   | revenue  |    | exchange |    | modules  |    |
|   | distro   |    | instant  |    | on-chain |    |
|   +----+-----+    +----+-----+    +----+-----+    |
|        |               |               |          |
|   +----+-----+    +----+-----+    +----+-----+    |
|   | BLOCTIME |    |TOKENGATE |    |  PERMS   |    |
|   | staking  |    | whitelist|    | roles    |    |
|   | rewards  |    | oracles  |    | access   |    |
|   +----------+    +----------+    +----------+    |
|                                                   |
'---------------------------------------------------'

CONFIG: ~/mod/mod/core/chain/config.json
```

---

## LAYER 3: MODULE ECOSYSTEM

```
DIRECTORY: ~/mod/mod/orbit/
COUNT:     140+ modules

.----------------------------------------------------.
| CATEGORY       | MODULES                           |
|----------------+-----------------------------------|
| ai & agents    | agent, claude, model              |
| blockchain     | safe, bridge, ipfs, filecoin      |
| crypto         | zama (fhe), phala (tee)           |
| web & data     | web, websearch, cache, localfs    |
| development    | dev, test_base, skill, namespace  |
'----------------------------------------------------'

MODULE PATTERN:
  each module has an anchor file:
    mod.py | agent.py | block.py | <name>.py

LOADING:
  m.mod('agent')()     # load module
  m.fn('agent/run')()  # call function
```

---

## LAYER 4: API SERVER

```
DIRECTORY: ~/mod/mod/core/api/
FRAMEWORK: FastAPI (Python 3.11+)

FEATURES:
  [x] async request handling
  [x] dynamic endpoint generation
  [x] authentication & authorization
  [x] request logging & analytics
  [x] docker deployment ready

ENDPOINTS:
  POST /claim              submit claim w/ signature
  GET  /balance/{address}  check claimable balance
  POST /process            process pending (operator)
  GET  /stats              protocol statistics
```

---

## LAYER 5: FRONTEND APPLICATION

```
DIRECTORY: ~/mod/mod/core/app/
FRAMEWORK: Next.js 14.0.4 (App Router)

STACK:
  react 18 | typescript 5.3 | tailwind 3.4
  ethers.js v6 | @polkadot/api | framer-motion

FEATURES:
  [x] ai chat interface
  [x] module marketplace
  [x] treasury management
  [x] multi-wallet support (metamask, phantom, subwallet)
  [x] multi-chain (evm, substrate, solana)
  [x] transaction tracking
  [x] dark/light theme

CONFIG:
  contract addresses >> src/app/mod.json
  navigation tabs   >> src/app/providers.tsx
```

---

## DATA FLOW

```
                    +------------------+
                    |    USER          |
                    |    (browser)     |
                    +--------+---------+
                             |
                    +--------v---------+
                    |   NEXT.JS APP    |
                    |   (layer 5)      |
                    +--+------------+--+
                       |            |
              +--------v---+  +----v--------+
              | FASTAPI    |  | EVM CHAIN   |
              | (layer 4)  |  | (layer 2)   |
              +--------+---+  +-------------+
                       |
              +--------v---+
              | PYTHON MOD |
              | (layer 1)  |
              +--------+---+
                       |
              +--------v---+
              | ORBIT MODS |
              | (layer 3)  |
              +-----------+
```

---

## CONFIGURATION FILES

```
+--------------------------------------+-------------------------+
| FILE                                 | PURPOSE                 |
+--------------------------------------+-------------------------+
| ~/mod/mod.json                       | root framework config   |
| ~/mod/mod/core/chain/config.json     | chain & contract addrs  |
| ~/mod/mod/core/app/src/app/mod.json  | frontend contract cfg   |
+--------------------------------------+-------------------------+

ROOT CONFIG (mod.json):
{
  "name": "mod",
  "version": "0.1.0",
  "port_range": [8000, 9000],
  "shortcuts": { "m": "mod", "c": "mod" }
}
```

---

## TESTING

```
 > python framework
   $ cd ~/mod && pytest

 > smart contracts
   $ cd ~/mod/mod/core/chain
   $ npm test
   $ npx hardhat coverage

 > frontend
   $ cd ~/mod/mod/core/app
   $ npm run lint && npm run build

 > api server
   $ cd ~/mod/mod/core/api
   $ python -m pytest
```

---

## DOCKER DEPLOYMENT

```
 > full stack
   $ cd ~/mod && docker-compose up -d

   starts:
     - python api server
     - next.js frontend
     - postgresql database
     - ipfs node (optional)
     - blockchain node (optional)

 > individual components
   $ cd mod/core/chain && docker-compose up -d
   $ cd mod/core/app   && docker-compose up -d
   $ cd mod/core/api   && docker-compose up -d
```

---

## SECURITY CHECKLIST

```
.----------------------------------------------------.
| MEASURE                    | STATUS                 |
|----------------------------+------------------------|
| openzeppelin libs          | [ACTIVE]               |
| reentrancy guards          | [ACTIVE]               |
| signature authentication   | [ACTIVE]               |
| aes encryption             | [ACTIVE]               |
| role-based access          | [ACTIVE]               |
| client-side keygen         | [ACTIVE]               |
| https enforcement          | [ACTIVE] (production)  |
'----------------------------------------------------'
```

---

```
+-----------------------------------------------------------+
|                                                           |
|   END OF FILE                                             |
|                                                           |
|   "simplicity is the ultimate sophistication"             |
|                                        - da vinci         |
|                                                           |
+-----------------------------------------------------------+
```
