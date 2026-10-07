// MIDTEK — Product Manager: add, edit, filter, delete and image upload.
(function () {
  'use strict';

  const P = window.MidtekProducts;
  const list = document.getElementById('editor-list');
  const status = document.getElementById('admin-status');
  if (!P || !list) return;

  const modal = document.getElementById('product-modal');
  const form = document.getElementById('product-form');
  const modalTitle = document.getElementById('modal-title');
  const modalSubmit = document.getElementById('modal-submit');
  const nameInput = document.getElementById('product-name');
  const categoryInput = document.getElementById('product-category');
  const categoryList = document.getElementById('category-list');
  const categoryNameInput = document.getElementById('new-category-name');
  const priceInput = document.getElementById('product-price');
  const descInput = document.getElementById('product-description');
  const imageInput = document.getElementById('product-image');
  const imagePreview = document.getElementById('modal-image-preview');
  const modalError = document.getElementById('modal-form-error');
  const removeModalImage = document.getElementById('remove-modal-image');
  const searchInput = document.getElementById('product-search');
  const filterSelect = document.getElementById('product-filter');
  const sortSelect = document.getElementById('product-sort');
  const categoryFilter = document.getElementById('product-category-filter');
  const countEl = document.getElementById('product-count');
  const changeState = document.getElementById('change-state');
  const loginScreen = document.getElementById('admin-login');
  const dashboard = document.getElementById('admin-dashboard');
  const loginForm = document.getElementById('admin-login-form');
  const loginPassword = document.getElementById('login-password');
  const loginStatus = document.getElementById('admin-login-status');
  const loginBtn = document.getElementById('admin-login-btn');
  const logoutBtn = document.getElementById('admin-logout');
  // Authentication is intentionally page-memory-only. Refreshing, closing,
  // or leaving this page clears the password automatically.
  let adminPassword = '';
  const saveBtn = document.getElementById('save-changes');

  let products = [];
  let categories = [];
  let nextId = 1;
  let dirty = false;
  let editingIndex = null;
  let modalImageData = '';
  let modalImageUrl = '';
  let lastFocused = null;

  function setStatus(message, type) {
    status.textContent = message || '';
    status.className = 'form-status' + (type ? ' ' + type : '');
  }

  function describeApiError(result) {
    const message = result && result.error ? result.error : 'Save failed.';
    const detail = result && result.raw ? ` Response: ${result.raw}` : '';
    return message + detail;
  }

  function markDirty() {
    dirty = true;
    changeState.textContent = 'Unsaved changes';
    changeState.classList.add('is-dirty');
    saveBtn.disabled = false;
  }

  function clearDirty() {
    dirty = false;
    changeState.textContent = 'All changes saved';
    changeState.classList.remove('is-dirty');
  }

  function productHasImage(p) { return Boolean(String(p.imageUrl || p.imageData || '').trim()); }

  function filteredProducts() {
    const query = (searchInput.value || '').trim().toLowerCase();
    const filter = filterSelect.value;
    const category = categoryFilter ? categoryFilter.value : 'all';
    let rows = products.map((product, index) => ({ product, index }));
    rows = rows.filter(({ product }) => {
      const text = `${product.name || ''} ${product.description || ''}`.toLowerCase();
      const queryOk = !query || text.includes(query);
      const imageOk = filter === 'all' || (filter === 'image' ? productHasImage(product) : !productHasImage(product));
      const categoryOk = category === 'all' || String(product.category || 'Uncategorized') === category;
      return queryOk && imageOk && categoryOk;
    });
    const sort = sortSelect.value;
    rows.sort((a, b) => {
      if (sort === 'name-az') return String(a.product.name).localeCompare(String(b.product.name));
      if (sort === 'name-za') return String(b.product.name).localeCompare(String(a.product.name));
      if (sort === 'price-low') return Number(a.product.price) - Number(b.product.price);
      if (sort === 'price-high') return Number(b.product.price) - Number(a.product.price);
      return sort === 'oldest' ? a.index - b.index : b.index - a.index;
    });
    return rows;
  }

  function imageMarkup(product) {
    const src = product.imageData || product.imageUrl;
    if (src) return `<img src="${P.escapeHtml(src)}" alt="${P.escapeHtml(product.name || 'Product image')}" loading="lazy">`;
    return '<span class="admin-no-image"><span>＋</span>No image</span>';
  }

  function renderList() {
    const rows = filteredProducts();
    countEl.textContent = `${rows.length}/${products.length}`;
    if (!rows.length) {
      list.innerHTML = `<div class="admin-empty"><div class="admin-empty-icon">⌕</div><h3>No products found</h3><p>Try another search/filter, or add a new product.</p></div>`;
      return;
    }
    list.innerHTML = rows.map(({ product, index }) => `
      <article class="admin-product-row">
        <div class="admin-product-thumb">${imageMarkup(product)}</div>
        <div class="admin-product-info">
          <div class="admin-product-title"><h3>${P.escapeHtml(product.name || 'Untitled product')}</h3><span class="product-id">${P.escapeHtml(product.id || '')}</span><span class="product-category-tag">${P.escapeHtml(product.category || 'Uncategorized')}</span></div>
          <p>${P.escapeHtml(product.description || 'No description added.')}</p>
          <strong class="admin-product-price">₹${(Number(product.price) || 0).toLocaleString('en-IN')}</strong>
        </div>
        <div class="admin-product-actions">
          <button type="button" class="btn btn-ghost" data-action="edit" data-index="${index}">Edit</button>
          <button type="button" class="btn btn-danger" data-action="delete" data-index="${index}">Delete</button>
        </div>
      </article>`).join('');
  }

  function renderAll() { renderList(); }

  function renderCategoryOptions(selected) {
    if (!categoryInput) return;
    const names = categories.filter(c => c.active !== false).map(c => c.name).filter(Boolean);
    if (selected && !names.some(n => n.toLowerCase() === String(selected).toLowerCase())) names.push(selected);
    if (!names.length) names.push('Uncategorized');
    categoryInput.innerHTML = names.map(name => `<option value="${P.escapeHtml(name)}">${P.escapeHtml(name)}</option>`).join('');
    categoryInput.value = selected || names[0];
  }

  function renderCategoryControls() {
    if (categoryFilter) {
      const current = categoryFilter.value || 'all';
      categoryFilter.innerHTML = '<option value="all">All categories</option>' +
        categories.filter(c => c.active !== false).map(c => `<option value="${P.escapeHtml(c.name)}">${P.escapeHtml(c.name)}</option>`).join('');
      categoryFilter.value = categories.some(c => c.name === current) ? current : 'all';
    }
    if (categoryList) {
      categoryList.innerHTML = categories.map((c, i) => `
        <div class="category-row">
          <div><strong>${P.escapeHtml(c.name)}</strong><small>${c.active === false ? 'Hidden' : 'Active'}</small></div>
          <div class="category-actions">
            <button type="button" class="btn btn-ghost small-btn" data-cat-action="rename" data-cat-index="${i}">Rename</button>
            <button type="button" class="btn btn-danger small-btn" data-cat-action="delete" data-cat-index="${i}">Delete</button>
          </div>
        </div>`).join('') || '<p class="form-hint">No categories yet. Add one below.</p>';
    }
  }

  function addOrCreateCategory(name) {
    name = String(name || '').trim().replace(/\s+/g, ' ');
    if (!name) return null;
    const existing = categories.find(c => c.name.toLowerCase() === name.toLowerCase());
    if (existing) return existing.name;
    categories.push({ id: name.toLowerCase().replace(/[^a-z0-9]+/g,'-') + '-' + Date.now().toString(36), name, active:true, createdAt:new Date().toISOString() });
    renderCategoryControls();
    return name;
  }

  function openModal(index) {
    lastFocused = document.activeElement;
    editingIndex = Number.isInteger(index) ? index : null;
    const p = editingIndex === null ? { name: '', category: categories[0]?.name || 'Uncategorized', description: '', price: 0, imageUrl: '', imageData: '' } : products[editingIndex];
    modalTitle.textContent = editingIndex === null ? 'Add product' : 'Edit product';
    modalSubmit.textContent = editingIndex === null ? 'Add product' : 'Update product';
    nameInput.value = p.name || '';
    renderCategoryOptions(p.category || 'Uncategorized');
    priceInput.value = Number(p.price) || 0;
    descInput.value = p.description || '';
    modalImageData = p.imageData || '';
    modalImageUrl = p.imageUrl || '';
    modalError.textContent = '';
    imageInput.value = '';
    renderModalImage();
    modal.hidden = false;
    document.body.classList.add('modal-open');
    setTimeout(() => nameInput.focus(), 20);
  }

  function closeModal() {
    modal.hidden = true;
    document.body.classList.remove('modal-open');
    editingIndex = null;
    modalImageData = '';
    modalImageUrl = '';
    modalError.textContent = '';
    if (lastFocused && typeof lastFocused.focus === 'function') lastFocused.focus();
  }

  function renderModalImage() {
    const src = modalImageData || modalImageUrl;
    imagePreview.innerHTML = src ? `<img src="${P.escapeHtml(src)}" alt="Product image preview">` : '<span>No image selected</span>';
    removeModalImage.disabled = !src;
  }

  async function prepareImage(file) {
    if (!file) return '';
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) throw new Error('Please choose a JPG, PNG or WebP image.');
    if (file.size > 12 * 1024 * 1024) throw new Error('Image is too large. Please choose an image under 12 MB.');
    const dataUrl = await new Promise((resolve, reject) => { const r = new FileReader(); r.onload = () => resolve(r.result); r.onerror = () => reject(new Error('Could not read the image.')); r.readAsDataURL(file); });
    const img = await new Promise((resolve, reject) => { const i = new Image(); i.onload = () => resolve(i); i.onerror = () => reject(new Error('Could not decode the image.')); i.src = dataUrl; });
    const maxDimension = 1600;
    const scale = Math.min(1, maxDimension / Math.max(img.naturalWidth, img.naturalHeight));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(img.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(img.naturalHeight * scale));
    canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL('image/jpeg', 0.82);
  }

  function showDashboard() {
    // Use both the hidden attribute and explicit inline display values.
    // This makes the screen transition reliable even if a site's CSS overrides
    // the browser's default [hidden] rule.
    loginScreen.setAttribute('hidden', '');
    loginScreen.hidden = true;
    loginScreen.style.display = 'none';
    dashboard.removeAttribute('hidden');
    dashboard.hidden = false;
    dashboard.style.display = 'block';
    window.scrollTo(0, 0);
  }

  function showLogin(message, type) {
    dashboard.setAttribute('hidden', '');
    dashboard.hidden = true;
    dashboard.style.display = 'none';
    loginScreen.removeAttribute('hidden');
    loginScreen.hidden = false;
    loginScreen.style.display = 'flex';
    if (message) { loginStatus.textContent = message; loginStatus.className = 'form-status ' + (type || ''); }
    setTimeout(() => loginPassword.focus(), 20);
  }

  function clearSession() {
    adminPassword = '';
  }

  async function loadDashboard() {
    setStatus(P.isConfigured() ? 'Loading product catalogue…' : 'API_URL is not configured. Showing sample data only.', P.isConfigured() ? '' : 'error');
    const result = await P.load();
    products = result.products.map(p => ({ ...p, category: p.category || 'Uncategorized', imageUrl: p.imageUrl || '' }));
    categories = Array.isArray(result.categories) ? result.categories : P.deriveCategories(products);
    products.forEach(p => addOrCreateCategory(p.category));
    renderCategoryControls();
    nextId = products.reduce((max, p) => Math.max(max, parseInt(String(p.id).replace(/\D/g, ''), 10) || 0), 0) + 1;
    renderAll();
    if (result.error && P.isConfigured()) setStatus(result.error, 'error');
    else if (P.isConfigured()) { setStatus('Catalogue loaded successfully.', 'success'); clearDirty(); }
  }

  async function init() {
    // Start the lightweight health request immediately. Google Apps Script
    // cold starts are the main source of sign-in delay; warming it in the
    // background means the login request is usually served by a warm runtime.
    P.warmup();

    // Preload public catalogue data while the admin types the password.
    // It is cached by products-data.js and does not require authentication.
    P.load({ backgroundRefresh: false }).catch(() => {});

    clearSession();
    dashboard.setAttribute('hidden', '');
    dashboard.style.display = 'none';
    loginScreen.removeAttribute('hidden');
    loginScreen.style.display = 'flex';
    showLogin();
  }

  loginForm.addEventListener('submit', async event => {
    event.preventDefault();
    const password = loginPassword.value;
    if (!password) { loginStatus.textContent = 'Enter your admin password.'; loginStatus.className = 'form-status error'; loginPassword.focus(); return; }
    loginBtn.disabled = true;
    loginBtn.textContent = 'Signing in…';
    loginStatus.textContent = 'Verifying credentials…';
    loginStatus.className = 'form-status';
    try {
      const result = await P.login(password);
      // Authentication is based on the explicit ok flag, not the backend
      // version string. This prevents an otherwise valid login from being
      // blocked just because the Apps Script deployment is one revision old.
      if (result && result.ok === true) {
        adminPassword = password;
        loginPassword.value = '';
        loginStatus.textContent = '';
        loginStatus.className = 'form-status';
        loginBtn.disabled = false;
        loginBtn.textContent = 'Sign in to dashboard';
        showDashboard();

        // Loading the catalogue is deliberately separate from authentication.
        // A Sheet/Drive/API read problem must never send the user back to login.
        try {
          await loadDashboard();
        } catch (error) {
          setStatus('Dashboard opened, but the product catalogue could not be loaded: ' + error.message, 'error');
        }
        return;
      }

      const detail = result && result.error ? result.error : 'The server returned an unexpected response.';
      const version = result && result.apiVersion ? ` API version: ${result.apiVersion}.` : '';
      loginStatus.textContent = `${detail}${version}`;
      loginStatus.className = 'form-status error';
      console.error('MIDTEK login failed. Full response:', result);
      loginBtn.disabled = false;
      loginBtn.textContent = 'Sign in to dashboard';
      loginPassword.select();
    } catch (error) {
      loginStatus.textContent = error.message || 'Unable to sign in. Please try again.';
      loginStatus.className = 'form-status error';
      loginBtn.disabled = false;
      loginBtn.textContent = 'Sign in to dashboard';
    }
  });

  document.getElementById('toggle-login-password').addEventListener('click', event => {
    const button = event.currentTarget;
    const showing = loginPassword.type === 'text';
    loginPassword.type = showing ? 'password' : 'text';
    button.textContent = showing ? 'Show' : 'Hide';
    button.setAttribute('aria-label', showing ? 'Show password' : 'Hide password');
    button.setAttribute('aria-pressed', String(!showing));
  });

  logoutBtn.addEventListener('click', () => {
    clearSession();
    dirty = false;
    showLogin('You have been logged out.', 'success');
  });

  document.getElementById('add-product').addEventListener('click', () => openModal(null));
  [searchInput, filterSelect, sortSelect, categoryFilter].filter(Boolean).forEach(el => el.addEventListener('input', renderList));
  document.querySelectorAll('[data-close-modal]').forEach(el => el.addEventListener('click', closeModal));
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && !modal.hidden) closeModal(); });

  list.addEventListener('click', event => {
    const button = event.target.closest('[data-action]');
    if (!button) return;
    const index = Number(button.dataset.index);
    if (!products[index]) return;
    if (button.dataset.action === 'edit') openModal(index);
    if (button.dataset.action === 'delete') {
      const productName = products[index].name || 'this product';
      if (!window.confirm(`Delete “${productName}”? This will remove it from the catalogue when you save changes.`)) return;
      products.splice(index, 1);
      renderAll();
      markDirty();
      setStatus(`“${productName}” marked for deletion. Click Save changes to publish.`, 'success');
    }
  });

  imageInput.addEventListener('change', async () => {
    const file = imageInput.files && imageInput.files[0];
    if (!file) return;
    try {
      modalError.textContent = 'Preparing image…';
      modalImageData = await prepareImage(file);
      modalImageUrl = '';
      renderModalImage();
      modalError.textContent = '';
    } catch (err) { imageInput.value = ''; modalError.textContent = err.message; }
  });

  removeModalImage.addEventListener('click', () => { modalImageData = ''; modalImageUrl = ''; imageInput.value = ''; renderModalImage(); });

  form.addEventListener('submit', event => {
    event.preventDefault();
    const name = nameInput.value.trim();
    const description = descInput.value.trim();
    const category = addOrCreateCategory(categoryInput ? categoryInput.value : 'Uncategorized') || 'Uncategorized';
    const price = Number(priceInput.value);
    if (!name || !description || !Number.isFinite(price) || price < 0) {
      modalError.textContent = 'Please fill in the product name, description and a valid price.';
      return;
    }
    if (!modalImageData && !modalImageUrl) {
      modalError.textContent = 'Please upload a product image.';
      return;
    }
    const item = editingIndex === null ? {
      id: `p${nextId++}`, category, name, description, price, icon: P.DEFAULT_ICON, imageUrl: '', imageData: modalImageData
    } : {
      ...products[editingIndex], name, description, price, imageUrl: modalImageUrl, imageData: modalImageData
    };
    const wasAdding = editingIndex === null;
    if (wasAdding) products.unshift(item); else products[editingIndex] = item;
    renderAll();
    markDirty();
    closeModal();
    setStatus(wasAdding ? 'Product added to the list. Click Save changes to publish it.' : 'Product updated. Click Save changes to publish it.', 'success');
  });

  document.getElementById('reset-defaults').addEventListener('click', () => {
    if (!window.confirm('Reset the catalogue to the factory defaults? This is not published until you click Save changes.')) return;
    products = P.clone(P.DEFAULT_PRODUCTS).map(p => ({ ...p, category: p.category || 'Uncategorized', imageUrl: '' }));
    categories = P.deriveCategories(products).map(c => ({...c, createdAt:new Date().toISOString()}));
    renderCategoryControls();
    renderAll(); markDirty();
    setStatus('Defaults loaded locally. Click Save changes to publish.', 'success');
  });

  const addCategoryBtn = document.getElementById('add-category-btn');
  if (addCategoryBtn) addCategoryBtn.addEventListener('click', () => {
    const name = categoryNameInput ? categoryNameInput.value.trim() : '';
    if (!name) return;
    addOrCreateCategory(name);
    if (categoryNameInput) categoryNameInput.value = '';
    markDirty();
    setStatus(`Category "${name}" added. Click Save changes to publish.`, 'success');
  });

  if (categoryList) categoryList.addEventListener('click', event => {
    const btn = event.target.closest('[data-cat-action]');
    if (!btn) return;
    const i = Number(btn.dataset.catIndex);
    const cat = categories[i];
    if (!cat) return;
    if (btn.dataset.catAction === 'rename') {
      const name = window.prompt('New category name:', cat.name);
      if (!name || !name.trim()) return;
      const newName = name.trim().replace(/\s+/g, ' ');
      const duplicate = categories.some((c, idx) => idx !== i && c.name.toLowerCase() === newName.toLowerCase());
      if (duplicate) return setStatus('That category already exists.', 'error');
      const oldName = cat.name;
      cat.name = newName;
      products.forEach(p => { if (String(p.category || '').toLowerCase() === oldName.toLowerCase()) p.category = newName; });
      renderCategoryControls(); renderList(); markDirty();
      setStatus(`Category renamed. Products using "${oldName}" were updated locally. Click Save changes to publish.`, 'success');
    }
    if (btn.dataset.catAction === 'delete') {
      const used = products.some(p => String(p.category || '').toLowerCase() === cat.name.toLowerCase());
      if (used) return setStatus(`Cannot delete "${cat.name}" because products still use it. Rename it or move those products first.`, 'error');
      if (!window.confirm(`Delete category "${cat.name}"?`)) return;
      categories.splice(i, 1);
      renderCategoryControls(); markDirty();
      setStatus(`Category "${cat.name}" removed locally. Click Save changes to publish.`, 'success');
    }
  });

  saveBtn.addEventListener('click', async () => {
    if (!adminPassword) { clearSession(); showLogin('Please sign in again to continue.', 'error'); return; }
    saveBtn.disabled = true; saveBtn.textContent = 'Saving…';
    setStatus('Uploading images and publishing catalogue…', '');
    const result = await P.save(products, adminPassword, categories);
    if (result.ok) {
      products = (result.products || products).map(p => ({ ...p, category: p.category || 'Uncategorized', imageUrl: p.imageUrl || '', imageData: '' }));
      categories = Array.isArray(result.categories) ? result.categories : categories;
      renderCategoryControls();
      renderAll(); clearDirty(); saveBtn.textContent = 'Saved';
      setStatus('Saved successfully. The Services page now uses the updated catalogue.', 'success');
      setTimeout(() => { saveBtn.textContent = 'Save changes'; }, 1800);
    } else {
      saveBtn.disabled = false; saveBtn.textContent = 'Save changes';
      if (result.auth === false || /password|unauthor/i.test(result.error || '')) { clearSession(); showLogin('Please sign in again to continue.', 'error'); }
      else setStatus(describeApiError(result), 'error');
    }
  });

  // Do not persist an admin session. If the browser restores this page from
  // its back/forward cache, force the login screen again.
  window.addEventListener('pageshow', event => {
    if (event.persisted) {
      clearSession();
      dirty = false;
      showLogin();
    }
  });

  // If the page is being hidden for a navigation, clear the in-memory
  // credential. A normal refresh/reopen also starts from init().
  window.addEventListener('pagehide', () => { clearSession(); });

  init();
})();
