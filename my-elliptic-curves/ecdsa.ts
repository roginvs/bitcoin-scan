import {
  CurveParams,
  get_point_from_x,
  get_point_inverse,
  is_on_curve,
  modulo_power_point,
  Point,
  point_add,
} from "./curves";
import { modulo_inverse } from "./modulo";

export interface Signature {
  r: bigint;
  s: bigint;
}

export function signature({
  curve,
  privateKey,
  msgHash,
  k,
}: {
  curve: CurveParams;
  privateKey: bigint;
  msgHash: bigint;
  k: bigint;
}): Signature {
  const kQ = modulo_power_point(curve.G, k, curve.a, curve.p);
  if (!kQ) {
    throw new Error("LOL got infinity, provide better k");
  }
  const r = kQ[0] % curve.n;
  const s = (modulo_inverse(k, curve.n) * (msgHash + r * privateKey)) % curve.n;

  return { r, s };
}

export function check_signature({
  curve,
  publicKey,
  msgHash,
  r,
  s,
}: {
  curve: CurveParams;
  publicKey: Point;
  msgHash: bigint;
  r: bigint;
  s: bigint;
}) {
  if (!publicKey) {
    return false;
  }
  if (!is_on_curve(publicKey, curve.a, curve.b, curve.p)) {
    return false;
  }

  if (modulo_power_point(publicKey, curve.n, curve.a, curve.p) !== null) {
    return false;
  }

  if (r < BigInt(1) || r > curve.n - BigInt(1)) {
    return false;
  }
  if (s < BigInt(1) || s > curve.n - BigInt(1)) {
    return false;
  }

  const u1 = (msgHash * modulo_inverse(s, curve.n)) % curve.n;
  const u2 = (r * modulo_inverse(s, curve.n)) % curve.n;

  const point = point_add(
    modulo_power_point(curve.G, u1, curve.a, curve.p),
    modulo_power_point(publicKey, u2, curve.a, curve.p),
    curve.a,
    curve.p
  );
  if (point === null) {
    return false;
  }
  const x1modn = point[0] % curve.n;
  return x1modn === r;
}

function get_private_key_if_k_is_the_same(
  curve: CurveParams,
  sig1: Signature,
  msgHash1: bigint,
  sig2: Signature,
  msgHash2: bigint
) {
  if (sig1.r !== sig2.r) {
    throw new Error(`Provided kDiff is not correct!`);
  }
  if (msgHash1 === msgHash2) {
    throw new Error(`Messages should be different!`);
  }
  const kTop = (msgHash1 + curve.n - msgHash2) % curve.n;
  const kBottom = (sig1.s + curve.n - sig2.s) % curve.n;
  const k = (kTop * modulo_inverse(kBottom, curve.n)) % curve.n;

  const privateKey =
    (((((sig1.s * k) % curve.n) + curve.n - msgHash1) % curve.n) *
      modulo_inverse(sig1.r, curve.n)) %
    curve.n;
  return privateKey;
}

/**
 * This function expects that signatures are correct and r is not inverted
 */
export function get_private_key_if_diff_k_is_known(
  curve: CurveParams,
  sig1: Signature,
  msgHash1: bigint,
  sig2: Signature,
  msgHash2: bigint,
  kDiff?: bigint
) {
  if (kDiff === undefined || kDiff === BigInt(0)) {
    return get_private_key_if_k_is_the_same(
      curve,
      sig1,
      msgHash1,
      sig2,
      msgHash2
    );
  }
  const pointForFirstSig = get_point_from_x(sig1.r, curve.a, curve.b, curve.p);
  if (!pointForFirstSig) {
    throw new Error("Must be non-zero point");
  }
  const pointsForFirstSig = [
    pointForFirstSig,
    get_point_inverse(pointForFirstSig, curve.p),
  ];

  const gKdiff = modulo_power_point(curve.G, kDiff, curve.a, curve.p);
  const pointsForSecondsSig = pointsForFirstSig.map((point) =>
    point_add(point, gKdiff, curve.a, curve.p)
  );

  if (pointsForSecondsSig.filter((p) => p && p[0] === sig2.r).length === 0) {
    throw new Error(`Provided kDiff is not correct!`);
  }

  const r2inverse = modulo_inverse(sig2.r, curve.n);
  const r2inverser1 = (r2inverse * sig1.r) % curve.n;

  const kTop =
    (((msgHash2 * r2inverser1) % curve.n) +
      (curve.n - ((kDiff * sig2.s * r2inverser1) % curve.n)) +
      (curve.n - msgHash1)) %
    curve.n;
  const kBottom =
    (((sig2.s * r2inverser1) % curve.n) + curve.n - sig1.s) % curve.n;
  const k = (kTop * modulo_inverse(kBottom, curve.n)) % curve.n;

  const privateKey =
    (((((sig1.s * k) % curve.n) + curve.n - msgHash1) % curve.n) *
      modulo_inverse(sig1.r, curve.n)) %
    curve.n;
  return privateKey;
}

