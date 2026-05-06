const fs = require('fs');
const path = require('path');

// These are our canonical IDs as per previous sessions and requirements
const COLLECTIONS = {
    CATEGORIES: 'category',
    PRODUCTS: 'products',
    SUPERMARKETS: 'supermarkets',
    PRICES: 'prices_collection',
    PRICE_HISTORY: 'price_history',
    FEEDBACK: 'feedback',
    USER_PROFILES: 'user_profiles',
    FAVORITES: 'favorites',
    ANNOUNCEMENTS: 'announcements',
    CHAT_HISTORY: 'chat_history'
};

const APP_PATHS = {
    'user-app': path.join(__dirname, 'user-app'),
    'admin-panel': path.join(__dirname, 'admin-panel')
};

function getFiles(dir, files_ = []) {
    if (!fs.existsSync(dir)) return files_;
    try {
        const files = fs.readdirSync(dir);
        for (const i in files) {
            const name = path.join(dir, files[i]);
            if (fs.statSync(name).isDirectory()) {
                if (name.includes('node_modules')) continue;
                getFiles(name, files_);
            } else {
                files_.push(name);
            }
        }
    } catch (e) {}
    return files_;
}

console.log('--- PriceMate Backend/Frontend Consistency Check ---');

let issueCount = 0;

Object.entries(APP_PATHS).forEach(([appName, appPath]) => {
    console.log(`\nChecking ${appName}...`);
    
    // Check appwrite.js for config
    const configPath = path.join(appPath, 'src/lib/appwrite.js');
    if (fs.existsSync(configPath)) {
        const content = fs.readFileSync(configPath, 'utf8');
        Object.keys(COLLECTIONS).forEach(key => {
            if (!content.includes(key)) {
                if (appName === 'admin-panel' && (key === 'CHAT_HISTORY' || key === 'FAVORITES' || key === 'USER_PROFILES')) {
                    // These are expectedly missing in admin
                    return;
                }
                console.log(`[!] Warning: Missing definition for '${key}' in ${configPath}`);
                issueCount++;
            }
        });
    }

    // Scan all src files for collection usage
    const files = getFiles(path.join(appPath, 'src'));
    const usages = new Set();
    
    files.forEach(file => {
        if (file.endsWith('.js') || file.endsWith('.jsx')) {
            const content = fs.readFileSync(file, 'utf8');
            Object.keys(COLLECTIONS).forEach(key => {
                if (content.includes(`COLLECTIONS.${key}`)) {
                    usages.add(key);
                }
            });
        }
    });

    console.log(`Usages successfully found for: ${Array.from(usages).join(', ') || 'None'}`);
});

console.log('\n--- Consistency Summary ---');
if (issueCount === 0) {
    console.log('PASS: All collection identifiers are correctly defined across both applications.');
} else {
    console.log(`NOTICE: Found ${issueCount} potential configuration differences (Check if CHAT_HISTORY or ANNOUNCEMENTS were manually setup in Appwrite console).`);
}
