const LOCAL_KEYS = {
  USER_INFO: 'local_user_info',
  APP_PREFERENCES: 'app_preferences',
  CONTENT_FAVORITES: 'favorites',
  CHECKIN_GOALS: 'checkin_goals',
  CHECKIN_HISTORY: 'checkin_history',
  EXIT_REMIND_DISABLED: 'ai_exit_remind_disabled',
  LOGS: 'logs'
};

const COLLECTIONS = {
  USERS: 'users',
  USER_SETTINGS: 'user_settings',
  CONTENT_FAVORITES: 'content_favorites',
  CHECKIN_RECORDS: 'checkin_records',
  AI_FAVORITES: 'ai_favorites'
};

const DEFAULT_APP_PREFERENCES = {
  notify: true
};

function getDb() {
  if (!wx.cloud) return null;
  return wx.cloud.database();
}

async function getCurrentUserContext() {
  if (!wx.cloud) {
    return {
      openid: '',
      userInfo: null
    };
  }

  const app = typeof getApp === 'function' ? getApp() : null;
  if (app && app.globalData && app.globalData.openid) {
    return {
      openid: app.globalData.openid,
      userInfo: app.globalData.userInfo || null
    };
  }

  const res = await wx.cloud.callFunction({
    name: 'login'
  });
  const result = res && res.result ? res.result : {};
  const openid = result.openid || '';
  const userInfo = result.userInfo || null;

  if (app && app.globalData) {
    app.globalData.openid = openid;
    if (userInfo) {
      app.globalData.userInfo = {
        ...app.globalData.userInfo,
        ...userInfo
      };
    }
  }

  return {
    openid,
    userInfo
  };
}

async function getCurrentOpenId() {
  const context = await getCurrentUserContext();
  return context.openid || '';
}

function getStorage(key, fallbackValue) {
  const value = wx.getStorageSync(key);
  if (typeof value === 'undefined' || value === null || value === '') {
    return fallbackValue;
  }
  return value;
}

function setStorage(key, value) {
  wx.setStorageSync(key, value);
  return value;
}

function removeStorageKeys(keys) {
  (keys || []).forEach(key => {
    wx.removeStorageSync(key);
  });
}

function buildFavoriteKey(item) {
  return `${item.contentType || 'heritage'}::${item.id || item.detailId || item.title || ''}`;
}

function normalizeContentFavorite(item) {
  return {
    _id: item._id || '',
    id: item.contentId || item.id || '',
    contentType: item.contentType || 'heritage',
    detailId: item.detailId || '',
    title: item.title || '',
    cover: item.cover || '',
    tag: item.tag || '',
    date: item.date || '',
    intro: item.intro || '',
    favoriteKey: item.favoriteKey || buildFavoriteKey(item)
  };
}

function getContentFavoritesCache() {
  const favorites = getStorage(LOCAL_KEYS.CONTENT_FAVORITES, []);
  return Array.isArray(favorites) ? favorites.map(normalizeContentFavorite) : [];
}

function setContentFavoritesCache(favorites) {
  const normalizedFavorites = (favorites || []).map(normalizeContentFavorite);
  return setStorage(LOCAL_KEYS.CONTENT_FAVORITES, normalizedFavorites);
}

function upsertContentFavoriteCache(item) {
  const currentKey = buildFavoriteKey(item);
  const nextItem = normalizeContentFavorite({
    ...item,
    favoriteKey: currentKey
  });
  const favorites = getContentFavoritesCache().filter(favorite => favorite.favoriteKey !== currentKey);
  favorites.unshift(nextItem);
  setContentFavoritesCache(favorites);
  return favorites;
}

function removeContentFavoriteCache(favoriteKey) {
  const favorites = getContentFavoritesCache().filter(item => item.favoriteKey !== favoriteKey);
  setContentFavoritesCache(favorites);
  return favorites;
}

async function fetchContentFavoritesFromCloud() {
  const db = getDb();
  if (!db) return getContentFavoritesCache();

  const openid = await getCurrentOpenId();
  if (!openid) return getContentFavoritesCache();

  const res = await db.collection(COLLECTIONS.CONTENT_FAVORITES)
    .where({ openid })
    .orderBy('createTime', 'desc')
    .get();
  const favorites = (res.data || []).map(normalizeContentFavorite);
  setContentFavoritesCache(favorites);
  return favorites;
}

