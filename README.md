# 看山陪读 · Reading Assistant

从知乎风格的推荐首页选一篇文章，点正文右下角的刘看山，就能从正在读的段落进入双页阅读，调整字号、查看重点，或逐句跟读。

**[下载离线包 · Reading-Assistant.zip](https://github.com/DumanHaoqian/Reading-Assistant/releases/latest/download/Reading-Assistant.zip)**　·　[查看版本记录](https://github.com/DumanHaoqian/Reading-Assistant/releases)

## 第一次使用

1. 将 ZIP 保存到电脑。Windows 右键选「全部解压」，macOS 双击解压，Linux 选「提取到此处」。
2. 打开解压出的 `Reading-Assistant` 文件夹，双击 **`index.html`**。只要有现代浏览器就能运行，无需安装 Node.js、Python，无需知乎账号或 API Key。
3. 在推荐页点「阅读全文」原地展开，或点标题进入正文页。v0.3.0 新增 100 篇，推荐列表累计收录 **200 篇**（158 篇回答、42 篇专栏）。列表中也保留了 D-OPSD 技术回答、苏洋《2022 岁末总结》、ATR 双语文章和鲁迅《我们现在怎样做父亲》四篇原有样本。正文页左上角的知乎标志可以带你回到推荐首页。
4. 在本地正文页点右下角的**陪读**进入书页，用 **← / →** 翻页、**− / +** 调字号。「跟读」开启后可用 **↑ / ↓** 逐句移动。「返回原文」会回到对应段落。要找另一篇离线正文，点原文页右下角的「样本」，可以按标题或作者搜索。

共 **204 篇**可离线阅读。推荐流的 200 篇保留了正文中 842 处插图；配图、封面及桌宠动画都从本地加载。作者主页、原站搜索等外部链接需要联网。可用 `index.html?sample=d-opsd` 直接进入技术回答，或加上 `&reader=1` 直接打开双页陪读。重点标记按每篇正文独立生成，短回答里没有合适片段时保持原文。

## 安装到自己的电脑（可选）

如果要经常使用，可在**完整解压之后**按下面的方式安装。安装程序只写入当前用户目录，并用默认浏览器打开页面。装好后可以移走下载包。

| 系统 | 如何安装 | 下次从哪里打开 |
| --- | --- | --- |
| Windows 10 / 11 | 打开 `install` 文件夹，双击 `Install-Windows.cmd` | 开始菜单中搜索 **Reading Assistant** |
| macOS | 打开 `install` 文件夹，双击 `Install-macOS.command` | Finder 按 **⌘⇧G**，输入 `~/Applications`，打开 **Reading Assistant.app** |
| Linux 桌面 | 在包含 `index.html` 的目录打开终端，运行 `sh install/install-linux.sh` | 应用菜单中搜索**看山陪读** |

**更新**：下载并解压新版本，再运行同一系统的安装程序。只用便携版的队友可以直接打开新包里的 `index.html`。字号和阅读进度保存在当前浏览器中，切换浏览器、文件位置或服务地址可能会看到一套新的记录。

**卸载**：Windows 删除 `%LOCALAPPDATA%\ZhihuReadingAssistant` 和开始菜单目录（Win+R 输入 `shell:programs`）中的 `Reading Assistant.url`。macOS 把 `~/Applications/Reading Assistant.app` 移到废纸篓。Linux 在 `$XDG_DATA_HOME`（默认 `~/.local/share`）中删除 `zhihu-reading-assistant` 目录和 `applications/zhihu-reading-assistant.desktop`。便携版只需删除解压目录。

## 从源码运行或部署

负责改代码的队友可克隆仓库，也可以从 GitHub 下载源码 ZIP 并解压。[下载 main 源码](https://github.com/DumanHaoqian/Reading-Assistant/archive/refs/heads/main.zip)

```sh
git clone https://github.com/DumanHaoqian/Reading-Assistant.git
cd Reading-Assistant
```

直接打开仓库根目录的 `index.html` 就能预览修改。若需要固定的本地网址，在包含 `index.html` 的目录运行以下一条命令（需要 Python 3）。

| 系统 | 启动命令 |
| --- | --- |
| Windows | `py -3 -m http.server 8746 --bind 127.0.0.1`（若系统使用 `python` 命令，将 `py -3` 换成 `python`） |
| macOS / Linux | `python3 -m http.server 8746 --bind 127.0.0.1` |

在**运行命令的那台电脑**打开 [本地演示](http://127.0.0.1:8746/index.html)。演示期间保持终端开启，结束时按 **Ctrl+C**。如果端口被占用，把命令和网址里的 `8746` 同时换为 `8747`。

要部署到已有的静态网站，将离线包解压，把 `Reading-Assistant/` **里面的内容**按原目录结构放入站点目录即可。例如放在 `/demo/` 下，入口就是 `/demo/index.html`。

## 给队友打包或发布更新

| 方式 | 操作 | 结果 |
| --- | --- | --- |
| GitHub 一键打包 | 打开 [Package demo](https://github.com/DumanHaoqian/Reading-Assistant/actions/workflows/package.yml)，点 **Run workflow**，选分支并运行（需要仓库写权限） | 任务成功后，从本次运行的 **Artifacts** 下载 `Reading-Assistant.zip` |
| 本地打包 | 在**源码仓库根目录**运行 `python3 scripts/package-demo.py`。Windows 可用 `py -3 scripts/package-demo.py` 或 `python scripts/package-demo.py` | 得到 `dist/Reading-Assistant.zip`，可直接发给队友；只用 Python 3 标准库 |
| 发布给全队 | 维护者把代码推到 GitHub，再给要发布的提交打一个新的版本标签并推送，例如 `git tag v0.3.1` 后运行 `git push origin v0.3.1` | GitHub 自动打包，在 Windows、macOS、Linux 检查安装，然后创建 Release；页首下载链接会指向新版本 |

## 常见问题

- **打开后只有文字、图片消失或点陪读没有反应**：先退出压缩包预览，完整解压后再打开 `index.html`。确认 `assets/`、`reader.js` 和 `index.html` 在同一层。若默认程序是编辑器，右键文件，选择用浏览器打开。
- **公司电脑限制安装脚本**：直接双击解压后的 `index.html` 即可使用全部阅读功能。若浏览器也限制本地文件，可用上面的本地服务方式。
- **macOS 解压后脚本没有执行权限**：在解压出的 `Reading-Assistant` 文件夹打开终端，运行 `sh install/Install-macOS.command`。Linux 的 `sh` 命令同样不依赖解压工具保留可执行位。
