"""移动端定稿外壳：状态栏、Tab 栏、头像行。抽自 gen-mobile.py。"""
W='width="24" height="24" viewBox="0 0 24 24"'
ai=f'<svg {W} fill="#fff"><path d="M10 3l1.9 5.6 5.6 1.9-5.6 1.9L10 18l-1.9-5.6L2.5 10.5l5.6-1.9z"/><path d="M18 13.5l.9 2.6 2.6.9-2.6.9-.9 2.6-.9-2.6-2.6-.9 2.6-.9z" opacity=".8"/></svg>'
def chat(i): return f'<svg width="28" height="28" viewBox="0 0 24 24"><defs><linearGradient id="cb{i}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#6CC4FF"/><stop offset="1" stop-color="#1673FF"/></linearGradient></defs><path d="M15 9.6c3.4 0 6.1 2.2 6.1 4.9 0 1.4-.7 2.6-1.8 3.5l.5 2.5-2.9-1.4c-.6.2-1.2.3-1.9.3-3.4 0-6.1-2.2-6.1-4.9s2.7-4.9 6.1-4.9z" fill="#B9DBFF"/><path d="M9.6 3.2c-4 0-7.2 2.6-7.2 5.8 0 1.7.9 3.2 2.3 4.2l-.6 3 3.5-1.7c.6.2 1.3.2 2 .2 4 0 7.2-2.6 7.2-5.8S13.6 3.2 9.6 3.2z" fill="url(#cb{i})"/><circle cx="6.8" cy="9" r="1" fill="#fff"/><circle cx="9.6" cy="9" r="1" fill="#fff"/><circle cx="12.4" cy="9" r="1" fill="#fff"/></svg>'
pub=f'<svg {W}><path d="M12 2.6l8.4 4.7L12 12 3.6 7.3z" fill="#FFE2A8"/><path d="M3.6 7.3L12 12v9.4l-8.4-4.7z" fill="#fff" opacity=".95"/><path d="M20.4 7.3L12 12v9.4l8.4-4.7z" fill="#fff" opacity=".7"/><path d="M7.8 4.9l8.4 4.7v3.2" stroke="#FF8A00" stroke-width="1.6" fill="none" stroke-linecap="round" opacity=".7"/></svg>'
rb=f'<svg {W} fill="none" stroke="#fff" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"><path d="M3.8 4.8v4.4h4.4"/><path d="M4.2 9.2A8.3 8.3 0 1 1 3.9 13.6"/><path d="M12 8v4.2l2.7 1.7"/></svg>'
sk=f'<svg {W}><path d="M12 13.2l8.6-4.4L12 4.4 3.4 8.8z" fill="#fff"/><path d="M3.4 12.6L12 17l8.6-4.4" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" opacity=".75"/><path d="M3.4 16.2L12 20.6l8.6-4.4" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" opacity=".5"/></svg>'

def tabbar(sel,i):
    items=[('ai',ai,''),('chat',chat(i),'<b>4</b>'),('pub',pub,'<b>1</b>'),('rb',rb,''),('sk',sk,'')]
    h=''.join(f'<span class="tb{" on" if k==sel else ""}"><span class="ap ap-{k}">{svg}</span>{bd}</span>' for k,svg,bd in items)
    return f'<div class="tabbar glass">{h}</div>'

status='''<div class="sbar"><span>9:41</span><span class="sbi"><svg width="18" height="12" viewBox="0 0 18 12" fill="currentColor"><rect x="0" y="8" width="3" height="4" rx="1"/><rect x="5" y="5.5" width="3" height="6.5" rx="1"/><rect x="10" y="3" width="3" height="9" rx="1"/><rect x="15" y="0" width="3" height="12" rx="1"/></svg><svg width="16" height="12" viewBox="0 0 16 12" fill="currentColor"><path d="M8 2.2c2.4 0 4.6.9 6.2 2.5l1.2-1.2A10.4 10.4 0 0 0 8 .5 10.4 10.4 0 0 0 .6 3.5l1.2 1.2A8.7 8.7 0 0 1 8 2.2zm0 3.4c1.5 0 2.8.6 3.8 1.5L13 5.9a7 7 0 0 0-10 0l1.2 1.2c1-.9 2.3-1.5 3.8-1.5zM8 9l2-2a2.9 2.9 0 0 0-4 0z"/></svg><svg width="26" height="12" viewBox="0 0 26 12"><rect x=".5" y=".5" width="22" height="11" rx="3.5" fill="none" stroke="currentColor" opacity=".4"/><rect x="2" y="2" width="17" height="8" rx="2" fill="currentColor"/><rect x="23.5" y="4" width="1.5" height="4" rx=".75" fill="currentColor" opacity=".4"/></svg></span></div>'''

def av(nm,gr,st,size=40):
    return f'<span class="av2" style="width:{size}px;height:{size}px;background:linear-gradient(150deg,{gr})">{nm}<i style="background:var(--{st})"></i></span>'
def row(nm,gr,st,title,src,sub,right='',subc='',prog=None,on=False):
    pg=f'<span class="pg"><i style="width:{prog}%;background:var(--teal)"></i></span>' if prog else ''
    return f'''<div class="lr{' on' if on else ''}">{av(nm,gr,st)}<div class="grow mn"><div class="row g6"><span class="lt ell grow">{title}</span>{right}</div><div class="row g6" style="margin-top:3px"><span class="sc sc-{src}">{'Tita' if src=='t' else 'Jira'}</span><span class="ls ell" {subc}>{sub}</span></div>{pg}</div></div>'''

