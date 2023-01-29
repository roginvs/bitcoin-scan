import { genesisBlockHash } from "./bitcoin/consts";
import { createGetheadersMessage } from "./bitcoin/messages.create";
import { createPeer } from "./bitcoin/peer";

const peer = createPeer("95.216.21.47", 8333, 1);

peer.onMessage = (command, payload) => {
  console.info("msg:", command, payload);
};

peer.send(createGetheadersMessage([genesisBlockHash]));
