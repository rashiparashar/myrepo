/* Train profile utilization dashboard — chart rendering and filters */

var UTIL_CHARTS = {
    time: null,
    classBar: null,
    quota: null,
    segmentTrend: null,
    detailClass: null,
    odVolume: null,
    loadCapacity: null
};
var utilizationDashboardBuilt = false;
var UTIL_ALL_SEGMENTS = '__ALL__';

var UTILIZATION_STATE = {
    route: [],
    utilizationList: [],
    selectedSeg: null,
    filters: {
        classVal: '',
        quotaVal: '',
        journeyDate: '',
        sourceVal: '',
        destinationVal: ''
    }
};

var utilLabelColorMap = {};
var utilNextColorIndex = 0;
var UTIL_COLOR_PALETTE = [
    '#1f77b4', '#ff7f0e', '#2ca02c', '#d62728', '#9467bd',
    '#8c564b', '#17becf', '#bcbd22', '#e377c2', '#7f7f7f',
    '#3366CC', '#DC3912', '#FF9900', '#109618', '#990099',
    '#0099C6', '#DD4477', '#66AA00', '#B82E2E', '#316395',
    '#994499', '#22AA99', '#AAAA11', '#6633CC', '#E67300',
    '#8B0707', '#651067', '#329262', '#5574A6', '#3B3EAC',
    '#B77322', '#16A765', '#F4511E', '#0B8043', '#D81B60',
    '#5E35B1', '#039BE5', '#00897B', '#7CB342', '#C0CA33',
    '#FB8C00', '#6D4C41', '#546E7A', '#43A047', '#E53935',
    '#3949AB', '#00ACC1', '#8E24AA', '#FDD835', '#795548',
    '#4CAF50', '#FF5722', '#607D8B', '#673AB7', '#03A9F4',
    '#009688', '#CDDC39', '#FFC107', '#FF5252', '#3F51B5'
];
var UTIL_COLORS = {
    blue: '#1B4FD8',
    green: '#0A7C4E',
    purple: '#8B5CF6',
    amber: '#D97706',
    amberWarn: '#B45309',
    red: '#C0392B',
    alert: '#EF4444',
    grid: 'rgba(0,0,0,0.05)',
    tick: '#6B6B66'
};
var UTIL_BLUE = UTIL_COLORS.blue;
var UTIL_GREEN = UTIL_COLORS.green;
var UTIL_PURPLE = UTIL_COLORS.purple;
var UTIL_AMBER = UTIL_COLORS.amber;
var UTIL_ALERT = UTIL_COLORS.alert;
var UTIL_PAIRED_CHART_HEIGHT = 240;
var UTIL_SCROLL_CHART_HEIGHT = 260;
var UTIL_OD_SLOT_PX = 24;
var UTIL_LOAD_SLOT_PX = 32;
var UTIL_SCROLL_BAR_GUTTER = 18;
var UTIL_HOP_LABEL_BOTTOM_PAD = 28;
var UTIL_TIMELINE_CHART_HEIGHT = 220;

function resetUtilPaletteColors() {
    utilLabelColorMap = {};
    utilNextColorIndex = 0;
}

function getUtilPaletteColor(label) {
    var key = String(label == null ? '' : label).trim() || '-';
    if (typeof window.hashColor === 'function') {
        return window.hashColor(key);
    }
    if (!utilLabelColorMap[key]) {
        utilLabelColorMap[key] = UTIL_COLOR_PALETTE[utilNextColorIndex % UTIL_COLOR_PALETTE.length];
        utilNextColorIndex++;
    }
    return utilLabelColorMap[key];
}

function getUtilChartColor(label) {
    return getUtilPaletteColor(label);
}

function getUtilHexFill(color, alphaHex) {
    var base = String(color || UTIL_BLUE);
    if (base.length === 9) {
        base = base.slice(0, 7);
    }
    return base + (alphaHex || '20');
}

function getUtilTimelineBarStyle(labels, selectedDate) {
    return {
        fills: (labels || []).map(function (lbl) {
            return (selectedDate && lbl === selectedDate) ? '#2ca02c50' : '#1f77b450';
        }),
        borders: (labels || []).map(function (lbl) { 
			return (selectedDate && lbl === selectedDate) ? '#2ca02c' : '#1f77b4';
		}),
        borderWidths: (labels || []).map(function () { return 1; })
    };
}

function getUtilPaletteBarStyle(labels) {
    return {
        fills: (labels || []).map(function (lbl) { return getUtilChartColor(lbl); }),
        borders: (labels || []).map(function () { return 'transparent'; }),
        borderWidths: (labels || []).map(function () { return 0; })
    };
}

function getUtilSolidBarStyle(color) {
    var accent = color || UTIL_BLUE;
    return {
        fill: accent,
        border: 'transparent',
        borderWidth: 0
    };
}

function getUtilSegmentBarColor(pct) {
    if (pct >= 90) return '#2E7D32'; // Green
    if (pct >= 80) return '#43A047'; // Light Green
    if (pct >= 70) return '#66BB6A'; // Soft Green
    if (pct >= 60) return '#9CCC65'; // Yellow-Green
    if (pct >= 50) return '#C0CA33'; // Lime
    if (pct >= 40) return '#FDD835'; // Yellow
    if (pct >= 30) return '#FFB300'; // Amber
    if (pct >= 20) return '#FB8C00'; // Orange
    if (pct >= 10) return '#F4511E'; // Deep Orange
    return '#D32F2F';                // Red
}

function calcPairedBarDensity(labelCount) {
    var n = Math.max(labelCount, 1);
    if (n <= 3) {
        return { barPercentage: 0.7, categoryPercentage: 0.62 };
    }
    if (n <= 6) {
        return { barPercentage: 0.8, categoryPercentage: 0.78 };
    }
    if (n <= 10) {
        return { barPercentage: 0.86, categoryPercentage: 0.88 };
    }
    return { barPercentage: 0.9, categoryPercentage: 0.94 };
}

function buildPairedChartLayout(labelCount) {
    var density = calcPairedBarDensity(labelCount);
    return {
        chartHeight: UTIL_PAIRED_CHART_HEIGHT,
        fixed: true,
        barPercentage: density.barPercentage,
        categoryPercentage: density.categoryPercentage
    };
}

function syncUtilChartWrapHeights(selector, height) {
    $(selector).css('height', height + 'px');
}

function getTopSegmentKey(rows) {
    var segBuckets = buildKmBuckets(rows, remoteSegmentKey);
    var segs = Object.keys(segBuckets).filter(Boolean).sort(function (a, b) {
        return segBuckets[b].tKm - segBuckets[a].tKm;
    });
    return segs.length ? segs[0] : null;
}

function isAllSegmentsSelected(segName) {
    return (segName || UTILIZATION_STATE.selectedSeg) === UTIL_ALL_SEGMENTS;
}

function getSegmentDisplayLabel(segName) {
    return isAllSegmentsSelected(segName) ? 'All Segments' : segName;
}

function resolveSelectedSegment(rows) {
    if (!rows || !rows.length) {
        UTILIZATION_STATE.selectedSeg = null;
        return null;
    }
    if (!UTILIZATION_STATE.selectedSeg || isAllSegmentsSelected()) {
        UTILIZATION_STATE.selectedSeg = UTIL_ALL_SEGMENTS;
        return UTIL_ALL_SEGMENTS;
    }
    var hasSeg = rows.some(function (row) {
        return remoteSegmentKey(row) === UTILIZATION_STATE.selectedSeg;
    });
    if (!hasSeg) {
        UTILIZATION_STATE.selectedSeg = UTIL_ALL_SEGMENTS;
    }
    return UTILIZATION_STATE.selectedSeg;
}

