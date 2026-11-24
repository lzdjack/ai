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
.okpill{display:inline-flex;align-items:center;gap:4px;font-size:11.5px;font-weight:600;color:var(--green);white-space:nowrap}
.cmeta{display:flex;align-items:center;gap:7px;font-size:12px;color:var(--text-2);min-width:0}
.cfoot{display:flex;align-items:center;gap:8px;padding-top:8px;border-top:1px solid var(--hair);font-size:12px;color:var(--text-3)}
.cfoot .act{margin-left:auto;color:var(--blue);font-weight:600;white-space:nowrap}
.qadd{display:flex;align-items:center;gap:8px;margin-top:10px;flex-wrap:nowrap}
.qbtn{height:32px;padding:0 11px;border-radius:10px;background:var(--fill);border:1px solid var(--hair);display:inline-flex;align-items:center;gap:6px;font-size:12px;font-weight:600;color:var(--text-2);white-space:nowrap}
.qdot{width:17px;height:17px;border-radius:5px;display:inline-flex;align-items:center;justify-content:center;color:#fff;font-size:10px;font-weight:800;flex:none}
.stat-pill{display:inline-flex;align-items:center;gap:6px;height:28px;padding:0 10px;border-radius:9px;font-size:12px;font-weight:600;white-space:nowrap}
.sp-g{background:color-mix(in srgb,var(--green) 13%,transparent);color:var(--green)}
.sp-b{background:color-mix(in srgb,var(--blue) 13%,transparent);color:var(--blue)}

/* 第 2 步：多来源聚合与三态读写权限 */
.ptbar{display:flex;align-items:center;gap:8px;margin-top:16px}
.srcsel{height:34px;padding:0 10px;border-radius:10px;background:var(--glass-2);border:1px solid var(--stroke);display:inline-flex;align-items:center;gap:7px;font-size:12.5px;font-weight:600;white-space:nowrap;flex:none}
.sdots{display:inline-flex;align-items:center}
.sdots i{width:16px;height:16px;border-radius:5px;display:inline-flex;align-items:center;justify-content:center;color:#fff;font-size:9px;font-weight:800;font-style:normal;border:1.5px solid var(--glass-2)}
.sdots i+i{margin-left:-4px}
.srch2{height:34px;flex:1;min-width:140px;border-radius:10px;background:var(--fill);padding:0 11px;display:flex;align-items:center;gap:7px;font-size:12.5px;color:var(--text-3);border:1px solid var(--hair)}
.fchip{height:30px;padding:0 10px;border-radius:9px;font-size:12px;font-weight:600;color:var(--text-2);background:var(--fill);display:inline-flex;align-items:center;gap:4px;white-space:nowrap;flex:none}
.fchip.on{background:var(--blue);color:#fff}
.fchip em{font-style:normal;opacity:.72;font-size:11px;font-weight:500}
.addbtn{height:34px;padding:0 12px;border-radius:10px;background:var(--fill);border:1px solid var(--hair);font-size:12.5px;font-weight:600;color:var(--text);display:inline-flex;align-items:center;gap:5px;white-space:nowrap;flex:none}
.plist{display:flex;flex-direction:column;gap:8px;margin-top:12px;flex:1;min-height:0}
.prow{border-radius:15px;padding:11px 14px;background:var(--fill);border:1.5px solid transparent;display:flex;align-items:center;gap:14px;min-width:0}
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
.ai-bdg{display:inline-flex;align-items:center;gap:3px;height:20px;padding:0 6px;border-radius:6px;font-size:11px;font-weight:600;color:var(--purple);background:color-mix(in srgb,var(--purple) 12%,transparent);flex:none}
.ro-bdg{display:inline-flex;align-items:center;gap:3px;height:20px;padding:0 6px;border-radius:6px;font-size:11px;font-weight:600;color:var(--blue);background:color-mix(in srgb,var(--blue) 12%,transparent);flex:none}
.okchip{display:inline-flex;align-items:center;gap:3px;color:var(--green);font-size:11.5px;font-weight:600;flex:none}
.tune{font-size:12px;font-weight:600;color:var(--blue);margin-left:auto;padding-left:6px;flex:none;white-space:nowrap}
.pseg{display:inline-flex;padding:3px;border-radius:11px;background:color-mix(in srgb,var(--text) 6%,transparent);flex:none;gap:2px}
.pseg span{height:28px;padding:0 10px;border-radius:8px;font-size:12px;font-weight:600;color:var(--text-3);display:inline-flex;align-items:center;gap:4px;white-space:nowrap}
.pseg span.s-off{background:var(--glass-2);color:var(--text-2);box-shadow:0 1px 4px rgba(0,0,0,.1)}
.pseg span.s-ro{background:var(--blue);color:#fff;box-shadow:0 4px 12px -4px color-mix(in srgb,var(--blue) 85%,transparent)}
.pseg span.s-rw{background:var(--green);color:#fff;box-shadow:0 4px 12px -4px color-mix(in srgb,var(--green) 85%,transparent)}
html.dark .pseg{background:rgba(255,255,255,.07)}
html.dark .pseg span.s-off{background:rgba(255,255,255,.14);color:var(--text)}

/* 第 4 步与管理员第 0 步 */
.obx{border-radius:16px;padding:14px 16px;background:var(--fill)}
.kv3{display:flex;align-items:center;gap:10px;margin-top:10px}
.kv3>span:first-child{width:76px;white-space:nowrap;flex:none;font-size:12.5px;color:var(--text-3)}
.kv3 .inp{height:38px;flex:1;font-size:13.5px}
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
          <div class="cmeta">{I("shield",13,st="color:var(--green)")}<span class="ell">令牌 <span class="mono">bot-fix</span> · 读写分支，无合入主干权限</span></div>
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
          <div class="cmeta">{I("branch",13,st="color:var(--blue)")}<span class="ell">免远端令牌 · 自动走 <span class="mono">worktree</span> 隔离不脏工作区</span></div>
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
          <div class="cmeta">{I("inbox",13,st="color:var(--blue)")}<span class="ell">只读采集 · 自动收状态为「AI修复」的 Bug（当前 2 张）</span></div>
          <div class="cfoot"><span>每 2 分钟同步</span><span class="act">改鉴权 / 触发条件 ›</span></div>
        </div>
        <div class="ccard addc">
          <div class="row g8" style="color:var(--text)">{I("plus",16,st="color:var(--blue)")}<b class="f14">添加更多工单连接器</b></div>
          <div class="f12 t3" style="line-height:1.55">支持 Tita 工单、GitHub Issues、插件市场第三方连接器或通用 Webhook / MCP；也可先跳过直接手动建单</div>
          <div class="row g6" style="margin-top:2px">
            <span class="tag tg-b" style="height:20px;font-size:11px">+ Tita 工单</span>
            <span class="tag tg-n" style="height:20px;font-size:11px">+ GitHub Issues</span>
            <span class="tag tg-p" style="height:20px;font-size:11px">+ 插件市场 / MCP</span>
          </div>
        </div>
      </div>

      <div class="note" style="margin-top:auto;margin-bottom:14px">
        {I("lock",15,st="color:var(--blue);margin-top:1px")}
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
.scr{{position:fixed;inset:0;z-index:30;background:rgba(15,20,40,.28);backdrop-filter:blur(4px);-webkit-backdrop-filter:blur(4px)}}
html.dark .scr{{background:rgba(0,0,0,.48)}}
.drw{{position:fixed;z-index:31;top:24px;right:24px;bottom:24px;width:660px;border-radius:26px;display:flex;flex-direction:column;overflow:hidden;
  background:rgba(255,255,255,.96);backdrop-filter:blur(40px) saturate(180%);-webkit-backdrop-filter:blur(40px) saturate(180%);box-shadow:0 30px 80px -20px rgba(10,20,60,.45),0 0 0 1px var(--stroke)}}
html.dark .drw{{background:rgba(34,36,50,.96)}}
.drw .dh{{display:flex;gap:12px;align-items:center;padding:20px 24px 16px;border-bottom:1px solid var(--hair)}}
.drw .db{{flex:1;display:flex;flex-direction:column;gap:15px;padding:18px 24px;min-height:0;overflow:hidden}}
.drw .df{{display:flex;align-items:center;gap:10px;padding:14px 24px;border-top:1px solid var(--hair)}}
.xb{{width:32px;height:32px;border-radius:50%;background:var(--fill);display:flex;align-items:center;justify-content:center;color:var(--text-2);flex:none}}
.ic3{{width:40px;height:40px;border-radius:11px;display:flex;align-items:center;justify-content:center;color:#fff;flex:none;font-size:15px;font-weight:800}}
.flab{{font-size:12.5px;font-weight:700;color:var(--text-2);margin-bottom:7px;display:flex;align-items:center;gap:6px}}
.flab span{{font-weight:400;color:var(--text-3);font-size:11.5px}}
.pgrid{{display:grid;grid-template-columns:repeat(5,1fr);gap:8px}}
.pitem{{height:40px;border-radius:11px;background:var(--fill);border:1.5px solid transparent;display:flex;align-items:center;justify-content:center;gap:6px;font-size:12.5px;font-weight:600;color:var(--text-2)}}
.pitem.on{{background:var(--glass-2);border-color:var(--blue);color:var(--text);box-shadow:0 6px 16px -10px color-mix(in srgb,var(--blue) 65%,transparent)}}
.pdot{{width:18px;height:18px;border-radius:5px;display:inline-flex;align-items:center;justify-content:center;color:#fff;font-size:10px;font-weight:800;flex:none}}
.dinp{{height:40px;border-radius:11px;background:var(--fill);display:flex;align-items:center;gap:9px;padding:0 13px;font-size:13.5px;color:var(--text);min-width:0}}
.dinp.foc{{background:var(--glass-2);box-shadow:0 0 0 2px var(--blue),0 0 0 5px color-mix(in srgb,var(--blue) 16%,transparent)}}
.seg2{{display:flex;padding:3px;border-radius:11px;background:var(--fill);gap:2px}}
.seg2 span{{flex:1;height:32px;border-radius:8px;display:flex;align-items:center;justify-content:center;gap:5px;font-size:12.5px;font-weight:600;color:var(--text-2)}}
.seg2 span.on{{background:var(--glass-2);color:var(--text);box-shadow:0 1px 4px rgba(0,0,0,.12)}}
html.dark .seg2 span.on{{background:rgba(255,255,255,.15)}}
.vbox{{border-radius:16px;padding:13px 16px;background:color-mix(in srgb,var(--green) 8%,var(--fill));border:1px solid color-mix(in srgb,var(--green) 28%,transparent)}}
.vrow{{display:flex;align-items:center;gap:9px;font-size:12.5px;padding:4px 0;color:var(--text)}}
.vck{{width:17px;height:17px;border-radius:50%;background:var(--green);color:#fff;display:inline-flex;align-items:center;justify-content:center;flex:none}}
</style>
<div class="scr"></div>
<div class="drw">
  <div class="dh">
    <span class="ic3" style="background:linear-gradient(155deg,#FF8A4C,#E24329)">G</span>
    <div class="grow">
      <div style="font-size:18px;font-weight:800">新建代码连接器</div>
      <div class="f12 t3" style="margin-top:2px">表单按插件 <span class="mono">authSchema</span> 自动渲染 · 鉴权通过后下一步即可拉取该平台仓库</div>
    </div>
    <span class="xb">{I("x",16,2.2)}</span>
  </div>
  <div class="db">
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
      <div style="width:230px;flex:none"><div class="flab">共享范围</div><div class="seg2"><span class="on">公司共用</span><span>仅我自己</span></div></div>
    </div>
    <div>
      <div class="flab">服务地址<span>企业私有部署填内网域名，公有云保持默认即可</span></div>
      <div class="dinp">{I("globe",15,st="color:var(--text-3)")}<span class="mono grow">https://git.tita.cloud</span></div>
    </div>
    <div>
      <div class="flab">鉴权方式<span>推荐给 Bot 专号签发 Access Token，不给合入主干权限</span></div>
      <div class="seg2">
        <span class="on">{I("key",13)}Access Token</span>
        <span>{I("shield",13)}OAuth 一键授权</span>
        <span>{I("terminal",13)}SSH Key</span>
      </div>
    </div>
    <div>
      <div class="flab">访问令牌（Token）<span>公钥加密保存，仅执行器可解</span></div>
      <div class="row g10">
        <div class="dinp foc grow">{I("lock",14,st="color:var(--blue)")}<span class="mono grow">glpat-•••••••••••••••••• 91d0</span></div>
        <button class="bigb secb" style="height:40px;background:var(--glass-2);border:1px solid var(--stroke)">{I("zap",14,st="color:var(--blue)")}重新验证</button>
      </div>
    </div>
    <div class="vbox">
      <div class="row g8" style="margin-bottom:6px"><b class="f13" style="color:var(--green)">鉴权验证通过 · 用时 340ms</b><span class="grow"></span><span class="f12 t3">Bot-02 实测</span></div>
      <div class="vrow"><span class="vck">{I("check",11,3)}</span><span>服务地址连通，API v4 响应正常</span></div>
      <div class="vrow"><span class="vck">{I("check",11,3)}</span><span>识别身份：<span class="mono">bot-fix</span> · 具备 <span class="mono">read_api / read_repository / write_repository</span></span></div>
      <div class="vrow"><span class="vck">{I("check",11,3)}</span><span>安全校验：<b>无合入主干权限</b>（符合最小权限原则），可拉取 <b>28 个仓库</b></span></div>
    </div>
  </div>
  <div class="df">
    <button class="bigb secb" style="height:42px">取消</button>
    <span class="grow"></span>
    <span class="f12 t3">保存后团队成员可直接复用此连接器</span>
    <button class="bigb pri" style="height:42px">保存并拉取仓库</button>
  </div>
</div>'''
    p1_new = p1.replace('</div><script src="icons.js">', DRW + '</div><script src="icons.js">', 1)

    # ---------------- 2 授权项目与代码权限 ----------------
    s2 = X + f'''
      <div class="ptbar">
        <div class="srcsel">
          <span class="sdots"><i style="background:#FC6D26">G</i><i style="background:#1F2328">GH</i><i style="background:#3B82F6">本</i></span>
          <span>全部来源 (3)</span>
          {I("chevd",14,st="color:var(--text-3)")}
        </div>
        <div class="srch2">{I("search",14)}<span>搜索仓库或项目名称…</span></div>
        <span class="fchip on">全部<em>5</em></span>
        <span class="fchip">已授权<em>4</em></span>
        <span class="addbtn">{I("plus",14)}新增连接器</span>
      </div>

      <div class="plist">
        <div class="prow rw">
          <span class="pic" style="background:linear-gradient(155deg,#5AA0FF,#1F6FFF)">OKR</span>
          <div class="pinfo">
            <div class="ptop">
              <b>OKR · 目标管理</b>
              <span class="src-pill"><span class="sdot" style="background:#FC6D26">G</span><span class="mono">fe/tita-okr-web</span></span>
              <span class="okchip">{I("check",13,2.8)}已探测</span>
            </div>
            <div class="pmeta">
              <span class="ai-bdg">{I("spark",11)}AI 推测</span>
              <span class="ell"><span class="mono">master</span> → <span class="mono">dev-okr</span> · <span class="mono">pnpm build-prod</span> · 规范 <span class="mono">AGENTS.md</span></span>
              <span class="tune">微调 ›</span>
            </div>
          </div>
          <div class="pseg"><span>不关联</span><span>{I("eye",12)}仅查看</span><span class="s-rw">{I("edit",12)}可修改</span></div>
        </div>

        <div class="prow rw">
          <span class="pic" style="background:linear-gradient(155deg,#5EDB7A,#22A748)">审批</span>
          <div class="pinfo">
            <div class="ptop">
              <b>审批 · 协同办公</b>
              <span class="src-pill"><span class="sdot" style="background:#3B82F6">{I("folder",9,2.5)}</span><span class="mono">~/workspace/approval-web</span></span>
              <span class="okchip">{I("check",13,2.8)}已探测</span>
            </div>
            <div class="pmeta">
              <span class="ai-bdg">{I("spark",11)}AI 推测</span>
              <span class="ell"><span class="mono">main</span> → <span class="mono">test</span> · <span class="mono">pnpm build</span> · 本机 <span class="mono">worktree</span> 隔离修改</span>
              <span class="tune">微调 ›</span>
            </div>
          </div>
          <div class="pseg"><span>不关联</span><span>{I("eye",12)}仅查看</span><span class="s-rw">{I("edit",12)}可修改</span></div>
        </div>

        <div class="prow ro">
          <span class="pic" style="background:linear-gradient(155deg,#B78BFF,#7B42F6)">UI</span>
          <div class="pinfo">
            <div class="ptop">
              <b>基础组件库 · @tita/ui</b>
              <span class="src-pill"><span class="sdot" style="background:#1F2328">GH</span><span class="mono">tita-org/ui-kit</span></span>
              <span class="tag tg-b" style="height:19px;font-size:10.5px">共享参考</span>
            </div>
            <div class="pmeta">
              <span class="ro-bdg">{I("lock",11)}只读隔离</span>
              <span class="ell">供 Bot 跨仓查组件 API 与主题变量，宿主机硬拦截任何代码写入与提 PR</span>
            </div>
          </div>
          <div class="pseg"><span>不关联</span><span class="s-ro">{I("eye",12)}仅查看</span><span>{I("edit",12)}可修改</span></div>
        </div>

        <div class="prow ro">
          <span class="pic" style="background:linear-gradient(155deg,#4FD6E6,#0E8FB3)">API</span>
          <div class="pinfo">
            <div class="ptop">
              <b>OKR 后端服务</b>
              <span class="src-pill"><span class="sdot" style="background:#FC6D26">G</span><span class="mono">be/tita-okr-api</span></span>
              <span class="tag tg-b" style="height:19px;font-size:10.5px">接口参考</span>
            </div>
            <div class="pmeta">
              <span class="ro-bdg">{I("lock",11)}只读隔离</span>
              <span class="ell">辅助核对接口字段、错误码与权限逻辑，禁止修改或推送分支</span>
            </div>
          </div>
          <div class="pseg"><span>不关联</span><span class="s-ro">{I("eye",12)}仅查看</span><span>{I("edit",12)}可修改</span></div>
        </div>

        <div class="prow off">
          <span class="pic" style="background:linear-gradient(155deg,#94A3B8,#64748B)">薪酬</span>
          <div class="pinfo">
            <div class="ptop">
              <b>薪酬 · 人事</b>
              <span class="src-pill"><span class="sdot" style="background:#FC6D26">G</span><span class="mono">fe/tita-payroll-web</span></span>
            </div>
            <div class="pmeta">
              <span class="t3 ell">未授权 · Bot 不可见、不拉取代码，需要时随时在「设置 → 项目」里开启</span>
            </div>
          </div>
          <div class="pseg"><span class="s-off">不关联</span><span>{I("eye",12)}仅查看</span><span>{I("edit",12)}可修改</span></div>
        </div>
      </div>

      <div class="note" style="margin-bottom:12px">
        {I("shield",15,st="color:var(--blue);margin-top:1px")}
        <span><b>权限红线由宿主机兜底：</b>Bot 只能在「可修改」仓库拉 <span class="mono">fix/</span> 分支并提 MR/PR（合入仍需真人审，默认合测试=修复人、合主干=项目负责人）；遇归属拿不准的工单先问人再改。</span>
      </div>'''
    foot2 = ('<button class="bigb secb"><i data-i="chevl" data-s="16" data-w="2.4"></i>上一步</button>'
             f'<span class="stat-pill sp-g">{I("edit",13)}可修改 2 个</span>'
             f'<span class="stat-pill sp-b">{I("eye",13)}仅查看 2 个</span><span class="grow"></span>'
             '<button class="bigb pri">下一步：环境与账号<i data-i="chevr" data-s="16" data-w="2.4"></i></button>')
    why2 = ("spark", "多来源统一调度", "不管仓库来自企业 GitLab、GitHub、Gitee 还是本机目录，修 Bug 时 Bot 会按工单内容自动匹配对应项目，并严格遵守读写权限。")
    p2 = page(2, "告诉 Bot 哪些项目能改、哪些只能看", "已从第 1 步鉴权通过的来源拉取仓库；修单时 Bot 自动找对应项目，分支与构建命令自动推测",
              s2, foot=foot2, why=why2, chip="不知道怎么选？问 AI")

    # ---------------- 4 AI 体检并开工 ----------------
    def c(st, t, r):
        bg = {"ok": "var(--green)", "wn": "var(--orange)", "sk": "color-mix(in srgb,var(--text) 25%,transparent)"}[st]
        g = {"ok": CHECK, "wn": "!", "sk": "–"}[st]
        rc = {"ok": "var(--text-3)", "wn": "var(--orange)", "sk": "var(--text-3)"}[st]
        return f'<div class="chk3"><span class="ck3" style="background:{bg};font-size:12px;font-weight:800">{g}</span><span class="grow">{t}</span><span class="f12" style="color:{rc}">{r}</span></div>'

    s4 = X + f'''
      <div class="big-ok" style="margin-top:18px">
        <span class="ck3" style="width:44px;height:44px;background:var(--green)">{I("check",22,3)}</span>
        <div class="grow"><div class="f16 w7">必需条件全部通过，可以开工了</div><div class="f13 t2" style="margin-top:3px">Bot-02 实际跑了一遍自动探测与体检 · 用时 3 分 52 秒 · 今天 10:42</div></div>
        <span class="f12 lnk">看完整日志 ›</span>
      </div>
      <div class="row g12" style="margin-top:14px;align-items:flex-start">
        <div class="obx grow" style="padding:6px 16px">
          {c("ok", "AI 引擎已连通 · Pi（默认内置 · gpt-6.2-sol）", "管理员已配置")}
          {c("ok", "连接器鉴权 · GitLab、GitHub、本机目录、Jira", "全部通过")}
          {c("ok", "可修改仓库（2 个）· 自动推测分支与构建通过", "3 分 18 秒")}
          {c("ok", "仅查看仓库（2 个）· 只读索引完成，宿主机硬禁写", "只读隔离")}
          {c("ok", "已自动读取仓库规范（AGENTS.md / ESLint）+ 内置 Skills", "免手配直接生效")}
          {c("ok", "环境与账号 · 3 个环境打开，6 个账号登录成功", "测试 / 联调 / 正式")}
          {c("wn", "正式环境 · OKR 管理员 Cookie 已过期", "不挡开工，用到时提醒")}
          {c("sk", "发布与回滚、自定义主题 / 费用监控等插件", "按需在插件市场启用")}
        </div>
        <div class="obx" style="width:276px;flex:none">
          <div class="f13 w7">开工后怎么干活</div>
          <div class="f12 t2" style="margin-top:6px;line-height:1.6">已接 Jira 自动收单的 2 张单马上开始修，AI 自动匹配目标项目；你也可以随时点「+」手动新建工单。</div>
          <div class="col g6" style="margin-top:10px">
            <div class="tk"><span class="sc10 sc-j">Jira</span><span class="grow ell">OKR-412 对齐视图子目标重复</span></div>
            <div class="tk"><span class="sc10 sc-j">Jira</span><span class="grow ell">OKR-418 目标导入日期错一天</span></div>
          </div>
          <div class="f12 t3" style="margin-top:12px;padding-top:10px;border-top:1px solid var(--hair);line-height:1.55">想加发版回滚、皮肤主题或自定义 Skills，随时去左侧 Dock「插件市场 / Skills」或「设置」按需开启。</div>
        </div>
      </div>'''
    foot4 = ('<button class="bigb secb"><i data-i="chevl" data-s="16" data-w="2.4"></i>上一步</button><span class="grow"></span>'
             '<span class="f13 t3" style="margin-right:6px">随时可在「设置 → 连接器 / 项目」调整</span>'
             '<button class="bigb pri">开始使用，进入工作台<i data-i="chevr" data-s="16" data-w="2.4"></i></button>')
    why4 = ("spark", "4 步即可零负担开工", "内置 Skills 与仓库规范默认生效；发布回滚、UI 主题、Token 费用监控等扩展插件不挡首次开工，用到时再从插件市场装。")
    p4 = page(4, "AI 自动体检通过，可以开工了", "拉代码、推测构建、只读权限隔离、环境试登录全部真实跑通，不是只看表单填没填",
              s4, foot=foot4, why=why4)

    return {"1": p1, "1-new": p1_new, "2": p2, "4": p4}


def ai_step(page, CHECK):
    """管理员专用的前置第 0 步：连接 AI 引擎（不再混入硬编码 GitLab 账号）。"""
    def I(n, s=16, w=None, st=None):
        return f'<i data-i="{n}" data-s="{s}"' + (f' data-w="{w}"' if w else '') + (f' style="{st}"' if st else '') + '></i>'
    CHD = I("chevd", 14)
    OK = f'<span class="okt">{CHECK}'

    def row(k, v):
        return f'<div class="kv3" style="margin-top:12px"><span>{k}</span>{v}</div>'

    body = X + f'''
      <div class="obx" style="margin-top:20px;padding:18px 20px">
        {row("AI 引擎", f'<div class="inp sel">Pi（默认内置 · 多模型）{CHD}</div>')}
        {row("主力模型", f'<div class="inp sel">gpt-6.2-sol{CHD}</div>')}
        {row("快速模型", f'<div class="inp sel">gpt-6.2-mini（报错解读 / 翻译 / 轻问答）{CHD}</div>')}
        {row("连接方式", '<div class="seg" style="flex:1"><span class="on" style="flex:1;justify-content:center">公司网关</span><span style="flex:1;justify-content:center">API Key</span></div>')}
        {row("网关地址", '<div class="inp"><span class="mono f12">https://ai-gateway.tita.cloud</span></div>')}
        {row("访问令牌", '<div class="inp"><span class="mono f12">•••••••••••••••• 3f9a</span></div>')}
        <div class="row g10" style="margin:16px 0 0 86px">
          <button class="btn2 a-sec" style="background:var(--glass-2)">{I("zap",14)}试一下</button>
          {OK}已连通 · Bot-02 实际调用了一次（1.2 秒），4 项模型能力探测完成</span>
        </div>
      </div>
      <div class="note" style="margin-top:16px">
        {I("link",15,st="color:var(--blue);margin-top:1px")}
        <span><b>外部工具统一走连接器：</b>GitLab、GitHub、Gitee、Jira、Tita 等平台鉴权不再写死在这里，下一步「连接器与鉴权」中统一接入，并支持本机代码目录与插件市场扩展。</span>
      </div>
'''
    why0 = ("spark", "管理员一次性配置", "AI 引擎全工作空间共用，仅首次登录的管理员可见；其他团队成员登录后直接从「连接器与鉴权」开始。")
    return page(1, "先把工作空间的 AI 接上", "全公司接一次，所有项目共用；后续想切外部 CLI 引擎（ACP / Claude Code / Codex），在插件市场安装即可",
                body, "连接器与鉴权", skip=False, prev=False, why=why0)
