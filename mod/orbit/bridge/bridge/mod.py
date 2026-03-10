import mod as m
import os

class Bridge:

    def __init__(self, chain = 'chain',auth='auth'):
        self.chain = m.mod(chain)()
        self.crypto_type = 'sr25519'
        self.auth = m.mod(auth)(crypto_type=self.crypto_type)
        self.store = m.mod('store')('~/.mod/bridge')
        self.total_balances = self.get_total_balances()
        self.claimed_balances = self.get_claims()


    @property
    def total_balances_path(self):
        return os.path.join(os.path.dirname((os.path.abspath(__file__))), 'total_balances.json')

    def get_total_balances(self):
        path = self.total_balances_path
        if not os.path.exists(path):
            m.save_json({}, path)
        return m.get_json(path, default={})

    def mint(self, address, amount):
        return self.chain.mint(address, amount, token='BridgeToken')

    def save_claims(self):
        return self.store.put('claimed_balances.json', self.claimed_balances)
    
    def get_claims(self):
        return self.store.get('claimed_balances.json', default={})
    
    def claim(self, token):
        # Logic to claim the token
        verified = self.auth.verify(token)
        address = verified['key']
        amount = self.total_balances.get(address, 0)
        assert self.claimed_balances.get(address, 0) == 0, "Tokens already claimed for this address"
        if amount > 0:
            # Logic to transfer the token to the user's address
            self.claimed_balances[address] = amount
            self.save_claims()
            return f"Claimed {amount} tokens for address {address}"
        return f"No tokens to claim for address {address}"
    
    def test(self):
        # key = m.key('test', crypto_type=self.crypto_type)
        # print(f"Generated key for testing: {key}")
        token = self.auth.token('claim my tokens')
        self.claim(token)
        return "Test claim executed"
        
    def unclaimed(self, address):
        # Logic to get the unclaimed balance for the token
        claimed = self.claimed_balances.get(address, 0)
        total = self.total_balances.get(address, 0)
        return total - claimed