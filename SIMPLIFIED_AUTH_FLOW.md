# Simplified Authentication Flow (No Blockchain)

## Overview

The FindYourPeer app now has a clean two-step authentication and setup:

1. **Login** - Authenticate via Privy (email, social, wallet)
2. **Account Setup** - Create profile with username, bio, and movie interests

That's it! Users go straight to the match feed after account setup.

## User Flow

```
┌─────────────┐
│  Login Page │ ← User starts here (unauthenticated)
└──────┬──────┘
       │ [Sign in via Privy]
       ▼
┌────────────────────┐
│ Account Setup      │ ← User has Privy auth, no app profile yet
│ - Username         │
│ - Bio (optional)   │
│ - Movie Interests  │ (min 3 required)
└──────┬─────────────┘
       │ [Create Profile]
       ▼
┌────────────────┐
│ Match Feed     │ ← Fully authenticated, ready to use
│ - View matches │
│ - Send requests│
│ - Chat peers   │
└────────────────┘
```

## Pages

### 1. Login Page (`src/pages/Login.jsx`)
- Email sign-in button (Privy)
- Auto-redirect if authenticated
- Clean, simple UI

### 2. Account Setup Page (`src/pages/AccountSetup.jsx`)
- Two-step form:
  - Step 1: Username & Bio
  - Step 2: Movie interests selection (3+ required)
- Progress indicator
- Validation at each step
- Direct redirect to feed after completion

### 3. Match Feed (`src/pages/MatchFeed.jsx`)
- View peer matches ranked by movie similarity
- Send connection requests
- Accept/decline requests
- Direct chat with matched peers

### 4. User Menu (`src/components/UserMenu.jsx`)
- Profile dropdown
- Edit Profile link
- Sign Out button

## Routes

| Path | Component | Auth Required | Purpose |
|------|-----------|---------------|---------|
| `/login` | Login | None | Initial sign-in |
| `/account-setup` | AccountSetup | Privy auth | Create profile |
| `/feed` | MatchFeed | App profile | Main app |
| `/chat/:peerId` | Chat | App profile | Messaging |
| `/profile/create` | ProfileCreate | App profile | Edit profile |
| `/` | Redirect | — | Redirects to `/login` |

## Quick Test

```bash
cd frontend
npm run dev
```

Then:
1. App redirects to `/login`
2. Sign in with Privy email
3. Fill username & bio
4. Select movie interests
5. View matches in feed
6. Click avatar → Sign Out

## What Was Removed

✂️ **Removed:**
- Blockchain setup page
- Wallet linking requirement
- ENS name verification
- "Blockchain Trust Anchor" section
- Blockchain settings menu option

✂️ **Deleted Files:**
- `src/pages/BlockchainSetup.jsx`

## Simpler, Cleaner UX

- ✅ No blockchain required
- ✅ Fast onboarding (just 2 pages)
- ✅ No wallet complications
- ✅ Focus on movie matching
- ✅ P2P network still fully functional

## Security

Still secure:
- ✅ Privy handles authentication
- ✅ Profiles cryptographically signed
- ✅ P2P gossip network verified
- ✅ Session management intact
- ✅ Proper logout

## Future Enhancement

If blockchain identity verification is needed later, it can be re-added as:
- Optional during profile creation
- Accessible from user menu
- Separate blockchain settings page

For now, the focus is on clean, fast authentication and peer matching.

