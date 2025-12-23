# Quick Start: Appwrite Setup for PriceMate

Follow these steps to get your PriceMate app running with real data!

## Step 1: Verify Your Appwrite Project ✅

1. Go to [Appwrite Cloud Console](https://cloud.appwrite.io/)
2. Login to your account
3. Your project details:
   - **Project ID**: `68f5e984002817f132e2`
   - **Database ID**: `6924bf52002dda6b6eff`

## Step 2: Check Collections Exist

Verify these 5 collections are created in your database:

- ✅ `products` (ID: `6924bf6a000e8e8c5f4a`)
- ✅ `supermarkets` (ID: `6924bf7c0027f7f4b8e3`)
- ✅ `prices` (ID: `6924bf8a0033c5e8f9d2`)
- ✅ `feedback` (ID: `6924bf9b002b4d3a7c1e`)
- ✅ `user_profiles` (ID: `6924bfac001a2f5e6b9d`)

If collections don't exist, refer to `APPWRITE_SCHEMA.md` for detailed setup.

## Step 3: Set Collection Permissions

For each collection, set these permissions in Appwrite Console:

### Products, Supermarkets, Prices:
- **Read**: `Any` (allow anyone to read)
- **Create**: `Users` (any authenticated user)
- **Update**: `Users`
- **Delete**: `Users`

### Feedback:
- **Read**: `Users` (only authenticated users)
- **Create**: `Users`

### User Profiles:
- **Read**: `Users`
- **Create**: `Users`
- **Update**: `Users` (document level: owner only)

## Step 4: Create Your First Account

1. Open **User App**: http://localhost:5175/
2. Click **"Register"**
3. Fill in:
   - **Name**: Your Name
   - **Email**: your@email.com
   - **Password**: YourPassword123
4. Click **"Register"**
5. You'll be automatically logged in!

## Step 5: Add Sample Products (via Admin Panel)

1. Open **Admin Panel**: http://localhost:5176/
2. Login with the same credentials from Step 4
3. Click **"Products"** card
4. Click **"+ Add Product"**

### Sample Product 1: Coca Cola
```
Name: Coca Cola 1L
Barcode: 5449000000996
Category: Beverages
Image URL: https://images.unsplash.com/photo-1554866585-cd94860890b7?w=400
Description: Refreshing cola drink
```

### Sample Product 2: Fresh Milk
```
Name: Fresh Milk 1L
Barcode: 8690504001003
Category: Dairy
Image URL: https://images.unsplash.com/photo-1550583724-b2692b85b150?w=400
Description: Fresh whole milk
```

### Sample Product 3: White Bread
```
Name: White Bread
Barcode: 8690632006840
Category: Bakery
Image URL: https://images.unsplash.com/photo-1509440159596-0249088772ff?w=400
Description: Fresh white bread
```

## Step 6: Add Supermarkets

In Admin Panel, click **"Supermarkets"** → **"+ Add Supermarket"**

### Supermarket 1: Migros
```
Name: Migros
Latitude: 35.1856
Longitude: 33.3823
Address: Nicosia, Cyprus
Logo URL: (optional)
```

### Supermarket 2: Lemar
```
Name: Lemar
Latitude: 35.1753
Longitude: 33.3642
Address: Nicosia, Cyprus
Logo URL: (optional)
```

### Supermarket 3: Metro
```
Name: Metro
Latitude: 35.1923
Longitude: 33.3712
Address: Nicosia, Cyprus
Logo URL: (optional)
```

## Step 7: Add Prices

In Admin Panel, you'll need to manually add price entries. Since there's no UI for this yet, you can add them via Appwrite Console:

1. Go to Appwrite Console → Database → `prices` collection
2. Click **"Add Document"**
3. For each product, add prices from different supermarkets:

**Example for Coca Cola:**
```json
{
  "product_id": "[ID of Coca Cola product]",
  "supermarket_id": "[ID of Migros]",
  "price": 25.00,
  "currency": "TRY",
  "created_at": "2024-11-24T23:00:00.000Z"
}
```

Repeat for each product × supermarket combination.

## Step 8: Test the Application! 🎉

### User App Testing:
1. **Search**: Type "Coca Cola" in search bar
2. **Scan**: Click "Scan Barcode" and try scanning a barcode
3. **Product Details**: Click on a product to see price comparison
4. **Profile**: Click profile icon, explore Favorites and Feedback
5. **Dark Mode**: Toggle between light/dark mode with 🌙/☀️

### Admin Panel Testing:
1. **Dashboard**: View all management options
2. **Products**: Add/Edit/Delete products
3. **Supermarkets**: Manage supermarket locations
4. **Prices**: View all price entries
5. **Feedback**: Review user feedback

## Troubleshooting

### "No products found"
- Check that products are created in Appwrite Console
- Verify collection permissions (Read: Any)
- Check browser console for errors

### "Authentication failed"
- Make sure you registered an account first
- Check Project ID in `appwrite.js` files
- Verify Appwrite project is active

### Barcode scanner not working
- Use HTTPS or localhost
- Grant camera permissions
- Try with a physical barcode or barcode image

## Next Steps

Once everything works:
1. ✅ Add more products with real barcodes
2. ✅ Add actual supermarket locations in your area
3. ✅ Collect real price data
4. ✅ Deploy to production (Vercel/Netlify)
5. ✅ Share with users!

---

**Need Help?** Check the detailed `APPWRITE_SCHEMA.md` for collection structure details.
