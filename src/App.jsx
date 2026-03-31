import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, PieChart, Pie, Cell, AreaChart, Area } from 'recharts'
import { Upload, ChevronDown, Check, X, AlertCircle, Database, ArrowUpRight, ArrowDownRight, Clock } from 'lucide-react'
import { getUltimaCarga, getCargas, uploadData, getResumen, getIngresoPorArea, getIngresoPorDia, getDetalleArticulo, getComparativaAnios, getConsultasSubgrupo, getConsultasResumen, getTrimestres, getEstudiosCV } from './db'
import { parseExcel } from './parseExcel'

const MESES=['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre']
const MS=['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic']
// Consistent unique colors per area
const AC={'LABORATORIO CLINICO':'#2563EB','LABORATORIO CARDIOVASCULAR':'#DC2626','SERVICIOS MÉDICOS':'#059669','BOTIQUIN':'#D97706','LABORATORIO DE IMAGENES':'#7C3AED'}
const COLORS=['#2563EB','#059669','#D97706','#DC2626','#7C3AED','#DB2777','#0891B2','#84cc16','#EA580C','#6366f1']
const CV_COLORS={'Electrocardiograma':'#2563EB','Ecocardiograma':'#DC2626','HOLTER':'#D97706','MAPA':'#059669','Prueba de esfuerzo':'#7C3AED','HOLTER DOMICIALIAR':'#0891B2'}
const fmt=n=>n==null?'-':'$'+Number(n).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2})
const fmtK=n=>{if(n==null)return'-';if(Math.abs(n)>=1e6)return'$'+(n/1e6).toFixed(1)+'M';if(Math.abs(n)>=1e3)return'$'+(n/1e3).toFixed(1)+'K';return fmt(n)}
const fmtN=n=>n==null?'-':Number(n).toLocaleString('en-US')
const pctC=(a,b)=>b?((a-b)/Math.abs(b)*100):null
// Normalize tipo_inventario (trim trailing spaces)
const normTipo=t=>(t||'').trim()
const getAreaColor=t=>{const n=normTipo(t);return AC[n]||COLORS[Object.keys(AC).length%COLORS.length]}

