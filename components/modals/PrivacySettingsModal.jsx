'use client';

import React, { useState, useEffect } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import * as Switch from '@radix-ui/react-switch';
import { Download, AlertTriangle, X, Shield, Trash2, CheckCircle2, Loader2 } from 'lucide-react';
import fetchWithTimeout from '@/lib/fetch-with-timeout';
import toast from 'react-hot-toast';
import { useClerk } from '@clerk/nextjs';

export default function PrivacySettingsModal({ trigger, initialProfile, isOpen, onOpenChange }) {
  const [allowAI, setAllowAI] = useState(true);
  const [isExporting, setIsExporting] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteConfirmationText, setDeleteConfirmationText] = useState('');
  const { signOut } = useClerk();

  useEffect(() => {
    if (initialProfile !== undefined) {
      setAllowAI(initialProfile?.allow_ai_analysis ?? true);
    } else {
      fetchWithTimeout('/api/profile')
        .then((res) => res.json())
        .then((data) => {
          if (data.success && data.profile) {
            setAllowAI(data.profile.allow_ai_analysis ?? true);
          }
        })
        .catch(console.error);
    }
  }, [initialProfile]);

  const handleToggleAI = async (checked) => {
    setAllowAI(checked);
    setIsUpdating(true);
    const toastId = toast.loading('Updating privacy settings...');
    try {
      const res = await fetchWithTimeout('/api/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ allow_ai_analysis: checked }),
      });
      if (!res.ok) throw new Error('Failed to update settings');
      toast.success('Privacy settings updated successfully', { id: toastId });
    } catch (error) {
      setAllowAI(!checked);
      toast.error('Failed to update privacy settings', { id: toastId });
    } finally {
      setIsUpdating(false);
    }
  };

  const handleExportData = async () => {
    setIsExporting(true);
    const toastId = toast.loading('Preparing your GDPR data export (JSON & CSV)...');
    try {
      const res = await fetchWithTimeout('/api/privacy/export');
      if (!res.ok) {
        throw new Error('Export request failed');
      }
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'my-hercycle-gdpr-data.zip';
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      a.remove();
      toast.success('Personal data exported successfully!', { id: toastId });
    } catch (error) {
      console.error('Data export error:', error);
      toast.error('Could not export personal data. Please try again.', { id: toastId });
    } finally {
      setIsExporting(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (deleteConfirmationText.trim().toUpperCase() !== 'DELETE') {
      toast.error('Please type "DELETE" to confirm account deletion.');
      return;
    }

    setIsDeleting(true);
    const toastId = toast.loading('Purging user account & revoking access tokens...');
    try {
      const res = await fetchWithTimeout('/api/privacy/delete', {
        method: 'DELETE',
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to delete account');

      toast.success('Account permanently deleted.', { id: toastId });
      setShowDeleteConfirm(false);

      // Sign out user and redirect to homepage
      setTimeout(async () => {
        try {
          await signOut();
        } catch (e) {}
        window.location.href = '/';
      }, 1000);
    } catch (error) {
      console.error('Delete account error:', error);
      toast.error(error.message || 'Could not delete account. Please try again.', { id: toastId });
      setIsDeleting(false);
    }
  };

  return (
    <Dialog.Root open={isOpen} onOpenChange={onOpenChange}>
      {trigger && <Dialog.Trigger asChild>{trigger}</Dialog.Trigger>}
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 transition-opacity" />
        <Dialog.Content className="fixed top-[50%] left-[50%] translate-x-[-50%] translate-y-[-50%] bg-slate-900 text-white rounded-3xl p-6 sm:p-8 w-[95vw] max-w-lg shadow-2xl z-50 border border-slate-800 focus:outline-none max-h-[90vh] overflow-y-auto">
          <div className="flex justify-between items-start mb-6">
            <Dialog.Title className="text-2xl font-bold flex items-center gap-2">
              <Shield className="w-6 h-6 text-pink-400" />
              Privacy & Data Control
            </Dialog.Title>
            <Dialog.Close asChild>
              <button className="text-slate-400 hover:text-white transition-colors p-1" aria-label="Close">
                <X className="w-5 h-5" />
              </button>
            </Dialog.Close>
          </div>

          <div className="space-y-6">
            {/* AI Analysis Toggle */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 bg-slate-800/60 rounded-2xl border border-slate-700/60">
              <div className="space-y-1 pr-4">
                <h3 className="font-semibold text-white text-base">AI Analysis & Guidance</h3>
                <p className="text-xs text-slate-300 leading-relaxed">
                  Allow AI algorithms to analyze anonymized logs for cycle predictions and personalized insights.
                </p>
              </div>
              <Switch.Root
                checked={allowAI}
                onCheckedChange={handleToggleAI}
                disabled={isUpdating}
                className={`w-[42px] h-[25px] rounded-full relative outline-none cursor-pointer disabled:opacity-50 transition-colors ${
                  allowAI ? 'bg-pink-500' : 'bg-slate-700'
                }`}
              >
                <Switch.Thumb className="block w-[21px] h-[21px] bg-white rounded-full transition-transform translate-x-[2px] data-[state=checked]:translate-x-[19px] shadow-md" />
              </Switch.Root>
            </div>

            <hr className="border-slate-800" />

            {/* GDPR Export Section */}
            <div className="space-y-3 p-4 bg-slate-800/30 rounded-2xl border border-slate-800">
              <div className="flex items-center gap-2">
                <Download className="w-5 h-5 text-pink-400" />
                <h3 className="font-semibold text-white">Export My Data (GDPR)</h3>
              </div>
              <p className="text-xs text-slate-300 leading-relaxed">
                Request a complete download of your personal data including health profile, cycle history, symptoms, forum posts, comments, and challenge achievements in JSON & CSV formats.
              </p>
              <button
                onClick={handleExportData}
                disabled={isExporting}
                className="flex items-center gap-2 bg-pink-500 hover:bg-pink-600 text-white px-5 py-2.5 rounded-xl transition-colors font-medium text-sm disabled:opacity-50 w-full sm:w-auto justify-center"
              >
                {isExporting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Preparing Export...
                  </>
                ) : (
                  <>
                    <Download className="w-4 h-4" />
                    Export My Data
                  </>
                )}
              </button>
            </div>

            <hr className="border-slate-800" />

            {/* Delete Account Section */}
            <div className="bg-red-950/30 border border-red-900/50 p-4 rounded-2xl space-y-3">
              <div className="flex items-center gap-2 text-red-400">
                <AlertTriangle className="w-5 h-5 shrink-0" />
                <h3 className="font-semibold text-red-300">Delete My Account</h3>
              </div>
              <p className="text-red-200/80 text-xs leading-relaxed">
                Permanently delete your profile, cycle logs, forum posts, and all associated personal data from our databases and revoke your session tokens. This action is irreversible.
              </p>

              {!showDeleteConfirm ? (
                <button
                  onClick={() => setShowDeleteConfirm(true)}
                  className="flex items-center gap-2 bg-red-600/20 hover:bg-red-600/30 text-red-300 border border-red-500/30 px-4 py-2 rounded-xl transition-colors font-medium text-sm"
                >
                  <Trash2 className="w-4 h-4" />
                  Delete My Account
                </button>
              ) : (
                <div className="space-y-3 pt-2 border-t border-red-900/50">
                  <p className="text-xs font-semibold text-red-300">
                    Type <span className="font-mono bg-red-900/60 px-1.5 py-0.5 rounded text-white">DELETE</span> to confirm permanent deletion:
                  </p>
                  <input
                    type="text"
                    value={deleteConfirmationText}
                    onChange={(e) => setDeleteConfirmationText(e.target.value)}
                    placeholder='Type "DELETE"'
                    className="w-full bg-slate-900 border border-red-800 rounded-lg p-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-red-500"
                  />
                  <div className="flex items-center gap-2 pt-1">
                    <button
                      onClick={handleDeleteAccount}
                      disabled={isDeleting || deleteConfirmationText.trim().toUpperCase() !== 'DELETE'}
                      className="flex-1 flex items-center justify-center gap-2 bg-red-600 hover:bg-red-700 text-white py-2 px-4 rounded-xl font-medium text-sm transition-colors disabled:opacity-50"
                    >
                      {isDeleting ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Deleting Account...
                        </>
                      ) : (
                        'Confirm Permanent Deletion'
                      )}
                    </button>
                    <button
                      onClick={() => {
                        setShowDeleteConfirm(false);
                        setDeleteConfirmationText('');
                      }}
                      className="bg-slate-800 hover:bg-slate-700 text-slate-300 py-2 px-4 rounded-xl font-medium text-sm transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>

            <div className="flex justify-end pt-2">
              <Dialog.Close asChild>
                <button className="bg-slate-800 hover:bg-slate-700 text-white px-6 py-2.5 rounded-xl font-medium text-sm transition-colors">
                  Close
                </button>
              </Dialog.Close>
            </div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
