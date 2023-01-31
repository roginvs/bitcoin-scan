import { Socket } from "net";
import { parseMessage, parseVersion } from "./messages.parse";
import {
  buildMessage,
  createVerackMessage,
  createVersionMessage,
} from "./messages.create";
import { BitcoinMessage, MessagePayload } from "./messages.types";
import { joinBuffers } from "./utils";

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

    if (pingTimerInterval) {
      clearInterval(pingTimerInterval);
      pingTimerInterval = null;
    }

    for (const timer of watchdogTimers.values()) {
      clearTimeout(timer);
    }
    watchdogTimers.clear();

    me.onMessage("", Buffer.alloc(0) as MessagePayload);
  });

  client.on("error", (e) => {
    console.warn(`Connection error: ${e.name} ${e.message}`);
    // Nothing here but we should have a listener to prevent crashing
    // We clear everything in the "close" listener
  });

  const send = (msg: BitcoinMessage) => {
    if (sendThisMessagesWhenConnected) {
      sendThisMessagesWhenConnected.push(msg);
    } else {
      client.write(msg);
    }
  };

  const watchdogTimers = new Map<string, NodeJS.Timer>();
  function clearWatchdog(kind: string) {
    const existingTimer = watchdogTimers.get(kind);
    if (existingTimer) {
      clearTimeout(existingTimer);
    } else {
      console.warn(`Can not clear existing timer ${kind}, no timer`);
    }
  }
  function raiseWatchdog(kind: string, timeout = 30000) {
    const existingTimer = watchdogTimers.get(kind);
    if (existingTimer) {
      console.warn(`Already have timer for ${kind}`);
      clearTimeout(existingTimer);
    }
    watchdogTimers.set(
      kind,
      setTimeout(() => {
        console.warn(`Watchdog timer ${kind} was not cleared!`);
        client.destroy();
      }, timeout)
    );
  }

  raiseWatchdog("initial connection");

  let pingTimerInterval: NodeJS.Timer | null;

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
        clearWatchdog("initial connection");
        if (pingTimerInterval) {
          console.warn(`Seeing "version" once again`);
          client.destroy();
          return;
        }

        pingTimerInterval = setInterval(() => {
          const pingPayload = Buffer.from(new Array(8).fill(0)).map(() =>
            Math.floor(Math.random() * 256)
          ) as MessagePayload;
          client.write(buildMessage("ping", pingPayload));
          raiseWatchdog("pong" + pingPayload.toString("hex"));
        }, 120 * 1000);

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
      } else if (command === "pong") {
        clearWatchdog("pong" + payload.toString("hex"));
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
    raiseWatchdog,
    clearWatchdog,
    close() {
      client.destroy();
    },
  };

  return me;
}