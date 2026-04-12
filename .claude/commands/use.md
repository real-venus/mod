Load context from a mod orbit module.

Usage: /use <module_name> [file]

Arguments:
- $ARGUMENTS: module name, optionally followed by a specific .md filename

Instructions:
1. Parse the arguments: the first word is the module name, the second (optional) word is a specific file to load.
2. The module lives at ~/mod/mod/orbit/<module_name>/
3. If no specific file is given, look for these files in order and load the FIRST one found:
   - skill.md
   - CLAUDE.md
   - README.md
4. If a specific file is given (e.g. `/use goldfi ARCHITECTURE.md`), load that file from the module directory.
5. Also read the module's config.json to understand its functions, schema, ports, and endpoints.
6. After reading, provide a brief summary of the module's capabilities and confirm the context is loaded.
7. If the module doesn't exist, list similar module names from ~/mod/mod/orbit/ as suggestions.
