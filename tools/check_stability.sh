#!/bin/bash
# Stability check script for PriceMate

echo "🚀 Starting stability check..."

# Check user-app
echo "📦 Checking user-app..."
cd user-app
if npm run build; then
    echo "✅ user-app build successful"
else
    echo "❌ user-app build failed"
    exit 1
fi
cd ..

# Check admin-panel
echo "📦 Checking admin-panel..."
cd admin-panel
if npm run build; then
    echo "✅ admin-panel build successful"
else
    echo "❌ admin-panel build failed"
    exit 1
fi
cd ..

echo "🎉 All systems stable!"
exit 0
