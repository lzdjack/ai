// <div class="shot" data-s="before|after" data-cap="修复前 · 0:18"> → 浅色 Tita 被测页面截图
(function(){
var bar='<div class="bar"><i></i>审批中心 · 发起审批</div>';
var head='<div style="font-size:12px;font-weight:600">选择审批人</div><div class="tb"><span>研发中心</span><span class="on">产品部</span><span>销售部</span></div>';
var B='<div class="tita">'+bar+'<div class="modal">'+head+'<div class="p"><span class="pa"></span><span class="ln" style="width:36%"></span></div><div class="p"><span class="pa"></span><span class="ln" style="width:50%"></span></div><div class="p"><span class="pa"></span><span class="ln" style="width:28%"></span></div><div class="p"><span class="pa"></span><span class="ln" style="width:42%"></span></div></div><div class="frz"><div class="sp"></div><span class="msg">页面无响应</span></div></div>';
var ppl=[['#FFE2C7','周雨桐','产品经理'],['#D6F2E6','何嘉明','产品总监'],['#E5DEFF','沈一帆','设计师'],['#FFE0E6','陆知夏','产品运营']];
var A='<div class="tita">'+bar+'<div class="modal">'+head+ppl.map(function(p){return '<div class="p"><span class="pa" style="background:'+p[0]+'"></span><span>'+p[1]+'</span><span style="margin-left:auto;color:#8F959E">'+p[2]+'</span></div>'}).join('')+'</div></div>';
document.querySelectorAll('.shot[data-s]').forEach(function(el){
  var a=el.dataset.s==='after';
  var cap=el.dataset.cap||(a?'修复后 · 0:41':'修复前 · 0:18');
  el.innerHTML=(a?A:B)+(cap==='none'?'':'<span class="tagx'+(a?' ok':'')+'">'+cap+'</span>')+'<span class="playb"><svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor"><path d="M6 3l14 9-14 9z"/></svg></span>';
});
})();
