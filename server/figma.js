// A Figma node tree, turned into artboard items.
//
// Pure: no network, no Supabase, no browser. That is what makes it testable
// against a captured node tree, and it is why it lives here rather than inside
// the endpoint — a converter that can only be exercised by deploying is a
// converter nobody exercises.
//
// ── What survives, and what cannot ────────────────────────────────────────
// An artboard document is a FLAT list of absolutely positioned primitives:
// text, rect/ellipse, image, line. It has no concept of groups, auto-layout,
// constraints, components, masks or effects. So a frame arrives flattened, and
// that is a property of the destination rather than a shortcut taken here.
//
// Text stays text and stays editable. A rectangle keeps its fill and its
// corner radius. Images come through as images. Everything structural is baked
// away, and every loss is NAMED in `warnings` rather than silently dropped:
// somebody who imported a design deserves to know what did not come with it.

// Figma channels are 0..1 floats.
const hex = (c) => {
  const b = (v) => Math.max(0, Math.min(255, Math.round((v ?? 0) * 255)));
  return "#" + [b(c.r), b(c.g), b(c.b)].map(v => v.toString(16).padStart(2, "0")).join("");
};

// `fills` is the current field for a frame's background, and the docs say so.
// But `background` and `backgroundColor` are still what older files come back
// with, and a frame whose background lives only there arrived with no
// background at all — which is exactly what an import looked like here.
// Deprecated is not the same as absent.
const visibleFills = (node) => {
  const own = (node.fills || []).filter(f => f.visible !== false && (f.opacity ?? 1) > 0);
  if (own.length) return own;
  const legacy = (node.background || []).filter(f => f.visible !== false && (f.opacity ?? 1) > 0);
  if (legacy.length) return legacy;
  // The last resort is a bare colour rather than a paint, so it is wrapped into
  // the shape everything else here expects.
  const bc = node.backgroundColor;
  return bc && (bc.a ?? 1) > 0 ? [{ type: "SOLID", color: bc, opacity: bc.a ?? 1 }] : [];
};

// The first fill that is a flat colour. Gradients are handled separately and
// deliberately: approximating one with a single colour is a lie worth
// declaring, not one worth hiding.
const solidFill = (node) => {
  const f = visibleFills(node).find(f => f.type === "SOLID");
  return f ? { color: hex(f.color), alpha: (f.opacity ?? 1) * (f.color?.a ?? 1) } : null;
};

const gradientFill = (node) =>
  visibleFills(node).find(f => typeof f.type === "string" && f.type.startsWith("GRADIENT_")) || null;

// A Figma gradient as the artboard's own: { type, angle, stops:[{at,color,alpha}] }.
// The artboard already paints these through paintCss, so this is a translation
// and not the flat approximation it used to be.
//
// The angle comes from Figma's two handles, which are normalised to the node's
// box with y pointing DOWN. CSS measures from straight UP and turns clockwise,
// so the vector (dx, dy) becomes atan2(dx, -dy): straight down is 180deg, left
// to right is 90deg. Getting this backwards is invisible on a symmetric
// gradient and obvious on every other one.
const GRAD_TYPES = { GRADIENT_LINEAR: "linear", GRADIENT_RADIAL: "radial", GRADIENT_ANGULAR: "angular" };
const gradientOf = (paint) => {
  const stops = (paint.gradientStops || []).map(st => ({
    at: Math.round((st.position ?? 0) * 100),
    color: hex(st.color || {}),
    alpha: Math.round(((st.color?.a ?? 1) * (paint.opacity ?? 1)) * 100),
  }));
  if (stops.length < 2) return null;
  const h = paint.gradientHandlePositions || [];
  let angle = 180;
  if (h[0] && h[1]) {
    const deg = (Math.atan2(h[1].x - h[0].x, -(h[1].y - h[0].y)) * 180) / Math.PI;
    angle = Math.round(((deg % 360) + 360) % 360);
  }
  // A diamond has no counterpart here; radial is the nearest shape, and the
  // caller counts it as a simplification rather than passing it off as exact.
  return { type: GRAD_TYPES[paint.type] || "radial", angle, stops };
};

const imageFill = (node) => visibleFills(node).find(f => f.type === "IMAGE" && f.imageRef) || null;

