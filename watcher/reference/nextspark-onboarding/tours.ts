import type { Tour } from '@/contents/plugins/walkme/types/walkme.types'
import { TOUR_TARGETS } from './selectors'

type TranslationFn = (key: string, params?: Record<string, string>) => string

/**
 * Creates contextual tooltips for owners who completed the SetupWizard.
 * Each tooltip is a separate single-step tour triggered when the owner
 * first visits a dashboard section. Once dismissed, it never shows again
 * (persisted via localStorage notCompletedTours condition).
 */
export function createOwnerContextualTooltips(t: TranslationFn): Tour[] {
  return [
    {
      id: 'owner-tip-dashboard',
      name: 'Dashboard Overview Tip',
      trigger: { type: 'onRouteEnter', route: '/dashboard', delay: 1000 },
      priority: 10,
      conditions: { notCompletedTours: ['owner-tip-dashboard'] },
      steps: [{
        id: 'tip-dashboard',
        type: 'spotlight',
        title: t('ownerTips.dashboard.title'),
        content: t('ownerTips.dashboard.content'),
        target: TOUR_TARGETS.dashboardStats,
        position: 'bottom',
        actions: ['complete'],
      }],
    },
    {
      id: 'owner-tip-agenda',
      name: 'Agenda Tip',
      trigger: { type: 'onRouteEnter', route: '/dashboard/appointments', delay: 800 },
      priority: 11,
      conditions: { notCompletedTours: ['owner-tip-agenda'] },
      steps: [{
        id: 'tip-agenda',
        type: 'spotlight',
        title: t('ownerTips.agenda.title'),
        content: t('ownerTips.agenda.content'),
        target: TOUR_TARGETS.agendaDayView,
        position: 'bottom',
        actions: ['complete'],
      }],
    },
    {
      id: 'owner-tip-services',
      name: 'Services Tip',
      trigger: { type: 'onRouteEnter', route: '/dashboard/services', delay: 800 },
      priority: 12,
      conditions: { notCompletedTours: ['owner-tip-services'] },
      steps: [{
        id: 'tip-services',
        type: 'tooltip',
        title: t('ownerTips.services.title'),
        content: t('ownerTips.services.content'),
        target: TOUR_TARGETS.servicesCreateBtn,
        position: 'bottom',
        actions: ['complete'],
      }],
    },
    {
      id: 'owner-tip-professionals',
      name: 'Professionals Tip',
      trigger: { type: 'onRouteEnter', route: '/dashboard/professionals', delay: 800 },
      priority: 13,
      conditions: { notCompletedTours: ['owner-tip-professionals'] },
      steps: [{
        id: 'tip-professionals',
        type: 'tooltip',
        title: t('ownerTips.professionals.title'),
        content: t('ownerTips.professionals.content'),
        target: TOUR_TARGETS.professionalsCreateBtn,
        position: 'bottom',
        actions: ['complete'],
      }],
    },
    {
      id: 'owner-tip-clients',
      name: 'Clients Tip',
      trigger: { type: 'onRouteEnter', route: '/dashboard/clients', delay: 800 },
      priority: 14,
      conditions: { notCompletedTours: ['owner-tip-clients'] },
      steps: [{
        id: 'tip-clients',
        type: 'tooltip',
        title: t('ownerTips.clients.title'),
        content: t('ownerTips.clients.content'),
        target: TOUR_TARGETS.clientsCreateBtn,
        position: 'bottom',
        actions: ['complete'],
      }],
    },
    {
      id: 'owner-tip-schedules',
      name: 'Schedules Tip',
      trigger: { type: 'onRouteEnter', route: '/dashboard/schedules', delay: 800 },
      priority: 15,
      conditions: { notCompletedTours: ['owner-tip-schedules'] },
      steps: [{
        id: 'tip-schedules',
        type: 'tooltip',
        title: t('ownerTips.schedules.title'),
        content: t('ownerTips.schedules.content'),
        target: TOUR_TARGETS.schedulesProfessionalTabs,
        position: 'bottom',
        actions: ['complete'],
      }],
    },
    {
      id: 'owner-tip-business-settings',
      name: 'Business Settings Tip',
      trigger: { type: 'onRouteEnter', route: '/dashboard/business-settings', delay: 800 },
      priority: 16,
      conditions: { notCompletedTours: ['owner-tip-business-settings'] },
      steps: [{
        id: 'tip-business-settings',
        type: 'tooltip',
        title: t('ownerTips.businessSettings.title'),
        content: t('ownerTips.businessSettings.content'),
        target: TOUR_TARGETS.businessSettingsTabs,
        position: 'bottom',
        actions: ['complete'],
      }],
    },
    {
      id: 'owner-tip-team-settings',
      name: 'Team Settings Tip',
      trigger: { type: 'onRouteEnter', route: '/dashboard/settings/teams', delay: 1000 },
      priority: 17,
      conditions: { notCompletedTours: ['owner-tip-team-settings'] },
      steps: [
        {
          id: 'tip-team-settings-roles',
          type: 'spotlight',
          title: t('ownerTips.teamSettings.roles.title'),
          content: t('ownerTips.teamSettings.roles.content'),
          target: TOUR_TARGETS.teamSettingsMembersCard,
          position: 'bottom',
          actions: ['next'],
        },
        {
          id: 'tip-team-settings-invite',
          type: 'tooltip',
          title: t('ownerTips.teamSettings.invite.title'),
          content: t('ownerTips.teamSettings.invite.content'),
          target: TOUR_TARGETS.teamSettingsInviteBtn,
          position: 'bottom',
          actions: ['next', 'prev'],
        },
        {
          id: 'tip-team-settings-professional',
          type: 'spotlight',
          title: t('ownerTips.teamSettings.professional.title'),
          content: t('ownerTips.teamSettings.professional.content'),
          target: TOUR_TARGETS.teamSettingsProfNudge,
          position: 'top',
          actions: ['complete', 'prev'],
        },
      ],
    },
  ]
}

