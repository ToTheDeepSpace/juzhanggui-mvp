# Tasks
- [x] Task 1: 告知腾讯云密钥获取位置
  - [x] SubTask 1.1: 指导用户进入腾讯云控制台。
  - [x] SubTask 1.2: 指导用户打开“访问管理 CAM / API 密钥管理”。
  - [x] SubTask 1.3: 说明 `TENCENTCLOUD_SECRET_ID` 对应 `SecretId`，`TENCENTCLOUD_SECRET_KEY` 对应 `SecretKey`。

- [x] Task 2: 明确安全和权限边界
  - [x] SubTask 2.1: 建议优先创建腾讯云子账号或专用访问密钥。
  - [x] SubTask 2.2: 建议仅授予 SES 和 SMS 所需权限。
  - [x] SubTask 2.3: 明确密钥不能写入 Git、前端、文档、记忆或 Obsidian。

- [x] Task 3: 指导服务器配置和验证
  - [x] SubTask 3.1: 列出服务器需要补齐的环境变量。
  - [x] SubTask 3.2: 提醒短信签名 `TENCENT_SMS_SIGN` 必须等报备通过后配置。
  - [x] SubTask 3.3: 说明配置后需要重启 `jusichen.service` 并验证验证码链路。

# Task Dependencies
- Task 2 depends on Task 1。
- Task 3 depends on Task 2。
