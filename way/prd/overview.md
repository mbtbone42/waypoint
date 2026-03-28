# Product Requirements: Waypoint

## Overview

**Waypoint** is a standalone, YAML-driven strategic schedule visualization tool. It renders high-level engineering timelines as SVG in a browser, designed for executive and board-level communication. It is part of the WAY.ai tooling ecosystem.

The core idea: define tracks, lanes, and work items in a **data YAML file**, control visual appearance with a **style CSS file**, configure the view scope (date range, which tracks to show) in a **view YAML file**, open an HTML page, and see a clean, presentation-ready timeline that shows where you are, what's done, what's on track, and what's slipped — all on one page. Export to PNG for inclusion in slide decks.

**Architectural principle:** Data, style, and view are always separate files. The **data file** is "just the facts" — schedule content independent of presentation. The **style file** (CSS) controls how it looks — fonts, colors, dimensions — reusable across views. The **view file** controls what to show right now — date range, track filtering, title. One data file can have multiple view files for different audiences, all sharing the same style.

### Origin and Design Intent

This format was originally used in board meetings at a startup to communicate engineering status to VCs. The visual language is deliberately high-level: a handful of tracks (User, Features, Systems, Infrastructure), a few swim lanes per track, and colored overlays showing plan vs. reality. The power is in its density-to-clarity ratio — a single page tells the whole story without requiring a project management tool.

**Key design principle:** This is not a planning tool. It is a *communication* tool. The YAML is the source of truth; the rendering is the presentation layer.

**Target audience:** Executives, VCs, partners, and other busy stakeholders who need a clear, concise picture of engineering progress at a glance.

## Goals

1. **Primary**: Deliver a zero-dependency, browser-based tool that renders YAML schedule data as a clean, presentation-ready SVG timeline suitable for executive and board-level communication
2. **Secondary**: Enable multiple views of the same data — board-level overview, single-track deep dives — through separate view YAML files without duplicating schedule data
3. **Tertiary**: Provide one-click PNG export so timelines can be embedded directly in slide decks without screenshots or external tools

## Non-Goals

- This is not a planning or project management tool — it does not replace Jira, Linear, or GitHub Projects
- No interactive editing of YAML through the UI (v1)
- No data import/transform from external tools (v1)
- No animation or transition effects
- No multi-page or scrollable timelines (v1 targets ~12-14 months on one screen)
- No confidence overlays or uncertainty visualization (v1)

## Success Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| Render accuracy | 100% of status types render correctly | Visual QA against reference image |
| Zero dependencies | 0 npm/CDN dependencies | Package audit |
| Load time | < 1s for example files | Browser DevTools |
| Export fidelity | PNG matches browser rendering | Visual comparison |
| Multi-view support | Same data file renders correctly with 2+ view files | Functional test |

## Timeline

- **Phase 1: Foundation** — Documents, data schema, YAML parser, basic SVG rendering (current)
- **Phase 2: Full Rendering** — Complete SVG layout with all status types, track zoom, milestones
- **Phase 3: Polish** — PNG export, tooltips, file pickers, legend, final visual QA

---

## v1 Scope

### In Scope

- Three-file architecture: data YAML (tracks, lanes, items, milestones) + style CSS (fonts, colors, dimensions) + view YAML (date range, track filter, today override)
- Program milestones: trackless, top-level milestone bars (e.g., Alpha, Beta, MVP) that span above all tracks
- Browser-based SVG rendering (pure vanilla JS, zero dependencies)
- Status overlay system: plan (gray), actual/completed (black), on-track (green), moved-out (red)
- Diamond endpoints on bars
- Vertical "today" line (auto-generated from system date, overridable in view YAML)
- Named vertical milestone lines (date, label, optional type for CSS styling)
- Track-level zoom (via view YAML or URL parameter; default: all tracks)
- Built-in export-to-PNG button
- Legend rendering
- Month-based timeline header with year labels

### Deferred to v2

