# Referral System - Comprehensive Testing Guide

**Version**: 1.0  
**Last Updated**: January 2025  
**Purpose**: Step-by-step testing instructions for the LinkGuard referral system

---

## 🎯 Testing Overview

This guide provides detailed instructions for testing every aspect of the referral system. Follow these tests in order to ensure complete functionality.

---

## 📋 Pre-Testing Setup

### Requirements
- [ ] Two different browsers (e.g., Chrome and Firefox) OR incognito/private windows
- [ ] Two different email accounts for testing
- [ ] Access to Firebase Console
- [ ] Local development server running OR production environment access

### Test Accounts Needed
- **User A (Referrer)**: Primary test account
- **User B (Referred)**: Secondary test account

---

## 🧪 Test Suite 1: Referral Code Generation

### Test 1.1: New User Signup Creates Referral Code

**Steps**:
1. Navigate to `/signup`
2. Fill in signup form:
   - Full Name: `John Doe`
   - Email: `john.doe@test.com`
   - Password: `Test123!`
   - Confirm Password: `Test123!`
3. Click "Create Account"
4. Wait for redirect to dashboard

**Expected Results**:
- ✅ Account created successfully
- ✅ Redirected to `/dashboard`
- ✅ ReferralCard component appears on dashboard
- ✅ Referral code is displayed (format: e.g., `JOH4K7OM`)
- ✅ Referral link is displayed (e.g., `https://yoursite.com/signup?ref=JOH4K7OM`)
- ✅ Total Referrals shows: `0`
- ✅ Total Earnings shows: `$0`

**Verify in Firebase**:
1. Open Firestore Console
2. Navigate to `referrals` collection
3. Find document with User A's UID
4. Verify fields:
   - `referralCode`: String (e.g., "JOH4K7OM")
   - `referredBy`: null
   - `referredByName`: null
   - `referralCount`: 0
   - `totalEarnings`: 0
   - `availableBalance`: 0
   - `pendingBalance`: 0
   - `referrals`: []
   - `earnings`: []
   - `withdrawals`: []

---

## 🧪 Test Suite 2: Referral Link Functionality

### Test 2.1: Copy Referral Code

**Steps**:
1. As User A, go to `/dashboard`
2. Locate ReferralCard
3. Click "Copy" button next to referral code

**Expected Results**:
- ✅ Button changes to show checkmark
- ✅ Text changes to "Copied!"
- ✅ Success message appears briefly
- ✅ Code is in clipboard (paste into notepad to verify)
- ✅ Button reverts to "Copy" after 2 seconds

### Test 2.2: Copy Referral Link

**Steps**:
1. As User A, scroll to referral link input
2. Click "Copy Link" button

**Expected Results**:
- ✅ Button changes to "Link Copied!"
- ✅ Link is in clipboard
- ✅ Link format: `https://yoursite.com/signup?ref=YOURCODE`
- ✅ Button reverts after 2 seconds

### Test 2.3: Share Referral Link (Mobile Only)

**Steps**:
1. Open site on mobile device or simulate mobile in DevTools
2. As User A, click "Share" button

**Expected Results**:
- ✅ Native share dialog opens (iOS/Android)
- ✅ Link can be shared via apps (Messages, WhatsApp, Email, etc.)
- ✅ On desktop, falls back to copy functionality

---

## 🧪 Test Suite 3: Signup with Referral Code

### Test 3.1: Signup via Referral Link (URL Parameter)

**Steps**:
1. As User A, copy referral link
2. Open new incognito/private window
3. Paste referral link into address bar
4. Navigate to the URL
5. Verify referral code appears in URL: `?ref=YOURCODE`

**Expected Results**:
- ✅ Signup page loads
- ✅ Referral code input is pre-filled with code from URL
- ✅ Green success banner appears: "You were referred by John Doe!"
- ✅ Checkmark icon appears next to referral code input
- ✅ Text below input: "Valid referral code from John Doe"

**Continue Signup**:
6. Fill in signup form:
   - Full Name: `Jane Smith`
   - Email: `jane.smith@test.com`
   - Password: `Test123!`
   - Confirm Password: `Test123!`
7. Click "Create Account"

**Expected Results**:
- ✅ Account created successfully
- ✅ Redirected to `/dashboard`
- ✅ No errors occur

