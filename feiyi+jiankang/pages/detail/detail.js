const {
  buildFavoriteKey,
  getContentFavoritesCache,
  checkContentFavoriteInCloud,
  saveContentFavoriteToCloud,
  removeContentFavoriteFromCloud
} = require('../../utils/dataSync');

const {
  getAccessSummary,
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

function getFallbackArticleData(title) {
  let data = {};

  if (title.includes('八段锦')) {
    data = {
      detailId: 'sports-baduanjin',
      title: '八段锦：柔和缓慢的养生功法',
      cover: '',
      tag: '传统体育',
      date: '2023-10-15',
      intro: '八段锦作为国家级非物质文化遗产，其动作柔和连绵，滑利流畅，不仅能强身健体，还能调节内脏功能。',
      section1Title: '功法介绍',
      section1Content: '“八段锦”之名，最早见于南宋洪迈所著《夷坚志》。它由八节动作组成，每一节动作都针对特定的脏腑或经络进行调理，犹如一幅绚丽多彩的锦缎，故名“八段锦”。',
      section2Title: '核心功效',
      section2Content: '第一式“两手托天理三焦”可理气化浊；第二式“左右开弓似射雕”能展宽胸膈，提升心肺功能。长期坚持练习，能有效改善现代人的亚健康状态，缓解肩颈酸痛。',
      hasPractice: true,
      videoUrl: ''
    };
  } else if (title.includes('百合雪梨汤')) {
    data = {
      detailId: 'food-soup',
      title: '秋季养生：如何制作传统百合雪梨汤',
      cover: '',
      tag: '传统饮食',
      date: '2023-10-10',
      intro: '结合《本草纲目》的记载，百合与雪梨的搭配不仅是传统的美味，更是秋季润肺的佳品。',
      section1Title: '食材说明',
      section1Content: '主料：秋月梨1个，鲜百合50克，枸杞少许，冰糖适量。百合甘凉清润，主入肺心，能清肺润燥、止咳平喘。雪梨则有生津润燥、清热化痰之效。',
      section2Title: '制作步骤',
      section2Content: '1. 雪梨洗净去核切块，百合洗净剥瓣。\n2. 将雪梨放入砂锅中，加适量清水，大火煮开后转小火炖20分钟。\n3. 加入百合和冰糖，继续炖煮10分钟。\n4. 关火前撒入枸杞即可。',
      hasPractice: false,
      videoUrl: ''
    };
  } else if (title.includes('针灸')) {
    data = {
      detailId: 'medicine-acupuncture',
      title: '中医针灸的神奇魅力',
      cover: '',
      tag: '传统医药',
      date: '2023-10-05',
      intro: '被列入联合国教科文组织人类非物质文化遗产代表作名录的针灸，是古人智慧的结晶。',
      section1Title: '原理介绍',
      section1Content: '针灸由“针”和“灸”两部分组成。针法是把毫针按一定穴位刺入患者体内，运用捻转与提插等针刺手法来治疗疾病；灸法则是把燃烧着的艾绒按一定穴位熏灼皮肤，利用热的刺激来治疗疾病。',
      section2Title: '适用范围',
      section2Content: '针灸广泛应用于颈肩腰腿痛、失眠、肠胃功能紊乱等多种常见病及疑难杂症。它通过疏通经络、调和阴阳，激发人体自身的自愈能力。',
      hasPractice: false,
      videoUrl: ''
    };
  } else if (title.includes('推拿')) {
    data = {
      detailId: 'medicine-tuina',
      title: '中医推拿',
      cover: '',
      tag: '传统医药',
      date: '2023-10-12',
      intro: '以人疗人，运用推、拿、提、捏、揉等手法，在人体经络穴位上进行治疗和保健。',
      section1Title: '原理介绍',
      section1Content: '推拿主要通过医者的双手在患者体表特定的部位或穴位上做特定的动作，以达到疏通经络、行气活血、理筋整复的作用。',
      section2Title: '适用范围',
      section2Content: '适用于颈椎病、腰间盘突出、关节扭伤等骨伤科疾病，也可用于缓解疲劳、改善睡眠。注意：饭后半小时内不宜进行。',
      hasPractice: false,
      videoUrl: ''
    };
  } else if (title.includes('五禽戏')) {
    data = {
      detailId: 'sports-wuqinxi',
      title: '五禽戏：华佗创编的导引养生功法',
      cover: '',
      tag: '传统体育',
      date: '2023-10-18',
      intro: '模仿虎、鹿、熊、猿、鸟五种动物的形态和神态，达到强身健体的目的。',
      section1Title: '功法介绍',
      section1Content: '五禽戏是东汉医学家华佗在总结前人经验的基础上，结合中医经络脏腑学说创编的一套医疗保健体操。',
      section2Title: '核心功效',
      section2Content: '虎戏威武扑动，主肝；鹿戏安详轻捷，主肾；熊戏沉稳厚重，主脾；猿戏机警敏捷，主心；鸟戏轻盈展翅，主肺。',
      hasPractice: true,
      videoUrl: ''
    };
  } else if (title.includes('太极')) {
    data = {
      detailId: 'sports-taiji',
      title: '太极拳：内外兼修的拳术',
      cover: '',
      tag: '传统体育',
      date: '2023-10-20',
      intro: '结合易经阴阳五行之变化，中医经络学说，是一种内外兼修、柔和、缓慢、轻灵的拳术。',
      section1Title: '功法介绍',
      section1Content: '太极拳以中国传统儒、道哲学中的太极、阴阳辩证理念为核心思想，集颐养性情、强身健体、技击对抗等多种功能为一体。',
      section2Title: '核心功效',
      section2Content: '练习太极拳要求心静用意、呼吸自然，动作柔和缓慢，能有效锻炼身体的平衡性、协调性，对慢性疾病有良好的康复作用。',
      hasPractice: true,
      videoUrl: ''
    };
  } else if (title.includes('茶')) {
    data = {
      detailId: 'food-tea',
      title: '非遗茶文化：修身养性的健康生活',
      cover: '',
      tag: '传统饮食',
      date: '2023-10-22',
      intro: '茶，发乎神农，闻于鲁周公。饮茶不仅是解渴，更是修身养性、清心雅志的健康生活方式。',
      section1Title: '文化内涵',
      section1Content: '中国茶文化糅合了儒、道、佛诸派思想，讲究“清、敬、和、寂”。从采茶、制茶到泡茶、品茶，每一步都蕴含着深厚的工艺与哲理。',
      section2Title: '养生功效',
      section2Content: '不同的茶有不同的茶性。如绿茶清热解毒，适合夏季；红茶温中驱寒，适合冬季；乌龙茶健胃消食。合理饮茶有助于抗氧化、降血脂。',
      hasPractice: false,
      videoUrl: ''
    };
  } else if (title.includes('古琴')) {
    data = {
      detailId: 'music-guqin',
      title: '古琴疗愈：静心安神的传统音乐',
      cover: '',
      tag: '传统音乐',
      date: '2023-10-25',
      intro: '古琴音色深沉、余音悠远，听之可平复情绪，适合现代人冥想放松与精神疗愈。',
      section1Title: '五音疗疾',
      section1Content: '中医认为，五音（角、徵、宫、商、羽）对应五脏（肝、心、脾、肺、肾）。古琴的音色频率与人体的生理节律产生共振，从而达到调和脏腑的作用。',
      section2Title: '冥想体验',
      section2Content: '在安静的环境中，闭上眼睛，聆听古琴曲《流水》或《平沙落雁》，深呼吸，感受音符在体内的流淌，能有效缓解现代生活带来的焦虑与压力。',
      hasPractice: false,
      videoUrl: ''
    };
  } else {
    data = {
      detailId: '',
      title,
      cover: '',
      tag: '非遗文化',
      date: '2023-10-24',
      intro: '探索中华传统非遗文化，守护身心健康。',
      section1Title: '文化传承',
      section1Content: '非物质文化遗产是人类智慧的结晶，承载着历史的记忆与民族的灵魂。',
      section2Title: '',
      section2Content: '',
      hasPractice: false,
      videoUrl: ''
    };
  }

  return data;
}

function getFallbackCampaignData(title) {
  return {
    title,
    cover: '',
    tag: '活动宣传',
    date: '2026-05-07',
    intro: '这里展示活动宣传的完整介绍内容。',
    section1Title: '活动介绍',
    section1Content: '这里可以填写活动背景、活动内容、参与方式等信息。',
    section2Title: '温馨提示',
    section2Content: '这里可以填写活动时间、报名方式、注意事项等。',
    hasPractice: false,
    videoUrl: ''
  };
}

Page({
  data: {
    isStarred: false,
    article: {
      id: '',
      contentType: 'heritage',
      detailId: '',
      title: '加载中...',
      cover: '',
      tag: '',
      date: '2023-10-24',
      intro: '',
      section1Title: '',
      section1Content: '',
      section2Title: '',
      section2Content: '',
      hasPractice: false,
      videoUrl: ''
    }
  },

  onLoad(options) {
    if (ensurePrivacyHomeLock(this, { allowAgreement: true })) {
      return;
    }
    const title = decodeURIComponent(options.title || '八段锦');
    const itemId = decodeURIComponent(options.itemId || '');
    const contentType = decodeURIComponent(options.contentType || 'heritage');
    this.loadArticleData({ title, itemId, contentType });
  },

  onShow() {
    ensurePrivacyHomeLock(this, { allowAgreement: true });
  },

  async loadArticleData({ title, itemId, contentType }) {
    const fallbackData = contentType === 'campaign'
      ? getFallbackCampaignData(title)
      : getFallbackArticleData(title);

    this.setData({
      article: {
        ...fallbackData,
        id: itemId || '',
        contentType,
        detailId: fallbackData.detailId || ''
      }
    });
    this.checkStarStatus();
    wx.setNavigationBarTitle({ title: contentType === 'campaign' ? '活动详情' : '非遗详情' });

    if (!wx.cloud) return;

    const db = wx.cloud.database();

    try {
      const collectionNames = contentType === 'campaign'
        ? ['campaign_contents']
        : ['heritage_contents', 'heritage_content'];

      const detailRes = await queryFirstAvailableCollection(db, collectionNames, async collection => {
        if (itemId) {
          try {
            return await collection.doc(itemId).get();
          } catch (error) {
            // Fallback to title query when the incoming itemId comes from local placeholder data.
          }
        }
        return collection.where({ title, status: true }).limit(1).get();
      });

      const cloudData = (detailRes.data && (Array.isArray(detailRes.data) ? detailRes.data[0] : detailRes.data)) || null;
      if (!cloudData) return;

      const article = {
        id: cloudData._id || itemId || '',
        contentType,
        detailId: cloudData.detailId || fallbackData.detailId || '',
        title: cloudData.title || fallbackData.title,
        cover: normalizeMediaValue(cloudData.cover) || fallbackData.cover,
        tag: cloudData.tag || (contentType === 'campaign' ? '活动宣传' : fallbackData.tag),
        date: cloudData.date || fallbackData.date,
        intro: cloudData.intro || cloudData.content || fallbackData.intro,
        section1Title: cloudData.section1Title || (contentType === 'campaign' ? '活动介绍' : fallbackData.section1Title),
        section1Content: cloudData.introduction || cloudData.section1Content || fallbackData.section1Content,
        section2Title: cloudData.section2Title || (contentType === 'campaign' ? '温馨提示' : fallbackData.section2Title),
        section2Content: cloudData.tips || cloudData.section2Content || fallbackData.section2Content,
        hasPractice: typeof cloudData.hasPractice === 'boolean' ? cloudData.hasPractice : fallbackData.hasPractice,
        videoUrl: normalizeMediaValue(cloudData.videoUrl) || fallbackData.videoUrl
      };

      this.setData({ article });
      this.checkStarStatus();
    } catch (error) {
      console.error('详情页云端内容加载失败：', error);
    }
  },

  async checkStarStatus() {
    const currentKey = this.getFavoriteKey(this.data.article);
    if (!currentKey) {
      this.setData({ isStarred: false });
      return;
    }

    const cachedFavorites = getContentFavoritesCache();
    const cachedStarred = cachedFavorites.some(item => item.favoriteKey === currentKey);
    this.setData({ isStarred: cachedStarred });

    if (!wx.cloud) return;

    try {
      const cloudStarred = await checkContentFavoriteInCloud(currentKey);
      this.setData({ isStarred: cloudStarred });
    } catch (error) {
      console.error('检查云端收藏状态失败：', error);
    }
  },

  getFavoriteKey(item) {
    return buildFavoriteKey(item);
  },

  async toggleStar() {
    const { privacyState, isLoggedIn } = getAccessSummary();
    if (privacyState.browseOnly || !privacyState.accepted) {
      wx.showToast({
        title: '仅完整功能模式下可收藏',
        icon: 'none'
      });
      return;
    }

    if (!isLoggedIn) {
      wx.showModal({
        title: '登录后可收藏',
        content: '内容收藏需要登录后使用，是否前往个人中心登录？',
        confirmText: '去登录',
        success: res => {
          if (!res.confirm) return;
          wx.switchTab({
            url: '/pages/profile/profile'
          });
        }
      });
      return;
    }

    const isStarred = !this.data.isStarred;
    const currentItem = {
      ...this.data.article,
      favoriteKey: this.getFavoriteKey(this.data.article)
    };

    wx.showLoading({ title: isStarred ? '收藏中...' : '取消中...' });

    try {
      if (isStarred) {
        await saveContentFavoriteToCloud(currentItem);
      } else {
        await removeContentFavoriteFromCloud(currentItem.favoriteKey);
      }

      this.setData({ isStarred });
      wx.showToast({
        title: isStarred ? '已加入收藏' : '已取消收藏',
        icon: 'success'
      });
    } catch (error) {
      console.error('切换内容收藏失败：', error);
      wx.showToast({
        title: '收藏同步失败，请稍后重试',
        icon: 'none'
      });
    } finally {
      wx.hideLoading();
    }
  },

  goToVideo() {
    const finalUrl = this.data.article.videoUrl;

    if (!finalUrl) {
      wx.showToast({
        title: this.data.article.contentType === 'campaign' ? '该活动暂无视频内容' : '该项目暂无视频教程',
        icon: 'none'
      });
      return;
    }

    wx.navigateTo({
      url: `/pages/video-play/video-play?url=${encodeURIComponent(finalUrl)}&title=${encodeURIComponent(this.data.article.title || '')}&cover=${encodeURIComponent(this.data.article.cover || '')}`
    });
  },

  startPractice() {
    wx.showToast({
      title: '打卡功能开发中',
      icon: 'none'
    });
  },

  askAI() {
    wx.switchTab({
      url: '/pages/ai/ai'
    });
  }
})
