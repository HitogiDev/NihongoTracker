import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useUserDataStore } from '../store/userData';
import { numberWithCommas } from '../utils/utils';
import { toast } from 'react-toastify';
import {
  getAdminStatsFn,
  getAdminUsersFn,
  deleteUserFn,
  recalculateStatsFn,
  adminUpdateUserFn,
  adminResetPasswordFn,
  searchAdminLogsFn,
  adminUpdateLogFn,
  adminDeleteLogFn,
} from '../api/trackerApi';
import { FiUsers } from 'react-icons/fi';
import type { updateLogRequest } from '../types';

type AdminUserRow = {
  _id: string;
  username: string;
  roles: string | string[];
  stats?: { userXp?: number; userHours?: number };
  createdAt: string | Date;
  lastActivity?: string | Date;
};

type AdminLogRow = {
  _id: string;
  user: string;
  username?: string;
  type: string;
  description: string;
  episodes?: number;
  pages?: number;
  chars?: number;
  time?: number;
  xp: number;
  date: string;
};

function AdminScreen() {
  const { user } = useUserDataStore();
  const isAdmin = Array.isArray(user?.roles)
    ? (user?.roles as string[]).includes('admin')
    : user?.roles === 'admin';
  const queryClient = useQueryClient();

  // Tabs and filters
  const [selectedTab, setSelectedTab] = useState<
    'overview' | 'users' | 'logs' | 'system'
  >('overview');
  const [searchTerm, setSearchTerm] = useState('');
  const [userPage, setUserPage] = useState(1);

  // User edit modal state
  const [editUserOpen, setEditUserOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<null | {
    _id: string;
    username: string;
    roles: string | string[];
  }>(null);
  const [editRoles, setEditRoles] = useState<{ admin: boolean; mod: boolean }>({
    admin: false,
    mod: false,
  });
  const [newPassword, setNewPassword] = useState('');

  // Logs tab state
  const [logPage, setLogPage] = useState(1);
  const [logSearch, setLogSearch] = useState('');
  const [logType, setLogType] = useState('');
  const [logUsername, setLogUsername] = useState('');
  const [logStart, setLogStart] = useState('');
  const [logEnd, setLogEnd] = useState('');
  const [editLogOpen, setEditLogOpen] = useState(false);
  const [selectedLog, setSelectedLog] = useState<AdminLogRow | null>(null);

  // Queries
  const { data: adminStats, isLoading: statsLoading } = useQuery({
    queryKey: ['adminStats'],
    queryFn: getAdminStatsFn,
    enabled: isAdmin,
    staleTime: 30_000,
  });

  const { data: users, isLoading: usersLoading } = useQuery({
    queryKey: ['adminUsers', userPage, searchTerm],
    queryFn: () => getAdminUsersFn({ page: userPage, search: searchTerm }),
    enabled: isAdmin && selectedTab === 'users',
    staleTime: 30_000,
  });

  const { data: adminLogs, isLoading: logsLoading } = useQuery({
    queryKey: [
      'adminLogs',
      logPage,
      logSearch,
      logType,
      logUsername,
      logStart,
      logEnd,
    ],
    queryFn: () =>
      searchAdminLogsFn({
        page: logPage,
        limit: 20,
        search: logSearch || undefined,
        type: logType || undefined,
        username: logUsername || undefined,
        start: logStart || undefined,
        end: logEnd || undefined,
      }),
    enabled: isAdmin && selectedTab === 'logs',
    staleTime: 10_000,
  });

  // Mutations
  const recalcMutation = useMutation({
    mutationFn: recalculateStatsFn,
    onSuccess: (_, type) => {
      toast.success(`${type === 'streaks' ? 'Streaks' : 'XP'} recalculated`);
      queryClient.invalidateQueries({ queryKey: ['adminStats'] });
    },
    onError: () => toast.error('Recalculation failed'),
  });

  const deleteUserMutation = useMutation({
    mutationFn: deleteUserFn,
    onSuccess: () => {
      toast.success('User deleted');
      queryClient.invalidateQueries({ queryKey: ['adminUsers'] });
      queryClient.invalidateQueries({ queryKey: ['adminStats'] });
    },
    onError: () => toast.error('Failed to delete user'),
  });

  const updateUserMutation = useMutation({
    mutationFn: ({ userId, roles }: { userId: string; roles: string[] }) =>
      adminUpdateUserFn(userId, { roles }),
    onSuccess: () => {
      toast.success('User updated');
      setEditUserOpen(false);
      setSelectedUser(null);
      queryClient.invalidateQueries({ queryKey: ['adminUsers'] });
      queryClient.invalidateQueries({ queryKey: ['adminStats'] });
    },
    onError: () => toast.error('Failed to update user'),
  });

  const resetPasswordMutation = useMutation({
    mutationFn: ({ userId, password }: { userId: string; password: string }) =>
      adminResetPasswordFn(userId, password),
    onSuccess: () => {
      toast.success('Password reset');
      setNewPassword('');
    },
    onError: () => toast.error('Failed to reset password'),
  });

  const updateLogMutation = useMutation({
    mutationFn: ({
      logId,
      payload,
    }: {
      logId: string;
      payload: Partial<updateLogRequest>;
    }) => adminUpdateLogFn(logId, payload),
    onSuccess: () => {
      toast.success('Log updated');
      setEditLogOpen(false);
      setSelectedLog(null);
      queryClient.invalidateQueries({ queryKey: ['adminLogs'] });
    },
    onError: () => toast.error('Failed to update log'),
  });

  const deleteLogMutation = useMutation({
    mutationFn: (logId: string) => adminDeleteLogFn(logId),
    onSuccess: () => {
      toast.success('Log deleted');
      queryClient.invalidateQueries({ queryKey: ['adminLogs'] });
      queryClient.invalidateQueries({ queryKey: ['adminStats'] });
    },
    onError: () => toast.error('Failed to delete log'),
  });

  const formatUptime = (days: number) => {
    const d = Math.floor(days);
    const h = Math.floor((days - d) * 24);
    return `${d}d ${h}h`;
  };

  // Gate
  if (!isAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-4xl font-bold text-error mb-4">Access Denied</h1>
          <p className="text-base-content/70">
            You don't have permission to access this page.
          </p>
        </div>
      </div>
    );
  }

  if (statsLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <span className="loading loading-spinner loading-lg text-primary"></span>
          <p className="mt-4 text-base-content/70">
            Loading admin dashboard...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-base-200 pt-20">
      <div className="container mx-auto px-4 py-8 max-w-7xl">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-base-content mb-2">
            Admin Dashboard
          </h1>
          <p className="text-base-content/70">
            Manage users, monitor system health, and analyze platform metrics
          </p>
        </div>

        {/* Tabs */}
        <div className="tabs tabs-boxed mb-8 bg-base-100 p-1">
          <button
            className={`tab tab-lg ${selectedTab === 'overview' ? 'tab-active' : ''}`}
            onClick={() => setSelectedTab('overview')}
          >
            <svg
              className="w-5 h-5 mr-2"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
              />
            </svg>
            Overview
          </button>
          <button
            className={`tab tab-lg ${selectedTab === 'users' ? 'tab-active' : ''}`}
            onClick={() => setSelectedTab('users')}
          >
            <FiUsers className="w-5 h-5 mr-2" />
            Users
          </button>
          <button
            className={`tab tab-lg ${selectedTab === 'logs' ? 'tab-active' : ''}`}
            onClick={() => setSelectedTab('logs')}
          >
            <svg
              className="w-5 h-5 mr-2"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
              />
            </svg>
            Logs
          </button>
          <button
            className={`tab tab-lg ${selectedTab === 'system' ? 'tab-active' : ''}`}
            onClick={() => setSelectedTab('system')}
          >
            <svg
              className="w-5 h-5 mr-2"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
              />
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
              />
            </svg>
            System
          </button>
        </div>

        {/* Overview Tab */}
        {selectedTab === 'overview' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <div className="card bg-base-100 shadow-lg">
                <div className="card-body">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center">
                      <svg
                        className="w-6 h-6 text-primary"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth="2"
                          d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                        />
                      </svg>
                    </div>
                    <div>
                      <h3 className="text-sm font-medium text-base-content/70">
                        Total Users
                      </h3>
                      <p className="text-2xl font-bold">
                        {numberWithCommas(adminStats?.totalUsers || 0)}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
              <div className="card bg-base-100 shadow-lg">
                <div className="card-body">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-success/10 rounded-lg flex items-center justify-center">
                      <svg
                        className="w-6 h-6 text-success"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth="2"
                          d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                        />
                      </svg>
                    </div>
                    <div>
                      <h3 className="text-sm font-medium text-base-content/70">
                        Active Users
                      </h3>
                      <p className="text-2xl font-bold">
                        {numberWithCommas(adminStats?.activeUsers || 0)}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
              <div className="card bg-base-100 shadow-lg">
                <div className="card-body">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-info/10 rounded-lg flex items-center justify-center">
                      <svg
                        className="w-6 h-6 text-info"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth="2"
                          d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                        />
                      </svg>
                    </div>
                    <div>
                      <h3 className="text-sm font-medium text-base-content/70">
                        Total Logs
                      </h3>
                      <p className="text-2xl font-bold">
                        {numberWithCommas(adminStats?.totalLogs || 0)}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
              <div className="card bg-base-100 shadow-lg">
                <div className="card-body">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-warning/10 rounded-lg flex items-center justify-center">
                      <svg
                        className="w-6 h-6 text-warning"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth="2"
                          d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                        />
                      </svg>
                    </div>
                    <div>
                      <h3 className="text-sm font-medium text-base-content/70">
                        Total Hours
                      </h3>
                      <p className="text-2xl font-bold">
                        {numberWithCommas(
                          Math.round(adminStats?.totalHours || 0)
                        )}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="card bg-base-100 shadow-lg">
                <div className="card-body">
                  <h3 className="card-title mb-4">Top Users</h3>
                  <div className="space-y-3">
                    {adminStats?.topUsers?.map(
                      (
                        u: {
                          username: string;
                          totalXp?: number;
                          totalHours?: number;
                        },
                        index: number
                      ) => (
                        <div
                          key={u.username}
                          className="flex items-center justify-between p-3 bg-base-200 rounded-lg"
                        >
                          <div className="flex items-center gap-3">
                            <div
                              className={`w-8 h-8 rounded-full flex items-center justify-center text-white font-bold ${index === 0 ? 'bg-yellow-500' : index === 1 ? 'bg-gray-400' : 'bg-orange-500'}`}
                            >
                              {index + 1}
                            </div>
                            <span className="font-medium">{u.username}</span>
                          </div>
                          <div className="text-right">
                            <p className="text-sm font-bold">
                              {numberWithCommas(u.totalXp ?? 0)} XP
                            </p>
                            <p className="text-xs text-base-content/60">
                              {(u.totalHours ?? 0).toFixed(1)} hours
                            </p>
                          </div>
                        </div>
                      )
                    )}
                  </div>
                </div>
              </div>
              <div className="card bg-base-100 shadow-lg">
                <div className="card-body">
                  <h3 className="card-title mb-4">System Health</h3>
                  <div className="space-y-4">
                    {(() => {
                      const mem = adminStats?.systemStats?.memoryUsage ?? 0;
                      const disk = adminStats?.systemStats?.diskUsage ?? 0;
                      const uptime = adminStats?.systemStats?.uptime ?? 0;
                      return (
                        <>
                          <div>
                            <div className="flex justify-between text-sm mb-1">
                              <span>Memory Usage</span>
                              <span>{mem.toFixed(1)}%</span>
                            </div>
                            <progress
                              className="progress progress-primary w-full"
                              value={mem}
                              max={100}
                            ></progress>
                          </div>
                          <div>
                            <div className="flex justify-between text-sm mb-1">
                              <span>Disk Usage</span>
                              <span>{disk.toFixed(1)}%</span>
                            </div>
                            <progress
                              className="progress progress-success w-full"
                              value={disk}
                              max={100}
                            ></progress>
                          </div>
                          <div className="bg-base-200 p-3 rounded-lg">
                            <div className="flex justify-between">
                              <span>Uptime</span>
                              <span className="font-mono">
                                {formatUptime(uptime)}
                              </span>
                            </div>
                          </div>
                        </>
                      );
                    })()}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Users Tab */}
        {selectedTab === 'users' && (
          <>
            <div className="space-y-6">
              <div className="card bg-base-100 shadow-lg">
                <div className="card-body">
                  <div className="flex flex-col sm:flex-row gap-4 items-center justify-between">
                    <div className="form-control w-full max-w-md">
                      <input
                        type="text"
                        placeholder="Search users..."
                        className="input input-bordered w-full"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                      />
                    </div>
                    <div className="flex gap-2">
                      <button
                        className="btn btn-warning btn-sm"
                        onClick={() => recalcMutation.mutate('streaks')}
                        disabled={recalcMutation.isPending}
                      >
                        {recalcMutation.isPending ? (
                          <span className="loading loading-spinner loading-sm"></span>
                        ) : (
                          'Recalc Streaks'
                        )}
                      </button>
                      <button
                        className="btn btn-info btn-sm"
                        onClick={() => recalcMutation.mutate('xp')}
                        disabled={recalcMutation.isPending}
                      >
                        {recalcMutation.isPending ? (
                          <span className="loading loading-spinner loading-sm"></span>
                        ) : (
                          'Recalc XP'
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              <div className="card bg-base-100 shadow-lg">
                <div className="card-body">
                  <div className="overflow-x-auto">
                    <table className="table">
                      <thead>
                        <tr>
                          <th>Username</th>
                          <th>Role</th>
                          <th>XP</th>
                          <th>Hours</th>
                          <th>Created</th>
                          <th>Last Activity</th>
                          <th>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {usersLoading ? (
                          <tr>
                            <td colSpan={7} className="text-center py-8">
                              <span className="loading loading-spinner loading-md"></span>
                            </td>
                          </tr>
                        ) : (
                          users?.users?.map((row: AdminUserRow) => {
                            const role = Array.isArray(row.roles)
                              ? row.roles.includes('admin')
                                ? 'admin'
                                : row.roles.includes('mod')
                                  ? 'mod'
                                  : 'user'
                              : row.roles;
                            return (
                              <tr key={row._id}>
                                <td>
                                  <div className="font-medium">
                                    {row.username}
                                  </div>
                                </td>
                                <td>
                                  <div
                                    className={`badge ${role === 'admin' ? 'badge-error' : role === 'mod' ? 'badge-warning' : 'badge-ghost'}`}
                                  >
                                    {role}
                                  </div>
                                </td>
                                <td>
                                  {numberWithCommas(row.stats?.userXp ?? 0)}
                                </td>
                                <td>
                                  {numberWithCommas(row.stats?.userHours ?? 0)}
                                </td>
                                <td>
                                  {new Date(row.createdAt).toLocaleDateString()}
                                </td>
                                <td>
                                  {row.lastActivity
                                    ? new Date(
                                        row.lastActivity
                                      ).toLocaleDateString()
                                    : 'Never'}
                                </td>
                                <td>
                                  <div className="flex gap-2">
                                    <button
                                      className="btn btn-ghost btn-xs"
                                      onClick={() => {
                                        setSelectedUser({
                                          _id: row._id,
                                          username: row.username,
                                          roles: row.roles,
                                        });
                                        const arr = Array.isArray(row.roles)
                                          ? row.roles
                                          : [row.roles];
                                        setEditRoles({
                                          admin: arr.includes('admin'),
                                          mod: arr.includes('mod'),
                                        });
                                        setEditUserOpen(true);
                                      }}
                                    >
                                      Edit
                                    </button>
                                    {role !== 'admin' && (
                                      <button
                                        className="btn btn-error btn-xs"
                                        onClick={() => {
                                          if (
                                            confirm(`Delete ${row.username}?`)
                                          )
                                            deleteUserMutation.mutate(row._id);
                                        }}
                                        disabled={deleteUserMutation.isPending}
                                      >
                                        Delete
                                      </button>
                                    )}
                                  </div>
                                </td>
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  </div>
                  <div className="flex justify-center mt-6">
                    <div className="join">
                      <button
                        className="join-item btn"
                        disabled={userPage === 1}
                        onClick={() => setUserPage((p) => Math.max(1, p - 1))}
                      >
                        «
                      </button>
                      <button className="join-item btn">Page {userPage}</button>
                      <button
                        className="join-item btn"
                        onClick={() => setUserPage((p) => p + 1)}
                      >
                        »
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {editUserOpen && selectedUser && (
              <dialog className="modal" open>
                <div className="modal-box max-w-xl">
                  <h3 className="font-bold text-xl">Edit User</h3>
                  <div className="mt-1 mb-4 text-sm">
                    <span className="badge badge-ghost">
                      {selectedUser.username}
                    </span>
                  </div>

                  <div className="space-y-6">
                    <fieldset className="fieldset">
                      <legend className="fieldset-legend">Roles</legend>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <label className="label cursor-pointer justify-between gap-3 bg-base-200 rounded-lg p-3">
                          <span>Moderator</span>
                          <input
                            type="checkbox"
                            className="toggle toggle-info toggle-sm"
                            checked={editRoles.mod}
                            onChange={(e) =>
                              setEditRoles((r) => ({
                                ...r,
                                mod: e.target.checked,
                              }))
                            }
                          />
                        </label>
                        <label className="label cursor-pointer justify-between gap-3 bg-base-200 rounded-lg p-3">
                          <span>Admin</span>
                          <input
                            type="checkbox"
                            className="toggle toggle-error toggle-sm"
                            checked={editRoles.admin}
                            onChange={(e) =>
                              setEditRoles((r) => ({
                                ...r,
                                admin: e.target.checked,
                              }))
                            }
                          />
                        </label>
                      </div>
                      <div className="mt-3 flex justify-end">
                        <button
                          className="btn btn-primary btn-sm"
                          onClick={() => {
                            const roles: string[] = ['user'];
                            if (editRoles.mod) roles.push('mod');
                            if (editRoles.admin) roles.push('admin');
                            updateUserMutation.mutate({
                              userId: selectedUser._id,
                              roles,
                            });
                          }}
                          disabled={updateUserMutation.isPending}
                        >
                          {updateUserMutation.isPending ? (
                            <span className="loading loading-spinner loading-sm"></span>
                          ) : (
                            <span className="inline-flex items-center gap-2">
                              <svg
                                className="w-4 h-4"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth="2"
                                  d="M5 13l4 4L19 7"
                                />
                              </svg>
                              Save roles
                            </span>
                          )}
                        </button>
                      </div>
                    </fieldset>

                    <div className="divider">Password</div>

                    <fieldset className="fieldset">
                      <legend className="fieldset-legend">
                        Reset Password
                      </legend>
                      <div className="join w-full">
                        <label className="floating-label join-item flex-1">
                          <input
                            type="password"
                            className="input w-full"
                            value={newPassword}
                            onChange={(e) => setNewPassword(e.target.value)}
                            placeholder=" "
                          />
                          <span>New password</span>
                        </label>
                        <button
                          className="btn btn-warning join-item"
                          onClick={() => {
                            if (newPassword.length < 6) {
                              toast.error(
                                'Password must be at least 6 characters'
                              );
                              return;
                            }
                            resetPasswordMutation.mutate({
                              userId: selectedUser._id,
                              password: newPassword,
                            });
                          }}
                          disabled={resetPasswordMutation.isPending}
                        >
                          {resetPasswordMutation.isPending ? (
                            <span className="loading loading-spinner loading-sm"></span>
                          ) : (
                            <span className="inline-flex items-center gap-2">
                              <svg
                                xmlns="http://www.w3.org/2000/svg"
                                className="h-5 w-5"
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                                />
                              </svg>
                              Reset
                            </span>
                          )}
                        </button>
                      </div>
                      <p className="text-xs text-base-content/60 mt-1">
                        Min 6 characters.
                      </p>
                    </fieldset>

                    <div className="modal-action">
                      <button
                        className="btn"
                        onClick={() => {
                          setEditUserOpen(false);
                          setSelectedUser(null);
                          setNewPassword('');
                        }}
                      >
                        Close
                      </button>
                    </div>
                  </div>
                </div>
                <form method="dialog" className="modal-backdrop">
                  <button onClick={() => setEditUserOpen(false)}>close</button>
                </form>
              </dialog>
            )}
          </>
        )}

        {/* Logs Tab */}
        {selectedTab === 'logs' && (
          <div className="space-y-6">
            <div className="card bg-base-100 shadow-lg">
              <div className="card-body">
                <h3 className="card-title mb-4">Log Management</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-3">
                  <input
                    type="text"
                    className="input input-bordered"
                    placeholder="Search text..."
                    value={logSearch}
                    onChange={(e) => setLogSearch(e.target.value)}
                  />
                  <input
                    type="text"
                    className="input input-bordered"
                    placeholder="Username"
                    value={logUsername}
                    onChange={(e) => setLogUsername(e.target.value)}
                  />
                  <select
                    className="select select-bordered"
                    value={logType}
                    onChange={(e) => setLogType(e.target.value)}
                  >
                    <option value="">All types</option>
                    <option>anime</option>
                    <option>manga</option>
                    <option>reading</option>
                    <option>vn</option>
                    <option>video</option>
                    <option>movie</option>
                    <option>tv show</option>
                    <option>audio</option>
                  </select>
                  <input
                    type="date"
                    className="input input-bordered"
                    value={logStart}
                    onChange={(e) => setLogStart(e.target.value)}
                  />
                  <input
                    type="date"
                    className="input input-bordered"
                    value={logEnd}
                    onChange={(e) => setLogEnd(e.target.value)}
                  />
                  <div className="flex gap-2">
                    <button
                      className="btn btn-primary"
                      onClick={() => setLogPage(1)}
                    >
                      Search
                    </button>
                    <button
                      className="btn btn-ghost"
                      onClick={() => {
                        setLogSearch('');
                        setLogUsername('');
                        setLogType('');
                        setLogStart('');
                        setLogEnd('');
                        setLogPage(1);
                      }}
                    >
                      Reset
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <div className="card bg-base-100 shadow-lg">
              <div className="card-body">
                <div className="overflow-x-auto">
                  <table className="table">
                    <thead>
                      <tr>
                        <th>Date</th>
                        <th>User</th>
                        <th>Type</th>
                        <th>Description</th>
                        <th>Min</th>
                        <th>Ep</th>
                        <th>Pages</th>
                        <th>Chars</th>
                        <th>XP</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {logsLoading ? (
                        <tr>
                          <td colSpan={10} className="text-center py-8">
                            <span className="loading loading-spinner loading-md"></span>
                          </td>
                        </tr>
                      ) : (
                        adminLogs?.logs?.map((log: AdminLogRow) => (
                          <tr key={log._id}>
                            <td>{new Date(log.date).toLocaleDateString()}</td>
                            <td>{log.username ?? log.user}</td>
                            <td>
                              <div className="badge badge-ghost">
                                {log.type}
                              </div>
                            </td>
                            <td
                              className="max-w-[24rem] truncate"
                              title={log.description}
                            >
                              {log.description}
                            </td>
                            <td>{log.time ?? 0}</td>
                            <td>{log.episodes ?? 0}</td>
                            <td>{log.pages ?? 0}</td>
                            <td>{log.chars ?? 0}</td>
                            <td>{log.xp ?? 0}</td>
                            <td>
                              <div className="flex gap-2">
                                <button
                                  className="btn btn-ghost btn-xs"
                                  onClick={() => {
                                    setSelectedLog(log);
                                    setEditLogOpen(true);
                                  }}
                                >
                                  Edit
                                </button>
                                <button
                                  className="btn btn-error btn-xs"
                                  onClick={() => {
                                    if (confirm('Delete this log?'))
                                      deleteLogMutation.mutate(log._id);
                                  }}
                                  disabled={deleteLogMutation.isPending}
                                >
                                  Delete
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
                <div className="flex justify-center mt-6">
                  <div className="join">
                    <button
                      className="join-item btn"
                      disabled={logPage === 1}
                      onClick={() => setLogPage((p) => Math.max(1, p - 1))}
                    >
                      «
                    </button>
                    <button className="join-item btn">
                      Page {adminLogs?.page ?? logPage} /{' '}
                      {adminLogs?.totalPages ?? 1}
                    </button>
                    <button
                      className="join-item btn"
                      disabled={
                        adminLogs && adminLogs.page >= adminLogs.totalPages
                      }
                      onClick={() => setLogPage((p) => p + 1)}
                    >
                      »
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {editLogOpen && selectedLog && (
              <dialog className="modal" open>
                <div className="modal-box">
                  <h3 className="font-bold text-lg mb-2">Edit Log</h3>
                  <p className="text-sm text-base-content/70 mb-4">
                    {selectedLog.username ?? selectedLog.user} ·{' '}
                    {selectedLog.type}
                  </p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <label className="form-control">
                      <div className="label">
                        <span className="label-text">Description</span>
                      </div>
                      <input
                        type="text"
                        className="input input-bordered"
                        defaultValue={selectedLog.description}
                        onChange={(e) =>
                          setSelectedLog((l) =>
                            l ? { ...l, description: e.target.value } : l
                          )
                        }
                      />
                    </label>
                    <label className="form-control">
                      <div className="label">
                        <span className="label-text">Date</span>
                      </div>
                      <input
                        type="date"
                        className="input input-bordered"
                        value={
                          selectedLog.date
                            ? new Date(selectedLog.date)
                                .toISOString()
                                .slice(0, 10)
                            : ''
                        }
                        onChange={(e) =>
                          setSelectedLog((l) =>
                            l
                              ? {
                                  ...l,
                                  date: new Date(e.target.value).toISOString(),
                                }
                              : l
                          )
                        }
                      />
                    </label>
                    <label className="form-control">
                      <div className="label">
                        <span className="label-text">Minutes</span>
                      </div>
                      <input
                        type="number"
                        className="input input-bordered"
                        value={selectedLog.time ?? 0}
                        onChange={(e) =>
                          setSelectedLog((l) =>
                            l ? { ...l, time: Number(e.target.value) } : l
                          )
                        }
                      />
                    </label>
                    <label className="form-control">
                      <div className="label">
                        <span className="label-text">Episodes</span>
                      </div>
                      <input
                        type="number"
                        className="input input-bordered"
                        value={selectedLog.episodes ?? 0}
                        onChange={(e) =>
                          setSelectedLog((l) =>
                            l ? { ...l, episodes: Number(e.target.value) } : l
                          )
                        }
                      />
                    </label>
                    <label className="form-control">
                      <div className="label">
                        <span className="label-text">Pages</span>
                      </div>
                      <input
                        type="number"
                        className="input input-bordered"
                        value={selectedLog.pages ?? 0}
                        onChange={(e) =>
                          setSelectedLog((l) =>
                            l ? { ...l, pages: Number(e.target.value) } : l
                          )
                        }
                      />
                    </label>
                    <label className="form-control">
                      <div className="label">
                        <span className="label-text">Characters</span>
                      </div>
                      <input
                        type="number"
                        className="input input-bordered"
                        value={selectedLog.chars ?? 0}
                        onChange={(e) =>
                          setSelectedLog((l) =>
                            l ? { ...l, chars: Number(e.target.value) } : l
                          )
                        }
                      />
                    </label>
                  </div>
                  <div className="modal-action">
                    <button
                      className="btn btn-primary"
                      onClick={() => {
                        if (!selectedLog) return;
                        const payload: Partial<updateLogRequest> = {
                          description: selectedLog.description,
                          time: selectedLog.time,
                          episodes: selectedLog.episodes,
                          pages: selectedLog.pages,
                          chars: selectedLog.chars,
                          date: selectedLog.date
                            ? new Date(selectedLog.date)
                            : undefined,
                        };
                        updateLogMutation.mutate({
                          logId: selectedLog._id,
                          payload,
                        });
                      }}
                      disabled={updateLogMutation.isPending}
                    >
                      {updateLogMutation.isPending ? (
                        <span className="loading loading-spinner loading-sm"></span>
                      ) : (
                        'Save'
                      )}
                    </button>
                    <button
                      className="btn"
                      onClick={() => {
                        setEditLogOpen(false);
                        setSelectedLog(null);
                      }}
                    >
                      Close
                    </button>
                  </div>
                </div>
                <form method="dialog" className="modal-backdrop">
                  <button onClick={() => setEditLogOpen(false)}>close</button>
                </form>
              </dialog>
            )}
          </div>
        )}

        {/* System Tab */}
        {selectedTab === 'system' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="card bg-base-100 shadow-lg">
                <div className="card-body">
                  <h3 className="card-title mb-4">System Actions</h3>
                  <div className="space-y-3">
                    <button
                      className="btn btn-warning w-full"
                      onClick={() => recalcMutation.mutate('streaks')}
                      disabled={recalcMutation.isPending}
                    >
                      <svg
                        className="w-5 h-5 mr-2"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth="2"
                          d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                        />
                      </svg>
                      Recalculate All Streaks
                    </button>
                    <button
                      className="btn btn-info w-full"
                      onClick={() => recalcMutation.mutate('xp')}
                      disabled={recalcMutation.isPending}
                    >
                      <svg
                        className="w-5 h-5 mr-2"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth="2"
                          d="M13 10V3L4 14h7v7l9-11h-7z"
                        />
                      </svg>
                      Recalculate All XP
                    </button>
                    <button className="btn btn-secondary w-full">
                      <svg
                        className="w-5 h-5 mr-2"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth="2"
                          d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"
                        />
                      </svg>
                      Export User Data
                    </button>
                  </div>
                </div>
              </div>
              <div className="card bg-base-100 shadow-lg">
                <div className="card-body">
                  <h3 className="card-title mb-4">Database Stats</h3>
                  <div className="stats stats-vertical shadow w-full">
                    <div className="stat">
                      <div className="stat-title">Database Size</div>
                      <div className="stat-value text-lg">2.4 GB</div>
                    </div>
                    <div className="stat">
                      <div className="stat-title">Collections</div>
                      <div className="stat-value text-lg">5</div>
                    </div>
                    <div className="stat">
                      <div className="stat-title">Indexes</div>
                      <div className="stat-value text-lg">12</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default AdminScreen;
