import { useState } from "react";

const ANOS    = ["2024", "2025", "2026", "2027"];
const M_CURTO = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];
const M_LONGO = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];

const STEPS       = ["periodo", "omie", "cashflow"];
const STEP_LABELS = { periodo: "Período", omie: "Dados Omie", cashflow: "Cashflow" };

// ════════════════════════════════════════════════════════════
//  OMIE API
// ════════════════════════════════════════════════════════════

async function omieCall(endpoint, call, params) {
  const res = await fetch("/api/omie", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ omieEndpoint: endpoint, call, params }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `Erro ${res.status}`);
  }
  return res.json();
}

// Determina entidade pelo nome da conta corrente
function entidadeFromNome(nome) {
  const n = String(nome || "").toUpperCase();
  if (n.includes("- PF") || n.includes("FE ") || n.includes("MI ") || n.includes("FE-") || n.includes("MI-") ||
      n.includes(" FE") || n.includes(" MI") || n.includes("CAMILA") || n.includes("FÊ")) return "PF";
  if (n.includes("GESTORA") || n.includes("- PJ") || n.includes("PJ")) return "PJ";
  return "PJ"; // default
}

// Busca todas as contas correntes e monta mapa nCodCC → {nome, entidade}
async function fetchContasCorrentes() {
  const map = {};
  let pagina = 1;
  while (true) {
    const resp = await omieCall("/geral/contacorrente/", "ListarContasCorrentes",
      { pagina, registros_por_pagina: 50 });
    const lista = resp.ListarContasCorrentes || [];
    lista.forEach(cc => {
      map[cc.nCodCC] = {
        nome: cc.descricao,
        entidade: entidadeFromNome(cc.descricao),
        inativo: cc.inativo === "S",
      };
    });
    if (pagina >= (resp.total_de_paginas || 1)) break;
    pagina++;
  }
  return map;
}

// Busca todos os títulos (PesquisarLancamentos) — sem filtro de data, filtra client-side
async function fetchTitulos(onStatus) {
  const todos = [];
  let pagina = 1;
  while (true) {
    onStatus(`Buscando lançamentos... (página ${pagina})`);
    const resp = await omieCall("/financas/pesquisartitulos/", "PesquisarLancamentos",
      { nPagina: pagina, nRegPorPagina: 500 });
    const lista = resp.titulosEncontrados || [];
    lista.forEach(t => todos.push(t.cabecTitulo));
    if (pagina >= (resp.nTotPaginas || 1)) break;
    pagina++;
  }
  return todos;
}

// Processa os títulos para o formato do dashboard
function processarDados(titulos, contasMap, ano) {
  const hoje    = new Date();
  const mesHoje = hoje.getMonth();
  const anoHoje = hoje.getFullYear();

  const meses = Array.from({ length: 12 }, (_, m) => {
    const isPassado = ano < anoHoje || (ano === anoHoje && m < mesHoje);
    const isAtual   = ano === anoHoje && m === mesHoje;
    return {
      mes: m,
      status: isPassado ? "realizado" : isAtual ? "parcial" : "previsto",
      pj: { receitas: 0, despesas: 0 },
      pf: { receitas: 0, despesas: 0 },
      lancamentos: [],
    };
  });

  titulos.forEach(t => {
    const dataStr = t.dDtVenc;
    if (!dataStr) return;
    const parts = dataStr.split("/");
    if (parts.length !== 3) return;
    const itemAno = parseInt(parts[2], 10);
    if (itemAno !== ano) return;
    const mes = parseInt(parts[1], 10) - 1;
    if (mes < 0 || mes > 11) return;

    const valor   = parseFloat(t.nValorTitulo || 0);
    const ccInfo  = contasMap[t.nCodCC] || { nome: "Desconhecida", entidade: "PJ" };
    const entidade = ccInfo.entidade;
    const isRec   = t.cNatureza === "R";

    if (isRec) {
      meses[mes][entidade].receitas += valor;
    } else {
      meses[mes][entidade].despesas += valor;
    }

    meses[mes].lancamentos.push({
      tipo:       isRec ? "Receber" : "Pagar",
      nome:       "—",
      categoria:  t.cCodCateg || "—",
      vencimento: dataStr,
      valor:      isRec ? valor : -valor,
      status:     t.cStatus,
      conta:      ccInfo.nome,
      entidade,
    });
  });

  return meses;
}

