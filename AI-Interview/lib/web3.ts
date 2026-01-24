import { ethers } from "ethers";
import stakeABI from "./contracts/InterviewStake.json";
import tokenABI from "./contracts/InterviewToken.json";

export async function getContract() {

  if (!window.ethereum) return null;

  const provider = new ethers.BrowserProvider(window.ethereum);
  const signer = await provider.getSigner();

  return new ethers.Contract(
    process.env.NEXT_PUBLIC_STAKE_ADDRESS!,
    stakeABI.abi,
    signer
  );
}

export async function getTokenContract() {
  if (!window.ethereum) return null;

  const provider = new ethers.BrowserProvider(window.ethereum);
  const signer = await provider.getSigner();
  
  // Get token address from environment variable (required)
  const tokenAddress = process.env.NEXT_PUBLIC_TOKEN_ADDRESS;
  
  if (!tokenAddress) {
    throw new Error("NEXT_PUBLIC_TOKEN_ADDRESS environment variable is not set. Please configure it in your .env file.");
  }
  
  // Validate address format
  if (!ethers.isAddress(tokenAddress)) {
    throw new Error(`Invalid token address format: ${tokenAddress}. Please check NEXT_PUBLIC_TOKEN_ADDRESS in your .env file.`);
  }
  
  return new ethers.Contract(
    tokenAddress,
    tokenABI.abi,
    signer
  );
}