const radiusOf = (node) => (typeof node.cornerRadius === "number" ? node.cornerRadius || undefined : undefined);
// Four corners, because the artboard has four. It reads `radii` as [TL, TR, BR,
// BL] and Figma writes rectangleCornerRadii "starting in the top left and
// proceeding clockwise", which is the same order — so this needs no rotating,
// and the largest-of-four it used to collapse to was a loss for nothing.
const radiiOf = (node) => {
  const r = node.rectangleCornerRadii;
  if (!Array.isArray(r) || r.length !== 4 || !r.some(Boolean)) return null;
  return r.map(v => Math.max(0, Number(v) || 0));
};

// Figma's effects, as the two the artboard has. Both are drawn as one CSS
// filter there, on screen and in the export alike, so they apply to any item
// type: a shadow under a text is the same mechanism as a shadow under a box.
//
// `alpha` is a percentage here and a 0..1 channel in Figma, and `color` is a
// hex string rather than a paint.
const effectsOf = (node, note) => {
  const fx = (node.effects || []).filter(e => e.visible !== false);
  if (!fx.length) return {};
  const out = {};
  const drops = fx.filter(e => e.type === "DROP_SHADOW");
  if (drops.length) {
    const d = drops[0];
    // One shadow per item here. A stack of them is a look that cannot be
    // rebuilt from the first one alone, so it is counted.
    if (drops.length > 1) note("shadow-stack");
    // CSS drop-shadow() has no spread. A spread shadow is a different shape,
    // and quietly dropping the spread puts a soft halo where the design has a
    // hard shoulder.
    if (d.spread) note("shadow-spread");
    out.shadow = {
      x: Math.round(d.offset?.x || 0),
      y: Math.round(d.offset?.y || 0),
      blur: Math.round(d.radius || 0),
      color: hex(d.color || {}),
      alpha: Math.round((d.color?.a ?? 1) * 100),
    };
  }
  const layer = fx.find(e => e.type === "LAYER_BLUR");
  if (layer?.radius) out.blur = Math.round(layer.radius);
  // The filter blurs the element itself, never what is behind it, so a
  // background blur has nowhere to land. Named rather than dropped: it is the
  // difference between frosted glass and a plain panel.
  if (fx.some(e => e.type === "BACKGROUND_BLUR")) note("background-blur");
  if (fx.some(e => e.type === "INNER_SHADOW")) note("inner-shadow");
  return out;
};

// Nodes that hold other nodes. A frame may also have a background of its own,
// which becomes a rectangle behind its children.
const CONTAINERS = new Set(["FRAME", "GROUP", "COMPONENT", "COMPONENT_SET", "INSTANCE", "SECTION", "CANVAS"]);
// Shapes the artboard cannot express as anything but a picture. Named rather
// than guessed at: a bezier network flattened into the artboard's own path
// format would land somewhere the design never was.
const VECTORS = new Set(["VECTOR", "STAR", "POLYGON", "BOOLEAN_OPERATION", "REGULAR_POLYGON"]);

