import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  signOut,
  sendPasswordResetEmail,
  updateProfile,
  User,
} from "firebase/auth";
import { auth, db } from "./firebase";
import { doc, setDoc, getDoc } from "firebase/firestore";
import { generateReferralCode, createReferralData } from "./referral";

// Sign up with email and password
export const signUpWithEmail = async (
  email: string,
  password: string,
  fullName: string,
  referralCode?: string,
): Promise<User> => {
  const userCredential = await createUserWithEmailAndPassword(
    auth,
    email,
    password,
  );

  // Update user profile with full name
  if (userCredential.user) {
    await updateProfile(userCredential.user, {
      displayName: fullName,
    });

    // Generate unique referral code for this user
    const userReferralCode = generateReferralCode(fullName, email);

    // Create Firestore user document - include referredBy if user signed up with a referral code
    await setDoc(doc(db, "users", userCredential.user.uid), {
      fullName: fullName,
      email: email,
      photoURL: "",
      plan: "Free Trial",
      planStatus: "Trial",
      trialStart: new Date().toISOString(),
      trialEnd: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
      emailAlerts: true,
      weeklyReports: false,
      referredBy: referralCode || null, // Store referral code for plan visibility filtering
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    // Create referral data
    await createReferralData(
      userCredential.user.uid,
      userReferralCode,
      referralCode || null,
    );
  }

  return userCredential.user;
};

// Sign in with email and password
export const signInWithEmail = async (
  email: string,
  password: string,
): Promise<User> => {
  const userCredential = await signInWithEmailAndPassword(
    auth,
    email,
    password,
  );
  return userCredential.user;
};

// Sign in with Google
export const signInWithGoogle = async (
  referralCode?: string,
): Promise<User> => {
  const provider = new GoogleAuthProvider();
  const userCredential = await signInWithPopup(auth, provider);

  // Create Firestore user document if it doesn't exist (for new Google users)
  if (userCredential.user) {
    const userDocRef = doc(db, "users", userCredential.user.uid);
    const userDoc = await getDoc(userDocRef);
    const isNewUser = !userDoc.exists();

    // Base user data
    const userData: any = {
      fullName: userCredential.user.displayName || "",
      email: userCredential.user.email || "",
      photoURL: userCredential.user.photoURL || "",
      plan: "Free Trial",
      planStatus: "Trial",
      trialStart: new Date().toISOString(),
      trialEnd: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
      emailAlerts: true,
      weeklyReports: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    // Add referredBy for new users who signed up with a referral code
    if (isNewUser && referralCode) {
      userData.referredBy = referralCode;
    }

    await setDoc(userDocRef, userData, { merge: true }); // merge: true ensures we don't overwrite existing data

    // Create referral data only for new users
    if (isNewUser) {
      const userReferralCode = generateReferralCode(
        userCredential.user.displayName || "User",
        userCredential.user.email || "",
      );
      await createReferralData(
        userCredential.user.uid,
        userReferralCode,
        referralCode || null,
      );
    }
  }

  return userCredential.user;
};

// Sign out
export const logOut = async (): Promise<void> => {
  await signOut(auth);
};

// Reset password
export const resetPassword = async (email: string): Promise<void> => {
  await sendPasswordResetEmail(auth, email);
};
