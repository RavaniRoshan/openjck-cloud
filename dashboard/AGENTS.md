<!-- BEGIN:nextjs-agent-rules -->
# OpenJCK Cloud Dashboard — Agent Context

**Framework**: Next.js 16 App Router + TypeScript + Tailwind CSS v4

> ⚠️ **CRITICAL**: This is NOT the Next.js you know. v16 has breaking changes — APIs, conventions, and file structure differ from training data. Read `node_modules/next/dist/docs/` before writing code.

---

## Stack

| Category | Choice |
|----------|--------|
| Framework | Next.js 16.2.2 |
| Language | TypeScript 5 |
| Styling | Tailwind CSS v4 + PostCSS |
| UI Components | shadcn/ui v4 |
| Server State | TanStack Query v5 |
| UI State | Zustand v5 |
| Real-time | EventSource (SSE) — NO WebSockets |
| Fonts | IBM Plex Mono (data) + IBM Plex Sans (UI) |

---

## Tailwind v4 — Critical Syntax Changes

**NO `@tailwind` directives in CSS files.**

```css
/* ❌ OLD - DO NOT USE */
@tailwind base;
@tailwind components;
@tailwind utilities;

/* ✅ NEW - v4 uses @import */
@import "tailwindcss";
```

**NO `tailwind.config.js` theme extensions.**

```css
/* ❌ OLD - DO NOT USE */
text-primary bg-surface

/* ✅ NEW - Use CSS custom properties */
text-[var(--oj-text-primary)] bg-[var(--oj-surface)]
```

**Custom properties defined in `globals.css`:**

```css
:root {
  --oj-background: #1a1a1a;
  --oj-surface: #242424;
  --oj-surface-hover: #2a2a2a;
  --oj-surface-elevated: #2e2e2e;
  --oj-border: #333333;
  --oj-text-primary: #f5f5f5;
  --oj-text-secondary: #a0a0a0;
  --oj-text-muted: #8a8a8a;
  --oj-accent: #f59e0b;        /* Amber */
  --oj-accent-hover: #fbbf24;
  --oj-success: #22c55e;
  --oj-danger: #ef4444;
}
```

---

## Server State — TanStack Query

**ALWAYS use TanStack Query for server state. Never use raw `useState` for API data.**

```typescript
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

// READ
const { data, isLoading, error } = useQuery({
  queryKey: ['ai-keys', 'anthropic'],
  queryFn: async () => {
    const res = await apiClient.get('/api/v1/settings/ai-keys/anthropic');
    return res.data;
  },
});

// WRITE
const mutation = useMutation({
  mutationFn: async (key: string) => {
    return apiClient.put('/api/v1/settings/ai-keys/anthropic', { key });
  },
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ['ai-keys', 'anthropic'] });
  },
});
```

---

## Real-time Updates — SSE

**NO WebSockets. Use EventSource only.**

```typescript
// SSE receives events → update TanStack Query cache
const eventSource = new EventSource(`/api/sse?orgId=${orgId}`);

eventSource.onmessage = (event) => {
  const data = JSON.parse(event.data);
  // Update cache directly — triggers re-render
  queryClient.setQueryData(['sessions', data.session_id], data);
};
```

---

## UI State — Zustand

**Use Zustand for client-only UI state (sidebar, drawers, fleet config).**

```typescript
import { create } from 'zustand';

interface UIState {
  sidebarOpen: boolean;
  fleetDensity: 'compact' | 'comfortable' | 'spacious';
  fleetWindow: '1h' | '6h' | '24h' | '7d';
  toggleSidebar: () => void;
  setFleetDensity: (d: UIState['fleetDensity']) => void;
}

export const useUIStore = create<UIState>((set) => ({
  sidebarOpen: true,
  fleetDensity: 'comfortable',
  fleetWindow: '24h',
  toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
  setFleetDensity: (d) => set({ fleetDensity: d }),
}));
```

---

## Route Structure (App Router)

```
src/app/
├── (app)/                    # Authenticated routes
│   ├── layout.tsx           # App shell with sidebar
│   ├── page.tsx             # Dashboard home (redirects to /sessions)
│   ├── sessions/
│   │   └── page.tsx         # Sessions list
│   ├── fleet/
│   │   └── page.tsx         # Fleet grid view
│   ├── replay/
│   │   └── page.tsx         # Replay interface
│   └── settings/
│       ├── layout.tsx       # Settings shell
│       ├── org/
│       │   └── page.tsx     # Organization settings
│       ├── api-keys/
│       │   └── page.tsx     # API key management
│       ├── ai-keys/
│       │   └── page.tsx     # BYOK settings (AI provider keys)
│       ├── alerts/
│       │   └── page.tsx     # Alert configuration
│       └── billing/
│           └── page.tsx     # Billing settings
├── (auth)/                   # Unauthenticated routes
│   ├── login/
│   │   └── page.tsx
│   └── callback/
│       └── route.ts         # OAuth callback
└── (public)/                 # Public routes
    └── invite/
        └── page.tsx
```

---

## Design System — Locked Values

**Colors**: Charcoal + Amber. No gradients. No purple.

