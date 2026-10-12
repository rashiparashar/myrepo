//var BASE_URL = 'http://localhost:8001';
//var BASE_URL = 'http://10.64.28.95:80/TPO';
var TRAIN_LIST = [];
var SELECTED_TRAIN = null;
var CURRENT_PROFILE = null;
var ACTIVE_CLASS = null;
var CURRENT_HOLIDAYS = [];
var DEMAND_MODE = "daily";
var CURRENT_DEMAND_ROWS = [];
var CURRENT_DEMAND_DATE_KEY = '';

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
//function apiFetchDemand(num,siteId,startDate,endDate){
//	  return fetch(BASE_URL + '/train/demand/' + encodeURIComponent(num) + '?site_id=' + encodeURIComponent(siteId) + '&start_date=' + encodeURIComponent(startDate) + '&end_date=' + encodeURIComponent(endDate))
//	    .then(function(r){ if(!r.ok) throw new Error('demand'); return safeJson(r); });
//	}
function apiFetchDemand(num, siteId, startDate, endDate) {

    var requestData = {
        params: [
            num,
            siteId,
            startDate,
            endDate
        ]
    };

    return getWebServiceDataTrain(
        requestData,
        '/newtemplatebasedmis/webapi/typeOne/getTrainDemand'
    );
}
function distinctVals(rows,key){ var m={},o=[]; rows.forEach(function(r){var v=r[key]||''; if(v && !m[v]){m[v]=1;o.push(v);} }); return o.sort(); }
function distinctValsAny(rows,keys){ var m={},o=[]; rows.forEach(function(r){ var v = pick(r, keys) || ''; if(v && !m[v]){m[v]=1;o.push(v);} }); return o.sort(); }
function setSelectOptions(elId, values, allLabel, titleFn){ var el=byId(elId); if(!el) return; var current = el.value; var options = allLabel ? [''] : []; values.forEach(function(v){ if(v !== '') options.push(v); }); el.innerHTML = options.map(function(v){ var label = v === '' ? allLabel : v; var title = (v !== '' && typeof titleFn === 'function') ? titleFn(v) : ''; return '<option value="'+v+'"'+(title ? ' title="'+optEsc(title)+'"' : '')+'>'+label+'</option>'; }).join(''); if (current && options.indexOf(current) !== -1) el.value = current; }
//function refreshDemandFilterOptions(rows){
//    rows = rows || [];
//
//    // Route order stations
//    var routeStations = [];
//    var seen = {};
//
//    (CURRENT_PROFILE.route || []).forEach(function(r){
//        var stn = r.STN_CODE;
//        if(stn && !seen[stn]){
//            seen[stn] = true;
//            routeStations.push(stn);
//        }
//    });
//
//    setSelectOptions('demandFromStn', routeStations, 'All');
//    setSelectOptions('demandToStn', routeStations, 'All');
//
//    setSelectOptions(
//        'demandClass',
//        distinctValsAny(rows,['CLS','CLASS']),
//        'All Classes'
//    );
//
//    setSelectOptions(
//        'demandQuota',
//        distinctValsAny(rows,['QUOTA_TYPE','QUOTA']),
//        'All Quotas',
//        quotaTitleIfDifferent
//    );
//}
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

    // Classes from API demand data
    var classes = distinctValsAny(rows, ['CLS','CLASS']);

    setSelectOptions(
        'demandClass',
        classes,
        'All Classes'
    );

    // Quotas initially show all quotas from API
    var quotas = distinctValsAny(rows, ['QUOTA_TYPE','QUOTA']);

    setSelectOptions(
        'demandQuota',
        quotas,
        'All Quotas',
        quotaTitleIfDifferent
    );
}
function refreshDemandQuotaByClass(){

    var rows = CURRENT_DEMAND_ROWS || [];

    var selectedClass = byId('demandClass').value;

    // If All Classes is selected, show all quotas
    if(!selectedClass){

        setSelectOptions(
            'demandQuota',
            distinctValsAny(rows, ['QUOTA_TYPE','QUOTA']),
            'All Quotas',
            quotaTitleIfDifferent
        );

        return;
    }

    // Filter API rows for selected class
    var classRows = rows.filter(function(r){

        return demandField(r, ['CLS','CLASS']) === selectedClass;

    });

    // Get only distinct quotas available for selected class
    var quotas = distinctValsAny(
        classRows,
        ['QUOTA_TYPE','QUOTA']
    );

    setSelectOptions(
        'demandQuota',
        quotas,
        'All Quotas',
        quotaTitleIfDifferent
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
//    byId('demandFromStn').onchange = function () {
//
//        var fromStn = this.value;
//
//        if (!fromStn) {
//            setSelectOptions('demandToStn', routeStations, 'All');
//            return;
//        }
//
//        var idx = routeStations.indexOf(fromStn);
//
//        if (idx >= 0) {
//            setSelectOptions(
//                'demandToStn',
//                routeStations.slice(idx + 1),
//                'All'
//            );
//        }
//    };
    byId('demandFromStn').onchange = function () {

        var fromStn = this.value;

        if (!fromStn) {
            setSelectOptions('demandToStn', routeStations, 'All');
        } else {
            var idx = routeStations.indexOf(fromStn);

            if (idx >= 0) {
                setSelectOptions(
                    'demandToStn',
                    routeStations.slice(idx + 1),
                    'All'
                );
            }
        }

        renderDemandFromRows(CURRENT_DEMAND_ROWS, CURRENT_HOLIDAYS);
    };
    byId('demandClass').addEventListener('change', function () {
        refreshDemandQuotaByClass();
        renderDemandFromRows(CURRENT_DEMAND_ROWS, CURRENT_HOLIDAYS);
    });
    byId('demandQuota').addEventListener('change', function () {
        renderDemandFromRows(CURRENT_DEMAND_ROWS, CURRENT_HOLIDAYS);
    });

    byId('demandToStn').addEventListener('change', function () {
        renderDemandFromRows(CURRENT_DEMAND_ROWS, CURRENT_HOLIDAYS);
    });
    var today = new Date();
    var maxDate = addDays(today, 120);


    byId('demandFrom').max = fmtDate(maxDate);
    byId('demandTo').max   = fmtDate(maxDate);

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
  // Remote matrix needs all OD pairs; only class/quota filters apply.
  var remoteRows = rows.filter(function (r) {
    return (!cls || demandField(r, ['CLS', 'CLASS']) === cls)
      && (!quota || demandField(r, ['QUOTA_TYPE', 'QUOTA']) === quota);
  });
  renderRemoteWiseDemand(remoteRows);
}

/** Route stations in order, with F_REM_LOC remote flag. */
function getDemandRouteStations() {
  var route = (CURRENT_PROFILE && CURRENT_PROFILE.route) || [];
  var out = [];
  var seen = {};
  route.forEach(function (r) {
    var code = String(r.STN_CODE || '').trim();
    if (!code || seen[code]) {
      return;
    }
    seen[code] = true;
    out.push({
      code: code,
      isRemote: String(r.F_REM_LOC || r.f_rem_loc || '').toUpperCase() === 'Y'
        || String(r.IS_REMOTE || r.is_remote || '').toUpperCase() === 'Y'
        || r.IS_REMOTE === true || r.is_remote === true
    });
  });
  return out;
}

/** Remotes in route order — F_REM_LOC / IS_REMOTE; termini always included. */
function getRemoteStationsForDemand() {
  var stations = getDemandRouteStations();
  if (!stations.length) {
    return [];
  }
  var remotes = [];
  stations.forEach(function (s, idx) {
    if (s.isRemote || idx === 0 || idx === stations.length - 1) {
      remotes.push(s.code);
    }
  });
  return remotes;
}

/**
 * Map each station to origin-remote (preceding remote) and dest-remote (succeeding remote).
 * Non-remotes: origin groups with previous remote; destination groups with next remote.
 */
function buildRemoteSegmentMaps(stations, remotes) {
  var remoteSet = {};
  remotes.forEach(function (r) { remoteSet[r] = true; });
  var originRemote = {};
  var destRemote = {};
  var lastRemote = null;
  var i;
  for (i = 0; i < stations.length; i++) {
    var code = stations[i].code;
    if (remoteSet[code]) {
      lastRemote = code;
    }
    if (lastRemote) {
      originRemote[code] = lastRemote;
    }
  }
  var nextRemote = null;
  for (i = stations.length - 1; i >= 0; i--) {
    code = stations[i].code;
    if (remoteSet[code]) {
      nextRemote = code;
    }
    if (nextRemote) {
      destRemote[code] = nextRemote;
    }
  }
  return { originRemote: originRemote, destRemote: destRemote };
}

function demandPsgnValue(row) {
  return Number(row.TOT_PSGN || row.tot_psgn || row.DEMAND || row.demand || 0) || 0;
}

/**
 * Aggregate OD demand into remote×remote matrices (overall + per class).
 * Values are average per distinct journey date in the filtered rows.
 */
function buildRemoteWiseDemandData(rows) {
  rows = rows || [];
  var stations = getDemandRouteStations();
  var remotes = getRemoteStationsForDemand();
  var empty = { remotes: remotes, overall: {}, byClass: {}, dayCount: 0 };
  if (remotes.length < 2 || !stations.length) {
    return empty;
  }
  var maps = buildRemoteSegmentMaps(stations, remotes);
  var dates = {};
  var overall = {};
  var byClass = {};

  rows.forEach(function (r) {
    var from = String(demandField(r, ['FROM_STN', 'SOURCE']) || '').trim();
    var to = String(demandField(r, ['TO_STN', 'DESTINATION']) || '').trim();
    var cls = String(demandField(r, ['CLS', 'CLASS']) || '').trim() || '-';
    var date = String(r.JOURNEY_DATE || '').trim();
    var val = demandPsgnValue(r);
    if (!from || !to || !val) {
      return;
    }
    var fromRemote = maps.originRemote[from];
    var toRemote = maps.destRemote[to];
    if (!fromRemote || !toRemote || fromRemote === toRemote) {
      return;
    }
    // Only forward remote pairs (origin remote before dest remote on route)
    var fi = remotes.indexOf(fromRemote);
    var ti = remotes.indexOf(toRemote);
    if (fi < 0 || ti < 0 || fi >= ti) {
      return;
    }
    if (date) {
      dates[date] = true;
    }
    var key = fromRemote + '|' + toRemote;
    overall[key] = (overall[key] || 0) + val;
    if (!byClass[cls]) {
      byClass[cls] = {};
    }
    byClass[cls][key] = (byClass[cls][key] || 0) + val;
  });

  var dayCount = Object.keys(dates).length || 1;
  function avgMap(map) {
    var out = {};
    Object.keys(map).forEach(function (k) {
      out[k] = Math.round(map[k] / dayCount);
    });
    return out;
  }
  var avgByClass = {};
  Object.keys(byClass).forEach(function (cls) {
    avgByClass[cls] = avgMap(byClass[cls]);
  });
  return {
    remotes: remotes,
    overall: avgMap(overall),
    byClass: avgByClass,
    dayCount: dayCount
  };
}

function buildRemoteDemandMatrixHtml(title, remotes, values) {
  remotes = remotes || [];
  values = values || {};
  if (remotes.length < 2) {
    return '<div class="remote-demand-empty">Remote stations not available for this train.</div>';
  }
  var html = '<div class="remote-demand-block"><h5>' + optEsc(title) + '</h5>'
    + '<div class="remote-demand-table-wrap"><table class="remote-demand-table"><thead><tr><th></th>';
  remotes.forEach(function (r) {
    html += '<th>' + optEsc(r) + '</th>';
  });
  html += '</tr></thead><tbody>';
  remotes.forEach(function (from, fi) {
    html += '<tr><td class="row-head">' + optEsc(from) + '</td>';
    remotes.forEach(function (to, ti) {
      var val = 0;
      if (fi < ti) {
        val = values[from + '|' + to] || 0;
      }
      html += '<td' + (val === 0 ? ' class="zero"' : '') + '>' + val + '</td>';
    });
    html += '</tr>';
  });
  html += '</tbody></table></div></div>';
  return html;
}

function renderRemoteWiseDemand(rows) {
  var overallWrap = byId('remoteDemandOverallWrap');
  var classWrap = byId('remoteDemandClassWrap');
  if (!overallWrap || !classWrap) {
    return;
  }
  var data = buildRemoteWiseDemandData(rows);
  window.CURRENT_REMOTE_DEMAND_DATA = data;
  if (!data.remotes.length) {
    overallWrap.innerHTML = '<div class="remote-demand-empty">Load a train profile to view remote-wise demand.</div>';
    classWrap.innerHTML = '';
    return;
  }
  if (data.remotes.length < 2) {
    overallWrap.innerHTML = '<div class="remote-demand-empty">At least two remote stations are required.</div>';
    classWrap.innerHTML = '';
    return;
  }
  overallWrap.innerHTML = buildRemoteDemandMatrixHtml('Overall Remote Demand', data.remotes, data.overall);
  var classes = Object.keys(data.byClass).sort();
  if (!classes.length) {
    classWrap.innerHTML = '<div class="remote-demand-empty">No class-wise remote demand for the selected filters.</div>';
    return;
  }
  classWrap.innerHTML = '<div class="remote-demand-block"><h5>Class-wise Remote Demand</h5></div>'
    + classes.map(function (cls) {
      return buildRemoteDemandMatrixHtml(cls, data.remotes, data.byClass[cls]);
    }).join('');
}
window.renderRemoteWiseDemand = renderRemoteWiseDemand;

function downloadRemoteWiseDemandPdf() {
  try {
    var jsPdfCtor = window.jspdf && window.jspdf.jsPDF;
    if (!jsPdfCtor) {
      alert('PDF download library is not available. Please refresh the page and try again.');
      return;
    }
    var data = window.CURRENT_REMOTE_DEMAND_DATA;
    if (!data || !data.remotes || !data.remotes.length) {
      var cls = byId('demandClass') ? byId('demandClass').value : '';
      var quota = byId('demandQuota') ? byId('demandQuota').value : '';
      var remoteRows = (CURRENT_DEMAND_ROWS || []).filter(function (r) {
        return (!cls || demandField(r, ['CLS', 'CLASS']) === cls)
          && (!quota || demandField(r, ['QUOTA_TYPE', 'QUOTA']) === quota);
      });
      data = buildRemoteWiseDemandData(remoteRows);
    }
    if (!data || !data.remotes || data.remotes.length < 2) {
      alert('No remote-wise demand data available to download.');
      return;
    }
    var doc = new jsPdfCtor({ orientation: 'landscape', unit: 'mm', format: 'a4' });
    if (typeof doc.autoTable !== 'function') {
      alert('PDF table library is not available. Please refresh the page and try again.');
      return;
    }
    var trainNo = SELECTED_TRAIN ? getTrainNumber(SELECTED_TRAIN) : '-';
    var trainName = SELECTED_TRAIN ? getTrainName(SELECTED_TRAIN) : '';
    var sd = byId('demandFrom') ? byId('demandFrom').value : '';
    var ed = byId('demandTo') ? byId('demandTo').value : '';
    var created = new Date();
    var createdStr = ('0' + created.getDate()).slice(-2) + '-'
      + ('0' + (created.getMonth() + 1)).slice(-2) + '-'
      + created.getFullYear();
    var sdFmt = (sd || '').replace(/^(\d{4})-(\d{2})-(\d{2})$/, '$3-$2-$1') || sd;
    var edFmt = (ed || '').replace(/^(\d{4})-(\d{2})-(\d{2})$/, '$3-$2-$1') || ed;

    doc.setFillColor(27, 79, 216);
    doc.rect(0, 0, 297, 28, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(16);
    doc.setFont(undefined, 'bold');
    doc.text('Remote-wise Demand', 14, 12);
    doc.setFontSize(10);
    doc.setFont(undefined, 'normal');
    doc.text('Train: ' + trainNo + (trainName ? ' - ' + trainName : ''), 14, 20);
    doc.text('Period: ' + sdFmt + ' to ' + edFmt + '   |   Profile Creation Date: ' + createdStr, 14, 25);

    var y = 36;
    doc.setTextColor(31, 47, 77);
    doc.setFontSize(9);
    doc.text('Note: Demand between remotes is the sum of all OD pairs mapped to that remote pair. Average demand is shown for the selected date range.', 14, y, { maxWidth: 270 });
    y += 10;

    function matrixBody(remotes, values) {
      return remotes.map(function (from, fi) {
        return [from].concat(remotes.map(function (to, ti) {
          return (fi < ti) ? String(values[from + '|' + to] || 0) : '0';
        }));
      });
    }

    function addMatrix(title, remotes, values) {
      if (y > 160) {
        doc.addPage();
        y = 20;
      }
      doc.setTextColor(27, 79, 216);
      doc.setFontSize(11);
      doc.setFont(undefined, 'bold');
      doc.text(title, 14, y);
      doc.autoTable({
        startY: y + 3,
        head: [[''].concat(remotes)],
        body: matrixBody(remotes, values || {}),
        theme: 'grid',
        styles: { fontSize: 7, cellPadding: 1.5, halign: 'center', valign: 'middle' },
        headStyles: { fillColor: [27, 79, 216], textColor: [255, 255, 255], fontStyle: 'bold' },
        columnStyles: { 0: { fillColor: [238, 243, 255], textColor: [27, 79, 216], fontStyle: 'bold', halign: 'left' } },
        margin: { left: 14, right: 14 }
      });
      y = doc.lastAutoTable.finalY + 12;
    }

    addMatrix('Overall Remote Demand', data.remotes, data.overall);
    Object.keys(data.byClass || {}).sort().forEach(function (cls) {
      addMatrix('Class ' + cls, data.remotes, data.byClass[cls]);
    });

    var fileName = 'remote-wise-demand-' + String(trainNo).replace(/[^a-z0-9_-]+/gi, '-')
      + '-' + String(sd).replace(/[^a-z0-9_-]+/gi, '-') + '.pdf';
    doc.save(fileName);
  } catch (e) {
    console.error(e);
    alert('Failed to generate remote-wise demand PDF. Please try again.');
  }
}
window.downloadRemoteWiseDemandPdf = downloadRemoteWiseDemandPdf;
function setDemandButtonLoading(isLoading){
  var applyBtn = byId('applyDemandBtn');
  if (!applyBtn) return;
  applyBtn.disabled = isLoading;
  applyBtn.textContent = isLoading ? 'Loading...' : 'Apply Date Filter';
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
  var sd = byId('demandFrom').value;
  var ed = byId('demandTo').value;

  var fromDate = new Date(sd);
  var toDate = new Date(ed);

  var diffDays = Math.floor(
    (toDate.getTime() - fromDate.getTime()) /
    (1000 * 60 * 60 * 24)
  );

  if (diffDays < 0) {
    alert('From Date cannot be greater than To Date.');
    return Promise.resolve();
  }

  if (diffDays > 180) {
    alert('Demand date range cannot be greater than 180 days.');
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
    renderRemoteWiseDemand([]);
    alert('Failed to fetch demand data');
  }).then(function(){
    setDemandButtonLoading(false);
  });
}

function byId(id){ return document.getElementById(id); }
function safeJson(res){ return res.json().then(function(d){ return d && d.data ? d.data : d; }); }

function apiFetchTrainList() {

    var curDate = new Date().toISOString().slice(0, 10);

    var requestData = {params: [curDate]};
//    log.info("TrainList");
    return getWebServiceDataTrain(
        requestData,'/newtemplatebasedmis/webapi/typeOne/getTrainList');
}
function apiFetchTrainDetails(num, siteId, profileDate) {

    var requestData = {
        params: [
            num,
            siteId,
            profileDate
        ]
    };

    return getWebServiceDataTrain(
        requestData,
        '/newtemplatebasedmis/webapi/typeOne/getTrainDetails'
    );
}
function apiFetchTrainProfile(num, siteId, profileDate) {

    var requestData = {
        params: [
            num,
            siteId,
            profileDate
        ]
    };

    return getWebServiceDataTrain(
        requestData,
        '/newtemplatebasedmis/webapi/typeOne/getTrainProfileData'
    );
}
function apiFetchTrainUtilization(num,siteId,profileDate,fromDate,toDate) {
    var requestData = {
        params: [num,siteId,profileDate,fromDate,toDate] };
    return getWebServiceDataTrain(
        requestData,
        '/newtemplatebasedmis/webapi/typeOne/getTrainUtilization'
    );
}

//function apiFetchTrainOptimization(num, siteId, profileDate, fromDate, toDate, reoptDelta){
//	var url = BASE_URL + '/train/train/optimize/' + encodeURIComponent(num);
//	var body = {
//		site_id: String(siteId),
//		profile_date: profileDate,
//		start_date: fromDate,
//		end_date: toDate
//	};
//	if (reoptDelta && reoptDelta.edited_berths && Object.keys(reoptDelta.edited_berths).length) {
//		body.edited_berths = reoptDelta.edited_berths;
//	}
//	if (reoptDelta && Array.isArray(reoptDelta.remote_added) && reoptDelta.remote_added.length) {
//		body.remote_added = reoptDelta.remote_added;
//	}
//	if (reoptDelta && Array.isArray(reoptDelta.remote_removed) && reoptDelta.remote_removed.length) {
//		body.remote_removed = reoptDelta.remote_removed;
//	}
//	return fetch(url, {
//		method: 'POST',
//		headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
//		body: JSON.stringify(body)
//	}).then(function (r) {
//		if (!r.ok) {
//			throw new Error('optimize');
//		}
//		return r.json();
//	});
//}
function apiFetchTrainOptimization(
	    num,
	    siteId,
	    profileDate,
	    fromDate,
	    toDate,
	    endToEnd,
	    reoptDelta
	) {

	    var requestData = {
	        params: [
	            num,
	            siteId,
	            profileDate,
	            fromDate,
	            toDate,
	            endToEnd.flag,
	            endToEnd.fromStation,
	            endToEnd.toStation
	        ]
	    };

	    if (reoptDelta &&
	        reoptDelta.edited_berths &&
	        Object.keys(reoptDelta.edited_berths).length) {

	        requestData.edited_berths =
	            reoptDelta.edited_berths;
	    }

	    // Always send full current composition (composite keys "CLS|BERTH_COMP").
	    var composition = buildFullCompositionPayload();
	    requestData.edited_coaches = composition.edited_coaches;
	    requestData.edited_phy_berths = composition.edited_phy_berths;

	    if (reoptDelta &&
	        Array.isArray(reoptDelta.remote_added) &&
	        reoptDelta.remote_added.length) {

	        requestData.remote_added =
	            reoptDelta.remote_added;
	    }

	    if (reoptDelta &&
	        Array.isArray(reoptDelta.remote_removed) &&
	        reoptDelta.remote_removed.length) {

	        requestData.remote_removed =
	            reoptDelta.remote_removed;
	    }

	    captureOptimizeRequestPayload(requestData);
	    logOptimizationRequest('apiFetchTrainOptimization', reoptDelta, requestData);

	    return getWebServiceDataTrain(
	        requestData,
	        '/newtemplatebasedmis/webapi/typeOne/getTrainOptimization'
	    );
	}
function getOptimizationRouteStations() {
	  var route = (CURRENT_PROFILE && CURRENT_PROFILE.route) || [];
	  var seen = {};
	  return route.map(function (station) { return station.STN_CODE; }).filter(function (station) {
	    if (!station || seen[station]) return false;
	    seen[station] = true;
	    return true;
	  });
	}

	function populateOptimizationEndToEndStations() {
	  var stations = getOptimizationRouteStations();
	  setSelectOptions('optEndToEndFromStation', stations, 'Select station');
	  setSelectOptions('optEndToEndToStation', stations, 'Select station');
	}

	function updateOptimizationEndToEndFields() {
	  var isEndToEnd = $('#optTrainType').val() === 'END_TO_END';
	  $('#optEndToEndStations').toggle(isEndToEnd);
	  $('#optEndToEndFromStation, #optEndToEndToStation').prop('disabled', !isEndToEnd);
	  if (!isEndToEnd) {
	    $('#optEndToEndFromStation, #optEndToEndToStation').val('');
	  }
	}

	function getOptimizationEndToEndSelection() {
	  var isEndToEnd = $('#optTrainType').val() === 'END_TO_END';
	  return {
	    flag: isEndToEnd ? 'Y' : 'N',
	    fromStation: isEndToEnd ? ($('#optEndToEndFromStation').val() || '') : '',
	    toStation: isEndToEnd ? ($('#optEndToEndToStation').val() || '') : ''
	  };
	}
	function validateOptimizationEndToEndSelection() {
	    var trainType = $('#optTrainType').val();
	    if (!trainType) return true;

	    if (trainType !== 'END_TO_END') return true;
	    var selection = getOptimizationEndToEndSelection();
	    var stations = getOptimizationRouteStations();

	    if (!selection.fromStation || !selection.toStation) {
	        alert('Please select End to End FROM and TO stations');
	        return false;
	    }

	    if (stations.indexOf(selection.fromStation) >= stations.indexOf(selection.toStation)) {
	        alert('End to End FROM station must be before End to End TO station');
	        return false;
	    }

	    return true;
	}

function captureOptimizeRequestPayload(requestData) {
  try {
    OPT_PROFILE.lastRequestPayload = JSON.parse(JSON.stringify(requestData || {}));
  } catch (e) {
    OPT_PROFILE.lastRequestPayload = requestData || null;
  }
}

function applySavedOptimizePayloadToState(payload, opts) {
  var body = toOptimizeRequestPayload(payload);
  var migratedCoaches = migrateCompositionKeyMaps(
    body.edited_coaches || {},
    body.edited_berth_comp || {}
  );
  OPT_STATE.persistedEditedBerths = Object.assign({}, body.edited_berths || {});
  OPT_STATE.persistedEditedCoaches = Object.assign({}, migratedCoaches.coaches);
  OPT_STATE.persistedEditedBerthComp = Object.assign({}, migratedCoaches.berthComp);
  OPT_STATE.persistedEditedPhyBerths = Object.assign({}, body.edited_phy_berths || {});
  OPT_STATE.persistedRemoteAdded = ensureUniqueCodes(body.remote_added || []);
  OPT_STATE.persistedRemoteRemoved = ensureUniqueCodes(body.remote_removed || []);
  restoreRemoteStateFromPersisted();
  ensureCoachStateInitialized();
  restoreCoachesFromPersisted();
  renderPreOptimizeComposition();
  // Skip when Show Optimization should keep the user's current UI dates.
  if (!(opts && opts.skipDates)) {
    applyOptDatesFromPayload(body);
  }
}

function applyOptDatesFromPayload(body) {
  var fromDate = '';
  var toDate = '';
  if (Array.isArray(body.params) && body.params.length >= 5) {
    fromDate = body.params[3] || '';
    toDate = body.params[4] || '';
  }
  fromDate = fromDate || body.start_date || body.fromDate || '';
  toDate = toDate || body.end_date || body.toDate || '';
  if ($('#optFromDate').length && fromDate) {
    $('#optFromDate').val(fromDate);
    OPT_DATES_TOUCHED.opt = true;
  }
  if ($('#optToDate').length && toDate) {
    $('#optToDate').val(toDate);
    OPT_DATES_TOUCHED.opt = true;
  }
}

/** Stamp UI from/to onto a saved-profile optimize payload (params[3]/params[4]). */
function stampOptimizePayloadDates(payload, fromDate, toDate) {
  if (!payload) {
    return payload;
  }
  var next;
  try {
    next = JSON.parse(JSON.stringify(payload));
  } catch (e) {
    next = Object.assign({}, payload);
    if (Array.isArray(payload.params)) {
      next.params = payload.params.slice();
    }
  }
  fromDate = fromDate || ($('#optFromDate').length ? $('#optFromDate').val() : '') || '';
  toDate = toDate || ($('#optToDate').length ? $('#optToDate').val() : '') || '';
  if (Array.isArray(next.params)) {
    while (next.params.length < 5) {
      next.params.push('');
    }
    if (fromDate) {
      next.params[3] = fromDate;
    }
    if (toDate) {
      next.params[4] = toDate;
    }
  }
  // Do NOT set start_date/end_date on the request body — RequestParameters rejects unknown fields.
  // Java proxy reads dates from params[3]/params[4] and maps them when calling TPO.
  delete next.start_date;
  delete next.end_date;
  delete next.fromDate;
  delete next.toDate;
  return next;
}

function restoreDefaultOptDates() {
  var range = getDefaultOptUtilDateRange();
  OPT_DATES_TOUCHED.opt = false;
  if ($('#optFromDate').length) {
    $('#optFromDate').val(range.from);
  }
  if ($('#optToDate').length) {
    $('#optToDate').val(range.to);
  }
}

function postSavedOptimizePayload(payload) {
  // Only fields RequestParameters accepts — strip start_date/end_date etc. that break Jackson.
  var src = payload || {};
  var composition = buildFullCompositionPayload();
  var requestData = {
    params: Array.isArray(src.params) ? src.params.slice() : [],
    edited_berths: src.edited_berths || {},
    edited_coaches: composition.edited_coaches,
    edited_phy_berths: composition.edited_phy_berths,
    remote_added: src.remote_added || [],
    remote_removed: src.remote_removed || []
  };
  var endToEnd = getOptimizationEndToEndSelection();
  while (requestData.params.length < 5) requestData.params.push('');
  requestData.params[5] = endToEnd.flag;
  requestData.params[6] = endToEnd.fromStation;
  requestData.params[7] = endToEnd.toStation;
  captureOptimizeRequestPayload(requestData);
  logOptimizationRequest('savedProfile', null, requestData);
  return getWebServiceDataTrain(
    requestData,
    '/newtemplatebasedmis/webapi/typeOne/getTrainOptimization'
  );
}

function unwrapTpoResponse(res) {
  if (res && res.success === false) {
    throw new Error(res.error || res.message || (res.error && res.error.message) || 'Request failed');
  }
  if (res && res.data != null && typeof res.data === 'object') {
    return res.data;
  }
  return res;
}

function looksLikeProfileId(value) {
  return /^\d{4,5}[_-]\d+$/.test(String(value || '').trim());
}

function profileIdFromValue(value) {
  if (value == null || value === '') {
    return '';
  }
  if (typeof value === 'string') {
    var text = value.trim();
    if (looksLikeProfileId(text)) {
      return text;
    }
    if (text.charAt(0) === '{' || text.charAt(0) === '[') {
      try {
        return profileIdFromValue(JSON.parse(text));
      } catch (e) {
        return '';
      }
    }
    return '';
  }
  if (Array.isArray(value)) {
    return profileIdFromValue(value[0]);
  }
  if (typeof value === 'object') {
    var direct = value.PROFILE_ID || value.profile_id || value.profileId;
    if (direct != null && String(direct).trim()) {
      return String(direct).trim();
    }
  }
  return '';
}

function extractProfileIds(res) {
  var root = unwrapTpoResponse(res);
  if (root == null) {
    root = res;
  }
  var rows = null;
  if (Array.isArray(root)) {
    rows = root;
  } else if (root && Array.isArray(root.train_profile)) {
    rows = root.train_profile;
  } else if (root && root.data && Array.isArray(root.data.train_profile)) {
    rows = root.data.train_profile;
  } else if (res && res.data && Array.isArray(res.data.train_profile)) {
    rows = res.data.train_profile;
  }
  if (!rows) {
    return [];
  }
  var ids = [];
  rows.forEach(function (item) {
    var id = profileIdFromValue(item);
    if (id && ids.indexOf(id) === -1) {
      ids.push(id);
    }
  });
  ids.sort(function (a, b) {
    return a.localeCompare(b, undefined, { numeric: true });
  });
  return ids;
}

function profileListCacheKey(trainNo, siteId) {
  return String(trainNo || '').trim() + '|' + String(siteId || '').trim();
}

function rememberSavedProfileId(trainNo, siteId, profileId) {
  var id = String(profileId || '').trim();
  if (!id) {
    return;
  }
  var key = profileListCacheKey(trainNo, siteId);
  var list = OPT_PROFILE.savedIdsByKey[key] || [];
  if (list.indexOf(id) === -1) {
    list.push(id);
  }
  OPT_PROFILE.savedIdsByKey[key] = list;
}

function mergeProfileIds(apiIds, trainNo, siteId) {
  var key = profileListCacheKey(trainNo, siteId);
  var source = (apiIds && apiIds.length) ? apiIds : (OPT_PROFILE.savedIdsByKey[key] || []);
  var merged = [];
  var seen = {};
  source.forEach(function (id) {
    var value = String(id || '').trim();
    if (value && !seen[value]) {
      seen[value] = true;
      merged.push(value);
    }
  });
  merged.sort(function (a, b) {
    return a.localeCompare(b, undefined, { numeric: true });
  });
  if (apiIds && apiIds.length) {
    OPT_PROFILE.savedIdsByKey[key] = merged;
  }
  return merged;
}

function nextOfficialProfileId(trainNo, existingIds) {
  var prefix = String(trainNo || '').trim() + '_';
  var max = 0;
  (existingIds || []).forEach(function (id) {
    var s = String(id || '').trim();
    if (s.indexOf(prefix) !== 0) {
      return;
    }
    var n = parseInt(s.substring(prefix.length), 10);
    if (!isNaN(n) && n > max) {
      max = n;
    }
  });
  return prefix + (max + 1);
}

function unwrapLoadedProfileRecord(loaded) {
  var root = unwrapTpoResponse(loaded);
  if (!root) {
    return null;
  }
  if (Array.isArray(root.train_opt_profile) && root.train_opt_profile.length) {
    return root.train_opt_profile[0];
  }
  if (Array.isArray(root.train_profile) && root.train_profile.length) {
    return root.train_profile[0];
  }
  if (Array.isArray(root) && root.length) {
    return root[0];
  }
  return root;
}

function toOptimizeRequestPayload(loaded, trainNo) {
  var src = unwrapLoadedProfileRecord(loaded) || {};
  if (typeof src === 'string') {
    try { src = JSON.parse(src); } catch (e) { src = {}; }
  }
  var nested = src.REQUEST_PAYLOAD || src.request_payload || src.requestPayload || src.payload;
  if (typeof nested === 'string') {
    try { nested = JSON.parse(nested); } catch (e) { nested = null; }
  }
  if (nested && typeof nested === 'object') {
    src = Object.assign({}, src, nested);
  }
  if (Array.isArray(src.params) && src.params.length >= 5) {
    return {
      params: src.params.slice(),
      edited_berths: src.edited_berths || {},
      edited_coaches: src.edited_coaches || {},
      edited_berth_comp: src.edited_berth_comp || {},
      edited_phy_berths: src.edited_phy_berths || {},
      remote_added: src.remote_added || [],
      remote_removed: src.remote_removed || []
    };
  }
  var num = trainNo || getTrainNumber(SELECTED_TRAIN) || '';
  return {
    params: [
      num,
      src.site_id || src.siteId || getSiteId(SELECTED_TRAIN) || '',
      src.profile_date || src.profileDate || (SELECTED_TRAIN && SELECTED_TRAIN.PROFILE_DATE) || '',
      src.start_date || src.fromDate || $('#optFromDate').val() || '',
      src.end_date || src.toDate || $('#optToDate').val() || ''
    ],
    edited_berths: src.edited_berths || {},
    edited_coaches: src.edited_coaches || {},
    edited_berth_comp: src.edited_berth_comp || {},
    edited_phy_berths: src.edited_phy_berths || {},
    remote_added: src.remote_added || [],
    remote_removed: src.remote_removed || []
  };
}

function fetchOptimizationProfileList(trainNo, siteId) {
  trainNo = String(trainNo || '').trim();
  siteId = String(siteId || '').trim();
  return getWebServiceDataTrain(
    { params: [trainNo, siteId] },
    '/newtemplatebasedmis/webapi/typeOne/getTrainProfiles'
  ).then(function (res) {
    if (typeof console !== 'undefined' && console.info) {
      console.info('[TPO getProfiles]', trainNo, siteId, res);
    }
    return mergeProfileIds(extractProfileIds(res), trainNo, siteId);
  });
}

function fetchOptimizationProfile(profileId) {
  var trainNo = String(getTrainNumber(SELECTED_TRAIN) || '').trim();
  var siteId = String(getSiteId(SELECTED_TRAIN) || '').trim();
  return getWebServiceDataTrain(
    { params: [trainNo, siteId, String(profileId || '').trim()] },
    '/newtemplatebasedmis/webapi/typeOne/getTrainLoadProfile'
  ).then(function (res) {
    if (typeof console !== 'undefined' && console.info) {
      console.info('[TPO loadProfile]', trainNo, siteId, profileId, res);
    }
    var loaded = unwrapLoadedProfileRecord(res);
    if (!loaded) {
      throw new Error('Profile not found');
    }
    return toOptimizeRequestPayload(loaded, trainNo);
  });
}

function refreshOptimizationProfileList() {
  var $select = $('#optSavedProfileSelect');
  if (!$select.length) {
    return Promise.resolve();
  }
  var trainNo = SELECTED_TRAIN ? String(getTrainNumber(SELECTED_TRAIN) || '').trim() : '';
  var siteId = SELECTED_TRAIN ? String(getSiteId(SELECTED_TRAIN) || '').trim() : '';
  if (!trainNo || !siteId) {
    $select.html('<option value="">Fetch a train first</option>');
    return Promise.resolve();
  }
  var seq = ++OPT_PROFILE.listRequestSeq;
  $select.html('<option value="">Loading...</option>');
  return fetchOptimizationProfileList(trainNo, siteId).then(function (ids) {
    if (seq !== OPT_PROFILE.listRequestSeq) {
      return;
    }
    var list = ids || [];
    var html = '<option value="">Select Profile</option>';
    list.forEach(function (id) {
      html += '<option value="' + optEsc(id) + '"'
        + (id === OPT_PROFILE.selectedProfileId ? ' selected' : '') + '>'
        + optEsc(id) + '</option>';
    });
    if (!list.length) {
      html = '<option value="">No saved profiles</option>';
    }
    $select.html(html);
    if (OPT_PROFILE.selectedProfileId && list.indexOf(OPT_PROFILE.selectedProfileId) !== -1) {
      $select.val(OPT_PROFILE.selectedProfileId);
    }
  }).catch(function (e) {
    if (seq !== OPT_PROFILE.listRequestSeq) {
      return;
    }
    console.error(e);
    $select.html('<option value="">Unable to load profiles</option>');
  });
}

function setOptProfileMode(mode) {
  OPT_PROFILE.profileMode = mode === 'EDIT' ? 'EDIT' : 'CREATE';
  OPT_PROFILE.selectedProfileId = '';
  OPT_PROFILE.profilePayload = null;
  OPT_PROFILE.lastRequestPayload = null;
  OPT_PROFILE.profileSaved = false;
  clearOptimizationWorkspace();
  var $wrap = $('#optProfileSelectWrap');
  $wrap.toggleClass('is-visible', OPT_PROFILE.profileMode === 'EDIT');
  $('input[name="optProfileMode"][value="' + OPT_PROFILE.profileMode + '"]').prop('checked', true);
  if (OPT_PROFILE.profileMode === 'CREATE') {
    restoreDefaultOptDates();
  } else {
    refreshOptimizationProfileList();
  }
}

function loadSelectedOptimizationProfile(profileId) {
  profileId = String(profileId || '').trim();
  OPT_PROFILE.selectedProfileId = profileId;
  OPT_PROFILE.profilePayload = null;
  if (!profileId) {
    clearOptimizationWorkspace();
    return;
  }
  if (!SELECTED_TRAIN) {
    alert('Please fetch train profile first');
    return;
  }
  var $btn = $('#showOptimizationBtn');
  $btn.prop('disabled', true).text('Loading Data...');
  $('#optimizationContent').html(
    '<div class="text-center" style="padding:24px;"><i class="fa fa-spinner fa-spin"></i> Loading saved profile...</div>'
  );
  fetchOptimizationProfile(profileId).then(function (payload) {
    OPT_PROFILE.profilePayload = payload;
    applySavedOptimizePayloadToState(payload);
    return postSavedOptimizePayload(payload);
  }).then(function (response) {
    var savedComparisonRows = savedPayloadRowsForComparison(OPT_PROFILE.profilePayload);
    persistReoptimizeDelta({
      edited_berths: (OPT_PROFILE.profilePayload && OPT_PROFILE.profilePayload.edited_berths) || {},
      edited_coaches: (OPT_PROFILE.profilePayload && OPT_PROFILE.profilePayload.edited_coaches) || {},
      edited_berth_comp: (OPT_PROFILE.profilePayload && OPT_PROFILE.profilePayload.edited_berth_comp) || {},
      edited_phy_berths: (OPT_PROFILE.profilePayload && OPT_PROFILE.profilePayload.edited_phy_berths) || {},
      remote_added: (OPT_PROFILE.profilePayload && OPT_PROFILE.profilePayload.remote_added) || [],
      remote_removed: (OPT_PROFILE.profilePayload && OPT_PROFILE.profilePayload.remote_removed) || []
    });
    drawOptimizationProfile(response);
    applySuccessfulReoptimizeComparison(savedComparisonRows);
    OPT_PROFILE.profileSaved = true;
    updateOptProfileStatus();
  }).catch(function (error) {
    console.error(error);
    alert(error.message || 'Failed to load saved profile');
    $('#optimizationContent').html(
      '<div class="alert alert-danger text-center">Failed to load saved profile.</div>'
    );
  }).then(function () {
    $btn.prop('disabled', false).text('Show Optimization');
  });
}

function saveOptimizationProfile(saveAsNew) {
  if (!SELECTED_TRAIN) {
    alert('Please fetch train profile first');
    return;
  }
  if (!OPT_STATE.optimizationLoaded) {
    alert('Run Show Optimization before saving a profile');
    return;
  }
  if (!OPT_PROFILE.lastRequestPayload || !OPT_PROFILE.lastRequestPayload.params) {
    alert('No optimization request payload is available to save');
    return;
  }
  if (OPT_STATE.savingProfile) {
    return;
  }
  if ($('#optBerthTableWrap').length) {
    syncEditedRowsFromDom();
  }
  if (getChangeCounts().total > 0) {
    alert('Please Re-Optimize your changes first, then save the profile.');
    updateReoptimizeButton();
    return;
  }
  var trainNo = getTrainNumber(SELECTED_TRAIN);
  var siteId = getSiteId(SELECTED_TRAIN);
  var payload = toOptimizeRequestPayload(OPT_PROFILE.lastRequestPayload, trainNo);
  if (OPT_STATE.editedRows && OPT_STATE.editedRows.length) {
    var delta = buildCumulativeReoptimizeDelta(OPT_STATE.editedRows);
    payload.edited_berths = delta.edited_berths || payload.edited_berths || {};
    payload.edited_coaches = delta.edited_coaches || payload.edited_coaches || {};
    payload.edited_phy_berths = delta.edited_phy_berths || payload.edited_phy_berths || {};
    delete payload.edited_berth_comp;
    payload.remote_added = delta.remote_added || payload.remote_added || [];
    payload.remote_removed = delta.remote_removed || payload.remote_removed || [];
  }
  var isEdit = OPT_PROFILE.profileMode === 'EDIT';
  var updateCurrent = isEdit && !saveAsNew;
  if (updateCurrent && !OPT_PROFILE.selectedProfileId) {
    alert('Select a profile to update');
    return;
  }

  OPT_STATE.savingProfile = true;
  OPT_STATE.savingAsNew = !!saveAsNew;
  updateReoptimizeButton();

  var profileIdPromise = updateCurrent
    ? Promise.resolve(OPT_PROFILE.selectedProfileId)
    : fetchOptimizationProfileList(trainNo, siteId).then(function (ids) {
        return nextOfficialProfileId(trainNo, ids);
      }).catch(function () {
        return nextOfficialProfileId(trainNo, []);
      });

  profileIdPromise.then(function (profileId) {
    if (!profileId || String(profileId).length > 10) {
      throw new Error('Cannot allocate PROFILE_ID (max 10 chars) for train ' + trainNo);
    }
    var composition = buildFullCompositionPayload();
    var requestData = {
      params: [
        trainNo,
        siteId,
        SELECTED_TRAIN.PROFILE_DATE || (payload.params && payload.params[2]) || '',
        (payload.params && payload.params[3]) || $('#optFromDate').val(),
        (payload.params && payload.params[4]) || $('#optToDate').val(),
        profileId,
        ($('.username').text() || '').trim()
      ],
      edited_berths: payload.edited_berths || {},
      edited_coaches: composition.edited_coaches,
      edited_phy_berths: composition.edited_phy_berths,
      remote_added: payload.remote_added || [],
      remote_removed: payload.remote_removed || []
    };
    return getWebServiceDataTrain(
      requestData,
      '/newtemplatebasedmis/webapi/typeOne/saveTrainProfile'
    ).then(function (res) {
      unwrapTpoResponse(res);
      rememberSavedProfileId(trainNo, siteId, profileId);
      OPT_PROFILE.selectedProfileId = profileId;
      OPT_PROFILE.profilePayload = payload;
      OPT_PROFILE.profileSaved = true;
      alert(updateCurrent
        ? ('Profile ' + profileId + ' updated successfully.')
        : ('Profile ' + profileId + ' saved as a new profile.'));
      refreshOptimizationProfileList();
    });
  })
    .catch(function (e) {
      console.error(e);
      alert(e.message || 'Failed to save profile');
    })
    .then(function () {
      OPT_STATE.savingProfile = false;
      OPT_STATE.savingAsNew = false;
      updateReoptimizeButton();
    });
}

window.setOptProfileMode = setOptProfileMode;
window.refreshOptimizationProfileList = refreshOptimizationProfileList;
window.loadSelectedOptimizationProfile = loadSelectedOptimizationProfile;
window.saveOptimizationProfile = saveOptimizationProfile;
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
    btn.textContent = 'Fetch Train Information';
    alert('Selected train is missing site id');
    return;
  }

  var trainNo = getTrainNumber(SELECTED_TRAIN);
  if (!trainNo) {
    btn.disabled = false;
    btn.textContent = 'Fetch Train Information';
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
    populateOptimizationEndToEndStations();
    CURRENT_DEMAND_ROWS = [];
    CURRENT_HOLIDAYS = [];
    CURRENT_DEMAND_DATE_KEY = '';
    loadDemandForSelectedTrain(true);
    renderDemandFromRows(CURRENT_DEMAND_ROWS, CURRENT_HOLIDAYS);
    byId('profileDateText').textContent =
        (SELECTED_TRAIN.PROFILE_DATE || '').split('-').reverse().join('-') || '--';
    byId('trainDetailsSection').style.display = 'block';
    byId('tabsSection').style.display = 'block';
    if (typeof refreshOptimizationProfileList === 'function') {
      refreshOptimizationProfileList();
    }
    if (typeof renderPreOptimizeComposition === 'function') {
      renderPreOptimizeComposition();
    }
  }).catch(function(e){ console.error(e); alert('Failed to fetch train data'); })
  .then(function(){ btn.disabled = false; btn.textContent = 'Fetch Train Information'; });
}


