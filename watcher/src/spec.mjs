/**
 * Spec pipeline — analyze spec, create phases, generate tasks.
 * Uses only 2 calls to claude -p (analyze + generate all tasks at once).
 */

import { readFileSync } from "fs";
import { callClaudePipe } from "./reviewer.mjs";
import { createPhase, createTask } from "./models.mjs";

/**
 * Load spec text from file (truncated if too long).
 */
export function loadSpec(specPath, maxChars = 8000) {
  const text = readFileSync(specPath, "utf-8");
  return text.length <= maxChars ? text : text.slice(0, maxChars) + "\n\n[... spec truncated ...]";
}

/**
 * Parse JSON from Claude's response (handles markdown fences).
 */
function extractJson(raw) {
  let s = raw;
  if (raw.includes("```json")) {
    const start = raw.indexOf("```json") + 7;
    const end = raw.indexOf("```", start);
    s = raw.slice(start, end).trim();
  } else if (raw.includes("```")) {
    const start = raw.indexOf("```") + 3;
    const end = raw.indexOf("```", start);
    s = raw.slice(start, end).trim();
  } else if (raw.includes("{")) {
    const start = raw.indexOf("{");
    const end = raw.lastIndexOf("}") + 1;
    s = raw.slice(start, end);
  } else if (raw.includes("[")) {
    const start = raw.indexOf("[");
    const end = raw.lastIndexOf("]") + 1;
    s = raw.slice(start, end);
  }
  return JSON.parse(s);
}

// ── Phase templates ──────────────────────────────────────────────────────

const PHASE_TEMPLATES = [
  // ── Core build ──
  { id: "scaffold", name: "Project Scaffolding", gateFiles: ["package.json"], gateCmds: [] },
  { id: "database", name: "Database & ORM", gateFiles: [], gateCmds: [] },
  { id: "auth", name: "Authentication (Credentials + Social OAuth)", gateFiles: [], gateCmds: [] },
  { id: "core-api", name: "Core API & Business Logic", gateFiles: [], gateCmds: [] },
  // payments inserted dynamically if needed
  { id: "frontend", name: "Frontend Pages & Components", gateFiles: [], gateCmds: ["npm run build"] },
  { id: "onboarding", name: "Onboarding & User Settings", gateFiles: [], gateCmds: ["npm run build"] },
  { id: "integration", name: "Frontend-Backend Integration", gateFiles: [], gateCmds: ["npm run build"] },
  { id: "ux-polish", name: "UX Polish (Dark Mode, Toasts, Skeletons, Error Boundaries)", gateFiles: [], gateCmds: ["npm run build"] },
  { id: "nextspark-polish", name: "NextSpark UX/UI Polish (Agent + Skills)", gateFiles: [], gateCmds: ["npm run build"] },
  // ── Content & data ──
  { id: "seed-data", name: "Seed Data & Demo Content", gateFiles: [], gateCmds: [] },
  { id: "landing", name: "Landing Page & Marketing Copy", gateFiles: [], gateCmds: ["npm run build"] },
  // ── Production readiness ──
  { id: "seo", name: "SEO, Meta, Open Graph & Favicon/PWA", gateFiles: ["public/robots.txt"], gateCmds: ["npm run build"] },
  { id: "legal", name: "Legal Pages, GDPR & Data Export", gateFiles: [], gateCmds: ["npm run build"] },
  { id: "email", name: "Email Templates & Cron Jobs", gateFiles: [], gateCmds: ["npm run build"] },
  { id: "analytics", name: "Analytics, Error Monitoring & Logging", gateFiles: [], gateCmds: ["npm run build"] },
  { id: "security", name: "Security Hardening", gateFiles: [], gateCmds: ["npm run build"] },
  { id: "support", name: "Help Center, FAQ & Support Widget", gateFiles: [], gateCmds: ["npm run build"] },
  // ── Quality assurance ──
  { id: "testing", name: "Testing (Unit + E2E)", gateFiles: [], gateCmds: [] },
  { id: "screenshots", name: "Screenshots & Visual QA", gateFiles: [], gateCmds: [] },
  { id: "performance", name: "Performance Audit (Lighthouse)", gateFiles: [], gateCmds: [] },
  // ── Deploy & launch ──
  { id: "cicd", name: "CI/CD Pipeline (GitHub Actions)", gateFiles: [], gateCmds: [] },
  { id: "deploy", name: "Deployment Config & Env Docs", gateFiles: [], gateCmds: [] },
  { id: "launch-assets", name: "Launch Assets & Go-to-Market", gateFiles: [], gateCmds: [] },
];

