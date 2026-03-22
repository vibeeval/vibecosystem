---
name: frontend-patterns
description: React, Next.js, TypeScript frontend patterns - component design, state management, performance
---

# Frontend Patterns

## Component Design

### Composition over Inheritance

```tsx
// DOGRU: Composition
function Card({ children, header }: { children: ReactNode; header: ReactNode }) {
  return (
    <div className="card">
      <div className="card-header">{header}</div>
      <div className="card-body">{children}</div>
    </div>
  );
}

// Kullanim
<Card header={<h2>Title</h2>}>
  <p>Content here</p>
</Card>
```

### Container/Presenter Pattern

```tsx
// Container: Data fetching + logic
function UserListContainer() {
  const { data, isLoading } = useQuery(['users'], fetchUsers);
  if (isLoading) return <Skeleton />;
  return <UserList users={data} />;
}

// Presenter: Pure rendering
function UserList({ users }: { users: User[] }) {
  return (
    <ul>
      {users.map(u => <UserItem key={u.id} user={u} />)}
    </ul>
  );
}
```

## State Management

| Cozum | Ne Zaman | Karmasiklik |
|-------|----------|-------------|
| useState | Local component state | Dusuk |
| useReducer | Complex local state | Orta |
| Context | Theme, auth, locale | Dusuk-Orta |
| Zustand | Global client state | Orta |
| React Query | Server state | Orta |
| URL params | Navigation state | Dusuk |

## Performance

```tsx
// React.memo: Expensive render onleme
const ExpensiveList = React.memo(({ items }: { items: Item[] }) => (
  <ul>{items.map(i => <ListItem key={i.id} item={i} />)}</ul>
));

// useMemo: Expensive hesaplama cache
const filtered = useMemo(
  () => items.filter(i => i.status === status),
  [items, status]
);

// useCallback: Referans stabilitesi
const handleClick = useCallback((id: string) => {
  setSelected(id);
}, []);
```

## Next.js Patterns

| Feature | Ne Zaman |
|---------|----------|
| Server Component | Data fetch, no interactivity |
| Client Component | onClick, useState, useEffect |
| Route Handler | API endpoint |
| Middleware | Auth, redirect, rewrite |
| Streaming | Buyuk data, progressive rendering |

## shadcn/ui Best Practices

```typescript
// Theme config: globals.css'te CSS variable kullan
// shadcn/ui dark mode: class strategy (Tailwind darkMode: 'class')

// Component override: cn() ile extend et, fork etme
import { Button } from '@/components/ui/button'
<Button variant="outline" className={cn('custom-class', className)} />

// Compose, override etme:
function SubmitButton({ children, ...props }: ButtonProps) {
  return <Button type="submit" variant="default" {...props}>{children}</Button>
}

// A11y: shadcn radix tabanli, otomatik ARIA ama kontrol et
// Dark mode: CSS variable'lar otomatik switch eder
```

## Performance Budget

| Metrik | Esik | Olcum |
|--------|------|-------|
| LCP (Largest Contentful Paint) | < 2.5s | Core Web Vital |
| CLS (Cumulative Layout Shift) | < 0.1 | Core Web Vital |
| INP (Interaction to Next Paint) | < 200ms | Core Web Vital |
| FCP (First Contentful Paint) | < 1.8s | Lighthouse |
| TTI (Time to Interactive) | < 3.8s | Lighthouse |
| Total JS bundle | < 200KB gzipped | Build analiz |

### React Performance Top 10

1. `React.memo` sadece gercekten expensive render'larda
2. `useMemo`/`useCallback` sadece referans stability gerektiginde
3. Code splitting: `React.lazy()` + `Suspense` route bazli
4. Image optimization: `next/image`, lazy loading, WebP/AVIF
5. Virtual scroll: 100+ item listede `@tanstack/virtual`
6. Debounce: Arama input'unda 300ms debounce
7. Skeleton UI: Loading state icin layout shift onleme
8. Bundle analyze: `@next/bundle-analyzer` ile kontrol
9. Prefetch: `<Link prefetch>` kritik navigation'larda
10. Server Component: Default RSC, client sadece interactive icin

## Anti-Patterns

| Anti-Pattern | Dogru Yol |
|-------------|-----------|
| Prop drilling (5+ level) | Context veya state library |
| useEffect for derived state | useMemo kullan |
| Index as key | Unique ID kullan |
| Premature optimization | Profiler ile olc, sonra optimize et |
