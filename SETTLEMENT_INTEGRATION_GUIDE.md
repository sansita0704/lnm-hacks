# Settlement Agent Integration Guide

## 🎯 Quick Start

The Settlement Agent is **already implemented**. This guide shows you how to integrate it into your interview flow.

---

## 📋 Prerequisites

1. ✅ Smart contracts deployed on Monad Testnet
2. ✅ Environment variables configured in `.env.local`
3. ✅ User has staked 0.5 MONS tokens
4. ✅ Interview evaluation completed with final score

---

## 🔌 Integration Steps

### Step 1: Import Settlement Agent

```typescript
import { createSettlementAgent, SettlementAgent } from "@/lib/settlement-agent";
import { SettlementInput, SettlementState } from "@/types/settlement";
```

### Step 2: Create Agent Instance

```typescript
// With progress tracking (recommended)
const settlementAgent = createSettlementAgent((progress) => {
  console.log(`[${progress.state}] ${progress.message}`);
  if (progress.transactionHash) {
    console.log(`TX: ${progress.transactionHash}`);
  }
});

// Without progress tracking
const settlementAgent = new SettlementAgent();
```

### Step 3: Prepare Settlement Input

```typescript
const settlementInput: SettlementInput = {
  walletAddress: candidateWallet,           // From user session
  finalScore: evaluationResult.totalScore,  // From evaluation agent
  status: evaluationResult.status,          // "pass" or "fail"
  escrowContractAddress: process.env.NEXT_PUBLIC_STAKE_ADDRESS!,
  stakedAmount: "0.5",                      // Fixed amount
  adminWalletAddress: process.env.NEXT_PUBLIC_ADMIN_WALLET!,
  interviewId: interview.id,
  userId: user.id,
};
```

### Step 4: Execute Settlement

```typescript
try {
  // Autonomous settlement based on verdict
  const result = await settlementAgent.settle(settlementInput);

  if (result.success) {
    console.log("✅ Settlement successful!");
    console.log(`Status: ${result.tokensStatus}`);
    console.log(`TX Hash: ${result.transactionHash}`);
    
    // Update UI, redirect to feedback page, etc.
  } else {
    console.error("❌ Settlement failed:", result.error);
    // Handle error, show retry option
  }
} catch (error) {
  console.error("Settlement error:", error);
}
```

---

## 🎨 UI Integration Example

### React Component with Progress Tracking

```typescript
"use client";

import { useState } from "react";
import { createSettlementAgent } from "@/lib/settlement-agent";
import { SettlementState, SettlementProgress } from "@/types/settlement";

export function SettlementFlow({ evaluation, interview, user }) {
  const [progress, setProgress] = useState<SettlementProgress | null>(null);
  const [isSettling, setIsSettling] = useState(false);

  const handleSettlement = async () => {
    setIsSettling(true);

    // Create agent with progress callback
    const agent = createSettlementAgent((progress) => {
      setProgress(progress);
    });

    try {
      const result = await agent.settle({
        walletAddress: user.walletAddress,
        finalScore: evaluation.totalScore,
        status: evaluation.status,
        escrowContractAddress: process.env.NEXT_PUBLIC_STAKE_ADDRESS!,
        stakedAmount: "0.5",
        adminWalletAddress: process.env.NEXT_PUBLIC_ADMIN_WALLET!,
        interviewId: interview.id,
        userId: user.id,
      });

      if (result.success) {
        // Redirect to feedback page
        window.location.href = `/interview/${interview.id}/feedback`;
      }
    } catch (error) {
      console.error("Settlement error:", error);
    } finally {
      setIsSettling(false);
    }
  };

  return (
    <div className="settlement-container">
      <h2>Settlement in Progress</h2>
      
      {progress && (
        <div className="progress-display">
          <p className="state">{progress.state}</p>
          <p className="message">{progress.message}</p>
          {progress.transactionHash && (
            <a 
              href={`https://explorer.monad.xyz/tx/${progress.transactionHash}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              View Transaction
            </a>
          )}
        </div>
      )}

      {progress?.state === SettlementState.COMPLETE && (
        <div className="success-message">
          <h3>✅ Settlement Complete!</h3>
          <p>
            {evaluation.status === "pass" 
              ? "Congratulations! Your tokens have been refunded."
              : "Your tokens have been forfeited. Better luck next time!"}
          </p>
        </div>
      )}

      {progress?.state === SettlementState.FAILED && (
        <div className="error-message">
          <h3>❌ Settlement Failed</h3>
          <p>{progress.message}</p>
          <button onClick={handleSettlement}>Retry Settlement</button>
        </div>
      )}
    </div>
  );
}
```

---

## 🔄 Complete Interview Flow Integration

### After Interview Completion

```typescript
// app/(root)/interview/[id]/page.tsx

