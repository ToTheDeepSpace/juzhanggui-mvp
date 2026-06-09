# Checklist
- [x] 已明确 `TENCENTCLOUD_SECRET_ID` 来源于腾讯云 API 密钥的 `SecretId`。
- [x] 已明确 `TENCENTCLOUD_SECRET_KEY` 来源于腾讯云 API 密钥的 `SecretKey`。
- [x] 已说明获取入口为腾讯云控制台的访问管理 CAM / API 密钥管理。
- [x] 已建议优先使用子账号或专用访问密钥，并限制为 SES/SMS 所需权限。
- [x] 已说明密钥不得写入 Git、前端、文档、memory、STATUS 或 Obsidian。
- [x] 已列出剧司辰服务器需要补齐的变量：`TENCENTCLOUD_SECRET_ID`、`TENCENTCLOUD_SECRET_KEY`、`TENCENT_SES_TEMPLATE_ID`、`TENCENT_SMS_TEMPLATE_ID`、`TENCENT_SMS_SIGN`。
- [x] 已提醒短信签名未通过前短信不能真正发送。
- [x] 已说明配置完成后需要重启服务并验证验证码链路。