| Token | CSS Variable | Hex |
|-------|-------------|-----|
| Background | `--oj-background` | `#1a1a1a` |
| Surface | `--oj-surface` | `#242424` |
| Surface Hover | `--oj-surface-hover` | `#2a2a2a` |
| Accent | `--oj-accent` | `#f59e0b` |
| Success | `--oj-success` | `#22c55e` |
| Danger | `--oj-danger` | `#ef4444` |
| Muted | `--oj-text-muted` | `#8a8a8a` |

**Typography**:
- IBM Plex Mono: Data, IDs, costs, timestamps (`font-mono`)
- IBM Plex Sans: Labels, prose, UI text (`font-sans`)

**Layout**:
- Sidebar: `220px` fixed width
- Topbar: `48px` fixed height
- Drawer: `600px` desktop / `100%` mobile

---

## API Client

**Use `axios` instance with base URL from env:**

```typescript
// src/lib/api/client.ts
import axios from 'axios';

export const apiClient = axios.create({
  baseURL: process.env.NEXT_PUBLIC_OPENJCK_API_URL || 'http://localhost:7070',
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add auth token from Supabase session
apiClient.interceptors.request.use(async (config) => {
  const { data: { session } } = await supabase.auth.getSession();
  if (session?.access_token) {
    config.headers.Authorization = `Bearer ${session.access_token}`;
  }
  return config;
});
```

---

## Auth — Supabase

**Use `@supabase/ssr` for server-side auth:**

```typescript
// middleware.ts
import { createServerClient } from '@supabase/ssr';
import { NextResponse } from 'next/server';

export async function middleware(req: NextRequest) {
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { /* ... */ } }
  );

  const { data: { user } } = await supabase.auth.getUser();

  if (!user && !req.nextUrl.pathname.startsWith('/login')) {
    return NextResponse.redirect(new URL('/login', req.url));
  }

  return NextResponse.next();
}
```

---

## BYOK Settings Page Pattern

```typescript
// Settings pages use this pattern:
'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';

export default function AiKeysPage() {
  const queryClient = useQueryClient();
  const [inputKey, setInputKey] = useState('');

  const { data: keyStatus } = useQuery({
    queryKey: ['ai-keys', 'anthropic'],
    queryFn: async () => {
      const res = await apiClient.get('/api/v1/settings/ai-keys/anthropic');
      return res.data;
    },
  });

  const saveMutation = useMutation({
    mutationFn: async (key: string) => {
      return apiClient.put('/api/v1/settings/ai-keys/anthropic', { key });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ai-keys'] });
      toast.success('Key saved');
    },
  });

  return (
    <div className="p-6 max-w-2xl">
      <Card className="p-4 bg-[var(--oj-surface)] border-[var(--oj-border)]">
        {/* Content */}
      </Card>
    </div>
  );
}
```

---

## Status Badges

```typescript
// Running
<Badge className="bg-amber-muted text-amber border-0">
  <span className="animate-pulse mr-1">●</span> Running
</Badge>

// Verified
<Badge className="bg-[var(--oj-success-muted)] text-[var(--oj-success)] border-0">
  <CheckCircle2 className="h-3 w-3 mr-1" /> Verified
</Badge>

// Error
<Badge className="bg-[var(--oj-danger-muted)] text-[var(--oj-danger)] border-0">
  <AlertTriangle className="h-3 w-3 mr-1" /> Unverified
</Badge>
```

---

## Commands

```bash
npm run dev      # Next.js dev server on :3000
npm run build    # Production build
npm run lint     # ESLint check
```

---

## Deprecation Notes

- ❌ `getServerSideProps` — Use Server Components or Route Handlers
- ❌ `pages/api/*` — Use `app/api/*` Route Handlers
- ❌ `useSWR` — Use TanStack Query v5
- ❌ `socket.io` — Use SSE (EventSource)
- ❌ `@tailwind` directives — Use `@import "tailwindcss"`
- ❌ `tailwind.config.js` theme — Use CSS custom properties

<!-- END:nextjs-agent-rules -->

---

## Change Log

### April 2026 - Edge Case Protection

**Error Boundaries:**
- Global ErrorBoundary component wraps major sections independently
- Production-grade error handling with errorId generation
- Retry and redirect options with design system styling

**404 and Forbidden Pages:**
- Custom 404 page at `app/not-found.tsx`
- Forbidden page component with access denied messaging
- Design system styling (charcoal + amber)

**API Error Handling:**
- ApiError class with status, code, body, retryAfter
- handleApiError function with status-specific toast notifications
- Error codes: TOKEN_EXPIRED, KEY_REVOKED, NO_ORG, CONNECTION_LOST
- Network and timeout error detection

**Form Validation:**
- `validateAnthropicKey()` - API key format validation
- `validateWebhookUrl()` - URL protocol and security checks
- `validateOrgName()` - Organization name constraints

**Stale Data Handling:**
- SSE store tracks `lastConnectedAt` and `needsReconciliation`
- Stale data banner after 60s disconnected
- Data reconciliation on reconnect after >30s
- Query invalidation triggers refetch
