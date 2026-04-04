---
name: subscription-pricing
description: Abonelik fiyatlama stratejileri. 3-tier framework, price anchoring, charm pricing, regional pricing (18 ulke), introductory offers, win-back campaigns, churn prevention ve A/B testing methodology.
---

# Subscription Pricing

## 3-Tier Framework

### Tier Yapisi

```
GOOD (Free/Basic)          BETTER (Pro/Premium)       BEST (Team/Enterprise)
─────────────────          ────────────────────       ─────────────────────
Hook: Aliskanllik          Hook: Guclu deger          Hook: Olceklenebilirlik
olusturma                  teklifi

Core feature'lar           Tum GOOD +                 Tum BETTER +
Sinirli kullanim           Sinrsiz kullanim           Takim ozellikleri
Reklam (opsiyonel)         Reklamsiz                  Oncelikli destek
                           Premium feature'lar        API erisimi

Amac: Aktivasyon           Amac: Monetizasyon         Amac: Expansion
```

### Pricing Rules

1. **BETTER, GOOD'un 3-5 kati degeri hissettirmeli** ama 2-3 kati fiyatinda olmali
2. **BEST, BETTER'in 1.5-2 kati fiyatinda** ama 3+ kisi icin daha ucuz (per-seat)
3. **GOOD yeterince iyi olmali** ki kullanici aktivasyona ulassin
4. **BETTER cazip olmali** ki GOOD'da kalmak "kayip" hissi versin

### Ornek Fiyatlandirma

**Fitness App:**
```
Free:    Temel antrenmanlar, 3 kayit/hafta
Pro:     $9.99/ay | $59.99/yil  - Sinrsiz antrenman, ilerleme takibi, plan olusturma
Premium: $19.99/ay | $119.99/yil - Kisisel antrenor AI, beslenme plani, video analiz
```

**Productivity App:**
```
Free:    5 proje, temel gorevler
Pro:     $4.99/ay | $39.99/yil  - Sinrsiz proje, takvim, hatirlatma, tema
Team:    $8.99/kullanici/ay     - Takm paylasimi, admin panel, SSO
```

**AI Tool:**
```
Free:    10 istek/gun
Pro:     $9.99/ay | $79.99/yil  - 500 istek/gun, gelismis modeller
Business: $29.99/ay | $249.99/yil - Sinrsiz, API, oncelikli islem
```

---

## Price Anchoring & Decoy Effect

### Anchoring Sirasi (Yuksekten Dusuge)

Paywall'da planlari su sirada goster:
```
[1] Annual  $79.99/yil  ($6.67/ay)  ← VURGULA: "Most Popular", "Best Value"
[2] Monthly $12.99/ay               ← Karsilastirma noktasi
[3] Weekly  $4.99/hafta ($21.56/ay) ← Decoy: monthly'yi ucuz gosterir
```

Weekly plan, monthly'yi ucuz gostermek icin VAR. Asil hedef annual.

### Decoy Effect Ornegi

```
          Fiyat     Ozellik      Rol
─────────────────────────────────────
Basic     $4.99/ay  5 proje     Decoy (Pro'yu degerlendirmek icin)
Pro       $9.99/ay  Sinrsiz     HEDEF (cogu kullanici buraya)
Premium   $14.99/ay Sinrsiz+AI  Anchor (Pro'yu ucuz gosterir)
```

---

## Charm Pricing

| Yanlis | Dogru | Neden |
|--------|-------|-------|
| $10.00/ay | $9.99/ay | Sol rakam etkisi (%8 daha yuksek conversion) |
| $50/yil | $49.99/yil | Psikolojik esik asilmiyor |
| $5/ay | $4.99/ay | 1 cent fark, algida buyuk |

### Per-Day Framing

| Fiyat | Frame | Etki |
|-------|-------|------|
| $49.99/yil | "Gunluk sadece 14 sent" | Ucuz algilanir |
| $9.99/ay | "Gunluk 33 sent - bir kahveden ucuz" | Karsilastirma etkisi |
| $79.99/yil | "Haftalik $1.54 - Netflix'ten ucuz" | Bilinen referans |

