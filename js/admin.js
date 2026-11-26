/* Admin dashboard. Credentials live in this file for the static shop. */
(function () {
  var ADMIN_USER = "admin";
  var ADMIN_PASSWORD = "admin123";
  var AUTH_KEY = "mhcs_admin";
  var editingId = null;
  var pendingImage = "";

  function authed() {
    return sessionStorage.getItem(AUTH_KEY) === "yes";
  }

  function showApp(on) {
    document.getElementById("login").hidden = on;
    document.getElementById("app").hidden = !on;
  }

  function stockSummary(list) {
    var units = 0;
    var low = 0;
    var out = 0;
    list.forEach(function (product) {
      var stock = Math.max(0, Math.floor(Number(product.stock) || 0));
      units += stock;
      if (stock === 0) out += 1;
      else if (stock <= 5) low += 1;
    });
    return { units: units, low: low, out: out, inStock: list.length - out };
  }

  function categoriesOf(list) {
    var found = {};
    list.forEach(function (product) {
      if (product.category) found[product.category] = true;
    });
    return Object.keys(found).sort();
  }

  function renderDashboard() {
    var list = MH.products();
    var summary = stockSummary(list);
    var cats = categoriesOf(list);
    document.getElementById("panel-dashboard").innerHTML =
      '<h2>Dashboard</h2><div class="stats">' +
      '<article class="stat"><span>Total products</span><b>' + list.length + "</b></article>" +
      '<article class="stat"><span>Total categories</span><b>' + cats.length + "</b></article>" +
      '<article class="stat"><span>Stock summary</span><b>' + summary.units + '</b><span>' + summary.inStock + " in stock · " + summary.low + " low · " + summary.out + " out</span></article>" +
      "</div>" +
      '<p class="note" style="margin-top:16px">Orders are sent on WhatsApp, so stock stays as you set it here. Catalog changes are saved in this browser.</p>';
  }

  function renderProducts() {
    var filter = (document.getElementById("product-search") || {}).value || "";
    var q = filter.trim().toLowerCase();
    var list = MH.products().filter(function (product) {
      var hay = (product.name + " " + (product.category || "")).toLowerCase();
      return !q || hay.indexOf(q) !== -1;
    });
    var rows = list.map(function (product) {
      var src = MH.safeSrc(product.image);
      var thumb = src
        ? '<img class="thumb" src="' + MH.esc(src) + '" alt="">'
        : '<div class="thumb ph">MH</div>';
      var stock = Math.max(0, Math.floor(Number(product.stock) || 0));
      return '<article class="product-row">' + thumb + "<div><h3>" + MH.esc(product.name) + "</h3><p>" +
        MH.esc(MH.money(product.price)) + " · " + MH.esc(product.category || "Uncategorised") + " · Stock " + stock +
        '</p><div class="row-actions"><button type="button" data-edit="' + MH.esc(product.id) + '">Edit</button><button type="button" class="quiet" data-delete="' + MH.esc(product.id) + '">Delete</button></div></div></article>';
    }).join("");
    document.getElementById("product-list").innerHTML = rows || '<p class="empty">No products yet.</p>';
    var options = categoriesOf(MH.products()).map(function (name) {
      return "<option value=\"" + MH.esc(name) + "\"></option>";
    }).join("");
    document.getElementById("category-list").innerHTML = options;
  }

  function renderSettings() {
    var shop = MH.settings();
    document.getElementById("set-name").value = shop.shopName;
    document.getElementById("set-whatsapp").value = shop.whatsapp;
    document.getElementById("set-currency").value = shop.currency;
  }

  function showPanel(name) {
    ["dashboard", "products", "settings"].forEach(function (id) {
      document.getElementById("panel-" + id).hidden = id !== name;
    });
    document.querySelectorAll(".side-nav button[data-panel]").forEach(function (button) {
      if (button.dataset.panel === "logout") return;
      if (button.dataset.panel === name) button.setAttribute("aria-current", "page");
      else button.removeAttribute("aria-current");
    });
    if (name === "dashboard") renderDashboard();
    if (name === "products") renderProducts();
    if (name === "settings") renderSettings();
    if (location.hash !== "#" + name) history.replaceState(null, "", "#" + name);
  }

  function openEditor(product) {
    editingId = product ? product.id : null;
    pendingImage = "";
    var form = document.getElementById("product-form");
    form.reset();
    document.getElementById("editor-title").textContent = product ? "Edit product" : "Add product";
    document.getElementById("prod-name").value = product ? product.name : "";
    document.getElementById("prod-price").value = product ? product.price : "";
    document.getElementById("prod-stock").value = product ? product.stock : "";
    document.getElementById("prod-category").value = product ? (product.category || "") : "";
    document.getElementById("prod-description").value = product ? (product.description || "") : "";
    var image = product ? product.image || "" : "";
    document.getElementById("prod-image").value = image.indexOf("data:") === 0 ? "" : image;
    var preview = document.getElementById("prod-preview");
    if (MH.safeSrc(image)) {
      preview.hidden = false;
      preview.src = image;
    } else preview.hidden = true;
    document.getElementById("editor-error").textContent = "";
    document.getElementById("delete-current").hidden = !product;
    document.getElementById("editor").hidden = false;
    document.body.classList.add("lock");
    document.getElementById("prod-name").focus();
  }

  function closeEditor() {
    document.getElementById("editor").hidden = true;
    document.body.classList.remove("lock");
    editingId = null;
    pendingImage = "";
  }

  function resizeImage(file) {
    return new Promise(function (resolve, reject) {
      var reader = new FileReader();
      reader.onerror = function () { reject(new Error("Could not read that image.")); };
      reader.onload = function () {
        var img = new Image();
        img.onload = function () {
          var max = 900;
          var scale = Math.min(1, max / Math.max(img.width, img.height));
          var canvas = document.createElement("canvas");
          canvas.width = Math.max(1, Math.round(img.width * scale));
          canvas.height = Math.max(1, Math.round(img.height * scale));
          canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
          resolve(canvas.toDataURL("image/jpeg", 0.78));
        };
        img.onerror = function () { reject(new Error("Could not read that image.")); };
        img.src = reader.result;
      };
      reader.readAsDataURL(file);
    });
  }

  function saveProduct(event) {
    event.preventDefault();
    var error = document.getElementById("editor-error");
    var name = document.getElementById("prod-name").value.trim();
    var price = Number(document.getElementById("prod-price").value);
    var stock = Math.floor(Number(document.getElementById("prod-stock").value));
    var category = document.getElementById("prod-category").value.trim();
    var description = document.getElementById("prod-description").value.trim();
    var imageUrl = document.getElementById("prod-image").value.trim();
    if (!name) { error.textContent = "Enter a product name."; return; }
    if (!isFinite(price) || price < 0) { error.textContent = "Enter a valid price."; return; }
    if (!isFinite(stock) || stock < 0) { error.textContent = "Enter a stock quantity of zero or more."; return; }
    if (!category) { error.textContent = "Enter a category."; return; }
    var current = MH.products().slice();
    var existing = null;
    current.forEach(function (product) { if (product.id === editingId) existing = product; });
    var image = pendingImage || imageUrl || (existing ? existing.image : "");
    if (image && !MH.safeSrc(image)) {
      error.textContent = "Use an image URL starting with http, https, or assets/.";
      return;
    }
    var next = {
      id: existing ? existing.id : "p" + Date.now(),
      name: name,
      price: price,
      stock: stock,
      category: category,
      image: image,
      description: description
    };
    if (existing) {
      current = current.map(function (product) { return product.id === existing.id ? next : product; });
    } else current.push(next);
    if (!MH.saveProducts(current, { dirty: true })) {
      error.textContent = "This browser is out of space. Use a smaller image or an image URL.";
      return;
    }
    MH.saveToLocalServer();
    closeEditor();
    renderProducts();
    renderDashboard();
  }

  function deleteProduct(id) {
    var product = MH.products().filter(function (item) { return item.id === id; })[0];
    if (!product) return;
    if (!confirm('Delete "' + product.name + '"?')) return;
    var next = MH.products().filter(function (item) { return item.id !== id; });
    MH.saveProducts(next, { dirty: true });
    MH.saveToLocalServer();
    if (editingId === id) closeEditor();
    renderProducts();
    renderDashboard();
  }

  function saveSettings(event) {
    event.preventDefault();
    var error = document.getElementById("settings-error");
    var name = document.getElementById("set-name").value.trim();
    var whatsapp = document.getElementById("set-whatsapp").value.replace(/\D/g, "");
    var currency = document.getElementById("set-currency").value.trim() || "₹";
    if (!name) { error.textContent = "Enter the shop name."; return; }
    if (whatsapp.length < 10) { error.textContent = "Enter the WhatsApp number with country code, digits only."; return; }
    MH.saveSettings({ shopName: name, whatsapp: whatsapp, currency: currency.slice(0, 4) }, { dirty: true });
    MH.saveToLocalServer().then(function (res) {
      error.textContent = res.ok ? "Saved to Data.json and this browser." : "Saved in this browser.";
    });
  }

  function login(event) {
    event.preventDefault();
    var form = event.currentTarget;
    var username = form.username.value.trim();
    var password = form.password.value;
    var error = document.getElementById("login-error");
    if (username === ADMIN_USER && password === ADMIN_PASSWORD) {
      sessionStorage.setItem(AUTH_KEY, "yes");
      error.textContent = "";
      form.reset();
      showApp(true);
      showPanel((location.hash || "#dashboard").slice(1) || "dashboard");
      return;
    }
    error.textContent = "Those details do not match.";
  }

  function logout() {
    sessionStorage.removeItem(AUTH_KEY);
    closeEditor();
    showApp(false);
    history.replaceState(null, "", "admin.html");
  }

  document.addEventListener("DOMContentLoaded", function () {
    MH.ensure();
    MH.loadRemoteData(false).then(function () {
      if (!authed()) return;
      renderDashboard();
      renderProducts();
      renderSettings();
    });
    document.getElementById("login-form").addEventListener("submit", login);
    document.getElementById("logout").addEventListener("click", logout);
    document.querySelector(".side-nav").addEventListener("click", function (event) {
      var button = event.target.closest("[data-panel]");
      if (!button || button.dataset.panel === "logout") return;
      showPanel(button.dataset.panel);
    });
    document.getElementById("add-product").addEventListener("click", function () { openEditor(null); });
    document.getElementById("product-search").addEventListener("input", renderProducts);
    document.getElementById("product-list").addEventListener("click", function (event) {
      var edit = event.target.closest("[data-edit]");
      var del = event.target.closest("[data-delete]");
      if (edit) {
        var product = MH.products().filter(function (item) { return item.id === edit.dataset.edit; })[0];
        if (product) openEditor(product);
      }
      if (del) deleteProduct(del.dataset.delete);
    });
    document.getElementById("product-form").addEventListener("submit", saveProduct);
    document.getElementById("editor-close").addEventListener("click", closeEditor);
    document.getElementById("editor").addEventListener("click", function (event) {
      if (event.target.id === "editor") closeEditor();
    });
    document.getElementById("delete-current").addEventListener("click", function () {
      if (editingId) deleteProduct(editingId);
    });
    document.getElementById("prod-file").addEventListener("change", function (event) {
      var file = event.target.files && event.target.files[0];
      var error = document.getElementById("editor-error");
      if (!file) return;
      resizeImage(file).then(function (url) {
        pendingImage = url;
        var preview = document.getElementById("prod-preview");
        preview.src = url;
        preview.hidden = false;
        error.textContent = "";
      }).catch(function () {
        error.textContent = "Could not read that image.";
      });
    });
    document.getElementById("settings-form").addEventListener("submit", saveSettings);
    document.getElementById("restore").addEventListener("click", function () {
      if (!confirm("Restore the original catalog? Products you added in this browser will be replaced.")) return;
      MH.saveProducts(MH.seedProducts(), { dirty: false });
      MH.clearCart();
      MH.saveToLocalServer();
      renderDashboard();
      renderProducts();
      document.getElementById("settings-error").textContent = "Original catalog restored.";
    });
    document.addEventListener("keydown", function (event) {
      if (event.key === "Escape" && !document.getElementById("editor").hidden) closeEditor();
    });
    if (authed()) {
      showApp(true);
      var panel = (location.hash || "#dashboard").replace("#", "");
      if (["dashboard", "products", "settings"].indexOf(panel) === -1) panel = "dashboard";
      showPanel(panel);
    } else showApp(false);
  });
})();
