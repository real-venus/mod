# Quests

A decentralized quest/bounty system where people can create quests with rewards and others can respond to earn those rewards.

## How It Works

### Flow

1. **Create Quest** - An initiator posts a quest with a title, description, and reward amount
2. **Respond** - Anyone can submit a response with their deliverable/proof of work
3. **Review** - The quest creator reviews all responses
4. **Approve** - Creator approves the best response → reward is paid to the responder
5. **Treasury Fee** - 5% fee is taken by the treasury, responder gets 95%

### Quest Lifecycle

```
open → completed (when a response is approved)
     → cancelled (when creator cancels)
```

### Response Lifecycle

```
pending → approved (creator approves, reward paid)
        → rejected (creator rejects)
```

## API

### Creating Quests

```python
import mod as m

quests = m.mod('quests')()

# Create a quest
quest = quests.create_quest(
    title="Build a landing page",
    description="Need a responsive landing page with hero section, features, and CTA",
    reward=100.0,  # 100 stable tokens
    token=my_auth_token,
    tags=["frontend", "design"],
    deadline=1735689600  # optional unix timestamp
)
```

### Browsing Quests

```python
# List all open quests
open_quests = quests.quests(status='open')

# Get a specific quest
quest = quests.get_quest(quest_id='abc123')

# Get my created quests
my = quests.my_quests(token=my_token)
```

### Responding to Quests

```python
# Submit a response
response = quests.respond(
    quest_id='abc123',
    content='Here is my completed landing page: https://example.com/preview',
    token=my_auth_token,
    attachments=['ipfs://Qm...']  # optional
)
```

### Approving Responses (Quest Creator Only)

```python
# View all responses
responses = quests.get_responses(quest_id='abc123')

# Approve the best one - triggers reward payment!
result = quests.approve(
    quest_id='abc123',
    response_id='resp456',
    token=creator_auth_token
)
# result includes payment_hash, reward breakdown, etc.
```

### Rejecting Responses

```python
quests.reject(
    quest_id='abc123',
    response_id='resp789',
    reason='Does not meet requirements',
    token=creator_auth_token
)
```

### Cancelling Quests

```python
quests.cancel_quest(quest_id='abc123', token=creator_auth_token)
```

### Stats

```python
stats = quests.stats()
# {
#   'total_quests': 42,
#   'open': 15,
#   'completed': 20,
#   'cancelled': 7,
#   'total_reward_posted': 5000.0,
#   'total_reward_paid': 3200.0,
#   'total_responses': 89
# }
```

## Payment Integration

Rewards are paid through the **Market** smart contract:
- Creator's balance is debited
- 5% goes to treasury
- 95% goes to the approved responder
- All payments are tracked on-chain with transaction hashes

## Security

- All actions require authentication via auth tokens
- Only quest creators can approve/reject responses
- Cannot respond to your own quest
- One response per user per quest
- Deadline enforcement
- Payment verification through on-chain transactions