function normalizeRouteStations(route) {
    return (route || []).map(function (stn) {
        if (typeof stn === 'string') {
            return stn;
        }
        return stn.STN_CODE || stn.stn_code || '';
    }).filter(function (code) {
        return code !== null && code !== undefined && String(code).trim() !== '';
    });
}

function utilJourneyDate(row) {
    return String((row && row.JOURNEY_DATE) || '').slice(0, 10);
}

function formatUtilChartDate(dateStr) {
    if (!dateStr || typeof dateStr !== 'string') {
        return '-';
    }
    var parts = dateStr.split('-');
    if (parts.length !== 3) {
        return dateStr;
    }
    return parts[2] + "-" + parts[1] + "-" + parts[0];
}

function toUtilChartDisplayLabels(rawDates) {
    return (rawDates || []).map(formatUtilChartDate);
}

function getRouteDestinationsAfterSource(sourceVal) {
    var route = UTILIZATION_STATE.route || [];
    if (!sourceVal) {
        return route;
    }
    var srcIdx = route.indexOf(sourceVal);
    if (srcIdx === -1) {
        return route;
    }
    return route.slice(srcIdx + 1);
}

function remoteSegmentKey(row) {
    var src = String((row.SOURCE_REMOTE || '')).trim();
    var dst = String((row.DESTINATION_REMOTE || '')).trim();
    if (!src || !dst) {
        return '';
    }
    return src + '\u2192' + dst;
}

function drawUtilizationCharts(responseData) {
    destroyUtilizationCharts();

    var payload = responseData || {};
    var dataBlock = payload.data || payload;
    var route = normalizeRouteStations(dataBlock.route || []);
    var utilizationList = dataBlock.utilization || [];

    UTILIZATION_STATE.route = route;
    UTILIZATION_STATE.utilizationList = utilizationList;
    UTILIZATION_STATE.selectedSeg = null;
    resetUtilPaletteColors();
    UTILIZATION_STATE.filters = {
        classVal: '',
        quotaVal: '',
        journeyDate: '',
        sourceVal: '',
        destinationVal: ''
    };

    if (!utilizationList.length) {
        utilizationDashboardBuilt = false;
        $('#utilizationChartsContainer').html(
            '<div class="alert alert-info text-center">No utilization records found for the selected date range.</div>'
        );
        return;
    }

    buildUtilizationDashboardShell();
    bindUtilizationFilterEvents();
    utilizationDashboardBuilt = true;
    populateUtilizationFilters();
    renderUtilizationDashboard();
}

function buildUtilizationDashboardShell() {
    $('#utilizationChartsContainer').html(
        '<div class="utilization-section-title">UTILIZATION</div>'
        + '<div class="row utilization-filters-row">'
        + utilFilterCol('CLASS', 'utilFilterClass', 'select')
        + utilFilterCol('QUOTA', 'utilFilterQuota', 'select')
        + utilFilterCol('DATE', 'utilFilterDate', 'date')
        + utilFilterCol('FROM STN', 'utilFilterSource', 'select')
        + utilFilterCol('TO STN', 'utilFilterDestination', 'select')
        + '<div class="col-md-2 col-sm-6" style="margin-bottom:10px;"><label class="utilization-filter-label">&nbsp;</label>'
        + '<button type="button" id="utilFilterReset" class="btn btn-default form-control" style="border-radius:8px;font-weight:600;">Reset</button></div>'
        + '</div>'
        + '<div id="utilizationChartsBody">'
        + '<div class="utilization-chart-card"><div class="utilization-chart-title">Overall fill rate over time (click a date to filter)</div>'
        + '<div class="util-chart-wrap util-timeline-chart-wrap"><canvas id="utilizationTimeChart"></canvas></div></div>'
        + '<div id="utilizationSummaryCards" class="utilization-summary-cards"></div>'
        + '<div class="utilization-charts-row util-paired-charts-row">'
        + '<div class="utilization-chart-card util-paired-chart-card"><div class="utilization-chart-title">Fill rate by class</div>'
        + '<div class="util-chart-wrap util-paired-chart-wrap" data-chart="classBar"><canvas id="utilizationClassChart"></canvas></div></div>'
        + '<div class="utilization-chart-card util-paired-chart-card"><div class="utilization-chart-title">Fill rate by quota</div>'
        + '<div class="util-chart-wrap util-paired-chart-wrap" data-chart="quota"><canvas id="utilizationQuotaChart"></canvas></div></div>'
        + '</div>'
        + '<div class="row utilization-detail-row">'
        + '<div class="col-md-4 utilization-detail-left">'
        + '<div class="utilization-chart-card"><div class="util-chart-subtitle" id="utilSegmentTitle">SEGMENT UTILIZATION '
        + '<button type="button" id="utilSegAllBtn" class="util-seg-all-btn">All</button> '
        + '<span id="utilSegSelectHint" style="font-weight:400;color:#888;">(All Segments)</span></div>'
        + '<div id="utilSegmentList" class="util-segment-list"></div></div>'
        + '</div><div class="col-md-8 utilization-detail-right">'
        + '<div class="utilization-chart-card"><div class="util-chart-subtitle" id="utilDateTrendTitle"></div>'
        + '<div style="height:220px;position:relative;"><canvas id="utilSegmentTrendChart"></canvas></div></div>'
        + '<div class="util-detail-grid util-paired-charts-row">'
        + '<div class="utilization-chart-card util-paired-chart-card"><div class="util-chart-subtitle" id="utilDetailClassTitle"></div>'
        + '<div class="util-chart-wrap util-detail-paired-wrap"><canvas id="utilDetailClassChart"></canvas></div></div>'
        + '<div class="utilization-chart-card util-paired-chart-card"><div class="util-chart-subtitle" id="utilOdVolumeTitle"></div>'
        + '<div class="util-scroll-chart-outer util-od-scroll-outer"><div class="util-chart-wrap util-detail-paired-wrap util-scroll-chart-inner" id="utilOdVolumeWrap"><canvas id="utilOdVolumeChart"></canvas></div></div></div>'
        + '</div>'
        + '<div class="utilization-chart-card"><div class="util-chart-subtitle" id="utilLoadCapTitle"></div>'
        + '<div class="util-scroll-chart-outer util-load-scroll-outer"><div class="util-scroll-chart-inner" id="utilLoadCapacityWrap" style="height:240px;position:relative;"><canvas id="utilLoadCapacityChart"></canvas></div></div></div>'
        + '</div></div>'
        + '</div>'
    );
}

function hasActiveUtilizationFilters() {
    var f = UTILIZATION_STATE.filters;
    return !!(f.classVal || f.quotaVal || f.journeyDate || f.sourceVal || f.destinationVal);
}

function setUtilizationChartsVisible(visible) {
    var $body = $('#utilizationChartsBody');
    if ($body.length) {
        $body.toggle(!!visible);
    }
}

