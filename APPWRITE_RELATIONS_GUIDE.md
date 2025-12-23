# Appwrite Database Relationships Setup Guide

## Important: Your Current Schema

Based on your screenshots, your Appwrite database **does NOT use relationships**. Instead, it uses **string IDs** to reference other documents. This is actually simpler!

### Current Structure:
- **Products**: Standalone collection (no relationships)
- **Supermarkets**: Standalone collection (no relationships)
- **Prices**: Uses `productId` and `supermarketId` as **string fields** (not relationships)
- **Feedback**: Uses `userId` as **string field**
- **User Profiles**: Uses `userId` as **string field**

## ✅ Your Setup is Already Correct!

You don't need to create relationships in Appwrite. The code already handles this by:
1. Storing document IDs as strings
2. Fetching related documents manually using `databases.getDocument()`

## How It Works

### Example: Fetching Prices with Supermarket Info

```javascript
// 1. Get all prices for a product
const prices = await databases.listDocuments(
    DATABASE_ID,
    'prices',
    [Query.equal('productId', productDocId)]
);

// 2. For each price, fetch the supermarket details
const pricesWithSupermarkets = await Promise.all(
    prices.documents.map(async (price) => {
        const supermarket = await databases.getDocument(
            DATABASE_ID,
            'supermarkets',
            price.supermarketId  // This is just a string ID
        );
        return { ...price, supermarket };
    })
);
```

## Why Products Aren't Showing - Checklist

### 1. Check Appwrite Permissions ⚠️

**Most Common Issue**: Collection permissions not set correctly.

Go to Appwrite Console → Your Database → Each Collection → Settings → Permissions:

#### Products Collection:
```
✅ Any - Read
✅ Users - Create, Update, Delete
```

#### Supermarkets Collection:
```
✅ Any - Read
✅ Users - Create, Update, Delete
```

#### Prices Collection:
```
✅ Any - Read
✅ Users - Create, Update, Delete
```

### 2. Verify Data Exists

In Appwrite Console:
1. Go to **Database** → **products** collection
2. Click **Documents** tab
3. You should see your products listed

If no products exist:
- Add them via Admin Panel (http://localhost:5176/)
- Make sure you're logged in
- Check browser console for errors

### 3. Check Browser Console

Open Developer Tools (F12) and look for errors like:
```
AppwriteException: User (role: guests) missing scope (documents.read)
```
This means permissions are wrong.

### 4. Verify Collection IDs Match

In both `user-app/src/lib/appwrite.js` and `admin-panel/src/lib/appwrite.js`:

```javascript
export const APPWRITE_CONFIG = {
    PROJECT_ID: '68f5e984002817f132e2',
    DATABASE_ID: '6924bf52002dda6b6eff',
    COLLECTIONS: {
        PRODUCTS: 'products',        // Must match Appwrite collection ID
        SUPERMARKETS: 'supermarkets',
        PRICES: 'prices',
        FEEDBACK: 'feedback',
        USER_PROFILES: 'user_profiles'
    }
};
```

## Testing Steps

### 1. Test Admin Panel First

```bash
# Open admin panel
http://localhost:5176/

# Login with your account
# Go to Products page
# Add a test product:
Name: Test Product
Barcode: 123456789
Category: Test
Image URL: https://via.placeholder.com/150
Description: Test description
Price: 10.00
Stock: 100
```

### 2. Check Appwrite Console

After adding product:
1. Go to Appwrite Console
2. Navigate to products collection
3. Verify the product appears in Documents tab

### 3. Test User App

```bash
# Open user app
http://localhost:5175/

# Try searching for "Test Product"
# Should appear in search results
```

## Common Issues & Solutions

### Issue: "No products found"

**Solution 1**: Check permissions
- Appwrite Console → products → Settings → Permissions
- Add "Any" role with "Read" permission

**Solution 2**: Verify you're logged in
- Logout and login again
- Check that authentication works

**Solution 3**: Clear browser cache
- Hard refresh: Ctrl+Shift+R (Windows) or Cmd+Shift+R (Mac)

### Issue: Products show in admin but not user app

**Solution**: Check the fetch query in user app
- Open browser console
- Look for network requests to Appwrite
- Check if queries are correct

### Issue: "productId" or "supermarketId" not found

**Solution**: These are string fields, not relationships
- When creating a price entry, use the document `$id` from products/supermarkets
- Example:
```javascript
{
    productId: "65abc123...",      // The $id from products collection
    supermarketId: "65def456...",  // The $id from supermarkets collection
    price: 25.50,
    currency: "TRY",
    userId: "current_user_id",
    createdAt: new Date().toISOString()
}
```

## Quick Debug Commands

Open browser console and run:

```javascript
// Check if products exist
const { databases } = await import('./lib/appwrite.js');
const products = await databases.listDocuments(
    '6924bf52002dda6b6eff',
    'products'
);
console.log('Products:', products);
```

## Need More Help?

1. Check browser console for errors
2. Verify Appwrite project is active
3. Ensure you're using the correct Project ID
4. Check that collections exist with correct IDs
5. Verify permissions are set correctly

---

**Remember**: Your schema uses string IDs, not Appwrite relationships. This is simpler and works perfectly fine!
