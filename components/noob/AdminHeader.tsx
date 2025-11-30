"use client";

import { useState } from "react";
import { Search, Bell, RefreshCw, ExternalLink } from "lucide-react";
import Link from "next/link";

interface AdminHeaderProps {
  title: string;
  subtitle?: string;
  onRefresh?: () => void;
  loading?: boolean;
}

export default function AdminHeader({
  title,
  subtitle,
  onRefresh,
  loading = false,
}: AdminHeaderProps) {
  const [searchQuery, setSearchQuery] = useState("");

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      // Navigate to users page with search query
      window.location.href = `/noob/users?search=${encodeURIComponent(searchQuery)}`;
    }
  };

  return (
    <header className="bg-white border-b border-gray-200 px-6 py-4">
      <div className="flex items-center justify-between">
        {/* Title */}
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{title}</h1>
          {subtitle && <p className="text-sm text-gray-500 mt-1">{subtitle}</p>}
        </div>

        {/* Actions */}
        <div className="flex items-center space-x-4">
          {/* Global Search */}
          <form onSubmit={handleSearch} className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search users, channels..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none w-64"
            />
          </form>

          {/* Refresh Button */}
          {onRefresh && (
            <button
              onClick={onRefresh}
              disabled={loading}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50"
              title="Refresh data"
            >
              <RefreshCw
                className={`w-5 h-5 text-gray-600 ${loading ? "animate-spin" : ""}`}
              />
            </button>
          )}

          {/* Quick Link to Main App */}
          <Link
            href="/dashboard"
            className="flex items-center space-x-1 px-3 py-2 text-sm text-gray-600 hover:text-primary-600 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <span>View App</span>
            <ExternalLink className="w-4 h-4" />
          </Link>
        </div>
      </div>
    </header>
  );
}