function rowMatchesStationAllocations(row, fromStn, toStn) {
    if (!fromStn && !toStn) {
        return true;
    }
    if (!row.ALLOCATIONS || !row.ALLOCATIONS.length) {
        return false;
    }
    return row.ALLOCATIONS.some(function (a) {
        if (!a) {
            return false;
        }
        var fMatch = !fromStn || String(a.FROM_STN || '').trim() === fromStn;
        var tMatch = !toStn || String(a.TO_STN || '').trim() === toStn;
        return fMatch && tMatch;
    });
}

function getUtilFilterRows() {
    var list = UTILIZATION_STATE.utilizationList || [];
    var f = UTILIZATION_STATE.filters;

    var baseRows = list.filter(function (row) {
        if (!row) {
            return false;
        }
        if (f.classVal && String(row.CLASS || '').trim() !== f.classVal) {
            return false;
        }
        if (f.quotaVal && String(row.QUOTA || '').trim() !== f.quotaVal) {
            return false;
        }
        return rowMatchesStationAllocations(row, f.sourceVal, f.destinationVal);
    });

    var rows = baseRows;
    if (f.journeyDate) {
        rows = baseRows.filter(function (row) {
            return utilJourneyDate(row) === f.journeyDate;
        });
    }

    return { baseRows: baseRows, rows: rows };
}

function utilFilterCol(label, id, type) {
    var input = type === 'date'
        ? '<input type="date" id="' + id + '" class="form-control" style="border-radius:8px;">'
        : '<select id="' + id + '" class="form-control" style="border-radius:8px;"></select>';
    return '<div class="col-md-2 col-sm-6" style="margin-bottom:10px;"><label class="utilization-filter-label">' + label
        + '</label>' + input + '</div>';
}

function bindUtilizationFilterEvents() {
    var $container = $('#utilizationChartsContainer');

    $container.off('change.utilFilters', '#utilFilterClass,#utilFilterQuota,#utilFilterDate,#utilFilterSource,#utilFilterDestination');
    $container.on('change.utilFilters', '#utilFilterClass,#utilFilterQuota,#utilFilterDate,#utilFilterSource,#utilFilterDestination', function () {
        var sourceChanged = this.id === 'utilFilterSource';
        UTILIZATION_STATE.filters.classVal = $('#utilFilterClass').val() || '';
        UTILIZATION_STATE.filters.quotaVal = $('#utilFilterQuota').val() || '';
        UTILIZATION_STATE.filters.journeyDate = $('#utilFilterDate').val() || '';
        UTILIZATION_STATE.filters.sourceVal = $('#utilFilterSource').val() || '';
        UTILIZATION_STATE.filters.destinationVal = $('#utilFilterDestination').val() || '';

        if (sourceChanged) {
            var allowedDests = getRouteDestinationsAfterSource(UTILIZATION_STATE.filters.sourceVal);
            if (UTILIZATION_STATE.filters.destinationVal
                && allowedDests.indexOf(UTILIZATION_STATE.filters.destinationVal) === -1) {
                UTILIZATION_STATE.filters.destinationVal = '';
            }
            fillUtilizationSelect(
                '#utilFilterDestination',
                'All destinations',
                allowedDests,
                UTILIZATION_STATE.filters.destinationVal
            );
        }

        renderUtilizationDashboard();
    });

    $container.off('click.utilReset', '#utilFilterReset');
    $container.on('click.utilReset', '#utilFilterReset', function () {
        resetUtilizationFilters();
        renderUtilizationDashboard();
    });
}

function resetUtilizationFilters() {
    UTILIZATION_STATE.filters = {
        classVal: '',
        quotaVal: '',
        journeyDate: '',
        sourceVal: '',
        destinationVal: ''
    };
    UTILIZATION_STATE.selectedSeg = null;
    populateUtilizationFilters();
}

function collectUtilizationFilterOptions() {
    var classes = {};
    var quotas = {};
    var sources = {};
    var dests = {};
    var dates = {};

    (UTILIZATION_STATE.utilizationList || []).forEach(function (r) {
        if (r.CLASS) {
            classes[String(r.CLASS).trim()] = 1;
        }
        if (r.QUOTA) {
            quotas[String(r.QUOTA).trim()] = 1;
        }
        if (r.JOURNEY_DATE) {
            dates[utilJourneyDate(r)] = 1;
        }
        (r.ALLOCATIONS || []).forEach(function (a) {
            if (a && a.FROM_STN) {
                sources[String(a.FROM_STN).trim()] = 1;
            }
            if (a && a.TO_STN) {
                dests[String(a.TO_STN).trim()] = 1;
            }
        });
    });

    return {
        classes: Object.keys(classes).sort(),
        quotas: Object.keys(quotas).sort(),
        sources: UTILIZATION_STATE.route,
        dests: getRouteDestinationsAfterSource(UTILIZATION_STATE.filters.sourceVal),
        dates: Object.keys(dates).sort()
    };
}

function populateUtilizationFilters() {
    var opts = collectUtilizationFilterOptions();

    fillUtilizationSelect('#utilFilterClass', 'All classes', opts.classes, UTILIZATION_STATE.filters.classVal);
    fillUtilizationSelect('#utilFilterQuota', 'All quotas', opts.quotas, UTILIZATION_STATE.filters.quotaVal);
    fillUtilizationSelect('#utilFilterSource', 'All sources', opts.sources, UTILIZATION_STATE.filters.sourceVal);
    fillUtilizationSelect('#utilFilterDestination', 'All destinations', opts.dests, UTILIZATION_STATE.filters.destinationVal);

    var $date = $('#utilFilterDate');
    if ($date.length) {
        if (opts.dates.length) {
            $date.attr('min', opts.dates[0]);
            $date.attr('max', opts.dates[opts.dates.length - 1]);
        }
        $date.val(UTILIZATION_STATE.filters.journeyDate || '');
    }
}

function fillUtilizationSelect(selector, allLabel, values, selectedValue) {
    var html = '<option value="">' + allLabel + '</option>';
    values.forEach(function (val) {
        var selected = selectedValue === val ? ' selected' : '';
        html += '<option value="' + escapeHtmlAttr(val) + '"' + selected + '>' + escapeHtml(val) + '</option>';
    });
    $(selector).html(html);
}

function getUniqueSortedValues(list, key) {
    var set = {};
    (list || []).forEach(function (row) {
        var val = row && row[key];
        if (val !== null && val !== undefined && String(val).trim() !== '') {
            set[String(val)] = 1;
        }
    });
    return Object.keys(set).sort();
}

function toNumber(val) {
    var n = Number(val);
    return isNaN(n) ? 0 : n;
}

function calcUtilizationPercent(servedBerthKm, totalBerthKm) {
    return totalBerthKm > 0 ? (servedBerthKm / totalBerthKm) * 100 : 0;
}

function groupUtilizationByField(rows, keyFn) {
    var map = {};

    (rows || []).forEach(function (row) {
        if (!row) {
            return;
        }
        var key = keyFn(row);
        if (!map[key]) {
            map[key] = {
                servedKm: 0,
                totalKm: 0,
                served: 0,
                unserved: 0,
                daySet: {}
            };
        }
        var g = map[key];
        g.servedKm += toNumber(row.SERVED_BERTH_KM);
        g.totalKm += toNumber(row.TOTAL_BERTH_KM);
        g.served += toNumber(row.SERVED);
        g.unserved += toNumber(row.UNSERVED);

        if (row.JOURNEY_DATE) {
            g.daySet[row.JOURNEY_DATE] = 1;
        }
    });

    return map;
}

