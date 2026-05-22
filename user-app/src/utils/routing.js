const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export const fetchRoute = async (fromLon, fromLat, toLon, toLat, retries = 2) => {
  // Always fetch fresh route; no client-side caching to prefer external map providers.

  // Use OSRM public server (best-effort). Include steps=true for turn-by-turn.
  const url = `https://router.project-osrm.org/route/v1/driving/${fromLon},${fromLat};${toLon},${toLat}?overview=full&geometries=geojson&steps=true`;

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      const resp = await fetch(url, { cache: 'no-cache' });
      if (!resp.ok) {
        if (attempt === retries) throw new Error(`OSRM ${resp.status}`);
        await sleep(200 * Math.pow(2, attempt) + Math.random() * 100);
        continue;
      }
      const json = await resp.json();
      if (json && json.routes && json.routes[0] && json.routes[0].geometry) {
        const route = json.routes[0];
        const steps = [];
        try {
          // Aggregate steps from legs
          (route.legs || []).forEach((leg) => {
            (leg.steps || []).forEach((step) => {
              steps.push({
                maneuver: step.maneuver || {},
                geometry: step.geometry || null,
                distance: step.distance,
                duration: step.duration,
                name: step.name || '',
                ref: step.ref || ''
              });
            });
          });
        } catch (e) {
          // ignore
        }

        return {
          geojson: route.geometry,
          distance: route.distance,
          duration: route.duration,
          steps,
        };
      }
      throw new Error('No route');
    } catch (err) {
      if (attempt === retries) throw err;
      await sleep(200 * Math.pow(2, attempt) + Math.random() * 100);
    }
  }
  throw new Error('Route fetch failed');
};

export default fetchRoute;
