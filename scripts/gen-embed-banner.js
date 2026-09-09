/*
 * Génère assets/embed-banner.png — bandeau vert « EUROAGRI » ajouté en bas des
 * embeds du système d'exploitation pour forcer leur largeur au maximum Discord.
 *
 *   node scripts/gen-embed-banner.js
 *
 * Encodeur PNG maison (RGBA 8 bits) + police bitmap 5×7 pour E U R O A G I.
 * Pas de dépendance : ni canvas, ni sharp, ni ImageMagick.
 */
const fs   = require('fs');
const path = require('path');
const zlib = require('zlib');

const W = 1000, H = 64;

// ── Police 5×7 pour les lettres de « EUROAGRI » ──────────────────────────────
const FONT = {
  E: ['11111','10000','10000','11110','10000','10000','11111'],
  U: ['10001','10001','10001','10001','10001','10001','01110'],
  R: ['11110','10001','10001','11110','10100','10010','10001'],
  O: ['01110','10001','10001','10001','10001','10001','01110'],
  A: ['01110','10001','10001','11111','10001','10001','10001'],
  G: ['01110','10001','10000','10111','10001','10001','01110'],
  I: ['11111','00100','00100','00100','00100','00100','11111'],
};

// ── Buffer RGBA ─────────────────────────────────────────────────────────────
const px = Buffer.alloc(W * H * 4);
function set(x, y, r, g, b, a = 255) {
  if (x < 0 || x >= W || y < 0 || y >= H) return;
  const i = (y * W + x) * 4;
  px[i] = r; px[i + 1] = g; px[i + 2] = b; px[i + 3] = a;
}

// Fond : dégradé vertical vert foncé + liserés
for (let y = 0; y < H; y++) {
  const t = y / (H - 1);
  const r = Math.round(0x3a + (0x2c - 0x3a) * t);
  const g = Math.round(0x7d + (0x63 - 0x7d) * t);
  const b = Math.round(0x44 + (0x3b - 0x44) * t);
  for (let x = 0; x < W; x++) set(x, y, r, g, b);
}
for (let x = 0; x < W; x++) { set(x, 2, 0xd8, 0xe8, 0xcf, 90); set(x, H - 3, 0x16, 0x33, 0x12, 120); }

// ── Wordmark « EUROAGRI » centré, lettres espacées ──────────────────────────
const WORD = 'EUROAGRI';
const SCALE = 5;
const GLYPH_W = 5 * SCALE;
const GLYPH_H = 7 * SCALE;
const GAP = 5 * SCALE;                 // espace entre lettres
const totalW = WORD.length * GLYPH_W + (WORD.length - 1) * GAP;
let ox = Math.round((W - totalW) / 2);
const oy = Math.round((H - GLYPH_H) / 2);

for (const ch of WORD) {
  const rows = FONT[ch];
  for (let gy = 0; gy < 7; gy++) {
    for (let gx = 0; gx < 5; gx++) {
      if (rows[gy][gx] !== '1') continue;
      for (let sy = 0; sy < SCALE; sy++)
        for (let sx = 0; sx < SCALE; sx++)
          set(ox + gx * SCALE + sx, oy + gy * SCALE + sy, 0xef, 0xf6, 0xe9);
    }
  }
  ox += GLYPH_W + GAP;
}

// ── Encodage PNG ───────────────────────────────────────────────────────────
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
    t[n] = c >>> 0;
  }
  return t;
})();
function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td  = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}

const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(W, 0); ihdr.writeUInt32BE(H, 4);
ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;

const raw = Buffer.alloc(H * (1 + W * 4));
for (let y = 0; y < H; y++) {
  raw[y * (1 + W * 4)] = 0; // filtre None
  px.copy(raw, y * (1 + W * 4) + 1, y * W * 4, (y + 1) * W * 4);
}

const png = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  chunk('IHDR', ihdr),
  chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
  chunk('IEND', Buffer.alloc(0)),
]);

const out = path.join(__dirname, '..', 'assets', 'embed-banner.png');
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, png);
console.log('✅ ' + out + ' — ' + W + '×' + H + ', ' + png.length + ' o');
