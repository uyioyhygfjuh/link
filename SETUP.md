# LinkGuard - Setup Guide

## 🚀 Quick Start

Your LinkGuard application is now running at **http://localhost:3000**

## ⚙️ Firebase Configuration Required

To enable authentication, you need to configure Firebase:

### Step 1: Create Firebase Project

1. Go to [Firebase Console](https://console.firebase.google.com)
2. Click "Add Project" or select existing project
3. Follow the setup wizard

### Step 2: Enable Authentication

1. In Firebase Console, go to **Authentication**
2. Click "Get Started"
3. Enable these sign-in methods:
   - **Email/Password**: Toggle ON
   - **Google**: Toggle ON and configure

### Step 3: Enable Firestore Database

1. In Firebase Console, go to **Firestore Database**
2. Click "Create Database"
3. Choose "Start in test mode" (for development)
4. Select your preferred location

### Step 4: Get Firebase Configuration

1. Go to **Project Settings** (gear icon)
2. Scroll down to "Your apps"
3. Click the web icon `</>` to add a web app
4. Register your app (name it "LinkGuard")
5. Copy the Firebase configuration object

### Step 5: Configure Environment Variables

1. Create a file named `.env.local` in the project root
2. Add your Firebase credentials:

```env
NEXT_PUBLIC_FIREBASE_API_KEY=your_api_key_here
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_project_id.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your_project_id.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
NEXT_PUBLIC_FIREBASE_APP_ID=your_app_id
```

3. **Restart the development server** after adding environment variables:
   - Stop the server (Ctrl+C)
   - Run `npm run dev` again

## 📱 Testing the Application

### 1. Landing Page (/)
- Beautiful hero section
- Feature highlights
- Navigation to Login/Signup

### 2. Signup Page (/signup)
- Create account with email/password
- Or sign up with Google
- Form validation included
- Password confirmation

### 3. Login Page (/login)
- Login with email/password
- Or login with Google
- "Forgot Password?" link
- Remember me option

### 4. Dashboard (/dashboard)
- Protected route (requires authentication)
- Displays user information
- Placeholder for future features

## 🔒 Security Notes

- Never commit `.env.local` to version control (already in .gitignore)
- Use Firebase Security Rules in production
- Enable App Check for additional security
- Review Firebase Authentication settings

## 🎨 Customization

### Colors
Edit `tailwind.config.ts` to change the primary color scheme:
```typescript
colors: {
  primary: {
    // Modify these values
    500: '#3b82f6',
    600: '#2563eb',
    // ...
  }
}
```

### Logo
Replace the Shield icon in components with your custom logo

### Content
Update text in:
- `app/page.tsx` - Landing page content
- `app/login/page.tsx` - Login page text
- `app/signup/page.tsx` - Signup page text

## 📦 Project Structure

```
linkguard/
├── app/                    # Next.js app directory
│   ├── page.tsx           # Landing page
│   ├── login/             # Login page
│   ├── signup/            # Signup page
│   ├── dashboard/         # Dashboard (protected)
│   ├── layout.tsx         # Root layout
│   └── globals.css        # Global styles
├── lib/                   # Utility functions
│   ├── firebase.ts        # Firebase config
│   └── auth.ts            # Auth helpers
├── .env.local            # Environment variables (create this)
├── .env.example          # Environment template
└── package.json          # Dependencies
```

## 🛠️ Available Scripts

```bash
# Development server
npm run dev

# Build for production
npm run build

# Start production server
npm start

# Run linter
npm run lint
```

## 🐛 Troubleshooting

### "Firebase not configured" error
- Make sure `.env.local` exists with correct values
- Restart the development server after adding env variables

### Google Sign-In not working
- Enable Google provider in Firebase Console
- Add authorized domains in Firebase Authentication settings
- For localhost, it should work automatically

### "Module not found" errors
- Run `npm install` to ensure all dependencies are installed
- Clear `.next` folder and restart: `rm -rf .next && npm run dev`

### Styling not working
- Make sure Tailwind CSS is properly configured
- Check `tailwind.config.ts` includes all content paths
- Restart dev server

## 📚 Next Steps

After authentication is working:

1. **Test all authentication flows**:
   - Email/Password signup
   - Email/Password login
   - Google authentication
   - Password reset (if implemented)

2. **Prepare for Phase 2**:
   - YouTube Data API setup
   - OAuth 2.0 configuration
   - Channel connection flow

3. **Customize the design**:
   - Update colors and branding
   - Add your logo
   - Modify content

## 🆘 Need Help?

- Check Firebase Console for error logs
- Review browser console for client-side errors
- Verify all environment variables are set correctly
- Ensure Firebase project has correct permissions

---

**Current Status**: ✅ Authentication Module Complete

**Next Phase**: YouTube Integration (Coming Soon)
