# 🚀 LinkGuard - Quick Start Guide

## ⚡ Get Running in 5 Minutes

### 1️⃣ Dependencies Installed ✅
Your dependencies are already installed!

### 2️⃣ Server Running ✅
Your development server is running at: **http://localhost:3000**

### 3️⃣ Configure Firebase (Required for Authentication)

#### Quick Firebase Setup:

1. **Go to Firebase Console**: https://console.firebase.google.com
2. **Create/Select Project**
3. **Enable Authentication**:
   - Click Authentication → Get Started
   - Enable "Email/Password"
   - Enable "Google"
4. **Enable Firestore**:
   - Click Firestore Database → Create Database
   - Choose "Test mode"
5. **Get Config**:
   - Project Settings → Your apps → Web app
   - Copy the config values

#### Add to `.env.local`:

Create a file named `.env.local` in the root folder and paste:

```env
NEXT_PUBLIC_FIREBASE_API_KEY=your_api_key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
NEXT_PUBLIC_FIREBASE_APP_ID=your_app_id
```

**Important**: Restart the server after adding `.env.local`

### 4️⃣ Test Your App

Visit these pages:

- **Landing Page**: http://localhost:3000
- **Signup**: http://localhost:3000/signup
- **Login**: http://localhost:3000/login
- **Dashboard**: http://localhost:3000/dashboard (requires login)

## 📱 What You Can Do Now

### ✅ Working Features:
- Browse the landing page
- Create an account (after Firebase config)
- Login with email/password
- Login with Google
- Access protected dashboard
- Logout functionality

### 🎨 Pages Built:
1. **Landing Page** - Beautiful hero + features
2. **Signup Page** - Create account
3. **Login Page** - Sign in
4. **Dashboard** - Protected area

## 🔧 Common Commands

```bash
# Start development server
npm run dev

# Build for production
npm run build

# Start production server
npm start

# Run linter
npm run lint
```

## 🐛 Troubleshooting

### Firebase not working?
1. Check `.env.local` exists
2. Verify all values are correct
3. Restart server: Stop (Ctrl+C) → `npm run dev`

### Styling broken?
1. Clear cache: Delete `.next` folder
2. Restart: `npm run dev`

### Module errors?
1. Reinstall: `npm install`
2. Restart server

## 📚 Documentation

- **SETUP.md** - Detailed setup instructions
- **README.md** - Full project documentation
- **PROJECT_SUMMARY.md** - Complete feature list

## 🎯 Next Steps

1. ✅ Configure Firebase
2. ✅ Test authentication
3. ⏳ Build YouTube integration (Phase 2)
4. ⏳ Add link monitoring (Phase 3)
5. ⏳ Create analytics (Phase 4)

## 💡 Tips

- Use Chrome DevTools to debug
- Check Firebase Console for auth logs
- Browser console shows client errors
- All pages are responsive

---

**Need Help?** Check SETUP.md for detailed instructions!

**Status**: Phase 1 Complete - Authentication Module ✅
