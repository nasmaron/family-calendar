import { useState, useEffect } from "react";

const SUPABASE_URL = "https://nkjioctnuuebomqxxlvb.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5ramlvY3RudXVlYm9tcXh4bHZiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg3NTk4MTgsImV4cCI6MjA5NDMzNTgxOH0.rV7j1OjN_Iy4aRq1tSWinhINRxut1vHrYcFetO6mymc";
const HEADERS = {
  "Content-Type": "application/json",
  "apikey": SUPABASE_KEY,
  "Authorization": "Bearer " + SUPABASE_KEY,
};

async function dbGet(key) {
  const res = await fetch(SUPABASE_URL + "/rest/v1/family_data?key=eq." + key + "&select=value", { headers: HEADERS });
  const data = await res.json();
  return data.length > 0 ? data[0].value : null;
}

async function dbSet(key, value) {
  await fetch(SUPABASE_URL + "/rest/v1/family_data", {
    method: "POST",
    headers: { ...HEADERS, "Prefer": "resolution=merge-duplicates" },
    body: JSON.stringify({ key, value, updated_at: new Date().toISOString() }),
  });
}

const DEFAULT_MEMBERS = [
  { id: "mom", name: "ママ", color: "#FF6B9D", emoji: "🌸" },
  { id: "dad", name: "パパ", color: "#4ECDC4", emoji: "🌊" },
  { id: "child1", name: "太郎", color: "#FFD93D", emoji: "⭐" },
  { id: "child2", name: "花子", color: "#A8E6CF", emoji: "🌿" },
];

const CATEGORY_COLORS = [
  "#FF6B9D","#FF8C42","#FFD93D","#6BCB77",
  "#4ECDC4","#4D96FF","#9B59B6","#E74C3C",
];

const MEMBER_COLORS = [
  "#FF6B9D","#FF8C42","#FFD93D","#6BCB77",
  "#4ECDC4","#4D96FF","#9B59B6","#E74C3C",
  "#A8E6CF","#FF9FF3","#54A0FF","#5F27CD",
];

const MEMBER_EMOJIS = [
  "🌸","🌊","⭐","🌿","🐻","🦊","🐱","🐶",
  "🦁","🐼","🐸","🦋","🌈","🍀","🔥","💎",
  "🎸","🎨","🚀","👑","🌺","🍉","🎯","🏆",
];

const EVENT_EMOJIS = ["📅","🎂","🎵","⚽","🌸","✈️","🏠","🍽️","📚","💊","🎹","🎭","🛒","🌿","⭐","🎉","🤝","🏖️","🎓","💼"];

const DAYS_JP = ["日","月","火","水","木","金","土"];
const MONTHS_JP = ["1月","2月","3月","4月","5月","6月","7月","8月","9月","10月","11月","12月"];

const defaultEvents = [
  { id: "e1", title: "家族でピクニック", date: "2026-05-17", members: ["mom","dad","child1","child2"], color: "#6BCB77", emoji: "🌳", memo: "お弁当を持参" },
  { id: "e2", title: "太郎 サッカー練習", date: "2026-05-19", members: ["child1"], color: "#4D96FF", emoji: "⚽", memo: "" },
  { id: "e3", title: "ママ 美容院", date: "2026-05-21", members: ["mom"], color: "#FF6B9D", emoji: "✂️", memo: "14:00〜" },
  { id: "e4", title: "花子 ピアノ発表会", date: "2026-05-23", members: ["child2","mom"], color: "#9B59B6", emoji: "🎹", memo: "ホール大会議室" },
  { id: "e5", title: "パパ 出張", date: "2026-05-26", members: ["dad"], color: "#4ECDC4", emoji: "✈️", memo: "大阪→東京" },
  { id: "e6", title: "誕生日パーティー🎂", date: "2026-05-30", members: ["mom","dad","child1","child2"], color: "#FF8C42", emoji: "🎂", memo: "花子の誕生日！" },
];

function getDaysInMonth(y, m) { return new Date(y, m + 1, 0).getDate(); }
function getFirstDay(y, m) { return new Date(y, m, 1).getDay(); }

