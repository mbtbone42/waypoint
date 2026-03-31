# Code Design Document: Waypoint

**Status**: Active
**Date**: 2026-03-27
**Authors**: Engineering
**Related**: ADR-001, ADR-002, ADR-003, ADR-004, DDD-001

## Purpose

This document specifies the implementation design for Waypoint — the concrete code structures, module boundaries, entry points, and runtime behavior that translate the PRD and ADRs into working software. It serves as the blueprint for implementation and a reference for tracking how the actual code deviates from the plan over time.

---

## Language and Runtime

- **Language**: JavaScript (ES2020+, ES modules)
- **Runtime**: Modern browsers (Chrome, Safari, Firefox — latest 2 versions)
- **Module system**: ES modules (`import`/`export`), loaded via `<script type="module">`
- **No build step**: No bundler, no transpiler, no npm. Files are served as-is.
- **No server requirement**: Works from any static file server (HTTP) and from `file://` protocol (double-click `index.html`). See Dual Loading Strategy below.

---

## Module Breakdown

### `index.html` — Entry Point

The single HTML file that bootstraps the application.

**Responsibilities:**
- Defines the page structure: SVG container, export button, file picker controls
- Loads `waypoint.js` as the main module
- Parses URL parameters (`?data=`, `?view=`, `?tracks=`)
- Triggers initial load

**Key elements:**
```html
<div id="waypoint-container">
  <svg id="waypoint-svg" class="waypoint"></svg>
</div>
<button class="export-btn" id="export-btn">PNG</button>
```

URL parameter handling:
```
?data=path/to/data.yaml     — override data file
&view=path/to/view.yaml     — override view file
&tracks=Systems,User         — override track filter (comma-separated)
```

### `yaml-parser.js` — YAML Parser

A minimal, custom YAML parser for the subset used by Waypoint.

**Exports:**
```javascript
export function parseYAML(text)  // → JavaScript object (nested maps, arrays, scalars)
```

**Supported YAML features:**
- Indentation-based nesting (2-space indent expected, but flexible)
- `key: value` maps
- `- item` arrays (block sequences)
- Scalar types: strings (quoted and unquoted), integers, floats, booleans (`true`/`false`), `null`, dates (`YYYY-MM-DD`)
- Comments (`# ...`)
- Empty values (key with no value → `null`)
- Multi-line strings (basic `|` and `>` block scalars)

**Not supported:**
- Flow sequences (`[a, b, c]`) and flow mappings (`{a: 1, b: 2}`)
- Anchors and aliases (`&anchor`, `*alias`)
- Tags (`!!str`, `!!int`)
- Multi-document streams (`---` as document separator)
- Complex keys

**Internal data structures:**

```javascript
// Parser state — tracks position while walking through lines
{
  lines: string[],      // input split by newlines
  pos: number,          // current line index
}

// Each line is analyzed into:
{
  indent: number,       // leading space count
  content: string,      // trimmed line (comments stripped)
  isArrayItem: boolean, // starts with "- "
  key: string | null,   // if "key: value", the key part
  value: string | null, // if "key: value", the value part
}
```

**Error handling:**
- Throws on malformed input with line number and description
- Example: `YAMLParseError: Unexpected indent at line 14`

### `waypoint.js` — Core Rendering Engine

The main module. Loads data/style/view files, builds the schedule model, and renders SVG.

**Exports:**
```javascript
export async function init(container, options)  // → void; main entry point
export function render(schedule, container)      // → SVGElement; builds SVG from model
```

**Internal data structures:**

```javascript
// Schedule — the merged model (from data + view)
{
  title: string,
  description: string | null,       // from view YAML; tooltip on title hover
  timeline: {
    start: Date,
    end: Date,
    today: Date,
    granularity: "month",
  },
  programMilestones: [
    { label: string, start: Date, end: Date, status: string,
      actual: { start: Date, end: Date } | null,
      notes: string | null, link: string | null }
  ],
  milestones: [
    { date: Date, label: string, type: string | null,
      notes: string | null, link: string | null }
  ],
  tracks: [
    {
      name: string,
      notes: string | null,
      link: string | null,
      lanes: [
        {
          name: string,
          items: [
            {
              label: string,
              plan: { start: Date, end: Date },
              status: "planned" | "on-track" | "completed" | "moved-out",
              actual: { start: Date, end: Date } | null,
              movedTo: Date | null,
              notes: string | null,
              link: string | null,
            }
          ]
        }
      ]
    }
  ],
  showProgramMilestones: boolean,
  showLegend: boolean,
  legendDescriptions: {            // defaults with optional view overrides
    plan: string,
    completed: string,
    "on-track": string,
    "moved-out": string,
  },
}
```

