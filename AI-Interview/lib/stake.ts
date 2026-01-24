import { ethers } from "ethers";
import { InterviewStakeABI } from "@/contracts/InterviewStakeABI";
import { InterviewTokenABI } from "@/contracts/InterviewTokenABI";
import {
  INTERVIEW_STAKE_ADDRESS,
  INTERVIEW_TOKEN_ADDRESS,
} from "@/constants/contracts";

export async function stakeTokens() {
  if (!window.ethereum) throw new Error("MetaMask not found");

  const provider = new ethers.BrowserProvider(window.ethereum);
  const signer = await provider.getSigner();

  const token = new ethers.Contract(
    INTERVIEW_TOKEN_ADDRESS,
    InterviewTokenABI,
    signer
  );

  const stakeContract = new ethers.Contract(
    INTERVIEW_STAKE_ADDRESS,
    InterviewStakeABI,
    signer
  );

  // 1️⃣ Approve token
  const approveTx = await token.approve(
    INTERVIEW_STAKE_ADDRESS,
    ethers.parseEther("0.5")
  );
  await approveTx.wait();

  // 2️⃣ Stake
  const stakeTx = await stakeContract.stake();
  await stakeTx.wait();
}
