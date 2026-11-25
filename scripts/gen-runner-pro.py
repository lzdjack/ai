#!/usr/bin/env python3
"""生成 PC 首次选择「云端托管算力 Pro」后的开通与绑定页（1440×900）
- reference/src/v5/runner-pro-pc.html
展示：Pro 个人版 / Team 团队池方案选择、企业兑换码/私有云绑定切换、托管机房区域、零落盘安全承诺与一键开通分配节点。
"""
import pathlib

ROOT = pathlib.Path(__file__).resolve().parent.parent
OUT = ROOT / "reference" / "src" / "v5"

STYLE = '''
.root{display:block;background:var(--wall)}
.top-l{position:absolute;left:32px;top:24px;display:inline-flex;align-items:center;gap:6px;height:var(--ctl-sm);padding:0 12px;border-radius:var(--r-sm);background:var(--glass-2);border:1px solid var(--border-ctl);box-shadow:var(--shadow-ctl);font-size:13px;font-weight:600;color:var(--text-2);z-index:3}
.ver{position:absolute;right:32px;top:28px;font-size:12px;color:var(--text-3);letter-spacing:.3px;z-index:3}
.aura{position:absolute;left:50%;top:44%;transform:translate(-50%,-50%);width:640px;height:640px;border-radius:50%;
  background:conic-gradient(from 210deg,#8B5CF6,#6366F1,#EC4899,#38BDF8,#8B5CF6);filter:blur(100px);opacity:.24;pointer-events:none}
html.dark .aura{opacity:.36}
.ring{position:absolute;left:50%;top:46%;transform:translate(-50%,-50%);border-radius:50%;border:1px solid color-mix(in srgb,var(--text) 6%,transparent);pointer-events:none}

.stage{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:12px 0 36px;z-index:2}
.panel{
  width:880px;border-radius:26px;padding:28px 32px 24px;
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
  background:linear-gradient(145deg,#A855F7,#6366F1);box-shadow:0 12px 24px -8px rgba(99,102,241,.52),inset 0 1px 0 rgba(255,255,255,.4)}
.hd-t{font-size:21px;font-weight:700;color:var(--text);display:flex;align-items:center;gap:9px}
.hd-s{font-size:13px;color:var(--text-2);margin-top:4px}
.bd-pro{height:20px;padding:0 7px;border-radius:6px;font-size:11px;font-weight:700;color:#fff;background:linear-gradient(90deg,#6D28D9,#4338CA);display:inline-flex;align-items:center}

.mode-bar{margin-top:18px;display:flex;align-items:center;gap:12px}
.seg2{height:var(--ctl-md);border-radius:var(--r-md);padding:3px;background:var(--well);border:1px solid var(--hair);display:inline-flex;gap:2px;align-items:center}
.seg2 span{height:100%;padding:0 16px;border-radius:7px;display:inline-flex;align-items:center;font-size:13px;font-weight:600;color:var(--text-2);white-space:nowrap}
.seg2 span.on{background:var(--seg-thumb);color:var(--text);box-shadow:var(--shadow-seg)}

.cols{display:grid;grid-template-columns:1.18fr 1fr;gap:18px;margin-top:16px;align-items:stretch}
.plans{display:flex;flex-direction:column;gap:12px}
.plan{
  border-radius:18px;padding:16px 18px;background:var(--glass-2);border:1.5px solid var(--stroke);
  display:flex;flex-direction:column;gap:8px;position:relative;
}
.plan.on{
  border-color:#7C3AED;background:color-mix(in srgb,#8B5CF6 7%,var(--glass-2));
  box-shadow:0 0 0 3px color-mix(in srgb,#8B5CF6 16%,transparent),0 14px 30px -16px rgba(124,58,237,.45);
}
html.dark .plan.on{background:color-mix(in srgb,#8B5CF6 14%,rgba(30,32,48,.82))}
.p-top{display:flex;align-items:center;gap:10px}
.radio{width:18px;height:18px;border-radius:50%;border:1.5px solid var(--border-ctl-hover);display:flex;align-items:center;justify-content:center;flex:none}
.plan.on .radio{background:linear-gradient(135deg,#6D28D9,#4338CA);border-color:transparent}
.price{margin-left:auto;display:flex;align-items:baseline;gap:2px}
.price b{font-size:22px;font-weight:800;color:var(--text)}.price em{font-style:normal;font-size:12px;color:var(--text-3)}
.specs{display:flex;flex-wrap:wrap;gap:6px;margin-top:2px}
.sp{height:20px;padding:0 7px;border-radius:6px;background:var(--fill);font-size:11px;font-weight:600;color:var(--text-2);display:inline-flex;align-items:center;white-space:nowrap}
.plan.on .sp{background:color-mix(in srgb,#8B5CF6 12%,var(--fill));color:var(--text)}

.side{border-radius:18px;padding:18px 20px;background:var(--glass-2);border:1px solid var(--stroke);display:flex;flex-direction:column;gap:14px}
.flb{font-size:11.5px;font-weight:600;color:var(--text-2);margin-bottom:6px}
.sel{height:var(--ctl-md);border-radius:var(--r-md);padding:0 12px;background:var(--glass-2);border:1px solid var(--border-ctl);box-shadow:var(--shadow-ctl);display:flex;align-items:center;justify-content:space-between;font-size:13px;font-weight:600;color:var(--text)}
.sel svg{color:var(--text-3);flex:none}
.chk-list{display:flex;flex-direction:column;gap:9px}
.chk-r{display:flex;align-items:flex-start;gap:8px;font-size:12.5px;line-height:1.5;color:var(--text-2)}
.ck-g{width:17px;height:17px;border-radius:50%;background:var(--btn-ok-bg);color:#fff;display:inline-flex;align-items:center;justify-content:center;flex:none;margin-top:1px}
.redeem{margin-top:auto;padding:10px 12px;border-radius:12px;background:color-mix(in srgb,var(--blue) 7%,transparent);border:1px dashed color-mix(in srgb,var(--blue) 32%,transparent);display:flex;align-items:center;gap:8px;font-size:12px;color:var(--text-2)}
.redeem b{color:var(--ink-blue)}

.foot{margin-top:20px;padding-top:16px;border-top:1px solid var(--hair);display:flex;align-items:center;gap:10px}
.f-btn{height:var(--ctl-lg);padding:0 20px;border-radius:var(--r-lg);font-size:14px;font-weight:600;display:inline-flex;align-items:center;gap:8px;white-space:nowrap}
.f-sec{background:var(--fill);color:var(--text)}
.f-pri{background:linear-gradient(135deg,#6D28D9,#4338CA);color:#fff;box-shadow:0 12px 26px -8px rgba(67,56,202,.72)}

.ft{position:absolute;left:0;right:0;bottom:26px;display:flex;justify-content:center;z-index:2}
.pill{display:inline-flex;align-items:center;gap:7px;height:26px;padding:0 12px;border-radius:var(--r-full);font-size:12px;font-weight:600;color:var(--text-2);box-shadow:none!important}
'''

