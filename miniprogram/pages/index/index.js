// pages/index/index.js - FitFlow 单页逻辑（完整还原原版 index.html）
const storage = require('../../utils/storage.js');
const ai = require('../../utils/ai.js');
const { FOOD_DB, FOOD_CN, MET_TABLE } = require('../../utils/food-db.js');

const DEFAULT_GOAL_WEIGHT = 70;
const DEFAULT_WATER_GOAL = 2000;
const CUP_ML = 250;
const WEEK_CN = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
const MONTH_CN = ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月'];
const MEAL_TYPES = ['breakfast', 'lunch', 'dinner', 'snack'];
const MEAL_LABELS = { breakfast: '早餐', lunch: '午餐', dinner: '晚餐', snack: '加餐' };
const CAT_ORDER = ['肉蛋', '水产', '主食', '蔬菜', '豆奶', '水果', '坚果零食', '饮品', '快餐小吃'];

// 默认计划（与原版一致）
const DEFAULT_PLANS = [
  { id: 'ppl', name: '推拉腿训练', desc: '每周 6 天 · 增肌 · 推/拉/腿', tags: ['推日 4动作', '拉日 5动作', '腿日 5动作'],
    days: [
      { name: '推日', exercises: [{ name: '杠铃卧推', meta: '80kg', done: false }, { name: '上斜卧推', meta: '28kg', done: false }, { name: '器械飞鸟', meta: '18kg', done: false }, { name: '臂屈伸', meta: '15kg', done: false }] },
      { name: '拉日', exercises: [{ name: '引体向上', meta: '自重', done: false }, { name: '硬拉', meta: '100kg', done: false }, { name: '划船', meta: '40kg', done: false }, { name: '面拉', meta: '15kg', done: false }, { name: '二头弯举', meta: '12kg', done: false }] },
      { name: '腿日', exercises: [{ name: '深蹲', meta: '80kg', done: false }, { name: '箭步蹲', meta: '20kg', done: false }, { name: '腿举', meta: '120kg', done: false }, { name: '腿屈伸', meta: '30kg', done: false }, { name: '小腿提踵', meta: '40kg', done: false }] }
    ] },
  { id: '5x5', name: '5×5 力量训练', desc: '每周 3 天 · 增力 · 初学者友好', tags: [],
    days: [
      { name: '训练A', exercises: [{ name: '深蹲', meta: '60kg', done: false }, { name: '卧推', meta: '50kg', done: false }, { name: '划船', meta: '40kg', done: false }] },
      { name: '训练B', exercises: [{ name: '深蹲', meta: '60kg', done: false }, { name: '站姿推举', meta: '30kg', done: false }, { name: '硬拉', meta: '80kg', done: false }] }
    ] },
  { id: 'hiit', name: '减脂 HIIT', desc: '每周 4 天 · 每次 30 分钟', tags: [],
    days: [
      { name: 'HIIT Day', exercises: [{ name: '波比跳', meta: '30秒×4', done: false }, { name: '高抬腿', meta: '30秒×4', done: false }, { name: '登山跑', meta: '30秒×4', done: false }, { name: '开合跳', meta: '30秒×4', done: false }] }
    ] },
  { id: 'ul', name: '上下肢分化', desc: '每周 4 天 · 增肌', tags: [],
    days: [
      { name: '上肢日', exercises: [{ name: '卧推', meta: '60kg', done: false }, { name: '划船', meta: '40kg', done: false }, { name: '推举', meta: '30kg', done: false }, { name: '二头弯举', meta: '12kg', done: false }] },
      { name: '下肢日', exercises: [{ name: '深蹲', meta: '80kg', done: false }, { name: '硬拉', meta: '100kg', done: false }, { name: '箭步蹲', meta: '20kg', done: false }] }
    ] }
];

function defaultState() {
  return {
    water: 0,
    waterGoal: DEFAULT_WATER_GOAL,
    goalWeight: DEFAULT_GOAL_WEIGHT,
    currentPlanId: 'ppl',
    currentDayIdx: 0,
    plans: JSON.parse(JSON.stringify(DEFAULT_PLANS)),
    customPlans: [],
    meals: {
      breakfast: { name: '早餐', items: [] },
      lunch: { name: '午餐', items: [] },
      dinner: { name: '晚餐', items: [] },
      snack: { name: '加餐', items: [] }
    },
    metrics: { current: null, previous: null, initial: null, history: [] },
    selectedMealType: 'breakfast',
    cardio: [],
    supps: [],
    history: {},
    lastActiveDate: todayKey(),
    metaClearedV1: true
  };
}

function todayKey(d) {
  d = d || new Date();
  return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2);
}

function loadState() {
  try {
    const s = storage.loadAppState();
    if (s && typeof s === 'object') {
      if (s.goalWeight === undefined) s.goalWeight = DEFAULT_GOAL_WEIGHT;
      if (s.waterGoal === undefined) s.waterGoal = DEFAULT_WATER_GOAL;
      if (!s.history) s.history = {};
      if (!s.lastActiveDate) s.lastActiveDate = todayKey();
      if (!s.metrics || !s.metrics.current) s.metrics = JSON.parse(JSON.stringify({ current: null, previous: null, initial: null, history: [] }));
      if (s.metrics && !Array.isArray(s.metrics.history)) s.metrics.history = [];
      if (!Array.isArray(s.plans) || s.plans.length === 0) s.plans = JSON.parse(JSON.stringify(DEFAULT_PLANS));
      if (!Array.isArray(s.customPlans)) s.customPlans = [];
      if (!s.meals || !s.meals.breakfast || !s.meals.breakfast.items) {
        s.meals = { breakfast: { name: '早餐', items: [] }, lunch: { name: '午餐', items: [] }, dinner: { name: '晚餐', items: [] }, snack: { name: '加餐', items: [] } };
      }
      if (!s.currentPlanId) s.currentPlanId = 'ppl';
      if (typeof s.currentDayIdx !== 'number' || s.currentDayIdx < 0) s.currentDayIdx = 0;
      if (!s.selectedMealType) s.selectedMealType = 'breakfast';
      if (!Array.isArray(s.cardio)) s.cardio = [];
      if (!Array.isArray(s.supps)) s.supps = [];
      if (typeof s.water !== 'number' || !isFinite(s.water)) s.water = 0;
      if (!s.metaClearedV1) {
        (s.plans || []).concat(s.customPlans || []).forEach(p => {
          if (p.days) p.days.forEach(d => (d.exercises || []).forEach(e => { e.meta = ''; e.metaDate = ''; }));
        });
        s.metaClearedV1 = true;
      }
      return s;
    }
  } catch (e) {}
  return defaultState();
}

