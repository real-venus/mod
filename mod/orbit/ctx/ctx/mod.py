import mod as m

class Mod:
    description = """
    Context module - provides context information for modules
    """
    
    def forward(self, mod='api'):
        """Get context for a module including code and readme"""
        ctx = {
            'code': m.code(mod),
            'readme': self.readme(mod),
            'mod': mod
        }
        return ctx

    def readme(self, mod='mod'):
        """Get readme content for a module"""
        dp = m.dp(mod)
        for f in m.files(dp, depth=1):
            if f.split('/')[-1].lower().startswith('readme'):
                return m.get_text(f)
        return ""

    def add_readme(self, mod='base', content=''):
        """Add a readme file to a module"""
        dp = m.dp(mod)
        readme_path = dp + '/README.md'
        m.put_text(readme_path, content)
        return readme_path
