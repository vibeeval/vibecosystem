---
name: revenuecat-patterns
description: RevenueCat SDK integration patterns for iOS (Swift), Android (Kotlin), React Native, and Flutter. Subscription lifecycle, paywall presentation, entitlement checking, receipt validation, and offering configuration. Use when implementing in-app purchases or subscriptions with RevenueCat.
---

# RevenueCat Integration Patterns

Production-ready patterns for RevenueCat SDK across all major platforms.

## SDK Setup

### Swift (iOS)

```swift
import RevenueCat

// AppDelegate or App init
func application(_ application: UIApplication, didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?) -> Bool {
    Purchases.logLevel = .debug // Remove in production
    Purchases.configure(withAPIKey: "appl_your_api_key")

    // Identify user after auth
    // Purchases.shared.logIn("user_id") { customerInfo, created, error in }

    return true
}
```

### Kotlin (Android)

```kotlin
import com.revenuecat.purchases.Purchases
import com.revenuecat.purchases.PurchasesConfiguration

class MyApp : Application() {
    override fun onCreate() {
        super.onCreate()
        Purchases.logLevel = LogLevel.DEBUG // Remove in production
        Purchases.configure(
            PurchasesConfiguration.Builder(this, "goog_your_api_key").build()
        )
    }
}
```

### React Native

```typescript
import Purchases from 'react-native-purchases'

// App initialization
async function initPurchases(): Promise<void> {
  if (Platform.OS === 'ios') {
    Purchases.configure({ apiKey: 'appl_your_api_key' })
  } else {
    Purchases.configure({ apiKey: 'goog_your_api_key' })
  }
}

// Identify user
async function identifyUser(userId: string): Promise<void> {
  const { customerInfo } = await Purchases.logIn(userId)
  checkEntitlements(customerInfo)
}
```

### Flutter

```dart
import 'package:purchases_flutter/purchases_flutter.dart';

Future<void> initPurchases() async {
  await Purchases.setLogLevel(LogLevel.debug); // Remove in production

  final configuration = PurchasesConfiguration(
    Platform.isIOS ? 'appl_your_api_key' : 'goog_your_api_key',
  );
  await Purchases.configure(configuration);
}
```

## Fetching Offerings

Offerings define what products to show. Always fetch dynamically -- never hardcode products.

### Swift

```swift
func fetchOfferings() async throws -> Offerings {
    let offerings = try await Purchases.shared.offerings()

    guard let current = offerings.current else {
        throw PaywallError.noOfferingsAvailable
    }

    // Access packages
    let monthly = current.monthly    // convenience accessor
    let annual = current.annual
    let weekly = current.package(identifier: "weekly")

    return offerings
}
```

### React Native

```typescript
async function fetchOfferings(): Promise<PurchasesOffering | null> {
  const offerings = await Purchases.getOfferings()

  if (!offerings.current) {
    console.error('No offerings configured in RevenueCat dashboard')
    return null
  }

  const { monthly, annual, availablePackages } = offerings.current
  return offerings.current
}
```

### Flutter

```dart
Future<Offering?> fetchOfferings() async {
  final offerings = await Purchases.getOfferings();

  if (offerings.current == null) {
    debugPrint('No offerings configured');
    return null;
  }

  final monthly = offerings.current!.monthly;
  final annual = offerings.current!.annual;
  return offerings.current;
}
```

## Paywall Presentation

### Swift (RevenueCat Paywalls UI)

```swift
import RevenueCatUI

struct ContentView: View {
    @State private var showPaywall = false

    var body: some View {
        Button("Upgrade") {
            showPaywall = true
        }
        .presentPaywallIfNeeded(
            requiredEntitlementIdentifier: "premium",
            purchaseCompleted: { customerInfo in
                // Handle successful purchase
            },
            restoreCompleted: { customerInfo in
                // Handle successful restore
            }
        )
    }
}

// Or present manually
struct ManualPaywallView: View {
    var body: some View {
        PaywallView()
            .onPurchaseCompleted { customerInfo in
                // Dismiss and unlock
            }
    }
}
```

### React Native (Custom Paywall)

