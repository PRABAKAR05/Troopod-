/* =================================================================
   PURELANE THEME — purelane.js
   Section-scoped, Theme-Editor-safe port of the original animation JS.
   All IDs replaced with section.querySelector() calls.
   ================================================================= */

(function () {
  'use strict';

  /* ----------------------------------------------------------------
     GLOBAL STATE (shared across section instances)
  ---------------------------------------------------------------- */
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var scenes  = null;   // .purelane-scenes element
  var current = 0;
  var mx = 0, my = 0;
  var rafId = null;

  /* ----------------------------------------------------------------
     SCENE CROSSFADE (scroll-driven background transitions)
  ---------------------------------------------------------------- */
  function initScenes() {
    scenes = document.querySelector('.purelane-scenes');
    if (!scenes) return;

    var sceneEls = [].slice.call(scenes.querySelectorAll('.purelane-scene'));
    var zones = [].slice.call(document.querySelectorAll('[data-scene]'));

    function setScene(n) {
      if (n === current) return;
      current = n;
      sceneEls.forEach(function (s, i) { s.classList.toggle('on', i + 1 === n); });
      scenes.setAttribute('data-d', String(n));
    }

    function pickScene() {
      var focus = window.scrollY + window.innerHeight * 0.5;
      var n = 1;
      zones.forEach(function (z) {
        var top = 0, el = z;
        while (el) { top += el.offsetTop; el = el.offsetParent; }
        if (top <= focus) n = parseInt(z.getAttribute('data-scene'), 10) || n;
      });
      setScene(n);
    }

    return pickScene;
  }

  /* ----------------------------------------------------------------
     SIDE RAIL SYNC
  ---------------------------------------------------------------- */
  function initRail() {
    var railLinks = [].slice.call(document.querySelectorAll('.purelane-rail a'));
    if (!railLinks.length) return null;
    var targets = railLinks.map(function (a) {
      return document.querySelector(a.getAttribute('href'));
    });
    return function syncRail() {
      var mid = window.scrollY + window.innerHeight * 0.42;
      var idx = 0;
      targets.forEach(function (t, i) { if (t && t.offsetTop <= mid) idx = i; });
      railLinks.forEach(function (a, i) { a.classList.toggle('on', i === idx); });
    };
  }

  /* ----------------------------------------------------------------
     WATER PARALLAX + HEADER COLLAPSE
  ---------------------------------------------------------------- */
  function initScrollEffects(pickScene, syncRail) {
    var hdr  = document.querySelector('.purelane-header');
    var prod = document.querySelector('.purelane-hero-prod');

    function frame() {
      rafId = null;
      var y = window.scrollY || window.pageYOffset;

      /* header pill collapse */
      if (hdr) hdr.classList.toggle('up', y > 90);

      if (!reduce) {
        /* water layer parallax */
        var wls = document.querySelectorAll('.purelane-water .purelane-wl');
        var factors = [0.05, 0.09, 0.03, 0.02];
        [].slice.call(wls).forEach(function (wl, i) {
          var d = factors[i] || 0.05;
          wl.style.setProperty('--px', (mx * d * 130).toFixed(1) + 'px');
          wl.style.setProperty('--py', (-y * d + my * d * 90).toFixed(1) + 'px');
        });

        /* hero product parallax */
        if (prod) {
          var f = Math.min(y / 700, 1);
          prod.style.transform = [
            'translate3d(' + (mx * -16).toFixed(2) + 'px,',
            (-f * 54 + my * -10).toFixed(2) + 'px,0)',
            'scale(' + (1 - f * 0.06).toFixed(3) + ')'
          ].join('');
          prod.style.opacity = (1 - f * 0.55).toFixed(3);
        }
      }

      if (syncRail) syncRail();
      if (pickScene) pickScene();
    }

    function onScroll() { if (!rafId) rafId = requestAnimationFrame(frame); }
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);

    if (!reduce && window.matchMedia('(min-width:1024px)').matches) {
      window.addEventListener('mousemove', function (e) {
        mx = (e.clientX / window.innerWidth - 0.5) * 2;
        my = (e.clientY / window.innerHeight - 0.5) * 2;
        onScroll();
      }, { passive: true });
    }

    /* ambient shadow drift on hero product */
    if (!reduce && prod) {
      prod.animate(
        [{ filter: 'drop-shadow(0 14px 22px rgba(0,74,66,.15))' },
         { filter: 'drop-shadow(0 22px 32px rgba(0,74,66,.22))' },
         { filter: 'drop-shadow(0 14px 22px rgba(0,74,66,.15))' }],
        { duration: 7000, iterations: Infinity, easing: 'ease-in-out' }
      );
    }

    frame();
  }

  /* ----------------------------------------------------------------
     HERO STAGE (1→2→3 product slideshow)
     Accepts a root element to scope queries.
  ---------------------------------------------------------------- */
  function initHeroStage(root) {
    var hstage = root.querySelector('.purelane-hstage');
    if (!hstage) return;

    var slides = [].slice.call(hstage.querySelectorAll('.hslide'));
    var dots   = [].slice.call(root.querySelectorAll('.purelane-hdots button'));
    var idx = 0;
    var timer = null;

    function go(n) {
      idx = ((n % slides.length) + slides.length) % slides.length;
      slides.forEach(function (s, i) { s.classList.toggle('on', i === idx); });
      dots.forEach(function (d, i) { d.classList.toggle('on', i === idx); });
    }

    function play() {
      if (!timer && !reduce) timer = setInterval(function () { go(idx + 1); }, 3800);
    }
    function stop() { if (timer) { clearInterval(timer); timer = null; } }

    dots.forEach(function (d, i) {
      d.addEventListener('click', function () { stop(); go(i); play(); });
    });
    hstage.addEventListener('mouseenter', stop);
    hstage.addEventListener('mouseleave', play);

    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (es) {
        es.forEach(function (e) { e.isIntersecting ? play() : stop(); });
      }, { threshold: 0.2 }).observe(hstage);
    } else { play(); }
  }

  /* ----------------------------------------------------------------
     PRODUCT ROTATOR ("Why it works" section)
     Accepts a root element to scope queries.
  ---------------------------------------------------------------- */
  function initRotator(root) {
    var rot = root.querySelector('.purelane-rot');
    if (!rot) return;

    var imgs  = [].slice.call(rot.querySelectorAll('.frame .pimg'));
    var rdots = [].slice.call(rot.querySelectorAll('.dots i'));
    var capB  = rot.querySelector('.cap b');
    var capS  = rot.querySelector('.cap span');
    var ri = 0;
    var rtimer = null;

    function step() {
      if (imgs[ri]) imgs[ri].classList.remove('on');
      if (rdots[ri]) rdots[ri].classList.remove('on');
      ri = (ri + 1) % imgs.length;
      if (imgs[ri]) imgs[ri].classList.add('on');
      if (rdots[ri]) rdots[ri].classList.add('on');
      if (capB && imgs[ri]) capB.innerHTML = imgs[ri].getAttribute('data-name') || '';
      if (capS && imgs[ri]) capS.textContent = imgs[ri].getAttribute('data-note') || '';
    }

    if (!reduce && 'IntersectionObserver' in window) {
      new IntersectionObserver(function (es) {
        es.forEach(function (e) {
          if (e.isIntersecting && !rtimer) rtimer = setInterval(step, 2900);
          else if (!e.isIntersecting && rtimer) { clearInterval(rtimer); rtimer = null; }
        });
      }, { threshold: 0.25 }).observe(rot);
    }
  }

  /* ----------------------------------------------------------------
     SCROLL REVEAL (.rv elements)
     Accepts a root element to scope queries.
  ---------------------------------------------------------------- */
  function initReveal(root) {
    var revEls = [].slice.call(root.querySelectorAll('.rv'));
    if (!revEls.length) return;

    if ('IntersectionObserver' in window && !reduce) {
      var ro = new IntersectionObserver(function (entries) {
        entries.forEach(function (e) {
          if (e.isIntersecting) { e.target.classList.add('in'); ro.unobserve(e.target); }
        });
      }, { rootMargin: '0px 0px -12% 0px', threshold: 0.12 });
      revEls.forEach(function (el) { ro.observe(el); });
    } else {
      revEls.forEach(function (el) { el.classList.add('in'); });
    }
  }

  /* ----------------------------------------------------------------
     SECTION INIT — called on first load AND on Theme Editor re-render
  ---------------------------------------------------------------- */
  function initSection(sectionEl) {
    var root = sectionEl || document;
    initReveal(root);
    initHeroStage(root);
    initRotator(root);
  }

  /* ----------------------------------------------------------------
     BOOT
  ---------------------------------------------------------------- */
  function boot() {
    var pickScene = initScenes();
    var syncRail  = initRail();
    initScrollEffects(pickScene, syncRail);

    /* init each section */
    [].slice.call(document.querySelectorAll('[data-section-type]')).forEach(initSection);

    /* also run reveal on global elements outside sections */
    initReveal(document);
  }

  /* run on DOM ready */
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }

  /* ----------------------------------------------------------------
     SHOPIFY THEME EDITOR LIFECYCLE
     Re-initialize when merchant edits/adds/removes sections.
  ---------------------------------------------------------------- */
  document.addEventListener('shopify:section:load', function (e) {
    if (e.target) initSection(e.target);
  });

  document.addEventListener('shopify:section:unload', function () {
    /* nothing to teardown for most features; IntersectionObservers
       die with their root element automatically */
  });

  document.addEventListener('shopify:section:reorder', function () {
    /* re-sync rail and scenes after reorder */
    var pickScene = initScenes();
    var syncRail  = initRail();
    if (pickScene) pickScene();
    if (syncRail) syncRail();
  });

})();
