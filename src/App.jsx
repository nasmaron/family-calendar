import { useState, useEffect, useRef } from "react";
// Google Fonts: Press Start 2P (pixel font)
const _pixelFontLink = document.createElement("link");
_pixelFontLink.rel = "stylesheet";
_pixelFontLink.href = "https://fonts.googleapis.com/css2?family=Press+Start+2P&display=swap";
document.head.appendChild(_pixelFontLink);

const THEMES = {
  red: { label:"赤", bg:"#0f0a0a", card:"#1c1010", border:"#3d1a1a", accent:"#ff4d6d", accentDim:"#cc2244", win:"#00e676", lose:"#ff8800", draw:"#ffaa00", first:"#ffd700", second:"#a78bfa", text:"#ffe8e8", muted:"#996666", surface:"#1a0f0f" },
  blue: { label:"青", bg:"#0a0e1a", card:"#111827", border:"#1e2d4a", accent:"#00d4ff", accentDim:"#0099bb", win:"#00e676", lose:"#ff4444", draw:"#ffaa00", first:"#ffd700", second:"#a78bfa", text:"#e8f4ff", muted:"#6b8aaa", surface:"#161f30" },
  yellow: { label:"黄", bg:"#0f0e08", card:"#1c1a0e", border:"#3d3510", accent:"#facc15", accentDim:"#ca9a04", win:"#00e676", lose:"#ff4444", draw:"#fb923c", first:"#f97316", second:"#a78bfa", text:"#fffbe8", muted:"#998844", surface:"#1a180a" },
  green: { label:"緑", bg:"#080f0a", card:"#0f1c12", border:"#1a3d20", accent:"#00e676", accentDim:"#00b359", win:"#69ff47", lose:"#ff4444", draw:"#ffaa00", first:"#ffd700", second:"#a78bfa", text:"#e8ffe8", muted:"#5a8a6a", surface:"#0c1a0e" },
  black: { label:"黒", bg:"#080808", card:"#111111", border:"#2a2a2a", accent:"#aaaaaa", accentDim:"#777777", win:"#00e676", lose:"#ff4444", draw:"#ffaa00", first:"#ffd700", second:"#a78bfa", text:"#e0e0e0", muted:"#555555", surface:"#1a1a1a" },
  purple: { label:"紫", bg:"#0d0a18", card:"#160f2a", border:"#2e1a5a", accent:"#a78bfa", accentDim:"#7c55d4", win:"#00e676", lose:"#ff4444", draw:"#ffaa00", first:"#ffd700", second:"#f472b6", text:"#ede8ff", muted:"#7a6a99", surface:"#130e22" },
  white: { label:"白", bg:"#f0f4f8", card:"#ffffff", border:"#d1dce8", accent:"#0077cc", accentDim:"#005fa3", win:"#16a34a", lose:"#dc2626", draw:"#d97706", first:"#b45309", second:"#7c3aed", text:"#1e293b", muted:"#64748b", surface:"#e2eaf2" },
};

function getTheme(id) { return THEMES[id] || THEMES.blue; }
const globalC = {...THEMES.blue};
const C = globalC;

const DECK_COLORS = [
  { id:"red", label:"赤", hex:"#ef4444" },
  { id:"blue", label:"青", hex:"#3b82f6" },
  { id:"green", label:"緑", hex:"#22c55e" },
  { id:"yellow", label:"黄", hex:"#eab308" },
  { id:"purple", label:"紫", hex:"#a855f7" },
  { id:"black", label:"黒", hex:"#6b7280" },
  { id:"white", label:"白", hex:"#e5e7eb" },
  { id:"rainbow", label:"虹", hex:null },
];

const STORAGE_KEY = "digimon_tcg_v2";
const IDB_NAME = "digimon_tcg_images";
const IDB_STORE = "images";
const IDB_VERSION = 1;

function openIDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(IDB_NAME, IDB_VERSION);
    req.onupgradeneeded = e => e.target.result.createObjectStore(IDB_STORE, {keyPath:"id"});
    req.onsuccess = e => resolve(e.target.result);
    req.onerror = () => reject(req.error);
  });
}
async function idbPut(item) {
  const db = await openIDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(IDB_STORE, "readwrite");
    tx.objectStore(IDB_STORE).put(item);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}
async function idbGet(id) {
  const db = await openIDB();
  return new Promise((resolve, reject) => {
    const req = db.transaction(IDB_STORE, "readonly").objectStore(IDB_STORE).get(id);
    req.onsuccess = () => resolve(req.result || null);
    req.onerror = () => reject(req.error);
  });
}
async function idbDelete(id) {
  const db = await openIDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(IDB_STORE, "readwrite");
    tx.objectStore(IDB_STORE).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}
async function idbGetAll() {
  const db = await openIDB();
  return new Promise((resolve, reject) => {
    const req = db.transaction(IDB_STORE, "readonly").objectStore(IDB_STORE).getAll();
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => reject(req.error);
  });
}
async function idbClear() {
  const db = await openIDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(IDB_STORE, "readwrite");
    tx.objectStore(IDB_STORE).clear();
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}
const DEFAULT_MATCH_TYPES = ["テイマーバトル","エボリューションカップ","アルティメットカップ","超テイマーバトル","店舗予選","フリー"];

const FORM_FIELDS = [
  { key:"date", label:"日付" }, { key:"matchType", label:"対戦種類" }, { key:"deck", label:"使用デッキ", required:true },
  { key:"opponent", label:"相手デッキ", required:true }, { key:"opponentPerson", label:"対戦相手" }, { key:"turn", label:"先攻後攻" },
  { key:"result", label:"勝敗", required:true }, { key:"endTurn", label:"終了ターン" }, { key:"lucky", label:"運・不運" },
  { key:"notes", label:"メモ" }, { key:"deckUrl", label:"デッキURL" }, { key:"deckImage", label:"デッキ画像" }, { key:"image", label:"対戦画像" },
];

function load() {
  try {
    const d = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
    return {
      decks: d.decks || [], matches: d.matches || [], opponentNames: d.opponentNames || [],
      matchTypes: d.matchTypes || [...DEFAULT_MATCH_TYPES], prefs: d.prefs || {}, theme: d.theme || 'blue',
      formFields: d.formFields || {}, opponents: d.opponents || [],
      deckImages: d.deckImages || [],
      uiPrefs: d.uiPrefs || {},
    };
  } catch { return { decks:[], matches:[], opponentNames:[], matchTypes:[...DEFAULT_MATCH_TYPES], prefs:{}, theme:'blue', formFields:{}, opponents:[], deckImages:[], uiPrefs:{} }; }
}
function save(d) {
  try {
    const {deckImages, ...rest} = d;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(rest));
  } catch(e) {
    console.warn("localStorage save failed:", e);
  }
}
function serializeData(st, includeImages=false) {
  if (includeImages) {
    return JSON.stringify({...st});
  }
  const stripped = {
    ...st,
    decks: (st.decks||[]).map(d => { const r={...d}; delete r.image; return r; }),
    matches: (st.matches||[]).map(m => { const r={...m}; delete r.image; delete r.deckImage; return r; }),
    deckImages: [],
  };
  return JSON.stringify(stripped);
}
function parseData(text) {
  try { const d = JSON.parse(text); if (d && d.matches && d.decks) return d; } catch {}
  return null;
}


// ── DeckImage helpers ──────────────────────────────────
function genId() { return Date.now().toString(36) + Math.random().toString(36).slice(2,6); }

// デッキに画像を追加し、上限を超えたら古いものを削除
function addDeckImage(deckImages, decks, deckId, imageData) {
  const deck = decks.find(d => d.id === deckId);
  const maxImages = deck?.maxImages ?? 10; // 0=無制限
  const newImg = { id: genId(), deckId, imageData, createdAt: new Date().toISOString() };
  let imgs = [...deckImages, newImg];
  if (maxImages > 0) {
    // このデッキの画像を古い順に並べて上限超え分を削除
    const deckImgs = imgs.filter(i => i.deckId === deckId).sort((a,b) => a.createdAt.localeCompare(b.createdAt));
    if (deckImgs.length > maxImages) {
      const toDelete = new Set(deckImgs.slice(0, deckImgs.length - maxImages).map(i => i.id));
      imgs = imgs.filter(i => !toDelete.has(i.id));
    }
  }
  return { newImgs: imgs, newImgId: newImg.id };
}

// imageIdから画像データを取得（後方互換付き）
function getMatchImage(match, deckImages, deck) {
  if (match.imageId) {
    const img = deckImages.find(i => i.id === match.imageId);
    if (img) return img.imageData;
  }
  // 後方互換：imageIdなし → deck.currentImageIdで参照
  if (deck?.currentImageId) {
    const img = deckImages.find(i => i.id === deck.currentImageId);
    if (img) return img.imageData;
  }
  // さらに後方互換：旧形式のdeck.image
  return deck?.image || null;
}

function firstHex(colors) {
  if (!colors?.length) return C.muted;
  if (colors.includes("rainbow")) return null;
  return DECK_COLORS.find(c => c.id === colors[0])?.hex || C.muted;
}

function DeckDot({ colors, size=12 }) {
  const s = { width:size, height:size, borderRadius:"50%", flexShrink:0 };
  if (!colors?.length) return <div style={{...s, background:C.muted}} />;
  if (colors.includes("rainbow")) return <div style={{...s, background:"linear-gradient(135deg,#ef4444,#eab308,#22c55e,#3b82f6,#a855f7)"}} />;
  if (colors.length===1) { const c=DECK_COLORS.find(x=>x.id===colors[0]); return <div style={{...s, background:c?.hex||C.muted, border:colors[0]==="white"?"1px solid #555":"none"}} />; }
  const hexes=colors.slice(0,4).reverse().map(id=>DECK_COLORS.find(c=>c.id===id)?.hex||C.muted);
  const step=360/hexes.length;
  return <div style={{...s, background:`conic-gradient(${hexes.map((h,i)=>`${h} ${i*step}deg ${(i+1)*step}deg`).join(",")})`}} />;
}

function WinBadge({result}) {
  const m={win:["勝",C.win],lose:["敗",C.lose],draw:["分",C.draw]};
  const [l,col]=m[result]||m.draw;
  return <span style={{background:col+"22",color:col,border:`1px solid ${col}55`,borderRadius:6,padding:"2px 10px",fontWeight:800,fontSize:12,fontFamily:"monospace"}}>{l}</span>;
}
function TurnBadge({turn}) {
  if (!turn) return null;
  const col=turn==="first"?C.first:C.second;
  return <span style={{background:col+"22",color:col,border:`1px solid ${col}55`,borderRadius:6,padding:"2px 7px",fontWeight:700,fontSize:11}}>{turn==="first"?"先攻":"後攻"}</span>;
}

function ToggleRow({ options, value, onChange, size="md", noDeselect=false }) {
  const pad = size==="sm" ? "6px 0" : "8px 0";
  const fs  = size==="sm" ? 12 : 13;
  return (
    <div style={{display:"flex", gap:6}}>
      {options.map(([v,label,col])=>{
        const sel=value===v;
        const bc=col||(sel?C.accent:C.border);
        return (
          <button key={v} onClick={()=>onChange(noDeselect?v:(sel?"":v))} style={{
            flex:1, padding:pad, borderRadius:8, border:`2px solid ${sel?bc:C.border}`,
            background:sel?bc+"22":"transparent", color:sel?bc:C.muted,
            fontWeight:sel?700:400, cursor:"pointer", fontSize:fs,
          }}>{label}</button>
        );
      })}
    </div>
  );
}

