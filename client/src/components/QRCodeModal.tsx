import { useState } from 'react';
import { format, parseISO } from 'date-fns';
import { zhCN } from 'date-fns/locale';
import { QRCodeSVG } from 'qrcode.react';
import { CHECKIN_BASE_URL } from '../config';
import { useScheduleCheckins } from '../hooks/useScheduleCheckins';
import CheckInRoles from './CheckInRoles';

interface RoleItem {
  name: string;
  gender?: string;
}
interface QRCodeModalProps {
  schedule: { id: string; script_name: string; start_time: string; room_name?: string; player_roles?: RoleItem[] | string; status?: string } | null;
  visible: boolean;
  onClose: () => void;
  onKickGuest?: (guestName: string, role: string) => void;
}

type Tab = 'checkin' | 'evaluate';

export default function QRCodeModal({ schedule, visible, onClose, onKickGuest }: QRCodeModalProps) {
  const [tab, setTab] = useState<Tab>('checkin');
  const { count, checkins } = useScheduleCheckins(schedule?.id);

  if (!visible || !schedule) return null;

  const evaluateUrl = `${CHECKIN_BASE_URL}/evaluate/${schedule.id}`;
  const checkinUrl = `${CHECKIN_BASE_URL}/checkin/${schedule.id}`;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-sm">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-bold">分享二维码</h3>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">✕</button>
        </div>

        <div className="bg-blue-50 rounded-lg p-3 mb-4">
          <h4 className="font-medium text-blue-900 mb-0.5">{schedule.script_name}</h4>
          <p className="text-sm text-blue-700">
            {format(parseISO(schedule.start_time), 'MM月dd日 HH:mm', { locale: zhCN })}
            {schedule.room_name && ` · ${schedule.room_name}`}
          </p>
        </div>

        {/* Tab 切换：签到码 / 评价码 */}
        <div className="flex bg-gray-100 rounded-lg p-1 mb-4">
          <button
            onClick={() => setTab('checkin')}
            className={`flex-1 py-1.5 text-sm font-medium rounded-md transition-colors ${
              tab === 'checkin' ? 'bg-white text-blue-600 shadow' : 'text-gray-500'
            }`}
          >
            签到码
          </button>
          <button
            onClick={() => setTab('evaluate')}
            className={`flex-1 py-1.5 text-sm font-medium rounded-md transition-colors ${
              tab === 'evaluate' ? 'bg-white text-orange-600 shadow' : 'text-gray-500'
            }`}
          >
            评价码
          </button>
        </div>

        {tab === 'checkin' ? (
          <>
            <div className="text-center">
              <div className="bg-gray-100 p-4 rounded-lg mb-3 inline-block">
                <QRCodeSVG value={checkinUrl} size={200} level="M" includeMargin />
              </div>
              <p className="text-sm text-gray-600 mb-3">
                已有 <span className="font-bold text-blue-600">{count}</span> 人扫码上车
              </p>
              
              {/* 客服填写按钮 */}
              <div className="mt-3 mb-3">
                <button
                  onClick={() => {
                    // 客服填写链接 - 直接跳转到签到页面，无需扫码
                    window.open(`${checkinUrl}?staff=true`, '_blank');
                  }}
                  className="px-4 py-2 bg-indigo-500 text-white rounded-lg hover:bg-indigo-600 transition-colors text-sm"
                >
                  👨‍💼 客服填写（无需扫码）
                </button>
                <p className="text-xs text-gray-500 mt-1">
                  客服点击此按钮直接填写信息，无需扫码
                </p>
              </div>
            </div>
            {schedule.player_roles && (
              <CheckInRoles
                checkins={checkins}
                playerRoles={Array.isArray(schedule.player_roles) ? schedule.player_roles.map((r: any) => r.name || r) : []}
                onKickGuest={onKickGuest}
              />
            )}
          </>
        ) : (
          <div className="text-center">
            <div className="bg-orange-50 border border-orange-200 p-3 rounded-lg mb-3">
              <p className="text-sm text-orange-700">打完本后请客户扫码评价</p>
            </div>
            <div className="bg-gray-100 p-4 rounded-lg mb-3 inline-block">
              <QRCodeSVG value={evaluateUrl} size={200} level="M" includeMargin />
            </div>
            <p className="text-sm text-gray-500">评价结果可在剧本管理中查看</p>
          </div>
        )}

        <button
          onClick={onClose}
          className="w-full mt-4 px-4 py-2 bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200 transition-colors"
        >
          关闭
        </button>
      </div>
    </div>
  );
}
