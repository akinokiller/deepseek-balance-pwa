// DeepSeek 余额小组件 - Scriptable
// 功能：余额 + 峰谷变色 + 每日/近7日消耗
// 安装：Scriptable App 粘贴此脚本 → 参数填 sk-xxx → 桌面添加 Scriptable 小组件

// ========== 配置 ==========
const CONFIG = {
  // 优先用小组件参数里的 Key，留空则用这里的
  apiKey: "", // 例: "sk-xxxxxxxx"
  // 直连官方（Scriptable无CORS限制），失败自动切代理
  proxyUrl: "https://deepseek-balance-pwa.pages.dev/api/balance",
  pwaUrl: "https://deepseek-balance-pwa.pages.dev",
  historyFile: "deepseek_history.json", // 存iCloud便于同步，也可改成本地
}
// 允许 widgetParameter 覆盖
if (args.widgetParameter && args.widgetParameter.startsWith("sk-")) {
  CONFIG.apiKey = args.widgetParameter.trim()
}

// ========== 峰谷逻辑（与PWA一致 V4规则）==========
function getBeijingNow(){
  const now = new Date()
  const utc = now.getTime() + now.getTimezoneOffset()*60000
  return new Date(utc + 8*3600000)
}
function getPeriod(){
  const bj = getBeijingNow()
  const h = bj.getHours() + bj.getMinutes()/60
  const isPeak = (h>=9 && h<12) || (h>=14 && h<18) // 北京 09-12, 14-18
  const isHistOff = (h>=0.5 && h<8.5)
  const mins = bj.getHours()*60 + bj.getMinutes()
  let nextMins
  if(mins < 9*60) nextMins = 9*60
  else if(mins < 12*60) nextMins = 12*60
  else if(mins < 14*60) nextMins = 14*60
  else if(mins < 18*60) nextMins = 18*60
  else nextMins = 24*60 + 9*60
  const diff = nextMins - mins
  const ch = Math.floor(diff/60), cm = diff%60
  const countdown = `${ch>0?ch+'h':''}${cm}m后切`
  const label = isPeak ? "🔴 高峰×2" : "🟢 谷值优惠"
  const sub = isPeak ? "价格翻倍" : (isHistOff ? "最优惠窗口" : "推荐使用")
  return {isPeak, isHistOff, label, sub, countdown, bj}
}

// ========== 历史/消耗 ==========
function fm(){
  // 优先iCloud，失败回退本地
  try{
    const iCloud = FileManager.iCloud()
    if(iCloud.isFileStoredIniCloud(module.filename) || true) return iCloud
  }catch{}
  return FileManager.local()
}
function historyPath(){
  const f = fm()
  return f.joinPath(f.documentsDirectory(), CONFIG.historyFile)
}
function loadHistory(){
  try{
    const f = fm()
    const p = historyPath()
    if(f.fileExists(p)){
      if(f.isFileStoredIniCloud(p)) f.downloadFileFromiCloud(p)
      return JSON.parse(f.readString(p))
    }
  }catch(e){ console.log(e) }
  return []
}
function saveHistory(arr){
  try{
    const f = fm()
    const p = historyPath()
    f.writeString(p, JSON.stringify(arr.slice(-60)))
  }catch(e){ console.log(e) }
}
function upsertHistory(balance, currency){
  const today = getBeijingNow().toISOString().slice(0,10)
  const hist = loadHistory()
  const entry = {date: today, balance: parseFloat(balance), currency, ts: Date.now()}
  const idx = hist.findIndex(x=>x.date===today)
  if(idx>=0) hist[idx]=entry; else hist.push(entry)
  hist.sort((a,b)=>a.date.localeCompare(b.date))
  saveHistory(hist)
  return hist
}
function computeStats(hist){
  if(hist.length<2) return {today: null, yesterday: null, week: null, daily: []}
  const daily=[]
  for(let i=1;i<hist.length;i++){
    const delta = hist[i-1].balance - hist[i].balance
    daily.push({date: hist[i].date, delta})
  }
  const last = daily[daily.length-1]
  const today = last ? last.delta : 0
  const yesterday = daily.length>=2 ? daily[daily.length-2].delta : 0
  const week = daily.slice(-7).reduce((s,x)=>s+Math.max(0,x.delta),0)
  return {today, yesterday, week, daily: daily.slice(-7)}
}

