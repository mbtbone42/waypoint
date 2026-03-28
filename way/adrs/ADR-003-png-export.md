# ADR-003: PNG Export Method

**Status**: Accepted
**Date**: 2026-03-26
**Authors**: Engineering
**Related**: ADR-002, DDD-001

## Context

Waypoint's primary use case is producing timeline images for slide decks and presentations. Users need to export the rendered SVG as a PNG file they can paste into Google Slides, Keynote, or PowerPoint. The export must be high quality, match what's on screen, and exclude UI chrome (like the export button itself).

## Decision

Use the standard SVG-to-Canvas-to-PNG pipeline: serialize the SVG to a data URL, draw it onto a hidden `<canvas>` element, and trigger a download of the canvas content as a PNG.

## Rationale

### Alternatives Considered

1. **Server-side rendering (e.g., Puppeteer/Playwright)**
   - Pros: Pixel-perfect, handles fonts reliably
   - Cons: Requires a server, adds infrastructure, violates zero-dependency constraint

2. **SVG download (export as .svg file)**
   - Pros: Trivially simple, vector output
   - Cons: SVG support in slide tools is inconsistent; users specifically need PNG for universal compatibility

3. **Canvas-based export from SVG serialization (chosen)**
   - Pros: Works entirely in-browser, no server needed, produces PNG at configurable resolution, well-supported across browsers
   - Cons: Font rendering may differ slightly from SVG, must inline all styles

### Why This Choice

Browser-native SVG-to-Canvas export is the standard approach for client-side PNG generation. It requires no server infrastructure, works offline, and produces good results when styles are inlined. Since Waypoint uses programmatic SVG (no external CSS, no external fonts), the serialization is straightforward.

## Consequences

### Positive

- Fully client-side, works offline
- No server infrastructure needed
- Configurable output resolution (2x for Retina/4K)
- Standard browser APIs, no polyfills needed

### Negative

- Must inline all SVG styles (no external CSS references)
- Canvas text rendering may differ slightly from SVG
- Large SVGs may hit canvas size limits on some browsers

### Risks

- **Risk**: Cross-origin issues if YAML files are loaded from a different domain. **Mitigation**: Waypoint is designed for same-origin or local file usage.
- **Risk**: Export button appears in exported image. **Mitigation**: Export button is rendered outside the SVG element (in HTML), not inside it.

## Implementation Notes

### Export Pipeline

```javascript
function exportPNG(svgElement, filename) {
  // 1. Clone SVG and inline computed styles
  const clone = svgElement.cloneNode(true);

  // 2. Serialize to XML string
  const serializer = new XMLSerializer();
  const svgString = serializer.serializeToString(clone);

  // 3. Create data URL
  const dataUrl = 'data:image/svg+xml;charset=utf-8,'
    + encodeURIComponent(svgString);

  // 4. Draw to canvas at 2x resolution
  const canvas = document.createElement('canvas');
  const scale = 2; // Retina quality
  canvas.width = svgElement.viewBox.baseVal.width * scale;
  canvas.height = svgElement.viewBox.baseVal.height * scale;

  const ctx = canvas.getContext('2d');
  const img = new Image();
  img.onload = () => {
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

    // 5. Trigger download
    const link = document.createElement('a');
    link.download = filename;
    link.href = canvas.toDataURL('image/png');
    link.click();
  };
  img.src = dataUrl;
}
```

### Filename Convention

`{title-slugified}-{YYYY-MM-DD}.png`

Example: `project-atlas-engineering-schedule-2026-03-26.png`

### Resolution

Default export at 2x scale for crisp output on Retina displays and when embedded in presentations projected on large screens.

## References

- [MDN: XMLSerializer](https://developer.mozilla.org/en-US/docs/Web/API/XMLSerializer)
- [MDN: Canvas API](https://developer.mozilla.org/en-US/docs/Web/API/Canvas_API)
- PRD: [overview.md](../prd/overview.md)
- SVG Layout: [ADR-002](ADR-002-svg-layout.md)
