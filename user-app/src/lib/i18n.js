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
      // Add more English translations as needed
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
      // Add more Turkish translations as needed
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
