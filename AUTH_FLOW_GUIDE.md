# Authentication & Account Setup Flow

## Overview

The FindYourPeer app now has a complete authentication system with three-step onboarding:

1. **Login** - Authenticate via Privy (email, social, wallet)
2. **Account Setup** - Create profile with username, bio, and movie interests
3. **Blockchain Setup** - Optional wallet linking for trust verification

## User Flow

```
┌─────────────┐
│  Login Page │ ← User starts here (unauthenticated)
└──────┬──────┘
       │ [Sign in via Privy]
       ▼
┌───────────────────┐
│ Account Setup     │ ← User has Privy auth, no app profile yet
│ - Username        │
│ - Bio             │
│ - Movie Interests │
└──────┬────────────┘
       │ [Create Profile]
       ▼
┌──────────────────────┐
│ Blockchain Setup     │ ← User has app profile
│ (optional)           │
│ - Link Wallet        │
│ - Verify ENS Name    │
└──────┬───────────────┘
       │ [Skip or Complete]
       ▼
┌────────────────┐
│ Match Feed     │ ← Fully authenticated, ready to use
│ - View matches │
│ - Send requests│
│ - Chat peers   │
└────────────────┘
```

## New Pages & Components

### 1. Login Page (`src/pages/Login.jsx`)

**Purpose**: Authenticate user via Privy

**Features**:
- Email sign-in button (configured via Privy dashboard)
- Security messaging
- Automatic redirect if user already has Privy auth + app profile

**State Management**:
- Watches Privy `authenticated` state
- Redirects to account setup if user is Privy-authenticated but has no app profile

**Usage**:
```jsx
// User clicks "Sign In with Email"
// Privy handles email/password flow
// On success, component redirects to /account-setup
```

### 2. Account Setup Page (`src/pages/AccountSetup.jsx`)

**Purpose**: Create initial user profile

**Features**:
- Two-step form:
  - Step 1: Username and Bio
  - Step 2: Movie interest selection (at least 3 required)
- Progress indicator
- Character counters
- Form validation

**State Management**:
- Requires Privy authentication (`privyUser`)
- Creates app profile with `createProfile()`
- Broadcasts profile via gossip network
- Redirects to blockchain setup

**Usage**:
```jsx
// After Privy auth, user fills in basic info
// Selects movie interests
// Profile is created and stored in IndexedDB
// Redirects to /blockchain-setup
```

### 3. Blockchain Setup Page (`src/pages/BlockchainSetup.jsx`)

**Purpose**: Optional wallet linking for trust verification

**Features**:
- Display benefits of wallet linking
- ENS name input (optional)
- Wallet connection via Privy
- Message signing for identity binding
- Skip option to go directly to feed

**State Management**:
- Requires app profile (`appUser`)
- Uses Privy's `useWallets()` hook
- Updates profile with blockchain identity
- Can be skipped and completed later

**Usage**:
```jsx
// User can:
// 1. Link wallet and sign identity binding message
// 2. Skip and go to feed
// 3. Return later via profile settings
```

### 4. User Menu Component (`src/components/UserMenu.jsx`)

**Purpose**: Provide user profile actions and logout

**Features**:
- Display username with avatar
- Dropdown menu with options:
  - Edit Profile
  - Blockchain Settings
  - Sign Out

**Placement**: Top-right of Match Feed page

**Usage**:
```jsx
// Click on username avatar to open menu
// Select action from dropdown
// "Sign Out" calls logout() and redirects to /login
```

## Routes

| Path | Component | Auth Required | Purpose |
|------|-----------|---------------|---------|
| `/login` | Login | None | Initial sign-in |
| `/account-setup` | AccountSetup | Privy auth | Create initial profile |
| `/blockchain-setup` | BlockchainSetup | Privy auth | Link wallet (optional) |
| `/feed` | MatchFeed | App profile | Main app with matches |
| `/chat/:peerId` | Chat | App profile | Direct messaging |
| `/profile/create` | ProfileCreate | App profile | Edit profile (legacy) |
| `/` | Redirect | — | Redirects to `/login` |

## Authentication Context

Enhanced `AuthContext` now tracks:

```javascript
{
  user,              // App profile object
  loading,           // Loading state
  login(profile),    // Save profile and init network
  logout(),          // Clear profile and Privy session
  privyUser,         // Privy user object
  privyReady,        // Privy initialization complete
  privyAuthenticated // User is logged in to Privy
}
```

