export function readScript(script: Buffer) {
  let i = 0;
  const out: string[] = [];
  while (i < script.length) {
    const opcode = script[i];

    const simpleOpcodes: Record<number, string | null> = {
      0x7e: null,
      0x7f: null,
      0x80: null,
      0x81: null,
      0x83: null,
      0x84: null,
      0x85: null,
      0x86: null,
      0x8d: null,
      0x8e: null,
      0x95: null,
      0x96: null,
      0x97: null,
      0x98: null,
      0x99: null,

      0x00: "OP_FALSE",
      0x4f: "OP_1NEGATE",
      0x50: "OP_RESERVED",
      0x51: "OP_TRUE",
      0x52: "OP_2",
      0x53: "OP_3",
      0x54: "OP_4",
      0x55: "OP_5",
      0x56: "OP_6",
      0x57: "OP_7",
      0x58: "OP_8",
      0x59: "OP_9",
      0x5a: "OP_10",
      0x5b: "OP_11",
      0x5c: "OP_12",
      0x5d: "OP_13",
      0x5e: "OP_14",
      0x5f: "OP_15",
      0x60: "OP_16",

      0x61: "OP_NOP",

      0x62: "OP_VER!",

      0x63: "OP_IF",
      0x64: "OP_NOTIF",
      0x65: "!OP_VERIF!",
      0x66: "!OP_VERNOTIF!",
      0x67: "OP_ELSE",
      0x68: "OP_ENDIF",
      0x69: "OP_VERIFY",
      0x6a: "OP_RETURN",

      0x6b: "OP_TOALTSTACK",
      0x6c: "OP_FROMALTSTACK",

      0x6d: "OP_2DROP",
      0x6e: "OP_2DUP",
      0x6f: "OP_3DUP",
      0x70: "OP_2OVER",
      0x71: "OP_2ROT",
      0x72: "OP_2SWAP",
      0x73: "OP_IFDUP",
      0x74: "OP_DEPTH",
      0x75: "OP_DROP",
      0x76: "OP_DUP",
      0x77: "OP_NIP",
      0x78: "OP_OVER",
      0x79: "OP_PICK",
      0x7a: "OP_ROLL",
      0x7b: "OP_ROT",
      0x7c: "OP_SWAP",
      0x7d: "OP_TUCK",

      0x82: "OP_SIZE",

      0x87: "OP_EQUAL",
      0x88: "OP_EQUALVERIFY",

      0x89: "OP_RESERVED1",
      0x8a: "OP_RESERVED2",

      0x8b: "OP_1ADD",
      0x8c: "OP_1SUB",

      0x8f: "OP_NEGATE",
      0x90: "OP_ABS",
      0x91: "OP_NOT",
      0x92: "OP_0NOTEQUAL",
      0x93: "OP_ADD",
      0x94: "OP_SUB",

      0x9a: "OP_BOOLAND",
      0x9b: "OP_BOOLOR",
      0x9c: "OP_NUMEQUAL",
      0x9d: "OP_NUMEQUALVERIFY",
      0x9e: "OP_NUMNOTEQUAL",
      0x9f: "OP_LESSTHAN",
      0xa0: "OP_GREATERTHAN",
      0xa1: "OP_LESSTHANOREQUAL",
      0xa2: "OP_GREATERTHANOREQUAL",
      0xa3: "OP_MIN",
      0xa4: "OP_MAX",
      0xa5: "OP_WITHIN",

      0xa6: "OP_RIPEMD160",
      0xa7: "OP_SHA1",
      0xa8: "OP_SHA256",
      0xa9: "OP_HASH160",
      0xaa: "OP_HASH256",
      0xab: "OP_CODESEPARATOR",
      0xac: "OP_CHECKSIG",
      0xad: "OP_CHECKSIGVERIFY",
      0xae: "OP_CHECKMULTISIG",
      0xaf: "OP_CHECKMULTISIGVERIFY",

      0xb0: "OP_NOP1",
      0xb1: "OP_CHECKLOCKTIMEVERIFY",
      0xb2: "OP_CHECKSEQUENCEVERIFY",
      0xb3: "OP_NOP4",
      0xb4: "OP_NOP5",
      0xb5: "OP_NOP6",
      0xb6: "OP_NOP7",
      0xb7: "OP_NOP8",
      0xb8: "OP_NOP9",
      0xb9: "OP_NOP10",

      // Opcode added by BIP 342 (Tapscript)
      0xba: "OP_CHECKSIGADD",

      0xff: "OP_INVALIDOPCODE",
    };

    const opName = simpleOpcodes[opcode];
    if (opName === null) {
      throw new Error(`Disabled opcode 0x${opcode.toString(16)}`);
    } else if (opName === undefined) {
      if (opcode >= 0x01 && opcode <= 0x4b) {
        i++;
        const data = script.subarray(i, i + opcode);
        if (data.length !== opcode) {
          throw new Error(`Lol where data`);
        }
        out.push(data.toString("hex").toUpperCase());
        i += opcode;
      } else if (opcode === 0x4c || opcode === 0x4d || opcode === 0x4e) {
        i++;
        const len =
          opcode === 0x4c
            ? script.readUint8(i)
            : opcode === 0x4d
            ? script.readUInt16LE(i)
            : script.readUint32LE(i);
        i += opcode === 0x4c ? 1 : opcode === 0x4d ? 2 : 4;
        const data = script.subarray(i, i + len);
        if (data.length !== len) {
          throw new Error(`Lol where data`);
        }
        out.push(data.toString("hex").toUpperCase());
        i += len;
      } else {
        throw new Error(`Unknown opcode 0x${opcode.toString(16)}`);
      }
    } else {
      out.push(opName);
      i++;
    }
  }

  return out;
}
