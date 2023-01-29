export function modulo_power(base: bigint, power: bigint, module: bigint) {
  let result = BigInt(1);
  while (power > 0) {
    if (power % BigInt(2) != BigInt(0)) {
      power = power - BigInt(1);
      result = (result * base) % module;
    }
    power = power / BigInt(2);
    base = (base * base) % module;
  }
  return result;
}

function legendre_symbol(a: bigint, module: bigint) {
  return modulo_power(a, (module - BigInt(1)) / BigInt(2), module);
}

export function square_root(a: bigint, module: bigint) {
  // Tonelli–Shanks_algorithm
  if (legendre_symbol(a, module) != BigInt(1)) {
    throw new Error(`Not a quadratic residue`);
  }
  function get_2s_q(p: bigint) {
    const p1 = p - BigInt(1);
    let q = p1;
    let s = BigInt(0);
    while (q % BigInt(2) == BigInt(0)) {
      q = q / BigInt(2);
      s += BigInt(1);
    }
    // if (BigInt(2) ** BigInt(s) * q !== p1) {
    //   throw new Error("Internal error");
    // }
    // if (q % BigInt(2) == BigInt(0)) {
    //   throw new Error("Internal error ");
    // }

    return { s, q };
  }

  const { s, q } = get_2s_q(module);

  if (s == BigInt(1)) {
    const result = modulo_power(a, (module + BigInt(1)) / BigInt(4), module);
    // if (modulo_power(result, BigInt(2), module) != a) {
    //   throw new Error("Internal error");
    // }
    return result;
  } else {
    throw new Error("LOL not implemented");
  }
}

/**
 * return (g, x, y) such that a*x + b*y = g = gcd(a, b)
 */
function extended_euclidean(a: bigint, b: bigint): [bigint, bigint, bigint] {
  if (a == BigInt(0)) {
    return [b, BigInt(0), BigInt(1)];
  } else {
    const [g, y, x] = extended_euclidean(b % a, a);
    return [g, x - (b / a) * y, y];
  }
}

export function modulo_inverse(a: bigint, module: bigint) {
  const [g, x, y] = extended_euclidean(a, module);
  if (g != BigInt(1)) {
    throw new Error("modular inverse does not exist");
  } else {
    return (x + module) % module;
  }
}
