import { ethers } from "ethers";
import ABI from "./contracts/InterviewStake.json";

export async function rewardUser(wallet: string) {

  const provider = new ethers.JsonRpcProvider(
    process.env.MONAD_RPC
  );

  const admin = new ethers.Wallet(
    process.env.ADMIN_KEY!,
    provider
  );

  const contract = new ethers.Contract(
    process.env.STAKE_ADDRESS!,
    ABI.abi,
    admin
  );

  await contract.reward(wallet);
}