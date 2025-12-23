# PriceMate - User Application

A modern React application for comparing product prices across different supermarkets in Turkey.

## Features

- 🔍 **Product Search**: Search products by name or scan barcodes
- 💰 **Price Comparison**: Compare prices across multiple supermarkets
- 🏪 **Supermarket Profiles**: View all products available at each store
- ⭐ **Favorites**: Save your frequently purchased items
- 🌙 **Dark Mode**: Comfortable viewing in any lighting
- 📱 **Responsive Design**: Works on desktop and mobile

## Tech Stack

- **Frontend**: React 18 + Vite
- **Styling**: TailwindCSS
- **Backend**: Appwrite (BaaS)
- **State Management**: Zustand
- **Routing**: React Router v6
- **Icons**: React Icons

## Getting Started

### Prerequisites
- Node.js 18+ 
- npm or yarn
- Appwrite account and project

### Installation

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```

3. Configure Appwrite:
   - Create `.env` file with your Appwrite credentials
   - Update `src/lib/appwrite.js` with your project details

4. Run development server:
   ```bash
   npm run dev
   ```

## Project Structure

```
user-app/
├── src/
│   ├── components/      # Reusable UI components
│   ├── pages/          # Page components (routes)
│   ├── lib/            # Appwrite configuration
│   ├── stores/         # Zustand state management
│   └── utils/          # Helper functions
├── TEST/               # Testing & database scripts
│   ├── README.md       # Test documentation
│   ├── seedDatabase.js
│   ├── fullSiteTest.js
│   └── ...
└── public/             # Static assets
```

## Testing & Database

See [TEST/README.md](TEST/README.md) for comprehensive testing and database seeding documentation.

**Quick Start:**
```bash
export APPWRITE_API_KEY="your_api_key"
node TEST/seedDatabase.js     # Populate database
node TEST/fullSiteTest.js     # Run tests
```

## Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run preview` - Preview production build
- `npm run lint` - Run ESLint

## Contributing

This is a graduation project for the Computer Engineering department.

## License

Private academic project - All rights reserved
