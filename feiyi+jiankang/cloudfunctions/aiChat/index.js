const cloud = require('wx-server-sdk')
const axios = require('axios')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY || ''

exports.main = async (event, context) => {
  const { userInput } = event

  if (!DEEPSEEK_API_KEY) {
    return {
      success: false,
      answer: '云函数未配置 DeepSeek API Key，请先在云函数环境变量中设置 DEEPSEEK_API_KEY。'
    }
  }

  if (!userInput || !String(userInput).trim()) {
    return {
      success: false,
      answer: '请输入要咨询的问题。'
    }
  }

  try {
    const res = await axios({
      method: 'post',
      url: 'https://api.deepseek.com/chat/completions',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${DEEPSEEK_API_KEY}`
      },
      data: {
        model: 'deepseek-chat',
        messages: [
          { role: 'system', content: '你是一个专业的非遗健康助理，请围绕非遗、养生、传统体育、传统饮食、传统医药、传统音乐提供简洁可靠的回答。' },
          { role: 'user', content: String(userInput).trim() }
        ]
      },
      timeout: 30000
    })

    return {
      success: true,
      answer: res.data.choices[0].message.content
    }
  } catch (err) {
    console.error('aiChat error:', err.response ? err.response.data : err)
    return {
      success: false,
      answer: 'AI 暂时不可用，请检查云环境、云函数部署状态和 DeepSeek Key 配置。'
    }
  }
}
