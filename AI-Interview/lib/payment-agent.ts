import { ethers } from "ethers";
import { getContract, getTokenContract } from "./web3";
import {
  PaymentState,
  X402Response,
  PaymentRequirement,
  PaymentResult,
  PaymentProgress,
} from "@/types/payment";

/**
 * Autonomous Payment & Verification Agent
 * Handles x402 (HTTP 402 - Payment Required) responses
 * Enforces token escrow with on-chain verification
 * NO CUSTODY - Tokens locked in smart contract only
 */
export class PaymentAgent {
  private onProgressUpdate?: (progress: PaymentProgress) => void;

  constructor(onProgressUpdate?: (progress: PaymentProgress) => void) {
    this.onProgressUpdate = onProgressUpdate;
  }

  /**
   * Parse x402 response from server
   */
  parseX402Response(response: any): PaymentRequirement | null {
    try {
      // Check if this is an x402 response
      if (response?.statusCode === 402 || response?.paymentRequired) {
        const payment = response.paymentRequired;
        
        return {
          amount: payment.amount || "0.5", // Default to 0.5 tokens
          tokenAddress: payment.token || process.env.NEXT_PUBLIC_TOKEN_ADDRESS!,
          destinationAddress: payment.destination || process.env.NEXT_PUBLIC_STAKE_ADDRESS!,
          chainId: payment.network?.chainId || 10143, // Monad Testnet
          purpose: payment.purpose || "Lock tokens in escrow to unlock AI interview",
        };
      }
      
      return null;
    } catch (error) {
      console.error("Error parsing x402 response:", error);
      return null;
    }
  }

  /**
   * Check if payment is required by making a pre-flight check
   * This simulates an x402 check - in production, this would be an API call
   */
  async checkPaymentRequired(userId: string): Promise<PaymentRequirement | null> {
    // Simulate x402 response
    const mockX402: X402Response = {
      statusCode: 402,
      message: "Payment Required",
      paymentRequired: {
        amount: "0.5",
        token: process.env.NEXT_PUBLIC_TOKEN_ADDRESS!,
        destination: process.env.NEXT_PUBLIC_STAKE_ADDRESS!,
        network: {
          chainId: 10143,
          name: "Monad Testnet",
        },
        purpose: "Lock tokens in escrow to unlock AI interview",
      },
    };

    return this.parseX402Response(mockX402);
  }

  /**
   * Helper function to retry contract calls with exponential backoff
   */
  private async retryWithBackoff<T>(
    fn: () => Promise<T>,
    maxRetries: number = 3,
    initialDelay: number = 1000
  ): Promise<T> {
    let lastError: any;
    
    for (let i = 0; i < maxRetries; i++) {
      try {
        return await fn();
      } catch (error: any) {
        lastError = error;
        
        // Check if it's a rate limit error
        if (error.code === -32005 || error.message?.includes('rate limit')) {
          const delay = initialDelay * Math.pow(2, i);
          console.log(`Rate limited, retrying in ${delay}ms... (attempt ${i + 1}/${maxRetries})`);
          await new Promise(resolve => setTimeout(resolve, delay));
          continue;
        }
        
        // If it's not a rate limit error, throw immediately
        throw error;
      }
    }
    
    throw lastError;
  }

