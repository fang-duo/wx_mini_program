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
    selectedDateRecord: null,
    historyRecords: {} 
  },

  onLoad() {
    const now = new Date();
    const today = this.formatDate(now);
    
    this.setData({
      today,
      selectedDate: today
    });

    this.initProjects();
    this.loadData();
    this.generateCalendar();
  },

  onShow() {
    this.loadData();
    this.generateCalendar();
  },

  formatDate(date) {
    const year = date.getFullYear();
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    return `${year}-${month}-${day}`;
  },

  initProjects() {
    const projects = [
      { id: 's1', title: '八段锦', category: 'sports', categoryName: '传统体育', value: 3.5, unit: 'kcal/min', inputUnit: '分钟' },
      { id: 's2', title: '五禽戏', category: 'sports', categoryName: '传统体育', value: 3.5, unit: 'kcal/min', inputUnit: '分钟' },
      { id: 's3', title: '太极拳', category: 'sports', categoryName: '传统体育', value: 4.5, unit: 'kcal/min', inputUnit: '分钟' },
      { id: 'f1', title: '百合雪梨汤', category: 'food', categoryName: '传统饮食', value: 0.005, unit: '健康/g', inputUnit: '克' },
      { id: 'f2', title: '非遗茶文化', category: 'food', categoryName: '传统饮食', value: 0.01, unit: '健康/g', inputUnit: '克' },
      { id: 'm1', title: '中医针灸', category: 'medicine', categoryName: '传统医药', value: 0.1, unit: '健康/min', inputUnit: '分钟' },
      { id: 'm2', title: '中医推拿', category: 'medicine', categoryName: '传统医药', value: 0.1, unit: '健康/min', inputUnit: '分钟' },
      { id: 'mu1', title: '古琴疗愈', category: 'music', categoryName: '传统音乐', value: 0.1, unit: '修养/min', inputUnit: '分钟' }
    ];
    this.setData({ allProjects: projects });
  },

  async loadData() {
    const goals = wx.getStorageSync('checkin_goals') || this.data.goals;
    let historyRecords = wx.getStorageSync('checkin_history') || {};

    if (wx.cloud) {
      try {
        const db = wx.cloud.database();
        const cloudRes = await db.collection('checkin_records').get();
        
        if (cloudRes.data.length > 0) {
          const cloudHistory = {};
          cloudRes.data.forEach(record => {
            cloudHistory[record.date] = record;
          });
          historyRecords = { ...historyRecords, ...cloudHistory };
          
          wx.setStorageSync('checkin_history', historyRecords);
        }
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
    this.setData({ currentYear, currentMonth }, () => this.generateCalendar());
  },

  nextMonth() {
    let { currentYear, currentMonth } = this.data;
    if (currentMonth === 12) {
      currentYear++;
      currentMonth = 1;
    } else {
      currentMonth++;
    }
    this.setData({ currentYear, currentMonth }, () => this.generateCalendar());
  },

  inputGoal(e) {
    const { key } = e.currentTarget.dataset;
    const value = parseInt(e.detail.value) || 0;
    this.setData({
      [`goals.${key}`]: value
    });
  },

  saveGoals() {
    wx.setStorageSync('checkin_goals', this.data.goals);
    wx.showToast({ title: '目标已保存', icon: 'success' });
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
    
    if (!record.weight) {
      wx.showToast({ title: '请输入体重', icon: 'none' });
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
    wx.setStorageSync('checkin_history', newHistory);
    
    this.setData({
      historyRecords: newHistory,
      selectedDateRecord: newRecord
    });

    this.generateCalendar();

    if (wx.cloud) {
      try {
        const db = wx.cloud.database();
        const existingRecord = await db.collection('checkin_records').where({
          date: selectedDate
        }).get();

        if (existingRecord.data.length > 0) {
          await db.collection('checkin_records').doc(existingRecord.data[0]._id).update({
            data: {
              ...newRecord,
              updateTime: db.serverDate()
            }
          });
        } else {
          await db.collection('checkin_records').add({
            data: {
              ...newRecord,
              createTime: db.serverDate(),
              updateTime: db.serverDate()
            }
          });
        }
      } catch (error) {
        console.error('保存到云端失败：', error);
      }
    }

    wx.showToast({ title: '打卡成功', icon: 'success' });
  },

  selectDate(e) {
    const { date } = e.currentTarget.dataset;
    if (!date) return;
    this.setData({ selectedDate: date }, () => {
      this.loadRecordForDate(date);
    });
  }
})