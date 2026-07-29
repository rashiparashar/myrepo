//var BASE_URL = 'http://localhost:8001';
var BASE_URL = 'http://10.64.28.95:80/TPO';
var TRAIN_LIST = [];
var SELECTED_TRAIN = null;
var CURRENT_PROFILE = null;
var ACTIVE_CLASS = null;
var CURRENT_HOLIDAYS = [];
var DEMAND_MODE = "daily";
var CURRENT_DEMAND_ROWS = [];
var CURRENT_DEMAND_DATE_KEY = '';
var TRAIN_FETCH_IN_PROGRESS = false;
function pick(obj, keys){
  for (var i=0;i<keys.length;i++){
    var k=keys[i];
    if (obj && obj[k] !== undefined && obj[k] !== null && obj[k] !== '') return obj[k];
  }
  return null;
}
function firstObj(payload){
  if (!payload) return {};
  if (Array.isArray(payload)) return payload[0] || {};
  if (payload.data && typeof payload.data === 'object') return firstObj(payload.data);
  if (payload.train) return firstObj(payload.train);
  if (payload.details) return firstObj(payload.details);
  return payload;
}
function getSiteId(train){
  return pick(train, ['site_id','SITE_ID','siteId','SITEID']);
}
function getTrainNumber(train){
   return pick(train, ['train_number','TRAIN_NUMBER','trainNo','train_no','TRAIN_NO']);
}
function getTrainName(train){
	return pick(train, ['train_name','TRAIN_NAME','trainName']) || '';
}
function fmtDate(d){ return d.toISOString().slice(0,10); }
function addDays(base,n){ var d=new Date(base); d.setDate(d.getDate()+n); return d; }
function apiFetchDemand(num,siteId,startDate,endDate){
  return fetch(BASE_URL + '/train/demand/' + encodeURIComponent(num) + '?site_id=' + encodeURIComponent(siteId) + '&start_date=' + encodeURIComponent(startDate) + '&end_date=' + encodeURIComponent(endDate))
    .then(function(r){ if(!r.ok) throw new Error('demand'); return safeJson(r); });
}
function distinctVals(rows,key){ var m={},o=[]; rows.forEach(function(r){var v=r[key]||''; if(v && !m[v]){m[v]=1;o.push(v);} }); return o.sort(); }
function distinctValsAny(rows,keys){ var m={},o=[]; rows.forEach(function(r){ var v = pick(r, keys) || ''; if(v && !m[v]){m[v]=1;o.push(v);} }); return o.sort(); }
function setSelectOptions(elId, values, allLabel){ var el=byId(elId); if(!el) return; var current = el.value; var options = allLabel ? [''] : []; values.forEach(function(v){ if(v !== '') options.push(v); }); el.innerHTML = options.map(function(v){ var label = v === '' ? allLabel : v; return '<option value="'+v+'">'+label+'</option>'; }).join(''); if (current && options.indexOf(current) !== -1) el.value = current; }
function refreshDemandFilterOptions(rows){
    rows = rows || [];

    // Route order stations
    var routeStations = [];
    var seen = {};

    (CURRENT_PROFILE.route || []).forEach(function(r){
        var stn = r.STN_CODE;
        if(stn && !seen[stn]){
            seen[stn] = true;
            routeStations.push(stn);
        }
    });

    setSelectOptions('demandFromStn', routeStations, 'All');
    setSelectOptions('demandToStn', routeStations, 'All');

    setSelectOptions(
        'demandClass',
        distinctValsAny(rows,['CLS','CLASS']),
        'All Classes'
    );

    setSelectOptions(
        'demandQuota',
        distinctValsAny(rows,['QUOTA_TYPE','QUOTA']),
        'All Quotas'
    );
}
function demandRowsFromPayload(payload){
  if (!payload) return [];
  if (Array.isArray(payload)) return payload;
  if (payload.data) return demandRowsFromPayload(payload.data);
  if (Array.isArray(payload.demand)) return payload.demand;
  if (Array.isArray(payload.DEMAND)) return payload.DEMAND;
  return [];
}
function holidaysFromPayload(payload){
  if (!payload) return [];
  if (payload.data) return holidaysFromPayload(payload.data);
  if (Array.isArray(payload.holidays)) return payload.holidays;
  if (Array.isArray(payload.HOLIDAYS)) return payload.HOLIDAYS;
  return [];
}
function demandField(row, keys){
  return pick(row, keys) || '';
}
function initDemandFilters(profile){

    var route = profile.route || [];
    var berths = profile.berths || [];

    var routeStations = route.map(function(r){
        return r.STN_CODE;
    });

    var seen = {};
    routeStations = routeStations.filter(function(stn){
        if(seen[stn]) return false;
        seen[stn] = true;
        return true;
    });

    var cls = distinctVals(berths,'CLS');
    var q   = distinctVals(berths,'QUOTA_TYPE');

    setSelectOptions('demandFromStn', routeStations, 'All');
    setSelectOptions('demandToStn', routeStations, 'All');
    setSelectOptions('demandClass', cls, 'All Classes');
    setSelectOptions('demandQuota', q, 'All Quotas');
//    Added to show from stn based to stn dropdown
    byId('demandFromStn').onchange = function () {

        var fromStn = this.value;

        if (!fromStn) {
            setSelectOptions('demandToStn', routeStations, 'All');
            return;
        }

        var idx = routeStations.indexOf(fromStn);

        if (idx >= 0) {
            setSelectOptions(
                'demandToStn',
                routeStations.slice(idx + 1),
                'All'
            );
        }
    };

    var today = new Date();

    byId('demandFrom').value = fmtDate(addDays(today,61));
    byId('demandTo').value   = fmtDate(addDays(today,90));
}

function setMode(mode){ DEMAND_MODE=mode; byId('modeDaily').classList.toggle('active',mode==='daily'); byId('modeWeekly').classList.toggle('active',mode==='weekly'); }
function getDemandDateKey(){
  return (byId('demandFrom').value || '') + '|' + (byId('demandTo').value || '');
}

function validateDemandDates(){
  var sd = byId('demandFrom').value;
  var ed = byId('demandTo').value;
  if (!sd || !ed || sd > ed) {
    alert('Please select valid demand date range');
    return false;
  }
  return true;
}
function renderDemandFromRows(rows, holidays){
  rows = rows || [];
  holidays = holidays || [];
  var fromStn = byId('demandFromStn').value;
  var toStn = byId('demandToStn').value;
  var cls = byId('demandClass').value;
  var quota = byId('demandQuota').value;
  var filtered = rows.filter(function(r){
    return (!fromStn || demandField(r, ['FROM_STN','SOURCE'])===fromStn)
      && (!toStn || demandField(r, ['TO_STN','DESTINATION'])===toStn)
      && (!cls || demandField(r, ['CLS','CLASS'])===cls)
      && (!quota || demandField(r, ['QUOTA_TYPE','QUOTA'])===quota);
  });
  updateDemandChart(filtered, DEMAND_MODE, holidays);
}
function setDemandButtonLoading(isLoading){
  var applyBtn = byId('applyDemandBtn');
  if (!applyBtn) return;
  applyBtn.disabled = isLoading;
  applyBtn.textContent = isLoading ? 'Loading...' : 'Apply';
}
function loadDemandForSelectedTrain(forceFetch){
  if(!SELECTED_TRAIN) return Promise.resolve();
  if (!validateDemandDates()) return Promise.resolve();

  var siteId = getSiteId(SELECTED_TRAIN);
  var trainNo = getTrainNumber(SELECTED_TRAIN);
  if (!siteId || !trainNo) return Promise.resolve();

  var dateKey = getDemandDateKey();
  if (!forceFetch && CURRENT_DEMAND_ROWS.length && CURRENT_DEMAND_DATE_KEY === dateKey) {
    renderDemandFromRows(CURRENT_DEMAND_ROWS, CURRENT_HOLIDAYS);
    return Promise.resolve();
  }

  var sd=byId('demandFrom').value, ed=byId('demandTo').value;
  setDemandButtonLoading(true);

  return apiFetchDemand(trainNo, siteId, sd, ed).then(function(d){
    CURRENT_DEMAND_ROWS = demandRowsFromPayload(d);
    CURRENT_HOLIDAYS = holidaysFromPayload(d);
    CURRENT_DEMAND_DATE_KEY = dateKey;
    if (CURRENT_DEMAND_ROWS.length) refreshDemandFilterOptions(CURRENT_DEMAND_ROWS);
    renderDemandFromRows(CURRENT_DEMAND_ROWS, CURRENT_HOLIDAYS);
  }).catch(function(e){
    console.error(e);
    CURRENT_DEMAND_ROWS = [];
    CURRENT_HOLIDAYS = [];
    CURRENT_DEMAND_DATE_KEY = '';
    updateDemandChart([], DEMAND_MODE, []);
    alert('Failed to fetch demand data');
  }).then(function(){
    setDemandButtonLoading(false);
  });
}

function byId(id){ return document.getElementById(id); }
function safeJson(res){ return res.json().then(function(d){ return d && d.data ? d.data : d; }); }

function apiFetchTrainList(){
  var curDate = new Date().toISOString().slice(0,10);
  return fetch(BASE_URL + '/train/list/?cur_date=' + encodeURIComponent(curDate)).then(function(r){ if(!r.ok) throw new Error('list'); return safeJson(r); });
  }
function apiFetchTrainDetails(num, siteId, profileDate){
  var curDate = new Date().toISOString().slice(0,10);
  return fetch(BASE_URL + '/train/details/' + encodeURIComponent(num) + '?site_id=' + encodeURIComponent(siteId) + '&cur_date=' + encodeURIComponent(profileDate)).then(function(r){ if(!r.ok) throw new Error('details'); return safeJson(r); });
}
function apiFetchTrainProfile(num, siteId, profileDate){
  var curDate = new Date().toISOString().slice(0,10);
  return fetch(BASE_URL + '/train/profile/' + encodeURIComponent(num) + '?site_id=' + encodeURIComponent(siteId) + '&cur_date=' + encodeURIComponent(profileDate)).then(function(r){ if(!r.ok) throw new Error('profile'); return safeJson(r); });
}

function apiFetchTrainUtilization(num, siteId, profileDate, fromDate, toDate ){
	return fetch(BASE_URL + '/train/utilization/' + encodeURIComponent(num) + '?site_id=' + encodeURIComponent(siteId) + '&profile_date=' + encodeURIComponent(profileDate) + '&start_date=' + encodeURIComponent(fromDate) + '&end_date=' + encodeURIComponent(toDate)).then(function(r){ if(!r.ok) throw new Error('utilization'); return safeJson(r); });
}

function apiFetchTrainOptimization(num, siteId, profileDate, fromDate, toDate, reoptDelta){
	var url = BASE_URL + '/train/train/optimize/' + encodeURIComponent(num);
	var body = {
		site_id: String(siteId),
		profile_date: profileDate,
		start_date: fromDate,
		end_date: toDate
	};
	if (reoptDelta && reoptDelta.edited_berths && Object.keys(reoptDelta.edited_berths).length) {
		body.edited_berths = reoptDelta.edited_berths;
	}
	if (reoptDelta && Array.isArray(reoptDelta.remote_added) && reoptDelta.remote_added.length) {
		body.remote_added = reoptDelta.remote_added;
	}
	if (reoptDelta && Array.isArray(reoptDelta.remote_removed) && reoptDelta.remote_removed.length) {
		body.remote_removed = reoptDelta.remote_removed;
	}
	return fetch(url, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
		body: JSON.stringify(body)
	}).then(function (r) {
		if (!r.ok) {
			throw new Error('optimize');
		}
		return r.json();
	});
}
function formatTime(time) {
    if (!time) return '-';
    return time.toString().substring(0, 5); 
}
function renderTrainInfo(data){
  data = firstObj(data);
  byId('trainInfo').innerHTML = '<div class="card-body"><div class="row align-items-center"><div class="col-md-9"><div class="d-flex align-items-center mb-3"><h3 class="mb-0 mr-3">'+(data.TRAIN_NUMBER||'-')+' - '+(data.TRAIN_NAME||'-')+'</h3><span class="badge badge-primary p-2">'+(data.TRN_TYPE||'-')+'</span></div><div class="row"><div class="col-md-4 mb-2"><small class="text-muted">Source</small><br><strong>'+(data.SRC_STN||'-')+'</strong></div><div class="col-md-4 mb-2"><small class="text-muted">Destination</small><br><strong>'+(data.DSTN_STN||'-')+'</strong></div><div class="col-md-4 mb-2"><small class="text-muted">Distance</small><br><strong>'+(data.DISTANCE||0)+' KM</strong></div><div class="col-md-4 mb-2"><small class="text-muted">Departure</small><br><strong>'+formatTime(data.DEPT_TIME)+'</strong></div><div class="col-md-4 mb-2"><small class="text-muted">Arrival</small><br><strong>'+formatTime(data.ARVL_TIME)+'</strong></div><div class="col-md-4 mb-2"><small class="text-muted">Journey Time</small><br><strong>'+formatTime(data.TOT_TIME||'-')+'</strong></div></div></div><div class="col-md-3 text-center"><h6 class="text-muted mb-2">Running Days</h6><div>' + runningDaysHtml(data) + '</div></div></div></div>';
}
function runningDaysHtml(data){
  var days = ['SUN','MON','TUE','WED','THU','FRI','SAT'], keys = ['RUN_SUN','RUN_MON','RUN_TUE','RUN_WED','RUN_THU','RUN_FRI','RUN_SAT'];
  var out = '';
  for (var i=0; i<days.length; i++) if (data[keys[i]] === 'Y') out += '<span class="badge badge-success m-1">'+days[i]+'</span>';
  return out;
}
function setTrainFetchLoading(isLoading){
	  TRAIN_FETCH_IN_PROGRESS = isLoading;
	  var input = byId('trnNo');
	  var btn = byId('fetchTrainBtn');
	  var dropdown = byId('trainDropdown');
	  if (input) input.disabled = isLoading;
	  if (btn) {
	    btn.disabled = isLoading;
	    btn.textContent = isLoading ? 'Fetching...' : 'Fetch Train';
	  }
	  if (dropdown && isLoading) {
	    dropdown.style.display = 'none';
	  }
	}
	function bindFetchTrainUtilizationReset(){
	  var btn = byId('fetchTrainBtn');
	  if (!btn) return;
	  btn.addEventListener('click', function(){
	    if (typeof window.resetUtilizationDashboard === 'function') {
	      window.resetUtilizationDashboard();
	    }
	    if (typeof window.resetOptimizationState === 'function') {
	      window.resetOptimizationState();
	    }
	  });
	}
