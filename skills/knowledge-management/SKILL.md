---
name: knowledge-management
description: Proje bilgisini 4 katmanli yapida organize et. Aktif projeler, sorumluluk alanlari, referans kaynaklar ve arsiv. Progressive summarization ile bilgiyi katman katman ozumse. Second brain pattern'i ile codebase bilgisini yapilandir.
---

# Knowledge Management

Buyuk projelerde bilgi kaybini onleyen 4 katmanli organizasyon sistemi.

## 4 Katmanli Bilgi Yapisi

```
KATMAN 1: AKTIF ISLER
  Simdi uzerinde calisilanlar. Sprint task'lari, aktif bug'lar, devam eden feature'lar.
  Konum: thoughts/active/ veya .claude/active/
  Kural: Max 5-7 aktif is. Fazlasi = fokus kaybı.

KATMAN 2: SORUMLULUK ALANLARI
  Surekli sahip oldugun alanlar. Auth modulu, API layer, deployment pipeline.
  Konum: thoughts/areas/ veya .claude/areas/
  Kural: Her alan icin tek sayfalik "durum raporu" tut.

KATMAN 3: REFERANSLAR
  Tekrar tekrar basvurulan bilgiler. API dokumantasyonu, tasarim kararlari, benchmark sonuclari.
  Konum: thoughts/references/ veya .claude/references/
  Kural: Ihtiyac duyuldugunda hizla bulunabilmeli.

KATMAN 4: ARSIV
  Tamamlanan isler, eski kararlar, deprecated feature'lar.
  Konum: thoughts/archive/ veya .claude/archive/
  Kural: Silme, tasi. Bir gun lazim olabilir.
```

## Bilgi Akisi

```
YENi BILGI geldiginde:
  1. Aktif is ile ilgiliyse → KATMAN 1'e ekle
  2. Surekli sorumluluk alaniysa → KATMAN 2'ye ekle
  3. Referans/dokumantasyonsa → KATMAN 3'e ekle
  4. Hicbirine uymuyorsa → KATMA (gereksiz bilgi)

IS TAMAMLANDIGINDA:
  1. KATMAN 1'den kaldir
  2. Ogrenimleri KATMAN 3'e tasi (referans olarak)
  3. Detaylari KATMAN 4'e arsivle
```

## Progressive Summarization

Bilgiyi katman katman ozumseme teknigi. Her geciste bilgi daha yogun ve erislebilir olur.

### Katman 0: Ham Kaynak
Orijinal icerik -- commit mesajlari, PR aciklamalari, meeting notlari, hata loglari.

### Katman 1: Yakalama
Ilgili kisimları kaydet. Tam metni degil, onemli parcalari.

```markdown
# Auth Refactoring Notlari

- JWT'den session-based'e gecis karari alindi (2026-03-15)
- Neden: JWT revocation problemi, token boyutu sisiyor
- Redis session store kullanilacak
- Migration 3 fazda yapilacak
```

### Katman 2: Kalin Isaret
En onemli cumleler/kavramlar **bold** ile isaretle.

```markdown
# Auth Refactoring Notlari

- **JWT'den session-based'e gecis** karari alindi (2026-03-15)
- Neden: **JWT revocation problemi**, token boyutu sisiyor
- **Redis session store** kullanilacak
- Migration **3 fazda** yapilacak
```

### Katman 3: Ozet
Kendi cumlenle 2-3 satirlik ozet yaz.

```markdown
# Auth Refactoring

JWT revocation problemi nedeniyle session-based auth'a geciliyor.
Redis session store + 3 fazli migration plani var.
```

### Katman 4: Remix
Baska bilgilerle birlestir, yeni icerik uret.

```markdown
# Auth Sistemi Mimari Karar Kaydi

Session-based auth (Redis) tercih edildi. JWT'nin revocation ve boyut
problemleri cozumsuzdu. Bu karar API gateway tasarimini da etkiliyor --
her istekte Redis lookup gerekecek, caching stratejisi buna gore ayarlanmali.
```

