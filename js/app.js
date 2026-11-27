/* Customer storefront: browse, cart, and WhatsApp checkout. */
(function () {
  var query = "";
  var category = "All";
  var orderOpen = false;
  var orderJustCompleted = false;
  var orderReview = null;
  var orderShared = false;
  var orderPdfUrl = "";
  var orderPdfError = "";

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

  function renderOrderReview(order) {
    var review = document.getElementById("order-review");
    if (!review) return;
    var person = order.customer;
    var mapLink = person.addressMode === "manual" ? "" : String(person.mapLink || "");
    var safeMapLink = /^https:\/\/(maps\.google\.com|maps\.app\.goo\.gl|www\.google\.com\/maps)(?:[/?#]|$)/i.test(mapLink)
      ? mapLink
      : "";
    var sharedPrompt = orderShared
      ? '<div class="order-confirm" role="region" aria-label="Confirm WhatsApp order">' +
        '<p class="order-confirm-title">Did you send this order on WhatsApp?</p>' +
          '<p class="order-confirm-text">Confirm only after you have tapped Send in the shop chat.</p>' +
        '<div class="order-confirm-actions">' +
        '<button type="button" class="btn" data-act="confirm-sent">Yes, Order Sent</button>' +
        '<button type="button" class="btn secondary" data-act="keep-cart">No, Keep in Cart</button>' +
        '</div></div>'
      : "";
    var items = order.items.map(function (item, index) {
      return '<li class="invoice-item"><span class="invoice-index">' + String(index + 1).padStart(2, "0") + '</span>' +
        '<div class="invoice-item-copy"><strong>' + MH.esc(item.name) + '</strong><span>Qty ' + item.qty + ' · ' + MH.esc(MH.money(item.price)) + ' each</span></div>' +
        '<strong class="invoice-subtotal">' + MH.esc(MH.money(item.qty * item.price)) + '</strong></li>';
    }).join("");
    var address = person.address || (safeMapLink ? "Shared location" : "");

    review.innerHTML = sharedPrompt +
      '<div class="invoice-card">' +
        '<div class="invoice-topline"><span>🍫 ' + MH.esc(MH.settings().shopName).toUpperCase() + '</span><span>ORDER INVOICE</span></div>' +
        '<div class="invoice-meta"><span>Order ID</span><strong>' + MH.esc(order.orderId) + '</strong></div>' +
        '<div class="invoice-datetime"><span>' + MH.esc(order.date) + '</span><span>' + MH.esc(order.time) + '</span></div>' +
        '<div class="invoice-section"><h3>Customer details</h3>' +
          '<p><strong>' + MH.esc(person.name) + '</strong><span>' + MH.esc(person.phone) + '</span></p></div>' +
        '<div class="invoice-section"><h3>Delivery address</h3>' +
          '<p><span>' + MH.esc(address || "Address provided") + '</span>' +
            (safeMapLink ? '<a href="' + MH.esc(safeMapLink) + '" target="_blank" rel="noopener noreferrer">Open location ↗</a>' : '') +
          '</p></div>' +
        '<div class="invoice-section invoice-items-section"><h3>Order items</h3><ol class="invoice-items">' + items + '</ol></div>' +
        '<div class="invoice-totals"><p><span>Total products</span><strong>' + order.items.length + '</strong></p>' +
          '<p><span>Total quantity</span><strong>' + order.qty + '</strong></p>' +
          '<p class="invoice-grand"><span>Total amount</span><strong>' + MH.esc(MH.money(order.amount)) + '</strong></p></div>' +
      '</div>' +
        (orderPdfUrl
          ? '<div class="order-pdf-actions">' +
            '<a id="view-order-pdf" class="btn secondary" href="' + MH.esc(orderPdfUrl) + '" target="_blank" rel="noopener noreferrer">View PDF</a>' +
            '<a id="download-order-pdf" class="btn secondary" href="' + MH.esc(orderPdfUrl) + '" download="' + MH.esc(order.orderId) + '.pdf">Download PDF</a>' +
            '</div>'
          : '<p class="order-pdf-error" role="status">' + MH.esc(orderPdfError || "PDF preview is unavailable. You can still send the order on WhatsApp.") + '</p>') +
      '<ul class="order-checklist" aria-label="Order details confirmed">' +
        '<li><span aria-hidden="true">✓</span> Customer details</li>' +
        '<li><span aria-hidden="true">✓</span> Delivery address</li>' +
        '<li><span aria-hidden="true">✓</span> Order items</li>' +
        '<li><span aria-hidden="true">✓</span> Total amount</li>' +
      '</ul>' +
      '<div class="order-trust-grid" aria-label="Shop assurances">' +
        '<span>🍫 Fresh products</span><span>📦 Bulk orders supported</span>' +
        '<span>💬 WhatsApp confirmation</span><span>🔒 Secure ordering</span>' +
      '</div>' +
      '<button class="btn secondary order-edit-btn" type="button" data-act="edit-order">Edit details</button>';
  }

  function pdfText(value) {
    return String(value == null ? "" : value).replace(/₹/g, "INR ").replace(/[^\x20-\x7E]/g, "?");
  }

  function pdfMoney(amount) {
    var currency = MH.settings().currency || "INR";
    if (currency === "₹") currency = "INR";
    return pdfText(currency).trim() + " " +
      new Intl.NumberFormat("en-IN", { maximumFractionDigits: 2 }).format(Number(amount) || 0);
  }

  function safeMapLink(value) {
    var link = String(value || "");
    return /^https:\/\/(maps\.google\.com|maps\.app\.goo\.gl|www\.google\.com\/maps)(?:[/?#]|$)/i.test(link) ? link : "";
  }

  function createOrderPdf(order) {
    var JsPDF = window.jspdf && window.jspdf.jsPDF;
    if (!JsPDF) throw new Error("The PDF invoice library did not load. Check your connection and refresh.");

    var pageWidth = 360;
    var pageHeight = 640;
    var doc = new JsPDF({ orientation: "portrait", unit: "pt", format: [pageWidth, pageHeight] });
    var margin = 20;
    var contentWidth = pageWidth - margin * 2;
    var colors = {
      chocolate: [45, 27, 20],
      gold: [166, 130, 25],
      goldLight: [228, 197, 106],
      cream: [255, 248, 232],
      paper: [250, 247, 240],
      ink: [45, 27, 20],
      muted: [122, 98, 86],
      line: [225, 216, 203],
      white: [255, 255, 255]
    };
    var y = 0;

    function text(value, x, top, size, color, weight, align) {
      doc.setFont("helvetica", weight || "normal");
      doc.setFontSize(size);
      doc.setTextColor(color[0], color[1], color[2]);
      var options = align ? { align: align } : {};
      var safeValue = Array.isArray(value) ? value.map(pdfText) : pdfText(value);
      doc.text(safeValue, x, top, options);
    }

    function drawHeader(continued) {
      doc.setFillColor(colors.chocolate[0], colors.chocolate[1], colors.chocolate[2]);
      doc.rect(0, 0, pageWidth, continued ? 58 : 78, "F");
      text("M.H CHOCOLATE SHOP", margin, 30, 15, colors.cream, "bold");
      text(continued ? "ORDER INVOICE - CONTINUED" : "ARTISAN CHOCOLATE HOUSE", margin, 47, 8, colors.goldLight, "normal");
      text("ORDER INVOICE", pageWidth - margin, 30, 8, colors.goldLight, "bold", "right");
      if (!continued) {
        doc.setFillColor(colors.gold[0], colors.gold[1], colors.gold[2]);
        doc.roundedRect(margin, 62, 42, 3, 1, 1, "F");
      }
    }

    function addContinuationPage() {
      doc.addPage([pageWidth, pageHeight], "portrait");
      drawHeader(true);
      y = 74;
    }

    function ensureSpace(height) {
      if (y + height > pageHeight - 40) addContinuationPage();
    }

    function drawItemsHeader(label) {
      ensureSpace(24);
      text(label, margin, y + 10, 9, colors.gold, "bold");
      y += 18;
    }

    drawHeader(false);
    y = 94;
    doc.setFillColor(colors.paper[0], colors.paper[1], colors.paper[2]);
    doc.roundedRect(margin, y, contentWidth, 54, 7, 7, "F");
    text("ORDER ID", margin + 11, y + 16, 7, colors.muted, "bold");
    text(order.orderId, margin + 11, y + 34, 10, colors.ink, "bold");
    text(order.date, pageWidth - margin - 11, y + 17, 8, colors.ink, "bold", "right");
    text(order.time, pageWidth - margin - 11, y + 34, 8, colors.muted, "normal", "right");
    y += 64;

    var customer = order.customer;
    var locationUrl = customer.addressMode === "manual" ? "" : safeMapLink(customer.mapLink);
    var address = customer.address || (locationUrl ? "Shared location" : "Address not provided");
    var nameLines = doc.splitTextToSize(pdfText(customer.name), contentWidth - 24);
    var customerHeight = 38 + nameLines.length * 12;
    ensureSpace(customerHeight + 8);
    doc.setDrawColor(colors.line[0], colors.line[1], colors.line[2]);
    doc.setFillColor(colors.white[0], colors.white[1], colors.white[2]);
    doc.roundedRect(margin, y, contentWidth, customerHeight, 7, 7, "FD");
    text("CUSTOMER DETAILS", margin + 12, y + 16, 8, colors.gold, "bold");
    text(nameLines, margin + 12, y + 32, 9, colors.ink, "bold");
    text("Phone: " + customer.phone, margin + 12, y + 33 + nameLines.length * 12, 8, colors.muted, "normal");
    y += customerHeight + 8;

    var addressLines = doc.splitTextToSize(pdfText(address), contentWidth - 24);
    var addressHeight = 34 + addressLines.length * 11 + (locationUrl ? 17 : 0);
    ensureSpace(addressHeight + 8);
    doc.setFillColor(colors.white[0], colors.white[1], colors.white[2]);
    doc.roundedRect(margin, y, contentWidth, addressHeight, 7, 7, "FD");
    text("DELIVERY ADDRESS", margin + 12, y + 16, 8, colors.gold, "bold");
    text(addressLines, margin + 12, y + 31, 8, colors.ink, "normal");
    if (locationUrl) {
      var linkLabel = "Open delivery location in Google Maps";
      var linkX = margin + 12;
      var linkY = y + 32 + addressLines.length * 11 + 8;
      text(linkLabel, linkX, linkY, 8, [45, 95, 150], "bold");
      doc.link(linkX, linkY - 9, doc.getTextWidth(linkLabel), 12, { url: locationUrl });
    }

    y += addressHeight + 12;
    drawItemsHeader("ORDER ITEMS");
    order.items.forEach(function (item, index) {
      var nameLines = doc.splitTextToSize(pdfText(item.name), contentWidth - 54);
      var rowHeight = Math.max(50, 36 + nameLines.length * 11);
      if (y + rowHeight > pageHeight - 40) {
        addContinuationPage();
        drawItemsHeader("ORDER ITEMS (CONTINUED)");
      }
      doc.setFillColor(index % 2 === 0 ? colors.paper[0] : colors.white[0], index % 2 === 0 ? colors.paper[1] : colors.white[1], index % 2 === 0 ? colors.paper[2] : colors.white[2]);
      doc.roundedRect(margin, y, contentWidth, rowHeight, 6, 6, "F");
      text(String(index + 1).padStart(2, "0"), margin + 10, y + 17, 8, colors.gold, "bold");
      text(nameLines, margin + 36, y + 17, 9, colors.ink, "bold");
      text("Qty " + item.qty + " x " + pdfMoney(item.price), margin + 10, y + rowHeight - 9, 8, colors.muted, "normal");
      text(pdfMoney(item.qty * item.price), pageWidth - margin - 10, y + rowHeight - 9, 9, colors.ink, "bold", "right");
      doc.setDrawColor(colors.line[0], colors.line[1], colors.line[2]);
      doc.setLineWidth(0.5);
      y += rowHeight;
      doc.line(margin, y, pageWidth - margin, y);
      y += 6;
    });

    ensureSpace(102);
    y += 4;
    doc.setFillColor(colors.paper[0], colors.paper[1], colors.paper[2]);
    doc.roundedRect(margin, y, contentWidth, 96, 7, 7, "F");
    text("ORDER SUMMARY", margin + 12, y + 17, 8, colors.gold, "bold");
    text("Total products", margin + 12, y + 36, 8, colors.muted, "normal");
    text(String(order.items.length), pageWidth - margin - 12, y + 36, 8, colors.ink, "bold", "right");
    text("Total quantity", margin + 12, y + 52, 8, colors.muted, "normal");
    text(String(order.qty), pageWidth - margin - 12, y + 52, 8, colors.ink, "bold", "right");
    doc.setFillColor(colors.chocolate[0], colors.chocolate[1], colors.chocolate[2]);
    doc.roundedRect(margin + 6, y + 64, contentWidth - 12, 24, 5, 5, "F");
    text("GRAND TOTAL", margin + 14, y + 80, 8, colors.cream, "bold");
    text(pdfMoney(order.amount), pageWidth - margin - 14, y + 80, 10, colors.goldLight, "bold", "right");

    var pages = doc.getNumberOfPages();
    for (var page = 1; page <= pages; page++) {
      doc.setPage(page);
      doc.setDrawColor(colors.line[0], colors.line[1], colors.line[2]);
      doc.setLineWidth(0.6);
      doc.line(margin, pageHeight - 28, pageWidth - margin, pageHeight - 28);
      text("M.H Chocolate Shop | " + order.orderId, margin, pageHeight - 15, 6, colors.muted, "normal");
      text(page + "/" + pages, pageWidth - margin, pageHeight - 15, 6, colors.muted, "normal", "right");
    }
    return doc.output("blob");
  }

  function prepareOrderPdf(order) {
    if (orderPdfUrl) URL.revokeObjectURL(orderPdfUrl);
    orderPdfUrl = "";
    orderPdfError = "";
    try {
      orderPdfUrl = URL.createObjectURL(createOrderPdf(order));
    } catch (err) {
      orderPdfError = err.message || "Could not prepare the PDF invoice.";
    }
  }

  function setShareStatus(message, whatsappUrl) {
    var status = document.getElementById("order-share-status");
    var whatsappLink = document.getElementById("order-whatsapp-link");
    if (!status || !whatsappLink) return;
    status.textContent = message;
    status.hidden = !message;
    whatsappLink.hidden = !whatsappUrl;
    whatsappLink.href = whatsappUrl || "#";
  }

  function markOrderShared() {
    orderShared = true;
    MH.setPendingOrder(true);
    renderOrderReview(orderReview);
    var label = document.getElementById("send-order-label");
    if (label) label.textContent = "Open WhatsApp again";
  }

  function sendOrderToWhatsApp(order, error) {
    var whatsappUrl = MH.whatsappUrl(order);
    if (!whatsappUrl) {
      error.textContent = "The shop WhatsApp number is missing. Ask the shop to set it in admin settings.";
      return;
    }
    var whatsappLink = document.getElementById("order-whatsapp-link");
    if (whatsappLink) whatsappLink.href = whatsappUrl;
    markOrderShared();
    setShareStatus("WhatsApp is opening with the full order addressed to the shop. Tap Send in WhatsApp to place your order.", whatsappUrl);
    var chatWindow = window.open(whatsappUrl, "_blank");
    if (chatWindow) chatWindow.opener = null;
  }

  function openOrder() {
    orderOpen = true;
    orderReview = null;
    orderShared = false;
    var root = document.getElementById("modal-root");
    var person = MH.customer();
    // Determine saved address mode
    var savedMode = person.addressMode || "map";
    var savedMapLink = person.mapLink || "";
    var savedManual = person.address || "";

    root.hidden = false;
    root.innerHTML = '<div class="modal" id="order-modal"><form class="sheet order-sheet" id="order-form">' +
      '<button type="button" class="close order-close" data-act="close" aria-label="Close order and return to shop">×<span>Close</span></button>' +
      '<p class="eyebrow order-eyebrow"><span class="eyebrow-dot"></span> A little sweetness, made personal</p>' +
      '<h2>Your order</h2><p class="sheet-lead">Review your details, then send the full order to the shop in WhatsApp. You can also view or download a phone-friendly PDF invoice.</p>' +
      '<div id="order-details-step"><div id="order-summary"></div>' +

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
      '<div class="order-trust-grid order-form-trust" aria-label="Shop assurances">' +
        '<span>🍫 Fresh products</span><span>📦 Bulk orders supported</span>' +
        '<span>💬 WhatsApp confirmation</span><span>🔒 Secure ordering</span>' +
      '</div></div>' +
      '<section class="order-review" id="order-review" aria-live="polite" hidden></section>' +

      '<div class="order-action-bar"><p class="form-error" id="order-error" role="alert"></p>' +
      '<p class="order-share-status" id="order-share-status" role="status" hidden></p>' +
      '<a class="btn secondary order-whatsapp-link" id="order-whatsapp-link" target="_blank" rel="noopener noreferrer" hidden>Open WhatsApp chat to send order</a>' +
      '<button type="submit" class="btn full wa-btn btn-shimmer" id="send-order">' +
        '<svg class="wa-icon" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>' +
        '<span id="send-order-label">Review your order</span>' +
        '<span class="wa-pulse"></span>' +
      '</button></div>' +
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
    orderReview = null;
    orderShared = false;
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
    if (!orderReview) {
      var now = new Date();
      var totals = MH.totals();
      var dateId = [
        now.getFullYear(),
        String(now.getMonth() + 1).padStart(2, "0"),
        String(now.getDate()).padStart(2, "0")
      ].join("");
      orderReview = {
        orderId: "MH-" + dateId + "-" + String(Math.floor(1000 + Math.random() * 9000)),
        date: new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", year: "numeric" }).format(now),
        time: new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit" }).format(now),
        customer: Object.assign({}, person, { address: mode === "manual" ? person.address : "" }),
        items: totals.items.map(function (item) {
          return { id: item.id, name: item.name, price: item.price, qty: item.qty };
        }),
        qty: totals.qty,
        amount: totals.amount
      };
      prepareOrderPdf(orderReview);
      document.getElementById("order-details-step").hidden = true;
      document.getElementById("order-review").hidden = false;
      renderOrderReview(orderReview);
      document.getElementById("send-order-label").textContent = "Send order to WhatsApp";
      document.querySelector("#order-modal .sheet").scrollTop = 0;
      error.textContent = "";
      return;
    }
    error.textContent = "";
    orderJustCompleted = false;
    sendOrderToWhatsApp(orderReview, error);
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
    else if (act === "edit-order") {
      orderReview = null;
      document.getElementById("order-details-step").hidden = false;
      document.getElementById("order-review").hidden = true;
      document.getElementById("send-order-label").textContent = "Review your order";
      document.getElementById("order-error").textContent = "";
      setShareStatus("", "");
    }
    else if (act === "confirm-sent") {
      orderJustCompleted = true;
      orderShared = false;
      orderReview = null;
      MH.completeOrder();
      closeOrder();
      refreshAll();
    } else if (act === "keep-cart") {
      orderShared = false;
      MH.setPendingOrder(false);
      refreshAll();
      if (orderReview) renderOrderReview(orderReview);
      document.getElementById("send-order-label").textContent = "Send order to WhatsApp";
      setShareStatus("Your cart is unchanged. Send the order whenever you are ready.", "");
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
    refresh: refreshAll,
    openOrder: openOrder
  };
})();
