import mod as m

class Worker:

    def __init__(self, path='./'):
        self.path = path

    def forward(self, fn='store/ls', params=None, agent='dev', **kwargs):
        """
        Forward the request to the agent mod
        """
        if not fn.endswith('/') and '/' not in fn:
            fn = fn + '/'
        params = {**(params or {}), **kwargs}
        try:
            result = m.fn(fn)(**params)
        except Exception as e:
            result = self.format_exception(e)
        return result
            



    def format_exception(self, e):
        """
        Format the exception to a string
        """
        return str(e)
