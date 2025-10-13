import { useEffect, useState } from "react";

export default function MiCuenta() {
  const [sites, setSites] = useState<any[]>([]);

  useEffect(() => {
    fetch("/api/sites")
      .then((r) => r.json())
      .then((data) => setSites(data))
      .catch((e) => console.error("Error al cargar sites", e));
  }, []);

  return (
    <main style={{ padding: "2rem", fontFamily: "sans-serif" }}>
      <h1>Mis widgets</h1>
      {sites.length === 0 ? (
        <p>No tienes widgets creados aún.</p>
      ) : (
        <ul>
          {sites.map((s: any) => (
            <li key={s.id}>
              <strong>{s.notion_database_id}</strong> —{" "}
              {new Date(s.created_at).toLocaleString()}
            </li>
          ))}
        </ul>
      )}
      <button onClick={() => alert("Crear nuevo widget pronto")}>
        Crear otro widget
      </button>
    </main>
  );
}
