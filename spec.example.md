# TaskFlow — Project Management SaaS

## Overview
A modern project management SaaS application where teams can manage projects,
tasks, and collaborate in real-time.

## Tech Stack
- **Frontend**: Next.js 15, TypeScript, Tailwind CSS, shadcn/ui
- **Backend**: Next.js API Routes (App Router)
- **Database**: PostgreSQL with Prisma ORM
- **Auth**: NextAuth.js with credentials + Google OAuth
- **Payments**: Stripe (subscription-based)
- **Deployment**: Docker + docker-compose

## Roles & Permissions

### Owner (account creator)
- Full access to everything
- Manage billing and subscription
- Invite/remove team members
- Delete projects
- Manage organization settings

### Admin
- Create/edit/delete projects
- Manage team members (invite/remove, but cannot remove owner)
- View billing info (cannot modify)
- All member permissions

### Member
- View assigned projects
- Create/edit/complete tasks within assigned projects
- Comment on tasks
- Upload attachments to tasks
- View team members list

### Client (external, read-only)
- View specific projects shared with them
- Comment on tasks (comments marked as "client feedback")
- Cannot see internal comments or billing
- Cannot modify tasks

## Features

### Authentication
- Email/password registration and login
- Google OAuth
- Password reset via email
- Session management with JWT

### Organization
- Multi-tenant: each organization has its own data
- Organization settings (name, logo, timezone)
- Custom subdomain or slug (/org/my-company)

### Projects
- CRUD operations
- Project status (active, archived, completed)
- Project description with rich text
- Assign team members to projects
- Share projects with clients (generates invite link)

### Tasks
- CRUD within projects
- Task fields: title, description, status, priority, assignee, due date, tags
- Status workflow: todo → in_progress → review → done
- Priority levels: low, medium, high, urgent
- Drag-and-drop Kanban board view
- List view with sorting/filtering
- Task comments (internal + client-visible)
- File attachments (store in local filesystem or S3)

### Billing (Stripe)
- Free tier: 1 project, 3 members, 50 tasks
- Pro tier ($15/mo): unlimited projects, 10 members, unlimited tasks
- Business tier ($45/mo): unlimited everything, client portal, API access
- Stripe Checkout for subscription
- Stripe Customer Portal for managing subscription
- Webhook handling for payment events

### Dashboard
- Overview: active projects count, pending tasks, upcoming deadlines
- Activity feed: recent actions across the organization
- My tasks: personal task list with due dates

## API Endpoints (all under /api)
- POST /api/auth/register
- POST /api/auth/login
- GET /api/auth/session
- GET/POST /api/projects
- GET/PUT/DELETE /api/projects/[id]
- GET/POST /api/projects/[id]/tasks
- GET/PUT/DELETE /api/tasks/[id]
- POST /api/tasks/[id]/comments
- GET/POST /api/organizations
- PUT /api/organizations/[id]
- POST /api/billing/checkout
- POST /api/billing/portal
- POST /api/webhooks/stripe

## Database Schema (key models)
- User (id, email, passwordHash, name, avatar, role)
- Organization (id, name, slug, logo, stripeCustomerId, plan)
- Membership (userId, organizationId, role)
- Project (id, name, description, status, organizationId)
- ProjectMember (projectId, userId)
- Task (id, title, description, status, priority, dueDate, projectId, assigneeId)
- Comment (id, content, taskId, userId, isClientVisible)
- Attachment (id, filename, url, taskId, uploadedById)

## Non-Functional Requirements
- All pages must be responsive (mobile-first)
- Loading states and error handling on all pages
- Input validation on both client and server
- Rate limiting on auth endpoints
- CSRF protection
- Environment variables for all secrets (.env.example provided)
- Docker and docker-compose for local development
- Seed script for development data
