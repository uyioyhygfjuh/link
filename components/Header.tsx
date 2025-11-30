'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { User } from 'firebase/auth';
import { Shield, LogOut, Menu, X, UserCircle, Settings, ChevronDown } from 'lucide-react';
import NotificationBell from './NotificationBell';

interface HeaderProps {
  user: User | null;
  onLogout: () => void;
}

export default function Header({ user, onLogout }: HeaderProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [profileDropdownOpen, setProfileDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const pathname = usePathname();

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setProfileDropdownOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const isActive = (path: string) => {
    return pathname === path || pathname?.startsWith(path + '/');
  };

  const navLinks = [
    { href: '/dashboard', label: 'Dashboard' },
    { href: '/channels', label: 'Channels' },
    { href: '/Channel-Report', label: 'Channel Reports' },
    { href: '/Video', label: 'Video' },
    { href: '/Video-Result', label: 'Video Results' },
    { href: '/pricing', label: 'Pricing' },
  ];

  return (
    <nav className="bg-white shadow-sm border-b border-gray-200 sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Logo and Desktop Navigation */}
          <div className="flex items-center space-x-8">
            <Link href="/dashboard" prefetch={false} className="flex items-center space-x-2">
              <Shield className="w-8 h-8 text-primary-600" />
              <span className="text-xl font-bold text-gray-900">LinkGuard</span>
            </Link>
            
            <div className="hidden md:flex items-center space-x-6">
              {navLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  prefetch={false}
                  className={`transition-colors ${
                    isActive(link.href)
                      ? 'text-primary-600 font-semibold'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  {link.label}
                </Link>
              ))}
            </div>
          </div>

          {/* Desktop User Menu */}
          <div className="flex items-center space-x-2">
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden p-2 rounded-lg hover:bg-gray-100"
            >
              {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>

            {/* Notification Bell */}
            <div className="hidden md:block">
              <NotificationBell user={user} />
            </div>

            {/* Profile Dropdown */}
            <div className="hidden md:block relative" ref={dropdownRef}>
              <button
                onClick={() => setProfileDropdownOpen(!profileDropdownOpen)}
                className="flex items-center space-x-2 px-3 py-2 rounded-lg hover:bg-gray-100 transition-colors"
              >
                <div className="w-9 h-9 bg-primary-600 rounded-full flex items-center justify-center text-white font-semibold overflow-hidden">
                  {user?.photoURL ? (
                    <img 
                      src={user.photoURL} 
                      alt="Profile" 
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <span>{user?.displayName?.charAt(0) || user?.email?.charAt(0) || 'U'}</span>
                  )}
                </div>
                <ChevronDown className={`w-4 h-4 text-gray-600 transition-transform ${profileDropdownOpen ? 'rotate-180' : ''}`} />
              </button>

              {/* Dropdown Menu */}
              {profileDropdownOpen && (
                <div className="absolute right-0 mt-2 w-56 bg-white rounded-lg shadow-lg border border-gray-200 py-2">
                  {/* User Info */}
                  <div className="px-4 py-3 border-b border-gray-200">
                    <p className="text-sm font-medium text-gray-900 truncate">
                      {user?.displayName || 'User'}
                    </p>
                    <p className="text-xs text-gray-500 truncate">
                      {user?.email}
                    </p>
                  </div>

                  {/* Account Link */}
                  <Link
                    href="/Account"
                    prefetch={false}
                    onClick={() => setProfileDropdownOpen(false)}
                    className="flex items-center space-x-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                  >
                    <Settings className="w-4 h-4" />
                    <span>Account Settings</span>
                  </Link>

                  {/* Divider */}
                  <div className="border-t border-gray-200 my-2"></div>

                  {/* Logout */}
                  <button
                    onClick={() => {
                      setProfileDropdownOpen(false);
                      onLogout();
                    }}
                    className="w-full flex items-center space-x-2 px-4 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors"
                  >
                    <LogOut className="w-4 h-4" />
                    <span>Log Out</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Mobile Menu */}
        {mobileMenuOpen && (
          <div className="md:hidden py-4 border-t border-gray-200">
            <div className="flex flex-col space-y-3">
              {navLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  prefetch={false}
                  onClick={() => setMobileMenuOpen(false)}
                  className={`px-4 py-2 rounded-lg ${
                    isActive(link.href)
                      ? 'text-primary-600 font-semibold bg-primary-50'
                      : 'text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  {link.label}
                </Link>
              ))}
              
              {/* Notification Bell for Mobile */}
              <div className="px-4 py-2">
                <NotificationBell user={user} />
              </div>
              
              {/* User Info */}
              <div className="flex items-center space-x-2 px-4 py-3 border-t border-gray-200 mt-2">
                <div className="w-8 h-8 bg-primary-600 rounded-full flex items-center justify-center text-white text-sm overflow-hidden">
                  {user?.photoURL ? (
                    <img 
                      src={user.photoURL} 
                      alt="Profile" 
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <span>{user?.displayName?.charAt(0) || user?.email?.charAt(0) || 'U'}</span>
                  )}
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-900 truncate">
                    {user?.displayName || 'User'}
                  </p>
                  <p className="text-xs text-gray-500 truncate">
                    {user?.email}
                  </p>
                </div>
              </div>
              
              {/* Account Link */}
              <Link
                href="/Account"
                prefetch={false}
                onClick={() => setMobileMenuOpen(false)}
                className="flex items-center space-x-2 px-4 py-2 text-gray-700 hover:bg-gray-50 rounded-lg transition-colors"
              >
                <Settings className="w-4 h-4" />
                <span>Account Settings</span>
              </Link>
              
              {/* Logout */}
              <button
                onClick={() => {
                  setMobileMenuOpen(false);
                  onLogout();
                }}
                className="w-full flex items-center space-x-2 px-4 py-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
              >
                <LogOut className="w-4 h-4" />
                <span>Log Out</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </nav>
  );
}
