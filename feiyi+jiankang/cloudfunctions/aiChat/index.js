const cloud = require('wx-server-sdk')
const axios = require('axios')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY || ''
const MAX_INPUT_LENGTH = 300
const SYSTEM_PROMPT = [
  '你是“遗韵养生”的 AI 助手。',
  '你的职责是提供传统养生、非遗文化、传统体育、传统饮食、传统医药、传统音乐相关的科普信息。',
  '你不能提供疾病诊断、处方、药品剂量、急症处理方案，也不能对孕产妇、婴幼儿、老年重症患者或精神危机人群给出个性化医疗建议。',
  '遇到高风险医疗问题时，必须明确拒答，并建议用户及时咨询医生、药师、急救热线或就近医疗机构。',
  '不要索取、保存或复述身份证号、手机号、详细住址、银行卡等敏感个人信息。',
  '回答要简洁、审慎，优先给一般性健康提示和就医建议，不要夸大疗效。'
].join('\n')

const HIGH_RISK_RULES = [
  {
    pattern: /(诊断|确诊|是什么病|得了什么病|病因分析|医学诊断|看片子|化验单|报告单)/,
    answer: '该问题涉及疾病诊断或检查结果判断，AI 不能替代医生作出诊断。请携带相关检查结果咨询执业医生。'
  },
  {
    pattern: /(吃什么药|用什么药|开药|处方|药方|剂量|用量|怎么服药|停药|换药|抗生素|激素|处方药)/,
    answer: '该问题涉及具体用药或处方建议，AI 不提供药物选择、剂量或用法指导。请咨询医生或药师后再处理。'
  },
  {
    pattern: /(胸痛|呼吸困难|昏迷|抽搐|大出血|急救|120|心梗|中风|自杀|轻生|不想活|伤人)/,
    answer: '该问题可能涉及紧急风险或人身安全，请立即联系家人、拨打 120 或 110，或尽快前往就近医疗机构寻求帮助。'
  },
  {
    pattern: /(孕妇|怀孕|哺乳期|婴儿|宝宝|新生儿|儿童用药|老人用药|慢阻肺|癌症|肿瘤|精神疾病|抑郁症|焦虑症)/,
    answer: '该问题涉及特殊人群或高风险健康管理场景，AI 不能提供个性化处理建议。请结合实际情况咨询专业医生。'
  }
]

function normalizeInput(value) {
  return String(value || '').trim().slice(0, MAX_INPUT_LENGTH)
}

function getBlockedAnswer(input) {
  return (HIGH_RISK_RULES.find(rule => rule.pattern.test(input)) || {}).answer || ''
}

exports.main = async (event, context) => {
  const normalizedInput = normalizeInput(event.userInput)

  if (!DEEPSEEK_API_KEY) {
    return {
      success: false,
      answer: '云函数未配置 DeepSeek API Key，请先在云函数环境变量中设置 DEEPSEEK_API_KEY。'
    }
  }

  if (!normalizedInput) {
    return {
      success: false,
      answer: '请输入要咨询的问题。'
    }
  }

  const blockedAnswer = getBlockedAnswer(normalizedInput)
  if (blockedAnswer) {
    return {
      success: true,
      blocked: true,
      answer: blockedAnswer
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
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: normalizedInput }
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
