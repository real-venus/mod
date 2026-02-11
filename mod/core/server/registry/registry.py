import mod as m
from typing import *

class Registry:

    def __init__(self, path='~/.mod/server/registry'):
        self.store = m.mod('store')(path)
        self.registry_path = 'registry.json'
    def reg(self, name: str, address:str) -> Dict[str, Any]:
        """
        Register a server with its address.
        """
        registry = self.store.get(self.registry_path, {})
        registry[name] = address
        self.store.put(self.registry_path, registry)
        return {'status': 'success', 'name': name, 'address': address}
    
    def dereg(self, name: str) -> Dict[str, Any]:
        """
        Deregister a server by its name.
        """
        registry = self.store.get(self.registry_path, {})
        if name in registry:
            del registry[name]
            self.store.put(self.registry_path, registry)
            return {'status': 'success', 'name': name}
        else:
            return {'status': 'error', 'name': name, 'error': 'not found'}

    def exists(self, name: str ) -> bool:
        """
        Check if a server is registered.
        """
        registry = self.store.get(self.registry_path, {})
        return name in registry
    
    def namespace(self, search: Optional[str] = None, **kwargs) -> Dict[str, str]:
        """
        Get the namespace of registered servers, optionally filtered by a search string.
        """
        registry = self.store.get(self.registry_path, {})
        if search:
            return {name: addr for name, addr in registry.items() if search in name}
        return registry
    

    def reset(self) -> Dict[str, Any]:
        """
        Reset the registry by clearing all entries.
        """
        self.store.put(self.registry_path, {})
        return {'status': 'success', 'message': 'registry reset'}


    def test(self):
        self.reg('test_server', 'http://localhost:8000')
        assert self.exists('test_server')
        self.dereg('test_server')
        assert not self.exists('test_server')
        return {'status': 'all tests passed'}