**Verify in Firebase (User B)**:
1. Open Firestore → `referrals` collection
2. Find User B's document
3. Verify:
   - `referredBy`: User A's UID
   - `referredByName`: "John Doe"
   - Has own unique `referralCode`

**Verify in Firebase (User A)**:
1. Find User A's document in `referrals`
2. Verify:
   - `referralCount`: 1
   - `referrals` array has one entry:
     - `userId`: User B's UID
     - `userName`: "Jane Smith"
     - `email`: "jane.smith@test.com"
     - `signupDate`: ISO timestamp
     - `status`: "active"

### Test 3.2: Manual Referral Code Entry

**Steps**:
1. Open new incognito window
2. Navigate to `/signup` (no URL parameter)
3. Fill in signup form with User C details
4. Manually type User A's referral code in the "Referral Code" field
5. Wait for validation (1-2 seconds)

**Expected Results**:
- ✅ As you type, code is converted to uppercase
- ✅ After 5+ characters, validation begins
- ✅ "Verifying referral code..." message appears
- ✅ Green checkmark appears if valid
- ✅ Text shows: "Valid referral code from John Doe"
- ✅ If invalid: Red text "Invalid referral code"

6. Complete signup

**Expected Results**:
- ✅ Same as Test 3.1 - referral is attributed correctly

### Test 3.3: Invalid Referral Code

**Steps**:
1. Navigate to `/signup`
2. Enter invalid code: `INVALID123`
3. Wait for validation

**Expected Results**:
- ✅ Red error text: "Invalid referral code"
- ✅ No checkmark appears
- ✅ Can still complete signup
- ✅ No referral attribution occurs

### Test 3.4: Signup Without Referral Code

**Steps**:
1. Navigate to `/signup`
2. Leave referral code field empty
3. Complete signup

**Expected Results**:
- ✅ Signup works normally
- ✅ User's referral document created with:
   - `referredBy`: null
   - `referredByName`: null
   - Own unique referral code

### Test 3.5: Google Sign-In with Referral Code

**Steps**:
1. Copy User A's referral link
2. Open new incognito window
3. Navigate to referral link
4. Verify referral code is pre-filled
5. Click "Sign up with Google"
6. Complete Google authentication

**Expected Results**:
- ✅ Google popup opens
- ✅ User authenticates successfully
- ✅ Account created with Google profile
- ✅ Referral code is passed through OAuth flow
- ✅ User A receives referral credit
- ✅ User's Firestore doc has `referredBy` and `referredByName`

---

## 🧪 Test Suite 4: Dashboard Referral Display

### Test 4.1: View Referral Stats on Dashboard

**Steps**:
1. As User A (who now has referrals), log in
2. Navigate to `/dashboard`
3. Scroll to ReferralCard component

**Expected Results**:
- ✅ Card displays with gradient background
- ✅ Total Referrals: Shows correct count (e.g., `2`)
- ✅ Total Earnings: Shows `$0.00` (no subscriptions yet)
- ✅ Referral code displayed clearly
- ✅ Referral link displayed in input field
- ✅ "Recent Referrals" section shows up to 3 latest referrals
- ✅ Each referral shows:
   - User's initial in colored circle
   - User's name
   - Signup date
   - Status badge ("active")

### Test 4.2: View All Referrals

**Steps**:
1. As User A, go to `/Account`
2. Click "Referral" tab

**Expected Results**:
- ✅ Referral tab becomes active (blue underline)
- ✅ Hero section displays with gradient background
- ✅ Quick stats show:
   - Total Referrals: 2
   - Total Earned: $0.00
   - Available: $0.00
   - Pending: $0.00
- ✅ Referral code card displays
- ✅ Referral link card displays
- ✅ "How It Works" section visible
- ✅ "Your Referrals" section at bottom shows all referred users

---

## 🧪 Test Suite 5: Commission & Earnings

### Test 5.1: Record Earnings (Monthly Subscription)

**Manual Test via Firebase Console**:
1. Open Firestore Console
2. Create a test earning by calling `recordEarnings()` function
3. Or manually update User A's `referrals` document:

**Simulate User B subscribes to $10/month plan**:
```javascript
// Add to earnings array
{
  id: "userA_userB_1234567890",
  userId: "userB_uid",
  userName: "Jane Smith",
  amount: 10,
  commission: 1.50,  // 15% of $10
  subscriptionType: "monthly",
  date: "2025-01-15T12:00:00Z",
  status: "pending"
}
```

