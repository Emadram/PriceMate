# Project Structure Documentation

This document provides a concise overview of the project's directory structure and the purpose of key files.

## Root Directory
- `/user-app`: The main Progressive Web App (PWA) for users.
- `/admin-panel`: The administrative dashboard for managing data.
- `APPWRITE_SCHEMA.md`: Database schema documentation for Appwrite setup.
- `README.md`: General project overview.

---

## /user-app (User Frontend)

### Configuration Files
- `vite.config.js`: Vite configuration with PWA plugin.
- `tailwind.config.js`: TailwindCSS configuration.
- `postcss.config.js`: PostCSS configuration.
- `package.json`: Dependencies and scripts.

### Source Files (`/src`)

#### Entry Point
- `main.jsx`: Application entry point, renders App component.
- `App.jsx`: Main component with routing logic and protected routes.
- `index.css`: Global styles with TailwindCSS directives.

#### Library (`/src/lib`)
- `appwrite.js`: Appwrite Client SDK configuration with Database and Collection IDs.

#### Stores (`/src/stores`)
- `authStore.js`: Zustand store for authentication (login, register, logout, session management).
- `productStore.js`: Zustand store for product data fetching (by barcode, by name, prices).

#### Pages (`/src/pages`)
- `Login.jsx`: User login page.
- `Register.jsx`: User registration page.
- `Home.jsx`: Dashboard with search bar and navigation cards.
- `ScanPage.jsx`: Barcode scanning interface using QuaggaJS.
- `SearchResults.jsx`: Display search results by product name.
- `ProductDetails.jsx`: Product details and price comparison view.

#### Components (`/src/components`)
- `Scanner.jsx`: Barcode scanner component using QuaggaJS library.

---

## /admin-panel (Admin Frontend)

### Configuration Files
- `vite.config.js`: Vite configuration.
- `tailwind.config.js`: TailwindCSS configuration.
- `postcss.config.js`: PostCSS configuration.
- `package.json`: Dependencies and scripts.

### Source Files (`/src`)
- `main.jsx`: Entry point of the React application.
- `App.jsx`: Main component handling routing and layout.
- `index.css`: Global styles including TailwindCSS directives.
- `lib/appwrite.js`: Appwrite Client SDK configuration with Database and Collection IDs.

---

## Key Technologies

### User App
- **React + Vite**: Fast development and build.
- **TailwindCSS**: Utility-first styling.
- **Zustand**: Lightweight state management.
- **React Router**: Client-side routing.
- **QuaggaJS**: Barcode scanning.
- **Appwrite SDK**: Backend integration.
- **PWA**: Installable web app capabilities.

### Admin Panel
- **React + Vite**: Fast development and build.
- **TailwindCSS**: Utility-first styling.
- **Zustand**: Lightweight state management.
- **Appwrite SDK**: Backend integration.