function MemberEditForm({ memberForm, setMemberForm, isNewMember, onSave, onDelete, onBack }) {
  return (
    <div style={{ flex:1, overflow:"auto", padding:"20px 16px" }}>
      <div style={{ display:"flex", justifyContent:"center", marginBottom:24 }}>
        <div style={{
          width:80, height:80, borderRadius:"50%",
          background:memberForm.color+"22", border:`3px solid ${memberForm.color}`,
          display:"flex", alignItems:"center", justifyContent:"center", fontSize:"40px",
        }}>{memberForm.emoji}</div>
      </div>

      <div style={{ marginBottom:16 }}>
        <div style={{ fontSize:"12px", fontWeight:"700", color:"#9A8FAA", marginBottom:6 }}>名前 *</div>
        <input
          value={memberForm.name}
          onChange={e => setMemberForm(f => ({ ...f, name: e.target.value }))}
          placeholder="名前を入力"
          style={{
            width:"100%", padding:"12px 16px", borderRadius:"14px",
            border:"2px solid #f0e6ff", fontSize:"16px", outline:"none",
            boxSizing:"border-box", color:"#3D2B5E",
          }}
        />
      </div>

      <div style={{ marginBottom:16 }}>
        <div style={{ fontSize:"12px", fontWeight:"700", color:"#9A8FAA", marginBottom:8 }}>アイコン</div>
        <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
          {MEMBER_EMOJIS.map(em => (
            <button key={em} onClick={() => setMemberForm(f => ({ ...f, emoji:em }))} style={{
              width:40, height:40, borderRadius:"12px",
              border: memberForm.emoji===em?"2px solid #9B59B6":"2px solid transparent",
              background: memberForm.emoji===em?"#f3e8ff":"#faf7ff",
              fontSize:"20px", cursor:"pointer",
            }}>{em}</button>
          ))}
        </div>
      </div>

      <div style={{ marginBottom:28 }}>
        <div style={{ fontSize:"12px", fontWeight:"700", color:"#9A8FAA", marginBottom:8 }}>カラー</div>
        <div style={{ display:"flex", gap:10, flexWrap:"wrap" }}>
          {MEMBER_COLORS.map(c => (
            <button key={c} onClick={() => setMemberForm(f => ({ ...f, color:c }))} style={{
              width:32, height:32, borderRadius:"50%", background:c, border:"none",
              cursor:"pointer", outline: memberForm.color===c?`3px solid ${c}`:"none", outlineOffset:3,
            }} />
          ))}
        </div>
      </div>

      <div style={{ display:"flex", gap:10 }}>
        {!isNewMember && (
          <button onClick={onDelete} style={{
            flex:1, padding:"14px", borderRadius:"16px",
            background:"#fff", border:"2px solid #ffcccc", color:"#e74c3c",
            fontWeight:"700", fontSize:"15px", cursor:"pointer",
          }}>🗑 削除</button>
        )}
        <button onClick={onSave} style={{
          flex:2, padding:"14px", borderRadius:"16px",
          background:"linear-gradient(135deg, #9B59B6, #E91E8C)",
          border:"none", color:"#fff", fontWeight:"700", fontSize:"15px", cursor:"pointer",
          boxShadow:"0 4px 15px rgba(155,89,182,0.3)",
        }}>{isNewMember ? "追加する" : "更新する"}</button>
      </div>
    </div>
  );
}

