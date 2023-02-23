
#include <cstdint>
#include "vector"
#include "memory"
#include <span>
#include <string.h>
#include <secp256k1.h>

uint64_t DecompressAmount(uint64_t x)
{
    // x = 0  OR  x = 1+10*(9*n + d - 1) + e  OR  x = 1+10*(n - 1) + 9
    if (x == 0)
        return 0;
    x--;
    // x = 10*(9*n + d - 1) + e
    int e = x % 10;
    x /= 10;
    uint64_t n = 0;
    if (e < 9)
    {
        // x = 9*n + d - 1
        int d = (x % 9) + 1;
        x /= 9;
        // x = n
        n = x * 10 + d;
    }
    else
    {
        n = x + 1;
    }
    while (e)
    {
        n *= 10;
        e--;
    }
    return n;
}

const unsigned char OP_DUP = 0x76;
const unsigned char OP_HASH160 = 0xa9;
const unsigned char OP_EQUALVERIFY = 0x88;
const unsigned char OP_CHECKSIG = 0xac;
const unsigned char OP_EQUAL = 0x87;

void DecompressScript(std::vector<unsigned char> &script, unsigned int nSize, std::span<const char> &in)
{
    switch (nSize)
    {
    case 0x00:
        script.resize(25);
        script[0] = OP_DUP;
        script[1] = OP_HASH160;
        script[2] = 20;
        memcpy(&script[3], in.data(), 20);
        script[23] = OP_EQUALVERIFY;
        script[24] = OP_CHECKSIG;
        return;
    case 0x01:
        script.resize(23);
        script[0] = OP_HASH160;
        script[1] = 20;
        memcpy(&script[2], in.data(), 20);
        script[22] = OP_EQUAL;
        return;
    case 0x02:
    case 0x03:
        script.resize(35);
        script[0] = 33;
        script[1] = nSize;
        memcpy(&script[2], in.data(), 32);
        script[34] = OP_CHECKSIG;
        return;
    case 0x04:
    case 0x05:

        unsigned char vch[33] = {};
        vch[0] = nSize - 2;
        memcpy(&vch[1], in.data(), 32);

        // CPubKey pubkey{vch};
        // if (!pubkey.Decompress())
        //     return false;
        // assert(pubkey.size() == 65);

        static secp256k1_context *ctx = secp256k1_context_create(SECP256K1_CONTEXT_NONE);
        secp256k1_pubkey pubkey;

        if (!secp256k1_ec_pubkey_parse(ctx, &pubkey, vch, sizeof(vch)))
        {
            printf("Failed parsing the public key\n");
            exit(1);
        };

        unsigned char pubkey_uncompressed[65];
        size_t pubkey_uncompressed_len = sizeof(pubkey_uncompressed);
        if (!secp256k1_ec_pubkey_serialize(ctx, pubkey_uncompressed, &pubkey_uncompressed_len, &pubkey, SECP256K1_EC_UNCOMPRESSED))
        {
            printf("Failed serializing the public key\n");
            exit(1);
        }

        script.resize(67);
        script[0] = 65;
        memcpy(&script[1], pubkey_uncompressed, 65);
        script[66] = OP_CHECKSIG;
        return;
    }

    script.resize(in.size());
    //  printf("RRR %lu script_size=%lu\n", in.size(), script.size());
    memcpy(&script[0], in.data(), in.size());
    return;
}