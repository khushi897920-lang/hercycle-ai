'use client'

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useLocale } from 'next-intl';
import { 
  Trophy, 
  Users, 
  User, 
  Bell, 
  LogOut, 
  Settings, 
  Menu, 
  X 
} from 'lucide-react';

export function Navbar() {
  const pathname = usePathname() || '';
  let locale = 'en';
  try {
    const activeLocale = useLocale();
    if (activeLocale) locale = activeLocale;
  } catch (e) {
    locale = pathname.split('/')[1] === 'hi' ? 'hi' : 'en';
  }
  const [profileDropdownOpen, setProfileDropdownOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Helper to construct localized routes
  const getLocalizedPath = (path) => `/${locale}${path}`;

  const isActive = (path) => pathname === getLocalizedPath(path) || pathname === path;

  return (
    <header className="sticky top-0 z-50 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        
        {/* Brand Logo */}
        <Link href={getLocalizedPath('/')} className="text-xl font-bold bg-gradient-to-r from-emerald-600 to-teal-500 bg-clip-text text-transparent">
          Hercycle AI
        </Link>

        {/* Primary Desktop Nav (Challenges & Community removed) */}
        <nav className="hidden md:flex items-center gap-6">
          <Link 
            href={getLocalizedPath('/dashboard')}
            className={`text-sm font-medium transition-colors ${isActive('/dashboard') ? 'text-emerald-600 font-semibold' : 'text-gray-600 dark:text-gray-300 hover:text-emerald-600'}`}
          >
            Dashboard
          </Link>
          <Link 
            href={getLocalizedPath('/impact')}
            className={`text-sm font-medium transition-colors ${isActive('/impact') ? 'text-emerald-600 font-semibold' : 'text-gray-600 dark:text-gray-300 hover:text-emerald-600'}`}
          >
            Impact
          </Link>
        </nav>

        {/* Right Side: Profile Dropdown & Mobile Toggle */}
        <div className="flex items-center gap-4">
          
          {/* User Profile Dropdown Drawer Container */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setProfileDropdownOpen(!profileDropdownOpen)}
              className="flex items-center gap-2 p-1.5 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors border border-gray-200 dark:border-gray-700"
            >
              <div className="w-8 h-8 rounded-full bg-emerald-100 dark:bg-emerald-900/60 text-emerald-600 dark:text-emerald-300 flex items-center justify-center font-bold text-sm">
                U
              </div>
            </button>

            {/* Dropdown Menu */}
            {profileDropdownOpen && (
              <div className="absolute right-0 mt-2 w-56 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl shadow-xl py-2 z-50">
                <div className="px-4 py-2 border-b border-gray-100 dark:border-gray-800">
                  <p className="text-xs text-gray-500">Signed in as</p>
                  <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">user@hercycle.ai</p>
                </div>

                <div className="py-1">
                  {/* Migrated 'Challenges' Link */}
                  <Link
                    href={getLocalizedPath('/challenges')}
                    onClick={() => setProfileDropdownOpen(false)}
                    className={`flex items-center gap-3 px-4 py-2.5 text-sm transition-colors ${
                      isActive('/challenges') 
                        ? 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 font-semibold' 
                        : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800'
                    }`}
                  >
                    <Trophy className="w-4 h-4" />
                    Challenges
                  </Link>

                  {/* Migrated 'Community' Link */}
                  <Link
                    href={getLocalizedPath('/community')}
                    onClick={() => setProfileDropdownOpen(false)}
                    className={`flex items-center gap-3 px-4 py-2.5 text-sm transition-colors ${
                      isActive('/community') 
                        ? 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 font-semibold' 
                        : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800'
                    }`}
                  >
                    <Users className="w-4 h-4" />
                    Community
                  </Link>
                </div>

                <div className="border-t border-gray-100 dark:border-gray-800 py-1">
                  <Link
                    href={getLocalizedPath('/account')}
                    onClick={() => setProfileDropdownOpen(false)}
                    className="flex items-center gap-3 px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800"
                  >
                    <Settings className="w-4 h-4 text-gray-400" />
                    Manage Account
                  </Link>
                  <Link
                    href={getLocalizedPath('/notifications')}
                    onClick={() => setProfileDropdownOpen(false)}
                    className="flex items-center gap-3 px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800"
                  >
                    <Bell className="w-4 h-4 text-gray-400" />
                    Notifications
                  </Link>
                </div>

                <div className="border-t border-gray-100 dark:border-gray-800 pt-1">
                  <button
                    type="button"
                    onClick={() => { setProfileDropdownOpen(false); }}
                    className="w-full flex items-center gap-3 px-4 py-2 text-sm text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors"
                  >
                    <LogOut className="w-4 h-4" />
                    Sign Out
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Mobile Menu Button */}
          <button
            type="button"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden p-2 text-gray-600 dark:text-gray-300"
          >
            {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>
      </div>

      {/* Mobile Drawer Menu (Cleaned and Uncluttered) */}
      {mobileMenuOpen && (
        <div className="md:hidden border-t border-gray-200 dark:border-gray-800 px-4 py-4 space-y-3 bg-white dark:bg-gray-900">
          <Link
            href={getLocalizedPath('/dashboard')}
            onClick={() => setMobileMenuOpen(false)}
            className="block text-sm font-medium text-gray-700 dark:text-gray-300 py-2"
          >
            Dashboard
          </Link>
          <Link
            href={getLocalizedPath('/impact')}
            onClick={() => setMobileMenuOpen(false)}
            className="block text-sm font-medium text-gray-700 dark:text-gray-300 py-2"
          >
            Impact
          </Link>
          <div className="pt-2 border-t border-gray-100 dark:border-gray-800 space-y-2">
            <Link
              href={getLocalizedPath('/challenges')}
              onClick={() => setMobileMenuOpen(false)}
              className="flex items-center gap-3 text-sm font-medium text-emerald-600 py-2"
            >
              <Trophy className="w-4 h-4" /> Challenges
            </Link>
            <Link
              href={getLocalizedPath('/community')}
              onClick={() => setMobileMenuOpen(false)}
              className="flex items-center gap-3 text-sm font-medium text-emerald-600 py-2"
            >
              <Users className="w-4 h-4" /> Community
            </Link>
          </div>
        </div>
      )}
    </header>
  );
}
