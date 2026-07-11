import { useNavigate } from 'react-router-dom';
import Logo from '../components/Logo';
import ComplianceFooter from '../components/ComplianceFooter';
import { JUMULU_SITE_URL } from '../config';

export default function LandingPage() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-indigo-950 to-purple-950 text-white">
      {/* Hero */}
      <header className="max-w-6xl mx-auto px-6 py-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Logo size={40} />
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold tracking-wide">
              <span className="text-indigo-400">剧</span>司辰
            </span>
            <span className="text-sm text-gray-400 tracking-wider hidden sm:inline">剧本杀排期系统</span>
          </div>
        </div>
        <nav className="flex gap-6 text-sm text-gray-300">
          <button onClick={() => navigate('/demo')} className="hover:text-white transition-colors">功能介绍</button>
          <a href={`${JUMULU_SITE_URL}/login?from=jusichen`} className="hover:text-white transition-colors">剧幕录用户端</a>
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
          剧司辰专注店家运营与 DM 内部工作台，玩家和社区身份沉淀在剧幕录
        </p>
        <div className="flex flex-wrap justify-center gap-4">
          <button
            onClick={() => navigate('/demo')}
            className="px-8 py-3 bg-indigo-600 rounded-xl font-medium hover:bg-indigo-500 transition-colors shadow-lg shadow-indigo-600/30"
          >
            系统演示 →
          </button>
          <a
            href={`${JUMULU_SITE_URL}/login?from=jusichen`}
            className="px-8 py-3 bg-white/10 backdrop-blur rounded-xl font-medium hover:bg-white/20 transition-colors border border-white/20"
          >
            剧幕录用户端
          </a>
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
            { icon: '🎭', title: 'DM 工作台', desc: '排班、请假、工资预估、累计开本、开本履历和经验沉淀统一留在店内' },
            { icon: '📊', title: '经营数据', desc: '实时的收入报表、卡司成本分析、剧本热度排行，数据驱动决策' },
            { icon: '🎮', title: '剧幕录用户端', desc: '玩家主页、DM 公开身份、店家认领与内容资产统一沉淀到剧幕录' },
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

      {/* 为 AI 时代而生 · 数据地基 */}
      <section className="max-w-6xl mx-auto px-6 py-20">
        <div className="text-center mb-14">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-indigo-500/10 border border-indigo-400/30 text-indigo-300 text-xs tracking-wider mb-5">
            <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-pulse" />
            AI × 剧本杀 · 数据地基
          </div>
          <h2 className="text-3xl md:text-4xl font-bold mb-4">
            数据沉淀，
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-purple-400">为 AI 时代而生</span>
          </h2>
          <p className="text-gray-400 max-w-2xl mx-auto">
            司辰，古之钦天监掌时辰星象者。今之剧司辰，记每一幕戏的呼吸，识每一个灵魂的轨迹。
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          {/* 场次级数据 */}
          <div className="relative bg-gradient-to-br from-indigo-500/10 to-transparent rounded-2xl p-6 border border-indigo-400/20 hover:border-indigo-400/40 transition-colors">
            <div className="text-3xl mb-4">🎬</div>
            <h3 className="text-lg font-bold mb-3">场次级数据沉淀</h3>
            <p className="text-sm text-gray-400 leading-relaxed mb-4">
              不只是开了多少场。我们记录：第几幕放了什么 BGM、谁先哭出来、谁最先猜中凶手、笑场和冷场的时间戳。
            </p>
            <div className="flex flex-wrap gap-1.5 text-[11px]">
              <span className="px-2 py-0.5 rounded bg-white/5 text-gray-300">幕次音乐</span>
              <span className="px-2 py-0.5 rounded bg-white/5 text-gray-300">情绪打点</span>
              <span className="px-2 py-0.5 rounded bg-white/5 text-gray-300">玩家行为</span>
            </div>
          </div>

          {/* 玩家立体画像 */}
          <div className="relative bg-gradient-to-br from-purple-500/10 to-transparent rounded-2xl p-6 border border-purple-400/20 hover:border-purple-400/40 transition-colors">
            <div className="text-3xl mb-4">🔮</div>
            <h3 className="text-lg font-bold mb-3">玩家立体画像</h3>
            <p className="text-sm text-gray-400 leading-relaxed mb-4">
              MBTI、星座、八字、星盘——把每一个玩家变成可被理解的"角色档案"，而不只是一个手机号。
            </p>
            <div className="flex flex-wrap gap-1.5 text-[11px]">
              <span className="px-2 py-0.5 rounded bg-white/5 text-gray-300">MBTI</span>
              <span className="px-2 py-0.5 rounded bg-white/5 text-gray-300">星座星盘</span>
              <span className="px-2 py-0.5 rounded bg-white/5 text-gray-300">八字命盘</span>
            </div>
          </div>

          {/* AI 角色推荐 */}
          <div className="relative bg-gradient-to-br from-fuchsia-500/10 to-transparent rounded-2xl p-6 border border-fuchsia-400/20 hover:border-fuchsia-400/40 transition-colors overflow-hidden">
            <div className="absolute top-3 right-3 text-[10px] px-2 py-0.5 rounded-full bg-fuchsia-500/20 text-fuchsia-300 border border-fuchsia-400/30">
              Coming Soon
            </div>
            <div className="text-3xl mb-4">🧬</div>
            <h3 className="text-lg font-bold mb-3">AI 角色推荐</h3>
            <p className="text-sm text-gray-400 leading-relaxed mb-4">
              你的星盘，遇见你的本命角色。基于沉淀的画像与剧本数据，让 AI 为每一个玩家匹配命中注定的那个 TA。
            </p>
            <div className="flex flex-wrap gap-1.5 text-[11px]">
              <span className="px-2 py-0.5 rounded bg-white/5 text-gray-300">角色匹配</span>
              <span className="px-2 py-0.5 rounded bg-white/5 text-gray-300">剧本推荐</span>
              <span className="px-2 py-0.5 rounded bg-white/5 text-gray-300">组局优化</span>
            </div>
          </div>
        </div>

        <p className="text-center text-xs text-gray-500 mt-10 italic">
          先有数据沉淀，再有 AI 涌现。我们现在做的每一份记录，都是未来 AI 的训练集。
        </p>
      </section>

      <ComplianceFooter variant="dark" />
    </div>
  );
}
