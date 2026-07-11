import { useNavigate } from 'react-router-dom';

export default function StorePortal() {
  const navigate = useNavigate();

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
        <h1 className="text-3xl font-bold text-center mb-2">店家管理</h1>
        <p className="text-gray-400 text-center mb-12">剧司辰处理店内经营和 DM 工作流；玩家公开身份、DM 公开资料与社区内容统一放在剧幕录。</p>

        <div className="grid gap-5 md:grid-cols-2">
          <button
            onClick={() => navigate('/store/manage')}
            className="bg-white/5 backdrop-blur rounded-2xl p-7 border border-white/10 hover:bg-white/10 transition-all text-left group"
          >
            <div className="inline-block px-3 py-1 rounded-lg bg-gradient-to-r from-indigo-500 to-blue-500 text-sm font-medium mb-4">
              店家后台
            </div>
            <p className="text-sm text-gray-400 mb-4">排期、房间、剧本、卡司、会员与经营数据统一在这里管理。</p>
            <ul className="space-y-1.5">
              {['创建与编辑排班', '剧本库与角色配置', '卡司 / DM 登记', '签到与经营数据'].map((f) => (
                <li key={f} className="text-xs text-gray-500 flex items-center gap-2">
                  <span className="w-1 h-1 rounded-full bg-gray-500 shrink-0" />
                  {f}
                </li>
              ))}
            </ul>
            <div className="mt-5 text-indigo-400 text-sm group-hover:translate-x-1 transition-transform">
              进入店家管理 →
            </div>
          </button>

          <button
            onClick={() => navigate('/store/dm')}
            className="bg-white/5 backdrop-blur rounded-2xl p-7 border border-white/10 hover:bg-white/10 transition-all text-left group"
          >
            <div className="inline-block px-3 py-1 rounded-lg bg-gradient-to-r from-purple-500 to-fuchsia-500 text-sm font-medium mb-4">
              DM 工作台
            </div>
            <p className="text-sm text-gray-400 mb-4">店内 DM 查看排班、提交请假、预估工资、沉淀开本履历和经验。</p>
            <ul className="space-y-1.5">
              {['今日任务与未来排班', '工资预估与内部评级', '累计开本与剧本履历', '经验记录与请假申请'].map((f) => (
                <li key={f} className="text-xs text-gray-500 flex items-center gap-2">
                  <span className="w-1 h-1 rounded-full bg-gray-500 shrink-0" />
                  {f}
                </li>
              ))}
            </ul>
            <div className="mt-5 text-purple-300 text-sm group-hover:translate-x-1 transition-transform">
              进入 DM 工作台 →
            </div>
          </button>
        </div>
      </section>
    </div>
  );
}