function buildGroupedMetrics(rows, keyFn, sortDesc) {
    var grouped = groupUtilizationByField(rows, keyFn);
    var entries = Object.keys(grouped).map(function (label) {
        var g = grouped[label];
        return {
            label: label,
            value: calcUtilizationPercent(g.servedKm, g.totalKm),
            served: g.served,
            servedKm: g.servedKm,
            totalKm: g.totalKm,
            capacity: g.capacity,
            dayCount: Object.keys(g.daySet).length || 1
        };
    });
    if (sortDesc !== false) {
        entries.sort(function (a, b) { return b.value - a.value; });
    } else {
        entries.sort(function (a, b) { return a.label.localeCompare(b.label); });
    }
    return {
        labels: entries.map(function (e) { return e.label; }),
        values: entries.map(function (e) { return e.value; }),
        entries: entries
    };
}

function buildKmBuckets(rows, keyFn) {
    var map = {};
    (rows || []).forEach(function (row) {
        if (!row) {
            return;
        }
        var key = keyFn(row);
        if (!map[key]) {
            map[key] = { tKm: 0, sKm: 0 };
        }
        map[key].tKm += toNumber(row.TOTAL_BERTH_KM);
        map[key].sKm += toNumber(row.SERVED_BERTH_KM);
    });
    return map;
}

function bucketUtilizationPercent(bucket) {
    return bucket.tKm > 0 ? calcUtilizationPercent(bucket.sKm, bucket.tKm) : 0;
}

function buildTimeSeriesData(rows) {
    return buildGroupedMetrics(rows, function (row) { return utilJourneyDate(row) || '-'; }, false);
}

function buildClassWiseData(rows) {
    return buildGroupedMetrics(rows, function (row) { return row.CLASS || '-'; });
}

function buildQuotaWiseData(rows) {
    return buildGroupedMetrics(rows, function (row) { return row.QUOTA || '-'; });
}

function filterRowsForSegment(segName) {
    var f = UTILIZATION_STATE.filters;
    var allSegs = isAllSegmentsSelected(segName);
    return (UTILIZATION_STATE.utilizationList || []).filter(function (r) {
        if (!allSegs && remoteSegmentKey(r) !== segName) {
            return false;
        }
        if (f.classVal && String(r.CLASS || '').trim() !== f.classVal) {
            return false;
        }
        if (f.quotaVal && String(r.QUOTA || '').trim() !== f.quotaVal) {
            return false;
        }
        return rowMatchesStationAllocations(r, f.sourceVal, f.destinationVal);
    });
}

function calculateOverallMetrics(rows) {
    var totals = {
        servedKm: 0,
        totalKm: 0,
        served: 0,
        unserved: 0
    };
    var dailyMap = {};

    (rows || []).forEach(function (row) {
        var date = utilJourneyDate(row) || '-';
        if (!dailyMap[date]) {
            dailyMap[date] = {
                servedKm: 0,
                totalKm: 0,
                served: 0,
                unserved: 0
            };
        }

        var servedKm = toNumber(row.SERVED_BERTH_KM);
        var totalKm = toNumber(row.TOTAL_BERTH_KM);
        var served = toNumber(row.SERVED);
        var unserved = toNumber(row.UNSERVED);

        totals.servedKm += servedKm;
        totals.totalKm += totalKm;
        totals.served += served;
        totals.unserved += unserved;

        dailyMap[date].servedKm += servedKm;
        dailyMap[date].totalKm += totalKm;
        dailyMap[date].served += served;
        dailyMap[date].unserved += unserved;
    });

    var dayKeys = Object.keys(dailyMap);
    var dayCount = dayKeys.length || 1;
    var avgServed = 0;
    var avgUnserved = 0;
    var avgUtilizedKm = 0;
    var avgVacantKm = 0;
    var avgTotalKm = 0;

    dayKeys.forEach(function (date) {
        var day = dailyMap[date];
        avgServed += day.served;
        avgUnserved += day.unserved;
        avgUtilizedKm += day.servedKm;
        avgVacantKm += (day.totalKm - day.servedKm);
        avgTotalKm += day.totalKm;
    });

    avgServed = avgServed / dayCount;
    avgUnserved = avgUnserved / dayCount;
    avgUtilizedKm = avgUtilizedKm / dayCount;
    avgVacantKm = avgVacantKm / dayCount;
    avgTotalKm = avgTotalKm / dayCount;

    return {
        avgUtilization: calcUtilizationPercent(totals.servedKm, totals.totalKm),
        avgServed: avgServed,
        avgUnserved: avgUnserved,
        avgUtilizedKm: avgUtilizedKm,
        avgVacantKm: avgVacantKm,
        avgTotalKm: avgTotalKm,
        dateSubtitle: UTILIZATION_STATE.filters.journeyDate || 'All dates'
    };
}

function renderUtilizationDashboard() {
    var filterSets = getUtilFilterRows();
    var baseRows = filterSets.baseRows;
    var rows = filterSets.rows;
    var hasFilters = hasActiveUtilizationFilters();
    var selectedDate = UTILIZATION_STATE.filters.journeyDate;

    destroyUtilizationCharts();
    $('#utilNoDataAlert').remove();

    if (!UTILIZATION_STATE.utilizationList.length) {
        setUtilizationChartsVisible(false);
        $('#utilizationSummaryCards,#utilSegmentList').html('');
        return;
    }

    if (!baseRows.length) {
        setUtilizationChartsVisible(false);
        $('#utilizationSummaryCards,#utilSegmentList').html('');
        if (hasFilters) {
            $('#utilizationChartsContainer').append(
                '<div id="utilNoDataAlert" class="alert alert-info text-center">No records found for selected filters.</div>'
            );
        }
        return;
    }

    setUtilizationChartsVisible(true);

    if (rows.length) {
        renderUtilizationSummaryCards(calculateOverallMetrics(rows));
    } else {
        $('#utilizationSummaryCards').html('');
    }

    renderUtilizationTimelineChart(baseRows, selectedDate);
    if (rows.length) {
        var classData = buildClassWiseData(rows);
        var quotaData = buildQuotaWiseData(rows);
        var pairedLayout = buildPairedChartLayout(Math.max(
            (classData.labels || []).length,
            (quotaData.labels || []).length,
            1
        ));
        syncUtilChartWrapHeights('.util-paired-chart-wrap', pairedLayout.chartHeight);
        createUtilChart('classBar', 'utilizationClassChart', buildHorizontalBarConfig(classData, pairedLayout, false));
        createUtilChart('quota', 'utilizationQuotaChart', buildHorizontalBarConfig(quotaData, pairedLayout, true));
    } else {
        destroyUtilChartKeys(['classBar', 'quota']);
    }

    renderSegmentHeatmap(rows);

    var segToShow = resolveSelectedSegment(rows);
    if (segToShow) {
        selectUtilizationSegment(segToShow);
    } else {
        $('#utilDateTrendTitle').text('Date-wise trend — select a segment');
        $('#utilDetailClassTitle').text('Class breakdown');
        $('#utilOdVolumeTitle').text('Avg OD Pair Volume/Day');
        $('#utilLoadCapTitle').text('Consecutive load vs Capacity');
        destroyUtilChartKeys(['segmentTrend', 'detailClass', 'odVolume', 'loadCapacity']);
    }
}

function destroyUtilChartKeys(keys) {
    keys.forEach(function (key) {
        if (UTIL_CHARTS[key]) {
            UTIL_CHARTS[key].destroy();
            UTIL_CHARTS[key] = null;
        }
    });
}

