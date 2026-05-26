const { LOCAL_KEYS } = require('./dataSync');

const PRIVACY_STATE_KEY = 'privacy_state';
const PRIVACY_VERSION = '2026-05-26';
let lastPrivacyToastTime = 0;

function getDefaultPrivacyState() {
  return {
    version: PRIVACY_VERSION,
    hasResponded: false,
    accepted: false,
    browseOnly: false
  };
}

function normalizePrivacyState(value) {
  const defaults = getDefaultPrivacyState();

  if (!value || typeof value !== 'object') {
    return defaults;
  }

  if (value.version !== PRIVACY_VERSION) {
    return defaults;
  }

  return {
    version: PRIVACY_VERSION,
    hasResponded: !!value.hasResponded,
    accepted: !!value.accepted,
    browseOnly: !!value.browseOnly
  };
}

function getPrivacyState() {
  return normalizePrivacyState(wx.getStorageSync(PRIVACY_STATE_KEY));
}

function setPrivacyState(nextState) {
  const defaults = getDefaultPrivacyState();
  const mergedState = {
    ...defaults,
    ...nextState,
    version: PRIVACY_VERSION
  };

  wx.setStorageSync(PRIVACY_STATE_KEY, mergedState);
  syncGlobalAccessState();
  return mergedState;
}

function getCachedUserInfo() {
  const userInfo = wx.getStorageSync(LOCAL_KEYS.USER_INFO);
  if (!userInfo || typeof userInfo !== 'object') {
    return null;
  }
  return userInfo;
}

function isValidLoggedInUser(userInfo) {
  return !!(
    userInfo &&
    typeof userInfo === 'object' &&
    (
      userInfo.loggedIn ||
      userInfo.openid ||
      userInfo.nickname
    )
  );
}

function isLoggedIn() {
  const app = typeof getApp === 'function' ? getApp() : null;
  const appUserInfo = app && app.globalData ? app.globalData.userInfo : null;

  if (app && app.globalData && app.globalData.isLoggedIn) {
    return true;
  }

  if (isValidLoggedInUser(appUserInfo)) {
    return true;
  }

  return isValidLoggedInUser(getCachedUserInfo());
}

function syncGlobalAccessState() {
  const app = typeof getApp === 'function' ? getApp() : null;
  const privacyState = getPrivacyState();
  const cachedUserInfo = getCachedUserInfo();
  const loggedIn = isValidLoggedInUser(cachedUserInfo);
  const userInfo = loggedIn
    ? {
        openid: cachedUserInfo.openid || '',
        nickname: cachedUserInfo.nickname || '',
        avatarUrl: cachedUserInfo.avatarUrl || '',
        _id: cachedUserInfo._id || '',
        loggedIn: true
      }
    : {
        openid: '',
        nickname: '',
        avatarUrl: ''
      };

  if (app && app.globalData) {
    app.globalData.isLoggedIn = loggedIn;
    app.globalData.userInfo = userInfo;
    app.globalData.privacyAccepted = privacyState.hasResponded && privacyState.accepted && !privacyState.browseOnly;
    app.globalData.isBrowseOnly = privacyState.browseOnly;
  }

  return {
    privacyState,
    loggedIn,
    userInfo
  };
}

function getAccessSummary() {
  const { privacyState, loggedIn, userInfo } = syncGlobalAccessState();

  return {
    privacyState,
    isLoggedIn: loggedIn,
    userInfo,
    canUseFullFeatures: privacyState.hasResponded && privacyState.accepted && !privacyState.browseOnly,
    isBrowseOnly: privacyState.browseOnly
  };
}

function ensurePrivacyHomeLock(page, options = {}) {
  const privacyState = getPrivacyState();
  if (privacyState.hasResponded) {
    return false;
  }

  const route = options.route || (page && page.route) || '';
  const allowAgreement = !!options.allowAgreement;
  const showToast = options.showToast !== false;

  if (route === 'pages/index/index') {
    return false;
  }

  if (allowAgreement && route === 'pages/agreement/agreement') {
    return false;
  }

  if (showToast) {
    const now = Date.now();
    if (now - lastPrivacyToastTime > 1200) {
      lastPrivacyToastTime = now;
      wx.showToast({
        title: '请先在首页选择是否同意隐私政策',
        icon: 'none',
        duration: 1800
      });
    }
  }

  setTimeout(() => {
    wx.switchTab({
      url: '/pages/index/index'
    });
  }, 0);

  return true;
}

module.exports = {
  PRIVACY_STATE_KEY,
  PRIVACY_VERSION,
  getDefaultPrivacyState,
  getPrivacyState,
  setPrivacyState,
  getCachedUserInfo,
  isLoggedIn,
  syncGlobalAccessState,
  getAccessSummary,
  ensurePrivacyHomeLock
};
