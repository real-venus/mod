import mod as m
import os

class App:
    
    def run_caddy(self):
        caddyfile_path = os.path.join(m.dirpath('app'), 'Caddyfile')
        return os.system(f'caddy run --config {caddyfile_path}')
    
    def build(self, mod='app', api_url=None, **kwargs):
        cwd = m.dirpath(mod)
        api_url = api_url or 'https://api.modc2.com'
        env = f'NEXT_PUBLIC_API_URL="{api_url}"'
        return os.system(f'cd {cwd} && {env} npm run build')

    def serve(self,
            port=3000,
            mod = 'app',
            prod =False,
            build = False,
            api_port=8000,
             **kwargs):
        m.serve('api', pm='pm.pm2')
        cwd = m.dirpath(mod)
        api_url = 'https://api.modc2.com' if prod else f'http://localhost:{api_port}'
        if prod:
            if build:
                result = self.build(mod=mod, api_url=api_url)
                if result != 0:
                    return f'Build failed with exit code {result}'
            cmd = f'npm run start -- -p {port}'
        else:
            cmd = f'npm run dev -- -p {port}'
        script_path = os.path.join(cwd, '_serve_app.sh')
        with open(script_path, 'w') as f:
            f.write(f'#!/bin/bash\ncd {cwd}\nexport NEXT_PUBLIC_API_URL="{api_url}"\n{cmd}\n')
        os.chmod(script_path, 0o755)
        pm2 = m.mod('pm.pm2')()
        if pm2.exists(mod):
            pm2.kill(mod, remove_script=False)
        return pm2.start_script(
                    name=mod,
                    script_path=script_path,
                    cwd=cwd,
                    interpreter='bash'
                    )

    def prod(self, port=3000, mod='app', api_port=8000, api_url=None, **kwargs):
        api_url = api_url or 'https://api.modc2.com'
        result = self.build(mod=mod, api_url=api_url)
        if result != 0:
            return f'Build failed with exit code {result}'
        return self.serve(port=port, mod=mod, prod=True, build=False, api_port=api_port, **kwargs)

    def edit(self, text='so i want you to have the transactions tab be you calling the history by calling the call function with fn=api/h and params={}', *extra_text, **kwargs):
        text += ' '.join(extra_text) 
        content =  str(m.fn('api/h')()[:2])
        text += content
        return m.edit('app', *text, **kwargs)


    def fix(self):
        # i want to know which files have cid as content ids
        return m.edit(m.logs('app') + '\n\n' + 'fix it given the logs')
