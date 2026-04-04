---
name: revenuecat-patterns
description: RevenueCat SDK entegrasyon pattern'leri. iOS (Swift), Android (Kotlin), React Native ve Flutter icin setup, offerings, entitlement checking, webhook integration, StoreKit 2 migration ve sandbox testing.
---

# RevenueCat Integration Patterns

## SDK Setup

### iOS (Swift + StoreKit 2)

```swift
// AppDelegate.swift veya @main App
import RevenueCat

Purchases.logLevel = .debug // sandbox'ta acik tut
Purchases.configure(
    with: .init(withAPIKey: "appl_XXXXXXXXXXXXX")
        .with(usesStoreKit2IfAvailable: true)
)

// Kullanici kimlik eslestirme (auth sonrasi)
Purchases.shared.logIn("user_id_from_your_backend") { customerInfo, created, error in
    // created: true ise yeni kullanici
}

// Logout
Purchases.shared.logOut { customerInfo, error in }
```

### Android (Kotlin)

```kotlin
// Application.onCreate()
Purchases.logLevel = LogLevel.DEBUG
Purchases.configure(
    PurchasesConfiguration.Builder(this, "goog_XXXXXXXXXXXXX")
        .appUserID("user_id") // null ise anonim
        .build()
)
```

### React Native

```typescript
import Purchases from 'react-native-purchases';

// App.tsx useEffect icinde
await Purchases.configure({
  apiKey: Platform.OS === 'ios'
    ? 'appl_XXXXXXXXXXXXX'
    : 'goog_XXXXXXXXXXXXX',
  appUserID: userId ?? undefined, // null = anonim
});
```

### Flutter

```dart
// main.dart
await Purchases.configure(
  PurchasesConfiguration('appl_XXXXXXXXXXXXX')
    ..appUserID = userId
);
```

---

## Offerings ve Paywalls

### Offerings Getirme

```swift
// iOS
Purchases.shared.getOfferings { offerings, error in
    guard let current = offerings?.current else { return }

    let monthly = current.monthly   // Package?
    let annual = current.annual     // Package?
    let weekly = current.package(identifier: "weekly") // Custom

    // Fiyat gosterme
    if let monthly = monthly {
        priceLabel.text = monthly.storeProduct.localizedPriceString
        // "$9.99" (locale'e gore formatlanmis)
    }
}
```

```kotlin
// Android
Purchases.sharedInstance.getOfferingsWith(
    onError = { error -> /* PurchasesError */ },
    onSuccess = { offerings ->
        val current = offerings.current ?: return@getOfferingsWith
        val monthly = current.monthly
        val annual = current.annual

        monthly?.product?.let { product ->
            priceText.text = product.price.formatted // "$9.99"
        }
    }
)
```

```typescript
// React Native
const offerings = await Purchases.getOfferings();
const current = offerings.current;

if (current) {
  const monthly = current.monthly;
  const annual = current.annual;

  // Fiyat
  monthly?.product.priceString; // "$9.99"

  // Savings hesapla
  if (monthly && annual) {
    const monthlyPerYear = monthly.product.price * 12;
    const savings = Math.round((1 - annual.product.price / monthlyPerYear) * 100);
    // "Save 60%"
  }
}
```

### RevenueCat Paywalls (No-code)

```swift
// iOS - RevenueCat Paywall UI
import RevenueCatUI

// SwiftUI
PaywallView()
    .onPurchaseCompleted { customerInfo in
        // Satin alma basarili
    }
    .onDismiss {
        // Kullanici kapatti
    }

// Footer mode (kendi UI'in + RC pricing)
PaywallFooterView()
```

```kotlin
// Android - Paywall UI
PaywallDialog(
    PaywallDialogOptions.Builder()
        .setDismissRequest { /* kapandi */ }
        .setListener(object : PaywallListener {
            override fun onPurchaseCompleted(customerInfo: CustomerInfo, storeTransaction: StoreTransaction) {
                // Basarili
            }
        })
        .build()
)
```

---

## Entitlement Checking

