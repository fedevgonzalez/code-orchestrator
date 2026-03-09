'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { useWalkme } from '@/contents/plugins/walkme/hooks/useWalkme'
import { ONBOARDING_SELECTORS } from './selectors'
import { ArrowRight, X } from '@phosphor-icons/react'

interface Props {
  tourId: string
}

export function OnboardingResumeBanner({ tourId }: Props) {
  const [dismissed, setDismissed] = useState(false)
  const { startTour, resetTour } = useWalkme()
  const t = useTranslations('onboarding')

  if (dismissed) return null

  const handleResume = () => {
    resetTour(tourId)
    startTour(tourId)
  }

  return (
    <div
      data-cy={ONBOARDING_SELECTORS.resumeBanner}
      role="status"
      className="fixed bottom-6 left-1/2 z-50 flex -translate-x-1/2 items-center gap-3 rounded-xl border border-primary/20 bg-primary/5 px-5 py-3 shadow-lg backdrop-blur-sm"
    >
      <p className="text-sm text-foreground/80">{t('resume.bannerText')}</p>

      <button
        data-cy={ONBOARDING_SELECTORS.resumeBtn}
        onClick={handleResume}
        className="cursor-pointer inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-1.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
      >
        {t('resume.resumeButton')}
        <ArrowRight weight="bold" className="h-3.5 w-3.5" />
      </button>

      <button
        data-cy={ONBOARDING_SELECTORS.dismissBanner}
        onClick={() => setDismissed(true)}
        className="cursor-pointer rounded-md p-1 text-foreground/40 transition-colors hover:text-foreground/70"
        aria-label={t('labels.close')}
      >
        <X weight="bold" className="h-4 w-4" />
      </button>
    </div>
  )
}