## Codebase Second Brain

### Dosya Yapisi

```
thoughts/
  active/
    current-sprint.md        # Bu sprint'in task'lari
    in-progress-feature.md   # Uzerinde calisilanlar
  areas/
    auth.md                  # Auth modulu durumu
    api.md                   # API layer durumu
    infrastructure.md        # Infra durumu
  references/
    adr/                     # Architecture Decision Records
      001-session-auth.md
      002-redis-cache.md
    benchmarks/              # Performans sonuclari
    api-contracts/           # API sozlesmeleri
  archive/
    2026-q1/                 # Ceyreklik arsiv
    deprecated/              # Kaldirilmis feature'lar
```

### ADR (Architecture Decision Record) Formati

```markdown
# ADR-001: Session-Based Authentication

## Durum
Kabul edildi (2026-03-15)

## Baglam
JWT token'lari revoke edilemiyor, token boyutu buyuyor.

## Karar
Redis-backed session authentication'a gecis.

## Sonuclar
- (+) Anlik revocation mumkun
- (+) Token boyutu sorun degil
- (-) Redis bagimliligi eklendi
- (-) Her istekte session lookup gerekiyor
```

## Bilgi Yakalama Tetikleyicileri

| Olay | Yakalanacak Bilgi | Nereye |
|------|-------------------|--------|
| Mimari karar alindi | ADR yaz | references/adr/ |
| Bug cozuldu | Root cause + fix | references/ veya memory |
| Sprint basladi | Task listesi | active/ |
| Sprint bitti | Retrospektif | archive/ |
| Yeni modul eklendi | Alan durumu | areas/ |
| Performance test yapildi | Benchmark sonuclari | references/benchmarks/ |
| API degisti | Contract guncelle | references/api-contracts/ |
| Dependency upgrade | Migration notlari | active/ (sonra archive/) |

## Bilgi Erisim Hiyerarsisi

Bir soruya cevap ararken su sirada bak:

```
1. AKTIF ISLER (thoughts/active/) → Simdi alakali mi?
2. ALAN DURUMLARI (thoughts/areas/) → Bu alanla ilgili mi?
3. REFERANSLAR (thoughts/references/) → Daha once karar alinmis mi?
4. ARSIV (thoughts/archive/) → Gecmiste benzer is yapilmis mi?
5. GIT HISTORY (git log/blame) → Kodda ne degismis?
6. MEMORY SYSTEM (recall) → Baska session'larda ne ogrenmisiz?
```

## Haftalik Bakım

```
Her hafta 15 dakika:
[ ] Aktif isler guncelle (tamamlananlar archive'a)
[ ] Alan durumlari guncelle (degisen varsa)
[ ] Referanslar guncelle (yeni karar varsa ADR yaz)
[ ] Gereksiz bilgileri sil veya arsivle
```

## Anti-Pattern'ler

```
YAPMA: Her seyi kaydet
YAP:   Sadece tekrar kullanilacak bilgiyi kaydet

YAPMA: Tek buyuk dosyada tut
YAP:   Konu basina ayri dosya

YAPMA: Arsivi hicbir zaman temizleme
YAP:   Ceyreklik arsiv, yillik temizlik

YAPMA: Bilgiyi sadece kafanda tut
YAP:   Yazdığın an unutabilirsin, hemen kaydet

YAPMA: Her dosyayi ayni seviyede tut
YAP:   Progressive summarization ile katmanla
```

## vibecosystem Entegrasyonu

- **compass agent**: Session context recovery icin 4 katmanli yapiyi kullanir
- **scribe agent**: Session handoff'larda bilgi organizasyonunu uygular
- **self-learner agent**: Ogrenimleri uygun katmana kaydeder
- **architect agent**: ADR yazmak icin bu formati kullanir
- **Memory system**: KATMAN 3 (referanslar) ile memory recall birlikte calisir
