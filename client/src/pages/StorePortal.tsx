import { useNavigate } from 'react-router-dom';

export default function StorePortal() {
  const navigate = useNavigate();

  const roles = [
    {
      id: 'manager', icon: '🏪', title: '店长', color: 'from-indigo-500 to-blue-500',
      desc: '全功能管理后台',
      features: ['房间/卡司/剧本管理', '排期总览与创建', '会员与数据报表', '系统配置'],
      path: '/store/manage',
    },
    {
      id: 'cs', icon: '📞', title: '客服', color: 'from-green-500 to-emerald-500',
      desc: '排期操作',
      features: ['创建与编辑排班', '客户预约管理', '签到处理', '日常运营'],
      path: '/store/manage/schedule',
    },
    {
      id: 'dm', icon: '🎭', title: '卡司/DM', color: 'from-purple-500 to-pink-500',
      desc: '我的工作台',
      features: ['查看个人排班', '开本数据统计', '等级与成长体系', '申请假期'],
      path: '/store/dm',
    },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-indigo-950 to-purple-950 text-white">
      <header className="max-w-4xl mx-auto px-6 py-6 flex items-center justify-between">
        <button onClick={() => navigate('/')} className="text-2xl font-bold tracking-wide">
          <span className="text-indigo-400">剧</span>掌柜
        </button>
        <button onClick={() => navigate('/')} className="text-sm text-gray-400 hover:text-white transition-colors">
          ← 返回首页
        </button>
      </header>

      <section className="max-w-4xl mx-auto px-6 pt-16 pb-20">
        <h1 className="text-3xl font-bold text-center mb-2">店家端</h1>
        <p className="text-gray-400 text-center mb-12">请选择您的角色</p>

        <div className="grid md:grid-cols-3 gap-6">
          {roles.map((role) => (
            <button
              key={role.id}
              onClick={() => navigate(role.path)}
              className="bg-white/5 backdrop-blur rounded-2xl p-6 border border-white/10 hover:bg-white/10 transition-all text-left group"
            >
              <div className={`inline-block px-3 py-1 rounded-lg bg-gradient-to-r ${role.color} text-sm font-medium mb-4`}>
                {role.icon} {role.title}
              </div>
              <p className="text-sm text-gray-400 mb-4">{role.desc}</p>
              <ul className="space-y-1.5">
                {role.features.map((f, i) => (
                  <li key={i} className="text-xs text-gray-500 flex items-center gap-2">
                    <span className="w-1 h-1 rounded-full bg-gray-500 shrink-0" />
                    {f}
                  </li>
                ))}
              </ul>
              <div className="mt-4 text-indigo-400 text-sm group-hover:translate-x-1 transition-transform">
                进入 {role.title} 端 →
              </div>
            </button>
          ))}
        </div>

        <div className="text-center mt-12">
          <button
            onClick={() => navigate('/player/login')}
            className="text-sm text-gray-400 hover:text-white transition-colors"
          >
            我是玩家，点击进入玩家端 →
          </button>
        </div>
      </section>
    </div>
  );
}
