
import os
import json
import time
from pathlib import Path
from typing import Dict, List, Any, Optional
import mod as m
print = m.print


class Mod:
    description = """
    Agent-powered security scanner for repositories.
    Uses an AI agent to audit code for vulnerabilities, secrets, and misconfigurations.
    Writes reports to .security/{reviewer_wallet}/ in the scanned repo.
    """

    goal = """
        You are a senior security auditor performing a comprehensive code review.
        Systematically scan the repository for security vulnerabilities.

        CHECK FOR:
        - Hardcoded secrets, API keys, private keys, passwords, tokens
        - Command injection, SQL injection, XSS, path traversal
        - Unsafe deserialization, insecure file operations
        - Smart contract vulnerabilities (reentrancy, overflow, access control)
        - Insecure configurations (CORS, debug mode, permissive permissions)
        - Missing authentication or authorization checks
        - Exposed sensitive endpoints or debug routes
        - Dependency vulnerabilities (known CVEs in imports)
        - Unsafe use of eval, exec, subprocess with user input
        - Information leakage (stack traces, verbose errors, .env files)

        METHODOLOGY:
        1. First use glob to understand the repo structure and file types
        2. Use grep to search for patterns: passwords, secrets, keys, tokens, eval, exec, subprocess
        3. Read critical files: configs, env files, auth modules, API routes, contracts
        4. Analyze each finding for actual exploitability (not just pattern matches)

        OUTPUT:
        When finished, use the finish tool. In params, include a "findings" list.
        Each finding must be a dict with:
        - severity: "critical" | "high" | "medium" | "low" | "info"
        - category: "secrets" | "injection" | "xss" | "access_control" | "config" | "contract" | "dependency" | "crypto" | "info_leak" | "other"
        - title: short description
        - description: detailed explanation with exploitation scenario
        - file: relative file path
        - line: line number (if applicable, else null)
        - recommendation: how to fix
    """

    skills = ['read', 'grep', 'glob', 'bash', 'think']

    def __init__(self, key='test', provider='openrouter', model=None, **kwargs):
        self._agent = None
        self.key_name = key
        self.provider = provider
        self.model = model  # None = use provider's default
        self.module_dir = Path(__file__).parent

    @property
    def agent(self):
        if self._agent is None:
            self._agent = m.mod('agent')(
                goal=self.goal,
                skills=self.skills,
                model=self.provider,
            )
        return self._agent

    def forward(self, mod=None, path=None, key=None, provider=None, model=None, steps=15, **kwargs):
        """Scan a repo/module and write report to .security/{wallet}/."""
        return self.scan(mod=mod, path=path, key=key, provider=provider, model=model, steps=steps, **kwargs)

    def scan(self, mod=None, path=None, key=None, provider=None, model=None, steps=15, **kwargs):
        """
        Run a security scan on a repository or module.

        Args:
            mod: module name to scan (e.g. 'bridge', 'agent')
            path: repo path to scan (defaults to ~/mod/)
            key: key name for reviewer identity (defaults to 'test')
            provider: LLM provider ('openrouter' or 'venice')
            model: LLM model name (defaults to provider's default)
            steps: max agent steps
        """
        if mod:
            path = m.dp(mod)
        path = path or os.path.expanduser('~/mod')
        path = os.path.abspath(os.path.expanduser(path))
        key = key or self.key_name
        provider = provider or self.provider
        model = model or self.model

        if not os.path.isdir(path):
            return {'error': f'path not found: {path}'}

        # resolve reviewer wallet address
        wallet = self._resolve_wallet(key)
        print(f'[securescan] reviewer: {wallet}', color='cyan')
        print(f'[securescan] scanning: {path}', color='cyan')
        print(f'[securescan] provider: {provider}', color='cyan')
        if model:
            print(f'[securescan] model: {model}', color='cyan')

        # gather repo context for the prompt
        context = self._gather_context(path)
        prompt = self._build_prompt(context)

        # run agent
        ts = time.time()
        result = self.agent.run(
            query=prompt,
            path=path,
            model=model,
            provider=provider,
            steps=steps,
        )
        elapsed = round(time.time() - ts, 1)

        # parse findings from agent output
        findings = self._parse_findings(result)
        print(f'[securescan] found {len(findings)} findings in {elapsed}s', color='yellow')

        # build metadata
        metadata = {
            'timestamp': int(time.time()),
            'reviewer': wallet,
            'key': key,
            'model': model,
            'repo': path,
            'steps': steps,
            'elapsed_seconds': elapsed,
            'stats': self._compute_stats(findings),
        }

        # write report
        report_dir = self.write_report(path, wallet, findings, metadata)

        return {
            'reviewer': wallet,
            'repo': path,
            'findings': findings,
            'stats': metadata['stats'],
            'report_dir': str(report_dir),
            'elapsed': elapsed,
        }

    def write_report(self, path, wallet, findings, metadata):
        """Write scan results to {repo}/.security/{wallet}/."""
        security_dir = Path(path) / '.security' / wallet
        security_dir.mkdir(parents=True, exist_ok=True)

        # report.json — full structured report
        report = {
            **metadata,
            'findings': findings,
        }
        report_path = security_dir / 'report.json'
        with open(report_path, 'w') as f:
            json.dump(report, f, indent=2, default=str)
        print(f'[securescan] wrote {report_path}', color='green')

        # summary.md — human-readable
        summary = self._build_summary(findings, metadata)
        summary_path = security_dir / 'summary.md'
        with open(summary_path, 'w') as f:
            f.write(summary)
        print(f'[securescan] wrote {summary_path}', color='green')

        return security_dir

    def health(self):
        """Health check."""
        return {'status': 'ok', 'module': 'securescan'}

    def status(self):
        """Module status."""
        return {
            'module': 'securescan',
            'provider': self.provider,
            'model': self.model,
            'skills': self.skills,
        }

    # ── Internal ──────────────────────────────────────────────

    def _resolve_wallet(self, key):
        """Get wallet address from key name."""
        try:
            return m.key(key).address
        except Exception:
            return key

    def _gather_context(self, path):
        """Build a lightweight context summary of the repo."""
        context = {'path': path, 'file_types': {}, 'total_files': 0, 'structure': []}

        skip_dirs = {'.git', 'node_modules', '__pycache__', '.next', 'venv',
                     'env', '.env', 'dist', 'build', '.security'}

        for root, dirs, files in os.walk(path):
            dirs[:] = [d for d in dirs if d not in skip_dirs]
            for fname in files:
                context['total_files'] += 1
                ext = Path(fname).suffix.lower()
                if ext:
                    context['file_types'][ext] = context['file_types'].get(ext, 0) + 1
                rel = os.path.relpath(os.path.join(root, fname), path)
                if len(context['structure']) < 100:
                    context['structure'].append(rel)

        return context

    def _build_prompt(self, context):
        """Build the scan prompt from repo context."""
        parts = [
            f"Security audit of repository at: {context['path']}",
            f"\nTotal files: {context['total_files']}",
            f"File types: {json.dumps(context['file_types'], indent=2)}",
            f"\nSample structure (first 100 files):",
        ]
        for f in context['structure']:
            parts.append(f"  {f}")

        parts.append(
            "\nPerform a thorough security scan. Focus on high-impact vulnerabilities first. "
            "Use grep to search for secrets and dangerous patterns, then read suspicious files. "
            "When done, call finish with your findings list."
        )
        return '\n'.join(parts)

    def _parse_findings(self, result):
        """Extract structured findings from agent output."""
        findings = []
        if not result:
            return findings

        for step in result:
            if not isinstance(step, dict):
                continue
            # check finish step
            if step.get('tool', '').lower() == 'finish':
                params = step.get('params', {})
                if isinstance(params, dict):
                    if 'findings' in params:
                        f = params['findings']
                        if isinstance(f, list):
                            findings.extend(f)
                        else:
                            findings.append(f)
                    elif params:
                        findings.append(params)
            # check result fields
            if 'result' in step and isinstance(step['result'], dict):
                if 'findings' in step['result']:
                    r = step['result']['findings']
                    if isinstance(r, list):
                        findings.extend(r)

        return findings

    def _compute_stats(self, findings):
        """Compute summary statistics from findings."""
        stats = {'total': len(findings), 'by_severity': {}, 'by_category': {}}
        for f in findings:
            if not isinstance(f, dict):
                continue
            sev = f.get('severity', 'unknown')
            cat = f.get('category', 'other')
            stats['by_severity'][sev] = stats['by_severity'].get(sev, 0) + 1
            stats['by_category'][cat] = stats['by_category'].get(cat, 0) + 1
        return stats

    def _build_summary(self, findings, metadata):
        """Generate a markdown summary of the scan."""
        lines = [
            f"# Security Scan Report",
            f"",
            f"**Repo:** `{metadata['repo']}`",
            f"**Reviewer:** `{metadata['reviewer']}`",
            f"**Model:** `{metadata['model']}`",
            f"**Date:** {time.strftime('%Y-%m-%d %H:%M:%S', time.localtime(metadata['timestamp']))}",
            f"**Duration:** {metadata['elapsed_seconds']}s",
            f"",
            f"## Summary",
            f"",
            f"Total findings: **{metadata['stats']['total']}**",
            f"",
        ]

        # severity breakdown
        if metadata['stats'].get('by_severity'):
            lines.append("| Severity | Count |")
            lines.append("|----------|-------|")
            for sev in ['critical', 'high', 'medium', 'low', 'info']:
                count = metadata['stats']['by_severity'].get(sev, 0)
                if count:
                    lines.append(f"| {sev} | {count} |")
            lines.append("")

        # findings detail
        if findings:
            lines.append("## Findings")
            lines.append("")
            for i, f in enumerate(findings, 1):
                if not isinstance(f, dict):
                    continue
                sev = f.get('severity', 'unknown').upper()
                title = f.get('title', 'Untitled')
                lines.append(f"### {i}. [{sev}] {title}")
                lines.append("")
                if f.get('file'):
                    loc = f['file']
                    if f.get('line'):
                        loc += f":{f['line']}"
                    lines.append(f"**Location:** `{loc}`")
                if f.get('category'):
                    lines.append(f"**Category:** {f['category']}")
                lines.append("")
                if f.get('description'):
                    lines.append(f.get('description'))
                    lines.append("")
                if f.get('recommendation'):
                    lines.append(f"> **Fix:** {f['recommendation']}")
                    lines.append("")
                lines.append("---")
                lines.append("")
        else:
            lines.append("No findings detected.")
            lines.append("")

        return '\n'.join(lines)
