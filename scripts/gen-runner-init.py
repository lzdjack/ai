#!/usr/bin/env python3
"""生成 PC 执行器首次初始化 Loading 页（终版：水波纹星光 + 灵动岛单胶囊）
- reference/src/v5/runner-init-pc.html（1440×900）
特点：
- 无白框悬浮图标 + 5 层水波纹扩散环（实装 CSS @keyframes rippleOut 60fps 扩散）+ 流光弧线与品牌星光点缀
- 灵动岛式单胶囊微展开：天然免疫后续增加初始化步骤与英文（en-US）文案变长，不撑爆布局
用法：python3 scripts/gen-runner-init.py
"""
import pathlib

ROOT = pathlib.Path(__file__).resolve().parent.parent
OUT = ROOT / "reference" / "src" / "v5"

STYLE = '''
.root{display:block;background:var(--wall)}
.ver{position:absolute;right:32px;top:26px;font-size:12px;color:var(--text-3);letter-spacing:.3px}

/* 中央视觉舞台 */
.stage{
  position:absolute;inset:0;display:flex;flex-direction:column;
  align-items:center;justify-content:center;padding-bottom:68px;z-index:2;
}

/* 悬浮图标 + 5 层水波纹 + 流光弧线 + 星光点缀 */
.hero-orb{
  position:relative;width:168px;height:168px;
  display:flex;align-items:center;justify-content:center;
}
.aurora-1{
  position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);
  width:560px;height:560px;border-radius:50%;pointer-events:none;
  background:conic-gradient(from 195deg,#3B8BFF,#8B5CF6,#EC4899,#38BDF8,#3B8BFF);
  filter:blur(92px);opacity:.26;
}
html.dark .aurora-1{opacity:.38;filter:blur(98px)}
.aurora-2{
  position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);
  width:214px;height:214px;border-radius:50%;pointer-events:none;
  background:radial-gradient(circle,rgba(79,139,255,.54) 0%,rgba(155,92,255,.28) 52%,transparent 76%);
  filter:blur(28px);opacity:.78;
}
html.dark .aurora-2{opacity:.94}

@keyframes rippleOut{
  0%{transform:translate(-50%,-50%) scale(.42);opacity:.75}
  70%{opacity:.22}
  100%{transform:translate(-50%,-50%) scale(1.04);opacity:0}
}
.ripple{
  position:absolute;left:50%;top:50%;border-radius:50%;pointer-events:none;
  transform:translate(-50%,-50%);
  background:radial-gradient(circle,
    transparent 62%,
    rgba(79,139,255,.04) 78%,
    rgba(110,130,255,.11) 92%,
    rgba(255,255,255,.45) 97.5%,
    rgba(79,139,255,.22) 100%
  );
  border:1px solid rgba(99,132,255,.26);
  box-shadow:inset 0 0 18px rgba(79,139,255,.08),0 0 22px -6px rgba(79,139,255,.18);
}
html.dark .ripple{
  background:radial-gradient(circle,
    transparent 62%,
    rgba(79,139,255,.04) 78%,
    rgba(139,92,246,.13) 92%,
    rgba(165,216,255,.28) 97.5%,
    rgba(56,189,248,.18) 100%
  );
  border:1px solid rgba(125,211,252,.24);
  box-shadow:inset 0 0 22px rgba(79,139,255,.12),0 0 28px -6px rgba(56,189,248,.22);
}

.rp1{width:214px;height:214px;opacity:.92;border-width:1.4px}
.rp2{width:326px;height:326px;opacity:.62;border-width:1.1px}
.rp3{width:468px;height:468px;opacity:.36;border-width:1px}
.rp4{width:640px;height:640px;opacity:.17;border-width:1px}
.rp5{width:830px;height:830px;opacity:.07;border-width:1px}

.arc-1{
  position:absolute;left:50%;top:50%;transform:translate(-50%,-50%) rotate(-32deg);
  width:214px;height:214px;border-radius:50%;pointer-events:none;
  background:conic-gradient(from 0deg,transparent 0deg,transparent 235deg,rgba(79,139,255,.8) 318deg,rgba(168,85,247,.95) 348deg,rgba(56,189,248,1) 360deg);
  -webkit-mask:radial-gradient(farthest-side,transparent calc(100% - 2.4px),#000 calc(100% - 1.8px));
  mask:radial-gradient(farthest-side,transparent calc(100% - 2.4px),#000 calc(100% - 1.8px));
  filter:drop-shadow(0 0 9px rgba(79,139,255,.65));
}
.arc-2{
  position:absolute;left:50%;top:50%;transform:translate(-50%,-50%) rotate(148deg);
  width:326px;height:326px;border-radius:50%;pointer-events:none;
  background:conic-gradient(from 0deg,transparent 0deg,transparent 290deg,rgba(139,92,246,.55) 342deg,rgba(196,181,253,.8) 360deg);
  -webkit-mask:radial-gradient(farthest-side,transparent calc(100% - 1.8px),#000 calc(100% - 1.2px));
  mask:radial-gradient(farthest-side,transparent calc(100% - 1.8px),#000 calc(100% - 1.2px));
  opacity:.72;
}

.spark{position:absolute;border-radius:50%;background:#fff;pointer-events:none;transform:translate(-50%,-50%)}
.sp1{width:7px;height:7px;left:calc(50% + 57px);top:calc(50% - 91px);
  box-shadow:0 0 0 3px rgba(56,189,248,.3),0 0 14px 3px rgba(56,189,248,.9)}
.sp2{width:5.5px;height:5.5px;left:calc(50% - 146px);top:calc(50% + 73px);
  background:color-mix(in srgb,#C084FC 55%,#fff);
  box-shadow:0 0 0 3px rgba(168,85,247,.22),0 0 12px 2px rgba(168,85,247,.68)}
.sp3{width:4.5px;height:4.5px;left:calc(50% + 157px);top:calc(50% + 44px);
  background:color-mix(in srgb,#60A5FA 55%,#fff);
  box-shadow:0 0 0 2.5px rgba(59,139,255,.18),0 0 10px 2px rgba(59,139,255,.6)}
.sp4{width:4px;height:4px;left:calc(50% - 196px);top:calc(50% - 127px);
  background:color-mix(in srgb,#93C5FD 65%,#fff);opacity:.82;
  box-shadow:0 0 8px 1.5px rgba(59,139,255,.45)}

.glint{position:absolute;pointer-events:none;transform:translate(-50%,-50%);z-index:2}
.gl1{left:calc(50% + 186px);top:calc(50% - 142px);opacity:.85;filter:drop-shadow(0 0 8px rgba(96,165,250,.75))}
.gl2{left:calc(50% - 134px);top:calc(50% - 94px);opacity:.65;filter:drop-shadow(0 0 6px rgba(168,85,247,.7))}

.logo-float{
  position:relative;z-index:3;display:block;
  filter:drop-shadow(0 18px 34px rgba(59,111,232,.28));
}
html.dark .logo-float{
  filter:drop-shadow(0 20px 42px rgba(0,0,0,.55)) drop-shadow(0 0 26px rgba(108,92,231,.38));
}

.nm{
  position:relative;z-index:2;
  font-family:"Hiragino Sans GB","PingFang SC",sans-serif;
  font-weight:600;font-size:28px;letter-spacing:1.2px;color:var(--text);
  margin-top:46px;
}
.sub-brand{
  position:relative;z-index:2;
  font-family:"Optima","Avenir Next",sans-serif;
  font-size:12px;letter-spacing:3.8px;text-transform:uppercase;font-weight:700;
  background:linear-gradient(90deg,#3B6FE8,#7C4DDB);
  -webkit-background-clip:text;-webkit-text-fill-color:transparent;
  opacity:.88;margin-top:8px;
}
html.dark .sub-brand{
  background:linear-gradient(90deg,#7DD3FC,#C4B5FD);
  -webkit-background-clip:text;-webkit-text-fill-color:transparent;
  opacity:.92;
}

/* 单根极光细进度条 */
.bar-wrap{width:448px;margin-top:34px;position:relative;z-index:2}
.bar-track{
  height:6px;border-radius:99px;
  background:color-mix(in srgb,var(--text) 9%,transparent);
  overflow:visible;position:relative;
}
.bar-fill{
  width:68%;height:100%;border-radius:99px;position:relative;
  background:linear-gradient(90deg,#3B8BFF,#8B5CF6 58%,#38BDF8);
  box-shadow:0 0 16px -1px rgba(79,139,255,.65);
}
.bar-head{
  position:absolute;right:-3px;top:50%;transform:translateY(-50%);
  width:10px;height:10px;border-radius:50%;background:#fff;
  box-shadow:0 0 0 3px rgba(56,189,248,.35),0 0 12px 2px rgba(56,189,248,.9);
}

/* 灵动岛式单胶囊（天然适应任意步骤数与多语言文案长度） */
.island{
  position:relative;z-index:2;
  margin-top:20px;width:448px;padding:14px 18px;border-radius:22px;
  background:color-mix(in srgb,var(--glass) 84%,transparent);
  backdrop-filter:blur(42px) saturate(185%);
  -webkit-backdrop-filter:blur(42px) saturate(185%);
  border:1px solid var(--stroke);
  box-shadow:0 20px 48px -18px rgba(20,30,70,.18),inset 0 1px 0 rgba(255,255,255,.55);
}
html.dark .island{
  background:rgba(24,28,42,.62);
  box-shadow:0 22px 54px -18px rgba(0,0,0,.58),inset 0 1px 0 rgba(255,255,255,.14);
}
.isl-top{display:flex;align-items:center;justify-content:space-between;gap:12px}
.isl-l{display:flex;align-items:center;gap:9px;font-size:13.5px;font-weight:600;color:var(--text);min-width:0}
.isl-l span:last-child{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.live-dot{
  width:7px;height:7px;border-radius:50%;background:var(--teal);
  box-shadow:0 0 0 3.5px color-mix(in srgb,var(--teal) 24%,transparent);
  flex:none;
}
.isl-r{display:flex;align-items:center;gap:7px;font-size:12px;color:var(--text-3);white-space:nowrap}
.isl-pct{font-family:"SF Mono",ui-monospace,monospace;font-size:13px;font-weight:700;color:var(--ink-blue)}
.isl-bot{
  display:flex;align-items:center;justify-content:space-between;gap:10px;
  margin-top:11px;padding-top:10px;border-top:1px solid var(--hair);font-size:12px;
}
.dots{display:flex;align-items:center;gap:5px}
.dot{width:6.5px;height:6.5px;border-radius:50%;background:var(--fill)}
.dot.ok{background:var(--green)}
.dot.run{width:18px;border-radius:99px;background:linear-gradient(90deg,var(--blue),var(--teal))}
.step-cnt{margin-left:5px;font-family:"SF Mono",ui-monospace,monospace;font-size:11.5px;color:var(--text-3)}
.isl-mono{font-family:"SF Mono",ui-monospace,monospace;font-size:11.5px;color:var(--text-3);white-space:nowrap}
.isl-lnk{color:var(--ink-blue);font-weight:600;font-size:12px;white-space:nowrap}

/* 底部克制操作区 */
.bottom{
  position:absolute;left:0;right:0;bottom:42px;
  display:flex;flex-direction:column;align-items:center;gap:12px;z-index:2;
}
.ghost-btn{
  height:var(--ctl-lg);padding:0 24px;border-radius:99px;
  display:inline-flex;align-items:center;gap:8px;
  font-size:13.5px;font-weight:600;color:var(--text);
  background:var(--glass);
  backdrop-filter:blur(32px) saturate(180%);
  -webkit-backdrop-filter:blur(32px) saturate(180%);
  border:1px solid var(--stroke);
  box-shadow:0 12px 28px -12px rgba(20,30,70,.16),inset 0 1px 0 rgba(255,255,255,.55);
}
html.dark .ghost-btn{
  box-shadow:0 14px 32px -10px rgba(0,0,0,.5),inset 0 1px 0 rgba(255,255,255,.14);
}
.sub-links{display:flex;align-items:center;gap:12px;font-size:12px;color:var(--text-3)}
.vbar{width:1px;height:11px;background:var(--hair);display:inline-block}
.sub-links .lnk{color:var(--ink-blue);font-weight:600}
'''

