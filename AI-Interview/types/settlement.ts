// Settlement Input Types
export interface SettlementInput {
  walletAddress: string; // Candidate wallet
  finalScore: number; // 0-100
  status: "pass" | "fail"; // Verdict
  escrowContractAddress: string;
  stakedAmount: string; // In ether
  adminWalletAddress: string;
  interviewId: string;
  userId: string;
}

// Settlement Result Types
export interface SettlementResult {
  success: boolean;
  transactionHash?: string;
  tokensStatus: "refunded" | "penalized";
  interviewStatus: "pass" | "fail";
  error?: string;
  timestamp: string;
}

// Settlement State
export enum SettlementState {
  IDLE = "IDLE",
  PREPARING = "PREPARING",
  EXECUTING = "EXECUTING",
  VERIFYING = "VERIFYING",
  COMPLETE = "COMPLETE",
  FAILED = "FAILED",
}

export interface SettlementProgress {
  state: SettlementState;
  message: string;
  transactionHash?: string;
}
