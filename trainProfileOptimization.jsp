<%@ page language="java" contentType="text/html; charset=ISO-8859-1" pageEncoding="ISO-8859-1" %>
<%@taglib prefix="c" uri="http://java.sun.com/jsp/jstl/core"%>

<style>
.route-card{background:#fff;border:1px solid #ddd;border-radius:8px;padding:20px;margin-top:15px;overflow-x:auto;border-radius: 8px !important;}.route-title{font-size:12px;font-weight:600;color:#888;margin-bottom:20px;letter-spacing:1px}.route-wrapper{position:relative;display:flex;justify-content:space-between;align-items:flex-start;min-width:max-content;padding-top:5px}.main-route-line{position:absolute;top:9px;left:30px;right:30px;height:2px;background:#bdbdbd;z-index:0}.route-node{position:relative;z-index:2;width:60px;display:flex;flex-direction:column;align-items:center;flex-shrink:0}.route-dot{width:10px;height:10px;border-radius:50%;background:#bdbdbd;margin-bottom:10px}.route-dot-active{width:12px;height:12px;border-radius:50%;background:#007bff;margin-bottom:10px}.route-label,.route-label-active{font-size:11px;transform:rotate(35deg);white-space:nowrap;margin-top:2px}.route-label{color:#999}.route-label-active{color:#007bff;font-weight:bold}
#trnTabs{margin-top:20px;display:flex;gap:10px;padding-left:0}#trnTabs li{list-style:none}#trnTabs li a{display:block;padding:10px 18px;background:#f1f1f1;border-radius:8px !important;text-decoration:none}#trnTabs li.active a{background:#337ab7;color:#fff;border-radius:8px !important}
.profileCards{display:grid;grid-template-columns:repeat(4,minmax(130px,1fr));gap:10px;margin-top:12px}.profileCard{background:#f8f8f8;border:1px solid #ddd;border-radius:8px;padding:12px}.cardLabel{font-size:11px;color:#666}.cardValue{font-size:22px;font-weight:700}.sectionHeading{margin-top:14px;font-weight:700}.dropdown-wrap{position:relative}.train-dropdown{position:absolute;left:0;right:0;top:100%;background:#fff;border:1px solid #ddd;z-index:1000;max-height:240px;overflow:auto}.train-dropdown-item{padding:8px 10px;cursor:pointer}.train-dropdown-item:hover{background:#f1f7ff}
.profileTopBar{display:flex;justify-content:space-between;align-items:center;margin-top:10px}.classPills{display:flex;gap:8px;flex-wrap:wrap}.classPill{padding:5px 12px;border:1px solid #337ab7;border-radius:16px;cursor:pointer;color:#337ab7}.classPill.active{background:#337ab7 !important;color:#fff !important}.form-control,.btn,.modeBtn,.train-dropdown-item{border-radius:8px !important}
#fetchTrainBtn,#showUtilizationBtn{background:#337ab7 !important;border-color:#337ab7 !important;color:#fff !important}#fetchTrainBtn[disabled]{opacity:.8;cursor:not-allowed}
.berthChartMain{width:100%}.quotaRow{display:grid;grid-template-columns:60px 1fr;gap:10px;margin-bottom:10px;align-items:start}.quotaLabel{font-size:12px;font-weight:700;color:#555;padding-top:8px}.quotaBars{width:100%}.barTrack{position:relative;width:100%;height:24px;background:#f2f2f2;border-radius:3px;margin-bottom:8px;border:1px solid #e1e1e1}.berthBar{position:absolute;top:0;height:100%;background:#fff;border:1.5px solid;border-radius:3px;padding:3px 8px;font-size:11px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.demand-filter-card{background:#f5f5f5;border-radius:8px !important;padding:15px;margin-bottom:20px}.filter-row{display:flex;flex-wrap:nowrap;gap:12px;align-items:end;overflow-x:auto;white-space:nowrap}.filter-item{min-width:130px}.filter-item label{display:block;font-size:11px;font-weight:600;color:#777;margin-bottom:5px;text-transform:uppercase}.apply-btn-wrap{margin-left:auto}.toggle-group{display:flex}.modeBtn{border:1px solid #d0d0d0;background:#fff;padding:7px 14px;cursor:pointer}.modeBtn:first-child{border-radius:8px 0 0 8px !important}.modeBtn:last-child{border-radius:0 8px 8px 0 !important}.modeBtn.active{background:#2f5bea;color:#fff}
.stats-grid{display:grid;grid-template-columns:repeat(6,1fr);gap:15px;margin-bottom:20px}.stat-card{background:#f7f7f7;border:1px solid #ddd;border-radius:8px !important;padding:18px}.stat-card span{font-size:11px;color:#888;display:block;margin-bottom:8px}.stat-card h3{margin:0;font-size:28px;font-weight:700}.stat-card small{color:#999}.danger{color:#d9534f}.success{color:#2e8b57}.chart-card{background:#fff;border:1px solid #ddd;border-radius:8px !important;padding:20px}.chart-header{display:flex;justify-content:space-between;align-items:center;margin-bottom:15px}.chart-header h4{margin:0;font-weight:600}.chart-legend{font-size:13px}.dot{width:10px;height:10px;border-radius:50%;display:inline-block;margin-left:12px}.weekday{background:#2f5bea}.weekend{background:#d97706}.holiday{background:#16a34a}#demandChart{width:100% !important;height:350px !important}
.utilization-section-title{font-size:12px;font-weight:700;color:#888;letter-spacing:1px;margin:24px 0 12px}
.utilization-filter-label{font-size:11px;font-weight:600;color:#777;margin-bottom:4px;display:block}
.utilization-chart-card{background:#fff;border:1px solid #e3e6ef;border-radius:10px;padding:18px;margin-bottom:16px}
.utilization-chart-title{font-size:14px;font-weight:600;color:#333;margin:0 0 12px}
.utilization-summary-cards{display:grid;grid-template-columns:repeat(5,minmax(140px,1fr));gap:12px;margin-bottom:16px}
.utilization-summary-card{background:#fff;border:1px solid #e3e6ef;border-radius:10px;padding:16px;min-height:92px}
.utilization-summary-label{font-size:11px;font-weight:600;color:#888;letter-spacing:.5px;margin-bottom:8px}
.utilization-summary-value{font-size:26px;font-weight:700;line-height:1.1}
.utilization-summary-sub{font-size:11px;color:#999;margin-top:6px}
.util-value-green{color:#1e9b57}
.util-value-red{color:#d64545}
.util-value-dark{color:#222}
.utilization-charts-row{display:grid;grid-template-columns:1fr 1fr;gap:16px}
.util-paired-charts-row{align-items:stretch}
.util-paired-chart-card{display:flex;flex-direction:column;height:100%;min-width:0;max-width:100%;overflow:hidden}
.util-paired-chart-wrap,.util-detail-paired-wrap,.util-timeline-chart-wrap{position:relative;width:100%;height:220px}
.util-chart-wrap canvas{display:block;width:100%!important;height:100%!important}
.util-prediction-banner{display:inline-flex;align-items:center;gap:10px;padding:9px 16px 9px 10px;border-radius:999px;font-size:12px;color:#3d4f6f;line-height:1.35;flex:1;min-width:240px;}
.util-prediction-icon{width:28px;height:28px;border-radius:50%;background:linear-gradient(135deg,#1B4FD8,#5B7FE8);color:#fff;display:inline-flex;align-items:center;justify-content:center;font-size:13px;flex-shrink:0;box-shadow:0 2px 6px rgba(27,79,216,.22)}
.util-prediction-text{display:flex;flex-direction:column;gap:1px}
.util-prediction-text strong{font-size:12px;font-weight:700;color:#1f2f4d;letter-spacing:.01em}
.util-prediction-text span{font-size:11px;color:#5b6b82}
.util-chart-wrap{width:100%}
.utilization-detail-row{margin-top:8px;min-width:0}
.utilization-detail-left{padding-right:8px;min-width:0}
.utilization-detail-right{padding-left:8px;min-width:0;overflow:hidden}
.util-segment-list{max-height:845px;overflow-y:auto;padding-right:4px}
.util-segment-item{display:grid;grid-template-columns:92px 1fr 52px;gap:10px;align-items:center;margin-bottom:12px}
.util-segment-name{font-size:12px;font-weight:600;color:#333}
.util-segment-bar-wrap{height:12px;background:#EFEFED;border-radius:6px;overflow:hidden;margin:0 4px}
.util-segment-bar{height:100%;border-radius:999px}
.util-segment-bar.green{background:#1e9b57}
.util-segment-bar.orange{background:#d68b2b}
.util-segment-pct{font-size:12px;font-weight:700;color:#333;text-align:right}
.util-seg-all-btn{display:inline-block;vertical-align:middle;margin:0 6px 0 4px;padding:2px 10px;font-size:11px;font-weight:700;line-height:1.4;color:#555;background:#fff;border:1px solid #c5c9d3;border-radius:4px;cursor:pointer}
.util-seg-all-btn:hover{background:#E8F6EE;border-color:#1e9b57;color:#0f6b3a}
.util-seg-all-btn.active{color:#fff;background:#1e9b57;border-color:#1e9b57}
.util-scroll-chart-outer{display:block;width:100%;max-width:100%;min-width:0;height:278px;max-height:278px;overflow-x:auto;overflow-y:hidden;-webkit-overflow-scrolling:touch}
.util-od-scroll-outer{height:258px;max-height:258px}
.util-scroll-chart-inner{position:relative;height:260px;box-sizing:border-box;padding-bottom:4px}
.util-od-scroll-outer .util-scroll-chart-inner{height:240px}
.util-scroll-chart-inner canvas{display:block;width:100%!important;height:100%!important}
.util-detail-grid{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:16px;min-width:0;width:100%}
.util-detail-grid>.utilization-chart-card{min-width:0;max-width:100%;overflow:hidden}
.util-chart-subtitle{font-size:13px;font-weight:600;color:#333;margin:0 0 10px}
.util-chart-subtitle .util-ctx{color:#2d5bff}
@media (max-width:992px){.utilization-summary-cards{grid-template-columns:1fr 1fr}.utilization-charts-row{grid-template-columns:1fr}.utilization-detail-left,.utilization-detail-right{padding:0}.util-detail-grid{grid-template-columns:1fr}}
@media (max-width:576px){.utilization-summary-cards{grid-template-columns:1fr}}
.opt-section-title{font-size:18px;font-weight:700;color:#222;margin:0}
.opt-section-sub{font-size:13px;color:#888;margin:4px 0 16px}
.opt-summary-cards{display:grid;grid-template-columns:repeat(4,minmax(160px,1fr));gap:12px;margin-bottom:16px}
.opt-summary-card{background:#fff;border:1px solid #e3e6ef;border-radius:10px;padding:16px}
.opt-summary-label{font-size:11px;font-weight:600;color:#888;letter-spacing:.5px}
.opt-summary-value{font-size:28px;font-weight:700;margin-top:6px}
.opt-summary-sub{font-size:12px;color:#999;margin-top:4px}
.opt-remotes-section{margin-bottom:12px;padding:10px 12px;background:#fafbfe;border:1px solid #e8ecf4;border-radius:10px}
.opt-remotes-head{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:8px;flex-wrap:wrap}
.opt-remotes-label{font-size:11px;font-weight:700;color:#667085;letter-spacing:.05em;text-transform:uppercase}
.opt-remote-hint{font-size:10px;color:#98a2b3;font-weight:600}
.opt-remote-pills{display:flex;flex-wrap:wrap;gap:6px;min-height:28px;margin-bottom:8px}
.opt-remote-pill{position:relative;display:inline-flex;align-items:center;gap:4px;border:1px solid transparent;border-radius:999px;padding:4px 18px 4px 10px;font-size:11px;font-weight:700;line-height:1.25;font-family:inherit;cursor:pointer;transition:background .15s,border-color .15s,color .15s}
.opt-remote-current{background:#e8f0ff;color:#1b4fd8;border-color:#c5d4f7}
.opt-remote-current:hover{box-shadow:0 1px 4px rgba(27,79,216,.12)}
.opt-remote-added{background:#e6f5ee;color:#0a7c4e;border-color:#b7e4cb}
.opt-remote-pill-x{position:absolute;top:0;right:4px;font-size:12px;line-height:1;opacity:.65;cursor:pointer}
.opt-remote-pill-x:hover{opacity:1}
.opt-remote-empty{font-size:11px;color:#98a2b3}
.opt-remote-add-row{display:flex;align-items:center;gap:6px;flex-wrap:wrap}
.opt-remote-select{width:180px;max-width:100%;height:28px;font-size:11px;padding:2px 6px}
.opt-remote-add-row .btn{min-width:28px;padding:3px 8px;height:28px}
.opt-remote-removed-wrap{margin-top:8px;padding-top:8px;border-top:1px dashed #e8ecf4}
.opt-remote-removed-head{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:6px}
.opt-remote-removed-label{font-size:10px;font-weight:700;color:#c0392b;text-transform:uppercase;letter-spacing:.04em}
.opt-remote-removed-label .fa{margin-right:4px}
.opt-remote-removed-hint{font-size:10px;color:#98a2b3;font-weight:600}
.opt-remote-pills-removed{margin-bottom:0}
.opt-remote-removed{background:#fdecea;color:#c0392b;border-color:#f5c6c0;padding-right:26px;cursor:default}
.opt-remote-restore{position:absolute;top:50%;right:5px;transform:translateY(-50%);border:none;background:transparent;color:#c0392b;font-size:10px;line-height:1;padding:0;cursor:pointer;opacity:.75}
.opt-remote-restore:hover{opacity:1}
.opt-table-card{background:#fff;border:1px solid #e3e6ef;border-radius:10px;padding:16px;margin-bottom:16px}
.opt-compare-card{background:#fff;border:1px solid #e3e6ef;border-radius:10px;padding:18px;margin-bottom:16px}
.opt-cmp-grid{display:grid;grid-template-columns:1fr 72px 1fr;border:1px solid #e3e6ef;border-radius:10px;overflow:hidden;margin-bottom:16px}
.opt-cmp-col{padding:20px 24px}
.opt-cmp-col.current{background:#fff}
.opt-cmp-col.proposed{background:#eef3ff}
.opt-cmp-delta{padding:20px 10px;background:#f5f5f5;border-left:1px solid #e3e6ef;border-right:1px solid #e3e6ef;display:flex;flex-direction:column;align-items:center}
.opt-cmp-title{font-size:10px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;padding-bottom:10px;margin-bottom:16px;border-bottom:2px solid;width:100%}
.opt-cmp-col.current .opt-cmp-title{color:#888;border-color:#ddd}
.opt-cmp-col.proposed .opt-cmp-title{color:#1b4fd8;border-color:rgba(27,79,216,.3)}
.opt-cmp-delta .opt-cmp-title{text-align:center;border-color:#ddd;color:#888}
.opt-cmp-metric{margin-bottom:14px}
.opt-cmp-metric .lbl{font-size:10px;text-transform:uppercase;letter-spacing:.05em;color:#888;margin-bottom:3px}
.opt-cmp-metric .val{font-size:20px;font-weight:700}
.opt-cmp-col.current .val{color:#555}
.opt-cmp-col.proposed .val{color:#1b4fd8}
.opt-cmp-delta-row .val{font-size:12px;font-weight:700;text-align:center}
.opt-cmp-delta-row .lbl{visibility:hidden}
.opt-delta-good{color:#0a7c4e}
.opt-delta-warn{color:#d97706}
.opt-delta-neutral{color:#888}
.opt-profile-table{width:100%;border-collapse:collapse;font-size:13px}
.opt-profile-table th,.opt-profile-table td{padding:8px 12px;border-bottom:1px solid #eee;text-align:left}
.opt-profile-table th{font-size:11px;color:#888;font-weight:600;text-transform:uppercase}
.opt-profile-table tr:hover td{background:#fafafa}
.opt-berth-input{width:65px;padding:4px 8px;border:1px solid #ccc;border-radius:4px;text-align:center;font-size:12px}
.opt-edit-select{width:100%;min-width:72px;padding:4px 6px;border:1px solid #ccc;border-radius:4px;font-size:11px;background:#fff}
.opt-del-row{padding:0 6px;color:#c0392b}
.opt-del-row:disabled{color:#ccc}
.opt-add-row{padding:0;font-size:12px;font-weight:600}
.opt-add-row:disabled{color:#aaa}
.opt-berth-toolbar{display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;flex-wrap:wrap;gap:8px}
.opt-berth-toolbar-actions{font-size:12px}
.opt-berth-toolbar-actions a{color:#2d5bff;text-decoration:none}
.opt-berth-toolbar-actions a.disabled{color:#aaa}
.opt-berth-sep{color:#ccc;margin:0 6px}
.opt-berth-summary{display:flex;flex-wrap:wrap;gap:8px;margin-bottom:14px}
.opt-berth-summary-pill{display:inline-flex;align-items:center;gap:6px;background:#f4f6fb;border:1px solid #e3e6ef;border-radius:20px;padding:5px 12px;font-size:11px;font-weight:600;color:#555}
.opt-berth-summary-jump{cursor:pointer;font-family:inherit;transition:box-shadow .15s,transform .1s,background .15s}
.opt-berth-summary-jump:hover{box-shadow:0 2px 8px rgba(27,79,216,.12);transform:translateY(-1px);background:#eef3ff}
.opt-berth-summary-jump.active{box-shadow:0 0 0 2px #1b4fd8;background:#eef3ff;border-color:#c5d4f7}
.opt-berth-summary-total{background:#eef3ff;border-color:#c5d4f7;color:#1b4fd8}
.opt-berth-cls-panel{border:1px solid #e8ecf4;border-radius:10px;margin-bottom:10px;overflow:hidden}
.opt-berth-cls-head{width:100%;display:flex;align-items:center;gap:10px;padding:10px 14px;background:#fafbfe;border:none;text-align:left;cursor:pointer}
.opt-berth-cls-head:hover{background:#f0f4ff}
.opt-berth-cls-meta{flex:1;font-size:12px;color:#666}
.opt-berth-chevron{color:#888;font-size:11px;transition:transform .2s}
.opt-berth-chevron.open{transform:rotate(180deg)}
.opt-berth-cls-body{padding:12px 14px 10px;background:#fff}
.opt-berth-toolbar-sub{font-size:11px;color:#888;margin-top:4px}
.opt-quota-legend{display:flex;flex-wrap:wrap;gap:8px;margin-bottom:14px;padding:10px 12px;background:#fafbfe;border:1px solid #e8ecf4;border-radius:8px}
.opt-quota-legend-item{display:inline-flex;align-items:center;gap:6px;font-size:11px;font-weight:700;color:#444}
.opt-quota-legend-dot{width:10px;height:10px;border-radius:50%;background:var(--opt-quota-color,#7f7f7f);box-shadow:inset 0 0 0 1px rgba(0,0,0,.08)}
.opt-alloc-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:10px;margin-bottom:8px;align-items:stretch}
.opt-alloc-card{display:flex;flex-direction:column;min-height:96px;border:1px solid #e3e6ef;border-radius:8px;padding:8px 10px 6px 14px;background:#fff;position:relative;overflow:visible;transition:border-color .2s,box-shadow .2s}
.opt-alloc-card:hover{border-color:#c5d4f7;box-shadow:0 4px 12px rgba(27,79,216,.07)}
.opt-alloc-accent{position:absolute;left:0;top:0;bottom:0;width:4px;background:var(--opt-quota-color,#7f7f7f)}
.opt-alloc-card.opt-alloc-new{border-color:var(--opt-quota-color,#1f77b4);box-shadow:0 0 0 1px color-mix(in srgb,var(--opt-quota-color,#1f77b4) 25%,transparent)}
.opt-alloc-card.opt-alloc-modified{box-shadow:0 0 0 2px color-mix(in srgb,var(--opt-warning,#e67e22) 35%,transparent)}
.opt-alloc-card.opt-alloc-removed{opacity:.72;background:#f8fafc;border-color:#cbd5e1;border-style:dashed}
.opt-alloc-card.opt-alloc-removed .opt-alloc-accent{background:var(--opt-danger,#c0392b)!important}
.opt-alloc-removed .opt-alloc-badge{background:var(--opt-danger,#c0392b);color:#fff}
.opt-alloc-new .opt-alloc-badge{background:var(--opt-info,#1b4fd8);color:#fff}
.opt-alloc-modified .opt-alloc-badge{background:var(--opt-warning,#e67e22);color:#fff}
.opt-alloc-card.opt-alloc-invalid{border-color:var(--opt-danger,#c0392b);box-shadow:0 0 0 1px rgba(192,57,43,.2)}
.opt-alloc-card.opt-alloc-focus{animation:optAllocPulse 1.2s ease 2}
@keyframes optAllocPulse{0%,100%{box-shadow:0 0 0 0 rgba(10,124,78,.35)}50%{box-shadow:0 0 0 5px rgba(10,124,78,0)}}
.opt-alloc-badge{position:absolute;top:6px;right:6px;max-width:58%;font-size:8px;font-weight:700;letter-spacing:.03em;padding:2px 5px;border-radius:4px;text-transform:none;line-height:1.25;text-align:right;z-index:1}
.opt-alloc-new .opt-alloc-badge{background:var(--opt-success,#0a7c4e);color:#fff}
.opt-alloc-modified .opt-alloc-badge{background:var(--opt-warning,#e67e22);color:#fff}
.opt-alloc-row{display:flex;align-items:center;gap:6px}
.opt-alloc-row-top{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:6px;padding-right:36px}
.opt-alloc-quota-group{display:flex;align-items:center;gap:6px;flex:1 1 auto;min-width:0;max-width:calc(100% - 108px);overflow:visible}
.opt-alloc-card .opt-quota-pill{display:none}
.opt-edit-quota-select{display:block;width:100%;min-width:0;height:28px;flex:1;font-size:11px;font-weight:600;padding:4px 28px 4px 8px;border-radius:5px;border:1px solid #c5d4f7;border-left:3px solid var(--opt-quota-color,#7f7f7f);background:#fff;color:#222;line-height:1.3;cursor:pointer;appearance:auto;-webkit-appearance:menulist;box-sizing:border-box}
.opt-edit-quota-select:disabled{background:#f4f6fb;color:#888;cursor:not-allowed}
.opt-alloc-berths-compact{display:flex;align-items:center;gap:4px;background:#f4f6fb;border-radius:6px;padding:3px 8px;flex:0 0 auto;margin-left:auto}
.opt-alloc-berths-label{font-size:9px;font-weight:700;color:#666;text-transform:uppercase;letter-spacing:.04em}
.opt-alloc-berths-compact .opt-berth-input{width:52px;font-size:13px;font-weight:700;padding:3px 5px;border-radius:5px;border-color:#c5d4f7;text-align:center}
.opt-alloc-row-route{margin-bottom:4px}
.opt-alloc-row-route .opt-stn-select{flex:1;min-width:0;font-size:11px;font-weight:600;padding:4px 6px;border-radius:5px;border-color:#d8deea;background:#f8faff}
.opt-alloc-arrow{color:#6b7a90;font-size:11px;font-weight:700;flex-shrink:0}
.opt-alloc-footer{display:flex;align-items:center;justify-content:space-between;gap:6px;margin-top:2px;min-height:22px}
.opt-alloc-diff{font-size:10px;color:#888}
.opt-alloc-diff strong{color:#555}
.opt-alloc-error{font-size:10px;color:var(--opt-danger,#c0392b);font-weight:600;flex:1}
.opt-alloc-card .opt-del-row{padding:0;font-size:10px;color:var(--opt-danger,#c0392b);margin-left:auto;flex-shrink:0}
.opt-alloc-card .opt-del-row:hover{color:#922b21}
.opt-cls-modified-count{color:#e67e22;font-weight:700}
.opt-cls-removed-count{color:var(--opt-danger,#c0392b);font-weight:700}
.opt-alloc-card .opt-restore-row{padding:0;font-size:10px;color:var(--opt-info,#1b4fd8);margin-left:auto;flex-shrink:0}
.opt-berth-cls-warn{font-size:11px;font-weight:700;color:#e67e22;white-space:nowrap}
.opt-action-bar-spacer{display:none}
.opt-footer-compact{margin-top:16px;padding-top:12px;border-top:1px solid #e3e6ef}
.opt-change-summary-panel{display:none;margin-bottom:10px;padding:8px 12px;background:#f8faff;border:1px solid #e3e6ef;border-radius:8px}
.opt-change-summary-inner{display:flex;justify-content:center;align-items:center;gap:16px;flex-wrap:wrap}
.opt-change-summary-item{display:flex;flex-direction:column;align-items:center;gap:2px;font-size:11px;color:#666}
.opt-change-summary-item .lbl{font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:#888}
.opt-change-summary-item strong{font-size:14px;font-weight:700;color:#333}
.opt-summary-success strong{color:var(--opt-success,#0a7c4e)}
.opt-summary-warning strong{color:var(--opt-warning,#e67e22)}
.opt-summary-danger strong{color:var(--opt-danger,#c0392b)}
.opt-summary-positive strong{color:var(--opt-success,#0a7c4e)}
.opt-summary-negative strong{color:var(--opt-danger,#c0392b)}
.opt-summary-neutral strong{color:#64748b}
:root{--opt-success:#0a7c4e;--opt-warning:#e67e22;--opt-danger:#c0392b;--opt-info:#1b4fd8;--opt-neutral:#64748b}
.opt-action-bar{display:flex;justify-content:flex-end;align-items:center;padding:0}
.opt-action-bar .btn{min-width:160px;font-weight:600;border-radius:8px;padding:8px 18px}
.opt-cls-badge{display:inline-block;font-size:10px;font-weight:600;padding:2px 7px;border-radius:3px}
.opt-cls-badge.cb-1a{background:#fdecea;color:#9b1c1c}
.opt-cls-badge.cb-2a{background:#fef3c7;color:#92400e}
.opt-cls-badge.cb-3a{background:#eef3ff;color:#1239a6}
.opt-cls-badge.cb-sl{background:#e6f5ee;color:#0a7c4e}
.opt-charts-row{display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:16px}
.opt-charts-row-single{grid-template-columns:1fr}
.opt-berth-compare-card{margin-bottom:16px}
.opt-berth-diff-card{margin-bottom:16px}
.opt-berth-compare-header{display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:12px;margin-bottom:10px}
.opt-berth-compare-title-wrap{display:flex;flex-direction:column;gap:8px}
.opt-berth-compare-date{font-size:12px;color:#666;white-space:nowrap}
.opt-berth-diff-summary{display:flex;flex-wrap:wrap;align-items:center;gap:8px;margin-bottom:10px;padding:8px 10px;background:#f8faff;border:1px solid #e3e6ef;border-radius:8px}
.opt-diff-summary-total{font-size:12px;color:#444;margin-right:4px}
.opt-diff-summary-chip{font-size:10px;font-weight:700;padding:3px 8px;border-radius:12px;background:#eef2f7;color:#556}
.opt-diff-chip-added{background:#e6f5ee;color:#0a7c4e}
.opt-diff-chip-removed{background:#fdecea;color:#c0392b}
.opt-diff-chip-up{background:#e8f4fd;color:#1b4fd8}
.opt-diff-chip-down{background:#fff4e6;color:#e67e22}
.opt-diff-net-up{background:#e6f5ee;color:#0a7c4e}
.opt-diff-net-down{background:#fdecea;color:#c0392b}
.opt-berth-diff-impact{display:flex;align-items:center;flex-wrap:wrap;gap:6px;margin:-2px 0 8px}
.opt-impact-label{font-size:10px;font-weight:700;color:#667085;text-transform:uppercase;letter-spacing:.04em}
.opt-berth-diff-toolbar{display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;margin-bottom:8px;font-size:11px;color:#666}
.opt-berth-diff-toggle{display:flex;align-items:center;gap:6px;margin:0;font-weight:600;cursor:pointer}
.opt-berth-diff-toggle input{margin:0}
.opt-berth-diff-legend{display:flex;gap:12px;font-size:10px;font-weight:600;color:#888}
.opt-diff-legend-swatch{display:inline-block;width:14px;height:8px;border-radius:2px;vertical-align:middle;margin-right:4px}
.opt-diff-legend-cur{background:#94a3b8;border:1px dashed #64748b}
.opt-diff-legend-prop{background:#1f77b455;border:1px solid #1f77b4}
.opt-berth-diff-body{border:1px solid #e3e6ef;border-radius:8px;background:#fff;max-height:320px;overflow-y:auto}
.opt-berth-diff-empty{padding:16px;text-align:center;font-size:12px}
.opt-diff-row{display:grid;grid-template-columns:52px 88px 1fr 72px 58px;gap:8px;align-items:center;padding:6px 10px;border-bottom:1px solid #f0f2f6;font-size:11px}
.opt-diff-row:last-child{border-bottom:none}
.opt-diff-row:hover{background:#fafbfe}
.opt-diff-quota{font-weight:700;font-size:10px}
.opt-diff-route{font-weight:600;color:#555;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.opt-diff-track{position:relative;height:22px;background:#f4f6fb;border-radius:4px;min-width:0}
.opt-diff-bar{position:absolute;top:2px;height:18px;border-radius:3px;box-sizing:border-box;font-size:9px;font-weight:700;line-height:16px;text-align:center;overflow:hidden;white-space:nowrap;text-overflow:ellipsis;padding:0 4px}
.opt-diff-bar-cur{background:#94a3b844;border:1px dashed #64748b;z-index:1}
.opt-diff-bar-prop{border:1px solid;z-index:2;min-width:18px}
.opt-diff-added .opt-diff-bar-prop{box-shadow:0 0 0 2px rgba(10,124,78,.25)}
.opt-diff-removed .opt-diff-bar-cur{background:#c0392b22;border-color:#c0392b}
.opt-diff-berths{font-weight:700;color:#333;text-align:right;white-space:nowrap}
.opt-diff-badge{display:inline-block;font-size:9px;font-weight:700;padding:2px 6px;border-radius:10px;text-align:center;white-space:nowrap}
.opt-diff-badge-added{background:#0a7c4e;color:#fff}
.opt-diff-badge-removed{background:#c0392b;color:#fff}
.opt-diff-badge-up{background:#e8f4fd;color:#1b4fd8}
.opt-diff-badge-down{background:#fff4e6;color:#e67e22}
.opt-diff-badge-same{background:#eef2f7;color:#888}
.opt-analysis-tools{display:flex;flex-wrap:wrap;gap:8px;margin-top:12px;padding-top:12px;border-top:1px solid #e3e6ef}
.opt-metrics-toggle{font-size:11px;font-weight:600;border-radius:6px!important;padding:6px 12px!important;color:#1b4fd8;border-color:#c5d4f7;background:#f8faff}
.opt-metrics-toggle:hover{background:#eef3ff;color:#1239a6}
.opt-metrics-chevron{font-size:10px;margin-left:4px;transition:transform .2s}
.opt-metrics-chevron.open{transform:rotate(180deg)}
.opt-util-metrics-panel{margin-top:10px;padding:10px;background:#fafbfe;border:1px solid #e3e6ef;border-radius:8px}
.opt-util-metrics-panel .opt-compare-card-inline{border:none;padding:0;margin:0;box-shadow:none}
.opt-chart-compact{margin-top:10px;padding:10px;background:#fff;border:1px solid #e3e6ef;border-radius:8px}
.opt-chart-compact-canvas{height:220px;position:relative}
.opt-compare-card-inline .opt-cmp-grid{margin-top:0}
.berth-allocation-panel{background:#fff;border:1px solid #dcdcdc;border-radius:8px;padding:14px;overflow-x:auto}
.berth-alloc-row{display:grid;grid-template-columns:72px 1fr;gap:12px;align-items:center;margin-bottom:10px}
.berth-alloc-quota{font-size:11px;font-weight:700;word-break:break-word}
.berth-alloc-track{position:relative;height:30px;border-radius:4px}
.berth-alloc-bar{position:absolute;height:100%;border:1px solid;border-radius:4px;font-size:11px;font-weight:600;padding:6px 10px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;box-sizing:border-box}
@media (max-width:1200px){.opt-alloc-grid{grid-template-columns:repeat(auto-fit,minmax(260px,1fr))}.opt-alloc-quota-group{max-width:calc(100% - 100px)}}
@media (max-width:992px){.opt-summary-cards{grid-template-columns:1fr 1fr}.opt-cmp-grid{grid-template-columns:1fr}.opt-charts-row{grid-template-columns:1fr}.opt-diff-row{grid-template-columns:44px 72px 1fr 64px 52px;gap:6px}}
</style>
<div class="page-content-wrapper" id="pageContentDiv">
    <div class="page-content">

        <div class="page-bar">
            <ul class="page-breadcrumb">
                <li>
                    <a href="home">Home</a>
                    <i class="fa fa-circle"></i>
                </li>
                <li>
                    <a href="predictivemainpage">Predictive Analytics</a>
                </li>
            </ul>
        </div>

        <div class="row" style="padding-top:10px;">
            <div class="col-md-12">

                <div class="portlet box green">

                    <div class="portlet-title">
                        <div class="caption">
                            <i class="fa fa-globe"></i>
                            Train Profile Optimization
                        </div>
                    </div>

                    <div class="portlet-body">

                        <div class="row">

                            <div class="col-md-4 dropdown-wrap">
                                <label for="trnNo">Train Number</label>

                                <input
                                    type="text"
                                    class="form-control"
                                    id="trnNo"
                                    placeholder="Enter Train Number / Name"
                                >

                                <div
                                    id="trainDropdown"
                                    class="train-dropdown"
                                    style="display:none;position: relative;border-radius: 8px !important;"
                                ></div>
                            </div>

                            <div class="col-md-2" style="margin-top:25px;">
                                <button
                                    id="fetchTrainBtn"
                                    class="btn btn-primary form-control"
                                >
                                    Fetch Train
                                </button>
                            </div>

                        </div>

                        <div id="trainDetailsSection" style="display:none;margin-top:20px;">
                            <div id="trainInfo"></div>

                            <div id="routeInfo" style="margin-top:20px;"></div>
                        </div>

                        <div id="tabsSection" style="display:none;margin-top:20px;">

                            <ul class="nav nav-tabs customTabs" id="trnTabs">
                                <li class="active">
                                    <a href="#tab1" data-toggle="tab">
                                        Current Profile
                                    </a>
                                </li>

                                <li>
                                    <a href="#tab2" data-toggle="tab">
                                        Upcoming Demand
                                    </a>
                                </li>

                                <li>
                                    <a href="#tab3" data-toggle="tab">
                                        Optimization
                                    </a>
                                </li>
                            </ul>

                            <div class="tab-content customTabContent">

                                <!-- TAB 1 -->
                                <div id="tab1" class="tab-pane fade in active">

                                    <div class="profileTopBar">

                                        <div id="classPills" class="classPills"></div>

                                        <div class="profileDate">
                                            Profile Date :
                                            <b id="profileDateText">--</b>
                                        </div>

                                    </div>

                                    <div class="profileCards">

                                        <div class="profileCard">
                                            <div class="cardLabel">
                                                PHYSICAL BERTHS
                                            </div>

                                            <div
                                                class="cardValue"
                                                id="physicalBerthsCount"
                                            >
                                                0
                                            </div>
                                        </div>

                                        <div class="profileCard">
                                            <div class="cardLabel">
                                                ALLOCATED
                                            </div>

                                            <div
                                                class="cardValue"
                                                id="allocatedCount"
                                            >
                                                0
                                            </div>
                                        </div>

                                        <div class="profileCard">
                                            <div class="cardLabel">
                                                QUOTAS
                                            </div>

                                            <div
                                                class="cardValue"
                                                id="quotaCount"
                                            >
                                                0
                                            </div>
                                        </div>

                                        <div class="profileCard">
                                            <div class="cardLabel">
                                                SPANS
                                            </div>

                                            <div
                                                class="cardValue"
                                                id="spanCount"
                                            >
                                                0
                                            </div>
                                        </div>

                                    </div>

                                    <div class="sectionHeading">
                                        BERTH ALLOCATION BY QUOTA
                                    </div>

                                    <div
                                        id="berthAllocationWrap"
                                        style="margin-top:10px;"
                                    ></div>
									
									<!-- Utilization Filters -->
									<div class="row" style="margin-top:20px;">

									    <div class="col-md-2">
									        <label style="font-size:12px;font-weight:600;color:#777;">
									            FROM DATE
									        </label>

									        <input
									            type="date"
									            id="fromDate"
									            class="form-control"
												style="border-radius:8px !important"
									        >
									    </div>

									    <div class="col-md-2">
									        <label style="font-size:12px;font-weight:600;color:#777;">
									            TO DATE
									        </label>

									        <input
									            type="date"
									            id="toDate"
									            class="form-control"
												style="border-radius:8px !important"
									        >
									    </div>

									    <div class="col-md-6 col-sm-12" style="margin-top:13px;display:flex;align-items:center;gap:12px;flex-wrap:wrap;">
									        <button
									            id="showUtilizationBtn"
									            class="btn btn-primary"
									            style="
									                font-weight:600;
									                height:34px;
									                min-width:150px;
									                padding:0 16px;
									                flex-shrink:0;
									            "
									        >
									            Show Utilization
									        </button>
									        <div class="util-prediction-banner" role="note" title="Future-date utilization uses predicted data">
									            <span class="util-prediction-icon" aria-hidden="true">
									                <i class="fa fa-line-chart"></i>
									            </span>
									            <span class="util-prediction-text">
									                <strong>Future dates use predictive utilization</strong>
									                <span>Values beyond today are forecast-based, not historical actuals.</span>
									            </span>
									        </div>
									    </div>

									</div>

									<div id="utilizationChartsContainer" style="margin-top:10px;"></div>

                                </div>

                                <!-- TAB 2 -->
                                <div id="tab2" class="tab-pane fade">

    <div class="demand-filter-card">

        <div class="filter-row">

            <div class="filter-item">
                <label>FROM DATE</label>

                <input
                    type="date"
                    id="demandFrom"
                    class="form-control"
                >
            </div>

            <div class="filter-item">
                <label>TO DATE</label>

                <input
                    type="date"
                    id="demandTo"
                    class="form-control"
                >
            </div>

            <div class="filter-item">
                <label>CLASS</label>

                <select
                    id="demandClass"
                    class="form-control"
                ></select>
            </div>

            <div class="filter-item">
                <label>QUOTA</label>

                <select
                    id="demandQuota"
                    class="form-control"
                ></select>
            </div>

            <div class="filter-item">
                <label>FROM STN</label>

                <select
                    id="demandFromStn"
                    class="form-control"
                ></select>
            </div>

            <div class="filter-item">
                <label>TO STN</label>

                <select
                    id="demandToStn"
                    class="form-control"
                ></select>
            </div>

            <div class="filter-item">

                <label>AGGREGATION</label>

                <div class="toggle-group">

                    <button
                        type="button"
                        id="modeDaily"
                        class="modeBtn active"
                    >
                        Daily
                    </button>

                    <button
                        type="button"
                        id="modeWeekly"
                        class="modeBtn"
                    >
                        Weekly
                    </button>

                </div>

            </div>

            <div class="filter-item apply-btn-wrap">

                <button
                    id="applyDemandBtn"
                    class="btn btn-primary"
                >
                    Apply
                </button>

            </div>

        </div>

    </div>

    <div class="stats-grid">

        <div class="stat-card">
            <span>AVG / DAY PASSENGERS</span>

            <h3 id="avgDay">-</h3>
        </div>

        <div class="stat-card">
            <span>PEAK DEMAND</span>

            <h3
                class="danger"
                id="peakDemand"
            >
                -
            </h3>

            <small id="peakDate">-</small>
        </div>

        <div class="stat-card">
            <span>LOWEST DEMAND</span>

            <h3
                class="success"
                id="lowestDemand"
            >
                -
            </h3>

            <small id="lowestDate">-</small>
        </div>

        <div class="stat-card">
            <span>BUSIEST SEGMENT</span>

            <h3 id="busiestSegment">-</h3>

            <small>Top OD Pair</small>
        </div>

        <div class="stat-card">
            <span>TOP CLASS & QUOTA</span>

            <h3 id="topClassQuota">-</h3>

            <small>Highest volume drivers</small>
        </div>

        <div class="stat-card">
            <span>WEEKDAY VS WEEKEND AVERAGE</span>

            <h3 id="weekCompare">-</h3>

            <small>Passengers per day</small>
        </div>

    </div>

    <div class="chart-card">

        <div class="chart-header">

            <h4>Passenger Demand Over Time</h4>

            <div class="chart-legend">

                <span class="dot weekday"></span>
                Weekday

                <span class="dot weekend"></span>
                Weekend

                <span class="dot holiday"></span>
                Holiday

            </div>

        </div>

        <canvas id="demandChart"></canvas>

    </div>

</div>
                               <!-- TAB 3 -->
                                <div id="tab3" class="tab-pane fade">
                                    <div id="optimizationContainer" style="margin-top:10px;"></div>
                                </div>

                            </div>

                        </div>

                    </div>

                </div>

            </div>
        </div>

    </div>
</div>
<script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
<script src="<c:url value='/resources/js/trainProfileOptimization.js?version=21.8' />"></script>
<script src="<c:url value='/resources/js/setTrainProfileOptimization.js?version=23.4' />"></script>
<script src="<c:url value='/resources/js/setTrainProfileOptimizationUtilization.js?version=23.1' />"></script>

