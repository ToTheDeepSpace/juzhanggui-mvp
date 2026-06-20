import { Link } from 'react-router-dom';
import ComplianceFooter, { CONTACT_EMAIL, ICP_RECORD_NO, MPS_RECORD_NO, MPS_RECORD_URL } from '../components/ComplianceFooter';
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

function InfoRows({ rows }: { rows: [string, React.ReactNode][] }) {
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

function MpsRecordLink() {
  return <a className="font-semibold text-indigo-600" href={MPS_RECORD_URL} target="_blank" rel="noreferrer">{MPS_RECORD_NO}</a>;
}

export function TermsPage() {
  return (
    <LegalLayout
      title="用户协议"
      intro="本协议适用于剧司辰提供的店家排期、拼车上车、评价反馈、公共剧本模板、店内工作台、平台后台及相关服务。你注册、登录、访问或继续使用剧司辰，即视为已阅读、理解并同意本协议。"
    >
      <Section title="一、协议范围与服务定位">
        <p>剧司辰是面向剧本杀、沉浸式娱乐、演绎剧场等线下经营场景的数字化运营工具，主要为店家提供排期、房间、卡司/DM、剧本、拼车申请、评价反馈、会员管理、模板主库和经营数据管理能力。</p>
        <p>剧司辰不是线下服务的直接履约方，不承诺任何排期一定成行、玩家一定到场、店家服务一定符合个人预期，也不对用户之间另行达成的线下交易或约定承担担保责任。</p>
        <p>玩家侧扫码、评价、拼车加入等功能用于完成具体店家排期流程和后续身份沉淀；部分玩家、DM、社区身份能力可能跳转或打通至灵契。</p>
      </Section>
      <Section title="二、账号注册与身份管理">
        <p>用户应使用真实、合法、有效的信息注册或登录账号，并确保邮箱、手机号、店家名称、联系人、门店信息等资料可用于必要的身份识别、通知、客服和争议处理。</p>
        <p>店家账号、员工账号、超级管理员账号、客服代填权限等均应由有权限的人员使用。任何通过你的账号完成的后台操作，除非有充分证据证明账号被盗且你已及时通知平台，否则视为你的授权行为或管理责任范围内行为。</p>
        <p>你不得冒用他人身份、盗用他人账号、伪造店家或员工关系、出租出借账号、批量注册账号、绕过身份验证或以技术方式干扰平台正常运行。</p>
        <p>如平台发现账号存在异常登录、越权访问、批量操作、撞库、刷量、恶意导出数据或其他安全风险，平台有权采取二次验证、限制功能、冻结账号、清除异常数据、保留证据并依法配合处理。</p>
      </Section>
      <Section title="三、店家数据与操作责任">
        <p>店家应对自行录入的排期、房间、剧本、角色、价格、玩家上车、客服代填、评价处理、模板提交等数据的真实性、合法性和业务合理性负责。</p>
        <p>客服代填上车仅为店家线下服务效率工具，不代表平台已核验玩家真实身份、付款状态或到场意愿。店家应自行确认玩家授权、联系方式、支付、到场、安全边界和服务安排。</p>
        <p>不同店家后台按租户和店家身份隔离。用户不得尝试查看、导出、修改、破坏不属于自己的店家数据；因越权操作、内部人员管理不当或账号泄露造成的损失，由责任方自行承担。</p>
        <p>平台会尽力维护数据稳定和访问安全，但不保证任何系统在所有时间绝对不中断或绝对无错误。用户应结合自身经营需要保留必要的线下备份和内部核对流程。</p>
      </Section>
      <Section title="四、内容发布、公共模板与评价">
        <p>用户提交的剧本模板、角色信息、拼车申请、评价、备注、联系方式、店家介绍、DM 信息等内容，应真实、合法、必要、适度，不得违反法律法规、公序良俗或侵害他人合法权益。</p>
        <p>公共剧本模板进入主库前可能由超级管理员审核。审核通过仅代表该模板符合当前平台展示和导入规则，不代表平台对剧本版权、内容完整性、商业授权、适演性或经营收益作出保证。</p>
        <p>用户不得发布违法违规、侵权盗版、虚假宣传、色情低俗、赌博诈骗、暴力恐吓、人肉搜索、泄露隐私、恶意差评、恶意刷评、恶意剧透、绕过平台审核或诱导站外违法交易的内容。</p>
        <p>平台有权依据法律法规、监管要求、用户投诉、权利人通知和平台规则，对相关内容采取驳回、隐藏、下架、限流、修正标注、暂停账号、保存证据或移交处理等措施。</p>
      </Section>
      <Section title="五、第三方服务与线下履约">
        <p>剧司辰可能与灵契、腾讯云、Supabase、支付宝、微信、短信/邮件服务商、地图/二维码/对象存储等第三方能力配合，以完成登录、通知、支付、存储、跳转和运营功能。</p>
        <p>你通过剧司辰记录或发起的线下排期、拼车、评价、门店服务、DM 服务、收款退款、发票、玩家沟通等事项，原则上由实际经营者、发布者、付款方、接单方或相关责任方自行履行。</p>
        <p>平台不是所有线下服务合同的当然缔约方，也不因提供系统工具而自动承担店家、玩家、DM、员工、车头或其他第三方的履约责任。</p>
      </Section>
      <Section title="六、费用、支付与发票">
        <p>如剧司辰后续提供付费订阅、增值功能、加权展示、短信邮件额度、数据服务、模板服务或其他收费项目，具体价格、有效期、退款规则和开票规则以页面展示、订单记录或双方另行约定为准。</p>
        <p>用户应按实际需要购买或充值。已实际提供的服务、已消耗的额度、已产生的第三方通道成本、已开具发票或因用户原因造成的错误购买，除法律法规另有强制规定或平台明确承诺外，原则上不支持无理由退款。</p>
        <p>申请发票时，用户应提供真实准确的开票信息。因用户提供信息错误、重复申请、主体不一致或不符合税务规则导致无法开票、重开或延迟的，由用户自行承担相应后果。</p>
      </Section>
      <Section title="七、知识产权与数据使用">
        <p>剧司辰的软件界面、产品逻辑、文案、商标、页面设计、数据库结构、运营规则和平台生成的统计数据等，除依法属于第三方或用户自行享有的内容外，相关权益由平台或合法权利人享有。</p>
        <p>用户应确保上传、录入或提交的文字、图片、剧本信息、角色信息、评价、店家资料等内容拥有合法来源或必要授权。因侵权、盗版、无权上传、泄露商业秘密或违反保密义务产生的责任，由提交者承担。</p>
        <p>为提供服务、完成展示、审核、备份、数据统计、争议处理和安全审计，用户授权平台在必要范围内保存、复制、展示、处理和使用其提交的内容及业务数据。</p>
        <p>未经平台书面许可，任何人不得批量抓取、复制、导出、售卖、镜像、反向工程或以竞争性目的使用剧司辰页面、接口、数据和业务资料。</p>
      </Section>
      <Section title="八、隐私与安全审计">
        <p>平台会按照隐私政策收集和处理必要信息，包括账号信息、业务数据、操作日志、设备和网络信息等，用于账号登录、店家管理、功能实现、安全审计、客服支持、纠纷处理和依法配合监管。</p>
        <p>为防止盗号、越权、刷量、恶意攻击、虚假评价和数据损坏，平台可以记录账号 ID、IP、User-Agent、操作时间、操作类型、对象 ID、变更前后摘要等必要日志。</p>
        <p>用户不得通过剧司辰非法收集、公开、买卖、交换、泄露他人个人信息，也不得将平台数据用于骚扰、诈骗、人肉搜索或其他违法违规目的。</p>
      </Section>
      <Section title="九、违约处理">
        <p>用户违反本协议、平台规则、法律法规或监管要求的，平台可视情况采取提醒整改、限制功能、暂停账号、终止服务、删除或隐藏内容、撤销模板公开状态、保留证据、向主管机关报告或依法追责等措施。</p>
        <p>因用户违法违规、侵权、虚假宣传、泄露隐私、账号管理不当、线下履约争议或第三方投诉给平台、其他用户或权利人造成损失的，责任方应自行承担赔偿、澄清、道歉、行政处罚、诉讼仲裁等后果；平台因此遭受损失的，有权向责任方追偿。</p>
      </Section>
      <Section title="十、免责声明与责任限制">
        <p>在法律允许范围内，平台不对用户自行发布内容的真实性、完整性、准确性、实时性和适用性作绝对保证，也不对用户线下交易、玩家到场、店家服务质量、DM 表现、拼车成行、评价结果或第三方服务稳定性承担当然责任。</p>
        <p>因不可抗力、基础运营商故障、云服务异常、网络攻击、监管要求、备案或政策调整、第三方支付/短信/邮件服务异常、用户设备或网络原因导致服务中断、数据延迟或功能调整的，平台会尽力处理，但不承担超出法律规定和平台过错范围之外的责任。</p>
        <p>平台的审核、提醒、风控、客服协助或争议处理不构成对事实的最终认定，也不代表平台自愿承担用户之间、用户与第三方之间的法律责任。</p>
      </Section>
      <Section title="十一、协议变更、终止与争议解决">
        <p>平台可根据产品迭代、经营安排、法律法规和监管要求更新本协议、隐私政策及具体功能规则。更新后继续使用剧司辰，即视为接受更新后的条款；重大变化会尽量通过页面提示、站内通知或其他合理方式告知。</p>
        <p>如用户不同意更新后的协议，应停止使用相关服务。用户停止使用不影响其在使用期间已经产生的付款、发票、侵权、违约、争议处理和依法留存义务。</p>
        <p>本协议的订立、履行、解释及争议解决适用中华人民共和国大陆地区法律。因本协议或使用剧司辰产生争议的，各方应先友好协商；协商不成的，提交平台经营主体所在地有管辖权的人民法院处理。</p>
      </Section>
      <Section title="十二、联系方式">
        <p>如需咨询、投诉、申诉或处理账号问题，请发送邮件至 <a className="font-semibold text-indigo-600" href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>。</p>
      </Section>
    </LegalLayout>
  );
}

export function AiReadablePage() {
  return (
    <LegalLayout
      title="AI 可读说明"
      intro="本页用更结构化的方式说明剧司辰是什么、服务谁、和灵契是什么关系，方便搜索引擎、AI 助手和新接入的协作 Agent 快速理解。"
    >
      <Section title="一、剧司辰是什么">
        <p>剧司辰是面向剧本杀、沉浸式娱乐和演绎剧场店家的经营后台，核心功能包括排期、房间、剧本、卡司/DM、拼车上车、评价反馈、会员和公共剧本模板主库。</p>
        <p>剧司辰优先服务店家后台经营效率，不把自己定位成玩家社区首页。玩家身份、DM 公开身份、红黑白榜、委托需求和圈内口碑沉淀主要放在灵契。</p>
      </Section>
      <Section title="二、和灵契的关系">
        <p>剧司辰负责店家的排期和真实经营数据，灵契负责玩家、DM、灵契师、委托人、红黑白榜、拼车信息和口碑资产沉淀。</p>
        <p>两个产品共享同一个行业生态，但入口不同：店家先进剧司辰，玩家和社区用户先进灵契。</p>
      </Section>
      <Section title="三、当前运营主体">
        <InfoRows rows={[
          ['运营主体', '河北雄安澜洄娱乐有限公司'],
          ['网站域名', 'jusichen.com'],
          ['ICP备案号', ICP_RECORD_NO],
          ['公安联网备案', <MpsRecordLink />],
          ['客服邮箱', CONTACT_EMAIL],
        ]} />
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
        <p>隐私请求请发送至 <a className="font-semibold text-indigo-600" href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>。ICP备案号：<a className="font-semibold text-indigo-600" href="https://beian.miit.gov.cn/" target="_blank" rel="noopener noreferrer">{ICP_RECORD_NO}</a>；公安联网备案号：<MpsRecordLink />。</p>
      </Section>
    </LegalLayout>
  );
}

export function SecurityCompliancePage() {
  return (
    <LegalLayout
      title="安全合规说明"
      intro="本页面用于说明剧司辰当前为履行违法信息过滤、公共信息巡查、用户资质查验、日志信息留存和应急快速处置等安全保护义务所采取的管理与技术措施。"
    >
      <Section title="一、服务范围与风险边界">
        <p>剧司辰主要提供店家后台、排期、房间、剧本、卡司/DM、拼车上车、评价反馈、公共剧本模板、DM 工作台和站内投诉举报等功能。</p>
        <p>剧司辰不提供论坛、群聊、直播、公众账号群发等功能；用户可提交的公共或半公共内容主要包括公共剧本模板、评价反馈、拼车申请、站内反馈、投诉举报和店家资料。</p>
      </Section>
      <Section title="二、用户资质查验与账号管理">
        <p>店家后台账号采用邮箱、手机号、密码、验证码等方式进行注册、登录和找回；店家、员工、超级管理员等身份按角色和店铺进行权限隔离。</p>
        <p>玩家扫码上车、DM 工作台、店家后台和超级管理员后台使用不同登录入口和权限范围。平台会记录账号 ID、角色、店家、登录时间和必要的认证状态。</p>
        <p>平台发现冒用身份、批量注册、越权访问、账号出租出借、恶意导出数据或异常操作时，可以限制账号、要求补充核验、暂停服务并保留证据。</p>
      </Section>
      <Section title="三、违法信息防范、巡查与处置">
        <p>用户不得发布违法违规、侵权盗版、虚假宣传、色情低俗、赌博诈骗、暴力恐吓、人肉搜索、泄露隐私、恶意剧透、恶意刷评、绕过审核交易等内容。</p>
        <p>公共剧本模板进入公共主库前需经超级管理员审核；店家提交的投诉、举报、违法信息、安全事件、隐私请求会进入平台处理台，由管理员进行巡查和处理。</p>
        <p>平台可以对风险内容采取驳回、隐藏、下架、限制传播、修正标注、暂停账号、保存证据、通知相关方或依法配合主管机关处理等措施。</p>
      </Section>
      <Section title="四、投诉举报与应急快速处置">
        <p>店家后台提供“投诉举报 / 建议反馈”入口；公开页面提供客服邮箱。违法信息、账号安全、隐私泄露、侵权、经营纠纷等均可提交处理。</p>
        <p>安全事件会被标记为较高优先级，管理员可在超管后台查看、回复、标记处理中、已处理或已关闭，并形成处理留痕。</p>
        <p>如出现违法有害信息扩散、账号被盗、越权访问、敏感资料泄露、支付异常等紧急情况，平台可先采取临时限制、隐藏、冻结或下线措施，再补充核查和通知。</p>
      </Section>
      <Section title="五、日志留存与审计">
        <p>平台会为安全审计、争议处理、防刷、防越权和依法协助需要，记录必要日志，包括账号 ID、角色、操作类型、操作时间、目标类型、目标 ID、IP 地址、User-Agent 和必要的变更摘要。</p>
        <p>超级管理员操作写入平台操作日志；店家关键操作写入店内操作日志；排期创建、修改、删除、确认房间、锁车、指定 DM、开本、收尾、结算、玩家财务、投诉举报处理等均逐步纳入留痕。</p>
        <p>普通 Web 页面无法稳定读取设备 MAC 地址，平台不会虚假承诺采集 MAC；如主管机关依法要求协助，平台将基于已留存的账号、IP、时间、内容和操作记录配合处理。</p>
      </Section>
      <Section title="六、个人信息与第三方协助">
        <p>平台只在实现服务、审核、通知、支付、争议处理、安全审计和依法协助所需范围内处理个人信息。用户提交证据、截图或材料时，应主动打码无关第三方隐私。</p>
        <p>平台可根据网信、公安、司法、市场监管等主管机关依法提出的要求，提供必要的数据查询、日志留存、内容处置和技术协助。</p>
      </Section>
      <Section title="七、联系方式">
        <p>安全事件、投诉举报、隐私请求和主管机关协查事项，可通过店家后台“投诉举报 / 建议反馈”提交，也可发送邮件至 <a className="font-semibold text-indigo-600" href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>。</p>
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
          ['站内工单', '店家后台右侧“投诉举报”入口'],
          ['经营主体', '河北雄安澜洄娱乐有限公司'],
          ['ICP备案号', ICP_RECORD_NO],
          ['公安联网备案', <MpsRecordLink />],
        ]} />
        <p>邮件或站内工单中请尽量说明问题类型、相关账号、排期/店家/评价 ID、页面链接或截图，以便快速处理。涉及第三方隐私时请先打码。</p>
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
          ['公安联网备案', <MpsRecordLink />],
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
