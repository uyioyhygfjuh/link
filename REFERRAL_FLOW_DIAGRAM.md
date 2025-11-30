# Referral System Flow Diagram

## System Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         LINKGUARD REFERRAL SYSTEM                        │
└─────────────────────────────────────────────────────────────────────────┘

                    ┌──────────────────────────────────┐
                    │     USER REGISTRATION FLOW        │
                    └──────────────────────────────────┘
```

## 1. User Signup Flow (With Referral)

```
┌─────────────┐
│   User A    │  Existing User (Referrer)
│  (Referrer) │
└──────┬──────┘
       │
       │ 1. Gets Referral Code: "JOH4K7LM"
       │    From Dashboard/Account Page
       │
       ├─────────────────────────────────────────┐
       │                                         │
       ▼                                         ▼
┌─────────────┐                         ┌──────────────┐
│  Share via  │                         │  Share via   │
│     URL     │                         │  Copy Code   │
└──────┬──────┘                         └──────┬───────┘
       │                                        │
       │ Shares:                                │ Shares:
       │ /signup?ref=JOH4K7LM                   │ "JOH4K7LM"
       │                                        │
       └────────────┬───────────────────────────┘
                    │
                    ▼
            ┌───────────────┐
            │   User B      │  New User (Referee)
            │  (New User)   │
            └───────┬───────┘
                    │
                    │ 2. Visits Signup Page
                    │
                    ▼
        ┌──────────────────────────┐
        │   SIGNUP PAGE COMPONENT   │
        │                           │
        │  ┌─────────────────────┐  │
        │  │ Auto-detect ref=    │  │
        │  │ from URL params     │  │
        │  └─────────────────────┘  │
        │           │                │
        │           ▼                │
        │  ┌─────────────────────┐  │
        │  │ Verify Referral     │  │
        │  │ Code via Firestore  │  │
        │  └─────────────────────┘  │
        │           │                │
        │           ▼                │
        │  ┌─────────────────────┐  │
        │  │ Display Green       │  │
        │  │ Banner: "Referred   │  │
        │  │ by User A"          │  │
        │  └─────────────────────┘  │
        └────────────┬──────────────┘
                     │
                     │ 3. User completes signup
                     │
                     ▼
        ┌──────────────────────────┐
        │    AUTH.TS FUNCTIONS     │
        │                           │
        │  signUpWithEmail() or     │
        │  signInWithGoogle()       │
        └────────────┬──────────────┘
                     │
                     ▼
        ┌──────────────────────────┐
        │   CREATE USER ACCOUNT    │
        │   in Firebase Auth       │
        └────────────┬──────────────┘
                     │
                     ▼
        ┌──────────────────────────┐
        │  CREATE USER DOCUMENT    │
        │  in Firestore users/     │
        │  collection              │
        └────────────┬──────────────┘
                     │
                     ▼
        ┌──────────────────────────┐
        │  REFERRAL.TS FUNCTIONS   │
        │                           │
        │  createReferralData()     │
        └────────────┬──────────────┘
                     │
                     ├──────────────┐
                     │              │
                     ▼              ▼
        ┌─────────────────┐  ┌──────────────────┐
        │ Create referral │  │  Update referrer │
        │ doc for User B  │  │  (User A) stats  │
        │                 │  │                  │
        │ referralCode:   │  │  referralCount++ │
        │   "ABC123XY"    │  │  Add User B to   │
        │ referredBy:     │  │  referrals[]     │
        │   "userA_id"    │  │                  │
        └─────────────────┘  └──────────────────┘
