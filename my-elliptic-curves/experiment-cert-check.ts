import { verify, createPublicKey } from "crypto";

// Just took a sample certificate and then check it self-signed signature
// Offsets are found via "openssl asn1parse -i -dump"

const certRaw = Buffer.from(
  `
    MIICSTCCAe6gAwIBAgIUXS1v2Ql/jUSONgWh10V0uStJJQwwCgYIKoZIzj0EAwIw
ezELMAkGA1UEBhMCRkkxDzANBgNVBAgMBlV1c2ltYTERMA8GA1UEBwwISGVsc2lu
a2kxDjAMBgNVBAoMBVJvZ2luMRYwFAYDVQQDDA1WYXNpbGlpIFJvZ2luMSAwHgYJ
KoZIhvcNAQkBFhFyb2dpbnZzQGdtYWlsLmNvbTAeFw0yMzAxMDUwNTMwMThaFw0y
MzAyMDQwNTMwMThaMHsxCzAJBgNVBAYTAkZJMQ8wDQYDVQQIDAZVdXNpbWExETAP
BgNVBAcMCEhlbHNpbmtpMQ4wDAYDVQQKDAVSb2dpbjEWMBQGA1UEAwwNVmFzaWxp
aSBSb2dpbjEgMB4GCSqGSIb3DQEJARYRcm9naW52c0BnbWFpbC5jb20wVjAQBgcq
hkjOPQIBBgUrgQQACgNCAAQDj42VLhI1rvn4KvwPfJ7RaK/zVSHmDDsGWc0EFCCL
HMqdiHONTL3t0ObfXjScb/aUjm2HN3iTTqC4rE6Unsbwo1MwUTAdBgNVHQ4EFgQU
X0V60+/3KgPCTvMyFI2vxV08kPQwHwYDVR0jBBgwFoAUX0V60+/3KgPCTvMyFI2v
xV08kPQwDwYDVR0TAQH/BAUwAwEB/zAKBggqhkjOPQQDAgNJADBGAiEAltP+2fTx
07njMlDR12nIb5Q9o/Eiveka4y+3NEgOqTwCIQD64RrmPmrXorao2Mi1zp2t8Xqu
IzNXsNTDkXCg4fJKwA==
    `,
  "base64",
);

const signature = certRaw.slice(514 + 2).slice(1);

const pubKey = certRaw.slice(329, 329 + 2 + 86);

const pub = createPublicKey({
  key: pubKey,
  type: "spki",
  format: "der",
});

const certificateData = certRaw.slice(4, 4 + 4 + 494);

console.info("verify=", verify(undefined, certificateData, pub, signature));
