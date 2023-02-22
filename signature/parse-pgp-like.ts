export function readPgpLikePart(input: string) {
  let s = input.trimStart();
  if (!s.startsWith("-----")) {
    return null;
  }
  const headerEndingDashesIndex = s.indexOf("-----", 5);
  if (headerEndingDashesIndex < 0) {
    return null;
  }

  const nextDashesIndex = s.indexOf("\n-----", headerEndingDashesIndex + 1);
  if (nextDashesIndex < 0) {
    return null;
  }

  let dataString = s.slice(headerEndingDashesIndex + 5, nextDashesIndex);
  if (dataString.startsWith("\n")) {
    dataString = dataString.slice(1);
  } else if (dataString.startsWith("\r\n")) {
    dataString = dataString.slice(2);
  }

  if (dataString.endsWith("\r")) {
    dataString = dataString.slice(0, -1);
  }

  dataString = dataString
    .split("\n")
    // Replace all <LF> breaks into <CR><LF>
    // See rfc2440
    //  "As with binary signatures on text documents, a cleartext signature is
    //    calculated on the text using canonical <CR><LF> line endings. "
    .map((line) => (line.endsWith("\r") ? line.slice(0, -1) : line))
    .join("\r\n");

  return {
    header: s.slice(5, headerEndingDashesIndex),
    data: dataString,
    rest: s.slice(nextDashesIndex + 1),
  };
}

export function parsePgpLike(s: string) {}