async function checkContentFavoriteInCloud(favoriteKey) {
  const db = getDb();
  if (!db) {
    return getContentFavoritesCache().some(item => item.favoriteKey === favoriteKey);
  }

  const openid = await getCurrentOpenId();
  if (!openid) {
    return getContentFavoritesCache().some(item => item.favoriteKey === favoriteKey);
  }

  const res = await db.collection(COLLECTIONS.CONTENT_FAVORITES)
    .where({ openid, favoriteKey })
    .limit(1)
    .get();
  return !!(res.data && res.data.length);
}

async function saveContentFavoriteToCloud(article) {
  const db = getDb();
  const favoriteKey = buildFavoriteKey(article);
  const favoriteItem = normalizeContentFavorite({
    ...article,
    favoriteKey,
    contentId: article.id || ''
  });

  if (!db) {
    upsertContentFavoriteCache(favoriteItem);
    return favoriteItem;
  }

  const openid = await getCurrentOpenId();
  if (!openid) {
    upsertContentFavoriteCache(favoriteItem);
    return favoriteItem;
  }

  const existed = await db.collection(COLLECTIONS.CONTENT_FAVORITES)
    .where({ openid, favoriteKey })
    .limit(1)
    .get();

  if (existed.data && existed.data.length) {
    const docId = existed.data[0]._id;
    await db.collection(COLLECTIONS.CONTENT_FAVORITES).doc(docId).update({
      data: {
        contentId: favoriteItem.id,
        contentType: favoriteItem.contentType,
        detailId: favoriteItem.detailId,
        title: favoriteItem.title,
        cover: favoriteItem.cover,
        tag: favoriteItem.tag,
        date: favoriteItem.date,
        intro: favoriteItem.intro,
        openid,
        favoriteKey,
        updateTime: db.serverDate()
      }
    });
    favoriteItem._id = docId;
  } else {
    const addRes = await db.collection(COLLECTIONS.CONTENT_FAVORITES).add({
      data: {
        contentId: favoriteItem.id,
        contentType: favoriteItem.contentType,
        detailId: favoriteItem.detailId,
        title: favoriteItem.title,
        cover: favoriteItem.cover,
        tag: favoriteItem.tag,
        date: favoriteItem.date,
        intro: favoriteItem.intro,
        openid,
        favoriteKey,
        createTime: db.serverDate(),
        updateTime: db.serverDate()
      }
    });
    favoriteItem._id = addRes._id;
  }

  upsertContentFavoriteCache(favoriteItem);
  return favoriteItem;
}

async function removeContentFavoriteFromCloud(favoriteKey) {
  const db = getDb();
  if (!db) {
    removeContentFavoriteCache(favoriteKey);
    return;
  }

  const openid = await getCurrentOpenId();
  if (!openid) {
    removeContentFavoriteCache(favoriteKey);
    return;
  }

  const existed = await db.collection(COLLECTIONS.CONTENT_FAVORITES)
    .where({ openid, favoriteKey })
    .limit(1)
    .get();

  if (existed.data && existed.data.length) {
    await db.collection(COLLECTIONS.CONTENT_FAVORITES).doc(existed.data[0]._id).remove();
  }

  removeContentFavoriteCache(favoriteKey);
}

async function loadUserInfoFromCloud() {
  const context = await getCurrentUserContext();
  return context.userInfo || null;
}

async function getUserSettingsDoc() {
  const db = getDb();
  if (!db) return null;

  const openid = await getCurrentOpenId();
  if (!openid) return null;

  const res = await db.collection(COLLECTIONS.USER_SETTINGS)
    .where({ openid })
    .limit(1)
    .get();
  if (!res.data || !res.data.length) return null;
  return res.data[0];
}

function normalizeAppPreferences(preferences) {
  return {
    notify: typeof preferences?.notify === 'boolean'
      ? preferences.notify
      : DEFAULT_APP_PREFERENCES.notify
  };
}

function getAppPreferencesCache() {
  return normalizeAppPreferences(getStorage(LOCAL_KEYS.APP_PREFERENCES, DEFAULT_APP_PREFERENCES));
}

