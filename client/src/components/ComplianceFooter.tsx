import { Link } from 'react-router-dom';

export const ICP_RECORD_NO = '冀ICP备2026019163号-1';
export const MPS_RECORD_NO = '冀公网安备13310202000316号';
export const MPS_RECORD_URL = 'https://beian.mps.gov.cn/#/query/webSearch?code=13310202000316';
export const CONTACT_EMAIL = 'basara-twenty@foxmail.com';

interface ComplianceFooterProps {
  variant?: 'dark' | 'light';
}

export default function ComplianceFooter({ variant = 'light' }: ComplianceFooterProps) {
  const dark = variant === 'dark';
  const border = dark ? 'border-white/10' : 'border-gray-200';
  const text = dark ? 'text-gray-500' : 'text-gray-400';
  const link = dark ? 'text-indigo-300 hover:text-indigo-200' : 'text-indigo-500 hover:text-indigo-600';
  const muted = dark ? 'text-gray-600' : 'text-gray-400';

  return (
    <footer className={`border-t ${border} px-6 py-8 text-center text-sm ${text}`}>
      <div className="mx-auto max-w-6xl space-y-3">
        <p className={dark ? 'text-gray-400' : 'text-gray-500'}>剧司辰 · 剧本杀行业数字化运营平台</p>
        <p>剧司辰负责店家排期、经营数据与 DM 内部工作台，剧幕录负责玩家、DM 与社区身份沉淀</p>

        <div className="flex flex-wrap justify-center gap-x-4 gap-y-2">
          <Link to="/terms" className={`${link} transition-colors`}>用户协议</Link>
          <Link to="/privacy" className={`${link} transition-colors`}>隐私政策</Link>
          <Link to="/security-compliance" className={`${link} transition-colors`}>安全合规说明</Link>
          <Link to="/contact" className={`${link} transition-colors`}>联系我们</Link>
          <Link to="/business-license" className={`${link} transition-colors`}>经营主体信息</Link>
          <a href="https://jumulu.jusichen.com" target="_blank" rel="noopener noreferrer" className={`${link} transition-colors`}>剧幕录用户端</a>
          <Link to="/ai-readable" className={`${link} transition-colors`}>AI 可读说明</Link>
        </div>

        <div className="flex flex-wrap justify-center gap-x-4 gap-y-2 text-xs">
          <a href="https://beian.miit.gov.cn/" target="_blank" rel="noopener noreferrer" className={`${link} transition-colors`}>
            {ICP_RECORD_NO}
          </a>
          <a href={MPS_RECORD_URL} target="_blank" rel="noreferrer" className={`${link} transition-colors`}>
            {MPS_RECORD_NO}
          </a>
          <span className={muted}>增值电信业务经营许可：如业务形态需要将另行办理并公示</span>
        </div>

        <p className="text-xs">
          经营主体：河北雄安澜洄娱乐有限公司 · 客服邮箱：
          <a href={`mailto:${CONTACT_EMAIL}`} className={`${link} transition-colors`}>{CONTACT_EMAIL}</a>
        </p>
      </div>
    </footer>
  );
}
