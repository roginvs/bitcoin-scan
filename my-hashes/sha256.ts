// https://csrc.nist.gov/csrc/media/publications/fips/180/2/archive/2002-08-01/documents/fips180-2.pdf

export function padMessage(msg: ArrayBuffer) {
  const Lbytes = msg.byteLength;
  const sizeWithNoAppends = Lbytes + 1 + 8;
  const bytesAppend = 64 - (sizeWithNoAppends % 64);

  const out = new Uint8Array(sizeWithNoAppends + bytesAppend);
  out.set(new Uint8Array(msg));
  out[Lbytes] = 0b10000000;
  out.fill(0, sizeWithNoAppends, sizeWithNoAppends + bytesAppend);
  new DataView(out.buffer).setBigUint64(
    sizeWithNoAppends + bytesAppend - 8,
    BigInt(Lbytes * 8),
    false
  );

  return out.buffer;
}

export function rightrotate(n: number, bits: number) {
  return ((n >>> bits) | (((n * 2 ** (32 - bits)) & 0xffffffff) >>> 0)) >>> 0;
}
export function rightshift(n: number, bits: number) {
  if (bits === 32) {
    // Why >>> works like this?
    return 0;
  }
  return n >>> bits;
}

export function sha256(data: ArrayBuffer) {
  const chunks = padMessage(data);
  const hash = new DataView(new ArrayBuffer(32));
  hash.setUint32(0, 0x6a09e667, true);
  hash.setUint32(4, 0xbb67ae85, true);
  hash.setUint32(8, 0x3c6ef372, true);
  hash.setUint32(12, 0xa54ff53a, true);
  hash.setUint32(16, 0x510e527f, true);
  hash.setUint32(20, 0x9b05688c, true);
  hash.setUint32(24, 0x1f83d9ab, true);
  hash.setUint32(28, 0x5be0cd19, true);

  const k = new DataView(new ArrayBuffer(64 * 4));

  for (const [i, val] of [
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1,
    0x923f82a4, 0xab1c5ed5, 0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3,
    0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174, 0xe49b69c1, 0xefbe4786,
    0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147,
    0x06ca6351, 0x14292967, 0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13,
    0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85, 0xa2bfe8a1, 0xa81a664b,
    0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a,
    0x5b9cca4f, 0x682e6ff3, 0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208,
    0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
  ].entries()) {
    k.setUint32(i * 4, val, true);
  }

  const w = new DataView(new ArrayBuffer(256));

  let chunkIndex = 0;
  while (chunks.byteLength > 64 * chunkIndex) {
    const chunk = chunks.slice(64 * chunkIndex, 64 * chunkIndex + 64);

    console.info(
      `Chunk index=${chunkIndex}`,
      Buffer.from(chunk).toString("hex")
    );
    new Uint32Array(w.buffer).set(new Uint32Array(chunk), 0);

    console.info(Buffer.from(w.buffer).toString("hex"));
    for (let i = 16; i < 64; i++) {
      const s0 =
        rightrotate(w.getUint32((i - 15) * 4), 7) ^
        rightrotate(w.getUint32((i - 15) * 4), 18) ^
        rightshift(w.getUint32((i - 15) * 4), 3);
    }

    const a = hash.getUint32(0, true);
    const b = hash.getUint32(4, true);
    const c = hash.getUint32(8, true);
    const d = hash.getUint32(12, true);
    const e = hash.getUint32(16, true);
    const f = hash.getUint32(20, true);
    const g = hash.getUint32(24, true);
    const h = hash.getUint32(28, true);

    console.info(
      a.toString(16),
      b.toString(16),
      c.toString(16),
      d.toString(16),
      e.toString(16),
      f.toString(16),
      g.toString(16),
      h.toString(16)
    );
    chunkIndex++;
  }

  return k.buffer;
  //return hash.buffer;
}
