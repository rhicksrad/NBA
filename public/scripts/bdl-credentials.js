(function () {
  const DEFAULT_KEY_LOCATIONS = ['/bdl-key.json', '/data/bdl-key.json'];

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

  function notifyApplied(source) {
    if (typeof document === 'undefined') {
      return;
    }
    try {
      document.dispatchEvent(
        new CustomEvent('bdl:credentials-applied', {
          detail: {
            source: source ?? null,
          },
        }),
      );
    } catch (error) {
      console.warn("Unable to dispatch 'bdl:credentials-applied' event", error);
    }
  }

  function applyKey(candidate, options = {}) {
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
    notifyApplied(options?.source ?? 'inline');
    return true;
  }

  function parseKeyPaths(value) {
    if (!value && value !== 0) {
      return undefined;
    }
    const toArray = (input) => {
      if (!input && input !== 0) {
        return undefined;
      }
      if (Array.isArray(input)) {
        return input
          .map((entry) => (typeof entry === 'string' ? entry.trim() : ''))
          .filter(Boolean);
      }
      if (typeof input === 'string') {
        if (!input.trim()) {
          return [];
        }
        try {
          const parsed = JSON.parse(input);
          return toArray(parsed);
        } catch (error) {
          return input
            .split(',')
            .map((entry) => entry.trim())
            .filter(Boolean);
        }
      }
      return undefined;
    };

    return toArray(value);
  }

  function resolveOptions() {
    const scriptEl = document.currentScript;
    const globalOptions =
      typeof window !== 'undefined' && window.BDL_CREDENTIALS && typeof window.BDL_CREDENTIALS === 'object'
        ? window.BDL_CREDENTIALS
        : {};

    const dataset = scriptEl?.dataset ?? {};
    const keyCandidate = dataset.key ?? globalOptions.key;
    const autoFetchAttr = dataset.autoFetch;
    const globalAutoFetch =
      typeof globalOptions.autoFetch === 'boolean'
        ? globalOptions.autoFetch
        : typeof globalOptions.auto_fetch === 'boolean'
        ? globalOptions.auto_fetch
        : undefined;
    const autoFetch =
      autoFetchAttr === 'true' || autoFetchAttr === '1'
        ? true
        : autoFetchAttr === 'false' || autoFetchAttr === '0'
        ? false
        : globalAutoFetch;

    const keyPaths =
      parseKeyPaths(dataset.keyPaths) ??
      parseKeyPaths(dataset.keypaths) ??
      parseKeyPaths(globalOptions.locations) ??
      parseKeyPaths(globalOptions.paths) ??
      parseKeyPaths(globalOptions.keyPaths);

    return {
      keyCandidate,
      keyPaths,
      autoFetch,
      scriptEl,
      globalOptions,
    };
  }

  const existingMeta = document.querySelector('meta[name="bdl-api-key"]');
  if (existingMeta) {
    const preset = existingMeta.getAttribute('content');
    if (applyKey(preset, { source: 'meta' })) {
      return;
    }
  }

  const { keyCandidate, keyPaths, autoFetch, scriptEl, globalOptions } = resolveOptions();

  if (applyKey(keyCandidate, { source: 'inline-option' })) {
    return;
  }

  const resolvedPaths = Array.isArray(keyPaths) ? keyPaths : autoFetch ? DEFAULT_KEY_LOCATIONS : [];

  if (!resolvedPaths.length) {
    return;
  }

  const uniquePaths = [...new Set(resolvedPaths.filter((entry) => typeof entry === 'string' && entry.trim()))];

  if (!uniquePaths.length) {
    return;
  }

  (async () => {
    for (const path of uniquePaths) {
      try {
        const response = await fetch(path, { cache: 'no-store' });
        if (!response.ok) {
          continue;
        }
        const payload = await response.json().catch(() => null);
        const key = typeof payload === 'string' ? payload : payload?.key;
        if (applyKey(key, { source: `fetch:${path}` })) {
          if (typeof globalOptions?.onApplied === 'function') {
            try {
              globalOptions.onApplied({ key, path });
            } catch (hookError) {
              console.warn('BDL credential onApplied hook failed', hookError);
            }
          }
          return;
        }
      } catch (error) {
        console.warn('Unable to load Ball Don\'t Lie credential stub from', path, error);
      }
    }
    if (scriptEl?.dataset?.warnMissing !== 'false') {
      console.info(
        'Ball Don\'t Lie API key not detected. Provide a key via meta[name="bdl-api-key"], window.BDL_CREDENTIALS.key, or a configured key path.',
      );
    }
  })().catch((error) => {
    console.warn('Ball Don\'t Lie credential bootstrap failed', error);
  });
})();