4. Update fields:
   - `totalEarnings`: 1.50
   - `pendingBalance`: 1.50

**Expected Results**:
- ✅ Document updates successfully
- ✅ Commission calculated correctly (15% of $10 = $1.50)

### Test 5.2: View Pending Earnings

**Steps**:
1. As User A, refresh Account page → Referral tab
2. Check earnings sidebar

**Expected Results**:
- ✅ Total Earned: $1.50
- ✅ Pending Balance: $1.50 (yellow card)
- ✅ Available Balance: $0.00 (green card)
- ✅ "Recent Earnings" table shows:
   - Jane Smith
   - Monthly - $10.00
   - Commission: $1.50
   - Status: "Pending" (yellow badge)

### Test 5.3: Confirm Earnings (Move to Available)

**Manual Test via Firebase Console**:
1. Update the earning status from `pending` to `completed`
2. Move amount from `pendingBalance` to `availableBalance`:
   - `pendingBalance`: 0
   - `availableBalance`: 1.50

**Steps**:
1. As User A, refresh page

**Expected Results**:
- ✅ Available Balance: $1.50
- ✅ Pending Balance: $0.00
- ✅ Earning status changes to "Completed" (green badge)
- ✅ Still shows $1.50 in Total Earned

### Test 5.4: Yearly Subscription Commission

**Simulate User C subscribes to $100/year plan**:
```javascript
// Add to earnings array
{
  id: "userA_userC_1234567891",
  userId: "userC_uid",
  userName: "Bob Johnson",
  amount: 100,
  commission: 20.00,  // 20% of $100
  subscriptionType: "yearly",
  date: "2025-01-15T13:00:00Z",
  status: "pending"
}
```

**Expected Results**:
- ✅ Commission correctly calculated as 20% for yearly
- ✅ Total Earned: $21.50 ($1.50 + $20.00)
- ✅ Pending Balance: $20.00

---

## 🧪 Test Suite 6: Withdrawal System

### Test 6.1: Withdrawal Button Visibility

**Steps**:
1. As User A with $0 available balance
2. Go to Account → Referral tab

**Expected Results**:
- ✅ NO "Withdraw" button visible in earnings sidebar

**Steps**:
3. Ensure available balance is ≥ $10
4. Refresh page

**Expected Results**:
- ✅ "Withdraw" button appears in sidebar header
- ✅ Button is white with purple text

### Test 6.2: Request Withdrawal (PayPal)

**Steps**:
1. As User A with $10+ available
2. Click "Withdraw" button
3. Modal opens

**Expected Results**:
- ✅ Modal title: "Request Withdrawal"
- ✅ Available balance shown at top
- ✅ Amount input field (empty)
- ✅ Method selector (PayPal selected by default)
- ✅ PayPal email input field visible

**Continue**:
4. Enter amount: `15.00`
5. Enter PayPal email: `john.doe@paypal.com`
6. Click "Request Withdrawal"

**Expected Results**:
- ✅ If amount > available: Error message appears
- ✅ If amount < $10: Error "Minimum withdrawal amount is $10"
- ✅ If valid: Success message appears
- ✅ Modal closes
- ✅ Available balance reduced by withdrawal amount
- ✅ Withdrawal appears in "Withdrawal History" table:
   - Amount: $15.00
   - Method: PayPal
   - Status: "Pending" (yellow badge)
   - Request Date: Today's date

**Verify in Firebase**:
1. Check User A's referrals document
2. Verify `withdrawals` array has new entry:
   ```javascript
   {
     id: "withdrawal_userA_timestamp",
     amount: 15.00,
     method: "paypal",
     details: {
       email: "john.doe@paypal.com"
     },
     status: "pending",
     requestDate: "ISO timestamp"
   }
   ```
3. Verify `availableBalance` decreased by 15.00

### Test 6.3: Request Withdrawal (Bank Transfer)

**Steps**:
1. Click "Withdraw" button
2. Select "Bank Transfer" option
3. Form changes to show bank fields

**Expected Results**:
- ✅ Bank details form appears:
   - Account Name
   - Account Number
   - Bank Name
   - Routing Number

**Continue**:
4. Fill in bank details:
   - Account Name: `John Doe`
   - Account Number: `123456789`
   - Bank Name: `Test Bank`
   - Routing Number: `987654321`
5. Enter amount: `20.00`
6. Click "Request Withdrawal"

