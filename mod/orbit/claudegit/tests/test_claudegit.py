#!/usr/bin/env python3
"""
ClaudeGit Tests

Basic tests for the ClaudeGit module.
"""

import os
import sys
import pytest
from pathlib import Path

# Add parent directory to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from claudegit import Mod


class TestClaudeGitInit:
    """Test initialization"""

    def test_init_basic(self):
        """Test basic initialization"""
        c = Mod(auto_push=False)
        assert c is not None
        assert c.auto_push == False
        assert c.default_path is not None

    def test_init_with_github_config(self):
        """Test initialization with GitHub config"""
        c = Mod(
            github_token='test_token',
            github_repo='test/repo',
            github_branch='dev',
            auto_push=True
        )
        assert c.github_token == 'test_token'
        assert c.github_repo == 'test/repo'
        assert c.github_branch == 'dev'
        assert c.auto_push == True

    def test_init_from_env(self):
        """Test initialization from environment variables"""
        os.environ['GITHUB_TOKEN'] = 'env_token'
        os.environ['GITHUB_REPO'] = 'env/repo'

        c = Mod()

        assert c.github_token == 'env_token'
        assert c.github_repo == 'env/repo'

        # Cleanup
        del os.environ['GITHUB_TOKEN']
        del os.environ['GITHUB_REPO']


class TestGitHubConfiguration:
    """Test GitHub configuration"""

    def test_configure_github(self):
        """Test configure_github method"""
        c = Mod(auto_push=False)

        config = c.configure_github(
            token='new_token',
            repo='new/repo',
            branch='feature',
            auto_push=True
        )

        assert config['token_set'] == True
        assert config['repo'] == 'new/repo'
        assert config['branch'] == 'feature'
        assert config['auto_push'] == True

        assert c.github_token == 'new_token'
        assert c.github_repo == 'new/repo'
        assert c.github_branch == 'feature'
        assert c.auto_push == True

    def test_configure_partial(self):
        """Test partial configuration update"""
        c = Mod(
            github_token='token1',
            github_repo='repo1',
            auto_push=False
        )

        # Update only branch
        config = c.configure_github(branch='dev')

        assert config['token_set'] == True
        assert config['repo'] == 'repo1'
        assert config['branch'] == 'dev'
        assert c.github_token == 'token1'
        assert c.github_repo == 'repo1'


class TestOwnerManagement:
    """Test owner-based access control"""

    def test_set_owner(self):
        """Test setting owner"""
        c = Mod()
        c.set_owner('0x1234567890abcdef')

        assert c.owner == '0x1234567890abcdef'


class TestGitHubPush:
    """Test GitHub push functionality (mocked)"""

    def test_sync_to_github_no_config(self):
        """Test sync_to_github fails without configuration"""
        c = Mod(auto_push=False)
        c.github_token = None
        c.github_repo = None

        with pytest.raises(ValueError, match="GitHub token and repo must be configured"):
            c.sync_to_github()

    def test_git_force_push_no_config(self):
        """Test git_force_push fails without configuration"""
        c = Mod(auto_push=False)
        c.github_token = None
        c.github_repo = None

        with pytest.raises(ValueError):
            c.git_force_push()


def main():
    """Run tests"""
    print("\n" + "="*60)
    print("Running ClaudeGit Tests")
    print("="*60 + "\n")

    pytest.main([__file__, '-v'])


if __name__ == '__main__':
    main()