function setAppPreferencesCache(preferences) {
  const nextPreferences = normalizeAppPreferences(preferences);
  setStorage(LOCAL_KEYS.APP_PREFERENCES, nextPreferences);
  return nextPreferences;
}

async function saveUserSettingsPatch(patchData) {
  const db = getDb();
  if (!db) return false;

  const openid = await getCurrentOpenId();
  if (!openid) return false;

  const settingsDoc = await getUserSettingsDoc();
  if (settingsDoc && settingsDoc._id) {
    await db.collection(COLLECTIONS.USER_SETTINGS).doc(settingsDoc._id).update({
      data: {
        ...patchData,
        updateTime: db.serverDate()
      }
    });
  } else {
    await db.collection(COLLECTIONS.USER_SETTINGS).add({
      data: {
        openid,
        ...patchData,
        createTime: db.serverDate(),
        updateTime: db.serverDate()
      }
    });
  }
  return true;
}

async function loadAppPreferencesFromCloud() {
  const settingsDoc = await getUserSettingsDoc();
  if (!settingsDoc || !settingsDoc.appPreferences) return null;

  const preferences = normalizeAppPreferences(settingsDoc.appPreferences);
  setAppPreferencesCache(preferences);
  return preferences;
}

async function saveAppPreferencesToCloud(preferences) {
  const nextPreferences = normalizeAppPreferences(preferences);
  const saved = await saveUserSettingsPatch({
    appPreferences: nextPreferences
  });

  if (saved) {
    setAppPreferencesCache(nextPreferences);
  }

  return saved;
}

async function loadCheckinGoalsFromCloud() {
  const settingsDoc = await getUserSettingsDoc();
  return settingsDoc && settingsDoc.checkinGoals ? settingsDoc.checkinGoals : null;
}

async function saveCheckinGoalsToCloud(goals) {
  return saveUserSettingsPatch({
    checkinGoals: goals
  });
}

function buildAiFavoriteKey(question, answer) {
  return `${String(question || '').trim()}::${String(answer || '').trim()}`;
}

function getMonthDateRange(year, month) {
  const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
  const endDate = `${year}-${String(month).padStart(2, '0')}-${String(new Date(year, month, 0).getDate()).padStart(2, '0')}`;
  return { startDate, endDate };
}

async function loadCheckinRecordsFromCloud(options = {}) {
  const db = getDb();
  if (!db) return [];

  const openid = await getCurrentOpenId();
  if (!openid) return [];

  const _ = db.command;
  const { year, month } = options;
  let query = db.collection(COLLECTIONS.CHECKIN_RECORDS).where({ openid });

  if (year && month) {
    const { startDate, endDate } = getMonthDateRange(year, month);
    query = db.collection(COLLECTIONS.CHECKIN_RECORDS).where({
      openid,
      date: _.gte(startDate).and(_.lte(endDate))
    });
  }

  const res = await query.orderBy('date', 'asc').get();
  return res.data || [];
}

async function saveCheckinRecordToCloud(record) {
  const db = getDb();
  if (!db) return false;

  const openid = await getCurrentOpenId();
  if (!openid) return false;

  const existed = await db.collection(COLLECTIONS.CHECKIN_RECORDS)
    .where({
      openid,
      date: record.date
    })
    .limit(1)
    .get();

  if (existed.data && existed.data.length) {
    await db.collection(COLLECTIONS.CHECKIN_RECORDS).doc(existed.data[0]._id).update({
      data: {
        ...record,
        openid,
        updateTime: db.serverDate()
      }
    });
    return true;
  }

  await db.collection(COLLECTIONS.CHECKIN_RECORDS).add({
    data: {
      ...record,
      openid,
      createTime: db.serverDate(),
      updateTime: db.serverDate()
    }
  });
  return true;
}

async function loadAiFavoritesFromCloud() {
  const db = getDb();
  if (!db) return [];

  const openid = await getCurrentOpenId();
  if (!openid) return [];

  const res = await db.collection(COLLECTIONS.AI_FAVORITES)
    .where({ openid })
    .orderBy('createTime', 'desc')
    .get();

  return (res.data || []).map(item => ({
    ...item,
    favoriteKey: item.favoriteKey || buildAiFavoriteKey(item.question, item.answer)
  }));
}

