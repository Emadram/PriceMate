import React, { useState, useEffect } from 'react';
import { FiX, FiCheck, FiChevronRight, FiAlertCircle, FiPlus } from 'react-icons/fi';
import { useTranslation } from 'react-i18next';
import useSupermarketsStore from '../stores/supermarketsStore';
import useProductStore from '../stores/productStore';

const AddPriceModal = ({ isOpen, onClose, product }) => {
    const { t } = useTranslation();
    const { supermarkets, fetchSupermarkets } = useSupermarketsStore();
    const { addPrice } = useProductStore();
    
    const [selectedSupermarket, setSelectedSupermarket] = useState('');
    const [price, setPrice] = useState('');
    const [stockStatus, setStockStatus] = useState('high'); // high (In Stock), low (Low Stock), none (Out of Stock)
    const [status, setStatus] = useState('idle'); // idle, loading, success, error
    const [errorMessage, setErrorMessage] = useState('');

    useEffect(() => {
        if (isOpen) {
            fetchSupermarkets();
        }
    }, [isOpen, fetchSupermarkets]);

    const resetForm = () => {
        setSelectedSupermarket('');
        setPrice('');
        setStockStatus('high');
        setStatus('idle');
        setErrorMessage('');
    };

    const handleClose = (wasSuccessful = false) => {
        resetForm();
        onClose(wasSuccessful);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        
        if (!selectedSupermarket || !price) {
            setErrorMessage(t('required_fields_error', 'Please fill in all required fields'));
            return;
        }

        setStatus('loading');
        
        const result = await addPrice({
            productId: product.$id,
            supermarketId: selectedSupermarket,
            price: price,
            stockStatus: stockStatus
        });

        if (result) {
            setStatus('success');
            setTimeout(() => {
                handleClose(true);
            }, 1500);
        } else {
            setStatus('error');
            setErrorMessage(t('add_price_failed', 'Failed to add price. Please try again.'));
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[1001] flex items-center justify-center p-4">
            {/* Backdrop */}
            <div 
                className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity duration-300"
                onClick={() => handleClose(false)}
            />
            
            {/* Modal */}
            <div className="relative bg-white dark:bg-gray-900 w-full max-w-lg rounded-[2.5rem] shadow-2xl overflow-hidden animate-in fade-in zoom-in slide-in-from-bottom-5 duration-300">
                <div className="p-8 pb-safe-nav">
                    {/* Header */}
                    <div className="flex items-center justify-between mb-8">
                        <div>
                            <h3 className="text-2xl font-black text-gray-900 dark:text-white tracking-tight">{t('add_price', 'Add Price')}</h3>
                            <p className="text-sm text-gray-500 font-medium">{product?.name}</p>
                        </div>
                        <button 
                            onClick={() => handleClose(false)}
                            aria-label={t('close_modal', 'Close modal')}
                            className="p-3 bg-gray-100 dark:bg-gray-800 rounded-2xl text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"
                        >
                            <FiX size={20} />
                        </button>
                    </div>

                    {status === 'success' ? (
                        <div className="py-12 flex flex-col items-center justify-center text-center space-y-4">
                            <div className="w-20 h-20 bg-green-500 rounded-full flex items-center justify-center text-white shadow-lg shadow-green-500/30 animate-bounce">
                                <FiCheck size={40} />
                            </div>
                            <h4 className="text-xl font-bold text-gray-900 dark:text-white">{t('price_added_success', 'Price Added Successfully!')}</h4>
                            <p className="text-gray-500 font-medium">{t('contribution_thanks', 'Thank you for your contribution.')}</p>
                        </div>
                    ) : (
                        <form onSubmit={handleSubmit} className="space-y-6">
                            {/* Supermarket Selection */}
                            <div className="space-y-2">
                                <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 ml-2">{t('supermarket')}</label>
                                <select 
                                    value={selectedSupermarket}
                                    onChange={(e) => setSelectedSupermarket(e.target.value)}
                                    className="w-full bg-gray-50 dark:bg-gray-800/50 border-none rounded-2xl px-5 py-4 font-bold text-gray-900 dark:text-white appearance-none focus:ring-2 focus:ring-brand-500 transition-all outline-none"
                                    required
                                >
                                    <option value="" disabled>{t('select_supermarket', 'Select a supermarket')}</option>
                                    {supermarkets.map((sm) => (
                                        <option key={sm.$id} value={sm.$id}>
                                            {sm.name} {sm.branchName ? `(${sm.branchName})` : ''}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            {/* Price Input */}
                            <div className="space-y-2">
                                <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 ml-2">{t('price_try', 'Price (TRY)')}</label>
                                <div className="relative">
                                    <input 
                                        type="number"
                                        step="0.01"
                                        placeholder="0.00"
                                        value={price}
                                        onChange={(e) => setPrice(e.target.value)}
                                        className="w-full bg-gray-50 dark:bg-gray-800/50 border-none rounded-2xl px-5 py-4 font-black text-2xl text-gray-900 dark:text-white focus:ring-2 focus:ring-brand-500 transition-all outline-none"
                                        required
                                    />
                                    <span className="absolute right-5 top-1/2 -translate-y-1/2 font-black text-gray-300 pointer-events-none">₺</span>
                                </div>
                            </div>

                            {/* Stock Status Selection */}
                            <div className="space-y-2">
                                <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 ml-2">{t('stock_availability', 'Stock Availability')}</label>
                                <div className="grid grid-cols-3 gap-3">
                                    {[
                                        { id: 'high', label: t('in_stock'), color: 'bg-green-500' },
                                        { id: 'low', label: t('low_stock'), color: 'bg-amber-500' },
                                        { id: 'none', label: t('out_of_stock'), color: 'bg-red-500' }
                                    ].map((option) => (
                                        <button
                                            key={option.id}
                                            type="button"
                                            onClick={() => setStockStatus(option.id)}
                                            className={`p-3 rounded-2xl border-2 transition-all flex flex-col items-center gap-2 ${
                                                stockStatus === option.id 
                                                    ? 'border-brand-500 bg-brand-50/50 dark:bg-brand-500/10' 
                                                    : 'border-transparent bg-gray-50 dark:bg-gray-800/50 grayscale opacity-60'
                                            }`}
                                        >
                                            <div className={`w-3 h-3 rounded-full ${option.color}`} />
                                            <span className="text-[10px] font-black uppercase tracking-tighter whitespace-nowrap">{option.label}</span>
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {errorMessage && (
                                <div className="flex items-center gap-2 text-red-500 bg-red-50 dark:bg-red-900/10 p-4 rounded-2xl text-xs font-bold animate-pulse">
                                    <FiAlertCircle />
                                    {errorMessage}
                                </div>
                            )}

                            {/* Submit Button */}
                            <button
                                type="submit"
                                disabled={status === 'loading'}
                                aria-label={t('submit_price_contribution', 'Submit new price contribution')}
                                className="w-full bg-brand-600 hover:bg-black text-white font-black py-5 rounded-[1.5rem] uppercase tracking-widest text-[11px] shadow-lg shadow-brand-500/30 hover:shadow-none transition-all duration-300 transform hover:scale-[0.98] active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed group"
                            >
                                {status === 'loading' ? (
                                    <div className="flex items-center justify-center gap-2">
                                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                        {t('processing', 'Processing...')}
                                    </div>
                                ) : (
                                    <div className="flex items-center justify-center gap-2">
                                        <FiPlus size={18} className="group-hover:rotate-90 transition-transform duration-300" />
                                        {t('submit_price', 'Submit Price')}
                                    </div>
                                )}
                            </button>
                        </form>
                    )}
                </div>
            </div>
        </div>
    );
};

export default AddPriceModal;
