// MIDTEK — shared front-end behaviour used across every page.
(function () {
  'use strict';

  // ---- Mobile navigation toggle -----------------------------------------
  const navToggle = document.querySelector('.nav-toggle');
  const navLinks = document.querySelector('.nav-links');

  if (navToggle && navLinks) {
    navToggle.addEventListener('click', () => {
      const isOpen = navLinks.classList.toggle('open');
      navToggle.setAttribute('aria-expanded', String(isOpen));
    });

    navLinks.querySelectorAll('a').forEach((link) => {
      link.addEventListener('click', () => {
        navLinks.classList.remove('open');
        navToggle.setAttribute('aria-expanded', 'false');
      });
    });
  }

  // ---- Mark the current page's nav link -----------------------------------
  // Links are relative filenames (index.html, about.html, ...), so compare
  // against the current file name rather than the full path — this works
  // whether the site is opened via file://, a plain static host, or a host
  // that rewrites "/about" to "about.html".
  const currentFile = window.location.pathname.split('/').pop() || 'index.html';
  document.querySelectorAll('.nav-links a[data-path]').forEach((link) => {
    const linkPath = (link.getAttribute('data-path') || '').split('/').pop();
    link.removeAttribute('aria-current');
    if (linkPath === currentFile) {
      link.setAttribute('aria-current', 'page');
    }
  });

  // ---- Scroll-reveal (single restrained pattern, respects reduced motion) --
  const revealEls = document.querySelectorAll('.reveal');
  if (revealEls.length) {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      revealEls.forEach((el) => el.classList.add('in-view'));
    } else {
      const observer = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting) {
              entry.target.classList.add('in-view');
              observer.unobserve(entry.target);
            }
          });
        },
        { threshold: 0.15, rootMargin: '0px 0px -40px 0px' }
      );
      revealEls.forEach((el) => observer.observe(el));
    }
  }

  // ---- Footer year --------------------------------------------------------
  const yearEl = document.getElementById('current-year');
  if (yearEl) yearEl.textContent = new Date().getFullYear();

  // ---- Hero LED pulse: a single orchestrated moment on page load ----------
  const pulse = document.querySelector('.led-pulse');
  const path = document.querySelector('#hero-pulse-path');
  if (pulse && path && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    const length = path.getTotalLength();
    let start = null;
    const duration = 3200;

    function animatePulse(timestamp) {
      if (!start) start = timestamp;
      const elapsed = (timestamp - start) % duration;
      const progress = elapsed / duration;
      const point = path.getPointAtLength(progress * length);
      pulse.setAttribute('cx', point.x);
      pulse.setAttribute('cy', point.y);
      requestAnimationFrame(animatePulse);
    }
    requestAnimationFrame(animatePulse);
  }
})();
