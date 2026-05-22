import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import useSupermarketsStore from '../stores/supermarketsStore';
import StarRating from './StarRating';
import { FiMapPin } from 'react-icons/fi';

const MarketsSection = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { supermarkets = [], fetchSupermarkets, loading } = useSupermarketsStore();

  useEffect(() => {
    if (!supermarkets || supermarkets.length === 0) fetchSupermarkets();
  }, [fetchSupermarkets, supermarkets]);

  const mainBranches = (supermarkets || []).filter(s => s.isParent === true);

  return (
    <section className="space-y-4 animate-in slide-in-from-bottom-12 duration-700">
      <div className="flex items-center justify-between px-2">
        <div>
          <h2 className="text-xl sm:text-2xl font-black tracking-tight">{t('markets', 'Markets')}</h2>
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-0.5">{t('featured_markets', 'FEATURED STORES')}</p>
        </div>
      </div>

      <div className="-mx-4 px-4 overflow-x-auto no-scrollbar flex items-stretch gap-3 sm:gap-4 pb-2">
        {loading && [...Array(4)].map((_, i) => (
          <div key={i} className="flex-shrink-0 w-56 sm:w-64 bg-gray-100 dark:bg-gray-800 rounded-2xl p-4 animate-pulse" />
        ))}

        {!loading && mainBranches.length === 0 && (
          <div className="flex-shrink-0 bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-xl px-4 py-4 shadow-soft">
            <p className="text-sm text-gray-500">{t('no_markets', 'No markets available')}</p>
          </div>
        )}

        {!loading && mainBranches.map((m) => (
          <button
            key={m.$id}
            onClick={() => navigate(`/supermarket/${m.$id}`)}
            className="flex-shrink-0 w-52 sm:w-64 bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl p-3 sm:p-4 shadow-soft hover:shadow-md transition-transform hover:-translate-y-1 cursor-pointer text-left"
          >
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
              <div className="h-10 w-10 sm:h-12 sm:w-12 rounded-xl overflow-hidden bg-gray-50 dark:bg-gray-800 flex items-center justify-center text-lg font-black text-brand-600">
                {m.icon ? <img src={m.icon} alt="" className="h-full w-full object-cover" /> : (m.name ? m.name.charAt(0) : '?')}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-black text-gray-900 dark:text-white tracking-tight truncate">{m.brand || m.name}</div>
                <div className="text-xs text-gray-500 dark:text-gray-400 mt-1 truncate">{m.branchName || t('primary_store', 'Main Branch')}</div>
              </div>
            </div>
            <div className="mt-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <StarRating value={m.rating ?? null} size={12} />
              </div>
              <div className={`text-xs font-bold px-2 py-1 rounded-xl ${m.status === 'open' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'}`}>
                {m.status === 'open' ? t('open', 'Open') : t('closed', 'Closed')}
              </div>
            </div>
          </button>
        ))}
      </div>
    </section>
  );
};

export default MarketsSection;
