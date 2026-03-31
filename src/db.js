import { supabase } from './supabaseClient'

export async function getUltimaCarga() {
  const { data, error } = await supabase.from('v_ultima_carga').select('*').single()
  if (error) return { ultima_fecha: null, primera_fecha: null, total_registros: 0, total_dias: 0 }
  return data
}

export async function getCargas() {
  const { data } = await supabase.from('cargas').select('*').order('created_at', { ascending: false })
  return data || []
}

export async function uploadData(rows, filename) {
  const artMap = {}
  for (const r of rows) {
    if (!artMap[r.codigo_articulo]) {
      artMap[r.codigo_articulo] = {
        codigo_articulo: r.codigo_articulo, descripcion: r.descripcion,
        modelo: r.modelo || null, sub_grupo: r.sub_grupo, grupo: r.grupo,
        tipo_inventario: r.tipo_inventario,
      }
    }
  }
  const { error: artErr } = await supabase.from('articulos').upsert(Object.values(artMap), { onConflict: 'codigo_articulo', ignoreDuplicates: true })
  if (artErr) throw new Error('Error artículos: ' + artErr.message)

  const { data: artDB } = await supabase.from('articulos').select('id, codigo_articulo')
  const idMap = {}; for (const a of (artDB || [])) idMap[a.codigo_articulo] = a.id

  const ventasRows = rows.map(r => ({
    fecha: r.fecha, articulo_id: idMap[r.codigo_articulo],
    cantidad: r.cantidad, monto_total: r.monto_total, monto_neto: r.monto_neto,
  })).filter(r => r.articulo_id != null)

  let newCount = 0, dupCount = 0
  const BATCH = 500
  for (let i = 0; i < ventasRows.length; i += BATCH) {
    const batch = ventasRows.slice(i, i + BATCH)
    const { data: inserted, error: insErr } = await supabase.from('ventas')
      .upsert(batch, { onConflict: 'fecha,articulo_id,cantidad,monto_total,monto_neto', ignoreDuplicates: true })
      .select('id')
    if (insErr) {
      for (const row of batch) {
        const { data: s } = await supabase.from('ventas')
          .upsert(row, { onConflict: 'fecha,articulo_id,cantidad,monto_total,monto_neto', ignoreDuplicates: true })
          .select('id')
        if (s && s.length > 0) newCount++; else dupCount++
      }
    } else {
      const ic = inserted ? inserted.length : 0; newCount += ic; dupCount += batch.length - ic
    }
  }

  const fechas = rows.map(r => r.fecha).sort()
  await supabase.from('cargas').insert({
    nombre_archivo: filename, fecha_inicio: fechas[0], fecha_fin: fechas[fechas.length - 1],
    filas_archivo: rows.length, filas_nuevas: newCount, filas_duplicadas: dupCount,
  })
  return { totalRows: rows.length, newRows: newCount, dupRows: dupCount, fechaInicio: fechas[0], fechaFin: fechas[fechas.length - 1] }
}

export async function getResumen() {
  const { data } = await supabase.from('v_resumen').select('*').order('anio').order('mes')
  return data || []
}

export async function getIngresoPorArea(anio, mes) {
  let q = supabase.from('v_ingreso_por_area').select('*')
  if (anio) q = q.eq('anio', anio)
  if (mes != null) q = q.eq('mes', mes + 1)
  const { data } = await q.order('anio').order('mes')
  return data || []
}

export async function getIngresoPorDia(anio, mes) {
  let q = supabase.from('v_ingreso_por_dia').select('*')
  if (anio) q = q.eq('anio', anio)
  if (mes != null) q = q.eq('mes', mes + 1)
  const { data } = await q.order('fecha')
  return data || []
}

export async function getDetalleArticulo(anio, mes, tipo) {
  let q = supabase.from('v_detalle_articulo').select('*')
  if (anio) q = q.eq('anio', anio)
  if (mes != null) q = q.eq('mes', mes + 1)
  if (tipo && tipo !== 'Todos') q = q.eq('tipo_inventario', tipo)
  const { data } = await q.order('total_neto', { ascending: false }).limit(50)
  return data || []
}

export async function getComparativaAnios(anio, tipo) {
  const cur = Number(anio), prev = cur - 1
  let q = supabase.from('v_comparativa_anios').select('*').in('anio', [prev, cur])
  if (tipo && tipo !== 'Todos') q = q.eq('tipo_inventario', tipo)
  const { data } = await q.order('mes').order('anio')
  return data || []
}

export async function getConsultasSubgrupo(anio, mes, tipo) {
  let q = supabase.from('v_consultas_subgrupo').select('*')
  if (anio) q = q.eq('anio', anio)
  if (mes != null) q = q.eq('mes', mes + 1)
  if (tipo && tipo !== 'Todos') q = q.eq('tipo_inventario', tipo)
  const { data } = await q.order('total_neto', { ascending: false })
  return data || []
}

export async function getConsultasResumen(anio, mes) {
  let q = supabase.from('v_consultas_resumen').select('*')
  if (anio) q = q.eq('anio', anio)
  if (mes != null) q = q.eq('mes', mes + 1)
  const { data } = await q.order('anio').order('mes').order('especialidad').order('tipo_consulta')
  return data || []
}

export async function getEstudiosCV(anio, mes) {
  let q = supabase.from('v_estudios_cv').select('*')
  if (anio) q = q.eq('anio', anio)
  if (mes != null) q = q.eq('mes', mes + 1)
  const { data } = await q.order('anio').order('mes').order('total_neto', { ascending: false })
  return data || []
}

export async function getTrimestres(anio, tipo) {
  const cur = Number(anio), prev = cur - 1
  let q = supabase.from('v_trimestres').select('*').in('anio', [prev, cur])
  if (tipo && tipo !== 'Todos') q = q.eq('tipo_inventario', tipo)
  const { data } = await q.order('anio').order('trimestre')
  return data || []
}
