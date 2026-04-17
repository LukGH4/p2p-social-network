# PrivySDK Migration Guide for FindYourPeer

## Overview

This document outlines the migration from the MetaMask/ethers.js blockchain integration to PrivySDK for authentication and wallet management. The migration has been largely completed, but requires some final configuration and testing steps.

## What Has Been Changed

### 1. **Dependencies Updated**
- ✅ Removed: `ethers` (^6.16.0)
- ✅ Added: `@privy-io/react-auth` (^1.78.0)

**File**: `frontend/package.json`

### 2. **Root Provider Setup**
- ✅ Added `PrivyProvider` wrapper around the app
- ✅ Configured embedded wallet creation for Ethereum
- Requires: `VITE_PRIVY_APP_ID` environment variable

**File**: `frontend/src/main.jsx`

```jsx
<PrivyProvider
  appId={PRIVY_APP_ID}
  config={{
    embeddedWallets: {
      ethereum: {
        createOnLogin: 'users-without-wallets'
      }
    }
  }}
>
```

### 3. **Blockchain Module Refactored**
- ✅ Replaced `ethers.js` utilities with Privy-compatible functions
- ✅ Removed direct `window.ethereum` (MetaMask) dependency
- ✅ Updated `connectBlockchainIdentity()` to accept Privy wallet objects
- ⚠️ ENS lookup functionality needs external provider

**File**: `frontend/src/lib/blockchain.js`

**Key Changes**:
```javascript
// OLD: ethers.js BrowserProvider
// NEW: Privy wallet object from useWallets hook

// OLD: window.ethereum
// NEW: Privy's embedded or external wallet

// OLD: await signer.signMessage()
// NEW: await wallet.signMessage()
```

### 4. **Profile Creation Updated**
- ✅ Integrated Privy hooks (`usePrivy`, `useWallets`)
- ✅ Updated `handleLinkWallet()` to use Privy wallets
- ✅ Maintains blockchain identity signing flow

**File**: `frontend/src/pages/ProfileCreate.jsx`

**Usage**:
```jsx
const { wallets } = useWallets()
const evmWallet = wallets.find(w => w.chainType === 'ethereum')
const identity = await connectBlockchainIdentity({
  peerId,
  publicKey: publicKeyBase64,
  wallet: evmWallet,  // ← Privy wallet object
  ensName,
})
```

### 5. **Authentication Context Enhanced**
- ✅ Integrated `usePrivy` for session management
- ✅ Added Privy user data to context
- ✅ Updated logout to call Privy's logout
- ✅ Waits for Privy to be ready before initializing app

**File**: `frontend/src/context/AuthContext.jsx`

```jsx
const { user: privyUser, ready: privyReady, logout: privyLogout } = usePrivy()
// Now available in AuthContext value as: { privyUser, privyReady }
```

### 6. **No Changes Required**
- ✅ `profile.js` - Already blockchain-agnostic
- ✅ `trust.js` - Already blockchain-agnostic
- ✅ `crypto.js` - Uses Web Crypto API, not blockchain
- ✅ `db.js` - Local storage, not blockchain
- ✅ `gossipBridge.js` - P2P protocol, not blockchain

## Required Configuration Steps

### Step 1: Create a Privy Account and App

