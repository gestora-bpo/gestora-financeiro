import { useState } from "react";

const ANOS    = ["2024", "2025", "2026", "2027"];
const M_CURTO = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];
const M_LONGO = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];

const STEPS       = ["periodo", "omie", "cashflow"];
const STEP_LABELS = { periodo: "Período", omie: "Dados Omie", cashflow: "Cashflow" };

// ════════════════════════════════════════════════════════════
//  OMIE API
// ════════════════════════════════════════════════════════════

async function omieCall(omieEndpoint, call, params) {
  const res = await fetch("/api/omie", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ omieEndpoint, call, params }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `Erro ${res.status}`);
  }
  return res.json();
}

// ════════════════════════════════════════════════════════════
//  HELPERS
// ════════════════════════════════════════════════════════════

const brl = (v) =>
  "R$ " + Math.abs(v).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// ════════════════════════════════════════════════════════════
//  STEP INDICATOR
// ════════════════════════════════════════════════════════════

function StepIndicator({ current }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 0, marginBottom: 36 }}>
      {STEPS.map((step, i) => {
        const idx      = STEPS.indexOf(current);
        const stepIdx  = STEPS.indexOf(step);
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
                fontWeight: isActive ? 700 : 400, letterSpacing: 1, textTransform: "uppercase",
              }}>
                {STEP_LABELS[step]}
              </span>
            </div>
            {i < STEPS.length - 1 && (
              <div style={{ flex: 1, height: 2, margin: "0 4px", marginBottom: 20,
                background: stepIdx < idx ? "#1B6B7B" : "#1F2937" }} />
            )}
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
          {ANOS.map((a) => (
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

// ════════════════════════════════════════════════════════════
//  STEP 2: DIAGNÓSTICO OMIE
// ════════════════════════════════════════════════════════════

function StepOmie({ ano, onNext, onBack }) {
  const [status,   setStatus]   = useState("idle");
  const [msg,      setMsg]      = useState("");
  const [erro,     setErro]     = useState("");
  const [diagData, setDiagData] = useState(null);

  const diagnostico = async () => {
    setStatus("loading");
    setErro("");
    setDiagData(null);
    setMsg("Buscando 1 registro de teste...");
    try {
      const resp = await omieCall(
        "/financas/contareceber/", "ListarContasReceber",
        { filtrar_por_data_de: `01/01/${ano}`, filtrar_por_data_ate: `31/12/${ano}`,
          filtrar_por_tipo_data: "VENCIMENTO", pagina: 1, registros_por_pagina: 1 }
      );
      const item = resp.conta_receber_cadastro?.[0];
      setDiagData(item || { aviso: "Nenhum registro retornado", resp });
      setStatus("diag");
    } catch (e) {
      setErro(e.message);
      setStatus("error");
    }
  };

  return (
    <div>
      <h2 style={S.stepTitle}>Dados do Omie</h2>
      <p style={S.stepDesc}>
        Buscar lançamentos de{" "}
        <strong style={{ color: "#1B6B7B" }}>Janeiro a Dezembro/{ano}</strong>
      </p>

      {status === "idle" && (
        <>
          <div style={{ ...S.infoBox, marginTop: 24 }}>
            <div style={S.infoRow}><span>Período</span><span>01/01/{ano} — 31/12/{ano}</span></div>
            <div style={S.infoRow}><span>Contas</span><span>PJ (Gestora) + PF (Sócios)</span></div>
            <div style={{ ...S.infoRow, borderBottom: "none" }}><span>Modo</span><span style={{ color: "#F59E0B" }}>Diagnóstico — 1 registro</span></div>
          </div>
          <div style={{ display: "flex", gap: 12, marginTop: 24 }}>
            <button onClick={onBack} style={S.btnSecondary}>← Voltar</button>
            <button onClick={diagnostico} style={S.btn}>Buscar no Omie</button>
          </div>
        </>
      )}

      {status === "loading" && (
        <div style={S.loadingBox}>
          <div style={S.spinner} />
          <span style={{ color: "#F59E0B", fontFamily: "'IBM Plex Mono', monospace", fontSize: 13 }}>{msg}</span>
        </div>
      )}

      {status === "diag" && diagData && (
        <div style={{ marginTop: 20 }}>
          <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, color: "#10B981", marginBottom: 8 }}>
            ✅ Registro recebido — campos disponíveis:
          </div>
          <div style={{
            background: "#0D1117", border: "1px solid #21262D", borderRadius: 8,
            padding: 16, maxHeight: 400, overflowY: "auto",
            fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, color: "#9CA3AF",
            whiteSpace: "pre-wrap", lineHeight: 1.8,
          }}>
            {JSON.stringify(diagData, null, 2)}
          </div>
          <div style={{ display: "flex", gap: 12, marginTop: 16 }}>
            <button onClick={onBack} style={S.btnSecondary}>← Voltar</button>
          </div>
        </div>
      )}

      {status === "error" && (
        <>
          <div style={{ ...S.loadingBox, borderColor: "rgba(239,68,68,0.3)", background: "rgba(239,68,68,0.05)", marginTop: 24 }}>
            <span style={{ fontSize: 20 }}>❌</span>
            <div>
              <div style={{ color: "#EF4444", fontFamily: "'IBM Plex Mono', monospace", fontSize: 13 }}>Erro</div>
              <div style={{ color: "#6B7280", fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, marginTop: 4 }}>{erro}</div>
            </div>
          </div>
          <div style={{ display: "flex", gap: 12, marginTop: 20 }}>
            <button onClick={onBack} style={S.btnSecondary}>← Voltar</button>
            <button onClick={diagnostico} style={S.btn}>Tentar novamente</button>
          </div>
        </>
      )}
    </div>
  );
}

// ════════════════════════════════════════════════════════════
//  APP PRINCIPAL
// ════════════════════════════════════════════════════════════

export default function GestoraFinanceiro() {
  const [step, setStep] = useState("periodo");
  const [ano,  setAno]  = useState(null);

  return (
    <div style={S.root}>
      <div style={S.header}>
        <div style={S.logo}>GESTORA</div>
        <div style={S.headerSub}>Financeiro</div>
      </div>
      <div style={{ ...S.card, maxWidth: 560 }}>
        <StepIndicator current={step} />
        {step === "periodo" && <StepPeriodo onNext={(a) => { setAno(a); setStep("omie"); }} />}
        {step === "omie"    && <StepOmie ano={ano} onNext={() => {}} onBack={() => setStep("periodo")} />}
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════
//  ESTILOS
// ════════════════════════════════════════════════════════════

const S = {
  root:         { minHeight: "100vh", background: "#0D1117", display: "flex", flexDirection: "column", alignItems: "center", padding: "32px 16px 64px", fontFamily: "'IBM Plex Sans', sans-serif" },
  header:       { display: "flex", flexDirection: "column", alignItems: "center", marginBottom: 32, gap: 4 },
  logo:         { fontFamily: "'IBM Plex Mono', monospace", fontSize: 28, fontWeight: 700, color: "#1B6B7B", letterSpacing: 6 },
  headerSub:    { fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, color: "#4B5563", letterSpacing: 3, textTransform: "uppercase" },
  card:         { background: "#161B22", border: "1px solid #21262D", borderRadius: 16, padding: 32, width: "100%" },
  stepTitle:    { fontFamily: "'IBM Plex Sans', sans-serif", fontSize: 20, fontWeight: 700, color: "#F9FAFB", margin: 0 },
  stepDesc:     { fontFamily: "'IBM Plex Sans', sans-serif", fontSize: 14, color: "#6B7280", marginTop: 8, marginBottom: 0 },
  label:        { display: "block", fontFamily: "'IBM Plex Mono', monospace", fontSize: 10, color: "#4B5563", letterSpacing: 2, textTransform: "uppercase", marginBottom: 4 },
  btn:          { background: "#1B6B7B", color: "#fff", border: "none", borderRadius: 8, padding: "12px 24px", fontFamily: "'IBM Plex Mono', monospace", fontSize: 13, fontWeight: 600, cursor: "pointer", letterSpacing: 1 },
  btnSecondary: { background: "transparent", color: "#6B7280", border: "1px solid #374151", borderRadius: 8, padding: "12px 20px", fontFamily: "'IBM Plex Mono', monospace", fontSize: 13, cursor: "pointer", letterSpacing: 1 },
  anoBtn:       { border: "1px solid", borderRadius: 8, padding: "10px 20px", fontFamily: "'IBM Plex Mono', monospace", fontSize: 14, fontWeight: 600, cursor: "pointer", transition: "all 0.2s" },
  infoBox:      { background: "#0D1117", border: "1px solid #21262D", borderRadius: 10, padding: "16px 20px" },
  infoRow:      { display: "flex", justifyContent: "space-between", fontFamily: "'IBM Plex Sans', sans-serif", fontSize: 13, color: "#9CA3AF", padding: "7px 0", borderBottom: "1px solid #1F2937" },
  loadingBox:   { display: "flex", alignItems: "center", gap: 12, background: "rgba(245,158,11,0.05)", border: "1px solid rgba(245,158,11,0.2)", borderRadius: 10, padding: "20px 24px", marginTop: 24 },
  spinner:      { width: 20, height: 20, border: "2px solid #374151", borderTop: "2px solid #F59E0B", borderRadius: "50%", animation: "spin 0.8s linear infinite", flexShrink: 0 },
};