function renderUtilizationTimelineChart(baseRows, selectedDate) {
    var tlBuckets = buildKmBuckets(baseRows, function (row) { return utilJourneyDate(row); });
    var rawLabels = Object.keys(tlBuckets).sort();
    var displayLabels = toUtilChartDisplayLabels(rawLabels);
    var values = rawLabels.map(function (d) { return bucketUtilizationPercent(tlBuckets[d]); });
    var barStyle = getUtilTimelineBarStyle(rawLabels, selectedDate || null);

    syncUtilChartWrapHeights('.util-timeline-chart-wrap', UTIL_TIMELINE_CHART_HEIGHT);
    createUtilChart('time', 'utilizationTimeChart', {
        fixedHeight: UTIL_TIMELINE_CHART_HEIGHT,
        chart: {
            type: 'bar',
            data: {
                labels: displayLabels,
                datasets: [{
                    label: 'Utilization %',
                    data: values,
                    backgroundColor: barStyle.fills,
                    borderColor: barStyle.borders,
                    borderWidth: barStyle.borderWidths,
                    borderRadius: 4,
                    maxBarThickness: 42
                }]
            },
            options: utilChartBaseOptions({
                onClick: function (_evt, elements) {
                    if (!elements || !elements.length) {
                        return;
                    }
                    var clickedDate = rawLabels[elements[0].index] || '';
                    var currentDate = UTILIZATION_STATE.filters.journeyDate;
                    UTILIZATION_STATE.filters.journeyDate = (currentDate === clickedDate) ? '' : clickedDate;
                    $('#utilFilterDate').val(UTILIZATION_STATE.filters.journeyDate);
                    renderUtilizationDashboard();
                },
                plugins: {
                    legend: { display: true },
                    tooltip: {
                        callbacks: {
                            title: function (items) {
                                var idx = items && items.length ? items[0].dataIndex : -1;
                                return idx >= 0 ? (displayLabels[idx] || '') : '';
                            },
                            label: function (ctx) {
                                return ' Utilization: ' + formatPercent(ctx.parsed.y || 0);
                            }
                        }
                    }
                },
                scales: utilVerticalPctScales(displayLabels, true)
            })
        }
    });
}

function renderSegmentHeatmap(rows) {
    var segBuckets = buildKmBuckets(rows, remoteSegmentKey);
    var sortedSegs = Object.keys(segBuckets).filter(Boolean).sort(function (a, b) {
        return segBuckets[b].tKm - segBuckets[a].tKm;
    });

    var html = sortedSegs.map(function (seg) {
        var pct = Math.min(100, bucketUtilizationPercent(segBuckets[seg]));
        var isActive = UTILIZATION_STATE.selectedSeg === seg;
        var barColor = getUtilSegmentBarColor(pct);
        var rowBg = isActive ? '#EFEFED' : 'transparent';
        var rowBorder = isActive ? '1px solid rgba(0,0,0,0.15)' : '1px solid transparent';
        return '<div class="util-segment-item util-segment-clickable' + (isActive ? ' util-segment-active' : '') + '" data-seg="' + escapeHtmlAttr(seg) + '" style="cursor:pointer;padding:6px;border-radius:4px;background:' + rowBg + ';border:' + rowBorder + ';">'
            + '<div class="util-segment-name">' + escapeHtml(seg) + '</div>'
            + '<div class="util-segment-bar-wrap">'
            + '<div class="util-segment-bar" style="width:' + pct + '%;background:' + barColor + ';"></div></div>'
            + '<div class="util-segment-pct">' + formatPercent(pct) + '</div>'
            + '</div>';
    }).join('');

    $('#utilSegmentList').html(html || '<div class="text-muted">No segment data available.</div>');

    $('#utilSegmentList').off('click.utilSeg').on('click.utilSeg', '.util-segment-clickable', function () {
        selectUtilizationSegment($(this).attr('data-seg'));
    });

    syncUtilAllButtonState();
}

function syncUtilAllButtonState() {
    var $btn = $('#utilSegAllBtn');
    if (!$btn.length) {
        return;
    }
    $btn.toggleClass('active', isAllSegmentsSelected());
    $btn.off('click.utilAll').on('click.utilAll', function () {
        selectUtilizationSegment(UTIL_ALL_SEGMENTS);
    });
}

function selectUtilizationSegment(segName) {
    UTILIZATION_STATE.selectedSeg = segName;
    var displayLabel = getSegmentDisplayLabel(segName);
    $('#utilSegSelectHint').text('(' + displayLabel + ')');
    syncUtilAllButtonState();

    var f = UTILIZATION_STATE.filters;
    var baseSegData = filterRowsForSegment(segName);
    var activeSegData = f.journeyDate
        ? baseSegData.filter(function (r) { return utilJourneyDate(r) === f.journeyDate; })
        : baseSegData;

    var tBuckets = buildKmBuckets(baseSegData, function (row) { return utilJourneyDate(row); });
    var tRawLabels = Object.keys(tBuckets).sort();
    var tDisplayLabels = toUtilChartDisplayLabels(tRawLabels);
    var tValues = tRawLabels.map(function (d) { return bucketUtilizationPercent(tBuckets[d]); });

    $('#utilDateTrendTitle').text('Date-wise trend — ' + displayLabel);
    createUtilChart('segmentTrend', 'utilSegmentTrendChart', buildLineChartConfig({
        labels: tDisplayLabels,
        values: tValues
    }, 'seg-trend'));

    var classB = buildKmBuckets(activeSegData, function (row) { return String(row.CLASS || '').trim() || '-'; });
    var cLabels = Object.keys(classB).sort();
    var cValues = cLabels.map(function (c) { return bucketUtilizationPercent(classB[c]); });
    var dateSuffix = f.journeyDate ? ' (' + f.journeyDate + ')' : '';

    $('#utilDetailClassTitle').text('Class breakdown — ' + displayLabel + dateSuffix);

    // Consecutive adjacent station pairs (1→2, 2→3, 3→4...) so labels never skip hops.
    var hopSeries = buildConsecutiveHopSeries(segName, activeSegData, f);
    var odLabels = hopSeries.labels;
    var odVals = hopSeries.avgVols;
    var classLayout = buildPairedChartLayout(Math.max(cLabels.length, 1));
    var odLayout = {
        chartHeight: UTIL_PAIRED_CHART_HEIGHT,
        fixed: true,
        barPercentage: 0.9,
        categoryPercentage: 0.95,
        bottomPad: UTIL_HOP_LABEL_BOTTOM_PAD
    };
    $('#utilDetailClassChart').closest('.util-chart-wrap').css('height', classLayout.chartHeight + 'px');
    sizeUtilScrollChart('#utilOdVolumeWrap', odLabels.length, UTIL_PAIRED_CHART_HEIGHT, UTIL_OD_SLOT_PX);

    createUtilChart('detailClass', 'utilDetailClassChart', buildVerticalBarConfig({
        labels: cLabels,
        values: cValues
    }, 'Utilization %', true, '#1f77b4', classLayout));

    $('#utilOdVolumeTitle').text('Avg OD Pair Volume/Day — ' + displayLabel + dateSuffix);
    createUtilChart('odVolume', 'utilOdVolumeChart', buildVerticalBarConfig({
        labels: odLabels,
        values: odVals
    }, 'Avg Seats/Day', false, '#D97706', odLayout));

    renderConsecutiveLoadChart(segName, activeSegData, f, dateSuffix, hopSeries);
    renderSegmentHeatmap(getUtilFilterRows().rows);

    // Re-measure after layout so wide charts scroll inside the card instead of expanding the page.
    window.requestAnimationFrame(function () {
        sizeUtilScrollChart('#utilOdVolumeWrap', odLabels.length, UTIL_PAIRED_CHART_HEIGHT, UTIL_OD_SLOT_PX);
        sizeUtilScrollChart('#utilLoadCapacityWrap', (hopSeries.labels || []).length, UTIL_SCROLL_CHART_HEIGHT, UTIL_LOAD_SLOT_PX);
        if (UTIL_CHARTS.odVolume && typeof UTIL_CHARTS.odVolume.resize === 'function') {
            UTIL_CHARTS.odVolume.resize();
        }
        if (UTIL_CHARTS.loadCapacity && typeof UTIL_CHARTS.loadCapacity.resize === 'function') {
            UTIL_CHARTS.loadCapacity.resize();
        }
    });
}

