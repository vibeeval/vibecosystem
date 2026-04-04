---
name: paywall-optimizer
description: AI-powered paywall optimizasyon. Sektore gore otomatik analiz, A/B test senaryolari, churn prediction sinyalleri, push notification stratejileri, agresif satis teknikleri ve RevenueCat Experiments entegrasyonu. paywall-strategy, revenuecat-patterns ve subscription-pricing skill'lerinin ustune insa eder.
---

# Paywall Optimizer (AI Layer)

Bu skill, mevcut paywall-strategy, revenuecat-patterns ve subscription-pricing skill'lerinin ustune AI-powered optimizasyon katmani ekler.

## Sektore Gore Otomatik Analiz Pipeline

### Input
```
1. App kategorisi (orn: "Health & Fitness")
2. Core feature listesi (orn: ["antrenman plani", "kalori takibi", "ilerleme grafigi"])
3. Mevcut metrikler (varsa): DAU, MAU, trial rate, conversion rate, ARPU, churn
4. Hedef kitle (orn: "25-35 yas, fitness meraklisi, orta gelir")
5. Platform (iOS, Android, both)
6. Rakipler (orn: ["MyFitnessPal", "Nike Training Club"])
```

### Process
```
1. paywall-strategy skill'inden kategori benchmark'ini cek
2. Benchmark vs mevcut metrikleri karsilastir (gap analizi)
3. subscription-pricing skill'inden optimal fiyat araligini hesapla
4. Rakip fiyatlarini ve modellerini karsilastir
5. Sektore ozgu oneri raporu olustur
```

### Output
```
ANALIZ RAPORU:
- Kategori benchmark ozeti
- Gap analizi (mevcut vs benchmark)
- Onerilen model + fiyatlama
- ROI projeksiyonu (3/6/12 ay)
```

---

## A/B Test Senaryolari

### Hazir Test Seti (6 Senaryo)

#### Senaryo 1: Fiyat Testi
```
Hipotez: Daha yuksek fiyat, LTV'yi artirirken conversion'i fazla dusurmuyor
Control: $9.99/ay, $49.99/yil
Variant A: $12.99/ay, $69.99/yil
Variant B: $7.99/ay, $39.99/yil
Metrik: Revenue per user (birincil), Trial-to-paid (ikincil)
Sure: Min 4 hafta, ideal 6 hafta
Sample: Min 5,000 kullanici/varyant
```

#### Senaryo 2: Trial Suresi Testi
```
Hipotez: Kisa trial aciliyet yaratir, conversion arttirir
Control: 7 gun free trial
Variant A: 3 gun free trial
Variant B: 14 gun free trial
Metrik: Trial-to-paid (birincil), 30-gun retention (ikincil)
Sure: Min 6 hafta (trial suresinin 3 kati)
Sample: Min 3,000 kullanici/varyant
```

#### Senaryo 3: Copy/Mesaj Testi
```
Hipotez: Benefit-focused copy, feature-focused'dan daha iyi donusturuyor
Control: "Premium ozelliklerin kilidi acilin" (feature-focused)
Variant A: "Hedeflerinize 2x daha hizli ulasin" (benefit-focused)
Variant B: "50,000+ kullanici Premium'u seciyor" (social proof)
Metrik: Paywall-to-trial (birincil)
Sure: Min 2 hafta
Sample: Min 2,000 kullanici/varyant
```

#### Senaryo 4: Plan Yapisi Testi
```
Hipotez: 3 plan decoy effect ile ana planin conversion'ini arttirir
Control: 2 plan (Monthly + Annual)
Variant: 3 plan (Weekly + Monthly + Annual)
Metrik: Annual plan conversion (birincil), Overall revenue (ikincil)
Sure: Min 4 hafta
Sample: Min 4,000 kullanici/varyant
```

#### Senaryo 5: CTA Testi
```
Hipotez: Daha spesifik CTA metni conversion arttirir
Control: "Start Free Trial"
Variant A: "Try Premium Free for 7 Days"
Variant B: "Unlock All Features - Free"
Variant C: "Get Started - No Payment Now"
Metrik: CTA click rate (birincil), Trial start rate (ikincil)
Sure: Min 2 hafta
Sample: Min 1,500 kullanici/varyant
```