```typescript
interface PaywallProps {
  onPurchaseComplete: () => void
  onDismiss: () => void
}

function Paywall({ onPurchaseComplete, onDismiss }: PaywallProps): JSX.Element {
  const [offerings, setOfferings] = useState<PurchasesOffering | null>(null)
  const [loading, setLoading] = useState(true)
  const [purchasing, setPurchasing] = useState(false)

  useEffect(() => {
    fetchOfferings().then(setOfferings).finally(() => setLoading(false))
  }, [])

  async function handlePurchase(pkg: PurchasesPackage): Promise<void> {
    setPurchasing(true)
    try {
      const { customerInfo } = await Purchases.purchasePackage(pkg)
      if (customerInfo.entitlements.active['premium']) {
        onPurchaseComplete()
      }
    } catch (error: unknown) {
      if (error instanceof PurchasesError) {
        if (!error.userCancelled) {
          Alert.alert('Purchase Failed', error.message)
        }
      }
    } finally {
      setPurchasing(false)
    }
  }

  async function handleRestore(): Promise<void> {
    try {
      const customerInfo = await Purchases.restorePurchases()
      if (customerInfo.entitlements.active['premium']) {
        onPurchaseComplete()
      } else {
        Alert.alert('No Purchases Found', 'No active subscriptions to restore.')
      }
    } catch (error) {
      Alert.alert('Restore Failed', 'Please try again later.')
    }
  }

  if (loading) return <ActivityIndicator />
  if (!offerings) return <Text>Unable to load plans</Text>

  return (
    <View>
      {offerings.availablePackages.map((pkg) => (
        <PackageCard
          key={pkg.identifier}
          package={pkg}
          onPress={() => handlePurchase(pkg)}
          disabled={purchasing}
        />
      ))}
      <Button title="Restore Purchases" onPress={handleRestore} />
      <Button title="Dismiss" onPress={onDismiss} />
    </View>
  )
}
```

## Entitlement Checking

The core pattern: always check entitlements, never check receipt directly.

### Swift

```swift
func checkPremiumAccess() async -> Bool {
    do {
        let customerInfo = try await Purchases.shared.customerInfo()
        return customerInfo.entitlements["premium"]?.isActive == true
    } catch {
        // Fail open or closed based on your policy
        return false
    }
}

// Gate a feature
func accessPremiumFeature() async {
    guard await checkPremiumAccess() else {
        showPaywall()
        return
    }
    // Premium feature logic
}
```

### React Native

```typescript
async function isPremium(): Promise<boolean> {
  try {
    const customerInfo = await Purchases.getCustomerInfo()
    return customerInfo.entitlements.active['premium'] !== undefined
  } catch {
    return false
  }
}

// React hook
function usePremiumStatus(): { isPremium: boolean; loading: boolean } {
  const [premium, setPremium] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    isPremium().then(setPremium).finally(() => setLoading(false))

    // Listen for changes
    const listener = Purchases.addCustomerInfoUpdateListener((info) => {
      setPremium(info.entitlements.active['premium'] !== undefined)
    })

    return () => listener.remove()
  }, [])

  return { isPremium: premium, loading }
}
```

### Flutter

```dart
Future<bool> isPremium() async {
  try {
    final customerInfo = await Purchases.getCustomerInfo();
    return customerInfo.entitlements.all['premium']?.isActive ?? false;
  } catch (e) {
    return false;
  }
}

// Stream-based listener
Stream<bool> premiumStatusStream() {
  return Purchases.customerInfoStream.map(
    (info) => info.entitlements.all['premium']?.isActive ?? false,
  );
}
```

## Restore Purchases

Always provide a restore button. Apple requires it.

```typescript
// React Native
async function restorePurchases(): Promise<CustomerInfo> {
  const customerInfo = await Purchases.restorePurchases()

  const isActive = customerInfo.entitlements.active['premium'] !== undefined

  if (isActive) {
    // Unlock premium
    return customerInfo
  }

  // No active entitlements found
  throw new Error('No active subscriptions found')
}
```

## Subscription Status Listener

Listen for real-time changes (renewals, cancellations, billing issues).

### Swift

```swift
class PurchaseManager: NSObject, PurchasesDelegate {
    static let shared = PurchaseManager()

    func setup() {
        Purchases.shared.delegate = self
    }

    func purchases(_ purchases: Purchases, receivedUpdated customerInfo: CustomerInfo) {
        let isPremium = customerInfo.entitlements["premium"]?.isActive == true
        NotificationCenter.default.post(
            name: .premiumStatusChanged,
            object: nil,
            userInfo: ["isPremium": isPremium]
        )
    }
}
```

### React Native

```typescript
useEffect(() => {
  const listener = Purchases.addCustomerInfoUpdateListener((customerInfo) => {
    const isPremium = customerInfo.entitlements.active['premium'] !== undefined

    // Update app state
    dispatch({ type: 'SET_PREMIUM', payload: isPremium })

    // Handle billing issues
    if (customerInfo.entitlements.all['premium']?.willRenew === false) {
      showBillingIssueAlert()
    }
  })

  return () => listener.remove()
}, [])
```

## Server-Side Receipt Validation

For critical entitlement checks (unlocking server-side features), validate server-side.

