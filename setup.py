#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
Setup script for mod package
"""

from setuptools import setup, find_packages
import os
import sys

# Get the long description from README
this_dir = os.path.abspath(os.path.dirname(__file__))
readme_path = os.path.join(this_dir, 'README.md')
with open(readme_path, 'r', encoding='utf-8') as fh:
    long_description = fh.read()

# Define install requirements
# get requirements from requirements.txt
requirements_path = os.path.join(this_dir, 'requirements.txt')
with open(requirements_path, 'r', encoding='utf-8') as f:
    install_requires = f.read().splitlines()

# Get version from mod package if possible
version = '0.1.0'  # default
mod_path = os.path.join(this_dir, 'mod', '__init__.py')
if os.path.exists(mod_path):
    import re
    with open(mod_path, 'r', encoding='utf-8') as f:
        content = f.read()
    match = re.search(r"__version__\s*=\s*['\"]([^'\"]+)['\"]", content)
    if match:
        version = match.group(1)


# Optional dependencies
extras_require = {
    'quality': [
        'black==22.3',
        'click==8.0.4',
        'isort>=5.5.4',
        'flake8>=3.8.3',
    ],
    'testing': [
        'pytest>=7.2.0',
    ],
}
extras_require['all'] = extras_require['quality'] + extras_require['testing']

setup(
    name='mod',
    version=version,
    description='Global toolbox that allows you to connect and share any tool (module)',
    long_description=long_description,
    long_description_content_type='text/markdown',
    author='developers',
    author_email='bloc@proton.me',
    url='https://app.modc2.com/',
    project_urls={
        'Homepage': 'https://app.modc2.ai/',
        'Repository': 'https://github.com/modc2/mod',
    },
    packages=find_packages(exclude=['tests*', 'docs*']),
    include_package_data=True,
    python_requires='>=3.8, <=3.15',  # restrict to Python <3.13 to avoid asyncio issues
    install_requires=install_requires,
    extras_require=extras_require,
    entry_points={
        'console_scripts': ['m=mod:main','c=mod:main' ],
    },
    keywords=['modular', 'sdk', 'ai', 'crypto'],
    classifiers=[
        'Development Status :: 4 - Beta',
        'Intended Audience :: Developers',
        'Programming Language :: Python :: 3',
        'Programming Language :: Python :: 3.8',
        'Programming Language :: Python :: 3.9',
        'Programming Language :: Python :: 3.10',
        'Programming Language :: Python :: 3.11',
        'Programming Language :: Python :: Implementation :: CPython',
    ],
    license='MIT',
    zip_safe=False,
)
