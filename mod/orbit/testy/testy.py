
import mod as m
import os
import concurrent.futures
import time

class Testy:
    description = "parallel test runner - auto-detects pytest, cargo test, npm test"

    # core modules to test by default
    core_mods = ['cli', 'config', 'key', 'registry', 'server', 'store', 'tree', 'tx']

    def forward(self, *mods, workers=4, timeout=300):
        """
        Run tests for given modules in parallel.
        Usage: c testy mod1 mod2 mod3
               c testy              (runs all core modules)
        """
        mods = list(mods) if mods else self.core_mods
        return self.run(mods, workers=workers, timeout=timeout)

    test = forward

    def run(self, mods, workers=4, timeout=300):
        """Run tests for a list of modules in parallel."""
        tester = m.mod('tester')()
        results = {}
        start = time.time()

        print(f'Running tests for {len(mods)} modules with {workers} workers')
        print(f'Modules: {", ".join(mods)}')
        print('=' * 60)

        with concurrent.futures.ThreadPoolExecutor(max_workers=workers) as pool:
            future_to_mod = {}
            for mod_name in mods:
                fw, path = tester.detect_test_framework(mod_name)
                future = pool.submit(self._run_one, mod_name, fw, path, tester, timeout)
                future_to_mod[future] = mod_name

            for future in concurrent.futures.as_completed(future_to_mod):
                mod_name = future_to_mod[future]
                try:
                    result = future.result(timeout=timeout)
                    results[mod_name] = result
                except Exception as e:
                    results[mod_name] = {'status': 'error', 'error': str(e)}

        elapsed = round(time.time() - start, 2)
        self._print_summary(results, elapsed)
        return results

    def _run_one(self, mod_name, framework, path, tester, timeout):
        """Run tests for a single module, return result dict."""
        t0 = time.time()
        if framework is None:
            return {
                'status': 'skip',
                'framework': None,
                'output': f'No test framework detected for {mod_name}',
                'time': 0,
            }

        cmd = self._build_cmd(framework, path)
        try:
            output = tester.cmd(cmd)
            elapsed = round(time.time() - t0, 2)
            failed = self._check_failure(framework, output)
            return {
                'status': 'fail' if failed else 'pass',
                'framework': framework,
                'output': output,
                'time': elapsed,
            }
        except Exception as e:
            elapsed = round(time.time() - t0, 2)
            return {
                'status': 'error',
                'framework': framework,
                'error': str(e),
                'time': elapsed,
            }

    def _build_cmd(self, framework, path):
        """Build the shell command for the given framework."""
        if framework == 'cargo':
            return f'cd {path} && cargo test 2>&1'
        elif framework == 'npm':
            return f'cd {path} && npm test 2>&1'
        elif framework == 'pytest':
            test_dir = path
            for td in ['test', 'tests']:
                candidate = os.path.join(path, td)
                if os.path.isdir(candidate):
                    test_dir = candidate
                    break
            return f'pytest {test_dir} --maxfail=3 --disable-warnings -q 2>&1'
        return f'echo "unknown framework: {framework}"'

    def _check_failure(self, framework, output):
        """Check if test output indicates failure."""
        if not output:
            return True
        output_lower = output.lower()
        if framework == 'pytest':
            return 'failed' in output_lower or 'error' in output_lower
        elif framework == 'cargo':
            return 'test result: failed' in output_lower
        elif framework == 'npm':
            return 'err!' in output_lower or 'failed' in output_lower
        return False

    def _print_summary(self, results, elapsed):
        """Print a summary table of test results."""
        print('\n' + '=' * 60)
        print(f'TEST RESULTS ({elapsed}s)')
        print('=' * 60)
        passed = failed = skipped = errored = 0
        for mod_name, r in sorted(results.items()):
            status = r.get('status', '?')
            fw = r.get('framework', '-')
            t = r.get('time', 0)
            icon = {'pass': 'PASS', 'fail': 'FAIL', 'skip': 'SKIP', 'error': 'ERR '}
            tag = icon.get(status, '????')
            print(f'  [{tag}] {mod_name:<20} {str(fw):<8} {t}s')
            if status == 'pass':
                passed += 1
            elif status == 'fail':
                failed += 1
            elif status == 'skip':
                skipped += 1
            else:
                errored += 1
        print('-' * 60)
        print(f'  {passed} passed, {failed} failed, {errored} errors, {skipped} skipped')
        print('=' * 60)

    def detect(self, *mods):
        """Show detected test frameworks for modules without running them."""
        mods = list(mods) if mods else self.core_mods
        tester = m.mod('tester')()
        print(f'{"Module":<20} {"Framework":<10} {"Path"}')
        print('-' * 70)
        for mod_name in mods:
            fw, path = tester.detect_test_framework(mod_name)
            print(f'{mod_name:<20} {str(fw):<10} {path}')

    def all(self, workers=4, timeout=300):
        """Run tests for ALL modules that have tests (core + orbit)."""
        tester = m.mod('tester')()
        all_mods = []
        # core
        core_path = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), '..', 'core')
        core_path = os.path.normpath(core_path)
        if os.path.isdir(core_path):
            for d in sorted(os.listdir(core_path)):
                full = os.path.join(core_path, d)
                if os.path.isdir(full):
                    fw, _ = tester.detect_test_framework(d)
                    if fw:
                        all_mods.append(d)
        # orbit
        orbit_path = os.path.dirname(os.path.abspath(__file__))
        orbit_path = os.path.dirname(orbit_path)
        if os.path.isdir(orbit_path):
            for d in sorted(os.listdir(orbit_path)):
                if d in all_mods or d in ['testy', 'tester']:
                    continue
                full = os.path.join(orbit_path, d)
                if os.path.isdir(full):
                    fw, _ = tester.detect_test_framework(d)
                    if fw:
                        all_mods.append(d)
        print(f'Found {len(all_mods)} testable modules')
        return self.run(all_mods, workers=workers, timeout=timeout)
