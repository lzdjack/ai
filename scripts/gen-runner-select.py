#!/usr/bin/env python3
"""生成 PC 执行器首次初始化前置页：选择执行环境（1440×900）
- reference/src/v5/runner-select-pc.html
三选一：
1. 本机电脑（个人免费 · 推荐 · 免 Docker）
2. 自有 / 团队服务器（关电脑通宵修 · 代码不出内网）
3. 云端托管算力（Pro · 免部署 · 24h 在线）
选定后点击「继续」才进入对应的初始化 Loading 页；团队成员若管理员已挂载服务器则自动跳过。
"""
import pathlib

ROOT = pathlib.Path(__file__).resolve().parent.parent
OUT = ROOT / "reference" / "src" / "v5"

STYLE = '''
.root{display:block;background:var(--wall)}
.ver{position:absolute;right:32px;top:26px;font-size:12px;color:var(--text-3);letter-spacing:.3px}
.aura{position:absolute;left:50%;top:42%;transform:translate(-50%,-50%);width:620px;height:620px;border-radius:50%;
  background:conic-gradient(from 200deg,#3B8BFF,#8B5CF6,#EC4899,#38BDF8,#3B8BFF);filter:blur(96px);opacity:.24;pointer-events:none}
html.dark .aura{opacity:.34}
.ring{position:absolute;left:50%;top:45%;transform:translate(-50%,-50%);border-radius:50%;border:1px solid color-mix(in srgb,var(--text) 6%,transparent);pointer-events:none}

.stage{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;padding-bottom:26px;z-index:2}
.head{display:flex;flex-direction:column;align-items:center;text-align:center}
.logo-s{display:block;filter:drop-shadow(0 12px 24px rgba(59,111,232,.24))}
.ttl{font-family:"Hiragino Sans GB","PingFang SC",sans-serif;font-weight:600;font-size:28px;letter-spacing:.8px;color:var(--text);margin-top:12px}
.sub{font-size:13.5px;color:var(--text-2);margin-top:8px}

/* 三张并排毛玻璃选择卡 */
.cards{display:grid;grid-template-columns:repeat(3,286px);gap:18px;margin-top:34px}
.opt{
  position:relative;border-radius:24px;padding:24px 22px 22px;display:flex;flex-direction:column;
  background:color-mix(in srgb,var(--glass) 82%,transparent);
  backdrop-filter:blur(40px) saturate(185%);-webkit-backdrop-filter:blur(40px) saturate(185%);
  border:1.5px solid var(--stroke);
  box-shadow:0 18px 44px -18px rgba(20,30,70,.16),inset 0 1px 0 rgba(255,255,255,.55);
}
html.dark .opt{
  background:rgba(24,28,42,.58);
  box-shadow:0 22px 52px -18px rgba(0,0,0,.55),inset 0 1px 0 rgba(255,255,255,.12);
}
.opt.on{
  background:color-mix(in srgb,var(--blue) 6%,var(--glass));
  border-color:var(--blue);
  box-shadow:
    0 0 0 4px color-mix(in srgb,var(--blue) 16%,transparent),
    0 24px 54px -18px color-mix(in srgb,var(--blue) 38%,transparent),
    inset 0 1px 0 rgba(255,255,255,.72);
}
html.dark .opt.on{
  background:color-mix(in srgb,var(--blue) 12%,rgba(24,28,42,.74));
  box-shadow:
    0 0 0 4px color-mix(in srgb,var(--blue) 22%,transparent),
    0 26px 56px -18px rgba(0,0,0,.68),
    inset 0 1px 0 rgba(255,255,255,.18);
}

.opt-top{display:flex;align-items:flex-start;justify-content:space-between;gap:10px}
.ico{width:46px;height:46px;border-radius:14px;display:flex;align-items:center;justify-content:center;color:#fff;flex:none;
  box-shadow:0 10px 22px -8px rgba(30,50,120,.38),inset 0 1px 0 rgba(255,255,255,.4)}
.ic-local{background:linear-gradient(145deg,#38BDF8,#2563EB)}
.ic-srv{background:linear-gradient(145deg,#34D399,#059669)}
.ic-cloud{background:linear-gradient(145deg,#A855F7,#6366F1)}

.radio{width:22px;height:22px;border-radius:50%;border:1.8px solid color-mix(in srgb,var(--text) 20%,transparent);display:flex;align-items:center;justify-content:center;flex:none}
.opt.on .radio{background:var(--btn-pri-bg);border-color:var(--btn-pri-bg);box-shadow:0 4px 12px -3px color-mix(in srgb,var(--btn-pri-bg) 80%,transparent)}

.opt-name-row{display:flex;align-items:center;gap:8px;margin-top:18px}
.opt-name{font-size:17px;font-weight:700;color:var(--text)}
.badge{height:20px;padding:0 7px;border-radius:6px;font-size:11px;font-weight:700;display:inline-flex;align-items:center}
.bd-free{color:var(--ink-blue);background:color-mix(in srgb,var(--blue) 13%,transparent)}
.bd-team{color:var(--ink-green);background:color-mix(in srgb,var(--green) 14%,transparent)}
.bd-pro{color:#fff;background:linear-gradient(90deg,#8B5CF6,#6366F1)}

.opt-desc{font-size:13px;line-height:1.62;color:var(--text-2);margin-top:9px;min-height:64px}
.tags{display:flex;flex-wrap:wrap;gap:6px;margin-top:14px}
.tg{height:24px;padding:0 9px;border-radius:8px;font-size:11.5px;color:var(--text-2);background:var(--fill);display:inline-flex;align-items:center;white-space:nowrap}
.opt.on .tg{background:color-mix(in srgb,var(--blue) 10%,var(--fill));color:var(--text)}

.opt-foot{margin-top:16px;padding-top:13px;border-top:1px solid var(--hair);font-size:12px;color:var(--text-3);display:flex;align-items:center;gap:6px}
.opt.on .opt-foot{color:var(--ink-blue);font-weight:600}

/* 底部继续按钮与说明 */
.acts{margin-top:30px;display:flex;flex-direction:column;align-items:center;gap:14px}
.pri-btn{
  height:44px;min-width:256px;padding:0 30px;border-radius:var(--r-lg);border:0;
  background:var(--btn-pri-bg);color:#fff;font-size:15px;font-weight:600;
  display:inline-flex;align-items:center;justify-content:center;gap:9px;
  box-shadow:0 14px 28px -10px color-mix(in srgb,var(--btn-pri-bg) 88%,transparent);
}
.skip-row{display:flex;align-items:center;gap:14px;font-size:12.5px;color:var(--text-3)}
.skip-row .lnk{color:var(--ink-blue);font-weight:600}
.vbar{width:1px;height:11px;background:var(--hair);display:inline-block}

.ft{position:absolute;left:0;right:0;bottom:30px;display:flex;justify-content:center;z-index:2}
.pill{display:inline-flex;align-items:center;gap:7px;height:30px;padding:0 14px;border-radius:15px;font-size:12px;color:var(--text-2);box-shadow:none!important}
'''

