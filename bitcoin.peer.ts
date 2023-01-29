import { Socket } from "net";
import {
  BitcoinMessage,
  buildMessage,
  createVerackMessage,
  createVersionMessage,
  joinBuffers,
  MessagePayload,
  parseMessage,
  parseVersion,
} from "./bitcoin.messages";

/**
 * This is simple wrapper of Socket
 * - It buffers Bitcoin messages and calls callback when full message is ready
 * - It answers on ping/pong messages
 */
export function createPeer(host: string, port: number, lastKnownBlock: number) {
  let client = new Socket();

  let sendThisMessagesWhenConnected: BitcoinMessage[] | null = [];

  client.connect(port, host, () => {
    console.log(`Connected to ${host}:${port}`);
    client.write(createVersionMessage(lastKnownBlock));
  });

  client.on("close", function () {
    console.log("Connection closed");
    me.onMessage("", Buffer.alloc(0) as MessagePayload);
  });

  const send = (msg: BitcoinMessage) => {
    if (sendThisMessagesWhenConnected) {
      sendThisMessagesWhenConnected.push(msg);
    } else {
      client.write(msg);
    }
  };

  let incomingBuf: Buffer = Buffer.alloc(0);
  client.on("data", (data) => {
    if (incomingBuf.length === 0) {
      incomingBuf = data;
    } else {
      incomingBuf = joinBuffers(incomingBuf, data);
    }
    while (true) {
      const parsed = parseMessage(incomingBuf);
      if (!parsed) {
        break;
      }
      const [command, payload, rest] = parsed;
      incomingBuf = rest;

      if (command === "verack") {
        continue;
      } else if (command === "version") {
        parseVersion(payload);
        client.write(createVerackMessage());

        if (sendThisMessagesWhenConnected) {
          for (const msg of sendThisMessagesWhenConnected) {
            client.write(msg);
          }
          sendThisMessagesWhenConnected = null;
        }
      } else if (command === "alert") {
        // do nothing
      } else if (command === "ping") {
        client.write(buildMessage("pong", payload));
      } else {
        me.onMessage(command, payload);
      }
    }
  });
  const me = {
    send,
    onMessage: (command: string, payload: MessagePayload): void => {
      throw new Error(`Got message but onMessage handler is not overwritten`);
    },
  };

  return me;
}
