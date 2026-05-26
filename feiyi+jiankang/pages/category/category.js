const {
  ensurePrivacyHomeLock
} = require('../../utils/access');

function normalizeMediaValue(value) {
  if (!value) return '';
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) return normalizeMediaValue(value[0]);
  if (typeof value === 'object') {
    return value.url || value.src || value.tempFileURL || value.download_url || value.fileID || value.cloudID || '';
  }
  return '';
}

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

const fallbackCategoryMap = {
  sports: {
    title: '传统体育 (武)',
    desc: '传承千年功法，强健民族体魄。通过柔和连绵的肢体运动，调和五脏六腑。',
    list: [
      { id: 's1', detailId: 'sports-baduanjin', title: '八段锦', desc: '八段锦作为国家级非物质文化遗产，动作柔和连绵，滑利流畅，不仅能强身健体，还能调节内脏功能。', cover: '', tag: '热门功法' },
      { id: 's2', detailId: 'sports-wuqinxi', title: '五禽戏', desc: '神医华佗创编的导引养生功法，模仿虎、鹿、熊、猿、鸟五种动物的形态和神态。', cover: '', tag: '导引养生' },
      { id: 's3', detailId: 'sports-taiji', title: '太极拳', desc: '结合易经阴阳五行之变化，中医经络学说，是一种内外兼修、柔和、缓慢、轻灵的拳术。', cover: '', tag: '内外兼修' }
    ]
  },
  food: {
    title: '传统饮食 (食)',
    desc: '药食同源，顺应四时。在日常三餐中蕴含着古人顺应自然的养生智慧。',
    list: [
      { id: 'f1', detailId: 'food-soup', title: '百合雪梨汤', desc: '结合《本草纲目》的记载，百合与雪梨的搭配不仅是传统的美味，更是秋季润肺降燥的佳品。', cover: '', tag: '秋季食疗' },
      { id: 'f2', detailId: 'food-tea', title: '非遗茶文化', desc: '茶，发乎神农，闻于鲁周公。饮茶不仅是解渴，更是修身养性、清心雅志的健康生活方式。', cover: '', tag: '修身养性' }
    ]
  },
  medicine: {
    title: '传统医药 (医)',
    desc: '辨证施治，针药并用。中华医药是古代科学的瑰宝，蕴含深厚的哲学思想。',
    list: [
      { id: 'm1', detailId: 'medicine-acupuncture', title: '中医针灸', desc: '被列入人类非物质文化遗产代表作名录的针灸，通过刺激人体特定穴位来疏通经络、调和气血。', cover: '', tag: '疏通经络' },
      { id: 'm2', detailId: 'medicine-tuina', title: '中医推拿', desc: '以人疗人，运用推、拿、提、捏、揉等手法，在人体经络穴位上进行治疗和保健。', cover: '', tag: '物理理疗' }
    ]
  },
  music: {
    title: '传统音乐 (乐)',
    desc: '百病生于气而止于音。五音对应五脏，聆听古乐可达到静心安神、缓解焦虑之效。',
    list: [
      { id: 'mu1', detailId: 'music-guqin', title: '古琴疗愈', desc: '古琴音色深沉、余音悠远，听之可平复情绪，适合现代人冥想放松与精神疗愈。', cover: '', tag: '静心安神' }
    ]
  }
};

Page({
  data: {
    typeId: '',
    title: '',
    desc: '',
    list: []
  },

  onLoad(options) {
    if (ensurePrivacyHomeLock(this, { allowAgreement: true })) {
      return;
    }
    const typeId = options.id || 'sports';
    this.loadCategoryData(typeId);
  },

  onShow() {
    ensurePrivacyHomeLock(this, { allowAgreement: true });
  },

  getFallbackData(typeId) {
    return fallbackCategoryMap[typeId] || fallbackCategoryMap.sports;
  },

  async loadCategoryData(typeId) {
    const fallbackData = this.getFallbackData(typeId);

    this.setData({
      typeId,
      title: fallbackData.title,
      desc: fallbackData.desc,
      list: fallbackData.list
    });
    wx.setNavigationBarTitle({ title: fallbackData.title });

    if (!wx.cloud) return;

    const db = wx.cloud.database();

    try {
      const heritageRes = await queryFirstAvailableCollection(db, ['heritage_contents', 'heritage_content'], collection =>
        collection.get()
      );

      const cloudList = (heritageRes.data || [])
        .filter(item => {
          const itemCategory = item.category || item.categoryId || '';
          const itemStatus = typeof item.status === 'boolean' ? item.status : true;
          return itemCategory === typeId && itemStatus;
        })
        .sort((a, b) => {
          const aSort = typeof a.sort === 'number' ? a.sort : 999;
          const bSort = typeof b.sort === 'number' ? b.sort : 999;
          return aSort - bSort;
        })
        .map(item => ({
        id: item._id || item.id,
        title: item.title || '',
        desc: item.summary || '',
        cover: normalizeMediaValue(item.cover),
        tag: fallbackData.title.replace(/\s*\(.+\)$/, ''),
        contentType: 'heritage'
      })).filter(item => item.title);

      const finalData = {
        title: fallbackData.title,
        desc: fallbackData.desc,
        list: cloudList.length ? cloudList : fallbackData.list
      };

      this.setData(finalData);
      wx.setNavigationBarTitle({ title: finalData.title });
    } catch (error) {
      console.error('分类页云端内容加载失败：', error);
    }
  },

  goToDetail(e) {
    const title = e.currentTarget.dataset.title || '';
    const itemId = e.currentTarget.dataset.id || '';
    const contentType = e.currentTarget.dataset.contentType || 'heritage';
    const query = [
      `title=${encodeURIComponent(title)}`,
      `contentType=${encodeURIComponent(contentType)}`
    ];

    if (itemId) {
      query.push(`itemId=${encodeURIComponent(itemId)}`);
    }

    wx.navigateTo({
      url: `/pages/detail/detail?${query.join('&')}`
    });
  }
})
