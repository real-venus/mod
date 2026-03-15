.PHONY: help build test clean install fmt clippy doc examples bench

# Default target
help:
	@echo "ModRS Makefile"
	@echo ""
	@echo "Available targets:"
	@echo "  build      - Build the project"
	@echo "  test       - Run all tests"
	@echo "  clean      - Clean build artifacts"
	@echo "  install    - Install CLI tool"
	@echo "  fmt        - Format code"
	@echo "  clippy     - Run linter"
	@echo "  doc        - Generate documentation"
	@echo "  examples   - Run examples"
	@echo "  bench      - Run benchmarks"

# Build the project
build:
	cargo build --release

# Run tests
test:
	cargo test
	cargo test --all-features
	cargo test --doc

# Clean build artifacts
clean:
	cargo clean

# Install CLI globally
install:
	cargo install --path .

# Format code
fmt:
	cargo fmt

# Run clippy
clippy:
	cargo clippy -- -D warnings

# Generate documentation
doc:
	cargo doc --open --all-features

# Run examples
examples:
	cargo run --example basic
	cargo run --example server

# Run benchmarks
bench:
	cargo bench

# Quick checks before committing
check: fmt clippy test
	@echo "✅ All checks passed!"

# Release build
release: test
	cargo build --release
	@echo "✅ Release build complete: target/release/m"
