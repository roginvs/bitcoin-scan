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
