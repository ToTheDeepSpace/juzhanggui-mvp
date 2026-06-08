import { useState, useEffect } from 'react';
import { useApi } from '../hooks/useApi';
import type { Script, ScriptRole, ActorSkill, Role, ScriptTemplate } from '../types';

export default function ScriptManager() {
  const { get, post, put, del, loading } = useApi();
  const [scripts, setScripts] = useState<Script[]>([]);
  const [templates, setTemplates] = useState<ScriptTemplate[]>([]);
  const [selectedScript, setSelectedScript] = useState<Script | null>(null);
  const [scriptRoles, setScriptRoles] = useState<ScriptRole[]>([]);
  const [skilledActors, setSkilledActors] = useState<ActorSkill[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [showDetail, setShowDetail] = useState(false);
  const [editingScript, setEditingScript] = useState<Script | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    minDuration: '',
    maxDuration: '',
    dmGender: '未指定',
    playerRoles: [] as Role[],
    actorRoles: [] as Role[],
  });


  const [batchPlayerRoles, setBatchPlayerRoles] = useState('');
  const [batchActorRoles, setBatchActorRoles] = useState('');
  const [templateMsg, setTemplateMsg] = useState('');

  useEffect(() => {
    void loadScripts();
    void loadTemplates();
  }, []);

  const loadScripts = async () => {
    const result = await get<Script[]>('/scripts');
    if (result.success && result.data) {
      setScripts(result.data);
    }
  };

  const loadTemplates = async () => {
    const result = await get<ScriptTemplate[]>('/script-templates');
    if (result.success && result.data) setTemplates(result.data);
  };

  const loadScriptDetail = async (script: Script) => {
    const result = await get<{ roles: ScriptRole[]; skilledActors: ActorSkill[] }>(`/scripts/${script.id}`);
    if (result.success && result.data) {
      setScriptRoles(result.data.roles);
      setSkilledActors(result.data.skilledActors);
    }
  };

  
  // 批量解析角色名
  const parseRoleNames = (text: string): string[] => {
    if (!text.trim()) return [];
    // 支持逗号、中文顿号、全角逗号、换行、空格分隔
    const separators = /[,、，\n\s]+/;
    return text.split(separators)
      .map(name => name.trim())
      .filter(name => name.length > 0);
  };

  // 批量添加玩家角色
  const handleBatchAddPlayerRoles = () => {
    const names = parseRoleNames(batchPlayerRoles);
    if (names.length === 0) return;
    
    const existingNames = new Set(formData.playerRoles.map(r => r.name));
    const newRoles = names
      .filter(name => !existingNames.has(name))
      .map(name => ({ name, gender: '未指定' }));
    
    if (newRoles.length > 0) {
      setFormData({
        ...formData,
        playerRoles: [...formData.playerRoles, ...newRoles]
      });
      setBatchPlayerRoles('');
    }
  };

  // 批量添加卡司角色
  const handleBatchAddActorRoles = () => {
    const names = parseRoleNames(batchActorRoles);
    if (names.length === 0) return;
    
    const existingNames = new Set(formData.actorRoles.map(r => r.name));
    const newRoles = names
      .filter(name => !existingNames.has(name))
      .map(name => ({ name, gender: '未指定' }));
    
    if (newRoles.length > 0) {
      setFormData({
        ...formData,
        actorRoles: [...formData.actorRoles, ...newRoles]
      });
      setBatchActorRoles('');
    }
  };
