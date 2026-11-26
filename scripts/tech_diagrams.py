#!/usr/bin/env python3
"""将技术设计方案中的 Mermaid 图块渲染为自适应亮/暗主题的内联 SVG。
完全离线可用（不依赖外部 CDN），配色沿用 index.html 的 CSS 变量。
"""

ARCH_SVG = """<figure class="diagram glass-sub">
<div class="diag-hd"><b>系统总体架构</b><span>所有耗时执行都在公司内网服务器，客户端只负责查看与操作</span></div>
<div class="diag-body">
<svg viewBox="0 0 960 390" width="100%" role="img" aria-label="系统总体架构图">
  <defs>
    <marker id="ar-b" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M0 1L9 5L0 9z" fill="var(--blue)"/></marker>
    <marker id="ar-t" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M0 1L9 5L0 9z" fill="var(--teal)"/></marker>
    <marker id="ar-g" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M0 1L9 5L0 9z" fill="var(--text-3)"/></marker>
  </defs>

  <!-- 分组背景 -->
  <rect x="12" y="16" width="160" height="236" rx="16" class="dg-zone z-blue"/>
  <text x="26" y="39" class="dg-zt" fill="var(--blue)">用户端</text>

  <rect x="210" y="16" width="510" height="358" rx="16" class="dg-zone z-main"/>
  <text x="226" y="39" class="dg-zt" fill="var(--text)">控制面与无状态执行器（4C8G 单机 / 本机 / 自有 Runner）</text>

  <rect x="758" y="16" width="190" height="282" rx="16" class="dg-zone z-ext"/>
  <text x="774" y="39" class="dg-zt" fill="var(--text-2)">外部连接器系统</text>

  <rect x="758" y="312" width="190" height="62" rx="14" class="dg-box b-purple"/>
  <text x="853" y="339" text-anchor="middle" class="dg-t">APNs / 安卓推送</text>
  <text x="853" y="357" text-anchor="middle" class="dg-s">系统推送通道</text>

  <!-- 用户端节点 -->
  <rect x="28" y="60" width="128" height="62" rx="12" class="dg-box b-blue"/>
  <text x="92" y="87" text-anchor="middle" class="dg-t">PC App</text>
  <text x="92" y="106" text-anchor="middle" class="dg-s">Mac / Windows</text>

  <rect x="28" y="142" width="128" height="62" rx="12" class="dg-box b-blue"/>
  <text x="92" y="169" text-anchor="middle" class="dg-t">手机 App</text>
  <text x="92" y="188" text-anchor="middle" class="dg-s">iOS / Android</text>

  <text x="92" y="232" text-anchor="middle" class="dg-s">远程访问通道</text>

  <!-- 内网服务器节点 -->
  <!-- 左列：核心入口与存储 -->
  <rect x="228" y="60" width="144" height="68" rx="12" class="dg-box b-blue"/>
  <text x="300" y="88" text-anchor="middle" class="dg-t">接口服务</text>
  <text x="300" y="107" text-anchor="middle" class="dg-s">唯一入口 + WebSocket</text>

  <rect x="228" y="150" width="144" height="48" rx="12" class="dg-box b-gray"/>
  <text x="300" y="172" text-anchor="middle" class="dg-t">PostgreSQL</text>
  <text x="300" y="188" text-anchor="middle" class="dg-s">业务数据 + 队列</text>

  <rect x="228" y="212" width="144" height="48" rx="12" class="dg-box b-gray"/>
  <text x="300" y="234" text-anchor="middle" class="dg-t">证据与附件存储</text>
  <text x="300" y="250" text-anchor="middle" class="dg-s">私有对象存储</text>

  <rect x="228" y="294" width="144" height="62" rx="12" class="dg-box b-purple"/>
  <text x="300" y="321" text-anchor="middle" class="dg-t">对话助手</text>
  <text x="300" y="340" text-anchor="middle" class="dg-s">MCP · HITL 确认卡</text>

  <!-- 中列：调度与采集 -->
  <rect x="394" y="60" width="128" height="58" rx="12" class="dg-box b-teal"/>
  <text x="458" y="85" text-anchor="middle" class="dg-t">调度与步进引擎</text>
  <text x="458" y="103" text-anchor="middle" class="dg-s">PG 同事务 + pg-boss</text>

  <rect x="394" y="150" width="128" height="58" rx="12" class="dg-box b-orange"/>
  <text x="458" y="175" text-anchor="middle" class="dg-t">采集服务</text>
  <text x="458" y="193" text-anchor="middle" class="dg-s">每 2 分钟轮询收单</text>

  <rect x="394" y="302" width="128" height="54" rx="12" class="dg-box b-purple"/>
  <text x="458" y="326" text-anchor="middle" class="dg-t">通知服务</text>
  <text x="458" y="343" text-anchor="middle" class="dg-s">桌面 / 手机 / 去重</text>

  <!-- 右列：隔离执行器 -->
  <rect x="546" y="60" width="156" height="82" rx="12" class="dg-box b-teal"/>
  <text x="624" y="86" text-anchor="middle" class="dg-t">Bot 执行器 × N</text>
  <text x="624" y="105" text-anchor="middle" class="dg-s">Pi + 动态流程 · 节级 Skills</text>
  <text x="624" y="123" text-anchor="middle" class="dg-s">断网容器 · 零凭据 · 机审门禁</text>

  <rect x="546" y="168" width="156" height="82" rx="12" class="dg-box b-orange"/>
  <text x="624" y="194" text-anchor="middle" class="dg-t">交付 / 发布执行器</text>
  <text x="624" y="213" text-anchor="middle" class="dg-s">craft 槽 + 个人执行凭据</text>
  <text x="624" y="231" text-anchor="middle" class="dg-s">MR 合入 / 发布 / 可选回滚</text>

  <!-- 外部连接器系统节点 -->
  <rect x="774" y="54" width="158" height="36" rx="10" class="dg-box b-ext"/>
  <text x="853" y="77" text-anchor="middle" class="dg-t">工单源连接器 / 手建单</text>

  <rect x="774" y="102" width="158" height="36" rx="10" class="dg-box b-ext"/>
  <text x="853" y="125" text-anchor="middle" class="dg-t">代码源连接器 (Git / PR)</text>

  <rect x="774" y="150" width="158" height="36" rx="10" class="dg-box b-ext"/>
  <text x="853" y="173" text-anchor="middle" class="dg-t">多模型网关 / Pi-AI</text>

  <rect x="774" y="198" width="158" height="36" rx="10" class="dg-box b-ext"/>
  <text x="853" y="221" text-anchor="middle" class="dg-t">制品 / 静态资源存储</text>

  <rect x="774" y="246" width="158" height="36" rx="10" class="dg-box b-ext"/>
  <text x="853" y="269" text-anchor="middle" class="dg-t">部署与配置插件 (可选)</text>

  <!-- 连线 -->
  <!-- 用户端 → 接口服务 -->
  <path d="M156 91 L188 91 L188 94 L226 94" class="dg-ln l-blue" marker-end="url(#ar-b)"/>
  <path d="M156 173 L188 173 L188 94" class="dg-ln l-blue"/>

  <!-- 接口服务 ↔ 存储 -->
  <path d="M300 128 L300 148" class="dg-ln l-gray"/>
  <path d="M300 198 L300 210" class="dg-ln l-gray"/>

  <!-- 接口服务 → 调度 → 执行器 -->
  <path d="M372 89 L392 89" class="dg-ln l-blue" marker-end="url(#ar-b)"/>
  <path d="M522 89 L544 89" class="dg-ln l-teal" marker-end="url(#ar-t)"/>
  <path d="M522 102 L534 102 L534 202 L544 202" class="dg-ln l-teal" marker-end="url(#ar-t)"/>

  <!-- 采集 → 接口服务 & Jira/Tita -->
  <path d="M394 176 L383 176 L383 114 L374 114" class="dg-ln l-gray" marker-end="url(#ar-g)"/>
  <path d="M458 150 L458 134 L738 134 L738 72 L772 72" class="dg-ln l-gray" marker-end="url(#ar-g)"/>

  <!-- 对话助手 → 接口服务 & AI 网关 -->
  <path d="M250 294 L250 272 L218 272 L218 110 L226 110" class="dg-ln l-gray" marker-end="url(#ar-g)"/>
  <path d="M372 325 L384 325 L384 276 L734 276 L734 168 L772 168" class="dg-ln l-gray" marker-end="url(#ar-g)"/>

  <!-- 接口服务 → 通知 → 推送 -->
  <path d="M336 128 L336 140 L382 140 L382 329 L392 329" class="dg-ln l-gray" marker-end="url(#ar-g)"/>
  <path d="M522 336 L756 336" class="dg-ln l-blue" marker-end="url(#ar-b)"/>

  <!-- Bot → GitLab & AI 网关 & 证据存储 -->
  <path d="M702 88 L746 88 L746 120 L772 120" class="dg-ln l-teal" marker-end="url(#ar-t)"/>
  <path d="M702 108 L742 108 L742 164 L772 164" class="dg-ln l-teal" marker-end="url(#ar-t)"/>
  <path d="M624 142 L624 156 L536 156 L536 236 L374 236" class="dg-ln l-gray" stroke-dasharray="4 3" marker-end="url(#ar-g)"/>

  <!-- 发布执行器 → GitLab & OSS & Apollo -->
  <path d="M702 194 L748 194 L748 124 L772 124" class="dg-ln l-gray" marker-end="url(#ar-g)"/>
  <path d="M702 216 L772 216" class="dg-ln l-blue" marker-end="url(#ar-b)"/>
  <path d="M702 232 L746 232 L746 264 L772 264" class="dg-ln l-blue" marker-end="url(#ar-b)"/>
</svg>
</div>
</figure>"""


