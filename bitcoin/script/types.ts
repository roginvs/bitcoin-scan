export interface ECDSASignatureInfo {
  r: Buffer;
  s: Buffer;
  msg: Buffer;
  pubKeyCompressed: Buffer;
}
export type ECDSASignatureValidatedListener = (
  ecdsaSignature: ECDSASignatureInfo
) => void;
