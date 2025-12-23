# Appwrite Relationships Setup Guide

## Step 1: Create Categories Collection

1. Go to Appwrite Console → Your Database
2. Click **Create Collection**
3. Fill in:
   - **Collection ID**: `categories`
   - **Collection Name**: Categories

4. Click **Create**

### Add Attributes:

Click **Create Attribute** for each:

1. **name**
   - Type: String
   - Size: 100
   - Required: ✓
   - Array: ✗

2. **icon**
   - Type: String
   - Size: 50
   - Required: ✗

3. **description**
   - Type: String
   - Size: 500
   - Required: ✗

### Add Index:

1. Go to **Indexes** tab
2. Click **Create Index**
   - Key: `name_unique`
   - Type: Unique
   - Attribute: name

### Set Permissions:

1. Go to **Settings** → **Permissions**
2. Add:
   - **Any** → Read ✓
   - **Users** → Create ✓, Update ✓, Delete ✓

---

## Step 2: Update Products Collection

### Delete Old Attribute:

1. Go to **products** collection
2. Go to **Attributes** tab
3. Find `category` (string)
4. Click **Delete** (⚠️ This will delete data!)

### Add Relationship Attributes:

1. Click **Create Attribute** → **Relationship**

**First Relationship: categoryId**
- **Related Collection**: categories
- **Relationship Type**: Many to one
- **Attribute Key (This side)**: `categoryId`
- **Attribute Key (Related side)**: `products`
- **On Delete**: Set NULL
- Click **Create**

2. Click **Create Attribute** → **Relationship**

**Second Relationship: supermarketId**
- **Related Collection**: supermarkets
- **Relationship Type**: Many to one
- **Attribute Key (This side)**: `supermarketId`
- **Attribute Key (Related side)**: `products`
- **On Delete**: Set NULL
- Click **Create**

---

## Step 3: Update Prices Collection

### Delete Old String Attributes:

1. Go to **prices** collection
2. Delete `productId` (string)
3. Delete `supermarketId` (string)

### Add Relationship Attributes:

1. Click **Create Attribute** → **Relationship**

**First Relationship: productId**
- **Related Collection**: products
- **Relationship Type**: Many to one
- **Attribute Key (This side)**: `productId`
- **Attribute Key (Related side)**: `prices`
- **On Delete**: Cascade (delete prices when product deleted)
- Click **Create**

2. Click **Create Attribute** → **Relationship**

**Second Relationship: supermarketId**
- **Related Collection**: supermarkets
- **Relationship Type**: Many to one
- **Attribute Key (This side)**: `supermarketId`
- **Attribute Key (Related side)**: `prices`
- **On Delete**: Cascade
- Click **Create**

---

## Step 4: Add Sample Categories

1. Go to **categories** collection
2. Click **Add Document**
3. Add these categories:

```json
{
  "name": "Beverages",
  "icon": "drink",
  "description": "Soft drinks, juices, water"
}
```

```json
{
  "name": "Dairy",
  "icon": "milk",
  "description": "Milk, cheese, yogurt"
}
```

```json
{
  "name": "Bakery",
  "icon": "bread",
  "description": "Bread, pastries, cakes"
}
```

```json
{
  "name": "Snacks",
  "icon": "snack",
  "description": "Chips, cookies, candy"
}
```

---

## Verification Checklist

- [ ] Categories collection created with attributes
- [ ] Products collection has `categoryId` relationship
- [ ] Products collection has `supermarketId` relationship
- [ ] Prices collection has `productId` relationship
- [ ] Prices collection has `supermarketId` relationship
- [ ] Sample categories added
- [ ] All permissions set correctly

---

## Next Steps

After completing Appwrite setup:
1. Install React Icons: `npm install react-icons`
2. Update code to use relationships
3. Test creating products with required category/supermarket

## Important Notes

⚠️ **Relationships vs String IDs**:
- Old way: Store document ID as string, fetch manually
- New way: Appwrite handles relationships automatically
- Benefits: Data integrity, automatic joins, cascade deletes

⚠️ **Required Fields**:
- Products now REQUIRE category and supermarket
- Must create categories and supermarkets BEFORE products