ARR = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14"/><path d="M13 5l7 7-7 7"/></svg>'
STAR_L = '<svg width="16" height="16" viewBox="0 0 24 24" fill="url(#sg1)"><defs><linearGradient id="sg1" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#60A5FA"/><stop offset="100%" stop-color="#A78BFA"/></linearGradient></defs><path d="M12 2l2.1 7.9L22 12l-7.9 2.1L12 22l-2.1-7.9L2 12l7.9-2.1z"/></svg>'
STAR_S = '<svg width="11" height="11" viewBox="0 0 24 24" fill="url(#sg2)"><defs><linearGradient id="sg2" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#C084FC"/><stop offset="100%" stop-color="#60A5FA"/></linearGradient></defs><path d="M12 2l2.1 7.9L22 12l-7.9 2.1L12 22l-2.1-7.9L2 12l7.9-2.1z"/></svg>'

HTML = f'''<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><title>执行器首次初始化 · PC</title>
<link rel="stylesheet" href="../v3/base.css"><link rel="stylesheet" href="../v4/apple.css"><link rel="stylesheet" href="pc.css">
<script>(function(){{var q=new URLSearchParams(location.search);if(q.get('mode')==='dark')document.documentElement.classList.add('dark')}})()</script>
<style>{STYLE}</style></head><body>
<div class="root">
  <span class="ver">v1.0 · 一期</span>

  <div class="stage">
    <div class="hero-orb">
      <div class="aurora-1"></div>
      <div class="aurora-2"></div>
      <div class="ripple rp5"></div>
      <div class="ripple rp4"></div>
      <div class="ripple rp3"></div>
      <div class="ripple rp2"></div>
      <div class="ripple rp1"></div>
      <div class="arc-1"></div>
      <div class="arc-2"></div>
      <div class="spark sp1"></div>
      <div class="spark sp2"></div>
      <div class="spark sp3"></div>
      <div class="spark sp4"></div>
      <span class="glint gl1">{STAR_L}</span>
      <span class="glint gl2">{STAR_S}</span>
      <img class="logo-float" src="logo.svg" width="152" height="152" alt="">
    </div>

    <div class="nm">正在唤醒云匠引擎</div>
    <div class="sub-brand">CloudCraft · Local Runner</div>

    <div class="bar-wrap">
      <div class="bar-track">
        <div class="bar-fill"><span class="bar-head"></span></div>
      </div>
    </div>

    <div class="island">
      <div class="isl-top">
        <div class="isl-l">
          <span class="live-dot"></span>
          <span>拉取无头浏览器组件（Chromium）</span>
        </div>
        <div class="isl-r">
          <span class="isl-pct">68%</span>
          <span>· 约 18 秒</span>
        </div>
      </div>
      <div class="isl-bot">
        <div class="dots">
          <span class="dot ok"></span>
          <span class="dot ok"></span>
          <span class="dot run"></span>
          <span class="dot"></span>
          <span class="step-cnt">3 / 4</span>
        </div>
        <span class="isl-mono">112 / 165 MB · 6.2 MB/s</span>
        <span class="isl-lnk">切换镜像</span>
      </div>
    </div>
  </div>

  <div class="bottom">
    <div class="ghost-btn">先进入工作台 · 后台继续准备 {ARR}</div>
    <div class="sub-links">
      <span>首次完成即秒启 · 已装 Chrome 自动 0 下载复用</span>
      <span class="vbar"></span>
      <span class="lnk">连接团队服务器 Runner ›</span>
    </div>
  </div>
</div>
</body></html>'''

(OUT / "runner-init-pc.html").write_text(HTML, encoding="utf-8")
print("ok: runner-init-pc.html (Dynamic Island final)")
