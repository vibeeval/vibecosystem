# Auto Skill Activation - ZORUNLU

BU KURAL HER SESSION'DA MUTLAKA UYGULANIR. KULLANICININ HATIRLAMASINA GEREK YOK.

---

## SESSION BASLANGICI (Her konusmada ilk is)

kullanici bir proje dizininde calisiyorsa, OTOMATIK yap:

1. **Proje tespiti**: package.json, go.mod, pyproject.toml, tsconfig.json, manage.py, Cargo.toml kontrol et
2. **CLAUDE.md kontrolu**: Yoksa "CLAUDE.md olusturayim mi?" sor
3. **Tech stack'e gore skill'leri aktive et** (asagidaki mapping)
4. **Memory recall**: Proje ile ilgili gecmis ogrenimleri getir
5. **@strategist** arka planda baslat: Quick Pulse analizi yap, session boyunca aktif kal
6. **@compass** context brief: "Nerede kalmistik?" otomatik ozetle (git log, stash, WIP)

---

## KOD YAZILDIGINDA (Otomatik tetiklenir)

| Olay | Otomatik Aksiyon | kullaniciya Sor? |
|------|-------------------|----------------|
| Kod yazildi/edit edildi | @code-reviewer cagir | HAYIR, direkt yap |
| Test yazilmadi | "Test yazayim mi?" sor | EVET |
| console.log kaldi | Uyar ve sil | HAYIR |
| Hardcoded secret goruldu | DURDUR, uyar | HAYIR |
| Build fail etti | @build-error-resolver cagir | HAYIR |
| Type error | Duzelt | HAYIR |
| Test data lazim | @mocksmith cagir (type'dan mock data) | HAYIR |
| Dependency CVE/upgrade | @migrator cagir | HAYIR |
| GraphQL schema degisti | @graphql-expert cagir | HAYIR |
| K8s manifest degisti | @kubernetes-expert cagir | HAYIR |
| Terraform dosya degisti | @terraform-expert cagir | HAYIR |
| i18n key eklendi | @i18n-expert kontrol | HAYIR |
| Accessibility sorunu | @a11y-expert + @accessibility-auditor | HAYIR |
| Feature flag kullanildi | @feature-flag-expert review | HAYIR |
| API doc degisti | @api-doc-generator guncelle | HAYIR |
| Config degisti | @config-validator kontrol | HAYIR |
| Schema degisti | @schema-validator kontrol | HAYIR |

## FEATURE TAMAMLANDIGINDA (Otomatik tetiklenir)

kullanici "bitti", "tamam", "ok", "done" gibi bir sey dediginde:

1. **@verifier** cagir (build + test + lint + security)
2. Verifier PASS verirse: "Commit yapalim mi?" sor
3. Verifier FAIL verirse: Sorunlari listele, duzelt

## HATA YAPILDIGINDA (Otomatik tetiklenir)

Herhangi bir hata oldugunda (test fail, build fail, runtime error):

1. **@self-learner** cagir
2. CLAUDE.md'ye kaydet
3. Memory'ye kaydet
4. "Bu hatadan su kurali ogrensek mi?" seklinde kullaniciya bildir

## BUG FIX ISTENDIGINDE (Otomatik tetiklenir)

kullanici "bug", "hata", "calismıyor", "broken", "fix" dediginde:

Kucuk bug (tek dosya, basit fix):
1. **@sleuth** cagir (investigate)
2. Root cause bulununca **@spark** ile duzelt
3. **@verifier** ile kontrol et
4. Fix sonrasi **@coroner** cagir (ayni hata baska yerde var mi?)

Buyuk/karmasik bug (birden fazla dosya, karmasik logic):
1. **@sleuth** cagir (investigate)
2. Root cause bulununca **@kraken** ile TDD fix
3. **@arbiter** ile test calistir
4. **@verifier** ile son kontrol
5. Fix sonrasi **@coroner** cagir (pattern propagation + post-mortem)

Bug reproduce edilemiyorsa:
1. **@replay** cagir (reproduce adimlari olustur, flaky test analizi)
2. Reproduce edildikten sonra yukaridaki akisa devam et

Acil/production bug (HOTFIX):
1. **@sleuth** cagir (hizli investigate - sadece critical kontroller)
2. **@spark** ile minimal fix
3. **@verifier** ile sadece build + critical test
4. Hemen commit + deploy
5. Sonra @self-learner ile ogren

## BUYUK IS ISTENDIGINDE (Otomatik tetiklenir)

kullanici buyuk scope'lu bir is istedginde (yeni feature, modul, sistem):

1. **Plan mode'a gir** (EnterPlanMode)
2. **@architect** ile plan ciz
3. Plan onaylaninca **@kraken** ile implement et
4. Swarm gerekiyorsa `/swarm` workflow'unu baslat

## COMMIT ISTENDIGINDE (Otomatik tetiklenir)

1. Once **@verifier** calistir
2. PASS ise commit yap
3. FAIL ise durdur, sorunlari goster

## REVIEW ISTENDIGINDE (Otomatik tetiklenir)

1. **@code-reviewer** (genel kalite)
2. Auth/data islerinde **@security-reviewer** da ekle
3. DB islerinde **@database-reviewer** da ekle

---

## TECH STACK -> SKILL MAPPING

### Node.js / TypeScript
- coding-standards, tdd-workflow
- frontend-patterns (React/Next.js varsa)
- backend-patterns (API varsa)

### Python
- python-patterns, python-testing
- django-patterns + django-security + django-tdd (Django ise)

### Go
- golang-patterns, golang-testing
- go-build (build hatasinda), go-review (review'da)

### Java / Spring Boot
- springboot-patterns, springboot-security, springboot-tdd
- jpa-patterns (JPA varsa)

### Database
- postgres-patterns (PostgreSQL ise)
- clickhouse-io (ClickHouse ise)
- mongodb-patterns (MongoDB ise)
- database-reviewer agent (schema degisikliginde)

### GraphQL
- graphql-patterns
- graphql-expert agent

### Infrastructure / Cloud
- terraform-patterns, kubernetes-patterns
- aws-patterns, gcp-patterns, azure-patterns
- terraform-expert, kubernetes-expert, aws-expert agent'lari

### Redis
- redis-patterns, caching-patterns
- redis-expert agent

### MongoDB
- mongodb-patterns
- mongodb-expert agent

### Elasticsearch
- elasticsearch-patterns
- elasticsearch-expert agent

### WebSocket / Realtime
- websocket-patterns
- websocket-expert agent

### OAuth / Auth
- oauth-patterns
- oauth-expert + security-reviewer agent

### Mobile (Swift/Kotlin)
- swift-patterns (iOS projesi ise)
- kotlin-patterns (Android projesi ise)

### Microservices
- api-gateway-expert, service-mesh-expert
- event-driven-patterns, cqrs-expert, ddd-expert

### gRPC
- grpc-patterns
- grpc-expert agent

### Kafka / Event Streaming
- kafka-patterns
- kafka-expert agent

### Monitoring
- prometheus-patterns, observability, tracing-patterns
- prometheus-expert, tracing-expert agent'lari

---

## COLLABORATIVE SWARM MODE

Buyuk feature veya yeni proje baslatildiginda TUM ekip devreye girer.
Referans: `agent-assignment-matrix.md`, `qa-loop.md`

Tetikleyiciler:
- "yeni proje baslat"
- Buyuk scope'lu feature istegi
- "tum ekibi calistir" / "/swarm"
- Maestro gerekli gordugunde

```
Phase 1 (Kesif):       scout + PM + architect
Phase 2 (Gelistirme):  assignment-matrix'e gore agent ata
                        HER task icin Dev-QA loop calistir (qa-loop.md)
Phase 3 (Review):      code-reviewer + security + QA + data (paralel)
Phase 4 (Duzeltme):    QA FAIL olan task'lar retry (max 3, sonra escalate)
Phase 5 (Final):       self-learner + docs + growth
Quality Gate:          Phase gecislerinde TUM kriterler saglanmali
```

Agent iletisimi: handoff-templates.md sablonlari.

---

## AGENT HATA ALDIGINDA (Retry/Fallback)

Agent API hatasi (FailedToOpenSocket, timeout, vb.) aldiginda:

1. **1. deneme basarisiz** → 5 saniye bekle, tekrar dene
2. **2. deneme basarisiz** → Ayni gorevi farkli agent'a devret:
   - code-reviewer fail → dogrudan Grep+Read ile manual review yap
   - sleuth fail → dogrudan debug-agent veya scout ile investigate et
   - security-reviewer fail → Grep ile manual secret/injection scan yap
3. **3. deneme basarisiz** → kullaniciya bildir: "X agent'i calismiyor, Y alternatif var"

### Fallback Zinciri

| Ana Agent | Fallback 1 | Fallback 2 |
|-----------|-----------|-----------|
| code-reviewer | Manual Grep review | kullaniciya sor |
| security-reviewer | Manual Grep scan | kullaniciya sor |
| sleuth | scout | kullaniciya sor |
| kraken | spark (kucuk parcalara bol) | kullaniciya sor |
| verifier | Manual build+test calistir | kullaniciya sor |
| migrator | devops | kullaniciya sor |
| compass | scribe | Manual git log/status |
| coroner | sleuth + Grep manual | kullaniciya sor |
| replay | sleuth | kullaniciya sor |
| mocksmith | tdd-guide (manual data) | kullaniciya sor |

### Memory Sistemi Fallback

| Ana | Fallback |
|-----|---------|
| PostgreSQL (Docker) | SQLite (~/.claude/cache/memory.db) |
| SQLite | CLAUDE.md'ye yaz (memory'siz devam) |

---

## KRITIK: KULLANICI UNUTSA BILE

- Kod yazildi → review OTOMATIK
- Is bitti → verify OTOMATIK
- Hata oldu → ogren OTOMATIK
- Bug var → sleuth OTOMATIK
- Bug fix sonrasi → coroner OTOMATIK (pattern propagation)
- Bug reproduce edilemiyor → replay OTOMATIK
- Session baslangici → compass OTOMATIK (context brief)
- Dependency/CVE → migrator OTOMATIK
- Test data lazim → mocksmith OTOMATIK
- Buyuk is → plan mode OTOMATIK
- Commit → verify OTOMATIK
- Agent fail → retry + fallback OTOMATIK

KULLANICININ HICBIR SEY HATIRLAMASINA GEREK YOK. HIZIR HER SEYI OTOMATIK YAPAR.
