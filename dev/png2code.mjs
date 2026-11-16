/* png2code.mjs —— 手机画的位图 → 纯代码矢量路径
用法：node png2code.mjs 图.png [函数名] [容差]
容差默认 1.2（像素），越大越简化、代码越短、细节越少。

它干的事：解 PNG → 按 alpha/亮度二值化 → 沿像素边界描出所有轮廓环
→ Douglas-Peucker 简化 → 输出可直接粘进游戏的 Path2D 代码。

只支持 8 位、非隔行的 PNG（手机绘画 App 导出的基本都是）。
透明背景最好；白底也行（会自动把接近白/接近背景色的当"空"）。
*/
import fs from "node:fs";
import zlib from "node:zlib";

const src = process.argv[2];
const fnName = process.argv[3] || "drawArt";
const TOL = Number(process.argv[4] || 1.2);
if (!src) { console.log("用法: node png2code.mjs 图.png [函数名] [容差]"); process.exit(1); }

/* ---------------- PNG 解码 ---------------- */
function decodePNG(buf) {
  if (buf.readUInt32BE(0) !== 0x89504e47) throw new Error("不是 PNG 文件");
  let pos = 8, w = 0, h = 0, bitDepth = 0, colorType = 0, interlace = 0;
  const idat = [];
  while (pos < buf.length) {
    const len = buf.readUInt32BE(pos);
    const type = buf.toString("ascii", pos + 4, pos + 8);
    const data = buf.subarray(pos + 8, pos + 8 + len);
    if (type === "IHDR") {
      w = data.readUInt32BE(0); h = data.readUInt32BE(4);
      bitDepth = data[8]; colorType = data[9]; interlace = data[12];
    } else if (type === "IDAT") idat.push(data);
    else if (type === "IEND") break;
    pos += 12 + len;
  }
  if (bitDepth !== 8) throw new Error("只支持 8 位色深的 PNG（你的图是 " + bitDepth + " 位）");
  if (interlace !== 0) throw new Error("不支持隔行扫描的 PNG，导出时关掉 Interlace");
  const ch = { 0: 1, 2: 3, 4: 2, 6: 4 }[colorType];
  if (!ch) throw new Error("不支持的颜色类型 " + colorType + "（调色板图请先转成 RGBA）");
  const raw = zlib.inflateSync(Buffer.concat(idat));
  const stride = w * ch;
  const out = Buffer.alloc(w * h * 4);
  let prev = Buffer.alloc(stride), cur = Buffer.alloc(stride);
  let p = 0;
  for (let y = 0; y < h; y++) {
    const ft = raw[p++];
    raw.copy(cur, 0, p, p + stride); p += stride;
    for (let i = 0; i < stride; i++) {
      const a = i >= ch ? cur[i - ch] : 0;
      const b = prev[i];
      const c = i >= ch ? prev[i - ch] : 0;
      let v = cur[i];
      if (ft === 1) v += a;
      else if (ft === 2) v += b;
      else if (ft === 3) v += (a + b) >> 1;
      else if (ft === 4) {
        const pa = Math.abs(b - c), pb = Math.abs(a - c), pc = Math.abs(a + b - 2 * c);
        v += (pa <= pb && pa <= pc) ? a : (pb <= pc ? b : c);
      }
      cur[i] = v & 255;
    }
    for (let x = 0; x < w; x++) {
      const o = (y * w + x) * 4, s = x * ch;
      if (ch === 1) { out[o] = out[o + 1] = out[o + 2] = cur[s]; out[o + 3] = 255; }
      else if (ch === 2) { out[o] = out[o + 1] = out[o + 2] = cur[s]; out[o + 3] = cur[s + 1]; }
      else if (ch === 3) { out[o] = cur[s]; out[o + 1] = cur[s + 1]; out[o + 2] = cur[s + 2]; out[o + 3] = 255; }
      else { out[o] = cur[s]; out[o + 1] = cur[s + 1]; out[o + 2] = cur[s + 2]; out[o + 3] = cur[s + 3]; }
    }
    const t = prev; prev = cur; cur = t;
  }
  return { w, h, rgba: out };
}

/* ---------------- 轮廓追踪 ---------------- */
function trace(mask, w, h, onCount) {
  const solid = (x, y) => (x < 0 || y < 0 || x >= w || y >= h) ? false : mask[y * w + x] === 1;
  const edges = new Map();
  const add = (x1, y1, x2, y2) => {
    const k = x1 + "," + y1;
    let a = edges.get(k);
    if (!a) { a = []; edges.set(k, a); }
    a.push([x2, y2]);
  };
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (!solid(x, y)) continue;
      if (!solid(x, y - 1)) add(x + 1, y, x, y);
      if (!solid(x, y + 1)) add(x, y + 1, x + 1, y + 1);
      if (!solid(x - 1, y)) add(x, y, x, y + 1);
      if (!solid(x + 1, y)) add(x + 1, y + 1, x + 1, y);
    }
  }
  console.error("[debug] 实心像素 " + onCount + "，有向边起点 " + edges.size);
  const loops = [];
  for (const startKey of Array.from(edges.keys())) {
    let list = edges.get(startKey);
    while (list && list.length) {
      let cx = Number(startKey.split(",")[0]), cy = Number(startKey.split(",")[1]);
      const loop = [[cx, cy]];
      let guard = 0;
      while (guard++ < 4000000) {
        const arr = edges.get(cx + "," + cy);
        if (!arr || !arr.length) break;
        const nx = arr.pop();
        cx = nx[0]; cy = nx[1];
        if (cx === loop[0][0] && cy === loop[0][1]) break;
        loop.push([cx, cy]);
      }
      if (loop.length > 2) loops.push(loop);
      list = edges.get(startKey);
    }
  }
  return loops;
}

