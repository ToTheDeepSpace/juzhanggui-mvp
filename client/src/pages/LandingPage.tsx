import { useNavigate } from 'react-router-dom';

export default function LandingPage() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-indigo-950 to-purple-950 text-white">
      {/* Hero */}
      <header className="max-w-6xl mx-auto px-6 py-6 flex items-center justify-between">
        <div className="text-2xl font-bold tracking-wide">
          <span className="text-indigo-400">剧</span>掌柜
        </div>
        <nav className="flex gap-6 text-sm text-gray-300">
          <button onClick={() => navigate('/demo')} className="hover:text-white transition-colors">功能介绍</button>
          <button onClick={() => navigate('/player/login')} className="hover:text-white transition-colors">玩家入口</button>
          <button onClick={() => navigate('/store')} className="hover:text-white transition-colors">店家入口</button>
        </nav>
      </header>

      {/* Hero Section */}
      <section className="max-w-6xl mx-auto px-6 pt-20 pb-16 text-center">
        <h1 className="text-5xl md:text-6xl font-bold leading-tight mb-6">
          剧本杀行业的
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-purple-400"> 数字操作系统</span>
        </h1>
        <p className="text-xl text-gray-300 max-w-2xl mx-auto mb-10">
          让店家管得轻松，让卡司有尊严有成长，让玩家玩得更爽
        </p>
        <div className="flex flex-wrap justify-center gap-4">
          <button
            onClick={() => navigate('/demo')}
            className="px-8 py-3 bg-indigo-600 rounded-xl font-medium hover:bg-indigo-500 transition-colors shadow-lg shadow-indigo-600/30"
          >
            系统演示 →
          </button>
          <button
            onClick={() => navigate('/player/login')}
            className="px-8 py-3 bg-white/10 backdrop-blur rounded-xl font-medium hover:bg-white/20 transition-colors border border-white/20"
          >
            玩家入口
          </button>
          <button
            onClick={() => navigate('/store')}
            className="px-8 py-3 bg-white/10 backdrop-blur rounded-xl font-medium hover:bg-white/20 transition-colors border border-white/20"
          >
            店家入口
          </button>
        </div>
      </section>

      {/* 核心功能 */}
      <section className="max-w-6xl mx-auto px-6 py-20">
        <h2 className="text-3xl font-bold text-center mb-16">四大核心模块</h2>
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
          {[
            { icon: '📅', title: '智能排班', desc: '日历拖拽排期，冲突自动检测，多房间并行管理，告别 Excel 时代' },
            { icon: '🎭', title: '卡司管理', desc: 'DM 成长体系（学徒→金牌），自动统计开本数，等级对应收入' },
            { icon: '📊', title: '经营数据', desc: '实时的收入报表、卡司成本分析、剧本热度排行，数据驱动决策' },
            { icon: '🎮', title: '玩家端', desc: '玩家在线查看场次、预约报名、签到评价，完全的消费闭环' },
          ].map((card, i) => (
            <div key={i} className="bg-white/5 backdrop-blur rounded-2xl p-6 border border-white/10 hover:bg-white/10 transition-colors">
              <div className="text-4xl mb-4">{card.icon}</div>
              <h3 className="text-lg font-bold mb-2">{card.title}</h3>
              <p className="text-sm text-gray-400 leading-relaxed">{card.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* 差异化 */}
      <section className="max-w-6xl mx-auto px-6 py-20">
        <div className="bg-gradient-to-r from-indigo-600/20 to-purple-600/20 rounded-3xl p-10 border border-indigo-500/20">
          <h2 className="text-3xl font-bold text-center mb-8">不只是排班工具</h2>
          <div className="grid md:grid-cols-3 gap-8 text-center">
            <div>
              <div className="text-3xl mb-2">🏢</div>
              <h3 className="font-bold text-lg mb-2">DM 职业化平台</h3>
              <p className="text-gray-400 text-sm">行业第一套 DM 成长认证体系，从学徒到金牌，让卡司有明确的职业路径</p>
            </div>
            <div>
              <div className="text-3xl mb-2">🔗</div>
              <h3 className="font-bold text-lg mb-2">全产业链数据</h3>
              <p className="text-gray-400 text-sm">发行商、店家、卡司、玩家四方数据打通，让决策有据可依</p>
            </div>
            <div>
              <div className="text-3xl mb-2">🤖</div>
              <h3 className="font-bold text-lg mb-2">AI 辅助运营</h3>
              <p className="text-gray-400 text-sm">智能排班推荐、经营诊断报告、自动数据统计，让 AI 成为你的运营助手</p>
            </div>
          </div>
        </div>
      </section>

      {/* 底部 */}
      <footer className="max-w-6xl mx-auto px-6 py-12 border-t border-white/10 text-center text-sm text-gray-500">
        <p className="mb-2">剧掌柜 · 剧本杀行业数字化运营平台</p>
        <p>让发行商看到数据，让店家管得轻松，让卡司有尊严，让玩家玩得更爽</p>
      </footer>
    </div>
  );
}
