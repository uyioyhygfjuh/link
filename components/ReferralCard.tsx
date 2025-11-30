'use client';

import { useState, useEffect } from 'react';
import { User } from 'firebase/auth';
import { Users, Copy, Check, Share2, Gift, TrendingUp } from 'lucide-react';
import { getReferralData, generateReferralLink, ReferralData } from '@/lib/referral';

interface ReferralCardProps {
  user: User;
}

export default function ReferralCard({ user }: ReferralCardProps) {
  const [referralData, setReferralData] = useState<ReferralData | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [referralLink, setReferralLink] = useState('');

  useEffect(() => {
    loadReferralData();
  }, [user]);

  const loadReferralData = async () => {
    try {
      const data = await getReferralData(user.uid);
      if (data) {
        setReferralData(data);
        const link = generateReferralLink(data.referralCode);
        setReferralLink(link);
      }
    } catch (error) {
      console.error('Error loading referral data:', error);
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(referralLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error('Failed to copy:', error);
    }
  };

  const shareReferral = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Join LinkGuard',
          text: 'Check out LinkGuard - the best YouTube link monitoring tool!',
          url: referralLink,
        });
      } catch (error) {
        console.error('Error sharing:', error);
      }
    } else {
      copyToClipboard();
    }
  };

  if (loading) {
    return (
      <div className="card animate-pulse">
        <div className="h-6 bg-gray-200 rounded w-1/3 mb-4"></div>
        <div className="h-4 bg-gray-200 rounded w-2/3"></div>
      </div>
    );
  }

  if (!referralData) {
    return null;
  }

  return (
    <div className="card bg-gradient-to-br from-primary-50 to-purple-50 border-primary-200">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center space-x-3">
          <div className="p-2 bg-primary-600 rounded-lg">
            <Users className="w-6 h-6 text-white" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Referral Program</h3>
            <p className="text-sm text-gray-600">Share and earn rewards</p>
          </div>
        </div>
        <div className="p-3 bg-white rounded-lg border border-primary-200">
          <Gift className="w-6 h-6 text-primary-600" />
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="bg-white rounded-lg p-4 border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Total Referrals</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">{referralData.referralCount}</p>
            </div>
            <TrendingUp className="w-8 h-8 text-green-500" />
          </div>
        </div>
        <div className="bg-white rounded-lg p-4 border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Total Earnings</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">${referralData.totalEarnings}</p>
            </div>
            <Gift className="w-8 h-8 text-primary-600" />
          </div>
        </div>
      </div>

      {/* Referral Code Display */}
      <div className="bg-white rounded-lg p-4 border border-gray-200 mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Your Referral Code
        </label>
        <div className="flex items-center space-x-2">
          <div className="flex-1 p-3 bg-gray-50 rounded-lg border border-gray-200 font-mono text-lg font-bold text-primary-600">
            {referralData.referralCode}
          </div>
          <button
            onClick={copyToClipboard}
            className="p-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
            title="Copy code"
          >
            {copied ? <Check className="w-5 h-5" /> : <Copy className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Referral Link */}
      <div className="bg-white rounded-lg p-4 border border-gray-200 mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Your Referral Link
        </label>
        <div className="flex items-center space-x-2">
          <input
            type="text"
            value={referralLink}
            readOnly
            className="flex-1 p-3 bg-gray-50 rounded-lg border border-gray-200 text-sm text-gray-700 font-mono"
          />
          <button
            onClick={copyToClipboard}
            className="p-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
            title="Copy link"
          >
            {copied ? <Check className="w-5 h-5" /> : <Copy className="w-5 h-5" />}
          </button>
          <button
            onClick={shareReferral}
            className="p-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
            title="Share link"
          >
            <Share2 className="w-5 h-5" />
          </button>
        </div>
        {copied && (
          <p className="text-xs text-green-600 mt-2 flex items-center space-x-1">
            <Check className="w-3 h-3" />
            <span>Copied to clipboard!</span>
          </p>
        )}
      </div>

      {/* How it works */}
      <div className="bg-white rounded-lg p-4 border border-gray-200">
        <h4 className="text-sm font-semibold text-gray-900 mb-2">How it works</h4>
        <ul className="space-y-2 text-xs text-gray-600">
          <li className="flex items-start space-x-2">
            <span className="text-primary-600 font-bold">1.</span>
            <span>Share your referral link or code with friends</span>
          </li>
          <li className="flex items-start space-x-2">
            <span className="text-primary-600 font-bold">2.</span>
            <span>They sign up using your link or enter your code</span>
          </li>
          <li className="flex items-start space-x-2">
            <span className="text-primary-600 font-bold">3.</span>
            <span>You both get rewards when they upgrade to a paid plan</span>
          </li>
        </ul>
      </div>

      {/* Recent Referrals */}
      {referralData.referrals && referralData.referrals.length > 0 && (
        <div className="mt-4 bg-white rounded-lg p-4 border border-gray-200">
          <h4 className="text-sm font-semibold text-gray-900 mb-3">Recent Referrals</h4>
          <div className="space-y-2">
            {referralData.referrals.slice(0, 3).map((referral, index) => (
              <div
                key={index}
                className="flex items-center justify-between p-2 bg-gray-50 rounded-lg"
              >
                <div className="flex items-center space-x-3">
                  <div className="w-8 h-8 bg-primary-100 rounded-full flex items-center justify-center">
                    <span className="text-sm font-semibold text-primary-600">
                      {referral.userName.charAt(0).toUpperCase()}
                    </span>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-900">{referral.userName}</p>
                    <p className="text-xs text-gray-500">
                      {new Date(referral.signupDate).toLocaleDateString()}
                    </p>
                  </div>
                </div>
                <span
                  className={`text-xs px-2 py-1 rounded-full ${
                    referral.status === 'active'
                      ? 'bg-green-100 text-green-700'
                      : 'bg-gray-100 text-gray-700'
                  }`}
                >
                  {referral.status}
                </span>
              </div>
            ))}
          </div>
          {referralData.referrals.length > 3 && (
            <p className="text-xs text-gray-500 mt-2 text-center">
              +{referralData.referrals.length - 3} more referrals
            </p>
          )}
        </div>
      )}
    </div>
  );
}
