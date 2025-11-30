"use client";

import { useEffect, useState } from "react";
import { AdminHeader, DataTable, Column } from "@/components/noob";
import { db } from "@/lib/firebase";
import {
  collection,
  getDocs,
  doc,
  getDoc,
  updateDoc,
  query,
  where,
  orderBy,
  limit,
} from "firebase/firestore";
import {
  Shield,
  Users,
  History,
  Settings,
  Plus,
  X,
  Trash2,
  Check,
  AlertTriangle,
} from "lucide-react";

interface AdminUser {
  id: string;
  fullName: string;
  email: string;
  photoURL?: string;
  isAdmin: boolean;
  createdAt: string;
}

interface AdminLog {
  id: string;
  adminId: string;
  adminEmail: string;
  action: string;
  targetType: string;
  targetId?: string;
  details: any;
  timestamp: string;
}

export default function SettingsPage() {
  const [admins, setAdmins] = useState<AdminUser[]>([]);
  const [logs, setLogs] = useState<AdminLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"admins" | "logs">("admins");
  const [actionLoading, setActionLoading] = useState(false);

  // Add admin modal
  const [showAddAdminModal, setShowAddAdminModal] = useState(false);
  const [searchEmail, setSearchEmail] = useState("");
  const [searchResult, setSearchResult] = useState<AdminUser | null>(null);
  const [searchError, setSearchError] = useState("");

  const loadData = async () => {
    setLoading(true);
    try {
      // Load admins
      const usersRef = collection(db, "users");
      const adminsQuery = query(usersRef, where("isAdmin", "==", true));
      const adminsSnapshot = await getDocs(adminsQuery);

      const adminsList: AdminUser[] = adminsSnapshot.docs.map((docSnap) => {
        const data = docSnap.data();
        return {
          id: docSnap.id,
          fullName: data.fullName || data.displayName || "Unknown",
          email: data.email || "",
          photoURL: data.photoURL || "",
          isAdmin: true,
          createdAt: data.createdAt || "",
        };
      });

      setAdmins(adminsList);

      // Load admin logs
      try {
        const logsRef = collection(db, "adminLogs");
        const logsQuery = query(
          logsRef,
          orderBy("timestamp", "desc"),
          limit(100)
        );
        const logsSnapshot = await getDocs(logsQuery);

        const logsList: AdminLog[] = logsSnapshot.docs.map((docSnap) => ({
          id: docSnap.id,
          ...docSnap.data(),
        })) as AdminLog[];

        setLogs(logsList);
      } catch (error) {
        console.log("Admin logs collection may not exist yet");
        setLogs([]);
      }
    } catch (error) {
      console.error("Error loading settings data:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const searchUser = async () => {
    if (!searchEmail) return;

    setSearchError("");
    setSearchResult(null);

    try {
      const usersRef = collection(db, "users");
      const userQuery = query(usersRef, where("email", "==", searchEmail));
      const snapshot = await getDocs(userQuery);

      if (snapshot.empty) {
        setSearchError("No user found with this email");
        return;
      }

      const docSnap = snapshot.docs[0];
      const data = docSnap.data();

      if (data.isAdmin) {
        setSearchError("This user is already an admin");
        return;
      }

      setSearchResult({
        id: docSnap.id,
        fullName: data.fullName || data.displayName || "Unknown",
        email: data.email || "",
        photoURL: data.photoURL || "",
        isAdmin: false,
        createdAt: data.createdAt || "",
      });
    } catch (error) {
      console.error("Error searching user:", error);
      setSearchError("Error searching for user");
    }
  };

  const grantAdmin = async () => {
    if (!searchResult) return;

    setActionLoading(true);
    try {
      const userRef = doc(db, "users", searchResult.id);
      await updateDoc(userRef, {
        isAdmin: true,
        updatedAt: new Date().toISOString(),
      });

      alert(`Admin role granted to ${searchResult.fullName}`);
      setShowAddAdminModal(false);
      setSearchEmail("");
      setSearchResult(null);
      loadData();
    } catch (error) {
      console.error("Error granting admin:", error);
      alert("Failed to grant admin role");
    } finally {
      setActionLoading(false);
    }
  };

  const revokeAdmin = async (userId: string, email: string) => {
    if (
      !confirm(
        `Are you sure you want to revoke admin privileges from ${email}?`
      )
    )
      return;

    setActionLoading(true);
    try {
      const userRef = doc(db, "users", userId);
      await updateDoc(userRef, {
        isAdmin: false,
        updatedAt: new Date().toISOString(),
      });

      alert("Admin role revoked");
      loadData();
    } catch (error) {
      console.error("Error revoking admin:", error);
      alert("Failed to revoke admin role");
    } finally {
      setActionLoading(false);
    }
  };

  const adminColumns: Column<AdminUser>[] = [
    {
      key: "fullName",
      header: "Name",
      sortable: true,
      render: (value, row) => (
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 bg-primary-100 rounded-full flex items-center justify-center overflow-hidden">
            {row.photoURL ? (
              <img
                src={row.photoURL}
                alt={value}
                className="w-full h-full object-cover"
              />
            ) : (
              <Shield className="w-5 h-5 text-primary-600" />
            )}
          </div>
          <div>
            <p className="font-medium text-gray-900">{value}</p>
            <p className="text-xs text-gray-500">{row.email}</p>
          </div>
        </div>
      ),
    },
    {
      key: "createdAt",
      header: "Member Since",
      sortable: true,
      render: (value) =>
        value ? new Date(value).toLocaleDateString() : "-",
    },
    {
      key: "id",
      header: "Actions",
      render: (value, row) => (
        <button
          onClick={() => revokeAdmin(value, row.email)}
          disabled={actionLoading || admins.length <= 1}
          className="px-3 py-1.5 text-sm bg-red-100 text-red-700 rounded hover:bg-red-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          title={
            admins.length <= 1
              ? "Cannot remove the only admin"
              : "Revoke admin"
          }
        >
          Revoke
        </button>
      ),
    },
  ];

  const logColumns: Column<AdminLog>[] = [
    {
      key: "adminEmail",
      header: "Admin",
      sortable: true,
    },
    {
      key: "action",
      header: "Action",
      sortable: true,
      render: (value) => (
        <span className="px-2 py-1 text-xs font-medium rounded-full bg-gray-100 text-gray-800">
          {value.replace(/_/g, " ")}
        </span>
      ),
    },
    {
      key: "targetType",
      header: "Target",
      render: (value, row) => (
        <div>
          <span className="capitalize">{value}</span>
          {row.targetId && (
            <p className="text-xs text-gray-500">
              {row.targetId.substring(0, 12)}...
            </p>
          )}
        </div>
      ),
    },
    {
      key: "timestamp",
      header: "Date",
      sortable: true,
      render: (value) =>
        value ? new Date(value).toLocaleString() : "-",
    },
  ];

  return (
    <div className="min-h-screen">
      <AdminHeader
        title="Settings"
        subtitle="Admin panel configuration"
        onRefresh={loadData}
        loading={loading}
      />

      <div className="p-6">
        {/* Tabs */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="border-b border-gray-200">
            <div className="flex">
              <button
                onClick={() => setActiveTab("admins")}
                className={`px-6 py-4 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === "admins"
                    ? "border-primary-600 text-primary-600"
                    : "border-transparent text-gray-500 hover:text-gray-700"
                }`}
              >
                <Shield className="w-4 h-4 inline mr-2" />
                Admin Users ({admins.length})
              </button>
              <button
                onClick={() => setActiveTab("logs")}
                className={`px-6 py-4 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === "logs"
                    ? "border-primary-600 text-primary-600"
                    : "border-transparent text-gray-500 hover:text-gray-700"
                }`}
              >
                <History className="w-4 h-4 inline mr-2" />
                Audit Log ({logs.length})
              </button>
            </div>
          </div>

          {/* Content */}
          {activeTab === "admins" && (
            <div>
              {/* Add Admin Button */}
              <div className="p-4 border-b border-gray-200">
                <button
                  onClick={() => setShowAddAdminModal(true)}
                  className="btn-primary flex items-center space-x-2"
                >
                  <Plus className="w-4 h-4" />
                  <span>Add Admin</span>
                </button>
              </div>

              {/* Warning */}
              {admins.length === 1 && (
                <div className="mx-4 mt-4 bg-amber-50 border border-amber-200 rounded-lg p-4">
                  <div className="flex items-start space-x-3">
                    <AlertTriangle className="w-5 h-5 text-amber-600 mt-0.5" />
                    <div>
                      <h3 className="font-medium text-amber-800">
                        Single Admin Warning
                      </h3>
                      <p className="text-sm text-amber-700 mt-1">
                        You currently have only one admin. Consider adding
                        another admin for backup access.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Admins Table */}
              <DataTable
                columns={adminColumns}
                data={admins}
                loading={loading}
                pageSize={25}
                emptyMessage="No admin users found"
              />
            </div>
          )}

          {activeTab === "logs" && (
            <div>
              {logs.length === 0 ? (
                <div className="p-12 text-center text-gray-500">
                  <History className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                  <p>No admin actions logged yet</p>
                  <p className="text-sm mt-1">
                    Admin actions will appear here for auditing
                  </p>
                </div>
              ) : (
                <DataTable
                  columns={logColumns}
                  data={logs}
                  loading={loading}
                  searchable
                  searchPlaceholder="Search logs..."
                  pageSize={25}
                  exportable
                  emptyMessage="No logs found"
                />
              )}
            </div>
          )}
        </div>

        {/* System Info */}
        <div className="mt-6 bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h3 className="font-semibold text-gray-900 mb-4 flex items-center space-x-2">
            <Settings className="w-5 h-5" />
            <span>System Information</span>
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 text-sm">
            <div className="bg-gray-50 rounded-lg p-4">
              <p className="text-gray-500">Admin Panel Path</p>
              <p className="font-medium text-gray-900">/noob</p>
            </div>
            <div className="bg-gray-50 rounded-lg p-4">
              <p className="text-gray-500">Total Admins</p>
              <p className="font-medium text-gray-900">{admins.length}</p>
            </div>
            <div className="bg-gray-50 rounded-lg p-4">
              <p className="text-gray-500">Admin Actions Logged</p>
              <p className="font-medium text-gray-900">{logs.length}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Add Admin Modal */}
      {showAddAdminModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full mx-4 p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold text-gray-900">
                Add Admin User
              </h2>
              <button
                onClick={() => {
                  setShowAddAdminModal(false);
                  setSearchEmail("");
                  setSearchResult(null);
                  setSearchError("");
                }}
                className="p-2 hover:bg-gray-100 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-gray-600 mb-4">
              Search for a user by email to grant admin privileges.
            </p>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  User Email
                </label>
                <div className="flex space-x-2">
                  <input
                    type="email"
                    value={searchEmail}
                    onChange={(e) => setSearchEmail(e.target.value)}
                    placeholder="user@example.com"
                    className="input-field flex-1"
                    onKeyDown={(e) => e.key === "Enter" && searchUser()}
                  />
                  <button
                    onClick={searchUser}
                    className="btn-secondary"
                  >
                    Search
                  </button>
                </div>
              </div>

              {searchError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                  {searchError}
                </div>
              )}

              {searchResult && (
                <div className="p-4 bg-gray-50 rounded-lg">
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 bg-gray-200 rounded-full flex items-center justify-center overflow-hidden">
                      {searchResult.photoURL ? (
                        <img
                          src={searchResult.photoURL}
                          alt={searchResult.fullName}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <Users className="w-5 h-5 text-gray-500" />
                      )}
                    </div>
                    <div>
                      <p className="font-medium text-gray-900">
                        {searchResult.fullName}
                      </p>
                      <p className="text-sm text-gray-500">
                        {searchResult.email}
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="flex justify-end space-x-3 mt-6">
              <button
                onClick={() => {
                  setShowAddAdminModal(false);
                  setSearchEmail("");
                  setSearchResult(null);
                  setSearchError("");
                }}
                className="btn-secondary"
              >
                Cancel
              </button>
              <button
                onClick={grantAdmin}
                disabled={actionLoading || !searchResult}
                className="btn-primary flex items-center space-x-2"
              >
                <Shield className="w-4 h-4" />
                <span>{actionLoading ? "Granting..." : "Grant Admin"}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
