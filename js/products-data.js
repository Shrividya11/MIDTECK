// MIDTEK — shared product catalogue.
// Public catalogue reads are optimized with a small browser cache and a
// timeout so services.html can render immediately while Google Apps Script
// refreshes the catalogue in the background. Admin authentication/storage
// behavior is unchanged.
(function (global) {
  'use strict';

  const API_URL = "https://script.google.com/macros/s/AKfycbyRhYmCsbi7iRITcS-oKho9aEBfJ4vzacvRpHUFRQz5mUyfrhDobmL4u1UjphEjKIfO/exec";
  const BACKEND_VERSION = 'MIDTEK_ADMIN_API_V7';

  // Public product cache only. This is NOT an authentication/session store.
  const CACHE_KEY = 'midtek_products_cache_v2';
  const CACHE_TTL = 5 * 60 * 1000; // 5 minutes
  const REQUEST_TIMEOUT = 7000;

  const ICONS = {
    bulb: '<path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-3.6 10.8c.5.4.8 1 .8 1.7V16h5.6v-.5c0-.7.3-1.3.8-1.7A6 6 0 0 0 12 3Z" stroke-linecap="round" stroke-linejoin="round"/>',
    warehouse: '<path d="M3 21h18M5 21V7l7-4 7 4v14M9 21v-6h6v6" stroke-linecap="round" stroke-linejoin="round"/>',
    sun: '<path d="M12 2v4M12 18v4M4.9 4.9l2.8 2.8M16.3 16.3l2.8 2.8M2 12h4M18 12h4M4.9 19.1l2.8-2.8M16.3 7.7l2.8-2.8" stroke-linecap="round"/>',
    downlight: '<circle cx="12" cy="12" r="4"/><path d="M12 3v2M12 19v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M3 12h2M19 12h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4" stroke-linecap="round"/>'
  };
  const DEFAULT_ICON = 'bulb';

  const DEFAULT_PRODUCTS = [
    { id: 'p1', category: 'Indoor Lighting', name: 'LED Panel Light 40W', description: 'Slim recessed LED panel for offices and retail ceilings. Even, glare-free light output with a long-life driver.', price: 1499, icon: 'bulb' },
    { id: 'p2', category: 'Industrial Lighting', name: 'LED High Bay Light 150W', description: 'High-output LED fixture for warehouses and industrial units, built for continuous operation at height.', price: 5499, icon: 'warehouse' },
    { id: 'p3', category: 'Outdoor Lighting', name: 'LED Street Light 90W', description: 'Weatherproof outdoor LED luminaire for streets, yards and open compounds.', price: 4299, icon: 'sun' },
    { id: 'p4', category: 'Indoor Lighting', name: 'Smart LED Downlight 12W', description: 'Dimmable LED downlight with adjustable colour temperature for homes and hospitality spaces.', price: 899, icon: 'downlight' }
  ];

  const currencyFormatter = new Intl.NumberFormat('en-IN', {
    style: 'currency', currency: 'INR', maximumFractionDigits: 0
  });

  function clone(arr) { return JSON.parse(JSON.stringify(arr)); }

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str == null ? '' : String(str);
    return div.innerHTML;
  }

  function isConfigured() {
    return !!API_URL && API_URL.indexOf('PASTE_YOUR') === -1;
  }

  // Wake the Apps Script runtime before an admin sign-in. This runs in the
  // background and never blocks the login UI.
  let warmupPromise = null;
  function warmup() {
    if (!isConfigured() || warmupPromise) return warmupPromise;
    warmupPromise = fetch(API_URL + '?action=health', {
      method: 'GET', cache: 'no-store', credentials: 'omit'
    }).catch(() => null);
    return warmupPromise;
  }

  function deriveCategories(products) {
    const seen = {};
    return (products || [])
      .map(p => String(p.category || '').trim())
      .filter(Boolean)
      .filter(name => {
        const k = name.toLowerCase();
        if (seen[k]) return false;
        seen[k] = true;
        return true;
      })
      .map(name => ({
        id: name.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
        name,
        active: true
      }));
  }

  function readCache() {
    try {
      const raw = localStorage.getItem(CACHE_KEY);
      if (!raw) return null;
      const cached = JSON.parse(raw);
      if (!cached || !Array.isArray(cached.products)) return null;
      return {
        products: cached.products,
        categories: Array.isArray(cached.categories) ? cached.categories : deriveCategories(cached.products),
        fresh: Date.now() - Number(cached.timestamp || 0) < CACHE_TTL,
        timestamp: Number(cached.timestamp || 0)
      };
    } catch (_) {
      return null;
    }
  }

  function writeCache(products, categories) {
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify({
        timestamp: Date.now(),
        products: products,
        categories: Array.isArray(categories) ? categories : []
      }));
    } catch (_) {
      // Private browsing/storage limits must never break the catalogue.
    }
  }

  async function fetchProducts() {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);
    try {
      const res = await fetch(API_URL, {
        method: 'GET',
        cache: 'no-store',
        signal: controller.signal
      });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error || 'Unknown error from server.');
      const products = Array.isArray(data.products) ? data.products : [];
      writeCache(products, Array.isArray(data.categories) ? data.categories : deriveCategories(products));
      return { products, error: null, fromCache: false };
    } catch (err) {
      return {
        products: null,
        error: err.name === 'AbortError'
          ? 'Product server took too long to respond.'
          : 'Could not reach the product server: ' + err.message
      };
    } finally {
      clearTimeout(timer);
    }
  }

  // Fast public read: cached products are returned immediately. A stale cache
  // is refreshed in the background, while a cache miss performs one request.
  async function load(options) {
    options = options || {};
    if (!isConfigured()) {
      return { products: clone(DEFAULT_PRODUCTS), categories: deriveCategories(DEFAULT_PRODUCTS), error: 'API_URL is not set yet in products-data.js.', fromCache: false };
    }

    const cached = readCache();

    // Fresh cache: render instantly and avoid waking Apps Script on every visit.
    if (cached && cached.fresh && !options.forceRefresh) {
      return { products: clone(cached.products), categories: clone(cached.categories || deriveCategories(cached.products)), error: null, fromCache: true, fresh: true };
    }

    // Stale cache: return it immediately and refresh without blocking the page.
    if (cached && !options.forceRefresh) {
      if (options.backgroundRefresh !== false) {
        fetchProducts().then(function (result) {
          if (typeof options.onRefresh === 'function' && result.products) {
            options.onRefresh(result.products);
          }
        });
      }
      return { products: clone(cached.products), categories: clone(cached.categories || deriveCategories(cached.products)), error: null, fromCache: true, stale: true };
    }

    // First visit / forced refresh: fetch with a hard timeout, then fall back.
    const result = await fetchProducts();
    if (result.products) return { ...result, categories: result.categories || deriveCategories(result.products) };
    if (cached) return { products: clone(cached.products), categories: clone(cached.categories || deriveCategories(cached.products)), error: result.error, fromCache: true };
    return { products: clone(DEFAULT_PRODUCTS), categories: deriveCategories(DEFAULT_PRODUCTS), error: result.error, fromCache: false };
  }

  async function login(password) {
    if (!isConfigured()) return { ok: false, error: 'API_URL is not set yet in products-data.js.' };
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15000);
    try {
      const res = await fetch(API_URL, {
        method: 'POST', mode: 'cors', cache: 'no-store',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ action: 'login', password }), signal: controller.signal
      });
      const raw = await res.text();
      let data;
      try { data = JSON.parse(raw); }
      catch (_) { return { ok: false, error: `Apps Script returned HTTP ${res.status} but not JSON.`, raw: raw.slice(0, 1200), httpStatus: res.status }; }
      if (!res.ok) data.httpStatus = res.status;
      return data;
    } catch (err) {
      return { ok: false, error: err.name === 'AbortError' ? 'Login request timed out after 15 seconds.' : 'Could not reach the product server: ' + err.message, raw: String(err) };
    } finally { clearTimeout(timer); }
  }

  async function save(products, password, categories) {
    if (!isConfigured()) return { ok: false, error: 'API_URL is not set yet in products-data.js.' };
    try {
      const res = await fetch(API_URL, {
        method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ action: 'save', password, products, categories: Array.isArray(categories) ? categories : deriveCategories(products) })
      });
      const raw = await res.text();
      let data;
      try { data = JSON.parse(raw); }
      catch (_) { return { ok: false, error: `Apps Script returned HTTP ${res.status} but not JSON.`, raw: raw.slice(0, 1200), httpStatus: res.status }; }
      if (!res.ok) data.httpStatus = res.status;
      if (data.ok && Array.isArray(data.products)) writeCache(data.products, data.categories || deriveCategories(data.products));
      return data;
    } catch (err) {
      return { ok: false, error: 'Could not reach the product server: ' + err.message };
    }
  }

  function productCardHTML(product) {
    const price = currencyFormatter.format(Number(product.price) || 0);
    const productPath = `contact.html?product=${encodeURIComponent(product.name || '').replace(/%20/g, '+')}`;
    const imageUrl = String(product.imageUrl || '').trim();
    const media = imageUrl
      ? `<div class="product-media has-image"><img src="${escapeHtml(imageUrl)}" alt="${escapeHtml(product.name || 'MIDTEK product')}" loading="lazy" decoding="async" fetchpriority="low" width="800" height="600"></div>`
      : `<div class="product-media"><svg class="placeholder-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true">${ICONS[product.icon] || ICONS[DEFAULT_ICON]}</svg></div>`;
    return `<article class="product-card" itemscope itemtype="https://schema.org/Product">
          ${media}
          <div class="product-body">
            <span class="product-category">${escapeHtml(product.category || "Uncategorized")}</span><h3 itemprop="name">${escapeHtml(product.name)}</h3>
            <p itemprop="description">${escapeHtml(product.description)}</p>
            <div class="product-foot">
              <span class="product-price" itemprop="offers" itemscope itemtype="https://schema.org/Offer">
                <span itemprop="priceCurrency" content="INR"></span>
                <span itemprop="price" content="${Number(product.price) || 0}">${price}</span>
              </span>
              <a href="${productPath}" class="product-ask">Ask about this &rarr;</a>
            </div>
          </div>
        </article>`;
  }

  global.MidtekProducts = {
    BACKEND_VERSION, API_URL, ICONS, DEFAULT_ICON, DEFAULT_PRODUCTS,
    CACHE_KEY, CACHE_TTL, isConfigured, clone, escapeHtml,
    load, save, login, warmup, productCardHTML, deriveCategories, currencyFormatter
  };
})(window);
