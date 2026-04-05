---
name: circuit-breaker
description: Agent hata toleransi ve devre kesici pattern. Ust uste hata yapan agent'i durdur, cooldown uygula, fallback'e gec. Kaskatli hatalari ve sonsuz retry dongularini onler.
---

# Circuit Breaker for Agents

Agent'lar da servisler gibi basarisiz olabilir. Ayni hatayi tekrar tekrar denemek token israf eder ve sorunu cozmez. Circuit breaker bunu onler.

## 3 Durum

```
CLOSED (Normal)
  Agent calisir, hatalar sayilir.
  Hata esigi asilirsa → OPEN'a gec.

OPEN (Devre Kesik)
  Agent CALISTIRILMAZ.
  Cooldown suresi boyunca bekle.
  Cooldown bitince → HALF-OPEN'a gec.

HALF-OPEN (Test)
  Tek bir istek gonder.
  Basarili → CLOSED'a don.
  Basarisiz → OPEN'a geri don (cooldown uzat).
```

```
     basarili          hata esigi
  ┌──────────┐      ┌───────────┐
  │          │      │           │
  ▼          │      ▼           │
CLOSED ──────┼── OPEN ────── HALF-OPEN
  ▲          │      │           │
  │          │      │           │
  └──────────┘      └───────────┘
     normal          cooldown bitti
```

## Konfigrasyon

```typescript
interface CircuitBreakerConfig {
  failureThreshold: number    // Kac hata sonrasi OPEN (default: 3)
  cooldownMs: number          // OPEN'da bekleme suresi (default: 60000 = 1 dk)
  halfOpenMaxAttempts: number // HALF-OPEN'da max deneme (default: 1)
  resetAfterMs: number        // Hata sayacini sifirla (default: 300000 = 5 dk)
  onOpen?: () => void         // OPEN'a gecince cagrilir
  onClose?: () => void        // CLOSED'a donunce cagrilir
}

const DEFAULT_CONFIG: CircuitBreakerConfig = {
  failureThreshold: 3,
  cooldownMs: 60000,
  halfOpenMaxAttempts: 1,
  resetAfterMs: 300000,
}
```

## Uygulama

### Agent Seviyesinde

```typescript
class AgentCircuitBreaker {
  private state: 'CLOSED' | 'OPEN' | 'HALF-OPEN' = 'CLOSED'
  private failures = 0
  private lastFailureTime = 0
  private config: CircuitBreakerConfig

  constructor(private agentName: string, config?: Partial<CircuitBreakerConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config }
  }

  canExecute(): boolean {
    if (this.state === 'CLOSED') return true

    if (this.state === 'OPEN') {
      const elapsed = Date.now() - this.lastFailureTime
      if (elapsed >= this.config.cooldownMs) {
        this.state = 'HALF-OPEN'
        return true
      }
      return false
    }

    // HALF-OPEN: tek denemeye izin ver
    return true
  }

  recordSuccess(): void {
    this.failures = 0
    if (this.state === 'HALF-OPEN') {
      this.state = 'CLOSED'
      this.config.onClose?.()
    }
  }

  recordFailure(): void {
    this.failures++
    this.lastFailureTime = Date.now()

    if (this.state === 'HALF-OPEN') {
      this.state = 'OPEN'
      return
    }

    if (this.failures >= this.config.failureThreshold) {
      this.state = 'OPEN'
      this.config.onOpen?.()
    }
  }

  getStatus(): { state: string; failures: number; agent: string } {
    return { state: this.state, failures: this.failures, agent: this.agentName }
  }
}
```

### Kullanim Ornegi

```typescript
const breakers: Record<string, AgentCircuitBreaker> = {
  'code-reviewer': new AgentCircuitBreaker('code-reviewer', { failureThreshold: 3 }),
  'security-reviewer': new AgentCircuitBreaker('security-reviewer', { failureThreshold: 2 }),
  'sleuth': new AgentCircuitBreaker('sleuth', { failureThreshold: 3 }),
}

async function spawnAgent(name: string, task: string): Promise<string> {
  const breaker = breakers[name]

  if (!breaker?.canExecute()) {
    console.warn(`Circuit OPEN: ${name} -- fallback kullaniliyor`)
    return executeFallback(name, task)
  }

  try {
    const result = await executeAgent(name, task)
    breaker.recordSuccess()
    return result
  } catch (error) {
    breaker.recordFailure()
    console.error(`${name} basarisiz (${breaker.getStatus().failures}/${3})`)

    if (!breaker.canExecute()) {
      return executeFallback(name, task)
    }
    throw error
  }
}
```