---

## Regional Pricing (18 Ulke Detay)

| Ulke | PPP Carpani | $9.99 ABD Karsiligi | App Store Tier |
|------|-------------|---------------------|----------------|
| ABD | 1.00 | $9.99 | Tier 10 |
| Kanada | 0.95 | $9.49 | Tier 10 |
| UK | 0.90 | $8.99 | Tier 9 |
| Almanya | 0.90 | $8.99 | Tier 9 |
| Fransa | 0.90 | $8.99 | Tier 9 |
| Avustralya | 0.95 | $9.49 | Tier 10 |
| Japonya | 0.85 | $8.49 | Tier 9 |
| Guney Kore | 0.80 | $7.99 | Tier 8 |
| Polonya | 0.55 | $5.49 | Tier 6 |
| Turkiye | 0.30 | $2.99 | Tier 3 |
| Brezilya | 0.40 | $3.99 | Tier 4 |
| Hindistan | 0.25 | $2.49 | Tier 2 |
| Meksika | 0.45 | $4.49 | Tier 5 |
| Endonezya | 0.30 | $2.99 | Tier 3 |
| Filipinler | 0.35 | $3.49 | Tier 4 |
| Vietnam | 0.25 | $2.49 | Tier 2 |
| Misir | 0.30 | $2.99 | Tier 3 |
| Nijerya | 0.25 | $2.49 | Tier 2 |

**Uygulama**: RevenueCat Offerings + country-based routing

---

## Introductory Offers

### Free Trial
```
Tip: Belirli sure ucretsiz, sonra otomatik ucretli
Sure: 3/7/14/30 gun (kategoriye gore)
Avantaj: En yuksek conversion
Risk: "Trial abuser" (surekli yeni hesap)
Onlem: Device fingerprint + account limit
```

### Pay-Up-Front (Introductory Price)
```
Tip: Ilk donem indirimli (ornek: ilk ay $1.99, sonra $9.99)
Avantaj: Hemen gelir, commitment gosterir
Risk: Ilk donem sonunda yuksek churn
Ornek: "$0.99 ilk hafta, sonra $4.99/hafta"
```

### Pay-As-You-Go
```
Tip: Her donem indirimli, giderek artan (ornek: $2.99, $4.99, $6.99, sonra $9.99)
Avantaj: Yavas fiyat alistirmasi
Risk: Karmasik, kullanici karisabilir
Kullanim: Nadir, genelde streaming/news
```

---

## Win-Back Campaigns

### Lapsed User Segmentleri

| Segment | Tanim | Strateji | Indirim |
|---------|-------|----------|---------|
| Yeni churn | 1-7 gun once iptal | Neden sorusu + ozel teklif | %30 |
| Orta churn | 7-30 gun | Yeni feature duyurusu + indirim | %40 |
| Eski churn | 30-90 gun | Agresif teklif + ucretsiz deneme | %50 veya 1 ay free |
| Kayip | 90+ gun | Son sans teklifi | %60 veya lifetime deal |

### Win-Back Akisi

```
IPTAL ANI
  └─ In-app survey: "Neden ayriliyorsunuz?"
     ├─ "Cok pahali" → Hemen %30 indirim teklifi
     ├─ "Kullanmiyorum" → Feature rehberi + 7 gun ucretsiz uzatma
     ├─ "Alternatif buldum" → Karsilastirma + exclusive feature
     └─ "Diger" → Genel %20 indirim

IPTAL + 3 GUN
  └─ Push: "Seni ozledik - %30 indirim"

IPTAL + 7 GUN
  └─ Email: "Premium ozelliklerin hala seni bekliyor"

IPTAL + 14 GUN
  └─ Push: "Son sansimiz: 1 ay ucretsiz"

IPTAL + 30 GUN
  └─ Email: "Geri gel, yeni ozellikler eklendi" + %50 indirim

IPTAL + 90 GUN
  └─ Push: "Ozel teklif: yillik plan %60 indirimli"
```

