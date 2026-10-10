# -
香辛料查询   静态查询页 + 密码保护管理后台 + Edge Functions 读写 KV，支持香辛料可视化增删改查、导入/导出
建 Pages 项目。
项目→KV 存储→创建命名空间 spice-kv→绑定到项目，变量名 SPICE_KV。
项目→环境变量/Secret→加 ADMIN_PASSWORD、AUTH_SECRET（Secret 更好）。
确保仓库根有 edge-functions/...，Pages 会自动注册函数路由；纯静态无构建时输出目录填根目录。
部署后：
公开查询：https://你的域名/ → index.html
后台：https://你的域名/admin.html → 登录 ADMIN_PASSWORD
改数据只在 admin 操作，或控制台改 KV spices；前端不变
