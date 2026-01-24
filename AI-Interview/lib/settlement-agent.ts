import { ethers } from "ethers";
import { getContract } from "./web3";
import {
  SettlementInput,
  SettlementResult,
  SettlementState,
  SettlementProgress,
} from "@/types/settlement";

/**
 * Autonomous Settlement Agent
 * Resolves token escrow after interview evaluation
 * 
 * Rules:
 * - PASS (score >= 65) → Refund tokens to candidate
 * - FAIL (score < 65) → Slash tokens to admin
 * - No partial refunds
 * - Settlement is irreversible
 */
export class SettlementAgent {
  private onProgressUpdate?: (progress: SettlementProgress) => void;

  constructor(onProgressUpdate?: (progress: SettlementProgress) => void) {
    this.onProgressUpdate = onProgressUpdate;
  }

  /**
   * CASE 1: Candidate PASSES
   * Refund staked tokens to candidate wallet
   */
  async settlePass(input: SettlementInput): Promise<SettlementResult> {
    try {
      this.updateProgress(
        SettlementState.PREPARING,
        "Preparing reward settlement..."
      );

      if (input.status !== "pass") {
        throw new Error("Invalid settlement: status must be 'pass'");
      }

      // Get contract instance
      const escrowContract = await getContract();
      if (!escrowContract) {
        throw new Error("Failed to connect to escrow contract");
      }

      this.updateProgress(
        SettlementState.EXECUTING,
        "Executing reward transaction..."
      );

      // Call reward function (refund to candidate)
      // Tokens go: Escrow → Candidate wallet
      const rewardTx = await escrowContract.reward(input.walletAddress, {
        gasLimit: 500000,
      });

      this.updateProgress(
        SettlementState.VERIFYING,
        "Verifying settlement on-chain...",
        rewardTx.hash
      );

      // Wait for on-chain confirmation
      const receipt = await rewardTx.wait();

      // Verify settlement
      const verified = await this.verifySettlement(
        rewardTx.hash,
        input.walletAddress,
        "refund"
      );

      if (!verified) {
        throw new Error("Settlement verification failed");
      }

      this.updateProgress(
        SettlementState.COMPLETE,
        "Tokens successfully refunded!",
        rewardTx.hash
      );

      const result: SettlementResult = {
        success: true,
        transactionHash: rewardTx.hash,
        tokensStatus: "refunded",
        interviewStatus: "pass",
        timestamp: new Date().toISOString(),
      };

      // Notify backend
      await this.notifyBackend(result, input);

      return result;
    } catch (error: any) {
      console.error("Settlement (PASS) error:", error);
      this.updateProgress(SettlementState.FAILED, error.message || "Settlement failed");

      return {
        success: false,
        tokensStatus: "refunded",
        interviewStatus: "pass",
        error: error.message || "Settlement failed",
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * CASE 2: Candidate FAILS
   * Slash staked tokens to admin wallet
   */
  async settleFail(input: SettlementInput): Promise<SettlementResult> {
    try {
      this.updateProgress(
        SettlementState.PREPARING,
        "Preparing penalty settlement..."
      );

      if (input.status !== "fail") {
        throw new Error("Invalid settlement: status must be 'fail'");
      }

      // Get contract instance
      const escrowContract = await getContract();
      if (!escrowContract) {
        throw new Error("Failed to connect to escrow contract");
      }

      this.updateProgress(
        SettlementState.EXECUTING,
        "Executing slash transaction..."
      );

      // Call slash function (forfeit to admin)
      // Tokens go: Escrow → Admin wallet
      const slashTx = await escrowContract.slash(input.walletAddress, {
        gasLimit: 500000,
      });

      this.updateProgress(
        SettlementState.VERIFYING,
        "Verifying settlement on-chain...",
        slashTx.hash
      );

      // Wait for on-chain confirmation
      const receipt = await slashTx.wait();

      // Verify settlement
      const verified = await this.verifySettlement(
        slashTx.hash,
        input.adminWalletAddress,
        "slash"
      );

      if (!verified) {
        throw new Error("Settlement verification failed");
      }

      this.updateProgress(
        SettlementState.COMPLETE,
        "Tokens successfully penalized!",
        slashTx.hash
      );

      const result: SettlementResult = {
        success: true,
        transactionHash: slashTx.hash,
        tokensStatus: "penalized",
        interviewStatus: "fail",
        timestamp: new Date().toISOString(),
      };

      // Notify backend
      await this.notifyBackend(result, input);

      return result;
    } catch (error: any) {
      console.error("Settlement (FAIL) error:", error);
      this.updateProgress(SettlementState.FAILED, error.message || "Settlement failed");

      return {
        success: false,
        tokensStatus: "penalized",
        interviewStatus: "fail",
        error: error.message || "Settlement failed",
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * Autonomous settlement based on verdict
   * Routes to settlePass or settleFail
   */
  async settle(input: SettlementInput): Promise<SettlementResult> {
    console.log("💰 Starting autonomous settlement:", {
      status: input.status,
      score: input.finalScore,
      wallet: input.walletAddress,
    });

    // Route based on verdict
    if (input.status === "pass") {
      return this.settlePass(input);
    } else if (input.status === "fail") {
      return this.settleFail(input);
    } else {
      throw new Error(`Invalid status: ${input.status}`);
    }
  }

  /**
   * Verify settlement on-chain
   */
  private async verifySettlement(
    transactionHash: string,
    recipientAddress: string,
    type: "refund" | "slash"
  ): Promise<boolean> {
    try {
      if (!window.ethereum) return false;

      const provider = new ethers.BrowserProvider(window.ethereum);
      const receipt = await provider.getTransactionReceipt(transactionHash);

      if (!receipt || receipt.status !== 1) {
        return false;
      }

      console.log("✅ Settlement verified:", {
        type,
        transactionHash,
        blockNumber: receipt.blockNumber,
        recipient: recipientAddress,
      });

      return true;
    } catch (error) {
      console.error("Settlement verification error:", error);
      return false;
    }
  }

  /**
   * Notify backend of settlement completion
   */
  private async notifyBackend(
    result: SettlementResult,
    input: SettlementInput
  ): Promise<boolean> {
    try {
      console.log("📡 Notifying backend of settlement:", {
        userId: input.userId,
        interviewId: input.interviewId,
        tokensStatus: result.tokensStatus,
        interviewStatus: result.interviewStatus,
        transactionHash: result.transactionHash,
      });

      // In production, call backend API
      /*
      const response = await fetch('/api/interview/settlement', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: input.userId,
          interviewId: input.interviewId,
          settlement: result,
        })
      });

      return response.ok;
      */

      // Simulate success
      await new Promise(resolve => setTimeout(resolve, 500));
      return true;
    } catch (error) {
      console.error("Backend notification error:", error);
      return false;
    }
  }

  private updateProgress(
    state: SettlementState,
    message: string,
    transactionHash?: string
  ) {
    if (this.onProgressUpdate) {
      this.onProgressUpdate({ state, message, transactionHash });
    }
  }
}

/**
 * Helper function to create settlement agent
 */
export function createSettlementAgent(
  onProgressUpdate?: (progress: SettlementProgress) => void
): SettlementAgent {
  return new SettlementAgent(onProgressUpdate);
}
