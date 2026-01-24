"use client";

import { PaymentState, PaymentProgress } from "@/types/payment";
import { useEffect, useState } from "react";

interface PaymentModalProps {
  isOpen: boolean;
  progress: PaymentProgress;
  onClose: () => void;
}

export default function PaymentModal({
  isOpen,
  progress,
  onClose,
}: PaymentModalProps) {
  const [showModal, setShowModal] = useState(false);

  useEffect(() => {
    setShowModal(isOpen);
  }, [isOpen]);

  if (!showModal) return null;

  const getStateIcon = (state: PaymentState) => {
    switch (state) {
      case PaymentState.PAYMENT_REQUIRED:
        return "💳";
      case PaymentState.APPROVING:
        return "🔐";
      case PaymentState.PROCESSING:
        return "⏳";
      case PaymentState.VERIFYING:
        return "✓";
      case PaymentState.COMPLETE:
        return "✅";
      case PaymentState.REJECTED:
        return "❌";
      case PaymentState.FAILED:
        return "⚠️";
      default:
        return "💰";
    }
  };

  const getStateColor = (state: PaymentState) => {
    switch (state) {
      case PaymentState.COMPLETE:
        return "text-success-100";
      case PaymentState.REJECTED:
      case PaymentState.FAILED:
        return "text-destructive-100";
      case PaymentState.PROCESSING:
      case PaymentState.VERIFYING:
        return "text-primary-200";
      default:
        return "text-light-100";
    }
  };

  const canClose =
    progress.state === PaymentState.COMPLETE ||
    progress.state === PaymentState.REJECTED ||
    progress.state === PaymentState.FAILED;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="card-border max-w-md w-full mx-4">
        <div className="card p-6 space-y-6">
          {/* Header */}
          <div className="text-center space-y-2">
            <div className="text-6xl">{getStateIcon(progress.state)}</div>
            <h2 className="text-2xl font-bold text-white">
              {progress.state === PaymentState.PAYMENT_REQUIRED
                ? "Payment Required"
                : progress.state === PaymentState.COMPLETE
                  ? "Payment Successful!"
                  : progress.state === PaymentState.REJECTED
                    ? "Payment Rejected"
                    : progress.state === PaymentState.FAILED
                      ? "Payment Failed"
                      : "Processing Payment"}
            </h2>
          </div>

          {/* Message */}
          <div className="text-center">
            <p className={`text-lg ${getStateColor(progress.state)}`}>
              {progress.message}
            </p>
          </div>

          {/* Transaction Hash */}
          {progress.transactionHash && (
            <div className="bg-dark-200 rounded-lg p-4 space-y-2">
              <p className="text-sm text-light-400">Transaction Hash:</p>
              <p className="text-xs text-primary-200 font-mono break-all">
                {progress.transactionHash}
              </p>
              <a
                href={`https://explorer.monad.xyz/tx/${progress.transactionHash}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-primary-200 hover:underline inline-flex items-center gap-1"
              >
                View on Explorer →
              </a>
            </div>
          )}

          {/* Loading Spinner */}
          {(progress.state === PaymentState.PROCESSING ||
            progress.state === PaymentState.VERIFYING ||
            progress.state === PaymentState.APPROVING) && (
            <div className="flex justify-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-200"></div>
            </div>
          )}

          {/* Instructions */}
          {progress.state === PaymentState.PAYMENT_REQUIRED && (
            <div className="bg-dark-200 rounded-lg p-4 space-y-2">
              <p className="text-sm text-light-100">
                <strong>What happens next:</strong>
              </p>
              <ol className="text-sm text-light-400 space-y-1 list-decimal list-inside">
                <li>Approve token spending in MetaMask</li>
                <li>Confirm staking transaction</li>
                <li>Wait for blockchain confirmation</li>
                <li>Interview will start automatically</li>
              </ol>
            </div>
          )}

          {progress.state === PaymentState.APPROVING && (
            <div className="bg-dark-200 rounded-lg p-4">
              <p className="text-sm text-light-100 text-center">
                Please check MetaMask and approve the transaction...
              </p>
            </div>
          )}

          {/* Error Message */}
          {progress.state === PaymentState.FAILED && (
            <div className="bg-destructive-100/10 border border-destructive-100 rounded-lg p-4">
              <p className="text-sm text-destructive-100">
                {progress.message}
              </p>
            </div>
          )}

          {/* Close Button */}
          {canClose && (
            <button
              onClick={onClose}
              className={`w-full py-3 rounded-full font-bold transition-colors ${
                progress.state === PaymentState.COMPLETE
                  ? "bg-success-100 hover:bg-success-200 text-white"
                  : "bg-dark-200 hover:bg-dark-300 text-light-100"
              }`}
            >
              {progress.state === PaymentState.COMPLETE
                ? "Continue to Interview"
                : "Close"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
