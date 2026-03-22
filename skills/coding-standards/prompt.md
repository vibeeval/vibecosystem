---
name: coding-standards
description: Universal coding standards - naming, formatting, error handling, immutability, SOLID principles
---

# Coding Standards

## Naming Conventions

| Tip | Format | Ornek |
|-----|--------|-------|
| Variable | camelCase | `userName`, `itemCount` |
| Function | camelCase, verb-first | `getUserById`, `calculateTotal` |
| Class/Type | PascalCase | `UserService`, `OrderItem` |
| Constant | UPPER_SNAKE | `MAX_RETRIES`, `API_URL` |
| File | kebab-case | `user-service.ts`, `order-item.ts` |
| Boolean | is/has/should prefix | `isActive`, `hasPermission` |

## Immutability

```typescript
// YANLIS: Mutate
user.name = newName;
items.push(newItem);

// DOGRU: Yeni obje
const updated = { ...user, name: newName };
const newItems = [...items, newItem];
```

## Error Handling

```typescript
// Custom error class
class AppError extends Error {
  constructor(public code: string, message: string, public statusCode = 500) {
    super(message);
  }
}

// Try-catch with specific errors
try {
  const result = await riskyOperation();
  return result;
} catch (error) {
  if (error instanceof ValidationError) {
    throw new AppError('VALIDATION', error.message, 400);
  }
  throw new AppError('INTERNAL', 'Unexpected error', 500);
}
```

## Function Rules

- Max 50 satir, tek sorumluluk
- Max 3 parametre (fazlasi obje olarak)
- Early return (nested if yerine guard clause)
- Pure function tercih et (side effect yok)

```typescript
// YANLIS: Deep nesting
function process(user) {
  if (user) {
    if (user.isActive) {
      if (user.hasPermission) {
        return doWork(user);
      }
    }
  }
}

// DOGRU: Early return
function process(user) {
  if (!user) return null;
  if (!user.isActive) return null;
  if (!user.hasPermission) return null;
  return doWork(user);
}
```

## SOLID Principles

| Prensip | Kural |
|---------|-------|
| S - Single Responsibility | Her sinif/fonksiyon tek is |
| O - Open/Closed | Extension'a acik, modification'a kapali |
| L - Liskov Substitution | Alt tip, ust tipin yerine gecebilmeli |
| I - Interface Segregation | Kucuk, specific interface'ler |
| D - Dependency Inversion | Abstraction'a baglan, concrete'e degil |

## Result<T,E> Pattern (Functional Error Handling)

Exception fırlatmak yerine explicit error dondur. Ozellikle API katmaninda, service'lerde ve veri islemede kullan.

```typescript
// Result type tanimi
type Result<T, E = Error> =
  | { ok: true; value: T }
  | { ok: false; error: E };

// Kullanim
function parseConfig(raw: string): Result<Config, ValidationError> {
  try {
    const parsed = JSON.parse(raw);
    if (!isValidConfig(parsed)) {
      return { ok: false, error: new ValidationError('Invalid config shape') };
    }
    return { ok: true, value: parsed as Config };
  } catch {
    return { ok: false, error: new ValidationError('Invalid JSON') };
  }
}

// Tuketim
const result = parseConfig(input);
if (!result.ok) {
  logger.warn('Config parse failed', { error: result.error.message });
  return fallbackConfig;
}
const config = result.value;
```

**Ne zaman kullan**: Service layer, parser, validator, external API cagrisi
**Ne zaman kullanma**: Basit utility, internal fonksiyon (try/catch yeterli)

## Comment Rules

- **Yorumlar zamansiz olmali**: "Simdi boyle cunku..." yerine "Bu yaklasim X sebebiyle tercih edildi" yaz
- **Neden > Ne**: Kod ne yaptigini zaten gosteriyor, NEDEN yaptigini yaz
- **Clarity over brevity**: Kisa yorum ama anlamsizsa, uzun ama anlamli yorum yaz
- **Yanlis yorum > yorum yok**: Yanlis yorum tehlikelidir, guncellenmeyen yorum sil

```typescript
// YANLIS: Ne yaptigini anlatiyor (gereksiz)
// Kullanici adini buyuk harfe cevir
const name = user.name.toUpperCase();

// DOGRU: Neden yapildigini anlatiyor
// Legacy API buyuk harf bekliyor, v3'te kaldirilacak
const name = user.name.toUpperCase();
```

## function vs Arrow Function

| Durum | Tercih | Neden |
|-------|--------|-------|
| Exported fonksiyon | `function` declaration | Hoisted, debug stack trace'de gorunur |
| React component | `function` declaration | Tutarlilik, DevTools'da isim gorunur |
| Callback, inline | Arrow `=>` | Kisa, this binding yok |
| Method | Arrow (class field) | this binding garantili |

```typescript
// DOGRU: Exported fonksiyon
export function calculateTotal(items: Item[]): number {
  return items.reduce((sum, item) => sum + item.price, 0);
}

// DOGRU: Callback
const filtered = items.filter(item => item.active);
```

## Anti-Patterns

| Anti-Pattern | Cozum |
|-------------|-------|
| Magic number | Named constant kullan |
| God class/function | Parcala, tek sorumluluk |
| console.log debug | Logger kullan, commit etme |
| Hardcoded values | Config/env variable |
| Any type | Specific type tanimla |
