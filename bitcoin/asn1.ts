import { joinBuffers } from "./messages.create";

const asn1prefixForDemoKey = Buffer.from(
  "3036301006072a8648ce3d020106052b8104000a032200",
  "hex"
);

/**
 * Very simple asn1 parsing, just for validation purposes
 */
export function asn1parse(buf: Buffer) {
  if (buf.length === 0) {
    throw new Error(`Empty buf!`);
  }
  const type = buf[0];
}

export function create_spki_der_from_pubkey(pub: Buffer) {
  /*
      asn1 is TLV
      0x30 - SEQUENCE
      0x06 - OBJECT_ID
      0x03 - BITSTRING (0x03 <len> <unused bits=0> <data>)
  
    */

  const myLenInThisExample = 33;
  if (pub.length !== myLenInThisExample) {
    const diff = pub.length - myLenInThisExample;
    // Need to adjust sequence lengths
    asn1prefixForDemoKey[1] += diff;
    asn1prefixForDemoKey[21] += diff;
  }
  return joinBuffers(asn1prefixForDemoKey, pub);
}