function DeckPicker({ value, onChange, names, placeholder="デッキ名", useId=false }) {
  const [mode, setMode] = useState(() => names.some(n=>(useId?n.id:n.name)===value) ? "list" : "text");
  const [open, setOpen] = useState(false);
  const [text, setText] = useState(() => {
    if (!value) return "";
    if (useId) { const f=names.find(n=>n.id===value); return f?f.name:""; }
    return value;
  });
  const [focused, setFocused] = useState(false);
  const ref = useRef(null);

  const selectedName = useId ? (names.find(n=>n.id===value)?.name || "") : (value || "");
  const textSuggestions = text.trim().length > 0 ? names.filter(n=>n.name.toLowerCase().includes(text.toLowerCase())) : [];

  const selectItem = item => { onChange(useId ? item.id : item.name, item.name); setText(item.name); setOpen(false); setFocused(false); ref.current?.blur(); };

  return (
    <div style={{position:"relative"}}>
      <div style={{display:"flex",gap:5,marginBottom:7}}>
        {[["list","リストから"],["text","直接入力"]].map(([m,l])=>(
          <button key={m} onClick={()=>{setMode(m);setOpen(false);}} style={{
            flex:1, padding:"5px 0", borderRadius:6, fontSize:11, cursor:"pointer",
            border:`1.5px solid ${mode===m?C.accent:C.border}`,
            background:mode===m?C.accent+"22":"transparent",
            color:mode===m?C.accent:C.muted, fontWeight:mode===m?700:400,
          }}>{l}</button>
        ))}
      </div>
      {mode==="list" ? (
        <>
          <div onClick={()=>setOpen(o=>!o)} style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"8px 12px",borderRadius:8,cursor:"pointer",border:`1px solid ${open?C.accent:C.border}`,background:C.surface,minHeight:38}}>
            <span style={{fontSize:15, color:selectedName?C.text:C.muted}}>{selectedName || placeholder}</span>
            <span style={{color:C.muted,fontSize:12,marginLeft:8}}>{open?"▲":"▼"}</span>
          </div>
          {open && (
            <div style={{position:"absolute",top:"100%",left:0,right:0,background:C.card,border:`1px solid ${C.accent}`,borderRadius:8,zIndex:300,maxHeight:220,overflowY:"auto",marginTop:3,boxShadow:"0 8px 24px #000a"}}>
              {names.length===0 ? <div style={{padding:"12px 14px",fontSize:13,color:C.muted}}>登録がありません</div>
              : names.map(n=>{
                const v=useId?n.id:n.name; const sel=value===v;
                return <div key={v} onMouseDown={()=>selectItem(n)} style={{padding:"11px 14px",cursor:"pointer",fontSize:15,color:sel?C.accent:C.text,background:sel?C.accent+"18":"transparent",borderBottom:`1px solid ${C.border}`,display:"flex",alignItems:"center",justifyContent:"space-between"}}>
                  <span>{n.name}</span>{sel&&<span style={{color:C.accent,fontSize:13,fontWeight:800}}>✓</span>}
                </div>;
              })}
            </div>
          )}
        </>
      ) : (
        <div style={{position:"relative"}}>
          <input ref={ref} value={text} onChange={e=>{setText(e.target.value);onChange(useId?"":e.target.value, e.target.value);setFocused(true);}} onFocus={()=>setFocused(true)} onBlur={()=>setTimeout(()=>setFocused(false),200)} placeholder={placeholder}
            style={{width:"100%",background:C.bg,border:`1px solid ${focused?C.accent:C.border}`,borderRadius:8,color:C.text,padding:"8px 12px",fontSize:16,outline:"none",boxSizing:"border-box"}} />
          {focused && textSuggestions.length>0&&(
            <div style={{position:"absolute",top:"100%",left:0,right:0,background:C.card,border:`1px solid ${C.accent}`,borderRadius:8,zIndex:300,maxHeight:200,overflowY:"auto",boxShadow:"0 8px 24px #000a",marginTop:3}}>
              {textSuggestions.map(n=>(
                <div key={n.name} onTouchStart={()=>selectItem(n)} onMouseDown={()=>selectItem(n)} style={{padding:"11px 14px",cursor:"pointer",fontSize:15,color:C.text,borderBottom:`1px solid ${C.border}`,display:"flex",alignItems:"center",justifyContent:"space-between"}}>
                  <span>{n.name}</span><span style={{fontSize:11,color:C.accent}}>選択</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function MatchTypePicker({ value, onChange, matchTypes, onAdd, onDelete }) {
  const [open, setOpen] = useState(false);
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState("");
  const handleAdd = () => { const t=draft.trim(); if(!t||matchTypes.includes(t)) return; onAdd(t); onChange(t); setDraft(""); setAdding(false); setOpen(false); };
  return (
    <div style={{position:"relative"}}>
      <div onClick={()=>{setOpen(o=>!o); setAdding(false);}} style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"8px 12px",borderRadius:8,cursor:"pointer",border:`1px solid ${open?C.accent:C.border}`,background:C.surface,minHeight:38}}>
        <span style={{fontSize:15, color:value?C.text:C.muted}}>{value||"選択してください"}</span>
        <span style={{color:C.muted,fontSize:12,marginLeft:8}}>{open?"▲":"▼"}</span>
      </div>
      {open&&(
        <div style={{position:"absolute",top:"100%",left:0,right:0,background:C.card,border:`1px solid ${C.accent}`,borderRadius:8,zIndex:300,boxShadow:"0 8px 24px #000a",marginTop:3,overflow:"hidden"}}>
          {value&&<div onClick={()=>{onChange("");setOpen(false);}} style={{padding:"10px 14px",cursor:"pointer",fontSize:14,color:C.muted,borderBottom:`1px solid ${C.border}`}}><span>（なし）</span></div>}
          <div style={{maxHeight:200,overflowY:"auto"}}>
            {matchTypes.map(t=>{
              const sel=value===t; const isDef=DEFAULT_MATCH_TYPES.includes(t);
              return <div key={t} style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"10px 14px",cursor:"pointer",fontSize:14,color:sel?C.accent:C.text,background:sel?C.accent+"18":"transparent",borderBottom:`1px solid ${C.border}`}}>
                <span style={{flex:1}} onClick={()=>{onChange(sel?"":t);setOpen(false);}}>{t}</span>
                {sel&&<span style={{color:C.accent,fontWeight:800,fontSize:13,marginRight:8}}>✓</span>}
                {!isDef&&<span onClick={e=>{e.stopPropagation();onDelete(t);if(value===t)onChange("");}} style={{color:"#ff6b6b",cursor:"pointer",fontSize:16,fontWeight:900,padding:"0 4px",lineHeight:1}}>×</span>}
              </div>;
            })}
          </div>
          {!adding ? <div onClick={()=>setAdding(true)} style={{padding:"10px 14px",cursor:"pointer",fontSize:13,color:C.muted,borderTop:`1px solid ${C.border}`,display:"flex",alignItems:"center",gap:6}}><span style={{fontSize:16}}>＋</span> 新しい種類を追加</div>
          : <div style={{padding:"8px 10px",borderTop:`1px solid ${C.border}`,display:"flex",gap:6}}>
              <input value={draft} onChange={e=>setDraft(e.target.value)} onKeyDown={e=>e.key==="Enter"&&handleAdd()} placeholder="種類名" autoFocus style={{flex:1,background:C.bg,border:`1px solid ${C.border}`,borderRadius:6,color:C.text,padding:"6px 10px",fontSize:16,outline:"none"}}/>
              <button onClick={handleAdd} style={{background:C.accent,color:"#000",border:"none",borderRadius:6,padding:"6px 12px",fontWeight:800,cursor:"pointer",fontSize:12}}>登録</button>
              <button onClick={()=>{setAdding(false);setDraft("");}} style={{background:"transparent",border:`1px solid ${C.border}`,borderRadius:6,padding:"6px 10px",color:C.muted,cursor:"pointer",fontSize:12}}>✕</button>
            </div>}
        </div>
      )}
    </div>
  );
}

function Row({ label, children, fieldKey, formFields, onToggleField, required=false }) {
  const minimized = fieldKey && (formFields||{})[fieldKey] === false;
  const reqBadge = required && <span style={{fontSize:10,color:"#ff6b6b",fontWeight:700,marginLeft:4,flexShrink:0}}>必須</span>;
  const labelEl = <span style={{fontSize:11,color:required?C.text:C.muted,letterSpacing:0.3,fontWeight:required?700:400,display:"flex",alignItems:"center"}}>{label}{reqBadge}</span>;
  if (fieldKey && onToggleField) {
    if (minimized) return (
      <div style={{display:"flex",alignItems:"center",paddingBottom:6,paddingTop:4,borderBottom:`1px solid ${C.border}`,opacity:0.45}}>
        <span style={{fontSize:10,color:C.muted,letterSpacing:0.3,flex:1}}>{label}</span>
        <span onClick={()=>onToggleField(fieldKey)} style={{fontSize:13,cursor:"pointer",color:C.accent,padding:"2px 8px",lineHeight:1,fontWeight:700}}>＋</span>
      </div>
    );
    return (
      <div style={{paddingBottom:10,borderBottom:`1px solid ${C.border}`,background:required?`${C.accent}22`:"transparent",borderRadius:required?8:0,padding:required?"8px 10px 10px 10px":"4px 0 10px 0",marginBottom:required?"4px":0,marginTop:required?"4px":0}}>
        <div style={{display:"flex",alignItems:"center",marginBottom:6}}>
          <div style={{flex:1}}>{labelEl}</div>
          <span onClick={()=>onToggleField(fieldKey)} style={{fontSize:13,cursor:"pointer",color:C.muted,padding:"2px 8px",lineHeight:1}}>－</span>
        </div>
        <div>{children}</div>
      </div>
    );
  }
  return (
    <div style={{display:"grid",gridTemplateColumns:"64px 1fr",gap:8,alignItems:"start",paddingBottom:10,borderBottom:`1px solid ${C.border}`}}>
      <div style={{paddingTop:8}}>{labelEl}</div>
      <div>{children}</div>
    </div>
  );
}

function MatchEntry({ initial, onSave, onCancel, decks, opponentNames, opponents, matchTypes, onAddMatchType, onDeleteMatchType, isEdit, onDelete, formFields={}, carryOver, onToggleCarryOver, onToggleField, onContinue, seriesCount=0, scrollRef }) {
  const [form, setForm] = useState(initial);
  const set = patch => setForm(f=>({...f,...patch}));
  const deckOK = !!(form.deckId || (form.deckName && form.deckName.trim()));
  const canSave = deckOK && form.opponent.trim() && form.result;
  const inputStyle = { background:C.bg, border:`1px solid ${C.border}`, borderRadius:8, color:C.text, padding:"8px 12px", fontSize:16, outline:"none", width:"100%", boxSizing:"border-box" };

  return (
    <div style={{minHeight:"100vh",background:C.bg,color:C.text,fontFamily:"Noto Sans JP,Hiragino Sans,sans-serif",display:"flex",flexDirection:"column",maxWidth:"100vw",overflowX:"clip"}}>
      <div style={{background:C.card,borderBottom:`1px solid ${C.border}`,padding:"14px 16px",display:"flex",alignItems:"center",justifyContent:"space-between",gap:6}}>
        <button onClick={onCancel} style={{background:C.surface,border:`1px solid ${C.border}`,color:C.text,cursor:"pointer",fontSize:14,fontWeight:700,padding:"8px 12px",borderRadius:8,flexShrink:0}}>← 戻る</button>
        <div style={{textAlign:"center",flex:1,minWidth:0}}>
          <div style={{fontWeight:800,fontSize:15}}>{isEdit?"対戦を編集":"対戦を記録"}</div>
          {!isEdit&&<div style={{fontSize:11,color:"#ff9800",fontWeight:700}}>連続記録 {seriesCount+1}回目</div>}
        </div>
        <div style={{display:"flex",gap:5,flexShrink:0}}>
          <button onClick={()=>canSave&&onSave(form)} style={{background:canSave?`linear-gradient(135deg,${C.accent},${C.accentDim})`:"#1e2d4a",color:canSave?"#000":C.muted,border:"none",borderRadius:8,padding:"7px 10px",fontWeight:800,fontSize:12,cursor:canSave?"pointer":"default"}}>記録</button>
          {!isEdit&&onContinue&&<button onClick={()=>canSave&&onContinue(form)} style={{background:canSave?"#ff980022":"#1e2d4a",color:canSave?"#ff9800":C.muted,border:`1px solid ${canSave?"#ff9800":C.border}`,borderRadius:8,padding:"7px 8px",fontWeight:800,fontSize:11,cursor:canSave?"pointer":"default",whiteSpace:"nowrap"}}>連続記録</button>}
        </div>
      </div>
      <div ref={scrollRef} style={{flex:1,overflowY:"auto",overflowX:"hidden",padding:"12px 16px",maxWidth:600,margin:"0 auto",width:"100%",boxSizing:"border-box",minWidth:0}}>
        {!isEdit&&(
          <div>
            <div onClick={()=>{ const next=!carryOver; onToggleCarryOver(next); if(next){setForm(initial);}else{setForm(f=>({...f,deckId:"",opponent:"",matchType:"",opponentPerson:""}));} }} style={{display:"flex",alignItems:"center",gap:10,padding:"10px 14px",borderRadius:10,marginBottom:8,cursor:"pointer",background:C.surface,border:`1px solid ${carryOver?C.accent:C.border}`}}>
                <div style={{width:20,height:20,borderRadius:4,border:`2px solid ${carryOver?C.accent:C.muted}`,background:carryOver?C.accent:"transparent",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
                  {carryOver&&<span style={{color:"#000",fontSize:13,fontWeight:900}}>✓</span>}
                </div>
                <span style={{fontSize:13,color:carryOver?C.text:C.muted}}>前回の入力を引き継ぐ</span>
              </div>
          </div>
        )}
        <div style={{display:"flex",flexDirection:"column",gap:0}}>
          <Row label="日付" fieldKey="date" formFields={formFields} onToggleField={onToggleField}>
            <input type="date" value={form.date} onChange={e=>set({date:e.target.value})} style={{...inputStyle,width:"100%",maxWidth:"100%",minWidth:0,boxSizing:"border-box",WebkitAppearance:"none",appearance:"none",fontSize:16}} />
          </Row>
          <Row label="対戦種類" fieldKey="matchType" formFields={formFields} onToggleField={onToggleField}>
            <MatchTypePicker value={form.matchType||""} onChange={v=>set({matchType:v})} matchTypes={matchTypes} onAdd={onAddMatchType} onDelete={onDeleteMatchType} />
          </Row>
          <Row label="使用デッキ" fieldKey="deck" formFields={formFields} onToggleField={onToggleField} required={true}>
            <DeckPicker value={form.deckId?((decks.find(d=>d.id===form.deckId)?.name)||form.deckName||""):form.deckName||""} onChange={v=>set({deckId:decks.find(d=>d.name===v)?.id||"",deckName:v})} names={decks} placeholder="デッキ名を入力" useId={false} />
          </Row>
          <Row label="相手デッキ" fieldKey="opponent" formFields={formFields} onToggleField={onToggleField} required={true}>
            <DeckPicker value={form.opponent} onChange={v=>set({opponent:v})} names={Array.from(new Set([...decks.map(d=>d.name),...opponentNames])).sort().map(n=>({id:n,name:n}))} placeholder="相手のデッキ名" useId={false} />
          </Row>
          <Row label="対戦相手" fieldKey="opponentPerson" formFields={formFields} onToggleField={onToggleField}>
            <DeckPicker value={form.opponentPerson||""} onChange={v=>set({opponentPerson:v})} names={(opponents||[]).map(n=>({id:n,name:n}))} placeholder="対戦相手の名前" useId={false} />
          </Row>
          <Row label="先攻後攻" fieldKey="turn" formFields={formFields} onToggleField={onToggleField}>
            <ToggleRow options={[["first","⚡ 先攻",C.first],["second","🌙 後攻",C.second]]} value={form.turn} onChange={v=>set({turn:v})} />
          </Row>
          <Row label="勝敗" fieldKey="result" formFields={formFields} onToggleField={onToggleField} required={true}>
            <ToggleRow options={[["win","🏆 勝",C.win],["lose","💀 敗",C.lose],["draw","🤝 分",C.draw]]} value={form.result} onChange={v=>set({result:v})} noDeselect={true} />
          </Row>
          <Row label="終了ターン" fieldKey="endTurn" formFields={formFields} onToggleField={onToggleField}>
            <div style={{display:"flex",alignItems:"center",gap:10}}>
              <button onClick={()=>set({endTurn:form.endTurn!=null?Math.max(1,form.endTurn-1):null})} disabled={!form.endTurn} style={{width:36,height:36,borderRadius:8,border:`1px solid ${C.border}`,background:form.endTurn?C.surface:"transparent",color:form.endTurn?C.text:C.border,fontSize:20,cursor:form.endTurn?"pointer":"default",flexShrink:0,display:"flex",alignItems:"center",justifyContent:"center"}}>−</button>
              <span style={{fontSize:22,fontWeight:800,color:form.endTurn?C.text:C.muted,minWidth:32,textAlign:"center"}}>{form.endTurn??"-"}</span>
              <button onClick={()=>set({endTurn:form.endTurn!=null?form.endTurn+1:1})} style={{width:36,height:36,borderRadius:8,border:`1px solid ${C.border}`,background:C.surface,color:C.text,fontSize:20,cursor:"pointer",flexShrink:0,display:"flex",alignItems:"center",justifyContent:"center"}}>＋</button>
              <span style={{fontSize:12,color:C.muted}}>ターン</span>
              {form.endTurn!=null&&<button onClick={()=>set({endTurn:null})} style={{marginLeft:4,background:"transparent",border:"none",color:C.muted,cursor:"pointer",fontSize:13,padding:"2px 4px"}}>✕</button>}
            </div>
          </Row>
          <Row label="運" fieldKey="lucky" formFields={formFields} onToggleField={onToggleField}>
            <div style={{display:"flex",gap:8}}>
              {[["lucky","🍀 運あり","#22c55e"],["unlucky","💀 不運あり","#f87171"]].map(([k,label,col])=>{
                const sel=form[k]||false;
                return <button key={k} onClick={()=>set({[k]:!sel})} style={{flex:1,padding:"7px 0",borderRadius:8,fontSize:13,cursor:"pointer",border:`2px solid ${sel?col:C.border}`,background:sel?col+"22":"transparent",color:sel?col:C.muted,fontWeight:sel?700:400}}>{label}</button>;
              })}
            </div>
          </Row>
          <Row label="メモ" fieldKey="notes" formFields={formFields} onToggleField={onToggleField}>
            <textarea value={form.notes} onChange={e=>set({notes:e.target.value})} placeholder="（任意）" style={{...inputStyle,resize:"vertical",minHeight:52}} />
          </Row>
          <Row label="デッキURL" fieldKey="deckUrl" formFields={formFields} onToggleField={onToggleField}>
            <input placeholder="https://..." value={form.deckUrl||""} onChange={e=>set({deckUrl:e.target.value})} style={inputStyle}/>
          </Row>
          <Row label="デッキ画像" fieldKey="deckImage" formFields={formFields} onToggleField={onToggleField}>
            <label style={{display:"flex",alignItems:"center",justifyContent:"center",borderRadius:8,border:`1px dashed ${form.deckImage?C.accent:C.border}`,cursor:"pointer",overflow:"hidden",minHeight:60,background:C.surface,position:"relative"}}>
              {form.deckImage
                ? <img src={form.deckImage} alt="" style={{width:"100%",maxHeight:160,objectFit:"contain"}}/>
                : <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:6,padding:16}}>
                    <span style={{color:C.muted,fontSize:13}}>📷 タップしてデッキ画像を追加</span>
                  </div>
              }
              <input type="file" accept="image/*" style={{display:"none"}} onChange={e=>{
                const file=e.target.files[0]; if(!file) return;
                const reader=new FileReader();
                reader.onload=ev=>set({deckImage:ev.target.result});
                reader.readAsDataURL(file);
              }}/>
            </label>
            {form.deckImage&&(
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginTop:6}}>
                <span style={{fontSize:11,color:C.accent}}>✓ デッキに保存済みの画像</span>
                <button onClick={()=>set({deckImage:""})} style={{background:"transparent",border:"none",color:C.muted,cursor:"pointer",fontSize:12}}>✕ 削除</button>
              </div>
            )}
          </Row>
          <Row label="対戦画像" fieldKey="image" formFields={formFields} onToggleField={onToggleField}>
            <label style={{display:"flex",alignItems:"center",justifyContent:"center",borderRadius:8,border:`1px dashed ${form.image?C.accent:C.border}`,cursor:"pointer",overflow:"hidden",minHeight:60,background:C.surface}}>
              {form.image
                ? <img src={form.image} alt="" style={{width:"100%",maxHeight:160,objectFit:"contain"}}/>
                : <span style={{color:C.muted,fontSize:13,padding:16}}>📷 タップして対戦画像を追加</span>
              }
              <input type="file" accept="image/*" style={{display:"none"}} onChange={e=>{
                const file=e.target.files[0]; if(!file) return;
                const reader=new FileReader();
                reader.onload=ev=>set({image:ev.target.result});
                reader.readAsDataURL(file);
              }}/>
            </label>
            {form.image&&<button onClick={()=>set({image:""})} style={{marginTop:6,background:"transparent",border:"none",color:C.muted,cursor:"pointer",fontSize:12}}>✕ 画像を削除</button>}
          </Row>
        </div>

      </div>
      {/* 下部ボタン */}
      <div style={{padding:"12px 16px",borderTop:`1px solid ${C.border}`,display:"flex",flexDirection:"column",gap:8,flexShrink:0}}>
        <div style={{display:"flex",gap:8}}>
          <button onClick={()=>canSave&&onSave(form)} style={{flex:2,background:canSave?`linear-gradient(135deg,${C.accent},${C.accentDim})`:"#1e2d4a",color:canSave?"#000":C.muted,border:"none",borderRadius:8,padding:"13px 0",fontWeight:800,fontSize:15,cursor:canSave?"pointer":"default"}}>記録</button>
          {!isEdit&&onContinue&&<button onClick={()=>{if(!canSave)return;onContinue(form);}} style={{flex:1,background:canSave?"#ff980022":"#1e2d4a",color:canSave?"#ff9800":C.muted,border:`1px solid ${canSave?"#ff9800":C.border}`,borderRadius:8,padding:"13px 0",fontWeight:800,fontSize:14,cursor:canSave?"pointer":"default"}}>連続記録</button>}
        </div>
        {isEdit&&<button onClick={onDelete} style={{width:"100%",padding:"12px 0",borderRadius:8,border:"1px solid #ff4444",background:"transparent",color:"#ff4444",fontWeight:700,fontSize:14,cursor:"pointer"}}>この記録を削除</button>}
      </div>
    </div>
  );
}

function MatchDetailModal({ match, deck, onClose, onEdit, formFields={}, deckImages=[] }) {
  const show = key => formFields[key] !== false;
  const hex = deck ? firstHex(deck.colors) : null;
  useEffect(() => { const prev=document.body.style.overflow; document.body.style.overflow="hidden"; return ()=>{ document.body.style.overflow=prev; }; }, []);
  return (
    <div style={{position:"fixed",inset:0,background:"#000b",display:"flex",alignItems:"flex-end",zIndex:200,overflow:"hidden",touchAction:"none"}}>
      <div style={{background:C.card,borderRadius:"16px 16px 0 0",width:"100%",maxWidth:600,margin:"0 auto",maxHeight:"92vh",overflowY:"auto"}}>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"20px 18px",borderBottom:`1px solid ${C.border}`}}>
          <button onClick={onClose} style={{background:C.surface,border:`1px solid ${C.border}`,color:C.text,cursor:"pointer",fontSize:16,fontWeight:700,padding:"8px 16px",borderRadius:8}}>← 戻る</button>
          <span style={{fontWeight:800,fontSize:15}}>vs {match.opponent}</span>
          <button onClick={onEdit} style={{background:"transparent",border:`1px solid ${C.accent}`,color:C.accent,cursor:"pointer",fontSize:13,padding:"7px 14px",borderRadius:8,fontWeight:700}}>編集</button>
        </div>
        <div style={{padding:18,display:"flex",flexDirection:"column",gap:14}}>
          <div style={{background:C.surface,borderRadius:10,padding:14,display:"flex",flexDirection:"column",gap:10}}>
            <div style={{display:"flex",justifyContent:"space-between",fontSize:13}}>
              <span style={{color:C.muted}}>日付</span><span style={{color:C.text}}>{match.date}</span>
            </div>
            {show("matchType")&&match.matchType&&<div style={{display:"flex",justifyContent:"space-between",fontSize:13}}>
              <span style={{color:C.muted}}>対戦種類</span><span style={{color:C.text}}>{match.matchType}</span>
            </div>}
            {deck&&<div style={{display:"flex",justifyContent:"space-between",alignItems:"center",fontSize:13}}>
              <span style={{color:C.muted}}>使用デッキ</span>
              <span style={{display:"flex",alignItems:"center",gap:5,color:hex||C.text,fontWeight:700}}><DeckDot colors={deck.colors} size={12}/>{deck.name}</span>
            </div>}
            {match.opponentPerson&&<div style={{display:"flex",justifyContent:"space-between",fontSize:13}}>
              <span style={{color:C.muted}}>対戦相手</span><span style={{color:C.text,fontWeight:700}}>👤 {match.opponentPerson}</span>
            </div>}
            <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
              <WinBadge result={match.result}/>
              <TurnBadge turn={match.turn}/>
              {show("lucky")&&match.lucky&&<span style={{color:"#22c55e",background:"#22c55e18",border:"1px solid #22c55e44",borderRadius:6,padding:"3px 10px",fontSize:12}}>🍀 運あり</span>}
              {show("lucky")&&match.unlucky&&<span style={{color:"#f87171",background:"#f8717118",border:"1px solid #f8717144",borderRadius:6,padding:"3px 10px",fontSize:12}}>💀 不運あり</span>}
            </div>
            {show("endTurn")&&match.endTurn!=null&&<div style={{display:"flex",justifyContent:"space-between",fontSize:13}}>
              <span style={{color:C.muted}}>終了ターン</span><span style={{color:C.text}}>{match.endTurn}ターン</span>
            </div>}
            {show("deckUrl")&&match.deckUrl&&<div style={{display:"flex",justifyContent:"space-between",fontSize:13,gap:8}}>
              <span style={{color:C.muted,flexShrink:0}}>デッキURL</span>
              <a href={match.deckUrl} target="_blank" rel="noreferrer" style={{color:C.accent,fontSize:12,wordBreak:"break-all",textAlign:"right"}}>{match.deckUrl}</a>
            </div>}
          </div>
          {show("notes")&&match.notes&&<div style={{background:C.surface,borderRadius:10,padding:14}}>
            <div style={{fontSize:11,color:C.muted,marginBottom:6}}>メモ</div>
            <div style={{fontSize:13,color:C.text,lineHeight:1.7,whiteSpace:"pre-wrap"}}>{match.notes}</div>
          </div>}
          {show("deckImage")&&getMatchImage(match,deckImages,deck)&&<div><div style={{fontSize:11,color:C.muted,marginBottom:6}}>デッキ画像</div><img src={getMatchImage(match,deckImages,deck)} alt="" style={{width:"100%",borderRadius:10,objectFit:"contain",maxHeight:240,background:C.surface}}/></div>}
          {show("image")&&match.image&&(<div><div style={{fontSize:11,color:C.muted,marginBottom:6}}>対戦画像</div><img src={match.image} alt="" style={{width:"100%",borderRadius:10,objectFit:"contain",maxHeight:240,background:C.surface}}/></div>)}
        </div>
      </div>
    </div>
  );
}

// 統計セクション
const PIE_PALETTE = ["#00d4ff","#a78bfa","#00e676","#facc15","#f87171","#fb923c","#34d399","#60a5fa","#f472b6","#a3e635","#fbbf24","#818cf8"];
function StatSection({ label, visKey, statVis, children }) {
  const [collapsed, setCollapsed] = useState(false);
  // 設定画面でオフなら丸ごと非表示（優先度高）
  if (statVis[visKey] === false) return null;
  return (
    <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:12,padding:14,marginBottom:12}}>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:collapsed?0:12}}>
        <span style={{fontSize:13,fontWeight:700,color:collapsed?C.muted:C.text}}>{label}</span>
        <button onClick={()=>setCollapsed(v=>!v)} style={{background:"transparent",border:`1px solid ${C.border}`,borderRadius:6,padding:"2px 10px",color:C.muted,cursor:"pointer",fontSize:12,flexShrink:0}}>
          {collapsed?"表示":"非表示"}
        </button>
      </div>
      {!collapsed&&<div>{children}</div>}
    </div>
  );
}

function WinRateChart({ matches, flt }) {
  if (!matches||matches.length<2) return null;

  // 粒度を自動判定
  const dates = matches.map(m=>new Date(m.date||m.createdAt)).filter(d=>!isNaN(d));
  if (dates.length<2) return null;
  const minD = new Date(Math.min(...dates));
  const maxD = new Date(Math.max(...dates));
  const diffDays = (maxD-minD)/(1000*60*60*24);

  let fmt, groupKey;
  if (diffDays<=1) {
    fmt = d=>`${d.getHours()}時`;
    groupKey = d=>d.getFullYear()+"-"+d.getMonth()+"-"+d.getDate()+"-"+d.getHours();
  } else if (diffDays<=90) {
    fmt = d=>`${d.getMonth()+1}/${d.getDate()}`;
    groupKey = d=>d.getFullYear()+"-"+d.getMonth()+"-"+d.getDate();
  } else if (diffDays<=365) {
    const getWeek = d=>{ const s=new Date(d.getFullYear(),0,1); return Math.ceil(((d-s)/86400000+s.getDay()+1)/7); };
    fmt = d=>`${d.getMonth()+1}/${d.getDate()}週`;
    groupKey = d=>d.getFullYear()+"-W"+getWeek(d);
  } else {
    fmt = d=>`${d.getFullYear()}/${d.getMonth()+1}`;
    groupKey = d=>d.getFullYear()+"-"+d.getMonth();
  }

  // グループ化して勝率計算
  const groups = {};
  matches.forEach(m=>{
    const d = new Date(m.date||m.createdAt);
    if (isNaN(d)) return;
    const k = groupKey(d);
    if (!groups[k]) groups[k] = {label:fmt(d),wins:0,total:0,date:d};
    groups[k].total++;
    if (m.result==="win") groups[k].wins++;
  });
  const pts = Object.values(groups).sort((a,b)=>a.date-b.date).map(g=>({
    label:g.label, wr:g.total>0?Math.round(g.wins/g.total*100):0, total:g.total
  }));
  if (pts.length<2) return null;

  // SVGグラフ
  const W=320, H=80, padL=28, padR=8, padT=8, padB=20;
  const gW=W-padL-padR, gH=H-padT-padB;
  const maxWr=100, minWr=0;
  const xScale = i=>(i/(pts.length-1))*gW;
  const yScale = v=>gH-(v-minWr)/(maxWr-minWr)*gH;
  const pathD = pts.map((p,i)=>`${i===0?"M":"L"}${padL+xScale(i)},${padT+yScale(p.wr)}`).join(" ");
  // 50%ライン
  const y50 = padT+yScale(50);

  return (
    <div style={{marginTop:10}}>
      <div style={{fontSize:11,color:C.muted,marginBottom:4}}>勝率推移</div>
      <svg viewBox={"0 0 "+W+" "+H} style={{width:"100%",height:H,display:"block"}}>
        {/* 50%ライン */}
        <line x1={padL} y1={y50} x2={W-padR} y2={y50} stroke={C.border} strokeWidth="1" strokeDasharray="3,3"/>
        <text x={padL-2} y={y50+4} fontSize="9" fill={C.muted} textAnchor="end">50</text>
        {/* 0%と100%ライン */}
        <line x1={padL} y1={padT} x2={W-padR} y2={padT} stroke={C.border} strokeWidth="0.5" opacity="0.5"/>
        <line x1={padL} y1={padT+gH} x2={W-padR} y2={padT+gH} stroke={C.border} strokeWidth="0.5" opacity="0.5"/>
        <text x={padL-2} y={padT+4} fontSize="9" fill={C.muted} textAnchor="end">100</text>
        <text x={padL-2} y={padT+gH+4} fontSize="9" fill={C.muted} textAnchor="end">0</text>
        {/* 折れ線 */}
        <path d={pathD} fill="none" stroke={C.accent} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        {/* ドット */}
        {pts.map((p,i)=>(
          <circle key={i} cx={padL+xScale(i)} cy={padT+yScale(p.wr)} r="3"
            fill={p.wr>=50?C.win:C.lose} stroke={C.card} strokeWidth="1.5"/>
        ))}
        {/* X軸ラベル（最初・最後・中間） */}
        {pts.map((p,i)=>{
          const show = i===0||i===pts.length-1||(pts.length>4&&i===Math.floor(pts.length/2));
          if (!show) return null;
          const anchor = i===0?"start":i===pts.length-1?"end":"middle";
          return <text key={i} x={padL+xScale(i)} y={H-4} fontSize="9" fill={C.muted} textAnchor={anchor}>{p.label}</text>;
        })}
      </svg>
    </div>
  );
}


