import React, { useEffect, useState } from 'react';
import * as LitJsSdk from '@lit-protocol/lit-node-client';
import { LIT_NETWORK } from '@lit-protocol/constants';
import { ethers } from 'ethers';

import { Web3Modal, useWeb3Modal } from '@web3modal/react';
import { EthereumClient, w3mConnectors, w3mProvider } from '@web3modal/ethereum';
import { configureChains, createClient, WagmiConfig } from 'wagmi';
import { mainnet } from 'wagmi/chains';

const projectId = "c6adac7c1737f9e1707693a7812e9632";

const chains = [mainnet];
const { provider } = configureChains(chains, [w3mProvider({ projectId })]);

const wagmiClient = createClient({
  autoConnect: true,
  connectors: w3mConnectors({ projectId, chains }),
  provider,
});

const ethereumClient = new EthereumClient(wagmiClient, chains);

const GATED_TOKEN_CONTRACT = "0x8a90cab2b38dba80c64b7734e58ee1db38b8992e"; // Example NFT contract

const App = () => {
  const { open } = useWeb3Modal();

  const [client, setClient] = useState(null);
  const [provider, setProvider] = useState(null);
  const [address, setAddress] = useState("");
  const [decryptedContent, setDecryptedContent] = useState("");
  const [accessGranted, setAccessGranted] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const initLit = async () => {
      const litClient = new LitJsSdk.LitNodeClient({ litNetwork: LIT_NETWORK.DatilDev });
      await litClient.connect();
      setClient(litClient);
    };
    initLit();
  }, []);

  useEffect(() => {
    const setupProvider = async () => {
      if (window.ethereum) {
        const ethProvider = new ethers.BrowserProvider(window.ethereum);
        const signer = await ethProvider.getSigner();
        const userAddress = await signer.getAddress();
        setProvider(ethProvider);
        setAddress(userAddress);
        setAccessGranted(false);
        setDecryptedContent("");
      }
    };
    setupProvider();
  }, []);

  const decryptContent = async () => {
    if (!client || !provider || !address) return;
    setLoading(true);

    try {
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

      const authSig = await LitJsSdk.checkAndSignAuthMessage({ chain: "ethereum" });

      const sampleContent = "This is the secret gated blog post content that only token holders can see!";
      const encryptedString = await LitJsSdk.encryptString(sampleContent);
      const encryptedBase64 = await LitJsSdk.blobToBase64String(encryptedString);
      const encryptedBlob = await LitJsSdk.base64StringToBlob(encryptedBase64);

      const symmetricKey = await client.getEncryptionKey({
        accessControlConditions,
        toDecrypt: encryptedBase64,
        chain: "ethereum",
        authSig,
      });

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
    <WagmiConfig client={wagmiClient}>
      <div style={{ maxWidth: 600, margin: "auto", padding: 20, fontFamily: "Arial, sans-serif" }}>
        <h1>Lit Token-Gated Blog Demo</h1>

        {!address ? (
          <button onClick={open}>Connect Wallet</button>
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

        {/* Web3Modal Portal */}
        <Web3Modal projectId={projectId} ethereumClient={ethereumClient} />
      </div>
    </WagmiConfig>
  );
};

export default App;
