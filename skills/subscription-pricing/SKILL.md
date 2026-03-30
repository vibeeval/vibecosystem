---
name: subscription-pricing
description: Subscription pricing strategies, tier design, regional pricing (PPP), price anchoring, churn reduction, and conversion optimization for mobile apps and SaaS. Use when designing pricing pages, setting subscription tiers, or optimizing conversion rates.
---

# Subscription Pricing

Data-driven pricing strategies for mobile apps and SaaS products.

## Tier Design (Good / Better / Best)

### The 3-Tier Framework

```
GOOD (Free / Basic):
  Purpose: Acquisition, activation, habit formation
  Features: Core functionality, enough to hook
  Price: Free or low entry ($0 - $4.99/mo)
  Goal: Get users in the door

BETTER (Pro / Premium):
  Purpose: Primary revenue driver
  Features: Full functionality, no limits
  Price: Category-appropriate ($9.99 - $19.99/mo)
  Goal: Convert activated free users
  Tip: This should be the highlighted/recommended plan

BEST (Team / Enterprise / Ultimate):
  Purpose: Revenue maximizer, B2B upsell
  Features: Everything + collaboration, priority support, API
  Price: Premium ($29.99+/mo or custom)
  Goal: Capture high-value users willing to pay more
  Tip: Acts as price anchor (makes Pro look affordable)
```

### Single-Tier Alternative
For simple apps, one premium tier is fine:
```
FREE: Basic features
PREMIUM: Everything ($X.99/mo or $X.99/year)
```

### Feature Distribution Rules
- **Free must be useful**: Users need to experience value before paying
- **Pro must feel essential**: The gap between free and pro should create natural desire
- **Enterprise is aspirational**: Even if few buy it, it anchors the Pro price downward
- **Never put security/privacy behind paywall**: Trust features should be free
- **Limit by usage, not by quality**: "10 projects" is better than "low-res export"

## Price Anchoring

### The Decoy Effect
Present 3 options where one is intentionally less attractive:

```
Weekly:   $6.99/week   ($27.96/mo)  <-- Expensive anchor
Monthly:  $14.99/mo                  <-- Decoy (close to annual per-month)
Annual:   $59.99/year  ($5.00/mo)   <-- Target (best value, highlighted)
```

The weekly plan exists to make annual look like a steal.

### Anchoring Techniques
1. **Show most expensive first**: Left-to-right or top-to-bottom, expensive -> cheap
2. **Highlight savings**: "Save 60%" badge on annual plan
3. **Per-day framing**: "$0.16/day" next to "$59.99/year"
4. **Cross-out price**: ~~$14.99/mo~~ $4.99/mo (first 3 months)
5. **"Most Popular" badge**: Social proof on the target plan

### Price Anchor Examples by Category

| Category | Weekly | Monthly | Annual | Target |
|----------|--------|---------|--------|--------|
| Fitness | $4.99 | $12.99 | $49.99 | Annual |
| Productivity | -- | $9.99 | $79.99 | Annual |
| Games | $1.99 | $4.99 | $29.99 | Weekly |
| Education | -- | $9.99 | $59.99 | Annual |
| AI Tools | -- | $19.99 | $99.99 | Monthly |
| Dating | $4.99 | $14.99 | $79.99 | Monthly |

## Charm Pricing

### Rules
- **$X.99 > $X.00**: $9.99 converts better than $10.00
- **$X.95 for premium feel**: $49.95 feels more premium than $49.99
- **Round numbers for enterprise**: $99/mo, $499/mo (simplicity signals confidence)
- **Avoid $X.49, $X.50**: These feel arbitrary

### Mobile-Specific
- Apple/Google have predefined price points (price tiers)
- Stick to their tier system for consistent localization
- Apple Tier 1 = $0.99, Tier 6 = $5.99, Tier 10 = $9.99

## Per-Day Framing

Convert annual prices to daily equivalents:

| Annual Price | Per Day | Messaging |
|-------------|---------|-----------|
| $29.99 | $0.08 | "Less than a dime a day" |
| $49.99 | $0.14 | "Less than your morning coffee" |
| $79.99 | $0.22 | "Less than a quarter a day" |
| $99.99 | $0.27 | "27 cents a day" |

Per-day framing works best for annual plan promotion on the paywall.

## Regional Pricing (PPP)

