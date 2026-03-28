# ADR-006: Universal Tooltips on All Visual Objects

**Status**: Accepted
**Date**: 2026-03-28
**Authors**: Engineering
**Related**: ADR-002, DDD-001, CDD

## Context

Waypoint v1 shipped with hover tooltips on item bars, showing label, plan dates, actual dates, status, and notes. In production use, stakeholders found the notes field valuable for understanding context — why something slipped, what's blocking progress.

The same need exists for every other visual object in the chart:
- **Tracks**: Abbreviated names in the gutter (e.g., "Infra") need expanded descriptions. Teams need context on what a track contains.
- **Program milestones**: Phases like "Beta" benefit from tooltip context explaining objectives or scope.
- **Milestones**: Vertical date lines like "Feature Freeze" need to show the exact date (not always obvious from the line position) and any additional context.

## Decision

Add an optional `notes` field to tracks, program milestones, and milestones in the data YAML schema. Add hover tooltips to track labels, program milestone bars, and milestone labels, showing relevant details plus notes.

## Rationale

### Alternatives Considered

1. **Keep tooltips on items only**
   - Pros: Less code, simpler
   - Cons: Misses the most common request — "what does this track mean?" and "what's the exact date on that milestone?"

2. **Add a side panel or legend with descriptions**
   - Pros: Always visible, no hover needed
   - Cons: Consumes chart real estate, violates the "density-to-clarity" design principle, doesn't scale well

3. **Universal tooltips on all objects (chosen)**
   - Pros: Progressive disclosure — clean chart by default, details on demand. Consistent interaction pattern. No additional screen space consumed.
   - Cons: More tooltip code to maintain

### Why This Choice

Tooltips are the right interaction for a communication tool: the chart stays clean for the 90% case (glancing at the timeline), and details are available on demand for the 10% case (understanding what something means). The `notes` field is optional, so existing YAML files work unchanged.

## Consequences

### Positive

- Every visual object can carry contextual information
- Track labels can be short for display while carrying full descriptions in notes
- Milestone exact dates are discoverable on hover
- Consistent hover-for-details pattern across the entire chart
- Optional field — no breaking changes to existing data files

### Negative

- More tooltip rendering code
- `notes` field added to three more schema locations (minor YAML expansion)
- Tooltip positioning must work for rotated track labels, above-header milestone labels, and standard bars

### Risks

- **Risk**: Tooltip obscures important chart elements. **Mitigation**: Position tooltips to avoid overlapping the hovered element; use the same dark-background style for consistency and readability.

## Implementation Notes

### Tooltip Content by Object Type

| Object | Tooltip Shows |
|--------|--------------|
| Track label | Track name, notes |
| Program milestone | Label, date range, status, notes |
| Milestone label | Label, exact date, notes |
| Item bar | Label, plan dates, actual dates, status, notes |

### Data Schema Additions

```yaml
# Tracks gain notes
tracks:
  - name: "Infrastructure"
    notes: "Cloud, CI/CD, monitoring, and security"
    lanes: [...]

# Program milestones gain notes
program_milestones:
  - label: "Beta"
    start: 2026-03-01
    end: 2026-08-31
    status: on-track
    notes: "Core platform stability and feature completion"

# Milestones gain notes
milestones:
  - date: 2026-06-15
    label: "Feature Freeze"
    type: freeze
    notes: "All features must be merged by EOD"
```

## References

- PRD: [overview.md](../prd/overview.md) — Hover section updated
- CDD: [overview.md](../cdd/overview.md) — Data structures and tooltip section updated
- DDD: [DDD-001](../ddd/DDD-001-schedule-visualization.md)
