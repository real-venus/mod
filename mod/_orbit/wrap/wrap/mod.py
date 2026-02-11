
import mod as m
class Mod:
    description = """
    Base mod - Uniswap GraphQL scraper
    """

    def forward(self, mod='openclaw') -> int:
        if self.is_schema_valid( mod):
            return m.schema(mod)
        readme =  m.readme()
        prompt = f"""The schema for this mod is not valid. 
        Please provide a valid schema. 
        The schema should be a list of functions with their signatures and descriptions. 
        The schema should be in the following format:

        create a class in a file named {mod}/mod.py with the following content:
        follow the readme to create the schema for this mod.
        {readme}
        """
        return m.edit(prompt, mod=mod)
    
    def is_schema_valid(self, mod='openclaw') -> bool:
        schema = m.schema(mod)
        return len(schema) > 0
