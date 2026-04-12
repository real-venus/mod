List available mod orbit modules and their documentation.

Usage: /modules [search_term]

Arguments:
- $ARGUMENTS: optional search term to filter modules

Instructions:
1. List all directories under ~/mod/mod/orbit/
2. If a search term is provided, filter to modules whose name contains the search term.
3. For each module found, check which documentation files exist:
   - skill.md
   - CLAUDE.md
   - README.md
   - Any other .md files
4. Present the results as a table:
   - Module name
   - Available .md files
   - Brief description (from config.json if present)
5. Remind the user they can use `/use <module_name>` to load a module's context.
