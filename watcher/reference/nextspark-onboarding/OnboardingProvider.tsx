'use client'

import { useTranslations } from 'next-intl'
import { WalkmeProvider } from '@/contents/plugins/walkme/components/WalkmeProvider'
import { useWalkme } from '@/contents/plugins/walkme/hooks/useWalkme'
import type { WalkmeLabels, Tour, TourEvent } from '@/contents/plugins/walkme/types/walkme.types'
import { createProfessionalTour, createOwnerContextualTooltips, createConditionalDataTooltips } from './tours'
import { OnboardingResumeBanner } from './OnboardingResumeBanner'
import { OnboardingCompleteBanner } from './OnboardingCompleteBanner'
import { ONBOARDING_SELECTORS } from './selectors'
import { useState, useMemo, useEffect, useCallback, useRef, type ReactNode } from 'react'
import { useSession } from '@nextsparkjs/core/lib/auth-client'
import { fetchWithTeam } from '@nextsparkjs/core/lib/api/entities'

interface OnboardingStatusResponse {
  path: 'owner' | 'professional'
  status: 'not_started' | 'in_progress' | 'completed' | 'skipped'
  lastStep: string | null
  teamName: string
  userRole: string
  userName: string
  serviceCount: number
}

interface OnboardingProviderProps {
  children: ReactNode
}

/**
 * Check localStorage for active WalkMe tour state.
 * Used to determine if we should render WalkmeProvider even before API data arrives.
 * Checks user-scoped key first, falls back to global key for backwards compat.
 */
function hasPersistedActiveTour(userId?: string): boolean {
  if (typeof window === 'undefined') return false
  try {
    const key = userId ? `walkme-state-${userId}` : 'walkme-state'
    const raw = localStorage.getItem(key)
    if (!raw) return false
    const parsed = JSON.parse(raw)
    return !!parsed?.activeTour
  } catch {
    return false
  }
}

/**
 * Onboarding provider for the Kuore dashboard.
 *
 * Two onboarding paths:
 * - **Owners:** SetupWizard at /dashboard/welcome handles initial setup.
 *   After completing the wizard, contextual tooltips appear once per section
 *   (dashboard, agenda, services, professionals) on first visit.
 * - **Professionals:** Full WalkMe guided tour (6 steps) for invited team members.
 */