```

## 2. Firestore Data Structure

```
FIRESTORE DATABASE
│
├── users/
│   │
│   ├── {userId_A}/                    (Referrer - User A)
│   │   ├── fullName: "Alice Smith"
│   │   ├── email: "alice@example.com"
│   │   ├── plan: "Premium"
│   │   └── ...other user data
│   │
│   └── {userId_B}/                    (Referee - User B)
│       ├── fullName: "Bob Jones"
│       ├── email: "bob@example.com"
│       ├── plan: "Free Trial"
│       └── ...other user data
│
└── referrals/
    │
    ├── {userId_A}/                    (Referrer's referral data)
    │   ├── referralCode: "JOH4K7LM"
    │   ├── referredBy: null
    │   ├── referredByName: null
    │   ├── referralCount: 1
    │   ├── totalEarnings: 0
    │   ├── referrals: [
    │   │     {
    │   │       userId: "userId_B",
    │   │       userName: "Bob Jones",
    │   │       email: "bob@example.com",
    │   │       signupDate: "2024-01-15T10:30:00Z",
    │   │       status: "active"
    │   │     }
    │   │   ]
    │   ├── createdAt: "2024-01-10T08:00:00Z"
    │   └── updatedAt: "2024-01-15T10:30:00Z"
    │
    └── {userId_B}/                    (Referee's referral data)
        ├── referralCode: "BOB9X2ES"
        ├── referredBy: "userId_A"
        ├── referredByName: "Alice Smith"
        ├── referralCount: 0
        ├── totalEarnings: 0
        ├── referrals: []
        ├── createdAt: "2024-01-15T10:30:00Z"
        └── updatedAt: "2024-01-15T10:30:00Z"
```

## 3. Component Interaction Flow

```
┌────────────────────────────────────────────────────────────────────┐
│                        DASHBOARD PAGE                              │
│                                                                    │
│  ┌──────────────────────────────────────────────────────────┐    │
│  │              REFERRAL CARD COMPONENT                      │    │
│  │                                                            │    │
│  │  ┌────────────────────────────────────────────────────┐  │    │
│  │  │  Your Referral Code: JOH4K7LM                      │  │    │
│  │  │  [Copy Code] [Copy Link] [Share]                   │  │    │
│  │  └────────────────────────────────────────────────────┘  │    │
│  │                                                            │    │
│  │  ┌──────────────┐  ┌──────────────┐                     │    │
│  │  │Total Referrals│  │Total Earnings│                     │    │
│  │  │      5        │  │     $0       │                     │    │
│  │  └──────────────┘  └──────────────┘                     │    │
│  │                                                            │    │
│  │  Recent Referrals:                                        │    │
│  │  • Bob Jones - Jan 15, 2024 [Active]                     │    │
│  │  • Carol White - Jan 14, 2024 [Active]                   │    │
│  │  • Dave Brown - Jan 13, 2024 [Active]                    │    │
│  │                                                            │    │
│  └────────────────────────────────────────────────────────────┘    │
│                                                                    │
└────────────────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────────────────┐
│                       ACCOUNT PAGE                                 │
│                                                                    │
│  ┌──────────────────────────────────────────────────────────┐    │
│  │              PROFILE INFO TAB                             │    │
│  │                                                            │    │
│  │  [Full Name: Alice Smith]                                 │    │
│  │  [Email: alice@example.com]                               │    │
│  │  [Phone: +1234567890]                                     │    │
│  │                                                            │    │
│  │  ┌────────────────────────────────────────────────────┐  │    │
│  │  │         REFERRAL INFORMATION                       │  │    │
│  │  │                                                     │  │    │
│  │  │  Your Referral Code: JOH4K7LM                     │  │    │
│  │  │                                                     │  │    │
│  │  │  [You were referred by: Bob Smith]                │  │    │
│  │  │   Referral ID: abc123...                           │  │    │
│  │  │                                                     │  │    │
│  │  │  ┌──────────────┐  ┌──────────────┐              │  │    │
│  │  │  │Total Referrals│  │Total Earnings│              │  │    │
│  │  │  │      5        │  │     $0       │              │  │    │
│  │  │  └──────────────┘  └──────────────┘              │  │    │
│  │  └────────────────────────────────────────────────────┘  │    │
│  │                                                            │    │
│  └────────────────────────────────────────────────────────────┘    │
└────────────────────────────────────────────────────────────────────┘
```

## 4. Code Verification Flow

```
┌─────────────────┐
│  Signup Page    │
│  User enters    │
│  referral code  │
└────────┬────────┘
         │
         ▼
┌─────────────────────────┐
│ validateReferralCode()  │
│ Check format (5-12)     │
│ Alphanumeric only       │
└────────┬────────────────┘
         │
         ├─── Invalid format ──→ Show error, allow signup
         │
         ▼ Valid format
┌─────────────────────────┐
│ findUserByReferralCode()│
│ Query Firestore:        │
│ referrals collection    │
│ WHERE code == input     │
└────────┬────────────────┘
         │
         ├─── Not found ──→ Show "invalid code", allow signup
         │
         ▼ Found
┌─────────────────────────┐
│ Get User Document       │
│ users/{userId}          │
│ Return user data        │
└────────┬────────────────┘
         │
         ▼
┌─────────────────────────┐
│ Display Success:        │
│ ✓ Green checkmark       │
│ ✓ Referrer name         │
│ ✓ Enable relationship   │
└─────────────────────────┘
```

## 5. Referral Code Generation Algorithm

```
┌──────────────────────────────────────────────────────────┐
│          generateReferralCode(name, email)               │
└──────────────────────────────────────────────────────────┘
                            │
                            ▼
                ┌──────────────────────┐
                │   Extract name part  │
                │   - Remove spaces    │
                │   - Take first 3     │
                │   - Uppercase        │
                │   Example: "JOH"     │
                └──────────┬───────────┘
                           │
                           ▼
                ┌──────────────────────┐
                │  Generate random     │
                │  - Math.random()     │
                │  - Base36 encode     │
                │  - Take 4 chars      │
                │  - Uppercase         │
                │  Example: "4K7L"     │
                └──────────┬───────────┘
                           │
                           ▼
                ┌──────────────────────┐
                │  Extract email part  │
                │  - Remove special    │
                │  - Take last 2       │
                │  - Uppercase         │
                │  Example: "LM"       │
                └──────────┬───────────┘
                           │
                           ▼
                ┌──────────────────────┐
                │   Concatenate all    │
                │   "JOH" + "4K7L"     │
                │   + "LM"             │
                │   = "JOH4K7LLM"      │
                └──────────┬───────────┘
                           │
                           ▼
                    ┌─────────────┐
                    │ Return Code │
                    └─────────────┘
```

## 6. Real-time Verification Sequence

```
User Types Code
       │
       ▼
┌──────────────┐
│ onChange     │  (Every keystroke)
│ Event        │
└──────┬───────┘
       │
       ▼
┌──────────────┐
│ Code length  │
│ >= 5 chars?  │
└──────┬───────┘
       │
       ├─ No ──→ Clear verification status
       │
       ▼ Yes
┌──────────────┐
│ Set          │
│ Checking:    │
│ true         │
└──────┬───────┘
       │
       ▼
┌──────────────────┐
│ verifyReferral   │
│ Code()           │
└──────┬───────────┘
       │
       ▼
┌──────────────────┐
│ findUserBy       │
│ ReferralCode()   │
└──────┬───────────┘
       │
       ├─ Not Found ──→ Set verified: false
       │                Show red X
       │
       ▼ Found
┌──────────────────┐
│ Set verified:    │
│ true             │
│ Set referrer     │
│ name             │
└──────┬───────────┘
       │
       ▼
┌──────────────────┐
│ Display:         │
│ ✓ Green check    │
│ ✓ Referrer name  │
└──────────────────┘
```

## 7. Share Functionality Flow

```
┌─────────────────────┐
│  User clicks        │
│  Share Button       │
└─────────┬───────────┘
          │
          ▼
┌─────────────────────┐
│  Check if           │
│  navigator.share    │
│  available?         │
└─────────┬───────────┘
          │
          ├─ Yes (Mobile) ─→ ┌──────────────────┐
          │                   │ Open native share│
          │                   │ dialog with:     │
          │                   │ - Title          │
          │                   │ - Text           │
          │                   │ - URL            │
          │                   └──────────────────┘
          │
          ▼ No (Desktop)
┌─────────────────────┐
│  Fallback to        │
│  Copy to Clipboard  │
└─────────┬───────────┘
          │
          ▼
┌─────────────────────┐
│ Show success toast  │
│ "Copied to          │
│ clipboard!"         │
└─────────────────────┘
```

## 8. Error Handling Flow

```
                    ┌─────────────────┐
                    │  User Action    │
                    └────────┬────────┘
                             │
            ┌────────────────┼────────────────┐
            │                │                │
            ▼                ▼                ▼
    ┌───────────┐   ┌────────────┐   ┌──────────┐
    │ Invalid   │   │ Network    │   │ Auth     │
    │ Code      │   │ Error      │   │ Error    │
    └─────┬─────┘   └──────┬─────┘   └────┬─────┘
          │                │                │
          ▼                ▼                ▼
    ┌────────────────────────────────────────────┐
    │          GRACEFUL ERROR HANDLING           │
    │                                            │
    │  • Don't block signup                     │
    │  • Show clear error message               │
    │  • Log error to console                   │
    │  • Continue without referral link         │
    └────────────────────────────────────────────┘
```

## 9. Security & Validation Layers

```
┌─────────────────────────────────────────────────────┐
│              SECURITY LAYERS                        │
├─────────────────────────────────────────────────────┤
│                                                     │
│  Layer 1: Client-side Validation                   │
│  ├─ Format check (5-12 alphanumeric)               │
│  ├─ Real-time verification                         │
│  └─ User feedback                                  │
│                                                     │
│  Layer 2: Server-side Validation                   │
│  ├─ Firestore query validation                     │
│  ├─ User existence check                           │
│  └─ Referral document verification                 │
│                                                     │
│  Layer 3: Firestore Security Rules                 │
│  ├─ Read: Authenticated users only                 │
│  ├─ Write: Owner only                              │
│  └─ Create: Authenticated users                    │
│                                                     │
│  Layer 4: Business Logic                           │
│  ├─ Prevent self-referrals                         │
│  ├─ Rate limiting (future)                         │
│  └─ Fraud detection (future)                       │
│                                                     │
└─────────────────────────────────────────────────────┘
```

## 10. Future Rewards System (Planned)

```
┌──────────────────┐
│  New User Signs  │
│  Up with Code    │
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│  User Completes  │
│  Trial Period    │
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│  User Upgrades   │
│  to Paid Plan    │
└────────┬─────────┘
         │
         ▼
┌──────────────────────────────┐
│  Trigger Reward Function     │
│  awardReferralBonus()        │
└────────┬─────────────────────┘
         │
         ├──────────────────┐
         │                  │
         ▼                  ▼
┌────────────────┐  ┌───────────────┐
│ Update         │  │ Send          │
│ totalEarnings  │  │ Notification  │
│ for referrer   │  │ Email         │
└────────────────┘  └───────────────┘
```

---

**Legend:**
- `┌─┐` `└─┘` `│` `─` : Box borders
- `▼` : Flow direction
- `├─` : Branch point
- `→` : Alternative path

**File Structure References:**
- `lib/referral.ts` - Core functions
- `lib/auth.ts` - Authentication integration
- `components/ReferralCard.tsx` - Dashboard component
- `app/signup/page.tsx` - Signup integration
- `app/Account/page.tsx` - Account display
- `app/dashboard/page.tsx` - Dashboard integration

**Last Updated:** January 2024
**Version:** 1.0