"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  onAuthStateChanged,
  User,
  updatePassword,
  sendPasswordResetEmail,
  updateProfile,
  EmailAuthProvider,
  reauthenticateWithCredential,
} from "firebase/auth";
import { auth, db, storage } from "@/lib/firebase";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { logOut } from "@/lib/auth";
import { doc, getDoc, updateDoc, setDoc, collection, getDocs, query, where, orderBy } from "firebase/firestore";
import Header from "@/components/Header";
import {
  applyPlanIfTrialEnded,
  getEffectivePlanId,
  getPlanDetailsFromFirestore,
  PlanDetails,
} from "@/lib/plans";
import { getReferralData, ReferralData } from "@/lib/referral";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import {
  Shield,
  UserCircle,
  Lock,
  Bell,
  CreditCard,
  Save,
  Check,
  CheckCircle,
  AlertCircle,
  Download,
  Calendar,
  Camera,
  Upload,
  Users,
  Copy,
  Share2,
  Link as LinkIcon,
  TrendingUp,
  Gift,
  Eye,
  X,
  Mail,
  Smartphone,
  Building,
  Hash,
  Clock,
} from "lucide-react";

// Withdrawal type for details modal
interface WithdrawalItem {
  id: string;
  amount: number;
  method: "paypal" | "bank" | "upi";
  details: any;
  status: "pending" | "completed" | "failed";
  requestDate: string;
  completedDate?: string;
  rejectReason?: string;
}

interface UserProfile {
  fullName: string;
  email: string;
  phone: string;
  photoURL: string;
}

interface NotificationSettings {
  emailAlerts: boolean;
  weeklyReports: boolean;
}

interface BillingHistoryItem {
  id: string;
  date: string;
  description: string;
  amount: number;
  status: "paid" | "pending" | "failed" | "refunded";
  invoiceId?: string;
}

interface BillingInfo {
  currentPlan: string;
  startDate: string;
  renewalDate: string;
  status: string;
  billingCycle: "monthly" | "yearly";
  nextCharge: string;
  billingHistory: BillingHistoryItem[];
}

