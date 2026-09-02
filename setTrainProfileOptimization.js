function loadTrainProfileUtilizationScript(callback) {
    if (typeof drawUtilizationCharts === 'function') {
        callback();
        return;
    }
    var tag = document.querySelector('script[src*="setTrainProfileOptimization.js"]');
    if (!tag || !tag.src) {
        console.error('Utilization module: base script tag not found');
        callback();
        return;
    }
    var utilSrc = tag.src.replace('setTrainProfileOptimization.js', 'setTrainProfileOptimizationUtilization.js');
    var script = document.createElement('script');
    script.src = utilSrc;
    script.onload = callback;
    script.onerror = function () {
        console.error('Failed to load setTrainProfileOptimizationUtilization.js');
        callback();
    };
    document.head.appendChild(script);
}

$(document).ready(function () {
    loadTrainProfileUtilizationScript(function () {
        if (!$('#optimizationContainer').children().length) {
            buildOptimizationTabShell();
        }
        initializeDefaultDatesForOptAndUtil(false);
        bindUtilizationShowButton();
        bindFetchTrainUtilizationReset();
        bindOptimizationTab();
    });
});

function bindFetchTrainUtilizationReset() {
    $('#fetchTrainBtn').on('click.utilReset', function () {
        if (typeof window.resetUtilizationDashboard === 'function') {
            window.resetUtilizationDashboard();
        }
        if (typeof window.resetOptimizationState === 'function') {
            window.resetOptimizationState();
        }
    });
}

function bindUtilizationShowButton() {
	$('#showUtilizationBtn').on('click', function () {
		
		const fromDate = $('#fromDate').val();
        const toDate = $('#toDate').val();
        if (!fromDate || !toDate || fromDate >= toDate) {
            alert('Please select valid date range');
            return;
        }
	    const $btn = $(this);
	    $btn
	        .prop('disabled', true)
	        .text('Loading Data...');
	    getUtilizationData(fromDate, toDate)
	        .then(function (response) {
	            console.log(response);
	            drawUtilizationCharts(response);
	        })
	        .catch(function (error) {
	            console.error(error);
	            alert('Failed to fetch utilization data');
	        })
	        .finally(function () {
	            $btn
	                .prop('disabled', false)
	                .text('Show Utilization');
	        });
	});
}

function bindOptimizationTab() {
	if (!$('#optimizationContainer').children().length) {
		buildOptimizationTabShell();
	} else {
		initializeDefaultDatesForOptAndUtil(false);
	}

	$('a[data-toggle="tab"][href="#tab3"]').on('shown.bs.tab', function () {
		if (!$('#optimizationContainer').children().length) {
			buildOptimizationTabShell();
		}
		initializeDefaultDatesForOptAndUtil(false);
		if (typeof OPT_PROFILE !== 'undefined' && OPT_PROFILE.profileMode === 'EDIT') {
			refreshOptimizationProfileList();
		}
	});

	$('#optimizationContainer').on('click', '#showOptimizationBtn', function () {
		loadTrainOptimization();
	});
	$('#optimizationContainer').on('change', 'input[name="optProfileMode"]', function () {
		setOptProfileMode($(this).val());
	});
	$('#optimizationContainer').on('change', '#optSavedProfileSelect', function () {
		var profileId = String($(this).val() || '').trim();
		if (profileId) {
			loadSelectedOptimizationProfile(profileId);
		}
	});
}
function formatDate(dateStr) {
    if (!dateStr || typeof dateStr !== 'string') return '-';
    var parts = dateStr.split('-');
    if (parts.length !== 3) {
        return dateStr;
    }
    return parts[2] + '-' + parts[1] + '-' + parts[0];
}
function loadTrainOptimization() {
	if (OPT_PROFILE.profileMode === 'EDIT' && !OPT_PROFILE.selectedProfileId) {
		alert('Please select a saved profile');
		return;
	}
	var fromDate = $('#optFromDate').val();
	var toDate = $('#optToDate').val();
	if (!fromDate || !toDate || fromDate >= toDate) {
		alert('Please select valid date range');
		return;
	}
	if (!SELECTED_TRAIN) {
		alert('Please fetch train profile first');
		return;
	}

	var $btn = $('#showOptimizationBtn');
	$btn.prop('disabled', true).text('Loading Data...');
	$('#optimizationContent').html(
		'<div class="text-center" style="padding:24px;"><i class="fa fa-spinner fa-spin"></i> Loading optimization data...</div>'
	);

	getOptimizationData(fromDate, toDate)
		.then(function (response) {
			console.log(response);
			if (OPT_PROFILE.profileMode === 'EDIT' && OPT_PROFILE.profilePayload) {
				persistReoptimizeDelta({
					edited_berths: OPT_PROFILE.profilePayload.edited_berths || {},
					remote_added: OPT_PROFILE.profilePayload.remote_added || [],
					remote_removed: OPT_PROFILE.profilePayload.remote_removed || []
				});
			}
			drawOptimizationProfile(response);
		})
		.catch(function (error) {
			console.error(error);
			alert(error.message || 'Failed to fetch optimization data');
			$('#optimizationContent').html(
				'<div class="alert alert-danger text-center">Failed to load optimization data.</div>'
			);
		})
		.finally(function () {
			$btn.prop('disabled', false).text('Show Optimization');
		});
}

