import * as XLSX from 'xlsx'

export function parseExcel(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const wb = XLSX.read(e.target.result, { type: 'array', cellDates: true })
        // Prefer BASE sheet, then Hoja1, then first sheet
        let sheetName = wb.SheetNames.find(s => s === 'BASE')
          || wb.SheetNames.find(s => s.toLowerCase().includes('hoja'))
          || wb.SheetNames[0]
        const ws = wb.Sheets[sheetName]
        const raw = XLSX.utils.sheet_to_json(ws, { defval: null })

        const rows = raw.map(r => {
          const fecha = r['Fecha'] || r['fecha']
          const d = fecha instanceof Date ? fecha : new Date(fecha)
          if (isNaN(d.getTime())) return null
          return {
            fecha: d.toISOString().split('T')[0],
            tipo_inventario: (r['Tipo de Inventario'] || '').trim(),
            grupo: (r['Grupo'] || '').trim(),
            sub_grupo: (r['Sub-Grupo'] || r['Sub Grupo'] || '').trim(),
            modelo: r['Modelo'] || null,
            codigo_articulo: Number(r['Artículo'] || r['Articulo'] || 0),
            descripcion: (r['Descripción'] || r['Descripcion'] || '').trim(),
            cantidad: Number(r['Cantidad'] || 0),
            monto_total: Number(r['Monto Total'] || 0),
            monto_neto: Number(r['Monto Neto'] || 0),
          }
        }).filter(r => r && r.codigo_articulo > 0 && r.cantidad > 0)

        resolve(rows)
      } catch (err) {
        reject(err)
      }
    }
    reader.onerror = reject
    reader.readAsArrayBuffer(file)
  })
}
