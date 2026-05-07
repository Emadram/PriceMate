# PriceMate

MainDevBranch

## Appwrite: “Invalid Origin” / allowed browser hostnames

The web SDK only works from hostnames registered on the **Appwrite Project** (the backend that owns Auth, Database, etc.). That is **not** the same screen as **Sites → build settings** (hosting).

### Where to add the hostname (console UI varies)

Use the **Project** that matches your `VITE_APPWRITE_PROJECT_ID` (open it from [Appwrite Console](https://cloud.appwrite.io), not only the Sites list).

Try these locations until you see **Platforms**, **Web app**, **Hostname**, or **Add platform**:

1. **Project → Overview** — onboarding / “Getting started” cards often include **Add platform** or **Platforms**. Open it and add an entry whose **hostname** is your deployed site host (no `https://`, no path).
2. **Project → Settings** (gear) — look for a **Platforms** (or **Clients** / **Applications**) tab or section, then add **Web** / **Web app**.
3. **Project → Auth** — in some versions, platform / hostname lists appear under Auth or Access.

**Admin (production example):** hostname `pricemateadmin.appwrite.network`  
**User app (production example):** hostname `pricemate.appwrite.network`  
**Local dev:** hostname `localhost` (no port in the hostname field).

Add **one platform per hostname** (or follow console guidance if it allows multiple hostnames).

### If you still cannot find “Web platform”

- Confirm you opened a **Project** (API project), not only **Organization** settings or **Sites**.
- Check [Appwrite CORS / origins troubleshooting](https://appwrite.io/blog/post/cors-error) — it references the **Overview** tab and adding hostnames.
- **Dev keys** (**Overview → Integrations → Dev keys**) only help **development** (they relax limits/CORS for testing). **Do not** use dev keys in production instead of registering hostnames.

### After saving

Hard-refresh the admin or user app. The **API endpoint** in your `.env` must stay your regional Appwrite URL (e.g. `https://<region>.cloud.appwrite.io/v1`), not the Site URL.

