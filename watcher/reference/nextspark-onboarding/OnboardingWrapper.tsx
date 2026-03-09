'use client'

import { type ReactNode } from 'react'
import { OnboardingProvider } from './OnboardingProvider'

/**
 * Client component wrapper for OnboardingProvider.
 * Used in the dashboard layout to wrap children with onboarding functionality.
 */
export function OnboardingWrapper({ children }: { children: ReactNode }) {
  return (
    <OnboardingProvider>
      {children}
    </OnboardingProvider>
  )
}