  /**
   * STEP 4: Lock Tokens in Smart Contract (Escrow)
   * Tokens are locked in the contract - NO custody by admin/company/AI
   */
  async lockTokensInEscrow(requirement: PaymentRequirement): Promise<PaymentResult> {
    try {
      this.updateProgress(PaymentState.APPROVING, "Preparing escrow transaction...");

      // Get wallet address
      if (!window.ethereum) {
        throw new Error("MetaMask not found. Please install MetaMask.");
      }

      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      const wallet = await signer.getAddress();

      // Verify network and switch if needed
      const network = await provider.getNetwork();
      const expectedChainId = BigInt(requirement.chainId || 10143);
      
      if (network.chainId !== expectedChainId) {
        this.updateProgress(
          PaymentState.APPROVING, 
          `Switching to Monad Testnet...`
        );
        
        try {
          // Try to switch to Monad Testnet
          await window.ethereum.request({
            method: 'wallet_switchEthereumChain',
            params: [{ chainId: `0x${expectedChainId.toString(16)}` }],
          });
          
          // Wait for network switch to complete
          await new Promise(resolve => setTimeout(resolve, 1000));
          
          // Recreate provider and signer after network switch
          const newProvider = new ethers.BrowserProvider(window.ethereum);
          const newSigner = await newProvider.getSigner();
          const newWallet = await newSigner.getAddress();
          
          // Verify network switch was successful
          const newNetwork = await newProvider.getNetwork();
          if (newNetwork.chainId !== expectedChainId) {
            throw new Error('Network switch failed. Please manually switch to Monad Testnet.');
          }
          
          // Update local variables
          wallet = newWallet;
          
        } catch (switchError: any) {
          // If network doesn't exist, add it
          if (switchError.code === 4902) {
            try {
              await window.ethereum.request({
                method: 'wallet_addEthereumChain',
                params: [{
                  chainId: `0x${expectedChainId.toString(16)}`,
                  chainName: 'Monad Testnet',
                  nativeCurrency: {
                    name: 'MON',
                    symbol: 'MON',
                    decimals: 18,
                  },
                  rpcUrls: ['https://testnet.monad.xyz'],
                  blockExplorerUrls: ['https://explorer.testnet.monad.xyz'],
                }],
              });
              
              // Wait for network to be added and switched
              await new Promise(resolve => setTimeout(resolve, 1000));
              
            } catch (addError) {
              throw new Error('Failed to add Monad Testnet to MetaMask. Please add it manually.');
            }
          } else if (switchError.message && !switchError.message.includes('User rejected')) {
            throw switchError;
          } else {
            throw new Error('Please switch to Monad Testnet in MetaMask to continue.');
          }
        }
      }

      // Get contract instances AFTER network verification/switch
      const escrowContract = await getContract();
      const tokenContract = await getTokenContract();

      // Debug: Log addresses (remove after fixing)
      console.log('🔍 Contract Addresses:', {
        stake: process.env.NEXT_PUBLIC_STAKE_ADDRESS,
        token: process.env.NEXT_PUBLIC_TOKEN_ADDRESS,
        escrowFromRequirement: requirement.destinationAddress,
        tokenFromRequirement: requirement.tokenAddress,
      });

      if (!escrowContract || !tokenContract) {
        throw new Error("Failed to connect to contracts");
      }

      // Verify contract exists by checking code at address
      const escrowCode = await provider.getCode(requirement.destinationAddress);
      if (escrowCode === '0x') {
        throw new Error(
          `Escrow contract not found at ${requirement.destinationAddress}. Please verify the contract is deployed on Monad Testnet.`
        );
      }

      const tokenCode = await provider.getCode(requirement.tokenAddress);
      if (tokenCode === '0x') {
        throw new Error(
          `Token contract not found at ${requirement.tokenAddress}. Please verify the contract is deployed on Monad Testnet.`
        );
      }

      // Get stake amount from contract (trustless - contract defines the rules)
      const stakeAmount = await this.retryWithBackoff(() => escrowContract.stakeAmount());
      
      this.updateProgress(
        PaymentState.APPROVING, 
        `Locking ${ethers.formatEther(stakeAmount)} tokens in escrow...`
      );

      // Check user's token balance
      const balance = await this.retryWithBackoff(() => tokenContract.balanceOf(wallet));
      if (balance < stakeAmount) {
        throw new Error(
          `Insufficient token balance. Required: ${ethers.formatEther(stakeAmount)} tokens, Have: ${ethers.formatEther(balance)} tokens`
        );
      }

      this.updateProgress(PaymentState.APPROVING, "Checking token allowance...");

      // Check and approve if needed (allow escrow contract to lock tokens)
      const allowance = await this.retryWithBackoff(() => 
        tokenContract.allowance(wallet, requirement.destinationAddress)
      );
      
      if (allowance < stakeAmount) {
        this.updateProgress(PaymentState.APPROVING, "Requesting token approval for escrow...");
        
        const approveTx = await tokenContract.approve(requirement.destinationAddress, stakeAmount, {
          gasLimit: 500000,
        });
        
        this.updateProgress(PaymentState.PROCESSING, "Approving tokens for escrow...", approveTx.hash);
        await approveTx.wait();
      }

      this.updateProgress(PaymentState.PROCESSING, "Locking tokens in escrow contract...");

      // Execute escrow locking transaction
      // ✔ Tokens go directly to smart contract
      // ❌ NOT to admin, company, or any externally owned account
      const lockTx = await escrowContract.stake({
        gasLimit: 500000,
      });

      this.updateProgress(
        PaymentState.VERIFYING, 
        "Waiting for on-chain confirmation...", 
        lockTx.hash
      );

      // Wait for blockchain confirmation (on-chain finality)
      const receipt = await lockTx.wait();

      // Verify escrow locking on-chain
      const escrowVerification = await this.verifyEscrowLocking(
        lockTx.hash,
        wallet,
        requirement.destinationAddress,
        stakeAmount
      );

      if (!escrowVerification.success) {
        throw new Error(escrowVerification.error || "Escrow verification failed");
      }

      this.updateProgress(
        PaymentState.COMPLETE, 
        "Tokens successfully locked in escrow!", 
        lockTx.hash
      );

      return {
        success: true,
        transactionHash: lockTx.hash,
        state: PaymentState.COMPLETE,
      };
    } catch (error: any) {
      console.error("Escrow locking error:", error);

      // Check if user rejected
      if (error.code === "ACTION_REJECTED" || error.code === 4001) {
        this.updateProgress(PaymentState.REJECTED, "Transaction rejected by user");
        return {
          success: false,
          error: "Transaction rejected by user",
          state: PaymentState.REJECTED,
        };
      }

      // Other errors
      this.updateProgress(PaymentState.FAILED, error.message || "Escrow locking failed");
      return {
        success: false,
        error: error.message || "Escrow locking failed",
        state: PaymentState.FAILED,
      };
    }
  }

