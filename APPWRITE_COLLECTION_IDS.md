# PriceMate - Complete Collection ID Reference

## Database Information
- **Database ID:** `6924bf52002dda6b6eff`
- **Project ID:** `68f5e984002817f132e2`

## Collection IDs (VERIFIED)

### ✅ Categories
- **Collection ID:** `category` (singular)
- **Key Attributes:**
  - `categoryName` (string, required)
  - `Icon` (string, optional)
  - `products` (relationship, Many to one)

### ✅ Products
- **Collection ID:** `products`
- **Key Attributes:**
  - `name` (string, required)
  - `barcode` (string, required)
  - `imageUrl` (url, required)
  - `description` (string, optional)
  - `stockQuantity` (integer, required)
  - `categoryId` (relationship → category)
  - `supermarkets` (relationship → supermarkets)
  - `pricesCollection` (relationship → prices_collection)

### ✅ Supermarkets
- **Collection ID:** `supermarkets`
- **Key Attributes:**
  - `name` (string, required)
  - `latitude` (double, required)
  - `longitude` (double, required)
  - `address` (string, optional)
  - `phoneNumber` (string, optional)
  - `email` (email, optional)
  - `icon` (string, optional)
  - `products` (relationship)
  - `pricesCollection` (relationship)

### ✅ Prices
- **Collection ID:** `prices_collection` (NOT just "prices")
- **Key Attributes:**
  - `price` (double, required, min: 0, max: 1000000)
  - `currency` (enum, optional)
  - `userId` (string, required, size: 36)
  - `products` (relationship → products, Many to one)
  - `supermarkets` (relationship → supermarkets, Many to one)

### ✅ Feedback
- **Collection ID:** `feedback`
- **Key Attributes:**
  - `userId` (string, required)
  - `type` (enum)
  - `message` (string, required)
  - `status` (enum)

### ✅ User Profiles
- **Collection ID:** `user_profiles`
- **Key Attributes:**
  - `userId` (string, required)
  - `displayName` (string, optional)
  - `favorites` (enum, optional)
  - `birthdate` (datetime, optional)
  - `bio` (string, optional)
  - `profileImageUrl` (url, optional)
  - `location` (string, optional)

## Important Notes

### Relationship Querying
❌ **Cannot query directly on relationship attributes:**
```javascript
// This WILL NOT work:
Query.equal('products', productId)
```

✅ **Must fetch all and filter client-side:**
```javascript
// Fetch all
const all = await databases.listDocuments(DB_ID, COLLECTION_ID, [Query.limit(100)]);
// Filter client-side
const filtered = all.documents.filter(doc => doc.products?.$id === productId);
```

✅ **Can select relationship data:**
```javascript
Query.select(['*', 'categoryId.categoryName', 'supermarkets.name'])
```

### Config File Location
Both apps must have matching collection IDs:
- `/admin-panel/src/lib/appwrite.js`
- `/user-app/src/lib/appwrite.js`

## Quick Reference

```javascript
export const APPWRITE_CONFIG = {
    PROJECT_ID: '68f5e984002817f132e2',
    DATABASE_ID: '6924bf52002dda6b6eff',
    COLLECTIONS: {
        CATEGORIES: 'category',           // ← singular!
        PRODUCTS: 'products',
        SUPERMARKETS: 'supermarkets',
        PRICES: 'prices_collection',      // ← with _collection!
        FEEDBACK: 'feedback',
        USER_PROFILES: 'user_profiles'
    }
};
```
