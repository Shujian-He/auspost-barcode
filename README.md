# Australia Post 4-State 条码生成器

一个完全在浏览器本地运行的 Australia Post 4-State Customer Barcode 生成器。输入 8 位 Delivery Point Identifier (DPID)，即可实时生成 37、52 或 67-bar 条码，并保存为高分辨率 PNG。

## 功能

- 仅接受 8 位数字 DPID
- 支持 FCC 11、59、62 与 37、52、67-bar 格式
- 支持 Numeric、Character 与自定义 bar state 客户信息编码
- 按 GF(64) Reed-Solomon 规则生成校验 bar states
- Canvas 绘制 H / A / D / T 四种 bar state
- PNG 包含 6 mm 左右静区和 2 mm 上下静区
- 展示编码字段、打印尺寸与 DPID 使用提示
- 无服务端、数据库或云平台依赖

## 本地运行

```bash
npm install
npm run dev
```

构建并预览静态版本：

```bash
npm run build
npm run preview
```

## 验证

```bash
npm test
```

测试包含资料中的已验证样例：DPID `39549554` 应编码为 `1301011030121130121211331210131132213`。

构建结果位于 `dist/`，可以使用任意本地静态文件服务器运行。

> 本工具不验证 DPID 是否真实存在。生产邮件应使用 AMAS 认证软件从 Australia Post Postal Address File 获取有效 DPID，并遵守 Australia Post 的全部打印规范。
