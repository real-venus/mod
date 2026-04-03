import mod as m
from typing import *


class Mod:
    description = """
    Server namespace — service discovery for registered servers.
    Wraps server.namespace to provide reg/dereg/lookup of server addresses.
    """

    def __init__(self, **kwargs):
        self.ns = m.mod('server.namespace')(**kwargs)

    def forward(self, search=None, **kwargs) -> Dict[str, str]:
        """Get the namespace of registered servers."""
        return self.ns.namespace(search=search, **kwargs)

    def reg(self, name: str, address: str) -> Dict[str, Any]:
        """Register a server with its address."""
        return self.ns.reg(name, address)

    def dereg(self, name: str) -> Dict[str, Any]:
        """Deregister a server by its name."""
        return self.ns.dereg(name)

    def exists(self, name: str) -> bool:
        """Check if a server is registered."""
        return self.ns.exists(name)

    def namespace(self, search: Optional[str] = None, **kwargs) -> Dict[str, str]:
        """Get the namespace of registered servers, optionally filtered."""
        return self.ns.namespace(search=search, **kwargs)

    def reset(self) -> Dict[str, Any]:
        """Reset the namespace by clearing all entries."""
        return self.ns.reset()
