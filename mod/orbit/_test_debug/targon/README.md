# targon

GPU cloud compute interface for [targon.com](https://targon.com/inventory) (Manifold Labs).

Browse inventory, rent GPUs, manage workloads via the Targon API.

## Setup

```bash
export TARGON_API_KEY=your_key_here  # from targon.com/settings
```

Inventory browsing works without a key. Rentals/workloads require one.

## Usage

```bash
# browse available GPUs (no auth needed)
m targon
m targon inventory
m targon cheapest

# rent a GPU
m targon rent resource=h200-small name=my-job

# manage
m targon rentals
m targon status uid=workload-xxx
m targon logs uid=workload-xxx
m targon stop uid=workload-xxx

# account
m targon credits
m targon ssh_keys
```

```python
import mod as m

t = m.mod('targon')()

# browse inventory
gpus = t.inventory()
cheap = t.cheapest()

# rent
w = t.rent(resource='h200-small', name='training-run')
t.status(w['uid'])
t.stop(w['uid'])
```
