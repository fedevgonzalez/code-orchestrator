/**
 * Onboarding Selectors - data-cy attributes for onboarding components.
 *
 * Tour target selectors reference existing data-cy values from core
 * and theme components. These are the onboarding-specific selectors.
 */
export const ONBOARDING_SELECTORS = {
  provider: 'onboarding-provider',
  resumeBanner: 'onboarding-resume-banner',
  resumeBtn: 'onboarding-resume-btn',
  dismissBanner: 'onboarding-dismiss-banner',
  completeBanner: 'onboarding-complete-banner',
  completeDismiss: 'onboarding-complete-dismiss',
  completeRewatch: 'onboarding-complete-rewatch',
} as const

/**
 * Tour target selectors - referencing existing data-cy values from core/theme.
 * These are the CSS selectors WalkMe uses to anchor steps to DOM elements.
 *
 * Used by:
 * - Professional tour (multi-step guided tour)
 * - Owner contextual tooltips (single-step route-triggered tips)
 */
export const TOUR_TARGETS = {
  // Core navigation (from DASHBOARD_SELECTORS.navigation.sectionItem)
  navAgenda: '[data-cy="nav-section-item-main-agenda"]',

  // Agenda selectors (existing from AGENDA_SELECTORS)
  agendaDayView: '[data-cy="agenda-day-view"]',

  // Profile form (core selector: sel('settings.profile.form'))
  profileForm: '[data-cy="settings-profile-form"]',

  // Owner contextual tooltip targets
  dashboardStats: '[data-cy="dashboard-stats-grid"]',
  servicesCreateBtn: '[data-cy="services-add"]',
  professionalsCreateBtn: '[data-cy="professionals-add"]',
  clientsCreateBtn: '[data-cy="clients-add"]',
  schedulesProfessionalTabs: '[data-cy="schedules-professional-tabs"]',
  businessSettingsTabs: '[data-cy="business-settings-tab-list"]',

  // Conditional tooltip targets (data-driven hints)
  serviceNeedsProfessional: '[data-walkme-no-pro]',
  professionalNeedsServices: '[data-walkme-no-services]',

  // Team settings page targets
  teamSettingsMembersCard: '[data-cy="teams-settings-members-card"]',
  teamSettingsInviteBtn: '[data-cy="invite-member-button"]',
  teamSettingsRoleBadges: '[data-cy="teams-settings-role-badges-legend"]',
  teamSettingsProfNudge: '[data-cy="teams-settings-professional-nudge"]',
} as const