- Confidence overlays (cone of uncertainty or discrete tags)
- Data import/transform from external tools (Jira, GitHub Projects, etc.)
- Interactive editing of the YAML through the UI
- Animation or transition effects
- Multi-page / scrollable timelines (v1 targets ~12 months on one screen)

---

## Data Model (YAML Schema)

Waypoint uses three files: a **data YAML file** containing the schedule content (tracks, lanes, items, milestones), a **style CSS file** controlling visual appearance (fonts, colors, dimensions), and a **view YAML file** controlling what to show (date range, track filtering, today line, title). This separation ensures the schedule source of truth is never entangled with presentation or scoping choices.

### Data File (`schedule-data.yaml`)

```yaml
# schedule-data.yaml — the schedule source of truth

program_milestones:            # optional; trackless bars rendered above all tracks
  - label: "Alpha"
    start: 2017-06-01
    end: 2017-09-15
    status: completed
  - label: "Beta"
    start: 2017-09-01
    end: 2018-02-28
    status: on-track
    notes: "Core platform stability and feature completion"

milestones:                    # optional; vertical date lines
  - date: 2017-12-15
    label: "Code Freeze"
    type: freeze               # optional; maps to CSS class for styling
    notes: "All features must be merged by EOD"
  - date: 2018-01-15
    label: "GA Release"
    type: release

tracks:
  - name: "User"
    notes: "End-user facing components: API, CLI, and UI"
    lanes:
      - name: "API & CLI"
        items:
          - label: "API & CLI"
            plan:
              start: 2017-06-01
              end: 2017-08-01
            status: completed
            actual:
              start: 2017-06-01
              end: 2017-07-15
          - label: "Authentication"
            plan:
              start: 2017-08-01
              end: 2017-11-01
            status: on-track
      - name: "UI"
        items:
          - label: "UI Prototype"
            plan:
              start: 2017-07-15
              end: 2017-10-01
            status: on-track

  - name: "Features"
    lanes:
      - name: "Feature Track A"
        items:
          - label: "Feature 1"
            plan:
              start: 2017-06-01
              end: 2017-10-15
            status: on-track
          - label: "Feature 2"
            plan:
              start: 2017-07-15
              end: 2017-10-01
            status: on-track
      - name: "Feature Track B"
        items:
          - label: "Feature 3"
            plan:
              start: 2017-06-01
              end: 2017-10-15
            status: moved-out
            actual:
              start: 2017-06-01
              end: 2017-08-15
            moved_to: 2017-10-15
          - label: "Feature 4"
            plan:
              start: 2017-10-01
              end: 2018-01-15
            status: planned

  - name: "Systems"
    lanes:
      # ... same pattern

  - name: "Infrastructure"
    lanes:
      # ... same pattern
```

### View File (`view-board.yaml`)

```yaml
# view-board.yaml — presentation configuration for board meetings

title: "Project Atlas — Engineering Schedule"

data: atlas-data.yaml          # which data file to load
style: atlas-style.css         # which style file to load (optional; defaults apply)

timeline:
  start: 2017-06-01
  end: 2018-03-01
  today: 2017-09-01            # optional; defaults to system date
  granularity: month            # v1 supports month only

tracks: all                     # default; or a list of track names to include:
# tracks:
#   - "User"
#   - "Features"

show_program_milestones: true   # default true; set false to hide

show_legend: true               # default true
```

Multiple view files can reference the same data file:

```yaml
# view-systems-deep-dive.yaml
title: "Systems Track — Deep Dive"
data: atlas-data.yaml
style: atlas-style.css
timeline:
  start: 2017-07-01
  end: 2017-12-31
  today: 2017-09-01
tracks:
  - "Systems"
show_program_milestones: false
```

### Program Milestones

