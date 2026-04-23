import mod as m
import os

class App:
    
    def run_caddy(self, **kwargs):
        caddy = m.mod('caddy')()
        return caddy.serve(**kwargs)
    
    def build(self, mod='app', api_url=None, public_api_url=None, **kwargs):
        cwd = m.dirpath(mod)
        api_url = api_url or 'http://localhost:8000'
        public_api_url = public_api_url or api_url
        env = f'API_URL_INTERNAL="{api_url}" NEXT_PUBLIC_API_URL="{public_api_url}"'
        return os.system(f'cd {cwd} && {env} npm run build')

    def install(self, mod='app', **kwargs):
        cwd = m.dirpath(mod)
        return os.system(f'cd {cwd} && npm install')

    def serve(self,
            port=3000,
            mod = 'app',
            prod =False,
            build = False,
            api_port=8000,
            public_api_url=None,
             **kwargs):
        self.install(mod=mod)
        m.serve('api', pm='pm.pm2')
        # Start bridge as a dependency (uses core server)
        try:
            m.serve('bridge', pm='pm.pm2')
            # Register bridge in app namespace so middleware can route to it
            ns = m.mod('server.namespace')()
            bridge_cfg = m.config('bridge') or {}
            bridge_port = bridge_cfg.get('port', 8840)
            bridge_app_port = bridge_cfg.get('app_port', 8841)
            ns.reg_app('bridge', f'http://localhost:{bridge_app_port}', owner='', api_url=f'http://localhost:{bridge_port}')
        except Exception as e:
            print(f'[app] bridge dependency skipped: {e}')
        cwd = m.dirpath(mod)
        api_url = f'http://localhost:{api_port}'
        if prod:
            if build:
                result = self.build(mod=mod, api_url=api_url, public_api_url=public_api_url)
                if result != 0:
                    return f'Build failed with exit code {result}'
            cmd = f'npm run start -- -p {port}'
        else:
            cmd = f'npm run dev -- -p {port}'
        script_path = os.path.join(cwd, '_serve_app.sh')
        script = f'#!/bin/bash\ncd {cwd}\nexport API_URL_INTERNAL="{api_url}"\n'
        if public_api_url:
            script += f'export NEXT_PUBLIC_API_URL="{public_api_url}"\n'
        script += f'{cmd}\n'
        with open(script_path, 'w') as f:
            f.write(script)
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

    def prod(self, port=3000, mod='app', api_port=8000, api_url=None, domain='modc2.com', **kwargs):
        api_url = api_url or f'http://localhost:{api_port}'
        public_api_url = f'https://{domain}/api'
        result = self.build(mod=mod, api_url=api_url, public_api_url=public_api_url)
        if result != 0:
            return f'Build failed with exit code {result}'
        self.serve(port=port, mod=mod, prod=True, build=False, api_port=api_port, public_api_url=public_api_url, **kwargs)
        caddy = m.mod('caddy')()
        return caddy.serve(app_port=port, api_port=api_port)

    def edit(self, text='so i want you to have the transactions tab be you calling the history by calling the call function with fn=api/h and params={}', *extra_text, **kwargs):
        text += ' '.join(extra_text) 
        content =  str(m.fn('api/h')()[:2])
        text += content
        return m.edit('app', *text, **kwargs)


    def fix(self):
        # i want to know which files have cid as content ids
        return m.edit(m.logs('app') + '\n\n' + 'fix it given the logs')
