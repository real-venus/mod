import requests
import mod as m
class BaseMod:
    description = """
    Base mod - Uniswap GraphQL scraper
    """
    def forward(self, mod='pm2'):
        return m.pytest(mod)