/* ---------------- Douglas-Peucker ---------------- */
function rdp(pts, eps) {
  if (pts.length < 3) return pts;
  let dmax = 0, idx = 0;
  const a = pts[0], b = pts[pts.length - 1];
  const dx = b[0] - a[0], dy = b[1] - a[1];
  const len = Math.sqrt(dx * dx + dy * dy) || 1e-9;
  for (let i = 1; i < pts.length - 1; i++) {
    const p = pts[i];
    const d = Math.abs(dy * p[0] - dx * p[1] + b[0] * a[1] - b[1] * a[0]) / len;
    if (d > dmax) { dmax = d; idx = i; }
  }
  if (dmax <= eps) return [a, b];
  const l = rdp(pts.slice(0, idx + 1), eps);
  const r = rdp(pts.slice(idx), eps);
  return l.slice(0, -1).concat(r);
}

/* ---------------- 主流程 ---------------- */
const img = decodePNG(fs.readFileSync(src));
const { w, h, rgba } = img;
const mask = new Uint8Array(w * h);

/* 判断"实心"：有 alpha 通道就看 alpha；全不透明就看它跟背景色（取四角平均）差多少 */
let hasAlpha = false;
for (let i = 3; i < rgba.length; i += 4) if (rgba[i] < 250) { hasAlpha = true; break; }
if (hasAlpha) {
  for (let i = 0, p = 3; i < w * h; i++, p += 4) mask[i] = rgba[p] > 110 ? 1 : 0;
} else {
  let br = 0, bg = 0, bb = 0;
  const corner = (x, y) => { const o = (y * w + x) * 4; br += rgba[o]; bg += rgba[o + 1]; bb += rgba[o + 2]; };
  corner(0, 0); corner(w - 1, 0); corner(0, h - 1); corner(w - 1, h - 1);
  br /= 4; bg /= 4; bb /= 4;
  for (let i = 0, p = 0; i < w * h; i++, p += 4) {
    const d = Math.abs(rgba[p] - br) + Math.abs(rgba[p + 1] - bg) + Math.abs(rgba[p + 2] - bb);
    mask[i] = d > 90 ? 1 : 0;
  }
}

let onCount = 0;
for (let i = 0; i < mask.length; i++) onCount += mask[i];
if (onCount === 0 || onCount === mask.length) {
  console.error("[失败] 分不出前景和背景：整张图要么全是实心、要么全是空的。");
  console.error("       请用透明背景导出 PNG（手机绘画 App 里把背景图层隐藏或删掉），");
  console.error("       白底图也能勉强处理，但深色满幅底图不行。");
  process.exit(2);
}
const loops = trace(mask, w, h, onCount);
const paths = [];
for (const lp of loops) {
  const closed = lp.concat([lp[0]]);
  const simp = rdp(closed, TOL);
  if (simp.length < 3) continue;
  let d = "M" + Math.round(simp[0][0] * 10) / 10 + " " + Math.round(simp[0][1] * 10) / 10;
  for (let i = 1; i < simp.length - 1; i++) {
    d += "L" + Math.round(simp[i][0] * 10) / 10 + " " + Math.round(simp[i][1] * 10) / 10;
  }
  d += "z";
  paths.push(d);
}

const U = "ART_" + fnName.toUpperCase();
const lines = [
  "/* png2code.mjs 生成：" + src.split(/[\\/]/).pop() + " → 纯代码路径，尺寸 " + w + "x" + h + " */",
  "var " + U + " = " + JSON.stringify({ w: w, h: h, d: paths }) + ";",
  "function " + fnName + "(g, cx, cy, scale) {",
  "  cx = cx || 0; cy = cy || 0; scale = scale || 1;",
  "  g.save();",
  "  g.translate(cx - " + U + ".w * scale * 0.5, cy - " + U + ".h * scale * 0.5);",
  "  g.scale(scale, scale);",
  "  g.fillStyle = g.__artFill || '#dfe6f5';",
  "  for (var i = 0; i < " + U + ".d.length; i++) g.fill(new Path2D(" + U + ".d[i]));",
  "  g.restore();",
  "}"
];
const out = lines.join("\n");
console.log(out);
console.error("[统计] 轮廓环 " + paths.length + " 个，代码 " + out.length + " 字节（原图 " + w + "x" + h + "）");