**Expected Results**:
- ✅ Validation checks all fields filled
- ✅ Success message appears
- ✅ Withdrawal recorded with `method: "bank"`
- ✅ Details include all bank information

### Test 6.4: Insufficient Balance

**Steps**:
1. Available balance: $10
2. Try to withdraw: $50
3. Click submit

**Expected Results**:
- ✅ Error message: "Insufficient available balance"
- ✅ Withdrawal NOT created
- ✅ Balance unchanged

### Test 6.5: Below Minimum Withdrawal

**Steps**:
1. Try to withdraw: $5
2. Click submit

**Expected Results**:
- ✅ Error message: "Minimum withdrawal amount is $10"
- ✅ Withdrawal NOT created

### Test 6.6: View Withdrawal History

**Steps**:
1. Create multiple withdrawals (3+)
2. View "Withdrawal History" section on Referral tab

**Expected Results**:
- ✅ Table shows all withdrawals
- ✅ Columns: Amount, Method, Status, Request Date
- ✅ Pagination appears if > 5 withdrawals
- ✅ Status badges color-coded:
   - Pending: Yellow
   - Completed: Green
   - Failed: Red

---

## 🧪 Test Suite 7: Account Page Integration

### Test 7.1: Profile Tab - My Info Section

**Steps**:
1. Go to `/Account`
2. Ensure "Profile" tab is active
3. Scroll to "My Info" section

**Expected Results**:
- ✅ Referral Code displayed clearly
- ✅ If user was referred:
   - ✅ "Referred By" field shows referrer's name
- ✅ If user was NOT referred:
   - ✅ "Referred By" shows "Not referred"
- ✅ Link to "View Referral Details" navigates to Referral tab

### Test 7.2: Tab Navigation

**Steps**:
1. Click "Referral" tab
2. Verify content loads
3. Click "Profile" tab
4. Click "Referral" tab again

**Expected Results**:
- ✅ Tabs switch smoothly
- ✅ Active tab has blue underline
- ✅ Content changes instantly
- ✅ No page reload occurs
- ✅ Data persists between switches

---

## 🧪 Test Suite 8: Edge Cases

### Test 8.1: Self-Referral Prevention

**Steps**:
1. As User A, copy your own referral link
2. Log out
3. Try to sign up again using your own referral link

