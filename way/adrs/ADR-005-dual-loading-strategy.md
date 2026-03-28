# ADR-005: Dual Loading Strategy (file:// and HTTP)

**Status**: Accepted
**Date**: 2026-03-27
**Authors**: Engineering
**Related**: ADR-001, ADR-004, CDD

## Context

Waypoint needs to work in two deployment scenarios:

1. **HTTP serving**: Hosted on a static file server (local dev server, S3, GitHub Pages, etc.) where `fetch()` works normally and URL parameters are available
2. **Local file**: User double-clicks `index.html` to open it directly in a browser via `file://` protocol — no server involved

The `file://` scenario is important for quick, low-friction use: generate some YAML, double-click the HTML file, see the timeline. However, browsers block `fetch()` on `file://` URLs due to same-origin policy, so the standard fetch-based loading pipeline fails silently.

## Decision

Implement a dual loading strategy:

1. **Embed default examples** directly in `index.html` as `<script type="text/yaml">` and `<style>` blocks, so the tool renders immediately on `file://` with no fetch required
2. **Provide file pickers and drag-and-drop** as the `file://` mechanism for loading custom files, using `FileReader` API which is not subject to CORS restrictions
3. **Detect protocol at init** and adapt behavior: HTTP mode uses `fetch()` with URL parameters; file mode uses embedded defaults and file picker UI

## Rationale

### Alternatives Considered

1. **Require a local server (e.g., `python -m http.server`)**
   - Pros: Simplest implementation, `fetch()` just works
   - Cons: Friction — forces a terminal command before viewing. Non-technical users (the target audience includes executives receiving a YAML file) can't use it without instructions

2. **Use XMLHttpRequest instead of fetch (some browsers are more permissive)**
   - Pros: Might work in some browser/OS configurations
   - Cons: Unreliable, browser-dependent, deprecated direction. Not a real solution

3. **Generate a single self-contained HTML file per rendering**
   - Pros: Always works, single file to share
   - Cons: Changes the architecture significantly, loses the data/style/view separation, becomes a build step

4. **Dual loading: embedded defaults + file pickers (chosen)**
   - Pros: Works everywhere, no server needed for basics, file picker handles custom data, preserves three-file architecture for HTTP deployments
   - Cons: Default examples are duplicated (in `examples/` directory and embedded in HTML)

### Why This Choice

The embedded defaults give "double-click and it works" for the common case (demo, quick look). File pickers and drag-drop give full functionality on `file://` for custom data. HTTP mode unlocks the full URL-parameter workflow for deployed scenarios. The duplication of default examples is a small cost for universal accessibility.

## Consequences

### Positive

- Tool works immediately when double-clicking `index.html` — zero friction
- No server requirement for basic usage
- File pickers work in both modes, giving a consistent interaction path
- Drag-and-drop provides a fast workflow: drag YAML onto the page, see the timeline
- HTTP mode retains full URL-parameter support for bookmarkable views

### Negative

- Default example content is duplicated: once in `examples/` directory (for reference and HTTP loading), once embedded in `index.html` (for file:// loading)
- `index.html` is larger due to embedded content (~10-15KB of YAML/CSS)
- Two code paths for loading (fetch vs. embedded/FileReader) must both be tested

### Risks

- **Risk**: Embedded defaults drift out of sync with `examples/` files. **Mitigation**: Document this as a maintenance step; consider a simple copy script if it becomes a problem.
- **Risk**: Large embedded content makes `index.html` unwieldy. **Mitigation**: The YAML and CSS are small (~200 lines total). If they grow significantly, revisit.

## Implementation Notes

### Protocol Detection

```javascript
const isLocal = window.location.protocol === "file:";
```

### Embedded Content Format

```html
<!-- Embedded defaults for file:// support -->
<script id="default-data" type="text/yaml">
  # Content of atlas-data.yaml
</script>

<script id="default-view" type="text/yaml">
  # Content of atlas-board.yaml
</script>

<style id="default-style">
  /* Content of atlas-style.css */
</style>
```

`type="text/yaml"` prevents the browser from executing the script content. JavaScript reads it via `document.getElementById("default-data").textContent`.

### File Picker / Drag-and-Drop

```javascript
// File picker
input.addEventListener("change", (e) => {
  const reader = new FileReader();
  reader.onload = () => {
    const obj = parseYAML(reader.result);
    // re-render with new data
  };
  reader.readAsText(e.target.files[0]);
});

// Drag-and-drop
container.addEventListener("drop", (e) => {
  e.preventDefault();
  for (const file of e.dataTransfer.files) {
    const reader = new FileReader();
    reader.onload = () => { /* parse and re-render */ };
    reader.readAsText(file);
  }
});
```

### Loading Priority

1. Drag-and-drop (highest — always overrides)
2. File picker selections
3. URL parameters (HTTP mode only)
4. Embedded defaults (fallback)

## References

- CDD: [overview.md](../cdd/overview.md) — Dual Loading Strategy section
- PRD: [overview.md](../prd/overview.md)
- Three-File Architecture: [ADR-004](ADR-004-three-file-architecture.md)
