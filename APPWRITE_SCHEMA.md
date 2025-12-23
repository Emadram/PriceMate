# Appwrite Database Setup Guide

Please create a Database named `PriceMateDB` (ID: `pricemate_db`) and then create the following Collections.

## 1. Products Collection
- **Name**: Products
- **ID**: `products`
- **Permissions**: Read: Any, Create: Admin, Update: Admin, Delete: Admin
- **Attributes**:
    - `name` (String, 255, Required)
    - `barcode` (String, 50, Required) - *Index this attribute (Unique)*
    - `category` (String, 100, Required)
    - `image_url` (Url, Required)
    - `description` (String, 1000, Optional)

## 2. Supermarkets Collection
- **Name**: Supermarkets 
- **ID**: `supermarkets`
- **Permissions**: Read: Any, Create: Admin, Update: Admin, Delete: Admin
- **Attributes**:
        - `name` (String, 255, Required)
        - `logo_url` (Url, Optional)
        - `latitude` (Float, Required)
        - `longitude` (Float, Required)
        - `address` (String, 500, Optional)
        - `phoneNumber` (String, 20, Optional)
        - `email` (Email, Optional)
        - `bannerUrl` (Url, Optional)

## 3. Prices Collection
- **Name**: Prices
- **ID**: `prices`
- **Permissions**: Read: Any, Create: Users, Update: Admin, Delete: Admin
- **Attributes**:
    - `product_id` (String, Required) - *Relationship to Products (Two-way)*
    - `supermarket_id` (String, Required) - *Relationship to Supermarkets (Two-way)*
    - `price` (Float, Required)
    - `currency` (String, 10, Default: "TRY")
    - `user_id` (String, Required) - *ID of the user who reported it*
    - `created_at` (Datetime, Required)

## 4. Feedback Collection
- **Name**: Feedback
- **ID**: `feedback`
- **Permissions**: Read: Admin, Create: Users
- **Attributes**:
    - `user_id` (String, Required)
    - `message` (String, 1000, Required)
    - `type` (String, 50, Default: "general") - *e.g., "incorrect_price", "bug", "feature"*
    - `status` (String, 50, Default: "open")

## 5. Users Collection (Optional - for extra profile data)
- **Name**: UserProfiles
- **ID**: `user_profiles`
- **Permissions**: Read: Any, Create: Users, Update: Users (Own)
- **Attributes**:
    - `user_id` (String, Required) - *Link to Auth User ID*
    - `display_name` (String, 255, Optional)
    - `favorites` (String array, Optional) - *List of Product IDs*
