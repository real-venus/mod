"use client";

import { createContext, useContext, useState, ReactNode } from "react";

interface NetworkContextType {
  chainId: number;
  setChainId: (id: number) => void;
}

const NetworkContext = createContext<NetworkContextType>({
  chainId: 137,
  setChainId: () => {},
});

export function NetworkProvider({ children }: { children: ReactNode }) {
  const [chainId, setChainId] = useState(137); // Default: Polygon

  return (
    <NetworkContext.Provider value={{ chainId, setChainId }}>
      {children}
    </NetworkContext.Provider>
  );
}

export function useNetwork() {
  return useContext(NetworkContext);
}
