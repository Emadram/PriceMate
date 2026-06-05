import {
    invalidateGlobalPriceCaches,
    invalidateProductUtilsByPrefix,
} from './productUtils';
import { invalidateCacheByPrefix, invalidateCacheKey } from './swrCache';
import useProductStore from '../stores/productStore';

const CHART_PREFIX = 'price-history-chart:';

/**
 * Invalidate cached user-app data before a forced refresh.
 * @param {object} options
 * @param {string} [options.swrKey] - Single SWR page cache key
 * @param {'global'|'product'|'supermarket'|'catalog'} [options.priceScope]
 * @param {string} [options.productId]
 * @param {string} [options.supermarketId]
 * @param {string} [options.barcode]
 */
export function refreshPageCache({
    swrKey,
    priceScope = 'global',
    productId,
    supermarketId,
    barcode,
} = {}) {
    if (swrKey) {
        invalidateCacheKey(swrKey);
    }

    if (priceScope === 'global') {
        invalidateGlobalPriceCaches();
    } else if (priceScope === 'supermarket' && supermarketId) {
        invalidateProductUtilsByPrefix(`supermarket:prices:${supermarketId}`);
        invalidateCacheKey(`supermarket-profile:${supermarketId}`);
    } else if (priceScope === 'product') {
        if (productId) {
            invalidateProductUtilsByPrefix(`price-history:${productId}:`);
            invalidateCacheByPrefix(`${CHART_PREFIX}${productId}:`);
        }
        invalidateProductUtilsByPrefix('similar:');
        if (barcode) {
            useProductStore.getState().invalidateBarcodeCache(barcode);
        }
    } else if (priceScope === 'catalog') {
        invalidateGlobalPriceCaches();
        invalidateCacheByPrefix(CHART_PREFIX);
    }

    return { swrKey, priceScope };
}
