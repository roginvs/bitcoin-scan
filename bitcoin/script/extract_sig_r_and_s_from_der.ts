import { asn1parse } from "./asn1";

export function extract_sig_r_and_s_from_der(signatureDer: Buffer) {
  let r: Buffer;
  let s: Buffer;

  const [asn1, rest] = asn1parse(signatureDer);
  if (rest.length > 0) {
    // Well, some transactions have signatures with data after asn1
    // throw new Error(`Some data is left in asn`);
  }
  if (!Array.isArray(asn1)) {
    throw new Error(`Not an array in the asn`);
  }
  if ((asn1[0] as any).type !== "integer") {
    throw new Error(`First value is not a integer in asn`);
  }
  r = (asn1[0] as any).value;
  if (!(r instanceof Buffer)) {
    throw new Error(`Internal error: not a buffer`);
  }
  if ((asn1[1] as any).type !== "integer") {
    throw new Error(`Second value is not a integer in asn`);
  }
  s = (asn1[1] as any).value;
  if (!(r instanceof Buffer)) {
    throw new Error(`Internal error: not a buffer`);
  }

  return [r, s] as const;
}