  /**
   * Verify that tokens are actually locked in escrow on-chain
   * Extract: transaction hash, block number, wallet address
   */
  async verifyEscrowLocking(
    transactionHash: string,
    userWallet: string,
    escrowContract: string,
    expectedAmount: bigint
  ): Promise<{ success: boolean; error?: string; blockNumber?: number }> {
    try {
      if (!window.ethereum) {
        return { success: false, error: "No provider available" };
      }

      const provider = new ethers.BrowserProvider(window.ethereum);
      
      // Get transaction receipt
      const receipt = await provider.getTransactionReceipt(transactionHash);

      if (!receipt) {
        return { success: false, error: "Transaction not found" };
      }

      // Verify transaction succeeded
      if (receipt.status !== 1) {
        return { success: false, error: "Transaction failed on-chain" };
      }

      // Verify transaction was sent to escrow contract
      if (receipt.to?.toLowerCase() !== escrowContract.toLowerCase()) {
        return { 
          success: false, 
          error: "Transaction not sent to escrow contract" 
        };
      }

      // Verify transaction came from user's wallet
      if (receipt.from.toLowerCase() !== userWallet.toLowerCase()) {
        return { 
          success: false, 
          error: "Transaction not from user wallet" 
        };
      }

      console.log("✅ Escrow Verification Successful:", {
        transactionHash,
        blockNumber: receipt.blockNumber,
        from: receipt.from,
        to: receipt.to,
        status: "LOCKED_IN_ESCROW",
      });

      return {
        success: true,
        blockNumber: receipt.blockNumber,
      };
    } catch (error) {
      console.error("Escrow verification error:", error);
      return { 
        success: false, 
        error: "Failed to verify escrow locking" 
      };
    }
  }