ER_SVG = """<figure class="diagram glass-sub">
<div class="diag-hd"><b>核心数据模型总图（ER 关系 · 含 M1 预留与统一软删回滚台账）</b><span>全库统一 workspace_id + deleted_at 软删；不可变 events 快照支撑数据回滚；核心状态机零污染</span></div>
<div class="diag-body">
<svg viewBox="0 0 960 412" width="100%" role="img" aria-label="数据模型总图">
  <defs>
    <marker id="er-a" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto"><path d="M0 1L9 5L0 9z" fill="var(--text-3)"/></marker>
    <marker id="er-b" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto"><path d="M0 1L9 5L0 9z" fill="var(--blue)"/></marker>
  </defs>

  <!-- 1. 工作空间、项目与连接器区 -->
  <rect x="12" y="14" width="278" height="384" rx="16" class="dg-zone z-main"/>
  <text x="28" y="38" class="dg-zt" fill="var(--purple)">工作空间 · 平级项目 · 连接器</text>

  <rect x="28" y="52" width="112" height="48" rx="10" class="dg-box b-purple"/>
  <text x="84" y="71" text-anchor="middle" class="dg-t">workspaces</text>
  <text x="84" y="85" text-anchor="middle" class="dg-s">quotas · tokens</text>
  <text x="84" y="96" text-anchor="middle" class="dg-s">runners · counters</text>

  <rect x="28" y="114" width="112" height="44" rx="10" class="dg-box b-purple"/>
  <text x="84" y="133" text-anchor="middle" class="dg-t">projects</text>
  <text x="84" y="149" text-anchor="middle" class="dg-s">平级项目 + risk_rules</text>

  <rect x="28" y="170" width="112" height="68" rx="10" class="dg-box b-teal"/>
  <text x="84" y="190" text-anchor="middle" class="dg-t">workflow_templates</text>
  <text x="84" y="206" text-anchor="middle" class="dg-s">workflow_nodes</text>
  <text x="84" y="221" text-anchor="middle" class="dg-s">节点绑定 skill_ids[]</text>

  <rect x="164" y="52" width="110" height="40" rx="10" class="dg-box b-gray"/>
  <text x="219" y="69" text-anchor="middle" class="dg-t">repos · targets</text>
  <text x="219" y="84" text-anchor="middle" class="dg-s">仓库 + Repo Atlas</text>

  <rect x="164" y="102" width="110" height="40" rx="10" class="dg-box b-gray"/>
  <text x="219" y="119" text-anchor="middle" class="dg-t">environments</text>
  <text x="219" y="134" text-anchor="middle" class="dg-s">env_code · env_tier</text>

  <rect x="164" y="152" width="110" height="40" rx="10" class="dg-box b-gray"/>
  <text x="219" y="169" text-anchor="middle" class="dg-t">skills</text>
  <text x="219" y="184" text-anchor="middle" class="dg-s">→ skill_versions</text>

  <rect x="164" y="202" width="110" height="40" rx="10" class="dg-box b-gray"/>
  <text x="219" y="219" text-anchor="middle" class="dg-t">release_configs</text>
  <text x="219" y="234" text-anchor="middle" class="dg-s">craft 槽与审核人</text>

  <rect x="164" y="252" width="110" height="46" rx="10" class="dg-box b-orange"/>
  <text x="219" y="271" text-anchor="middle" class="dg-t">connectors</text>
  <text x="219" y="287" text-anchor="middle" class="dg-s">→ triggers · envelopes</text>

  <rect x="28" y="252" width="112" height="46" rx="10" class="dg-box b-blue"/>
  <text x="84" y="271" text-anchor="middle" class="dg-t">users · runner_keys</text>
  <text x="84" y="287" text-anchor="middle" class="dg-s">独立邮箱 + 信封密钥</text>

  <rect x="28" y="316" width="112" height="58" rx="10" class="dg-box b-gray"/>
  <text x="84" y="337" text-anchor="middle" class="dg-t">identities</text>
  <text x="84" y="353" text-anchor="middle" class="dg-s">connector_id + ext_id</text>
  <text x="84" y="366" text-anchor="middle" class="dg-s">外部 ID 映射</text>

  <rect x="164" y="316" width="110" height="58" rx="10" class="dg-box b-gray"/>
  <text x="219" y="338" text-anchor="middle" class="dg-t">roles · role_bindings</text>
  <text x="219" y="355" text-anchor="middle" class="dg-s">Deny-Overrides · org_units</text>
  <text x="219" y="368" text-anchor="middle" class="dg-s">workspace_members</text>

  <!-- 配置区连线：workspaces → projects & connectors；projects → repos/env/skills/release_configs/triggers -->
  <path d="M84 100 L84 112" class="dg-ln l-gray" marker-end="url(#er-a)"/>
  <path d="M140 76 L146 76 L146 275 L162 275" class="dg-ln l-gray" marker-end="url(#er-a)"/>
  <path d="M140 132 L154 132 L154 72 L162 72" class="dg-ln l-gray" marker-end="url(#er-a)"/>
  <path d="M154 122 L162 122" class="dg-ln l-gray" marker-end="url(#er-a)"/>
  <path d="M154 132 L154 222 L162 222" class="dg-ln l-gray" marker-end="url(#er-a)"/>
  <path d="M154 172 L162 172" class="dg-ln l-gray" marker-end="url(#er-a)"/>
  <path d="M84 298 L84 314" class="dg-ln l-gray" marker-end="url(#er-a)"/>
  <path d="M140 282 L154 282 L154 344 L162 344" class="dg-ln l-gray" marker-end="url(#er-a)"/>

  <!-- 2. 工单与修复区 -->
  <rect x="312" y="14" width="320" height="384" rx="16" class="dg-zone z-blue"/>
  <text x="328" y="38" class="dg-zt" fill="var(--blue)">① 工单与修复（纯净执行单元）</text>

  <rect x="330" y="142" width="122" height="72" rx="12" class="dg-box b-blue"/>
  <text x="391" y="165" text-anchor="middle" class="dg-t">tickets</text>
  <text x="391" y="182" text-anchor="middle" class="dg-s">外单 / 手建 / 派生</text>
  <text x="391" y="197" text-anchor="middle" class="dg-s">parent_ref · kind · rev</text>

  <rect x="330" y="56" width="122" height="44" rx="10" class="dg-box b-gray"/>
  <text x="391" y="75" text-anchor="middle" class="dg-t">ticket_assignees</text>
  <text x="391" y="91" text-anchor="middle" class="dg-s">修复人（可多个）</text>

  <rect x="330" y="252" width="122" height="48" rx="10" class="dg-box b-gray"/>
  <text x="391" y="272" text-anchor="middle" class="dg-t">messages</text>
  <text x="391" y="288" text-anchor="middle" class="dg-s">对话 · visibility_scope</text>

  <rect x="330" y="318" width="122" height="48" rx="10" class="dg-box b-gray"/>
  <text x="391" y="338" text-anchor="middle" class="dg-t">evidences</text>
  <text x="391" y="354" text-anchor="middle" class="dg-s">证据 · project_only</text>

  <rect x="488" y="56" width="126" height="54" rx="12" class="dg-box b-teal"/>
  <text x="551" y="76" text-anchor="middle" class="dg-t">rounds</text>
  <text x="551" y="91" text-anchor="middle" class="dg-s">round_node_runs[]</text>
  <text x="551" y="104" text-anchor="middle" class="dg-s">+ round_repo_slices</text>

  <rect x="488" y="128" width="126" height="44" rx="10" class="dg-box b-gray"/>
  <text x="551" y="147" text-anchor="middle" class="dg-t">verify_items</text>
  <text x="551" y="162" text-anchor="middle" class="dg-s">验证清单 + verifier_ref</text>

  <rect x="488" y="186" width="126" height="44" rx="10" class="dg-box b-green"/>
  <text x="551" y="205" text-anchor="middle" class="dg-t">reviews</text>
  <text x="551" y="220" text-anchor="middle" class="dg-s">审核 · L0-L2 · 归类</text>

  <rect x="488" y="244" width="126" height="42" rx="10" class="dg-box b-orange"/>
  <text x="551" y="262" text-anchor="middle" class="dg-t">bot_questions</text>
  <text x="551" y="277" text-anchor="middle" class="dg-s">Bot 提问与回答</text>

  <rect x="488" y="300" width="126" height="44" rx="10" class="dg-box b-gray"/>
  <text x="551" y="319" text-anchor="middle" class="dg-t">bot_runs</text>
  <text x="551" y="334" text-anchor="middle" class="dg-s">role · 门禁 · Token</text>

  <rect x="488" y="352" width="126" height="36" rx="10" class="dg-box b-purple"/>
  <text x="551" y="368" text-anchor="middle" class="dg-t">events（操作快照）</text>
  <text x="551" y="381" text-anchor="middle" class="dg-s">deleted_at 软删 + 回滚</text>

  <!-- triggers → tickets -->
  <path d="M274 275 L300 275 L300 178 L328 178" class="dg-ln l-blue" marker-end="url(#er-b)"/>
  <!-- tickets 内部关系（messages 与 evidences 各自直接挂 tickets） -->
  <path d="M391 142 L391 102" class="dg-ln l-gray" marker-end="url(#er-a)"/>
  <path d="M391 214 L391 250" class="dg-ln l-gray" marker-end="url(#er-a)"/>
  <path d="M330 198 L320 198 L320 342 L328 342" class="dg-ln l-gray" marker-end="url(#er-a)"/>
  <path d="M452 168 L470 168 L470 83 L486 83" class="dg-ln l-blue" marker-end="url(#er-b)"/>
  <path d="M551 110 L551 126" class="dg-ln l-gray" marker-end="url(#er-a)"/>
  <path d="M614 83 L622 83 L622 323 L616 323" class="dg-ln l-gray" marker-end="url(#er-a)"/>
  <path d="M622 150 L616 150" class="dg-ln l-gray" marker-end="url(#er-a)"/>
  <path d="M622 208 L616 208" class="dg-ln l-gray" marker-end="url(#er-a)"/>
  <path d="M622 265 L616 265" class="dg-ln l-gray" marker-end="url(#er-a)"/>

  <!-- 3. 发布、复测、原平台确认 -->
  <rect x="654" y="14" width="294" height="276" rx="16" class="dg-zone z-ext"/>
  <text x="670" y="38" class="dg-zt" fill="var(--orange)">② 发布任务 · ③ 复测记录 · 回滚</text>

  <rect x="670" y="56" width="124" height="58" rx="12" class="dg-box b-orange"/>
  <text x="732" y="77" text-anchor="middle" class="dg-t">release_tasks</text>
  <text x="732" y="93" text-anchor="middle" class="dg-s">bundles · items DAG</text>
  <text x="732" y="106" text-anchor="middle" class="dg-s">ticket_node_runs[]</text>

  <rect x="816" y="54" width="118" height="44" rx="10" class="dg-box b-gray"/>
  <text x="875" y="73" text-anchor="middle" class="dg-t">release_steps</text>
  <text x="875" y="88" text-anchor="middle" class="dg-s">可配节点命令与日志</text>

  <rect x="816" y="110" width="118" height="44" rx="10" class="dg-box b-gray"/>
  <text x="875" y="129" text-anchor="middle" class="dg-t">merge_requests</text>
  <text x="875" y="144" text-anchor="middle" class="dg-s">环境 / 主干 MR · port/</text>

  <rect x="816" y="166" width="118" height="44" rx="10" class="dg-box b-green"/>
  <text x="875" y="185" text-anchor="middle" class="dg-t">test_records</text>
  <text x="875" y="200" text-anchor="middle" class="dg-s">绑定包版本复测</text>

  <rect x="670" y="224" width="264" height="50" rx="10" class="dg-box b-red"/>
  <text x="802" y="245" text-anchor="middle" class="dg-t">rollbacks（可选插件 · 紧急回滚）</text>
  <text x="802" y="261" text-anchor="middle" class="dg-s">配置回退 · 回读 · 业务验证 · 独立权限</text>

  <!-- 4. 原平台确认 -->
  <rect x="654" y="306" width="294" height="92" rx="16" class="dg-zone z-main"/>
  <text x="670" y="330" class="dg-zt" fill="var(--green)">④ 原平台确认（仅外部来源生成）</text>
  <rect x="670" y="344" width="264" height="40" rx="10" class="dg-box b-green"/>
  <text x="802" y="369" text-anchor="middle" class="dg-t">platform_confirms · 手建/派生单跳过</text>

  <!-- tickets → release_tasks & platform_confirms -->
  <path d="M452 186 L476 186 L476 364 L668 364" class="dg-ln l-gray" stroke-dasharray="5 4" marker-end="url(#er-a)"/>
  <path d="M452 178 L466 178 L466 44 L642 44 L642 85 L668 85" class="dg-ln l-blue" marker-end="url(#er-b)"/>
  <!-- release_tasks 内部 -->
  <path d="M794 76 L814 76" class="dg-ln l-gray" marker-end="url(#er-a)"/>
  <path d="M794 85 L804 85 L804 188 L814 188" class="dg-ln l-gray" marker-end="url(#er-a)"/>
  <path d="M804 132 L814 132" class="dg-ln l-gray" marker-end="url(#er-a)"/>
</svg>
</div>
</figure>"""