**Expected Results**:
- ✅ Different email required (can't use same email)
- ✅ If somehow bypassed, Firestore should prevent self-referral
- ✅ No credit given to yourself

### Test 8.2: Duplicate Referral Code

**Steps**:
1. Check if two users can have same referral code

**Expected Results**:
- ✅ Extremely unlikely due to random generation
- ✅ If collision occurs, code generation should retry
- ✅ Each user has unique code

### Test 8.3: Expired Referral Links

**Note**: Current implementation doesn't expire codes

**Expected Results**:
- ✅ Old referral links still work
- ✅ No time-based expiration
- ✅ (Future enhancement if needed)

### Test 8.4: Special Characters in Names

**Steps**:
1. Sign up with name: `José O'Brien-Smith`
2. Check referral code generation

**Expected Results**:
- ✅ Code generated successfully
- ✅ Special characters stripped/handled
- ✅ Code format maintained (8-10 chars)

### Test 8.5: Very Long Names

**Steps**:
1. Sign up with name: `Wolfeschlegelsteinhausenbergerdorff`
2. Check referral code

**Expected Results**:
- ✅ Only first 3 letters used: `WOL`
- ✅ Code generation succeeds

### Test 8.6: Empty/Null Names

**Steps**:
1. Try to sign up without full name

**Expected Results**:
- ✅ Signup form validation prevents submission
- ✅ Error message: "Please enter your full name"

---

## 🧪 Test Suite 9: Mobile Responsiveness

### Test 9.1: Dashboard on Mobile

**Steps**:
1. Open DevTools (F12)
2. Toggle device toolbar (Ctrl+Shift+M)
3. Select iPhone 12 Pro (390x844)
4. Navigate to `/dashboard`

**Expected Results**:
- ✅ ReferralCard displays properly
- ✅ Stats cards stack vertically
- ✅ Copy buttons accessible
- ✅ Text readable without zoom
- ✅ No horizontal scroll

### Test 9.2: Account Page Referral Tab on Mobile

**Steps**:
1. Mobile view (375px width)
2. Navigate to Account → Referral

**Expected Results**:
- ✅ Hero section displays correctly
- ✅ Quick stats grid: 2x2 layout
- ✅ Cards stack in single column
- ✅ Buttons full-width
- ✅ Tables scroll horizontally if needed
- ✅ Modal fills screen appropriately

### Test 9.3: Signup with Referral on Mobile

**Steps**:
1. Mobile view
2. Open referral link
3. Complete signup

**Expected Results**:
- ✅ Form fields accessible
- ✅ Referral banner fits screen
- ✅ Validation messages visible
- ✅ Submit button reachable

---

## 🧪 Test Suite 10: Performance & Load Testing

### Test 10.1: Large Referral List

**Simulate**:
1. Add 50+ referrals to User A's document
2. Load Account → Referral tab

**Expected Results**:
- ✅ Page loads in < 3 seconds
- ✅ Pagination works correctly
- ✅ Smooth scrolling
- ✅ No layout shifts

### Test 10.2: Many Earnings Records

**Simulate**:
1. Add 100+ earnings entries
2. Load Referral tab

**Expected Results**:
- ✅ Table paginates correctly (5-10 per page)
- ✅ No performance degradation
- ✅ Filtering/sorting works (if implemented)

### Test 10.3: Concurrent Signups

**Simulate**:
1. Multiple users sign up with same referral code simultaneously

**Expected Results**:
- ✅ Firestore handles concurrency
- ✅ All referrals credited correctly
- ✅ No count mismatches
- ✅ No data loss

---

## ✅ Final Verification Checklist

### Pre-Production
- [ ] All Test Suites 1-10 passed
- [ ] No console errors in browser
- [ ] No Firestore errors in logs
- [ ] Mobile testing completed
- [ ] Cross-browser testing completed
- [ ] Security rules deployed
- [ ] Documentation reviewed

### Production Deployment
- [ ] Smoke test in production after deployment
- [ ] Verify real signup flow works
- [ ] Check Firebase quotas and billing
- [ ] Monitor error logs for 24 hours
- [ ] User acceptance testing (UAT) completed

---

## 🐛 Bug Reporting Template

If you find issues during testing, use this template:

```
**Bug Title**: [Short description]

**Severity**: Critical / High / Medium / Low

**Test Suite**: [e.g., Test Suite 3: Signup with Referral Code]

**Steps to Reproduce**:
1. 
2. 
3. 

**Expected Result**:
- 

**Actual Result**:
- 

**Screenshots**: [Attach if applicable]

**Browser**: [e.g., Chrome 120 on Windows 11]

**Console Errors**: [Copy any error messages]

**Firestore Data**: [Relevant document snapshots]
```

---

## 📊 Test Results Summary Sheet

| Test Suite | Total Tests | Passed | Failed | Notes |
|------------|-------------|--------|--------|-------|
| 1. Code Generation | 1 | | | |
| 2. Link Functionality | 3 | | | |
| 3. Signup with Referral | 5 | | | |
| 4. Dashboard Display | 2 | | | |
| 5. Commission & Earnings | 4 | | | |
| 6. Withdrawal System | 6 | | | |
| 7. Account Page | 2 | | | |
| 8. Edge Cases | 6 | | | |
| 9. Mobile Responsiveness | 3 | | | |
| 10. Performance | 3 | | | |
| **TOTAL** | **35** | | | |

---

## 🎓 Tips for Effective Testing

1. **Clear Browser Cache**: Between tests to ensure fresh data
2. **Use Incognito/Private Windows**: Prevents session conflicts
3. **Check Firebase Console**: After each major action
4. **Document Unexpected Behavior**: Even if not a bug
5. **Test Both Happy and Sad Paths**: Success cases AND error cases
6. **Use Real Email Accounts**: For testing email flows (when implemented)
7. **Time-Bound Tests**: Note how long actions take
8. **Screenshot Everything**: Especially errors or unexpected UI

---

## 📞 Need Help?

- **Documentation**: See `REFERRAL_SYSTEM_STATUS.md` for implementation details
- **Action Plan**: See `REFERRAL_ACTION_PLAN.md` for next steps
- **Firebase Console**: Check Firestore for data verification
- **Browser Console**: Check for JavaScript errors (F12)

---

**Happy Testing! 🧪**

---

**Document Version**: 1.0  
**Last Updated**: January 2025  
**Next Review**: After test completion