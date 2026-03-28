# DDD-001: Schedule Visualization

**Status**: Active
**Date**: 2026-03-26
**Authors**: Engineering
**Related**: ADR-001, ADR-002, ADR-003, ADR-004

## Context Overview

The Schedule Visualization domain encompasses the entire Waypoint system: parsing YAML schedule data, applying CSS styles, configuring view scope, and rendering a presentation-quality SVG timeline. This is a small, focused tool with four logical sub-contexts (Data, Style, View, Rendering) that share a single codebase without needing formal context boundaries.

## Ubiquitous Language

| Term | Definition | Context-Specific Notes |
|------|------------|------------------------|
| Track | A named high-level grouping of related work (e.g., "User", "Infrastructure") | Rendered as a labeled row group with a rounded border |
| Lane | A subdivision within a track containing one or more items | Each lane occupies one horizontal row in the rendering |
| Item | A single work unit with planned dates, status, and optional actual dates | The atomic rendered element — a bar with a diamond endpoint |
| Program Milestone | A trackless, high-level phase bar (e.g., "Alpha", "Beta") rendered above all tracks | Optional; not tied to any specific track |
| Milestone | A named vertical date line spanning the chart height | Distinct from program milestones; represents a point in time, not a range |
| Status | One of four states: `planned`, `on-track`, `completed`, `moved-out` | Determines bar color and rendering behavior |
| Plan | The originally scheduled start and end dates for an item | Always present; rendered as the gray base bar |
| Actual | The real start and/or end dates for a completed item | Optional; when present, the completed overlay uses these dates |
| Moved-out | An item whose end date has slipped past the original plan | Rendered with a red extension bar from plan.end to moved_to date |
| Data File | A YAML file containing the schedule source of truth (tracks, lanes, items, milestones) | Independent of any presentation or scoping choices |
| Style File | A CSS file controlling visual appearance: fonts, colors, bar dimensions, spacing | Reusable across multiple view files; maps directly to SVG/CSS properties |
| View File | A YAML file controlling presentation scope: date range, track filtering, title, today override; references data and style files | Multiple view files can reference the same data and style files |
| Today Line | A vertical dashed line marking the current date (or an overridden date) | Auto-generated from system date unless specified in view file |
| Diamond | A rotated square shape at the endpoint of a bar | Color matches the item's status; key visual element of the design |
| Gutter | The left-side column where track labels are rendered vertically | Fixed width; contains rotated text labels with rounded background |

## Domain Model

### Core Entities

**Schedule** (Aggregate Root)
- **Description**: The complete parsed and merged result of a data file and view file, ready for rendering
- **Key Attributes**: title, timeline (start, end, today, granularity), tracks[], programMilestones[], milestones[], viewSettings
- **Lifecycle**: Created by parsing data + view YAML; immutable once constructed; re-created on file change
- **Invariants**: timeline.start must be before timeline.end; today must be within or near timeline range
- **Relationships**: Contains Tracks, ProgramMilestones, Milestones

**Track**
- **Description**: A named group of related lanes
- **Key Attributes**: name, lanes[]
- **Lifecycle**: Defined in data file; filtered by view file
- **Invariants**: Must have at least one lane; name must be unique within a schedule
- **Relationships**: Contains Lanes; may be filtered out by View configuration

**Lane**
- **Description**: A horizontal row within a track containing items
- **Key Attributes**: name, items[]
- **Lifecycle**: Defined in data file
- **Invariants**: Must have at least one item
- **Relationships**: Belongs to a Track; contains Items

**Item**
- **Description**: A single work unit rendered as a colored bar with a diamond endpoint
- **Key Attributes**: label, plan (start, end), status, actual (start, end)?, moved_to?, notes?
- **Lifecycle**: Defined in data file; status may change over time as YAML is updated
- **Invariants**: plan.start must be before plan.end; if actual is present, actual.start must be before actual.end; if moved_to is present, status must be moved-out
- **Relationships**: Belongs to a Lane

### Value Objects

