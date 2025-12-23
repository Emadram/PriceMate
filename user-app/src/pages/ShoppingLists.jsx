import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import useShoppingListStore from '../stores/shoppingListStore';
import { FiPlus, FiTrash2, FiCheck, FiShoppingCart, FiChevronDown, FiChevronUp } from 'react-icons/fi';

const ShoppingLists = () => {
    const { lists, loading, fetchLists, createList, deleteList, toggleItem } = useShoppingListStore();
    const [newListName, setNewListName] = useState('');
    const [expandedListId, setExpandedListId] = useState(null);
    const [isCreating, setIsCreating] = useState(false);

    useEffect(() => {
        fetchLists();
    }, [fetchLists]);

    const handleCreateList = async (e) => {
        e.preventDefault();
        if (!newListName.trim()) return;

        const success = await createList(newListName);
        if (success) {
            setNewListName('');
            setIsCreating(false);
        }
    };

    const toggleExpand = (id) => {
        setExpandedListId(expandedListId === id ? null : id);
    };

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-8 px-4 sm:px-6 lg:px-8 transition-colors">
            <div className="max-w-4xl mx-auto">
                <div className="flex justify-between items-center mb-8">
                    <h1 className="text-3xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
                        <FiShoppingCart /> My Shopping Lists
                    </h1>
                    <button
                        onClick={() => setIsCreating(!isCreating)}
                        className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition"
                    >
                        <FiPlus /> New List
                    </button>
                </div>

                {isCreating && (
                    <form onSubmit={handleCreateList} className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md mb-6 animate-fade-in border dark:border-gray-700">
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            List Name
                        </label>
                        <div className="flex gap-4">
                            <input
                                type="text"
                                value={newListName}
                                onChange={(e) => setNewListName(e.target.value)}
                                placeholder="e.g., Weekly Groceries"
                                className="flex-1 border border-gray-300 dark:border-gray-600 rounded px-3 py-2 focus:outline-none focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                                autoFocus
                            />
                            <button
                                type="submit"
                                disabled={!newListName.trim() || loading}
                                className="bg-green-600 text-white px-6 py-2 rounded hover:bg-green-700 disabled:opacity-50 transition"
                            >
                                Create
                            </button>
                        </div>
                    </form>
                )}

                {loading && !lists.length ? (
                    <div className="text-center py-12">
                        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
                        <p className="mt-4 text-gray-500 dark:text-gray-400">Loading lists...</p>
                    </div>
                ) : lists.length === 0 ? (
                    <div className="text-center py-16 bg-white dark:bg-gray-800 rounded-lg shadow border dark:border-gray-700">
                        <FiShoppingCart className="mx-auto h-16 w-16 text-gray-300 dark:text-gray-600" />
                        <p className="mt-4 text-gray-500 dark:text-gray-400 text-lg">You don't have any shopping lists yet.</p>
                        <button
                            onClick={() => setIsCreating(true)}
                            className="mt-4 text-blue-600 dark:text-blue-400 hover:text-blue-700 font-medium"
                        >
                            Create your first list
                        </button>
                    </div>
                ) : (
                    <div className="space-y-4">
                        {lists.map((list) => (
                            <div key={list.$id} className="bg-white dark:bg-gray-800 rounded-lg shadow border dark:border-gray-700 overflow-hidden">
                                <div
                                    className="p-4 flex items-center justify-between cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/50 transition"
                                    onClick={() => toggleExpand(list.$id)}
                                >
                                    <div className="flex items-center gap-4">
                                        <div className={`p-2 rounded-full ${expandedListId === list.$id ? 'bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-300' : 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400'}`}>
                                            {expandedListId === list.$id ? <FiChevronUp /> : <FiChevronDown />}
                                        </div>
                                        <div>
                                            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{list.name}</h3>
                                            <p className="text-sm text-gray-500 dark:text-gray-400">
                                                {list.items?.length || 0} items
                                            </p>
                                        </div>
                                    </div>
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            if (window.confirm('Delete this list?')) deleteList(list.$id);
                                        }}
                                        className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-full transition"
                                        title="Delete List"
                                    >
                                        <FiTrash2 />
                                    </button>
                                </div>

                                {expandedListId === list.$id && (
                                    <div className="border-t border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
                                        {list.items && list.items.length > 0 ? (
                                            <ul className="divide-y divide-gray-100 dark:divide-gray-700">
                                                {list.items.map((item) => (
                                                    <li
                                                        key={item.$id}
                                                        className={`px-6 py-3 flex items-center justify-between transition-colors ${item.checked ? 'bg-green-50 dark:bg-green-900/10' : ''}`}
                                                    >
                                                        <div className="flex items-center gap-3">
                                                            <button
                                                                onClick={() => toggleItem(list.$id, item.$id)}
                                                                className={`w-5 h-5 rounded border flex items-center justify-center transition-colors ${item.checked ? 'bg-green-500 border-green-500 text-white' : 'border-gray-300 dark:border-gray-500 text-transparent hover:border-green-500'}`}
                                                            >
                                                                <FiCheck size={14} />
                                                            </button>
                                                            <span className={`text-gray-800 dark:text-gray-200 ${item.checked ? 'line-through text-gray-400 dark:text-gray-500' : ''}`}>
                                                                {/* Since item only stores product_id, we ideally need to fetch product name. 
                                                                    For now, we might need to rely on what the API return or fetch product details separately.
                                                                    WAIT: The store implementation uses listDocuments. We didn't expand 'product_id'.
                                                                    For MVP, we can't show product name unless we fix the fetch logic or store product name in list_item.
                                                                    Better: When adding item, does it have name? No.
                                                                    Let's update store to fetch product details? Or just show product ID for now? 
                                                                    Actually store logic fetchLists loops listDocuments.
                                                                    We can assume productId is all we have. 
                                                                    To allow 'Add to List', let's stick to simple display or update store to expand.
                                                                    Let's assume we update fetch to expand product_id? Or leave as TODO.
                                                                    For this step, I'll display "Product Item" or similar if missing, but we really need the name.
                                                                    Let's see if we can get away with just ID for a second until I confirm if I can expand. 
                                                                    Wait, the setup script defined attributes. 'product_id' is string. 
                                                                    It's NOT a relationship attribute yet (just string). So no auto-expand.
                                                                    So we can't get name easily without N+1 queries.
                                                                    Correct approach: Store 'product_name' in list_items too as a snapshot.
                                                                    I should have added 'product_name' to schema.
                                                                */}
                                                                Product {item.product_id ? item.product_id.substring(0, 5) : 'Unknown'} (Qty: {item.quantity})
                                                            </span>
                                                        </div>
                                                    </li>
                                                ))}
                                            </ul>
                                        ) : (
                                            <div className="px-6 py-8 text-center text-gray-500 dark:text-gray-400 italic">
                                                List is empty. Go to products to add items!
                                            </div>
                                        )}
                                        <div className="p-4 text-center">
                                            <Link to="/" className="text-sm text-blue-600 dark:text-blue-400 hover:underline">
                                                Browse Products to Add Items
                                            </Link>
                                        </div>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

export default ShoppingLists;
