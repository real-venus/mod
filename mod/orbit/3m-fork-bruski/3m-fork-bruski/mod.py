


class Mod:
    description = """
    3m-fork-bruski - Uniswap GraphQL scraper
    """

    def __init__(self):
        self.api = m.mod('api')()

    def forward(self, a=1, b=2) -> int:
        """Multiply two numbers and return the result."""
        return a + b
