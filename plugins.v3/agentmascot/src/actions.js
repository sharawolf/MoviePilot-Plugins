import { GROUND_BEHAVIORS, WALL_BEHAVIORS, CEILING_BEHAVIORS, REQUIRED_SEMANTIC_ACTIONS, FEATURE_SEMANTIC_ACTIONS, resolveMascotBehaviors, isCustomPet } from './runtime.js'

export const actionLabels = {
  idle: '待机', walk: '走路', run: '跑步', jump: '跳跃', fall: '下落', land: '落地',
  sleep: '睡觉', drag: '拖拽', resist: '挣扎', think: '思考', surprise: '惊讶',
  cheer: '欢呼', spinCelebrate: '转圈庆祝',
  right: '向右移动', left: '向左移动', waving: '挥手', jumping: '跳跃',
  failed: '失败反应', waiting: '等待回应', working: '专注工作', review: '检查结果',
}
const behaviorLabels = {
  rest: '原地休息', roam: '随机游走', goWall: '去墙边', leap: '飞跃', holdWall: '贴墙停留',
  climbWall: '爬墙', fallFromWall: '墙面下落', goCeiling: '上天花板', holdCeiling: '吸顶停留',
  crawlCeiling: '天花板移动', dropFromCeiling: '天花板下落',
}

export function actionGroups(mascot, kind = 'action') {
  if (isCustomPet(mascot)) return kind === 'behavior' ? [] : [{
    id: 'pet', title: 'Pet 原生动作', items: ['idle','right','left','waving','jumping','failed','waiting','working','review'].map(id => ({ id, label: actionLabels[id] })),
  }]
  if (kind === 'behavior') return [
    ['ground', '地面行为', GROUND_BEHAVIORS], ['wall', '墙面行为', WALL_BEHAVIORS], ['ceiling', '天花板行为', CEILING_BEHAVIORS],
  ].map(([id, title, behaviors]) => ({ id, title, items: resolveMascotBehaviors(id, behaviors, mascot).map(b => ({ id: b.id, label: behaviorLabels[b.id] || b.id })) })).filter(g => g.items.length)

  return [
    ['daily', '日常', ['idle', 'sleep', 'think']], ['move', '移动', ['walk', 'run']],
    ['air', '空中', ['jump', 'fall', 'land']], ['interact', '交互', ['drag', 'resist', 'surprise']],
    ['feature', '角色特色', ['cheer', 'spinCelebrate']],
  ].map(([id, title, items]) => ({ id, title, items: items.filter(name => REQUIRED_SEMANTIC_ACTIONS.includes(name) || (FEATURE_SEMANTIC_ACTIONS[mascot] || []).includes(name)).map(id => ({ id, label: actionLabels[id] || id })) })).filter(g => g.items.length)
}