async function handleInterviewComplete(transcript: Message[]) {
  try {
    // STEP 1: Evaluate interview
    const evaluationAgent = createEvaluationAgent();
    const decision = await evaluationAgent.evaluateAndDecide({
      transcript,
      metadata: {
        role: interview.role,
        domain: interview.type,
      },
      userId: user.id,
      interviewId: interview.id,
    });

    console.log(`Verdict: ${decision.status} (Score: ${decision.finalScore})`);

    // STEP 2: Execute settlement
    const settlementAgent = createSettlementAgent((progress) => {
      console.log(`[Settlement] ${progress.message}`);
    });

    const settlementResult = await settlementAgent.settle({
      walletAddress: user.walletAddress,
      finalScore: decision.finalScore,
      status: decision.status,
      escrowContractAddress: process.env.NEXT_PUBLIC_STAKE_ADDRESS!,
      stakedAmount: "0.5",
      adminWalletAddress: process.env.NEXT_PUBLIC_ADMIN_WALLET!,
      interviewId: interview.id,
      userId: user.id,
    });

    if (settlementResult.success) {
      // STEP 3: Save evaluation to database
      await saveEvaluationToFirebase(interview.id, decision.evaluation);

      // STEP 4: Redirect to feedback page
      router.push(`/interview/${interview.id}/feedback`);
    } else {
      throw new Error(settlementResult.error || "Settlement failed");
    }
  } catch (error) {
    console.error("Interview completion error:", error);
    // Show error to user
  }
}
```

---

## 🔧 Backend API Integration

### Create Settlement Endpoint

```typescript
// app/api/interview/settlement/route.ts

import { NextRequest, NextResponse } from "next/server";
import { verifySettlementOnChain } from "@/lib/web3";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      userId,
      interviewId,
      settlement,
    } = body;

    // Verify settlement on-chain
    const isValid = await verifySettlementOnChain(
      settlement.transactionHash,
      settlement.tokensStatus
    );

    if (!isValid) {
      return NextResponse.json(
        { error: "Invalid settlement transaction" },
        { status: 400 }
      );
    }

    // Update database
    await updateInterviewSettlement(interviewId, {
      settled: true,
      settlementTx: settlement.transactionHash,
      tokensStatus: settlement.tokensStatus,
      interviewStatus: settlement.interviewStatus,
      settledAt: new Date().toISOString(),
    });

    return NextResponse.json({
      success: true,
      message: "Settlement recorded",
    });
  } catch (error) {
    console.error("Settlement API error:", error);
    return NextResponse.json(
      { error: "Failed to record settlement" },
      { status: 500 }
    );
  }
}
```

---

## 🧪 Testing

### Test Settlement on Monad Testnet

```typescript
// test/settlement.test.ts

import { createSettlementAgent } from "@/lib/settlement-agent";

async function testSettlement() {
  const agent = createSettlementAgent((progress) => {
    console.log(`[${progress.state}] ${progress.message}`);
  });

  // Test PASS scenario
  const passResult = await agent.settle({
    walletAddress: "0x...", // Test wallet
    finalScore: 75,
    status: "pass",
    escrowContractAddress: process.env.NEXT_PUBLIC_STAKE_ADDRESS!,
    stakedAmount: "0.5",
    adminWalletAddress: process.env.NEXT_PUBLIC_ADMIN_WALLET!,
    interviewId: "test-interview-1",
    userId: "test-user-1",
  });

  console.log("PASS Result:", passResult);

  // Test FAIL scenario
  const failResult = await agent.settle({
    walletAddress: "0x...", // Test wallet
    finalScore: 45,
    status: "fail",
    escrowContractAddress: process.env.NEXT_PUBLIC_STAKE_ADDRESS!,
    stakedAmount: "0.5",
    adminWalletAddress: process.env.NEXT_PUBLIC_ADMIN_WALLET!,
    interviewId: "test-interview-2",
    userId: "test-user-2",
  });

  console.log("FAIL Result:", failResult);
}

