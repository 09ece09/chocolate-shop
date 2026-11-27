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
    var mapUrl = safeMapLink(person.mapLink);
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
    var address = person.address || (mapUrl ? "Shared location" : "");

    review.innerHTML = sharedPrompt +
      '<div class="invoice-card">' +
        '<div class="invoice-topline"><span>🍫 ' + MH.esc(MH.settings().shopName).toUpperCase() + '</span><span>ORDER INVOICE</span></div>' +
        '<div class="invoice-meta"><span>Order ID</span><strong>' + MH.esc(order.orderId) + '</strong></div>' +
        '<div class="invoice-datetime"><span>' + MH.esc(order.date) + '</span><span>' + MH.esc(order.time) + '</span></div>' +
        '<div class="invoice-section"><h3>Store / contact details</h3>' +
          '<p><strong>' + MH.esc(person.shopName || "Store") + '</strong><span>Contact: ' + MH.esc(person.name) + '</span><span>Phone: ' + MH.esc(person.phone) + '</span></p></div>' +
        '<div class="invoice-section"><h3>Delivery information</h3>' +
          '<p>' + (address ? '<span>Address: ' + MH.esc(address) + '</span>' : '') +
            (mapUrl ? '<a href="' + MH.esc(mapUrl) + '" target="_blank" rel="noopener noreferrer">Open location ↗</a>' : '') +
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
        '<li><span aria-hidden="true">✓</span> Business details</li>' +
        '<li><span aria-hidden="true">✓</span> Delivery address</li>' +
        '<li><span aria-hidden="true">✓</span> Order items</li>' +
        '<li><span aria-hidden="true">✓</span> Total amount</li>' +
      '</ul>' +
      '<div class="order-trust-grid" aria-label="Shop assurances">' +
        '<span>📦 Bulk orders supported</span><span>⚡ Fast confirmation</span>' +
        '<span>🔒 Secure ordering</span><span>💬 WhatsApp updates</span>' +
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
    var locationUrl = safeMapLink(customer.mapLink);
    var address = customer.address || (locationUrl ? "Shared location" : "Address not provided");
    var storeNameLines = doc.splitTextToSize(pdfText(customer.shopName), contentWidth - 24);
    var contactLines = doc.splitTextToSize(pdfText(customer.name), contentWidth - 24);
    var customerHeight = 40 + storeNameLines.length * 12 + contactLines.length * 11;
    ensureSpace(customerHeight + 8);
    doc.setDrawColor(colors.line[0], colors.line[1], colors.line[2]);
    doc.setFillColor(colors.white[0], colors.white[1], colors.white[2]);
    doc.roundedRect(margin, y, contentWidth, customerHeight, 7, 7, "FD");
    text("STORE / CONTACT", margin + 12, y + 16, 8, colors.gold, "bold");
    text(storeNameLines, margin + 12, y + 32, 9, colors.ink, "bold");
    text(contactLines, margin + 12, y + 32 + storeNameLines.length * 12, 8, colors.muted, "normal");
    text("Phone: " + customer.phone, margin + 12, y + 32 + storeNameLines.length * 12 + contactLines.length * 11, 8, colors.muted, "normal");
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

  function renderLocationStatus(mapLink) {
    var status = document.getElementById("location-status");
    var safeLink = safeMapLink(mapLink);
    if (!status) return;
    status.innerHTML = safeLink
      ? '<div class="location-success-card"><strong>✅ Location Shared Successfully</strong><span>Location received for accurate delivery.</span><a href="' + MH.esc(safeLink) + '" target="_blank" rel="noopener noreferrer">View on Map</a></div>'
      : '<p class="location-help">Share a map location for faster delivery. Address is optional when location is shared.</p>';
  }

  function openOrder() {
    orderOpen = true;
    orderReview = null;
    orderShared = false;
    var root = document.getElementById("modal-root");
    var person = MH.customer();
    var savedMapLink = safeMapLink(person.mapLink);
    var savedAddress = String(person.address || "");
    if (savedMapLink && savedAddress === "Google Maps: " + savedMapLink) savedAddress = "";

    root.hidden = false;
    root.innerHTML = '<div class="modal" id="order-modal"><form class="sheet order-sheet" id="order-form">' +
      '<button type="button" class="close order-close" data-act="close" aria-label="Close order and return to shop">×<span>Close</span></button>' +
      '<p class="eyebrow order-eyebrow"><span class="eyebrow-dot"></span> WHOLESALE CHECKOUT</p>' +
      '<h2>Delivery details</h2><p class="sheet-lead">Tell us where to deliver your bulk order. Share a location or enter an address.</p>' +
      '<div id="order-details-step"><div id="order-summary"></div>' +
      '<section class="delivery-card business-details-card" aria-labelledby="delivery-info-title">' +
        '<div class="delivery-section-heading"><span class="delivery-section-icon">01</span><div><h3 id="delivery-info-title">Delivery Information</h3><p>Business and contact details for order confirmation.</p></div></div>' +
        '<div class="delivery-fields-grid">' +
          '<label class="field"><span>Store / Business Name <b>*</b></span><input id="cust-store-name" name="shopName" autocomplete="organization" required placeholder="ABC Sweets & Snacks" value="' + MH.esc(person.shopName || "") + '"></label>' +
          '<label class="field"><span>Contact Person <b>*</b></span><input id="cust-name" name="name" autocomplete="name" required placeholder="Owner Name" value="' + MH.esc(person.name || "") + '"></label>' +
          '<label class="field"><span>Mobile Number <b>*</b></span>' +
            '<input id="cust-phone" name="phone" type="tel" inputmode="numeric" pattern="[0-9]{10}" maxlength="10" autocomplete="tel" required placeholder="10-digit mobile number" value="' + MH.esc(String(person.phone || "").replace(/\D/g, "").slice(0, 10)) + '">' +
            '<span class="field-hint" id="phone-hint">Enter your 10-digit mobile number</span></label>' +
        '</div>' +
      '</section>' +
      '<section class="delivery-card location-options-card" aria-labelledby="delivery-location-title">' +
        '<div class="delivery-section-heading"><span class="delivery-section-icon">02</span><div><h3 id="delivery-location-title">Delivery Location</h3><p>Share a map pin or type your full delivery address.</p></div></div>' +
        '<div class="location-option recommended-option"><div class="location-option-heading"><span>OPTION 1 · RECOMMENDED</span><h4>🗺️ Share Live Location</h4></div>' +
          '<button type="button" class="btn map-share-btn location-share-btn" id="get-location-btn">📍 Share Current Location</button>' +
          '<div id="location-status" class="location-status" role="status" aria-live="polite"></div>' +
          '<input type="hidden" id="cust-map-link" name="mapLink" value="' + MH.esc(savedMapLink) + '">' +
          '<input type="hidden" id="cust-latitude" name="latitude" value="' + MH.esc(person.latitude || "") + '">' +
          '<input type="hidden" id="cust-longitude" name="longitude" value="' + MH.esc(person.longitude || "") + '">' +
        '</div>' +
        '<div class="delivery-or"><span>OR</span></div>' +
        '<label class="field delivery-address-field"><span>✏️ Enter Delivery Address</span>' +
          '<textarea id="cust-address" name="address" rows="5" autocomplete="street-address" placeholder="Shop Name:&#10;Area/Market:&#10;Road/Landmark:&#10;Town:&#10;PIN Code:">' + MH.esc(savedAddress) + '</textarea>' +
          '<span class="field-hint">Example: Maa Tara Sweets, Kaliachak Main Market, Near Bus Stand, Malda, 732201</span></label>' +
      '</section>' +
      '<aside class="better-delivery-card"><strong>🚚 Better Delivery</strong><ul>' +
        '<li>Share a map location for faster delivery.</li><li>Address is optional when a location is shared.</li><li>Our delivery team will contact you before dispatch.</li>' +
      '</ul></aside>' +
      '<div class="order-trust-grid order-form-trust" aria-label="Shop assurances">' +
        '<span>📦 Bulk orders supported</span><span>⚡ Fast confirmation</span>' +
        '<span>🔒 Secure ordering</span><span>💬 WhatsApp updates</span>' +
      '</div></div>' +
      '<section class="order-review" id="order-review" aria-live="polite" hidden></section>' +
      '<div class="order-action-bar"><p class="form-error" id="order-error" role="alert"></p>' +
      '<p class="order-share-status" id="order-share-status" role="status" hidden></p>' +
      '<a class="btn secondary order-whatsapp-link" id="order-whatsapp-link" target="_blank" rel="noopener noreferrer" hidden>Open WhatsApp chat to send order</a>' +
      '<button type="submit" class="btn full wa-btn btn-shimmer" id="send-order">' +
        '<svg class="wa-icon" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>' +
        '<span id="send-order-label">Review &amp; Send Order on WhatsApp</span>' +
        '<span class="wa-pulse"></span>' +
      '</button></div>' +
      '</form></div>';

    document.body.classList.add("lock");
    renderSummary();
    renderLocationStatus(savedMapLink);

    var locBtn = document.getElementById("get-location-btn");
    if (locBtn) {
      locBtn.addEventListener("click", function() {
        if (!navigator.geolocation) {
          var status = document.getElementById("location-status");
          if (status) status.innerHTML = '<p class="location-error">Location sharing is not supported on this browser. You can enter an address instead.</p>';
          return;
        }
        locBtn.disabled = true;
        locBtn.textContent = "Getting your location...";
        navigator.geolocation.getCurrentPosition(function(pos) {
          var latitude = pos.coords.latitude.toFixed(6);
          var longitude = pos.coords.longitude.toFixed(6);
          var link = "https://maps.google.com/?q=" + latitude + "," + longitude;
          document.getElementById("cust-map-link").value = link;
          document.getElementById("cust-latitude").value = latitude;
          document.getElementById("cust-longitude").value = longitude;
          renderLocationStatus(link);
          locBtn.disabled = false;
          locBtn.textContent = "📍 Share Current Location";
          MH.saveCustomer(readCustomerFromForm());
        }, function() {
          var status = document.getElementById("location-status");
          if (status) status.innerHTML = '<p class="location-error">Location access was not granted. You can enter a delivery address instead.</p>';
          locBtn.disabled = false;
          locBtn.textContent = "📍 Share Current Location";
        }, { timeout: 10000, enableHighAccuracy: false, maximumAge: 60000 });
      });
    }

    var phoneInput = document.getElementById("cust-phone");
    if (phoneInput) {
      phoneInput.addEventListener("input", function() {
        var digits = this.value.replace(/\D/g, "").slice(0, 10);
        this.value = digits;
        var hint = document.getElementById("phone-hint");
        if (hint) {
          if (digits.length === 0) hint.textContent = "Enter your 10-digit mobile number";
          else if (digits.length < 10) hint.textContent = digits.length + "/10 digits entered";
          else hint.textContent = "Mobile number looks good";
        }
        MH.saveCustomer(readCustomerFromForm());
      });
    }

    if (MH.hasPendingOrder()) {
      var sheet = root.querySelector(".sheet");
      if (sheet) sheet.scrollTop = 0;
    } else {
      document.getElementById("cust-store-name").focus();
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
    var mapLink = (document.getElementById("cust-map-link") || {}).value || "";
    var address = (document.getElementById("cust-address") || {}).value || "";
    return {
      name: (document.getElementById("cust-name") || {}).value || "",
      phone: ((document.getElementById("cust-phone") || {}).value || "").replace(/\D/g, "").slice(0, 10),
      address: address.trim(),
      addressMode: mapLink ? "map" : "manual",
      mapLink: mapLink,
      shopName: (document.getElementById("cust-store-name") || {}).value || "",
      street: "",
      landmark: "",
      latitude: (document.getElementById("cust-latitude") || {}).value || "",
      longitude: (document.getElementById("cust-longitude") || {}).value || ""
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
    var addressOk = !!safeMapLink(person.mapLink) || !!person.address.trim();
    if (!person.shopName.trim()) {
      error.textContent = "Please enter your store or business name.";
      return;
    }
    if (!person.name.trim()) {
      error.textContent = "Please enter the contact person's name.";
      return;
    }
    if (phoneDigits.length !== 10) {
      error.textContent = "Mobile number must be exactly 10 digits.";
      return;
    }
    if (!addressOk) {
      error.textContent = "Please share your location or enter a delivery address.";
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
        customer: Object.assign({}, person),
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