export function figmaToItems(root, { newId = () => Math.random().toString(36).slice(2) } = {}) {
  const origin = root?.absoluteBoundingBox;
  if (!origin) return { items: [], images: [], warnings: ["no-geometry"], size: null };

  const items = [];
  // Image fills come back as an opaque `imageRef`; turning those into URLs is a
  // second request, and downloading them is the caller's job. Collected here so
  // the caller can resolve them in one go rather than one node at a time.
  const images = [];
  const warn = new Map();
  const note = (k) => warn.set(k, (warn.get(k) || 0) + 1);

  const box = (n) => {
    const b = n.absoluteBoundingBox;
    if (!b) return null;
    return {
      x: Math.round(b.x - origin.x), y: Math.round(b.y - origin.y),
      w: Math.round(b.width), h: Math.round(b.height),
    };
  };

  const walk = (node, inheritedOpacity) => {
    if (!node || node.visible === false) return;
    const opacity = inheritedOpacity * (node.opacity ?? 1);
    // Fully transparent is not worth carrying, and neither is what is inside it.
    if (opacity <= 0.01) return;
    const b = box(node);
    if (!b) { if (node.children) node.children.forEach(c => walk(c, opacity)); return; }

    if (node.isMask) { note("mask"); return; }
    if (node.type === "TEXT") { items.push(textItem(node, b, opacity)); return; }

    if (VECTORS.has(node.type)) { note("vector"); return; }

    const img = imageFill(node);
    if (img) {
      const id = newId();
      items.push({
        id, type: "image", x: b.x, y: b.y, w: b.w, h: b.h,
        // Figma's own scale modes, mapped to the two the artboard has.
        fit: img.scaleMode === "FIT" ? "contain" : "cover",
        // Filled in by the caller once the ref has been resolved to a URL.
        url: null,
        ...effectsOf(node, note),
        ...(opacity < 1 ? { opacity: round2(opacity) } : {}),
      });
      images.push({ id, imageRef: img.imageRef });
      // A frame can carry an image AND children; the children still belong.
      if (node.children) node.children.forEach(c => walk(c, opacity));
      return;
    }

    const grad = gradientFill(node);
    const solid = solidFill(node);
    // The gradient comes across as a gradient. Only the two shapes the artboard
    // cannot express are counted: a diamond, which becomes radial, and a radial
    // or angular one, whose centre and radius are always the middle of the box
    // here and so lose Figma's handles.
    if (grad && !solid) {
      if (grad.type === "GRADIENT_DIAMOND") note("gradient-diamond");
      else if (grad.type !== "GRADIENT_LINEAR") note("gradient-placement");
    }

    const paint = solid
      || (grad ? { gradient: gradientOf(grad), alpha: 1 } : null);

    if (node.type === "ELLIPSE") {
      items.push(shapeItem("ellipse", newId(), b, paint, node, opacity));
      return;
    }
    if (node.type === "LINE") {
      const st = strokeOf(node);
      items.push({
        id: newId(), type: "line",
        x1: b.x, y1: b.y, x2: b.x + b.w, y2: b.y + b.h,
        ...(st ? { stroke: st.color, strokeWidth: st.width } : {}),
      });
      return;
    }
    if (node.type === "RECTANGLE") {
      items.push(shapeItem("rect", newId(), b, paint, node, opacity));
      return;
    }
    if (CONTAINERS.has(node.type)) {
      // Only when it actually paints something: an invisible layout frame that
      // became a rectangle would put a box behind every group.
      if (paint) items.push(shapeItem("rect", newId(), b, paint, node, opacity));
      if (node.layoutMode && node.layoutMode !== "NONE") note("auto-layout");
      if (node.type === "INSTANCE") note("component");
      if (node.children) node.children.forEach(c => walk(c, opacity));
      return;
    }

    // Something we have no shape for. Counted, not guessed at.
    note(node.type.toLowerCase());
    if (node.children) node.children.forEach(c => walk(c, opacity));
  };

  const shapeItem = (type, id, b, paint, node, opacity) => {
    const st = strokeOf(node);
    return {
      id, type, x: b.x, y: b.y, w: b.w, h: b.h,
      // A gradient object where there is one: the artboard paints fills through
      // paintCss, which takes either.
      fill: paint?.gradient || paint?.color || "#ffffff",
      ...effectsOf(node, note),
      ...(radiiOf(node) ? { radii: radiiOf(node) } : radiusOf(node) ? { radius: radiusOf(node) } : {}),
      ...(st ? { stroke: st.color, strokeWidth: st.width } : {}),
      ...(effAlpha(opacity, paint) < 1 ? { opacity: round2(effAlpha(opacity, paint)) } : {}),
    };
  };

  const textItem = (node, b, opacity) => {
    const st = node.style || {};
    const size = Math.round(st.fontSize || 16);
    const paint = solidFill(node);
    if (!paint && gradientFill(node)) note("gradient-text");
    // A run with its own colour or size is a thing the artboard cannot hold: it
    // has one style per text item.
    if ((node.characterStyleOverrides || []).some(Boolean)) note("mixed-text-style");
    return {
      id: newId(), type: "text",
      x: b.x, y: b.y,
      // The measured box, so a line breaks where Figma broke it rather than
      // wherever the artboard's own wrapper decides.
      w: b.w,
      text: node.characters ?? "",
      size,
      weight: st.fontWeight || 400,
      color: paint?.color || "#15151c",
      align: (st.textAlignHorizontal || "LEFT").toLowerCase() === "justified"
        ? "left" : (st.textAlignHorizontal || "LEFT").toLowerCase(),
      ...(st.fontFamily ? { font: st.fontFamily } : {}),
      ...(st.italic ? { italic: true } : {}),
      // The artboard keeps line height as a MULTIPLE of the size and letter
      // spacing as a PERCENTAGE of it, so both survive a resize. Figma reports
      // both in pixels.
      ...(lineHeightMultiple(st, size) ? { lh: lineHeightMultiple(st, size) } : {}),
      ...(st.letterSpacing ? { ls: round2((st.letterSpacing / size) * 100) } : {}),
      ...effectsOf(node, note),
      ...(effAlpha(opacity, paint) < 1 ? { opacity: round2(effAlpha(opacity, paint)) } : {}),
    };
  };

  walk(root, 1);

  return {
    items,
    images,
    warnings: [...warn.entries()].map(([kind, count]) => ({ kind, count })),
    size: { w: Math.round(origin.width), h: Math.round(origin.height) },
    name: root.name || null,
    // What the top node WAS, so a missing background can be told from a frame
    // that never had one. Shapes and counts only, never anything from the
    // design itself. "It did not come" and "there was nothing to come" read
    // identically without this, and that has now cost two rounds of guessing.
    root: {
      type: root.type,
      children: (root.children || []).length,
      fills: (root.fills || []).map(f => f.type),
      legacy: !!(root.background?.length || root.backgroundColor),
    },
  };
}