const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // 表单验证
    if (!formData.name.trim()) {
      alert('请输入剧本名称');
      return;
    }
    if (!formData.minDuration || parseInt(formData.minDuration) <= 0) {
      alert('请输入最短时长');
      return;
    }
    if (!formData.maxDuration || parseInt(formData.maxDuration) <= 0) {
      alert('请输入最长时长');
      return;
    }
    if (parseInt(formData.minDuration) > parseInt(formData.maxDuration)) {
      alert('最短时长不能大于最长时长');
      return;
    }
    if (formData.playerRoles.length === 0 && formData.actorRoles.length === 0) {
      alert('请至少添加一个角色（玩家或卡司）');
      return;
    }
    
    const data = {
      name: formData.name.trim(),
      minDuration: Math.round(parseFloat(formData.minDuration) * 60), // 小时转分钟
      maxDuration: Math.round(parseFloat(formData.maxDuration) * 60), // 小时转分钟
      dmGender: formData.dmGender,
      playerRoles: formData.playerRoles.map(r => r.gender && r.gender !== '未指定' ? `${r.name}(${r.gender})` : r.name),
      actorRoles: formData.actorRoles.map(r => r.gender && r.gender !== '未指定' ? `${r.name}(${r.gender})` : r.name),
    };

    let result;
    if (editingScript) {
      result = await put(`/scripts/${editingScript.id}`, data);
    } else {
      result = await post('/scripts', data);
    }

    if (result.success) {
      setFormData({ name: '', minDuration: '', maxDuration: '', dmGender: '未指定', playerRoles: [], actorRoles: [] });
      setEditingScript(null);
      setShowForm(false);
      loadScripts();
    } else {
      alert('保存失败: ' + (result.error || '未知错误'));
    }
  };


  const handleDelete = async (id: string) => {
    if (confirm('确定要删除这个剧本吗？')) {
      await del(`/scripts/${id}`);
      loadScripts();
    }
  };

  const publishTemplate = async (script: Script) => {
    const result = await post(`/scripts/${script.id}/publish-template`, {});
    if (result.success) {
      setTemplateMsg(`${script.name} 已提交公共模版审核，通过后其他店家可导入`);
      void loadTemplates();
    } else {
      setTemplateMsg(`发布失败：${result.error || '未知错误'}`);
    }
  };

  const importTemplate = async (template: ScriptTemplate) => {
    const result = await post<{ id: string; existing: boolean }>(`/script-templates/${template.id}/import`, {});
    if (result.success) {
      setTemplateMsg(result.data?.existing ? `${template.name} 已存在，无需重复导入` : `${template.name} 已导入到当前后台`);
      void loadScripts();
      void loadTemplates();
    } else {
      setTemplateMsg(`导入失败：${result.error || '未知错误'}`);
    }
  };

  const handleDeleteRole = async (roleId: string) => {
    if (!selectedScript) return;
    if (confirm('确定要删除这个角色配置吗？')) {
      await del(`/scripts/${selectedScript.id}/roles/${roleId}`);
      loadScriptDetail(selectedScript);
    }
  };

  const openDetail = async (script: Script) => {
    setSelectedScript(script);
    await loadScriptDetail(script);
    setShowDetail(true);
  };

  const openEdit = (script: Script) => {
    setEditingScript(script);
    
    // 解析字符串数组为Role对象数组
    const parseRoles = (roles: string[]): Role[] => {
      return roles.map(roleStr => {
        const match = roleStr.match(/^(.+?)\s*\((.*?)\)$/);
        if (match) {
          const [, name, gender] = match;
          return { name: name.trim(), gender: gender.trim() };
        }
        return { name: roleStr.trim(), gender: undefined };
      });
    };
    
    setFormData({
      name: script.name,
      minDuration: String(script.min_duration / 60), // 分钟转小时（最短时长）
      maxDuration: String(script.max_duration / 60), // 分钟转小时（最长时长）
      dmGender: script.dm_gender ?? '未指定',
      playerRoles: parseRoles(script.player_roles || []),
      actorRoles: parseRoles(script.actor_roles || []),
    });
    setShowForm(true);
  };

  const formatDuration = (minutes: number, maxMinutes?: number) => {
    const hours = minutes / 60;
    // 如果是整数小时，显示小时；否则显示小数小时
    let result = hours === Math.floor(hours) ? `${hours}小时` : `${hours.toFixed(1)}小时`;
    if (maxMinutes !== undefined && maxMinutes !== minutes) {
      const maxHours = maxMinutes / 60;
      const maxStr = maxHours === Math.floor(maxHours) ? `${maxHours}小时` : `${maxHours.toFixed(1)}小时`;
      result = `${result}~${maxStr}`;
    }
    return result;
  };

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-bold text-gray-800">剧本管理</h2>
        <button
          onClick={() => {
            setEditingScript(null);
            setFormData({ name: '', minDuration: '', maxDuration: '', dmGender: '未指定', playerRoles: [], actorRoles: [] });
            setShowForm(true);
          }}
          className="px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors"
        >
          + 添加剧本
        </button>
      </div>

      <section className="mb-6 rounded-lg border border-indigo-100 bg-indigo-50/60 p-4">
        <div className="flex items-center justify-between gap-3 mb-3">
          <div>
            <h3 className="font-bold text-gray-800">公共剧本模版库</h3>
            <p className="text-sm text-gray-500 mt-1">这里展示超管审核通过的公共模版；你新建的剧本会先进入主库候选，审核通过后其他店家可导入。</p>
          </div>
          {templateMsg && <span className="text-sm text-indigo-600 font-medium">{templateMsg}</span>}
        </div>
        {templates.length === 0 ? (
          <p className="text-sm text-gray-500">暂无公共模版</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
            {templates.map(template => (
              <article key={template.id} className="rounded-lg border border-indigo-100 bg-white p-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h4 className="font-semibold text-gray-800">{template.name}</h4>
                    <p className="text-xs text-gray-500 mt-1">
                      {template.min_duration_hours}~{template.max_duration_hours}小时 · 玩家{template.player_roles?.length || 0} · 卡司{template.actor_roles?.length || 0} · 已导入{template.usage_count || 0}次
                    </p>
                  </div>
                  <button
                    onClick={() => importTemplate(template)}
                    className="shrink-0 px-3 py-1.5 rounded-lg bg-indigo-500 text-white text-sm hover:bg-indigo-600"
                  >
                    一键导入
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      {showForm && (
        <div className="mb-6 p-4 bg-gray-50 rounded-lg">
          <h3 className="font-medium mb-4">{editingScript ? '编辑剧本' : '添加剧本'}</h3>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">剧本名称</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                  placeholder="剧本名称"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">最短时长（小时）</label>
                <input
                  type="number"
                  step="0.5"
                  value={formData.minDuration}
                  onChange={(e) => setFormData({ ...formData, minDuration: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                  placeholder="3"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">最长时长（小时）</label>
                <input
                  type="number"
                  step="0.5"
                  value={formData.maxDuration}
                  onChange={(e) => setFormData({ ...formData, maxDuration: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                  placeholder="4"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">DM性别</label>
                <select
                  value={formData.dmGender}
                  onChange={(e) => setFormData({ ...formData, dmGender: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                >
                  <option value="未指定">未指定</option>
                  <option value="男">男</option>
                  <option value="女">女</option>
                  <option value="其他">其他</option>
                </select>
              </div>
            </div>

            {/* 玩家扮演角色 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                玩家扮演角色 <span className="text-orange-500 font-bold">({formData.playerRoles.length}人)</span>
              </label>
              
              {/* 批量输入 */}
              <div className="mb-4">
                <textarea
                  value={batchPlayerRoles}
                  onChange={(e) => setBatchPlayerRoles(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                  placeholder="输入多个角色名，用逗号、换行或空格分隔，例如：侦探,医生,护士,凶手"
                  rows={2}
                />
                <div className="flex justify-end mt-2">
                  <button
                    type="button"
                    onClick={handleBatchAddPlayerRoles}
                    className="px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600"
                  >
                    批量添加
                  </button>
                </div>
              </div>
              
              {/* 角色列表 - 可设置性别 */}
              <div className="space-y-2">
                {formData.playerRoles.length === 0 ? (
                  <p className="text-gray-400 text-sm italic">暂无玩家角色</p>
                ) : (
                  formData.playerRoles.map((role, index) => (
                    <div key={index} className="flex items-center gap-2 p-2 bg-blue-50 rounded">
                      <span className="flex-1 font-medium">{role.name}</span>
                      <select
                        value={role.gender || '未指定'}
                        onChange={(e) => {
                          const newRoles = [...formData.playerRoles];
                          newRoles[index] = { ...role, gender: e.target.value };
                          setFormData({ ...formData, playerRoles: newRoles });
                        }}
                        className="px-2 py-1 border border-gray-300 rounded text-sm"
                      >
                        <option value="未指定">未指定</option>
                        <option value="男">男</option>
                        <option value="女">女</option>
                        <option value="其他">其他</option>
                      </select>
                      <button
                        type="button"
                        onClick={() => {
                          setFormData({
                            ...formData,
                            playerRoles: formData.playerRoles.filter((_, i) => i !== index)
                          });
                        }}
                        className="text-red-500 hover:text-red-700 text-sm"
                      >
                        ✕
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* 卡司扮演角色 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                卡司扮演角色 <span className="text-purple-500 font-bold">({formData.actorRoles.length}人)</span>
              </label>
              
              {/* 批量输入 */}
              <div className="mb-4">
                <textarea
                  value={batchActorRoles}
                  onChange={(e) => setBatchActorRoles(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                  placeholder="输入多个角色名，用逗号、换行或空格分隔，例如：DM,NPC1,NPC2,法官"
                  rows={2}
                />
                <div className="flex justify-end mt-2">
                  <button
                    type="button"
                    onClick={handleBatchAddActorRoles}
                    className="px-4 py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600"
                  >
                    批量添加
                  </button>
                </div>
              </div>
              
              {/* 角色列表 - 可设置性别 */}
              <div className="space-y-2">
                {formData.actorRoles.length === 0 ? (
                  <p className="text-gray-400 text-sm italic">暂无卡司角色</p>
                ) : (
                  formData.actorRoles.map((role, index) => (
                    <div key={index} className="flex items-center gap-2 p-2 bg-purple-50 rounded">
                      <span className="flex-1 font-medium">{role.name}</span>
                      <select
                        value={role.gender || '未指定'}
                        onChange={(e) => {
                          const newRoles = [...formData.actorRoles];
                          newRoles[index] = { ...role, gender: e.target.value };
                          setFormData({ ...formData, actorRoles: newRoles });
                        }}
                        className="px-2 py-1 border border-gray-300 rounded text-sm"
                      >
                        <option value="未指定">未指定</option>
                        <option value="男">男</option>
                        <option value="女">女</option>
                        <option value="其他">其他</option>
                      </select>
                      <button
                        type="button"
                        onClick={() => {
                          setFormData({
                            ...formData,
                            actorRoles: formData.actorRoles.filter((_, i) => i !== index)
                          });
                        }}
                        className="text-red-500 hover:text-red-700 text-sm"
                      >
                        ✕
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="flex gap-2 justify-end">
              <button
                type="submit"
                disabled={loading}
                className="px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 disabled:opacity-50"
              >
                {loading ? '保存中...' : '保存'}
              </button>
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="px-4 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400"
              >
                取消
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {scripts.map((script) => (
          <div
            key={script.id}
            className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow cursor-pointer"
            onClick={() => openDetail(script)}
          >
            <div className="flex justify-between items-start">
              <div>
                <h3 className="font-medium text-lg text-gray-800">{script.name}</h3>
                <p className="text-sm text-gray-500 mt-1">
                  ⏱️ {formatDuration(script.min_duration, script.max_duration)} · 👤 玩家{script.player_count || 0}人 · 🎭 卡司{script.actor_count || 0}人
                </p>
              </div>
              <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
                <button
                  onClick={() => openEdit(script)}
                  className="text-blue-500 hover:text-blue-700 text-sm"
                >
                  编辑
                </button>
                <button
                  onClick={() => publishTemplate(script)}
                  className="text-indigo-500 hover:text-indigo-700 text-sm"
                >
                  提交主库审核
                </button>
                <button
                  onClick={() => handleDelete(script.id)}
                  className="text-red-500 hover:text-red-700 text-sm"
                >
                  删除
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {scripts.length === 0 && !loading && (
        <div className="text-center py-12 text-gray-500">
          暂无剧本，点击上方按钮添加
        </div>
      )}

      {/* 剧本详情弹窗 */}
      {showDetail && selectedScript && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-2xl max-h-[80vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <div>
                <h3 className="text-lg font-bold">{selectedScript.name}</h3>
                <p className="text-sm text-gray-500">
                  ⏱️ {formatDuration(selectedScript.min_duration, selectedScript.max_duration)} · 👤 玩家{selectedScript.player_count || 0}人 · 🎭 卡司{selectedScript.actor_count || 0}人
                </p>
              </div>
              <button
                onClick={() => setShowDetail(false)}
                className="text-gray-500 hover:text-gray-700"
              >
                ✕
              </button>
            </div>

            {/* 角色配置 */}
            <div className="mb-6">
              <h4 className="font-medium mb-3">角色配置</h4>

              {scriptRoles.length === 0 ? (
                <p className="text-gray-500 text-sm">暂无角色配置</p>
              ) : (
                <div className="space-y-2">
                  {scriptRoles.map((role) => (
                    <div
                      key={role.id}
                      className="flex justify-between items-center p-2 bg-gray-50 rounded"
                    >
                      <div>
                        <span className="font-medium">{role.role_name}</span>
                        <span className="text-sm text-gray-500 ml-2">
                          {role.required_duration
                            ? `${(role.start_offset / 60).toFixed(1)}小时后开始，持续${(role.required_duration / 60).toFixed(1)}小时`
                            : '全程参与'}
                        </span>
                      </div>
                      <button
                        onClick={() => handleDeleteRole(role.id)}
                        className="text-red-500 hover:text-red-700 text-sm"
                      >
                        删除
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* 会开的卡司 */}
            <div>
              <h4 className="font-medium mb-3">会开此本的卡司 ({skilledActors.length})</h4>
              {skilledActors.length === 0 ? (
                <p className="text-gray-500 text-sm">暂无卡司会开此本</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {skilledActors.map((actor) => (
                    <span
                      key={actor.id}
                      className="px-3 py-1 bg-purple-100 text-purple-700 rounded-full text-sm"
                    >
                      {actor.actor_name}
                    </span>
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
