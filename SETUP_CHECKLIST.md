# Appwrite Setup Checklist ✅

Use this checklist to set up your PriceMate database step by step.

## Pre-Setup
- [ ] Logged into [Appwrite Cloud Console](https://cloud.appwrite.io/)
- [ ] Project ID verified: `68f5e984002817f132e2`
- [ ] Database ID verified: `6924bf52002dda6b6eff`

## Collections Setup
- [ ] **Products** collection exists (ID: `products`)
  - [ ] Attributes created (name, barcode, category, image_url, description)
  - [ ] Permissions set: Read=Any, Create/Update/Delete=Users
  - [ ] Barcode attribute indexed (unique)
  
- [ ] **Supermarkets** collection exists (ID: `supermarkets`)
  - [ ] Attributes created (name, logo_url, latitude, longitude, address)
  - [ ] Permissions set: Read=Any, Create/Update/Delete=Users
  
- [ ] **Prices** collection exists (ID: `prices`)
  - [ ] Attributes created (product_id, supermarket_id, price, currency, user_id, created_at)
  - [ ] Permissions set: Read=Any, Create=Users, Update/Delete=Users
  
- [ ] **Feedback** collection exists (ID: `feedback`)
  - [ ] Attributes created (user_id, message, type, status)
  - [ ] Permissions set: Read=Users, Create=Users
  
- [ ] **User Profiles** collection exists (ID: `user_profiles`)
  - [ ] Attributes created (user_id, display_name, favorites)
  - [ ] Permissions set: Read=Users, Create=Users, Update=Users

## User Account
- [ ] Registered account in User App (http://localhost:5175/)
- [ ] Can login successfully
- [ ] Can access Admin Panel with same credentials (http://localhost:5176/)

## Sample Data
- [ ] Added 3 sample products via Admin Panel
- [ ] Added 3 sample supermarkets via Admin Panel
- [ ] Added price entries for products (via Appwrite Console)

## Testing
- [ ] Search works in User App
- [ ] Product details display correctly
- [ ] Price comparison shows multiple supermarkets
- [ ] Profile page accessible
- [ ] Dark mode toggle works
- [ ] Admin Panel CRUD operations work

## Optional Enhancements
- [ ] Added real product barcodes
- [ ] Added actual supermarket locations
- [ ] Collected real price data
- [ ] Tested barcode scanner with physical barcodes

---

**Current Status**: Ready to set up!
**Next Step**: Follow QUICK_START.md for detailed instructions.
