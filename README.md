# Waypoint

YAML-driven strategic schedule visualization. Renders high-level engineering timelines as SVG in the browser, designed for executive and board-level communication.

Define your schedule in a **data file**, control appearance with a **style file**, and choose what to show with a **view file**. Open in a browser. Export to PNG for slide decks.

## Quick Start

```bash
# Serve from the project root
python3 -m http.server 8765

# Open in browser
open http://localhost:8765
```

The default example (Project Atlas) renders immediately. No npm, no build step, no dependencies.

To open without a server, double-click `index.html` directly. The embedded example renders via `file://` protocol. Use the toolbar buttons to load your own YAML/CSS files.

## How It Works

Waypoint uses three files that separate concerns cleanly:

| File | Purpose | Format |
|------|---------|--------|
| **Data** | Schedule content — tracks, lanes, items, milestones | YAML |
| **Style** | Visual appearance — fonts, colors, bar dimensions | CSS |
| **View** | What to show — date range, track filter, title | YAML |

One data file can have many views. All views can share one style. See [docs/data-view-style.md](docs/data-view-style.md) for the full guide.

## Project Structure

```
waypoint/
+-- index.html                # Entry point
+-- src/
|   +-- waypoint.js           # Core rendering engine
|   +-- yaml-parser.js        # Minimal YAML parser
|   +-- export.js             # SVG-to-PNG export
+-- examples/
|   +-- atlas-data.yaml       # Example schedule data
|   +-- atlas-style.css       # Example style (default theme)
|   +-- atlas-board.yaml      # Board-level view (all tracks)
|   +-- atlas-systems.yaml    # Systems-only deep-dive view
+-- docs/                     # User-facing documentation
|   +-- data-view-style.md    # Three-file architecture guide
+-- way/                      # WAY.ai process documents (internal)
```

## Loading Custom Files

**Via URL parameters** (HTTP mode):

```
http://localhost:8765?data=my-data.yaml&view=my-view.yaml
http://localhost:8765?tracks=Systems,Infrastructure
```

**Via toolbar**: Click "Load Data", "Load View", or "Load Style" to pick files.

**Via drag-and-drop**: Drag YAML or CSS files onto the page.

## Export

Click **Export PNG** in the toolbar. The output is 2x resolution for crisp results on Retina displays and in slide decks. The export button itself does not appear in the exported image.

## Zero Dependencies

Waypoint has no npm packages, no CDN imports, no build step. Everything — including the YAML parser — is vanilla JavaScript served as-is. Run it from any static file server or open it directly.
