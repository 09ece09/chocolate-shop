/* Inline runtime Admin mode for index.html backed by GitHub Data.json. */
(function () {
  var GH_TOKEN_KEY = "mh_gh_token";
  var GH_REPO_KEY = "mh_gh_repo";
  var GH_FILE_KEY = "mh_gh_file";

  var activeModal = null;
  var editingId = null;
  var pendingImage = "";
  var removeImageFlag = false;
  var statusMessage = "";
  var statusIsError = false;

  function hasGitHubAuth() {
    return Boolean(localStorage.getItem(GH_TOKEN_KEY) && localStorage.getItem(GH_REPO_KEY));
  }

  function isActive() {
    return hasGitHubAuth();
  }

  function guessRepo() {
    var host = location.hostname;
    var pathPart = (location.pathname.split("/")[1] || "").trim();
    if (/\.github\.io$/i.test(host) && pathPart) {
      return host.split(".")[0] + "/" + pathPart;
    }
    return "";
  }

  function ghHeaders() {
    return {
      "Authorization": "Bearer " + (localStorage.getItem(GH_TOKEN_KEY) || ""),
      "Accept": "application/vnd.github+json"
    };
  }

  function ghApi(filePath, options) {
    var repo = localStorage.getItem(GH_REPO_KEY) || "";
    var opts = Object.assign({}, options || {});
    opts.headers = Object.assign(ghHeaders(), opts.headers || {});
    return fetch("https://api.github.com/repos/" + repo + "/contents/" + filePath, opts);
  }

  function decodeBase64Utf8(b64) {
    var clean = String(b64 || "").replace(/\s/g, "");
    var bin = atob(clean);
    var bytes = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return new TextDecoder().decode(bytes);
  }

  function readGitHubData(filePath, meta) {
    if (typeof meta.content === "string" && meta.content.trim()) {
      return Promise.resolve(JSON.parse(decodeBase64Utf8(meta.content)));
    }
    return ghApi(filePath, { headers: { "Accept": "application/vnd.github.raw+json" } }).then(function (res) {
      if (!res.ok) throw new Error("GitHub file read failed (" + res.status + ")");
      return res.text();
    }).then(function (text) {
      if (!text.trim()) throw new Error("GitHub returned an empty Data.json file.");
      try {
        return JSON.parse(text);
      } catch (err) {
        throw new Error("Data.json in GitHub is not valid JSON.");
      }
    });
  }

  function encodeBase64Utf8(text) {
    var bytes = new TextEncoder().encode(text);
    var bin = "";
    for (var i = 0; i < bytes.length; i += 8192) {
      bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 8192));
    }
    return btoa(bin);
  }

  function fetchGitHubData() {
    var preferred = localStorage.getItem(GH_FILE_KEY) || "Data.json";
    var fallback = preferred === "Data.json" ? "data.json" : "Data.json";
    return ghApi(preferred).then(function (res) {
      if (res.ok) {
        localStorage.setItem(GH_FILE_KEY, preferred);
        return res.json().then(function (meta) {
          return readGitHubData(preferred, meta).then(function (data) {
            return { file: preferred, meta: meta, data: data };
          });
        });
      }
      if (res.status === 404) {
        return ghApi(fallback).then(function (res2) {
          if (!res2.ok) throw new Error("GitHub returned " + res2.status);
          localStorage.setItem(GH_FILE_KEY, fallback);
          return res2.json().then(function (meta) {
            return readGitHubData(fallback, meta).then(function (data) {
              return { file: fallback, meta: meta, data: data };
            });
          });
        });
      }
      throw new Error("GitHub returned " + res.status);
    });
  }

  function saveToGitHub(dataObj) {
    var payload = JSON.stringify(dataObj || MH.exportData(), null, 2) + "\n";
    var filePath = localStorage.getItem(GH_FILE_KEY) || "Data.json";
    return ghApi(filePath).then(function (res) {
      if (res.status === 404) return { sha: undefined };
      if (!res.ok) throw new Error("GitHub read failed (" + res.status + ")");
      return res.json();
    }).then(function (cur) {
      var body = {
        message: "Update " + filePath + " from runtime admin",
        content: encodeBase64Utf8(payload)
      };
      if (cur && cur.sha) body.sha = cur.sha;
      return ghApi(filePath, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
      });
    }).then(function (res) {
      if (!res.ok) throw new Error("GitHub save failed (" + res.status + ")");
      MH.setDirty(false);
      return { ok: true, file: filePath };
    });
  }

  function persistRuntimeChanges(quiet) {
    var data = MH.exportData();
    if (hasGitHubAuth()) {
      setStatus("Saving to GitHub Data.json...", false);
      return saveToGitHub(data).then(function (res) {
        setStatus("Saved to GitHub (" + res.file + ")", false);
        return { ok: true, target: "github" };
      }).catch(function (err) {
        MH.setDirty(true);
        setStatus(err.message || "Could not save to GitHub", true);
        return { ok: false, target: "github", error: err };
      });
    }
    return MH.saveToLocalServer(data).then(function (res) {
      if (res.ok) {
        setStatus("Saved to Data.json", false);
        return { ok: true, target: "local" };
      }
      MH.setDirty(true);
      if (!quiet) {
        setStatus("Updated live in browser (download Data.json or connect GitHub to persist)", false);
      } else {
        setStatus("Updated live in browser (unsaved to Data.json)", false);
      }
      return { ok: false, target: "browser" };
    });
  }

  function setStatus(msg, isError) {
    statusMessage = msg || "";
    statusIsError = Boolean(isError);
    updateAdminBar();
    var note = document.getElementById("admin-panel-status");
    if (note) {
      note.textContent = statusMessage;
      note.classList.toggle("is-error", statusIsError);
    }
  }

  function updateAdminBar() {
    var bar = document.getElementById("admin-bar");
    if (!bar) return;
    var active = isActive();
    bar.hidden = !active;
    document.body.classList.toggle("admin-on", active);
    if (!active) return;

    var label = document.getElementById("admin-mode-label");
    var note = document.getElementById("admin-sync-note");
    if (label) {
      label.textContent = hasGitHubAuth()
        ? "Admin Mode · GitHub (" + localStorage.getItem(GH_REPO_KEY) + ")"
        : "Admin Mode";
    }
    if (note) {
      if (statusMessage) {
        note.textContent = statusMessage;
        note.classList.toggle("is-error", statusIsError);
      } else if (MH.isDirty()) {
        note.textContent = "Live browser changes (save/download Data.json to persist)";
        note.classList.remove("is-error");
      } else {
        note.textContent = "Synced with " + (MH.dataSource() || "Data.json");
        note.classList.remove("is-error");
      }
    }
  }

  function refreshUI() {
    updateAdminBar();
    if (window.MHStorefront && window.MHStorefront.refresh) {
      window.MHStorefront.refresh();
    }
  }

  function closeModal() {
    activeModal = null;
    editingId = null;
    pendingImage = "";
    removeImageFlag = false;
    var root = document.getElementById("admin-root");
    root.hidden = true;
    root.innerHTML = "";
    document.body.classList.remove("lock");
  }

  function openLoginModal() {
    activeModal = "login";
    var root = document.getElementById("admin-root");
    var savedRepo = localStorage.getItem(GH_REPO_KEY) || guessRepo();
    root.hidden = false;
    document.body.classList.add("lock");
    root.innerHTML =
      '<div class="modal" id="admin-modal">' +
      '  <div class="sheet admin-sheet">' +
      '    <button type="button" class="close" data-admin-close aria-label="Close">×</button>' +
      '    <p class="eyebrow">Admin Access · GitHub Sync</p>' +
      '    <h2>Login with GitHub Token</h2>' +
      '    <p class="sheet-lead">Sign in with your GitHub Personal Access Token to edit products, prices, stock, and shop details live and save to Data.json.</p>' +
      '    <form id="rt-login-gh">' +
      '      <label class="field"><span>GitHub Personal Access Token</span><input id="rt-gh-token" type="password" autocomplete="off" placeholder="ghp_... or github_pat_..." required></label>' +
      '      <label class="field"><span>Repository (owner/name)</span><input id="rt-gh-repo" placeholder="username/chocolate-shop" value="' + MH.esc(savedRepo) + '" required></label>' +
      '      <p class="note">Use a token with repository Contents read/write permission. Your token stays in this browser and syncs directly with Data.json.</p>' +
      '      <p class="form-error" id="rt-gh-err" role="alert"></p>' +
      '      <button type="submit" class="btn full">Sign In with GitHub Token</button>' +
      '    </form>' +
      '  </div>' +
      '</div>';

    document.getElementById("rt-gh-token").focus();
  }

  function resizeImage(file) {
    return new Promise(function (resolve, reject) {
      var reader = new FileReader();
      reader.onerror = function () { reject(new Error("Could not read image.")); };
      reader.onload = function () {
        var img = new Image();
        img.onload = function () {
          var max = 640;
          var scale = Math.min(1, max / Math.max(img.width, img.height));
          var canvas = document.createElement("canvas");
          canvas.width = Math.max(1, Math.round(img.width * scale));
          canvas.height = Math.max(1, Math.round(img.height * scale));
          canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
          resolve(canvas.toDataURL("image/jpeg", 0.78));
        };
        img.onerror = function () { reject(new Error("Could not decode image.")); };
        img.src = reader.result;
      };
      reader.readAsDataURL(file);
    });
  }

  function categoriesDatalist() {
    var found = {};
    MH.products().forEach(function (p) { if (p.category) found[p.category] = true; });
    return Object.keys(found).sort().map(function (c) {
      return '<option value="' + MH.esc(c) + '"></option>';
    }).join("");
  }

  function openProductEditor(product) {
    if (!isActive()) { openLoginModal(); return; }
    activeModal = "product";
    editingId = product ? product.id : null;
    pendingImage = "";
    removeImageFlag = false;

    var img = product ? product.image || "" : "";
    var safe = MH.safeSrc(img);
    var root = document.getElementById("admin-root");
    root.hidden = false;
    document.body.classList.add("lock");

    root.innerHTML =
      '<div class="modal" id="admin-modal">' +
      '  <form class="sheet admin-sheet" id="rt-product-form">' +
      '    <button type="button" class="close" data-admin-close aria-label="Close">×</button>' +
      '    <h2>' + (product ? "Edit product" : "Add product") + '</h2>' +
      '    <img class="preview" id="rt-prod-preview" alt=""' + (safe ? ' src="' + MH.esc(safe) + '"' : " hidden") + '>' +
      '    <label class="field"><span>Product name</span><input id="rt-prod-name" required value="' + MH.esc(product ? product.name : "") + '"></label>' +
      '    <div class="split">' +
      '      <label class="field"><span>Price</span><input id="rt-prod-price" type="number" min="0" step="0.01" required value="' + MH.esc(product ? product.price : "") + '"></label>' +
      '      <label class="field"><span>Stock</span><input id="rt-prod-stock" type="number" min="0" step="1" required value="' + MH.esc(product ? product.stock : "20") + '"></label>' +
      '    </div>' +
      '    <div class="split">' +
      '      <label class="field"><span>Category</span><input id="rt-prod-cat" list="rt-cat-list" required value="' + MH.esc(product ? product.category : "Chocolate") + '"></label>' +
      '      <label class="field"><span>Emoji icon (optional)</span><input id="rt-prod-icon" maxlength="4" placeholder="🍫" value="' + MH.esc(product ? (product.icon || "") : "🍫") + '"></label>' +
      '    </div>' +
      '    <datalist id="rt-cat-list">' + categoriesDatalist() + '</datalist>' +
      '    <label class="field"><span>Image URL</span><input id="rt-prod-img" placeholder="assets/images/p1.jpg or https://..." value="' + MH.esc(img.indexOf("data:") === 0 ? "" : img) + '"></label>' +
      '    <div class="split">' +
      '      <label class="field"><span>Upload &amp; shrink photo</span><input id="rt-prod-file" type="file" accept="image/*"></label>' +
      '      <div class="field" style="justify-content:end">' +
      '        <button type="button" class="btn danger" id="rt-remove-img"' + (safe ? "" : " hidden") + '>Remove photo</button>' +
      '      </div>' +
      '    </div>' +
      '    <label class="field"><span>Description</span><textarea id="rt-prod-desc">' + MH.esc(product ? (product.description || "") : "") + '</textarea></label>' +
      '    <p class="form-error" id="rt-prod-err" role="alert"></p>' +
      '    <button type="submit" class="btn full">Save &amp; Update Page</button>' +
      (product ? '<p style="margin-top:10px"><button type="button" class="btn danger full" id="rt-prod-del">Delete product</button></p>' : "") +
      '  </form>' +
      '</div>';

    document.getElementById("rt-prod-name").focus();
  }

  function openManagerModal() {
    if (!isActive()) { openLoginModal(); return; }
    activeModal = "manager";
    var shop = MH.settings();
    var savedRepo = localStorage.getItem(GH_REPO_KEY) || guessRepo();
    var root = document.getElementById("admin-root");
    root.hidden = false;
    document.body.classList.add("lock");

    root.innerHTML =
      '<div class="modal" id="admin-modal">' +
      '  <div class="sheet admin-sheet">' +
      '    <button type="button" class="close" data-admin-close aria-label="Close">×</button>' +
      '    <h2>Shop Settings &amp; Data.json</h2>' +
      '    <p class="sheet-lead">Changes update the live page right away and persist to Data.json.</p>' +
      '    <form id="rt-settings-form">' +
      '      <label class="field"><span>Shop name</span><input id="rt-set-name" required value="' + MH.esc(shop.shopName) + '"></label>' +
      '      <div class="split">' +
      '        <label class="field"><span>WhatsApp number</span><input id="rt-set-wa" inputmode="numeric" required value="' + MH.esc(shop.whatsapp) + '"></label>' +
      '        <label class="field"><span>Currency</span><input id="rt-set-cur" maxlength="4" required value="' + MH.esc(shop.currency) + '"></label>' +
      '      </div>' +
      '      <button type="submit" class="btn full">Apply Shop Settings Live</button>' +
      '    </form>' +
      '    <hr class="admin-sep">' +
      '    <h3>Data.json Sync &amp; Backup</h3>' +
      '    <p class="admin-status-line" id="admin-panel-status">' + MH.esc(statusMessage || "Ready") + '</p>' +
      '    <div class="admin-btn-grid">' +
      '      <button type="button" class="btn dark" id="rt-save-json">Save to Data.json</button>' +
      '      <button type="button" class="btn" id="rt-download-json">Download Data.json</button>' +
      '      <label class="btn ghost admin-file-btn">Import Data.json<input id="rt-import-json" type="file" accept=".json,application/json" hidden></label>' +
      '      <button type="button" class="btn danger" id="rt-reload-json">Reload from Data.json</button>' +
      '    </div>' +
      '    <hr class="admin-sep">' +
      '    <h3>GitHub Repository Sync</h3>' +
      '    <form id="rt-gh-connect">' +
      '      <label class="field"><span>GitHub Token</span><input id="rt-gh-token-2" type="password" autocomplete="off" placeholder="' + (localStorage.getItem(GH_TOKEN_KEY) ? "Saved in browser (enter new to change)" : "ghp_...") + '"></label>' +
      '      <label class="field"><span>Repository (owner/name)</span><input id="rt-gh-repo-2" placeholder="username/chocolate-shop" value="' + MH.esc(savedRepo) + '"></label>' +
      '      <div class="admin-btn-grid">' +
      '        <button type="submit" class="btn">Connect / Save to GitHub</button>' +
      (hasGitHubAuth() ? '        <button type="button" class="btn danger" id="rt-gh-disconnect">Disconnect GitHub</button>' : "") +
      '      </div>' +
      '    </form>' +
      '  </div>' +
      '</div>';
  }

  function downloadDataJson() {
    var payload = JSON.stringify(MH.exportData(), null, 2) + "\n";
    var blob = new Blob([payload], { type: "application/json" });
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a");
    a.href = url;
    a.download = "Data.json";
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
    setStatus("Downloaded Data.json", false);
  }

  function adjustStock(id, delta) {
    var list = MH.products().slice();
    var changed = false;
    list = list.map(function (item) {
      if (item.id !== id) return item;
      changed = true;
      var next = Object.assign({}, item, {
        stock: Math.max(0, Math.floor(Number(item.stock) || 0) + delta)
      });
      return next;
    });
    if (!changed) return;
    MH.saveProducts(list, { dirty: true });
    refreshUI();
    persistRuntimeChanges(true);
  }

  function deleteProduct(id) {
    var product = MH.products().filter(function (p) { return p.id === id; })[0];
    if (!product) return;
    if (!confirm('Delete "' + product.name + '"?')) return;
    var next = MH.products().filter(function (p) { return p.id !== id; });
    MH.saveProducts(next, { dirty: true });
    if (activeModal === "product" && editingId === id) closeModal();
    refreshUI();
    persistRuntimeChanges(true);
  }

  function saveProductForm(event) {
    event.preventDefault();
    var err = document.getElementById("rt-prod-err");
    var name = document.getElementById("rt-prod-name").value.trim();
    var price = Number(document.getElementById("rt-prod-price").value);
    var stock = Math.floor(Number(document.getElementById("rt-prod-stock").value));
    var category = document.getElementById("rt-prod-cat").value.trim() || "Chocolate";
    var icon = document.getElementById("rt-prod-icon").value.trim();
    var description = document.getElementById("rt-prod-desc").value.trim();
    var imageUrl = document.getElementById("rt-prod-img").value.trim();

    if (!name) { err.textContent = "Enter a product name."; return; }
    if (!isFinite(price) || price < 0) { err.textContent = "Enter a valid price."; return; }
    if (!isFinite(stock) || stock < 0) { err.textContent = "Enter a stock quantity of zero or more."; return; }

    var current = MH.products().slice();
    var existing = current.filter(function (p) { return p.id === editingId; })[0] || null;

    var image = "";
    if (pendingImage) {
      image = pendingImage;
    } else if (imageUrl) {
      image = imageUrl;
    } else if (!removeImageFlag && existing) {
      image = existing.image || "";
    }

    if (image && !MH.safeSrc(image)) {
      err.textContent = "Use an image URL starting with assets/, https://, http://, or upload a photo.";
      return;
    }

    var nextItem = {
      id: existing ? existing.id : ("p" + Date.now()),
      name: name,
      price: price,
      stock: stock,
      category: category,
      icon: icon,
      image: image,
      description: description
    };

    if (existing) {
      current = current.map(function (p) { return p.id === existing.id ? nextItem : p; });
    } else {
      current.push(nextItem);
    }

    if (!MH.saveProducts(current, { dirty: true })) {
      err.textContent = "Browser storage is full. Use a smaller image or image URL.";
      return;
    }

    closeModal();
    refreshUI();
    persistRuntimeChanges(false);
  }

  function handleBodyClick(event) {
    var closeBtn = event.target.closest("[data-admin-close]");
    if (closeBtn || event.target.id === "admin-modal") {
      closeModal();
      return;
    }

    var cardActBtn = event.target.closest("[data-admin-act]");
    if (cardActBtn) {
      var act = cardActBtn.dataset.adminAct;
      var id = cardActBtn.dataset.id;
      if (act === "stock-inc") adjustStock(id, 1);
      else if (act === "stock-dec") adjustStock(id, -1);
      else if (act === "edit") {
        var prod = MH.products().filter(function (p) { return p.id === id; })[0];
        if (prod) openProductEditor(prod);
      } else if (act === "del") {
        deleteProduct(id);
      }
      return;
    }

    if (event.target.id === "rt-remove-img") {
      pendingImage = "";
      removeImageFlag = true;
      document.getElementById("rt-prod-img").value = "";
      var preview = document.getElementById("rt-prod-preview");
      preview.hidden = true;
      preview.removeAttribute("src");
      event.target.hidden = true;
      return;
    }

    if (event.target.id === "rt-prod-del" && editingId) {
      deleteProduct(editingId);
      return;
    }

    if (event.target.id === "rt-save-json") {
      persistRuntimeChanges(false);
      return;
    }

    if (event.target.id === "rt-download-json") {
      downloadDataJson();
      return;
    }

    if (event.target.id === "rt-reload-json") {
      if (!confirm("Reload catalog from Data.json? Unsaved browser-only changes will be replaced.")) return;
      setStatus("Reloading from Data.json...", false);
      MH.loadRemoteData(true).then(function (res) {
        if (res.loaded) {
          setStatus("Reloaded from " + res.file, false);
          if (activeModal === "manager") openManagerModal();
        } else {
          setStatus("Could not fetch Data.json from server.", true);
        }
      });
      return;
    }

    if (event.target.id === "rt-gh-disconnect") {
      exitAdmin();
    }
  }

  function handleRootSubmit(event) {
    if (event.target.id === "rt-login-gh") {
      event.preventDefault();
      var token = document.getElementById("rt-gh-token").value.trim();
      var repo = document.getElementById("rt-gh-repo").value.trim();
      var ghErr = document.getElementById("rt-gh-err");
      if (!token || !/^[^\/\s]+\/[^\/\s]+$/.test(repo)) {
        ghErr.textContent = "Enter a valid GitHub token and repository (owner/name).";
        return;
      }
      localStorage.setItem(GH_TOKEN_KEY, token);
      localStorage.setItem(GH_REPO_KEY, repo);
      ghErr.textContent = "Connecting to GitHub...";
      fetchGitHubData().then(function (res) {
        MH.applyData(res.data, { dirty: false, source: res.file });
        closeModal();
        setStatus("Connected to GitHub (" + res.file + ")", false);
        refreshUI();
      }).catch(function (errObj) {
        localStorage.removeItem(GH_TOKEN_KEY);
        ghErr.textContent = (errObj && errObj.message) || "Could not connect to GitHub.";
      });
      return;
    }

    if (event.target.id === "rt-product-form") {
      saveProductForm(event);
      return;
    }

    if (event.target.id === "rt-settings-form") {
      event.preventDefault();
      var name = document.getElementById("rt-set-name").value.trim();
      var wa = document.getElementById("rt-set-wa").value.replace(/\D/g, "");
      var cur = document.getElementById("rt-set-cur").value.trim() || "₹";
      if (!name || wa.length < 10) {
        setStatus("Enter a shop name and valid WhatsApp number with country code.", true);
        return;
      }
      MH.saveSettings({ shopName: name, whatsapp: wa, currency: cur.slice(0, 4) }, { dirty: true });
      refreshUI();
      persistRuntimeChanges(false);
      return;
    }

    if (event.target.id === "rt-gh-connect") {
      event.preventDefault();
      var tok = document.getElementById("rt-gh-token-2").value.trim() || localStorage.getItem(GH_TOKEN_KEY) || "";
      var rep = document.getElementById("rt-gh-repo-2").value.trim();
      if (!tok || !/^[^\/\s]+\/[^\/\s]+$/.test(rep)) {
        setStatus("Enter a GitHub token and repository as owner/name.", true);
        return;
      }
      localStorage.setItem(GH_TOKEN_KEY, tok);
      localStorage.setItem(GH_REPO_KEY, rep);
      persistRuntimeChanges(false).then(function () {
        refreshUI();
        if (activeModal === "manager") openManagerModal();
      });
    }
  }

  function handleRootChange(event) {
    if (event.target.id === "rt-prod-file") {
      var file = event.target.files && event.target.files[0];
      var err = document.getElementById("rt-prod-err");
      if (!file) return;
      resizeImage(file).then(function (url) {
        pendingImage = url;
        removeImageFlag = false;
        var preview = document.getElementById("rt-prod-preview");
        preview.src = url;
        preview.hidden = false;
        document.getElementById("rt-remove-img").hidden = false;
        err.textContent = "";
      }).catch(function () {
        err.textContent = "Could not read that image.";
      });
      return;
    }

    if (event.target.id === "rt-import-json") {
      var jsonFile = event.target.files && event.target.files[0];
      if (!jsonFile) return;
      var reader = new FileReader();
      reader.onload = function () {
        try {
          var parsed = JSON.parse(reader.result);
          MH.applyData(parsed, { dirty: true, source: jsonFile.name });
          refreshUI();
          persistRuntimeChanges(false);
          if (activeModal === "manager") openManagerModal();
        } catch (err) {
          setStatus("Invalid JSON file.", true);
        }
      };
      reader.readAsText(jsonFile);
    }
  }

  function exitAdmin() {
    localStorage.removeItem(GH_TOKEN_KEY);
    localStorage.removeItem(GH_REPO_KEY);
    localStorage.removeItem(GH_FILE_KEY);
    statusMessage = "";
    statusIsError = false;
    closeModal();
    refreshUI();
    if (location.hash === "#admin") history.replaceState(null, "", location.pathname + location.search);
  }

  document.addEventListener("DOMContentLoaded", function () {
    document.getElementById("open-admin").addEventListener("click", function () {
      if (isActive()) openManagerModal();
      else openLoginModal();
    });
    document.getElementById("admin-add-btn").addEventListener("click", function () { openProductEditor(null); });
    document.getElementById("admin-manage-btn").addEventListener("click", openManagerModal);
    document.getElementById("admin-save-btn").addEventListener("click", function () { persistRuntimeChanges(false); });
    document.getElementById("admin-exit-btn").addEventListener("click", exitAdmin);

    document.body.addEventListener("click", handleBodyClick);
    var root = document.getElementById("admin-root");
    root.addEventListener("submit", handleRootSubmit);
    root.addEventListener("change", handleRootChange);

    document.addEventListener("keydown", function (event) {
      if (event.key === "Escape" && activeModal) closeModal();
    });

    updateAdminBar();
    if (location.hash === "#admin") {
      if (isActive()) openManagerModal();
      else openLoginModal();
    }
  });

  window.MHAdmin = {
    isActive: isActive,
    openLogin: openLoginModal,
    openManager: openManagerModal,
    openProductEditor: openProductEditor
  };
})();
