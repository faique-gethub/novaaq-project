// Auth service layer.
// Email flow: real Firebase Authentication + real email verification, no OTP screen.
// Phone flow: real Firebase Phone Authentication (SMS OTP).
import { storage } from "@/src/utils/storage";
import { api, Role, User } from "./api";
import { firebaseAuth } from "./firebaseConfig";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendEmailVerification,
  sendPasswordResetEmail,
  RecaptchaVerifier,
  signInWithPhoneNumber,
  ConfirmationResult,
} from "firebase/auth";

const USER_KEY = "novaaq_user";

let recaptchaVerifier: RecaptchaVerifier | null = null;
let confirmationResult: ConfirmationResult | null = null;

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
      return { pendingVerification: true, message: "Verification email sent. Please check your inbox (and spam folder)." };
    }
    throw new Error("Use sendPhoneOtp for phone signup.");
  },

  async checkVerificationAndLogin(): Promise<User | null> {
    const current = firebaseAuth.currentUser;
    if (!current) return null;
    await current.reload();
    if (!current.emailVerified) return null;
    const idToken = await current.getIdToken(true);
    const user = await api.firebaseLogin(idToken);
    await storage.setItem(USER_KEY, JSON.stringify(user));
    return user;
  },

  async resendVerificationEmail() {
    const current = firebaseAuth.currentUser;
    if (!current) throw new Error("No pending signup found. Please sign up again.");
    await sendEmailVerification(current);
  },

    // ---------- Phone (real Firebase SMS OTP) ----------
  async sendPhoneOtp(phoneNumber: string) {
    if (typeof document === "undefined") {
      throw new Error("Phone verification requires a web browser.");
    }

    if (!recaptchaVerifier) {
      recaptchaVerifier = new RecaptchaVerifier(
        firebaseAuth,
        "recaptcha-container",
        {
          size: "invisible",
        }
      );

      await recaptchaVerifier.render();
    }

    confirmationResult = await signInWithPhoneNumber(
      firebaseAuth,
      phoneNumber,
      recaptchaVerifier
    );
  },

  async confirmPhoneOtp(code: string, role: Role): Promise<User> {
    if (!confirmationResult) {
      throw new Error("No OTP request found. Please request a new code.");
    }
    const cred = await confirmationResult.confirm(code);
    const idToken = await cred.user.getIdToken(true);
    const user = await api.firebasePhoneLogin(idToken, role);
    await storage.setItem(USER_KEY, JSON.stringify(user));
    confirmationResult = null;
    return user;
  },

  async login(identifier: string, password: string): Promise<User> {
    if (isEmail(identifier)) {
      const cred = await signInWithEmailAndPassword(firebaseAuth, identifier, password);
      await cred.user.reload();
      if (!cred.user.emailVerified) {
        throw new Error("Please verify your email before logging in. Check your inbox.");
      }
      const idToken = await cred.user.getIdToken(true);
      const user = await api.firebaseLogin(idToken);
      await storage.setItem(USER_KEY, JSON.stringify(user));
      return user;
    }
    throw new Error("Use sendPhoneOtp for phone login.");
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
