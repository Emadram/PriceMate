# Troubleshooting: Products Not Showing

## Issue
Products created in Admin Panel don't appear in either Admin Panel or User App.

## Root Cause
This is **100% an Appwrite permissions issue**. The collections need proper permissions set.

## Solution: Fix Collection Permissions

### Step 1: Go to Appwrite Console
1. Open [Appwrite Cloud Console](https://cloud.appwrite.io/)
2. Navigate to your project: `68f5e984002817f132e2`
3. Go to **Databases** → Database `6924bf52002dda6b6eff`

### Step 2: Fix Products Collection Permissions
1. Click on **products** collection
2. Go to **Settings** tab
3. Click **Permissions**
4. **DELETE ALL** existing permissions
5. Add these permissions:

**For Reading (so anyone can see products):**
- Click **+ Add Role**
- Select **Any**
- Check ✅ **Read**
- Click **Create**

**For Creating/Updating/Deleting (so logged-in users can manage):**
- Click **+ Add Role**
- Select **Users** (any authenticated user)
- Check ✅ **Create**
- Check ✅ **Update**
- Check ✅ **Delete**
- Click **Create**

### Step 3: Fix Supermarkets Collection Permissions
Repeat the same process for **supermarkets** collection:
- **Any**: Read ✅
- **Users**: Create ✅, Update ✅, Delete ✅

### Step 4: Fix Prices Collection Permissions
Repeat for **prices** collection:
- **Any**: Read ✅
- **Users**: Create ✅, Update ✅, Delete ✅

### Step 5: Fix Feedback Collection Permissions
For **feedback** collection:
- **Users**: Read ✅, Create ✅

### Step 6: Fix User Profiles Collection Permissions
For **user_profiles** collection:
- **Users**: Read ✅, Create ✅, Update ✅

## Verify It Works

After setting permissions:

1. **Refresh Admin Panel** (http://localhost:5176/)
2. Go to **Products** page
3. You should now see your products!
4. **Refresh User App** (http://localhost:5175/)
5. Search for your product - it should appear!

## Why This Happens

Appwrite has strict security by default. Without proper permissions:
- ❌ API calls fail silently
- ❌ No data is returned
- ❌ Create operations are blocked

With correct permissions:
- ✅ Anyone can read products (for the app)
- ✅ Authenticated users can manage data (for admin panel)

## Quick Check

Open browser console (F12) and look for errors like:
```
AppwriteException: User (role: guests) missing scope (documents.read)
```

This confirms it's a permissions issue!

## Still Not Working?

1. **Clear browser cache** and refresh
2. **Logout and login again** in both apps
3. Check that you're logged in (authentication is required for admin operations)
4. Verify collection IDs match in `appwrite.js` files
