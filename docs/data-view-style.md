# Data, View, and Style

Waypoint separates schedule content from visual appearance from presentation scope. This guide explains each file type, how they interoperate, and how to author them — whether you're writing YAML by hand or generating it with an AI agent.

## How the Three Files Work Together

```
data.yaml          style.css          view.yaml
(what happened)    (how it looks)     (what to show)
     |                  |                  |
     |                  |    references    |
     |                  |<----- style -----|
     |    references    |                  |
     |<----- data ------|------------------|
     |                  |                  |
     +--------+---------+--------+---------+
              |                  |
              v                  v
        Schedule Model     CSS Applied to SVG
              |
              v
         Rendered SVG
```

The **view file** is the entry point. It references which data file to load and which style file to use. Waypoint reads the view, fetches the data and style, builds a schedule model, and renders SVG.

This means:
- **One data file, many views.** A board-level overview and a systems deep-dive can show the same schedule data with different track filters and date ranges.
- **One style file, many views.** All views share the same visual theme. Swap the style file for a different look without touching data or views.
- **Data never contains visual information.** No colors, no font sizes, no pixel values. Data is "just the facts."

---

## Data File (YAML)

The data file is the schedule source of truth. It contains what happened and what is planned — nothing about how to display it.

### Structure

```yaml
# my-project-data.yaml

program_milestones:          # Optional. High-level phase bars above all tracks.
  - label: "Beta"
    start: 2026-03-01
    end: 2026-08-31
    status: on-track

milestones:                  # Optional. Vertical date lines.
  - date: 2026-06-15
    label: "Feature Freeze"
    type: freeze             # Optional. Maps to a CSS class for styling.

tracks:
  - name: "User"
    lanes:
      - name: "API"
        items:
          - label: "API v1"
            plan:
              start: 2026-01-01
              end: 2026-04-01
            status: completed
            actual:              # Optional. Real dates for completed work.
              start: 2026-01-01
              end: 2026-03-15
```

### Item Fields

| Field | Required | Description |
|-------|----------|-------------|
| `label` | Yes | Display name shown on the bar |
| `plan.start` | Yes | Planned start date (YYYY-MM-DD) |
| `plan.end` | Yes | Planned end date |
| `status` | Yes | One of: `planned`, `on-track`, `completed`, `moved-out` |
| `actual.start` | No | Real start date (for completed items) |
| `actual.end` | No | Real end date (for completed items) |
| `moved_to` | No | New end date (for moved-out items) |
| `notes` | No | Tooltip text shown on hover |

### Status Values

| Status | Meaning | Visual |
|--------|---------|--------|
| `planned` | Not started, scheduled for the future | Gray bar only |
| `on-track` | In progress, proceeding as planned | Green overlay on gray |
| `completed` | Done | Black overlay on gray |
| `moved-out` | Slipped past original plan date | Green then red extension on gray |

### Milestone Types

Milestone `type` values map to CSS classes. The default style includes:

| Type | Default Color | Use For |
|------|--------------|---------|
| `freeze` | Blue | Feature freeze, code freeze |
| `release` | Green | GA release, launch dates |
| `deadline` | Red | Hard deadlines, compliance dates |

No `type` = default gray. Add custom types by defining `.milestone-line.your-type` and `.milestone-label.your-type` in your CSS.

### Program Milestones

Program milestones are trackless bars rendered above all tracks. They use the same `status` values as items. Use them for high-level phases like Alpha, Beta, GA.

```yaml
program_milestones:
  - label: "Alpha"
    start: 2025-12-01
    end: 2026-03-15
    status: completed
    actual:
      start: 2025-12-01
      end: 2026-03-10
  - label: "Beta"
    start: 2026-03-01
    end: 2026-08-31
    status: on-track
```

---

## View File (YAML)

The view file controls what to show and how to frame it. It references a data file and a style file.

### Structure

```yaml
# my-board-view.yaml

title: "Project Atlas — Engineering Schedule"

data: atlas-data.yaml        # Path to data file (relative to this file)
style: atlas-style.css       # Path to style file (relative to this file)

timeline:
  start: 2025-12-01          # Left edge of the timeline
  end: 2027-01-31            # Right edge of the timeline
  today: 2026-03-27          # Optional. Defaults to system date.
  granularity: month          # Only "month" supported in v1.

tracks: all                   # Show all tracks. Or a list:
# tracks:
#   - "Systems"
#   - "Infrastructure"

show_program_milestones: true # Default: true
show_legend: true             # Default: true
```

### View Fields

| Field | Required | Default | Description |
|-------|----------|---------|-------------|
| `title` | No | (none) | Chart title, top-left |
| `data` | No | (default example) | Path to data YAML file |
| `style` | No | (built-in defaults) | Path to style CSS file |
| `timeline.start` | No | Earliest date in data | Left edge |
| `timeline.end` | No | Latest date in data | Right edge |
| `timeline.today` | No | System date | Position of the "Today" line |
| `tracks` | No | `all` | `all` or a list of track names |
| `show_program_milestones` | No | `true` | Show/hide program milestone row |
| `show_legend` | No | `true` | Show/hide legend at bottom |

