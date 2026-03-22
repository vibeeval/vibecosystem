# Collaborative Decisions

Onemli tasarim ve mimari kararlarinda yapilandirilmis karar alma sureci.

## Ne Zaman Kullan

- Birden fazla gecerli yaklasim varsa
- Kullanici tercihini etkileyen kararlar
- Geri donusu zor mimari kararlar
- UI/UX tasarim tercihleri
- Tech stack secimleri

## Decision Flow

```
1. Question    → Problemi/karari net tanimla
2. Options     → 2-4 secenek sun (artilari/eksileri ile)
3. Decision    → Kullanicinin secimini al
4. Draft       → Secime gore taslak olustur
5. Approval    → Kullanici onayiyla ilerle
```

## AskUserQuestion Kullanim Rehberi

### Iyi Soru Ornekleri

```
Soru: "Authentication icin hangi yaklasimi tercih edersiniz?"
Secenekler:
1. JWT + Refresh Token (Stateless, olceklenebilir)
2. Session-based (Basit, sunucu tarafli)
3. OAuth 2.0 + PKCE (3rd party login destegi)
```

```
Soru: "Dashboard layout'u icin hangi stil?"
Secenekler:
1. Sidebar + Content (Klasik admin panel)
2. Top nav + Content (Modern, genis alan)
3. Bento Grid (Kart tabanli, modular)
```

### Kotu Soru Ornekleri

- "Bunu yapalim mi?" (Cok belirsiz)
- "Hangisini tercih edersiniz?" (Seceneksiz)
- "A mi B mi?" (Artilari/eksileri yok)

## Kurallar

- Her secenek icin en az 1 arti ve 1 eksi belirt
- Onerileni belirt ama dayatma yapma
- Max 4 secenek sun (fazlasi kafa karistirir)
- Karar alindiktan sonra HEMEN implement et, tekrar sorma
- Karari kaydet (memory veya task description'a)
- Trivial kararlar icin KULLANMA (secenek belliyle sorma)

## Agent'lar Icin

Su agent'lar karar noktalarinda bu pattern'i kullanmali:
- **architect**: Mimari kararlar
- **designer**: UI/UX tercihleri
- **frontend-dev**: Component yaklasimi
- **backend-dev**: API tasarimi
- **devops**: Infra secimleri
- **planner**: Strateji secimleri
