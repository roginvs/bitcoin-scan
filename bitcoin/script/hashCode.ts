export function readHashCodeType(hashCodeType: number) {
  const isSigHashNone = (hashCodeType & 0x1f) === 0x00000002;
  const isSigHashSingle = (hashCodeType & 0x1f) === 0x00000003;
  const isSigHashAnyone = !!(hashCodeType & 0x00000080);
  return { isSigHashNone, isSigHashSingle, isSigHashAnyone };
}
export function packHashCodeType(
  hashCodeType: ReturnType<typeof readHashCodeType>
) {
  return (
    (hashCodeType.isSigHashAnyone ? 0x00000080 : 0) +
    (hashCodeType.isSigHashNone
      ? 0x02
      : hashCodeType.isSigHashSingle
      ? 0x03
      : 0)
  );
}