// ════════════════════════════════════════════════════════════
//  HELPERS
// ════════════════════════════════════════════════════════════

const brl = (v) =>
  "R$ " + Math.abs(v).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function getView(dados, entidade) {
  return dados.map(d => ({
    ...d,
    rec:  entidade === "PF" ? d.pf.receitas : entidade === "PJ" ? d.pj.receitas : d.pj.receitas + d.pf.receitas,
    desp: entidade === "PF" ? d.pf.despesas : entidade === "PJ" ? d.pj.despesas : d.pj.despesas + d.pf.despesas,
  }));
}

// ════════════════════════════════════════════════════════════
//  STEP INDICATOR
// ════════════════════════════════════════════════════════════

function StepIndicator({ current }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 0, marginBottom: 36 }}>
      {STEPS.map((step, i) => {
        const idx = STEPS.indexOf(current), stepIdx = STEPS.indexOf(step);
        const isActive = step === current, isDone = stepIdx < idx;
        return (
          <div key={step} style={{ display: "flex", alignItems: "center", flex: i < STEPS.length - 1 ? 1 : "unset" }}>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
              <div style={{ width:32,height:32,borderRadius:"50%",background:isDone?"#1B6B7B":isActive?"#fff":"transparent",border:`2px solid ${isDone?"#1B6B7B":isActive?"#1B6B7B":"#374151"}`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:13,fontWeight:700,color:isDone?"#fff":isActive?"#1B6B7B":"#6B7280",fontFamily:"'IBM Plex Mono',monospace" }}>
                {isDone ? "✓" : i + 1}
              </div>
              <span style={{ fontSize:10,fontFamily:"'IBM Plex Mono',monospace",color:isActive?"#1B6B7B":isDone?"#9CA3AF":"#4B5563",fontWeight:isActive?700:400,letterSpacing:1,textTransform:"uppercase" }}>
                {STEP_LABELS[step]}
              </span>
            </div>
            {i < STEPS.length - 1 && <div style={{ flex:1,height:2,margin:"0 4px",marginBottom:20,background:stepIdx<idx?"#1B6B7B":"#1F2937" }} />}
          </div>
        );
      })}
    </div>
  );
}

// ════════════════════════════════════════════════════════════
//  STEP 1: PERÍODO
// ════════════════════════════════════════════════════════════

function StepPeriodo({ onNext }) {
  const [ano, setAno] = useState(String(new Date().getFullYear()));
  return (
    <div>
      <h2 style={S.stepTitle}>Período de Referência</h2>
      <p style={S.stepDesc}>Selecione o ano para visualizar o cashflow completo.</p>
      <div style={{ marginTop: 28 }}>
        <label style={S.label}>Ano</label>
        <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
          {ANOS.map(a => (
            <button key={a} onClick={() => setAno(a)} style={{ ...S.anoBtn, borderColor:ano===a?"#1B6B7B":"#21262D", background:ano===a?"rgba(27,107,123,0.15)":"#0D1117", color:ano===a?"#1B6B7B":"#6B7280" }}>{a}</button>
          ))}
        </div>
      </div>
      <p style={{ ...S.stepDesc, marginTop: 20, fontSize: 12 }}>Visão completa Janeiro a Dezembro — realizado + previsto.</p>
      <button onClick={() => onNext(Number(ano))} style={{ ...S.btn, marginTop: 28 }}>Continuar →</button>
    </div>
  );
}

