import { useState, useEffect, useRef } from 'react';
import { FiX, FiSend, FiMessageSquare, FiLoader, FiExternalLink, FiPackage, FiShoppingBag } from 'react-icons/fi';
import OpenAI from "openai";
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { fetchProducts, fetchAllPrices } from '../utils/productUtils';
import useCurrencyStore from '../stores/currencyStore';

const ChatMessage = ({ msg, convert, getCurrencySymbol, allProducts = [] }) => {
    const renderContent = (content) => {
        // First step: CLEANING
        // 1. Remove redundancy: remove lines that the cards will handle
        let text = content;
        
        // Remove individual price points followed by TL/₺
        text = text.replace(/^(?:\s*)(?:[-•*]\s?.*:\s*\d+(?:\.\d+)?\s*(?:TL|₺)\s*\n?)+/gm, '');
        
        // Remove lead-in sentences for removed lists
        text = text.replace(/(?:The prices are:|Prices are:|Available at:)\s*\n?/gi, '');
        
        // Remove empty lines created by removals
        text = text.replace(/\n\s*\n/g, '\n').trim();

        // 2. PARSING TAGS
        const barcodeRegex = /\[(?:BARCODE|ID):([\w\d-]+)\]/g;
        const parts = text.split(barcodeRegex);
        
        const isMostExpensiveRequest = text.toLowerCase().includes('most expensive') || text.toLowerCase().includes('pahalı');
        const isCheapestRequest = text.toLowerCase().includes('cheapest') || text.toLowerCase().includes('en ucuz');

        return parts.map((part, i) => {
            if (i % 2 === 0) {
                return part;
            } else {
                const barcode = part;
                const product = allProducts.find(p => p.barcode === barcode);

                if (product) {
                    const sortedPrices = [...(product.prices || [])].sort((a, b) => a.price - b.price);
                    const lowestPrice = sortedPrices.length > 0 ? sortedPrices[0] : null;
                    const highestPrice = sortedPrices.length > 0 ? sortedPrices[sortedPrices.length - 1] : null;
                    
                    const priceToShow = isMostExpensiveRequest ? highestPrice : lowestPrice;
                    const badgeText = isMostExpensiveRequest ? "Most Expensive" : (isCheapestRequest ? "Cheapest" : null);
                    const badgeColor = isMostExpensiveRequest ? "bg-red-600" : "bg-green-600";

                    return (
                        <Link 
                            key={i}
                            to={`/price-comparison/${barcode}`}
                            className={`block my-2 ${isMostExpensiveRequest ? 'bg-red-50 dark:bg-red-900/10 border-red-200 dark:border-red-800' : 'bg-green-50 dark:bg-green-900/10 border-green-200 dark:border-green-800'} border rounded-xl overflow-hidden hover:shadow-md transition-all group`}
                        >
                            <div className="flex items-center gap-3 p-2.5">
                                <div className="w-14 h-14 bg-white dark:bg-gray-800 rounded-lg flex items-center justify-center flex-shrink-0 overflow-hidden border border-gray-100 dark:border-gray-900/50">
                                    {product.imageUrl ? (
                                        <img src={product.imageUrl} alt={product.name} className="w-full h-full object-contain" />
                                    ) : (
                                        <FiPackage className="text-gray-400 text-xl" />
                                    )}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-1.5 mb-0.5">
                                        <h4 className="text-sm font-bold text-gray-800 dark:text-white truncate group-hover:text-blue-600 dark:group-hover:text-blue-400">
                                            {product.name || product.productName}
                                        </h4>
                                        {badgeText && (
                                            <span className={`${badgeColor} text-[9px] uppercase tracking-wider text-white px-1.5 py-0.5 rounded-full font-black shadow-sm`}>{badgeText}</span>
                                        )}
                                    </div>
                                    {priceToShow ? (
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-baseline gap-1">
                                                <span className="text-xs text-gray-500 dark:text-gray-400">{isMostExpensiveRequest ? 'High:' : 'Best:'}</span>
                                                <span className={`text-base font-black ${isMostExpensiveRequest ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'}`}>
                                                    {convert(priceToShow.price, 'TRY')} {getCurrencySymbol()}
                                                </span>
                                            </div>
                                            <div className="flex items-center gap-1 text-[10px] font-bold text-gray-500 bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 rounded border border-gray-200 dark:border-gray-700">
                                                <FiShoppingBag className="shrink-0" size={10} />
                                                <span className="truncate max-w-[70px]">
                                                    {Array.isArray(priceToShow.supermarkets) ? priceToShow.supermarkets[0]?.name : (priceToShow.supermarketName || "Store")}
                                                </span>
                                            </div>
                                        </div>
                                    ) : (
                                        <span className="text-[10px] text-gray-500 italic">No price info</span>
                                    )}
                                </div>
                            </div>
                        </Link>
                    );
                }

                // Fallback to simpler link if product data isn't found
                return (
                    <Link 
                        key={i}
                        to={`/price-comparison/${barcode}`}
                        className="inline-flex items-center gap-0.5 bg-white/20 hover:bg-white/30 px-1.5 py-0.5 rounded text-xs font-bold underline transition-colors"
                    >
                        View Product <FiExternalLink size={10} />
                    </Link>
                );
            }
        });
    };

    return (
        <div className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[85%] p-3 rounded-2xl ${
                msg.role === 'user' 
                    ? 'bg-blue-600 text-white rounded-tr-none shadow-md' 
                    : 'bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-100 shadow-sm border border-gray-100 dark:border-gray-700 rounded-tl-none'
            }`}>
                <div className="text-sm leading-relaxed whitespace-pre-wrap">
                    {renderContent(msg.content)}
                </div>
            </div>
        </div>
    );
};

const AIChatBox = ({ isOpen, onClose }) => {
    const { t } = useTranslation();
    const { convert, getCurrencySymbol } = useCurrencyStore();
    const [messages, setMessages] = useState([
        { role: 'assistant', content: 'Hello! I am your PriceMate AI assistant. How can I help you find the best deals today?' }
    ]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [context, setContext] = useState('');
    const [fullProductList, setFullProductList] = useState([]);
    const messagesEndRef = useRef(null);

    // Auto-scroll to bottom
    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    // Fetch context data (products and prices) to inform the AI
    useEffect(() => {
        const loadContext = async () => {
            try {
                const [products, prices] = await Promise.all([
                    fetchProducts(50), 
                    fetchAllPrices()
                ]);
                
                // Keep the structural product list for the component to use
                const productsWithData = products.map(p => {
                    const productPrices = prices.filter(pr => {
                        const pid = Array.isArray(pr.products) ? pr.products[0]?.$id : (pr.productID || pr.products?.$id);
                        return pid === p.$id;
                    });
                    return { ...p, prices: productPrices };
                });

                setFullProductList(productsWithData);

                // Simplified context for the AI prompt
                const contextStr = productsWithData.map(p => {
                    const category = Array.isArray(p.categoryId) ? p.categoryId[0]?.categoryName : (p.categoryId?.categoryName || "General");
                    const priceDetails = p.prices.map(pr => {
                        const smName = Array.isArray(pr.supermarkets) ? pr.supermarkets[0]?.name : (pr.supermarketName || pr.supermarkets?.name || "Store");
                        return `${smName}: ${pr.price} TL`;
                    }).join(', ');
                    
                    return `- [ID:${p.barcode}] ${p.name || p.productName}: [${category}] ${priceDetails || "No current price"}`;
                }).join('\n');
                
                setContext(contextStr);
            } catch (error) {
                console.error("Error loading chat context:", error);
            }
        };
        loadContext();
    }, []);

    const handleSend = async (e) => {
        e.preventDefault();
        if (!input.trim() || isLoading) return;

        const userMessage = input.trim();
        setInput('');
        setMessages(prev => [...prev, { role: 'user', content: userMessage }]);
        setIsLoading(true);

        try {
            const apiKey = import.meta.env.VITE_OPENROUTER_API_KEY;

            if (!apiKey) {
                throw new Error("OpenRouter API Key is missing in .env");
            }

            const openai = new OpenAI({
                baseURL: "https://openrouter.ai/api/v1",
                apiKey: apiKey,
                dangerouslyAllowBrowser: true,
                defaultHeaders: {
                    "HTTP-Referer": window.location.origin,
                    "X-Title": "PriceMate",
                }
            });

            const prompt = `
                You are the official PriceMate assistant. Your primary goal is to help users find products and compare prices.
                
                WEBSITE PRODUCT DATA:
                ${context}

                INSTRUCTIONS:
                1. STRICTLY answer only questions about products, prices, and shopping within the PriceMate app. 
                2. If the user asks about something unrelated, politely say you only assist with product-related queries.
                3. RECOMMEND specific products using the data provided.
                   - If the user asks for "cheapest" or "best deal", highlight those.
                   - If the user asks for "most expensive" or "premium", highlight those.
                   - If they just ask for a category (e.g., "chocolate"), list relevant products.
                4. FOR EVERY PRODUCT you mention, you MUST include its barcode ID in square brackets like this: [BARCODE:123456]. 
                   DO NOT use [ID:123456], ONLY use the word BARCODE in the brackets.
                5. MINIMIZE TEXT. Do not describe features or give long intros. Just a short sentence and the barcode.
                6. DO NOT repeat price lists (e.g., "- Store: X TL"). The UI will show the card automatically.
                7. Use the exact product names from the context.
            `;

            const completion = await openai.chat.completions.create({
                model: "google/gemini-2.0-flash-001",
                messages: [
                    { role: "system", content: prompt },
                    ...messages.map(m => ({ role: m.role, content: m.content })),
                    { role: "user", content: userMessage }
                ],
            });

            const text = completion.choices[0]?.message?.content || "No response received.";

            setMessages(prev => [...prev, { role: 'assistant', content: text }]);
        } catch (error) {
            console.error("AI Error details:", error);
            // Provide more specific error message based on common failure reasons
            let errorMessage = "Sorry, I can't connect to the AI right now. ";
            if (error.message?.includes("API Key")) {
                errorMessage += "There's an issue with the API Key configuration.";
            } else if (error.status === 429) {
                errorMessage += "Rate limit exceeded. Please wait a moment.";
            } else {
                errorMessage += "Please try again in a few moments.";
            }
            
            setMessages(prev => [...prev, { role: 'assistant', content: errorMessage }]);
        } finally {
            setIsLoading(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed bottom-4 right-4 w-80 sm:w-96 h-[500px] bg-white dark:bg-gray-800 rounded-2xl shadow-2xl flex flex-col z-[60] border border-gray-200 dark:border-gray-700 overflow-hidden animate-in slide-in-from-bottom-5 duration-300">
            {/* Header */}
            <div className="p-4 bg-blue-600 text-white flex justify-between items-center shrink-0">
                <div className="flex items-center gap-2">
                    <FiMessageSquare className="text-xl" />
                    <span className="font-bold">PriceMate AI</span>
                </div>
                <button 
                    onClick={onClose}
                    className="p-1 hover:bg-white/20 rounded-lg transition-colors"
                >
                    <FiX size={20} />
                </button>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50 dark:bg-gray-900">
                {messages.map((msg, idx) => (
                    <ChatMessage 
                        key={idx} 
                        msg={msg} 
                        convert={convert} 
                        getCurrencySymbol={getCurrencySymbol} 
                        allProducts={fullProductList}
                    />
                ))}
                {isLoading && (
                    <div className="flex justify-start">
                        <div className="bg-white dark:bg-gray-800 p-3 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 rounded-tl-none">
                            <FiLoader className="animate-spin text-blue-600" />
                        </div>
                    </div>
                )}
                <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <form onSubmit={handleSend} className="p-4 bg-white dark:bg-gray-800 border-t border-gray-100 dark:border-gray-700 flex gap-2">
                <input
                    type="text"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder="Ask me anything..."
                    className="flex-1 px-4 py-2 bg-gray-50 dark:bg-gray-700 border-0 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-white"
                />
                <button
                    type="submit"
                    disabled={isLoading}
                    className="p-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 disabled:opacity-50 transition-colors"
                >
                    <FiSend size={18} />
                </button>
            </form>
        </div>
    );
};

export default AIChatBox;
