'use client';

import React, { useState, useEffect } from 'react';
import Navbar from '@/components/layout/Navbar';
import Footer from '@/components/layout/Footer';
import fetchWithTimeout from '@/lib/fetch-with-timeout';
import toast from 'react-hot-toast';
import {
  ShieldAlert,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Info,
  Lock,
  Eye,
  EyeOff,
  RefreshCw,
  Trash2,
  Save,
  Globe,
  Apple,
  Key,
  ListFilter,
  Loader2,
} from 'lucide-react';

function GithubIcon({ className = 'w-5 h-5' }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path fillRule="evenodd" clipRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" />
    </svg>
  );
}

function FacebookIcon({ className = 'w-5 h-5' }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
    </svg>
  );
}

export default function AdminOAuthDashboard() {
  const [activeTab, setActiveTab] = useState('providers'); // 'providers' | 'logs'
  const [providers, setProviders] = useState([]);
  const [logs, setLogs] = useState([]);
  const [selectedProviderFilter, setSelectedProviderFilter] = useState('all');
  const [isLoadingProviders, setIsLoadingProviders] = useState(true);
  const [isLoadingLogs, setIsLoadingLogs] = useState(false);
  const [isSaving, setIsSaving] = useState({});
  const [isClearingLogs, setIsClearingLogs] = useState(false);
  const [showSecret, setShowSecret] = useState({});
  const [accessDenied, setAccessDenied] = useState(false);

  // Form states per provider
  const [formValues, setFormValues] = useState({});

  useEffect(() => {
    fetchProviders();
  }, []);

  useEffect(() => {
    if (activeTab === 'logs') {
      fetchLogs();
    }
  }, [activeTab, selectedProviderFilter]);

  const fetchProviders = async () => {
    setIsLoadingProviders(true);
    try {
      const res = await fetchWithTimeout('/api/admin/oauth/providers');
      const json = await res.json();

      if (res.status === 403 || !json.success) {
        setAccessDenied(true);
        setIsLoadingProviders(false);
        return;
      }

      setProviders(json.providers || []);

      // Initialize form values
      const initial = {};
      (json.providers || []).forEach((p) => {
        initial[p.id] = {
          client_id: p.client_id || '',
          client_secret: p.client_secret_masked || '',
          is_enabled: p.is_enabled || false,
          scopes: (p.scopes || []).join(', '),
        };
      });
      setFormValues(initial);
      setAccessDenied(false);
    } catch (err) {
      console.error('Error fetching providers:', err);
      toast.error('Failed to load OAuth providers');
    } finally {
      setIsLoadingProviders(false);
    }
  };

  const fetchLogs = async () => {
    setIsLoadingLogs(true);
    try {
      const url = `/api/admin/oauth/logs?provider=${selectedProviderFilter}`;
      const res = await fetchWithTimeout(url);
      const json = await res.json();
      if (json.success) {
        setLogs(json.logs || []);
      }
    } catch (err) {
      console.error('Error fetching logs:', err);
      toast.error('Failed to load authentication logs');
    } finally {
      setIsLoadingLogs(false);
    }
  };

  const handleInputChange = (providerId, field, value) => {
    setFormValues((prev) => ({
      ...prev,
      [providerId]: {
        ...prev[providerId],
        [field]: value,
      },
    }));
  };

  const handleToggleEnable = async (providerId, currentStatus) => {
    const newStatus = !currentStatus;
    handleInputChange(providerId, 'is_enabled', newStatus);
    await saveProvider(providerId, { is_enabled: newStatus });
  };

  const saveProvider = async (providerId, overrideFields = {}) => {
    const currentForm = formValues[providerId] || {};
    const payload = {
      id: providerId,
      client_id: currentForm.client_id,
      client_secret: currentForm.client_secret,
      is_enabled: overrideFields.is_enabled !== undefined ? overrideFields.is_enabled : currentForm.is_enabled,
      scopes: (currentForm.scopes || '')
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean),
      ...overrideFields,
    };

    setIsSaving((prev) => ({ ...prev, [providerId]: true }));
    const toastId = toast.loading(`Saving ${providerId} settings...`);

    try {
      const res = await fetchWithTimeout('/api/admin/oauth/providers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to update provider');

      toast.success(`${payload.id.toUpperCase()} provider settings saved!`, { id: toastId });

      // Refresh list to sync masked secret state
      await fetchProviders();
    } catch (err) {
      console.error('Save error:', err);
      toast.error(err.message, { id: toastId });
    } finally {
      setIsSaving((prev) => ({ ...prev, [providerId]: false }));
    }
  };

  const clearLogs = async () => {
    if (!window.confirm('Are you sure you want to clear all auth logs?')) return;

    setIsClearingLogs(true);
    try {
      const res = await fetchWithTimeout('/api/admin/oauth/logs', { method: 'DELETE' });
      const json = await res.json();
      if (json.success) {
        toast.success('Auth logs cleared');
        fetchLogs();
      }
    } catch (err) {
      toast.error('Failed to clear logs');
    } finally {
      setIsClearingLogs(false);
    }
  };

  const getProviderIcon = (id) => {
    switch (id) {
      case 'github':
        return <GithubIcon className="w-5 h-5 text-purple-400" />;
      case 'apple':
        return <Apple className="w-5 h-5 text-slate-200" />;
      case 'facebook':
        return <FacebookIcon className="w-5 h-5 text-blue-400" />;
      case 'google':
      default:
        return <Globe className="w-5 h-5 text-pink-400" />;
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'success':
        return (
          <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <CheckCircle2 size={12} /> Success
          </span>
        );
      case 'error':
        return (
          <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full bg-red-500/10 text-red-400 border border-red-500/20">
            <XCircle size={12} /> Error
          </span>
        );
      case 'warning':
        return (
          <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20">
            <AlertTriangle size={12} /> Warning
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20">
            <Info size={12} /> Info
          </span>
        );
    }
  };

  if (accessDenied) {
    return (
      <div className="page">
        <Navbar />
        <div className="max-w-4xl mx-auto px-4 py-16 w-full">
          <div className="bg-red-950/30 border border-red-900/60 rounded-3xl p-8 text-center space-y-4 shadow-xl">
            <ShieldAlert className="w-16 h-16 text-red-400 mx-auto" />
            <h1 className="text-2xl font-bold text-white">Admin Access Restricted</h1>
            <p className="text-red-200/80 text-sm max-w-md mx-auto">
              You do not have administrator permissions to view or configure OAuth providers. Please contact your system administrator for access.
            </p>
          </div>
        </div>
        <Footer />
      </div>
    );
  }

  return (
    <div className="page">
      <Navbar />
      <div className="max-w-6xl mx-auto px-4 py-8 w-full">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <ShieldCheck className="w-8 h-8 text-pink-500" />
              OAuth 2.0 Provider Management
            </h1>
            <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">
              Configure external OAuth credentials, toggle social logins, and review authentication logs.
            </p>
          </div>

          {/* Tab Navigation */}
          <div className="flex items-center bg-slate-200 dark:bg-slate-800 p-1 rounded-2xl w-fit">
            <button
              onClick={() => setActiveTab('providers')}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-colors ${
                activeTab === 'providers'
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Key size={16} /> Providers
            </button>
            <button
              onClick={() => setActiveTab('logs')}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-colors ${
                activeTab === 'logs'
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <ListFilter size={16} /> Connection Logs
            </button>
          </div>
        </div>

        {/* TAB 1: PROVIDERS CONFIGURATION */}
        {activeTab === 'providers' && (
          <div>
            {isLoadingProviders ? (
              <div className="flex items-center justify-center py-20 text-slate-400">
                <Loader2 className="w-8 h-8 animate-spin text-pink-500" />
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {providers.map((p) => {
                  const form = formValues[p.id] || {};
                  const saving = isSaving[p.id];
                  const secretVisible = showSecret[p.id];

                  return (
                    <div
                      key={p.id}
                      className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-sm flex flex-col justify-between space-y-6"
                    >
                      {/* Card Header */}
                      <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4">
                        <div className="flex items-center gap-3">
                          <div className="p-2.5 bg-slate-100 dark:bg-slate-800 rounded-2xl">
                            {getProviderIcon(p.id)}
                          </div>
                          <div>
                            <h3 className="font-bold text-lg text-slate-900 dark:text-white">{p.name}</h3>
                            <span className="text-xs text-slate-500 dark:text-slate-400 font-mono">
                              OAuth 2.0 / OIDC
                            </span>
                          </div>
                        </div>

                        {/* Enable/Disable Toggle */}
                        <div className="flex items-center gap-2">
                          <span
                            className={`text-xs font-semibold px-2.5 py-1 rounded-full ${
                              form.is_enabled
                                ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                                : 'bg-slate-100 dark:bg-slate-800 text-slate-500'
                            }`}
                          >
                            {form.is_enabled ? 'Active' : 'Disabled'}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleToggleEnable(p.id, form.is_enabled)}
                            className={`w-12 h-6 rounded-full relative transition-colors focus:outline-none ${
                              form.is_enabled ? 'bg-pink-500' : 'bg-slate-300 dark:bg-slate-700'
                            }`}
                          >
                            <span
                              className={`block w-5 h-5 bg-white rounded-full transition-transform transform ${
                                form.is_enabled ? 'translate-x-6' : 'translate-x-0.5'
                              }`}
                            />
                          </button>
                        </div>
                      </div>

                      {/* Credentials Input Fields */}
                      <div className="space-y-4">
                        <div>
                          <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-1">
                            Client ID
                          </label>
                          <input
                            type="text"
                            value={form.client_id || ''}
                            onChange={(e) => handleInputChange(p.id, 'client_id', e.target.value)}
                            placeholder={`Enter ${p.name} Client ID`}
                            className="w-full bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl p-2.5 text-sm text-slate-900 dark:text-white font-mono focus:outline-none focus:ring-2 focus:ring-pink-500/50"
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-1">
                            Client Secret
                          </label>
                          <div className="relative">
                            <input
                              type={secretVisible ? 'text' : 'password'}
                              value={form.client_secret || ''}
                              onChange={(e) => handleInputChange(p.id, 'client_secret', e.target.value)}
                              placeholder={`Enter ${p.name} Client Secret`}
                              className="w-full bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl p-2.5 text-sm text-slate-900 dark:text-white font-mono focus:outline-none focus:ring-2 focus:ring-pink-500/50 pr-10"
                            />
                            <button
                              type="button"
                              onClick={() =>
                                setShowSecret((prev) => ({ ...prev, [p.id]: !prev[p.id] }))
                              }
                              className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600 dark:hover:text-white"
                            >
                              {secretVisible ? <EyeOff size={16} /> : <Eye size={16} />}
                            </button>
                          </div>
                        </div>

                        <div>
                          <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-1">
                            OAuth Scopes
                          </label>
                          <input
                            type="text"
                            value={form.scopes || ''}
                            onChange={(e) => handleInputChange(p.id, 'scopes', e.target.value)}
                            placeholder="e.g. email, profile, openid"
                            className="w-full bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl p-2.5 text-sm text-slate-900 dark:text-white font-mono focus:outline-none focus:ring-2 focus:ring-pink-500/50"
                          />
                        </div>
                      </div>

                      {/* Card Footer Actions */}
                      <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex justify-end">
                        <button
                          type="button"
                          onClick={() => saveProvider(p.id)}
                          disabled={saving}
                          className="flex items-center gap-2 bg-pink-500 hover:bg-pink-600 text-white px-5 py-2 rounded-xl text-sm font-medium transition-colors disabled:opacity-50"
                        >
                          {saving ? (
                            <>
                              <Loader2 size={16} className="animate-spin" /> Saving...
                            </>
                          ) : (
                            <>
                              <Save size={16} /> Save Changes
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* TAB 2: CONNECTION & AUTH LOGS */}
        {activeTab === 'logs' && (
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-sm space-y-6">
            {/* Filter & Action Toolbar */}
            <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 dark:border-slate-800 pb-4">
              <div className="flex items-center gap-3">
                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Filter Provider:</label>
                <select
                  value={selectedProviderFilter}
                  onChange={(e) => setSelectedProviderFilter(e.target.value)}
                  className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-1.5 text-sm text-slate-900 dark:text-white focus:outline-none"
                >
                  <option value="all">All Providers</option>
                  <option value="google">Google</option>
                  <option value="github">GitHub</option>
                  <option value="apple">Apple</option>
                  <option value="facebook">Facebook</option>
                  <option value="system">System</option>
                </select>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={fetchLogs}
                  disabled={isLoadingLogs}
                  className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 px-3 py-1.5 rounded-xl text-sm font-medium transition-colors"
                >
                  <RefreshCw size={14} className={isLoadingLogs ? 'animate-spin' : ''} /> Refresh
                </button>
                <button
                  type="button"
                  onClick={clearLogs}
                  disabled={isClearingLogs || logs.length === 0}
                  className="flex items-center gap-1.5 bg-red-500/10 hover:bg-red-500/20 text-red-500 px-3 py-1.5 rounded-xl text-sm font-medium transition-colors disabled:opacity-50"
                >
                  <Trash2 size={14} /> Clear Logs
                </button>
              </div>
            </div>

            {/* Logs List / Table */}
            {isLoadingLogs ? (
              <div className="flex justify-center py-16 text-slate-400">
                <Loader2 className="w-8 h-8 animate-spin text-pink-500" />
              </div>
            ) : logs.length === 0 ? (
              <div className="text-center py-16 text-slate-400 text-sm">
                No connection logs found.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-slate-800 text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                      <th className="py-3 px-4">Timestamp</th>
                      <th className="py-3 px-4">Provider</th>
                      <th className="py-3 px-4">Event</th>
                      <th className="py-3 px-4">Status</th>
                      <th className="py-3 px-4">Message</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {logs.map((log) => (
                      <tr key={log.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40 transition-colors">
                        <td className="py-3.5 px-4 text-xs font-mono text-slate-500 dark:text-slate-400 whitespace-nowrap">
                          {new Date(log.created_at).toLocaleString()}
                        </td>
                        <td className="py-3.5 px-4 font-semibold text-slate-900 dark:text-white capitalize">
                          {log.provider}
                        </td>
                        <td className="py-3.5 px-4 font-mono text-xs text-slate-700 dark:text-slate-300">
                          {log.event}
                        </td>
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          {getStatusBadge(log.status)}
                        </td>
                        <td className="py-3.5 px-4 text-slate-600 dark:text-slate-300 max-w-md truncate">
                          {log.message}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
      <Footer />
    </div>
  );
}