function getUtilizationData(fromDate, toDate){
	 var from = new Date(fromDate);
	    var to = new Date(toDate);

	    from.setHours(0, 0, 0, 0);
	    to.setHours(0, 0, 0, 0);

	    var diffDays = Math.ceil((to - from) / (1000 * 60 * 60 * 24));

	    if (diffDays > 180) {
	        alert("Utilization date range cannot exceed 180 days.");
	        return Promise.resolve();
	    }

	return apiFetchTrainUtilization(SELECTED_TRAIN.train_number, SELECTED_TRAIN.site_id, SELECTED_TRAIN.PROFILE_DATE, fromDate, toDate);
}

function hasPersistedOptimizationConstraints() {
  return Object.keys(OPT_STATE.persistedEditedBerths || {}).length > 0
    || Object.keys(OPT_STATE.persistedEditedCoaches || {}).length > 0
    || Object.keys(OPT_STATE.persistedEditedBerthComp || {}).length > 0
    || (OPT_STATE.persistedRemoteAdded || []).length > 0
    || (OPT_STATE.persistedRemoteRemoved || []).length > 0;
}

function buildPersistedOnlyDelta() {
  return {
    edited_berths: Object.assign({}, OPT_STATE.persistedEditedBerths || {}),
    edited_coaches: Object.assign({}, OPT_STATE.persistedEditedCoaches || {}),
    edited_phy_berths: Object.assign({}, OPT_STATE.persistedEditedPhyBerths || {}),
    remote_added: ensureUniqueCodes(OPT_STATE.persistedRemoteAdded || []),
    remote_removed: ensureUniqueCodes(OPT_STATE.persistedRemoteRemoved || [])
  };
}

function getOptimizationData(fromDate, toDate){
	var endToEnd = getOptimizationEndToEndSelection();
	if (OPT_PROFILE.profileMode === 'EDIT') {
		if (!OPT_PROFILE.selectedProfileId) {
			return Promise.reject(new Error('Select a saved profile'));
		}
		var runEditWithUiDates = function (payload) {
			payload = stampOptimizePayloadDates(payload, fromDate, toDate);
			OPT_PROFILE.profilePayload = payload;
			// Keep berths/remotes from the profile; do not overwrite UI dates.
			applySavedOptimizePayloadToState(payload, { skipDates: true });
			return postSavedOptimizePayload(payload);
		};
		if (OPT_PROFILE.profilePayload) {
			return runEditWithUiDates(OPT_PROFILE.profilePayload);
		}
		return fetchOptimizationProfile(OPT_PROFILE.selectedProfileId).then(runEditWithUiDates);
	}
	var trainNo = getTrainNumber(SELECTED_TRAIN);
	var siteId = getSiteId(SELECTED_TRAIN);
	var delta = null;
	if (hasPersistedOptimizationConstraints()) {
		if (OPT_STATE.editedRows && OPT_STATE.editedRows.length) {
			syncEditedRowsFromDom();
			delta = buildCumulativeReoptimizeDelta(OPT_STATE.editedRows);
		} else {
			delta = buildPersistedOnlyDelta();
		}
	} else {
		delta = {
			edited_berths: {},
			remote_added: [],
			remote_removed: []
		};
	}
	// Full composition is always attached inside apiFetchTrainOptimization.
	return apiFetchTrainOptimization(trainNo, siteId, SELECTED_TRAIN.PROFILE_DATE, fromDate, toDate, endToEnd, delta);
//	return apiFetchTrainOptimization(trainNo, siteId, SELECTED_TRAIN.PROFILE_DATE, fromDate, toDate, delta);
}