```typescript
// Server-side (Node.js)
import fetch from 'node-fetch'

const RC_API_KEY = process.env.REVENUECAT_API_KEY!

async function getSubscriberInfo(appUserId: string): Promise<SubscriberInfo> {
  const response = await fetch(
    `https://api.revenuecat.com/v1/subscribers/${encodeURIComponent(appUserId)}`,
    {
      headers: {
        'Authorization': `Bearer ${RC_API_KEY}`,
        'Content-Type': 'application/json'
      }
    }
  )

  if (!response.ok) {
    throw new Error(`RevenueCat API error: ${response.status}`)
  }

  return response.json()
}

async function hasActiveEntitlement(
  appUserId: string,
  entitlement: string
): Promise<boolean> {
  const info = await getSubscriberInfo(appUserId)
  const ent = info.subscriber?.entitlements?.[entitlement]

  if (!ent) return false

  const expiresDate = new Date(ent.expires_date)
  return expiresDate > new Date()
}
```

## Webhook Integration

Handle server-side subscription events.

```typescript
// Express webhook handler
app.post('/webhooks/revenuecat', express.json(), async (req, res) => {
  const { event } = req.body

  // Verify webhook authenticity (check Authorization header)
  const authHeader = req.headers['authorization']
  if (authHeader !== `Bearer ${process.env.RC_WEBHOOK_SECRET}`) {
    return res.status(401).send('Unauthorized')
  }

  switch (event.type) {
    case 'INITIAL_PURCHASE':
      await handleNewSubscription(event)
      break
    case 'RENEWAL':
      await handleRenewal(event)
      break
    case 'CANCELLATION':
      await handleCancellation(event)
      break
    case 'BILLING_ISSUE':
      await handleBillingIssue(event)
      break
    case 'SUBSCRIBER_ALIAS':
      await handleAlias(event)
      break
    case 'EXPIRATION':
      await handleExpiration(event)
      break
  }

  res.status(200).send('OK')
})
```

## Testing with Sandbox

```typescript
// Development configuration
if (__DEV__) {
  Purchases.setLogLevel(Purchases.LOG_LEVEL.DEBUG)
}

// Sandbox testing checklist:
// 1. Create sandbox test account in App Store Connect
// 2. Sign out of App Store on device (Settings > Media & Purchases)
// 3. Do NOT sign into sandbox account in Settings
// 4. Sign in when prompted during purchase flow
// 5. Sandbox subscriptions auto-renew at accelerated rate:
//    - Weekly: 3 minutes
//    - Monthly: 5 minutes
//    - Annual: 1 hour
//    - Renewals stop after 6 cycles
```

## StoreKit 2 Migration

RevenueCat handles StoreKit 2 automatically since SDK v4+.

```swift
// No migration needed for RevenueCat users
// SDK automatically uses StoreKit 2 on iOS 15+
// Falls back to StoreKit 1 on older versions

// If you need StoreKit 2 directly:
Purchases.configure(
    with: .init(withAPIKey: "appl_key")
        .with(usesStoreKit2IfAvailable: true) // Default since v4
)
```

## Complete Paywall Flow Example

```
1. App launch
   -> Purchases.configure()
   -> Check customerInfo.entitlements

2. User taps premium feature
   -> checkEntitlement("premium")
   -> If active: proceed
   -> If not: show paywall

3. Paywall shown
   -> Fetch offerings
   -> Display packages with pricing
   -> Show trial info if eligible
   -> Restore Purchases button visible

4. User selects package
   -> Purchases.purchasePackage(pkg)
   -> Handle success: unlock + dismiss paywall
   -> Handle cancel: do nothing
   -> Handle error: show alert

5. Background
   -> Listener catches renewals/cancellations
   -> Server webhook handles server-side state
   -> Entitlement check on critical actions
```

## Common Pitfalls

```
Not calling configure() early enough:
  Call in AppDelegate/Application.onCreate, not in a lazy ViewModel.
  -> SDK needs to start observing transactions immediately.

Hardcoding product IDs:
  Product IDs should come from offerings, not constants.
  -> Offerings allow remote configuration without app updates.

Not handling restore:
  Apple will reject apps without a visible Restore Purchases option.
  -> Add it to your paywall UI, always.

Checking receipt instead of entitlements:
  Entitlements abstract away platform differences.
  -> Use customerInfo.entitlements, never parse receipts directly.

Not listening for updates:
  Subscriptions can change anytime (renewal, cancel, billing issue).
  -> Add a CustomerInfoUpdateListener and react to changes.

Forgetting sandbox testing:
  Production StoreKit behavior differs from development.
  -> Always test full flow in sandbox before release.
```

**Remember**: RevenueCat is your subscription infrastructure. Use it for what it does well (receipt validation, cross-platform entitlements, analytics) and pair it with a paywall strategy (see `paywall-strategy` skill) for the monetization decisions.
