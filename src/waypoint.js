// waypoint.js — Core rendering engine for Waypoint
// Loads data/style/view files, builds schedule model, renders SVG

import { parseYAML } from './yaml-parser.js';
import { exportPNG } from './export.js';

// ============================================================
// Layout constants (defaults — CSS custom properties can override)
// ============================================================

const DEFAULTS = {
  GUTTER_WIDTH: 55,
  HEADER_HEIGHT: 30,
  PROGRAM_MS_HEIGHT: 24,
  BAR_HEIGHT: 5,
  LANE_SPACING: 22,
  TRACK_PADDING: 10,
  TRACK_GAP: 12,
  DIAMOND_SIZE: 15,
  CHART_WIDTH: 1300,
  TITLE_HEIGHT: 36,
  HEADER_PM_GAP: 6,
  LEGEND_HEIGHT: 36,
};

// ============================================================
// SVG namespace helper
// ============================================================

const SVG_NS = 'http://www.w3.org/2000/svg';

function svgEl(tag, attrs) {
  const el = document.createElementNS(SVG_NS, tag);
  if (attrs) {
    for (const [k, v] of Object.entries(attrs)) {
      el.setAttribute(k, v);
    }
  }
  return el;
}

// ============================================================
// Date helpers
// ============================================================

function toDate(val) {
  if (val instanceof Date) return val;
  if (typeof val === 'string') {
    // YYYY-MM-DD — parse as local date (not UTC)
    const parts = val.split('-');
    return new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
  }
  return null;
}

function daysBetween(a, b) {
  return (b - a) / (1000 * 60 * 60 * 24);
}

function dateToX(date, timelineStart, timelineEnd, chartLeft, chartRight) {
  const totalMs = timelineEnd - timelineStart;
  const elapsedMs = date - timelineStart;
  return chartLeft + (elapsedMs / totalMs) * (chartRight - chartLeft);
}

function formatMonth(date) {
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return months[date.getMonth()];
}

