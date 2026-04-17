# Quick Privy Setup Guide

## Get Your Privy App ID (5 minutes)

### Step 1: Create a Privy Account
1. Visit: https://dashboard.privy.io
2. Click "Sign Up" or "Log In"
3. Complete the signup process (email + password or social login)

### Step 2: Create Your First App
1. In the Privy Dashboard, click **"Create App"** or **"+ New App"**
2. Give your app a name (e.g., "FindYourPeer Dev")
3. Select **Ethereum** as the blockchain (matches your config)
4. Click **Create**

### Step 3: Copy Your App ID
1. You should see your app in the dashboard
2. Find the **App ID** field (usually at the top or in settings)
3. Copy the entire App ID (looks like: `clm1234567890abcdef`)

### Step 4: Configure Your App
1. Open `frontend/.env.local` in your editor
2. Replace `your-privy-app-id-here` with your actual App ID
3. Save the file

Example:
```env
VITE_PRIVY_APP_ID=clm1234567890abcdef
```

### Step 5: Restart Dev Server
```bash
cd frontend
npm run dev
```

The app should now load without the Privy initialization error.

## Troubleshooting

### Error: "Cannot initialize Privy provider with invalid app ID"
- Make sure you copied the ENTIRE App ID from the dashboard
- Check that `.env.local` has correct format: `VITE_PRIVY_APP_ID=your-id-here`
- Restart the dev server after saving `.env.local`

### Cannot find App ID in dashboard
- Make sure you successfully created an app (you should see it listed)
- If no app appears, click "Create App" button
- The App ID should be visible somewhere on the app details page

### Still getting errors after setting App ID
- Verify `.env.local` is in the `frontend/` directory (not root)
- Make sure there are no extra spaces: `VITE_PRIVY_APP_ID=app-id` (not `VITE_PRIVY_APP_ID = app-id`)
- Try clearing browser cache and restarting dev server

## Optional: Configure Additional Settings

Once your app is created, you can customize in the Privy Dashboard:
- **Embedded Wallets**: Already configured to auto-create for users
- **External Wallets**: Add MetaMask, WalletConnect, etc. (optional)
- **Authentication Methods**: Configure email/SMS/social logins (optional)

For now, the basic setup is enough to test the app locally.

## Helpful Links
- **Privy Dashboard**: https://dashboard.privy.io
- **Privy Docs**: https://docs.privy.io
- **React Setup Guide**: https://docs.privy.io/basics/react/setup
