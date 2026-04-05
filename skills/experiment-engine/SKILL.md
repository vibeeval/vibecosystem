---
name: experiment-engine
description: Otonom deney dongusu. Kod degisikligi yap, olc, karsilastir, kabul et veya geri al. Metrik bazli karar verme ile performans, boyut veya kalite optimizasyonu. Tek basina veya agent ile kullan.
---

# Experiment Engine

Bir hedef belirle, sistematik olarak deneyler yap, sadece iyilestirenleri tut.

## Core Loop

```
HEDEF BELIRLE
  └─ "API response time'i %20 dusur"
  └─ "Bundle size'i 500KB'nin altina getir"
  └─ "Test coverage'i %90'a cikar"

BASELINE OLC
  └─ Mevcut metrigi kaydet (ornek: 340ms, 720KB, %78)

DENEY DONGUSU (N kez tekrarla):
  ┌─────────────────────────────────────┐
  │ 1. MODIFY  - Tek degisiklik yap    │
  │ 2. VERIFY  - Metrigi olc           │
  │ 3. COMPARE - Baseline ile kiyasla  │
  │ 4. DECIDE  - Kabul / Reddet        │
  │    ├─ Iyilesti → COMMIT + yeni     │
  │    │             baseline           │
  │    └─ Kotulesti → ROLLBACK         │
  └─────────────────────────────────────┘

RAPOR OLUSTUR
  └─ N deney, X kabul, Y red, final metrik
```

## Kullanim Alanlari

### Performans Optimizasyonu

```bash
# Hedef: API response time < 200ms
# Baseline: 340ms

# Deney 1: Database query'ye index ekle
git stash  # mevcut durumu kaydet
# ... index ekle ...
curl -w "%{time_total}" http://localhost:3000/api/users  # 280ms
# 340ms -> 280ms = IYILESTI → COMMIT

# Deney 2: Response'u cache'le
# ... Redis cache ekle ...
curl -w "%{time_total}" http://localhost:3000/api/users  # 45ms
# 280ms -> 45ms = IYILESTI → COMMIT

# Deney 3: JSON serializer degistir
# ... fast-json-stringify ekle ...
curl -w "%{time_total}" http://localhost:3000/api/users  # 42ms
# 45ms -> 42ms = MINIMAL IYILESME → REDDET (karmasiklik artmaya degmez)

# Sonuc: 340ms -> 45ms (%87 iyilesme), 2/3 deney kabul edildi
```

### Bundle Size Azaltma

```bash
# Hedef: < 500KB
# Baseline olc
BASELINE=$(npx next build 2>&1 | grep "First Load JS" | awk '{print $4}')

# Deney dongusu
experiments=(
  "lodash yerine lodash-es"
  "moment yerine dayjs"
  "tree-shaking acik mi kontrol"
  "dynamic import lazy component'ler"
  "image optimize (next/image)"
)

for exp in "${experiments[@]}"; do
  echo "=== Deney: $exp ==="
  # degisiklik yap...
  NEW=$(npx next build 2>&1 | grep "First Load JS" | awk '{print $4}')
  if [ "$NEW" -lt "$BASELINE" ]; then
    echo "KABUL: $BASELINE -> $NEW"
    BASELINE=$NEW
    git add -A && git stash  # kaydet
  else
    echo "RED: $NEW >= $BASELINE"
    git checkout .  # geri al
  fi
done
```

### Test Coverage Artirma

```bash
# Hedef: %90 coverage
# Baseline
BASELINE=$(npx jest --coverage --silent 2>&1 | grep "All files" | awk '{print $4}')

# Her dosya icin test yaz, coverage'i olc
for file in $(find src -name "*.ts" -not -name "*.test.*"); do
  echo "=== Test: $file ==="
  # test yaz...
  NEW=$(npx jest --coverage --silent 2>&1 | grep "All files" | awk '{print $4}')
  if (( $(echo "$NEW > $BASELINE" | bc -l) )); then
    echo "KABUL: %$BASELINE -> %$NEW"
    BASELINE=$NEW
  fi
done
```

