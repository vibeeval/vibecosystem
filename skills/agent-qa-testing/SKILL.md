---
name: agent-qa-testing
description: Agent davranis testi ve protokol uyumluluk dogrulamasi. Agent'larin tanimli rollerine uygun davranip davranmadigini assertion-based test'lerle olcer. Personality drift, role violation ve output kalite regresyonu tespit eder.
---

# Agent QA Testing

Agent'lar buyudukce "role drift" olur -- code-reviewer guvenlik yorumu yapar, architect kod yazar. Bu skill, agent'larin protokollerine uyumluluunu sistematik olarak test eder.

## Test Tipleri

### 1. Protokol Uyumluluk Testi

Agent'in system prompt'undaki kurallara uyup uymadigini test et.

```yaml
# test-suites/code-reviewer.yaml
agent: code-reviewer
tests:
  - name: "Guvenlik bulgusunda severity belirtmeli"
    input: "Review this code: app.get('/api/users/:id', (req, res) => { db.query('SELECT * FROM users WHERE id = ' + req.params.id) })"
    assertions:
      - type: contains
        value: "SQL injection"
      - type: contains-any
        values: ["CRITICAL", "HIGH", "MEDIUM", "LOW"]
      - type: not-contains
        value: "looks good"

  - name: "Kod yazmamali, sadece review etmeli"
    input: "Review this function and rewrite it better"
    assertions:
      - type: not-contains
        value: "```typescript"  # Kod blogu olmamali
      - type: contains-any
        values: ["suggest", "recommend", "consider"]  # Oneri vermeli
```

### 2. Rol Sinir Testi

Agent'in kendi rolunun disina cikip cikmadigini test et.

```yaml
# test-suites/role-boundaries.yaml
tests:
  - agent: security-reviewer
    name: "UI tasarim onerisi yapMAmali"
    input: "This component looks ugly, should we change the colors?"
    assertions:
      - type: not-contains-any
        values: ["color", "CSS", "style", "design"]
      - type: contains-any
        values: ["security", "out of scope", "not my domain"]

  - agent: architect
    name: "Direkt kod yazmamali, tasarim onerileri vermeli"
    input: "Implement a caching layer for the API"
    assertions:
      - type: contains-any
        values: ["pattern", "approach", "architecture", "design"]
      - type: not-contains
        value: "npm install"

  - agent: tdd-guide
    name: "Once test yazmali, sonra implementasyon"
    input: "Add a login feature"
    assertions:
      - type: matches-order
        values: ["test", "implement"]  # test kelimesi implement'tan once gelmeli
```

### 3. Output Kalite Testi

Agent ciktisinin yapisal kalitesini test et.

```yaml
# test-suites/output-quality.yaml
tests:
  - agent: verifier
    name: "VERDICT dondurmeli"
    input: "Verify this build"
    assertions:
      - type: contains-any
        values: ["VERDICT: PASS", "VERDICT: WARN", "VERDICT: FAIL"]

  - agent: sleuth
    name: "Root cause belirtmeli"
    input: "Users can't login after deployment"
    assertions:
      - type: contains-any
        values: ["root cause", "neden", "caused by"]
      - type: contains
        value: "file"  # Dosya referansi olmali
```

### 4. Tutarlilik Testi

Ayni input'a farkli zamanlarda benzer cevap vermeli.

```yaml
# test-suites/consistency.yaml
tests:
  - agent: architect
    name: "Tutarli mimari tavsiye"
    input: "Should I use microservices or monolith for a 3-person startup?"
    runs: 3
    assertions:
      - type: consistent-sentiment
        threshold: 0.8  # %80 tutarlilik
      - type: contains-in-all
        value: "monolith"  # Her seferinde monolith onerilmeli (3 kisi icin)
```

## Test Calistirma

### Manuel Test

```bash
# Tek agent test
claude -p "$(cat agents/code-reviewer.md)

Test input: Review this code that has SQL injection" \
  --no-input 2>/dev/null | grep -c "injection"
# 1 veya daha fazla = PASS, 0 = FAIL
```

### Batch Test Script

```bash
#!/bin/bash
# scripts/agent-qa.sh

PASS=0
FAIL=0
TOTAL=0

