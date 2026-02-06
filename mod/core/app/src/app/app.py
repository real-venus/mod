from unittest import result
import mod as m
import os

class App:
    
    def serve(self, 
            port=3000, 
            mod = 'app', 
            prod =False, 
            build = False,
            api_port=8000, 
             **kwargs):
        if not m.server_exists('api'):
            m.serve('ipfs')
            m.serve('api')
        if build:
            m.build(mod)
        cwd = m.dirpath(mod) 
        working_dir = '/app'
        return m.fn('pm/run')(
                    name=mod, 
                    volumes=[f'{cwd}:/app','/app/node_modules', '~/.mod:/root/.mod', '~/mod:/root/mod', '/app/.next'], 
                    cwd=cwd, 
                    image=f'{mod}:latest',
                    working_dir=working_dir,
                    port=port, 
                    cmd='npm run dev',
                    env={'NEXT_PUBLIC_API_URL':  'https://api.modc2.com' if prod else f'http://localhost:{api_port}'}, 
                    **kwargs
                    )

    def edit(self, text='so i want you to have the transactions tab be you calling the history by calling the call function with fn=api/h and params={}', *extra_text, **kwargs):
        text += ' '.join(extra_text) 
        content =  str(m.fn('api/h')()[:2])
        text += content
        return m.edit('app', *text, **kwargs)


    def build(self, cmd='npm run build', agent='dev', steps=5, mod='app'):
        import subprocess
        path = m.dp(mod)
        cmd = f'cd {path} && {cmd}'
       

        for _ in range(steps):
            _agent = m.mod(agent)()
            process = subprocess.Popen(
                cmd,
                shell=True,
                stdout=subprocess.PIPE,
                stderr=subprocess.STDOUT,
                text=True
            )
            output = ''
            for line in process.stdout:
                print(line, end='')  # Print the line as it is received
                output += line  # Append the line to the output variable
            output_text = f'output: {output}'
            print('fixing with output:', output_text)
            query ='fix the build' + f' output: {output}'
            _agent.forward(query=query, path=path)

        return output