// ════════════════════════════════════════════════════════════
//  STEP 2: BUSCAR OMIE
// ════════════════════════════════════════════════════════════

function StepOmie({ ano, rawData, onNext, onBack }) {
  const [status, setStatus] = useState("idle");
  const [msg,    setMsg]    = useState("");
  const [erro,   setErro]   = useState("");

  const buscar = async () => {
    setStatus("loading");
    setErro("");
    try {
      setMsg("Buscando contas correntes...");
      const contasMap = await fetchContasCorrentes();
      const titulos   = await fetchTitulos(setMsg);
      setMsg("Processando dados...");
      onNext({ contasMap, titulos });
      setStatus("done");
    } catch (e) {
      setErro(e.message);
      setStatus("error");
    }
  };

  // Se já tem dados carregados, só processa o novo ano
  const usarExistente = () => {
    if (rawData) onNext(rawData);
  };

  return (
    <div>
      <h2 style={S.stepTitle}>Dados do Omie</h2>
      <p style={S.stepDesc}>Lançamentos de <strong style={{ color: "#1B6B7B" }}>Janeiro a Dezembro/{ano}</strong></p>

      {status === "idle" && (
        <>
          <div style={{ ...S.infoBox, marginTop: 24 }}>
            <div style={S.infoRow}><span>Fonte</span><span>Omie — PesquisarLancamentos</span></div>
            <div style={S.infoRow}><span>Contas</span><span>PJ (Gestora) + PF (Sócios)</span></div>
            <div style={{ ...S.infoRow, borderBottom: "none" }}><span>Ano</span><span>{ano}</span></div>
          </div>
          <div style={{ display: "flex", gap: 12, marginTop: 24 }}>
            <button onClick={onBack} style={S.btnSecondary}>← Voltar</button>
            {rawData && <button onClick={usarExistente} style={S.btnSecondary}>Usar dados em cache</button>}
            <button onClick={buscar} style={S.btn}>🔄 Buscar no Omie</button>
          </div>
        </>
      )}

      {status === "loading" && (
        <div style={S.loadingBox}>
          <div style={S.spinner} />
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <span style={{ color: "#F59E0B", fontFamily: "'IBM Plex Mono',monospace", fontSize: 13 }}>Conectando ao Omie...</span>
            <span style={{ color: "#4B5563", fontFamily: "'IBM Plex Mono',monospace", fontSize: 11 }}>{msg}</span>
          </div>
        </div>
      )}

      {status === "done" && (
        <div style={{ ...S.loadingBox, borderColor:"rgba(16,185,129,0.3)", background:"rgba(16,185,129,0.05)", marginTop:24 }}>
          <span style={{ fontSize: 20 }}>✅</span>
          <span style={{ color:"#10B981",fontFamily:"'IBM Plex Mono',monospace",fontSize:13 }}>Dados carregados!</span>
        </div>
      )}

      {status === "error" && (
        <>
          <div style={{ ...S.loadingBox, borderColor:"rgba(239,68,68,0.3)", background:"rgba(239,68,68,0.05)", marginTop:24 }}>
            <span style={{ fontSize: 20 }}>❌</span>
            <div>
              <div style={{ color:"#EF4444",fontFamily:"'IBM Plex Mono',monospace",fontSize:13 }}>Erro ao buscar dados</div>
              <div style={{ color:"#6B7280",fontFamily:"'IBM Plex Mono',monospace",fontSize:11,marginTop:4 }}>{erro}</div>
            </div>
          </div>
          <div style={{ display: "flex", gap: 12, marginTop: 20 }}>
            <button onClick={onBack} style={S.btnSecondary}>← Voltar</button>
            <button onClick={buscar} style={S.btn}>Tentar novamente</button>
          </div>
        </>
      )}
    </div>
  );
}

// ════════════════════════════════════════════════════════════
//  GRÁFICO SVG
// ════════════════════════════════════════════════════════════

