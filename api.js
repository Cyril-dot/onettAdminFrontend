// ═══════════════════════════════════════════════════════════════════
//  MarketPlace Admin — Central API Handler
//  Base URL: https://onettbackend.onrender.com
// ═══════════════════════════════════════════════════════════════════

const API = (() => {
  const BASE = 'https://onettbackend.onrender.com';

  // ── Token Management ──────────────────────────────────────────
  function getToken()       { return localStorage.getItem('admin_token') || ''; }
  function setToken(token)  { localStorage.setItem('admin_token', token); }
  function clearToken()     { localStorage.removeItem('admin_token'); localStorage.removeItem('admin_seller_id'); }
  function getSellerId()    { return localStorage.getItem('admin_seller_id') || ''; }
  function setSellerId(id)  { localStorage.setItem('admin_seller_id', id); }

  // ── Core Fetch ────────────────────────────────────────────────
  async function request(method, path, body = null, isFormData = false) {
    const headers = { 'ngrok-skip-browser-warning': 'true' };

    // Do NOT set Content-Type for FormData — the browser sets it with the
    // correct multipart boundary automatically.
    if (!isFormData) headers['Content-Type'] = 'application/json';

    const token = getToken();
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const opts = { method, headers };
    if (body && !isFormData) opts.body = JSON.stringify(body);
    if (body &&  isFormData) opts.body = body; // FormData passed as-is

    try {
      const res = await fetch(`${BASE}${path}`, opts);
      let data;
      const ct = res.headers.get('content-type') || '';
      if (ct.includes('application/json')) {
        data = await res.json();
      } else {
        data = { message: await res.text() };
      }
      return { ok: res.ok, status: res.status, data };
    } catch (err) {
      console.error(`[API] ${method} ${path} failed:`, err);
      return { ok: false, status: 0, data: { message: err.message } };
    }
  }

  const get    = (path)               => request('GET',    path);
  const post   = (path, body, isForm) => request('POST',   path, body, isForm);
  const put    = (path, body, isForm) => request('PUT',    path, body, isForm);
  const patch  = (path, body)         => request('PATCH',  path, body);
  const del    = (path)               => request('DELETE', path);

  // ══════════════════════════════════════════════════════════════
  //  AUTH — Seller Login
  // ══════════════════════════════════════════════════════════════
  async function sellerLogin(email, password) {
    const res = await post('/api/v1/sellers/login', { email, password });
    if (res.ok && res.data?.token) {
      setToken(res.data.token);
      if (res.data?.sellerId) setSellerId(res.data.sellerId);
    }
    return res;
  }

  function logout() {
    clearToken();
    window.location.href = 'index.html';
  }

  // ══════════════════════════════════════════════════════════════
  //  SELLER PROFILE
  // ══════════════════════════════════════════════════════════════
  const sellerMe   = ()   => get('/api/v1/sellers/me');
  const sellerById = (id) => get(`/api/v1/sellers/${id}`);

  // ══════════════════════════════════════════════════════════════
  //  ORDERS
  // ══════════════════════════════════════════════════════════════
  const getAllOrders       = (status)      => get(`/api/v1/orders/admin/all${status ? `?status=${status}` : ''}`);
  const getOrderById       = (id)          => get(`/api/v1/orders/admin/${id}`);
  const updateOrderStatus  = (id, status)  => patch(`/api/v1/orders/admin/${id}/status`, { status });
  const cancelOrderByAdmin = (id)          => patch(`/api/v1/orders/admin/${id}/cancel`);
  const getOrderSummary    = ()            => get('/api/v1/orders/admin/summary');
  const getOrdersToday     = ()            => get('/api/v1/orders/admin/today');
  const getOrdersThisWeek  = ()            => get('/api/v1/orders/admin/this-week');
  const getOrdersThisMonth = ()            => get('/api/v1/orders/admin/this-month');
  const getDailyCounts     = ()            => get('/api/v1/orders/admin/daily-counts');
  const getSellerOrders    = (status)      => get(`/api/v1/orders/seller/orders${status ? `?status=${status}` : ''}`);
  const getSellerRevenue   = ()            => get('/api/v1/orders/seller/revenue');

  // ══════════════════════════════════════════════════════════════
  //  CATEGORIES (Seller) — multipart/form-data
  // ══════════════════════════════════════════════════════════════

  /** createCategory(formData)  — request part + optional iconFile part */
  const createCategory      = (formData)             => request('POST', '/api/v1/seller/categories', formData, true);

  /** updateCategory(categoryId, formData) */
  const updateCategory      = (categoryId, formData) => request('PUT', `/api/v1/seller/categories/${categoryId}`, formData, true);

  /** deleteCategory(categoryId) */
  const deleteCategory      = (categoryId)           => del(`/api/v1/seller/categories/${categoryId}`);

  /** getSellerCategories() */
  const getSellerCategories = ()                     => get('/api/v1/seller/categories');

  // ══════════════════════════════════════════════════════════════
  //  PRODUCTS (Seller)
  // ══════════════════════════════════════════════════════════════

  /**
   * addProduct(formData)
   * FormData must contain:
   *   - 'request'   → JSON Blob  { name, categoryId, price, stock, stockStatus, … }
   *   - 'images'    → File[]     (optional, each file appended separately)
   *   - 'videoFile' → File       (optional)
   *
   * Maps to: POST /api/v1/seller/products  (multipart/form-data)
   */
  const addProduct = (formData) =>
    request('POST', '/api/v1/seller/products', formData, true);

  /**
   * updateProduct(productId, formData)
   * FormData must contain:
   *   - 'request'          → JSON Blob  (all fields optional except those being changed)
   *   - 'newImages'        → File[]     (optional)
   *   - 'videoFile'        → File       (optional, replaces existing)
   *
   * Maps to: PUT /api/v1/seller/products/{productId}  (multipart/form-data)
   */
  const updateProduct = (productId, formData) =>
    request('PUT', `/api/v1/seller/products/${productId}`, formData, true);

  /**
   * replaceAllImages(productId, formData)
   * FormData must contain:
   *   - 'images' → File[]
   *
   * Maps to: PUT /api/v1/seller/products/{productId}/images/replace
   */
  const replaceAllImages = (productId, formData) =>
    request('PUT', `/api/v1/seller/products/${productId}/images/replace`, formData, true);

  /**
   * uploadProductVideo(productId, formData)
   * FormData must contain:
   *   - 'videoFile' → File
   *
   * Maps to: POST /api/v1/seller/products/{productId}/video
   */
  const uploadProductVideo = (productId, formData) =>
    request('POST', `/api/v1/seller/products/${productId}/video`, formData, true);

  /**
   * deleteProductVideo(productId)
   * Maps to: DELETE /api/v1/seller/products/{productId}/video
   */
  const deleteProductVideo = (productId) =>
    del(`/api/v1/seller/products/${productId}/video`);

  // ── Read-only product endpoints ───────────────────────────────
  const getMyProducts         = ()            => get('/api/v1/seller/products');
  const getProductsByStatus   = (status)      => get(`/api/v1/seller/products/by-status?status=${status}`);
  const getProductDetails     = (id)          => get(`/api/v1/seller/products/${id}`);
  const getTrendingProducts   = ()            => get('/api/v1/seller/products/trending');
  const getDiscountedProducts = ()            => get('/api/v1/seller/products/discounted');
  const getLowStockProducts   = (threshold=5) => get(`/api/v1/seller/products/low-stock?threshold=${threshold}`);
  const searchProducts        = (params)      => get(`/api/v1/seller/products/search?${new URLSearchParams(params)}`);
  const globalSearch          = (kw)          => get(`/api/v1/seller/products/global-search?keyword=${encodeURIComponent(kw)}`);

  // ── Patch endpoints ───────────────────────────────────────────
  /**
   * updateStock(productId, stock)
   * Maps to: PATCH /api/v1/seller/products/{productId}/stock?stock={stock}
   */
  const updateStock = (id, stock) =>
    patch(`/api/v1/seller/products/${id}/stock?stock=${stock}`);

  /**
   * updateProductStatus(productId, status)
   * status: 'ACTIVE' | 'INACTIVE' | 'DRAFT'
   * Maps to: PATCH /api/v1/seller/products/{productId}/status?status={status}
   */
  const updateProductStatus = (id, status) =>
    patch(`/api/v1/seller/products/${id}/status?status=${status}`);

  /**
   * updateStockStatus(productId, stockStatus, availableInDays?)
   * stockStatus: 'IN_STOCK' | 'OUT_OF_STOCK' | 'LOW_STOCK' | 'COMING_SOON' | 'PRE_ORDER'
   * availableInDays: required when stockStatus is COMING_SOON or PRE_ORDER
   * Maps to: PATCH /api/v1/seller/products/{productId}/stock-status?stockStatus={s}&availableInDays={days}
   */
  const updateStockStatus = (id, stockStatus, availableInDays) =>
    patch(`/api/v1/seller/products/${id}/stock-status?stockStatus=${stockStatus}${availableInDays != null ? `&availableInDays=${availableInDays}` : ''}`);

  // ── Delete ────────────────────────────────────────────────────
  const deleteProduct = (id) => del(`/api/v1/seller/products/${id}`);

  // ══════════════════════════════════════════════════════════════
  //  USER-SUBMITTED PRODUCTS (Approval Workflow)
  // ══════════════════════════════════════════════════════════════
  const getAllProductRequests      = ()                         => get('/api/v1/user-products/seller/all');
  const getProductRequestsByStatus = (status, page=0, size=10) =>
    get(`/api/v1/user-products/seller/by-status?status=${status}&page=${page}&size=${size}`);
  const getRecentProductRequests   = (page=0, size=10)         =>
    get(`/api/v1/user-products/seller/recent?page=${page}&size=${size}`);
  const getProductRequestById      = (id)                      => get(`/api/v1/user-products/seller/requests/${id}`);
  const updateProductApproval      = (id, status)              =>
    patch(`/api/v1/user-products/seller/requests/${id}/status`, { status });

  // ══════════════════════════════════════════════════════════════
  //  PRE-ORDERS
  // ══════════════════════════════════════════════════════════════
  const getAllActivePreOrders = ()         => get('/api/pre-orders/seller/all');
  const getPreOrdersByProduct = (pid)      => get(`/api/pre-orders/seller/product/${pid}`);
  const getPreOrdersByStatus  = (status)   => get(`/api/pre-orders/seller/status/${status}`);
  const confirmSecondPayment  = (id, note) =>
    post(`/api/pre-orders/seller/${id}/confirm-payment`, note ? { adminNote: note } : {});

  // ══════════════════════════════════════════════════════════════
  //  AI TOOLS
  // ══════════════════════════════════════════════════════════════
  const analyzeTrends     = ()                                       => get('/api/v1/ai/trends');
  const generateListing   = (productName, basicDetails)              =>
    post(`/api/v1/ai/seller/generate-listing?productName=${encodeURIComponent(productName)}&basicDetails=${encodeURIComponent(basicDetails)}`);
  const suggestPrice      = (productName, productDetails, condition) =>
    get(`/api/v1/ai/seller/suggest-price?productName=${encodeURIComponent(productName)}&productDetails=${encodeURIComponent(productDetails)}${condition ? `&condition=${condition}` : ''}`);
  const analyzeInventory  = ()                                       => get('/api/v1/ai/seller/inventory-analysis');
  const improveVisibility = (productId)                              => get(`/api/v1/ai/seller/improve-visibility/${productId}`);

  // ══════════════════════════════════════════════════════════════
  //  NOTIFICATIONS
  // ══════════════════════════════════════════════════════════════
  const getNotifications  = (unreadOnly=false) => get(`/api/v1/notifications?unreadOnly=${unreadOnly}`);
  const getUnreadCount    = ()                  => get('/api/v1/notifications/unread-count');
  const markNotifRead     = (id)                => patch(`/api/v1/notifications/${id}/read`);
  const markAllNotifsRead = ()                  => patch('/api/v1/notifications/read-all');

  // ══════════════════════════════════════════════════════════════
  //  CHAT / CONVERSATIONS
  // ══════════════════════════════════════════════════════════════
  const getSellerConversations = (unreadOnly=false) =>
    get(`/api/v1/chat/seller/conversations?unreadOnly=${unreadOnly}`);
  const getSellerInbox       = () => get('/api/v1/chat/seller/inbox');
  const getSellerUnreadCount = () => get('/api/v1/chat/seller/unread-count');
  const getChatHistory       = (conversationId) =>
    get(`/api/v1/chat/conversations/${conversationId}/history`);

  // ── Public API ────────────────────────────────────────────────
  return {
    // auth
    sellerLogin, logout, getToken, setToken, getSellerId, setSellerId,
    // seller profile
    sellerMe, sellerById,
    // orders
    getAllOrders, getOrderById, updateOrderStatus, cancelOrderByAdmin,
    getOrderSummary, getOrdersToday, getOrdersThisWeek, getOrdersThisMonth,
    getDailyCounts, getSellerOrders, getSellerRevenue,
    // categories
    createCategory, updateCategory, deleteCategory, getSellerCategories,
    // products — write
    addProduct, updateProduct, replaceAllImages,
    uploadProductVideo, deleteProductVideo,
    updateStock, updateProductStatus, updateStockStatus, deleteProduct,
    // products — read
    getMyProducts, getProductsByStatus, getProductDetails,
    getTrendingProducts, getDiscountedProducts, getLowStockProducts,
    searchProducts, globalSearch,
    // user product requests
    getAllProductRequests, getProductRequestsByStatus, getRecentProductRequests,
    getProductRequestById, updateProductApproval,
    // pre-orders
    getAllActivePreOrders, getPreOrdersByProduct, getPreOrdersByStatus, confirmSecondPayment,
    // ai
    analyzeTrends, generateListing, suggestPrice, analyzeInventory, improveVisibility,
    // notifications
    getNotifications, getUnreadCount, markNotifRead, markAllNotifsRead,
    // chat
    getSellerConversations, getSellerInbox, getSellerUnreadCount, getChatHistory,
  };
})();