function renderRoute(routeData){
  var html = '<div class="route-card"><div class="route-title">ROUTE</div><div class="route-wrapper"><div class="main-route-line"></div>';
  routeData.forEach(function(station){
    var active = station.F_REM_LOC === 'Y';
    html += '<div class="route-node"><div class="'+(active ? 'route-dot-active' : 'route-dot')+'"></div><div class="'+(active ? 'route-label-active' : 'route-label')+'">'+(station.STN_CODE || '-')+'</div></div>';
  });
  html += '</div></div>';
  document.getElementById('routeInfo').innerHTML = html;
}

function filterByClass(berths, activeClass){
  if (!activeClass) return berths;
  return berths.filter(function(r){ return (r.CLS || '-') === activeClass; });
}

function renderProfileCards(profile, activeClass){
	  var berth = filterByClass(profile.berths || [], activeClass);
	  var physical = (profile.physical || []).filter(function(r){ return !activeClass || (r.CLS || '-') === activeClass; });
	  var allocated = berth.reduce(function(a,r){ return a + Number(r.BERTH || r.ALLOCATED_BERTHS || 0); }, 0);
	  var phys = physical.reduce(function(a,r){ return a + Number(r.PHY_BERTHS || r.PHYSICAL_BERTHS || 0); }, 0);
	  var quotaMap = {};
	  berth.forEach(function(r){ quotaMap[r.QUOTA_TYPE || r.QUOTA || '-'] = 1; });
	  var spanMap = {};

	  berth.forEach(function(r){

	    var src = (r.SOURCE || '').trim();
	    var dest = (r.DESTINATION || '').trim();

	    if(src && dest){

	      var key = src + '-' + dest;

	      spanMap[key] = 1;
	    }
	  });
	  document.getElementById('physicalBerthsCount').innerHTML = phys;
	  document.getElementById('allocatedCount').innerHTML = allocated;
	  document.getElementById('quotaCount').innerHTML = Object.keys(quotaMap).length;
	  document.getElementById('spanCount').innerHTML =Object.keys(spanMap).length;
		}
	var quotaColorMap = {};
	var nextColorIndex = 0;
	var colors = [
	 '#1f77b4','#ff7f0e','#2ca02c','#d62728','#9467bd',
	 '#8c564b','#17becf','#bcbd22','#e377c2','#7f7f7f',
	 '#3366CC','#DC3912','#FF9900','#109618','#990099',
	 '#0099C6','#DD4477','#66AA00','#B82E2E','#316395',
	 '#994499','#22AA99','#AAAA11','#6633CC','#E67300',
	 '#8B0707','#651067','#329262','#5574A6','#3B3EAC',
	 '#B77322','#16A765','#F4511E','#0B8043','#D81B60',
	 '#5E35B1','#039BE5','#00897B','#7CB342','#C0CA33',
	 '#FB8C00','#6D4C41','#546E7A','#43A047','#E53935',
	 '#3949AB','#00ACC1','#8E24AA','#FDD835','#795548',
	 '#4CAF50','#FF5722','#607D8B','#673AB7','#03A9F4',
	 '#009688','#CDDC39','#FFC107','#FF5252','#3F51B5'
	];
	function hashColor(quota) {
	    if (!quotaColorMap[quota]) {
	        quotaColorMap[quota] = colors[nextColorIndex % colors.length];
	        nextColorIndex++;
	    }
	    return quotaColorMap[quota];
	}
	window.getQuotaDisplayColor = hashColor;
	window.hashColor = hashColor;
	function buildBerthAllocationBarsHtml(berths, activeClass, route) {
	    var rows = filterByClass(berths, activeClass);
	    if (!rows.length) {
	        return '';
	    }
	    var distMap = {};
	    (route || []).forEach(function(r) {
	        distMap[r.STN_CODE] = Number(r.CUMM_DIST || 0);
	    });
	    var maxDist = 0;
	    Object.keys(distMap).forEach(function(k) {
	        if (distMap[k] > maxDist) {
	            maxDist = distMap[k];
	        }
	    });
	    maxDist = maxDist || 1;
	    var html = '<div class="berth-allocation-bars-inner">';
	    rows.sort(function(a, b) {
	        var q1 = a.QUOTA_TYPE || a.QUOTA || '';
	        var q2 = b.QUOTA_TYPE || b.QUOTA || '';
	        if (q1 < q2) return -1;
	        if (q1 > q2) return 1;
	        return 0;
	    });
	    rows.forEach(function(r) {
	        var s = r.SOURCE || r.FROM || '-';
	        var d = r.DESTINATION || r.TO || '-';
	        var berth = Number(r.BERTH || r.ALLOCATED_BERTHS || r.BERTHS || 0);
	        var quota = r.QUOTA_TYPE || r.QUOTA || '-';
	        var left = ((distMap[s] || 0) / maxDist) * 100;
	        var width = Math.max((((distMap[d] || 0) - (distMap[s] || 0)) / maxDist) * 100, 2);
	        var color = hashColor(quota);
	        var lightBg = color + '15';
	        var quotaTitle = (typeof getQuotaFullName === 'function') ? getQuotaFullName(quota) : quota;
	        html += '<div class="berth-alloc-row">'
	            + '<div class="berth-alloc-quota" style="color:' + color + ';"' + (quotaTitle && quotaTitle !== quota ? ' title="' + quotaTitle + '"' : '') + '>' + quota + '</div>'
	            + '<div class="berth-alloc-track" style="background:' + lightBg + ';">'
	            + '<div class="berth-alloc-bar" style="left:' + left + '%;width:' + width + '%;background:' + lightBg + ';border-color:' + color + ';color:' + color + ';">'
	            + berth + ' berths · ' + s + '→' + d
	            + '</div></div></div>';
	    });
	    html += '</div>';
	    return '<div class="berth-allocation-panel">' + html + '</div>';
	}
	window.buildBerthAllocationBarsHtml = buildBerthAllocationBarsHtml;
	function renderBerthAllocation(berths, activeClass, route) {
	    var wrap = document.getElementById('berthAllocationWrap');
	    if (!wrap) return;
	    var barsHtml = buildBerthAllocationBarsHtml(berths, activeClass, route);
	    if (!barsHtml) {
	        wrap.innerHTML = '<div class="text-muted">No berth allocation data available.</div>';
	        return;
	    }
	    wrap.innerHTML = barsHtml;
	}
	var demandChart = null;
	function demandValue(row){ return Number(row.TOT_PSGN || row.tot_psgn || row.DEMAND || row.demand || 0); }
	function updateDemandStats(rows){
	  if(!rows || !rows.length){ ['avgDay','peakDemand','peakDate','lowestDemand','lowestDate','busiestSegment','topClassQuota','weekCompare'].forEach(function(id){ var e=document.getElementById(id); if(e) e.textContent='-';}); return; }

	  var dayMap = {};
	  var pairMap = {};
	  var classQuotaDayMap = {};

	  rows.forEach(function(r){
	    var date = r.JOURNEY_DATE || '-';
	    var val = demandValue(r);
	    var from = r.FROM_STN || r.SOURCE || '-';
	    var to = r.TO_STN || r.DESTINATION || '-';
	    var cls = r.CLS || '-';
	    var quota = r.QUOTA_TYPE || r.QUOTA || '-';
	    var pairKey = from + '→' + to;
	    var cqKey = cls + '/' + quota;

	    dayMap[date] = (dayMap[date] || 0) + val;
	    pairMap[pairKey] = (pairMap[pairKey] || 0) + val;

	    if(!classQuotaDayMap[cqKey]) classQuotaDayMap[cqKey] = {};
	    classQuotaDayMap[cqKey][date] = (classQuotaDayMap[cqKey][date] || 0) + val;
	  });

	  var dates = Object.keys(dayMap).sort();
	  var avgDay = 0;
	  if (dates.length) {
	    var total = dates.reduce(function(a,d){ return a + dayMap[d]; }, 0);
	    avgDay = Math.round(total / dates.length);
	  }

	  var peakDate = dates[0] || '-';
	  var lowestDate = dates[0] || '-';
	  dates.forEach(function(d){
	    if (dayMap[d] > dayMap[peakDate]) peakDate = d;
	    if (dayMap[d] < dayMap[lowestDate]) lowestDate = d;
	  });

	  var busiestSeg = '-';
	  Object.keys(pairMap).forEach(function(k){
	    if (busiestSeg === '-' || pairMap[k] > pairMap[busiestSeg]) busiestSeg = k;
	  });

	  var topClassQuota = '-';
	  var topAvg = -1;
	  Object.keys(classQuotaDayMap).forEach(function(k){
	    var perDay = classQuotaDayMap[k];
	    var kDates = Object.keys(perDay);
	    if (!kDates.length) return;
	    var sum = kDates.reduce(function(a,d){ return a + perDay[d]; }, 0);
	    var avg = sum / kDates.length;
	    if (avg > topAvg) {
	      topAvg = avg;
	      topClassQuota = k;
	    }
	  });

	  var wkVals = [];
	  var weVals = [];
	  dates.forEach(function(d){
	    var day = new Date(d + 'T00:00:00').getDay();
	    if (day === 0 || day === 6) weVals.push(dayMap[d]);
	    else wkVals.push(dayMap[d]);
	  });

	  function avgOf(arr){ return arr.length ? Math.round(arr.reduce(function(a,b){ return a+b; },0) / arr.length) : 0; }
	  var set=function(id,v){ var e=document.getElementById(id); if(e) e.textContent=v; };

	  set('avgDay', String(avgDay));
	  set('peakDemand', String(dayMap[peakDate] || 0));
	  set('peakDate', formatDate(peakDate));
	  set('lowestDemand', String(dayMap[lowestDate] || 0));
	  set('lowestDate', formatDate(lowestDate));
	  set('busiestSegment', busiestSeg);
	  set('topClassQuota', topClassQuota);
	  set('weekCompare', avgOf(wkVals) + ' / ' + avgOf(weVals));
	}

	function isWeekend(dateStr){ var d=new Date(dateStr+'T00:00:00'); var day=d.getDay(); return day===0 || day===6; }
	function isHolidayRow(r, holidaySet){ return (r.IS_HOLIDAY==='Y' || r.HOLIDAY==='Y' || r.IS_HOLIDAY===true || (holidaySet && holidaySet[r.JOURNEY_DATE])); }
	function weekStart(dateStr){ var d=new Date(dateStr+'T00:00:00'); var day=d.getDay(); var diff=(day+6)%7; d.setDate(d.getDate()-diff); return d.toISOString().slice(0,10); }
	function aggregateDemandRows(rows, mode, holidaySet, fromDate, toDate) {

	    var map = {};

	    if (mode !== 'weekly') {

	        (rows || []).forEach(function(r) {

	            var date = r.JOURNEY_DATE || '-';

	            if (!map[date]) {

	                map[date] = {
	                    JOURNEY_DATE: date,
	                    WEEK_START: null,
	                    WEEK_END: date,
	                    TOT_PSGN: 0,
	                    DATES: [],
	                    HOLIDAY: 'N',
	                    WEEKEND: 'N',
	                    FESTIVALS: [],
	                    DEMAND_TYPE: null
	                };
	            }

	            map[date].TOT_PSGN += demandValue(r);

	            if (isWeekend(date)) {
	                map[date].WEEKEND = 'Y';
	            }
	            if (
	            	    holidaySet &&
	            	    holidaySet[date] &&
	            	    holidaySet[date].length
	            	) {

	            	    map[date].HOLIDAY = 'Y';

	            	    holidaySet[date].forEach(function(festival) {

	            	        if (
	            	            festival &&
	            	            map[date].FESTIVALS.indexOf(festival) === -1
	            	        ) {
	            	            map[date].FESTIVALS.push(festival);
	            	        }

	            	    });
	            	}
	            var demandType = String(
	                r.DEMAND_TYPE || ''
	            ).trim().toUpperCase();

	            if (demandType === 'HIST') {
	                map[date].DEMAND_TYPE = 'HIST';
	            }
	            else if (
	                demandType === 'PRED' &&
	                !map[date].DEMAND_TYPE
	            ) {
	                map[date].DEMAND_TYPE = 'PRED';
	            }

	        });

	        return Object.keys(map)
	            .sort()
	            .map(function(k) {
	                return map[k];
	            });
	    }

	    fromDate = fromDate || '';
	    toDate = toDate || '';

	    if (!fromDate || !toDate) {
	        return [];
	    }

	    var buckets = [];

	    var start = new Date(
	        fromDate + 'T00:00:00'
	    );

	    var end = new Date(
	        toDate + 'T00:00:00'
	    );


	    while (start <= end) {

	        var bucketStart = new Date(start);

	        var day = bucketStart.getDay();

	        var daysToSunday = 7 - day;

	        if (daysToSunday === 7) {
	            daysToSunday = 0;
	        }


	        var bucketEnd = new Date(bucketStart);

	        bucketEnd.setDate(
	            bucketEnd.getDate() + daysToSunday
	        );

	        if (bucketEnd > end) {
	            bucketEnd = new Date(end);
	        }


	        buckets.push({
	            start: new Date(bucketStart),
	            end: new Date(bucketEnd)
	        });

	        start = new Date(bucketEnd);

	        start.setDate(
	            start.getDate() + 1
	        );
	    }
	    function dateKey(d) {

	        return d.getFullYear() + '-' +
	            String(d.getMonth() + 1).padStart(2, '0') + '-' +
	            String(d.getDate()).padStart(2, '0');
	    }
	    (rows || []).forEach(function(r) {

	        var date = r.JOURNEY_DATE;

	        if (!date) {
	            return;
	        }


	        var d = new Date(
	            date + 'T00:00:00'
	        );


	        for (var i = 0; i < buckets.length; i++) {

	            var b = buckets[i];

	            if (
	                d >= b.start &&
	                d <= b.end
	            ) {

	                var key = dateKey(b.start);


	                if (!map[key]) {

	                    map[key] = {

	                        JOURNEY_DATE: key,

	                        WEEK_START: dateKey(
	                            b.start
	                        ),

	                        WEEK_END: dateKey(
	                            b.end
	                        ),

	                        TOT_PSGN: 0,

	                        DATES: [],

	                        HOLIDAY: 'N',

	                        WEEKEND: 'N',

	                        FESTIVALS: [],

	                        DEMAND_TYPE: null

	                    };
	                }
	                map[key].TOT_PSGN += demandValue(r);
	                if (
	                    map[key].DATES.indexOf(date) === -1
	                ) {

	                    map[key].DATES.push(date);

	                }
	                if (isWeekend(date)) {
	                    map[key].WEEKEND = 'Y';
	                }

	                if (
	                	    holidaySet &&
	                	    holidaySet[date] &&
	                	    holidaySet[date].length
	                	) {

	                	    map[key].HOLIDAY = 'Y';

	                	    holidaySet[date].forEach(function(festival) {

	                	        if (
	                	            festival &&
	                	            map[key].FESTIVALS.indexOf(festival) === -1
	                	        ) {
	                	            map[key].FESTIVALS.push(festival);
	                	        }

	                	    });
	                	}
	                var demandType = String(
	                    r.DEMAND_TYPE || ''
	                ).trim().toUpperCase();

	                if (demandType === 'HIST') {

	                    map[key].DEMAND_TYPE =
	                        'HIST';

	                }
	                else if (
	                    demandType === 'PRED' &&
	                    !map[key].DEMAND_TYPE
	                ) {

	                    map[key].DEMAND_TYPE =
	                        'PRED';

	                }

	                break;
	            }
	        }

	    });
	    return buckets.map(function(b) {

	        var key = dateKey(b.start);

	        var row = map[key];


	        if (!row) {

	            row = {

	                JOURNEY_DATE: key,

	                WEEK_START: dateKey(
	                    b.start
	                ),

	                WEEK_END: dateKey(
	                    b.end
	                ),

	                TOT_PSGN: 0,

	                DATES: [],

	                HOLIDAY: 'N',

	                WEEKEND: 'N',

	                FESTIVALS: [],

	                DEMAND_TYPE: null

	            };
	        }

	        var days =
	            row.DATES.length || 1;


	        row.TOT_PSGN = Math.round(
	            row.TOT_PSGN / days
	        );


	        return row;

	    });
	}
	function updateDemandChart(rows, mode, holidays) {

	    var c = document.getElementById('demandChart');

	    updateDemandStats(rows || []);

	    if (!c || !window.Chart) return;

	    var holidaySet = {};
	    var holidayMap = {};

	    (holidays || []).forEach(function(h) {

	        var date = h.HOLIDAY_DATE;
	        var holiday = h.HOLIDAY;

	        if (!date || !holiday) {
	            return;
	        }

	        // Store ALL holidays for the same date
	        if (!holidaySet[date]) {
	            holidaySet[date] = [];
	        }

	        if (holidaySet[date].indexOf(holiday) === -1) {
	            holidaySet[date].push(holiday);
	        }

	        // Same data for tooltip
	        holidayMap[date] = holidaySet[date];

	    });
//
//	    var dataRows = aggregateDemandRows(rows || [], mode, holidaySet);
//
//	    var labels = dataRows.map(function(r) {
//	        return r.JOURNEY_DATE;
//	    });
//
//	    var vals = dataRows.map(function(r) {
//	        return demandValue(r);
//	    });
	    var fromDate = '';
	    var toDate = '';

	    if (mode === 'weekly' && rows && rows.length) {

	        var apiDates = rows
	            .map(function(r) {
	                return r.JOURNEY_DATE;
	            })
	            .filter(function(d) {
	                return !!d;
	            })
	            .sort();

	        if (apiDates.length) {
	            fromDate = apiDates[0];
	            toDate = apiDates[apiDates.length - 1];
	        }
	    }

	    var dataRows = aggregateDemandRows(
	        rows || [],
	        mode,
	        holidaySet,
	        fromDate,
	        toDate
	    );
	 var labels = dataRows.map(function(r) {
	     return r.JOURNEY_DATE;
	 });

	 var vals = dataRows.map(function(r) {
	     return demandValue(r);
	 });
	    var today = new Date();
	    today.setHours(0, 0, 0, 0);


	    var pointBg = dataRows.map(function(r) {

	        if (r.HOLIDAY === 'Y') {
	            return '#28a745';
	        }

	        if (r.WEEKEND === 'Y') {
	            return '#ff9800';
	        }

	        return '#337ab7';

	    });


	    var formattedLabels = dataRows.map(function(r) {

	        if (mode === 'weekly') {

	            return formatDate(r.WEEK_START) +
	                   ' - ' +
	                   formatDate(r.WEEK_END);

	        }

	        return formatDate(r.JOURNEY_DATE);
	    });


	    function getDayName(dateStr) {

	        return new Date(dateStr + 'T00:00:00')
	            .toLocaleDateString('en-US', {
	                weekday: 'long'
	            });

	    }



	    if (demandChart) {
	        demandChart.destroy();
	    }

	    demandChart = new Chart(c, {

	        type: 'line',

	        data: {

	            labels: formattedLabels,

	            datasets: [

	                {
	                	 label: 'Demand',

	                	    data: vals,

	                	    borderColor: '#2563eb',

	                	    backgroundColor: 'rgba(37,99,235,0.08)',

	                	    pointBackgroundColor: pointBg,

	                	    pointBorderColor: '#fff',

	                	    pointRadius: 4,

	                	    pointHoverRadius: 7,

	                	    borderWidth: 2,

	                	    tension: 0.4,

	                	    fill: true,

	                	    segment: {

	                	        borderColor: function(ctx) {

	                	            var index = ctx.p0DataIndex;
	                	            var row = dataRows[index];

	                	            if (!row) {
	                	                return '#2563eb';
	                	            }

	                	            var demandType = String( row.DEMAND_TYPE || '').toUpperCase();
	                	            if (demandType === 'HIST') {
	                	                return '#dc3545';
	                	            }

	                	            if (demandType === 'PRED') {
	                	                return '#2563eb';
	                	            }

	                	            return '#2563eb';
	                	        },

	                	        backgroundColor: function(ctx) {

	                	            var index = ctx.p0DataIndex;
	                	            var row = dataRows[index];

	                	            if (!row) {
	                	                return 'rgba(37,99,235,0.08)';
	                	            }

	                	            var demandType = String( row.DEMAND_TYPE || '').toUpperCase();

	                	            if (demandType === 'HIST') {
	                	                return 'rgba(220,53,69,0.12)';
	                	            }

	                	            if (demandType === 'PRED') {
	                	                return 'rgba(37,99,235,0.08)';
	                	            }

	                	            return 'rgba(37,99,235,0.08)';
	                	        }
	                	    }
	                	}
	            ]

	        },


	        options: {

	            responsive: true,

	            maintainAspectRatio: false,


	            interaction: {

	                mode: 'index',

	                intersect: false

	            },


	            plugins: {

	            	legend: {

	            	    display: true,

	            	    position: 'top',
	            	    onClick: function () {
	            	    },

	            	    labels: {

	            	        generateLabels: function(chart) {

	            	     
	            	        	return [

	            	                {
	            	                    text: 'Historical',
	            	                    fillStyle: 'transparent',
	            	                    strokeStyle: '#dc3545',
	            	                    lineWidth: 2,
	            	                    hidden: false,
	            	                    datasetIndex: 0
	            	                },

	            	                {
	            	                    text: 'Prediction',
	            	                    fillStyle: 'transparent',
	            	                    strokeStyle: '#2563eb',
	            	                    lineWidth: 2,
	            	                    hidden: false,
	            	                    datasetIndex: 0
	            	                }

	            	            ];

	            	        }

	            	    }

	            	},

	                tooltip: {

	                    enabled: true,

	                    callbacks: {

	                        title: function(context) {

	                            var idx = context[0].dataIndex;

	                            var row = dataRows[idx];
	                            if (mode === 'weekly') {

	                                var weekStartDay = getDayName(row.WEEK_START);
	                                var weekEndDay   = getDayName(row.WEEK_END);

	                                var result = [

	                                    formatDate(row.WEEK_START) +
	                                    ' to ' +
	                                    formatDate(row.WEEK_END),

	                                    '(' + weekStartDay + ' - ' + weekEndDay + ')'

	                                ];


	                                if (
	                                    row.FESTIVALS &&
	                                    row.FESTIVALS.length
	                                ) {

	                                    result.push(

	                                        'Festival' +
	                                        (
	                                            row.FESTIVALS.length > 1
	                                                ? 's'
	                                                : ''
	                                        ) +
	                                        ': ' +
	                                        row.FESTIVALS.join(', ')

	                                    );

	                                }

	                                return result;

	                            }

	                            var originalDate = labels[idx];

	                            var result = [

	                                formatDate(originalDate),

	                                getDayName(originalDate)

	                            ];


	                            if (
	                            	    holidayMap[originalDate] &&
	                            	    holidayMap[originalDate].length
	                            	) {

	                            	    result.push(
	                            	        'Holiday: ' +
	                            	        holidayMap[originalDate].join(', ')
	                            	    );

	                            	

	                            }


	                            return result;

	                        },


	                        label: function(context) {

	                            return 'Passengers : ' + context.raw;

	                        }

	                    }

	                }

	            },


	            scales: {

	                x: {

	                    ticks: {

	                        maxRotation: 45,

	                        minRotation: 45

	                    },

	                    title: {

	                        display: true,

	                        text: 'Journey Date'

	                    }

	                },


	                y: {

	                    beginAtZero: true,

	                    title: {

	                        display: true,

	                        text: 'Total Passengers'

	                    }

	                }

	            }

	        }

	    });

	}
