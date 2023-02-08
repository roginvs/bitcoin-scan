import { joinBuffers } from "./utils";

export function packIntForAsn(b: Buffer) {
  if (b[0] !== 0 && !(b[0] & 0b10000000)) {
    // Valid case - not a zero and not negative
    return b;
  }
  if (b[0] === 0 && b[1] & 0b10000000) {
    // Ok, correct case, not negative because have leading zero
    return b;
  }

  let i = 0;
  while (i < b.length - 1 && b[i] === 0) {
    // Stop at previous to keep one
    i++;
  }

  const noLeadingZeros = b.subarray(i);
  if (noLeadingZeros[0] & 0b10000000) {
    // Still negative, so need to add zero
    return joinBuffers(Buffer.from([0]), noLeadingZeros);
  } else {
    // Ok, looks fine
    return noLeadingZeros;
  }
}

export function packAsn1PairOfIntegers(r: Buffer, s: Buffer) {
  const rPrefixed = packIntForAsn(r);
  const sPrefixed = packIntForAsn(s);
  if (r.length & 0b10000000) {
    throw new Error(`TODO: Longer integers`);
  }
  if (s.length & 0b10000000) {
    throw new Error(`TODO: Longer integers`);
  }

  return joinBuffers(
    Buffer.from([0x30, rPrefixed.length + sPrefixed.length + 2 + 2]),
    Buffer.from([0x02, rPrefixed.length]),
    rPrefixed,
    Buffer.from([0x02, sPrefixed.length]),
    sPrefixed
  );
}

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

export function repackSignature(rspair: Buffer) {
  const [pair, rest] = asn1parse(rspair);
  if (pair.length !== 2) {
    throw new Error(`Not a pair`);
  }
  if (pair[0].type !== "integer" || pair[1].type !== "integer") {
    throw new Error("Not an integer");
  }
  return joinBuffers(packAsn1PairOfIntegers(pair[0].value, pair[1].value));
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