// Everything, scaled by one factor. A Figma frame is whatever size somebody drew
// it, and an artboard is a fixed one; the drawing layer CLIPS, so a 1440-wide
// design dropped into a 1080-wide board keeps its background (which starts at
// 0,0 and covers the visible part) and loses the content that sits past the
// edge. Which looks exactly like an import that brought only a background.
//
// One factor for both axes, never two: a design squeezed to fit is not the
// design. Anything taller or wider than the board after fitting is still
// clipped, and that is the honest outcome of a frame with a different shape.
export function fitItems(items, from, to) {
  if (!from?.w || !from?.h || !to?.w || !to?.h) return { items, scale: 1 };
  const k = Math.min(to.w / from.w, to.h / from.h);
  // Only ever down. Blowing a small frame up to fill a big board would invent
  // a size nobody chose.
  if (k >= 1) return { items, scale: 1 };
  const r = (v) => (typeof v === "number" ? Math.round(v * k) : v);
  return {
    scale: k,
    items: items.map(it => ({
      ...it,
      ...(it.x != null ? { x: r(it.x) } : {}), ...(it.y != null ? { y: r(it.y) } : {}),
      ...(it.w != null ? { w: Math.max(1, r(it.w)) } : {}), ...(it.h != null ? { h: Math.max(1, r(it.h)) } : {}),
      ...(it.x1 != null ? { x1: r(it.x1), y1: r(it.y1), x2: r(it.x2), y2: r(it.y2) } : {}),
      // Type scales with the layout or the design stops being the design.
      ...(it.size != null ? { size: Math.max(4, Math.round(it.size * k)) } : {}),
      ...(it.radius != null ? { radius: r(it.radius) } : {}),
      ...(Array.isArray(it.radii) ? { radii: it.radii.map(r) } : {}),
      // A shadow that keeps its offset while the box halves is a shadow that
      // has moved. Its colour and opacity are not geometry and stay put.
      ...(it.shadow ? { shadow: { ...it.shadow, x: r(it.shadow.x), y: r(it.shadow.y), blur: r(it.shadow.blur) } } : {}),
      ...(it.blur != null ? { blur: r(it.blur) } : {}),
      ...(it.strokeWidth != null ? { strokeWidth: Math.max(0.5, it.strokeWidth * k) } : {}),
    })),
  };
}

const round2 = (v) => Math.round(v * 100) / 100;
const effAlpha = (opacity, paint) => opacity * (paint?.alpha ?? 1);

const lineHeightMultiple = (st, size) => {
  if (st.lineHeightUnit === "AUTO" || st.lineHeightPercentFontSize == null && st.lineHeightPx == null) return null;
  if (st.lineHeightPercentFontSize != null) return round2(st.lineHeightPercentFontSize / 100);
  return size ? round2(st.lineHeightPx / size) : null;
};

const strokeOf = (node) => {
  const s = (node.strokes || []).find(s => s.visible !== false && s.type === "SOLID");
  if (!s || !node.strokeWeight) return null;
  return { color: hex(s.color), width: node.strokeWeight };
};

// figma.com/design/<key>/<slug>?node-id=1-23  →  { key, nodeId: "1:23" }
// Both /file/ and /design/ appear in the wild, and the node id is written with
// a dash in a URL and a colon everywhere in the API.
export function parseFigmaUrl(raw) {
  let u;
  try { u = new URL(String(raw || "").trim()); } catch { return null; }
  if (!/(^|\.)figma\.com$/.test(u.hostname)) return null;
  const m = u.pathname.match(/\/(?:file|design|proto)\/([A-Za-z0-9]+)/);
  if (!m) return null;
  const node = u.searchParams.get("node-id");
  return { key: m[1], nodeId: node ? node.replace(/-/g, ":") : null };
}
