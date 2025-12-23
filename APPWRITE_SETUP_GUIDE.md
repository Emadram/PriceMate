# Appwrite Setup Guide for PriceMate

This guide will help you set up your Appwrite database with real data to test the application.

## Step 1: Verify Appwrite Project

1. Go to [Appwrite Cloud Console](https://cloud.appwrite.io/)
2. Verify your project ID: `68f5e984002817f132e2`
3. Verify your database ID: `6924bf52002dda6b6eff`

## Step 2: Verify Collections

Make sure you have created all the collections as specified in `APPWRITE_SCHEMA.md`:

- ✅ `products` - Product information
- ✅ `supermarkets` - Supermarket locations
- ✅ `prices` - Price entries
- ✅ `feedback` - User feedback
- ✅ `user_profiles` - User profile data

## Step 3: Set Up Permissions

For each collection, configure the permissions:

### Products Collection
- **Read**: Any
- **Create**: Users (for admin panel)
- **Update**: Users (for admin panel)
- **Delete**: Users (for admin panel)

### Supermarkets Collection
- **Read**: Any
- **Create**: Users
- **Update**: Users
- **Delete**: Users

### Prices Collection
- **Read**: Any
- **Create**: Users
- **Update**: Users
- **Delete**: Users

### Feedback Collection
- **Read**: Users (only admins should see all)
- **Create**: Users

### User Profiles Collection
- **Read**: Users
- **Create**: Users
- **Update**: Users (own documents)

## Step 4: Add Sample Data

### Add Sample Products

Use the Admin Panel (http://localhost:5174/) to add products:

**Example Product 1:**
- Name: Coca Cola 1L
- Barcode: 5449000000996
- Category: Beverages
- Image URL: https://images.unsplash.com/photo-1554866585-cd94860890b7?w=400
- Description: Refreshing cola drink

**Example Product 2:**
- Name: Milk 1L
- Barcode: 8690504001003
- Category: Dairy
- Image URL: https://images.unsplash.com/photo-1550583724-b2692b85b150?w=400
- Description: Fresh whole milk

**Example Product 3:**
- Name: Bread
- Barcode: 8690632006840
- Category: Bakery
- Image URL: https://images.unsplash.com/photo-1509440159596-0249088772ff?w=400
- Description: Fresh white bread

### Add Sample Supermarkets

**Example Supermarket 1:**
- Name: Migros
- Latitude: 35.1856
- Longitude: 33.3823
- Address: Nicosia, Cyprus

**Example Supermarket 2:**
- Name: Lemar
- Latitude: 35.1753
- Longitude: 33.3642
- Address: Nicosia, Cyprus

**Example Supermarket 3:**
- Name: Metro
- Latitude: 35.1923
- Longitude: 33.3712
- Address: Nicosia, Cyprus

### Add Sample Prices

For each product, add prices from different supermarkets:

**Coca Cola 1L:**
- Migros: 25.00 TRY
- Lemar: 24.50 TRY
- Metro: 26.00 TRY

**Milk 1L:**
- Migros: 35.00 TRY
- Lemar: 34.00 TRY
- Metro: 35.50 TRY

**Bread:**
- Migros: 15.00 TRY
- Lemar: 14.50 TRY
- Metro: 15.50 TRY

## Step 5: Create Test User Account

1. Open the User App: http://localhost:5173/
2. Click "Register"
3. Create an account with:
   - Name: Test User
   - Email: test@pricemate.com
   - Password: Test123456

## Step 6: Test the Application

### Test User App Features:
1. **Login** - Use your test account
2. **Search** - Search for "Coca Cola"
3. **Scan** - Try scanning a barcode (use your phone camera)
4. **Product Details** - View product and price comparison
5. **Profile** - Access your profile
6. **Favorites** - Add products to favorites
7. **Feedback** - Submit feedback

### Test Admin Panel Features:
1. **Login** - Use the same test account at http://localhost:5174/
2. **Products** - Add/Edit/Delete products
3. **Supermarkets** - Add/Edit/Delete supermarkets
4. **Prices** - View all price entries
5. **Feedback** - Review user feedback

## Step 7: Verify Data Flow

1. Add a product in Admin Panel
2. Search for it in User App
3. Scan its barcode
4. View price comparison
5. Add to favorites
6. Submit feedback

## Troubleshooting

### If you get authentication errors:
- Check that your Appwrite Project ID is correct in both apps
- Verify the Database ID matches
- Ensure collections are created with correct IDs

### If data doesn't appear:
- Check collection permissions (Read: Any for products, supermarkets, prices)
- Verify the data was created successfully in Appwrite Console
- Check browser console for errors

### If barcode scanner doesn't work:
- Ensure you're using HTTPS or localhost
- Grant camera permissions in your browser
- Try using a physical barcode or barcode image

## Next Steps

Once you have verified everything works:
1. Add more real products with actual barcodes
2. Add real supermarket locations
3. Collect actual price data
4. Deploy to production (Vercel/Netlify)
5. Configure production Appwrite endpoint
