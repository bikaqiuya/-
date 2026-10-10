# -
香辛料查询   静态查询页 + 密码保护管理后台 + Edge Functions 读写 KV，支持香辛料可视化增删改查、导入/导出

建 Pages 项目。
绑定到 Pages 项目，变量名用 SPICE_KV（代码里作全局变量，不写 context.env.SPICE_KV）
项目

项目→KV 存储→创建命名空间 spice-kv→绑定到项目，变量名 SPICE_KV。

项目→环境变量/Secret→加 ADMIN_PASSWORD、AUTH_SECRET（Secret 更好）。环境变量（Settings→环境变量/Secret）：ADMIN_PASSWORD：后台登录密码，如 hangeMe#2026  AUTH_SECRET：Secret 类型，32+位随机串，用于 HMAC 签 token；openssl rand -base64 32  可选 SESSION_SECONDS=28800、MAX_LOGIN_FAILS=5、LOGIN_FAIL_WINDOW=900

确保仓库根有 edge-functions/...，Pages 会自动注册函数路由；纯静态无构建时输出目录填根目录。

部署后：

公开查询：https://你的域名/ → index.html

后台：https://你的域名/admin.html → 登录 ADMIN_PASSWORD

改数据只在 admin 操作，或控制台改 KV spices；前端不变