## Deney Protokolu

### Tek Degisiklik Kurali

```
YANLIS: Ayni anda 3 sey degistirip "daha hizli oldu" demek
  → Hangi degisiklik etkili oldugunu bilemezsin

DOGRU: Her seferinde TEK degisiklik yap
  → Neyin ise yaradigini kesin bilirsin
```

### Rollback Stratejisi

```bash
# Yontem 1: git stash (basit)
git stash         # deney oncesi
# ... deney ...
git stash pop     # basarisizsa geri al

# Yontem 2: git worktree (izole)
git worktree add /tmp/experiment-1 -b exp/perf-test
cd /tmp/experiment-1
# ... deney ...
# basarisizsa worktree'yi sil

# Yontem 3: checkpoint (karmasik deneyler)
git add -A && git commit -m "checkpoint: pre-experiment"
# ... deney ...
# basarisizsa: git reset --hard HEAD~1
```

### Metrik Toplama

```typescript
interface ExperimentResult {
  id: string
  description: string
  baseline: number
  result: number
  improvement: number  // yuzde
  accepted: boolean
  duration: number     // saniye
  timestamp: string
}

// Deney raporu
interface ExperimentReport {
  goal: string
  metric: string
  baselineValue: number
  finalValue: number
  totalExperiments: number
  accepted: number
  rejected: number
  totalImprovement: number  // yuzde
  experiments: ExperimentResult[]
}
```

## Deney Sablonu

```markdown
# Deney Raporu: [Hedef]

## Ozet
- Hedef: [metrik] < [esik]
- Baseline: [baslangic degeri]
- Final: [son deger]
- Iyilesme: [yuzde]
- Deneyler: [kabul]/[toplam]

## Deneyler

| # | Aciklama | Onceki | Sonraki | Degisim | Karar |
|---|----------|-------:|--------:|--------:|-------|
| 1 | Index ekle | 340ms | 280ms | -18% | KABUL |
| 2 | Redis cache | 280ms | 45ms | -84% | KABUL |
| 3 | JSON serializer | 45ms | 42ms | -7% | RED |

## Ogrenim
- En etkili: Redis cache (-84%)
- Degmez: JSON serializer degisimi (karmasiklik > kazanim)
```

## Otomatik Deney Modu

```bash
# experiment-loop.sh
# Kullanim: ./experiment-loop.sh "response_time" "200" "ms" 10

METRIC=$1       # olculecek metrik
TARGET=$2       # hedef deger
UNIT=$3         # birim
MAX_ROUNDS=$4   # max deney sayisi

ROUND=0
BASELINE=$(measure_$METRIC)

while [ $ROUND -lt $MAX_ROUNDS ]; do
  ROUND=$((ROUND + 1))

  # Claude'a optimize ettir
  claude -p "Optimize $METRIC. Current: ${BASELINE}${UNIT}. Target: <${TARGET}${UNIT}. Make ONE small change." --no-input

  # Olc
  NEW=$(measure_$METRIC)

  if [ "$NEW" -lt "$BASELINE" ]; then
    echo "Round $ROUND: KABUL ($BASELINE -> $NEW)"
    BASELINE=$NEW
    git add -A && git commit -m "experiment: $METRIC improved to ${NEW}${UNIT}"
  else
    echo "Round $ROUND: RED ($NEW >= $BASELINE)"
    git checkout .
  fi

  # Hedefe ulastik mi?
  if [ "$BASELINE" -le "$TARGET" ]; then
    echo "HEDEF ULASILDI: ${BASELINE}${UNIT} <= ${TARGET}${UNIT}"
    break
  fi
done
```

## vibecosystem Entegrasyonu

- **profiler agent**: Performans deneylerinde metrik toplama
- **nitro agent**: Optimization deneylerini yonetme
- **tdd-guide agent**: Coverage deneylerinde test yazma
- **verifier agent**: Her deney sonrasi build/test dogrulama
- **self-learner agent**: Basarili deneyleri pattern olarak kaydet
- **experiment-loop skill**: Bu skill'in mevcut complementary'si