async function saveAiFavoritesToCloud(pairs) {
  const db = getDb();
  if (!db) return [];

  const openid = await getCurrentOpenId();
  if (!openid) return [];

  const results = await Promise.all((pairs || []).map(async item => {
    const favoriteKey = buildAiFavoriteKey(item.question, item.answer);
    const existed = await db.collection(COLLECTIONS.AI_FAVORITES)
      .where({ openid, favoriteKey })
      .limit(1)
      .get();

    if (existed.data && existed.data.length) {
      return {
        _id: existed.data[0]._id,
        favoriteKey,
        duplicated: true
      };
    }

    const addRes = await db.collection(COLLECTIONS.AI_FAVORITES).add({
      data: {
        openid,
        favoriteKey,
        question: item.question,
        answer: item.answer,
        source: 'ai_chat',
        createTime: db.serverDate()
      }
    });

    return {
      _id: addRes._id,
      favoriteKey,
      duplicated: false
    };
  }));

  return results;
}

async function removeAiFavoritesByIds(ids) {
  const db = getDb();
  if (!db || !Array.isArray(ids) || !ids.length) return 0;

  const openid = await getCurrentOpenId();
  if (!openid) return 0;

  const _ = db.command;
  const res = await db.collection(COLLECTIONS.AI_FAVORITES)
    .where({
      openid,
      _id: _.in(ids)
    })
    .get();

  const removableItems = res.data || [];
  await Promise.all(
    removableItems.map(item => db.collection(COLLECTIONS.AI_FAVORITES).doc(item._id).remove())
  );
  return removableItems.length;
}

function getAppCacheKeys() {
  return [
    LOCAL_KEYS.APP_PREFERENCES,
    LOCAL_KEYS.CONTENT_FAVORITES,
    LOCAL_KEYS.CHECKIN_GOALS,
    LOCAL_KEYS.CHECKIN_HISTORY,
    LOCAL_KEYS.EXIT_REMIND_DISABLED,
    LOCAL_KEYS.LOGS
  ];
}

function getUserSessionCacheKeys() {
  return [
    LOCAL_KEYS.USER_INFO,
    LOCAL_KEYS.APP_PREFERENCES,
    LOCAL_KEYS.CONTENT_FAVORITES,
    LOCAL_KEYS.CHECKIN_GOALS,
    LOCAL_KEYS.CHECKIN_HISTORY
  ];
}

function clearAppCache() {
  removeStorageKeys(getAppCacheKeys());
}

function clearUserSessionCache() {
  removeStorageKeys(getUserSessionCacheKeys());
}

function getCacheSizeBytes(keys) {
  return (keys || []).reduce((total, key) => {
    const value = wx.getStorageSync(key);
    if (typeof value === 'undefined' || value === null || value === '') {
      return total;
    }

    try {
      return total + JSON.stringify(value).length * 2;
    } catch (error) {
      return total;
    }
  }, 0);
}

function formatBytes(bytes) {
  if (!bytes) return '0.0KB';
  if (bytes < 1024) return `${bytes}B`;

  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(1)}KB`;
  return `${(kb / 1024).toFixed(1)}MB`;
}

module.exports = {
  LOCAL_KEYS,
  DEFAULT_APP_PREFERENCES,
  buildFavoriteKey,
  buildAiFavoriteKey,
  getCurrentOpenId,
  getAppPreferencesCache,
  setAppPreferencesCache,
  getContentFavoritesCache,
  setContentFavoritesCache,
  fetchContentFavoritesFromCloud,
  checkContentFavoriteInCloud,
  saveContentFavoriteToCloud,
  removeContentFavoriteFromCloud,
  loadUserInfoFromCloud,
  loadAppPreferencesFromCloud,
  saveAppPreferencesToCloud,
  loadCheckinGoalsFromCloud,
  saveCheckinGoalsToCloud,
  loadCheckinRecordsFromCloud,
  saveCheckinRecordToCloud,
  loadAiFavoritesFromCloud,
  saveAiFavoritesToCloud,
  removeAiFavoritesByIds,
  getAppCacheKeys,
  clearAppCache,
  clearUserSessionCache,
  getCacheSizeBytes,
  formatBytes
};
