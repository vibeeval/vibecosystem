---
name: paywall-strategy
description: Mobil uygulama paywall strateji rehberi. 14 kategori benchmark database, 4 paywall modeli, trial optimizasyonu, placement mapping, pricing psychology, regional pricing (PPP) ve Apple/Google compliance checklist.
---

# Paywall Strategy

## Paywall Modelleri

### Hard Paywall
- **Tanim**: Uygulamayi kullanmak icin odeme ZORUNLU (trial dahil)
- **Median conversion**: 12.11% | Top 10%: 38.7%
- **En iyi**: Yuksek niyet, net deger teklifi olan uygulamalar (business, finance, premium tools)
- **Risk**: Kullanici akisini keser, viral growth'u yok eder
- **Apple notu**: Kabul edilir AMA deger teklifi bastan net olmali

### Soft Paywall
- **Tanim**: Uygulama kullanilabilir, belirli feature'lar premium
- **Conversion**: 5-15% (kategoriye gore degisir)
- **En iyi**: Cogu uygulama icin en guvenli secenek
- **Avantaj**: Kullanici aktivasyonu + odeme niyeti birlikte calisir

### Freemium
- **Tanim**: Core uygulama tamamen ucretsiz, premium ekstra deger katar
- **Median conversion**: 2.18% (ama yuksek hacim)
- **En iyi**: Network effect'li, viral buyume gereken uygulamalar
- **Onemli**: Conversion'in %23'u 6+ hafta sonra olur (sabir gerekli)

### Metered
- **Tanim**: N kez ucretsiz kullanim, sonra odeme
- **En iyi**: AI araclari, utility uygulamalar, content uygulamalar
- **Ornek**: "Gunluk 3 ucretsiz analiz, daha fazlasi icin premium"

---

## Kategori Benchmark Database

| Kategori | Onerilen Model | Trial-to-Paid | Avg Monthly | Avg Annual | Optimal Trial | Not |
|----------|---------------|---------------|-------------|------------|---------------|-----|
| Health & Fitness | Soft | 35% | $9.99-14.99 | $59.99-79.99 | 7 gun | Annual %60.6 revenue share, churn riski yuksek ilk ayda |
| Games | Soft/Metered | 8-15% | $4.99-9.99 | $29.99-49.99 | 3 gun | Weekly plan iyi calisir, battle pass alternatif |
| Productivity | Soft | 20-30% | $4.99-9.99 | $39.99-59.99 | 7 gun | Feature-gate etkili, B2B icin higher pricing |
| Education | Freemium/Soft | 15-25% | $9.99-19.99 | $59.99-99.99 | 7 gun | Content-gate etkili, seasonal demand |
| Photo & Video | Soft | 12-20% | $4.99-7.99 | $29.99-49.99 | 3-7 gun | Export watermark etkili gate |
| Finance | Hard/Soft | 25-35% | $4.99-14.99 | $49.99-99.99 | 7 gun | Yuksek LTV, guclu retention |
| Travel | Freemium | 5-10% | $4.99-9.99 | $29.99-49.99 | - | Seasonal, trip-based upsell |
| Dating | Soft | 10-20% | $14.99-29.99 | $79.99-149.99 | 7 gun | Weekly plan yuksek conversion, en yuksek ARPU |
| Streaming/Media | Soft/Hard | 30-40% | $9.99-14.99 | $99.99-149.99 | 7 gun | Content library belirleyici |
| Food & Drink | Freemium | 5-12% | $4.99-9.99 | $29.99-49.99 | - | Delivery fee savings hook |
| Music | Freemium | 8-15% | $4.99-9.99 | $49.99-79.99 | 30 gun | Ads-free hook, offline listening |
| Weather | Soft | 15-25% | $1.99-4.99 | $14.99-29.99 | 7 gun | Widget + radar premium gate |
| News | Metered/Soft | 5-15% | $9.99-14.99 | $79.99-149.99 | - | Article limit etkili (5/ay free) |
| Lifestyle | Soft | 10-18% | $4.99-9.99 | $29.99-49.99 | 7 gun | Genel kategori, niche'e gore ayarla |

---

## Trial Duration Optimizasyonu

| Sure | Oran | En Iyi Icin |
|------|------|-------------|
| 3 gun | %18 | Aninda deger veren uygulamalar (oyun, foto editor) |
| 5 gun | %22 | Kisa aktivasyon sureli (productivity, weather) |
| 7 gun | %52 | Cogu uygulama icin STANDART (en yaygin) |
| 14 gun | %6 | Yavas aktivasyon (education, habit tracking) |
| 30 gun | %2 | Sadece music/streaming (uzun aliskanllik gereken) |

**Kural**: Kullanicinin "aha moment"ine ulasma suresinin 2 kati trial suresi olmali.
- Fitness app: "aha" = ilk antrenman tamamlama (1-2 gun) -> 7 gun trial
- Education app: "aha" = ilk modul bitirme (3-5 gun) -> 14 gun trial
- Game: "aha" = ilk level gecme (dakikalar) -> 3 gun trial

---

## Paywall Placement Mapping

| Placement | Aciklama | En Iyi Icin | Conversion Etkisi |
|-----------|----------|-------------|-------------------|
| Onboarding | Kayit/intro sonrasi hemen | Yuksek niyet uygulamalar (finance, business) | En yuksek (kullanici kararsizken) |
| Feature-gate | Premium feature'a tiklandiginda | Cogu uygulama | Orta-yuksek (deger gorulmus) |
| Usage-limit | N kez kullanim sonrasi | AI tools, metered uygulamalar | Yuksek (aliskanllik olusmus) |
| Session-count | X oturum sonrasi | Games, education | Orta (engagement kanitlanmis) |
| Time-delay | N gun sonra | Utility, lifestyle | Orta-dusuk (aktivasyon gerektirmez) |
| Event-triggered | Belirli basari/event sonrasi | Fitness (ilk antrenman), education (ilk quiz) | Yuksek (momentum aninda) |