```javascript
// Layout constants — read from CSS custom properties where possible,
// with fallback defaults
{
  GUTTER_WIDTH: 80,
  HEADER_HEIGHT: 40,
  PROGRAM_MS_HEIGHT: 30,
  BAR_HEIGHT: 16,
  LANE_SPACING: 28,
  TRACK_PADDING: 12,
  TRACK_GAP: 16,
  DIAMOND_SIZE: 10,
  CHART_WIDTH: 1300,
}
```

**Rendering pipeline (sequential):**

1. `loadFiles(dataUrl, viewUrl, styleUrl)` — fetch and parse YAML files, load CSS
2. `buildSchedule(dataObj, viewObj)` — merge data + view into Schedule model
3. `computeLayout(schedule)` — calculate Y positions, total height
4. `renderSVG(schedule, layout)` — create SVG DOM elements:
   - Header (month labels)
   - Grid lines (vertical month boundaries)
   - Program milestones row
   - Track groups (label + lanes + items)
   - Today line
   - Milestone lines
   - Legend
5. `attachInteractions(svg, schedule)` — hover tooltips, track filter buttons

**Date-to-X coordinate mapping:**
```javascript
function dateToX(date, timeline, chartLeft, chartRight) {
  const totalMs = timeline.end - timeline.start;
  const elapsedMs = date - timeline.start;
  return chartLeft + (elapsedMs / totalMs) * (chartRight - chartLeft);
}
```

**SVG element creation helper:**
```javascript
function svgEl(tag, attrs) {
  const el = document.createElementNS("http://www.w3.org/2000/svg", tag);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  return el;
}
```

### `export.js` — PNG Export

**Exports:**
```javascript
export function exportPNG(svgElement, title)  // → void; triggers download
```

**Pipeline:**
1. Clone SVG element (to avoid mutating the live DOM)
2. Inline all computed styles into the clone (so serialization captures them)
3. Serialize clone to XML string via `XMLSerializer`
4. Create `data:image/svg+xml` URL
5. Draw onto a hidden `<canvas>` at 2x resolution
6. `canvas.toDataURL("image/png")` → trigger download via temporary `<a>` element

**Filename:** `{slugify(title)}-{YYYY-MM-DD}.png`

---

## Dual Loading Strategy

Waypoint supports two runtime modes depending on the protocol:

### HTTP Mode (`http://` or `https://`)

Full-featured mode when served from any static file server.

- URL parameters work: `?data=`, `?view=`, `?tracks=`
- `fetch()` loads YAML and CSS files by path
- File pickers and drag-drop also available as alternatives

### File Mode (`file://`)

Works when the user double-clicks `index.html` directly. Browsers block `fetch()` on `file://` due to CORS/same-origin restrictions, so this mode uses two alternative loading mechanisms:

1. **Embedded defaults**: The example data, view, and style are embedded directly in `index.html` as `<script>` blocks with custom types. This means the default example renders immediately with no fetch required.

```html
<script id="default-data" type="text/yaml">
  # atlas-data.yaml content embedded here
  ...
</script>
<script id="default-view" type="text/yaml">
  # atlas-board.yaml content embedded here
  ...
</script>
<style id="default-style">
  /* atlas-style.css content embedded here */
</style>
```

2. **File pickers and drag-drop**: For custom data, the user clicks "Load Data", "Load View", or "Load Style" buttons (or drags files onto the page). These use `<input type="file">` and `FileReader`, which work on `file://` without CORS restrictions.

### Protocol Detection

```javascript
function isFileProtocol() {
  return window.location.protocol === "file:";
}
```

On init, the app checks the protocol:
- **HTTP**: Attempt `fetch()` for URL-param or default paths. Fall back to embedded defaults if fetch fails.
- **File**: Skip `fetch()` entirely. Load from embedded defaults. Show file picker UI prominently.

### Loading Priority

Regardless of protocol, the loading priority is:

1. **Drag-and-drop** files (highest priority — always overrides)
2. **File picker** selections
3. **URL parameters** (`?data=`, `?view=`, `?tracks=`) — HTTP mode only
4. **Embedded defaults** (fallback)

## File Loading Flow

