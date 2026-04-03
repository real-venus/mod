"""Abstract registry backend interface."""


class RegistryBackend:
    """Base class for all registry backends (EVM, Solana, off-chain)."""

    name = 'base'

    def register(self, name: str, data: str, owner: str = None, **kw) -> str:
        """Register a new mod. Returns mod ID."""
        raise NotImplementedError

    def update(self, mod_id: str, data: str, owner: str = None, **kw) -> bool:
        """Update mod data. Returns success."""
        raise NotImplementedError

    def remove(self, mod_id: str, owner: str = None, **kw) -> bool:
        """Remove a mod. Returns success."""
        raise NotImplementedError

    def get(self, mod_id: str, **kw) -> dict:
        """Get mod by ID. Returns {id, owner, name, data} or None."""
        raise NotImplementedError

    def get_user_mods(self, owner: str, **kw) -> list:
        """Get all mods for an owner. Returns list of mod dicts."""
        raise NotImplementedError

    def is_name_taken(self, owner: str, name: str, **kw) -> bool:
        """Check if name is taken for a given owner."""
        raise NotImplementedError

    def transfer(self, mod_id: str, new_owner: str, owner: str = None, **kw) -> bool:
        """Transfer mod ownership. Returns success."""
        raise NotImplementedError

    def list_all(self, **kw) -> list:
        """List all mods in the registry."""
        raise NotImplementedError
