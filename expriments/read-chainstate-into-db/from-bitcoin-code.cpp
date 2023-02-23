
#include <cstdint>
#include "vector"
#include "memory"
#include <span>
#include <string.h>

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
        /*
        unsigned char vch[33] = {};
        vch[0] = nSize - 2;
        memcpy(&vch[1], in.data(), 32);
        CPubKey pubkey{vch};
        if (!pubkey.Decompress())
            return false;
        assert(pubkey.size() == 65);
        script.resize(67);
        script[0] = 65;
        memcpy(&script[1], pubkey.begin(), 65);
        script[66] = OP_CHECKSIG;
        return true;
        */
        printf("Got script with uncompressed public key, need to decompress\n");
        script.resize(0);
        return;
    }

    script.resize(in.size());
    memcpy(&script, in.data(), in.size());
    return;
}