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
    // Determine saved address mode
    var savedMode = person.addressMode || "map";
    var savedMapLink = person.mapLink || "";
    var savedManual = person.address || "";

    root.hidden = false;
    root.innerHTML = '<div class="modal" id="order-modal"><form class="sheet" id="order-form">' +
      '<button type="button" class="close" data-act="close" aria-label="Close">×</button>' +
      '<h2>Your order</h2><p class="sheet-lead">Send the details to the shop on WhatsApp. No payment is taken on this page.</p>' +
      '<div id="order-summary"></div>' +

      // Customer name
      '<label class="field"><span>Customer name</span><input id="cust-name" name="name" autocomplete="name" required value="' + MH.esc(person.name) + '"></label>' +

      // Phone number — numbers only, maxlength 10
      '<label class="field"><span>Phone number</span>' +
      '<input id="cust-phone" name="phone" type="tel" inputmode="numeric" pattern="[0-9]{10}" maxlength="10" autocomplete="tel" required placeholder="10-digit mobile number" value="' + MH.esc(person.phone.replace(/\D/g,"").slice(0,10)) + '">' +
      '<span class="field-hint" id="phone-hint">Enter exactly 10 digits</span></label>' +

      // Delivery address — toggle map vs manual
      '<div class="field">' +
        '<span>Delivery address</span>' +
        '<div class="addr-toggle">' +
          '<button type="button" class="addr-tab' + (savedMode === "map" ? " active" : "") + '" data-addr-tab="map">📍 Share Location</button>' +
          '<button type="button" class="addr-tab' + (savedMode === "manual" ? " active" : "") + '" data-addr-tab="manual">✏️ Type Address</button>' +
        '</div>' +

        // Map option
        '<div id="addr-map-panel"' + (savedMode !== "map" ? ' style="display:none"' : '') + '>' +
          '<div class="map-action-row">' +
            '<button type="button" class="btn map-share-btn" id="get-location-btn">📍 Get My Location</button>' +
            '<span class="field-hint" id="location-status">' + (savedMapLink ? '✅ Location captured' : 'Tap to share your current location') + '</span>' +
          '</div>' +
          '<input type="hidden" id="cust-map-link" name="mapLink" value="' + MH.esc(savedMapLink) + '">' +
          (savedMapLink ? '<a class="map-preview-link" href="' + MH.esc(savedMapLink) + '" target="_blank" rel="noopener">View on Google Maps ↗</a>' : '') +
        '</div>' +

        // Manual address option
        '<div id="addr-manual-panel"' + (savedMode !== "manual" ? ' style="display:none"' : '') + '>' +
          '<input id="cust-shop" name="shopName" placeholder="Shop / Building name" value="' + MH.esc(person.shopName || "") + '" style="width:100%;border:1px solid var(--line);border-radius:14px;padding:12px;margin-bottom:8px;outline:none;background:rgba(255,255,255,0.8);">' +
          '<input id="cust-street" name="street" placeholder="Street / Area" value="' + MH.esc(person.street || "") + '" style="width:100%;border:1px solid var(--line);border-radius:14px;padding:12px;margin-bottom:8px;outline:none;background:rgba(255,255,255,0.8);">' +
          '<input id="cust-landmark" name="landmark" placeholder="Landmark (near...)" value="' + MH.esc(person.landmark || "") + '" style="width:100%;border:1px solid var(--line);border-radius:14px;padding:12px;outline:none;background:rgba(255,255,255,0.8);">' +
        '</div>' +

        '<input type="hidden" id="cust-address-mode" value="' + savedMode + '">' +
      '</div>' +

      '<p class="form-error" id="order-error" role="alert"></p>' +
      '<button type="submit" class="btn full wa-btn btn-shimmer" id="send-order">' +
        '<svg class="wa-icon" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>' +
        'Send Order on WhatsApp' +
        '<span class="wa-pulse"></span>' +
      '</button>' +
      '</form></div>';

    document.body.classList.add("lock");
    renderSummary();

    // Address tab switching
    root.querySelectorAll(".addr-tab").forEach(function(tab) {
      tab.addEventListener("click", function() {
        var mode = tab.dataset.addrTab;
        document.getElementById("cust-address-mode").value = mode;
        root.querySelectorAll(".addr-tab").forEach(function(t) { t.classList.remove("active"); });
        tab.classList.add("active");
        document.getElementById("addr-map-panel").style.display = mode === "map" ? "" : "none";
        document.getElementById("addr-manual-panel").style.display = mode === "manual" ? "" : "none";
      });
    });

    // Get location button
    var locBtn = document.getElementById("get-location-btn");
    if (locBtn) {
      locBtn.addEventListener("click", function() {
        var status = document.getElementById("location-status");
        if (!navigator.geolocation) {
          status.textContent = "⚠️ Location not supported on this browser.";
          return;
        }
        status.textContent = "⏳ Getting your location…";
        locBtn.disabled = true;
        navigator.geolocation.getCurrentPosition(function(pos) {
          var lat = pos.coords.latitude.toFixed(6);
          var lng = pos.coords.longitude.toFixed(6);
          var link = "https://maps.google.com/?q=" + lat + "," + lng;
          document.getElementById("cust-map-link").value = link;
          status.innerHTML = '✅ Location captured! <a href="' + link + '" target="_blank" rel="noopener" style="color:var(--gold-dark);font-weight:600;">View on Maps ↗</a>';
          locBtn.disabled = false;
          MH.saveCustomer(readCustomerFromForm());
        }, function() {
          status.textContent = "⚠️ Location denied. Please type your address instead.";
          locBtn.disabled = false;
        }, { timeout: 10000 });
      });
    }

    // Phone digit-only enforcement
    var phoneInput = document.getElementById("cust-phone");
    if (phoneInput) {
      phoneInput.addEventListener("input", function() {
        var digits = this.value.replace(/\D/g, "").slice(0, 10);
        this.value = digits;
        var hint = document.getElementById("phone-hint");
        if (hint) {
          if (digits.length === 0) hint.textContent = "Enter exactly 10 digits";
          else if (digits.length < 10) hint.textContent = digits.length + "/10 digits entered";
          else hint.textContent = "✅ Valid phone number";
        }
        MH.saveCustomer(readCustomerFromForm());
      });
    }

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
    var mode = (document.getElementById("cust-address-mode") || {}).value || "map";
    var mapLink = (document.getElementById("cust-map-link") || {}).value || "";
    var shopName = (document.getElementById("cust-shop") || {}).value || "";
    var street = (document.getElementById("cust-street") || {}).value || "";
    var landmark = (document.getElementById("cust-landmark") || {}).value || "";
    // Build a combined address string for backward-compat
    var manualAddr = [shopName, street, landmark].filter(Boolean).join(", ");
    var address = mode === "map" ? (mapLink ? "Google Maps: " + mapLink : "") : manualAddr;
    return {
      name: (document.getElementById("cust-name") || {}).value || "",
      phone: ((document.getElementById("cust-phone") || {}).value || "").replace(/\D/g,"").slice(0,10),
      address: address,
      addressMode: mode,
      mapLink: mapLink,
      shopName: shopName,
      street: street,
      landmark: landmark
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
    // Determine address validity based on mode
    var mode = person.addressMode || "map";
    var addressOk = false;
    if (mode === "map") {
      addressOk = !!person.mapLink;
    } else {
      var manualParts = [person.shopName, person.street, person.landmark].filter(function(s){ return s && s.trim(); });
      addressOk = manualParts.length >= 1;
    }
    if (!person.name.trim()) {
      error.textContent = "Please enter your name.";
      return;
    }
    if (phoneDigits.length !== 10) {
      error.textContent = "Phone number must be exactly 10 digits.";
      return;
    }
    if (!addressOk) {
      if (mode === "map") {
        error.textContent = "Please share your location or switch to 'Type Address'.";
      } else {
        error.textContent = "Please enter at least a shop/street address.";
      }
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
      orderJustCompleted = true;
      MH.completeOrder();
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