function Grafico({ meses }) {
  const maxVal = Math.max(...meses.flatMap(m => [m.rec, m.desp]), 1);
  const W = 520, H = 110, BW = 13, GAP = 3, colW = W / 12;
  return (
    <svg viewBox={`0 0 ${W} ${H + 20}`} style={{ width: "100%", overflow: "visible" }}>
      {meses.map((m, i) => {
        const x = i * colW + (colW - BW * 2 - GAP) / 2;
        const hR = (m.rec  / maxVal) * H;
        const hD = (m.desp / maxVal) * H;
        const al = m.status === "previsto" ? 0.35 : m.status === "parcial" ? 0.7 : 1;
        return (
          <g key={i}>
            <rect x={x}        y={H-hR} width={BW} height={hR} fill={`rgba(27,107,123,${al})`}  rx={2} />
            <rect x={x+BW+GAP} y={H-hD} width={BW} height={hD} fill={`rgba(239,68,68,${al})`}   rx={2} />
            <text x={x+BW} y={H+14} textAnchor="middle" fontSize={8} fill={m.status==="previsto"?"#374151":"#6B7280"} fontFamily="'IBM Plex Mono',monospace">{M_CURTO[i]}</text>
            {i > 0 && (() => {
              const pm = meses[i-1];
              const x1 = (i-1)*colW+(colW-BW*2-GAP)/2+BW, y1 = H-(Math.max(0,pm.rec-pm.desp)/maxVal)*H;
              const x2 = x+BW,                              y2 = H-(Math.max(0,m.rec -m.desp) /maxVal)*H;
              return <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={`rgba(16,185,129,${al})`} strokeWidth={1.5} strokeDasharray={m.status==="previsto"?"4,3":"none"} />;
            })()}
          </g>
        );
      })}
    </svg>
  );
}

// ════════════════════════════════════════════════════════════
//  STEP 3: CASHFLOW
// ════════════════════════════════════════════════════════════