function renderDropdown(matches){
  var box = byId('trainDropdown');
  if (!matches.length) { box.style.display = 'none'; box.innerHTML = ''; return; }
  box.innerHTML = matches.map(function(t){ var no = getTrainNumber(t); return '<div class="train-dropdown-item" data-no="'+no+'">'+no+' - '+getTrainName(t)+'</div>'; }).join('');
  box.style.display = 'block';
  Array.prototype.forEach.call(box.querySelectorAll('.train-dropdown-item'), function(item){
    item.addEventListener('click', function(){
      var no = item.getAttribute('data-no');
      var hit = TRAIN_LIST.find(function(t){ return String(getTrainNumber(t)) === String(no); });
      if (hit) { SELECTED_TRAIN = hit; byId('trnNo').value = getTrainNumber(hit) + ' - ' + getTrainName(hit); box.style.display = 'none'; }
    });
  });
}
function bindAutocomplete(){
  var input = byId('trnNo');
  input.addEventListener('input', function(){
    var q = input.value.trim().toLowerCase(); SELECTED_TRAIN = null;
    if (!q) { renderDropdown([]); return; }
    renderDropdown(TRAIN_LIST.filter(function(t){ return String(getTrainNumber(t)).toLowerCase().indexOf(q)!==-1 || String(getTrainName(t)).toLowerCase().indexOf(q)!==-1; }).slice(0,20));
  });
  document.addEventListener('click', function(e){ if (!e.target.closest('.dropdown-wrap')) byId('trainDropdown').style.display = 'none'; });
}

function uniqueClasses(berths){
  var seen = {}, out = [];
  berths.forEach(function(r){ var c = r.CLS || '-'; if (!seen[c]) { seen[c]=1; out.push(c); } });
  return out;
}
function renderClassPills(classes){
  var wrap = byId('classPills');
  wrap.innerHTML = classes.map(function(c){ return '<span class="classPill'+(c===ACTIVE_CLASS?' active':'')+'" data-cls="'+c+'">'+c+'</span>'; }).join('');
  Array.prototype.forEach.call(wrap.querySelectorAll('.classPill'), function(el){
    el.addEventListener('click', function(){ ACTIVE_CLASS = el.getAttribute('data-cls'); refreshCurrentProfile(); renderClassPills(classes); });
  });
}

function refreshCurrentProfile(){
  if (!CURRENT_PROFILE) return;
  renderProfileCards(CURRENT_PROFILE, ACTIVE_CLASS);
  renderBerthAllocation(CURRENT_PROFILE.berths || [], ACTIVE_CLASS, CURRENT_PROFILE.route || []);
}

function searchTrain(){
  var raw = byId('trnNo').value.trim();
  if(!SELECTED_TRAIN){ SELECTED_TRAIN = TRAIN_LIST.find(function(t){ return String(getTrainNumber(t)) === raw || String(getTrainNumber(t) + ' - ' + getTrainName(t)) === raw; }) || null; }
  if(!SELECTED_TRAIN){ alert('Please enter/select valid train number'); return; }

  if (typeof resetOptimizationState === 'function') {
    resetOptimizationState();
  }
  if (typeof resetOptUtilDateTouchFlags === 'function') {
    resetOptUtilDateTouchFlags();
  }
  if (typeof initializeDefaultDatesForOptAndUtil === 'function') {
    initializeDefaultDatesForOptAndUtil(true);
  }

  var btn = byId('fetchTrainBtn');
  btn.disabled = true;
  btn.textContent = 'Fetching...';

  var siteId = getSiteId(SELECTED_TRAIN);
  if (!siteId) {
    btn.disabled = false;
    btn.textContent = 'Fetch Train';
    alert('Selected train is missing site id');
    return;
  }

  var trainNo = getTrainNumber(SELECTED_TRAIN);
  if (!trainNo) {
    btn.disabled = false;
    btn.textContent = 'Fetch Train';
    alert('Selected train is missing train number');
    return;
  }

  Promise.all([ apiFetchTrainDetails(trainNo, siteId,SELECTED_TRAIN.PROFILE_DATE), apiFetchTrainProfile(trainNo, siteId,SELECTED_TRAIN.PROFILE_DATE) ])
  .then(function(all){
    var details = all[0], profile = all[1];
    CURRENT_PROFILE = profile;
    var classes = uniqueClasses(profile.berths || []);
    ACTIVE_CLASS = classes.length ? classes[0] : null;

    renderTrainInfo(details);
    renderRoute(profile.route || []);
    renderClassPills(classes);
    refreshCurrentProfile();
    initDemandFilters(profile);
    CURRENT_DEMAND_ROWS = [];
    CURRENT_HOLIDAYS = [];
    CURRENT_DEMAND_DATE_KEY = '';
    loadDemandForSelectedTrain(true);
    byId('profileDateText').textContent =
        (SELECTED_TRAIN.PROFILE_DATE || '').split('-').reverse().join('-') || '--';
    byId('trainDetailsSection').style.display = 'block';
    byId('tabsSection').style.display = 'block';
  }).catch(function(e){ console.error(e); alert('Failed to fetch train data'); })
  .then(function(){ btn.disabled = false; btn.textContent = 'Fetch Train'; });
}


function getUtilizationData(fromDate, toDate){
	return apiFetchTrainUtilization(SELECTED_TRAIN.train_number, SELECTED_TRAIN.site_id, SELECTED_TRAIN.PROFILE_DATE, fromDate, toDate);
}

function getOptimizationData(fromDate, toDate){
	var trainNo = getTrainNumber(SELECTED_TRAIN);
	var siteId = getSiteId(SELECTED_TRAIN);
	return apiFetchTrainOptimization(trainNo, siteId, SELECTED_TRAIN.PROFILE_DATE, fromDate, toDate);
}

// Re-optimize uses same POST endpoint with edited_berths in JSON body.
function getReoptimizeData(fromDate, toDate, delta) {
	var trainNo = getTrainNumber(SELECTED_TRAIN);
	var siteId = getSiteId(SELECTED_TRAIN);
	return apiFetchTrainOptimization(trainNo, siteId, SELECTED_TRAIN.PROFILE_DATE, fromDate, toDate, delta);
}

document.addEventListener('DOMContentLoaded', function(){
  apiFetchTrainList().then(function(d){ TRAIN_LIST = d.train_list || []; }).catch(console.error);
  bindAutocomplete();
  byId('fetchTrainBtn').addEventListener('click', function(e){ e.preventDefault(); searchTrain(); });
  byId('modeDaily').addEventListener('click', function(){ setMode('daily'); renderDemandFromRows(CURRENT_DEMAND_ROWS, CURRENT_HOLIDAYS); });
  byId('modeWeekly').addEventListener('click', function(){ setMode('weekly'); renderDemandFromRows(CURRENT_DEMAND_ROWS, CURRENT_HOLIDAYS); });
  byId('applyDemandBtn').addEventListener('click', function(e){ e.preventDefault(); loadDemandForSelectedTrain(true); });
  var demandTabLink = document.querySelector('a[href="#tab2"]');
  if (demandTabLink) {
    demandTabLink.addEventListener('click', function(){ window.setTimeout(function(){ loadDemandForSelectedTrain(false); }, 150); });
    demandTabLink.addEventListener('shown.bs.tab', function(){ loadDemandForSelectedTrain(); });
  }
});


function formatDateForInit(date) {
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return year + '-' + month + '-' + day;
}

/* =============================================================================
 * OPTIMIZATION TAB — logic ported from fontend_raw_modular/js/ui.js + app.js
 *
 * DATA FLOW (first principles):
 *   API returns three blocks:
 *     1. optimizer_result     → proposed berth plan + summary totals
 *     2. current_analysis     → utilization rows for CURRENT profile
 *     3. optimized_analysis   → utilization rows for PROPOSED profileF
 *
 *   Summary cards use optimizer_result fields directly (served_demand, etc.).
 *   Comparison grid + charts sum utilization rows via optSumMetrics().
 *   Berth table parses optimizer_result.berths keys (CLASS_QUOTA_FROM_TO).
 *
 *   We do NOT guess or predict — every number comes from API fields.
 * ============================================================================= */

var OPT_CHARTS = { quotaCompare: null };
var OPT_STATE = {
  optimizer: null,
  currentUtil: [],
  optimizedUtil: [],
  editedRows: [],
  originalBerths: {},
  deletedKeys: [],
  hasChanges: false,
  optimizationLoaded: false,
  reoptimizing: false,
  nextRowId: 1,
  focusRowId: null,
  activeAddClass: null,
  compareClass: null,
  compareChangesOnly: true,
  expandedClasses: {},
  originalRemotes: [],
  remoteAdded: [],
  remoteRemoved: []
};
var OPT_DATES_TOUCHED = { opt: false, util: false };
var OPT_DEFAULT_FROM_OFFSET = 61;
var OPT_DEFAULT_TO_OFFSET = 90;

function resetOptimizationState() {
  destroyOptimizationCharts();
  OPT_STATE.optimizer = null;
  OPT_STATE.currentUtil = [];
  OPT_STATE.optimizedUtil = [];
  OPT_STATE.editedRows = [];
  OPT_STATE.originalBerths = {};
  OPT_STATE.deletedKeys = [];
  OPT_STATE.hasChanges = false;
  OPT_STATE.optimizationLoaded = false;
  OPT_STATE.reoptimizing = false;
  OPT_STATE.nextRowId = 1;
  OPT_STATE.focusRowId = null;
  OPT_STATE.activeAddClass = null;
  OPT_STATE.expandedClasses = {};
  OPT_STATE.originalRemotes = [];
  OPT_STATE.remoteAdded = [];
  OPT_STATE.remoteRemoved = [];
  $('#optimizationContent').html('');
  updateReoptimizeButton();
}
window.resetOptimizationState = resetOptimizationState;

function rowToBerthKey(r) {
  return String(r.CLASS || '') + '_' + String(r.QUOTA || '') + '_' + String(r.FROM || '') + '_' + String(r.TO || '');
}

function isRowModified(r) {
  if (!r || r.isNew || r.removed || !r.origSnapshot) {
    return false;
  }
  return r.QUOTA !== r.origSnapshot.QUOTA
    || r.FROM !== r.origSnapshot.FROM
    || r.TO !== r.origSnapshot.TO
    || optNum(r.BERTHS) !== optNum(r.origSnapshot.BERTHS);
}

function getRouteStationOrder() {
  var order = {};
  var route = (CURRENT_PROFILE && CURRENT_PROFILE.route) || [];
  route.forEach(function (s, idx) {
    var code = s.STN_CODE || s.stn_code || '';
    if (code && order[code] === undefined) {
      order[code] = idx;
    }
  });
  return order;
}

function stationRouteIndex(code, orderMap) {
  if (!code) {
    return 9999;
  }
  return orderMap[code] !== undefined ? orderMap[code] : 9999;
}

function compareAllocRows(a, b) {
  var order = getRouteStationOrder();
  var fromCmp = stationRouteIndex(a.FROM, order) - stationRouteIndex(b.FROM, order);
  if (fromCmp !== 0) {
    return fromCmp;
  }
  var toCmp = stationRouteIndex(a.TO, order) - stationRouteIndex(b.TO, order);
  if (toCmp !== 0) {
    return toCmp;
  }
  return String(a.QUOTA || '').localeCompare(String(b.QUOTA || ''));
}

function optQuotaColor(quota) {
  var q = String(quota || '').trim();
  if (!q) {
    return '#7f7f7f';
  }
  if (typeof window.getQuotaDisplayColor === 'function') {
    return window.getQuotaDisplayColor(q);
  }
  if (typeof window.hashColor === 'function') {
    return window.hashColor(q);
  }
  return '#7f7f7f';
}

function optQuotaColorLight(quota, alpha) {
  var c = optQuotaColor(quota);
  alpha = alpha || '66';
  return c.length === 7 ? c + alpha : c;
}

