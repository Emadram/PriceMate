# Products Not Showing - Quick Fix Guide

## 🔴 CRITICAL: Check These First

### 1. Verify Products Exist in Appwrite

1. Go to [Appwrite Console](https://cloud.appwrite.io/)
2. Navigate to: **Databases** → Your Database (`6924bf52002dda6b6eff`)
3. Click **products** collection
4. Click **Documents** tab
5. **Do you see any products listed?**
   - ✅ **YES** → Go to step 2
   - ❌ **NO** → Add products first (see below)

### 2. Check Permissions (MOST COMMON ISSUE)

1. In Appwrite Console, click **products** collection
2. Go to **Settings** tab (top right)
3. Scroll down to **Permissions** section
4. Click **Update Permissions**
5. **You should see:**
   ```
   Role: Any
   Permissions: Read ✓
   ```
6. **If "Any" with "Read" is missing:**
   - Click **+ Add a role**
   - Select **Any**
   - Check **Read** checkbox
   - Click **Update**

### 3. Add Test Product (If No Products Exist)

**Via Admin Panel** (Recommended):
1. Open: http://localhost:5176/
2. Login with your account
3. Click **Products**
4. Click **+ Add Product**
5. Fill in:
   ```
   Name: Coca Cola
   Barcode: 5449000000996
   Category: Beverages
   Image URL: https://images.unsplash.com/photo-1554866585-cd94860890b7?w=400
   Description: Refreshing cola drink
   Price: 25.50
   Stock Quantity: 100
   ```
6. Click **Create**

**Via Appwrite Console** (Alternative):
1. Go to **products** collection
2. Click **Add Document**
3. Fill in the fields manually

### 4. Test in Browser Console

1. Open User App: http://localhost:5175/
2. Press **F12** to open Developer Tools
3. Go to **Console** tab
4. Try searching for a product
5. **Look for these messages:**
   ```
   🔍 Searching for products with name: coca
   📊 Using database: 6924bf52002dda6b6eff
   📦 Using collection: products
   ✅ Search successful! Found 1 products
   ```

6. **If you see an error like:**
   ```
   ❌ Search error: User (role: guests) missing scope (documents.read)
   ```
   → **This means permissions are wrong!** Go back to step 2.

### 5. Verify Collection ID

Check that your collection ID is exactly `products` (lowercase):

1. In Appwrite Console → products collection
2. Look at the URL or collection settings
3. Collection ID should be: `products`

If it's different, update `/user-app/src/lib/appwrite.js`:
```javascript
COLLECTIONS: {
    PRODUCTS: 'your_actual_collection_id_here',
    // ...
}
```

## 🧪 Debug Script

Copy this into browser console to test:

```javascript
// Test if you can fetch products
const { databases } = await import('./lib/appwrite.js');
const APPWRITE_CONFIG = {
    DATABASE_ID: '6924bf52002dda6b6eff',
    COLLECTIONS: { PRODUCTS: 'products' }
};

const response = await databases.listDocuments(
    APPWRITE_CONFIG.DATABASE_ID,
    APPWRITE_CONFIG.COLLECTIONS.PRODUCTS
);

console.log('Products found:', response.documents.length);
console.log('Products:', response.documents);
```

## ✅ Expected Behavior

After fixing:
1. **Search** for "coca" → Should find "Coca Cola"
2. **Click product** → Should show price comparison page
3. **No errors** in browser console

## 🆘 Still Not Working?

**Check these:**

1. **Are you logged in?**
   - Logout and login again
   - Check top-right corner for profile icon

2. **Clear browser cache:**
   - Press Ctrl+Shift+R (Windows) or Cmd+Shift+R (Mac)
   - Or clear cache in DevTools

3. **Check network tab:**
   - Open DevTools → Network tab
   - Search for a product
   - Look for request to `cloud.appwrite.io`
   - Check the response

4. **Verify Appwrite project is active:**
   - Go to Appwrite Console
   - Check project status

## 📝 Common Errors & Solutions

| Error | Solution |
|-------|----------|
| `User (role: guests) missing scope` | Fix permissions (step 2) |
| `Document with the requested ID could not be found` | Wrong collection ID |
| `No products found` | Add products first (step 3) |
| `Network error` | Check internet connection |

---

**Need more help?** Share the error message from browser console!
