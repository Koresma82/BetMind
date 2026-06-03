import { useState, useRef, useEffect } from 'react';
import { useAuth } from '../App';
import { callFast, startDeep, discoverCategories } from '../lib/api';
import { getDeepAnalysis, saveLastAnalysis, getLastAnalysis, getConfig, getAllBets, computeStats, placeBet } from '../lib/db';
import BetModal from '../components/BetModal';

const today    = new Date().toLocaleDateString('pt-PT',{weekday:'long',day:'numeric',month:'long',year:'numeric'});
const todayISO = new Date().toISOString().split('T')[0];

const SIG_C  = { FORTE:'#00e676', MODERADO:'#ffd740', FRACO:'#ff6d00', EVITAR:'#ff1744' };
const RSK_C  = { BAIXO:'#00e676', MEDIO:'#ffd740', ALTO:'#ff6d00', 'MUITO ALTO':'#ff1744' };

const SPORT_ICON = {
  'Futebol':'⚽','Ténis':'🎾','Basquetebol':'🏀','Andebol':'🤾',
  'Hóquei em Gelo':'🏒','Rugby':'🏉','Voleibol':'🏐','Basebol':'⚾',
  'MMA/Boxe':'🥊','Ciclismo':'🚴','Fórmula 1':'🏎️','Outro':'🎯'
};

const SYSTEM_ANALISE = `És um analista desportivo que devolve SEMPRE e APENAS um objeto JSON válido, em português.

REGRAS ABSOLUTAS:
- NUNCA respondas com texto de desculpa, avisos, ou explicações fora do JSON.
- NUNCA digas que "não conseguiste obter informação". Se a pesquisa for limitada, trabalha com os jogos AGENDADOS/PROVÁVEIS que conheces para a data e regiões pedidas, e reflete a incerteza baixando o campo "confianca" e subindo o "risco_geral".
- A tua resposta TEM de começar por "{" e terminar por "}". Sem markdown, sem \`\`\`.
- É melhor dares estimativas honestas com confiança moderada (40-65) do que recusares. As odds podem ser aproximadas.
- Inclui sempre pelo menos 6 eventos. Ordena por confianca_maxima decrescente.`;

// Extrai um objeto JSON de texto livre, mesmo com prosa à volta.
// Procura o primeiro '{' e faz contagem de chavetas para achar o '}' correspondente.
function extractJSON(txt) {
  if (!txt) return null;
  // 1) Bloco ```json ... ```
  let m = txt.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (m) { try { return JSON.parse(m[1].trim()); } catch {} }
  // 2) Varre o texto e equilibra chavetas (ignora chavetas dentro de strings)
  const start = txt.indexOf('{');
  if (start === -1) return null;
  let depth = 0, inStr = false, esc = false;
  for (let i = start; i < txt.length; i++) {
    const c = txt[i];
    if (esc) { esc = false; continue; }
    if (c === '\\') { esc = true; continue; }
    if (c === '"') inStr = !inStr;
    if (inStr) continue;
    if (c === '{') depth++;
    else if (c === '}') { depth--; if (depth === 0) {
      const candidate = txt.slice(start, i + 1);
      try { return JSON.parse(candidate); } catch { return null; }
    }}
  }
  return null; // chavetas não fecharam → resposta cortada
}

// Extrai o resultado JSON da resposta crua da Anthropic (com diagnóstico claro no erro).
function parseAIResult(raw) {
  const txt = (raw.content||[]).filter(b=>b.type==='text').map(b=>b.text).join('\n');
  const parsed = txt.trim() ? extractJSON(txt) : null;
  if (!parsed) {
    const preview = (txt||'').trim().slice(0, 220).replace(/\s+/g, ' ');
    const cut = raw.stop_reason === 'max_tokens' ? ' A resposta foi cortada (limite de tokens).' : '';
    throw new Error(`A IA não devolveu dados utilizáveis.${cut} Começou por: "${preview || '(vazio)'}…" — tenta novamente.`);
  }
  return parsed;
}

// Calcula confiança máxima de um jogo (melhor mercado)
const bestConf = j => Math.max(...(j.mercados||[]).map(m=>m.confianca||0), 0);

