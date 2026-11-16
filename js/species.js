(function (root, factory) {
  const api = factory(); if (typeof module === 'object' && module.exports) module.exports = api; else root.PondSpecies = api;
})(globalThis, function () {
  function createSearch(local, fetcher, timeout = 6000) {
    let generation = 0, controller;
    const cache = new Map();
    return async function search(query, report) {
      const token = ++generation; controller?.abort();
      const q = query.trim().slice(0, 200).toLowerCase();
      const matches = local.filter(s => !q || (s.common + ' ' + s.scientific).toLowerCase().includes(q));
      report(matches, q ? 'Local matches. Looking up scientific names…' : 'Local species library.');
      if (!q || !/^[a-z]+(?: [a-z]+)?$/.test(q)) { if (q) report(matches, 'Local results. Enter a genus or scientific name for remote lookup.'); return; }
      if (cache.has(q)) { report([...matches, ...cache.get(q)], 'Local and cached FishBase results.'); return; }
      const own = new AbortController(); controller = own;
      const timer = setTimeout(() => own.abort(), timeout);
      try {
        const res = await fetcher('https://fishbase.ropensci.org/species?Genus=' + encodeURIComponent(q.split(' ')[0]) + '&limit=10', { signal: own.signal });
        if (!res.ok) throw new Error('HTTP ' + res.status);
        const json = await res.json();
        if (!Array.isArray(json.data)) throw new Error('Unexpected response');
        const rows = json.data.slice(0, 10).map(r => {
          if (!r || typeof r.Genus !== 'string' || typeof r.Species !== 'string' || (r.Genus + ' ' + r.Species).length > 200) throw new Error('Invalid species row');
          return { common: '', scientific: r.Genus + ' ' + r.Species };
        });
        cache.set(q, rows); if (token === generation) report([...matches, ...rows], 'Local and FishBase results.');
      } catch (_) { if (token === generation) report(matches, 'Remote lookup unavailable or timed out. Local results remain available; search again to retry.'); }
      finally { clearTimeout(timer); }
    };
  }
  return { createSearch };
});
