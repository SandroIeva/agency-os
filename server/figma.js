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
// constraints, components or masks. Supported effects are kept on primitives. So a frame arrives flattened, and
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

// Layer blur and shadows use the artboard filter. Background blur has its
// own bgBlur field, rendered with backdrop-filter and a clipped canvas snapshot
// on export. It must not become layer blur: that would blur the foreground.
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
  const backgrounds = fx.filter(e => e.type === "BACKGROUND_BLUR" && Number.isFinite(e.radius) && e.radius > 0);
  if (backgrounds.length) {
    // Text needs a glyph-shaped backdrop mask, which the editor does not have.
    if (node.type === "TEXT") note("background-blur");
    else {
      out.bgBlur = backgrounds[0].radius;
      if (backgrounds.length > 1) note("background-blur-stack");
      if (backgrounds[0].blurType === "PROGRESSIVE") note("background-blur-progressive");
    }
  }
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

// ── SVG path data → the artboard's own path nodes ────────────────────────────
//
// Figma hands geometry over as an SVG `d` string. The artboard stores a path as
// NODES with absolute bezier handles: h2 leaves a node, h1 arrives at the next,
// and a segment with neither is a straight line. pathSeg in App.jsx is the other
// half of this contract, and reading it is how these names were chosen.
//
// One entry per SUBPATH, because a `d` routinely holds several (a letter with a
// counter, a boolean result) while an artboard path is one shape with one
// `closed` flag.
//
// Everything becomes a cubic. A quadratic has an exact cubic equivalent, so
// that conversion loses nothing. An elliptical arc does not, and rather than
// approximate one badly it is drawn as a straight line to its endpoint and
// counted out loud. Figma emits M, L, C and Z for its own geometry, so this is
// a guard on the unexpected rather than a common path.
const NUM = /-?\d*\.?\d+(?:[eE][-+]?\d+)?/g;
const CMD = /([MmLlHhVvCcSsQqTtAaZz])([^MmLlHhVvCcSsQqTtAaZz]*)/g;