#### Senaryo 6: Paywall Placement Testi
```
Hipotez: Event-triggered paywall onboarding'den daha iyi donusturuyor
Control: Onboarding paywall (kayit sonrasi hemen)
Variant A: Feature-gate (premium feature'a tiklandiginda)
Variant B: Session-count (3. oturum sonrasi)
Variant C: Event-triggered (ilk basari/milestone aninda)
Metrik: Overall conversion (birincil), 60-gun LTV (ikincil)
Sure: Min 6 hafta
Sample: Min 3,000 kullanici/varyant
```

### RevenueCat Experiments Entegrasyonu

```json
{
  "experiment": {
    "name": "pricing_test_2024_q2",
    "hypothesis": "Higher annual price increases revenue without significant conversion drop",
    "variants": [
      {
        "id": "control",
        "offering_id": "default",
        "weight": 50
      },
      {
        "id": "higher_annual",
        "offering_id": "premium_annual_test",
        "weight": 50
      }
    ],
    "success_metrics": [
      { "name": "revenue_per_user", "priority": 1 },
      { "name": "trial_to_paid", "priority": 2 },
      { "name": "ltv_60d", "priority": 3 }
    ],
    "guardrail_metrics": [
      { "name": "install_to_trial", "threshold": "no_decrease_beyond_10pct" }
    ],
    "minimum_duration_days": 28,
    "minimum_sample_per_variant": 5000
  }
}
```

---

## Churn Prediction Sinyalleri

### YUKSEK RISK (Hemen aksiyon gerekli)

| Sinyal | Tespit | Aksiyon |
|--------|--------|---------|
| 7+ gun inaktif | DAU tracking | Push: "Kacirdigin sey..." + feature highlight |
| Billing retry #2+ | RevenueCat BILLING_ISSUE webhook | Push + Email: "Odeme bilgilerini guncelle" |
| App uninstall | Attribution service (Adjust/Branch) | Email: win-back + ozel indirim (3 gun icinde) |
| Support ticket (billing) | Helpdesk integration | Otomatik: grace period uzat + ozel teklif |
| Trial bitmesine 1 gun, hic kullanmamis | Trial aktivasyon tracking | Push: "Trial'in yarin bitiyor! Hala denemedin: X" |

### ORTA RISK (Izle + nudge)

| Sinyal | Tespit | Aksiyon |
|--------|--------|---------|
| Haftalik kullanim %50 dustu | Session frequency | In-app: "Bu haftanin yeni ozelligi: X" |
| Premium feature kullanimi azaldi | Feature analytics | Push: "Biliyor muydun? X ozelligi ile..." |
| Push notification kapatti | Notification permission | In-app banner: "Bildirimleri ac, firsatlari kacirma" |
| Trial bitmesine 3 gun, dusuk kullanim | Trial engagement score | Push: "Trial'ini en iyi degerlendirmek icin 3 ipucu" |
| Cancel sayfasini ziyaret etti (iptal etmedi) | Page view tracking | In-app: "Sorun mu var? Yardimci olalim" |

### DUSUK RISK (Optimize et)

| Sinyal | Tespit | Aksiyon |
|--------|--------|---------|
| Monthly 3+ ay, annual'a gecmedi | Subscription type check | In-app: "Annual'a gec, ayda $X tasarruf et" |
| Referral gondermiyor | Referral tracking | In-app: "Arkadasini davet et, 1 ay ucretsiz kazan" |
| Yeni feature'lari denemiyor | Feature adoption | In-app: tooltip/onboarding |
| Tek cihaz kullanimi (multi-device destegine ragmen) | Device tracking | Push: "Diger cihazlarinda da kullan" |

### Composite Risk Score

```
risk_score = (
  inactivity_days * 0.30 +
  usage_decline_pct * 0.25 +
  billing_issue * 0.20 +
  trial_engagement * 0.15 +
  support_tickets * 0.10
)

YUKSEK:  risk_score > 0.7 → Immediate intervention
ORTA:    0.4 < risk_score <= 0.7 → Proactive nudge
DUSUK:   risk_score <= 0.4 → Standard optimization
```

---

## Push Notification Stratejileri

### Trial Lifecycle

