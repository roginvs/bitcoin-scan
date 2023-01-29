import {
  get_point_from_x,
  get_point_inverse,
  is_on_curve,
  modulo_power_point,
  Point,
  point_add,
  point_double,
} from "./curves";
import { Secp256k1 } from "./curves.named";

const { p, a, b, G, n } = Secp256k1;

/** G+G */
const GG: Point = [
  BigInt(
    "89565891926547004231252920425935692360644145829622209833684329913297188986597"
  ),
  BigInt(
    "12158399299693830322967808612713398636155367887041628176798871954788371653930"
  ),
];
/** G+G+G */
const GGG: Point = [
  BigInt(
    "112711660439710606056748659173929673102114977341539408544630613555209775888121"
  ),
  BigInt(
    "25583027980570883691656905877401976406448868254816295069919888960541586679410"
  ),
];

const GGGGG: Point = [
  BigInt(
    "21505829891763648114329055987619236494102133314575206970830385799158076338148"
  ),
  BigInt(
    "98003708678762621233683240503080860129026887322874138805529884920309963580118"
  ),
];

describe("Utils", () => {
  it(`get_y`, () => expect(get_point_from_x(G![0], a, b, p)).toStrictEqual(G));
  it(`point_double`, () => expect(point_double(G, a, p)).toStrictEqual(GG));
  it(`point_add`, () => expect(point_add(G, GG, a, p)).toStrictEqual(GGG));
  describe(`is on curve`, () => {
    it(`G`, () => expect(is_on_curve(G, a, b, p)).toBe(true));
    it(`Infinity`, () => expect(is_on_curve(null, a, b, p)).toBe(true));
    it(`Not on curve`, () =>
      expect(is_on_curve([BigInt(2), BigInt(3)], a, b, p)).toBe(false));
  });
  describe("modulo_power_point", () => {
    it(`2*G`, () =>
      expect(modulo_power_point(G, BigInt(2), a, p)).toStrictEqual(GG));
    it(`3*G`, () =>
      expect(modulo_power_point(G, BigInt(3), a, p)).toStrictEqual(GGG));
    it(`5*G`, () =>
      expect(modulo_power_point(G, BigInt(5), a, p)).toStrictEqual(GGGGG));
    it(`Big value 1`, () =>
      expect(
        modulo_power_point(
          G,
          BigInt(
            "68793525898763659912401076300172835129294399329202593613208810240515883368816"
          ),
          a,
          p
        )
      ).toStrictEqual([
        BigInt(
          "77128963663536253970909112694452629228075714100920950036448491305267992831505"
        ),
        BigInt(
          "96969571918312996345828398122272296409390771412542348403846197835038149492603"
        ),
      ]));

    it(`Big value 2`, () =>
      expect(
        modulo_power_point(
          G,
          BigInt(
            "0xc2cdf0a8b0a83b35ace53f097b5e6e6a0a1f2d40535eff1cf434f52a43d59d8f"
          ),
          a,
          p
        )
      ).toStrictEqual([
        BigInt(
          "0x6fcc37ea5e9e09fec6c83e5fbd7a745e3eee81d16ebd861c9e66f55518c19798"
        ),
        BigInt(
          "0x4e9f113c07f875691df8afc1029496fc4cb9509b39dcd38f251a83359cc8b4f7"
        ),
      ]));

    it(`G*n`, () => {
      expect(modulo_power_point(G, n, a, p)).toStrictEqual(null);
    });
  });
  it(`get_point_inverse`, () =>
    expect(point_add(G, get_point_inverse(G, p), a, p)).toBe(null));
});

/*


Curve: secp256k1
Alice's private key:
   0xc2cdf0a8b0a83b35ace53f097b5e6e6a0a1f2d40535eff1cf434f52a43d59d8f
Alice's public key:
  (0x6fcc37ea5e9e09fec6c83e5fbd7a745e3eee81d16ebd861c9e66f55518c19798,
   0x4e9f113c07f875691df8afc1029496fc4cb9509b39dcd38f251a83359cc8b4f7)



secp256k1
Point 1G: (55066263022277343669578718895168534326250603453777594175500187360389116729240, 32670510020758816978083085130507043184471273380659243275938904335757337482424)
(1G) in hex: 0x79be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798,0x483ada7726a3c4655da4fbfc0e1108a8fd17b448a68554199c47d08ffb10d4b8)

Point 2G: (89565891926547004231252920425935692360644145829622209833684329913297188986597, 12158399299693830322967808612713398636155367887041628176798871954788371653930)
(2G) in hex: 0x79be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798,0x483ada7726a3c4655da4fbfc0e1108a8fd17b448a68554199c47d08ffb10d4b8)

Point 3G: (112711660439710606056748659173929673102114977341539408544630613555209775888121, 25583027980570883691656905877401976406448868254816295069919888960541586679410)
(3G) in hex: 0x79be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798,0x483ada7726a3c4655da4fbfc0e1108a8fd17b448a68554199c47d08ffb10d4b8)

G+G: (89565891926547004231252920425935692360644145829622209833684329913297188986597, 12158399299693830322967808612713398636155367887041628176798871954788371653930)

G+2G: (112711660439710606056748659173929673102114977341539408544630613555209775888121, 25583027980570883691656905877401976406448868254816295069919888960541586679410)

Point 5G: (21505829891763648114329055987619236494102133314575206970830385799158076338148, 98003708678762621233683240503080860129026887322874138805529884920309963580118)
(5G) in hex: 0x79be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798,0x483ada7726a3c4655da4fbfc0e1108a8fd17b448a68554199c47d08ffb10d4b8)


Point 68793525898763659912401076300172835129294399329202593613208810240515883368816G: (77128963663536253970909112694452629228075714100920950036448491305267992831505, 96969571918312996345828398122272296409390771412542348403846197835038149492603)
(68793525898763659912401076300172835129294399329202593613208810240515883368816G) in hex: 0x79be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798,0x483ada7726a3c4655da4fbfc0e1108a8fd17b448a68554199c47d08ffb10d4b8)


   */