function KPI({label,value,sub,trend,color='blue',icon}){
  const isPos=trend>0
  const cm={blue:['#2563EB','#EFF6FF'],grn:['#059669','#ECFDF5'],red:['#DC2626','#FEF2F2'],amb:['#D97706','#FFFBEB'],pur:['#7C3AED','#F5F3FF'],cyn:['#0891B2','#ECFEFF']}
  const [c,bg]=cm[color]||cm.blue
  return <div style={{background:'#fff',border:'1px solid #E5E7EB',borderRadius:12,padding:'18px 20px',boxShadow:'0 1px 3px rgba(0,0,0,.06)',position:'relative',transition:'box-shadow .2s'}}
    onMouseEnter={e=>e.currentTarget.style.boxShadow='0 4px 12px rgba(0,0,0,.08)'}
    onMouseLeave={e=>e.currentTarget.style.boxShadow='0 1px 3px rgba(0,0,0,.06)'}>
    {icon&&<div style={{position:'absolute',top:14,right:14,width:34,height:34,borderRadius:8,background:bg,display:'flex',alignItems:'center',justifyContent:'center',fontSize:16}}>{icon}</div>}
    <div style={{fontSize:11,fontWeight:600,color:'#9CA3AF',textTransform:'uppercase',letterSpacing:'0.08em',marginBottom:8}}>{label}</div>
    <div style={{fontSize:24,fontWeight:700,color:c,lineHeight:1.1}}>{value}</div>
    <div style={{display:'flex',gap:8,alignItems:'center',marginTop:6}}>
      {trend!=null&&<span style={{display:'inline-flex',alignItems:'center',gap:3,fontSize:11,fontWeight:600,color:isPos?'#059669':'#DC2626',background:isPos?'#ECFDF5':'#FEF2F2',padding:'2px 8px',borderRadius:20}}>
        {isPos?<ArrowUpRight size={11}/>:<ArrowDownRight size={11}/>}{Math.abs(trend).toFixed(1)}%</span>}
      {sub&&<span style={{fontSize:12,color:'#6B7280'}}>{sub}</span>}
    </div>
  </div>
}
function Card({title,dot,children,style={}}){
  return <div style={{background:'#fff',border:'1px solid #E5E7EB',borderRadius:12,padding:18,boxShadow:'0 1px 3px rgba(0,0,0,.06)',...style}}>
    {title&&<div style={{fontSize:14,fontWeight:700,color:'#1F2937',marginBottom:14,display:'flex',alignItems:'center',gap:8}}>
      {dot&&<span style={{width:8,height:8,borderRadius:'50%',background:dot,flexShrink:0}}/>}{title}</div>}{children}
  </div>
}
function Sel({value,onChange,options,label,width=160}){
  const [open,setOpen]=useState(false);const ref=useRef(null)
  useEffect(()=>{const h=e=>{if(ref.current&&!ref.current.contains(e.target))setOpen(false)};document.addEventListener('mousedown',h);return()=>document.removeEventListener('mousedown',h)},[])
  const sel=options.find(o=>(typeof o==='object'?o.value:o)===value);const dl=typeof sel==='object'?sel.label:sel
  return <div ref={ref} style={{position:'relative',display:'inline-block'}}>
    <button onClick={()=>setOpen(!open)} style={{display:'flex',alignItems:'center',gap:6,padding:'7px 12px',background:'#fff',border:'1px solid #E5E7EB',borderRadius:8,cursor:'pointer',fontSize:13,color:'#1F2937',fontFamily:'inherit',fontWeight:500,minWidth:width,justifyContent:'space-between',boxShadow:'0 1px 2px rgba(0,0,0,.04)'}}>
      {label&&<span style={{color:'#9CA3AF',fontSize:11,fontWeight:600,marginRight:4}}>{label}:</span>}
      <span style={{overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{dl||'...'}</span>
      <ChevronDown size={13} style={{flexShrink:0,transform:open?'rotate(180deg)':'none',transition:'0.2s',color:'#9CA3AF'}}/>
    </button>
    {open&&<div style={{position:'absolute',top:'100%',left:0,marginTop:4,background:'#fff',border:'1px solid #E5E7EB',borderRadius:10,boxShadow:'0 8px 24px rgba(0,0,0,.12)',zIndex:50,maxHeight:280,overflowY:'auto',minWidth:width+40}}>
      {options.map((o,i)=>{const v=typeof o==='object'?o.value:o;const l=typeof o==='object'?o.label:o;const a=v===value
        return <div key={i} onClick={()=>{onChange(v);setOpen(false)}} style={{padding:'8px 14px',cursor:'pointer',fontSize:13,color:a?'#2563EB':'#1F2937',background:a?'#EFF6FF':'transparent'}}
          onMouseEnter={e=>{if(!a)e.target.style.background='#F9FAFB'}} onMouseLeave={e=>{if(!a)e.target.style.background=a?'#EFF6FF':'transparent'}}><span>{l}</span></div>})}
    </div>}
  </div>
}
function Badge({v,type='blue'}){const m={blue:['#EFF6FF','#2563EB'],green:['#ECFDF5','#059669'],amber:['#FFFBEB','#D97706'],red:['#FEF2F2','#DC2626'],purple:['#F5F3FF','#7C3AED']};const[bg,c]=m[type]||m.blue;return<span style={{display:'inline-block',padding:'2px 10px',borderRadius:20,fontSize:11,fontWeight:600,background:bg,color:c}}>{v}</span>}
const TH=({children,align='left'})=><th style={{textAlign:align,padding:'8px 10px',color:'#6B7280',fontWeight:600,fontSize:11,textTransform:'uppercase',letterSpacing:'.05em'}}>{children}</th>
const tt={contentStyle:{background:'#fff',border:'1px solid #E5E7EB',borderRadius:10,fontSize:12,boxShadow:'0 4px 12px rgba(0,0,0,.08)'}}
const TABS=[{id:'resumen',label:'Resumen'},{id:'areas',label:'Por Área'},{id:'diario',label:'Diario'},{id:'cardiovascular',label:'Cardiovascular'},{id:'articulos',label:'Artículos'},{id:'consultas',label:'Consultas'},{id:'comparativo',label:'Comparativo'},{id:'cargar',label:'Cargar Datos'}]

export default function App(){
  const [tab,setTab]=useState('resumen')
  const [fY,setFY]=useState(null),[fM,setFM]=useState(null),[fT,setFT]=useState('Todos')
  const [upRes,setUpRes]=useState(null),[uping,setUping]=useState(false)
  const [uc,setUc]=useState(null),[cgs,setCgs]=useState([]),[res,setRes]=useState([])
  const [aD,setAD]=useState([]),[dD,setDD]=useState([]),[arD,setArD]=useState([])
  const [coD,setCoD]=useState([]),[suD,setSuD]=useState([])
  const [conD,setConD]=useState([]),[triD,setTriD]=useState([])
  const [cvD,setCvD]=useState([])
  const [ld,setLd]=useState(true);const iRef=useRef(null)

  useEffect(()=>{(async()=>{setLd(true);const[u,r,c]=await Promise.all([getUltimaCarga(),getResumen(),getCargas()]);setUc(u);setRes(r);setCgs(c);if(r.length>0){const ys=[...new Set(r.map(x=>x.anio))].sort();setFY(String(ys[ys.length-1]))}else setTab('cargar');setLd(false)})()},[])

  useEffect(()=>{if(!fY)return;(async()=>{const[a,d,ar,co,su,cn,tr,cv]=await Promise.all([getIngresoPorArea(Number(fY),fM),getIngresoPorDia(Number(fY),fM),getDetalleArticulo(Number(fY),fM,fT),getComparativaAnios(fY,fT),getConsultasSubgrupo(Number(fY),fM,fT),getConsultasResumen(Number(fY),fM),getTrimestres(fY,fT),getEstudiosCV(Number(fY),fM)]);setAD(a);setDD(d);setArD(ar);setCoD(co);setSuD(su);setConD(cn);setTriD(tr);setCvD(cv)})()},[fY,fM,fT])

  const yrs=useMemo(()=>[...new Set(res.map(r=>String(r.anio)))].sort(),[res])
  const tps=useMemo(()=>{const t=[...new Set(aD.map(r=>normTipo(r.tipo_inventario)))];return['Todos',...t]},[aD])
  const has=res.length>0

  const doUp=useCallback(async(file)=>{if(!file)return;setUping(true);setUpRes(null);try{const rows=await parseExcel(file);if(!rows.length)throw new Error('No se encontraron datos válidos');const result=await uploadData(rows,file.name);setUpRes(result);const[u,r,c]=await Promise.all([getUltimaCarga(),getResumen(),getCargas()]);setUc(u);setRes(r);setCgs(c);if(r.length>0&&!fY){const ys=[...new Set(r.map(x=>x.anio))].sort();setFY(String(ys[ys.length-1]))}if(result.newRows>0)setTab('resumen')}catch(e){setUpRes({error:e.message})}finally{setUping(false)}},[fY])

  // ── Derived ──
  const ov=useMemo(()=>{if(!res.length||!fY)return null;let f=res.filter(r=>String(r.anio)===fY);if(fM!=null)f=f.filter(r=>r.mes===fM+1);const tN=f.reduce((s,r)=>s+Number(r.total_neto),0),tB=f.reduce((s,r)=>s+Number(r.total_bruto),0),tQ=f.reduce((s,r)=>s+Number(r.total_cantidad),0),dias=f.reduce((s,r)=>s+Number(r.dias_operacion),0),pD=dias?tN/dias:0,pM=f.length?tN/f.length:0;const pv=String(Number(fY)-1);let pf=res.filter(r=>String(r.anio)===pv);if(fM!=null)pf=pf.filter(r=>r.mes===fM+1);const pN=pf.reduce((s,r)=>s+Number(r.total_neto),0),tr=pN?pctC(tN,pN):null;const mo=f.map(r=>({mes:MS[r.mes-1],mi:r.mes,neto:Number(r.total_neto),cant:Number(r.total_cantidad),dias:Number(r.dias_operacion),pd:Number(r.dias_operacion)?Number(r.total_neto)/Number(r.dias_operacion):0}));const rk=[...mo].sort((a,b)=>b.pd-a.pd),bm=rk[0],wm=rk[rk.length-1],mx=[...mo].sort((a,b)=>b.neto-a.neto)[0];return{tN,tB,tQ,dias,pD,pM,tr,mo,rk,bm,wm,mx}},[res,fY,fM])

  const aPie=useMemo(()=>{const m={};aD.forEach(r=>{const n=normTipo(r.tipo_inventario);if(!m[n])m[n]={name:n,value:0,cant:0};m[n].value+=Number(r.total_neto);m[n].cant+=Number(r.total_cantidad)});return Object.values(m).sort((a,b)=>b.value-a.value)},[aD])
  const aBar=useMemo(()=>{const ts=[...new Set(aD.map(r=>normTipo(r.tipo_inventario)))];const bm={};aD.forEach(r=>{const n=normTipo(r.tipo_inventario);if(!bm[r.mes])bm[r.mes]={mes:MS[r.mes-1]};bm[r.mes][n]=(bm[r.mes][n]||0)+Number(r.total_neto)});return{data:Object.entries(bm).sort(([a],[b])=>a-b).map(([,v])=>v),tipos:ts}},[aD])

  // Daily - now grouped by fecha correctly
  const dC=useMemo(()=>dD.map(r=>({dia:Number(r.dia),fecha:r.fecha,neto:Number(r.total_neto),cant:Number(r.total_cantidad)})),[dD])
  const dAn=useMemo(()=>{if(!dC.length)return null;const avg=dC.reduce((s,r)=>s+r.neto,0)/dC.length;const b=[...dC].sort((a,b)=>b.neto-a.neto)[0];const w=[...dC].sort((a,b)=>a.neto-b.neto)[0];const ab=dC.filter(d=>d.neto>=avg).length;return{avg,b,w,ab,tot:dC.length}},[dC])

  const aT=useMemo(()=>{const tot=arD.reduce((s,r)=>s+Number(r.total_neto),0);let ac=0;return arD.slice(0,30).map(r=>{ac+=Number(r.total_neto);return{...r,pa:tot?(ac/tot*100):0}})},[arD])
  const pS=useMemo(()=>{const tot=arD.reduce((s,r)=>s+Number(r.total_neto),0);if(!tot)return null;let ac=0,p=0;for(let i=0;i<arD.length;i++){ac+=Number(arD[i].total_neto);if(ac>=tot*0.8){p=i+1;break}};if(!p)p=arD.length;const a5=arD.slice(0,5).reduce((s,r)=>s+Number(r.total_neto),0);const a20=arD.slice(0,20).reduce((s,r)=>s+Number(r.total_neto),0);return{total:arD.length,p,p5:tot?(a5/tot*100):0,p20:tot?(a20/tot*100):0}},[arD])

  const cC=useMemo(()=>{if(!fY)return{data:[],cy:'',py:''};const cy=fY,py=String(Number(fY)-1);const bm={};coD.forEach(r=>{if(!bm[r.mes])bm[r.mes]={mes:MS[r.mes-1]};bm[r.mes][String(r.anio)]=(bm[r.mes][String(r.anio)]||0)+Number(r.total_neto)});return{data:Object.entries(bm).sort(([a],[b])=>a-b).map(([,v])=>v),cy,py}},[coD,fY])

  // Trimestres
  const triChart=useMemo(()=>{if(!fY)return{data:[],cy:'',py:''};const cy=fY,py=String(Number(fY)-1);const bm={};triD.forEach(r=>{const k=`Q${r.trimestre}`;if(!bm[k])bm[k]={q:k};bm[k][String(r.anio)]=(bm[k][String(r.anio)]||0)+Number(r.total_neto)});return{data:Object.values(bm).sort((a,b)=>a.q.localeCompare(b.q)),cy,py}},[triD,fY])

  // Consultas
  const conAgg=useMemo(()=>{
    const byEsp={};conD.forEach(r=>{const k=`${r.especialidad}-${r.tipo_consulta}`;if(!byEsp[k])byEsp[k]={esp:r.especialidad,tipo:r.tipo_consulta,consultas:0,neto:0,dias:0};byEsp[k].consultas+=Number(r.total_consultas);byEsp[k].neto+=Number(r.total_neto)})
    // Aggregate dias from unique months
    const diasByEsp={};conD.forEach(r=>{const k=r.especialidad;if(!diasByEsp[k])diasByEsp[k]=new Set();diasByEsp[k].add(r.dias_laborados+'_'+r.mes)})
    // Per especialidad totals
    const totByEsp={};conD.forEach(r=>{if(!totByEsp[r.especialidad])totByEsp[r.especialidad]={consultas:0,neto:0,iniciales:0,seguimiento:0,otros:0,dias:0};totByEsp[r.especialidad].consultas+=Number(r.total_consultas);totByEsp[r.especialidad].neto+=Number(r.total_neto);if(r.tipo_consulta==='Inicial')totByEsp[r.especialidad].iniciales+=Number(r.total_consultas);else if(r.tipo_consulta==='Seguimiento')totByEsp[r.especialidad].seguimiento+=Number(r.total_consultas);else totByEsp[r.especialidad].otros+=Number(r.total_consultas)})
    // Monthly trend
    const monthly={};conD.forEach(r=>{const k=`${r.mes}-${r.especialidad}`;if(!monthly[k])monthly[k]={mes:MS[r.mes-1],mi:r.mes,esp:r.especialidad,consultas:0,iniciales:0,seguimiento:0,dias:Number(r.dias_laborados)};monthly[k].consultas+=Number(r.total_consultas);if(r.tipo_consulta==='Inicial')monthly[k].iniciales+=Number(r.total_consultas);if(r.tipo_consulta==='Seguimiento')monthly[k].seguimiento+=Number(r.total_consultas);monthly[k].dias=Math.max(monthly[k].dias,Number(r.dias_laborados))})
    const moArr=Object.values(monthly).sort((a,b)=>a.mi-b.mi)
    return{byEsp:Object.values(byEsp),totByEsp,moArr}
  },[conD])

  const sR=useMemo(()=>{
    // Aggregate sub-grupos combining tipo_inventario as context
    const m={};suD.forEach(r=>{const k=`${normTipo(r.tipo_inventario)}|${r.sub_grupo}`;if(!m[k])m[k]={sub_grupo:r.sub_grupo,tipo:normTipo(r.tipo_inventario),neto:0,cant:0};m[k].neto+=Number(r.total_neto);m[k].cant+=Number(r.total_cantidad)})
    return Object.values(m).sort((a,b)=>b.neto-a.neto).slice(0,15)
  },[suD])

  // ── Cardiovascular ──
  const cvAgg=useMemo(()=>{
    if(!cvD.length) return null
    // KPIs
    const totEst=cvD.reduce((s,r)=>s+Number(r.total_estudios),0)
    const totNeto=cvD.reduce((s,r)=>s+Number(r.total_neto),0)
    // Dias laborados = unique months' dias (take max per month since all estudios share same days)
    const diasByMes={};cvD.forEach(r=>{const k=r.mes;diasByMes[k]=Math.max(diasByMes[k]||0,Number(r.dias_laborados))})
    const totalDias=Object.values(diasByMes).reduce((s,d)=>s+d,0)
    const estPorDia=totalDias?totEst/totalDias:0

    // YoY - need previous year data; we'll compute from what we have if fY filter
    // (previous year data not in cvD since it's filtered, so trend comes from resumen)

    // By estudio (aggregate across months)
    const byEst={};cvD.forEach(r=>{const k=r.estudio;if(!byEst[k])byEst[k]={estudio:k,estudios:0,neto:0};byEst[k].estudios+=Number(r.total_estudios);byEst[k].neto+=Number(r.total_neto)})
    const estudios=Object.values(byEst).sort((a,b)=>b.neto-a.neto)
    estudios.forEach(e=>{e.pct=totNeto?(e.neto/totNeto*100):0;e.promDia=totalDias?(e.estudios/totalDias):0})

    // Monthly stacked area chart data
    const allEst=[...new Set(cvD.map(r=>r.estudio))]
    const byMonth={};cvD.forEach(r=>{if(!byMonth[r.mes])byMonth[r.mes]={mes:MS[r.mes-1],mi:r.mes};byMonth[r.mes][r.estudio]=Number(r.total_estudios)})
    const monthlyChart=Object.entries(byMonth).sort(([a],[b])=>a-b).map(([,v])=>v)

    // Monthly ranking (by neto/dia)
    const monthAgg={};cvD.forEach(r=>{if(!monthAgg[r.mes])monthAgg[r.mes]={mes:MS[r.mes-1],mi:r.mes,estudios:0,neto:0,dias:0};monthAgg[r.mes].estudios+=Number(r.total_estudios);monthAgg[r.mes].neto+=Number(r.total_neto);monthAgg[r.mes].dias=Math.max(monthAgg[r.mes].dias,Number(r.dias_laborados))})
    const monthRank=Object.values(monthAgg).map(m=>({...m,estDia:m.dias?(m.estudios/m.dias):0,netoDia:m.dias?(m.neto/m.dias):0})).sort((a,b)=>b.netoDia-a.netoDia)
    const bestM=monthRank[0],worstM=monthRank[monthRank.length-1]

    return{totEst,totNeto,totalDias,estPorDia,estudios,allEst,monthlyChart,monthRank,bestM,worstM}
  },[cvD])

  if(ld)return<div style={{display:'flex',alignItems:'center',justifyContent:'center',height:'100vh',background:'#F6F7FB'}}><div><div style={{width:44,height:44,border:'3px solid #E5E7EB',borderTopColor:'#2563EB',borderRadius:'50%',animation:'spin 0.7s linear infinite',margin:'0 auto 14px'}}/><span style={{color:'#6B7280',fontSize:14}}>Cargando...</span></div></div>

  return <div style={{background:'#F6F7FB',minHeight:'100vh'}}>
    <div style={{maxWidth:1400,margin:'0 auto',padding:'24px 24px 0'}}>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-end',marginBottom:20,paddingBottom:16,borderBottom:'2px solid #2563EB',flexWrap:'wrap',gap:12}}>
        <div><h1 style={{fontFamily:"'Fraunces',serif",fontSize:'1.6rem',fontWeight:800,color:'#1D4ED8',letterSpacing:'-0.5px'}}>MedLab Analytics</h1>
          <div style={{fontSize:12,color:'#6B7280',marginTop:2}}>Dashboard de Gestión — Clínica CCM, El Salvador</div></div>
        {uc?.ultima_fecha&&<span style={{fontSize:12,color:'#6B7280',background:'#fff',border:'1px solid #E5E7EB',padding:'6px 14px',borderRadius:20,boxShadow:'0 1px 2px rgba(0,0,0,.04)'}}>📅 Hasta {uc.ultima_fecha} · {fmtN(uc.total_registros)} registros</span>}
      </div>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:20,flexWrap:'wrap',gap:12}}>
        <div style={{display:'flex',gap:2,background:'#fff',borderRadius:12,padding:4,boxShadow:'0 1px 3px rgba(0,0,0,.06)',overflowX:'auto'}}>
          {TABS.map(t=><button key={t.id} onClick={()=>setTab(t.id)} style={{padding:'9px 16px',borderRadius:8,cursor:'pointer',fontSize:13,fontWeight:600,color:tab===t.id?'#fff':'#6B7280',background:tab===t.id?'#2563EB':'none',border:'none',fontFamily:'inherit',whiteSpace:'nowrap'}}>{t.label}</button>)}
        </div>
        {has&&tab!=='cargar'&&<div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
          <Sel label="Año" value={fY} onChange={v=>{setFY(v);setFM(null)}} options={yrs} width={100}/>
          {tab!=='comparativo'&&<Sel label="Mes" value={fM} onChange={setFM} options={[{value:null,label:'Todos'},...MESES.map((m,i)=>({value:i,label:m}))]} width={140}/>}
          {['articulos','comparativo','areas'].includes(tab)&&<Sel label="Área" value={fT} onChange={setFT} options={tps} width={200}/>}
        </div>}
      </div>
      <div style={{paddingBottom:40}}>

      {/* CARGAR */}
      {tab==='cargar'&&<div style={{maxWidth:720,margin:'0 auto'}}>
        <h2 style={{fontSize:18,fontWeight:700,margin:'0 0 8px'}}>Cargar datos</h2>
        <p style={{fontSize:13,color:'#6B7280',margin:'0 0 20px',lineHeight:1.6}}>Subí tu archivo Excel. El sistema descarta filas duplicadas automáticamente.</p>
        {uc?.ultima_fecha&&<div style={{background:'#EFF6FF',border:'1px solid #BFDBFE',borderRadius:10,padding:'12px 16px',marginBottom:16,display:'flex',alignItems:'center',gap:8,fontSize:13,color:'#1E40AF'}}><Database size={15}/>Hasta: <strong>{uc.ultima_fecha}</strong> · {fmtN(uc.total_registros)} registros</div>}
        {upRes&&<div style={{background:upRes.error?'#FEF2F2':'#ECFDF5',border:`1px solid ${upRes.error?'#FECACA':'#A7F3D0'}`,borderRadius:10,padding:14,marginBottom:16,display:'flex',gap:10}}>
          {upRes.error?<AlertCircle size={18} color="#DC2626"/>:<Check size={18} color="#059669"/>}
          <div style={{flex:1,fontSize:13}}><div style={{fontWeight:600,color:upRes.error?'#DC2626':'#059669',marginBottom:3}}>{upRes.error?'Error':'Carga exitosa'}</div>
            {upRes.error?upRes.error:<span style={{color:'#6B7280'}}><b>{fmtN(upRes.totalRows)}</b> filas · <b style={{color:'#059669'}}>{fmtN(upRes.newRows)}</b> nuevas · <b>{fmtN(upRes.dupRows)}</b> dup · {upRes.fechaInicio} → {upRes.fechaFin}</span>}</div>
          <button onClick={()=>setUpRes(null)} style={{background:'none',border:'none',cursor:'pointer'}}><X size={15} color="#9CA3AF"/></button>
        </div>}
        <div onClick={()=>iRef.current?.click()} onDragOver={e=>e.preventDefault()} onDrop={e=>{e.preventDefault();doUp(e.dataTransfer.files[0])}} style={{border:'2px dashed #D1D5DB',borderRadius:16,padding:'52px 32px',textAlign:'center',cursor:uping?'wait':'pointer'}}>
          <input ref={iRef} type="file" accept=".xlsx,.xls,.csv" style={{display:'none'}} onChange={e=>doUp(e.target.files[0])}/>
          {uping?<><div style={{width:40,height:40,border:'3px solid #E5E7EB',borderTopColor:'#2563EB',borderRadius:'50%',animation:'spin 0.7s linear infinite',margin:'0 auto 14px'}}/><span style={{color:'#6B7280'}}>Procesando...</span></>
          :<><div style={{width:52,height:52,borderRadius:14,background:'#EFF6FF',display:'flex',alignItems:'center',justifyContent:'center',margin:'0 auto 16px'}}><Upload size={22} color="#2563EB"/></div><div style={{fontSize:15,fontWeight:600,marginBottom:4}}>Arrastrá tu archivo Excel acá</div><div style={{fontSize:13,color:'#9CA3AF'}}>o hacé clic · .xlsx, .xls, .csv</div></>}
        </div>
        {cgs.length>0&&<div style={{marginTop:32}}><div style={{fontSize:13,fontWeight:600,marginBottom:12,display:'flex',alignItems:'center',gap:6}}><Clock size={14}/>Historial</div>
          {cgs.slice(0,8).map((c,i)=><div key={i} style={{background:'#fff',border:'1px solid #E5E7EB',borderRadius:10,padding:'12px 16px',fontSize:13,marginBottom:8}}>
            <div style={{display:'flex',justifyContent:'space-between',marginBottom:3}}><b>{c.nombre_archivo}</b><span style={{color:'#9CA3AF',fontSize:11}}>{new Date(c.created_at).toLocaleString()}</span></div>
            <span style={{color:'#6B7280'}}>{c.fecha_inicio}→{c.fecha_fin} · <span style={{color:'#059669'}}>{fmtN(c.filas_nuevas)} new</span>, {fmtN(c.filas_duplicadas)} dup</span>
          </div>)}</div>}
      </div>}

      {!has&&tab!=='cargar'&&<div style={{textAlign:'center',padding:'80px 24px'}}><Database size={48} style={{color:'#D1D5DB',margin:'0 auto 16px'}}/><h3 style={{fontSize:18,fontWeight:600,marginBottom:8}}>Sin datos</h3><p style={{color:'#9CA3AF'}}>Cargá tu Excel en "Cargar Datos".</p></div>}

      {/* RESUMEN */}
      {tab==='resumen'&&ov&&<div>
        <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:14,marginBottom:16}}>
          <KPI label="Ingreso Neto" value={fmtK(ov.tN)} trend={ov.tr} sub={ov.tr!=null?'vs año anterior':null} color="grn" icon="💰"/>
          <KPI label="Ingreso Bruto" value={fmtK(ov.tB)} sub={`IVA: ${fmtK(ov.tB-ov.tN)}`} color="blue" icon="📊"/>
          <KPI label="Total Servicios" value={fmtN(ov.tQ)} sub={`${ov.dias} días laborados`} color="pur" icon="🎯"/>
          <KPI label="Promedio Diario" value={fmt(ov.pD)} sub="ingreso neto/día" color="amb" icon="📅"/>
        </div>
        <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:14,marginBottom:20}}>
          <KPI label="Promedio Mensual" value={fmtK(ov.pM)} sub={`${ov.mo.length} meses`} color="cyn"/>
          <KPI label="Mejor Mes ($/día)" value={ov.bm?ov.bm.mes:'—'} sub={ov.bm?`${fmt(ov.bm.pd)}/día · ${ov.bm.dias}d`:''} color="grn"/>
          <KPI label="Mayor Facturación" value={ov.mx?ov.mx.mes:'—'} sub={ov.mx?fmtK(ov.mx.neto):''} color="blue"/>
          <KPI label="Menor Prom/Día" value={ov.wm?ov.wm.mes:'—'} sub={ov.wm?`${fmt(ov.wm.pd)}/día · ${ov.wm.dias}d`:''} color="red"/>
        </div>
        <div style={{display:'grid',gridTemplateColumns:'2fr 1fr',gap:14,marginBottom:20}}>
          <Card title="Tendencia Mensual" dot="#2563EB">
            <ResponsiveContainer width="100%" height={280}><AreaChart data={ov.mo}><defs><linearGradient id="gN" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#2563EB" stopOpacity={0.12}/><stop offset="100%" stopColor="#2563EB" stopOpacity={0}/></linearGradient></defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,.06)" vertical={false}/><XAxis dataKey="mes" tick={{fontSize:11,fill:'#6B7280'}} axisLine={false} tickLine={false}/><YAxis tick={{fontSize:11,fill:'#6B7280'}} axisLine={false} tickLine={false} tickFormatter={v=>'$'+(v/1e3).toFixed(0)+'K'}/>
              <Tooltip formatter={v=>fmt(v)} {...tt}/><Area type="monotone" dataKey="neto" stroke="#2563EB" fill="url(#gN)" strokeWidth={2.5} dot={{r:3,fill:'#2563EB'}} name="Neto"/></AreaChart></ResponsiveContainer>
          </Card>
          <Card title="Distribución por Área" dot="#059669">
            <ResponsiveContainer width="100%" height={180}><PieChart><Pie data={aPie} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={45} outerRadius={75} paddingAngle={2} strokeWidth={0}>
              {aPie.map((a,i)=><Cell key={i} fill={AC[a.name]||COLORS[i%COLORS.length]}/>)}</Pie><Tooltip formatter={v=>fmt(v)} {...tt}/></PieChart></ResponsiveContainer>
            <div style={{marginTop:8}}>{aPie.map((a,i)=>{const tot=aPie.reduce((s,x)=>s+x.value,0);return<div key={i} style={{display:'flex',alignItems:'center',gap:8,fontSize:12,marginBottom:5}}>
              <span style={{width:8,height:8,borderRadius:3,background:AC[a.name]||COLORS[i%COLORS.length],flexShrink:0}}/><span style={{flex:1,color:'#6B7280',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{a.name}</span><span style={{fontWeight:600}}>{tot?((a.value/tot)*100).toFixed(0)+'%':'-'}</span></div>})}</div>
          </Card>
        </div>
        <Card title="Ranking de Meses — Promedio Facturación por Día" dot="#7C3AED">
          <div style={{overflowX:'auto'}}><table style={{width:'100%',borderCollapse:'collapse',fontSize:13}}><thead><tr style={{borderBottom:'2px solid #E5E7EB',background:'#F6F7FB'}}>
            {['#','Mes','Neto Total','Días Lab.','Prom/Día','Servicios','Serv/Día'].map((h,i)=><TH key={i} align={i>1?'right':'left'}>{h}</TH>)}
          </tr></thead><tbody>{ov.rk.map((r,i)=><tr key={i} style={{borderBottom:'1px solid #F3F4F6'}}>
            <td style={{padding:'8px 10px',color:'#9CA3AF'}}>{i+1}</td>
            <td style={{padding:'8px 10px',fontWeight:600}}>{r.mes}</td>
            <td style={{padding:'8px 10px',textAlign:'right',fontWeight:600}}>{fmt(r.neto)}</td>
            <td style={{padding:'8px 10px',textAlign:'right'}}>{r.dias}</td>
            <td style={{padding:'8px 10px',textAlign:'right'}}><Badge v={fmt(r.pd)} type={i<3?'green':i>=ov.rk.length-2?'red':'blue'}/></td>
            <td style={{padding:'8px 10px',textAlign:'right'}}>{fmtN(r.cant)}</td>
            <td style={{padding:'8px 10px',textAlign:'right'}}>{r.dias?(r.cant/r.dias).toFixed(1):'-'}</td>
          </tr>)}</tbody></table></div>
        </Card>
      </div>}

      {/* AREAS */}
      {tab==='areas'&&<div>
        <Card title="Ingreso Neto por Área — Mensual" dot="#2563EB" style={{marginBottom:20}}>
          <ResponsiveContainer width="100%" height={340}><BarChart data={aBar.data}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,.06)" vertical={false}/><XAxis dataKey="mes" tick={{fontSize:11,fill:'#6B7280'}} axisLine={false} tickLine={false}/><YAxis tick={{fontSize:11,fill:'#6B7280'}} axisLine={false} tickLine={false} tickFormatter={v=>'$'+(v/1e3).toFixed(0)+'K'}/>
            <Tooltip formatter={v=>fmt(v)} {...tt}/><Legend wrapperStyle={{fontSize:11}}/>
            {aBar.tipos.map((t,i)=>{const n=normTipo(t);return<Bar key={n} dataKey={n} fill={AC[n]||COLORS[i%COLORS.length]} radius={[4,4,0,0]}/>})}
          </BarChart></ResponsiveContainer>
        </Card>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:14}}>
          <Card title="Detalle por Área" dot="#059669">
            <table style={{width:'100%',borderCollapse:'collapse',fontSize:13}}><thead><tr style={{borderBottom:'2px solid #E5E7EB',background:'#F6F7FB'}}>
              {['Área','Neto','Cantidad','%'].map((h,i)=><TH key={i} align={i>0?'right':'left'}>{h}</TH>)}
            </tr></thead><tbody>{aPie.map((a,i)=>{const tot=aPie.reduce((s,x)=>s+x.value,0);return<tr key={i} style={{borderBottom:'1px solid #F3F4F6'}}>
              <td style={{padding:'8px 10px'}}><span style={{display:'inline-block',width:8,height:8,borderRadius:3,background:AC[a.name]||COLORS[i%COLORS.length],marginRight:8,verticalAlign:'middle'}}/>{a.name}</td>
              <td style={{padding:'8px 10px',textAlign:'right',fontWeight:600}}>{fmt(a.value)}</td>
              <td style={{padding:'8px 10px',textAlign:'right'}}>{fmtN(a.cant)}</td>
              <td style={{padding:'8px 10px',textAlign:'right'}}><Badge v={((a.value/tot)*100).toFixed(1)+'%'}/></td>
            </tr>})}</tbody></table>
          </Card>
          <Card title="Top Sub-Grupos (con origen)" dot="#D97706">
            <table style={{width:'100%',borderCollapse:'collapse',fontSize:13}}><thead><tr style={{borderBottom:'2px solid #E5E7EB',background:'#F6F7FB'}}>
              {['Sub-Grupo','Origen','Neto','Cant'].map((h,i)=><TH key={i} align={i>1?'right':'left'}>{h}</TH>)}
            </tr></thead><tbody>{sR.map((r,i)=><tr key={i} style={{borderBottom:'1px solid #F3F4F6'}}>
              <td style={{padding:'7px 10px',fontSize:12,fontWeight:500}}>{r.sub_grupo}</td>
              <td style={{padding:'7px 10px',fontSize:10,color:'#9CA3AF'}}>{r.tipo}</td>
              <td style={{padding:'7px 10px',textAlign:'right',fontWeight:600,fontSize:12}}>{fmt(r.neto)}</td>
              <td style={{padding:'7px 10px',textAlign:'right',fontSize:12}}>{fmtN(r.cant)}</td>
            </tr>)}</tbody></table>
          </Card>
        </div>
      </div>}

      {/* DIARIO */}
      {tab==='diario'&&dAn&&<div>
        <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:14,marginBottom:20}}>
          <KPI label="Promedio por Día" value={fmt(dAn.avg)} sub={`${dAn.tot} días laborados`} color="blue" icon="📊"/>
          <KPI label="Mejor Día" value={`Día ${dAn.b.dia}`} sub={fmt(dAn.b.neto)} color="grn" icon="🏆"/>
          <KPI label="Peor Día" value={`Día ${dAn.w.dia}`} sub={fmt(dAn.w.neto)} color="red" icon="📉"/>
          <KPI label="Días sobre Promedio" value={`${dAn.ab} de ${dAn.tot}`} sub={`${((dAn.ab/dAn.tot)*100).toFixed(0)}% de los días`} color="pur" icon="✅"/>
        </div>
        <Card title={`Ingreso Neto por Día${fM!=null?' — '+MESES[fM]:''} ${fY}`} dot="#2563EB">
          <ResponsiveContainer width="100%" height={380}><BarChart data={dC}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,.06)" vertical={false}/><XAxis dataKey="dia" tick={{fontSize:11,fill:'#6B7280'}} axisLine={false} tickLine={false}/><YAxis tick={{fontSize:11,fill:'#6B7280'}} axisLine={false} tickLine={false} tickFormatter={v=>'$'+(v/1e3).toFixed(1)+'K'}/>
            <Tooltip formatter={v=>fmt(v)} labelFormatter={v=>'Día '+v} {...tt}/><Bar dataKey="neto" fill="#2563EB" radius={[4,4,0,0]} name="Neto"/>
          </BarChart></ResponsiveContainer>
        </Card>
      </div>}

      {/* CARDIOVASCULAR */}
      {tab==='cardiovascular'&&cvAgg&&<div>
        <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:14,marginBottom:16}}>
          <KPI label="Total Estudios" value={fmtN(cvAgg.totEst)} sub={`${cvAgg.totalDias} días laborados`} color="red" icon="❤️"/>
          <KPI label="Ingreso Neto" value={fmtK(cvAgg.totNeto)} color="blue" icon="💰"/>
          <KPI label="Estudios/Día" value={cvAgg.estPorDia.toFixed(1)} sub="promedio diario" color="amb" icon="📊"/>
          <KPI label="Mejor Mes ($/día)" value={cvAgg.bestM?cvAgg.bestM.mes:'—'} sub={cvAgg.bestM?`${fmt(cvAgg.bestM.netoDia)}/día · ${cvAgg.bestM.estDia.toFixed(1)} est/día`:''} color="grn" icon="🏆"/>
        </div>

        <div style={{display:'grid',gridTemplateColumns:'3fr 2fr',gap:14,marginBottom:20}}>
          <Card title="Volumen Mensual por Estudio" dot="#DC2626">
            <ResponsiveContainer width="100%" height={300}><BarChart data={cvAgg.monthlyChart}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,.06)" vertical={false}/>
              <XAxis dataKey="mes" tick={{fontSize:11,fill:'#6B7280'}} axisLine={false} tickLine={false}/>
              <YAxis tick={{fontSize:11,fill:'#6B7280'}} axisLine={false} tickLine={false}/>
              <Tooltip {...tt}/><Legend wrapperStyle={{fontSize:11}}/>
              {cvAgg.allEst.map((e,i)=><Bar key={e} dataKey={e} stackId="a" fill={CV_COLORS[e]||COLORS[i%COLORS.length]} radius={i===cvAgg.allEst.length-1?[4,4,0,0]:[0,0,0,0]}/>)}
            </BarChart></ResponsiveContainer>
          </Card>
          <Card title="Composición por Estudio" dot="#D97706">
            <ResponsiveContainer width="100%" height={180}><PieChart><Pie data={cvAgg.estudios} dataKey="estudios" nameKey="estudio" cx="50%" cy="50%" innerRadius={40} outerRadius={70} paddingAngle={2} strokeWidth={0}>
              {cvAgg.estudios.map((e,i)=><Cell key={i} fill={CV_COLORS[e.estudio]||COLORS[i%COLORS.length]}/>)}</Pie><Tooltip {...tt}/></PieChart></ResponsiveContainer>
            <div style={{marginTop:8}}>{cvAgg.estudios.map((e,i)=><div key={i} style={{display:'flex',alignItems:'center',gap:8,fontSize:12,marginBottom:5}}>
              <span style={{width:8,height:8,borderRadius:3,background:CV_COLORS[e.estudio]||COLORS[i%COLORS.length],flexShrink:0}}/>
              <span style={{flex:1,color:'#6B7280'}}>{e.estudio}</span>
              <span style={{fontWeight:600}}>{e.pct.toFixed(0)}%</span>
            </div>)}</div>
          </Card>
        </div>

        <Card title="Detalle por Estudio" dot="#2563EB" style={{marginBottom:20}}>
          <div style={{overflowX:'auto'}}><table style={{width:'100%',borderCollapse:'collapse',fontSize:13}}><thead><tr style={{borderBottom:'2px solid #E5E7EB',background:'#F6F7FB'}}>
            {['Estudio','Cantidad','Ingreso Neto','Prom/Día','% Ingreso CV'].map((h,i)=><TH key={i} align={i>0?'right':'left'}>{h}</TH>)}
          </tr></thead><tbody>{cvAgg.estudios.map((e,i)=><tr key={i} style={{borderBottom:'1px solid #F3F4F6'}} onMouseEnter={ev=>ev.currentTarget.style.background='#FAFBFE'} onMouseLeave={ev=>ev.currentTarget.style.background='transparent'}>
            <td style={{padding:'8px 10px',fontWeight:600,display:'flex',alignItems:'center',gap:8}}><span style={{width:8,height:8,borderRadius:3,background:CV_COLORS[e.estudio]||COLORS[i%COLORS.length]}}/>{e.estudio}</td>
            <td style={{padding:'8px 10px',textAlign:'right'}}>{fmtN(e.estudios)}</td>
            <td style={{padding:'8px 10px',textAlign:'right',fontWeight:600}}>{fmt(e.neto)}</td>
            <td style={{padding:'8px 10px',textAlign:'right'}}>{e.promDia.toFixed(1)}</td>
            <td style={{padding:'8px 10px',textAlign:'right'}}><Badge v={e.pct.toFixed(1)+'%'} type={e.pct>=20?'blue':'amber'}/></td>
          </tr>)}</tbody></table></div>
        </Card>

        <Card title="Ranking Mensual — Facturación CV por Día" dot="#7C3AED">
          <div style={{overflowX:'auto'}}><table style={{width:'100%',borderCollapse:'collapse',fontSize:13}}><thead><tr style={{borderBottom:'2px solid #E5E7EB',background:'#F6F7FB'}}>
            {['#','Mes','Estudios','Neto','Días Lab.','Est/Día','$/Día'].map((h,i)=><TH key={i} align={i>1?'right':'left'}>{h}</TH>)}
          </tr></thead><tbody>{cvAgg.monthRank.map((r,i)=><tr key={i} style={{borderBottom:'1px solid #F3F4F6'}}>
            <td style={{padding:'8px 10px',color:'#9CA3AF'}}>{i+1}</td>
            <td style={{padding:'8px 10px',fontWeight:600}}>{r.mes}</td>
            <td style={{padding:'8px 10px',textAlign:'right'}}>{fmtN(r.estudios)}</td>
            <td style={{padding:'8px 10px',textAlign:'right',fontWeight:600}}>{fmt(r.neto)}</td>
            <td style={{padding:'8px 10px',textAlign:'right'}}>{r.dias}</td>
            <td style={{padding:'8px 10px',textAlign:'right'}}><Badge v={r.estDia.toFixed(1)} type={i<3?'green':i>=cvAgg.monthRank.length-2?'red':'blue'}/></td>
            <td style={{padding:'8px 10px',textAlign:'right'}}><Badge v={fmt(r.netoDia)} type={i<3?'green':i>=cvAgg.monthRank.length-2?'red':'blue'}/></td>
          </tr>)}</tbody></table></div>
        </Card>
      </div>}

      {/* ARTÍCULOS */}
      {tab==='articulos'&&<div>
        {pS&&<div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:14,marginBottom:20}}>
          <KPI label="Artículos Distintos" value={fmtN(pS.total)} color="blue" icon="📋"/>
          <KPI label="80% del Ingreso" value={`${pS.p} artículos`} sub={`${((pS.p/pS.total)*100).toFixed(0)}% del catálogo`} color="pur" icon="🎯"/>
          <KPI label="Top 5" value={`${pS.p5.toFixed(1)}%`} sub="del ingreso" color="grn" icon="⭐"/>
          <KPI label="Top 20" value={`${pS.p20.toFixed(1)}%`} sub="del ingreso" color="amb" icon="📊"/>
        </div>}
        <Card title="Análisis Pareto — Top Artículos" dot="#7C3AED" style={{marginBottom:20}}>
          <div style={{background:'#F5F3FF',border:'1px solid #DDD6FE',borderRadius:8,padding:'12px 16px',marginBottom:16,fontSize:13,color:'#5B21B6'}}>
            <strong>¿Qué es Pareto?</strong> El principio 80/20: pocos artículos generan la mayoría del ingreso. Los marcados en <Badge v="azul" type="blue"/> están dentro del 80% acumulado (los críticos). Los de <Badge v="ámbar" type="amber"/> son el 20% restante. Esto te ayuda a saber qué servicios o estudios son los que más peso tienen en tu facturación y dónde enfocar recursos.
          </div>
          <div style={{overflowX:'auto'}}><table style={{width:'100%',borderCollapse:'collapse',fontSize:13}}><thead><tr style={{borderBottom:'2px solid #E5E7EB',background:'#F6F7FB'}}>
            {['#','Artículo','Área','Neto','Cant','Prom','% Acum'].map((h,i)=><TH key={i} align={i>2?'right':'left'}>{h}</TH>)}
          </tr></thead><tbody>{aT.map((a,i)=><tr key={i} style={{borderBottom:'1px solid #F3F4F6'}} onMouseEnter={e=>e.currentTarget.style.background='#FAFBFE'} onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
            <td style={{padding:'8px 10px',color:'#9CA3AF'}}>{i+1}</td>
            <td style={{padding:'8px 10px',fontWeight:500,maxWidth:260,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{a.descripcion}</td>
            <td style={{padding:'8px 10px',color:'#6B7280',fontSize:11}}>{normTipo(a.tipo_inventario)}</td>
            <td style={{padding:'8px 10px',textAlign:'right',fontWeight:600}}>{fmt(a.total_neto)}</td>
            <td style={{padding:'8px 10px',textAlign:'right'}}>{fmtN(a.total_cantidad)}</td>
            <td style={{padding:'8px 10px',textAlign:'right',color:'#6B7280'}}>{fmt(a.precio_promedio)}</td>
            <td style={{padding:'8px 10px',textAlign:'right'}}><Badge v={a.pa.toFixed(1)+'%'} type={a.pa<=80?'blue':'amber'}/></td>
          </tr>)}</tbody></table></div>
        </Card>
      </div>}

      {/* CONSULTAS */}
      {tab==='consultas'&&<div>
        <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:14,marginBottom:20}}>
          {['CARDIOLOGIA','ENDOCRINOLOGIA'].map(esp=>{const d=conAgg.totByEsp[esp];if(!d)return null;return[
            <KPI key={esp+'t'} label={`${esp} — Total`} value={fmtN(d.consultas)} sub={fmt(d.neto)} color={esp==='CARDIOLOGIA'?'red':'grn'} icon={esp==='CARDIOLOGIA'?'❤️':'🧬'}/>,
            <KPI key={esp+'i'} label={`${esp} — Iniciales`} value={fmtN(d.iniciales)} sub={`${d.consultas?(d.iniciales/d.consultas*100).toFixed(0):0}% del total`} color={esp==='CARDIOLOGIA'?'amb':'cyn'}/>
          ]}).flat().filter(Boolean)}
        </div>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:14,marginBottom:20}}>
          {['CARDIOLOGIA','ENDOCRINOLOGIA'].map(esp=>{
            const mData=conAgg.moArr.filter(r=>r.esp===esp)
            const chartData=mData.map(r=>({mes:r.mes,Iniciales:r.iniciales,Seguimiento:r.seguimiento,PromDia:r.dias?(r.consultas/r.dias):0}))
            return <Card key={esp} title={`${esp} — Mensual`} dot={esp==='CARDIOLOGIA'?'#DC2626':'#059669'}>
              <ResponsiveContainer width="100%" height={260}><BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,.06)" vertical={false}/>
                <XAxis dataKey="mes" tick={{fontSize:11,fill:'#6B7280'}} axisLine={false} tickLine={false}/>
                <YAxis tick={{fontSize:11,fill:'#6B7280'}} axisLine={false} tickLine={false}/>
                <Tooltip {...tt}/><Legend wrapperStyle={{fontSize:11}}/>
                <Bar dataKey="Iniciales" fill={esp==='CARDIOLOGIA'?'#DC2626':'#059669'} radius={[4,4,0,0]} stackId="a"/>
                <Bar dataKey="Seguimiento" fill={esp==='CARDIOLOGIA'?'#FCA5A5':'#6EE7B7'} radius={[4,4,0,0]} stackId="a"/>
              </BarChart></ResponsiveContainer>
              <div style={{overflowX:'auto',marginTop:12}}><table style={{width:'100%',borderCollapse:'collapse',fontSize:12}}><thead><tr style={{borderBottom:'2px solid #E5E7EB',background:'#F6F7FB'}}>
                {['Mes','Iniciales','Seguim.','Total','Días','Prom/Día'].map((h,i)=><TH key={i} align={i>0?'right':'left'}>{h}</TH>)}
              </tr></thead><tbody>{mData.map((r,i)=><tr key={i} style={{borderBottom:'1px solid #F3F4F6'}}>
                <td style={{padding:'6px 10px',fontWeight:500}}>{r.mes}</td>
                <td style={{padding:'6px 10px',textAlign:'right'}}>{fmtN(r.iniciales)}</td>
                <td style={{padding:'6px 10px',textAlign:'right'}}>{fmtN(r.seguimiento)}</td>
                <td style={{padding:'6px 10px',textAlign:'right',fontWeight:600}}>{fmtN(r.consultas)}</td>
                <td style={{padding:'6px 10px',textAlign:'right'}}>{r.dias}</td>
                <td style={{padding:'6px 10px',textAlign:'right'}}><Badge v={r.dias?(r.consultas/r.dias).toFixed(1):'-'} type={r.dias&&(r.consultas/r.dias)>=8?'green':'amber'}/></td>
              </tr>)}</tbody></table></div>
            </Card>
          })}
        </div>
      </div>}

      {/* COMPARATIVO */}
      {tab==='comparativo'&&<div>
        <Card title={`Comparativo Mensual ${cC.py} vs ${cC.cy}`} dot="#2563EB" style={{marginBottom:20}}>
          {cC.data.length>0?<ResponsiveContainer width="100%" height={340}><BarChart data={cC.data} barGap={6}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,.06)" vertical={false}/><XAxis dataKey="mes" tick={{fontSize:11,fill:'#6B7280'}} axisLine={false} tickLine={false}/><YAxis tick={{fontSize:11,fill:'#6B7280'}} axisLine={false} tickLine={false} tickFormatter={v=>'$'+(v/1e3).toFixed(0)+'K'}/>
            <Tooltip formatter={v=>fmt(v)} {...tt}/><Legend wrapperStyle={{fontSize:12}}/>
            <Bar dataKey={cC.py} fill="#D1D5DB" radius={[4,4,0,0]} name={cC.py}/><Bar dataKey={cC.cy} fill="#2563EB" radius={[4,4,0,0]} name={cC.cy}/>
          </BarChart></ResponsiveContainer>:<div style={{textAlign:'center',padding:48,color:'#9CA3AF'}}>No hay datos del año anterior.</div>}
        </Card>
        <Card title={`Comparativo Trimestral ${triChart.py} vs ${triChart.cy}`} dot="#7C3AED">
          {triChart.data.length>0?<>
            <ResponsiveContainer width="100%" height={300}><BarChart data={triChart.data} barGap={8}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,.06)" vertical={false}/><XAxis dataKey="q" tick={{fontSize:12,fill:'#6B7280'}} axisLine={false} tickLine={false}/><YAxis tick={{fontSize:11,fill:'#6B7280'}} axisLine={false} tickLine={false} tickFormatter={v=>'$'+(v/1e3).toFixed(0)+'K'}/>
              <Tooltip formatter={v=>fmt(v)} {...tt}/><Legend wrapperStyle={{fontSize:12}}/>
              <Bar dataKey={triChart.py} fill="#D1D5DB" radius={[4,4,0,0]} name={triChart.py}/><Bar dataKey={triChart.cy} fill="#7C3AED" radius={[4,4,0,0]} name={triChart.cy}/>
            </BarChart></ResponsiveContainer>
            <div style={{overflowX:'auto',marginTop:16}}><table style={{width:'100%',borderCollapse:'collapse',fontSize:13}}><thead><tr style={{borderBottom:'2px solid #E5E7EB',background:'#F6F7FB'}}>
              {['Trimestre',triChart.py,triChart.cy,'Variación'].map((h,i)=><TH key={i} align={i>0?'right':'left'}>{h}</TH>)}
            </tr></thead><tbody>{triChart.data.map((r,i)=>{const prev=Number(r[triChart.py])||0;const cur=Number(r[triChart.cy])||0;const v=prev?pctC(cur,prev):null;return<tr key={i} style={{borderBottom:'1px solid #F3F4F6'}}>
              <td style={{padding:'8px 10px',fontWeight:600}}>{r.q}</td>
              <td style={{padding:'8px 10px',textAlign:'right'}}>{prev?fmt(prev):'-'}</td>
              <td style={{padding:'8px 10px',textAlign:'right',fontWeight:600}}>{cur?fmt(cur):'-'}</td>
              <td style={{padding:'8px 10px',textAlign:'right'}}>{v!=null?<Badge v={`${v>0?'+':''}${v.toFixed(1)}%`} type={v>0?'green':'red'}/>:'-'}</td>
            </tr>})}</tbody></table></div>
          </>:<div style={{textAlign:'center',padding:48,color:'#9CA3AF'}}>No hay datos trimestrales.</div>}
        </Card>
      </div>}

      </div>
      <div style={{textAlign:'center',padding:'16px 0 24px',color:'#9CA3AF',fontSize:11,letterSpacing:2,textTransform:'uppercase'}}>MedLab Analytics · Clínica CCM</div>
    </div>
  </div>
}