```
GUN 0 (Baslangic):
  "Hosgeldin! Premium ozelliklerin seni bekliyor. Baslayalim mi?"
  [Deep link: Core premium feature]

GUN 1:
  "Ilk gununde X kisiyle birlikte basladiniz! En populer ozellik: Y"
  [Deep link: Most-used premium feature]

GUN 3:
  "Trial'inin yarisini gectin. Hala denemedin: Z ozelligi"
  [Deep link: Unused premium feature]

GUN 5 (7 gunluk trial icin):
  "Trial'in 2 gun sonra bitiyor. Simdi premium'a gec, %20 indirim"
  [Deep link: Paywall with discount]

GUN 6:
  "Son gun! Yarin premium ozellikler kapanacak."
  [Deep link: Paywall with urgency]

GUN 7 (Trial bitis):
  "Trial'in bitti ama sana ozel teklifimiz var: ilk ay %30 indirimli"
  [Deep link: Paywall with special offer]
```

### Win-Back (Churn Sonrasi)

```
EXPIRE + 1 GUN:
  "Premium ozelliklerin artik aktif degil. Hala geri donebilirsin!"
  [Deep link: Paywall]

EXPIRE + 3 GUN:
  "Seni ozledik - %30 indirimle geri don"
  [Deep link: Paywall with 30% discount]

EXPIRE + 7 GUN:
  "Bu hafta eklenen yeni ozellikler: [feature list]"
  [Deep link: What's new page + paywall]

EXPIRE + 14 GUN:
  "Son sansimiz: 1 ay tamamen ucretsiz"
  [Deep link: Paywall with 1 month free]

EXPIRE + 30 GUN:
  "Cok sey degisti! Geri gel, yillik plan %50 indirimli"
  [Deep link: Paywall with 50% annual discount]

EXPIRE + 90 GUN:
  "Ozel teklif: Lifetime erken erisim (sinirli)"
  [Deep link: Lifetime deal page]
```

### Engagement (Churn Prevention)

```
INAKTIF + 2 GUN:
  "Bugun X icin iyi bir gun! [contextual message]"
  [Deep link: Relevant feature]

INAKTIF + 5 GUN:
  "Bu hafta 10,000 kisi [action] yapti. Sen de katil!"
  [Deep link: Social proof + feature]

INAKTIF + 10 GUN:
  "Sana ozel bir sey hazirladik: [surprise feature/content]"
  [Deep link: Exclusive content]

BASARI ANINDA (Event-triggered):
  "Tebrikler! [milestone] tamamladin. Devam et: [next challenge]"
  [Deep link: Next feature/challenge]
```

### Notification Kurallari

```
FREQUENCY CAP:
- Gunluk max: 1 notification
- Haftalik max: 3 notification
- "Do Not Disturb" saatleri: 22:00-08:00 (lokal saat)

OPTIMAL SAATLER:
- B2C: 09:00-10:00, 12:00-13:00, 19:00-20:00
- Games: 19:00-21:00 (aksam bos zamanlar)
- Fitness: 06:00-07:00, 17:00-18:00 (antrenman saatleri)
- Productivity: 09:00-10:00 (is baslangiclari)

PERSONALIZASYON:
- Kullanicinin en aktif oldugu saatte gonder
- En cok kullandigi feature'i referans al
- Ismine hitap et (varsa)
```

---

## "Kapali Carsi Esnafi" Agresif Satis Teknikleri

### FOMO (Fear of Missing Out)

```
UYGULAMALAR:
- "Bu ay 12,000 kisi premium'a gecti" (rakam guncellenmeli)
- "Bu ozellik sadece premium kullanicilar icin"
- "Sinirli sureli: yillik plan %50 indirimli"
- "Early adopter fiyati: ayda sadece $X.99 (sonra $Y.99 olacak)"

ETIK SINIR:
[OK]  Gercek rakamlar kullanmak
[OK]  Gercek sinirli sureli kampanyalar
[X]   Sahte rakamlar uydurmak
[X]   Sahte countdown (her seferinde sifirlanan)
[X]   "Son 3 kisilik kota" (uretim olmayan kitlik)
```

### Scarcity (Kitlik)

