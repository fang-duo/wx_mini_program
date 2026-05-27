const {
  LOCAL_KEYS,
  loadCheckinGoalsFromCloud,
  saveCheckinGoalsToCloud,
  loadCheckinRecordsFromCloud,
  saveCheckinRecordToCloud
} = require('../../utils/dataSync');

const {
  getAccessSummary,
  ensurePrivacyHomeLock
} = require('../../utils/access');

const CHECKIN_CATEGORY_RULES = {
  sports: { categoryName: '传统体育', value: 3.5, unit: 'kcal/min', inputUnit: '分钟' },
  food: { categoryName: '传统饮食', value: 0.005, unit: '健康/g', inputUnit: '克' },
  medicine: { categoryName: '传统医药', value: 0.1, unit: '健康/min', inputUnit: '分钟' },
  music: { categoryName: '传统音乐', value: 0.1, unit: '修养/min', inputUnit: '分钟' }
};

async function queryFirstAvailableCollection(db, collectionNames, executor) {
  let lastError = null;

  for (const name of collectionNames) {
    try {
      return await executor(db.collection(name), name);
    } catch (error) {
      lastError = error;
    }
  }

  if (lastError) throw lastError;
  return null;
}

Page({
  data: {
    currentYear: new Date().getFullYear(),
    currentMonth: new Date().getMonth() + 1,
    weeks: ['日', '一', '二', '三', '四', '五', '六'],
    calendarDays: [],
    today: '',
    selectedDate: '',
    goals: {
      calories: 300,
      health: 2,
      cultivation: 1
    },
    record: {
      weight: '',
      projects: [],
      durations: {}
    },
    allProjects: [],
    loadingProjects: true,
    projectsEmpty: false,
    selectedDateRecord: null,
    historyRecords: {},
    accessDenied: false,
    deniedReason: ''
  },

  onLoad() {
    if (ensurePrivacyHomeLock(this, { allowAgreement: true })) {
      return;
    }
    this.refreshAccessState(true);
  },

  onShow() {
    if (ensurePrivacyHomeLock(this, { allowAgreement: true })) {
      return;
    }
    this.refreshAccessState(false);
  },

  onTabItemTap() {
    ensurePrivacyHomeLock(this, { allowAgreement: true, showToast: true });
  },

  async refreshAccessState(isFirstLoad) {
    const { privacyState, isLoggedIn } = getAccessSummary();
    let deniedReason = '';

    if (privacyState.browseOnly || !privacyState.accepted) {
      deniedReason = '同意隐私政策后可使用健康打卡。';
    } else if (!isLoggedIn) {
      deniedReason = '登录后可记录和同步健康打卡。';
    }

    this.setData({
      accessDenied: !!deniedReason,
      deniedReason
    });

    if (deniedReason) {
      return;
    }

    if (isFirstLoad || !this.data.today) {
      const now = new Date();
      const today = this.formatDate(now);

      this.setData({
        today,
        selectedDate: today
      });
    }

    await this.loadProjects();
    await this.loadData();
    this.generateCalendar();
  },

  formatDate(date) {
    const year = date.getFullYear();
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    return `${year}-${month}-${day}`;
  },

  async loadProjects() {
    this.setData({
      loadingProjects: true,
      projectsEmpty: false,
      allProjects: []
    });

    if (!wx.cloud) {
      this.setData({
        loadingProjects: false,
        projectsEmpty: true
      });
      return;
    }

    const db = wx.cloud.database();

    try {
      const heritageRes = await queryFirstAvailableCollection(db, ['heritage_contents', 'heritage_content'], collection =>
        collection.get()
      );

      const projects = (heritageRes.data || [])
        .filter(item => {
          const category = item.category || item.categoryId || '';
          const rule = CHECKIN_CATEGORY_RULES[category];
          const itemStatus = typeof item.status === 'boolean' ? item.status : true;
          return !!(rule && itemStatus && item.title);
        })
        .sort((a, b) => {
          const aSort = typeof a.sort === 'number' ? a.sort : 999;
          const bSort = typeof b.sort === 'number' ? b.sort : 999;
          return aSort - bSort;
        })
        .map(item => {
          const category = item.category || item.categoryId || '';
          const rule = CHECKIN_CATEGORY_RULES[category];
          return {
            id: item._id || item.id,
            title: item.title || '',
            category,
            categoryName: rule.categoryName,
            value: rule.value,
            unit: rule.unit,
            inputUnit: rule.inputUnit
          };
        });

      this.setData({
        allProjects: projects,
        loadingProjects: false,
        projectsEmpty: projects.length === 0
      });
    } catch (error) {
      console.error('加载打卡项目失败：', error);
      this.setData({
        allProjects: [],
        loadingProjects: false,
        projectsEmpty: true
      });
    }
  },

  async loadData() {
    let goals = wx.getStorageSync(LOCAL_KEYS.CHECKIN_GOALS) || this.data.goals;
    let historyRecords = wx.getStorageSync(LOCAL_KEYS.CHECKIN_HISTORY) || {};

    if (wx.cloud) {
      try {
        const cloudGoals = await loadCheckinGoalsFromCloud();
        if (cloudGoals) {
          goals = { ...goals, ...cloudGoals };
          wx.setStorageSync(LOCAL_KEYS.CHECKIN_GOALS, goals);
        }
      } catch (error) {
        console.error('从云端加载打卡目标失败：', error);
      }

      try {
        historyRecords = await this.syncMonthRecords(historyRecords);
      } catch (error) {
        console.error('从云端加载打卡记录失败：', error);
      }
    }
    
    this.setData({
      goals,
      historyRecords
    });

    this.loadRecordForDate(this.data.selectedDate);
  },

  async syncMonthRecords(baseHistory = {}) {
    const cloudRecords = await loadCheckinRecordsFromCloud({
      year: this.data.currentYear,
      month: this.data.currentMonth
    });

    if (!cloudRecords.length) {
      return baseHistory;
    }

    const cloudHistory = {};
    cloudRecords.forEach(record => {
      cloudHistory[record.date] = record;
    });

    const nextHistory = { ...baseHistory, ...cloudHistory };
    wx.setStorageSync(LOCAL_KEYS.CHECKIN_HISTORY, nextHistory);
    return nextHistory;
  },

  async refreshCurrentMonthRecords() {
    if (!wx.cloud) {
      this.generateCalendar();
      this.loadRecordForDate(this.data.selectedDate);
      return;
    }

    try {
      const historyRecords = await this.syncMonthRecords(this.data.historyRecords);
      this.setData({ historyRecords }, () => {
        this.generateCalendar();
        this.loadRecordForDate(this.data.selectedDate);
      });
    } catch (error) {
      console.error('刷新当月打卡记录失败：', error);
      this.generateCalendar();
      this.loadRecordForDate(this.data.selectedDate);
    }
  },

  loadRecordForDate(date) {
    const { historyRecords, allProjects } = this.data;
    const record = historyRecords[date] || null;

    if (record) {
      const updatedProjects = allProjects.map(p => ({
        ...p,
        checked: (record.projectIds || []).includes(p.id)
      }));
      this.setData({
        'record.weight': record.weight,
        'record.projects': record.projectIds || [],
        'record.durations': record.durations || {},
        allProjects: updatedProjects,
        selectedDateRecord: record
      });
    } else {
      const resetProjects = allProjects.map(p => ({ ...p, checked: false }));
      this.setData({
        'record.weight': '',
        'record.projects': [],
        'record.durations': {},
        allProjects: resetProjects,
        selectedDateRecord: null
      });
    }
  },

  generateCalendar() {
    const { currentYear, currentMonth, historyRecords } = this.data;
    const firstDay = new Date(currentYear, currentMonth - 1, 1).getDay();
    const daysInMonth = new Date(currentYear, currentMonth, 0).getDate();
    
    const calendarDays = [];
    
    for (let i = 0; i < firstDay; i++) {
      calendarDays.push({ day: '', date: '', status: 'empty' });
    }
    
    for (let i = 1; i <= daysInMonth; i++) {
      const dateStr = `${currentYear}-${currentMonth.toString().padStart(2, '0')}-${i.toString().padStart(2, '0')}`;
      const hasRecord = !!historyRecords[dateStr];
      calendarDays.push({
        day: i,
        date: dateStr,
        status: hasRecord ? 'checked' : 'normal',
        hasRecord: hasRecord,
        isToday: dateStr === this.data.today
      });
    }
    
    this.setData({ calendarDays });
  },

  prevMonth() {
    let { currentYear, currentMonth } = this.data;
    if (currentMonth === 1) {
      currentYear--;
      currentMonth = 12;
    } else {
      currentMonth--;
    }
    this.setData({ currentYear, currentMonth }, () => {
      this.refreshCurrentMonthRecords();
    });
  },

  nextMonth() {
    let { currentYear, currentMonth } = this.data;
    if (currentMonth === 12) {
      currentYear++;
      currentMonth = 1;
    } else {
      currentMonth++;
    }
    this.setData({ currentYear, currentMonth }, () => {
      this.refreshCurrentMonthRecords();
    });
  },

  inputGoal(e) {
    const { key } = e.currentTarget.dataset;
    const value = parseInt(e.detail.value) || 0;
    this.setData({
      [`goals.${key}`]: value
    });
  },

  async saveGoals() {
    wx.setStorageSync(LOCAL_KEYS.CHECKIN_GOALS, this.data.goals);

    if (!wx.cloud) {
      wx.showToast({ title: '目标已保存', icon: 'success' });
      return;
    }

    try {
      await saveCheckinGoalsToCloud(this.data.goals);
      wx.showToast({ title: '目标已同步', icon: 'success' });
    } catch (error) {
      console.error('保存打卡目标失败：', error);
      wx.showToast({ title: '已先保存到本地', icon: 'none' });
    }
  },

  inputWeight(e) {
    this.setData({ 'record.weight': e.detail.value });
  },

  checkboxChange(e) {
    const selectedIds = e.detail.value;
    const updatedProjects = this.data.allProjects.map(p => ({
      ...p,
      checked: selectedIds.includes(p.id)
    }));
    this.setData({ 
      'record.projects': selectedIds,
      allProjects: updatedProjects
    });
  },

  inputDuration(e) {
    const { id } = e.currentTarget.dataset;
    const value = parseInt(e.detail.value) || 0;
    this.setData({
      [`record.durations.${id}`]: value
    });
  },

  async submitRecord() {
    const { record, allProjects, historyRecords, selectedDate } = this.data;

    if (!allProjects.length) {
      wx.showToast({ title: '暂无可打卡项目', icon: 'none' });
      return;
    }

    if (!record.weight) {
      wx.showToast({ title: '请输入体重', icon: 'none' });
      return;
    }

    if (!record.projects.length) {
      wx.showToast({ title: '请至少选择一个项目', icon: 'none' });
      return;
    }

    let calories = 0;
    let health = 0;
    let cultivation = 0;

    record.projects.forEach(id => {
      const project = allProjects.find(p => p.id === id);
      const duration = record.durations[id] || 0;
      if (project && duration > 0) {
        const totalValue = project.value * duration;
        if (project.category === 'sports') {
          calories += totalValue;
        } else if (project.category === 'medicine' || project.category === 'food') {
          health += totalValue;
        } else if (project.category === 'music') {
          cultivation += totalValue;
        }
      }
    });

    calories = Math.round(calories * 10) / 10;
    health = Math.round(health * 10) / 10;
    cultivation = Math.round(cultivation * 10) / 10;

    const newRecord = {
      date: selectedDate,
      weight: parseFloat(record.weight) || 0,
      projectIds: record.projects,
      durations: record.durations,
      calories,
      health,
      cultivation
    };

    const newHistory = { ...historyRecords, [selectedDate]: newRecord };
    wx.setStorageSync(LOCAL_KEYS.CHECKIN_HISTORY, newHistory);
    
    this.setData({
      historyRecords: newHistory,
      selectedDateRecord: newRecord
    });

    this.generateCalendar();

    let syncSuccess = !wx.cloud;
    if (wx.cloud) {
      try {
        syncSuccess = await saveCheckinRecordToCloud(newRecord);
      } catch (error) {
        console.error('保存到云端失败：', error);
      }
    }

    wx.showToast({
      title: syncSuccess ? '打卡成功' : '已保存到本地',
      icon: syncSuccess ? 'success' : 'none'
    });
  },

  selectDate(e) {
    const { date } = e.currentTarget.dataset;
    if (!date) return;
    this.setData({ selectedDate: date }, () => {
      this.loadRecordForDate(date);
    });
  },

  goToProfile() {
    wx.switchTab({
      url: '/pages/profile/profile'
    });
  },

  goToHome() {
    wx.switchTab({
      url: '/pages/index/index'
    });
  }
})