Program milestones are high-level, trackless milestone bars that represent program-level phases (Alpha, Beta, MVP, MVP+1, etc.). They render above all tracks as colored bars with the same status semantics as track items. Not all schedules will use them — they are optional. When present, they provide top-level context that all tracks contribute to.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `label` | string | yes | Display name (e.g., "Beta", "MVP") |
| `start` | date | yes | Phase start date |
| `end` | date | yes | Phase end date (diamond rendered here) |
| `status` | enum | yes | One of: `planned`, `on-track`, `completed`, `moved-out` |
| `actual.start` | date | no | Actual start date |
| `actual.end` | date | no | Actual end date |
| `moved_to` | date | no | New end date if moved out |
| `notes` | string | no | Tooltip text shown on hover (e.g., phase objectives or context) |

### Item Schema Detail

Each item within a lane:

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `label` | string | yes | Display name shown on the bar |
| `plan.start` | date | yes | Planned start date |
| `plan.end` | date | yes | Planned end date (diamond rendered here) |
| `status` | enum | yes | One of: `planned`, `on-track`, `completed`, `moved-out` |
| `actual.start` | date | no | Actual start date (for completed items) |
| `actual.end` | date | no | Actual end date (for completed items) |
| `moved_to` | date | no | New planned end date (for moved-out items; red bar extends from original plan.end to this date) |
| `notes` | string | no | Tooltip or annotation text (v1: tooltip on hover) |

### Status Rendering Rules

