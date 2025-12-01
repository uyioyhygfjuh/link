"use client";

import { useEffect, useState } from "react";
import { AdminHeader } from "@/components/noob";
import {
  Settings,
  Save,
  Zap,
  Eye,
  EyeOff,
  AlertTriangle,
  RefreshCw,
  Info,
  CheckCircle,
  Crown,
  Sparkles,
  Building2,
  Gift,
} from "lucide-react";

interface PlanData {
  id: string;
  name: string;
  active: boolean;
  monthlyPrice: number;
  maxVideosPerScan: number | "unlimited";
  icon?: string;
}

interface PlanAutoScanConfig {
  maxVideosPerScan: number | "unlimited";
  maxChannels: number | "unlimited";
  maxScansPerChannel: number | "unlimited";
  allowedFrequencies: ("daily" | "weekly" | "monthly")[];
}

interface AutoScanSettings {
  enabledPlans: string[];
  planLimits: Record<string, PlanAutoScanConfig>;
  enabled: boolean;
}

const DEFAULT_PLAN_CONFIG: PlanAutoScanConfig = {
  maxVideosPerScan: 100, // Default to 100 (should match API default)
  maxChannels: 1,
  maxScansPerChannel: 10,
  allowedFrequencies: ["weekly"],
};

const DEFAULT_SETTINGS: AutoScanSettings = {
  enabledPlans: [],
  planLimits: {},
  enabled: true,
};

const PLAN_ICONS: Record<string, any> = {
  free: Gift,
  basic: Sparkles,
  pro: Crown,
  enterprise: Building2,
};

