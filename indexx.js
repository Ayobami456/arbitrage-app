import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

import {
  EthereumClient,
  w3mConnectors,
  w3mProvider
} from '@web3modal/ethereum';

import { Web3Modal } from '@web3modal/react';
import { WagmiConfig, configureChains, createConfig } from 'wagmi';
import { mainnet } from 'wagmi/chains';
import { publicProvider } from 'wagmi/providers/public';

// Your Reown project ID
const projectId = 'c6adac7c1737f9e1707693a7812e9632';

// Configure Ethereum chains and providers
const chains = [mainnet];
const { publicClient } = configureChains(chains, [
  w3mProvider({ projectId }),
  publicProvider()
]);

// Create wagmi client
const wagmiConfig = createConfig({
  autoConnect: true,
  connectors: w3mConnectors({ projectId, version: 2, chains }),
  publicClient
});

// Create Web3Modal Ethereum client
const ethereumClient = new EthereumClient(wagmiConfig, chains);

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <WagmiConfig config={wagmiConfig}>
      <App />
      <Web3Modal projectId={projectId} ethereumClient={ethereumClient} />
    </WagmiConfig>
  </React.StrictMode>
);