STATE_SVG = """<figure class="diagram glass-sub">
<div class="diag-hd"><b>工单状态流转（状态机）</b><span>仅允许图中连线的状态转移；「排队中」是轮次状态，不是工单状态</span></div>
<div class="diag-body">
<svg viewBox="0 0 960 280" width="100%" role="img" aria-label="工单状态流转图">
  <defs>
    <marker id="st-b" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto"><path d="M0 1L9 5L0 9z" fill="var(--blue)"/></marker>
    <marker id="st-o" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto"><path d="M0 1L9 5L0 9z" fill="var(--orange)"/></marker>
    <marker id="st-r" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto"><path d="M0 1L9 5L0 9z" fill="var(--red)"/></marker>
    <marker id="st-g" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto"><path d="M0 1L9 5L0 9z" fill="var(--green)"/></marker>
  </defs>

  <!-- 起点圆 -->
  <circle cx="32" cy="96" r="8" fill="var(--text-3)"/>

  <!-- 主链节点 -->
  <rect x="78" y="68" width="104" height="56" rx="14" class="dg-box b-gray"/>
  <text x="130" y="93" text-anchor="middle" class="dg-t">待修复</text>
  <text x="130" y="110" text-anchor="middle" class="dg-s">已收单</text>

  <rect x="240" y="68" width="124" height="56" rx="14" class="dg-box b-teal"/>
  <text x="302" y="93" text-anchor="middle" class="dg-t">AI 修复中</text>
  <text x="302" y="110" text-anchor="middle" class="dg-s">Bot 执行中</text>

  <rect x="434" y="68" width="122" height="56" rx="14" class="dg-box b-blue"/>
  <text x="495" y="93" text-anchor="middle" class="dg-t">待我审核</text>
  <text x="495" y="110" text-anchor="middle" class="dg-s">已交付一轮</text>

  <rect x="626" y="68" width="122" height="56" rx="14" class="dg-box b-green"/>
  <text x="687" y="93" text-anchor="middle" class="dg-t">审核通过</text>
  <text x="687" y="110" text-anchor="middle" class="dg-s">可发测试 / 正式</text>

  <rect x="818" y="68" width="114" height="56" rx="14" class="dg-box b-purple"/>
  <text x="875" y="93" text-anchor="middle" class="dg-t">修复完成</text>
  <text x="875" y="110" text-anchor="middle" class="dg-s">负责人点击</text>

  <!-- 下方分支节点 -->
  <rect x="240" y="196" width="124" height="56" rx="14" class="dg-box b-orange"/>
  <text x="302" y="221" text-anchor="middle" class="dg-t">需要协助</text>
  <text x="302" y="238" text-anchor="middle" class="dg-s">提问 / 执行失败</text>

  <rect x="524" y="196" width="136" height="56" rx="14" class="dg-box b-red"/>
  <text x="592" y="221" text-anchor="middle" class="dg-t">打回重修</text>
  <text x="592" y="238" text-anchor="middle" class="dg-s">建第 N+1 轮入队</text>

  <!-- 主链连线 -->
  <path d="M40 96 L76 96" class="dg-ln l-blue" marker-end="url(#st-b)"/>
  <text x="58" y="84" text-anchor="middle" class="dg-lb">收单/手建</text>

  <path d="M182 96 L238 96" class="dg-ln l-blue" marker-end="url(#st-b)"/>
  <text x="210" y="84" text-anchor="middle" class="dg-lb">派给 Bot</text>

  <path d="M364 96 L432 96" class="dg-ln l-blue" marker-end="url(#st-b)"/>
  <text x="398" y="84" text-anchor="middle" class="dg-lb">交付一轮</text>

  <path d="M556 96 L624 96" class="dg-ln l-green" marker-end="url(#st-g)"/>
  <text x="590" y="84" text-anchor="middle" class="dg-lb" fill="var(--green)">审核通过</text>

  <path d="M748 96 L816 96" class="dg-ln l-blue" marker-end="url(#st-b)"/>
  <text x="782" y="84" text-anchor="middle" class="dg-lb">点完成</text>

  <!-- AI 修复中 ⇄ 需要协助 -->
  <path d="M280 124 L280 194" class="dg-ln l-orange" marker-end="url(#st-o)"/>
  <text x="272" y="164" text-anchor="end" class="dg-lb" fill="var(--orange)">提问 / 失败</text>
  <path d="M324 196 L324 126" class="dg-ln l-orange" marker-end="url(#st-o)"/>
  <text x="332" y="164" text-anchor="start" class="dg-lb" fill="var(--orange)">回答 / 重试</text>

  <!-- 代码打回 & MR/测试打回 -->
  <path d="M495 124 L495 162 L560 162 L560 194" class="dg-ln l-red" stroke-dasharray="5 4" marker-end="url(#st-r)"/>
  <text x="532" y="152" text-anchor="middle" class="dg-lb" fill="var(--red)">代码打回</text>

  <path d="M687 124 L687 162 L624 162 L624 194" class="dg-ln l-red" stroke-dasharray="5 4" marker-end="url(#st-r)"/>
  <text x="692" y="152" text-anchor="start" class="dg-lb" fill="var(--red)">MR / 测试打回</text>

  <!-- 打回重修 → AI 修复中 -->
  <path d="M524 224 L416 224 L416 112 L366 112" class="dg-ln l-red" marker-end="url(#st-r)"/>
  <text x="466" y="216" text-anchor="middle" class="dg-lb" fill="var(--red)">派给 Bot（第 N+1 轮）</text>
</svg>
</div>
</figure>"""


def render_mermaid(code: str, doc_prefix: str) -> str | None:
    """根据 Mermaid 源码特征返回对应的内联 SVG；未命中时返回 None 由调用方降级为代码块。"""
    s = code.strip()
    if doc_prefix == "tech":
        if s.startswith("flowchart") and "公司内网服务器" in s:
            return ARCH_SVG
        if s.startswith("erDiagram") and "projects" in s and "release_tasks" in s:
            return ER_SVG
        if s.startswith("stateDiagram") and "AI 修复中" in s:
            return STATE_SVG
    return None
