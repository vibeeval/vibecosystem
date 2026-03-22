# Incremental Writing

Uzun dokuman uretiminde context window tasarrufu icin parcali yazim.

## Problem

Buyuk dokuman (100+ satir) uretirken tum icerigi bellekte tutmak context window'u doldurur. Ozellikle agent'lar uzun dosyalar yazarken bu sorun buyur.

## Cozum: Skeleton-Fill-Write Pattern

### Adim 1: Skeleton (Iskelet)
Once dokuman yapisini olustur, icerik yok:

```markdown
# Document Title
## Section 1: [placeholder]
## Section 2: [placeholder]
## Section 3: [placeholder]
## Section 4: [placeholder]
```

### Adim 2: Fill Section-by-Section
Her bolumu tek tek doldur ve HEMEN diske yaz:

```
1. Section 1'i yaz → Write tool ile dosyaya kaydet
2. Section 2'yi yaz → Edit tool ile dosyaya ekle
3. Section 3'u yaz → Edit tool ile dosyaya ekle
4. ...
```

### Adim 3: Write Immediately
Her bolum tamamlaninca HEMEN diske yaz. Bellekte biriktirme.

## Ne Zaman Kullan

| Durum | Kullan? |
|-------|---------|
| 50+ satirlik dokuman | Hayir, direkt yaz |
| 100-200 satirlik dokuman | Opsiyonel |
| 200+ satirlik dokuman | EVET |
| Multi-file dokuman uretimi | EVET |
| Agent birden fazla dosya yaziyorsa | EVET |

## Kurallar

- Her bolumdaki satir sayisi bilgisini bellekte tut, icerigi tutma
- Write/Edit tool'u her bolumden sonra cagir
- Ozellikle technical-writer ve doc-updater agent'lari bu pattern'i kullanmali
- Buyuk refactoring'lerde kraken/spark agent'lari da bu pattern'i uygulayabilir
