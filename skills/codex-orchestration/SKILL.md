---
name: codex-orchestration
description: OpenAI Codex CLI + Claude Code (Hizir) birlikte kullanim rehberi. Is dagitim pattern'leri, GitHub Actions workflow ornekleri, review dongusu ve iki AI yazilim asistaninin guclu yanlarini birlestiren orchestration stratejileri.
---

# Codex + Claude Code Orchestration

## Guc Dagilimi Matrisi

| Yetenek | Codex CLI | Claude Code (Hizir) | Kazanan |
|---------|-----------|---------------------|---------|
| Hiz | Hizli (o4-mini) | Orta (opus) | Codex |
| Maliyet | Ucuz (~$1.10/1M input) | Pahalı (opus pricing) | Codex |
| Context window | Sinirli | 1M token | Claude Code |
| Multi-agent | YOK (tek agent) | 134+ agent swarm | Claude Code |
| Hook/self-learning | YOK | Tam destek (53 hook) | Claude Code |
| Memory/state | Stateless (her cagri bagimsiz) | Persistent memory | Claude Code |
| Code review | Basit lint | Derinlemesine + security | Claude Code |
| Bulk refactoring | Cok iyi (hiz+ucuz) | Iyi ama pahali | Codex |
| Mimari karar | Zayif | Guclu (architect agent) | Claude Code |
| Test yazma | Iyi | Iyi + TDD workflow | Esit |
| Security audit | Basit | 3-katman (SAST + review + manual) | Claude Code |
| CI/CD entegrasyonu | GitHub native | GitHub Actions + webhook | Esit |

---

## Kullanim Senaryolari

### Senaryo 1: Codex Implement, Claude Code Review

**En yaygin ve etkili pattern.**

```
1. Claude Code → plan.md olusturur (architect agent)
2. Codex → plan.md'ye gore implement eder (full-auto mode)
3. Codex → PR acar
4. Claude Code → PR review eder (code-reviewer + security-reviewer)
5. Codex → Review bulgularini fix eder
6. Claude Code → Final verify + merge onay
```

**GitHub Actions Workflow:**

```yaml
# .github/workflows/codex-implement-claude-review.yml
name: Codex + Claude Code Pipeline

on:
  issues:
    types: [labeled]

jobs:
  codex-implement:
    if: contains(github.event.label.name, 'codex-task')
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Codex Implementation
        env:
          OPENAI_API_KEY: ${{ secrets.OPENAI_API_KEY }}
        run: |
          npx codex --approval-mode full-auto \
            --quiet \
            -q "Implement the task described in issue #${{ github.event.issue.number }}. Follow the plan if provided."
      - name: Create PR
        env:
          GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
        run: |
          git checkout -b codex/issue-${{ github.event.issue.number }}
          git add -A
          git commit -m "feat: implement issue #${{ github.event.issue.number }} [codex]"
          git push -u origin codex/issue-${{ github.event.issue.number }}
          gh pr create --title "Codex: Issue #${{ github.event.issue.number }}" \
            --body "Automated implementation by Codex CLI. Awaiting Claude Code review."

  claude-review:
    needs: codex-implement
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Claude Code Review
        env:
          ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}
        run: |
          # claude-review workflow zaten mevcut
          claude -p "Review the PR changes. Run code-reviewer + security-reviewer. Report findings."
```

### Senaryo 2: Dual Review (Codex Hizli + Claude Code Derin)

```yaml
# .github/workflows/dual-review.yml
name: Dual AI Review

on:
  pull_request:
    types: [opened, synchronize]

jobs:
  codex-quick-review:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Codex Quick Lint Review
        run: |
          npx codex --approval-mode full-auto -q \
            "Review the diff for obvious issues: lint errors, typos, missing imports, type errors. Be brief."

  claude-deep-review:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Claude Code Deep Review
        run: |
          claude -p "Deep review: architecture, security, performance, edge cases. Use code-reviewer + security-reviewer agents."
```

### Senaryo 3: Codex Batch Task Dispatch

Birden fazla kuuk task'i Codex'e dagit, Claude Code koordine etsin.

```bash
#!/bin/bash
# batch-codex-tasks.sh

TASKS=(
  "Add input validation to all API endpoints in src/api/"
  "Convert all var declarations to const/let in src/utils/"
  "Add JSDoc comments to all exported functions in src/lib/"
  "Fix all TypeScript strict mode errors in src/models/"
)

for i in "${!TASKS[@]}"; do
  echo "Task $((i+1)): ${TASKS[$i]}"
  npx codex --approval-mode full-auto --quiet -q "${TASKS[$i]}" &
done

wait
echo "All Codex tasks complete. Running Claude Code verification..."
claude -p "Verify all changes: build, test, lint. Report issues."
```