**Multi-placement stratejisi**: Tek paywall degil, birden fazla tetikleyici kullan:
1. Onboarding'de soft goster (skip'lenebilir)
2. Feature-gate'te tekrar goster (deger gorulmus)
3. 3. oturumda hatirlatma (engagement kanitlanmis)

---

## Pricing Psychology

### Anchoring (Cipalama)
- ONCE en pahali plani goster, sonra ucuzunu
- Annual plani VURGULA: "Monthly $9.99/mo vs Annual $4.99/mo (Save 50%)"
- Orta plan "Most Popular" badge'i al (decoy effect)

### Charm Pricing
- $9.99 > $10.00 (sol rakam etkisi)
- $49.99/yil > $50/yil
- $X.99 her zaman kullan, tam rakam KULLANMA

### Per-Day Framing
- "$49.99/yil" yerine "Gunluk sadece 14 sent"
- "$9.99/ay" yerine "Gunluk sadece 33 sent"
- Kahve karsilastirmasi: "Bir kahveden ucuz"

### Decoy Effect (Yem Etkisi)
3 plan sun:
```
Basic:   $4.99/ay  (sinirli)
Pro:     $9.99/ay  (en populer - HEDEF)
Premium: $14.99/ay (hersey)
```
Basic, Pro'yu ucuz gostermek icin var (decoy).

### Savings Highlight
- "Save 60%" yesil badge ile vurgula
- Annual vs monthly karsilastirmayi ACIKCA goster
- Strikethrough pricing: ~~$119.88~~ $49.99/year

---

## Regional Pricing (PPP - Purchasing Power Parity)

| Bolge | ABD Fiyatinin %'si | Ornek ($9.99 ABD) |
|-------|-------------------|-------------------|
| ABD/Kanada/Avustralya | %100 | $9.99 |
| Bati Avrupa (UK, DE, FR) | %90-100 | $8.99-9.99 |
| Dogu Avrupa (PL, CZ, RO) | %50-60 | $4.99-5.99 |
| Turkiye | %30-35 | $2.99-3.49 |
| Hindistan | %25-30 | $2.49-2.99 |
| Brezilya | %40-45 | $3.99-4.49 |
| Guneydogu Asya | %35-45 | $3.49-4.49 |
| Latin Amerika | %40-50 | $3.99-4.99 |
| Afrika | %25-35 | $2.49-3.49 |
| Orta Dogu | %50-60 | $4.99-5.99 |
| Japonya/Guney Kore | %85-95 | $8.49-9.49 |
| Cin | %40-50 | $3.99-4.99 |

**Uygulama**: RevenueCat'te country-based Offerings olustur:
- `default` offering: ABD fiyatlari
- `tr_offering`: Turkiye fiyatlari
- `in_offering`: Hindistan fiyatlari
- Kullanicinin locale'ine gore offering sec

---

## Apple/Google Compliance Checklist

### Apple App Store (KRITIK)

```
[ZORUNLU] Restore Purchases butonu paywall'da gorunur
[ZORUNLU] Abonelik sartlari gorunur (fiyat + sure + otomatik yenileme)
[ZORUNLU] Iptal/yonetim linki mevcut
[ZORUNLU] Gizlilik politikasi linki mevcut
[ZORUNLU] Kullanim sartlari linki mevcut
[ZORUNLU] Paywall kapatilabilir (hard paywall haricinde dismiss butonu)
[ZORUNLU] Trial bitis fiyati acikca belirtilmis
[YASAK]   Toggle paywall KULLANMA (Ocak 2026'dan beri reject ediliyor)
[YASAK]   Sahte kitlik/urgency (fake countdown, "limited slots")
[YASAK]   Karmasik iptal sureci (dark pattern)
[YASAK]   Dismiss butonunu gizleme/kuculme
[DIKKAT]  Onboarding paywall: deger teklifi ONCE gosterilmeli
```

### Google Play Store

```
[ZORUNLU] Abonelik sartlari acik ve okunabilir
[ZORUNLU] Iptal sureci kolayca erisilebilir
[ZORUNLU] Ucretsiz deneme sartlari net
[YASAK]   Yaniltici abonelik ifadeleri
[YASAK]   Gizli ucretler
[DIKKAT]  Grace period destegi oner (odeme sorunu icin)
```

---

## Karar Agaci

```
Uygulamam ne tur?

├── Aninda net deger veriyor (business tool, finance tracker)
│   └── HARD PAYWALL + 7 gun trial
│       - Onboarding'de goster
│       - Annual vurgula (%40-60 indirimli)
│
├── Genis kitle, viral buyume onemli (social, communication)
│   └── FREEMIUM
│       - Core free, premium ekstra deger
│       - 6+ hafta sabret (conversion yavastir)
│       - Feature-gate placement
│
├── AI/utility, olculebilir deger (AI writer, photo editor)
│   └── METERED + Soft paywall
│       - N kez free, sonra gate
│       - Usage-limit placement
│       - Weekly plan dusun
│
├── Oyun
│   └── SOFT PAYWALL + Battle Pass alternatifi
│       - 3 gun trial
│       - Session-count placement
│       - Weekly plan yuksek conversion
│       - In-app purchase hybrid dusun
│
└── Diger (fitness, education, lifestyle)
    └── SOFT PAYWALL + 7 gun trial
        - Feature-gate + Event-triggered
        - Annual vurgula
        - Category benchmark'larina bak
```
