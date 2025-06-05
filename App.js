import React, { useEffect, useState } from 'react';
import * as LitJsSdk from '@lit-protocol/lit-node-client';
import { LIT_NETWORK } from '@lit-protocol/constants';
import { ethers } from 'ethers';
import Web3Modal from 'web3modal';

const GATED_TOKEN_CONTRACT = "0x8a90cab2b38dba80c64b7734e58ee1db38b8992e"; // Example: Doodles NFT contract on Ethereum mainnet
const CHAIN_ID = 1; // Ethereum mainnet

const App = () => {
  const [client, setClient] = useState(null);
  const [provider, setProvider] = useState(null);
  const [address, setAddress] = useState("");
  const [encryptedContent, setEncryptedContent] = useState(null);
  const [decryptedContent, setDecryptedContent] = useState("");
  const [accessGranted, setAccessGranted] = useState(false);
  const [loading, setLoading] = useState(false);

  // Initialize Lit client
  useEffect(() => {
    const initLit = async () => {
      const litClient = new LitJsSdk.LitNodeClient({ litNetwork: LIT_NETWORK.DatilDev });
      await litClient.connect();
      setClient(litClient);
    };
    initLit();
  }, []);

  // Connect wallet with web3modal
  const connectWallet = async () => {
    try {
      const web3Modal = new Web3Modal({
        cacheProvider: true,
      });
      const instance = await web3Modal.connect();
      const web3Provider = new ethers.BrowserProvider(instance);
      const signer = await web3Provider.getSigner();
      const userAddress = await signer.getAddress();
      setProvider(web3Provider);
      setAddress(userAddress);
      setAccessGranted(false);
      setDecryptedContent("");
      setEncryptedContent(null);
    } catch (e) {
      console.error("Wallet connection failed", e);
    }
  };

  // Example: encrypted content (normally you'd fetch encrypted content)
  const exampleEncryptedString = `
  -----BEGIN LIT ENCRYPTED FILE-----
  version: 2.0
  type: string
  encryptedString: <encrypted-data-here>
  accessControlConditions:
  - contractAddress: ${GATED_TOKEN_CONTRACT}
    standardContractType: ERC721
    chain: ethereum
    method: balanceOf
    parameters:
    - ':userAddress'
    returnValueTest:
      comparator: '>'
      value: '0'
  encryptedSymmetricKey: <encrypted-key-here>
  -----END LIT ENCRYPTED FILE-----
  `;

  // Decrypt content using Lit and wallet signature
  const decryptContent = async () => {
    if (!client || !provider || !address) return;
    setLoading(true);

    try {
      // Access control conditions for gating: user must own at least 1 NFT from contract
      const accessControlConditions = [
        {
          contractAddress: GATED_TOKEN_CONTRACT,
          standardContractType: "ERC721",
          chain: "ethereum",
          method: "balanceOf",
          parameters: [":userAddress"],
          returnValueTest: {
            comparator: ">",
            value: "0",
          },
        },
      ];

      // The encrypted string would be your actual encrypted blog post string,
      // here we simulate by encrypting a simple message on the fly.
      // For demo, encrypt a sample string now and decrypt immediately.

      const authSig = await LitJsSdk.checkAndSignAuthMessage({ chain: "ethereum" });

      // Encrypt a sample string (normally done ahead of time)
      const sampleContent = "This is the secret gated blog post content that only token holders can see!";
      const encryptedString = await LitJsSdk.encryptString(sampleContent);
      const encryptedBase64 = await LitJsSdk.blobToBase64String(encryptedString);

      // Save the encrypted content to state (simulating loading from backend)
      setEncryptedContent(encryptedBase64);

      // Now decrypt
      const encryptedBlob = await LitJsSdk.base64StringToBlob(encryptedBase64);

      // Get symmetric key from Lit network
      const symmetricKey = await client.getEncryptionKey({
        accessControlConditions,
        toDecrypt: encryptedBase64,
        chain: "ethereum",
        authSig,
      });

      // Decrypt the content with symmetric key
      const decrypted = await LitJsSdk.decryptString(encryptedBlob, symmetricKey);

      setDecryptedContent(decrypted);
      setAccessGranted(true);
    } catch (e) {
      console.error("Decryption failed", e);
      alert("Access denied or error decrypting content.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: 600, margin: "auto", padding: 20, fontFamily: "Arial, sans-serif" }}>
      <h1>Lit Token-Gated Blog Demo</h1>
      {!address ? (
        <button onClick={connectWallet}>Connect Wallet</button>
      ) : (
        <>
          <p>Connected wallet: {address}</p>
          <button onClick={decryptContent} disabled={loading}>
            {loading ? "Checking Access..." : "View Gated Post"}
          </button>
        </>
      )}

      {accessGranted && (
        <div style={{ marginTop: 20, padding: 15, border: "1px solid #ccc", borderRadius: 6 }}>
          <h2>Gated Blog Post</h2>
          <p>{decryptedContent}</p>
        </div>
      )}
    </div>
  );
};

export default App;