import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

const resources = {
  en: {
    translation: {
      "home": "Home",
      "search": "Search",
      "scan": "Scan",
      "favorites": "Favorites",
      "profile": "Profile",
      "feedback": "Feedback",
      "login": "Login",
      "register": "Register",
      "logout": "Logout",
      "search_placeholder": "Search products...",
      "welcome": "Welcome to PriceMate",
      "compare_prices": "Compare prices across supermarkets",
      "featured_products": "Featured Products",
      "barcode": "Barcode",
      "price": "Price",
      "supermarket": "Supermarket",
      "details": "Details",
      "best_price": "Best Price Today",
      "starting_from": "Starting From",
      "in_stock": "In Stock",
      "low_stock": "Low Stock",
      "out_of_stock": "Out of Stock",
      "price_history": "Price History",
      "available_stores": "Available Stores",
      "get_directions": "Get Directions",
      "trends": "Trends",
      "personalized_deals": "Personalized deals for you",
      "view_all": "View All",
      "scan_barcode": "Scan Barcode",
      "compare_live": "Compare live market prices",
      "instant": "Instant",
      "market_avg": "Market Avg",
      "stock": "Stock",
      "last_updated": "Last Updated",
      "calculating": "Calculating..."
    }
  },
  tr: {
    translation: {
      "home": "Ana Sayfa",
      "search": "Ara",
      "scan": "Tara",
      "favorites": "Favoriler",
      "profile": "Profil",
      "feedback": "Geri Bildirim",
      "login": "Giriş Yap",
      "register": "Kayıt Ol",
      "logout": "Çıkış Yap",
      "search_placeholder": "Ürün ara...",
      "welcome": "PriceMate'e Hoş Geldiniz",
      "compare_prices": "Süpermarketler arası fiyat karşılaştırın",
      "featured_products": "Öne Çıkan Ürünler",
      "barcode": "Barkod",
      "price": "Fiyat",
      "supermarket": "Süpermarket",
      "details": "Detaylar",
      "best_price": "Günün En İyi Fiyatı",
      "starting_from": "Başlangıç Fiyatı",
      "in_stock": "Stokta Var",
      "low_stock": "Azalıyor",
      "out_of_stock": "Stokta Yok",
      "price_history": "Fiyat Geçmişi",
      "available_stores": "Mevcut Mağazalar",
      "get_directions": "Yol Tarifi Al",
      "trends": "Trendler",
      "personalized_deals": "Sizin için seçilen fırsatlar",
      "view_all": "Tümünü Gör",
      "scan_barcode": "Barkod Tara",
      "compare_live": "Canlı piyasa fiyatlarını karşılaştır",
      "instant": "Anında",
      "market_avg": "Piyasa Ortalaması",
      "stock": "Stok",
      "last_updated": "Son Güncelleme",
      "calculating": "Hesaplanıyor..."
    }
  }
};

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    fallbackLng: "en",
    interpolation: {
      escapeValue: false
    }
  });

export default i18n;