export default function AccountPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<
    "profile" | "security" | "notifications" | "billing" | "referral"
  >("profile");

  // Referral state
  const [referralData, setReferralData] = useState<ReferralData | null>(null);
  const [referralLink, setReferralLink] = useState<string>("");
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  // Earnings & Withdrawal state
  const [showWithdrawalModal, setShowWithdrawalModal] = useState(false);
  const [withdrawalMethod, setWithdrawalMethod] = useState<"paypal" | "bank" | "upi">(
    "paypal",
  );
  const [withdrawalAmount, setWithdrawalAmount] = useState("");
  const [paypalEmail, setPaypalEmail] = useState("");
  const [upiId, setUpiId] = useState("");
  const [bankDetails, setBankDetails] = useState({
    accountName: "",
    accountNumber: "",
    bankName: "",
    routingNumber: "",
  });
  const [withdrawalProcessing, setWithdrawalProcessing] = useState(false);
  const [withdrawalSuccess, setWithdrawalSuccess] = useState(false);
  const [withdrawalError, setWithdrawalError] = useState("");
  
  // Withdrawal details modal state
  const [showWithdrawalDetailsModal, setShowWithdrawalDetailsModal] = useState(false);
  const [selectedWithdrawalItem, setSelectedWithdrawalItem] = useState<WithdrawalItem | null>(null);

  // Profile state
  const [profile, setProfile] = useState<UserProfile>({
    fullName: "",
    email: "",
    phone: "",
    photoURL: "",
  });
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileSuccess, setProfileSuccess] = useState(false);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string>("");
  const [photoUploading, setPhotoUploading] = useState(false);

  // Security state
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [passwordSuccess, setPasswordSuccess] = useState(false);
  const [passwordChanging, setPasswordChanging] = useState(false);
  const [resetEmailSent, setResetEmailSent] = useState(false);

  // Notifications state
  const [notifications, setNotifications] = useState<NotificationSettings>({
    emailAlerts: true,
    weeklyReports: false,
  });
  const [notificationsSaving, setNotificationsSaving] = useState(false);
  const [notificationsSuccess, setNotificationsSuccess] = useState(false);

  // Billing state
  const [billing, setBilling] = useState<BillingInfo>({
    currentPlan: "Free Trial",
    startDate: "N/A",
    renewalDate: "N/A",
    status: "Active",
    billingCycle: "monthly",
    nextCharge: "$0",
    billingHistory: [],
  });
  
  // Plan details state for displaying features
  const [planFeatures, setPlanFeatures] = useState<PlanDetails | null>(null);

  // Commission settings state (from admin configuration)
  const [commissionSettings, setCommissionSettings] = useState({
    monthlyRate: 15,
    yearlyRate: 20,
    minWithdrawal: 10,
    pendingDays: 7,
  });

  // Fetch commission settings from API
  const loadCommissionSettings = async () => {
    try {
      const res = await fetch("/api/settings/referral");
      const data = await res.json();
      if (data.success && data.settings) {
        setCommissionSettings(data.settings);
      }
    } catch (error) {
      console.error("Error loading commission settings:", error);
    }
  };

  useEffect(() => {
    loadCommissionSettings();
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        setUser(currentUser);
        await loadUserData(currentUser);
      } else {
        router.push("/login");
      }
    });

    return () => unsubscribe();
  }, [router]);

  const loadUserData = async (currentUser: User) => {
    try {
      const userDoc = await getDoc(doc(db, "users", currentUser.uid));

      // Load referral data
      const refData = await getReferralData(currentUser.uid);
      setReferralData(refData);

      // Generate referral link if we have referral data
      if (refData && refData.referralCode) {
        const link =
          typeof window !== "undefined"
            ? `${window.location.origin}/signup?ref=${refData.referralCode}`
            : "";
        setReferralLink(link);
      }

      if (userDoc.exists()) {
        const userData = userDoc.data();
        // Load name from Firestore first, fallback to Firebase Auth displayName
        const userName = userData.fullName || currentUser.displayName || "";
        const userPhoto = userData.photoURL || currentUser.photoURL || "";
        setProfile({
          fullName: userName,
          email: currentUser.email || "",
          phone: userData.phone || "",
          photoURL: userPhoto,
        });
        setPhotoPreview(userPhoto);
        setNotifications({
          emailAlerts: userData.emailAlerts ?? true,
          weeklyReports: userData.weeklyReports ?? false,
        });
        try {
          await applyPlanIfTrialEnded(currentUser.uid);
        } catch {}
        const now = Date.now();
        const trialEndMs = userData?.trialEnd
          ? Date.parse(userData.trialEnd)
          : 0;
        const inTrial =
          userData?.planStatus === "Trial" && trialEndMs && now <= trialEndMs;
        const effectiveId = getEffectivePlanId(userData);
        const cycle: "monthly" | "yearly" =
          userData?.subscriptionPeriod === "yearly" ? "yearly" : "monthly";
        
        // Fetch plan details from Firestore for dynamic plans
        const planDetails = await getPlanDetailsFromFirestore(effectiveId);
        const planName = inTrial
          ? "Free Trial"
          : planDetails?.name || (effectiveId === "free" ? "Free" : effectiveId.charAt(0).toUpperCase() + effectiveId.slice(1));
        
        // Get price from Firestore plan details
        const amount =
          inTrial || effectiveId === "free"
            ? 0
            : planDetails
              ? (cycle === "yearly" ? planDetails.yearlyPrice : planDetails.monthlyPrice)
              : 0;
        
        // Calculate start date and renewal date
        const renewalDateStr = userData.renewalDate || "";
        let startDateStr = "N/A";
        let renewalDateFormatted = "N/A";
        
        if (renewalDateStr) {
          // If we have renewal date, calculate start date from it
          const renewalDate = new Date(renewalDateStr);
          const startDate = new Date(renewalDate);
          if (cycle === "yearly") {
            startDate.setFullYear(startDate.getFullYear() - 1);
          } else {
            startDate.setMonth(startDate.getMonth() - 1);
          }
          startDateStr = startDate.toLocaleDateString("en-US", {
            year: "numeric",
            month: "long",
            day: "numeric"
          });
          renewalDateFormatted = renewalDate.toLocaleDateString("en-US", {
            year: "numeric",
            month: "long",
            day: "numeric"
          });
        } else {
          // If no renewal date, calculate it from start date
          let startDate: Date | null = null;
          
          if (userData.planStartDate) {
            startDate = new Date(userData.planStartDate);
          } else if (userData.createdAt) {
            startDate = new Date(userData.createdAt);
          } else {
            // Use current date as fallback
            startDate = new Date();
          }
          
          startDateStr = startDate.toLocaleDateString("en-US", {
            year: "numeric",
            month: "long",
            day: "numeric"
          });
          
          // Calculate renewal date from start date
          const renewalDate = new Date(startDate);
          if (cycle === "yearly") {
            renewalDate.setFullYear(renewalDate.getFullYear() + 1);
          } else {
            renewalDate.setMonth(renewalDate.getMonth() + 1);
          }
          renewalDateFormatted = renewalDate.toLocaleDateString("en-US", {
            year: "numeric",
            month: "long",
            day: "numeric"
          });
        }
        
        // Generate billing history from payment records
        const billingHistory: BillingHistoryItem[] = [];
        
        // Fetch ALL payment records from Firestore payments collection
        try {
          const paymentsRef = collection(db, "payments");
          // Query all payments for this user (no status filter to get complete history)
          const paymentsQuery = query(
            paymentsRef,
            where("userId", "==", currentUser.uid)
          );
          const paymentsSnapshot = await getDocs(paymentsQuery);
          
          paymentsSnapshot.docs.forEach((paymentDoc, index) => {
            const paymentData = paymentDoc.data();
            // Map payment status to display status
            let displayStatus: "paid" | "pending" | "failed" | "refunded" = "paid";
            if (paymentData.status === "succeeded" || paymentData.status === "completed") {
              displayStatus = "paid";
            } else if (paymentData.status === "pending" || paymentData.status === "processing") {
              displayStatus = "pending";
            } else if (paymentData.status === "refunded") {
              displayStatus = "refunded";
            } else if (paymentData.status === "failed" || paymentData.status === "cancelled") {
              displayStatus = "failed";
            }
            
            // Get plan name from payment data or use fetched plan details
            const paymentPlanName = paymentData.planName || 
              (paymentData.planId ? paymentData.planId.charAt(0).toUpperCase() + paymentData.planId.slice(1) : planName);
            
            billingHistory.push({
              id: paymentDoc.id,
              date: paymentData.createdAt || paymentData.completedAt || paymentData.updatedAt || "",
              description: `${paymentPlanName} Subscription (${paymentData.cycle === "yearly" ? "Annual" : "Monthly"})`,
              amount: paymentData.amount || 0,
              status: displayStatus,
              invoiceId: paymentData.invoiceId || `INV-${currentUser.uid.slice(0, 8)}-${String(index + 1).padStart(3, '0')}`,
            });
          });
        } catch (paymentError) {
          console.error("Error fetching payments:", paymentError);
        }
        
        // Add payment history from user data if available (fallback)
        if (billingHistory.length === 0 && userData.paymentHistory && Array.isArray(userData.paymentHistory)) {
          userData.paymentHistory.forEach((payment: any, index: number) => {
            billingHistory.push({
              id: payment.id || `payment-${index}`,
              date: payment.date || payment.createdAt || "",
              description: payment.description || `${payment.planName || planName} Subscription`,
              amount: payment.amount || 0,
              status: payment.status || "paid",
              invoiceId: payment.invoiceId || `INV-${currentUser.uid.slice(0, 8)}-${index + 1}`,
            });
          });
        }
        
        // If no payment history but user has a paid plan, create a synthetic history entry
        if (billingHistory.length === 0 && amount > 0 && !inTrial) {
          const lastPaymentDate = renewalDateStr 
            ? new Date(new Date(renewalDateStr).getTime() - (cycle === "yearly" ? 365 : 30) * 24 * 60 * 60 * 1000)
            : new Date();
          billingHistory.push({
            id: `payment-initial`,
            date: lastPaymentDate.toISOString(),
            description: `${planName} Subscription (${cycle === "yearly" ? "Annual" : "Monthly"})`,
            amount: amount,
            status: "paid",
            invoiceId: `INV-${currentUser.uid.slice(0, 8)}-001`,
          });
        }
        
        // Sort billing history by date (most recent first)
        billingHistory.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        
        setBilling({
          currentPlan: planName,
          startDate: startDateStr,
          renewalDate: renewalDateFormatted,
          status: inTrial ? "Trial" : userData.planStatus || "Active",
          billingCycle: cycle,
          nextCharge: `$${amount}`,
          billingHistory: billingHistory,
        });
        
        // Store plan features for display
        setPlanFeatures(planDetails);
      } else {
        // If no Firestore doc, use Firebase Auth data
        setProfile({
          fullName: currentUser.displayName || "",
          email: currentUser.email || "",
          phone: "",
          photoURL: currentUser.photoURL || "",
        });
        setPhotoPreview(currentUser.photoURL || "");
      }

      setLoading(false);
    } catch (error) {
      console.error("Error loading user data:", error);
      setLoading(false);
    }
  };

  const generateInvoicePDF = () => {
    if (!user) return;
    const companyName = process.env.NEXT_PUBLIC_COMPANY_NAME || "LinkGuard";
    const companyAddress = process.env.NEXT_PUBLIC_COMPANY_ADDRESS || "";
    const supportEmail = process.env.NEXT_PUBLIC_SUPPORT_EMAIL || "";
    const taxRateStr = process.env.NEXT_PUBLIC_TAX_RATE || "0";
    const taxRate = Number(taxRateStr) > 0 ? Number(taxRateStr) : 0;
    const issueDate = new Date();
    const end =
      billing.renewalDate && billing.renewalDate !== "N/A"
        ? new Date(billing.renewalDate)
        : new Date();
    const start = new Date(
      end.getTime() -
        (billing.billingCycle === "yearly" ? 365 : 30) * 24 * 60 * 60 * 1000,
    );
    const periodText = `${start.toISOString().slice(0, 10)} to ${end.toISOString().slice(0, 10)}`;
    const qty = 1;
    const unit = Number(billing.nextCharge.replace("$", "")) || 0;
    const subtotal = unit * qty;
    const tax = Number(((subtotal * taxRate) / 100).toFixed(2));
    const total = subtotal + tax;
    const planLabel = `${billing.currentPlan} (${billing.billingCycle === "yearly" ? "Yearly" : "Monthly"})`;
    const invoiceNumber = `INV-${user.uid}-${issueDate.toISOString().slice(0, 10).replace(/-/g, "")}`;

    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    doc.setFillColor(51, 102, 204);
    doc.rect(0, 0, pageWidth, 30, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(16);
    doc.text(companyName, 14, 18);
    doc.setFontSize(10);
    if (companyAddress) doc.text(companyAddress, 14, 24);
    if (supportEmail) doc.text(supportEmail, 14, 28);
    doc.setFontSize(12);
    doc.text(`Invoice # ${invoiceNumber}`, pageWidth - 14, 16, {
      align: "right",
    });
    doc.setFontSize(10);
    doc.text(
      `Issue Date: ${issueDate.toISOString().slice(0, 10)}`,
      pageWidth - 14,
      22,
      { align: "right" },
    );
    doc.text(`Billing Period: ${periodText}`, pageWidth - 14, 26, {
      align: "right",
    });
    doc.text(`Status: ${billing.status}`, pageWidth - 14, 30, {
      align: "right",
    });
    doc.setTextColor(0, 0, 0);

    doc.setFontSize(12);
    doc.text("Bill To", 14, 44);
    doc.setFontSize(10);
    doc.text(profile.fullName || "", 14, 50);
    doc.text(profile.email || "", 14, 54);

    autoTable(doc, {
      startY: 64,
      head: [["Description", "Qty", "Unit Price", "Total"]],
      body: [
        [
          `Subscription – ${planLabel}`,
          String(qty),
          `$${unit.toFixed(2)}`,
          `$${subtotal.toFixed(2)}`,
        ],
      ],
      styles: { fontSize: 10, cellPadding: 4 },
      theme: "striped",
      headStyles: { fillColor: [51, 102, 204], textColor: [255, 255, 255] },
      columnStyles: {
        1: { halign: "center" },
        2: { halign: "right" },
        3: { halign: "right" },
      },
    });

    const y = (doc as any).lastAutoTable.finalY + 8;
    doc.setFontSize(10);
    doc.text(`Subtotal: $${subtotal.toFixed(2)}`, pageWidth - 14, y, {
      align: "right",
    });
    doc.text(`Tax: $${tax.toFixed(2)}`, pageWidth - 14, y + 6, {
      align: "right",
    });
    doc.setFontSize(12);
    doc.text(`Total: $${total.toFixed(2)}`, pageWidth - 14, y + 14, {
      align: "right",
    });

    doc.setFontSize(9);
    doc.text("Thank you for your business.", 14, y + 24);
    const filename = `invoice_${billing.currentPlan.toLowerCase().replace(/\s+/g, "-")}_${issueDate.toISOString().slice(0, 10)}.pdf`;
    doc.save(filename);
  };

  const handleLogout = async () => {
    try {
      await logOut();
      router.push("/");
    } catch (error) {
      console.error("Logout error:", error);
    }
  };

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Validate file type
      if (!file.type.startsWith("image/")) {
        alert("Please select an image file");
        return;
      }

      // Validate file size (max 5MB)
      if (file.size > 5 * 1024 * 1024) {
        alert("Image size should be less than 5MB");
        return;
      }

      setPhotoFile(file);

      // Create preview
      const reader = new FileReader();
      reader.onloadend = () => {
        setPhotoPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleProfileSave = async () => {
    if (!user) return;

    setProfileSaving(true);
    setProfileSuccess(false);

    try {
      let photoURL = profile.photoURL;

      // Upload photo if a new one was selected
      if (photoFile) {
        console.log("Starting photo upload...", photoFile.name);
        setPhotoUploading(true);

        try {
          const photoRef = ref(
            storage,
            `profile-photos/${user.uid}/${Date.now()}_${photoFile.name}`,
          );
          console.log("Uploading to:", photoRef.fullPath);

          await uploadBytes(photoRef, photoFile);
          console.log("Photo uploaded successfully");

          photoURL = await getDownloadURL(photoRef);
          console.log("Download URL obtained:", photoURL);

          setPhotoUploading(false);
        } catch (uploadError: any) {
          console.error("Photo upload error:", uploadError);
          setPhotoUploading(false);
          throw new Error(
            `Photo upload failed: ${uploadError.message || "Unknown error"}. Please check Firebase Storage rules.`,
          );
        }
      }

      // Update Firebase Auth profile
      console.log("Updating Firebase Auth profile...");
      await updateProfile(user, {
        displayName: profile.fullName,
        photoURL: photoURL,
      });
      console.log("Firebase Auth profile updated");

      // Update or create Firestore user document (merge: true creates if doesn't exist)
      console.log("Updating Firestore document...");
      await setDoc(
        doc(db, "users", user.uid),
        {
          fullName: profile.fullName,
          phone: profile.phone,
          photoURL: photoURL,
          updatedAt: new Date().toISOString(),
        },
        { merge: true },
      );
      console.log("Firestore document updated");

      // Update local state
      setProfile({ ...profile, photoURL });
      setPhotoFile(null);

      setProfileSuccess(true);
      setTimeout(() => setProfileSuccess(false), 3000);
      console.log("Profile save completed successfully");
    } catch (error: any) {
      console.error("Error saving profile:", error);
      alert(error.message || "Failed to save profile. Please try again.");
    } finally {
      setProfileSaving(false);
      setPhotoUploading(false);
    }
  };

  const handlePasswordChange = async () => {
    if (!user || !user.email) return;

    setPasswordError("");
    setPasswordSuccess(false);

    // Validate current password
    if (!currentPassword) {
      setPasswordError("Please enter your current password");
      return;
    }

    if (newPassword.length < 6) {
      setPasswordError("New password must be at least 6 characters");
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordError("New passwords do not match");
      return;
    }

    if (currentPassword === newPassword) {
      setPasswordError("New password must be different from current password");
      return;
    }

    setPasswordChanging(true);

    try {
      // Reauthenticate user with current password
      const credential = EmailAuthProvider.credential(
        user.email,
        currentPassword,
      );
      await reauthenticateWithCredential(user, credential);

      // Now update password
      await updatePassword(user, newPassword);

      setPasswordSuccess(true);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setTimeout(() => setPasswordSuccess(false), 3000);
    } catch (error: any) {
      console.error("Error changing password:", error);
      if (
        error.code === "auth/wrong-password" ||
        error.code === "auth/invalid-credential"
      ) {
        setPasswordError("Current password is incorrect");
      } else if (error.code === "auth/weak-password") {
        setPasswordError(
          "New password is too weak. Please use a stronger password",
        );
      } else if (error.code === "auth/requires-recent-login") {
        setPasswordError("Session expired. Please log out and log back in");
      } else {
        setPasswordError("Failed to change password. Please try again.");
      }
    } finally {
      setPasswordChanging(false);
    }
  };

  const handleForgotPassword = async () => {
    if (!user?.email) return;

    try {
      await sendPasswordResetEmail(auth, user.email);
      setResetEmailSent(true);
      setTimeout(() => setResetEmailSent(false), 5000);
    } catch (error) {
      console.error("Error sending reset email:", error);
      alert("Failed to send reset email. Please try again.");
    }
  };

  const handleNotificationsSave = async () => {
    if (!user) return;

    setNotificationsSaving(true);
    setNotificationsSuccess(false);

    try {
      await setDoc(
        doc(db, "users", user.uid),
        {
          emailAlerts: notifications.emailAlerts,
          weeklyReports: notifications.weeklyReports,
          updatedAt: new Date().toISOString(),
        },
        { merge: true },
      );

      setNotificationsSuccess(true);
      setTimeout(() => setNotificationsSuccess(false), 3000);
    } catch (error) {
      console.error("Error saving notifications:", error);
      alert("Failed to save notification settings. Please try again.");
    } finally {
      setNotificationsSaving(false);
    }
  };

  const copyReferralCode = async () => {
    if (!referralData?.referralCode) return;
    try {
      await navigator.clipboard.writeText(referralData.referralCode);
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 2000);
    } catch (error) {
      console.error("Failed to copy referral code:", error);
    }
  };

  const copyReferralLink = async () => {
    if (!referralLink) return;
    try {
      await navigator.clipboard.writeText(referralLink);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    } catch (error) {
      console.error("Failed to copy referral link:", error);
    }
  };

  const shareReferral = async () => {
    if (navigator.share && referralLink) {
      try {
        await navigator.share({
          title: "Join LinkGuard",
          text: "Check out LinkGuard - the best YouTube link monitoring tool!",
          url: referralLink,
        });
      } catch (error) {
        console.error("Error sharing:", error);
      }
    } else {
      copyReferralLink();
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Shield className="w-16 h-16 text-primary-600 mx-auto mb-4 animate-pulse" />
          <p className="text-gray-600">Loading account settings...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Unified Header */}
      <Header user={user} onLogout={handleLogout} />

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Page Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Account Settings
          </h1>
          <p className="text-gray-600">
            Manage your account preferences and settings
          </p>
        </div>

        {/* Tabs */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 mb-6">
          <div className="border-b border-gray-200">
            <nav className="flex space-x-8 px-6" aria-label="Tabs">
              <button
                onClick={() => setActiveTab("profile")}
                className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                  activeTab === "profile"
                    ? "border-primary-600 text-primary-600"
                    : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                }`}
              >
                <UserCircle className="w-5 h-5 inline mr-2" />
                Profile Info
              </button>
              <button
                onClick={() => setActiveTab("security")}
                className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                  activeTab === "security"
                    ? "border-primary-600 text-primary-600"
                    : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                }`}
              >
                <Lock className="w-5 h-5 inline mr-2" />
                Security
              </button>
              <button
                onClick={() => setActiveTab("notifications")}
                className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                  activeTab === "notifications"
                    ? "border-primary-600 text-primary-600"
                    : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                }`}
              >
                <Bell className="w-5 h-5 inline mr-2" />
                Notifications
              </button>
              <button
                onClick={() => setActiveTab("billing")}
                className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                  activeTab === "billing"
                    ? "border-primary-600 text-primary-600"
                    : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                }`}
              >
                <CreditCard className="w-5 h-5 inline mr-2" />
                Billing
              </button>
              <button
                onClick={() => setActiveTab("referral")}
                className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                  activeTab === "referral"
                    ? "border-primary-600 text-primary-600"
                    : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                }`}
              >
                <Users className="w-5 h-5 inline mr-2" />
                Referral
              </button>
            </nav>
          </div>

          {/* Tab Content */}
          <div className="p-6">
            {/* Profile Info Tab */}
            {activeTab === "profile" && (
              <div className="space-y-6">
                {/* Referral Callout - if user was referred */}
                {referralData?.referredBy && referralData?.referredByName && (
                  <div className="bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-lg p-4">
                    <div className="flex items-start space-x-3">
                      <Users className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                      <div className="flex-1">
                        <p className="text-sm font-medium text-green-900">
                          You were referred by{" "}
                          <span className="font-bold">
                            {referralData.referredByName}
                          </span>
                        </p>
                        <p className="text-xs text-green-700 mt-1">
                          View your referral details and invite your own friends
                          in the{" "}
                          <button
                            onClick={() => setActiveTab("referral")}
                            className="font-semibold underline hover:text-green-800"
                          >
                            Referral tab
                          </button>
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Profile Photo Section */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-3">
                    Profile Photo
                  </label>
                  <div className="flex items-center space-x-6">
                    {/* Photo Preview */}
                    <div className="relative">
                      <div className="w-24 h-24 rounded-full overflow-hidden bg-gray-100 border-2 border-gray-300">
                        {photoPreview ? (
                          <img
                            src={photoPreview}
                            alt="Profile"
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center bg-primary-100">
                            <UserCircle className="w-16 h-16 text-primary-600" />
                          </div>
                        )}
                      </div>
                      {photoUploading && (
                        <div className="absolute inset-0 bg-black bg-opacity-50 rounded-full flex items-center justify-center">
                          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
                        </div>
                      )}
                    </div>

                    {/* Upload Button */}
                    <div className="flex-1">
                      <input
                        type="file"
                        id="photo-upload"
                        accept="image/*"
                        onChange={handlePhotoChange}
                        className="hidden"
                      />
                      <label
                        htmlFor="photo-upload"
                        className="inline-flex items-center space-x-2 px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 cursor-pointer transition-colors"
                      >
                        <Camera className="w-4 h-4 text-gray-600" />
                        <span className="text-sm font-medium text-gray-700">
                          {photoPreview ? "Change Photo" : "Upload Photo"}
                        </span>
                      </label>
                      <p className="text-xs text-gray-500 mt-2">
                        JPG, PNG or GIF. Max size 5MB.
                      </p>
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Full Name
                  </label>
                  <input
                    type="text"
                    value={profile.fullName}
                    onChange={(e) =>
                      setProfile({ ...profile, fullName: e.target.value })
                    }
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                    placeholder="Enter your full name"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Email Address
                  </label>
                  <input
                    type="email"
                    value={profile.email}
                    disabled
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-500 cursor-not-allowed"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Email cannot be changed
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Phone Number
                  </label>
                  <input
                    type="tel"
                    value={profile.phone}
                    onChange={(e) =>
                      setProfile({ ...profile, phone: e.target.value })
                    }
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                    placeholder="Enter your phone number"
                  />
                </div>

                {/* My Info Section - Referral Details */}
                {referralData?.referredBy && referralData?.referredByName && (
                  <div className="border-t border-gray-200 pt-6 mt-6">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">
                      My Info
                    </h3>

                    <div className="bg-gradient-to-br from-green-50 to-emerald-50 border-2 border-green-200 rounded-xl p-6 space-y-4">
                      <div className="flex items-center space-x-3 mb-4">
                        <div className="w-12 h-12 bg-green-500 rounded-full flex items-center justify-center">
                          <Users className="w-6 h-6 text-white" />
                        </div>
                        <div>
                          <h4 className="text-lg font-semibold text-green-900">
                            Referral Information
                          </h4>
                          <p className="text-sm text-green-700">
                            How you joined LinkGuard
                          </p>
                        </div>
                      </div>

                      <div className="space-y-3">
                        {/* Referred By */}
                        <div className="bg-white rounded-lg p-4 border border-green-200">
                          <p className="text-xs font-medium text-gray-500 uppercase mb-1">
                            Referred By
                          </p>
                          <p className="text-lg font-bold text-gray-900">
                            {referralData.referredByName}
                          </p>
                          <p className="text-xs text-gray-500 mt-1">
                            User ID: {referralData.referredBy.substring(0, 8)}
                            ...
                          </p>
                        </div>

                        {/* Referral URL Used */}
                        <div className="bg-white rounded-lg p-4 border border-green-200">
                          <p className="text-xs font-medium text-gray-500 uppercase mb-2">
                            Referral URL You Used
                          </p>
                          <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
                            <p className="text-sm font-mono text-gray-700 break-all">
                              {typeof window !== "undefined"
                                ? `${window.location.origin}/signup?ref=${referralData.referredBy.substring(0, 8)}`
                                : `[Your site]/signup?ref=...`}
                            </p>
                          </div>
                          <p className="text-xs text-gray-500 mt-2">
                            This is the link you used to sign up
                          </p>
                        </div>

                        {/* Benefits Info */}
                        <div className="bg-green-100 rounded-lg p-4 border border-green-300">
                          <div className="flex items-start space-x-2">
                            <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                            <div>
                              <p className="text-sm font-medium text-green-900">
                                Thank you for joining through a referral!
                              </p>
                              <p className="text-xs text-green-700 mt-1">
                                You're now part of our growing community. Share
                                your own referral link to invite others!
                              </p>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                <div className="flex items-center space-x-4">
                  <button
                    onClick={handleProfileSave}
                    disabled={profileSaving}
                    className="btn-primary flex items-center space-x-2"
                  >
                    <Save className="w-4 h-4" />
                    <span>{profileSaving ? "Saving..." : "Save Changes"}</span>
                  </button>

                  {profileSuccess && (
                    <div className="flex items-center space-x-2 text-green-600">
                      <Check className="w-5 h-5" />
                      <span className="text-sm font-medium">
                        Profile updated successfully!
                      </span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Security Tab */}
            {activeTab === "security" && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">
                    Change Password
                  </h3>

                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Current Password
                      </label>
                      <input
                        type="password"
                        value={currentPassword}
                        onChange={(e) => setCurrentPassword(e.target.value)}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                        placeholder="Enter current password"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        New Password
                      </label>
                      <input
                        type="password"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                        placeholder="Enter new password"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Confirm New Password
                      </label>
                      <input
                        type="password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                        placeholder="Confirm new password"
                      />
                    </div>

                    {passwordError && (
                      <div className="flex items-center space-x-2 text-red-600 bg-red-50 p-3 rounded-lg">
                        <AlertCircle className="w-5 h-5" />
                        <span className="text-sm">{passwordError}</span>
                      </div>
                    )}

                    {passwordSuccess && (
                      <div className="flex items-center space-x-2 text-green-600 bg-green-50 p-3 rounded-lg">
                        <Check className="w-5 h-5" />
                        <span className="text-sm">
                          Password changed successfully!
                        </span>
                      </div>
                    )}

                    <div className="flex items-center space-x-4">
                      <button
                        onClick={handlePasswordChange}
                        disabled={
                          passwordChanging ||
                          !currentPassword ||
                          !newPassword ||
                          !confirmPassword
                        }
                        className="btn-primary"
                      >
                        {passwordChanging ? "Changing..." : "Change Password"}
                      </button>
                    </div>
                  </div>
                </div>

                <div className="border-t border-gray-200 pt-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">
                    Forgot Password
                  </h3>
                  <p className="text-sm text-gray-600 mb-4">
                    Send a password reset link to your email address
                  </p>

                  {resetEmailSent && (
                    <div className="flex items-center space-x-2 text-green-600 bg-green-50 p-3 rounded-lg mb-4">
                      <Check className="w-5 h-5" />
                      <span className="text-sm">
                        Password reset email sent! Check your inbox.
                      </span>
                    </div>
                  )}

                  <button
                    onClick={handleForgotPassword}
                    className="btn-secondary"
                  >
                    Send Reset Email
                  </button>
                </div>
              </div>
            )}

            {/* Notifications Tab */}
            {activeTab === "notifications" && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">
                    Email Preferences
                  </h3>

                  <div className="space-y-4">
                    <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                      <div>
                        <p className="font-medium text-gray-900">
                          Email Alerts
                        </p>
                        <p className="text-sm text-gray-600">
                          Receive alerts for broken links and scan completions
                        </p>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={notifications.emailAlerts}
                          onChange={(e) =>
                            setNotifications({
                              ...notifications,
                              emailAlerts: e.target.checked,
                            })
                          }
                          className="sr-only peer"
                        />
                        <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-600"></div>
                      </label>
                    </div>

                    <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                      <div>
                        <p className="font-medium text-gray-900">
                          Weekly Reports
                        </p>
                        <p className="text-sm text-gray-600">
                          Receive weekly summary of your link health
                        </p>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={notifications.weeklyReports}
                          onChange={(e) =>
                            setNotifications({
                              ...notifications,
                              weeklyReports: e.target.checked,
                            })
                          }
                          className="sr-only peer"
                        />
                        <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-600"></div>
                      </label>
                    </div>
                  </div>

                  <div className="flex items-center space-x-4 mt-6">
                    <button
                      onClick={handleNotificationsSave}
                      disabled={notificationsSaving}
                      className="btn-primary flex items-center space-x-2"
                    >
                      <Save className="w-4 h-4" />
                      <span>
                        {notificationsSaving ? "Saving..." : "Save Preferences"}
                      </span>
                    </button>

                    {notificationsSuccess && (
                      <div className="flex items-center space-x-2 text-green-600">
                        <Check className="w-5 h-5" />
                        <span className="text-sm font-medium">
                          Preferences saved!
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Billing Tab */}
            {activeTab === "billing" && (
              <div className="space-y-6">
                {/* Current Plan Section */}
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">
                    Current Plan
                  </h3>

                  <div className="bg-gradient-to-br from-primary-50 to-primary-100 p-6 rounded-xl border border-primary-200">
                    <div className="flex items-center justify-between mb-6">
                      <div>
                        <p className="text-2xl font-bold text-primary-900">
                          {billing.currentPlan}
                        </p>
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium mt-1 ${
                          billing.status === "Active" 
                            ? "bg-green-100 text-green-800" 
                            : billing.status === "Trial" 
                              ? "bg-yellow-100 text-yellow-800"
                              : "bg-gray-100 text-gray-800"
                        }`}>
                          {billing.status}
                        </span>
                      </div>
                      <div className="w-16 h-16 bg-primary-600 rounded-full flex items-center justify-center shadow-lg">
                        <CreditCard className="w-8 h-8 text-white" />
                      </div>
                    </div>

                    {/* Subscription Dates */}
                    <div className="bg-white bg-opacity-60 rounded-lg p-4 mb-4">
                      <h4 className="text-sm font-medium text-primary-900 mb-3">Subscription Period</h4>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="flex items-start space-x-3">
                          <div className="p-2 bg-primary-100 rounded-lg">
                            <Calendar className="w-4 h-4 text-primary-600" />
                          </div>
                          <div>
                            <p className="text-xs text-primary-600 font-medium">Started On</p>
                            <p className="text-sm font-semibold text-primary-900">{billing.startDate}</p>
                          </div>
                        </div>
                        <div className="flex items-start space-x-3">
                          <div className="p-2 bg-primary-100 rounded-lg">
                            <Clock className="w-4 h-4 text-primary-600" />
                          </div>
                          <div>
                            <p className="text-xs text-primary-600 font-medium">Renews On</p>
                            <p className="text-sm font-semibold text-primary-900">{billing.renewalDate}</p>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Billing Details */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="flex items-center space-x-2 text-primary-800">
                        <Shield className="w-4 h-4" />
                        <span className="text-sm">
                          Billing Cycle:{" "}
                          <span className="font-medium">
                            {billing.billingCycle === "yearly" ? "Yearly" : "Monthly"}
                          </span>
                        </span>
                      </div>
                      <div className="flex items-center space-x-2 text-primary-800">
                        <CreditCard className="w-4 h-4" />
                        <span className="text-sm">
                          Next Charge:{" "}
                          <span className="font-medium">{billing.nextCharge}</span>
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <button
                      onClick={() => router.push("/pricing")}
                      className="btn-primary"
                    >
                      Upgrade Plan
                    </button>

                    <button
                      onClick={generateInvoicePDF}
                      className="btn-secondary flex items-center justify-center space-x-2"
                    >
                      <Download className="w-4 h-4" />
                      <span>Download Invoice</span>
                    </button>
                  </div>
                </div>

                {/* Plan Features Section */}
                {planFeatures && (
                  <div className="border-t border-gray-200 pt-6">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">
                      Plan Features & Limits
                    </h3>
                    <div className="bg-gray-50 rounded-xl p-6">
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                        <div className="bg-white rounded-lg p-4 border border-gray-200">
                          <div className="flex items-center space-x-2 mb-2">
                            <Users className="w-5 h-5 text-primary-600" />
                            <span className="text-sm font-medium text-gray-700">Channels</span>
                          </div>
                          <p className="text-xl font-bold text-gray-900">
                            {planFeatures.maxChannels === 'unlimited' ? 'Unlimited' : planFeatures.maxChannels}
                          </p>
                          <p className="text-xs text-gray-500 mt-1">{planFeatures.features?.channels || 'Channels allowed'}</p>
                        </div>
                        
                        <div className="bg-white rounded-lg p-4 border border-gray-200">
                          <div className="flex items-center space-x-2 mb-2">
                            <Shield className="w-5 h-5 text-primary-600" />
                            <span className="text-sm font-medium text-gray-700">Scans</span>
                          </div>
                          <p className="text-xl font-bold text-gray-900">
                            {planFeatures.maxScans === 'unlimited' ? 'Unlimited' : planFeatures.maxScans}
                          </p>
                          <p className="text-xs text-gray-500 mt-1">{planFeatures.features?.scans || 'Scans per month'}</p>
                        </div>
                        
                        <div className="bg-white rounded-lg p-4 border border-gray-200">
                          <div className="flex items-center space-x-2 mb-2">
                            <Eye className="w-5 h-5 text-primary-600" />
                            <span className="text-sm font-medium text-gray-700">Videos per Scan</span>
                          </div>
                          <p className="text-xl font-bold text-gray-900">
                            {planFeatures.maxVideosPerScan === 'unlimited' ? 'Unlimited' : planFeatures.maxVideosPerScan}
                          </p>
                          <p className="text-xs text-gray-500 mt-1">{planFeatures.features?.videos || 'Videos per scan'}</p>
                        </div>
                        
                        <div className="bg-white rounded-lg p-4 border border-gray-200">
                          <div className="flex items-center space-x-2 mb-2">
                            <TrendingUp className="w-5 h-5 text-primary-600" />
                            <span className="text-sm font-medium text-gray-700">Bulk Scan</span>
                          </div>
                          <p className="text-xl font-bold text-gray-900">
                            {planFeatures.maxBulkVideosPerRun === 'unlimited' ? 'Unlimited' : planFeatures.maxBulkVideosPerRun}
                          </p>
                          <p className="text-xs text-gray-500 mt-1">{planFeatures.features?.bulkScan || 'Videos per bulk scan'}</p>
                        </div>
                        
                        <div className="bg-white rounded-lg p-4 border border-gray-200">
                          <div className="flex items-center space-x-2 mb-2">
                            <Download className="w-5 h-5 text-primary-600" />
                            <span className="text-sm font-medium text-gray-700">Channel Extracts</span>
                          </div>
                          <p className="text-xl font-bold text-gray-900">
                            {planFeatures.maxChannelExtracts === 'unlimited' ? 'Unlimited' : planFeatures.maxChannelExtracts}
                          </p>
                          <p className="text-xs text-gray-500 mt-1">{planFeatures.features?.extract || 'Extracts allowed'}</p>
                        </div>
                        
                        <div className="bg-white rounded-lg p-4 border border-gray-200">
                          <div className="flex items-center space-x-2 mb-2">
                            <Bell className="w-5 h-5 text-primary-600" />
                            <span className="text-sm font-medium text-gray-700">Support</span>
                          </div>
                          <p className="text-sm font-semibold text-gray-900">
                            {planFeatures.features?.support || 'Email Support'}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Payment Method Section */}
                <div className="border-t border-gray-200 pt-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">
                    Payment Method
                  </h3>
                  <p className="text-sm text-gray-600 mb-4">
                    Manage your payment methods and billing information
                  </p>
                  <button className="btn-secondary">
                    Update Payment Method
                  </button>
                </div>

                {/* Billing History Section */}
                <div className="border-t border-gray-200 pt-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold text-gray-900">
                      Billing History
                    </h3>
                    {billing.billingHistory.length > 0 && (
                      <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded-full">
                        {billing.billingHistory.length} transaction{billing.billingHistory.length !== 1 ? 's' : ''}
                      </span>
                    )}
                  </div>

                  {billing.billingHistory.length > 0 ? (
                    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
                      {/* Table Header */}
                      <div className="hidden sm:grid grid-cols-12 gap-4 px-4 py-3 bg-gray-50 border-b border-gray-200 text-xs font-medium text-gray-500 uppercase tracking-wider">
                        <div className="col-span-3">Date</div>
                        <div className="col-span-4">Description</div>
                        <div className="col-span-2">Amount</div>
                        <div className="col-span-2">Status</div>
                        <div className="col-span-1">Invoice</div>
                      </div>

                      {/* Scrollable History List - increased height for more visibility */}
                      <div className="max-h-96 overflow-y-auto custom-scrollbar divide-y divide-gray-100">
                        {billing.billingHistory.map((item) => (
                          <div
                            key={item.id}
                            className="grid grid-cols-1 sm:grid-cols-12 gap-2 sm:gap-4 px-4 py-4 hover:bg-gray-50 transition-colors"
                          >
                            {/* Date */}
                            <div className="sm:col-span-3">
                              <p className="text-sm text-gray-900">
                                {new Date(item.date).toLocaleDateString("en-US", {
                                  year: "numeric",
                                  month: "short",
                                  day: "numeric"
                                })}
                              </p>
                              <p className="text-xs text-gray-500 sm:hidden">{item.description}</p>
                            </div>

                            {/* Description (hidden on mobile, shown in date section) */}
                            <div className="hidden sm:block sm:col-span-4">
                              <p className="text-sm text-gray-900">{item.description}</p>
                            </div>

                            {/* Amount */}
                            <div className="sm:col-span-2">
                              <p className="text-sm font-medium text-gray-900">
                                ${item.amount.toFixed(2)}
                              </p>
                            </div>

                            {/* Status */}
                            <div className="sm:col-span-2">
                              <span
                                className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                                  item.status === "paid"
                                    ? "bg-green-100 text-green-800"
                                    : item.status === "pending"
                                      ? "bg-yellow-100 text-yellow-800"
                                      : item.status === "refunded"
                                        ? "bg-blue-100 text-blue-800"
                                        : "bg-red-100 text-red-800"
                                }`}
                              >
                                {item.status.charAt(0).toUpperCase() + item.status.slice(1)}
                              </span>
                            </div>

                            {/* Invoice Download */}
                            <div className="sm:col-span-1">
                              {item.invoiceId && (
                                <button
                                  onClick={generateInvoicePDF}
                                  className="p-1.5 text-gray-400 hover:text-primary-600 hover:bg-primary-50 rounded-lg transition-colors"
                                  title="Download Invoice"
                                >
                                  <Download className="w-4 h-4" />
                                </button>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-12 bg-gray-50 rounded-xl border-2 border-dashed border-gray-200">
                      <CreditCard className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                      <p className="text-gray-500 font-medium">No billing history yet</p>
                      <p className="text-sm text-gray-400 mt-1">
                        Your billing transactions will appear here
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Referral Tab */}
            {activeTab === "referral" && (
              <div className="space-y-8">
                {/* Modern Hero Section */}
                <div className="relative overflow-hidden bg-gradient-to-br from-primary-600 via-purple-600 to-pink-500 rounded-2xl p-8 shadow-2xl">
                  <div className="absolute inset-0 bg-black opacity-10"></div>
                  <div className="absolute top-0 right-0 w-64 h-64 bg-white opacity-10 rounded-full -mr-32 -mt-32"></div>
                  <div className="absolute bottom-0 left-0 w-48 h-48 bg-white opacity-10 rounded-full -ml-24 -mb-24"></div>

                  <div className="relative z-10 text-center text-white">
                    <div className="inline-flex items-center justify-center w-20 h-20 bg-white bg-opacity-20 backdrop-blur-lg rounded-full mb-4 shadow-xl">
                      <Users className="w-10 h-10 text-white" />
                    </div>
                    <h3 className="text-3xl md:text-4xl font-bold mb-3">
                      Share & Earn Rewards
                    </h3>
                    <p className="text-lg text-white text-opacity-90 max-w-2xl mx-auto mb-6">
                      Invite friends to LinkGuard and earn{" "}
                      <span className="font-bold">{commissionSettings.monthlyRate}% on monthly</span> and{" "}
                      <span className="font-bold">{commissionSettings.yearlyRate}% on annual</span>{" "}
                      subscriptions
                    </p>

                    {/* Quick Stats Bar */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
                      <div className="bg-white bg-opacity-20 backdrop-blur-lg rounded-xl p-4">
                        <p className="text-2xl font-bold">
                          {referralData?.referralCount || 0}
                        </p>
                        <p className="text-sm text-white text-opacity-80">
                          Total Referrals
                        </p>
                      </div>
                      <div className="bg-white bg-opacity-20 backdrop-blur-lg rounded-xl p-4">
                        <p className="text-2xl font-bold">
                          ${referralData?.totalEarnings.toFixed(2) || "0.00"}
                        </p>
                        <p className="text-sm text-white text-opacity-80">
                          Total Earned
                        </p>
                      </div>
                      <div className="bg-white bg-opacity-20 backdrop-blur-lg rounded-xl p-4">
                        <p className="text-2xl font-bold">
                          ${referralData?.availableBalance.toFixed(2) || "0.00"}
                        </p>
                        <p className="text-sm text-white text-opacity-80">
                          Available
                        </p>
                      </div>
                      <div className="bg-white bg-opacity-20 backdrop-blur-lg rounded-xl p-4">
                        <p className="text-2xl font-bold">
                          ${referralData?.pendingBalance.toFixed(2) || "0.00"}
                        </p>
                        <p className="text-sm text-white text-opacity-80">
                          Pending
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                {referralData ? (
                  <>
                    {/* Main Content Grid */}
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                      {/* Left Column - Sharing Tools */}
                      <div className="lg:col-span-2 space-y-6">
                        {/* Referral Code Card */}
                        <div className="bg-white rounded-2xl shadow-lg border border-gray-200 overflow-hidden hover:shadow-xl transition-shadow">
                          <div className="bg-gradient-to-r from-primary-50 to-purple-50 px-6 py-4 border-b border-gray-200">
                            <div className="flex items-center space-x-2">
                              <Shield className="w-5 h-5 text-primary-600" />
                              <h4 className="text-lg font-bold text-gray-900">
                                Your Referral Code
                              </h4>
                            </div>
                          </div>
                          <div className="p-6">
                            <p className="text-sm text-gray-600 mb-4">
                              Share this unique code with friends. They can
                              enter it during signup.
                            </p>
                            <div className="flex items-center gap-3">
                              <div className="flex-1 relative">
                                <div className="bg-gradient-to-br from-gray-50 to-gray-100 border-2 border-gray-300 rounded-xl p-4 text-center">
                                  <p className="text-xs text-gray-500 mb-1">
                                    CODE
                                  </p>
                                  <p className="text-3xl font-black font-mono text-primary-600 tracking-widest">
                                    {referralData.referralCode}
                                  </p>
                                </div>
                              </div>
                              <button
                                onClick={copyReferralCode}
                                className="px-6 py-4 bg-gradient-to-r from-primary-600 to-primary-700 hover:from-primary-700 hover:to-primary-800 text-white rounded-xl font-semibold transition-all shadow-lg hover:shadow-xl flex items-center space-x-2"
                              >
                                {copiedCode ? (
                                  <>
                                    <Check className="w-5 h-5" />
                                    <span>Copied!</span>
                                  </>
                                ) : (
                                  <>
                                    <Copy className="w-5 h-5" />
                                    <span>Copy</span>
                                  </>
                                )}
                              </button>
                            </div>
                          </div>
                        </div>

                        {/* Referral Link Card */}
                        <div className="bg-white rounded-2xl shadow-lg border border-gray-200 overflow-hidden hover:shadow-xl transition-shadow">
                          <div className="bg-gradient-to-r from-purple-50 to-pink-50 px-6 py-4 border-b border-gray-200">
                            <div className="flex items-center space-x-2">
                              <LinkIcon className="w-5 h-5 text-purple-600" />
                              <h4 className="text-lg font-bold text-gray-900">
                                Your Referral Link
                              </h4>
                            </div>
                          </div>
                          <div className="p-6">
                            <p className="text-sm text-gray-600 mb-4">
                              Share this link directly. The referral code is
                              automatically applied.
                            </p>
                            <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 mb-4">
                              <p className="text-xs text-gray-500 mb-2">
                                REFERRAL URL
                              </p>
                              <p className="text-sm font-mono text-gray-800 break-all leading-relaxed">
                                {referralLink}
                              </p>
                            </div>
                            <div className="flex gap-3">
                              <button
                                onClick={copyReferralLink}
                                className="flex-1 px-6 py-3 bg-gradient-to-r from-primary-600 to-primary-700 hover:from-primary-700 hover:to-primary-800 text-white rounded-xl font-semibold transition-all shadow-md hover:shadow-lg flex items-center justify-center space-x-2"
                              >
                                {copiedLink ? (
                                  <>
                                    <Check className="w-5 h-5" />
                                    <span>Link Copied!</span>
                                  </>
                                ) : (
                                  <>
                                    <Copy className="w-5 h-5" />
                                    <span>Copy Link</span>
                                  </>
                                )}
                              </button>
                              <button
                                onClick={shareReferral}
                                className="px-6 py-3 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white rounded-xl font-semibold transition-all shadow-md hover:shadow-lg flex items-center space-x-2"
                              >
                                <Share2 className="w-5 h-5" />
                                <span>Share</span>
                              </button>
                            </div>
                          </div>
                        </div>

                        {/* How It Works Card */}
                        <div className="bg-gradient-to-br from-green-50 via-emerald-50 to-teal-50 rounded-2xl border-2 border-green-200 shadow-lg overflow-hidden">
                          <div className="px-6 py-4 border-b border-green-200 bg-white bg-opacity-50">
                            <h4 className="text-lg font-bold text-gray-900 flex items-center space-x-2">
                              <AlertCircle className="w-5 h-5 text-green-600" />
                              <span>How It Works</span>
                            </h4>
                          </div>
                          <div className="p-6 space-y-4">
                            <div className="flex items-start space-x-4">
                              <div className="flex-shrink-0 w-10 h-10 bg-gradient-to-br from-green-500 to-emerald-600 rounded-full flex items-center justify-center shadow-lg">
                                <span className="text-white font-bold text-lg">
                                  1
                                </span>
                              </div>
                              <div className="flex-1">
                                <p className="font-semibold text-gray-900 mb-1">
                                  Share Your Link or Code
                                </p>
                                <p className="text-sm text-gray-600">
                                  Send your referral link or code to friends via
                                  email, social media, or messaging apps.
                                </p>
                              </div>
                            </div>
                            <div className="flex items-start space-x-4">
                              <div className="flex-shrink-0 w-10 h-10 bg-gradient-to-br from-green-500 to-emerald-600 rounded-full flex items-center justify-center shadow-lg">
                                <span className="text-white font-bold text-lg">
                                  2
                                </span>
                              </div>
                              <div className="flex-1">
                                <p className="font-semibold text-gray-900 mb-1">
                                  They Sign Up Using Your Link
                                </p>
                                <p className="text-sm text-gray-600">
                                  Your friends create their LinkGuard account
                                  using your referral link or by entering your
                                  code.
                                </p>
                              </div>
                            </div>
                            <div className="flex items-start space-x-4">
                              <div className="flex-shrink-0 w-10 h-10 bg-gradient-to-br from-green-500 to-emerald-600 rounded-full flex items-center justify-center shadow-lg">
                                <span className="text-white font-bold text-lg">
                                  3
                                </span>
                              </div>
                              <div className="flex-1">
                                <p className="font-semibold text-gray-900 mb-1">
                                  Earn Commission When They Subscribe
                                </p>
                                <p className="text-sm text-gray-600">
                                  Get{" "}
                                  <span className="font-bold text-green-700">
                                    {commissionSettings.monthlyRate}% on monthly
                                  </span>{" "}
                                  and{" "}
                                  <span className="font-bold text-green-700">
                                    {commissionSettings.yearlyRate}% on annual
                                  </span>{" "}
                                  subscriptions!
                                </p>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Right Column - Earnings Sidebar */}
                      <div className="space-y-6">
                        {/* Earnings Summary Card */}
                        <div className="bg-white rounded-2xl shadow-lg border border-gray-200 overflow-hidden sticky top-6">
                          <div className="bg-gradient-to-r from-purple-600 to-pink-600 px-6 py-4">
                            <div className="flex items-center justify-between text-white">
                              <div className="flex items-center space-x-2">
                                <TrendingUp className="w-5 h-5" />
                                <h4 className="text-lg font-bold">Earnings</h4>
                              </div>
                              {referralData.availableBalance >= commissionSettings.minWithdrawal && (
                                <button
                                  onClick={() => setShowWithdrawalModal(true)}
                                  className="px-4 py-2 bg-white text-purple-600 rounded-lg font-semibold text-sm hover:bg-gray-100 transition-colors shadow-md"
                                >
                                  Withdraw
                                </button>
                              )}
                            </div>
                          </div>
                          <div className="p-6 space-y-4">
                            <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-xl p-4 border border-green-200">
                              <p className="text-xs font-semibold text-green-600 uppercase mb-1">
                                Available Balance
                              </p>
                              <p className="text-3xl font-black text-green-900">
                                ${referralData.availableBalance.toFixed(2)}
                              </p>
                              <p className="text-xs text-green-700 mt-1">
                                {referralData.availableBalance >= commissionSettings.minWithdrawal 
                                  ? "Ready to withdraw" 
                                  : `Min. $${commissionSettings.minWithdrawal} to withdraw`}
                              </p>
                            </div>

                            <div className="bg-gradient-to-br from-yellow-50 to-amber-50 rounded-xl p-4 border border-yellow-200">
                              <p className="text-xs font-semibold text-yellow-600 uppercase mb-1">
                                Pending Balance
                              </p>
                              <p className="text-2xl font-bold text-yellow-900">
                                ${referralData.pendingBalance.toFixed(2)}
                              </p>
                              <p className="text-xs text-yellow-700 mt-1">
                                Processing ({commissionSettings.pendingDays} days)
                              </p>
                            </div>

                            <div className="bg-gradient-to-br from-blue-50 to-cyan-50 rounded-xl p-4 border border-blue-200">
                              <p className="text-xs font-semibold text-blue-600 uppercase mb-1">
                                Total Withdrawn
                              </p>
                              <p className="text-2xl font-bold text-blue-900">
                                ${referralData.totalWithdrawn.toFixed(2)}
                              </p>
                              <p className="text-xs text-blue-700 mt-1">
                                All-time
                              </p>
                            </div>

                            <div className="pt-4 border-t border-gray-200">
                              <p className="text-xs font-semibold text-gray-600 uppercase mb-3">
                                Commission Rates
                              </p>
                              <div className="space-y-2">
                                <div className="flex items-center justify-between bg-gray-50 rounded-lg p-3">
                                  <span className="text-sm text-gray-700">
                                    Monthly Plans
                                  </span>
                                  <span className="text-sm font-bold text-primary-600">
                                    {commissionSettings.monthlyRate}%
                                  </span>
                                </div>
                                <div className="flex items-center justify-between bg-gray-50 rounded-lg p-3">
                                  <span className="text-sm text-gray-700">
                                    Annual Plans
                                  </span>
                                  <span className="text-sm font-bold text-green-600">
                                    {commissionSettings.yearlyRate}%
                                  </span>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Full Width Sections Below */}
                    <div className="space-y-6">
                      {/* All Earnings */}
                      {referralData.earnings &&
                        referralData.earnings.length > 0 && (
                          <div className="bg-white rounded-2xl shadow-lg border border-gray-200 overflow-hidden">
                            <div className="bg-gradient-to-r from-green-50 to-emerald-50 px-6 py-4 border-b border-gray-200">
                              <div className="flex items-center justify-between">
                                <h4 className="text-lg font-bold text-gray-900 flex items-center space-x-2">
                                  <Gift className="w-5 h-5 text-green-600" />
                                  <span>Earnings History</span>
                                </h4>
                                <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full font-medium">
                                  {referralData.earnings.length} earning{referralData.earnings.length !== 1 ? 's' : ''}
                                </span>
                              </div>
                            </div>
                            <div className="p-6">
                              {/* Scrollable earnings container */}
                              <div className="max-h-96 overflow-y-auto custom-scrollbar space-y-3 pr-2">
                                {referralData.earnings.map((earning, index) => (
                                    <div
                                      key={index}
                                      className="flex items-center justify-between p-4 bg-gradient-to-r from-gray-50 to-gray-100 rounded-xl hover:from-gray-100 hover:to-gray-200 transition-all"
                                    >
                                      <div className="flex items-center space-x-4">
                                        <div className="w-12 h-12 bg-gradient-to-br from-green-500 to-emerald-600 rounded-full flex items-center justify-center shadow-lg flex-shrink-0">
                                          <span className="text-lg font-bold text-white">
                                            {earning.userName
                                              .charAt(0)
                                              .toUpperCase()}
                                          </span>
                                        </div>
                                        <div className="min-w-0">
                                          <p className="font-semibold text-gray-900 truncate">
                                            {earning.userName}
                                          </p>
                                          <p className="text-sm text-gray-600">
                                            <span className="font-medium">
                                              {earning.subscriptionType ===
                                              "yearly"
                                                ? "Annual"
                                                : "Monthly"}
                                            </span>{" "}
                                            subscription - $
                                            {earning.amount.toFixed(2)}
                                          </p>
                                          {earning.date && (
                                            <p className="text-xs text-gray-400 mt-0.5">
                                              {new Date(earning.date).toLocaleDateString("en-US", {
                                                year: "numeric",
                                                month: "short",
                                                day: "numeric"
                                              })}
                                            </p>
                                          )}
                                        </div>
                                      </div>
                                      <div className="text-right flex-shrink-0 ml-4">
                                        <p className="text-lg font-bold text-green-600">
                                          +${earning.commission.toFixed(2)}
                                        </p>
                                        <span
                                          className={`inline-block text-xs px-3 py-1 rounded-full font-semibold ${
                                            earning.status === "completed"
                                              ? "bg-green-100 text-green-700"
                                              : "bg-yellow-100 text-yellow-700"
                                          }`}
                                        >
                                          {earning.status === "completed"
                                            ? "Available"
                                            : "Pending"}
                                        </span>
                                        {earning.status === "pending" && earning.releaseDate && (
                                          <p className="text-xs text-gray-500 mt-1">
                                            Available {new Date(earning.releaseDate) <= new Date() 
                                              ? "soon" 
                                              : `in ${Math.ceil((new Date(earning.releaseDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24))} days`}
                                          </p>
                                        )}
                                      </div>
                                    </div>
                                  ))}
                              </div>
                            </div>
                          </div>
                        )}

                      {/* No Earnings Yet */}
                      {(!referralData.earnings ||
                        referralData.earnings.length === 0) && (
                        <div className="bg-gradient-to-br from-gray-50 to-gray-100 rounded-2xl border-2 border-dashed border-gray-300 p-12 text-center">
                          <div className="inline-flex items-center justify-center w-16 h-16 bg-white rounded-full shadow-lg mb-4">
                            <Gift className="w-8 h-8 text-gray-400" />
                          </div>
                          <h4 className="text-xl font-bold text-gray-900 mb-2">
                            No Earnings Yet
                          </h4>
                          <p className="text-gray-600 max-w-md mx-auto">
                            Start earning commissions when your referrals
                            subscribe! You'll earn{" "}
                            <span className="font-bold text-primary-600">
                              {commissionSettings.monthlyRate}% on monthly
                            </span>{" "}
                            and{" "}
                            <span className="font-bold text-green-600">
                              {commissionSettings.yearlyRate}% on annual
                            </span>{" "}
                            plans.
                          </p>
                        </div>
                      )}

                      {/* Earnings Breakdown - Hidden */}
                      <div className="hidden bg-white border-2 border-gray-200 rounded-xl p-6 shadow-sm">
                        <div className="flex items-center justify-between mb-4">
                          <h4 className="text-lg font-semibold text-gray-900 flex items-center space-x-2">
                            <TrendingUp className="w-5 h-5 text-green-600" />
                            <span>Earnings Dashboard</span>
                          </h4>
                          {referralData.availableBalance >= commissionSettings.minWithdrawal && (
                            <button
                              onClick={() => setShowWithdrawalModal(true)}
                              className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition-colors flex items-center space-x-2"
                            >
                              <Download className="w-4 h-4" />
                              <span>Withdraw</span>
                            </button>
                          )}
                        </div>

                        {/* Balance Cards */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                          <div className="bg-gradient-to-br from-green-50 to-emerald-50 p-4 rounded-lg border border-green-200">
                            <p className="text-xs font-medium text-green-600 uppercase mb-1">
                              Available Balance
                            </p>
                            <p className="text-2xl font-bold text-green-900">
                              ${referralData.availableBalance.toFixed(2)}
                            </p>
                            <p className="text-xs text-green-700 mt-1">
                              Ready to withdraw
                            </p>
                          </div>

                          <div className="bg-gradient-to-br from-yellow-50 to-amber-50 p-4 rounded-lg border border-yellow-200">
                            <p className="text-xs font-medium text-yellow-600 uppercase mb-1">
                              Pending Balance
                            </p>
                            <p className="text-2xl font-bold text-yellow-900">
                              ${referralData.pendingBalance.toFixed(2)}
                            </p>
                            <p className="text-xs text-yellow-700 mt-1">
                              Processing (7 days)
                            </p>
                          </div>

                          <div className="bg-gradient-to-br from-blue-50 to-cyan-50 p-4 rounded-lg border border-blue-200">
                            <p className="text-xs font-medium text-blue-600 uppercase mb-1">
                              Total Withdrawn
                            </p>
                            <p className="text-2xl font-bold text-blue-900">
                              ${referralData.totalWithdrawn.toFixed(2)}
                            </p>
                            <p className="text-xs text-blue-700 mt-1">
                              All-time withdrawals
                            </p>
                          </div>
                        </div>

                        {/* Commission Rates */}
                        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-6">
                          <p className="text-sm font-semibold text-gray-900 mb-3">
                            Commission Rates
                          </p>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            <div className="flex items-center justify-between">
                              <span className="text-sm text-gray-600">
                                Monthly Subscriptions:
                              </span>
                              <span className="text-sm font-bold text-primary-600">
                                15%
                              </span>
                            </div>
                            <div className="flex items-center justify-between">
                              <span className="text-sm text-gray-600">
                                Annual Subscriptions:
                              </span>
                              <span className="text-sm font-bold text-green-600">
                                20%
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Recent Earnings */}
                        {referralData.earnings &&
                          referralData.earnings.length > 0 && (
                            <div>
                              <p className="text-sm font-semibold text-gray-900 mb-3">
                                Recent Earnings
                              </p>
                              <div className="space-y-2">
                                {referralData.earnings
                                  .slice(0, 5)
                                  .map((earning, index) => (
                                    <div
                                      key={index}
                                      className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                                    >
                                      <div className="flex items-center space-x-3">
                                        <div className="w-10 h-10 bg-gradient-to-br from-green-500 to-emerald-600 rounded-full flex items-center justify-center">
                                          <span className="text-sm font-bold text-white">
                                            {earning.userName
                                              .charAt(0)
                                              .toUpperCase()}
                                          </span>
                                        </div>
                                        <div>
                                          <p className="text-sm font-medium text-gray-900">
                                            {earning.userName}
                                          </p>
                                          <p className="text-xs text-gray-500">
                                            {earning.subscriptionType ===
                                            "yearly"
                                              ? "Annual"
                                              : "Monthly"}{" "}
                                            subscription - $
                                            {earning.amount.toFixed(2)}
                                          </p>
                                        </div>
                                      </div>
                                      <div className="text-right">
                                        <p className="text-sm font-bold text-green-600">
                                          +${earning.commission.toFixed(2)}
                                        </p>
                                        <span
                                          className={`text-xs px-2 py-1 rounded-full ${
                                            earning.status === "completed"
                                              ? "bg-green-100 text-green-700"
                                              : "bg-yellow-100 text-yellow-700"
                                          }`}
                                        >
                                          {earning.status === "completed"
                                            ? "Available"
                                            : "Pending"}
                                        </span>
                                      </div>
                                    </div>
                                  ))}
                              </div>
                              {referralData.earnings.length > 5 && (
                                <p className="text-xs text-gray-500 text-center mt-3">
                                  +{referralData.earnings.length - 5} more
                                  earnings
                                </p>
                              )}
                            </div>
                          )}

                        {/* No Earnings Yet */}
                        {(!referralData.earnings ||
                          referralData.earnings.length === 0) && (
                          <div className="text-center py-8">
                            <Gift className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                            <p className="text-sm font-medium text-gray-900 mb-1">
                              No Earnings Yet
                            </p>
                            <p className="text-xs text-gray-600">
                              Earn 15% on monthly and 20% on annual
                              subscriptions when your referrals upgrade!
                            </p>
                          </div>
                        )}
                      </div>

                      {/* Withdrawal History */}
                      {referralData.withdrawals &&
                        referralData.withdrawals.length > 0 && (
                          <div className="bg-white border-2 border-gray-200 rounded-xl p-6 shadow-sm">
                            <div className="flex items-center justify-between mb-4">
                              <h4 className="text-lg font-semibold text-gray-900 flex items-center space-x-2">
                                <Download className="w-5 h-5 text-blue-600" />
                                <span>Withdrawal History</span>
                              </h4>
                              <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded-full">
                                {referralData.withdrawals.length} total
                              </span>
                            </div>
                            
                            {/* Scrollable container */}
                            <div className="max-h-80 overflow-y-auto pr-2 space-y-3 custom-scrollbar">
                              {referralData.withdrawals.map((withdrawal, index) => (
                                  <div
                                    key={withdrawal.id || index}
                                    onClick={() => {
                                      setSelectedWithdrawalItem(withdrawal as WithdrawalItem);
                                      setShowWithdrawalDetailsModal(true);
                                    }}
                                    className="flex items-center justify-between p-4 bg-gray-50 rounded-lg cursor-pointer hover:bg-gray-100 transition-colors group"
                                  >
                                    <div className="flex items-center space-x-3">
                                      <div className="p-2 bg-white rounded-lg shadow-sm group-hover:shadow transition-shadow">
                                        <Eye className="w-4 h-4 text-gray-400 group-hover:text-primary-600 transition-colors" />
                                      </div>
                                      <div>
                                        <p className="text-sm font-medium text-gray-900">
                                          ${withdrawal.amount.toFixed(2)}
                                        </p>
                                        <p className="text-xs text-gray-500">
                                          {new Date(
                                            withdrawal.requestDate,
                                          ).toLocaleDateString()}{" "}
                                          via{" "}
                                          {withdrawal.method === "paypal"
                                            ? "PayPal"
                                            : withdrawal.method === "upi"
                                              ? "UPI"
                                              : "Bank Transfer"}
                                        </p>
                                      </div>
                                    </div>
                                    <span
                                      className={`text-xs px-3 py-1 rounded-full font-medium flex-shrink-0 ${
                                        withdrawal.status === "completed"
                                          ? "bg-green-100 text-green-700"
                                          : withdrawal.status === "pending"
                                            ? "bg-yellow-100 text-yellow-700"
                                            : "bg-red-100 text-red-700"
                                      }`}
                                    >
                                      {withdrawal.status
                                        .charAt(0)
                                        .toUpperCase() +
                                        withdrawal.status.slice(1)}
                                    </span>
                                  </div>
                                ))}
                            </div>
                            
                            {referralData.withdrawals.length > 4 && (
                              <p className="text-xs text-gray-500 mt-3 text-center border-t pt-3">
                                Scroll to see all {referralData.withdrawals.length} withdrawals
                              </p>
                            )}
                            <p className="text-xs text-gray-500 mt-2 text-center">
                              Click on any withdrawal to view details
                            </p>
                          </div>
                        )}

                      {/* Referral Code Section */}
                      <div className="bg-white border-2 border-gray-200 rounded-xl p-6 shadow-sm">
                        <div className="flex items-center space-x-2 mb-3">
                          <Shield className="w-5 h-5 text-primary-600" />
                          <h4 className="text-lg font-semibold text-gray-900">
                            Your Referral Code
                          </h4>
                        </div>
                        <p className="text-sm text-gray-600 mb-4">
                          Share this unique code with friends. They can enter it
                          during signup.
                        </p>
                        <div className="flex items-center space-x-3">
                          <div className="flex-1 bg-gradient-to-r from-primary-50 to-purple-50 border-2 border-primary-200 rounded-lg p-4">
                            <p className="text-sm text-gray-600 mb-1">
                              Referral Code
                            </p>
                            <p className="text-2xl font-bold font-mono text-primary-600 tracking-wider">
                              {referralData.referralCode}
                            </p>
                          </div>
                          <button
                            onClick={copyReferralCode}
                            className="px-6 py-4 bg-primary-600 hover:bg-primary-700 text-white rounded-lg font-medium transition-colors flex items-center space-x-2 shadow-sm hover:shadow-md"
                            title="Copy code"
                          >
                            {copiedCode ? (
                              <>
                                <Check className="w-5 h-5" />
                                <span>Copied!</span>
                              </>
                            ) : (
                              <>
                                <Copy className="w-5 h-5" />
                                <span>Copy</span>
                              </>
                            )}
                          </button>
                        </div>
                      </div>

                      {/* Referral Link Section */}
                      <div className="bg-white border-2 border-gray-200 rounded-xl p-6 shadow-sm">
                        <div className="flex items-center space-x-2 mb-3">
                          <LinkIcon className="w-5 h-5 text-primary-600" />
                          <h4 className="text-lg font-semibold text-gray-900">
                            Your Referral Link
                          </h4>
                        </div>
                        <p className="text-sm text-gray-600 mb-4">
                          Share this link directly. The referral code is
                          automatically applied.
                        </p>
                        <div className="space-y-3">
                          <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                            <p className="text-sm text-gray-600 mb-2">
                              Referral URL
                            </p>
                            <p className="text-sm font-mono text-gray-800 break-all">
                              {referralLink}
                            </p>
                          </div>
                          <div className="flex items-center space-x-3">
                            <button
                              onClick={copyReferralLink}
                              className="flex-1 px-6 py-3 bg-primary-600 hover:bg-primary-700 text-white rounded-lg font-medium transition-colors flex items-center justify-center space-x-2 shadow-sm hover:shadow-md"
                            >
                              {copiedLink ? (
                                <>
                                  <Check className="w-5 h-5" />
                                  <span>Link Copied!</span>
                                </>
                              ) : (
                                <>
                                  <Copy className="w-5 h-5" />
                                  <span>Copy Link</span>
                                </>
                              )}
                            </button>
                            <button
                              onClick={shareReferral}
                              className="px-6 py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-medium transition-colors flex items-center space-x-2 shadow-sm hover:shadow-md"
                              title="Share link"
                            >
                              <Share2 className="w-5 h-5" />
                              <span>Share</span>
                            </button>
                          </div>
                        </div>
                      </div>

                      {/* How It Works */}
                      <div className="bg-gradient-to-br from-green-50 to-emerald-50 border border-green-200 rounded-xl p-6">
                        <h4 className="text-lg font-semibold text-gray-900 mb-4 flex items-center space-x-2">
                          <AlertCircle className="w-5 h-5 text-green-600" />
                          <span>How Referrals Work</span>
                        </h4>
                        <div className="space-y-3">
                          <div className="flex items-start space-x-3">
                            <div className="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center flex-shrink-0 mt-1">
                              <span className="text-white font-bold text-sm">
                                1
                              </span>
                            </div>
                            <div>
                              <p className="font-medium text-gray-900">
                                Share Your Link or Code
                              </p>
                              <p className="text-sm text-gray-600">
                                Send your referral link or code to friends via
                                email, social media, or messaging apps.
                              </p>
                            </div>
                          </div>
                          <div className="flex items-start space-x-3">
                            <div className="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center flex-shrink-0 mt-1">
                              <span className="text-white font-bold text-sm">
                                2
                              </span>
                            </div>
                            <div>
                              <p className="font-medium text-gray-900">
                                They Sign Up Using Your Link
                              </p>
                              <p className="text-sm text-gray-600">
                                Your friends create their LinkGuard account
                                using your referral link or by entering your
                                code.
                              </p>
                            </div>
                          </div>
                          <div className="flex items-start space-x-3">
                            <div className="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center flex-shrink-0 mt-1">
                              <span className="text-white font-bold text-sm">
                                3
                              </span>
                            </div>
                            <div>
                              <p className="font-medium text-gray-900">
                                Track Your Referrals
                              </p>
                              <p className="text-sm text-gray-600">
                                Watch your referral count grow and get ready for
                                future rewards when they upgrade!
                              </p>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Recent Referrals */}
                      {referralData.referrals &&
                        referralData.referrals.length > 0 && (
                          <div className="bg-white rounded-2xl shadow-lg border border-gray-200 overflow-hidden">
                            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 px-6 py-4 border-b border-gray-200">
                              <h4 className="text-lg font-bold text-gray-900 flex items-center space-x-2">
                                <Users className="w-5 h-5 text-blue-600" />
                                <span>Your Referrals</span>
                              </h4>
                            </div>
                            <div className="p-6">
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {referralData.referrals
                                  .slice(0, 6)
                                  .map((referral, index) => (
                                    <div
                                      key={index}
                                      className="flex items-center space-x-4 p-4 bg-gradient-to-r from-gray-50 to-gray-100 rounded-xl hover:from-blue-50 hover:to-indigo-50 transition-all border border-gray-200 hover:border-blue-300"
                                    >
                                      <div className="w-14 h-14 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-full flex items-center justify-center shadow-lg flex-shrink-0">
                                        <span className="text-xl font-bold text-white">
                                          {referral.userName
                                            .charAt(0)
                                            .toUpperCase()}
                                        </span>
                                      </div>
                                      <div className="flex-1 min-w-0">
                                        <p className="font-semibold text-gray-900 truncate">
                                          {referral.userName}
                                        </p>
                                        <p className="text-xs text-gray-500">
                                          {new Date(
                                            referral.signupDate,
                                          ).toLocaleDateString("en-US", {
                                            year: "numeric",
                                            month: "short",
                                            day: "numeric",
                                          })}
                                        </p>
                                        {referral.subscription && (
                                          <p className="text-xs text-green-600 font-medium mt-1">
                                            {referral.subscription.type ===
                                            "yearly"
                                              ? "Annual"
                                              : "Monthly"}{" "}
                                            Subscriber
                                          </p>
                                        )}
                                      </div>
                                      <span
                                        className={`px-3 py-1 rounded-full text-xs font-semibold flex-shrink-0 ${
                                          referral.status === "active"
                                            ? "bg-green-100 text-green-700"
                                            : "bg-gray-200 text-gray-600"
                                        }`}
                                      >
                                        {referral.status === "active"
                                          ? "✓ Active"
                                          : "Inactive"}
                                      </span>
                                    </div>
                                  ))}
                              </div>
                              {referralData.referrals.length > 6 && (
                                <p className="text-sm text-gray-500 text-center mt-4 pt-4 border-t border-gray-200">
                                  +{referralData.referrals.length - 6} more
                                  referrals
                                </p>
                              )}
                            </div>
                          </div>
                        )}

                      {/* Empty State for No Referrals */}
                      {(!referralData.referrals ||
                        referralData.referrals.length === 0) && (
                        <div className="bg-gradient-to-br from-gray-50 to-gray-100 rounded-2xl border-2 border-dashed border-gray-300 p-12 text-center">
                          <div className="inline-flex items-center justify-center w-16 h-16 bg-white rounded-full shadow-lg mb-4">
                            <Users className="w-8 h-8 text-gray-400" />
                          </div>
                          <h4 className="text-xl font-bold text-gray-900 mb-2">
                            No Referrals Yet
                          </h4>
                          <p className="text-gray-600 max-w-md mx-auto mb-4">
                            Start sharing your referral link to invite friends
                            and grow your network!
                          </p>
                          <button
                            onClick={copyReferralLink}
                            className="inline-flex items-center space-x-2 px-6 py-3 bg-gradient-to-r from-primary-600 to-primary-700 hover:from-primary-700 hover:to-primary-800 text-white rounded-xl font-semibold transition-all shadow-lg hover:shadow-xl"
                          >
                            <Copy className="w-4 h-4" />
                            <span>Copy Referral Link</span>
                          </button>
                        </div>
                      )}
                    </div>
                  </>
                ) : (
                  <div className="text-center py-12">
                    <Users className="w-16 h-16 text-gray-400 mx-auto mb-4 animate-pulse" />
                    <p className="text-gray-600">Loading referral data...</p>
                  </div>
                )}

                {/* Withdrawal Modal */}
                {showWithdrawalModal && (
                  <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-xl shadow-2xl max-w-md w-full max-h-[90vh] overflow-y-auto">
                      <div className="p-6">
                        <div className="flex items-center justify-between mb-6">
                          <h3 className="text-xl font-bold text-gray-900">
                            Withdraw Earnings
                          </h3>
                          <button
                            onClick={() => {
                              setShowWithdrawalModal(false);
                              setWithdrawalError("");
                              setWithdrawalSuccess(false);
                            }}
                            className="text-gray-400 hover:text-gray-600"
                          >
                            <AlertCircle className="w-6 h-6" />
                          </button>
                        </div>

                        {withdrawalSuccess ? (
                          <div className="text-center py-8">
                            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                              <Check className="w-8 h-8 text-green-600" />
                            </div>
                            <h4 className="text-lg font-semibold text-gray-900 mb-2">
                              Withdrawal Requested!
                            </h4>
                            <p className="text-sm text-gray-600 mb-6">
                              Your withdrawal request has been submitted and
                              will be processed within 3-5 business days.
                            </p>
                            <button
                              onClick={() => {
                                setShowWithdrawalModal(false);
                                setWithdrawalSuccess(false);
                              }}
                              className="btn-primary"
                            >
                              Done
                            </button>
                          </div>
                        ) : (
                          <>
                            {/* Available Balance */}
                            <div className="bg-gradient-to-br from-green-50 to-emerald-50 p-4 rounded-lg border border-green-200 mb-6">
                              <p className="text-sm text-green-600 mb-1">
                                Available Balance
                              </p>
                              <p className="text-3xl font-bold text-green-900">
                                ${referralData?.availableBalance.toFixed(2)}
                              </p>
                            </div>

                            {withdrawalError && (
                              <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4">
                                <p className="text-sm text-red-600">
                                  {withdrawalError}
                                </p>
                              </div>
                            )}

                            {/* Withdrawal Amount */}
                            <div className="mb-4">
                              <label className="block text-sm font-medium text-gray-700 mb-2">
                                Withdrawal Amount ($)
                              </label>
                              <input
                                type="number"
                                min="10"
                                max={referralData?.availableBalance}
                                step="0.01"
                                value={withdrawalAmount}
                                onChange={(e) =>
                                  setWithdrawalAmount(e.target.value)
                                }
                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                                placeholder="Minimum $10"
                              />
                              <p className="text-xs text-gray-500 mt-1">
                                Minimum withdrawal: $10.00
                              </p>
                            </div>

                            {/* Withdrawal Method */}
                            <div className="mb-4">
                              <label className="block text-sm font-medium text-gray-700 mb-2">
                                Withdrawal Method
                              </label>
                              <div className="grid grid-cols-3 gap-3">
                                <button
                                  onClick={() => setWithdrawalMethod("paypal")}
                                  className={`p-4 border-2 rounded-lg transition-all ${
                                    withdrawalMethod === "paypal"
                                      ? "border-primary-600 bg-primary-50"
                                      : "border-gray-200 hover:border-gray-300"
                                  }`}
                                >
                                  <p className="font-medium text-gray-900">
                                    PayPal
                                  </p>
                                  <p className="text-xs text-gray-600 mt-1">
                                    Instant transfer
                                  </p>
                                </button>
                                <button
                                  onClick={() => setWithdrawalMethod("bank")}
                                  className={`p-4 border-2 rounded-lg transition-all ${
                                    withdrawalMethod === "bank"
                                      ? "border-primary-600 bg-primary-50"
                                      : "border-gray-200 hover:border-gray-300"
                                  }`}
                                >
                                  <p className="font-medium text-gray-900">
                                    Bank Transfer
                                  </p>
                                  <p className="text-xs text-gray-600 mt-1">
                                    3-5 business days
                                  </p>
                                </button>
                                <button
                                  onClick={() => setWithdrawalMethod("upi")}
                                  className={`p-4 border-2 rounded-lg transition-all ${
                                    withdrawalMethod === "upi"
                                      ? "border-primary-600 bg-primary-50"
                                      : "border-gray-200 hover:border-gray-300"
                                  }`}
                                >
                                  <p className="font-medium text-gray-900">
                                    UPI
                                  </p>
                                  <p className="text-xs text-gray-600 mt-1">
                                    Instant (India)
                                  </p>
                                </button>
                              </div>
                            </div>

                            {/* PayPal Details */}
                            {withdrawalMethod === "paypal" && (
                              <div className="mb-4">
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                  PayPal Email
                                </label>
                                <input
                                  type="email"
                                  value={paypalEmail}
                                  onChange={(e) =>
                                    setPaypalEmail(e.target.value)
                                  }
                                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                                  placeholder="your-email@example.com"
                                />
                              </div>
                            )}

                            {/* UPI Details */}
                            {withdrawalMethod === "upi" && (
                              <div className="mb-4">
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                  UPI ID
                                </label>
                                <input
                                  type="text"
                                  value={upiId}
                                  onChange={(e) =>
                                    setUpiId(e.target.value)
                                  }
                                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                                  placeholder="yourname@upi or 9876543210@paytm"
                                />
                                <p className="text-xs text-gray-500 mt-1">
                                  Enter your UPI ID (e.g., name@okaxis, number@paytm)
                                </p>
                              </div>
                            )}

                            {/* Bank Details */}
                            {withdrawalMethod === "bank" && (
                              <div className="space-y-3 mb-4">
                                <div>
                                  <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Account Name
                                  </label>
                                  <input
                                    type="text"
                                    value={bankDetails.accountName}
                                    onChange={(e) =>
                                      setBankDetails({
                                        ...bankDetails,
                                        accountName: e.target.value,
                                      })
                                    }
                                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                                    placeholder="John Doe"
                                  />
                                </div>
                                <div>
                                  <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Account Number
                                  </label>
                                  <input
                                    type="text"
                                    value={bankDetails.accountNumber}
                                    onChange={(e) =>
                                      setBankDetails({
                                        ...bankDetails,
                                        accountNumber: e.target.value,
                                      })
                                    }
                                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                                    placeholder="1234567890"
                                  />
                                </div>
                                <div>
                                  <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Bank Name
                                  </label>
                                  <input
                                    type="text"
                                    value={bankDetails.bankName}
                                    onChange={(e) =>
                                      setBankDetails({
                                        ...bankDetails,
                                        bankName: e.target.value,
                                      })
                                    }
                                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                                    placeholder="Bank of America"
                                  />
                                </div>
                                <div>
                                  <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Routing Number
                                  </label>
                                  <input
                                    type="text"
                                    value={bankDetails.routingNumber}
                                    onChange={(e) =>
                                      setBankDetails({
                                        ...bankDetails,
                                        routingNumber: e.target.value,
                                      })
                                    }
                                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                                    placeholder="123456789"
                                  />
                                </div>
                              </div>
                            )}

                            {/* Submit Button */}
                            <button
                              onClick={async () => {
                                setWithdrawalError("");
                                const amount = parseFloat(withdrawalAmount);

                                if (!amount || amount < 10) {
                                  setWithdrawalError(
                                    "Minimum withdrawal amount is $10",
                                  );
                                  return;
                                }

                                if (
                                  amount > (referralData?.availableBalance || 0)
                                ) {
                                  setWithdrawalError("Insufficient balance");
                                  return;
                                }

                                let details = {};
                                if (withdrawalMethod === "paypal") {
                                  if (!paypalEmail) {
                                    setWithdrawalError(
                                      "Please enter your PayPal email",
                                    );
                                    return;
                                  }
                                  details = { email: paypalEmail };
                                } else if (withdrawalMethod === "upi") {
                                  if (!upiId) {
                                    setWithdrawalError(
                                      "Please enter your UPI ID",
                                    );
                                    return;
                                  }
                                  // Basic UPI ID validation (should contain @)
                                  if (!upiId.includes("@")) {
                                    setWithdrawalError(
                                      "Please enter a valid UPI ID (e.g., name@upi)",
                                    );
                                    return;
                                  }
                                  details = { upiId: upiId };
                                } else {
                                  if (
                                    !bankDetails.accountName ||
                                    !bankDetails.accountNumber ||
                                    !bankDetails.bankName ||
                                    !bankDetails.routingNumber
                                  ) {
                                    setWithdrawalError(
                                      "Please fill in all bank details",
                                    );
                                    return;
                                  }
                                  details = bankDetails;
                                }

                                setWithdrawalProcessing(true);

                                try {
                                  const { requestWithdrawal } = await import(
                                    "@/lib/referral"
                                  );
                                  const result = await requestWithdrawal(
                                    user!.uid,
                                    amount,
                                    withdrawalMethod,
                                    details,
                                  );

                                  if (result.success) {
                                    setWithdrawalSuccess(true);
                                    setWithdrawalAmount("");
                                    setPaypalEmail("");
                                    setUpiId("");
                                    setBankDetails({
                                      accountName: "",
                                      accountNumber: "",
                                      bankName: "",
                                      routingNumber: "",
                                    });
                                    // Reload referral data
                                    const refData = await import(
                                      "@/lib/referral"
                                    ).then((m) => m.getReferralData(user!.uid));
                                    setReferralData(refData);
                                  } else {
                                    setWithdrawalError(result.message);
                                  }
                                } catch (error) {
                                  setWithdrawalError(
                                    "Failed to process withdrawal. Please try again.",
                                  );
                                } finally {
                                  setWithdrawalProcessing(false);
                                }
                              }}
                              disabled={withdrawalProcessing}
                              className="w-full btn-primary"
                            >
                              {withdrawalProcessing
                                ? "Processing..."
                                : "Request Withdrawal"}
                            </button>

                            <p className="text-xs text-gray-500 text-center mt-4">
                              Withdrawals are processed within 3-5 business
                              days. A notification will be sent once completed.
                            </p>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Withdrawal Details Modal */}
      {showWithdrawalDetailsModal && selectedWithdrawalItem && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl max-w-lg w-full mx-4 p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-semibold text-gray-900">
                Withdrawal Details
              </h2>
              <button
                onClick={() => {
                  setShowWithdrawalDetailsModal(false);
                  setSelectedWithdrawalItem(null);
                }}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Status Badge */}
            <div className="mb-6 text-center">
              <span
                className={`inline-flex items-center px-4 py-2 text-sm font-medium rounded-full ${
                  selectedWithdrawalItem.status === "pending"
                    ? "bg-yellow-100 text-yellow-800"
                    : selectedWithdrawalItem.status === "completed"
                    ? "bg-green-100 text-green-800"
                    : "bg-red-100 text-red-800"
                }`}
              >
                {selectedWithdrawalItem.status === "completed" && <Check className="w-4 h-4 mr-2" />}
                {selectedWithdrawalItem.status === "pending" && <Clock className="w-4 h-4 mr-2" />}
                {selectedWithdrawalItem.status === "failed" && <X className="w-4 h-4 mr-2" />}
                {selectedWithdrawalItem.status.charAt(0).toUpperCase() + selectedWithdrawalItem.status.slice(1)}
              </span>
            </div>

            {/* Amount */}
            <div className="bg-gradient-to-r from-primary-50 to-purple-50 rounded-xl p-6 mb-4 text-center">
              <p className="text-sm text-gray-600 mb-1">Withdrawal Amount</p>
              <p className="text-3xl font-bold text-primary-600">${selectedWithdrawalItem.amount.toFixed(2)}</p>
            </div>

            {/* Payment Method */}
            <div className="bg-gray-50 rounded-xl p-4 mb-4">
              <h3 className="text-sm font-medium text-gray-500 mb-3">Payment Method</h3>
              <div className="flex items-center space-x-3">
                <div className={`p-2 rounded-lg ${
                  selectedWithdrawalItem.method === "paypal" 
                    ? "bg-blue-100" 
                    : selectedWithdrawalItem.method === "upi" 
                      ? "bg-purple-100" 
                      : "bg-gray-200"
                }`}>
                  {selectedWithdrawalItem.method === "paypal" && <Mail className="w-5 h-5 text-blue-600" />}
                  {selectedWithdrawalItem.method === "upi" && <Smartphone className="w-5 h-5 text-purple-600" />}
                  {selectedWithdrawalItem.method === "bank" && <Building className="w-5 h-5 text-gray-600" />}
                </div>
                <div>
                  <p className="font-medium text-gray-900">
                    {selectedWithdrawalItem.method === "paypal" 
                      ? "PayPal" 
                      : selectedWithdrawalItem.method === "upi" 
                        ? "UPI" 
                        : "Bank Transfer"}
                  </p>
                  <p className="text-xs text-gray-500">
                    {selectedWithdrawalItem.method === "paypal" 
                      ? "Instant transfer" 
                      : selectedWithdrawalItem.method === "upi" 
                        ? "Instant (India)" 
                        : "3-5 business days"}
                  </p>
                </div>
              </div>
            </div>

            {/* Payment Details */}
            <div className="bg-gray-50 rounded-xl p-4 mb-4">
              <h3 className="text-sm font-medium text-gray-500 mb-3">Payment Details</h3>
              
              {selectedWithdrawalItem.method === "paypal" && (
                <div className="flex items-center space-x-3">
                  <Mail className="w-4 h-4 text-blue-500" />
                  <div>
                    <p className="text-xs text-gray-500">PayPal Email</p>
                    <p className="text-gray-900 font-mono">{selectedWithdrawalItem.details?.email || "-"}</p>
                  </div>
                </div>
              )}

              {selectedWithdrawalItem.method === "upi" && (
                <div className="flex items-center space-x-3">
                  <Smartphone className="w-4 h-4 text-purple-500" />
                  <div>
                    <p className="text-xs text-gray-500">UPI ID</p>
                    <p className="text-gray-900 font-mono">{selectedWithdrawalItem.details?.upiId || "-"}</p>
                  </div>
                </div>
              )}

              {selectedWithdrawalItem.method === "bank" && (
                <div className="space-y-3">
                  <div className="flex items-center space-x-3">
                    <UserCircle className="w-4 h-4 text-gray-500" />
                    <div>
                      <p className="text-xs text-gray-500">Account Holder</p>
                      <p className="text-gray-900">{selectedWithdrawalItem.details?.accountName || "-"}</p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-3">
                    <CreditCard className="w-4 h-4 text-gray-500" />
                    <div>
                      <p className="text-xs text-gray-500">Account Number</p>
                      <p className="text-gray-900 font-mono">
                        ****{selectedWithdrawalItem.details?.accountNumber?.slice(-4) || "****"}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-3">
                    <Building className="w-4 h-4 text-gray-500" />
                    <div>
                      <p className="text-xs text-gray-500">Bank Name</p>
                      <p className="text-gray-900">{selectedWithdrawalItem.details?.bankName || "-"}</p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-3">
                    <Hash className="w-4 h-4 text-gray-500" />
                    <div>
                      <p className="text-xs text-gray-500">Routing Number</p>
                      <p className="text-gray-900 font-mono">{selectedWithdrawalItem.details?.routingNumber || "-"}</p>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Timeline */}
            <div className="bg-gray-50 rounded-xl p-4 mb-4">
              <h3 className="text-sm font-medium text-gray-500 mb-3">Timeline</h3>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <Calendar className="w-4 h-4 text-gray-400" />
                    <span className="text-sm text-gray-600">Requested</span>
                  </div>
                  <span className="text-sm text-gray-900">
                    {selectedWithdrawalItem.requestDate 
                      ? new Date(selectedWithdrawalItem.requestDate).toLocaleString() 
                      : "-"}
                  </span>
                </div>
                {selectedWithdrawalItem.completedDate && (
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <Check className="w-4 h-4 text-green-500" />
                      <span className="text-sm text-gray-600">Completed</span>
                    </div>
                    <span className="text-sm text-gray-900">
                      {new Date(selectedWithdrawalItem.completedDate).toLocaleString()}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Rejection Reason */}
            {selectedWithdrawalItem.status === "failed" && selectedWithdrawalItem.rejectReason && (
              <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-4">
                <h3 className="text-sm font-medium text-red-800 mb-2">Rejection Reason</h3>
                <p className="text-sm text-red-700">{selectedWithdrawalItem.rejectReason}</p>
              </div>
            )}

            {/* Status Message */}
            {selectedWithdrawalItem.status === "pending" && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 mb-4">
                <p className="text-sm text-yellow-800">
                  <Clock className="w-4 h-4 inline mr-2" />
                  Your withdrawal is being processed. You will receive a notification once it&apos;s completed.
                </p>
              </div>
            )}

            {selectedWithdrawalItem.status === "completed" && (
              <div className="bg-green-50 border border-green-200 rounded-xl p-4 mb-4">
                <p className="text-sm text-green-800">
                  <Check className="w-4 h-4 inline mr-2" />
                  Your withdrawal has been successfully processed. The funds should be in your account.
                </p>
              </div>
            )}

            {/* Withdrawal ID */}
            {selectedWithdrawalItem.id && (
              <div className="text-xs text-gray-400 text-center mb-4">
                Reference ID: {selectedWithdrawalItem.id}
              </div>
            )}

            {/* Close Button */}
            <button
              onClick={() => {
                setShowWithdrawalDetailsModal(false);
                setSelectedWithdrawalItem(null);
              }}
              className="w-full btn-secondary"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
