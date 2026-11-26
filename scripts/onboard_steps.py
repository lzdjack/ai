"""第一次使用步骤器（精简 4 步）：第 1 步连接器与鉴权（含新建连接器抽屉）、第 2 步授权项目与代码、第 4 步 AI 体检并开工，及管理员专属第 0 步连接 AI。
STEP_PAGES(page, CHECK) → {"1": html, "1-new": html, "2": html, "4": html}
"""

X = '''<style>
.sech{display:flex;align-items:center;gap:8px;margin-top:18px;margin-bottom:9px}
.sech b{font-size:13.5px;font-weight:700}
.sech .sub{font-size:12px;color:var(--text-3)}
.cgrid{display:grid;grid-template-columns:1fr 1fr;gap:11px}
.ccard{border-radius:16px;padding:13px 15px;background:var(--glass-2);border:1.5px solid color-mix(in srgb,var(--green) 36%,transparent);box-shadow:0 6px 18px -12px color-mix(in srgb,var(--green) 45%,transparent);display:flex;flex-direction:column;gap:8px;min-width:0}
.ccard.opt{border-color:color-mix(in srgb,var(--blue) 30%,transparent);box-shadow:0 6px 18px -12px color-mix(in srgb,var(--blue) 35%,transparent)}
.ccard.addc{background:transparent;border:1.5px dashed color-mix(in srgb,var(--text) 18%,transparent);box-shadow:none;justify-content:center;align-items:flex-start;gap:6px}
.cic{width:34px;height:34px;border-radius:10px;display:flex;align-items:center;justify-content:center;color:#fff;font-size:13px;font-weight:800;flex:none}
.okpill{display:inline-flex;align-items:center;gap:4px;font-size:11.5px;font-weight:600;color:var(--ink-green);white-space:nowrap}
.cmeta{display:flex;align-items:center;gap:7px;font-size:12px;color:var(--text-2);min-width:0}
.cfoot{display:flex;align-items:center;gap:8px;padding-top:8px;border-top:1px solid var(--hair);font-size:12px;color:var(--text-3)}
.cfoot .act{margin-left:auto;color:var(--ink-blue);font-weight:600;white-space:nowrap}
.qadd{display:flex;align-items:center;gap:8px;margin-top:10px;flex-wrap:nowrap}
.qbtn{height:var(--ctl-sm);padding:0 11px;border-radius:var(--r-sm);background:var(--fill);border:1px solid var(--hair);display:inline-flex;align-items:center;gap:6px;font-size:12px;font-weight:600;color:var(--text-2);white-space:nowrap}
.qdot{width:17px;height:17px;border-radius:5px;display:inline-flex;align-items:center;justify-content:center;color:#fff;font-size:10px;font-weight:800;flex:none}
.stat-pill{display:inline-flex;align-items:center;gap:6px;height:var(--ctl-xs);padding:0 10px;border-radius:var(--r-sm);font-size:12px;font-weight:600;white-space:nowrap}
.sp-g{background:color-mix(in srgb,var(--green) 13%,transparent);color:var(--ink-green)}
.sp-b{background:color-mix(in srgb,var(--blue) 13%,transparent);color:var(--ink-blue)}

/* 第 2 步：多来源聚合与三态读写权限 */
.ptbar{display:flex;align-items:center;gap:8px;margin-top:16px}
.srcsel{height:var(--ctl-md);padding:0 10px;border-radius:var(--r-md);background:var(--glass-2);border:1px solid var(--border-ctl);box-shadow:var(--shadow-ctl);display:inline-flex;align-items:center;gap:7px;font-size:12.5px;font-weight:600;white-space:nowrap;flex:none}
.sdots{display:inline-flex;align-items:center}
.sdots i{width:16px;height:16px;border-radius:5px;display:inline-flex;align-items:center;justify-content:center;color:#fff;font-size:9px;font-weight:800;font-style:normal;border:1.5px solid var(--glass-2)}
.sdots i+i{margin-left:-4px}
.srch2{height:var(--ctl-md);flex:1;min-width:140px;border-radius:var(--r-md);background:var(--well);padding:0 11px;display:flex;align-items:center;gap:7px;font-size:12.5px;color:var(--text-3);border:1px solid var(--hair)}
.fchip{height:var(--ctl-sm);padding:0 10px;border-radius:var(--r-sm);font-size:12px;font-weight:600;color:var(--text-2);background:var(--fill);display:inline-flex;align-items:center;gap:4px;white-space:nowrap;flex:none}
.fchip.on{background:var(--btn-pri-bg);color:#fff}
.fchip em{font-style:normal;opacity:.72;font-size:11px;font-weight:500}
.addbtn{height:var(--ctl-md);padding:0 12px;border-radius:var(--r-md);background:var(--fill);border:1px solid var(--hair);font-size:12.5px;font-weight:600;color:var(--text);display:inline-flex;align-items:center;gap:5px;white-space:nowrap;flex:none}
.plist{display:flex;flex-direction:column;gap:10px;margin-top:11px;flex:1;min-height:0}
.sgrp{display:flex;flex-direction:column;gap:6px}
.sgh{display:flex;align-items:center;gap:7px;padding:0 3px;font-size:12px}
.sgh b{font-size:12.5px;font-weight:700;color:var(--text)}
.sgh .surl{font-size:11.5px;color:var(--text-3)}
.sgh .scnt{height:18px;padding:0 6px;border-radius:6px;background:color-mix(in srgb,var(--text) 7%,transparent);font-size:11px;font-weight:600;color:var(--text-2);display:inline-flex;align-items:center}
.sgh .sadd{margin-left:auto;font-size:11.5px;font-weight:600;color:var(--ink-blue);white-space:nowrap}
.prow{border-radius:14px;padding:9px 13px;background:var(--fill);border:1.5px solid transparent;display:flex;align-items:center;gap:12px;min-width:0}
.prow.rw{background:var(--glass-2);border-color:color-mix(in srgb,var(--green) 42%,transparent);box-shadow:0 6px 18px -12px color-mix(in srgb,var(--green) 55%,transparent)}
.prow.ro{background:var(--glass-2);border-color:color-mix(in srgb,var(--blue) 38%,transparent);box-shadow:0 6px 18px -12px color-mix(in srgb,var(--blue) 45%,transparent)}
.prow.off{opacity:.72}
.pic{width:34px;height:34px;border-radius:10px;display:flex;align-items:center;justify-content:center;color:#fff;flex:none;font-size:12.5px;font-weight:800}
.pinfo{flex:1;min-width:0}
.ptop{display:flex;align-items:center;gap:7px;min-width:0}
.ptop b{font-size:14.5px;font-weight:700;white-space:nowrap}
.src-pill{display:inline-flex;align-items:center;gap:5px;font-size:11.5px;color:var(--text-2);background:color-mix(in srgb,var(--text) 6%,transparent);padding:2px 7px 2px 3px;border-radius:6px;white-space:nowrap}
.sdot{width:16px;height:16px;border-radius:4px;display:inline-flex;align-items:center;justify-content:center;color:#fff;font-size:9px;font-weight:800;flex:none}
.pmeta{display:flex;align-items:center;gap:6px;margin-top:4px;font-size:12px;color:var(--text-2);min-width:0;white-space:nowrap}
.ai-bdg{display:inline-flex;align-items:center;gap:3px;height:20px;padding:0 6px;border-radius:6px;font-size:11px;font-weight:600;color:var(--ink-purple);background:color-mix(in srgb,var(--purple) 12%,transparent);flex:none}
.ro-bdg{display:inline-flex;align-items:center;gap:3px;height:20px;padding:0 6px;border-radius:6px;font-size:11px;font-weight:600;color:var(--ink-blue);background:color-mix(in srgb,var(--blue) 12%,transparent);flex:none}
.okchip{display:inline-flex;align-items:center;gap:3px;color:var(--ink-green);font-size:11.5px;font-weight:600;flex:none}
.tune{font-size:12px;font-weight:600;color:var(--ink-blue);margin-left:auto;padding-left:6px;flex:none;white-space:nowrap}
.pseg{display:inline-flex;height:var(--ctl-md);align-items:center;padding:3px;border-radius:var(--r-md);background:var(--well);border:1px solid var(--hair);flex:none;gap:2px}
.pseg span{height:100%;padding:0 11px;border-radius:7px;font-size:12px;font-weight:600;color:var(--text-2);display:inline-flex;align-items:center;gap:4px;white-space:nowrap}
.pseg span.s-ro{background:var(--btn-pri-bg);color:#fff;box-shadow:0 4px 12px -4px color-mix(in srgb,var(--btn-pri-bg) 85%,transparent)}
.pseg span.s-rw{background:var(--btn-ok-bg);color:#fff;box-shadow:0 4px 12px -4px color-mix(in srgb,var(--btn-ok-bg) 85%,transparent)}
.rmb{width:28px;height:28px;border-radius:8px;display:inline-flex;align-items:center;justify-content:center;color:var(--text-3);background:transparent;flex:none}
.pickbtn{height:var(--ctl-md);padding:0 13px;border-radius:var(--r-md);background:var(--btn-pri-bg);color:#fff;font-size:12.5px;font-weight:600;display:inline-flex;align-items:center;gap:6px;white-space:nowrap;flex:none;box-shadow:0 6px 16px -8px color-mix(in srgb,var(--btn-pri-bg) 85%,transparent)}
.pickmore{border-radius:14px;padding:11px 15px;border:1.5px dashed color-mix(in srgb,var(--text) 16%,transparent);display:flex;align-items:center;gap:9px;font-size:12.5px;color:var(--text-2)}

/* 第 4 步与管理员第 0 步 */
.obx{border-radius:16px;padding:14px 16px;background:var(--fill)}
.kv3{display:flex;align-items:center;gap:10px;margin-top:10px}
.kv3>span:first-child{width:76px;white-space:nowrap;flex:none;font-size:12.5px;color:var(--text-3)}
.kv3 .inp{height:var(--ctl-lg);flex:1;font-size:13.5px}
.kv3 .inp.sel{justify-content:space-between;background:var(--glass-2);border:1px solid var(--border-ctl);box-shadow:var(--shadow-ctl)}
.chk3{display:flex;align-items:center;gap:12px;padding:8px 0;border-top:1px solid var(--hair);font-size:13.5px}
.chk3:first-child{border-top:0}
.ck3{width:20px;height:20px;border-radius:50%;display:flex;align-items:center;justify-content:center;color:#fff;flex:none}
.big-ok{display:flex;align-items:center;gap:16px;padding:14px 18px;border-radius:18px;background:color-mix(in srgb,var(--green) 10%,var(--glass-2));border:1px solid color-mix(in srgb,var(--green) 30%,transparent)}
.tk{display:flex;align-items:center;gap:8px;height:34px;padding:0 10px;border-radius:10px;font-size:12.5px;color:var(--text-2);background:var(--glass-2)}
</style>'''


