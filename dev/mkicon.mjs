import fs from "node:fs";
import zlib from "node:zlib";

let crcTable = null;
function crc32(buf) {
  if (!crcTable) {
    crcTable = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
      crcTable[n] = c >>> 0;
    }
  }
  let c = 0xFFFFFFFF;
  for (let i = 0; i < buf.length; i++) c = crcTable[(c ^ buf[i]) & 0xFF] ^ (c >>> 8);
  return (c ^ 0xFFFFFFFF) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length, 0);
  const t = Buffer.from(type, "ascii");
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(Buffer.concat([t, data])), 0);
  return Buffer.concat([len, t, data, crc]);
}
function makePNG(w, h, px) {
  const sig = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  const stride = w * 4 + 1;
  const raw = Buffer.alloc(h * stride);
  const src = Buffer.from(px.buffer, px.byteOffset, px.length);
  for (let y = 0; y < h; y++) {
    raw[y * stride] = 0;
    src.copy(raw, y * stride + 1, y * w * 4, (y + 1) * w * 4);
  }
  return Buffer.concat([sig, chunk("IHDR", ihdr), chunk("IDAT", zlib.deflateSync(raw, { level: 9 })), chunk("IEND", Buffer.alloc(0))]);
}
function render(size) {
  const px = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4;
      const t = y / size;
      px[i] = Math.round(10 + t * 8); px[i + 1] = Math.round(13 + t * 10); px[i + 2] = Math.round(22 + t * 20); px[i + 3] = 255;
    }
  }
  function circle(cx, cy, r, col, glow) {
    const R = Math.ceil(r + (glow ? r * 0.9 : 1.5));
    for (let y = Math.max(0, Math.floor(cy - R)); y < Math.min(size, cy + R); y++) {
      for (let x = Math.max(0, Math.floor(cx - R)); x < Math.min(size, cx + R); x++) {
        const d = Math.hypot(x - cx, y - cy);
        let a = 0;
        if (d <= r) a = 1;
        else if (d <= r + 1.5) a = (r + 1.5 - d) / 1.5;
        else if (glow && d <= R) a = 0.22 * (1 - (d - r) / (R - r));
        if (a <= 0) continue;
        const i = (y * size + x) * 4;
        px[i] = Math.round(px[i] * (1 - a) + col[0] * a);
        px[i + 1] = Math.round(px[i + 1] * (1 - a) + col[1] * a);
        px[i + 2] = Math.round(px[i + 2] * (1 - a) + col[2] * a);
      }
    }
  }
  const c = size / 2;
  // 中央：丧尸母体（淡紫，带光晕）
  circle(c, c, size * 0.175, [201, 167, 235], true);
  // 内圈：普通丧尸（紫）
  for (let k = 0; k < 3; k++) {
    const ang = -Math.PI / 2 + k * (Math.PI * 2 / 3);
    circle(c + Math.cos(ang) * size * 0.30, c + Math.sin(ang) * size * 0.30, size * 0.085, [139, 63, 232], true);
  }
  // 外圈：人类防线（淡绿 / 深绿）
  for (let k = 0; k < 5; k++) {
    const ang = -Math.PI / 2 + Math.PI / 5 + k * (Math.PI * 2 / 5);
    circle(c + Math.cos(ang) * size * 0.415, c + Math.sin(ang) * size * 0.415, size * 0.062,
      k % 2 ? [31, 122, 61] : [183, 240, 168], false);
  }
  return px;
}
for (const size of [192, 512]) {
  const png = makePNG(size, size, render(size));
  const out = process.argv[2] + "/icon-" + size + ".png";
  fs.writeFileSync(out, png);
  console.log("生成 " + out + "  " + png.length + " 字节");
}
