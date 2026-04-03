
class Mod:
    description = """
    Base2 - a simple example module demonstrating the standard mod pattern.
    Provides basic math utilities as a starting point for new modules.
    """

    def forward(self, x=0, y=0) -> dict:
        """Default entry point - returns a summary of operations on x and y."""
        return {
            "sum": x + y,
            "product": x * y,
            "difference": x - y,
        }

    def double(self, n=1):
        """Double a number."""
        return n * 2

    def greet(self, name="world"):
        """Return a greeting string."""
        return f"hello {name} from base2"