function MemoryGauge({marker,setMarker,onClose,accent,accentDim}) {
  const [vp,setVp]=useState({w:window.innerWidth,h:window.innerHeight});
  useEffect(()=>{
    const update=()=>{const vv=window.visualViewport;setVp({w:vv?vv.width:window.innerWidth,h:vv?vv.height:window.innerHeight});};
    update();
    window.addEventListener("resize",update);
    window.visualViewport?.addEventListener("resize",update);
    return()=>{window.removeEventListener("resize",update);window.visualViewport?.removeEventListener("resize",update);};
  },[]);

  const isLandscape=vp.w>vp.h;
  const PIXEL="'Press Start 2P','Courier New',monospace";

  if(isLandscape) return (
    <div style={{position:"fixed",top:0,left:0,width:vp.w,height:vp.h,zIndex:9999,background:"#0a0a0a",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:16}}>
      <div style={{fontSize:48}}>📱</div>
      <div style={{color:"white",fontFamily:PIXEL,fontSize:14,textAlign:"center",padding:"0 32px",lineHeight:2}}>縦向きでご使用ください</div>
      <button onClick={onClose} style={{marginTop:8,padding:"8px 20px",fontFamily:PIXEL,fontSize:11,background:"transparent",border:"3px solid white",color:"white",cursor:"pointer",imageRendering:"pixelated"}}>CLOSE</button>
    </div>
  );

  const cW=vp.h,cH=vp.w;
  const padH=24,padV=80,gf=0.12;
  const btnFromW=(cW-padH)/(10+8*gf+1.1);
  const btnFromH=(cH-padV)/(2+gf);
  const btnSize=Math.floor(Math.min(btnFromW,btnFromH));
  const gap=Math.floor(btnSize*gf);
  const zeroSize=Math.floor(btnSize*1.15);
  const fontSize=Math.floor(btnSize*0.38);
  const zeroFontSize=Math.floor(zeroSize*0.38);

  const Btn=({value,side})=>{
    const isSelected=marker===value;
    const isInRange=side==="p1"
      ? marker>0 && value>0 && value<=marker
      : marker<0 && value<0 && value>=marker;
    const col=side==="p1"?accent:accentDim;
    const bg=isSelected?col:isInRange?"white":"rgba(255,255,255,0.2)";
    const textColor=isSelected?"white":"#111";
    const rot=side==="p2"?"rotate(180deg)":"none";
    return (
      <div onClick={()=>setMarker(value)} style={{
        width:btnSize,height:btnSize,borderRadius:0,
        background:bg,color:textColor,
        fontFamily:PIXEL,fontWeight:900,fontSize,
        cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",
        border:isSelected?`3px solid white`:isInRange?`2px solid rgba(255,255,255,0.8)`:`2px solid rgba(255,255,255,0.3)`,
        flexShrink:0,WebkitTapHighlightColor:"transparent",
        opacity:isInRange||isSelected?1:0.35,
        boxShadow:isSelected?`4px 4px 0 rgba(0,0,0,0.5), 0 0 0 2px white`:"2px 2px 0 rgba(0,0,0,0.4)",
        imageRendering:"pixelated",
      }}>
        <span style={{transform:rot,display:"block",lineHeight:1}}>{Math.abs(value)}</span>
      </div>
    );
  };

  return (
    <div style={{position:"fixed",top:0,left:0,width:vp.w,height:vp.h,zIndex:9999,overflow:"hidden",display:"flex",alignItems:"center",justifyContent:"center",background:"#0a0a0a"}}>
      <div style={{width:cW,height:cH,transform:"rotate(90deg)",transformOrigin:"center center",flexShrink:0,position:"relative",overflow:"hidden"}}>
        {/* ドットグリッド背景 */}
        <div style={{position:"absolute",inset:0,background:accent,opacity:0.9}}/>
        <div style={{position:"absolute",inset:0,background:`repeating-linear-gradient(0deg,transparent,transparent 3px,rgba(0,0,0,0.08) 3px,rgba(0,0,0,0.08) 4px),repeating-linear-gradient(90deg,transparent,transparent 3px,rgba(0,0,0,0.08) 3px,rgba(0,0,0,0.08) 4px)`}}/>
        <div style={{position:"absolute",inset:0,background:accentDim,opacity:0.9,clipPath:"polygon(42% 0%, 100% 0%, 100% 100%, 58% 100%)"}}/>
        <div style={{position:"absolute",inset:0,background:`repeating-linear-gradient(0deg,transparent,transparent 3px,rgba(0,0,0,0.08) 3px,rgba(0,0,0,0.08) 4px),repeating-linear-gradient(90deg,transparent,transparent 3px,rgba(0,0,0,0.08) 3px,rgba(0,0,0,0.08) 4px)`,clipPath:"polygon(42% 0%, 100% 0%, 100% 100%, 58% 100%)"}}/>
        {/* 境界線 */}
        <div style={{position:"absolute",inset:0,background:"white",clipPath:"polygon(41% 0%, 43% 0%, 59% 100%, 57% 100%)"}}/>

        {/* P1ラベル */}
        <div style={{position:"absolute",top:10,left:10,display:"flex",alignItems:"center",gap:8,zIndex:10}}>
          <div style={{background:"black",border:"3px solid white",padding:"4px 10px",fontWeight:900,fontSize:11,letterSpacing:2,color:"white",fontFamily:PIXEL,boxShadow:"3px 3px 0 rgba(0,0,0,0.5)"}}>P1</div>
          <div onClick={onClose} style={{width:28,height:28,background:"black",border:"3px solid white",color:"white",fontSize:11,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",fontWeight:700,fontFamily:PIXEL,boxShadow:"3px 3px 0 rgba(0,0,0,0.5)",WebkitTapHighlightColor:"transparent"}}>✕</div>
        </div>

        {/* P2ラベル */}
        <div style={{position:"absolute",bottom:10,right:10,zIndex:10,transform:"rotate(180deg)"}}>
          <div style={{background:"black",border:"3px solid white",padding:"4px 10px",fontWeight:900,fontSize:11,letterSpacing:2,color:"white",fontFamily:PIXEL,boxShadow:"3px 3px 0 rgba(0,0,0,0.5)"}}>P2</div>
        </div>

        {/* ボタン群 */}
        <div style={{position:"absolute",inset:0,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:gap}}>
          <div style={{display:"flex",gap:gap,alignItems:"center"}}>
            <div style={{width:btnSize*5+gap*4+zeroSize+gap,flexShrink:0}}/>
            {[-10,-9,-8,-7,-6].map(n=><Btn key={n} value={n} side="p2"/>)}
          </div>
          <div style={{display:"flex",gap:gap,alignItems:"center"}}>
            {[5,4,3,2,1].map(n=><Btn key={n} value={n} side="p1"/>)}
            <div onClick={()=>setMarker(0)} style={{
              width:zeroSize,height:zeroSize,borderRadius:0,
              background:marker===0?"white":"rgba(255,255,255,0.85)",
              border:marker===0?"4px solid white":"2px solid rgba(255,255,255,0.8)",
              color:"#111",fontFamily:PIXEL,fontWeight:900,fontSize:zeroFontSize,
              cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,
              boxShadow:marker===0?"4px 4px 0 rgba(0,0,0,0.5), 0 0 0 3px white":"2px 2px 0 rgba(0,0,0,0.4)",
              WebkitTapHighlightColor:"transparent",imageRendering:"pixelated",
            }}>0</div>
            {[-1,-2,-3,-4,-5].map(n=><Btn key={n} value={n} side="p2"/>)}
          </div>
          <div style={{display:"flex",gap:gap,alignItems:"center"}}>
            {[6,7,8,9,10].map(n=><Btn key={n} value={n} side="p1"/>)}
            <div style={{width:zeroSize+gap+btnSize*5+gap*4,flexShrink:0}}/>
          </div>
        </div>
      </div>
    </div>
  );
}

function BackupSizeInfo({st, C, serializeData}) {
  const [idbCount, setIdbCount] = useState((st.deckImages||[]).length);
  useEffect(()=>{ idbGetAll().then(imgs=>setIdbCount(imgs.length)).catch(()=>{}); },[]);
  const toKB = s => s.length < 1024*1024 ? Math.round(s.length/1024)+"KB" : (s.length/1024/1024).toFixed(1)+"MB";
  const jsonNoImg = serializeData(st, false);
  return (
    <div style={{marginTop:10,background:C.surface,borderRadius:8,padding:"10px 12px",fontSize:12}}>
      <div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}><span style={{color:C.muted}}>テキストデータ</span><span style={{color:C.text,fontWeight:700}}>{toKB(jsonNoImg)}</span></div>
      <div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}><span style={{color:C.muted}}>保存画像枚数</span><span style={{color:C.text,fontWeight:700}}>{idbCount}枚（IndexedDB）</span></div>
    </div>
  );
}

