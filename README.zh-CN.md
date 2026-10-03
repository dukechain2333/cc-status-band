# Status Band

为 [Claude Code](https://code.claude.com) 设计的状态栏。一条撑满终端宽度的大圆角条，位于输入框上方，显示：用户与主机、模型与推理强度、当前目录、git 状态、上下文窗口占用、5 小时与每周额度的**剩余**比例，以及时间或本次花费。状态栏始终是两行高：宽屏时一行内容上下居中，上下各补半行底色；窄屏时分成两行内容，上面是“你在哪”，下面是“用了多少”，仍是同一个整块。

[English](README.md)

![四套主题](docs/themes.svg)

同一套代码，两种用法：

- **作为 mod**（Claude Code 2.1.287 及以上）：用 Claude Code 自己的 UI 元素原生绘制在输入框下方，附带 `/band` 选择器，能用你当前会话的实时数据预览每套主题。
- **作为经典 `statusLine` 命令**（任何支持状态栏的版本）：一个零依赖的 Node 脚本，用 ANSI 颜色输出同样的状态栏。

## 显示内容

| 段 | 示例 | 说明 |
| :- | :- | :- |
| 用户 · 主机 | `william@macbook` | `$USER` 和短主机名。 |
| 模型 · 推理强度 | `✻ Opus 5.5 ●●●●○` | 五个点对应 `low` … `max`，随 `/effort` 实时变化；模型不支持 effort 时隐藏。 |
| 目录 | `~/code/cc-status-band` | 空间不够时依次缩写为 `~/c/cc-status-band`、只显示文件夹名。 |
| Git | `⎇ main +2 ~3 ↑1` | 已暂存、未暂存/未跟踪、领先/落后。窄时折叠成 `⎇ main ●`。 |
| 上下文 | `ctx ━━━━────── 42% 84k/200k` | 随占用增长：60% 起变琥珀色，85% 起变红色。 |
| 5 小时剩余额度 | `5h ━━━━━━── 72% left ↻2h14m` | Pro/Max 订阅可见。随消耗减少：剩 40% 变琥珀色，低于 15% 变红色。`↻` 是距离额度刷新的倒计时。 |
| 一周剩余额度 | `7d ━━━━╸─── 59% left ↻3d` | 独立的 chip 和进度条，配色规则相同。网关花费上限会显示为第三个 chip `spend`。 |
| 花费 · 时间 | `$1.42  ◷ 23m` | 默认显示本次会话时长，`/band time clock` 改为显示当前时间。`/band hide cost` 只去掉金额，保留时间。用 API key 计费时没有额度窗口，花费会被高亮。 |

![各种状态](docs/states.svg)

状态栏撑满终端宽度、两行高。一行放得下时内容居中、用量信息靠右；放不下时两组各占一行，只有仍然溢出的那一行才会折叠细节：

![190、140、100、72 列下的同一会话](docs/widths.svg)

## 安装 mod

需要 Claude Code **2.1.287+**（用 `claude --version` 查看）。

```text
/plugin marketplace add dukechain2333/cc-status-band
/plugin install status-band@cc-status-band
```

下一个会话（或执行 `/reload-plugins` 后）状态栏就会出现在输入框上方。

如果 settings 里还配置了 `statusLine` 命令，它仍会显示在输入框下方。只想要这条状态栏的话，从 `~/.claude/settings.json` 删掉 `statusLine`。

不安装、直接试用：

```bash
git clone https://github.com/dukechain2333/cc-status-band
claude --plugin-dir ./cc-status-band
```

### 自定义

输入 `/band` 打开选择器：数字选主题，字母选形状、字符集或位置，每一行都用你当前的会话实时预览。

也可以直接带参数，每个词设置它对应的选项：

```text
/band aurora               主题：clay | paper | aurora | ink
/band band                 形状：auto | chips | band | arrows | line
/band nerd                 字符集：unicode | nerd | ascii
/band below                位置：above（默认）| below
/band rows 1               行数：2（默认，两行高的大块）| 1（扁平一行）
/band fit                  宽度：full（默认，撑满终端）| fit
/band time clock           花费旁的时间：elapsed（会话时长）| clock（13:24）| clock12（01:24PM）| off
/band gap 1                状态栏与上方那行之间空几行：0 | 1（默认）| 2
/band hide cost git        隐藏段：host model dir git ctx 5h 7d spend cost（quota = 所有额度窗口）
/band show cost
/band hint off             不再在状态栏下方保留 Claude Code 自带的提示行
/band reset
/band help                 查看当前设置
```

设置对本机所有会话生效。

## 作为经典 statusLine 使用

适用于没有 mod 的 Claude Code 版本，或者你更喜欢经典的那一行。需要 Node 18+。

```bash
git clone https://github.com/dukechain2333/cc-status-band ~/.claude/cc-status-band
node ~/.claude/cc-status-band/scripts/install-statusline.mjs --theme clay
```

安装脚本会先备份 `settings.json`。参数（也可以用环境变量）：

| 参数 | 环境变量 | 取值 |
| :- | :- | :- |
| `--theme` | `STATUS_BAND_THEME` | `clay`（默认）、`paper`、`aurora`、`ink` |
| `--shape` | `STATUS_BAND_SHAPE` | `auto`（主题默认）、`chips`、`band`、`arrows`、`line` |
| `--glyphs` | `STATUS_BAND_GLYPHS` | `unicode`（默认）、`nerd`、`ascii` |
| `--time` | `STATUS_BAND_TIME` | `elapsed`（默认）、`clock`、`clock12`、`off` |
| `--rows` | `STATUS_BAND_ROWS` | `2`（默认）或 `1` |
| `--width` | `STATUS_BAND_WIDTH` | `full`（默认）或 `fit` |
| `--hide` | `STATUS_BAND_HIDE` | 逗号分隔：`host,model,dir,git,ctx,5h,7d,spend,quota,cost` |
| `--colors` | `STATUS_BAND_COLORS` | `truecolor` 或 `256`（默认根据 `COLORTERM`/`TERM_PROGRAM` 自动判断） |

卸载：`node scripts/install-statusline.mjs --uninstall`。

## 主题、形状与字符集

| 主题 | 适合 | 默认形状 |
| :- | :- | :- |
| **Clay** | 暖色深色终端 | band |
| **Paper** | 浅色终端 | band |
| **Aurora** | 冷色、鲜艳的深色终端 | arrows |
| **Ink** | 任何终端；只有彩色文字，没有底色 | line |

有底色的主题可以搭配任意形状：**chips**（每段一个圆角块）、**band**（一个整块包住所有段，段之间用 `│` 分隔，两行高，四角用方块字符画出小圆角）、**arrows**（powerline 箭头）或 **line**（无底色）。选择 `nerd` 字符集时，**chips** 和 **arrows** 会用 [Nerd Font](https://www.nerdfonts.com) 字形画出圆角和箭头；默认的 `unicode` 字符集使用方角，任何字体都能显示。`ascii` 只用 ASCII 字符。

在自己的终端和字体下预览：

```bash
node scripts/preview.mjs
node scripts/preview.mjs --states
node scripts/preview.mjs --glyphs nerd
```

## 开发

```bash
npm test                 # 核心单元测试（node --test）和 mod 测试（claude plugin test）
npm run validate         # 校验插件与 marketplace
npm run preview          # 在终端里看所有主题
npm run docs             # 用真实渲染器重新生成 docs/*.svg
claude --plugin-dir .    # 加载本地代码，保存即热重载
```

在 Claude Code 2.1.288 上测试通过。mods API 可能随版本变化；如果状态栏不显示，先运行 `claude plugin validate .claude-plugin/plugin.json` 并查看 debug 日志。

## 设计

状态栏在动手实现前先在 [Claude Design](https://claude.ai) 画布上完成了设计（总览、结构、主题、状态、响应式宽度和选择器面板）。设计决策记录在 [docs/DESIGN.md](docs/DESIGN.md)。

## 许可

MIT
