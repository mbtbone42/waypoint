# Waypoint — Product Requirements Document

## Overview

**Waypoint** is a standalone, YAML-driven strategic schedule visualization tool. It renders high-level engineering timelines as SVG in a browser, designed for executive and board-level communication. It is part of the WAY.ai tooling ecosystem.

The core idea: define tracks, lanes, and work items in a **data YAML file**, configure the view (date range, which tracks to show) in a separate **view YAML file**, open an HTML page, and see a clean, presentation-ready timeline that shows where you are, what's done, what's on track, and what's slipped — all on one page. Export to PNG for inclusion in slide decks.

**Architectural principle:** Data and view are always separate files. One data file can have multiple view files for different audiences (board view, engineering view, single-track deep dive). This separation keeps the schedule source of truth independent from how it is presented.

### Origin and Design Intent

This format was originally used in board meetings at a startup to communicate engineering status to VCs. The visual language is deliberately high-level: a handful of tracks (User, Features, Systems, Infrastructure), a few swim lanes per track, and colored overlays showing plan vs. reality. The power is in its density-to-clarity ratio — a single page tells the whole story without requiring a project management tool.

**Key design principle:** This is not a planning tool. It is a *communication* tool. The YAML is the source of truth; the rendering is the presentation layer.

---

## v1 Scope

### In Scope
- Two-file YAML architecture: data file (tracks, lanes, items, milestones) + view file (date range, track filter, today override)
- Program milestones: trackless, top-level milestone bars (e.g., Alpha, Beta, MVP) that span above all tracks
- Browser-based SVG rendering (pure vanilla JS, zero dependencies)
- Status overlay system: plan (gray), actual/completed (black), on-track (green), moved-out (red)
- Diamond endpoints on bars
- Vertical "today" line (auto-generated from system date, overridable in view YAML)
- Named vertical milestone lines (date, label, optional color)
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

Waypoint uses two YAML files: a **data file** containing the schedule content (tracks, lanes, items, milestones) and a **view file** controlling how that data is presented (date range, track filtering, today line, title). This separation ensures the schedule source of truth is never entangled with presentation choices.

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

milestones:                    # optional; vertical date lines
  - date: 2017-12-15
    label: "Code Freeze"
    color: "#0066cc"           # optional; defaults to dark gray
  - date: 2018-01-15
    label: "GA Release"

tracks:
  - name: "User"
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

### Lane Behavior

- Items within a lane may overlap or be sequential — the YAML defines their positions
- If items overlap in time, they render in the same horizontal lane (bars overlap visually, which is intentional for showing planned succession)
- Labels are positioned at the start of each bar, left-aligned

### Milestones

- Rendered as vertical dashed or solid lines spanning the full chart height
- Label rendered at top or bottom, rotated or horizontal depending on space
- "Today" is a special milestone: auto-generated from system date, rendered as a distinct style (e.g., teal/blue dashed line), unless explicitly defined in the milestones array

---

## Rendering Specification

### Technology
- Pure vanilla JavaScript (ES modules OK)
- SVG output (not Canvas) — for crisp scaling and screenshot quality
- Single HTML file that loads JS module(s) and a YAML file
- Zero external dependencies (include a minimal YAML parser or write one for the subset needed)

### Layout

```
┌─────────────────────────────────────────────────────────┐
│  [Title]                                    [PNG ↓]     │
├──────┬──────────────────────────────────────────────────┤
│      │  Jun '17 │ Jul │ Aug │ Sep │ Oct │ Nov │ Dec │   │
├──────┼──────────────────────────────────────────────────┤
│      │        Beta  ════════════════════════════════◆   │  ← program milestones
├──────┼──────────────────────────────────────────────────┤
│      │  ══════════════════◆                             │
│ User │      ══════════════════════◆                     │
│      │          ════════════════════════◆                │
├──────┼──────────────────────────────────────────────────┤
│      │  ══════════════════════◆                         │
│ Feat │      ══════════════◆                             │
│      │  ════════════●●●●●●●◆    ════════════════◆      │
├──────┼──────────────────────────────────────────────────┤
│      │  ...                                             │
├──────┴──────────────────────────────────────────────────┤
│  Legend: ■ Plan  ■ Actual  ■ On Track  ■ Moved Out     │
└─────────────────────────────────────────────────────────┘
```

- **Track labels**: Rendered vertically in a left-side gutter, with a subtle rounded border grouping the track's lanes (matching the reference image style)
- **Timeline header**: Month abbreviations with year shown on first month of each year or at boundaries
- **Bars**: Rounded-end rectangles with diamond (◆) at the endpoint
- **Today line**: Vertical line spanning all tracks, labeled "Today" or with date
- **Legend**: Bottom of chart, showing the four status types with sample bar + diamond

### Sizing
- Default viewBox should accommodate ~12 months comfortably
- Target render size: ~1200-1400px wide (good for 1080p/4K screenshots and slide embedding)
- Vertical size scales with number of lanes
- Bars should have consistent height (~16-20px) with ~8-12px spacing between lanes

### Color Palette

