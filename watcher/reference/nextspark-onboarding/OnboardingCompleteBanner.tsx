'use client'

import { useEffect, useCallback, useState } from 'react'
import { useTranslations } from 'next-intl'
import { Button } from '@nextsparkjs/core/components/ui/button'
import { ONBOARDING_SELECTORS } from './selectors'
import {
  CheckCircle,
  ArrowsClockwise,
  X,
} from '@phosphor-icons/react'

interface Props {
  path: 'professional'
  userId?: string
}

/**
 * Celebration banner shown after professional tour completion.
 *
 * Includes a "re-watch tour" option that resets onboarding to in_progress
 * and reloads the page so the tour replays.
 *
 * Dismissible — stores dismissed state in localStorage per user.
 */
export function OnboardingCompleteBanner({ userId }: Props) {
  const t = useTranslations('onboarding')
  const [dismissed, setDismissed] = useState(true) // start hidden to avoid flash
  const storageKey = userId
    ? `onboarding-complete-dismissed-${userId}`
    : 'onboarding-complete-dismissed'

  useEffect(() => {
    const wasDismissed = localStorage.getItem(storageKey) === 'true'
    setDismissed(wasDismissed)
  }, [storageKey])

  const handleDismiss = useCallback(() => {
    localStorage.setItem(storageKey, 'true')
    setDismissed(true)
  }, [storageKey])

  const handleRewatch = useCallback(async () => {
    try {
      // Clear walkme state from localStorage
      const walkmeKey = userId ? `walkme-state-${userId}` : 'walkme-state'
      localStorage.removeItem(walkmeKey)
      localStorage.removeItem(storageKey)

      // Reset onboarding status to in_progress via API
      await fetch('/api/v1/theme/kuore/onboarding/restart', { method: 'POST' })

      // Reload to let OnboardingProvider pick up the new status
      window.location.reload()
    } catch (error) {
      console.error('[Onboarding] Failed to restart tour:', error)
    }
  }, [userId, storageKey])

  if (dismissed) return null

  return (
    <div
      data-cy={ONBOARDING_SELECTORS.completeBanner}
      role="status"
      className="fixed bottom-6 left-1/2 z-50 w-[calc(100%-2rem)] max-w-lg -translate-x-1/2"
    >
      <div className="relative rounded-2xl border border-emerald-200/60 bg-white/95 p-4 shadow-[0_8px_32px_oklch(0.55_0.15_155/0.12)] backdrop-blur-md dark:border-emerald-800/30 dark:bg-card/95 dark:shadow-[0_8px_32px_oklch(0.20_0.05_155/0.25)]">
        {/* Dismiss button */}
        <button
          onClick={handleDismiss}
          data-cy={ONBOARDING_SELECTORS.completeDismiss}
          className="absolute right-3 top-3 cursor-pointer rounded-md p-1 text-foreground/40 transition-colors hover:text-foreground/70"
          aria-label={t('labels.close')}
        >
          <X weight="bold" className="h-4 w-4" />
        </button>

        <div className="flex items-start gap-3">
          {/* Success icon */}
          <div className="shrink-0 rounded-full bg-emerald-100 p-2 dark:bg-emerald-900/40">
            <CheckCircle
              className="h-5 w-5 text-emerald-600 dark:text-emerald-400"
              weight="fill"
            />
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0 pr-4">
            <p className="text-sm font-semibold">{t('complete.title')}</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {t('complete.description')}
            </p>

            {/* CTAs */}
            <div className="flex flex-wrap gap-2 mt-3">
              <Button
                size="sm"
                variant="ghost"
                className="h-8 gap-1.5 text-xs text-muted-foreground"
                onClick={handleRewatch}
                data-cy={ONBOARDING_SELECTORS.completeRewatch}
              >
                <ArrowsClockwise className="h-3.5 w-3.5" weight="bold" />
                {t('complete.rewatchTour')}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
