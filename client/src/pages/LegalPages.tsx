import { Link } from 'react-router-dom';
import ComplianceFooter, { CONTACT_EMAIL, ICP_RECORD_NO } from '../components/ComplianceFooter';
import Logo from '../components/Logo';

const BUSINESS_LICENSE_IMAGE = '/legal/business-license-huilan.jpg';

function LegalLayout({ title, intro, children }: { title: string; intro: string; children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-5 py-4">
          <Link to="/" className="flex items-center gap-3">
            <Logo size={32} />
            <span className="text-lg font-bold"><span className="text-indigo-500">剧</span>司辰</span>
          </Link>
          <Link to="/" className="text-sm font-medium text-indigo-600 hover:text-indigo-700">返回首页</Link>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-5 py-10">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-slate-950">{title}</h1>
          <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-600">{intro}</p>
        </div>
        <div className="space-y-6">{children}</div>
      </main>

      <ComplianceFooter />
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
      <h2 className="mb-4 text-lg font-bold text-slate-900">{title}</h2>
      <div className="space-y-3 text-sm leading-7 text-slate-600">{children}</div>
    </section>
  );
}

function InfoRows({ rows }: { rows: [string, string][] }) {
  return (
    <div className="divide-y divide-slate-100">
      {rows.map(([label, value]) => (
        <div key={label} className="grid gap-2 py-3 sm:grid-cols-[160px_1fr]">
          <span className="font-semibold text-slate-500">{label}</span>
          <span className="font-medium text-slate-800">{value}</span>
        </div>
      ))}
    </div>
  );
}

export function TermsPage() {
  return (
    <LegalLayout
      title="用户协议"
      intro="本协议适用于剧司辰提供的店家排期、拼车上车、评价反馈、模板主库等服务。继续使用本服务，即表示你理解并同意以下规则。"
    >
      <Section title="一、服务定位">
        <p>剧司辰是面向剧本杀、沉浸式娱乐等线下经营场景的运营工具，主要为店家提供排期、房间、卡司、剧本、拼车申请、评价反馈和经营数据管理能力。</p>
        <p>玩家侧功能用于扫码上车、提交拼车申请、评价反馈和后续身份沉淀。部分玩家身份能力可能跳转或打通至灵契。</p>
      </Section>
      <Section title="二、账号与使用规范">
        <p>用户应提供真实、准确、合法的信息，不得冒用他人身份、干扰平台运行、绕过审核或批量提交虚假数据。</p>
        <p>店家账号应妥善保管登录凭证。使用超管、店家、客服代填等管理能力时，应确保操作有真实业务依据。</p>
      </Section>
      <Section title="三、内容与审核">
        <p>用户提交的剧本模板、评价、拼车申请、备注、联系方式等内容不得违反法律法规、公序良俗或侵害他人合法权益。</p>
        <p>公共剧本模板进入主库前由超级管理员审核。平台可对明显错误、重复、侵权、涉敏或低质量内容进行驳回、隐藏、修正或删除。</p>
      </Section>
      <Section title="四、责任边界">
        <p>剧司辰提供信息化工具，不直接参与线下交易履约、玩家实际到场、店家服务质量或第三方争议的最终裁判。</p>
        <p>如因用户自行发布虚假、违法或侵权内容造成争议，应由发布者依法承担相应责任；平台将按法律法规和监管要求配合处理。</p>
      </Section>
      <Section title="五、联系方式">
        <p>如需咨询、投诉、申诉或处理账号问题，请发送邮件至 <a className="font-semibold text-indigo-600" href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>。</p>
      </Section>
    </LegalLayout>
  );
}

export function PrivacyPage() {
  return (
    <LegalLayout
      title="隐私政策"
      intro="本政策说明剧司辰在提供排期、拼车、评价和店家后台服务时如何收集、使用、保存和保护必要信息。"
    >
      <Section title="一、我们收集的信息">
        <p>账号信息：邮箱、手机号、昵称、店家名称、角色身份、登录状态等。</p>
        <p>业务信息：排期、房间、剧本、角色、拼车申请、客服代填上车记录、评价反馈、操作日志等。</p>
        <p>安全日志：账号 ID、IP 地址、User-Agent、操作时间、操作类型、对象 ID 等用于安全审计和异常排查的信息。</p>
      </Section>
      <Section title="二、使用目的">
        <p>我们使用上述信息用于账号登录、店家管理、排期确认、拼车申请处理、评价反馈展示、安全审计、客服支持、纠纷处理和依法配合监管要求。</p>
      </Section>
      <Section title="三、第三方服务">
        <p>当前服务可能使用腾讯云服务器、Supabase 数据库、腾讯云邮件/短信能力、支付宝等支付或基础设施服务。我们只在实现功能所需范围内处理必要信息。</p>
      </Section>
      <Section title="四、用户权利">
        <p>你可以通过客服邮箱联系我们，申请查询、更正、删除个人信息，或对账号、评价、拼车记录等问题提出申诉。依法或因安全审计需要保留的信息，平台会按法律法规要求处理。</p>
      </Section>
      <Section title="五、联系方式">
        <p>隐私请求请发送至 <a className="font-semibold text-indigo-600" href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>。ICP备案号：<a className="font-semibold text-indigo-600" href="https://beian.miit.gov.cn/" target="_blank" rel="noopener noreferrer">{ICP_RECORD_NO}</a>。</p>
      </Section>
    </LegalLayout>
  );
}

export function ContactPage() {
  return (
    <LegalLayout
      title="联系我们"
      intro="如需处理账号、发票、投诉、举报、隐私请求、店家合作或平台申诉，可以通过以下渠道联系剧司辰。"
    >
      <Section title="联系方式">
        <InfoRows rows={[
          ['客服邮箱', CONTACT_EMAIL],
          ['经营主体', '河北雄安澜洄娱乐有限公司'],
          ['ICP备案号', ICP_RECORD_NO],
          ['公安联网备案', '办理中，完成后将补充公示'],
        ]} />
        <p>邮件中请尽量说明问题类型、相关账号、排期/店家/评价 ID 或截图，以便快速处理。</p>
      </Section>
    </LegalLayout>
  );
}

export function BusinessLicensePage() {
  return (
    <LegalLayout
      title="经营主体信息"
      intro="本页面用于公示剧司辰当前运营主体、备案信息和营业执照。用户可结合国家企业信用信息公示系统等公开渠道自行核验主体登记信息。"
    >
      <Section title="一、经营主体">
        <InfoRows rows={[
          ['运营主体', '河北雄安澜洄娱乐有限公司'],
          ['统一社会信用代码', '91130629MAEX8NGU6H'],
          ['主体类型', '有限责任公司（自然人独资）'],
          ['成立日期', '2025年09月16日'],
          ['注册地址', '河北雄安新区容城县容城镇奥威路130号3幢1-076（自主申报）'],
          ['网站域名', 'jusichen.com'],
          ['ICP备案号', ICP_RECORD_NO],
          ['客服邮箱', CONTACT_EMAIL],
        ]} />
      </Section>

      <Section title="二、营业执照">
        <div className="rounded-xl border border-slate-200 bg-white p-3">
          <img src={BUSINESS_LICENSE_IMAGE} alt="河北雄安澜洄娱乐有限公司营业执照" className="block w-full rounded-lg" />
        </div>
      </Section>
    </LegalLayout>
  );
}