---

## Churn Prevention

### Grace Period
- Odeme basarisiz olunca HEMEN kesme
- 3-16 gun grace period (platform'a gore)
- Bu surede billing retry yapilir (Apple: 60 gun icinde 6 deneme)
- Kullaniciya "Odeme bilgilerinizi guncelleyin" bildirimi gonder

### Billing Retry Strategy
```
Retry 1: +1 gun sonra (otomatik)
Retry 2: +3 gun sonra → Push notification: "Odeme sorunu"
Retry 3: +7 gun sonra → Email: "Aboneliginiz risk altinda"
Retry 4: +14 gun sonra → In-app banner: "Odeme bilgilerini guncelle"
Retry 5: +30 gun sonra → Son email: "Aboneliginiz iptal edilecek"
Retry 6: +60 gun sonra → Son deneme, basarisizsa EXPIRATION
```

### Proactive Churn Signals

| Sinyal | Risk Seviyesi | Aksiyon |
|--------|--------------|---------|
| 7+ gun inaktif | YUKSEK | Push: "Kacirdigin sey..." |
| Feature kullanimi %50 dustu | ORTA | In-app tip: "Bunu denedin mi?" |
| Trial bitimine 2 gun, inaktif | YUKSEK | Push: "Trial'in bitiyor, degerlendir!" |
| Monthly 3+ ay, annual'a gecmedi | DUSUK | In-app: "Annual'a gec, %50 tasarruf" |
| Billing issue | KRITIK | Push + Email + In-app banner |

---

## A/B Testing Methodology

### Test Edilecekler (Oncelik Sirasi)

1. **Fiyat testi**: $X.99 vs $Y.99 (en yuksek etki)
2. **Trial suresi**: 3 gun vs 7 gun
3. **Plan yapisi**: 2 plan vs 3 plan
4. **CTA copy**: "Start Free Trial" vs "Try Premium Free"
5. **Paywall placement**: Onboarding vs Feature-gate
6. **Design**: Minimalist vs detayli karsilastirma tablosu

### Sample Size Hesabi

```
Minimum kullanici/varyant = 16 * p * (1-p) / MDE^2

p = baseline conversion rate
MDE = minimum detectable effect (ornek: %10 iyilesme)

Ornek:
- Baseline: %10 trial-to-paid
- MDE: %10 relative improvement (yeni rate: %11)
- Minimum: 16 * 0.10 * 0.90 / 0.01^2 = 14,400 kullanici/varyant
- Toplam: ~29,000 kullanici
```

### Test Suresi

| Gunluk traffic | Minimum sure | Ideal sure |
|----------------|-------------|-----------|
| 100 kullanici | 5-6 ay (YAPMA, yeterli traffic yok) | - |
| 500 kullanici | 2 ay | 3 ay |
| 1,000 kullanici | 1 ay | 6 hafta |
| 5,000+ kullanici | 1-2 hafta | 4 hafta |

### RevenueCat Experiments

```json
{
  "experiment_id": "pricing_test_q1",
  "variants": [
    {
      "id": "control",
      "offering_id": "default",
      "weight": 50
    },
    {
      "id": "higher_price",
      "offering_id": "premium_pricing",
      "weight": 50
    }
  ],
  "metrics": ["trial_conversion", "paid_conversion", "revenue_per_user", "ltv_30d"]
}
```

### Basari Kriterleri

| Metrik | Oncelik | Neden |
|--------|---------|-------|
| Revenue per user | 1 | Nihai olcu |
| LTV (30/60/90 gun) | 2 | Uzun vadeli saglik |
| Trial-to-paid | 3 | Funnel sagligi |
| Install-to-trial | 4 | Ilk ilgi |
| Churn rate | 5 | Retention |

**ONEMLI**: Trial-to-paid yukseldi ama LTV dustuyse, test BASARISIZ. LTV her zaman conversion'dan oncelikli.
