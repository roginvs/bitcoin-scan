import { modulo_inverse, modulo_power, square_root } from "./modulo";

export type Point = null | readonly [bigint, bigint];
export interface CurveParams {
  p: bigint;
  a: bigint;
  b: bigint;
  G: Point;
  n: bigint;
}

export function get_point_from_x(
  x: bigint,
  a: bigint,
  b: bigint,
  module: bigint
): Point {
  const ySquare = (modulo_power(x, BigInt(3), module) + a * x + b) % module;
  let y = square_root(ySquare, module);
  if (y > module / BigInt(2)) {
    y = module - y;
  }
  return [x, y];
}

export function point_double(p: Point, a: bigint, module: bigint): Point {
  if (p === null) {
    return null;
  }
  const [xp, yp] = p;
  if (yp == BigInt(0)) {
    return null;
  }

  const lambda =
    ((((BigInt(3) * xp * xp) % module) + a) *
      modulo_inverse((BigInt(2) * yp) % module, module)) %
    module;

  const xr =
    (((lambda * lambda) % module) + module - xp + module - xp) % module;
  const yr = (((lambda * (xp + module - xr)) % module) + module - yp) % module;

  return [xr, yr];
}

export function point_add(
  p: Point,
  q: Point,
  a: bigint,
  module: bigint
): Point {
  if (p === null) {
    return q;
  }
  if (q === null) {
    return p;
  }
  const [xp, yp] = p;
  const [xq, yq] = q;

  if (xp === xq) {
    if (yp === yq) {
      return point_double(p, a, module);
    } else {
      return null;
    }
  }

  const lambda =
    (((yq + module - yp) % module) *
      modulo_inverse((xq + module - xp) % module, module)) %
    module;
  const xr =
    (((lambda * lambda) % module) + module - xp + module - xq) % module;
  const yr = (((lambda * (xp + module - xr)) % module) + module - yp) % module;
  return [xr, yr];
}

export function modulo_power_point(
  base: Point,
  power: bigint,
  a: bigint,
  module: bigint
): Point {
  let result: Point = null;
  while (power > 0) {
    if (power % BigInt(2) !== BigInt(0)) {
      power = power - BigInt(1);
      result = point_add(result, base, a, module);
    }
    power = power / BigInt(2);
    base = point_double(base, a, module);
  }
  return result;
}

export function is_on_curve(p: Point, a: bigint, b: bigint, module: bigint) {
  if (p === null) {
    return true;
  }
  const [x, y] = p;
  const y2 = (y * y) % module;
  const y2fromx = (((x * x * x) % module) + ((a * x) % module) + b) % module;
  return y2 === y2fromx;
}

export function get_point_inverse(point: Point, curve_p: bigint): Point {
  if (!point) {
    return point;
  }
  return [point[0], curve_p - point[1]];
}
