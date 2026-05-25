import { useState } from "react";

// ─── Constantes ────────────────────────────────────────────────────────────
const ANOS = ["2024", "2025", "2026", "2027"];
const M_CURTO = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];
const M_LONGO = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];

const STEPS = ["periodo", "omie", "cashflow"];
const STEP_LABELS = { periodo: "Período", omie: "Dados Omie", cashflow: "Cashflow" };

// ─── Mock data — substituir por chamada real ao Omie ───────────────────────
function gerarMock(ano) {
  const hoje = new Date();
  const anoHoje = hoje.getFullYear();
  const mesHoje = hoje.getMonth(); // 0-index

  // Dados base mensais inspirados nos exports reais da Gestora
  const base = [
    { recPJ: 18500, despPJ: 14200, despPF: 5800 }, // Jan
    { recPJ: 19200, despPJ: 15100, despPF: 6200 }, // Fev
    { recPJ: 21000, despPJ: 14800, despPF: 5600 }, // Mar
    { recPJ: 22500, despPJ: 16300, despPF: 6400 }, // Abr
    { recPJ: 20800, despPJ: 15600, despPF: 6100 }, // Mai
    { recPJ: 21500, despPJ: 15200, despPF: 6300 }, // Jun
    { recPJ: 22000, despPJ: 15800, despPF: 6200 }, // Jul
    { recPJ: 21800, despPJ: 15400, despPF: 6000 }, // Ago
    { recPJ: 23000, despPJ: 16100, despPF: 6500 }, // Set
    { recPJ: 22500, despPJ: 15700, despPF: 6300 }, // Out
    { recPJ: 24000, despPJ: 16500, despPF: 6800 }, // Nov
    { recPJ: 25500, despPJ: 17200, despPF: 7200 }, // Dez
  ];

  return base.map((b, m) => {
    const isPassado = ano < anoHoje || (ano === anoHoje && m < mesHoje);
    const isAtual   = ano === anoHoje && m === mesHoje;
    const status    = isPassado ? "realizado" : isAtual ? "parcial" : "previsto";

    // Previsto: ligeira variação sobre base
    const fator = isPassado || isAtual ? 1 : 0.95;

    return {
      mes: m,
      status,
      pj: { receitas: b.recPJ * fator, despesas: b.despPJ * fator },
      pf: { receitas: 0,               despesas: b.despPF * fator },
    };
  });
}

// ─── Helpers ───────────────────────────────────────────────────────────────
const brl = (v) =>
  "R$ " + Math.abs(v).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function getEntidade(dados, entidade) {
  return dados.map(d => ({
    ...d,
    receitas: entidade === "PF" ? d.pf.receitas : entidade === "PJ" ? d.pj.receitas : d.pj.receitas + d.pf.receitas,
    despesas: entidade === "PF" ? d.pf.despesas : entidade === "PJ" ? d.pj.despesas : d.pj.despesas + d.pf.despesas,
  }));
}

