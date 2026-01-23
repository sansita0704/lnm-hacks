import { ethers } from "ethers";
import stakeABI from "./contracts/InterviewStake.json";

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
