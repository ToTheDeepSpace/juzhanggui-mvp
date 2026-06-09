# 腾讯云密钥获取与剧司辰配置 Spec

## Why
剧司辰后端要调用腾讯云 SES 和 SMS，需要 `TENCENTCLOUD_SECRET_ID` 与 `TENCENTCLOUD_SECRET_KEY`。当前服务器已配置邮件/短信模板 ID，但缺少腾讯云 API 密钥与短信签名变量，导致验证码真实发送无法完成。

## What Changes
- 明确腾讯云 API 密钥的获取位置和最小权限建议。
- 明确密钥不得写入代码、Git、memory、STATUS、Obsidian 或聊天记录。
- 明确剧司辰服务器私密环境变量需要补齐的变量。
- 明确补齐后需要重启服务并验证发送链路。

## Impact
- Affected specs: 剧司辰登录、邮箱验证码、短信验证码、腾讯云 SES/SMS 配置。
- Affected code: 不要求改业务代码，主要影响服务器私密环境文件和服务运行环境。

## ADDED Requirements
### Requirement: 腾讯云 API 密钥获取说明
系统 SHALL 指导用户从腾讯云控制台获取 `SecretId` 和 `SecretKey`。

#### Scenario: 用户需要知道去哪里拿密钥
- **WHEN** 用户询问 `TENCENTCLOUD_SECRET_ID` / `TENCENTCLOUD_SECRET_KEY` 从哪里拿
- **THEN** 系统 SHALL 告知进入腾讯云控制台的“访问管理 CAM / API 密钥管理”页面创建或查看密钥
- **AND** 系统 SHALL 提醒优先使用子账号密钥，不建议使用主账号永久密钥

### Requirement: 最小权限建议
系统 SHALL 建议密钥具备调用腾讯云 SES 和 SMS 的权限。

#### Scenario: 用户创建子账号密钥
- **WHEN** 用户为剧司辰创建腾讯云子账号或访问密钥
- **THEN** 系统 SHALL 建议授予 SES 发信和 SMS 发短信所需权限
- **AND** 系统 SHALL 避免要求过大的管理员权限，除非用户明确接受

### Requirement: 安全配置方式
系统 SHALL 要求密钥只写入服务器私密环境文件或安全密钥管理系统。

#### Scenario: 用户准备提供密钥
- **WHEN** 用户拿到 `SecretId` 和 `SecretKey`
- **THEN** 系统 SHALL 提醒不要提交到 Git，也不要写入文档、记忆、状态文件、Obsidian 或前端环境变量
- **AND** 系统 SHALL 建议写入服务器私密 env 文件，例如 `/srv/secrets/jusichen_postgres_app.env`

### Requirement: 剧司辰所需变量
系统 SHALL 列出剧司辰真实发送验证码所需变量。

#### Scenario: 用户准备补齐服务器配置
- **WHEN** 用户要补齐剧司辰腾讯云发送配置
- **THEN** 系统 SHALL 至少确认以下变量：`TENCENTCLOUD_SECRET_ID`、`TENCENTCLOUD_SECRET_KEY`、`TENCENT_SES_TEMPLATE_ID`、`TENCENT_SMS_TEMPLATE_ID`、`TENCENT_SMS_SIGN`
- **AND** 系统 SHALL 提醒短信签名必须在腾讯云审核/报备通过后才能正常发送短信

## MODIFIED Requirements
### Requirement: 剧司辰验证码发送配置
剧司辰 SHALL 在服务器运行环境中读取腾讯云密钥和模板/签名变量，用于服务端调用 SES/SMS；前端 SHALL 不接触腾讯云密钥。

## REMOVED Requirements
无。
