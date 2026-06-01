import { useState, useEffect, useRef } from "react";

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

const DEFAULT_CATEGORIES = [
  { id: "c1", name: "仕事", color: "#4D96FF" },
  { id: "c2", name: "家族", color: "#6BCB77" },
  { id: "c3", name: "趣味", color: "#FF8C42" },
  { id: "c4", name: "医療", color: "#E74C3C" },
  { id: "c5", name: "学校", color: "#FFD93D" },
  { id: "c6", name: "その他", color: "#9B59B6" },
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

const EVENT_EMOJIS = ["📅","🎂","🎵","⚽","🌸","✈️","🏠","🍽️","📚","💊","🎹","🎭","🛒","🌿","⭐","🎉","🤝","🏖️","🎓","💼","🍺","👶","🃏","🎪","🏥","🚗","💕","🍜","🎯","🔑"];

const DAYS_JP = ["日","月","火","水","木","金","土"];
const MONTHS_JP = ["1月","2月","3月","4月","5月","6月","7月","8月","9月","10月","11月","12月"];

// 春分・秋分の日を天文計算で求める
function getShunbun(year) {
  const x = year >= 2000
    ? 20.8431 + 0.242194 * (year - 1980) - Math.floor((year - 1980) / 4)
    : 20.8357 + 0.242194 * (year - 1980) - Math.floor((year - 1980) / 4);
  return Math.floor(x);
}
function getShubun(year) {
  const x = year >= 2000
    ? 23.2488 + 0.242194 * (year - 1980) - Math.floor((year - 1980) / 4)
    : 23.2588 + 0.242194 * (year - 1980) - Math.floor((year - 1980) / 4);
  return Math.floor(x);
}
// 第n月曜日
function nthMonday(year, month, n) {
  let count = 0;
  for (let d = 1; d <= 31; d++) {
    const dt = new Date(year, month - 1, d);
    if (dt.getMonth() !== month - 1) break;
    if (dt.getDay() === 1) { count++; if (count === n) return d; }
  }
}
function pad(n) { return String(n).padStart(2, "0"); }
function fmt(y, m, d) { return y + "-" + pad(m) + "-" + pad(d); }

function getHolidaysForYear(year) {
  const h = {};
  if (year < 1948) return h;

  // 固定祝日
  h[fmt(year,1,1)]  = "元日";
  h[fmt(year,2,11)] = "建国記念の日";
  h[fmt(year,4,29)] = year >= 2007 ? "昭和の日" : year >= 1989 ? "みどりの日" : "天皇誕生日";
  h[fmt(year,5,3)]  = "憲法記念日";
  h[fmt(year,5,4)]  = year >= 2007 ? "みどりの日" : "国民の休日";
  h[fmt(year,5,5)]  = "こどもの日";
  h[fmt(year,8,11)] = "山の日"; // 2016〜
  h[fmt(year,11,3)] = "文化の日";
  h[fmt(year,11,23)]= "勤労感謝の日";
  if (year >= 1989) h[fmt(year,2,23)] = "天皇誕生日";
  if (year <= 1988) h[fmt(year,4,29)] = "天皇誕生日";

  // 春分・秋分
  h[fmt(year,3,getShunbun(year))] = "春分の日";
  h[fmt(year,9,getShubun(year))]  = "秋分の日";

  // ハッピーマンデー（2000年〜）
  if (year >= 2000) {
    h[fmt(year,1,nthMonday(year,1,2))]  = "成人の日";
    h[fmt(year,7,nthMonday(year,7,3))]  = "海の日";
    h[fmt(year,9,nthMonday(year,9,3))]  = "敬老の日";
    h[fmt(year,10,nthMonday(year,10,2))]= "スポーツの日";
  } else {
    h[fmt(year,1,15)]  = "成人の日";
    h[fmt(year,7,20)]  = "海の日";
    h[fmt(year,9,15)]  = "敬老の日";
    h[fmt(year,10,10)] = "体育の日";
  }

  // 振替休日・国民の休日を計算
  const keys = Object.keys(h).sort();
  const extra = {};
  keys.forEach(k => {
    const dt = new Date(k);
    if (dt.getDay() === 0) { // 日曜祝日→翌月曜が振替
      let next = new Date(dt); next.setDate(next.getDate()+1);
      while (h[fmt(next.getFullYear(),next.getMonth()+1,next.getDate())] || extra[fmt(next.getFullYear(),next.getMonth()+1,next.getDate())]) {
        next.setDate(next.getDate()+1);
      }
      extra[fmt(next.getFullYear(),next.getMonth()+1,next.getDate())] = "振替休日";
    }
  });
  // 国民の休日（祝日に挟まれた平日）
  const allKeys = [...keys, ...Object.keys(extra)].sort();
  for (let i = 1; i < allKeys.length - 1; i++) {
    const prev = new Date(allKeys[i-1]);
    const curr = new Date(allKeys[i]);
    const next = new Date(allKeys[i+1]);
    const diffP = (curr - prev) / 86400000;
    const diffN = (next - curr) / 86400000;
    if (diffP === 2 && diffN === 2 && curr.getDay() !== 0) {
      const mid = new Date(prev); mid.setDate(prev.getDate()+1);
      const mk = fmt(mid.getFullYear(),mid.getMonth()+1,mid.getDate());
      if (!h[mk] && !extra[mk]) extra[mk] = "国民の休日";
    }
  }
  return { ...h, ...extra };
}

// キャッシュ付き祝日取得
const _holidayCache = {};
function getHoliday(dateStr) {
  const year = Number(dateStr.slice(0,4));
  if (!_holidayCache[year]) _holidayCache[year] = getHolidaysForYear(year);
  return _holidayCache[year][dateStr] || null;
}




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

function MemberEditForm({ memberForm, setMemberForm, isNewMember, onSave, onDelete, onBack, themeGrad, textSec }) {
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
        <div style={{ fontSize:"12px", fontWeight:"700", color:textSec, marginBottom:8 }}>アイコン</div>
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
          background:themeGrad,
          border:"none", color:"#fff", fontWeight:"700", fontSize:"15px", cursor:"pointer",
          boxShadow:"0 4px 15px rgba(155,89,182,0.3)",
        }}>{isNewMember ? "追加する" : "更新する"}</button>
      </div>
    </div>
  );
}

