"use client";

import { ethers } from "ethers";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { auth } from "@/firebase/client";
import { signInWithCustomToken } from "firebase/auth";
import { Button } from "@/components/ui/button";
import { setSessionCookie, getCustomTokenByWallet } from "@/lib/actions/auth.action";
import { useState } from "react";
import { Input } from "./ui/input";
import { Label } from "./ui/label";

interface LoginWithWalletProps {
    onStateChange?: (needsInfo: boolean) => void;
}

const LoginWithWallet = ({ onStateChange }: LoginWithWalletProps) => {
    const router = useRouter();
    const [isLoading, setIsLoading] = useState(false);
    const [needsInfo, setNeedsInfo] = useState(false);
    const [walletAddress, setWalletAddress] = useState("");
    
    // Additional info state
    const [email, setEmail] = useState("");
    const [username, setUsername] = useState("");

    const handleWalletLogin = async (e?: React.FormEvent) => {
        if (e) e.preventDefault();
        setIsLoading(true);
        
        try {
            if (!walletAddress) {
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
                setWalletAddress(address);
                
                // Initial check
                const result = await getCustomTokenByWallet({ walletAddress: address });
                
                if (!result.success) {
                    if (result.code === "NEEDS_INFO") {
                        setNeedsInfo(true);
                        onStateChange?.(true);
                        toast.info("New wallet detected! Please complete your profile.");
                        setIsLoading(false);
                        return;
                    }
                    toast.error(result.message || "Authentication failed.");
                    return;
                }

                await finalizeLogin(result.customToken!);
            } else {
                // We have the address and are submitting the additional info
                if (!email || !username) {
                    toast.error("Email and Username are required for new wallets.");
                    return;
                }

                const result = await getCustomTokenByWallet({ 
                    walletAddress, 
                    email, 
                    username 
                });

                if (!result.success || !result.customToken) {
                    toast.error(result.message || "Failed to authenticate.");
                    return;
                }

                await finalizeLogin(result.customToken);
            }
        } catch (error: any) {
            console.error("Wallet login error:", error);
            if (error.code === 4001) {
                toast.error("Login request rejected by user.");
            } else {
                toast.error(`Wallet login failed: ${error.message}`);
            }
        } finally {
            setIsLoading(false);
        }
    };

    const finalizeLogin = async (customToken: string) => {
        const userCredential = await signInWithCustomToken(auth, customToken);
        const idToken = await userCredential.user.getIdToken();
        await setSessionCookie(idToken);
        toast.success("Signed in with wallet successfully.");
        router.push("/");
        window.location.reload();
    };

    if (needsInfo) {
        return (
            <div className="flex flex-col gap-4 mt-4 p-4 border border-slate-700/30 rounded-lg bg-slate-800/10">
                <h4 className="text-sm font-semibold text-white">Complete your Profile</h4>
                <p className="text-xs text-slate-400">Since this is a new wallet, please provide your details to associate your account.</p>
                
                <div className="flex flex-col gap-2">
                    <Label htmlFor="wallet-email" className="text-xs">Email Address</Label>
                    <Input 
                        id="wallet-email"
                        placeholder="email@example.com"
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="bg-slate-900/50"
                    />
                </div>

                <div className="flex flex-col gap-2">
                    <Label htmlFor="wallet-username" className="text-xs">Username</Label>
                    <Input 
                        id="wallet-username"
                        placeholder="Your display name"
                        type="text"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        className="bg-slate-900/50"
                    />
                </div>

                <Button 
                    onClick={handleWalletLogin} 
                    className="btn w-full mt-2 text-white"
                    type="button"
                    disabled={isLoading}
                >
                    {isLoading ? "Saving..." : "Create Account & Login"}
                </Button>
                
                <button 
                    onClick={() => { 
                        setNeedsInfo(false); 
                        setWalletAddress(""); 
                        onStateChange?.(false);
                    }}
                    className="text-[10px] text-slate-500 hover:text-slate-300 text-center uppercase tracking-wider mt-1"
                >
                    Cancel
                </button>
            </div>
        );
    }

    return (
        <div className="flex flex-col gap-4 mt-4">
            <div className="flex items-center gap-4">
                <div className="h-[1px] bg-slate-700 flex-1 opacity-20" />
                <span className="text-xs text-slate-400 uppercase">Or</span>
                <div className="h-[1px] bg-slate-700 flex-1 opacity-20" />
            </div>
            
            <Button 
                onClick={() => handleWalletLogin()} 
                className="btn-secondary w-full flex items-center justify-center gap-2 text-white"
                type="button"
                disabled={isLoading}
            >
                {isLoading ? "Connecting..." : "Login with MetaMask"}
            </Button>
        </div>
    );
};

export default LoginWithWallet;
