import { useState, useEffect } from 'react';
import { useApi } from '../hooks/useApi';
import type { Actor, Script, ActorSkill } from '../types';

const LINGQI_SITE_URL = (import.meta.env.VITE_LINGQI_SITE_URL || 'https://lingqi.jusichen.com').replace(/\/$/, '');
const ROLE_KIND_LABEL: Record<string, string> = {
  dm: 'DM',
  field_control: '场控',
  npc: 'NPC',
  assistant: '助演',
  other: '其他',
};

interface LearningTask {
  id: string;
  script_id: string;
  script_name?: string;
  title: string;
  due_date?: string | null;
  note?: string | null;
  status: string;
}

export default function ActorManager() {
  const { get, post, put, del, loading } = useApi();
  const [actors, setActors] = useState<Actor[]>([]);
  const [scripts, setScripts] = useState<Script[]>([]);
  const [selectedActor, setSelectedActor] = useState<Actor | null>(null);
  const [actorSkills, setActorSkills] = useState<ActorSkill[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [showSkillModal, setShowSkillModal] = useState(false);
  const [formData, setFormData] = useState({ name: '', phone: '', gender: '' });
  const [editingActor, setEditingActor] = useState<Actor | null>(null);
  const [selectedScript, setSelectedScript] = useState('');
  const [selectedRole, setSelectedRole] = useState('');
  const [selectedRoleType, setSelectedRoleType] = useState('dm');
  const [proficiency, setProficiency] = useState(3);
  const [learningTasks, setLearningTasks] = useState<LearningTask[]>([]);
  const [learningForm, setLearningForm] = useState({ scriptId: '', dueDate: '', note: '' });
  const [assessmentForm, setAssessmentForm] = useState({ taskId: '', scriptId: '', result: 'passed', score: '85', note: '' });

  useEffect(() => {
    loadActors();
    loadScripts();
  }, []);

  const loadActors = async () => {
    const result = await get<Actor[]>('/actors');
    if (result.success && result.data) {
      setActors(result.data);
    }
  };

  const loadScripts = async () => {
    const result = await get<Script[]>('/scripts');
    if (result.success && result.data) {
      setScripts(result.data);
    }
  };

  const loadActorSkills = async (actorId: string) => {
    const result = await get<ActorSkill[]>(`/actors/${actorId}/skills`);
    if (result.success && result.data) {
      setActorSkills(result.data);
    }
  };
  const loadLearningTasks = async (actorId: string) => {
    const result = await get<LearningTask[]>(`/actors/${actorId}/learning-tasks`);
    if (result.success && result.data) setLearningTasks(result.data);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (editingActor) {
      await put(`/actors/${editingActor.id}`, formData);
      setEditingActor(null);
    } else {
      await post('/actors', formData);
    }
    setFormData({ name: '', phone: '', gender: '' });
    setShowForm(false);
    loadActors();
  };

  const handleEdit = (actor: Actor) => {
    setEditingActor(actor);
    setFormData({ name: actor.name, phone: actor.phone || '', gender: actor.gender || '' });
    setShowForm(true);
  };

  const handleCancelEdit = () => {
    setEditingActor(null);
    setFormData({ name: '', phone: '', gender: '' });
    setShowForm(false);
  };

  const handleDelete = async (id: string) => {
    if (confirm('确定要删除这个卡司吗？')) {
      await del(`/actors/${id}`);
      loadActors();
    }
  };

  const openSkillModal = async (actor: Actor) => {
    setSelectedActor(actor);
    await loadActorSkills(actor.id);
    await loadLearningTasks(actor.id);
    setShowSkillModal(true);
  };

  const addSkill = async () => {
    if (!selectedActor || !selectedScript || !selectedRole) return;
    const script = scripts.find(s => s.id === selectedScript);
    await post(`/actors/${selectedActor.id}/skills`, {
      scriptId: selectedScript,
      roleName: selectedRole,
      roleType: selectedRoleType || (script?.actor_roles?.includes(selectedRole) ? 'dm' : 'player'),
      proficiency,
    });
    setSelectedScript('');
    setSelectedRole('');
    setSelectedRoleType('dm');
    setProficiency(3);
    loadActorSkills(selectedActor.id);
  };
  const createLearningTask = async () => {
    if (!selectedActor || !learningForm.scriptId) return;
    const result = await post(`/actors/${selectedActor.id}/learning-tasks`, {
      scriptId: learningForm.scriptId,
      dueDate: learningForm.dueDate || null,
      note: learningForm.note,
    });
    if (!result.success) return alert(result.error || '派发学本任务失败');
    setLearningForm({ scriptId: '', dueDate: '', note: '' });
    loadLearningTasks(selectedActor.id);
  };
  const saveAssessment = async () => {
    if (!selectedActor) return;
    const task = learningTasks.find(item => item.id === assessmentForm.taskId);
    const scriptId = assessmentForm.scriptId || task?.script_id;
    if (!scriptId) return alert('请选择考核剧本');
    const result = await post(`/actors/${selectedActor.id}/assessments`, {
      taskId: assessmentForm.taskId || null,
      scriptId,
      result: assessmentForm.result,
      score: Number(assessmentForm.score || 0),
      note: assessmentForm.note,
    });
    if (!result.success) return alert(result.error || '保存考核失败');
    setAssessmentForm({ taskId: '', scriptId: '', result: 'passed', score: '85', note: '' });
    loadLearningTasks(selectedActor.id);
    loadActorSkills(selectedActor.id);
  };

  const removeSkill = async (scriptId: string, roleName: string) => {
    if (!selectedActor) return;
    await del(`/actors/${selectedActor.id}/skills/${scriptId}/${encodeURIComponent(roleName)}`);
    loadActorSkills(selectedActor.id);
  };

  // 获取选中剧本的所有角色（玩家+卡司）
  const getSelectedScriptRoles = () => {
    const script = scripts.find(s => s.id === selectedScript);
    if (!script) return [];
    return [
      ...(script.actor_role_details || []).map(r => ({ name: r.name, type: r.role_kind || 'dm' })),
      ...(!script.actor_role_details?.length ? (script.actor_roles || []).map(r => ({ name: r, type: 'dm' })) : []),
      ...(script.player_roles || []).map(r => ({ name: r, type: 'player' }))
    ];
  };

  const getProficiencyLabel = (p: number) => {
    const labels = ['', '初学', '熟悉', '熟练', '精通', '专家'];
    return labels[p] || '未知';
  };

  const getProficiencyColor = (p: number) => {
    const colors = ['', 'bg-gray-400', 'bg-blue-400', 'bg-green-400', 'bg-orange-400', 'bg-red-400'];
    return colors[p] || 'bg-gray-400';
  };

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-bold text-gray-800">卡司管理</h2>
        <button
          onClick={() => {
            setEditingActor(null);
            setFormData({ name: '', phone: '', gender: '' });
            setShowForm(true);
          }}
          className="px-4 py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600 transition-colors"
        >
          + 添加卡司
        </button>
      </div>

      {showForm && (
        <div className="mb-6 p-4 bg-gray-50 rounded-lg">
          <h3 className="font-medium mb-4">{editingActor ? '编辑卡司' : '添加卡司'}</h3>
          <form onSubmit={handleSubmit} className="flex gap-4 items-end">
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700 mb-1">姓名</label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                placeholder="卡司姓名"
                required
              />
            </div>
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700 mb-1">电话</label>
              <input
                type="tel"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                placeholder="联系电话"
              />
            </div>
            <div className="w-36">
              <label className="block text-sm font-medium text-gray-700 mb-1">性别</label>
              <select
                value={formData.gender}
                onChange={(e) => setFormData({ ...formData, gender: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              >
                <option value="">未设置</option>
                <option value="男">男</option>
                <option value="女">女</option>
                <option value="可男可女">可男可女</option>
              </select>
            </div>
            <div className="flex gap-2">
              <button
                type="submit"
                disabled={loading}
                className="px-4 py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600 disabled:opacity-50"
              >
                {loading ? '保存中...' : (editingActor ? '更新' : '保存')}
              </button>
              <button
                type="button"
                onClick={handleCancelEdit}
                className="px-4 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400"
              >
                取消
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {actors.map((actor) => (
          <div key={actor.id} className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
            <div className="flex justify-between items-start">
              <div>
                <h3 className="font-medium text-lg text-gray-800">{actor.name}</h3>
                {actor.gender && (
                  <span className="mt-1 inline-flex rounded-full bg-purple-50 px-2 py-0.5 text-xs font-medium text-purple-700">{actor.gender}</span>
                )}
                {actor.phone && (
                  <p className="text-sm text-gray-500 mt-1">📞 {actor.phone}</p>
                )}
                {actor.lc_profile ? (
                  <a href={`${LINGQI_SITE_URL}/explore/${actor.lc_profile.id}`} target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 mt-1 text-xs text-indigo-600 hover:text-indigo-800 transition-colors">
                    已同步灵契 DM 主页 →
                  </a>
                ) : actor.phone && (
                  <a href={`${LINGQI_SITE_URL}/login?from=jusichen&role=dm`} target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 mt-1 text-xs text-gray-400 hover:text-indigo-600 transition-colors">
                    邀请入驻灵契
                  </a>
                )}
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => openSkillModal(actor)}
                  className="text-purple-500 hover:text-purple-700 text-sm"
                >
                  技能
                </button>
                <button
                  onClick={() => handleEdit(actor)}
                  className="text-blue-500 hover:text-blue-700 text-sm"
                >
                  编辑
                </button>
                <button
                  onClick={() => handleDelete(actor.id)}
                  className="text-red-500 hover:text-red-700 text-sm"
                >
                  删除
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {actors.length === 0 && !loading && (
        <div className="text-center py-12 text-gray-500">
          暂无卡司，点击上方按钮添加
        </div>
      )}

      {/* 技能管理弹窗 */}
      {showSkillModal && selectedActor && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-lg max-h-[80vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold">{selectedActor.name} - 技能管理</h3>
              <button
                onClick={() => setShowSkillModal(false)}
                className="text-gray-500 hover:text-gray-700"
              >
                ✕
              </button>
            </div>

            {/* 添加技能 */}
            <div className="mb-6 p-4 bg-gray-50 rounded-lg">
              <h4 className="font-medium mb-3">添加会开的角色</h4>
              <div className="space-y-3">
                <div className="flex gap-2">
                  <div className="flex-1">
                    <label className="block text-xs text-gray-500 mb-1">选择剧本</label>
                    <select
                      value={selectedScript}
                      onChange={(e) => {
                        setSelectedScript(e.target.value);
                        setSelectedRole('');
                      }}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    >
                      <option value="">选择剧本</option>
                      {scripts.map((script) => (
                        <option key={script.id} value={script.id}>
                          {script.name} ({(script.duration / 60).toFixed(1)}小时, {script.actor_count || 0}卡司+{script.player_count || 0}玩家)
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="flex-1">
                    <label className="block text-xs text-gray-500 mb-1">选择角色</label>
                    <select
                      value={selectedRole}
                      onChange={(e) => setSelectedRole(e.target.value)}
                      disabled={!selectedScript}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg disabled:bg-gray-100"
                    >
                      <option value="">选择角色</option>
                      {getSelectedScriptRoles().map((role) => (
                        <option key={`${role.type}-${role.name}`} value={role.name}>
                          {role.name} ({role.type === 'player' ? '玩家' : ROLE_KIND_LABEL[role.type] || '演绎'})
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="w-28">
                    <label className="block text-xs text-gray-500 mb-1">类型</label>
                    <select
                      value={selectedRoleType}
                      onChange={(e) => setSelectedRoleType(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    >
                      <option value="dm">DM</option>
                      <option value="field_control">场控</option>
                      <option value="npc">NPC</option>
                      <option value="assistant">助演</option>
                      <option value="player">玩家角色</option>
                    </select>
                  </div>
                  <div className="w-28">
                    <label className="block text-xs text-gray-500 mb-1">熟练度</label>
                    <select
                      value={proficiency}
                      onChange={(e) => setProficiency(Number(e.target.value))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    >
                      <option value={1}>初学</option>
                      <option value={2}>熟悉</option>
                      <option value={3}>熟练</option>
                      <option value={4}>精通</option>
                      <option value={5}>专家</option>
                    </select>
                  </div>
                </div>
                <button
                  onClick={addSkill}
                  disabled={!selectedScript || !selectedRole}
                  className="w-full px-4 py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600 disabled:opacity-50"
                >
                  添加技能
                </button>
              </div>
            </div>

            {/* 技能列表 */}
            <div>
              <h4 className="font-medium mb-3">已掌握角色 ({actorSkills.length})</h4>
              {actorSkills.length === 0 ? (
                <p className="text-gray-500 text-center py-4">暂无技能记录</p>
              ) : (
                <div className="space-y-2">
                  {actorSkills.map((skill) => (
                    <div
                      key={skill.id}
                      className="flex justify-between items-center p-3 border border-gray-200 rounded-lg"
                    >
                      <div>
                        <span className="font-medium">{skill.script_name}</span>
                        <span className="text-sm text-gray-500 ml-2">- {skill.role_name}</span>
                        <span className={`ml-2 px-2 py-0.5 text-xs rounded ${skill.role_type === 'actor' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'}`}>
                          {ROLE_KIND_LABEL[skill.role_type] || (skill.role_type === 'player' ? '玩家' : '演绎')}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span
                          className={`px-2 py-1 text-xs text-white rounded ${getProficiencyColor(
                            skill.proficiency
                          )}`}
                        >
                          {getProficiencyLabel(skill.proficiency)}
                        </span>
                        <button
                          onClick={() => removeSkill(skill.script_id, skill.role_name)}
                          className="text-red-500 hover:text-red-700 text-sm"
                        >
                          删除
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="mt-6 border-t border-gray-100 pt-5">
              <h4 className="font-medium mb-3">学本任务与考核</h4>
              <div className="grid gap-3 rounded-lg bg-amber-50 p-3">
                <select value={learningForm.scriptId} onChange={(e) => setLearningForm({ ...learningForm, scriptId: e.target.value })} className="px-3 py-2 border border-amber-200 rounded-lg bg-white text-sm">
                  <option value="">选择要派发的剧本</option>
                  {scripts.map(script => <option key={script.id} value={script.id}>{script.name}</option>)}
                </select>
                <input type="date" value={learningForm.dueDate} onChange={(e) => setLearningForm({ ...learningForm, dueDate: e.target.value })} className="px-3 py-2 border border-amber-200 rounded-lg bg-white text-sm" />
                <textarea value={learningForm.note} onChange={(e) => setLearningForm({ ...learningForm, note: e.target.value })} placeholder="学习要求，例如先看本、跟车一次、准备复盘问题" className="h-20 px-3 py-2 border border-amber-200 rounded-lg bg-white text-sm" />
                <button onClick={createLearningTask} disabled={!learningForm.scriptId} className="px-4 py-2 bg-amber-500 text-white rounded-lg hover:bg-amber-600 disabled:opacity-50">派发学本任务</button>
              </div>
              <div className="mt-3 space-y-2">
                {learningTasks.map(task => (
                  <div key={task.id} className="rounded-lg border border-amber-100 bg-white p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-medium text-gray-800">{task.title}</p>
                        <p className="text-xs text-gray-500">{task.script_name || '未命名剧本'} · {task.due_date || '未设截止'} · {task.status}</p>
                        {task.note && <p className="mt-1 text-xs text-gray-500">{task.note}</p>}
                      </div>
                      <button
                        onClick={() => setAssessmentForm({ ...assessmentForm, taskId: task.id, scriptId: task.script_id })}
                        className="text-xs text-amber-700 hover:text-amber-900"
                      >
                        考核
                      </button>
                    </div>
                  </div>
                ))}
                {learningTasks.length === 0 && <p className="text-sm text-gray-500 text-center py-3">暂无学本任务</p>}
              </div>
              <div className="mt-3 grid gap-2 rounded-lg bg-green-50 p-3">
                <select value={assessmentForm.scriptId} onChange={(e) => setAssessmentForm({ ...assessmentForm, scriptId: e.target.value })} className="px-3 py-2 border border-green-200 rounded-lg bg-white text-sm">
                  <option value="">选择考核剧本</option>
                  {scripts.map(script => <option key={script.id} value={script.id}>{script.name}</option>)}
                </select>
                <div className="grid grid-cols-2 gap-2">
                  <select value={assessmentForm.result} onChange={(e) => setAssessmentForm({ ...assessmentForm, result: e.target.value })} className="px-3 py-2 border border-green-200 rounded-lg bg-white text-sm">
                    <option value="passed">通过</option>
                    <option value="failed">未通过</option>
                  </select>
                  <input value={assessmentForm.score} onChange={(e) => setAssessmentForm({ ...assessmentForm, score: e.target.value })} type="number" min="0" max="100" className="px-3 py-2 border border-green-200 rounded-lg bg-white text-sm" placeholder="分数" />
                </div>
                <textarea value={assessmentForm.note} onChange={(e) => setAssessmentForm({ ...assessmentForm, note: e.target.value })} placeholder="考核备注" className="h-16 px-3 py-2 border border-green-200 rounded-lg bg-white text-sm" />
                <button onClick={saveAssessment} disabled={!assessmentForm.scriptId} className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50">保存考核结果</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
