 
import mod as m

import unittest

Server = m.mod('server')
class ServerTestMixin( unittest.TestCase):
    def test_server(self, 
                        server = 'mod', 
                        key="server", 
                        trials=10, 
                        sleep_interval=2):
            m.fn('gate/add_user')(m.key(key).address)
            m.serve(server, key=key)
            print(f'testing server {server} with')
            info = {}
            for i in range(trials): 
                print(f'testing server {server}, trial {i+1}/{trials}...')
                try:
                    info = m.fn('client/call')(server+'/info')
                except Exception as e:
                    m.print(f'warning: failed to connect to server {server}, trial {i}/{trials}, error: {e}')
                    m.sleep(sleep_interval)
                    continue
                print(f'info: {info}')
                if 'key' in info: 
                    assert info['key'] == m.key(key).ss58_address, f"Server key {info['key']} does not match expected {m.key(key).ss58_address}"
                    return {'success': True, 'msg': 'server test passed'}
            m.fn('gate/rm_user')(m.key(key).address)
            raise Exception(f"Failed to connect to server {server} after {trials} trials, last info: {info}")

    def test_executor(self):
        return m.mod('executor')().test()

    def test_auth(self, auths=['auth.jwt', 'auth']):
        for auth in auths:
            print(f'testing {auth}')
            m.test(auth)
        return {'success': True, 'msg': 'server test passed', 'auths': auths}