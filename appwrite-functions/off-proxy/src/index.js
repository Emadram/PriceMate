const OFF_API_BASE = 'https://world.openfoodfacts.org';

const parsePayload = (req) => {
    if (req?.body) {
        try {
            return JSON.parse(req.body);
        } catch {
            return {};
        }
    }
    return req?.query || {};
};

module.exports = async ({ req, res, log, error }) => {
    try {
        const payload = parsePayload(req);
        const kind = String(payload.kind || payload.type || '').toLowerCase();

        if (!kind) {
            return res.json({ ok: false, status: 400, error: 'Missing kind.' }, 400);
        }

        let url = '';
        if (kind === 'barcode') {
            const barcode = String(payload.barcode || '').trim();
            if (!barcode) {
                return res.json({ ok: false, status: 400, error: 'Missing barcode.' }, 400);
            }
            url = `${OFF_API_BASE}/api/v0/product/${encodeURIComponent(barcode)}.json`;
        } else if (kind === 'search') {
            const query = String(payload.query || payload.q || '').trim();
            if (!query) {
                return res.json({ ok: false, status: 400, error: 'Missing search query.' }, 400);
            }
            const pageSize = Math.min(Math.max(Number(payload.pageSize || 5), 1), 10);
            url = `${OFF_API_BASE}/cgi/search.pl?search_terms=${encodeURIComponent(query)}&search_simple=1&action=process&json=1&page_size=${pageSize}`;
        } else {
            return res.json({ ok: false, status: 400, error: 'Unsupported kind.' }, 400);
        }

        const response = await fetch(url);
        const contentType = response.headers.get('content-type') || '';
        const data = contentType.includes('application/json')
            ? await response.json()
            : await response.text();

        if (!response.ok) {
            log(`OFF proxy error: ${response.status}`);
            return res.json({ ok: false, status: response.status, error: 'OFF request failed.', data }, response.status);
        }

        return res.json({ ok: true, status: response.status, data }, 200);
    } catch (err) {
        error(err);
        return res.json({ ok: false, status: 500, error: 'Proxy error.' }, 500);
    }
};
