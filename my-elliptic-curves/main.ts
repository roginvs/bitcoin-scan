import { get_point_from_x, modulo_power_point } from "./curves";
import { Secp256k1 } from "./curves.named";

// p = 2**256 - 2**32 - 2**9 - 2**8 - 2**7 - 2**6 - 2**4 - 1
const { p, a, b } = Secp256k1;

const Gx = Secp256k1.G![0];

console.info("==========");
/*

# Generate key 
openssl ecparam -genkey -out eckey.pem -name secp256k1

# This is header, not very interesting
cat eckey.pem  | openssl asn1parse -i -dump

# This is out data (try without -dump for easy copy-paste)
tail -n +4 eckey.pem  | openssl asn1parse -i -dump

*/

const privateKey = BigInt(
  "0x3292DD43869BC04B89323EBFBD9AE277A965ABFFFFF495CED0F6915914281CAE"
);
console.info(
  "Using private key let's re-generate public key and check it. It starts with 04 and then x and y coordinates of the point",
  modulo_power_point(get_point_from_x(Gx, a, b, p), privateKey, a, p)!.map(
    (x) => x.toString(16)
  )
);

/* 

# Now generate self-signed certificate
openssl req -x509 -new -key eckey.pem -out cert.pem 

cat cert.pem | openssl asn1parse -i -dump
*/