// Allocation lifecycle: stable → modified → new → removed (removed always last).
function sortClassRows(items) {
  var removed = [];
  var fresh = [];
  var changed = [];
  var stable = [];
  (items || []).forEach(function (r) {
    if (r.removed) {
      removed.push(r);
    } else if (r.isNew) {
      fresh.push(r);
    } else if (isRowModified(r)) {
      changed.push(r);
    } else {
      stable.push(r);
    }
  });
  changed.sort(compareAllocRows);
  stable.sort(compareAllocRows);
  return stable.concat(changed).concat(fresh).concat(removed);
}

function mergeDomRowsWithState(domRows) {
  var map = {};
  OPT_STATE.editedRows.forEach(function (r) {
    map[r._rowId] = r;
  });
  return (domRows || []).map(function (d) {
    var prev = map[d._rowId];
    if (prev) {
      return {
        _rowId: d._rowId,
        CLASS: prev.CLASS || d.CLASS,
        QUOTA: d.QUOTA,
        FROM: d.FROM,
        TO: d.TO,
        BERTHS: d.BERTHS,
        isNew: !!prev.isNew,
        removed: !!prev.removed,
        origKey: prev.origKey,
        origSnapshot: prev.origSnapshot
      };
    }
    return {
      _rowId: d._rowId,
      CLASS: d.CLASS,
      QUOTA: d.QUOTA,
      FROM: d.FROM,
      TO: d.TO,
      BERTHS: d.BERTHS,
      isNew: !!d.isNew,
      removed: !!d.removed,
      origKey: undefined,
      origSnapshot: undefined
    };
  });
}

function captureExpandedClassPanels() {
  if (!$('#optBerthTableWrap').length) {
    return;
  }
  OPT_STATE.expandedClasses = OPT_STATE.expandedClasses || {};
  $('#optBerthTableWrap .opt-berth-cls-panel').each(function () {
    var cls = $(this).attr('data-class');
    if (cls) {
      OPT_STATE.expandedClasses[cls] = $(this).find('.opt-berth-cls-body').is(':visible');
    }
  });
}

function markOptimizationDirty() {
  OPT_STATE.hasChanges = getChangeCounts().total > 0;
  updateReoptimizeButton();
}

function countClassChanges(items) {
  return (items || []).filter(function (r) {
    return r.isNew || isRowModified(r) || r.removed;
  }).length;
}

function computeAllocationDelta(rows) {
  var editedBerths = {};

  (rows || []).forEach(function (r) {
    if (r.removed && r.origKey) {
      editedBerths[r.origKey] = 0;
      return;
    }
    if (r.removed || !r.QUOTA || !r.FROM || !r.TO) {
      return;
    }
    var newKey = rowToBerthKey(r);
    if (r.isNew) {
      if (optNum(r.BERTHS) > 0) {
        editedBerths[newKey] = optNum(r.BERTHS);
      }
      return;
    }
    var origKey = r.origKey || newKey;
    var origBerths = optNum(OPT_STATE.originalBerths[origKey]);
    if (newKey !== origKey) {
      editedBerths[origKey] = 0;
      editedBerths[newKey] = optNum(r.BERTHS);
      return;
    }
    if (optNum(r.BERTHS) !== origBerths || isRowModified(r)) {
      editedBerths[newKey] = optNum(r.BERTHS);
    }
  });

  return { edited_berths: editedBerths };
}

function getRemoteChangeCount() {
  return (OPT_STATE.remoteAdded || []).length + (OPT_STATE.remoteRemoved || []).length;
}

function getChangeCounts() {
  var rows = OPT_STATE.editedRows;
  var newCount = rows.filter(function (r) { return r.isNew && !r.removed; }).length;
  var modifiedCount = rows.filter(function (r) { return !r.isNew && !r.removed && isRowModified(r); }).length;
  var deletedCount = rows.filter(function (r) { return r.removed; }).length;
  var remoteChanges = getRemoteChangeCount();
  return {
    total: newCount + modifiedCount + deletedCount + remoteChanges,
    newCount: newCount,
    modifiedCount: modifiedCount,
    deleted: deletedCount,
    remoteChanges: remoteChanges
  };
}

function getNetBerthChange() {
  var delta = computeAllocationDelta(OPT_STATE.editedRows);
  var net = 0;
  Object.keys(delta.edited_berths || {}).forEach(function (key) {
    var orig = optNum(OPT_STATE.originalBerths[key]);
    net += optNum(delta.edited_berths[key]) - orig;
  });
  return net;
}

function getAllocationChangeLabel(row) {
  if (!row) {
    return '';
  }
  if (row.removed) {
    return 'Removed \u00b7 0 berths';
  }
  if (row.isNew) {
    return 'New';
  }
  if (!row.origSnapshot) {
    return '';
  }
  var parts = [];
  if (row.QUOTA !== row.origSnapshot.QUOTA) {
    parts.push('Quota Changed');
  }
  if (row.FROM !== row.origSnapshot.FROM || row.TO !== row.origSnapshot.TO) {
    parts.push('Route Changed');
  }
  var berthDelta = optNum(row.BERTHS) - optNum(row.origSnapshot.BERTHS);
  if (berthDelta !== 0) {
    parts.push((berthDelta > 0 ? '+' : '') + berthDelta + ' Berths');
  }
  if (!parts.length && isRowModified(row)) {
    return 'Modified';
  }
  return parts.join(' \u00b7 ');
}

function syncEditedRowsFromDom() {
  OPT_STATE.editedRows = mergeDomRowsWithState(readEditedRowsFromDom());
  OPT_STATE.hasChanges = getChangeCounts().total > 0;
}

function getOptStationOptions() {
  var stations = [];
  var seen = {};
  var route = (CURRENT_PROFILE && CURRENT_PROFILE.route) || [];
  route.forEach(function (s) {
    var code = s.STN_CODE || s.stn_code || '';
    if (code && !seen[code]) {
      seen[code] = true;
      stations.push(code);
    }
  });
  return stations;
}

function getOptQuotaOptions() {
  var quotas = [];
  if (CURRENT_PROFILE && CURRENT_PROFILE.berths) {
    CURRENT_PROFILE.berths.forEach(function (b) {
      var q = b.QUOTA_TYPE || b.QUOTA || '';
      if (q && quotas.indexOf(q) === -1) {
        quotas.push(q);
      }
    });
  }
  OPT_STATE.editedRows.forEach(function (r) {
    if (r.QUOTA && quotas.indexOf(r.QUOTA) === -1) {
      quotas.push(r.QUOTA);
    }
  });
  return quotas.sort();
}

function getOptClassOptions() {
  var classes = [];
  if (CURRENT_PROFILE && CURRENT_PROFILE.berths) {
    CURRENT_PROFILE.berths.forEach(function (b) {
      var c = b.CLS || b.CLASS || '';
      if (c && classes.indexOf(c) === -1) {
        classes.push(c);
      }
    });
  }
  OPT_STATE.editedRows.forEach(function (r) {
    if (r.CLASS && classes.indexOf(r.CLASS) === -1) {
      classes.push(r.CLASS);
    }
  });
  return classes.sort();
}

function optSelectOptions(values, selected, placeholder, preserveOrder) {
  var list = (values || []).slice();
  if (selected && list.indexOf(selected) === -1) {
    list.push(selected);
  }
  if (!preserveOrder) {
    list.sort();
  }
  var html = placeholder ? '<option value="">' + optEsc(placeholder) + '</option>' : '';
  list.forEach(function (v) {
    html += '<option value="' + optEsc(v) + '"' + (String(v) === String(selected) ? ' selected' : '') + '>' + optEsc(v) + '</option>';
  });
  return html;
}

function readEditedRowsFromDom() {
  var rows = [];
  $('#optBerthTableWrap .opt-alloc-card[data-row-id]').each(function () {
    var $card = $(this);
    rows.push({
      _rowId: parseInt($card.attr('data-row-id'), 10),
      CLASS: $card.attr('data-class') || '',
      QUOTA: $card.find('.opt-edit-quota').val() || '',
      FROM: $card.find('.opt-edit-from').val() || '',
      TO: $card.find('.opt-edit-to').val() || '',
      BERTHS: optNum($card.find('.opt-edit-berths').val()),
      isNew: $card.attr('data-is-new') === '1',
      removed: $card.attr('data-removed') === '1'
    });
  });
  return rows;
}

function validateOptAllocations(rows) {
  var i;
  var errors = [];
  clearOptInlineErrors();
  if (!rows || !rows.length) {
    alert('Add at least one allocation row.');
    return false;
  }
  for (i = 0; i < rows.length; i++) {
    var r = rows[i];
    if (r.removed) {
      continue;
    }
    var rowErrors = [];
    if (!r.QUOTA) {
      rowErrors.push('Select a quota');
    }
    if (!r.FROM) {
      rowErrors.push('Select source station');
    }
    if (!r.TO) {
      rowErrors.push('Select destination station');
    }
    if (r.FROM && r.TO && r.FROM === r.TO) {
      rowErrors.push('Source and destination must differ');
    }
    if (optNum(r.BERTHS) < 0) {
      rowErrors.push('Berths must be 0 or greater');
    }
    if (rowErrors.length) {
      errors.push({ rowId: r._rowId, messages: rowErrors });
      markOptCardErrors(r._rowId, rowErrors);
    }
  }
  if (errors.length) {
    var $first = $('#optBerthTableWrap .opt-alloc-card[data-row-id="' + errors[0].rowId + '"]');
    if ($first.length) {
      $('html, body').animate({ scrollTop: $first.offset().top - 120 }, 240);
    }
    return false;
  }
  return true;
}

function clearOptInlineErrors() {
  $('#optBerthTableWrap .opt-alloc-card').removeClass('opt-alloc-invalid');
  $('#optBerthTableWrap .opt-alloc-error').remove();
}

function markOptCardErrors(rowId, messages) {
  var $card = $('#optBerthTableWrap .opt-alloc-card[data-row-id="' + rowId + '"]');
  if (!$card.length) {
    return;
  }
  $card.addClass('opt-alloc-invalid');
  $card.find('.opt-alloc-footer').prepend(
    '<div class="opt-alloc-error">' + messages.map(optEsc).join(' \u00b7 ') + '</div>'
  );
}


function updateReoptimizeButton() {
  var $btn = $('#optReoptimizeBtn');
  if (!$btn.length) {
    return;
  }
  if (OPT_STATE.reoptimizing) {
    $btn.prop('disabled', true).text('Re-Optimizing...');
    return;
  }
  var counts = getChangeCounts();
  var label = 'Re-Optimize';
  if (counts.total > 0) {
    label = 'Re-Optimize (' + counts.total + (counts.total === 1 ? ' Change' : ' Changes') + ')';
  }
  $btn.prop('disabled', counts.total === 0 || !OPT_STATE.optimizationLoaded).text(label);
  updateChangeSummaryPanel();
}

function updateChangeSummaryPanel() {
  var $panel = $('#optChangeSummaryPanel');
  if (!$panel.length) {
    return;
  }
  var counts = getChangeCounts();
  var totalAlloc = OPT_STATE.editedRows.length;
  var netBerths = getNetBerthChange();
  var netLabel = (netBerths > 0 ? '+' : '') + netBerths;
  var netCls = netBerths > 0 ? 'opt-summary-positive' : (netBerths < 0 ? 'opt-summary-negative' : 'opt-summary-neutral');
  $panel.html(
    '<div class="opt-change-summary-inner">'
    + '<div class="opt-change-summary-item"><span class="lbl">Total Allocations</span><strong>' + totalAlloc + '</strong></div>'
    + '<div class="opt-change-summary-item opt-summary-success"><span class="lbl">Added</span><strong>' + counts.newCount + '</strong></div>'
    + '<div class="opt-change-summary-item opt-summary-warning"><span class="lbl">Modified</span><strong>' + counts.modifiedCount + '</strong></div>'
    + '<div class="opt-change-summary-item opt-summary-danger"><span class="lbl">Removed</span><strong>' + counts.deleted + '</strong></div>'
    + '<div class="opt-change-summary-item ' + netCls + '"><span class="lbl">Net Berth Change</span><strong>' + netLabel + '</strong></div>'
    + '</div>'
  );
  $panel.toggle(OPT_STATE.optimizationLoaded && counts.total > 0);
}

function updateClassHeaders() {
  if (!$('#optBerthTableWrap').length) {
    return;
  }
  $('#optBerthTableWrap .opt-berth-cls-panel').each(function () {
    var $panel = $(this);
    var cls = $panel.attr('data-class');
    var items = OPT_STATE.editedRows.filter(function (r) { return r.CLASS === cls; });
    var clsTotal = items.reduce(function (s, r) { return r.removed ? s : s + optNum(r.BERTHS); }, 0);
    var removedCount = items.filter(function (r) { return r.removed; }).length;
    var changeCount = countClassChanges(items);
    var meta = '<strong>' + clsTotal + '</strong> quota-berths';
    if (removedCount > 0) {
      meta += ' · <span class="opt-cls-removed-count">' + removedCount + ' removed</span>';
    }
    if (changeCount > 0) {
      meta += ' · <span class="opt-cls-modified-count">' + changeCount + ' modified</span>';
    }
    $panel.find('.opt-berth-cls-meta').html(meta);
    $panel.find('.opt-berth-cls-warn').toggle(changeCount > 0).text(
      changeCount > 0 ? '\u26A0 ' + changeCount + ' Unsaved Change' + (changeCount === 1 ? '' : 's') : ''
    );
  });
}

