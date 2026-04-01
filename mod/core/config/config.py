"""
Config — drop-in Munch replacement with clean repr.

    >>> c = Config(mod='/Users/broski/mod/mod', lib='/Users/broski/mod',
    ...           orbit=dict(inner='/mod/orbit', outer='/mod/orbit/_outer'))
    >>> print(c)
    mod   : /Users/broski/mod/mod
    lib   : /Users/broski/mod
    orbit
      inner : /mod/orbit
      outer : /mod/orbit/_outer
"""


class Config(dict):
    """Dict subclass with attribute access and a clean tree repr."""

    def __getattr__(self, key):
        try:
            return self[key]
        except KeyError:
            raise AttributeError(key)

    def __setattr__(self, key, value):
        self[key] = value

    def __delattr__(self, key):
        try:
            del self[key]
        except KeyError:
            raise AttributeError(key)

    # ── pretty repr ──────────────────────────────────────────────────

    def _fmt(self, indent=0):
        pad = '  ' * indent
        lines = []
        # separate nested vs leaf for grouping
        leaves = [(k, v) for k, v in self.items() if not isinstance(v, dict)]
        nested = [(k, v) for k, v in self.items() if isinstance(v, dict)]
        # align leaf values
        if leaves:
            w = max(len(str(k)) for k, _ in leaves)
            for k, v in leaves:
                lines.append(f'{pad}{str(k).ljust(w)} : {v}')
        for k, v in nested:
            lines.append(f'{pad}{k}')
            if isinstance(v, Config):
                lines.append(v._fmt(indent + 1))
            else:
                # plain dict – wrap it
                lines.append(Config.from_dict(v)._fmt(indent + 1))
        return '\n'.join(lines)

    def __repr__(self):
        return self._fmt()

    def __str__(self):
        return self._fmt()

    # ── construction helpers ─────────────────────────────────────────

    @classmethod
    def from_dict(cls, d):
        """Recursively convert a dict (and nested dicts) into Config."""
        if isinstance(d, dict):
            return cls({k: cls.from_dict(v) for k, v in d.items()})
        if isinstance(d, list):
            return [cls.from_dict(i) for i in d]
        return d

    def to_dict(self):
        """Recursively convert back to plain dicts."""
        out = {}
        for k, v in self.items():
            if isinstance(v, Config):
                out[k] = v.to_dict()
            elif isinstance(v, list):
                out[k] = [i.to_dict() if isinstance(i, Config) else i for i in v]
            else:
                out[k] = v
        return out

    def copy(self):
        return Config.from_dict(dict.copy(self))

    def update(self, *args, **kwargs):
        other = dict(*args, **kwargs)
        for k, v in other.items():
            if isinstance(v, dict):
                v = Config.from_dict(v)
            self[k] = v
        return self
