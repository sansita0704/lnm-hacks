"use server";

import { db } from "@/firebase/admin";

export async function saveUserWallet(userId: string, wallet: string) {

  if (!userId || !wallet) return;

  await db.collection("users").doc(userId).set(
    {
      wallet: wallet,
      updatedAt: new Date().toISOString()
    },
    { merge: true }
  );
}