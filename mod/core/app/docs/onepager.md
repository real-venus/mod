```
+-----------------------------------------------------------+
|                                                           |
|   M O D   P R O T O C O L                                |
|                                                           |
|   ONE PAGER                                               |
|   >> npm meets blockchain meets ai agents                 |
|                                                           |
+-----------------------------------------------------------+
```

---

## WHAT IS MOD

A decentralized framework where developers publish code
modules and get paid every time someone uses them.
200+ modules. On-chain revenue. AI-native.

---

## THE PROBLEM

```
today's software ecosystem:

  [x] devs build open source, earn nothing
  [x] data lives on someone else's computer
  [x] can't verify what code is actually running
  [x] ai models trapped in walled gardens
  [x] apps break when companies shut down
```

## THE FIX

```
mod protocol:

  1. PUBLISH CODE  --> drop a python module, auto-discovered
  2. SET A PRICE   --> charge per execution ($0.01/call)
  3. GET PAID      --> 95% of fees go to you, instantly
  4. VERIFY ALL    --> everything on-chain, cryptographically signed
  5. AI AGENTS     --> autonomous modules that compose themselves
```

---

## HOW IT WORKS

```
  step 1: dev drops "image_resizer" module in orbit/
  step 2: framework auto-discovers it (zero config)
  step 3: user calls resize_image(photo.jpg, w=800)
  step 4: user pays $0.01 via on-chain debit
  step 5: dev gets $0.0095, treasury gets $0.0005
  step 6: treasury distributed to BlocTime stakers
```

---

## THE STACK

```
+--------------------+--------------------------------------+
| LAYER              | TECHNOLOGY                           |
+--------------------+--------------------------------------+
| frontend           | next.js 14, typescript, ethers.js v6 |
| api                | fastapi, async, auto-routing         |
| modules            | 200+ python orbit modules            |
| contracts          | solidity 0.8.20, base (evm)          |
| core               | mod.py engine, crypto, storage       |
+--------------------+--------------------------------------+
```

---

## MOD vs TRADITIONAL

```
+--------------------+--------------------+
| TRADITIONAL        | MOD PROTOCOL       |
+--------------------+--------------------+
| aws charges you    | you charge users   |
| code can disappear | stored on ipfs     |
| trust amazon       | verify on-chain    |
| complex billing    | auto micropayments |
| vendor lock-in     | composable modules |
| ai in silos        | ai-native agents   |
+--------------------+--------------------+
```

---

## KEY FEATURES

```
[x] 200+ modules           -- ai, defi, storage, dev tools
[x] on-chain revenue        -- BlocTime staking + treasury
[x] ai-native agents        -- autonomous module composition
[x] crypto payments          -- base (evm), substrate, solana
[x] verifiable execution     -- every tx signed
[x] zero-config modules      -- drop and go
[x] irreversible decentral.  -- setOwnerless() one-way lock
```

---

## FOR DEVELOPERS

```
monetize your code in 3 steps:

  1. mkdir mod/orbit/mymod/mymod
  2. write mod.py with a Mod class
  3. done. earn money when people use it.

  m serve mymod       # auto-generates API
  m info mymod        # view module details
```

## FOR USERS

```
use any module in 1 line:

  result = m.fn('image_resizer/resize')(width=800)
```

## FOR STAKERS

```
stake NativeToken --> earn BlocTime
lock longer --> higher multiplier (up to 3x)
claim treasury revenue proportionally
no inflation. real fees only.
```

---

## ECONOMICS

```
REVENUE SPLIT:
  |-- 95% --> module provider
  '-- 5%  --> protocol treasury
              |
              '--> BlocTime stakers (time-weighted)

STAKING MULTIPLIER:
  0 blocks       --> 1.0x
  10,000 blocks  --> 1.5x
  50,000 blocks  --> 2.0x
  100,000 blocks --> 3.0x
```

---

## SECURITY

```
[x] reentrancy guards       -- all contracts
[x] eip-712 signatures      -- structured data signing
[x] aes-256 encryption      -- data at rest
[x] anti-flash-loan          -- BlocTime requires lock period
[x] gnosis safe multisig     -- multi-party governance
[x] openzeppelin contracts   -- battle-tested libraries
```

---

## ROADMAP

```
  NOW:         200+ modules, base sepolia, ai agents
  NEXT:        base mainnet, marketplace UI, revenue dashboard
  THEN:        dao governance, cross-chain sync, semver
  FUTURE:      enterprise, global scale, full ownerless mode
```

---

## TLDR

```
+-----------------------------------------------------------+
|                                                           |
|   MOD = DECENTRALIZED MODULE MARKETPLACE + AI AGENTS      |
|                                                           |
|   devs publish code --> get paid per use                  |
|   stakers lock tokens --> earn real revenue               |
|   agents compose modules --> build autonomously           |
|   everything on-chain, verifiable, composable             |
|   no middlemen. no inflation. no bs.                      |
|                                                           |
|   200+ modules. base mainnet ready. ownerless path.       |
|                                                           |
+-----------------------------------------------------------+
```

---

```
+-----------------------------------------------------------+
|                                                           |
|   code is capital.                                        |
|   build. deploy. earn.                                    |
|                                                           |
+-----------------------------------------------------------+
```
