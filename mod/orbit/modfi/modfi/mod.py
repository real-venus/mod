import subprocess
import os

class ModFi:
    description = "DeFi aggregator on Base - Rust API + Next.js frontend"
    root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    app_dir = os.path.join(root, "app")

    def serve(self, port=8420):
        """Start the Rust API server"""
        subprocess.run(["cargo", "run"], cwd=self.root)

    def app(self, port=8421):
        """Start the Next.js frontend"""
        subprocess.run(["npm", "run", "dev"], cwd=self.app_dir)

    def build(self):
        """Build both Rust binary and Next.js app"""
        subprocess.run(["cargo", "build", "--release"], cwd=self.root)
        subprocess.run(["npm", "run", "build"], cwd=self.app_dir)

    def dev(self):
        """Run API server in dev mode"""
        self.serve()
