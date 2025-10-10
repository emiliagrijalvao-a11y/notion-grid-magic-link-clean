// /public/setup-account.js
(async () => {
  try {
    const params = new URLSearchParams(location.search);
    const email = params.get("email");
    if (!email) return;

    const r = await fetch(`/api/user/account?email=${encodeURIComponent(email)}`);
    if (!r.ok) return;
    const u = await r.json();

    const elEmail = document.getElementById("user-email");
    const elName  = document.getElementById("user-name");
    const elType  = document.getElementById("account-type");

    if (elEmail) elEmail.textContent = u.email || "";
    if (elName)  elName.textContent  = u.name  || "—";
    if (elType)  elType.textContent  = (u.accountType === "pro") ? "Pro Account" : "Basic Account";

    const licList = document.getElementById("license-list");
    if (licList) {
      licList.innerHTML = "";
      if (!u.licenses || u.licenses.length === 0) {
        licList.innerHTML = `<div style="font-size:14px;opacity:.7">No hay licencias registradas.</div>`;
      } else {
        for (const L of u.licenses) {
          const row = document.createElement("div");
          row.className = "license-item";
          row.innerHTML = `
            <div>
              <div style="font-weight:600">${L.type} License Key</div>
              <div class="license-key">${L.key || "—"}</div>
            </div>
            <div class="license-date">${L.date || ""}</div>
          `;
          licList.appendChild(row);
        }
      }
    }

    const wContainer = document.getElementById("widgets-container");
    if (wContainer) {
      wContainer.innerHTML = "";
      if (!u.widgets || u.widgets.length === 0) {
        wContainer.innerHTML = `<div style="font-size:14px;opacity:.7">Aún no has creado ningún widget.</div>`;
      } else {
        for (const W of u.widgets) {
          const card = document.createElement("div");
          card.className = "widget-card";
          card.innerHTML = `
            <div class="widget-header">
              <div>
                <div class="widget-title">Widget #${W.id}</div>
                <div class="widget-id">ID: ${W.id}</div>
              </div>
            </div>
            <div class="widget-info"><strong>Integration Token:</strong> ${W.token || "—"}</div>
            <div class="widget-info"><strong>Database:</strong> ${W.databaseId || "—"}</div>
            <div class="widget-info"><strong>Widget URL:</strong> ${W.url || "—"}</div>
            <div class="widget-links">
              ${W.url ? `<a href="${W.url}" target="_blank">View Widget</a>` : ""}
            </div>
          `;
          wContainer.appendChild(card);
        }
      }
    }
  } catch {}
})();
