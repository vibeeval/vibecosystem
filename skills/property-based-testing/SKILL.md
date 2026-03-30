---
name: property-based-testing
description: Property-based testing (PBT) patterns with fast-check (JS/TS), Hypothesis (Python), and gopter (Go). Generate random inputs, define invariants, shrink failures to minimal cases. Adapted from Trail of Bits. Use when testing pure functions, parsers, serializers, state machines, or any code where example-based tests miss edge cases.
---

# Property-Based Testing

Instead of testing specific examples, define properties that must hold for ALL inputs. The framework generates hundreds of random inputs and finds the smallest failing case.

## When to Use PBT

| Use Case | Property |
|----------|----------|
| Serialization roundtrip | `deserialize(serialize(x)) === x` |
| Sort function | Output is ordered AND contains same elements |
| Parser | Never crashes on any input |
| Encoder/decoder | `decode(encode(x)) === x` |
| State machine | Invariants hold after any sequence of operations |
| Math/financial | Associativity, commutativity, identity, bounds |
| API handler | Never returns 500 on valid input |
| Data transformation | Output schema matches specification |

## When NOT to Use PBT

- UI rendering tests (use visual regression)
- Integration tests with external services (use contract tests)
- Tests that need specific business scenarios (use example tests)
- Tests where the oracle is as complex as the implementation

## fast-check (JavaScript/TypeScript)

### Setup
```bash
npm install --save-dev fast-check
```

### Basic Property

```typescript
import fc from 'fast-check'

// Property: sorting is idempotent
test('sort is idempotent', () => {
  fc.assert(
    fc.property(fc.array(fc.integer()), (arr) => {
      const sorted = [...arr].sort((a, b) => a - b)
      const sortedTwice = [...sorted].sort((a, b) => a - b)
      expect(sorted).toEqual(sortedTwice)
    })
  )
})

// Property: serialization roundtrip
test('JSON roundtrip preserves data', () => {
  fc.assert(
    fc.property(fc.jsonValue(), (value) => {
      expect(JSON.parse(JSON.stringify(value))).toEqual(value)
    })
  )
})
```

### Custom Arbitraries

```typescript
// Generate valid email addresses
const emailArb = fc.tuple(
  fc.stringOf(fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz0123456789'.split('')), { minLength: 1 }),
  fc.constantFrom('gmail.com', 'example.com', 'test.org')
).map(([local, domain]) => `${local}@${domain}`)

// Generate valid user objects
const userArb = fc.record({
  id: fc.uuid(),
  name: fc.string({ minLength: 1, maxLength: 100 }),
  email: emailArb,
  age: fc.integer({ min: 0, max: 150 }),
  role: fc.constantFrom('admin', 'user', 'viewer')
})

// Generate valid but adversarial strings
const adversarialStringArb = fc.oneof(
  fc.constant(''),
  fc.constant(' '),
  fc.constant('\0'),
  fc.constant('<script>alert(1)</script>'),
  fc.constant("Robert'); DROP TABLE users;--"),
  fc.constant('../../../etc/passwd'),
  fc.unicodeString(),
  fc.string({ minLength: 10000, maxLength: 100000 })  // Very long
)
```

### Stateful Testing (Model-Based)

```typescript
// Test a cache against a simple Map model
class CacheModel {
  private model = new Map<string, string>()

  set(key: string, value: string): void { this.model.set(key, value) }
  get(key: string): string | undefined { return this.model.get(key) }
  delete(key: string): void { this.model.delete(key) }
  size(): number { return this.model.size }
}

const cacheCommands = [
  fc.tuple(fc.string(), fc.string()).map(([k, v]) => ({
    check: (model: CacheModel) => true,
    run: (model: CacheModel, real: Cache) => {
      model.set(k, v)
      real.set(k, v)
      expect(real.get(k)).toBe(model.get(k))
    },
    toString: () => `set(${k}, ${v})`
  })),
  fc.string().map((k) => ({
    check: (model: CacheModel) => true,
    run: (model: CacheModel, real: Cache) => {
      model.delete(k)
      real.delete(k)
      expect(real.get(k)).toBe(model.get(k))
    },
    toString: () => `delete(${k})`
  }))
]

test('cache behaves like Map', () => {
  fc.assert(
    fc.property(fc.commands(cacheCommands), (cmds) => {
      const model = new CacheModel()
      const real = new Cache()
      fc.modelRun(() => ({ model, real }), cmds)
    })
  )
})
```

