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
}
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
	    reoptDelta
	) {

	    var requestData = {
	        params: [
	            num,
	            siteId,
	            profileDate,
	            fromDate,
	            toDate
	        ]
	    };

	    if (reoptDelta &&
	        reoptDelta.edited_berths &&
	        Object.keys(reoptDelta.edited_berths).length) {

	        requestData.edited_berths =
	            reoptDelta.edited_berths;
	    }

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

function captureOptimizeRequestPayload(requestData) {
  try {
    OPT_PROFILE.lastRequestPayload = JSON.parse(JSON.stringify(requestData || {}));
  } catch (e) {
    OPT_PROFILE.lastRequestPayload = requestData || null;
  }
}

function applySavedOptimizePayloadToState(payload, opts) {
  var body = toOptimizeRequestPayload(payload);
  OPT_STATE.persistedEditedBerths = Object.assign({}, body.edited_berths || {});
  OPT_STATE.persistedRemoteAdded = ensureUniqueCodes(body.remote_added || []);
  OPT_STATE.persistedRemoteRemoved = ensureUniqueCodes(body.remote_removed || []);
  restoreRemoteStateFromPersisted();
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
  var requestData = {
    params: Array.isArray(src.params) ? src.params.slice() : [],
    edited_berths: src.edited_berths || {},
    remote_added: src.remote_added || [],
    remote_removed: src.remote_removed || []
  };
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
    persistReoptimizeDelta({
      edited_berths: (OPT_PROFILE.profilePayload && OPT_PROFILE.profilePayload.edited_berths) || {},
      remote_added: (OPT_PROFILE.profilePayload && OPT_PROFILE.profilePayload.remote_added) || [],
      remote_removed: (OPT_PROFILE.profilePayload && OPT_PROFILE.profilePayload.remote_removed) || []
    });
    drawOptimizationProfile(response);
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
  if (getChangeCounts().total > 0) {
    alert('Re-optimize your changes before saving the profile');
    return;
  }

  var trainNo = getTrainNumber(SELECTED_TRAIN);
  var siteId = getSiteId(SELECTED_TRAIN);
  var payload = toOptimizeRequestPayload(OPT_PROFILE.lastRequestPayload, trainNo);
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
    || (OPT_STATE.persistedRemoteAdded || []).length > 0
    || (OPT_STATE.persistedRemoteRemoved || []).length > 0;
}

function buildPersistedOnlyDelta() {
  return {
    edited_berths: Object.assign({}, OPT_STATE.persistedEditedBerths || {}),
    remote_added: ensureUniqueCodes(OPT_STATE.persistedRemoteAdded || []),
    remote_removed: ensureUniqueCodes(OPT_STATE.persistedRemoteRemoved || [])
  };
}

function getOptimizationData(fromDate, toDate){
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
	}
	return apiFetchTrainOptimization(trainNo, siteId, SELECTED_TRAIN.PROFILE_DATE, fromDate, toDate, delta);
}

// Re-optimize uses same POST endpoint with edited_berths in JSON body.
function getReoptimizeData(fromDate, toDate, delta) {
	var trainNo = getTrainNumber(SELECTED_TRAIN);
	var siteId = getSiteId(SELECTED_TRAIN);
	return apiFetchTrainOptimization(trainNo, siteId, SELECTED_TRAIN.PROFILE_DATE, fromDate, toDate, delta);
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
  persistedRemoteAdded: [],
  persistedRemoteRemoved: [],
  // Quota Focus Mode — multi-select legend filters (persists across re-optimize redraws).
  focusedQuotas: [],
  // Route Highlight Filter — From/To pair focus (compatible with quota focus).
  routeFocus: { from: '', to: '' }
};
var OPT_DATES_TOUCHED = { opt: false, util: false };
var OPT_DEFAULT_FROM_OFFSET = 61;
var OPT_DEFAULT_TO_OFFSET = 90;
var OPT_TOP_IMPACT_LIMIT = 10;

