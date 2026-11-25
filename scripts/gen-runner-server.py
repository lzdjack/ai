#!/usr/bin/env python3
"""生成 PC 首次选择「自有 / 团队服务器」后的连接引导页（1440×900）
- reference/src/v5/runner-server-pc.html
展示：节点命名 + 服务范围 + 一键脚本/Docker 切换 + 一次性令牌命令复制 + 实时监听上线握手状态 + 跳过/稍后在「设置 → 执行器」配置入口。
"""
import pathlib

ROOT = pathlib.Path(__file__).resolve().parent.parent
OUT = ROOT / "reference" / "src" / "v5"

STYLE = '''
.root{display:block;background:var(--wall)}
.top-l{position:absolute;left:32px;top:24px;display:inline-flex;align-items:center;gap:6px;height:var(--ctl-sm);padding:0 12px;border-radius:var(--r-sm);background:var(--glass-2);border:1px solid var(--border-ctl);box-shadow:var(--shadow-ctl);font-size:13px;font-weight:600;color:var(--text-2);z-index:3}
.ver{position:absolute;right:32px;top:28px;font-size:12px;color:var(--text-3);letter-spacing:.3px;z-index:3}
.aura{position:absolute;left:50%;top:44%;transform:translate(-50%,-50%);width:620px;height:620px;border-radius:50%;
  background:conic-gradient(from 160deg,#34D399,#0EA5E9,#3B8BFF,#10B981,#34D399);filter:blur(98px);opacity:.22;pointer-events:none}
html.dark .aura{opacity:.32}
.ring{position:absolute;left:50%;top:46%;transform:translate(-50%,-50%);border-radius:50%;border:1px solid color-mix(in srgb,var(--text) 6%,transparent);pointer-events:none}

.stage{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:12px 0 36px;z-index:2}
.panel{
  width:840px;border-radius:26px;padding:28px 32px 24px;
  background:color-mix(in srgb,var(--glass) 86%,transparent);
  backdrop-filter:blur(44px) saturate(185%);-webkit-backdrop-filter:blur(44px) saturate(185%);
  border:1.5px solid var(--stroke);
  box-shadow:0 26px 64px -22px rgba(20,30,70,.22),inset 0 1px 0 rgba(255,255,255,.6);
}
html.dark .panel{
  background:rgba(24,28,42,.68);
  box-shadow:0 30px 72px -22px rgba(0,0,0,.62),inset 0 1px 0 rgba(255,255,255,.12);
}

.hd{display:flex;align-items:center;gap:14px}
.ico{width:48px;height:48px;border-radius:14px;display:flex;align-items:center;justify-content:center;color:#fff;flex:none;
  background:linear-gradient(145deg,#34D399,#059669);box-shadow:0 12px 24px -8px rgba(5,150,105,.5),inset 0 1px 0 rgba(255,255,255,.4)}
.hd-t{font-size:21px;font-weight:700;color:var(--text);display:flex;align-items:center;gap:9px}
.hd-s{font-size:13px;color:var(--text-2);margin-top:4px}
.bd-team{height:20px;padding:0 7px;border-radius:6px;font-size:11px;font-weight:700;color:var(--ink-green);background:color-mix(in srgb,var(--green) 14%,transparent);display:inline-flex;align-items:center}

.sec-h{display:flex;align-items:center;gap:8px;margin-top:20px;margin-bottom:10px}
.snum{width:20px;height:20px;border-radius:50%;background:color-mix(in srgb,var(--blue) 14%,transparent);color:var(--ink-blue);font-size:11.5px;font-weight:800;display:inline-flex;align-items:center;justify-content:center;flex:none}
.sttl{font-size:13.5px;font-weight:700;color:var(--text)}
.ssub{font-size:12px;color:var(--text-3);margin-left:auto}

.grid3{display:grid;grid-template-columns:1.15fr 1fr 1.05fr;gap:12px}
.fld-b{display:flex;flex-direction:column;gap:5px}
.flb{font-size:11.5px;font-weight:600;color:var(--text-2)}
.inp{height:var(--ctl-md);border-radius:var(--r-md);padding:0 12px;background:var(--well);border:1px solid var(--hair);display:flex;align-items:center;justify-content:space-between;font-size:13px;color:var(--text)}
.sel{height:var(--ctl-md);border-radius:var(--r-md);padding:0 12px;background:var(--glass-2);border:1px solid var(--border-ctl);box-shadow:var(--shadow-ctl);display:flex;align-items:center;justify-content:space-between;font-size:13px;font-weight:600;color:var(--text)}
.sel svg{color:var(--text-3);flex:none}
.seg2{height:var(--ctl-md);border-radius:var(--r-md);padding:3px;background:var(--well);border:1px solid var(--hair);display:flex;gap:2px;align-items:center}
.seg2 span{flex:1;height:100%;border-radius:7px;display:flex;align-items:center;justify-content:center;font-size:12.5px;font-weight:600;color:var(--text-2);white-space:nowrap}
.seg2 span.on{background:var(--seg-thumb);color:var(--text);box-shadow:var(--shadow-seg)}

/* 终端命令块 */
.term{border-radius:16px;background:#161925;color:#E6EAF4;padding:15px 18px 14px;border:1px solid rgba(255,255,255,.09);box-shadow:inset 0 1px 0 rgba(255,255,255,.06)}
html.dark .term{background:rgba(8,10,18,.78)}
.term-top{display:flex;align-items:center;gap:8px;margin-bottom:10px}
.term-tag{font-size:11px;font-weight:600;color:#94A3B8;background:rgba(255,255,255,.07);padding:3px 8px;border-radius:6px}
.copy-btn{margin-left:auto;height:var(--ctl-xs);padding:0 12px;border-radius:var(--r-sm);background:var(--btn-pri-bg);color:#fff;font-size:12px;font-weight:600;display:inline-flex;align-items:center;gap:5px}
.ref-btn{height:var(--ctl-xs);padding:0 10px;border-radius:var(--r-sm);background:rgba(255,255,255,.08);color:#CBD5E1;font-size:12px;font-weight:500;display:inline-flex;align-items:center;gap:4px}
.cmd{font-family:"SF Mono",ui-monospace,Menlo,monospace;font-size:12.5px;line-height:1.72;white-space:pre;overflow:hidden}
.cmd .c-p{color:#64748B}.cmd .c-k{color:#38BDF8}.cmd .c-f{color:#C084FC}.cmd .c-s{color:#34D399}
.term-meta{display:flex;align-items:center;gap:14px;margin-top:11px;padding-top:10px;border-top:1px solid rgba(255,255,255,.08);font-size:11.5px;color:#94A3B8}
.term-meta b{color:#E2E8F0;font-weight:600}

/* 实时等待握手条 */
.wait-bar{
  margin-top:16px;border-radius:16px;padding:14px 16px;
  background:color-mix(in srgb,var(--green) 8%,var(--glass-2));
  border:1px solid color-mix(in srgb,var(--green) 32%,transparent);
  display:flex;align-items:center;gap:14px;
}
.pulse{width:12px;height:12px;border-radius:50%;background:var(--green);flex:none;box-shadow:0 0 0 5px color-mix(in srgb,var(--green) 24%,transparent)}
.w-steps{display:flex;align-items:center;gap:10px;margin-left:auto;font-size:12px;color:var(--text-2);white-space:nowrap}
.ws-ok{color:var(--ink-green);font-weight:600}.ws-run{color:var(--ink-blue);font-weight:600}.ws-dim{color:var(--text-3)}

/* 底部动作条 */
.foot{margin-top:20px;padding-top:16px;border-top:1px solid var(--hair);display:flex;align-items:center;gap:10px}
.f-btn{height:var(--ctl-lg);padding:0 18px;border-radius:var(--r-lg);font-size:13.5px;font-weight:600;display:inline-flex;align-items:center;gap:7px;white-space:nowrap}
.f-sec{background:var(--fill);color:var(--text)}
.f-pri{background:var(--btn-pri-bg);color:#fff;box-shadow:0 10px 22px -8px color-mix(in srgb,var(--btn-pri-bg) 85%,transparent)}

.ft{position:absolute;left:0;right:0;bottom:26px;display:flex;justify-content:center;z-index:2}
.pill{display:inline-flex;align-items:center;gap:7px;height:26px;padding:0 12px;border-radius:var(--r-full);font-size:12px;font-weight:600;color:var(--text-2);box-shadow:none!important}
'''

