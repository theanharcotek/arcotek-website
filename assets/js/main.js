/* =============================================================
   main.js — interactions & motion
   GSAP + ScrollTrigger + Lenis loaded via CDN in each page.
   Degrades gracefully if libraries or JS are unavailable.
   ============================================================= */
(function () {
  "use strict";
  document.documentElement.classList.remove("no-js");

  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ---------- Header scroll state ---------- */
  const header = document.querySelector(".header");
  const onScroll = () => {
    if (!header) return;
    header.classList.toggle("is-scrolled", window.scrollY > 24);
  };
  onScroll();
  window.addEventListener("scroll", onScroll, { passive: true });

  /* ---------- Mobile nav ---------- */
  const toggle = document.querySelector(".nav-toggle");
  const links = document.querySelector(".nav-links");
  if (toggle && links) {
    toggle.addEventListener("click", () => {
      const open = links.classList.toggle("open");
      toggle.classList.toggle("open", open);
      toggle.setAttribute("aria-expanded", String(open));
    });
    links.querySelectorAll("a").forEach((a) =>
      a.addEventListener("click", () => {
        links.classList.remove("open");
        toggle.classList.remove("open");
      })
    );
  }

  /* ---------- Native scroll (smooth-scroll library disabled by design) ---------- */
  var lenis = null;

  /* ---------- GSAP animations ---------- */
  if (window.gsap) {
    const gsap = window.gsap;
    if (window.ScrollTrigger) {
      gsap.registerPlugin(window.ScrollTrigger);
      if (lenis) lenis.on("scroll", window.ScrollTrigger.update);
    }

    if (!reduceMotion) {
      /* Hero headline: line-by-line mask reveal */
      const heroLines = document.querySelectorAll(".hero .display .line > span");
      if (heroLines.length) {
        gsap.set(heroLines, { yPercent: 120 });
        gsap.to(heroLines, { yPercent: 0, duration: 1.1, ease: "expo.out", stagger: 0.12, delay: 0.2 });
      }
      gsap.from(".hero .eyebrow, .hero .lead, .hero-cta, .hero-stats", {
        y: 30, opacity: 0, duration: 1, ease: "power3.out", stagger: 0.12, delay: 0.5,
      });

      /* Generic scroll reveals */
      if (window.ScrollTrigger) {
        gsap.utils.toArray(".reveal").forEach((el) => {
          gsap.fromTo(el, { y: 34, opacity: 0 }, {
            y: 0, opacity: 1, duration: 0.9, ease: "power3.out",
            scrollTrigger: { trigger: el, start: "top 86%" },
          });
        });

        /* Staggered groups */
        gsap.utils.toArray("[data-stagger]").forEach((group) => {
          const items = group.children;
          gsap.fromTo(items, { y: 40, opacity: 0 }, {
            y: 0, opacity: 1, duration: 0.8, ease: "power3.out", stagger: 0.1,
            scrollTrigger: { trigger: group, start: "top 82%" },
          });
        });

        /* Parallax on hero image */
        const heroImg = document.querySelector(".hero-bg img");
        if (heroImg) {
          gsap.to(heroImg, { yPercent: 18, ease: "none",
            scrollTrigger: { trigger: ".hero", start: "top top", end: "bottom top", scrub: true } });
        }
      }
    } else {
      gsap.set(".reveal, [data-stagger] > *, .hero .display .line > span", { clearProps: "all", opacity: 1, y: 0, yPercent: 0 });
    }
  } else {
    /* No GSAP — IntersectionObserver fallback for .reveal */
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => { if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); } });
    }, { threshold: 0.12 });
    document.querySelectorAll(".reveal").forEach((el) => io.observe(el));
  }

  /* ---------- Animated counters ---------- */
  const counters = document.querySelectorAll("[data-count]");
  if (counters.length) {
    const run = (el) => {
      const target = parseFloat(el.dataset.count);
      const suffix = el.dataset.suffix || "";
      const dur = 1600; const start = performance.now();
      const step = (now) => {
        const p = Math.min((now - start) / dur, 1);
        const eased = 1 - Math.pow(1 - p, 3);
        const val = target % 1 === 0 ? Math.floor(eased * target) : (eased * target).toFixed(1);
        el.textContent = val + suffix;
        if (p < 1) requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    };
    const cio = new IntersectionObserver((entries) => {
      entries.forEach((e) => { if (e.isIntersecting) { run(e.target); cio.unobserve(e.target); } });
    }, { threshold: 0.5 });
    counters.forEach((c) => cio.observe(c));
  }

  /* ---------- Contact form (front-end demo) ---------- */
  const form = document.querySelector("[data-contact-form]");
  if (form) {
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      const note = form.querySelector("[data-form-note]");
      if (note) { note.hidden = false; note.scrollIntoView({ behavior: "smooth", block: "center" }); }
      form.reset();
    });
  }

  /* ---------- Footer year ---------- */
  const y = document.querySelector("[data-year]");
  if (y) y.textContent = new Date().getFullYear();
})();
