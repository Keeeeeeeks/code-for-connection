# Admin Portal — Implementation Tickets

**Date:** 2026-03-07 (updated: comprehensive rewrite — all spec features now have tickets)
**Branch:** `jic`
**Spec:** `docs/plans/2026-03-07-admin-portal-design.md`

---

## How to Read This Document

Each ticket is a **full-stack feature slice**. The person who picks up a ticket owns the entire vertical: schema changes (if any), backend endpoints, frontend UI, and tests.

- **Priority**: P0 (must ship), P1 (should ship), P2 (nice to have), P3 (deferred — optional scope)
- **Wireframe ref**: ASCII wireframe file in `docs/mockups/`
- **Spec ref**: section of the design spec

**17 tickets total** covering all 23 screens, ~60 endpoints, 7 new data models, 57 user journeys, and all cross-cutting concerns from the spec.

---

## Frontend Stack & Setup

### UI Library: shadcn/ui

All admin portal frontend work uses **[shadcn/ui](https://ui.shadcn.com/)** — a component library built on Radix UI + Tailwind CSS. Components are copied into the project (not installed as a dependency), so they're fully customizable.

shadcn/ui is officially compatible with Vite. The existing codebase already has Tailwind and the `@` path alias configured.

### One-Time Setup (before starting any ticket)

```bash
# 1. Install the Tailwind Vite plugin (if not already present)
npm install tailwindcss @tailwindcss/vite

# 2. Update vite.config.ts to include the Tailwind plugin:
#    import tailwindcss from "@tailwindcss/vite"
#    plugins: [react(), tailwindcss()]

# 3. Initialize shadcn in the web app
cd apps/web
npx shadcn@latest init
#    Style: Default
#    Base color: Slate (matches existing gray-900 sidebar)
#    CSS variables: Yes

# 4. Components will install to: apps/web/src/components/ui/
#    Import pattern: import { Button } from "@/components/ui/button"
```

### Shared Components Used Across Tickets

These should be installed once and reused:

```bash
# Install all components needed across tickets
npx shadcn@latest add button dialog textarea badge input select label \
  popover calendar table tabs card alert progress separator tooltip sonner \
  dropdown-menu switch checkbox scroll-area sheet avatar command
```

| Component | From | Used For |
|-----------|------|----------|
| `Button` | shadcn | All action buttons — primary, destructive, outline, ghost variants |
| `Dialog` | shadcn (Radix) | All modals — confirmation dialogs, edit forms, detail panels |
| `Badge` | shadcn | Status indicators — active/released/deactivated, severity levels |
| `Input` | shadcn | Text fields — phone, email, search |
| `Label` | shadcn | Form field labels |
| `Textarea` | shadcn | Multi-line text — reason fields, notes |
| `Select` | shadcn (Radix) | Dropdowns — relationship type, filters |
| `Table` | shadcn | Data tables — resident lists, call history, queues |
| `Tabs` | shadcn (Radix) | Tab navigation — Pending/Approved/Denied, Active/History |
| `Card` | shadcn | Content containers — stat cards, info panels |
| `Popover` + `Calendar` | shadcn (Radix + react-day-picker) | Date pickers — release date, date range filters |
| `Alert` | shadcn | Warning/info banners — PIN reset warning, consequences text |
| `Progress` | shadcn (Radix) | Progress bars — import progress, capacity bars |
| `Separator` | shadcn (Radix) | Visual dividers between sections |
| `Tooltip` | shadcn (Radix) | Hover hints — disabled button explanations |
| `Sonner` | shadcn (sonner) | Toast notifications — success/error feedback after actions |
| `DropdownMenu` | shadcn (Radix) | Facility selector, admin profile menu, action menus |
| `Switch` | shadcn (Radix) | Permission toggles, active/inactive toggles |
| `Checkbox` | shadcn (Radix) | Multi-select in tables, bulk actions |
| `ScrollArea` | shadcn (Radix) | Scrollable panels — conversation threads, timeline views |
| `Sheet` | shadcn (Radix) | Slideout detail panels — contact detail, call detail |
| `Avatar` | shadcn (Radix) | Admin user avatars in audit log, permissions |
| `Command` | shadcn (Radix) | Global search input with typeahead |

### Icon Library: Lucide React

shadcn uses **[lucide-react](https://lucide.dev/)** for icons (installed automatically with shadcn init).

```tsx
import { RefreshCw, Shield, AlertTriangle, Copy, Upload, Loader2, Search, Phone, Video, MessageSquare, Users, Home, BarChart3, ScrollText, Settings, Bell, ChevronDown, Eye, Ban, Check, X, Pencil, Trash2, ArrowRightLeft, FileText, Download, Filter, Clock, Calendar as CalendarIcon, MapPin, UserPlus, UserMinus, ShieldAlert, ExternalLink, MoreHorizontal, Activity } from "lucide-react"
```

### Note on Existing `@openconnect/ui` Package

The shared `packages/ui/` package (Card, Button, Modal, etc.) is used by other guilds. **Do not modify it.** Admin portal screens should use shadcn components instead. If a page currently imports from `@openconnect/ui`, replace those imports with shadcn equivalents when you touch that file.

---

## TICKET-00: Foundation — Schema, Routing, Layout, Shared Infrastructure

**Priority:** P0 — all other tickets depend on this
**Schema changes:** 7 new models, 5 existing model modifications, 12 new enums
**Spec ref:** Sections 2 (Architecture), 3 (Navigation), 4 (Data Model), 5 (RBAC), 9 (Cross-Cutting)

### What this ticket does

Sets up the entire foundation: new Prisma models + migrations, admin sub-router with all routes, expanded sidebar navigation, facility scoping middleware, audit logging helper, entity history helper, and shared UI components/hooks used across all other tickets.

### A. Schema — New Models

Run migration after adding all models: `npx prisma migrate dev --name admin-portal-foundation`

#### Visitor
```prisma
model Visitor {
  id                     String                @id @default(uuid())
  firstName              String                @map("first_name")
  lastName               String                @map("last_name")
  dateOfBirth            DateTime              @map("date_of_birth")
  email                  String?
  phone                  String?
  governmentIdUrl        String?               @map("government_id_url")
  organizationName       String?               @map("organization_name")
  visitorType            VisitorType
  backgroundCheckStatus  BackgroundCheckStatus @default(pending)  @map("background_check_status")
  backgroundCheckDate    DateTime?             @map("background_check_date")
  isActive               Boolean               @default(true) @map("is_active")
  createdAt              DateTime              @default(now()) @map("created_at")

  residentLinks          VisitorResident[]

  @@map("visitors")
}

enum VisitorType {
  family
  friend
  attorney
  clergy
  social_worker
  other
}

enum BackgroundCheckStatus {
  pending
  cleared
  flagged
  denied
}
```

#### VisitorResident (join table)
```prisma
model VisitorResident {
  id                     String        @id @default(uuid())
  visitorId              String        @map("visitor_id")
  incarceratedPersonId   String        @map("incarcerated_person_id")
  relationship           String
  status                 ContactStatus @default(pending)
  visitRestrictions      String?       @map("visit_restrictions")
  maxVisitsPerMonth      Int?          @map("max_visits_per_month")
  approvedBy             String?       @map("approved_by")
  reviewedAt             DateTime?     @map("reviewed_at")
  createdAt              DateTime      @default(now()) @map("created_at")

  visitor              Visitor              @relation(fields: [visitorId], references: [id])
  incarceratedPerson   IncarceratedPerson   @relation(fields: [incarceratedPersonId], references: [id])
  reviewer             AdminUser?           @relation("VisitorReviewedByAdmin", fields: [approvedBy], references: [id])

  @@unique([visitorId, incarceratedPersonId])
  @@map("visitor_residents")
}
```

#### AuditLog
```prisma
model AuditLog {
  id            String      @id @default(uuid())
  adminUserId   String      @map("admin_user_id")
  action        AuditAction
  entityType    String      @map("entity_type")
  entityId      String      @map("entity_id")
  details       Json?
  ipAddress     String?     @map("ip_address")
  createdAt     DateTime    @default(now()) @map("created_at")

  adminUser     AdminUser   @relation(fields: [adminUserId], references: [id])

  @@index([entityType, entityId])
  @@index([adminUserId])
  @@index([createdAt])
  @@map("audit_logs")
}

enum AuditAction {
  contact_approved
  contact_denied
  contact_removed
  contact_edited
  contact_attorney_flagged
  call_terminated
  video_approved
  video_denied
  video_terminated
  message_approved
  message_blocked
  conversation_blocked
  conversation_unblocked
  visitor_approved
  visitor_denied
  visitor_suspended
  visitor_reactivated
  visitor_linked
  visitor_unlinked
  resident_status_changed
  resident_deactivated
  resident_released
  resident_risk_updated
  resident_transferred
  pin_reset
  housing_changed
  setting_changed
  number_blocked
  number_unblocked
  keyword_alert_created
  keyword_alert_updated
  keyword_alert_deactivated
  permission_changed
  flagged_content_reviewed
  flagged_content_escalated
  flagged_content_dismissed
  flagged_content_manual
  bulk_import
}
```

#### EntityHistory
```prisma
model EntityHistory {
  id            String   @id @default(uuid())
  entityType    String   @map("entity_type")
  entityId      String   @map("entity_id")
  fieldName     String   @map("field_name")
  oldValue      String?  @map("old_value")
  newValue      String?  @map("new_value")
  changedBy     String   @map("changed_by")
  changedAt     DateTime @default(now()) @map("changed_at")

  admin         AdminUser @relation("EntityChangedByAdmin", fields: [changedBy], references: [id])

  @@index([entityType, entityId])
  @@index([changedAt])
  @@map("entity_histories")
}
```

#### KeywordAlert
```prisma
model KeywordAlert {
  id            String         @id @default(uuid())
  keyword       String
  isRegex       Boolean        @default(false) @map("is_regex")
  severity      AlertSeverity
  facilityId    String?        @map("facility_id")
  agencyId      String         @map("agency_id")
  createdBy     String         @map("created_by")
  isActive      Boolean        @default(true) @map("is_active")
  createdAt     DateTime       @default(now()) @map("created_at")

  facility      Facility?      @relation(fields: [facilityId], references: [id])
  agency        Agency         @relation(fields: [agencyId], references: [id])
  creator       AdminUser      @relation("KeywordAlertCreatedBy", fields: [createdBy], references: [id])
  flaggedContent FlaggedContent[]

  @@map("keyword_alerts")
}
```

#### FlaggedContent
```prisma
model FlaggedContent {
  id              String             @id @default(uuid())
  contentType     FlaggedContentType @map("content_type")
  contentId       String             @map("content_id")
  flagReason      FlagReason         @map("flag_reason")
  keywordAlertId  String?            @map("keyword_alert_id")
  matchedText     String?            @map("matched_text")
  severity        AlertSeverity
  status          FlagStatus         @default(pending)
  assignedTo      String?            @map("assigned_to")
  reviewedBy      String?            @map("reviewed_by")
  reviewedAt      DateTime?          @map("reviewed_at")
  resolutionNotes String?            @map("resolution_notes")
  createdAt       DateTime           @default(now()) @map("created_at")

  keywordAlert    KeywordAlert?      @relation(fields: [keywordAlertId], references: [id])
  assignedAdmin   AdminUser?         @relation("FlagAssignedTo", fields: [assignedTo], references: [id])
  reviewer        AdminUser?         @relation("FlagReviewedBy", fields: [reviewedBy], references: [id])

  @@index([contentType, contentId])
  @@index([status])
  @@index([severity])
  @@map("flagged_content")
}

enum FlaggedContentType {
  message
  voice_call
  video_call
  attachment
}

enum FlagReason {
  keyword_match
  manual
  pattern_alert
}

enum FlagStatus {
  pending
  in_review
  dismissed
  escalated
  resolved
}
```

#### AdminPermission
```prisma
model AdminPermission {
  id            String          @id @default(uuid())
  adminUserId   String          @map("admin_user_id")
  permission    PermissionType
  granted       Boolean         @default(true)

  adminUser     AdminUser       @relation(fields: [adminUserId], references: [id])

  @@unique([adminUserId, permission])
  @@map("admin_permissions")
}

enum PermissionType {
  manage_contacts
  monitor_calls
  review_messages
  manage_visitors
  manage_housing
  manage_settings
  view_audit_log
  manage_blocked_numbers
  run_reports
  manage_keyword_alerts
  view_flagged_content
}
```

### B. Schema — Existing Model Modifications

#### IncarceratedPerson — add relations:
```prisma
  visitorLinks   VisitorResident[]
```

#### Facility — add fields + relations:
```prisma
  timezone                String   @default("America/New_York")
  maxVisitorsPerResident  Int      @default(15) @map("max_visitors_per_resident")
  messageReviewRequired   Boolean  @default(true) @map("message_review_required")
  keywordAlerts           KeywordAlert[]
```

#### AdminUser — add fields + relations:
```prisma
  lastLoginAt    DateTime?  @map("last_login_at")
  isActive       Boolean    @default(true) @map("is_active")
  auditLogs              AuditLog[]
  entityChanges          EntityHistory[]         @relation("EntityChangedByAdmin")
  createdKeywordAlerts   KeywordAlert[]          @relation("KeywordAlertCreatedBy")
  assignedFlags          FlaggedContent[]        @relation("FlagAssignedTo")
  reviewedFlags          FlaggedContent[]        @relation("FlagReviewedBy")
  reviewedVisitors       VisitorResident[]       @relation("VisitorReviewedByAdmin")
  permissions            AdminPermission[]
```

#### Agency — add relation:
```prisma
  keywordAlerts  KeywordAlert[]
```

### C. Backend — Routing Infrastructure

**File:** `guilds/admin/api/routes.ts`

Mount all sub-routers:
```typescript
import { Router } from 'express';
import dashboardRoutes from './dashboard.routes';
import residentRoutes from './residents.routes';
import contactRoutes from './contacts.routes';
import visitorRoutes from './visitors.routes';
import monitoringRoutes from './monitoring.routes';
import searchRoutes from './search.routes';
import housingRoutes from './housing.routes';
import reportRoutes from './reports.routes';
import auditRoutes from './audit.routes';
import settingsRoutes from './settings.routes';
import integrationRoutes from './integration.routes';

const router = Router();
router.use('/dashboard', dashboardRoutes);
router.use('/residents', residentRoutes);
router.use('/contacts', contactRoutes);
router.use('/visitors', visitorRoutes);
router.use('/monitoring', monitoringRoutes);
router.use('/search', searchRoutes);
router.use('/housing', housingRoutes);
router.use('/reports', reportRoutes);
router.use('/audit-log', auditRoutes);
router.use('/settings', settingsRoutes);
router.use('/integration', integrationRoutes);

export default router;
```

### D. Backend — Shared Helpers

**File:** `guilds/admin/api/helpers/auditLog.ts`
```typescript
async function auditLog(adminId: string, action: AuditAction, entityType: string, entityId: string, details?: any, ipAddress?: string) {
  await prisma.auditLog.create({ data: { adminUserId: adminId, action, entityType, entityId, details, ipAddress } });
}
```

**File:** `guilds/admin/api/helpers/entityHistory.ts`
```typescript
async function trackChange(entityType: string, entityId: string, fieldName: string, oldValue: any, newValue: any, changedBy: string) {
  await prisma.entityHistory.create({ data: { entityType, entityId, fieldName, oldValue: JSON.stringify(oldValue), newValue: JSON.stringify(newValue), changedBy } });
}
```

**File:** `guilds/admin/api/helpers/facilityScope.ts`
```typescript
function getFacilityFilter(user: AuthUser, queryFacilityId?: string) {
  if (user.role === 'agency_admin') return queryFacilityId ? { facilityId: queryFacilityId } : {};
  return { facilityId: user.facilityId };
}
```

**File:** `guilds/admin/api/middleware/checkPermission.ts`
```typescript
function checkPermission(permission: PermissionType) {
  return async (req, res, next) => {
    const perm = await prisma.adminPermission.findUnique({
      where: { adminUserId_permission: { adminUserId: req.user.id, permission } }
    });
    if (!perm || !perm.granted) return res.status(403).json({ error: 'Permission denied' });
    next();
  };
}
```

### E. Frontend — Admin Router

**File:** `guilds/admin/ui/index.tsx`

Internal router rendering all admin pages:
```
/admin                          → DashboardPage
/admin/residents                → ResidentListPage
/admin/residents/:id            → ResidentProfilePage
/admin/contacts                 → ContactListPage
/admin/visitors                 → VisitorListPage
/admin/visitors/:id             → VisitorProfilePage
/admin/voice                    → VoiceMonitoringPage
/admin/voice/:callId            → CallDetailView
/admin/video                    → VideoMonitoringPage
/admin/video/:callId            → VideoDetailView
/admin/messaging                → MessageReviewPage
/admin/messaging/:conversationId → ConversationView
/admin/search                   → SearchPage
/admin/search/alerts            → KeywordAlertsPage
/admin/housing                  → HousingDashboardPage
/admin/housing/:unitId          → UnitRosterPage
/admin/housing/types/:typeId    → UnitTypeEditorPage
/admin/reports                  → ReportsPage
/admin/audit                    → AuditLogPage
/admin/settings                 → FacilitySettingsPage
/admin/settings/blocked         → BlockedNumbersPage
/admin/settings/permissions     → PermissionsPage
/admin/settings/system          → SystemStatusPage
/admin/residents/bulk-import    → BulkImportPage
```

### F. Frontend — AdminLayout Expansion

**File:** `apps/web/src/layouts/AdminLayout.tsx`

Expand sidebar from 4 items to full navigation:
```
PRIMARY SIDEBAR
─────────────────────────────
📊  Dashboard
─────────────────────────────
  MANAGEMENT
👥  Residents
🤝  Contacts                    (badge: pending count)
🚪  Visitors                    (badge: pending count)
─────────────────────────────
  MONITORING
📞  Voice Calls                  (badge: active count)
📹  Video Calls                  (badge: pending requests)
💬  Messages                     (badge: pending review)
─────────────────────────────
  INTELLIGENCE
🔍  Search & Alerts
─────────────────────────────
  OPERATIONS
🏠  Housing
📈  Reports
📋  Audit Log
⚙️  Settings
```

Header bar additions:
- **Facility selector dropdown** — `<DropdownMenu>` showing facilities. Agency admins see all + "All Facilities". Facility admins see only their facility (disabled).
- **Notification bell** — `<Button variant="ghost">` with `<Bell />` icon and badge count (pending contacts + messages + visitors + flags). Click opens dropdown with grouped action items.
- **Admin name dropdown** — `<DropdownMenu>` with Profile, Logout.

Nav items show **badge counts** for pending items (red badges).

### G. Frontend — Shared Components

**Directory:** `guilds/admin/ui/components/`

| Component | Purpose |
|-----------|---------|
| `StatusBadge.tsx` | Renders `<Badge>` with correct variant for any entity status (active/released/deactivated/pending/approved/denied) |
| `DataTable.tsx` | Wrapper around shadcn `<Table>` with sorting, pagination, and empty state |
| `FilterBar.tsx` | Horizontal filter row: facility selector, status filter, date range, search input |
| `ConfirmModal.tsx` | Reusable confirmation dialog with reason textarea (used by terminate, deny, block, remove actions) |
| `DetailPanel.tsx` | Slideout `<Sheet>` for showing entity details without leaving the list page |
| `EntityHistory.tsx` | Renders entity change history from `EntityHistory` table as a timeline |
| `TimelineView.tsx` | Chronological interleaved timeline of calls, messages, moves, and actions |

### H. Frontend — Shared Hooks

**Directory:** `guilds/admin/ui/hooks/`

| Hook | Purpose |
|------|---------|
| `useAdminApi.ts` | Wrapper around `fetch` with auth token injection, error handling, facility scoping |
| `usePolling.ts` | Configurable polling hook for active call/session lists (default: 15s interval) |
| `useFacilityFilter.ts` | Reads current facility selection from context, provides filter params for API calls |
| `usePagination.ts` | Page state management for paginated lists |

### Tests / QA

- [ ] Migration runs cleanly: `npx prisma migrate dev --name admin-portal-foundation`
- [ ] All new models appear in Prisma Client: `npx prisma generate`
- [ ] All sub-routers mounted and reachable (no 404 on any route prefix)
- [ ] Sidebar renders all 12 nav sections with correct links
- [ ] Facility selector shows correct facilities per admin role
- [ ] Notification bell renders with count
- [ ] Admin profile dropdown shows logout
- [ ] `auditLog()` helper creates entries correctly
- [ ] `trackChange()` helper creates entity history entries
- [ ] `getFacilityFilter()` correctly scopes queries per role
- [ ] `checkPermission()` middleware blocks unauthorized access
- [ ] All shared components render without errors

---

## TICKET-01: Dashboard

**Endpoints:**
- `GET /api/admin/dashboard/stats`
- `GET /api/admin/dashboard/since-last-login`
- `GET /api/admin/dashboard/recent-activity`

**Priority:** P0
**Schema changes:** None (uses AuditLog + existing models from TICKET-00)
**Wireframe:** `01-dashboard.md`
**Spec ref:** Section 6 Dashboard; Section 8 Dashboard; Journeys J1, J2, J3

### What this feature does

Admin logs in → Dashboard shows "since your last login" panel with deltas → stat cards for active calls, pending messages, pending contacts, flagged content, video requests → recent activity feed → quick action links to urgent queues.

### Backend

Route: `guilds/admin/api/dashboard.routes.ts`

```
GET /api/admin/dashboard/stats?facilityId=X
  Response: {
    activeCalls: number,
    activeVideoCalls: number,
    pendingMessages: number,
    pendingContacts: number,
    pendingVisitors: number,
    flaggedContent: number
  }
```

Logic:
- Count `VoiceCall` where status in (`ringing`, `connected`) + facility filter
- Count `VideoCall` where status in (`pending`, `connected`) + facility filter
- Count `Message` where status = `pending_review` + facility filter
- Count `ApprovedContact` where status = `pending` + facility filter
- Count `VisitorResident` where status = `pending` + facility filter
- Count `FlaggedContent` where status = `pending` + facility filter

```
GET /api/admin/dashboard/since-last-login?facilityId=X
  Response: {
    newFlags: number,
    contactsReviewed: number,
    callsTerminated: number,
    messagesReviewed: number,
    lastLoginAt: string
  }
```

Logic:
- Read `AdminUser.lastLoginAt` for the authenticated admin
- Count audit log entries since `lastLoginAt` by action type + facility filter
- Update `lastLoginAt` to now (on first dashboard load per session)

```
GET /api/admin/dashboard/recent-activity?facilityId=X&limit=20
  Response: AuditLog[] (most recent actions across the facility)
```

Logic:
- Query `AuditLog` with facility filter, order by `createdAt DESC`, limit 20
- Join `AdminUser` for display name

Errors (all endpoints):
- `401` — not authenticated
- `403` — not an admin

### Frontend

Location: `guilds/admin/ui/dashboard/DashboardPage.tsx`

**shadcn components:**
- `Card` + `CardHeader` + `CardContent` + `CardTitle` — stat cards and sections
- `Badge` — count badges on stat cards
- `Button` — quick action links
- `Separator` — section dividers
- `ScrollArea` — scrollable activity feed

```tsx
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Phone, Video, MessageSquare, Users, ShieldAlert, Clock, ArrowRight } from "lucide-react"
```

Components:
- **Since-Last-Login Panel** — top of page, `<Card>` with amber/blue background:
  - "Since your last login (X hours ago):"
  - Grid of deltas: "N new flags", "N contacts reviewed", "N calls terminated", "N messages reviewed"
  - Dismiss button to collapse (stores in localStorage)
- **Stat Cards Row** — 6 `<Card>` components in a responsive grid:
  - Active Voice Calls (count, link to /admin/voice)
  - Active Video Calls (count, link to /admin/video)
  - Pending Messages (count, link to /admin/messaging)
  - Pending Contacts (count, link to /admin/contacts)
  - Pending Visitors (count, link to /admin/visitors)
  - Flagged Content (count, link to /admin/search/alerts)
  - Each card: icon, count in large text, label, click navigates to relevant page
- **Recent Activity Feed** — `<ScrollArea>` with `<Card>`:
  - Each entry: admin avatar/initials, action description, entity link, relative timestamp
  - "View All" link → /admin/audit

### Tests / QA

- [ ] Stats reflect actual database counts for the admin's facility
- [ ] Since-last-login shows correct deltas
- [ ] `lastLoginAt` updates on dashboard load
- [ ] Agency admin sees aggregate stats across all facilities
- [ ] Facility admin sees only their facility's stats
- [ ] Stat cards link to correct pages
- [ ] Recent activity shows most recent 20 actions
- [ ] Empty state renders correctly (no activity yet)
- [ ] `401` without auth, `403` with non-admin role

---

## TICKET-02: Resident Management

**Endpoints:**
- `GET /api/admin/residents`
- `GET /api/admin/residents/:id`
- `GET /api/admin/residents/:id/timeline`
- `PATCH /api/admin/residents/:id/status`
- `POST /api/admin/residents/:id/deactivate`
- `POST /api/admin/residents/:id/release`
- `POST /api/admin/residents/:id/reset-pin`
- `POST /api/admin/residents/:id/transfer`

**Priority:** P0
**Schema changes:** None — uses existing `IncarceratedPerson` model
**Wireframe:** `02-residents.md` (Screens A–E)
**Spec ref:** Section 6 Management; Section 8 Residents; Journeys J4–J11

### What this feature does

Full resident management: searchable list with filters, detailed profile with tabbed views (Activity timeline, Contacts, Housing history), and all admin actions (deactivate, release, reset PIN, transfer).

### Backend

Route: `guilds/admin/api/residents.routes.ts`

```
GET /api/admin/residents?facilityId=X&search=Y&status=Z&housingUnitId=V&page=1&pageSize=20
  Response: { data: IncarceratedPerson[], total: number, page: number, pageSize: number }
```

Logic:
- Apply facility scoping via `getFacilityFilter()`
- Search: match `firstName`, `lastName`, `inmateId` via `ILIKE` or PostgreSQL full-text
- Filter by `status` enum, `housingUnitId`
- Include `housingUnit` and `facility` relations
- Paginate with offset/limit

```
GET /api/admin/residents/:id
  Response: IncarceratedPerson with housing, contacts, facility, visitor links
```

Logic:
- Include `housingUnit`, `facility`, `approvedContacts` (with `familyMember`), `visitorLinks` (with `visitor`)
- Verify facility scoping — admin can only see residents in their facility

```
GET /api/admin/residents/:id/timeline?page=1&pageSize=50
  Response: { data: TimelineEntry[], total: number }
```

Logic:
- Query `VoiceCall`, `VideoCall`, `Message`, `AuditLog` (where entityType='IncarceratedPerson' and entityId=:id)
- Interleave by timestamp, sort descending
- Each entry: `{ type: 'voice_call'|'video_call'|'message'|'audit', timestamp, summary, details }`

```
PATCH /api/admin/residents/:id/status
  Body: { status: PersonStatus, reason: string }
  Response: updated IncarceratedPerson
```

Logic:
- Validate status transition is allowed
- Update status
- Create audit log: `resident_status_changed`
- Track entity history for `status` field

```
POST /api/admin/residents/:id/deactivate
  Body: { reason: string }
  Response: updated IncarceratedPerson
```

Logic:
- Validate resident exists and is not already `deactivated`
- Set `status` → `deactivated`
- Create audit log: `resident_deactivated` with `details: { reason, previousStatus }`
- Return updated resident

```
POST /api/admin/residents/:id/release
  Body: { reason: string, releaseDate?: string }
  Response: updated IncarceratedPerson
```

Logic:
- Validate resident exists and is not already `released`
- Set `status` → `released`, `releasedAt` → releaseDate or now()
- Create audit log: `resident_released` with `details: { reason, releaseDate, previousStatus }`
- Return updated resident

```
POST /api/admin/residents/:id/reset-pin
  Body: { }
  Response: { newPin: string }
```

Logic:
- Generate random 4-digit PIN
- Hash and store (check existing pattern — if PINs are hashed, hash before storing)
- Create audit log: `pin_reset` — **NEVER log the PIN value**
- Return `{ newPin }` — only time plaintext PIN is available

```
POST /api/admin/residents/:id/transfer
  Body: { targetFacilityId: string, targetHousingUnitId: string, reason: string }
  Response: updated IncarceratedPerson
```

Logic:
- Validate target facility and unit exist
- Requires `agency_admin` role (facility admins cannot transfer between facilities)
- Update `facilityId` and `housingUnitId`
- Create audit log: `resident_transferred` with `details: { fromFacility, toFacility, fromUnit, toUnit, reason }`
- Track entity history for `facilityId` and `housingUnitId` fields

Errors (all endpoints):
- `400` — invalid input, already in target status, empty reason
- `403` — wrong role or insufficient permission
- `404` — resident not found

### Frontend

**ResidentListPage** — `guilds/admin/ui/residents/ResidentListPage.tsx`

```tsx
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Search, Users } from "lucide-react"
```

Components:
- **Search bar** — `<Input>` with `<Search />` icon, debounced search on `firstName`, `lastName`, `inmateId`
- **Filters** — `<Select>` for status (All/Active/Released/Deactivated/Transferred), `<Select>` for housing unit
- **Results table** — `<Table>` with columns: Name, Inmate ID, Status (`<Badge>`), Housing Unit, Facility, Actions
- **Pagination** — page controls below table
- **Row click** → navigate to `/admin/residents/:id`

**ResidentProfilePage** — `guilds/admin/ui/residents/ResidentProfilePage.tsx`

```tsx
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog"
import { Textarea } from "@/components/ui/textarea"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Calendar } from "@/components/ui/calendar"
import { Separator } from "@/components/ui/separator"
import { ScrollArea } from "@/components/ui/scroll-area"
import { toast } from "sonner"
import { AlertTriangle, Copy, CalendarIcon, ArrowRightLeft } from "lucide-react"
```

Components:
- **Profile Header** — name, inmate ID, `<Badge>` for status, housing unit, facility
- **Action Buttons** — in header:
  - `<Button variant="outline">Reset PIN</Button>` (all statuses)
  - `<Button variant="destructive">Deactivate</Button>` (when active/transferred)
  - `<Button variant="destructive">Release</Button>` (when active)
  - `<Button variant="outline"><ArrowRightLeft /> Transfer</Button>` (agency admin only)
- **Tabbed Content** — `<Tabs defaultValue="activity">`:
  - **Activity Tab** — `<TimelineView>` showing interleaved calls/messages/moves/actions
  - **Contacts Tab** — Two sections: Communication Contacts (from ApprovedContact) + Visitors (from VisitorResident)
  - **Housing Tab** — Current unit info + movement history table
- **PIN Section** — shows "PIN: ••••" (masked) with "Set: [date]", [Reset PIN] button
- **DeactivateResidentModal** — `<Dialog>`:
  - `<DialogDescription>`: "Communication access will be removed. Records are preserved."
  - `<Textarea placeholder="Reason for deactivation (required)" />`
  - `<DialogFooter>`: Cancel + `<Button variant="destructive">Confirm Deactivation</Button>`
- **ReleaseResidentModal** — `<Dialog>`:
  - `<Popover>` → `<Calendar mode="single" />` for release date (default: today)
  - `<Textarea placeholder="Reason for release (required)" />`
  - `<DialogFooter>`: Cancel + `<Button variant="destructive">Confirm Release</Button>`
- **ResetPinModal** — `<Dialog>` two-step:
  - Step 1 (warning): `<Alert variant="destructive">` with warning text
  - Step 2 (result): large monospace PIN display + `<Button>Copy to Clipboard</Button>` + "This PIN will not be shown again."
- **TransferResidentModal** — `<Dialog>` (agency admin only):
  - `<Select>` for target facility
  - `<Select>` for target housing unit (updates when facility changes)
  - `<Textarea placeholder="Reason for transfer (required)" />`
  - `<DialogFooter>`: Cancel + `<Button>Confirm Transfer</Button>`

### Tests / QA

- [ ] Resident list loads with correct data for admin's facility
- [ ] Search filters by name and inmate ID
- [ ] Status filter works correctly
- [ ] Housing unit filter works correctly
- [ ] Pagination works
- [ ] Profile loads with all tabs
- [ ] Activity timeline shows interleaved events in correct order
- [ ] Contacts tab shows both communication contacts and visitors
- [ ] Housing tab shows current unit and movement history
- [ ] Deactivate: status changes, comms access removed, audit logged
- [ ] Release: status changes, `releasedAt` set, comms access removed, audit logged
- [ ] Reset PIN: new PIN works for tablet auth, old PIN fails, PIN never in logs/audit
- [ ] Transfer: facility and unit updated, audit logged, entity history tracked
- [ ] Transfer button only visible to agency admins
- [ ] `401` without auth, `403` with wrong role
- [ ] Facility scoping: facility admin sees only their facility's residents

---

## TICKET-03: Contact Management

**Endpoints:**
- `GET /api/admin/contacts`
- `GET /api/admin/contacts/:id`
- `POST /api/admin/contacts/:id/approve`
- `POST /api/admin/contacts/:id/deny`
- `POST /api/admin/contacts/:id/remove`
- `PATCH /api/admin/contacts/:id`
- `PATCH /api/admin/contacts/:id/attorney-flag`
- `GET /api/admin/contacts/:id/communication-history`

**Priority:** P0
**Schema changes:** None — uses existing `ApprovedContact`, `FamilyMember` models
**Wireframe:** `03-contacts.md` (Screens A–E)
**Spec ref:** Section 6 Management; Section 8 Contacts; Journeys J12–J16

### What this feature does

Full contact management: tabbed list (Pending/Approved/Denied), approve/deny/remove workflows, edit contact info, attorney-client privilege flagging, communication history between contact pairs. Slideout detail panel for quick review without leaving the list.

### Backend

Route: `guilds/admin/api/contacts.routes.ts`

```
GET /api/admin/contacts?facilityId=X&status=pending|approved|denied&page=1&pageSize=20
  Response: { data: ApprovedContact[] (with familyMember + incarceratedPerson), total, page, pageSize }
```

```
GET /api/admin/contacts/:id
  Response: ApprovedContact with familyMember, incarceratedPerson, communication history summary
```

```
POST /api/admin/contacts/:id/approve
  Body: { notes?: string }
  Response: updated ApprovedContact
```

Logic:
- Set `status` → `approved`, `reviewedAt` → now(), `reviewedBy` → admin ID
- Audit log: `contact_approved`

```
POST /api/admin/contacts/:id/deny
  Body: { reason: string }
  Response: updated ApprovedContact
```

Logic:
- Set `status` → `denied`, `reviewedAt` → now(), `reviewedBy` → admin ID
- Audit log: `contact_denied` with reason

```
POST /api/admin/contacts/:id/remove
  Body: { reason: string }
  Response: updated ApprovedContact
```

Logic:
- Set `status` → `removed` (or `denied`)
- Audit log: `contact_removed` with reason

```
PATCH /api/admin/contacts/:id
  Body: { phone?: string, email?: string, relationship?: string }
  Response: updated FamilyMember + ApprovedContact
```

Logic:
- Validate at least one field
- Update fields, track entity history for each changed field
- Audit log: `contact_edited` with `{ oldValues, newValues }`

```
PATCH /api/admin/contacts/:id/attorney-flag
  Body: { isAttorney: boolean, barNumber?: string, jurisdiction?: string }
  Response: updated ApprovedContact
```

Logic:
- Set `isAttorney` flag on the contact
- Store `barNumber` and `jurisdiction` in details JSON
- Audit log: `contact_attorney_flagged`
- **Important:** When flagged as attorney, call recordings must be suppressed (signaling server check)

```
GET /api/admin/contacts/:id/communication-history?page=1&pageSize=20
  Response: { data: (VoiceCall | VideoCall | Message)[], total }
```

Logic:
- Query all calls and messages between the contact pair (resident + family member)
- Interleave by timestamp

Errors:
- `400` — invalid input, no fields provided
- `403` — requires `manage_contacts` permission
- `404` — contact not found

### Frontend

**ContactListPage** — `guilds/admin/ui/contacts/ContactListPage.tsx`

```tsx
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Textarea } from "@/components/ui/textarea"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { toast } from "sonner"
import { Check, X, Pencil, Eye, Shield, Trash2 } from "lucide-react"
```

Components:
- **Tabs** — `<Tabs defaultValue="pending">`:
  - Pending (badge count), Approved, Denied/Removed
- **Contact Table** — per tab:
  - Columns: Resident Name, Contact Name, Relationship, Phone, Email, Status, Date, Actions
  - **Pending tab actions**: `<Button size="sm">Approve</Button>` + `<Button size="sm" variant="destructive">Deny</Button>`
  - **Approved tab actions**: `<Button size="sm" variant="outline"><Pencil /></Button>` (Edit) + `<Button size="sm" variant="outline"><Shield /></Button>` (Attorney Flag) + `<Button size="sm" variant="destructive"><Trash2 /></Button>` (Remove)
- **Detail Panel** — `<Sheet>` slideout:
  - Resident info + family member info
  - Relationship, attorney flag status
  - Communication history summary (last 5 calls/messages)
  - Full history link
- **ApproveContactModal** — `<Dialog>`: review details, optional notes, approve button
- **DenyContactModal** — `<Dialog>`: reason (required), confirm button
- **RemoveContactModal** — `<Dialog>`: reason (required), confirm button
- **EditContactModal** — `<Dialog>`: pre-filled phone, email, relationship fields, save button
- **AttorneyFlagModal** — `<Dialog>`: toggle, bar number, jurisdiction, confirm

### Tests / QA

- [ ] Pending tab shows only pending contacts with correct count badge
- [ ] Approve moves contact to Approved tab, audit logged
- [ ] Deny moves contact to Denied tab with reason, audit logged
- [ ] Remove from Approved works with reason, audit logged
- [ ] Edit saves phone/email/relationship, old→new values in audit
- [ ] Attorney flag toggles correctly, audit logged
- [ ] Communication history shows calls and messages between the pair
- [ ] Detail panel opens with correct data
- [ ] Facility scoping: facility admin sees only their facility's contacts
- [ ] Permission check: `manage_contacts` required for all actions
- [ ] `401` / `403` responses work correctly

---

## TICKET-04: Visitor Management

**Endpoints:**
- `GET /api/admin/visitors`
- `GET /api/admin/visitors/:id`
- `POST /api/admin/visitors`
- `POST /api/admin/visitors/:id/approve`
- `POST /api/admin/visitors/:id/deny`
- `POST /api/admin/visitors/:id/suspend`
- `POST /api/admin/visitors/:id/reactivate`
- `GET /api/admin/visitors/:id/visit-history`
- `POST /api/admin/visitors/:id/link-resident`
- `DELETE /api/admin/visitors/:id/unlink-resident/:residentId`

**Priority:** P1
**Schema changes:** Uses Visitor + VisitorResident models from TICKET-00
**Wireframe:** `04-visitors.md` (if exists; otherwise reference spec Section 6)
**Spec ref:** Section 6 Management; Section 8 Visitors; Journeys J14–J17

### What this feature does

Full visitor management: application review, background check tracking, approve/deny/suspend workflows, link/unlink visitors to residents, visit history. Separate from the communications contact model.

### Backend

Route: `guilds/admin/api/visitors.routes.ts`

```
GET /api/admin/visitors?facilityId=X&status=pending|approved|suspended&type=Y&page=1&pageSize=20
  Response: { data: Visitor[] (with residentLinks), total, page, pageSize }
```

```
GET /api/admin/visitors/:id
  Response: Visitor with residentLinks (including incarceratedPerson), visit history summary
```

```
POST /api/admin/visitors
  Body: { firstName, lastName, dateOfBirth, email?, phone?, visitorType, incarceratedPersonId, relationship }
  Response: created Visitor + VisitorResident link
```

Logic:
- Create Visitor record
- Create VisitorResident link with status `pending`
- Audit log: `visitor_linked`

```
POST /api/admin/visitors/:id/approve
  Body: { notes?: string }
  Response: updated VisitorResident
```

Logic:
- Set VisitorResident `status` → `approved`, `approvedBy` → admin, `reviewedAt` → now()
- Set Visitor `backgroundCheckStatus` → `cleared` (if applicable)
- Audit log: `visitor_approved`

```
POST /api/admin/visitors/:id/deny
  Body: { reason: string }
  Response: updated VisitorResident
```

```
POST /api/admin/visitors/:id/suspend
  Body: { reason: string, scope?: string }
  Response: updated Visitor
```

Logic:
- Set `isActive` → false on Visitor
- Cancel any upcoming scheduled visits
- Audit log: `visitor_suspended`

```
POST /api/admin/visitors/:id/reactivate
  Body: { notes?: string }
  Response: updated Visitor
```

```
GET /api/admin/visitors/:id/visit-history?page=1&pageSize=20
  Response: { data: Visit[], total }
```

```
POST /api/admin/visitors/:id/link-resident
  Body: { incarceratedPersonId: string, relationship: string }
  Response: created VisitorResident
```

```
DELETE /api/admin/visitors/:id/unlink-resident/:residentId
  Body: { reason: string }
  Response: { success: true }
```

Errors:
- `400` — invalid input
- `403` — requires `manage_visitors` permission
- `404` — visitor or resident not found
- `409` — visitor-resident link already exists

### Frontend

**VisitorListPage** — `guilds/admin/ui/visitors/VisitorListPage.tsx`

Components:
- **Tabs** — Applications (pending, badge count), Approved, Suspended
- **Table** — Name, Type, Background Check Status, Linked Residents, Date, Actions
- **Actions**: Approve/Deny (pending), Suspend (approved), Reactivate (suspended)
- **Filter**: visitor type dropdown, search by name

**VisitorProfilePage** — `guilds/admin/ui/visitors/VisitorProfilePage.tsx`

Components:
- **Header** — name, type (`<Badge>`), background check status (`<Badge>`), organization (if applicable)
- **Tabs**:
  - **Linked Residents** — table of linked residents with relationship, link status, actions (approve/suspend/remove)
  - **Visit History** — table of past visits with dates, resident, duration, notes
- **Actions**: Suspend, Reactivate, Link Resident (opens `<Dialog>` with resident search)
- **VisitorApplicationModal** — for admin-initiated visitor creation: name, DOB, type, resident to link, relationship

### Tests / QA

- [ ] Visitor list loads with correct data and tab counts
- [ ] Approve updates status, audit logged
- [ ] Deny updates status with reason, audit logged
- [ ] Suspend deactivates visitor, cancels visits, audit logged
- [ ] Reactivate restores visitor, audit logged
- [ ] Link/unlink resident works correctly
- [ ] Visit history shows past visits
- [ ] Admin-created visitor works end-to-end
- [ ] Facility scoping applied correctly
- [ ] `manage_visitors` permission required
- [ ] Duplicate visitor-resident link returns 409

---

## TICKET-05: Voice Call Monitoring

**Endpoints:**
- `GET /api/admin/monitoring/voice/active`
- `GET /api/admin/monitoring/voice/history`
- `GET /api/admin/monitoring/voice/:callId`
- `POST /api/admin/monitoring/voice/:callId/terminate`
- `GET /api/admin/monitoring/voice/stats`

**Priority:** P0
**Schema changes:** None — uses existing `VoiceCall` model
**Wireframe:** `05-voice-monitoring.md` (Screens 1–3)
**Spec ref:** Section 6 Monitoring; Section 8 Voice; Journeys J18–J22, J59

### What this feature does

Real-time voice call monitoring: active calls table with live duration counters and manual refresh, call history with filters, call detail view with metadata and keyword matches, terminate active calls with reason.

### Backend

Route: `guilds/admin/api/monitoring.routes.ts` (voice section)

```
GET /api/admin/monitoring/voice/active?facilityId=X
  Response: { data: VoiceCall[] (with incarceratedPerson + familyMember), fetchedAt: string }
```

Logic:
- Query `VoiceCall` where `status` in (`ringing`, `connected`) + facility filter
- Include resident and contact details
- Return `fetchedAt` timestamp for "Last updated" display

```
GET /api/admin/monitoring/voice/history?facilityId=X&startDate&endDate&residentId&contactId&status&page=1&pageSize=20
  Response: { data: VoiceCall[], total, page, pageSize }
```

```
GET /api/admin/monitoring/voice/:callId
  Response: VoiceCall with full metadata, keyword matches (from FlaggedContent), admin notes
```

```
POST /api/admin/monitoring/voice/:callId/terminate
  Body: { reason: string }
  Response: updated VoiceCall
```

Logic:
- Set call `status` → `terminated`, `endedBy` → `admin`, `endedAt` → now()
- Signal the call to disconnect (via signaling server)
- Audit log: `call_terminated` with reason

```
GET /api/admin/monitoring/voice/stats?facilityId=X&date=Y
  Response: { activeCalls, todayTotal, avgDuration, terminatedByAdmin }
```

Errors:
- `403` — requires `monitor_calls` permission
- `404` — call not found
- `409` — call already ended

### Frontend

**VoiceMonitoringPage** — `guilds/admin/ui/monitoring/voice/VoiceMonitoringPage.tsx`

```tsx
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Calendar } from "@/components/ui/calendar"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Textarea } from "@/components/ui/textarea"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { toast } from "sonner"
import { Phone, RefreshCw, Loader2, Ban, Clock } from "lucide-react"
```

Components:
- **Tabs** — Active Calls (count), History
- **Active Calls Tab**:
  - Refresh button: `<Button variant="outline" size="sm">` with `<RefreshCw />` / `<Loader2 className="animate-spin" />` + "Last updated: [timestamp]"
  - Auto-polling: `usePolling(15000)` alongside manual refresh
  - Table: Resident, Contact, Status (`<Badge>`), Duration (live counter), Started At, Actions
  - Action: `<Button variant="destructive" size="sm"><Ban /> Terminate</Button>`
- **History Tab**:
  - Filters: date range (`<Popover>` + `<Calendar>`), resident search, contact search, status filter
  - Table: Resident, Contact, Status, Duration, Started, Ended, Actions
  - Action: `<Button variant="outline" size="sm"><Eye /> View</Button>` → navigate to detail
  - Pagination
- **TerminateCallModal** — `<Dialog>`: reason (required), confirm terminate
- **Stats summary** — small cards at top: Active Calls, Today's Total, Avg Duration, Admin Terminated

**CallDetailView** — `guilds/admin/ui/monitoring/voice/CallDetailView.tsx`

Components:
- **Metadata sidebar** — `<Card>`: call ID, status, started/ended at, duration, ended by
- **Participants** — resident name (link to profile) + contact name (link to contact)
- **Call timeline** — visual timeline: started → connected → ended (with reason if terminated)
- **Keyword matches** — if flagged: matched keywords with severity badges
- **Attorney flag** — if contact is attorney: prominent notice "Attorney-client privilege — recording suppressed"

### Tests / QA

- [ ] Active calls table shows correct data with live duration counters
- [ ] Manual refresh updates table and timestamp
- [ ] Auto-polling works alongside manual refresh
- [ ] History filters by date range, resident, contact, status
- [ ] Call detail shows full metadata and timeline
- [ ] Terminate: call ends, status updated, audit logged
- [ ] Terminate button only on active/connected calls
- [ ] Rapid refresh clicks → debounced, no duplicate requests
- [ ] Stats show correct counts for today
- [ ] Keyword matches displayed on flagged calls
- [ ] Attorney flag notice shows when applicable
- [ ] `monitor_calls` permission required
- [ ] Facility scoping applied

---

## TICKET-06: Video Call Monitoring

**Endpoints:**
- `GET /api/admin/monitoring/video/pending`
- `GET /api/admin/monitoring/video/active`
- `GET /api/admin/monitoring/video/schedule`
- `GET /api/admin/monitoring/video/history`
- `GET /api/admin/monitoring/video/:callId`
- `POST /api/admin/monitoring/video/:callId/approve`
- `POST /api/admin/monitoring/video/:callId/deny`
- `POST /api/admin/monitoring/video/:callId/terminate`
- `GET /api/admin/monitoring/video/stats`

**Priority:** P0
**Schema changes:** None — uses existing `VideoCall` model
**Wireframe:** `06-video-monitoring.md` (Screens 1–4)
**Spec ref:** Section 6 Monitoring; Section 8 Video; Journeys J23–J27

### What this feature does

Full video call management: approve/deny pending requests, view schedule, monitor active sessions with terminate capability, browse history, view call details.

### Backend

Route: `guilds/admin/api/monitoring.routes.ts` (video section)

```
GET /api/admin/monitoring/video/pending?facilityId=X
  Response: { data: VideoCall[] (status=pending_approval), total }
```

```
GET /api/admin/monitoring/video/active?facilityId=X
  Response: { data: VideoCall[] (status=connected), fetchedAt }
```

```
GET /api/admin/monitoring/video/schedule?facilityId=X&date=Y
  Response: { data: VideoCall[] (status=approved, scheduled for date), total }
```

```
GET /api/admin/monitoring/video/history?facilityId=X&startDate&endDate&page=1&pageSize=20
  Response: { data: VideoCall[], total, page, pageSize }
```

```
GET /api/admin/monitoring/video/:callId
  Response: VideoCall with full metadata, scheduled vs actual times, approved-by
```

```
POST /api/admin/monitoring/video/:callId/approve
  Body: { notes?: string }
  Response: updated VideoCall
```

Logic:
- Set `status` → `approved`, record approver
- Audit log: `video_approved`

```
POST /api/admin/monitoring/video/:callId/deny
  Body: { reason: string }
  Response: updated VideoCall
```

Logic:
- Set `status` → `denied`, record reason
- Audit log: `video_denied`

```
POST /api/admin/monitoring/video/:callId/terminate
  Body: { reason: string }
  Response: updated VideoCall
```

Logic:
- Set `status` → `terminated`, signal disconnect
- Audit log: `video_terminated`

```
GET /api/admin/monitoring/video/stats?facilityId=X&date=Y
  Response: { pendingRequests, activeNow, scheduledToday, completedToday }
```

Errors:
- `403` — requires `monitor_calls` permission
- `404` — call not found
- `409` — call already in target status

### Frontend

**VideoMonitoringPage** — `guilds/admin/ui/monitoring/video/VideoMonitoringPage.tsx`

Components:
- **Tabs** — Pending Requests (badge), Schedule, Active Sessions, History
- **Pending tab**: table with request details, Approve/Deny buttons
- **Schedule tab**: timeline/calendar view showing approved calls for the day, capacity utilization
- **Active tab**: same pattern as voice — refresh button, live counters, terminate button
- **History tab**: filterable, paginated table
- **ApproveVideoModal** — optional notes, confirm
- **DenyVideoModal** — reason (required), confirm
- **TerminateVideoModal** — reason (required), confirm

**VideoDetailView** — `guilds/admin/ui/monitoring/video/VideoDetailView.tsx`

Components:
- Same pattern as CallDetailView + scheduled time vs actual start, approved-by info

### Tests / QA

- [ ] Pending requests show with correct badge count
- [ ] Approve: status updated, audit logged
- [ ] Deny: status updated with reason, audit logged
- [ ] Schedule shows approved calls for selected date
- [ ] Active sessions show with refresh capability
- [ ] Terminate: session ends, audit logged
- [ ] History filterable and paginated
- [ ] Detail view shows all metadata
- [ ] Stats accurate for selected date
- [ ] `monitor_calls` permission required
- [ ] Facility scoping applied

---

## TICKET-07: Message Review

**Endpoints:**
- `GET /api/admin/monitoring/messages/pending`
- `GET /api/admin/monitoring/messages/attachments`
- `GET /api/admin/monitoring/messages/conversation/:conversationId`
- `POST /api/admin/monitoring/messages/:messageId/approve`
- `POST /api/admin/monitoring/messages/:messageId/block`
- `POST /api/admin/monitoring/messages/conversation/:conversationId/block`
- `POST /api/admin/monitoring/messages/conversation/:conversationId/unblock`
- `POST /api/admin/monitoring/messages/attachments/:attachmentId/approve`
- `POST /api/admin/monitoring/messages/attachments/:attachmentId/reject`
- `GET /api/admin/monitoring/messages/stats`

**Priority:** P0
**Schema changes:** None — uses existing `Message`, `Conversation` models
**Wireframe:** `07-message-review.md` (Screens 1–3)
**Spec ref:** Section 6 Monitoring; Section 8 Messages; Journeys J28–J32

### What this feature does

Message moderation queue: review pending messages (sorted oldest-first), approve/block messages, review flagged attachments, view full conversation threads, block/unblock entire conversations.

### Backend

Route: `guilds/admin/api/monitoring.routes.ts` (messages section)

```
GET /api/admin/monitoring/messages/pending?facilityId=X&page=1&pageSize=20
  Response: { data: Message[] (status=pending_review, with sender + recipient + conversation), total }
```

Logic:
- Sort by `createdAt ASC` (oldest first — FIFO queue)
- Include thread context (previous 2-3 messages in same conversation)

```
GET /api/admin/monitoring/messages/attachments?facilityId=X&status=pending_review
  Response: { data: Attachment[] (with message + sender), total }
```

```
GET /api/admin/monitoring/messages/conversation/:conversationId
  Response: { messages: Message[] (chronological), participants, blockedStatus }
```

```
POST /api/admin/monitoring/messages/:messageId/approve
  Body: { notes?: string }
  Response: updated Message
```

Logic:
- Set `status` → `approved`
- Audit log: `message_approved`

```
POST /api/admin/monitoring/messages/:messageId/block
  Body: { reason: string }
  Response: updated Message
```

Logic:
- Set `status` → `blocked`
- Audit log: `message_blocked` with reason

```
POST /api/admin/monitoring/messages/conversation/:conversationId/block
  Body: { reason: string }
  Response: updated Conversation
```

Logic:
- Set conversation `isBlocked` → true
- Both parties prevented from messaging
- Audit log: `conversation_blocked` with reason

```
POST /api/admin/monitoring/messages/conversation/:conversationId/unblock
  Body: { notes?: string }
  Response: updated Conversation
```

```
POST /api/admin/monitoring/messages/attachments/:attachmentId/approve
POST /api/admin/monitoring/messages/attachments/:attachmentId/reject
  Body: { reason?: string }
```

```
GET /api/admin/monitoring/messages/stats?facilityId=X&date=Y
  Response: { pendingCount, approvedToday, blockedToday, avgReviewTime }
```

Errors:
- `403` — requires `review_messages` permission
- `404` — message/conversation not found

### Frontend

**MessageReviewPage** — `guilds/admin/ui/monitoring/messaging/MessageReviewPage.tsx`

Components:
- **Tabs** — Pending (badge), Attachments (badge)
- **Pending Tab**:
  - Queue sorted oldest-first
  - Each message: expandable row showing full message body + thread context (previous 2-3 messages)
  - Sender/recipient info with links to profiles
  - Actions: `<Button>Approve</Button>` + `<Button variant="destructive">Block</Button>`
  - Keyword flag indicator if message was flagged
- **Attachments Tab**:
  - Flagged images/files for review
  - Preview + Approve/Reject buttons
- **BlockMessageModal** — reason (required), confirm
- **Stats bar** — pending count, approved today, blocked today, avg review time

**ConversationView** — `guilds/admin/ui/monitoring/messaging/ConversationView.tsx`

Components:
- **Message thread** — `<ScrollArea>` with chronological messages:
  - Each message: sender name, timestamp, body, status indicator (`<Badge>`)
  - Inline keyword match highlighting
- **Participant info** — resident + contact links
- **Actions**: Block/Unblock conversation button
- **Block status banner** — if blocked, show `<Alert>` with reason and blocked-by info

### Tests / QA

- [ ] Pending queue sorted oldest-first (FIFO)
- [ ] Approve: message status updated, audit logged
- [ ] Block: message blocked with reason, audit logged
- [ ] Thread context shows previous messages
- [ ] Attachment review works (approve/reject)
- [ ] Conversation view shows full thread chronologically
- [ ] Block conversation: both parties can't message, audit logged
- [ ] Unblock conversation: messaging restored, audit logged
- [ ] Stats accurate for today
- [ ] Keyword flag indicators shown on flagged messages
- [ ] `review_messages` permission required
- [ ] Facility scoping applied

---

## TICKET-08: Search & Keyword Alerts

**Endpoints:**
- `GET /api/admin/search`
- `GET /api/admin/keyword-alerts`
- `POST /api/admin/keyword-alerts`
- `PATCH /api/admin/keyword-alerts/:id`
- `DELETE /api/admin/keyword-alerts/:id`
- `GET /api/admin/keyword-alerts/:id/matches`
- `GET /api/admin/flagged-content`
- `PATCH /api/admin/flagged-content/:id/review`
- `POST /api/admin/flagged-content/:id/escalate`
- `POST /api/admin/flagged-content`

**Priority:** P1
**Schema changes:** Uses KeywordAlert + FlaggedContent from TICKET-00
**Wireframe:** `08-search.md`, `09-keyword-alerts.md`
**Spec ref:** Section 6 Intelligence; Section 8 Search & Alerts; Section 9 Search/Keyword; Journeys J33–J36

### What this feature does

Global cross-entity search, keyword alert configuration and management, flagged content triage queue with escalation workflows.

### Backend

Route: `guilds/admin/api/search.routes.ts`

```
GET /api/admin/search?q=X&facilityId=Y&types=residents,contacts,visitors,messages,calls&page=1&pageSize=20
  Response: { residents: [], contacts: [], visitors: [], messages: [], calls: [] }
```

Logic:
- Search across multiple tables using PostgreSQL `ILIKE` or `tsvector`/`tsquery`
- Group results by entity type
- Apply facility scoping
- Return top N results per type with relevance ordering

```
GET /api/admin/keyword-alerts?facilityId=X&isActive=true
  Response: { data: KeywordAlert[] (with match count), total }
```

```
POST /api/admin/keyword-alerts
  Body: { keyword: string, isRegex: boolean, severity: AlertSeverity, facilityId?: string }
  Response: created KeywordAlert
```

Logic:
- If `isRegex`, validate regex syntax
- Set `agencyId` from admin context, `createdBy` → admin ID
- Audit log: `keyword_alert_created`

```
PATCH /api/admin/keyword-alerts/:id
  Body: { keyword?: string, severity?: string, isActive?: boolean }
  Response: updated KeywordAlert
```

```
DELETE /api/admin/keyword-alerts/:id
```

Logic:
- Soft delete (set `isActive` → false) rather than hard delete
- Audit log: `keyword_alert_deactivated`

```
GET /api/admin/keyword-alerts/:id/matches?page=1&pageSize=20
  Response: { data: FlaggedContent[], total }
```

```
GET /api/admin/flagged-content?facilityId=X&status=pending&severity=high&contentType=message&page=1&pageSize=20
  Response: { data: FlaggedContent[], total, page, pageSize }
```

```
PATCH /api/admin/flagged-content/:id/review
  Body: { status: FlagStatus, resolutionNotes?: string }
  Response: updated FlaggedContent
```

Logic:
- Set `reviewedBy` → admin ID, `reviewedAt` → now()
- Audit log: `flagged_content_reviewed` / `flagged_content_dismissed`

```
POST /api/admin/flagged-content/:id/escalate
  Body: { assignedTo: string, notes: string }
  Response: updated FlaggedContent
```

Logic:
- Set `assignedTo`, `status` → `escalated`
- Audit log: `flagged_content_escalated`

```
POST /api/admin/flagged-content
  Body: { contentType, contentId, flagReason: 'manual', severity, notes }
  Response: created FlaggedContent
```

Errors:
- `400` — invalid regex, missing required fields
- `403` — requires `manage_keyword_alerts` or `view_flagged_content` permission
- `404` — alert or content not found

### Frontend

**SearchPage** — `guilds/admin/ui/search/SearchPage.tsx`

Components:
- **Search input** — `<Command>` with typeahead, single search bar
- **Results** — grouped by type: Residents, Contacts, Visitors, Messages, Calls
- Each result: summary info + link to detail view
- Empty state: "No results for '[query]'"

**KeywordAlertsPage** — `guilds/admin/ui/search/KeywordAlertsPage.tsx`

Components:
- **Alert table** — keyword, severity (`<Badge>`), scope (facility/agency), match count, active/inactive toggle (`<Switch>`), actions
- **Add Alert button** → `<Dialog>`: keyword input, regex toggle (`<Switch>`), severity select, facility scope select
- **Edit Alert** → same dialog pre-filled
- **"View Matches" link** → drill-down to flagged content filtered by this alert
- **Flagged Content Queue** — table: content type, matched text, severity, status, assigned to, actions
  - Actions: Dismiss, Escalate, Resolve
  - **EscalateModal** — target admin dropdown, notes, confirm
  - **Manual Flag button** — `<Dialog>`: content type, content ID, severity, notes

### Tests / QA

- [ ] Global search returns results across all entity types
- [ ] Search results grouped correctly by type
- [ ] Facility scoping applied to search results
- [ ] Keyword alert CRUD works (create, edit, deactivate)
- [ ] Regex validation on regex alerts
- [ ] Alert match count updates correctly
- [ ] Flagged content queue shows pending items
- [ ] Review: status updates, reviewer recorded, audit logged
- [ ] Escalate: assigned admin set, audit logged
- [ ] Manual flag creates FlaggedContent entry
- [ ] `manage_keyword_alerts` permission for alert CRUD
- [ ] `view_flagged_content` permission for triage queue

---

## TICKET-09: Housing Management

**Endpoints:**
- `GET /api/admin/housing/units`
- `GET /api/admin/housing/units/:unitId/roster`
- `POST /api/admin/housing/move`
- `GET /api/admin/housing/unit-types`
- `GET /api/admin/housing/unit-types/:typeId`
- `PATCH /api/admin/housing/unit-types/:typeId`

**Priority:** P1
**Schema changes:** None — uses existing `HousingUnit`, `HousingUnitType` models
**Wireframe:** `10-housing.md` (Screens 1–3)
**Spec ref:** Section 6 Operations; Section 8 Housing; Journeys J37–J40

### What this feature does

Facility housing overview with occupancy visualization, unit roster drill-down, move residents between units, configure unit type rules (call durations, calling hours, max contacts, video settings).

### Backend

Route: `guilds/admin/api/housing.routes.ts`

```
GET /api/admin/housing/units?facilityId=X
  Response: { data: HousingUnit[] (with type, occupancy count, capacity), total }
```

Logic:
- Count `IncarceratedPerson` per unit where status = `active`
- Include `housingUnitType` for each unit
- Apply facility scoping

```
GET /api/admin/housing/units/:unitId/roster
  Response: { unit: HousingUnit, residents: IncarceratedPerson[] }
```

```
POST /api/admin/housing/move
  Body: { incarceratedPersonId: string, targetHousingUnitId: string, reason: string }
  Response: updated IncarceratedPerson
```

Logic:
- Validate target unit has capacity
- Update `housingUnitId` on resident
- Track entity history for `housingUnitId`
- Audit log: `housing_changed` with from/to unit + reason

```
GET /api/admin/housing/unit-types?agencyId=X
  Response: { data: HousingUnitType[] }
```

```
GET /api/admin/housing/unit-types/:typeId
  Response: HousingUnitType with all fields
```

```
PATCH /api/admin/housing/unit-types/:typeId
  Body: { maxCallDurationMinutes?, callingHoursStart?, callingHoursEnd?, maxContacts?, videoEnabled?, ... }
  Response: updated HousingUnitType
```

Logic:
- Track entity history for each changed field
- Audit log: `setting_changed`
- Note: changes apply to ALL units of this type

Errors:
- `400` — target unit at capacity
- `403` — requires `manage_housing` permission
- `404` — unit or type not found

### Frontend

**HousingDashboardPage** — `guilds/admin/ui/housing/HousingDashboardPage.tsx`

Components:
- **Unit cards grid** — `<Card>` per unit:
  - Unit name, type badge
  - Occupancy bar: `<Progress value={occupancy/capacity * 100} />`
  - Color-coded: green (<80%), amber (80-95%), red (>95%)
  - Resident count / capacity
  - Click → navigate to roster
- **Summary stats** — total capacity, total occupied, percentage

**UnitRosterPage** — `guilds/admin/ui/housing/UnitRosterPage.tsx`

Components:
- **Unit info header** — `<Card>`: name, type, capacity, current count
- **Resident table** — Name, Inmate ID, Status, Moved In Date, Actions
- **Move action** → `<Dialog>`: target unit selector (shows capacity), reason, confirm
- **Link to profiles** — click resident name → resident profile

**UnitTypeEditorPage** — `guilds/admin/ui/housing/UnitTypeEditorPage.tsx`

Components:
- **Form** — `<Card>` with `<Input>` / `<Select>` fields:
  - Max call duration (minutes)
  - Calling hours start/end
  - Max contacts per resident
  - Video calling enabled (`<Switch>`)
  - Max video calls per week
  - Contact change frequency (days) — if present
- **Save button** — "Save changes — applies to all [N] units of this type"
- **Units list** — table of all units with this type, showing occupancy

### Tests / QA

- [ ] Dashboard shows all units with correct occupancy counts
- [ ] Progress bars colored correctly by capacity threshold
- [ ] Roster shows residents in the selected unit
- [ ] Move: resident's unit updated, history tracked, audit logged
- [ ] Move blocked if target unit is at capacity
- [ ] Unit type editor loads current values
- [ ] Unit type save updates all units of that type
- [ ] `manage_housing` permission required
- [ ] Facility scoping applied

---

## TICKET-10: Reports & Analytics

**Endpoints:**
- `GET /api/admin/reports/communication-volume`
- `GET /api/admin/reports/moderation`
- `GET /api/admin/reports/flagged-content`
- `GET /api/admin/reports/visitors`
- `GET /api/admin/reports/export`

**Priority:** P2
**Schema changes:** None
**Wireframe:** `11-reports.md`
**Spec ref:** Section 6 Operations; Section 8 Reports; Journeys J41–J45

### What this feature does

Analytics dashboard with four report types: communication volume, moderation performance, flagged content analysis, visitor activity. Date range selection, charts/tables, CSV/PDF export.

### Backend

Route: `guilds/admin/api/reports.routes.ts`

```
GET /api/admin/reports/communication-volume?facilityId=X&startDate&endDate&groupBy=day|week|month
  Response: { data: { period, voiceCalls, videoCalls, messages }[] }
```

```
GET /api/admin/reports/moderation?facilityId=X&startDate&endDate
  Response: { data: { adminUser, messagesReviewed, contactsReviewed, avgReviewTime, approvalRate }[] }
```

```
GET /api/admin/reports/flagged-content?facilityId=X&startDate&endDate
  Response: { data: { totalFlags, byType, bySeverity, resolutionRate, topKeywords }[] }
```

```
GET /api/admin/reports/visitors?facilityId=X&startDate&endDate
  Response: { data: { applications, approved, denied, activeVisitors, totalVisits }[] }
```

```
GET /api/admin/reports/export?type=communication-volume|moderation|flagged|visitors&format=csv|pdf&facilityId=X&startDate&endDate
  Response: file download (CSV or PDF)
```

Errors:
- `400` — invalid date range, missing params
- `403` — requires `run_reports` permission

### Frontend

**ReportsPage** — `guilds/admin/ui/reports/ReportsPage.tsx`

Components:
- **Report selector tabs** — Communication Volume, Moderation, Flags & Alerts, Visitor Activity
- **Date range picker** — `<Popover>` + `<Calendar>` for start/end dates
- **Data tables** — `<Table>` with sortable columns per report type
- **Charts** — use a simple chart library (e.g., recharts) for line/bar charts
- **Export button** — `<DropdownMenu>`: Export as CSV, Export as PDF
- **ExportModal** — `<Dialog>`: format selection, date range confirmation, download

### Tests / QA

- [ ] Each report type returns correct data for date range
- [ ] GroupBy works for communication volume (day/week/month)
- [ ] Moderation report shows per-admin metrics
- [ ] Flagged content report shows breakdown by type and severity
- [ ] Visitor report shows application pipeline metrics
- [ ] CSV export downloads correctly formatted file
- [ ] PDF export downloads correctly formatted file
- [ ] `run_reports` permission required
- [ ] Facility scoping applied

---

## TICKET-11: Audit Log

**Endpoints:**
- `GET /api/admin/audit-log`
- `GET /api/admin/audit-log/:entityType/:entityId`

**Priority:** P1
**Schema changes:** Uses AuditLog from TICKET-00
**Wireframe:** `12-audit-log.md`
**Spec ref:** Section 6 Operations; Section 8 Audit; Journeys J46–J48

### What this feature does

Searchable, filterable admin action history. View all audit log entries with filters for date range, admin user, action type, entity type. Click any entry for full detail including JSON diff. Entity-scoped view shows history for a specific record.

### Backend

Route: `guilds/admin/api/audit.routes.ts`

```
GET /api/admin/audit-log?facilityId=X&adminUserId=Y&action=Z&entityType=W&startDate&endDate&page=1&pageSize=50
  Response: { data: AuditLog[] (with adminUser name), total, page, pageSize }
```

Logic:
- Apply all filters (all optional)
- Join `AdminUser` for display name
- Order by `createdAt DESC`
- Facility scoping via admin's facility

```
GET /api/admin/audit-log/:entityType/:entityId
  Response: { auditLogs: AuditLog[], entityHistory: EntityHistory[] }
```

Logic:
- All audit log entries for this specific entity
- All entity history entries (field-level changes)
- Combined and sorted by timestamp

Errors:
- `403` — requires `view_audit_log` permission

### Frontend

**AuditLogPage** — `guilds/admin/ui/audit/AuditLogPage.tsx`

```tsx
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Calendar } from "@/components/ui/calendar"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Filter, Clock, User, FileText } from "lucide-react"
```

Components:
- **Filter bar** — date range (calendar popovers), admin user selector, action type dropdown, entity type dropdown
- **Results table** — Date/Time, Admin User, Action (`<Badge>`), Entity Type, Entity ID (link), Details summary
- **Row click** → expand to show full `details` JSON in a `<Card>` with formatted key-value pairs
- **Entity link** — clicking entity ID navigates to the relevant detail page (resident profile, contact detail, etc.)
- **Pagination** — page controls

**EntityHistory component** (shared, from TICKET-00) — used on any entity detail page:
- Timeline of field-level changes: "Field X changed from A to B by Admin Name on Date"
- Compact chronological list

### Tests / QA

- [ ] Audit log shows all recorded actions
- [ ] Filters work: date range, admin user, action type, entity type
- [ ] Pagination works correctly
- [ ] Row expand shows full details JSON
- [ ] Entity-scoped view shows only that entity's history
- [ ] Entity history shows field-level changes
- [ ] Entity links navigate to correct detail pages
- [ ] `view_audit_log` permission required
- [ ] Facility scoping applied (facility admins see only their facility's actions)

---

## TICKET-12: Settings & Configuration

**Endpoints:**
- `GET /api/admin/settings/facility/:facilityId`
- `PATCH /api/admin/settings/facility/:facilityId`
- `GET /api/admin/settings/blocked-numbers`
- `POST /api/admin/settings/blocked-numbers`
- `DELETE /api/admin/settings/blocked-numbers/:id`
- `GET /api/admin/settings/permissions/:adminUserId`
- `PATCH /api/admin/settings/permissions/:adminUserId`
- `GET /api/admin/settings/system/health`

**Priority:** P1
**Schema changes:** Uses AdminPermission from TICKET-00
**Wireframe:** `13-settings.md` (Screens 1–4)
**Spec ref:** Section 6 Operations; Section 8 Settings; Journeys J49–J52

### What this feature does

Facility configuration (name, timezone, announcement, settings), blocked phone number management, admin permission toggle matrix, system health dashboard.

### Backend

Route: `guilds/admin/api/settings.routes.ts`

```
GET /api/admin/settings/facility/:facilityId
  Response: Facility (all fields)
```

```
PATCH /api/admin/settings/facility/:facilityId
  Body: { name?, announcementText?, announcementAudioUrl?, timezone?, maxVisitorsPerResident?, messageReviewRequired? }
  Response: updated Facility
```

Logic:
- Track entity history for changed fields
- Audit log: `setting_changed`

```
GET /api/admin/settings/blocked-numbers?facilityId=X&scope=facility|agency
  Response: { data: BlockedNumber[], total }
```

```
POST /api/admin/settings/blocked-numbers
  Body: { phoneNumber: string, scope: 'facility'|'agency', facilityId?: string, reason: string }
  Response: created BlockedNumber
```

Logic:
- Audit log: `number_blocked`

```
DELETE /api/admin/settings/blocked-numbers/:id
  Body: { reason: string }
  Response: { success: true }
```

Logic:
- Audit log: `number_unblocked`

```
GET /api/admin/settings/permissions/:adminUserId
  Response: { adminUser: AdminUser, permissions: AdminPermission[] }
```

```
PATCH /api/admin/settings/permissions/:adminUserId
  Body: { permissions: { manage_contacts: boolean, monitor_calls: boolean, ... } }
  Response: updated permissions
```

Logic:
- Upsert `AdminPermission` records for each permission type
- Audit log: `permission_changed` for each changed permission

```
GET /api/admin/settings/system/health
  Response: {
    database: { status, latency },
    signaling: { status, latency },
    apiGateway: { status, latency },
    redis: { status, latency }
  }
```

Logic:
- Ping each service, measure response time
- Return status (healthy/degraded/down) + latency in ms

Errors:
- `403` — requires `manage_settings` or `manage_blocked_numbers` permission
- `404` — facility, admin user, or blocked number not found

### Frontend

**FacilitySettingsPage** — `guilds/admin/ui/settings/FacilitySettingsPage.tsx`

Components:
- **Form** — `<Card>` with fields: facility name (`<Input>`), announcement text (`<Textarea>`), announcement audio URL (`<Input>`), timezone (`<Select>`), max visitors (`<Input type="number">`), message review required (`<Switch>`)
- **Save button** — `<Button>Save Changes</Button>`
- Success toast on save

**BlockedNumbersPage** — `guilds/admin/ui/settings/BlockedNumbersPage.tsx`

Components:
- **Table** — phone number, scope (`<Badge>`: Facility/Agency), reason, blocked by, date, actions
- **Add button** → `<Dialog>`: phone number input, scope select (facility/agency), reason textarea, confirm
- **Remove button** → `<Dialog>`: confirmation with reason

**PermissionsPage** — `guilds/admin/ui/settings/PermissionsPage.tsx`

Components:
- **Admin user list** — table of admin users with name, email, role, facility
- **Click row** → expand to show permission toggle matrix:
  - Grid of `<Switch>` toggles for each `PermissionType`
  - Label + description for each permission
  - Save button per admin user
- **Agency admin only** — only agency admins can modify permissions

**SystemStatusPage** — `guilds/admin/ui/settings/SystemStatusPage.tsx`

Components:
- **Status cards** — `<Card>` per service:
  - Service name, status indicator (green dot = healthy, yellow = degraded, red = down)
  - Latency display
  - Last checked timestamp
- **Refresh button** — re-check all services
- Auto-refresh every 60 seconds

### Tests / QA

- [ ] Facility settings load and save correctly
- [ ] Setting changes tracked in entity history and audit log
- [ ] Blocked numbers: add, remove, list with correct filters
- [ ] Blocked number scope (facility vs agency) enforced
- [ ] Permission matrix shows correct current state
- [ ] Permission toggle updates take effect immediately (test with target admin login)
- [ ] System health shows correct status for each service
- [ ] System health handles service down gracefully
- [ ] `manage_settings` / `manage_blocked_numbers` permissions enforced
- [ ] Only agency admins can modify permissions

---

## TICKET-13: Bulk User Import

**Endpoint:** `POST /api/admin/residents/bulk-import`
**Priority:** P2
**Schema changes:** None — uses existing `IncarceratedPerson` model
**Wireframe:** `14-bulk-import.md` (Screen 1: Upload, Screen 2: Preview & Validation)
**Spec ref:** Section 8 Residents; Journey J58

### What this feature does

Agency admin uploads a CSV file → system parses and validates each row → preview table shows valid/warning/error status per row → admin confirms import → valid rows create resident profiles with auto-generated PINs.

### Backend

Route: `guilds/admin/api/bulk-import.routes.ts`

Additional dependency: `npm install multer @types/multer` for file upload handling.

```
POST /api/admin/residents/bulk-import
  Content-Type: multipart/form-data
  Body: CSV file
  Response: { imported: number, skipped: number, warnings: number, errors: { row: number, field: string, message: string }[] }
```

Required CSV columns: `firstName`, `lastName`, `dateOfBirth`, `inmateId`, `pin`, `housingUnitName`, `clearanceLevel`
Optional CSV columns: `email`, `phone`, `notes`

Logic:
- Parse CSV, validate headers
- Per-row validation:
  - Required fields present
  - `dateOfBirth` is valid date
  - `housingUnitName` matches an existing HousingUnit at admin's facility
  - `inmateId` not already in DB (warn if duplicate)
  - `clearanceLevel` is valid enum value
- Auto-generate 4-digit PIN for each imported resident (if `pin` column empty)
- Insert valid rows in a transaction — rollback entire batch on DB error
- Create single audit log entry: `bulk_import` with filename, imported count, skipped count

Errors:
- `400` — not a CSV, missing required columns, >500 rows
- `403` — agency admin only

### Frontend

Location: `guilds/admin/ui/residents/BulkImportPage.tsx`
Nav: add "📥 Bulk Import" under Operations in sidebar — agency admin only

Additional dependency: `npm install react-dropzone`

```tsx
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Progress } from "@/components/ui/progress"
import { toast } from "sonner"
import { Upload, Download, CheckCircle, AlertTriangle, XCircle } from "lucide-react"
import { useDropzone } from "react-dropzone"
```

**Screen 1 — Upload:**
- `<Card>` with info: "Import resident profiles from a CSV file. Max 500 rows."
- `<Button variant="outline"><Download /> Download CSV Template</Button>`
- Dropzone: dashed border, drag-and-drop + `<Button>Browse Files</Button>`
- Accepted: `.csv` only, max 2 MB

**Screen 2 — Preview & Validation:**
- File info bar: name, row count, size
- 3 stat cards: ✓ Valid (green), ⚠ Warnings (amber), ✕ Errors (red)
- `<Tabs>`: All / Valid / Warnings / Errors
- `<Table>`: row #, name, inmate ID, DOB, unit, clearance, status badge
- Cancel + `<Button>Import {n} Valid Records</Button>`
- Confirmation `<Dialog>`: "Import N records into [facility]? This cannot be undone."
- `<Progress>` during import, success summary on completion

### Tests / QA

- [ ] Valid CSV imports correctly, all rows become `IncarceratedPerson` records
- [ ] PINs auto-generated and functional for tablet auth
- [ ] Empty CSV → appropriate error
- [ ] Wrong columns → column mapping error
- [ ] >500 rows → max rows error
- [ ] Duplicate `inmateId` within file → deduplicated
- [ ] Existing `inmateId` in DB → warning, still importable
- [ ] Invalid housing unit → per-row error
- [ ] Missing required fields → per-row error
- [ ] Non-CSV file → rejected
- [ ] Transaction: if DB insert fails mid-batch, entire batch rolls back
- [ ] Audit log: single entry with filename + counts
- [ ] `403` for non-agency-admin

---

## TICKET-14: Integration Stubs

**Endpoints:**
- `POST /api/admin/integration/sync-residents`
- `POST /api/admin/integration/sync-housing`

**Priority:** P2
**Schema changes:** None
**Spec ref:** Requirements #8, #9 from original scope

### What this feature does

Placeholder endpoints for future case management system integration. Returns `501 Not Implemented` for now — reserves the route structure.

### Backend

Route: `guilds/admin/api/integration.routes.ts`

```
POST /api/admin/integration/sync-residents
  → 501 { message: "Integration endpoint reserved for case management system" }

POST /api/admin/integration/sync-housing
  → 501 { message: "Integration endpoint reserved for case management system" }
```

### Frontend

None — API-only stubs.

### Tests / QA

- [ ] Both routes return `501` with expected message
- [ ] Routes are registered and reachable (not 404)
- [ ] Auth still required (401 without token)

---

## TICKET-15: Schema Enrichment — Resident Status Fields (Deferred)

**Priority:** P3 (optional scope — deferred)
**Depends on:** TICKET-02 shipped first (core flows work without these fields)

### What this adds

Dedicated columns to track *who* deactivated/released a resident and *why*, instead of relying on audit log `details` JSON.

### Schema

Add to `IncarceratedPerson`:
```prisma
deactivatedBy        String?    @map("deactivated_by")
deactivationReason   String?    @map("deactivation_reason")
releaseReason        String?    @map("release_reason")
releasedBy           String?    @map("released_by")
```

Add reverse relations on `AdminUser`:
```prisma
deactivatedResidents IncarceratedPerson[] @relation("DeactivatedByAdmin")
releasedResidents    IncarceratedPerson[] @relation("ReleasedByAdmin")
```

Run: `npx prisma migrate dev --name add-resident-status-enrichment`

### Backend changes

Update TICKET-02 deactivate handler:
- Also set `deactivatedBy` → admin ID, `deactivationReason` → reason

Update TICKET-02 release handler:
- Also set `releasedBy` → admin ID, `releaseReason` → reason

### Frontend changes

- Show `<Alert>`: "Deactivated by [admin name] on [date]: [reason]" on deactivated profiles
- Show `<Alert>`: "Released by [admin name] on [date]: [reason]" on released profiles

### Tests / QA

- [ ] `deactivatedBy` and `deactivationReason` populated on deactivate
- [ ] `releasedBy` and `releaseReason` populated on release
- [ ] Profile renders enrichment data when present
- [ ] Profile still works when fields are null (backwards compatible)
- [ ] Audit log entries still created (enrichment supplements, not replaces)

---

## TICKET-16: Schema Enrichment — Contact Change Frequency (Deferred)

**Priority:** P3 (optional scope — deferred)
**Depends on:** TICKET-03 shipped first (basic edit works without frequency limits)

### What this adds

Configurable minimum days between contact list changes per resident, based on housing unit type.

### Schema

Add to `HousingUnitType`:
```prisma
contactChangeFrequencyDays   Int?   @map("contact_change_frequency_days")
```

Add to `IncarceratedPerson`:
```prisma
lastContactChangeAt   DateTime?   @map("last_contact_change_at")
```

Add to `FamilyMember`:
```prisma
address   String?
```

Run: `npx prisma migrate dev --name add-contact-change-frequency`

### Backend — new endpoint

```
GET /api/admin/contacts/change-eligibility/:residentId
  Response: { eligible: boolean, nextEligibleDate?: string, daysSinceLastChange: number, frequencyDays: number | null }
```

### Backend — update edit handler

- Before allowing edit, check eligibility. If not eligible, return `409` with `nextEligibleDate`
- On successful edit, set `lastContactChangeAt` = now() on the resident
- Add `address` to accepted PATCH fields

### Frontend

- **Eligibility banner** — green when eligible, amber when locked, with dates
- **Locked buttons** — [Edit] and [Remove] wrapped in `<Tooltip>` showing next eligible date
- **Agency admin override** — bypasses cooldown
- **Address field** — added to EditContactModal

### Tests / QA

- [ ] `eligible: true` when frequency is null (unlimited)
- [ ] `eligible: true` when enough days have passed
- [ ] `eligible: false` with correct `nextEligibleDate`
- [ ] API returns `409` if ineligible
- [ ] Agency admin can override lockout
- [ ] Address field saves and displays
- [ ] `lastContactChangeAt` updates on edit

---

## Dependency Graph

```
TICKET-00 (Foundation)       — MUST BE FIRST — schema, routing, layout, shared infra
    │
    ├── TICKET-01 (Dashboard)          — depends on TICKET-00 (uses AuditLog, stats queries)
    ├── TICKET-02 (Residents)          — depends on TICKET-00 (uses audit helpers, routing)
    ├── TICKET-03 (Contacts)           — depends on TICKET-00 (uses audit helpers, routing)
    ├── TICKET-04 (Visitors)           — depends on TICKET-00 (uses Visitor model, routing)
    ├── TICKET-05 (Voice Monitoring)   — depends on TICKET-00 (uses monitoring routes)
    ├── TICKET-06 (Video Monitoring)   — depends on TICKET-00 (uses monitoring routes)
    ├── TICKET-07 (Message Review)     — depends on TICKET-00 (uses monitoring routes)
    ├── TICKET-08 (Search & Alerts)    — depends on TICKET-00 (uses KeywordAlert, FlaggedContent)
    ├── TICKET-09 (Housing)            — depends on TICKET-00 (uses housing routes)
    ├── TICKET-10 (Reports)            — depends on TICKET-00 (uses all models for aggregation)
    ├── TICKET-11 (Audit Log)          — depends on TICKET-00 (uses AuditLog model)
    ├── TICKET-12 (Settings)           — depends on TICKET-00 (uses AdminPermission model)
    ├── TICKET-13 (Bulk Import)        — depends on TICKET-00 (uses routing, audit helpers)
    └── TICKET-14 (Integration Stubs)  — depends on TICKET-00 (uses routing)

TICKET-15 (Status Enrichment)  — depends on TICKET-02 being shipped
TICKET-16 (Change Frequency)   — depends on TICKET-03 being shipped
```

After TICKET-00, all tickets 01–14 can be built **in parallel** — no cross-dependencies.

---

## Priority Breakdown

### P0 — Must Ship
- TICKET-00: Foundation (schema, routing, layout, shared infra) — **BUILD FIRST**
- TICKET-01: Dashboard
- TICKET-02: Resident Management
- TICKET-03: Contact Management
- TICKET-05: Voice Call Monitoring
- TICKET-06: Video Call Monitoring
- TICKET-07: Message Review

### P1 — Should Ship
- TICKET-04: Visitor Management
- TICKET-08: Search & Keyword Alerts
- TICKET-09: Housing Management
- TICKET-11: Audit Log
- TICKET-12: Settings & Configuration

### P2 — Nice to Have
- TICKET-10: Reports & Analytics
- TICKET-13: Bulk User Import
- TICKET-14: Integration Stubs

### P3 — Deferred (Optional Scope)
- TICKET-15: Schema Enrichment — Resident Status Fields
- TICKET-16: Schema Enrichment — Contact Change Frequency

---

## Coverage Verification

### Screens (23/23 covered)
| Screen | Ticket |
|--------|--------|
| DashboardPage | TICKET-01 |
| ResidentListPage | TICKET-02 |
| ResidentProfilePage | TICKET-02 |
| ContactListPage | TICKET-03 |
| ContactDetailPanel | TICKET-03 |
| VisitorListPage | TICKET-04 |
| VisitorProfilePage | TICKET-04 |
| VoiceMonitoringPage | TICKET-05 |
| CallDetailView | TICKET-05 |
| VideoMonitoringPage | TICKET-06 |
| VideoDetailView | TICKET-06 |
| MessageReviewPage | TICKET-07 |
| ConversationView | TICKET-07 |
| SearchPage | TICKET-08 |
| KeywordAlertsPage | TICKET-08 |
| HousingDashboardPage | TICKET-09 |
| UnitRosterPage | TICKET-09 |
| UnitTypeEditorPage | TICKET-09 |
| ReportsPage | TICKET-10 |
| AuditLogPage | TICKET-11 |
| FacilitySettingsPage | TICKET-12 |
| BlockedNumbersPage | TICKET-12 |
| PermissionsPage | TICKET-12 |
| SystemStatusPage | TICKET-12 |
| BulkImportPage | TICKET-13 |

### User Journeys (57/57 covered)
| Journey | Ticket |
|---------|--------|
| J1–J3 (Dashboard, shift start) | TICKET-01 |
| J4–J11 (Residents) | TICKET-02 |
| J12–J16 (Contacts) | TICKET-03 |
| J14–J17 (Visitors) | TICKET-04 |
| J18–J22, J59 (Voice) | TICKET-05 |
| J23–J27 (Video) | TICKET-06 |
| J28–J32 (Messages) | TICKET-07 |
| J33–J36 (Search/Alerts) | TICKET-08 |
| J37–J40 (Housing) | TICKET-09 |
| J41–J45 (Reports) | TICKET-10 |
| J46–J48 (Audit) | TICKET-11 |
| J49–J52 (Settings) | TICKET-12 |
| J53–J54 (Cross-cutting) | TICKET-00 + TICKET-01 |
| J55 (Attorney privilege) | TICKET-03 |
| J56 (Transfer) | TICKET-02 |
| J57 (Blocked numbers) | TICKET-12 |
| J58 (Bulk import) | TICKET-13 |
| J60 (Change frequency) | TICKET-16 |

### API Endpoints (~60/~60 covered)
All endpoints from spec Section 8 are mapped to tickets. See individual tickets for full endpoint lists.

### Data Models (7/7 + modifications covered)
All new models and existing model modifications from spec Section 4 are in TICKET-00.

---

## Validation Commands

```bash
# Schema validation (run after TICKET-00 schema changes)
npx prisma validate

# Type checking
npm run typecheck

# Build
npm run build

# Push changes
git push fork jic
```