function formatDate(date) {
  if (!date) return '';
  const m = date.getMonth() + 1;
  const d = date.getDate();
  const y = date.getFullYear();
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

// ============================================================
// Schedule model builder
// ============================================================

export function buildSchedule(dataObj, viewObj) {
  const tracks = dataObj.tracks || [];
  const viewTracks = viewObj.tracks;

  // Filter tracks if view specifies a list
  let filteredTracks = tracks;
  if (viewTracks && viewTracks !== 'all') {
    const trackNames = Array.isArray(viewTracks) ? viewTracks : [viewTracks];
    filteredTracks = tracks.filter(t => trackNames.includes(t.name));
  }

  // Build the timeline
  const tl = viewObj.timeline || {};
  const today = tl.today ? toDate(tl.today) : new Date();
  const start = tl.start ? toDate(tl.start) : computeEarliestDate(dataObj);
  const end = tl.end ? toDate(tl.end) : computeLatestDate(dataObj);

  // Build schedule model with dates converted
  return {
    title: viewObj.title || '',
    description: viewObj.description || null,
    timeline: { start, end, today, granularity: tl.granularity || 'month' },
    programMilestones: (dataObj.program_milestones || []).map(pm => ({
      label: pm.label,
      start: toDate(pm.start),
      end: toDate(pm.end),
      status: validateStatus(pm.status),
      actual: pm.actual ? { start: toDate(pm.actual.start), end: toDate(pm.actual.end) } : null,
      movedTo: pm.moved_to ? toDate(pm.moved_to) : null,
      notes: pm.notes || null,
      link: pm.link || null,
    })),
    milestones: (dataObj.milestones || []).map(m => ({
      date: toDate(m.date),
      label: m.label,
      type: m.type || null,
      notes: m.notes || null,
      link: m.link || null,
    })),
    tracks: filteredTracks.map(t => ({
      name: t.name,
      notes: t.notes || null,
      link: t.link || null,
      lanes: (t.lanes || []).map(l => ({
        name: l.name,
        items: (l.items || []).map(item => ({
          label: item.label,
          plan: { start: toDate(item.plan.start), end: toDate(item.plan.end) },
          status: validateStatus(item.status),
          actual: item.actual ? { start: toDate(item.actual.start), end: toDate(item.actual.end) } : null,
          movedTo: item.moved_to ? toDate(item.moved_to) : null,
          notes: item.notes || null,
          link: item.link || null,
        })),
      })),
    })),
    showProgramMilestones: viewObj.show_program_milestones !== false,
    showLegend: viewObj.show_legend !== false,
    legendDescriptions: {
      plan: (viewObj.legend_descriptions && viewObj.legend_descriptions.plan) || 'Scheduled work that has not yet started',
      completed: (viewObj.legend_descriptions && viewObj.legend_descriptions.completed) || 'Work that has been finished',
      'on-track': (viewObj.legend_descriptions && viewObj.legend_descriptions['on-track']) || 'Work in progress, proceeding as planned',
      'moved-out': (viewObj.legend_descriptions && viewObj.legend_descriptions['moved-out']) || 'Work that has slipped past its original target date',
    },
  };
}

function validateStatus(status) {
  const valid = ['planned', 'on-track', 'completed', 'moved-out'];
  if (valid.includes(status)) return status;
  console.warn(`Invalid status "${status}", treating as "planned"`);
  return 'planned';
}

function computeEarliestDate(dataObj) {
  let earliest = new Date();
  for (const t of (dataObj.tracks || [])) {
    for (const l of (t.lanes || [])) {
      for (const item of (l.items || [])) {
        const d = toDate(item.plan.start);
        if (d && d < earliest) earliest = d;
      }
    }
  }
  return earliest;
}

function computeLatestDate(dataObj) {
  let latest = new Date();
  for (const t of (dataObj.tracks || [])) {
    for (const l of (t.lanes || [])) {
      for (const item of (l.items || [])) {
        const d = toDate(item.plan.end);
        if (d && d > latest) latest = d;
        if (item.moved_to) {
          const mt = toDate(item.moved_to);
          if (mt && mt > latest) latest = mt;
        }
      }
    }
  }
  return latest;
}

// ============================================================
// Layout computation
// ============================================================

function computeLayout(schedule, C) {
  let y = C.TITLE_HEIGHT;

  // Header
  const headerY = y;
  y += C.HEADER_HEIGHT;

  // Program milestones
  let pmY = null;
  if (schedule.showProgramMilestones && schedule.programMilestones.length > 0) {
    y += C.HEADER_PM_GAP;
    pmY = y;
    y += C.PROGRAM_MS_HEIGHT;
  }

  // Tracks
  const trackLayouts = [];
  for (const track of schedule.tracks) {
    const laneCount = track.lanes.length;
    const trackHeight = laneCount * C.LANE_SPACING + C.TRACK_PADDING * 2;
    trackLayouts.push({
      track,
      y: y,
      height: trackHeight,
      laneCount,
    });
    y += trackHeight + C.TRACK_GAP;
  }

  // Legend
  let legendY = null;
  if (schedule.showLegend) {
    legendY = y;
    y += C.LEGEND_HEIGHT;
  }

  const totalHeight = y + 10; // bottom padding

  return {
    headerY,
    pmY,
    trackLayouts,
    legendY,
    totalHeight,
    chartLeft: C.GUTTER_WIDTH,
    chartRight: C.CHART_WIDTH - 20, // right padding
  };
}

// ============================================================
// SVG rendering
// ============================================================

export function render(schedule, container) {
  const C = { ...DEFAULTS };

  // Clear container
  container.innerHTML = '';

  const layout = computeLayout(schedule, C);

  const svg = svgEl('svg', {
    class: 'waypoint',
    viewBox: `0 0 ${C.CHART_WIDTH} ${layout.totalHeight}`,
    xmlns: SVG_NS,
    width: '100%',
  });

  // Background
  svg.appendChild(svgEl('rect', {
    x: 0, y: 0, width: C.CHART_WIDTH, height: layout.totalHeight,
    fill: 'white', class: 'chart-bg',
  }));

  // Title
  if (schedule.title) {
    const titleText = svgEl('text', {
      x: C.GUTTER_WIDTH, y: C.TITLE_HEIGHT - 12,
      class: 'chart-title',
    });
    titleText.textContent = schedule.title;
    svg.appendChild(titleText);

    if (schedule.description) {
      const hitArea = svgEl('rect', {
        x: C.GUTTER_WIDTH, y: 0,
        width: schedule.title.length * 10 + 20, height: C.TITLE_HEIGHT,
        fill: 'transparent', class: 'hit-area',
      });
      hitArea.style.cursor = 'pointer';
      attachTooltipLines(hitArea, [schedule.title, schedule.description]);
      svg.appendChild(hitArea);
    }
  }

  // Grid lines (behind everything)
  renderGridLines(svg, schedule, layout, C);

  // Header
  renderHeader(svg, schedule, layout, C);

  // Program milestones
  if (layout.pmY !== null) {
    renderProgramMilestones(svg, schedule, layout, C);
  }

  // Tracks — multi-pass rendering for proper z-order
  // Pass 1: Track backgrounds and labels
  for (const tl of layout.trackLayouts) {
    renderTrackChrome(svg, tl, C);
  }
  // Pass 2: All plan bars (gray, bottom layer)
  for (const tl of layout.trackLayouts) {
    renderTrackBars(svg, tl, schedule, layout, C, 'plan');
  }
  // Pass 3: Completed overlays
  for (const tl of layout.trackLayouts) {
    renderTrackBars(svg, tl, schedule, layout, C, 'completed');
  }
  // Pass 4: On-track overlays
  for (const tl of layout.trackLayouts) {
    renderTrackBars(svg, tl, schedule, layout, C, 'on-track');
  }
  // Pass 5: Moved-out overlays (red on top)
  for (const tl of layout.trackLayouts) {
    renderTrackBars(svg, tl, schedule, layout, C, 'moved-out');
  }
  // Pass 6: Labels (on top of all bars)
  for (const tl of layout.trackLayouts) {
    renderTrackLabels(svg, tl, schedule, layout, C);
  }

  // Today line
  renderTodayLine(svg, schedule, layout, C);

  // Milestone lines
  renderMilestoneLines(svg, schedule, layout, C);

  // Legend
  if (layout.legendY !== null) {
    renderLegend(svg, schedule, layout, C);
  }

  container.appendChild(svg);
  return svg;
}

// ============================================================
// Render components
// ============================================================

function renderGridLines(svg, schedule, layout, C) {
  const { start, end } = schedule.timeline;
  const { chartLeft, chartRight, totalHeight } = layout;

  const d = new Date(start.getFullYear(), start.getMonth(), 1);
  while (d <= end) {
    const x = dateToX(d, start, end, chartLeft, chartRight);
    if (x > chartLeft && x < chartRight) {
      svg.appendChild(svgEl('line', {
        x1: x, y1: C.TITLE_HEIGHT, x2: x, y2: totalHeight - C.LEGEND_HEIGHT - 10,
        class: 'grid-line',
      }));
    }
    d.setMonth(d.getMonth() + 1);
  }
}

function generateMonthSummary(schedule, year, month) {
  const lines = [];
  const inMonth = (d) => d && d.getFullYear() === year && d.getMonth() === month;

  // Items completing this month (actual end)
  const completed = [];
  // Items due this month (plan end)
  const due = [];
  // Items starting this month (plan start)
  const starting = [];

  for (const track of schedule.tracks) {
    for (const lane of track.lanes) {
      for (const item of lane.items) {
        if (item.actual && inMonth(item.actual.end)) {
          completed.push(item.label);
        }
        if (inMonth(item.plan.end) && item.status !== 'completed') {
          due.push(item.label);
        }
        if (inMonth(item.plan.start)) {
          starting.push(item.label);
        }
      }
    }
  }

  // Milestones this month
  const milestones = schedule.milestones
    .filter(m => inMonth(m.date))
    .map(m => m.label);

  // Program milestones active this month
  const pmActivity = schedule.programMilestones
    .filter(pm => {
      if (inMonth(pm.start)) return true;
      if (inMonth(pm.end)) return true;
      return false;
    })
    .map(pm => {
      if (inMonth(pm.start)) return `${pm.label} starts`;
      return `${pm.label} ends`;
    });

  if (completed.length) lines.push(`Completed: ${completed.join(', ')}`);
  if (due.length) lines.push(`Due: ${due.join(', ')}`);
  if (starting.length) lines.push(`Starting: ${starting.join(', ')}`);
  if (milestones.length) lines.push(`Milestones: ${milestones.join(', ')}`);
  if (pmActivity.length) lines.push(pmActivity.join(', '));

  return lines;
}

function renderHeader(svg, schedule, layout, C) {
  const { start, end } = schedule.timeline;
  const { chartLeft, chartRight, headerY } = layout;
  const headerHeight = C.HEADER_HEIGHT;

  // Header background
  svg.appendChild(svgEl('rect', {
    x: chartLeft, y: headerY,
    width: chartRight - chartLeft, height: headerHeight,
    class: 'header-bg',
  }));

  // Month labels
  const d = new Date(start.getFullYear(), start.getMonth(), 1);
  while (d <= end) {
    const monthStart = new Date(d);
    const nextMonth = new Date(d.getFullYear(), d.getMonth() + 1, 1);
    const x1 = dateToX(monthStart, start, end, chartLeft, chartRight);
    const x2 = dateToX(nextMonth, start, end, chartLeft, chartRight);
    const midX = (x1 + x2) / 2;

    // Month divider
    if (x1 > chartLeft) {
      svg.appendChild(svgEl('line', {
        x1: x1, y1: headerY, x2: x1, y2: headerY + headerHeight,
        class: 'header-divider',
      }));
    }

    // Label
    let label = formatMonth(d);
    if (d.getMonth() === 0 || d.getTime() <= start.getTime()) {
      label = `${label} '${String(d.getFullYear()).slice(2)}`;
    }

    const text = svgEl('text', {
      x: Math.max(midX, chartLeft + 5),
      y: headerY + headerHeight / 2 + 4,
      class: 'header-text',
      'text-anchor': 'middle',
    });
    text.textContent = label;
    svg.appendChild(text);

    // Month tooltip with generated summary
    const summary = generateMonthSummary(schedule, monthStart.getFullYear(), monthStart.getMonth());
    if (summary.length > 0) {
      const cellX = Math.max(x1, chartLeft);
      const cellW = Math.min(x2, chartRight) - cellX;
      const hitArea = svgEl('rect', {
        x: cellX, y: headerY,
        width: cellW, height: headerHeight,
        fill: 'transparent', class: 'hit-area',
      });
      hitArea.style.cursor = 'pointer';
      const fullLabel = `${formatMonth(monthStart)} ${monthStart.getFullYear()}`;
      attachTooltipLines(hitArea, [fullLabel, ...summary]);
      svg.appendChild(hitArea);
    }

    d.setMonth(d.getMonth() + 1);
  }
}

function renderProgramMilestones(svg, schedule, layout, C) {
  const { pmY } = layout;
  const barY = pmY + (C.PROGRAM_MS_HEIGHT - C.BAR_HEIGHT) / 2;

  for (const pm of schedule.programMilestones) {
    renderProgramBar(svg, pm, barY, schedule, layout, C);
  }
}

function renderTrackChrome(svg, trackLayout, C) {
  const { track, y: trackY, height: trackHeight } = trackLayout;

  // Track background (gutter area)
  svg.appendChild(svgEl('rect', {
    x: 4, y: trackY,
    width: C.GUTTER_WIDTH - 8, height: trackHeight,
    class: 'track-bg',
  }));

  // Track label (rotated)
  const labelX = C.GUTTER_WIDTH / 2 - 2;
  const labelY = trackY + trackHeight / 2;
  const label = svgEl('text', {
    x: labelX, y: labelY,
    class: 'track-label',
    'text-anchor': 'middle',
    'dominant-baseline': 'middle',
    transform: `rotate(-90, ${labelX}, ${labelY})`,
  });
  label.textContent = track.name;
  svg.appendChild(label);

  // Track tooltip hit area (over the gutter)
  const hitArea = svgEl('rect', {
    x: 4, y: trackY,
    width: C.GUTTER_WIDTH - 8, height: trackHeight,
    fill: 'transparent', class: 'hit-area',
  });
  hitArea.style.cursor = 'pointer';
  const tooltipLines = [track.name];
  if (track.notes) tooltipLines.push(track.notes);
  attachTooltipLines(hitArea, tooltipLines, track.link);
  svg.appendChild(hitArea);
}

function renderTrackBars(svg, trackLayout, schedule, layout, C, pass) {
  const { track, y: trackY } = trackLayout;
  const { start, end, today } = schedule.timeline;
  const { chartLeft, chartRight } = layout;

  for (let i = 0; i < track.lanes.length; i++) {
    const lane = track.lanes[i];
    const laneY = trackY + C.TRACK_PADDING + i * C.LANE_SPACING;
    const barY = laneY + (C.LANE_SPACING - C.BAR_HEIGHT) / 2;
    const barH = C.BAR_HEIGHT;
    const barCenterY = barY + barH / 2;

    for (const item of lane.items) {
      const planStart = item.plan.start;
      const planEnd = item.plan.end;
      const status = item.status || 'planned';
      const x1 = dateToX(planStart, start, end, chartLeft, chartRight);
      const x2 = dateToX(planEnd, start, end, chartLeft, chartRight);

      if (pass === 'plan') {
        // Plan bar + plan diamond (always rendered)
        svg.appendChild(svgEl('rect', {
          x: x1, y: barY, width: Math.max(x2 - x1, 2), height: barH,
          class: 'bar plan',
        }));
        svg.appendChild(makeDiamond(x2, barCenterY, C.DIAMOND_SIZE, 'plan'));

      } else if (pass === 'completed' && status === 'completed') {
        const aStart = item.actual ? item.actual.start : planStart;
        const aEnd = item.actual ? item.actual.end : planEnd;
        const ax1 = dateToX(aStart, start, end, chartLeft, chartRight);
        const ax2 = dateToX(aEnd, start, end, chartLeft, chartRight);

        svg.appendChild(svgEl('rect', {
          x: ax1, y: barY, width: Math.max(ax2 - ax1, 2), height: barH,
          class: 'bar completed',
        }));
        svg.appendChild(makeDiamond(ax2, barCenterY, C.DIAMOND_SIZE, 'completed'));

      } else if (pass === 'on-track' && (status === 'on-track' || status === 'moved-out')) {
        // On-track overlay (also the green part of moved-out items)
        if (status === 'on-track') {
          const progressEnd = today < planEnd ? today : planEnd;
          const px2 = dateToX(progressEnd, start, end, chartLeft, chartRight);
          if (px2 > x1) {
            svg.appendChild(svgEl('rect', {
              x: x1, y: barY, width: Math.max(px2 - x1, 2), height: barH,
              class: 'bar on-track',
            }));
            // Green diamond only if there are actual dates confirming completion
            if (item.actual) {
              const ax2 = dateToX(item.actual.end, start, end, chartLeft, chartRight);
              svg.appendChild(makeDiamond(ax2, barCenterY, C.DIAMOND_SIZE, 'on-track'));
            }
          }
        } else {
          // moved-out: green part from start to actual end
          const aEnd = item.actual ? item.actual.end : planEnd;
          const greenEnd = dateToX(aEnd, start, end, chartLeft, chartRight);
          svg.appendChild(svgEl('rect', {
            x: x1, y: barY, width: Math.max(greenEnd - x1, 2), height: barH,
            class: 'bar on-track',
          }));
        }

      } else if (pass === 'moved-out' && status === 'moved-out') {
        // Red extension bar
        const aEnd = item.actual ? item.actual.end : planEnd;
        const greenEnd = dateToX(aEnd, start, end, chartLeft, chartRight);
        if (item.movedTo) {
          const redEnd = dateToX(item.movedTo, start, end, chartLeft, chartRight);
          svg.appendChild(svgEl('rect', {
            x: greenEnd, y: barY, width: Math.max(redEnd - greenEnd, 2), height: barH,
            class: 'bar moved-out',
          }));
          svg.appendChild(makeDiamond(redEnd, barCenterY, C.DIAMOND_SIZE, 'moved-out'));
        }
      }
    }
  }
}

function renderTrackLabels(svg, trackLayout, schedule, layout, C) {
  const { track, y: trackY } = trackLayout;
  const { start, end } = schedule.timeline;
  const { chartLeft, chartRight } = layout;

  for (let i = 0; i < track.lanes.length; i++) {
    const lane = track.lanes[i];
    const laneY = trackY + C.TRACK_PADDING + i * C.LANE_SPACING;
    const barY = laneY + (C.LANE_SPACING - C.BAR_HEIGHT) / 2;

    for (const item of lane.items) {
      const x1 = dateToX(item.plan.start, start, end, chartLeft, chartRight);

      // Label
      const labelEl = svgEl('text', {
        x: x1, y: barY - 3,
        class: 'bar-label',
      });
      labelEl.textContent = item.label;
      svg.appendChild(labelEl);

      // Tooltip group (invisible overlay for hover)
      const planEnd = item.plan.end;
      const x2 = dateToX(planEnd, start, end, chartLeft, chartRight);
      const hitArea = svgEl('rect', {
        x: x1, y: barY - 12, width: Math.max(x2 - x1, 20), height: C.LANE_SPACING,
        fill: 'transparent', class: 'hit-area',
      });
      hitArea.style.cursor = 'pointer';
      attachTooltip(hitArea, item);
      svg.appendChild(hitArea);
    }
  }
}

// Program milestones still use the single-item approach (no z-order issues)
function renderProgramBar(svg, item, barY, schedule, layout, C) {
  const { start, end, today } = schedule.timeline;
  const { chartLeft, chartRight } = layout;

  const planStart = item.start;
  const planEnd = item.end;
  const status = item.status || 'planned';

  const x1 = dateToX(planStart, start, end, chartLeft, chartRight);
  const x2 = dateToX(planEnd, start, end, chartLeft, chartRight);
  const barH = C.BAR_HEIGHT;
  const barCenterY = barY + barH / 2;

  const group = svgEl('g', { class: `item-group program-milestone ${status}` });

  // Plan bar
  group.appendChild(svgEl('rect', {
    x: x1, y: barY, width: Math.max(x2 - x1, 2), height: barH,
    class: 'bar plan',
  }));
  group.appendChild(makeDiamond(x2, barCenterY, C.DIAMOND_SIZE, 'plan'));

  // Status overlay
  if (status === 'completed') {
    const aStart = item.actual ? item.actual.start : planStart;
    const aEnd = item.actual ? item.actual.end : planEnd;
    const ax1 = dateToX(aStart, start, end, chartLeft, chartRight);
    const ax2 = dateToX(aEnd, start, end, chartLeft, chartRight);
    group.appendChild(svgEl('rect', {
      x: ax1, y: barY, width: Math.max(ax2 - ax1, 2), height: barH,
      class: 'bar completed',
    }));
    group.appendChild(makeDiamond(ax2, barCenterY, C.DIAMOND_SIZE, 'completed'));
  } else if (status === 'on-track') {
    const progressEnd = today < planEnd ? today : planEnd;
    const px2 = dateToX(progressEnd, start, end, chartLeft, chartRight);
    if (px2 > x1) {
      group.appendChild(svgEl('rect', {
        x: x1, y: barY, width: Math.max(px2 - x1, 2), height: barH,
        class: 'bar on-track',
      }));
      if (item.actual) {
        const ax2 = dateToX(item.actual.end, start, end, chartLeft, chartRight);
        group.appendChild(makeDiamond(ax2, barCenterY, C.DIAMOND_SIZE, 'on-track'));
      }
    }
  }

  // Label
  const labelEl = svgEl('text', {
    x: x1, y: barY - 3,
    class: 'program-milestone-label',
  });
  labelEl.textContent = item.label;
  group.appendChild(labelEl);

  // Tooltip hit area
  const hitArea = svgEl('rect', {
    x: x1, y: barY - 12, width: Math.max(x2 - x1, 20), height: C.PROGRAM_MS_HEIGHT,
    fill: 'transparent', class: 'hit-area',
  });
  hitArea.style.cursor = 'pointer';
  const lines = [
    item.label,
    `${formatDate(item.start)} \u2192 ${formatDate(item.end)}`,
    `Status: ${status}`,
  ];
  if (item.notes) lines.push(item.notes);
  attachTooltipLines(hitArea, lines, item.link);
  group.appendChild(hitArea);

  svg.appendChild(group);
}

function makeDiamond(cx, cy, size, statusClass) {
  const h = size / 2;
  return svgEl('polygon', {
    points: `${cx},${cy - h} ${cx + h},${cy} ${cx},${cy + h} ${cx - h},${cy}`,
    class: `diamond ${statusClass}`,
  });
}

function renderTodayLine(svg, schedule, layout, C) {
  const { start, end, today } = schedule.timeline;
  const { chartLeft, chartRight, totalHeight } = layout;

  const x = dateToX(today, start, end, chartLeft, chartRight);
  if (x < chartLeft || x > chartRight) return;

  const topY = C.TITLE_HEIGHT;
  const bottomY = layout.legendY || totalHeight - 10;

  svg.appendChild(svgEl('line', {
    x1: x, y1: topY, x2: x, y2: bottomY,
    class: 'today-line',
  }));

  const label = svgEl('text', {
    x: x, y: topY - 4,
    class: 'today-label',
    'text-anchor': 'middle',
  });
  label.textContent = 'Today';
  svg.appendChild(label);

  // Tooltip hit area
  const hitArea = svgEl('rect', {
    x: x - 25, y: topY - 16, width: 50, height: 16,
    fill: 'transparent', class: 'hit-area',
  });
  hitArea.style.cursor = 'pointer';
  attachTooltipLines(hitArea, ['Today', formatDate(today)]);
  svg.appendChild(hitArea);
}

function renderMilestoneLines(svg, schedule, layout, C) {
  const { start, end } = schedule.timeline;
  const { chartLeft, chartRight, totalHeight } = layout;

  for (const ms of schedule.milestones) {
    const x = dateToX(ms.date, start, end, chartLeft, chartRight);
    if (x < chartLeft || x > chartRight) continue;

    const topY = C.TITLE_HEIGHT;
    const bottomY = layout.legendY || totalHeight - 10;
    const typeClass = ms.type ? ` ${ms.type}` : '';

    svg.appendChild(svgEl('line', {
      x1: x, y1: topY, x2: x, y2: bottomY,
      class: `milestone-line${typeClass}`,
    }));

    // Label above the header, like Today
    const label = svgEl('text', {
      x: x, y: topY - 4,
      class: `milestone-label${typeClass}`,
      'text-anchor': 'middle',
    });
    label.textContent = ms.label;
    svg.appendChild(label);

    // Tooltip hit area over the label
    const hitArea = svgEl('rect', {
      x: x - 40, y: topY - 16, width: 80, height: 16,
      fill: 'transparent', class: 'hit-area',
    });
    hitArea.style.cursor = 'pointer';
    const lines = [ms.label, formatDate(ms.date)];
    if (ms.notes) lines.push(ms.notes);
    attachTooltipLines(hitArea, lines, ms.link);
    svg.appendChild(hitArea);
  }
}

function renderLegend(svg, schedule, layout, C) {
  const { legendY, chartLeft } = layout;
  const y = legendY + C.LEGEND_HEIGHT / 2;
  let x = chartLeft;
  const barW = 40;
  const gap = 30;

  const items = [
    { label: 'Plan', status: 'plan' },
    { label: 'Actual', status: 'completed' },
    { label: 'On Track', status: 'on-track' },
    { label: 'Moved Out', status: 'moved-out' },
  ];

  for (const item of items) {
    const startX = x;

    // Label
    const labelEl = svgEl('text', {
      x: x, y: y + 4,
      class: 'legend-text',
    });
    labelEl.textContent = item.label;
    svg.appendChild(labelEl);
    x += item.label.length * 7 + 8;

    // Bar
    svg.appendChild(svgEl('rect', {
      x: x, y: y - C.BAR_HEIGHT / 2,
      width: barW, height: C.BAR_HEIGHT,
      class: `legend-bar ${item.status}`,
      rx: 2, ry: 2,
    }));

    // Diamond
    svg.appendChild(makeDiamond(x + barW, y, C.DIAMOND_SIZE, item.status));
    x += barW + C.DIAMOND_SIZE / 2;

    // Tooltip hit area over the entire legend entry
    const desc = schedule.legendDescriptions[item.status] || schedule.legendDescriptions[item.status.replace(' ', '-')];
    if (desc) {
      const hitArea = svgEl('rect', {
        x: startX, y: y - C.DIAMOND_SIZE,
        width: x - startX, height: C.DIAMOND_SIZE * 2,
        fill: 'transparent', class: 'hit-area',
      });
      hitArea.style.cursor = 'pointer';
      attachTooltipLines(hitArea, [item.label, desc]);
      svg.appendChild(hitArea);
    }

    x += gap;
  }
}

// ============================================================
// Tooltip
// ============================================================

function attachTooltip(element, item) {
  const lines = [
    item.label,
    `Plan: ${formatDate(item.plan.start)} \u2192 ${formatDate(item.plan.end)}`,
    `Status: ${item.status}`,
  ];
  if (item.actual) {
    lines.push(`Actual: ${formatDate(item.actual.start)} \u2192 ${formatDate(item.actual.end)}`);
  }
  if (item.movedTo) {
    lines.push(`Moved to: ${formatDate(item.movedTo)}`);
  }
  if (item.notes) {
    lines.push(item.notes);
  }
  attachTooltipLines(element, lines, item.link);
}

function attachLink(element, link) {
  if (!link) return;
  element.addEventListener('click', (e) => {
    e.preventDefault();
    window.open(link, '_blank', 'noopener');
  });
}

function attachTooltipLines(element, lines, link) {
  if (link) attachLink(element, link);
  let tooltipGroup = null;

  element.addEventListener('mouseenter', (e) => {
    tooltipGroup = svgEl('g', { class: 'tooltip', 'pointer-events': 'none' });

    const lineHeight = 16;
    const padding = 8;
    const maxWidth = Math.max(...lines.map(l => l.length * 7)) + padding * 2;
    const height = lines.length * lineHeight + padding * 2;

    let tx = parseFloat(element.getAttribute('x') || 0);
    let ty = parseFloat(element.getAttribute('y') || 0) - height - 4;

    // Clamp tooltip so it doesn't go above the SVG
    if (ty < 2) ty = parseFloat(element.getAttribute('y') || 0) + parseFloat(element.getAttribute('height') || 20) + 4;

    tooltipGroup.appendChild(svgEl('rect', {
      x: tx, y: ty, width: maxWidth, height: height,
      class: 'tooltip-bg',
    }));

    lines.forEach((line, i) => {
      const text = svgEl('text', {
        x: tx + padding, y: ty + padding + (i + 1) * lineHeight - 4,
        class: 'tooltip-text',
      });
      text.textContent = line;
      tooltipGroup.appendChild(text);
    });

    // Find the root SVG and append
    let root = element;
    while (root.parentNode && root.parentNode.nodeName !== '#document' && root.parentNode.nodeName !== 'DIV') {
      root = root.parentNode;
    }
    root.appendChild(tooltipGroup);
  });

  element.addEventListener('mouseleave', () => {
    if (tooltipGroup && tooltipGroup.parentNode) {
      tooltipGroup.parentNode.removeChild(tooltipGroup);
      tooltipGroup = null;
    }
  });
}

// ============================================================
// File loading and initialization
// ============================================================

function isFileProtocol() {
  return window.location.protocol === 'file:';
}

async function fetchText(url) {
  // Cache-bust to ensure fresh files when iterating
  const separator = url.includes('?') ? '&' : '?';
  const bustUrl = `${url}${separator}_t=${Date.now()}`;
  const resp = await fetch(bustUrl);
  if (!resp.ok) throw new Error(`Failed to load ${url}: ${resp.status}`);
  return resp.text();
}

function resolveRelative(base, ref) {
  // Resolve ref relative to the directory of base
  if (ref.startsWith('/') || ref.startsWith('http')) return ref;
  const baseDir = base.substring(0, base.lastIndexOf('/') + 1);
  return baseDir + ref;
}

async function loadViaFetch(dataUrl, viewUrl) {
  const viewText = await fetchText(viewUrl);
  const viewObj = parseYAML(viewText);

  // Resolve data and style paths relative to the view file's directory
  const actualDataUrl = viewObj.data
    ? resolveRelative(viewUrl, viewObj.data)
    : dataUrl;
  const dataText = await fetchText(actualDataUrl);
  const dataObj = parseYAML(dataText);

  // Load style if referenced
  if (viewObj.style) {
    try {
      const styleUrl = resolveRelative(viewUrl, viewObj.style);
      const styleText = await fetchText(styleUrl);
      injectStyle(styleText, 'waypoint-dynamic-style');
    } catch (e) {
      console.warn('Could not load style file:', e.message);
    }
  }

  return { dataObj, viewObj };
}

function loadFromEmbedded() {
  const dataEl = document.getElementById('default-data');
  const viewEl = document.getElementById('default-view');

  if (!dataEl || !viewEl) {
    throw new Error('No embedded data/view found and cannot fetch files');
  }

  const dataObj = parseYAML(dataEl.textContent);
  const viewObj = parseYAML(viewEl.textContent);
  return { dataObj, viewObj };
}

function injectStyle(cssText, id) {
  let existing = document.getElementById(id);
  if (existing) existing.remove();
  const style = document.createElement('style');
  style.id = id;
  style.textContent = cssText;
  document.head.appendChild(style);
}

function getUrlParams() {
  const params = new URLSearchParams(window.location.search);
  return {
    data: params.get('data'),
    view: params.get('view'),
    tracks: params.get('tracks'),
  };
}

// Current state — tracked so Refresh can re-load
let _currentState = {
  container: null,
  dataUrl: null,
  viewUrl: null,
  dataObj: null,
  viewObj: null,
  mode: null, // 'http' | 'embedded' | 'file-picker'
};

function renderCurrent() {
  const { container, dataObj, viewObj } = _currentState;
  if (!container || !dataObj || !viewObj) return;
  const schedule = buildSchedule(dataObj, viewObj);
  const svg = render(schedule, container);

  // Wire up export button
  const exportBtn = document.getElementById('export-btn');
  if (exportBtn) {
    exportBtn.onclick = () => exportPNG(svg, schedule.title);
  }
  return svg;
}

async function refresh() {
  const { container, mode, dataUrl, viewUrl } = _currentState;
  if (mode === 'http' && dataUrl && viewUrl) {
    try {
      const { dataObj, viewObj } = await loadViaFetch(dataUrl, viewUrl);
      const params = getUrlParams();
      if (params.tracks) {
        viewObj.tracks = params.tracks.split(',').map(s => s.trim());
      }
      _currentState.dataObj = dataObj;
      _currentState.viewObj = viewObj;
      renderCurrent();
    } catch (e) {
      console.error('Refresh failed:', e.message);
    }
  } else if (mode === 'embedded') {
    const { dataObj, viewObj } = loadFromEmbedded();
    _currentState.dataObj = dataObj;
    _currentState.viewObj = viewObj;
    renderCurrent();
  }
  // file-picker mode: user must re-select files (nothing to re-fetch)
}

export async function init(container, options = {}) {
  const params = getUrlParams();
  let dataObj, viewObj;

  const defaultData = options.defaultDataUrl || '../examples/atlas-data.yaml';
  const defaultView = options.defaultViewUrl || '../examples/atlas-board.yaml';

  _currentState.container = container;

  if (isFileProtocol()) {
    // File mode: use embedded defaults
    try {
      ({ dataObj, viewObj } = loadFromEmbedded());
      _currentState.mode = 'embedded';
    } catch (e) {
      showError(container, e.message);
      return;
    }
  } else {
    // HTTP mode: fetch files
    const dataUrl = params.data || defaultData;
    const viewUrl = params.view || defaultView;
    _currentState.dataUrl = dataUrl;
    _currentState.viewUrl = viewUrl;
    try {
      ({ dataObj, viewObj } = await loadViaFetch(dataUrl, viewUrl));
      _currentState.mode = 'http';
    } catch (e) {
      // Fall back to embedded
      try {
        ({ dataObj, viewObj } = loadFromEmbedded());
        _currentState.mode = 'embedded';
      } catch (e2) {
        showError(container, e.message);
        return;
      }
    }
  }

  // URL param track override
  if (params.tracks) {
    viewObj.tracks = params.tracks.split(',').map(s => s.trim());
  }

  _currentState.dataObj = dataObj;
  _currentState.viewObj = viewObj;
  renderCurrent();

  // Wire up export button (initial binding)
  const exportBtn = document.getElementById('export-btn');
  if (exportBtn) {
    const schedule = buildSchedule(dataObj, viewObj);
    exportBtn.onclick = () => exportPNG(document.querySelector('.waypoint'), schedule.title);
  }

  // Wire up refresh button
  const refreshBtn = document.getElementById('refresh-btn');
  if (refreshBtn) {
    refreshBtn.addEventListener('click', refresh);
  }

  // Wire up file pickers
  setupFilePickers(container);

  // Wire up drag and drop
  setupDragDrop(container);

  return document.querySelector('.waypoint');
}

// ============================================================
// File pickers
// ============================================================

function setupFilePickers(container) {
  const dataInput = document.getElementById('file-data');
  const viewInput = document.getElementById('file-view');
  const styleInput = document.getElementById('file-style');

  if (dataInput) {
    dataInput.addEventListener('change', (e) => {
      readFile(e.target.files[0], (text) => {
        _currentState.dataObj = parseYAML(text);
        _currentState.mode = 'file-picker';
        renderCurrent();
      });
      e.target.value = ''; // Reset so same file can be re-selected
    });
  }

  if (viewInput) {
    viewInput.addEventListener('change', (e) => {
      readFile(e.target.files[0], (text) => {
        _currentState.viewObj = parseYAML(text);
        _currentState.mode = 'file-picker';
        renderCurrent();
      });
      e.target.value = '';
    });
  }

  if (styleInput) {
    styleInput.addEventListener('change', (e) => {
      readFile(e.target.files[0], (text) => {
        injectStyle(text, 'waypoint-dynamic-style');
        renderCurrent();
      });
      e.target.value = '';
    });
  }
}

function setupDragDrop(container) {
  const dropZone = container.parentElement || document.body;

  dropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
  });

  dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    for (const file of e.dataTransfer.files) {
      const name = file.name.toLowerCase();
      if (name.endsWith('.yaml') || name.endsWith('.yml')) {
        readFile(file, (text) => {
          const obj = parseYAML(text);
          // Heuristic: if it has 'tracks' key with array, it's data; otherwise it's a view
          if (obj.tracks && Array.isArray(obj.tracks) && obj.tracks[0]?.lanes) {
            // Data file — reload with current view
            const viewEl = document.getElementById('default-view');
            const viewObj = viewEl ? parseYAML(viewEl.textContent) : { tracks: 'all', show_legend: true, show_program_milestones: true };
            const schedule = buildSchedule(obj, viewObj);
            render(schedule, container);
          } else {
            // View file
            const dataEl = document.getElementById('default-data');
            if (dataEl) {
              const dataObj = parseYAML(dataEl.textContent);
              const schedule = buildSchedule(dataObj, obj);
              render(schedule, container);
            }
          }
        });
      } else if (name.endsWith('.css')) {
        readFile(file, (text) => {
          injectStyle(text, 'waypoint-dynamic-style');
        });
      }
    }
  });
}

function readFile(file, callback) {
  const reader = new FileReader();
  reader.onload = () => callback(reader.result);
  reader.readAsText(file);
}

// ============================================================
// Error display
// ============================================================

function showError(container, message) {
  container.innerHTML = '';
  const svg = svgEl('svg', {
    class: 'waypoint',
    viewBox: '0 0 800 200',
    xmlns: SVG_NS,
    width: '100%',
  });
  svg.appendChild(svgEl('rect', { x: 0, y: 0, width: 800, height: 200, fill: '#FFF5F5' }));
  const text = svgEl('text', { x: 40, y: 80, fill: '#CC3333', 'font-size': '16' });
  text.textContent = 'Error loading Waypoint data';
  svg.appendChild(text);
  const detail = svgEl('text', { x: 40, y: 110, fill: '#666666', 'font-size': '13' });
  detail.textContent = message;
  svg.appendChild(detail);
  container.appendChild(svg);
}
