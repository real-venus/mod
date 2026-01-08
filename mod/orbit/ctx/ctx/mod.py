
import mod as m
class Mod:
    description = """
    Base mod template
    """
    
    def forward(self,mod = 'api'): 
        ctx = {
            'code': m.code(mod),
            'readme': self.readme(mod),
            'mod': mod
        }
        return m.fn('')ctx

    def readme(self, mod = 'mod'):
        dp = m.dp(mod)
        for f in m.files(dp, depth=1):
            print(f)
            if f.split('/')[-1].lower().startswith('readme'):
                return m.get_text(f)
        return ""



    def add_readme(self, mod = 'bae', content = ''):
        dp = m.dp(mod)
        readme_path = dp + '/README.md'
        m.put_text(readme_path, content)
        return readme_path