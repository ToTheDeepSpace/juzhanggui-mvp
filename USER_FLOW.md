# 剧本杀排期管理系统 — 用户流程图

> 本文档使用 Mermaid 图表，GitHub 会自动渲染。
> 每个图表展示一个角色在使用系统时的页面流转路径。

---

## 一、系统整体信息架构

```mermaid
flowchart TB
    Login[登录页 /login] --> Admin[管理员后台 /schedule]

    subgraph Admin["管理后台 (MainLayout)"]
        direction TB
        Nav[顶部导航栏] --> Schedule[📅 排期管理 /schedule]
        Nav --> Rooms[🚪 房间管理 /rooms]
        Nav --> Actors[🎭 卡司管理 /actors]
        Nav --> Scripts[📖 剧本管理 /scripts]
        Nav --> Customers[⭐ 会员管理 /customers]
        Nav --> Conflicts[⚖️ 矛盾调解 /conflicts]
    end

    subgraph Public["公开页面（无需登录）"]
        Checkin[签到页 /checkin/:scheduleId]
        Evaluate[评价页 /evaluate/:scheduleId]
    end

    Schedule --> S1[创建排期]
    Schedule --> S2[编辑排期]
    Schedule --> S3[确认/取消排期]
    Schedule --> S4[分配卡司]

    Rooms --> R1[添加房间]
    Rooms --> R2[编辑房间]
    Rooms --> R3[删除房间]

    Actors --> A1[添加卡司/DM]
    Actors --> A2[编辑卡司]
    Actors --> A3[删除卡司]
    Actors --> A4[查看排班]
    Actors --> A5[查看空闲时段]

    Scripts --> P1[添加剧本]
    Scripts --> P2[编辑剧本]
    Scripts --> P3[添加角色]
    Scripts --> P4[删除剧本]
```

---

## 二、登录流程

```mermaid
flowchart TD
    Start((打开系统)) --> IsLogin{已登录？}
    IsLogin -->|否| LoginPage[登录页 /login]
    IsLogin -->|是| Dashboard[跳转排期页 /schedule]

    LoginPage --> InputPwd[输入密码]
    InputPwd --> Verify{验证}
    Verify -->|密码正确| Dashboard
    Verify -->|密码错误| ShowError[显示错误提示]
    ShowError --> InputPwd

    Dashboard --> Logout[点击退出登录]
    Logout --> LoginPage
```

---

## 三、客服排班流程（核心）

这是系统的核心功能——客服创建和管理排班。

```mermaid
flowchart TD
    CSStart((客服登录)) --> SchedulePage[排期日历页 /schedule]
    SchedulePage --> ViewCal[查看日历视图]
    ViewCal -->|点击空时段| CreateModal[弹出创建排期弹窗]

    CreateModal --> FillForm[填写排期信息]
    FillForm --> SelectScript[选择剧本]
    FillForm --> SelectRoom[选择房间]
    FillForm --> SetTime[设置开始/结束时间]
    FillForm --> InputCustomer[填写客户信息]
    FillForm --> InputPlayerCount[填写玩家数]
    FillForm --> SelectActors[分配卡司/DM]

    SelectActors --> CheckConflict{检测冲突}
    CheckConflict -->|有冲突| ShowConflict[显示冲突提示]
    ShowConflict --> AdjustTime[调整时间或更换卡司]
    AdjustTime --> SelectActors

    CheckConflict -->|无冲突| SaveSchedule[保存排期]
    SaveSchedule --> RefreshCal[刷新日历]
    RefreshCal --> ViewCal

    SchedulePage -->|点击已有排期| EditModal[编辑排期]
    EditModal --> EditForm[修改信息]
    EditForm --> SaveEdit[保存修改]
    SaveEdit --> RefreshCal

    SchedulePage -->|右键/操作菜单| CancelSchedule[取消排期]
    CancelSchedule --> ConfirmCancel[确认取消]
    ConfirmCancel --> RefreshCal
```

---

## 四、DM（主持人）使用流程

```mermaid
flowchart TD
    DMStart((DM登录)) --> DMDash[DM工作台]

    subgraph DMDash["DM工作台"]
        direction TB
        MySchedule[📋 我的排班 - 日历视图]
        MyStats[📊 我的数据统计]
        LeaveRequest[📝 请假申请]
    end

    MySchedule --> ViewMyShifts[查看未来排班]
    MySchedule --> ViewHistory[查看历史排班记录]
    MySchedule --> SwitchView[切换日/周/月视图]

    MyStats --> ShowStats[显示本月数据]
    ShowStats --> CarCount[🚗 本月开本数]
    ShowStats --> TotalHours[⏱ 总工作时长]
    ShowStats --> AvgRating[⭐ 平均玩家评分]
    ShowStats --> Level[🏆 当前等级/经验值]

    Level --> LevelDetail[等级详情]
    LevelDetail --> LevelRules[升级规则说明]
    LevelDetail --> NextLevel[距下一级还需: X 车]

    LeaveRequest --> FillLeave[填写请假时间]
    FillLeave --> SelectDate[选择日期]
    FillLeave --> Reason[填写原因]
    Reason --> SubmitLeave[提交申请]
    SubmitLeave --> WaitApproval[等待管理员审批]

    DMDash --> Logout[退出登录]
```

