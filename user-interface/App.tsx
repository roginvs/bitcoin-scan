import * as React from "react";
import Container from "react-bootstrap/Container";
import Form from "react-bootstrap/Form";
import { signatureToPublicKey } from "../signature/signatureToPublicKey";
import { pubkeyToWallet } from "./pubkeyToWallet";

const DEFAULT_SIGNATURE =
  `-----BEGIN BITCOIN SIGNED MESSAGE-----\n` +
  "Welcome to signature verification!\nThis page can verify all types of signatures\nThis message was signed by 19aJFYXVr9wjEm3cfQnJDHW2oyNEY2soWR wallet\nEnter a signed message here" +
  `\n-----BEGIN BITCOIN SIGNATURE-----
Comment: Comments are supported!

H1l9KUtXQgAMLD6aM9Q9BM/42q+YGfxGK0kK8sui8iIUBbYhrBTqt+s+Yal2CNBLOYsU3Ld+9xfGxUTj8CIueww=
-----END BITCOIN SIGNATURE-----
`;

export function App() {
  const [sigVal, setSigVal] = React.useState("");
  const [expectedWallet, setExpectedWallet] = React.useState("");
  const [walletText, setWalletText] = React.useState("");

  const updateTimer = React.useRef<null | number>(0);
  const onSigUpdate = (newSig: string) => {
    setSigVal(newSig);
    if (updateTimer.current !== null) {
      window.clearTimeout(updateTimer.current);
    }
    setExpectedWallet("");
    updateTimer.current = window.setTimeout(() => {
      try {
        const pubKey = signatureToPublicKey(newSig);

        if (!pubKey) {
          console.info(`No public key`);
          setExpectedWallet("");
          return;
        }
        console.info(pubKey);
        const wallet = pubkeyToWallet(pubKey.pubKeyHex, pubKey.walletType);
        if (!wallet) {
          console.info(`Failed to create wallet`);
        }
        setExpectedWallet(wallet || "");
      } catch (e) {
        console.info(e);
        setExpectedWallet("");
      }
    }, 200);
  };

  React.useEffect(() => {
    onSigUpdate(DEFAULT_SIGNATURE);
  }, []);

  return (
    <Container className="p-3">
      <Container
        className="p-5 mb-4 bg-light rounded-3"
        style={{ maxWidth: 800 }}
      >
        <h1 className="header text-center">Check Bitcoin signature</h1>
        <Form.Group className="mb-3" controlId="exampleForm.ControlInput1">
          <Form.Label>Signed message:</Form.Label>
          <Form.Control
            as="textarea"
            className="font-monospace"
            placeholder="Enter signature here"
            style={{ height: 300 }}
            value={sigVal}
            onChange={(e) => onSigUpdate(e.target.value)}
          />
        </Form.Group>
        <Form.Group className="mb-3" controlId="exampleForm.ControlInput1">
          <Form.Label>Enter wallet:</Form.Label>
          <Form.Control
            as="input"
            placeholder={expectedWallet}
            value={walletText}
            className="font-monospace"
            onChange={(e) => setWalletText(e.target.value)}
          />
        </Form.Group>

        <h4
          className={`text-center mt-5 ${
            !walletText || !expectedWallet
              ? "text-muted"
              : walletText === expectedWallet
              ? "text-success"
              : "text-danger"
          }`}
        >
          {!expectedWallet ? (
            ""
          ) : !walletText ? (
            <span>
              Signature is valid for <b>{expectedWallet}</b>
            </span>
          ) : walletText === expectedWallet ? (
            "Signature is valid!"
          ) : (
            "Signature is not valid"
          )}
        </h4>
      </Container>
    </Container>
  );
}
