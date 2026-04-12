import os
import mod as m

class Mod:
    description = """0xaf3e0796042af79ea1642c919ac0ea6d165bc6db"""
    path = r'/Users/broski/mod/mod/orbit/0xaf3e0796042af79ea1642c919ac0ea6d165bc6db'

    def forward(self, **kwargs):
        """Default entry point."""
        return self.info()

    def info(self):
        """Return module info."""
        return {
            'name': '0xaf3e0796042af79ea1642c919ac0ea6d165bc6db',
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