```swift
// iOS - Erisim kontrolu
Purchases.shared.getCustomerInfo { customerInfo, error in
    let isPremium = customerInfo?.entitlements["premium"]?.isActive == true

    // Detayli bilgi
    if let entitlement = customerInfo?.entitlements["premium"] {
        entitlement.isActive              // true/false
        entitlement.willRenew             // otomatik yenilenecek mi
        entitlement.expirationDate        // bitis tarihi
        entitlement.periodType            // .normal, .trial, .intro
        entitlement.productIdentifier     // hangi urun
    }
}

// Listener (real-time degisiklik)
Purchases.shared.delegate = self

func purchases(_ purchases: Purchases,
               receivedUpdated customerInfo: CustomerInfo) {
    let isPremium = customerInfo.entitlements["premium"]?.isActive == true
    updateUI(isPremium: isPremium)
}
```

```typescript
// React Native
const customerInfo = await Purchases.getCustomerInfo();
const isPremium = customerInfo.entitlements.active['premium'] !== undefined;

// Listener
Purchases.addCustomerInfoUpdateListener((info) => {
  const isPremium = info.entitlements.active['premium'] !== undefined;
  setIsPremium(isPremium);
});
```

### Feature Gating Pattern

```typescript
// Merkezi erisim kontrolu
class EntitlementManager {
  private customerInfo: CustomerInfo | null = null;

  async refresh(): Promise<void> {
    this.customerInfo = await Purchases.getCustomerInfo();
  }

  get isPremium(): boolean {
    return this.customerInfo?.entitlements.active['premium'] !== undefined;
  }

  get isOnTrial(): boolean {
    const ent = this.customerInfo?.entitlements.active['premium'];
    return ent?.periodType === 'TRIAL';
  }

  get trialEndDate(): Date | null {
    const ent = this.customerInfo?.entitlements.active['premium'];
    if (ent?.periodType !== 'TRIAL') return null;
    return ent.expirationDate ? new Date(ent.expirationDate) : null;
  }

  get willRenew(): boolean {
    return this.customerInfo?.entitlements.active['premium']?.willRenew ?? false;
  }
}
```

---

## Purchase Flow

```swift
// iOS
Purchases.shared.purchase(package: monthlyPackage) { transaction, customerInfo, error, userCancelled in
    if userCancelled {
        // Kullanici iptal etti - agresif olmadan geri don
        return
    }
    if let error = error {
        // Hata: odeme basarisiz, network vb.
        handleError(error)
        return
    }
    if customerInfo?.entitlements["premium"]?.isActive == true {
        // BASARILI - premium erisim ac
        unlockPremium()
    }
}
```

```typescript
// React Native
try {
  const { customerInfo } = await Purchases.purchasePackage(monthlyPackage);
  if (customerInfo.entitlements.active['premium']) {
    unlockPremium();
  }
} catch (e: any) {
  if (e.userCancelled) return;
  handleError(e);
}
```

### Restore Purchases (ZORUNLU - Apple Requirement)

```swift
// iOS - MUTLAKA paywall'da "Restore Purchases" butonu olmali
Purchases.shared.restorePurchases { customerInfo, error in
    if customerInfo?.entitlements["premium"]?.isActive == true {
        showAlert("Aboneliginiz geri yuklendi!")
        unlockPremium()
    } else {
        showAlert("Aktif abonelik bulunamadi.")
    }
}
```

---

## Webhook Integration (Server-Side)

### Webhook Setup

RevenueCat Dashboard > Project > Integrations > Webhooks
- URL: `https://your-api.com/webhooks/revenuecat`
- Authorization Header: Bearer token ile dogrula

### Webhook Handler