export default function AutoScanSettingsPage() {
  const [settings, setSettings] = useState<AutoScanSettings>(DEFAULT_SETTINGS);
  const [plans, setPlans] = useState<PlanData[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  const loadData = async () => {
    setLoading(true);
    try {
      // Load plans
      const plansRes = await fetch("/api/noob/plans");
      const plansData = await plansRes.json();
      if (plansData.plans) {
        setPlans(plansData.plans.filter((p: PlanData) => p.active).sort((a: PlanData, b: PlanData) => a.monthlyPrice - b.monthlyPrice));
      }

      // Load settings
      const settingsRes = await fetch("/api/noob/auto-scan?type=settings");
      const settingsData = await settingsRes.json();
      if (settingsData.success && settingsData.settings) {
        setSettings({
          ...DEFAULT_SETTINGS,
          ...settingsData.settings,
        });
      }
    } catch (error) {
      console.error("Error loading data:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const togglePlanAutoScan = (planId: string) => {
    setSettings((prev) => {
      const newEnabledPlans = prev.enabledPlans.includes(planId)
        ? prev.enabledPlans.filter((id) => id !== planId)
        : [...prev.enabledPlans, planId];

      // Initialize limits if enabling
      const newLimits = { ...prev.planLimits };
      if (!prev.enabledPlans.includes(planId) && !newLimits[planId]) {
        const plan = plans.find(p => p.id === planId);
        newLimits[planId] = {
          maxVideosPerScan: plan?.maxVideosPerScan || 100, // Default to 100, not 50
          maxChannels: 5,
          maxScansPerChannel: 100,
          allowedFrequencies: ["daily", "weekly", "monthly"],
        };
      }

      return {
        ...prev,
        enabledPlans: newEnabledPlans,
        planLimits: newLimits,
      };
    });
    setHasChanges(true);
  };

  const updatePlanConfig = (
    planId: string,
    field: keyof PlanAutoScanConfig,
    value: number | "unlimited" | ("daily" | "weekly" | "monthly")[]
  ) => {
    setSettings((prev) => ({
      ...prev,
      planLimits: {
        ...prev.planLimits,
        [planId]: {
          ...(prev.planLimits[planId] || DEFAULT_PLAN_CONFIG),
          [field]: value,
        },
      },
    }));
    setHasChanges(true);
  };

  const toggleFrequency = (planId: string, frequency: "daily" | "weekly" | "monthly") => {
    const currentConfig = settings.planLimits[planId] || DEFAULT_PLAN_CONFIG;
    const currentFreqs = currentConfig.allowedFrequencies || [];
    
    const newFreqs = currentFreqs.includes(frequency)
      ? currentFreqs.filter(f => f !== frequency)
      : [...currentFreqs, frequency];

    updatePlanConfig(planId, "allowedFrequencies", newFreqs);
  };

  const saveSettings = async () => {
    setSaving(true);
    try {
      const response = await fetch("/api/noob/auto-scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "updateSettings",
          settings,
        }),
      });

      const data = await response.json();
      if (data.success) {
        alert("Auto-scan settings saved successfully!");
        setHasChanges(false);
      } else {
        alert(data.error || "Failed to save settings");
      }
    } catch (error) {
      console.error("Error saving settings:", error);
      alert("Failed to save settings");
    } finally {
      setSaving(false);
    }
  };

  const getPlanIcon = (planId: string) => {
    const iconKey = planId.toLowerCase().includes("free") ? "free" 
      : planId.toLowerCase().includes("basic") ? "basic"
      : planId.toLowerCase().includes("pro") ? "pro"
      : planId.toLowerCase().includes("enterprise") ? "enterprise"
      : "basic";
    return PLAN_ICONS[iconKey] || Sparkles;
  };

  const formatValue = (value: number | "unlimited" | undefined) => {
    if (value === undefined || value === null) return "0";
    return value === "unlimited" ? "Unlimited" : value.toString();
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <RefreshCw className="w-8 h-8 text-blue-500 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900">
      <AdminHeader
        title="Auto-Scan Settings"
        subtitle="Configure automatic scanning for subscription plans"
        onRefresh={loadData}
        loading={loading}
      />

      <div className="p-6 space-y-8">
        {/* Plan Auto-Scan Configuration Title */}
        <div>
          <h2 className="text-xl font-bold text-white mb-2">Plan Auto-Scan Configuration</h2>
          <p className="text-gray-400">Configure which plans have auto-scan access and their limits</p>
        </div>

        {/* Plan Cards Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {plans.map((plan) => {
            const isEnabled = settings.enabledPlans.includes(plan.id);
            const config = settings.planLimits[plan.id] || DEFAULT_PLAN_CONFIG;
            const PlanIcon = getPlanIcon(plan.id);
            const planVideoLimit = plan.maxVideosPerScan || 100;

            return (
              <div
                key={plan.id}
                className={`rounded-xl border-2 transition-all ${
                  isEnabled 
                    ? "bg-gray-800/80 border-gray-700" 
                    : "bg-gray-800/50 border-gray-700/50"
                }`}
              >
                {/* Plan Header */}
                <div className="p-5 flex items-center justify-between border-b border-gray-700/50">
                  <div className="flex items-center space-x-3">
                    <div className={`p-2 rounded-lg ${
                      isEnabled ? "bg-blue-600/20" : "bg-gray-700/50"
                    }`}>
                      <PlanIcon className={`w-5 h-5 ${isEnabled ? "text-blue-400" : "text-gray-500"}`} />
                    </div>
                    <div>
                      <h3 className="font-semibold text-white">{plan.name}</h3>
                      <p className="text-sm text-gray-400">${plan.monthlyPrice}/month</p>
                    </div>
                  </div>
                  <button
                    onClick={() => togglePlanAutoScan(plan.id)}
                    className={`flex items-center space-x-2 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                      isEnabled
                        ? "bg-green-600/20 text-green-400 border border-green-500/30"
                        : "bg-gray-700 text-gray-400 border border-gray-600"
                    }`}
                  >
                    {isEnabled ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                    <span>{isEnabled ? "Enabled" : "Disabled"}</span>
                  </button>
                </div>

                {/* Plan Body */}
                <div className="p-5">
                  {!isEnabled ? (
                    // Disabled State
                    <div className="text-center py-6">
                      <Zap className="w-10 h-10 text-gray-600 mx-auto mb-3" />
                      <p className="text-gray-500 mb-1">Auto-scan disabled for this plan</p>
                      <p className="text-xs text-gray-600">Enable to configure auto-scan settings</p>
                      <p className="text-sm text-blue-400 mt-3">Video limit: {formatValue(planVideoLimit)} per scan</p>
                    </div>
                  ) : (
                    // Enabled State - Configuration Options
                    <div className="space-y-5">
                      {/* Max Videos Per Scan */}
                      <div className="border-2 border-orange-500/50 rounded-lg p-4 bg-orange-500/5">
                        <label className="flex items-center text-xs font-medium text-orange-400 mb-2">
                          <span className="w-2 h-2 bg-orange-500 rounded-full mr-2"></span>
                          MAX VIDEOS PER SCAN (THIS IS THE VIDEO LIMIT!)
                        </label>
                        <input
                          type={config.maxVideosPerScan === "unlimited" ? "text" : "number"}
                          value={formatValue(config.maxVideosPerScan)}
                          onChange={(e) => {
                            const val = e.target.value.toLowerCase();
                            if (val === "unlimited") {
                              updatePlanConfig(plan.id, "maxVideosPerScan", "unlimited");
                            } else {
                              updatePlanConfig(plan.id, "maxVideosPerScan", parseInt(e.target.value) || 100);
                            }
                          }}
                          className="w-full px-4 py-2.5 bg-gray-900 border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                        />
                        <p className="flex items-center text-xs text-orange-400 mt-2">
                          <AlertTriangle className="w-3.5 h-3.5 mr-1.5" />
                          Set this to 10 to limit ALL scans to 10 videos maximum. Current: {formatValue(config.maxVideosPerScan)}
                        </p>
                      </div>

                      {/* Channel and Scan Limits */}
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-xs font-medium text-gray-400 mb-2">
                            Max Channels for Auto-Scan
                          </label>
                          <input
                            type={config.maxChannels === "unlimited" ? "text" : "number"}
                            value={formatValue(config.maxChannels)}
                            onChange={(e) => {
                              const val = e.target.value.toLowerCase();
                              if (val === "unlimited") {
                                updatePlanConfig(plan.id, "maxChannels", "unlimited");
                              } else {
                                updatePlanConfig(plan.id, "maxChannels", parseInt(e.target.value) || 1);
                              }
                            }}
                            className="w-full px-3 py-2 bg-gray-900 border border-gray-600 rounded-lg text-white text-sm focus:ring-2 focus:ring-blue-500"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-400 mb-2">
                            Max Scans per Channel
                          </label>
                          <input
                            type={config.maxScansPerChannel === "unlimited" ? "text" : "number"}
                            value={formatValue(config.maxScansPerChannel)}
                            onChange={(e) => {
                              const val = e.target.value.toLowerCase();
                              if (val === "unlimited") {
                                updatePlanConfig(plan.id, "maxScansPerChannel", "unlimited");
                              } else {
                                updatePlanConfig(plan.id, "maxScansPerChannel", parseInt(e.target.value) || 10);
                              }
                            }}
                            className="w-full px-3 py-2 bg-gray-900 border border-gray-600 rounded-lg text-white text-sm focus:ring-2 focus:ring-blue-500"
                          />
                        </div>
                      </div>

                      {/* Allowed Frequencies */}
                      <div>
                        <label className="block text-xs font-medium text-gray-400 mb-2">
                          Allowed Frequencies
                        </label>
                        <div className="flex space-x-2">
                          {(["daily", "weekly", "monthly"] as const).map((freq) => (
                            <button
                              key={freq}
                              onClick={() => toggleFrequency(plan.id, freq)}
                              className={`px-4 py-1.5 rounded-lg text-sm font-medium capitalize transition-colors ${
                                config.allowedFrequencies?.includes(freq)
                                  ? "bg-blue-600 text-white"
                                  : "bg-gray-700 text-gray-400 hover:bg-gray-600"
                              }`}
                            >
                              {freq}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Summary */}
                      <div className="pt-3 border-t border-gray-700">
                        <p className="text-sm text-white mb-2">
                          <span className="font-semibold">{plan.name}</span> users can auto-scan:
                        </p>
                        <ul className="space-y-1 text-sm">
                          <li className="text-gray-400">
                            • Up to <span className="text-blue-400">{formatValue(config.maxChannels)}</span> channels
                          </li>
                          <li className="text-gray-400">
                            • <span className="text-blue-400">{formatValue(config.maxScansPerChannel)}</span> times per channel
                          </li>
                          <li className="text-gray-400">
                            • <span className="text-orange-400">{formatValue(config.maxVideosPerScan)} VIDEOS</span> per scan (THIS IS THE LIMIT)
                          </li>
                        </ul>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* How Auto-Scan Works */}
        <div className="bg-gray-800/50 rounded-xl border border-gray-700 p-6">
          <div className="flex items-center space-x-3 mb-4">
            <div className="p-2 bg-blue-600/20 rounded-lg">
              <Info className="w-5 h-5 text-blue-400" />
            </div>
            <h3 className="text-lg font-semibold text-white">How Auto-Scan Works</h3>
          </div>
          <ul className="space-y-3">
            <li className="flex items-start space-x-3 text-gray-300">
              <CheckCircle className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" />
              <span>Users with enabled plans can configure auto-scans on their channel pages</span>
            </li>
            <li className="flex items-start space-x-3 text-gray-300">
              <CheckCircle className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" />
              <span>Scans run automatically during the configured time window</span>
            </li>
            <li className="flex items-start space-x-3 text-gray-300">
              <CheckCircle className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" />
              <span>Rate limits prevent abuse and ensure fair resource distribution</span>
            </li>
            <li className="flex items-start space-x-3 text-gray-300">
              <CheckCircle className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" />
              <span>Users receive notifications based on their preferences</span>
            </li>
          </ul>
        </div>

        {/* Save Button */}
        <div className="flex justify-end space-x-4">
          {hasChanges && (
            <span className="flex items-center text-amber-400 text-sm">
              <AlertTriangle className="w-4 h-4 mr-2" />
              You have unsaved changes
            </span>
          )}
          <button
            onClick={saveSettings}
            disabled={saving || !hasChanges}
            className="flex items-center space-x-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? (
              <>
                <RefreshCw className="w-5 h-5 animate-spin" />
                <span>Saving...</span>
              </>
            ) : (
              <>
                <Save className="w-5 h-5" />
                <span>Save Settings</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
