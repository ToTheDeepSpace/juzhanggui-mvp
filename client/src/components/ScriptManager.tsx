import { useState, useEffect } from 'react';
import { useApi } from '../hooks/useApi';
import type { Script, ScriptRole, ActorSkill, Role, ScriptTemplate, ScriptBoard } from '../types';

const SCRIPT_TYPE_OPTIONS = [
  { value: '', label: '未设置类型' },
  { value: 'emotional', label: '情感本' },
  { value: 'comedy', label: '欢乐本' },
  { value: 'horror', label: '恐怖本' },
  { value: 'mechanism', label: '机制本' },
  { value: 'faction', label: '阵营本' },
];

const DISTRIBUTION_TYPE_OPTIONS = [
  { value: '', label: '未设置发行形态' },
  { value: 'city_limited', label: '城限' },
  { value: 'boxed', label: '盒装' },
  { value: 'exclusive', label: '独家' },
];
const ROLE_KIND_OPTIONS = [
  { value: 'dm', label: 'DM' },
  { value: 'field_control', label: '场控' },
  { value: 'npc', label: 'NPC' },
  { value: 'assistant', label: '助演' },
  { value: 'other', label: '其他' },
];
const GENDER_OPTIONS = ['未指定', '男', '女', '可男可女', '其他'];

const scriptTypeLabel = (value?: string | null) => SCRIPT_TYPE_OPTIONS.find(option => option.value === value)?.label || '未设置类型';
const distributionTypeLabel = (value?: string | null) => DISTRIBUTION_TYPE_OPTIONS.find(option => option.value === value)?.label || '未设置发行形态';
const roleKindLabel = (value?: string | null) => ROLE_KIND_OPTIONS.find(option => option.value === value)?.label || 'DM';

type BoardForm = {
  id?: string;
  name: string;
  playerCount: string;
  notes: string;
  isDefault: boolean;
  roles: string[];
  actorRoleGenders: Record<string, string>;
  playerRoles: string[];
  playerRoleGenders: Record<string, string>;
};

const standardBoard = (): BoardForm => ({
  name: '标准版',
  playerCount: '',
  notes: '',
  isDefault: true,
  roles: [],
  actorRoleGenders: {},
  playerRoles: [],
  playerRoleGenders: {},
});

const emptyScriptForm = () => ({
  name: '',
  scriptType: '',
  distributionType: '',
  minDuration: '',
  maxDuration: '',
  playerCount: '',
  playerSelectionRule: '',
  playerRoles: [] as Role[],
  actorRoles: [] as Role[],
  boards: [standardBoard()],
});

const boardFormsFromScript = (script: Script): BoardForm[] => {
  const boards = script.boards || [];
  if (!boards.length) {
    const actorRoles = script.actor_role_details?.map(role => role.name) || script.actor_roles || [];
    const playerRoles = script.player_roles || [];
    return [{
      ...standardBoard(),
      playerCount: script.player_count ? String(script.player_count) : '',
      roles: actorRoles,
      actorRoleGenders: Object.fromEntries((script.actor_role_details || []).map(role => [role.name, role.gender || ''])),
      playerRoles,
    }];
  }
  return boards.map((board: ScriptBoard, index) => ({
    id: board.id,
    name: board.name || (index === 0 ? '标准版' : `板子${index + 1}`),
    playerCount: board.player_count ? String(board.player_count) : '',
    notes: board.notes || '',
    isDefault: board.is_default === true || index === 0,
    roles: (board.roles || []).map(role => role.role_name),
    actorRoleGenders: Object.fromEntries((board.roles || []).map(role => [role.role_name, role.gender || ''])),
    playerRoles: (board.player_roles || []).map(role => role.role_name),
    playerRoleGenders: Object.fromEntries((board.player_roles || []).map(role => [role.role_name, role.gender || ''])),
  }));
};

