
import mod as m

class Pm:
    mod = 'pm.docker'
    def __init__(self, *args, **kwargs ):
        _auth = m.mod(self.mod)( *args, **kwargs )
        for _k in dir(_auth):
            if _k.startswith('__') and _k.endswith('__'):
                continue
            setattr(self, _k, getattr(_auth, _k))
        self._auth = _auth