function PieChart({ items }) {
  if (!items||items.length===0) return <div style={{fontSize:13,color:C.muted}}>データがありません</div>;
  const getColor = (item, index, usedColors) => {
    if (item.deckColors&&item.deckColors.length>0&&!item.deckColors.includes("rainbow")) {
      const dc=DECK_COLORS.find(c=>c.id===item.deckColors[0]);
      if (dc&&dc.hex) return dc.hex;
    }
    const prev=usedColors[usedColors.length-1];
    for (let i=0;i<PIE_PALETTE.length;i++) { const c=PIE_PALETTE[(index+i)%PIE_PALETTE.length]; if(c!==prev) return c; }
    return PIE_PALETTE[index%PIE_PALETTE.length];
  };
  const colors=[];
  items.forEach((item,i)=>colors.push(getColor(item,i,colors)));
  const size=140, cx=size/2, cy=size/2, r=54, ir=28;
  let cumAngle=-Math.PI/2;
  const sum=items.reduce((s,it)=>s+it.value,0);
  const slices=items.map((item,i)=>{
    const angle=(item.value/sum)*2*Math.PI;
    const x1=cx+r*Math.cos(cumAngle), y1=cy+r*Math.sin(cumAngle);
    const x2=cx+r*Math.cos(cumAngle+angle), y2=cy+r*Math.sin(cumAngle+angle);
    const ix1=cx+ir*Math.cos(cumAngle), iy1=cy+ir*Math.sin(cumAngle);
    const ix2=cx+ir*Math.cos(cumAngle+angle), iy2=cy+ir*Math.sin(cumAngle+angle);
    const large=angle>Math.PI?1:0;
    const d=`M ${ix1} ${iy1} L ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2} L ${ix2} ${iy2} A ${ir} ${ir} 0 ${large} 0 ${ix1} ${iy1} Z`;
    const slice={d,color:colors[i]};
    cumAngle+=angle;
    return slice;
  });
  return (
    <div style={{display:"flex",alignItems:"center",gap:16}}>
      <svg width={size} height={size} style={{flexShrink:0}}>
        {slices.map((s,i)=><path key={i} d={s.d} fill={s.color} stroke={C.card} strokeWidth={1}/>)}
        <circle cx={cx} cy={cy} r={ir-2} fill={C.card}/>
      </svg>
      <div style={{flex:1,maxHeight:160,overflowY:"auto",display:"flex",flexDirection:"column",gap:5}}>
        {items.map((item,i)=>(
          <div key={i} style={{display:"flex",alignItems:"center",gap:6}}>
            <div style={{width:10,height:10,borderRadius:2,background:colors[i],flexShrink:0}}/>
            <span style={{fontSize:12,color:C.text,flex:1,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{item.label}</span>
            <span style={{fontSize:12,color:C.muted,flexShrink:0}}>{Math.round(item.value/sum*100)}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function StatCard({label,value,color}) {
  return (
    <div style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:12,padding:"14px 8px",textAlign:"center",flex:1}}>
      <div style={{fontSize:22,fontWeight:900,color:color||C.accent,fontFamily:"monospace"}}>{value}</div>
      <div style={{fontSize:11,color:C.muted,marginTop:3}}>{label}</div>
    </div>
  );
}

function MergeModal({allNames, onMerge, onCancel, initialSelected=[]}) {
  const [selected,setSelected]=useState(initialSelected);
  const [newName,setNewName]=useState("");
  const toggle=n=>setSelected(s=>s.includes(n)?s.filter(x=>x!==n):[...s,n]);
  const canMerge=selected.length>=2&&newName.trim();
  const inputStyle={background:C.bg,border:`1px solid ${C.border}`,borderRadius:8,color:C.text,padding:"9px 12px",fontSize:16,outline:"none",width:"100%",boxSizing:"border-box"};
  return (
    <div style={{position:"fixed",inset:0,background:"#000b",display:"flex",alignItems:"flex-end",zIndex:100}}>
      <div style={{background:C.card,borderRadius:"16px 16px 0 0",padding:20,width:"100%",maxWidth:600,margin:"0 auto",maxHeight:"85vh",overflowY:"auto"}}>
        <div style={{fontWeight:800,fontSize:15,marginBottom:4}}>デッキ名をまとめる</div>
        <div style={{fontSize:12,color:C.muted,marginBottom:8}}>2つ以上選んで統一名を入力</div>
        {selected.length>0&&<div style={{display:"flex",flexWrap:"wrap",gap:4,marginBottom:10}}>{selected.map(n=><span key={n} style={{background:C.accent+"22",color:C.accent,border:`1px solid ${C.accent}55`,borderRadius:6,padding:"3px 8px",fontSize:12,fontWeight:700}}>{n}</span>)}</div>}
        <div style={{marginBottom:12,maxHeight:220,overflowY:"auto"}}>
          {allNames.map(n=>{
            const sel=selected.includes(n);
            return <div key={n} onClick={()=>toggle(n)} style={{display:"flex",alignItems:"center",gap:10,padding:"9px 12px",borderRadius:8,marginBottom:5,cursor:"pointer",border:`1px solid ${sel?C.accent:C.border}`,background:sel?C.accent+"11":C.surface}}>
              <div style={{width:17,height:17,borderRadius:4,border:`2px solid ${sel?C.accent:C.muted}`,background:sel?C.accent:"transparent",flexShrink:0,display:"flex",alignItems:"center",justifyContent:"center"}}>
                {sel&&<span style={{color:"#000",fontSize:11,fontWeight:900}}>✓</span>}
              </div>
              <span style={{fontSize:13,color:C.text}}>{n}</span>
            </div>;
          })}
        </div>
        {selected.length>=2&&<input placeholder="統一後の名前" value={newName} onChange={e=>setNewName(e.target.value)} style={{...inputStyle,marginBottom:10}} />}
        <div style={{display:"flex",gap:8}}>
          <button onClick={onCancel} style={{flex:1,padding:"10px 0",borderRadius:8,border:`1px solid ${C.border}`,background:"transparent",color:C.muted,cursor:"pointer",fontSize:13}}>キャンセル</button>
          <button onClick={()=>canMerge&&onMerge(selected,newName.trim())} style={{flex:2,padding:"10px 0",borderRadius:8,border:"none",background:canMerge?`linear-gradient(135deg,${C.accent},${C.accentDim})`:"#1e2d4a",color:canMerge?"#000":C.muted,fontWeight:800,cursor:canMerge?"pointer":"default",fontSize:13}}>まとめる</button>
        </div>
      </div>
    </div>
  );
}


function DeckMergeModal({ decks, selectedIds, deckImages, onMerge, onCancel }) {
  const selDecks = selectedIds.map(id=>decks.find(d=>d.id===id)).filter(Boolean);
  const [baseId, setBaseId] = useState(null);
  const [newName, setNewName] = useState("");
  const [step, setStep] = useState("base"); // "base" → "name"
  const inputStyle={background:C.bg,border:`1px solid ${C.border}`,borderRadius:8,color:C.text,padding:"9px 12px",fontSize:16,outline:"none",width:"100%",boxSizing:"border-box"};
  const handleSelectBase = (id) => {
    setBaseId(id);
    const deck = selDecks.find(d=>d.id===id);
    setNewName(deck?.name||"");
  };
  return (
    <div style={{position:"fixed",inset:0,background:"#000b",display:"flex",alignItems:"flex-end",zIndex:200,touchAction:"none"}}>
      <div style={{background:C.card,borderRadius:"16px 16px 0 0",padding:20,width:"100%",maxWidth:600,margin:"0 auto",maxHeight:"85vh",overflowY:"auto"}}>
        {step==="base"?(
          <>
            <div style={{fontWeight:800,fontSize:15,marginBottom:4}}>ベースデッキを選択</div>
            <div style={{fontSize:12,color:C.muted,marginBottom:12}}>画像・設定の基準にするデッキを選んでください。もう一方の画像は統合先に移動されます。</div>
            <div style={{display:"flex",flexDirection:"column",gap:8,marginBottom:14}}>
              {selDecks.map(d=>{
                const imgs=deckImages.filter(i=>i.deckId===d.id);
                const curImg=imgs.find(i=>i.id===d.currentImageId)||imgs[0];
                const sel=baseId===d.id;
                return (
                  <div key={d.id} onClick={()=>handleSelectBase(d.id)} style={{display:"flex",alignItems:"center",gap:12,padding:12,borderRadius:12,border:`2px solid ${sel?C.accent:C.border}`,background:sel?C.accent+"11":C.surface,cursor:"pointer"}}>
                    {curImg?<img src={curImg.imageData} alt="" style={{width:56,height:56,objectFit:"cover",borderRadius:8,flexShrink:0,border:`1px solid ${C.border}`}}/>:<div style={{width:56,height:56,borderRadius:8,background:C.card,flexShrink:0,display:"flex",alignItems:"center",justifyContent:"center",fontSize:20}}>🃏</div>}
                    <div style={{flex:1}}>
                      <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:4}}><DeckDot colors={d.colors} size={12}/><span style={{fontWeight:700,fontSize:14,color:sel?C.accent:C.text}}>{d.name}</span></div>
                      <div style={{fontSize:12,color:C.muted}}>画像{imgs.length}枚保存中</div>
                    </div>
                    <div style={{width:22,height:22,borderRadius:"50%",border:`2px solid ${sel?C.accent:C.muted}`,background:sel?C.accent:"transparent",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
                      {sel&&<span style={{color:"#000",fontSize:13,fontWeight:900}}>✓</span>}
                    </div>
                  </div>
                );
              })}
            </div>
            <div style={{display:"flex",gap:8}}>
              <button onClick={onCancel} style={{flex:1,padding:"10px 0",borderRadius:8,border:`1px solid ${C.border}`,background:"transparent",color:C.muted,cursor:"pointer",fontSize:13}}>キャンセル</button>
              <button onClick={()=>baseId&&setStep("name")} style={{flex:2,padding:"10px 0",borderRadius:8,border:"none",background:baseId?`linear-gradient(135deg,${C.accent},${C.accentDim})`:"#1e2d4a",color:baseId?"#000":C.muted,fontWeight:800,cursor:baseId?"pointer":"default",fontSize:13}}>次へ →</button>
            </div>
          </>
        ):(
          <>
            <div style={{fontWeight:800,fontSize:15,marginBottom:4}}>統合後の名前を入力</div>
            <div style={{fontSize:12,color:C.muted,marginBottom:12}}>ベース：{selDecks.find(d=>d.id===baseId)?.name}</div>
            <input placeholder="統合後のデッキ名" value={newName} onChange={e=>setNewName(e.target.value)} autoFocus style={{...inputStyle,marginBottom:14}}/>
            <div style={{display:"flex",gap:8}}>
              <button onClick={()=>setStep("base")} style={{flex:1,padding:"10px 0",borderRadius:8,border:`1px solid ${C.border}`,background:"transparent",color:C.muted,cursor:"pointer",fontSize:13}}>← 戻る</button>
              <button onClick={()=>newName.trim()&&onMerge(selectedIds,newName.trim(),baseId)} style={{flex:2,padding:"10px 0",borderRadius:8,border:"none",background:newName.trim()?`linear-gradient(135deg,${C.accent},${C.accentDim})`:"#1e2d4a",color:newName.trim()?"#000":C.muted,fontWeight:800,cursor:newName.trim()?"pointer":"default",fontSize:13}}>統合する</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function ColorPicker({colors,onChange}) {
  return (
    <div style={{display:"flex",flexWrap:"wrap",gap:6}}>
      {DECK_COLORS.map(c=>{
        const sel=colors.includes(c.id), isRainbow=c.id==="rainbow";
        const toggle=()=>{ if(isRainbow){onChange(sel?[]:["rainbow"]);}else{const w=colors.filter(x=>x!=="rainbow"&&x!==c.id);onChange(sel?w:[...w,c.id]);} };
        return <button key={c.id} onClick={toggle} style={{display:"flex",alignItems:"center",gap:5,padding:"5px 10px",borderRadius:20,border:`2px solid ${sel?"#fff":C.border}`,background:sel?C.surface:"transparent",color:sel?C.text:C.muted,cursor:"pointer",fontSize:12,fontWeight:sel?700:400}}>
          {isRainbow?<div style={{width:11,height:11,borderRadius:"50%",background:"linear-gradient(135deg,#ef4444,#eab308,#22c55e,#3b82f6,#a855f7)",flexShrink:0}}/>:<div style={{width:11,height:11,borderRadius:"50%",background:c.hex,flexShrink:0,border:c.id==="white"?"1px solid #555":"none"}}/>}
          {c.label}
        </button>;
      })}
    </div>
  );
}

function DeckDetailModal({ deck, deckStats, inputStyle, onClose, onSave, onDelete, allDecks=[], deckImages=[], onSaveImage, onDeleteImage, onMoveImage, onSetCurrentImage }) {
  const [form, setForm] = useState({ name:deck.name||"", colors:deck.colors||[], url:deck.url||"", notes:deck.notes||"", parentId:deck.parentId||"", maxImages:deck.maxImages??10 });
  const [newImageData, setNewImageData] = useState(null);
  const [currentImageId, setCurrentImageId] = useState(deck.currentImageId||null);
  useEffect(()=>{ const prev=document.body.style.overflow; document.body.style.overflow="hidden"; return()=>{ document.body.style.overflow=prev; }; },[]);
  const thisImages = deckImages.filter(i=>i.deckId===deck.id).sort((a,b)=>b.createdAt.localeCompare(a.createdAt));
  const set = patch => setForm(f=>({...f,...patch}));
  const ds = deckStats || {};
  return (
    <div style={{position:"fixed",inset:0,background:"#000b",display:"flex",alignItems:"flex-end",zIndex:200,overflow:"hidden",touchAction:"none"}}>
      <div style={{background:C.card,borderRadius:"16px 16px 0 0",width:"100%",maxWidth:600,margin:"0 auto",maxHeight:"92vh",overflowY:"auto"}}>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"20px 18px",borderBottom:`1px solid ${C.border}`}}>
          <button onClick={onClose} style={{background:C.surface,border:`1px solid ${C.border}`,color:C.text,cursor:"pointer",fontSize:16,fontWeight:700,padding:"8px 16px",borderRadius:8}}>← 戻る</button>
          <span style={{fontWeight:800,fontSize:15}}>{deck.name}</span>
          <button onClick={()=>onSave(form)} style={{background:`linear-gradient(135deg,${C.accent},${C.accentDim})`,color:"#000",border:"none",borderRadius:8,padding:"8px 16px",fontWeight:800,fontSize:14,cursor:"pointer"}}>保存する</button>
        </div>
        {/* 現在の画像を大きく表示 */}
        {(thisImages.find(i=>i.id===currentImageId)||thisImages[0])&&<div style={{position:"relative",width:"100%",background:C.surface}}><img src={(thisImages.find(i=>i.id===currentImageId)||thisImages[0]).imageData} alt="" style={{width:"100%",maxHeight:220,objectFit:"contain",display:"block"}}/><div style={{position:"absolute",bottom:8,left:8,background:"#000a",borderRadius:6,padding:"3px 8px",fontSize:11,color:"#fff"}}>現在の画像</div></div>}
        <div style={{padding:18,display:"flex",flexDirection:"column",gap:14}}>
          {/* 画像管理 */}
          <div>
            <div style={{fontSize:11,color:C.muted,marginBottom:6}}>デッキ画像（{thisImages.length}枚保存中 / 上限：{form.maxImages===0?"無制限":form.maxImages+"枚"}）</div>
            <label style={{display:"flex",alignItems:"center",justifyContent:"center",borderRadius:10,border:`1.5px dashed ${newImageData?C.accent:C.border}`,overflow:"hidden",cursor:"pointer",minHeight:72,background:C.surface,marginBottom:8}}>
              {newImageData?<img src={newImageData} alt="" style={{width:"100%",maxHeight:140,objectFit:"contain"}}/>:<span style={{color:C.muted,fontSize:13,padding:16}}>📷 新しい画像を追加</span>}
              <input type="file" accept="image/*" style={{display:"none"}} onChange={e=>{const file=e.target.files[0];if(!file)return;const reader=new FileReader();reader.onload=ev=>setNewImageData(ev.target.result);reader.readAsDataURL(file);}}/>
            </label>
            {newImageData&&(
              <div style={{display:"flex",gap:8,marginBottom:8}}>
                <button onClick={()=>{if(onSaveImage){const newId=onSaveImage(deck.id,newImageData);if(newId)setCurrentImageId(newId);}setNewImageData(null);}} style={{flex:2,padding:"8px 0",borderRadius:8,background:`linear-gradient(135deg,${C.accent},${C.accentDim})`,color:"#000",border:"none",fontWeight:800,cursor:"pointer",fontSize:13}}>保存する</button>
                <button onClick={()=>setNewImageData(null)} style={{flex:1,padding:"8px 0",borderRadius:8,background:"transparent",border:`1px solid ${C.border}`,color:C.muted,cursor:"pointer",fontSize:13}}>キャンセル</button>
              </div>
            )}
            {thisImages.length>0&&(
              <div style={{display:"flex",flexWrap:"wrap",gap:8,marginBottom:8}}>
                {thisImages.map(img=>(
                  <div key={img.id} style={{position:"relative",width:76,borderRadius:8,overflow:"hidden",border:`2px solid ${img.id===currentImageId?C.accent:C.border}`}}>
                    <img src={img.imageData} alt="" style={{width:"100%",height:76,objectFit:"cover",display:"block"}}/>
                    {img.id===currentImageId&&<div style={{position:"absolute",top:2,left:2,background:C.accent,borderRadius:3,padding:"1px 4px",fontSize:9,color:"#000",fontWeight:900}}>現在</div>}
                    <div style={{display:"flex",gap:2,padding:"3px 4px",background:"rgba(0,0,0,0.65)"}}>
                      {img.id!==currentImageId&&<button onClick={()=>{setCurrentImageId(img.id);onSetCurrentImage&&onSetCurrentImage(deck.id,img.id);}} style={{flex:1,padding:"2px 0",fontSize:9,borderRadius:3,border:"none",background:C.accent,color:"#000",cursor:"pointer",fontWeight:700}}>使用</button>}
                      <button onClick={()=>onDeleteImage&&onDeleteImage(img.id,deck.id)} style={{flex:1,padding:"2px 0",fontSize:9,borderRadius:3,border:"none",background:"#ff4444",color:"#fff",cursor:"pointer"}}>削除</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
            <div style={{display:"flex",alignItems:"center",gap:8}}>
              <span style={{fontSize:12,color:C.muted,flex:1}}>保存上限</span>
              <button onClick={()=>set({maxImages:Math.max(0,form.maxImages-1)})} style={{width:28,height:28,borderRadius:6,border:`1px solid ${C.border}`,background:C.surface,color:C.text,cursor:"pointer",fontSize:16,lineHeight:1}}>−</button>
              <span style={{fontSize:14,fontWeight:700,minWidth:36,textAlign:"center"}}>{form.maxImages===0?"∞":form.maxImages}</span>
              <button onClick={()=>set({maxImages:form.maxImages+1})} style={{width:28,height:28,borderRadius:6,border:`1px solid ${C.border}`,background:C.surface,color:C.text,cursor:"pointer",fontSize:16,lineHeight:1}}>＋</button>
              {form.maxImages!==0?<button onClick={()=>set({maxImages:0})} style={{padding:"3px 8px",borderRadius:6,border:`1px solid ${C.border}`,background:"transparent",color:C.muted,cursor:"pointer",fontSize:11}}>無制限</button>:<button onClick={()=>set({maxImages:10})} style={{padding:"3px 8px",borderRadius:6,border:`1px solid ${C.border}`,background:"transparent",color:C.muted,cursor:"pointer",fontSize:11}}>制限あり</button>}
            </div>
          </div>
          <div><div style={{fontSize:11,color:C.muted,marginBottom:6}}>デッキ名</div><input value={form.name} onChange={e=>set({name:e.target.value})} style={inputStyle}/></div>
          <div><div style={{fontSize:11,color:C.muted,marginBottom:6}}>カラー</div><ColorPicker colors={form.colors} onChange={colors=>set({colors})}/></div>
          <div>
            <div style={{fontSize:11,color:C.muted,marginBottom:6}}>親デッキ（派生元）</div>
            <select value={form.parentId||""} onChange={e=>set({parentId:e.target.value})} style={{...inputStyle,fontSize:14}}>
              <option value="">なし</option>
              {allDecks.filter(d=>d.id!==deck.id).map(d=><option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          </div>
          <div><div style={{fontSize:11,color:C.muted,marginBottom:6}}>デッキURL</div><input placeholder="https://..." value={form.url} onChange={e=>set({url:e.target.value})} style={inputStyle}/>{form.url&&<a href={form.url} target="_blank" rel="noreferrer" style={{display:"block",marginTop:6,fontSize:12,color:C.accent,wordBreak:"break-all"}}>{form.url}</a>}</div>
          <div><div style={{fontSize:11,color:C.muted,marginBottom:6}}>メモ</div><textarea value={form.notes} onChange={e=>set({notes:e.target.value})} placeholder="（任意）" style={{...inputStyle,resize:"vertical",minHeight:60}}/></div>
          <div style={{background:C.surface,borderRadius:10,padding:12}}>
            <div style={{fontSize:11,color:C.muted,marginBottom:8}}>成績</div>
            <div style={{display:"flex",gap:14,fontSize:13,color:C.muted}}>
              <span>対戦: <strong style={{color:C.text}}>{ds.total||0}</strong></span>
              <span>勝: <strong style={{color:C.win}}>{ds.wins||0}</strong></span>
              <span>負: <strong style={{color:C.lose}}>{ds.loses||0}</strong></span>
              <span>勝率: <strong style={{color:(ds.winRate||0)>=50?C.win:C.lose}}>{ds.winRate||0}%</strong></span>
            </div>
          </div>
          <button onClick={onDelete} style={{width:"100%",padding:"13px 0",borderRadius:10,border:"none",background:"#ff4444",color:"#fff",fontWeight:800,fontSize:15,cursor:"pointer"}}>削除</button>
        </div>
      </div>
    </div>
  );
}

function OppCard({ name, checked, onToggle, showStats, w, l, dr, t, wr2, onRename, onDelete, inputStyle }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(name);
  const save = () => { const n=draft.trim(); if(n&&n!==name) onRename(n); setEditing(false); };
  return (
    <div onClick={()=>!editing&&onToggle()} style={{background:C.card,border:`1.5px solid ${checked?C.accent:C.border}`,borderRadius:12,padding:14,cursor:"pointer"}}>
      <div style={{display:"flex",alignItems:"center",gap:10}}>
        <div style={{width:20,height:20,borderRadius:4,border:`2px solid ${checked?C.accent:C.muted}`,background:checked?C.accent:"transparent",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
          {checked&&<span style={{color:"#000",fontSize:11,fontWeight:900}}>✓</span>}
        </div>
        {editing?(
          <div onClick={e=>e.stopPropagation()} style={{display:"flex",gap:6,flex:1}}>
            <input value={draft} onChange={e=>setDraft(e.target.value)} onKeyDown={e=>{if(e.key==="Enter")save();if(e.key==="Escape")setEditing(false);}} autoFocus style={{...inputStyle,flex:1,fontSize:15,padding:"5px 10px"}}/>
            <button onClick={save} style={{background:C.accent,color:"#000",border:"none",borderRadius:6,padding:"5px 12px",fontWeight:800,cursor:"pointer",fontSize:12}}>保存</button>
            <button onClick={()=>setEditing(false)} style={{background:"transparent",border:`1px solid ${C.border}`,borderRadius:6,padding:"5px 10px",color:C.muted,cursor:"pointer",fontSize:12}}>✕</button>
          </div>
        ):(
          <>
            <span style={{fontWeight:800,fontSize:15,flex:1}}>{name}</span>
            {showStats&&t>0&&<span style={{fontWeight:900,color:wr2>=50?C.win:C.lose,fontSize:15,flexShrink:0}}>{wr2}%</span>}
            <button onClick={e=>{e.stopPropagation();setDraft(name);setEditing(true);}} style={{background:"transparent",border:"none",color:C.accent,cursor:"pointer",fontSize:14,padding:"2px 4px",flexShrink:0}}>✏️</button>
            <button onClick={e=>{e.stopPropagation();onDelete&&onDelete(name);}} style={{background:"transparent",border:"none",color:"#ff6b6b",cursor:"pointer",fontSize:14,padding:"2px 4px",flexShrink:0}}>🗑️</button>
          </>
        )}
      </div>
      {showStats&&t>0&&!editing&&(
        <div style={{marginTop:8,paddingLeft:30}}>
          <div style={{display:"flex",borderRadius:4,overflow:"hidden",height:6}}>
            {w>0&&<div style={{flex:w,background:C.win}}/>}
            {dr>0&&<div style={{flex:dr,background:C.draw}}/>}
            {l>0&&<div style={{flex:l,background:C.lose}}/>}
          </div>
          <div style={{fontSize:11,color:C.muted,marginTop:4}}>{t}戦 {w}勝 {l}敗</div>
        </div>
      )}
    </div>
  );
}

function AddOppForm({ newOppName, setNewOppName, onCancel, onAdd, inputStyle }) {
  return (
    <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:12,padding:16,marginBottom:12}}>
      <div style={{fontSize:11,color:C.muted,marginBottom:6}}>デッキ名 *</div>
      <input value={newOppName} onChange={e=>setNewOppName(e.target.value)} onKeyDown={e=>e.key==="Enter"&&onAdd()} placeholder="例: スティラコ" style={{...inputStyle,marginBottom:10}}/>
      <div style={{display:"flex",gap:8}}>
        <button onClick={onCancel} style={{flex:1,padding:"10px 0",borderRadius:8,border:`1px solid ${C.border}`,background:"transparent",color:C.muted,cursor:"pointer",fontSize:13}}>キャンセル</button>
        <button onClick={onAdd} style={{flex:2,background:`linear-gradient(135deg,${C.accent},${C.accentDim})`,color:"#000",border:"none",borderRadius:8,padding:"10px 0",fontWeight:800,cursor:"pointer",fontSize:14}}>追加</button>
      </div>
    </div>
  );
}

function AddMatchTypeInline({ onAdd, matchTypes, inputStyle }) {
  const [draft, setDraft] = useState("");
  const handleAdd = () => { const t=draft.trim(); if(!t||matchTypes.includes(t)) return; onAdd(t); setDraft(""); };
  return (
    <div style={{display:"flex",gap:8,marginTop:10}}>
      <input value={draft} onChange={e=>setDraft(e.target.value)} onKeyDown={e=>e.key==="Enter"&&handleAdd()} placeholder="新しい種類名" style={{...inputStyle,flex:1,fontSize:16,padding:"8px 12px"}}/>
      <button onClick={handleAdd} style={{background:`linear-gradient(135deg,#00d4ff,#0099bb)`,color:"#000",border:"none",borderRadius:8,padding:"8px 16px",fontWeight:800,cursor:"pointer",fontSize:13,whiteSpace:"nowrap"}}>追加</button>
    </div>
  );
}

function normalizeKana(str) { return str.toLowerCase().replace(/[ァ-ン]/g, ch => String.fromCharCode(ch.charCodeAt(0) - 0x60)); }
function levenshtein(a, b) {
  const m=a.length, n=b.length;
  const dp=Array.from({length:m+1},(_,i)=>Array.from({length:n+1},(_,j)=>i===0?j:j===0?i:0));
  for(let i=1;i<=m;i++) for(let j=1;j<=n;j++) dp[i][j]=a[i-1]===b[j-1]?dp[i-1][j-1]:1+Math.min(dp[i-1][j],dp[i][j-1],dp[i-1][j-1]);
  return dp[m][n];
}
function findSimilarPairs(names) {
  const pairs=[];
  for(let i=0;i<names.length;i++) for(let j=i+1;j<names.length;j++){
    const a=names[i], b=names[j], na=normalizeKana(a), nb=normalizeKana(b);
    const dist=levenshtein(na,nb), maxLen=Math.max(na.length,nb.length);
    let reason=null;
    if(dist<=2) reason=`差${dist}文字`;
    else if(maxLen>=5&&dist<=Math.floor(maxLen*0.35)) reason=`差${dist}文字`;
    else if(na.startsWith(nb)||nb.startsWith(na)) reason="前方一致";
    else if(na.includes(nb)||nb.includes(na)) reason="部分一致";
    if(reason) pairs.push([a,b,reason]);
  }
  return pairs;
}

// ボタン部分のみ
function FilterBarTop({ activeFilters, open, setOpen, onReset }) {
  return (
    <div style={{display:"flex",alignItems:"center",gap:8,flex:1}}>
      <button onClick={()=>setOpen(o=>!o)} style={{display:"flex",alignItems:"center",gap:6,padding:"0 12px",height:36,borderRadius:8,border:`1px solid ${activeFilters>0?C.accent:C.border}`,background:activeFilters>0?C.accent+"18":"transparent",color:activeFilters>0?C.accent:C.muted,cursor:"pointer",fontSize:12,fontWeight:activeFilters>0?700:400,whiteSpace:"nowrap"}}>
        🔍 絞り込み{activeFilters>0&&<span style={{background:C.accent,color:"#000",borderRadius:10,padding:"1px 6px",fontSize:11,fontWeight:800,marginLeft:2}}>{activeFilters}</span>}
        <span style={{fontSize:10,marginLeft:2}}>{open?"▲":"▼"}</span>
      </button>
      {activeFilters>0&&<button onClick={onReset} style={{padding:"0 12px",height:36,borderRadius:8,border:`1px solid ${C.border}`,background:"transparent",color:C.muted,cursor:"pointer",fontSize:12,whiteSpace:"nowrap"}}>リセット</button>}
    </div>
  );
}

function FilterBar({ decks, allOpponentNames, opponents, matchTypes, flt, setF, activeFilters, onReset, inputStyle }) {
  const [open, setOpen] = useState(false);
  const toggleArr = (key, val) => setF({ [key]: flt[key].includes(val) ? flt[key].filter(x=>x!==val) : [...flt[key], val] });
  const [openDeckList, setOpenDeckList] = useState(false);
  const [openOppList, setOpenOppList] = useState(false);
  const [openPersonList, setOpenPersonList] = useState(false);
  const chip = (active) => ({ padding:"5px 11px", borderRadius:20, fontSize:12, cursor:"pointer", border:`1.5px solid ${active?C.accent:C.border}`, background:active?C.accent+"22":"transparent", color:active?C.accent:C.muted, fontWeight:active?700:400 });
  const listRow = (label, active) => ({ padding:"10px 14px", cursor:"pointer", fontSize:14, color:active?C.accent:C.text, background:active?C.accent+"18":"transparent", borderBottom:`1px solid ${C.border}`, display:"flex", alignItems:"center", justifyContent:"space-between" });
  const deckLabel = flt.decks.length>0 ? [...decks.filter(d=>flt.decks.includes(d.id)).map(d=>d.name), ...(flt.decks.includes("__no_deck__")?["データなし"]:[])].join("・") : "すべて";
  const oppLabel  = flt.opponents.length>0 ? flt.opponents.join("・") : "すべて";
  // 絞り込み内容のサマリーを生成
  const periodLabel = flt.periodPreset==="today"?"今日":flt.periodPreset==="week"?"今週":flt.periodPreset==="month"?"今月":flt.periodPreset==="year"?"今年":null;
  const summaryItems = [
    ...(periodLabel?[{label:periodLabel,key:"periodPreset"}]:[]),
    ...((flt.dateFrom||flt.dateTo)?[{label:(flt.dateFrom||"")+"〜"+(flt.dateTo||""),key:"daterange"}]:[]),
    ...decks.filter(d=>flt.decks.includes(d.id)).map(d=>({label:d.name,key:"deck_"+d.id})),
    ...(flt.decks.includes("__no_deck__")?[{label:"データなし",key:"no_deck"}]:[]),
    ...flt.opponents.map(n=>({label:"vs "+n,key:"opp_"+n})),
    ...flt.matchTypes.map(t=>({label:t,key:"mt_"+t})),
    ...flt.turns.map(t=>({label:t==="first"?"先攻":t==="second"?"後攻":"未設定",key:"turn_"+t})),
    ...flt.results.map(r=>({label:r==="win"?"勝":r==="lose"?"敗":"分",key:"result_"+r})),
  ];

  return (
    <div>
      <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:open?6:0}}>
        <FilterBarTop activeFilters={activeFilters} open={open} setOpen={setOpen} onReset={onReset}/>
      </div>
      {!open&&summaryItems.length>0&&(
        <div style={{display:"flex",flexWrap:"wrap",gap:4,marginBottom:8,marginTop:2}}>
          {summaryItems.map(item=>(
            <span key={item.key} style={{background:C.accent+"22",color:C.accent,border:`1px solid ${C.accent}44`,borderRadius:6,padding:"3px 8px",fontSize:11,fontWeight:700}}>{item.label}</span>
          ))}
        </div>
      )}
      {open&&(
        <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:12,padding:12,display:"flex",flexDirection:"column",gap:12}}>
          <div>
            <div style={{fontSize:11,color:C.muted,marginBottom:6}}>期間（プリセット）</div>
            <div style={{display:"flex",flexWrap:"wrap",gap:5}}>
              {[["all","全期間"],["today","今日"],["week","今週"],["month","今月"],["year","今年"]].map(([v,l])=>(
                <button key={v} onClick={()=>setF({periodPreset:v,dateFrom:"",dateTo:""})} style={chip(flt.periodPreset===v&&!flt.dateFrom&&!flt.dateTo)}>{l}</button>
              ))}
            </div>
          </div>
          <div>
            <div style={{fontSize:11,color:C.muted,marginBottom:6}}>期間（個別指定）</div>
            <div style={{display:"flex",alignItems:"center",gap:6}}>
              <input type="date" value={flt.dateFrom} onChange={e=>setF({dateFrom:e.target.value,periodPreset:"all"})} style={{...inputStyle,flex:1,padding:"7px 10px",fontSize:16}} />
              <span style={{color:C.muted,fontSize:12,flexShrink:0}}>〜</span>
              <input type="date" value={flt.dateTo} onChange={e=>setF({dateTo:e.target.value,periodPreset:"all"})} style={{...inputStyle,flex:1,padding:"7px 10px",fontSize:16}} />
              {(flt.dateFrom||flt.dateTo)&&<button onClick={()=>setF({dateFrom:"",dateTo:""})} style={{color:C.muted,background:"transparent",border:"none",cursor:"pointer",fontSize:16,flexShrink:0}}>✕</button>}
            </div>
          </div>
          <div style={{position:"relative"}}>
            <div style={{fontSize:11,color:C.muted,marginBottom:6}}>使用デッキ{flt.decks.length>0&&<span style={{color:C.accent,marginLeft:4}}>（{flt.decks.length}件）</span>}</div>
            <div onClick={()=>setOpenDeckList(o=>!o)} style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"8px 12px",borderRadius:8,border:`1px solid ${openDeckList?C.accent:C.border}`,background:C.surface,cursor:"pointer",minHeight:38}}>
              <span style={{fontSize:13,color:flt.decks.length>0?C.text:C.muted,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",flex:1}}>{deckLabel}</span>
              <span style={{color:C.muted,fontSize:11,marginLeft:6,flexShrink:0}}>{openDeckList?"▲":"▼"}</span>
            </div>
            {openDeckList&&<div style={{position:"absolute",top:"100%",left:0,right:0,background:C.card,border:`1px solid ${C.accent}`,borderRadius:8,zIndex:300,maxHeight:200,overflowY:"auto",boxShadow:"0 8px 24px #000a",marginTop:3}}>
              {decks.length===0?<div style={{padding:"12px 14px",fontSize:13,color:C.muted}}>登録がありません</div>
              :<>{decks.map(d=>{const sel=flt.decks.includes(d.id); return <div key={d.id} onMouseDown={()=>toggleArr("decks",d.id)} style={listRow(d.name,sel)}><span>{d.name}</span>{sel&&<span style={{color:C.accent,fontWeight:800,fontSize:13}}>✓</span>}</div>;})}
                <div onMouseDown={()=>toggleArr("decks","__no_deck__")} style={listRow("データなし",flt.decks.includes("__no_deck__"))}><span style={{color:C.muted}}>データなし</span>{flt.decks.includes("__no_deck__")&&<span style={{color:C.accent,fontWeight:800,fontSize:13}}>✓</span>}</div>
              </>}
            </div>}
          </div>
          <div style={{position:"relative"}}>
            <div style={{fontSize:11,color:C.muted,marginBottom:6}}>相手デッキ{flt.opponents.length>0&&<span style={{color:C.accent,marginLeft:4}}>（{flt.opponents.length}件）</span>}</div>
            <div onClick={()=>setOpenOppList(o=>!o)} style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"8px 12px",borderRadius:8,border:`1px solid ${openOppList?C.accent:C.border}`,background:C.surface,cursor:"pointer",minHeight:38}}>
              <span style={{fontSize:13,color:flt.opponents.length>0?C.text:C.muted,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",flex:1}}>{oppLabel}</span>
              <span style={{color:C.muted,fontSize:11,marginLeft:6,flexShrink:0}}>{openOppList?"▲":"▼"}</span>
            </div>
            {openOppList&&<div style={{position:"absolute",top:"100%",left:0,right:0,background:C.card,border:`1px solid ${C.accent}`,borderRadius:8,zIndex:300,maxHeight:200,overflowY:"auto",boxShadow:"0 8px 24px #000a",marginTop:3}}>
              {allOpponentNames.length===0?<div style={{padding:"12px 14px",fontSize:13,color:C.muted}}>記録がありません</div>
              :allOpponentNames.map(n=>{const sel=flt.opponents.includes(n); return <div key={n} onMouseDown={()=>toggleArr("opponents",n)} style={listRow(n,sel)}><span>{n}</span>{sel&&<span style={{color:C.accent,fontWeight:800,fontSize:13}}>✓</span>}</div>;})}
            </div>}
          </div>
          {opponents&&opponents.length>0&&(
            <div style={{position:"relative"}}>
              <div style={{fontSize:11,color:C.muted,marginBottom:6}}>対戦相手{(flt.opponentPersons||[]).length>0&&<span style={{color:C.accent,marginLeft:4}}>（{(flt.opponentPersons||[]).length}件）</span>}</div>
              <div onClick={()=>setOpenPersonList(o=>!o)} style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"8px 12px",borderRadius:8,border:`1px solid ${openPersonList?C.accent:C.border}`,background:C.surface,cursor:"pointer",minHeight:38}}>
                <span style={{fontSize:13,color:(flt.opponentPersons||[]).length>0?C.text:C.muted}}>{(flt.opponentPersons||[]).length>0?(flt.opponentPersons||[]).join("・"):"すべて"}</span>
                <span style={{color:C.muted,fontSize:11,marginLeft:6,flexShrink:0}}>{openPersonList?"▲":"▼"}</span>
              </div>
              {openPersonList&&<div style={{position:"absolute",top:"100%",left:0,right:0,background:C.card,border:`1px solid ${C.accent}`,borderRadius:8,zIndex:300,maxHeight:200,overflowY:"auto",boxShadow:"0 8px 24px #000a",marginTop:3}}>
                {opponents.map(op=>{const sel=(flt.opponentPersons||[]).includes(op); return <div key={op} onMouseDown={()=>{const cur=flt.opponentPersons||[]; setF({opponentPersons:sel?cur.filter(x=>x!==op):[...cur,op]});}} style={listRow(op,sel)}><span>{op}</span>{sel&&<span style={{color:C.accent,fontWeight:800,fontSize:13}}>✓</span>}</div>;})}
              </div>}
            </div>
          )}
          <div>
            <div style={{fontSize:11,color:C.muted,marginBottom:6}}>対戦種類（複数選択可）</div>
            <div style={{display:"flex",flexWrap:"wrap",gap:5}}>
              {matchTypes.map(t=><button key={t} onClick={()=>toggleArr("matchTypes",t)} style={chip(flt.matchTypes.includes(t))}>{t}</button>)}
            </div>
          </div>
          <div>
            <div style={{fontSize:11,color:C.muted,marginBottom:6}}>先攻・後攻</div>
            <div style={{display:"flex",gap:5}}>
              {[["first","⚡ 先攻"],["second","🌙 後攻"],["","未設定"]].map(([v,l])=>(
                <button key={v} onClick={()=>toggleArr("turns",v)} style={chip(flt.turns.includes(v))}>{l}</button>
              ))}
            </div>
          </div>
          <div>
            <div style={{fontSize:11,color:C.muted,marginBottom:6}}>勝敗</div>
            <div style={{display:"flex",gap:5}}>
              {[["win","🏆 勝"],["lose","💀 敗"],["draw","🤝 分"]].map(([v,l])=>(
                <button key={v} onClick={()=>toggleArr("results",v)} style={chip(flt.results.includes(v))}>{l}</button>
              ))}
            </div>
          </div>
          <div>
            <div style={{fontSize:11,color:C.muted,marginBottom:6}}>フラグ</div>
            <div style={{display:"flex",gap:5}}>
              <button onClick={()=>setF({lucky:!flt.lucky})} style={chip(flt.lucky)}>🍀 運あり</button>
              <button onClick={()=>setF({unlucky:!flt.unlucky})} style={chip(flt.unlucky)}>💀 不運あり</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function FilterBarPanel({ decks, allOpponentNames, opponents, matchTypes, flt, setF, inputStyle }) {
  const toggleArr = (key, val) => setF({ [key]: flt[key].includes(val) ? flt[key].filter(x=>x!==val) : [...flt[key], val] });
  const [openDeckList, setOpenDeckList] = useState(false);
  const [openOppList, setOpenOppList] = useState(false);
  const chip = (active) => ({ padding:"5px 11px", borderRadius:20, fontSize:12, cursor:"pointer", border:`1.5px solid ${active?C.accent:C.border}`, background:active?C.accent+"22":"transparent", color:active?C.accent:C.muted, fontWeight:active?700:400 });
  const listRow = (active) => ({ padding:"10px 14px", cursor:"pointer", fontSize:14, color:active?C.accent:C.text, background:active?C.accent+"18":"transparent", borderBottom:`1px solid ${C.border}`, display:"flex", alignItems:"center", justifyContent:"space-between" });
  const deckLabel = flt.decks.length>0 ? [...decks.filter(d=>flt.decks.includes(d.id)).map(d=>d.name), ...(flt.decks.includes("__no_deck__")?["データなし"]:[])].join("・") : "すべて";
  const oppLabel = flt.opponents.length>0 ? flt.opponents.join("・") : "すべて";
  return (
    <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:12,padding:12,display:"flex",flexDirection:"column",gap:12,marginBottom:4}}>
      <div>
        <div style={{fontSize:11,color:C.muted,marginBottom:6}}>期間（プリセット）</div>
        <div style={{display:"flex",flexWrap:"wrap",gap:5}}>
          {[["all","全期間"],["today","今日"],["week","今週"],["month","今月"],["year","今年"]].map(([v,l])=>(
            <button key={v} onClick={()=>setF({periodPreset:v,dateFrom:"",dateTo:""})} style={chip(flt.periodPreset===v&&!flt.dateFrom&&!flt.dateTo)}>{l}</button>
          ))}
        </div>
      </div>
      <div>
        <div style={{fontSize:11,color:C.muted,marginBottom:6}}>期間（個別指定）</div>
        <div style={{display:"flex",alignItems:"center",gap:6}}>
          <input type="date" value={flt.dateFrom} onChange={e=>setF({dateFrom:e.target.value,periodPreset:"all"})} style={{...inputStyle,flex:1,padding:"7px 10px",fontSize:16}}/>
          <span style={{color:C.muted,fontSize:12,flexShrink:0}}>〜</span>
          <input type="date" value={flt.dateTo} onChange={e=>setF({dateTo:e.target.value,periodPreset:"all"})} style={{...inputStyle,flex:1,padding:"7px 10px",fontSize:16}}/>
          {(flt.dateFrom||flt.dateTo)&&<button onClick={()=>setF({dateFrom:"",dateTo:""})} style={{color:C.muted,background:"transparent",border:"none",cursor:"pointer",fontSize:16,flexShrink:0}}>✕</button>}
        </div>
      </div>
      <div style={{position:"relative"}}>
        <div style={{fontSize:11,color:C.muted,marginBottom:6}}>使用デッキ{flt.decks.length>0&&<span style={{color:C.accent,marginLeft:4}}>（{flt.decks.length}件）</span>}</div>
        <div onClick={()=>setOpenDeckList(o=>!o)} style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"8px 12px",borderRadius:8,border:`1px solid ${openDeckList?C.accent:C.border}`,background:C.surface,cursor:"pointer",minHeight:38}}>
          <span style={{fontSize:13,color:flt.decks.length>0?C.text:C.muted,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",flex:1}}>{deckLabel}</span>
          <span style={{color:C.muted,fontSize:11,marginLeft:6,flexShrink:0}}>{openDeckList?"▲":"▼"}</span>
        </div>
        {openDeckList&&<div style={{position:"absolute",top:"100%",left:0,right:0,background:C.card,border:`1px solid ${C.accent}`,borderRadius:8,zIndex:300,maxHeight:200,overflowY:"auto",boxShadow:"0 8px 24px #000a",marginTop:3}}>
          {decks.length===0?<div style={{padding:"12px 14px",fontSize:13,color:C.muted}}>登録がありません</div>
          :<>{decks.map(d=>{const sel=flt.decks.includes(d.id);return <div key={d.id} onMouseDown={()=>toggleArr("decks",d.id)} style={listRow(sel)}><span>{d.name}</span>{sel&&<span style={{color:C.accent,fontWeight:800,fontSize:13}}>✓</span>}</div>;})}
            <div onMouseDown={()=>toggleArr("decks","__no_deck__")} style={listRow(flt.decks.includes("__no_deck__"))}><span style={{color:C.muted}}>データなし</span>{flt.decks.includes("__no_deck__")&&<span style={{color:C.accent,fontWeight:800,fontSize:13}}>✓</span>}</div>
          </>}
        </div>}
      </div>
      <div style={{position:"relative"}}>
        <div style={{fontSize:11,color:C.muted,marginBottom:6}}>相手デッキ{flt.opponents.length>0&&<span style={{color:C.accent,marginLeft:4}}>（{flt.opponents.length}件）</span>}</div>
        <div onClick={()=>setOpenOppList(o=>!o)} style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"8px 12px",borderRadius:8,border:`1px solid ${openOppList?C.accent:C.border}`,background:C.surface,cursor:"pointer",minHeight:38}}>
          <span style={{fontSize:13,color:flt.opponents.length>0?C.text:C.muted,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",flex:1}}>{oppLabel}</span>
          <span style={{color:C.muted,fontSize:11,marginLeft:6,flexShrink:0}}>{openOppList?"▲":"▼"}</span>
        </div>
        {openOppList&&<div style={{position:"absolute",top:"100%",left:0,right:0,background:C.card,border:`1px solid ${C.accent}`,borderRadius:8,zIndex:300,maxHeight:200,overflowY:"auto",boxShadow:"0 8px 24px #000a",marginTop:3}}>
          {(allOpponentNames||[]).length===0?<div style={{padding:"12px 14px",fontSize:13,color:C.muted}}>記録がありません</div>
          :(allOpponentNames||[]).map(n=>{const sel=flt.opponents.includes(n);return <div key={n} onMouseDown={()=>toggleArr("opponents",n)} style={listRow(sel)}><span>{n}</span>{sel&&<span style={{color:C.accent,fontWeight:800,fontSize:13}}>✓</span>}</div>;})}
        </div>}
      </div>
      <div>
        <div style={{fontSize:11,color:C.muted,marginBottom:6}}>対戦種類</div>
        <div style={{display:"flex",flexWrap:"wrap",gap:5}}>
          {matchTypes.map(t=><button key={t} onClick={()=>toggleArr("matchTypes",t)} style={chip(flt.matchTypes.includes(t))}>{t}</button>)}
        </div>
      </div>
      <div>
        <div style={{fontSize:11,color:C.muted,marginBottom:6}}>先攻・後攻</div>
        <div style={{display:"flex",gap:5}}>
          {[["first","⚡ 先攻"],["second","🌙 後攻"],["","未設定"]].map(([v,l])=>(<button key={v} onClick={()=>toggleArr("turns",v)} style={chip(flt.turns.includes(v))}>{l}</button>))}
        </div>
      </div>
      <div>
        <div style={{fontSize:11,color:C.muted,marginBottom:6}}>勝敗</div>
        <div style={{display:"flex",gap:5}}>
          {[["win","🏆 勝"],["lose","💀 敗"],["draw","🤝 分"]].map(([v,l])=>(<button key={v} onClick={()=>toggleArr("results",v)} style={chip(flt.results.includes(v))}>{l}</button>))}
        </div>
      </div>
      <div>
        <div style={{fontSize:11,color:C.muted,marginBottom:6}}>フラグ</div>
        <div style={{display:"flex",gap:5}}>
          <button onClick={()=>setF({lucky:!flt.lucky})} style={chip(flt.lucky)}>🍀 運あり</button>
          <button onClick={()=>setF({unlucky:!flt.unlucky})} style={chip(flt.unlucky)}>💀 不運あり</button>
        </div>
      </div>
    </div>
  );
}

export default function App() {
  const [st, setSt] = useState(load);
  const [idbLoading, setIdbLoading] = useState(true);
  const [tab, setTab] = useState(()=>{ try{const d=JSON.parse(localStorage.getItem(STORAGE_KEY)||"{}");return d.uiPrefs?.tab||"matches";}catch{return "matches";} });
  const switchTab = t => { setTab(t); setDisplayCount(20); };
  const [screen, setScreen] = useState(null);
  const [showAddDeck, setShowAddDeck] = useState(false);
  const [showMerge, setShowMerge] = useState(false);
  const [mergeInitial, setMergeInitial] = useState([]);
  const [newDeck, setNewDeck] = useState({name:"",colors:[],notes:"",url:"",image:"",parentId:""});
  const [flt, setFlt] = useState(()=>{try{const p=JSON.parse(localStorage.getItem(STORAGE_KEY)||"{}").uiPrefs?.flt;if(p)return p;}catch{} return {decks:[],opponents:[],opponentPersons:[],matchTypes:[],turns:[],results:[],lucky:false,unlucky:false,periodPreset:"all",dateFrom:"",dateTo:""};});
  const [importResult, setImportResult] = useState(null);
  const [deckDetail, setDeckDetail] = useState(null);
  const [deckView, setDeckView] = useState(()=>{ try{const d=JSON.parse(localStorage.getItem(STORAGE_KEY)||'{}');return d.uiPrefs?.deckView||'mine';}catch{return 'mine';} });
  const [showSimilar, setShowSimilar] = useState(false);
  const [matchDetail, setMatchDetail] = useState(null);
  const [carryOver, setCarryOver] = useState(true);
  const [bulkMode, setBulkMode] = useState(false);
  const [bulkSelected, setBulkSelected] = useState([]);
  const [backupMode, setBackupMode] = useState(null);
  const [backupText, setBackupText] = useState("");
  const [restoreText, setRestoreText] = useState("");
  const [showDeckStats, setShowDeckStats] = useState(()=>{ try{const d=JSON.parse(localStorage.getItem(STORAGE_KEY)||"{}");return d.uiPrefs?.showDeckStats||false;}catch{return false;} });
  const [filterBarOpen, setFilterBarOpen] = useState(false);
  const [displayCount, setDisplayCount] = useState(20);
  const [showLife, setShowLife] = useState(false);
  const [marker, setMarker] = useState(0);
  const [toast, setToast] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleteOppTarget, setDeleteOppTarget] = useState(null);
  const [deleteDeckTarget, setDeleteDeckTarget] = useState(null);
  const showToast = (msg) => { setToast(msg); setTimeout(()=>setToast(null), 1000); };
  const [showNotes, setShowNotes] = useState(()=>{ try{const d=JSON.parse(localStorage.getItem(STORAGE_KEY)||"{}");return d.uiPrefs?.showNotes!==false;}catch{return true;} });
  const [checkedOpps, setCheckedOpps] = useState([]);
  const [checkedDecks, setCheckedDecks] = useState([]);
  const [showAddOpp, setShowAddOpp] = useState(false);
  const [showMergeDeck, setShowMergeDeck] = useState(false);
  const [deckSearch, setDeckSearch] = useState("");
  const [deckSort, setDeckSort] = useState(()=>{try{return JSON.parse(localStorage.getItem(STORAGE_KEY)||"{}").uiPrefs?.deckSort||"recent";}catch{return "recent";}});
  const [deckImgPreview, setDeckImgPreview] = useState(null);
  const [oppSort, setOppSort] = useState(()=>{try{return JSON.parse(localStorage.getItem(STORAGE_KEY)||"{}").uiPrefs?.oppSort||"name";}catch{return "name";}});
  const [showActiveOnly, setShowActiveOnly] = useState(()=>{try{return JSON.parse(localStorage.getItem(STORAGE_KEY)||"{}").uiPrefs?.showActiveOnly||false;}catch{return false;}});
  const [newOppName, setNewOppName] = useState("");
  const [statVis, setStatVis] = useState(()=>{ try{const p=JSON.parse(localStorage.getItem(STORAGE_KEY)||"{}").uiPrefs?.statVis||{};return{overall:p.overall!==false,winTrend:p.winTrend!==false,turns:p.turns!==false,deckBar:p.deckBar!==false,oppBar:p.oppBar!==false,deckPie:p.deckPie!==false,oppPie:p.oppPie!==false};}catch{return{overall:true,winTrend:true,turns:true,deckBar:true,oppBar:true,deckPie:true,oppPie:true};} });
  const [deleteConfirmType, setDeleteConfirmType] = useState(null);

  const setF = patch => { setFlt(f=>({...f,...patch})); setDisplayCount(20); };
  const resetFilters = () => setFlt({ decks:[], opponents:[], opponentPersons:[], matchTypes:[], turns:[], results:[], lucky:false, unlucky:false, periodPreset:"all", dateFrom:"", dateTo:"" });

  useEffect(()=>{ save(st); }, [st]);

  // IDBからdeckImagesを起動時に読み込む
  useEffect(()=>{
    idbGetAll().then(imgs=>{
      if(imgs.length>0) setSt(s=>({...s,deckImages:imgs}));
    }).catch(()=>{}).finally(()=>setIdbLoading(false));
  },[]);
  useEffect(()=>{
    try{
      const d=JSON.parse(localStorage.getItem(STORAGE_KEY)||"{}");
      d.uiPrefs={tab,deckView,showDeckStats,showNotes,statVis,deckSort,oppSort,showActiveOnly,flt};
      localStorage.setItem(STORAGE_KEY,JSON.stringify(d));
    }catch{}
  },[tab,deckView,showDeckStats,showNotes,statVis,deckSort,oppSort,showActiveOnly,flt]);
  useEffect(()=>{
    if(showAddDeck){ document.body.style.overflow="hidden"; }
    else { document.body.style.overflow=""; }
    return()=>{ document.body.style.overflow=""; };
  },[showAddDeck]);
  const _theme = getTheme(st.theme||'blue');
  if (_theme) Object.keys(_theme).forEach(k => { globalC[k] = _theme[k]; });

  const allOpponentNames = Array.from(new Set([...(st.opponentNames||[]), ...st.matches.map(m=>m.opponent).filter(Boolean)])).sort();
  const matchTypes = st.matchTypes || [...DEFAULT_MATCH_TYPES];

  const makeNew = () => {
    const base = { turn:"", result:"", endTurn:null, lucky:false, unlucky:false, notes:"", image:"", deckImage:"", deckUrl:"", opponentPerson:"", date:new Date().toISOString().slice(0,10), deckName:"" };
    return { ...base, deckId:carryOver?(st.prefs.lastDeckId||st.decks[0]?.id||""):(st.decks[0]?.id||""), opponent:carryOver?(st.prefs.lastOpponent||""):"", matchType:carryOver?(st.prefs.lastMatchType||""):"" };
  };
  const makeNewBattle = (lastForm) => ({ deckId:lastForm.deckId, opponent:lastForm.opponent, matchType:lastForm.matchType, opponentPerson:lastForm.opponentPerson, turn:"", result:"win", endTurn:null, lucky:false, unlucky:false, notes:"", image:"", deckImage:"", deckUrl:"", date:new Date().toISOString().slice(0,10) });

  const openAdd = (continueFrom=null, sc=0) => { setDeleteTarget(null); const base=makeNew(); const form=continueFrom?{...base,deckId:continueFrom.deckId,deckName:continueFrom.deckName||"",opponent:continueFrom.opponent,matchType:continueFrom.matchType,opponentPerson:continueFrom.opponentPerson,date:continueFrom.date,turn:"",result:"",endTurn:null,lucky:false,unlucky:false,notes:"",image:""}:base; setScreen({mode:"add",form,seriesCount:sc}); };
  const openEdit = match => { setDeleteTarget(null);
    const deck = st.decks.find(d => d.id === match.deckId);
    setScreen({ mode:"edit", form:{
      deckId: match.deckId,
      opponent: match.opponent,
      matchType: match.matchType || "",
      turn: match.turn || "",
      result: match.result,
      endTurn: match.endTurn ?? null,
      lucky: match.lucky || false,
      unlucky: match.unlucky || false,
      notes: (match.notes && match.notes !== "null") ? match.notes : "",
      image: match.image || "",
      deckImage: match.deckImage || (st.deckImages||[]).find(i=>i.id===(match.imageId||st.decks.find(d=>d.id===match.deckId)?.currentImageId))?.imageData || st.decks.find(d=>d.id===match.deckId)?.image || "",
      deckUrl: match.deckUrl || "",
      opponentPerson: match.opponentPerson || "",
      date: match.date,
      _id: match.id,
    }});
  };

  const saveMatch = form => {
    const deckName = form.deckName || (form.deckId ? (st.decks?.find(d=>d.id===form.deckId)?.name||"") : "");
    if ((!form.deckId && !deckName) || !form.opponent.trim()) return;
    setSt(s => {
      let deckImages = [...(s.deckImages || [])];
      let decks = s.decks;
      let imageId = form.imageId || null;
      let deckId = form.deckId;

      // 直接入力で新規デッキ名が入力された場合、デッキを自動作成
      const _deckName = form.deckName || "";
      if (!deckId && _deckName) {
        const existing = s.decks.find(d => d.name === _deckName);
        if (existing) {
          deckId = existing.id;
        } else {
          deckId = genId();
          decks = [...s.decks, {id:deckId, name:_deckName, colors:[], notes:"", url:"", maxImages:10, currentImageId:null, createdAt:new Date().toISOString()}];
        }
      }

      // 相手デッキも新規の場合はopponentNamesに追加するだけ（デッキ管理には追加しない）
      // デッキ画像が新たに設定されていれば追加
      if (form.deckImage) {
        const { newImgs, newImgId } = addDeckImage(deckImages, decks, deckId, form.deckImage);
        const newImg = newImgs.find(i=>i.id===newImgId);
        if(newImg) idbPut(newImg).catch(()=>{});
        deckImages = newImgs;
        imageId = newImgId;
        const deckMatches = s.matches.filter(m => m.deckId === deckId && m.id !== form._id);
        const isLatest = deckMatches.every(m => m.date <= form.date);
        if (isLatest) {
          decks = decks.map(d => d.id===deckId ? {...d, currentImageId:newImgId} : d);
        }
      }

      const opponentNames = Array.from(new Set([...(s.opponentNames||[]), form.opponent]));
      const prefs = {...s.prefs, lastDeckId:deckId, lastOpponent:form.opponent, lastMatchType:form.matchType};

      if (screen.mode==="add") {
        const match = { id:Date.now().toString(), ...form, deckId, imageId, deckImage:undefined, createdAt:new Date().toISOString() };
        return { ...s, decks, deckImages, matches:[...s.matches, match], opponentNames, prefs };
      } else {
        const matches = s.matches.map(m => m.id===form._id ? {...m, ...form, deckId, imageId, deckImage:undefined} : m);
        return { ...s, decks, deckImages, matches, opponentNames, prefs };
      }
    });
    showToast("記録しました"); setScreen(null); setMatchDetail(null); setDeleteTarget(null);
  };

  const addMatchType = t => setSt(s=>({...s, matchTypes:[...(s.matchTypes||DEFAULT_MATCH_TYPES), t]}));
  const deleteMatchType = t => setSt(s=>({...s, matchTypes:(s.matchTypes||DEFAULT_MATCH_TYPES).filter(x=>x!==t)}));
  const moveMatchType = (t, dir) => setSt(s=>{
    const arr=[...(s.matchTypes||DEFAULT_MATCH_TYPES)];
    const i=arr.indexOf(t); if(i<0) return s;
    const j=i+dir; if(j<0||j>=arr.length) return s;
    [arr[i],arr[j]]=[arr[j],arr[i]];
    return {...s,matchTypes:arr};
  });
  const addDeck = () => { if (!newDeck.name.trim()) return; const deck={id:Date.now().toString(),...newDeck,maxImages:10,currentImageId:null,createdAt:new Date().toISOString()}; setSt(s=>({...s,decks:[...s.decks,deck]})); setNewDeck({name:"",colors:[],notes:"",url:"",image:"",parentId:""}); setShowAddDeck(false); };
  const deleteDeck = id => setSt(s=>({...s,decks:s.decks.filter(x=>x.id!==id)}));
  const deleteMatch = id => setSt(s=>({...s,matches:s.matches.filter(m=>m.id!==id)}));
  const handleMerge = (sel,name) => { setSt(s=>({...s, matches:s.matches.map(m=>sel.includes(m.opponent)?{...m,opponent:name}:m), opponentNames:Array.from(new Set([...(s.opponentNames||[]).filter(n=>!sel.includes(n)),name]))})); setShowMerge(false); setCheckedOpps([]); };
  const handleMergeDecks = (selIds, name, baseId) => {
    setSt(s=>{
      const baseDeck=s.decks.find(d=>d.id===baseId);
      const maxImages=baseDeck?.maxImages??10;
      // ベース以外のdeckIdをbaseIdに付け替え
      let newDeckImages=[...( s.deckImages||[])].map(i=>selIds.includes(i.deckId)?{...i,deckId:baseId}:i);
      // 上限超えなら古い順に削除
      if(maxImages>0){
        const baseImgs=newDeckImages.filter(i=>i.deckId===baseId).sort((a,b)=>a.createdAt.localeCompare(b.createdAt));
        if(baseImgs.length>maxImages){
          const toDelete=new Set(baseImgs.slice(0,baseImgs.length-maxImages).map(i=>i.id));
          newDeckImages=newDeckImages.filter(i=>!toDelete.has(i.id));
        }
      }
      const newDecks=s.decks.filter(d=>d.id===baseId||!selIds.includes(d.id)).map(d=>d.id===baseId?{...d,name}:d);
      const newMatches=s.matches.map(m=>selIds.includes(m.deckId)?{...m,deckId:baseId}:m);
      return{...s,decks:newDecks,matches:newMatches,deckImages:newDeckImages};
    });
    setCheckedDecks([]); setShowMergeDeck(false);
  };

  const importCSV = (text) => {
    const lines = text.split("\n").map(l=>l.endsWith("\r")?l.slice(0,-1):l).filter(l=>l.trim());
    if (lines.length < 2) return;
    const headers = lines[0].split(",");
    const idx = name => headers.indexOf(name);
    let imported=0, skipped=0, autoCreated=0;
    const newOpponents=new Set(), newMatches=[], newDecks=[], createdDeckMap={};
    lines.slice(1).forEach(line => {
      const cols=line.split(",");
      const get=name=>{const i=idx(name);if(i<0||i>=cols.length)return"";return cols[i].trim().replace(/^"|"$/g,"");};
      const myDeckName=get("使用デッキ"), opponent=get("対戦相手デッキ"), dateRaw=get("日付");
      if(!myDeckName||!opponent||!dateRaw){skipped++;return;}
      let deck=st.decks.find(d=>d.name===myDeckName);
      if(!deck&&createdDeckMap[myDeckName]) deck={id:createdDeckMap[myDeckName]};
      if(!deck){const newId="deck_imp_"+Date.now()+"_"+autoCreated;createdDeckMap[myDeckName]=newId;newDecks.push({id:newId,name:myDeckName,colors:[],notes:"",createdAt:dateRaw});deck={id:newId};autoCreated++;}
      const turn=get("先攻・後攻")==="first"?"first":get("先攻・後攻")==="second"?"second":"";
      const resultRaw=get("勝敗"); const result=resultRaw==="win"?"win":resultRaw==="loss"?"lose":resultRaw==="draw"?"draw":"lose";
      newOpponents.add(opponent);
      newMatches.push({id:"imp_"+Date.now()+"_"+imported,deckId:deck.id,opponent,turn,result,date:dateRaw.slice(0,10),matchType:get("タグ")||"",notes:get("メモ")||"",endTurn:get("終了ターン")?parseInt(get("終了ターン")):null,lucky:false,unlucky:false,opponentPerson:"",deckUrl:"",createdAt:dateRaw});
      imported++;
    });
    setSt(s=>({...s,decks:[...s.decks,...newDecks],matches:[...s.matches,...newMatches],opponentNames:Array.from(new Set([...(s.opponentNames||[]),...newOpponents]))}));
    setImportResult({imported,skipped,autoCreated});
  };

  const doRestore = () => { const d=parseData(restoreText); if(d){setSt(d);setBackupMode(null);setRestoreText("");} };

  const sortedDecksForEntry = [...st.decks].sort((a,b)=>{
    const now=Date.now(), score=id=>st.matches.reduce((s,m)=>{if(m.deckId!==id)return s;const age=(now-new Date(m.createdAt).getTime())/(1000*60*60*24);return s+(age<=30?3:age<=90?1.5:1);},0);
    return score(b.id)-score(a.id);
  });

  const entryScrollRef = useRef(null);
  useEffect(()=>{
    if(screen) {
      setTimeout(()=>{
        if(entryScrollRef.current) entryScrollRef.current.scrollTop = 0;
      }, 0);
    }
  }, [screen]);
  if (idbLoading) return (
    <div style={{minHeight:"100vh",background:C.bg,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:20,fontFamily:"Noto Sans JP,Hiragino Sans,sans-serif"}}>
      <div style={{fontSize:40}}>🌐</div>
      <div style={{fontWeight:900,fontSize:18,background:`linear-gradient(90deg,${C.accent},#7c6fff)`,WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent",letterSpacing:1}}>DigiLog</div>
      <div style={{display:"flex",gap:6,alignItems:"center"}}>
        {[0,1,2].map(i=>(
          <div key={i} style={{width:8,height:8,borderRadius:"50%",background:C.accent,animation:`pulse 1.2s ease-in-out ${i*0.2}s infinite`,opacity:0.8}}/>
        ))}
      </div>
      <div style={{fontSize:12,color:C.muted}}>データを読み込んでいます...</div>
      <style>{`@keyframes pulse{0%,100%{transform:scale(1);opacity:0.4}50%{transform:scale(1.4);opacity:1}}`}</style>
    </div>
  );

  if (screen) return (
    <div>
      <MatchEntry initial={screen.form} onSave={saveMatch} onCancel={()=>{setScreen(null);setMatchDetail(null);}}
        decks={sortedDecksForEntry} opponentNames={allOpponentNames} opponents={st.opponents||[]}
        matchTypes={matchTypes} onAddMatchType={addMatchType} onDeleteMatchType={deleteMatchType}
        isEdit={screen.mode==="edit"}
        onDelete={screen.mode==="edit"?()=>{setDeleteTarget(screen.form._id);}:undefined}
        formFields={st.formFields||{}}
        carryOver={carryOver} onToggleCarryOver={next=>setCarryOver(next)}
        onToggleField={key=>setSt(s=>{const ff=s.formFields||{};const cur=ff[key]!==false;return{...s,formFields:{...ff,[key]:!cur}};})}
        onContinue={form=>{const next=(screen.seriesCount||0)+1;saveMatch(form);showToast("記録しました");openAdd(form,next);}}
        seriesCount={screen.seriesCount||0}
        scrollRef={entryScrollRef}
      />
      {toast&&(
        <div style={{position:"fixed",top:16,right:16,zIndex:9999,background:C.accent,color:"#000",borderRadius:10,padding:"8px 16px",fontSize:13,fontWeight:800,boxShadow:"0 4px 16px #000a",pointerEvents:"none"}}>
          ✓ {toast}
        </div>
      )}
      {deleteTarget&&(
        <div style={{position:"fixed",inset:0,background:"#000c",display:"flex",alignItems:"center",justifyContent:"center",zIndex:300,padding:24}}>
          <div style={{background:C.card,borderRadius:16,padding:24,width:"100%",maxWidth:400}}>
            <div style={{fontSize:17,fontWeight:900,color:"#ff4444",marginBottom:12,textAlign:"center"}}>🗑️ この記録を削除しますか？</div>
            <div style={{fontSize:13,color:C.muted,marginBottom:20,textAlign:"center",lineHeight:1.7}}>削除した記録は元に戻せません。</div>
            <div style={{display:"flex",gap:10}}>
              <button onClick={()=>setDeleteTarget(null)} style={{flex:1,padding:"12px 0",borderRadius:10,border:`1px solid ${C.border}`,background:"transparent",color:C.muted,cursor:"pointer",fontSize:14,fontWeight:700}}>キャンセル</button>
              <button onClick={()=>{deleteMatch(deleteTarget);setDeleteTarget(null);setScreen(null);setMatchDetail(null);}} style={{flex:2,padding:"12px 0",borderRadius:10,border:"none",background:"#ff4444",color:"#fff",fontWeight:800,cursor:"pointer",fontSize:14}}>削除する</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  const getDeck = id => st.decks.find(d=>d.id===id);
  const applyFilters = matches => {
    const now=new Date();
    return matches.filter(m=>{
      if(flt.decks.length>0){ const hasNoDeck=flt.decks.includes("__no_deck__"); const deckIds=flt.decks.filter(x=>x!=="__no_deck__"); const deckExists=st.decks.some(d=>d.id===m.deckId); if(hasNoDeck&&!deckExists){ /* OK */ } else if(deckIds.length>0&&deckIds.includes(m.deckId)){ /* OK */ } else if(!hasNoDeck||deckExists){ return false; } }
      if(flt.opponents.length>0&&!flt.opponents.includes(m.opponent)) return false;
      if(flt.matchTypes.length>0&&!flt.matchTypes.includes(m.matchType||"")) return false;
      if(flt.periodPreset!=="all"){
        const d=new Date(m.date);
        if(flt.periodPreset==="today"&&d.toDateString()!==now.toDateString()) return false;
        if(flt.periodPreset==="week"){const ago=new Date(now);ago.setDate(now.getDate()-7);if(d<ago)return false;}
        if(flt.periodPreset==="month"&&(d.getFullYear()!==now.getFullYear()||d.getMonth()!==now.getMonth())) return false;
        if(flt.periodPreset==="year"&&d.getFullYear()!==now.getFullYear()) return false;
      }
      if(flt.dateFrom&&m.date<flt.dateFrom) return false;
      if(flt.dateTo&&m.date>flt.dateTo) return false;
      if(flt.opponentPersons&&flt.opponentPersons.length>0&&!flt.opponentPersons.includes(m.opponentPerson||"")) return false;
      if(flt.turns.length>0&&!flt.turns.includes(m.turn||"")) return false;
      if(flt.results.length>0&&!flt.results.includes(m.result||"")) return false;
      if(flt.lucky&&!m.lucky) return false;
      if(flt.unlucky&&!m.unlucky) return false;
      return true;
    });
  };

  const activeFilters = flt.decks.length+flt.opponents.length+(flt.opponentPersons||[]).length+flt.matchTypes.length+(flt.periodPreset!=="all"?1:0)+(flt.dateFrom||flt.dateTo?1:0);
  const filtered = applyFilters(st.matches);
  const sorted = [...filtered].sort((a,b)=>new Date(b.createdAt)-new Date(a.createdAt));
  const wins=filtered.filter(m=>m.result==="win").length, loses=filtered.filter(m=>m.result==="lose").length, draws=filtered.filter(m=>m.result==="draw").length, total=filtered.length;
  const wr=total>0?Math.round(wins/total*100):0;
  const fm=filtered.filter(m=>m.turn==="first"), sm=filtered.filter(m=>m.turn==="second");
  const fwr=fm.length>0?Math.round(fm.filter(m=>m.result==="win").length/fm.length*100):null;
  const swr=sm.length>0?Math.round(sm.filter(m=>m.result==="win").length/sm.length*100):null;
  const deckStats=st.decks.map(deck=>{
    const ms=filtered.filter(m=>m.deckId===deck.id);
    const w=ms.filter(m=>m.result==="win").length,l=ms.filter(m=>m.result==="lose").length,dr=ms.filter(m=>m.result==="draw").length,t=ms.length;
    return {...deck,total:t,wins:w,loses:l,draws:dr,winRate:t>0?Math.round(w/t*100):0};
  });
  const opponentStats=Array.from(new Set(filtered.map(m=>m.opponent).filter(Boolean))).sort().map(name=>{
    const ms=filtered.filter(m=>m.opponent===name);
    const w=ms.filter(m=>m.result==="win").length,l=ms.filter(m=>m.result==="lose").length,dr=ms.filter(m=>m.result==="draw").length,t=ms.length;
    return {name,total:t,wins:w,loses:l,draws:dr,winRate:t>0?Math.round(w/t*100):0};
  });

  const toggleBulkSelect = id => setBulkSelected(prev=>prev.includes(id)?prev.filter(x=>x!==id):[...prev,id]);
  const executeBulkDelete = () => { setSt(s=>({...s,matches:s.matches.filter(m=>!bulkSelected.includes(m.id))})); setBulkMode(false); setBulkSelected([]); };
  const cancelBulkMode = () => { setBulkMode(false); setBulkSelected([]); };

  const inputStyle={background:C.bg,border:`1px solid ${C.border}`,borderRadius:8,color:C.text,padding:"9px 12px",fontSize:16,outline:"none",width:"100%",boxSizing:"border-box"};

  return (
    <div style={{minHeight:"100vh",background:C.bg,color:C.text,fontFamily:"Noto Sans JP,Hiragino Sans,sans-serif"}}>
      <div style={{background:C.card,borderBottom:`1px solid ${C.border}`,padding:"14px 20px",display:"flex",alignItems:"center",gap:12}}>
        <div style={{fontSize:22}}>🌐</div>
        <div style={{flex:1}}>
          <div style={{fontWeight:900,fontSize:20,letterSpacing:1,background:`linear-gradient(90deg,${C.accent},#7c6fff)`,WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent"}}>DigiLog</div>
        </div>
        <button onClick={()=>setShowLife(v=>!v)} style={{background:showLife?C.accent+"33":"transparent",border:`1px solid ${showLife?C.accent:C.border}`,borderRadius:10,padding:"7px 12px",color:showLife?C.accent:C.muted,fontSize:12,fontWeight:700,cursor:"pointer",whiteSpace:"nowrap"}}>
          メモリーゲージ
        </button>
      </div>
      <div style={{display:"flex",borderBottom:`1px solid ${C.border}`,background:C.card}}>
        {[["matches","対戦記録"],["decks","デッキ管理"],["stats","統計"],["settings","設定"]].map(([k,l])=>(
          <button key={k} onClick={()=>switchTab(k)} style={{flex:1,padding:"13px 0",border:"none",background:"transparent",color:tab===k?C.accent:C.muted,borderBottom:tab===k?`2px solid ${C.accent}`:"2px solid transparent",fontWeight:tab===k?800:400,fontSize:13,cursor:"pointer"}}>{l}</button>
        ))}
      </div>


      <div style={{padding:14,maxWidth:600,margin:"0 auto"}}>

        {/* MATCHES TAB */}
        {tab==="matches"&&(
          <div>
            {/* 追加ボタン */}
            <div style={{marginBottom:8}}>
              <button onClick={bulkMode?null:()=>openAdd()} style={{width:"100%",background:bulkMode?"#1a2030":`linear-gradient(135deg,${C.accent},${C.accentDim})`,color:bulkMode?C.muted:"#000",border:"none",borderRadius:8,padding:"12px 0",fontWeight:800,fontSize:15,cursor:bulkMode?"default":"pointer",opacity:bulkMode?0.5:1}}>記録を追加</button>
            </div>

            {/* ツールバー：ボタン行とパネルを分離 */}
            <div style={{marginBottom:8}}>
              <div style={{display:"flex",gap:6,alignItems:"center",marginBottom:4}}>
                <FilterBarTop activeFilters={activeFilters} open={filterBarOpen} setOpen={setFilterBarOpen} onReset={resetFilters}/>
                {bulkMode?(
                  <>
                    <button onClick={cancelBulkMode} style={{height:36,padding:"0 10px",borderRadius:8,border:`1px solid ${C.border}`,background:"transparent",color:C.muted,cursor:"pointer",fontSize:12,whiteSpace:"nowrap",flexShrink:0}}>キャンセル</button>
                    <button onClick={executeBulkDelete} disabled={bulkSelected.length===0} style={{height:36,padding:"0 10px",borderRadius:8,border:"none",background:bulkSelected.length>0?"#ff4444":"#333",color:bulkSelected.length>0?"#fff":"#666",fontWeight:700,cursor:bulkSelected.length>0?"pointer":"default",fontSize:12,whiteSpace:"nowrap",flexShrink:0}}>削除({bulkSelected.length})</button>
                  </>
                ):(
                  <>
                    <button onClick={()=>setShowNotes(n=>!n)} style={{height:36,padding:"0 10px",borderRadius:8,border:`1px solid ${showNotes?C.accent:C.border}`,background:showNotes?C.accent+"22":"transparent",color:showNotes?C.accent:C.muted,cursor:"pointer",fontSize:12,fontWeight:showNotes?700:400,flexShrink:0}}>メモ</button>
                    <button onClick={()=>{setBulkMode(true);setBulkSelected([]);}} style={{height:36,padding:"0 10px",borderRadius:8,border:`1px solid ${C.border}`,background:"transparent",color:C.muted,cursor:"pointer",fontSize:12,whiteSpace:"nowrap",flexShrink:0}}>一括削除</button>
                  </>
                )}
              </div>
              {filterBarOpen&&<FilterBarPanel decks={st.decks} allOpponentNames={allOpponentNames} opponents={st.opponents||[]} matchTypes={matchTypes} flt={flt} setF={setF} inputStyle={inputStyle}/>}
            </div>

            {/* 記録リスト */}
            {sorted.length===0?(
              <div style={{textAlign:"center",padding:"40px 20px",color:C.muted}}>
                <div style={{fontSize:40,marginBottom:12}}>📋</div>
                <div style={{fontSize:15,fontWeight:700,marginBottom:6}}>記録がありません</div>
                <div style={{fontSize:13}}>「記録を追加」から対戦を記録しましょう</div>
              </div>
            ):(
              <div style={{display:"flex",flexDirection:"column",gap:8}}>
                {sorted.slice(0,displayCount).map(m=>{
                  const deck=getDeck(m.deckId); const deckMissing=m.deckId&&!deck;
                  const hex=deck?firstHex(deck.colors):null;
                  return (
                    <div key={m.id} onClick={()=>bulkMode?toggleBulkSelect(m.id):setMatchDetail(m)} style={{background:C.card,border:`1.5px solid ${bulkMode&&bulkSelected.includes(m.id)?C.accent:C.border}`,borderRadius:12,padding:14,cursor:"pointer"}}>
                      {/* 1行目：勝敗・先攻後攻 / vs 相手 / 編集orチェック */}
                      <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:6}}>
                        <WinBadge result={m.result}/>
                        <TurnBadge turn={m.turn}/>
                        <span style={{fontWeight:800,fontSize:15,flex:1,color:C.text}}>vs {m.opponent}</span>
                        {bulkMode?(
                          <div style={{width:22,height:22,borderRadius:4,border:`2px solid ${bulkSelected.includes(m.id)?C.accent:C.muted}`,background:bulkSelected.includes(m.id)?C.accent:"transparent",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
                            {bulkSelected.includes(m.id)&&<span style={{color:"#000",fontSize:12,fontWeight:900}}>✓</span>}
                          </div>
                        ):(
                          <button onClick={e=>{e.stopPropagation();openEdit(m);}} style={{padding:"4px 12px",borderRadius:8,border:`1px solid ${C.accent}`,background:"transparent",color:C.accent,fontSize:12,fontWeight:700,cursor:"pointer",flexShrink:0}}>編集</button>
                        )}
                      </div>

                      {/* 2行目：デッキ画像・デッキ名・対戦種類・日付 */}
                      <div style={{display:"flex",alignItems:"center",gap:8,fontSize:12,marginBottom:m.notes&&showNotes?8:0}}>
                        {getMatchImage(m,st.deckImages||[],deck)&&<img src={getMatchImage(m,st.deckImages||[],deck)} alt="" style={{width:32,height:32,objectFit:"cover",borderRadius:6,flexShrink:0,border:`1px solid ${C.border}`}}/>}
                        {deck&&<span style={{display:"flex",alignItems:"center",gap:4,color:hex||C.text,fontWeight:700}}><DeckDot colors={deck.colors} size={10}/>{deck.name}</span>}
                    {deckMissing&&<span style={{display:"flex",alignItems:"center",gap:4,color:C.muted,fontSize:11}}>⚠️ データなし</span>}
                        {m.matchType&&<span style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:4,padding:"1px 6px",color:C.muted,fontSize:11}}>{m.matchType}</span>}
                        <span style={{color:C.muted,fontSize:11,marginLeft:"auto"}}>{m.date}</span>
                      </div>

                      {/* メモ */}
                      {m.notes&&showNotes&&(
                        <div style={{fontSize:13,color:C.text,lineHeight:1.6,padding:"8px 10px",background:C.surface,borderRadius:8}}>{m.notes}</div>
                      )}
                    </div>
                  );
                })}
                {sorted.length>displayCount&&(
                  <button onClick={()=>setDisplayCount(n=>n+20)} style={{width:"100%",padding:"12px 0",borderRadius:8,border:`1px solid ${C.border}`,background:"transparent",color:C.muted,cursor:"pointer",fontSize:13,marginTop:4}}>
                    さらに読み込む（残り{sorted.length-displayCount}件）
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        {/* DECKS TAB */}
        {tab==="decks"&&(
          <div>
            <div style={{position:"sticky",top:0,zIndex:50,background:C.bg,paddingBottom:8}}>
              <div style={{display:"flex",gap:8,marginBottom:8}}>
                {[["mine","自分のデッキ"],["opponents","相手デッキ"]].map(([v,l])=>(
                  <button key={v} onClick={()=>setDeckView(v)} style={{flex:1,padding:"9px 0",borderRadius:8,border:`1px solid ${deckView===v?C.accent:C.border}`,background:deckView===v?C.accent+"22":"transparent",color:deckView===v?C.accent:C.muted,fontWeight:deckView===v?700:400,cursor:"pointer",fontSize:13}}>{l}</button>
                ))}
              </div>
              {deckView==="mine"&&!showAddDeck&&(
                <button onClick={()=>setShowAddDeck(true)} style={{width:"100%",background:`linear-gradient(135deg,${C.accent},${C.accentDim})`,color:"#000",border:"none",borderRadius:8,padding:"12px 0",fontWeight:800,fontSize:14,cursor:"pointer",marginTop:8}}>
                  ＋ デッキを追加
                </button>
              )}
              {deckView==="opponents"&&(
                <button onClick={()=>{setShowAddOpp(a=>!a);setNewOppName("");}} style={{width:"100%",background:showAddOpp?"transparent":`linear-gradient(135deg,${C.accent},${C.accentDim})`,color:showAddOpp?C.muted:"#000",border:showAddOpp?`1px solid ${C.border}`:"none",borderRadius:8,padding:"12px 0",fontWeight:800,fontSize:14,cursor:"pointer",marginTop:8}}>
                  {showAddOpp?"✕ キャンセル":"＋ 相手デッキを追加"}
                </button>
              )}
              <div style={{display:"flex",alignItems:"center",gap:8,marginTop:8}}>
                <span style={{fontSize:13,color:C.muted,flex:1}}>{deckView==="mine"?`${st.decks.length}件のデッキ`:`${allOpponentNames.length}件`}</span>
                {deckView==="mine"&&(
                  <div style={{display:"flex",gap:6}}>
                    <button onClick={()=>setShowActiveOnly(v=>!v)} style={{padding:"6px 12px",borderRadius:8,border:`1px solid ${showActiveOnly?C.accent:C.border}`,background:showActiveOnly?C.accent+"22":"transparent",color:showActiveOnly?C.accent:C.muted,cursor:"pointer",fontSize:12,fontWeight:showActiveOnly?700:400}}>使用中</button>
                    <button disabled={checkedDecks.length<2} onClick={()=>{if(checkedDecks.length>=2)setShowMergeDeck(true);}} style={{padding:"6px 12px",borderRadius:8,border:`1px solid ${checkedDecks.length>=2?C.accent:C.border}`,background:checkedDecks.length>=2?C.accent+"22":"transparent",color:checkedDecks.length>=2?C.accent:C.muted,cursor:checkedDecks.length>=2?"pointer":"default",fontSize:12,fontWeight:checkedDecks.length>=2?700:400}}>統合{checkedDecks.length>=2?`(${checkedDecks.length})`:""}</button>
                  </div>
                )}
                {deckView==="opponents"&&(
                  <button disabled={checkedOpps.length<2} onClick={()=>{if(checkedOpps.length>=2){setShowMerge(true);setMergeInitial(checkedOpps);}}} style={{padding:"6px 12px",borderRadius:8,border:`1px solid ${checkedOpps.length>=2?C.accent:C.border}`,background:checkedOpps.length>=2?C.accent+"22":"transparent",color:checkedOpps.length>=2?C.accent:C.muted,cursor:checkedOpps.length>=2?"pointer":"default",fontSize:12,fontWeight:checkedOpps.length>=2?700:400}}>統合{checkedOpps.length>=2?`(${checkedOpps.length})`:""}</button>
                )}
                <button onClick={()=>setShowDeckStats(s=>!s)} style={{padding:"6px 12px",borderRadius:8,border:`1px solid ${C.border}`,background:"transparent",color:C.muted,cursor:"pointer",fontSize:12}}>{showDeckStats?"勝率を隠す":"勝率を表示"}</button>
              </div>
              <div style={{display:"flex",gap:6,marginTop:8,alignItems:"center"}}>
                {deckView==="mine"&&<select value={deckSort} onChange={e=>setDeckSort(e.target.value)} style={{flex:"0 0 auto",background:C.surface,border:`1px solid ${C.accent}`,borderRadius:8,color:C.accent,padding:"7px 10px",fontSize:12,fontWeight:700,outline:"none",cursor:"pointer"}}>
                  <option value="recent">最近使用順</option>
                  <option value="newest">登録新しい順</option>
                  <option value="name">名前順</option>
                  <option value="winrate">勝率順</option>
                </select>}
                {deckView==="opponents"&&<select value={oppSort} onChange={e=>setOppSort(e.target.value)} style={{flex:"0 0 auto",background:C.surface,border:`1px solid ${C.accent}`,borderRadius:8,color:C.accent,padding:"7px 10px",fontSize:12,fontWeight:700,outline:"none",cursor:"pointer"}}>
                  <option value="name">名前順</option>
                  <option value="most">対戦数順</option>
                  <option value="winrate">勝率順</option>
                  <option value="recent">最近対戦順</option>
                </select>}
                <div style={{position:"relative",flex:1}}>
                <span style={{position:"absolute",left:10,top:"50%",transform:"translateY(-50%)",fontSize:14,color:C.muted,pointerEvents:"none"}}>🔍</span>
                <input value={deckSearch} onChange={e=>setDeckSearch(e.target.value)} placeholder="デッキ名で検索..." style={{width:"100%",background:C.surface,border:`1px solid ${deckSearch?C.accent:C.border}`,borderRadius:8,color:C.text,padding:"8px 32px 8px 32px",fontSize:14,outline:"none",boxSizing:"border-box"}}/>
                {deckSearch&&<button onClick={()=>setDeckSearch("")} style={{position:"absolute",right:10,top:"50%",transform:"translateY(-50%)",background:"transparent",border:"none",color:C.muted,cursor:"pointer",fontSize:14,lineHeight:1}}>✕</button>}
                </div>
              </div>
            </div>

            {/* デッキ追加モーダル */}
            {showAddDeck&&(
              <div style={{position:"fixed",inset:0,background:"#000b",display:"flex",alignItems:"center",justifyContent:"center",zIndex:200,touchAction:"none",overflow:"hidden",padding:24}} onTouchMove={e=>e.preventDefault()} onClick={e=>{if(e.target===e.currentTarget){setShowAddDeck(false);setNewDeck({name:"",colors:[],notes:"",url:"",image:"",parentId:""}); }}}>
                <div style={{background:C.card,borderRadius:16,width:"100%",maxWidth:480,padding:20,maxHeight:"85vh",overflowY:"auto"}}>
                  <div style={{fontWeight:800,fontSize:15,marginBottom:16}}>デッキを追加</div>
                  <div style={{display:"flex",flexDirection:"column",gap:10}}>
                    <div><div style={{fontSize:11,color:C.muted,marginBottom:5}}>デッキ名 *</div><input value={newDeck.name} onChange={e=>setNewDeck(d=>({...d,name:e.target.value}))} placeholder="例: アグロ赤" style={inputStyle} autoFocus/></div>
                    <div><div style={{fontSize:11,color:C.muted,marginBottom:5}}>カラー</div><ColorPicker colors={newDeck.colors} onChange={colors=>setNewDeck(d=>({...d,colors}))}/></div>
                    <div><div style={{fontSize:11,color:C.muted,marginBottom:5}}>メモ</div><textarea value={newDeck.notes} onChange={e=>setNewDeck(d=>({...d,notes:e.target.value}))} placeholder="（任意）" style={{...inputStyle,resize:"vertical",minHeight:52}}/></div>
                    <button onClick={addDeck} style={{background:`linear-gradient(135deg,${C.accent},${C.accentDim})`,color:"#000",border:"none",borderRadius:8,padding:"12px 0",fontWeight:800,fontSize:14,cursor:"pointer"}}>登録する</button>
                    <button onClick={()=>{setShowAddDeck(false);setNewDeck({name:"",colors:[],notes:"",url:"",image:"",parentId:""}); }} style={{background:"transparent",border:`1px solid ${C.border}`,borderRadius:8,padding:"12px 0",color:C.muted,fontSize:14,cursor:"pointer"}}>キャンセル</button>
                  </div>
                </div>
              </div>
            )}

            {deckView==="mine"&&(
              <div>
                {st.decks.length===0&&<div style={{textAlign:"center",padding:"40px 20px",color:C.muted}}><div style={{fontSize:40,marginBottom:12}}>🃏</div><div>まだデッキが登録されていません</div></div>}
                <div style={{display:"flex",flexDirection:"column",gap:8}}>
                  {(()=>{
                const now=Date.now();
                const score=id=>st.matches.reduce((s,m)=>{if(m.deckId!==id)return s;const age=(now-new Date(m.createdAt).getTime())/(1000*60*60*24);return s+(age<=30?3:age<=90?1.5:1);},0);
                return [...st.decks]
                  .filter(d=>(!deckSearch||d.name.toLowerCase().includes(deckSearch.toLowerCase()))&&(!showActiveOnly||d.isActive))
                  .sort((a,b)=>{
                    if(deckSort==="recent") return score(b.id)-score(a.id);
                    if(deckSort==="newest") return new Date(b.createdAt)-new Date(a.createdAt);
                    if(deckSort==="name") return a.name.localeCompare(b.name,"ja");
                    if(deckSort==="winrate"){const da=deckStats.find(d=>d.id===a.id);const db=deckStats.find(d=>d.id===b.id);return (db?.winRate||0)-(da?.winRate||0);}
                    return 0;
                  });
              })().map(deck=>{
                    const ds=deckStats.find(d=>d.id===deck.id)||{total:0,wins:0,loses:0,draws:0,winRate:0};
                    const hex=firstHex(deck.colors); const checked=checkedDecks.includes(deck.id);
                    return (
                      <div key={deck.id} style={{background:deck.isActive?`linear-gradient(135deg,${C.accent}28,${C.accent}12)`:C.card,border:`1.5px solid ${deck.isActive?C.accent:checked?C.accent:C.border}`,borderRadius:12,overflow:"hidden",cursor:"pointer",boxShadow:deck.isActive?`0 0 8px ${C.accent}33`:"none"}}>
                        {(()=>{
                          const curImg=(st.deckImages||[]).find(i=>i.id===deck.currentImageId)||(st.deckImages||[]).filter(i=>i.deckId===deck.id).sort((a,b)=>b.createdAt.localeCompare(a.createdAt))[0];
                          return (
                            <div style={{display:"flex",alignItems:"stretch",minHeight:56}}>
                              {/* 左：チェックボックスエリア */}
                              <div onClick={()=>setCheckedDecks(prev=>checked?prev.filter(x=>x!==deck.id):[...prev,deck.id])} style={{width:44,flexShrink:0,display:"flex",alignItems:"center",justifyContent:"center",borderRight:`1px solid ${C.border}`,cursor:"pointer"}}>
                                <div style={{width:20,height:20,borderRadius:4,border:`2px solid ${checked?C.accent:C.muted}`,background:checked?C.accent:"transparent",display:"flex",alignItems:"center",justifyContent:"center"}}>
                                  {checked&&<span style={{color:"#000",fontSize:11,fontWeight:900}}>✓</span>}
                                </div>
                              </div>
                              {/* 中央：デッキ情報（画像プレビューへ） */}
                              <div onClick={()=>{if(curImg)setDeckImgPreview({deck,curImg});}} style={{flex:1,display:"flex",alignItems:"center",gap:10,padding:"10px 12px",cursor:curImg?"pointer":"default"}}>
                                <DeckDot colors={deck.colors} size={14}/>
                                {curImg&&<img src={curImg.imageData} alt="" style={{width:36,height:36,objectFit:"cover",borderRadius:6,flexShrink:0,border:`1px solid ${C.border}`}}/>}
                                <div style={{flex:1,minWidth:0}}>
                                  <div style={{fontWeight:800,fontSize:15,color:hex||C.text,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{deck.name}</div>
                                  {deck.notes&&<div style={{fontSize:11,color:C.muted,marginTop:2,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{deck.notes}</div>}
                                </div>
                                {showDeckStats&&<span style={{fontWeight:900,color:ds.winRate>=50?C.win:C.lose,fontSize:15,flexShrink:0}}>{ds.total>0?`${ds.winRate}%`:"−"}</span>}
                              </div>
                              {/* 右：使用中スイッチ + 編集ボタン */}
                              <div onClick={e=>{e.stopPropagation();setSt(s=>{const next={...s,decks:s.decks.map(d=>d.id===deck.id?{...d,isActive:!d.isActive}:d)};save(next);return next;});}} style={{width:44,flexShrink:0,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:3,borderLeft:`1px solid ${C.border}`,cursor:"pointer",padding:"0 4px"}}>
                                <div style={{width:32,height:18,borderRadius:9,background:deck.isActive?C.accent:"#333",position:"relative",transition:"background 0.2s",flexShrink:0}}>
                                  <div style={{position:"absolute",top:2,left:deck.isActive?14:2,width:14,height:14,borderRadius:"50%",background:"#fff",transition:"left 0.2s"}}/>
                                </div>
                                <span style={{fontSize:9,color:deck.isActive?C.accent:C.muted,fontWeight:deck.isActive?700:400}}>使用中</span>
                              </div>
                              <div onClick={e=>{e.stopPropagation();setDeckDetail(deck);}} style={{width:40,flexShrink:0,display:"flex",alignItems:"center",justifyContent:"center",borderLeft:`1px solid ${C.border}`,cursor:"pointer",color:C.accent,fontSize:16}}>✏️</div>
                            </div>
                          );
                        })()}
                        {showDeckStats&&ds.total>0&&(
                          <div style={{paddingLeft:30}}>
                            <div style={{display:"flex",borderRadius:4,overflow:"hidden",height:6}}>
                              {ds.wins>0&&<div style={{flex:ds.wins,background:C.win}}/>}
                              {ds.draws>0&&<div style={{flex:ds.draws,background:C.draw}}/>}
                              {ds.loses>0&&<div style={{flex:ds.loses,background:C.lose}}/>}
                            </div>
                            <div style={{fontSize:11,color:C.muted,marginTop:4}}>{ds.total}戦 {ds.wins}勝 {ds.loses}敗</div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {deckView==="opponents"&&(
              <div>
                {showAddOpp&&<AddOppForm newOppName={newOppName} setNewOppName={setNewOppName} onCancel={()=>{setShowAddOpp(false);setNewOppName("");}} onAdd={()=>{const n=newOppName.trim();if(n&&!allOpponentNames.includes(n)){setSt(s=>({...s,opponentNames:Array.from(new Set([...(s.opponentNames||[]),n]))}));setNewOppName("");setShowAddOpp(false);}}} inputStyle={inputStyle}/>}
                {allOpponentNames.length===0&&<div style={{textAlign:"center",padding:"40px 20px",color:C.muted}}><div style={{fontSize:40,marginBottom:12}}>👥</div><div>相手デッキの記録がありません</div></div>}
                <div style={{display:"flex",flexDirection:"column",gap:8}}>
                  {[...allOpponentNames]
                    .filter(n=>!deckSearch||n.toLowerCase().includes(deckSearch.toLowerCase()))
                    .sort((a,b)=>{
                      const msA=st.matches.filter(m=>m.opponent===a), msB=st.matches.filter(m=>m.opponent===b);
                      if(oppSort==="name") return a.localeCompare(b,"ja");
                      if(oppSort==="most") return msB.length-msA.length;
                      if(oppSort==="winrate"){const wrA=msA.length>0?msA.filter(m=>m.result==="win").length/msA.length:0;const wrB=msB.length>0?msB.filter(m=>m.result==="win").length/msB.length:0;return wrB-wrA;}
                      if(oppSort==="recent"){const latestA=msA.reduce((d,m)=>m.date>d?m.date:d,"");const latestB=msB.reduce((d,m)=>m.date>d?m.date:d,"");return latestB.localeCompare(latestA);}
                      return 0;
                    })
                    .map(name=>{
                    const ms=st.matches.filter(m=>m.opponent===name);
                    const w=ms.filter(m=>m.result==="win").length,l=ms.filter(m=>m.result==="lose").length,t=ms.length;
                    const dr=t-w-l; const wr2=t>0?Math.round(w/t*100):0; const checked=checkedOpps.includes(name);
                    return (
                      <OppCard key={name} name={name} checked={checked} onToggle={()=>setCheckedOpps(prev=>checked?prev.filter(x=>x!==name):[...prev,name])}
                        showStats={showDeckStats} w={w} l={l} dr={dr} t={t} wr2={wr2}
                        onRename={newName=>{ if(newName&&newName!==name){ setSt(s=>({...s,matches:s.matches.map(m=>m.opponent===name?{...m,opponent:newName}:m),opponentNames:Array.from(new Set([...(s.opponentNames||[]).filter(n=>n!==name),newName]))})); } }}
                        onDelete={n=>setDeleteOppTarget(n)}
                        inputStyle={inputStyle}
                      />
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {/* STATS TAB */}
        {tab==="stats"&&(
          <div>
            <FilterBar decks={st.decks} allOpponentNames={allOpponentNames} opponents={st.opponents||[]} matchTypes={matchTypes} flt={flt} setF={setF} activeFilters={activeFilters} onReset={resetFilters} inputStyle={inputStyle}/>
            {total===0?<div style={{textAlign:"center",padding:"40px 20px",color:C.muted}}><div style={{fontSize:40,marginBottom:12}}>📊</div><div>データがありません</div></div>:(
              <div style={{marginTop:12}}>
                <StatSection label="総合戦績" visKey="overall" statVis={statVis}>
                  <div style={{display:"flex",gap:6,marginBottom:10}}>
                    <StatCard label="対戦" value={total}/><StatCard label="勝率" value={`${wr}%`} color={wr>=50?C.win:C.lose}/><StatCard label="勝" value={wins} color={C.win}/><StatCard label="敗" value={loses} color={C.lose}/>
                  </div>
                  <div style={{display:"flex",borderRadius:8,overflow:"hidden",height:20,marginBottom:6}}>
                    {wins>0&&<div style={{flex:wins,background:C.win,display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,fontWeight:700,color:"#000"}}>{wins}</div>}
                    {draws>0&&<div style={{flex:draws,background:C.draw,display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,fontWeight:700,color:"#000"}}>{draws}</div>}
                    {loses>0&&<div style={{flex:loses,background:C.lose,display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,fontWeight:700,color:"#fff"}}>{loses}</div>}
                  </div>
                  <div style={{display:"flex",gap:16,fontSize:12}}>
                    <span style={{color:C.win}}>勝 {wins}</span>{draws>0&&<span style={{color:C.draw}}>分 {draws}</span>}<span style={{color:C.lose}}>敗 {loses}</span>
                  </div>
                </StatSection>
                <StatSection label="勝率推移" visKey="winTrend" statVis={statVis}>
                  <WinRateChart matches={filtered} flt={flt}/>
                </StatSection>
                {(fwr!==null||swr!==null)&&(
                  <StatSection label="先攻・後攻別勝率" visKey="turns" statVis={statVis}>
                    <div style={{display:"flex",gap:12}}>
                      {fwr!==null&&<div style={{flex:1,textAlign:"center",background:C.surface,borderRadius:8,padding:10}}><div style={{fontSize:11,color:C.first,marginBottom:4}}>⚡ 先攻</div><div style={{fontSize:20,fontWeight:900,color:fwr>=50?C.win:C.lose}}>{fwr}%</div><div style={{fontSize:11,color:C.muted,marginTop:2}}>{fm.length}戦</div></div>}
                      {swr!==null&&<div style={{flex:1,textAlign:"center",background:C.surface,borderRadius:8,padding:10}}><div style={{fontSize:11,color:C.second,marginBottom:4}}>🌙 後攻</div><div style={{fontSize:20,fontWeight:900,color:swr>=50?C.win:C.lose}}>{swr}%</div><div style={{fontSize:11,color:C.muted,marginTop:2}}>{sm.length}戦</div></div>}
                    </div>
                  </StatSection>
                )}
                <StatSection label="デッキ別成績" visKey="deckBar" statVis={statVis}>
                  {deckStats.filter(d=>d.total>0).sort((a,b)=>b.total-a.total).map(d=>(
                    <div key={d.id} style={{marginBottom:10}}>
                      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:4}}><div style={{display:"flex",alignItems:"center",gap:6}}><DeckDot colors={d.colors} size={10}/><span style={{fontSize:13,fontWeight:700}}>{d.name}</span></div><span style={{fontSize:13,fontWeight:900,color:d.winRate>=50?C.win:C.lose}}>{d.winRate}%</span></div>
                      <div style={{display:"flex",borderRadius:4,overflow:"hidden",height:8}}>{d.wins>0&&<div style={{flex:d.wins,background:C.win}}/>}{d.draws>0&&<div style={{flex:d.draws,background:C.draw}}/>}{d.loses>0&&<div style={{flex:d.loses,background:C.lose}}/>}</div>
                      <div style={{fontSize:11,color:C.muted,marginTop:3}}>{d.total}戦 {d.wins}勝 {d.loses}敗</div>
                    </div>
                  ))}
                </StatSection>
                <StatSection label="使用デッキ分布" visKey="deckPie" statVis={statVis}>
                  <PieChart items={deckStats.filter(d=>d.total>0).sort((a,b)=>b.total-a.total).map(d=>({label:d.name,value:d.total,deckColors:d.colors}))}/>
                </StatSection>
                <StatSection label="相手デッキ別成績" visKey="oppBar" statVis={statVis}>
                  {opponentStats.sort((a,b)=>b.total-a.total).slice(0,10).map(o=>(
                    <div key={o.name} style={{marginBottom:10}}>
                      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:4}}><span style={{fontSize:13,fontWeight:700}}>{o.name}</span><span style={{fontSize:13,fontWeight:900,color:o.winRate>=50?C.win:C.lose}}>{o.winRate}%</span></div>
                      <div style={{display:"flex",borderRadius:4,overflow:"hidden",height:8}}>{o.wins>0&&<div style={{flex:o.wins,background:C.win}}/>}{o.draws>0&&<div style={{flex:o.draws,background:C.draw}}/>}{o.loses>0&&<div style={{flex:o.loses,background:C.lose}}/>}</div>
                      <div style={{fontSize:11,color:C.muted,marginTop:3}}>{o.total}戦 {o.wins}勝 {o.loses}敗</div>
                    </div>
                  ))}
                </StatSection>
                <StatSection label="対戦相手デッキ分布" visKey="oppPie" statVis={statVis}>
                  <PieChart items={opponentStats.sort((a,b)=>b.total-a.total).map(o=>({label:o.name,value:o.total}))}/>
                </StatSection>
              </div>
            )}
          </div>
        )}

        {/* SETTINGS TAB */}
        {tab==="settings"&&(
          <div>
            {/* Theme */}
            <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:12,padding:16,marginBottom:12}}>
              <div style={{fontWeight:800,fontSize:14,marginBottom:12}}>テーマカラー</div>
              <div style={{display:"flex",flexWrap:"wrap",gap:8}}>
                {Object.entries(THEMES).map(([id,theme])=>{
                  const sel=st.theme===id;
                  return <button key={id} onClick={()=>setSt(s=>({...s,theme:id}))} style={{padding:"8px 14px",borderRadius:20,border:`2px solid ${sel?theme.accent:C.border}`,background:sel?theme.accent+"22":"transparent",color:sel?theme.accent:C.muted,fontWeight:sel?700:400,cursor:"pointer",fontSize:13}}>{theme.label}</button>;
                })}
              </div>
            </div>
            {/* Form Fields */}
            <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:12,padding:16,marginBottom:12}}>
              <div style={{fontWeight:800,fontSize:14,marginBottom:4}}>記録フォームの表示項目</div>
              <div style={{fontSize:12,color:C.muted,marginBottom:12}}>オフにした項目は記録入力画面に表示されません</div>
              <div style={{display:"flex",flexDirection:"column",gap:8}}>
                {FORM_FIELDS.map(f=>{
                  const on=(st.formFields||{})[f.key]!==false;
                  return <div key={f.key} onClick={()=>setSt(s=>({...s,formFields:{...(s.formFields||{}),[f.key]:!on}}))} style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"10px 14px",borderRadius:10,cursor:"pointer",background:C.surface,border:`1px solid ${on?C.accent:C.border}`}}>
                    <span style={{fontSize:14,color:on?C.text:C.muted}}>{f.label}</span>
                    <div style={{width:40,height:22,borderRadius:11,background:on?C.accent:C.border,position:"relative",transition:"background 0.2s",flexShrink:0}}>
                      <div style={{position:"absolute",top:3,left:on?20:3,width:16,height:16,borderRadius:"50%",background:"#fff",transition:"left 0.2s"}}/>
                    </div>
                  </div>;
                })}
              </div>
            </div>

            <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:12,padding:16,marginBottom:12}}>
              <div style={{fontWeight:800,fontSize:14,marginBottom:4}}>統計画面の表示設定（強力）</div>
              <div style={{fontSize:12,color:"#f87171",marginBottom:12}}>⚠️ チェックを外すと統計画面から完全に非表示になります。設定画面からのみ復活できます。</div>
              <div style={{display:"flex",flexDirection:"column",gap:8}}>
                {[
                  ["overall","総合戦績"],
                  ["winTrend","勝率推移"],
                  ["turns","先攻・後攻別勝率"],
                  ["deckBar","デッキ別成績"],
                  ["deckPie","使用デッキ分布"],
                  ["oppBar","相手デッキ別成績"],
                  ["oppPie","対戦相手デッキ分布"],
                ].map(([key,label])=>{
                  const on = statVis[key] !== false;
                  return (
                    <div key={key} onClick={()=>setStatVis(v=>({...v,[key]:!on}))} style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"10px 14px",borderRadius:10,cursor:"pointer",background:C.surface,border:`1px solid ${on?C.accent:C.border}`}}>
                      <span style={{fontSize:14,color:on?C.text:C.muted}}>{label}</span>
                      <div style={{width:40,height:22,borderRadius:11,background:on?C.accent:C.border,position:"relative",transition:"background 0.2s",flexShrink:0}}>
                        <div style={{position:"absolute",top:3,left:on?20:3,width:16,height:16,borderRadius:"50%",background:"#fff",transition:"left 0.2s"}}/>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
            {/* Opponents Management */}
            <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:12,padding:16,marginBottom:12}}>
              <div style={{fontWeight:800,fontSize:14,marginBottom:12}}>対戦相手の管理</div>
              <div style={{display:"flex",flexDirection:"column",gap:6,marginBottom:8}}>
                {(st.opponents||[]).map(op=>(
                  <div key={op} style={{display:"flex",alignItems:"center",justifyContent:"space-between",background:C.surface,border:`1px solid ${C.border}`,borderRadius:10,padding:"10px 14px"}}>
                    <span style={{fontSize:14,color:C.text}}>{op}</span>
                    <button onClick={()=>setSt(s=>({...s,opponents:(s.opponents||[]).filter(x=>x!==op)}))} style={{background:"transparent",border:"none",color:C.muted,cursor:"pointer",fontSize:14,padding:"2px 6px"}}>✕</button>
                  </div>
                ))}
                {(st.opponents||[]).length===0&&<div style={{fontSize:13,color:C.muted,padding:"8px 0"}}>登録された対戦相手はありません</div>}
              </div>
              <AddMatchTypeInline onAdd={op=>{if(op&&!(st.opponents||[]).includes(op))setSt(s=>({...s,opponents:[...(s.opponents||[]),op]}));}} matchTypes={st.opponents||[]} inputStyle={inputStyle} />
            </div>
            {/* Match Types */}
            <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:12,padding:16,marginBottom:12}}>
              <div style={{fontWeight:800,fontSize:14,marginBottom:12}}>対戦種類の管理</div>
              <div style={{display:"flex",flexDirection:"column",gap:6,marginBottom:4}}>
                {matchTypes.map((t,i)=>(
                  <div key={t} style={{display:"flex",alignItems:"center",gap:6,background:C.surface,border:`1px solid ${C.border}`,borderRadius:10,padding:"8px 12px"}}>
                    <div style={{display:"flex",flexDirection:"column",gap:2,flexShrink:0}}>
                      <button onClick={()=>moveMatchType(t,-1)} disabled={i===0} style={{background:"transparent",border:"none",color:i===0?C.border:C.muted,cursor:i===0?"default":"pointer",fontSize:12,padding:"1px 4px",lineHeight:1}}>▲</button>
                      <button onClick={()=>moveMatchType(t,1)} disabled={i===matchTypes.length-1} style={{background:"transparent",border:"none",color:i===matchTypes.length-1?C.border:C.muted,cursor:i===matchTypes.length-1?"default":"pointer",fontSize:12,padding:"1px 4px",lineHeight:1}}>▼</button>
                    </div>
                    <span style={{fontSize:14,color:C.text,flex:1}}>{t}</span>
                    {!DEFAULT_MATCH_TYPES.includes(t)?<button onClick={()=>deleteMatchType(t)} style={{background:"transparent",border:"none",color:C.muted,cursor:"pointer",fontSize:14,padding:"2px 6px"}}>✕</button>:<span style={{fontSize:11,color:C.muted}}>初期</span>}
                  </div>
                ))}
              </div>
              <AddMatchTypeInline onAdd={addMatchType} matchTypes={matchTypes} inputStyle={inputStyle} />
            </div>
            {/* CSV Import */}
            <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:12,padding:16,marginBottom:12}}>
              <div style={{fontWeight:800,fontSize:14,marginBottom:4}}>CSVインポート</div>
              <div style={{fontSize:12,color:C.muted,marginBottom:14}}>他の対戦記録アプリのCSVを読み込みます。対応アプリについては開発者までお問い合わせください。</div>
              {!importResult?(
                <label style={{display:"block",padding:"14px",borderRadius:10,border:`2px dashed ${C.accent}`,textAlign:"center",cursor:"pointer",color:C.accent,fontSize:14,fontWeight:700}}>
                  📂 CSVファイルを選択
                  <input type="file" accept=".csv" style={{display:"none"}} onChange={e=>{const file=e.target.files[0];if(!file)return;const reader=new FileReader();reader.onload=ev=>importCSV(ev.target.result);reader.readAsText(file,"UTF-8");}}/>
                </label>
              ):(
                <div>
                  <div style={{background:C.surface,borderRadius:10,padding:14,marginBottom:12}}>
                    <div style={{fontSize:15,fontWeight:800,color:C.win,marginBottom:8}}>✓ インポート完了</div>
                    <div style={{fontSize:13,color:C.text,lineHeight:1.8}}>取込件数: <strong style={{color:C.win}}>{importResult.imported}件</strong><br/>スキップ: <strong style={{color:C.muted}}>{importResult.skipped}件</strong></div>
                  </div>
                  <button onClick={()=>setImportResult(null)} style={{width:"100%",padding:"10px",borderRadius:8,border:`1px solid ${C.border}`,background:"transparent",color:C.muted,cursor:"pointer",fontSize:13}}>続けてインポート</button>
                </div>
              )}
            </div>
            {/* Backup / Restore */}
            <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:12,padding:16,marginBottom:12}}>
              <div style={{fontWeight:800,fontSize:14,marginBottom:8}}>データのバックアップ・復元</div>
              {/* ダウンロード */}
              <div style={{fontSize:11,color:C.muted,marginBottom:6,fontWeight:700}}>📤 ダウンロード</div>
              <div style={{display:"flex",flexDirection:"column",gap:8,marginBottom:14}}>
                <button onClick={async ()=>{
                  try {
                    const idbImgs = await idbGetAll();
                    const fullSt = {...st, deckImages: idbImgs};
                    const json = serializeData(fullSt, true);
                    const blob = new Blob([json],{type:"application/json"});
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement("a");
                    a.href = url;
                    a.download = "digimon_backup_full_"+new Date().toISOString().slice(0,10)+".json";
                    a.click();
                    URL.revokeObjectURL(url);
                  } catch(e) { alert("❌ 失敗: "+e.message); }
                }} style={{width:"100%",padding:"11px 0",borderRadius:8,border:`1px solid ${C.accent}`,background:C.accent+"18",color:C.accent,cursor:"pointer",fontSize:13,fontWeight:700}}>
                  🗂️ 全データ（画像込み）
                </button>
                <button onClick={()=>{
                  const json = serializeData(st, false);
                  const blob = new Blob([json],{type:"application/json"});
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement("a");
                  a.href = url;
                  a.download = "digimon_backup_data_"+new Date().toISOString().slice(0,10)+".json";
                  a.click();
                  URL.revokeObjectURL(url);
                }} style={{width:"100%",padding:"11px 0",borderRadius:8,border:`1px solid ${C.border}`,background:"transparent",color:C.text,cursor:"pointer",fontSize:13,fontWeight:700}}>
                  📋 画像以外の全データ
                </button>
              </div>
              {/* 復元 */}
              <div style={{fontSize:11,color:C.muted,marginBottom:6,fontWeight:700}}>📥 復元</div>
              <div style={{display:"flex",flexDirection:"column",gap:8}}>
                <label style={{width:"100%",padding:"11px 0",borderRadius:8,border:`1px solid ${C.border}`,background:"transparent",color:C.text,cursor:"pointer",fontSize:13,fontWeight:700,textAlign:"center",display:"block",boxSizing:"border-box"}}>
                  🗂️ 全データを復元
                  <input type="file" accept=".json" style={{display:"none"}} onChange={e=>{
                    const file=e.target.files[0];
                    if(!file)return;
                    const reader=new FileReader();
                    reader.onload=ev=>{
                      const d=parseData(ev.target.result);
                      if(d){
                        if(d.deckImages&&d.deckImages.length>0){
                          Promise.all(d.deckImages.map(img=>idbPut(img))).catch(()=>{});
                        }
                        setSt(d);
                        alert("復元しました！");
                      } else alert("ファイルが正しくありません。");
                    };
                    reader.readAsText(file);
                    e.target.value="";
                  }}/>
                </label>
                <label style={{width:"100%",padding:"11px 0",borderRadius:8,border:`1px solid ${C.border}`,background:"transparent",color:C.text,cursor:"pointer",fontSize:13,fontWeight:700,textAlign:"center",display:"block",boxSizing:"border-box"}}>
                  📋 画像以外の全データを復元
                  <input type="file" accept=".json" style={{display:"none"}} onChange={e=>{
                    const file=e.target.files[0];
                    if(!file)return;
                    const reader=new FileReader();
                    reader.onload=ev=>{
                      const d=parseData(ev.target.result);
                      if(d){ setSt(s=>({...d,deckImages:s.deckImages})); alert("復元しました！（画像はそのまま）"); }
                      else alert("ファイルが正しくありません。");
                    };
                    reader.readAsText(file);
                    e.target.value="";
                  }}/>
                </label>
              </div>
              <BackupSizeInfo st={st} C={C} serializeData={serializeData}/>
            </div>
            {/* デッキ画像データ管理 */}
            <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:12,padding:16,marginBottom:12}}>
              <div style={{fontWeight:800,fontSize:14,marginBottom:4}}>🖼️ デッキ画像データ管理</div>
              <div style={{fontSize:12,color:C.muted,marginBottom:12}}>
                全{(st.deckImages||[]).length}枚の画像を保存中。不要な画像を削除して容量を節約できます。
              </div>
              {/* デッキごとの画像一覧 */}
              {st.decks.filter(d=>(st.deckImages||[]).some(i=>i.deckId===d.id)).map(deck=>{
                const imgs=(st.deckImages||[]).filter(i=>i.deckId===deck.id).sort((a,b)=>b.createdAt.localeCompare(a.createdAt));
                return (
                  <div key={deck.id} style={{marginBottom:14}}>
                    <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:6}}>
                      <DeckDot colors={deck.colors} size={10}/>
                      <span style={{fontSize:13,fontWeight:700,color:firstHex(deck.colors)||C.text}}>{deck.name}</span>
                      <span style={{fontSize:11,color:C.muted}}>{imgs.length}枚</span>
                    </div>
                    <div style={{display:"flex",flexWrap:"wrap",gap:6}}>
                      {imgs.map(img=>{
                        const usedCount=(st.matches||[]).filter(m=>m.imageId===img.id).length;
                        return (
                          <div key={img.id} style={{position:"relative",width:72,borderRadius:8,overflow:"hidden",border:`2px solid ${img.id===deck.currentImageId?C.accent:C.border}`}}>
                            <img src={img.imageData} alt="" style={{width:"100%",height:72,objectFit:"cover",display:"block"}}/>
                            {img.id===deck.currentImageId&&<div style={{position:"absolute",top:2,left:2,background:C.accent,borderRadius:3,padding:"1px 4px",fontSize:9,color:"#000",fontWeight:900}}>現在</div>}
                            <div style={{padding:"2px 4px",background:"rgba(0,0,0,0.7)",fontSize:9,color:"#fff",textAlign:"center"}}>{usedCount}件の戦績</div>
                            <button onClick={()=>{
                              if(!window.confirm(`この画像を削除しますか？
${usedCount}件の戦績の画像表示に影響します。`)) return;
                              setSt(s=>{
                                const newImgs=s.deckImages.filter(i=>i.id!==img.id);
                                const newCurrentId=deck.currentImageId===img.id?(newImgs.filter(i=>i.deckId===deck.id).sort((a,b)=>b.createdAt.localeCompare(a.createdAt))[0]?.id||null):deck.currentImageId;
                                return{...s,deckImages:newImgs,decks:s.decks.map(d=>d.id===deck.id?{...d,currentImageId:newCurrentId}:d)};
                              });
                            }} style={{width:"100%",padding:"3px 0",border:"none",background:"#ff4444",color:"#fff",cursor:"pointer",fontSize:10}}>削除</button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
              {st.decks.every(d=>!(st.deckImages||[]).some(i=>i.deckId===d.id))&&(
                <div style={{fontSize:13,color:C.muted,textAlign:"center",padding:"12px 0"}}>保存されている画像はありません</div>
              )}
              {/* 不要画像一括削除 */}
              {(st.deckImages||[]).filter(i=>!(st.matches||[]).some(m=>m.imageId===i.id)&&i.id!==st.decks.find(d=>d.id===i.deckId)?.currentImageId).length>0&&(
                <button onClick={()=>{
                  const usedIds=new Set([...(st.matches||[]).map(m=>m.imageId).filter(Boolean),...st.decks.map(d=>d.currentImageId).filter(Boolean)]);
                  setSt(s=>({...s,deckImages:(s.deckImages||[]).filter(i=>usedIds.has(i.id))}));
                }} style={{marginTop:8,width:"100%",padding:"10px 0",borderRadius:8,border:"1px solid #f97316",background:"transparent",color:"#f97316",fontWeight:700,cursor:"pointer",fontSize:13}}>
                  🗑️ どの戦績にも紐づいていない不要画像を一括削除
                </button>
              )}
            </div>
            <div style={{background:C.card,border:"1px solid #ff444444",borderRadius:12,padding:16,marginBottom:12}}>
              <div style={{fontWeight:800,fontSize:14,marginBottom:4,color:"#ff4444"}}>⚠️ 危険な操作</div>
              <div style={{fontSize:12,color:C.muted,marginBottom:12}}>この操作は取り消せません。</div>
              <div style={{display:"flex",flexDirection:"column",gap:8}}>
                <button onClick={()=>setDeleteConfirmType("images")} style={{width:"100%",padding:"12px 0",borderRadius:8,border:"1px solid #f97316",background:"transparent",color:"#f97316",fontWeight:700,cursor:"pointer",fontSize:14}}>🖼️ 画像データのみ削除</button>
                <button onClick={()=>setDeleteConfirmType("all")} style={{width:"100%",padding:"12px 0",borderRadius:8,border:"1px solid #ff4444",background:"transparent",color:"#ff4444",fontWeight:700,cursor:"pointer",fontSize:14}}>🗑️ すべてのデータを削除</button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 削除確認モーダル（画面中央） */}
      {deleteTarget&&(
        <div style={{position:"fixed",inset:0,background:"#000c",display:"flex",alignItems:"center",justifyContent:"center",zIndex:300,padding:24}}>
          <div style={{background:C.card,borderRadius:16,padding:24,width:"100%",maxWidth:400}}>
            <div style={{fontSize:17,fontWeight:900,color:"#ff4444",marginBottom:12,textAlign:"center"}}>🗑️ この記録を削除しますか？</div>
            <div style={{fontSize:13,color:C.muted,marginBottom:20,textAlign:"center",lineHeight:1.7}}>削除した記録は元に戻せません。</div>
            <div style={{display:"flex",gap:10}}>
              <button onClick={()=>setDeleteTarget(null)} style={{flex:1,padding:"12px 0",borderRadius:10,border:`1px solid ${C.border}`,background:"transparent",color:C.muted,cursor:"pointer",fontSize:14,fontWeight:700}}>キャンセル</button>
              <button onClick={()=>{deleteMatch(deleteTarget);setDeleteTarget(null);setScreen(null);setMatchDetail(null);}} style={{flex:2,padding:"12px 0",borderRadius:10,border:"none",background:"#ff4444",color:"#fff",fontWeight:800,cursor:"pointer",fontSize:14}}>削除する</button>
            </div>
          </div>
        </div>
      )}
      {deleteDeckTarget&&(
        <div style={{position:"fixed",inset:0,background:"#000c",display:"flex",alignItems:"center",justifyContent:"center",zIndex:300,padding:24}}>
          <div style={{background:C.card,borderRadius:16,padding:24,width:"100%",maxWidth:400}}>
            <div style={{fontSize:17,fontWeight:900,color:"#ff4444",marginBottom:8,textAlign:"center"}}>🗑️ デッキを削除</div>
            <div style={{fontSize:14,color:C.text,marginBottom:6,textAlign:"center",fontWeight:700}}>「{st.decks.find(d=>d.id===deleteDeckTarget)?.name}」</div>
            <div style={{fontSize:12,color:C.muted,marginBottom:20,textAlign:"center",lineHeight:1.7}}>デッキ情報のみ削除します。関連する対戦記録は「データなし」として残ります。この操作は取り消せません。</div>
            <div style={{display:"flex",gap:10}}>
              <button onClick={()=>setDeleteDeckTarget(null)} style={{flex:1,padding:"12px 0",borderRadius:10,border:`1px solid ${C.border}`,background:"transparent",color:C.muted,cursor:"pointer",fontSize:14,fontWeight:700}}>キャンセル</button>
              <button onClick={()=>{deleteDeck(deleteDeckTarget);setDeleteDeckTarget(null);setDeckDetail(null);}} style={{flex:2,padding:"12px 0",borderRadius:10,border:"none",background:"#ff4444",color:"#fff",fontWeight:800,cursor:"pointer",fontSize:14}}>削除する</button>
            </div>
          </div>
        </div>
      )}
      {deleteOppTarget&&(
        <div style={{position:"fixed",inset:0,background:"#000c",display:"flex",alignItems:"center",justifyContent:"center",zIndex:300,padding:24}}>
          <div style={{background:C.card,borderRadius:16,padding:24,width:"100%",maxWidth:400}}>
            <div style={{fontSize:17,fontWeight:900,color:"#ff4444",marginBottom:8,textAlign:"center"}}>🗑️ 相手デッキを削除</div>
            <div style={{fontSize:14,color:C.text,marginBottom:6,textAlign:"center",fontWeight:700}}>「{deleteOppTarget}」</div>
            <div style={{fontSize:12,color:C.muted,marginBottom:20,textAlign:"center",lineHeight:1.7}}>この相手デッキ名を削除します。関連する対戦記録は残ります。</div>
            <div style={{display:"flex",gap:10}}>
              <button onClick={()=>setDeleteOppTarget(null)} style={{flex:1,padding:"12px 0",borderRadius:10,border:`1px solid ${C.border}`,background:"transparent",color:C.muted,cursor:"pointer",fontSize:14,fontWeight:700}}>キャンセル</button>
              <button onClick={()=>{setSt(s=>({...s,opponentNames:(s.opponentNames||[]).filter(n=>n!==deleteOppTarget)}));setDeleteOppTarget(null);}} style={{flex:2,padding:"12px 0",borderRadius:10,border:"none",background:"#ff4444",color:"#fff",fontWeight:800,cursor:"pointer",fontSize:14}}>削除する</button>
            </div>
          </div>
        </div>
      )}
      {deleteConfirmType&&(
        <div style={{position:"fixed",inset:0,background:"#000c",display:"flex",alignItems:"center",justifyContent:"center",zIndex:300,padding:24}}>
          <div style={{background:C.card,borderRadius:16,padding:24,width:"100%",maxWidth:400,boxShadow:"0 20px 60px #000a"}}>
            <div style={{fontSize:18,fontWeight:900,color:"#ff4444",marginBottom:12,textAlign:"center"}}>
              {deleteConfirmType==="all"?"🗑️ すべてのデータを削除":"🖼️ 画像データのみ削除"}
            </div>
            <div style={{fontSize:13,color:C.muted,marginBottom:20,textAlign:"center",lineHeight:1.7}}>
              {deleteConfirmType==="all"?"対戦記録・デッキ・設定をすべて削除します。この操作は取り消せません。":"デッキ画像・対戦画像をすべて削除します。対戦記録・デッキ情報は保持されます。"}
            </div>
            <div style={{display:"flex",gap:10}}>
              <button onClick={()=>setDeleteConfirmType(null)} style={{flex:1,padding:"12px 0",borderRadius:10,border:`1px solid ${C.border}`,background:"transparent",color:C.muted,cursor:"pointer",fontSize:14,fontWeight:700}}>キャンセル</button>
              <button onClick={()=>{
                if(deleteConfirmType==="all"){idbClear().catch(()=>{}); setSt({decks:[],matches:[],opponentNames:[],matchTypes:[...DEFAULT_MATCH_TYPES],prefs:{},theme:st.theme,formFields:{},opponents:[],deckImages:[]});}
                else{setSt(s=>({...s,decks:s.decks.map(d=>({...d,image:""})),matches:s.matches.map(m=>({...m,image:"",deckImage:""})),}));}
                setDeleteConfirmType(null);
              }} style={{flex:2,padding:"12px 0",borderRadius:10,border:"none",background:"#ff4444",color:"#fff",fontWeight:800,cursor:"pointer",fontSize:14}}>削除する</button>
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast&&(
        <div style={{position:"fixed",top:16,right:16,zIndex:9999,background:C.accent,color:"#000",borderRadius:10,padding:"8px 16px",fontSize:13,fontWeight:800,boxShadow:"0 4px 16px #000a",pointerEvents:"none",animation:"fadeIn 0.2s"}}>
          ✓ {toast}
        </div>
      )}
      {/* Memory Gauge Modal */}
      {deckImgPreview&&(
        <div onClick={()=>setDeckImgPreview(null)} style={{position:"fixed",inset:0,background:"#000d",display:"flex",alignItems:"center",justifyContent:"center",zIndex:300,padding:24}}>
          <div onClick={e=>e.stopPropagation()} style={{background:C.card,borderRadius:16,overflow:"hidden",maxWidth:400,width:"100%"}}>
            <img src={deckImgPreview.curImg.imageData} alt="" style={{width:"100%",maxHeight:"60vh",objectFit:"contain",display:"block",background:C.surface}}/>
            <div style={{padding:"12px 16px",display:"flex",alignItems:"center",justifyContent:"space-between"}}>
              <div style={{display:"flex",alignItems:"center",gap:8}}><DeckDot colors={deckImgPreview.deck.colors} size={14}/><span style={{fontWeight:800,fontSize:15}}>{deckImgPreview.deck.name}</span></div>
              <button onClick={()=>setDeckImgPreview(null)} style={{background:"transparent",border:`1px solid ${C.border}`,borderRadius:8,padding:"6px 14px",color:C.muted,cursor:"pointer",fontSize:13}}>閉じる</button>
            </div>
          </div>
        </div>
      )}
      {showLife&&<MemoryGauge marker={marker} setMarker={setMarker} onClose={()=>setShowLife(false)} accent={C.accent} accentDim={C.accentDim} bg={C.bg} surface={C.surface} border={C.border} text={C.text} muted={C.muted} card={C.card}/>}
      {/* Modals */}
      {matchDetail&&<MatchDetailModal match={matchDetail} deck={getDeck(matchDetail.deckId)} onClose={()=>setMatchDetail(null)} onEdit={()=>{openEdit(matchDetail);setMatchDetail(null);}} formFields={st.formFields||{}} deckImages={st.deckImages||[]}/>}
      {deckDetail&&<DeckDetailModal deck={deckDetail} deckStats={deckStats.find(d=>d.id===deckDetail.id)} inputStyle={inputStyle} onClose={()=>setDeckDetail(null)} deckImages={st.deckImages||[]} onSave={form=>{setSt(s=>({...s,decks:s.decks.map(d=>d.id===deckDetail.id?{...d,...form}:d)}));setDeckDetail(null);}} onSaveImage={(deckId,imageData)=>{let retId=null;setSt(s=>{const{newImgs,newImgId}=addDeckImage(s.deckImages||[],s.decks,deckId,imageData);retId=newImgId;const newImg=newImgs.find(i=>i.id===newImgId);if(newImg)idbPut(newImg).catch(()=>{});const next={...s,deckImages:newImgs,decks:s.decks.map(d=>d.id===deckId?{...d,currentImageId:newImgId}:d)};save(next);return next;});return retId;}} onDeleteImage={(imgId,deckId)=>{idbDelete(imgId).catch(()=>{});setSt(s=>{const newImgs=s.deckImages.filter(i=>i.id!==imgId);const deck=s.decks.find(d=>d.id===deckId);const newCurrentId=deck?.currentImageId===imgId?(newImgs.filter(i=>i.deckId===deckId).sort((a,b)=>b.createdAt.localeCompare(a.createdAt))[0]?.id||null):deck?.currentImageId;const next={...s,deckImages:newImgs,decks:s.decks.map(d=>d.id===deckId?{...d,currentImageId:newCurrentId}:d)};save(next);return next;});}} onSetCurrentImage={(deckId,imgId)=>{setSt(s=>({...s,decks:s.decks.map(d=>d.id===deckId?{...d,currentImageId:imgId}:d)}));}} onDelete={()=>{setDeleteDeckTarget(deckDetail.id);}} allDecks={st.decks} />}
      {showMerge&&<MergeModal allNames={allOpponentNames} onMerge={handleMerge} onCancel={()=>setShowMerge(false)} initialSelected={mergeInitial} />}
      {showMergeDeck&&<DeckMergeModal decks={st.decks} selectedIds={checkedDecks} deckImages={st.deckImages||[]} onMerge={handleMergeDecks} onCancel={()=>setShowMergeDeck(false)}/>}
    </div>
  );
}
