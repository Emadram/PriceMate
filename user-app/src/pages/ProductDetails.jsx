import { useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import useProductStore from '../stores/productStore';
import useAuthStore from '../stores/authStore';
import useShoppingListStore from '../stores/shoppingListStore';
import { useState } from 'react';
import { FiShoppingCart } from 'react-icons/fi';

const ProductDetails = () => {
    const { barcode } = useParams();
    const navigate = useNavigate();
    const { product, prices, loading, error, fetchProductByBarcode } = useProductStore();
    const { lists, fetchLists, addItem } = useShoppingListStore();
    const user = useAuthStore((state) => state.user);
    const [selectedListId, setSelectedListId] = useState('');
    const [showListModal, setShowListModal] = useState(false);

    useEffect(() => {
        // Redirect to the new price comparison page
        navigate(`/price-comparison/${barcode}`);
    }, [barcode, navigate]);

    useEffect(() => {
        if (user && showListModal) {
            fetchLists();
        }
    }, [user, showListModal, fetchLists]);

    // ... (keep existing loading/error/null checks)

    const handleAddToList = async () => {
        if (!selectedListId) return;

        const success = await addItem(selectedListId, product.$id);
        if (success) {
            alert('Product added to list!');
            setShowListModal(false);
        } else {
            alert('Failed to add to list');
        }
    };

    // ... (render existing components)

    // Add this updated bottom bar and modal
    return (
        <div className="min-h-screen bg-gray-50 pb-20">
            {/* ... (keep existing product details structure) ... */}

            {/* Modal for adding to list */}
            {showListModal && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-lg p-6 w-full max-w-sm">
                        <h3 className="text-lg font-bold mb-4">Add to Shopping List</h3>
                        {lists.length > 0 ? (
                            <div className="space-y-4">
                                <select
                                    value={selectedListId}
                                    onChange={(e) => setSelectedListId(e.target.value)}
                                    className="w-full border rounded p-2"
                                >
                                    <option value="">Select a list...</option>
                                    {lists.map(list => (
                                        <option key={list.$id} value={list.$id}>{list.name}</option>
                                    ))}
                                </select>
                                <div className="flex gap-2">
                                    <button
                                        onClick={() => setShowListModal(false)}
                                        className="flex-1 py-2 border rounded hover:bg-gray-50"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        onClick={handleAddToList}
                                        disabled={!selectedListId}
                                        className="flex-1 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
                                    >
                                        Add
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <div className="text-center">
                                <p className="text-gray-600 mb-4">You don't have any lists yet.</p>
                                <div className="flex gap-2">
                                    <button
                                        onClick={() => setShowListModal(false)}
                                        className="flex-1 py-2 border rounded"
                                    >
                                        Close
                                    </button>
                                    <button
                                        onClick={() => navigate('/lists')}
                                        className="flex-1 py-2 bg-green-600 text-white rounded"
                                    >
                                        Create List
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}

            <div className="fixed bottom-0 left-0 right-0 p-4 bg-white border-t flex gap-2">
                <button
                    onClick={() => navigate('/')}
                    className="flex-1 py-3 border border-gray-300 rounded-lg text-gray-700 font-medium"
                >
                    Back
                </button>
                {/* Replaced Add Price with Add to List for User Flow */}
                <button
                    onClick={() => {
                        if (!user) {
                            navigate('/login');
                        } else {
                            setShowListModal(true);
                        }
                    }}
                    className="flex-1 py-3 bg-blue-600 text-white rounded-lg font-medium shadow-lg flex items-center justify-center gap-2"
                >
                    <FiShoppingCart /> Add to List
                </button>
            </div>
        </div>
    );
};

export default ProductDetails;
