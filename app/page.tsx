'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Shield, Youtube, BarChart3, AlertTriangle, CheckCircle, TrendingUp,
  Zap, Bell, Eye, ArrowRight, Star, Search, Play, Clock,
  Target, Award, Users, Check, Sparkles, Lock, Globe,
  ChevronRight, MessageSquare, Boxes, Link2, ScanLine, BarChart,
  ChevronDown
} from 'lucide-react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { auth } from '@/lib/firebase';

export default function LandingPage() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-white via-blue-50/30 to-white">
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-white/80 backdrop-blur-xl border-b border-blue-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-2">
              <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-500/30 transform hover:scale-105 transition-transform duration-300">
                <Shield className="w-6 h-6 text-white" />
              </div>
              <span className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-blue-700 bg-clip-text text-transparent">
                LinkGuard
              </span>
            </div>

            <div className="hidden md:flex items-center space-x-8">
              <a href="#features" className="text-gray-700 hover:text-blue-600 transition-colors font-medium">Features</a>
              <a href="#pricing" className="text-gray-700 hover:text-blue-600 transition-colors font-medium">Pricing</a>
              <a href="#testimonials" className="text-gray-700 hover:text-blue-600 transition-colors font-medium">Testimonials</a>
            </div>

            <div className="flex items-center space-x-4">
              {loading ? (
                <div className="w-20 h-10 bg-gray-200 rounded-lg animate-pulse"></div>
              ) : user ? (
                <Link
                  href="/dashboard"
                  className="px-6 py-2.5 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-xl font-semibold hover:shadow-lg hover:shadow-blue-500/40 transform hover:scale-105 transition-all duration-300"
                >
                  Dashboard
                </Link>
              ) : (
                <>
                  <Link
                    href="/login"
                    className="px-6 py-2.5 text-blue-600 hover:text-blue-700 font-semibold transition-colors"
                  >
                    Sign In
                  </Link>
                  <Link
                    href="/signup"
                    className="px-6 py-2.5 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-xl font-semibold hover:shadow-lg hover:shadow-blue-500/40 transform hover:scale-105 transition-all duration-300"
                  >
                    Get Started
                  </Link>
                </>
              )}
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative pt-32 pb-20 px-4 sm:px-6 lg:px-8 overflow-hidden">
        <div className="absolute top-20 right-10 w-72 h-72 bg-blue-400/10 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute bottom-20 left-10 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl animate-pulse" style={{animationDelay: '1s'}}></div>

        <div className="max-w-7xl mx-auto relative z-10">
          <div className="text-center">
            <div className="inline-flex items-center space-x-2 bg-gradient-to-r from-blue-100 to-blue-50 border border-blue-200 px-4 py-2 rounded-full mb-8 shadow-sm hover:shadow-md transition-shadow duration-300">
              <Sparkles className="w-4 h-4 text-blue-600" />
              <span className="text-sm font-semibold text-blue-700">Trusted by 10,000+ YouTube Creators</span>
            </div>

            <h1 className="text-5xl md:text-6xl lg:text-7xl font-black mb-6 leading-tight">
              <span className="block text-gray-900">Protect Your</span>
              <span className="block bg-gradient-to-r from-blue-600 via-blue-500 to-blue-700 bg-clip-text text-transparent mt-2">
                YouTube Revenue
              </span>
              <span className="block text-gray-900 mt-2">From Broken Links</span>
            </h1>

            <p className="text-xl md:text-2xl text-gray-600 mb-10 max-w-3xl mx-auto leading-relaxed">
              Automatically monitor, detect, and fix broken links in your YouTube videos before they cost you thousands in lost revenue
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center space-y-4 sm:space-y-0 sm:space-x-4 mb-16">
              <Link
                href="/signup"
                className="group w-full sm:w-auto px-8 py-4 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-xl font-bold text-lg hover:shadow-2xl hover:shadow-blue-500/50 transform hover:scale-105 transition-all duration-300 flex items-center justify-center space-x-2"
              >
                <span>Start Free Trial</span>
                <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </Link>
              <button className="group w-full sm:w-auto px-8 py-4 bg-white text-blue-600 border-2 border-blue-600 rounded-xl font-bold text-lg hover:bg-blue-50 transform hover:scale-105 transition-all duration-300 flex items-center justify-center space-x-2">
                <Play className="w-5 h-5" />
                <span>Watch Demo</span>
              </button>
            </div>

            <div className="flex flex-wrap items-center justify-center gap-8 text-sm text-gray-600">
              <div className="flex items-center space-x-2">
                <Check className="w-5 h-5 text-blue-600" />
                <span>No credit card required</span>
              </div>
              <div className="flex items-center space-x-2">
                <Check className="w-5 h-5 text-blue-600" />
                <span>14-day free trial</span>
              </div>
              <div className="flex items-center space-x-2">
                <Check className="w-5 h-5 text-blue-600" />
                <span>Cancel anytime</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="py-16 px-4 sm:px-6 lg:px-8 bg-gradient-to-r from-blue-600 to-blue-700">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            <div className="text-center group">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-white/20 backdrop-blur-sm rounded-2xl mb-4 group-hover:scale-110 transition-transform duration-300">
                <Users className="w-8 h-8 text-white" />
              </div>
              <div className="text-4xl md:text-5xl font-black text-white mb-2">10,000+</div>
              <div className="text-blue-100 font-medium">Active Creators</div>
            </div>
            <div className="text-center group">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-white/20 backdrop-blur-sm rounded-2xl mb-4 group-hover:scale-110 transition-transform duration-300">
                <Link2 className="w-8 h-8 text-white" />
              </div>
              <div className="text-4xl md:text-5xl font-black text-white mb-2">2M+</div>
              <div className="text-blue-100 font-medium">Links Monitored</div>
            </div>
            <div className="text-center group">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-white/20 backdrop-blur-sm rounded-2xl mb-4 group-hover:scale-110 transition-transform duration-300">
                <TrendingUp className="w-8 h-8 text-white" />
              </div>
              <div className="text-4xl md:text-5xl font-black text-white mb-2">99.9%</div>
              <div className="text-blue-100 font-medium">Uptime</div>
            </div>
            <div className="text-center group">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-white/20 backdrop-blur-sm rounded-2xl mb-4 group-hover:scale-110 transition-transform duration-300">
                <MessageSquare className="w-8 h-8 text-white" />
              </div>
              <div className="text-4xl md:text-5xl font-black text-white mb-2">24/7</div>
              <div className="text-blue-100 font-medium">Support</div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-24 px-4 sm:px-6 lg:px-8 relative">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-blue-400/10 rounded-full blur-3xl"></div>

        <div className="max-w-7xl mx-auto relative z-10">
          <div className="text-center mb-16">
            <div className="inline-flex items-center space-x-2 bg-blue-100 px-4 py-2 rounded-full mb-6">
              <Boxes className="w-4 h-4 text-blue-600" />
              <span className="text-sm font-semibold text-blue-700">POWERFUL FEATURES</span>
            </div>
            <h2 className="text-4xl md:text-5xl font-black text-gray-900 mb-6">
              Everything You Need to
              <span className="block bg-gradient-to-r from-blue-600 to-blue-700 bg-clip-text text-transparent mt-2">
                Protect Your Links
              </span>
            </h2>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto">
              Comprehensive tools designed to keep your YouTube channel's links healthy and your revenue flowing
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            <div className="group bg-white rounded-2xl p-8 shadow-sm border border-blue-100 hover:shadow-2xl hover:shadow-blue-500/20 hover:border-blue-300 transition-all duration-300 hover:-translate-y-2">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-r from-blue-500 to-blue-600 rounded-2xl mb-6 group-hover:scale-110 transition-transform duration-300 shadow-lg shadow-blue-500/30">
                <Shield className="w-8 h-8 text-white" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-4">Automatic Link Monitoring</h3>
              <p className="text-gray-600 leading-relaxed">Continuously scan all your YouTube video descriptions for broken or outdated links 24/7.</p>
            </div>

            <div className="group bg-white rounded-2xl p-8 shadow-sm border border-blue-100 hover:shadow-2xl hover:shadow-blue-500/20 hover:border-blue-300 transition-all duration-300 hover:-translate-y-2">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-r from-blue-400 to-blue-500 rounded-2xl mb-6 group-hover:scale-110 transition-transform duration-300 shadow-lg shadow-blue-500/30">
                <Bell className="w-8 h-8 text-white" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-4">Instant Notifications</h3>
              <p className="text-gray-600 leading-relaxed">Get real-time alerts when broken links are detected so you can fix them immediately.</p>
            </div>

            <div className="group bg-white rounded-2xl p-8 shadow-sm border border-blue-100 hover:shadow-2xl hover:shadow-blue-500/20 hover:border-blue-300 transition-all duration-300 hover:-translate-y-2">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-r from-blue-600 to-blue-700 rounded-2xl mb-6 group-hover:scale-110 transition-transform duration-300 shadow-lg shadow-blue-500/30">
                <BarChart3 className="w-8 h-8 text-white" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-4">Analytics Dashboard</h3>
              <p className="text-gray-600 leading-relaxed">Track link performance, click rates, and health status across all your videos.</p>
            </div>

            <div className="group bg-white rounded-2xl p-8 shadow-sm border border-blue-100 hover:shadow-2xl hover:shadow-blue-500/20 hover:border-blue-300 transition-all duration-300 hover:-translate-y-2">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-r from-blue-500 to-blue-600 rounded-2xl mb-6 group-hover:scale-110 transition-transform duration-300 shadow-lg shadow-blue-500/30">
                <Youtube className="w-8 h-8 text-white" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-4">YouTube Integration</h3>
              <p className="text-gray-600 leading-relaxed">Seamlessly connect your YouTube channel and manage all your links in one place.</p>
            </div>

            <div className="group bg-white rounded-2xl p-8 shadow-sm border border-blue-100 hover:shadow-2xl hover:shadow-blue-500/20 hover:border-blue-300 transition-all duration-300 hover:-translate-y-2">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-r from-blue-400 to-blue-500 rounded-2xl mb-6 group-hover:scale-110 transition-transform duration-300 shadow-lg shadow-blue-500/30">
                <Clock className="w-8 h-8 text-white" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-4">Historical Reports</h3>
              <p className="text-gray-600 leading-relaxed">Access detailed reports and track link health trends over time.</p>
            </div>

            <div className="group bg-white rounded-2xl p-8 shadow-sm border border-blue-100 hover:shadow-2xl hover:shadow-blue-500/20 hover:border-blue-300 transition-all duration-300 hover:-translate-y-2">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-r from-blue-600 to-blue-700 rounded-2xl mb-6 group-hover:scale-110 transition-transform duration-300 shadow-lg shadow-blue-500/30">
                <Zap className="w-8 h-8 text-white" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-4">Lightning Fast Scans</h3>
              <p className="text-gray-600 leading-relaxed">Scan hundreds of videos in seconds with our optimized scanning engine.</p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-gradient-to-r from-blue-600 to-blue-700">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl md:text-5xl font-black text-white mb-6">
            Ready to Protect Your Revenue?
          </h2>
          <p className="text-xl text-blue-100 mb-10">
            Join thousands of creators who never worry about broken links again
          </p>
          <Link
            href="/signup"
            className="inline-flex items-center space-x-2 px-10 py-5 bg-white text-blue-600 rounded-xl font-bold text-lg hover:shadow-2xl transform hover:scale-105 transition-all duration-300"
          >
            <span>Get Started Free</span>
            <ArrowRight className="w-5 h-5" />
          </Link>
          <p className="text-blue-100 mt-6">No credit card required • Start in 2 minutes</p>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-white border-t border-blue-100 py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-12 mb-12">
            <div className="col-span-2">
              <div className="flex items-center space-x-2 mb-6">
                <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl flex items-center justify-center shadow-lg">
                  <Shield className="w-6 h-6 text-white" />
                </div>
                <span className="text-2xl font-bold text-gray-900">LinkGuard</span>
              </div>
              <p className="text-gray-600 leading-relaxed max-w-md mb-6">
                Protect your YouTube revenue with automated link monitoring. Never lose money to broken links again.
              </p>
            </div>

            <div>
              <h4 className="font-semibold text-gray-900 mb-4">Product</h4>
              <ul className="space-y-3">
                <li><Link href="/pricing" className="text-gray-600 hover:text-blue-600 transition-colors">Pricing</Link></li>
                <li><Link href="/dashboard" className="text-gray-600 hover:text-blue-600 transition-colors">Dashboard</Link></li>
                <li><a href="#features" className="text-gray-600 hover:text-blue-600 transition-colors">Features</a></li>
              </ul>
            </div>

            <div>
              <h4 className="font-semibold text-gray-900 mb-4">Company</h4>
              <ul className="space-y-3">
                <li><a href="#" className="text-gray-600 hover:text-blue-600 transition-colors">About</a></li>
                <li><a href="#" className="text-gray-600 hover:text-blue-600 transition-colors">Contact</a></li>
                <li><a href="#" className="text-gray-600 hover:text-blue-600 transition-colors">Blog</a></li>
              </ul>
            </div>
          </div>

          <div className="border-t border-blue-100 pt-8 flex flex-col md:flex-row justify-between items-center">
            <div className="text-gray-600 text-sm mb-4 md:mb-0">
              © 2025 LinkGuard. All rights reserved.
            </div>
            <div className="flex items-center space-x-6">
              <a href="#" className="text-gray-600 hover:text-blue-600 transition-colors text-sm">Privacy Policy</a>
              <a href="#" className="text-gray-600 hover:text-blue-600 transition-colors text-sm">Terms of Service</a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
