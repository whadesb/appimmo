/* public/js/landing.js — comportements des landing pages UAP Immo
   Chargé en defer. Aucune dépendance au chargement : Leaflet n'est
   téléchargé que si la carte entre réellement dans le champ de vision. */

(function () {
  'use strict';

  /* ---------- Carte : chargement différé ------------------------------- */

  var LEAFLET_CSS = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
  var LEAFLET_JS = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';

  function loadAsset(tag, attrs) {
    return new Promise(function (resolve, reject) {
      var el = document.createElement(tag);
      Object.keys(attrs).forEach(function (k) { el[k] = attrs[k]; });
      el.onload = resolve;
      el.onerror = function () { reject(new Error('Chargement impossible : ' + (attrs.href || attrs.src))); };
      document.head.appendChild(el);
    });
  }

  function showMapFallback(node, message) {
    node.textContent = message;
    node.style.display = 'flex';
    node.style.alignItems = 'center';
    node.style.justifyContent = 'center';
    node.style.fontSize = '14px';
    node.style.color = 'var(--muted)';
  }

  function initMap(node) {
    var city = node.dataset.city || '';
    var country = node.dataset.country || '';
    var postal = node.dataset.postal || '';
    if (!city && !postal) { showMapFallback(node, 'Localisation non renseignée.'); return; }

    var query = [postal, city, country].filter(Boolean).join(', ');
    var cacheKey = 'uap-geo-' + query;
    var cached = null;
    try { cached = JSON.parse(sessionStorage.getItem(cacheKey)); } catch (e) { cached = null; }

    function draw(lat, lon) {
      /* eslint-disable no-undef */
      var map = L.map(node, { scrollWheelZoom: false, attributionControl: true }).setView([lat, lon], 13);
           L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap',
        maxZoom: 18
      }).addTo(map);
      // Zone approximative : l'adresse exacte n'est pas publiée.
      L.circle([lat, lon], {
        radius: 700,
        color: getComputedStyle(document.body).getPropertyValue('--accent').trim() || '#19483A',
        weight: 2,
        fillOpacity: 0.12
      }).addTo(map);
      /* eslint-enable no-undef */
    }

    function geocodeThenDraw() {
      if (cached && cached.lat) { draw(cached.lat, cached.lon); return Promise.resolve(); }
      return fetch('https://nominatim.openstreetmap.org/search?format=json&limit=1&q=' + encodeURIComponent(query), {
        headers: { 'Accept': 'application/json' }
      })
        .then(function (r) { return r.ok ? r.json() : Promise.reject(new Error('geocodage')); })
        .then(function (results) {
          if (!results || !results.length) throw new Error('introuvable');
          var lat = parseFloat(results[0].lat);
          var lon = parseFloat(results[0].lon);
          try { sessionStorage.setItem(cacheKey, JSON.stringify({ lat: lat, lon: lon })); } catch (e) { /* quota */ }
          draw(lat, lon);
        });
    }

    Promise.all([
      loadAsset('link', { rel: 'stylesheet', href: LEAFLET_CSS }),
      loadAsset('script', { src: LEAFLET_JS })
    ])
      .then(geocodeThenDraw)
      .catch(function () { showMapFallback(node, 'Carte non disponible — ' + query); });
  }

  var mapNode = document.getElementById('map');
  if (mapNode) {
    if ('IntersectionObserver' in window) {
      var observer = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) { observer.disconnect(); initMap(mapNode); }
        });
      }, { rootMargin: '300px' });
      observer.observe(mapNode);
    } else {
      initMap(mapNode);
    }
  }

  /* ---------- Visionneuse photo ---------------------------------------- */

  var sources = [];
  document.querySelectorAll('.gallery img, .thumbs img').forEach(function (img) {
    if (sources.indexOf(img.src) === -1) sources.push(img.src);
  });
  document.querySelectorAll('[data-photos]').forEach(function (node) {
    (node.dataset.photos || '').split('|').filter(Boolean).forEach(function (src) {
      if (sources.indexOf(src) === -1) sources.push(src);
    });
  });

  if (sources.length) {
    var index = 0;
    var lastFocused = null;

    var box = document.createElement('div');
    box.className = 'lightbox';
    box.setAttribute('role', 'dialog');
    box.setAttribute('aria-modal', 'true');
    box.setAttribute('aria-label', 'Galerie photo');
    box.hidden = true;
    box.innerHTML =
      '<button type="button" class="lightbox__close" aria-label="Fermer la galerie">&times;</button>' +
      '<button type="button" class="lightbox__nav lightbox__nav--prev" aria-label="Photo précédente">&#8249;</button>' +
      '<img class="lightbox__img" alt="">' +
      '<button type="button" class="lightbox__nav lightbox__nav--next" aria-label="Photo suivante">&#8250;</button>' +
      '<p class="lightbox__count" aria-live="polite"></p>';
    document.body.appendChild(box);

    var style = document.createElement('style');
    style.textContent =
      '.lightbox{position:fixed;inset:0;z-index:100;background:rgba(10,16,14,.94);' +
      'display:flex;align-items:center;justify-content:center;gap:12px;padding:20px}' +
      '.lightbox[hidden]{display:none}' +
      '.lightbox__img{max-width:88vw;max-height:82vh;object-fit:contain;border-radius:8px}' +
      '.lightbox__close{position:absolute;top:16px;right:16px;width:48px;height:48px;' +
      'font-size:28px;line-height:1;background:transparent;border:0;color:#fff;cursor:pointer}' +
      '.lightbox__nav{width:48px;height:48px;font-size:30px;line-height:1;background:transparent;' +
      'border:0;color:#fff;cursor:pointer;flex-shrink:0}' +
      '.lightbox__count{position:absolute;bottom:20px;left:0;right:0;text-align:center;' +
      'color:#fff;font-size:14px;margin:0}' +
      '@media(max-width:768px){.lightbox__nav{position:absolute;bottom:60px}' +
      '.lightbox__nav--prev{left:12px}.lightbox__nav--next{right:12px}}';
    document.head.appendChild(style);

    var imgEl = box.querySelector('.lightbox__img');
    var countEl = box.querySelector('.lightbox__count');

    function render() {
      imgEl.src = sources[index];
      imgEl.alt = 'Photo ' + (index + 1) + ' sur ' + sources.length;
      countEl.textContent = (index + 1) + ' / ' + sources.length;
    }
    function open(i) {
      lastFocused = document.activeElement;
      index = i;
      render();
      box.hidden = false;
      document.body.style.overflow = 'hidden';
      box.querySelector('.lightbox__close').focus();
    }
    function close() {
      box.hidden = true;
      document.body.style.overflow = '';
      if (lastFocused && lastFocused.focus) lastFocused.focus();
    }
    function step(delta) {
      index = (index + delta + sources.length) % sources.length;
      render();
    }

    box.querySelector('.lightbox__close').addEventListener('click', close);
    box.querySelector('.lightbox__nav--prev').addEventListener('click', function () { step(-1); });
    box.querySelector('.lightbox__nav--next').addEventListener('click', function () { step(1); });
    box.addEventListener('click', function (e) { if (e.target === box) close(); });

    box.addEventListener('keydown', function (e) {
      if (box.hidden) return;
      if (e.key === 'Escape') { close(); }
      else if (e.key === 'ArrowLeft') { step(-1); }
      else if (e.key === 'ArrowRight') { step(1); }
      else if (e.key === 'Tab') {
        var focusables = box.querySelectorAll('button');
        var first = focusables[0];
        var last = focusables[focusables.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    });

    document.querySelectorAll('.gallery figure, .thumbs figure').forEach(function (fig) {
      var img = fig.querySelector('img');
      if (!img) return;
      var position = sources.indexOf(img.src);
      var trigger = document.createElement('button');
      trigger.type = 'button';
      trigger.setAttribute('aria-label', 'Agrandir la photo ' + (position + 1));
      trigger.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;background:transparent;border:0;cursor:zoom-in;padding:0';
      fig.style.position = 'relative';
      fig.appendChild(trigger);
      trigger.addEventListener('click', function () { open(position); });
    });
  }

  /* ---------- Défilement doux ------------------------------------------ */

  document.querySelectorAll('a[href^="#"]').forEach(function (link) {
    link.addEventListener('click', function (e) {
      var target = document.querySelector(link.getAttribute('href'));
      if (!target) return;
      e.preventDefault();
      var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      target.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
    });
  });
})();