## Protected Routes

Two types of route protection:

### `AuthRoute` - Requires Privy Authentication
```jsx
<Route path="/account-setup" element={<AuthRoute><AccountSetup /></AuthRoute>} />
// User must be logged into Privy (but may not have app profile yet)
```

### `ProtectedRoute` - Requires App Profile
```jsx
<Route path="/feed" element={<ProtectedRoute><MatchFeed /></ProtectedRoute>} />
// User must have completed full setup (Privy + app profile)
```

## Authentication Flow Details

### Login Step

1. User navigates to `/login`
2. Clicks "Sign In with Email"
3. Privy handles email authentication
4. `usePrivy()` hook detects authentication
5. Component redirects to `/account-setup`

### Account Setup Step

1. User fills in username and bio
2. Clicks "Next"
3. User selects 3+ movie interests
4. Clicks "Create Profile"
5. `createProfile()` creates signed profile
6. Profile saved to IndexedDB
7. `broadcastProfile()` announces profile to P2P network
8. Component redirects to `/blockchain-setup`

### Blockchain Setup Step (Optional)

1. User optionally enters ENS name
2. Clicks "Link Wallet"
3. Privy signs identity binding message
4. Signature stored in profile's `blockchainIdentity`
5. Updated profile saved and broadcasted
6. User clicks "Go to Feed" or skips

### Using the App

1. User can view matches, send requests, and chat
2. Click username avatar (top-right) to open user menu
3. Select "Sign Out" to logout
4. Privy session cleared, profile deleted from storage
5. Redirected to `/login`

## Security Considerations

### Authentication
- ✅ Privy handles secure email/password authentication
- ✅ Session stored by Privy (secure, HttpOnly cookies)
- ✅ App profile validated with cryptographic signature
- ✅ Logout clears both Privy session and local profile

### Blockchain Identity
- ✅ Wallet signing proves ownership
- ✅ ENS verification confirms name ownership
- ✅ Identity binding message includes peer ID + public key
- ✅ Signature stored immutably in profile

### Route Protection
- ✅ Unauthorized access redirects to `/login`
- ✅ Privy's `ready` state waited before rendering protected pages
- ✅ Logout clears all session data

## Customization

### Change Authentication Methods

In `frontend/src/main.jsx`, modify PrivyProvider config:

```jsx
<PrivyProvider
  config={{
    // Already configured
    embeddedWallets: { ... },
    
    // Add external wallet support
    externalWallets: {
      evm: { /* connector config */ }
    }
  }}
>
```

### Modify Required Movie Interests

In `frontend/src/pages/AccountSetup.jsx`:

```jsx
// Change minimum from 3 to X interests
if (totalSelected() < X) {
  setError(`Select at least ${X} movie interests...`)
}
```

### Customize User Menu

Edit `frontend/src/components/UserMenu.jsx` to add more options:

```jsx
<button className="menu-item" onClick={...}>
  New Option
</button>
```

## Testing the Flow

### Test 1: Complete Flow
1. Clear IndexedDB and cookies
2. Start app, redirects to `/login`
3. Sign in with Privy
4. Complete account setup
5. Link wallet (optional)
6. View matches in feed
7. Sign out via user menu

### Test 2: Resuming Session
1. Complete the flow
2. Refresh browser
3. App loads user profile automatically
4. No re-authentication needed

### Test 3: Skip Blockchain Setup
1. Complete account setup
2. Click "Skip for Now" on blockchain page
3. Goes directly to feed
4. Can link wallet later

## Troubleshooting

### "Cannot initialize Privy provider with invalid app ID"
- See PRIVY_SETUP.md for configuration

### User stuck on login page
- Check if Privy app is created and App ID is set
- Check browser console for errors
- Verify `.env.local` has correct VITE_PRIVY_APP_ID

### User data not saving
- Check browser console for errors
- Verify IndexedDB is available (not private mode)
- Check network request to gossip bridge

### Logout doesn't work
- Check if Privy logout is being called
- Verify user menu is properly connected to AuthContext
- Check browser console for errors

## API Documentation

- **Privy Docs**: https://docs.privy.io
- **usePrivy Hook**: https://docs.privy.io/basics/react/setup
- **useWallets Hook**: https://docs.privy.io/wallets/wallets/get-a-wallet/get-connected-wallet
- **Message Signing**: https://docs.privy.io/wallets/using-wallets/ethereum/sign-a-message