export function svgPathToSubpaths(d, note = () => {}) {
  const out = [];
  let cur = null;                       // { nodes, closed }
  let cx = 0, cy = 0;                   // current point
  let sx = 0, sy = 0;                   // where this subpath began
  let lastC = null;                     // previous cubic's second control, for S
  let lastQ = null;                     // previous quadratic's control, for T

  const open = (x, y) => { cur = { nodes: [{ x, y }], closed: false }; out.push(cur); };
  const last = () => cur && cur.nodes[cur.nodes.length - 1];
  // A command before any M is not a path we can place.
  const ready = () => { if (!cur) open(cx, cy); return true; };
  const lineTo = (x, y) => { ready(); cur.nodes.push({ x, y }); cx = x; cy = y; lastC = null; lastQ = null; };
  const curveTo = (c1x, c1y, c2x, c2y, x, y) => {
    ready();
    const a = last();
    a.h2x = c1x; a.h2y = c1y;
    cur.nodes.push({ x, y, h1x: c2x, h1y: c2y });
    cx = x; cy = y; lastC = [c2x, c2y]; lastQ = null;
  };
  // A quadratic IS a cubic: both controls sit two thirds of the way out.
  const quadTo = (qx, qy, x, y) => {
    const c1x = cx + (2 / 3) * (qx - cx), c1y = cy + (2 / 3) * (qy - cy);
    const c2x = x + (2 / 3) * (qx - x), c2y = y + (2 / 3) * (qy - y);
    curveTo(c1x, c1y, c2x, c2y, x, y);
    lastQ = [qx, qy];
  };

  for (const m of String(d || "").matchAll(CMD)) {
    const code = m[1];
    const rel = code === code.toLowerCase() && code !== "Z" && code !== "z";
    const n = (m[2].match(NUM) || []).map(Number);
    const up = code.toUpperCase();

    if (up === "Z") { if (cur) { cur.closed = true; cx = sx; cy = sy; } lastC = null; lastQ = null; continue; }

    // Each command takes a fixed number of arguments and may repeat them. A
    // repeated M is an L, which is what the spec says and what Figma relies on.
    const take = { M: 2, L: 2, H: 1, V: 1, C: 6, S: 4, Q: 4, T: 2, A: 7 }[up];
    if (!take) continue;
    for (let i = 0; i + take <= n.length; i += take) {
      const a = n.slice(i, i + take);
      if (up === "M") {
        const x = rel ? cx + a[0] : a[0], y = rel ? cy + a[1] : a[1];
        if (i === 0) { open(x, y); sx = x; sy = y; cx = x; cy = y; lastC = null; lastQ = null; }
        else lineTo(x, y);
      } else if (up === "L") {
        lineTo(rel ? cx + a[0] : a[0], rel ? cy + a[1] : a[1]);
      } else if (up === "H") {
        lineTo(rel ? cx + a[0] : a[0], cy);
      } else if (up === "V") {
        lineTo(cx, rel ? cy + a[0] : a[0]);
      } else if (up === "C") {
        curveTo(rel ? cx + a[0] : a[0], rel ? cy + a[1] : a[1],
                rel ? cx + a[2] : a[2], rel ? cy + a[3] : a[3],
                rel ? cx + a[4] : a[4], rel ? cy + a[5] : a[5]);
      } else if (up === "S") {
        // The missing control is the previous one mirrored through the point.
        const c1x = lastC ? 2 * cx - lastC[0] : cx, c1y = lastC ? 2 * cy - lastC[1] : cy;
        curveTo(c1x, c1y,
                rel ? cx + a[0] : a[0], rel ? cy + a[1] : a[1],
                rel ? cx + a[2] : a[2], rel ? cy + a[3] : a[3]);
      } else if (up === "Q") {
        quadTo(rel ? cx + a[0] : a[0], rel ? cy + a[1] : a[1],
               rel ? cx + a[2] : a[2], rel ? cy + a[3] : a[3]);
      } else if (up === "T") {
        const qx = lastQ ? 2 * cx - lastQ[0] : cx, qy = lastQ ? 2 * cy - lastQ[1] : cy;
        quadTo(qx, qy, rel ? cx + a[0] : a[0], rel ? cy + a[1] : a[1]);
      } else if (up === "A") {
        note("vector-arc");
        lineTo(rel ? cx + a[5] : a[5], rel ? cy + a[6] : a[6]);
      }
    }
  }
  // A subpath of one point draws nothing.
  return out.filter(sp => sp.nodes.length >= 2);
}

