// ═══════════════════════════════════════════════════════════
//  Shared Layout — renders sidebar + topbar into #app
// ═══════════════════════════════════════════════════════════

function renderLayout(pageTitle, activeNav, contentHtml) {
  const navItems = [
    { href: 'index.html',       icon: 'dashboard',        label: 'Dashboard',        section: 'main' },
    { href: 'orders.html',      icon: 'receipt_long',     label: 'Orders',           section: 'main' },
    { href: 'products.html',    icon: 'inventory_2',      label: 'Products',         section: 'main' },
    { href: 'categories.html',  icon: 'category',         label: 'Categories',       section: 'main' },
    { href: 'requests.html',    icon: 'pending_actions',  label: 'Product Requests', section: 'main' },
    { href: 'preorders.html',   icon: 'schedule',         label: 'Pre-Orders',       section: 'main' },
    { href: 'ai.html',          icon: 'auto_awesome',     label: 'AI Tools',         section: 'tools' },
    { href: 'chat.html',        icon: 'forum',            label: 'Messages',         section: 'tools' },
    { href: 'profile.html',     icon: 'manage_accounts',  label: 'My Profile',       section: 'account' },
  ];

  const sections = { main: 'Main', tools: 'Tools', account: 'Account' };
  const grouped  = {};
  navItems.forEach(n => { if (!grouped[n.section]) grouped[n.section] = []; grouped[n.section].push(n); });

  let navHtml = '';
  for (const [sec, items] of Object.entries(grouped)) {
    navHtml += `<div class="nav-section"><div class="nav-section-label">${sections[sec]}</div>`;
    items.forEach(n => {
      const active = activeNav === n.href ? ' active' : '';
      navHtml += `<a href="${n.href}" class="nav-link${active}">
        <span class="material-symbols-outlined">${n.icon}</span>${n.label}
      </a>`;
    });
    navHtml += '</div>';
  }

  document.getElementById('app').innerHTML = `
    <div class="app-layout">
      <aside class="sidebar" id="sidebar">
        <div class="sidebar-logo">
          <a href="index.html" class="logo-mark">
            <div class="logo-icon"><span class="material-symbols-outlined">storefront</span></div>
            <div class="logo-text">Market<span>Place</span></div>
          </a>
        </div>
        <div class="sidebar-seller">
          <div class="seller-info">
            <div class="seller-avatar" id="sellerAvatar">S</div>
            <div>
              <div class="seller-name" id="sellerName">Loading…</div>
              <div class="seller-role">Seller Admin</div>
            </div>
          </div>
        </div>
        <nav class="sidebar-nav">${navHtml}</nav>
        <div class="sidebar-footer">
          <button class="logout-btn" onclick="API.logout()">
            <span class="material-symbols-outlined">logout</span>
            Sign Out
          </button>
        </div>
      </aside>
      <div class="main-wrap">
        <header class="topbar">
          <div class="topbar-title">${pageTitle}</div>
          <div class="topbar-actions">
            <button class="icon-btn" onclick="window.location.href='notifications.html'" title="Notifications">
              <span class="material-symbols-outlined">notifications</span>
              <div class="notif-badge" id="topbarNotifBadge" style="display:none"></div>
            </button>
            <button class="icon-btn" onclick="window.location.href='chat.html'" title="Messages">
              <span class="material-symbols-outlined">forum</span>
              <div class="notif-badge" id="topbarChatBadge" style="display:none"></div>
            </button>
            <button class="icon-btn" onclick="window.location.href='profile.html'" title="Profile">
              <span class="material-symbols-outlined">manage_accounts</span>
            </button>
          </div>
        </header>
        <main class="page-content">${contentHtml}</main>
      </div>
    </div>
  `;

  // ── Load seller name + avatar in sidebar ──────────────────────
  (async () => {
    const res = await API.sellerMe();
    if (res.ok) {
      const s    = res.data?.data || res.data;
      const name = s?.storeName || s?.businessName || s?.name || 'Seller';
      const el   = document.getElementById('sellerName');
      const av   = document.getElementById('sellerAvatar');
      if (el) el.textContent = name;
      if (av) av.textContent = name.charAt(0).toUpperCase();
    }
  })();

  // ── Load unread badge counts ───────────────────────────────────
  (async () => {
    const [nr, nc] = await Promise.all([
      API.getUnreadCount(),
      API.getSellerUnreadCount(),
    ]);
    const notifBadge = document.getElementById('topbarNotifBadge');
    const chatBadge  = document.getElementById('topbarChatBadge');
    if (notifBadge && nr.ok && (nr.data?.data?.unreadCount ?? 0) > 0) {
      notifBadge.style.display = 'block';
    }
    if (chatBadge && nc.ok && (nc.data?.data?.unreadCount ?? 0) > 0) {
      chatBadge.style.display = 'block';
    }
  })();
}