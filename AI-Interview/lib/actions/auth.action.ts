"use server";

import { auth, db } from "@/firebase/admin";
import { cookies } from "next/headers";

// Session duration (1 week)
const SESSION_DURATION = 60 * 60 * 24 * 7;

// Set session cookie
export async function setSessionCookie(idToken: string) {
  const cookieStore = await cookies();

  // Create session cookie
  const sessionCookie = await auth.createSessionCookie(idToken, {
    expiresIn: SESSION_DURATION * 1000, // milliseconds
  });

  // Set cookie in the browser
  cookieStore.set("session", sessionCookie, {
    maxAge: SESSION_DURATION,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    sameSite: "lax",
  });
}

export async function signUp(params: SignUpParams) {
  const { uid, name, email } = params;

  try {
    // check if user exists in db
    const userRecord = await db.collection("users").doc(uid).get();
    if (userRecord.exists)
      return {
        success: false,
        message: "User already exists. Please sign in.",
      };

    // save user to db
    await db.collection("users").doc(uid).set({
      name,
      email,
      // profileURL,
      // resumeURL,
    });

    return {
      success: true,
      message: "Account created successfully. Please sign in.",
    };
  } catch (error: any) {
    console.error("Error creating user:", error);

    // Handle Firebase specific errors
    if (error.code === "auth/email-already-exists") {
      return {
        success: false,
        message: "This email is already in use",
      };
    }

    return {
      success: false,
      message: "Failed to create account. Please try again.",
    };
  }
}

export async function signIn(params: SignInParams) {
  const { email, idToken } = params;

  try {
    const userRecord = await auth.getUserByEmail(email);
    if (!userRecord)
      return {
        success: false,
        message: "User does not exist. Create an account.",
      };

    await setSessionCookie(idToken);
  } catch (error: any) {
    console.log("");

    return {
      success: false,
      message: "Failed to log into account. Please try again.",
    };
  }
}

export async function getCustomTokenByWallet(params: {
  walletAddress: string;
  email?: string;
  username?: string;
}) {
  const { walletAddress, email, username } = params;
  
  try {
    const formattedWallet = walletAddress.toLowerCase();
    
    // 1. Check if user exists by walletAddress in Firestore
    const usersRef = db.collection("users");
    const walletQuery = await usersRef.where("walletAddress", "==", formattedWallet).limit(1).get();
    
    let uid: string;
    
    if (!walletQuery.empty) {
      // Wallet exists, log them in
      uid = walletQuery.docs[0].id;
      console.log(`Logging in existing wallet user: ${uid}`);
    } else {
      // Wallet is NEW
      console.log(`New wallet detected: ${formattedWallet}`);
      
      // 2. Check if we should associate with an existing email user
      if (email) {
        const emailQuery = await usersRef.where("email", "==", email.toLowerCase()).limit(1).get();
        if (!emailQuery.empty) {
          // Associate wallet with existing email user
          uid = emailQuery.docs[0].id;
          await usersRef.doc(uid).update({
            walletAddress: formattedWallet,
            authType: "wallet", // Or keeping as email but adding wallet attribute
            updatedAt: new Date().toISOString(),
          });
          console.log(`Associated wallet ${formattedWallet} with existing email user ${uid}`);
        } else {
          // Create new user with email and wallet
          const userRecord = await auth.createUser({
            email: email,
            displayName: username || `User ${formattedWallet.slice(0, 6)}`,
          });
          uid = userRecord.uid;
          
          await usersRef.doc(uid).set({
            email: email.toLowerCase(),
            name: username || `User ${formattedWallet.slice(0, 6)}`,
            walletAddress: formattedWallet,
            authType: "wallet",
            createdAt: new Date().toISOString(),
          });
          console.log(`Created new user ${uid} with wallet and email`);
        }
      } else {
        // No email provided, check if we need to return "needs_info" or just create anonymous-ish
        // Based on user request, if new, save with walletAddress, username, email.
        // If we don't have them yet, we might need a two-step flow in the frontend.
        return { success: false, code: "NEEDS_INFO", message: "New wallet requires email/username association" };
      }
    }
    
    // Generate custom token
    const customToken = await auth.createCustomToken(uid);
    return { success: true, customToken };
    
  } catch (error: any) {
    console.error("Error generating wallet token:", error);
    return { success: false, message: error.message || "Failed to authenticate wallet" };
  }
}

// Sign out user by clearing the session cookie
export async function signOut() {
  const cookieStore = await cookies();

  cookieStore.delete("session");
}

// Get current user from session cookie
export async function getCurrentUser(): Promise<User | null> {
  const cookieStore = await cookies();

  const sessionCookie = cookieStore.get("session")?.value;
  if (!sessionCookie) return null;

  try {
    const decodedClaims = await auth.verifySessionCookie(sessionCookie, true);

    // get user info from db
    const userRecord = await db
      .collection("users")
      .doc(decodedClaims.uid)
      .get();
    if (!userRecord.exists) return null;

    return {
      ...userRecord.data(),
      id: userRecord.id,
    } as User;
  } catch (error) {
    console.log(error);

    // Invalid or expired session
    return null;
  }
}

// Check if user is authenticated
export async function isAuthenticated() {
  const user = await getCurrentUser();
  return !!user;
}