---

## Review Dongusu Pattern (5 Faz)

```
PHASE 1: PLAN (Claude Code)
├── architect agent ile plan olustur
├── Task'lari tanimla
├── Kabul kriterleri belirle
└── plan.md veya GitHub issue olustur

PHASE 2: IMPLEMENT (Codex)
├── codex --approval-mode full-auto
├── Her task icin ayri branch
├── PR ac
└── Codex kendi testlerini de yazabilir

PHASE 3: REVIEW (Claude Code)
├── code-reviewer: Kalite, pattern, best practice
├── security-reviewer: Guvenlik aciklari
├── verifier: Build + test + lint
└── VERDICT: PASS / FAIL + feedback

PHASE 4: FIX (Codex)
├── Claude Code'un feedback'ini al
├── Sadece belirtilen sorunlari duzelt
├── Yeni feature EKLEME
└── Tekrar PR guncelle

PHASE 5: MERGE (Claude Code)
├── Final verify
├── Tum testler geciyor mu?
├── Security temiz mi?
└── Merge onay + deploy
```

---

## Codex CLI Kullanim Pattern'leri

### Temel Komutlar

```bash
# Interaktif mod (terminal'de calisir)
codex

# Tek seferlik task (non-interactive)
codex -q "task aciklamasi"

# Full auto (onay istemeden yapar)
codex --approval-mode full-auto -q "task"

# Belirli model
codex --model o4-mini -q "task"

# Quiet mode (CI/CD icin)
codex --quiet -q "task"
```

### CI/CD Entegrasyonu

```bash
# GitHub Actions icinde
CODEX_QUIET=1 npx codex --approval-mode full-auto -q "$TASK"

# Cikti kontrolu
if [ $? -eq 0 ]; then
  echo "Codex task basarili"
else
  echo "Codex task basarisiz, Claude Code'a devret"
  claude -p "Fix the failed Codex task: $TASK"
fi
```

---

## Maliyet Karsilastirmasi

| Senaryo | Sadece Claude Code | Sadece Codex | Hybrid |
|---------|-------------------|-------------|--------|
| 10 dosya refactoring | ~$2-5 | ~$0.30-0.50 | ~$0.80 |
| Security review | ~$1-3 (derinlemesine) | ~$0.20 (yuzeysel) | ~$1.20 |
| Test yazma (20 test) | ~$3-5 | ~$0.50-1.00 | ~$1.50 |
| Mimari planlama | ~$2-4 (detayli) | ~$0.30 (yuzeysel) | ~$2.30 |
| **Toplam** | **~$8-17** | **~$1.30-2.00** | **~$5.80** |

**Hybrid strateji %40-60 maliyet tasarrufu saglar.**

Formul: Codex'i "volume work" icin, Claude Code'u "judgment work" icin kullan.

---

## Sinirlari ve Dikkat Edilecekler

### Codex CLI Sinirlari

| Ozellik | Durum | Not |
|---------|-------|-----|
| Multi-agent | YOK | Tek agent, swarm mumkun degil |
| Hook sistemi | YOK | PreToolUse/PostToolUse yok |
| Self-learning | YOK | Hatalardan ders cikarma yok |
| Persistent memory | YOK | Her cagri bagimsiz |
| Agent personas | YOK | Tek persona |
| Skill auto-discovery | KISMI | SKILL.md okuyabilir ama agent.md'leri kullanamaz |
| Context window | SINIRLI | 1M degil, daha kucuk |
| Tool calling | SINIRLI | Bash + file read/write |

### Ne Zaman Codex KULLANMA

1. Mimari kararlar gerektiren isler (Claude Code'un architect agent'i lazim)
2. Security-critical degisiklikler (Claude Code'un 3-katman security review'i lazim)
3. State gerektiren uzun isler (Codex stateless)
4. Multi-file complex debug (Claude Code'un sleuth + coroner agent'lari lazim)
5. Production deploy kararlari (Claude Code'un verify + ship workflow'u lazim)

### Ne Zaman Codex KULLAN

1. Bulk lint/format fix
2. Boilerplate kod olusturma
3. Basit test yazma
4. Dokumantasyon olusturma/guncelleme
5. Dependency upgrade (basit)
6. Tekrarlayan refactoring (rename, extract method)
7. i18n key ekleme
8. Type annotation ekleme