### Purchasing Power Parity Multipliers

| Country/Region | Multiplier | $9.99 USD becomes | Notes |
|---------------|------------|-------------------|-------|
| United States | 1.00 | $9.99 | Base price |
| United Kingdom | 0.95 | $9.49 (GBP 7.49) | Slightly lower |
| European Union | 0.90 | $8.99 (EUR 8.49) | VAT included |
| Canada | 0.90 | CAD 12.99 | |
| Australia | 0.85 | AUD 14.99 | |
| Japan | 0.80 | JPY 1,480 | |
| South Korea | 0.70 | KRW 9,900 | |
| Brazil | 0.45 | BRL 24.90 | High impact market |
| Mexico | 0.50 | MXN 99 | |
| Turkey | 0.35 | TRY 99.99 | Very price sensitive |
| India | 0.30 | INR 249 | Huge market, low ARPU |
| Indonesia | 0.30 | IDR 49,000 | |
| Philippines | 0.35 | PHP 249 | |
| Egypt | 0.30 | EGP 99 | |
| Nigeria | 0.25 | NGN 1,999 | Lowest tier |
| Poland | 0.65 | PLN 29.99 | |
| Thailand | 0.40 | THB 149 | |
| Vietnam | 0.30 | VND 69,000 | |
| Argentina | 0.25 | ARS 999 | Currency volatility |
| Colombia | 0.40 | COP 19,900 | |

### Implementation
- Apple: Set prices per region in App Store Connect
- Google: Set prices per region in Play Console
- RevenueCat: Products sync automatically per region
- Review quarterly: Currency fluctuations affect real purchasing power

### Rules
- **Never go below cost**: Calculate per-user API/infra cost before discounting
- **A/B test regional prices**: Don't assume PPP tables are optimal
- **Avoid VPN arbitrage**: Use store-level pricing, not custom server-side logic
- **Communicate value, not discount**: Show local price without reference to USD

## Introductory Offers

### Types

| Type | How It Works | Best For |
|------|-------------|----------|
| Free trial | No charge for N days, then full price | Most apps |
| Pay-up-front | Discounted first period ($0.99/mo x3) | Price-sensitive markets |
| Pay-as-you-go | Discounted recurring ($4.99/mo for 6 months) | Retention-focused |

### Free Trial Optimization
- **3 days**: Games, impulse apps (quick value demonstration)
- **7 days**: Most categories (standard, well-tested)
- **14 days**: B2B, productivity (complex value proposition)
- **30 days**: Streaming, music (industry standard)

### Introductory Offer Strategy
```
New user: Free trial (7 days)
Trial expired, didn't convert: Intro offer ($0.99/first month)
Lapsed subscriber (30+ days): Win-back offer (50% off 3 months)
Active subscriber on monthly: Upgrade offer (annual at 40% off)
```

## Promotional Offers (Post-First-Purchase)

### Win-Back Campaign
For users whose subscription expired:
```
Day 7 after expiry:  "We miss you! 50% off for 3 months"
Day 30 after expiry: "Come back: first month free"
Day 90 after expiry: "Your data is still here. Resubscribe at 60% off"
```

### Upgrade Offers
For monthly subscribers:
```
After 3 months: "Switch to annual and save 40%"
After renewal:  "Loyal customer offer: annual at 50% off"
```

### Downgrade Prevention
Before cancellation:
```
"Before you go: switch to our $4.99/mo basic plan"
"Pause your subscription for 1 month instead?"
"What if we offered 3 months at 50% off?"
```

## Churn Reduction

### Grace Period
- Allow 7-16 days for payment retry after failed charge
- Keep access during grace period
- Send increasingly urgent emails (day 1, 3, 7, 14)

### Billing Retry
```
Day 0: Payment fails
Day 1: Auto-retry #1 + "Update payment method" email
Day 3: Auto-retry #2 + "Your access may be interrupted" email
Day 7: Auto-retry #3 + "Last chance" email + in-app banner
Day 14: Auto-retry #4 + downgrade to free tier
Day 16: Subscription canceled
```

### Churn Prevention Signals
Watch for these pre-churn behaviors:
- Decreasing usage frequency
- Fewer premium features used
- Support tickets about billing
- App uninstalled (if trackable)

