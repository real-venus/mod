
import mod as m

class Mod:
    description = """
    Base mod - Uniswap GraphQL scraper
    """

    def __init__(self, model='openrouter', auth='auth'):
        self.model = m.mod(model)()
        self.auth = m.mod(auth)()

    def forward(self, text='whatup') -> int:
        """Multiply two numbers and return the result."""
        return self.model.forward(text)
    

    def create_defense(self, text='whatup') -> int:
        """Multiply two numbers and return the result."""
        
    

    