function refreshAllocationCardStates() {
  if (!$('#optBerthTableWrap').length) {
    updateReoptimizeButton();
    return;
  }
  $('#optBerthTableWrap .opt-alloc-card[data-row-id]').each(function () {
    var $card = $(this);
    var rowId = parseInt($card.attr('data-row-id'), 10);
    var row = OPT_STATE.editedRows.find(function (r) { return r._rowId === rowId; });
    if (!row) {
      return;
    }
    var isNew = !!row.isNew;
    var removed = !!row.removed;
    var modified = !isNew && !removed && isRowModified(row);
    var qColor = optQuotaColor(row.QUOTA || '');
    $card.toggleClass('opt-alloc-new', isNew && !removed);
    $card.toggleClass('opt-alloc-modified', modified);
    $card.toggleClass('opt-alloc-removed', removed);
    $card.attr('data-is-new', isNew ? '1' : '0');
    $card.attr('data-removed', removed ? '1' : '0');
    $card.attr('data-quota', row.QUOTA || '');
    $card.css('--opt-quota-color', removed ? '#94a3b8' : qColor);
    $card.find('.opt-quota-pill').text(row.QUOTA || 'Quota').css({
      color: removed ? '#94a3b8' : qColor,
      borderColor: removed ? '#94a3b8' : qColor,
      background: (removed ? '#94a3b8' : qColor) + '18'
    });
    $card.find('.opt-edit-quota, .opt-edit-from, .opt-edit-to, .opt-edit-berths').prop('disabled', removed || OPT_STATE.reoptimizing);
    var $badge = $card.find('.opt-alloc-badge');
    var changeLabel = getAllocationChangeLabel(row);
    if (removed) {
      $badge.text('Removed \u00b7 0 berths').attr('data-change-type', 'removed').show();
    } else if (isNew) {
      $badge.text('New').attr('data-change-type', 'new').show();
    } else if (modified && changeLabel) {
      $badge.text(changeLabel).attr('data-change-type', 'modified').show();
    } else {
      $badge.hide().text('');
    }
    $card.find('.opt-alloc-diff').toggle(!!modified && !isNew && row.origSnapshot).html(
      modified && row.origSnapshot
        ? 'Was: <strong>' + optNum(row.origSnapshot.BERTHS) + '</strong>'
        : ''
    );
    $card.find('.opt-del-row').toggle(!removed);
    $card.find('.opt-restore-row').toggle(!!removed);
  });
  updateClassHeaders();
  updateReoptimizeButton();
}

function syncAndRefreshChanges() {
  syncEditedRowsFromDom();
  refreshAllocationCardStates();
  if ($('#optCompareClassPills').length) {
    renderOptBerthCompare();
  }
}

function focusNewAllocationCard() {
  var rowId = OPT_STATE.focusRowId;
  if (!rowId) {
    return;
  }
  OPT_STATE.focusRowId = null;
  var $card = $('#optBerthTableWrap .opt-alloc-card[data-row-id="' + rowId + '"]');
  if (!$card.length) {
    return;
  }
  $card.addClass('opt-alloc-focus');
  setTimeout(function () { $card.removeClass('opt-alloc-focus'); }, 2200);
  var top = $card.offset().top - Math.min(140, $(window).height() * 0.25);
  $('html, body').animate({ scrollTop: top }, 280);
  setTimeout(function () { $card.find('.opt-edit-quota').focus(); }, 320);
}

function setOptimizationEditMode(busy) {
  OPT_STATE.reoptimizing = busy;
  $('#optimizationContent').find('.opt-edit-quota, .opt-edit-from, .opt-edit-to, .opt-edit-berths, .opt-add-row, .opt-del-row, .opt-restore-row, .opt-berth-cls-head, #optReoptimizeBtn')
    .prop('disabled', busy);
  if (busy) {
    $('#optBerthExpandAll, #optBerthCollapseAll').addClass('disabled').css('pointer-events', 'none');
  } else {
    $('#optBerthExpandAll, #optBerthCollapseAll').removeClass('disabled').css('pointer-events', '');
  }
  updateReoptimizeButton();
}

function markOptimizationChanged() {
  syncAndRefreshChanges();
}

function pushNewAllocationRow(cls) {
  if (!cls) {
    cls = OPT_STATE.activeAddClass || getOptClassOptions()[0] || '';
  }
  if (!cls) {
    alert('Load optimization data first, or expand a class section to add an allocation.');
    return;
  }
  captureExpandedClassPanels();
  syncEditedRowsFromDom();
  var newId = OPT_STATE.nextRowId++;
  OPT_STATE.editedRows.push({
    _rowId: newId,
    CLASS: cls,
    QUOTA: '',
    FROM: '',
    TO: '',
    BERTHS: 0,
    isNew: true,
    removed: false
  });
  OPT_STATE.focusRowId = newId;
  OPT_STATE.activeAddClass = cls;
  OPT_STATE.expandedClasses[cls] = true;
  markOptimizationDirty();
  refreshBerthTableSection();
}

function runReoptimize() {
  if (!SELECTED_TRAIN || !OPT_STATE.optimizationLoaded || OPT_STATE.reoptimizing) {
    return;
  }

  syncEditedRowsFromDom();
  var rows = OPT_STATE.editedRows;
  if (!validateOptAllocations(rows)) {
    return;
  }

  var delta = computeAllocationDelta(rows);
  var remoteDelta = computeRemoteDelta();
  if (remoteDelta.remote_added.length) {
    delta.remote_added = remoteDelta.remote_added;
  }
  if (remoteDelta.remote_removed.length) {
    delta.remote_removed = remoteDelta.remote_removed;
  }
  var changeCount = Object.keys(delta.edited_berths).length
    + remoteDelta.remote_added.length
    + remoteDelta.remote_removed.length;
  if (changeCount === 0) {
    return;
  }

  var fromDate = $('#optFromDate').val();
  var toDate = $('#optToDate').val();
  if (!fromDate || !toDate || fromDate >= toDate) {
    alert('Please select valid date range');
    return;
  }

  setOptimizationEditMode(true);

  getReoptimizeData(fromDate, toDate, delta)
    .then(function (response) {
      drawOptimizationProfile(response);
    })
    .catch(function (e) {
      console.error(e);
      alert('Failed to re-optimize profile');
    })
    .finally(function () {
      setOptimizationEditMode(false);
    });
}

function bindOptimizationEditorEvents() {
  var $doc = $(document);
  $doc.off('.optEditor');

  $doc.on('click.optEditor', '#optimizationContainer #optReoptimizeBtn', function () {
    if (!$(this).prop('disabled')) {
      runReoptimize();
    }
  });

  $doc.on('click.optEditor', '#optimizationContainer #optRemoteAddBtn', function (e) {
    e.preventDefault();
    addRemoteStationFromInput();
  });

  $doc.on('keydown.optEditor', '#optimizationContainer #optRemoteStationsInput', function (e) {
    if (e.which === 13) {
      e.preventDefault();
      addRemoteStationFromInput();
    }
  });

  $doc.on('click.optEditor', '#optimizationContainer .opt-remote-pill-x', function (e) {
    e.preventDefault();
    e.stopPropagation();
    removeRemoteChip(String($(this).closest('.opt-remote-pill').attr('data-station') || ''));
  });

  $doc.on('click.optEditor', '#optimizationContainer #optRemotesPills .opt-remote-pill[data-station]', function (e) {
    if ($(e.target).closest('.opt-remote-pill-x').length) {
      return;
    }
    e.preventDefault();
    markRemoteAsAdded(String($(this).attr('data-station') || ''));
  });

  $doc.on('click.optEditor', '#optimizationContainer .opt-remote-restore', function (e) {
    e.preventDefault();
    e.stopPropagation();
    restoreRemovedRemote(String($(this).closest('.opt-remote-pill').attr('data-station') || ''));
  });

  $doc.on('click.optEditor', '#optimizationContainer .opt-add-row', function (e) {
    e.preventDefault();
    e.stopPropagation();
    if (OPT_STATE.reoptimizing) {
      return;
    }
    var cls = $(this).attr('data-class')
      || OPT_STATE.activeAddClass
      || getOptClassOptions()[0]
      || '';
    pushNewAllocationRow(cls);
  });

  $doc.on('click.optEditor', '#optimizationContainer .opt-del-row', function (e) {
    e.preventDefault();
    e.stopPropagation();
    if (OPT_STATE.reoptimizing) {
      return;
    }
    captureExpandedClassPanels();
    syncEditedRowsFromDom();
    var rowId = parseInt($(this).closest('.opt-alloc-card').attr('data-row-id'), 10);
    var row = OPT_STATE.editedRows.find(function (r) { return r._rowId === rowId; });
    if (!row) {
      return;
    }
    if (row.isNew) {
      OPT_STATE.editedRows = OPT_STATE.editedRows.filter(function (r) { return r._rowId !== rowId; });
    } else {
      row.removed = true;
      row.BERTHS = 0;
      if (row.origKey && OPT_STATE.deletedKeys.indexOf(row.origKey) === -1) {
        OPT_STATE.deletedKeys.push(row.origKey);
      }
    }
    markOptimizationDirty();
    refreshBerthTableSection();
  });

  $doc.on('click.optEditor', '#optimizationContainer .opt-restore-row', function (e) {
    e.preventDefault();
    e.stopPropagation();
    if (OPT_STATE.reoptimizing) {
      return;
    }
    captureExpandedClassPanels();
    syncEditedRowsFromDom();
    var rowId = parseInt($(this).closest('.opt-alloc-card').attr('data-row-id'), 10);
    var row = OPT_STATE.editedRows.find(function (r) { return r._rowId === rowId; });
    if (!row) {
      return;
    }
    row.removed = false;
    row.BERTHS = row.origSnapshot ? optNum(row.origSnapshot.BERTHS) : optNum(OPT_STATE.originalBerths[row.origKey]);
    row.QUOTA = row.origSnapshot ? row.origSnapshot.QUOTA : row.QUOTA;
    row.FROM = row.origSnapshot ? row.origSnapshot.FROM : row.FROM;
    row.TO = row.origSnapshot ? row.origSnapshot.TO : row.TO;
    if (row.origKey) {
      OPT_STATE.deletedKeys = OPT_STATE.deletedKeys.filter(function (k) { return k !== row.origKey; });
    }
    markOptimizationDirty();
    refreshBerthTableSection();
  });

  $doc.on('change input.optEditor', '#optimizationContainer #optBerthTableWrap .opt-edit-quota, #optimizationContainer #optBerthTableWrap .opt-edit-from, #optimizationContainer #optBerthTableWrap .opt-edit-to, #optimizationContainer #optBerthTableWrap .opt-edit-berths', function () {
    if (OPT_STATE.reoptimizing) {
      return;
    }
    clearOptInlineErrors();
    syncAndRefreshChanges();
  });

  $doc.on('change.optEditor', '#optimizationContainer #optFromDate, #optimizationContainer #optToDate', function () {
    OPT_DATES_TOUCHED.opt = true;
  });
  $doc.on('change.optEditor', '#fromDate, #toDate', function () {
    OPT_DATES_TOUCHED.util = true;
  });

  $doc.on('click.optEditor', '#optimizationContainer .opt-berth-summary-jump', function (e) {
    e.preventDefault();
    var cls = $(this).attr('data-class');
    if (!cls) {
      return;
    }
    OPT_STATE.activeAddClass = cls;
    OPT_STATE.expandedClasses = OPT_STATE.expandedClasses || {};
    OPT_STATE.expandedClasses[cls] = true;
    $('#optBerthTableWrap .opt-berth-cls-panel').each(function () {
      var panelCls = $(this).attr('data-class');
      var open = panelCls === cls;
      $(this).find('.opt-berth-cls-body').toggle(open);
      $(this).find('.opt-berth-chevron').toggleClass('open', open);
    });
    $('#optBerthTableWrap .opt-berth-summary-jump').removeClass('active');
    $(this).addClass('active');
    var $target = $('#optBerthTableWrap .opt-berth-cls-panel').filter(function () {
      return $(this).attr('data-class') === cls;
    });
    if ($target.length) {
      $('html, body').animate({ scrollTop: $target.offset().top - 90 }, 260);
    }
  });

  $doc.on('click.optEditor', '#optimizationContainer .opt-berth-cls-head', function () {
    var cls = $(this).attr('data-class') || '';
    OPT_STATE.activeAddClass = cls || OPT_STATE.activeAddClass;
    var $body = $(this).next('.opt-berth-cls-body');
    var willOpen = !$body.is(':visible');
    $body.slideToggle(160);
    $(this).find('.opt-berth-chevron').toggleClass('open');
    OPT_STATE.expandedClasses = OPT_STATE.expandedClasses || {};
    if (cls) {
      OPT_STATE.expandedClasses[cls] = willOpen;
    }
  });

  $doc.on('click.optEditor', '#optimizationContainer #optBerthExpandAll', function (e) {
    e.preventDefault();
    OPT_STATE.expandedClasses = OPT_STATE.expandedClasses || {};
    $('#optBerthTableWrap .opt-berth-cls-panel').each(function () {
      var cls = $(this).attr('data-class');
      if (cls) {
        OPT_STATE.expandedClasses[cls] = true;
      }
    });
    $('#optBerthTableWrap .opt-berth-cls-body').slideDown(160);
    $('#optBerthTableWrap .opt-berth-chevron').addClass('open');
  });

  $doc.on('click.optEditor', '#optimizationContainer #optBerthCollapseAll', function (e) {
    e.preventDefault();
    OPT_STATE.expandedClasses = OPT_STATE.expandedClasses || {};
    $('#optBerthTableWrap .opt-berth-cls-panel').each(function () {
      var cls = $(this).attr('data-class');
      if (cls) {
        OPT_STATE.expandedClasses[cls] = false;
      }
    });
    $('#optBerthTableWrap .opt-berth-cls-body').slideUp(160);
    $('#optBerthTableWrap .opt-berth-chevron').removeClass('open');
  });

  $doc.on('click.optEditor', '#optimizationContainer #optCompareClassPills .opt-compare-class-pill', function (e) {
    e.preventDefault();
    var cls = $(this).attr('data-class');
    if (!cls || cls === OPT_STATE.compareClass) {
      return;
    }
    OPT_STATE.compareClass = cls;
    renderOptBerthCompare();
  });

  $doc.on('change.optEditor', '#optimizationContainer #optBerthDiffChangesOnly', function () {
    OPT_STATE.compareChangesOnly = $(this).prop('checked');
    renderOptBerthCompare();
  });

  $doc.on('click.optEditor', '#optimizationContainer #optMetricsToggleBtn', function (e) {
    e.preventDefault();
    var $panel = $('#optUtilMetricsPanel');
    var open = !$panel.is(':visible');
    $panel.slideToggle(160);
    $(this).find('.opt-metrics-chevron').toggleClass('open', open);
  });

  $doc.on('click.optEditor', '#optimizationContainer #optQuotaChartToggleBtn', function (e) {
    e.preventDefault();
    var $panel = $('#optQuotaChartPanel');
    var open = !$panel.is(':visible');
    $panel.slideToggle(160, function () {
      if (open && OPT_CHARTS.quotaCompare) {
        OPT_CHARTS.quotaCompare.resize();
      }
    });
    $(this).find('.opt-metrics-chevron').toggleClass('open', open);
  });
}

