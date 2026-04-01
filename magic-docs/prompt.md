# Magic Docs - Kullanim Kilavuzu

Herhangi bir markdown dosyasinin ilk satirina su header'i ekle:

```markdown
# MAGIC DOC: Dokuman Basligi
```

Opsiyonel: Header'dan hemen sonra italik ile ozel talimat ekleyebilirsin:

```markdown
# MAGIC DOC: API Referansi
*Sadece endpoint degisikliklerini kaydet, implementasyon detayi ekleme*
```

## Nasil Calisir

1. Dosya Read tool ile okundugunda `magic-doc-tracker` hook'u header'i tespit eder
2. Dosya `~/.claude/magic-docs/tracked.json`'a kaydedilir
3. Session sonunda `magic-doc-updater` hook'u bu dosyalarin guncellenmesi icin talimat verir
4. Claude konusmadan yeni bilgileri doc'a ekler

## Iyi Kullanim Alanlari

- Proje mimarisi dokumani
- API referansi
- Onboarding rehberi
- Karar kayitlari (ADR)
- Codebase haritasi

## Kurallar

- Header'i DEGISTIRME (`# MAGIC DOC:` kismini)
- Doc'u kisa ve oz tut
- Tarihce/changelog ekleme, mevcut durumu yansit
- Implementasyon detayi degil, mimari ve genel bakis yaz