def STEP_PAGES(page, CHECK):
    def I(n, s=16, w=None, st=""):
        return f'<i data-i="{n}" data-s="{s}"' + (f' data-w="{w}"' if w else '') + (f' style="{st}"' if st else '') + '></i>'

    # ---------------- 1 连接器与鉴权 ----------------
    s1 = X + f'''
      <div class="sech">
        <b>代码来源</b>
        <span class="tag tg-b" style="height:19px;font-size:10.5px">至少 1 个</span>
        <span class="sub">自动筛出插件市场中 <span class="mono">code_source</span> 类连接器 · 鉴权后拉取仓库与推测分支</span>
      </div>
      <div class="cgrid">
        <div class="ccard">
          <div class="row g10">
            <span class="cic" style="background:linear-gradient(155deg,#FF8A4C,#E24329)">G</span>
            <div class="grow" style="min-width:0">
              <div class="row g6"><b class="f14">公司 GitLab</b><span class="tag tg-n" style="height:18px;font-size:10.5px">公司共用</span></div>
              <div class="mono f12 t3 ell" style="margin-top:2px">https://git.tita.cloud</div>
            </div>
            <span class="okpill">{CHECK}鉴权通过</span>
          </div>
          <div class="cmeta">{I("shield",13,st="color:var(--ink-green)")}<span class="ell">令牌 <span class="mono">bot-fix</span> · 读写分支，无合入主干权限</span></div>
          <div class="cfoot"><span>可见 28 个仓库</span><span class="act">鉴权配置 ›</span></div>
        </div>
        <div class="ccard">
          <div class="row g10">
            <span class="cic" style="background:linear-gradient(155deg,#5AA0FF,#2B6BFF)">{I("folder",17,2)}</span>
            <div class="grow" style="min-width:0">
              <div class="row g6"><b class="f14">本机代码目录</b><span class="tag tg-p" style="height:18px;font-size:10.5px">本机执行器</span></div>
              <div class="mono f12 t3 ell" style="margin-top:2px">~/workspace</div>
            </div>
            <span class="okpill">{CHECK}已授权</span>
          </div>
          <div class="cmeta">{I("branch",13,st="color:var(--ink-blue)")}<span class="ell">免远端令牌 · 自动走 <span class="mono">worktree</span> 隔离不脏工作区</span></div>
          <div class="cfoot"><span>识别 4 个本地 Git 仓</span><span class="act">增减目录 ›</span></div>
        </div>
      </div>

      <div class="qadd">
        <span class="f12 t3" style="white-space:nowrap">继续添加：</span>
        <span class="qbtn"><span class="qdot" style="background:#1F2328">GH</span>+ GitHub</span>
        <span class="qbtn"><span class="qdot" style="background:#C71D23">码</span>+ Gitee</span>
        <span class="qbtn"><span class="qdot" style="background:#FC6D26">G</span>+ 企业 GitLab</span>
        <span class="qbtn"><span class="qdot" style="background:#3B82F6">{I("folder",10,2.4)}</span>+ 本机目录</span>
        <span class="qbtn"><span class="qdot" style="background:linear-gradient(155deg,#A855F7,#6366F1)">{I("pkg",10,2.4)}</span>+ 插件市场 / 通用接入</span>
      </div>

      <div class="sech" style="margin-top:18px">
        <b>工单平台</b>
        <span class="tag tg-n" style="height:19px;font-size:10.5px">可选 · 可跳过</span>
        <span class="sub">自动筛出 <span class="mono">ticket_source</span> 类连接器 · 不接也能直接进工作台点「+」手动建单</span>
      </div>
      <div class="cgrid">
        <div class="ccard opt">
          <div class="row g10">
            <span class="cic" style="background:linear-gradient(155deg,#4C9AFF,#0052CC)">J</span>
            <div class="grow" style="min-width:0">
              <div class="row g6"><b class="f14">公司 Jira</b><span class="tag tg-n" style="height:18px;font-size:10.5px">公司共用</span></div>
              <div class="mono f12 t3 ell" style="margin-top:2px">https://jira.tita.cloud</div>
            </div>
            <span class="okpill">{CHECK}鉴权通过</span>
          </div>
          <div class="cmeta">{I("inbox",13,st="color:var(--ink-blue)")}<span class="ell">只读采集 · 自动收状态为「AI修复」的 Bug（当前 2 张）</span></div>
          <div class="cfoot"><span>每 2 分钟同步</span><span class="act">改鉴权 / 触发条件 ›</span></div>
        </div>
        <div class="ccard addc">
          <div class="row g8" style="color:var(--text)">{I("plus",16,st="color:var(--ink-blue)")}<b class="f14">添加更多工单连接器</b></div>
          <div class="f12 t3" style="line-height:1.55">支持 Tita 工单、GitHub Issues、插件市场第三方连接器或通用 Webhook / MCP；也可先跳过直接手动建单</div>
          <div class="row g6" style="margin-top:2px">
            <span class="tag tg-b" style="height:20px;font-size:11px">+ Tita 工单</span>
            <span class="tag tg-n" style="height:20px;font-size:11px">+ GitHub Issues</span>
            <span class="tag tg-p" style="height:20px;font-size:11px">+ 插件市场 / MCP</span>
          </div>
        </div>
      </div>

      <div class="note" style="margin-top:auto;margin-bottom:14px">
        {I("lock",15,st="color:var(--ink-blue);margin-top:1px")}
        <span><b>凭证安全隔离：</b>所有连接器令牌采用「公钥加密入库、私钥仅在执行器解出」，接口层拿不到明文；管理员配好「公司共用」连接器后，团队成员直接复用，之后随时可在「设置 → 连接器」增改。</span>
      </div>'''
    foot1 = (f'<span class="stat-pill sp-g">{I("check",13,2.8)}代码源 2 个已鉴权</span>'
             f'<span class="stat-pill sp-b">{I("inbox",13)}工单源 1 个（可选）</span>'
             '<span class="f12 t3">下一步从已鉴权来源拉取项目列表</span><span class="grow"></span>'
             '<button class="bigb pri">下一步：授权项目与代码<i data-i="chevr" data-s="16" data-w="2.4"></i></button>')
    why1 = ("key", "为什么先建连接器？", "没有鉴权凭证就无法从 GitLab、GitHub、Gitee 或 Jira 拉取项目数据；管理员配好公司级连接器后，团队成员直接复用无需重填。")
    p1 = page(1, "先接通代码和工单来源", "支持同时接入多个企业私有平台、公有代码托管、插件市场连接器或本机目录；鉴权通过后下一步拉取项目",
              s1, foot=foot1, why=why1, chip="怎么填令牌？问 AI")

    # ---------------- 1-new 新建连接器鉴权抽屉 ----------------
    DRW = f'''<style>
.ic3{{width:40px;height:40px;border-radius:11px;display:flex;align-items:center;justify-content:center;color:#fff;flex:none;font-size:15px;font-weight:800}}
.flab{{font-size:12.5px;font-weight:700;color:var(--text-2);margin-bottom:7px;display:flex;align-items:center;gap:6px}}
.flab span{{font-weight:400;color:var(--text-3);font-size:11.5px}}
.pgrid{{display:grid;grid-template-columns:repeat(5,1fr);gap:8px}}
.pitem{{height:40px;border-radius:11px;background:var(--fill);border:1.5px solid transparent;display:flex;align-items:center;justify-content:center;gap:6px;font-size:12.5px;font-weight:600;color:var(--text-2)}}
.pitem.on{{background:var(--glass-2);border-color:var(--blue);color:var(--text);box-shadow:0 6px 16px -10px color-mix(in srgb,var(--blue) 65%,transparent)}}
.pdot{{width:18px;height:18px;border-radius:5px;display:inline-flex;align-items:center;justify-content:center;color:#fff;font-size:10px;font-weight:800;flex:none}}
.dinp{{height:var(--ctl-lg);border-radius:var(--r-lg);background:var(--well);border:1px solid var(--hair);display:flex;align-items:center;gap:9px;padding:0 13px;font-size:13.5px;color:var(--text);min-width:0}}
.dinp.foc{{background:var(--glass-2);border-color:var(--focus-ring);box-shadow:0 0 0 3px var(--focus-halo)}}
.vbox{{border-radius:16px;padding:13px 16px;background:color-mix(in srgb,var(--green) 8%,var(--fill));border:1px solid color-mix(in srgb,var(--green) 28%,transparent)}}
.vrow{{display:flex;align-items:center;gap:9px;font-size:12.5px;padding:4px 0;color:var(--text)}}
.vck{{width:17px;height:17px;border-radius:50%;background:var(--btn-ok-bg);color:#fff;display:inline-flex;align-items:center;justify-content:center;flex:none}}
</style>
<div class="cc-scrim"></div>
<div class="cc-drawer">
  <div class="cc-drawer-hd">
    <span class="ic3" style="background:linear-gradient(155deg,#FF8A4C,#E24329)">G</span>
    <div class="grow">
      <div style="font-size:18px;font-weight:800">新建代码连接器</div>
      <div class="f12 t3" style="margin-top:2px">表单按插件 <span class="mono">authSchema</span> 自动渲染 · 鉴权通过后下一步即可拉取该平台仓库</div>
    </div>
    <span class="cc-close">{I("x",16,2.2)}</span>
  </div>
  <div class="cc-drawer-bd" style="gap:14px">
    <div>
      <div class="flab">连接器插件<span>默认显示官方预装，其他平台可从插件市场安装或选通用 Git / MCP</span></div>
      <div class="pgrid">
        <div class="pitem on"><span class="pdot" style="background:#FC6D26">G</span>GitLab</div>
        <div class="pitem"><span class="pdot" style="background:#1F2328">GH</span>GitHub</div>
        <div class="pitem"><span class="pdot" style="background:#C71D23">码</span>Gitee</div>
        <div class="pitem"><span class="pdot" style="background:#3B82F6">{I("folder",10,2.4)}</span>本机</div>
        <div class="pitem"><span class="pdot" style="background:#7C3AED">{I("pkg",10,2.4)}</span>通用/MCP</div>
      </div>
    </div>
    <div class="row g12">
      <div class="grow"><div class="flab">连接器名称</div><div class="dinp">公司 GitLab（私有部署）</div></div>
      <div style="width:230px;flex:none"><div class="flab">共享范围</div><div class="cc-seg cc-seg-lg" style="display:flex;width:100%"><span class="on" style="flex:1">公司共用</span><span style="flex:1">仅我自己</span></div></div>
    </div>
    <div>
      <div class="flab">服务地址<span>企业私有部署填内网域名，公有云保持默认即可</span></div>
      <div class="dinp">{I("globe",15,st="color:var(--text-3)")}<span class="mono grow">https://git.tita.cloud</span></div>
    </div>
    <div>
      <div class="flab">鉴权方式<span>推荐给 Bot 专号签发 Access Token，不给合入主干权限</span></div>
      <div class="cc-seg cc-seg-lg" style="display:flex;width:100%">
        <span class="on" style="flex:1">{I("key",13)}Access Token</span>
        <span style="flex:1">{I("shield",13)}OAuth 一键授权</span>
        <span style="flex:1">{I("terminal",13)}SSH Key</span>
      </div>
    </div>
    <div>
      <div class="flab">访问令牌（Token）<span>公钥加密保存，仅执行器可解</span></div>
      <div class="row g10">
        <div class="dinp foc grow">{I("lock",14,st="color:var(--ink-blue)")}<span class="mono grow">glpat-•••••••••••••••••• 91d0</span></div>
        <button class="cc-btn cc-btn-lg cc-btn-glass">{I("zap",14,st="color:var(--ink-blue)")}重新验证</button>
      </div>
    </div>
    <div class="vbox">
      <div class="row g8" style="margin-bottom:6px"><b class="f13" style="color:var(--ink-green)">鉴权验证通过 · 用时 340ms</b><span class="grow"></span><span class="f12 t3">Bot-02 实测</span></div>
      <div class="vrow"><span class="vck">{I("check",11,3)}</span><span>服务地址连通，API v4 响应正常</span></div>
      <div class="vrow"><span class="vck">{I("check",11,3)}</span><span>识别身份：<span class="mono">bot-fix</span> · 具备 <span class="mono">read_api / read_repository / write_repository</span></span></div>
      <div class="vrow"><span class="vck">{I("check",11,3)}</span><span>安全校验：<b>无合入主干权限</b>（符合最小权限原则），可拉取 <b>28 个仓库</b></span></div>
    </div>
  </div>
  <div class="cc-drawer-ft">
    <button class="cc-btn cc-btn-lg cc-btn-sec">取消</button>
    <span class="grow"></span>
    <span class="f12 t3">保存后团队成员可直接复用此连接器</span>
    <button class="cc-btn cc-btn-lg cc-btn-pri">保存并拉取仓库</button>
  </div>
</div>'''
    p1_new = p1.replace('</div><script src="icons.js">', DRW + '</div><script src="icons.js">', 1)

    # ---------------- 1-ticket 工单连接器：改鉴权 / 触发条件 + 试采预览抽屉（严格复用组件库 .cc-*） ----------------
    CHEV = f'<span class="cc-sel-caret">{I("chevd",13)}</span>'
    TICKET_DRW = f'''<style>
.tsec2{{border-radius:15px;padding:12px 14px;background:color-mix(in srgb,var(--text) 4%,transparent);border:1px solid var(--hair);display:flex;flex-direction:column;gap:9px}}
html.dark .tsec2{{background:rgba(255,255,255,.038)}}
.tsec2-h{{display:flex;align-items:center;gap:7px;font-size:12.5px;font-weight:700;color:var(--text)}}
.flab2{{font-size:11.5px;font-weight:600;color:var(--text-3);margin-bottom:5px;display:flex;align-items:center;gap:6px}}
.mtags{{display:flex;align-items:center;gap:6px;flex-wrap:nowrap;height:var(--ctl-md);padding:0 9px;border-radius:var(--r-md);background:var(--well);border:1px solid var(--hair)}}
.mchip{{height:22px;padding:0 7px;border-radius:6px;background:color-mix(in srgb,var(--blue) 14%,transparent);color:var(--ink-blue);font-size:11.5px;font-weight:600;display:inline-flex;align-items:center;gap:4px;white-space:nowrap}}
.jqlbar{{padding:7px 10px;border-radius:9px;background:var(--fill);border:1px solid var(--hair);display:flex;align-items:center;gap:8px;font-size:11.5px}}
.drybox{{border-radius:14px;padding:11px 13px;background:color-mix(in srgb,var(--green) 8%,var(--fill));border:1px solid color-mix(in srgb,var(--green) 28%,transparent);display:flex;flex-direction:column;gap:6px}}
.dryit{{display:flex;align-items:center;gap:8px;padding:6px 9px;border-radius:9px;background:var(--glass-2);font-size:12px}}
</style>
<div class="cc-scrim"></div>
<div class="cc-drawer">
  <div class="cc-drawer-hd">
    <span class="ic3" style="background:linear-gradient(155deg,#4FA3FF,#1D6FE0)">J</span>
    <div class="grow" style="min-width:0">
      <div class="row g8"><span style="font-size:17px;font-weight:800">编辑工单连接器 · 公司 Jira</span><span class="cc-tag cc-tag-n">公司共用</span><span class="cc-tag cc-tag-g">鉴权通过</span></div>
      <div class="f11 t3" style="margin-top:2px">共用 <span class="mono">ConnectorDrawer</span>（工单源额外渲染 <span class="mono">triggerSchema</span> + 试采预览）· 令牌留空不覆盖</div>
    </div>
    <span class="cc-close">{I("x",16,2.2)}</span>
  </div>

  <div class="cc-drawer-bd" style="gap:11px;padding:14px 22px">
    <div class="tsec2">
      <div class="tsec2-h"><span>1. 平台连接与只读鉴权</span><span class="f11 t3" style="font-weight:400">平台类型锁定只读</span><span class="okpill" style="margin-left:auto;font-size:11.5px">{I("check",12,3)}bot-jira · 只读 6 项目 · 210ms</span></div>
      <div class="row g10">
        <div class="grow" style="min-width:0">
          <div class="flab2">Jira 服务地址</div>
          <div class="cc-input">{I("globe",14,st="color:var(--text-3)")}<span class="mono ell">https://jira.tita.cloud</span></div>
        </div>
        <div style="width:208px;flex:none">
          <div class="flab2">认证方式</div>
          <div class="cc-select"><span class="cc-sel-val">PAT 访问令牌</span><span class="cc-sel-sp"></span>{CHEV}</div>
        </div>
      </div>
      <div class="row g10">
        <div class="grow" style="min-width:0">
          <div class="flab2">只读采集令牌<span>编辑态不回传明文，留空保存沿用原密文</span></div>
          <div class="cc-input">{I("lock",13,st="color:var(--text-3)")}<span class="mono grow t2">•••••••••••••••••• 8k2m</span><span class="f11 t3">已加密</span></div>
        </div>
        <div style="align-self:flex-end">
          <button class="cc-btn cc-btn-glass" style="height:36px">{I("zap",13,st="color:var(--ink-blue)")}测试连接</button>
        </div>
      </div>
    </div>

    <div class="tsec2">
      <div class="tsec2-h"><span>2. 自动收单触发条件（Trigger）</span><span class="f11 t3" style="font-weight:400">决定哪些单自动流进云匠</span>
        <div class="cc-seg cc-seg-sm" style="margin-left:auto;flex:none"><span class="on">轮询 · 每 2 分钟</span><span>Webhook</span></div>
      </div>
      <div>
        <div class="flab2">监听的 Jira 项目<span>实时拉自当前账号可见的 6 个项目，免手敲 Key</span></div>
        <div class="mtags">
          <span class="mchip">OKR · 目标管理 ×</span>
          <span class="mchip">APR · 审批 ×</span>
          <span class="mchip">KQ · 考勤 ×</span>
          <span class="f11 lnk w6" style="margin-left:auto;white-space:nowrap">+ 添加项目</span>
        </div>
      </div>
      <div class="row g10">
        <div class="grow" style="min-width:0">
          <div class="flab2">触发状态（命中即收单）</div>
          <div class="cc-select"><span style="width:7px;height:7px;border-radius:50%;background:var(--blue);flex:none"></span><span class="cc-sel-val">AI修复</span><span class="cc-sel-sp"></span>{CHEV}</div>
        </div>
        <div class="grow" style="min-width:0">
          <div class="flab2">工单类型</div>
          <div class="cc-select"><span class="cc-sel-val">Bug（缺陷）</span><span class="cc-sel-sp"></span>{CHEV}</div>
        </div>
        <div class="grow" style="min-width:0">
          <div class="flab2">默认复现环境</div>
          <div class="cc-select"><span style="width:7px;height:7px;border-radius:50%;background:var(--green);flex:none"></span><span class="cc-sel-val">测试环境</span><span class="cc-sel-sp"></span>{CHEV}</div>
        </div>
      </div>
      <div class="jqlbar">
        <span class="cc-tag cc-tag-p">生成 JQL</span>
        <span class="mono t2 ell grow">project in (OKR, APR, KQ) AND status = "AI修复" AND issuetype = Bug</span>
        <span class="f11 lnk w6" style="white-space:nowrap">切手写 JQL</span>
      </div>
      <div class="f11 t3">角色映射：真人修复人 = <b style="color:var(--text-2)">Jira 经办人</b> · 复测人 = <b style="color:var(--text-2)">提单人（发测试前可换）</b></div>
    </div>

    <div class="drybox">
      <div class="row g8">
        <span class="okpill" style="font-size:12.5px">{I("check",13,3)}试采预览命中 2 张待修 Bug</span>
        <span class="f11 t3">仅预演不建单 · 防误配把历史旧单全灌进来</span>
        <span class="f11 lnk w6" style="margin-left:auto">重新试采</span>
      </div>
      <div class="dryit">
        <span class="sc10 sc-j">OKR-412</span>
        <span class="w6 grow ell">对齐视图里子目标重复显示</span>
        <span class="f11 t3">经办人 林某 · 提单人 王某</span>
      </div>
      <div class="dryit">
        <span class="sc10 sc-j">OKR-418</span>
        <span class="w6 grow ell">目标导入后日期偏移一天</span>
        <span class="f11 t3">经办人 周某 · 提单人 李娜</span>
      </div>
    </div>
  </div>

  <div class="cc-drawer-ft">
    <button class="cc-btn cc-btn-ghost" style="color:var(--ink-red);padding:0 8px">停用 / 删除</button>
    <span class="grow"></span>
    <button class="cc-btn cc-btn-lg cc-btn-sec">取消</button>
    <button class="cc-btn cc-btn-lg cc-btn-glass">{I("search",14)}试采预览</button>
    <button class="cc-btn cc-btn-lg cc-btn-pri">保存鉴权与触发条件</button>
  </div>
</div>'''
    p1_ticket = p1.replace('</div><script src="icons.js">', TICKET_DRW + '</div><script src="icons.js">', 1)

    # ---------------- 1-ai 向导 AI 帮手（点右上「✦ 怎么填令牌？问 AI」右侧 440px 非模态浮层） ----------------
    AI_DRW = f'''<style>
.aidrw-b{{border:1px solid color-mix(in srgb,var(--purple) 28%,var(--stroke))}}
.aorb{{width:34px;height:34px;border-radius:11px;background:#141530;display:flex;align-items:center;justify-content:center;position:relative;overflow:hidden;flex:none;box-shadow:0 6px 14px -6px rgba(100,80,255,.8)}}
.aorb::before{{content:"";position:absolute;inset:4px;border-radius:50%;background:conic-gradient(from 210deg,#4F8BFF,#9B5CFF,#FF5FA8,#FFB14A,#4FD1FF,#4F8BFF);filter:blur(4px)}}
.aorb svg,.aorb i{{position:relative;z-index:1;color:#fff}}
.ctxbar{{padding:9px 16px;background:color-mix(in srgb,var(--purple) 7%,transparent);border-bottom:1px solid var(--hair);display:flex;align-items:center;gap:7px;font-size:11.5px;color:var(--text-2)}}
.qqs{{display:flex;flex-wrap:wrap;gap:6px}}
.qq{{height:var(--ctl-xs);padding:0 11px;border-radius:var(--r-full);background:var(--fill);border:1px solid var(--hair);font-size:11.5px;font-weight:600;color:var(--text-2);display:inline-flex;align-items:center;gap:5px}}
.qq.on{{background:color-mix(in srgb,var(--purple) 14%,transparent);border-color:color-mix(in srgb,var(--purple) 34%,transparent);color:var(--ink-purple)}}
.umsg{{align-self:flex-end;max-width:88%;padding:9px 13px;border-radius:16px 16px 5px 16px;background:linear-gradient(180deg,var(--btn-pri-bg),var(--btn-pri-active));color:#fff;font-size:13px;line-height:1.5;box-shadow:0 8px 16px -10px color-mix(in srgb,var(--btn-pri-bg) 85%,transparent)}}
.amsg{{border-radius:16px 16px 16px 5px;padding:12px 13px;background:var(--glass-2);border:1px solid var(--stroke);display:flex;flex-direction:column;gap:9px;font-size:12.5px;line-height:1.55;color:var(--text)}}
.stepb{{display:flex;gap:8px;align-items:flex-start;font-size:12px;color:var(--text-2)}}
.snm{{width:18px;height:18px;border-radius:50%;background:color-mix(in srgb,var(--blue) 16%,transparent);color:var(--ink-blue);font-size:10.5px;font-weight:800;display:inline-flex;align-items:center;justify-content:center;flex:none;margin-top:1px}}
.pbox{{border-radius:11px;padding:9px 11px;background:var(--fill);border:1px solid var(--hair);display:flex;flex-direction:column;gap:5px}}
.prow2{{display:flex;align-items:center;gap:7px;font-size:12px}}
.actcard{{display:flex;align-items:center;gap:9px;padding:9px 11px;border-radius:12px;background:color-mix(in srgb,var(--blue) 10%,var(--glass-2));border:1px solid color-mix(in srgb,var(--blue) 32%,transparent)}}
.acmp{{padding:12px 14px 14px;border-top:1px solid var(--hair)}}
.ainp{{height:var(--ctl-lg);border-radius:var(--r-lg);padding:0 5px 0 12px;background:var(--glass-2);border:1.5px solid color-mix(in srgb,var(--purple) 40%,var(--border-ctl));display:flex;align-items:center;gap:8px}}
.asnd{{width:32px;height:32px;border-radius:9px;background:linear-gradient(135deg,#4F8BFF,#9B5CFF 55%,#FF5FA8);color:#fff;display:flex;align-items:center;justify-content:center;flex:none}}
</style>
<div class="cc-scrim-light"></div>
<div class="cc-drawer cc-drawer-sm aidrw-b">
  <div class="cc-drawer-hd" style="padding:16px 18px 13px">
    <span class="aorb">{I("spark",16,2)}</span>
    <div class="grow" style="min-width:0">
      <div class="row g6"><b style="font-size:15px;font-weight:800">向导 AI 帮手</b><span class="cc-tag cc-tag-p">就地浮层 · 不丢表单</span></div>
      <div class="f11 t3" style="margin-top:1px">自动感知当前步骤与已连通状态，支持一键帮填</div>
    </div>
    <span class="cc-close">{I("x",15,2.2)}</span>
  </div>

  <div class="ctxbar">
    {I("layers",13,st="color:var(--ink-purple)")}
    <span class="grow ell">上下文：<b>第 1 步 · 连接器与鉴权</b>（已连 GitLab · 本机 · Jira）</span>
  </div>

  <div class="cc-drawer-bd" style="padding:14px 16px;gap:11px">
    <div>
      <div class="f11 t3 w6" style="margin-bottom:6px">常见疑问（点一下直接答）</div>
      <div class="qqs">
        <span class="qq on">GitLab 令牌怎么生成？</span>
        <span class="qq">Jira 只读令牌和 JQL 怎么写？</span>
        <span class="qq">本机目录会改乱我当前分支吗？</span>
      </div>
    </div>

    <div class="umsg">GitLab 令牌怎么生成？要勾哪些权限才安全？</div>

    <div class="amsg">
      <div>按最小权限原则，推荐给 Bot 专用账号（如 <span class="mono">bot-fix</span>）签发令牌，<b>不要给合入主干权限</b>：</div>
      <div class="stepb"><span class="snm">1</span><span>打开 <span class="mono">https://git.tita.cloud</span> → 右上头像 → <b>Edit Profile → Access Tokens</b></span></div>
      <div class="stepb"><span class="snm">2</span><span>点击 <b>Add new token</b>，名称填 <span class="mono">cloudcraft-bot</span>，有效期建议 90 天</span></div>
      <div class="stepb"><span class="snm">3</span><span>按下方清单勾选作用域后复制生成的 <span class="mono">glpat-…</span> 令牌：</span></div>

      <div class="pbox">
        <div class="prow2"><span style="color:var(--ink-green);font-weight:800">✓</span><span class="mono w6">read_api</span><span class="f11 t3 grow">拉取仓库列表、查分支与提 MR</span></div>
        <div class="prow2"><span style="color:var(--ink-green);font-weight:800">✓</span><span class="mono w6">read_repository</span><span class="f11 t3 grow">只读克隆代码与查规范</span></div>
        <div class="prow2"><span style="color:var(--ink-green);font-weight:800">✓</span><span class="mono w6">write_repository</span><span class="f11 t3 grow">仅推 <span class="mono">fix/</span> 修复分支</span></div>
        <div class="prow2" style="padding-top:4px;border-top:1px solid var(--hair)"><span style="color:var(--ink-red);font-weight:800">✕</span><span class="f11" style="color:var(--ink-red);font-weight:600">切勿授予 Maintainer 合入受保护主干权限</span></div>
      </div>

      <div class="actcard">
        <span class="ic3" style="width:28px;height:28px;border-radius:8px;font-size:12px;background:linear-gradient(155deg,#FF8A4C,#E24329)">G</span>
        <div class="grow" style="min-width:0">
          <div class="f12 w7">拿到令牌了？就地打开配置</div>
          <div class="f11 t3">自动预选 GitLab · Access Token</div>
        </div>
        <span class="cc-btn cc-btn-xs cc-btn-pri">去填令牌 ›</span>
      </div>
    </div>

    <div class="cc-banner cc-banner-warn" style="margin-top:auto">
      <span><b style="color:var(--text)">冷启动兜底：</b>在管理员第 0 步尚未连通 AI 模型时点「问 AI」，自动降级为<b>内置离线交互式引导卡</b>（公司网关 / OpenAI / Ollama 填法），绝不报 500 死循环。</span>
    </div>
  </div>

  <div class="acmp">
    <div class="ainp">
      <span class="f12 t3 grow">继续追问，如「Jira 401 报错怎么查？」</span>
      <span class="asnd">{I("arrowup",15,2.4)}</span>
    </div>
  </div>
</div>'''
    p1_ai = p1.replace('</div><script src="icons.js">', AI_DRW + '</div><script src="icons.js">', 1)

    # ---------------- 2 授权项目与代码权限（仅保留用户主动筛选留下的仓库） ----------------
    s2 = X + f'''
      <div class="ptbar">
        <span class="pickbtn">{I("plus",14,2.4)}从已连来源挑选仓库</span>
        <div class="srch2">{I("search",14)}<span>在已选的 4 个仓库中筛选…</span></div>
        <span class="fchip on">已选<em>4</em></span>
        <span class="fchip">可修改<em>2</em></span>
        <span class="fchip">仅查看<em>2</em></span>
      </div>

      <div class="plist">
        <!-- 分组 1：公司 GitLab -->
        <div class="sgrp">
          <div class="sgh">
            <span class="sdot" style="background:#FC6D26;width:18px;height:18px;font-size:10px">G</span>
            <b>公司 GitLab</b>
            <span class="mono surl">https://git.tita.cloud</span>
            <span class="scnt">已选 2 / 28</span>
            <span class="sadd">+ 从此来源挑选 ›</span>
          </div>
          <div class="prow rw">
            <span class="pic" style="background:linear-gradient(155deg,#5AA0FF,#1F6FFF)">OKR</span>
            <div class="pinfo">
              <div class="ptop">
                <b>OKR · 目标管理</b>
                <span class="src-pill" style="padding:2px 7px"><span class="mono">fe/tita-okr-web</span></span>
                <span class="okchip">{I("check",13,2.8)}已探测</span>
              </div>
              <div class="pmeta">
                <span class="ai-bdg">{I("spark",11)}AI 推测</span>
                <span class="ell"><span class="mono">master</span> → <span class="mono">dev-okr</span> · <span class="mono">pnpm build-prod</span> · 规范 <span class="mono">AGENTS.md</span></span>
                <span class="tune">微调 ›</span>
              </div>
            </div>
            <div class="pseg"><span>{I("eye",12)}仅查看</span><span class="s-rw">{I("edit",12)}可修改</span></div>
            <span class="rmb" title="移出授权列表">{I("x",14)}</span>
          </div>
          <div class="prow ro">
            <span class="pic" style="background:linear-gradient(155deg,#4FD6E6,#0E8FB3)">API</span>
            <div class="pinfo">
              <div class="ptop">
                <b>OKR 后端服务</b>
                <span class="src-pill" style="padding:2px 7px"><span class="mono">be/tita-okr-api</span></span>
                <span class="tag tg-b" style="height:19px;font-size:10.5px">接口参考</span>
              </div>
              <div class="pmeta">
                <span class="ro-bdg">{I("lock",11)}只读隔离</span>
                <span class="ell">辅助核对接口字段、错误码与权限逻辑，宿主机硬拦截写入与推送</span>
              </div>
            </div>
            <div class="pseg"><span class="s-ro">{I("eye",12)}仅查看</span><span>{I("edit",12)}可修改</span></div>
            <span class="rmb" title="移出授权列表">{I("x",14)}</span>
          </div>
        </div>

        <!-- 分组 2：本机代码目录 -->
        <div class="sgrp">
          <div class="sgh">
            <span class="sdot" style="background:#3B82F6;width:18px;height:18px">{I("folder",10,2.5)}</span>
            <b>本机代码目录</b>
            <span class="mono surl">~/workspace</span>
            <span class="scnt">已选 1 / 4</span>
            <span class="sadd">+ 从此来源挑选 ›</span>
          </div>
          <div class="prow rw">
            <span class="pic" style="background:linear-gradient(155deg,#5EDB7A,#22A748)">审批</span>
            <div class="pinfo">
              <div class="ptop">
                <b>审批 · 协同办公</b>
                <span class="src-pill" style="padding:2px 7px"><span class="mono">~/workspace/approval-web</span></span>
                <span class="okchip">{I("check",13,2.8)}已探测</span>
              </div>
              <div class="pmeta">
                <span class="ai-bdg">{I("spark",11)}AI 推测</span>
                <span class="ell"><span class="mono">main</span> → <span class="mono">test</span> · <span class="mono">pnpm build</span> · 本机 <span class="mono">worktree</span> 隔离修改</span>
                <span class="tune">微调 ›</span>
              </div>
            </div>
            <div class="pseg"><span>{I("eye",12)}仅查看</span><span class="s-rw">{I("edit",12)}可修改</span></div>
            <span class="rmb" title="移出授权列表">{I("x",14)}</span>
          </div>
        </div>

        <!-- 分组 3：GitHub -->
        <div class="sgrp">
          <div class="sgh">
            <span class="sdot" style="background:#1F2328;width:18px;height:18px;font-size:9px">GH</span>
            <b>GitHub</b>
            <span class="mono surl">github.com/tita-org</span>
            <span class="scnt">已选 1 / 14</span>
            <span class="sadd">+ 从此来源挑选 ›</span>
          </div>
          <div class="prow ro">
            <span class="pic" style="background:linear-gradient(155deg,#B78BFF,#7B42F6)">UI</span>
            <div class="pinfo">
              <div class="ptop">
                <b>基础组件库 · @tita/ui</b>
                <span class="src-pill" style="padding:2px 7px"><span class="mono">tita-org/ui-kit</span></span>
                <span class="tag tg-b" style="height:19px;font-size:10.5px">共享参考</span>
              </div>
              <div class="pmeta">
                <span class="ro-bdg">{I("lock",11)}只读隔离</span>
                <span class="ell">供 Bot 跨仓查组件 API 与主题变量，宿主机硬拦截任何代码写入与提 PR</span>
              </div>
            </div>
            <div class="pseg"><span class="s-ro">{I("eye",12)}仅查看</span><span>{I("edit",12)}可修改</span></div>
            <span class="rmb" title="移出授权列表">{I("x",14)}</span>
          </div>
        </div>
      </div>

      <div class="note" style="margin-bottom:10px;padding:8px 13px">
        {I("shield",15,st="color:var(--ink-blue);margin-top:1px")}
        <span><b>按连接器分组 · 最小授权：</b>Bot 只访问你从各连接器主动选入的这 4 个仓库，且仅在「可修改」仓拉 <span class="mono">fix/</span> 分支提 MR（合入仍需真人审）；修单时自动路由到对应项目。</span>
      </div>'''
    foot2 = ('<button class="bigb secb"><i data-i="chevl" data-s="16" data-w="2.4"></i>上一步</button>'
             f'<span class="stat-pill sp-g">{I("edit",13)}可修改 2 个</span>'
             f'<span class="stat-pill sp-b">{I("eye",13)}仅查看 2 个</span><span class="grow"></span>'
             '<button class="bigb pri">下一步：环境与账号<i data-i="chevr" data-s="16" data-w="2.4"></i></button>')
    why2 = ("spark", "只留你选中的仓库", "大公司连接器里往往有上百个仓库，这里绝不平铺全量清单；你通过搜索按需挑出相关项目，再切「可修改 / 仅查看」即可。")
    p2 = page(2, "挑选要授权给 Bot 的项目与权限", "点「+ 从已连来源挑选仓库」搜索添加；这里只保留你选中的仓库，分支与构建命令自动推测",
              s2, foot=foot2, why=why2, chip="不知道怎么选？问 AI")

    # ---------------- 2-pick 从已连连接器搜索挑选仓库抽屉 ----------------
    def pk_row(name, path, desc, picked=False, mode="可修改"):
        cb = f'<span class="pkc on">{CHECK}</span>' if picked else '<span class="pkc"></span>'
        bd = (f'<span class="tag {"tg-g" if mode=="可修改" else "tg-b"}" style="height:20px;font-size:11px">已加入 · {mode}</span>'
              if picked else '<span class="f11 t3">未选</span>')
        return f'''<div class="pkr{" on" if picked else ""}">{cb}<div class="grow" style="min-width:0">
          <div class="row g8"><b class="f13">{name}</b><span class="mono f11 t3 ell">{path}</span></div>
          <div class="f12 t3 ell" style="margin-top:2px">{desc}</div></div>{bd}</div>'''

    PICK_DRW = f'''<style>
.pkg{{font-size:11.5px;font-weight:700;color:var(--text-3);margin-top:4px;display:flex;align-items:center;gap:6px}}
.pkr{{display:flex;align-items:center;gap:11px;padding:10px 12px;border-radius:13px;background:var(--fill);border:1.5px solid transparent}}
.pkr.on{{background:var(--glass-2);border-color:color-mix(in srgb,var(--blue) 45%,transparent)}}
.pkc{{width:18px;height:18px;border-radius:6px;border:1.5px solid var(--border-ctl-hover);display:inline-flex;align-items:center;justify-content:center;flex:none}}
.pkc.on{{border:0;background:var(--btn-pri-bg);color:#fff}}
.pklist{{display:flex;flex-direction:column;gap:7px;flex:1;min-height:0;overflow:hidden;-webkit-mask-image:linear-gradient(180deg,#000 0%,#000 86%,transparent 100%);mask-image:linear-gradient(180deg,#000 0%,#000 86%,transparent 100%)}}
</style>
<div class="cc-scrim"></div>
<div class="cc-drawer">
  <div class="cc-drawer-hd">
    <span class="ic3" style="background:linear-gradient(155deg,#5AA0FF,#1F6FFF)">{I("search",18,2.2)}</span>
    <div class="grow">
      <div style="font-size:18px;font-weight:800">从已连来源挑选仓库</div>
      <div class="f12 t3" style="margin-top:2px">按连接器与关键词主动筛选，勾选的仓库才会留到第 2 步授权列表</div>
    </div>
    <span class="cc-close">{I("x",16,2.2)}</span>
  </div>
  <div class="cc-drawer-bd" style="gap:12px">
    <div class="row g10">
      <div class="cc-tabs">
        <span class="cc-tab is-active">G 公司 GitLab<span class="cc-count">28</span></span>
        <span class="cc-tab">GH GitHub<span class="cc-count">14</span></span>
        <span class="cc-tab">{I("folder",13)}本机目录<span class="cc-count">4</span></span>
      </div>
      <span class="grow"></span>
      <span class="f12 lnk" style="white-space:nowrap">+ 新增连接器</span>
    </div>
    <div class="cc-search is-focus" style="height:var(--ctl-md)">
      {I("search",15,st="color:var(--ink-blue)")}
      <span class="grow">okr</span>
      <span class="cc-tag cc-tag-n">命中 4 / 28 个</span>
      <span class="cc-search-clear">{I("x",11,2.4)}</span>
    </div>
    <div class="pklist">
      <div class="pkg">{I("folder",12)}Group: fe（前端业务线）</div>
      {pk_row("OKR · 目标管理", "fe/tita-okr-web", "最近提交 2 小时前 · TypeScript / React · 默认分支 master", True, "可修改")}
      {pk_row("OKR 移动端 H5", "fe/tita-okr-h5", "最近提交 5 天前 · Vue 3 · 默认分支 main", False)}
      <div class="pkg">{I("folder",12)}Group: be（后端服务）</div>
      {pk_row("OKR 后端服务", "be/tita-okr-api", "最近提交 1 小时前 · Go / Gin · 默认分支 master", True, "仅查看")}
      {pk_row("OKR 数据报表服务", "be/tita-okr-report", "最近提交 12 天前 · Java / SpringBoot · 默认分支 master", False)}
      <div class="pkg">{I("folder",12)}未匹配搜索词的其余 24 个仓库已折叠</div>
      {pk_row("薪酬 · 人事", "fe/tita-payroll-web", "输入其他关键词或清空搜索即可继续挑选", False)}
    </div>
  </div>
  <div class="cc-drawer-ft">
    <span class="f12 t2">新加入的仓库默认设为<b>仅查看</b>，回到列表可随时切「可修改」</span>
    <span class="grow"></span>
    <button class="cc-btn cc-btn-lg cc-btn-sec">取消</button>
    <button class="cc-btn cc-btn-lg cc-btn-pri">确认保留（共 4 个）</button>
  </div>
</div>'''
    p2_pick = p2.replace('</div><script src="icons.js">', PICK_DRW + '</div><script src="icons.js">', 1)

    # ---------------- 2-tune 点击「微调 ›」右侧抽屉 ----------------
    TUNE_DRW = f'''<style>
.flab{{font-size:12.5px;font-weight:700;color:var(--text-2);margin-bottom:6px;display:flex;align-items:center;gap:6px}}
.flab .rst{{margin-left:auto;font-weight:600;color:var(--ink-blue);font-size:11.5px}}
.dinp{{height:var(--ctl-md);border-radius:var(--r-md);background:var(--well);border:1px solid var(--hair);display:flex;align-items:center;gap:8px;padding:0 12px;font-size:13px;color:var(--text);min-width:0}}
.dinp.ov{{background:var(--glass-2);border:1px solid var(--focus-ring);box-shadow:0 0 0 3px var(--focus-halo)}}
.dsel{{height:var(--ctl-md);border-radius:var(--r-md);background:var(--glass-2);border:1px solid var(--border-ctl);box-shadow:var(--shadow-ctl);display:flex;align-items:center;gap:8px;padding:0 12px;font-size:13px;font-weight:600;color:var(--text);min-width:0}}
.tsec{{border-radius:15px;padding:12px 14px;background:var(--fill);display:flex;flex-direction:column;gap:10px}}
.tsec-h{{display:flex;align-items:center;gap:6px;font-size:12.5px;font-weight:700;color:var(--text)}}
.aid2{{display:inline-flex;align-items:center;gap:3px;height:18px;padding:0 6px;border-radius:5px;font-size:10.5px;font-weight:600;color:var(--ink-purple);background:color-mix(in srgb,var(--purple) 13%,transparent)}}
.ov2{{display:inline-flex;align-items:center;gap:3px;height:18px;padding:0 6px;border-radius:5px;font-size:10.5px;font-weight:600;color:var(--ink-blue);background:color-mix(in srgb,var(--blue) 13%,transparent)}}
</style>
<div class="cc-scrim"></div>
<div class="cc-drawer" style="width:640px">
  <div class="cc-drawer-hd">
    <span class="ic3" style="width:38px;height:38px;font-size:13px;background:linear-gradient(155deg,#5AA0FF,#1F6FFF)">OKR</span>
    <div class="grow" style="min-width:0">
      <div class="row g8"><span style="font-size:17px;font-weight:800">微调仓库配置</span><span class="cc-tag cc-tag-g">可修改</span></div>
      <div class="f12 t3 mono ell" style="margin-top:2px">公司 GitLab · fe/tita-okr-web · 探测于 10:20</div>
    </div>
    <span class="cc-close">{I("x",16,2.2)}</span>
  </div>
  <div class="cc-drawer-bd" style="gap:13px">
    <!-- 1. 归属项目与权限 -->
    <div class="tsec">
      <div class="tsec-h"><span>归属项目</span><span class="f11 t3" style="font-weight:400">支持多仓并入同一平级项目；修单时 Bot 自动路由</span></div>
      <div class="row g10">
        <div class="grow">
          <div class="flab">项目名称<span class="aid2">{I("spark",10)}AI 推测</span></div>
          <div class="dsel"><span>OKR · 目标管理</span><span class="grow"></span>{I("chevd",13,st="color:var(--text-3)")}</div>
        </div>
        <div style="width:188px;flex:none">
          <div class="flab">权限模式</div>
          <div class="dsel" style="color:var(--ink-green);border-color:color-mix(in srgb,var(--green) 42%,transparent);background:color-mix(in srgb,var(--green) 10%,var(--glass-2))">{I("edit",13)}<span class="grow">可修改（推 fix/）</span>{I("chevd",13,st="color:var(--text-3)")}</div>
        </div>
      </div>
    </div>

    <!-- 2. 分支与试构建覆盖 -->
    <div class="tsec">
      <div class="tsec-h"><span>分支与试构建命令</span><span class="f11 t3" style="font-weight:400">人工覆盖项标蓝，后续重探测不冲掉</span><span class="rst" style="margin-left:auto;font-size:11.5px;color:var(--ink-blue);font-weight:600">恢复全部 AI 推测</span></div>
      <div class="row g10">
        <div class="grow">
          <div class="flab">主干分支<span class="aid2">{I("spark",10)}默认分支</span></div>
          <div class="dsel"><span class="mono grow">master</span>{I("chevd",13,st="color:var(--text-3)")}</div>
        </div>
        <div class="grow">
          <div class="flab">测试分支<span class="aid2">{I("spark",10)}可选 · 留空走主干</span></div>
          <div class="dsel"><span class="mono grow">dev-okr</span>{I("chevd",13,st="color:var(--text-3)")}</div>
        </div>
      </div>
      <div class="row g10">
        <div style="width:170px;flex:none">
          <div class="flab">工具链适配<span class="aid2">lock / mod</span></div>
          <div class="dsel"><span class="mono grow">pnpm (多语言支持)</span>{I("chevd",13,st="color:var(--text-3)")}</div>
        </div>
        <div class="grow">
          <div class="flab">验证 / 试构建命令（不上传产物）<span class="ov2">已人工覆盖</span><span class="rst">还原推测</span></div>
          <div class="dinp ov"><span class="mono grow">pnpm build-prod --no-sourcemap</span></div>
        </div>
      </div>
    </div>

    <!-- 3. 代码规范与 MR 审核人 -->
    <div class="tsec">
      <div class="tsec-h"><span>验证策略、规范与默认审核人</span></div>
      <div class="row g8 f12 t2" style="padding:7px 10px;border-radius:10px;background:var(--glass-2)">
        {I("file",14,st="color:var(--ink-purple)")}
        <span class="grow ell">自动识别 <span class="mono">AGENTS.md</span> · 验证策略 <span class="mono">browser_dist_replace</span>（后端支持 <span class="mono">test_suite</span>）</span>
        <span class="tag tg-g" style="height:19px;font-size:10.5px">已生效</span>
      </div>
      <div class="row g10">
        <div class="grow">
          <div class="flab">合入测试分支审核人</div>
          <div class="dsel"><span class="grow">工单修复人（默认）</span>{I("chevd",13,st="color:var(--text-3)")}</div>
        </div>
        <div class="grow">
          <div class="flab">合回主干分支审核人</div>
          <div class="dsel"><span class="grow">林某（项目负责人）</span>{I("chevd",13,st="color:var(--text-3)")}</div>
        </div>
      </div>
    </div>

    <div class="row g8 f12" style="padding:9px 12px;border-radius:12px;background:color-mix(in srgb,var(--green) 10%,transparent);color:var(--ink-green);font-weight:600">
      {I("check",14,2.8)}
      <span class="grow">上次试构建通过 · <span class="mono">pnpm build-prod</span> · 3 分 12 秒（修改命令后建议重新试构建）</span>
    </div>
  </div>
  <div class="cc-drawer-ft">
    <button class="cc-btn cc-btn-lg cc-btn-sec">取消</button>
    <span class="grow"></span>
    <button class="cc-btn cc-btn-lg cc-btn-glass">仅保存</button>
    <button class="cc-btn cc-btn-lg cc-btn-pri">{I("zap",14)}保存并试构建</button>
  </div>
</div>'''
    p2_tune = p2.replace('</div><script src="icons.js">', TUNE_DRW + '</div><script src="icons.js">', 1)

    # ---------------- 4 AI 体检并开工 ----------------
    def c(st, t, r):
        bg = {"ok": "var(--btn-ok-bg)", "wn": "#B45309", "sk": "color-mix(in srgb,var(--text) 25%,transparent)"}[st]
        g = {"ok": CHECK, "wn": "!", "sk": "–"}[st]
        rc = {"ok": "var(--text-3)", "wn": "var(--ink-orange)", "sk": "var(--text-3)"}[st]
        return f'<div class="chk3"><span class="ck3" style="background:{bg};font-size:12px;font-weight:800">{g}</span><span class="grow">{t}</span><span class="f12" style="color:{rc}">{r}</span></div>'

    s4 = X + f'''
      <div class="big-ok" style="margin-top:18px">
        <span class="ck3" style="width:44px;height:44px;background:var(--btn-ok-bg)">{I("check",22,3)}</span>
        <div class="grow"><div class="f16 w7">必需条件全部通过，可以开工了</div><div class="f13 t2" style="margin-top:3px">Bot-02 实际跑了一遍自动探测与体检 · 用时 3 分 52 秒 · 今天 10:42</div></div>
        <span class="f12 lnk">看完整日志 ›</span>
      </div>
      <div class="row g12" style="margin-top:14px;align-items:flex-start">
        <div class="obx grow" style="padding:6px 16px">
          {c("ok", "AI 引擎已连通 · Pi（默认内置 · 自定义多模型）", "管理员已配置")}
          {c("ok", "连接器鉴权 · GitLab、GitHub、本机目录、Jira", "全部通过")}
          {c("ok", "可修改仓库（2 个）· 自动推测分支与构建通过", "3 分 18 秒")}
          {c("ok", "仅查看仓库（2 个）· 只读索引完成，宿主机硬禁写", "只读隔离")}
          {c("ok", "已自动读取仓库规范（AGENTS.md / ESLint）+ 内置 Skills", "免手配直接生效")}
          {c("ok", "环境与账号 · 3 个环境打开，6 个账号登录成功", "测试 / 联调 / 正式")}
          {c("wn", "正式环境 · OKR 管理员 Cookie 已过期", "不挡开工，用到时提醒")}
          {c("sk", "紧急回滚（Apollo）、自定义主题 / 费用监控等扩展插件", "按需在插件市场启用")}
        </div>
        <div class="obx" style="width:276px;flex:none">
          <div class="f13 w7">开工后怎么干活</div>
          <div class="f12 t2" style="margin-top:6px;line-height:1.6">已接 Jira 自动收单的 2 张单马上开始修，AI 自动匹配目标项目；你也可以随时点「+」手动新建工单。</div>
          <div class="col g6" style="margin-top:10px">
            <div class="tk"><span class="sc10 sc-j">Jira</span><span class="grow ell">OKR-412 对齐视图子目标重复</span></div>
            <div class="tk"><span class="sc10 sc-j">Jira</span><span class="grow ell">OKR-418 目标导入日期错一天</span></div>
          </div>
          <div class="f12 t3" style="margin-top:12px;padding-top:10px;border-top:1px solid var(--hair);line-height:1.55">想加紧急回滚、皮肤主题或自定义 Skills，随时去左侧 Dock「插件市场 / Skills」或「设置」按需开启。</div>
        </div>
      </div>'''
    foot4 = ('<button class="bigb secb"><i data-i="chevl" data-s="16" data-w="2.4"></i>上一步</button><span class="grow"></span>'
             '<span class="f13 t3" style="margin-right:6px">随时可在「设置 → 连接器 / 项目」调整</span>'
             '<button class="bigb pri">开始使用，进入工作台<i data-i="chevr" data-s="16" data-w="2.4"></i></button>')
    why4 = ("spark", "4 步即可零负担开工", "内置 Skills 与仓库规范默认生效；发布回滚、UI 主题、Token 费用监控等扩展插件不挡首次开工，用到时再从插件市场装。")
    p4 = page(4, "AI 自动体检通过，可以开工了", "拉代码、推测构建、只读权限隔离、环境试登录全部真实跑通，不是只看表单填没填",
              s4, foot=foot4, why=why4)

    return {"1": p1, "1-new": p1_new, "1-ticket": p1_ticket, "1-ai": p1_ai, "2": p2, "2-pick": p2_pick, "2-tune": p2_tune, "4": p4}


