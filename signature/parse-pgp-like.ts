export function readPgpLikePart(
  input: string,
  replaceLfWithCrLf: boolean,
  allowedHeaders: string[]
) {
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

  let dataStringWithHeaders = s.slice(
    headerEndingDashesIndex + 5,
    nextDashesIndex
  );
  if (dataStringWithHeaders.startsWith("\n")) {
    dataStringWithHeaders = dataStringWithHeaders.slice(1);
  } else if (dataStringWithHeaders.startsWith("\r\n")) {
    dataStringWithHeaders = dataStringWithHeaders.slice(2);
  }

  if (dataStringWithHeaders.endsWith("\r")) {
    dataStringWithHeaders = dataStringWithHeaders.slice(0, -1);
  }

  let headers: Record<string, string> = {};
  let dataString = dataStringWithHeaders;

  {
    const lines = dataStringWithHeaders.split("\n");
    while (true) {
      const line = lines.shift()?.trim() || "";
      const headerSplitIndex = line.indexOf(": ");
      const header =
        headerSplitIndex > -1 ? line.slice(0, headerSplitIndex) : "";
      const headerValue =
        headerSplitIndex > -1 ? line.slice(headerSplitIndex + 2) : "";
      if (!line || !header || !allowedHeaders.includes(header)) {
        if (Object.keys(headers).length > 0) {
          dataString = lines.join("\n");
        } else {
          // do nothing, keep whole dataString as it is
        }
        break;
      }
      headers[header] = headerValue;
    }
  }

  //  Dash escaped cleartext is the ordinary cleartext where every line
  //    starting with a dash '-' (0x2D) is prefixed by the sequence dash '-'
  //  (0x2D) and space ' ' (0x20).
  dataString = dataString.split("\n- ").join("\n");

  if (replaceLfWithCrLf) {
    dataString = dataString
      .split("\n")
      // Replace all <LF> breaks into <CR><LF>
      // See rfc2440
      //  "As with binary signatures on text documents, a cleartext signature is
      //    calculated on the text using canonical <CR><LF> line endings. "
      .map((line) => (line.endsWith("\r") ? line.slice(0, -1) : line))
      .join("\r\n");
  }

  return {
    header: s.slice(5, headerEndingDashesIndex),
    data: dataString,
    rest: s.slice(nextDashesIndex + 1),
    headers,
  };
}

export function parsePgpLike(s: string) {
  const message = readPgpLikePart(s, false, ["Comment"]);
  if (!message) {
    return null;
  }
  if (message.header !== "BEGIN BITCOIN SIGNED MESSAGE") {
    return null;
  }
  const signature = readPgpLikePart(message.rest, false, [
    "Version",
    "Address",
  ]);
  if (!signature) {
    return null;
  }
  if (signature.header !== "BEGIN BITCOIN SIGNATURE") {
    return null;
  }
  return {
    message: message.data,
    signatureBase64: signature.data,
  };
}
