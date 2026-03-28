// export.js — SVG-to-PNG export for Waypoint
// Pipeline: clone SVG → inline styles → serialize → canvas → PNG download

export function exportPNG(svgElement, title) {
  const clone = svgElement.cloneNode(true);

  // Inline computed styles so they survive serialization
  inlineStyles(svgElement, clone);

  // Get dimensions from viewBox
  const vb = svgElement.viewBox.baseVal;
  const scale = 2; // 2x for Retina/presentation quality
  const width = vb.width * scale;
  const height = vb.height * scale;

  // Serialize to XML
  const serializer = new XMLSerializer();
  const svgString = serializer.serializeToString(clone);
  const dataUrl = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svgString);

  // Draw to canvas and export
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');

  const img = new Image();
  img.onload = () => {
    ctx.drawImage(img, 0, 0, width, height);
    const link = document.createElement('a');
    link.download = makeFilename(title);
    link.href = canvas.toDataURL('image/png');
    link.click();
  };
  img.onerror = () => {
    console.error('PNG export failed: could not load SVG image');
  };
  img.src = dataUrl;
}

function inlineStyles(source, target) {
  const sourceChildren = source.children;
  const targetChildren = target.children;

  const computed = window.getComputedStyle(source);
  const styleProps = [
    'fill', 'stroke', 'stroke-width', 'stroke-dasharray', 'opacity',
    'font-family', 'font-size', 'font-weight', 'font-style',
    'text-anchor', 'dominant-baseline', 'letter-spacing'
  ];

  for (const prop of styleProps) {
    const val = computed.getPropertyValue(prop);
    if (val && val !== '') {
      target.style.setProperty(prop, val);
    }
  }

  for (let i = 0; i < sourceChildren.length; i++) {
    if (targetChildren[i]) {
      inlineStyles(sourceChildren[i], targetChildren[i]);
    }
  }
}

function makeFilename(title) {
  const slug = (title || 'waypoint')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  const date = new Date().toISOString().split('T')[0];
  return `${slug}-${date}.png`;
}