```
index.html
  ↓ detect protocol (file:// vs http://)
  ↓
  ├─ HTTP mode:
  │    ↓ read URL params (?data=, ?view=, ?tracks=)
  │    ↓ fetch(dataUrl) → text → parseYAML() → dataObj
  │    ↓ fetch(viewUrl) → text → parseYAML() → viewObj
  │    ↓ read viewObj.style → fetch(styleUrl) → inject <style>
  │    ↓ URL ?tracks= param overrides viewObj.tracks
  │
  ├─ File mode:
  │    ↓ read embedded <script type="text/yaml"> blocks
  │    ↓ parseYAML(embeddedData) → dataObj
  │    ↓ parseYAML(embeddedView) → viewObj
  │    ↓ embedded <style> already in document
  │
  ↓ (either path produces dataObj + viewObj + style)
  ↓
waypoint.js init()
  ↓ buildSchedule(dataObj, viewObj) → Schedule model
  ↓ computeLayout(schedule) → layout positions
  ↓ renderSVG(schedule, layout) → SVG element
  ↓ attachInteractions(svg, schedule)
  ↓
  ↓ file picker / drag-drop → re-run from parseYAML step
  ↓ export button → export.js exportPNG()
```

---

## Key Implementation Details

### Bar Rendering (per item)

Each item is rendered as a `<g>` group containing layered elements:

1. **Plan bar** (`<rect class="bar plan">`) — full width, plan.start to plan.end
2. **Status overlay** — depends on status:
   - `completed`: `<rect class="bar completed">` from actual.start to actual.end
   - `on-track`: `<rect class="bar on-track">` from plan.start to today (clamped to plan.end)
   - `moved-out`: `<rect class="bar on-track">` from plan.start to plan.end, then `<rect class="bar moved-out">` from plan.end to movedTo
   - `planned`: no overlay (plan bar only)
3. **Diamond** (`<polygon class="diamond {status}">`) — at the endpoint of the status-relevant bar
4. **Label** (`<text class="bar-label">`) — positioned above the bar start

### Diamond Shape

A rotated square rendered as an SVG polygon:
```javascript
function diamond(cx, cy, size) {
  const h = size / 2;
  return `${cx},${cy - h} ${cx + h},${cy} ${cx},${cy + h} ${cx - h},${cy}`;
}
```

### Track Label (Rotated)

Track names are rendered vertically in the gutter using SVG text rotation:
```javascript
text.setAttribute("transform", `rotate(-90, ${x}, ${y})`);
```

### Tooltip

On hover, a tooltip `<g>` is shown near the hovered element with a rounded-rect background and text lines. The tooltip is appended to the SVG and removed on mouseout.

Tooltips are universal — every visual object supports them:

| Object | Tooltip Content | Source |
|--------|----------------|--------|
| Item bar | Label, plan dates, actual dates, status, notes | Data YAML |
| Track label | Track name, notes | Data YAML |
| Program milestone | Label, date range, status, notes | Data YAML |
| Milestone label | Label, exact date (YYYY-MM-DD), notes | Data YAML |
| Today label | "Today", exact date | View YAML (timeline.today) |
| Title | Title, description | View YAML |
| Legend entry | Status name, description | Built-in defaults, overridable via view YAML `legend_descriptions` |
| Month header | Generated summary: completions, starts, milestones | Generated from data |

Tooltips only render content that exists — if there's no notes field, that line is omitted.

**Legend defaults** (overridable via `legend_descriptions` in view YAML):
- Plan: "Scheduled work that has not yet started"
- Completed: "Work that has been finished"
- On Track: "Work in progress, proceeding as planned"
- Moved Out: "Work that has slipped past its original target date"

**Month header summaries** are generated at render time by scanning all items. For each month, the tooltip lists: items with `plan.end` in that month (due), items with `plan.start` in that month (starting), milestones in that month, and items completing (`actual.end`) in that month.

---

## Threading Model

Not applicable. Waypoint is single-threaded, synchronous rendering in the browser main thread. The only async operations are the initial `fetch()` calls for YAML and CSS files.

---

## Database / Storage

None. Waypoint is stateless. All data comes from YAML files loaded at runtime. No localStorage, no IndexedDB, no cookies.

---

## Network Interactions

- `fetch()` for loading YAML data files and view files (same-origin or local)
- `fetch()` for loading CSS style files
- No external API calls, no telemetry, no analytics

---

## Error Handling Strategy

| Error | Handling |
|-------|----------|
| YAML file not found (404) | Display error message in the SVG container with the URL that failed |
| YAML parse error | Display error with line number and description |
| Invalid status value | Treat as `planned` and log a console warning |
| Missing required fields (label, plan.start, plan.end, status) | Skip the item and log a console warning |
| View references tracks not in data | Ignore missing track names, render what exists |
| No data file specified | Load default example |

---

## Deviation Tracking

This section will be updated as implementation progresses to note where the actual code deviates from this design and why.

| Date | Area | Planned | Actual | Reason |
|------|------|---------|--------|--------|
| | | | | |
