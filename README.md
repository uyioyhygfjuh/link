# LinkGuard

LinkGuard is a SaaS web application that helps YouTube creators monitor their channels, detect broken/warning links in their videos, and view comprehensive analytics reports.

## Features

- 🔐 **Authentication**: Email/Password and Google Sign-In via Firebase
- 🎨 **Modern UI**: Built with React, Next.js 14, and Tailwind CSS
- 📱 **Responsive Design**: Works seamlessly on desktop and mobile devices
- 🔥 **Firebase Integration**: Authentication and Firestore database
- 🎯 **YouTube Integration**: (Coming Soon) Connect and monitor your YouTube channel
- 📊 **Analytics Dashboard**: (Coming Soon) Track link health and performance

## Tech Stack

- **Frontend**: React 18, Next.js 14 (App Router)
- **Styling**: Tailwind CSS
- **Icons**: Lucide React
- **Backend**: Next.js API Routes
- **Database**: Firebase Firestore
- **Authentication**: Firebase Auth
- **Language**: TypeScript

## Getting Started

### Prerequisites

- Node.js 18+ installed
- Firebase project created
- YouTube Data API credentials (for future features)

### Installation

1. **Install dependencies**:
   ```bash
   npm install
   ```

2. **Set up Firebase**:
   - Create a Firebase project at [https://console.firebase.google.com](https://console.firebase.google.com)
   - Enable Authentication (Email/Password and Google providers)
   - Enable Firestore Database
   - Copy your Firebase configuration

3. **Configure environment variables**:
   - Copy `.env.example` to `.env.local`
   - Fill in your Firebase credentials:
   ```env
   NEXT_PUBLIC_FIREBASE_API_KEY=your_api_key
   NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_auth_domain
   NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
   NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your_storage_bucket
   NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
   NEXT_PUBLIC_FIREBASE_APP_ID=your_app_id
   ```

4. **Run the development server**:
   ```bash
   npm run dev
   ```

5. **Open your browser**:
   Navigate to [http://localhost:3000](http://localhost:3000)

## Project Structure

```
linkguard/
├── app/
│   ├── page.tsx              # Landing page
│   ├── login/
│   │   └── page.tsx          # Login page
│   ├── signup/
│   │   └── page.tsx          # Signup page
│   ├── dashboard/
│   │   └── page.tsx          # Dashboard (placeholder)
│   ├── layout.tsx            # Root layout
│   └── globals.css           # Global styles
├── lib/
│   ├── firebase.ts           # Firebase configuration
│   └── auth.ts               # Authentication utilities
├── public/                   # Static assets
├── .env.example              # Environment variables template
├── package.json              # Dependencies
├── tailwind.config.ts        # Tailwind configuration
└── tsconfig.json             # TypeScript configuration
```

## Current Pages

### 1. Landing Page (`/`)
- Hero section with product overview
- Feature highlights
- Call-to-action buttons
- Responsive navigation

### 2. Login Page (`/login`)
- Email/Password authentication
- Google Sign-In
- "Forgot Password?" link
- Form validation

### 3. Signup Page (`/signup`)
- User registration form
- Password confirmation
- Google Sign-Up
- Terms acceptance
- Form validation

### 4. Dashboard (`/dashboard`)
- Protected route (requires authentication)
- Welcome message
- Placeholder for future features

## Firebase Setup Instructions

### Enable Authentication

1. Go to Firebase Console → Authentication
2. Click "Get Started"
3. Enable "Email/Password" provider
4. Enable "Google" provider
5. Add your domain to authorized domains

### Enable Firestore

1. Go to Firebase Console → Firestore Database
2. Click "Create Database"
3. Choose "Start in test mode" (for development)
4. Select your preferred location

## Development Roadmap

### Phase 1: Authentication ✅ (Current)
- [x] Landing page
- [x] Login page
- [x] Signup page
- [x] Firebase authentication
- [x] Protected routes

### Phase 2: YouTube Integration (Next)
- [ ] YouTube OAuth connection
- [ ] Channel selection
- [ ] Video list fetching
- [ ] Link extraction from descriptions

### Phase 3: Link Monitoring
- [ ] Automated link checking
- [ ] Broken link detection
- [ ] Warning status identification
- [ ] Real-time monitoring

### Phase 4: Analytics & Reports
- [ ] Dashboard with metrics
- [ ] Link health charts
- [ ] Historical data tracking
- [ ] Export reports

## Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm start` - Start production server
- `npm run lint` - Run ESLint

## Environment Variables

All environment variables should be prefixed with `NEXT_PUBLIC_` to be accessible in the browser:

- `NEXT_PUBLIC_FIREBASE_API_KEY` - Firebase API key
- `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` - Firebase auth domain
- `NEXT_PUBLIC_FIREBASE_PROJECT_ID` - Firebase project ID
- `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET` - Firebase storage bucket
- `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID` - Firebase messaging sender ID
- `NEXT_PUBLIC_FIREBASE_APP_ID` - Firebase app ID

## Contributing

This is a step-by-step development project. Each module is built independently and tested before moving to the next phase.

## License

MIT License - feel free to use this project for learning and development.

## Support

For issues or questions, please create an issue in the repository.

---

Built with ❤️ using Next.js, React, and Firebase