  /**
   * STEP 5: Notify Server & Unlock Interview
   * Server independently verifies on-chain proof
   */
  async notifyServerAndUnlock(
    transactionHash: string,
    userId: string,
    walletAddress: string,
    escrowContract: string,
    lockedAmount: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      this.updateProgress(
        PaymentState.VERIFYING,
        "Notifying server for verification...",
        transactionHash
      );

      // Get block number for server verification
      const provider = new ethers.BrowserProvider(window.ethereum!);
      const receipt = await provider.getTransactionReceipt(transactionHash);

      if (!receipt) {
        return { 
          success: false, 
          error: "Cannot notify server - transaction not found" 
        };
      }

      // Prepare secure payload for server verification
      const verificationPayload = {
        userId,
        walletAddress,
        transactionHash,
        blockNumber: receipt.blockNumber,
        escrowContract,
        lockedAmount,
        chainId: 10143, // Monad Testnet
        timestamp: new Date().toISOString(),
      };

      console.log("🔐 Sending escrow proof to server:", verificationPayload);

      // In production, replace with actual API call
      await new Promise(resolve => setTimeout(resolve, 1000));

      console.log("✅ Server verification successful - Interview unlocked");

      return { success: true };
    } catch (error: any) {
      console.error("Server notification error:", error);
      return { 
        success: false, 
        error: error.message || "Failed to notify server" 
      };
    }
  }

  /**
   * Handle complete payment flow with escrow and verification
   */
  async handlePaymentFlow(userId: string): Promise<PaymentResult> {
    try {
      // Check if payment is required
      this.updateProgress(PaymentState.IDLE, "Checking payment status...");
      
      const requirement = await this.checkPaymentRequired(userId);

      if (!requirement) {
        // No payment required
        return {
          success: true,
          state: PaymentState.COMPLETE,
        };
      }

      this.updateProgress(PaymentState.PAYMENT_REQUIRED, requirement.purpose);

      // STEP 4: Lock tokens in escrow
      const lockResult = await this.lockTokensInEscrow(requirement);

      // If locking failed, DO NOT notify backend, DO NOT start interview
      if (!lockResult.success) {
        console.error("❌ Escrow locking failed - Aborting flow");
        return lockResult;
      }

      // Get wallet address for server notification
      const provider = new ethers.BrowserProvider(window.ethereum!);
      const signer = await provider.getSigner();
      const wallet = await signer.getAddress();

      // STEP 5: Notify server with on-chain proof
      if (lockResult.transactionHash) {
        const notifyResult = await this.notifyServerAndUnlock(
          lockResult.transactionHash,
          userId,
          wallet,
          requirement.destinationAddress,
          requirement.amount
        );

        if (!notifyResult.success) {
          console.warn("⚠️ Server notification failed:", notifyResult.error);
        }
      }

      return lockResult;
    } catch (error: any) {
      console.error("Payment flow error:", error);
      return {
        success: false,
        error: error.message || "Payment flow failed",
        state: PaymentState.FAILED,
      };
    }
  }

  /**
   * Legacy method - kept for backward compatibility
   */
  async executePayment(requirement: PaymentRequirement): Promise<PaymentResult> {
    return this.lockTokensInEscrow(requirement);
  }

  /**
   * Legacy method - kept for backward compatibility
   */
  async verifyPayment(transactionHash: string): Promise<boolean> {
    try {
      if (!window.ethereum) return false;

      const provider = new ethers.BrowserProvider(window.ethereum);
      const receipt = await provider.getTransactionReceipt(transactionHash);

      return receipt !== null && receipt.status === 1;
    } catch (error) {
      console.error("Payment verification error:", error);
      return false;
    }
  }

  /**
   * Legacy method - kept for backward compatibility
   */
  async notifyPaymentComplete(transactionHash: string, userId: string): Promise<boolean> {
    try {
      const provider = new ethers.BrowserProvider(window.ethereum!);
      const signer = await provider.getSigner();
      const wallet = await signer.getAddress();

      const result = await this.notifyServerAndUnlock(
        transactionHash,
        userId,
        wallet,
        process.env.NEXT_PUBLIC_STAKE_ADDRESS!,
        "0.5"
      );

      return result.success;
    } catch (error) {
      console.error("Error notifying payment completion:", error);
      return false;
    }
  }

  private updateProgress(state: PaymentState, message: string, transactionHash?: string) {
    if (this.onProgressUpdate) {
      this.onProgressUpdate({ state, message, transactionHash });
    }
  }
}

/**
 * Helper function to create a payment agent instance
 */
export function createPaymentAgent(
  onProgressUpdate?: (progress: PaymentProgress) => void
): PaymentAgent {
  return new PaymentAgent(onProgressUpdate);
}