/**
 * Creates conditional data-driven tooltips.
 * These are manually triggered by components when specific data conditions
 * are met. Once dismissed (completed), they never show again — persisted
 * via WalkMe's server sync to users_metas (cross-device).
 *
 * They use `trigger: 'manual'` so WalkMe never auto-starts them.
 * The consuming component (e.g. ServicesList) calls `startTour(id)` when the
 * condition is detected and `isTourCompleted(id)` returns false.
 */
export function createConditionalDataTooltips(t: TranslationFn): Tour[] {
  return [
    {
      id: 'conditional-services-no-pro',
      name: 'Services Without Professionals Hint',
      trigger: { type: 'manual' },
      priority: 50,
      conditions: { notCompletedTours: ['conditional-services-no-pro'] },
      steps: [{
        id: 'hint-services-no-pro',
        type: 'spotlight',
        title: t('conditionalTips.servicesNoPro.title'),
        content: t('conditionalTips.servicesNoPro.content'),
        target: TOUR_TARGETS.serviceNeedsProfessional,
        position: 'bottom',
        actions: ['complete'],
      }],
    },
    {
      id: 'conditional-pros-no-services',
      name: 'Professionals Without Services Hint',
      trigger: { type: 'manual' },
      priority: 51,
      conditions: { notCompletedTours: ['conditional-pros-no-services'] },
      steps: [{
        id: 'hint-pros-no-services',
        type: 'spotlight',
        title: t('conditionalTips.prosNoServices.title'),
        content: t('conditionalTips.prosNoServices.content'),
        target: TOUR_TARGETS.professionalNeedsServices,
        position: 'bottom',
        actions: ['complete'],
      }],
    },
  ]
}

/**
 * Creates the Invited Professional tour (6 steps).
 * This tour orients professionals who were invited to join a team.
 */
export function createProfessionalTour(
  t: TranslationFn,
  userName: string,
  teamName: string
): Tour {
  return {
    id: 'kuore-professional-tour',
    name: 'Professional Orientation',
    trigger: { type: 'onEvent', event: 'onboarding:professional-start', delay: 1500 },
    priority: 1,
    conditions: { notCompletedTours: ['kuore-professional-tour'] },
    steps: [
      {
        id: 'pro-welcome',
        type: 'modal',
        title: t('professionalTour.welcome.title', { teamName }),
        content: t('professionalTour.welcome.content', { name: userName, teamName }),
        route: '/dashboard',
        actions: ['next', 'skip'],
      },
      {
        id: 'pro-agenda',
        type: 'tooltip',
        title: t('professionalTour.agenda.title'),
        content: t('professionalTour.agenda.content'),
        route: '/dashboard',
        target: TOUR_TARGETS.navAgenda,
        position: 'right',
        actions: ['next', 'prev', 'skip'],
      },
      {
        id: 'pro-day-view',
        type: 'spotlight',
        title: t('professionalTour.dayView.title'),
        content: t('professionalTour.dayView.content'),
        route: '/dashboard/appointments',
        target: TOUR_TARGETS.agendaDayView,
        position: 'bottom',
        actions: ['next', 'prev', 'skip'],
      },
      {
        id: 'pro-appointment-status',
        type: 'tooltip',
        title: t('professionalTour.appointmentStatus.title'),
        content: t('professionalTour.appointmentStatus.content'),
        route: '/dashboard/appointments',
        target: TOUR_TARGETS.agendaDayView,
        position: 'top',
        actions: ['next', 'prev', 'skip'],
      },
      {
        id: 'pro-complete-profile',
        type: 'spotlight',
        title: t('professionalTour.completeProfile.title'),
        content: t('professionalTour.completeProfile.content'),
        route: '/dashboard/settings/profile',
        target: TOUR_TARGETS.profileForm,
        position: 'top',
        actions: ['next', 'prev', 'skip'],
      },
      {
        id: 'pro-complete',
        type: 'modal',
        title: t('professionalTour.complete.title'),
        content: t('professionalTour.complete.content'),
        route: '/dashboard/appointments',
        actions: ['complete'],
      },
    ],
  }
}
