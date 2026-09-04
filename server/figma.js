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

const visibleFills = (node) => (node.fills || []).filter(f => f.visible !== false && (f.opacity ?? 1) > 0);

// The first fill that is a flat colour. Gradients are handled separately and
// deliberately: approximating one with a single colour is a lie worth
// declaring, not one worth hiding.
const solidFill = (node) => {
  const f = visibleFills(node).find(f => f.type === "SOLID");
  return f ? { color: hex(f.color), alpha: (f.opacity ?? 1) * (f.color?.a ?? 1) } : null;
};

const gradientFill = (node) =>
  visibleFills(node).find(f => typeof f.type === "string" && f.type.startsWith("GRADIENT_")) || null;

const imageFill = (node) => visibleFills(node).find(f => f.type === "IMAGE" && f.imageRef) || null;

// Figma's own corner radius, or the largest of the four when they differ: the
// artboard has one radius per rectangle, so four different corners cannot be
// carried and the nearest single value is the honest answer.
const radiusOf = (node) => {
  if (typeof node.cornerRadius === "number") return node.cornerRadius || undefined;
  const r = node.rectangleCornerRadii;
  return Array.isArray(r) && r.some(Boolean) ? Math.max(...r) : undefined;
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
        ...(opacity < 1 ? { opacity: round2(opacity) } : {}),
      });
      images.push({ id, imageRef: img.imageRef });
      // A frame can carry an image AND children; the children still belong.
      if (node.children) node.children.forEach(c => walk(c, opacity));
      return;
    }

    const grad = gradientFill(node);
    const solid = solidFill(node);
    if (grad && !solid) note("gradient");

    const paint = solid
      // A gradient becomes its first stop. Lossy, and said so in warnings.
      || (grad ? { color: hex(grad.gradientStops?.[0]?.color || {}), alpha: grad.opacity ?? 1 } : null);

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
      fill: paint?.color || "#ffffff",
      ...(radiusOf(node) ? { radius: radiusOf(node) } : {}),
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