export default function FamilyCalendar() {
  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,"0")}-${String(today.getDate()).padStart(2,"0")}`;

  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());
  const [events, setEvents] = useState([]);
  const [members, setMembers] = useState(DEFAULT_MEMBERS);
  const [view, setView] = useState("month");
  const [selectedDate, setSelectedDate] = useState(null);
  const [filterMember, setFilterMember] = useState("all");
  const [saving, setSaving] = useState(false);
  const [notification, setNotification] = useState(null);

  const [showEventModal, setShowEventModal] = useState(false);
  const [editingEvent, setEditingEvent] = useState(null);
  const [form, setForm] = useState({ title:"", date:"", members:[], color:"#4D96FF", emoji:"📅", memo:"" });

  const [showSettings, setShowSettings] = useState(false);
  const [editingMember, setEditingMember] = useState(null);
  const [memberForm, setMemberForm] = useState({ name:"", color:"#FF6B9D", emoji:"🌸" });
  const [isNewMember, setIsNewMember] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const evVal = await dbGet("family_events");
        setEvents(evVal ? JSON.parse(evVal) : defaultEvents);
      } catch { setEvents(defaultEvents); }
      try {
        const mVal = await dbGet("family_members");
        if (mVal) setMembers(JSON.parse(mVal));
      } catch {}
    })();
  }, []);

  const saveEvents = async (evs) => {
    setSaving(true);
    try { await dbSet("family_events", JSON.stringify(evs)); } catch {}
    setSaving(false);
  };
  const saveMembers = async (mbs) => {
    try { await dbSet("family_members", JSON.stringify(mbs)); } catch {}
  };

  const showNotif = (msg) => {
    setNotification(msg);
    setTimeout(() => setNotification(null), 2000);
  };

  const openAdd = (date) => {
    const d = date || selectedDate || todayStr;
    setEditingEvent(null);
    setForm({ title:"", date:d, members:[], color:"#4D96FF", emoji:"📅", memo:"" });
    setShowEventModal(true);
  };
  const openEdit = (ev) => {
    setEditingEvent(ev);
    setForm({ ...ev });
    setShowEventModal(true);
  };
  const saveForm = async () => {
    if (!form.title.trim() || !form.date) return;
    const newEvents = editingEvent
      ? events.map(e => e.id === editingEvent.id ? { ...form, id: e.id } : e)
      : [...events, { ...form, id: "e" + Date.now() }];
    setEvents(newEvents);
    await saveEvents(newEvents);
    setShowEventModal(false);
    showNotif(editingEvent ? "更新しました✨" : "追加しました🎉");
  };
  const deleteEvent = async (id) => {
    const newEvents = events.filter(e => e.id !== id);
    setEvents(newEvents);
    await saveEvents(newEvents);
    setShowEventModal(false);
    showNotif("削除しました");
  };

  const openNewMember = () => {
    setIsNewMember(true);
    setMemberForm({ name:"", color:"#FF6B9D", emoji:"🌸" });
    setEditingMember({});
  };
  const openEditMember = (m) => {
    setIsNewMember(false);
    setMemberForm({ name:m.name, color:m.color, emoji:m.emoji });
    setEditingMember(m);
  };
  const saveMember = async () => {
    if (!memberForm.name.trim()) return;
    let newMembers;
    if (isNewMember) {
      newMembers = [...members, { id:"m"+Date.now(), ...memberForm }];
    } else {
      newMembers = members.map(m => m.id===editingMember.id ? { ...m, ...memberForm } : m);
    }
    setMembers(newMembers);
    await saveMembers(newMembers);
    setEditingMember(null);
    showNotif(isNewMember ? "メンバーを追加しました" : "更新しました✨");
  };
  const deleteMember = async (id) => {
    const newMembers = members.filter(m => m.id !== id);
    setMembers(newMembers);
    await saveMembers(newMembers);
    setEditingMember(null);
    showNotif("削除しました");
  };

  const prevMonth = () => { if (month===0){setYear(y=>y-1);setMonth(11);}else setMonth(m=>m-1); };
  const nextMonth = () => { if (month===11){setYear(y=>y+1);setMonth(0);}else setMonth(m=>m+1); };
  const dateStr = (d) => `${year}-${String(month+1).padStart(2,"0")}-${String(d).padStart(2,"0")}`;
  const getEventsForDate = (ds) =>
    events.filter(e => e.date===ds && (filterMember==="all" || e.members.includes(filterMember)));

  const daysInMonth = getDaysInMonth(year, month);
  const firstDay = getFirstDay(year, month);

  const addBtnStyle = {
    display:"block", margin:"16px auto 0", padding:"10px 28px",
    background:"linear-gradient(135deg, #9B59B6, #E91E8C)",
    color:"#fff", border:"none", borderRadius:"30px", fontSize:"14px",
    fontWeight:"700", cursor:"pointer",
    boxShadow:"0 4px 15px rgba(155,89,182,0.3)",
  };

  const MonthView = () => {
    const cells = [];
    for (let i = 0; i < firstDay; i++) cells.push(null);
    for (let d = 1; d <= daysInMonth; d++) cells.push(d);
    return (
      <div style={{ flex:1, overflow:"auto" }}>
        <div style={{ display:"grid", gridTemplateColumns:"repeat(7,1fr)", gridTemplateRows:"34px", gridAutoRows:"90px" }}>
          {DAYS_JP.map((d,i) => (
            <div key={d} style={{
              position:"sticky", top:0, zIndex:10,
              background:"#fff", borderBottom:"2px solid #f0e6ff",
              textAlign:"center", lineHeight:"34px", fontSize:"12px", fontWeight:"700",
              color: i===0?"#FF6B9D": i===6?"#4D96FF":"#9A8FAA",
            }}>{d}</div>
          ))}
          {cells.map((d, idx) => {
            if (!d) return <div key={"e"+idx} style={{ borderRight:"1px solid #f0e6ff", borderBottom:"1px solid #f0e6ff", background:"#faf7ff" }} />;
            const ds = dateStr(d);
            const dayEvents = getEventsForDate(ds);
            const isToday = ds===todayStr;
            const dow = (firstDay + d - 1) % 7;
            return (
              <div key={ds} onClick={() => { setSelectedDate(ds); setView("day"); }}
                style={{
                  borderRight:"1px solid #f0e6ff", borderBottom:"1px solid #f0e6ff",
                  padding:"6px 4px", cursor:"pointer", overflow:"hidden",
                  background: selectedDate===ds?"#f3e8ff":"#fff",
                }}
                onMouseEnter={e => e.currentTarget.style.background="#faf3ff"}
                onMouseLeave={e => e.currentTarget.style.background=selectedDate===ds?"#f3e8ff":"#fff"}
              >
                <div style={{
                  width:26, height:26, borderRadius:"50%",
                  display:"flex", alignItems:"center", justifyContent:"center",
                  background: isToday?"#9B59B6":"transparent",
                  color: isToday?"#fff": dow===0?"#FF6B9D": dow===6?"#4D96FF":"#3D2B5E",
                  fontWeight: isToday?"700":"500", fontSize:"13px", marginBottom:2,
                }}>{d}</div>
                {dayEvents.slice(0,3).map(ev => (
                  <div key={ev.id} onClick={e => { e.stopPropagation(); openEdit(ev); }}
                    style={{
                      background:ev.color+"22", borderLeft:`3px solid ${ev.color}`,
                      borderRadius:"4px", padding:"1px 4px", marginBottom:2,
                      fontSize:"10px", color:"#3D2B5E", fontWeight:"600",
                      whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis",
                    }}>
                    {ev.emoji} {ev.title}
                  </div>
                ))}
                {dayEvents.length > 3 && <div style={{ fontSize:"10px", color:"#9B59B6", fontWeight:"700" }}>+{dayEvents.length-3}件</div>}
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const DayView = () => {
    const dayEvents = selectedDate ? getEventsForDate(selectedDate) : [];
    const dp = selectedDate ? selectedDate.split("-") : [];
    return (
      <div style={{ flex:1, overflow:"auto", padding:"16px" }}>
        {selectedDate && (
          <div style={{ marginBottom:16 }}>
            <div style={{ fontSize:"22px", fontWeight:"800", color:"#3D2B5E" }}>
              {dp[1]}月{dp[2]}日
              <span style={{ fontSize:"14px", color:"#9A8FAA", marginLeft:8 }}>{DAYS_JP[new Date(selectedDate).getDay()]}曜日</span>
            </div>
          </div>
        )}
        {dayEvents.length===0 ? (
          <div style={{ textAlign:"center", padding:"48px 0", color:"#C9B8E8" }}>
            <div style={{ fontSize:"48px", marginBottom:12 }}>📭</div>
            <div style={{ fontSize:"14px" }}>予定はありません</div>
            <button onClick={() => openAdd(selectedDate)} style={addBtnStyle}>＋ 追加する</button>
          </div>
        ) : (
          <>
            {dayEvents.map(ev => (
              <div key={ev.id} onClick={() => openEdit(ev)}
                style={{
                  background:"#fff", borderRadius:"16px", padding:"16px", marginBottom:12,
                  borderLeft:`5px solid ${ev.color}`,
                  boxShadow:"0 2px 12px rgba(155,89,182,0.08)", cursor:"pointer", transition:"transform 0.15s",
                }}
                onMouseEnter={e => e.currentTarget.style.transform="translateX(4px)"}
                onMouseLeave={e => e.currentTarget.style.transform=""}
              >
                <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:8 }}>
                  <span style={{ fontSize:"24px" }}>{ev.emoji}</span>
                  <div style={{ fontWeight:"700", fontSize:"16px", color:"#3D2B5E" }}>{ev.title}</div>
                </div>
                {ev.memo && <div style={{ fontSize:"13px", color:"#9A8FAA", marginBottom:8 }}>{ev.memo}</div>}
                <div style={{ display:"flex", gap:6, flexWrap:"wrap" }}>
                  {ev.members.map(mid => {
                    const m = members.find(x => x.id===mid);
                    return m ? (
                      <span key={mid} style={{
                        background:m.color+"22", color:m.color, borderRadius:"20px",
                        padding:"2px 10px", fontSize:"12px", fontWeight:"700",
                      }}>{m.emoji} {m.name}</span>
                    ) : null;
                  })}
                </div>
              </div>
            ))}
            <button onClick={() => openAdd(selectedDate)} style={addBtnStyle}>＋ 予定を追加</button>
          </>
        )}
      </div>
    );
  };

  const ListView = () => {
    const monthEvents = events
      .filter(e => {
        const [y,m] = e.date.split("-").map(Number);
        return y===year && m===month+1 && (filterMember==="all" || e.members.includes(filterMember));
      })
      .sort((a,b) => a.date.localeCompare(b.date));
    const grouped = {};
    monthEvents.forEach(ev => { if (!grouped[ev.date]) grouped[ev.date]=[]; grouped[ev.date].push(ev); });
    return (
      <div style={{ flex:1, overflow:"auto", padding:"16px" }}>
        {Object.keys(grouped).length===0 ? (
          <div style={{ textAlign:"center", padding:"48px 0", color:"#C9B8E8" }}>
            <div style={{ fontSize:"48px", marginBottom:12 }}>📋</div>
            <div>今月の予定はありません</div>
          </div>
        ) : Object.entries(grouped).map(([date,evs]) => {
          const dp = date.split("-");
          return (
            <div key={date} style={{ marginBottom:20 }}>
              <div style={{ fontWeight:"800", fontSize:"14px", color:"#9B59B6", marginBottom:8, paddingLeft:4 }}>
                {dp[1]}月{dp[2]}日（{DAYS_JP[new Date(date).getDay()]}）
              </div>
              {evs.map(ev => (
                <div key={ev.id} onClick={() => openEdit(ev)}
                  style={{
                    background:"#fff", borderRadius:"14px", padding:"14px", marginBottom:8,
                    borderLeft:`4px solid ${ev.color}`,
                    boxShadow:"0 2px 8px rgba(155,89,182,0.07)", cursor:"pointer",
                    display:"flex", alignItems:"center", gap:12,
                  }}>
                  <span style={{ fontSize:"22px" }}>{ev.emoji}</span>
                  <div style={{ flex:1 }}>
                    <div style={{ fontWeight:"700", color:"#3D2B5E", fontSize:"15px" }}>{ev.title}</div>
                    {ev.memo && <div style={{ fontSize:"12px", color:"#9A8FAA" }}>{ev.memo}</div>}
                  </div>
                  <div style={{ display:"flex", gap:4 }}>
                    {ev.members.map(mid => {
                      const m = members.find(x => x.id===mid);
                      return m ? <span key={mid} style={{ fontSize:"16px" }} title={m.name}>{m.emoji}</span> : null;
                    })}
                  </div>
                </div>
              ))}
            </div>
          );
        })}
      </div>
    );
  };

  const settingsScreenJSX = (
    <div style={{
      position:"fixed", inset:0, background:"#fff", zIndex:400,
      display:"flex", flexDirection:"column",
      fontFamily:"'Hiragino Kaku Gothic ProN','Hiragino Sans',sans-serif",
    }}>
      <div style={{
        background:"linear-gradient(135deg, #9B59B6 0%, #E91E8C 100%)",
        padding:"16px",
        display:"flex", alignItems:"center", gap:12,
      }}>
        <button onClick={() => { setShowSettings(false); setEditingMember(null); }}
          style={{ background:"rgba(255,255,255,0.2)", border:"none", color:"#fff", borderRadius:"50%", width:36, height:36, fontSize:"20px", cursor:"pointer" }}>
          ‹
        </button>
        <div style={{ color:"#fff", fontWeight:"800", fontSize:"18px" }}>
          {editingMember ? (isNewMember ? "メンバーを追加" : "メンバーを編集") : "メンバー設定"}
        </div>
        {editingMember && (
          <button onClick={() => setEditingMember(null)}
            style={{ marginLeft:"auto", background:"rgba(255,255,255,0.2)", border:"none", color:"#fff", borderRadius:"20px", padding:"4px 12px", fontSize:"12px", cursor:"pointer" }}>
            一覧に戻る
          </button>
        )}
      </div>

      {!editingMember && (
        <div style={{ flex:1, overflow:"auto", padding:"20px 16px" }}>
          <div style={{ fontSize:"12px", fontWeight:"700", color:"#9A8FAA", marginBottom:12, letterSpacing:"1px" }}>メンバー一覧</div>
          {members.map(m => (
            <div key={m.id} onClick={() => openEditMember(m)}
              style={{
                display:"flex", alignItems:"center", gap:14,
                background:"#fff", borderRadius:"16px", padding:"14px 16px", marginBottom:10,
                cursor:"pointer", boxShadow:"0 2px 12px rgba(155,89,182,0.08)", border:"1px solid #f0e6ff",
              }}
              onMouseEnter={e => e.currentTarget.style.background="#faf3ff"}
              onMouseLeave={e => e.currentTarget.style.background="#fff"}
            >
              <div style={{
                width:44, height:44, borderRadius:"50%",
                background:m.color+"22", border:`2px solid ${m.color}`,
                display:"flex", alignItems:"center", justifyContent:"center", fontSize:"22px",
              }}>{m.emoji}</div>
              <div style={{ flex:1 }}>
                <div style={{ fontWeight:"700", fontSize:"16px", color:"#3D2B5E" }}>{m.name}</div>
                <div style={{ width:12, height:12, borderRadius:"50%", background:m.color, display:"inline-block", marginTop:4 }} />
              </div>
              <div style={{ color:"#C9B8E8", fontSize:"20px" }}>›</div>
            </div>
          ))}
          <button onClick={openNewMember} style={{
            width:"100%", padding:"14px", borderRadius:"16px", marginTop:8,
            background:"linear-gradient(135deg, #9B59B6, #E91E8C)",
            border:"none", color:"#fff", fontWeight:"700", fontSize:"15px", cursor:"pointer",
            boxShadow:"0 4px 15px rgba(155,89,182,0.3)",
          }}>＋ メンバーを追加</button>
        </div>
      )}

      {editingMember && (
        <MemberEditForm
          memberForm={memberForm}
          setMemberForm={setMemberForm}
          isNewMember={isNewMember}
          onSave={saveMember}
          onDelete={() => deleteMember(editingMember.id)}
          onBack={() => setEditingMember(null)}
        />
      )}
    </div>
  );

  return (
    <div style={{
      height:"100vh", display:"flex", flexDirection:"column",
      background:"linear-gradient(160deg, #FAF0FF 0%, #F0EAFF 50%, #EAF4FF 100%)",
      fontFamily:"'Hiragino Kaku Gothic ProN','Hiragino Sans',sans-serif",
      overflow:"hidden",
    }}>
      <div style={{
        background:"linear-gradient(135deg, #9B59B6 0%, #E91E8C 100%)",
        padding:"0 16px", boxShadow:"0 4px 20px rgba(155,89,182,0.3)",
      }}>
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", paddingTop:12, paddingBottom:8 }}>
          <div style={{ display:"flex", alignItems:"center", gap:8 }}>
            <span style={{ fontSize:"22px" }}>🏠</span>
            <div>
              <div style={{ color:"#fff", fontWeight:"900", fontSize:"18px" }}>ファミリー</div>
              <div style={{ color:"rgba(255,255,255,0.7)", fontSize:"10px", letterSpacing:"2px" }}>FAMILY CALENDAR</div>
            </div>
          </div>
          <div style={{ display:"flex", gap:8, alignItems:"center" }}>
            {saving && <span style={{ color:"rgba(255,255,255,0.8)", fontSize:"11px" }}>保存中…</span>}
            <button onClick={() => { setShowSettings(true); setEditingMember(null); }} style={{
              background:"rgba(255,255,255,0.2)", border:"1px solid rgba(255,255,255,0.4)",
              color:"#fff", borderRadius:"50%", width:34, height:34, fontSize:"16px", cursor:"pointer",
              display:"flex", alignItems:"center", justifyContent:"center",
            }}>⚙️</button>
            <button onClick={() => openAdd()} style={{
              background:"rgba(255,255,255,0.25)", border:"1px solid rgba(255,255,255,0.4)",
              color:"#fff", borderRadius:"20px", padding:"6px 16px", fontSize:"13px",
              fontWeight:"700", cursor:"pointer",
            }}>＋ 追加</button>
          </div>
        </div>

        <div style={{ display:"flex", alignItems:"center", justifyContent:"center", gap:20, paddingBottom:10 }}>
          <button onClick={prevMonth} style={{ background:"none", border:"none", color:"#fff", fontSize:"20px", cursor:"pointer" }}>‹</button>
          <div style={{ color:"#fff", fontWeight:"800", fontSize:"20px" }}>{year}年 {MONTHS_JP[month]}</div>
          <button onClick={nextMonth} style={{ background:"none", border:"none", color:"#fff", fontSize:"20px", cursor:"pointer" }}>›</button>
          <button onClick={() => { setYear(today.getFullYear()); setMonth(today.getMonth()); setSelectedDate(todayStr); setView("month"); }}
            style={{ background:"rgba(255,255,255,0.2)", border:"none", color:"#fff", borderRadius:"12px", padding:"4px 10px", fontSize:"11px", cursor:"pointer" }}>
            今日
          </button>
        </div>

        <div style={{ display:"flex", gap:6, paddingBottom:10, overflowX:"auto" }}>
          <button onClick={() => setFilterMember("all")} style={{
            background: filterMember==="all"?"rgba(255,255,255,0.9)":"rgba(255,255,255,0.2)",
            color: filterMember==="all"?"#9B59B6":"#fff",
            border:"none", borderRadius:"20px", padding:"4px 14px", fontSize:"12px",
            fontWeight:"700", cursor:"pointer", whiteSpace:"nowrap",
          }}>全員</button>
          {members.map(m => (
            <button key={m.id} onClick={() => setFilterMember(filterMember===m.id?"all":m.id)} style={{
              background: filterMember===m.id?"rgba(255,255,255,0.9)":"rgba(255,255,255,0.2)",
              color: filterMember===m.id?m.color:"#fff",
              border:"none", borderRadius:"20px", padding:"4px 14px", fontSize:"12px",
              fontWeight:"700", cursor:"pointer", whiteSpace:"nowrap",
            }}>{m.emoji} {m.name}</button>
          ))}
        </div>

        <div style={{ display:"flex", gap:2 }}>
          {[["month","月"],["day","日"],["list","一覧"]].map(([v,label]) => (
            <button key={v} onClick={() => setView(v)} style={{
              flex:1, background: view===v?"rgba(255,255,255,0.95)":"transparent",
              color: view===v?"#9B59B6":"rgba(255,255,255,0.8)",
              border:"none", padding:"8px 0", fontSize:"13px", fontWeight:"700",
              cursor:"pointer", borderRadius:"12px 12px 0 0", transition:"all 0.2s",
            }}>{label}表示</button>
          ))}
        </div>
      </div>

      <div style={{ flex:1, display:"flex", flexDirection:"column", overflow:"hidden", background:"#fff" }}>
        {view==="month" && <MonthView />}
        {view==="day" && (
          selectedDate
            ? <DayView />
            : <div style={{ flex:1, display:"flex", alignItems:"center", justifyContent:"center", color:"#C9B8E8", flexDirection:"column", gap:12 }}>
                <div style={{ fontSize:"48px" }}>📅</div>
                <div>月表示から日付を選択してください</div>
              </div>
        )}
        {view==="list" && <ListView />}
      </div>

      <button onClick={() => openAdd(selectedDate || todayStr)} style={{
        position:"fixed", bottom:24, right:24,
        width:56, height:56, borderRadius:"50%",
        background:"linear-gradient(135deg, #9B59B6, #E91E8C)",
        border:"none", color:"#fff", fontSize:"28px", cursor:"pointer",
        boxShadow:"0 6px 24px rgba(155,89,182,0.5)",
        display:"flex", alignItems:"center", justifyContent:"center", zIndex:100,
      }}>＋</button>

      {notification && (
        <div style={{
          position:"fixed", top:20, left:"50%", transform:"translateX(-50%)",
          background:"#3D2B5E", color:"#fff", borderRadius:"20px", padding:"10px 24px",
          fontSize:"14px", fontWeight:"700", zIndex:500, boxShadow:"0 4px 20px rgba(0,0,0,0.2)",
        }}>{notification}</div>
      )}

      {showSettings && settingsScreenJSX}

      {showEventModal && (
        <div style={{
          position:"fixed", inset:0, background:"rgba(61,43,94,0.5)", zIndex:300,
          display:"flex", alignItems:"flex-end", backdropFilter:"blur(4px)",
          overflowX:"hidden", touchAction:"pan-y",
        }} onClick={() => setShowEventModal(false)}>
          <div style={{
            background:"#fff", borderRadius:"24px 24px 0 0", width:"100%",
            maxHeight:"90vh", overflowY:"auto", overflowX:"hidden", padding:"24px 20px 40px",
            boxShadow:"0 -8px 40px rgba(155,89,182,0.2)", boxSizing:"border-box",
            touchAction:"pan-y",
          }} onClick={e => e.stopPropagation()}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:20 }}>
              <div style={{ fontWeight:"800", fontSize:"18px", color:"#3D2B5E" }}>
                {editingEvent ? "予定を編集" : "予定を追加"}
              </div>
              <button onClick={() => setShowEventModal(false)} style={{ background:"none", border:"none", fontSize:"24px", cursor:"pointer", color:"#9A8FAA" }}>×</button>
            </div>

            <div style={{ marginBottom:16 }}>
              <div style={{ fontSize:"12px", fontWeight:"700", color:"#9A8FAA", marginBottom:8 }}>アイコン</div>
              <div style={{ display:"flex", gap:8, flexWrap:"wrap", maxWidth:"100%", overflowX:"hidden" }}>
                {EVENT_EMOJIS.map(em => (
                  <button key={em} onClick={() => setForm(f => ({ ...f, emoji:em }))} style={{
                    width:36, height:36, borderRadius:"10px",
                    border: form.emoji===em?"2px solid #9B59B6":"2px solid transparent",
                    background: form.emoji===em?"#f3e8ff":"#faf7ff",
                    fontSize:"18px", cursor:"pointer",
                  }}>{em}</button>
                ))}
              </div>
            </div>

            <div style={{ marginBottom:14 }}>
              <div style={{ fontSize:"12px", fontWeight:"700", color:"#9A8FAA", marginBottom:6 }}>タイトル *</div>
              <input value={form.title} onChange={e => setForm(f => ({ ...f, title:e.target.value }))}
                placeholder="予定のタイトル" style={{
                  width:"100%", padding:"12px 16px", borderRadius:"14px",
                  border:"2px solid #f0e6ff", fontSize:"16px", outline:"none",
                  boxSizing:"border-box", color:"#3D2B5E",
                }} />
            </div>

            <div style={{ marginBottom:14 }}>
              <div style={{ fontSize:"12px", fontWeight:"700", color:"#9A8FAA", marginBottom:6 }}>日付 *</div>
              <input type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date:e.target.value }))}
                style={{
                  width:"100%", padding:"12px 16px", borderRadius:"14px",
                  border:"2px solid #f0e6ff", fontSize:"16px", outline:"none",
                  boxSizing:"border-box", color:"#3D2B5E",
                }} />
            </div>

            <div style={{ marginBottom:14 }}>
              <div style={{ fontSize:"12px", fontWeight:"700", color:"#9A8FAA", marginBottom:8 }}>参加メンバー</div>
              <div style={{ display:"flex", gap:8, flexWrap:"wrap", maxWidth:"100%", overflowX:"hidden" }}>
                {members.map(m => (
                  <button key={m.id} onClick={() => setForm(f => ({
                    ...f, members: f.members.includes(m.id)
                      ? f.members.filter(x => x!==m.id) : [...f.members, m.id]
                  }))} style={{
                    padding:"6px 14px", borderRadius:"20px", border:"2px solid",
                    borderColor: form.members.includes(m.id)?m.color:"#e0d6f0",
                    background: form.members.includes(m.id)?m.color+"22":"#faf7ff",
                    color: form.members.includes(m.id)?m.color:"#9A8FAA",
                    fontWeight:"700", fontSize:"13px", cursor:"pointer",
                  }}>{m.emoji} {m.name}</button>
                ))}
              </div>
            </div>

            <div style={{ marginBottom:14 }}>
              <div style={{ fontSize:"12px", fontWeight:"700", color:"#9A8FAA", marginBottom:8 }}>カラー</div>
              <div style={{ display:"flex", gap:8 }}>
                {CATEGORY_COLORS.map(c => (
                  <button key={c} onClick={() => setForm(f => ({ ...f, color:c }))} style={{
                    width:28, height:28, borderRadius:"50%", background:c, border:"none",
                    cursor:"pointer", outline: form.color===c?`3px solid ${c}`:"none", outlineOffset:2,
                  }} />
                ))}
              </div>
            </div>

            <div style={{ marginBottom:24 }}>
              <div style={{ fontSize:"12px", fontWeight:"700", color:"#9A8FAA", marginBottom:6 }}>メモ</div>
              <textarea value={form.memo} onChange={e => setForm(f => ({ ...f, memo:e.target.value }))}
                placeholder="メモを入力" rows={3} style={{
                  width:"100%", padding:"12px 16px", borderRadius:"14px",
                  border:"2px solid #f0e6ff", fontSize:"14px", outline:"none",
                  boxSizing:"border-box", color:"#3D2B5E", resize:"none",
                }} />
            </div>

            <div style={{ display:"flex", gap:10 }}>
              {editingEvent && (
                <button onClick={() => deleteEvent(editingEvent.id)} style={{
                  flex:1, padding:"14px", borderRadius:"16px",
                  background:"#fff", border:"2px solid #ffcccc", color:"#e74c3c",
                  fontWeight:"700", fontSize:"15px", cursor:"pointer",
                }}>🗑 削除</button>
              )}
              <button onClick={saveForm} style={{
                flex:2, padding:"14px", borderRadius:"16px",
                background:"linear-gradient(135deg, #9B59B6, #E91E8C)",
                border:"none", color:"#fff", fontWeight:"700", fontSize:"15px", cursor:"pointer",
                boxShadow:"0 4px 15px rgba(155,89,182,0.3)",
              }}>{editingEvent ? "更新する" : "追加する"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
