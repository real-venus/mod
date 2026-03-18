# Mods build system
# Build native and WASM targets for all mods

MODS := $(filter-out mod_sdk, $(notdir $(wildcard */Cargo.toml)))
MODS_DIRS := $(filter-out mod_sdk, $(patsubst %/Cargo.toml,%,$(wildcard */Cargo.toml)))
WASM_TARGET := wasm32-unknown-unknown

.PHONY: all native wasm clean test new

# Build all mods (native)
all: native

# Build all mods as native
native:
	cargo build --release

# Build all mods as WASM
wasm:
	cargo build --target $(WASM_TARGET) --release

# Build a specific mod as WASM:  make wasm-example
wasm-%:
	cargo build --target $(WASM_TARGET) --release -p mod_$*

# Run all tests
test:
	cargo test --workspace

# Test a specific mod:  make test-example
test-%:
	cargo test -p mod_$*

# Clean build artifacts
clean:
	cargo clean

# Create a new mod:  make new NAME=mymod
new:
	@if [ -z "$(NAME)" ]; then echo "Usage: make new NAME=mymod"; exit 1; fi
	@mkdir -p $(NAME)/src
	@echo '[package]' > $(NAME)/Cargo.toml
	@echo 'name = "mod_$(NAME)"' >> $(NAME)/Cargo.toml
	@echo 'version = "0.1.0"' >> $(NAME)/Cargo.toml
	@echo 'edition.workspace = true' >> $(NAME)/Cargo.toml
	@echo 'license.workspace = true' >> $(NAME)/Cargo.toml
	@echo 'authors.workspace = true' >> $(NAME)/Cargo.toml
	@echo '' >> $(NAME)/Cargo.toml
	@echo '[lib]' >> $(NAME)/Cargo.toml
	@echo 'crate-type = ["cdylib", "rlib"]' >> $(NAME)/Cargo.toml
	@echo '' >> $(NAME)/Cargo.toml
	@echo '[dependencies]' >> $(NAME)/Cargo.toml
	@echo 'mod_sdk = { path = "../mod_sdk" }' >> $(NAME)/Cargo.toml
	@echo 'serde = { workspace = true }' >> $(NAME)/Cargo.toml
	@echo 'serde_json = { workspace = true }' >> $(NAME)/Cargo.toml
	@echo '' >> $(NAME)/Cargo.toml
	@echo '[target.'"'"'cfg(target_arch = "wasm32")'"'"'.dependencies]' >> $(NAME)/Cargo.toml
	@echo 'wasm-bindgen = "0.2"' >> $(NAME)/Cargo.toml
	@cp example/mod.rs $(NAME)/mod.rs
	@sed -i '' 's/example/$(NAME)/g' $(NAME)/mod.rs
	@sed -i '' 's/Example/$(shell echo $(NAME) | sed "s/\b\(.\)/\u\1/g")/g' $(NAME)/mod.rs
	@echo "//! $(NAME) mod" > $(NAME)/src/lib.rs
	@echo "" >> $(NAME)/src/lib.rs
	@echo "use mod_sdk::*;" >> $(NAME)/src/lib.rs
	@echo "use serde::{Deserialize, Serialize};" >> $(NAME)/src/lib.rs
	@echo "use serde_json::{json, Value};" >> $(NAME)/src/lib.rs
	@echo "" >> $(NAME)/src/lib.rs
	@echo "#[derive(Debug, Clone, Serialize, Deserialize)]" >> $(NAME)/src/lib.rs
	@echo "pub struct $(shell echo $(NAME) | perl -pe 's/(^|_)(\w)/uc($$2)/ge') {" >> $(NAME)/src/lib.rs
	@echo "    pub name: String," >> $(NAME)/src/lib.rs
	@echo "    pub version: String," >> $(NAME)/src/lib.rs
	@echo "}" >> $(NAME)/src/lib.rs
	@echo "" >> $(NAME)/src/lib.rs
	@echo "impl $(shell echo $(NAME) | perl -pe 's/(^|_)(\w)/uc($$2)/ge') {" >> $(NAME)/src/lib.rs
	@echo "    pub fn new() -> Self {" >> $(NAME)/src/lib.rs
	@echo '        Self { name: "$(NAME)".to_string(), version: "0.1.0".to_string() }' >> $(NAME)/src/lib.rs
	@echo "    }" >> $(NAME)/src/lib.rs
	@echo "}" >> $(NAME)/src/lib.rs
	@echo "" >> $(NAME)/src/lib.rs
	@echo "impl ModApi for $(shell echo $(NAME) | perl -pe 's/(^|_)(\w)/uc($$2)/ge') {" >> $(NAME)/src/lib.rs
	@echo '    fn name(&self) -> &str { &self.name }' >> $(NAME)/src/lib.rs
	@echo '    fn version(&self) -> &str { &self.version }' >> $(NAME)/src/lib.rs
	@echo '    fn description(&self) -> &str { "$(NAME) mod" }' >> $(NAME)/src/lib.rs
	@echo "" >> $(NAME)/src/lib.rs
	@echo "    fn handle(&self, req: Request) -> Result<Response, ModError> {" >> $(NAME)/src/lib.rs
	@echo '        match req.method.as_str() {' >> $(NAME)/src/lib.rs
	@echo '            "info" => Ok(Response::ok(serde_json::to_value(self.info()).unwrap())),' >> $(NAME)/src/lib.rs
	@echo '            _ => Err(ModError::not_found(format!("method '"'"'{}'"'"' not found", req.method))),' >> $(NAME)/src/lib.rs
	@echo "        }" >> $(NAME)/src/lib.rs
	@echo "    }" >> $(NAME)/src/lib.rs
	@echo "" >> $(NAME)/src/lib.rs
	@echo "    fn routes(&self) -> Vec<Route> { vec![] }" >> $(NAME)/src/lib.rs
	@echo "}" >> $(NAME)/src/lib.rs
	@# Add to workspace
	@sed -i '' 's/]$$/    "$(NAME)",\n]/' Cargo.toml
	@echo "Created mod '$(NAME)' in mods/$(NAME)/"
	@echo "  -> mods/$(NAME)/src/lib.rs   (crate — native + WASM)"
	@echo "  -> mods/$(NAME)/mod.rs       (file-based module system)"

# List all mods
list:
	@echo "Available mods:"
	@for dir in $(MODS_DIRS); do echo "  $$dir"; done

# Show help
help:
	@echo "Mods build system"
	@echo ""
	@echo "Commands:"
	@echo "  make              Build all mods (native)"
	@echo "  make wasm         Build all mods as WASM"
	@echo "  make wasm-NAME    Build specific mod as WASM"
	@echo "  make test         Run all tests"
	@echo "  make test-NAME    Test specific mod"
	@echo "  make new NAME=x   Create a new mod"
	@echo "  make list         List all mods"
	@echo "  make clean        Clean build artifacts"