## Fallback Zinciri

Agent devre disiyken ne yapilacagi:

| Agent | Fallback 1 | Fallback 2 | Fallback 3 |
|-------|-----------|-----------|-----------|
| code-reviewer | Manuel Grep review | Basit lint calistir | Kullaniciya bildir |
| security-reviewer | Grep ile secret scan | SAST tool calistir | Kullaniciya bildir |
| sleuth | scout ile arastir | Manuel debug | Kullaniciya bildir |
| kraken | spark ile parcali fix | Manuel implement | Kullaniciya bildir |
| verifier | Manuel build + test | Sadece build kontrol | Kullaniciya bildir |
| architect | planner ile basit plan | Kullaniciya sor | - |
| build-error-resolver | Manuel hata oku + fix | Kullaniciya bildir | - |

## Hata Tipleri

Her hata ayni agirlikta degil:

| Hata Tipi | Sayac Etkisi | Ornek |
|-----------|:------------:|-------|
| API timeout | +1 | Anthropic API timeout |
| Rate limit | +0 (beklenir) | 429 Too Many Requests |
| Invalid output | +1 | Agent bos cikti verdi |
| Tool error | +0.5 | Bash komutu basarisiz |
| Logic error | +2 | Agent yanlis dosyayi duzenledi |
| Crash | +3 | Agent tamamen cokktu |

## Monitoring

### Status Dashboard

```bash
#!/bin/bash
# scripts/circuit-status.sh

echo "=== Agent Circuit Breaker Status ==="
echo ""
printf "%-25s %-10s %-10s\n" "Agent" "State" "Failures"
echo "-------------------------------------------"

# Canavar skill-matrix'ten oku
if [ -f ~/.claude/canavar/skill-matrix.json ]; then
  cat ~/.claude/canavar/skill-matrix.json | \
    jq -r '.agents | to_entries[] | "\(.key) \(.value.failures // 0) \(.value.state // "CLOSED")"' | \
    while read name failures state; do
      if [ "$state" = "OPEN" ]; then
        printf "%-25s \033[31m%-10s\033[0m %-10s\n" "$name" "$state" "$failures"
      elif [ "$state" = "HALF-OPEN" ]; then
        printf "%-25s \033[33m%-10s\033[0m %-10s\n" "$name" "$state" "$failures"
      else
        printf "%-25s \033[32m%-10s\033[0m %-10s\n" "$name" "CLOSED" "$failures"
      fi
    done
fi
```

### Alert Kurallari

```
WARN:  Agent 2+ ust uste basarisiz
ERROR: Circuit OPEN'a gecti
CRIT:  3+ agent ayni anda OPEN (sistemik sorun)
```

## Exponential Backoff

Tekrarlayan hatalarda cooldown suresini artir:

```
1. hata → 1 dakika cooldown
2. hata → 2 dakika cooldown
3. hata → 4 dakika cooldown
4. hata → 8 dakika cooldown
Max: 15 dakika

Basarili calisma → cooldown sifirla
```

## Anti-Pattern'ler

```
YAPMA: Her hatada agent'i hemen tekrar calistir
YAP:   Circuit breaker ile kontrol et

YAPMA: Hatalari sessizce yut
YAP:   Logla, say, esik kontrolu yap

YAPMA: Tek hata tipine gore devre kes
YAP:   Hata tipine gore agirlik ver

YAPMA: Sonsuz retry dongusu
YAP:   Max retry + exponential backoff + fallback

YAPMA: Tum agent'lar icin ayni esik
YAP:   Kritik agent'lar (security) icin dusuk esik
```

## vibecosystem Entegrasyonu

- **auto-skill-activation rule**: Agent fail oldugunda fallback zincirini kullanir
- **canavar**: Hata sayilarini skill-matrix.json'a kaydeder
- **reputation-engine**: Circuit breaker durumunu guvenilirlik skoruna yansitir
- **sentinel agent**: Circuit OPEN alert'lerini yonetir
- **self-learner agent**: Tekrarlayan hatalardan pattern ogrenir
- **qa-loop rule**: 3x fail sonrasi escalation zaten mevcut -- circuit breaker bunu destekler
