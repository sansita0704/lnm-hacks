"use client";

import { z } from "zod";
import Link from "next/link";
import Image from "next/image";
import { toast } from "sonner";
import { auth } from "@/firebase/client";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import LoginWithWallet from "./LoginWithWallet";
import { useState } from "react";

const AuthForm = ({ type }: { type: FormType }) => {
  const router = useRouter();
  const [isConnecting, setIsConnecting] = useState(false);

  const isSignIn = type === "sign-in";

  return (
    <div className="card-border lg:min-w-[566px]">
      <div className="flex flex-col gap-6 card py-14 px-10">
        <div className="flex flex-row gap-2 justify-center">
          <Image src="/logo.jpeg" alt="logo" height={32} width={38} className="rounded-2xl"/>
          <h2 className="text-white">CareerPrep</h2>
        </div>

        <h3>Practice job interviews with AI</h3>

        <div className="flex flex-col gap-4 mt-6">
          <p className="text-sm text-slate-400 text-center">
            Connect your wallet to start practicing your interview skills and earn tokens.
          </p>
          
          <LoginWithWallet onStateChange={setIsConnecting} />
        </div>

        <p className="text-center mt-6 text-xs text-slate-500">
          Powered by Monad & Gemini
        </p>
      </div>
    </div>
  );
};

export default AuthForm;
