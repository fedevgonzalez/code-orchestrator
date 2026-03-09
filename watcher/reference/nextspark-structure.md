# NextSpark Project Structure Reference

## Web Only (no mobile)

```
project/
├── .claude/
│   ├── agents/              # Claude Code agents (ux-ui-polisher, etc)
│   ├── skills/              # ~40+ skills (entity-system, better-auth, etc)
│   ├── commands/            # Custom slash commands
│   ├── config/              # Project config
│   ├── templates/           # Task/story/block templates
│   ├── workflows/           # Workflow definitions
│   └── _docs/               # Internal docs
├── .nextspark/
│   └── registries/          # Plugin/theme registries
├── app/
│   ├── (auth)/              # Auth pages (login, signup, forgot-password, reset-password, verify-email, accept-invite)
│   ├── (public)/            # Public pages (landing, docs, [...slug])
│   ├── (templates)/         # Layout templates for auth, dashboard, public
│   ├── dashboard/           # Main authenticated app
│   │   ├── (main)/          # Dashboard home
│   │   ├── features/        # Feature-specific pages
│   │   ├── settings/        # User settings
│   │   └── permission-denied/
│   ├── devtools/            # Dev-only tools (API tester, blocks, config, style guide, tests)
│   ├── superadmin/          # Admin panel (users, teams, subscriptions, docs)
│   ├── api/
│   │   ├── auth/            # Auth API (better-auth)
│   │   ├── health/          # Health check
│   │   ├── cron/            # Scheduled jobs
│   │   ├── v1/              # Versioned API
│   │   ├── user/            # User API
│   │   ├── internal/        # Internal endpoints
│   │   └── superadmin/      # Admin API
│   ├── 403/                 # Permission denied page
│   └── public/              # Public-facing pages
├── contents/
│   ├── plugins/             # Plugin system (AI, social-media-publisher, etc)
│   └── themes/              # Theme system (project-specific theme)
├── packages/                # Shared packages
├── scripts/                 # Build/deploy scripts
├── public/
│   ├── theme/
│   │   ├── brand/           # Logo, favicon
│   │   ├── fonts/           # Custom fonts
│   │   ├── blocks/          # Block images
│   │   └── docs/            # Doc images
│   └── uploads/             # User uploads
├── certificates/            # SSL certs (dev)
└── .github/workflows/       # CI/CD
```

## Web + Mobile (monorepo)

```
project/
├── web/                     # Same structure as Web Only above
│   ├── app/
│   ├── contents/
│   ├── .nextspark/
│   └── ...
├── mobile/                  # Expo / React Native
│   ├── app/                 # Expo Router pages
│   │   └── (app)/           # Authenticated screens
│   ├── src/
│   │   ├── api/             # API client
│   │   ├── components/      # RN components
│   │   ├── constants/
│   │   ├── entities/        # Entity types
│   │   ├── hooks/
│   │   ├── lib/
│   │   ├── providers/
│   │   ├── styles/
│   │   └── utils/
│   ├── assets/
│   │   └── animations/      # Lottie files
│   ├── android/             # Native Android
│   └── scripts/
├── shared/                  # Shared code between web + mobile
├── docs/
│   ├── brand/               # Logos, icons
│   └── flows/               # User flow diagrams
└── node_modules/            # Root deps
```

## Key NextSpark Conventions

- Auth: Uses better-auth (not NextAuth)
- Entity system: Entities defined in contents/plugins/ or app/api/v1/
- Plugins: Installed via .nextspark/registries
- Themes: Custom themes in contents/themes/
- Skills: Claude Code skills in .claude/skills/ (installed by create-nextspark-app)
- Agents: Custom agents in .claude/agents/
- DevTools: Built-in dev tools at /devtools (style guide, API tester, block preview)
- SuperAdmin: Admin panel at /superadmin
- Database: Drizzle ORM with PostgreSQL
- Permissions: Built-in permission system
- i18n: next-intl for internationalization
