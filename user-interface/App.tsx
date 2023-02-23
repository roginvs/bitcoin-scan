import * as React from "react";
import Container from "react-bootstrap/Container";
import Form from "react-bootstrap/Form";
import { signatureToPublicKey } from "../signature/signatureToPublicKey";
import { pubkeyToWallet } from "./pubkeyToWallet";

const DEFAULT_SIGNATURE =
  `-----BEGIN BITCOIN SIGNED MESSAGE-----\n` +
  "Welcome to signature verification!\nThis page can verify all types of signature address from BIP-0137: P2PKH (comp&uncomp), P2SH+P2WPKH, P2WPKH.\nFor example, this message was signed by 19aJFYXVr9wjEm3cfQnJDHW2oyNEY2soWR address." +
  `\n-----BEGIN BITCOIN SIGNATURE-----
Comment: Comments are supported!

IMJMaQ94TzNhBEyxAw7yMyXua0pqrWbuJInHyF9YEmhtBGPptwAEovxTef+AXeIiy3ybabxTICtTBJju85mZYlI=
-----END BITCOIN SIGNATURE-----
`;

export function App() {
  const [sigVal, setSigVal] = React.useState("");

  const [expectedWallet, setExpectedWallet] = React.useState<null | string[]>(
    null
  );
  const [walletText, setWalletText] = React.useState("");

  const updateTimer = React.useRef<null | number>(0);
  const onSigUpdate = (newSig: string) => {
    setSigVal(newSig);
    if (updateTimer.current !== null) {
      window.clearTimeout(updateTimer.current);
    }
    setExpectedWallet(null);
    updateTimer.current = window.setTimeout(() => {
      try {
        const pubKey = signatureToPublicKey(newSig);

        if (!pubKey) {
          console.info(`No public key`);
          setExpectedWallet(null);
          return;
        }
        console.info(pubKey);
        const wallet = pubkeyToWallet(pubKey.pubKeyHex, pubKey.walletType);
        if (!wallet) {
          console.info(`Failed to create wallet`);
          setExpectedWallet(null);
          return;
        }
        const otherWalletsWithTheSameKey = (
          [
            "P2PKH uncompressed",
            "P2PKH compressed",
            "Segwit P2SH",
            "Segwit Bech32",
          ] as const
        )
          .filter((type) => type !== pubKey.walletType)
          .map((type) => pubkeyToWallet(pubKey.pubKeyHex, type))
          .filter((x) => x)
          .map((x) => x!);

        setExpectedWallet([wallet, ...otherWalletsWithTheSameKey]);
      } catch (e) {
        console.info(e);
        setExpectedWallet(null);
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
        <h1 className="header text-center">Verify a Bitcoin signed message</h1>
        <Form.Group className="mb-3" controlId="exampleForm.ControlInput1">
          <Form.Label>Signed message:</Form.Label>
          <Form.Control
            as="textarea"
            className="font-monospace"
            placeholder="Enter signature here"
            style={{ height: 400 }}
            value={sigVal}
            onChange={(e) => onSigUpdate(e.target.value)}
          />
        </Form.Group>
        <Form.Group className="mb-3" controlId="exampleForm.ControlInput1">
          <Form.Label>Enter wallet:</Form.Label>
          <Form.Control
            as="input"
            placeholder={expectedWallet ? expectedWallet[0] : ""}
            value={walletText}
            className="font-monospace"
            onChange={(e) => setWalletText(e.target.value)}
          />
        </Form.Group>

        <h4
          className={`text-center mt-5 ${
            !walletText || !expectedWallet
              ? "text-muted"
              : walletText === expectedWallet[0]
              ? "text-success"
              : "text-danger"
          }`}
        >
          {!expectedWallet ? (
            ""
          ) : !walletText ? (
            <span>
              Signature is valid for
              <br /> <b>{expectedWallet[0]}</b>
              <br />
              {expectedWallet.slice(1).length > 0 ? (
                <span>
                  <br />
                  Also the same public key belongs to those wallets:
                  <br />
                  {expectedWallet.slice(1).map((wallet) => (
                    <span key={wallet}>
                      <b>{wallet}</b>
                      <br />
                    </span>
                  ))}
                </span>
              ) : null}
            </span>
          ) : walletText === expectedWallet[0] ? (
            "Signature is valid!"
          ) : (
            "Signature is not valid"
          )}
        </h4>
      </Container>
    </Container>
  );
}
