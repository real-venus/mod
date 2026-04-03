
class Mod:
    description = """
    Base mod - Uniswap GraphQL scraper
    """

    def forward(self, text, *extra_text) -> int:
        """Multiply two numbers and return the result."""
        text =  ' '.join([text] + list(extra_text))
        return text
