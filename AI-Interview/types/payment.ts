export enum PaymentState {
  IDLE = "IDLE",
  PAYMENT_REQUIRED = "PAYMENT_REQUIRED",
  APPROVING = "APPROVING",
  PROCESSING = "PROCESSING",
  VERIFYING = "VERIFYING",
  COMPLETE = "COMPLETE",
  REJECTED = "REJECTED",
  FAILED = "FAILED",
}

export interface X402Response {
  statusCode: 402;
  message: string;
  paymentRequired: {
    amount: string; // Amount in tokens (e.g., "2")
    token: string; // Token contract address
    destination: string; // Staking contract address
    network: {
      chainId: number;
      name: string;
    };
    purpose: string; // e.g., "Stake tokens to unlock AI interview"
  };
}

export interface PaymentRequirement {
  amount: string;
  tokenAddress: string;
  destinationAddress: string;
  chainId: number;
  purpose: string;
}

export interface PaymentResult {
  success: boolean;
  transactionHash?: string;
  error?: string;
  state: PaymentState;
}

export interface PaymentProgress {
  state: PaymentState;
  message: string;
  transactionHash?: string;
}
