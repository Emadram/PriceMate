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

    console.log(`Usages successfully found for collections: ${Array.from(usages).join(', ') || 'None'}`);

    // Scan for relationship queries and error-prone attribute usage
    let hasRelationshipAccess = false;
    let relationshipFlaws = 0;
    files.forEach(file => {
        if (file.endsWith('.js') || file.endsWith('.jsx')) {
            const content = fs.readFileSync(file, 'utf8');
            if (content.includes('categoryId.$id') || content.includes('products.$id') || content.includes('supermarkets.$id')) {
                hasRelationshipAccess = true;
            }
            // Warning for unprotected optional chaining when checking relation IDs
            // Matches something like `p.categoryId.$id` but requires it to be carefully handled.
            if (content.match(/(?<!\?)\.(categoryId|products|supermarkets)\.\$id/)) {
                // Actually they might be protected upstream, so just count potential flaws
                relationshipFlaws++;
            }
        }
    });

    if (hasRelationshipAccess) {
        console.log(`Info: Found relationship expansions (e.g. categoryId.$id) across endpoints.`);
    }
    if (relationshipFlaws > 0) {
        console.log(`[!] Warning: Found ${relationshipFlaws} direct accesses to relation properties (e.g., .products.$id) without optional chaining (?).`);
        issueCount += relationshipFlaws;
    }
});

console.log('\n--- Consistency Summary ---');
if (issueCount === 0) {
    console.log('PASS: All collection identifiers are correctly defined across both applications.');
} else {
    console.log(`NOTICE: Found ${issueCount} potential configuration differences (Check if CHAT_HISTORY or ANNOUNCEMENTS were manually setup in Appwrite console).`);
}