export function figmaToItems(root, { newId = () => Math.random().toString(36).slice(2) } = {}) {
  const origin = root?.absoluteBoundingBox;
  if (!origin) return { items: [], images: [], warnings: ["no-geometry"], size: null };

  const items = [];
  // Image fills come back as an opaque `imageRef`; turning those into URLs is a
  // second request, and downloading them is the caller's job. Collected here so
  // the caller can resolve them in one go rather than one node at a time.
  const images = [];
  let convertedAutoLayouts = 0;
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

  // Figma already resolves padding, spacing, wrapping and hug/fill sizes into
  // absoluteBoundingBox. Keep those positions; do not run a second layout engine.
  const appendContainer = (node, b, opacity, surface) => {
    const children = node.itemReverseZIndex && node.layoutMode && node.layoutMode !== "NONE"
      ? [...(node.children || [])].reverse() : node.children || [];
    let outline = null;
    if (surface?.strokeWidth && children.length) {
      // The frame's border is above its content. Keep it editable as a separate
      // transparent shape, so edge-to-edge children cannot cover the outline.
      outline = {
        id: newId(), type: "rect", x: b.x, y: b.y, w: b.w, h: b.h,
        ...(curGid ? { groupId: curGid } : {}),
        fill: "transparent", stroke: surface.stroke,
        strokeWidth: surface.strokeWidth, strokeAlpha: surface.strokeAlpha,
        ...(surface.radius != null ? { radius: surface.radius } : {}),
        ...(surface.radii ? { radii: surface.radii } : {}),
        ...(surface.opacity != null ? { opacity: surface.opacity } : {}),
      };
      delete surface.stroke;
      delete surface.strokeWidth;
      delete surface.strokeAlpha;
    }
    if (surface && (surface.type === "image" || surface.fill !== "transparent"
        || surface.bgBlur || surface.blur || surface.shadow || !outline)) items.push(surface);
    children.forEach(child => walk(child, opacity));
    if (outline) items.push(outline);
    if (node.layoutMode && node.layoutMode !== "NONE") convertedAutoLayouts++;
    if (node.type === "INSTANCE") note("component");
  };

  // What Figma calls a group, the artboard calls a group. Everything a
  // container produces gets one id, so a thing that was one object over there
  // is one object here.
  //
  // Only these four: a SECTION or a CANVAS is the page, and grouping a whole
  // page is not what anybody meant by grouping. The imported node itself is
  // excluded too, or every import would arrive as a single group containing
  // all of it.
  //
  // ONE level, because that is all `groupId` can carry. The OUTERMOST container
  // wins, so what you would drag in Figma is what you drag here; an inner group
  // keeps the id it already has rather than minting its own.
  const GROUPABLE = new Set(["GROUP", "COMPONENT", "INSTANCE", "FRAME"]);
  let curGid = null;

  const walk = (node, inheritedOpacity) => {
    const outer = curGid;
    const mints = !curGid && node && node !== root && GROUPABLE.has(node.type);
    const gid = mints ? newId() : null;
    if (mints) curGid = gid;
    const before = items.length;
    try {
      walkNode(node, inheritedOpacity);
    } finally {
      curGid = outer;
    }
    if (!mints) return;
    // A group of one is not a group. A frame holding a single rectangle would
    // otherwise arrive as a group nobody can see the point of, and a container
    // that produced nothing at all would leave an id on no items.
    const mine = items.slice(before).filter(i => i.groupId === gid);
    if (mine.length < 2) for (const i of mine) delete i.groupId;
  };

  const walkNode = (node, inheritedOpacity) => {
    if (!node || node.visible === false) return;
    const opacity = inheritedOpacity * (node.opacity ?? 1);
    // Fully transparent is not worth carrying, and neither is what is inside it.
    if (opacity <= 0.01) return;
    const b = box(node);
    if (!b) { if (node.children) node.children.forEach(c => walk(c, opacity)); return; }

    if (node.isMask) { note("mask"); return; }
    if (node.type === "TEXT") { items.push(textItem(node, b, opacity)); return; }

    if (VECTORS.has(node.type)) {
      const paths = vectorItems(node, b, opacity);
      if (paths.length) { paths.forEach(i => items.push(i)); return; }
      // No geometry came back, so there is still nothing to draw. Counted as
      // before rather than passed over in silence.
      note("vector");
      return;
    }

    const img = imageFill(node);
    if (img) {
      const id = newId();
      const st = strokeOf(node);
      const surface = {
        id, type: "image", x: b.x, y: b.y, w: b.w, h: b.h,
        ...(curGid ? { groupId: curGid } : {}),
        // Figma's own scale modes, mapped to the two the artboard has.
        fit: img.scaleMode === "FIT" ? "contain" : "cover",
        // Filled in by the caller once the ref has been resolved to a URL.
        url: null,
        ...(st ? { stroke: st.color, strokeWidth: st.width, strokeAlpha: st.alpha } : {}),
        ...effectsOf(node, note),
        ...(radiiOf(node) ? { radii: radiiOf(node) } : radiusOf(node) ? { radius: radiusOf(node) } : {}),
        ...(opacity < 1 ? { opacity: round2(opacity) } : {}),
      };
      images.push({ id, imageRef: img.imageRef });
      if (CONTAINERS.has(node.type)) appendContainer(node, b, opacity, surface);
      else items.push(surface);
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
        ...(curGid ? { groupId: curGid } : {}),
        x1: b.x, y1: b.y, x2: b.x + b.w, y2: b.y + b.h,
        ...(st ? { stroke: st.color, strokeWidth: st.width, strokeAlpha: st.alpha } : {}),
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
      const hasBackdrop = (node.effects || []).some(e => e.type === "BACKGROUND_BLUR" && e.visible !== false && Number.isFinite(e.radius) && e.radius > 0);
      const surface = paint || hasBackdrop || strokeOf(node)
        ? shapeItem("rect", newId(), b, paint, node, opacity) : null;
      appendContainer(node, b, opacity, surface);
      return;
    }

    // Something we have no shape for. Counted, not guessed at.
    note(node.type.toLowerCase());
    if (node.children) node.children.forEach(c => walk(c, opacity));
  };

  // A drawn shape as the artboard stores one. Figma's geometry is in the node's
  // own coordinates, which is exactly what ox/oy are for: the numbers stay local
  // and the offset places them, so dragging and the arrow keys move it the way
  // they move any other path.
  const vectorItems = (node, b, opacity) => {
    const geo = (Array.isArray(node.fillGeometry) && node.fillGeometry.length)
      ? node.fillGeometry
      : (Array.isArray(node.strokeGeometry) ? node.strokeGeometry : []);
    if (!geo.length) return [];
    const st = strokeOf(node);
    const solid = solidFill(node);
    const grad = gradientFill(node);
    // The path renderer paints a colour string and nothing else, so a gradient
    // becomes its first stop. A visible shape in one colour beats an invisible
    // one in the right colours, and it is counted so nobody has to guess why.
    let fill = "transparent";
    if (solid) fill = solid.color;
    else if (grad) {
      const stop = grad.gradientStops?.[0]?.color;
      if (stop) { fill = hex(stop); note("vector-gradient"); }
    }
    const out = [];
    for (const g of geo) {
      for (const sp of svgPathToSubpaths(g.path, note)) {
        out.push({
          id: newId(), type: "path", ox: b.x, oy: b.y,
          nodes: sp.nodes, closed: sp.closed, fill,
          color: st ? st.color : "transparent",
          width: st ? st.width : 0,
          ...(curGid ? { groupId: curGid } : {}),
        });
      }
    }
    // Several subpaths are one object to whoever drew it. Grouped here when
    // they are not already inside a group, so a letter with a counter or a
    // boolean result stays one thing to click.
    if (out.length > 1 && !curGid) {
      const g = newId();
      for (const i of out) i.groupId = g;
    }
    return out;
  };

  const shapeItem = (type, id, b, paint, node, opacity) => {
    const st = strokeOf(node);
    return {
      id, type, x: b.x, y: b.y, w: b.w, h: b.h,
      ...(curGid ? { groupId: curGid } : {}),
      // A gradient object where there is one: the artboard paints fills through
      // paintCss, which takes either.
      fill: paint?.gradient || paint?.color || "transparent",
      ...effectsOf(node, note),
      ...(radiiOf(node) ? { radii: radiiOf(node) } : radiusOf(node) ? { radius: radiusOf(node) } : {}),
      ...(st ? { stroke: st.color, strokeWidth: st.width, strokeAlpha: st.alpha } : {}),
      // A translucent fill must not fade the blur and shadow with it.
      ...(paint && paint.alpha < 1 ? { fillAlpha: round2(paint.alpha * 100) } : {}),
      ...(opacity < 1 ? { opacity: round2(opacity) } : {}),
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
      ...(curGid ? { groupId: curGid } : {}),
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
    convertedAutoLayouts,
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
      ...(it.bgBlur != null ? { bgBlur: round2(it.bgBlur * k) } : {}),
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
  return { color: hex(s.color), width: node.strokeWeight,
    alpha: round2(Math.max(0, Math.min(1, (s.opacity ?? 1) * (s.color?.a ?? 1))) * 100) };
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
