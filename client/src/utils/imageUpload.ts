export type UploadImageKind = 'room' | 'actor' | 'external_npc' | 'positive_feedback';

function fileToDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('读取图片失败'));
    reader.readAsDataURL(file);
  });
}

export async function uploadImageFile(file: File, kind: UploadImageKind) {
  if (!file.type.startsWith('image/')) throw new Error('请上传图片文件');
  const dataUrl = await fileToDataUrl(file);
  const token = localStorage.getItem('admin_auth_token') || localStorage.getItem('auth_token');
  const res = await fetch('/api/uploads/images', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ kind, dataUrl }),
  });
  const data = await res.json();
  if (!data.success || !data.data?.url) throw new Error(data.error || '图片上传失败');
  return String(data.data.url);
}
