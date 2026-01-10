from ..key import Key

class Ed25519Key(Key):
    """
    Ed25519 specific key implementation
    """
    crypto_type = 'ed25519'
    
    def __init__(self, *args, **kwargs):
        kwargs['crypto_type'] = self.crypto_type
        super().__init__(*args, **kwargs)
