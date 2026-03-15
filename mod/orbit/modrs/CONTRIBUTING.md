# Contributing to ModRS

Thank you for your interest in contributing to ModRS! This document provides guidelines and instructions for contributing.

## Development Setup

1. Install Rust (1.70 or later):
```bash
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
```

2. Clone the repository:
```bash
git clone https://github.com/yourorg/modrs
cd modrs
```

3. Build the project:
```bash
cargo build
```

4. Run tests:
```bash
cargo test
cargo test --all-features
```

## Code Style

- Run `cargo fmt` before committing
- Run `cargo clippy -- -D warnings` to catch common mistakes
- Follow Rust naming conventions
- Write documentation for public APIs
- Add tests for new functionality

## Testing

### Unit Tests
```bash
cargo test
```

### Integration Tests
```bash
cargo test --test integration
```

### Documentation Tests
```bash
cargo test --doc
```

## Pull Request Process

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Make your changes
4. Add/update tests
5. Ensure all tests pass
6. Run `cargo fmt` and `cargo clippy`
7. Commit your changes (`git commit -m 'Add amazing feature'`)
8. Push to the branch (`git push origin feature/amazing-feature`)
9. Open a Pull Request

## Pull Request Guidelines

- Keep changes focused and atomic
- Write clear commit messages
- Update documentation for API changes
- Add examples for new features
- Ensure CI passes

## Architecture Guidelines

- Maintain API compatibility with Python mod where reasonable
- Use async/await for I/O operations
- Leverage Rust's type system for safety
- Minimize unsafe code (document why when necessary)
- Follow the single responsibility principle

## Documentation

- Use rustdoc comments (`///`) for public items
- Include examples in documentation
- Update README.md for significant changes
- Add entries to CHANGELOG.md

## Questions or Issues?

- Open an issue for bugs or feature requests
- Start a discussion for questions
- Join our Discord/Slack (if available)

## Code of Conduct

Be respectful, inclusive, and professional in all interactions.

---

Thank you for contributing to ModRS! 🦀
