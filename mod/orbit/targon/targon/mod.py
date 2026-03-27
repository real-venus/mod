import json
import os
import urllib.request
import urllib.error

API_BASE = 'https://api.targon.com/tha/v2'


class Mod:
    description = """
    Targon GPU cloud - browse inventory, manage rentals, deploy workloads.
    Interface to targon.com compute marketplace (Manifold Labs).
    """

    def __init__(self):
        self.api_key = os.environ.get('TARGON_API_KEY', '')

    def _headers(self, auth=False):
        h = {'Content-Type': 'application/json'}
        if auth:
            if not self.api_key:
                raise ValueError('TARGON_API_KEY not set. Get one at targon.com/settings')
            h['Authorization'] = f'Bearer {self.api_key}'
        return h

    def _get(self, path, auth=False, params=None):
        url = f'{API_BASE}{path}'
        if params:
            qs = '&'.join(f'{k}={v}' for k, v in params.items() if v is not None)
            if qs:
                url += f'?{qs}'
        req = urllib.request.Request(url, headers=self._headers(auth))
        with urllib.request.urlopen(req, timeout=15) as r:
            return json.loads(r.read())

    def _post(self, path, data=None):
        url = f'{API_BASE}{path}'
        body = json.dumps(data or {}).encode()
        req = urllib.request.Request(url, data=body, headers=self._headers(auth=True), method='POST')
        with urllib.request.urlopen(req, timeout=30) as r:
            return json.loads(r.read()) if r.status != 204 else {}

    def _delete(self, path):
        url = f'{API_BASE}{path}'
        req = urllib.request.Request(url, headers=self._headers(auth=True), method='DELETE')
        with urllib.request.urlopen(req, timeout=15) as r:
            return json.loads(r.read()) if r.status != 204 else {}

    # ── inventory (no auth) ──────────────────────────────────────────

    def forward(self, gpu=True, **kwargs) -> list:
        """List available compute inventory from targon.com/inventory."""
        params = {}
        if gpu is not None:
            params['gpu'] = str(gpu).lower()
        items = self._get('/inventory', auth=False, params=params)
        if not isinstance(items, list):
            items = items.get('data', items.get('items', [items]))
        return items

    def inventory(self, gpu_only=True) -> list:
        """Pretty-print available GPUs/CPUs with pricing."""
        items = self.forward(gpu=gpu_only if gpu_only else None)
        out = []
        for r in items:
            spec = r.get('spec', {})
            line = {
                'name': r.get('display_name') or r.get('name', '?'),
                'gpu': spec.get('gpu_type', 'cpu'),
                'gpu_count': spec.get('gpu_count', 0),
                'vcpu': spec.get('vcpu', 0),
                'ram_gb': round(spec.get('memory', 0) / 1024, 1) if spec.get('memory', 0) > 1024 else spec.get('memory', 0),
                'cost_hr': f"${r.get('cost_per_hour', '?')}",
                'available': r.get('available', False),
            }
            out.append(line)
        return out

    def cheapest(self, gpu=True) -> dict:
        """Find the cheapest available resource."""
        items = self.forward(gpu=gpu)
        available = [r for r in items if r.get('available')]
        if not available:
            return {'error': 'nothing available'}
        return min(available, key=lambda x: float(x.get('cost_per_hour', 999)))

    # ── workloads / rentals (auth required) ──────────────────────────

    def rentals(self, status=None) -> list:
        """List your active workloads/rentals."""
        params = {'type': 'RENTAL'}
        if status:
            params['status'] = status
        return self._get('/workloads', auth=True, params=params)

    def rent(self, resource='h200-small', name='mod-rental', image='ubuntu:22.04', ssh_key_uid=None) -> dict:
        """Create and deploy a GPU rental.

        Args:
            resource: compute tier name (e.g. h200-small, h200-large)
            name: workload name
            image: docker image
            ssh_key_uid: uid of uploaded SSH key
        """
        body = {
            'name': name,
            'image': image,
            'resource_name': resource,
            'type': 'RENTAL',
        }
        if ssh_key_uid:
            body['ssh_keys'] = [ssh_key_uid]

        workload = self._post('/workloads', body)
        uid = workload.get('uid')
        if uid:
            self._post(f'/workloads/{uid}/deploy')
            workload['status'] = 'deploying'
        return workload

    def status(self, uid: str) -> dict:
        """Get workload state (status, access URLs, ready replicas)."""
        return self._get(f'/workloads/{uid}/state', auth=True)

    def logs(self, uid: str, tail=100) -> dict:
        """Get workload logs."""
        return self._get(f'/workloads/{uid}/logs', auth=True, params={'tail': tail})

    def stop(self, uid: str) -> dict:
        """Delete/stop a workload."""
        return self._delete(f'/workloads/{uid}')

    # ── ssh keys ─────────────────────────────────────────────────────

    def ssh_keys(self) -> list:
        """List your SSH keys."""
        return self._get('/ssh-keys', auth=True)

    def add_ssh_key(self, name: str, public_key: str) -> dict:
        """Upload an SSH public key."""
        return self._post('/ssh-keys', {'name': name, 'ssh_key': public_key})

    # ── account ──────────────────────────────────────────────────────

    def credits(self) -> dict:
        """Check your credit balance."""
        return self._get('/me/credits', auth=True)

    def wallet(self) -> dict:
        """Get your wallet address."""
        return self._get('/me/wallet', auth=True)