---

## 五、玩家使用流程

```mermaid
flowchart TD
    PlayerStart((玩家打开链接)) --> Browse[浏览可预约场次]

    subgraph Browse["浏览场次"]
        Available[查看空闲车次]
        ViewDM[查看每个场次的 DM]
        ViewScript[查看剧本信息]
        ViewPrice[查看价格]
    end

    Available --> SelectSlot[选择场次]
    SelectSlot --> ConfirmBooking[确认预约]
    ConfirmBooking --> InputInfo[填写姓名/电话]
    InputInfo --> BookingDone[预约成功]
    BookingDone --> ShowQR[显示签到二维码]
    ShowQR --> SaveToPhone[保存到手机]

    Available -->|扫码签到| CheckinPage[签到页]
    CheckinPage --> ScanQR[扫二维码]
    ScanQR --> CheckinDone[签到成功 ✓]

    CheckinPage -->|签到后可评价| EvalPage[评价页]
    EvalPage --> RateStars[打星评分 1-5]
    RateStars --> WriteComment[写评语]
    WriteComment --> SubmitEval[提交评价]
    SubmitEval --> EvalDone[评价完成 ✓]
```

---

## 六、管理端工作流程

```mermaid
flowchart LR
    subgraph Room["房间管理"]
        AddRoom[添加房间] --> SetName[设置名称/容量]
        EditRoom[编辑房间] --> UpdateRoomInfo[修改信息]
        DelRoom[删除房间] --> ConfirmDel[确认删除]
    end

    subgraph Actor["卡司管理"]
        AddActor[添加卡司] --> SetInfo[设置姓名/电话]
        EditActor[编辑卡司] --> UpdateInfo[修改信息]
        AssignSkill[分配技能] --> LinkScript[关联剧本]
        ViewActorSchedule[查看排班] --> ShowActorCal[显示日历]
        ViewAvailability[查看空闲] --> SuggestSlot[推荐可排时段]
    end

    subgraph Script["剧本管理"]
        AddScript[添加剧本] --> SetScriptInfo[设置名称/时长]
        AddScript --> AddPlayerRoles[添加玩家角色]
        AddScript --> AddActorRoles[添加卡司角色]
        EditScript[编辑剧本] --> UpdateScript[修改信息/角色]
    end

    subgraph Customer["会员管理"]
        AddCustomer[添加会员] --> SetCustInfo[姓名/电话/等级]
        SearchCustomer[搜索会员] --> ByName[按姓名搜索]
        SearchCustomer --> ByPhone[按电话搜索]
        ViewCustHistory[查看记录] --> ShowTransactions[显示交易记录]
        ViewCustHistory --> ShowPreferences[显示偏好卡司]
        Recharge[充值] --> AddBalance[增加余额]
    end

    subgraph Conflict["矛盾调解"]
        ViewConflicts[查看矛盾列表] --> pending[待处理]
        ViewConflicts --> resolved[已解决]
        pending --> AddResolution[填写解决方案]
        AddResolution --> MarkResolved[标记已解决]
    end
```

---

## 七、页面路由总览

```
公开页面（无需登录）
├── /login                          — 登录页
├── /checkin/:scheduleId            — 玩家签到页
└── /evaluate/:scheduleId           — 玩家评价页

管理后台（需登录，MainLayout 包裹）
├── /schedule                       — 📅 排期管理（首页）
├── /rooms                          — 🚪 房间管理
├── /actors                         — 🎭 卡司管理
├── /scripts                        — 📖 剧本管理
├── /customers                      — ⭐ 会员管理
└── /conflicts                      — ⚖️ 矛盾调解
```

---

## 八、下次迭代建议（按流程图撸代码）

根据上面的流程图，下一轮开发按这个顺序做最合理：

**第一轮** → 先把 Phase 1 收尾
1. 修复剧本创建（列名不匹配，参考房间 bug 的修法）
2. 把 evaluations 从本地 SQLite 切到 Supabase

**第二轮** → DM 模块（竞争壁垒）
3. DM 工作台页面（只看自己的排班）
4. DM 统计：本月开本数、评分
5. DM 等级体系

**第三轮** → 玩家端
6. 玩家浏览场次页面
7. 玩家预约
8. 扫码签到优化

---

> 文档版本：v0.1 | 最后更新：2026-05-04
