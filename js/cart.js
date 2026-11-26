/* Shared catalog, cart, and settings backed by Data.json and LocalStorage. */
(function () {
  var KEYS = {
    products: "mhcs_products",
    cart: "mhcs_cart",
    settings: "mhcs_settings",
    customer: "mhcs_customer",
    dirty: "mhcs_dirty"
  };

  var SEED = [
    { id: "p1", name: "Tok Jhal Chocolate (150 pcs)", price: 120, stock: 5, category: "Jars", icon: "🍫", image: "assets/images/p1.jpg", description: "Spiced chocolate bites, packed 150 pieces to a jar." },
    { id: "p2", name: "Pate Labu Chocolate (175 pcs)", price: 120, stock: 1, category: "Jars", icon: "🍫", image: "assets/images/p2.jpg", description: "Pumpkin-kissed chocolate, 175 pieces per jar." },
    { id: "p3", name: "Doi Motka Chocolate (150 pcs)", price: 120, stock: 1, category: "Jars", icon: "🍬", image: "assets/images/p3.jpg", description: "Creamy yogurt-style chocolate, 150 pieces in a jar." },
    { id: "p4", name: "Frutle Jelly Chocolate (150 pcs)", price: 120, stock: 5, category: "Jelly", icon: "🌰", image: "assets/images/p4.jpg", description: "Fruit jelly centers wrapped in chocolate, 150 pieces." },
    { id: "p5", name: "Tulse Jelly (smoll)", price: 45, stock: 3, category: "Jelly", icon: "🍬", image: "assets/images/p5.jpg", description: "Small tulsi jelly sweets." },
    { id: "p6", name: "Mint Fresh (100 pcs)", price: 120, stock: 3, category: "Candy", icon: "🌿", image: "assets/images/p6.jpg", description: "Cool mint chocolates, 100 pieces." },
    { id: "p7", name: "Tik Tik (100 pcs)", price: 150, stock: 1, category: "Candy", icon: "🍬", image: "assets/images/p7.jpg", description: "Crunchy bite-size chocolates, 100 pieces." },
    { id: "p8", name: "Fan + Candy (12 pcs)", price: 45, stock: 5, category: "Combo", icon: "🍭", image: "assets/images/p8.jpg", description: "A small fan packed with candies, 12 pieces." },
    { id: "p9", name: "Dairy Roll (5/-)", price: 120, stock: 15, category: "Bars", icon: "🍫", image: "assets/images/p9.jpg", description: "Chocolate flavoured wafer rolls." },
    { id: "p10", name: "Cara Star (31 pcs)", price: 120, stock: 7, category: "Candy", icon: "⭐", image: "assets/images/p10.jpg", description: "Star-shaped sweets, 31 pieces." },
    { id: "p11", name: "Choco Moco", price: 120, stock: 26, category: "Chocolate", icon: "🍫", image: "assets/images/p11.jpg", description: "Rich cocoa chocolate." }
  ];

  var DEFAULT_SETTINGS = {
    shopName: "M.H Chocolate Shop",
    whatsapp: "916296609958",
    currency: "₹"
  };

  var state = {
    products: null,
    cart: null,
    settings: null,
    customer: null,
    dataSource: "seed"
  };

  var listeners = [];

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function readJSON(key) {
    try {
      var raw = localStorage.getItem(key);
      if (!raw) return null;
      return JSON.parse(raw);
    } catch (err) {
      return null;
    }
  }

  function writeJSON(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (err) {
      return false;
    }
  }

  function notify() {
    listeners.slice().forEach(function (fn) {
      try { fn(); } catch (err) { /* ignore listener errors */ }
    });
  }

  function onChange(fn) {
    if (typeof fn !== "function") return function () {};
    listeners.push(fn);
    return function () {
      listeners = listeners.filter(function (item) { return item !== fn; });
    };
  }

  function isDirty() {
    try {
      return localStorage.getItem(KEYS.dirty) === "1";
    } catch (err) {
      return false;
    }
  }

  function setDirty(flag) {
    try {
      if (flag) localStorage.setItem(KEYS.dirty, "1");
      else localStorage.removeItem(KEYS.dirty);
    } catch (err) { /* ignore */ }
  }

  function normalizeProduct(product, idx) {
    var item = product && typeof product === "object" ? product : {};
    var hasNumericStock = typeof item.stock === "number" && isFinite(item.stock);
    var parsedStock = hasNumericStock
      ? Math.max(0, Math.floor(item.stock))
      : (item.stock !== undefined && item.stock !== null && item.stock !== "" && isFinite(Number(item.stock))
        ? Math.max(0, Math.floor(Number(item.stock)))
        : 20);
    return {
      id: String(item.id || ("p" + (idx + 1))),
      name: String(item.name || "Untitled sweet").trim(),
      price: Math.max(0, Number(item.price) || 0),
      stock: parsedStock,
      category: String(item.category || "Chocolate").trim() || "Chocolate",
      icon: String(item.icon || "").trim(),
      image: String(item.image || "").trim(),
      description: String(item.description || "").trim()
    };
  }

  function normalizeData(data) {
    var src = data && typeof data === "object" ? data : {};
    var nextSettings = {
      shopName: String(src.shop || src.shopName || DEFAULT_SETTINGS.shopName).trim() || DEFAULT_SETTINGS.shopName,
      whatsapp: String(src.whatsapp || DEFAULT_SETTINGS.whatsapp).replace(/\D/g, "") || DEFAULT_SETTINGS.whatsapp,
      currency: String(src.currency || DEFAULT_SETTINGS.currency).trim().slice(0, 4) || DEFAULT_SETTINGS.currency
    };
    var rawProducts = Array.isArray(src.products) ? src.products : seedProducts();
    var seen = {};
    var nextProducts = rawProducts.map(function (item, idx) {
      var norm = normalizeProduct(item, idx);
      while (seen[norm.id]) norm.id = norm.id + "_" + idx;
      seen[norm.id] = true;
      return norm;
    });
    return { settings: nextSettings, products: nextProducts };
  }

  function seedProducts() {
    return clone(SEED);
  }

  function ensure() {
    var products = readJSON(KEYS.products);
    var settings = readJSON(KEYS.settings);
    var cart = readJSON(KEYS.cart);
    var customer = readJSON(KEYS.customer);

    state.products = Array.isArray(products)
      ? products.map(normalizeProduct)
      : seedProducts();
    state.settings = settings && typeof settings === "object"
      ? Object.assign({}, DEFAULT_SETTINGS, settings)
      : clone(DEFAULT_SETTINGS);
    state.cart = cart && typeof cart === "object" && !Array.isArray(cart) ? cart : {};
    state.customer = customer && typeof customer === "object"
      ? { name: customer.name || "", phone: customer.phone || "", address: customer.address || "" }
      : { name: "", phone: "", address: "" };

    if (!Array.isArray(products)) writeJSON(KEYS.products, state.products);
    if (!settings) writeJSON(KEYS.settings, state.settings);
    if (!cart) writeJSON(KEYS.cart, state.cart);
    clampCart();
  }

  function products() {
    return state.products;
  }

  function saveProducts(list, options) {
    var opts = options || {};
    state.products = Array.isArray(list) ? list.map(normalizeProduct) : [];
    var ok = writeJSON(KEYS.products, state.products);
    if (opts.dirty !== undefined) setDirty(Boolean(opts.dirty));
    clampCart();
    notify();
    return ok;
  }

  function settings() {
    return state.settings;
  }

  function saveSettings(next, options) {
    var opts = options || {};
    state.settings = Object.assign({}, DEFAULT_SETTINGS, next);
    if (!state.settings.currency) state.settings.currency = "₹";
    var ok = writeJSON(KEYS.settings, state.settings);
    if (opts.dirty !== undefined) setDirty(Boolean(opts.dirty));
    notify();
    return ok;
  }

  function applyData(data, options) {
    var opts = options || {};
    var normalized = normalizeData(data);
    state.settings = normalized.settings;
    state.products = normalized.products;
    if (opts.source) state.dataSource = opts.source;
    var ok1 = true;
    var ok2 = true;
    if (!opts.skipStorage) {
      ok1 = writeJSON(KEYS.settings, state.settings);
      ok2 = writeJSON(KEYS.products, state.products);
    }
    if (opts.dirty !== undefined) setDirty(Boolean(opts.dirty));
    clampCart();
    notify();
    return ok1 && ok2;
  }

  function exportData() {
    var currentSettings = state.settings || clone(DEFAULT_SETTINGS);
    var currentProducts = state.products || seedProducts();
    return {
      shop: currentSettings.shopName || DEFAULT_SETTINGS.shopName,
      whatsapp: currentSettings.whatsapp || DEFAULT_SETTINGS.whatsapp,
      currency: currentSettings.currency || DEFAULT_SETTINGS.currency,
      products: currentProducts.map(function (p, idx) {
        var norm = normalizeProduct(p, idx);
        var out = {
          id: norm.id,
          name: norm.name,
          price: norm.price,
          stock: norm.stock,
          category: norm.category
        };
        if (norm.icon) out.icon = norm.icon;
        if (norm.image) out.image = norm.image;
        if (norm.description) out.description = norm.description;
        return out;
      })
    };
  }

  function fetchJsonFile(filename) {
    return fetch(filename + "?t=" + Date.now(), { cache: "no-store" }).then(function (res) {
      if (!res.ok) throw new Error("HTTP " + res.status);
      return res.json().then(function (json) {
        return { file: filename, data: json };
      });
    });
  }

  function loadRemoteData(force) {
    if (!force && isDirty()) {
      return Promise.resolve({ loaded: false, reason: "dirty" });
    }
    return fetchJsonFile("Data.json").catch(function () {
      return fetchJsonFile("data.json");
    }).then(function (result) {
      applyData(result.data, { dirty: false, source: result.file });
      return { loaded: true, file: result.file, data: result.data };
    }).catch(function (err) {
      return { loaded: false, reason: "fetch_failed", error: err };
    });
  }

  function saveToLocalServer(data) {
    var payload = JSON.stringify(data || exportData());
    return fetch("Data.json", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: payload
    }).then(function (res) {
      if (!res.ok) throw new Error("HTTP " + res.status);
      return res.json().catch(function () { return { ok: true }; });
    }).then(function () {
      state.dataSource = "Data.json";
      setDirty(false);
      return { ok: true };
    }).catch(function (err) {
      return { ok: false, error: err };
    });
  }

  function dataSource() {
    return state.dataSource;
  }

  function cart() {
    return state.cart;
  }

  function saveCart(next) {
    state.cart = next;
    return writeJSON(KEYS.cart, next);
  }

  function customer() {
    return state.customer;
  }

  function saveCustomer(next) {
    state.customer = {
      name: next.name || "",
      phone: next.phone || "",
      address: next.address || ""
    };
    return writeJSON(KEYS.customer, state.customer);
  }

  function findProduct(id) {
    for (var i = 0; i < state.products.length; i++) {
      if (state.products[i].id === id) return state.products[i];
    }
    return null;
  }

  function clampCart() {
    var next = {};
    var changed = false;
    Object.keys(state.cart).forEach(function (id) {
      var product = findProduct(id);
      var qty = Math.floor(Number(state.cart[id]) || 0);
      if (!product) {
        changed = true;
        return;
      }
      var stock = Math.max(0, Math.floor(Number(product.stock) || 0));
      var safe = Math.min(Math.max(0, qty), stock);
      if (safe !== state.cart[id]) changed = true;
      if (safe > 0) next[id] = safe;
    });
    if (changed || Object.keys(next).length !== Object.keys(state.cart).length) {
      state.cart = next;
      writeJSON(KEYS.cart, next);
    }
  }

  function lines() {
    clampCart();
    return Object.keys(state.cart).map(function (id) {
      var product = findProduct(id);
      return {
        id: product.id,
        name: product.name,
        price: Number(product.price) || 0,
        qty: state.cart[id],
        image: product.image || "",
        stock: Math.floor(Number(product.stock) || 0)
      };
    });
  }

  function totals() {
    var items = lines();
    return {
      items: items,
      qty: items.reduce(function (sum, item) { return sum + item.qty; }, 0),
      amount: items.reduce(function (sum, item) { return sum + item.qty * item.price; }, 0)
    };
  }

  function add(id) {
    var product = findProduct(id);
    if (!product) return false;
    var stock = Math.floor(Number(product.stock) || 0);
    var qty = state.cart[id] || 0;
    if (stock <= 0 || qty >= stock) return false;
    state.cart[id] = qty + 1;
    saveCart(state.cart);
    return true;
  }

  function setQty(id, qty) {
    var product = findProduct(id);
    if (!product) return;
    var stock = Math.floor(Number(product.stock) || 0);
    var next = Math.floor(Number(qty) || 0);
    if (next <= 0) delete state.cart[id];
    else state.cart[id] = Math.min(next, stock);
    saveCart(state.cart);
  }

  function remove(id) {
    delete state.cart[id];
    saveCart(state.cart);
  }

  function clearCart() {
    state.cart = {};
    saveCart(state.cart);
  }

  function money(amount) {
    var currency = (state.settings && state.settings.currency) || "₹";
    var value = Number(amount) || 0;
    var formatted = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 2 }).format(value);
    return currency + formatted;
  }

  function esc(value) {
    return String(value == null ? "" : value).replace(/[&<>"']/g, function (ch) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch];
    });
  }

  function safeSrc(src) {
    var value = String(src || "").trim();
    if (!value) return "";
    if (value.indexOf("assets/") === 0 || value.indexOf("data:image/") === 0 || /^https?:\/\//i.test(value)) return value;
    return "";
  }

  function orderMessage() {
    var info = totals();
    var shop = state.settings.shopName || DEFAULT_SETTINGS.shopName;
    var person = state.customer;
    var blocks = info.items.map(function (item) {
      return item.name + " × " + item.qty + " = " + money(item.qty * item.price);
    });
    return [
      "Hello " + shop + ",",
      "",
      "New Order",
      "",
      "Name: " + person.name.trim(),
      "Phone: " + person.phone.trim(),
      "",
      "Address:",
      person.address.trim(),
      "",
      "Items:",
      "",
      blocks.join("\n\n"),
      "",
      "Total Quantity: " + info.qty,
      "Total Amount: " + money(info.amount),
      "",
      "Please confirm my order."
    ].join("\n");
  }

  function whatsappUrl() {
    var digits = String(state.settings.whatsapp || "").replace(/\D/g, "");
    if (!digits) return "";
    return "https://wa.me/" + digits + "?text=" + encodeURIComponent(orderMessage());
  }

  window.MH = {
    ensure: ensure,
    products: products,
    saveProducts: saveProducts,
    settings: settings,
    saveSettings: saveSettings,
    applyData: applyData,
    exportData: exportData,
    loadRemoteData: loadRemoteData,
    saveToLocalServer: saveToLocalServer,
    dataSource: dataSource,
    isDirty: isDirty,
    setDirty: setDirty,
    onChange: onChange,
    customer: customer,
    saveCustomer: saveCustomer,
    lines: lines,
    totals: totals,
    add: add,
    setQty: setQty,
    remove: remove,
    clearCart: clearCart,
    money: money,
    esc: esc,
    safeSrc: safeSrc,
    whatsappUrl: whatsappUrl,
    seedProducts: seedProducts,
    qtyOf: function (id) { return state.cart[id] || 0; }
  };
})();
