// /pages/widget.js
import { useRouter } from 'next/router';

export default function Widget() {
  const router = useRouter();
  const { id } = router.query;

  return (
    <div style={{ fontFamily: 'Arial, sans-serif', padding: '32px', maxWidth: 600, margin: 'auto' }}>
      <h1>Widget creado correctamente</h1>
      {id
        ? <div>
            <p>El ID del widget es:</p>
            <code style={{ color: '#1976d2', background: '#f5f5f5', padding: '4px 8px', borderRadius: 4 }}>{id}</code>
            <p>Todavía no hay datos conectados, pero la ruta funciona correctamente.</p>
          </div>
        : <p>Cargando...</p>
      }
    </div>
  );
}