function getSegmentIndexRange(segName, stnSeq) {
    if (!stnSeq || !stnSeq.length) {
        return { srcIdx: -1, dstIdx: -1 };
    }
    if (isAllSegmentsSelected(segName)) {
        return { srcIdx: 0, dstIdx: stnSeq.length - 1 };
    }
    var parts = String(segName || '').split('\u2192');
    return {
        srcIdx: stnSeq.indexOf(parts[0]),
        dstIdx: stnSeq.indexOf(parts[1])
    };
}

function buildAdjacentHopShell(stnSeq, srcIdx, dstIdx) {
    var hops = [];
    var i;
    if (srcIdx < 0 || dstIdx < 0 || srcIdx >= dstIdx) {
        return hops;
    }
    for (i = srcIdx; i < dstIdx; i++) {
        hops.push({
            start: stnSeq[i],
            end: stnSeq[i + 1],
            startIdx: i,
            endIdx: i + 1,
            label: stnSeq[i] + '\u2192' + stnSeq[i + 1],
            vol: 0
        });
    }
    return hops;
}

function buildConsecutiveHopSeries(segName, activeSegData, filters) {
    var stnSeq = UTILIZATION_STATE.route || [];
    var allSegs = isAllSegmentsSelected(segName);
    var range = getSegmentIndexRange(segName, stnSeq);
    var hops = buildAdjacentHopShell(stnSeq, range.srcIdx, range.dstIdx);
    var uniqueDays = {};
    var totalCapacity = 0;
    var capacityByKey = {};

    activeSegData.forEach(function (r) {
        var d = utilJourneyDate(r);
        if (d) {
            uniqueDays[d] = 1;
        }

        var cap = toNumber(r.CAPACITY);
        if (allSegs) {
            var capKey = d + '|' + String(r.CLASS || '').trim() + '|' + String(r.QUOTA || '').trim();
            if (!capacityByKey[capKey] || cap > capacityByKey[capKey]) {
                capacityByKey[capKey] = cap;
            }
        } else {
            totalCapacity += cap;
        }

        var rowSrcIdx = range.srcIdx;
        var rowDstIdx = range.dstIdx;
        if (allSegs) {
            var rowSeg = remoteSegmentKey(r);
            var rowParts = rowSeg.split('\u2192');
            rowSrcIdx = stnSeq.indexOf(rowParts[0]);
            rowDstIdx = stnSeq.indexOf(rowParts[1]);
            if (rowSrcIdx === -1 || rowDstIdx === -1 || rowSrcIdx >= rowDstIdx) {
                return;
            }
        }

        (r.ALLOCATIONS || []).forEach(function (a) {
            var fMatch = !filters.sourceVal || String(a.FROM_STN || '').trim() === filters.sourceVal;
            var tMatch = !filters.destinationVal || String(a.TO_STN || '').trim() === filters.destinationVal;
            if (!fMatch || !tMatch) {
                return;
            }
            var odSrcIdx = stnSeq.indexOf(String(a.FROM_STN || '').trim());
            var odDstIdx = stnSeq.indexOf(String(a.TO_STN || '').trim());
            var allocVol = toNumber(a.ALLOCATED);
            if (odSrcIdx === -1 || odDstIdx === -1 || odSrcIdx >= odDstIdx) {
                return;
            }
            hops.forEach(function (hop) {
                if (hop.startIdx < rowSrcIdx || hop.endIdx > rowDstIdx) {
                    return;
                }
                if (odSrcIdx <= hop.startIdx && odDstIdx >= hop.endIdx) {
                    hop.vol += allocVol;
                }
            });
        });
    });

    if (allSegs) {
        Object.keys(capacityByKey).forEach(function (key) {
            totalCapacity += capacityByKey[key];
        });
    }

    var daysCount = Object.keys(uniqueDays).length || 1;
    return {
        hops: hops,
        labels: hops.map(function (h) { return h.label; }),
        avgVols: hops.map(function (h) { return Math.round(h.vol / daysCount); }),
        daysCount: daysCount,
        avgCapPerDay: Math.round(totalCapacity / daysCount),
        loadLabel: allSegs ? 'Full route' : segName
    };
}

function sizeUtilScrollChart(wrapSelector, labelCount, chartHeight, slotPx) {
    var $inner = $(wrapSelector);
    if (!$inner.length) {
        return;
    }
    var height = chartHeight || UTIL_SCROLL_CHART_HEIGHT;
    var slot = slotPx || UTIL_OD_SLOT_PX;
    var $outer = $inner.closest('.util-scroll-chart-outer');
    var $card = $inner.closest('.utilization-chart-card');

    // Keep outer inside the card width so a wide inner chart scrolls instead of expanding the layout.
    if ($outer.length) {
        $outer.css({
            width: '100%',
            maxWidth: '100%',
            minWidth: 0,
            // Extra outer height so the horizontal scrollbar does not cover x-axis labels.
            height: (height + UTIL_SCROLL_BAR_GUTTER) + 'px',
            maxHeight: (height + UTIL_SCROLL_BAR_GUTTER) + 'px',
            overflowX: 'auto',
            overflowY: 'hidden'
        });
    }
    if ($card.length) {
        $card.css({ minWidth: 0, maxWidth: '100%', overflow: 'hidden' });
    }

    var available = 0;
    if ($outer.length && $outer[0].clientWidth) {
        available = $outer[0].clientWidth;
    } else if ($card.length && $card[0].clientWidth) {
        available = Math.max(0, $card[0].clientWidth - 40);
    }
    if (!available) {
        available = 360;
    }

    var count = Math.max(labelCount || 1, 1);
    var needed = count * slot;
    // Few stations: fill full card width. Many stations: expand past card and scroll.
    var innerWidth = Math.max(needed, available);

    $inner.css({
        height: height + 'px',
        width: innerWidth + 'px',
        minWidth: innerWidth + 'px',
        maxWidth: 'none',
        position: 'relative',
        boxSizing: 'border-box'
    });
}

