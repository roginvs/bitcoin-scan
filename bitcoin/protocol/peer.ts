import { Socket } from "net";
import { parseMessage, parseVersion } from "./messages.parse";
import {
  buildMessage,
  createVerackMessage,
  createVersionMessage,
} from "./messages.create";
import { BitcoinMessage, MessagePayload } from "./messages.types";
import { joinBuffers } from "../utils/joinBuffer";
import { createLogger } from "../../logger/logger";
import { randomBytes } from "crypto";
import { nodeId } from "./nodeid";

const { info, warn, debug } = createLogger("PEER");

export type PeerConnection = ReturnType<typeof createPeer>;
/**
 * This is simple wrapper of Socket
 * - It buffers Bitcoin messages and calls callback when full message is ready
 * - It answers on ping/pong messages
 */
export function createOutgoingPeer(
  host: string,
  port: number,
  lastKnownBlock: number
) {
  const client = new Socket();
  client.connect(port, host);
  return createPeer(client, true, lastKnownBlock);
}
export function createIncomingPeer(client: Socket, lastKnownBlock: number) {
  return createPeer(client, false, lastKnownBlock);
}

function createPeer(
  client: Socket,
  isOutgoing: boolean,
  lastKnownBlock: number
) {
  let sendThisMessagesWhenConnected: BitcoinMessage[] | null = [];

  function addr() {
    return `${client.remoteAddress}:${client.remotePort}`;
  }

  client.on("connect", () => {
    debug(`${addr()} Connected`);
    if (isOutgoing) {
      client.write(createVersionMessage(lastKnownBlock));
    } else {
      // We are waiting for the first "version" message
    }
  });

  client.on("close", function () {
    debug(`${addr()} Connection closed`);

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
    debug(`${addr()} Connection error: ${e.name} ${e.message}`);
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
      watchdogTimers.delete(kind);
    } else {
      warn(`${addr()} Can not clear existing timer ${kind}, no timer`);
    }
  }
  function raiseWatchdog(kind: string, timeout = 30000) {
    const existingTimer = watchdogTimers.get(kind);
    if (existingTimer) {
      warn(`${addr()} Already have timer for ${kind}`);
      clearTimeout(existingTimer);
    }
    watchdogTimers.set(
      kind,
      setTimeout(() => {
        debug(`${addr()} Watchdog timer ${kind} was not cleared!`);
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

      /**
       * outgoing              !outgoing == incoming
       *
       * version     ------>
       *             <------   version
       *
       *             <------------- verack
       * verack      ------>   /
       *             <---------
       *                      [handshare is done]
       * [handshake is done]
       *
       *
       * TODO: Looks like in this implementation
       *   we do not care did we get "verack" for outgoing connection
       *
       */
      function handshakeIsDone() {
        clearWatchdog("initial connection");
        if (pingTimerInterval) {
          warn(`${addr()} Seeing "version"/"verack" once again`);
          client.destroy();
          return;
        }

        pingTimerInterval = setInterval(() => {
          const pingPayload = randomBytes(8) as MessagePayload;
          client.write(buildMessage("ping", pingPayload));
          raiseWatchdog("pong" + pingPayload.toString("hex"));
        }, 120 * 1000);

        debug(`${addr()} Handshake is done`);
        if (sendThisMessagesWhenConnected) {
          for (const msg of sendThisMessagesWhenConnected) {
            client.write(msg);
          }
          sendThisMessagesWhenConnected = null;
        }
      }

      if (command === "verack") {
        if (!isOutgoing) {
          handshakeIsDone();
        }
      } else if (command === "version") {
        const version = parseVersion(payload);
        me.id = `${addr()}`;
        if (version.nonce.equals(nodeId)) {
          warn(`${me.id} Got connections with the same nodeid, closing`);
          client.destroy();
          return;
        }
        info(
          `${me.id} version=${version.version} startHeight=${version.startHeight} ` +
            `${version.userAgent} ${version.services.join(",")}`
        );

        if (isOutgoing) {
          client.write(createVerackMessage());
          handshakeIsDone();
        } else {
          client.write(createVersionMessage(lastKnownBlock));
          client.write(createVerackMessage());
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
    id: `<${addr()}>`,
    get host() {
      return client.remoteAddress;
    },
    get port() {
      return client.remotePort;
    },
    isOutgoing,
  };

  return me;
}
