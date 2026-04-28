import { useState, useEffect } from 'react';
import { useApi } from '../hooks/useApi';
import type { Actor, Script, ActorSkill } from '../types';

export default function ActorManager() {
  const { get, post, put, del, loading } = useApi();
  const [actors, setActors] = useState<Actor[]>([]);
  const [scripts, setScripts] = useState<Script[]>([]);
  const [selectedActor, setSelectedActor] = useState<Actor | null>(null);
  const [actorSkills, setActorSkills] = useState<ActorSkill[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [showSkillModal, setShowSkillModal] = useState(false);
  const [formData, setFormData] = useState({ name: '', phone: '' });
  const [editingActor, setEditingActor] = useState<Actor | null>(null);
  const [selectedScript, setSelectedScript] = useState('');
  const [selectedRole, setSelectedRole] = useState('');
  const [proficiency, setProficiency] = useState(3);

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (editingActor) {
      await put(`/actors/${editingActor.id}`, formData);
      setEditingActor(null);
    } else {
      await post('/actors', formData);
    }
    setFormData({ name: '', phone: '' });
    setShowForm(false);
    loadActors();
  };

  const handleEdit = (actor: Actor) => {
    setEditingActor(actor);
    setFormData({ name: actor.name, phone: actor.phone || '' });
    setShowForm(true);
  };

  const handleCancelEdit = () => {
    setEditingActor(null);
    setFormData({ name: '', phone: '' });
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
    setShowSkillModal(true);
  };

  const addSkill = async () => {
    if (!selectedActor || !selectedScript || !selectedRole) return;
    const script = scripts.find(s => s.id === selectedScript);
    await post(`/actors/${selectedActor.id}/skills`, {
      scriptId: selectedScript,
      roleName: selectedRole,
      roleType: script?.actor_roles?.includes(selectedRole) ? 'actor' : 'player',
      proficiency,
    });
    setSelectedScript('');
    setSelectedRole('');
    setProficiency(3);
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
      ...(script.actor_roles || []).map(r => ({ name: r, type: 'actor' })),
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
            setFormData({ name: '', phone: '' });
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
                {actor.phone && (
                  <p className="text-sm text-gray-500 mt-1">📞 {actor.phone}</p>
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
                        <option key={role.name} value={role.name}>
                          {role.name} {role.type === 'actor' ? '(卡司)' : '(玩家)'}
                        </option>
                      ))}
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
                          {skill.role_type === 'actor' ? '卡司' : '玩家'}
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
          </div>
        </div>
      )}
    </div>
  );
}
