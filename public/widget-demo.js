(function(){
  function render(el) {
    const token = el.getAttribute("data-token");
    const cols = Number(el.getAttribute("data-columns") || 3);
    const gap = Number(el.getAttribute("data-gap") || 10);
    const target = el.getAttribute("data-target") || "_blank";

    el.style.display = "grid";
    el.style.gridTemplateColumns = `repeat(${cols}, 1fr)`;
    el.style.gap = `${gap}px`;

    fetch(`${location.origin}/api/widgets/${encodeURIComponent(token)}/grid`)
      .then(r => r.json())
      .then(j => {
        el.innerHTML = j.items.map(it => (
          `<a href="${it.href || '#'}" target="${target}"><img src="${it.image}" alt="${(it.title||'').replace(/"/g,'&quot;')}" style="width:100%;height:auto;border-radius:12px" loading="lazy" /></a>`
        )).join("");
      })
      .catch(() => { el.textContent = "No se pudo cargar el widget."; });
  }

  function boot() {
    const el = document.getElementById("notion-grid");
    if (el) render(el);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
