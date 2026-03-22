---
name: design-system-generator
description: Generate design systems with color palettes, typography, spacing scales, component tokens, and Tailwind config
---

# Design System Generator

Input'a gore tutarli design system uret. 3-layer token mimarisi.

## Input

Asagidaki bilgileri iste veya cikar:
- **Product type**: SaaS, e-commerce, blog, dashboard, mobile app
- **Industry**: Fintech, healthcare, education, developer tools, etc.
- **Style preference**: Minimal, bold, playful, corporate, dark-first
- **Brand colors** (varsa): Primary HEX, secondary HEX
- **Font preference** (varsa): Sans-serif, serif, mono

## 3-Layer Token Architecture

### Layer 1: Primitive Tokens (Ham degerler)

```css
/* Primitive - ASLA direkt kullanilmaz */
--color-blue-50: #eff6ff;
--color-blue-100: #dbeafe;
--color-blue-500: #3b82f6;
--color-blue-600: #2563eb;
--color-blue-700: #1d4ed8;
--color-blue-900: #1e3a5f;

--color-gray-50: #f9fafb;
--color-gray-100: #f3f4f6;
--color-gray-200: #e5e7eb;
--color-gray-300: #d1d5db;
--color-gray-500: #6b7280;
--color-gray-700: #374151;
--color-gray-900: #111827;

--color-green-500: #22c55e;
--color-red-500: #ef4444;
--color-yellow-500: #eab308;
```

### Layer 2: Semantic Tokens (Anlam tasiyan)

```css
/* Light mode */
--color-primary: var(--color-blue-600);
--color-primary-hover: var(--color-blue-700);
--color-primary-subtle: var(--color-blue-50);

--color-danger: var(--color-red-500);
--color-success: var(--color-green-500);
--color-warning: var(--color-yellow-500);

--color-text-primary: var(--color-gray-900);
--color-text-secondary: var(--color-gray-500);
--color-text-muted: var(--color-gray-300);

--color-bg-primary: #ffffff;
--color-bg-secondary: var(--color-gray-50);
--color-bg-tertiary: var(--color-gray-100);

--color-border: var(--color-gray-200);
--color-border-strong: var(--color-gray-300);
```

```css
/* Dark mode */
.dark {
  --color-primary: var(--color-blue-500);
  --color-primary-hover: var(--color-blue-600);
  --color-primary-subtle: var(--color-blue-900);

  --color-text-primary: var(--color-gray-50);
  --color-text-secondary: var(--color-gray-300);
  --color-text-muted: var(--color-gray-500);

  --color-bg-primary: var(--color-gray-900);
  --color-bg-secondary: #1a1a2e;
  --color-bg-tertiary: var(--color-gray-700);

  --color-border: var(--color-gray-700);
  --color-border-strong: var(--color-gray-500);
}
```

### Layer 3: Component Tokens (Kullanim yeri)

```css
/* Button */
--btn-primary-bg: var(--color-primary);
--btn-primary-hover: var(--color-primary-hover);
--btn-primary-text: #ffffff;
--btn-secondary-bg: transparent;
--btn-secondary-border: var(--color-border-strong);
--btn-danger-bg: var(--color-danger);

/* Input */
--input-bg: var(--color-bg-primary);
--input-border: var(--color-border);
--input-border-focus: var(--color-primary);
--input-text: var(--color-text-primary);
--input-placeholder: var(--color-text-muted);

/* Card */
--card-bg: var(--color-bg-primary);
--card-border: var(--color-border);
--card-shadow: 0 1px 3px rgb(0 0 0 / 0.1);
```

## Typography System

| Eleman | Font | Weight | Size | Line Height |
|--------|------|--------|------|-------------|
| Display | Primary | 700 | 3rem (48px) | 1.1 |
| H1 | Primary | 600 | 2.25rem (36px) | 1.2 |
| H2 | Primary | 600 | 1.5rem (24px) | 1.25 |
| H3 | Primary | 500 | 1.25rem (20px) | 1.3 |
| Body | Primary | 400 | 1rem (16px) | 1.5 |
| Small | Primary | 400 | 0.875rem (14px) | 1.4 |
| Caption | Primary | 400 | 0.75rem (12px) | 1.3 |

### Font Pairing Onerileri

| Industry | Heading | Body | Karakter |
|----------|---------|------|----------|
| SaaS / Tech | Inter | Inter | Temiz, notr |
| Fintech | DM Sans | DM Sans | Guvenir, profesyonel |
| Healthcare | Source Sans Pro | Source Sans Pro | Okunabilir, sicak |
| Education | Nunito | Open Sans | Samimi, erisilebilir |
| Dev Tools | JetBrains Mono | Inter | Teknik, modern |
| Luxury | Playfair Display | Lato | Sofistike, zarif |

## Spacing Scale (4px base)

```
Token    Value    Use Case
xs       4px      Icon gap, compact badges
sm       8px      Input padding-y, small gaps
md       12px     Button padding-y
base     16px     Card padding, standard gap
lg       24px     Section padding, comfortable gap
xl       32px     Section gap
2xl      48px     Page section gap
3xl      64px     Hero padding
```

## Tailwind Config Ciktisi

```typescript
// tailwind.config.ts
import type { Config } from 'tailwindcss'

export default {
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: 'var(--color-primary)',
          hover: 'var(--color-primary-hover)',
          subtle: 'var(--color-primary-subtle)',
        },
        danger: { DEFAULT: 'var(--color-danger)' },
        success: { DEFAULT: 'var(--color-success)' },
        warning: { DEFAULT: 'var(--color-warning)' },
        surface: {
          DEFAULT: 'var(--color-bg-primary)',
          secondary: 'var(--color-bg-secondary)',
          tertiary: 'var(--color-bg-tertiary)',
        },
      },
      borderColor: {
        DEFAULT: 'var(--color-border)',
        strong: 'var(--color-border-strong)',
      },
      textColor: {
        primary: 'var(--color-text-primary)',
        secondary: 'var(--color-text-secondary)',
        muted: 'var(--color-text-muted)',
      },
    },
  },
} satisfies Config
```

## Checklist

- [ ] Primitive token'lar tanimli
- [ ] Semantic token'lar tanimli (light + dark)
- [ ] Component token'lar tanimli
- [ ] Typography scale tanimli
- [ ] Spacing scale tanimli
- [ ] Tailwind config uretildi
- [ ] Kontrast oranlar kontrol edildi (min 4.5:1)
- [ ] Dark mode token'lari dogru
