---
name: reverse-document
description: Generate design docs, ADRs, and concept docs from existing code by reverse engineering intent
---

# Reverse Document

Koddan dokuman uret. "Bu sistem neden var?" sorusunu cevapla.

## 3 Mod

### 1. Design Mode (Koddan GDD/PRD)

Mevcut kodu analiz ederek tasarim dokumani uret.

**Input**: Kaynak kod dizini veya dosya
**Output**: Product/Feature Design Document

Sablonlu cikti:
```markdown
# [Feature/System Adi]

## Problem Statement
Bu sistem hangi problemi cozuyor?

## Solution Overview
Nasil cozuyor? (High-level mimari)

## Key Decisions
Neden bu yaklasim secildi? (Koddan cikarim)

## Components
- [Component 1]: Gorevi, bagimliliklari
- [Component 2]: Gorevi, bagimliliklari

## Data Flow
1. [Adim 1]
2. [Adim 2]

## Edge Cases & Error Handling
Kodda gorulmus ozel durumlar

## Limitations
Bilinen sinirlamalar (TODO/FIXME/HACK yorumlarindan)
```

### 2. Architecture Mode (Koddan ADR)

Mimari kararlari reverse engineer ederek ADR (Architecture Decision Record) uret.

**Input**: Kaynak kod, config dosyalari, dependency listesi
**Output**: ADR dokumenti

Sablonlu cikti:
```markdown
# ADR-[N]: [Karar Basligi]

## Status
Accepted (kodda uygulanmis)

## Context
Bu karar hangi kosullarda alinmis? (Koddan cikarim)

## Decision
Ne yapilmis? (Concrete implementation)

## Rationale
Neden? (Dependency secimleri, pattern kullanimi, config'den cikarim)

## Alternatives Considered
Kullanilmayan alternatifler (varsa yorum/TODO'lardan)

## Consequences
- Pozitif: [...]
- Negatif: [...]
- Riskler: [...]
```

### 3. Concept Mode (Prototypeden Concept Doc)

Erken asamadaki koddan konsept dokumani uret.

**Input**: Prototip/POC kodu
**Output**: Concept Document

Sablonlu cikti:
```markdown
# [Konsept Adi]

## One-Liner
Tek cumlelik aciklama

## Problem
Hangi problemi cozuyor?

## Proposed Solution
Prototipte denenmis yaklasim

## Key Insights
Prototipten ogrenilenler

## Open Questions
Henuz cevaplanmamis sorular

## Next Steps
Production'a tasimak icin gerekli adimlar
```

## Intent Sorulari

Kodu okumadan ONCE su sorulari sor (veya koddan cikar):

1. **Neden var?** Bu sistem/modul/fonksiyon hangi problemi cozuyor?
2. **Kim kullaniyor?** Hedef kullanici/consumer kim?
3. **Alternatifler?** Baska yaklasimlar dusunulmus mu? (Yorumlar, git history)
4. **Sinirlamalar?** Bilinen kisitlamalar ne? (TODO, FIXME, HACK)
5. **Evrim?** Zaman icinde nasil degismis? (git log --oneline)

## Workflow

1. **Scan**: Dosya yapisini, dependency'leri, config'leri tara
2. **Read**: Ana dosyalari oku, entry point'ten basla
3. **Trace**: Data flow'u takip et (input -> process -> output)
4. **Extract**: Pattern'leri, kararlari, edge case'leri cikar
5. **Question**: Intent sorularini cevapla (koddan veya kullanicidan)
6. **Write**: Secilen mod sablonuna gore dokumani yaz
7. **Review**: Kullaniciyla birlikte dogrula

## Kurallar

- Spekuasyon yapma, kodda gordugun seyi yaz
- "Muhtemelen" yerine "Kodda goruldugu uzere" kullan
- Git history varsa kararlarin kronolojisini ekle
- TODO/FIXME/HACK yorumlarini "Limitations" bolumune ekle
- Kodda olmayan seyi dokumante etme
