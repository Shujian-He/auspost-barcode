# Australia Post 4-State 条码生成器

一个浏览器端的 FCC 11 Standard Customer Barcode 生成器。输入 8 位 Delivery Point Identifier (DPID)，即可实时生成 37-bar Australia Post 4-State Customer Code，并保存为高分辨率 PNG。

## 功能

- 仅接受 8 位数字 DPID
- 按 FCC 11、数字编码表与 GF(64) Reed-Solomon 规则生成 37 个 bar states
- Canvas 绘制 H / A / D / T 四种 bar state
- PNG 包含 6 mm 左右静区和 2 mm 上下静区
- 展示编码字段、打印尺寸与 DPID 使用提示

## 本地运行

```bash
npm install
npm run dev
```

## 验证

```bash
npm test
```

测试包含资料中的已验证样例：DPID `39549554` 应编码为 `1301011030121130121211331210131132213`。

> 本工具不验证 DPID 是否真实存在。生产邮件应使用 AMAS 认证软件从 Australia Post Postal Address File 获取有效 DPID，并遵守 Australia Post 的全部打印规范。