function renderConsecutiveLoadChart(segName, activeSegData, filters, dateSuffix, hopSeries) {
    var series = hopSeries || buildConsecutiveHopSeries(segName, activeSegData, filters);
    var hopLabels = series.labels || [];
    var hopVals = series.avgVols || [];
    var avgCapPerDay = series.avgCapPerDay || 0;
    var loadLabel = series.loadLabel || getSegmentDisplayLabel(segName);

    $('#utilLoadCapTitle').text('Consecutive load vs Capacity — ' + loadLabel + dateSuffix);

    if (!hopLabels.length) {
        destroyUtilChartKeys(['loadCapacity']);
        return;
    }

    sizeUtilScrollChart('#utilLoadCapacityWrap', hopLabels.length, UTIL_SCROLL_CHART_HEIGHT, UTIL_LOAD_SLOT_PX);

    var loadColor = UTIL_PURPLE;
    var capColor = UTIL_ALERT;

    createUtilChart('loadCapacity', 'utilLoadCapacityChart', {
        fixedHeight: UTIL_SCROLL_CHART_HEIGHT,
        chart: {
            type: 'line',
            data: {
                labels: hopLabels,
                datasets: [{
                    label: 'Avg Load/Day',
                    data: hopVals,
                    borderColor: loadColor,
                    backgroundColor: getUtilHexFill(loadColor, '18'),
                    pointBackgroundColor: loadColor,
                    pointBorderColor: '#fff',
                    pointRadius: 2.5,
                    pointHoverRadius: 4,
                    borderWidth: 1.5,
                    fill: true,
                    tension: 0.15
                }, {
                    label: 'Avg Capacity/Day',
                    data: hopLabels.map(function () { return avgCapPerDay; }),
                    borderColor: capColor,
                    backgroundColor: 'transparent',
                    borderDash: [5, 5],
                    pointRadius: 0,
                    borderWidth: 1.5,
                    fill: false
                }]
            },
            options: utilChartBaseOptions({
                layout: {
                    padding: { bottom: UTIL_HOP_LABEL_BOTTOM_PAD, top: 4, left: 2, right: 8 }
                },
                plugins: { legend: { display: true } },
                scales: {
                    x: {
                        grid: { color: 'rgba(0,0,0,0.04)' },
                        ticks: {
                            color: '#666',
                            maxRotation: 45,
                            minRotation: 45,
                            autoSkip: false,
                            padding: 6,
                            callback: function (_val, index) {
                                return hopLabels[index] || '';
                            }
                        }
                    },
                    y: {
                        beginAtZero: true,
                        grid: { color: '#f0f0f0' },
                        ticks: { color: '#666' }
                    }
                }
            })
        }
    });
}

window.selectUtilizationSegment = selectUtilizationSegment;

function renderUtilizationSummaryCards(metrics) {
    var html = ''
        + summaryCardHtml('AVG KM UTILIZATION', formatPercent(metrics.avgUtilization), 'util-value-green', metrics.dateSubtitle)
        + summaryCardHtml(
            'AVG BERTHS/DAY (SERVED/UNSERVED)',
            formatNumber(metrics.avgServed) + ' / ' + formatNumber(metrics.avgUnserved),
            'util-value-dark',
            ''
        )
        + summaryCardHtml('AVG UTILIZED KM / DAY', formatNumber(metrics.avgUtilizedKm), 'util-value-green', '')
        + summaryCardHtml('AVG VACANT KM / DAY', formatNumber(metrics.avgVacantKm), 'util-value-red', '')
        + summaryCardHtml('AVG TOTAL KM / DAY', formatNumber(metrics.avgTotalKm), 'util-value-dark', '');

    $('#utilizationSummaryCards').html(html);
}

function summaryCardHtml(label, value, valueClass, subText) {
    return ''
        + '<div class="utilization-summary-card">'
        + '  <div class="utilization-summary-label">' + escapeHtml(label) + '</div>'
        + '  <div class="utilization-summary-value ' + valueClass + '">' + escapeHtml(value) + '</div>'
        + (subText ? '<div class="utilization-summary-sub">' + escapeHtml(subText) + '</div>' : '')
        + '</div>';
}

function createUtilChart(key, canvasId, config) {
    var canvas = document.getElementById(canvasId);
    if (!canvas || !window.Chart || !config) {
        return;
    }
    if (UTIL_CHARTS[key]) {
        UTIL_CHARTS[key].destroy();
        UTIL_CHARTS[key] = null;
    }
    if (config.fixedHeight && canvas.parentElement) {
        canvas.parentElement.style.height = config.fixedHeight + 'px';
    } else if (config.dynamicHeight && canvas.parentElement) {
        canvas.parentElement.style.height = Math.max(config.dynamicHeight, config.minHeight || 200) + 'px';
    }
    UTIL_CHARTS[key] = new Chart(canvas, config.chart);
}

function utilChartBaseOptions(extra) {
    var options = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: {
                display: true,
                position: 'top',
                labels: { boxWidth: 12, color: UTIL_COLORS.tick, font: { size: 11 }, padding: 14 }
            },
            tooltip: { enabled: true }
        },
        onHover: function (evt, elements) {
            if (evt.native && evt.native.target) {
                evt.native.target.style.cursor = elements.length ? 'pointer' : 'default';
            }
        }
    };
    return $.extend(true, options, extra || {});
}

function buildBarChartConfig(series, horizontal, color, onClick) {
    var labels = series.labels || [];
    return {
        minHeight: horizontal ? 200 : 320,
        chart: {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Utilization %',
                    data: series.values || [],
                    backgroundColor: color || UTIL_BLUE,
                    borderColor: 'transparent',
                    borderWidth: 0,
                    borderRadius: 4,
                    maxBarThickness: horizontal ? 16 : 42
                }]
            },
            options: utilChartBaseOptions({
                onClick: onClick,
                plugins: {
                    legend: { display: !horizontal },
                    tooltip: {
                        callbacks: {
                            label: function (ctx) {
                                return ' Utilization: ' + formatPercent(ctx.parsed[horizontal ? 'x' : 'y'] || 0);
                            }
                        }
                    }
                },
                scales: horizontal ? utilHorizontalPctScales(labels) : utilVerticalPctScales(labels, true)
            })
        }
    };
}

function calcHorizontalBarLayout(labelCount) {
    var n = Math.max(labelCount, 1);
    var slotHeight;

    if (n <= 3) {
        slotHeight = 54;
    } else if (n <= 6) {
        slotHeight = 40;
    } else if (n <= 10) {
        slotHeight = 32;
    } else {
        slotHeight = 26;
    }

    return {
        chartHeight: Math.max(150, Math.min(520, n * slotHeight + 52)),
        maxBarThickness: Math.max(18, Math.min(48, Math.floor(slotHeight * 0.78))),
        categoryPercentage: n <= 4 ? 0.7 : (n <= 10 ? 0.88 : 0.94),
        barPercentage: 0.82
    };
}

function calcVerticalBarLayout(labelCount) {
    var n = Math.max(labelCount, 1);
    var slotHeight = n <= 4 ? 46 : (n <= 8 ? 34 : 28);

    return {
        chartHeight: Math.max(180, Math.min(420, n * slotHeight + 56)),
        maxBarThickness: Math.max(16, Math.min(42, Math.floor(slotHeight * 0.75))),
        categoryPercentage: n <= 4 ? 0.65 : 0.85,
        barPercentage: 0.8
    };
}

function addOpacity(hex, alpha) {
    return hex + alpha;
}