### Multiple Views from One Data File

Create multiple view files pointing to the same data:

```yaml
# board-view.yaml — Executive overview
title: "Engineering Schedule — Board"
data: schedule.yaml
style: corporate-style.css
tracks: all
```

```yaml
# systems-view.yaml — Deep dive for Systems team
title: "Systems Deep Dive"
data: schedule.yaml
style: corporate-style.css
tracks:
  - "Systems"
show_program_milestones: false
```

### URL Parameter Overrides

When served via HTTP, URL parameters override view file settings:

| Parameter | Example | Effect |
|-----------|---------|--------|
| `?data=` | `?data=q1-data.yaml` | Load different data file |
| `?view=` | `?view=deep-dive.yaml` | Load different view file |
| `?tracks=` | `?tracks=Systems,Infra` | Override track filter |

---

## Style File (CSS)

The style file controls the visual appearance of the rendered timeline. It uses CSS custom properties for easy theming.

### Quick Theming

To create a custom theme, copy `examples/atlas-style.css` and edit the custom properties at the top:

```css
.waypoint {
  /* Change these to re-theme the entire chart */
  --color-plan: #C8C8C8;
  --color-completed: #222222;
  --color-on-track: #2E8B2E;
  --color-moved-out: #CC3333;

  --font-family: -apple-system, "Helvetica Neue", Arial, sans-serif;

  --bar-height: 5px;
  --diamond-size: 15px;
  /* ... see atlas-style.css for all properties */
}
```

### Adding Custom Milestone Types

Define a CSS class for your type:

```css
/* In your style file */
.waypoint {
  --color-milestone-review: #9933CC;
}

.milestone-line.review {
  stroke: var(--color-milestone-review);
}

.milestone-label.review {
  fill: var(--color-milestone-review);
}
```

Then use `type: review` in your data YAML.

### Style Properties Reference

The default style (`atlas-style.css`) defines these custom property groups:

| Group | Properties | Controls |
|-------|-----------|----------|
| Status colors | `--color-plan`, `--color-completed`, `--color-on-track`, `--color-moved-out` | Bar fill colors |
| Diamond colors | `--color-*-diamond` | Diamond fill colors |
| Timeline markers | `--color-today`, `--color-milestone`, `--color-milestone-*` | Today line, milestone lines |
| Track chrome | `--color-track-bg`, `--color-track-border`, `--color-track-text` | Track gutter |
| Typography | `--font-family`, `--font-size-*` | All text |
| Dimensions | `--bar-height`, `--diamond-size`, `--lane-spacing`, etc. | Layout sizing |
| Strokes | `--today-stroke-width`, `--milestone-stroke-width` | Line thickness |

---

## For AI Agents

If you are an AI agent generating Waypoint YAML, follow these rules:

### Data File Rules

1. **Dates are YYYY-MM-DD strings.** No timestamps, no timezone info.
2. **Status must be one of four values:** `planned`, `on-track`, `completed`, `moved-out`. No other values.
3. **No colors or visual properties.** If you want a milestone to look different, set `type` — not a color.
4. **Every item needs:** `label`, `plan.start`, `plan.end`, `status`.
5. **`actual` dates are only for `completed` items.** If status is `completed` and you know the real dates, include `actual.start` and `actual.end`.
6. **`moved_to` is only for `moved-out` items.** It's the new end date the work slipped to.
7. **Track names must be unique.** Lane names should be unique within a track.
8. **Use `notes` for context.** Example: `notes: "Blocked by vendor API migration"`.

### View File Rules

1. **Always include `data` and `style` references** so the view is self-contained.
2. **`tracks: all`** shows everything. A list of strings filters to those track names.
3. **`timeline.today`** should be today's date or omitted (defaults to system date).
4. **Set `show_program_milestones: false`** for deep-dive views focused on a single track.

### Generating from Project Data

When generating a data file from project management tools:

```
Jira Epic       → Track
Jira Component  → Lane
Jira Issue      → Item
Sprint dates    → plan.start / plan.end
Resolution date → actual.end
```

Map issue statuses:
- "To Do", "Backlog" → `planned`
- "In Progress", "In Review" → `on-track`
- "Done", "Closed" → `completed`
- Items past their due date → `moved-out` with `moved_to` set to the new target

### Example: Minimal Valid Data File

```yaml
tracks:
  - name: "My Project"
    lanes:
      - name: "Phase 1"
        items:
          - label: "Design"
            plan:
              start: 2026-01-01
              end: 2026-02-15
            status: completed
            actual:
              start: 2026-01-01
              end: 2026-02-10
          - label: "Build"
            plan:
              start: 2026-02-15
              end: 2026-05-01
            status: on-track
```

### Example: Minimal Valid View File

```yaml
title: "My Project Schedule"
data: my-project-data.yaml
style: ../examples/atlas-style.css
timeline:
  start: 2026-01-01
  end: 2026-06-01
tracks: all
show_legend: true
```
