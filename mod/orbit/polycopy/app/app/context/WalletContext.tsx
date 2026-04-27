"use client";

import React, { createContext, useContext, useState, useCallback, useEffect } from "react";
import { WalletState, WalletType } from "../lib/types";
import { connectMetaMask, connectPhantom, detectWallets, switchChain } from "../lib/wallet";

interface WalletContextType {
  wallet: WalletState;
  availableWallets: { metamask: boolean; phantom: boolean };
  connect: (type: WalletType) => Promise<void>;
  disconnect: () => void;
  switchNetwork: (chainId: number) => Promise<void>;
}

const WalletContext = createContext<WalletContextType>({
  wallet: { connected: false, address: null, chainId: null, walletType: null, balance: "0" },
  availableWallets: { metamask: false, phantom: false },
  connect: async () => {},
  disconnect: () => {},
  switchNetwork: async () => {},
});

export function WalletProvider({ children }: { children: React.ReactNode }) {
  const [wallet, setWallet] = useState<WalletState>({
    connected: false,
    address: null,
    chainId: null,
    walletType: null,
    balance: "0",
  });
  const [availableWallets, setAvailableWallets] = useState({ metamask: false, phantom: false });

  useEffect(() => {
    setAvailableWallets(detectWallets());

    if (window.ethereum) {
      const handleAccountsChanged = (...args: unknown[]) => {
        const accounts = args[0] as string[];
        if (accounts.length === 0) {
          setWallet((w) => ({ ...w, connected: false, address: null }));
        } else {
          setWallet((w) => ({ ...w, address: accounts[0] }));
        }
      };
      const handleChainChanged = (...args: unknown[]) => {
        const chainId = args[0] as string;
        setWallet((w) => ({ ...w, chainId: parseInt(chainId, 16) }));
      };
      window.ethereum.on("accountsChanged", handleAccountsChanged);
      window.ethereum.on("chainChanged", handleChainChanged);
      return () => {
        window.ethereum?.removeListener("accountsChanged", handleAccountsChanged);
        window.ethereum?.removeListener("chainChanged", handleChainChanged);
      };
    }
  }, []);

  const connect = useCallback(async (type: WalletType) => {
    if (type === "metamask") {
      const { address, chainId } = await connectMetaMask();
      setWallet({ connected: true, address, chainId, walletType: "metamask", balance: "0" });
    } else if (type === "phantom") {
      const { address } = await connectPhantom();
      setWallet({ connected: true, address, chainId: null, walletType: "phantom", balance: "0" });
    }
  }, []);

  const disconnect = useCallback(() => {
    setWallet({ connected: false, address: null, chainId: null, walletType: null, balance: "0" });
  }, []);

  const switchNetwork = useCallback(async (chainId: number) => {
    await switchChain(chainId);
  }, []);

  return (
    <WalletContext.Provider value={{ wallet, availableWallets, connect, disconnect, switchNetwork }}>
      {children}
    </WalletContext.Provider>
  );
}

export function useWallet() {
  return useContext(WalletContext);
}