// ── Toast notification utility ────────────────────────────────────
function showToast(message, type = 'success') {
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.innerHTML = `
    <span class="material-symbols-outlined">${type === 'success' ? 'check_circle' : type === 'error' ? 'error' : 'info'}</span>
    <span>${message}</span>
  `;
  document.body.appendChild(toast);
  setTimeout(() => toast.classList.add('show'), 10);
  setTimeout(() => { toast.classList.remove('show'); setTimeout(() => toast.remove(), 300); }, 3500);
}

// ── Auth guard ────────────────────────────────────────────────────
function requireAuth() {
  if (!API.getToken() && !window.location.href.includes('login.html')) {
    window.location.href = 'login.html';
  }
}

// ── Format helpers ────────────────────────────────────────────────
function formatCurrency(val) {
  if (val == null) return '—';
  return '₵' + parseFloat(val).toLocaleString('en-GH', { minimumFractionDigits: 2 });
}
function formatDate(str) {
  if (!str) return '—';
  return new Date(str).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' });
}
function statusBadge(status) {
  const map = {
    PENDING:          'badge-warning',
    APPROVED:         'badge-success',
    REJECTED:         'badge-danger',
    ACTIVE:           'badge-success',
    INACTIVE:         'badge-muted',
    CANCELLED:        'badge-danger',
    DELIVERED:        'badge-success',
    PROCESSING:       'badge-info',
    SHIPPED:          'badge-info',
    IN_STOCK:         'badge-success',
    OUT_OF_STOCK:     'badge-danger',
    PRE_ORDER:        'badge-warning',
    COMING_SOON:      'badge-info',
    CONFIRMED:        'badge-success',
    AWAITING_PAYMENT: 'badge-warning',
    COMPLETED:        'badge-success',
    REFUNDED:         'badge-danger',
    LOW_STOCK:        'badge-warning',
    DRAFT:            'badge-muted',
  };
  const cls = map[status] || 'badge-muted';
  return `<span class="badge ${cls}">${status?.replace(/_/g,' ') || '—'}</span>`;
}