// ─── StepIndicator (igual Sofia) ───────────────────────────────────────────
function StepIndicator({ current }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 0, marginBottom: 36 }}>
      {STEPS.map((step, i) => {
        const idx     = STEPS.indexOf(current);
        const stepIdx = STEPS.indexOf(step);
        const isActive = step === current;
        const isDone   = stepIdx < idx;
        return (
          <div key={step} style={{ display: "flex", alignItems: "center", flex: i < STEPS.length - 1 ? 1 : "unset" }}>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
              <div style={{
                width: 32, height: 32, borderRadius: "50%",
                background: isDone ? "#1B6B7B" : isActive ? "#fff" : "transparent",
                border: `2px solid ${isDone ? "#1B6B7B" : isActive ? "#1B6B7B" : "#374151"}`,
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 13, fontWeight: 700,
                color: isDone ? "#fff" : isActive ? "#1B6B7B" : "#6B7280",
                fontFamily: "'IBM Plex Mono', monospace",
              }}>
                {isDone ? "✓" : i + 1}
              </div>
              <span style={{
                fontSize: 10, fontFamily: "'IBM Plex Mono', monospace",
                color: isActive ? "#1B6B7B" : isDone ? "#9CA3AF" : "#4B5563",
                fontWeight: isActive ? 700 : 400, letterSpacing: 1,
                textTransform: "uppercase",
              }}>
                {STEP_LABELS[step]}
              </span>
            </div>
            {i < STEPS.length - 1 && (
              <div style={{
                flex: 1, height: 2, margin: "0 4px", marginBottom: 20,
                background: stepIdx < idx ? "#1B6B7B" : "#1F2937",
                transition: "background 0.3s",
              }} />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── Step 1: Período ───────────────────────────────────────────────────────
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
            <button key={a} onClick={() => setAno(a)} style={{
              ...S.anoBtn,
              borderColor: ano === a ? "#1B6B7B" : "#21262D",
              background:  ano === a ? "rgba(27,107,123,0.15)" : "#0D1117",
              color:       ano === a ? "#1B6B7B" : "#6B7280",
            }}>{a}</button>
          ))}
        </div>
      </div>
      <p style={{ ...S.stepDesc, marginTop: 20, fontSize: 12 }}>
        Visão completa Janeiro a Dezembro — realizado + previsto.
      </p>
      <button onClick={() => onNext(Number(ano))} style={{ ...S.btn, marginTop: 28 }}>
        Continuar →
      </button>
    </div>
  );
}

// ─── Step 2: Buscar Omie ───────────────────────────────────────────────────
function StepOmie({ ano, onNext, onBack }) {
  const [status, setStatus] = useState("idle");

  const buscar = async () => {
    setStatus("loading");
    await new Promise(r => setTimeout(r, 2200)); // substituir por chamada real ao Omie
    const dados = gerarMock(ano);
    setStatus("done");
    setTimeout(() => onNext(dados), 600);
  };

  const totais = status === "idle" ? null : {
    rec: gerarMock(ano).reduce((s, d) => s + d.pj.receitas, 0),
    desp: gerarMock(ano).reduce((s, d) => s + d.pj.despesas + d.pf.despesas, 0),
  };

  return (
    <div>
      <h2 style={S.stepTitle}>Dados do Omie</h2>
      <p style={S.stepDesc}>
        Buscar lançamentos e fluxo de caixa de{" "}
        <strong style={{ color: "#1B6B7B" }}>Janeiro a Dezembro/{ano}</strong>
      </p>

      {status === "idle" && (
        <>
          <div style={{ ...S.infoBox, marginTop: 24 }}>
            <div style={S.infoRow}><span>Período</span><span>01/01/{ano} — 31/12/{ano}</span></div>
            <div style={S.infoRow}><span>Contas</span><span>PJ (Gestora) + PF (Sócios)</span></div>
            <div style={S.infoRow}><span>Dados</span><span>Contas a Pagar + Contas a Receber</span></div>
          </div>
          <div style={{ display: "flex", gap: 12, marginTop: 24 }}>
            <button onClick={onBack} style={S.btnSecondary}>← Voltar</button>
            <button onClick={buscar} style={S.btn}>Buscar no Omie</button>
          </div>
        </>
      )}

      {status === "loading" && (
        <div style={S.loadingBox}>
          <div style={S.spinner} />
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <span style={{ color: "#F59E0B", fontFamily: "'IBM Plex Mono', monospace", fontSize: 13 }}>
              Conectando ao Omie...
            </span>
            <span style={{ color: "#4B5563", fontFamily: "'IBM Plex Mono', monospace", fontSize: 11 }}>
              Buscando lançamentos de {ano}
            </span>
          </div>
        </div>
      )}

      {status === "done" && (
        <div style={{ ...S.loadingBox, borderColor: "rgba(16,185,129,0.3)", background: "rgba(16,185,129,0.05)" }}>
          <span style={{ fontSize: 20 }}>✅</span>
          <span style={{ color: "#10B981", fontFamily: "'IBM Plex Mono', monospace", fontSize: 13 }}>
            Dados carregados — abrindo cashflow...
          </span>
        </div>
      )}
    </div>
  );
}

// ─── Gráfico SVG ───────────────────────────────────────────────────────────
function Grafico({ meses }) {
  const maxVal = Math.max(...meses.flatMap(m => [m.receitas, m.despesas]));
  const W = 520, H = 120, BAR_W = 14, GAP = 4;
  const colW = W / 12;

  return (
    <svg viewBox={`0 0 ${W} ${H + 20}`} style={{ width: "100%", overflow: "visible" }}>
      {meses.map((m, i) => {
        const x     = i * colW + (colW - BAR_W * 2 - GAP) / 2;
        const hRec  = (m.receitas / maxVal) * H;
        const hDesp = (m.despesas / maxVal) * H;
        const alpha = m.status === "previsto" ? 0.4 : m.status === "parcial" ? 0.7 : 1;

        return (
          <g key={i}>
            {/* Receitas */}
            <rect
              x={x} y={H - hRec} width={BAR_W} height={hRec}
              fill={`rgba(27,107,123,${alpha})`} rx={2}
            />
            {/* Despesas */}
            <rect
              x={x + BAR_W + GAP} y={H - hDesp} width={BAR_W} height={hDesp}
              fill={`rgba(239,68,68,${alpha})`} rx={2}
            />
            {/* Mês label */}
            <text
              x={x + BAR_W} y={H + 14}
              textAnchor="middle" fontSize={9}
              fill={m.status === "previsto" ? "#374151" : "#6B7280"}
              fontFamily="'IBM Plex Mono', monospace"
            >
              {M_CURTO[i]}
            </text>
            {/* Linha resultado */}
            {i > 0 && (() => {
              const prev = meses[i - 1];
              const x1 = (i - 1) * colW + (colW - BAR_W * 2 - GAP) / 2 + BAR_W;
              const y1 = H - (Math.max(0, prev.receitas - prev.despesas) / maxVal) * H;
              const x2 = x + BAR_W;
              const y2 = H - (Math.max(0, m.receitas - m.despesas) / maxVal) * H;
              return (
                <line x1={x1} y1={y1} x2={x2} y2={y2}
                  stroke={`rgba(16,185,129,${alpha})`} strokeWidth={1.5}
                  strokeDasharray={m.status === "previsto" ? "4,3" : "none"}
                />
              );
            })()}
          </g>
        );
      })}
    </svg>
  );
}

// ─── Step 3: Cashflow ──────────────────────────────────────────────────────
function StepCashflow({ ano, dados, onBack }) {
  const [entidade, setEntidade] = useState("Consolidado");
  const [detalhe, setDetalhe]   = useState(null); // mês selecionado

  const meses = getEntidade(dados, entidade === "Consolidado" ? "Consolidado" : entidade);

  const totalRec  = meses.reduce((s, m) => s + m.receitas, 0);
  const totalDesp = meses.reduce((s, m) => s + m.despesas, 0);
  const resultado = totalRec - totalDesp;

  const mesAtual = new Date().getMonth();
  const recReal  = meses.filter((_, i) => i <= mesAtual).reduce((s, m) => s + m.receitas, 0);
  const despReal = meses.filter((_, i) => i <= mesAtual).reduce((s, m) => s + m.despesas, 0);

  return (
    <div>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 }}>
        <div>
          <h2 style={S.stepTitle}>Cashflow {ano}</h2>
          <p style={S.stepDesc}>Janeiro a Dezembro — realizado + previsto</p>
        </div>
        <div style={{ display: "flex", gap: 6 }}>
          {["Consolidado", "PJ", "PF"].map(e => (
            <button key={e} onClick={() => setEntidade(e)} style={{
              ...S.toggleBtn,
              borderColor: entidade === e ? "#1B6B7B" : "#21262D",
              background:  entidade === e ? "rgba(27,107,123,0.15)" : "transparent",
              color:       entidade === e ? "#1B6B7B" : "#4B5563",
            }}>{e}</button>
          ))}
        </div>
      </div>

      {/* KPIs */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10, marginBottom: 20 }}>
        <div style={S.kpi}>
          <div style={S.kpiLabel}>Receitas (ano)</div>
          <div style={{ ...S.kpiVal, color: "#10B981" }}>{brl(totalRec)}</div>
          <div style={S.kpiSub}>Realizado: {brl(recReal)}</div>
        </div>
        <div style={S.kpi}>
          <div style={S.kpiLabel}>Despesas (ano)</div>
          <div style={{ ...S.kpiVal, color: "#EF4444" }}>{brl(totalDesp)}</div>
          <div style={S.kpiSub}>Realizado: {brl(despReal)}</div>
        </div>
        <div style={S.kpi}>
          <div style={S.kpiLabel}>Resultado (ano)</div>
          <div style={{ ...S.kpiVal, color: resultado >= 0 ? "#10B981" : "#EF4444" }}>
            {resultado >= 0 ? "+" : ""}{brl(resultado)}
          </div>
          <div style={S.kpiSub}>
            Realizado: {brl(recReal - despReal) >= 0 ? "+" : ""}{brl(recReal - despReal)}
          </div>
        </div>
      </div>

      {/* Gráfico */}
      <div style={S.graficoBox}>
        <div style={{ display: "flex", gap: 16, marginBottom: 12, alignItems: "center" }}>
          <span style={S.legendaItem}>
            <span style={{ ...S.legendaDot, background: "#1B6B7B" }} /> Receitas
          </span>
          <span style={S.legendaItem}>
            <span style={{ ...S.legendaDot, background: "#EF4444" }} /> Despesas
          </span>
          <span style={S.legendaItem}>
            <span style={{ display: "inline-block", width: 16, height: 2, background: "#10B981", marginRight: 6, verticalAlign: "middle" }} />
            Resultado
          </span>
          <span style={{ ...S.legendaItem, marginLeft: "auto", color: "#374151", fontSize: 10 }}>
            ░ Previsto
          </span>
        </div>
        <Grafico meses={meses} />
      </div>

      {/* Tabela mensal */}
      <div style={{ marginTop: 16 }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              {["Mês", "Receitas", "Despesas", "Resultado", "Status"].map(h => (
                <th key={h} style={S.th}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {meses.map((m, i) => {
              const res = m.receitas - m.despesas;
              const isSelected = detalhe === i;
              return (
                <tr key={i}
                  onClick={() => setDetalhe(isSelected ? null : i)}
                  style={{
                    cursor: "pointer",
                    background: isSelected ? "rgba(27,107,123,0.08)" : "transparent",
                    transition: "background 0.15s",
                  }}>
                  <td style={{ ...S.td, color: "#D1D5DB", fontWeight: 600 }}>
                    {M_LONGO[m.mes]}
                  </td>
                  <td style={{ ...S.td, color: "#10B981" }}>
                    {m.receitas > 0 ? brl(m.receitas) : "—"}
                  </td>
                  <td style={{ ...S.td, color: "#EF4444" }}>
                    {brl(m.despesas)}
                  </td>
                  <td style={{ ...S.td, color: res >= 0 ? "#10B981" : "#EF4444", fontWeight: 600 }}>
                    {res >= 0 ? "+" : ""}{brl(res)}
                  </td>
                  <td style={S.td}>
                    <span style={{
                      ...S.badge,
                      background: m.status === "realizado" ? "rgba(16,185,129,0.1)"
                                : m.status === "parcial"   ? "rgba(245,158,11,0.1)"
                                : "rgba(55,65,81,0.4)",
                      color: m.status === "realizado" ? "#10B981"
                           : m.status === "parcial"   ? "#F59E0B"
                           : "#6B7280",
                    }}>
                      {m.status === "realizado" ? "✓ Realizado"
                     : m.status === "parcial"   ? "◐ Em curso"
                     :                            "○ Previsto"}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr style={{ borderTop: "2px solid #21262D" }}>
              <td style={{ ...S.td, color: "#9CA3AF", fontWeight: 700, paddingTop: 12 }}>TOTAL</td>
              <td style={{ ...S.td, color: "#10B981", fontWeight: 700, paddingTop: 12 }}>{brl(totalRec)}</td>
              <td style={{ ...S.td, color: "#EF4444", fontWeight: 700, paddingTop: 12 }}>{brl(totalDesp)}</td>
              <td style={{ ...S.td, color: resultado >= 0 ? "#10B981" : "#EF4444", fontWeight: 700, paddingTop: 12 }}>
                {resultado >= 0 ? "+" : ""}{brl(resultado)}
              </td>
              <td style={S.td} />
            </tr>
          </tfoot>
        </table>
      </div>

      {/* Legenda status */}
      <div style={S.legendaStatus}>
        <span style={{ color: "#4B5563", fontSize: 10, fontFamily: "'IBM Plex Mono', monospace", letterSpacing: 1 }}>
          ✓ REALIZADO — lançamentos pagos/recebidos &nbsp;·&nbsp;
          ◐ EM CURSO — mês atual &nbsp;·&nbsp;
          ○ PREVISTO — contratos e lançamentos futuros
        </span>
      </div>

      <button onClick={onBack} style={{ ...S.btnSecondary, marginTop: 20 }}>← Novo período</button>
    </div>
  );
}

// ─── App principal ─────────────────────────────────────────────────────────
export default function GestoraFinanceiro() {
  const [step,  setStep]  = useState("periodo");
  const [ano,   setAno]   = useState(null);
  const [dados, setDados] = useState(null);

  return (
    <div style={S.root}>
      <div style={S.header}>
        <div style={S.logo}>GESTORA</div>
        <div style={S.headerSub}>Financeiro</div>
      </div>

      <div style={{ ...S.card, maxWidth: step === "cashflow" ? 680 : 520 }}>
        <StepIndicator current={step} />

        {step === "periodo" && (
          <StepPeriodo onNext={a => { setAno(a); setStep("omie"); }} />
        )}
        {step === "omie" && (
          <StepOmie
            ano={ano}
            onNext={d => { setDados(d); setStep("cashflow"); }}
            onBack={() => setStep("periodo")}
          />
        )}
        {step === "cashflow" && dados && (
          <StepCashflow
            ano={ano}
            dados={dados}
            onBack={() => { setStep("periodo"); setDados(null); }}
          />
        )}
      </div>
    </div>
  );
}

// ─── Estilos ───────────────────────────────────────────────────────────────
const S = {
  root: {
    minHeight: "100vh",
    background: "#0D1117",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    padding: "32px 16px 64px",
    fontFamily: "'IBM Plex Sans', sans-serif",
  },
  header: {
    display: "flex", flexDirection: "column", alignItems: "center",
    marginBottom: 32, gap: 4,
  },
  logo: {
    fontFamily: "'IBM Plex Mono', monospace",
    fontSize: 28, fontWeight: 700, color: "#1B6B7B", letterSpacing: 6,
  },
  headerSub: {
    fontFamily: "'IBM Plex Mono', monospace",
    fontSize: 11, color: "#4B5563", letterSpacing: 3, textTransform: "uppercase",
  },
  card: {
    background: "#161B22",
    border: "1px solid #21262D",
    borderRadius: 16,
    padding: 32,
    width: "100%",
    transition: "max-width 0.4s",
  },
  stepTitle: {
    fontFamily: "'IBM Plex Sans', sans-serif",
    fontSize: 20, fontWeight: 700, color: "#F9FAFB", margin: 0,
  },
  stepDesc: {
    fontFamily: "'IBM Plex Sans', sans-serif",
    fontSize: 14, color: "#6B7280", marginTop: 8, marginBottom: 0,
  },
  label: {
    display: "block",
    fontFamily: "'IBM Plex Mono', monospace",
    fontSize: 10, color: "#4B5563", letterSpacing: 2,
    textTransform: "uppercase", marginBottom: 6,
  },
  btn: {
    background: "#1B6B7B", color: "#fff", border: "none",
    borderRadius: 8, padding: "12px 24px",
    fontFamily: "'IBM Plex Mono', monospace",
    fontSize: 13, fontWeight: 600, cursor: "pointer", letterSpacing: 1,
  },
  btnSecondary: {
    background: "transparent", color: "#6B7280",
    border: "1px solid #374151", borderRadius: 8, padding: "12px 20px",
    fontFamily: "'IBM Plex Mono', monospace", fontSize: 13, cursor: "pointer", letterSpacing: 1,
  },
  anoBtn: {
    border: "1px solid", borderRadius: 8, padding: "10px 20px",
    fontFamily: "'IBM Plex Mono', monospace", fontSize: 14, fontWeight: 600,
    cursor: "pointer", transition: "all 0.2s",
  },
  toggleBtn: {
    border: "1px solid", borderRadius: 6, padding: "6px 12px",
    fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, fontWeight: 600,
    cursor: "pointer", letterSpacing: 0.5,
  },
  infoBox: {
    background: "#0D1117", border: "1px solid #21262D",
    borderRadius: 10, padding: "16px 20px",
  },
  infoRow: {
    display: "flex", justifyContent: "space-between",
    fontFamily: "'IBM Plex Sans', sans-serif", fontSize: 13, color: "#9CA3AF",
    padding: "7px 0", borderBottom: "1px solid #1F2937",
  },
  loadingBox: {
    display: "flex", alignItems: "center", gap: 12,
    background: "rgba(245,158,11,0.05)", border: "1px solid rgba(245,158,11,0.2)",
    borderRadius: 10, padding: "20px 24px", marginTop: 24,
  },
  spinner: {
    width: 20, height: 20,
    border: "2px solid #374151", borderTop: "2px solid #F59E0B",
    borderRadius: "50%", animation: "spin 0.8s linear infinite",
    flexShrink: 0,
  },
  kpi: {
    background: "#0D1117", border: "1px solid #21262D",
    borderRadius: 10, padding: "14px 16px",
  },
  kpiLabel: {
    fontFamily: "'IBM Plex Mono', monospace",
    fontSize: 10, color: "#4B5563", letterSpacing: 1.5,
    textTransform: "uppercase", marginBottom: 8,
  },
  kpiVal: {
    fontFamily: "'IBM Plex Mono', monospace",
    fontSize: 16, fontWeight: 700,
  },
  kpiSub: {
    fontFamily: "'IBM Plex Mono', monospace",
    fontSize: 10, color: "#374151", marginTop: 4,
  },
  graficoBox: {
    background: "#0D1117", border: "1px solid #21262D",
    borderRadius: 10, padding: "16px 20px",
  },
  legendaItem: {
    fontFamily: "'IBM Plex Mono', monospace",
    fontSize: 10, color: "#6B7280",
    display: "flex", alignItems: "center", gap: 4,
  },
  legendaDot: {
    display: "inline-block", width: 10, height: 10, borderRadius: 2,
  },
  th: {
    fontFamily: "'IBM Plex Mono', monospace",
    fontSize: 9, color: "#4B5563", letterSpacing: 1.5,
    textTransform: "uppercase", textAlign: "left",
    padding: "8px 8px 12px", borderBottom: "1px solid #21262D",
  },
  td: {
    fontFamily: "'IBM Plex Mono', monospace",
    fontSize: 12, color: "#9CA3AF",
    padding: "10px 8px", borderBottom: "1px solid #1A1F26",
  },
  badge: {
    display: "inline-block", borderRadius: 4,
    padding: "3px 8px", fontSize: 10,
    fontFamily: "'IBM Plex Mono', monospace",
  },
  legendaStatus: {
    marginTop: 12, padding: "10px 0",
    borderTop: "1px solid #1A1F26", textAlign: "center",
  },
};