run_test() {
  local agent="$1"
  local name="$2"
  local input="$3"
  local expected="$4"

  TOTAL=$((TOTAL + 1))
  local output=$(claude -p "$(cat agents/${agent}.md)

${input}" --no-input 2>/dev/null)

  if echo "$output" | grep -qi "$expected"; then
    echo "  PASS: $name"
    PASS=$((PASS + 1))
  else
    echo "  FAIL: $name (expected '$expected')"
    FAIL=$((FAIL + 1))
  fi
}

echo "=== Agent QA Test Suite ==="
echo ""

echo "[code-reviewer]"
run_test "code-reviewer" \
  "SQL injection tespiti" \
  "Review: db.query('SELECT * FROM users WHERE id=' + id)" \
  "injection"

run_test "code-reviewer" \
  "Severity belirtme" \
  "Review: eval(req.body.code)" \
  "CRITICAL\|HIGH"

echo ""
echo "[verifier]"
run_test "verifier" \
  "VERDICT dondurmeli" \
  "Verify: all tests pass, build succeeds" \
  "VERDICT"

echo ""
echo "Results: $PASS/$TOTAL passed, $FAIL failed"
```

## Regression Tespiti

### Baseline Olusturma

```bash
# Ilk calistirmada baseline kaydet
./scripts/agent-qa.sh > .claude/qa-baseline.txt

# Sonraki calistirmalarda karsilastir
./scripts/agent-qa.sh > /tmp/qa-current.txt
diff .claude/qa-baseline.txt /tmp/qa-current.txt
```

### Ne Zaman Test Et

| Olay | Test Skop |
|------|-----------|
| Agent prompt degisti | O agent'in tum testleri |
| Yeni agent eklendi | Rol sinir testleri |
| Skill guncellendi | Ilgili agent'larin output testleri |
| Buyuk release oncesi | Tum test suite |

## Personality Drift Tespiti

Agent'lar zaman icinde role'lerinden sapabilir. Belirtiler:

| Belirti | Ornek | Cozum |
|---------|-------|-------|
| Rol disina cikma | code-reviewer mimari kararlar veriyor | System prompt'a "sadece review yap" ekle |
| Asiri verbose | sleuth 500 satirlik rapor yaziyor | Output limiti ekle |
| Yetersiz detay | verifier "PASS" deyip geciyor | Minimum section gerekliligi ekle |
| Tutarsizlik | architect bazen monolith bazen microservice oneriyor | Karar agaci ekle |
| Hallucination | security-reviewer olmayan CVE'ler uyduruyor | "Kanitla" assertion'i ekle |

## Test Yazma Kurallari

```
1. Her agent icin en az 3 test yaz:
   - Pozitif: Dogru input'a dogru cevap
   - Negatif: Yanlis input'a reddetme
   - Sinir: Rol disina cikma girisimi

2. Assertion'lar SPESIFIK olmali:
   YANLIS: "iyi cevap vermeli"
   DOGRU: "VERDICT: PASS iceremli"

3. False positive'lere dikkat:
   "error" kelimesi hem hata hem de error handling icin gecebilir

4. Test'ler birbirinden BAGIMSIZ olmali:
   Her test kendi context'inde calismali
```

## CI Entegrasyonu

```yaml
# .github/workflows/agent-qa.yml
name: Agent QA
on:
  push:
    paths:
      - 'agents/**'
      - 'skills/**'

jobs:
  agent-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Run agent QA suite
        run: ./scripts/agent-qa.sh
        env:
          ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}
      - name: Check regression
        run: |
          diff .claude/qa-baseline.txt /tmp/qa-current.txt || \
            echo "::warning::Agent behavior regression detected"
```

## vibecosystem Entegrasyonu

- **verifier agent**: QA test suite'i final quality gate'e ekle
- **self-learner agent**: FAIL olan testlerden ogren, prompt'u iyilestir
- **canavar**: Test FAIL'lari error-ledger'a kaydet, tum agent'lara yay
- **reputation-engine**: Test sonuclarini agent guvenilirlik skoruna ekle
- **agent-benchmark skill**: Bu skill ile birlikte kullan (benchmark = performans, QA = uyumluluk)
