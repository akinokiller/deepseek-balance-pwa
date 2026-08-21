# DeepSeek 余额 PWA

iOS 无需开发者账号、永久不掉签的 DeepSeek 额度显示。

Safari 打开 → 分享 → 添加到主屏幕，即可像原生 App 一样使用。

## 特性
- PWA，可安装到桌面，离线可用
- 直连 `https://api.deepseek.com/user/balance`，Key 仅存本地 `localStorage`
- Cloudflare Pages Functions 代理解决 CORS
- 30秒自动刷新，支持深色模式
- 总余额 / 赠送 / 充值 分类展示

## 本地开发
```bash
npx wrangler pages dev public
```

## 部署
已配置 Cloudflare Pages，推送即部署。

## API
`GET /api/balance` → 代理到 DeepSeek，需 `Authorization: Bearer sk-xxx`
