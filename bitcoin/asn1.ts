import { joinBuffers } from "./utils";

type Asn1 = any;
/**
 * Very simple asn1 parsing, just for validation purposes
 */
export function asn1parse(buf: Buffer): [Asn1, Buffer] {
  if (buf.length === 0) {
    throw new Error(`Empty buf!`);
  }
  const type = buf[0];
  if ((type & 0b11111) === 0b11111) {
    throw new Error("Long types are not supported");
  }
  if (buf.length < 1) {
    throw new Error(`Where is length?`);
  }
  const len = buf[1];
  if (len & 0b10000000) {
    throw new Error(`Long length is not supported ${len.toString(16)}`);
  }
  if (buf.length < 1 + 1 + len) {
    throw new Error("Buf is not enough length");
  }
  let data = buf.subarray(2, 2 + len);

  let result: Asn1;
  if (type === 0x30) {
    result = [];
    let val: Asn1;
    while (data.length > 0) {
      [val, data] = asn1parse(data);
      result.push(val);
    }
  } else if (type === 0x06) {
    result = {
      type: "oid",
      value: data,
    };
  } else if (type === 0x02) {
    result = {
      type: "integer",
      value: data,
    };
  } else if (type === 0x03) {
    if (data[0] !== 0) {
      throw new Error(`Non byte bitstrings are not supported`);
    }
    result = {
      type: "bitstring",
      value: data.subarray(1),
    };
  } else {
    throw new Error(`Unknown type ${type.toString(16)}`);
  }

  const rest = buf.subarray(2 + len);
  return [result, rest];
}

export function create_spki_der_from_pubkey(pub: Buffer) {
  /*
      asn1 is TLV
      0x30 - SEQUENCE
      0x06 - OBJECT_ID
      0x03 - BITSTRING (0x03 <len> <unused bits=0> <data>)
  
    */
  const asn1prefixForDemoKey = Buffer.from(
    "3036301006072a8648ce3d020106052b8104000a032200",
    "hex"
  );

  const myLenInThisExample = 33;
  if (pub.length !== myLenInThisExample) {
    const diff = pub.length - myLenInThisExample;
    // Need to adjust sequence lengths
    asn1prefixForDemoKey[1] += diff;
    asn1prefixForDemoKey[21] += diff;
  }
  return joinBuffers(asn1prefixForDemoKey, pub);
}
