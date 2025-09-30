(() => {
  const SENTINEL = "__VITE" + "_BDL_KEY__";
  const EMBEDDED_KEY = "__VITE_BDL_KEY__";

  const credentials = (window.BDL_CREDENTIALS = window.BDL_CREDENTIALS || {});

  const trimmed = typeof EMBEDDED_KEY === "string" ? EMBEDDED_KEY.trim() : "";
  if (!trimmed || trimmed === SENTINEL) {
    return;
  }

  credentials.key = trimmed;

  const doc = typeof document !== "undefined" ? document : null;
  if (!doc) {
    return;
  }

  let meta = doc.querySelector('meta[name="bdl-api-key"]');
  if (!meta) {
    meta = doc.createElement("meta");
    meta.setAttribute("name", "bdl-api-key");
    doc.head?.appendChild(meta);
  }
  meta.setAttribute("content", trimmed);
})();
