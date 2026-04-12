import os
import mod as m

class Mod:
    description = """I add x and y to give you z"""
    path = r'/Users/broski/mod/mod/orbit/churn'

    def forward(self, **kwargs):
        """Default entry point."""
        return self.info()

    def info(self):
        """Return module info."""
        return {
            'name': 'churn',
            'description': self.description,
            'path': self.path,
            'files': os.listdir(self.path),
        }

    def readme(self):
        """Return the project README."""
        for name in ['README.md', 'readme.md', 'README.rst', 'README']:
            p = os.path.join(self.path, name)
            if os.path.exists(p):
                return m.get_text(p)
        return None
