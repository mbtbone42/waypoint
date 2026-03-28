# ADR-001: YAML Parser Approach

**Status**: Accepted
**Date**: 2026-03-26
**Authors**: Engineering
**Related**: DDD-001

## Context

Waypoint needs to parse YAML files (data and view configurations) in the browser. The project has a hard constraint of zero external dependencies — no npm packages, no CDN imports. We need a YAML parser that handles the subset of YAML used by Waypoint: maps, arrays, scalars (strings, numbers, booleans), dates, and multi-line strings.

Full YAML 1.2 specification support is unnecessary. Waypoint YAML files use a predictable, human-authored subset: nested maps, arrays of maps, quoted and unquoted strings, ISO dates, numbers, and booleans.

## Decision

Write a minimal, custom YAML parser in vanilla JavaScript that handles only the subset of YAML features used by Waypoint data and view files.

## Rationale

### Alternatives Considered

1. **Vendor js-yaml (full library)**
   - Pros: Complete YAML 1.2 support, battle-tested, handles edge cases
   - Cons: ~60KB minified, significant code for a subset of features, vendoring a large file feels heavy for a zero-dependency project

2. **Vendor a minimal YAML parser (e.g., tiny-yaml or similar)**
   - Pros: Smaller than js-yaml, already written
   - Cons: Still an external dependency (vendored), may not exist at the right size/feature intersection, maintenance burden of tracking upstream

3. **Custom subset parser (chosen)**
   - Pros: Exactly the features needed (~200-400 lines), zero vendored code, fully understood by the team, easy to extend if YAML needs grow
   - Cons: Must be tested carefully, doesn't handle exotic YAML (anchors, aliases, flow sequences, multi-document)

### Why This Choice

The YAML subset Waypoint uses is small and well-defined. A custom parser keeps the codebase self-contained and avoids carrying dead code for features that will never be used. The parsing logic is straightforward for this subset:
- Indentation-based nesting (maps and arrays)
- `key: value` pairs with string, number, boolean, and date scalars
- `- item` array syntax
- Quoted strings (single and double)
- Comments (`#`)

If future requirements demand full YAML support, this decision can be revisited and the custom parser replaced with a vendored library.

## Consequences

### Positive

- True zero-dependency project — no vendored files, no external code
- Parser is small, readable, and purpose-built
- Easy to debug since every line is project code
- File size stays minimal

### Negative

- Must write and maintain parser code ourselves
- Won't handle exotic YAML features (anchors, aliases, flow mappings/sequences, multi-document streams)
- Users who write advanced YAML may hit parser limitations

### Risks

- **Risk**: Parser bugs on edge cases in user-authored YAML. **Mitigation**: Clear documentation of supported YAML subset; test against example files and common authoring patterns.
- **Risk**: Future need for full YAML support. **Mitigation**: Parser is isolated in `yaml-parser.js` and can be swapped for a vendored library without changing the rest of the codebase.

## Implementation Notes

- Parser lives in `yaml-parser.js` as a standalone ES module
- Exports a single `parseYAML(text)` function returning a JavaScript object
- Supported features: maps, arrays, scalars (string, number, boolean, null), ISO dates (YYYY-MM-DD), comments, quoted strings
- Unsupported: anchors/aliases, flow collections, multi-document, tags, complex keys
- Include clear error messages with line numbers for malformed input

## References

- [YAML 1.2 Specification](https://yaml.org/spec/1.2.2/)
- PRD: [overview.md](../prd/overview.md)