Page({
  data: {
    safeTop: 20, keyboardH: 0, sheetMaxH: '',
    dateNum: '', weekday: '',
    intake: 0, intakeGoal: DEFAULT_GOAL_WEIGHT * 28, intakePct: 0, burn: 0,
    waterMl: 0, waterGoal: DEFAULT_WATER_GOAL, waterPct: 0,
    planTitle: '训练', planLabel: '', dayLocked: false,
    exList: [], cardioList: [],
    exDragIdx: -1, exDragY: 0,
    mealList: [],
    suppList: [], suppName: '', suppUnit: 'ml', suppDose: '',
    pageOverlay: '', modalOverlay: '', ovClosing: false,
    pageLeaving: '', pageUnder: '', pgClosing: false, pgAnim: 'push',
    exName: '', exSaving: false, exWt: '', exSets: '', exReps: '',
    exLoadMode: 'fixed', exProgSets: '3', exProgRows: [{ wt: '', reps: '' }, { wt: '', reps: '' }, { wt: '', reps: '' }],
    exPaneH: 0,
    coName: '', coDur: '30', coBurn: '', coCalHint: '',
    confirmDelText: '',
    exDetailTitle: '', exDetailBurn: '',
    exDetailRO: false, exRORows: [], exROText: '',
    coDetailTitle: '', coDetailDur: '', coDetailBurn: '', coDetailCalHint: '',
    heatDetailTitle: '', heatDetailBody: '',
    mealTypeSel: [], manualFoodName: '', manualFoodMatch: '系统自动计算', manualFoodMatchCls: 'muted', manualFoodCalWrap: false, manualFoodCal: '',
    foodPickList: [], foodPickSummary: '',
    goalWeightInput: '70', goalWeightHint: '', waterGoalInput: '2000',
    weightVal: '--', bodyFatVal: '--', weightDiff: '', bodyFatDiff: '',
    mWeight: '', mBodyFat: '',
    metricChartType: 'weight', metricChartInfo: '', metricChartPoints: [],
    mealDetailTitle: '', mealDetailItems: [], mealDetailTotal: 0,
    planList: [], planDetailName: '', planDetailDesc: '', planDetailDays: [], planDetailIsCustom: false, planDetailDeleteShow: false,
    planDetailApplyText: '使用此计划', planDetailApplyDisabled: false,
    planEditorTitle: '新建计划', planName: '', newDayName: '', planDaysView: [],
    dayEditorTitle: '', dayExName: '', dayExList: [],
    heatYear: 0, heatMonth: 0, heatmapMonthLabel: '', heatmapDaysLabel: '', heatmap: [],
    growthText: '', growthBars: [], growthHasRefresh: false, growthLoading: false,
    weekTrain: '0/7', monthTrain: '0 天', streakDays: '0 天', totalTrain: '0 天',
    aiStatus: 'AI 查询',
    toast: '', toastShow: false
  },

  onLoad() {
    const sys = wx.getSystemInfoSync();
    this.setData({ safeTop: (sys.statusBarHeight || 20) + 12 });
    this.state = loadState();
    this.checkDailyReset();
    this.initDate();
    this.renderAll();
    // 键盘高度监听：iOS 键盘悬浮遮挡页面（需上移弹窗）；Android 键盘会压缩页面（fixed bottom 已自动贴键盘上方，再上移会「双重偏移」飞到顶部）
    this._winH = sys.windowHeight || 700;
    this._kbOverlay = sys.platform === 'ios';
    try {
      wx.onKeyboardHeightChange(res => {
        const h = res.height || 0;
        // iOS 按键盘高度上移并封顶 60% 屏高；Android 不上移（页面已压缩）
        const lift = (this._kbOverlay && h) ? Math.min(h, Math.floor(this._winH * 0.6)) : 0;
        // 限制 sheet 最大高度，确保在键盘上方完整可见（不超屏顶）
        let curH = this._winH;
        try { curH = (wx.getWindowInfo ? wx.getWindowInfo() : wx.getSystemInfoSync()).windowHeight || this._winH; } catch (e2) {}
        const availH = curH - lift - 24;
        this.setData({
          keyboardH: lift,
          sheetMaxH: (h && availH > 80) ? Math.floor(availH) + 'px' : ''
        });
      });
    } catch (e) {}
    // 首次使用：记录身体数据
    if (!this.state.metrics || !this.state.metrics.current) {
      setTimeout(() => {
        this.openModal('metric');
        this.toast('请先记录你的身体数据');
      }, 400);
    }
  },

  // 后台切回/跨天：若日期已变化，执行每日重置并刷新界面。
  // 小程序切后台过夜再切回时 onLoad 不会再触发，必须在 onShow 里补做；
  // 首次启动 onShow 紧跟 onLoad，此时 lastActiveDate 已是今天，幂等跳过。
  onShow() {
    if (this.state && this.state.lastActiveDate !== todayKey()) {
      this.checkDailyReset();
      this.initDate();
      this.renderAll();
    }
  },

  // ==================== TOAST ====================
  toast(msg) {
    this.setData({ toast: msg, toastShow: true });
    clearTimeout(this._toastT);
    this._toastT = setTimeout(() => this.setData({ toastShow: false }), 1500);
  },

  // ==================== DAILY RESET & HISTORY ====================
  checkDailyReset() {
    const today = todayKey();
    if (this.state.lastActiveDate !== today) {
      this.archiveDay(this.state.lastActiveDate);
      // 必须在清零 done 之前记录「最后实际练过的训练日」：
      // 先清零再遍历判断，所有 done 都是 false，lastTrainedIdx 恒为 -1，
      // 跨天就会错误地从「当前停留日+1」顺延（中途切走只看不练时会跳过未练的训练日）
      const plan = this.getAllPlans().find(p => p.id === this.state.currentPlanId);
      let lastTrainedIdx = -1;
      if (plan && plan.days) {
        plan.days.forEach((d, i) => { if ((d.exercises || []).some(e => e.done)) lastTrainedIdx = i; });
      }
      this.state.water = 0;
      this.state.meals = { breakfast: { name: '早餐', items: [] }, lunch: { name: '午餐', items: [] }, dinner: { name: '晚餐', items: [] }, snack: { name: '加餐', items: [] } };
      this.getAllPlans().forEach(p => {
        if (p.days) p.days.forEach(d => (d.exercises || []).forEach(e => { e.done = false; e.meta = ''; e.metaDate = ''; }));
      });
      this.state.cardio = [];
      // 补剂：清单保留，勾选状态每天重置
      (this.state.supps || []).forEach(s => { s.done = false; });
      if (plan && plan.days && plan.days.length > 0) {
        // 从最后一个实际练过的训练日顺延（当天中途切走只看不练时，不跳过未练的训练日）
        const base = lastTrainedIdx >= 0 ? lastTrainedIdx : this.state.currentDayIdx;
        this.state.currentDayIdx = (base + 1) % plan.days.length;
      }
      this.state.lastActiveDate = today;
      this.saveState();
    }
    this.recordTodayToHistory();
  },
  archiveDay(dateStr) {
    if (!this.state.history[dateStr]) {
      this.state.history[dateStr] = { trained: 0, burn: 0, intake: 0, water: 0, planId: '', dayName: '', exNames: [], exMeta: [] };
    }
    const h = this.state.history[dateStr];
    if (!h.intake) h.intake = this.getTotalIntake();
    if (!h.water) h.water = this.state.water * CUP_ML;
    const plan = this.getAllPlans().find(p => p.id === this.state.currentPlanId);
    if (plan && plan.days) {
      // 只在缺省时补记 planId/dayName：当天记录已由 recordTodayToHistory 写入
      // 「实际练过的训练日」，跨天归档时若直接覆盖会把历史训练日改成当前停留日
      if (!h.dayName) {
        const day = plan.days[this.state.currentDayIdx % plan.days.length];
        h.planId = this.state.currentPlanId;
        h.dayName = day ? day.name : '';
      }
    }
  },
  recordTodayToHistory() {
    const today = todayKey();
    if (!this.state.history[today]) {
      this.state.history[today] = { trained: 0, burn: 0, intake: 0, water: 0, planId: '', dayName: '', exNames: [], exMeta: [] };
    }
    const h = this.state.history[today];
    const completedExs = this.getCompletedExercises();
    const doneCardio = (this.state.cardio || []).filter(c => c.done);
    // 只做有氧（未做力量）也必须记为训练日：trained 只看力量动作会导致
    // 有氧日的热力图/周月统计/连续天数/成长分析全部漏记
    h.trained = (completedExs.length > 0 || doneCardio.length > 0) ? 1 : 0;
    h.burn = this.estimateBurn(completedExs) + this.getCardioBurn();
    h.exNames = completedExs.map(e => e.name).concat(doneCardio.map(c => c.name));
    h.exMeta = completedExs.map(e => e.meta || '').concat(doneCardio.map(c => c.meta || ''));
    h.intake = this.getTotalIntake();
    h.water = this.state.water * CUP_ML;
    const plan = this.getAllPlans().find(p => p.id === this.state.currentPlanId);
    if (plan && plan.days) {
      // 记录实际练过的训练日名（跨日切换后不丢）；没练则记当前查看的训练日
      let trainedDayName = '';
      plan.days.forEach(d => {
        if (!trainedDayName && (d.exercises || []).some(e => e.done)) trainedDayName = d.name;
      });
      const day = plan.days[this.state.currentDayIdx % plan.days.length];
      h.planId = this.state.currentPlanId;
      h.dayName = trainedDayName || (day ? day.name : '');
    }
  },
  saveState() {
    // 先刷新当天 history 再落盘：多处调用点是「saveState → updateIntake → recordTodayToHistory」，
    // 若不在写盘前刷 history，storage 里当天的 intake/water/burn 永远是上一次操作的旧值，
    // 用户最后一次操作后直接退出会丢失最终记录（热力图/跨天归档数据偏小）。
    // recordTodayToHistory 内部不调 saveState，无递归。
    this.recordTodayToHistory();
    storage.saveAppState(this.state);
  },

  // ==================== BURN (力量估算 + 缓存) ====================
  // 本地兜底强度系数（AI 校准前/失败时使用）：大肌群复合动作消耗更高
  strengthFactor(name) {
    const n = String(name || '').toLowerCase();
    const heavy = ['硬拉', '深蹲', '卧推', '推举', '肩推', '划船', '引体', '高翻', '挺举', '蹲', '拉', '推'];
    for (let i = 0; i < heavy.length; i++) {
      if (n.indexOf(heavy[i]) >= 0) return 1.4;
    }
    return 1.0;
  },
  estimateBurn(exercises) {
    if (!exercises || exercises.length === 0) return 0;
    let total = 0;
    const cache = storage.getBurnCache(); // 只读一次 storage，避免每个动作重复同步 IO
    exercises.forEach(ex => {
      const ck = this.burnCacheKey(ex);
      const c = cache[ck];
      if (c != null && isFinite(c)) { total += c; return; }
      const kg = this.parseKg(ex.meta); // 只认 "Nkg"，"4组*12" 的 4 不会误当重量
      total += (30 + Math.min(kg, 100) * 0.6) * this.strengthFactor(ex.name) * this.volumeFactor(ex.meta);
    });
    return Math.round(total);
  },
  // 递增方案解析：识别形如 "60kg*12→70kg*10→80kg*8" 的逐组串（段数≥2 才算递增）。
  // 返回 [{kg,reps},...]；固定格式/自重/无 kg 的串返回 []。
  parseProgSets(meta) {
    const out = [];
    const re = /(\d+(?:\.\d+)?)\s*kg\s*(?:×|\*)\s*(\d+)/gi;
    let m;
    while ((m = re.exec(meta || ''))) out.push({ kg: parseFloat(m[1]), reps: parseInt(m[2], 10) });
    return out.length >= 2 ? out : [];
  },
  // 由递增表单行生成逐组 meta："60kg*12→70kg*10→80kg*8"
  // 校验规则：整行(重量+次数)为空→跳过；只填一半/非法数字→报错返回；有效行<2→报错
  buildProgMetaFromRows(rows) {
    if (!Array.isArray(rows)) return { ok: false, err: '没有可保存的递增组' };
    const parts = [];
    for (let k = 0; k < rows.length; k++) {
      const r = rows[k] || {};
      const w = String(r.wt == null ? '' : r.wt).trim();
      const rp = String(r.reps == null ? '' : r.reps).trim();
      if (!w && !rp) continue; // 空行跳过
      const wn = Number(w), rn = Number(rp);
      if (!isFinite(wn) || wn <= 0 || !isFinite(rn) || rn <= 0) {
        return { ok: false, err: '第' + (k + 1) + '组需填写正确的重量和次数' };
      }
      parts.push(wn + 'kg*' + rn);
    }
    if (parts.length === 0) return { ok: false, err: '请填写递增组（每组：重量 + 次数）' };
    if (parts.length === 1) return { ok: false, err: '递增模式请至少填写 2 组，单组请用「固定」' };
    return { ok: true, meta: parts.join('→') };
  },
  parseKg(meta) {
    // 只认带 kg 单位的数字（历史数据重量均带 kg 后缀）；无 kg 时回退默认值，
    // 避免 "4组*12" 的 4 被误当重量
    const km = /(\d+(?:\.\d+)?)\s*kg/i.exec(meta || '');
    return km ? parseFloat(km[1]) : 20;
  },
  // 组数：meta 形如 "80kg×4组×12"，旧格式 "80kg×12" 无组数则默认 4；
  // 递增方案 "60kg*12→70kg*10→80kg*8" 无 "N组" 字样，按逐组段数计（3 组）
  parseSets(meta) {
    const s = (meta || '').match(/(\d+)\s*组/);
    if (s) return parseInt(s[1], 10);
    const p = this.parseProgSets(meta);
    if (p.length) return p.length;
    return 4;
  },
  // 次数：取最后一个 ×N 或 *N（新格式为组数后的次数；旧格式 "80kg×12" 的 12 即次数）
  parseReps(meta) {
    const xs = (meta || '').match(/(?:×|\*)\s*(\d+)/g);
    const r = (xs && xs.length) ? /(\d+)/.exec(xs[xs.length - 1]) : null;
    if (r) return parseInt(r[1], 10);
    return 10;
  },
  // 由重量/组数/次数拼出 meta："10kg 4组*12"（兼容旧格式 "80kg×4组×12"）
  buildExMeta(wt, sets, reps) {
    const w = String(wt || '').trim();
    const s = String(sets || '').trim();
    const r = String(reps || '').trim();
    const parts = [];
    if (w) parts.push(w + 'kg');
    if (s && r) parts.push(s + '组*' + r);
    else if (s) parts.push(s + '组');
    else if (r) parts.push('*' + r);
    return parts.join(' ');
  },
  // 本地估算的容量系数：4组×10次为基准 1.0，随总容量缩放（0.6~2.5 封顶）；
  // 递增方案按 Σ各组次数 计等效容量（"12+10+8" 与 3组×10 相当），避免只用末组次数低估
  volumeFactor(meta) {
    const prog = this.parseProgSets(meta);
    const eff = prog.length ? prog.reduce((s, g) => s + g.reps, 0) : this.parseSets(meta) * this.parseReps(meta);
    return Math.max(0.6, Math.min(2.5, eff / 40));
  },
  burnCacheKey(ex) {
    return (ex.name || '').trim() + '|' + this.parseKg(ex.meta) + '|' + this.parseSets(ex.meta) + '|' + this.parseReps(ex.meta);
  },
  getBodyWeight() {
    const w = this.state.metrics && this.state.metrics.current && this.state.metrics.current.weight;
    return (w && isFinite(w)) ? w : (this.state.goalWeight || 70);
  },
  // 有氧 MET 匹配
  matchMet(name) {
    const n = String(name || '').trim().toLowerCase();
    if (!n) return null;
    let best = null, bestLen = 0;
    const keys = Object.keys(MET_TABLE);
    for (let i = 0; i < keys.length; i++) {
      const k = keys[i];
      if (n.indexOf(k) >= 0 || k.indexOf(n) >= 0) {
        if (k.length > bestLen) { best = MET_TABLE[k]; bestLen = k.length; }
      }
    }
    return best;
  },
  getCardioBurn() {
    return (this.state.cardio || []).filter(c => c.done).reduce((s, c) => s + (isFinite(c.burn) ? c.burn : 0), 0);
  },
  updateBurn() {
    const burn = this.estimateBurn(this.getCompletedExercises()) + this.getCardioBurn();
    this.setData({ burn: burn });
  },
  getCompletedExercises() {
    // done 每天清零，因此「今天完成的动作」= 当前计划所有训练日中 done 的动作
    // （当天中途切换训练日后，已勾选的其他训练日仍计入今日消耗与记录）
    const plan = this.getAllPlans().find(p => p.id === this.state.currentPlanId);
    if (!plan || !plan.days) return [];
    const out = [];
    plan.days.forEach(d => (d.exercises || []).forEach(e => { if (e.done) out.push(e); }));
    return out;
  },
  // 勾选完成后防抖触发 AI 校准
  scheduleBurnCalib() {
    if (this._burnCalibT) clearTimeout(this._burnCalibT);
    this._burnCalibT = setTimeout(() => this.aiCalibrateBurn(), 600);
  },
  aiCalibrateBurn() {
    const exs = this.getCompletedExercises();
    if (!exs.length) return;
    const cache = storage.getBurnCache();
    const need = [];
    exs.forEach(ex => {
      const ck = this.burnCacheKey(ex);
      if (cache[ck] == null) need.push(ex);
    });
    if (!need.length) return;
    const weight = this.getBodyWeight();
    const items = need.map(ex => ({ name: ex.name, weight: this.parseKg(ex.meta), sets: this.parseSets(ex.meta), reps: this.parseReps(ex.meta) }));
    const self = this;
    let done = false;
    const finish = (fn) => { if (done) return; done = true; fn(); };
    // 超时保护：8 秒内无结果即本地兜底，避免弹窗一直卡"估算中"
    const timer = setTimeout(() => finish(() => self.fallbackBurnCalib(need, 'AI 请求超时')), 8000);
    ai.calibrateBurn(items, weight).then(r => {
      clearTimeout(timer);
      finish(() => {
        if (!r || !r.ok || !r.list || !r.list.length) {
          self.fallbackBurnCalib(need, (r && r.msg) || 'AI 暂不可用');
          return;
        }
        const cache2 = storage.getBurnCache();
        let changed = false;
        r.list.forEach((item, i) => {
          // 优先按「同序同名」匹配（AI 按请求顺序逐项返回）；乱序则退而按名字匹配，
          // 找不到（多余项/改名）直接跳过——绝不回退 need[0]，否则同名不同组动作
          // 的消耗会错写到第一项缓存 key，第二项永远等不到 AI 校准值
          if (!item || !(item.kcal > 0)) return;
          const ex = (need[i] && need[i].name === item.name) ? need[i] : need.find(e => e.name === item.name);
          if (!ex) return;
          const ck = this.burnCacheKey(ex);
          if (cache2[ck] == null) { cache2[ck] = item.kcal; changed = true; }
        });
        // AI 未覆盖到的动作也本地兜底
        const missing = need.filter(ex => cache2[this.burnCacheKey(ex)] == null);
        if (missing.length) self.fallbackBurnCalib(missing, '');
        if (changed) {
          storage.setBurnCache(cache2);
          this.recordTodayToHistory();
          this.updateBurn();
          this.renderExList();
          // 若详情弹窗正开着，实时刷新消耗文本
          if (this.data.modalOverlay === 'exDetail') {
            const cur = this.getCurrentExercises();
            const ex = cur[self._exDetailIdx];
            if (ex) {
              const c2 = storage.getBurnCache()[this.burnCacheKey(ex)];
              if (c2 != null && isFinite(c2)) this.setData({ exDetailBurn: '消耗 ~' + c2 + ' kcal' });
            }
          }
          this.toast('AI 已校准消耗');
        }
      });
    }).catch(err => {
      clearTimeout(timer);
      // 把底层错误码带出来，方便定位（如 env 未配置 / 云函数未部署 / 网络问题）
      const rawMsg = (err && (err.errMsg || err.message)) ? String(err.errMsg || err.message) : 'AI 调用失败';
      const msg = rawMsg.slice(0, 40);
      finish(() => self.fallbackBurnCalib(need, msg));
    });
  },
  // 单动作本地估算（与 estimateBurn 兜底公式一致，含组数×次数容量系数）
  estimateSingleBurn(ex) {
    const kg = this.parseKg(ex.meta);
    return Math.round((30 + Math.min(kg, 100) * 0.6) * this.strengthFactor(ex.name) * this.volumeFactor(ex.meta));
  },
  // AI 不可用/超时/漏项时的本地兜底：估算值写入缓存，保证 UI 不再卡"估算中"
  fallbackBurnCalib(need, reason) {
    if (!need || !need.length) return;
    const cache = storage.getBurnCache();
    let changed = false;
    need.forEach(ex => {
      const ck = this.burnCacheKey(ex);
      if (cache[ck] == null) { cache[ck] = this.estimateSingleBurn(ex); changed = true; }
    });
    if (changed) {
      storage.setBurnCache(cache);
      this.recordTodayToHistory();
      this.updateBurn();
      this.renderExList();
      if (this.data.modalOverlay === 'exDetail') {
        const cur = this.getCurrentExercises();
        const ex = cur[this._exDetailIdx];
        if (ex) {
          const c2 = storage.getBurnCache()[this.burnCacheKey(ex)];
          if (c2 != null && isFinite(c2)) this.setData({ exDetailBurn: '消耗 ~' + c2 + ' kcal（本地估算）' });
        }
      }
    }
    if (reason) this.toast(reason + '，已用本地估算');
  },

  // ==================== PLAN HELPERS ====================
  getAllPlans() {
    return [].concat(this.state.plans || []).concat(this.state.customPlans || []);
  },
  getCurrentExercises() {
    const plan = this.getAllPlans().find(p => p.id === this.state.currentPlanId);
    if (!plan || !plan.days || plan.days.length === 0) return [];
    const day = plan.days[this.state.currentDayIdx % plan.days.length];
    return day ? day.exercises : [];
  },
  todayMeta(ex) { return (ex && ex.metaDate === todayKey()) ? (ex.meta || '') : ''; },

  // ==================== RENDER ====================
  renderAll() {
    this.renderExList();
    this.renderCardioList();
    this.renderMealList();
    this.renderSuppList();
    this.renderPlanList();
    this.renderMetrics();
    this.updateWater(false);
    this.updateIntake();
    this.updateBurn();
    this.updateGoalWeightHint();
    this.updateWaterGoalDisplay();
  },

  initDate() {
    const now = new Date();
    this.setData({ dateNum: now.getDate(), weekday: WEEK_CN[now.getDay()] });
  },

  // ---- 训练列表 ----
  renderExList() {
    const exs = this.getCurrentExercises();
    const plan = this.getAllPlans().find(p => p.id === this.state.currentPlanId);
    const planTitle = plan ? plan.name : '训练';
    const planLabel = (plan && plan.days && plan.days.length > 0) ? plan.days[this.state.currentDayIdx % plan.days.length].name : '';
    const dayLocked = exs.some(e => e.done);
    // 拖动态复位与列表刷新同帧提交：避免「先复位再重排」中间出现被拖项跳回原位的闪烁帧
    this.setData({ planTitle, planLabel, dayLocked, exList: this.buildExView(), exDragIdx: -1, exDragY: 0 });
  },
  // 动作稳定 key：跨排序不变。否则提交排序后节点原地换内容，done(对勾)状态在
  // 错误位置翻转，.item__check 的 0.12s 过渡会闪现（打勾项与未打勾项互换位置时尤其明显）
  exKey(ex) {
    if (!this._exKeySeq) this._exKeySeq = Math.floor(Math.random() * 1e6) + 1;
    if (!ex.__k) ex.__k = 'e' + (++this._exKeySeq);
    return ex.__k;
  },
  // 由模型生成训练列表视图（带稳定 key；极端情况下同对象被克隆两份时加后缀防重复 key）
  buildExView() {
    const exs = this.getCurrentExercises();
    const used = {};
    return exs.map((ex, i) => {
      let k = this.exKey(ex);
      if (used[k]) k = k + '_' + i;
      used[k] = 1;
      return { name: ex.name, meta: this.todayMeta(ex), done: !!ex.done, i: i, k: k, tf: '', hold: '' };
    });
  },

  // ---- 长按拖动排序（力量训练）：被拖项跟手 + 被越过的行平滑让位 ----
  onExDragStart(e) {
    if (this.data.exList.length < 2) return;
    // dataset 恒为字符串，必须转数字：findIndex(v => v.i === i) 与 wxml 的
    // exDragIdx===item.i 都是严格相等，字符串 "0" 匹配不到数字 0 → 拖动完全失效
    const i = parseInt(e.currentTarget.dataset.i, 10);
    if (!isFinite(i) || i < 0) return;
    const t = e.touches && e.touches[0];
    this._dragHeights = null;
    this._dragPos = this.data.exList.findIndex(v => v.i === i);
    this._dragSlot = this._dragPos;
    this._grabY = t ? t.clientY : 0;
    this._dragScroll0 = t ? (t.pageY - t.clientY) : 0;
    this._lastDy = 0;
    this._settleToken = (this._settleToken || 0) + 1; // 使上一轮松手归位动画的定时器失效
    this.setData({
      exDragIdx: i, exDragY: 0,
      exList: this.data.exList.map(v => ({ name: v.name, meta: v.meta, done: v.done, i: v.i, k: v.k, tf: '', hold: '' }))
    });
    wx.vibrateShort && wx.vibrateShort({ type: 'light' });
    // 异步测量各行高度（viewport 坐标），手指移动后按行高换算落点
    this.createSelectorQuery().selectAll('.ex-item').boundingClientRect(rects => {
      if (this.data.exDragIdx !== i) return;
      this._dragHeights = (rects || []).map(r => r.height);
      this._dragTop = rects && rects.length ? rects[0].top : 0;
    }).exec();
  },
  onExDragMove(e) {
    if (this.data.exDragIdx < 0 || !this._dragHeights || !this._dragHeights.length) return;
    const t = e.touches && e.touches[0];
    if (!t || this._dragPos < 0) return;
    // 补偿拖动期间的页面滚动；dy 即被拖项相对原位的位移，跟手渲染
    const scroll = t.pageY - t.clientY;
    const dy = t.clientY - this._grabY + (scroll - this._dragScroll0);
    if (Math.abs(dy - this._lastDy) >= 1) { this._lastDy = dy; this.setData({ exDragY: dy }); }
    // 落点槽位 = 被拖项「视觉中心」已越过的其他行数
    const hs = this._dragHeights, p = this._dragPos, n = hs.length;
    let topP = this._dragTop;
    for (let k = 0; k < p; k++) topP += hs[k];
    const c = topP + dy + hs[p] / 2;
    let slot = 0, cum = this._dragTop;
    for (let k = 0; k < n; k++) {
      if (k !== p && cum + hs[k] / 2 < c) slot++;
      cum += hs[k];
    }
    if (slot === this._dragSlot) return;
    this._dragSlot = slot;
    // 只有被越过的行需要让位（带 CSS 过渡平滑滑开），其余行不动
    const hp = hs[p];
    const list = this.data.exList.map(v => ({ name: v.name, meta: v.meta, done: v.done, i: v.i, k: v.k, tf: '', hold: '' }));
    if (slot > p) for (let k = p + 1; k <= slot; k++) list[k].tf = 'transform:translateY(' + (-hp) + 'px)';
    else if (slot < p) for (let k = slot; k < p; k++) list[k].tf = 'transform:translateY(' + hp + 'px)';
    this.setData({ exList: list });
  },
  onExDragEnd() {
    if (this.data.exDragIdx < 0) return;
    const p = this._dragPos;
    // 异常防御：拖动中列表被刷新导致找不到原始槽位时，直接复位拖动态，
    // 避免 splice(-1, 1) 误删列表最后一项
    if (p == null || p < 0) {
      this._dragHeights = null;
      this.setData({ exDragIdx: -1, exDragY: 0 });
      return;
    }
    const slot = (this._dragSlot == null || this._dragSlot < 0) ? p : this._dragSlot;
    const dy = this.data.exDragY || 0;
    const hs = (this._dragHeights || []).slice();
    // 提交排序：按拖动结果重排模型并持久化
    const list = this.data.exList.slice();
    const moved = list.splice(p, 1)[0];
    list.splice(slot, 0, moved);
    const exs = this.getCurrentExercises();
    const reordered = list.map(v => exs[v.i]).filter(Boolean);
    const valid = !!(exs && exs.length && reordered.length === exs.length);
    if (valid && slot !== p) { exs.splice(0, exs.length, ...reordered); this.saveState(); }
    // land = 落点自然位置相对原位的偏移；off = 松手位置与落点的差值（用于平滑归位）
    let land = 0;
    if (hs.length && slot !== p) {
      let topP = this._dragTop;
      for (let k = 0; k < p; k++) topP += hs[k];
      const hp = hs.splice(p, 1)[0];
      hs.splice(slot, 0, hp);
      let topT = this._dragTop;
      for (let k = 0; k < slot; k++) topT += hs[k];
      land = topT - topP;
    }
    const off = dy - land;
    // 单次 setData 原子提交：重排 + 复位拖动态 + 被拖项先无过渡地停在松手位置（hold）。
    // 稳定 key(k) 让节点随内容移动而非原地换内容，done(对勾)状态不翻转 → 不再闪烁；
    // 让位行的位移 == 重排后的自然位，因此清位移也不跳变
    const view = this.buildExView();
    if (Math.abs(off) > 0.5 && view[slot]) view[slot].hold = 'transform:translateY(' + off + 'px)';
    this.setData({ exList: view, exDragIdx: -1, exDragY: 0 });
    this._dragHeights = null;
    // 下一拍：清 hold 并挂上过渡类 → 被拖项平滑滑入落点（而非瞬间砸下）
    if (Math.abs(off) > 0.5) {
      const token = this._settleToken = (this._settleToken || 0) + 1;
      const mk = view[slot] && view[slot].k;
      setTimeout(() => {
        if (this.data.exDragIdx >= 0 || this._settleToken !== token) return;
        const idx = this.data.exList.findIndex(v => v.k === mk && v.hold);
        if (idx < 0) return;
        const v2 = this.data.exList.map((v, i) => (i === idx
          ? { name: v.name, meta: v.meta, done: v.done, i: v.i, k: v.k, tf: '', hold: '', s: 1 }
          : v));
        this.setData({ exList: v2 });
      }, 32);
    }
    if (valid && slot !== p) this.toast('排序已保存');
  },
  // ---- 有氧列表 ----
  renderCardioList() {
    const exs = this.state.cardio || [];
    const view = exs.map((ex, i) => ({ name: ex.name, meta: ex.meta || '', done: !!ex.done, i: i }));
    this.setData({ cardioList: view });
  },
  // ---- 饮食列表（4 餐次）----
  renderMealList() {
    const list = MEAL_TYPES.map(t => {
      const m = this.state.meals[t];
      const total = (m.items || []).reduce((s, i) => s + (isFinite(i.cal) ? i.cal : 0), 0);
      const empty = total === 0 && (!m.items || m.items.length === 0);
      return { type: t, name: m.name || MEAL_LABELS[t], total: total, empty: empty };
    });
    this.setData({ mealList: list });
  },
  // ---- 补剂列表（不计热量，勾选每天重置）----
  renderSuppList() {
    const list = this.state.supps || [];
    const view = list.map((s, i) => ({
      k: s.id || ('i' + i),
      name: s.name,
      dose: (isFinite(s.dose) ? s.dose : '') + ' ' + (s.unit === 'pill' ? '颗' : (s.unit === 'g' ? 'g' : 'ml')),
      done: !!s.done,
      i: i
    }));
    this.setData({ suppList: view });
  },
  getTotalMealCals(items) {
    return (items || []).reduce((s, i) => s + (isFinite(i.cal) ? i.cal : 0), 0);
  },
  getTotalIntake() {
    return Object.keys(this.state.meals).reduce((s, t) => s + this.getTotalMealCals(this.state.meals[t].items), 0);
  },
  updateIntake() {
    const total = this.getTotalIntake();
    const goal = this.getRecommendedCals();
    const pct = Math.min(100, total / goal * 100);
    this.setData({ intake: total, intakeGoal: goal, intakePct: Math.round(pct * 10) / 10 });
    this.recordTodayToHistory();
  },
  // ---- 饮水 ----
  updateWater() {
    const ml = this.state.water * CUP_ML;
    const maxCups = Math.ceil(this.state.waterGoal / CUP_ML);
    const pct = Math.min(100, this.state.water / maxCups * 100);
    this.setData({ waterMl: ml.toLocaleString(), waterPct: Math.round(pct * 10) / 10 });
  },
  changeWater(e) {
    const delta = Number(e.currentTarget.dataset.d) || 0;
    const maxCups = Math.ceil(this.state.waterGoal / CUP_ML);
    this.state.water = Math.max(0, Math.min(maxCups, this.state.water + delta));
    this.saveState();
    this.recordTodayToHistory();
    this.updateWater();
    this.updateIntake();
  },

  // ==================== GOAL ====================
  getRecommendedCals() {
    const cur = (this.state.metrics.current && this.state.metrics.current.weight)
      ? this.state.metrics.current.weight : this.state.goalWeight;
    const target = this.state.goalWeight;
    const diff = target - cur;
    let base = Math.round(cur * 28);
    if (diff < -1) base -= 400;
    else if (diff > 1) base += 400;
    return Math.max(1200, base);
  },
  updateGoalWeightHint() {
    const cur = this.state.metrics.current ? this.state.metrics.current.weight : null;
    const target = this.state.goalWeight;
    // storage 旧数据可能存字符串，.toFixed 会抛错；统一 Number 保护
    const curN = Number(cur);
    const targetN = Number(target);
    let hint;
    if (cur == null || !isFinite(curN) || !isFinite(targetN)) {
      hint = '请先记录当前体重，获取个性化减脂建议';
    } else {
      const diff = targetN - curN;
      const recCals = this.getRecommendedCals();
      const diffStr = diff > 0 ? '+' + diff.toFixed(1) : diff.toFixed(1);
      hint = '当前 ' + curN.toFixed(1) + ' kg → 目标 ' + targetN.toFixed(1) + ' kg (' + diffStr + ' kg) · 建议 ' + recCals.toLocaleString() + ' kcal/天';
    }
    this.setData({ goalWeightInput: String(target), goalWeightHint: hint });
  },
  onGoalWeightInput(e) { this.setData({ goalWeightInput: e.detail.value }); },
  saveGoalWeight() {
    const val = parseFloat(this.data.goalWeightInput);
    if (isNaN(val) || val < 30 || val > 200) { this.toast('请输入有效体重 (30-200kg)'); return; }
    this.state.goalWeight = val;
    this.saveState();
    this.updateGoalWeightHint();
    this.updateIntake();
    this.toast('目标体重已设置为 ' + val + ' kg');
  },
  updateWaterGoalDisplay() {
    this.setData({ waterGoal: this.state.waterGoal, waterGoalInput: String(this.state.waterGoal) });
  },
  onWaterGoalInput(e) { this.setData({ waterGoalInput: e.detail.value }); },
  saveWaterGoal() {
    const val = parseInt(this.data.waterGoalInput, 10);
    if (isNaN(val) || val < 500 || val > 5000) { this.toast('请输入有效饮水目标 (500-5000ml)'); return; }
    this.state.waterGoal = val;
    // 目标调小后，把已喝杯数收敛到新上限，避免出现 "2500ml / 1000ml"
    const maxCups = Math.ceil(val / CUP_ML);
    if (this.state.water > maxCups) this.state.water = maxCups;
    this.saveState();
    this.updateWaterGoalDisplay();
    this.updateWater();
    this.recordTodayToHistory();
    this.toast('饮水目标已设置为 ' + val + ' ml');
  },

  // ==================== EXERCISES ====================
  // 固定/递增双面板（常驻叠放）切换后：测量两面板实际高度，把容器高度同步为
  // 当前激活面板的高度（.ex-pane-box 带 height 过渡，切换/行数变化时平滑伸展收缩）。
  // 仅当可编辑弹窗（添加训练 / 未勾选动作详情）在场时测量；只读详情与其它弹窗无面板，跳过。
  _syncPaneH() {
    const mo = this.data.modalOverlay;
    if (!(mo === 'ex' || (mo === 'exDetail' && !this.data.exDetailRO))) return;
    if (!wx.createSelectorQuery) return;
    const self = this;
    const doQuery = () => {
      try {
        wx.createSelectorQuery()
          .select('.pane-fixed').boundingClientRect()
          .select('.pane-prog').boundingClientRect()
          .exec(res => {
            if (!res || !res[0] || !res[1]) return;
            const m = self.data.exLoadMode;
            const h = (m === 'prog' ? res[1].height : res[0].height) || 0;
            if (h > 1 && Math.abs(h - (self.data.exPaneH || 0)) > 1) {
              self.setData({ exPaneH: Math.round(h) });
            }
          });
      } catch (e) {}
    };
    if (wx.nextTick) wx.nextTick(doQuery);
    else setTimeout(doQuery, 30);
  },
  openExModal() {
    this.showModal('ex', {
      pageOverlay: '',
      exName: '', exWt: '', exSets: '', exReps: '',
      exLoadMode: 'fixed', exProgSets: '3',
      exProgRows: [{ wt: '', reps: '' }, { wt: '', reps: '' }, { wt: '', reps: '' }]
    });
    this._syncPaneH();
  },
  onExNameInput(e) { this.setData({ exName: e.detail.value }); },
  onExWt(e) { this.setData({ exWt: e.detail.value }); },
  onExSets(e) { this.setData({ exSets: e.detail.value }); },
  onExReps(e) { this.setData({ exReps: e.detail.value }); },
  // 固定 / 递增 填写方式切换
  switchExMode(e) {
    const m = (e && e.currentTarget && e.currentTarget.dataset) ? e.currentTarget.dataset.m : '';
    if (m !== 'fixed' && m !== 'prog') return;
    if (m === this.data.exLoadMode) return;
    if (m === 'prog') {
      // 已填过的递增行原样保留（详情/添加中来回切换不丢已填组）；
      // 首次切到递增：沿用固定模式已填的组数与首组重量/次数，方便衔接；未填则默认 3 组
      const hadRows = (this.data.exProgRows || []).some(r => (String(r.wt || '').trim() !== '') || (String(r.reps || '').trim() !== ''));
      if (!hadRows) {
        let n = parseInt(this.data.exSets, 10);
        if (!(n >= 1 && n <= 6)) n = 3;
        const rows = [];
        for (let k = 0; k < n; k++) rows.push({ wt: '', reps: '' });
        if (this.data.exWt) rows[0].wt = this.data.exWt;
        if (this.data.exReps) rows[0].reps = this.data.exReps;
        this.setData({ exLoadMode: 'prog', exProgSets: String(n), exProgRows: rows });
      } else {
        this.setData({ exLoadMode: 'prog' });
      }
    } else {
      // 切回固定：若固定输入框为空但已有递增行，用首组重量/次数 + 总组数兜底，避免空表单
      const rows = this.data.exProgRows || [];
      const fixedEmpty = !String(this.data.exWt || '').trim() && !String(this.data.exSets || '').trim() && !String(this.data.exReps || '').trim();
      if (fixedEmpty && rows.some(r => String(r.wt || '').trim() !== '')) {
        const ps = parseInt(this.data.exProgSets, 10);
        const sn = (ps >= 1 && ps <= 6) ? ps : rows.length;
        const first = rows[0] || {};
        this.setData({ exLoadMode: 'fixed', exWt: first.wt || '', exSets: String(sn), exReps: first.reps || '' });
      } else {
        this.setData({ exLoadMode: 'fixed' });
      }
    }
    this._syncPaneH();
  },
  // 递增组数输入：原样保存展示值（不回写输入框），同时做「即时跟随」——
  // 瞬时值一旦已是合法 1-6，立刻增删逐组行（保留已填行值），改完即见，无需等失焦。
  // 中间态（空 / 多位越界如 "26"、"52"）保持行数不动，避免把 6→2 先输 2 成 "26"
  // 这类过程强制改写或行数跳动（b5b3e7b 逐键钳制抖动坑）；最终由失焦兜底规范化。
  onExProgSets(e) {
    const v = e.detail.value;
    const patch = { exProgSets: v };
    const raw = String(v == null ? '' : v).trim();
    if (/^[1-6]$/.test(raw)) {
      const n = parseInt(raw, 10);
      if (n !== (this.data.exProgRows || []).length) patch.exProgRows = this.buildProgRows(n);
    }
    this.setData(patch);
    // 组数变化即时增删逐组行 → 递增面板实际高度已变，同步容器高度平滑伸展/收缩
    if (patch.exProgRows) this._syncPaneH();
  },
  // 组数失焦：规范化组数输入并同步行数（保留已填的行值）
  onExProgSetsBlur() { this.syncProgSetsRows(true); },
  // 规范化组数显示与逐组行数一致：
  //  合法 1-6 → 行数同步为组数；越界非空 → 钳制到 6/1 并提示；空 → 回填为当前行数
  syncProgSetsRows(tip) {
    const raw = String(this.data.exProgSets == null ? '' : this.data.exProgSets).trim();
    const n = parseInt(raw, 10);
    const cur = (this.data.exProgRows || []).length;
    if (n >= 1 && n <= 6) {
      if (n !== cur) this.setProgRows(n);
      return;
    }
    if (raw !== '') {
      const c = n > 6 ? 6 : 1;
      if (tip) this.toast('递增组数需在 1-6 之间，已按 ' + c + ' 组处理');
      this.setData({ exProgSets: String(c) });
      if (c !== cur) this.setProgRows(c);
      return;
    }
    // 组数被清空：行数据不动，仅把组数显示回填为当前行数
    this.setData({ exProgSets: String(cur || 3) });
  },
  onExProgWt(e) { this.setProgCell(parseInt(e.currentTarget.dataset.i, 10), e.detail.value, null); },
  onExProgReps(e) { this.setProgCell(parseInt(e.currentTarget.dataset.i, 10), null, e.detail.value); },
  setProgCell(i, wt, reps) {
    // 按 key path 只更新目标行字段，避免整表替换导致其余行 input 重渲染
    if (!this.data.exProgRows || !this.data.exProgRows[i]) return;
    const patch = {};
    if (wt != null) patch['exProgRows[' + i + '].wt'] = wt;
    if (reps != null) patch['exProgRows[' + i + '].reps'] = reps;
    this.setData(patch);
  },
  // 按 n 组构造逐组行：保留已有行已填值（前 n 行截断 / 不足补空行）
  buildProgRows(n) {
    const old = this.data.exProgRows || [];
    const rows = [];
    for (let k = 0; k < n; k++) {
      const o = old[k];
      rows.push(o ? { wt: String(o.wt == null ? '' : o.wt), reps: String(o.reps == null ? '' : o.reps) } : { wt: '', reps: '' });
    }
    return rows;
  },
  setProgRows(n) {
    this.setData({ exProgRows: this.buildProgRows(n) });
    this._syncPaneH();
  },
  cancelEx() { this.closeOverlay(); },
  addEx() {
    const name = this.data.exName.trim();
    if (!name) { this.toast('请输入动作名称'); return; }
    let meta = '', progCount = 0;
    if (this.data.exLoadMode === 'prog') {
      // 组数框可能处于未失焦的中间态（如刚输入数字还没离开输入框），先规范化再取行
      this.syncProgSetsRows(false);
      const r = this.buildProgMetaFromRows(this.data.exProgRows);
      if (!r.ok) { this.toast(r.err); return; }
      meta = r.meta;
      progCount = meta.split('→').length;
    } else {
      // 添加时可直接填重量/组数/次数（均可留空，之后点击动作名补填）
      meta = this.buildExMeta(this.data.exWt, this.data.exSets, this.data.exReps);
    }
    const plan = this.getAllPlans().find(p => p.id === this.state.currentPlanId);
    if (plan && plan.days && plan.days.length > 0) {
      plan.days[this.state.currentDayIdx % plan.days.length].exercises.push({ name, meta: meta, metaDate: meta ? todayKey() : '', done: false });
      this.saveState();
      this.recordTodayToHistory();
      this.renderExList();
    } else {
      this.closeOverlay();
      this.toast('暂无可用计划，请先在「计划」中选择');
      return;
    }
    this.closeOverlay();
    const shown = progCount ? '（' + progCount + ' 组递增方案）' : (meta ? ' ' + meta : '');
    this.toast('已添加: ' + name + shown);
  },
  // 点击动作名 → 当天重量方案：未勾选可编辑（固定/递增双模式）；
  // 已勾选完成则只读查看（防止勾选后误改，造成记录与勾选不一致）
  showExDetail(e) {
    const idx = e.currentTarget.dataset.i;
    this._exDetailIdx = idx;
    this._exDetailFromCheck = false;
    const exs = this.getCurrentExercises();
    if (!exs[idx]) return;
    const ex = exs[idx];
    this.setData({ exDetailTitle: ex.name });
    const meta = this.todayMeta(ex);
    const prog = this.parseProgSets(meta);
    if (ex.done) {
      // 勾选完成 → 锁定只读：仅展示当天方案（递增逐组 / 固定原文），改需先取消勾选
      this.setData({
        exDetailRO: true,
        exROText: prog.length ? '' : (meta || '当天暂无重量记录'),
        exRORows: prog.map(g => ({ text: g.kg + ' kg × ' + g.reps }))
      });
    } else {
      this.setData({ exDetailRO: false, exRORows: [], exROText: '' });
      if (prog.length) {
        // 当天填的是递增方案：回填成逐组可编辑行，可继续改重量/次数，也可切回固定
        this.setData({
          exLoadMode: 'prog',
          exWt: '', exSets: '', exReps: '',
          exProgSets: String(prog.length),
          exProgRows: prog.map(g => ({ wt: String(g.kg), reps: String(g.reps) }))
        });
      } else {
        const wm = /(\d+(?:\.\d+)?)\s*kg/i.exec(meta);
        const sm = /(\d+)\s*组/.exec(meta);
        const xs = (meta || '').match(/(?:×|\*)\s*(\d+)/g);
        const rm = (xs && xs.length) ? /(\d+)/.exec(xs[xs.length - 1]) : null;
        this.setData({
          exLoadMode: 'fixed',
          exWt: wm ? wm[1] : '', exSets: sm ? sm[1] : '', exReps: rm ? rm[1] : '',
          exProgSets: '3',
          exProgRows: [{ wt: '', reps: '' }, { wt: '', reps: '' }, { wt: '', reps: '' }]
        });
      }
    }
    const ck = this.burnCacheKey(exs[idx]);
    const c = storage.getBurnCache()[ck];
    let burnText;
    if (c != null && isFinite(c)) burnText = '消耗 ~' + c + ' kcal';
    else if (exs[idx].done) {
      burnText = 'AI 消耗估算中…';
      this.scheduleBurnCalib();
    } else {
      burnText = '填写并勾选完成后自动估算消耗';
    }
    this.setData({ exDetailBurn: burnText });
    this.openModal('exDetail');
    if (!this.data.exDetailRO) this._syncPaneH();
  },
  saveExMeta() {
    // 勾选完成后的只读视图：按钮为「知道了」，只关不改（防呆保护，不覆盖已锁定记录）
    if (this.data.exDetailRO) { this.closeOverlay(); return; }
    const exs = this.getCurrentExercises();
    const ex = exs[this._exDetailIdx];
    if (!ex) { this.closeOverlay(); return; }
    let meta;
    if (this.data.exLoadMode === 'prog') {
      // 递增：先按组数规范化逐组行，再校验生成方案（不足 2 组会拒绝，避免退化成单组丢中间重量）
      this.syncProgSetsRows(false);
      const r = this.buildProgMetaFromRows(this.data.exProgRows);
      if (!r.ok) { this.toast(r.err); return; }
      meta = r.meta;
    } else {
      meta = this.buildExMeta(this.data.exWt, this.data.exSets, this.data.exReps);
    }
    ex.meta = meta;
    ex.metaDate = meta ? todayKey() : '';
    // 清空重量/组数/次数 = 取消今天的这次记录：已勾选的动作必须同步取消勾选，
    // 否则会出现「无方案却已完成」的幻影勾选——消耗估算与当日历史把空 meta 当完成动作计入
    if (!meta) ex.done = false;
    if (this._exDetailFromCheck) {
      ex.done = !!this.todayMeta(ex);
      this._exDetailFromCheck = false;
    }
    this.saveState();
    this.recordTodayToHistory();
    this.renderExList();
    this.updateBurn();
    this.closeOverlay();
    if (ex.meta) this.scheduleBurnCalib();
    this.toast(ex.meta ? '已记录: ' + ex.name + ' ' + ex.meta : '已清空 ' + ex.name + ' 的重量/组数/次数');
  },
  toggleEx(e) {
    const idx = e.currentTarget.dataset.i;
    const exs = this.getCurrentExercises();
    if (!exs[idx]) return;
    const ex = exs[idx];
    if (!ex.done && !this.todayMeta(ex)) {
      this._exDetailIdx = idx;
      this._exDetailFromCheck = true;
      this.setData({
        exDetailTitle: ex.name,
        exDetailRO: false, exRORows: [], exROText: '',
        exLoadMode: 'fixed', exWt: '', exSets: '', exReps: '',
        exProgSets: '3',
        exProgRows: [{ wt: '', reps: '' }, { wt: '', reps: '' }, { wt: '', reps: '' }],
        exDetailBurn: '填写并勾选完成后自动估算消耗'
      });
      this.openModal('exDetail');
      this._syncPaneH();
      this.toast('请先填写重量、组数和次数，填完保存后自动完成');
      return;
    }
    ex.done = !ex.done;
    this.saveState();
    this.recordTodayToHistory();
    this.renderExList();
    this.updateBurn();
    if (ex.done) this.scheduleBurnCalib();
  },
  // 删除动作（确认弹窗）
  confirmDelEx(e) {
    const idx = e.currentTarget.dataset.i;
    const exs = this.getCurrentExercises();
    if (!exs[idx]) return;
    this._pendingDelIdx = idx;
    this._pendingDelIsCardio = false;
    this._pendingDelIsSupp = false;
    this.setData({ confirmDelText: '确定删除「' + exs[idx].name + '」吗？' });
    this.openModal('confirmDel');
  },
  doDelConfirm() {
    const idx = this._pendingDelIdx;
    const isCardio = this._pendingDelIsCardio;
    const isSupp = this._pendingDelIsSupp;
    this.closeOverlay();
    if (isSupp) {
      const list = this.state.supps || [];
      if (!list[idx]) return;
      const name = list[idx].name;
      list.splice(idx, 1);
      this.saveState();
      this.renderSuppList();
      this.toast('已删除: ' + name);
      return;
    }
    if (isCardio) {
      const list = this.state.cardio || [];
      if (!list[idx]) return;
      const name = list[idx].name;
      list.splice(idx, 1);
      this.saveState();
      this.recordTodayToHistory();
      this.renderCardioList();
      this.updateBurn();
      this.toast('已删除: ' + name);
    } else {
      const exs = this.getCurrentExercises();
      if (!exs[idx]) return;
      const name = exs[idx].name;
      exs.splice(idx, 1);
      this.saveState();
      this.recordTodayToHistory();
      this.renderExList();
      this.updateBurn();
      this.toast('已删除: ' + name);
    }
  },

  // ==================== DAY SWITCHER ====================
  switchDay(e) {
    // dataset 值一定是字符串，必须转数字，否则「idx + delta」变成字符串拼接
    // （如 idx=1, delta="1" → "11" % 4 = 3），导致多日计划从第 2 天起切换失效
    const delta = parseInt(e.currentTarget.dataset.d, 10);
    if (!isFinite(delta) || delta === 0) return;
    const plan = this.getAllPlans().find(p => p.id === this.state.currentPlanId);
    if (!plan || !plan.days || plan.days.length === 0) return;
    if (plan.days.length === 1) { this.toast('当前计划只有 1 个训练日'); return; }
    // 当天已勾选过动作 → 锁定当前训练日，防止已勾选数据与消耗归属错乱
    if (this.getCurrentExercises().some(e => e.done)) {
      this.toast('今天已完成训练，训练日已锁定，明天自动切换');
      return;
    }
    this.state.currentDayIdx = (this.state.currentDayIdx + delta + plan.days.length) % plan.days.length;
    this.saveState();
    this.renderExList();
    this.updateBurn();
    const day = plan.days[this.state.currentDayIdx];
    this.toast('切换到: ' + day.name);
  },

  // ==================== CARDIO ====================
  openCardioModal() {
    this.showModal('cardio', { pageOverlay: '', coName: '', coDur: '30', coBurn: '240', coCalHint: '消耗按 8 kcal/分 估算；填写项目名称后按 MET 精确估算（kcal = MET × 体重 × 时长），可手动修改' });
  },
  onCoName(e) { this.setData({ coName: e.detail.value }); this.autoCalcBurn(); },
  onCoDur(e) { this.setData({ coDur: e.detail.value }); this.autoCalcBurn(); },
  onCoBurn(e) { this.setData({ coBurn: e.detail.value }); },
  autoCalcBurn() {
    const d = parseFloat(this.data.coDur);
    if (!(d > 0)) return;
    const name = this.data.coName.trim();
    const met = this.matchMet(name);
    if (met) {
      this.setData({ coBurn: String(Math.round(met * this.getBodyWeight() * d / 60)), coCalHint: '已按 ' + met + ' MET 精确估算（' + met + ' kcal/kg/h × ' + this.getBodyWeight() + 'kg × ' + d + ' 分钟）' });
      return;
    }
    this.setData({ coBurn: String(Math.round(d * 8)) });
    if (!name) {
      this.setData({ coCalHint: '消耗按 8 kcal/分 估算；输入项目名称后可用 MET 更精确估算' });
      return;
    }
    this.setData({ coCalHint: '本地未收录「' + name + '」，AI 识别中…' });
    const self = this;
    ai.queryMet(name).then(r => {
      if (r && r.ok && r.met && self.data.coName.trim() === name && parseFloat(self.data.coDur) > 0) {
        self.setData({ coBurn: String(Math.round(r.met * self.getBodyWeight() * parseFloat(self.data.coDur) / 60)), coCalHint: 'AI 已识别：' + name + ' ≈ ' + r.met + ' MET（' + r.met + ' kcal/kg/h × ' + self.getBodyWeight() + 'kg × ' + self.data.coDur + ' 分钟）' });
      } else if (!r || !r.ok) {
        self.setData({ coCalHint: 'AI 识别失败，保持 8 kcal/分 估算，可直接手动修改' });
      }
    }).catch(() => {
      self.setData({ coCalHint: 'AI 识别失败，保持 8 kcal/分 估算，可直接手动修改' });
    });
  },
  cancelCardio() { this.closeOverlay(); },
  addCardio() {
    const name = this.data.coName.trim();
    const dur = parseFloat(this.data.coDur);
    const burn = parseFloat(this.data.coBurn);
    if (!name) { this.toast('请输入项目名称'); return; }
    if (!dur || dur <= 0) { this.toast('请输入时长'); return; }
    if (!isFinite(burn) || burn < 0) { this.toast('请输入有效消耗'); return; }
    if (!Array.isArray(this.state.cardio)) this.state.cardio = [];
    // 添加后自动勾选：有氧动作一添加即视为「今日已完成」，消耗立即计入今日统计；
    // 列表每天跨天清空（checkDailyReset），无需担心昨日有氧残留
    this.state.cardio.push({ name, dur, burn: Math.round(burn), meta: dur + '分钟·' + Math.round(burn) + 'kcal', done: true });
    this.saveState();
    this.updateBurn();
    this.renderCardioList();
    this.closeOverlay();
    this.toast('已添加（已勾选）: ' + name);
  },
  toggleCardio(e) {
    const idx = e.currentTarget.dataset.i;
    const exs = this.state.cardio || [];
    if (exs[idx]) {
      exs[idx].done = !exs[idx].done;
      // saveState 内部已刷新当天 history，无需重复 recordTodayToHistory
      this.saveState();
      this.renderCardioList();
      this.updateBurn();
    }
  },
  confirmDelCardio(e) {
    const idx = e.currentTarget.dataset.i;
    const exs = this.state.cardio || [];
    if (!exs[idx]) return;
    this._pendingDelIdx = idx;
    this._pendingDelIsCardio = true;
    this._pendingDelIsSupp = false;
    this.setData({ confirmDelText: '确定删除「' + exs[idx].name + '」吗？' });
    this.openModal('confirmDel');
  },
  // 点击有氧名字 → 修改时长/消耗（与力量训练点名字弹窗一致）
  showCardioDetail(e) {
    const idx = e.currentTarget.dataset.i;
    const exs = this.state.cardio || [];
    if (!exs[idx]) return;
    this._cardioDetailIdx = idx;
    const c = exs[idx];
    const dm = /^(\d+(?:\.\d+)?)\s*分钟/.exec(c.meta || '');
    const bm = /(\d+(?:\.\d+)?)\s*kcal/.exec(c.meta || '');
    const dur = dm ? dm[1] : (c.dur != null ? String(c.dur) : '');
    const burn = bm ? bm[1] : (isFinite(c.burn) ? String(c.burn) : '');
    this.setData({
      coDetailTitle: c.name,
      coDetailDur: dur,
      coDetailBurn: burn,
      coDetailCalHint: '修改时长或消耗后点击保存；填完时长自动按 MET 估算消耗'
    });
    this.openModal('cardioDetail');
  },
  onCoDetailDur(e) { this.setData({ coDetailDur: e.detail.value }); this.autoCalcCoDetailBurn(); },
  onCoDetailBurn(e) { this.setData({ coDetailBurn: e.detail.value }); },
  autoCalcCoDetailBurn() {
    const d = parseFloat(this.data.coDetailDur);
    if (!(d > 0)) return;
    const name = this.data.coDetailTitle.trim();
    const met = this.matchMet(name);
    if (met) {
      this.setData({ coDetailBurn: String(Math.round(met * this.getBodyWeight() * d / 60)), coDetailCalHint: '已按 ' + met + ' MET 估算（' + met + ' kcal/kg/h × ' + this.getBodyWeight() + 'kg × ' + d + ' 分钟）' });
    }
  },
  saveCardioMeta() {
    const exs = this.state.cardio || [];
    const c = exs[this._cardioDetailIdx];
    if (!c) { this.closeOverlay(); return; }
    const dur = parseFloat(this.data.coDetailDur);
    const burn = parseFloat(this.data.coDetailBurn);
    if (!dur || dur <= 0) { this.toast('请输入有效时长'); return; }
    if (!isFinite(burn) || burn < 0) { this.toast('请输入有效消耗'); return; }
    c.dur = dur;
    c.burn = Math.round(burn);
    c.meta = dur + '分钟·' + c.burn + 'kcal';
    this.saveState();
    this.recordTodayToHistory();
    this.renderCardioList();
    this.updateBurn();
    this.closeOverlay();
    this.toast('已更新: ' + c.name + ' ' + c.meta);
  },

  // ==================== SUPPS (补剂：不计热量，勾选每日重置) ====================
  openSuppModal() {
    this.showModal('supp', { pageOverlay: '', suppName: '', suppUnit: 'ml', suppDose: '' });
  },
  onSuppName(e) { this.setData({ suppName: e.detail.value }); },
  onSuppDose(e) { this.setData({ suppDose: e.detail.value }); },
  selectSuppUnit(e) { this.setData({ suppUnit: e.currentTarget.dataset.u }); },
  cancelSupp() { this.closeOverlay(); },
  addSupp() {
    const name = this.data.suppName.trim();
    const dose = parseFloat(this.data.suppDose);
    const unit = (this.data.suppUnit === 'pill' || this.data.suppUnit === 'g') ? this.data.suppUnit : 'ml';
    if (!name) { this.toast('请输入补剂名称'); return; }
    if (!dose || dose <= 0) { this.toast('请输入剂量'); return; }
    if (!Array.isArray(this.state.supps)) this.state.supps = [];
    this.state.supps.push({ id: 'sp' + Date.now() + Math.floor(Math.random() * 1000), name: name, unit: unit, dose: dose, done: false });
    this.saveState();
    this.renderSuppList();
    this.closeOverlay();
    this.toast('已添加: ' + name);
  },
  toggleSupp(e) {
    const idx = e.currentTarget.dataset.i;
    const list = this.state.supps || [];
    if (!list[idx]) return;
    list[idx].done = !list[idx].done;
    this.saveState();
    this.renderSuppList();
  },
  confirmDelSupp(e) {
    const idx = e.currentTarget.dataset.i;
    const list = this.state.supps || [];
    if (!list[idx]) return;
    this._pendingDelIdx = idx;
    this._pendingDelIsCardio = false;
    this._pendingDelIsSupp = true;
    this.setData({ confirmDelText: '确定删除「' + list[idx].name + '」吗？' });
    this.openModal('confirmDel');
  },

  // ==================== MEALS ====================
  showMealDetail(e) {
    const type = e.currentTarget.dataset.type;
    const m = this.state.meals[type];
    if (!m) return;
    const items = (m.items || []).map((item, idx) => ({ name: item.name, sub: item.sub || '', cal: item.cal, idx: idx }));
    let total = (m.items || []).reduce((s, i) => s + (isFinite(i.cal) ? i.cal : 0), 0);
    this.setData({ mealDetailTitle: m.name || MEAL_LABELS[type], mealDetailItems: items, mealDetailTotal: total, _mealDetailType: type });
    this.openModal('meal');
  },
  delMealItem(e) {
    const idx = e.currentTarget.dataset.i;
    const type = this.data._mealDetailType;
    this.state.meals[type].items.splice(idx, 1);
    this.saveState();
    this.showMealDetail({ currentTarget: { dataset: { type: type } } });
    this.renderMealList();
    this.updateIntake();
  },
  closeMealDetail() { this.closeOverlay(); },
  // 从餐次详情直接添加食物：锁定餐次为当前查看的餐，打开食物弹窗
  addFoodFromMeal() {
    const type = this.data._mealDetailType;
    if (type && MEAL_TYPES.indexOf(type) >= 0) {
      this.state.selectedMealType = type;
      this.saveState();
      this._fromMealDetail = true; // 确认添加后回到该餐详情
    }
    this.openFoodModal();
  },

  // ==================== FOOD MODAL ====================
  openFoodModal() {
    this._pickedFoods = [];
    this._lastFoodQuery = null;
    if (this._manualFoodT) clearTimeout(this._manualFoodT);
    this.renderFoodQuickList();
    this.showModal('food', {
      pageOverlay: '',
      mealTypeSel: MEAL_TYPES.map(t => ({ type: t, name: MEAL_LABELS[t], on: t === this.state.selectedMealType })),
      manualFoodName: '', manualFoodMatch: '系统自动计算', manualFoodMatchCls: 'muted', manualFoodCalWrap: false, manualFoodCal: '',
      foodPickSummary: '', aiStatus: 'AI 查询'
    });
  },
  renderFoodQuickList() {
    const groups = {};
    FOOD_DB.forEach(f => { (groups[f.cat] = groups[f.cat] || []).push({ name: f.name, cal: f.cal, picked: false }); });
    const list = CAT_ORDER.filter(c => groups[c]).map(c => ({ cat: c, items: groups[c] }));
    this.setData({ foodPickList: list });
  },
  selectMealType(e) {
    const type = e.currentTarget.dataset.type;
    this.state.selectedMealType = type;
    this.saveState();
    this.setData({ mealTypeSel: MEAL_TYPES.map(t => ({ type: t, name: MEAL_LABELS[t], on: t === type })) });
  },
  getSelectedMealType() { return this.state.selectedMealType || 'breakfast'; },
  onManualFoodInput(e) {
    const name = e.detail.value;
    this.setData({ manualFoodName: name });
    if (this._manualFoodT) clearTimeout(this._manualFoodT);
    this._lastFoodQuery = null;
    const trimmed = name.trim();
    if (!trimmed) {
      this.setData({ manualFoodMatch: '系统自动计算', manualFoodMatchCls: 'muted', manualFoodCalWrap: false });
      return;
    }
    // 解析克数：如 "鸡胸肉200g"
    const wm = trimmed.match(/^(.+?)(\d+(?:\.\d+)?)\s*g$/);
    const base = wm ? wm[1] : trimmed;
    const weight = wm ? parseFloat(wm[2]) : 100;
    const scaleCal = per100 => weight === 100 ? per100 : Math.round(per100 * weight / 100);
    const weightSub = weight === 100 ? '约100g' : '约' + weight + 'g';
    const exact = this.exactFoodCal(trimmed);
    if (exact) {
      this._lastFoodQuery = { input: trimmed, name: exact.name, cal: exact.cal, sub: exact.sub };
      this.setData({ manualFoodMatch: exact.cal + ' kcal', manualFoodMatchCls: 'accent', manualFoodCalWrap: false });
      return;
    }
    const cached = storage.getFoodCache()[base];
    if (cached && cached.cal) {
      const cal = scaleCal(cached.cal);
      this._lastFoodQuery = { input: trimmed, name: base, cal, sub: weightSub };
      this.setData({ manualFoodMatch: cal + ' kcal', manualFoodMatchCls: 'accent', manualFoodCalWrap: false });
      return;
    }
    this.setData({ manualFoodMatch: '正在查询…', manualFoodMatchCls: 'muted', manualFoodCalWrap: false });
    this._manualFoodT = setTimeout(() => {
      if (this.data.manualFoodName.trim() !== trimmed) return;
      const self = this;
      ai.foodCalAI(trimmed).then(r => {
        if (self.data.manualFoodName.trim() !== trimmed) return;
        if (r && r.ok && r.cal > 0) {
          const cal = scaleCal(r.cal);
          self._lastFoodQuery = { input: trimmed, name: base, cal, sub: weightSub };
          const cache = storage.getFoodCache();
          cache[base] = { name: r.name, cal: r.cal, sub: '约100g' };
          storage.setFoodCache(cache);
          self.setData({ manualFoodMatch: cal + ' kcal（AI）', manualFoodMatchCls: 'accent', manualFoodCalWrap: false });
        } else {
          self.setData({ manualFoodMatch: r && r.msg ? '⚠️ ' + r.msg : '⚠️ AI 未收录，请手动填写', manualFoodMatchCls: 'danger', manualFoodCalWrap: true });
        }
      }).catch(() => {
        self.setData({ manualFoodMatch: '⚠️ AI 查询失败，请手动填写', manualFoodMatchCls: 'danger', manualFoodCalWrap: true });
      });
    }, 350);
  },
  exactFoodCal(name) {
    const n = name.trim();
    const m = n.match(/^(.+?)(\d+(?:\.\d+)?)\s*g$/);
    const base = m ? m[1] : n;
    const weight = m ? parseFloat(m[2]) : 100;
    for (const f of FOOD_DB) {
      if (f.name === base) return { name: f.name, cal: Math.round(f.cal * weight / 100), sub: '约' + weight + 'g' };
    }
    for (const f of FOOD_CN) {
      if (f[0] === base) return { name: f[0], cal: Math.round(f[1] * weight / 100), sub: f[2] };
    }
    return null;
  },
  onManualFoodCal(e) { this.setData({ manualFoodCal: e.detail.value }); },
  toggleFoodPick(e) {
    const ci = e.currentTarget.dataset.ci;
    const ii = e.currentTarget.dataset.ii;
    const list = this.data.foodPickList;
    const item = list[ci].items[ii];
    item.picked = !item.picked;
    if (item.picked) {
      this._pickedFoods.push({ name: item.name, cal: item.cal });
    } else {
      this._pickedFoods = this._pickedFoods.filter(f => f.name !== item.name);
    }
    const total = this._pickedFoods.reduce((s, f) => s + f.cal, 0);
    this.setData({ foodPickList: list, foodPickSummary: this._pickedFoods.length ? '已选 ' + this._pickedFoods.length + ' 项 · 共 ' + total + ' kcal' : '' });
  },
  cancelFood() {
    const fromMeal = this._fromMealDetail;
    const type = this.state.selectedMealType;
    this._fromMealDetail = false;
    this.closeOverlay();
    // 从餐次详情进入的：等关闭动画结束后回到该餐详情，不丢上下文
    if (fromMeal && type && this.state.meals[type]) {
      const self = this;
      setTimeout(() => self.showMealDetail({ currentTarget: { dataset: { type: type } } }), 250);
    }
  },
  confirmAddFood() {
    const manualName = this.data.manualFoodName.trim();
    if (manualName) {
      if (this._lastFoodQuery && this._lastFoodQuery.input === manualName) {
        this._pickedFoods.push({ name: this._lastFoodQuery.name, cal: this._lastFoodQuery.cal, sub: this._lastFoodQuery.sub });
      } else {
        if (!this.data.manualFoodCalWrap) { this.toast('正在查询热量，请稍候'); return; }
        const manualCal = parseInt(this.data.manualFoodCal, 10);
        if (isNaN(manualCal) || manualCal < 0) { this.toast('请输入该食物的热量'); return; }
        this._pickedFoods.push({ name: manualName, cal: manualCal, sub: '手动添加' });
      }
    }
    if (this._pickedFoods.length === 0) { this.toast('请选择或输入食物'); return; }
    const type = this.getSelectedMealType();
    this._pickedFoods.forEach(f => {
      this.state.meals[type].items.push({ name: f.name, sub: f.sub || '约100g', cal: f.cal });
    });
    this.saveState();
    this.renderMealList();
    this.updateIntake();
    this.toast('已添加到' + (MEAL_LABELS[type] || '') + ': ' + this._pickedFoods.length + ' 项');
    this._pickedFoods = [];
    this.closeOverlay();
    // 若是从餐次详情进入的，返回该餐详情查看刚添加的记录
    if (this._fromMealDetail) {
      this._fromMealDetail = false;
      const self = this;
      setTimeout(() => self.showMealDetail({ currentTarget: { dataset: { type: type } } }), 120);
    }
  },

  // ==================== METRICS ====================
  renderMetrics() {
    const cur = this.state.metrics.current;
    let weightVal = '--', bodyFatVal = '--', weightDiff = '', bodyFatDiff = '', mWeight = '', mBodyFat = '';
    if (cur) {
      const prev = this.state.metrics.previous || cur;
      // storage 旧数据可能把数字存成字符串，.toFixed 会直接抛错崩溃；统一 Number 保护
      const w = Number(cur.weight), b = Number(cur.bodyFat);
      const pw = Number(prev.weight), pb = Number(prev.bodyFat);
      weightVal = isFinite(w) ? w.toFixed(1) : '--';
      bodyFatVal = isFinite(b) ? b.toFixed(1) : '--';
      const wd = isFinite(w) && isFinite(pw) ? w - pw : 0;
      const bd = isFinite(b) && isFinite(pb) ? b - pb : 0;
      weightDiff = (wd > 0 ? '+' : '') + wd.toFixed(1);
      bodyFatDiff = (bd > 0 ? '+' : '') + bd.toFixed(1);
      mWeight = w;
      mBodyFat = b;
    }
    this.setData({ weightVal, bodyFatVal, weightDiff, bodyFatDiff, mWeight, mBodyFat });
    this.updateGoalWeightHint();
    this.updateIntake();
  },
  onMWeight(e) { this.setData({ mWeight: e.detail.value }); },
  onMBodyFat(e) { this.setData({ mBodyFat: e.detail.value }); },
  saveMetric() {
    const w = parseFloat(this.data.mWeight);
    const b = parseFloat(this.data.mBodyFat);
    if (isNaN(w) || isNaN(b)) { this.toast('请输入有效数值'); return; }
    if (!this.state.metrics || !this.state.metrics.current) {
      this.state.metrics = { current: { weight: w, bodyFat: b }, previous: null, initial: { weight: w, bodyFat: b }, history: [] };
    } else {
      this.state.metrics.previous = JSON.parse(JSON.stringify(this.state.metrics.current));
      this.state.metrics.current = { weight: w, bodyFat: b };
    }
    if (!Array.isArray(this.state.metrics.history)) this.state.metrics.history = [];
    const today = todayKey();
    const lastLog = this.state.metrics.history[this.state.metrics.history.length - 1];
    if (lastLog && lastLog.date === today) {
      lastLog.weight = w; lastLog.bodyFat = b;
    } else {
      this.state.metrics.history.push({ date: today, weight: w, bodyFat: b });
    }
    this.saveState();
    this.renderMetrics();
    this.closeOverlay();
    this.toast('身体数据已保存');
  },

  // ==================== METRIC CURVE (canvas 2d) ====================
  openMetricChart() {
    this.setData({ metricChartType: 'weight' });
    this.openModal('metricChart');
    setTimeout(() => this.drawMetricChart(), 120);
  },
  setMetricChart(e) {
    const f = e.currentTarget.dataset.f;
    this.setData({ metricChartType: f });
    setTimeout(() => this.drawMetricChart(), 60);
  },
  metricSeries(field) {
    const arr = ((this.state.metrics && this.state.metrics.history) || [])
      .filter(r => r && r.date && isFinite(r[field]))
      .sort((a, b) => (a.date < b.date ? -1 : 1));
    return arr.map(r => ({ y: +r[field], date: r.date }));
  },
  fmtMD(ds) {
    const p = String(ds).split('-');
    return (+p[1]) + '/' + (+p[2]);
  },
  drawMetricChart() {
    const self = this;
    const f = this.data.metricChartType;
    const pts = this.metricSeries(f);
    const labels = { weight: '体重 (kg)', bodyFat: '体脂率 (%)' };
    if (pts.length < 2) {
      this.setData({ metricChartInfo: pts.length === 1 ? '再记录一次即可看到曲线' : '暂无数据，先记录一次身体数据' });
      return;
    }
    const W = 320, H = 190, L = 40, R = 12, T = 16, B = 28;
    const vals = pts.map(p => p.y);
    let min = Math.min.apply(null, vals), max = Math.max.apply(null, vals);
    if (min === max) { min -= 1; max += 1; }
    const span = max - min;
    const X = i => L + i * (W - L - R) / (pts.length - 1);
    const Y = v => T + (1 - (v - min) / span) * (H - T - B);
    const gridCol = '#E8E5DF';
    const textCol = '#9E9A93';
    const accentCol = '#D4785C';
    const bgCol = '#FAF9F6';
    const q = wx.createSelectorQuery().in(this);
    q.select('#metricChart').fields({ node: true, size: true }).exec(res => {
      if (!res || !res[0] || !res[0].node) return;
      const canvas = res[0].node;
      const ctx = canvas.getContext('2d');
      const dpr = wx.getSystemInfoSync().pixelRatio || 2;
      canvas.width = W * dpr;
      canvas.height = H * dpr;
      ctx.scale(dpr, dpr);
      ctx.clearRect(0, 0, W, H);
      // 网格线
      ctx.font = '9px sans-serif';
      for (let k = 0; k <= 3; k++) {
        const v = max - span * k / 3;
        const y = Y(v);
        ctx.strokeStyle = gridCol;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(L, y);
        ctx.lineTo(W - R, y);
        ctx.stroke();
        ctx.fillStyle = textCol;
        ctx.textAlign = 'end';
        ctx.fillText(v.toFixed(1), L - 6, y + 3);
      }
      // 折线
      ctx.strokeStyle = accentCol;
      ctx.lineWidth = 2;
      ctx.lineJoin = 'round';
      ctx.lineCap = 'round';
      ctx.beginPath();
      pts.forEach((p, i) => {
        const x = X(i), y = Y(p.y);
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      });
      ctx.stroke();
      // 圆点
      pts.forEach((p, i) => {
        const x = X(i), y = Y(p.y);
        const last = i === pts.length - 1;
        ctx.beginPath();
        ctx.arc(x, y, 3.2, 0, Math.PI * 2);
        ctx.fillStyle = last ? accentCol : bgCol;
        ctx.fill();
        ctx.strokeStyle = accentCol;
        ctx.lineWidth = 1.6;
        ctx.stroke();
      });
      // X 轴日期
      ctx.fillStyle = textCol;
      ctx.textAlign = 'start';
      ctx.fillText(this.fmtMD(pts[0].date), L, H - 8);
      ctx.fillStyle = accentCol;
      ctx.textAlign = 'end';
      ctx.fillText(this.fmtMD(pts[pts.length - 1].date), W - R, H - 8);
      this.setData({ metricChartInfo: labels[f] + ' · 共 ' + pts.length + ' 次记录 · 最新 ' + pts[pts.length - 1].y.toFixed(1) });
    });
  },

  // ==================== PLANS ====================
  renderPlanList() {
    const plans = this.getAllPlans();
    const view = plans.map(p => ({
      id: p.id,
      name: p.name,
      desc: p.desc || '',
      tags: p.tags || [],
      current: p.id === this.state.currentPlanId
    }));
    this.setData({ planList: view });
  },
  showPlanDetail(e) {
    const id = e.currentTarget.dataset.id;
    const plan = this.getAllPlans().find(p => p.id === id);
    if (!plan) return;
    this._detailPlanId = id;
    const isCustom = (this.state.customPlans || []).some(p => p.id === id);
    const isCurrent = plan.id === this.state.currentPlanId;
    const days = (plan.days || []).map((d, i) => ({
      name: d.name,
      count: (d.exercises || []).length,
      exs: (d.exercises || []).map(x => ({ name: x.name, meta: x.meta || '' }))
    }));
    this.pushPage('planDetail', {
      planDetailName: plan.name,
      planDetailDesc: plan.desc || '',
      planDetailDays: days,
      planDetailIsCustom: isCustom,
      planDetailDeleteShow: isCustom,
      planDetailApplyText: isCurrent ? '当前使用中' : '使用此计划',
      planDetailApplyDisabled: isCurrent
    });
  },
  backFromPlanDetail() { this.popPage('plans'); },
  editPlanFromDetail() {
    if (!this._detailPlanId) return;
    const plan = this.getAllPlans().find(p => p.id === this._detailPlanId);
    if (!plan) return;
    this._editorBackTo = 'planDetail';
    this._editorDays = plan.days.map(d => ({ name: d.name, exercises: (d.exercises || []).map(x => JSON.parse(JSON.stringify(x))) }));
    this.pushPage('planEditor', {
      planEditorTitle: '编辑计划',
      planName: plan.name,
      newDayName: ''
    });
    this.renderEditorDays();
  },
  deletePlanFromDetail() {
    if (!this._detailPlanId) return;
    const self = this;
    wx.showModal({
      title: '删除计划',
      content: '确定删除此计划？',
      confirmColor: '#C44',
      success(res) {
        if (!res.confirm) return;
        const idx = self.state.customPlans.findIndex(p => p.id === self._detailPlanId);
        if (idx === -1) { self.toast('预设计划不可删除'); return; }
        if (self.state.currentPlanId === self._detailPlanId) {
          self.state.currentPlanId = 'ppl';
          self.state.currentDayIdx = 0;
        }
        self.state.customPlans.splice(idx, 1);
        self.saveState();
        self.toast('计划已删除');
        self.renderPlanList();
        self.renderExList();
        self.popPage('plans');
      }
    });
  },
  applyPlanFromDetail() {
    if (this._detailPlanId) this.applyPlan(this._detailPlanId);
  },
  applyPlan(id) {
    this.state.currentPlanId = id;
    this.state.currentDayIdx = 0;
    this.saveState();
    this.recordTodayToHistory();
    this.toast('已切换计划');
    this.renderPlanList();
    this.renderExList();
    this.updateBurn();
    this.popPage('');
  },
  // ---- 计划编辑器 ----
  openPlanEditor() {
    this._detailPlanId = null;
    this._editorBackTo = 'plans';
    this._editorDays = [];
    this.pushPage('planEditor', {
      planEditorTitle: '新建计划',
      planName: '',
      newDayName: ''
    });
    this.renderEditorDays();
  },
  renderEditorDays() {
    const days = this._editorDays || [];
    const view = days.map((d, i) => ({
      i: i,
      name: d.name,
      count: (d.exercises || []).length,
      exNames: d.exercises.length > 0 ? d.exercises.map(e => e.name).join('、') : '暂无动作'
    }));
    this.setData({ planDaysView: view });
  },
  onPlanName(e) { this.setData({ planName: e.detail.value }); },
  onNewDayName(e) { this.setData({ newDayName: e.detail.value }); },
  addPlanDayInline() {
    const name = this.data.newDayName.trim();
    if (!name) { this.toast('请输入训练日名称'); return; }
    this._editorDays.push({ name, exercises: [] });
    this.setData({ newDayName: '' });
    this.renderEditorDays();
    this.toast('已添加训练日: ' + name);
  },
  removeEditorDay(e) {
    const idx = e.currentTarget.dataset.i;
    this._editorDays.splice(idx, 1);
    this.renderEditorDays();
  },
  openDayEditor(e) {
    const idx = e.currentTarget.dataset.i;
    this._editingDayIdx = idx;
    this.setData({ dayEditorTitle: this._editorDays[idx].name + ' - 动作', dayExName: '' });
    this.renderDayExList();
    this.openModal('dayEditor');
  },
  renderDayExList() {
    const day = this._editorDays[this._editingDayIdx];
    if (!day) return;
    const view = (day.exercises || []).map((ex, i) => ({ i: i, name: ex.name, meta: ex.meta || '' }));
    this.setData({ dayExList: view });
  },
  onDayExName(e) { this.setData({ dayExName: e.detail.value }); },
  addExToEditorDay() {
    const name = this.data.dayExName.trim();
    if (!name) { this.toast('请输入动作名称'); return; }
    this._editorDays[this._editingDayIdx].exercises.push({ name, meta: '', done: false });
    this.setData({ dayExName: '' });
    this.renderDayExList();
    this.renderEditorDays();
    this.toast('已添加: ' + name);
  },
  removeEditorDayEx(e) {
    const idx = e.currentTarget.dataset.i;
    this._editorDays[this._editingDayIdx].exercises.splice(idx, 1);
    this.renderDayExList();
    this.renderEditorDays();
  },
  closeDayEditor() { this.closeOverlay(); },
  savePlan() {
    const name = this.data.planName.trim() || '自定义计划';
    if (!this._editorDays || this._editorDays.length === 0) { this.toast('请至少添加一个训练日'); return; }
    const totalEx = this._editorDays.reduce((s, d) => s + d.exercises.length, 0);
    const planData = {
      name,
      desc: this._editorDays.length + ' 个训练日 · ' + totalEx + ' 个动作',
      tags: this._editorDays.filter(d => d.exercises.length > 0).map(d => d.name + ' ' + d.exercises.length + '动作'),
      // 保留原动作的 meta/done（含当天已填重量与勾选），新增动作默认未完成——
      // 否则训练中途编辑计划补充动作会把当天进度全部清空
      days: this._editorDays.map(d => ({ name: d.name, exercises: d.exercises.map(e => ({ name: e.name, meta: e.meta || '', done: !!e.done, metaDate: e.metaDate || '' })) }))
    };
    let updated = false;
    if (this._detailPlanId) {
      const presetIdx = this.state.plans.findIndex(p => p.id === this._detailPlanId);
      if (presetIdx !== -1) {
        this.state.plans[presetIdx] = Object.assign({}, this.state.plans[presetIdx], planData);
        updated = true;
      } else {
        const customIdx = this.state.customPlans.findIndex(p => p.id === this._detailPlanId);
        if (customIdx !== -1) {
          this.state.customPlans[customIdx] = Object.assign({}, this.state.customPlans[customIdx], planData);
          updated = true;
        }
      }
    }
    if (!updated) {
      const newPlan = Object.assign({ id: 'custom_' + Date.now() }, planData);
      this.state.customPlans.push(newPlan);
      this._detailPlanId = newPlan.id;
    }
    this.saveState();
    this.renderPlanList();
    if (this.state.currentPlanId === this._detailPlanId) this.renderExList();
    this.toast((updated ? '计划已更新: ' : '计划已保存: ') + name + '（' + this._editorDays.length + '个训练日·' + totalEx + '个动作）');
    this.showPlanDetailById(this._detailPlanId);
  },
  showPlanDetailById(id) {
    const plan = this.getAllPlans().find(p => p.id === id);
    if (!plan) return;
    this._detailPlanId = id;
    const isCustom = (this.state.customPlans || []).some(p => p.id === id);
    const isCurrent = plan.id === this.state.currentPlanId;
    const days = (plan.days || []).map(d => ({
      name: d.name,
      count: (d.exercises || []).length,
      exs: (d.exercises || []).map(x => ({ name: x.name, meta: x.meta || '' }))
    }));
    this.pushPage('planDetail', {
      planDetailName: plan.name,
      planDetailDesc: plan.desc || '',
      planDetailDays: days,
      planDetailIsCustom: isCustom,
      planDetailDeleteShow: isCustom,
      planDetailApplyText: isCurrent ? '当前使用中' : '使用此计划',
      planDetailApplyDisabled: isCurrent
    });
  },
  cancelPlanEditor() { this.popPage(this._editorBackTo || 'plans'); },

  // ==================== PAGES (全屏页) ====================
  // openPage：前进导航（push）——目标页自右推入
  openPage(type) {
    if (type === 'progress') this.initProgress();
    if (type === 'profile') { this.updateGoalWeightHint(); this.updateWaterGoalDisplay(); }
    this.pushPage(type);
  },
  // pushPage：前进导航统一入口。若当前已有全屏页，则让它保持挂载垫在新页下面
  // （pageUnder，无动画、z-index 更低），避免新页推入动画期间露出主页闪烁；推入完成后卸载。
  pushPage(type, extra) {
    if (this._pgCloseTimer) { clearTimeout(this._pgCloseTimer); this._pgCloseTimer = null; }
    if (this._pgUnderTimer) { clearTimeout(this._pgUnderTimer); this._pgUnderTimer = null; }
    const cur = this.data.pageOverlay;
    const under = (cur && cur !== type) ? cur : '';
    const patch = Object.assign({ pageOverlay: type, modalOverlay: '', pageLeaving: '', pageUnder: under, pgClosing: false, pgAnim: 'push' }, extra || {});
    this.setData(patch);
    if (this._pgUnderTimer) clearTimeout(this._pgUnderTimer);
    this._pgUnderTimer = under ? setTimeout(() => {
      this._pgUnderTimer = null;
      if (this.data.pageUnder === under) this.setData({ pageUnder: '' });
    }, 340) : null;
  },
  // popPage：返回导航（pop）——旧页保持挂载右滑退出，下层页从左轻微回位；
  // 动画结束后只清 pageLeaving/pgClosing，pgAnim 保持 'pop'，避免目标页类名变化导致进场动画重播。
  popPage(target) {
    if (this.data.pgClosing) return;
    const leaving = this.data.pageOverlay;
    if (!leaving || leaving === target) { this.setData({ pageOverlay: target, modalOverlay: '', pageUnder: '' }); return; }
    if (this._pgCloseTimer) { clearTimeout(this._pgCloseTimer); this._pgCloseTimer = null; }
    if (this._pgUnderTimer) { clearTimeout(this._pgUnderTimer); this._pgUnderTimer = null; }
    this.setData({ pageOverlay: target, pageLeaving: leaving, pgClosing: true, pgAnim: 'pop', pageUnder: '', modalOverlay: '' });
    this._pgCloseTimer = setTimeout(() => {
      this._pgCloseTimer = null;
      if (this.data.pgClosing) this.setData({ pageLeaving: '', pgClosing: false });
    }, 340);
  },
  openPlans() { this.openPage('plans'); },
  openProgress() { this.openPage('progress'); },
  openProfile() { this.openPage('profile'); },
  backHome() { this.popPage(''); },

  // ==================== 转发 / 分享 ====================
  // 必须定义 onShareAppMessage，微信才在右上角「…」菜单显示「转发」。
  // 否则转发入口不会出现，表现为「小程序无法转发」。
  onShareAppMessage() {
    return {
      title: 'FitFlow · 今天你练了吗？',
      path: 'pages/index/index'
    };
  },
  // 朋友圈分享：定义该函数后，右上角「…」菜单即出现「分享到朋友圈」入口
  onShareTimeline() {
    return { title: 'FitFlow · 今日训练打卡' };
  },

  // ==================== OVERLAY HELPERS ====================
  // openModal：底部弹窗，叠加在当前页面之上（全屏页保留在后面，与原版 overlay 行为一致）
  // showModal：统一弹窗打开入口（清除未完成的退场动画计时器，复位 ovClosing）
  showModal(type, extra) {
    if (this._ovCloseTimer) { clearTimeout(this._ovCloseTimer); this._ovCloseTimer = null; }
    const patch = Object.assign({ modalOverlay: type, ovClosing: false }, extra || {});
    this.setData(patch);
  },
  openModal(e) {
    const type = typeof e === 'string' ? e : (e && e.currentTarget ? e.currentTarget.dataset.type : '');
    this.showModal(type);
  },
  // closeOverlay：只关闭底部弹窗，保留全屏页。
  // 先播放退场动画（ov-out 类：遮罩渐隐 + 面板下滑），动画结束后再真正卸载。
  closeOverlay() {
    if (!this.data.modalOverlay || this.data.ovClosing) return;
    this.setData({ ovClosing: true });
    if (this._ovCloseTimer) clearTimeout(this._ovCloseTimer);
    this._ovCloseTimer = setTimeout(() => {
      this._ovCloseTimer = null;
      if (this.data.ovClosing) this.setData({ modalOverlay: '', ovClosing: false });
    }, 240);
  },

  // ==================== PROGRESS PAGE ====================
  initProgress() {
    this.recordTodayToHistory();
    const now = new Date();
    this._heatYear = now.getFullYear();
    this._heatMonth = now.getMonth();
    this.renderHeatmap();
    this.updateProgressStats();
    this.analyzeGrowth(false);
  },
  heatPrevMonth() {
    this._heatMonth--;
    if (this._heatMonth < 0) { this._heatMonth = 11; this._heatYear--; }
    this.renderHeatmap();
  },
  heatNextMonth() {
    this._heatMonth++;
    if (this._heatMonth > 11) { this._heatMonth = 0; this._heatYear++; }
    this.renderHeatmap();
  },
  renderHeatmap() {
    const now = new Date();
    const year = this._heatYear;
    const month = this._heatMonth;
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const firstDay = new Date(year, month, 1).getDay();
    const isCurrentMonth = year === now.getFullYear() && month === now.getMonth();
    const today = now.getDate();
    const colors = ['#E8E5DF', '#ECD5CC', '#DEAA98', '#D07F64', '#D4785C'];
    // 当月训练数与最大消耗
    let trainedCount = 0, maxBurn = 0;
    for (let day = 1; day <= daysInMonth; day++) {
      const dateStr = year + '-' + ('0' + (month + 1)).slice(-2) + '-' + ('0' + day).slice(-2);
      const h = this.state.history[dateStr];
      if (h && h.trained) { trainedCount++; if ((h.burn || 0) > maxBurn) maxBurn = h.burn || 0; }
    }
    // 42 格
    const cells = [];
    for (let i = 0; i < firstDay; i++) cells.push({ day: '', level: 0, isToday: false, isFuture: false, disabled: true });
    for (let day = 1; day <= daysInMonth; day++) {
      const dateStr = year + '-' + ('0' + (month + 1)).slice(-2) + '-' + ('0' + day).slice(-2);
      const h = this.state.history[dateStr];
      let level = 0;
      if (h && h.trained && maxBurn > 0) {
        const ratio = (h.burn || 0) / maxBurn;
        if (ratio >= 0.75) level = 4;
        else if (ratio >= 0.5) level = 3;
        else if (ratio >= 0.25) level = 2;
        else level = 1;
      }
      const isToday = isCurrentMonth && day === today;
      const isFuture = isCurrentMonth && day > today;
      cells.push({ day: String(day), level: level, color: colors[level], isToday, isFuture, disabled: isFuture, dateStr });
    }
    this.setData({
      heatmapMonthLabel: MONTH_CN[month] + ' 训练热度',
      heatmapDaysLabel: trainedCount + '/' + daysInMonth + ' 天',
      monthTrain: trainedCount + ' 天',
      heatmap: cells
    });
  },
  showHeatDetail(e) {
    const dateStr = e.currentTarget.dataset.ds;
    if (!dateStr) return;
    // 未来日期格子（当月今天之后的占位）不可查看：直接忽略，避免弹出误导性的「休息日」
    if (dateStr > todayKey()) return;
    const parts = dateStr.split('-');
    const y = parseInt(parts[0], 10), m = parseInt(parts[1], 10) - 1, d = parseInt(parts[2], 10);
    const dayNames = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
    const title = MONTH_CN[m] + d + '日 ' + dayNames[new Date(y, m, d).getDay()];
    const h = this.state.history[dateStr];
    let body = [];
    if (!h || !h.trained) {
      body.push({ label: '', text: '休息日，未训练', muted: true });
    } else {
      body.push({ label: '训练部位', text: h.dayName || '训练日' });
      body.push({ label: '消耗', text: (h.burn || 0) + ' kcal' });
      body.push({ label: '摄入', text: (h.intake || 0) + ' kcal' });
      body.push({ label: '饮水', text: (h.water || 0) + ' ml' });
      body.push({ label: '完成动作 (' + ((h.exNames || []).length) + ')', text: '', head: true });
      const exNames = h.exNames || [];
      const exMetas = h.exMeta || [];
      if (exNames.length > 0) {
        exNames.forEach((n, i) => body.push({ label: '✓', text: n + (exMetas[i] ? ' · ' + exMetas[i] : ''), ex: true }));
      } else {
        body.push({ label: '', text: '（该日期未记录动作明细）', muted: true });
      }
    }
    this.setData({ heatDetailTitle: title, heatDetailBody: body });
    this.openModal('heatDetail');
  },
  updateProgressStats() {
    const now = new Date();
    const today = todayKey();
    const dayOfWeek = now.getDay() || 7;
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - dayOfWeek + 1);
    let weekTrained = 0;
    for (let i = 0; i < 7; i++) {
      const d = new Date(weekStart);
      d.setDate(weekStart.getDate() + i);
      const dateStr = d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2);
      if (this.state.history[dateStr] && this.state.history[dateStr].trained) weekTrained++;
    }
    let totalTrainDays = 0;
    Object.keys(this.state.history).forEach(k => { if (this.state.history[k].trained) totalTrainDays++; });
    let streak = 0;
    for (let i = 0; i < 365; i++) {
      const d = new Date(now);
      d.setDate(now.getDate() - i);
      const dateStr = d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2);
      const h = this.state.history[dateStr];
      if (h && h.trained) streak++;
      else { if (i === 0) continue; break; }
    }
    this.setData({ weekTrain: weekTrained + '/7', totalTrain: totalTrainDays + ' 天', streakDays: streak + ' 天' });
  },

  // ==================== TRAINING GROWTH (AI) ====================
  buildGrowthContext() {
    const now = new Date();
    const dayOfWeek = now.getDay() || 7;
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - dayOfWeek + 1);
    const weekly = [];
    for (let w = 7; w >= 0; w--) {
      const start = new Date(weekStart);
      start.setDate(weekStart.getDate() - w * 7);
      let count = 0;
      for (let i = 0; i < 7; i++) {
        const d = new Date(start);
        d.setDate(start.getDate() + i);
        const ds = d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2);
        const h = this.state.history[ds];
        if (h && h.trained) count++;
      }
      const end = new Date(start);
      end.setDate(start.getDate() + 6);
      weekly.push({ label: (start.getMonth() + 1) + '/' + start.getDate(), end: (end.getMonth() + 1) + '/' + end.getDate(), count: count });
    }
    const dates = Object.keys(this.state.history).sort();
    const details = [];
    for (let i = dates.length - 1; i >= 0 && details.length < 12; i--) {
      const h = this.state.history[dates[i]];
      if (h && h.trained) {
        const exs = (h.exNames || []).map((n, idx) => n + ((h.exMeta && h.exMeta[idx]) ? '(' + h.exMeta[idx] + ')' : '')).join('、');
        details.push(dates[i].slice(5) + ' ' + (h.dayName || '训练') + (h.burn ? ' 消耗' + h.burn + 'kcal' : '') + (exs ? ' [' + exs + ']' : ''));
      }
    }
    // 同动作重量进步序列（供 AI 对比重量长进，最多 6 条）
    const progMap = {};
    for (let i = 0; i < dates.length; i++) {
      const h = this.state.history[dates[i]];
      if (!h || !h.trained) continue;
      (h.exNames || []).forEach((n, idx) => {
        const meta = (h.exMeta && h.exMeta[idx]) || '';
        const wm = /(\d+(?:\.\d+)?)\s*kg/.exec(meta);
        if (!wm) return;
        const key = String(n || '').trim();
        if (!progMap[key]) progMap[key] = [];
        progMap[key].push({ date: dates[i], kg: parseFloat(wm[1]) });
      });
    }
    const progress = [];
    Object.keys(progMap).forEach(name => {
      const seq = progMap[name];
      if (seq.length < 2) return;
      const first = seq[0], last = seq[seq.length - 1];
      if (Math.abs(last.kg - first.kg) >= 0.5) {
        progress.push(name + ': ' + first.date.slice(5) + ' ' + first.kg + 'kg → ' + last.date.slice(5) + ' ' + last.kg + 'kg');
      }
    });
    progress.sort();
    progress.splice(0, Math.max(0, progress.length - 6));
    return { weekly, details, progress };
  },
  renderGrowthBars(weekly) {
    const maxCount = Math.max.apply(null, [1].concat(weekly.map(w => w.count)));
    const colors = {
      0: '#E8E5DF',
      a: '#ECD5CC',
      b: '#DEAA98',
      c: '#D07F64',
      d: '#D4785C'
    };
    const colorFor = count => {
      if (count === 0) return colors[0];
      const ratio = count / maxCount;
      if (ratio >= 0.75) return colors.d;
      if (ratio >= 0.5) return colors.c;
      if (ratio >= 0.25) return colors.b;
      return colors.a;
    };
    const bars = weekly.map((w, i) => {
      const isLatest = i === weekly.length - 1;
      const h = w.count === 0 ? 4 : Math.max(6, Math.round(w.count / maxCount * 100));
      return {
        count: w.count,
        h: h,
        color: colorFor(w.count),
        label: w.label,
        end: '~' + w.end,
        isLatest: isLatest,
        dim: w.count === 0,
        textColor: isLatest ? '#D4785C' : '#9E9A93'
      };
    });
    this.setData({ growthBars: bars });
  },
  analyzeGrowth(force) {
    const { weekly, details, progress } = this.buildGrowthContext();
    this.renderGrowthBars(weekly);
    const trainedDays = details.length;
    if (trainedDays === 0) {
      this.setData({ growthText: '还没有训练记录。完成一次训练后，AI 会在这里分析你的长进。', growthHasRefresh: false });
      return;
    }
    if (!force) {
      const c = storage.getGrowth();
      if (c && c.date === todayKey() && c.text) {
        this.setData({ growthText: c.text, growthHasRefresh: true });
        return;
      }
    }
    this.setData({ growthLoading: true, growthText: 'AI 正在分析你的训练长进…', growthHasRefresh: true });
    const self = this;
    // 本地降级分析（AI 不可用/失败时），并显示失败原因方便排查
    const fallback = (errMsg) => {
      const recent = weekly.slice(-4).reduce((s, w) => s + w.count, 0) / 4;
      const before = weekly.slice(0, 4).reduce((s, w) => s + w.count, 0) / 4;
      const diff = recent - before;
      const diffTxt = (diff >= 0 ? '+' : '') + diff.toFixed(1);
      const trend = diff >= 0 ? '提升' : '下降';
      const pTxt = (progress && progress.length) ? '\n重量进步: ' + progress.join('；') : '';
      const aiHint = errMsg ? '\nAI 未生效：' + errMsg + '。部署云函数并配置 Key 后点 ↻ 重新分析' : '\n（开启 AI 后可基于训练计划与动作重量生成个性化长进分析）';
      self.setData({
        growthText: '近 4 周平均每周 ' + recent.toFixed(1) + ' 天，比前 4 周（' + before.toFixed(1) + ' 天）' + trend + ' ' + diffTxt + ' 天/周' + pTxt + aiHint,
        growthLoading: false
      });
    };
    ai.analyzeGrowth(weekly, details, progress).then(r => {
      if (r && r.ok && r.text) {
        self.setData({ growthText: r.text, growthLoading: false });
        storage.setGrowth({ date: todayKey(), text: r.text });
      } else {
        fallback((r && r.msg) ? String(r.msg).slice(0, 80) : '');
      }
    }).catch(err => {
      const rawMsg = (err && (err.errMsg || err.message)) ? String(err.errMsg || err.message) : 'AI 调用失败';
      fallback(rawMsg.slice(0, 80));
    });
  },

  // ==================== DATA RESET ====================
  resetAllData() {
    const self = this;
    wx.showModal({
      title: '清空所有数据',
      content: '确定清空所有数据？此操作不可恢复！',
      confirmColor: '#C44',
      success(res) {
        if (!res.confirm) return;
        wx.showModal({
          title: '再次确认',
          content: '所有训练记录、身体数据、饮食记录都将被删除。',
          confirmColor: '#C44',
          success(res2) {
            if (!res2.confirm) return;
            storage.clearAll();
            self.state = defaultState();
            self.saveState();
            self.renderAll();
            self.setData({ pageOverlay: '', modalOverlay: '' });
            self.toast('所有数据已清空');
            setTimeout(() => self.openModal('metric'), 400);
          }
        });
      }
    });
  },

  // ==================== PROFILE 页辅助 ====================
  onCheckAI() {
    const self = this;
    this.setData({ aiStatus: '检测中…' });
    ai.testAI().then(r => {
      if (r && r.ok) self.setData({ aiStatus: 'AI ✓ 已开启' });
      else self.setData({ aiStatus: 'AI 未开启' });
    }).catch(() => self.setData({ aiStatus: 'AI 未开启' }));
  },
  onAbout() {
    wx.showModal({
      title: 'FitFlow',
      content: '我是彭于晏 · 训练饮食记录\n\n训练计划 · 热量追踪 · AI 消耗估算',
      showCancel: false,
      confirmText: '知道了'
    });
  }
});