### Retention Tactics
1. **Engagement hooks**: Push notifications about new content/features
2. **Progress tracking**: "You've completed 45 workouts this year"
3. **Switching cost**: Export is free, but formatting is premium
4. **Community**: Forums, challenges, social features
5. **Regular updates**: Monthly feature releases signal ongoing value

## A/B Testing Methodology

### What to Test
- Price points ($9.99 vs $12.99)
- Trial duration (7 days vs 14 days)
- Paywall copy (benefit-focused vs feature-focused)
- Plan presentation (2 plans vs 3 plans)
- CTA text ("Start Free Trial" vs "Try Premium Free")
- Discount amount (30% off vs 50% off)

### Sample Size
For reliable results:
```
Minimum per variant:   1,000 users
Recommended:           5,000+ users
Confidence level:      95%
Minimum detectable effect: 10% relative change

Example: Testing $9.99 vs $12.99 monthly
  Base conversion: 5%
  MDE: 10% relative (0.5 percentage points)
  Required: ~15,000 users per variant
  Duration: depends on traffic
```

### Rules
- **Test one variable at a time**: Price OR copy OR layout, not all three
- **Run for full billing cycles**: A 3-day test of annual pricing is meaningless
- **Segment results**: New users vs returning vs lapsed may behave differently
- **Revenue, not conversion**: Higher price with lower conversion can yield more revenue
- **Statistical significance**: Do not call a test until p < 0.05

## Competitor Benchmarking Framework

### Data Collection
For each competitor, capture:
```
App name:
Category:
Rating / review count:
Pricing:
  - Free tier: what's included
  - Paid plans: price, features, trial
  - Pricing model: flat / tiered / usage
Paywall type: hard / soft / freemium / metered
Trial duration:
Feature comparison:
  - Feature A: [free/paid/N/A]
  - Feature B: [free/paid/N/A]
Estimated downloads / revenue (Sensor Tower, data.ai):
Notes:
```

### Positioning Strategy
- **Undercut**: 20-30% cheaper than market leader (volume play)
- **Match**: Same price, better features (value play)
- **Premium**: Higher price, premium positioning (margin play)
- **Freemium**: Free core, monetize power users (market share play)

## Pricing Page UI Best Practices

### Layout
- **Highlight recommended plan**: Border, badge, or color
- **Show savings on annual**: Badge or strikethrough
- **Feature comparison table**: Check marks, clear rows
- **FAQ section below**: Address objections (cancel anytime, refund policy)

### Elements
```
[ ] Plan name (Good / Pro / Best -- or domain-specific names)
[ ] Price with period (/mo, /yr)
[ ] Per-day equivalent for annual
[ ] Savings badge ("Save 60%")
[ ] Feature list with checkmarks
[ ] CTA button ("Start Free Trial" or "Subscribe")
[ ] Trial terms text below CTA
[ ] "Most Popular" badge on target plan
[ ] Money-back guarantee badge (if applicable)
[ ] Restore Purchases link
[ ] Terms of Service + Privacy Policy links
```

### Mobile-Specific
- **Bottom CTA**: Primary action button at bottom of screen (thumb zone)
- **Swipeable plans**: Cards that swipe horizontally on mobile
- **Minimal scrolling**: Entire paywall should fit in 1-2 screens
- **System fonts**: Load fast, feel native
- **Platform-appropriate styling**: iOS / Material Design conventions

## Common Pitfalls

```
Pricing too low:
  Underpricing signals low value and makes revenue targets impossible.
  -> Price based on value delivered, not cost to build.

Too many tiers:
  More than 3 tiers creates decision paralysis.
  -> Stick to 2-3 plans. Use add-ons for extras.

Ignoring LTV for conversion rate:
  A cheaper price may convert more but yield less total revenue.
  -> Optimize for revenue per user, not conversion percentage.

Not testing prices:
  Most developers set a price once and never change it.
  -> A/B test quarterly with new user cohorts.

Uniform global pricing:
  $9.99/mo in India prices out 95% of the market.
  -> Use PPP-adjusted regional pricing.

No downgrade path:
  Users who would downgrade instead cancel entirely.
  -> Offer a cheaper tier as a cancel-prevention step.
```

**Remember**: Pricing is a product decision that you revisit, not a one-time choice. Test systematically, learn from data, and adjust quarterly. The goal is not the highest price or the most subscribers -- it is maximum sustainable revenue.