// Re-optimize uses same POST endpoint with edited_berths in JSON body.
function getReoptimizeData(fromDate, toDate, delta) {
	var endToEnd = getOptimizationEndToEndSelection();
	var trainNo = getTrainNumber(SELECTED_TRAIN);
	var siteId = getSiteId(SELECTED_TRAIN);
	return apiFetchTrainOptimization(trainNo, siteId, SELECTED_TRAIN.PROFILE_DATE, fromDate, toDate, endToEnd, delta);
//	return apiFetchTrainOptimization(trainNo, siteId, SELECTED_TRAIN.PROFILE_DATE, fromDate, toDate, delta);
}

document.addEventListener('DOMContentLoaded', function(){
  var fetchBtn = byId('fetchTrainBtn');
  byId('trnNo').disabled = true;
  fetchBtn.disabled = true;
  fetchBtn.innerHTML = '<i class="fa fa-spinner fa-spin"></i> Fetching Train List...';
  apiFetchTrainList().then(function(d){TRAIN_LIST = d.train_list || [];
    byId('trnNo').disabled = false;
    fetchBtn.disabled = false;
    fetchBtn.innerHTML = '<i class="fa fa-search"></i> Fetch Train Information';
  })
  .catch(function(err){
    console.error(err);
    byId('trnNo').disabled = false;
    fetchBtn.disabled = false;
    fetchBtn.innerHTML = '<i class="fa fa-search"></i> Fetch Train Information';
  });
  bindAutocomplete();
  byId('fetchTrainBtn').addEventListener('click', function(e){ e.preventDefault(); searchTrain(); });
  byId('modeDaily').addEventListener('click', function(){ setMode('daily'); renderDemandFromRows(CURRENT_DEMAND_ROWS, CURRENT_HOLIDAYS); });
  byId('modeWeekly').addEventListener('click', function(){ setMode('weekly'); renderDemandFromRows(CURRENT_DEMAND_ROWS, CURRENT_HOLIDAYS); });
  byId('applyDemandBtn').addEventListener('click', function(e){ e.preventDefault(); loadDemandForSelectedTrain(true); });
  var remotePdfBtn = byId('downloadRemoteDemandPdfBtn');
  if (remotePdfBtn) {
    remotePdfBtn.addEventListener('click', function (e) {
      e.preventDefault();
      downloadRemoteWiseDemandPdf();
    });
  }
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
  savingProfile: false,
  savingAsNew: false,
  syncingAllocations: false,
  nextRowId: 1,
  focusRowId: null,
  activeAddClass: null,
  compareClass: null,
  compareChangesOnly: true,
  expandedClasses: {},
  originalRemotes: [],
  remoteAdded: [],
  remoteRemoved: [],
  // Cumulative constraints sent across re-optimization passes (merged into each next request).
  persistedEditedBerths: {},
  persistedEditedCoaches: {},
  persistedRemoteAdded: [],
  persistedRemoteRemoved: [],
  originalCoaches: {},
  originalPhyBerths: {},
  editedCoaches: {},
  // Berths per coach (BERTH_COMP) per coach type — editable from class_berth_comp options.
  // Values stay as API strings so mixed coaches ("1A+2A" -> "10+20") survive round-trips.
  originalBerthComp: {},
  editedBerthComp: {},
  persistedEditedBerthComp: {},
  // Berths per real class after splitting mixed coaches — derived, sent for the optimizer.
  persistedEditedPhyBerths: {},
  // Coach types shown in the composition strip = physical_comp units + ones the user added.
  compositionClasses: [],
  addedClasses: [],
  coachesInitialized: false,
  // Frozen baseline from CURRENT_PROFILE — used for Added/Modified/Removed tags (not reopt baseline).
  profileCoaches: {},
  profileBerthComp: {},
  profilePhyBerths: {},
  // Quota Focus Mode — multi-select legend filters (persists across re-optimize redraws).
  focusedQuotas: [],
  // Route Highlight Filter — From/To pair focus (compatible with quota focus).
  routeFocus: { from: '', to: '' },
  // Last capacity-violation from a failed re-optimize (drives red allocation highlights).
  capacityViolation: null,
  // Class-wise seat capacity from last optimize response (edited_coaches / edited_phy_berths).
  classCapacity: {}
};
var OPT_DATES_TOUCHED = { opt: false, util: false };
var OPT_DEFAULT_FROM_OFFSET = 61;
var OPT_DEFAULT_TO_OFFSET = 90;
var OPT_TOP_IMPACT_LIMIT = 10;
var OPT_MAX_COACHES_TOTAL = 22;

var OPT_PROFILE = {
  profileMode: 'CREATE',
  selectedProfileId: '',
  profilePayload: null,
  lastRequestPayload: null,
  // True only while the shown result matches what is stored against selectedProfileId.
  profileSaved: false,
  savedIdsByKey: {},
  listRequestSeq: 0
};

function logOptimizationRequest(action, reoptDelta, body) {
  if (typeof console === 'undefined' || !console.info) {
    return;
  }
  console.info('[TPO optimize] ' + action, {
    persistedEditedBerths: Object.assign({}, OPT_STATE.persistedEditedBerths || {}),
    persistedEditedCoaches: Object.assign({}, OPT_STATE.persistedEditedCoaches || {}),
    persistedRemoteAdded: (OPT_STATE.persistedRemoteAdded || []).slice(),
    persistedRemoteRemoved: (OPT_STATE.persistedRemoteRemoved || []).slice(),
    requestDelta: reoptDelta ? {
      edited_berths: Object.assign({}, (reoptDelta.edited_berths) || {}),
      edited_coaches: Object.assign({}, (reoptDelta.edited_coaches) || {}),
      edited_berth_comp: Object.assign({}, (reoptDelta.edited_berth_comp) || {}),
      edited_phy_berths: Object.assign({}, (reoptDelta.edited_phy_berths) || {}),
      remote_added: (reoptDelta.remote_added || []).slice(),
      remote_removed: (reoptDelta.remote_removed || []).slice()
    } : null,
    requestBody: body
  });
}

function resetOptimizationState() {
  OPT_PROFILE.selectedProfileId = '';
  OPT_PROFILE.profilePayload = null;
  OPT_PROFILE.lastRequestPayload = null;
  OPT_PROFILE.profileSaved = false;
  clearOptimizationWorkspace();
}
window.resetOptimizationState = resetOptimizationState;

function clearOptimizationWorkspace() {
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
  OPT_STATE.savingProfile = false;
  OPT_STATE.savingAsNew = false;
  OPT_STATE.nextRowId = 1;
  OPT_STATE.focusRowId = null;
  OPT_STATE.activeAddClass = null;
  OPT_STATE.expandedClasses = {};
  OPT_STATE.originalRemotes = [];
  OPT_STATE.remoteAdded = [];
  OPT_STATE.remoteRemoved = [];
  OPT_STATE.persistedEditedBerths = {};
  OPT_STATE.persistedEditedCoaches = {};
  OPT_STATE.persistedRemoteAdded = [];
  OPT_STATE.persistedRemoteRemoved = [];
  OPT_STATE.originalCoaches = {};
  OPT_STATE.originalPhyBerths = {};
  OPT_STATE.editedCoaches = {};
  OPT_STATE.originalBerthComp = {};
  OPT_STATE.editedBerthComp = {};
  OPT_STATE.persistedEditedBerthComp = {};
  OPT_STATE.persistedEditedPhyBerths = {};
  OPT_STATE.compositionClasses = [];
  OPT_STATE.addedClasses = [];
  OPT_STATE.coachesInitialized = false;
  OPT_STATE.profileCoaches = {};
  OPT_STATE.profileBerthComp = {};
  OPT_STATE.profilePhyBerths = {};
  OPT_STATE.focusedQuotas = [];
  OPT_STATE.routeFocus = { from: '', to: '' };
  OPT_STATE.capacityViolation = null;
  OPT_STATE.classCapacity = {};
  $('#optimizationContent').html('');
  $('#optPreCompositionWrap').html('').hide();
  updateReoptimizeButton();
}

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
    var code = String(s.STN_CODE || s.stn_code || '').trim();
    if (code && order[code] === undefined) {
      order[code] = idx;
    }
  });
  // Enrich / replace from the painted route strip so intermediate stations are always present.
  if (typeof $ !== 'undefined' && $('#routeInfo .route-node').length) {
    var domOrder = {};
    $('#routeInfo .route-node').each(function (idx) {
      var code = String($(this).find('.route-label, .route-label-active').first().text() || '').trim();
      if (code && code !== '-' && domOrder[code] === undefined) {
        domOrder[code] = idx;
      }
    });
    if (!Object.keys(order).length) {
      order = domOrder;
    } else {
      Object.keys(domOrder).forEach(function (code) {
        if (order[code] === undefined) {
          order[code] = domOrder[code];
        }
      });
    }
  }
  return order;
}

