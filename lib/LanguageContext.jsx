'use client'

import React, { createContext, useContext, useState } from 'react'
import { t } from './i18n'

const LanguageContext = createContext({
  language: 'EN',
  setLanguage: () => {},
  useTranslation: () => '',
})

export function LanguageProvider({ children }) {
  const [language, setLanguage] = useState('EN')

  // Helper function to expose translations based on current language
  const useTranslation = (section, key) => {
    return t(language, section, key)
  }

  return (
    <LanguageContext.Provider value={{ language, setLanguage, useTranslation }}>
      {children}
    </LanguageContext.Provider>
  )
}

export function useLanguage() {
  return useContext(LanguageContext)
}