export default function AnalisePage() {
  const user = useAuth();
  const [tab, setTab]     = useState('dia');
  const [loading, setLoading] = useState(false);
  const [logs, setLogs]   = useState([]);
  const [result, setResult] = useState(null);
  const [liga, setLiga]   = useState(null);
  const [err, setErr]     = useState('');
  const [filterSport, setFilterSport] = useState('');
  const [deepStatus, setDeepStatus] = useState(null); // null | 'running' | 'done' | 'error'
  const [bookmakers, setBookmakers] = useState([]);
  const [betModal, setBetModal] = useState(null); // { jogo, market } | null
  const [betToast, setBetToast] = useState('');
  const [cats, setCats] = useState(null);        // categorias descobertas | null
  const [selCats, setSelCats] = useState([]);    // modalidades escolhidas
  const [discovering, setDiscovering] = useState(false);
  const pollRef = useRef(null);

  // Carrega casas de apostas com saldo calculado (para o modal e dropdown)
  const loadBookmakers = async () => {
    try {
      const [cfg, bets] = await Promise.all([getConfig(user.uid), getAllBets(user.uid)]);
      const stats = computeStats(bets, cfg.bookmakers || []);
      setBookmakers(stats.byBookmaker.length ? stats.byBookmaker : (cfg.bookmakers || []));
    } catch (e) { /* sem casas ainda */ }
  };

  const openBet = (jogo, market) => setBetModal({ jogo, market });
  // Aposta numa múltipla: empacota as seleções como um único "jogo/mercado" para o modal.
  const openMultiBet = (tipo, m) => {
    const nomes = (m.selecoes||[]).map(s => s.jogo).join(' + ');
    const mercadoDesc = (m.selecoes||[]).map(s => `${s.jogo}: ${s.mercado}`).join(' | ');
    setBetModal({
      jogo: { casa: `Múltipla ${tipo}`, fora: `${(m.selecoes||[]).length} seleções`, competicao: nomes, modalidade: 'Múltipla' },
      market: { mercado: mercadoDesc, odd: m.odd_combinada, confianca: m.confianca_conjunto, sinal: tipo.toUpperCase() }
    });
  };
  const confirmBet = async (bet) => {
    await placeBet(user.uid, bet);
    await loadBookmakers();
    setBetToast(`Aposta registada: ${bet.amount}€ @ ${bet.odd} em ${bet.match}`);
    setTimeout(() => setBetToast(''), 4000);
  };

  const addLog = m => setLogs(p => [...p.slice(-12), m]);

  // Constrói o prompt da análise. mode 'fast' = conciso; foca nas modalidades escolhidas.
  const buildDayPrompt = () => {
    const foco = selCats.length
      ? `Foca-te APENAS nestas modalidades escolhidas: ${selCats.join(', ')}.`
      : '';
    const modalidadesDefault = selCats.length ? '' : `Modalidades: Futebol (Liga Portugal, Premier, La Liga, Serie A, Bundesliga, Ligue 1, Champions/Europa/Conference), Ténis (ATP/WTA), Basquetebol (NBA/Euroliga), Andebol, Hóquei (NHL/KHL), Rugby, MMA/Boxe.`;
    // Quando há 2+ modalidades, pedimos também 2 apostas múltiplas (segura + arrojada)
    const multiplas = selCats.length >= 2 ? `

Como há várias modalidades, cria também DUAS apostas MÚLTIPLAS (acumuladores), cada uma com 2-4 seleções de jogos DIFERENTES:
- "segura": só seleções de confiança alta (≥70%), odd combinada mais baixa mas mais provável.
- "arrojada": seleções de odd mais alta / confiança média, maior risco e maior retorno.
Para cada múltipla calcula a odd combinada (multiplicação das odds) e uma confiança honesta do conjunto.` : '';
    const multiplasSchema = selCats.length >= 2 ? `,
  "multiplas": {
    "segura": {
      "selecoes": [{"jogo": "Benfica vs Porto", "mercado": "Mais de 1.5 Golos", "odd": "1.30", "confianca": 80}],
      "odd_combinada": "1.69", "confianca_conjunto": 72, "racional": "porquê é sólida"
    },
    "arrojada": {
      "selecoes": [{"jogo": "X vs Y", "mercado": "Vitória X", "odd": "2.10", "confianca": 58}],
      "odd_combinada": "4.40", "confianca_conjunto": 45, "racional": "porquê vale o risco"
    }
  }` : '';
    return `
Hoje é ${today} (${todayISO}).

${foco}

Lista os jogos e eventos desportivos AGENDADOS para hoje (ou os mais prováveis). Usa pesquisa web para confirmar calendário, lesões e forma; quando a informação for incompleta, usa o teu conhecimento dos calendários e equipas e baixa a confiança (NÃO recuses).

Cobre o MÁXIMO de eventos possível (idealmente 12-20) com análise detalhada por evento, vários mercados cada.
${modalidadesDefault}${multiplas}

Para cada evento analisa o que conseguires: lesionados/ausentes, forma recente, H2H, fadiga, contexto, e odds reais aproximadas. Calcula confiança honesta 0-100 por mercado.

Responde APENAS com JSON válido, sem markdown:
{
  "resumo_dia": "frase a resumir o dia e as melhores oportunidades",
  "melhor_aposta_dia": "a aposta com mais confiança de toda a lista",
  "jogos": [
    {
      "id": "jogo1", "modalidade": "Futebol", "casa": "Benfica", "fora": "Porto",
      "competicao": "Liga Portugal", "hora": "20:30", "confianca_maxima": 78,
      "risco_geral": "BAIXO|MEDIO|ALTO|MUITO ALTO", "aposta_destaque": "Mais de 2.5 Golos @1.85",
      "alerta_fadiga": false, "probabilidades": {"casa": 45, "empate": 28, "fora": 27},
      "contexto": "2-3 frases: H2H, forma, contexto, fadiga",
      "lesionados_casa": [], "lesionados_fora": [], "castigados_casa": [], "castigados_fora": [],
      "mercados": [{"mercado": "Mais de 2.5 Golos", "descricao": "justificação", "sinal": "FORTE", "confianca": 78, "odd": "1.85"}],
      "alerta": null
    }
  ]${multiplasSchema}
}
Ordena os jogos por confianca_maxima DECRESCENTE. Devolve APENAS o JSON.`;
  };

  /* ── Passo 1: descobrir que modalidades há hoje ── */
  const descobrir = async () => {
    setDiscovering(true); setErr(''); setCats(null); setSelCats([]);
    try {
      const raw = await discoverCategories();
      const txt = (raw.content||[]).filter(b=>b.type==='text').map(b=>b.text).join('\n');
      const parsed = extractJSON(txt);
      if (!parsed || !parsed.categorias) throw new Error('Não consegui obter as modalidades de hoje.');
      setCats(parsed.categorias);
      setSelCats(parsed.categorias.slice(0, 3).map(c => c.modalidade)); // pré-seleciona as 3 primeiras
    } catch (e) { setErr(e.message); }
    setDiscovering(false);
  };

  const toggleCat = (mod) => setSelCats(prev => prev.includes(mod) ? prev.filter(m=>m!==mod) : [...prev, mod]);

  /* ── Análise RÁPIDA (top picks, cabe nos 10s) ── */
  /* ── Análise PROFUNDA (background no servidor + polling) ── */
  const analisarProfundo = async () => {
    setErr(''); setDeepStatus('running'); addLog('Análise profunda iniciada no servidor (pode demorar 1-3 min)…');
    try {
      await startDeep(todayISO, buildDayPrompt(), SYSTEM_ANALISE);
      // Polling ao Firestore a cada 6s
      let tries = 0;
      pollRef.current = setInterval(async () => {
        tries++;
        try {
          const doc = await getDeepAnalysis(user.uid, todayISO);
          if (doc?.status === 'done' && doc.result) {
            clearInterval(pollRef.current);
            const data = doc.result;
            if (data.jogos) data.jogos.sort((a,b) => (b.confianca_maxima||bestConf(b)) - (a.confianca_maxima||bestConf(a)));
            setResult(data); setDeepStatus('done');
            saveLastAnalysis(user.uid, 'dia', data).catch(() => {});
            addLog(`${data.jogos?.length||0} eventos (profunda) ✓`);
          } else if (doc?.status === 'error') {
            clearInterval(pollRef.current);
            setDeepStatus('error'); setErr('Análise profunda falhou: ' + (doc.error || 'erro desconhecido'));
          } else {
            addLog(`A processar no servidor… (${tries*6}s)`);
          }
        } catch (e) { /* continua a tentar */ }
        if (tries > 50) { clearInterval(pollRef.current); setDeepStatus('error'); setErr('Tempo esgotado à espera do servidor.'); }
      }, 6000);
    } catch(e) { setDeepStatus('error'); setErr(e.message); }
  };

  // Ao abrir a página, recarrega a última análise guardada (sobrevive a mudar de tab).
  useEffect(() => {
    let active = true;
    loadBookmakers();
    (async () => {
      try {
        const [dia, ligaSaved] = await Promise.all([
          getLastAnalysis(user.uid, 'dia'),
          getLastAnalysis(user.uid, 'liga')
        ]);
        if (!active) return;
        if (dia?.data) setResult(dia.data);
        if (ligaSaved?.data) setLiga(ligaSaved.data);
      } catch (e) { /* sem análise guardada ainda */ }
    })();
    return () => { active = false; if (pollRef.current) clearInterval(pollRef.current); };
  }, []);

  /* ── Liga Portugal ── */
  const carregarLiga = async () => {
    setLoading(true); setLiga(null); setErr(''); setLogs([]);
    try {
      addLog('A pesquisar Liga Portugal…');
      const raw = await callFast(`
Hoje é ${today} (${todayISO}).
Pesquisa informação atual da Liga Portugal Betclic (1ª Liga portuguesa).
Procura: castigados próxima jornada, lesionados atuais, top 15 marcadores, top 10 assistentes, classificação atual.
Para Liga Record: 6 jogadores com melhor custo-benefício (forma + minutos + importância).
Responde APENAS com JSON válido:
{
  "jornada_atual":32,"epoca":"2024/25",
  "castigados":[{"jogador":"Nome","equipa":"Benfica","motivo":"Acumulação de amarelos","disponivel_em":"DD/MM"}],
  "lesionados":[{"jogador":"Nome","equipa":"Porto","lesao":"Muscular","estado":"Ausente","retorno_previsto":"DD/MM"}],
  "marcadores":[{"pos":1,"jogador":"Nome","equipa":"Benfica","golos":18,"jogos":28,"media":0.64}],
  "assistentes":[{"pos":1,"jogador":"Nome","equipa":"Sporting","assistencias":10,"jogos":28}],
  "classificacao":[{"pos":1,"equipa":"Sporting","pontos":72,"jogos":30,"vitorias":22,"empates":6,"derrotas":2,"gm":58,"gs":18,"media_pts":2.4}],
  "liga_record_destaques":[{"jogador":"Nome","equipa":"Benfica","posicao":"AV","preco_estimado":"9M","forma":"⭐⭐⭐⭐⭐","motivo":"5 golos nos últimos 4 jogos"}]
}`, 'És um analista da Liga Portugal que devolve SEMPRE e APENAS JSON válido em português, a começar por "{" e a terminar por "}". NUNCA respondas com texto de desculpa. Se a pesquisa for limitada, usa o teu conhecimento da época e dos plantéis e preenche o JSON na mesma.', { maxTokens: 4000, maxSearches: 2 });
      const ligaData = parseAIResult(raw);
      setLiga(ligaData);
      saveLastAnalysis(user.uid, 'liga', ligaData).catch(() => {});
    } catch(e) { setErr(e.message); }
    setLoading(false);
  };

  /* ── Filtros ── */
  const sports = result ? [...new Set((result.jogos||[]).map(j=>j.modalidade))] : [];
  const jogosFiltered = result
    ? (result.jogos||[]).filter(j => !filterSport || j.modalidade===filterSport)
    : [];

  return (
    <div>
      <h2 style={{ fontSize:22, fontWeight:600, color:'#e8ecf0', marginBottom:4 }}>Análise IA</h2>
      <div style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:10, color:'#3a4255', marginBottom:16 }}>{today.toUpperCase()}</div>

      {/* Tabs */}
      <div style={{ display:'flex', gap:4, marginBottom:14, background:'rgba(255,255,255,0.03)', borderRadius:8, padding:4 }}>
        {[['dia','🎯 Apostas do Dia'],['liga','🇵🇹 Liga Portugal']].map(([k,l])=>(
          <button key={k} onClick={()=>{ setTab(k); setErr(''); setFilterSport(''); }} style={{
            flex:1, padding:'8px 0', borderRadius:6, border:'none', cursor:'pointer',
            background:tab===k?'rgba(0,230,118,0.1)':'transparent',
            color:tab===k?'#00e676':'#4a5568',
            fontFamily:"'IBM Plex Mono',monospace", fontSize:11,
            border:tab===k?'1px solid rgba(0,230,118,0.3)':'1px solid transparent'
          }}>{l}</button>
        ))}
      </div>

      {/* Buttons */}
      {tab==='dia' ? (
        <div style={{ display:'flex', flexDirection:'column', gap:8, marginBottom:14 }}>
          {/* Passo 1: descobrir modalidades */}
          <button onClick={descobrir} disabled={discovering||loading||deepStatus==='running'} style={{
            width:'100%', padding:'11px',
            background:'rgba(176,125,255,0.07)', border:'1px solid rgba(176,125,255,0.35)',
            borderRadius:10, color:'#b07dff', cursor:(discovering||loading)?'default':'pointer',
            fontFamily:"'IBM Plex Mono',monospace", fontSize:12, letterSpacing:1,
            display:'flex', alignItems:'center', justifyContent:'center', gap:10
          }}>
            {discovering ? <><Spinner/>A VER MODALIDADES...</> : '🔎 VER MODALIDADES DE HOJE'}
          </button>

          {/* Chips de modalidades descobertas */}
          {cats && (
            <div style={{ background:'rgba(255,255,255,0.025)', border:'1px solid rgba(255,255,255,0.06)', borderRadius:10, padding:12 }}>
              <div style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:9, color:'#5d6b7f', letterSpacing:1.5, marginBottom:10 }}>ESCOLHE 1-3 MODALIDADES E ANALISA</div>
              <div style={{ display:'flex', flexWrap:'wrap', gap:7 }}>
                {cats.map(c => {
                  const sel = selCats.includes(c.modalidade);
                  return (
                    <button key={c.modalidade} onClick={()=>toggleCat(c.modalidade)} style={{
                      background: sel?'rgba(0,230,118,0.15)':'rgba(255,255,255,0.03)',
                      border: sel?'1px solid rgba(0,230,118,0.45)':'1px solid rgba(255,255,255,0.1)',
                      borderRadius:20, padding:'7px 13px', color: sel?'#00e676':'#9aa7b8', cursor:'pointer',
                      fontFamily:"'IBM Plex Mono',monospace", fontSize:11, fontWeight:600, transition:'all .14s'
                    }}>
                      {sel?'✓ ':''}{SPORT_ICON[c.modalidade]||'🎯'} {c.modalidade} <span style={{ color:'#5d6b7f' }}>({c.eventos})</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Passo 2: analisar (profunda) */}
          <button onClick={analisarProfundo} disabled={loading||deepStatus==='running'} style={{
            width:'100%', padding:'14px',
            background:'rgba(77,141,255,0.08)', border:'1px solid rgba(77,141,255,0.4)',
            borderRadius:10, color:'#4d8dff', cursor:(loading||deepStatus==='running')?'default':'pointer',
            fontFamily:"'IBM Plex Mono',monospace", fontSize:13, letterSpacing:1,
            display:'flex', alignItems:'center', justifyContent:'center', gap:10
          }}>
            {deepStatus==='running' ? <><Spinner/>A PROCESSAR NO SERVIDOR...</> : `🔍 ANALISAR${selCats.length?` (${selCats.length} modalidade${selCats.length>1?'s':''})`:''}`}
          </button>
          <div style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:9.5, color:'#3a4456', textAlign:'center', lineHeight:1.5 }}>
            A análise corre no servidor (1-3 min) e pesquisa dados reais.{selCats.length>1?' Com várias modalidades, inclui uma aposta múltipla.':''}
          </div>
        </div>
      ) : (
        <button onClick={carregarLiga} disabled={loading} style={{
          width:'100%', padding:'12px', marginBottom:14,
          background:'rgba(0,230,118,0.07)', border:'1px solid rgba(0,230,118,0.35)',
          borderRadius:10, color:'#00e676', cursor:loading?'default':'pointer',
          fontFamily:"'IBM Plex Mono',monospace", fontSize:12, letterSpacing:2,
          display:'flex', alignItems:'center', justifyContent:'center', gap:10
        }}>
          {loading ? <><Spinner/>A PESQUISAR...</> : '◈ ATUALIZAR LIGA PORTUGAL'}
        </button>
      )}

      {/* Logs */}
      {logs.length>0 && (
        <div style={{ background:'#060810', border:'1px solid rgba(0,230,118,0.1)', borderRadius:8, padding:'10px 14px', marginBottom:14 }}>
          {logs.map((l,i)=><div key={i} style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:11, color:'#00e676', lineHeight:1.8 }}>&gt; {l}</div>)}
          {loading && <div style={{ color:'#00e676', animation:'pulse 1s infinite' }}>█</div>}
        </div>
      )}

      {err && <div style={{ background:'rgba(255,23,68,0.08)', border:'1px solid rgba(255,23,68,0.3)', borderRadius:8, padding:12, color:'#ff1744', fontFamily:"'IBM Plex Mono',monospace", fontSize:12, marginBottom:14 }}>{err}</div>}

      {/* DIA results */}
      {tab==='dia' && result && (
        <div>
          {/* Resumo + Melhor Aposta */}
          {(result.resumo_dia||result.melhor_aposta_dia) && (
            <div style={{ marginBottom:14 }}>
              {result.melhor_aposta_dia && (
                <div style={{ background:'rgba(0,230,118,0.06)', border:'1px solid rgba(0,230,118,0.25)', borderRadius:10, padding:'11px 14px', marginBottom:8, display:'flex', gap:10, alignItems:'flex-start' }}>
                  <span style={{ fontSize:18 }}>🏆</span>
                  <div>
                    <div style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:9, color:'#00e676', letterSpacing:2, marginBottom:3 }}>MELHOR APOSTA DO DIA</div>
                    <div style={{ fontSize:13, color:'#e8ecf0', lineHeight:1.5 }}>{result.melhor_aposta_dia}</div>
                  </div>
                </div>
              )}
              {result.resumo_dia && (
                <div style={{ fontSize:13, color:'#6b7280', lineHeight:1.6, padding:'8px 12px', background:'rgba(255,255,255,0.02)', borderRadius:8 }}>📊 {result.resumo_dia}</div>
              )}
            </div>
          )}

          {/* Apostas múltiplas (quando há várias modalidades) */}
          {result.multiplas && (
            <div style={{ marginBottom:14 }}>
              <div style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:10, color:'#3a4255', letterSpacing:1.5, marginBottom:8 }}>🎰 APOSTAS MÚLTIPLAS SUGERIDAS</div>
              {result.multiplas.segura && <MultiplaCard tipo="segura" m={result.multiplas.segura} onBet={openMultiBet} />}
              {result.multiplas.arrojada && <MultiplaCard tipo="arrojada" m={result.multiplas.arrojada} onBet={openMultiBet} />}
            </div>
          )}

          {/* Sport filter pills */}
          {sports.length > 1 && (
            <div style={{ display:'flex', gap:6, flexWrap:'wrap', marginBottom:12 }}>
              <button onClick={()=>setFilterSport('')} style={pill(!filterSport)}>Todas ({(result.jogos||[]).length})</button>
              {sports.map(s=>(
                <button key={s} onClick={()=>setFilterSport(s)} style={pill(filterSport===s)}>
                  {SPORT_ICON[s]||'🎯'} {s} ({(result.jogos||[]).filter(j=>j.modalidade===s).length})
                </button>
              ))}
            </div>
          )}

          <div style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:10, color:'#3a4255', marginBottom:10 }}>
            {jogosFiltered.length} EVENTOS · ORDENADOS POR CONFIANÇA ↓
          </div>

          {jogosFiltered.map((j,i)=><MatchCard key={j.id||i} m={j} rank={i+1} onBet={openBet}/>)}
        </div>
      )}

      {/* LIGA results */}
      {tab==='liga' && liga && <LigaView data={liga}/>}

      {!loading && !result && !liga && !err && (
        <div style={{ textAlign:'center', padding:40, color:'#3a4255', fontFamily:"'IBM Plex Mono',monospace", fontSize:12 }}>
          Clica para carregar eventos de hoje em todas as modalidades
        </div>
      )}

      <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:.3}} @keyframes spin{to{transform:rotate(360deg)}} @keyframes slideUp{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}} @keyframes fadeIn{from{opacity:0}to{opacity:1}}`}</style>

      <BetModal
        open={!!betModal}
        suggestion={betModal}
        bookmakers={bookmakers}
        onClose={()=>setBetModal(null)}
        onConfirm={confirmBet}
      />

      {betToast && (
        <div style={{
          position:'fixed', bottom:90, left:'50%', transform:'translateX(-50%)', zIndex:1100,
          background:'linear-gradient(135deg, rgba(0,229,138,0.95), rgba(0,181,110,0.95))',
          color:'#06120c', padding:'12px 20px', borderRadius:12, fontFamily:"'JetBrains Mono',monospace",
          fontSize:12, fontWeight:600, boxShadow:'0 8px 32px rgba(0,229,138,0.4)', maxWidth:'90%', textAlign:'center'
        }}>✓ {betToast}</div>
      )}
    </div>
  );
}

/* ── Match Card ─────────────────────────────── */
function MultiplaCard({ tipo, m, onBet }) {
  const isSegura = tipo === 'segura';
  const cor = isSegura ? '#00e676' : '#ff8a4d';
  const conf = m.confianca_conjunto || 0;
  return (
    <div style={{
      background:'rgba(255,255,255,0.025)', border:`1px solid ${cor}33`,
      borderLeft:`3px solid ${cor}`, borderRadius:10, padding:14, marginBottom:8
    }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:10 }}>
        <div>
          <div style={{ display:'flex', alignItems:'center', gap:7 }}>
            <span style={{ fontSize:14 }}>{isSegura?'🛡️':'🚀'}</span>
            <span style={{ fontSize:14, fontWeight:600, color:'#e8ecf0' }}>Múltipla {isSegura?'Segura':'Arrojada'}</span>
          </div>
          <div style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:10, color:'#5d6b7f', marginTop:3 }}>
            {(m.selecoes||[]).length} seleções · confiança {conf}%
          </div>
        </div>
        <div style={{ textAlign:'right' }}>
          <div style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:18, fontWeight:700, color:cor }}>@{m.odd_combinada}</div>
          <div style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:9, color:'#5d6b7f' }}>ODD COMBINADA</div>
        </div>
      </div>
      <div style={{ marginBottom:10 }}>
        {(m.selecoes||[]).map((s,i)=>(
          <div key={i} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'5px 0', borderBottom:i<(m.selecoes.length-1)?'1px solid rgba(255,255,255,0.04)':'none' }}>
            <div style={{ flex:1 }}>
              <div style={{ fontSize:12, color:'#e8ecf0' }}>{s.jogo}</div>
              <div style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:10, color:'#6b7280' }}>{s.mercado}</div>
            </div>
            <div style={{ display:'flex', gap:8, alignItems:'center' }}>
              <span style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:10, color:'#5d6b7f' }}>{s.confianca}%</span>
              <span style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:11, color:'#4a9eff' }}>@{s.odd}</span>
            </div>
          </div>
        ))}
      </div>
      {m.racional && <div style={{ fontSize:11.5, color:'#6b7280', lineHeight:1.5, marginBottom:10 }}>{m.racional}</div>}
      <button onClick={()=>onBet(tipo, m)} style={{
        width:'100%', background:`${cor}1a`, border:`1px solid ${cor}55`, borderRadius:8,
        padding:'9px', color:cor, cursor:'pointer', fontFamily:"'IBM Plex Mono',monospace",
        fontSize:11, fontWeight:600
      }}>💸 Apostar nesta múltipla</button>
    </div>
  );
}

function MatchCard({ m, rank, onBet }) {
  const [open, setOpen] = useState(false);
  const conf  = m.confianca_maxima || bestConf(m);
  const riskC = RSK_C[m.risco_geral]||'#8892a4';
  const confC = conf >= 70 ? '#00e676' : conf >= 55 ? '#ffd740' : '#ff6d00';
  const icon  = SPORT_ICON[m.modalidade]||'🎯';

  const sortedMercados = [...(m.mercados||[])].sort((a,b)=>(b.confianca||0)-(a.confianca||0));

  return (
    <div style={{
      background:'rgba(255,255,255,0.025)', border:'1px solid rgba(255,255,255,0.06)',
      borderLeft:`3px solid ${confC}`, borderRadius:10, marginBottom:8,
      overflow:'hidden', animation:'slideUp .3s ease forwards'
    }}>
      {/* Header */}
      <div onClick={()=>setOpen(o=>!o)} style={{ padding:'11px 14px', cursor:'pointer' }}>
        <div style={{ display:'flex', alignItems:'flex-start', gap:10 }}>

          {/* Rank + Conf */}
          <div style={{ textAlign:'center', minWidth:38 }}>
            <div style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:10, color:'#3a4255' }}>#{rank}</div>
            <div style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:16, color:confC, fontWeight:700 }}>{conf}%</div>
            <div style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:8, color:'#3a4255' }}>CONF.</div>
          </div>

          {/* Main info */}
          <div style={{ flex:1, minWidth:0 }}>
            <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:3, flexWrap:'wrap' }}>
              <span style={{ fontSize:14 }}>{icon}</span>
              <span style={{ fontSize:13, color:'#e8ecf0', fontWeight:500 }}>{m.casa} vs {m.fora}</span>
              {m.alerta_fadiga && <span title="Fadiga">⚡</span>}
            </div>
            <div style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:10, color:'#4a5568', marginBottom:5 }}>
              {m.modalidade} · {m.competicao} · {m.hora||'?'}
            </div>
            {m.aposta_destaque && (
              <div style={{ display:'inline-block', background:'rgba(255,215,64,0.1)', border:'1px solid rgba(255,215,64,0.3)', borderRadius:5, padding:'2px 8px', fontFamily:"'IBM Plex Mono',monospace", fontSize:10, color:'#ffd740' }}>
                ★ {m.aposta_destaque}
              </div>
            )}
          </div>

          {/* Right side */}
          <div style={{ display:'flex', flexDirection:'column', alignItems:'flex-end', gap:4 }}>
            <Tag label={m.risco_geral} color={riskC}/>
            <span style={{ color:'#3a4255', fontSize:14 }}>{open?'▲':'▼'}</span>
          </div>
        </div>
      </div>

      {/* Expanded */}
      {open && (
        <div style={{ padding:'0 14px 14px', borderTop:'1px solid rgba(255,255,255,0.04)' }}>

          {/* Probs */}
          {m.probabilidades && (
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:6, margin:'10px 0' }}>
              {[{l:'CASA',v:m.probabilidades.casa,c:'#4a9eff'},{l:'EMPATE',v:m.probabilidades.empate,c:'#8892a4'},{l:'FORA',v:m.probabilidades.fora,c:'#ff6b35'}].map(({l,v,c})=>v!=null&&(
                <div key={l} style={{ textAlign:'center', background:'rgba(255,255,255,0.03)', borderRadius:7, padding:'7px 0' }}>
                  <div style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:9, color:'#4a5568', marginBottom:2 }}>{l}</div>
                  <div style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:17, color:c, fontWeight:700 }}>{v}%</div>
                </div>
              ))}
            </div>
          )}

          {/* Contexto */}
          {m.contexto && <div style={{ fontSize:13, color:'#8892a4', lineHeight:1.7, marginBottom:10 }}>{m.contexto}</div>}

          {/* Flags */}
          {((m.lesionados_casa||[]).length+(m.lesionados_fora||[]).length+(m.castigados_casa||[]).length+(m.castigados_fora||[]).length) > 0 && (
            <div style={{ display:'flex', flexWrap:'wrap', gap:5, marginBottom:10 }}>
              {(m.lesionados_casa||[]).map(p=><Tag key={p} label={'🤕 '+p+' (c)'} color='#ff6d00'/>)}
              {(m.lesionados_fora||[]).map(p=><Tag key={p} label={'🤕 '+p+' (f)'} color='#ff6d00'/>)}
              {(m.castigados_casa||[]).map(p=><Tag key={p} label={'🟥 '+p+' (c)'} color='#ff1744'/>)}
              {(m.castigados_fora||[]).map(p=><Tag key={p} label={'🟥 '+p+' (f)'} color='#ff1744'/>)}
              {m.alerta_fadiga && <Tag label='⚡ Fadiga' color='#ffd740'/>}
            </div>
          )}

          {/* Mercados — ordenados por confiança */}
          <div style={{ borderTop:'1px solid rgba(255,255,255,0.04)', paddingTop:8 }}>
            <div style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:9, color:'#3a4255', letterSpacing:2, marginBottom:8 }}>MERCADOS ↓ CONFIANÇA</div>
            {sortedMercados.map((b,i)=>{
              const c = SIG_C[b.sinal]||'#8892a4';
              return (
                <div key={i} style={{ padding:'8px 0', borderBottom:'1px solid rgba(255,255,255,0.03)', display:'grid', gridTemplateColumns:'1fr auto', gap:10, alignItems:'start' }}>
                  <div>
                    <div style={{ display:'flex', alignItems:'center', gap:7, marginBottom:3, flexWrap:'wrap' }}>
                      <span style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:12, color:'#c8d0da' }}>{b.mercado}</span>
                      <Tag label={b.sinal} color={c}/>
                      <span style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:11, color:'#4a9eff' }}>@{b.odd}</span>
                    </div>
                    <div style={{ fontSize:11, color:'#5a6478', marginBottom:4 }}>{b.descricao}</div>
                    {/* Confidence bar */}
                    <div style={{ display:'flex', alignItems:'center', gap:7 }}>
                      <div style={{ flex:1, height:4, background:'rgba(255,255,255,0.06)', borderRadius:2, overflow:'hidden' }}>
                        <div style={{ width:`${b.confianca||0}%`, height:'100%', background:c, borderRadius:2, boxShadow:`0 0 6px ${c}44` }}/>
                      </div>
                      <span style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:10, color:c, minWidth:30 }}>{b.confianca||0}%</span>
                    </div>
                  </div>
                  <button onClick={()=>onBet && onBet(m, b)} style={{
                    alignSelf:'center', background:'rgba(0,230,118,0.1)', border:'1px solid rgba(0,230,118,0.4)',
                    borderRadius:7, padding:'7px 12px', color:'#00e676', cursor:'pointer',
                    fontFamily:"'IBM Plex Mono',monospace", fontSize:11, fontWeight:600, whiteSpace:'nowrap',
                    transition:'all .14s'
                  }}
                  onMouseEnter={e=>e.currentTarget.style.background='rgba(0,230,118,0.2)'}
                  onMouseLeave={e=>e.currentTarget.style.background='rgba(0,230,118,0.1)'}
                  >💸 Apostar</button>
                </div>
              );
            })}
          </div>

          {m.alerta && <div style={{ marginTop:10, background:'rgba(255,215,64,0.06)', border:'1px solid rgba(255,215,64,0.2)', borderRadius:7, padding:'8px 12px', fontSize:12, color:'#c9a227', lineHeight:1.6 }}>⚠ {m.alerta}</div>}
        </div>
      )}
    </div>
  );
}

/* ── Liga Portugal ─────────────────────────── */
function LigaView({ data }) {
  return (
    <div>
      <div style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:10, color:'#3a4255', marginBottom:14 }}>
        LIGA PORTUGAL BETCLIC · {data.epoca} · JORNADA {data.jornada_atual}
      </div>
      {data.castigados?.length>0  && <Table title="🟥 CASTIGADOS — PRÓXIMA JORNADA" rows={data.castigados}  cols={['jogador','equipa','motivo','disponivel_em']} hdrs={['Jogador','Equipa','Motivo','Disponível']}/>}
      {data.lesionados?.length>0  && <Table title="🤕 LESIONADOS ATUAIS"            rows={data.lesionados}  cols={['jogador','equipa','lesao','estado','retorno_previsto']} hdrs={['Jogador','Equipa','Lesão','Estado','Retorno']}/>}
      {data.marcadores?.length>0  && <Table title="⚽ TOP MARCADORES"               rows={data.marcadores}  cols={['pos','jogador','equipa','golos','jogos','media']} hdrs={['#','Jogador','Equipa','⚽','JJ','M/J']}/>}
      {data.assistentes?.length>0 && <Table title="🎯 TOP ASSISTENTES"              rows={data.assistentes} cols={['pos','jogador','equipa','assistencias','jogos']} hdrs={['#','Jogador','Equipa','ASS','JJ']}/>}
      {data.classificacao?.length>0 && <Table title="📊 CLASSIFICAÇÃO"              rows={data.classificacao} cols={['pos','equipa','pontos','jogos','vitorias','empates','derrotas','gm','gs','media_pts']} hdrs={['#','Equipa','PTS','JJ','V','E','D','GM','GS','M/J']}/>}
      {data.liga_record_destaques?.length>0 && (
        <div style={{ background:'rgba(255,215,64,0.04)', border:'1px solid rgba(255,215,64,0.15)', borderRadius:10, marginBottom:14 }}>
          <div style={{ padding:'10px 14px', borderBottom:'1px solid rgba(255,215,64,0.1)', fontFamily:"'IBM Plex Mono',monospace", fontSize:10, color:'#ffd740', letterSpacing:2 }}>🏆 LIGA RECORD — DESTAQUES DA SEMANA</div>
          <div style={{ padding:'10px 14px', display:'flex', flexDirection:'column', gap:10 }}>
            {data.liga_record_destaques.map((p,i)=>(
              <div key={i} style={{ background:'rgba(255,255,255,0.02)', borderRadius:8, padding:'10px 12px' }}>
                <div style={{ display:'flex', gap:7, alignItems:'center', flexWrap:'wrap', marginBottom:3 }}>
                  <span style={{ fontSize:14, color:'#e8ecf0', fontWeight:600 }}>{p.jogador}</span>
                  <Tag label={p.equipa} color='#8892a4'/>
                  <Tag label={p.posicao} color='#4a9eff'/>
                  {p.preco_estimado && <Tag label={p.preco_estimado} color='#ffd740'/>}
                </div>
                <div style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:11, color:'#ffd740', marginBottom:3 }}>{p.forma}</div>
                <div style={{ fontSize:12, color:'#6b7280', lineHeight:1.5 }}>{p.motivo}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function Table({ title, rows, cols, hdrs }) {
  return (
    <div style={{ background:'rgba(255,255,255,0.025)', border:'1px solid rgba(255,255,255,0.06)', borderRadius:10, overflow:'hidden', marginBottom:14 }}>
      <div style={{ padding:'10px 14px', borderBottom:'1px solid rgba(255,255,255,0.05)', fontFamily:"'IBM Plex Mono',monospace", fontSize:10, color:'#4a5568', letterSpacing:2 }}>{title}</div>
      <div style={{ overflowX:'auto' }}>
        <table style={{ width:'100%', borderCollapse:'collapse' }}>
          <thead><tr>{hdrs.map(h=><th key={h} style={{ padding:'7px 10px', fontFamily:"'IBM Plex Mono',monospace", fontSize:9, color:'#3a4255', textAlign:'left', borderBottom:'1px solid rgba(255,255,255,0.04)', letterSpacing:1, whiteSpace:'nowrap' }}>{h}</th>)}</tr></thead>
          <tbody>{rows.map((r,i)=>(
            <tr key={i} style={{ borderBottom:'1px solid rgba(255,255,255,0.03)', background:i%2?'rgba(255,255,255,0.01)':'transparent' }}>
              {cols.map(c=><td key={c} style={{ padding:'7px 10px', fontFamily:"'IBM Plex Mono',monospace", fontSize:12, color:'#c8d0da', whiteSpace:'nowrap' }}>{r[c]}</td>)}
            </tr>
          ))}</tbody>
        </table>
      </div>
    </div>
  );
}

function Tag({ label, color }) {
  return <span style={{ background:`${color}18`, border:`1px solid ${color}44`, borderRadius:4, padding:'2px 7px', fontFamily:"'IBM Plex Mono',monospace", fontSize:10, color, whiteSpace:'nowrap' }}>{label}</span>;
}

const pill = active => ({
  background: active ? 'rgba(0,230,118,0.12)' : 'rgba(255,255,255,0.04)',
  border: active ? '1px solid rgba(0,230,118,0.4)' : '1px solid rgba(255,255,255,0.08)',
  borderRadius:20, padding:'4px 12px', color: active ? '#00e676' : '#4a5568',
  fontFamily:"'IBM Plex Mono',monospace", fontSize:11, cursor:'pointer', whiteSpace:'nowrap'
});


function Spinner() {
  return <div style={{ width:13,height:13,border:'2px solid rgba(0,230,118,.3)',borderTopColor:'#00e676',borderRadius:'50%',animation:'spin .8s linear infinite' }}/>;
}
