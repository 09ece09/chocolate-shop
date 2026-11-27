/**
 * M.H Chocolate Shop — Luxury Animations v2
 * Pure vanilla JS + GSAP (loaded via CDN, no build step needed).
 * Falls back gracefully if GSAP hasn't loaded (GitHub Pages CDN latency).
 * All 3D parallax / tilt logic lives here, keeping cart.js / app.js untouched.
 */
(function () {
  'use strict';

  /* ── Helpers ─────────────────────────────────────────── */

  var prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var isMobile = window.innerWidth < 768;
  var hasFinePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  var enableHeavy = !prefersReduced && !isMobile;
  var enableTilt = !prefersReduced && hasFinePointer;

  window.addEventListener('resize', function () {
    isMobile = window.innerWidth < 768;
    enableHeavy = !prefersReduced && !isMobile;
    enableTilt = !prefersReduced && hasFinePointer;
  }, { passive: true });

  /* ── Preloader dismiss ───────────────────────────────── */
  function dismissPreloader() {
    var loader = document.getElementById('preloader');
    if (!loader) return;
    loader.classList.add('hidden');
    // Fully remove from DOM after animation completes
    setTimeout(function () { loader.remove(); }, 650);
  }

  /* ── Scroll-triggered reveal (IntersectionObserver) ─── */
  function initScrollReveal() {
    var targets = document.querySelectorAll('.js-scroll-reveal, .js-reveal-left, .js-reveal-right');
    if (!targets.length) return;

    if (prefersReduced) {
      targets.forEach(function (el) { el.classList.add('revealed'); });
      return;
    }

    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add('revealed');
          io.unobserve(entry.target);
        }
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });

    targets.forEach(function (el) { io.observe(el); });
  }

  /* ── Animated stat counters ─────────────────────────── */
  function animateCounter(el) {
    var target = parseInt(el.dataset.count, 10) || 0;
    var suffix = el.dataset.suffix || '';
    var start = performance.now();
    var duration = 1300;

    function update(now) {
      var progress = Math.min((now - start) / duration, 1);
      // Ease out cubic
      var eased = 1 - Math.pow(1 - progress, 3);
      el.textContent = Math.round(eased * target) + suffix;
      if (progress < 1) requestAnimationFrame(update);
    }

    requestAnimationFrame(update);
  }

  function initCounters() {
    var counters = document.querySelectorAll('.stat-num[data-count]');
    if (!counters.length) return;

    if (prefersReduced) {
      counters.forEach(function (el) {
        el.textContent = el.dataset.count + (el.dataset.suffix || '');
      });
      return;
    }

    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          animateCounter(entry.target);
          io.unobserve(entry.target);
        }
      });
    }, { threshold: 0.4 });

    counters.forEach(function (el) { io.observe(el); });
  }

  /* ── Sticky header shrink on scroll ─────────────────── */
  function initHeaderScroll() {
    var header = document.getElementById('site-header');
    if (!header) return;

    var lastScrollY = 0;
    function onScroll() {
      var sy = window.scrollY;
      header.classList.toggle('scrolled', sy > 32);
      lastScrollY = sy;
    }

    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
  }

  /* ── Search bar clear button ─────────────────────────── */
  function initSearchClear() {
    var input = document.getElementById('search');
    var clear = document.getElementById('search-clear');
    if (!input || !clear) return;

    input.addEventListener('input', function () {
      clear.hidden = !input.value;
    });

    clear.addEventListener('click', function () {
      input.value = '';
      input.dispatchEvent(new Event('input'));
      clear.hidden = true;
      input.focus();
    });
  }

  /* ── 3D hero mouse parallax / gyroscope ─────────────── */
  function initHeroParallax() {
    if (prefersReduced) return;

    var stage = document.getElementById('hero-stage');
    var photoFrame = document.getElementById('hero-photo-frame');
    var mainWrap = document.getElementById('hero-main-wrap');
    var cardBack = document.getElementById('stage-card-back');
    var cardSide = document.getElementById('stage-card-side');
    var glassNote = document.getElementById('glass-note');

    if (!stage || !photoFrame) return;

    // Smooth lerp target values
    var nx = 0, ny = 0;       // normalised pointer -1..1
    var cx = 0, cy = 0;       // current smoothed
    var raf = null;

    function lerp(a, b, t) { return a + (b - a) * t; }

    function tick() {
      // Smooth toward target
      var smooth = isMobile ? 0.06 : 0.08;
      cx = lerp(cx, nx, smooth);
      cy = lerp(cy, ny, smooth);

      if (!isMobile && enableTilt) {
        // 3D tilt on main frame
        photoFrame.style.transform =
          'translateZ(68px) rotateY(' + (cx * 9) + 'deg) rotateX(' + (-cy * 7) + 'deg)';
      }

      if (mainWrap) {
        mainWrap.style.transform =
          'translateX(' + (cx * 10) + 'px) translateY(' + (cy * 8) + 'px)';
      }

      // Secondary cards move in opposite / different speeds for depth
      if (cardBack) {
        cardBack.style.transform =
          'rotate(-6deg) translateZ(20px) translateX(' + (-cx * 18) + 'px) translateY(' + (-cy * 14) + 'px)';
      }
      if (cardSide) {
        cardSide.style.transform =
          'rotate(7deg) translateZ(36px) translateX(' + (-cx * 22) + 'px) translateY(' + (-cy * 16) + 'px)';
      }
      if (glassNote) {
        glassNote.style.transform =
          'translateZ(96px) translateX(' + (-cx * 26) + 'px) translateY(' + (-cy * 18) + 'px)';
      }

      raf = requestAnimationFrame(tick);
    }

    // Desktop: mouse movement over the whole hero
    var hero = document.getElementById('hero');
    if (hero && enableTilt) {
      hero.addEventListener('mousemove', function (e) {
        var rect = stage.getBoundingClientRect();
        nx = Math.max(-1, Math.min(1, ((e.clientX - rect.left) / rect.width) * 2 - 1));
        ny = Math.max(-1, Math.min(1, ((e.clientY - rect.top) / rect.height) * 2 - 1));
      }, { passive: true });

      hero.addEventListener('mouseleave', function () {
        nx = 0; ny = 0;
      });
    }

    // Mobile: gyroscope (only if DeviceOrientationEvent doesn't require permission — Android / older iOS)
    if (isMobile && typeof window.DeviceOrientationEvent !== 'undefined') {
      var needsPermission = typeof window.DeviceOrientationEvent.requestPermission === 'function';
      if (!needsPermission) {
        window.addEventListener('deviceorientation', function (e) {
          if (e.gamma == null || e.beta == null) return;
          nx = Math.max(-1, Math.min(1, e.gamma / 30)) * 0.5;
          ny = Math.max(-1, Math.min(1, (e.beta - 40) / 30)) * 0.5;
        }, { passive: true });
      }
    }

    raf = requestAnimationFrame(tick);
  }

  /* ── Cinematic hero entrance with GSAP ──────────────── */
  function initHeroEntrance() {
    if (prefersReduced) {
      // Instantly reveal without animation
      var items = document.querySelectorAll(
        '.eyebrow, .hero-heading, .hero-lede, .hero-actions, .hero-stats, ' +
        '#hero-main-wrap, #stage-card-back, #stage-card-side, #glass-note'
      );
      items.forEach(function (el) {
        el.style.opacity = '1';
        el.style.transform = 'none';
      });
      return;
    }

    // If GSAP loaded (CDN), use it for cinematic sequences
    if (typeof gsap !== 'undefined') {
      var tl = gsap.timeline({ defaults: { ease: 'power3.out' } });

      // Hero text column
      tl.from('.eyebrow',      { opacity: 0, y: 20, duration: 0.7 }, 0.05)
        .from('.hero-heading', { opacity: 0, y: 32, duration: 0.85 }, 0.12)
        .from('.hero-lede',    { opacity: 0, y: 24, duration: 0.75 }, 0.22)
        .from('.hero-actions', { opacity: 0, y: 20, duration: 0.7 }, 0.30)
        .from('.hero-stats',   { opacity: 0, y: 16, duration: 0.65 }, 0.38);

      // 3D cinematic product entrance: rotates from 15deg to 0deg
      tl.from('#hero-main-wrap', {
        opacity: 0,
        scale: 0.88,
        rotationY: 15,
        y: 44,
        duration: 1.1,
        ease: 'power2.out'
      }, 0.14);

      // Secondary cards stagger in
      tl.from('#stage-card-back', { opacity: 0, x: -40, y: 24, rotation: -18, duration: 0.9, ease: 'back.out(1.4)' }, 0.22)
        .from('#stage-card-side', { opacity: 0, x: 40, y: -20, rotation: 18, duration: 0.9, ease: 'back.out(1.4)' }, 0.30)
        .from('#glass-note',      { opacity: 0, y: 32, scale: 0.9, duration: 0.85, ease: 'back.out(1.4)' }, 0.42);

      // Slow background gradient drift
      gsap.to('.ambient-gradient', { x: '2%', y: '-2%', scale: 1.06, duration: 16, repeat: -1, yoyo: true, ease: 'sine.inOut' });
    } else {
      // No GSAP — use CSS transitions instead (fallback)
      var delay = 50;
      var items = [
        { sel: '.eyebrow',       d: delay },
        { sel: '.hero-heading',  d: delay + 80 },
        { sel: '.hero-lede',     d: delay + 160 },
        { sel: '.hero-actions',  d: delay + 230 },
        { sel: '.hero-stats',    d: delay + 300 },
        { sel: '#hero-main-wrap', d: delay + 100 },
        { sel: '#stage-card-back', d: delay + 180 },
        { sel: '#stage-card-side', d: delay + 260 },
        { sel: '#glass-note',     d: delay + 350 }
      ];

      // Pre-hide
      items.forEach(function (item) {
        var el = document.querySelector(item.sel);
        if (el) {
          el.style.opacity = '0';
          el.style.transform = 'translateY(24px)';
          el.style.transition = 'opacity 0.75s cubic-bezier(0.22,1,0.36,1), transform 0.75s cubic-bezier(0.22,1,0.36,1)';
        }
      });

      // Stagger reveal
      items.forEach(function (item) {
        setTimeout(function () {
          var el = document.querySelector(item.sel);
          if (el) {
            el.style.opacity = '1';
            el.style.transform = 'none';
          }
        }, item.d);
      });
    }
  }

  /* ── Scroll parallax background (subtle, mobile-off) ── */
  function initScrollParallax() {
    if (prefersReduced || isMobile) return;

    var hero = document.getElementById('hero');
    if (!hero) return;

    function onScroll() {
      var sy = window.scrollY;
      var stage = document.getElementById('hero-stage');
      if (stage) {
        stage.style.transform = 'translateY(' + (sy * -0.055) + 'px)';
      }
    }

    window.addEventListener('scroll', onScroll, { passive: true });
  }

  /* ── WhatsApp CTA section button binding ─────────────── */
  function initWACTA() {
    var ctaBtn = document.getElementById('wa-cta-order');
    var basketBtn = document.getElementById('wa-view-basket');

    // We'll open the order modal for basket — MHStorefront.openOrder if available
    function openOrder() {
      if (window.MHStorefront && typeof window.MHStorefront.openOrder === 'function') {
        window.MHStorefront.openOrder();
      } else {
        // Fallback: dispatch a click on float-cart
        var fc = document.getElementById('float-cart');
        if (fc) fc.click();
      }
    }

    if (ctaBtn) {
      ctaBtn.addEventListener('click', function () {
        // Build WhatsApp URL using the shared MH library
        var url = typeof MH !== 'undefined' ? MH.whatsappUrl() : '';
        if (url) {
          // If cart has items, open order modal first; else open blank WA chat
          if (typeof MH !== 'undefined' && MH.totals().qty > 0) {
            openOrder();
          } else {
            var wa = typeof MH !== 'undefined' ? MH.settings().whatsapp : '916296609958';
            var digits = String(wa).replace(/\D/g, '');
            var shopName = typeof MH !== 'undefined' ? MH.settings().shopName : 'M.H Chocolate Shop';
            var text = encodeURIComponent('Hello ' + shopName + ', I would like to place an order.');
            window.open('https://wa.me/' + digits + '?text=' + text, '_blank', 'noopener,noreferrer');
          }
        } else {
          // No MH yet — just trigger order modal
          openOrder();
        }
      });
    }

    if (basketBtn) {
      basketBtn.addEventListener('click', openOrder);
    }
  }

  /* ── Card tilt effect (desktop hover) ───────────────── */
  function initCardTilt() {
    if (!enableTilt) return;

    // Delegate: attach to grid, listen to card hovers
    var grid = document.getElementById('grid');
    if (!grid) return;

    function onCardMouseMove(e) {
      var card = e.target.closest('.card');
      if (!card) return;
      var rect = card.getBoundingClientRect();
      var cx2 = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      var cy2 = ((e.clientY - rect.top) / rect.height) * 2 - 1;
      card.style.transform =
        'translateY(-8px) rotateX(' + (-cy2 * 4) + 'deg) rotateY(' + (cx2 * 5) + 'deg)';
      card.style.boxShadow =
        '0 28px 56px rgba(45,27,20,0.16), ' +
        (cx2 * -6) + 'px ' + (cy2 * -4 + 20) + 'px 36px rgba(45,27,20,0.10)';
    }

    function onCardMouseLeave(e) {
      var card = e.target.closest('.card');
      if (!card) return;
      card.style.transform = '';
      card.style.boxShadow = '';
    }

    grid.addEventListener('mousemove', onCardMouseMove, { passive: true });
    grid.addEventListener('mouseleave', onCardMouseLeave, true);
  }

  /* ── Float cart pop animation hook ─────────────────── */
  // The original app.js already does .pop class — we just ensure the CSS animation works.
  // No action needed here; CSS handles it.

  /* ── GSAP scroll-triggered section reveals ──────────── */
  function initGSAPScrollTrigger() {
    if (prefersReduced || typeof gsap === 'undefined' || typeof ScrollTrigger === 'undefined') return;

    gsap.registerPlugin(ScrollTrigger);

    // Trust ribbon parallax text
    gsap.from('.trust-item', {
      scrollTrigger: { trigger: '.trust-ribbon', start: 'top 85%' },
      opacity: 0, y: 20, stagger: 0.1, duration: 0.65, ease: 'power2.out'
    });

    // Catalog heading
    gsap.from('.catalog-head', {
      scrollTrigger: { trigger: '.catalog-head', start: 'top 85%' },
      opacity: 0, y: 24, duration: 0.75, ease: 'power2.out'
    });

    // WA CTA heading
    gsap.from('.wa-cta-heading, .wa-cta-text, .wa-cta-actions', {
      scrollTrigger: { trigger: '.wa-cta', start: 'top 75%' },
      opacity: 0, y: 32, stagger: 0.12, duration: 0.9, ease: 'power2.out'
    });
  }

  /* ── Init sequence ───────────────────────────────────── */
  function init() {
    // Dismiss preloader immediately when DOM is ready
    dismissPreloader();

    initHeaderScroll();
    initSearchClear();
    initScrollReveal();
    initCounters();
    initWACTA();
    initCardTilt();
    initScrollParallax();

    // Hero entrance after a micro-frame to allow layout
    requestAnimationFrame(function () {
      initHeroEntrance();
      initHeroParallax();
    });

    // GSAP scroll triggers — GSAP is deferred so wait a tick
    setTimeout(initGSAPScrollTrigger, 400);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  /* ── Expose openOrder for WA CTA button ─────────────── */
  // Patch MHStorefront to expose openOrder when app.js sets it up
  window.addEventListener('DOMContentLoaded', function () {
    // app.js sets window.MHStorefront = { refresh }
    // We wire openOrder via the existing button IDs
    var heroOrder = document.getElementById('hero-order');
    if (heroOrder) {
      heroOrder.addEventListener('click', function () {
        var viewOrder = document.getElementById('view-order');
        if (viewOrder) viewOrder.click();
      });
    }
  });

})();
