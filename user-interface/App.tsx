import * as React from "react";
import Container from "react-bootstrap/Container";
import Form from "react-bootstrap/Form";
import { signatureToPublicKey } from "../signature/signatureToPublicKey";
import { pubkeyToWallet } from "./pubkeyToWallet";

const DEFAULT_SIGNATURE = `-----BEGIN BITCOIN SIGNED MESSAGE-----
Welcome to signature check!
Enter a signed message here
-----BEGIN BITCOIN SIGNATURE-----
Address: bc1qtcxjyxsm5uk8z6gsf8s322yh64fnms6pgcslz2

KLZq71rK2AIys9yEzkK1U9vavIFLjgRmRMxtqe4k3yNV
OVD7WmyS1oYLnxsfk0E/Y1g8mQiWxnBt1U89Zm5E9ks=
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
    updateTimer.current = window.setTimeout(() => {
      try {
        const pubKey = signatureToPublicKey(newSig);
        if (!pubKey) {
          setExpectedWallet("");
          return;
        }

        const wallet = pubkeyToWallet(pubKey.pubKeyHex, pubKey.walletType);
        setExpectedWallet(wallet || "");
      } catch (e) {
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
