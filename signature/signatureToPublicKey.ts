import { parsePgpLike } from "./parse-pgp-like";

export function signatureToPublicKey(signatureText: string) {
  const data = parsePgpLike(signatureText);
}
