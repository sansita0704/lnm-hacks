import { useState } from "react";

export async function connectWallet() {

  if (!window.ethereum) {
    alert("Install MetaMask");
    return;
  }

  const accounts = await window.ethereum.request({
    method: "eth_requestAccounts"
  });

  return accounts[0];
}


export const useWallet = () => {
  const [address, setAddress] = useState<string | null>(null);

  const connect = async () => {
    if (!window.ethereum) {
      alert("Please install MetaMask");
      return;
    }

    try {
      const accounts = (await window.ethereum.request({
        method: "eth_requestAccounts",
      })) as string[];

      if (accounts.length === 0) {
        alert("No accounts found");
        return;
      }

      setAddress(accounts[0]);
    } catch (error) {
      console.error("Wallet connection failed:", error);
    }
  };

  return { address, connect };
};