// ========== 请求余额 ==========
async function fetchBalance(key){
  // 1. 直连官方
  try{
    const req = new Request("https://api.deepseek.com/user/balance")
    req.headers = {"Authorization": "Bearer "+key}
    req.method = "GET"
    const j = await req.loadJSON()
    if(j.balance_infos) return j
  }catch(e){ console.log("direct fail",e) }
  // 2. 代理
  try{
    const req2 = new Request(CONFIG.proxyUrl)
    req2.headers = {"Authorization": "Bearer "+key}
    const j2 = await req2.loadJSON()
    if(j2.balance_infos) return j2
    throw new Error(j2.error||JSON.stringify(j2))
  }catch(e){
    throw e
  }
}

// ========== 颜色 ==========
function hex(c){ return new Color(c) }

// ========== 构建小组件 ==========
async function createWidget(){
  let key = CONFIG.apiKey
  // 若无Key，尝试从历史文件旁的key文件读，或弹窗输入
  if(!key){
    try{
      const f = fm()
      const kp = f.joinPath(f.documentsDirectory(), "deepseek_key.txt")
      if(f.fileExists(kp)){
        if(f.isFileStoredIniCloud(kp)) await f.downloadFileFromiCloud(kp)
        key = f.readString(kp).trim()
      }
    }catch{}
  }
  if(!key){
    // 首次运行：弹窗输入
    const a = new Alert()
    a.title = "DeepSeek API Key"
    a.message = "输入 sk- 开头的 Key（仅存本地）"
    a.addTextField("sk-...")
    a.addAction("确定")
    a.addCancelAction("取消")
    const idx = await a.present()
    if(idx===0){
      key = a.textFieldValue(0).trim()
      if(key){
        try{
          const f = fm()
          const kp = f.joinPath(f.documentsDirectory(), "deepseek_key.txt")
          f.writeString(kp, key)
        }catch{}
      }
    }
  }
  if(!key || !key.startsWith("sk-")){
    const w = new ListWidget()
    w.backgroundColor = hex("#1c1c1e")
    const t = w.addText("⚠️ 未配置 Key")
    t.font = Font.boldSystemFont(14); t.textColor = hex("#ff3b30")
    w.addSpacer(4)
    const s = w.addText("长按小组件 → 编辑 → 参数填 sk-xxx\n或在Scriptable内运行输入")
    s.font = Font.systemFont(10); s.textColor = hex("#98989d")
    w.url = CONFIG.pwaUrl
    return w
  }

  let data=null, err=null
  try{
    data = await fetchBalance(key)
  }catch(e){ err = e.message || String(e) }

  const period = getPeriod()
  const w = new ListWidget()
  // 背景按峰谷
  if(period.isPeak){
    w.backgroundGradient = (()=>{ const g=new LinearGradient(); g.colors=[hex("#ff6a00"),hex("#ff3b30")]; g.locations=[0,1]; return g })()
  } else {
    w.backgroundGradient = (()=>{ const g=new LinearGradient(); g.colors=[hex("#0a7a2e"),hex("#30d158")]; g.locations=[0,1]; return g })()
    // 谷值用深绿到紫，保持可读
    if(!period.isPeak){
      w.backgroundGradient = (()=>{ const g=new LinearGradient(); g.colors=[hex("#4f46e5"),hex("#7c3aed")]; g.locations=[0,1]; return g })()
      // 最优惠窗口再加绿
      if(period.isHistOff){
        w.backgroundGradient = (()=>{ const g=new LinearGradient(); g.colors=[hex("#0a7a2e"),hex("#1da54a")]; g.locations=[0,1]; return g })()
      }
    }
  }
  // 峰值时用橙红谷值用紫（与PWA一致）
  if(period.isPeak){
    const g=new LinearGradient(); g.colors=[hex("#ff6a00"),hex("#ff3b30")]; g.locations=[0,1]; w.backgroundGradient=g
  } else {
    const g=new LinearGradient(); g.colors=[hex("#4f46e5"),hex("#7c3aed")]; g.locations=[0,1]; w.backgroundGradient=g
    if(period.isHistOff){ const g2=new LinearGradient(); g2.colors=[hex("#065f2a"),hex("#30d158")]; g2.locations=[0,1]; w.backgroundGradient=g2 }
  }

  w.url = CONFIG.pwaUrl

  if(err || !data){
    const title = w.addText(period.label)
    title.font = Font.boldSystemFont(11); title.textColor = Color.white(); title.shadowColor = new Color("#000000",0.2); title.shadowRadius=1
    w.addSpacer(6)
    const e = w.addText("❌ 查询失败")
    e.font = Font.boldSystemFont(14); e.textColor = Color.white()
    w.addSpacer(2)
    const msg = w.addText(String(err).slice(0,80))
    msg.font = Font.systemFont(9); msg.textColor = new Color("#ffffff",0.85); msg.lineLimit=2
    w.addSpacer(4)
    const foot = w.addText(period.countdown+" · 点此打开网页版")
    foot.font = Font.systemFont(9); foot.textColor = new Color("#ffffff",0.7)
    return w
  }

  const info = (data.balance_infos && data.balance_infos[0]) || {}
  const total = parseFloat(info.total_balance ?? "0")
  const cur = info.currency || "CNY"
  const granted = parseFloat(info.granted_balance ?? "0")
  const topped = parseFloat(info.topped_up_balance ?? "0")
  const avail = data.is_available

  // 更新历史
  try{ upsertHistory(String(total), cur) }catch{}
  const hist = loadHistory()
  const stats = computeStats(hist)

  // ---- 布局 ----
  // 顶部：峰谷 + 时间
  const top = w.addStack()
  top.layoutHorizontally()
  top.centerAlignContent()
  const dot = top.addText(period.isPeak ? "●" : "●")
  dot.font = Font.systemFont(10); dot.textColor = period.isPeak ? hex("#ffd60a") : hex("#a8ffbf")
  top.addSpacer(4)
  const t1 = top.addText(period.label)
  t1.font = Font.boldSystemFont(11); t1.textColor = Color.white()
  top.addSpacer()
  const t2 = top.addText(period.countdown)
  t2.font = Font.systemFont(9); t2.textColor = new Color("#ffffff",0.85)

  w.addSpacer(8)

  // 中部：余额
  const bal = w.addText(`¥${total.toFixed(2)}`)
  bal.font = Font.heavySystemFont(28); bal.textColor = Color.white(); bal.shadowColor=new Color("#000000",0.25); bal.shadowRadius=2
  const sub = w.addText(`${avail===false?"不可用 · ":""}${cur} · 赠送¥${granted.toFixed(1)} 充值¥${topped.toFixed(1)}`)
  sub.font = Font.systemFont(10); sub.textColor = new Color("#ffffff",0.9)
  sub.lineLimit=1

  w.addSpacer(8)

  // 底部：消耗（中/大尺寸才显示全）
  if(config.widgetFamily === "large" || config.widgetFamily === "medium"){
    const row = w.addStack()
    row.layoutHorizontally()
    row.spacing = 6
    function cstat(label, val){
      const col = row.addStack()
      col.layoutVertically()
      col.backgroundColor = new Color("#ffffff",0.15)
      col.cornerRadius = 8
      col.setPadding(6,8,6,8)
      const v = col.addText(val)
      v.font = Font.boldSystemFont(11); v.textColor = Color.white(); v.centerAlignText()
      const l = col.addText(label)
      l.font = Font.systemFont(8); l.textColor = new Color("#ffffff",0.75); l.centerAlignText()
    }
    const todayStr = stats.today==null ? "-" : (stats.today>0?`-${stats.today.toFixed(2)}`: stats.today<0?`+${Math.abs(stats.today).toFixed(2)}`:"0.00")
    const yestStr = stats.yesterday==null ? "-" : (stats.yesterday>0?`-${stats.yesterday.toFixed(2)}`: stats.yesterday<0?`+${Math.abs(stats.yesterday).toFixed(2)}`:"0.00")
    const weekStr = stats.week==null ? "-" : stats.week.toFixed(1)
    cstat("今日消耗", todayStr)
    cstat("昨日消耗", yestStr)
    cstat("近7日", weekStr)
  } else {
    // 小尺寸：只显示今日
    if(stats.today!=null){
      const s = w.addText(`今日消耗 ${stats.today>0?"-":"+"}¥${Math.abs(stats.today).toFixed(2)}  · 近7日 ¥${(stats.week||0).toFixed(1)}`)
      s.font = Font.systemFont(9); s.textColor = new Color("#ffffff",0.85); s.lineLimit=1
    } else {
      const s = w.addText("连续2天后显示消耗")
      s.font = Font.systemFont(9); s.textColor = new Color("#ffffff",0.7)
    }
  }

  w.addSpacer(4)
  const foot = w.addText(`${period.sub} · ${period.bj.getHours().toString().padStart(2,"0")}:${period.bj.getMinutes().toString().padStart(2,"0")} 北京`)
  foot.font = Font.systemFont(8); foot.textColor = new Color("#ffffff",0.65)

  // 刷新时间
  w.refreshAfterDate = new Date(Date.now()+ 15*60*1000) // 15分钟后系统可刷新

  return w
}

// ========== 运行 ==========
const widget = await createWidget()
if(config.runsInWidget){
  Script.setWidget(widget)
  Script.complete()
} else {
  // 在App内预览：按尺寸展示
  if(config.widgetFamily==="small") widget.presentSmall()
  else if(config.widgetFamily==="large") widget.presentLarge()
  else widget.presentMedium()
}