```typescript
// Next.js API Route
import { NextRequest, NextResponse } from 'next/server';

interface RevenueCatEvent {
  api_version: string;
  event: {
    type: string;
    app_user_id: string;
    product_id: string;
    entitlement_ids: string[];
    period_type: 'TRIAL' | 'NORMAL' | 'INTRO';
    expiration_at_ms: number;
    environment: 'SANDBOX' | 'PRODUCTION';
    price_in_purchased_currency: number;
    currency: string;
    store: 'APP_STORE' | 'PLAY_STORE' | 'STRIPE';
  };
}

// Event tipleri ve aksiyonlar
const EVENT_HANDLERS: Record<string, (event: RevenueCatEvent['event']) => Promise<void>> = {
  // Yeni satin alma
  'INITIAL_PURCHASE': async (event) => {
    await db.user.update({
      where: { id: event.app_user_id },
      data: { isPremium: true, subscriptionStart: new Date() }
    });
    await analytics.track('subscription_started', {
      userId: event.app_user_id,
      product: event.product_id,
      price: event.price_in_purchased_currency,
      currency: event.currency,
      periodType: event.period_type,
    });
  },

  // Yenileme
  'RENEWAL': async (event) => {
    await db.user.update({
      where: { id: event.app_user_id },
      data: { subscriptionRenewedAt: new Date() }
    });
  },

  // Iptal (hemen degil, sure sonunda biter)
  'CANCELLATION': async (event) => {
    await db.user.update({
      where: { id: event.app_user_id },
      data: { willCancel: true, cancelledAt: new Date() }
    });
    // Win-back kampanyasi baslat
    await triggerWinBackCampaign(event.app_user_id, event.expiration_at_ms);
  },

  // Sure doldu
  'EXPIRATION': async (event) => {
    await db.user.update({
      where: { id: event.app_user_id },
      data: { isPremium: false, expiredAt: new Date() }
    });
  },

  // Odeme sorunu
  'BILLING_ISSUE': async (event) => {
    await db.user.update({
      where: { id: event.app_user_id },
      data: { hasBillingIssue: true }
    });
    // Grace period bilgilendirmesi
    await sendBillingIssueNotification(event.app_user_id);
  },

  // Trial donusumu
  'SUBSCRIBER_ALIAS': async (event) => {
    // Anonim kullanici -> kayitli kullanici eslestirme
  },
};

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.REVENUECAT_WEBHOOK_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body: RevenueCatEvent = await req.json();

  // Sandbox event'lerini filtrele (production'da)
  if (process.env.NODE_ENV === 'production' && body.event.environment === 'SANDBOX') {
    return NextResponse.json({ ok: true });
  }

  const handler = EVENT_HANDLERS[body.event.type];
  if (handler) {
    await handler(body.event);
  }

  return NextResponse.json({ ok: true });
}
```

---

## Sandbox Testing

### iOS Sandbox

1. App Store Connect > Users and Access > Sandbox Testers
2. Yeni sandbox kullanici olustur (gercek email gerekli)
3. iPhone Settings > App Store > Sandbox Account ile giris
4. Sandbox'ta sureler kisaltilmis:
   - 1 haftalik = 3 dakika
   - 1 aylik = 5 dakika
   - 1 yillik = 1 saat
   - Auto-renew 6 kez sonra durur

### Android Test

1. Google Play Console > Setup > License testing
2. Test email'lerini ekle
3. Test track'e yukle (internal testing)
4. `Purchases.logLevel = .debug` ile test et

### Debug Checklist

```
[ ] RevenueCat dashboard'da sandbox event'leri gorunuyor mu?
[ ] Entitlement dogru aktive oluyor mu?
[ ] Restore purchases calisiyor mu?
[ ] Webhook'lar geliyor mu? (RequestBin ile test et)
[ ] Fiyatlar locale'e gore formatlanmis mi?
[ ] Trial suresi dogru gorunuyor mu?
[ ] Iptal sonrasi erisim sure sonunda kapaniyor mu?
```

---

## StoreKit 2 Migration Notlari

- RevenueCat v4+ StoreKit 2'yi otomatik destekler
- `usesStoreKit2IfAvailable: true` ile etkinlestir
- StoreKit 2 avantajlari: real-time transaction updates, better receipt handling
- iOS 15+ gerektirir (iOS 14 icin StoreKit 1 fallback otomatik)
- Server-side receipt validation artik gerekli degil (SK2 bunu yapiyor)

## Onemli Kurallar

1. **Restore Purchases butonu ZORUNLU** (Apple reject eder yoksa)
2. **Fiyatlari localizedPriceString ile goster** (hardcode ETME)
3. **Sandbox'ta test etmeden production'a cikma**
4. **Webhook secret'i .env'de tut** (hardcode ETME)
5. **BILLING_ISSUE event'ini handle et** (grace period uygula)
6. **Trial bitis tarihini kullaniciya goster** (seffaflik)
7. **Anonim -> kayitli kullanici gecisinde merge yap** (veri kaybi olmasin)
