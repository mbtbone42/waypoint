// yaml-parser.js — Minimal YAML parser for Waypoint
// Supports: maps, block sequences, scalars (string, number, boolean, null, date), comments, quoted strings
// Does NOT support: flow sequences/mappings, anchors/aliases, tags, multi-document, complex keys

export class YAMLParseError extends Error {
  constructor(message, line) {
    super(`YAML parse error at line ${line}: ${message}`);
    this.line = line;
  }
}

export function parseYAML(text) {
  const lines = text.split('\n');
  const ctx = { lines, pos: 0 };
  return parseBlock(ctx, -1);
}

function parseBlock(ctx, parentIndent) {
  let result = null;

  while (ctx.pos < ctx.lines.length) {
    const raw = ctx.lines[ctx.pos];
    const info = analyzeLine(raw, ctx.pos + 1);

    // Skip blank lines and comments
    if (info.content === '') {
      ctx.pos++;
      continue;
    }

    // If this line is at or before the parent indent, we've left this block
    if (info.indent <= parentIndent) {
      break;
    }

    // Determine if this block is a sequence or a map
    if (info.isArrayItem) {
      result = parseSequence(ctx, info.indent);
    } else if (info.key !== null) {
      result = parseMapping(ctx, info.indent);
    } else {
      ctx.pos++;
    }
  }

  return result;
}

function parseMapping(ctx, blockIndent) {
  const map = {};

  while (ctx.pos < ctx.lines.length) {
    const raw = ctx.lines[ctx.pos];
    const info = analyzeLine(raw, ctx.pos + 1);

    if (info.content === '') {
      ctx.pos++;
      continue;
    }

    if (info.indent < blockIndent) break;
    if (info.indent > blockIndent) break; // Unexpected deeper indent at map level

    if (info.isArrayItem) break; // Array at same level means we're in a parent sequence

    if (info.key === null) {
      ctx.pos++;
      continue;
    }

    const key = info.key;

    if (info.value !== null && info.value !== '') {
      // Check for block scalar indicators
      if (info.value === '|' || info.value === '>') {
        ctx.pos++;
        map[key] = parseBlockScalar(ctx, blockIndent, info.value);
      } else {
        map[key] = parseScalar(info.value);
        ctx.pos++;
      }
    } else {
      // No inline value — look ahead for nested block
      ctx.pos++;
      const nested = peekNextContentLine(ctx);
      if (nested && nested.indent > blockIndent) {
        if (nested.isArrayItem) {
          map[key] = parseSequence(ctx, nested.indent);
        } else {
          map[key] = parseMapping(ctx, nested.indent);
        }
      } else {
        map[key] = null;
      }
    }
  }

  return map;
}

function parseSequence(ctx, blockIndent) {
  const arr = [];

  while (ctx.pos < ctx.lines.length) {
    const raw = ctx.lines[ctx.pos];
    const info = analyzeLine(raw, ctx.pos + 1);

    if (info.content === '') {
      ctx.pos++;
      continue;
    }

    if (info.indent < blockIndent) break;
    if (info.indent > blockIndent && arr.length > 0) {
      // Deeper lines belong to the current array item — skip forward
      // (they should have been consumed by the item parser)
      ctx.pos++;
      continue;
    }

    if (!info.isArrayItem || info.indent !== blockIndent) break;

    // Strip the "- " prefix and parse the remainder
    const after = info.content.substring(2);

    if (after === '' || after === null) {
      // Empty array item — look for nested block
      ctx.pos++;
      const nested = peekNextContentLine(ctx);
      if (nested && nested.indent > blockIndent) {
        arr.push(parseBlock(ctx, blockIndent));
      } else {
        arr.push(null);
      }
    } else if (after.includes(': ') || after.endsWith(':')) {
      // Inline map start: "- key: value" or "- key:"
      // Parse as a mapping starting with this key-value pair
      const item = parseSequenceItemMapping(ctx, blockIndent, after);
      arr.push(item);
    } else {
      // Simple scalar item: "- value"
      arr.push(parseScalar(after));
      ctx.pos++;
    }
  }

  return arr;
}