function stationRouteIndex(code, orderMap) {
  if (!code) {
    return 9999;
  }
  code = String(code).trim();
  orderMap = orderMap || getRouteStationOrder();
  if (orderMap[code] !== undefined) {
    return orderMap[code];
  }
  // Case-insensitive fallback for station codes.
  var upper = code.toUpperCase();
  var key;
  for (key in orderMap) {
    if (Object.prototype.hasOwnProperty.call(orderMap, key) && String(key).toUpperCase() === upper) {
      return orderMap[key];
    }
  }
  return 9999;
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

// Full quota name for tooltips, sourced from PRSDBA.DW_DIM_QUOTA (QUOTA_NAME_MAP,
// injected server-side in trainProfileOptimization.jsp: QUOTA_DESC, falling back to
// QUOTA_DISPLAY, falling back to the code itself). Shared across all tabs of this page.
function getQuotaFullName(quota) {
  var q = String(quota || '').trim();
  if (!q) {
    return '';
  }
  var map = (typeof QUOTA_NAME_MAP !== 'undefined' && QUOTA_NAME_MAP) || {};
  var name = map[q] || map[q.toUpperCase()];
  return (name && String(name).trim()) || q;
}

// Full name only when it differs from the raw code — avoids a useless "GN" -> "GN" tooltip
// on unmapped/failed-lookup codes (used as a titleFn for select option builders below).
function quotaTitleIfDifferent(quota) {
  var q = String(quota || '').trim();
  if (!q) {
    return '';
  }
  var full = getQuotaFullName(q);
  return (full && full !== q) ? full : '';
}

// title="" helper — only sets a tooltip when the full name differs from the raw code.
function quotaTitleAttr(quota) {
  var full = quotaTitleIfDifferent(quota);
  return full ? (' title="' + optEsc(full) + '"') : '';
}

// Allocation lifecycle: keep route order; only removed rows move to the end.
function getRemovedBerthCount(row) {
  if (!row) {
    return 0;
  }
  if (row.removedBerthsOrig != null) {
    return optNum(row.removedBerthsOrig);
  }
  if (row.origSnapshot && row.origSnapshot.BERTHS != null) {
    return optNum(row.origSnapshot.BERTHS);
  }
  if (row.origKey && OPT_STATE.originalBerths && OPT_STATE.originalBerths[row.origKey] != null) {
    return optNum(OPT_STATE.originalBerths[row.origKey]);
  }
  return optNum(row.BERTHS);
}

function removedBerthLabel(row) {
  var n = getRemovedBerthCount(row);
  return 'Removed ' + n + ' berth' + (n === 1 ? '' : 's');
}

function sortClassRows(items) {
  return (items || []).slice().sort(compareAllocRows);
}
																  





function reorderClassCardsInDom(cls) {
  var $panel = $('#optBerthTableWrap .opt-berth-cls-panel').filter(function () {
    return $(this).attr('data-class') === cls;
  });
  var $grid = $panel.find('.opt-alloc-grid');
  if (!$grid.length) {
    return;
  }
  var order = sortClassRows(OPT_STATE.editedRows.filter(function (r) {
    return r.CLASS === cls;
  })).map(function (r) { return r._rowId; });
  order.forEach(function (id) {
    var $card = $grid.find('.opt-alloc-card[data-row-id="' + id + '"]');
    if ($card.length) {
      $grid.append($card);
    }
  });
}

function refreshBerthSummaryPills() {
  var $wrap = $('#optBerthTableWrap .opt-berth-summary');
  if (!$wrap.length) {
    return;
  }
  var rows = OPT_STATE.editedRows || [];
  var byClass = {};
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
  var html = '<span class="opt-berth-summary-pill opt-berth-summary-total">' + grandTotal + ' quota-berths</span>';
  Object.keys(byClass).sort().forEach(function (cls) {
    var items = byClass[cls];
    var clsTotal = items.reduce(function (s, r) { return r.removed ? s : s + optNum(r.BERTHS); }, 0);
    html += '<button type="button" class="opt-berth-summary-pill opt-berth-summary-jump" data-class="' + optEsc(cls) + '">'
      + '<span class="opt-cls-badge ' + optClsBadge(cls) + '">' + optEsc(cls) + '</span> '
      + clsTotal + ' quota-berths</button>';
  });
  $wrap.html(html);
}

function updateAllocationCardDiff($card, row, modified) {
  var $diff = $card.find('.opt-alloc-diff');
  // Comparison / payload tags use the badge only — no Original → Modified line.
  if (row.comparisonApplied) {
    $diff.removeAttr('data-was').hide().empty();
    return;
  }
  if (modified && !row.isNew && row.origSnapshot) {
    var wasVal = optNum(row.origSnapshot.BERTHS);
    if ($diff.attr('data-was') !== String(wasVal)) {
      $diff.attr('data-was', wasVal).html('Was: <strong>' + wasVal + '</strong>');
    }
    if (!$diff.is(':visible')) {
      $diff.show();
    }
    return;
  }
  if ($diff.is(':visible') || $diff.attr('data-was')) {
    $diff.removeAttr('data-was').hide().empty();
  }
}

function clearOptimizationApiError() {
  $('#optApiErrorBanner').remove();
  clearCapacityViolationHighlights();
}

/**
 * Parse optimizer capacity errors like:
 * "Optimizer failed: Capacity violation: class=1A, segment=OTP -> PGT, used=48, capacity=10, excess=38"
 */
function parseCapacityViolation(message) {
  var text = String(message || '');
  if (!/capacity\s*violation/i.test(text)) {
    return null;
  }
  var clsMatch = text.match(/class\s*=\s*([A-Za-z0-9+]+)/i);
  var segMatch = text.match(/segment\s*=\s*([A-Za-z0-9]+)\s*(?:->|→|-)\s*([A-Za-z0-9]+)/i);
  if (!clsMatch || !segMatch) {
    return null;
  }
  var usedMatch = text.match(/used\s*=\s*(-?\d+)/i);
  var capMatch = text.match(/capacity\s*=\s*(-?\d+)/i);
  var excessMatch = text.match(/excess\s*=\s*(-?\d+)/i);
  return {
    cls: String(clsMatch[1] || '').trim(),
    from: String(segMatch[1] || '').trim(),
    to: String(segMatch[2] || '').trim(),
    used: usedMatch ? optNum(usedMatch[1]) : null,
    capacity: capMatch ? optNum(capMatch[1]) : null,
    excess: excessMatch ? optNum(excessMatch[1]) : null
  };
}

/** True when allocation From→To traverses the violated segment (segment lies on the path). */
function allocationCoversSegment(allocFrom, allocTo, segFrom, segTo) {
  var order = getRouteStationOrder();
  var aFrom = stationRouteIndex(allocFrom, order);
  var aTo = stationRouteIndex(allocTo, order);
  var sFrom = stationRouteIndex(segFrom, order);
  var sTo = stationRouteIndex(segTo, order);
  if (aFrom >= 9999 || aTo >= 9999 || sFrom >= 9999 || sTo >= 9999) {
    return false;
  }
  if (aFrom > aTo) {
    var swap = aFrom;
    aFrom = aTo;
    aTo = swap;
  }
  if (sFrom > sTo) {
    swap = sFrom;
    sFrom = sTo;
    sTo = swap;
  }
  return aFrom <= sFrom && aTo >= sTo;
}

function clearCapacityViolationHighlights(opts) {
  opts = opts || {};
  if (!opts.keepState) {
    OPT_STATE.capacityViolation = null;
  }
  $('#optBerthTableWrap .opt-alloc-card')
    .removeClass('opt-alloc-capacity-hit opt-alloc-focus')
    .removeAttr('title');
  $('#optBerthTableWrap .opt-alloc-capacity-hint').remove();
  $('#routeInfo .route-node').removeClass('opt-route-violation');
  $('#routeInfo .route-wrapper').removeClass('opt-route-has-violation');
  $('#routeInfo .opt-route-violation-band').remove();
}

function highlightRouteSegment(segFrom, segTo) {
  var order = getRouteStationOrder();
  var sFrom = stationRouteIndex(segFrom, order);
  var sTo = stationRouteIndex(segTo, order);
  if (sFrom >= 9999 || sTo >= 9999) {
    return;
  }
  if (sFrom > sTo) {
    var swap = sFrom;
    sFrom = sTo;
    sTo = swap;
  }
  var $nodes = $('#routeInfo .route-node');
  if (!$nodes.length) {
    return;
  }
  var $wrapper = $('#routeInfo .route-wrapper').addClass('opt-route-has-violation');
  var firstEl = null;
  var lastEl = null;
  $nodes.each(function (idx) {
    var code = String($(this).find('.route-label, .route-label-active').first().text() || '').trim();
    var at = stationRouteIndex(code, order);
    if (at >= sFrom && at <= sTo) {
      $(this).addClass('opt-route-violation');
      if (!firstEl) {
        firstEl = this;
      }
      lastEl = this;
    }
  });
  // Paint a red band over the violated edge(s) between the first and last marked nodes.
  if (firstEl && lastEl && $wrapper.length) {
    var wrapLeft = $wrapper.offset().left;
    var left = $(firstEl).offset().left + $(firstEl).outerWidth() / 2 - wrapLeft;
    var right = $(lastEl).offset().left + $(lastEl).outerWidth() / 2 - wrapLeft;
    if (right < left) {
      var t = left;
      left = right;
      right = t;
    }
    $wrapper.append(
      '<div class="opt-route-violation-band" style="left:' + left + 'px;width:' + Math.max(8, right - left) + 'px;"></div>'
    );
  }
}

function applyCapacityViolationHighlights(violation) {
  clearCapacityViolationHighlights({ keepState: true });
  if (!violation || !violation.cls || !violation.from || !violation.to) {
    OPT_STATE.capacityViolation = null;
    return;
  }
  OPT_STATE.capacityViolation = violation;
  if (!$('#optBerthTableWrap').length) {
    return;
  }

  // Prefer live DOM values — editedRows can lag the selects after a failed re-optimize.
  if (typeof syncEditedRowsFromDom === 'function') {
    try { syncEditedRowsFromDom(); } catch (eSync) { /* ignore */ }
  }

  OPT_STATE.expandedClasses = OPT_STATE.expandedClasses || {};
  OPT_STATE.expandedClasses[violation.cls] = true;
  var $panel = $('#optBerthTableWrap .opt-berth-cls-panel').filter(function () {
    return String($(this).attr('data-class') || '').toUpperCase() === String(violation.cls).toUpperCase();
  });
  if ($panel.length) {
    $panel.find('.opt-berth-cls-body').show();
    $panel.find('.opt-berth-cls-chevron').removeClass('fa-chevron-right').addClass('fa-chevron-down');
  }

  highlightRouteSegment(violation.from, violation.to);

  var hint = 'Overlaps capacity violation ' + violation.from + ' \u2192 ' + violation.to
    + (violation.excess != null ? ' (excess ' + violation.excess + ')' : '')
    + ' — reduce these quota-berths';
  var firstCard = null;
  var hitCount = 0;

  $('#optBerthTableWrap .opt-alloc-card').each(function () {
    var $card = $(this);
    if ($card.attr('data-removed') === '1') {
      return;
    }
    var cls = String($card.attr('data-class') || '').trim();
    if (cls.toUpperCase() !== String(violation.cls).toUpperCase()) {
      return;
    }
    var from = String($card.find('.opt-edit-from').val() || $card.attr('data-from') || '').trim();
    var to = String($card.find('.opt-edit-to').val() || $card.attr('data-to') || '').trim();
    if (!from || !to || !allocationCoversSegment(from, to, violation.from, violation.to)) {
      return;
    }
    hitCount += 1;
    $card.addClass('opt-alloc-capacity-hit opt-alloc-focus').attr('title', hint);
    $card.find('.opt-alloc-capacity-hint').remove();
    $card.find('.opt-alloc-footer').prepend(
      '<div class="opt-alloc-capacity-hint"><i class="fa fa-exclamation-circle"></i> ' + optEsc(hint) + '</div>'
    );
    if (!firstCard) {
      firstCard = $card;
    }
  });

  if (firstCard && firstCard.length && firstCard.offset()) {
    $('html, body').animate({ scrollTop: firstCard.offset().top - 140 }, 280);
  }
  return hitCount;
}

function highlightCapacityViolationFromMessage(message) {
  var violation = parseCapacityViolation(message);
  if (!violation) {
    clearCapacityViolationHighlights();
    return null;
  }
  // Defer so we run after setOptimizationEditMode / any sync that finishes in the same turn.
  OPT_STATE.capacityViolation = violation;
  window.setTimeout(function () {
    if (!OPT_STATE.capacityViolation) {
      return;
    }
    applyCapacityViolationHighlights(OPT_STATE.capacityViolation);
  }, 0);
  return violation;
}

function extractOptimizationApiError(payload) {
  if (!payload || typeof payload !== 'object') {
    return '';
  }
  if (payload.success === false) {
    return String(payload.error || payload.message || 'The optimizer returned an error.').trim();
  }
  var data = payload.data != null && typeof payload.data === 'object' ? payload.data : payload;
  if (data && data.error != null && data.error !== '') {
    if (typeof data.error === 'string') {
      return data.error.trim();
    }
    if (typeof data.error === 'object' && data.error.message) {
      return String(data.error.message).trim();
    }
    return String(data.error).trim();
  }
  if (typeof payload.error === 'string' && payload.error.trim()) {
    return payload.error.trim();
  }
  return '';
}

function showOptimizationApiError(message, opts) {
  opts = opts || {};
  var title = opts.title || 'Optimization unavailable';
  var detail = message || 'No optimization data came back for this request.';
  var hint = opts.hint || '';
  var preserve = opts.preserveWorkspace !== false
    && OPT_STATE.optimizationLoaded
    && $('#optBerthTableWrap').length;
  if (preserve) {
    var $banner = $('#optApiErrorBanner');
    if (!$banner.length) {
      $banner = $('<div id="optApiErrorBanner" class="alert alert-warning opt-api-error-banner" role="alert"></div>');
      $('#optimizationContent').prepend($banner);
    }
    $banner.html(
      '<div class="opt-api-error-title"><i class="fa fa-exclamation-triangle"></i> '
      + optEsc(title) + '</div>'
      + '<div class="opt-api-error-detail">' + optEsc(detail) + '</div>'
      + '<div class="opt-api-error-hint">'
      + optEsc(hint || 'Your unsaved quota-berth edits are still here — tweak them and try Re-Optimize again.')
      + '</div>'
    ).show();
    try {
      var el = $banner.get(0);
      if (el && el.scrollIntoView) {
        el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    } catch (eScroll) { /* ignore */ }
    highlightCapacityViolationFromMessage(detail);
    updateReoptimizeButton();
    return;
  }
  clearCapacityViolationHighlights();
  $('#optimizationContent').html(
    '<div class="alert alert-info text-center opt-api-empty-state">'
    + '<div class="opt-api-error-title"><i class="fa fa-inbox"></i> ' + optEsc(title) + '</div>'
    + '<div class="opt-api-error-detail">' + optEsc(detail) + '</div>'
    + (hint ? '<div class="opt-api-error-hint">' + optEsc(hint) + '</div>' : '')
    + '</div>'
  );
  OPT_STATE.optimizationLoaded = false;
  OPT_STATE.hasChanges = false;
  updateReoptimizeButton();
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
        origSnapshot: prev.origSnapshot,
        removedBerthsOrig: prev.removedBerthsOrig,
        comparisonApplied: !!prev.comparisonApplied,
        comparisonStatus: prev.comparisonStatus,
        comparisonLabel: prev.comparisonLabel,
        comparisonOriginalBerths: prev.comparisonOriginalBerths,
        comparisonModifiedBerths: prev.comparisonModifiedBerths
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
  clearCapacityViolationHighlights();
  OPT_STATE.hasChanges = getChangeCounts().total > 0;
  updateReoptimizeButton();
}

function countClassChanges(items) {
  return (items || []).filter(function (r) {
    return r.isNew || isRowModified(r) || (r.removed && !r.comparisonApplied);
  }).length;
}

function computeAllocationDelta(rows) {
  var editedBerths = {};
  // Old keys abandoned by From/To/quota edits — drop from payload; do not send as 0.
  var supersededKeys = [];
  var liveOrigKeys = {};
  var tombstoneKeys = {};

  (rows || []).forEach(function (r) {
    if (r.comparisonApplied) {
      return;
    }
    if (r.origKey && !r.removed) {
      liveOrigKeys[r.origKey] = true;
    }
    if (r.removed && r.origKey) {
      tombstoneKeys[r.origKey] = true;
      // Simple Remove (card still visible) → pass 0 berths to API.
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
      // Route/quota change (e.g. PQ NDLS→RJPB → PQRS NDLS→PNBE): send only the new key.
      // Do not send previous combination as 0 berths.
      if (supersededKeys.indexOf(origKey) === -1) {
        supersededKeys.push(origKey);
      }
      editedBerths[newKey] = optNum(r.BERTHS);
      return;
    }
    if (optNum(r.BERTHS) !== origBerths || isRowModified(r)) {
      editedBerths[newKey] = optNum(r.BERTHS);
    }
  });

  // Remove + ✕ (permanently dismissed): pass nothing for that key — exclude from payload.
  (OPT_STATE.deletedKeys || []).forEach(function (key) {
    if (!key || liveOrigKeys[key] || tombstoneKeys[key]) {
      return;
    }
    delete editedBerths[key];
    if (supersededKeys.indexOf(key) === -1) {
      supersededKeys.push(key);
    }
  });

  return { edited_berths: editedBerths, superseded_keys: supersededKeys };
}

/**
 * Merge current session edits with persisted constraints from prior re-optimizations so each
 * request carries the full cumulative state (berths + remotes), not just the latest delta.
 *
 * Persisted berth keys are kept even when the UI row already matches the latest optimized
 * baseline (otherwise consecutive re-optimizations drop earlier edits). Only remove a berth key
 * when the user explicitly sets it back to the current baseline in this session, or when a
 * From/To/quota edit supersedes the previous key (without sending it as 0).
 */
function buildCumulativeReoptimizeDelta(rows) {
  var sessionDelta = computeAllocationDelta(rows);
  var sessionBerths = sessionDelta.edited_berths || {};
  var sessionRemote = computeRemoteDelta();
  var composition = buildFullCompositionPayload();

  var editedBerths = Object.assign({}, OPT_STATE.persistedEditedBerths || {});
  Object.keys(sessionBerths).forEach(function (key) {
    editedBerths[key] = sessionBerths[key];
  });
  // Drop superseded previous keys entirely — never keep/send them as 0 from a route edit
  // or a permanently dismissed allocation.
  (sessionDelta.superseded_keys || []).forEach(function (key) {
    delete editedBerths[key];
  });
  Object.keys(sessionBerths).forEach(function (key) {
    if (optNum(sessionBerths[key]) === optNum(OPT_STATE.originalBerths[key])) {
      delete editedBerths[key];
    }
  });

  var added = ensureUniqueCodes((OPT_STATE.persistedRemoteAdded || []).concat(sessionRemote.remote_added || []));
  var removed = ensureUniqueCodes((OPT_STATE.persistedRemoteRemoved || []).concat(sessionRemote.remote_removed || []));

  // Latest session intent wins when the same remote is toggled add/remove across passes.
  (sessionRemote.remote_added || []).forEach(function (code) {
    removed = removed.filter(function (c) { return c !== code; });
    if (added.indexOf(code) === -1) {
      added.push(code);
    }
  });
  (sessionRemote.remote_removed || []).forEach(function (code) {
    added = added.filter(function (c) { return c !== code; });
    if (removed.indexOf(code) === -1) {
      removed.push(code);
    }
  });
  added = ensureUniqueCodes(added.filter(function (c) { return removed.indexOf(c) === -1; }));

  return {
    edited_berths: editedBerths,
    edited_coaches: composition.edited_coaches,
    edited_phy_berths: composition.edited_phy_berths,
    remote_added: added,
    remote_removed: removed
  };
}

function persistReoptimizeDelta(delta) {
  OPT_STATE.persistedEditedBerths = Object.assign({}, (delta && delta.edited_berths) || {});
  OPT_STATE.persistedEditedCoaches = Object.assign({}, (delta && delta.edited_coaches) || {});
  OPT_STATE.persistedEditedBerthComp = {};
  OPT_STATE.persistedEditedPhyBerths = Object.assign({}, (delta && delta.edited_phy_berths) || {});
  OPT_STATE.persistedRemoteAdded = ensureUniqueCodes((delta && delta.remote_added) || []);
  OPT_STATE.persistedRemoteRemoved = ensureUniqueCodes((delta && delta.remote_removed) || []);
}

function restoreRemoteStateFromPersisted() {
  OPT_STATE.remoteAdded = ensureUniqueCodes(OPT_STATE.persistedRemoteAdded || []);
  OPT_STATE.remoteRemoved = ensureUniqueCodes(OPT_STATE.persistedRemoteRemoved || []);
}

/**
 * Count only remote edits made since the last successful re-optimize.
 * Persisted remotes (already applied) must not keep Re-Optimize enabled or block Download.
 */
function getPendingRemoteChangeCount() {
  var added = ensureUniqueCodes(OPT_STATE.remoteAdded || []);
  var removed = ensureUniqueCodes(OPT_STATE.remoteRemoved || []);
  var persistedAdded = ensureUniqueCodes(OPT_STATE.persistedRemoteAdded || []);
  var persistedRemoved = ensureUniqueCodes(OPT_STATE.persistedRemoteRemoved || []);

  var pendingAdded = added.filter(function (code) {
    return persistedAdded.indexOf(code) === -1;
  }).length;
  var pendingRemoved = removed.filter(function (code) {
    return persistedRemoved.indexOf(code) === -1;
  }).length;
  // User undid a previously applied constraint (remove from added / restore a removed remote).
  var revertedAdded = persistedAdded.filter(function (code) {
    return added.indexOf(code) === -1;
  }).length;
  var revertedRemoved = persistedRemoved.filter(function (code) {
    return removed.indexOf(code) === -1;
  }).length;

  return pendingAdded + pendingRemoved + revertedAdded + revertedRemoved;
}

function getRemoteChangeCount() {
  return getPendingRemoteChangeCount();
}

function getPendingCoachChangeCount() {
  var delta = computeCoachDelta();
  return Object.keys(delta.edited_coaches || {}).length;
}

/**
 * ✕ on an allocation whose 0 is already carried in the persisted constraints drops that key
 * from the next request, so it is a pending change even though the card is gone.
 */
function getDismissedConstraintCount() {
  var persisted = OPT_STATE.persistedEditedBerths || {};
  return (OPT_STATE.deletedKeys || []).filter(function (key) {
    return key && persisted[key] !== undefined;
  }).length;
}

function getChangeCounts() {
  var rows = OPT_STATE.editedRows;
  var newCount = rows.filter(function (r) { return r.isNew && !r.removed; }).length;
  var modifiedCount = rows.filter(function (r) { return !r.isNew && !r.removed && isRowModified(r); }).length;
  // Only visible removed placeholders count — ✕ dismiss means "pass nothing", so not a pending API delete.
  var deletedCount = rows.filter(function (r) { return r.removed && !r.comparisonApplied; }).length;
  var dismissedCount = getDismissedConstraintCount();
  var remoteChanges = getPendingRemoteChangeCount();
  var coachChanges = getPendingCoachChangeCount();
  return {
    total: newCount + modifiedCount + deletedCount + dismissedCount + remoteChanges + coachChanges,
    newCount: newCount,
    modifiedCount: modifiedCount,
    deleted: deletedCount,
    dismissed: dismissedCount,
    remoteChanges: remoteChanges,
    coachChanges: coachChanges
  };
}

function getNetBerthChange() {
  var delta = computeAllocationDelta(OPT_STATE.editedRows);
  var net = 0;
  Object.keys(delta.edited_berths || {}).forEach(function (key) {
    var orig = optNum(OPT_STATE.originalBerths[key]);
    net += optNum(delta.edited_berths[key]) - orig;
  });
  // Route/quota edits abandon the original key without sending 0 — still count that loss in net.
  (delta.superseded_keys || []).forEach(function (key) {
    net -= optNum(OPT_STATE.originalBerths[key]);
  });
  return net;
}

function getAllocationChangeLabel(row) {
  if (!row) {
    return '';
  }
  if (row.removed) {
    return removedBerthLabel(row);
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

function getTrainOriginStation() {
  var stations = getOptStationOptions();
  return stations.length ? stations[0] : '';
}

function getTrainDestinationStation() {
  var stations = getOptStationOptions();
  return stations.length ? stations[stations.length - 1] : '';
}

/** Stations allowed as remotes — never include the train's last (destination) station. */
function getRemoteStationOptions() {
  var stations = getOptStationOptions();
  var last = getTrainDestinationStation();
  if (!last) {
    return stations;
  }
  return stations.filter(function (code) {
    return code !== last;
  });
}

function isRoadSideRoute(from, to) {
  var origin = getTrainOriginStation();
  var dest = getTrainDestinationStation();
  from = String(from || '').trim();
  to = String(to || '').trim();
  return !!(origin && dest && from && to && from === origin && to !== dest);
}

function hasRsSuffix(quota) {
  var q = String(quota || '').trim().toUpperCase();
  return q.length > 2 && q.slice(-2) === 'RS';
}

/** Strip every trailing RS so GNRS / GNRSRS / GNRSRSRS all normalize to GN. */
function quotaBaseCode(quota) {
  var q = String(quota || '').trim().toUpperCase();
  while (q.length > 2 && q.slice(-2) === 'RS') {
    q = q.slice(0, -2);
  }
  return q;
}

/** Road-side form of a quota. Never doubles RS (GNRS stays GNRS, not GNRSRS). */
function quotaRsCode(quota) {
  var base = quotaBaseCode(quota);
  return base ? (base + 'RS') : '';
}

function findQuotaInList(code, list) {
  var target = String(code || '').trim().toUpperCase();
  if (!target) {
    return '';
  }
  var i;
  for (i = 0; i < (list || []).length; i++) {
    if (String(list[i] || '').trim().toUpperCase() === target) {
      return list[i];
    }
  }
  if (typeof QUOTA_NAME_MAP !== 'undefined' && QUOTA_NAME_MAP) {
    if (QUOTA_NAME_MAP[code]) {
      return code;
    }
    if (QUOTA_NAME_MAP[target]) {
      return target;
    }
  }
  return '';
}

/**
 * Origin → intermediate must use an RS-suffixed quota (GN→GNRS, HO→HORS, …).
 * If RS is already present, keep/normalize it — never append RS again.
 * Full Origin → Destination (or non-origin from) uses the base quota when an RS code is selected.
 */
function resolveQuotaForRoute(quota, from, to, availableQuotas) {
  quota = String(quota || '').trim();
  if (!quota || !from || !to) {
    return quota;
  }
  var available = availableQuotas || getOptQuotaOptions();
  if (isRoadSideRoute(from, to)) {
    // Already RS (or doubled like GNRSRS) → normalize to a single RS suffix.
    var rs = quotaRsCode(quota);
    return findQuotaInList(rs, available) || rs;
  }
  if (hasRsSuffix(quota)) {
    var base = quotaBaseCode(quota);
    return findQuotaInList(base, available) || base;
  }
  return quota;
}

function applyRoadSideQuotaRules(rows, onlyRowId) {
  var available = getOptQuotaOptions();
  var changed = false;
  (rows || []).forEach(function (r) {
    if (!r || r.removed || !r.QUOTA || !r.FROM || !r.TO) {
      return;
    }
    if (onlyRowId != null && r._rowId !== onlyRowId) {
      return;
    }
    // Do not rewrite untouched optimizer rows (that falsely marks other classes as "Quota Changed").
    var orig = r.origSnapshot;
    if (!orig && r._rowId != null) {
      var live = (OPT_STATE.editedRows || []).filter(function (x) {
        return x._rowId === r._rowId;
      })[0];
      orig = live && live.origSnapshot;
    }
    if (orig && r.QUOTA === orig.QUOTA && r.FROM === orig.FROM && r.TO === orig.TO) {
      return;
    }
    var resolved = resolveQuotaForRoute(r.QUOTA, r.FROM, r.TO, available);
    if (resolved && resolved !== r.QUOTA) {
      r.QUOTA = resolved;
      changed = true;
      if (available.indexOf(resolved) === -1) {
        available.push(resolved);
      }
    }
  });
  return changed;
}

function allocationComboKey(quota, from, to) {
  return String(quota || '').trim().toUpperCase() + '|'
    + String(from || '').trim().toUpperCase() + '|'
    + String(to || '').trim().toUpperCase();
}

function getTakenAllocationCombos(rows, cls, excludeRowId) {
  var taken = {};
  (rows || []).forEach(function (r) {
    if (!r || r.removed || r._rowId === excludeRowId) {
      return;
    }
    if (String(r.CLASS || '') !== String(cls || '')) {
      return;
    }
    if (!r.QUOTA || !r.FROM || !r.TO) {
      return;
    }
    taken[allocationComboKey(r.QUOTA, r.FROM, r.TO)] = true;
  });
  return taken;
}

function isDuplicateAllocation(rows, row) {
  if (!row || row.removed || !row.QUOTA || !row.FROM || !row.TO) {
    return false;
  }
  var key = allocationComboKey(row.QUOTA, row.FROM, row.TO);
  return !!getTakenAllocationCombos(rows, row.CLASS, row._rowId)[key];
}

function getAvailableQuotasForRow(row, allQuotas, rows) {
  var quotas = (allQuotas || []).slice();
  if (!row || !row.FROM || !row.TO) {
    return quotas;
  }
  var taken = getTakenAllocationCombos(rows || OPT_STATE.editedRows, row.CLASS, row._rowId);
  return quotas.filter(function (q) {
    if (row.QUOTA && String(q) === String(row.QUOTA)) {
      return true;
    }
    return !taken[allocationComboKey(q, row.FROM, row.TO)];
  });
}

function isUnknownQuotaDescription(desc) {
  // Hide placeholder quota names from dropdowns (prefix match, case-insensitive).
  return /^(UNKNOWN|UNDEFINED)/i.test(String(desc || '').trim());
}

function getOptQuotaOptions() {
  var quotas = [];
  var map = (typeof QUOTA_NAME_MAP !== 'undefined' && QUOTA_NAME_MAP) || {};
  if (map) {
    Object.keys(map).forEach(function (q) {
      if (!q) {
        return;
      }
      // Display-only: hide quotas whose description starts with UNKNOWN / UNDEFINED.
      if (isUnknownQuotaDescription(map[q])) {
        return;
      }
      quotas.push(q);
    });
  }
  if (!quotas.length && CURRENT_PROFILE && CURRENT_PROFILE.berths) {
    CURRENT_PROFILE.berths.forEach(function (b) {
      var q = b.QUOTA_TYPE || b.QUOTA || '';
      if (q && quotas.indexOf(q) === -1 && !isUnknownQuotaDescription(map[q])) {
        quotas.push(q);
      }
    });
  }
  OPT_STATE.editedRows.forEach(function (r) {
    // Do not reintroduce UNKNOWN-description quotas into shared dropdown lists.
    // optSelectOptions still preserves a card's current selected value when needed.
    if (r.QUOTA && quotas.indexOf(r.QUOTA) === -1 && !isUnknownQuotaDescription(map[r.QUOTA])) {
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
  // A coach type added to the composition can carry allocations even though it has no berths yet.
  // Mixed coaches contribute each of their classes, never the "1A+2A" unit key itself.
  (OPT_STATE.compositionClasses || []).forEach(function (unit) {
    splitCompositionUnit(unit).forEach(function (cls) {
      if (cls && classes.indexOf(cls) === -1) {
        classes.push(cls);
      }
    });
  });
  return classes.sort();
}

function getPhysicalRowField(row, keys) {
  if (!row) {
    return '';
  }
  for (var i = 0; i < keys.length; i++) {
    var val = row[keys[i]];
    if (val != null && String(val).trim() !== '') {
      return String(val).trim();
    }
  }
  return '';
}

function getPhysicalCoachCount(row) {
  return optNum(getPhysicalRowField(row, ['NUM_COACHES', 'COACH', 'COACHES', 'NUM_COACH', 'coach', 'coaches']));
}

function getPhysicalBerthCount(row) {
  return optNum(getPhysicalRowField(row, ['PHY_BERTHS', 'PHYSICAL_BERTHS', 'phy_berths']));
}

/**
 * A composition unit is one coach type. It is usually a single class ("3A" / "72"), but a mixed
 * coach carries several classes in one shell ("1A+2A" / "10+20" = 10 berths of 1A and 20 of 2A).
 *
 * Identity key for multiple compositions of the same class:
 *   "1A+2A|10+20"  → coach type "1A+2A", berth composition "10+20"
 * Payload edited_coaches uses these keys; berth composition is encoded in the key (no separate map).
 */
function normalizeCompText(value) {
  return String(value == null ? '' : value).replace(/\s+/g, '');
}

function makeCompositionKey(unit, comp) {
  unit = normalizeCompText(unit);
  comp = normalizeCompText(comp);
  if (!unit) {
    return '';
  }
  return comp ? (unit + '|' + comp) : unit;
}

function parseCompositionKey(key) {
  key = normalizeCompText(key);
  if (!key) {
    return { unit: '', comp: '' };
  }
  var pipe = key.indexOf('|');
  if (pipe < 0) {
    return { unit: key, comp: '' };
  }
  return {
    unit: key.substring(0, pipe),
    comp: key.substring(pipe + 1)
  };
}

function getCompositionUnit(key) {
  return parseCompositionKey(key).unit;
}

function getCompositionCompFromKey(key) {
  return parseCompositionKey(key).comp;
}

function splitCompositionUnit(unitOrKey) {
  return splitCompositionUnitParts(getCompositionUnit(unitOrKey) || normalizeCompText(unitOrKey));
}

function splitCompositionUnitParts(unit) {
  return normalizeCompText(unit).split('+').filter(function (part) { return part !== ''; });
}

function parseBerthCompParts(comp) {
  return splitCompositionUnitParts(comp).map(optNum);
}

function sumBerthComp(comp) {
  return parseBerthCompParts(comp).reduce(function (a, b) { return a + b; }, 0);
}

function isCompositeUnit(unitOrKey) {
  return splitCompositionUnit(unitOrKey).length > 1;
}

/** A composition is usable for a unit only when it gives one berth count per class in the unit. */
function isCompShapeValid(unitOrKey, comp) {
  var unit = getCompositionUnit(unitOrKey) || normalizeCompText(unitOrKey);
  return sumBerthComp(comp) > 0 && parseBerthCompParts(comp).length === splitCompositionUnitParts(unit).length;
}

function getPhysicalBerthComp(row) {
  return normalizeCompText(getPhysicalRowField(row, ['BERTH_COMP', 'berth_comp']));
}

/**
 * Build coach maps keyed by "CLS|BERTH_COMP" so the same class can appear with multiple compositions.
 * Legacy keys without "|" are upgraded when a berth composition is known.
 */
function buildCoachMapsFromProfile(physicalRows) {
  var coaches = {};
  var phyBerths = {};
  var berthComp = {};
  (physicalRows || []).forEach(function (row) {
    var unit = normalizeCompText(getPhysicalRowField(row, ['CLS', 'CLASS', 'cls', 'class']));
    if (!unit) {
      return;
    }
    var count = getPhysicalCoachCount(row);
    var phy = getPhysicalBerthCount(row);
    var comp = getPhysicalBerthComp(row);
    // Older payloads only carry PHY_BERTHS — derive berths per coach for plain single-class units.
    if (!isCompShapeValid(unit, comp) && !isCompositeUnit(unit) && count > 0 && phy > 0) {
      comp = String(Math.round(phy / count));
    }
    var key = makeCompositionKey(unit, comp);
    if (!key) {
      return;
    }
    coaches[key] = optNum(coaches[key]) + count;
    phyBerths[key] = optNum(phyBerths[key]) + phy;
    berthComp[key] = comp;
  });
  return { coaches: coaches, phyBerths: phyBerths, berthComp: berthComp };
}

/** Upgrade legacy "CLS" keys (and optional separate berth_comp map) to "CLS|COMP". */
function migrateCompositionKeyMaps(coachesMap, berthCompMap) {
  var coaches = {};
  var berthComp = {};
  Object.keys(coachesMap || {}).forEach(function (rawKey) {
    var parsed = parseCompositionKey(rawKey);
    var unit = parsed.unit;
    var comp = parsed.comp
      || normalizeCompText((berthCompMap || {})[rawKey])
      || normalizeCompText((berthCompMap || {})[unit])
      || '';
    var key = makeCompositionKey(unit, comp);
    if (!key) {
      return;
    }
    coaches[key] = optNum(coaches[key]) + optNum(coachesMap[rawKey]);
    if (comp) {
      berthComp[key] = comp;
    }
  });
  Object.keys(berthCompMap || {}).forEach(function (rawKey) {
    var parsed = parseCompositionKey(rawKey);
    var unit = parsed.unit;
    var comp = parsed.comp || normalizeCompText(berthCompMap[rawKey]);
    var key = makeCompositionKey(unit, comp);
    if (!key || coaches[key] != null) {
      if (key && comp) {
        berthComp[key] = comp;
      }
      return;
    }
    // Comp-only legacy entry with no coach count yet.
    coaches[key] = 0;
    berthComp[key] = comp;
  });
  return { coaches: coaches, berthComp: berthComp };
}

function getBerthCompOptions(keyOrUnit) {
  var unit = getCompositionUnit(keyOrUnit) || normalizeCompText(keyOrUnit);
  var currentKey = normalizeCompText(keyOrUnit);
  var currentComp = getCompositionCompFromKey(currentKey) || getBerthComp(currentKey);
  var options = [];
  var push = function (comp) {
    comp = normalizeCompText(comp);
    if (!isCompShapeValid(unit, comp)) {
      return;
    }
    var candidateKey = makeCompositionKey(unit, comp);
    // Keep current selection; hide comps already used by another row of the same class.
    if (candidateKey !== currentKey && getCompositionClasses().indexOf(candidateKey) !== -1) {
      return;
    }
    if (options.indexOf(comp) === -1) {
      options.push(comp);
    }
  };
  ((CURRENT_PROFILE && CURRENT_PROFILE.class_berth_comp) || []).forEach(function (row) {
    if (normalizeCompText(row && row.CLS) === unit) {
      push(row.BERTH_COMP);
    }
  });
  push((OPT_STATE.originalBerthComp || {})[currentKey]);
  push(currentComp);
  return options.sort(function (a, b) { return sumBerthComp(a) - sumBerthComp(b); });
}

/** Unused (unit, comp) pairs from class_berth_comp — same class allowed with a different composition. */
function getAddableCompositionEntries() {
  var shown = getCompositionClasses();
  var out = [];
  var seen = {};
  ((CURRENT_PROFILE && CURRENT_PROFILE.class_berth_comp) || []).forEach(function (row) {
    var unit = normalizeCompText(row && row.CLS);
    var comp = normalizeCompText(row && row.BERTH_COMP);
    if (!unit || !isCompShapeValid(unit, comp)) {
      return;
    }
    var key = makeCompositionKey(unit, comp);
    if (shown.indexOf(key) !== -1 || seen[key]) {
      return;
    }
    seen[key] = true;
    out.push({ key: key, unit: unit, comp: comp, label: unit + ' \u00b7 ' + comp });
  });
  return out.sort(function (a, b) {
    if (a.unit === b.unit) {
      return sumBerthComp(a.comp) - sumBerthComp(b.comp);
    }
    return a.unit < b.unit ? -1 : 1;
  });
}

function getAddableCompositionClasses() {
  return getAddableCompositionEntries().map(function (entry) { return entry.unit; });
}

function getCompositionClasses() {
  return OPT_STATE.compositionClasses || [];
}

function trackCompositionClass(cls) {
  cls = normalizeCompText(cls);
  if (!cls) {
    return;
  }
  OPT_STATE.compositionClasses = OPT_STATE.compositionClasses || [];
  if (OPT_STATE.compositionClasses.indexOf(cls) === -1) {
    OPT_STATE.compositionClasses.push(cls);
  }
}

function restoreCoachesFromPersisted() {
  var migrated = migrateCompositionKeyMaps(
    OPT_STATE.persistedEditedCoaches || {},
    OPT_STATE.persistedEditedBerthComp || {}
  );
  OPT_STATE.editedCoaches = OPT_STATE.editedCoaches || {};
  OPT_STATE.editedBerthComp = OPT_STATE.editedBerthComp || {};
  Object.keys(migrated.coaches).forEach(function (key) {
    OPT_STATE.editedCoaches[key] = optNum(migrated.coaches[key]);
    if (migrated.berthComp[key]) {
      OPT_STATE.editedBerthComp[key] = migrated.berthComp[key];
    }
    trackCompositionClass(key);
  });
}

function ensureCoachStateInitialized() {
  if (OPT_STATE.coachesInitialized) {
    return;
  }
  // physical_comp carries NUM_COACHES/BERTH_COMP; physical only has PHY_BERTHS.
  var source = (CURRENT_PROFILE && (CURRENT_PROFILE.physical_comp || CURRENT_PROFILE.physical)) || [];
  var built = buildCoachMapsFromProfile(source);
  OPT_STATE.profileCoaches = Object.assign({}, built.coaches);
  OPT_STATE.profilePhyBerths = Object.assign({}, built.phyBerths);
  OPT_STATE.profileBerthComp = Object.assign({}, built.berthComp);
  OPT_STATE.originalCoaches = Object.assign({}, built.coaches);
  OPT_STATE.originalPhyBerths = Object.assign({}, built.phyBerths);
  OPT_STATE.originalBerthComp = Object.assign({}, built.berthComp);
  OPT_STATE.editedCoaches = Object.assign({}, built.coaches);
  OPT_STATE.editedBerthComp = Object.assign({}, built.berthComp);
  OPT_STATE.compositionClasses = Object.keys(built.coaches).sort();
  OPT_STATE.addedClasses = [];
  restoreCoachesFromPersisted();
  OPT_STATE.coachesInitialized = true;
}

function syncCoachBaselineAfterOptimize() {
  var edited = OPT_STATE.editedCoaches || {};
  var orig = Object.assign({}, OPT_STATE.originalCoaches || {});
  Object.keys(edited).forEach(function (cls) {
    orig[cls] = optNum(edited[cls]);
  });
  OPT_STATE.originalCoaches = orig;
  OPT_STATE.persistedEditedCoaches = {};

  var editedComp = OPT_STATE.editedBerthComp || {};
  var origComp = Object.assign({}, OPT_STATE.originalBerthComp || {});
  Object.keys(editedComp).forEach(function (cls) {
    origComp[cls] = normalizeCompText(editedComp[cls]);
  });
  // Keep key→comp in sync with composite keys.
  Object.keys(edited).forEach(function (key) {
    var comp = getCompositionCompFromKey(key) || normalizeCompText(editedComp[key]);
    if (comp) {
      origComp[key] = comp;
    }
  });
  OPT_STATE.originalBerthComp = origComp;
  OPT_STATE.persistedEditedBerthComp = {};
  // Applied classes are part of the baseline now, so they can no longer be discarded.
  OPT_STATE.addedClasses = [];
}

function getCoachCount(cls) {
  cls = normalizeCompText(cls);
  if (!cls) {
    return 0;
  }
  if (OPT_STATE.editedCoaches && OPT_STATE.editedCoaches[cls] != null) {
    return optNum(OPT_STATE.editedCoaches[cls]);
  }
  return optNum((OPT_STATE.originalCoaches || {})[cls]);
}

function getPhyBerthCount(cls) {
  cls = normalizeCompText(cls);
  return optNum((OPT_STATE.originalPhyBerths || {})[cls]);
}

function getBerthComp(key) {
  key = normalizeCompText(key);
  if (!key) {
    return '';
  }
  var fromKey = getCompositionCompFromKey(key);
  if (fromKey) {
    return fromKey;
  }
  if (OPT_STATE.editedBerthComp && OPT_STATE.editedBerthComp[key] != null) {
    return normalizeCompText(OPT_STATE.editedBerthComp[key]);
  }
  return normalizeCompText((OPT_STATE.originalBerthComp || {})[key]);
}

/** Capacity of one coach type: every berth in the shell, mixed classes summed together. */
function getEffectivePhyBerths(key) {
  var comp = getBerthComp(key);
  if (sumBerthComp(comp) > 0) {
    return sumBerthComp(comp) * optNum(getCoachCount(key));
  }
  return getPhyBerthCount(key);
}

/**
 * Berths a unit contributes to each real class, e.g. two "1A+2A|10+20" coaches give
 * { '1A': 20, '2A': 40 }. Returns null when the composition does not match the unit's shape.
 */
function getUnitBerthsByClass(key) {
  var unit = getCompositionUnit(key);
  var classes = splitCompositionUnitParts(unit);
  var parts = parseBerthCompParts(getBerthComp(key));
  if (!classes.length || parts.length !== classes.length) {
    return null;
  }
  var coaches = optNum(getCoachCount(key));
  var out = {};
  classes.forEach(function (cls, i) {
    out[cls] = optNum(out[cls]) + parts[i] * coaches;
  });
  return out;
}

/** Total berths per real class across every unit — a class can sit in both a solo and a mixed coach. */
function getEffectiveBerthsByClass() {
  var out = {};
  getCompositionClasses().forEach(function (key) {
    var byClass = getUnitBerthsByClass(key);
    if (!byClass) {
      return;
    }
    Object.keys(byClass).forEach(function (cls) {
      out[cls] = optNum(out[cls]) + byClass[cls];
    });
  });
  return out;
}

/**
 * Class capacity from edited_coaches keys like "1A|24": 1 or "1A+2A|10+20": 2.
 * Capacity(class) = sum(berths_per_coach_for_class × coach_count).
 */
function classCapacityFromEditedCoaches(editedCoaches) {
  var out = {};
  Object.keys(editedCoaches || {}).forEach(function (key) {
    var coaches = optNum(editedCoaches[key]);
    if (coaches <= 0) {
      return;
    }
    var parsed = parseCompositionKey(key);
    var classes = splitCompositionUnitParts(parsed.unit);
    var parts = parseBerthCompParts(parsed.comp);
    if (!classes.length) {
      return;
    }
    if (classes.length === 1) {
      var perCoach = parts.length ? parts[0] : 0;
      out[classes[0]] = optNum(out[classes[0]]) + perCoach * coaches;
      return;
    }
    classes.forEach(function (cls, i) {
      out[cls] = optNum(out[cls]) + optNum(parts[i]) * coaches;
    });
  });
  return out;
}

/** Prefer API capacity maps; fall back to deriving from edited_coaches / current UI composition. */
function extractClassCapacityFromOptimizeData(data) {
  data = data || {};
  var sources = [
    data.optimizer_result,
    data.optimized_analysis,
    data.current_analysis,
    data
  ];
  var i;
  for (i = 0; i < sources.length; i++) {
    var src = sources[i];
    if (!src || typeof src !== 'object') {
      continue;
    }
    var direct = src.class_capacity || src.Class_capacity || src.Berth_capacity
      || src.berth_capacity || src.capacity || src.edited_phy_berths;
    if (direct && typeof direct === 'object' && !Array.isArray(direct) && Object.keys(direct).length) {
      var fromDirect = {};
      Object.keys(direct).forEach(function (cls) {
        fromDirect[cls] = optNum(direct[cls]);
      });
      return fromDirect;
    }
    if (src.edited_coaches && typeof src.edited_coaches === 'object') {
      var fromCoaches = classCapacityFromEditedCoaches(src.edited_coaches);
      if (Object.keys(fromCoaches).length) {
        return fromCoaches;
      }
    }
  }
  try {
    var composition = buildFullCompositionPayload();
    if (composition && composition.edited_phy_berths) {
      return Object.assign({}, composition.edited_phy_berths);
    }
  } catch (e) { /* ignore */ }
  return Object.assign({}, getEffectiveBerthsByClass());
}

function getClassCapacityForPdf() {
  var capacity = OPT_STATE.classCapacity;
  if (capacity && Object.keys(capacity).length) {
    return capacity;
  }
  try {
    var composition = buildFullCompositionPayload();
    if (composition && composition.edited_phy_berths) {
      return Object.assign({}, composition.edited_phy_berths);
    }
  } catch (e) { /* ignore */ }
  return Object.assign({}, getEffectiveBerthsByClass());
}

function isCoachModified(unit) {
  return optNum(getCoachCount(unit)) !== optNum((OPT_STATE.originalCoaches || {})[unit]);
}

function isBerthCompModified(unit) {
  return getBerthComp(unit) !== normalizeCompText((OPT_STATE.originalBerthComp || {})[unit]
    || getCompositionCompFromKey(unit));
}

/**
 * Pending coach deltas (for Re-Optimize change counts only).
 * Request payload uses buildFullCompositionPayload with composite keys.
 */
function computeCoachDelta() {
  var edited = OPT_STATE.editedCoaches || {};
  var original = OPT_STATE.originalCoaches || {};
  var out = {};
  Object.keys(edited).forEach(function (unit) {
    if (optNum(edited[unit]) !== optNum(original[unit])) {
      out[unit] = optNum(edited[unit]);
    }
  });
  Object.keys(original).forEach(function (unit) {
    if (edited[unit] == null && optNum(original[unit]) !== 0) {
      out[unit] = 0;
    }
  });

  var byClass = getEffectiveBerthsByClass();
  var outBerths = {};
  Object.keys(out).forEach(function (key) {
    splitCompositionUnit(key).forEach(function (cls) {
      outBerths[cls] = optNum(byClass[cls]);
    });
  });
  return { edited_coaches: out, edited_phy_berths: outBerths };
}

/** Full current composition — edited_coaches keys are "CLS|BERTH_COMP". */
function buildFullCompositionPayload() {
  ensureCoachStateInitialized();
  var edited_coaches = {};
  var units = {};
  getCompositionClasses().forEach(function (key) { units[key] = true; });
  Object.keys(OPT_STATE.profileCoaches || {}).forEach(function (key) { units[key] = true; });

  Object.keys(units).forEach(function (key) {
    key = normalizeCompText(key);
    if (!key) {
      return;
    }
    var unit = getCompositionUnit(key);
    var comp = getBerthComp(key);
    if (!comp && OPT_STATE.profileBerthComp && OPT_STATE.profileBerthComp[key]) {
      comp = normalizeCompText(OPT_STATE.profileBerthComp[key]);
    }
    var compositeKey = makeCompositionKey(unit, comp);
    if (!compositeKey) {
      return;
    }
    trackCompositionClass(compositeKey);
    edited_coaches[compositeKey] = optNum(getCoachCount(key));
  });

  var edited_phy_berths = Object.assign({}, getEffectiveBerthsByClass());
  Object.keys(edited_coaches).forEach(function (key) {
    splitCompositionUnit(key).forEach(function (cls) {
      if (edited_phy_berths[cls] == null) {
        edited_phy_berths[cls] = 0;
      }
    });
  });

  return {
    edited_coaches: edited_coaches,
    edited_phy_berths: edited_phy_berths
  };
}

function getTotalCoachCount(excludeUnit) {
  excludeUnit = normalizeCompText(excludeUnit || '');
  return getCompositionClasses().reduce(function (sum, unit) {
    if (excludeUnit && unit === excludeUnit) {
      return sum;
    }
    return sum + optNum(getCoachCount(unit));
  }, 0);
}

/** Total / added / removed vs CURRENT_PROFILE — for composition summary UI (no max limit shown). */
function getCoachChangeSummary() {
  ensureCoachStateInitialized();
  var units = {};
  getCompositionClasses().forEach(function (key) { units[key] = true; });
  Object.keys(OPT_STATE.profileCoaches || {}).forEach(function (key) { units[key] = true; });
  var total = 0;
  var added = 0;
  var removed = 0;
  Object.keys(units).forEach(function (key) {
    key = normalizeCompText(key);
    if (!key) {
      return;
    }
    var current = optNum(getCoachCount(key));
    var profile = optNum((OPT_STATE.profileCoaches || {})[key]);
    total += current;
    var delta = current - profile;
    if (delta > 0) {
      added += delta;
    } else if (delta < 0) {
      removed += -delta;
    }
  });
  return { total: total, added: added, removed: removed };
}

function getMaxCoachesForUnit(unit) {
  return Math.max(0, OPT_MAX_COACHES_TOTAL - getTotalCoachCount(unit));
}

function isProfileCompositionUnit(unit) {
  unit = normalizeCompText(unit);
  return !!(OPT_STATE.profileCoaches && Object.prototype.hasOwnProperty.call(OPT_STATE.profileCoaches, unit));
}

function isCompositionModifiedVsProfile(unit) {
  unit = normalizeCompText(unit);
  var profileCount = optNum((OPT_STATE.profileCoaches || {})[unit]);
  return optNum(getCoachCount(unit)) !== profileCount;
}

/** Added / Modified / Removed vs CURRENT_PROFILE composition (composite keys). */
function getCompositionChangeTag(unit) {
  unit = normalizeCompText(unit);
  var inProfile = isProfileCompositionUnit(unit);
  var coaches = optNum(getCoachCount(unit));
  var isAdded = (OPT_STATE.addedClasses || []).indexOf(unit) !== -1 || !inProfile;
  if (isAdded) {
    return 'Added';
  }
  if (inProfile && coaches <= 0) {
    return 'Removed';
  }
  if (inProfile && isCompositionModifiedVsProfile(unit)) {
    return 'Modified';
  }
  return '';
}

function setCoachCount(unit, value) {
  unit = normalizeCompText(unit);
  if (!unit || OPT_STATE.reoptimizing) {
    return;
  }
  ensureCoachStateInitialized();
  var maxForUnit = getMaxCoachesForUnit(unit);
  var next = Math.min(maxForUnit, Math.max(0, optNum(value)));
  OPT_STATE.editedCoaches = OPT_STATE.editedCoaches || {};
  OPT_STATE.editedCoaches[unit] = next;
  markOptimizationDirty();
  refreshCoachCompositionSection();
  updateReoptimizeButton();
}

function adjustCoachCount(unit, delta) {
  setCoachCount(unit, optNum(getCoachCount(unit)) + optNum(delta));
}

/** Changing berth composition remaps the row to a new "CLS|COMP" key. */
function setBerthComp(oldKey, comp) {
  oldKey = normalizeCompText(oldKey);
  comp = normalizeCompText(comp);
  var unit = getCompositionUnit(oldKey);
  if (!oldKey || !unit || !isCompShapeValid(unit, comp) || OPT_STATE.reoptimizing) {
    return;
  }
  ensureCoachStateInitialized();
  var newKey = makeCompositionKey(unit, comp);
  if (!newKey || newKey === oldKey) {
    return;
  }
  if (getCompositionClasses().indexOf(newKey) !== -1) {
    alert('That composition for ' + unit + ' is already in the list.');
    refreshCoachCompositionSection();
    return;
  }
  var coaches = optNum(getCoachCount(oldKey));
  OPT_STATE.editedCoaches = OPT_STATE.editedCoaches || {};
  OPT_STATE.editedBerthComp = OPT_STATE.editedBerthComp || {};
  OPT_STATE.editedCoaches[newKey] = coaches;
  OPT_STATE.editedBerthComp[newKey] = comp;
  delete OPT_STATE.editedCoaches[oldKey];
  delete OPT_STATE.editedBerthComp[oldKey];
  OPT_STATE.compositionClasses = getCompositionClasses().map(function (k) {
    return k === oldKey ? newKey : k;
  });
  OPT_STATE.addedClasses = (OPT_STATE.addedClasses || []).map(function (k) {
    return k === oldKey ? newKey : k;
  });
  if ((OPT_STATE.addedClasses || []).indexOf(oldKey) !== -1 && OPT_STATE.addedClasses.indexOf(newKey) === -1) {
    OPT_STATE.addedClasses.push(newKey);
  }
  markOptimizationDirty();
  refreshCoachCompositionSection();
  updateReoptimizeButton();
}

/** Add a specific class+composition pair (same class allowed with a different berth composition). */
function addCompositionClass(keyOrUnit) {
  var raw = normalizeCompText(keyOrUnit);
  if (!raw || OPT_STATE.reoptimizing) {
    return;
  }
  ensureCoachStateInitialized();
  var unit;
  var comp;
  var key;
  if (raw.indexOf('|') >= 0) {
    key = raw;
    unit = getCompositionUnit(key);
    comp = getCompositionCompFromKey(key);
  } else {
    unit = raw;
    var unused = getAddableCompositionEntries().filter(function (e) { return e.unit === unit; });
    if (!unused.length) {
      return;
    }
    key = unused[0].key;
    comp = unused[0].comp;
  }
  if (!key || !isCompShapeValid(unit, comp) || getCompositionClasses().indexOf(key) !== -1) {
    return;
  }
  trackCompositionClass(key);
  OPT_STATE.addedClasses = OPT_STATE.addedClasses || [];
  if (OPT_STATE.addedClasses.indexOf(key) === -1) {
    OPT_STATE.addedClasses.push(key);
  }
  OPT_STATE.editedCoaches = OPT_STATE.editedCoaches || {};
  OPT_STATE.editedCoaches[key] = 0;
  OPT_STATE.editedBerthComp = OPT_STATE.editedBerthComp || {};
  OPT_STATE.editedBerthComp[key] = comp;
  markOptimizationDirty();
  refreshCoachCompositionSection();
  updateReoptimizeButton();
}

/** Only coach types added in this pass can be discarded; applied ones are part of the baseline. */
function removeCompositionClass(unit) {
  unit = normalizeCompText(unit);
  if (!unit || OPT_STATE.reoptimizing || (OPT_STATE.addedClasses || []).indexOf(unit) === -1) {
    return;
  }
  OPT_STATE.addedClasses = OPT_STATE.addedClasses.filter(function (u) { return u !== unit; });
  OPT_STATE.compositionClasses = getCompositionClasses().filter(function (u) { return u !== unit; });
  delete (OPT_STATE.editedCoaches || {})[unit];
  delete (OPT_STATE.editedBerthComp || {})[unit];
  markOptimizationDirty();
  refreshCoachCompositionSection();
  updateReoptimizeButton();
}

function buildCoachCompositionRow(key) {
  key = normalizeCompText(key);
  var unit = getCompositionUnit(key);
  var coaches = getCoachCount(key);
  var comp = getBerthComp(key);
  var phy = getEffectivePhyBerths(key);
  var changeTag = getCompositionChangeTag(key);
  var isAdded = changeTag === 'Added';
  var isRemoved = changeTag === 'Removed';
  var isModified = changeTag === 'Modified';
  var disabled = OPT_STATE.reoptimizing ? ' disabled' : '';
  var maxForUnit = getMaxCoachesForUnit(key);
  var inputMax = Math.max(coaches, maxForUnit);
  var atTrainLimit = getTotalCoachCount() >= OPT_MAX_COACHES_TOTAL;
  var compOptions = getBerthCompOptions(key).map(function (value) {
    return '<option value="' + optEsc(value) + '"' + (value === comp ? ' selected' : '') + '>' + optEsc(value) + '</option>';
  }).join('');
  var byClass = isCompositeUnit(unit) ? getUnitBerthsByClass(key) : null;
  var split = byClass ? Object.keys(byClass).map(function (cls) {
    return cls + ' ' + byClass[cls];
  }).join(' \u00b7 ') : '';
  var tagClass = isAdded ? 'opt-coach-tag-added'
    : (isRemoved ? 'opt-coach-tag-removed'
      : (isModified ? 'opt-coach-tag-modified' : ''));
  var rowClass = 'opt-coach-row'
    + (isAdded || isModified ? ' is-modified' : '')
    + (isRemoved ? ' is-removed' : '');
  return '<div class="' + rowClass + '" data-class="' + optEsc(key) + '">'
    + '<span class="opt-cls-badge ' + optClsBadge(unit) + '">' + optEsc(unit) + '</span>'
    + '<select class="form-control opt-coach-comp" data-class="' + optEsc(key) + '"' + disabled
    + ' title="Berths per coach">' + (compOptions || '<option value="">--</option>') + '</select>'
    + '<span class="opt-coach-op">\u00d7</span>'
    + '<button type="button" class="btn btn-default btn-xs opt-coach-minus" data-class="' + optEsc(key) + '"'
    + (disabled || coaches <= 0 ? ' disabled' : '') + ' title="Remove one coach">\u2212</button>'
    + '<input type="number" class="form-control opt-coach-count" data-class="' + optEsc(key) + '" value="' + coaches
    + '" min="0" max="' + inputMax + '"' + disabled
    + ' title="Coaches">'
    + '<button type="button" class="btn btn-default btn-xs opt-coach-plus" data-class="' + optEsc(key) + '"'
    + (disabled || coaches >= maxForUnit || atTrainLimit ? ' disabled' : '')
    + ' title="Add one coach">+</button>'
    + '<span class="opt-coach-op">=</span>'
    + '<strong class="opt-coach-total">' + phy + '</strong>'
    + (split ? '<span class="opt-coach-split">' + optEsc(split) + '</span>' : '')
    + (changeTag ? '<span class="opt-coach-tag ' + tagClass + '">' + optEsc(changeTag) + '</span>' : '')
    + (isAdded ? '<button type="button" class="btn btn-link btn-xs opt-coach-drop" data-class="' + optEsc(key) + '"'
      + disabled + ' title="Discard this coach type">\u00d7</button>' : '')
    + '</div>';
}

function buildCoachCompositionSection() {
  ensureCoachStateInitialized();
  var classes = getCompositionClasses();
  if (!classes.length) {
    return '';
  }
  var totalCoaches = getTotalCoachCount();
  var summary = getCoachChangeSummary();
  var addable = getAddableCompositionEntries();
  var addControl = '';
  if (addable.length) {
    addControl = '<select class="form-control opt-coach-add" id="optCoachAddClass"'
      + (OPT_STATE.reoptimizing || totalCoaches >= OPT_MAX_COACHES_TOTAL ? ' disabled' : '')
      + ' title="Add a class/composition (same class allowed with a different berth composition)">'
      + '<option value="">+ Add class</option>'
      + addable.map(function (entry) {
        return '<option value="' + optEsc(entry.key) + '">' + optEsc(entry.label) + '</option>';
      }).join('')
      + '</select>';
  }
  var summaryHtml = '<div class="opt-coach-summary">'
    + '<span class="opt-coach-summary-item">Total Coaches: <strong>' + summary.total + '</strong></span>'
    + '<span class="opt-coach-summary-item opt-coach-summary-added">Added Coaches: <strong>+' + summary.added + '</strong></span>'
    + '<span class="opt-coach-summary-item opt-coach-summary-removed">Removed Coaches: <strong>-' + summary.removed + '</strong></span>'
    + '</div>';
  return '<div class="opt-coach-section" id="optCoachSection">'
    + '<div class="opt-coach-rows">'
    + '<span class="opt-coach-title"><i class="fa fa-subway"></i> Composition</span>'
    + classes.map(buildCoachCompositionRow).join('')
    + addControl
    + '</div>'
    + summaryHtml
    + '</div>';
}

function refreshCoachCompositionSection() {
  var $section = $('#optCoachSection');
  if ($section.length) {
    $section.replaceWith(buildCoachCompositionSection());
    return;
  }
  renderPreOptimizeComposition();
}

function renderPreOptimizeComposition() {
  var $wrap = $('#optPreCompositionWrap');
  if (!$wrap.length) {
    return;
  }
  if (!CURRENT_PROFILE) {
    $wrap.html('').hide();
    return;
  }
  var html = buildCoachCompositionSection();
  if (!html) {
    $wrap.html('').hide();
    return;
  }
  $wrap.html(html).show();
}
window.renderPreOptimizeComposition = renderPreOptimizeComposition;

function optSelectOptions(values, selected, placeholder, preserveOrder, titleFn) {
  var list = (values || []).slice();
  if (selected && list.indexOf(selected) === -1) {
    list.push(selected);
  }
  if (!preserveOrder) {
    list.sort();
  }
  var html = placeholder ? '<option value="">' + optEsc(placeholder) + '</option>' : '';
  list.forEach(function (v) {
    var title = typeof titleFn === 'function' ? titleFn(v) : '';
    html += '<option value="' + optEsc(v) + '"' + (String(v) === String(selected) ? ' selected' : '') + (title ? ' title="' + optEsc(title) + '"' : '') + '>' + optEsc(v) + '</option>';
  });
  return html;
}

// Options list for a quota <select> where each <option> is titled with the full quota name.
function optQuotaSelectOptions(values, selected, placeholder) {
  return optSelectOptions(values, selected, placeholder, false, quotaTitleIfDifferent);
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
  applyRoadSideQuotaRules(rows);
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
    if (r.QUOTA && r.FROM && r.TO && isRoadSideRoute(r.FROM, r.TO)) {
      var expectedRs = quotaRsCode(r.QUOTA);
      if (String(r.QUOTA).toUpperCase() !== String(expectedRs).toUpperCase()) {
        rowErrors.push('Origin to intermediate must use RS quota (' + expectedRs + ')');
      }
    }
    if (isDuplicateAllocation(rows, r)) {
      rowErrors.push('Duplicate quota + route already exists in this class');
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


function restoreSaveProfileButton($saveBtn, canSave, hasPendingChanges, labelHtml, idleTitle) {
  if (!$saveBtn.length) {
    return;
  }
  if (OPT_STATE.savingProfile) {
    $saveBtn.prop('disabled', true)
      .html('<i class="fa fa-spinner fa-spin"></i> Saving...')
      .attr('title', 'Save in progress');
    return;
  }
  var title = idleTitle || 'Save the last optimization request as a train profile';
  if (!OPT_STATE.optimizationLoaded) {
    title = 'Run Show Optimization before saving a profile';
  } else if (hasPendingChanges) {
    title = 'Re-Optimize your pending changes first — they cannot be saved unoptimized';
  } else if (!OPT_PROFILE.lastRequestPayload) {
    title = 'No optimization request is available to save';
  }
  $saveBtn.prop('disabled', !canSave)
    .html(labelHtml || '<i class="fa fa-save"></i> Save Profile')
    .attr('title', title);
}

function updateReoptimizeButton() {
  var $btn = $('#optReoptimizeBtn');
  var $downloadBtn = $('#optDownloadOptimizedProfilePdfBtn');  
  var $downloadMatrixBtn = $('#optDownloadOptimizedMatrixPdfBtn');
  var $saveBtn = $('#optSaveProfileBtn');
  var $saveAsNewBtn = $('#optSaveAsNewProfileBtn');
  var counts = getChangeCounts();
  var hasPendingChanges = counts.total > 0 && OPT_STATE.optimizationLoaded;
  // Stays clickable while editing; saveOptimizationProfile() rejects unoptimized changes with a message.
  var canSave = OPT_STATE.optimizationLoaded
    && !!OPT_PROFILE.lastRequestPayload
    && !OPT_STATE.reoptimizing;
  var isEdit = OPT_PROFILE.profileMode === 'EDIT';
			   

  if (OPT_STATE.reoptimizing) {
    if ($btn.length) {
      $btn.removeClass('opt-btn-attn').prop('disabled', true)
        .html('<i class="fa fa-spinner fa-spin"></i> Re-Optimizing...')
        .attr('title', 'Re-optimization in progress\u2026');
    }
    $downloadBtn.prop('disabled', true);
    $downloadMatrixBtn.prop('disabled', true);
    restoreSaveProfileButton($saveBtn, false, hasPendingChanges);
    restoreSaveProfileButton($saveAsNewBtn, false, hasPendingChanges,
      '<i class="fa fa-copy"></i> Save as New Profile');
    $saveAsNewBtn.toggle(isEdit);
    return;
  }
  if ($btn.length) {
    var label = '<i class="fa fa-magic"></i> Re-Optimize';
    var title = 'Edit a berth allocation or remotes above to enable Re-Optimize';
    if (hasPendingChanges) {
      label = '<i class="fa fa-magic"></i> Re-Optimize (' + counts.total + (counts.total === 1 ? ' Change' : ' Changes') + ')';
      title = 'Apply your ' + counts.total + ' unsaved change' + (counts.total === 1 ? '' : 's') + ' and re-run the optimizer';
    }
    $btn.prop('disabled', !hasPendingChanges).html(label).attr('title', title)
      .toggleClass('opt-btn-attn', hasPendingChanges);
  }

  $downloadBtn.prop('disabled', !OPT_STATE.optimizationLoaded || hasPendingChanges);		
  $downloadMatrixBtn.prop('disabled', !OPT_STATE.optimizationLoaded || hasPendingChanges);
  restoreSaveProfileButton($saveBtn, canSave, hasPendingChanges,
    '<i class="fa fa-save"></i> Save Profile',
    isEdit ? 'Update the selected profile' : 'Save as a new train profile');
  restoreSaveProfileButton($saveAsNewBtn, canSave && isEdit && !!OPT_PROFILE.selectedProfileId, hasPendingChanges,
    '<i class="fa fa-copy"></i> Save as New Profile',
    'Save the current work as the next profile id');
  $saveAsNewBtn.toggle(isEdit);
  updateChangeSummaryPanel();
  updateOptProfileStatus();
}

function updateOptProfileStatus() {
  var $wrap = $('#optProfileStatus');
  if (!$wrap.length) {
    return;
  }
  var profileId = String(OPT_PROFILE.selectedProfileId || '').trim();
  var pending = OPT_STATE.optimizationLoaded && getChangeCounts().total > 0;
  var stateCls = 'is-new';
  var stateLabel = 'Not saved yet';
  if (pending) {
    stateCls = 'is-unsaved';
    stateLabel = 'Unsaved changes';
  } else if (OPT_PROFILE.profileSaved) {
    stateCls = 'is-saved';
    stateLabel = 'Saved';
  }
  $wrap.html(
    '<span class="opt-profile-status-id">'
    + (profileId
      ? '<i class="fa fa-id-card-o"></i> Profile ' + optEsc(profileId)
      : '<i class="fa fa-file-o"></i> New profile')
    + '</span>'
    + '<span class="opt-profile-status-state ' + stateCls + '">' + optEsc(stateLabel) + '</span>'
  );
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
    + '<div class="opt-change-summary-item opt-summary-warning"><span class="lbl">Coaches</span><strong>' + counts.coachChanges + '</strong></div>'
    + '<div class="opt-change-summary-item opt-summary-danger"><span class="lbl">Removed</span><strong>' + (counts.deleted + counts.dismissed) + '</strong></div>'
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
    var comparisonStatus = row.comparisonApplied ? row.comparisonStatus : '';
    var qColor = optQuotaColor(row.QUOTA || '');
    $card.toggleClass('opt-alloc-new', (isNew || comparisonStatus === 'added') && !removed);
    $card.toggleClass('opt-alloc-modified', modified || comparisonStatus === 'modified');
    $card.toggleClass('opt-alloc-removed', removed);
    $card.attr('data-is-new', isNew ? '1' : '0');
    $card.attr('data-removed', removed ? '1' : '0');
    $card.attr('data-quota', row.QUOTA || '');
    $card.attr('data-from', row.FROM || '');
    $card.attr('data-to', row.TO || '');
    $card.css('--opt-quota-color', removed ? '#94a3b8' : qColor);
    var quotaFullName = row.QUOTA ? getQuotaFullName(row.QUOTA) : '';
    $card.find('.opt-quota-pill').text(row.QUOTA || 'Quota').css({
      color: removed ? '#94a3b8' : qColor,
      borderColor: removed ? '#94a3b8' : qColor,
      background: (removed ? '#94a3b8' : qColor) + '18'
    }).attr('title', quotaFullName && quotaFullName !== row.QUOTA ? quotaFullName : null);
    $card.find('.opt-edit-quota').attr('title', quotaFullName && quotaFullName !== row.QUOTA ? quotaFullName : null);
    $card.find('.opt-edit-quota, .opt-edit-from, .opt-edit-to, .opt-edit-berths').prop('disabled', removed || OPT_STATE.reoptimizing);
    var $badge = $card.find('.opt-alloc-badge');
    var changeLabel = getAllocationChangeLabel(row);
    if (removed) {
      $badge.text((row.comparisonApplied && row.comparisonLabel) ? row.comparisonLabel : removedBerthLabel(row))
        .attr('data-change-type', 'removed').show();
      $card.find('.opt-edit-berths').val(0);
    } else if (isNew) {
      $badge.text(row.comparisonLabel || 'New').attr('data-change-type', comparisonStatus || 'new').show();
    } else if (comparisonStatus) {
      $badge.text(row.comparisonLabel || (comparisonStatus === 'modified' ? 'Modified' : comparisonStatus))
        .attr('data-change-type', comparisonStatus).show();
    } else if (modified && changeLabel) {
      $badge.text(changeLabel).attr('data-change-type', 'modified').show();
    } else {
      $badge.hide().text('');
    }
    updateAllocationCardDiff($card, row, modified);
    $card.find('.opt-del-row').toggle(!removed);
    $card.find('.opt-restore-row').remove();
    var $footer = $card.find('.opt-alloc-footer');
    var $dismiss = $card.find('.opt-dismiss-row');
    if (removed) {
      if (!$dismiss.length) {
        $footer.append(
          '<button type="button" class="btn btn-link opt-dismiss-row" title="Dismiss removed allocation">'
          + '<i class="fa fa-times"></i></button>'
        );
      } else {
        $dismiss.show();
      }
    } else {
      $dismiss.remove();
    }
  });
  updateClassHeaders();
  updateReoptimizeButton();
  applyQuotaFocusMode({ scroll: false });
}
	

	  


function syncAndRefreshChanges(changedRowId) {
  if (OPT_STATE.syncingAllocations) {
    return;
  }
  OPT_STATE.syncingAllocations = true;
  try {
    syncEditedRowsFromDom();
    if (changedRowId != null) {
      var changedRow = OPT_STATE.editedRows.find(function (r) { return r._rowId === changedRowId; });
      if (changedRow && changedRow.comparisonApplied) {
        changedRow.comparisonApplied = false;
        changedRow.comparisonStatus = '';
        changedRow.comparisonLabel = '';
      }
    }
    var rsChanged = applyRoadSideQuotaRules(OPT_STATE.editedRows, changedRowId);
    if (rsChanged) {
      refreshBerthTableSection();
      return;
    }
    refreshAllocationCardStates();
    refreshAllocationDropdownFilters();
    flagLiveAllocationValidationErrors();
    if ($('#optCompareClassPills').length) {
      renderOptBerthCompare();
    }
  } finally {
    OPT_STATE.syncingAllocations = false;
  }
}

function flagLiveAllocationValidationErrors() {
  clearOptInlineErrors();
  (OPT_STATE.editedRows || []).forEach(function (r) {
    if (!r || r.removed || !r.QUOTA || !r.FROM || !r.TO) {
      return;
    }
    var msgs = [];
    if (isDuplicateAllocation(OPT_STATE.editedRows, r)) {
      msgs.push('Duplicate quota + route already exists in this class');
    }
    if (isRoadSideRoute(r.FROM, r.TO) && String(r.QUOTA).toUpperCase() !== String(quotaRsCode(r.QUOTA)).toUpperCase()) {
      msgs.push('Origin to intermediate must use RS quota (' + quotaRsCode(r.QUOTA) + ')');
    }
    if (msgs.length) {
      markOptCardErrors(r._rowId, msgs);
    }
  });
}

function refreshAllocationDropdownFilters() {
  var rows = OPT_STATE.editedRows || [];
  var allQuotas = getOptQuotaOptions();
  $('#optBerthTableWrap .opt-alloc-card[data-row-id]').each(function () {
    var $card = $(this);
    var rowId = parseInt($card.attr('data-row-id'), 10);
    var row = rows.find(function (r) { return r._rowId === rowId; });
    if (!row || row.removed) {
      return;
    }
    var availableQuotas = getAvailableQuotasForRow(row, allQuotas, rows);
    var $quota = $card.find('.opt-edit-quota');
    var current = row.QUOTA || '';
    $quota.html(optQuotaSelectOptions(availableQuotas, current, 'Quota'));
    if (String($quota.val() || '') !== String(current || '')) {
      $quota.val(current);
    }
    $card.attr('data-quota', current);
    $card.attr('data-from', row.FROM || '');
    $card.attr('data-to', row.TO || '');
  });
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
  $('#optimizationContent').find('.opt-edit-quota, .opt-edit-from, .opt-edit-to, .opt-edit-berths, .opt-add-row, .opt-del-row, .opt-dismiss-row, .opt-berth-cls-head, .opt-coach-minus, .opt-coach-plus, .opt-coach-comp, .opt-coach-count, .opt-coach-drop, .opt-coach-add, #optReoptimizeBtn')
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

function copyAllocationRowsForComparison(rows) {
  return (rows || []).map(function (r) {
    return {
      CLASS: r.CLASS,
      QUOTA: r.QUOTA,
      FROM: r.FROM,
      TO: r.TO,
      BERTHS: optNum(r.BERTHS),
      isNew: !!r.isNew,
      removed: !!r.removed,
      origKey: r.origKey,
      removedBerthsOrig: r.removedBerthsOrig,
      origSnapshot: r.origSnapshot ? Object.assign({}, r.origSnapshot) : null
    };
  });
}

function savedPayloadRowsForComparison(payload) {
  var body = toOptimizeRequestPayload(payload);
  return editedBerthsMapToComparisonRows(body.edited_berths || {});
}

/** Build comparison rows for every key in an edited_berths map (vs CURRENT_PROFILE baseline). */
function editedBerthsMapToComparisonRows(editedBerths) {
  var currentByKey = {};
  ((CURRENT_PROFILE && CURRENT_PROFILE.berths) || []).forEach(function (r) {
    var current = {
      CLASS: r.CLS || r.CLASS || '',
      QUOTA: r.QUOTA_TYPE || r.QUOTA || '',
      FROM: r.SOURCE || r.FROM || '',
      TO: r.DESTINATION || r.TO || '',
      BERTHS: optNum(r.BERTH != null ? r.BERTH : r.BERTHS)
    };
    currentByKey[rowToBerthKey(current)] = current;
  });

  return Object.keys(editedBerths || {}).map(function (key) {
    var parsed = parseBerthKey(key);
    var original = currentByKey[key];
    var modifiedBerths = optNum(editedBerths[key]);
    var intent = modifiedBerths === 0 ? 'removed'
      : (!original ? 'added' : 'modified');
    return {
      CLASS: parsed.cls,
      QUOTA: parsed.quota,
      FROM: parsed.from,
      TO: parsed.to,
      BERTHS: modifiedBerths,
      isNew: intent === 'added',
      removed: intent === 'removed',
      comparisonIntent: intent,
      origKey: key,
      removedBerthsOrig: original ? original.BERTHS : 0,
      origSnapshot: original ? {
        QUOTA: original.QUOTA,
        FROM: original.FROM,
        TO: original.TO,
        BERTHS: original.BERTHS
      } : null
    };
  });
}

function applySuccessfulReoptimizeComparison(requestedRows) {
  var responseByKey = {};
  (OPT_STATE.editedRows || []).forEach(function (r) {
    responseByKey[rowToBerthKey(r)] = r;
  });

  (requestedRows || []).forEach(function (requested) {
    var status = requested.comparisonIntent
      || (requested.removed ? 'removed'
        : (requested.isNew ? 'added' : (isRowModified(requested) ? 'modified' : '')));
    if (!status) {
      return;
    }

    var key = status === 'removed'
      ? (requested.origKey || rowToBerthKey(requested))
      : (requested.origKey || rowToBerthKey(requested));
    var target = responseByKey[key];
    if (!target) {
      // Match by CLASS/QUOTA/FROM/TO if key casing or formatting drifts.
      target = (OPT_STATE.editedRows || []).find(function (r) {
        return rowToBerthKey(r) === key
          || (String(r.CLASS) === String(requested.CLASS)
            && String(r.QUOTA) === String(requested.QUOTA)
            && String(r.FROM) === String(requested.FROM)
            && String(r.TO) === String(requested.TO));
      });
    }
    if (!target) {
      target = {
        _rowId: OPT_STATE.nextRowId++,
        CLASS: requested.CLASS,
        QUOTA: requested.QUOTA,
        FROM: requested.FROM,
        TO: requested.TO,
        BERTHS: status === 'removed' ? 0 : optNum(requested.BERTHS),
        isNew: false,
        removed: false,
        origKey: key,
        origSnapshot: {
          QUOTA: requested.QUOTA,
          FROM: requested.FROM,
          TO: requested.TO,
          BERTHS: status === 'removed' ? 0 : optNum(requested.BERTHS)
        }
      };
      OPT_STATE.editedRows.push(target);
      responseByKey[key] = target;
    }

    var originalBerths = requested.origSnapshot
      ? optNum(requested.origSnapshot.BERTHS)
      : getRemovedBerthCount(requested);
    target.comparisonApplied = true;
    target.comparisonStatus = status;
    // Saved-profile / post-reopt tags stay short: Modified | Removed | Added.
    target.comparisonLabel = status === 'added'
      ? 'Added'
      : (status === 'removed' ? 'Removed' : 'Modified');
    target.comparisonOriginalBerths = status === 'added' ? null : originalBerths;
    target.comparisonModifiedBerths = status === 'removed' ? 0 : optNum(requested.BERTHS);

    if (status === 'removed') {
      target.removed = true;
      target.BERTHS = 0;
      target.removedBerthsOrig = originalBerths;
    } else if (status === 'modified' || status === 'added') {
      // Keep the card on the payload value even if the optimizer response drifted.
      target.BERTHS = optNum(requested.BERTHS);
      target.removed = false;
    }
    if (target.CLASS) {
      OPT_STATE.expandedClasses = OPT_STATE.expandedClasses || {};
      OPT_STATE.expandedClasses[target.CLASS] = true;
    }
  });

  OPT_STATE.hasChanges = false;
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

  // Only pending (unsaved) edits should enable a re-optimize pass — not already-persisted remotes/berths.
  if (getChangeCounts().total === 0) {
    return;
  }

  var delta = buildCumulativeReoptimizeDelta(rows);

  var fromDate = $('#optFromDate').val();
  var toDate = $('#optToDate').val();
  if (!fromDate || !toDate || fromDate >= toDate) {
    alert('Please select valid date range');
    return;
  }
  if (!validateOptimizationEndToEndSelection()) {
	    return;
	  }
  setOptimizationEditMode(true);

  getReoptimizeData(fromDate, toDate, delta)
    .then(function (response) {
      if (extractOptimizationApiError(response)
          || !(response && (response.optimizer_result || (response.data && response.data.optimizer_result)))) {
        drawOptimizationProfile(response);
        return;
      }
      persistReoptimizeDelta(delta);
      syncCoachBaselineAfterOptimize();
      drawOptimizationProfile(response);
      // Tag every key in the request payload — not only this session's dirty rows.
      applySuccessfulReoptimizeComparison(
        editedBerthsMapToComparisonRows((delta && delta.edited_berths) || {})
      );
    })
    .catch(function (e) {
      console.error(e);
      showOptimizationApiError(e.message || 'Re-optimize did not complete — network or server issue.', {
        preserveWorkspace: true,
        title: 'Re-optimize failed',
        hint: 'Your unsaved quota-berth edits are still here — fix what you need and retry.'
      });
    })
    .finally(function () {
      setOptimizationEditMode(false);
      // Re-apply after unlock — highlight is deferred and must win over edit-mode DOM tweaks.
      if (OPT_STATE.capacityViolation) {
        window.setTimeout(function () {
          if (OPT_STATE.capacityViolation) {
            applyCapacityViolationHighlights(OPT_STATE.capacityViolation);
          }
        }, 50);
      }
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

  $doc.on('click.optEditor', '#optimizationContainer .opt-coach-minus', function (e) {
    e.preventDefault();
    adjustCoachCount($(this).attr('data-class'), -1);
  });

  $doc.on('click.optEditor', '#optimizationContainer .opt-coach-plus', function (e) {
    e.preventDefault();
    adjustCoachCount($(this).attr('data-class'), 1);
  });

  $doc.on('change.optEditor', '#optimizationContainer .opt-coach-comp', function () {
    setBerthComp($(this).attr('data-class'), $(this).val());
  });

  $doc.on('change.optEditor', '#optimizationContainer .opt-coach-count', function () {
    setCoachCount($(this).attr('data-class'), $(this).val());
  });

  $doc.on('click.optEditor', '#optimizationContainer .opt-coach-drop', function (e) {
    e.preventDefault();
    removeCompositionClass($(this).attr('data-class'));
  });

  $doc.on('change.optEditor', '#optimizationContainer #optCoachAddClass', function () {
    addCompositionClass($(this).val());
  });

  $doc.on('click.optEditor', '#optimizationContainer .opt-quota-legend-item[data-quota]', function (e) {
    e.preventDefault();
    toggleQuotaFocus(String($(this).attr('data-quota') || ''));
  });

  $doc.on('click.optEditor', '#optimizationContainer #optQuotaFocusReset', function (e) {
    e.preventDefault();
    clearQuotaFocus();
  });

  $doc.on('change.optEditor', '#optimizationContainer #optRouteFocusFrom, #optimizationContainer #optRouteFocusTo', function () {
    var from = String($('#optRouteFocusFrom').val() || '').trim();
    var to = String($('#optRouteFocusTo').val() || '').trim();
    setRouteFocus(from, to, { scroll: !!(from || to) });
  });

  $doc.on('click.optEditor', '#optimizationContainer #optRouteFocusReset', function (e) {
    e.preventDefault();
    clearRouteFocus();
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
    syncEditedRowsFromDom();
    var $card = $(this).closest('.opt-alloc-card');
    var rowId = parseInt($card.attr('data-row-id'), 10);
    var row = OPT_STATE.editedRows.find(function (r) { return r._rowId === rowId; });
    if (!row) {
      return;
    }
    if (row.isNew) {
      OPT_STATE.editedRows = OPT_STATE.editedRows.filter(function (r) { return r._rowId !== rowId; });
      $card.remove();
      refreshBerthSummaryPills();
      updateClassHeaders();
      updateChangeSummaryPanel();
    } else {
      if (row.removedBerthsOrig == null) {
        row.removedBerthsOrig = getRemovedBerthCount(row);
      }
      row.removed = true;
      row.BERTHS = 0;
      // Do not add to deletedKeys yet — simple Remove still sends 0. ✕ dismisses fully.
      $card.find('.opt-edit-berths').val(0);
      $card.find('.opt-del-row').hide();
      if (!$card.find('.opt-dismiss-row').length) {
        $card.find('.opt-alloc-footer').append(
          '<button type="button" class="btn btn-link opt-dismiss-row" title="Dismiss removed allocation">'
          + '<i class="fa fa-times"></i></button>'
        );
      }
      refreshAllocationCardStates();
      refreshBerthSummaryPills();
      updateChangeSummaryPanel();
    }
    markOptimizationDirty();
  });

  $doc.on('click.optEditor', '#optimizationContainer .opt-dismiss-row', function (e) {
    e.preventDefault();
    e.stopPropagation();
    if (OPT_STATE.reoptimizing) {
      return;
    }
    syncEditedRowsFromDom();
    var $card = $(this).closest('.opt-alloc-card');
    var rowId = parseInt($card.attr('data-row-id'), 10);
    var row = OPT_STATE.editedRows.find(function (r) { return r._rowId === rowId; });
    if (!row) {
      return;
    }
    // Remove + ✕ → permanently dismiss: omit from API (do not pass 0), including a
    // previously applied 0 that is still carried in the persisted constraints.
    if (row.origKey && OPT_STATE.deletedKeys.indexOf(row.origKey) === -1) {
      OPT_STATE.deletedKeys.push(row.origKey);
    }
    OPT_STATE.editedRows = OPT_STATE.editedRows.filter(function (r) { return r._rowId !== rowId; });
    $card.remove();
    refreshBerthSummaryPills();
    updateClassHeaders();
    updateChangeSummaryPanel();
    markOptimizationDirty();
  });

  $doc.on('change.optEditor input.optEditor', '#optimizationContainer #optBerthTableWrap .opt-edit-quota, #optimizationContainer #optBerthTableWrap .opt-edit-from, #optimizationContainer #optBerthTableWrap .opt-edit-to, #optimizationContainer #optBerthTableWrap .opt-edit-berths', function () {
    if (OPT_STATE.reoptimizing || OPT_STATE.syncingAllocations) {
      return;
    }
    clearOptInlineErrors();
    var rowId = parseInt($(this).closest('.opt-alloc-card').attr('data-row-id'), 10);
    syncAndRefreshChanges(isNaN(rowId) ? null : rowId);
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
  applyQuotaFocusMode({ scroll: false });
  flagLiveAllocationValidationErrors();
  if (OPT_STATE.capacityViolation) {
    applyCapacityViolationHighlights(OPT_STATE.capacityViolation);
  }
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
function bindOptimizedProfilePdfButton() {
    $('#optimizationContainer #optDownloadOptimizedProfilePdfBtn')
      .off('click.optPdf')
      .on('click.optPdf', function (e) {
        e.preventDefault();
        downloadOptimizedProfilePdf();
      });	 
   $('#optimizationContainer #optDownloadOptimizedMatrixPdfBtn')
	      .off('click.optMatrixPdf')
	      .on('click.optMatrixPdf', function (e) {
	        e.preventDefault();
	        if (!$(this).prop('disabled')) {
	          downloadOptimizedMatrixPdf();
	        }
	      });
    $('#optimizationContainer #optSaveProfileBtn')
      .off('click.optSave')
      .on('click.optSave', function (e) {
        e.preventDefault();
        if (!$(this).prop('disabled')) {
          saveOptimizationProfile(false);
        }
      });
    $('#optimizationContainer #optSaveAsNewProfileBtn')
      .off('click.optSaveNew')
      .on('click.optSaveNew', function (e) {
        e.preventDefault();
        if (!$(this).prop('disabled')) {
          saveOptimizationProfile(true);
        }
      });
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
  // Same 120-day future cap as demand (demandFrom/demandTo).
  var maxDate = formatDateForInit(addDays(new Date(), 120));
  ['#fromDate', '#toDate', '#optFromDate', '#optToDate'].forEach(function (sel) {
    if ($(sel).length) {
      $(sel).attr('max', maxDate);
    }
  });
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
  var mode = OPT_PROFILE.profileMode === 'EDIT' ? 'EDIT' : 'CREATE';
  $('#optimizationContainer').html(
    '<div class="opt-profile-mode">'
    + '<div class="opt-profile-mode-legend">Profile Mode</div>'
    + '<div class="opt-profile-mode-row">'
    + '<label class="opt-profile-radio"><input type="radio" name="optProfileMode" value="CREATE"' + (mode === 'CREATE' ? ' checked' : '') + '> Create New Profile</label>'
    + '<label class="opt-profile-radio"><input type="radio" name="optProfileMode" value="EDIT"' + (mode === 'EDIT' ? ' checked' : '') + '> Edit Existing Profile</label>'
    + '<div id="optProfileSelectWrap" class="opt-profile-select-wrap' + (mode === 'EDIT' ? ' is-visible' : '') + '">'
    + '<label for="optSavedProfileSelect">Select Profile</label>'
    + '<select id="optSavedProfileSelect" class="form-control" style="border-radius:8px;height:34px;">'
    + '<option value="">Select Profile</option>'
    + '</select></div></div></div>'
    + '<div class="row" style="margin-bottom:12px;">'
    + '<div class="col-md-2"><label class="utilization-filter-label">FROM DATE</label>'
    + '<input type="date" id="optFromDate" class="form-control" style="border-radius:8px;" value="' + range.from + '"></div>'
    + '<div class="col-md-2"><label class="utilization-filter-label">TO DATE</label>'
    + '<input type="date" id="optToDate" class="form-control" style="border-radius:8px;" value="' + range.to + '"></div>'
    + '<div class="col-md-2"><label class="utilization-filter-label" for="optTrainType">TRAIN TYPE</label>'
    + '<select id="optTrainType" class="form-control" style="border-radius:8px;height:34px;"><option value="">Select Train Type</option><option value="END_TO_END">End to End</option><option value="NON_END_TO_END">Non End to End</option></select></div>'
    + '<div id="optEndToEndStations" class="col-md-4" style="display:none;"><div class="row">'
    + '<div class="col-xs-6"><label class="utilization-filter-label" for="optEndToEndFromStation">END TO END - FROM</label><select id="optEndToEndFromStation" class="form-control" style="border-radius:8px;height:34px;"></select></div>'
    + '<div class="col-xs-6"><label class="utilization-filter-label" for="optEndToEndToStation">END TO END - TO</label><select id="optEndToEndToStation" class="form-control" style="border-radius:8px;height:34px;"></select></div>'
    + '</div></div>'
    + '<div class="col-md-2" style="margin-top:24px;">'
    + '<button type="button" id="showOptimizationBtn" class="btn btn-primary form-control" style="font-weight:600;height:34px;">Show Optimization</button></div>'
    + '</div>'
    + '<div id="optPreCompositionWrap" class="opt-pre-composition-wrap" style="display:none;"></div>'
    + '<div id="optimizationContent"></div>'
  );
  initializeDefaultDatesForOptAndUtil(false);
  populateOptimizationEndToEndStations();
  updateOptimizationEndToEndFields();
  bindOptimizationEditorEvents();
  renderPreOptimizeComposition();
  if (mode === 'EDIT') {
    refreshOptimizationProfileList();
  }
}

// Entry point after API success — same data split as fontend_raw_modular/js/app.js optimizeProfile().
function drawOptimizationProfile(responseData) {
  var preserveWorkspace = OPT_STATE.optimizationLoaded && $('#optBerthTableWrap').length;
  var payload = responseData || {};
  var embeddedError = extractOptimizationApiError(payload);
  if (embeddedError) {
    showOptimizationApiError(embeddedError, {
      preserveWorkspace: preserveWorkspace,
      title: /solver|failed|fail/i.test(embeddedError) ? 'Could not optimize' : 'Optimization error',
      hint: preserveWorkspace
        ? 'Your unsaved quota-berth changes are still here. Please review your changes and try Re-Optimize again.'
        : 'Try a different date range, or check that this train has a usable profile.'
    });
    return;
  }
  if (payload.success === false) {
    showOptimizationApiError(payload.error || 'The optimizer returned an error for this train/date range.', {
      preserveWorkspace: preserveWorkspace,
      title: 'Could not optimize',
      hint: preserveWorkspace
        ? 'Your unsaved quota-berth changes are still here. Please review your changes and try Re-Optimize again.'
        : 'Try a different date range, or check that this train has a usable profile.'
    });
    return;
  }
  var data = payload.data != null ? payload.data : payload;
  var optimizer = data && data.optimizer_result;
  var currentUtil = (data.current_analysis && data.current_analysis.utilization) || [];
  var optimizedUtil = (data.optimized_analysis && data.optimized_analysis.utilization) || [];

  if (!optimizer || !currentUtil.length) {
    showOptimizationApiError(
      'Nothing to show for this train and date window — the optimizer came back empty.',
      {
        preserveWorkspace: preserveWorkspace,
        title: 'No optimization data',
        hint: preserveWorkspace
          ? 'Your unsaved quota-berth changes are still here. Please review your changes and try Re-Optimize again.'
          : 'Pick another FROM/TO date range and hit Show Optimization again.'
      }
    );
    return;
  }

  clearOptimizationApiError();

  if (!$('#optimizationContent').length) {
    buildOptimizationTabShell();
  }

  OPT_STATE.optimizer = optimizer;
  OPT_STATE.currentUtil = currentUtil;
  OPT_STATE.optimizedUtil = optimizedUtil;
  OPT_STATE.classCapacity = extractClassCapacityFromOptimizeData(data);
  OPT_STATE.originalRemotes = ensureUniqueCodes(optimizer.remotes || []);
  restoreRemoteStateFromPersisted();
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
  // A fresh optimizer result is not what is stored against the profile id until it is saved.
  OPT_PROFILE.profileSaved = false;
  OPT_STATE.focusRowId = null;
  OPT_STATE.expandedClasses = {};
  if (!OPT_STATE.activeAddClass && OPT_STATE.editedRows.length) {
    OPT_STATE.activeAddClass = OPT_STATE.editedRows[0].CLASS;
  }
  var compareClasses = getOptCompareClasses();
  if (!OPT_STATE.compareClass || compareClasses.indexOf(OPT_STATE.compareClass) === -1) {
    OPT_STATE.compareClass = compareClasses[0] || OPT_STATE.activeAddClass || ACTIVE_CLASS || '';
  }

  // Composition included in this successful optimize/reoptimize is applied — not a pending change.
  syncCoachBaselineAfterOptimize();

  renderOptimizationDashboard(optimizer, currentUtil, optimizedUtil);
  renderPreOptimizeComposition();
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
    + '<div class="opt-top-bar-text">'
    + '<div class="opt-section-title">Optimised profile</div>'
    + '<div class="opt-section-sub">Review and edit berth allocations, then re-optimise.</div>'
    + '</div>'
    + '<div id="optProfileStatus" class="opt-profile-status"></div>'
    + '</div>'
    + buildOptimizationSummaryCards(summary)
    + buildRemotesSection(optimizer.remotes || [])
    + buildBerthTableSection(OPT_STATE.editedRows.length ? OPT_STATE.editedRows : berthRows)
    + (hasComparison ? buildOptBerthCompareSection() : '<div class="alert alert-warning">Profile comparison charts need optimized_analysis.utilization from API.</div>')
    + '<div class="opt-footer-compact">'
    + '<div id="optChangeSummaryPanel" class="opt-change-summary-panel"></div>'
    + '<div class="opt-action-bar">'
    + '<button type="button" id="optSaveProfileBtn" class="btn btn-primary" style="margin-right:10px;" title="Save the last optimization request as a train profile">'
    + '<i class="fa fa-save"></i> Save Profile'
    + '</button>'
    + '<button type="button" id="optSaveAsNewProfileBtn" class="btn btn-primary" style="margin-right:10px;'
    + (OPT_PROFILE.profileMode === 'EDIT' ? '' : 'display:none;')
    + '" title="Save as the next profile id">'
    + '<i class="fa fa-copy"></i> Save as New Profile'
    + '</button>'
    + '<button type="button" id="optDownloadOptimizedProfilePdfBtn" class="btn btn-primary" style="margin-right:10px;" title="Download optimized train profile">'
    + '<i class="fa fa-download"></i> Download Optimized Train Profile'
    + '</button>'
    + '<button type="button" id="optDownloadOptimizedMatrixPdfBtn" class="btn btn-primary" style="margin-right:10px;" title="Download Comparison">'
    + '<i class="fa fa-download"></i> Download Comparison'
    + '</button>'
    + '<button type="button" id="optReoptimizeBtn" class="btn btn-primary" disabled>Re-Optimize</button>'
    + '</div></div>';

  $('#optimizationContent').html(html);
  bindOptimizedProfilePdfButton();
  refreshRemotesUi();
  applyQuotaFocusMode({ scroll: false });
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

function initRemoteEditState(remotes, preserveSession) {
  OPT_STATE.originalRemotes = ensureUniqueCodes(remotes);
  if (!preserveSession) {
    OPT_STATE.remoteAdded = [];
    OPT_STATE.remoteRemoved = [];
  }
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
  initRemoteEditState(remotes || [], true);
  var stationOptions = getRemoteStationOptions();
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
  var last = getTrainDestinationStation();
  if (last && code === last) {
    alert('The train\'s last station (' + last + ') cannot be configured as a remote.');
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
      + '<div class="opt-diff-quota" style="color:' + color + ';"' + quotaTitleAttr(row.quota) + '>' + optEsc(row.quota) + '</div>'
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
  var top = items.slice(0, OPT_TOP_IMPACT_LIMIT).map(function (x) {
    var cls = x.delta > 0 ? 'opt-diff-chip-up' : 'opt-diff-chip-down';
    var sign = x.delta > 0 ? '+' : '';
    return '<span class="opt-diff-summary-chip ' + cls + '"' + quotaTitleAttr(x.quota) + '>' + optEsc(x.quota) + ' ' + sign + x.delta + '</span>';
  }).join('');
  return '<div class="opt-berth-diff-impact"><span class="opt-impact-label">Top impact</span>' + top + '</div>';
}
function optNormalizeProfileBerthRow(r) {
    return {
      cls: String(r.CLS || r.CLASS || '').trim(),
      quota: String(r.QUOTA_TYPE || r.QUOTA || '').trim(),
      from: String(r.SOURCE || r.FROM || '').trim(),
      to: String(r.DESTINATION || r.TO || '').trim(),
      berths: optNum(r.BERTH || r.ALLOCATED_BERTHS || r.BERTHS)
    };
  }
function getOptimizationMatrixStations(rows) {
var seen = {};
var routeStations = getRouteStationOrder() || {};
var stations = Object.keys(routeStations)
  .sort(function(a, b) {
      return routeStations[a] - routeStations[b];
  })
  .filter(function(station) {
      if (!station || seen[station]) {
          return false;
      }
      seen[station] = true;
      return true;
  });
(rows || []).forEach(function(r) {
  [r.from, r.to].forEach(function(station) {
      if (station && !seen[station]) {
          seen[station] = true;
          stations.push(station);
      }
  });
});
return stations;
}					 
											 
function groupAllocationMatricesByClass(berths) {
	  var byClass = {};
	  (berths || []).map(optNormalizeProfileBerthRow).forEach(function (r) {
	    if (!r.cls || !r.from || !r.to || r.berths <= 0) return;
	    if (!byClass[r.cls]) byClass[r.cls] = { cells: {}, rows: [] };
	    var key = r.from + '-' + r.to;
	    if (!byClass[r.cls].cells[key]) byClass[r.cls].cells[key] = [];
	    byClass[r.cls].cells[key].push((r.quota || '-') + '[' + r.berths + ']');
	    byClass[r.cls].rows.push(r);
	  });
	  return byClass;
	}

	function groupProposedAllocationMatricesByClass() {
	  return groupAllocationMatricesByClass(getProposedBerthsForCompare());
	}
	function groupExistingAllocationMatricesByClass() {
		  return groupAllocationMatricesByClass((CURRENT_PROFILE && CURRENT_PROFILE.berths) || []);
		}
  function groupProposedAllocationMatricesByClass() {
    var byClass = {};
    getProposedBerthsForCompare().map(optNormalizeProfileBerthRow).forEach(function (r) {
      if (!r.cls || !r.from || !r.to || r.berths <= 0) {
        return;
      }
      if (!byClass[r.cls]) {
        byClass[r.cls] = { cells: {}, rows: [] };
      }
      var key = r.from + '-' + r.to;
      if (!byClass[r.cls].cells[key]) {
        byClass[r.cls].cells[key] = [];
      }
      byClass[r.cls].cells[key].push((r.quota || '-') + '[' + r.berths + ']');
      byClass[r.cls].rows.push(r);
    });
    return byClass;
  }
//
//  function buildProposedAllocationStationMatrixRows(matrix) {
//    var stations = getOptimizationMatrixStations(matrix.rows);
//    return stations.map(function (fromStation) {
//      return [fromStation].concat(stations.map(function (toStation) {
//        var values = matrix.cells[fromStation + '-' + toStation];
//        return values && values.length ? values.join(', ') : '-';
//      }));
//    });
//  }
//  function buildProposedAllocationStationMatrixRows(matrix) {
//
//      var seen = {};
//      var stations = [];
//
//      // Collect only stations involved in allocation changes
//      matrix.rows.forEach(function (r) {
//          if (r.berths > 0) {
//
//              if (!seen[r.from]) {
//                  seen[r.from] = true;
//                  stations.push(r.from);
//              }
//
//              if (!seen[r.to]) {
//                  seen[r.to] = true;
//                  stations.push(r.to);
//              }
//          }
//      });
//
//      // Preserve route order
//      var routeOrder = getRouteStationOrder() || {};
//
//      stations.sort(function(a, b) {
//          return (routeOrder[a] || 9999) - (routeOrder[b] || 9999);
//      });
//
//      return stations.map(function (fromStation) {
//          return [fromStation].concat(
//              stations.map(function (toStation) {
//                  var values = matrix.cells[fromStation + '-' + toStation];
//                  return values && values.length ? values.join(', ') : '-';
//              })
//          );
//      });
//  }			



function buildProposedAllocationStationMatrixRows(matrix) {
      var stations = getOptimizationMatrixStations(matrix.rows);
      // Keep only stations having at least one allocation
      stations = stations.filter(function(stn) {
          return matrix.rows.some(function(r) {
              return r.from === stn || r.to === stn;
          });
      });
      var sumCellBerths = function (cellText) {
        if (!cellText || cellText === '-') {
          return 0;
        }
        var total = 0;
        String(cellText).replace(/\[(\d+)\]/g, function (_m, n) {
          total += Number(n) || 0;
          return '';
        });
        return total;
      };
      var colTotals = stations.map(function () { return 0; });
      var grandTotal = 0;
      var bodyRows = stations.map(function(fromStation, rowIdx) {
          var rowTotal = 0;
          var cells = stations.map(function(toStation, colIdx) {
              var values = matrix.cells[fromStation + '-' + toStation];
              var text = values && values.length ? values.join(', ') : '-';
              var cellSum = sumCellBerths(text);
              rowTotal += cellSum;
              colTotals[colIdx] += cellSum;
              return text;
          });
          grandTotal += rowTotal;
          return [fromStation].concat(cells).concat([String(rowTotal)]);
      });
      bodyRows.push(['Total'].concat(colTotals.map(String)).concat([String(grandTotal)]));
      return bodyRows;
  }

  function formatPdfCreatedDate(date) {
    var d = date || new Date();
    var day = ('0' + d.getDate()).slice(-2);
    var month = ('0' + (d.getMonth() + 1)).slice(-2);
    var year = d.getFullYear();
    return day + '-' + month + '-' + year;
  }

  /** Convert yyyy-mm-dd (or Date) to dd-mm-yyyy for PDF headers. */
  function formatPdfDateDdMmYyyy(value) {
    if (!value || value === '-') {
      return '-';
    }
    if (value instanceof Date && !isNaN(value.getTime())) {
      return formatPdfCreatedDate(value);
    }
    var s = String(value).trim();
    var m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (m) {
      return m[3] + '-' + m[2] + '-' + m[1];
    }
    m = s.match(/^(\d{2})-(\d{2})-(\d{4})$/);
    if (m) {
      return s;
    }
    return s;
  }

  function getOptimizedProfileDetailsForPdf() {
    var selectedRemotes = getVisibleRemoteCodes().join(', ') || '-';
    var trainNo = (SELECTED_TRAIN && (SELECTED_TRAIN.TRAIN_NO || SELECTED_TRAIN.TRAIN_NUMBER || SELECTED_TRAIN.train_number)) || '-';
    var fromDate = formatPdfDateDdMmYyyy($('#optFromDate').val() || '-');
    var toDate = formatPdfDateDdMmYyyy($('#optToDate').val() || '-');
    var profileDate = formatPdfDateDdMmYyyy((SELECTED_TRAIN && SELECTED_TRAIN.PROFILE_DATE) || '-');
    var endToEnd = getOptimizationEndToEndSelection();
    var proposedDate = fromDate;
    if (toDate && toDate !== '-' && toDate !== fromDate) {
      proposedDate = fromDate + ' to ' + toDate;
    }
    return {
      selectedRemotes: selectedRemotes,
      trainType: endToEnd.flag === 'Y' ? 'End to End' : 'Non End to End',
      endToEndFrom: endToEnd.fromStation || '-',
      endToEndTo: endToEnd.toStation || '-',
      trainNo: trainNo,
      proposedDate: proposedDate,
      profileDate: profileDate,
      createdDate: formatPdfCreatedDate(new Date()),
      classCapacity: getClassCapacityForPdf()
    };
  }
  function addOptimizedPdfHeader(doc, details) {
      doc.setFillColor(27, 79, 216);
      doc.rect(0, 0, 297, 25, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(18);
      doc.setFont(undefined, 'bold');
      doc.text('Train Quota Profile Optimization Utility', 14, 16);
      doc.setTextColor(38, 56, 92);
      doc.setFontSize(10);
      doc.setFont(undefined, 'normal');
      var y = 35;
      var gap = 8;
      var valueX = 62;
      doc.setFont(undefined, 'bold');
      doc.text('Train Number', 14, y);
      doc.setFont(undefined, 'normal');
      doc.text(': ' + details.trainNo, valueX, y);
      y += gap;
      doc.setFont(undefined, 'bold');
      doc.text('Proposed Date', 14, y);
      doc.setFont(undefined, 'normal');
      doc.text(': ' + details.proposedDate, valueX, y);
      y += gap;
      doc.setFont(undefined, 'bold');
      doc.text('Profile Creation Date', 14, y);
      doc.setFont(undefined, 'normal');
      doc.text(': ' + (details.createdDate || formatPdfCreatedDate(new Date())), valueX, y);
      y += gap;
      doc.setFont(undefined, 'bold');
      doc.text('Selected Remotes', 14, y);
      doc.setFont(undefined, 'normal');
      doc.text(': ' + details.selectedRemotes, valueX, y);
      y += gap;

      // Compact single-line End-to-End summary (no large fixed gaps)
      var x = 14;
      var sep = 10;
      doc.setFont(undefined, 'bold');
      doc.text('End to End Type', x, y);
      x += doc.getTextWidth('End to End Type') + 2;
      doc.setFont(undefined, 'normal');
      var typeText = ': ' + (details.trainType || '-');
      doc.text(typeText, x, y);
      x += doc.getTextWidth(typeText) + sep;

      doc.setFont(undefined, 'bold');
      doc.text('From Station', x, y);
      x += doc.getTextWidth('From Station') + 2;
      doc.setFont(undefined, 'normal');
      var fromText = ': ' + (details.endToEndFrom || '-');
      doc.text(fromText, x, y);
      x += doc.getTextWidth(fromText) + sep;

      doc.setFont(undefined, 'bold');
      doc.text('To Station', x, y);
      x += doc.getTextWidth('To Station') + 2;
      doc.setFont(undefined, 'normal');
      doc.text(': ' + (details.endToEndTo || '-'), x, y);

      y += gap;

      // Train Seat Capacity (class-wise) from edited_coaches / API capacity
      var capacity = details.classCapacity || {};
      var capacityClasses = Object.keys(capacity).sort().filter(function (cls) {
        return optNum(capacity[cls]) > 0;
      });
      if (capacityClasses.length) {
        doc.setFont(undefined, 'bold');
        doc.text('Train Seat Capacity', 14, y);
        y += 6;
        var capX = 14;
        capacityClasses.forEach(function (cls) {
          var valuePart = ': ' + optNum(capacity[cls]);
          var totalW = doc.getTextWidth(cls) + 1 + doc.getTextWidth(valuePart) + 10;
          if (capX + totalW > 283) {
            y += 5;
            capX = 14;
          }
          doc.setFont(undefined, 'bold');
          doc.text(cls, capX, y);
          capX += doc.getTextWidth(cls) + 1;
          doc.setFont(undefined, 'normal');
          doc.text(valuePart, capX, y);
          capX += doc.getTextWidth(valuePart) + 10;
        });
        y += gap;
      }
      return y;
  }
  function downloadOptimizedProfilePdf() {
    try {
    var jsPdfCtor = window.jspdf && window.jspdf.jsPDF;
    if (!jsPdfCtor) {
      alert('PDF download library is not available. Please refresh the page and try again.');
      return;
    }
    var matricesByClass = groupProposedAllocationMatricesByClass();
    var classes = Object.keys(matricesByClass).sort();
    if (!classes.length) {
      alert('No proposed allocation matrix data available to download.');
      return;
    }
    var doc = new jsPdfCtor({ orientation: 'landscape', unit: 'mm', format: 'a4' });
    if (typeof doc.autoTable !== 'function') {
      alert('PDF table library is not available. Please refresh the page and try again.');
      return;
    }
    var details = getOptimizedProfileDetailsForPdf();
    var y = addOptimizedPdfHeader(doc, details);
    y = Math.max(y + 4, 88);
    classes.forEach(function (cls, idx) {
      var matrix = matricesByClass[cls];
      var stations = getOptimizationMatrixStations(matrix.rows).filter(function(stn) {
          return matrix.rows.some(function(r) {
              return r.from === stn || r.to === stn;
          });
      });
//      var seen = {};
//      var stations = [];
//
//      matrix.rows.forEach(function(r) {
//          if (r.berths > 0) {
//
//              if (!seen[r.from]) {
//                  seen[r.from] = true;
//                  stations.push(r.from);
//              }
//
//              if (!seen[r.to]) {
//                  seen[r.to] = true;
//                  stations.push(r.to);
//              }
//          }
//      });
//      var routeOrder = getRouteStationOrder() || {};
//
//      stations.sort(function(a, b) {
//          return (routeOrder[a] || 9999) - (routeOrder[b] || 9999);
//      });
     // var stations = getOptimizationMatrixStations(matrix.rows);
//      if (idx > 0 && y > 145) {
//        doc.addPage();
//        addOptimizedPdfHeader(doc, details);
//        y = 55;
//      }
      if (idx > 0 && y > 145) {
          doc.addPage();
          doc.setFillColor(27, 79, 216);
          doc.rect(0, 0, 297, 25, 'F');
          doc.setTextColor(255, 255, 255);
          doc.setFontSize(18);
          doc.setFont(undefined, 'bold');
          doc.text('Train Quota Profile Optimization Utility', 14, 16);
          y = 30;
      }
      doc.setTextColor(27, 79, 216);
      doc.setFontSize(12);
      doc.setFont(undefined, 'bold');
      doc.text('Class ' + cls + ' - Proposed allocation matrix', 14, y);
      doc.autoTable({
        startY: y + 4,
        head: [['Station'].concat(stations).concat(['Total'])],
        body: buildProposedAllocationStationMatrixRows(matrix),
        theme: 'grid',
        pageBreak: 'auto',
        styles: { fontSize: 8, cellPadding: 2, overflow: 'linebreak', halign: 'center', valign: 'middle' },
        headStyles: { fillColor: [27, 79, 216], textColor: [255, 255, 255], fontStyle: 'bold' },
        bodyStyles: { fillColor: [239, 246, 255], textColor: [31, 47, 77], fontStyle: 'bold' },
        alternateRowStyles: { fillColor: [232, 246, 238] },
        margin: { left: 14, right: 14 }
      });
      y = doc.lastAutoTable.finalY + 14;
    });
    var fileName = 'optimized-train-profile-' + String(details.trainNo).replace(/[^a-z0-9_-]+/gi, '-')
      + '-' + String(details.profileDate).replace(/[^a-z0-9_-]+/gi, '-') + '.pdf';
    doc.save(fileName);
    } catch (e) {
      console.error(e);
      alert('Failed to generate optimized profile PDF. Please try again.');
    }
  }
  window.downloadOptimizedProfilePdf = downloadOptimizedProfilePdf;
 
	  function downloadOptimizedMatrixPdf() {
		  try {
		    var jsPdfCtor = window.jspdf && window.jspdf.jsPDF;

		    if (!jsPdfCtor) {
		      alert('PDF download library is not available. Please refresh the page and try again.');
		      return;
		    }

		    var doc = new jsPdfCtor({
		      orientation: 'landscape',
		      unit: 'mm',
		      format: 'a4'
		    });

		    if (typeof doc.autoTable !== 'function') {
		      alert('PDF table library is not available. Please refresh the page and try again.');
		      return;
		    }

		    var details = getOptimizedProfileDetailsForPdf();

		    var existingMatricesByClass = groupExistingAllocationMatricesByClass();
		    var proposedMatricesByClass = groupProposedAllocationMatricesByClass();

		    var classMap = {};

		    Object.keys(existingMatricesByClass).forEach(function (cls) {
		      classMap[cls] = true;
		    });

		    Object.keys(proposedMatricesByClass).forEach(function (cls) {
		      classMap[cls] = true;
		    });

		    var classes = Object.keys(classMap).sort();

		    if (!classes.length) {
		      alert('No allocation matrix data available to download.');
		      return;
		    }

		    var y = Math.max(addOptimizedPdfHeader(doc, details) + 4, 88);

		    classes.forEach(function (cls, idx) {

		      var matrices = [
		        {
		          label: 'Existing allocation matrix',
		          matrix: existingMatricesByClass[cls],
		          color: [100, 116, 139],
		          fill: [241, 245, 249]
		        },
		        {
		          label: 'Proposed allocation matrix',
		          matrix: proposedMatricesByClass[cls],
		          color: [27, 79, 216],
		          fill: [239, 246, 255]
		        }
		      ];

		      matrices.forEach(function (version, versionIdx) {

		        var matrix = version.matrix;

		        if (!matrix || !matrix.rows || !matrix.rows.length) {
		          return;
		        }

		        var stations = getOptimizationMatrixStations(matrix.rows).filter(function (stn) {
		          return matrix.rows.some(function (r) {
		            return r.from === stn || r.to === stn;
		          });
		        });

		        if ((idx > 0 || versionIdx > 0) && y > 145) {

		          doc.addPage();

		          doc.setFillColor(27, 79, 216);
		          doc.rect(0, 0, 297, 25, 'F');

		          doc.setTextColor(255, 255, 255);
		          doc.setFontSize(18);
		          doc.setFont(undefined, 'bold');

		          doc.text(
		            'Train Quota Profile Optimization Utility',
		            14,
		            16
		          );

		          y = 30;
		        }

		        doc.setTextColor(
		          version.color[0],
		          version.color[1],
		          version.color[2]
		        );

		        doc.setFontSize(12);
		        doc.setFont(undefined, 'bold');

		        doc.text(
		          'Class ' + cls + ' - ' + version.label,
		          14,
		          y
		        );

		        doc.autoTable({
		          startY: y + 4,

		          head: [
		            ['Station'].concat(stations).concat(['Total'])
		          ],

		          body: buildProposedAllocationStationMatrixRows(matrix),

		          theme: 'grid',

		          pageBreak: 'auto',

		          styles: {
		            fontSize: 8,
		            cellPadding: 2,
		            overflow: 'linebreak',
		            halign: 'center',
		            valign: 'middle'
		          },

		          headStyles: {
		            fillColor: version.color,
		            textColor: [255, 255, 255],
		            fontStyle: 'bold'
		          },

		          bodyStyles: {
		            fillColor: version.fill,
		            textColor: [31, 47, 77],
		            fontStyle: 'bold'
		          },

		          alternateRowStyles: {
		            fillColor: [232, 246, 238]
		          },

		          margin: {
		            left: 14,
		            right: 14
		          }
		        });

		        y = doc.lastAutoTable.finalY + 14;
		      });
		    });

		    var hasUtilMetrics =
		      OPT_STATE.currentUtil &&
		      OPT_STATE.currentUtil.length &&
		      OPT_STATE.optimizedUtil &&
		      OPT_STATE.optimizedUtil.length;

		    if (hasUtilMetrics) {

		      doc.addPage();

		      doc.setFillColor(27, 79, 216);
		      doc.rect(0, 0, 297, 25, 'F');

		      doc.setTextColor(255, 255, 255);
		      doc.setFontSize(18);
		      doc.setFont(undefined, 'bold');

		      doc.text(
		        'Train Quota Profile Optimization Utility',
		        14,
		        16
		      );

		      var metricY = 40;

		      var curM = optSumMetrics(OPT_STATE.currentUtil);
		      var optM = optSumMetrics(OPT_STATE.optimizedUtil);

		      var curUtilPct =
		        curM.tKm > 0
		          ? (curM.sKm / curM.tKm) * 100
		          : 0;

		      var optUtilPct =
		        optM.tKm > 0
		          ? (optM.sKm / optM.tKm) * 100
		          : 0;

		      var metricRows = [

		        {
		          label: 'Total berths',
		          curVal: optFmtNum(curM.cap),
		          propVal: optFmtNum(optM.cap),
		          delta: optM.cap - curM.cap,
		          isPct: false,
		          invert: false
		        },

		        {
		          label: 'Utilized berths',
		          curVal: optFmtNum(curM.served),
		          propVal: optFmtNum(optM.served),
		          delta: optM.served - curM.served,
		          isPct: false,
		          invert: false
		        },

		        {
		          label: 'KM utilization %',
		          curVal: curUtilPct.toFixed(2) + '%',
		          propVal: optUtilPct.toFixed(2) + '%',
		          delta: optUtilPct - curUtilPct,
		          isPct: true,
		          invert: false
		        },

		        {
		          label: 'Unserved demand',
		          curVal: optFmtNum(curM.unserved),
		          propVal: optFmtNum(optM.unserved),
		          delta: optM.unserved - curM.unserved,
		          isPct: false,
		          invert: true
		        },

		        {
		          label: 'Revenue earned',
		          curVal: optFmtCurrency(curM.rev),
		          propVal: optFmtCurrency(optM.rev),
		          delta: Math.round(optM.rev - curM.rev),
		          isPct: false,
		          invert: false
		        }

		      ];

		      function optFmtCurrency(value) {
		        if (value == null || isNaN(value)) {
		          return '0';
		        }

		        return Math.round(Number(value)).toLocaleString('en-IN');
		      }

		      var fmtDelta = function (n, isPct) {

		        var sign = n > 0 ? '+' : '';

		        return isPct
		          ? sign + (Math.round(n * 100) / 100).toFixed(2) + '%'
		          : sign + optFmtNum(n);

		      };

		      doc.setTextColor(38, 56, 92);
		      doc.setFontSize(12);
		      doc.setFont(undefined, 'bold');

		      doc.text(
		        'Utilization Metrics',
		        14,
		        metricY
		      );

		      doc.autoTable({

		        startY: metricY + 4,

		        head: [[
		          'Metric',
		          'Current Profile (Average per day)',
		          'Delta',
		          'Proposed Profile (Average per day)'
		        ]],

		        body: metricRows.map(function (r) {
		          return [
		            r.label,
		            r.curVal,
		            fmtDelta(r.delta, r.isPct),
		            r.propVal
		          ];
		        }),

		        theme: 'grid',

		        styles: {
		          fontSize: 9,
		          cellPadding: 3,
		          halign: 'center',
		          valign: 'middle'
		        },

		        headStyles: {
		          fillColor: [27, 79, 216],
		          textColor: [255, 255, 255],
		          fontStyle: 'bold'
		        },

		        bodyStyles: {
		          textColor: [31, 47, 77]
		        },

		        columnStyles: {
		          0: {
		            halign: 'left',
		            fontStyle: 'bold'
		          },

		          3: {
		            fillColor: [239, 246, 255],
		            fontStyle: 'bold'
		          }
		        },

		        didParseCell: function (data) {

		          if (
		            data.section === 'body' &&
		            data.column.index === 2
		          ) {

		            var r = metricRows[data.row.index];
		            var n = r.delta;

		            var isGood = r.invert ? n < 0 : n > 0;
		            var isBad = r.invert ? n > 0 : n < 0;

		            data.cell.styles.fontStyle = 'bold';

		            data.cell.styles.textColor =
		              n === 0
		                ? [107, 107, 102]
		                : (
		                    isGood
		                      ? [10, 124, 78]
		                      : (
		                          isBad
		                            ? [229, 115, 115]
		                            : [107, 107, 102]
		                        )
		                  );
		          }
		        },

		        margin: {
		          left: 14,
		          right: 14
		        }

		      });

		      /* ================================
		         NOTES AFTER UTILIZATION TABLE
		         ================================ */

		      var notesY = doc.lastAutoTable.finalY + 10;

		      doc.setTextColor(38, 56, 92);
		      doc.setFontSize(9);
		      doc.setFont(undefined, 'bold');

		      doc.text(
		        'Note :-',
		        14,
		        notesY
		      );

		      doc.setFont(undefined, 'normal');

		      doc.text(
		        '1. The figures in utilization metrics are as per expected predicted demand.',
		        18,
		        notesY + 6
		      );

		      doc.text(
		        '2. The performance is based on the booking time pattern of the train.',
		        18,
		        notesY + 12
		      );
		    }

		    var fileName =
		      'optimized-train-profile- Comapritive Optimization and Utilization Metrics ' +
		      String(details.trainNo).replace(/[^a-z0-9_-]+/gi, '-') +
		      '-' +
		      String(details.profileDate).replace(/[^a-z0-9_-]+/gi, '-') +
		      '.pdf';

		    doc.save(fileName);

		  } catch (e) {

		    console.error(e);

		    alert(
		      'Failed to generate optimized profile PDF. Please try again.'
		    );
		  }
		}

		window.downloadOptimizedMatrixPdf = downloadOptimizedMatrixPdf;
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
    +  '<div class="opt-berth-diff-actions">'
    + '<label class="opt-berth-diff-toggle"><input type="checkbox" id="optBerthDiffChangesOnly"' + (changesOnly ? ' checked' : '') + '> Changes only</label>'
    + '</div>'
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
    + '<i class="fa fa-bar-chart"></i> KM utilization % by quota <i class="fa fa-chevron-down opt-metrics-chevron"></i>'
    + '</button>'

    + '</div>'
    + '<div id="optUtilMetricsPanel" class="opt-util-metrics-panel" style="display:none;">'
    + '<div id="optUtilMetricsCollapse"></div>'
    + '</div>'
    + '<div id="optQuotaChartPanel" class="opt-chart-compact" style="display:none;">'
    + '<div class="utilization-chart-title">KM utilization % by quota \u2014 current vs proposed</div>'
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
function buildAllocCard(r, cls, stations, quotas, disabled, allRows) {
  var rowId = r._rowId != null ? r._rowId : OPT_STATE.nextRowId++;
  r._rowId = rowId;
  var isNew = !!r.isNew;
  var removed = !!r.removed;
  var modified = !isNew && !removed && isRowModified(r);
  var comparisonStatus = r.comparisonApplied ? r.comparisonStatus : '';
  var qColor = optQuotaColor(r.QUOTA || (isNew ? '' : '-'));
  var changeLabel = getAllocationChangeLabel(r);
  var stateCls = removed ? ' opt-alloc-removed'
    : ((isNew || comparisonStatus === 'added') ? ' opt-alloc-new'
      : ((modified || comparisonStatus === 'modified') ? ' opt-alloc-modified' : ''));
  var cardDisabled = removed ? ' disabled' : disabled;
  var badge = removed
    ? '<span class="opt-alloc-badge" data-change-type="removed">'
      + optEsc((r.comparisonApplied && r.comparisonLabel) ? r.comparisonLabel : removedBerthLabel(r)) + '</span>'
    : ((isNew || comparisonStatus || (modified && changeLabel))
      ? '<span class="opt-alloc-badge" data-change-type="' + (comparisonStatus || (isNew ? 'new' : 'modified')) + '">'
        + optEsc(r.comparisonLabel || changeLabel || (isNew ? 'New' : 'Modified')) + '</span>'
      : '<span class="opt-alloc-badge" style="display:none;"></span>');
  var quotaLabel = r.QUOTA ? optEsc(r.QUOTA) : 'Quota';
  var quotaPillTitle = r.QUOTA ? quotaTitleAttr(r.QUOTA) : '';
  // Badge carries Modified / Removed / Added — no Original → Modified footer line.
  var diffHtml = '';
  if (!r.comparisonApplied && modified && r.origSnapshot) {
    diffHtml = '<span class="opt-alloc-diff">Was: <strong>' + optNum(r.origSnapshot.BERTHS) + '</strong></span>';
  }
  var availableQuotas = removed ? quotas : getAvailableQuotasForRow(r, quotas, allRows || OPT_STATE.editedRows);
  return '<div class="opt-alloc-card' + stateCls + '" data-row-id="' + rowId + '" data-class="' + optEsc(cls) + '" data-is-new="' + (isNew ? '1' : '0') + '" data-removed="' + (removed ? '1' : '0') + '" data-quota="' + optEsc(r.QUOTA || '') + '" data-from="' + optEsc(r.FROM || '') + '" data-to="' + optEsc(r.TO || '') + '" style="--opt-quota-color:' + (removed ? '#94a3b8' : qColor) + ';">'
    + '<div class="opt-alloc-accent"></div>'
    + badge
    + '<div class="opt-alloc-row opt-alloc-row-top">'
    + '<div class="opt-alloc-quota-group">'
    + '<span class="opt-quota-pill"' + quotaPillTitle + '>' + quotaLabel + '</span>'
    + '<select class="opt-edit-select opt-edit-quota opt-edit-quota-select"' + cardDisabled + quotaPillTitle + '>' + optQuotaSelectOptions(availableQuotas, r.QUOTA, 'Quota') + '</select>'
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
      ? '<button type="button" class="btn btn-link opt-dismiss-row" title="Dismiss removed allocation"' + disabled + '><i class="fa fa-times"></i></button>'
      : '<button type="button" class="btn btn-link opt-del-row"' + disabled + '><i class="fa fa-trash"></i> Remove</button>')
    + '</div>'
    + '</div>';
}

function getFocusedQuotas() {
  return Array.isArray(OPT_STATE.focusedQuotas) ? OPT_STATE.focusedQuotas : [];
}

function getRouteFocus() {
  var rf = OPT_STATE.routeFocus || {};
  return {
    from: String(rf.from || '').trim(),
    to: String(rf.to || '').trim()
  };
}

function hasRouteFocus() {
  var rf = getRouteFocus();
  return !!(rf.from || rf.to);
}

/** Match allocation From/To against route highlight (both, From-only, or To-only). Exact match only. */
function allocationMatchesRouteFocus(allocFrom, allocTo, routeFocus) {
  routeFocus = routeFocus || getRouteFocus();
  var rfFrom = String((routeFocus && routeFocus.from) || '').trim();
  var rfTo = String((routeFocus && routeFocus.to) || '').trim();
  if (!rfFrom && !rfTo) {
    return true;
  }
  allocFrom = String(allocFrom || '').trim();
  allocTo = String(allocTo || '').trim();
  if (rfFrom && rfTo) {
    return allocFrom === rfFrom && allocTo === rfTo;
  }
  if (rfFrom) {
    return allocFrom === rfFrom;
  }
  return allocTo === rfTo;
}

function hasAllocationFocus() {
  return getFocusedQuotas().length > 0 || hasRouteFocus();
}

function cardMatchesAllocationFocus($card, focusedQuotas, routeFocus) {
  var quotaOk = !focusedQuotas.length || focusedQuotas.indexOf(String($card.attr('data-quota') || '')) !== -1;
  var routeOk = allocationMatchesRouteFocus($card.attr('data-from'), $card.attr('data-to'), routeFocus);
  return quotaOk && routeOk;
}

function buildQuotaFocusSummaryText(focused, matchCount) {
  focused = focused || [];
  matchCount = optNum(matchCount);
  if (!focused.length) {
    return '';
  }
  if (focused.length === 1) {
    return 'Showing ' + matchCount + ' ' + focused[0] + ' allocation' + (matchCount === 1 ? '' : 's');
  }
  return 'Showing ' + matchCount + ' allocations across ' + focused.length + ' quotas';
}

function buildRouteFocusSummaryText(routeFocus, matchCount) {
  if (!routeFocus || (!routeFocus.from && !routeFocus.to)) {
    return '';
  }
  var label;
  if (routeFocus.from && routeFocus.to) {
    label = routeFocus.from + ' \u2192 ' + routeFocus.to;
  } else if (routeFocus.from) {
    label = routeFocus.from + ' \u2192 \u2026';
  } else {
    label = '\u2026 \u2192 ' + routeFocus.to;
  }
  return 'Showing ' + optNum(matchCount) + ' ' + label
    + ' allocation' + (optNum(matchCount) === 1 ? '' : 's');
}

function buildCombinedFocusSummaryText(focused, routeFocus, matchCount) {
  var parts = [];
  var quotaText = buildQuotaFocusSummaryText(focused, matchCount);
  var routeText = buildRouteFocusSummaryText(routeFocus, matchCount);
  if (focused.length && (routeFocus.from || routeFocus.to)) {
    var routeLabel = routeFocus.from && routeFocus.to
      ? (routeFocus.from + ' \u2192 ' + routeFocus.to)
      : (routeFocus.from ? (routeFocus.from + ' \u2192 \u2026') : ('\u2026 \u2192 ' + routeFocus.to));
    return 'Showing ' + optNum(matchCount) + ' allocation' + (optNum(matchCount) === 1 ? '' : 's')
      + ' · ' + focused.join(', ') + ' · ' + routeLabel;
  }
  if (quotaText) {
    parts.push(quotaText);
  }
  if (routeText) {
    parts.push(routeText);
  }
  return parts.join(' · ');
}

function countQuotaFocusMatches(rows, focused) {
  focused = focused || [];
  if (!focused.length) {
    return 0;
  }
  var count = 0;
  (rows || []).forEach(function (r) {
    if (focused.indexOf(String(r.QUOTA || '')) !== -1) {
      count += 1;
    }
  });
  return count;
}

function expandPanelsForQuotaFocus($wrap, classMap) {
  Object.keys(classMap || {}).forEach(function (cls) {
    OPT_STATE.expandedClasses = OPT_STATE.expandedClasses || {};
    OPT_STATE.expandedClasses[cls] = true;
    var $panel = $wrap.find('.opt-berth-cls-panel').filter(function () {
      return $(this).attr('data-class') === cls;
    });
    if (!$panel.length) {
      return;
    }
    $panel.find('.opt-berth-cls-body').show();
    $panel.find('.opt-berth-chevron').addClass('open');
  });
}

/**
 * Combined Quota + Route Focus Mode.
 * Dim non-matching cards; highlight matches. Both filters AND together when both active.
 */
function applyQuotaFocusMode(opts) {
  opts = opts || {};
  var $wrap = $('#optBerthTableWrap');
  if (!$wrap.length) {
    return;
  }

  var focused = getFocusedQuotas();
  var routeFocus = getRouteFocus();
  var active = focused.length > 0 || hasRouteFocus();
  var $legend = $wrap.find('.opt-quota-legend');
  var $summary = $wrap.find('#optQuotaFocusSummary');
  var $reset = $wrap.find('#optQuotaFocusReset');
  var $routeReset = $wrap.find('#optRouteFocusReset');
  var $routeSummary = $wrap.find('#optRouteFocusSummary');
  var $routeFrom = $wrap.find('#optRouteFocusFrom');
  var $routeTo = $wrap.find('#optRouteFocusTo');

  $legend.find('.opt-quota-legend-item').each(function () {
    var q = String($(this).attr('data-quota') || '');
    $(this).toggleClass('is-selected', focused.indexOf(q) !== -1)
      .attr('aria-pressed', focused.indexOf(q) !== -1 ? 'true' : 'false');
  });

  if ($routeFrom.length) {
    $routeFrom.val(routeFocus.from || '');
  }
  if ($routeTo.length) {
    $routeTo.val(routeFocus.to || '');
  }

  if (!active) {
    $wrap.removeClass('opt-quota-focus-active');
    $legend.removeClass('is-focusing');
    $wrap.find('.opt-alloc-card').removeClass('opt-quota-match opt-quota-dim');
    $summary.hide().text('');
    $reset.hide();
    $routeSummary.hide().text('');
    $routeReset.hide();
    $wrap.find('.opt-route-focus').removeClass('is-active');
    return;
  }

  $wrap.addClass('opt-quota-focus-active');
  $legend.toggleClass('is-focusing', focused.length > 0);
  $wrap.find('.opt-route-focus').toggleClass('is-active', hasRouteFocus());
  $reset.toggle(focused.length > 0);
  $routeReset.toggle(hasRouteFocus());

  var matchCount = 0;
  var $firstMatch = null;
  var classesToExpand = {};

  $wrap.find('.opt-alloc-card').each(function () {
    var $card = $(this);
    var match = cardMatchesAllocationFocus($card, focused, routeFocus);
    $card.toggleClass('opt-quota-match', match);
    $card.toggleClass('opt-quota-dim', !match);
    if (match) {
      matchCount += 1;
      if (!$firstMatch) {
        $firstMatch = $card;
      }
      var cls = String($card.attr('data-class') || '');
      if (cls) {
        classesToExpand[cls] = true;
      }
    }
  });

  expandPanelsForQuotaFocus($wrap, classesToExpand);
  var summaryText = buildCombinedFocusSummaryText(focused, routeFocus, matchCount);
  $summary.text(summaryText).toggle(!!summaryText);
  $routeSummary.text(
    hasRouteFocus()
      ? buildRouteFocusSummaryText(routeFocus, matchCount)
      : ''
  ).toggle(hasRouteFocus());

  if (opts.scroll && $firstMatch && $firstMatch.length) {
    var top = $firstMatch.offset().top - 90;
    $('html, body').stop(true).animate({ scrollTop: Math.max(0, top) }, 280);
  }
}

function toggleQuotaFocus(quota) {
  quota = String(quota || '').trim();
  if (!quota) {
    return;
  }
  var list = getFocusedQuotas().slice();
  var idx = list.indexOf(quota);
  var selecting = idx === -1;
  if (selecting) {
    list.push(quota);
  } else {
    list.splice(idx, 1);
  }
  OPT_STATE.focusedQuotas = list;
  applyQuotaFocusMode({ scroll: selecting || hasRouteFocus() });
}

function clearQuotaFocus() {
  OPT_STATE.focusedQuotas = [];
  applyQuotaFocusMode({ scroll: false });
}

function setRouteFocus(from, to, opts) {
  OPT_STATE.routeFocus = {
    from: String(from || '').trim(),
    to: String(to || '').trim()
  };
  applyQuotaFocusMode({ scroll: !!(opts && opts.scroll && hasRouteFocus()) });
}

function clearRouteFocus() {
  OPT_STATE.routeFocus = { from: '', to: '' };
  applyQuotaFocusMode({ scroll: false });
}

function buildOptRouteFocusFilter() {
  var stations = getOptStationOptions();
  var rf = getRouteFocus();
  var active = hasRouteFocus();
  return '<div class="opt-route-focus' + (active ? ' is-active' : '') + '">'
    + '<div class="opt-route-focus-label"><i class="fa fa-exchange"></i> Route highlight</div>'
    + '<select id="optRouteFocusFrom" class="form-control opt-route-focus-select" title="From station">'
    + optSelectOptions(stations, rf.from, 'From', true)
    + '</select>'
    + '<span class="opt-alloc-arrow">&#8594;</span>'
    + '<select id="optRouteFocusTo" class="form-control opt-route-focus-select" title="To station">'
    + optSelectOptions(stations, rf.to, 'To', true)
    + '</select>'
    + '<span id="optRouteFocusSummary" class="opt-quota-focus-summary"'
    + (active ? '' : ' style="display:none;"') + '></span>'
    + '<button type="button" id="optRouteFocusReset" class="opt-quota-focus-reset"'
    + (active ? '' : ' style="display:none;"') + ' title="Clear route highlight">'
    + '<i class="fa fa-times"></i> Clear Route</button>'
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
    return buildOptRouteFocusFilter();
  }

  var focused = getFocusedQuotas().filter(function (q) {
    return items.indexOf(q) !== -1;
  });
  OPT_STATE.focusedQuotas = focused;

  var routeFocus = getRouteFocus();
  var matchCount = 0;
  (rows || []).forEach(function (r) {
    var quotaOk = !focused.length || focused.indexOf(String(r.QUOTA || '')) !== -1;
    var routeOk = allocationMatchesRouteFocus(r.FROM, r.TO, routeFocus);
    if (quotaOk && routeOk && (focused.length || hasRouteFocus())) {
      matchCount += 1;
    }
  });
  var hasFocus = focused.length > 0;
  var summaryText = buildCombinedFocusSummaryText(focused, routeFocus, matchCount);

  var legendItems = items.map(function (q) {
    var color = optQuotaColor(q);
    var selected = focused.indexOf(q) !== -1;
    var fullName = (typeof getQuotaFullName === 'function') ? (getQuotaFullName(q) || q) : q;
    var tip = fullName + ' — click to focus';
    return '<button type="button" class="opt-quota-legend-item' + (selected ? ' is-selected' : '') + '"'
      + ' data-quota="' + optEsc(q) + '"'
      + ' style="--opt-quota-color:' + color + ';"'
      + ' aria-pressed="' + (selected ? 'true' : 'false') + '"'
      + ' title="' + optEsc(tip) + '">'
      + '<span class="opt-quota-legend-dot"></span>'
      + '<span class="opt-quota-legend-label">' + optEsc(q) + '</span>'
      + '</button>';
  }).join('');

  return '<div class="opt-quota-legend' + (hasFocus ? ' is-focusing' : '') + '">'
    + '<div class="opt-quota-legend-row">'
    + '<div class="opt-quota-legend-items">' + legendItems + '</div>'
    + '<div class="opt-quota-legend-actions">'
    + '<span id="optQuotaFocusSummary" class="opt-quota-focus-summary"'
    + (hasFocus || hasRouteFocus() ? '' : ' style="display:none;"') + '>' + optEsc(summaryText) + '</span>'
    + '<button type="button" id="optQuotaFocusReset" class="opt-quota-focus-reset"'
    + (hasFocus ? '' : ' style="display:none;"') + ' title="Clear quota focus">'
    + '<i class="fa fa-eye"></i> Show All</button>'
    + '</div></div>'
    + buildOptRouteFocusFilter()
    + '</div>';
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
      return buildAllocCard(r, cls, stations, quotas, disabled, rows);
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
  // KM utilization = sum(SERVED_BERTH_KM) / sum(TOTAL_BERTH_KM) * 100 per utilization matrix.
  var curUtil = cur.tKm > 0 ? (cur.sKm / cur.tKm) * 100 : 0;
  var optUtil = opt.tKm > 0 ? (opt.sKm / opt.tKm) * 100 : 0;

  return '<div class="opt-compare-card opt-compare-card-inline"><div class="opt-cmp-grid">'
    + optCmpCol('current', 'Current profile (Average per day)', [
      ['Total berths', optFmtNum(cur.cap)],
      ['Utilized berths', optFmtNum(cur.served)],
      ['KM utilization %', curUtil.toFixed(2) + '%'],
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
    + optCmpCol('proposed', 'Proposed profile (Average per day)', [
      ['Total berths', optFmtNum(opt.cap)],
      ['Utilized berths', optFmtNum(opt.served)],
      ['KM utilization %', optUtil.toFixed(2) + '%'],
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
              title: function (items) {
                return items && items[0] ? getQuotaFullName(allQuotas[items[0].dataIndex]) : '';
              },
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
function getWebServiceDataTrain(requestData, requestUrl) {

    return new Promise(function(resolve, reject) {

        $.ajax({
            beforeSend: function(request) {
                App.blockUI({
                    target: "#" + blockUi_Id,
                    opacity: .5,
                    animate: !0
                });
            },

            headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json',
                'Authorization': getAuth()
            },

            type: 'POST',

            url: requestUrl,

            dataType: 'json',

            data: JSON.stringify(requestData),

            success: function(response) {

                App.unblockUI("#" + blockUi_Id);
                blockUi_Id = "reportBody";

                // Same behaviour as safeJson()
                resolve(response && response.data ? response.data : response);
            },

            error: function(xhr, status, error) {

                console.error("API Error:", xhr);
                console.error("HTTP Status:", xhr.status);
                console.error("Status:", status);
                console.error("Error:", error);
                console.error("Response Text:", xhr.responseText);

                App.unblockUI("#" + blockUi_Id);
                blockUi_Id = "reportBody";
                reject(new Error(error || status || 'Request failed'));
            }
        });

    });
}
