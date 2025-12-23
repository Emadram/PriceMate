
import { Client, Databases, Permission, Role, ID } from 'node-appwrite';

const client = new Client()
    .setEndpoint('https://cloud.appwrite.io/v1')
    .setProject('68f5e984002817f132e2')
    .setKey(process.env.APPWRITE_API_KEY);

const databases = new Databases(client);
const DATABASE_ID = '6924bf52002dda6b6eff';

const setupShoppingLists = async () => {
    console.log('🛍️ Setting up Shopping List Collections...');

    try {
        // 1. Create 'lists' collection
        console.log('Checking "lists" collection...');
        try {
            await databases.getCollection(DATABASE_ID, 'lists');
            console.log('✅ "lists" collection already exists.');
        } catch (error) {
            console.log('Creating "lists" collection...');
            await databases.createCollection(DATABASE_ID, 'lists', 'Shopping Lists', [
                Permission.read(Role.users()), // Allow users to read (Document security handles specifics)
                Permission.create(Role.users()),
                Permission.update(Role.users()),
                Permission.delete(Role.users())
            ], true); // Document security enabled

            // Create Attributes
            console.log('Creating "lists" attributes...');
            await databases.createStringAttribute(DATABASE_ID, 'lists', 'name', 255, true);
            await databases.createStringAttribute(DATABASE_ID, 'lists', 'user_id', 255, true);
            console.log('✅ "lists" collection created.');
        }

        // 2. Create 'list_items' collection
        console.log('Checking "list_items" collection...');
        try {
            await databases.getCollection(DATABASE_ID, 'list_items');
            console.log('✅ "list_items" collection already exists.');
        } catch (error) {
            console.log('Creating "list_items" collection...');
            await databases.createCollection(DATABASE_ID, 'list_items', 'List Items', [
                Permission.read(Role.users()),
                Permission.create(Role.users()),
                Permission.update(Role.users()),
                Permission.delete(Role.users())
            ], true); // Document security enabled

            // Create Attributes
            console.log('Creating "list_items" attributes...');
            await databases.createStringAttribute(DATABASE_ID, 'list_items', 'list_id', 255, true);
            await databases.createStringAttribute(DATABASE_ID, 'list_items', 'product_id', 255, true);
            // Cannot set default for required attribute. Make it required (true) with NO default, or optional (false) with default.
            // Requirement: Items must have quantity, default 1. So make it not required (false) with default 1.
            await databases.createIntegerAttribute(DATABASE_ID, 'list_items', 'quantity', false, 1);
            await databases.createBooleanAttribute(DATABASE_ID, 'list_items', 'checked', false, false);
            console.log('✅ "list_items" collection created.');
        }

        console.log('🎉 Shopping List schema setup complete!');

    } catch (error) {
        console.error('❌ Error setting up schema:', error);
    }
};

setupShoppingLists();
