import { useNavigate } from 'react-router-dom';

export default function DemoPage() {
  const navigate = useNavigate();

  const features = [
    {
      icon: '📅', title: '排期管理', color: 'from-blue-500 to-cyan-500',
      items: ['日历拖拽创建排期', '自动冲突检测', '多房间并行管理', '排期状态自动流转'],
    },
    {
      icon: '🎭', title: '卡司/DM 管理', color: 'from-purple-500 to-pink-500',
      items: ['卡司信息管理', '技能与剧本关联', 'DM 工作台', '累计开本与经验留存'],
    },
    {
      icon: '📖', title: '剧本管理', color: 'from-orange-500 to-red-500',
      items: ['剧本与角色管理', '玩家/卡司角色分离', '角色性别标注', '剧本热度统计'],
    },
    {
      icon: '🎮', title: '剧幕录用户端联动', color: 'from-green-500 to-emerald-500',
      items: ['玩家主页在剧幕录', 'DM 公开身份在剧幕录', '拼车同步到剧幕录', '店内工作流保留'],
    },
    {
      icon: '⭐', title: '会员管理', color: 'from-yellow-500 to-amber-500',
      items: ['会员信息管理', '充值/消费记录', '会员等级体系', '偏好卡司记录'],
    },
    {
      icon: '📊', title: '数据看板', color: 'from-indigo-500 to-violet-500',
      items: ['实时经营数据', '卡司工作量统计', '剧本评分聚合', '矛盾调解记录'],
    },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-indigo-950 to-purple-950 text-white">
      <header className="max-w-6xl mx-auto px-6 py-6 flex items-center justify-between">
        <button onClick={() => navigate('/')} className="text-2xl font-bold tracking-wide">
          <span className="text-indigo-400">剧</span>掌柜
        </button>
        <button onClick={() => navigate('/')} className="text-sm text-gray-400 hover:text-white transition-colors">
          ← 返回首页
        </button>
      </header>

      <section className="max-w-6xl mx-auto px-6 pt-10 pb-20">
        <h1 className="text-4xl font-bold text-center mb-4">功能介绍</h1>
        <p className="text-gray-400 text-center mb-16 max-w-xl mx-auto">
          剧司辰负责店家排期、经营数据和 DM 内部工作流，用户身份与内容资产沉淀到剧幕录
        </p>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((f, i) => (
            <div key={i} className="bg-white/5 backdrop-blur rounded-2xl p-6 border border-white/10 hover:bg-white/10 transition-all">
              <div className={`inline-block px-3 py-1 rounded-lg bg-gradient-to-r ${f.color} text-sm font-medium mb-4`}>
                {f.icon} {f.title}
              </div>
              <ul className="space-y-2">
                {f.items.map((item, j) => (
                  <li key={j} className="text-sm text-gray-300 flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 shrink-0" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="text-center mt-16">
          <button
            onClick={() => navigate('/store')}
            className="px-8 py-3 bg-indigo-600 rounded-xl font-medium hover:bg-indigo-500 transition-colors shadow-lg"
          >
            立即体验 →
          </button>
        </div>
      </section>
    </div>
  );
}
