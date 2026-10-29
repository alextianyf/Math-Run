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
4. **拆 3D 造型**：`scene/yokai/` 每种妖怪一个文件；`oni.js`、`environment.js` 按部件拆
5. **拆 CSS 和文字**：`css/` 按组件拆，手机端样式写在各自组件文件里；`strings.js` 拆成中英两个文件
6. **语法简化**：按文件夹逐个清掉 lint 警告，然后把这些规则从警告改成错误

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
