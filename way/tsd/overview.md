# Test Strategy Document: Waypoint

**Status**: Active
**Date**: 2026-03-27
**Authors**: Engineering
**Related**: CDD, PRD

## Purpose

This document defines the overall testing strategy for Waypoint. It describes what kinds of tests we write, what tools we use, and where the testing boundaries are. It does not list individual test cases.

---

## Testing Philosophy

Waypoint is a small, zero-dependency tool with a clear pipeline: YAML in → model → SVG out. The testing strategy mirrors this pipeline — test each stage independently, then verify the pipeline end-to-end.

Given the project's size, we favor:
- **Focused unit tests** for the YAML parser and model builder (where correctness is critical and bugs are subtle)
- **Snapshot/visual comparison** for SVG output (where "correct" is a visual judgment)
- **Manual verification** for interactions and export (where automation cost exceeds value in v1)

---

## Test Levels

### 1. Unit Tests — YAML Parser

**What**: The custom YAML parser (`yaml-parser.js`) is the highest-risk custom code. Unit tests ensure it correctly handles the supported YAML subset and produces helpful errors for unsupported or malformed input.

**Scope**:
- Scalar parsing: strings, numbers, booleans, null, dates
- Map parsing: simple and nested
- Array parsing: block sequences, arrays of maps
- Comments: inline and full-line
- Quoted strings: single and double quotes
- Edge cases: empty values, trailing whitespace, mixed indent
- Error cases: malformed indent, invalid YAML, unsupported features

**Approach**: Pure function tests — `parseYAML(input)` returns expected output or throws expected error. No DOM, no browser APIs needed.

**Tooling**: A lightweight test runner in a standalone HTML file (`tests/test-yaml-parser.html`) that runs in the browser and reports pass/fail to the console. No npm test framework — consistent with zero-dependency philosophy.

```javascript
// Test helper pattern
function assert(condition, message) {
  if (!condition) throw new Error(`FAIL: ${message}`);
  console.log(`PASS: ${message}`);
}

// Example test
const result = parseYAML('name: "hello"\ncount: 42');
assert(result.name === "hello", "parses quoted string");
assert(result.count === 42, "parses integer");
```

### 2. Unit Tests — Schedule Model Builder

**What**: Tests that `buildSchedule(dataObj, viewObj)` correctly merges data and view objects, applies track filtering, resolves defaults, and enforces invariants.

**Scope**:
- Track filtering: `tracks: all` vs. specific track list
- Default application: today defaults to system date, granularity defaults to month
- Date parsing: string dates from YAML become Date objects
- Status validation: invalid status values handled gracefully
- Missing optional fields: actual, moved_to, notes default correctly

**Approach**: Same in-browser test runner. Input is pre-parsed JavaScript objects (not YAML strings), so this layer tests model logic in isolation from parsing.

### 3. Rendering Verification — SVG Output

**What**: Verify that the rendered SVG contains the expected elements with correct attributes for a known input.

**Scope**:
- Correct number of tracks, lanes, and items rendered
- Bar positions correspond to date ranges (X coordinates)
- Diamond elements present at endpoints
- Status CSS classes applied correctly
- Today line positioned at the right X coordinate
- Milestone lines present at specified dates
- Legend rendered when enabled, hidden when disabled
- Program milestones rendered/hidden per view config

**Approach**: DOM-based assertions against the rendered SVG. Load a known data/view pair, render it, then query the SVG DOM for expected elements and attributes.

```javascript
const svg = render(schedule, container);
const bars = svg.querySelectorAll(".bar.on-track");
assert(bars.length === 5, "renders 5 on-track bars");
```

**Not tested via automation**: Pixel-perfect visual appearance. Visual correctness is verified manually against the reference image.

### 4. Manual Testing — Interactions and Export

**What**: Hover tooltips, PNG export, track zoom via URL parameters, file pickers.

**Approach**: Manual checklist run before each release. These interactions are thin layers over well-tested rendering code, and the cost of automating them (headless browser, image comparison) exceeds the value for v1.

**Manual checklist**:
- [ ] Hover over each status type → tooltip shows correct content
- [ ] Click PNG export → file downloads with correct name and content
- [ ] Load with `?tracks=Systems` → only Systems track renders
- [ ] Load with `?tracks=Systems,User` → both tracks render
- [ ] Load with `?data=` and `?view=` pointing to custom files → renders correctly
- [ ] Use file picker to load a different data file → re-renders
- [ ] "Show All" button after filtering → restores all tracks

---

## Test File Structure

```
waypoint/
└── tests/
    ├── test-runner.html         # Browser-based test runner (loads all test modules)
    ├── test-yaml-parser.js      # YAML parser unit tests
    ├── test-schedule-model.js   # Schedule model builder tests
    ├── test-rendering.js        # SVG DOM assertions
    └── fixtures/
        ├── simple-data.yaml     # Minimal test data
        ├── simple-view.yaml     # Minimal test view
        ├── edge-cases.yaml      # Edge case YAML for parser tests
        └── malformed.yaml       # Invalid YAML for error tests
```

---

## Test Tooling

- **No external dependencies**: Tests run in the browser using a minimal custom assertion library
- **Test runner**: A single HTML page that imports test modules and runs them sequentially
- **Console output**: Pass/fail results logged to the browser console
- **CI**: Not needed for v1. Tests are run manually by opening `tests/test-runner.html` in a browser

---

## What We Don't Test

- **Visual pixel accuracy**: Verified manually against reference image. Automated screenshot comparison (e.g., Playwright) is overkill for v1.
- **Cross-browser rendering**: Verified manually in Chrome and Safari. Firefox is a stretch goal.
- **Performance**: Not a concern for v1 data sizes (~20-50 items). If performance becomes relevant (large schedules), add benchmarks later.
- **CSS styling**: Visual styling correctness is verified manually. We test that the right CSS classes are applied, not that the CSS produces the right pixels.

---

## When to Run Tests

- After changes to `yaml-parser.js` → run parser tests
- After changes to `waypoint.js` model/rendering code → run model and rendering tests
- Before any release or demo → run full test suite + manual checklist

---

## Deviation Tracking

| Date | Area | Planned | Actual | Reason |
|------|------|---------|--------|--------|
| | | | | |
