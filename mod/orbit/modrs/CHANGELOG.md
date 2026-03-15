# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Initial Rust implementation of Mod framework
- Core module system with dynamic loading
- Cryptographic operations (secp256k1, signing, encryption)
- Key-value storage with SQLite backend
- HTTP server management
- Git operations (push, clone, list repos)
- CLI tool (`m` command)
- Configuration management (TOML/YAML)
- Comprehensive error handling
- Optional AI integration (OpenRouter)
- Optional IPFS integration
- Full API compatibility with Python mod

### Features
- Async/await throughout using Tokio
- Type-safe APIs
- Memory-safe operations (no unsafe code in core)
- Ethereum-compatible key management
- Encrypted storage support
- Multi-algorithm hashing (SHA256, SHA512, Keccak256, BLAKE3)
- Port management and discovery
- System information utilities

### Documentation
- Comprehensive README with examples
- API documentation (rustdoc)
- Usage examples
- Contributing guidelines

## [0.1.0] - 2024-01-15

### Initial Release
- Foundation of ModRS framework
- Core functionality implemented
- API parity with Python version

---

## Release Process

1. Update CHANGELOG.md
2. Update version in Cargo.toml
3. Run tests: `cargo test --all-features`
4. Build release: `cargo build --release`
5. Tag release: `git tag -a v0.1.0 -m "Release v0.1.0"`
6. Push: `git push origin main --tags`
7. Publish: `cargo publish` (if on crates.io)