const scriptPlayerSummary = (script: Pick<Script, 'player_count' | 'role_count' | 'candidate_player_count' | 'player_roles' | 'player_selection_rule' | 'selection_summary'>) => {
  const players = Number(script.player_count || 0);
  const candidates = Number(script.candidate_player_count || script.role_count || script.player_roles?.length || 0);
  const rule = script.player_selection_rule || script.selection_summary || (players && candidates > players ? `${candidates}选${players}` : '');
  return {
    players,
    candidates,
    rule,
    text: rule ? `开本${players || '-'}人 · 候选玩家${candidates}个 · ${rule}` : `开本${players || '-'}人 · 候选玩家${candidates}个`,
  };
};

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
  const [formData, setFormData] = useState(emptyScriptForm());


  const [batchPlayerRoles, setBatchPlayerRoles] = useState('');
  const [batchActorRoles, setBatchActorRoles] = useState('');
  const [templateMsg, setTemplateMsg] = useState('');
  const [templateSearch, setTemplateSearch] = useState('');

  const normalizedTemplateSearch = templateSearch.trim().toLowerCase();
  const visibleTemplates = normalizedTemplateSearch
    ? templates.filter(template => {
        const searchText = [
          template.name,
          ...(template.player_roles || []).map(role => role.role_name),
          ...(template.actor_roles || []).map(role => role.role_name),
        ].join(' ').toLowerCase();
        return searchText.includes(normalizedTemplateSearch);
      })
    : [];

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
    const result = await get<{ roles?: ScriptRole[]; skilledActors?: ActorSkill[]; skilled_actors?: ActorSkill[] }>(`/scripts/${script.id}`);
    if (result.success && result.data) {
      setScriptRoles(result.data.roles || []);
      setSkilledActors(result.data.skilledActors || result.data.skilled_actors || []);
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

  const syncBoardsForActorRoles = (boards: BoardForm[], nextActorRoles: Role[], previousActorRoles = formData.actorRoles) => {
    const nextNames = nextActorRoles.map(role => role.name);
    const previousNames = previousActorRoles.map(role => role.name);
    const nextNameSet = new Set(nextNames);
    const previousAllSelected = (board: BoardForm) => previousNames.length > 0 && board.roles.length === previousNames.length && previousNames.every(name => board.roles.includes(name));
    const normalizedBoards = (boards.length ? boards : [standardBoard()]).map((board, index) => {
      const keepAll = board.isDefault && (board.roles.length === 0 || previousAllSelected(board));
      return {
        ...board,
        name: board.name || (index === 0 ? '标准版' : `板子${index + 1}`),
        roles: keepAll ? nextNames : board.roles.filter(roleName => nextNameSet.has(roleName)),
        actorRoleGenders: Object.fromEntries(
          Object.entries(board.actorRoleGenders || {}).filter(([roleName]) => nextNameSet.has(roleName))
        ),
      };
    });
    if (!normalizedBoards.some(board => board.isDefault) && normalizedBoards.length) normalizedBoards[0].isDefault = true;
    return normalizedBoards;
  };

  const syncBoardsForPlayerRoles = (boards: BoardForm[], nextPlayerRoles: Role[], previousPlayerRoles = formData.playerRoles) => {
    const nextNames = nextPlayerRoles.map(role => role.name);
    const previousNames = previousPlayerRoles.map(role => role.name);
    const nextNameSet = new Set(nextNames);
    const previousAllSelected = (board: BoardForm) => previousNames.length > 0 && board.playerRoles.length === previousNames.length && previousNames.every(name => board.playerRoles.includes(name));
    return (boards.length ? boards : [standardBoard()]).map((board, index) => {
      const keepAll = board.isDefault && (board.playerRoles.length === 0 || previousAllSelected(board));
      return {
        ...board,
        name: board.name || (index === 0 ? '标准版' : `板子${index + 1}`),
        playerRoles: keepAll ? nextNames : board.playerRoles.filter(roleName => nextNameSet.has(roleName)),
        playerRoleGenders: Object.fromEntries(
          Object.entries(board.playerRoleGenders || {}).filter(([roleName]) => nextNameSet.has(roleName))
        ),
      };
    });
  };

  const actorRoleKindByName = () => new Map(formData.actorRoles.map(role => [role.name, role.role_kind || 'dm']));
  const actorRoleGenderByName = () => new Map(formData.actorRoles.map(role => [role.name, role.gender || '']));
  const playerRoleGenderByName = () => new Map(formData.playerRoles.map(role => [role.name, role.gender || '']));

  const setDefaultBoard = (index: number) => {
    setFormData({
      ...formData,
      boards: formData.boards.map((board, boardIndex) => ({ ...board, isDefault: boardIndex === index, name: boardIndex === index && !board.name ? '标准版' : board.name })),
    });
  };

  const updateBoard = (index: number, patch: Partial<BoardForm>) => {
    setFormData({
      ...formData,
      boards: formData.boards.map((board, boardIndex) => boardIndex === index ? { ...board, ...patch } : board),
    });
  };

  const toggleBoardRole = (boardIndex: number, roleName: string) => {
    const board = formData.boards[boardIndex];
    if (!board) return;
    const checked = board.roles.includes(roleName);
    const roles = checked ? board.roles.filter(name => name !== roleName) : [...board.roles, roleName];
    const actorRoleGenders = { ...(board.actorRoleGenders || {}) };
    if (checked) delete actorRoleGenders[roleName];
    updateBoard(boardIndex, { roles, actorRoleGenders });
  };

  const updateBoardActorGender = (boardIndex: number, roleName: string, gender: string) => {
    const board = formData.boards[boardIndex];
    if (!board) return;
    updateBoard(boardIndex, { actorRoleGenders: { ...(board.actorRoleGenders || {}), [roleName]: gender } });
  };

  const toggleBoardPlayerRole = (boardIndex: number, roleName: string) => {
    const board = formData.boards[boardIndex];
    if (!board) return;
    const checked = board.playerRoles.includes(roleName);
    const playerRoles = checked ? board.playerRoles.filter(name => name !== roleName) : [...board.playerRoles, roleName];
    const playerRoleGenders = { ...(board.playerRoleGenders || {}) };
    if (checked) delete playerRoleGenders[roleName];
    updateBoard(boardIndex, { playerRoles, playerRoleGenders });
  };

  const updateBoardPlayerGender = (boardIndex: number, roleName: string, gender: string) => {
    const board = formData.boards[boardIndex];
    if (!board) return;
    updateBoard(boardIndex, { playerRoleGenders: { ...(board.playerRoleGenders || {}), [roleName]: gender } });
  };

  // 批量添加玩家角色
  const handleBatchAddPlayerRoles = () => {
    const names = parseRoleNames(batchPlayerRoles);
    if (names.length === 0) return;
    
    const existingNames = new Set(formData.playerRoles.map(r => r.name));
    const newRoles = names
      .filter(name => !existingNames.has(name))
      .map(name => ({ name, gender: '未指定', role_kind: 'dm' }));
    
    if (newRoles.length > 0) {
      const nextPlayerRoles = [...formData.playerRoles, ...newRoles];
      setFormData({
        ...formData,
        playerRoles: nextPlayerRoles,
        boards: syncBoardsForPlayerRoles(formData.boards, nextPlayerRoles),
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
      .map(name => ({ name, gender: '未指定', role_kind: 'dm' }));
    
    if (newRoles.length > 0) {
      const nextActorRoles = [...formData.actorRoles, ...newRoles];
      setFormData({
        ...formData,
        actorRoles: nextActorRoles,
        boards: syncBoardsForActorRoles(formData.boards, nextActorRoles),
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
    if (!formData.playerCount || parseInt(formData.playerCount) <= 0) {
      alert('请输入开本人数');
      return;
    }
    if (formData.playerRoles.length === 0 && formData.actorRoles.length === 0) {
      alert('请至少添加一个角色（玩家或卡司）');
      return;
    }
    const roleKindMap = actorRoleKindByName();
    const actorGenderMap = actorRoleGenderByName();
    const playerGenderMap = playerRoleGenderByName();
    
    const data = {
      name: formData.name.trim(),
      scriptType: formData.scriptType || null,
      distributionType: formData.distributionType || null,
      minDuration: Math.round(parseFloat(formData.minDuration) * 60), // 小时转分钟
      maxDuration: Math.round(parseFloat(formData.maxDuration) * 60), // 小时转分钟
      playerCount: parseInt(formData.playerCount),
      playerSelectionRule: formData.playerSelectionRule.trim() || null,
      playerRoles: formData.playerRoles.map(r => r.gender && r.gender !== '未指定' ? `${r.name}(${r.gender})` : r.name),
      actorRoles: formData.actorRoles.map(r => ({ name: r.name, gender: r.gender || '', role_kind: r.role_kind || 'dm' })),
      boards: formData.boards.map((board, index) => ({
        id: board.id,
        name: board.name.trim() || (index === 0 ? '标准版' : `板子${index + 1}`),
        player_count: board.playerCount ? parseInt(board.playerCount) : parseInt(formData.playerCount),
        notes: board.notes.trim() || null,
        is_default: board.isDefault,
        sort_order: index,
        roles: board.roles.map(roleName => ({
          role_name: roleName,
          gender: board.actorRoleGenders?.[roleName] || actorGenderMap.get(roleName) || '',
          role_kind: roleKindMap.get(roleName) || 'dm',
        })),
        player_roles: board.playerRoles.map(roleName => ({
          role_name: roleName,
          gender: board.playerRoleGenders?.[roleName] || playerGenderMap.get(roleName) || '',
        })),
      })),
    };

    let result;
    if (editingScript) {
      result = await put(`/scripts/${editingScript.id}`, data);
    } else {
      result = await post('/scripts', data);
    }

    if (result.success) {
      setFormData(emptyScriptForm());
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
    const parseRoles = (roles: string[], details?: { name: string; gender?: string; role_kind?: string }[]): Role[] => {
      if (details?.length) return details.map(role => ({ name: role.name, gender: role.gender, role_kind: role.role_kind || 'dm' }));
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
      scriptType: script.script_type || '',
      distributionType: script.distribution_type || '',
      minDuration: String(script.min_duration / 60), // 分钟转小时（最短时长）
      maxDuration: String(script.max_duration / 60), // 分钟转小时（最长时长）
      playerCount: String(script.player_count || script.player_roles?.length || ''),
      playerSelectionRule: script.player_selection_rule || '',
      playerRoles: parseRoles(script.player_roles || []),
      actorRoles: parseRoles(script.actor_roles || [], script.actor_role_details),
      boards: boardFormsFromScript(script),
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

  const scriptMissingItems = (script: Script) => [
    !script.min_duration && !script.max_duration ? '时长' : '',
    !script.player_count ? '开本人数' : '',
    !(script.role_count || script.player_roles?.length) ? '玩家角色库' : '',
    !(script.actor_count || script.actor_roles?.length) ? '演绎角色库' : '',
    !(script.boards?.length) ? '演绎板子' : '',
  ].filter(Boolean);

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-bold text-gray-800">剧本管理</h2>
        <button
          onClick={() => {
            setEditingScript(null);
            setFormData(emptyScriptForm());
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
        <div className="mb-3">
          <label className="sr-only" htmlFor="script-template-search">搜索公共剧本模版</label>
          <input
            id="script-template-search"
            type="search"
            value={templateSearch}
            onChange={(e) => setTemplateSearch(e.target.value)}
            className="w-full rounded-lg border border-indigo-100 bg-white px-3 py-2 text-sm text-gray-800 placeholder:text-gray-400 focus:border-indigo-300 focus:outline-none focus:ring-2 focus:ring-indigo-100"
            placeholder="搜索剧本名 / 玩家角色 / 卡司角色"
          />
        </div>
        {templates.length === 0 ? (
          <p className="text-sm text-gray-500">暂无公共模版</p>
        ) : !normalizedTemplateSearch ? (
          <p className="rounded-lg border border-dashed border-indigo-100 bg-white/70 px-3 py-4 text-sm text-gray-500">
            输入关键词后显示匹配模版，避免公共主库一次性铺满页面。
          </p>
        ) : visibleTemplates.length === 0 ? (
          <p className="rounded-lg border border-dashed border-indigo-100 bg-white/70 px-3 py-4 text-sm text-gray-500">
            没有匹配的公共模版，换个剧本名或角色名试试。
          </p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
            {visibleTemplates.map(template => (
              <article key={template.id} className="rounded-lg border border-indigo-100 bg-white p-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h4 className="font-semibold text-gray-800">{template.name}</h4>
                    <p className="text-xs text-gray-500 mt-1">
                      {template.min_duration_hours}~{template.max_duration_hours}小时 · 开本{template.player_count || template.player_roles?.length || 0}人 · 候选玩家{template.player_roles?.length || 0}个 · 演绎板子{template.boards?.length || 0}套 · 已导入{template.usage_count || 0}次
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
                <label className="block text-sm font-medium text-gray-700 mb-1">剧本类型</label>
                <select
                  value={formData.scriptType}
                  onChange={(e) => setFormData({ ...formData, scriptType: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                >
                  {SCRIPT_TYPE_OPTIONS.map(option => <option key={option.value || 'blank'} value={option.value}>{option.label}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">发行形态</label>
                <select
                  value={formData.distributionType}
                  onChange={(e) => setFormData({ ...formData, distributionType: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                >
                  {DISTRIBUTION_TYPE_OPTIONS.map(option => <option key={option.value || 'blank'} value={option.value}>{option.label}</option>)}
                </select>
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
                <label className="block text-sm font-medium text-gray-700 mb-1">开本人数</label>
                <input
                  type="number"
                  min="1"
                  value={formData.playerCount}
                  onChange={(e) => setFormData({ ...formData, playerCount: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                  placeholder="例如：6"
                  required
                />
                <p className="mt-1 text-xs text-gray-500">角色库可以多于开本人数，例如 8 个可选角色里开 6 人。</p>
              </div>
              <div className="col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">开本/选角规则</label>
                <input
                  type="text"
                  value={formData.playerSelectionRule}
                  onChange={(e) => setFormData({ ...formData, playerSelectionRule: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                  placeholder="例如：8 个候选角色，任意开 6 人，2 个不上车"
                />
              </div>
            </div>

            {/* 玩家扮演角色 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                候选玩家角色 <span className="text-orange-500 font-bold">({formData.playerRoles.length}个)</span>
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
                  <p className="text-gray-400 text-sm italic">暂无候选玩家角色</p>
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
                        {GENDER_OPTIONS.map(option => <option key={option} value={option}>{option}</option>)}
                      </select>
                      <button
                        type="button"
                        onClick={() => {
                          const nextPlayerRoles = formData.playerRoles.filter((_, i) => i !== index);
                          setFormData({
                            ...formData,
                            playerRoles: nextPlayerRoles,
                            boards: syncBoardsForPlayerRoles(formData.boards, nextPlayerRoles),
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

            {/* 演绎角色库 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                演绎角色库 <span className="text-purple-500 font-bold">({formData.actorRoles.length}个)</span>
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
                  <p className="text-gray-400 text-sm italic">暂无演绎角色</p>
                ) : (
                  formData.actorRoles.map((role, index) => (
                    <div key={index} className="flex flex-wrap items-center gap-2 p-2 bg-purple-50 rounded">
                      <span className="flex-1 font-medium">{role.name}</span>
                      <select
                        value={role.role_kind || 'dm'}
                        onChange={(e) => {
                          const newRoles = [...formData.actorRoles];
                          newRoles[index] = { ...role, role_kind: e.target.value };
                          setFormData({ ...formData, actorRoles: newRoles });
                        }}
                        className="px-2 py-1 border border-gray-300 rounded text-sm"
                      >
                        {ROLE_KIND_OPTIONS.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
                      </select>
                      <select
                        value={role.gender || '未指定'}
                        onChange={(e) => {
                          const newRoles = [...formData.actorRoles];
                          newRoles[index] = { ...role, gender: e.target.value };
                          setFormData({ ...formData, actorRoles: newRoles });
                        }}
                        className="px-2 py-1 border border-gray-300 rounded text-sm"
                      >
                        {GENDER_OPTIONS.map(option => <option key={option} value={option}>{option}</option>)}
                      </select>
                      <button
                        type="button"
                        onClick={() => {
                          const nextActorRoles = formData.actorRoles.filter((_, i) => i !== index);
                          setFormData({
                            ...formData,
                            actorRoles: nextActorRoles,
                            boards: syncBoardsForActorRoles(formData.boards, nextActorRoles),
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

            <div className="rounded-lg border border-purple-100 bg-white p-4">
              <div className="mb-3 flex items-center justify-between gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700">演绎板子</label>
                  <p className="mt-1 text-xs text-gray-500">标准版默认存在；每个板子只勾本场实际需要的 DM/场控/NPC/助演角色。</p>
                </div>
                <button
                  type="button"
                  onClick={() => setFormData({
                    ...formData,
                    boards: [
                      ...formData.boards,
                      {
                        name: `板子${formData.boards.length + 1}`,
                        playerCount: formData.playerCount,
                        notes: '',
                        isDefault: false,
                        roles: formData.actorRoles.map(role => role.name),
                        actorRoleGenders: {},
                        playerRoles: formData.playerRoles.map(role => role.name),
                        playerRoleGenders: {},
                      },
                    ],
                  })}
                  className="px-3 py-1.5 rounded-lg border border-purple-200 text-sm text-purple-700 hover:bg-purple-50"
                >
                  + 添加板子
                </button>
              </div>
              {formData.actorRoles.length === 0 ? (
                <p className="text-sm text-gray-400">先添加演绎角色，再配置板子。</p>
              ) : (
                <div className="space-y-3">
                  {formData.boards.map((board, boardIndex) => (
                    <div key={`${board.id || 'new'}-${boardIndex}`} className="rounded-lg border border-gray-200 bg-gray-50 p-3">
                      <div className="grid grid-cols-1 gap-2 md:grid-cols-[1fr_120px_auto]">
                        <input
                          type="text"
                          value={board.name}
                          onChange={(e) => updateBoard(boardIndex, { name: e.target.value })}
                          className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
                          placeholder={boardIndex === 0 ? '标准版' : '板子名称'}
                        />
                        <input
                          type="number"
                          min="1"
                          value={board.playerCount}
                          onChange={(e) => updateBoard(boardIndex, { playerCount: e.target.value })}
                          className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
                          placeholder={formData.playerCount || '人数'}
                        />
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => setDefaultBoard(boardIndex)}
                            className={`px-3 py-2 rounded-lg text-sm ${board.isDefault ? 'bg-purple-600 text-white' : 'border border-gray-200 text-gray-600 hover:bg-white'}`}
                          >
                            {board.isDefault ? '标准' : '设标准'}
                          </button>
                          {formData.boards.length > 1 && (
                            <button
                              type="button"
                              onClick={() => setFormData({
                                ...formData,
                                boards: formData.boards.filter((_, index) => index !== boardIndex).map((item, index) => ({
                                  ...item,
                                  isDefault: item.isDefault || (board.isDefault && index === 0),
                                })),
                              })}
                              className="px-3 py-2 rounded-lg border border-red-200 text-sm text-red-600 hover:bg-red-50"
                            >
                              删除
                            </button>
                          )}
                        </div>
                      </div>
                      <textarea
                        value={board.notes}
                        onChange={(e) => updateBoard(boardIndex, { notes: e.target.value })}
                        className="mt-2 w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                        rows={2}
                        placeholder="备注，例如：双 DM 标准开法 / 单 DM 精简开法"
                      />
                      <div className="mt-3">
                        <p className="mb-2 text-xs font-medium text-purple-700">本板子演绎角色版本</p>
                        <div className="flex flex-wrap gap-2">
                        {formData.actorRoles.map(role => {
                          const checked = board.roles.includes(role.name);
                          return (
                            <span
                              key={`${boardIndex}-${role.name}`}
                              className={`inline-flex items-center gap-1 rounded-full border px-2 py-1 text-sm ${checked ? 'border-purple-300 bg-purple-100 text-purple-700' : 'border-gray-200 bg-white text-gray-500 hover:border-purple-200'}`}
                            >
                              <button type="button" onClick={() => toggleBoardRole(boardIndex, role.name)}>
                                {role.name} · {roleKindLabel(role.role_kind)}
                              </button>
                              {checked && (
                                <select
                                  value={board.actorRoleGenders?.[role.name] || role.gender || '未指定'}
                                  onChange={(e) => updateBoardActorGender(boardIndex, role.name, e.target.value)}
                                  onClick={(e) => e.stopPropagation()}
                                  className="rounded border border-purple-200 bg-white px-1 py-0.5 text-xs text-purple-700"
                                >
                                  {GENDER_OPTIONS.map(option => <option key={option} value={option}>{option}</option>)}
                                </select>
                              )}
                            </span>
                          );
                        })}
                        </div>
                      </div>
                      <div className="mt-3">
                        <p className="mb-2 text-xs font-medium text-blue-700">本板子玩家角色条件</p>
                        {formData.playerRoles.length === 0 ? (
                          <p className="text-xs text-gray-400">先添加候选玩家角色，再配置玩家条件。</p>
                        ) : (
                          <div className="flex flex-wrap gap-2">
                            {formData.playerRoles.map(role => {
                              const checked = board.playerRoles.includes(role.name);
                              return (
                                <span
                                  key={`${boardIndex}-player-${role.name}`}
                                  className={`inline-flex items-center gap-1 rounded-full border px-2 py-1 text-sm ${checked ? 'border-blue-300 bg-blue-100 text-blue-700' : 'border-gray-200 bg-white text-gray-500 hover:border-blue-200'}`}
                                >
                                  <button type="button" onClick={() => toggleBoardPlayerRole(boardIndex, role.name)}>
                                    {role.name}
                                  </button>
                                  {checked && (
                                    <select
                                      value={board.playerRoleGenders?.[role.name] || role.gender || '未指定'}
                                      onChange={(e) => updateBoardPlayerGender(boardIndex, role.name, e.target.value)}
                                      onClick={(e) => e.stopPropagation()}
                                      className="rounded border border-blue-200 bg-white px-1 py-0.5 text-xs text-blue-700"
                                    >
                                      {GENDER_OPTIONS.map(option => <option key={option} value={option}>{option}</option>)}
                                    </select>
                                  )}
                                </span>
                              );
                            })}
                          </div>
                        )}
                      </div>
                      <p className="mt-2 text-xs text-gray-500">本板子需要 {board.roles.length} 个演绎角色；玩家条件 {board.playerRoles.length} 个</p>
                    </div>
                  ))}
                </div>
              )}
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
        {scripts.map((script) => {
          const missingItems = scriptMissingItems(script);
          const playerSummary = scriptPlayerSummary(script);
          return (
          <div
            key={script.id}
            className={`border rounded-lg p-4 hover:shadow-md transition-shadow cursor-pointer ${missingItems.length ? 'border-orange-200 bg-orange-50/40' : 'border-gray-200'}`}
            onClick={() => openDetail(script)}
          >
            <div className="flex justify-between items-start">
              <div>
                <h3 className="font-medium text-lg text-gray-800">{script.name}</h3>
                <div className="mt-1 flex flex-wrap gap-1.5">
                  <span className="rounded-full bg-purple-50 px-2 py-0.5 text-xs font-medium text-purple-700">{scriptTypeLabel(script.script_type)}</span>
                  <span className="rounded-full bg-slate-50 px-2 py-0.5 text-xs font-medium text-slate-600">{distributionTypeLabel(script.distribution_type)}</span>
                </div>
                <p className="text-sm text-gray-500 mt-1">
                  ⏱️ {formatDuration(script.min_duration, script.max_duration)} · 👤 {playerSummary.text} · 🎭 演绎角色库{script.actor_count || 0}个 · 板子{script.boards?.length || 0}套
                </p>
                {(script.actor_role_details || []).length > 0 && (
                  <p className="mt-1 text-xs text-gray-500">
                    演绎角色库：{(script.actor_role_details || []).slice(0, 4).map(role => `${role.name}/${roleKindLabel(role.role_kind)}`).join('、')}
                  </p>
                )}
                {missingItems.length > 0 ? (
                  <p className="mt-2 inline-flex rounded-full bg-orange-100 px-2 py-1 text-xs font-medium text-orange-700">待补：{missingItems.join('、')}</p>
                ) : (
                  <p className="mt-2 inline-flex rounded-full bg-emerald-50 px-2 py-1 text-xs font-medium text-emerald-700">资料完整，可排期</p>
                )}
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
          );
        })}
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
                  {scriptTypeLabel(selectedScript.script_type)} · {distributionTypeLabel(selectedScript.distribution_type)} · ⏱️ {formatDuration(selectedScript.min_duration, selectedScript.max_duration)} · 👤 {scriptPlayerSummary(selectedScript).text} · 🎭 演绎角色库{selectedScript.actor_count || 0}个
                </p>
              </div>
              <button
                onClick={() => setShowDetail(false)}
                className="text-gray-500 hover:text-gray-700"
              >
                ✕
              </button>
            </div>

            <div className="mb-6 rounded-lg border border-blue-100 bg-blue-50/60 p-3">
              <h4 className="font-medium mb-2">开本规则</h4>
              <p className="text-sm text-blue-700">{scriptPlayerSummary(selectedScript).text}</p>
            </div>

            <div className="mb-6">
              <h4 className="font-medium mb-3">演绎板子 ({selectedScript.boards?.length || 0})</h4>
              {selectedScript.boards?.length ? (
                <div className="space-y-2">
                  {selectedScript.boards.map((board, index) => (
                    <div key={board.id || index} className="rounded-lg border border-purple-100 bg-purple-50/60 p-3">
                      <div className="flex items-center justify-between gap-3">
                        <p className="font-medium text-purple-900">{board.name || (index === 0 ? '标准版' : `板子${index + 1}`)}{board.is_default ? ' · 标准' : ''}</p>
                        <span className="text-xs text-purple-700">
                          开本{board.player_count || selectedScript.player_count || '-'}人 · {board.roles?.length || 0} 个演绎角色
                        </span>
                      </div>
                      {board.notes && <p className="mt-1 text-xs text-purple-700">{board.notes}</p>}
                      <div className="mt-2 flex flex-wrap gap-2">
                        {(board.roles || []).map(role => (
                          <span key={role.role_name} className="rounded-full border border-purple-100 bg-white px-2 py-1 text-xs text-purple-700">
                            {role.role_name}{role.gender && role.gender !== '未指定' ? `(${role.gender})` : ''} · {roleKindLabel(role.role_kind)}
                          </span>
                        ))}
                      </div>
                      {(board.player_roles || []).length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-2">
                          {(board.player_roles || []).map(role => (
                            <span key={`player-${role.role_name}`} className="rounded-full border border-blue-100 bg-white px-2 py-1 text-xs text-blue-700">
                              玩家：{role.role_name}{role.gender && role.gender !== '未指定' ? `(${role.gender})` : ''}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-gray-500 text-sm">暂无板子配置</p>
              )}
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
