/* Customer storefront: browse, cart, and WhatsApp checkout. */
(function () {
  var query = "";
  var category = "All";
  var orderOpen = false;
  var orderJustCompleted = false;

  function stockClass(stock) {
    if (stock <= 0) return "stock out";
    if (stock <= 5) return "stock low";
    return "stock";
  }

  function stockLabel(stock) {
    if (stock <= 0) return "Out of stock";
    return "In stock: " + stock;
  }

  function visibleProducts() {
    var q = query.trim().toLowerCase();
    return MH.products().filter(function (product) {
      var hay = (product.name + " " + (product.category || "") + " " + (product.description || "")).toLowerCase();
      var matchesQuery = !q || hay.indexOf(q) !== -1;
      var matchesCategory = category === "All" || product.category === category;
      return matchesQuery && matchesCategory;
    });
  }

  function categories() {
    var found = {};
    MH.products().forEach(function (product) {
      if (product.category) found[product.category] = true;
    });
    return ["All"].concat(Object.keys(found).sort());
  }

  function renderCategories() {
    var cats = categories();
    if (cats.indexOf(category) === -1) category = "All";
    document.getElementById("cats").innerHTML = cats.map(function (name) {
      var pressed = name === category ? "true" : "false";
      return '<button type="button" class="chip" data-cat="' + MH.esc(name) + '" aria-pressed="' + pressed + '">' + MH.esc(name) + "</button>";
    }).join("");
  }

  function card(product, index) {
    var stock = Math.max(0, Math.floor(Number(product.stock) || 0));
    var qty = MH.qtyOf(product.id);
    var src = MH.safeSrc(product.image);
    var fallbackLabel = product.icon || "MH";
    var media = src
      ? '<img src="' + MH.esc(src) + '" alt="' + MH.esc(product.name) + '" data-fallback="' + MH.esc(fallbackLabel) + '" loading="lazy" decoding="async">'
      : '<div class="ph" role="img" aria-label="Product photo">' + MH.esc(fallbackLabel) + "</div>";
    var controls = qty > 0
      ? '<div class="qty"><div class="stepper"><button type="button" data-act="dec" data-id="' + MH.esc(product.id) + '" aria-label="Decrease quantity">−</button><b>' + qty + '</b><button type="button" data-act="inc" data-id="' + MH.esc(product.id) + '" aria-label="Increase quantity"' + (qty >= stock ? " disabled" : "") + '>+</button></div><button type="button" class="linkish" data-act="remove" data-id="' + MH.esc(product.id) + '">Remove</button></div>'
      : "";
    var adminActive = window.MHAdmin && window.MHAdmin.isActive && window.MHAdmin.isActive();
    var adminControls = adminActive
      ? '<div class="card-admin" aria-label="Admin item controls">' +
        '<button type="button" class="card-admin-btn" data-admin-act="stock-dec" data-id="' + MH.esc(product.id) + '" title="Decrease stock">−1</button>' +
        '<button type="button" class="card-admin-btn" data-admin-act="stock-inc" data-id="' + MH.esc(product.id) + '" title="Increase stock">+1</button>' +
        '<button type="button" class="card-admin-btn primary" data-admin-act="edit" data-id="' + MH.esc(product.id) + '">Edit</button>' +
        '<button type="button" class="card-admin-btn danger" data-admin-act="del" data-id="' + MH.esc(product.id) + '">Delete</button>' +
        "</div>"
      : "";
    return '<article class="card" style="animation-delay:' + Math.min(index, 8) * 40 + 'ms">' +
      '<div class="card-media">' + media + '<span class="pill">' + MH.esc(product.category || "Sweet") + "</span></div>" +
      '<div class="card-body"><h3>' + MH.esc(product.name) + "</h3>" +
      (product.description ? '<p class="desc">' + MH.esc(product.description) + "</p>" : "") +
      '<div class="meta"><span class="price">' + MH.esc(MH.money(product.price)) + '</span><span class="' + stockClass(stock) + '">' + stockLabel(stock) + "</span></div>" +
      '<button type="button" class="btn" data-act="add" data-id="' + MH.esc(product.id) + '"' + (stock <= 0 || qty >= stock ? " disabled" : "") + ">Add to Cart</button>" +
      controls + adminControls + "</div></article>";
  }

  function renderGrid() {
    renderCategories();
    var list = visibleProducts();
    var grid = document.getElementById("grid");
    document.getElementById("result-count").textContent = list.length + (list.length === 1 ? " product" : " products");
    grid.innerHTML = list.length
      ? list.map(card).join("")
      : '<p class="empty">Nothing on the shelf matches that search.</p>';
  }

  function renderChrome() {
    var shop = MH.settings().shopName || "M.H Chocolate Shop";
    document.title = shop;
    document.querySelectorAll("[data-shop]").forEach(function (node) { node.textContent = shop; });
    var shelf = document.getElementById("shelf-count");
    if (shelf) shelf.textContent = String(MH.products().length);
    var info = MH.totals();
    document.getElementById("cart-count").textContent = String(info.qty);
    document.getElementById("float-count").textContent = String(info.qty);
    document.getElementById("cart-count").hidden = info.qty === 0;
  }

  function renderSummary() {
    var box = document.getElementById("order-summary");
    if (!box) return;
    var info = MH.totals();
    if (!info.qty) {
      if (orderJustCompleted) {
        var shop = MH.settings().shopName || "M.H Chocolate Shop";
        box.innerHTML = '<div class="note order-done" role="status"><strong>Order sent!</strong> Your cart is now empty. Thank you for ordering from ' + MH.esc(shop) + '.</div>';
      } else {
        box.innerHTML = '<p class="empty">Your cart is empty. Add a chocolate to start an order.</p>';
      }
      var send = document.getElementById("send-order");
      if (send) send.disabled = true;
      return;
    }
    var pendingHtml = MH.hasPendingOrder()
      ? '<div class="order-confirm" role="region" aria-label="Confirm WhatsApp order">' +
        '<p class="order-confirm-title">Did you send this order on WhatsApp?</p>' +
        '<p class="order-confirm-text">Confirm if you completed the order to empty your cart, or keep these items if you did not send it.</p>' +
        '<div class="order-confirm-actions">' +
        '<button type="button" class="btn" data-act="confirm-sent">Yes, Order Sent</button>' +
        '<button type="button" class="btn secondary" data-act="keep-cart">No, Keep in Cart</button>' +
        '</div></div>'
      : "";
    var rows = info.items.map(function (item) {
      return '<div class="line"><div><b>' + MH.esc(item.name) + '</b><div class="stock">' + MH.esc(MH.money(item.price)) + ' each</div></div>' +
        '<div class="line-actions"><div class="stepper"><button type="button" data-act="dec" data-id="' + MH.esc(item.id) + '" aria-label="Decrease quantity">−</button><b>' + item.qty + '</b><button type="button" data-act="inc" data-id="' + MH.esc(item.id) + '" aria-label="Increase quantity"' + (item.qty >= item.stock ? " disabled" : "") + '>+</button></div>' +
        '<b>' + MH.esc(MH.money(item.qty * item.price)) + '</b><button type="button" class="linkish" data-act="remove" data-id="' + MH.esc(item.id) + '">Remove</button></div></div>';
    }).join("");
    box.innerHTML = pendingHtml + rows +
      '<div class="totals"><span>Total quantity</span><span>' + info.qty + "</span></div>" +
      '<div class="totals grand"><span>Total amount</span><span>' + MH.esc(MH.money(info.amount)) + "</span></div>";
    var send = document.getElementById("send-order");
    if (send) send.disabled = false;
  }

  function openOrder() {
    orderOpen = true;
    var root = document.getElementById("modal-root");
    var person = MH.customer();
    root.hidden = false;
    root.innerHTML = '<div class="modal" id="order-modal"><form class="sheet" id="order-form">' +
      '<button type="button" class="close" data-act="close" aria-label="Close">×</button>' +
      "<h2>Your order</h2><p class=\"sheet-lead\">Send the details to the shop on WhatsApp. No payment is taken on this page.</p>" +
      '<div id="order-summary"></div>' +
      '<label class="field"><span>Customer name</span><input id="cust-name" name="name" autocomplete="name" required value="' + MH.esc(person.name) + '"></label>' +
      '<label class="field"><span>Phone number</span><input id="cust-phone" name="phone" type="tel" inputmode="tel" autocomplete="tel" required value="' + MH.esc(person.phone) + '"></label>' +
      '<label class="field"><span>Delivery address</span><textarea id="cust-address" name="address" required>' + MH.esc(person.address) + "</textarea></label>" +
      '<p class="form-error" id="order-error" role="alert"></p>' +
      '<button type="submit" class="btn full" id="send-order">Send Order On WhatsApp</button></form></div>';
    document.body.classList.add("lock");
    renderSummary();
    if (MH.hasPendingOrder()) {
      var sheet = root.querySelector(".sheet");
      if (sheet) sheet.scrollTop = 0;
    } else {
      document.getElementById("cust-name").focus();
    }
  }

  function closeOrder() {
    orderOpen = false;
    orderJustCompleted = false;
    var root = document.getElementById("modal-root");
    root.hidden = true;
    root.innerHTML = "";
    document.body.classList.remove("lock");
  }

  function pulse() {
    var button = document.getElementById("float-cart");
    button.classList.remove("pop");
    void button.offsetWidth;
    button.classList.add("pop");
  }

  function changeQty(act, id) {
    orderJustCompleted = false;
    MH.setPendingOrder(false);
    var before = MH.totals().qty;
    if (act === "add" || act === "inc") {
      var added = MH.add(id);
      if (added && MH.totals().qty > before) pulse();
    } else if (act === "dec") {
      MH.setQty(id, MH.qtyOf(id) - 1);
    } else if (act === "remove") {
      MH.remove(id);
    }
    renderChrome();
    renderGrid();
    if (orderOpen) renderSummary();
  }

  function readCustomerFromForm() {
    return {
      name: document.getElementById("cust-name").value,
      phone: document.getElementById("cust-phone").value,
      address: document.getElementById("cust-address").value
    };
  }

  function syncPendingOrderPrompt() {
    if (!MH.hasPendingOrder()) return;
    if (MH.totals().qty <= 0) {
      MH.setPendingOrder(false);
      return;
    }
    if (!orderOpen) {
      openOrder();
    } else if (!document.querySelector("#order-summary .order-confirm")) {
      renderSummary();
      var sheet = document.querySelector("#order-modal .sheet");
      if (sheet) sheet.scrollTop = 0;
    }
  }

  function sendOrder(event) {
    event.preventDefault();
    var error = document.getElementById("order-error");
    var person = readCustomerFromForm();
    MH.saveCustomer(person);
    var phoneDigits = person.phone.replace(/\D/g, "");
    if (!person.name.trim() || phoneDigits.length < 10 || !person.address.trim()) {
      error.textContent = "Enter your name, a phone number, and the delivery address.";
      return;
    }
    if (!MH.totals().qty) {
      error.textContent = "Add at least one product before sending the order.";
      return;
    }
    var url = MH.whatsappUrl();
    if (!url) {
      error.textContent = "The shop WhatsApp number is missing. Ask the shop to set it in admin settings.";
      return;
    }
    error.textContent = "";
    orderJustCompleted = false;
    MH.setPendingOrder(true);
    setTimeout(syncPendingOrderPrompt, 400);
    window.location.href = url;
  }

  function onClick(event) {
    var button = event.target.closest("[data-act], [data-cat]");
    if (!button) {
      if (event.target.id === "order-modal") closeOrder();
      return;
    }
    if (button.dataset.cat) {
      category = button.dataset.cat;
      renderGrid();
      return;
    }
    var act = button.dataset.act;
    if (act === "close") closeOrder();
    else if (act === "confirm-sent") {
      MH.clearCart();
      orderJustCompleted = true;
      refreshAll();
    } else if (act === "keep-cart") {
      MH.setPendingOrder(false);
      refreshAll();
    } else if (button.dataset.id) changeQty(act, button.dataset.id);
  }

  function refreshAll() {
    renderChrome();
    renderGrid();
    if (orderOpen) renderSummary();
  }

  document.addEventListener("DOMContentLoaded", function () {
    MH.ensure();
    MH.onChange(refreshAll);
    document.getElementById("year").textContent = String(new Date().getFullYear());
    document.getElementById("search-form").addEventListener("submit", function (event) { event.preventDefault(); });
    document.getElementById("search").addEventListener("input", function (event) {
      query = event.target.value;
      renderGrid();
    });
    document.getElementById("view-order").addEventListener("click", openOrder);
    document.getElementById("hero-order").addEventListener("click", openOrder);
    document.getElementById("bag-btn").addEventListener("click", openOrder);
    document.getElementById("float-cart").addEventListener("click", openOrder);
    document.body.addEventListener("click", onClick);
    document.getElementById("modal-root").addEventListener("submit", sendOrder);
    document.getElementById("modal-root").addEventListener("input", function (event) {
      if (!event.target.closest("#order-form")) return;
      MH.saveCustomer(readCustomerFromForm());
    });
    document.addEventListener("keydown", function (event) {
      if (event.key === "Escape" && orderOpen) closeOrder();
    });
    document.addEventListener("error", function (event) {
      var image = event.target;
      if (!image || image.tagName !== "IMG" || !image.closest(".card-media")) return;
      var fallback = document.createElement("div");
      fallback.className = "ph";
      fallback.textContent = image.dataset.fallback || "MH";
      image.replaceWith(fallback);
    }, true);
    refreshAll();
    MH.loadRemoteData(false);
    syncPendingOrderPrompt();
  });

  window.addEventListener("pageshow", syncPendingOrderPrompt);
  window.addEventListener("focus", syncPendingOrderPrompt);
  document.addEventListener("visibilitychange", function () {
    if (document.visibilityState === "visible") syncPendingOrderPrompt();
  });

  window.MHStorefront = {
    refresh: refreshAll
  };
})();