**DateRange**
- **Description**: A pair of dates representing a time span
- **Immutability**: Once parsed from YAML, dates do not change during a render cycle
- **Equality**: Two DateRanges are equal if both start and end dates match

**StatusType**
- **Description**: One of: `planned`, `on-track`, `completed`, `moved-out`
- **Immutability**: Enum-like; fixed set of values
- **Equality**: String comparison

**ColorPalette**
- **Description**: Mapping of status types and UI elements to hex color values
- **Immutability**: Fixed for a given render; defined as constants
- **Equality**: Not compared

### Aggregates

**Schedule**
- **Root**: Schedule
- **Boundary**: The entire parsed data + view combination
- **Consistency**: All items must reference valid statuses; all dates must be parseable; track names in view filter must exist in data

## Domain Events

**ScheduleLoaded**
- **Triggers**: Data YAML and View YAML successfully parsed and merged
- **Data**: Complete Schedule object
- **Consumers**: Rendering engine

**TrackFilterChanged**
- **Triggers**: URL parameter change or "Show All" button click
- **Data**: New list of visible track names
- **Consumers**: Rendering engine (re-renders with filtered tracks)

**ExportRequested**
- **Triggers**: User clicks PNG export button
- **Data**: Reference to current SVG element, title for filename
- **Consumers**: Export module

## Bounded Context Relationships

```
[Data Parsing] --produces--> [Schedule Model] --consumed by--> [SVG Rendering]
                                                --consumed by--> [PNG Export]
[View Parsing] --configures--> [Schedule Model]
[Style Loading] --applied to--> [SVG Rendering]
[User Interaction] --triggers--> [Track Filtering] --updates--> [SVG Rendering]
[User Interaction] --triggers--> [Export] --reads--> [SVG Rendering]
```

### Data Parsing <-> Schedule Model

- **Pattern**: Producer-Consumer
- **Direction**: Data Parsing produces the Schedule Model
- **Interface**: `parseYAML(text)` returns a JavaScript object; caller constructs Schedule from data + view objects

### Schedule Model <-> SVG Rendering

- **Pattern**: Consumer
- **Direction**: Rendering reads the Schedule Model
- **Interface**: Rendering function accepts a Schedule object and produces SVG DOM

### SVG Rendering <-> PNG Export

- **Pattern**: Consumer
- **Direction**: Export reads the rendered SVG element
- **Interface**: Export function accepts an SVG DOM element and triggers a PNG download

## Key Design Constraints

1. **Zero dependencies**: All code — including YAML parsing — must be written from scratch or use only browser-native APIs. This keeps the tool self-contained and deployable anywhere.
2. **Data/Style/View separation**: The data file contains only schedule facts; the style file contains only visual appearance; the view file contains only scope and references. This enables multiple views of the same data with consistent or varied styling.
3. **SVG output**: All rendering must produce SVG (not Canvas) for resolution independence and clean export quality.
4. **Single-page render**: v1 targets ~12-14 months on one screen. No scrolling, no pagination.

## Implementation Guidance

- **File organization**: One JS module per sub-context — `yaml-parser.js` (data parsing), `waypoint.js` (model + rendering), `export.js` (PNG export)
- **Rendering approach**: Single top-down layout pass computing Y positions as it goes; no two-pass layout needed for v1
- **Date math**: Use native `Date` objects; compute day offsets for X positioning via linear interpolation
- **Status rendering**: Layer bars bottom-to-top — plan (gray) first, then status overlay on top — so colors naturally stack
- **Diamond rendering**: SVG `<polygon>` with four points forming a rotated square, sized consistently

## References

- Related ADRs: [ADR-001 YAML Parser](../adrs/ADR-001-yaml-parser.md), [ADR-002 SVG Layout](../adrs/ADR-002-svg-layout.md), [ADR-003 PNG Export](../adrs/ADR-003-png-export.md), [ADR-004 Three-File Architecture](../adrs/ADR-004-three-file-architecture.md)
- PRD: [overview.md](../prd/overview.md)
