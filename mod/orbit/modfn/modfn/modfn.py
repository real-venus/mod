
import mod as m
class Mod:
    description = """
    Base mod - Uniswap GraphQL scraper
    """

    def forward(self, query="api") -> int:
        api = m.mod('api')()
        mods = api.mods(schema=1)
        # filter out mods with schema 
        def filter_fn(x):
            return  len(x['schema'])>0 and isinstance(x['schema'], dict)
        mods = list(filter(filter_fn, mods))
        mod2fn = {mod['name']: mod['schema'] for mod in mods}
        return len(str(mod2fn))

