# AI 接手说明

更新：2026-10-26。目标：一个可扩展的小面板，先实现启停和开放聊天。仓库为 `watashiwakamida/fish-control`，本机源码为 `D:\FishControl`。

## 用户约束

沿用 `D:\DeepSeekCompanion` 现有环境。不要重装，不重新扫码B站，不新建主人会话，不覆盖已写入的人设。累计 ¥40 及 11 月 1 日暂停模型调用必须保留。不设自主 @ 的每日次数上限；原分享时段和间隔不属于本次调整。

## 架构与入口

| 文件 | 作用 |
| --- | --- |
| server.mjs | 回环 HTTP 控制台；读状态、写两个开关；需要时调用既有启动脚本 |
| public/index.html | 中文两按钮面板、运行状态、预算提示 |
| runtime/policy.mjs | 统一状态读取与 fail-closed 授权判断 |
| runtime/plugin.mjs | DSH 插件；模型启停、取消正在处理的回合、状态心跳、开放通道调度 |
| runtime/public-chat.mjs | 独立访客上下文、QQ 好友私信与群内 @、串行模型处理、原路发送 |
| runtime/public-bili.py | B站访客私信和评论通知；父评论作者核验、原楼层发送、持久去重 |
| install.mjs | 校验基线、备份、生成接入补丁、更新 profile |
| tests/control.test.mjs | 授权矩阵、上下文隔离、发给实际联系人、处理中关闭、去重的模拟回归 |

主人继续使用原固定会话和完整人格。访客不使用主人历史/记忆，使用 PUBLIC_PERSONA 与单独上下文；不创建 DSH 会话。模型统一走 ctx.llm.stream，原 companion-budget-guard 负责计费保护。

## 原项目中的增量依赖

安装器已生成：

- `work/qq-bridge-local/lib/host-v5.js`，profile ID `companion-qq-reliable-v5`；必须保留同目录 client.js、selfupdate.mjs、reliability-v2.mjs。
- `work/maintenance/bili-dialogue-v3.mjs`，ID `companion-bili-dialogue-v3`。
- `work/maintenance/companion-bili-autonomy-v4.mjs`，ID `companion-bili-autonomy-v4`。
- 原 `bili-dialogue-transport.py`、`bili-public-share.py` 加入停止检查。
- profile 新插件 `companion-fish-control-v3` 指向本仓库 runtime/plugin.mjs?v=3，内部 public-chat.mjs?v=3；查询版本用于强制宿主重新载入。
- 工具策略已增量升级 `companion-tool-policy-v3.mjs` / `companion-tool-policy-v3`，只在原白名单新增 companion_bili_mention。
- `fish-owner-mention-v1` 加载 runtime/manual-mention.mjs；主人本轮明确要求 @ 才可调用，目标固定为本机绑定主人，公开正文来自公开视频标题，不传私人聊天。

生成文件引用本仓库绝对路径。不要随便移动/删除 D:\FishControl。若移动需更新生成文件和 profile 引用。安装器不是通用 DSH 版本迁移器，基线不符时不得跳过校验硬覆盖。

## 本机状态（不要提交）

全部在原项目 data/dsh 下：fish-control.json（开关、主人账号绑定、启停水位）、fish-control-runtime.json（心跳）、fish-public-chat.json（访客去重与短上下文）、fish-public-bili.json（访客收件与发送状态）。旧主人状态不合并、不清空。

安装备份在原项目 backups/fish-control-*。本轮首次有效安装备份时间为 2026-10-26 01:23 北京时间；不要误把首次失败的空备份目录当作有效回滚集。

## 验证及已知边界

`node --test tests/control.test.mjs` 已通过 3 项回归（模拟平台与模型，不产生外发）。JS语法与Python编译通过。

本机端到端验证：面板停止后，真实 QQ 收件入口返回“大肥鱼已停止”；恢复后 revision 与 runtime 心跳一致；不带 CSRF 的写请求被403拒绝；控制开关本身不增加模型调用。QQ既有登录恢复，无重新扫码；开放收件的QQ/B站只读探测都成功。

用户实测发现访客第一句能回、第二句不回。根因是历史 assistant 消息缺失 DSH source 元数据，第二轮在本地投影时出现 `Cannot read properties of undefined (reading 'replayState')`。已补 source.kind/model/provider，同时为旧短上下文补齐来源；真实官方模型两轮诊断均 stop。用户随后明确确认“小号私信连续能回”。不要删除此修复，也不要用只含 role/content 的历史 assistant 消息回放给 DSH。

注意本机保守费用账本对无 usage 的失败会计入5元预留。上述本地投影失败与诊断曾增加保守估算，不能把该数字当成官方真实扣费。本轮未擅自减少账本、提高40元上限或延长截止日期。

**仍未完成：B站评论公开展示。** 用户报告主人与访客的楼层回复都看不到。平台返回发送回执后，小号鉴权API可查到评论，父楼层正确、invisible=false，但 state=17；匿名API同楼层无该回复，用户小号客户端也看不到。具体回执留在本机，仓库不发布账号和原聊天。不能因为 authenticated visible=true 就认定用户已收到。已补 publicVisible 的匿名复核与面板提示；尚不能保证平台最终展示。不要盲目重发、清空去重或尝试绕过平台限制。需继续判断平台审核/展示条件，状态17的具体含义尚未通过官方资料确定。

主人显式 @ 的旧工具只允许自主定时任务，已新增即时明确请求通道，但其真实公开展示尚待验收；它同样受平台评论可见性影响。此前自主 @ 与主人评论互动曾通过用户验收，不代表当前平台状态仍正常。

当前用户正在开放模式实测，应以本机 fish-control.json 为准，不要为“恢复默认”擅自关闭开放。其他账号 QQ、群 @ 的真人全链路仍待验收；不要把已确认的小号B站连续私信泛化为所有通道均通过。

停止是逻辑停机，保留登录进程；正在网络传输中的请求可能已经被平台接受，无法撤回。后台或QQ离线时面板应显示未连接，不能只看开关就声称运行正常。不要为这两个按钮强杀进程。

平台轮询是有限窗口：QQ 每联系人/群最近30条，B站近期会话及通知，评论查询最多3页。不会无限补收离线历史。访客B站当前支持文本及原生评论表情，未扩展原主人私信图片贴纸管线。

继续功能开发前，先检查服务端口、runtime心跳、当前 profile 引用、QQ登录状态以及费用保护。只输出经过脱敏的状态/回执，不打印原始聊天或启动令牌URL。
