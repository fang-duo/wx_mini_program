const cloud = require('wx-server-sdk');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

const db = cloud.database();

const DEFAULT_COLLECTIONS = [
  'users',
  'user_settings',
  'checkin_records',
  'ai_favorites',
  'content_favorites'
];

const MAX_PAGE_SIZE = 100;

function normalizeTime(value) {
  if (!value) return 0;
  if (value instanceof Date) return value.getTime();
  if (typeof value === 'number') return value;
  if (typeof value === 'string') {
    const time = new Date(value).getTime();
    return Number.isNaN(time) ? 0 : time;
  }
  if (value && typeof value.toDate === 'function') {
    const date = value.toDate();
    return date instanceof Date ? date.getTime() : 0;
  }
  if (value && typeof value === 'object' && value.$date) {
    const time = new Date(value.$date).getTime();
    return Number.isNaN(time) ? 0 : time;
  }
  return 0;
}

function getDocRank(doc) {
  return Math.max(
    normalizeTime(doc.updateTime),
    normalizeTime(doc.createTime),
    normalizeTime(doc._updateTime),
    normalizeTime(doc._createTime)
  );
}

function sortDocsByRank(docs) {
  return [...docs].sort((a, b) => {
    const rank = getDocRank(b) - getDocRank(a);
    if (rank !== 0) return rank;
    return String(b._id || '').localeCompare(String(a._id || ''));
  });
}

function extractOpenId(doc) {
  return doc.openid || doc._openid || '';
}

function buildAiFavoriteKey(doc) {
  const question = String(doc.question || '').trim();
  const answer = String(doc.answer || '').trim();
  return `${question}::${answer}`;
}

function buildContentFavoriteKey(doc) {
  const contentType = doc.contentType || 'heritage';
  const rawId = doc.contentId || doc.id || doc.detailId || doc.title || '';
  return `${contentType}::${rawId}`;
}

function cloneValue(value) {
  if (typeof value === 'undefined') return undefined;
  return JSON.parse(JSON.stringify(value));
}