testSettlement();
```

---

## 🚨 Error Handling

### Common Errors and Solutions

#### 1. "Failed to connect to escrow contract"
**Cause**: Contract address not configured or invalid
**Solution**: Check `NEXT_PUBLIC_STAKE_ADDRESS` in `.env.local`

#### 2. "No stake found"
**Cause**: User hasn't staked tokens or already settled
**Solution**: Verify user has active stake before settlement

#### 3. "Only admin can reward/slash"
**Cause**: Settlement called from non-admin wallet
**Solution**: Ensure admin wallet is configured correctly

#### 4. "Transaction failed on-chain"
**Cause**: Insufficient gas, network issues, or contract error
**Solution**: Retry with higher gas limit or check network status

### Retry Logic

```typescript
async function settleWithRetry(input: SettlementInput, maxRetries = 3) {
  const agent = createSettlementAgent();
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const result = await agent.settle(input);
      if (result.success) return result;
      
      console.log(`Attempt ${attempt} failed, retrying...`);
      await new Promise(resolve => setTimeout(resolve, 2000 * attempt));
    } catch (error) {
      if (attempt === maxRetries) throw error;
    }
  }
  
  throw new Error("Settlement failed after max retries");
}
```

---

## 📊 Monitoring & Analytics

### Track Settlement Metrics

```typescript
// lib/analytics.ts

export async function trackSettlement(result: SettlementResult) {
  await analytics.track("settlement_completed", {
    success: result.success,
    tokensStatus: result.tokensStatus,
    interviewStatus: result.interviewStatus,
    transactionHash: result.transactionHash,
    timestamp: result.timestamp,
  });
}
```

### Dashboard Queries

```typescript
// Get settlement statistics
const stats = await db.collection("interviews")
  .where("settled", "==", true)
  .get();

const passCount = stats.docs.filter(d => d.data().tokensStatus === "refunded").length;
const failCount = stats.docs.filter(d => d.data().tokensStatus === "penalized").length;

console.log(`Pass Rate: ${(passCount / stats.size * 100).toFixed(2)}%`);
```

---

## 🔐 Security Best Practices

1. **Admin Key Management**
   - Store admin private key in secure vault (AWS Secrets Manager, HashiCorp Vault)
   - Never commit private keys to git
   - Use environment variables for production

2. **Transaction Verification**
   - Always verify settlement on-chain before updating database
   - Check transaction status, recipient, and amount
   - Log all settlement attempts for audit trail

3. **Rate Limiting**
   - Prevent spam settlement attempts
   - Implement cooldown period between retries
   - Monitor for suspicious activity

4. **Multi-Sig Upgrade** (Recommended)
   - Replace single admin wallet with multi-sig
   - Require 2-of-3 or 3-of-5 signatures for settlement
   - Use Gnosis Safe or similar solution

---

## 🎯 Next Steps

1. ✅ Review settlement agent implementation
2. ✅ Test on Monad Testnet with real transactions
3. ✅ Integrate into interview completion flow
4. ✅ Create backend API endpoint
5. ✅ Add UI progress tracking
6. ✅ Implement error handling and retries
7. ✅ Set up monitoring and analytics
8. ✅ Security audit before mainnet deployment

---

## 📚 Additional Resources

- [Settlement Agent Source Code](./AI-Interview/lib/settlement-agent.ts)
- [Smart Contract Source Code](./careerprep-contracts/src/InterviewStake.sol)
- [Type Definitions](./AI-Interview/types/settlement.ts)
- [Monad Testnet Explorer](https://explorer.monad.xyz)
- [ethers.js Documentation](https://docs.ethers.org/v6/)

---

## 💡 Tips

- **Test thoroughly**: Use testnet tokens before mainnet
- **Monitor gas prices**: Adjust gas limit for network conditions
- **Log everything**: Detailed logs help debug issues
- **User feedback**: Show clear progress messages during settlement
- **Graceful degradation**: Handle network failures gracefully

---

## 🆘 Support

If you encounter issues:
1. Check environment variables are configured
2. Verify contracts are deployed and funded
3. Test with small amounts first
4. Review transaction logs on block explorer
5. Check network status (RPC endpoint health)

**The settlement agent is production-ready and waiting for integration!** 🚀
