import { ethers } from "ethers";
import { InterviewStakeABI } from "../../AI-Interview/contracts/InterviewStakeABI";

export async function rewardUser(userWallet: string) {
  const provider = new ethers.JsonRpcProvider(process.env.MONAD_RPC);
  const adminWallet = new ethers.Wallet(
    process.env.ADMIN_PRIVATE_KEY!,
    provider
  );

  const contract = new ethers.Contract(
    process.env.INTERVIEW_STAKE_ADDRESS!,
    InterviewStakeABI,
    adminWallet
  );
 
  const tx = await contract.reward(userWallet);
  await tx.wait();
}

export async function slashUser(userWallet: string) {
  const provider = new ethers.JsonRpcProvider(process.env.MONAD_RPC);
  const adminWallet = new ethers.Wallet(
    process.env.ADMIN_PRIVATE_KEY!,
    provider
  );

  const contract = new ethers.Contract(
    process.env.INTERVIEW_STAKE_ADDRESS!,
    InterviewStakeABI,
    adminWallet
  );

  const tx = await contract.slash(userWallet);
  await tx.wait();
}
