/* svg2code.mjs —— 把 SVG 转成"纯代码贴图"
用法：node svg2code.mjs 图.svg [函数名]

为什么值得做：同一张 128px 的图标，PNG 通常 5~20 KB，矢量代码常常只有 1~3 KB，
而且任意倍率都不糊、可以随时换色、还能拿去做形变动画。

流程：
  Inkscape 画好 → 另存为 Plain SVG（别用 Inkscape SVG，那里面全是编辑器私有属性）
  → 本脚本只抽几何 → 生成一份路径数据 + 一个绘制函数
*/
import fs from "node:fs";

const src = process.argv[2];
const fnName = process.argv[3] || "drawArt";
if (!src) { console.log("用法: node svg2code.mjs 图.svg [函数名]"); process.exit(1); }
const svg = fs.readFileSync(src, "utf8");

const num = (v) => {
  const n = Number(v);
  if (!isFinite(n)) return 0;
  return Math.round(n * 100) / 100;
};
const squeeze = (d) => d
  .replace(/(\d)\.(\d{3,})/g, (m, a, b) => a + "." + b.slice(0, 2))
  .replace(/(\d+)\.(\d*?)0+(?![\d.])/g, (m, a, b) => a + (b ? "." + b : ""))
  .replace(/\s+/g, " ")
  .replace(/ ?, ?/g, " ")
  .trim();
const attr = (s, k) => {
  const m = s.match(new RegExp("\\s" + k + '="([^"]*)"'));
  return m ? m[1] : null;
};
/* Inkscape 导出的样式大多写在 style="..." 里，而不是独立的 fill= 属性 */
const styleOf = (s, k) => {
  const st = attr(s, "style");
  if (!st) return null;
  const m = st.match(new RegExp(k + ":\\s*([^;\"]+)"));
  return m ? m[1].trim() : null;
};
const paint = (s, k, dflt) => attr(s, k) || styleOf(s, k) || dflt;

/* 关键：按文档顺序扫描，不能按标签类型分批 ——
   否则先提取的路径会盖住后提取的圆，图层顺序就乱了 */
const hits = [];
for (const m of svg.matchAll(/<(path|circle|ellipse|rect|polygon|line)\b([^>]*?)\/?>/g)) {
  hits.push({ idx: m.index, tag: m[1], a: m[2] });
}
hits.sort((x, y) => x.idx - y.idx);

const items = [];
for (const h of hits) {
  const a = h.a;
  const fill = paint(a, "fill", "#dfe6f5");
  if (fill === "none" || fill === "transparent") continue;
  const stroke = paint(a, "stroke", null);
  const swv = paint(a, "stroke-width", null);
  const sw = swv ? num(swv) : 0;

  if (h.tag === "path") {
    const d = attr(a, "d");
    if (!d) continue;
    items.push({ p: squeeze(d), f: fill, s: stroke, w: sw });
  } else if (h.tag === "circle") {
    const r = num(attr(a, "r") || 0);
    if (r > 0) items.push({ c: [num(attr(a, "cx") || 0), num(attr(a, "cy") || 0), r], f: fill,
      s: stroke, w: sw });
  } else if (h.tag === "ellipse") {
    items.push({ e: [num(attr(a, "cx") || 0), num(attr(a, "cy") || 0),
      num(attr(a, "rx") || 0), num(attr(a, "ry") || 0)], f: fill, s: stroke, w: sw });
  } else if (h.tag === "rect") {
    const x = num(attr(a, "x") || 0), y = num(attr(a, "y") || 0);
    const w = num(attr(a, "width") || 0), hh = num(attr(a, "height") || 0);
    const rx = num(attr(a, "rx") || 0);
    if (w <= 0 || hh <= 0) continue;
    const d = rx > 0
      ? "M" + (x + rx) + " " + y + "h" + (w - 2 * rx) + "a" + rx + " " + rx + " 0 0 1 " + rx + " " + rx +
        "v" + (hh - 2 * rx) + "a" + rx + " " + rx + " 0 0 1 " + (-rx) + " " + rx +
        "h" + (-(w - 2 * rx)) + "a" + rx + " " + rx + " 0 0 1 " + (-rx) + " " + (-rx) +
        "v" + (-(hh - 2 * rx)) + "a" + rx + " " + rx + " 0 0 1 " + rx + " " + (-rx) + "z"
      : "M" + x + " " + y + "h" + w + "v" + hh + "h" + (-w) + "z";
    items.push({ p: squeeze(d), f: fill, s: stroke, w: sw });
  } else if (h.tag === "polygon" || h.tag === "line") {
    const pts = attr(a, h.tag === "line" ? "points" : "points") ||
      ((attr(a, "x1") || 0) + " " + (attr(a, "y1") || 0) + " " + (attr(a, "x2") || 0) + " " + (attr(a, "y2") || 0));
    const nums = String(pts).trim().split(/[\s,]+/).map(Number);
    let d = "";
    for (let i = 0; i + 1 < nums.length; i += 2) {
      d += (i === 0 ? "M" : "L") + num(nums[i]) + " " + num(nums[i + 1]);
    }
    if (!d) continue;
    items.push({ p: d + (h.tag === "polygon" ? "z" : ""), f: fill, s: stroke, w: sw });
  }
}

if (!items.length) { console.log("这个 SVG 里没抽到图形（可能是纯文本、位图嵌入或用了 transform）"); process.exit(1); }

const U = "ART_" + fnName.toUpperCase();
const lines = [
  "/* 由 svg2code.mjs 从 " + src.split(/[\\/]/).pop() + " 生成 —— 纯代码图形，无位图依赖 */",
  "var " + U + " = " + JSON.stringify(items) + ";",
  "function " + fnName + "(g, cx, cy, scale) {",
  "  cx = cx || 0; cy = cy || 0; scale = scale || 1;",
  "  g.save();",
  "  g.translate(cx, cy);",
  "  g.scale(scale, scale);",
  "  for (var i = 0; i < " + U + ".length; i++) {",
  "    var s = " + U + "[i];",
  "    if (s.p) {",
  "      var P = new Path2D(s.p);",
  "      g.fillStyle = s.f; g.fill(P);",
  "      if (s.s) { g.strokeStyle = s.s; g.lineWidth = s.w || 1; g.stroke(P); }",
  "    } else if (s.c) {",
  "      g.beginPath(); g.arc(s.c[0], s.c[1], s.c[2], 0, 6.2832);",
  "      g.fillStyle = s.f; g.fill();",
  "      if (s.s) { g.strokeStyle = s.s; g.lineWidth = s.w || 1; g.stroke(); }",
  "    } else if (s.e) {",
  "      g.beginPath(); g.ellipse(s.e[0], s.e[1], s.e[2], s.e[3], 0, 0, 6.2832);",
  "      g.fillStyle = s.f; g.fill();",
  "      if (s.s) { g.strokeStyle = s.s; g.lineWidth = s.w || 1; g.stroke(); }",
  "    }",
  "  }",
  "  g.restore();",
  "}"
];
const out = lines.join("\n");
console.log(out);
console.error("[统计] 图形 " + items.length + " 个，代码 " + out.length + " 字节");