BACK = '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 18l-6-6 6-6"/></svg>'
CLOUD = '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z"/></svg>'
CHK = '<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 13l4 4L19 7"/></svg>'
ARR = '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14"/><path d="M13 5l7 7-7 7"/></svg>'
CHEVD = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9l6 6 6-6"/></svg>'
KEY = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="7.5" cy="15.5" r="4.5"/><path d="M10.7 12.3L21 2M16 7l3 3M18 5l2 2"/></svg>'
SHIELD = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l7 3v6c0 5-3.5 8-7 9-3.5-1-7-4-7-9V6l7-3z"/><path d="M9.5 12l1.8 1.8 3.2-3.6"/></svg>'

HTML = f'''<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><title>开通或绑定云端托管算力 Pro · PC</title>
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
        <span class="ico">{CLOUD}</span>
        <div class="col grow">
          <div class="hd-t">开通或绑定云端托管算力 <span class="bd-pro">Pro · 免部署秒开</span></div>
          <div class="hd-s">由云匠托管 24 小时专属隔离容器与无头浏览器池，免本机下载、合盖关机照样持续修单与出证据</div>
        </div>
      </div>

      <div class="mode-bar">
        <div class="seg2">
          <span class="on">开通云端托管套餐</span>
          <span>输入企业兑换码 / 绑定私有云池</span>
        </div>
        <span class="f12 t3" style="margin-left:auto">开通后约 3 秒分配专属节点，立即可用</span>
      </div>

      <div class="cols">
        <div class="plans">
          <div class="plan on">
            <div class="p-top">
              <span class="radio">{CHK}</span>
              <div class="col"><span class="f15 w7">Pro 个人托管</span><span class="f12 t3">适合独立开发者与小团队日常修单</span></div>
              <div class="price"><b>¥99</b><em>/ 月</em></div>
            </div>
            <div class="specs">
              <span class="sp">2 并发槽</span>
              <span class="sp">4C 8G 容器</span>
              <span class="sp">300 轮/月</span>
              <span class="sp">合盖通宵在线</span>
            </div>
          </div>

          <div class="plan">
            <div class="p-top">
              <span class="radio"></span>
              <div class="col"><span class="f15 w7">Team 团队托管池</span><span class="f12 t3">多人共享公平调度 · 独立网络隔离</span></div>
              <div class="price"><b>¥499</b><em>/ 月起</em></div>
            </div>
            <div class="specs">
              <span class="sp">6 并发修单槽</span>
              <span class="sp">专属隔离 VPC</span>
              <span class="sp">团队共享额度</span>
              <span class="sp">99.9% SLA</span>
            </div>
          </div>
        </div>

        <div class="side">
          <div>
            <div class="flb">托管节点区域</div>
            <div class="sel"><span>华东 · 上海（推荐 · 延迟 18ms）</span>{CHEVD}</div>
          </div>
          <div>
            <div class="flb">隔离与安全承诺</div>
            <div class="chk-list">
              <div class="chk-r"><span class="ck-g">{CHK}</span><span>每轮任务独占干净容器与独立浏览器，跑完即焚</span></div>
              <div class="chk-r"><span class="ck-g">{CHK}</span><span>代码不跨租户共享，密钥仅在宿主机内存代发</span></div>
              <div class="chk-r"><span class="ck-g">{CHK}</span><span>随时在「设置 → 执行器」切回本机或团队服务器，0 丢数</span></div>
            </div>
          </div>
          <div class="redeem">
            <span style="color:var(--ink-blue);display:flex">{KEY}</span>
            <span class="grow">已有团队 Pro 额度或私有部署许可？<b>切到上方「兑换码」直接激活 ›</b></span>
          </div>
        </div>
      </div>

      <div class="foot">
        <span class="f12 t3 grow">也可以先跳过，进入工作台后再到 <b style="color:var(--text-2)">设置 → 执行器</b> 随时开通或改用免费本机</span>
        <span class="f-btn f-sec">改用本机电脑（免费）</span>
        <span class="f-btn f-pri">立即开通 Pro 并分配云端节点 {ARR}</span>
      </div>
    </div>
  </div>

  <div class="ft">
    <span class="pill glass">{SHIELD}支持按月随时取消 · 取消后历史工单、Skills 与证据永久保留</span>
  </div>
</div>
</body></html>'''

out = OUT / "runner-pro-pc.html"
out.write_text(HTML, encoding="utf-8")
print("→", out)
