
from typing import Any, Dict
import mod as m
class Mod:
    description = """
    Base mod - Uniswap GraphQL scraper
    """
    def __init__(self):
        self.api = m.mod('api')()
        self.agent = m.mod('dev')()


    def forward(self, mod='app', query:str = 'make the readme better', *extra_query,  key=None,  fork=None, **kwargs) -> Dict[str, Any]:
        query = query + ' ' + ' '.join(extra_query)
        self.agent.forward( query=query, mod=mod, safety=False, fork=fork, **kwargs)
        return self.api.reg(mod=mod, key=key, comment=query)