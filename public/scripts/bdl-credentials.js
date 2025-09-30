(function () {
  function normalizeKey(raw) {
    if (raw === null || raw === undefined) {
      return null;
    }
    const value = String(raw).trim();
    if (!value) {
      return null;
    }
    const bearerMatch = value.match(/^Bearer\s+(.+)$/i);
    if (bearerMatch) {
      return `Bearer ${bearerMatch[1].trim()}`;
    }
    return `Bearer ${value}`;
  }

  function applyKey(candidate) {
    const normalized = normalizeKey(candidate);
    if (!normalized) {
      return false;
    }

    let meta = document.querySelector('meta[name="bdl-api-key"]');
    if (!meta) {
      meta = document.createElement('meta');
      meta.setAttribute('name', 'bdl-api-key');
      document.head.appendChild(meta);
    }
    meta.setAttribute('content', normalized);

    if (typeof window !== 'undefined') {
      window.BDL_API_KEY = normalized;
      window.BALLDONTLIE_API_KEY = normalized;
      window.BALL_DONT_LIE_API_KEY = normalized;
    }
    return true;
  }

  const existingMeta = document.querySelector('meta[name="bdl-api-key"]');
  if (existingMeta) {
    const preset = existingMeta.getAttribute('content');
    if (applyKey(preset)) {
      return;
    }
  }

  const KEY_LOCATIONS = ['/bdl-key.json', '/data/bdl-key.json'];

  (async () => {
    for (const path of KEY_LOCATIONS) {
      try {
        const response = await fetch(path, { cache: 'no-store' });
        if (!response.ok) {
          continue;
        }
        const payload = await response.json().catch(() => null);
        const key = typeof payload === 'string' ? payload : payload?.key;
        if (applyKey(key)) {
          return;
        }
      } catch (error) {
        console.warn('Unable to load Ball Don\'t Lie credential stub from', path, error);
      }
    }
  })().catch((error) => {
    console.warn('Ball Don\'t Lie credential bootstrap failed', error);
  });
})();
