"""
cursor — agent backend powered by the cursor-agent CLI.

Demonstrates the AgentBase template at ~/mod/mod/orbit/dev/src/agent_base.py.
Add your own agent by copying this file, swapping NAME/ICON/COLOR/BINARY/
DEFAULT_MODEL/ENV_KEY, and overriding build_args() if your CLI takes
different flags.

Install the CLI:
    npm install -g @cursor/cursor-agent      # (verify the actual package name)
Then set your API key via the dev console encrypted-key flow, and `submit()`
will spawn cursor-agent under the dev's Rust job server.
"""

import os
import sys

# Reach the dev module's agent_base regardless of how this is loaded
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "..", "dev", "src"))

from agent_base import AgentBase  # noqa: E402


class Mod(AgentBase):
    NAME = "cursor"
    ICON = "▶"
    COLOR = "#7c3aed"
    BINARY = "cursor-agent"
    DEFAULT_MODEL = "claude-3.5-sonnet"
    ENV_KEY = "CURSOR_API_KEY"
    DESCRIPTION = "Cursor agent backend (cursor-agent CLI)"

    def build_args(self, prompt, model, work_dir):
        # cursor-agent flags — adjust when you have the real CLI doc handy.
        return [
            "--print",
            "--model", model or self.DEFAULT_MODEL,
            "--workdir", work_dir,
            prompt,
        ]
