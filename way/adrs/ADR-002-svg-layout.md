# ADR-002: SVG Layout Algorithm

**Status**: Accepted
**Date**: 2026-03-26
**Authors**: Engineering
**Related**: ADR-001, DDD-001

## Context

Waypoint renders schedule timelines as SVG in the browser. The layout must faithfully reproduce the visual language of the reference design: horizontal bars with diamond endpoints, vertically-labeled track groups with rounded borders, a timeline header, today line, and a legend. The output must be clean enough for executive presentations and crisp at any zoom level.

We need to decide on the SVG construction approach and layout algorithm.

## Decision

Use a coordinate-based SVG layout built programmatically in vanilla JavaScript via `document.createElementNS`. Layout is computed in a single top-down pass with fixed dimensions for bar height, lane spacing, and track gutter width. The SVG uses a `viewBox` for resolution-independent scaling.

## Rationale

### Alternatives Considered

1. **HTML/CSS layout with embedded SVG for bars only**
   - Pros: Easier text layout, CSS flexbox/grid for structure
   - Cons: Mixed DOM makes PNG export harder, less control over precise positioning, harder to get pixel-perfect presentation output

2. **Canvas rendering**
   - Pros: Fast rendering, straightforward PNG export (canvas.toDataURL)
   - Cons: Not resolution-independent, blurry on high-DPI displays, text rendering is inferior, can't inspect elements

3. **Full SVG with programmatic coordinate layout (chosen)**
   - Pros: Resolution-independent (viewBox), crisp at any size, clean PNG export via serialization, inspectable DOM, precise control over every element
   - Cons: Must manually compute all positions, text measurement requires care

### Why This Choice

SVG is the natural fit for a presentation-quality visualization tool. The viewBox mechanism gives resolution independence for free. The reference image demands precise control over bar thickness, diamond size, and spacing — all easier with direct coordinate math than CSS layout. PNG export from SVG is well-supported via canvas serialization.

## Consequences

### Positive

- Crisp rendering at any zoom/DPI
- Full control over element positioning, sizing, and styling
- Clean DOM structure that can be inspected and debugged
- SVG serialization enables straightforward PNG export

### Negative

- All positioning is manual — no layout engine to fall back on
- Text measurement in SVG requires getBBox() or estimation
- Must handle viewBox/aspect ratio correctly for different data sizes

### Risks

- **Risk**: Complex layouts with many lanes overflow the viewBox. **Mitigation**: viewBox height scales dynamically based on lane count.
- **Risk**: Text labels overlap or clip. **Mitigation**: Labels positioned at bar start with consistent offsets; long labels can be truncated with ellipsis.

## Implementation Notes

### Layout Constants

```
GUTTER_WIDTH       = 80px    # Track label column
HEADER_HEIGHT      = 40px    # Timeline month/year header
PROGRAM_MS_HEIGHT  = 30px    # Program milestones row
BAR_HEIGHT         = 16px    # Individual bar height
LANE_SPACING       = 28px    # Vertical space per lane (bar + gap)
TRACK_PADDING      = 12px    # Vertical padding within track group
TRACK_GAP          = 16px    # Space between track groups
DIAMOND_SIZE       = 10px    # Diamond width/height
CHART_WIDTH        = 1300px  # Total viewBox width
```

### Layout Pass (Top-Down)

1. **Header row**: Render month labels across timeline width
2. **Program milestones row** (if enabled): Render trackless bars below header
3. **For each visible track**:
   - Compute track height = (lane count * LANE_SPACING) + TRACK_PADDING
   - Render track label (rotated 90deg) in gutter with rounded-rect background
   - For each lane, render items as layered bars (plan gray underneath, status overlay on top)
   - Render diamond at bar endpoint
4. **Today line**: Vertical dashed line from header to bottom
5. **Milestone lines**: Vertical lines at specified dates
6. **Legend row**: Status examples at bottom

### Bar Rendering (per item)

Each item renders as layers:
1. **Plan bar** (gray): Full width from plan.start to plan.end
2. **Status overlay**: Colored bar on top based on status type
3. **Diamond**: At the status-appropriate endpoint
4. **Label**: Text positioned above or at the start of the bar

### SVG Structure

```xml
<svg viewBox="0 0 {width} {height}">
  <g class="header">...</g>
  <g class="program-milestones">...</g>
  <g class="tracks">
    <g class="track" data-track="User">
      <rect class="track-bg" />
      <text class="track-label" />
      <g class="lane">
        <rect class="bar plan" />
        <rect class="bar status" />
        <polygon class="diamond" />
        <text class="bar-label" />
      </g>
    </g>
  </g>
  <line class="today-line" />
  <g class="milestones">...</g>
  <g class="legend">...</g>
</svg>
```

### Color Reference

Per PRD color palette — see PRD Rendering Specification section.

### Coordinate Mapping

Date-to-X conversion: linear interpolation from timeline.start to timeline.end across the chart width (minus gutter).

```javascript
function dateToX(date, timelineStart, timelineEnd, chartLeft, chartRight) {
  const totalDays = daysBetween(timelineStart, timelineEnd);
  const elapsed = daysBetween(timelineStart, date);
  return chartLeft + (elapsed / totalDays) * (chartRight - chartLeft);
}
```

## References

- Reference image: provided by stakeholder (board meeting timeline format)
- PRD: [overview.md](../prd/overview.md)
- PNG Export: [ADR-003](ADR-003-png-export.md)
