# Inertia.js v3 Beta Upgrade Plan

## Current State
- **Inertia React**: v2.2.18
- **Inertia Laravel**: v2.0.14
- **React**: 19.0.0 (meets v3 requirement)
- **Laravel**: 12.42.0 (meets v3 requirement)
- **PHP**: 8.2+ (meets v3 requirement)

## Why Upgrade
- **Optimistic updates** — comments, checklist toggles, status changes appear instantly
- **Built-in XHR client** — smaller bundle, no Axios dependency for Inertia internals
- **Instant visits** — page swaps immediately while server fires in background
- **useHttp hook** — reactive standalone HTTP requests (useful for search, API calls)
- **Vite plugin** — eliminates boilerplate in app bootstrap

---

## Pre-Upgrade Audit

### Low Risk (no changes needed)
- `Inertia::lazy()` — NOT used anywhere
- `router.cancel()` — NOT used anywhere
- `<Deferred>` component — NOT used anywhere
- `future` config block — NOT used anywhere
- `hideProgress` / `revealProgress` — NOT used anywhere
- `qs` / `lodash-es` imports — NOT used anywhere

### Medium Risk (verify after upgrade)
- `router.post/patch/delete` — 50+ instances across the app (API unchanged, but verify behaviour)
- `useForm` hook — heavy usage across auth, variations, admin pages (API unchanged, verify)
- `preserveScroll: true` — 50+ instances (should work the same)

### Separate Concern (not affected by upgrade)
- **Direct axios usage** — 16+ files use `import axios from 'axios'` directly for non-Inertia API calls (sync-manager, SmartPricingWizard, push notifications, labour forecast, etc.). These are NOT routed through Inertia's HTTP client, so the Axios removal in v3 does not affect them. Axios stays as a direct dependency.

---

## Upgrade Steps

### Phase 1: Install v3 Beta Packages

```bash
# Frontend
npm install @inertiajs/react@^3.0.0-beta @inertiajs/vite@^3.0.0-beta

# Backend
composer require inertiajs/inertia-laravel:^3.0.0-beta

# Republish config & clear views
php artisan vendor:publish --provider="Inertia\ServiceProvider" --force
php artisan view:clear
```

### Phase 2: Update Vite Config

**File:** `vite.config.ts`

```ts
// ADD this import
import inertia from '@inertiajs/vite'

export default defineConfig({
    plugins: [
        laravel({
            input: ['resources/css/app.css', 'resources/js/app.tsx'],
            ssr: 'resources/js/ssr.tsx',
            refresh: true,
        }),
        inertia(),   // ADD — handles page resolution automatically
        react(),
        tailwindcss(),
    ],
    // ... rest stays the same
});
```

### Phase 3: Simplify App Bootstrap

**File:** `resources/js/app.tsx`

The Vite plugin handles page resolution, so `resolvePageComponent` import can be removed. Update `createInertiaApp` to use the plugin's auto-resolution or keep manual if preferred.

Review the republished config file at `config/inertia.php` — v3 restructures page settings under a `pages` namespace. Reapply any customizations (root view, SSR settings).

### Phase 4: Update SSR Entry

**File:** `resources/js/ssr.tsx`

Review SSR setup — v3 no longer needs a separate Node server in dev. The Vite plugin handles SSR automatically with `npm run dev`. Simplify if possible.

### Phase 5: Review Laravel Config

**File:** `config/inertia.php`

After republishing, diff the new config against any customizations. Key changes:
- Page settings moved under `pages` namespace
- SSR configuration may have new options
- Review and reapply root view setting if changed

### Phase 6: Build & Smoke Test

```bash
npm run build
php artisan serve
```

Test critical flows:
- [ ] Login / Register / Logout
- [ ] Employment Applications list & show
- [ ] Comment posting (the original problem)
- [ ] Checklist toggling
- [ ] Status changes
- [ ] File uploads (comment attachments)
- [ ] Drawing workspace navigation
- [ ] Variation creation
- [ ] Admin pages (roles, permissions, templates)

### Phase 7: Add Optimistic Updates

Once v3 is stable, add optimistic updates to key interactions:

#### 7a. Comment Posting (primary goal)
```tsx
// Before (v2):
router.post(route('comments.store'), formData, {
    preserveScroll: true,
    onSuccess: () => { setCommentBody(''); setAttachments([]); },
    onFinish: () => setSubmitting(false),
});

// After (v3 with optimistic):
router.optimistic((props) => ({
    comments: [
        ...props.comments,
        {
            id: Date.now(), // temporary ID
            body: commentBody,
            metadata: null,
            user: { id: currentUserId, name: currentUserName },
            created_at: new Date().toISOString(),
            attachments: [],
            replies: [],
        },
    ],
})).post(route('comments.store'), formData, {
    preserveScroll: true,
    onSuccess: () => { setCommentBody(''); setAttachments([]); },
    onFinish: () => setSubmitting(false),
});
```

#### 7b. Checklist Toggle
```tsx
// Optimistic toggle — checkbox updates instantly
router.optimistic((props) => ({
    checklists: props.checklists.map(cl => ({
        ...cl,
        items: cl.items.map(item =>
            item.id === itemId
                ? { ...item, completed_at: item.completed_at ? null : new Date().toISOString() }
                : item
        ),
    })),
})).patch(route('checklist-items.toggle', itemId), {}, {
    preserveScroll: true,
});
```

#### 7c. Comment Delete
```tsx
// Optimistic delete — comment disappears instantly
router.optimistic((props) => ({
    comments: props.comments.filter(c => c.id !== commentId),
})).delete(route('comments.destroy', commentId), {
    preserveScroll: true,
});
```

#### 7d. Status Change
```tsx
// Optimistic status update
router.optimistic((props) => ({
    application: { ...props.application, status: newStatus },
})).patch(route('employment-applications.update-status', app.id), {
    status: newStatus,
}, { preserveScroll: true });
```

---

## Rollback Plan

If v3 causes issues:
```bash
npm install @inertiajs/react@^2.2.18
npm uninstall @inertiajs/vite
composer require inertiajs/inertia-laravel:^2.0
php artisan vendor:publish --provider="Inertia\ServiceProvider" --force
php artisan view:clear
```

Revert `vite.config.ts` to remove the `inertia()` plugin.
Revert `app.tsx` / `ssr.tsx` if modified.

---

## Risk Assessment

| Area | Risk | Notes |
|------|------|-------|
| Package install | Low | All prerequisites met |
| Vite config | Low | Additive change (new plugin) |
| App bootstrap | Low | Minimal current config |
| SSR | Medium | May need adjustment |
| Router calls | Low | API unchanged in v3 |
| useForm | Low | API unchanged in v3 |
| Direct axios usage | None | Stays as separate dependency |
| Optimistic updates | Low | New feature, additive |
| Config republish | Medium | Must diff & reapply customizations |

**Overall: Low risk upgrade.** The project uses conservative, standard Inertia patterns with no deprecated APIs.
