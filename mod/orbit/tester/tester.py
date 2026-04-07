    
import mod as m
import os
class Test:
    description = """
    i test stuff
    """
    _mods = [ 'server', 'store','key', 'ipfs', 'auth', 'executor']

    def _detect_in_path(self, path):
        """Detect test framework in a single directory path."""
        if not os.path.isdir(path):
            return None, path
        # Check for Cargo.toml -> cargo test
        if os.path.exists(os.path.join(path, 'Cargo.toml')):
            return 'cargo', path
        # Check for package.json -> npm test
        if os.path.exists(os.path.join(path, 'package.json')):
            return 'npm', path
        # Check for python test files (test/ or tests/ with test_*.py, pytest.ini, conftest.py)
        for test_dir in ['test', 'tests']:
            td = os.path.join(path, test_dir)
            if os.path.isdir(td):
                for f in os.listdir(td):
                    if f.startswith('test_') and f.endswith('.py'):
                        return 'pytest', path
                if os.path.exists(os.path.join(td, 'pytest.ini')) or os.path.exists(os.path.join(td, 'conftest.py')):
                    return 'pytest', path
        # Check for pytest.ini or conftest.py in root
        if os.path.exists(os.path.join(path, 'pytest.ini')) or os.path.exists(os.path.join(path, 'conftest.py')):
            return 'pytest', path
        return None, path

    def detect_test_framework(self, mod):
        """
        Detect the test framework for a module by checking for
        Cargo.toml (cargo test), package.json (npm test), or python test files (pytest).
        Checks both the module dirpath and the orbit path.
        Returns: ('cargo' | 'npm' | 'pytest' | None, resolved_path)
        """
        # Check primary path (m.dp)
        path = m.dp(mod)
        framework, resolved = self._detect_in_path(path)
        if framework:
            return framework, resolved
        # Check orbit path as fallback
        orbit_path = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), mod)
        if orbit_path != path:
            framework, resolved = self._detect_in_path(orbit_path)
            if framework:
                return framework, resolved
        return None, path

    def run_framework_test(self, mod, framework=None, path=None):
        """
        Run tests using the detected framework (cargo test, npm test, or pytest).
        """
        if framework is None or path is None:
            framework, path = self.detect_test_framework(mod)
        if framework is None:
            print(f'No test framework detected for {mod}, falling back to mod test fns')
            return None
        print(f'Detected test framework: {framework} for {mod} ({path})')
        if framework == 'cargo':
            cmd = f'cd {path} && cargo test'
        elif framework == 'npm':
            cmd = f'cd {path} && npm test'
        elif framework == 'pytest':
            test_dir = path
            for td in ['test', 'tests']:
                candidate = os.path.join(path, td)
                if os.path.isdir(candidate):
                    test_dir = candidate
                    break
            cmd = f'pytest {test_dir} --maxfail=1 --disable-warnings -q'
        else:
            print(f'Unknown framework: {framework}')
            return None
        return self.cmd(cmd)

    def forward(self, mod=None, timeout=50):
        """
        Test the mod. Auto-detects test framework (pytest, cargo test, npm test).
        """
        if mod == None:
            test_results ={}
            print(f'Testing modules: {self._mods}')
            for mod in self._mods:
                print(f'Testing mod: {mod}')
                test_results[mod] = self.forward(mod=mod, timeout=timeout)
            return test_results
        else:
            # Try framework auto-detection first
            framework, path = self.detect_test_framework(mod)
            if framework:
                return self.run_framework_test(mod, framework=framework, path=path)
            # Fallback to mod test fns
            fn2result = {}
            fns = self.test_fns(mod)
            for fn in fns:
                fn_name = fn.__name__
                try:
                    fn2result[fn_name] = fn()
                    print(f'TestResult({fn_name}): {fn2result[fn_name]}')
                except Exception as e:
                    m.print(f'TestError({e})')
                    fn2result[fn_name] = m.detailed_error(e)
            return fn2result

    test = forward

    def has_test_module(self, mod, verbose=False):
        """
        Check if the mod has a test mod
        """
        return m.mod_exists(mod + '.test')

    def has_test_fns(self, mod):
        return bool('test' in m.fns(mod))
    def test_module(self, mod='mod', timeout=50):
        """
        Test the mod
        """
        for fn in self.test_fns(test):
            print(f'Testing({fn})')
            future = self.submit(getattr(test, fn), timeout=timeout)
            futures += [future]
        results = []
        for future in self.as_completed(futures, timeout=timeout):
            print(future.result())
            results += [future.result()]
        return results

    testmod = test_module

    def test_fns(self, mod='mod'):
        if self.has_test_module(mod):
            mod = mod + '.test'
        obj = m.mod(mod)()
        test_fns = []
        for fn in dir(obj):
            if fn.startswith('test_') or fn == 'test':
                fn_obj = getattr(obj, fn)
                test_fns.append(fn_obj)
        return test_fns


    def has_test(self, mod=None, verbose=False):
        """
        Check if the mod has a test mod or test functions
        """
        try:
            return self.has_test_module(mod) or self.has_test_fns(mod)
        except Exception as e:
            if verbose:
                m.print(f'Error checking tests for {mod}: {e}')
        return False


    def test_mods(self, search=None, verbose=False, **kwargs):
        test_mods = []
        _mods =  m._mods(search=search, **kwargs)
        for mod in _mods:
            if verbose:
                m.print(f'Checking mod: {mod}')
            if self.has_test(mod, verbose=verbose):
                test_mods.append(mod)
        return test_mods


    def cmd(self, cmd, stdout=None, stderr=None):
        """
        Run a command in the shell
        """
        
        
        text = ''
        for ch in os.popen(cmd).readlines():
            print(ch, end='')
            text += ch
        return text

    def pytest(self, mod='pypm'):
        """
        Run pytest on the mod
        """
        path = m.dp(mod)
        stdout = None
        stderr = None
        cmd = f'pytest {path} --maxfail=1 --disable-warnings -q'
        return self.cmd(cmd)

        


        