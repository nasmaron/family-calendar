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

// ===== Supabase Storage（写真・レシート画像の保存） =====
// 事前に Supabase ダッシュボードで Storage > New bucket から
// バケット名「family-files」（Public）を作成しておいてください。
const STORAGE_BUCKET = "family-files";

async function uploadFile(file, folder) {
  const safeName = `${Date.now()}_${Math.random().toString(36).slice(2,8)}_${(file.name||"photo").replace(/[^a-zA-Z0-9._-]/g, "")}`;
  const path = `${folder}/${safeName}`;
  const res = await fetch(`${SUPABASE_URL}/storage/v1/object/${STORAGE_BUCKET}/${path}`, {
    method: "POST",
    headers: {
      "apikey": SUPABASE_KEY,
      "Authorization": "Bearer " + SUPABASE_KEY,
      "Content-Type": file.type || "application/octet-stream",
      "x-upsert": "true",
    },
    body: file,
  });
  if (!res.ok) throw new Error("画像のアップロードに失敗しました");
  return `${SUPABASE_URL}/storage/v1/object/public/${STORAGE_BUCKET}/${path}`;
}

// ===== レシートOCR（Supabase Edge Function経由でClaude APIを呼ぶ） =====
// APIキーをブラウザに直接置くのは危険なため、Edge Function側で保持します。
// 事前に supabase/functions/ocr-receipt をデプロイしてください（下記コード参照）。
async function ocrReceipt(imageUrl) {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/ocr-receipt`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": "Bearer " + SUPABASE_KEY },
    body: JSON.stringify({ imageUrl }),
  });
  if (!res.ok) throw new Error("レシートの読み取りに失敗しました");
  return res.json(); // { amount, date, memo }
}

// ===== 写真の撮影日を読み取る =====
// JPEGのEXIF（DateTimeOriginal）を優先し、読めない場合はファイルの更新日時、
// それも無ければnull（呼び出し側でtodayStrにフォールバック）を返す。
// 注意：HEIC/HEIF（iPhoneの既定形式）はこの簡易パーサーでは読み取れません（確信度：高）。
// iPhoneで「互換性優先（JPEGで保存）」設定にしている場合や、写真アプリの共有時に
// 自動でJPEG変換される場合は読み取れます。
function readExifDateFromJpeg(arrayBuffer) {
  try {
    const view = new DataView(arrayBuffer);
    if (view.getUint16(0, false) !== 0xFFD8) return null;
    let offset = 2;
    while (offset < view.byteLength - 4) {
      const marker = view.getUint16(offset, false);
      if (marker === 0xFFE1) {
        const exifOffset = offset + 4;
        if (view.getUint32(exifOffset, false) !== 0x45786966) return null; // "Exif"
        const tiffOffset = exifOffset + 6;
        const little = view.getUint16(tiffOffset, false) === 0x4949;
        const firstIFDOffset = view.getUint32(tiffOffset + 4, little);
        const dirOffset = tiffOffset + firstIFDOffset;
        if (dirOffset + 2 > view.byteLength) return null;
        const numEntries = view.getUint16(dirOffset, little);
        for (let i = 0; i < numEntries; i++) {
          const entryOffset = dirOffset + 2 + i * 12;
          if (entryOffset + 12 > view.byteLength) break;
          const tag = view.getUint16(entryOffset, little);
          if (tag === 0x9003 || tag === 0x0132) { // DateTimeOriginal または DateTime
            const valueOffset = view.getUint32(entryOffset + 8, little) + tiffOffset;
            let str = "";
            for (let n = 0; n < 19 && valueOffset + n < view.byteLength; n++) {
              str += String.fromCharCode(view.getUint8(valueOffset + n));
            }
            const m = str.match(/(\d{4}):(\d{2}):(\d{2})/);
            if (m) return `${m[1]}-${m[2]}-${m[3]}`;
          }
        }
        return null;
      } else if ((marker & 0xFF00) !== 0xFF00) {
        break;
      } else {
        offset += 2 + view.getUint16(offset + 2, false);
      }
    }
    return null;
  } catch {
    return null;
  }
}

async function getPhotoCaptureDate(file) {
  // JPEGならEXIFを試す（先頭128KBあれば十分）
  if (file.type === "image/jpeg" || file.type === "image/jpg") {
    try {
      const buf = await file.slice(0, 131072).arrayBuffer();
      const exifDate = readExifDateFromJpeg(buf);
      if (exifDate) return exifDate;
    } catch {}
  }
  // EXIFが読めない場合はファイルの更新日時（≒端末に保存された日）を使う
  if (file.lastModified) {
    const d = new Date(file.lastModified);
    if (!isNaN(d.getTime())) {
      return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
    }
  }
  return null; // 呼び出し側でtodayStr等にフォールバック
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

const DEFAULT_BUDGET_CATEGORIES = [
  { id: "b1", name: "食費", color: "#FF8C42", icon: "🍙" },
  { id: "b2", name: "日用品", color: "#6BCB77", icon: "🧴" },
  { id: "b3", name: "住居・光熱費", color: "#4D96FF", icon: "🏠" },
  { id: "b4", name: "交通費", color: "#4ECDC4", icon: "🚃" },
  { id: "b5", name: "医療・健康", color: "#E74C3C", icon: "💊" },
  { id: "b6", name: "教育・子ども", color: "#FFD93D", icon: "🎒" },
  { id: "b7", name: "娯楽・趣味", color: "#9B59B6", icon: "🎮" },
  { id: "b8", name: "その他", color: "#A8A8A8", icon: "📦" },
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
// タイムゾーンずれを防ぐローカル日付パーサー
function parseLocalDate(dateStr) {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(y, m - 1, d);
}
function toLocalDateStr(date) {
  return date.getFullYear() + "-" +
    String(date.getMonth() + 1).padStart(2, "0") + "-" +
    String(date.getDate()).padStart(2, "0");
}

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

// イベントが指定日に該当するか判定（単日・期間・繰り返し対応）
function eventMatchesDate(e, ds) {
  if (e.endDate && e.endDate > e.date) {
    return ds >= e.date && ds <= e.endDate;
  }
  if (e.repeat && e.repeat !== "none" && e.repeatUntil) {
    const start = e.repeatFrom && e.repeatFrom >= e.date ? e.repeatFrom : e.date;
    if (ds < start || ds > e.repeatUntil) return false;
    if (e.repeat === "daily") return true;
    if (e.repeat === "weekly") return (e.repeatDays||[]).includes(new Date(ds+"T00:00:00").getDay());
    if (e.repeat === "monthly") return new Date(ds+"T00:00:00").getDate() === new Date(e.date+"T00:00:00").getDate();
  }
  return e.date === ds;
}

function MonthView({
  firstDay, daysInMonth, dateStr, todayStr, selectedDate, setSelectedDate,
  getEventsForDate, setView, dragX, setDragX, transitioning, setTransitioning,
  prevMonth, nextMonth, border, bgSub, bg, themeColor, textPri, badgeFontSize,
  DAYS_JP, showBadgeEmoji, setShowEventDetail, weekStartsMonday, badgeEmojiSize,
  events, darkMode
}) {
  const lastTap = useRef({ ds: null, time: 0 });
  const touchStart = useRef(null);

  const adjustedFirstDay = weekStartsMonday ? (firstDay === 0 ? 6 : firstDay - 1) : firstDay;
  const cells = [];
  for (let i = 0; i < adjustedFirstDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  const weeks = Math.ceil((adjustedFirstDay + daysInMonth) / 7);
  const orderedDays = weekStartsMonday ? ["月","火","水","木","金","土","日"] : DAYS_JP;
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

  // 全イベント収集（重複除去）
  const allEvents = [];
  for (let d = 1; d <= daysInMonth; d++) {
    const ds = dateStr(d);
    getEventsForDate(ds).forEach(ev => {
      if (!allEvents.find(e => e.id === ev.id)) allEvents.push(ev);
    });
  }

  // 週ごとのスロット計算
  const weekSlotMaps = [];
  for (let w = 0; w < weeks; w++) {
    const slotMap = {}; // eventId -> slot
    const slotCols = []; // slot -> Set of cols used
    const weekEvs = [];
    for (let col = 0; col < 7; col++) {
      const cellIdx = w * 7 + col;
      const d = cells[cellIdx];
      if (!d) continue;
      const ds = dateStr(d);
      getEventsForDate(ds).forEach(ev => {
        if (!weekEvs.find(e => e.id === ev.id)) weekEvs.push(ev);
      });
    }
    // 期間予定優先でソート
    weekEvs.sort((a, b) => {
      const aM = (a.endDate && a.endDate > a.date) || (a.repeat && a.repeat !== "none");
      const bM = (b.endDate && b.endDate > b.date) || (b.repeat && b.repeat !== "none");
      return (bM ? 1 : 0) - (aM ? 1 : 0);
    });
    weekEvs.forEach(ev => {
      const usedCols = [];
      for (let col = 0; col < 7; col++) {
        const cellIdx = w * 7 + col;
        const d = cells[cellIdx];
        if (d && eventMatchesDate(ev, dateStr(d))) usedCols.push(col);
      }
      if (usedCols.length === 0) return;
      let slot = 0;
      while (true) {
        if (!slotCols[slot]) { slotCols[slot] = new Set(); }
        if (!usedCols.some(c => slotCols[slot].has(c))) break;
        slot++;
      }
      slotMap[ev.id] = slot;
      usedCols.forEach(c => slotCols[slot].add(c));
    });
    weekSlotMaps.push({ slotMap, slotCols });
  }

  const MAX_SLOTS = 3;
  const CELL_DATE_H = 22; // 日付行の高さ
  const BADGE_H = badgeFontSize + 4;
  const BADGE_GAP = 1;
  const WEEK_H = CELL_DATE_H + (BADGE_H + BADGE_GAP) * MAX_SLOTS + 4;

  return (
    <div style={{ flex:1, display:"flex", flexDirection:"column", overflow:"hidden", touchAction:"none", width:"100%", boxSizing:"border-box" }}
      onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd}
    >
      {/* 曜日ヘッダー */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(7,minmax(0,1fr))", flexShrink:0, borderBottom:`1px solid ${border}` }}>
        {orderedDays.map((d,i) => (
          <div key={d} style={{ background:bg, textAlign:"center", lineHeight:"24px", fontSize:"11px", fontWeight:"700",
            color: i===sunIdx?"#FF6B9D": i===satIdx?"#4D96FF":"#9A8FAA" }}>{d}</div>
        ))}
      </div>

      {/* カレンダー本体 */}
      <div style={{
        flex:1, overflow:"hidden",
        transform:`translateX(${dragX}px)`,
        transition: transitioning ? "transform 0.2s ease" : "none",
        display:"flex", flexDirection:"column",
      }}>
        {Array.from({length:weeks}, (_,w) => {
          const { slotMap, slotCols } = weekSlotMaps[w] || { slotMap:{}, slotCols:[] };

          return (
            <div key={w} style={{ flex:1, display:"grid", gridTemplateColumns:"repeat(7,minmax(0,1fr))", position:"relative", borderBottom:`1px solid ${border}` }}>
              {/* 日付セル */}
              {Array.from({length:7}, (_,col) => {
                const cellIdx = w * 7 + col;
                const d = cells[cellIdx];
                if (!d) return <div key={"e"+col} style={{ borderRight:`1px solid ${border}`, background:bgSub }} />;
                const ds = dateStr(d);
                const isToday = ds===todayStr;
                const rawDow = new Date(ds).getDay();
                const holiday = getHoliday(ds);
                const handleTap = () => {
                  const now = Date.now();
                  if (selectedDate === ds) { setView("day"); }
                  else if (lastTap.current.ds === ds && now - lastTap.current.time < 300) { setSelectedDate(ds); setView("day"); }
                  else { setSelectedDate(ds); }
                  lastTap.current = { ds, time: now };
                };
                return (
                  <div key={ds} onClick={handleTap}
                    style={{ borderRight:`1px solid ${border}`, cursor:"pointer", minWidth:0, overflow:"hidden",
                      background: selectedDate===ds ? themeColor+"33" : isToday ? (darkMode ? themeColor+"77" : themeColor+"44") : holiday ? "#FF6B9D11" : bg,
                      paddingTop:2, paddingLeft:2 }}>
                    <div style={{ display:"flex", alignItems:"center", minWidth:0 }}>
                      <div style={{
                        width: isToday?26:20, height: isToday?26:20, borderRadius:"50%",
                        display:"flex", alignItems:"center", justifyContent:"center",
                        background: isToday?themeColor:"transparent",
                        boxShadow: isToday?`0 2px 8px ${themeColor}88`:"none",
                        color: isToday?"#fff": holiday?"#FF6B9D": rawDow===0?"#FF6B9D": rawDow===6?"#4D96FF":textPri,
                        fontWeight: isToday?"900":"400", fontSize: isToday?"13px":"11px",
                        flexShrink:0,
                      }}>{d}</div>
                      {holiday && <div style={{ fontSize:"7px", color:"#FF6B9D", fontWeight:"600", marginLeft:2, minWidth:0, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{holiday}</div>}
                    </div>
                  </div>
                );
              })}

              {/* 予定バッジ（absolute配置） */}
              {(() => {
                const badges = [];
                const rendered = new Set();
                for (let col = 0; col < 7; col++) {
                  const cellIdx = w * 7 + col;
                  const d = cells[cellIdx];
                  if (!d) continue;
                  const ds = dateStr(d);
                  getEventsForDate(ds).forEach(ev => {
                    if (rendered.has(ev.id)) return;
                    const slot = slotMap[ev.id];
                    if (slot === undefined || slot >= MAX_SLOTS) return;

                    // この週でのスパン計算
                    let startCol = col;
                    let endCol = col;
                    for (let c2 = col+1; c2 < 7; c2++) {
                      const d2 = cells[w*7+c2];
                      if (d2 && eventMatchesDate(ev, dateStr(d2))) endCol = c2;
                      else break;
                    }

                    // 前週から続いているか
                    let prevWeekContinues = false;
                    if (w > 0 && col === 0) {
                      const prevD = cells[(w-1)*7+6];
                      if (prevD && eventMatchesDate(ev, dateStr(prevD))) prevWeekContinues = true;
                    }
                    // 次週に続くか
                    let nextWeekContinues = false;
                    if (endCol === 6) {
                      const nextD = cells[(w+1)*7];
                      if (nextD && eventMatchesDate(ev, dateStr(nextD))) nextWeekContinues = true;
                    }

                    const top = CELL_DATE_H + slot * (BADGE_H + BADGE_GAP);
                    const leftPct = (startCol / 7) * 100;
                    const widthPct = ((endCol - startCol + 1) / 7) * 100;

                    const isStart = !prevWeekContinues;
                    const isEnd = !nextWeekContinues && endCol < 6 ? true : !nextWeekContinues;
                    const borderRadius = isStart && isEnd ? "3px" : isStart ? "3px 0 0 3px" : isEnd ? "0 3px 3px 0" : "0";

                    rendered.add(ev.id);
                    badges.push(
                      <div key={ev.id} style={{
                        position:"absolute",
                        top: top+"px",
                        left: `calc(${leftPct}% + 1px)`,
                        width: `calc(${widthPct}% - 2px)`,
                        height: BADGE_H+"px",
                        background: ev.color,
                        borderRadius,

                        display:"flex", alignItems:"center",
                        padding:"0 3px", boxSizing:"border-box",
                        fontSize:badgeFontSize+"px", color:"#fff", fontWeight:"600",
                        whiteSpace:"nowrap", overflow:"hidden", pointerEvents:"none",
                        zIndex: slot + 1,
                      }}>
                        {(isStart || col === 0) && showBadgeEmoji && <span style={{fontSize:Math.min(badgeEmojiSize,BADGE_H-2)+"px", flexShrink:0}}>{ev.emoji} </span>}
                        <span style={{overflow:"hidden", textOverflow:"ellipsis"}}>
                          {(isStart || col === 0) ? ev.title : ""}
                        </span>
                      </div>
                    );
                  });
                }
                // +N表示
                for (let col = 0; col < 7; col++) {
                  const cellIdx = w * 7 + col;
                  const d = cells[cellIdx];
                  if (!d) continue;
                  const ds = dateStr(d);
                  const dayEvs = getEventsForDate(ds);
                  const hidden = dayEvs.filter(ev => {
                    const s = slotMap[ev.id];
                    return s === undefined || s >= MAX_SLOTS;
                  }).length;
                  if (hidden > 0) {
                    const top = CELL_DATE_H + MAX_SLOTS * (BADGE_H + BADGE_GAP);
                    badges.push(
                      <div key={"more"+col} style={{
                        position:"absolute", top:top+"px",
                        left:`calc(${col/7*100}% + 2px)`,
                        fontSize:"8px", color:textPri, fontWeight:"700",
                      }}>+{hidden}</div>
                    );
                  }
                }
                return badges;
              })()}
            </div>
          );
        })}
      </div>
    </div>
  );
}


function DayView({
  selectedDate, getEventsForDate, setShowEventDetail, openAdd,
  bg, bgCard, textPri, textSec, themeColor, themeGrad, border,
  members, DAYS_JP, dayDragX, setDayDragX, dayTransitioning, setDayTransitioning,
  moveDay, addBtnStyle, getHoliday
}) {
  const dayEvents = selectedDate ? getEventsForDate(selectedDate) : [];
  const dp = selectedDate ? selectedDate.split("-") : [];
  const holiday = selectedDate ? getHoliday(selectedDate) : null;

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
      {selectedDate && (
        <div style={{ padding:"16px 16px 8px", flexShrink:0 }}>
          <div style={{ display:"flex", alignItems:"center" }}>
            <button onClick={() => moveDay(-1)} style={{ background:"none", border:"none", fontSize:"22px", cursor:"pointer", color:textSec, padding:"0 8px" }}>‹</button>
            <div style={{ flex:1, textAlign:"center" }}>
              <span style={{ fontSize:"22px", fontWeight:"800", color:textPri }}>{dp[1]}月{dp[2]}日</span>
              <span style={{ fontSize:"14px", color:textSec, marginLeft:8 }}>{DAYS_JP[new Date(selectedDate).getDay()]}曜日</span>
            </div>
            <button onClick={() => moveDay(1)} style={{ background:"none", border:"none", fontSize:"22px", cursor:"pointer", color:textSec, padding:"0 8px" }}>›</button>
          </div>
          {holiday && (
            <div style={{ textAlign:"center", marginTop:4 }}>
              <span style={{
                fontSize:"12px", fontWeight:"700", color:"#FF6B9D",
                background:"#FF6B9D22", borderRadius:"10px", padding:"2px 10px",
              }}>🎌 {holiday}</span>
            </div>
          )}
        </div>
      )}
      <div style={{
        flex:1, overflow:"auto", padding:"8px 16px 16px",
        transform:`translateX(${dayDragX}px)`,
        transition: dayTransitioning ? "transform 0.2s ease" : "none",
      }}>
        {dayEvents.length === 0 ? (
          <div style={{ textAlign:"center", padding:"48px 0", color:textSec }}>
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
                {ev.startTime && <div style={{ fontSize:"13px", color:textSec, marginBottom:8 }}>🕐 {ev.startTime}{ev.endTime ? " 〜 "+ev.endTime : ""}</div>}
                {ev.memo && <div style={{ fontSize:"13px", color:textSec, marginBottom:8 }}>{ev.memo}</div>}
                <div style={{ display:"flex", gap:6, flexWrap:"wrap" }}>
                  {(ev.members||[]).map(mid => {
                    const m = members.find(x => x.id===mid);
                    return m ? (
                      <span key={mid} style={{ background:m.color+"22", color:m.color, borderRadius:"20px", padding:"2px 10px", fontSize:"12px", fontWeight:"700" }}>{m.emoji} {m.name}</span>
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
  const [filterMembers, setFilterMembers] = useState(() => {
    try { return JSON.parse(localStorage.getItem("filter_members")) || []; } catch { return []; }
  });

  const updateFilterMembers = (next) => {
    setFilterMembers(next);
    try { localStorage.setItem("filter_members", JSON.stringify(next)); } catch {}
  };
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

  // ===== 追加機能：セクション切り替え（カレンダー／写真／家計簿） =====
  const [section, setSection] = useState("calendar");

  // ----- 写真タイムライン -----
  const [photos, setPhotos] = useState([]);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [showPhotoDetail, setShowPhotoDetail] = useState(null);
  const photoFileRef = useRef(null);

  // ----- 家計簿 -----
  const [budgetCategories, setBudgetCategories] = useState(DEFAULT_BUDGET_CATEGORIES);
  const [transactions, setTransactions] = useState([]);
  const [monthlyBudgets, setMonthlyBudgets] = useState({}); // { "2026-05": 300000, ... }
  const [showMoneyModal, setShowMoneyModal] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState(null);
  const [moneyForm, setMoneyForm] = useState({ date: todayStr, amount: "", categoryId: "", memo: "", receiptUrl: "" });
  const [ocrLoading, setOcrLoading] = useState(false);
  const [showIncomeEdit, setShowIncomeEdit] = useState(false);
  const receiptFileRef = useRef(null);

  const monthKey = `${year}-${String(month+1).padStart(2,"0")}`;

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
      try {
        const pVal = await dbGet("family_photos");
        if (pVal) setPhotos(JSON.parse(pVal));
      } catch {}
      try {
        const bcVal = await dbGet("budget_categories");
        if (bcVal) setBudgetCategories(JSON.parse(bcVal));
      } catch {}
      try {
        const tVal = await dbGet("transactions");
        if (tVal) setTransactions(JSON.parse(tVal));
      } catch {}
      try {
        const mbVal = await dbGet("monthly_budgets");
        if (mbVal) setMonthlyBudgets(JSON.parse(mbVal));
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
  const savePhotos = async (ps) => {
    try { await dbSet("family_photos", JSON.stringify(ps)); } catch {}
  };
  const saveBudgetCategories = async (cats) => {
    try { await dbSet("budget_categories", JSON.stringify(cats)); } catch {}
  };
  const saveTransactions = async (txs) => {
    try { await dbSet("transactions", JSON.stringify(txs)); } catch {}
  };
  const saveMonthlyBudgets = async (mb) => {
    try { await dbSet("monthly_budgets", JSON.stringify(mb)); } catch {}
  };

  // ===== 写真機能のハンドラー =====
  const handlePhotoFileSelect = async (e) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    setUploadingPhoto(true);
    try {
      const newPhotos = [];
      for (const file of files) {
        try {
          const [url, captureDate] = await Promise.all([
            uploadFile(file, "photos"),
            getPhotoCaptureDate(file),
          ]);
          newPhotos.push({
            id: "p" + Date.now() + "_" + Math.random().toString(36).slice(2,6),
            url,
            date: captureDate || selectedDate || todayStr,
            members: [], caption: "",
          });
        } catch {
          // 1枚失敗しても残りは続行
        }
      }
      if (newPhotos.length === 0) {
        showNotif("アップロードに失敗しました");
        return;
      }
      const next = [...newPhotos, ...photos];
      setPhotos(next);
      await savePhotos(next);
      showNotif(newPhotos.length > 1 ? `${newPhotos.length}枚の写真を追加しました📷` : "写真を追加しました📷");
    } catch (err) {
      showNotif("アップロードに失敗しました");
    } finally {
      setUploadingPhoto(false);
      if (photoFileRef.current) photoFileRef.current.value = "";
    }
  };
  const updatePhoto = async (id, patch) => {
    const next = photos.map(p => p.id === id ? { ...p, ...patch } : p);
    setPhotos(next);
    await savePhotos(next);
  };
  const deletePhoto = async (id) => {
    const next = photos.filter(p => p.id !== id);
    setPhotos(next);
    await savePhotos(next);
    setShowPhotoDetail(null);
    showNotif("写真を削除しました");
  };

  // ===== 家計簿機能のハンドラー =====
  const openAddTransaction = () => {
    setEditingTransaction(null);
    setMoneyForm({ date: todayStr, amount: "", categoryId: "", memo: "", receiptUrl: "" });
    setShowMoneyModal(true);
  };
  const openEditTransaction = (tx) => {
    setEditingTransaction(tx);
    setMoneyForm({ ...tx });
    setShowMoneyModal(true);
  };
  const handleReceiptFileSelect = async (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    setOcrLoading(true);
    try {
      const [url, captureDate] = await Promise.all([
        uploadFile(file, "receipts"),
        getPhotoCaptureDate(file),
      ]);
      setMoneyForm(f => ({ ...f, receiptUrl: url }));
      const result = await ocrReceipt(url);

      // 日付の優先順位：①レシート記載日（OCR） → ②写真の撮影日（EXIF等） → ③登録日（今日 / モーダルを開いた時点の日付）
      const ocrDate = result.date && String(result.date).trim();
      const finalDate = ocrDate || captureDate || moneyForm.date || todayStr;
      const finalAmount = result.amount != null ? String(result.amount) : moneyForm.amount;
      const finalMemo = result.memo || moneyForm.memo;

      // 重複チェック：同じ日付・金額のレシートが既にあればスキップ
      // （メモはOCRのたびに表現が微妙に変わりうるため、判定には使わない）
      const isDuplicate = transactions.some(t =>
        t.date === finalDate &&
        Number(t.amount) === Number(finalAmount)
      );
      if (isDuplicate) {
        showNotif("同じ内容のレシートは登録済みのためスキップしました");
        setShowMoneyModal(false);
        return;
      }

      setMoneyForm(f => ({
        ...f,
        amount: finalAmount,
        date: finalDate,
        memo: finalMemo,
      }));
      showNotif("レシートを読み取りました。カテゴリーを選んでください");
    } catch (err) {
      showNotif("読み取りに失敗しました。手入力してください");
    } finally {
      setOcrLoading(false);
      if (receiptFileRef.current) receiptFileRef.current.value = "";
    }
  };
  const saveTransaction = async () => {
    const amt = Number(moneyForm.amount);
    if (!moneyForm.date || !amt || !moneyForm.categoryId) return;
    let next;
    if (editingTransaction) {
      next = transactions.map(t => t.id === editingTransaction.id ? { ...moneyForm, amount: amt, id: t.id } : t);
    } else {
      next = [...transactions, { ...moneyForm, amount: amt, id: "t" + Date.now() }];
    }
    setTransactions(next);
    await saveTransactions(next);
    setShowMoneyModal(false);
    showNotif(editingTransaction ? "更新しました✨" : "支出を記録しました🧾");
  };
  const deleteTransaction = async (id) => {
    const next = transactions.filter(t => t.id !== id);
    setTransactions(next);
    await saveTransactions(next);
    setShowMoneyModal(false);
    showNotif("削除しました");
  };
  const setIncomeForMonth = async (key, amount) => {
    const next = { ...monthlyBudgets, [key]: Number(amount) || 0 };
    setMonthlyBudgets(next);
    await saveMonthlyBudgets(next);
  };
  const getMonthTransactions = (key) => transactions.filter(t => t.date && t.date.startsWith(key));
  const getMonthTotal = (key) => getMonthTransactions(key).reduce((s,t) => s + (Number(t.amount)||0), 0);

  const showNotif = (msg) => {
    setNotification(msg);
    setTimeout(() => setNotification(null), 2000);
  };

  const openAdd = (date) => {
    const d = date || selectedDate || todayStr;
    setEditingEvent(null);
    setForm({ title:"", date:d, endDate:"", startTime:"", endTime:"", members:[], color:"#4D96FF", emoji:"📅", memo:"", categoryId:"", repeat:"none", repeatDays:[], repeatFrom:"", repeatUntil:"" });
    setShowEventModal(true);
  };
  const openEdit = (ev) => {
    setEditingEvent(ev);
    setForm({
      startTime:"", endTime:"", endDate:"", repeat:"none",
      repeatDays:[], repeatFrom:"", repeatUntil:"",
      ...ev
    });
    setShowEventModal(true);
  };
  const saveForm = async () => {
    if (!form.title.trim() || !form.date) return;
    let newEvents;
    const newId = "e" + Date.now();

    if (editingEvent) {
      // 編集：単純に1件更新
      newEvents = events.map(e => e.id === editingEvent.id ? { ...form, id: e.id } : e);
    } else {
      // 新規：1件として保存（期間・繰り返し情報をそのまま保持）
      newEvents = [...events, { ...form, id: newId }];
    }
    setEvents(newEvents);
    await saveEvents(newEvents);
    setShowEventModal(false);
    setView("month");
    showNotif(editingEvent ? "更新しました✨" : `追加しました🎉`);
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
    events.filter(e => eventMatchesDate(e, ds) && (filterMembers.length===0 || (e.members||[]).some(m => filterMembers.includes(m))));

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

  // ===== 写真タイムライン画面（みてね風：日付順グルーピング） =====
  const PhotosView = () => {
    const sorted = [...photos].sort((a,b) => b.date.localeCompare(a.date));
    // 月ごと → 日ごとの2階層でグルーピング（みてね風）
    const monthGroups = {};
    sorted.forEach(p => {
      const ym = p.date.slice(0,7);
      if (!monthGroups[ym]) monthGroups[ym] = {};
      const dayGroups = monthGroups[ym];
      if (!dayGroups[p.date]) dayGroups[p.date] = [];
      dayGroups[p.date].push(p);
    });
    return (
      <div style={{ flex:1, overflow:"auto", padding:"16px", background:bg }}>
        {sorted.length===0 ? (
          <div style={{ textAlign:"center", padding:"48px 0", color:"#C9B8E8" }}>
            <div style={{ fontSize:"48px", marginBottom:12 }}>📷</div>
            <div>まだ写真がありません</div>
            <div style={{ fontSize:"12px", marginTop:8 }}>右下の＋から写真を選んで追加できます</div>
          </div>
        ) : Object.entries(monthGroups).map(([ym, dayGroups]) => {
          const [yy,mm] = ym.split("-").map(Number);
          return (
            <div key={ym} style={{ marginBottom:8 }}>
              {/* 月の見出し */}
              <div style={{
                fontWeight:"800", fontSize:"16px", color:"#fff", marginBottom:12,
                background:themeGrad, borderRadius:"10px", padding:"8px 14px",
                display:"inline-block",
              }}>
                {yy}年{MONTHS_JP[mm-1]}
              </div>
              {Object.entries(dayGroups).map(([date, ps]) => {
                const dp = date.split("-").map(Number);
                const dow = DAYS_JP[new Date(date).getDay()];
                return (
                  <div key={date} style={{ marginBottom:20 }}>
                    <div style={{ fontWeight:"700", fontSize:"13px", color:textSec, marginBottom:8, paddingLeft:2 }}>
                      {dp[1]}月{dp[2]}日（{dow}）
                    </div>
                    <div style={{ display:"grid", gridTemplateColumns:"repeat(3, 1fr)", gap:6 }}>
                      {ps.map(p => (
                        <div key={p.id} onClick={() => setShowPhotoDetail(p)} style={{
                          position:"relative", paddingBottom:"100%", borderRadius:"12px",
                          overflow:"hidden", cursor:"pointer", background:bgSub,
                        }}>
                          <img src={p.url} alt="" style={{
                            position:"absolute", inset:0, width:"100%", height:"100%", objectFit:"cover",
                          }} />
                          {p.caption && (
                            <div style={{
                              position:"absolute", bottom:0, left:0, right:0,
                              background:"linear-gradient(transparent, rgba(0,0,0,0.55))",
                              color:"#fff", fontSize:"10px", padding:"10px 6px 4px",
                              overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap",
                            }}>{p.caption}</div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
    );
  };

  // ===== 家計簿画面（マネーフォワード風：月次収支） =====
  const MoneyView = () => {
    const monthTx = getMonthTransactions(monthKey).sort((a,b) => b.date.localeCompare(a.date));
    const total = getMonthTotal(monthKey);
    const income = monthlyBudgets[monthKey] || 0;
    const remaining = income - total;
    const byCategory = {};
    monthTx.forEach(t => {
      byCategory[t.categoryId] = (byCategory[t.categoryId]||0) + Number(t.amount||0);
    });
    return (
      <div style={{ flex:1, overflow:"auto", padding:"16px", background:bg }}>
        {/* 収支サマリー */}
        <div style={{
          background:themeGrad, borderRadius:"18px", padding:"18px", marginBottom:16, color:"#fff",
        }}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:8 }}>
            <div style={{ fontSize:"13px", opacity:0.9 }}>{year}年{MONTHS_JP[month]}の収入</div>
            <button onClick={() => setShowIncomeEdit(true)} style={{
              background:"rgba(255,255,255,0.25)", border:"none", color:"#fff",
              borderRadius:"12px", padding:"3px 10px", fontSize:"11px", cursor:"pointer",
            }}>✏️ 設定</button>
          </div>
          <div style={{ fontSize:"22px", fontWeight:"800", marginBottom:12 }}>¥{income.toLocaleString()}</div>
          <div style={{ display:"flex", justifyContent:"space-between", fontSize:"13px", opacity:0.95, marginBottom:4 }}>
            <span>支出合計</span><span>¥{total.toLocaleString()}</span>
          </div>
          <div style={{ display:"flex", justifyContent:"space-between", fontSize:"16px", fontWeight:"800" }}>
            <span>残り</span><span style={{ color: remaining<0 ? "#FFD6D6" : "#fff" }}>¥{remaining.toLocaleString()}</span>
          </div>
        </div>

        {showIncomeEdit && (
          <div style={{ background:bgCard, borderRadius:"14px", padding:"14px", marginBottom:16, border:`1px solid ${border}` }}>
            <div style={{ fontSize:"12px", fontWeight:"700", color:textSec, marginBottom:6 }}>今月の収入を設定</div>
            <div style={{ display:"flex", gap:8 }}>
              <input type="number" defaultValue={income||""} id="income-input" placeholder="例：300000"
                style={{ flex:1, padding:"10px 12px", borderRadius:"12px", border:`2px solid ${border}`, fontSize:"15px", boxSizing:"border-box", color:textPri, background:bg }} />
              <button onClick={() => {
                const v = document.getElementById("income-input").value;
                setIncomeForMonth(monthKey, v);
                setShowIncomeEdit(false);
              }} style={{ padding:"0 16px", borderRadius:"12px", background:themeGrad, border:"none", color:"#fff", fontWeight:"700", cursor:"pointer" }}>保存</button>
            </div>
          </div>
        )}

        {/* カテゴリー別内訳 */}
        {Object.keys(byCategory).length > 0 && (
          <div style={{ marginBottom:16 }}>
            <div style={{ fontSize:"12px", fontWeight:"700", color:textSec, marginBottom:8 }}>カテゴリー別支出</div>
            {Object.entries(byCategory).sort((a,b) => b[1]-a[1]).map(([cid, amt]) => {
              const cat = budgetCategories.find(c => c.id===cid);
              const pct = total > 0 ? Math.round(amt/total*100) : 0;
              return (
                <div key={cid} style={{ marginBottom:8 }}>
                  <div style={{ display:"flex", justifyContent:"space-between", fontSize:"13px", color:textPri, marginBottom:3 }}>
                    <span>{cat ? `${cat.icon} ${cat.name}` : "未分類"}</span>
                    <span style={{ fontWeight:"700" }}>¥{amt.toLocaleString()}（{pct}%）</span>
                  </div>
                  <div style={{ height:6, borderRadius:3, background:border, overflow:"hidden" }}>
                    <div style={{ height:"100%", width:`${pct}%`, background:cat?cat.color:"#ccc", borderRadius:3 }} />
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* 取引一覧 */}
        <div style={{ fontSize:"12px", fontWeight:"700", color:textSec, marginBottom:8 }}>支出履歴</div>
        {monthTx.length===0 ? (
          <div style={{ textAlign:"center", padding:"32px 0", color:"#C9B8E8" }}>
            <div style={{ fontSize:"40px", marginBottom:8 }}>🧾</div>
            <div>今月の記録はまだありません</div>
          </div>
        ) : monthTx.map(t => {
          const cat = budgetCategories.find(c => c.id===t.categoryId);
          return (
            <div key={t.id} onClick={() => openEditTransaction(t)} style={{
              display:"flex", alignItems:"center", gap:10,
              background:bgCard, borderRadius:"14px", padding:"12px 14px", marginBottom:8,
              borderLeft:`4px solid ${cat?cat.color:"#ccc"}`, cursor:"pointer",
              boxShadow:"0 2px 8px rgba(155,89,182,0.07)",
            }}>
              {t.receiptUrl && <img src={t.receiptUrl} alt="" style={{ width:40, height:40, borderRadius:8, objectFit:"cover" }} />}
              <div style={{ flex:1 }}>
                <div style={{ fontWeight:"700", color:textPri, fontSize:"14px" }}>{cat ? `${cat.icon} ${cat.name}` : "未分類"}</div>
                <div style={{ fontSize:"11px", color:textSec }}>{t.date.replace(/-/g,"/")}{t.memo ? " ・ " + t.memo : ""}</div>
              </div>
              <div style={{ fontWeight:"800", color:textPri, fontSize:"15px" }}>¥{Number(t.amount).toLocaleString()}</div>
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
        {section === "calendar" && (
          <>
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
              <button onClick={() => updateFilterMembers([])} style={{
                background: filterMembers.length===0?"rgba(255,255,255,0.95)":"rgba(255,255,255,0.2)",
                color: filterMembers.length===0?themeColor:"#fff",
                border:"none", borderRadius:"20px", padding:"3px 10px", fontSize:"11px",
                fontWeight:"700", cursor:"pointer", whiteSpace:"nowrap", flexShrink:0,
              }}>全員</button>
              {members.map(m => {
                const on = filterMembers.includes(m.id);
                return (
                  <button key={m.id} onClick={() => updateFilterMembers(
                    on ? filterMembers.filter(x => x!==m.id) : [...filterMembers, m.id]
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
          </>
        )}

        {section === "photos" && (
          <div style={{ display:"flex", alignItems:"center", gap:8, padding:"12px 0" }}>
            <div style={{ color:"#fff", fontWeight:"800", fontSize:"18px", flex:1 }}>📷 写真タイムライン</div>
            <button onClick={() => { setShowSettings(true); setEditingMember(null); }} style={{
              background:"rgba(255,255,255,0.2)", border:"none", color:"#fff",
              borderRadius:"50%", width:30, height:30, fontSize:"14px", cursor:"pointer",
              display:"flex", alignItems:"center", justifyContent:"center",
            }}>⚙️</button>
          </div>
        )}

        {section === "money" && (
          <div style={{ display:"flex", alignItems:"center", gap:8, padding:"10px 0" }}>
            <button onClick={prevMonth} style={{ background:"none", border:"none", color:"#fff", fontSize:"22px", cursor:"pointer", padding:"0 4px" }}>‹</button>
            <div style={{ color:"#fff", fontWeight:"800", fontSize:"16px", flex:1, textAlign:"center" }}>💰 {year}年{MONTHS_JP[month]}の家計簿</div>
            <button onClick={nextMonth} style={{ background:"none", border:"none", color:"#fff", fontSize:"22px", cursor:"pointer", padding:"0 4px" }}>›</button>
            <button onClick={() => { setShowSettings(true); setEditingMember(null); }} style={{
              background:"rgba(255,255,255,0.2)", border:"none", color:"#fff",
              borderRadius:"50%", width:30, height:30, fontSize:"14px", cursor:"pointer",
              display:"flex", alignItems:"center", justifyContent:"center",
            }}>⚙️</button>
          </div>
        )}
      </div>

      <div style={{ flex:1, display:"flex", flexDirection:"column", overflow:"hidden", background:bg, width:"100%", boxSizing:"border-box" }}>
        {section === "calendar" && view==="month" && <MonthView
          firstDay={firstDay} daysInMonth={daysInMonth} dateStr={dateStr}
          todayStr={todayStr} selectedDate={selectedDate} setSelectedDate={setSelectedDate}
          getEventsForDate={getEventsForDate} setView={setView}
          dragX={dragX} setDragX={setDragX} transitioning={transitioning} setTransitioning={setTransitioning}
          prevMonth={prevMonth} nextMonth={nextMonth}
          border={border} bgSub={bgSub} bg={bg} themeColor={themeColor} textPri={textPri}
          badgeFontSize={badgeFontSize} badgeEmojiSize={badgeEmojiSize} DAYS_JP={DAYS_JP}
          showBadgeEmoji={showBadgeEmoji} setShowEventDetail={setShowEventDetail}
          weekStartsMonday={weekStartsMonday} events={events} darkMode={darkMode}
        />}
        {section === "calendar" && view==="day" && (
          selectedDate
            ? <DayView
                selectedDate={selectedDate}
                getEventsForDate={getEventsForDate}
                setShowEventDetail={setShowEventDetail}
                openAdd={openAdd}
                bg={bg} bgCard={bgCard} textPri={textPri} textSec={textSec}
                themeColor={themeColor} themeGrad={themeGrad} border={border}
                members={members} DAYS_JP={DAYS_JP}
                dayDragX={dayDragX} setDayDragX={setDayDragX}
                dayTransitioning={dayTransitioning} setDayTransitioning={setDayTransitioning}
                moveDay={moveDay} addBtnStyle={addBtnStyle} getHoliday={getHoliday}
              />
            : <div style={{ flex:1, display:"flex", alignItems:"center", justifyContent:"center", color:"#C9B8E8", flexDirection:"column", gap:12 }}>
                <div style={{ fontSize:"48px" }}>📅</div>
                <div>月表示から日付を選択してください</div>
              </div>
        )}
        {section === "calendar" && view==="list" && <ListView />}
        {section === "photos" && <PhotosView />}
        {section === "money" && <MoneyView />}
      </div>

      {/* 下部ナビゲーション（カレンダー／写真／家計簿） */}
      <div style={{
        display:"flex", borderTop:`1px solid ${border}`, background:bgCard,
        paddingBottom:"env(safe-area-inset-bottom, 0px)", flexShrink:0,
      }}>
        {[["calendar","📅","カレンダー"],["photos","📷","写真"],["money","💰","家計簿"]].map(([key,icon,label]) => (
          <button key={key} onClick={() => setSection(key)} style={{
            flex:1, display:"flex", flexDirection:"column", alignItems:"center", gap:2,
            padding:"8px 0", background:"none", border:"none", cursor:"pointer",
            color: section===key ? themeColor : textSec,
          }}>
            <span style={{ fontSize:"20px" }}>{icon}</span>
            <span style={{ fontSize:"10px", fontWeight:"700" }}>{label}</span>
          </button>
        ))}
      </div>

      {/* 写真アップロード用の隠しinput */}
      <input ref={photoFileRef} type="file" accept="image/*" multiple
        style={{ display:"none" }} onChange={handlePhotoFileSelect} />

      <button onClick={() => {
        if (section === "calendar") openAdd(selectedDate || todayStr);
        else if (section === "photos") photoFileRef.current && photoFileRef.current.click();
        else if (section === "money") openAddTransaction();
      }} disabled={uploadingPhoto} style={{
        position:"fixed", bottom:76, right:24,
        width:56, height:56, borderRadius:"50%",
        background:themeGrad,
        border:"none", color:"#fff", fontSize:"28px", cursor:"pointer",
        boxShadow:"0 6px 24px rgba(155,89,182,0.5)",
        display:"flex", alignItems:"center", justifyContent:"center", zIndex:100,
        opacity: uploadingPhoto ? 0.6 : 1,
      }}>{uploadingPhoto ? "…" : "＋"}</button>

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
                  WebkitAppearance:"none", appearance:"none",
                  }} />
                <span style={{ color:textSec, fontWeight:"700", flexShrink:0 }}>〜</span>
                <input type="date" value={form.endDate||""} onChange={e => setForm(f => ({ ...f, endDate:e.target.value }))}
                  placeholder="終了日（任意）"
                  style={{
                    flex:1, padding:"12px 16px", borderRadius:"14px",
                    border:`2px solid ${form.endDate ? themeColor : border}`, fontSize:"16px", outline:"none",
                    boxSizing:"border-box", color:textPri, background:bg,
                  WebkitAppearance:"none", appearance:"none",
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
                  WebkitAppearance:"none", appearance:"none",
                  }} />
                <span style={{ color:textSec, fontWeight:"700" }}>〜</span>
                <input type="time" value={form.endTime||""} onChange={e => setForm(f => ({ ...f, endTime:e.target.value }))}
                  style={{
                    flex:1, padding:"12px 16px", borderRadius:"14px",
                    border:`2px solid ${border}`, fontSize:"16px", outline:"none",
                    boxSizing:"border-box", color:textPri, background:bg,
                  WebkitAppearance:"none", appearance:"none",
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
            <div style={{ marginBottom:14, overflowX:"hidden" }}>
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
              {/* 繰り返し開始日・終了日 */}
              {form.repeat !== "none" && (
                <div style={{ width:"100%", boxSizing:"border-box", overflow:"hidden" }}>
                  <div style={{ display:"flex", gap:8, alignItems:"center", marginBottom:8 }}>
                    <div style={{ flex:1 }}>
                      <div style={{ fontSize:"11px", color:textSec, marginBottom:4 }}>開始日</div>
                      <input type="date" value={form.repeatFrom||form.date||""} onChange={e => setForm(f => ({ ...f, repeatFrom:e.target.value }))}
                        style={{
                          width:"100%", padding:"10px 10px", borderRadius:"14px",
                          border:`2px solid ${form.repeatFrom ? themeColor : border}`,
                          fontSize:"14px", outline:"none", boxSizing:"border-box",
                          color:textPri, background:bg, display:"block",
                          WebkitAppearance:"none", appearance:"none",
                        }} />
                    </div>
                    <span style={{ color:textSec, fontWeight:"700", flexShrink:0, paddingTop:16 }}>〜</span>
                    <div style={{ flex:1 }}>
                      <div style={{ fontSize:"11px", color:textSec, marginBottom:4 }}>終了日</div>
                      <input type="date" value={form.repeatUntil||""} onChange={e => setForm(f => ({ ...f, repeatUntil:e.target.value }))}
                        style={{
                          width:"100%", padding:"10px 10px", borderRadius:"14px",
                          border:`2px solid ${form.repeatUntil ? themeColor : border}`,
                          fontSize:"14px", outline:"none", boxSizing:"border-box",
                          color:textPri, background:bg, display:"block",
                          WebkitAppearance:"none", appearance:"none",
                        }} />
                    </div>
                  </div>
                  {form.repeat === "weekly" && form.repeatDays.length > 0 && form.repeatUntil && (
                    <div style={{ fontSize:"11px", color:themeColor, marginTop:4, fontWeight:"600" }}>
                      📅 約{Math.round(Math.abs(new Date(form.repeatUntil)-new Date(form.repeatFrom||form.date))/86400000/7 * form.repeatDays.length)}件の予定を追加します
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

      {/* 写真詳細モーダル */}
      {showPhotoDetail && (
        <div style={{
          position:"fixed", inset:0, background:"rgba(0,0,0,0.7)", zIndex:300,
          display:"flex", alignItems:"flex-end",
        }} onClick={() => setShowPhotoDetail(null)}>
          <div style={{
            background:bgCard, borderRadius:"24px 24px 0 0", width:"100%",
            maxHeight:"90vh", overflowY:"auto", boxSizing:"border-box",
          }} onClick={e => e.stopPropagation()}>
            <img src={showPhotoDetail.url} alt="" style={{ width:"100%", maxHeight:"50vh", objectFit:"contain", background:"#000" }} />
            <div style={{ padding:"16px 20px 32px" }}>
              <input
                value={showPhotoDetail.date}
                onChange={e => setShowPhotoDetail(p => ({ ...p, date: e.target.value }))}
                onBlur={e => updatePhoto(showPhotoDetail.id, { date: e.target.value })}
                type="date"
                style={{ padding:"8px 12px", borderRadius:"12px", border:`2px solid ${border}`, fontSize:"14px", marginBottom:12, color:textPri, background:bg }} />
              <div style={{ display:"flex", gap:6, flexWrap:"wrap", marginBottom:12 }}>
                {members.map(m => {
                  const on = (showPhotoDetail.members||[]).includes(m.id);
                  return (
                    <button key={m.id} onClick={() => {
                      const nextMembers = on ? showPhotoDetail.members.filter(x=>x!==m.id) : [...(showPhotoDetail.members||[]), m.id];
                      setShowPhotoDetail(p => ({ ...p, members: nextMembers }));
                      updatePhoto(showPhotoDetail.id, { members: nextMembers });
                    }} style={{
                      padding:"5px 12px", borderRadius:"20px", border:"2px solid",
                      borderColor: on ? m.color : border,
                      background: on ? m.color+"22" : bg,
                      color: on ? m.color : textSec,
                      fontWeight:"700", fontSize:"12px", cursor:"pointer",
                    }}>{m.emoji} {m.name}</button>
                  );
                })}
              </div>
              <textarea
                value={showPhotoDetail.caption||""}
                placeholder="ひとことメモ"
                onChange={e => setShowPhotoDetail(p => ({ ...p, caption: e.target.value }))}
                onBlur={e => updatePhoto(showPhotoDetail.id, { caption: e.target.value })}
                rows={2}
                style={{ width:"100%", padding:"10px 14px", borderRadius:"12px", border:`2px solid ${border}`, fontSize:"14px", boxSizing:"border-box", marginBottom:16, color:textPri, background:bg, resize:"none" }} />
              <button onClick={() => deletePhoto(showPhotoDetail.id)} style={{
                width:"100%", padding:"12px", borderRadius:"14px",
                background:"#fff", border:"2px solid #ffcccc", color:"#e74c3c",
                fontWeight:"700", fontSize:"14px", cursor:"pointer",
              }}>🗑 この写真を削除</button>
            </div>
          </div>
        </div>
      )}

      {/* 家計簿：支出追加・編集モーダル */}
      {showMoneyModal && (
        <div style={{
          position:"fixed", inset:0, background:"rgba(61,43,94,0.5)", zIndex:300,
          display:"flex", alignItems:"flex-end", backdropFilter:"blur(4px)",
        }} onClick={() => setShowMoneyModal(false)}>
          <div style={{
            background:bgCard, borderRadius:"24px 24px 0 0", width:"100%",
            maxHeight:"90vh", overflowY:"auto", padding:"24px 20px 40px", boxSizing:"border-box",
          }} onClick={e => e.stopPropagation()}>
            <div style={{ fontWeight:"800", fontSize:"18px", color:textPri, marginBottom:16 }}>
              {editingTransaction ? "支出を編集" : "支出を記録"}
            </div>

            {/* レシート撮影・OCR */}
            <div style={{ marginBottom:16 }}>
              <input ref={receiptFileRef} type="file" accept="image/*" capture="environment"
                style={{ display:"none" }} onChange={handleReceiptFileSelect} />
              {moneyForm.receiptUrl ? (
                <img src={moneyForm.receiptUrl} alt="" style={{ width:"100%", maxHeight:180, objectFit:"contain", borderRadius:"14px", background:bgSub }} />
              ) : (
                <button onClick={() => receiptFileRef.current && receiptFileRef.current.click()} disabled={ocrLoading} style={{
                  width:"100%", padding:"20px", borderRadius:"14px", border:`2px dashed ${border}`,
                  background:bgSub, color:textSec, fontWeight:"700", fontSize:"14px", cursor:"pointer",
                }}>{ocrLoading ? "🧾 レシートを読み取り中…" : "📷 レシートを撮影して自動入力"}</button>
              )}
              {moneyForm.receiptUrl && (
                <button onClick={() => receiptFileRef.current && receiptFileRef.current.click()} disabled={ocrLoading} style={{
                  marginTop:8, width:"100%", padding:"8px", borderRadius:"12px", border:`1px solid ${border}`,
                  background:"none", color:textSec, fontWeight:"700", fontSize:"12px", cursor:"pointer",
                }}>{ocrLoading ? "読み取り中…" : "撮り直す"}</button>
              )}
            </div>

            <div style={{ marginBottom:14 }}>
              <div style={{ fontSize:"12px", fontWeight:"700", color:textSec, marginBottom:6 }}>金額</div>
              <input type="number" value={moneyForm.amount} onChange={e => setMoneyForm(f => ({ ...f, amount:e.target.value }))}
                placeholder="例：1200" style={{
                  width:"100%", padding:"12px 16px", borderRadius:"14px",
                  border:`2px solid ${border}`, fontSize:"18px", fontWeight:"700", outline:"none",
                  boxSizing:"border-box", color:textPri, background:bg,
                }} />
            </div>

            <div style={{ marginBottom:14 }}>
              <div style={{ fontSize:"12px", fontWeight:"700", color:textSec, marginBottom:6 }}>日付</div>
              <input type="date" value={moneyForm.date} onChange={e => setMoneyForm(f => ({ ...f, date:e.target.value }))}
                style={{
                  width:"100%", padding:"12px 16px", borderRadius:"14px",
                  border:`2px solid ${border}`, fontSize:"15px", outline:"none",
                  boxSizing:"border-box", color:textPri, background:bg,
                }} />
            </div>

            <div style={{ marginBottom:14 }}>
              <div style={{ fontSize:"12px", fontWeight:"700", color:textSec, marginBottom:8 }}>カテゴリー（自分で選択）</div>
              <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
                {budgetCategories.map(cat => (
                  <button key={cat.id} onClick={() => setMoneyForm(f => ({ ...f, categoryId:cat.id }))} style={{
                    padding:"6px 14px", borderRadius:"20px", border:"2px solid",
                    borderColor: moneyForm.categoryId===cat.id ? cat.color : border,
                    background: moneyForm.categoryId===cat.id ? cat.color : bg,
                    color: moneyForm.categoryId===cat.id ? "#fff" : textSec,
                    fontWeight:"700", fontSize:"13px", cursor:"pointer",
                  }}>{cat.icon} {cat.name}</button>
                ))}
              </div>
            </div>

            <div style={{ marginBottom:24 }}>
              <div style={{ fontSize:"12px", fontWeight:"700", color:textSec, marginBottom:6 }}>メモ</div>
              <input value={moneyForm.memo} onChange={e => setMoneyForm(f => ({ ...f, memo:e.target.value }))}
                placeholder="例：スーパーで買い物" style={{
                  width:"100%", padding:"12px 16px", borderRadius:"14px",
                  border:`2px solid ${border}`, fontSize:"14px", outline:"none",
                  boxSizing:"border-box", color:textPri, background:bg,
                }} />
            </div>

            <div style={{ display:"flex", gap:10 }}>
              {editingTransaction && (
                <button onClick={() => deleteTransaction(editingTransaction.id)} style={{
                  flex:1, padding:"14px", borderRadius:"16px",
                  background:"#fff", border:"2px solid #ffcccc", color:"#e74c3c",
                  fontWeight:"700", fontSize:"15px", cursor:"pointer",
                }}>🗑 削除</button>
              )}
              <button onClick={saveTransaction} disabled={!moneyForm.amount || !moneyForm.date || !moneyForm.categoryId} style={{
                flex:2, padding:"14px", borderRadius:"16px",
                background:themeGrad,
                border:"none", color:"#fff", fontWeight:"700", fontSize:"15px",
                cursor: (!moneyForm.amount || !moneyForm.date || !moneyForm.categoryId) ? "not-allowed" : "pointer",
                opacity: (!moneyForm.amount || !moneyForm.date || !moneyForm.categoryId) ? 0.5 : 1,
                boxShadow:"0 4px 15px rgba(155,89,182,0.3)",
              }}>{editingTransaction ? "更新する" : "記録する"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
