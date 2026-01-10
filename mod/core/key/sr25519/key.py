from ..key import Key

class Sr25519Key(Key):
    """
    Sr25519 specific key implementation
    """
    crypto_type = 'sr25519'
    
    def __init__(self, *args, **kwargs):
        kwargs['crypto_type'] = self.crypto_type
        super().__init__(*args, **kwargs)
