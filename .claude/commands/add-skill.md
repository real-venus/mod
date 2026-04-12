Create or update a skill.md file for a mod orbit module.

Usage: /add-skill <module_name>

Arguments:
- $ARGUMENTS: the module name to create a skill.md for

Instructions:
1. Read the module's config.json from ~/mod/mod/orbit/<module_name>/config.json
2. Read the module's mod.py from ~/mod/mod/orbit/<module_name>/mod.py or similar main file
3. Read the module's README.md if it exists
4. Generate a skill.md that includes:
   - Module name and one-line description
   - Capabilities (what it can do)
   - Key functions with brief descriptions (from config.json schema)
   - Usage examples (Python code using the Mod class)
   - API endpoints if any (from config.json endpoints)
   - Environment variables needed (check for .env, .env.example)
5. Write the skill.md to ~/mod/mod/orbit/<module_name>/skill.md
6. Confirm the file was created and show a preview.
