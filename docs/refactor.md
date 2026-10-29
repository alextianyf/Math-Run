# 模块化与语法简化

在分支 `refactor-modules` 上进行。目标：**只改结构，不改游戏行为**；仍然是纯静态网页，没有构建步骤，GitHub Pages 直接运行。

每一步单独提交；提交前都要：`npm test`、`npm run lint` 没有 error、在手机（360×740）和电脑（1280×800）尺寸各玩一局。

## 步骤

1. **`js/core/` 和规则工具** ✅
   - `core/state.js`、`core/events.js`（从 `game/` 移来）
   - `core/store.js`（存档）、`core/i18n.js`（语言切换 `t()`）：从 `ui/ui.js` 拆出
   - `core/dom.js`（`$`、`restartAnimation`）、`core/math.js`（随机数、缓动）：取代 `game/helpers.js`
   - ESLint：`npm run lint`
2. **拆 `ui/ui.js`** ✅：`hud.js`、`ranks.js`、`tags.js`、`popups.js`、`talisman.js`、`aiPanel.js`、`overlays.js`；`show()` 改名为 `showOverlay()`
3. **拆 `game/powers.js`，解开循环依赖** ✅：`nights.js`、`skills.js`、`hints.js`、`finisher.js`、`core/schedule.js`；`powers.js` 只剩每帧推进和重置
   - 技能（雷神）和终结技要扫掉妖怪时，发 `sweep` 通知，由 `combat.js` 收听处理，不再反过来引用 `combat.js`
   - 狐狸之夜开始时，`nights.js` 发 `nightBegins`，`skills.js` 收听并充一点能
   - 现在 `js/` 里没有任何互相引用的模块
4. **拆 3D 造型** ✅
   - `scene/yokai/`：每种妖怪一个文件，`shared.js` 放共用的材质和眼睛、光晕、火焰，`index.js` 放妖怪表和 `createYokai`
   - `scene/oni/`：`body.js`（用 VRM 塑造身体）、`head.js`、`props.js`（虎皮、狼牙棒、铁护腕），`index.js` 组装并负责动作
   - `scene/environment/`：`sky.js`、`ground.js`、`torii.js`、`lanterns.js`、`trees.js`、`particles.js`，`shared.js` 放滚动带的数值和工具
   - 代码是用脚本整段搬过去的，搬完逐行核对过：除了 import 和文件开头的说明，没有一行丢失或改动
5. **拆 CSS 和文字** ✅
   - `styles.css` → `css/` 里 13 个文件（`base`、`stage`、`popups`、`hud`、`talisman`、`ai-panel`、`overlays`、`ranks`、`capture`、`tutorial`、`loader`、`collection`、`powers`），`index.html` 按原来的顺序逐个引入
   - 手机端、矮横屏、减少动画的规则写在各自组件文件的末尾
   - 验证方法：同一个页面、同一份 DOM，先用旧样式、再换成新样式，比较每个元素（含 ::before/::after）的全部计算样式；覆盖 5 种屏幕尺寸 × 是否减少动画 × 35 种状态
   - 比较时发现一个旧 bug：手机端的提示卡、成就弹窗、夜晚/技能/终结技横幅的手机样式写在了它们的基础样式之前，一直没生效。先单独提交修复，再拆分，拆分前后零差异
   - `strings.js` → `ui/strings/zh.js`、`en.js`；新增 `tests/strings.test.mjs`，检查两种语言的键名和 `{占位符}` 完全一致
6. **语法简化** ✅：655 条警告全部清掉，规则从警告改成了错误，`npm run lint` 现在必须零问题
   - "一次只声明一个变量"：用 ESLint 自带的自动修复
   - "一行一条语句"和"每行不超过 120 个字符"：用脚本按语法树自动换行，`if (x) { a; b; }` 展开成多行，长的数据行一项一行。每个文件写回前都会核对：除了空白和列表末尾的逗号，代码的每个记号都和原来一模一样
   - 26 处嵌套问号改成查表、小函数或 if/else，2 处长行手工改

## 语法规则

ESLint（`eslint.config.js`）会检查前五条：

- 不用嵌套的问号表达式 `a ? b : c ? d : e`，改用 if/else 或查表
- 一行只写一条语句，每行不超过 120 个字符
- 一次只声明一个变量：不写 `let a = 1, b = 2`
- 不用逗号把几个表达式串在一起，内层不重复使用外层已有的变量名
- `==` 只用在 `x == null`（同时判断 null 和 undefined），其他一律 `===`
- 不用难懂的技巧：重新播放动画用 `restartAnimation(el, 'pop')`，不写 `void el.offsetWidth`
- 游戏逻辑里不用单字母变量名（`e` → `enemy`）；3D 数学计算里的 `x`、`y`、`t` 可以保留
- 对外导出的函数写成 `export function name()`
