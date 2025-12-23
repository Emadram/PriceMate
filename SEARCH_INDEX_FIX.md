# 🔧 Appwrite Search Not Working - Index Fix

## Problem
Appwrite's `Query.search()` requires a **fulltext index** on the attribute you're searching.

## Solution: Add Fulltext Index to `name` Attribute

### Step 1: Go to Appwrite Console
1. Open [Appwrite Console](https://cloud.appwrite.io/)
2. Navigate to your Database (`6924bf52002dda6b6eff`)
3. Click on **products** collection

### Step 2: Go to Indexes Tab
1. Click the **Indexes** tab (next to Columns, Rows, etc.)
2. Click **Create Index** button

### Step 3: Create Fulltext Index
Fill in the form:
- **Index Key**: `name_search` (or any name you want)
- **Index Type**: Select **Fulltext**
- **Attributes**: Select **name**
- **Orders**: Leave as default

Click **Create**

### Step 4: Wait for Index to Build
- Appwrite will build the index (usually takes a few seconds)
- You'll see a status indicator

## Alternative: Use `contains()` Instead of `search()`

If you don't want to create an index, update the code to use `contains()`:

**File**: `/user-app/src/stores/productStore.js`

Change line 58 from:
```javascript
[Query.search('name', name)]
```

To:
```javascript
[Query.contains('name', name)]
```

**Note**: `contains()` is case-sensitive and slower, but doesn't require an index.

## Better Alternative: Use Multiple Query Methods

Update the search function to be more flexible:

```javascript
fetchProductsByName: async (name) => {
    set({ loading: true, error: null, prices: [] });
    console.log('🔍 Searching for products with name:', name);
    
    try {
        // Try multiple search strategies
        let response;
        
        // Strategy 1: Try fulltext search (if index exists)
        try {
            response = await databases.listDocuments(
                APPWRITE_CONFIG.DATABASE_ID,
                APPWRITE_CONFIG.COLLECTIONS.PRODUCTS,
                [Query.search('name', name)]
            );
        } catch (searchError) {
            // Strategy 2: Fallback to contains (case-sensitive)
            console.log('Fulltext search failed, trying contains...');
            response = await databases.listDocuments(
                APPWRITE_CONFIG.DATABASE_ID,
                APPWRITE_CONFIG.COLLECTIONS.PRODUCTS,
                [Query.contains('name', name)]
            );
        }
        
        console.log('✅ Found', response.documents.length, 'products');
        set({ loading: false });
        return response.documents;
    } catch (error) {
        console.error('❌ Search error:', error);
        
        // Strategy 3: Get all products and filter client-side
        console.log('Trying to fetch all products...');
        try {
            const allProducts = await databases.listDocuments(
                APPWRITE_CONFIG.DATABASE_ID,
                APPWRITE_CONFIG.COLLECTIONS.PRODUCTS
            );
            
            const filtered = allProducts.documents.filter(p => 
                p.name.toLowerCase().includes(name.toLowerCase())
            );
            
            console.log('✅ Client-side filter found', filtered.length, 'products');
            set({ loading: false });
            return filtered;
        } catch (fallbackError) {
            console.error('❌ All strategies failed:', fallbackError);
            set({ loading: false, error: fallbackError.message });
            return [];
        }
    }
}
```

## Quick Test

After adding the index, test in browser console:

```javascript
// Test search
const { databases } = await import('./lib/appwrite.js');
const { Query } = await import('appwrite');

const response = await databases.listDocuments(
    '6924bf52002dda6b6eff',
    'products',
    [Query.search('name', 'coca')]
);

console.log('Found:', response.documents.length);
```

## Expected Result

After fixing:
- ✅ Search for "coca" → Finds "Coca Cola"
- ✅ Search for "milk" → Finds "Fresh Milk"
- ✅ Partial matches work

---

**TL;DR**: Add a fulltext index to the `name` attribute in Appwrite Console, or use the fallback code above.
