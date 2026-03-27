# base2

A simple example module demonstrating the standard mod pattern.

## Structure

```
base2/
├── base2/
│   └── mod.py    # Anchor file with Mod class
└── README.md
```

## Usage

```python
import mod as m

# Load and run
base2 = m.mod('base2')()
result = base2.forward(x=3, y=4)
# {'sum': 7, 'product': 12, 'difference': -1}

# Call specific methods
base2.double(n=5)   # 10
base2.greet(name="mod")  # "hello mod from base2"
```

```bash
# CLI
m base2 forward x=3 y=4
m base2 double n=5
m base2 greet name=mod
```
