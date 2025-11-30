"use client";

import { useEffect, useState } from "react";
import { AdminHeader, StatsCard } from "@/components/noob";
import {
  CreditCard,
  Plus,
  Edit,
  Trash2,
  Check,
  X,
  Star,
  DollarSign,
  Users,
  Zap,
  ArrowUp,
  ArrowDown,
  Eye,
  EyeOff,
  Save,
  RefreshCw,
  Gift,
  UserCheck,
  UserX,
  Crown,
  Rocket,
  Building2,
  Youtube,
  Shield,
  Sparkles,
  Gem,
  Award,
  Target,
  Flame,
  Briefcase,
  Globe,
  Heart,
  type LucideIcon,
} from "lucide-react";

// Available icons for plans
const AVAILABLE_ICONS: { name: string; icon: LucideIcon; label: string }[] = [
  { name: "zap", icon: Zap, label: "Zap (Lightning Bolt)" },
  { name: "youtube", icon: Youtube, label: "YouTube" },
  { name: "crown", icon: Crown, label: "Crown" },
  { name: "building2", icon: Building2, label: "Building" },
  { name: "rocket", icon: Rocket, label: "Rocket" },
  { name: "shield", icon: Shield, label: "Shield" },
  { name: "sparkles", icon: Sparkles, label: "Sparkles" },
  { name: "gem", icon: Gem, label: "Gem" },
  { name: "award", icon: Award, label: "Award" },
  { name: "target", icon: Target, label: "Target" },
  { name: "flame", icon: Flame, label: "Flame" },
  { name: "star", icon: Star, label: "Star" },
  { name: "briefcase", icon: Briefcase, label: "Briefcase" },
  { name: "globe", icon: Globe, label: "Globe" },
  { name: "heart", icon: Heart, label: "Heart" },
  { name: "users", icon: Users, label: "Users" },
  { name: "gift", icon: Gift, label: "Gift" },
  { name: "credit-card", icon: CreditCard, label: "Credit Card" },
];

// Helper to get icon component by name
const getIconByName = (iconName: string): LucideIcon => {
  const found = AVAILABLE_ICONS.find((i) => i.name === iconName);
  return found?.icon || Zap;
};

type PlanVisibility = "all" | "referred" | "non-referred";

interface PlanFeatures {
  channels: string;
  scans: string;
  extract: string;
  videos: string;
  bulkScan: string;
  support: string;
}

interface Plan {
  id: string;
  name: string;
  description: string;
  icon: string;
  monthlyPrice: number;
  yearlyPrice: number;
  yearlyDiscount: number;
  popular: boolean;
  popularForReferred: boolean;
  order: number;
  active: boolean;
  visibility: PlanVisibility;
  referralDiscount: number;
  referralBadge?: string;
  maxChannels: number | "unlimited";
  maxVideosPerScan: number | "unlimited";
  maxBulkVideosPerRun: number | "unlimited";
  maxScans: number | "unlimited";
  maxChannelExtracts: number | "unlimited";
  features: PlanFeatures;
  additionalFeatures: string[];
  limitations: string[];
  stripePriceIdMonthly?: string;
  stripePriceIdYearly?: string;
}

const emptyPlan: Omit<Plan, "id"> = {
  name: "",
  description: "",
  icon: "zap",
  monthlyPrice: 0,
  yearlyPrice: 0,
  yearlyDiscount: 20,
  popular: false,
  popularForReferred: false,
  order: 99,
  active: true,
  visibility: "all",
  referralDiscount: 0,
  referralBadge: "",
  maxChannels: 1,
  maxVideosPerScan: 50,
  maxBulkVideosPerRun: 10,
  maxScans: 2,
  maxChannelExtracts: 2,
  features: {
    channels: "1 Channel",
    scans: "2 Scans",
    extract: "2 Extracts",
    videos: "50 Videos",
    bulkScan: "10 Videos",
    support: "Email Support",
  },
  additionalFeatures: [],
  limitations: [],
  stripePriceIdMonthly: "",
  stripePriceIdYearly: "",
};

