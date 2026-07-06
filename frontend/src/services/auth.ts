// Auth service layer.
// Email flow: real Firebase Authentication + real email verification, no OTP screen.
// Phone flow: unchanged mock backend system.
import { storage } from "@/src/utils/storage";
import { api, Role, User } from "./api";
import { firebaseAuth } from "./firebaseConfig";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendEmailVerification,
  sendPasswordResetEmail,
} from "firebase/auth";

const USER_KEY = "novaaq_user";

function isEmail(identifier: string): boolean {
  return identifier.includes("@");
}

export const authService = {
  async signup(identifier: string, password: string, role: Role) {
    if (isEmail(identifier)) {
      if (role === "admin") {
        throw new Error("Admin accounts cannot be self-registered.");
      }
      const cred = await createUserWithEmailAndPassword(firebaseAuth, identifier, password);
      await sendEmailVerification(cred.user);
      // Stay signed in (unverified) so we can poll and auto-login once verified.
      return { pendingVerification: true, message: "Verification email sent. Please check your inbox (and spam folder)." };
    }
    // Phone flow — unchanged mock system
    return api.signup(identifier, password, role);
  },

  // Call this repeatedly (e.g. every 3s) from a "waiting for verification" screen.
  // Returns the logged-in User once verified, or null if still pending.
  async checkVerificationAndLogin(): Promise<User | null> {
    const current = firebaseAuth.currentUser;
    if (!current) return null;
    await current.reload();
    if (!current.emailVerified) return null;

    const idToken = await current.getIdToken(true); // force refresh to get latest emailVerified claim
    const user = await api.firebaseLogin(idToken);
    await storage.setItem(USER_KEY, JSON.stringify(user));
    return user;
  },

  async resendVerificationEmail() {
    const current = firebaseAuth.currentUser;
    if (!current) throw new Error("No pending signup found. Please sign up again.");
    await sendEmailVerification(current);
  },

  async verify(user_id: string, code: string): Promise<User> {
    // Only used by the phone mock flow. Email users verify via the link in their inbox.
    const user = await api.verify(user_id, code);
    await storage.setItem(USER_KEY, JSON.stringify(user));
    return user;
  },

  async login(identifier: string, password: string): Promise<User> {
    if (isEmail(identifier)) {
      const cred = await signInWithEmailAndPassword(firebaseAuth, identifier, password);
      await cred.user.reload();
      if (!cred.user.emailVerified) {
        throw new Error("Please verify your email before logging in. Check your inbox.");
      }
      const idToken = await cred.user.getIdToken(true); // force refresh to get latest emailVerified claim
      const user = await api.firebaseLogin(idToken);
      await storage.setItem(USER_KEY, JSON.stringify(user));
      return user;
    }
    // Phone flow — unchanged mock system
    const user = await api.login(identifier, password);
    await storage.setItem(USER_KEY, JSON.stringify(user));
    return user;
  },

  async requestPasswordReset(email: string) {
    if (!email.includes("@")) {
      throw new Error("Password reset is only available for email accounts.");
    }
    await sendPasswordResetEmail(firebaseAuth, email);
  },

  async logout() {
    await storage.removeItem(USER_KEY);
    try {
      await firebaseAuth.signOut();
    } catch {}
  },

  async currentUser(): Promise<User | null> {
    const raw = await storage.getItem<string>(USER_KEY, "");
    if (!raw) return null;
    try {
      return JSON.parse(raw) as User;
    } catch {
      return null;
    }
  },
};