CHK = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 13l4 4L19 7"/></svg>'
ARR = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14"/><path d="M13 5l7 7-7 7"/></svg>'
LAPTOP = '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="12" rx="2"/><path d="M2 20h20"/></svg>'
SERVER = '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="3" width="20" height="8" rx="2"/><rect x="2" y="13" width="20" height="8" rx="2"/><line x1="6" y1="7" x2="6.01" y2="7"/><line x1="6" y1="17" x2="6.01" y2="17"/></svg>'
CLOUD = '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z"/></svg>'
SHIELD = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l7 3v6c0 5-3.5 8-7 9-3.5-1-7-4-7-9V6l7-3z"/><path d="M9.5 12l1.8 1.8 3.2-3.6"/></svg>'

HTML = f'''<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><title>选择执行环境 · PC</title>
<link rel="stylesheet" href="../v3/base.css"><link rel="stylesheet" href="../v4/apple.css"><link rel="stylesheet" href="pc.css">
<script>(function(){{var q=new URLSearchParams(location.search);if(q.get('mode')==='dark')document.documentElement.classList.add('dark')}})()</script>
<style>{STYLE}</style></head><body>
<div class="root">
  <div class="ring" style="width:740px;height:740px"></div>
  <div class="ring" style="width:1060px;height:1060px"></div>
  <div class="aura"></div>
  <span class="ver">v1.0 · 一期</span>

  <div class="stage">
    <div class="head">
      <img class="logo-s" src="logo.svg" width="76" height="76" alt="">
      <div class="ttl">选择云匠在哪里为你干活</div>
      <div class="sub">仅首次使用时选一次，之后随时可在「设置 → 执行器」自由切换或新增多台机器</div>
    </div>

    <div class="cards">
      <div class="opt on">
        <div class="opt-top">
          <span class="ico ic-local">{LAPTOP}</span>
          <span class="radio">{CHK}</span>
        </div>
        <div class="opt-name-row">
          <span class="opt-name">使用本机电脑</span>
          <span class="badge bd-free">个人免费</span>
        </div>
        <div class="opt-desc">直接使用当前电脑的算力与环境修 Bug，安装即开跑，无需购买服务器或配置 Docker。</div>
        <div class="tags">
          <span class="tg">免 Docker</span>
          <span class="tg">复用本机 Chrome</span>
        </div>
        <div class="opt-foot">下一步：准备本机运行环境（约 20 秒）</div>
      </div>

      <div class="opt">
        <div class="opt-top">
          <span class="ico ic-srv">{SERVER}</span>
          <span class="radio"></span>
        </div>
        <div class="opt-name-row">
          <span class="opt-name">自有 / 团队服务器</span>
          <span class="badge bd-team">企业首选</span>
        </div>
        <div class="opt-desc">在公司内网或自有 Linux 服务器跑一行命令挂载执行器，全员 App 无感使用，源码零出墙。</div>
        <div class="tags">
          <span class="tg">关电脑通宵修</span>
          <span class="tg">代码不出内网</span>
        </div>
        <div class="opt-foot">下一步：获取一行安装命令并等待上线</div>
      </div>

      <div class="opt">
        <div class="opt-top">
          <span class="ico ic-cloud">{CLOUD}</span>
          <span class="radio"></span>
        </div>
        <div class="opt-name-row">
          <span class="opt-name">云端托管算力</span>
          <span class="badge bd-pro">Pro</span>
        </div>
        <div class="opt-desc">全托管 24 小时云端专属算力池，免下载、免维护，合盖关机照样在云端持续修复与自测。</div>
        <div class="tags">
          <span class="tg">免下载秒开</span>
          <span class="tg">24h 云端在线</span>
        </div>
        <div class="opt-foot">下一步：开通或绑定云端托管额度</div>
      </div>
    </div>

    <div class="acts">
      <button class="pri-btn">使用本机电脑并继续 {ARR}</button>
      <div class="skip-row">
        <span>稍后在设置里再选？</span>
        <span class="lnk">先跳过，进入工作台 ›</span>
      </div>
    </div>
  </div>

  <div class="ft"><span class="pill glass">{SHIELD}所有工单、项目配置、Skills 与历史证据均存云端 · 切换执行器 0 数据丢失</span></div>
</div>
</body></html>'''

(OUT / "runner-select-pc.html").write_text(HTML, encoding="utf-8")
print("ok: runner-select-pc.html")
