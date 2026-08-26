/* ============================================================================
 * QR encoder — byte mode, error-correction level M, versions 1..10.
 *
 * Why this exists: the donation pass has to work on paper, offline, and be
 * scannable by any phone at the intake table. A decorative QR-shaped graphic
 * would make the whole pre-registration mechanism a lie in the demo, so this
 * produces a genuinely valid symbol.
 *
 * Verified against the Python `qrcode` reference encoder — see tools/verify-qr.js
 * ==========================================================================*/
const QR = (function () {
  'use strict';

  // --- Galois field GF(256), primitive polynomial 0x11D -----------------------
  const EXP = new Uint8Array(512);
  const LOG = new Uint8Array(256);
  (function initGF() {
    let x = 1;
    for (let i = 0; i < 255; i++) {
      EXP[i] = x;
      LOG[x] = i;
      x <<= 1;
      if (x & 0x100) x ^= 0x11d;
    }
    for (let i = 255; i < 512; i++) EXP[i] = EXP[i - 255];
  })();

  const gfMul = (a, b) => (a === 0 || b === 0 ? 0 : EXP[LOG[a] + LOG[b]]);

  // Generator polynomial for `degree` error-correction codewords.
  function rsGenerator(degree) {
    let poly = [1];
    for (let i = 0; i < degree; i++) {
      const next = new Array(poly.length + 1).fill(0);
      for (let j = 0; j < poly.length; j++) {
        next[j] ^= poly[j];
        next[j + 1] ^= gfMul(poly[j], EXP[i]);
      }
      poly = next;
    }
    return poly;
  }

  function rsEncode(data, ecLen) {
    const gen = rsGenerator(ecLen);
    const res = new Array(ecLen).fill(0);
    for (const byte of data) {
      const factor = byte ^ res[0];
      res.shift();
      res.push(0);
      for (let i = 0; i < gen.length - 1; i++) {
        res[i] ^= gfMul(gen[i + 1], factor);
      }
    }
    return res;
  }

  // --- Version tables, error-correction level M -------------------------------
  // [ total data codewords, ec codewords per block, blocks in group1,
  //   data codewords per block in group1, blocks in group2, data per block g2 ]
  const VERSIONS_M = {
    1:  [16,  10, 1, 16, 0, 0],
    2:  [28,  16, 1, 28, 0, 0],
    3:  [44,  26, 1, 44, 0, 0],
    4:  [64,  18, 2, 32, 0, 0],
    5:  [86,  24, 2, 43, 0, 0],
    6:  [108, 16, 4, 27, 0, 0],
    7:  [124, 18, 4, 31, 0, 0],
    8:  [154, 22, 2, 38, 2, 39],
    9:  [182, 22, 3, 36, 2, 37],
    10: [216, 26, 4, 43, 1, 44]
  };

  // Alignment pattern centre coordinates per version.
  const ALIGN = {
    1: [], 2: [6, 18], 3: [6, 22], 4: [6, 26], 5: [6, 30],
    6: [6, 34], 7: [6, 22, 38], 8: [6, 24, 42], 9: [6, 26, 46], 10: [6, 28, 50]
  };

  function pickVersion(byteLen) {
    for (let v = 1; v <= 10; v++) {
      const totalData = VERSIONS_M[v][0];
      // 4 bits mode + count bits (8 for v1-9, 16 for v10+) + payload
      const countBits = v <= 9 ? 8 : 16;
      const needed = 4 + countBits + byteLen * 8;
      if (needed <= totalData * 8) return v;
    }
    return null; // caller falls back
  }

  // --- Bit stream -------------------------------------------------------------
  function buildBitstream(bytes, version) {
    const bits = [];
    const push = (val, len) => {
      for (let i = len - 1; i >= 0; i--) bits.push((val >> i) & 1);
    };
    push(0b0100, 4);                       // byte mode
    push(bytes.length, version <= 9 ? 8 : 16);
    for (const b of bytes) push(b, 8);

    const capacity = VERSIONS_M[version][0] * 8;
    // Terminator, up to 4 bits
    for (let i = 0; i < 4 && bits.length < capacity; i++) bits.push(0);
    // Pad to byte boundary
    while (bits.length % 8 !== 0) bits.push(0);
    // Pad bytes, alternating
    const padBytes = [0xec, 0x11];
    let p = 0;
    while (bits.length < capacity) {
      push(padBytes[p++ % 2], 8);
    }
    const out = [];
    for (let i = 0; i < bits.length; i += 8) {
      let byte = 0;
      for (let j = 0; j < 8; j++) byte = (byte << 1) | bits[i + j];
      out.push(byte);
    }
    return out;
  }

  // --- Interleaving -----------------------------------------------------------
  function interleave(dataCodewords, version) {
    const [, ecLen, g1Blocks, g1Size, g2Blocks, g2Size] = VERSIONS_M[version];
    const blocks = [];
    let offset = 0;
    for (let i = 0; i < g1Blocks; i++) {
      blocks.push(dataCodewords.slice(offset, offset + g1Size));
      offset += g1Size;
    }
    for (let i = 0; i < g2Blocks; i++) {
      blocks.push(dataCodewords.slice(offset, offset + g2Size));
      offset += g2Size;
    }
    const ecBlocks = blocks.map(b => rsEncode(b, ecLen));

    const result = [];
    const maxData = Math.max(...blocks.map(b => b.length));
    for (let i = 0; i < maxData; i++) {
      for (const b of blocks) if (i < b.length) result.push(b[i]);
    }
    for (let i = 0; i < ecLen; i++) {
      for (const b of ecBlocks) result.push(b[i]);
    }
    return result;
  }

  // --- Matrix construction ----------------------------------------------------
  function makeMatrix(version) {
    const size = version * 4 + 17;
    const m = Array.from({ length: size }, () => new Array(size).fill(null));
    const reserved = Array.from({ length: size }, () => new Array(size).fill(false));

    const setFinder = (r, c) => {
      for (let dr = -1; dr <= 7; dr++) {
        for (let dc = -1; dc <= 7; dc++) {
          const rr = r + dr, cc = c + dc;
          if (rr < 0 || rr >= size || cc < 0 || cc >= size) continue;
          const inRing =
            (dr >= 0 && dr <= 6 && (dc === 0 || dc === 6)) ||
            (dc >= 0 && dc <= 6 && (dr === 0 || dr === 6));
          const inCore = dr >= 2 && dr <= 4 && dc >= 2 && dc <= 4;
          m[rr][cc] = inRing || inCore ? 1 : 0;
          reserved[rr][cc] = true;
        }
      }
    };
    setFinder(0, 0);
    setFinder(0, size - 7);
    setFinder(size - 7, 0);

    // Timing patterns
    for (let i = 8; i < size - 8; i++) {
      const bit = i % 2 === 0 ? 1 : 0;
      if (!reserved[6][i]) { m[6][i] = bit; reserved[6][i] = true; }
      if (!reserved[i][6]) { m[i][6] = bit; reserved[i][6] = true; }
    }

    // Alignment patterns. The three whose centres coincide with a finder
    // pattern are omitted; the rest are drawn even where they cross a timing
    // pattern (the modules agree in value there anyway).
    const centres = ALIGN[version];
    const first = 6, last = size - 7;
    for (const r of centres) {
      for (const c of centres) {
        const onFinder =
          (r === first && c === first) ||
          (r === first && c === last) ||
          (r === last && c === first);
        if (onFinder) continue;
        for (let dr = -2; dr <= 2; dr++) {
          for (let dc = -2; dc <= 2; dc++) {
            const isDark = Math.max(Math.abs(dr), Math.abs(dc)) !== 1;
            m[r + dr][c + dc] = isDark ? 1 : 0;
            reserved[r + dr][c + dc] = true;
          }
        }
      }
    }

    // Dark module
    m[size - 8][8] = 1;
    reserved[size - 8][8] = true;

    // Reserve format information areas
    for (let i = 0; i < 9; i++) {
      if (!reserved[8][i]) { reserved[8][i] = true; m[8][i] = 0; }
      if (!reserved[i][8]) { reserved[i][8] = true; m[i][8] = 0; }
    }
    for (let i = 0; i < 8; i++) {
      if (!reserved[8][size - 1 - i]) { reserved[8][size - 1 - i] = true; m[8][size - 1 - i] = 0; }
      if (!reserved[size - 1 - i][8]) { reserved[size - 1 - i][8] = true; m[size - 1 - i][8] = 0; }
    }

    return { m, reserved, size };
  }

  function placeData(m, reserved, size, codewords) {
    const bits = [];
    for (const cw of codewords) for (let i = 7; i >= 0; i--) bits.push((cw >> i) & 1);

    let idx = 0;
    let upward = true;
    for (let right = size - 1; right > 0; right -= 2) {
      if (right === 6) right = 5; // skip the vertical timing column
      for (let step = 0; step < size; step++) {
        const row = upward ? size - 1 - step : step;
        for (let k = 0; k < 2; k++) {
          const col = right - k;
          if (reserved[row][col]) continue;
          m[row][col] = idx < bits.length ? bits[idx] : 0;
          idx++;
        }
      }
      upward = !upward;
    }
  }

  const MASKS = [
    (r, c) => (r + c) % 2 === 0,
    (r, c) => r % 2 === 0,
    (r, c) => c % 3 === 0,
    (r, c) => (r + c) % 3 === 0,
    (r, c) => (Math.floor(r / 2) + Math.floor(c / 3)) % 2 === 0,
    (r, c) => ((r * c) % 2) + ((r * c) % 3) === 0,
    (r, c) => (((r * c) % 2) + ((r * c) % 3)) % 2 === 0,
    (r, c) => (((r + c) % 2) + ((r * c) % 3)) % 2 === 0
  ];

  function applyMask(m, reserved, size, maskIdx) {
    const out = m.map(row => row.slice());
    for (let r = 0; r < size; r++) {
      for (let c = 0; c < size; c++) {
        if (reserved[r][c]) continue;
        if (MASKS[maskIdx](r, c)) out[r][c] ^= 1;
      }
    }
    return out;
  }

  // Format information: EC level M = 0b00, then mask, BCH(15,5), XOR 0x5412
  function formatBits(maskIdx) {
    const data = (0b00 << 3) | maskIdx;
    let rem = data << 10;
    for (let i = 14; i >= 10; i--) {
      if ((rem >> i) & 1) rem ^= 0b10100110111 << (i - 10);
    }
    return ((data << 10) | rem) ^ 0b101010000010010;
  }

  function placeFormat(m, size, maskIdx) {
    const fmt = formatBits(maskIdx);
    for (let i = 0; i < 15; i++) {
      const bit = (fmt >> i) & 1;
      // Vertical strip, column 8 (top-left downwards, then bottom-left)
      if (i < 6) m[i][8] = bit;
      else if (i < 8) m[i + 1][8] = bit;
      else m[size - 15 + i][8] = bit;
      // Horizontal strip, row 8 (top-right leftwards, then top-left)
      if (i < 8) m[8][size - 1 - i] = bit;
      else if (i === 8) m[8][7] = bit;
      else m[8][14 - i] = bit;
    }
    m[size - 8][8] = 1; // dark module, always set
  }

  // Penalty scoring per ISO/IEC 18004 so we pick the same mask a standard
  // encoder would. Keeps output byte-identical to reference implementations.
  function penalty(m, size) {
    let score = 0;

    // Rule 1: runs of five or more same-colour modules
    const runScore = line => {
      let s = 0, run = 1;
      for (let i = 1; i < line.length; i++) {
        if (line[i] === line[i - 1]) { run++; }
        else { if (run >= 5) s += 3 + (run - 5); run = 1; }
      }
      if (run >= 5) s += 3 + (run - 5);
      return s;
    };
    for (let r = 0; r < size; r++) score += runScore(m[r]);
    for (let c = 0; c < size; c++) score += runScore(m.map(row => row[c]));

    // Rule 2: 2x2 blocks of one colour
    for (let r = 0; r < size - 1; r++) {
      for (let c = 0; c < size - 1; c++) {
        const v = m[r][c];
        if (v === m[r][c + 1] && v === m[r + 1][c] && v === m[r + 1][c + 1]) score += 3;
      }
    }

    // Rule 3: finder-like patterns
    const pat1 = [1, 0, 1, 1, 1, 0, 1, 0, 0, 0, 0];
    const pat2 = [0, 0, 0, 0, 1, 0, 1, 1, 1, 0, 1];
    const hasPat = (line, i, pat) => pat.every((v, j) => line[i + j] === v);
    const scanLine = line => {
      let s = 0;
      for (let i = 0; i + 11 <= line.length; i++) {
        if (hasPat(line, i, pat1) || hasPat(line, i, pat2)) s += 40;
      }
      return s;
    };
    for (let r = 0; r < size; r++) score += scanLine(m[r]);
    for (let c = 0; c < size; c++) score += scanLine(m.map(row => row[c]));

    // Rule 4: overall dark/light balance
    let dark = 0;
    for (let r = 0; r < size; r++) for (let c = 0; c < size; c++) dark += m[r][c];
    const pct = (dark * 100) / (size * size);
    score += Math.floor(Math.abs(pct - 50) / 5) * 10;

    return score;
  }

  function utf8Bytes(str) {
    const out = [];
    for (const ch of str) {
      const cp = ch.codePointAt(0);
      if (cp < 0x80) out.push(cp);
      else if (cp < 0x800) out.push(0xc0 | (cp >> 6), 0x80 | (cp & 63));
      else if (cp < 0x10000) out.push(0xe0 | (cp >> 12), 0x80 | ((cp >> 6) & 63), 0x80 | (cp & 63));
      else out.push(0xf0 | (cp >> 18), 0x80 | ((cp >> 12) & 63), 0x80 | ((cp >> 6) & 63), 0x80 | (cp & 63));
    }
    return out;
  }

  /** Returns a size x size matrix of 0/1, or null if the text will not fit. */
  function encode(text) {
    const bytes = utf8Bytes(text);
    const version = pickVersion(bytes.length);
    if (!version) return null;

    const dataCodewords = buildBitstream(bytes, version);
    const finalCodewords = interleave(dataCodewords, version);
    const { m, reserved, size } = makeMatrix(version);
    placeData(m, reserved, size, finalCodewords);

    let best = null, bestScore = Infinity;
    for (let mask = 0; mask < 8; mask++) {
      const candidate = applyMask(m, reserved, size, mask);
      placeFormat(candidate, size, mask);
      const s = penalty(candidate, size);
      if (s < bestScore) { bestScore = s; best = candidate; }
    }
    return best;
  }

  /**
   * Renders to an inline SVG string. `px` is the drawn size in CSS pixels.
   * A 4-module quiet zone is included, as the spec requires — without it many
   * scanners fail, which is exactly the kind of detail that makes a demo QR
   * look real but not work.
   */
  function svg(text, px, opts) {
    opts = opts || {};
    const matrix = encode(text);
    if (!matrix) return '';
    const n = matrix.length;
    const quiet = 4;
    const total = n + quiet * 2;
    const dark = opts.dark || '#000000';
    const light = opts.light || '#ffffff';
    let path = '';
    for (let r = 0; r < n; r++) {
      for (let c = 0; c < n; c++) {
        if (matrix[r][c]) path += `M${c + quiet} ${r + quiet}h1v1h-1z`;
      }
    }
    const label = opts.label || text;
    return `<svg class="qr" width="${px}" height="${px}" viewBox="0 0 ${total} ${total}" `
      + `role="img" aria-label="${esc(label)}" shape-rendering="crispEdges">`
      + `<rect width="${total}" height="${total}" fill="${light}"/>`
      + `<path d="${path}" fill="${dark}"/></svg>`;
  }

  return { encode, svg };
})();