var OPT_PROFILE = {
  profileMode: 'CREATE',
  selectedProfileId: '',
  profilePayload: null,
  lastRequestPayload: null,
  savedIdsByKey: {},
  listRequestSeq: 0
};

function logOptimizationRequest(action, reoptDelta, body) {
  if (typeof console === 'undefined' || !console.info) {
    return;
  }
  console.info('[TPO optimize] ' + action, {
    persistedEditedBerths: Object.assign({}, OPT_STATE.persistedEditedBerths || {}),
    persistedRemoteAdded: (OPT_STATE.persistedRemoteAdded || []).slice(),
    persistedRemoteRemoved: (OPT_STATE.persistedRemoteRemoved || []).slice(),
    requestDelta: reoptDelta ? {
      edited_berths: Object.assign({}, (reoptDelta.edited_berths) || {}),
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
  OPT_STATE.persistedRemoteAdded = [];
  OPT_STATE.persistedRemoteRemoved = [];
  OPT_STATE.focusedQuotas = [];
  OPT_STATE.routeFocus = { from: '', to: '' };
  $('#optimizationContent').html('');
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
  // Old keys abandoned by From/To/quota edits — drop from payload; do not send as 0.
  var supersededKeys = [];

  (rows || []).forEach(function (r) {
    if (r.removed && r.origKey) {
      // Explicit Remove still zeroes the original allocation.
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

  var editedBerths = Object.assign({}, OPT_STATE.persistedEditedBerths || {});
  Object.keys(sessionBerths).forEach(function (key) {
    editedBerths[key] = sessionBerths[key];
  });
  // Drop superseded previous keys entirely — never keep/send them as 0 from a route edit.
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
    remote_added: added,
    remote_removed: removed
  };
}

function persistReoptimizeDelta(delta) {
  OPT_STATE.persistedEditedBerths = Object.assign({}, (delta && delta.edited_berths) || {});
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

function getChangeCounts() {
  var rows = OPT_STATE.editedRows;
  var newCount = rows.filter(function (r) { return r.isNew && !r.removed; }).length;
  var modifiedCount = rows.filter(function (r) { return !r.isNew && !r.removed && isRowModified(r); }).length;
  var deletedCount = rows.filter(function (r) { return r.removed; }).length;
  var remoteChanges = getPendingRemoteChangeCount();
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
  return classes.sort();
}

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
    title = 'Re-optimize your changes before saving the profile';
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
  var $saveBtn = $('#optSaveProfileBtn');
  var $saveAsNewBtn = $('#optSaveAsNewProfileBtn');
  var counts = getChangeCounts();
  var hasPendingChanges = counts.total > 0 && OPT_STATE.optimizationLoaded;
  var canSave = OPT_STATE.optimizationLoaded
    && !!OPT_PROFILE.lastRequestPayload
    && !hasPendingChanges
    && !OPT_STATE.reoptimizing;
  var isEdit = OPT_PROFILE.profileMode === 'EDIT';

  if (OPT_STATE.reoptimizing) {
    if ($btn.length) {
      $btn.removeClass('opt-btn-attn').prop('disabled', true)
        .html('<i class="fa fa-spinner fa-spin"></i> Re-Optimizing...')
        .attr('title', 'Re-optimization in progress\u2026');
    }
    $downloadBtn.prop('disabled', true);
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
  restoreSaveProfileButton($saveBtn, canSave, hasPendingChanges,
    '<i class="fa fa-save"></i> Save Profile',
    isEdit ? 'Update the selected profile' : 'Save as a new train profile');
  restoreSaveProfileButton($saveAsNewBtn, canSave && isEdit && !!OPT_PROFILE.selectedProfileId, hasPendingChanges,
    '<i class="fa fa-copy"></i> Save as New Profile',
    'Save the current work as the next profile id');
  $saveAsNewBtn.toggle(isEdit);
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
  applyQuotaFocusMode({ scroll: false });
}

function syncAndRefreshChanges(changedRowId) {
  if (OPT_STATE.syncingAllocations) {
    return;
  }
  OPT_STATE.syncingAllocations = true;
  try {
    syncEditedRowsFromDom();
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

  setOptimizationEditMode(true);

  getReoptimizeData(fromDate, toDate, delta)
    .then(function (response) {
      persistReoptimizeDelta(delta);
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
    + '<div class="col-md-2" style="margin-top:24px;">'
    + '<button type="button" id="showOptimizationBtn" class="btn btn-primary form-control" style="font-weight:600;height:34px;">Show Optimization</button></div>'
    + '</div><div id="optimizationContent"></div>'
  );
  initializeDefaultDatesForOptAndUtil(false);
  if (mode === 'EDIT') {
    refreshOptimizationProfileList();
  }
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
    + '<button type="button" id="optSaveProfileBtn" class="btn btn-primary" style="margin-right:10px;" title="Save the last optimization request as a train profile">'
    + '<i class="fa fa-save"></i> Save Profile'
    + '</button>'
    + '<button type="button" id="optSaveAsNewProfileBtn" class="btn btn-primary" style="margin-right:10px;'
    + (OPT_PROFILE.profileMode === 'EDIT' ? '' : 'display:none;')
    + '" title="Save as the next profile id">'
    + '<i class="fa fa-copy"></i> Save as New Profile'
    + '</button>'
    + '<button type="button" id="optDownloadOptimizedProfilePdfBtn" class="btn btn-primary" style="margin-right:10px;" title="Download optimized train profile PDF">'
    + '<i class="fa fa-download"></i> Download Optimized Train Profile'
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
      return stations.map(function(fromStation) {
          return [fromStation].concat(stations.map(function(toStation) {
              var values = matrix.cells[fromStation + '-' + toStation];
              return values && values.length ? values.join(', ') : '-';
          }));
      });
  }
  function getOptimizedProfileDetailsForPdf() {
    var selectedRemotes = getVisibleRemoteCodes().join(', ') || '-';
    var trainNo = (SELECTED_TRAIN && (SELECTED_TRAIN.TRAIN_NO || SELECTED_TRAIN.TRAIN_NUMBER || SELECTED_TRAIN.train_number)) || '-';
    var fromDate = $('#optFromDate').val() || '-';
    var toDate = $('#optToDate').val() || '-';
    var profileDate = (SELECTED_TRAIN && SELECTED_TRAIN.PROFILE_DATE) || '-';
    return {
      selectedRemotes: selectedRemotes,
      trainNo: trainNo,
      proposedDate: fromDate + (toDate && toDate !== fromDate ? ' to ' + toDate : ''),
      profileDate: profileDate
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
      doc.setFont(undefined, 'bold');
      doc.text('Train Number', 14, y);
      doc.setFont(undefined, 'normal');
      doc.text(': ' + details.trainNo, 55, y);
      y += gap;
      doc.setFont(undefined, 'bold');
      doc.text('Proposed Date', 14, y);
      doc.setFont(undefined, 'normal');
      doc.text(': ' + details.proposedDate, 55, y);
      y += gap;
      doc.setFont(undefined, 'bold');
      doc.text('Profile Date', 14, y);
      doc.setFont(undefined, 'normal');
      doc.text(': ' + details.profileDate, 55, y);
      y += gap;
      doc.setFont(undefined, 'bold');
      doc.text('Selected Remotes', 14, y);
      doc.setFont(undefined, 'normal');
      doc.text(': ' + details.selectedRemotes, 55, y);
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
    addOptimizedPdfHeader(doc, details);
    var y = 72;
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
        head: [['Station'].concat(stations)],
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
  var quotaPillTitle = r.QUOTA ? quotaTitleAttr(r.QUOTA) : '';
  var diffHtml = modified && r.origSnapshot
    ? '<span class="opt-alloc-diff">Was: <strong>' + optNum(r.origSnapshot.BERTHS) + '</strong></span>'
    : '';
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
      ? '<button type="button" class="btn btn-link opt-restore-row"' + disabled + '><i class="fa fa-undo"></i> Restore</button>'
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