/**
 * Step 1: Analyze spec and generate complete plan in ONE call.
 */
function analyzeAndPlan(specText, cwd) {
  const prompt = `You are a senior software architect. Analyze this spec and generate a COMPLETE development plan.

SPEC:
${specText.slice(0, 6000)}

IMPORTANT CONTEXT:
- Projects may use "nextspark" (npx create-nextspark-app) as a starter template. If the spec mentions nextspark, set scaffoldCommand to "npx create-nextspark-app".
- If the spec does NOT mention a specific scaffold tool, use "npx create-next-app@latest".
- ALWAYS use PostgreSQL as the database (never SQLite). The database is hosted at postgres.lab. Connection string format: DATABASE_URL="postgresql://dbuser:dbpass_SecurePassword123@postgres.lab:5432/{projectName}?sslmode=disable". Use Drizzle ORM with postgres adapter (drizzle-orm + postgres or @neondatabase/serverless).
- The orchestrator will handle: seed data, landing page, SEO, legal pages, email templates, analytics, security, screenshots, Lighthouse audit, and launch assets automatically. Focus the plan on the CORE business logic.

You must return ONLY valid JSON (no markdown, no explanation) with this exact structure:
{
  "projectName": "name",
  "techStack": {"framework": "...", "database": "...", "orm": "...", "auth": "...", "payments": "..."},
  "scaffoldCommand": "npx create-nextspark-app OR npx create-next-app@latest",
  "entities": ["Entity1", "Entity2"],
  "features": [{"name": "Feature", "priority": "high", "complexity": "medium"}],
  "hasPayments": true,
  "hasAuth": true,
  "deployment": "docker"
}

IMPORTANT: Respond with ONLY the JSON object, nothing else.`;

  console.log("[SPEC] Step 1/2: Analyzing spec...");
  const raw = callClaudePipe(prompt, cwd);

  try {
    const analysis = extractJson(raw);
    console.log(`[SPEC] Project: ${analysis.projectName}, entities: ${analysis.entities?.length}, features: ${analysis.features?.length}`);
    return analysis;
  } catch (e) {
    console.error(`[SPEC] Failed to parse analysis: ${e.message}`);
    return { projectName: "project", techStack: {}, entities: [], features: [], hasAuth: true, hasPayments: false };
  }
}

/**
 * Step 2: Create phases and generate ALL tasks in ONE call.
 */