function buildHorizontalBarConfig(series, layoutOpts, isQuotaChart) {
    var labels = series.labels || [];
    var color = '#1f77b4';
    var layout = layoutOpts || calcHorizontalBarLayout(labels.length);
    var useFixed = layout && layout.fixed;

    return {
        fixedHeight: useFixed ? layout.chartHeight : undefined,
        dynamicHeight: useFixed ? undefined : layout.chartHeight,
        chart: {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Utilization %',
                    data: series.values || [],
                     backgroundColor: function (ctx) {
                        var barColor = isQuotaChart
                            ? hashColor(labels[ctx.dataIndex])
                            : color;

                        return addOpacity(barColor, '50');
                    },
                    borderColor: function (ctx) {
                        return isQuotaChart
                            ? hashColor(labels[ctx.dataIndex])
                            : color;
                    },
                    borderWidth: 1,
                    borderRadius: 4,
                    barPercentage: layout.barPercentage,
                    categoryPercentage: layout.categoryPercentage
                }]
            },
            options: utilChartBaseOptions({
                indexAxis: 'y',
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        callbacks: {
                            label: function (ctx) {
                                return ' ' + (labels[ctx.dataIndex] || '') + ': ' + formatPercent(ctx.parsed.x || 0);
                            }
                        }
                    }
                },
                scales: utilHorizontalPctScales(labels)
            })
        }
    };
}

function buildVerticalBarConfig(series, datasetLabel, isPercent, accentColor, layoutOpts) {
    var labels = series.labels || [];
    var color = accentColor;
    var layout = layoutOpts || calcVerticalBarLayout(labels.length);
    var useFixed = layout && layout.fixed;

    return {
        fixedHeight: useFixed ? layout.chartHeight : undefined,
        dynamicHeight: useFixed ? undefined : layout.chartHeight,
        chart: {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [{
                    label: datasetLabel || 'Utilization %',
                    data: series.values || [],
                    backgroundColor: addOpacity(color, '50'),
                    borderColor: color,
                    borderWidth: 1,
                    borderRadius: 4,
                    barPercentage: layout.barPercentage,
                    categoryPercentage: layout.categoryPercentage
                }]
            },
            options: utilChartBaseOptions({
                layout: {
                    padding: {
                        bottom: (layout && layout.bottomPad) || 4,
                        top: 4,
                        left: 2,
                        right: 4
                    }
                },
                plugins: {
                    legend: { display: true },
                    tooltip: {
                        callbacks: {
                            label: function (ctx) {
                                var val = ctx.parsed.y || 0;
                                return ' ' + (isPercent === false ? formatNumber(val) : formatPercent(val));
                            }
                        }
                    }
                },
                scales: isPercent === false
                    ? utilVerticalNumberScales(labels)
                    : utilVerticalPctScales(labels, true)
            })
        }
    };
}

function buildLineChartConfig(series, colorKey) {
    var labels = series.labels || [];
    var lineColor = colorKey === 'od'
        ? UTIL_AMBER
        : (colorKey === 'seg-trend' ? UTIL_GREEN : getUtilChartColor(colorKey || 'util-trend'));
    return {
        chart: {
            type: 'line',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Utilization %',
                    data: series.values || [],
                    borderColor: lineColor,
                    backgroundColor: getUtilHexFill(lineColor, '10'),
                    pointBackgroundColor: lineColor,
                    pointBorderColor: '#fff',
                    pointRadius: 3,
                    pointHoverRadius: 5,
                    borderWidth: 2,
                    fill: true,
                    tension: 0.3
                }]
            },
            options: utilChartBaseOptions({
                plugins: {
                    legend: { display: true },
                    tooltip: {
                        callbacks: {
                            label: function (ctx) {
                                return ' Utilization: ' + formatPercent(ctx.parsed.y || 0);
                            }
                        }
                    }
                },
                scales: utilVerticalPctScales(labels, true)
            })
        }
    };
}

function utilHorizontalPctScales(categoryLabels) {
    return {
        x: {
            type: 'linear',
            min: 0,
            max: 100,
            beginAtZero: true,
            grid: { color: UTIL_COLORS.grid, drawBorder: false },
            ticks: {
                color: UTIL_COLORS.tick,
                font: { size: 10 },
                callback: function (v) { return v + '%'; }
            }
        },
        y: {
            type: 'category',
            labels: categoryLabels,
            grid: { display: false, drawBorder: false },
            ticks: {
                color: UTIL_COLORS.tick,
                font: { size: 10 },
                autoSkip: false,
                callback: function (_val, index) {
                    return categoryLabels[index] || '';
                }
            }
        }
    };
}

function utilVerticalPctScales(categoryLabels, rotateX) {
    return {
        x: {
            type: 'category',
            labels: categoryLabels,
            grid: { color: UTIL_COLORS.grid, drawBorder: false },
            ticks: {
                color: UTIL_COLORS.tick,
                font: { size: 10 },
                autoSkip: false,
                maxRotation: rotateX ? 45 : 0,
                minRotation: rotateX ? 45 : 0,
                callback: function (_val, index) {
                    return categoryLabels[index] || '';
                }
            }
        },
        y: {
            type: 'linear',
            min: 0,
            max: 100,
            beginAtZero: true,
            grid: { color: UTIL_COLORS.grid, drawBorder: false },
            ticks: {
                color: UTIL_COLORS.tick,
                font: { size: 10 },
                callback: function (v) { return v + '%'; }
            }
        }
    };
}

function utilVerticalNumberScales(categoryLabels) {
    var xTicks = {
        color: UTIL_COLORS.tick,
        font: { size: 10 },
        maxRotation: 45,
        minRotation: 45,
        autoSkip: false,
        padding: 6
    };
    if (categoryLabels && categoryLabels.length) {
        xTicks.callback = function (_val, index) {
            return categoryLabels[index] || '';
        };
    }
    return {
        x: {
            type: 'category',
            labels: categoryLabels && categoryLabels.length ? categoryLabels : undefined,
            grid: { color: UTIL_COLORS.grid, drawBorder: false },
            ticks: xTicks
        },
        y: {
            beginAtZero: true,
            grid: { color: UTIL_COLORS.grid, drawBorder: false },
            ticks: { color: UTIL_COLORS.tick, font: { size: 10 } }
        }
    };
}

function destroyUtilizationCharts() {
    Object.keys(UTIL_CHARTS).forEach(function (key) {
        if (UTIL_CHARTS[key]) {
            UTIL_CHARTS[key].destroy();
            UTIL_CHARTS[key] = null;
        }
    });
}

function resetUtilizationDashboard() {
    destroyUtilizationCharts();
    utilizationDashboardBuilt = false;
    UTILIZATION_STATE.route = [];
    UTILIZATION_STATE.utilizationList = [];
    UTILIZATION_STATE.selectedSeg = null;
    UTILIZATION_STATE.filters = {
        classVal: '',
        quotaVal: '',
        journeyDate: '',
        sourceVal: '',
        destinationVal: ''
    };
    resetUtilPaletteColors();
    $('#utilizationChartsContainer').empty();
}

window.resetUtilizationDashboard = resetUtilizationDashboard;

function formatPercent(value) {
    var num = Number(value);
    if (isNaN(num)) {
        return '0%';
    }
    return (Math.round(num * 100) / 100).toFixed(2) + '%';
}

function formatNumber(value) {
    var num = Number(value);
    if (isNaN(num)) {
        return '0';
    }
    return Math.round(num).toLocaleString('en-IN');
}

function escapeHtml(text) {
    return String(text == null ? '' : text)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function escapeHtmlAttr(text) {
    return escapeHtml(text).replace(/`/g, '&#96;');
}

