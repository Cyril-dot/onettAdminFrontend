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
    if (!isFormData) headers['Content-Type'] = 'application/json';
    const token = getToken();
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const opts = { method, headers };
    if (body && !isFormData) opts.body = JSON.stringify(body);
    if (body &&  isFormData) opts.body = body;

    try {
      const res = await fetch(`${BASE}${path}`, opts);
      let data;
      const ct = res.headers.get('content-type') || '';
      if (ct.includes('application/json')) {
        data = await res.json();
      } else {
        data = { message: await res.text() };
      }

      // ── Debug logging for non-2xx responses ──────────────────
      if (!res.ok) {
        console.warn(
          `[API] ${method} ${path} → ${res.status}`,
          '\nResponse:', data
        );
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
  //
  //  updateOrderStatus: PATCH /api/v1/orders/admin/{id}/status
  //  Controller expects: @RequestBody Map<String, String> payload
  //  with key "status" — e.g. { "status": "SHIPPED" }
  //
  //  FIX: explicitly pass Content-Type and stringify body so Spring
  //  can deserialize the Map<String, String> correctly.
  //  If the server returns 400 "Cannot update a cancelled order" or
  //  "Order already delivered" that is a service-layer business rule,
  //  not a request format issue — surface the message to the UI.
  // ══════════════════════════════════════════════════════════════
  const getAllOrders      = (status) => get(`/api/v1/orders/admin/all${status ? `?status=${status}` : ''}`);
  const getOrderById      = (id)     => get(`/api/v1/orders/admin/${id}`);

  /**
   * updateOrderStatus(id, status)
   * PATCH /api/v1/orders/admin/{id}/status
   * Body: { "status": "SHIPPED" }   ← Map<String,String> on the controller
   */
  async function updateOrderStatus(id, status) {
    console.log(`[API] updateOrderStatus → orderId=${id}  newStatus=${status}`);
    const res = await patch(`/api/v1/orders/admin/${id}/status`, { status });
    if (!res.ok) {
      // Surface the exact Spring error message so the UI toast is informative
      const msg = res.data?.message ?? res.data?.data?.message ?? `HTTP ${res.status}`;
      console.warn(`[API] updateOrderStatus failed [${res.status}]: ${msg}`);
    }
    return res;
  }

  const cancelOrderByAdmin = (id) => patch(`/api/v1/orders/admin/${id}/cancel`);
  const getOrderSummary    = ()   => get('/api/v1/orders/admin/summary');
  const getOrdersToday     = ()   => get('/api/v1/orders/admin/today');
  const getOrdersThisWeek  = ()   => get('/api/v1/orders/admin/this-week');
  const getOrdersThisMonth = ()   => get('/api/v1/orders/admin/this-month');
  const getDailyCounts     = ()   => get('/api/v1/orders/admin/daily-counts');
  const getSellerOrders    = (status) => get(`/api/v1/orders/seller/orders${status ? `?status=${status}` : ''}`);
  const getSellerRevenue   = ()   => get('/api/v1/orders/seller/revenue');

  // ══════════════════════════════════════════════════════════════
  //  PAYMENTS — ORDER PAYMENTS
  //  Base: /api/v1/payments/orders
  // ══════════════════════════════════════════════════════════════

  /** getAllOrderPayments() — GET /api/v1/payments/orders/admin/all */
  const getAllOrderPayments = () => get('/api/v1/payments/orders/admin/all');

  /** getOrderPaymentsByStatus(status) — GET /api/v1/payments/orders/admin?status=PENDING */
  const getOrderPaymentsByStatus = (status) => get(`/api/v1/payments/orders/admin?status=${status}`);

  /** getOrderPaymentByOrderId(orderId) — GET /api/v1/payments/orders/admin/order/{orderId} */
  const getOrderPaymentByOrderId = (orderId) => get(`/api/v1/payments/orders/admin/order/${orderId}`);

  /** getOrderPaymentById(paymentId) — GET /api/v1/payments/orders/admin/{paymentId} */
  const getOrderPaymentById = (paymentId) => get(`/api/v1/payments/orders/admin/${paymentId}`);

  /**
   * confirmOrderPayment(orderId, adminNote?)
   * POST /api/v1/payments/orders/admin/{orderId}/confirm?adminNote=...
   */
  const confirmOrderPayment = (orderId, adminNote) =>
    post(`/api/v1/payments/orders/admin/${orderId}/confirm${adminNote ? `?adminNote=${encodeURIComponent(adminNote)}` : ''}`);

  /**
   * rejectOrderPayment(orderId, adminNote?)
   * POST /api/v1/payments/orders/admin/{orderId}/reject?adminNote=...
   */
  const rejectOrderPayment = (orderId, adminNote) =>
    post(`/api/v1/payments/orders/admin/${orderId}/reject${adminNote ? `?adminNote=${encodeURIComponent(adminNote)}` : ''}`);

  // ══════════════════════════════════════════════════════════════
  //  PAYMENTS — PRODUCT LISTING PAYMENTS
  //  Base: /api/v1/payments/product-listing
  // ══════════════════════════════════════════════════════════════

  /** getAllListingPayments(page, size) — GET /api/v1/payments/product-listing/admin/all */
  const getAllListingPayments = (page = 0, size = 20) =>
    get(`/api/v1/payments/product-listing/admin/all?page=${page}&size=${size}`);

  /** getListingPaymentsByStatus(status, page, size) — GET /api/v1/payments/product-listing/admin?status=PENDING */
  const getListingPaymentsByStatus = (status, page = 0, size = 20) =>
    get(`/api/v1/payments/product-listing/admin?status=${status}&page=${page}&size=${size}`);

  /** getListingPaymentById(productRequestId) — GET /api/v1/payments/product-listing/admin/{id} */
  const getListingPaymentById = (productRequestId) =>
    get(`/api/v1/payments/product-listing/admin/${productRequestId}`);

  /** getListingPaymentCounts() — GET /api/v1/payments/product-listing/admin/counts */
  const getListingPaymentCounts = () => get('/api/v1/payments/product-listing/admin/counts');

  /**
   * confirmListingPayment(productRequestId)
   * POST /api/v1/payments/product-listing/admin/{productRequestId}/confirm
   */
  const confirmListingPayment = (productRequestId) =>
    post(`/api/v1/payments/product-listing/admin/${productRequestId}/confirm`);

  /**
   * rejectListingPayment(productRequestId, reason?)
   * POST /api/v1/payments/product-listing/admin/{productRequestId}/reject?reason=...
   */
  const rejectListingPayment = (productRequestId, reason) =>
    post(`/api/v1/payments/product-listing/admin/${productRequestId}/reject${reason ? `?reason=${encodeURIComponent(reason)}` : ''}`);

  // ══════════════════════════════════════════════════════════════
  //  CATEGORIES (Seller) — multipart/form-data
  // ══════════════════════════════════════════════════════════════
  const createCategory      = (formData)             => request('POST', '/api/v1/seller/categories', formData, true);
  const updateCategory      = (categoryId, formData) => request('PUT', `/api/v1/seller/categories/${categoryId}`, formData, true);
  const deleteCategory      = (categoryId)           => del(`/api/v1/seller/categories/${categoryId}`);
  const getSellerCategories = ()                     => get('/api/v1/seller/categories');

  // ══════════════════════════════════════════════════════════════
  //  PRODUCTS (Seller)
  // ══════════════════════════════════════════════════════════════
  const addProduct         = (formData)            => request('POST', '/api/v1/seller/products', formData, true);
  const updateProduct      = (productId, formData) => request('PUT', `/api/v1/seller/products/${productId}`, formData, true);
  const replaceAllImages   = (productId, formData) => request('PUT', `/api/v1/seller/products/${productId}/images/replace`, formData, true);
  const uploadProductVideo = (productId, formData) => request('POST', `/api/v1/seller/products/${productId}/video`, formData, true);
  const deleteProductVideo = (productId)           => del(`/api/v1/seller/products/${productId}/video`);

  const getMyProducts         = ()              => get('/api/v1/seller/products');
  const getProductsByStatus   = (status)        => get(`/api/v1/seller/products/by-status?status=${status}`);
  const getProductDetails     = (id)            => get(`/api/v1/seller/products/${id}`);
  const getTrendingProducts   = ()              => get('/api/v1/seller/products/trending');
  const getDiscountedProducts = ()              => get('/api/v1/seller/products/discounted');
  const getLowStockProducts   = (threshold = 5) => get(`/api/v1/seller/products/low-stock?threshold=${threshold}`);
  const searchProducts        = (params)        => get(`/api/v1/seller/products/search?${new URLSearchParams(params)}`);
  const globalSearch          = (kw)            => get(`/api/v1/seller/products/global-search?keyword=${encodeURIComponent(kw)}`);

  const updateStock         = (id, stock)                        => patch(`/api/v1/seller/products/${id}/stock?stock=${stock}`);
  const updateProductStatus = (id, status)                       => patch(`/api/v1/seller/products/${id}/status?status=${status}`);
  const updateStockStatus   = (id, stockStatus, availableInDays) =>
    patch(`/api/v1/seller/products/${id}/stock-status?stockStatus=${stockStatus}${availableInDays != null ? `&availableInDays=${availableInDays}` : ''}`);

  const deleteProduct = (id) => del(`/api/v1/seller/products/${id}`);

  // ══════════════════════════════════════════════════════════════
  //  USER-SUBMITTED PRODUCTS (Approval Workflow)
  // ══════════════════════════════════════════════════════════════
  const getAllProductRequests      = ()                          => get('/api/v1/user-products/seller/all');
  const getProductRequestsByStatus = (status, page = 0, size = 10) =>
    get(`/api/v1/user-products/seller/by-status?status=${status}&page=${page}&size=${size}`);
  const getRecentProductRequests   = (page = 0, size = 10)      =>
    get(`/api/v1/user-products/seller/recent?page=${page}&size=${size}`);
  const getProductRequestById      = (id)                       => get(`/api/v1/user-products/seller/requests/${id}`);
  const updateProductApproval      = (id, status)               =>
    patch(`/api/v1/user-products/seller/requests/${id}/status`, { status });

  // ══════════════════════════════════════════════════════════════
  //  PRE-ORDERS
  // ══════════════════════════════════════════════════════════════
  const getAllActivePreOrders = ()          => get('/api/pre-orders/seller/all');
  const getPreOrdersByProduct = (pid)       => get(`/api/pre-orders/seller/product/${pid}`);
  const getPreOrdersByStatus  = (status)    => get(`/api/pre-orders/seller/status/${status}`);
  const confirmSecondPayment  = (id, note)  =>
    post(`/api/pre-orders/seller/${id}/confirm-payment`, note ? { adminNote: note } : {});

  // ══════════════════════════════════════════════════════════════
  //  AI TOOLS
  // ══════════════════════════════════════════════════════════════
  const analyzeTrends     = () => get('/api/v1/ai/trends');
  const generateListing   = (productName, basicDetails) =>
    post(`/api/v1/ai/seller/generate-listing?productName=${encodeURIComponent(productName)}&basicDetails=${encodeURIComponent(basicDetails)}`);
  const suggestPrice      = (productName, productDetails, condition) =>
    get(`/api/v1/ai/seller/suggest-price?productName=${encodeURIComponent(productName)}&productDetails=${encodeURIComponent(productDetails)}${condition ? `&condition=${condition}` : ''}`);
  const analyzeInventory  = () => get('/api/v1/ai/seller/inventory-analysis');
  const improveVisibility = (productId) => get(`/api/v1/ai/seller/improve-visibility/${productId}`);

  // ══════════════════════════════════════════════════════════════
  //  NOTIFICATIONS — SELLER / ADMIN
  //  Base: /api/v1/notifications/seller
  // ══════════════════════════════════════════════════════════════

  /** getNotifications(unreadOnly?) — GET /api/v1/notifications/seller?unreadOnly=false */
  const getNotifications = (unreadOnly = false) =>
    get(`/api/v1/notifications/seller?unreadOnly=${unreadOnly}`);

  /** getUnreadCount() — GET /api/v1/notifications/seller/unread-count */
  const getUnreadCount = () => get('/api/v1/notifications/seller/unread-count');

  /** markNotifRead(notificationId) — PATCH /api/v1/notifications/seller/{id}/read */
  const markNotifRead = (id) => patch(`/api/v1/notifications/seller/${id}/read`);

  /** markAllNotifsRead() — PATCH /api/v1/notifications/seller/read-all */
  const markAllNotifsRead = () => patch('/api/v1/notifications/seller/read-all');

  /** registerSellerFcmToken(fcmToken) — POST /api/v1/notifications/seller/fcm-token */
  const registerSellerFcmToken = (fcmToken) =>
    post('/api/v1/notifications/seller/fcm-token', { fcmToken });

  // ══════════════════════════════════════════════════════════════
  //  CHAT / CONVERSATIONS
  // ══════════════════════════════════════════════════════════════
  const getSellerConversations = (unreadOnly = false) =>
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
    // order payments
    getAllOrderPayments, getOrderPaymentsByStatus, getOrderPaymentByOrderId,
    getOrderPaymentById, confirmOrderPayment, rejectOrderPayment,
    // listing payments
    getAllListingPayments, getListingPaymentsByStatus, getListingPaymentById,
    getListingPaymentCounts, confirmListingPayment, rejectListingPayment,
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
    // notifications (seller/admin)
    getNotifications, getUnreadCount, markNotifRead, markAllNotifsRead, registerSellerFcmToken,
    // chat
    getSellerConversations, getSellerInbox, getSellerUnreadCount, getChatHistory,
  };
})();

// ═══════════════════════════════════════════════════════════════════
//  TOAST NOTIFICATION UTILITY
// ═══════════════════════════════════════════════════════════════════
function showToast(message, type = 'success') {
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.innerHTML = `
    <span class="material-symbols-rounded">${
      type === 'success' ? 'check_circle' : type === 'error' ? 'error' : 'info'
    }</span>
    <span>${message}</span>
  `;
  document.body.appendChild(toast);
  setTimeout(() => toast.classList.add('show'), 10);
  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => toast.remove(), 300);
  }, 3500);
}

// ═══════════════════════════════════════════════════════════════════
//  AUTH GUARD
// ═══════════════════════════════════════════════════════════════════
function requireAuth() {
  if (!API.getToken() && !window.location.href.includes('login.html')) {
    window.location.href = 'login.html';
  }
}

// ═══════════════════════════════════════════════════════════════════
//  FORMAT HELPERS
// ═══════════════════════════════════════════════════════════════════
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
  return `<span class="badge ${cls}">${status?.replace(/_/g, ' ') || '—'}</span>`;
}