export function get_private_key_if_diff_k_is_known_verified(
  curve: CurveParams,
  publicKey: Point,
  sig1: Signature,
  msgHash1: bigint,
  sig2: Signature,
  msgHash2: bigint,
  kDiff?: bigint
) {
  if (!publicKey) {
    throw new Error(`Public key cannot be zero point`);
  }
  if (
    !check_signature({
      curve,
      msgHash: msgHash1,
      publicKey,
      r: sig1.r,
      s: sig1.s,
    })
  ) {
    throw new Error(`Signature 1 is not valid`);
  }
  if (
    !check_signature({
      curve,
      msgHash: msgHash2,
      publicKey,
      r: sig2.r,
      s: sig2.s,
    })
  ) {
    throw new Error(`Signature 2 is not valid`);
  }
  for (const [inv1, inv2] of [
    [0, 0],
    [0, 1],
    [1, 0],
    [1, 1],
  ]) {
    const privateKeyCandidate = get_private_key_if_diff_k_is_known(
      curve,
      {
        ...sig1,
        s: inv1 ? curve.n - sig1.s : sig1.s,
      },
      msgHash1,
      {
        ...sig2,
        s: inv2 ? curve.n - sig2.s : sig2.s,
      },
      msgHash2,
      kDiff
    );
    const publicKeyCandidate = modulo_power_point(
      curve.G,
      privateKeyCandidate,
      curve.a,
      curve.p
    );
    if (!publicKeyCandidate) {
      continue;
    }
    if (
      publicKey[0] === publicKeyCandidate[0] &&
      publicKey[1] === publicKeyCandidate[1]
    ) {
      return privateKeyCandidate;
    }
  }
  throw new Error(
    `Some internal error, this should never happen because we checked everything before`
  );
}

export function recover_public_key(
  curve: CurveParams,
  r: bigint,
  s: bigint,
  msgHash: bigint
): Point[] | null {
  if (r < BigInt(1) || r > BigInt(curve.n)) {
    return null;
  }
  if (s < BigInt(1) || s > BigInt(curve.n)) {
    return null;
  }

  const points: Point[] = [];
  let x = r;
  while (x < curve.p) {
    const point = get_point_from_x(x, curve.a, curve.b, curve.p);
    points.push(point);
    points.push(get_point_inverse(point, curve.p));
    x += curve.p;
  }

  points.forEach((p) => {
    if (!is_on_curve(p, curve.a, curve.b, curve.p)) {
      throw new Error("Internal error");
    }
  });

  const r_inverse = modulo_inverse(r, curve.n);
  const u1 = curve.n - ((msgHash * r_inverse) % curve.n);
  const u2 = (s * r_inverse) % curve.n;

  const possiblePublicKeys = points
    .map((point) => {
      const Qa = point_add(
        modulo_power_point(curve.G, u1, curve.a, curve.p),
        modulo_power_point(point, u2, curve.a, curve.p),
        curve.a,
        curve.p
      );
      if (!is_on_curve(Qa, curve.a, curve.b, curve.p)) {
        throw new Error("Internal error");
      }
      if (
        check_signature({
          curve,
          msgHash,
          r,
          s,
          publicKey: Qa,
        })
      ) {
        return Qa;
      } else {
        return null;
      }
    })
    .filter((point) => point);
  return possiblePublicKeys;
}
