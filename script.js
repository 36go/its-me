(() => {
  const yearEl = document.getElementById("year");
  if (yearEl) yearEl.textContent = String(new Date().getFullYear());

  const navLinks = Array.from(document.querySelectorAll(".nav-link"));
  const sections = navLinks
    .map((a) => document.querySelector(a.getAttribute("href") || ""))
    .filter(Boolean);

  if (!sections.length) return;

  const byId = new Map(sections.map((s) => [s.id, s]));

  const setActive = (id) => {
    for (const link of navLinks) {
      const href = link.getAttribute("href") || "";
      const active = href === `#${id}`;
      link.classList.toggle("is-active", active);
      link.setAttribute("aria-current", active ? "page" : "false");
    }
  };

  const observer = new IntersectionObserver(
    (entries) => {
      const visible = entries
        .filter((e) => e.isIntersecting)
        .sort((a, b) => (b.intersectionRatio || 0) - (a.intersectionRatio || 0))[0];

      if (!visible) return;
      setActive(visible.target.id);
    },
    { root: null, threshold: [0.15, 0.3, 0.45, 0.6] }
  );

  for (const section of byId.values()) observer.observe(section);

  // If user clicks a nav link, update state immediately (feels snappier).
  for (const link of navLinks) {
    link.addEventListener("click", () => {
      const href = link.getAttribute("href") || "";
      const id = href.startsWith("#") ? href.slice(1) : "";
      if (id) setActive(id);
    });
  }
})();
