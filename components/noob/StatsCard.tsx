"use client";

import { ReactNode } from "react";
import { TrendingUp, TrendingDown } from "lucide-react";

interface StatsCardProps {
  title: string;
  value: string | number;
  change?: number;
  icon?: ReactNode;
  trend?: "up" | "down" | "neutral";
  color?: "blue" | "green" | "red" | "yellow" | "purple" | "gray";
  subtitle?: string;
  onClick?: () => void;
}

const colorClasses = {
  blue: {
    bg: "bg-blue-50",
    icon: "bg-blue-100 text-blue-600",
    trend: "text-blue-600",
  },
  green: {
    bg: "bg-green-50",
    icon: "bg-green-100 text-green-600",
    trend: "text-green-600",
  },
  red: {
    bg: "bg-red-50",
    icon: "bg-red-100 text-red-600",
    trend: "text-red-600",
  },
  yellow: {
    bg: "bg-yellow-50",
    icon: "bg-yellow-100 text-yellow-600",
    trend: "text-yellow-600",
  },
  purple: {
    bg: "bg-purple-50",
    icon: "bg-purple-100 text-purple-600",
    trend: "text-purple-600",
  },
  gray: {
    bg: "bg-gray-50",
    icon: "bg-gray-100 text-gray-600",
    trend: "text-gray-600",
  },
};

export default function StatsCard({
  title,
  value,
  change,
  icon,
  trend = "neutral",
  color = "blue",
  subtitle,
  onClick,
}: StatsCardProps) {
  const colors = colorClasses[color];

  return (
    <div
      className={`bg-white rounded-xl shadow-sm border border-gray-200 p-6 ${
        onClick ? "cursor-pointer hover:shadow-md transition-shadow" : ""
      }`}
      onClick={onClick}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="text-sm font-medium text-gray-500">{title}</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{value}</p>
          {subtitle && (
            <p className="text-xs text-gray-500 mt-1">{subtitle}</p>
          )}
        </div>
        {icon && (
          <div
            className={`w-12 h-12 rounded-lg flex items-center justify-center ${colors.icon}`}
          >
            {icon}
          </div>
        )}
      </div>

      {change !== undefined && (
        <div className="flex items-center mt-4">
          {trend === "up" && (
            <TrendingUp className="w-4 h-4 text-green-500 mr-1" />
          )}
          {trend === "down" && (
            <TrendingDown className="w-4 h-4 text-red-500 mr-1" />
          )}
          <span
            className={`text-sm font-medium ${
              trend === "up"
                ? "text-green-600"
                : trend === "down"
                  ? "text-red-600"
                  : "text-gray-600"
            }`}
          >
            {change > 0 ? "+" : ""}
            {change}%
          </span>
          <span className="text-sm text-gray-500 ml-1">vs last period</span>
        </div>
      )}
    </div>
  );
}
