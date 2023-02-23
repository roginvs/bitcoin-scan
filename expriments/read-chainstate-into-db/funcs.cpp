#include <cstdint>
#include <span>

std::span<const char> read_var_int(std::span<const char> data, uint64_t *out)
{
    *out = 0;
    size_t bytes_readed = 0;
    while (true)
    {
        *out <<= 7;
        unsigned char current = data[bytes_readed];
        bytes_readed++;
        if (current & 0b10000000)
        {
            *out += (current - 0b10000000 + 1);
        }
        else
        {
            // This is last byte
            *out += current;
            break;
        };
    };

    return std::span(data.begin() + bytes_readed, data.size() - bytes_readed);
};

void test_read_var_int()
{
    uint64_t out;
    std::span<const char> rest;

    rest = read_var_int(std::span("\xc0\x84\x26", 3), &out);
    if (rest.size() != 0)
    {
        printf("Size is wrong %li\n", rest.size());
        exit(1);
    };
    if (out != 1065638)
    {
        printf("Out is wrong %li\n", out);
        exit(1);
    }
}