## Hypothesis (Python)

### Setup
```bash
pip install hypothesis
```

### Basic Properties

```python
from hypothesis import given, strategies as st, settings

@given(st.lists(st.integers()))
def test_sort_preserves_length(xs):
    assert len(sorted(xs)) == len(xs)

@given(st.lists(st.integers()))
def test_sort_preserves_elements(xs):
    assert sorted(sorted(xs)) == sorted(xs)

@given(st.text())
def test_encode_decode_roundtrip(s):
    assert s.encode('utf-8').decode('utf-8') == s

# With settings
@settings(max_examples=1000, deadline=None)
@given(st.dictionaries(st.text(), st.integers()))
def test_dict_operations(d):
    import json
    assert json.loads(json.dumps(d)) == d
```

### Custom Strategies

```python
from hypothesis import strategies as st

# Valid email strategy
emails = st.builds(
    lambda local, domain: f"{local}@{domain}",
    local=st.from_regex(r'[a-z0-9]{1,20}', fullmatch=True),
    domain=st.sampled_from(['gmail.com', 'example.com'])
)

# Valid user strategy
users = st.fixed_dictionaries({
    'name': st.text(min_size=1, max_size=100),
    'email': emails,
    'age': st.integers(min_value=0, max_value=150),
    'role': st.sampled_from(['admin', 'user', 'viewer'])
})
```

## gopter (Go)

### Setup
```bash
go get github.com/leanovate/gopter
```

### Basic Property

```go
func TestSortIdempotent(t *testing.T) {
    properties := gopter.NewProperties(gopter.DefaultTestParameters())

    properties.Property("sort is idempotent", prop.ForAll(
        func(xs []int) bool {
            sorted := make([]int, len(xs))
            copy(sorted, xs)
            sort.Ints(sorted)

            sortedTwice := make([]int, len(sorted))
            copy(sortedTwice, sorted)
            sort.Ints(sortedTwice)

            return reflect.DeepEqual(sorted, sortedTwice)
        },
        gen.SliceOf(gen.Int()),
    ))

    properties.TestingRun(t)
}
```

## Property Catalog

### Algebraic Properties

| Property | Definition | Example |
|----------|-----------|---------|
| Identity | `f(x, identity) === x` | `add(x, 0) === x` |
| Commutativity | `f(a, b) === f(b, a)` | `add(a, b) === add(b, a)` |
| Associativity | `f(f(a, b), c) === f(a, f(b, c))` | `add(add(a, b), c) === add(a, add(b, c))` |
| Idempotency | `f(f(x)) === f(x)` | `sort(sort(xs)) === sort(xs)` |
| Roundtrip | `g(f(x)) === x` | `decode(encode(x)) === x` |
| Invariant | `property(f(x)) === true` | `length(sort(xs)) === length(xs)` |

### Safety Properties

| Property | Check |
|----------|-------|
| No crash | Function never throws for any valid input |
| Bounded output | Output size is proportional to input size |
| No mutation | Input is not modified by the function |
| Deterministic | Same input always produces same output |
| Monotonic | If `a <= b` then `f(a) <= f(b)` |

## Shrinking

When a property fails, the framework automatically shrinks the failing input to the smallest case that still fails:

```
Original failing input: [482, -1, 0, 99, -384, 7, 42, 0, -1]
Shrunk to: [1, 0]

This tells you the bug is about: handling zero in a list with other elements
```

Tips:
- Custom arbitraries should define custom shrinkers
- If shrinking takes too long, limit with `{ endOnFailure: true }`
- Shrunk examples make great regression tests

## Integration with vibecosystem

- **tdd-guide agent**: Recommend PBT for pure functions and serialization
- **qa-engineer agent**: Use PBT for edge case discovery
- **arbiter agent**: Run PBT suites as part of test validation
- **mocksmith agent**: Generate test data using PBT arbitraries

Inspired by [Trail of Bits](https://github.com/trailofbits/skills) property-based-testing plugin.
