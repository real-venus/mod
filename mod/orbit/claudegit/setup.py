#!/usr/bin/env python3
"""
ClaudeGit Setup Script

Installation script for the ClaudeGit module.
"""

from setuptools import setup, find_packages
from pathlib import Path

# Read README
readme_file = Path(__file__).parent / "README.md"
long_description = readme_file.read_text() if readme_file.exists() else ""

setup(
    name="claudegit",
    version="1.0.0",
    description="Claude Code + GitHub Integration - Automated AI code tasks with GitHub sync",
    long_description=long_description,
    long_description_content_type="text/markdown",
    author="Mod Protocol",
    author_email="team@modprotocol.org",
    url="https://github.com/modprotocol/mod",
    packages=find_packages(),
    install_requires=[
        "graphene>=3.0",
        "graphql-core>=3.2.0",
        "graphql-relay>=3.2.0",
        "gql>=3.0.0",
        "requests_toolbelt",
        "PyGithub>=2.1.1",
        "gitpython>=3.1.40",
    ],
    extras_require={
        "dev": [
            "pytest>=7.0.0",
            "pytest-cov>=4.0.0",
            "black>=23.0.0",
            "flake8>=6.0.0",
        ]
    },
    python_requires=">=3.11",
    classifiers=[
        "Development Status :: 4 - Beta",
        "Intended Audience :: Developers",
        "Topic :: Software Development :: Libraries :: Python Modules",
        "Topic :: Software Development :: Version Control :: Git",
        "Programming Language :: Python :: 3",
        "Programming Language :: Python :: 3.11",
        "Programming Language :: Python :: 3.12",
    ],
    keywords="claude ai github automation code-generation",
    entry_points={
        "console_scripts": [
            "claudegit=claudegit.claudegit:main",
        ],
    },
)
