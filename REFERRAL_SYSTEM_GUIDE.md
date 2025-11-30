# Referral System Implementation Guide

## Overview

LinkGuard now includes a comprehensive referral system that allows users to invite friends and earn rewards. Every user gets a unique referral code upon signup, and the system tracks referrals across the entire platform.

## Features

✅ **Automatic Referral Code Generation**: Every user receives a unique referral code upon registration
✅ **URL-based Referral Tracking**: Referral codes can be passed via URL parameters
✅ **Manual Code Entry**: Users can manually enter referral codes during signup
✅ **Real-time Verification**: Referral codes are verified in real-time
✅ **Referral Dashboard**: Users can view their referral statistics and share their link
✅ **Referred By Display**: Users can see who referred them on their account page
✅ **Google Sign-in Support**: Referral tracking works with both email and Google authentication

## How It Works

### 1. User Registration with Referral Code

When a new user signs up, they can:
- Follow a referral link with the format: `https://yoursite.com/signup?ref=ABC123XY`
- Manually enter a referral code in the signup form

### 2. Referral Code Generation

Each user's referral code is automatically generated using:
- First 3 letters of their name
- 4 random alphanumeric characters
- Last 2 characters from their email
- Example: `JOH4K7LM` (John → JOH, random → 4K7L, email ending → LM)

### 3. Data Storage

The system stores referral data in Firestore with the following structure:

```javascript
// Collection: referrals/{userId}
{
  referralCode: "ABC123XY",
  referredBy: "userId123" | null,
  referredByName: "John Doe" | null,
  referralCount: 5,
  totalEarnings: 0,
  referrals: [
    {
      userId: "userId456",
      userName: "Jane Smith",
      email: "jane@example.com",
      signupDate: "2024-01-15T10:30:00Z",
      status: "active"
    }
  ],
  createdAt: "2024-01-10T08:00:00Z",
  updatedAt: "2024-01-15T10:30:00Z"
}
```

## Implementation Details

### File Structure

```
linkguard/
├── lib/
│   ├── referral.ts              # Core referral functions
│   └── auth.ts                  # Updated with referral integration
├── components/
│   └── ReferralCard.tsx         # Referral dashboard component
├── app/
│   ├── signup/
│   │   └── page.tsx             # Updated with referral capture
│   ├── Account/
│   │   └── page.tsx             # Shows referral info
│   └── dashboard/
│       └── page.tsx             # Displays ReferralCard
└── REFERRAL_SYSTEM_GUIDE.md     # This file
```

### Key Functions

#### `generateReferralCode(name: string, email: string): string`
Generates a unique referral code for a user.

#### `createReferralData(userId: string, referralCode: string, referredByCode?: string): Promise<void>`
Creates referral data for a new user and updates referrer stats.

#### `findUserByReferralCode(referralCode: string): Promise<UserData | null>`
Finds a user by their referral code.

#### `getReferralData(userId: string): Promise<ReferralData | null>`
Retrieves referral data for a specific user.

#### `generateReferralLink(referralCode: string, baseUrl?: string): string`
Generates a shareable referral link.

## User Experience Flow

### For New Users (Referees)

1. **Click Referral Link** or **Enter Code**
   - User clicks: `https://yoursite.com/signup?ref=ABC123XY`
   - Or manually enters code in signup form

2. **Code Verification**
   - System verifies code in real-time
   - Shows referrer's name if valid
   - Displays green success banner

3. **Complete Signup**
   - User creates account (email or Google)
   - Referral relationship is automatically established

4. **View Referrer Info**
   - User can see who referred them on Account page
   - Displays referrer's name and ID

### For Existing Users (Referrers)

1. **Access Referral Dashboard**
   - Visible on main dashboard
   - Also in Account settings

2. **Share Referral Link**
   - Copy unique referral code or link
   - Use native share button (mobile)
   - Share via any channel

3. **Track Referrals**
   - View total referral count
   - See recent referrals
   - Monitor earnings (future feature)

## Dashboard Components

### ReferralCard Component

Located at: `components/ReferralCard.tsx`

Features:
- Display user's referral code
- Show referral statistics (count, earnings)
- Copy referral code/link to clipboard
- Share button for mobile devices
- List of recent referrals
- "How it works" instructions

### Account Page Integration

Located at: `app/Account/page.tsx`

Profile Tab Shows:
- User's unique referral code
- "Referred by" information (if applicable)
- Referral statistics
- Easy sharing options

## API Integration Points

### Signup Flow