```
UYGULAMALAR:
- Seasonal kampanya: "Yaz indirimi: 72 saat kaldi"
- Ilk N abone ozel fiyat: "Ilk 1000 abone icin $3.99/ay"
- Launch pricing: "Bu ay ozel lansman fiyati"
- Bundle deal: "Bu hafta sonu: yillik + bonus icerik"

ETIK SINIR:
[OK]  Gercek kampanya son tarihi
[OK]  Gercek kota siniri (ve dolunca kapanmali!)
[X]   Her gun sifirlanan "son 24 saat"
[X]   Asla dolmayan "sinirli kontenjan"
```

### Social Proof

```
UYGULAMALAR:
- App Store rating badge: "4.8/5 - 50K+ degerlendirme"
- Kullanici sayisi: "2M+ kullanici Premium'u seciyor"
- Testimonial: "Bu uygulama hayatimi degistirdi - Ahmet, Istanbul"
- Expert endorsement: "[Uzman ismi] tarafindan oneriliyor"
- Media mention: "App Store Editoru'nun Secimi"

DIKKAT:
- Gercek review'lari kullan, uydurma YAPMA
- Rakamlar guncel olmali (yilda 1 guncelle minimum)
```

### Reciprocity (Karsiliklilik)

```
UYGULAMALAR:
- Ilk feature-gate'te: "Bu sefer ucretsiz gosterelim" → sonraki seferde gate
- Bonus icerik: "Premium kullanicilara ozel rehber hediye"
- Tasarruf gosterme: "Bu ay $12.50 tasarruf ettin (premium ile)"
- Kisisel rapor: "Haftalik ilerleme raporun hazir" (premium feature)

MANTIK:
Once deger ver → sonra iste. Kullanici "borclu" hisseder.
```

### Urgency (Aciliyet)

```
UYGULAMALAR:
- Trial countdown: "Premium erisimin 2 gun sonra kapaniyor"
- Indirim suresi: "Bu teklif 48 saat gecerli"
- Yeni fiyat duyurusu: "Mevcut fiyattan son sans (Ocak'ta zam geliyor)"
- Limited feature: "Bu icerik 7 gun boyunca ucretsiz"

ETIK SINIR:
[OK]  Gercek countdown (trial bitisi)
[OK]  Gercek fiyat degisikligi duyurusu
[X]   Her giriste sifirlanan countdown
[X]   Sahte "zam geliyor" duyurusu
```

### APPLE/GOOGLE COMPLIANCE UYARILARI

```
APPLE RED FLAGS (REJECT NEDENLERI):
- Toggle paywall (Ocak 2026'dan beri reject)
- Dismiss butonu olmayan veya cok kucuk dismiss butonu
- Sahte scarcity/countdown
- Abonelik sartlarini gizleme
- Dark pattern: "X" butonunu sag ustte kuculme

GOOGLE RED FLAGS:
- Yaniltici abonelik ifadeleri
- Gizli ucretler
- Karmasik iptal sureci
- Kullaniciyi yaniltici UI

GENEL KURAL:
Agresif ol ama DURUST ol. "Kapali carsi esnafi" urunu OVUYOR,
urun hakkinda YALAN SOYLEMEZ. Ikisi arasindaki cizgiyi gec.
```

---

## Metrik Takip Dashboard

### Gunluk Takip

| Metrik | Formul | Hedef |
|--------|--------|-------|
| Install-to-trial | trial_starts / installs | >10% |
| Trial-to-paid | conversions / trial_starts | >25% |
| First renewal rate | renewed / first_period_ends | >70% |
| Revenue per install | total_revenue / installs | Kategoriye gore |
| Paywall view-to-trial | trial_starts / paywall_views | >15% |

### Haftalik Takip

| Metrik | Formul | Hedef |
|--------|--------|-------|
| MRR | sum(active_subscriptions * price) | Artan trend |
| Churn rate | cancelled / total_active | <5%/ay |
| ARPU | revenue / active_users | Artan trend |
| Trial engagement score | actions_during_trial / total_trialists | >50% |

### Aylik Takip

| Metrik | Formul | Hedef |
|--------|--------|-------|
| LTV (30/60/90 gun) | cumulative_revenue_per_cohort | Artan trend |
| Net revenue retention | MRR_end / MRR_start (expansion dahil) | >100% |
| CAC payback period | CAC / monthly_revenue_per_user | <3 ay |
| Win-back conversion | resubscribers / churned_users | >5% |
