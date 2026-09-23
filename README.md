# Aetheria Update 0.1.7 — Modular Refactor

## What was preserved

The source file is a 5,020-line single HTML document containing CSS, HTML and JavaScript.
The original UI IDs were retained in `index.html` so existing DOM-dependent systems can be
migrated without changing their contracts.

The source already contains distinct systems for:
- hero roster/progression
- party management
- recruitment
- inventory
- database pages
- save/load
- town/day cycle
- dungeon analysis
- modal handling

This refactor uses a **strangler migration**:
1. static data moves to `js/data/`
2. global state moves to `js/core/state.js`
3. shared DOM helpers move to `js/ui/`
4. Hero and Inventory become independent feature modules
5. the remaining 0.1.7 engine stays isolated in `js/legacy/engine.js`
6. more features can be migrated one-by-one without changing save data or IDs

## Important

Because the original 0.1.7 engine has many cross-references between systems, moving every
function in one pass would create circular imports and risk behavior changes. The bridge
keeps the existing logic isolated while allowing individual modules to take ownership safely.

For browser testing, serve this folder through a local HTTP server because ES modules are
subject to browser module-origin rules.

Example:
python -m http.server 8080

Then open:
http://localhost:8080/