**Email Signup:**
```typescript
await signUpWithEmail(email, password, fullName, referralCode);
```

**Google Signup:**
```typescript
await signInWithGoogle(referralCode);
```

### Reading Referral Data

```typescript
const referralData = await getReferralData(userId);
```

## Firestore Security Rules

Add these rules to your Firestore security rules:

```javascript
// Referrals collection
match /referrals/{userId} {
  // Users can read their own referral data
  allow read: if request.auth != null && request.auth.uid == userId;
  
  // Users can create their own referral data (handled by Cloud Functions ideally)
  allow create: if request.auth != null && request.auth.uid == userId;
  
  // Users can update their own referral data
  allow update: if request.auth != null && request.auth.uid == userId;
  
  // Allow reading specific referral codes for verification (public read)
  allow read: if request.auth != null;
}
```

## Future Enhancements

### Planned Features

1. **Reward System**
   - Award credits/discounts when referrals upgrade
   - Track monetary earnings
   - Automatic reward distribution

2. **Tiered Referrals**
   - Bronze/Silver/Gold tiers based on referral count
   - Special perks for top referrers
   - Leaderboard system

3. **Email Notifications**
   - Notify users when someone uses their code
   - Send thank you emails to new users
   - Periodic referral performance reports

4. **Social Media Integration**
   - One-click sharing to social platforms
   - Pre-filled messages with referral links
   - Track referral sources

5. **Referral Analytics**
   - Conversion rates
   - Source tracking
   - Time-based analytics
   - Geographic distribution

## Testing the Referral System

### Manual Testing Steps

1. **Test New Signup with Referral Code**
   ```
   1. Create User A
   2. Note User A's referral code
   3. Log out
   4. Visit: /signup?ref=[User A's code]
   5. Create User B
   6. Verify User B sees referrer name
   7. Complete signup
   8. Check User A's referral count increased
   ```

2. **Test Manual Code Entry**
   ```
   1. Go to /signup
   2. Enter User A's code in referral field
   3. Verify real-time validation
   4. Complete signup
   5. Check referral was recorded
   ```

3. **Test Invalid Code**
   ```
   1. Go to /signup
   2. Enter invalid code
   3. Verify error message appears
   4. Verify signup still works without valid code
   ```

4. **Test Dashboard Display**
   ```
   1. Login as User A
   2. Check dashboard shows ReferralCard
   3. Verify referral count is correct
   4. Test copy button
   5. Test share button (mobile)
   ```

5. **Test Account Page**
   ```
   1. Login as User B (referred user)
   2. Go to Account page
   3. Verify "Referred by User A" shows
   4. Check referral code displays
   5. Verify stats are accurate
   ```

## Troubleshooting

### Common Issues

**Issue: Referral code not working**
- Verify code format (5-12 alphanumeric characters)
- Check Firestore for referral document
- Ensure referral collection has proper read permissions

**Issue: Referrer not getting credit**
- Check `createReferralData` function execution
- Verify Firestore update permissions
- Check browser console for errors

**Issue: Referral card not displaying**
- Ensure user is authenticated
- Check that referral document exists
- Verify ReferralCard component import

**Issue: Copy button not working**
- Check browser clipboard permissions
- Test in HTTPS environment (required for clipboard API)
- Verify navigator.clipboard is available

## Best Practices

1. **Always validate referral codes** before accepting them
2. **Use transactions** for updating referral counts to avoid race conditions
3. **Store referral codes in uppercase** for consistency
4. **Provide clear feedback** to users about referral status
5. **Don't block signup** if referral code is invalid
6. **Track referral sources** for analytics
7. **Test edge cases** (self-referrals, multiple accounts, etc.)

## Security Considerations

1. **Prevent Self-Referrals**: Add logic to prevent users from using their own referral code
2. **Rate Limiting**: Implement rate limiting on referral lookups
3. **Fraud Detection**: Monitor for suspicious referral patterns
4. **Privacy**: Don't expose sensitive user information in referral data
5. **Validation**: Always validate referral codes server-side

## Support

For issues or questions about the referral system:
1. Check this documentation first
2. Review console logs for errors
3. Verify Firestore data structure
4. Check Firebase security rules
5. Test in incognito mode to rule out cache issues

## Version History

- **v1.0** (Current): Initial implementation with basic referral tracking
  - Automatic code generation
  - URL-based tracking
  - Dashboard integration
  - Account page display
  - Real-time verification

---

**Last Updated**: January 2024
**Status**: ✅ Fully Implemented and Tested