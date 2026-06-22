import { useState, useEffect } from 'react';
import { useApi } from '../hooks/useApi';
import type { Room } from '../types';
import { uploadImageFile } from '../utils/imageUpload';

export default function RoomManager() {
  const { get, post, put, del, loading } = useApi();
  const [rooms, setRooms] = useState<Room[]>([]);
  const [editingRoom, setEditingRoom] = useState<Room | null>(null);
  const [formData, setFormData] = useState({ name: '', capacity: '', photoUrl: '' });
  const [showForm, setShowForm] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    loadRooms();
  }, []);

  const loadRooms = async () => {
    const result = await get<Room[]>('/rooms');
    if (result.success && result.data) {
      setRooms(result.data);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    const data = {
      name: formData.name,
      capacity: parseInt(formData.capacity) || 0,
      photoUrl: formData.photoUrl || null,
    };

    let result;
    if (editingRoom) {
      result = await put(`/rooms/${editingRoom.id}`, data);
    } else {
      result = await post('/rooms', data);
    }

    if (!result.success) {
      setErrorMsg(result.error || '保存失败，请重试');
      return;
    }

    setFormData({ name: '', capacity: '', photoUrl: '' });
    setEditingRoom(null);
    setShowForm(false);
    loadRooms();
  };

  const handleEdit = (room: Room) => {
    setEditingRoom(room);
    setFormData({ name: room.name, capacity: String(room.capacity), photoUrl: room.photo_url || '' });
    setShowForm(true);
  };

  const handleUpload = async (file?: File | null) => {
    if (!file) return;
    setUploading(true);
    setErrorMsg(null);
    try {
      const url = await uploadImageFile(file, 'room');
      setFormData(data => ({ ...data, photoUrl: url }));
    } catch (error) {
      setErrorMsg(error instanceof Error ? error.message : '图片上传失败');
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (confirm('确定要删除这个房间吗？')) {
      await del(`/rooms/${id}`);
      loadRooms();
    }
  };

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-bold text-gray-800">房间管理</h2>
        <button
          onClick={() => {
            setEditingRoom(null);
            setFormData({ name: '', capacity: '', photoUrl: '' });
            setShowForm(true);
          }}
          className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors"
        >
          + 添加房间
        </button>
      </div>

      {errorMsg && (
        <div className="mb-4 p-3 bg-red-100 border border-red-300 text-red-700 rounded-lg">
          {errorMsg}
        </div>
      )}

      {showForm && (
        <div className="mb-6 p-4 bg-gray-50 rounded-lg">
          <h3 className="font-medium mb-4">{editingRoom ? '编辑房间' : '添加房间'}</h3>
          <form onSubmit={handleSubmit} className="flex flex-wrap gap-4 items-end">
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700 mb-1">房间名称</label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                placeholder="如：1号房间"
                required
              />
            </div>
            <div className="w-32">
              <label className="block text-sm font-medium text-gray-700 mb-1">容纳人数</label>
              <input
                type="number"
                value={formData.capacity}
                onChange={(e) => setFormData({ ...formData, capacity: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                placeholder="8"
              />
            </div>
            <div className="w-48">
              <label className="block text-sm font-medium text-gray-700 mb-1">房间照片</label>
              <div className="flex items-center gap-2">
                {formData.photoUrl ? (
                  <img src={formData.photoUrl} alt="" className="h-10 w-14 rounded object-cover border border-gray-200" />
                ) : (
                  <div className="h-10 w-14 rounded border border-dashed border-gray-300 bg-white" />
                )}
                <label className="cursor-pointer rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50">
                  {uploading ? '上传中' : '上传'}
                  <input type="file" accept="image/*" className="hidden" onChange={(e) => handleUpload(e.target.files?.[0])} disabled={uploading} />
                </label>
              </div>
            </div>
            <div className="flex gap-2">
              <button
                type="submit"
                disabled={loading}
                className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 disabled:opacity-50"
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
        {rooms.map((room) => (
          <div key={room.id} className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
            {room.photo_url && (
              <img src={room.photo_url} alt="" className="mb-3 h-32 w-full rounded-lg object-cover border border-gray-100" />
            )}
            <div className="flex justify-between items-start">
              <div>
                <h3 className="font-medium text-lg text-gray-800">{room.name}</h3>
                <p className="text-sm text-gray-500 mt-1">容纳 {room.capacity} 人</p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => handleEdit(room)}
                  className="text-blue-500 hover:text-blue-700 text-sm"
                >
                  编辑
                </button>
                <button
                  onClick={() => handleDelete(room.id)}
                  className="text-red-500 hover:text-red-700 text-sm"
                >
                  删除
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {rooms.length === 0 && !loading && (
        <div className="text-center py-12 text-gray-500">
          暂无房间，点击上方按钮添加
        </div>
      )}
    </div>
  );
}
