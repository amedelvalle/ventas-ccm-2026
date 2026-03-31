import { supabase } from './supabaseClient'

// ============================================================
// CARGA DE DATOS
// ============================================================

export async function getUltimaCarga() {
  const { data, error } = await supabase
    .from('v_ultima_carga')
    .select('*')
    .single()
  if (error) return { ultima_fecha: null, primera_fecha: null, total_registros: 0, total_dias: 0 }
  return data
}

export async function getCargas() {
  const { data, error } = await supabase
    .from('cargas')
    .select('*')
    .order('created_at', { ascending: false })
  return data || []
}

export async function uploadData(rows, filename) {
  // 1. Upsert articulos
  const articulosMap = {}
  for (const r of rows) {
    const key = r.codigo_articulo
    if (!articulosMap[key]) {
      articulosMap[key] = {
        codigo_articulo: r.codigo_articulo,
        descripcion: r.descripcion,
        modelo: r.modelo || null,
        sub_grupo: r.sub_grupo,
        grupo: r.grupo,
        tipo_inventario: r.tipo_inventario,
      }
    }
  }

  const articulosArr = Object.values(articulosMap)
  const { error: artErr } = await supabase
    .from('articulos')
    .upsert(articulosArr, { onConflict: 'codigo_articulo', ignoreDuplicates: true })
  if (artErr) throw new Error('Error insertando artículos: ' + artErr.message)

  // 2. Get articulo IDs mapping
  const { data: articulosDB, error: fetchErr } = await supabase
    .from('articulos')
    .select('id, codigo_articulo')
  if (fetchErr) throw new Error('Error obteniendo artículos: ' + fetchErr.message)

  const idMap = {}
  for (const a of articulosDB) {
    idMap[a.codigo_articulo] = a.id
  }

  // 3. Insert ventas in batches, using ON CONFLICT to skip duplicates
  const ventasRows = rows.map(r => ({
    fecha: r.fecha,
    articulo_id: idMap[r.codigo_articulo],
    cantidad: r.cantidad,
    monto_total: r.monto_total,
    monto_neto: r.monto_neto,
  })).filter(r => r.articulo_id != null)

  let newCount = 0
  let dupCount = 0
  const BATCH = 500

  for (let i = 0; i < ventasRows.length; i += BATCH) {
    const batch = ventasRows.slice(i, i + BATCH)
    const { data: inserted, error: insErr } = await supabase
      .from('ventas')
      .upsert(batch, {
        onConflict: 'fecha,articulo_id,cantidad,monto_total,monto_neto',
        ignoreDuplicates: true,
        count: 'exact'
      })
      .select('id')

    if (insErr) {
      // If upsert fails, try insert with individual duplicate detection
      for (const row of batch) {
        const { data: single, error: singleErr } = await supabase
          .from('ventas')
          .upsert(row, {
            onConflict: 'fecha,articulo_id,cantidad,monto_total,monto_neto',
            ignoreDuplicates: true,
          })
          .select('id')
        if (!singleErr && single && single.length > 0) {
          newCount++
        } else {
          dupCount++
        }
      }
    } else {
      const insertedCount = inserted ? inserted.length : 0
      newCount += insertedCount
      dupCount += batch.length - insertedCount
    }
  }

  // 4. Register carga
  const fechas = rows.map(r => r.fecha).sort()
  const { error: cargaErr } = await supabase
    .from('cargas')
    .insert({
      nombre_archivo: filename,
      fecha_inicio: fechas[0],
      fecha_fin: fechas[fechas.length - 1],
      filas_archivo: rows.length,
      filas_nuevas: newCount,
      filas_duplicadas: dupCount,
    })

  return {
    totalRows: rows.length,
    newRows: newCount,
    dupRows: dupCount,
    fechaInicio: fechas[0],
    fechaFin: fechas[fechas.length - 1],
  }
}

// ============================================================
// CONSULTAS DE VISTAS
// ============================================================

export async function getResumen() {
  const { data, error } = await supabase
    .from('v_resumen')
    .select('*')
    .order('anio', { ascending: true })
    .order('mes', { ascending: true })
  return data || []
}

export async function getIngresoPorArea(anio, mes) {
  let query = supabase.from('v_ingreso_por_area').select('*')
  if (anio) query = query.eq('anio', anio)
  if (mes != null) query = query.eq('mes', mes + 1) // mes is 0-indexed from UI
  const { data } = await query.order('anio').order('mes')
  return data || []
}

export async function getIngresoPorDia(anio, mes) {
  let query = supabase.from('v_ingreso_por_dia').select('*')
  if (anio) query = query.eq('anio', anio)
  if (mes != null) query = query.eq('mes', mes + 1)
  const { data } = await query.order('anio').order('mes').order('dia')
  return data || []
}

export async function getDetalleArticulo(anio, mes, tipo) {
  let query = supabase.from('v_detalle_articulo').select('*')
  if (anio) query = query.eq('anio', anio)
  if (mes != null) query = query.eq('mes', mes + 1)
  if (tipo && tipo !== 'Todos') query = query.eq('tipo_inventario', tipo)
  const { data } = await query.order('total_neto', { ascending: false }).limit(50)
  return data || []
}

export async function getComparativaAnios(anio, tipo) {
  const curYear = Number(anio)
  const prevYear = curYear - 1
  let query = supabase.from('v_comparativa_anios').select('*')
    .in('anio', [prevYear, curYear])
  if (tipo && tipo !== 'Todos') query = query.eq('tipo_inventario', tipo)
  const { data } = await query.order('mes').order('anio')
  return data || []
}

export async function getConsultasSubgrupo(anio, mes, tipo) {
  let query = supabase.from('v_consultas_subgrupo').select('*')
  if (anio) query = query.eq('anio', anio)
  if (mes != null) query = query.eq('mes', mes + 1)
  if (tipo && tipo !== 'Todos') query = query.eq('tipo_inventario', tipo)
  const { data } = await query.order('total_neto', { ascending: false })
  return data || []
}