BACK = '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 18l-6-6 6-6"/></svg>'
SERVER = '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="3" width="20" height="8" rx="2"/><rect x="2" y="13" width="20" height="8" rx="2"/><line x1="6" y1="7" x2="6.01" y2="7"/><line x1="6" y1="17" x2="6.01" y2="17"/></svg>'
COPY = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>'
REF = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 11-3.2-6.9"/><path d="M21 3v6h-6"/></svg>'
SHIELD = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l7 3v6c0 5-3.5 8-7 9-3.5-1-7-4-7-9V6l7-3z"/><path d="M9.5 12l1.8 1.8 3.2-3.6"/></svg>'
CHEVD = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9l6 6 6-6"/></svg>'

HTML = f'''<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><title>连接自有 / 团队服务器 · PC</title>
<link rel="stylesheet" href="../v3/base.css"><link rel="stylesheet" href="../v4/apple.css"><link rel="stylesheet" href="pc.css">
<script>(function(){{var q=new URLSearchParams(location.search);if(q.get('mode')==='dark')document.documentElement.classList.add('dark')}})()</script>
<style>{STYLE}</style></head><body>
<div class="root">
  <div class="ring" style="width:760px;height:760px"></div>
  <div class="ring" style="width:1080px;height:1080px"></div>
  <div class="aura"></div>
  <span class="top-l glass">{BACK}返回重选执行环境</span>
  <span class="ver">v1.0 · 一期</span>

  <div class="stage">
    <div class="panel">
      <div class="hd">
        <span class="ico">{SERVER}</span>
        <div class="col grow">
          <div class="hd-t">连接自有 / 团队服务器 <span class="bd-team">企业首选 · 零入站端口</span></div>
          <div class="hd-s">在公司内网或自有 Linux / macOS 服务器运行一行命令，通过出站 WSS 通道安全接入，全员 App 自动免配置复用</div>
        </div>
      </div>

      <div class="sec-h">
        <span class="snum">1</span><span class="sttl">设置节点信息</span><span class="ssub">上线后仍可在「设置 → 执行器」随时调整</span>
      </div>
      <div class="grid3">
        <div class="fld-b"><span class="flb">节点名称</span><div class="inp mono">shanghai-ci-01</div></div>
        <div class="fld-b"><span class="flb">可见范围</span><div class="sel"><span>全团队共用（默认）</span>{CHEVD}</div></div>
        <div class="fld-b"><span class="flb">安装方式</span><div class="seg2"><span class="on">一键脚本</span><span>Docker Compose</span></div></div>
      </div>

      <div class="sec-h">
        <span class="snum">2</span><span class="sttl">在服务器终端执行安装命令</span><span class="ssub">支持 Ubuntu / Debian / CentOS / macOS · 推荐 4C 8G 起步</span>
      </div>
      <div class="term">
        <div class="term-top">
          <span class="term-tag">bash · Linux / macOS</span>
          <span class="term-tag">出站 WSS 443 · 无需公网 IP</span>
          <span class="ref-btn">{REF}换一个令牌</span>
          <span class="copy-btn">{COPY}一键复制命令</span>
        </div>
        <div class="cmd"><span class="c-p">$</span> <span class="c-k">curl</span> -fsSL https://get.cloudcraft.dev/runner.sh | sh -s -- \\
    <span class="c-f">--token</span> <span class="c-s">cc_run_live_9f8a2c7e4b10...k4p1</span> \\
    <span class="c-f">--name</span>  <span class="c-s">"shanghai-ci-01"</span> \\
    <span class="c-f">--scope</span> <span class="c-s">team</span> \\
    <span class="c-f">--hub</span>   <span class="c-s">wss://hub.cloudcraft.dev</span></div>
        <div class="term-meta">
          <span>一次性注册令牌 <b>14:36 后过期</b></span>
          <span>·</span>
          <span>自动托管为 <b>systemd / launchd</b> 后台服务</span>
          <span>·</span>
          <span>源码与构建产物<b>100% 留在内网</b></span>
        </div>
      </div>

      <div class="wait-bar">
        <span class="pulse"></span>
        <div class="col" style="gap:2px">
          <span class="f13.5 w7" style="font-size:13.5px">正在监听节点 <span class="mono">shanghai-ci-01</span> 上线握手…</span>
          <span class="f12 t2">已等待 00:24 · 脚本跑完将自动连通并校验 Node / Git / Chromium 环境</span>
        </div>
        <div class="w-steps">
          <span class="ws-ok">✓ 令牌已签发</span>
          <span class="t3">→</span>
          <span class="ws-run">⟳ 等待服务器运行</span>
          <span class="t3">→</span>
          <span class="ws-dim">○ 校验并进入工作台</span>
        </div>
      </div>

      <div class="foot">
        <span class="f12 t3 grow">还没准备好服务器？可先进入工作台，之后随时在 <b style="color:var(--text-2)">设置 → 执行器</b> 挂载或切回本机电脑</span>
        <span class="f-btn f-sec">先进入工作台 · 后台监听</span>
        <span class="f-btn f-pri">{REF}我已运行，立即检测</span>
      </div>
    </div>
  </div>

  <div class="ft">
    <span class="pill glass">{SHIELD}执行器纯无状态 · 换机器或重装 0 丢数 · 支持同时挂载多台服务器自动负载均衡</span>
  </div>
</div>
</body></html>'''

out = OUT / "runner-server-pc.html"
out.write_text(HTML, encoding="utf-8")
print("→", out)