function createPhasesWithTasks(analysis, specText, cwd) {
  const hasAuth = analysis.hasAuth !== false;
  const hasPayments = analysis.hasPayments;
  const projectName = (analysis.projectName || "project").toLowerCase().replace(/[^a-z0-9]/g, "_");
  const isNextSpark = analysis.scaffoldCommand?.includes("nextspark") ||
    specText.toLowerCase().includes("nextspark");

  // Build phase list — database always included (PostgreSQL at postgres.lab)
  const phases = [];
  for (const tmpl of PHASE_TEMPLATES) {
    if (tmpl.id === "auth" && !hasAuth) continue;
    // Skip nextspark-polish if not using nextspark
    if (tmpl.id === "nextspark-polish" && !isNextSpark) continue;
    phases.push(createPhase({
      id: tmpl.id,
      name: tmpl.name,
      gate: { fileChecks: [...tmpl.gateFiles], commandChecks: [...tmpl.gateCmds] },
    }));
  }

  if (hasPayments) {
    const apiIdx = phases.findIndex((p) => p.id === "core-api");
    phases.splice(apiIdx + 1, 0,
      createPhase({ id: "payments", name: "Payment Integration", gate: { fileChecks: [], commandChecks: [] } })
    );
  }

  const phaseList = phases.map((p) => `- ${p.id}: ${p.name}`).join("\n");

  console.log(`[SPEC] Phases: ${phases.map((p) => p.id).join(", ")}`);
  console.log("[SPEC] Step 2/2: Generating tasks for ALL phases (single call)...");

  const prompt = `You are a senior software architect. Generate development tasks for ALL phases of this project.

SPEC (summary):
${specText.slice(0, 4000)}

PROJECT: ${analysis.projectName}
TECH STACK: ${JSON.stringify(analysis.techStack)}
ENTITIES: ${(analysis.entities || []).join(", ")}

PHASES:
${phaseList}

Generate 3-6 tasks PER PHASE. Each task prompt must be VERY specific: file paths, function names, exact requirements.
Include validation: "check file: path1, path2" or "run: npm test" or "run: npm run build"

DATABASE CONFIG — use this for ALL database tasks:
- PostgreSQL hosted at postgres.lab
- DATABASE_URL="postgresql://dbuser:dbpass_SecurePassword123@postgres.lab:5432/${projectName}?sslmode=disable"
- ORM: Drizzle ORM with drizzle-orm + postgres (pg) adapter
- The database "${projectName}" will be created automatically. The scaffold task should include creating the DB via: psql -h postgres.lab -U dbuser -c "CREATE DATABASE ${projectName};" (password: dbpass_SecurePassword123)
- Add DATABASE_URL to .env and .env.example

PHASE-SPECIFIC INSTRUCTIONS — follow these EXACTLY:

NEXTSPARK STRUCTURE (use this if project uses nextspark):
NextSpark projects have a SPECIFIC directory structure. DO NOT use src/app. Use these paths:
- Auth pages: app/(auth)/login, app/(auth)/signup, app/(auth)/forgot-password, app/(auth)/reset-password, app/(auth)/verify-email
- Public pages: app/(public)/ — landing page, docs, etc
- Dashboard: app/dashboard/ — main authenticated app
- Dashboard settings: app/dashboard/settings/
- API routes: app/api/ — includes app/api/auth, app/api/health, app/api/v1/, app/api/cron/
- Templates: app/(templates)/ — layout templates
- Admin: app/superadmin/ — admin panel with users, teams, subscriptions
- DevTools: app/devtools/ — dev-only tools (api tester, style guide, etc)
- Plugins: contents/plugins/ — plugin system (AI plugin, etc)
- Themes: contents/themes/ — theme system
- Public assets: public/theme/brand/, public/theme/fonts/
- Skills: .claude/skills/ — Claude Code skills (auto-installed by create-nextspark-app)
- Agents: .claude/agents/ — Claude Code agents
For web+mobile (monorepo): web/ contains the Next.js app, mobile/ contains Expo/React Native, shared/ has shared code.
If NOT using nextspark, use standard Next.js structure with src/app/.

NEXTSPARK PLUGINS — ALWAYS install these when using nextspark:
Available plugins are at G:/GitHub/nextspark/repo/plugins/. Install by copying to contents/plugins/ and registering in theme config.

1. **walkme** (ALWAYS install): Guided tours and onboarding system. Install: copy G:/GitHub/nextspark/repo/plugins/walkme/ to contents/plugins/walkme/, register in theme config, then create tours for:
   - "getting-started" tour: welcome modal → sidebar tooltip → main feature spotlight → completion modal
   - Contextual tooltips on first visit to each major section (dashboard, settings, etc)
   - Onboarding checklist that tracks completion (e.g., "Set up profile", "Add first item", etc)
   Steps: pnpm add @nextsparkjs/plugin-walkme OR copy manually, add 'walkme' to themeConfig.plugins, run "node core/scripts/build/registry.mjs", define tours in app/dashboard/ pages.

2. **ai** (install if spec mentions AI features, smart suggestions, content generation, or automation): Multi-model AI plugin with OpenAI/Anthropic/Ollama support. Install: copy G:/GitHub/nextspark/repo/plugins/ai/ to contents/plugins/ai/, configure .env with API keys, register in theme config.

3. **amplitude** (install if spec mentions analytics — use alongside PostHog): Analytics plugin.

4. **social-media-publisher** (install if spec mentions social features or content publishing): Social media integration.

5. **langchain** (install if spec mentions advanced AI workflows, RAG, or embeddings): LangChain integration.

**scaffold**: Initialize the project. If using nextspark, run "npx create-nextspark-app" — this AUTO-GENERATES: auth pages (login, signup, forgot-password, reset-password, verify-email), dashboard scaffold, superadmin panel, devtools, plugin system, theme system, better-auth config, Drizzle ORM setup, permissions system, i18n, .claude/skills, .claude/agents, and all the base structure. DO NOT recreate any of these — they already exist after scaffold.

CRITICAL — .env configuration (THIS WILL BE VALIDATED AUTOMATICALLY):
After scaffolding, you MUST update the .env file with these EXACT values:
1. DATABASE_URL="postgresql://dbuser:dbpass_SecurePassword123@postgres.lab:5432/${projectName}?sslmode=disable"
2. BETTER_AUTH_SECRET — generate a real secret by running: node -e "console.log(require('crypto').randomBytes(32).toString('base64'))" and paste the output as the value
3. Do NOT leave any placeholder values like "your-secret-key-here", "user:password", "sk_test_...", etc.
4. Do NOT use localhost, neon.tech, supabase, or any other database provider — ONLY postgres.lab
The .env will be automatically validated after this phase. If it has placeholders or wrong credentials, the phase will FAIL and you will be asked to fix it.

Also install drizzle-orm and pg. Create the database on postgres.lab by running: PGPASSWORD=dbpass_SecurePassword123 psql -h postgres.lab -U dbuser -c "CREATE DATABASE ${projectName};" 2>/dev/null || echo "DB may already exist"

**database**: If using nextspark, Drizzle ORM is already configured — only CREATE the business-specific entity schemas (e.g., cars, reservations, payments) following the nextspark entity-system skill conventions. Generate migrations and push to postgres.lab with "npx drizzle-kit push". Verify tables exist. If NOT using nextspark, set up Drizzle from scratch with ALL schemas.

**auth**: If using nextspark, auth pages and better-auth are ALREADY scaffolded — only ADD Google OAuth provider config to the existing better-auth setup, verify middleware is protecting dashboard routes, and ensure the auth flow works end-to-end. If NOT using nextspark, create from scratch: login page, register page, forgot password page, NextAuth/better-auth config with Google provider, middleware for protected routes, session provider wrapper.

**onboarding**: If using nextspark, use the walkme plugin to build a COMPLETE onboarding system. Follow the reference implementation pattern from the orchestrator's reference/nextspark-onboarding/ directory (copied from a production kuore project). The pattern has 3 layers:

Layer 1 — Guided tour (multi-step):
Create a "getting-started" tour: welcome modal → navigate to main feature with tooltip → spotlight key UI element → prompt first action → completion celebration modal. Use trigger: onEvent with 'onboarding:start'. Include skip buttons on all steps.

Layer 2 — Contextual route tooltips (single-step tours):
For EACH dashboard section, create a single-step tour with trigger: onRouteEnter. When a user visits /dashboard/[section] for the first time, show a spotlight or tooltip explaining that section. Use conditions: { notCompletedTours: ['tip-name'] } so it only shows once. Each tooltip has priority ordering (10, 11, 12...) and 800ms delay.

Layer 3 — Conditional data-driven tooltips:
Create manual-trigger tours that components activate when specific data conditions are met (e.g., "You have services but no professionals assigned" or "Your list is empty — create your first item"). Use trigger: { type: 'manual' } and call startTour(id) from the component.

Implementation files to create in contents/themes/{theme}/onboarding/:
- tours.ts — All tour definitions (functions that take a translation fn, return Tour[])
- selectors.ts — TOUR_TARGETS object mapping semantic names to data-cy CSS selectors
- OnboardingProvider.tsx — Wraps WalkmeProvider, registers all tours
- OnboardingWrapper.tsx — Layout wrapper that includes provider + resume banner
- OnboardingCompleteBanner.tsx — Celebration banner after tour completion
- OnboardingResumeBanner.tsx — "Continue where you left off" banner
- index.ts — Exports

Also create: user settings page, /settings/billing page.
If NOT using nextspark, build a simple onboarding wizard component (3-5 steps) with empty states and CTAs.

**ux-polish**: Add across the entire app: dark mode toggle with system preference detection (next-themes), toast notifications (sonner or react-hot-toast) for all CRUD operations, loading skeletons for data-heavy pages, error boundaries with friendly fallback UI, breadcrumbs on inner pages, mobile responsive navigation (hamburger menu), keyboard shortcuts for power users (Cmd+K search).

**nextspark-polish**: ONLY IF the project uses nextspark/create-nextspark-app. This phase polishes ALL default and auth screens that end users see. Tasks:
1. Install the ux-ui-polisher agent skills: copy the agent definition from the nextspark template and install the 4 required skills (frontend-design, premium-ui-design, premium-ux-patterns, shadcn-components) using the Claude Code /install-skill command or by copying skill folders.
2. Polish ALL auth/public screens: /login, /register, /sign-up, /forgot-password, /reset-password, /verify-email — apply OKLCH colors, 8pt grid spacing, proper typography hierarchy, dark mode support, mobile-responsive layout, 44px touch targets.
3. Polish ALL default NextSpark screens that a member/user sees: dashboard, settings, profile, billing — apply premium UI patterns, loading skeletons, empty states with CTAs, toast notifications.
4. Check if any NextSpark plugins should be installed (AI features, WalkMe-style onboarding, etc.) based on the spec requirements. If the spec mentions AI features, install the AI plugin. If onboarding/walkthrough is needed, install the walkme/tour plugin. Configure installed plugins properly.
5. Run a full design regression: verify consistent spacing, color tokens, shadow/elevation levels, and animation coherence across ALL screens.
If the project does NOT use nextspark, SKIP this phase entirely (generate zero tasks).

**seed-data**: Create a seed script (src/lib/seed.ts) with realistic demo data — real-sounding names (use faker or hardcoded realistic data), proper emails, descriptions, prices. NOT "John Doe" or "test@test.com". Include 15-30 records per entity with varied statuses and dates spanning the last 3 months. Add "npm run seed" to package.json. Seed must be idempotent (safe to run multiple times).

**landing**: Build a conversion-focused marketing landing page at "/" with: hero section (headline + subheadline + CTA + hero image/illustration), trusted-by/social proof logos, features grid (6-8 features with icons and descriptions), how-it-works section (3 steps), pricing table with monthly/annual toggle (if applicable), testimonials section (3 quotes), FAQ accordion (6-8 questions), final CTA section, footer with links. Use the project's design system. Include smooth scroll and subtle animations.

**seo**: Add Next.js metadata API to ALL pages (title, description, og:image). Create dynamic sitemap.xml via next-sitemap (or route handler). Add robots.txt. Generate a default og:image template. Add JSON-LD structured data (Organization, WebApplication) to the landing page. Create a favicon set (favicon.ico, apple-touch-icon, manifest.json for PWA).

**legal**: Create /terms and /privacy pages with professional, comprehensive legal text. Add cookie consent banner (with accept/reject/customize). Implement GDPR functional features: data export endpoint (GET /api/me/export — returns user's data as JSON), account deletion flow (/settings/danger-zone with confirmation), consent management stored in DB.

**email**: Create email templates using React Email or similar: welcome email (after signup), password reset email, payment receipt/invoice, weekly activity digest, subscription expiration warning (7 days before). Store in src/emails/. Add a preview route at /api/email-preview (dev only). Create an email sending utility (src/lib/email.ts) with Resend or Nodemailer.

**analytics**: Integrate PostHog (preferred) or Plausible. Add script to root layout. Track custom events: page_view, sign_up, login, feature_used, purchase, subscription_started, subscription_cancelled. Add event helper (src/lib/analytics.ts). Environment variable: NEXT_PUBLIC_POSTHOG_KEY. Also integrate Sentry for error monitoring: install @sentry/nextjs, configure sentry.client.config.ts and sentry.server.config.ts, add to next.config.js.

**security**: Rate limiting on auth routes and API (upstash/ratelimit or custom in-memory). Security headers via middleware or next.config.js: Content-Security-Policy, Strict-Transport-Security, X-Frame-Options, X-Content-Type-Options, Referrer-Policy. Input validation on ALL API routes (zod schemas). CORS configuration. Sanitize user-generated content. API key authentication for external integrations if applicable.

**support**: Create /help or /faq page with searchable FAQ (accordion). Add a support widget script (Crisp or custom floating button). Create /contact page with contact form (sends email). Add an in-app feedback button ("Send Feedback") that posts to an API route. Create a /changelog page that renders from a markdown file.

**screenshots**: Create a Playwright script at scripts/screenshots.ts that: starts the dev server, runs the seed script first, then captures EVERY page in the app. Save to .screenshots/ with names like: 01-landing.png, 02-login.png, 03-dashboard.png, etc. Capture desktop (1280x720) AND mobile (375x812). Include logged-in states (create a test user, login via API, capture authenticated pages). Create an index.html gallery in .screenshots/ that displays all captures.

**performance**: Create a Lighthouse CI script at scripts/lighthouse.ts. Run on: landing page, login, dashboard (with auth cookie). Save HTML reports to .lighthouse/. Log scores to console. Target: Performance > 80, Accessibility > 90, Best Practices > 90, SEO > 90. If scores are below target, create a .lighthouse/improvements.md with specific suggestions.

**cicd**: Create .github/workflows/ci.yml: on push/PR to main, run lint, type-check, build, unit tests, E2E tests. Create .github/workflows/deploy.yml: on merge to main, deploy to Vercel (or Railway). Add status badges to README. Create .env.example with ALL required env vars documented with descriptions.

**deploy**: Create Dockerfile (multi-stage: build + production). Create docker-compose.yml for local dev. Create vercel.json if using Vercel. Document ALL environment variables in .env.example with comments. Create a DEPLOYMENT.md with step-by-step instructions for: Vercel, Railway, Docker self-hosted.

Also create a SETUP-GUIDE.md in the project root — this is the MOST IMPORTANT file for the human developer. It must contain:
1. **Quick Start (5 min)**: How to run locally with just SQLite, no external services
2. **External Services Setup**: Step-by-step for EACH service with exact URLs to visit:
   - Google OAuth: Go to console.cloud.google.com → Create project → APIs & Services → Credentials → OAuth 2.0 → Set redirect URI to http://localhost:3000/api/auth/callback/google → Copy Client ID and Secret → Paste in .env as GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET
   - Stripe: Go to dashboard.stripe.com → Developers → API Keys → Copy pk_test and sk_test → Create webhook endpoint → Copy webhook secret → Paste in .env
   - Email (Resend): Go to resend.com → Sign up → Get API key → Paste as RESEND_API_KEY in .env
   - Analytics (PostHog): Go to posthog.com → Sign up → Get project API key → Paste as NEXT_PUBLIC_POSTHOG_KEY in .env
   - Error Monitoring (Sentry): Go to sentry.io → Create project → Get DSN → Paste as SENTRY_DSN in .env
   - Database (production): Options: Turso (turso.tech), PlanetScale, Supabase — get connection URL → Paste as DATABASE_URL in .env
3. **Deploy to Production**: One-command deploy with "vercel --prod" or "railway up"
4. **Post-Deploy Checklist**: Verify OAuth redirects, Stripe webhooks, email delivery, analytics tracking
5. **Estimated Total Setup Time**: ~30 minutes from code to live SaaS

**launch-assets**: Generate ALL of these files in docs/launch/:
- product-hunt.md — Ready-to-post PH launch: tagline (60 chars max), description (260 chars max), 3 topics, first comment text, maker's comment, gallery image descriptions.
- twitter-thread.md — 5-7 tweet thread: hook tweet, problem tweet, solution tweet, 2-3 feature tweets, CTA tweet. Include emoji and formatting.
- hacker-news.md — "Show HN" post with title and body.
- linkedin-post.md — Professional launch announcement.
- reddit-post.md — Post for relevant subreddits (r/SaaS, r/webdev, r/startups).
- indie-hackers.md — Post for Indie Hackers.
- readme-launch.md — Polished README with: badges, hero screenshot, features table, tech stack, quick start, env vars, deployment, contributing guide.
- LAUNCH-CHECKLIST.md — Detailed checklist: pre-launch (7 days before), launch day (hour by hour), post-launch (week 1, month 1).
- changelog.md — v1.0.0 with all features.
- roadmap.md — Product roadmap divided into: MVP (what's built), v1.1 (quick wins for month 1), v1.5 (medium-term 3 months), v2.0 (long-term vision 6+ months). Include feature descriptions and priorities.

IMPORTANT: Respond with ONLY valid JSON (no markdown, no explanation). Use this exact structure:
{
  "scaffold": [
    {"id": "scaffold-1", "prompt": "Detailed prompt...", "depends_on": null, "validate": "check file: package.json"}
  ],
  "database": [
    {"id": "database-1", "prompt": "Detailed prompt...", "depends_on": null, "validate": "run: npm run build"}
  ]
}

Keys must match these phase IDs exactly: ${phases.map((p) => p.id).join(", ")}
Respond with ONLY the JSON object.`;

  const raw = callClaudePipe(prompt, cwd);

  try {
    const allTasks = extractJson(raw);

    for (const phase of phases) {
      const phaseTasks = allTasks[phase.id];
      if (Array.isArray(phaseTasks) && phaseTasks.length > 0) {
        phase.tasks = phaseTasks.map((t) => createTask({ ...t, phaseId: phase.id }));
        console.log(`[SPEC] ${phase.id}: ${phase.tasks.length} tasks`);
      } else {
        // Fallback: one generic task
        phase.tasks = [createTask({
          id: `${phase.id}-1`,
          prompt: `Complete the '${phase.name}' phase of the project.`,
          phaseId: phase.id,
        })];
        console.log(`[SPEC] ${phase.id}: 1 task (fallback)`);
      }
    }
  } catch (e) {
    console.error(`[SPEC] Failed to parse tasks: ${e.message}`);
    // Fallback: one task per phase
    for (const phase of phases) {
      phase.tasks = [createTask({
        id: `${phase.id}-1`,
        prompt: `Complete the '${phase.name}' phase of the project.`,
        phaseId: phase.id,
      })];
    }
  }

  return phases;
}

/**
 * Full pipeline: spec → analysis → phases with tasks.
 * Only 2 calls to claude -p total.
 */
export function buildPlanFromSpec(specPath, cwd) {
  const specText = loadSpec(specPath);

  // Step 1: Analyze
  const analysis = analyzeAndPlan(specText, cwd);

  // Step 2: Create phases + generate ALL tasks in one call
  const phases = createPhasesWithTasks(analysis, specText, cwd);

  const totalTasks = phases.reduce((sum, p) => sum + p.tasks.length, 0);
  console.log(`[SPEC] Plan ready: ${phases.length} phases, ${totalTasks} tasks`);

  return { phases, specText, analysis };
}
