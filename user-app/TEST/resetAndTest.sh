#!/bin/bash

# Complete database reset and reseed workflow

echo "🚨 COMPLETE DATABASE RESET"
echo "This will DELETE ALL DATA and create fresh seed data"
echo ""
echo "Press Ctrl+C now to cancel, or wait 5 seconds to continue..."
sleep 5

echo ""
echo "Step 1: Clearing ALL database collections..."
export APPWRITE_API_KEY="${APPWRITE_API_KEY}"
node TEST/setup/clearDatabase.js

echo ""
echo "Step 2: Seeding fresh data..."
node TEST/setup/seedDatabase.js

echo ""
echo "Step 3: Running verification tests..."
node TEST/integration/fullSiteTest.js

echo ""
echo "✅ Process complete! Check test_report.txt for results"
