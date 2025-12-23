# Quick Fix: Categories Collection ID Issue

## Problem
Error: `Collection with the requested ID could not be found.`

The collection ID `'categories'` doesn't match what's in your Appwrite database.

## Solution

### Step 1: Find the Correct Collection ID

1. Go to [Appwrite Console](https://cloud.appwrite.io/)
2. Navigate to **Databases** → Your Database (`6924bf52002dda6b6eff`)
3. Click on your **Categories** collection
4. Look at the **Collection ID** in the settings or URL

The Collection ID might be:
- A generated ID like `6924bf52003a1b2c3d4e`
- Or exactly `categories` (but needs to match exactly)

### Step 2: Update Both Config Files

Once you have the correct Collection ID, update these files:

**File 1:** `/admin-panel/src/lib/appwrite.js`
```javascript
export const APPWRITE_CONFIG = {
    PROJECT_ID: '68f5e984002817f132e2',
    DATABASE_ID: '6924bf52002dda6b6eff',
    COLLECTIONS: {
        CATEGORIES: 'YOUR_ACTUAL_COLLECTION_ID_HERE',  // ← Update this
        PRODUCTS: 'products',
        SUPERMARKETS: 'supermarkets',
        PRICES: 'prices',
        FEEDBACK: 'feedback',
        USER_PROFILES: 'user_profiles'
    }
};
```

**File 2:** `/user-app/src/lib/appwrite.js`
```javascript
export const APPWRITE_CONFIG = {
    PROJECT_ID: '68f5e984002817f132e2',
    DATABASE_ID: '6924bf52002dda6b6eff',
    COLLECTIONS: {
        CATEGORIES: 'YOUR_ACTUAL_COLLECTION_ID_HERE',  // ← Update this
        PRODUCTS: 'products',
        SUPERMARKETS: 'supermarkets',
        PRICES: 'prices',
        FEEDBACK: 'feedback',
        USER_PROFILES: 'user_profiles'
    }
};
```

### Step 3: Verify Other Collection IDs

While you're at it, verify ALL collection IDs match:
- Products: `products`
- Supermarkets: `supermarkets`
- Prices: `prices`
- Feedback: `feedback`
- User Profiles: `user_profiles`

## How to Find Collection ID in Appwrite

**Method 1: From Collection Settings**
1. Click on the collection
2. Go to **Settings** tab
3. Look for **Collection ID** field

**Method 2: From URL**
When viewing a collection, the URL looks like:
```
https://cloud.appwrite.io/console/project-XXX/databases/database-XXX/collection-COLLECTION_ID
```

The `COLLECTION_ID` part is what you need!

## After Updating

1. Save both files
2. The dev server should auto-reload
3. Try creating a category again
4. It should work! ✅

---

**Let me know the correct Collection ID and I'll update the files for you!**