function isSameValue(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function pushUpdate(operations, collection, docId, data, reason) {
  if (!docId || !data || !Object.keys(data).length) return;
  operations.push({
    type: 'update',
    collection,
    docId,
    data,
    reason
  });
}

function pushRemove(operations, collection, docId, reason) {
  if (!docId) return;
  operations.push({
    type: 'remove',
    collection,
    docId,
    reason
  });
}

async function fetchAllDocuments(collectionName, pageSize) {
  const limit = Math.min(Math.max(pageSize || MAX_PAGE_SIZE, 1), MAX_PAGE_SIZE);
  const docs = [];
  let skip = 0;

  while (true) {
    const res = await db.collection(collectionName).skip(skip).limit(limit).get();
    const batch = res.data || [];
    docs.push(...batch);
    if (batch.length < limit) break;
    skip += batch.length;
  }

  return docs;
}

function analyzeUsers(docs) {
  const operations = [];
  const warnings = [];
  const groups = {};

  docs.forEach(doc => {
    const openid = extractOpenId(doc);
    if (!openid) {
      warnings.push(`users:${doc._id} 缺少 openid/_openid，已跳过`);
      return;
    }

    if (!groups[openid]) groups[openid] = [];
    groups[openid].push(doc);

    if (!doc.openid && doc._openid) {
      pushUpdate(operations, 'users', doc._id, { openid: doc._openid }, '回填 openid 字段');
    }
  });

  Object.keys(groups).forEach(openid => {
    const items = sortDocsByRank(groups[openid]);
    if (items.length <= 1) return;

    const primary = items[0];
    const rest = items.slice(1);
    const mergedNickname = primary.nickname || rest.find(item => item.nickname)?.nickname || '';
    const mergedAvatarUrl = primary.avatarUrl || rest.find(item => item.avatarUrl)?.avatarUrl || '';
    const updateData = {};

    if (mergedNickname !== (primary.nickname || '')) {
      updateData.nickname = mergedNickname;
    }
    if (mergedAvatarUrl !== (primary.avatarUrl || '')) {
      updateData.avatarUrl = mergedAvatarUrl;
    }
    if (!primary.openid) {
      updateData.openid = openid;
    }

    pushUpdate(operations, 'users', primary._id, updateData, '合并重复用户资料');
    rest.forEach(item => {
      pushRemove(operations, 'users', item._id, `删除重复用户资料，保留 ${primary._id}`);
    });
  });

  return {
    collection: 'users',
    totalDocs: docs.length,
    warnings,
    operations
  };
}

function analyzeUserSettings(docs) {
  const operations = [];
  const warnings = [];
  const groups = {};

  docs.forEach(doc => {
    const openid = extractOpenId(doc);
    if (!openid) {
      warnings.push(`user_settings:${doc._id} 缺少 openid/_openid，已跳过`);
      return;
    }

    if (!groups[openid]) groups[openid] = [];
    groups[openid].push(doc);

    if (!doc.openid && doc._openid) {
      pushUpdate(operations, 'user_settings', doc._id, { openid: doc._openid }, '回填 openid 字段');
    }
  });

  Object.keys(groups).forEach(openid => {
    const items = sortDocsByRank(groups[openid]);
    if (items.length <= 1) return;

    const primary = items[0];
    const rest = items.slice(1);
    const mergedAppPreferences = cloneValue(
      primary.appPreferences || rest.find(item => item.appPreferences)?.appPreferences
    );
    const mergedCheckinGoals = cloneValue(
      primary.checkinGoals || rest.find(item => item.checkinGoals)?.checkinGoals
    );
    const updateData = {};

    if (typeof mergedAppPreferences !== 'undefined' && !isSameValue(primary.appPreferences, mergedAppPreferences)) {
      updateData.appPreferences = mergedAppPreferences;
    }
    if (typeof mergedCheckinGoals !== 'undefined' && !isSameValue(primary.checkinGoals, mergedCheckinGoals)) {
      updateData.checkinGoals = mergedCheckinGoals;
    }
    if (!primary.openid) {
      updateData.openid = openid;
    }

    pushUpdate(operations, 'user_settings', primary._id, updateData, '合并重复用户设置');
    rest.forEach(item => {
      pushRemove(operations, 'user_settings', item._id, `删除重复设置，保留 ${primary._id}`);
    });
  });

  return {
    collection: 'user_settings',
    totalDocs: docs.length,
    warnings,
    operations
  };
}

function analyzeCheckinRecords(docs) {
  const operations = [];
  const warnings = [];
  const groups = {};

  docs.forEach(doc => {
    const openid = extractOpenId(doc);
    if (!openid || !doc.date) {
      warnings.push(`checkin_records:${doc._id} 缺少 openid/date，已跳过`);
      return;
    }

    const recordKey = `${openid}::${doc.date}`;
    if (!groups[recordKey]) groups[recordKey] = [];
    groups[recordKey].push(doc);

    if (!doc.openid && doc._openid) {
      pushUpdate(operations, 'checkin_records', doc._id, { openid: doc._openid }, '回填 openid 字段');
    }
  });

  Object.keys(groups).forEach(recordKey => {
    const items = sortDocsByRank(groups[recordKey]);
    if (items.length <= 1) return;

    const primary = items[0];
    items.slice(1).forEach(item => {
      pushRemove(operations, 'checkin_records', item._id, `删除重复打卡记录，保留 ${primary._id}`);
    });
  });

  return {
    collection: 'checkin_records',
    totalDocs: docs.length,
    warnings,
    operations
  };
}

function analyzeAiFavorites(docs) {
  const operations = [];
  const warnings = [];
  const groups = {};

  docs.forEach(doc => {
    const openid = extractOpenId(doc);
    const favoriteKey = doc.favoriteKey || buildAiFavoriteKey(doc);
    if (!openid || !favoriteKey || favoriteKey === '::') {
      warnings.push(`ai_favorites:${doc._id} 缺少 openid 或 favoriteKey，已跳过`);
      return;
    }

    const groupKey = `${openid}::${favoriteKey}`;
    if (!groups[groupKey]) groups[groupKey] = [];
    groups[groupKey].push(doc);

    const updateData = {};
    if (!doc.openid && doc._openid) {
      updateData.openid = doc._openid;
    }
    if (!doc.favoriteKey) {
      updateData.favoriteKey = favoriteKey;
    }
    pushUpdate(operations, 'ai_favorites', doc._id, updateData, '回填 AI 收藏字段');
  });

  Object.keys(groups).forEach(groupKey => {
    const items = sortDocsByRank(groups[groupKey]);
    if (items.length <= 1) return;

    const primary = items[0];
    items.slice(1).forEach(item => {
      pushRemove(operations, 'ai_favorites', item._id, `删除重复 AI 收藏，保留 ${primary._id}`);
    });
  });

  return {
    collection: 'ai_favorites',
    totalDocs: docs.length,
    warnings,
    operations
  };
}

function analyzeContentFavorites(docs) {
  const operations = [];
  const warnings = [];
  const groups = {};

  docs.forEach(doc => {
    const openid = extractOpenId(doc);
    const favoriteKey = doc.favoriteKey || buildContentFavoriteKey(doc);
    if (!openid || !favoriteKey || favoriteKey.endsWith('::')) {
      warnings.push(`content_favorites:${doc._id} 缺少 openid 或 favoriteKey，已跳过`);
      return;
    }

    const groupKey = `${openid}::${favoriteKey}`;
    if (!groups[groupKey]) groups[groupKey] = [];
    groups[groupKey].push(doc);

    const updateData = {};
    if (!doc.openid && doc._openid) {
      updateData.openid = doc._openid;
    }
    if (!doc.favoriteKey) {
      updateData.favoriteKey = favoriteKey;
    }
    pushUpdate(operations, 'content_favorites', doc._id, updateData, '回填内容收藏字段');
  });

  Object.keys(groups).forEach(groupKey => {
    const items = sortDocsByRank(groups[groupKey]);
    if (items.length <= 1) return;

    const primary = items[0];
    items.slice(1).forEach(item => {
      pushRemove(operations, 'content_favorites', item._id, `删除重复内容收藏，保留 ${primary._id}`);
    });
  });

  return {
    collection: 'content_favorites',
    totalDocs: docs.length,
    warnings,
    operations
  };
}

function analyzeCollection(collectionName, docs) {
  switch (collectionName) {
    case 'users':
      return analyzeUsers(docs);
    case 'user_settings':
      return analyzeUserSettings(docs);
    case 'checkin_records':
      return analyzeCheckinRecords(docs);
    case 'ai_favorites':
      return analyzeAiFavorites(docs);
    case 'content_favorites':
      return analyzeContentFavorites(docs);
    default:
      return {
        collection: collectionName,
        totalDocs: docs.length,
        warnings: [`未支持的集合 ${collectionName}，已跳过`],
        operations: []
      };
  }
}

async function applyOperations(operations) {
  let updatedCount = 0;
  let removedCount = 0;

  for (const operation of operations) {
    if (operation.type === 'update') {
      await db.collection(operation.collection).doc(operation.docId).update({
        data: {
          ...operation.data,
          updateTime: db.serverDate()
        }
      });
      updatedCount += 1;
    }

    if (operation.type === 'remove') {
      await db.collection(operation.collection).doc(operation.docId).remove();
      removedCount += 1;
    }
  }

  return {
    updatedCount,
    removedCount
  };
}

exports.main = async (event) => {
  const dryRun = event && typeof event.dryRun === 'boolean' ? event.dryRun : true;
  const requestedCollections = Array.isArray(event && event.collections) && event.collections.length
    ? event.collections
    : DEFAULT_COLLECTIONS;
  const pageSize = event && event.pageSize ? Number(event.pageSize) : MAX_PAGE_SIZE;

  const summaries = [];
  const allOperations = [];

  for (const collectionName of requestedCollections) {
    const docs = await fetchAllDocuments(collectionName, pageSize);
    const summary = analyzeCollection(collectionName, docs);
    summaries.push({
      collection: summary.collection,
      totalDocs: summary.totalDocs,
      updateCount: summary.operations.filter(item => item.type === 'update').length,
      removeCount: summary.operations.filter(item => item.type === 'remove').length,
      warnings: summary.warnings
    });
    allOperations.push(...summary.operations);
  }

  let execution = {
    updatedCount: 0,
    removedCount: 0
  };

  if (!dryRun && allOperations.length) {
    execution = await applyOperations(allOperations);
  }

  return {
    success: true,
    dryRun,
    collections: requestedCollections,
    operationCount: allOperations.length,
    execution,
    summaries,
    operationsPreview: allOperations.slice(0, 50)
  };
};
