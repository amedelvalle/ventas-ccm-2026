# MedLab Analytics Dashboard

Dashboard de análisis de ventas para laboratorio/clínica médica.

## Stack
- **Frontend**: React + Vite + Recharts
- **Backend**: Supabase (PostgreSQL)
- **Hosting**: Vercel

## Setup

### 1. Supabase (ya configurado)
Las tablas y vistas ya están creadas. Las políticas RLS están habilitadas.

### 2. Desarrollo local
```bash
npm install
npm run dev
```

### 3. Deploy en Vercel
1. Subir este repo a GitHub
2. Ir a [vercel.com](https://vercel.com) → New Project
3. Importar el repo de GitHub
4. Deploy (no necesita variables de entorno adicionales)

## Uso
1. Abrir el dashboard en el navegador
2. Ir a "Cargar Datos"
3. Subir el archivo Excel de ventas
4. Los datos se procesan, deduplicados, y suben a Supabase
5. Los gráficos se actualizan automáticamente

## Estructura del Excel esperada
| Columna | Tipo |
|---------|------|
| Fecha | Date |
| Tipo de Inventario | Text |
| Grupo | Text |
| Sub-Grupo | Text |
| Modelo | Text (opcional) |
| Artículo | Number |
| Descripción | Text |
| Cantidad | Number |
| Monto Total | Number |
| Monto Neto | Number |
