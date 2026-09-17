// A rotated Figma vector, and a stroke that must not be painted twice.
//
// Both were real: six chevrons pointing right arrived as a zigzag pointing up,
// at roughly double the line weight. The geometry comes over unrotated in the
// node's own coordinates while absoluteBoundingBox is the box AFTER rotation,
// and `strokeGeometry` is the stroke already outlined as an area, which we then
// stroked a second time.
//
// The third case is the one that guards every import that was already fine: an
// upright node must come out exactly as it did before.
import { figmaToItems } from "../server/figma.js";

let failed = 0;
const ok = (cond, what) => {
  if (cond) console.log("Passed: " + what);
  else { console.error("FAILED: " + what); failed++; }
};
const near = (a, b) => Math.abs(a - b) < 0.51;

// An upward chevron in its own coordinates: apex at the top middle.
const CHEVRON = "M 0 10 L 10 0 L 20 10";
const vector = (extra) => ({
  type: "VECTOR", id: "1:2", name: "arrow",
  strokes: [{ type: "SOLID", visible: true, color: { r: 1, g: 1, b: 1, a: 1 } }],
  strokeWeight: 4,
  fills: [],
  strokeGeometry: [{ path: CHEVRON, windingRule: "NONZERO" }],
  ...extra,
});
const frame = (child) => ({
  type: "FRAME", id: "1:1", name: "root",
  absoluteBoundingBox: { x: 0, y: 0, width: 100, height: 100 },
  children: [child],
});

// ── 1. Rotated by 90°, so the chevron ends up pointing right ────────────────
// [[0,-1,tx],[1,0,ty]] sends (dx,dy) to (-dy,dx). The 20x10 shape becomes a
// 10x20 box, which is what absoluteBoundingBox reports.
const rotated = figmaToItems(frame(vector({
  relativeTransform: [[0, -1, 0], [1, 0, 0]],
  size: { x: 20, y: 10 },
  absoluteBoundingBox: { x: 0, y: 0, width: 10, height: 20 },
})));
const rp = rotated.items.find(i => i.type === "path");
ok(!!rp, "a rotated vector still arrives as a path");
if (rp) {
  ok(rp.ox === 0 && rp.oy === 0, "placed points carry their own position, so the offset is zero");
  const pts = rp.nodes.map(n => [n.x, n.y]);
  // apex (10,0) is now the RIGHTMOST point: the chevron points right.
  const apex = pts.reduce((a, p) => (p[0] > a[0] ? p : a), pts[0]);
  ok(near(apex[0], 10) && near(apex[1], 10), "the apex turned to the right edge, so the arrow points right");
  const xs = pts.map(p => p[0]), ys = pts.map(p => p[1]);
  ok(near(Math.min(...xs), 0) && near(Math.max(...xs), 10)
     && near(Math.min(...ys), 0) && near(Math.max(...ys), 20),
     "the rotated points fill exactly the box Figma reported");
}

// ── 2. An outlined stroke is a FILL, and must not be stroked again ──────────
ok(rp && rp.width === 0 && rp.color === "transparent",
   "an outlined stroke is not stroked a second time");
ok(rp && typeof rp.fill === "string" && rp.fill !== "transparent",
   "it is filled with the stroke's own colour instead");

// ── 3. Upright: byte for byte what it was before ────────────────────────────
const upright = figmaToItems(frame(vector({
  relativeTransform: [[1, 0, 30], [0, 1, 40]],
  size: { x: 20, y: 10 },
  absoluteBoundingBox: { x: 30, y: 40, width: 20, height: 10 },
})));
const up = upright.items.find(i => i.type === "path");
ok(!!up && up.ox === 30 && up.oy === 40, "an upright node keeps the offset placement it always had");
ok(!!up && near(up.nodes[0].x, 0) && near(up.nodes[0].y, 10)
   && near(up.nodes[1].x, 10) && near(up.nodes[1].y, 0),
   "and its points are untouched, so every import that was already right stays right");

// A node with no transform at all must behave the same way.
const bare = figmaToItems(frame(vector({
  absoluteBoundingBox: { x: 5, y: 6, width: 20, height: 10 },
})));
const bp = bare.items.find(i => i.type === "path");
ok(!!bp && bp.ox === 5 && bp.oy === 6 && near(bp.nodes[1].x, 10),
   "a node without relativeTransform is placed the old way, not dropped");

// ── 4. The real file: the pasted frame is itself turned on the Figma canvas ──
// Numbers from the function log of the actual import. The frame is 1920x1080
// and relativeTransform [[0,-1,-3025],[1,0,-2000]] shows it upright at
// 1080x1920. An upward chevron inside it, upright relative to the frame, must
// arrive turned with the frame. Worked by hand: board point = (1030 - y, x + 100).
const realRoot = (children) => ({
  type: "FRAME", id: "647:121", name: "figma",
  relativeTransform: [[0, -1, -3025], [1, 0, -2000]],
  size: { x: 1920, y: 1080 },
  absoluteBoundingBox: { x: -4105, y: -2000, width: 1080, height: 1920 },
  fills: [], strokes: [], children,
});
const inTurnedFrame = figmaToItems(realRoot([vector({
  id: "9:1",
  relativeTransform: [[1, 0, 100], [0, 1, 50]],
  size: { x: 20, y: 10 },
  absoluteBoundingBox: { x: -3085, y: -1900, width: 10, height: 20 },
})]));
const tp = inTurnedFrame.items.find(i => i.type === "path");
ok(!!tp, "a vector in a frame turned on the Figma canvas arrives");
if (tp) {
  const got = tp.nodes.map(n => [n.x + (tp.ox || 0), n.y + (tp.oy || 0)]);
  ok(near(got[0][0], 1020) && near(got[0][1], 100) && near(got[1][0], 1030) && near(got[1][1], 110)
     && near(got[2][0], 1020) && near(got[2][1], 120),
     "its points land exactly where the whole transform chain puts them, pointing right");
}

// ── 5. Groups count: an ellipse-sized square two groups deep ─────────────────
// The real chain from the log. Only multiplying the groups in gives Figma's own
// box, x 315..765 and y 733..1183 on the board.
const deep = figmaToItems(realRoot([{
  type: "GROUP", id: "9:2", relativeTransform: [[1, 0, 436], [0, 1, 158.906]],
  absoluteBoundingBox: { x: -3946, y: -1564, width: 762, height: 1048 },
  children: [{
    type: "GROUP", id: "9:3", relativeTransform: [[-1, 0, 746.969], [0, -1, 606.094]],
    absoluteBoundingBox: { x: -3790, y: -1267, width: 450, height: 450 },
    children: [{
      ...vector({ id: "9:4", relativeTransform: [[1, 0, 0], [0, 1, 0]], size: { x: 450, y: 450 },
        absoluteBoundingBox: { x: -3790, y: -1267, width: 450, height: 450 } }),
      strokeGeometry: [{ path: "M 0 0 L 450 0 L 450 450 L 0 450 Z", windingRule: "NONZERO" }],
    }],
  }],
}]));
const dp = deep.items.find(i => i.type === "path");
if (dp) {
  const xs = dp.nodes.map(n => n.x + (dp.ox || 0)), ys = dp.nodes.map(n => n.y + (dp.oy || 0));
  ok(near(Math.min(...xs), 315) && near(Math.max(...xs), 765) && near(Math.min(...ys), 733) && near(Math.max(...ys), 1183),
     "two groups deep, the shape lands in exactly the box Figma reports");
} else ok(false, "the deep vector arrives");

process.exit(failed ? 1 : 0);