function refreshBerthTableSection() {
  if (!$('#optBerthTableWrap').length) {
    return;
  }
  $('#optBerthTableWrap').replaceWith(buildBerthTableSection(OPT_STATE.editedRows));
  setOptimizationEditMode(OPT_STATE.reoptimizing);
  focusNewAllocationCard();
  updateChangeSummaryPanel();
  if ($('#optCompareClassPills').length) {
    renderOptBerthCompare();
  }
}

// Safe number parse — API fields may be strings; treat NaN as 0.
function optNum(v) {
  var n = Number(v);
  return isNaN(n) ? 0 : n;
}

function optFmtNum(v) {
  return Math.round(optNum(v)).toLocaleString('en-IN');
}

function optFmtPct(v) {
  return (Math.round(optNum(v) * 100) / 100).toFixed(2) + '%';
}

function optFmtCurrency(v) {
  return '\u20B9' + optFmtNum(v);
}

function optEsc(t) {
  return String(t == null ? '' : t)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

// Default optimization & utilization window: today + 61 through today + 90 days.
function getDefaultOptUtilDateRange() {
  var today = new Date();
  return {
    from: formatDateForInit(addDays(today, OPT_DEFAULT_FROM_OFFSET)),
    to: formatDateForInit(addDays(today, OPT_DEFAULT_TO_OFFSET))
  };
}

function initializeDefaultDatesForOptAndUtil(force) {
  var range = getDefaultOptUtilDateRange();
  if (force || !OPT_DATES_TOUCHED.util) {
    if (force || !$('#fromDate').val()) {
      $('#fromDate').val(range.from);
    }
    if (force || !$('#toDate').val()) {
      $('#toDate').val(range.to);
    }
  }
  if ($('#optFromDate').length && (force || !OPT_DATES_TOUCHED.opt)) {
    if (force || !$('#optFromDate').val()) {
      $('#optFromDate').val(range.from);
    }
    if (force || !$('#optToDate').val()) {
      $('#optToDate').val(range.to);
    }
  }
}

function resetOptUtilDateTouchFlags() {
  OPT_DATES_TOUCHED.opt = false;
  OPT_DATES_TOUCHED.util = false;
}

window.initializeDefaultDatesForOptAndUtil = initializeDefaultDatesForOptAndUtil;
window.resetOptUtilDateTouchFlags = resetOptUtilDateTouchFlags;

// Build static shell once: date filters + empty content area (like utilization container).
function buildOptimizationTabShell() {
  var range = getDefaultOptUtilDateRange();
  $('#optimizationContainer').html(
    '<div class="row" style="margin-bottom:12px;">'
    + '<div class="col-md-2"><label class="utilization-filter-label">FROM DATE</label>'
    + '<input type="date" id="optFromDate" class="form-control" style="border-radius:8px;" value="' + range.from + '"></div>'
    + '<div class="col-md-2"><label class="utilization-filter-label">TO DATE</label>'
    + '<input type="date" id="optToDate" class="form-control" style="border-radius:8px;" value="' + range.to + '"></div>'
    + '<div class="col-md-2" style="margin-top:24px;">'
    + '<button type="button" id="showOptimizationBtn" class="btn btn-primary form-control" style="font-weight:600;height:34px;">Show Optimization</button></div>'
    + '</div><div id="optimizationContent"></div>'
  );
  initializeDefaultDatesForOptAndUtil(false);
}

// Entry point after API success — same data split as fontend_raw_modular/js/app.js optimizeProfile().
function drawOptimizationProfile(responseData) {
  var payload = responseData || {};
  if (payload.success === false) {
    $('#optimizationContent').html('<div class="alert alert-danger text-center">' + optEsc(payload.error || 'Optimization failed.') + '</div>');
    OPT_STATE.optimizationLoaded = false;
    OPT_STATE.hasChanges = false;
    updateReoptimizeButton();
    return;
  }
  var data = payload.data != null ? payload.data : payload;
  var optimizer = data && data.optimizer_result;
  var currentUtil = (data.current_analysis && data.current_analysis.utilization) || [];
  var optimizedUtil = (data.optimized_analysis && data.optimized_analysis.utilization) || [];

  if (!optimizer || !currentUtil.length) {
    $('#optimizationContent').html('<div class="alert alert-info text-center">No optimization data found.</div>');
    OPT_STATE.optimizationLoaded = false;
    OPT_STATE.hasChanges = false;
    updateReoptimizeButton();
    return;
  }

  if (!$('#optimizationContent').length) {
    buildOptimizationTabShell();
  }

  OPT_STATE.optimizer = optimizer;
  OPT_STATE.currentUtil = currentUtil;
  OPT_STATE.optimizedUtil = optimizedUtil;
  OPT_STATE.originalRemotes = ensureUniqueCodes(optimizer.remotes || []);
  OPT_STATE.remoteAdded = [];
  OPT_STATE.remoteRemoved = [];
  OPT_STATE.originalBerths = Object.assign({}, optimizer.berths || {});
  OPT_STATE.deletedKeys = [];
  OPT_STATE.editedRows = berthsObjToRows(optimizer.berths).map(function (r) {
    var origKey = r.key || rowToBerthKey(r);
    return {
      _rowId: OPT_STATE.nextRowId++,
      CLASS: r.CLASS,
      QUOTA: r.QUOTA,
      FROM: r.FROM,
      TO: r.TO,
      BERTHS: r.BERTHS,
      isNew: false,
      removed: false,
      origKey: origKey,
      origSnapshot: {
        QUOTA: r.QUOTA,
        FROM: r.FROM,
        TO: r.TO,
        BERTHS: r.BERTHS
      }
    };
  });
  OPT_STATE.hasChanges = false;
  OPT_STATE.optimizationLoaded = true;
  OPT_STATE.reoptimizing = false;
  OPT_STATE.focusRowId = null;
  OPT_STATE.expandedClasses = {};
  if (!OPT_STATE.activeAddClass && OPT_STATE.editedRows.length) {
    OPT_STATE.activeAddClass = OPT_STATE.editedRows[0].CLASS;
  }
  var compareClasses = getOptCompareClasses();
  if (!OPT_STATE.compareClass || compareClasses.indexOf(OPT_STATE.compareClass) === -1) {
    OPT_STATE.compareClass = compareClasses[0] || OPT_STATE.activeAddClass || ACTIVE_CLASS || '';
  }

  renderOptimizationDashboard(optimizer, currentUtil, optimizedUtil);
  bindOptimizationEditorEvents();
  updateReoptimizeButton();
}

// Berth map keys encode one allocation: CLASS_QUOTA_FROM_TO (e.g. "3A_GN_HWH_NDLS").
// fontend_raw_modular/js/ui.js — parseBerthKey()
function parseBerthKey(key) {
  var parts = String(key || '').split('_');
  if (parts.length >= 4) {
    return { cls: parts[0], quota: parts[1], from: parts[2], to: parts[3] };
  }
  if (parts.length === 3) {
    return { cls: parts[0], quota: parts[1], from: parts[2], to: parts[2] };
  }
  return { cls: parts[0] || '?', quota: parts[1] || '?', from: parts[2] || '?', to: parts[3] || '?' };
}

// fontend_raw_modular/js/ui.js — berthsObjToRows()
function berthsObjToRows(berthsObj) {
  var rows = [];
  Object.keys(berthsObj || {}).forEach(function (key, i) {
    var parsed = parseBerthKey(key);
    rows.push({
      key: key,
      CLASS: parsed.cls,
      QUOTA: parsed.quota,
      FROM: parsed.from,
      TO: parsed.to,
      BERTHS: optNum(berthsObj[key]),
      _idx: i
    });
  });
  rows.sort(function (a, b) {
    if (a.CLASS !== b.CLASS) {
      return a.CLASS.localeCompare(b.CLASS);
    }
    return compareAllocRows(a, b);
  });
  return rows;
}

// Top summary cards read optimizer_result totals (not utilization rows).
//   demand served %  = served_demand / (served + unserved)
//   berth util %     = utilized_berth_km / (utilized + vacant)
// fontend_raw_modular/js/ui.js — renderOptimizerMetrics()
function getOptimizerSummaryMetrics(result) {
  var served = optNum(result.served_demand);
  var unserved = optNum(result.unserved_demand);
  var total = served + unserved;
  var fillPct = total > 0 ? Math.round(served / total * 100) : 0;
  var utilKm = optNum(result.utilized_berth_km);
  var vacantKm = optNum(result.vacant_berth_km);
  var totalKm = utilKm + vacantKm;
  var berthUtil = totalKm > 0 ? Math.round(utilKm / totalKm * 100) : 0;
  var rev = result.revenue_earned;
  var revStr = (rev !== '' && rev != null && !isNaN(Number(rev)))
    ? optFmtCurrency(rev) : '\u2014';
  return {
    served: served,
    unserved: unserved,
    total: total,
    fillPct: fillPct,
    utilKm: utilKm,
    berthUtil: berthUtil,
    revStr: revStr
  };
}

// fontend_raw_modular/js/ui.js — renderProfileComparison() sumMetrics()
// Aggregates utilization matrix rows for comparison grid + charts.
function optSumMetrics(dataArray) {
  var cap = 0;
  var served = 0;
  var unserved = 0;
  var rev = 0;
  var tKm = 0;
  var sKm = 0;
  var clsB = {};
  var quotaB = {};

  (dataArray || []).forEach(function (r) {
    cap += optNum(r.CAPACITY);
    served += optNum(r.SERVED);
    unserved += optNum(r.UNSERVED);
    rev += optNum(r.REVENUE_EARNED);
    tKm += optNum(r.TOTAL_BERTH_KM);
    sKm += optNum(r.SERVED_BERTH_KM);

    var c = String(r.CLASS || '').trim();
    var q = String(r.QUOTA || '').trim();
    if (c) {
      if (!clsB[c]) {
        clsB[c] = { cap: 0, sKm: 0, tKm: 0 };
      }
      clsB[c].cap += optNum(r.CAPACITY);
    }
    if (q) {
      if (!quotaB[q]) {
        quotaB[q] = { sKm: 0, tKm: 0 };
      }
      quotaB[q].sKm += optNum(r.SERVED_BERTH_KM);
      quotaB[q].tKm += optNum(r.TOTAL_BERTH_KM);
    }
  });

  var utilPct = tKm > 0 ? (sKm / tKm) * 100 : 0;
  return { cap: cap, served: served, unserved: unserved, rev: rev, tKm: tKm, sKm: sKm, utilPct: utilPct, clsB: clsB, quotaB: quotaB };
}

function optClsBadge(cls) {
  return 'cb-' + String(cls || '').toLowerCase();
}

// Render order matches fontend_raw_modular optimize tab:
//   metrics → remotes → berth table → comparison → charts.
// No inferred text (recommendations/insights) — only API-derived numbers.
function renderOptimizationDashboard(optimizer, currentUtil, optimizedUtil) {
  var summary = getOptimizerSummaryMetrics(optimizer);
  var berthRows = berthsObjToRows(optimizer.berths);
  var curMetrics = optSumMetrics(currentUtil);
  var optMetrics = optSumMetrics(optimizedUtil);
  var hasComparison = optimizedUtil && optimizedUtil.length > 0;

  var html = ''
    + '<div class="opt-top-bar" style="margin-bottom:12px;">'
    + '<div class="opt-section-title">Optimised profile</div>'
    + '<div class="opt-section-sub">Review and edit berth allocations, then re-optimise.</div>'
    + '</div>'
    + buildOptimizationSummaryCards(summary)
    + buildRemotesSection(optimizer.remotes || [])
    + buildBerthTableSection(OPT_STATE.editedRows.length ? OPT_STATE.editedRows : berthRows)
    + (hasComparison ? buildOptBerthCompareSection() : '<div class="alert alert-warning">Profile comparison charts need optimized_analysis.utilization from API.</div>')
    + '<div class="opt-footer-compact">'
    + '<div id="optChangeSummaryPanel" class="opt-change-summary-panel"></div>'
    + '<div class="opt-action-bar">'
    + '<button type="button" id="optReoptimizeBtn" class="btn btn-primary" disabled>Re-Optimize</button>'
    + '</div></div>';

  $('#optimizationContent').html(html);
  refreshRemotesUi();
  if (hasComparison) {
    renderOptBerthCompare();
    renderOptimizationCharts(curMetrics, optMetrics);
  }
}

// fontend_raw_modular renderOptimizerMetrics() card layout.
function buildOptimizationSummaryCards(summary) {
  var fillCls = summary.fillPct >= 80 ? 'util-value-green' : (summary.fillPct >= 60 ? 'util-value-dark' : 'util-value-red');
  var utilCls = summary.berthUtil >= 80 ? 'util-value-green' : (summary.berthUtil >= 60 ? 'util-value-dark' : 'util-value-red');
  return '<div class="opt-summary-cards">'
    + optSummaryCard('DEMAND SERVED', summary.fillPct + '%', fillCls,
      optFmtNum(summary.served) + ' / ' + optFmtNum(summary.total) + ' pax')
    + optSummaryCard('UNSERVED DEMAND', optFmtNum(summary.unserved), 'util-value-red', 'passengers')
    + optSummaryCard('BERTH UTILIZATION', summary.berthUtil + '%', utilCls,
      optFmtNum(summary.utilKm) + ' km utilized')
    + optSummaryCard('REVENUE EARNED', summary.revStr, 'util-value-dark', '')
    + '</div>';
}

function optSummaryCard(label, value, cls, sub) {
  return '<div class="opt-summary-card"><div class="opt-summary-label">' + optEsc(label) + '</div>'
    + '<div class="opt-summary-value ' + cls + '">' + optEsc(value) + '</div>'
    + (sub ? '<div class="opt-summary-sub">' + optEsc(sub) + '</div>' : '')
    + '</div>';
}

function normalizeRemoteCode(code) {
  return String(code || '').trim().toUpperCase();
}

function ensureUniqueCodes(list) {
  var seen = {};
  return (list || []).map(normalizeRemoteCode).filter(function (code) {
    if (!code || seen[code]) {
      return false;
    }
    seen[code] = true;
    return true;
  });
}

function initRemoteEditState(remotes) {
  OPT_STATE.originalRemotes = ensureUniqueCodes(remotes);
  OPT_STATE.remoteAdded = [];
  OPT_STATE.remoteRemoved = [];
}

function getVisibleRemoteCodes() {
  var removed = {};
  (OPT_STATE.remoteRemoved || []).forEach(function (c) { removed[c] = true; });
  var added = {};
  (OPT_STATE.remoteAdded || []).forEach(function (c) { added[c] = true; });
  var out = [];
  var seen = {};
  (OPT_STATE.originalRemotes || []).forEach(function (c) {
    if (!removed[c] && !seen[c]) {
      seen[c] = true;
      out.push(c);
    }
  });
  (OPT_STATE.remoteAdded || []).forEach(function (c) {
    if (!seen[c]) {
      seen[c] = true;
      out.push(c);
    }
  });
  return out;
}

function buildRemotesSection(remotes) {
  initRemoteEditState(remotes || []);
  var stationOptions = getOptStationOptions();
  return '<div class="opt-remotes-section">'
    + '<div class="opt-remotes-head">'
    + '<span class="opt-remotes-label">Remotes</span>'
    + '<span class="opt-remote-hint">Click chip = keep (green) · × = remove · dropdown = add</span>'
    + '</div>'
    + '<div id="optRemotesPills" class="opt-remote-pills"></div>'
    + '<div class="opt-remote-add-row">'
    + '<select id="optRemoteStationsInput" class="form-control opt-remote-select">'
    + optSelectOptions(stationOptions, '', 'Add remote station', true)
    + '</select>'
    + '<button type="button" id="optRemoteAddBtn" class="btn btn-sm btn-default" title="Add remote station">+</button>'
    + '</div>'
    + '<div id="optRemovedRemotesWrap" class="opt-remote-removed-wrap" style="display:none;">'
    + '<div class="opt-remote-removed-head">'
    + '<span class="opt-remote-removed-label"><i class="fa fa-minus-circle"></i> Removed</span>'
    + '<span class="opt-remote-removed-hint">Click undo to restore</span>'
    + '</div>'
    + '<div id="optRemovedRemotes" class="opt-remote-pills opt-remote-pills-removed"></div>'
    + '</div></div>';
}

function remoteChipHtml(code) {
  var isAdded = (OPT_STATE.remoteAdded || []).indexOf(code) !== -1;
  var cls = isAdded ? 'opt-remote-pill opt-remote-added' : 'opt-remote-pill opt-remote-current';
  var title = isAdded
    ? 'Must remain after reoptimization · × to remove'
    : 'Click to keep (send in remote_added) · × to remove';
  return '<span class="' + cls + '" data-station="' + optEsc(code) + '" title="' + title + '" role="button" tabindex="0">'
    + '<span class="opt-remote-code">' + optEsc(code) + '</span>'
    + '<span class="opt-remote-pill-x" title="Remove">&times;</span>'
    + '</span>';
}

function removedChipHtml(code) {
  return '<span class="opt-remote-pill opt-remote-removed" data-station="' + optEsc(code) + '" title="Removed · click undo to restore">'
    + '<span class="opt-remote-code">' + optEsc(code) + '</span>'
    + '<button type="button" class="opt-remote-restore" title="Restore"><i class="fa fa-undo"></i></button>'
    + '</span>';
}

function refreshRemotesUi() {
  if (!$('#optRemotesPills').length) {
    return;
  }
  var visible = getVisibleRemoteCodes();
  var removed = ensureUniqueCodes(OPT_STATE.remoteRemoved || []);
  $('#optRemotesPills').html(
    visible.length
      ? visible.map(remoteChipHtml).join('')
      : '<span class="opt-remote-empty">No remotes</span>'
  );
  var $wrap = $('#optRemovedRemotesWrap');
  if (!removed.length) {
    $wrap.hide();
    $('#optRemovedRemotes').html('');
    return;
  }
  $('#optRemovedRemotes').html(removed.map(removedChipHtml).join(''));
  $wrap.show();
}

function computeRemoteDelta() {
  return {
    remote_added: ensureUniqueCodes(OPT_STATE.remoteAdded || []),
    remote_removed: ensureUniqueCodes(OPT_STATE.remoteRemoved || [])
  };
}

function markRemoteAsAdded(code) {
  code = normalizeRemoteCode(code);
  if (!code || OPT_STATE.reoptimizing) {
    return;
  }
  OPT_STATE.remoteRemoved = (OPT_STATE.remoteRemoved || []).filter(function (s) { return s !== code; });
  if ((OPT_STATE.remoteAdded || []).indexOf(code) === -1) {
    OPT_STATE.remoteAdded.push(code);
  }
  markOptimizationDirty();
  refreshRemotesUi();
}

function removeRemoteChip(code) {
  code = normalizeRemoteCode(code);
  if (!code || OPT_STATE.reoptimizing) {
    return;
  }
  var isOriginal = (OPT_STATE.originalRemotes || []).indexOf(code) !== -1;
  OPT_STATE.remoteAdded = (OPT_STATE.remoteAdded || []).filter(function (s) { return s !== code; });
  if (isOriginal) {
    if ((OPT_STATE.remoteRemoved || []).indexOf(code) === -1) {
      OPT_STATE.remoteRemoved.push(code);
    }
  } else {
    OPT_STATE.remoteRemoved = (OPT_STATE.remoteRemoved || []).filter(function (s) { return s !== code; });
  }
  markOptimizationDirty();
  refreshRemotesUi();
}

function restoreRemovedRemote(code) {
  code = normalizeRemoteCode(code);
  if (!code || OPT_STATE.reoptimizing) {
    return;
  }
  OPT_STATE.remoteRemoved = (OPT_STATE.remoteRemoved || []).filter(function (s) { return s !== code; });
  markOptimizationDirty();
  refreshRemotesUi();
}

function addRemoteStationFromInput() {
  var el = document.getElementById('optRemoteStationsInput');
  if (!el || OPT_STATE.reoptimizing) {
    return;
  }
  var code = normalizeRemoteCode(el.value);
  if (!code) {
    return;
  }
  markRemoteAsAdded(code);
  el.value = '';
}

function getOptCompareClasses() {
  var set = {};
  (CURRENT_PROFILE.berths || []).forEach(function (r) {
    var cls = r.CLS || r.CLASS || '';
    if (cls) set[cls] = 1;
  });
  getProposedBerthsForCompare().forEach(function (r) {
    var cls = r.CLS || r.CLASS || '';
    if (cls) set[cls] = 1;
  });
  return Object.keys(set).sort();
}

function optRowsToProfileBerths(rows) {
  return (rows || []).filter(function (r) {
    return !r.removed && optNum(r.BERTHS) > 0;
  }).map(function (r) {
    return {
      CLS: r.CLASS,
      QUOTA_TYPE: r.QUOTA,
      SOURCE: r.FROM,
      DESTINATION: r.TO,
      BERTH: r.BERTHS
    };
  });
}

function getProposedBerthsForCompare() {
  if (OPT_STATE.hasChanges && OPT_STATE.editedRows.length) {
    return optRowsToProfileBerths(OPT_STATE.editedRows);
  }
  return optRowsToProfileBerths(berthsObjToRows((OPT_STATE.optimizer && OPT_STATE.optimizer.berths) || {}));
}

function optComputeBerthStats(berths, activeClass, physicalRows) {
  var filtered = (berths || []).filter(function (r) {
    return !activeClass || (r.CLS || r.CLASS || '-') === activeClass;
  });
  var physical = (physicalRows || []).filter(function (r) {
    return !activeClass || (r.CLS || '-') === activeClass;
  });
  var allocated = filtered.reduce(function (a, r) {
    return a + optNum(r.BERTH || r.ALLOCATED_BERTHS || r.BERTHS);
  }, 0);
  var phys = physical.reduce(function (a, r) {
    return a + optNum(r.PHY_BERTHS || r.PHYSICAL_BERTHS);
  }, 0);
  var quotaMap = {};
  var spanMap = {};
  filtered.forEach(function (r) {
    quotaMap[r.QUOTA_TYPE || r.QUOTA || '-'] = 1;
    var src = String(r.SOURCE || r.FROM || '').trim();
    var dest = String(r.DESTINATION || r.TO || '').trim();
    if (src && dest) spanMap[src + '-' + dest] = 1;
  });
  return {
    physical: phys,
    allocated: allocated,
    quotas: Object.keys(quotaMap).length,
    spans: Object.keys(spanMap).length
  };
}

function profileRowToKey(r) {
  return String(r.CLS || r.CLASS || '') + '_'
    + String(r.QUOTA_TYPE || r.QUOTA || '') + '_'
    + String(r.SOURCE || r.FROM || '') + '_'
    + String(r.DESTINATION || r.TO || '');
}

function parseProfileRowKey(key) {
  var parsed = parseBerthKey(key);
  return {
    cls: parsed.cls,
    quota: parsed.quota,
    from: parsed.from,
    to: parsed.to
  };
}

function filterBerthsByClass(berths, activeClass) {
  if (!activeClass) {
    return berths || [];
  }
  return (berths || []).filter(function (r) {
    return (r.CLS || r.CLASS || '-') === activeClass;
  });
}

function getRouteDistMap(route) {
  var distMap = {};
  var maxDist = 1;
  (route || []).forEach(function (r) {
    var code = r.STN_CODE || r.stn_code || '';
    var dist = Number(r.CUMM_DIST || 0);
    if (code) {
      distMap[code] = dist;
      if (dist > maxDist) {
        maxDist = dist;
      }
    }
  });
  return { distMap: distMap, maxDist: maxDist || 1 };
}

function spanPercents(from, to, routeInfo) {
  var distMap = routeInfo.distMap;
  var maxDist = routeInfo.maxDist;
  var left = ((distMap[from] || 0) / maxDist) * 100;
  var width = Math.max((((distMap[to] || 0) - (distMap[from] || 0)) / maxDist) * 100, 1.5);
  return { left: left, width: width };
}

function buildBerthAllocDiffRows(currentBerths, proposedBerths, activeClass) {
  var curMap = {};
  var propMap = {};
  filterBerthsByClass(currentBerths, activeClass).forEach(function (r) {
    var key = profileRowToKey(r);
    curMap[key] = optNum(r.BERTH || r.ALLOCATED_BERTHS || r.BERTHS);
  });
  filterBerthsByClass(proposedBerths, activeClass).forEach(function (r) {
    var key = profileRowToKey(r);
    propMap[key] = optNum(r.BERTH || r.ALLOCATED_BERTHS || r.BERTHS);
  });

  var keys = {};
  Object.keys(curMap).forEach(function (k) { keys[k] = 1; });
  Object.keys(propMap).forEach(function (k) { keys[k] = 1; });

  var rows = Object.keys(keys).map(function (key) {
    var cur = curMap[key] || 0;
    var prop = propMap[key] || 0;
    var meta = parseProfileRowKey(key);
    var status;
    var delta = prop - cur;
    if (cur === 0 && prop > 0) {
      status = 'added';
    } else if (cur > 0 && prop === 0) {
      status = 'removed';
    } else if (delta > 0) {
      status = 'increased';
    } else if (delta < 0) {
      status = 'decreased';
    } else {
      status = 'unchanged';
    }
    return {
      key: key,
      quota: meta.quota,
      from: meta.from,
      to: meta.to,
      cur: cur,
      prop: prop,
      delta: delta,
      status: status
    };
  });

  var order = getRouteStationOrder();
  rows.sort(function (a, b) {
    var qCmp = String(a.quota || '').localeCompare(String(b.quota || ''));
    if (qCmp !== 0) {
      return qCmp;
    }
    var fromCmp = stationRouteIndex(a.from, order) - stationRouteIndex(b.from, order);
    if (fromCmp !== 0) {
      return fromCmp;
    }
    return stationRouteIndex(a.to, order) - stationRouteIndex(b.to, order);
  });
  return rows;
}

function summarizeBerthDiff(rows) {
  var summary = {
    added: 0,
    removed: 0,
    increased: 0,
    decreased: 0,
    unchanged: 0,
    curTotal: 0,
    propTotal: 0
  };
  (rows || []).forEach(function (r) {
    summary.curTotal += r.cur;
    summary.propTotal += r.prop;
    if (r.status === 'added') summary.added += 1;
    else if (r.status === 'removed') summary.removed += 1;
    else if (r.status === 'increased') summary.increased += 1;
    else if (r.status === 'decreased') summary.decreased += 1;
    else summary.unchanged += 1;
  });
  summary.netBerths = summary.propTotal - summary.curTotal;
  return summary;
}

function optDiffBadgeHtml(row) {
  if (row.status === 'added') {
    return '<span class="opt-diff-badge opt-diff-badge-added">Added</span>';
  }
  if (row.status === 'removed') {
    return '<span class="opt-diff-badge opt-diff-badge-removed">Removed</span>';
  }
  if (row.status === 'unchanged') {
    return '<span class="opt-diff-badge opt-diff-badge-same">Same</span>';
  }
  var sign = row.delta > 0 ? '+' : '';
  var cls = row.delta > 0 ? 'opt-diff-badge-up' : 'opt-diff-badge-down';
  return '<span class="opt-diff-badge ' + cls + '">' + sign + row.delta + '</span>';
}

function buildBerthDiffRowsHtml(rows, route, changesOnly) {
  var routeInfo = getRouteDistMap(route);
  var visible = (rows || []).filter(function (r) {
    return !changesOnly || r.status !== 'unchanged';
  });
  if (!visible.length) {
    return '<div class="opt-berth-diff-empty text-muted">'
      + (changesOnly ? 'No allocation changes for this class.' : 'No allocations for this class.')
      + '</div>';
  }
  return visible.map(function (row) {
    var span = spanPercents(row.from, row.to, routeInfo);
    var color = optQuotaColor(row.quota);
    var lightBg = optQuotaColorLight(row.quota, '22');
    var curVisible = row.cur > 0;
    var propVisible = row.prop > 0;
    var berthText = row.status === 'added'
      ? '0 \u2192 ' + row.prop
      : (row.status === 'removed'
        ? row.cur + ' \u2192 0'
        : row.cur + ' \u2192 ' + row.prop);
    return '<div class="opt-diff-row opt-diff-' + row.status + '" data-status="' + row.status + '">'
      + '<div class="opt-diff-quota" style="color:' + color + ';">' + optEsc(row.quota) + '</div>'
      + '<div class="opt-diff-route">' + optEsc(row.from) + '\u2192' + optEsc(row.to) + '</div>'
      + '<div class="opt-diff-track">'
      + (curVisible
        ? '<div class="opt-diff-bar opt-diff-bar-cur" style="left:' + span.left + '%;width:' + span.width + '%;" title="Current: ' + row.cur + ' berths"></div>'
        : '')
      + (propVisible
        ? '<div class="opt-diff-bar opt-diff-bar-prop" style="left:' + span.left + '%;width:' + span.width + '%;background:' + lightBg + ';border-color:' + color + ';color:' + color + ';" title="Proposed: ' + row.prop + ' berths">' + row.prop + '</div>'
        : '')
      + '</div>'
      + '<div class="opt-diff-berths">' + berthText + '</div>'
      + optDiffBadgeHtml(row)
      + '</div>';
  }).join('');
}

function buildBerthDiffSummaryHtml(summary) {
  var net = summary.netBerths;
  var netCls = net > 0 ? 'opt-diff-net-up' : (net < 0 ? 'opt-diff-net-down' : '');
  var netLabel = (net > 0 ? '+' : '') + net;
  return '<div class="opt-berth-diff-summary">'
    + '<span class="opt-diff-summary-total"><strong>' + summary.curTotal + '</strong> \u2192 <strong>' + summary.propTotal + '</strong> quota-berths</span>'
    + '<span class="opt-diff-summary-chip opt-diff-chip-added">+' + summary.added + ' added</span>'
    + '<span class="opt-diff-summary-chip opt-diff-chip-removed">\u2212' + summary.removed + ' removed</span>'
    + '<span class="opt-diff-summary-chip opt-diff-chip-up">\u2191' + summary.increased + ' up</span>'
    + '<span class="opt-diff-summary-chip opt-diff-chip-down">\u2193' + summary.decreased + ' down</span>'
    + '<span class="opt-diff-summary-chip ' + netCls + '">net ' + netLabel + '</span>'
    + '</div>';
}

function buildTopQuotaImpactHtml(rows) {
  var deltaByQuota = {};
  (rows || []).forEach(function (r) {
    var q = String(r.quota || '').trim();
    if (!q) return;
    deltaByQuota[q] = (deltaByQuota[q] || 0) + optNum(r.delta);
  });
  var items = Object.keys(deltaByQuota).map(function (q) {
    return { quota: q, delta: deltaByQuota[q] };
  }).filter(function (x) {
    return x.delta !== 0;
  });
  if (!items.length) {
    return '';
  }
  items.sort(function (a, b) {
    return Math.abs(b.delta) - Math.abs(a.delta);
  });
  var top = items.slice(0, 2).map(function (x) {
    var cls = x.delta > 0 ? 'opt-diff-chip-up' : 'opt-diff-chip-down';
    var sign = x.delta > 0 ? '+' : '';
    return '<span class="opt-diff-summary-chip ' + cls + '">' + optEsc(x.quota) + ' ' + sign + x.delta + '</span>';
  }).join('');
  return '<div class="opt-berth-diff-impact"><span class="opt-impact-label">Top impact</span>' + top + '</div>';
}

function buildOptBerthCompareSection() {
  var classes = getOptCompareClasses();
  var active = OPT_STATE.compareClass || classes[0] || '';
  var changesOnly = OPT_STATE.compareChangesOnly !== false;
  var pills = classes.map(function (cls) {
    var badgeCls = 'cb-' + String(cls).toLowerCase();
    return '<button type="button" class="classPill opt-compare-class-pill ' + badgeCls + (cls === active ? ' active' : '') + '" data-class="' + optEsc(cls) + '">' + optEsc(cls) + '</button>';
  }).join('');
  return '<div class="opt-table-card opt-berth-diff-card">'
    + '<div class="opt-berth-compare-header">'
    + '<div class="opt-berth-compare-title-wrap">'
    + '<div class="utilization-chart-title">Allocation changes \u2014 current vs proposed</div>'
    + '<div id="optCompareClassPills" class="classPills">' + pills + '</div>'
    + '</div>'
    + '<div class="opt-berth-compare-date">Profile date : <b id="optCompareProfileDate">' + optEsc((SELECTED_TRAIN && SELECTED_TRAIN.PROFILE_DATE || '').split('-').reverse().join('-') || '--') + '</b></div>'
    + '</div>'
    + '<div id="optBerthDiffSummary"></div>'
    + '<div class="opt-berth-diff-toolbar">'
    + '<label class="opt-berth-diff-toggle"><input type="checkbox" id="optBerthDiffChangesOnly"' + (changesOnly ? ' checked' : '') + '> Changes only</label>'
    + '<div class="opt-berth-diff-legend">'
    + '<span><i class="opt-diff-legend-swatch opt-diff-legend-cur"></i> Current</span>'
    + '<span><i class="opt-diff-legend-swatch opt-diff-legend-prop"></i> Proposed</span>'
    + '</div></div>'
    + '<div id="optBerthDiffBody" class="opt-berth-diff-body"></div>'
    + '<div class="opt-analysis-tools">'
    + '<button type="button" id="optMetricsToggleBtn" class="btn btn-default btn-sm opt-metrics-toggle">'
    + '<i class="fa fa-line-chart"></i> Utilization metrics <i class="fa fa-chevron-down opt-metrics-chevron"></i>'
    + '</button>'
    + '<button type="button" id="optQuotaChartToggleBtn" class="btn btn-default btn-sm opt-metrics-toggle">'
    + '<i class="fa fa-bar-chart"></i> Fill rate by quota <i class="fa fa-chevron-down opt-metrics-chevron"></i>'
    + '</button>'
    + '</div>'
    + '<div id="optUtilMetricsPanel" class="opt-util-metrics-panel" style="display:none;">'
    + '<div id="optUtilMetricsCollapse"></div>'
    + '</div>'
    + '<div id="optQuotaChartPanel" class="opt-chart-compact" style="display:none;">'
    + '<div class="utilization-chart-title">Fill rate by quota \u2014 current vs proposed</div>'
    + '<div class="opt-chart-compact-canvas"><canvas id="optQuotaCompareChart"></canvas></div>'
    + '</div>'
    + '</div>';
}

function renderOptBerthCompare() {
  if (!$('#optCompareClassPills').length) {
    return;
  }
  var classes = getOptCompareClasses();
  if (!OPT_STATE.compareClass || classes.indexOf(OPT_STATE.compareClass) === -1) {
    OPT_STATE.compareClass = classes[0] || '';
  }
  var activeClass = OPT_STATE.compareClass;
  var changesOnly = OPT_STATE.compareChangesOnly !== false;
  var route = (CURRENT_PROFILE && CURRENT_PROFILE.route) || [];
  var currentBerths = (CURRENT_PROFILE && CURRENT_PROFILE.berths) || [];
  var proposedBerths = getProposedBerthsForCompare();
  var diffRows = buildBerthAllocDiffRows(currentBerths, proposedBerths, activeClass);
  var summary = summarizeBerthDiff(diffRows);

  $('#optCompareClassPills .opt-compare-class-pill').each(function () {
    var cls = $(this).attr('data-class');
    $(this).toggleClass('active', cls === activeClass);
  });
  $('#optCompareProfileDate').text(
    (SELECTED_TRAIN && SELECTED_TRAIN.PROFILE_DATE || '').split('-').reverse().join('-') || '--'
  );
  $('#optBerthDiffChangesOnly').prop('checked', changesOnly);
  $('#optBerthDiffSummary').html(buildBerthDiffSummaryHtml(summary) + buildTopQuotaImpactHtml(diffRows));
  $('#optBerthDiffBody').html(buildBerthDiffRowsHtml(diffRows, route, changesOnly));

  if ($('#optUtilMetricsCollapse').length && OPT_STATE.currentUtil.length && OPT_STATE.optimizedUtil.length) {
    var curMetrics = optSumMetrics(OPT_STATE.currentUtil);
    var optMetrics = optSumMetrics(OPT_STATE.optimizedUtil);
    $('#optUtilMetricsCollapse').html(buildComparisonSection(curMetrics, optMetrics));
  }
}

// Compact allocation tile — quota color matches profile/utilization (getQuotaDisplayColor).
function buildAllocCard(r, cls, stations, quotas, disabled) {
  var rowId = r._rowId != null ? r._rowId : OPT_STATE.nextRowId++;
  r._rowId = rowId;
  var isNew = !!r.isNew;
  var removed = !!r.removed;
  var modified = !isNew && !removed && isRowModified(r);
  var qColor = optQuotaColor(r.QUOTA || (isNew ? '' : '-'));
  var changeLabel = getAllocationChangeLabel(r);
  var stateCls = removed ? ' opt-alloc-removed' : (isNew ? ' opt-alloc-new' : (modified ? ' opt-alloc-modified' : ''));
  var cardDisabled = removed ? ' disabled' : disabled;
  var badge = removed
    ? '<span class="opt-alloc-badge" data-change-type="removed">Removed \u00b7 0 berths</span>'
    : ((isNew || (modified && changeLabel))
      ? '<span class="opt-alloc-badge" data-change-type="' + (isNew ? 'new' : 'modified') + '">' + optEsc(changeLabel || (isNew ? 'New' : 'Modified')) + '</span>'
      : '<span class="opt-alloc-badge" style="display:none;"></span>');
  var quotaLabel = r.QUOTA ? optEsc(r.QUOTA) : 'Quota';
  var diffHtml = modified && r.origSnapshot
    ? '<span class="opt-alloc-diff">Was: <strong>' + optNum(r.origSnapshot.BERTHS) + '</strong></span>'
    : '';
  return '<div class="opt-alloc-card' + stateCls + '" data-row-id="' + rowId + '" data-class="' + optEsc(cls) + '" data-is-new="' + (isNew ? '1' : '0') + '" data-removed="' + (removed ? '1' : '0') + '" data-quota="' + optEsc(r.QUOTA || '') + '" style="--opt-quota-color:' + (removed ? '#94a3b8' : qColor) + ';">'
    + '<div class="opt-alloc-accent"></div>'
    + badge
    + '<div class="opt-alloc-row opt-alloc-row-top">'
    + '<div class="opt-alloc-quota-group">'
    + '<span class="opt-quota-pill">' + quotaLabel + '</span>'
    + '<select class="opt-edit-select opt-edit-quota opt-edit-quota-select"' + cardDisabled + '>' + optSelectOptions(quotas, r.QUOTA, 'Quota') + '</select>'
    + '</div>'
    + '<div class="opt-alloc-berths-compact">'
    + '<span class="opt-alloc-berths-label">Quota-berths</span>'
    + '<input class="opt-berth-input opt-edit-berths" type="number" min="0" value="' + optNum(r.BERTHS) + '"' + cardDisabled + '>'
    + '</div>'
    + '</div>'
    + '<div class="opt-alloc-row opt-alloc-row-route">'
    + '<select class="opt-edit-select opt-edit-from opt-stn-select"' + cardDisabled + '>' + optSelectOptions(stations, r.FROM, 'From', true) + '</select>'
    + '<span class="opt-alloc-arrow">&#8594;</span>'
    + '<select class="opt-edit-select opt-edit-to opt-stn-select"' + cardDisabled + '>' + optSelectOptions(stations, r.TO, 'To', true) + '</select>'
    + '</div>'
    + '<div class="opt-alloc-footer">'
    + diffHtml
    + (removed
      ? '<button type="button" class="btn btn-link opt-restore-row"' + disabled + '><i class="fa fa-undo"></i> Restore</button>'
      : '<button type="button" class="btn btn-link opt-del-row"' + disabled + '><i class="fa fa-trash"></i> Remove</button>')
    + '</div>'
    + '</div>';
}

function buildOptQuotaLegend(rows) {
  var seen = {};
  var items = [];
  (rows || []).forEach(function (r) {
    var q = r.QUOTA || '';
    if (q && !seen[q]) {
      seen[q] = true;
      items.push(q);
    }
  });
  items.sort();
  if (!items.length) {
    return '';
  }
  return '<div class="opt-quota-legend">' + items.map(function (q) {
    var color = optQuotaColor(q);
    return '<span class="opt-quota-legend-item" style="--opt-quota-color:' + color + ';">'
      + '<span class="opt-quota-legend-dot"></span>' + optEsc(q) + '</span>';
  }).join('') + '</div>';
}

function buildBerthTableSection(rows) {
  var byClass = {};
  var stations = getOptStationOptions();
  var quotas = getOptQuotaOptions();
  var disabled = OPT_STATE.reoptimizing ? ' disabled' : '';
  var grandTotal = 0;

  rows.forEach(function (r) {
    if (!byClass[r.CLASS]) {
      byClass[r.CLASS] = [];
    }
    byClass[r.CLASS].push(r);
    if (!r.removed) {
      grandTotal += optNum(r.BERTHS);
    }
  });

  var summaryPills = '<span class="opt-berth-summary-pill opt-berth-summary-total">' + grandTotal + ' quota-berths</span>';
  Object.keys(byClass).sort().forEach(function (cls) {
    var items = byClass[cls];
    var clsTotal = items.reduce(function (s, r) { return r.removed ? s : s + optNum(r.BERTHS); }, 0);
    summaryPills += '<button type="button" class="opt-berth-summary-pill opt-berth-summary-jump" data-class="' + optEsc(cls) + '">'
      + '<span class="opt-cls-badge ' + optClsBadge(cls) + '">' + optEsc(cls) + '</span> '
      + clsTotal + ' quota-berths</button>';
  });

  var panels = '';
  var expanded = OPT_STATE.expandedClasses || {};
  var hasExpandedPref = Object.keys(expanded).length > 0;
  Object.keys(byClass).sort().forEach(function (cls, idx) {
    var items = sortClassRows(byClass[cls]);
    var clsTotal = items.reduce(function (s, r) { return r.removed ? s : s + optNum(r.BERTHS); }, 0);
    var removedCount = items.filter(function (r) { return r.removed; }).length;
    var changeCount = countClassChanges(items);
    var cards = items.map(function (r) {
      return buildAllocCard(r, cls, stations, quotas, disabled);
    }).join('');
    var isOpen = hasExpandedPref ? !!expanded[cls] : (idx === 0);
    var openCls = isOpen ? '' : ' style="display:none;"';
    var meta = '<strong>' + clsTotal + '</strong> quota-berths';
    if (removedCount > 0) {
      meta += ' · <span class="opt-cls-removed-count">' + removedCount + ' removed</span>';
    }
    if (changeCount > 0) {
      meta += ' · <span class="opt-cls-modified-count">' + changeCount + ' modified</span>';
    }
    var warnHtml = changeCount > 0
      ? '<span class="opt-berth-cls-warn">\u26A0 ' + changeCount + ' Unsaved Change' + (changeCount === 1 ? '' : 's') + '</span>'
      : '<span class="opt-berth-cls-warn" style="display:none;"></span>';

    panels += '<div class="opt-berth-cls-panel" data-class="' + optEsc(cls) + '">'
      + '<button type="button" class="opt-berth-cls-head" data-class="' + optEsc(cls) + '">'
      + '<span class="opt-cls-badge ' + optClsBadge(cls) + '">' + optEsc(cls) + '</span>'
      + '<span class="opt-berth-cls-meta">' + meta + '</span>'
      + warnHtml
      + '<i class="fa fa-chevron-down opt-berth-chevron' + (isOpen ? ' open' : '') + '"></i>'
      + '</button>'
      + '<div class="opt-berth-cls-body"' + openCls + '>'
      + '<div class="opt-alloc-grid">' + cards + '</div>'
      + '<button type="button" class="btn btn-link opt-add-row" data-class="' + optEsc(cls) + '"' + disabled + '>+ Add allocation</button>'
      + '</div></div>';
  });

  return '<div class="opt-table-card" id="optBerthTableWrap">'
    + '<div class="opt-berth-toolbar">'
    + '<div><div class="utilization-chart-title" style="margin:0;">Quota-berths</div></div>'
    + '<div class="opt-berth-toolbar-actions">'
    + '<a href="#" id="optBerthExpandAll">Expand all</a><span class="opt-berth-sep">|</span>'
    + '<a href="#" id="optBerthCollapseAll">Collapse all</a>'
    + '</div></div>'
    + '<div class="opt-berth-summary">' + summaryPills + '</div>'
    + buildOptQuotaLegend(rows)
    + panels
    + '</div>';
}

// fontend_raw_modular renderProfileComparison() — 3-column grid: current | delta | proposed.
function buildComparisonSection(cur, opt) {
  // Fill rate = sum(SERVED_BERTH_KM) / sum(TOTAL_BERTH_KM) * 100 per utilization matrix.
  var curUtil = cur.tKm > 0 ? (cur.sKm / cur.tKm) * 100 : 0;
  var optUtil = opt.tKm > 0 ? (opt.sKm / opt.tKm) * 100 : 0;

  return '<div class="opt-compare-card opt-compare-card-inline"><div class="opt-cmp-grid">'
    + optCmpCol('current', 'Current profile', [
      ['Total berths', optFmtNum(cur.cap)],
      ['Utilized berths', optFmtNum(cur.served)],
      ['Fill rate', curUtil.toFixed(2) + '%'],
      ['Unserved demand', optFmtNum(cur.unserved)],
      ['Revenue earned', optFmtCurrency(cur.rev)]
    ])
    + optCmpDeltaCol([
      { val: opt.cap - cur.cap },
      { val: opt.served - cur.served },
      { val: optUtil - curUtil, isPct: true },
      { val: opt.unserved - cur.unserved, invert: true },
      { val: Math.round(opt.rev - cur.rev) }
    ])
    + optCmpCol('proposed', 'Proposed profile', [
      ['Total berths', optFmtNum(opt.cap)],
      ['Utilized berths', optFmtNum(opt.served)],
      ['Fill rate', optUtil.toFixed(2) + '%'],
      ['Unserved demand', optFmtNum(opt.unserved)],
      ['Revenue earned', optFmtCurrency(opt.rev)]
    ])
    + '</div></div>';
}

function optCmpCol(kind, title, metrics) {
  var rows = metrics.map(function (m) {
    return '<div class="opt-cmp-metric"><div class="lbl">' + optEsc(m[0]) + '</div><div class="val">' + optEsc(m[1]) + '</div></div>';
  }).join('');
  return '<div class="opt-cmp-col ' + kind + '"><div class="opt-cmp-title">' + optEsc(title) + '</div>' + rows + '</div>';
}

// Delta column — fontend_raw_modular setDelta(): green = improvement, amber = decline.
// invert=true for unserved demand (a negative delta is good).
function optCmpDeltaCol(deltas) {
  var html = '<div class="opt-cmp-delta"><div class="opt-cmp-title">\u0394</div>';
  (deltas || []).forEach(function (d) {
    html += optDeltaCell(d.val, d.isPct, d.invert);
  });
  return html + '</div>';
}

function optDeltaCell(val, isPct, invertColors) {
  var n = optNum(val);
  var isGood = invertColors ? n < 0 : n > 0;
  var isBad = invertColors ? n > 0 : n < 0;
  var cls = n === 0 ? 'opt-delta-neutral' : (isGood ? 'opt-delta-good' : (isBad ? 'opt-delta-warn' : 'opt-delta-neutral'));
  var sign = n > 0 ? '+' : '';
  var text = isPct
    ? sign + (Math.round(n * 100) / 100).toFixed(2) + '%'
    : sign + optFmtNum(n);
  // Invisible label row keeps deltas vertically aligned with side-column metric values.
  return '<div class="opt-cmp-metric opt-cmp-delta-row"><div class="lbl">&nbsp;</div>'
    + '<div class="val ' + cls + '">' + text + '</div></div>';
}

// Tear down Chart.js instances before re-render (tab reload / date change).
function destroyOptimizationCharts() {
  Object.keys(OPT_CHARTS).forEach(function (k) {
    if (OPT_CHARTS[k]) {
      OPT_CHARTS[k].destroy();
      OPT_CHARTS[k] = null;
    }
  });
}

// fontend_raw_modular renderProfileComparison() — quota fill rate chart only.
function renderOptimizationCharts(cur, opt) {
  destroyOptimizationCharts();
  if (!window.Chart) {
    return;
  }

  var allQuotas = [];
  var qSet = {};
  Object.keys(cur.quotaB || {}).forEach(function (q) { qSet[q] = 1; });
  Object.keys(opt.quotaB || {}).forEach(function (q) { qSet[q] = 1; });
  allQuotas = Object.keys(qSet).sort();

  var curQuotaData = allQuotas.map(function (q) {
    return cur.quotaB[q] && cur.quotaB[q].tKm > 0
      ? Number(((cur.quotaB[q].sKm / cur.quotaB[q].tKm) * 100).toFixed(2)) : 0;
  });
  var optQuotaData = allQuotas.map(function (q) {
    return opt.quotaB[q] && opt.quotaB[q].tKm > 0
      ? Number(((opt.quotaB[q].sKm / opt.quotaB[q].tKm) * 100).toFixed(2)) : 0;
  });
  var curQuotaColors = allQuotas.map(function (q) { return '#64748B99'; });
  var curQuotaBorders = allQuotas.map(function () { return '#64748B'; });
  var optQuotaColors = allQuotas.map(function (q) { return optQuotaColorLight(q, '55'); });
  var optQuotaBorders = allQuotas.map(function (q) { return optQuotaColor(q); });

  var quotaCanvas = document.getElementById('optQuotaCompareChart');
  if (quotaCanvas) {
    OPT_CHARTS.quotaCompare = new Chart(quotaCanvas, {
      type: 'bar',
      data: {
        labels: allQuotas,
        datasets: [
          {
            label: 'Current Util %',
            data: curQuotaData,
            backgroundColor: curQuotaColors,
            borderColor: curQuotaBorders,
            borderWidth: 1,
            borderRadius: 4
          },
          {
            label: 'Proposed Util %',
            data: optQuotaData,
            backgroundColor: optQuotaColors,
            borderColor: optQuotaBorders,
            borderWidth: 1,
            borderRadius: 4
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          tooltip: {
            callbacks: {
              label: function (ctx) {
                return ctx.dataset.label + ': ' + ctx.parsed.y + '%';
              }
            }
          }
        },
        scales: {
          y: {
            beginAtZero: true,
            max: 100,
            ticks: { callback: function (v) { return v + '%'; } }
          }
        }
      }
    });
  }
}

$(function () {
  bindOptimizationEditorEvents();
});