def ai_step(page, CHECK):
    """管理员专用的前置第 0 步：连接 AI 引擎（不再混入硬编码 GitLab 账号）。"""
    def I(n, s=16, w=None, st=None):
        return f'<i data-i="{n}" data-s="{s}"' + (f' data-w="{w}"' if w else '') + (f' style="{st}"' if st else '') + '></i>'
    CHEV = f'<span class="cc-sel-caret">{I("chevd",13)}</span>'
    OK = f'<span class="okt">{CHECK}'

    def row(k, v):
        return f'<div class="kv3" style="margin-top:12px"><span>{k}</span>{v}</div>'

    body = X + f'''
      <div class="obx" style="margin-top:20px;padding:18px 20px">
        {row("AI 引擎", f'<div class="cc-select cc-select-lg grow"><span style="width:7px;height:7px;border-radius:50%;background:var(--purple);flex:none"></span><span class="cc-sel-val">Pi</span><span class="cc-sel-sub">默认内置 · 多模型</span>{CHEV}</div>')}
        {row("主力模型", f'<div class="cc-select cc-select-lg grow"><span style="width:7px;height:7px;border-radius:50%;background:var(--green);flex:none"></span><span class="cc-sel-val mono">claude-4.5-sonnet / 自定义</span><span class="cc-sel-sub">OpenAI 兼容网关 · 支持费率覆写</span>{CHEV}</div>')}
        {row("快速模型", f'<div class="cc-select cc-select-lg grow"><span class="cc-sel-val mono">qwen3-coder-flash</span><span class="cc-sel-sub">报错解读 / i18n 补译 / 轻问答</span>{CHEV}</div>')}
        {row("连接方式", '<div class="cc-seg cc-seg-lg" style="flex:1;display:flex"><span class="on" style="flex:1">自定义网关</span><span style="flex:1">API Key</span></div>')}
        {row("网关地址", '<div class="cc-input cc-input-lg grow"><span class="mono f12">https://ai-gateway.example.com</span></div>')}
        {row("访问令牌", '<div class="cc-input cc-input-lg grow"><span class="mono f12">•••••••••••••••• 3f9a</span></div>')}
        <div class="row g10" style="margin:16px 0 0 86px">
          <button class="cc-btn cc-btn-glass">{I("zap",14)}试一下</button>
          {OK}已连通 · Bot-02 实际调用了一次（1.2 秒），4 项模型能力探测完成</span>
        </div>
      </div>
      <div class="note" style="margin-top:16px">
        {I("link",15,st="color:var(--ink-blue);margin-top:1px")}
        <span><b>外部工具统一走连接器：</b>GitLab、GitHub、Gitee、Jira、Tita 等平台鉴权不再写死在这里，下一步「连接器与鉴权」中统一接入，并支持本机代码目录与插件市场扩展。</span>
      </div>
'''
    why0 = ("spark", "管理员一次性配置", "AI 引擎全工作空间共用，仅首次登录的管理员可见；其他团队成员登录后直接从「连接器与鉴权」开始。")
    return page(1, "先把工作空间的 AI 接上", "全公司接一次，所有项目共用；后续想切外部 CLI 引擎（ACP / Claude Code / Codex），在插件市场安装即可",
                body, "连接器与鉴权", skip=False, prev=False, why=why0)
