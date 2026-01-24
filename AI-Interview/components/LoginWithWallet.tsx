"use client";

import { ethers } from "ethers";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { auth } from "@/firebase/client";
import { signInWithCustomToken } from "firebase/auth";
import { Button } from "@/components/ui/button";
import { setSessionCookie, getCustomTokenByWallet } from "@/lib/actions/auth.action";
import { useState } from "react";

interface LoginWithWalletProps {
    onStateChange?: (isConnecting: boolean) => void;
}

const LoginWithWallet = ({ onStateChange }: LoginWithWalletProps) => {
    const router = useRouter();
    const [isLoading, setIsLoading] = useState(false);

    const handleWalletLogin = async () => {
        setIsLoading(true);
        onStateChange?.(true);
        
        try {
            if (typeof window.ethereum === "undefined") {
                toast.error("MetaMask is not installed.");
                return;
            }

            const accounts = await window.ethereum.request({ method: "eth_requestAccounts" });
            const address = accounts[0];

            if (!address) {
                toast.error("No account connected.");
                return;
            }
            
            // Get custom token from backend using ONLY wallet address
            const result = await getCustomTokenByWallet({ walletAddress: address });
            
            if (!result.success || !result.customToken) {
                toast.error(result.message || "Authentication failed.");
                return;
            }

            // Sign in with custom token client-side
            const userCredential = await signInWithCustomToken(auth, result.customToken);
            const idToken = await userCredential.user.getIdToken();

            // Set session cookie
            await setSessionCookie(idToken);

            toast.success("Connected with MetaMask successfully.");
            router.push("/");
            // Reload to ensure all components see the updated auth state
            window.location.reload();
        } catch (error: any) {
            console.error("Wallet login error:", error);
            if (error.code === 4001) {
                toast.error("Connection request rejected by user.");
            } else {
                toast.error(`Wallet connection failed: ${error.message}`);
            }
        } finally {
            setIsLoading(false);
            onStateChange?.(false);
        }
    };

    return (
        <div className="flex flex-col gap-4 mt-4">
            <Button 
                onClick={() => handleWalletLogin()} 
                className="btn-secondary w-full flex items-center justify-center gap-2 text-white"
                type="button"
                disabled={isLoading}
            >
                {isLoading ? "Connecting..." : "Connect with MetaMask"}
            </Button>
        </div>
    );
};

export default LoginWithWallet;
