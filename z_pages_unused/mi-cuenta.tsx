// pages/mi-cuenta.tsx
import { useEffect, useState } from "react";

type Site = { id: string; notion_database_id: string; created_at: string };

export default function MiCuenta() {
  const [sites, setSites] = useState<Site[]>([]);
  const [loading, setLoading] = useState(true);
  const [cid, setCid] = useState<string>("");

  useEffect(() => {
    // Toma el customer_id desde la URL: /mi-cuenta?customer_id=UUID
    const url = new URL(window.location.href);
    const customer_id = url.searchParams.get("customer_id") || "";
    setCid(customer_id);

    if (!customer_id) { setLoading(false); return; }

    fetch(`/api/sites?customer_id=${customer_id}`)
      .then(r => r.json())
      .then(data => setSites(Array.isArray(data) ? data : []))
      .finally(() => setLoading(false));
  }, []);

  return (
    <main style={{ padding: "24px", fontFamily: "system-ui, sans-serif", maxWidth: 720, margin: "0 auto" }}>
      <h1 style={{ fontSize: 28, marginBottom: 16 }}>Mis widgets</h1>

      {!cid && <p>Agrega <code>?customer_id=TU-UUID</code> a la URL para ver tus widgets.</p>}

      {loading ? <p>Cargando…</p> :
        sites.length === 0 ? (
          <p>No tienes widgets creados aún. Crea uno desde tu Magic Link.</p>
        ) : (
          <ul style={{ padding: 0, listStyle: "none", display: "grid", gap: 12 }}>
            {sites.map(s => (
              <li key={s.id} style={{ border: "1px solid #e5e5e5", borderRadius: 8, padding: 12 }}>
                <div><strong>DB:</strong> {s.notion_database_id}</div>
                <div><strong>Creado:</strong> {new Date(s.created_at).toLocaleString()}</div>
              </li>
            ))}
          </ul>
        )
      }

      <div style={{ marginTop: 20 }}>
        <button
          onClick={() => alert("Aquí irá el flujo para crear otro widget")}
          style={{ padding: "10px 16px", borderRadius: 8, border: "1px solid #ddd", cursor: "pointer" }}
        >
          Crear otro widget
        </button>
      </div>
    </main>
  );
}