export default function PlansPage() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [editingPlan, setEditingPlan] = useState<Plan | null>(null);
  const [planToDelete, setPlanToDelete] = useState<Plan | null>(null);
  const [formData, setFormData] = useState<Omit<Plan, "id"> & { id: string }>({
    id: "",
    ...emptyPlan,
  });
  const [saving, setSaving] = useState(false);
  const [newFeature, setNewFeature] = useState("");
  const [newLimitation, setNewLimitation] = useState("");

  const loadPlans = async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/noob/plans?includeInactive=true");
      const data = await response.json();
      setPlans(data.plans || []);
    } catch (error) {
      console.error("Error loading plans:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPlans();
  }, []);

  const openCreateModal = () => {
    setEditingPlan(null);
    setFormData({ id: "", ...emptyPlan });
    setShowModal(true);
  };

  const openEditModal = (plan: Plan) => {
    setEditingPlan(plan);
    setFormData({ ...plan });
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!formData.id || !formData.name) {
      alert("Plan ID and Name are required");
      return;
    }

    setSaving(true);
    try {
      if (editingPlan) {
        // Update existing plan
        const response = await fetch("/api/noob/plans", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ planId: editingPlan.id, updates: formData }),
        });
        const data = await response.json();
        if (data.success) {
          alert("Plan updated successfully");
          setShowModal(false);
          loadPlans();
        } else {
          alert(data.error || "Failed to update plan");
        }
      } else {
        // Create new plan
        const response = await fetch("/api/noob/plans", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ plan: formData }),
        });
        const data = await response.json();
        if (data.success) {
          alert("Plan created successfully");
          setShowModal(false);
          loadPlans();
        } else {
          alert(data.error || "Failed to create plan");
        }
      }
    } catch (error) {
      console.error("Error saving plan:", error);
      alert("Failed to save plan");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!planToDelete) return;

    setSaving(true);
    try {
      const response = await fetch(
        `/api/noob/plans?planId=${planToDelete.id}`,
        { method: "DELETE" }
      );
      const data = await response.json();
      if (data.success) {
        alert("Plan deleted successfully");
        setShowDeleteModal(false);
        setPlanToDelete(null);
        loadPlans();
      } else {
        alert(data.error || "Failed to delete plan");
      }
    } catch (error) {
      console.error("Error deleting plan:", error);
      alert("Failed to delete plan");
    } finally {
      setSaving(false);
    }
  };

  const togglePlanActive = async (plan: Plan) => {
    try {
      const response = await fetch("/api/noob/plans", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          planId: plan.id,
          updates: { active: !plan.active },
        }),
      });
      const data = await response.json();
      if (data.success) {
        loadPlans();
      }
    } catch (error) {
      console.error("Error toggling plan:", error);
    }
  };

  const togglePopular = async (plan: Plan) => {
    try {
      // First, remove popular from all other plans
      for (const p of plans) {
        if (p.popular && p.id !== plan.id) {
          await fetch("/api/noob/plans", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ planId: p.id, updates: { popular: false } }),
          });
        }
      }
      // Set this plan as popular
      await fetch("/api/noob/plans", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          planId: plan.id,
          updates: { popular: !plan.popular },
        }),
      });
      loadPlans();
    } catch (error) {
      console.error("Error toggling popular:", error);
    }
  };

  const updateOrder = async (plan: Plan, direction: "up" | "down") => {
    const currentIndex = plans.findIndex((p) => p.id === plan.id);
    const newIndex = direction === "up" ? currentIndex - 1 : currentIndex + 1;

    if (newIndex < 0 || newIndex >= plans.length) return;

    const otherPlan = plans[newIndex];
    try {
      await fetch("/api/noob/plans", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          planId: plan.id,
          updates: { order: otherPlan.order },
        }),
      });
      await fetch("/api/noob/plans", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          planId: otherPlan.id,
          updates: { order: plan.order },
        }),
      });
      loadPlans();
    } catch (error) {
      console.error("Error updating order:", error);
    }
  };

  const addFeature = () => {
    if (newFeature.trim()) {
      setFormData({
        ...formData,
        additionalFeatures: [...formData.additionalFeatures, newFeature.trim()],
      });
      setNewFeature("");
    }
  };

  const removeFeature = (index: number) => {
    setFormData({
      ...formData,
      additionalFeatures: formData.additionalFeatures.filter(
        (_, i) => i !== index
      ),
    });
  };

  const addLimitation = () => {
    if (newLimitation.trim()) {
      setFormData({
        ...formData,
        limitations: [...formData.limitations, newLimitation.trim()],
      });
      setNewLimitation("");
    }
  };

  const removeLimitation = (index: number) => {
    setFormData({
      ...formData,
      limitations: formData.limitations.filter((_, i) => i !== index),
    });
  };

  const formatLimit = (value: number | "unlimited") => {
    return value === "unlimited" ? "∞" : value.toString();
  };

  const totalRevenue = plans.reduce((sum, p) => sum + p.monthlyPrice, 0);
  const activePlans = plans.filter((p) => p.active).length;
  const [previewMode, setPreviewMode] = useState<'all' | 'referred' | 'non-referred'>('all');

  // Filter plans based on preview mode to simulate what different users would see
  const getFilteredPlans = () => {
    if (previewMode === 'all') return plans;
    
    return plans.filter((p) => {
      const visibility = p.visibility || 'all';
      
      // "All Users" visibility - always show regardless of referral status
      if (visibility === 'all') return true;
      
      // For referred preview: also show 'referred' plans
      if (previewMode === 'referred' && visibility === 'referred') return true;
      
      // For non-referred preview: also show 'non-referred' plans
      if (previewMode === 'non-referred' && visibility === 'non-referred') return true;
      
      return false;
    });
  };

  const filteredPlans = getFilteredPlans();

  return (
    <div className="min-h-screen">
      <AdminHeader
        title="Plans Management"
        subtitle="Configure subscription plans and pricing"
        onRefresh={loadPlans}
        loading={loading}
      />

      <div className="p-6">
        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
          <StatsCard
            title="Total Plans"
            value={plans.length}
            icon={<CreditCard className="w-6 h-6" />}
            color="blue"
          />
          <StatsCard
            title="Active Plans"
            value={activePlans}
            icon={<Check className="w-6 h-6" />}
            color="green"
          />
          <StatsCard
            title="Popular Plan"
            value={plans.find((p) => p.popular)?.name || "None"}
            icon={<Star className="w-6 h-6" />}
            color="yellow"
          />
          <StatsCard
            title="Highest Price"
            value={`$${Math.max(...plans.map((p) => p.monthlyPrice), 0)}/mo`}
            icon={<DollarSign className="w-6 h-6" />}
            color="purple"
          />
        </div>

        {/* Preview Mode & Actions */}
        <div className="flex justify-between items-center mb-6">
          <div className="flex items-center space-x-2">
            <span className="text-sm font-medium text-gray-700">Preview as:</span>
            <div className="flex rounded-lg border border-gray-300 overflow-hidden">
              <button
                onClick={() => setPreviewMode('all')}
                className={`px-3 py-1.5 text-sm font-medium ${
                  previewMode === 'all' 
                    ? 'bg-gray-800 text-white' 
                    : 'bg-white text-gray-700 hover:bg-gray-50'
                }`}
              >
                All Plans
              </button>
              <button
                onClick={() => setPreviewMode('non-referred')}
                className={`px-3 py-1.5 text-sm font-medium border-l ${
                  previewMode === 'non-referred' 
                    ? 'bg-orange-500 text-white' 
                    : 'bg-white text-gray-700 hover:bg-gray-50'
                }`}
              >
                <UserX className="w-3 h-3 inline mr-1" />
                Non-Referred
              </button>
              <button
                onClick={() => setPreviewMode('referred')}
                className={`px-3 py-1.5 text-sm font-medium border-l ${
                  previewMode === 'referred' 
                    ? 'bg-purple-500 text-white' 
                    : 'bg-white text-gray-700 hover:bg-gray-50'
                }`}
              >
                <UserCheck className="w-3 h-3 inline mr-1" />
                Referred
              </button>
            </div>
            {previewMode !== 'all' && (
              <span className="text-xs text-gray-500">
                Showing {filteredPlans.length} of {plans.length} plans
              </span>
            )}
          </div>
          <button onClick={openCreateModal} className="btn-primary flex items-center space-x-2">
            <Plus className="w-4 h-4" />
            <span>Create Plan</span>
          </button>
        </div>

        {/* Plans Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {filteredPlans.map((plan, index) => (
            <div
              key={plan.id}
              className={`bg-white rounded-xl shadow-sm border-2 p-6 relative ${
                plan.popular
                  ? "border-primary-500"
                  : plan.active
                  ? "border-gray-200"
                  : "border-gray-100 opacity-60"
              }`}
            >
              {/* Popular Badge */}
              {plan.popular && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <span className="bg-primary-600 text-white text-xs font-semibold px-3 py-1 rounded-full flex items-center space-x-1">
                    <Star className="w-3 h-3" />
                    <span>Popular</span>
                  </span>
                </div>
              )}

              {/* Status Badge */}
              <div className="absolute top-4 right-4">
                <span
                  className={`px-2 py-1 text-xs font-medium rounded-full ${
                    plan.active
                      ? "bg-green-100 text-green-700"
                      : "bg-gray-100 text-gray-500"
                  }`}
                >
                  {plan.active ? "Active" : "Inactive"}
                </span>
              </div>

              {/* Plan Info */}
              <div className="mb-4 pt-4">
                <div className="flex items-center space-x-3 mb-2">
                  {(() => {
                    const IconComponent = getIconByName(plan.icon || "zap");
                    return (
                      <div className={`p-2 rounded-lg ${plan.popular ? "bg-primary-100" : "bg-gray-100"}`}>
                        <IconComponent className={`w-5 h-5 ${plan.popular ? "text-primary-600" : "text-gray-600"}`} />
                      </div>
                    );
                  })()}
                  <h3 className="text-xl font-bold text-gray-900">{plan.name}</h3>
                </div>
                <p className="text-sm text-gray-500 mt-1">{plan.description}</p>
              </div>

              {/* Pricing */}
              <div className="mb-4">
                <div className="flex items-baseline">
                  <span className="text-3xl font-bold text-gray-900">
                    ${plan.monthlyPrice}
                  </span>
                  <span className="text-gray-500 ml-1">/mo</span>
                </div>
                {plan.yearlyPrice > 0 && (
                  <p className="text-sm text-green-600">
                    ${plan.yearlyPrice}/yr ({plan.yearlyDiscount}% off)
                  </p>
                )}
                {plan.referralDiscount > 0 && (
                  <p className="text-sm text-purple-600 flex items-center mt-1">
                    <Gift className="w-3 h-3 mr-1" />
                    +{plan.referralDiscount}% referral discount
                  </p>
                )}
              </div>

              {/* Visibility Badge */}
              {plan.visibility !== "all" && (
                <div className="mb-4">
                  <span className={`inline-flex items-center px-2 py-1 text-xs font-medium rounded-full ${
                    plan.visibility === "referred" 
                      ? "bg-purple-100 text-purple-700" 
                      : "bg-orange-100 text-orange-700"
                  }`}>
                    {plan.visibility === "referred" ? (
                      <><UserCheck className="w-3 h-3 mr-1" /> Referred Only</>
                    ) : (
                      <><UserX className="w-3 h-3 mr-1" /> Non-Referred Only</>
                    )}
                  </span>
                </div>
              )}

              {/* Limits */}
              <div className="space-y-2 mb-4 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-500">Channels</span>
                  <span className="font-medium">
                    {formatLimit(plan.maxChannels)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Scans</span>
                  <span className="font-medium">
                    {formatLimit(plan.maxScans)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Videos/Scan</span>
                  <span className="font-medium">
                    {formatLimit(plan.maxVideosPerScan)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Extracts</span>
                  <span className="font-medium">
                    {formatLimit(plan.maxChannelExtracts)}
                  </span>
                </div>
              </div>

              {/* Order Controls */}
              <div className="flex items-center justify-center space-x-2 mb-4">
                <button
                  onClick={() => updateOrder(plan, "up")}
                  disabled={index === 0}
                  className="p-1 hover:bg-gray-100 rounded disabled:opacity-30"
                >
                  <ArrowUp className="w-4 h-4" />
                </button>
                <span className="text-xs text-gray-500">Order: {plan.order}</span>
                <button
                  onClick={() => updateOrder(plan, "down")}
                  disabled={index === plans.length - 1}
                  className="p-1 hover:bg-gray-100 rounded disabled:opacity-30"
                >
                  <ArrowDown className="w-4 h-4" />
                </button>
              </div>

              {/* Actions */}
              <div className="flex items-center space-x-2 pt-4 border-t border-gray-200">
                <button
                  onClick={() => openEditModal(plan)}
                  className="flex-1 flex items-center justify-center space-x-1 px-3 py-2 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 text-sm font-medium"
                >
                  <Edit className="w-4 h-4" />
                  <span>Edit</span>
                </button>
                <button
                  onClick={() => togglePlanActive(plan)}
                  className={`p-2 rounded-lg ${
                    plan.active
                      ? "bg-gray-100 text-gray-600 hover:bg-gray-200"
                      : "bg-green-100 text-green-600 hover:bg-green-200"
                  }`}
                  title={plan.active ? "Deactivate" : "Activate"}
                >
                  {plan.active ? (
                    <EyeOff className="w-4 h-4" />
                  ) : (
                    <Eye className="w-4 h-4" />
                  )}
                </button>
                <button
                  onClick={() => togglePopular(plan)}
                  className={`p-2 rounded-lg ${
                    plan.popular
                      ? "bg-yellow-100 text-yellow-600"
                      : "bg-gray-100 text-gray-400 hover:bg-yellow-50"
                  }`}
                  title="Set as popular"
                >
                  <Star className={`w-4 h-4 ${plan.popular ? "fill-current" : ""}`} />
                </button>
                {plan.id !== "free" && (
                  <button
                    onClick={() => {
                      setPlanToDelete(plan);
                      setShowDeleteModal(true);
                    }}
                    className="p-2 bg-red-100 text-red-600 rounded-lg hover:bg-red-200"
                    title="Delete"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>

        {plans.length === 0 && !loading && (
          <div className="text-center py-12 bg-white rounded-xl">
            <CreditCard className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-500">
              No plans found. Plans will be auto-created on first load.
            </p>
            <button onClick={loadPlans} className="btn-primary mt-4">
              <RefreshCw className="w-4 h-4 mr-2" />
              Reload Plans
            </button>
          </div>
        )}
      </div>

      {/* Create/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 overflow-y-auto py-8">
          <div className="bg-white rounded-xl shadow-xl max-w-4xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white p-6 border-b border-gray-200 flex items-center justify-between z-10">
              <h2 className="text-xl font-semibold text-gray-900">
                {editingPlan ? "Edit Plan" : "Create New Plan"}
              </h2>
              <button
                onClick={() => setShowModal(false)}
                className="p-2 hover:bg-gray-100 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-6">
              {/* Basic Info */}
              <div>
                <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wider mb-4">
                  Basic Information
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Plan ID *
                    </label>
                    <input
                      type="text"
                      value={formData.id}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          id: e.target.value.toLowerCase().replace(/\s/g, "_"),
                        })
                      }
                      disabled={!!editingPlan}
                      placeholder="e.g., basic, pro, enterprise"
                      className="input-field disabled:bg-gray-100"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Plan Name *
                    </label>
                    <input
                      type="text"
                      value={formData.name}
                      onChange={(e) =>
                        setFormData({ ...formData, name: e.target.value })
                      }
                      placeholder="e.g., Basic, Pro, Enterprise"
                      className="input-field"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Description
                    </label>
                    <input
                      type="text"
                      value={formData.description}
                      onChange={(e) =>
                        setFormData({ ...formData, description: e.target.value })
                      }
                      placeholder="Short description of this plan"
                      className="input-field"
                    />
                  </div>
                  
                  {/* Icon Selector */}
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Plan Icon
                    </label>
                    <div className="grid grid-cols-6 sm:grid-cols-9 gap-2">
                      {AVAILABLE_ICONS.map(({ name, icon: IconComp, label }) => (
                        <button
                          key={name}
                          type="button"
                          onClick={() => setFormData({ ...formData, icon: name })}
                          className={`p-3 rounded-lg border-2 transition-all flex items-center justify-center group relative ${
                            formData.icon === name
                              ? "border-primary-500 bg-primary-50"
                              : "border-gray-200 hover:border-gray-300 hover:bg-gray-50"
                          }`}
                          title={label}
                        >
                          <IconComp
                            className={`w-5 h-5 ${
                              formData.icon === name ? "text-primary-600" : "text-gray-600"
                            }`}
                          />
                          {formData.icon === name && (
                            <div className="absolute -top-1 -right-1 w-4 h-4 bg-primary-500 rounded-full flex items-center justify-center">
                              <Check className="w-2.5 h-2.5 text-white" />
                            </div>
                          )}
                        </button>
                      ))}
                    </div>
                    <p className="text-xs text-gray-500 mt-2">
                      Selected: {AVAILABLE_ICONS.find(i => i.name === formData.icon)?.label || "None"}
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Display Order
                    </label>
                    <input
                      type="number"
                      value={formData.order}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          order: parseInt(e.target.value) || 0,
                        })
                      }
                      className="input-field"
                    />
                  </div>
                  <div className="flex items-center space-x-6">
                    <label className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        checked={formData.active}
                        onChange={(e) =>
                          setFormData({ ...formData, active: e.target.checked })
                        }
                        className="w-4 h-4 rounded"
                      />
                      <span className="text-sm">Active</span>
                    </label>
                    <label className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        checked={formData.popular}
                        onChange={(e) =>
                          setFormData({ ...formData, popular: e.target.checked })
                        }
                        className="w-4 h-4 rounded"
                      />
                      <span className="text-sm">Popular (Normal Users)</span>
                    </label>
                    <label className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        checked={formData.popularForReferred}
                        onChange={(e) =>
                          setFormData({ ...formData, popularForReferred: e.target.checked })
                        }
                        className="w-4 h-4 rounded"
                      />
                      <span className="text-sm">Popular (Referred Users)</span>
                    </label>
                  </div>
                </div>
              </div>

              {/* Referral Settings */}
              <div>
                <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wider mb-4 flex items-center">
                  <Gift className="w-4 h-4 mr-2" />
                  Referral Settings
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Visibility
                    </label>
                    <select
                      value={formData.visibility}
                      onChange={(e) =>
                        setFormData({ ...formData, visibility: e.target.value as PlanVisibility })
                      }
                      className="input-field"
                    >
                      <option value="all">All Users</option>
                      <option value="referred">Referred Users Only</option>
                      <option value="non-referred">Non-Referred Users Only</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Referral Discount (%)
                    </label>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      value={formData.referralDiscount}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          referralDiscount: parseInt(e.target.value) || 0,
                        })
                      }
                      placeholder="Extra discount for referred users"
                      className="input-field"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Referral Badge Text
                    </label>
                    <input
                      type="text"
                      value={formData.referralBadge || ""}
                      onChange={(e) =>
                        setFormData({ ...formData, referralBadge: e.target.value })
                      }
                      placeholder="e.g., 'Referral Special', 'VIP Deal'"
                      className="input-field"
                    />
                  </div>
                </div>
                <p className="text-xs text-gray-500 mt-2">
                  Referral discount is applied on top of the base price for users who signed up with a referral code.
                </p>
              </div>

              {/* Pricing */}
              <div>
                <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wider mb-4">
                  Pricing
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Monthly Price ($)
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={formData.monthlyPrice}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          monthlyPrice: parseFloat(e.target.value) || 0,
                        })
                      }
                      className="input-field"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Yearly Price ($)
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={formData.yearlyPrice}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          yearlyPrice: parseFloat(e.target.value) || 0,
                        })
                      }
                      className="input-field"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Yearly Discount (%)
                    </label>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      value={formData.yearlyDiscount}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          yearlyDiscount: parseInt(e.target.value) || 0,
                        })
                      }
                      className="input-field"
                    />
                  </div>
                </div>
              </div>

              {/* Limits */}
              <div>
                <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wider mb-4">
                  Usage Limits
                </h3>
                <p className="text-xs text-gray-500 mb-4">
                  Enter a number or type "unlimited" for no limit
                </p>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Max Channels
                    </label>
                    <input
                      type="text"
                      value={formData.maxChannels}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          maxChannels:
                            e.target.value === "unlimited"
                              ? "unlimited"
                              : parseInt(e.target.value) || 1,
                        })
                      }
                      className="input-field"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Max Scans
                    </label>
                    <input
                      type="text"
                      value={formData.maxScans}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          maxScans:
                            e.target.value === "unlimited"
                              ? "unlimited"
                              : parseInt(e.target.value) || 1,
                        })
                      }
                      className="input-field"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Max Videos Per Scan
                    </label>
                    <input
                      type="text"
                      value={formData.maxVideosPerScan}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          maxVideosPerScan:
                            e.target.value === "unlimited"
                              ? "unlimited"
                              : parseInt(e.target.value) || 50,
                        })
                      }
                      className="input-field"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Max Bulk Videos Per Run
                    </label>
                    <input
                      type="text"
                      value={formData.maxBulkVideosPerRun}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          maxBulkVideosPerRun:
                            e.target.value === "unlimited"
                              ? "unlimited"
                              : parseInt(e.target.value) || 10,
                        })
                      }
                      className="input-field"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Max Channel Extracts
                    </label>
                    <input
                      type="text"
                      value={formData.maxChannelExtracts}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          maxChannelExtracts:
                            e.target.value === "unlimited"
                              ? "unlimited"
                              : parseInt(e.target.value) || 2,
                        })
                      }
                      className="input-field"
                    />
                  </div>
                </div>
              </div>

              {/* Display Features */}
              <div>
                <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wider mb-4">
                  Display Features (shown on pricing page)
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Channels
                    </label>
                    <input
                      type="text"
                      value={formData.features.channels}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          features: { ...formData.features, channels: e.target.value },
                        })
                      }
                      placeholder="e.g., 2 Channels"
                      className="input-field"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Scans
                    </label>
                    <input
                      type="text"
                      value={formData.features.scans}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          features: { ...formData.features, scans: e.target.value },
                        })
                      }
                      placeholder="e.g., Unlimited Scans"
                      className="input-field"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Extract
                    </label>
                    <input
                      type="text"
                      value={formData.features.extract}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          features: { ...formData.features, extract: e.target.value },
                        })
                      }
                      placeholder="e.g., 10 Channel Extracts"
                      className="input-field"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Videos
                    </label>
                    <input
                      type="text"
                      value={formData.features.videos}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          features: { ...formData.features, videos: e.target.value },
                        })
                      }
                      placeholder="e.g., 1000 Videos per scan"
                      className="input-field"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Bulk Scan
                    </label>
                    <input
                      type="text"
                      value={formData.features.bulkScan}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          features: { ...formData.features, bulkScan: e.target.value },
                        })
                      }
                      placeholder="e.g., Unlimited Bulk Scan"
                      className="input-field"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Support
                    </label>
                    <input
                      type="text"
                      value={formData.features.support}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          features: { ...formData.features, support: e.target.value },
                        })
                      }
                      placeholder="e.g., Priority Email Support"
                      className="input-field"
                    />
                  </div>
                </div>
              </div>

              {/* Additional Features */}
              <div>
                <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wider mb-4">
                  Additional Features
                </h3>
                <div className="flex space-x-2 mb-3">
                  <input
                    type="text"
                    value={newFeature}
                    onChange={(e) => setNewFeature(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && addFeature()}
                    placeholder="Add a feature..."
                    className="input-field flex-1"
                  />
                  <button
                    type="button"
                    onClick={addFeature}
                    className="btn-secondary"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {formData.additionalFeatures.map((feature, index) => (
                    <span
                      key={index}
                      className="inline-flex items-center space-x-1 bg-green-100 text-green-700 px-3 py-1 rounded-full text-sm"
                    >
                      <Check className="w-3 h-3" />
                      <span>{feature}</span>
                      <button
                        onClick={() => removeFeature(index)}
                        className="ml-1 hover:text-red-600"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                </div>
              </div>

              {/* Limitations */}
              <div>
                <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wider mb-4">
                  Limitations
                </h3>
                <div className="flex space-x-2 mb-3">
                  <input
                    type="text"
                    value={newLimitation}
                    onChange={(e) => setNewLimitation(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && addLimitation()}
                    placeholder="Add a limitation..."
                    className="input-field flex-1"
                  />
                  <button
                    type="button"
                    onClick={addLimitation}
                    className="btn-secondary"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {formData.limitations.map((limitation, index) => (
                    <span
                      key={index}
                      className="inline-flex items-center space-x-1 bg-gray-100 text-gray-600 px-3 py-1 rounded-full text-sm"
                    >
                      <X className="w-3 h-3" />
                      <span>{limitation}</span>
                      <button
                        onClick={() => removeLimitation(index)}
                        className="ml-1 hover:text-red-600"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                </div>
              </div>

              {/* Stripe Integration */}
              <div>
                <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wider mb-4">
                  Stripe Integration (Optional)
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Monthly Price ID
                    </label>
                    <input
                      type="text"
                      value={formData.stripePriceIdMonthly || ""}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          stripePriceIdMonthly: e.target.value,
                        })
                      }
                      placeholder="price_xxxxx"
                      className="input-field"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Yearly Price ID
                    </label>
                    <input
                      type="text"
                      value={formData.stripePriceIdYearly || ""}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          stripePriceIdYearly: e.target.value,
                        })
                      }
                      placeholder="price_xxxxx"
                      className="input-field"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="sticky bottom-0 bg-white p-6 border-t border-gray-200 flex justify-end space-x-3">
              <button
                onClick={() => setShowModal(false)}
                className="btn-secondary"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="btn-primary flex items-center space-x-2"
              >
                <Save className="w-4 h-4" />
                <span>{saving ? "Saving..." : "Save Plan"}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteModal && planToDelete && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full mx-4 p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">
              Delete Plan
            </h2>
            <p className="text-gray-600 mb-6">
              Are you sure you want to delete the{" "}
              <strong>{planToDelete.name}</strong> plan? Users on this plan will
              need to be migrated manually.
            </p>
            <div className="flex justify-end space-x-3">
              <button
                onClick={() => {
                  setShowDeleteModal(false);
                  setPlanToDelete(null);
                }}
                className="btn-secondary"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={saving}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50"
              >
                {saving ? "Deleting..." : "Delete Plan"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
