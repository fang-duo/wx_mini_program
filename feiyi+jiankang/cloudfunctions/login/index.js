const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext()
  const openid = wxContext.OPENID

  try {
    const userRes = await db.collection('users').where({
      _openid: openid
    }).get()

    if (userRes.data.length > 0) {
      return {
        success: true,
        userInfo: userRes.data[0],
        openid: openid
      }
    } else {
      return {
        success: true,
        userInfo: null,
        openid: openid,
        isNewUser: true
      }
    }
  } catch (error) {
    console.error('登录失败：', error)
    return {
      success: false,
      error: error.message
    }
  }
}