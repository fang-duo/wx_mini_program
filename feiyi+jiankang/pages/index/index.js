function normalizeMediaValue(value) {
  if (!value) return '';
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) return normalizeMediaValue(value[0]);
  if (typeof value === 'object') {
    return value.url || value.src || value.tempFileURL || value.download_url || value.fileID || value.cloudID || '';
  }
  return '';
}

function normalizeBooleanValue(value) {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value === 1;
  if (typeof value === 'string') {
    return ['true', '1', 'yes', 'on'].includes(value.trim().toLowerCase());
  }
  return false;
}

function getTimeValue(value) {
  if (!value) return 0;
  if (value instanceof Date) return value.getTime();
  if (typeof value === 'number') return value;
  const parsed = new Date(value).getTime();
  return Number.isNaN(parsed) ? 0 : parsed;
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

const FIXED_CATEGORIES = [
  { id: 'sports', name: '传统体育', iconText: '武' },
  { id: 'food', name: '传统饮食', iconText: '食' },
  { id: 'medicine', name: '传统医药', iconText: '医' },
  { id: 'music', name: '传统音乐', iconText: '乐' }
];

Page({
  data: {
    banners: [],
    categories: [],
    articles: [],
    dailyRecommend: null,
    loadingHomeContent: true
  },

  onLoad() {
    this.loadHomeContent();
  },

  async loadHomeContent() {
    const fallbackBanners = [
      { id: 1, img: '/images/banner1.png', title: '探寻古老体育，传承民族健康' },
      { id: 2, img: '/images/banner2.png', title: '药食同源：传统饮食中的养生之道' },
      { id: 3, img: '/images/banner3.png', title: '非遗古乐与身心疗愈' }
    ];

    const fallbackArticles = [
      {
        id: 1,
        title: '二十四节气养生宣传周',
        desc: '围绕节气与非遗养生展开宣传活动，持续推出图文和视频内容。',
        cover: '/images/baduanjin.png',
        tag: '活动宣传',
        date: '2026-05-07',
        contentType: 'campaign'
      }
    ];

    const fallbackDailyRecommend = {
      id: 'fallback-baduanjin',
      title: '八段锦',
      summary: '八段锦作为国家级非物质文化遗产，动作柔和连绵，适合作为日常养生练习。',
      contentType: 'heritage'
    };

    this.setData({
      banners: fallbackBanners,
      categories: FIXED_CATEGORIES,
      articles: fallbackArticles,
      dailyRecommend: fallbackDailyRecommend
    });

    if (!wx.cloud) {
      this.setData({ loadingHomeContent: false });
      return;
    }

    const db = wx.cloud.database();

    try {
      const [campaignRes, heritageRes] = await Promise.all([
        queryFirstAvailableCollection(db, ['campaign_contents'], collection =>
          collection.where({ status: true }).orderBy('sort', 'asc').get()
        ),
        queryFirstAvailableCollection(db, ['heritage_contents', 'heritage_content'], collection =>
          collection.get()
        )
      ]);

      const campaignItems = (campaignRes.data || []).map(item => ({
        id: item._id || item.id,
        title: item.title || '',
        desc: item.summary || '',
        cover: normalizeMediaValue(item.cover),
        tag: '活动宣传',
        date: item.date || '',
        contentType: 'campaign',
        showInBanner: !!item.showInBanner,
        bannerSort: typeof item.bannerSort === 'number' ? item.bannerSort : 999
      })).filter(item => item.title);

      const banners = campaignItems
        .filter(item => item.showInBanner && item.cover)
        .sort((a, b) => (a.bannerSort - b.bannerSort) || 0)
        .map(item => ({
          id: item.id,
          img: item.cover,
          title: item.title,
          itemId: item.id,
          contentType: 'campaign'
        }));

      const heritageSource = (heritageRes.data || [])
        .filter(item => (typeof item.status === 'boolean' ? item.status : true));

      const heritageItems = heritageSource
        .slice()
        .sort((a, b) => {
          const aSort = typeof a.sort === 'number' ? a.sort : 999;
          const bSort = typeof b.sort === 'number' ? b.sort : 999;
          return aSort - bSort;
        })
        .map(item => ({
          id: item._id || item.id,
          title: item.title || '',
          summary: item.summary || '',
          contentType: 'heritage',
          sort: typeof item.sort === 'number' ? item.sort : 999,
          isDailyRecommend: normalizeBooleanValue(item.isDailyRecommend),
          showOnHome: normalizeBooleanValue(item.showOnHome),
          updateTime: item.updateTime || item._updateTime || item.updatedAt || item.createTime || ''
        }))
        .filter(item => item.title);

      const dailyRecommendCandidates = heritageItems
        .filter(item => item.isDailyRecommend)
        .sort((a, b) => {
          const timeDiff = getTimeValue(b.updateTime) - getTimeValue(a.updateTime);
          if (timeDiff !== 0) return timeDiff;
          return (a.sort || 999) - (b.sort || 999);
        });

      const homeRecommendCandidates = heritageItems
        .filter(item => item.showOnHome)
        .sort((a, b) => {
          const timeDiff = getTimeValue(b.updateTime) - getTimeValue(a.updateTime);
          if (timeDiff !== 0) return timeDiff;
          return (a.sort || 999) - (b.sort || 999);
        });

      const dailyRecommend =
        dailyRecommendCandidates[0] ||
        homeRecommendCandidates[0] ||
        fallbackDailyRecommend;

      this.setData({
        banners: banners.length ? banners : fallbackBanners,
        categories: FIXED_CATEGORIES,
        articles: campaignItems.length ? campaignItems : fallbackArticles,
        dailyRecommend,
        loadingHomeContent: false
      });
    } catch (error) {
      console.error('首页云端内容加载失败：', error);
      this.setData({ loadingHomeContent: false });
    }
  },

  goToCategory(e) {
    const id = e.currentTarget.dataset.id;
    wx.navigateTo({
      url: `/pages/category/category?id=${id}`
    });
  },

  goToDetail(e) {
    const title = e.currentTarget.dataset.title || '';
    const itemId = e.currentTarget.dataset.itemId || '';
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
