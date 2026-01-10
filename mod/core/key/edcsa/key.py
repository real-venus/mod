from ..key import Key

class EcdsaKey(Key):
    """
    ECDSA specific key implementation
    """
    crypto_type = 'ecdsa'
    
    def __init__(self, *args, **kwargs):
        kwargs['crypto_type'] = self.crypto_type
        super().__init__(*args, **kwargs)