function StepCashflow({ ano, dados, onBack, onNovoAno }) {
  const [entidade,   setEntidade]   = useState("Consolidado");
  const [mesSel,     setMesSel]     = useState(null);
  const [filtroTipo, setFiltroTipo] = useState("Todos");
  const [filtroCat,  setFiltroCat]  = useState("");
  const [filtroConta,setFiltroConta]= useState("");

  const meses = getView(dados, entidade === "Consolidado" ? "Consolidado" : entidade);
  const totR  = meses.reduce((s,m) => s+m.rec,  0);
  const totD  = meses.reduce((s,m) => s+m.desp, 0);
  const res   = totR - totD;
  const mesH  = new Date().getMonth();
  const rReal = meses.filter((_,i) => i<=mesH).reduce((s,m) => s+m.rec,  0);
  const dReal = meses.filter((_,i) => i<=mesH).reduce((s,m) => s+m.desp, 0);

  const todoLanc = mesSel !== null ? (dados[mesSel]?.lancamentos || []) : dados.flatMap(d => d.lancamentos||[]);
  const lancFilt = todoLanc
    .filter(l => filtroTipo === "Todos" || l.tipo === filtroTipo)
    .filter(l => !filtroCat   || l.categoria.toLowerCase().includes(filtroCat.toLowerCase()))
    .filter(l => !filtroConta || l.conta.toLowerCase().includes(filtroConta.toLowerCase()))
    .filter(l => entidade === "Consolidado" || l.entidade === entidade);

  const contas = [...new Set(todoLanc.map(l=>l.conta).filter(Boolean))].sort();

  return (
    <div>
      {/* Header */}
      <div style={{ display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:20 }}>
        <div>
          <h2 style={S.stepTitle}>Cashflow {ano}</h2>
          <p style={S.stepDesc}>Janeiro a Dezembro — realizado + previsto</p>
        </div>
        <div style={{ display:"flex",gap:6,flexWrap:"wrap",justifyContent:"flex-end" }}>
          {["Consolidado","PJ","PF"].map(e => (
            <button key={e} onClick={() => setEntidade(e)} style={{ ...S.toggleBtn, borderColor:entidade===e?"#1B6B7B":"#21262D", background:entidade===e?"rgba(27,107,123,0.15)":"transparent", color:entidade===e?"#1B6B7B":"#4B5563" }}>{e}</button>
          ))}
        </div>
      </div>

      {/* KPIs */}
      <div style={{ display:"grid",gridTemplateColumns:"repeat(3,minmax(0,1fr))",gap:10,marginBottom:20 }}>
        {[
          { label:"Receitas (ano)",  val:totR, sub:rReal, color:"#10B981" },
          { label:"Despesas (ano)",  val:totD, sub:dReal, color:"#EF4444" },
          { label:"Resultado (ano)", val:res,  sub:rReal-dReal, color:res>=0?"#10B981":"#EF4444" },
        ].map(({label,val,sub,color}) => (
          <div key={label} style={S.kpi}>
            <div style={S.kpiLabel}>{label}</div>
            <div style={{ ...S.kpiVal, color }}>{val>0&&label.includes("Resultado")?"+":""}{brl(val)}</div>
            <div style={S.kpiSub}>Real.: {sub>=0?"+":""}{brl(sub)}</div>
          </div>
        ))}
      </div>

      {/* Gráfico */}
      <div style={S.graficoBox}>
        <div style={{ display:"flex",gap:16,marginBottom:12,alignItems:"center" }}>
          <span style={S.legItem}><span style={{ ...S.legDot,background:"#1B6B7B" }} />Receitas</span>
          <span style={S.legItem}><span style={{ ...S.legDot,background:"#EF4444" }} />Despesas</span>
          <span style={S.legItem}><span style={{ display:"inline-block",width:14,height:2,background:"#10B981",marginRight:4,verticalAlign:"middle" }} />Resultado</span>
          <span style={{ ...S.legItem,marginLeft:"auto",color:"#374151" }}>░ Previsto</span>
        </div>
        <Grafico meses={meses} />
      </div>

      {/* Tabela mensal */}
      <div style={{ marginTop:16,marginBottom:24 }}>
        <table style={{ width:"100%",borderCollapse:"collapse" }}>
          <thead><tr>{["Mês","Receitas","Despesas","Resultado","Status"].map(h=><th key={h} style={S.th}>{h}</th>)}</tr></thead>
          <tbody>
            {meses.map((m,i) => {
              const r = m.rec - m.desp, sel = mesSel===i;
              return (
                <tr key={i} onClick={() => setMesSel(sel?null:i)} style={{ cursor:"pointer",background:sel?"rgba(27,107,123,0.1)":"transparent" }}>
                  <td style={{ ...S.td,color:"#D1D5DB",fontWeight:600 }}>{sel?"▼ ":""}{M_LONGO[m.mes]}</td>
                  <td style={{ ...S.td,color:"#10B981" }}>{m.rec>0?brl(m.rec):"—"}</td>
                  <td style={{ ...S.td,color:"#EF4444" }}>{brl(m.desp)}</td>
                  <td style={{ ...S.td,color:r>=0?"#10B981":"#EF4444",fontWeight:600 }}>{r>=0?"+":""}{brl(r)}</td>
                  <td style={S.td}>
                    <span style={{ ...S.badge, background:m.status==="realizado"?"rgba(16,185,129,0.1)":m.status==="parcial"?"rgba(245,158,11,0.1)":"rgba(55,65,81,0.4)", color:m.status==="realizado"?"#10B981":m.status==="parcial"?"#F59E0B":"#6B7280" }}>
                      {m.status==="realizado"?"✓ Realizado":m.status==="parcial"?"◐ Em curso":"○ Previsto"}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr style={{ borderTop:"2px solid #21262D" }}>
              <td style={{ ...S.td,color:"#9CA3AF",fontWeight:700,paddingTop:12 }}>TOTAL</td>
              <td style={{ ...S.td,color:"#10B981",fontWeight:700,paddingTop:12 }}>{brl(totR)}</td>
              <td style={{ ...S.td,color:"#EF4444",fontWeight:700,paddingTop:12 }}>{brl(totD)}</td>
              <td style={{ ...S.td,color:res>=0?"#10B981":"#EF4444",fontWeight:700,paddingTop:12 }}>{res>=0?"+":""}{brl(res)}</td>
              <td style={S.td} />
            </tr>
          </tfoot>
        </table>
      </div>

      {/* Lançamentos */}
      <div style={{ borderTop:"1px solid #21262D",paddingTop:20 }}>
        <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14 }}>
          <div style={{ fontFamily:"'IBM Plex Mono',monospace",fontSize:11,color:"#6B7280",letterSpacing:1,textTransform:"uppercase" }}>
            {mesSel!==null?`Lançamentos — ${M_LONGO[mesSel]}`:"Todos os lançamentos"}
            {mesSel!==null&&<button onClick={()=>setMesSel(null)} style={{ ...S.btnSecondary,padding:"3px 10px",fontSize:10,marginLeft:10 }}>Ver todos</button>}
          </div>
          <span style={{ fontFamily:"'IBM Plex Mono',monospace",fontSize:10,color:"#4B5563" }}>{lancFilt.length} registros</span>
        </div>

        {/* Filtros */}
        <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8,marginBottom:14 }}>
          <div>
            <label style={S.label}>Tipo</label>
            <select value={filtroTipo} onChange={e=>setFiltroTipo(e.target.value)} style={S.select}>
              <option>Todos</option><option>Receber</option><option>Pagar</option>
            </select>
          </div>
          <div>
            <label style={S.label}>Categoria</label>
            <input value={filtroCat} onChange={e=>setFiltroCat(e.target.value)} placeholder="Ex: 2.04.05" style={S.input} />
          </div>
          <div>
            <label style={S.label}>Conta Corrente</label>
            <input value={filtroConta} onChange={e=>setFiltroConta(e.target.value)} placeholder="Filtrar conta..." list="contas-list" style={S.input} />
            <datalist id="contas-list">{contas.map(c=><option key={c} value={c}/>)}</datalist>
          </div>
        </div>

        <div style={{ maxHeight:340,overflowY:"auto" }}>
          <table style={{ width:"100%",borderCollapse:"collapse" }}>
            <thead style={{ position:"sticky",top:0,background:"#161B22" }}>
              <tr>{["Vencimento","Categoria","Valor","Conta","Ent."].map(h=><th key={h} style={S.th}>{h}</th>)}</tr>
            </thead>
            <tbody>
              {lancFilt.length===0
                ? <tr><td colSpan={5} style={{ ...S.td,textAlign:"center",color:"#4B5563",padding:24 }}>Nenhum lançamento encontrado</td></tr>
                : lancFilt.map((l,i) => (
                  <tr key={i}>
                    <td style={{ ...S.td,color:"#9CA3AF" }}>{l.vencimento}</td>
                    <td style={{ ...S.td,color:"#6B7280",maxWidth:120,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap" }}>{l.categoria}</td>
                    <td style={{ ...S.td,color:l.valor>=0?"#10B981":"#EF4444",fontWeight:600 }}>{l.valor>=0?"+":""}{brl(l.valor)}</td>
                    <td style={{ ...S.td,color:"#9CA3AF",maxWidth:160,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap" }}>{l.conta}</td>
                    <td style={S.td}>
                      <span style={{ ...S.badge,background:l.entidade==="PJ"?"rgba(27,107,123,0.15)":"rgba(245,158,11,0.1)",color:l.entidade==="PJ"?"#1B6B7B":"#F59E0B" }}>{l.entidade}</span>
                    </td>
                  </tr>
                ))
              }
            </tbody>
          </table>
        </div>
      </div>

      <div style={S.legendaStatus}>
        <span style={{ color:"#4B5563",fontSize:10,fontFamily:"'IBM Plex Mono',monospace",letterSpacing:1 }}>
          ✓ REALIZADO · ◐ EM CURSO · ○ PREVISTO · Clique no mês para filtrar lançamentos
        </span>
      </div>

      <div style={{ display:"flex",gap:12,marginTop:20 }}>
        <button onClick={onBack} style={S.btnSecondary}>← Novo período</button>
        <button onClick={onNovoAno} style={S.btnSecondary}>↻ Atualizar dados</button>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════
//  APP PRINCIPAL
// ════════════════════════════════════════════════════════════

export default function GestoraFinanceiro() {
  const [step,    setStep]    = useState("periodo");
  const [ano,     setAno]     = useState(null);
  const [rawData, setRawData] = useState(null); // cache dos dados brutos do Omie
  const [dados,   setDados]   = useState(null); // dados processados para o ano

  const handleRawData = (raw, anoSel) => {
    setRawData(raw);
    const processado = processarDados(raw.titulos, raw.contasMap, anoSel || ano);
    setDados(processado);
    setStep("cashflow");
  };

  return (
    <div style={S.root}>
      <div style={S.header}>
        <div style={S.logo}>GESTORA</div>
        <div style={S.headerSub}>Financeiro</div>
      </div>
      <div style={{ ...S.card, maxWidth: step==="cashflow" ? 780 : 520 }}>
        <StepIndicator current={step} />

        {step === "periodo" && (
          <StepPeriodo onNext={a => { setAno(a); setStep("omie"); }} />
        )}

        {step === "omie" && (
          <StepOmie
            ano={ano}
            rawData={rawData}
            onNext={raw => handleRawData(raw, ano)}
            onBack={() => setStep("periodo")}
          />
        )}

        {step === "cashflow" && dados && (
          <StepCashflow
            ano={ano}
            dados={dados}
            onBack={() => { setStep("periodo"); setDados(null); }}
            onNovoAno={() => { setStep("omie"); setDados(null); }}
          />
        )}
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════
//  ESTILOS
// ════════════════════════════════════════════════════════════

const S = {
  root:         { minHeight:"100vh",background:"#0D1117",display:"flex",flexDirection:"column",alignItems:"center",padding:"32px 16px 64px",fontFamily:"'IBM Plex Sans',sans-serif" },
  header:       { display:"flex",flexDirection:"column",alignItems:"center",marginBottom:32,gap:4 },
  logo:         { fontFamily:"'IBM Plex Mono',monospace",fontSize:28,fontWeight:700,color:"#1B6B7B",letterSpacing:6 },
  headerSub:    { fontFamily:"'IBM Plex Mono',monospace",fontSize:11,color:"#4B5563",letterSpacing:3,textTransform:"uppercase" },
  card:         { background:"#161B22",border:"1px solid #21262D",borderRadius:16,padding:32,width:"100%",transition:"max-width 0.4s" },
  stepTitle:    { fontFamily:"'IBM Plex Sans',sans-serif",fontSize:20,fontWeight:700,color:"#F9FAFB",margin:0 },
  stepDesc:     { fontFamily:"'IBM Plex Sans',sans-serif",fontSize:14,color:"#6B7280",marginTop:8,marginBottom:0 },
  label:        { display:"block",fontFamily:"'IBM Plex Mono',monospace",fontSize:10,color:"#4B5563",letterSpacing:2,textTransform:"uppercase",marginBottom:4 },
  btn:          { background:"#1B6B7B",color:"#fff",border:"none",borderRadius:8,padding:"12px 24px",fontFamily:"'IBM Plex Mono',monospace",fontSize:13,fontWeight:600,cursor:"pointer",letterSpacing:1 },
  btnSecondary: { background:"transparent",color:"#6B7280",border:"1px solid #374151",borderRadius:8,padding:"12px 20px",fontFamily:"'IBM Plex Mono',monospace",fontSize:13,cursor:"pointer",letterSpacing:1 },
  anoBtn:       { border:"1px solid",borderRadius:8,padding:"10px 20px",fontFamily:"'IBM Plex Mono',monospace",fontSize:14,fontWeight:600,cursor:"pointer",transition:"all 0.2s" },
  toggleBtn:    { border:"1px solid",borderRadius:6,padding:"6px 12px",fontFamily:"'IBM Plex Mono',monospace",fontSize:11,fontWeight:600,cursor:"pointer",letterSpacing:0.5 },
  infoBox:      { background:"#0D1117",border:"1px solid #21262D",borderRadius:10,padding:"16px 20px" },
  infoRow:      { display:"flex",justifyContent:"space-between",fontFamily:"'IBM Plex Sans',sans-serif",fontSize:13,color:"#9CA3AF",padding:"7px 0",borderBottom:"1px solid #1F2937" },
  loadingBox:   { display:"flex",alignItems:"center",gap:12,background:"rgba(245,158,11,0.05)",border:"1px solid rgba(245,158,11,0.2)",borderRadius:10,padding:"20px 24px",marginTop:24 },
  spinner:      { width:20,height:20,border:"2px solid #374151",borderTop:"2px solid #F59E0B",borderRadius:"50%",animation:"spin 0.8s linear infinite",flexShrink:0 },
  kpi:          { background:"#0D1117",border:"1px solid #21262D",borderRadius:10,padding:"14px 16px" },
  kpiLabel:     { fontFamily:"'IBM Plex Mono',monospace",fontSize:10,color:"#4B5563",letterSpacing:1.5,textTransform:"uppercase",marginBottom:8 },
  kpiVal:       { fontFamily:"'IBM Plex Mono',monospace",fontSize:15,fontWeight:700 },
  kpiSub:       { fontFamily:"'IBM Plex Mono',monospace",fontSize:10,color:"#374151",marginTop:4 },
  graficoBox:   { background:"#0D1117",border:"1px solid #21262D",borderRadius:10,padding:"16px 20px",marginBottom:14 },
  legItem:      { fontFamily:"'IBM Plex Mono',monospace",fontSize:10,color:"#6B7280",display:"flex",alignItems:"center",gap:4 },
  legDot:       { display:"inline-block",width:8,height:8,borderRadius:2 },
  th:           { fontFamily:"'IBM Plex Mono',monospace",fontSize:9,color:"#4B5563",letterSpacing:1.5,textTransform:"uppercase",textAlign:"left",padding:"8px 6px 12px",borderBottom:"1px solid #21262D" },
  td:           { fontFamily:"'IBM Plex Mono',monospace",fontSize:11,color:"#9CA3AF",padding:"9px 6px",borderBottom:"1px solid #1A1F26" },
  badge:        { display:"inline-block",borderRadius:4,padding:"3px 8px",fontSize:10,fontFamily:"'IBM Plex Mono',monospace" },
  legendaStatus:{ marginTop:12,padding:"10px 0",borderTop:"1px solid #1A1F26",textAlign:"center" },
  select:       { width:"100%",background:"#0D1117",border:"1px solid #21262D",borderRadius:6,padding:"8px 10px",color:"#F9FAFB",fontFamily:"'IBM Plex Mono',monospace",fontSize:12,outline:"none" },
  input:        { width:"100%",background:"#0D1117",border:"1px solid #21262D",borderRadius:6,padding:"8px 10px",color:"#F9FAFB",fontFamily:"'IBM Plex Mono',monospace",fontSize:12,outline:"none",boxSizing:"border-box" },
};