1. Visit [https://dashboard.privy.io](https://dashboard.privy.io)
2. Sign up or log in
3. Create a new app
4. Copy your **App ID**

### Step 2: Set Environment Variable

Create or update `frontend/.env.local`:

```bash
VITE_PRIVY_APP_ID=your_app_id_here
```

Replace `your_app_id_here` with the App ID from Step 1.

### Step 3: Configure Wallet Creation

In `frontend/src/main.jsx`, the embedded wallet is configured to:
- Create automatically for users without wallets on login
- Support Ethereum blockchain

To customize, modify the PrivyProvider config:

```jsx
config={{
  embeddedWallets: {
    ethereum: {
      createOnLogin: 'users-without-wallets'  // or 'all-users'
    }
  }
}}
```

## Testing the Integration

### Test 1: Profile Creation Flow

1. Start the dev server: `npm run dev`
2. Navigate to the profile creation page
3. Verify Privy login UI appears
4. After login, verify wallet is available
5. Click "Link Wallet" to sign identity binding message
6. Verify profile is created and saved

### Test 2: Wallet Signing

Expected behavior:
- User clicks "Link Wallet"
- Privy wallet prompts to sign a message
- Message format: `FindYourPeer identity binding\nPeer ID: ...\nApp public key: ...`
- Signature is captured and stored in `blockchainIdentity`

### Test 3: Profile Verification

1. Create a profile with blockchain identity
2. View profile in match feed
3. Verify trust score includes wallet verification points

## Migration Checklist

- [ ] Privy account created and app ID obtained
- [ ] `VITE_PRIVY_APP_ID` environment variable set
- [ ] `npm install` successfully installs PrivySDK
- [ ] Dev server starts without errors: `npm run dev`
- [ ] Profile creation page loads and shows Privy UI
- [ ] Wallet linking works and signs messages
- [ ] Profiles with blockchain identity are saved correctly
- [ ] Trust scores reflect wallet verification
- [ ] Match feed displays correctly with wallet anchors
- [ ] Chat shows wallet/ENS names correctly

## API Documentation References

- **PrivySDK Docs**: https://docs.privy.io
- **usePrivy Hook**: https://docs.privy.io/basics/react/setup
- **useWallets Hook**: https://docs.privy.io/wallets/wallets/get-a-wallet/get-connected-wallet
- **Message Signing**: https://docs.privy.io/wallets/using-wallets/ethereum/sign-a-message

## Known Limitations and Future Work

### 1. ENS Resolution
Currently, ENS name lookup is not implemented. The `lookupPrimaryEns()` function returns `null`.

**To add ENS support**, you can:
- Use Privy's ENS API (if available)
- Use an external provider like ethers.js (but keep dependencies minimal)
- Implement client-side ENS lookup via RPC

Example with external provider:
```javascript
import { JsonRpcProvider } from 'ethers'
const provider = new JsonRpcProvider('https://eth.public.rpc.io')
const ensName = await provider.lookupAddress(walletAddress)
```

### 2. Signature Verification
The current implementation uses basic signature format validation instead of cryptographic recovery (which requires ethers.js or similar).

**To add full verification**, consider:
- Adding `@noble/signatures` for ECDSA recovery
- Using Privy's verification API if available
- Keeping ethers.js as a minimal dependency for verification only

### 3. External Wallet Connection
Currently, the implementation assumes embedded wallets created by Privy. To support external wallets (MetaMask, WalletConnect, etc.):

```jsx
// In PrivyProvider config:
config={{
  embeddedWallets: { ... },
  externalWallets: {
    evm: {
      /* connector config */
    }
  }
}}
```

## Troubleshooting

### Issue: "No Privy wallet available"
- Ensure user has logged in via Privy
- Check that `createOnLogin: 'users-without-wallets'` is configured
- Verify PrivyProvider is wrapping the app

### Issue: "Wallet does not support message signing"
- Ensure wallet is an embedded wallet or supports EIP-712 signing
- Check wallet type in Privy dashboard

### Issue: "VITE_PRIVY_APP_ID is undefined"
- Create `.env.local` file in frontend directory
- Add: `VITE_PRIVY_APP_ID=your_app_id`
- Restart dev server

### Issue: Build fails with Privy imports
- Run `npm install` to ensure PrivySDK is installed
- Clear `node_modules` and reinstall: `rm -rf node_modules && npm install`

## Summary of Files Modified

1. **frontend/package.json**
   - Removed ethers.js
   - Added @privy-io/react-auth

2. **frontend/src/main.jsx**
   - Added PrivyProvider wrapper
   - Added configuration for embedded wallets

3. **frontend/src/lib/blockchain.js**
   - Rewrote to use Privy wallet objects
   - Replaced ethers.js utilities with custom implementations
   - Maintained API compatibility with existing code

4. **frontend/src/pages/ProfileCreate.jsx**
   - Integrated usePrivy and useWallets hooks
   - Updated wallet linking logic

5. **frontend/src/context/AuthContext.jsx**
   - Added Privy integration
   - Enhanced session management
   - Waits for Privy to be ready

## Next Steps

1. Set up Privy account and obtain App ID
2. Configure `VITE_PRIVY_APP_ID` environment variable
3. Run tests to verify the integration
4. (Optional) Add ENS name resolution support
5. (Optional) Add external wallet support
6. (Optional) Add cryptographic signature verification

---

**Migration Status**: ~90% Complete
- Infrastructure and integration: ✅ Complete
- Testing and validation: ⏳ Pending
- Optional enhancements: ⏳ Future work