| Status | Bar Color | Diamond Color | Behavior |
|--------|-----------|---------------|----------|
| `planned` | Gray (#CCCCCC) | Gray | Full plan bar rendered |
| `on-track` | Green (#2E8B2E) overlaid on gray | Green | Green bar from plan.start to today (or actual progress), gray continues to plan.end |
| `completed` | Black (#222222) overlaid on gray | Black | Black bar from actual.start to actual.end. If no actual dates, uses plan dates |
| `moved-out` | Green then Red (#CC0000) overlaid on gray | Red | Green bar up to original plan.end, red bar from plan.end to moved_to, then gray to new plan.end |

### Track Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | string | yes | Display name shown in the track gutter |
| `notes` | string | no | Tooltip text shown on hover (e.g., expanded name, scope description) |
| `lanes` | array | yes | List of lanes within this track |

### Lane Behavior

- Items within a lane may overlap or be sequential — the YAML defines their positions
- If items overlap in time, they render in the same horizontal lane (bars overlap visually, which is intentional for showing planned succession)
- Labels are positioned at the start of each bar, left-aligned

### Milestones

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `date` | date | yes | The date this milestone marks |
| `label` | string | yes | Display name shown at the top of the chart |
| `type` | string | no | CSS class for styling (e.g., `freeze`, `release`, `deadline`) |
| `notes` | string | no | Tooltip text shown on hover (e.g., what the milestone means, deadlines) |

- Rendered as vertical dashed or solid lines spanning the full chart height
- Label rendered above the header, centered on the line
- "Today" is a special milestone: auto-generated from system date, rendered as a distinct style (e.g., teal/blue dashed line), unless explicitly defined in the milestones array
- Hovering a milestone label shows the exact date and notes

---

## Rendering Specification

### Technology

- Pure vanilla JavaScript (ES modules OK)
- SVG output (not Canvas) — for crisp scaling and screenshot quality
- Single HTML file that loads JS module(s) and a YAML file
- Zero external dependencies (include a minimal YAML parser for the subset needed)

### Layout

```
+---------------------------------------------------------+
|  [Title]                                    [PNG v]     |
+------+--------------------------------------------------+
|      |  Jun '17 | Jul | Aug | Sep | Oct | Nov | Dec |   |
+------+--------------------------------------------------+
|      |        Beta  =================================>   |  <- program milestones
+------+--------------------------------------------------+
|      |  ==================>                              |
| User |      ========================>                    |
|      |          ==========================>              |
+------+--------------------------------------------------+
|      |  ========================>                        |
| Feat |      =================>                           |
|      |  ============xxxxx>    ===================>       |
+------+--------------------------------------------------+
|      |  ...                                              |
+------+--------------------------------------------------+
|  Legend: [ Plan  [ Actual  [ On Track  [ Moved Out      |
+---------------------------------------------------------+
```

- **Track labels**: Rendered vertically in a left-side gutter, with a subtle rounded border grouping the track's lanes (matching the reference image style)
- **Timeline header**: Month abbreviations with year shown on first month of each year or at boundaries
- **Bars**: Rounded-end rectangles with diamond at the endpoint
- **Today line**: Vertical dashed line spanning all tracks, labeled "Today" or with date
- **Legend**: Bottom of chart, showing the four status types with sample bar + diamond

### Sizing

- Default viewBox should accommodate ~12-14 months comfortably
- Target render size: ~1200-1400px wide (good for 1080p/4K screenshots and slide embedding)
- Vertical size scales with number of lanes
- Bars should have consistent height (~16-20px) with ~8-12px spacing between lanes

### Color Palette

All colors are defined in the style CSS file (see `atlas-style.css` for defaults). The data YAML contains no color values — all visual styling is handled through CSS classes and custom properties. See [ADR-004](../adrs/ADR-004-three-file-architecture.md) for rationale.

---

## Interactions (v1)

### Track-Level Zoom

- Primary mechanism: the view YAML's `tracks` field lists which tracks to render (default: `all`)
- URL parameter override: `?tracks=Systems` or `?tracks=Systems,Infrastructure` overrides the view file
- When filtered, only specified tracks render; program milestones (if enabled), timeline header, and legend remain
- A "Show All" button resets to all tracks

### Hover

- **Items**: Hovering an item bar shows a tooltip with: label, plan dates, actual dates (if any), status, and notes (if any)
- **Tracks**: Hovering a track label shows the track name and notes (if any), providing expanded context for abbreviated names
- **Program milestones**: Hovering a program milestone bar shows the label, date range, status, and notes (if any)
- **Milestones**: Hovering a milestone label shows the label, exact date, and notes (if any)

### PNG Export

- A button (top-right corner, subtle) triggers SVG-to-PNG export
- Implementation: serialize the SVG to a data URL, draw to a hidden canvas, trigger download
- Filename: `{title-slugified}-{YYYY-MM-DD}.png`
- The export button itself should NOT appear in the exported image

---

## File Structure

```
waypoint/
+-- index.html              # Entry point; loads waypoint.js and files
+-- waypoint.js             # Core rendering engine
+-- yaml-parser.js          # Minimal YAML parser (subset: maps, arrays, scalars, dates)
+-- export.js               # SVG-to-PNG export logic
+-- examples/
|   +-- atlas-data.yaml     # Example data file (schedule content)
|   +-- atlas-style.css     # Example style file (visual appearance)
|   +-- atlas-board.yaml    # Board-level view (all tracks)
|   +-- atlas-systems.yaml  # Systems-only deep-dive view
+-- README.md               # Usage instructions
+-- docs/                   # User-facing documentation
|   +-- data-view-style.md  # Three-file architecture guide
+-- way/                    # WAY.ai process documents
    +-- prd/                # This document
    +-- adrs/               # Architecture Decision Records
    +-- ddd/                # Domain-Driven Design models
    +-- cdd/                # Code Design Document
    +-- tsd/                # Test Strategy Document
    +-- chronicle/          # Project memory
```

### File Loading

Waypoint uses a dual loading strategy to work both from a static HTTP server and directly via `file://` (double-click `index.html`). See [ADR-005](../adrs/ADR-005-dual-loading-strategy.md) for details.

**HTTP mode** (`http://` / `https://`):
- Default: fetches `examples/atlas-data.yaml` and `examples/atlas-board.yaml`
- Configurable via URL parameters: `?data=my-data.yaml&view=my-view.yaml`
- If only `?data=` is provided with no view file, use sensible defaults (all tracks, full date range from data, today = system date)
- Track filtering can also be overridden via URL parameter: `?tracks=Systems,Infrastructure` (overrides view file)

**File mode** (`file://`):
- Default examples are embedded in `index.html` and render immediately — no server needed
- Custom files loaded via file pickers ("Load Data", "Load View", "Load Style" buttons) or drag-and-drop

**Both modes**:
- File pickers and drag-and-drop work in both HTTP and file mode
- Drag-and-drop of YAML/CSS files onto the page triggers re-render
- Loading priority: drag-drop > file picker > URL parameters > embedded defaults

---

## Example Files

The example files should use a 14-month timeline from December 2025 through January 2027, demonstrating all features of the tool with realistic project data.

**`atlas-data.yaml`** should include:
- Program milestones demonstrating completed, on-track, and planned states
- Four tracks: User, Features, Systems, Infrastructure
- Items demonstrating all four status types (planned, completed, on-track, moved-out)
- At least one moved-out example with red extension bar

**`atlas-board.yaml`** should include:
- Title: "Project Atlas — Engineering Schedule"
- Timeline: December 2025 through January 2027
- Today: approximately March 2026
- All tracks shown
- Program milestones and legend shown

**`atlas-systems.yaml`** should include:
- Title: "Project Atlas — Systems Deep Dive"
- Same timeline
- Only the Systems track
- Program milestones hidden

---

## Acceptance Criteria

1. **Three-file loading**: Given a data YAML, style CSS, and view YAML, the tool correctly loads all three and renders the timeline. If no view file is provided, sensible defaults apply (all tracks, full date range, today = system date). If no style file is provided, built-in defaults apply
2. **YAML to SVG rendering**: The rendered SVG matches the visual language of the reference image (tracks, lanes, colored bars with diamonds, today line, legend)
3. **Status overlay correctness**: Each of the four statuses (planned, completed, on-track, moved-out) renders with correct colors and overlay behavior
4. **Program milestones**: Trackless program milestone bars render above all tracks with correct status coloring, and can be toggled via view YAML
5. **Track zoom**: Setting `tracks: ["Systems"]` in the view YAML, or adding `?tracks=Systems` to the URL, renders only the Systems track
6. **Vertical milestones**: Vertical milestone lines render at specified dates with labels
7. **PNG export**: Clicking the export button downloads a PNG that matches the browser rendering (minus the export button itself)
8. **Multiple views**: The same data file renders correctly with different view files (board view vs. deep-dive view)
9. **YAML loading**: The tool can load YAML files from the same directory, via URL parameters, or via file pickers
10. **No dependencies**: The tool runs from a simple HTTP server with zero npm/CDN dependencies
11. **Reference fidelity**: The example files produce output visually faithful to the reference image style

---

## Future Considerations (v2+)

- **View presets**: Bundled view templates (quarterly review, sprint retrospective, investor update) with appropriate defaults
- **Confidence overlays**: Shaded uncertainty ranges or discrete confidence tags per item
- **Data import**: Transform from Jira, GitHub Projects, Linear, or CSV
- **Interactive YAML editing**: Split-pane with YAML editor on left, live preview on right
- **Sub-item drill-down**: Click a track or item to expand into finer-grained sub-schedule
- **Multiple timelines**: Side-by-side or overlay comparison (plan A vs plan B)
- **Dark mode**: Alternate color scheme
- **Annotation layer**: Callout text or arrows pointing to specific items
- **WAY.ai integration**: Generate Waypoint YAML from WAY.ai project structure (PRD to schedule)
- **Print stylesheet**: CSS `@media print` for direct printing

---

## Related Documents

- ADRs: [ADR-001 YAML Parser](../adrs/ADR-001-yaml-parser.md), [ADR-002 SVG Layout](../adrs/ADR-002-svg-layout.md), [ADR-003 PNG Export](../adrs/ADR-003-png-export.md), [ADR-004 Three-File Architecture](../adrs/ADR-004-three-file-architecture.md), [ADR-005 Dual Loading](../adrs/ADR-005-dual-loading-strategy.md)
- Domain Model: [DDD-001 Schedule Visualization](../ddd/DDD-001-schedule-visualization.md)
- Code Design: [CDD](../cdd/overview.md)
- Test Strategy: [TSD](../tsd/overview.md)
- Chronicle: [2026-03](../chronicle/2026-03.md)

---

*This PRD is a living document. See Chronicle for evolution history.*