function parseSequenceItemMapping(ctx, seqIndent, firstContent) {
  // Handle "- key: value" inline map items
  // The first key-value pair is on the "- " line itself
  const map = {};
  const colonIdx = firstContent.indexOf(': ');
  let key, value;

  if (colonIdx !== -1) {
    key = firstContent.substring(0, colonIdx).trim();
    value = firstContent.substring(colonIdx + 2).trim();
  } else if (firstContent.endsWith(':')) {
    key = firstContent.slice(0, -1).trim();
    value = '';
  } else {
    map[firstContent] = null;
    ctx.pos++;
    return map;
  }

  // The nested content indent for items after "- key: value"
  // is typically seqIndent + 2 (past the "- ")
  const nestedIndent = seqIndent + 2;

  if (value !== '') {
    if (value === '|' || value === '>') {
      ctx.pos++;
      map[key] = parseBlockScalar(ctx, nestedIndent - 2, value);
    } else {
      map[key] = parseScalar(value);
      ctx.pos++;
    }
  } else {
    ctx.pos++;
    const nested = peekNextContentLine(ctx);
    if (nested && nested.indent > seqIndent) {
      if (nested.isArrayItem) {
        map[key] = parseSequence(ctx, nested.indent);
      } else {
        map[key] = parseMapping(ctx, nested.indent);
      }
    } else {
      map[key] = null;
    }
  }

  // Continue parsing sibling keys at nestedIndent
  while (ctx.pos < ctx.lines.length) {
    const raw = ctx.lines[ctx.pos];
    const info = analyzeLine(raw, ctx.pos + 1);

    if (info.content === '') {
      ctx.pos++;
      continue;
    }

    if (info.indent < nestedIndent) break;
    if (info.indent > nestedIndent) break;
    if (info.isArrayItem) break;
    if (info.key === null) {
      ctx.pos++;
      continue;
    }

    const k = info.key;

    if (info.value !== null && info.value !== '') {
      if (info.value === '|' || info.value === '>') {
        ctx.pos++;
        map[k] = parseBlockScalar(ctx, nestedIndent, info.value);
      } else {
        map[k] = parseScalar(info.value);
        ctx.pos++;
      }
    } else {
      ctx.pos++;
      const nested2 = peekNextContentLine(ctx);
      if (nested2 && nested2.indent > nestedIndent) {
        if (nested2.isArrayItem) {
          map[k] = parseSequence(ctx, nested2.indent);
        } else {
          map[k] = parseMapping(ctx, nested2.indent);
        }
      } else {
        map[k] = null;
      }
    }
  }

  return map;
}

function parseBlockScalar(ctx, parentIndent, style) {
  const lines = [];
  let scalarIndent = null;

  while (ctx.pos < ctx.lines.length) {
    const raw = ctx.lines[ctx.pos];
    const lineIndent = raw.search(/\S/);

    // Empty line in a block scalar is preserved
    if (lineIndent === -1) {
      lines.push('');
      ctx.pos++;
      continue;
    }

    // First content line establishes the scalar indent
    if (scalarIndent === null) {
      if (lineIndent <= parentIndent) break;
      scalarIndent = lineIndent;
    }

    if (lineIndent < scalarIndent) break;

    lines.push(raw.substring(scalarIndent));
    ctx.pos++;
  }

  // Trim trailing empty lines
  while (lines.length > 0 && lines[lines.length - 1] === '') {
    lines.pop();
  }

  if (style === '|') {
    return lines.join('\n');
  } else {
    // Folded: join with spaces, but preserve blank-line paragraph breaks
    return lines.join(' ').replace(/  +/g, '\n');
  }
}

function parseScalar(str) {
  const trimmed = str.trim();

  if (trimmed === '') return null;
  if (trimmed === 'null' || trimmed === '~') return null;
  if (trimmed === 'true') return true;
  if (trimmed === 'false') return false;

  // Quoted strings
  if ((trimmed.startsWith('"') && trimmed.endsWith('"')) ||
      (trimmed.startsWith("'") && trimmed.endsWith("'"))) {
    return trimmed.slice(1, -1);
  }

  // Date: YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return trimmed; // Keep as string — the schedule builder will convert to Date
  }

  // Integer
  if (/^-?\d+$/.test(trimmed)) {
    return parseInt(trimmed, 10);
  }

  // Float
  if (/^-?\d+\.\d+$/.test(trimmed)) {
    return parseFloat(trimmed);
  }

  return trimmed;
}

function analyzeLine(raw, lineNum) {
  const indent = raw.search(/\S/);
  if (indent === -1) {
    return { indent: 0, content: '', isArrayItem: false, key: null, value: null };
  }

  let content = raw.substring(indent);

  // Strip inline comments (but not inside quotes)
  content = stripInlineComment(content);
  content = content.trimEnd();

  if (content === '' || content.startsWith('#')) {
    return { indent: 0, content: '', isArrayItem: false, key: null, value: null };
  }

  const isArrayItem = content.startsWith('- ') || content === '-';

  let key = null;
  let value = null;

  if (!isArrayItem) {
    const colonMatch = findKeyColon(content);
    if (colonMatch !== -1) {
      key = content.substring(0, colonMatch).trim();
      value = content.substring(colonMatch + 1).trim();
      if (value === '') value = '';
    }
  }

  return { indent, content, isArrayItem, key, value };
}

function findKeyColon(content) {
  // Find the first colon that's a key separator (not inside quotes)
  let inSingle = false;
  let inDouble = false;

  for (let i = 0; i < content.length; i++) {
    const ch = content[i];
    if (ch === '"' && !inSingle) inDouble = !inDouble;
    else if (ch === "'" && !inDouble) inSingle = !inSingle;
    else if (ch === ':' && !inSingle && !inDouble) {
      // Must be followed by space, end of string, or nothing
      if (i + 1 >= content.length || content[i + 1] === ' ') {
        return i;
      }
    }
  }

  return -1;
}

function stripInlineComment(content) {
  let inSingle = false;
  let inDouble = false;

  for (let i = 0; i < content.length; i++) {
    const ch = content[i];
    if (ch === '"' && !inSingle) inDouble = !inDouble;
    else if (ch === "'" && !inDouble) inSingle = !inSingle;
    else if (ch === '#' && !inSingle && !inDouble && i > 0 && content[i - 1] === ' ') {
      return content.substring(0, i);
    }
  }

  return content;
}

function peekNextContentLine(ctx) {
  let i = ctx.pos;
  while (i < ctx.lines.length) {
    const info = analyzeLine(ctx.lines[i], i + 1);
    if (info.content !== '') return info;
    i++;
  }
  return null;
}