export function OnboardingProvider({ children }: OnboardingProviderProps) {
  const t = useTranslations('onboarding')
  const { data: session } = useSession()
  const userId = session?.user?.id

  // 1. Check for persisted tour state (survives cross-layout navigation)
  const [hasPersistedTour] = useState(() => hasPersistedActiveTour(userId))

  // 2. Fetch onboarding status (plain fetch — avoids TanStack Query context issues)
  const [onboardingData, setOnboardingData] = useState<OnboardingStatusResponse | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const fetchedRef = useRef(false)

  useEffect(() => {
    if (fetchedRef.current) return
    fetchedRef.current = true

    fetchWithTeam('/api/v1/theme/kuore/onboarding/status')
      .then(res => {
        if (!res.ok) throw new Error('Failed to fetch onboarding status')
        return res.json()
      })
      .then(json => {
        const data = json.data as OnboardingStatusResponse
        setOnboardingData(data)
        setIsLoading(false)

        // Fresh owner redirect: server-side in (main)/layout.tsx handles the main case.
        // This client-side fallback catches client-side navigation via router.push.
        if (
          data.path === 'owner'
          && data.userRole === 'owner'
          && (data.status === 'not_started' || data.status === 'in_progress')
          && data.serviceCount === 0
          && typeof window !== 'undefined'
          && !window.location.pathname.startsWith('/dashboard/welcome')
        ) {
          window.location.href = '/dashboard/welcome'
        }
      })
      .catch(err => {
        console.error('[Onboarding] Failed to fetch status:', err)
        setIsLoading(false)
      })
  }, [])

  // 3. Build tours — professional tour OR owner contextual tooltips
  const tours = useMemo<Tour[]>(() => {
    if (!onboardingData) return []

    const { path, status, userRole, userName, teamName } = onboardingData

    // Skip tours for viewer/client users
    if (userRole === 'viewer' || userRole === 'client') return []

    // Owners: contextual tooltips after completing the SetupWizard
    // + conditional data-driven tooltips (manual trigger, started by components)
    if (path === 'owner' || userRole === 'owner') {
      if (status === 'completed') {
        return [
          ...createOwnerContextualTooltips(t),
          ...createConditionalDataTooltips(t),
        ]
      }
      return createConditionalDataTooltips(t)
    }

    // Admins also get conditional tooltips
    if (userRole === 'admin') {
      return createConditionalDataTooltips(t)
    }

    // Professional tour for invited team members (not if already completed)
    if (path === 'professional' && status !== 'completed') {
      return [createProfessionalTour(t, userName, teamName)]
    }

    return []
  }, [onboardingData, t])

  // 4. Build i18n labels for WalkMe UI
  const labels = useMemo<Partial<WalkmeLabels>>(() => ({
    next: t('labels.next'),
    prev: t('labels.prev'),
    skip: t('labels.skip'),
    complete: t('labels.complete'),
    close: t('labels.close'),
    progress: t('labels.progress', { current: '{current}', total: '{total}' }),
    tourAvailable: t('labels.tourAvailable'),
  }), [t])

  // 5. Callbacks for tour lifecycle
  // Only call the backend API for the professional tour — owner contextual tooltips
  // are persisted entirely via localStorage (notCompletedTours condition).
  const handleComplete = useCallback(async (event: TourEvent) => {
    if (event.tourId !== 'kuore-professional-tour') return
    try {
      await fetchWithTeam('/api/v1/theme/kuore/onboarding/complete', { method: 'POST' })
    } catch (error) {
      console.error('[Onboarding] Failed to mark as complete:', error)
    }
  }, [])

  const handleSkip = useCallback(async (event: TourEvent) => {
    if (event.tourId !== 'kuore-professional-tour') return
    try {
      await fetchWithTeam('/api/v1/theme/kuore/onboarding/skip', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lastStep: event.stepId }),
      })
    } catch (error) {
      console.error('[Onboarding] Failed to mark as skipped:', error)
    }
  }, [])

  // 6. Condition context for WalkMe's condition evaluator
  const conditionContext = useMemo(() => ({
    userRole: onboardingData?.userRole,
  }), [onboardingData?.userRole])

  // If no persisted tour AND still loading, render children without WalkMe
  // (first visit — no tour active yet, safe to wait for API)
  if (!hasPersistedTour && (isLoading || !onboardingData)) {
    return <>{children}</>
  }

  // If professional tour completed and no active persisted tour, show celebration banner
  if (
    !isLoading
    && onboardingData?.status === 'completed'
    && onboardingData.path === 'professional'
    && !hasPersistedTour
  ) {
    return (
      <>
        {children}
        <OnboardingCompleteBanner
          path="professional"
          userId={userId}
        />
      </>
    )
  }
  // Note: completed owners fall through — they get contextual tooltips via WalkMe

  // If no tours apply (owner, client mode, wrong role, etc.) and no persisted tour, skip WalkMe
  if (!isLoading && onboardingData && tours.length === 0 && !hasPersistedTour) {
    return <>{children}</>
  }

  // Render with WalkMe — professional tour active or persisted state from mid-tour navigation
  return (
    <WalkmeProvider
      tours={tours}
      autoStart
      persistState
      userId={userId}
      serverSyncUrl="/api/v1/theme/kuore/walkme/state"
      onTourComplete={handleComplete}
      onTourSkip={handleSkip}
      conditionContext={conditionContext}
      labels={labels}
    >
      <div data-cy={ONBOARDING_SELECTORS.provider}>
        {children}

        {onboardingData?.status === 'skipped' && onboardingData.path === 'professional' && (
          <OnboardingResumeBanner tourId="kuore-professional-tour" />
        )}

        {/* Emit trigger event for professional tour only */}
        {onboardingData && onboardingData.path === 'professional' && (
          <OnboardingTrigger status={onboardingData.status} />
        )}
      </div>
    </WalkmeProvider>
  )
}

/**
 * Internal component that emits the professional tour trigger event once after mount.
 * Must be a child of WalkmeProvider to access useWalkme().
 */
function OnboardingTrigger({ status }: { status: string }) {
  const { emitEvent } = useWalkme()
  const emittedRef = useRef(false)

  useEffect(() => {
    if ((status !== 'not_started' && status !== 'in_progress') || emittedRef.current) return
    emittedRef.current = true
    emitEvent('onboarding:professional-start')
  }, [status, emitEvent])

  return null
}