| Element | Color | Hex |
|---------|-------|-----|
| Plan bar | Light gray | `#C8C8C8` |
| Plan diamond | Gray | `#AAAAAA` |
| Completed bar | Near-black | `#222222` |
| Completed diamond | Black | `#000000` |
| On-track bar | Forest green | `#2E8B2E` |
| On-track diamond | Green | `#1B7A1B` |
| Moved-out bar | Red | `#CC3333` |
| Moved-out diamond | Red | `#CC0000` |
| Today line | Teal | `#008B8B` |
| Milestone line | Dark gray | `#555555` (default) |
| Track label bg | Light green tint | `#F0F5F0` |
| Background | White | `#FFFFFF` |

---

## Interactions (v1)

### Track-Level Zoom
- Primary mechanism: the view YAML's `tracks` field lists which tracks to render (default: `all`)
- URL parameter override: `?tracks=Systems` or `?tracks=Systems,Infrastructure` overrides the view file
- When filtered, only specified tracks render; program milestones (if enabled), timeline header, and legend remain
- A "Show All" button resets to all tracks

### Hover
- Hovering an item bar shows a tooltip with: label, plan dates, actual dates (if any), status, and notes (if any)

### PNG Export
- A button (top-right corner, subtle) triggers SVG-to-PNG export
- Implementation: serialize the SVG to a data URL, draw to a hidden canvas, trigger download
- Filename: `{title-slugified}-{YYYY-MM-DD}.png`
- The export button itself should NOT appear in the exported image

---

## File Structure

```
waypoint/
├── index.html              # Entry point; loads waypoint.js and YAML files
├── waypoint.js             # Core rendering engine
├── yaml-parser.js          # Minimal YAML parser (subset: maps, arrays, scalars, dates)
├── export.js               # SVG-to-PNG export logic
├── examples/
│   ├── atlas-data.yaml     # Example data file matching the reference image
│   ├── atlas-board.yaml    # Board-level view (all tracks)
│   └── atlas-systems.yaml  # Systems-only deep-dive view
├── README.md               # Usage instructions
└── docs/
    ├── data-schema.md      # Full data YAML schema reference
    └── view-schema.md      # Full view YAML schema reference
```

### YAML Loading
- Default: loads `examples/atlas-data.yaml` and `examples/atlas-board.yaml`
- Configurable via URL parameters: `?data=my-data.yaml&view=my-view.yaml`
- If only `?data=` is provided with no view file, use sensible defaults (all tracks, full date range from data, today = system date)
- Or via file input: "Load Data YAML" and "Load View YAML" buttons that open file pickers
- Track filtering can also be overridden via URL parameter: `?tracks=Systems,Infrastructure` (overrides view file)

---

## Example Files (Matching Reference Image)

The example files should recreate the reference image as closely as possible:

**`atlas-data.yaml`** should include:
- Program milestones: "Beta" spanning from ~Sep 2017 through Feb 2018 (on-track)
- Four tracks: User, Features, Systems, Infrastructure
- The specific items shown: API & CLI (completed), UI Prototype (on-track), Authentication (on-track), Feature 1-4, System 1-4, Infra 1-3, Install/Upgrade (completed), Support, Rollback
- Feature 3 as a moved-out example

**`atlas-board.yaml`** should include:
- Title: "Project Atlas — Engineering Schedule"
- Timeline: June 2017 through February 2018
- Today: approximately September 2017
- All tracks shown
- Program milestones shown
- Legend shown

**`atlas-systems.yaml`** should include:
- Title: "Project Atlas — Systems Deep Dive"
- Same timeline
- Only the Systems track
- Program milestones hidden

---

## Acceptance Criteria

1. **Two-file loading**: Given a data YAML and a view YAML, the tool correctly merges them and renders the timeline. If no view file is provided, sensible defaults apply (all tracks, full date range, today = system date)
2. **YAML → SVG rendering**: The rendered SVG matches the visual language of the reference image (tracks, lanes, colored bars with diamonds, today line, legend)
3. **Status overlay correctness**: Each of the four statuses (planned, completed, on-track, moved-out) renders with correct colors and overlay behavior
4. **Program milestones**: Trackless program milestone bars (e.g., "Beta") render above all tracks with correct status coloring, and can be toggled via view YAML
5. **Track zoom**: Setting `tracks: ["Systems"]` in the view YAML, or adding `?tracks=Systems` to the URL, renders only the Systems track
6. **Vertical milestones**: Vertical milestone lines render at specified dates with labels
7. **PNG export**: Clicking the export button downloads a PNG that matches the browser rendering (minus the export button itself)
8. **Multiple views**: The same data file renders correctly with different view files (board view vs. deep-dive view)
9. **YAML loading**: The tool can load YAML files from the same directory, via URL parameters (`?data=` and `?view=`), or via file pickers
10. **No dependencies**: The tool runs from a simple HTTP server (or even `file://` if possible) with zero npm/CDN dependencies
11. **Reference fidelity**: The example files produce output visually faithful to the uploaded reference image

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
- **WAY.ai integration**: Generate Waypoint YAML from WAY.ai project structure (PRD → ADR → schedule)
- **Print stylesheet**: CSS `@media print` for direct printing

---

## WAY.ai Methodology Notes

This project follows WAY.ai methodology:
- **This PRD** is the governing requirements document
- **ADRs** should be created for: YAML parser approach (write vs. embed minimal lib), SVG layout algorithm, PNG export method
- **DDD** (Design Decision Documents) for visual design choices if deviating from reference
- Chronicle entries as the project evolves

The project is small enough for a single engineer to build in a focused sprint. The YAML schema is the critical design decision — get it right and everything else follows.