function MonthView({
  firstDay, daysInMonth, dateStr, todayStr, selectedDate, setSelectedDate,
  getEventsForDate, setView, dragX, setDragX, transitioning, setTransitioning,
  prevMonth, nextMonth, border, bgSub, bg, themeColor, textPri, badgeFontSize,
  DAYS_JP, showBadgeEmoji, setShowEventDetail, weekStartsMonday, badgeEmojiSize
}) {
  const lastTap = useRef({ ds: null, time: 0 });
  const touchStart = useRef(null);
  // 月曜始まりの場合、firstDayを調整
  const adjustedFirstDay = weekStartsMonday ? (firstDay === 0 ? 6 : firstDay - 1) : firstDay;
  const cells = [];
  for (let i = 0; i < adjustedFirstDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  const weeks = Math.ceil((adjustedFirstDay + daysInMonth) / 7);
  const orderedDays = weekStartsMonday
    ? ["月","火","水","木","金","土","日"]
    : DAYS_JP;
  const sunIdx = weekStartsMonday ? 6 : 0;
  const satIdx = weekStartsMonday ? 5 : 6;

  const onTouchStart = (e) => { touchStart.current = e.touches[0].clientX; setDragX(0); };
  const onTouchMove = (e) => {
    if (touchStart.current === null) return;
    setDragX(e.touches[0].clientX - touchStart.current);
  };
  const onTouchEnd = (e) => {
    if (touchStart.current === null) return;
    const diff = e.changedTouches[0].clientX - touchStart.current;
    if (Math.abs(diff) > 60) {
      setTransitioning(true);
      setDragX(diff > 0 ? window.innerWidth : -window.innerWidth);
      setTimeout(() => { diff > 0 ? prevMonth() : nextMonth(); setDragX(0); setTransitioning(false); }, 200);
    } else {
      setTransitioning(true); setDragX(0);
      setTimeout(() => setTransitioning(false), 200);
    }
    touchStart.current = null;
  };

  return (
    <div style={{ flex:1, display:"flex", flexDirection:"column", overflow:"hidden", touchAction:"none", width:"100%", boxSizing:"border-box" }}
      onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd}
    >
      <div style={{ display:"grid", gridTemplateColumns:"repeat(7,1fr)", flexShrink:0, borderBottom:`1px solid ${border}` }}>
        {orderedDays.map((d,i) => (
          <div key={d} style={{ background:bg, textAlign:"center", lineHeight:"24px", fontSize:"11px", fontWeight:"700",
            color: i===sunIdx?"#FF6B9D": i===satIdx?"#4D96FF":"#9A8FAA" }}>{d}</div>
        ))}
      </div>
      <div style={{ flex:1, display:"grid", gridTemplateColumns:"repeat(7,1fr)",
        gridTemplateRows:`repeat(${weeks}, 1fr)`,
        transform:`translateX(${dragX}px)`,
        transition: transitioning ? "transform 0.2s ease" : "none",
        width:"100%", overflow:"hidden" }}>
        {cells.map((d, idx) => {
          if (!d) return <div key={"e"+idx} style={{ borderRight:`1px solid ${border}`, borderBottom:`1px solid ${border}`, background:bgSub }} />;
          const ds = dateStr(d);
          const dayEvents = getEventsForDate(ds);
          const isToday = ds===todayStr;
          const rawDow = new Date(ds).getDay(); // 0=日,6=土
          const holiday = getHoliday(ds);
          const handleTap = () => {
            const now = Date.now();
            if (selectedDate === ds) {
              setView("day");
            } else if (lastTap.current.ds === ds && now - lastTap.current.time < 300) {
              setSelectedDate(ds); setView("day");
            } else {
              setSelectedDate(ds);
            }
            lastTap.current = { ds, time: now };
          };
          return (
            <div key={ds} onClick={handleTap}
              style={{ borderRight:`1px solid ${border}`, borderBottom:`1px solid ${border}`,
                padding:"2px", cursor:"pointer", overflow:"hidden", position:"relative",
                background: selectedDate===ds ? themeColor+"33" : holiday ? "#FF6B9D11" : bg }}>
              <div style={{ width:20, height:20, borderRadius:"50%",
                display:"flex", alignItems:"center", justifyContent:"center",
                background: isToday?themeColor:"transparent",
                color: isToday?"#fff": holiday?"#FF6B9D": rawDow===0?"#FF6B9D": rawDow===6?"#4D96FF":textPri,
                fontWeight: isToday?"700":"400", fontSize:"11px", marginBottom:1 }}>{d}</div>
              {holiday && (
                <div style={{
                  fontSize:"7px", color:"#FF6B9D", fontWeight:"600",
                  lineHeight:"1.2", paddingLeft:1, marginBottom:1,
                  overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap",
                }}>{holiday}</div>
              )}
              {dayEvents.slice(0,3).map(ev => (
                <div key={ev.id}
                  style={{ background:ev.color, borderRadius:"3px", padding:"1px 3px", marginBottom:1,
                    fontSize:badgeFontSize+"px", color:"#fff", fontWeight:"600",
                    whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis",
                    width:"100%", boxSizing:"border-box", pointerEvents:"none" }}>{showBadgeEmoji ? <span style={{fontSize:badgeEmojiSize+"px"}}>{ev.emoji}</span> : ""}{showBadgeEmoji ? " " : ""}{ev.title}</div>
              ))}
              {dayEvents.length > 3 && <div style={{ fontSize:"8px", color:"#9B59B6", fontWeight:"700", paddingLeft:2 }}>+{dayEvents.length-3}</div>}
            </div>
          );
        })}
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
  const [filterMembers, setFilterMembers] = useState([]);  // 空=全員
  const [saving, setSaving] = useState(false);
  const [notification, setNotification] = useState(null);

  const [showEventModal, setShowEventModal] = useState(false);
  const [editingEvent, setEditingEvent] = useState(null);
  const [form, setForm] = useState({ title:"", date:"", startTime:"", endTime:"", members:[], color:"#4D96FF", emoji:"📅", memo:"", categoryId:"" });
  const [showEventDetail, setShowEventDetail] = useState(null); // 詳細表示するevent

  const [categories, setCategories] = useState(DEFAULT_CATEGORIES);
  const [customEmojis, setCustomEmojis] = useState(() => {
    try { return JSON.parse(localStorage.getItem("custom_emojis")) || []; } catch { return []; }
  });
  const [removedEmojis, setRemovedEmojis] = useState(() => {
    try { return JSON.parse(localStorage.getItem("removed_emojis")) || []; } catch { return []; }
  });
  const [emojiInput, setEmojiInput] = useState("");
  const [showBadgeEmoji, setShowBadgeEmoji] = useState(() => {
    try { return localStorage.getItem("show_badge_emoji") !== "0"; } catch { return true; }
  });
  const [weekStartsMonday, setWeekStartsMonday] = useState(() => {
    try { return localStorage.getItem("week_starts_monday") === "1"; } catch { return false; }
  });
  const allEmojis = [...EVENT_EMOJIS.filter(e => !removedEmojis.includes(e)), ...customEmojis];

  const [showSettings, setShowSettings] = useState(false);
  const [dragX, setDragX] = useState(0);
  const [transitioning, setTransitioning] = useState(false);
  const [dayDragX, setDayDragX] = useState(0);
  const [dayTransitioning, setDayTransitioning] = useState(false);  const [editingMember, setEditingMember] = useState(null);
  const [memberForm, setMemberForm] = useState({ name:"", color:"#FF6B9D", emoji:"🌸" });
  const [isNewMember, setIsNewMember] = useState(false);
  const [badgeFontSize, setBadgeFontSize] = useState(() => {
    try { return Number(localStorage.getItem("badge_font_size")) || 9; } catch { return 9; }
  });
  const [badgeEmojiSize, setBadgeEmojiSize] = useState(() => {
    try { return Number(localStorage.getItem("badge_emoji_size")) || 11; } catch { return 11; }
  });
  const [themeColor, setThemeColor] = useState(() => {
    try { return localStorage.getItem("theme_color") || "#9B59B6"; } catch { return "#9B59B6"; }
  });
  const [themeColor2, setThemeColor2] = useState(() => {
    try { return localStorage.getItem("theme_color2") || "#E91E8C"; } catch { return "#E91E8C"; }
  });
  const [darkMode, setDarkMode] = useState(() => {
    try { return localStorage.getItem("dark_mode") === "1"; } catch { return false; }
  });
  const themeGrad = `linear-gradient(135deg, ${themeColor} 0%, ${themeColor2} 100%)`;

  // ダークモード用カラートークン
  const bg      = darkMode ? "#0f1123" : "#fff";
  const bgSub   = darkMode ? "#141830" : "#faf7ff";
  const bgCard  = darkMode ? "#1e2a4a" : "#fff";
  const border  = darkMode ? "#2a2a4a" : "#f0e6ff";
  const textPri = darkMode ? "#ffffff" : "#3D2B5E";
  const textSec = darkMode ? "#bbbbdd" : "#9A8FAA";

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
      try {
        const cVal = await dbGet("family_categories");
        if (cVal) setCategories(JSON.parse(cVal));
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
  const saveCategories = async (cats) => {
    try { await dbSet("family_categories", JSON.stringify(cats)); } catch {}
  };

  const showNotif = (msg) => {
    setNotification(msg);
    setTimeout(() => setNotification(null), 2000);
  };

  const openAdd = (date) => {
    const d = date || selectedDate || todayStr;
    setEditingEvent(null);
    setForm({ title:"", date:d, endDate:"", startTime:"", endTime:"", members:[], color:"#4D96FF", emoji:"📅", memo:"", categoryId:"", repeat:"none", repeatDays:[], repeatUntil:"" });
    setShowEventModal(true);
  };
  const openEdit = (ev) => {
    setEditingEvent(ev);
    setForm({ startTime:"", endTime:"", endDate:"", repeat:"none", repeatDays:[], repeatUntil:"", ...ev });
    setShowEventModal(true);
  };
  const saveForm = async () => {
    if (!form.title.trim() || !form.date) return;
    let newEvents;
    if (editingEvent) {
      newEvents = events.map(e => e.id === editingEvent.id ? { ...form, id: e.id } : e);
    } else if (form.repeat !== "none" && form.repeatUntil && form.repeatUntil > form.date) {
      // 繰り返し予定を生成
      const generated = [];
      const until = new Date(form.repeatUntil);
      let cur = new Date(form.date);
      const groupId = "g" + Date.now();
      while (cur <= until) {
        let match = false;
        if (form.repeat === "daily") match = true;
        else if (form.repeat === "weekly") match = form.repeatDays.includes(cur.getDay());
        else if (form.repeat === "monthly") match = cur.getDate() === new Date(form.date).getDate();
        if (match) {
          const ds = cur.toISOString().slice(0,10);
          generated.push({ ...form, date:ds, endDate:"", repeat:"none", id:"e"+Date.now()+Math.random(), groupId });
        }
        cur.setDate(cur.getDate()+1);
      }
      newEvents = [...events, ...generated];
    } else if (form.endDate && form.endDate > form.date) {
      // 期間指定：各日にイベントを生成
      const generated = [];
      let cur = new Date(form.date);
      const end = new Date(form.endDate);
      while (cur <= end) {
        const ds = cur.toISOString().slice(0,10);
        generated.push({ ...form, date:ds, endDate:"", id:"e"+Date.now()+Math.random() });
        cur.setDate(cur.getDate()+1);
      }
      newEvents = [...events, ...generated];
    } else {
      newEvents = [...events, { ...form, id:"e"+Date.now() }];
    }
    setEvents(newEvents);
    await saveEvents(newEvents);
    setShowEventModal(false);
    setView("month");
    showNotif(editingEvent ? "更新しました✨" : "追加しました🎉");
  };
  const deleteEvent = async (id) => {
    const newEvents = events.filter(e => e.id !== id);
    setEvents(newEvents);
    await saveEvents(newEvents);
    setShowEventModal(false);
    setView("month");
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
    events.filter(e => e.date===ds && (filterMembers.length===0 || e.members.some(m => filterMembers.includes(m))));

  const daysInMonth = getDaysInMonth(year, month);
  const firstDay = getFirstDay(year, month);

  const addBtnStyle = {
    display:"block", margin:"16px auto 0", padding:"10px 28px",
    background:themeGrad,
    color:"#fff", border:"none", borderRadius:"30px", fontSize:"14px",
    fontWeight:"700", cursor:"pointer",
    boxShadow:"0 4px 15px rgba(155,89,182,0.3)",
  };


  const moveDay = (direction) => {
    setSelectedDate(prev => {
      if (!prev) return prev;
      const d = new Date(prev);
      d.setDate(d.getDate() + direction);
      const newDs = d.toISOString().slice(0,10);
      setYear(d.getFullYear());
      setMonth(d.getMonth());
      return newDs;
    });
  };

  const DayView = () => {
    const dayEvents = selectedDate ? getEventsForDate(selectedDate) : [];
    const dp = selectedDate ? selectedDate.split("-") : [];

    const touchStartX = useRef(null);
    const touchStartY = useRef(null);
    const isHorizontal = useRef(false);

    const onTouchStart = (e) => {
      touchStartX.current = e.touches[0].clientX;
      touchStartY.current = e.touches[0].clientY;
      isHorizontal.current = false;
      setDayDragX(0);
    };
    const onTouchMove = (e) => {
      if (touchStartX.current === null) return;
      const dx = e.touches[0].clientX - touchStartX.current;
      const dy = e.touches[0].clientY - touchStartY.current;
      // 最初の動きで横か縦か判定
      if (!isHorizontal.current && Math.abs(dx) + Math.abs(dy) > 10) {
        isHorizontal.current = Math.abs(dx) > Math.abs(dy);
      }
      if (isHorizontal.current) {
        e.preventDefault();
        setDayDragX(dx);
      }
    };
    const onTouchEnd = (e) => {
      if (touchStartX.current === null) return;
      const diff = e.changedTouches[0].clientX - touchStartX.current;
      if (isHorizontal.current && Math.abs(diff) > 60) {
        setDayTransitioning(true);
        setDayDragX(diff > 0 ? window.innerWidth : -window.innerWidth);
        setTimeout(() => {
          moveDay(diff > 0 ? -1 : 1);
          setDayDragX(0);
          setDayTransitioning(false);
        }, 200);
      } else {
        setDayTransitioning(true);
        setDayDragX(0);
        setTimeout(() => setDayTransitioning(false), 200);
      }
      touchStartX.current = null;
      touchStartY.current = null;
      isHorizontal.current = false;
    };

    return (
      <div style={{ flex:1, overflow:"hidden", background:bg, display:"flex", flexDirection:"column" }}
        onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd}
      >
        {/* 日付ヘッダー */}
        {selectedDate && (
          <div style={{ display:"flex", alignItems:"center", padding:"16px 16px 8px", flexShrink:0 }}>
            <button onClick={() => moveDay(-1)} style={{ background:"none", border:"none", fontSize:"22px", cursor:"pointer", color:textSec, padding:"0 8px" }}>‹</button>
            <div style={{ flex:1, textAlign:"center" }}>
              <span style={{ fontSize:"22px", fontWeight:"800", color:textPri }}>{dp[1]}月{dp[2]}日</span>
              <span style={{ fontSize:"14px", color:textSec, marginLeft:8 }}>{DAYS_JP[new Date(selectedDate).getDay()]}曜日</span>
            </div>
            <button onClick={() => moveDay(1)} style={{ background:"none", border:"none", fontSize:"22px", cursor:"pointer", color:textSec, padding:"0 8px" }}>›</button>
          </div>
        )}
        {/* コンテンツ */}
        <div style={{
          flex:1, overflow:"auto", padding:"8px 16px 16px",
          transform:`translateX(${dayDragX}px)`,
          transition: dayTransitioning ? "transform 0.2s ease" : "none",
        }}>
        {dayEvents.length===0 ? (
          <div style={{ textAlign:"center", padding:"48px 0", color:"#C9B8E8" }}>
            <div style={{ fontSize:"48px", marginBottom:12 }}>📭</div>
            <div style={{ fontSize:"14px" }}>予定はありません</div>
            <button onClick={() => openAdd(selectedDate)} style={addBtnStyle}>＋ 追加する</button>
          </div>
        ) : (
          <>
            {dayEvents.map(ev => (
              <div key={ev.id} onClick={() => setShowEventDetail(ev)}
                style={{
                  background:bgCard, borderRadius:"16px", padding:"16px", marginBottom:12,
                  borderLeft:`5px solid ${ev.color}`,
                  boxShadow:"0 2px 12px rgba(155,89,182,0.08)", cursor:"pointer", transition:"transform 0.15s",
                }}
                onMouseEnter={e => e.currentTarget.style.transform="translateX(4px)"}
                onMouseLeave={e => e.currentTarget.style.transform=""}
              >
                <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:8 }}>
                  <span style={{ fontSize:"24px" }}>{ev.emoji}</span>
                  <div style={{ fontWeight:"700", fontSize:"16px", color:textPri }}>{ev.title}</div>
                </div>
                {ev.memo && <div style={{ fontSize:"13px", color:textSec, marginBottom:8 }}>{ev.memo}</div>}
                {ev.startTime && <div style={{ fontSize:"13px", color:textSec, marginBottom:8 }}>🕐 {ev.startTime}{ev.endTime ? " 〜 "+ev.endTime : ""}</div>}
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
      </div>
    );
  };

  const ListView = () => {
    const monthEvents = events
      .filter(e => {
        const [y,m] = e.date.split("-").map(Number);
        return y===year && m===month+1 && (filterMembers.length===0 || e.members.some(m => filterMembers.includes(m)));
      })
      .sort((a,b) => a.date.localeCompare(b.date));
    const grouped = {};
    monthEvents.forEach(ev => { if (!grouped[ev.date]) grouped[ev.date]=[]; grouped[ev.date].push(ev); });
    return (
      <div style={{ flex:1, overflow:"auto", padding:"16px", background:bg }}>
        {Object.keys(grouped).length===0 ? (
          <div style={{ textAlign:"center", padding:"48px 0", color:"#C9B8E8" }}>
            <div style={{ fontSize:"48px", marginBottom:12 }}>📋</div>
            <div>今月の予定はありません</div>
          </div>
        ) : Object.entries(grouped).map(([date,evs]) => {
          const dp = date.split("-");
          return (
            <div key={date} style={{ marginBottom:20 }}>
              <div style={{ fontWeight:"800", fontSize:"14px", color:themeColor, marginBottom:8, paddingLeft:4 }}>
                {dp[1]}月{dp[2]}日（{DAYS_JP[new Date(date).getDay()]}）
              </div>
              {evs.map(ev => (
                <div key={ev.id} onClick={() => openEdit(ev)}
                  style={{
                    background:bgCard, borderRadius:"14px", padding:"14px", marginBottom:8,
                    borderLeft:`4px solid ${ev.color}`,
                    boxShadow:"0 2px 8px rgba(155,89,182,0.07)", cursor:"pointer",
                    display:"flex", alignItems:"center", gap:12,
                  }}>
                  <span style={{ fontSize:"22px" }}>{ev.emoji}</span>
                  <div style={{ flex:1 }}>
                    <div style={{ fontWeight:"700", color:textPri, fontSize:"15px" }}>{ev.title}</div>
                    {ev.memo && <div style={{ fontSize:"12px", color:textSec }}>{ev.memo}</div>}
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
      position:"fixed", inset:0, background:bg, zIndex:400,
      display:"flex", flexDirection:"column",
      fontFamily:"'Hiragino Kaku Gothic ProN','Hiragino Sans',sans-serif",
    }}>
      <div style={{
        background:themeGrad,
        padding:"16px",
        display:"flex", alignItems:"center", gap:12,
      }}>
        <button onClick={() => { setShowSettings(false); setEditingMember(null); }}
          style={{ background:"rgba(255,255,255,0.2)", border:"none", color:"#fff", borderRadius:"50%", width:36, height:36, fontSize:"20px", cursor:"pointer" }}>
          ‹
        </button>
        <div style={{ color:"#fff", fontWeight:"800", fontSize:"18px" }}>
          {editingMember ? (isNewMember ? "メンバーを追加" : "メンバーを編集") : "設定"}
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
          {/* Dark mode toggle */}
          <div style={{ marginBottom:20, background:bgCard, borderRadius:"16px", padding:"16px", boxShadow:"0 2px 12px rgba(155,89,182,0.08)", border:`1px solid ${border}` }}>
            <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between" }}>
              <div style={{ fontSize:"14px", fontWeight:"700", color:textPri }}>🌙 ダークモード</div>
              <div onClick={() => {
                const next = !darkMode;
                setDarkMode(next);
                try { localStorage.setItem("dark_mode", next?"1":"0"); } catch {}
              }} style={{
                width:48, height:28, borderRadius:"14px", cursor:"pointer",
                background: darkMode ? themeColor : "#ccc",
                position:"relative", transition:"background 0.2s",
              }}>
                <div style={{
                  width:22, height:22, borderRadius:"50%", background:"#fff",
                  position:"absolute", top:3,
                  left: darkMode ? 23 : 3,
                  transition:"left 0.2s",
                  boxShadow:"0 1px 4px rgba(0,0,0,0.3)",
                }} />
              </div>
            </div>
          </div>

          {/* Badge emoji toggle */}
          <div style={{ marginBottom:20, background:bgCard, borderRadius:"16px", padding:"16px", boxShadow:"0 2px 12px rgba(155,89,182,0.08)", border:`1px solid ${border}` }}>
            <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between" }}>
              <div style={{ fontSize:"14px", fontWeight:"700", color:textPri }}>📅 カレンダーにアイコンを表示</div>
              <div onClick={() => {
                const next = !showBadgeEmoji;
                setShowBadgeEmoji(next);
                try { localStorage.setItem("show_badge_emoji", next?"1":"0"); } catch {}
              }} style={{
                width:48, height:28, borderRadius:"14px", cursor:"pointer",
                background: showBadgeEmoji ? themeColor : "#ccc",
                position:"relative", transition:"background 0.2s",
              }}>
                <div style={{
                  width:22, height:22, borderRadius:"50%", background:"#fff",
                  position:"absolute", top:3,
                  left: showBadgeEmoji ? 23 : 3,
                  transition:"left 0.2s",
                  boxShadow:"0 1px 4px rgba(0,0,0,0.3)",
                }} />
              </div>
            </div>
          </div>

          {/* Week start setting */}
          <div style={{ marginBottom:20, background:bgCard, borderRadius:"16px", padding:"16px", boxShadow:"0 2px 12px rgba(155,89,182,0.08)", border:`1px solid ${border}` }}>
            <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between" }}>
              <div style={{ fontSize:"14px", fontWeight:"700", color:textPri }}>📆 月曜日始まり</div>
              <div onClick={() => {
                const next = !weekStartsMonday;
                setWeekStartsMonday(next);
                try { localStorage.setItem("week_starts_monday", next?"1":"0"); } catch {}
              }} style={{
                width:48, height:28, borderRadius:"14px", cursor:"pointer",
                background: weekStartsMonday ? themeColor : "#ccc",
                position:"relative", transition:"background 0.2s",
              }}>
                <div style={{
                  width:22, height:22, borderRadius:"50%", background:"#fff",
                  position:"absolute", top:3,
                  left: weekStartsMonday ? 23 : 3,
                  transition:"left 0.2s",
                  boxShadow:"0 1px 4px rgba(0,0,0,0.3)",
                }} />
              </div>
            </div>
            <div style={{ fontSize:"11px", color:textSec, marginTop:6 }}>オンで月曜始まり、オフで日曜始まり</div>
          </div>

          {/* Theme color setting */}
          <div style={{ marginBottom:20, background:bgCard, borderRadius:"16px", padding:"16px", boxShadow:"0 2px 12px rgba(155,89,182,0.08)", border:`1px solid ${border}` }}>
            <div style={{ fontSize:"12px", fontWeight:"700", color:"#9A8FAA", marginBottom:12, letterSpacing:"1px" }}>テーマカラー</div>
            <div style={{ display:"flex", gap:10, flexWrap:"wrap" }}>
              {[
                ["#9B59B6","#E91E8C"],
                ["#2196F3","#00BCD4"],
                ["#FF5722","#FF9800"],
                ["#4CAF50","#8BC34A"],
                ["#E91E63","#FF5722"],
                ["#3F51B5","#9C27B0"],
                ["#009688","#4CAF50"],
                ["#607D8B","#455A64"],
              ].map(([c1,c2]) => (
                <button key={c1} onClick={() => {
                  setThemeColor(c1); setThemeColor2(c2);
                  try { localStorage.setItem("theme_color",c1); localStorage.setItem("theme_color2",c2); } catch {}
                }} style={{
                  width:40, height:40, borderRadius:"12px",
                  background:`linear-gradient(135deg,${c1},${c2})`,
                  border: themeColor===c1?"3px solid #3D2B5E":"3px solid transparent",
                  cursor:"pointer", outline:"none",
                }} />
              ))}
            </div>
          </div>

          {/* Font size setting */}
          <div style={{ marginBottom:24, background:bgCard, borderRadius:"16px", padding:"16px", boxShadow:"0 2px 12px rgba(155,89,182,0.08)", border:`1px solid ${border}` }}>
            <div style={{ fontSize:"12px", fontWeight:"700", color:"#9A8FAA", marginBottom:12, letterSpacing:"1px" }}>予定の文字サイズ</div>
            <div style={{ display:"flex", alignItems:"center", gap:12 }}>
              <span style={{ fontSize:"10px", color:"#9A8FAA" }}>小</span>
              <input type="range" min="7" max="13" value={badgeFontSize}
                onChange={e => {
                  const v = Number(e.target.value);
                  setBadgeFontSize(v);
                  try { localStorage.setItem("badge_font_size", v); } catch {}
                }}
                style={{ flex:1, accentColor:"#9B59B6" }}
              />
              <span style={{ fontSize:"14px", color:"#9A8FAA" }}>大</span>
              <span style={{
                minWidth:32, textAlign:"center", fontSize:"13px", fontWeight:"700",
                color:"#9B59B6", background:"#f3e8ff", borderRadius:"8px", padding:"2px 8px"
              }}>{badgeFontSize}px</span>
            </div>
            {/* Preview */}
            <div style={{ marginTop:12, background: darkMode?"#1e2a4a":"#f3e8ff", borderRadius:"8px", padding:"8px 10px" }}>
              <div style={{
                background:"#4D96FF22", borderLeft:"3px solid #4D96FF",
                borderRadius:"4px", padding:"2px 6px",
                fontSize:badgeFontSize+"px", color:textPri, fontWeight:"600",
              }}><span style={{fontSize:badgeEmojiSize+"px"}}>📅</span> プレビュー：家族でピクニック</div>
            </div>
          </div>

          {/* Emoji size setting */}
          <div style={{ marginBottom:20, background:bgCard, borderRadius:"16px", padding:"16px", boxShadow:"0 2px 12px rgba(155,89,182,0.08)", border:`1px solid ${border}` }}>
            <div style={{ fontSize:"12px", fontWeight:"700", color:textSec, marginBottom:12, letterSpacing:"1px" }}>アイコンサイズ</div>
            <div style={{ display:"flex", alignItems:"center", gap:12 }}>
              <span style={{ fontSize:"10px", color:textSec }}>小</span>
              <input type="range" min="8" max="16" value={badgeEmojiSize}
                onChange={e => {
                  const v = Number(e.target.value);
                  setBadgeEmojiSize(v);
                  try { localStorage.setItem("badge_emoji_size", v); } catch {}
                }}
                style={{ flex:1, accentColor:themeColor }}
              />
              <span style={{ fontSize:"14px", color:textSec }}>大</span>
              <span style={{
                minWidth:32, textAlign:"center", fontSize:"13px", fontWeight:"700",
                color:themeColor, background:themeColor+"22", borderRadius:"8px", padding:"2px 8px"
              }}>{badgeEmojiSize}px</span>
            </div>
            <div style={{ marginTop:12, background: darkMode?"#1e2a4a":"#f3e8ff", borderRadius:"8px", padding:"8px 10px" }}>
              <div style={{
                background:"#4D96FF22", borderLeft:"3px solid #4D96FF",
                borderRadius:"4px", padding:"2px 6px",
                fontSize:badgeFontSize+"px", color:textPri, fontWeight:"600",
              }}><span style={{fontSize:badgeEmojiSize+"px"}}>📅</span> プレビュー：家族でピクニック</div>
            </div>
          </div>

          {/* アイコン管理 */}
          <div style={{ marginBottom:20, background:bgCard, borderRadius:"16px", padding:"16px", boxShadow:"0 2px 12px rgba(155,89,182,0.08)", border:`1px solid ${border}` }}>
            <div style={{ fontSize:"12px", fontWeight:"700", color:textSec, marginBottom:12, letterSpacing:"1px" }}>予定アイコン</div>
            <div style={{ display:"flex", gap:10, flexWrap:"wrap", marginBottom:12 }}>
              {allEmojis.map(em => (
                <div key={em} style={{ position:"relative", width:40, height:40, flexShrink:0 }}>
                  <div style={{
                    width:40, height:40, borderRadius:"10px", background:bgSub,
                    display:"flex", alignItems:"center", justifyContent:"center", fontSize:"22px",
                  }}>{em}</div>
                  <div onClick={() => {
                    if (customEmojis.includes(em)) {
                      const next = customEmojis.filter(x => x !== em);
                      setCustomEmojis(next);
                      try { localStorage.setItem("custom_emojis", JSON.stringify(next)); } catch {}
                    } else {
                      const next = [...removedEmojis, em];
                      setRemovedEmojis(next);
                      try { localStorage.setItem("removed_emojis", JSON.stringify(next)); } catch {}
                    }
                  }} style={{
                    position:"absolute", top:-6, right:-6, width:18, height:18,
                    borderRadius:"50%", background:"#e74c3c",
                    color:"#fff", fontSize:"12px", cursor:"pointer",
                    display:"flex", alignItems:"center", justifyContent:"center",
                    fontWeight:"900", zIndex:10,
                    boxShadow:"0 1px 4px rgba(0,0,0,0.4)",
                  }}>×</div>
                </div>
              ))}
            </div>
            {removedEmojis.length > 0 && (
              <button onClick={() => {
                setRemovedEmojis([]);
                try { localStorage.removeItem("removed_emojis"); } catch {}
              }} style={{
                fontSize:"12px", color:"#fff", background:"#9B59B6",
                border:"none", borderRadius:"10px", padding:"6px 12px",
                cursor:"pointer", marginBottom:10, fontWeight:"700",
              }}>🔄 デフォルトをリセット</button>
            )}
            <div style={{ display:"flex", gap:8 }}>
              <input value={emojiInput} onChange={e => setEmojiInput(e.target.value)}
                placeholder="絵文字を入力（例：🍕）" maxLength={4}
                style={{
                  flex:1, padding:"10px 14px", borderRadius:"12px",
                  border:`2px solid ${border}`, fontSize:"20px", outline:"none",
                  background:bg, color:textPri, boxSizing:"border-box",
                }} />
              <button onClick={() => {
                const em = emojiInput.trim();
                if (!em || customEmojis.includes(em) || EVENT_EMOJIS.includes(em)) return;
                const next = [...customEmojis, em];
                setCustomEmojis(next);
                setEmojiInput("");
                try { localStorage.setItem("custom_emojis", JSON.stringify(next)); } catch {}
              }} style={{
                padding:"10px 16px", borderRadius:"12px",
                background:themeGrad, border:"none", color:"#fff",
                fontWeight:"700", fontSize:"14px", cursor:"pointer",
              }}>追加</button>
            </div>
            <div style={{ fontSize:"11px", color:textSec, marginTop:8 }}>×で削除できます。デフォルトは「リセット」で復元できます。</div>
          </div>

          {/* カテゴリー */}
          {categories.map(cat => (
            <div key={cat.id} style={{
              background:bgCard, borderRadius:"14px", padding:"12px 14px", marginBottom:8,
              border:`1px solid ${border}`,
            }}>
              <div style={{ display:"flex", alignItems:"center", gap:12, marginBottom:8 }}>
                <div style={{ width:20, height:20, borderRadius:"50%", background:cat.color, flexShrink:0 }} />
                <input value={cat.name} onChange={e => {
                  const newCats = categories.map(c => c.id===cat.id ? { ...c, name:e.target.value } : c);
                  setCategories(newCats); saveCategories(newCats);
                }} style={{
                  flex:1, background:"transparent", border:"none", outline:"none",
                  fontSize:"15px", fontWeight:"600", color:textPri,
                }} />
                <button onClick={() => {
                  const newCats = categories.filter(c => c.id !== cat.id);
                  setCategories(newCats); saveCategories(newCats);
                }} style={{ background:"none", border:"none", color:"#e74c3c", fontSize:"16px", cursor:"pointer" }}>×</button>
              </div>
              <div style={{ display:"flex", gap:6, flexWrap:"wrap" }}>
                {["#FF6B9D","#FF8C42","#FFD93D","#6BCB77","#4ECDC4","#4D96FF","#9B59B6","#E74C3C","#A8E6CF","#5F27CD","#00BCD4","#FF5722"].map(c => (
                  <div key={c} onClick={() => {
                    const newCats = categories.map(x => x.id===cat.id ? { ...x, color:c } : x);
                    setCategories(newCats); saveCategories(newCats);
                  }} style={{
                    width:20, height:20, borderRadius:"50%", background:c, cursor:"pointer",
                    outline: cat.color===c ? `2px solid ${c}` : "none", outlineOffset:2, flexShrink:0,
                  }} />
                ))}
              </div>
            </div>
          ))}
          <button onClick={() => {
            const newCat = { id:"c"+Date.now(), name:"新しいカテゴリー", color:"#9B59B6" };
            const newCats = [...categories, newCat];
            setCategories(newCats); saveCategories(newCats);
          }} style={{
            width:"100%", padding:"12px", borderRadius:"14px", marginBottom:20,
            background:"transparent", border:`2px dashed ${border}`,
            color:textSec, fontWeight:"700", fontSize:"14px", cursor:"pointer",
          }}>＋ カテゴリーを追加</button>

          <div style={{ fontSize:"12px", fontWeight:"700", color:"#9A8FAA", marginBottom:12, letterSpacing:"1px" }}>メンバー一覧</div>
          {members.map(m => (
            <div key={m.id} onClick={() => openEditMember(m)}
              style={{
                display:"flex", alignItems:"center", gap:14,
                background:bgCard, borderRadius:"16px", padding:"14px 16px", marginBottom:10,
                cursor:"pointer", boxShadow:"0 2px 12px rgba(155,89,182,0.08)", border:`1px solid ${border}`,
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
                <div style={{ fontWeight:"700", fontSize:"16px", color:textPri }}>{m.name}</div>
                <div style={{ width:12, height:12, borderRadius:"50%", background:m.color, display:"inline-block", marginTop:4 }} />
              </div>
              <div style={{ color:"#C9B8E8", fontSize:"20px" }}>›</div>
            </div>
          ))}
          <button onClick={openNewMember} style={{
            width:"100%", padding:"14px", borderRadius:"16px", marginTop:8,
            background:themeGrad,
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
          themeGrad={themeGrad}
          textSec={textSec}
        />
      )}
    </div>
  );

  return (
    <div style={{
      height:"100vh", display:"flex", flexDirection:"column",
      background: darkMode ? "#1a1a2e" : "linear-gradient(160deg, #FAF0FF 0%, #F0EAFF 50%, #EAF4FF 100%)",
      fontFamily:"'Hiragino Kaku Gothic ProN','Hiragino Sans',sans-serif",
      overflow:"hidden",
    }}>
      <div style={{
        background:themeGrad,
        padding:"0 12px", boxShadow:"0 4px 20px rgba(155,89,182,0.3)",
      }}>
        {/* 月ナビ + ボタン類を1行に */}
        <div style={{ display:"flex", alignItems:"center", gap:8, paddingTop:10, paddingBottom:8 }}>
          <button onClick={prevMonth} style={{ background:"none", border:"none", color:"#fff", fontSize:"22px", cursor:"pointer", padding:"0 4px" }}>‹</button>
          <div style={{ color:"#fff", fontWeight:"800", fontSize:"18px", flex:1, textAlign:"center" }}>{year}年 {MONTHS_JP[month]}</div>
          <button onClick={nextMonth} style={{ background:"none", border:"none", color:"#fff", fontSize:"22px", cursor:"pointer", padding:"0 4px" }}>›</button>
          <button onClick={() => { setYear(today.getFullYear()); setMonth(today.getMonth()); setSelectedDate(todayStr); setView("month"); }}
            style={{ background:"rgba(255,255,255,0.2)", border:"none", color:"#fff", borderRadius:"10px", padding:"3px 8px", fontSize:"11px", cursor:"pointer" }}>
            今日
          </button>
          {saving && <span style={{ color:"rgba(255,255,255,0.8)", fontSize:"10px" }}>保存中</span>}
          <button onClick={() => { setShowSettings(true); setEditingMember(null); }} style={{
            background:"rgba(255,255,255,0.2)", border:"none", color:"#fff",
            borderRadius:"50%", width:30, height:30, fontSize:"14px", cursor:"pointer",
            display:"flex", alignItems:"center", justifyContent:"center",
          }}>⚙️</button>
          <button onClick={() => openAdd()} style={{
            background:"rgba(255,255,255,0.25)", border:"1px solid rgba(255,255,255,0.4)",
            color:"#fff", borderRadius:"16px", padding:"4px 12px", fontSize:"12px",
            fontWeight:"700", cursor:"pointer",
          }}>＋</button>
        </div>

        {/* メンバーフィルター（複数選択） */}
        <div style={{ display:"flex", gap:5, paddingBottom:8, overflowX:"auto" }}>
          <button onClick={() => setFilterMembers([])} style={{
            background: filterMembers.length===0?"rgba(255,255,255,0.95)":"rgba(255,255,255,0.2)",
            color: filterMembers.length===0?themeColor:"#fff",
            border:"none", borderRadius:"20px", padding:"3px 10px", fontSize:"11px",
            fontWeight:"700", cursor:"pointer", whiteSpace:"nowrap", flexShrink:0,
          }}>全員</button>
          {members.map(m => {
            const on = filterMembers.includes(m.id);
            return (
              <button key={m.id} onClick={() => setFilterMembers(prev =>
                on ? prev.filter(x => x!==m.id) : [...prev, m.id]
              )} style={{
                background: on?"rgba(255,255,255,0.95)":"rgba(255,255,255,0.2)",
                color: on?m.color:"#fff",
                border:"none", borderRadius:"20px", padding:"3px 10px", fontSize:"11px",
                fontWeight:"700", cursor:"pointer", whiteSpace:"nowrap", flexShrink:0,
              }}>{m.emoji} {m.name}</button>
            );
          })}
        </div>

        {/* タブ */}
        <div style={{ display:"flex", gap:2 }}>
          {[["month","月"],["day","日"],["list","一覧"]].map(([v,label]) => (
            <button key={v} onClick={() => {
              if (v === "day" && !selectedDate) {
                setSelectedDate(todayStr);
                setYear(today.getFullYear());
                setMonth(today.getMonth());
              }
              setView(v);
            }} style={{
              flex:1, background: view===v?"rgba(255,255,255,0.95)":"transparent",
              color: view===v?themeColor:"rgba(255,255,255,0.8)",
              border:"none", padding:"7px 0", fontSize:"13px", fontWeight:"700",
              cursor:"pointer", borderRadius:"12px 12px 0 0", transition:"all 0.2s",
            }}>{label}表示</button>
          ))}
        </div>
      </div>

      <div style={{ flex:1, display:"flex", flexDirection:"column", overflow:"hidden", background:bg, width:"100%", boxSizing:"border-box" }}>
        {view==="month" && <MonthView
          firstDay={firstDay} daysInMonth={daysInMonth} dateStr={dateStr}
          todayStr={todayStr} selectedDate={selectedDate} setSelectedDate={setSelectedDate}
          getEventsForDate={getEventsForDate} setView={setView}
          dragX={dragX} setDragX={setDragX} transitioning={transitioning} setTransitioning={setTransitioning}
          prevMonth={prevMonth} nextMonth={nextMonth}
          border={border} bgSub={bgSub} bg={bg} themeColor={themeColor} textPri={textPri}
          badgeFontSize={badgeFontSize} badgeEmojiSize={badgeEmojiSize} DAYS_JP={DAYS_JP}
          showBadgeEmoji={showBadgeEmoji} setShowEventDetail={setShowEventDetail}
          weekStartsMonday={weekStartsMonday}
        />}
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
        background:themeGrad,
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

      {/* 予定詳細モーダル */}
      {showEventDetail && (
        <div style={{
          position:"fixed", inset:0, background:"rgba(0,0,0,0.5)", zIndex:300,
          display:"flex", alignItems:"flex-end", backdropFilter:"blur(4px)",
        }} onClick={() => setShowEventDetail(null)}>
          <div style={{
            background:bgCard, borderRadius:"24px 24px 0 0", width:"100%",
            padding:"24px 20px 40px", boxShadow:"0 -8px 40px rgba(0,0,0,0.2)",
            boxSizing:"border-box",
          }} onClick={e => e.stopPropagation()}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:16 }}>
              <div style={{ display:"flex", alignItems:"center", gap:10 }}>
                <span style={{ fontSize:"28px" }}>{showEventDetail.emoji}</span>
                <div style={{ fontWeight:"800", fontSize:"18px", color:textPri }}>{showEventDetail.title}</div>
              </div>
              <button onClick={() => setShowEventDetail(null)} style={{ background:"none", border:"none", fontSize:"24px", cursor:"pointer", color:textSec }}>×</button>
            </div>
            <div style={{ borderLeft:`4px solid ${showEventDetail.color}`, paddingLeft:12, marginBottom:16 }}>
              <div style={{ fontSize:"14px", color:textSec, marginBottom:4 }}>
                📅 {showEventDetail.date.replace(/-/g,"/")}
                {showEventDetail.startTime && (
                  <span style={{ marginLeft:8 }}>🕐 {showEventDetail.startTime}{showEventDetail.endTime ? " 〜 " + showEventDetail.endTime : ""}</span>
                )}
              </div>
              {showEventDetail.memo && <div style={{ fontSize:"14px", color:textPri, marginTop:4 }}>📝 {showEventDetail.memo}</div>}
            </div>
            <div style={{ display:"flex", gap:6, flexWrap:"wrap", marginBottom:20 }}>
              {(showEventDetail.members||[]).map(mid => {
                const m = members.find(x => x.id===mid);
                return m ? <span key={mid} style={{ background:m.color+"22", color:m.color, borderRadius:"20px", padding:"4px 12px", fontSize:"13px", fontWeight:"700" }}>{m.emoji} {m.name}</span> : null;
              })}
            </div>
            <button onClick={() => { openEdit(showEventDetail); setShowEventDetail(null); }} style={{
              width:"100%", padding:"14px", borderRadius:"16px",
              background:themeGrad, border:"none", color:"#fff",
              fontWeight:"700", fontSize:"15px", cursor:"pointer",
            }}>✏️ 編集する</button>
          </div>
        </div>
      )}

      {/* イベントモーダル */}
      {showEventModal && (
        <div style={{
          position:"fixed", inset:0, background:"rgba(61,43,94,0.5)", zIndex:300,
          display:"flex", alignItems:"flex-end", backdropFilter:"blur(4px)",
          overflowX:"hidden", touchAction:"pan-y",
        }} onClick={() => setShowEventModal(false)}>
          <div style={{
            background:bgCard, borderRadius:"24px 24px 0 0", width:"100%",
            maxHeight:"90vh", overflowY:"auto", overflowX:"hidden", padding:"24px 20px 40px",
            boxShadow:"0 -8px 40px rgba(155,89,182,0.2)", boxSizing:"border-box",
            touchAction:"pan-y",
          }} onClick={e => e.stopPropagation()}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:20 }}>
              <div style={{ fontWeight:"800", fontSize:"18px", color:textPri }}>
                {editingEvent ? "予定を編集" : "予定を追加"}
              </div>
              <button onClick={() => setShowEventModal(false)} style={{
                background:"none", border:"none", fontSize:"24px", cursor:"pointer",
                color:textSec, zIndex:10, padding:"4px 8px",
              }}>×</button>
            </div>

            <div style={{ marginBottom:16 }}>
              <div style={{ fontSize:"12px", fontWeight:"700", color:textSec, marginBottom:8 }}>アイコン</div>
              <div style={{ display:"flex", gap:8, flexWrap:"wrap", maxWidth:"100%", overflowX:"hidden" }}>
                {allEmojis.map(em => (
                  <button key={em} onClick={() => setForm(f => ({ ...f, emoji:em }))} style={{
                    width:36, height:36, borderRadius:"10px",
                    border: form.emoji===em?`2px solid ${themeColor}`:"2px solid transparent",
                    background: form.emoji===em?themeColor+"22":bgSub,
                    fontSize:"18px", cursor:"pointer",
                  }}>{em}</button>
                ))}
              </div>
            </div>

            <div style={{ marginBottom:14 }}>
              <div style={{ fontSize:"12px", fontWeight:"700", color:textSec, marginBottom:6 }}>タイトル *</div>
              <input value={form.title} onChange={e => setForm(f => ({ ...f, title:e.target.value }))}
                placeholder="予定のタイトル" style={{
                  width:"100%", padding:"12px 16px", borderRadius:"14px",
                  border:`2px solid ${border}`, fontSize:"16px", outline:"none",
                  boxSizing:"border-box", color:textPri, background:bg,
                }} />
            </div>

            <div style={{ marginBottom:14 }}>
              <div style={{ fontSize:"12px", fontWeight:"700", color:textSec, marginBottom:6 }}>日付 *</div>
              <div style={{ display:"flex", gap:8, alignItems:"center" }}>
                <input type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date:e.target.value }))}
                  style={{
                    flex:1, padding:"12px 16px", borderRadius:"14px",
                    border:`2px solid ${border}`, fontSize:"16px", outline:"none",
                    boxSizing:"border-box", color:textPri, background:bg,
                  }} />
                <span style={{ color:textSec, fontWeight:"700", flexShrink:0 }}>〜</span>
                <input type="date" value={form.endDate||""} onChange={e => setForm(f => ({ ...f, endDate:e.target.value }))}
                  placeholder="終了日（任意）"
                  style={{
                    flex:1, padding:"12px 16px", borderRadius:"14px",
                    border:`2px solid ${form.endDate ? themeColor : border}`, fontSize:"16px", outline:"none",
                    boxSizing:"border-box", color:textPri, background:bg,
                  }} />
              </div>
              {form.endDate && form.endDate > form.date && (
                <div style={{ fontSize:"11px", color:themeColor, marginTop:4, fontWeight:"600" }}>
                  📅 {Math.round((new Date(form.endDate)-new Date(form.date))/86400000)+1}日間の予定を追加します
                </div>
              )}
            </div>

            <div style={{ marginBottom:14 }}>
              <div style={{ fontSize:"12px", fontWeight:"700", color:textSec, marginBottom:6 }}>時間（任意）</div>
              <div style={{ display:"flex", gap:8, alignItems:"center" }}>
                <input type="time" value={form.startTime||""} onChange={e => setForm(f => ({ ...f, startTime:e.target.value }))}
                  style={{
                    flex:1, padding:"12px 16px", borderRadius:"14px",
                    border:`2px solid ${border}`, fontSize:"16px", outline:"none",
                    boxSizing:"border-box", color:textPri, background:bg,
                  }} />
                <span style={{ color:textSec, fontWeight:"700" }}>〜</span>
                <input type="time" value={form.endTime||""} onChange={e => setForm(f => ({ ...f, endTime:e.target.value }))}
                  style={{
                    flex:1, padding:"12px 16px", borderRadius:"14px",
                    border:`2px solid ${border}`, fontSize:"16px", outline:"none",
                    boxSizing:"border-box", color:textPri, background:bg,
                  }} />
              </div>
            </div>

            <div style={{ marginBottom:14 }}>
              <div style={{ fontSize:"12px", fontWeight:"700", color:textSec, marginBottom:8 }}>参加メンバー</div>
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
              <div style={{ fontSize:"12px", fontWeight:"700", color:textSec, marginBottom:8 }}>カテゴリー</div>
              <div style={{ display:"flex", gap:8, flexWrap:"wrap", maxWidth:"100%", overflowX:"hidden" }}>
                {categories.map(cat => (
                  <button key={cat.id} onClick={() => setForm(f => ({ ...f, color:cat.color, categoryId:cat.id }))} style={{
                    padding:"5px 12px", borderRadius:"20px", border:"2px solid",
                    borderColor: form.categoryId===cat.id ? cat.color : "#e0d6f0",
                    background: form.categoryId===cat.id ? cat.color : "#faf7ff",
                    color: form.categoryId===cat.id ? "#fff" : "#9A8FAA",
                    fontWeight:"700", fontSize:"12px", cursor:"pointer",
                  }}>{cat.name}</button>
                ))}
              </div>
            </div>

            {/* 繰り返し */}
            <div style={{ marginBottom:14 }}>
              <div style={{ fontSize:"12px", fontWeight:"700", color:textSec, marginBottom:8 }}>繰り返し</div>
              <div style={{ display:"flex", gap:8, flexWrap:"wrap", marginBottom:8 }}>
                {[["none","なし"],["daily","毎日"],["weekly","毎週"],["monthly","毎月"]].map(([val,label]) => (
                  <button key={val} onClick={() => setForm(f => ({ ...f, repeat:val, repeatDays:[] }))} style={{
                    padding:"6px 14px", borderRadius:"20px", border:"2px solid",
                    borderColor: form.repeat===val ? themeColor : border,
                    background: form.repeat===val ? themeColor+"22" : bg,
                    color: form.repeat===val ? themeColor : textSec,
                    fontWeight:"700", fontSize:"13px", cursor:"pointer",
                  }}>{label}</button>
                ))}
              </div>
              {/* 毎週：曜日選択 */}
              {form.repeat === "weekly" && (
                <div style={{ display:"flex", gap:6, marginBottom:8 }}>
                  {["日","月","火","水","木","金","土"].map((d,i) => (
                    <button key={i} onClick={() => setForm(f => ({
                      ...f, repeatDays: f.repeatDays.includes(i)
                        ? f.repeatDays.filter(x => x!==i) : [...f.repeatDays, i]
                    }))} style={{
                      width:36, height:36, borderRadius:"50%", border:"2px solid",
                      borderColor: form.repeatDays.includes(i) ? themeColor : border,
                      background: form.repeatDays.includes(i) ? themeColor : bg,
                      color: form.repeatDays.includes(i) ? "#fff" : i===0?"#FF6B9D":i===6?"#4D96FF":textSec,
                      fontWeight:"700", fontSize:"12px", cursor:"pointer",
                    }}>{d}</button>
                  ))}
                </div>
              )}
              {/* 繰り返し終了日 */}
              {form.repeat !== "none" && (
                <div>
                  <div style={{ fontSize:"11px", color:textSec, marginBottom:4 }}>繰り返し終了日</div>
                  <input type="date" value={form.repeatUntil||""} onChange={e => setForm(f => ({ ...f, repeatUntil:e.target.value }))}
                    style={{
                      width:"100%", padding:"10px 14px", borderRadius:"14px",
                      border:`2px solid ${form.repeatUntil ? themeColor : border}`,
                      fontSize:"15px", outline:"none", boxSizing:"border-box",
                      color:textPri, background:bg,
                    }} />
                  {form.repeat === "weekly" && form.repeatDays.length > 0 && form.repeatUntil && (
                    <div style={{ fontSize:"11px", color:themeColor, marginTop:4, fontWeight:"600" }}>
                      📅 約{Math.round(Math.abs(new Date(form.repeatUntil)-new Date(form.date))/86400000/7 * form.repeatDays.length)}件の予定を追加します
                    </div>
                  )}
                </div>
              )}
            </div>

            <div style={{ marginBottom:24 }}>
              <div style={{ fontSize:"12px", fontWeight:"700", color:textSec, marginBottom:6 }}>メモ</div>
              <textarea value={form.memo} onChange={e => setForm(f => ({ ...f, memo:e.target.value }))}
                placeholder="メモを入力" rows={3} style={{
                  width:"100%", padding:"12px 16px", borderRadius:"14px",
                  border:`2px solid ${border}`, fontSize:"14px", outline:"none",
                  boxSizing:"border-box", color:textPri, background:bg, resize:"none",
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
                background:themeGrad,
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
