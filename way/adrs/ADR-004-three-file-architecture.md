# ADR-004: Three-File Architecture (Data / Style / View)

**Status**: Accepted
**Date**: 2026-03-27
**Authors**: Engineering
**Related**: ADR-001, ADR-002, DDD-001

## Context

The original design used a two-file architecture: a data YAML file (schedule content) and a view YAML file (presentation configuration including date range, track filtering, and visual settings like colors). During design review, it became clear that visual styling (fonts, colors, bar dimensions) is a distinct concern from view configuration (what to show, date range, zoom level).

Mixing style into the view file creates two problems:
1. Style choices must be duplicated across every view file that wants the same look
2. View files become cluttered with concerns that don't change between views

## Decision

Split the architecture into three files:

1. **Data file** (`.yaml`) — Schedule content: tracks, lanes, items, milestones. "Just the facts."
2. **Style file** (`.css`) — Visual appearance: fonts, colors, bar dimensions, spacing. "How it looks."
3. **View file** (`.yaml`) — Presentation scope: date range, track filter, today override, title. "What to show right now."

Style is implemented as CSS rather than YAML because CSS is the native styling language for SVG.

## Rationale

### Alternatives Considered

1. **Keep two-file (data + view with embedded style)**
   - Pros: Fewer files to manage
   - Cons: Style duplicated across views, view files become bloated, mixing concerns

2. **Three-file with style as YAML**
   - Pros: Consistent file format, parsed by the same YAML parser
   - Cons: Must translate YAML keys to CSS properties (extra mapping layer), can't use CSS features like selectors or media queries, not inspectable in DevTools

3. **Three-file with style as CSS (chosen)**
   - Pros: CSS maps directly to SVG styling properties (fill, stroke, font-family), DevTools-inspectable, swappable, no translation layer, industry-standard
   - Cons: Users need basic CSS knowledge (mitigated by providing a well-commented default)

### Why This Choice

CSS is the right tool for SVG styling. The properties Waypoint needs — `fill`, `stroke`, `stroke-width`, `font-family`, `font-size` — are native CSS/SVG properties. Using CSS means:
- No custom mapping layer between a YAML schema and actual SVG attributes
- DevTools can inspect and live-edit styles on the rendered SVG
- A designer can tweak the look without touching data or view logic
- CSS custom properties (`--var`) provide clean theming
- The style file can be shared across views and even across projects

## Consequences

### Positive

- Clean separation: data (what), style (how it looks), view (what to show)
- Style reuse across multiple views without duplication
- CSS custom properties enable easy theming (swap `--color-on-track` and the whole chart updates)
- Browser DevTools integration for style debugging
- Future: dark mode is just an alternate CSS file

### Negative

- Three files instead of two to manage
- Users must understand basic CSS (mitigated by a well-commented default file)
- CSS must be loaded and applied to the SVG (minor implementation detail)

### Risks

- **Risk**: Users unfamiliar with CSS struggle to customize. **Mitigation**: Ship a default style file with clear comments and CSS custom properties for the most common tweaks.
- **Risk**: CSS specificity issues if multiple stylesheets are loaded. **Mitigation**: Use CSS custom properties on a root element; avoid deep selectors.

## Implementation Notes

### CSS Custom Properties Pattern

The style file defines variables on `.waypoint` (the SVG root class), and element styles reference them:

```css
.waypoint {
  --color-plan: #C8C8C8;
  --color-completed: #222222;
  --color-on-track: #2E8B2E;
  --color-moved-out: #CC3333;
  --font-family: -apple-system, "Helvetica Neue", Arial, sans-serif;
  --bar-height: 16px;
  /* ... */
}

.bar.plan { fill: var(--color-plan); }
.bar.on-track { fill: var(--color-on-track); }
```

### Loading Order

1. Parse data YAML → schedule model
2. Parse view YAML → view configuration
3. Load CSS → inject as `<style>` in the SVG or document
4. Render SVG using model + view + CSS

### View YAML References Style

The view file can optionally specify which style file to use:

```yaml
style: atlas-style.css    # optional; defaults to waypoint-default.css
```

### File Structure Update

```
waypoint/
├── examples/
│   ├── atlas-data.yaml       # Schedule content
│   ├── atlas-style.css       # Visual appearance
│   ├── atlas-board.yaml      # Board-level view
│   └── atlas-systems.yaml    # Systems deep-dive view
```

## References

- PRD: [overview.md](../prd/overview.md)
- SVG Layout: [ADR-002](ADR-002-svg-layout.md)
- Domain Model: [DDD-001](../ddd/DDD-001-schedule-visualization.md)
