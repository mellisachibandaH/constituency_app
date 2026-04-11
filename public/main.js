// ================= CONFIG =================
const DATA_PATH = '/data';

// ================= ALL RAW DATA (loaded once) =================
const RAW = {
    ward:         null,
    health:       null,
    healthBuffer: null,
    roads:        null,
    settlements:  null,
    water:        null,
    school:       null,
};

const GJ_FORMAT = new ol.format.GeoJSON();

function featuresFrom(raw) {
    if (!raw) return [];
    return GJ_FORMAT.readFeatures(raw, { featureProjection: 'EPSG:3857' });
}

function filteredFeatures(raw) {
    if (!raw) return [];
    const p = elProv  ? elProv.value  : '';
    const c = elConst ? elConst.value : '';
    const w = elWard  ? elWard.value  : '';
    return GJ_FORMAT.readFeatures(raw, { featureProjection: 'EPSG:3857' }).filter(f => {
        if (p && f.get('province')   !== p)                     return false;
        if (c && f.get('constituen') !== c)                     return false;
        if (w && String(f.get('wardnumber')) !== String(w))     return false;
        return true;
    });
}

function reloadSource(source, raw, applyFilter) {
    source.clear();
    const features = applyFilter ? filteredFeatures(raw) : featuresFrom(raw);
    source.addFeatures(features);
}

// ================= ANALYTICS HELPERS =================

function getLocationLabel() {
    if (elWard && elWard.value)   return `Ward ${elWard.value}`;
    if (elConst && elConst.value) return elConst.value;
    if (elProv && elProv.value)   return elProv.value;
    return 'the selected area';
}

function avg(arr) {
    if (!arr.length) return 0;
    return arr.reduce((a, b) => a + b, 0) / arr.length;
}

function max(arr) { return arr.length ? Math.max(...arr) : 0; }
function min(arr) { return arr.length ? Math.min(...arr) : 0; }
function sum(arr) { return arr.reduce((a, b) => a + b, 0); }

function pct(part, total) {
    if (!total) return 0;
    return ((part / total) * 100).toFixed(1);
}

// Render an analytics block: summary paragraph + bullet recommendations
function renderAnalytics(containerId, summaryHTML, recommendations) {
    const el = document.getElementById(containerId);
    if (!el) return;
    const recItems = recommendations.map(r => `<li>${r}</li>`).join('');
    el.innerHTML = `
        <div class="analytics-box">
            <div class="analytics-summary">${summaryHTML}</div>
            ${recommendations.length ? `
            <div class="analytics-recommendations">
                <strong>&#128204; Recommendations</strong>
                <ul>${recItems}</ul>
            </div>` : ''}
        </div>`;
}

// Inject analytics CSS once
(function injectAnalyticsCSS() {
    if (document.getElementById('analytics-style')) return;
    const style = document.createElement('style');
    style.id = 'analytics-style';
    style.textContent = `
        .analytics-box {
            background: #f9f9f9;
            border-left: 4px solid #3182bd;
            border-radius: 4px;
            padding: 12px 16px;
            margin: 12px 0 6px 0;
            font-family: Calibri, sans-serif;
            font-size: 14px;
            line-height: 1.6;
        }
        .analytics-summary { margin-bottom: 10px; color: #222; }
        .analytics-summary b { color: #1a1a1a; }
        .analytics-highlight-good  { color: #1a7a3a; font-weight: bold; }
        .analytics-highlight-warn  { color: #b85c00; font-weight: bold; }
        .analytics-highlight-bad   { color: #c0392b; font-weight: bold; }
        .analytics-recommendations { margin-top: 8px; }
        .analytics-recommendations ul {
            margin: 6px 0 0 0;
            padding-left: 18px;
        }
        .analytics-recommendations li { margin-bottom: 4px; color: #333; }
    `;
    document.head.appendChild(style);
})();

function flag(value, goodBelow, warnBelow) {
    if (value <= goodBelow) return 'analytics-highlight-good';
    if (value <= warnBelow) return 'analytics-highlight-warn';
    return 'analytics-highlight-bad';
}
function flagHigh(value, goodAbove, warnAbove) {
    if (value >= goodAbove) return 'analytics-highlight-good';
    if (value >= warnAbove) return 'analytics-highlight-warn';
    return 'analytics-highlight-bad';
}

// ================= OVERVIEW ANALYTICS =================
function updateOverviewAnalytics() {
    const features = wardVectorSource.getFeatures();
    const loc = getLocationLabel();
    const containerId = 'analytics-overview';
    if (!features.length) {
        renderAnalytics(containerId, `<p>Select a province, constituency or ward to see an overview summary.</p>`, []);
        return;
    }

    const totalPop  = sum(features.map(f => f.get('total_popu') || 0));
    const numWards  = features.length;
    const avgPop    = (totalPop / numWards).toFixed(0);
    const poorPrev  = features.map(f => f.get('poverty_pr') || 0);
    const avgPoverty = avg(poorPrev).toFixed(1);
    const maxPovWard = features.reduce((a, b) => (b.get('poverty_pr') || 0) > (a.get('poverty_pr') || 0) ? b : a);
    const maxPovName = `Ward ${maxPovWard.get('wardnumber') || '?'}`;
    const maxPovVal  = (maxPovWard.get('poverty_pr') || 0).toFixed(1);

    const povClass = flag(parseFloat(avgPoverty), 25, 45);

    const summary = `
        <p><b>${loc}</b> comprises <b>${numWards} ward(s)</b> with a total population of 
        <b>${totalPop.toLocaleString()}</b> (average <b>${parseInt(avgPop).toLocaleString()}</b> per ward).
        The average poverty prevalence across all wards is 
        <span class="${povClass}">${avgPoverty}%</span>.
        ${numWards > 1 ? `The ward with the highest poverty burden is <b>${maxPovName}</b> at <span class="analytics-highlight-bad">${maxPovVal}%</span>.` : ''}
        </p>`;

    const recs = [];
    if (parseFloat(avgPoverty) > 45) recs.push(`Poverty prevalence in ${loc} is critically high. Prioritise targeted social protection programmes and livelihood support.`);
    else if (parseFloat(avgPoverty) > 25) recs.push(`Poverty levels in ${loc} are moderate. Strengthen existing safety nets and monitor trends closely.`);
    if (numWards > 1) recs.push(`Focus resources on ${maxPovName}, which carries the highest poverty burden in this area.`);
    if (totalPop > 10000) recs.push(`With a population exceeding ${totalPop.toLocaleString()}, ensure service delivery infrastructure keeps pace with population size.`);

    renderAnalytics(containerId, summary, recs);
}

// ================= DEMOGRAPHY ANALYTICS =================
function updateDemographyAnalytics() {
    const features = wardVectorSource.getFeatures();
    const loc = getLocationLabel();
    const containerId = 'analytics-demography';
    if (!features.length) { renderAnalytics(containerId, '<p>No data available for the selected area.</p>', []); return; }

    const totalPop = sum(features.map(f => f.get('total_popu') || 0));
    const total014 = sum(features.map(f => (f.get('m_0_14') || 0) + (f.get('f_0_14') || 0)));
    const total1564= sum(features.map(f => (f.get('m_15_64')|| 0) + (f.get('f_15_64')|| 0)));
    const total65  = sum(features.map(f => (f.get('m_65')   || 0) + (f.get('f_65')   || 0)));
    const totalMale= sum(features.map(f => (f.get('m_0_14') || 0) + (f.get('m_15_64')|| 0) + (f.get('m_65') || 0)));
    const totalFem = totalPop - totalMale;

    const pct014  = pct(total014,  totalPop);
    const pct1564 = pct(total1564, totalPop);
    const pct65   = pct(total65,   totalPop);
    const pctMale = pct(totalMale, totalPop);
    const pctFem  = pct(totalFem,  totalPop);

    const youthClass  = parseFloat(pct014)  > 45 ? 'analytics-highlight-warn' : 'analytics-highlight-good';
    const elderClass  = parseFloat(pct65)   > 10 ? 'analytics-highlight-warn' : 'analytics-highlight-good';

    const summary = `
        <p><b>${loc}</b> has a total population of <b>${totalPop.toLocaleString()}</b> 
        (${pctMale}% male, ${pctFem}% female).
        Children aged 0–14 make up <span class="${youthClass}">${pct014}%</span> of the population,
        the working-age group (15–64) accounts for <b>${pct1564}%</b>,
        and adults aged 65+ represent <span class="${elderClass}">${pct65}%</span>.
        ${parseFloat(pct014) > 45 ? 'The high proportion of children signals strong demand for education and child health services.' : ''}
        ${parseFloat(pct1564) > 55 ? 'A large working-age population presents opportunities for economic productivity if employment and skills are supported.' : ''}
        </p>`;

    const recs = [];
    if (parseFloat(pct014) > 45) recs.push(`High youth proportion (${pct014}%) — invest in schools, early childhood development centres and paediatric health services.`);
    if (parseFloat(pct65) > 10)  recs.push(`Ageing population segment (${pct65}%) — expand geriatric health services and social pension coverage.`);
    if (parseFloat(pctFem) > 52) recs.push(`Female majority — ensure gender-responsive programming in health, education and economic empowerment.`);
    if (parseFloat(pct1564) > 55) recs.push(`Large working-age cohort — prioritise vocational training, job creation and entrepreneurship support.`);

    renderAnalytics(containerId, summary, recs);
}

// ================= WELFARE ANALYTICS =================
function updateWelfareAnalytics() {
    const features = wardVectorSource.getFeatures();
    const loc = getLocationLabel();
    const containerId = 'analytics-welfare';
    if (!features.length) { renderAnalytics(containerId, '<p>No data available for the selected area.</p>', []); return; }

    const prevVals = features.map(f => f.get('poverty_pr') || 0);
    const gapVals  = features.map(f => f.get('poverty_ga') || 0);
    const poorVals = features.map(f => f.get('poor')       || 0);
    const nonPoorVals = features.map(f => f.get('none_poor') || 0);

    const avgPrev  = avg(prevVals).toFixed(1);
    const avgGap   = avg(gapVals).toFixed(1);
    const totalPoor    = sum(poorVals);
    const totalNonPoor = sum(nonPoorVals);
    const totalPop     = totalPoor + totalNonPoor;
    const pctPoor      = pct(totalPoor, totalPop);

    const worstWard = features.reduce((a, b) => (b.get('poverty_pr') || 0) > (a.get('poverty_pr') || 0) ? b : a);
    const bestWard  = features.reduce((a, b) => (b.get('poverty_pr') || 0) < (a.get('poverty_pr') || 0) ? b : a);

    const prevClass = flag(parseFloat(avgPrev), 25, 45);
    const gapClass  = flag(parseFloat(avgGap),  5, 8);

    const summary = `
        <p>In <b>${loc}</b>, approximately <span class="${prevClass}">${pctPoor}%</span> of the population 
        (<b>${totalPoor.toLocaleString()}</b> people) live below the poverty line.
        The average poverty prevalence is <span class="${prevClass}">${avgPrev}%</span> 
        and the poverty gap index stands at <span class="${gapClass}">${avgGap}</span> — 
        ${parseFloat(avgGap) > 8 ? 'indicating that poor households are <b>severely below</b> the poverty line, not just marginally poor.' :
          parseFloat(avgGap) > 5 ? 'indicating a <b>moderate depth</b> of poverty among affected households.' :
          'suggesting poor households are <b>relatively close</b> to the poverty line.'}
        ${features.length > 1 ? `The most deprived ward is <b>Ward ${worstWard.get('wardnumber') || '?'}</b> 
        (${(worstWard.get('poverty_pr') || 0).toFixed(1)}% prevalence) while 
        <b>Ward ${bestWard.get('wardnumber') || '?'}</b> performs best 
        (${(bestWard.get('poverty_pr') || 0).toFixed(1)}%).` : ''}
        </p>`;

    const recs = [];
    if (parseFloat(avgPrev) > 45) recs.push(`Critical poverty levels — scale up cash transfer programmes and food security interventions immediately.`);
    else if (parseFloat(avgPrev) > 25) recs.push(`Moderate poverty — expand livelihood support, microfinance access and market linkages for low-income households.`);
    if (parseFloat(avgGap) > 8) recs.push(`High poverty gap index (${avgGap}) indicates extreme deprivation — increase the value of social transfers to lift households further above the poverty line.`);
    if (features.length > 1) recs.push(`Target resources to Ward ${worstWard.get('wardnumber') || '?'} which has the highest poverty burden in this area.`);
    recs.push(`Integrate poverty data with health, education and water access data to identify households facing multiple deprivations simultaneously.`);

    renderAnalytics(containerId, summary, recs);
}

// ================= HEALTH ANALYTICS =================
function updateHealthAnalytics() {
    const loc = getLocationLabel();
    const containerId = 'analytics-health';

    const healthFeatures = healthVectorSource.getFeatures();
    const settFeatures   = settlementsVectorSource.getFeatures();

    if (!healthFeatures.length) {
        renderAnalytics(containerId, `<p>No health facility data available for <b>${loc}</b>. Select a province or constituency to load data.</p>`, []);
        return;
    }

    const total      = healthFeatures.length;
    const hospitals  = healthFeatures.filter(f => f.get('typeoffaci') === 'Hospital').length;
    const clinics    = healthFeatures.filter(f => f.get('typeoffaci') === 'Clinic').length;
    const pharmacies = healthFeatures.filter(f => f.get('typeoffaci') === 'Pharmacy').length;
    const numSettlements = settFeatures.length;

    const ratio = numSettlements > 0 ? (numSettlements / total).toFixed(1) : 'N/A';
    const facilityClass = total < 3 ? 'analytics-highlight-bad' : total < 8 ? 'analytics-highlight-warn' : 'analytics-highlight-good';

    const summary = `
        <p><b>${loc}</b> has <span class="${facilityClass}">${total} health facilit${total === 1 ? 'y' : 'ies'}</span> 
        — comprising <b>${hospitals}</b> hospital(s), <b>${clinics}</b> clinic(s) and <b>${pharmacies}</b> pharmac${pharmacies === 1 ? 'y' : 'ies'}.
        ${numSettlements > 0 ? `With <b>${numSettlements}</b> settlement(s) in the area, 
        there is roughly <b>1 facility per ${ratio} settlement(s)</b>.` : ''}
        ${total < 3 ? ' This represents a <b>critically low</b> facility-to-population ratio.' :
          total < 8 ? ' Coverage is <b>moderate</b> but may not meet demand during peak periods.' :
                      ' Facility coverage appears <b>adequate</b>, though geographic accessibility should still be assessed.'}
        </p>`;

    const recs = [];
    if (total < 3)       recs.push(`Urgently establish additional health posts or mobile clinic services to close critical coverage gaps.`);
    if (hospitals === 0) recs.push(`No hospital recorded — ensure referral pathways to the nearest hospital are clearly defined and accessible.`);
    if (pharmacies === 0)recs.push(`No pharmacy recorded — explore community medicine distribution points or depot systems.`);
    if (clinics < 2)     recs.push(`Expand primary care clinic infrastructure to bring services closer to communities.`);
    recs.push(`Use the service zone map to identify settlements falling outside the 5km catchment and prioritise those for outreach programmes.`);

    renderAnalytics(containerId, summary, recs);
}

// ================= ROADS ANALYTICS =================
function updateRoadsAnalytics() {
    const loc = getLocationLabel();
    const containerId = 'analytics-roads';
    const roadFeatures = roadsVectorSource.getFeatures();

    if (!roadFeatures.length) {
        renderAnalytics(containerId, `<p>No road network data available for <b>${loc}</b>.</p>`, []);
        return;
    }

    const total   = roadFeatures.length;
    const paved   = roadFeatures.filter(f => f.get('road_condi') === 'paved').length;
    const unpaved = roadFeatures.filter(f => f.get('road_condi') === 'unpaved').length;
    const poor    = roadFeatures.filter(f => f.get('road_struc') === 'Poor to very Poor').length;
    const fair    = total - poor;

    const pctPaved = pct(paved, total);
    const pctPoor  = pct(poor,  total);

    const surfClass = parseFloat(pctPaved) > 50 ? 'analytics-highlight-good' : parseFloat(pctPaved) > 20 ? 'analytics-highlight-warn' : 'analytics-highlight-bad';
    const condClass = parseFloat(pctPoor)  > 50 ? 'analytics-highlight-bad'  : parseFloat(pctPoor)  > 25 ? 'analytics-highlight-warn' : 'analytics-highlight-good';

    const summary = `
        <p>The road network in <b>${loc}</b> consists of <b>${total}</b> road segment(s).
        <span class="${surfClass}">${pctPaved}%</span> of roads are paved and 
        <b>${pct(unpaved, total)}%</b> are unpaved/gravel.
        In terms of structural condition, <span class="${condClass}">${pctPoor}%</span> of roads 
        are rated <i>poor to very poor</i>, while <b>${pct(fair, total)}%</b> are in fair or better condition.
        ${parseFloat(pctPoor) > 50 ? ' The majority of roads are in poor condition, which will significantly impede access to services.' : ''}
        </p>`;

    const recs = [];
    if (parseFloat(pctPaved) < 20)  recs.push(`Only ${pctPaved}% of roads are paved — prioritise tarring of key access routes connecting settlements to health, education and market centres.`);
    if (parseFloat(pctPoor) > 50)   recs.push(`Over half the road network is in poor condition — conduct a road condition survey and develop a rehabilitation priority list.`);
    if (parseFloat(pctPoor) > 25)   recs.push(`Significant road degradation detected — schedule routine maintenance (grading, pothole patching) before the rainy season.`);
    if (unpaved > paved)            recs.push(`High proportion of unpaved roads — consider gravel re-sheeting and drainage improvements as a cost-effective interim measure.`);
    recs.push(`Cross-reference poor road segments with health facility locations to identify access-deficit corridors requiring urgent attention.`);

    renderAnalytics(containerId, summary, recs);
}

// ================= WATER ANALYTICS =================
function updateWaterAnalytics() {
    const loc = getLocationLabel();
    const containerId = 'analytics-water';
    const waterFeatures = waterVectorSource.getFeatures();

    if (!waterFeatures.length) {
        renderAnalytics(containerId, `<p>No water point data available for <b>${loc}</b>.</p>`, []);
        return;
    }

    const total       = waterFeatures.length;
    const fully       = waterFeatures.filter(f => f.get('functional') === 'Fully Functional').length;
    const partial     = waterFeatures.filter(f => f.get('functional') === 'Partially Functional').length;
    const collapsed   = waterFeatures.filter(f => f.get('functional') === 'Collapsed/Abandoned').length;
    const naStatus    = waterFeatures.filter(f => f.get('functional') === 'N/A').length;
    const nonFunc     = total - fully - partial;

    const boreholes   = waterFeatures.filter(f => f.get('type') === 'Borehole').length;
    const deepWells   = waterFeatures.filter(f => f.get('type') === 'Deep Well').length;
    const shallowWells= waterFeatures.filter(f => f.get('type') === 'Shallow Well').length;
    const dams        = waterFeatures.filter(f => f.get('type') === 'Dam').length;
    const springs     = waterFeatures.filter(f => f.get('type') === 'Spring').length;

    const pctFully   = pct(fully,    total);
    const pctPartial = pct(partial,  total);
    const pctCollapse= pct(collapsed,total);

    const funcClass  = parseFloat(pctFully) > 70 ? 'analytics-highlight-good' : parseFloat(pctFully) > 40 ? 'analytics-highlight-warn' : 'analytics-highlight-bad';
    const collapseClass = parseFloat(pctCollapse) > 20 ? 'analytics-highlight-bad' : parseFloat(pctCollapse) > 10 ? 'analytics-highlight-warn' : 'analytics-highlight-good';

    const summary = `
        <p><b>${loc}</b> has <b>${total}</b> water point(s).
        <span class="${funcClass}">${pctFully}%</span> are fully functional, 
        <b>${pctPartial}%</b> partially functional, and 
        <span class="${collapseClass}">${pctCollapse}%</span> are collapsed or abandoned.
        ${naStatus > 0 ? `Status is unknown for <b>${naStatus}</b> point(s).` : ''}
        By source type, the area relies on: boreholes (<b>${boreholes}</b>), 
        deep wells (<b>${deepWells}</b>), shallow wells (<b>${shallowWells}</b>), 
        dams (<b>${dams}</b>) and springs (<b>${springs}</b>).
        ${shallowWells > boreholes ? ' <span class="analytics-highlight-warn">Shallow wells dominate</span> — these are more vulnerable to contamination and seasonal drying.' : ''}
        </p>`;

    const recs = [];
    if (parseFloat(pctFully) < 40)   recs.push(`Critically low functional rate (${pctFully}%) — conduct emergency repairs and rehabilitation of non-functional points.`);
    else if (parseFloat(pctFully) < 70) recs.push(`Moderate functionality rate — schedule maintenance for the ${partial} partially functional point(s) before they fail completely.`);
    if (collapsed > 0)               recs.push(`${collapsed} collapsed/abandoned point(s) identified — assess feasibility for rehabilitation to restore capacity.`);
    if (shallowWells > boreholes)    recs.push(`High reliance on shallow wells — prioritise borehole drilling to improve water quality and year-round reliability.`);
    if (naStatus > 0)                recs.push(`${naStatus} water point(s) have unknown status — conduct a field verification exercise to update the dataset.`);
    recs.push(`Establish a community-based water point management system (CWPMS) to ensure routine maintenance and early fault reporting.`);

    renderAnalytics(containerId, summary, recs);
}

// ================= EDUCATION ANALYTICS =================
function updateEducationAnalytics(level) {
    const loc = getLocationLabel();
    const containerId = 'analytics-education';
    const schoolFeatures = schoolVectorSource.getFeatures().filter(f =>
        level === 'primary' ? f.get('classifica') === 'Primary Schools' : f.get('classifica') === 'High Schools'
    );

    if (!schoolFeatures.length) {
        renderAnalytics(containerId, `<p>No ${level} school data available for <b>${loc}</b>.</p>`, []);
        return;
    }

    const total      = schoolFeatures.length;
    const totalMale  = sum(schoolFeatures.map(f => f.get('enrol_male') || 0));
    const totalFem   = sum(schoolFeatures.map(f => f.get('enrol_fema') || 0));
    const totalPupils= sum(schoolFeatures.map(f => f.get('total_pupi') || 0));
    const totalTeach = sum(schoolFeatures.map(f => f.get('teachers')   || 0));
    const avgRatio   = totalTeach > 0 ? (totalPupils / totalTeach).toFixed(1) : 'N/A';
    const pctFem     = pct(totalFem, totalPupils);
    const pctMale    = pct(totalMale, totalPupils);

    const ratioNum   = parseFloat(avgRatio);
    const ratioClass = ratioNum > 40 ? 'analytics-highlight-bad' : ratioNum > 30 ? 'analytics-highlight-warn' : 'analytics-highlight-good';
    const genderClass= parseFloat(pctFem) < 45 ? 'analytics-highlight-warn' : 'analytics-highlight-good';

    const levelLabel = level === 'primary' ? 'Primary' : 'Secondary (High)';

    const summary = `
        <p><b>${loc}</b> has <b>${total} ${levelLabel} school(s)</b> with a total enrolment of 
        <b>${totalPupils.toLocaleString()}</b> pupils 
        (<span class="${genderClass}">${pctFem}% female</span>, ${pctMale}% male).
        There are <b>${totalTeach}</b> teacher(s), giving an average pupil-to-teacher ratio of 
        <span class="${ratioClass}">${avgRatio}:1</span>.
        ${ratioNum > 40 ? ' This ratio is <b>critically high</b> and will negatively impact learning outcomes.' :
          ratioNum > 30 ? ' This ratio is above the recommended 30:1 and should be addressed.' :
          ratioNum > 0  ? ' This ratio is within acceptable limits.' : ''}
        ${parseFloat(pctFem) < 45 ? ` Female enrolment (<b>${pctFem}%</b>) is below parity — gender barriers to education may exist.` : ''}
        </p>`;

    const recs = [];
    if (ratioNum > 40)              recs.push(`Pupil-teacher ratio of ${avgRatio}:1 is critically high — urgently recruit and deploy additional teachers.`);
    else if (ratioNum > 30)        recs.push(`Pupil-teacher ratio above recommended levels — prioritise teacher recruitment in the next planning cycle.`);
    if (parseFloat(pctFem) < 45)   recs.push(`Female enrolment below 45% — implement girl-friendly school programmes, sanitation facilities and community awareness campaigns.`);
    if (total < 3)                  recs.push(`Limited number of ${levelLabel.toLowerCase()} schools — assess whether additional schools or satellite classrooms are needed to improve access.`);
    recs.push(`Conduct a school infrastructure audit to identify classrooms, WASH facilities and learning materials that require upgrading.`);
    if (level === 'primary')        recs.push(`Track completion rates alongside enrolment to identify dropout risks and implement early interventions.`);

    renderAnalytics(containerId, summary, recs);
}

// ================= MAP =================
const map = new ol.Map({
    target: 'map',
    layers: [],
    view: new ol.View({
        center: ol.proj.fromLonLat([27.5, -18.5]),
        zoom: 7
    })
});

// ---------------- EDUCATION POPUP ----------------
const popupContainer = document.createElement('div');
popupContainer.id = 'popup';
popupContainer.style.cssText = `
    position: absolute;
    background: white; 
    border: 1px solid #333; 
    padding: 10px; 
    border-radius: 5px; 
    min-width: 220px;
    font-family: Calibri, sans-serif;
    box-shadow: 0 2px 6px rgba(0,0,0,0.3);
    pointer-events: auto;
    z-index: 1000;
`;
document.body.appendChild(popupContainer);

const popupOverlay = new ol.Overlay({
    element: popupContainer,
    positioning: 'bottom-center',
    stopEvent: true,
    offset: [0, -15]
});
map.addOverlay(popupOverlay);

function closePopup() { popupOverlay.setPosition(undefined); }

function setSchoolPopupContent(feature) {
    const name      = feature.get('name')       || 'N/A';
    const ownership = feature.get('responsibl') || 'N/A';
    const female    = feature.get('enrol_fema') || 0;
    const male      = feature.get('enrol_male') || 0;
    const total     = feature.get('total_pupi') || 0;
    const teachers  = feature.get('teachers')   || 0;
    const ratio     = feature.get('teacher_pu') || 'N/A';
    popupContainer.innerHTML = `
        <strong>${name}</strong><br/>
        <strong>Type of Ownership:</strong> ${ownership}<br/>
        <strong>Female Enrolment:</strong> ${female}<br/>
        <strong>Male Enrolment:</strong> ${male}<br/>
        <strong>Total Pupils:</strong> ${total}<br/>
        <strong>Teachers:</strong> ${teachers}<br/>
        <strong>Pupil / Teacher Ratio:</strong> ${ratio}
    `;
}

map.on('singleclick', function(evt) {
    if (!tabEducation.classList.contains('active')) return;
    const feature = map.forEachFeatureAtPixel(evt.pixel, function(f) {
        return f.get('classifica') ? f : null;
    });
    if (feature) {
        setSchoolPopupContent(feature);
        popupOverlay.setPosition(feature.getGeometry().getCoordinates());
    } else {
        popupOverlay.setPosition(undefined);
    }
});

const tabButtons = document.querySelectorAll('.tabs button');
tabButtons.forEach(tab => tab.addEventListener('click', () => closePopup()));

// ---------------- VECTOR SOURCES ----------------
const wardVectorSource        = new ol.source.Vector();
const waterVectorSource       = new ol.source.Vector();
const schoolVectorSource      = new ol.source.Vector();
const healthVectorSource      = new ol.source.Vector();
const bufferVectorSource      = new ol.source.Vector();
const roadsVectorSource       = new ol.source.Vector();
const settlementsVectorSource = new ol.source.Vector();

// ---------------- VECTOR LAYERS ----------------
const wardLayer         = new ol.layer.Vector({ source: wardVectorSource,        style: wardLabelStyle });
const waterVector       = new ol.layer.Vector({ source: waterVectorSource,       visible: false });
const schoolVector      = new ol.layer.Vector({ source: schoolVectorSource,      visible: false });
const healthVector      = new ol.layer.Vector({ source: healthVectorSource,      visible: false });
const bufferVector      = new ol.layer.Vector({ source: bufferVectorSource,      visible: false });
const roadsVector       = new ol.layer.Vector({ source: roadsVectorSource,       visible: false });
const settlementsVector = new ol.layer.Vector({ source: settlementsVectorSource, visible: false });

map.addLayer(wardLayer);
map.addLayer(settlementsVector);
map.addLayer(roadsVector);
map.addLayer(bufferVector);
map.addLayer(healthVector);
map.addLayer(waterVector);
map.addLayer(schoolVector);

// ---------------- STYLES ----------------
function wardLabelStyle(f) {
    return new ol.style.Style({
        text: new ol.style.Text({
            text:   String(f.get('wardnumber') || ''),
            font:   'bold 14px Calibri',
            fill:   new ol.style.Fill({ color: '#000' }),
            stroke: new ol.style.Stroke({ color: '#fff', width: 2 })
        })
    });
}

function demographyStyle(f) {
    const v = f.get('total_popu') || 0;
    let c = '#ffffcc';
    if (v > 1200) c = '#fd8d3c';
    if (v > 1600) c = '#e31a1c';
    if (v > 1900) c = '#800026';
    return new ol.style.Style({
        fill:   new ol.style.Fill({ color: c }),
        stroke: new ol.style.Stroke({ color: '#555', width: 1 }),
        text:   wardLabelStyle(f).getText()
    });
}

function prevalenceStyle(f) {
    const v = f.get('poverty_pr') || 0;
    let c = '#fee5d9';
    if (v > 25) c = '#fcae91';
    if (v > 40) c = '#fb6a4a';
    if (v > 55) c = '#cb181d';
    return new ol.style.Style({
        fill:   new ol.style.Fill({ color: c }),
        stroke: new ol.style.Stroke({ color: '#555', width: 1 }),
        text:   wardLabelStyle(f).getText()
    });
}

function gapStyle(f) {
    const v = f.get('poverty_ga') || 0;
    let c = '#eff3ff';
    if (v > 3) c = '#bdd7e7';
    if (v > 5) c = '#6baed6';
    if (v > 7) c = '#2171b5';
    return new ol.style.Style({
        fill:   new ol.style.Fill({ color: c }),
        stroke: new ol.style.Stroke({ color: '#555', width: 1 }),
        text:   wardLabelStyle(f).getText()
    });
}

function waterFunctionalStyle(f) {
    const status = f.get('functional') || 'Non-Functional';
    let color = '#de2d26';
    if      (status === 'Fully Functional')    color = '#2ca25f';
    else if (status === 'Partially Functional')color = '#fc9272';
    else if (status === 'Collapsed/Abandoned') color = '#3182bd';
    else if (status === 'N/A')                 color = '#800080';
    return new ol.style.Style({
        image: new ol.style.RegularShape({
            points: 4, radius: 6,
            fill:   new ol.style.Fill({ color }),
            stroke: new ol.style.Stroke({ color: '#fff', width: 1 })
        })
    });
}

function waterSourceStyle(f) {
    const type = f.get('type') || 'Other';
    let color = '#c6dbef';
    if      (type === 'Borehole')     color = '#3182bd';
    else if (type === 'Deep Well')    color = '#990e0e';
    else if (type === 'Shallow Well') color = '#d838a5';
    else if (type === 'Dam')          color = '#c4dd0b';
    else if (type === 'Spring')       color = '#4daf4a';
    return new ol.style.Style({
        image: new ol.style.RegularShape({
            points: 4, radius: 6,
            fill:   new ol.style.Fill({ color }),
            stroke: new ol.style.Stroke({ color: '#fff', width: 1 })
        })
    });
}

function schoolPieStyle(f) {
    const male   = f.get('enrol_male') || 0;
    const female = f.get('enrol_fema') || 0;
    const total  = male + female;
    if (total === 0) return null;

    const minRadius = 8, maxRadius = 20, maxEnrolment = 1000;
    const radiusScale = Math.min(maxRadius, minRadius + (total / maxEnrolment) * (maxRadius - minRadius));
    const radiusX = radiusScale, radiusY = radiusScale * 0.8;
    const centerX = radiusX,    centerY = radiusX;
    const depth = radiusScale * 0.25;
    const canvasSize = radiusX * 2 + depth + 2;
    const canvas = document.createElement('canvas');
    canvas.width = canvasSize; canvas.height = canvasSize;
    const ctx = canvas.getContext('2d');
    let startAngle = 0;
    const slices = [
        { value: male,   color: '#3182bd', shadow: '#1e488c' },
        { value: female, color: '#fc6ea8', shadow: '#b14f7c' }
    ];
    slices.forEach(slice => {
        const angle = (slice.value / total) * 2 * Math.PI;
        if (angle === 0) return;
        ctx.beginPath(); ctx.moveTo(centerX, centerY);
        ctx.ellipse(centerX, centerY + depth, radiusX, radiusY, 0, startAngle, startAngle + angle);
        ctx.lineTo(centerX, centerY); ctx.closePath();
        ctx.fillStyle = slice.shadow; ctx.fill(); ctx.strokeStyle = '#000'; ctx.stroke();
        startAngle += angle;
    });
    startAngle = 0;
    slices.forEach(slice => {
        const angle = (slice.value / total) * 2 * Math.PI;
        if (angle === 0) return;
        ctx.beginPath(); ctx.moveTo(centerX, centerY);
        ctx.ellipse(centerX, centerY, radiusX, radiusY, 0, startAngle, startAngle + angle);
        ctx.closePath(); ctx.fillStyle = slice.color; ctx.fill(); ctx.strokeStyle = '#000'; ctx.stroke();
        startAngle += angle;
    });
    return new ol.style.Style({
        image: new ol.style.Icon({ img: canvas, imgSize: [canvasSize, canvasSize] }),
        text:  new ol.style.Text({
            text:   f.get('name') || '',
            font:   '12px Calibri',
            fill:   new ol.style.Fill({ color: '#000' }),
            stroke: new ol.style.Stroke({ color: '#fff', width: 2 }),
            offsetY: -radiusX - 5
        })
    });
}

function healthFacilitiesStyle(f) {
    const t = f.get('typeoffaci');
    let color = '#3182bd';
    if      (t === 'Hospital')  color = 'red';
    else if (t === 'Clinic')    color = 'green';
    else if (t === 'Pharmacy')  color = 'orange';
    return new ol.style.Style({
        image: new ol.style.Circle({ radius: 6, fill: new ol.style.Fill({ color }), stroke: new ol.style.Stroke({ color: '#fff', width: 1 }) }),
        text:  new ol.style.Text({ text: f.get('nameoffaci') || '', offsetY: -10, font: '12px Calibri', fill: new ol.style.Fill({ color: '#000' }), stroke: new ol.style.Stroke({ color: '#fff', width: 2 }) })
    });
}

function settlementsStyle() {
    return new ol.style.Style({ fill: new ol.style.Fill({ color: '#b87f53' }), stroke: new ol.style.Stroke({ color: '#b87f53', width: 1 }) });
}

function settlementsEducationStyle() {
    return new ol.style.Style({ fill: new ol.style.Fill({ color: '#d14b11' }), stroke: new ol.style.Stroke({ color: '#820707', width: 1 }) });
}

function roadsDeficitStyle(f) {
    const cls = f.get('road_condi');
    let w = 1, c = '#000';
    if      (cls === 'paved')   { w = 3; c = '#ba3434'; }
    else if (cls === 'unpaved') { w = 2; c = '#ebd45f'; }
    return new ol.style.Style({ stroke: new ol.style.Stroke({ color: c, width: w }) });
}

function roadConditionStyle(f) {
    const cond = f.get('road_struc');
    let color = '#f1c40f';
    if (cond === 'Poor to very Poor') color = '#e74c3c';
    return new ol.style.Style({ stroke: new ol.style.Stroke({ color, width: 3 }) });
}

function roadSurfaceStyle(f) {
    const type = f.get('road_condi');
    let color = '#ba3434', width = 3;
    if (type === 'unpaved') { color = '#ebd45f'; width = 2; }
    return new ol.style.Style({ stroke: new ol.style.Stroke({ color, width }) });
}

function overviewStyle(f) {
    return new ol.style.Style({
        fill:   new ol.style.Fill({ color: 'rgba(200,200,200,0.3)' }),
        stroke: new ol.style.Stroke({ color: '#555', width: 1 }),
        text:   wardLabelStyle(f).getText()
    });
}

// ---------------- DROPDOWNS ----------------
const elProv  = document.getElementById('select-province');
const elConst = document.getElementById('select-constituency');
const elWard  = document.getElementById('select-ward');

function escapeCQL(str) { return str ? str.replace(/'/g, "''") : ''; }

// ---------------- FILTER FUNCTIONS ----------------
function applyWardFilter()       { reloadSource(wardVectorSource,        RAW.ward,        true); }
function updateWardLabels()      { applyWardFilter(); }
function applyRoadFilter()       { reloadSource(roadsVectorSource,       RAW.roads,       true); }
function applyWaterFilter()      { reloadSource(waterVectorSource,       RAW.water,       true); }
function applySchoolFilter()     { reloadSource(schoolVectorSource,      RAW.school,      true); }
function applySettlementFilter() { reloadSource(settlementsVectorSource, RAW.settlements, true); }
function applyHealthFilter()     {
    reloadSource(healthVectorSource, RAW.health,       true);
    reloadSource(bufferVectorSource, RAW.healthBuffer, true);
}

// ---------------- POPULATE PROVINCE ----------------
function populateProvinces() {
    if (!RAW.ward) return;
    const unique = [...new Set(RAW.ward.features.map(f => f.properties.province).filter(v => v != null))].sort();
    unique.forEach(p => elProv.add(new Option(p, p)));
}

// ---------------- DROPDOWN EVENTS ----------------
elProv.addEventListener('change', async () => {
    const p = escapeCQL(elProv.value);
    if (!p) {
        reloadSource(wardVectorSource, RAW.ward, false);
        elConst.disabled = true; elWard.disabled = true;
        elConst.innerHTML = '<option value="">Select Constituency</option>';
        elWard.innerHTML  = '<option value="">Select Ward</option>';
        document.getElementById('res-province').innerText     = 'N/A';
        document.getElementById('res-constituency').innerText = 'N/A';
        document.getElementById('res-ward').innerText         = 'N/A';
        updatePopulationStats(); updateWelfareStats();
        updateOverviewAnalytics();
        return;
    }
    applyWardFilter();
    document.getElementById('res-province').innerText = elProv.value;
    const consts = [...new Set(
        RAW.ward.features.filter(f => f.properties.province === elProv.value).map(f => f.properties.constituen).filter(v => v != null)
    )].sort();
    elConst.innerHTML = '<option value="">Select Constituency</option>';
    consts.forEach(c => elConst.add(new Option(c, c)));
    elConst.disabled = false;
    elWard.disabled  = true; elWard.innerHTML = '<option value="">Select Ward</option>';
    document.getElementById('res-constituency').innerText = 'N/A';
    document.getElementById('res-ward').innerText         = 'N/A';
    updatePopulationStats(); updateWelfareStats();
    applyWaterFilter(); applyRoadFilter(); applySettlementFilter();
    updateOverviewAnalytics();
});

elConst.addEventListener('change', async () => {
    const c = escapeCQL(elConst.value);
    if (!c) return;
    applyWardFilter();
    document.getElementById('res-constituency').innerText = elConst.value;
    document.getElementById('display-title').innerText    = `${elConst.value} Overview`;
    const wards = [...new Set(
        RAW.ward.features
            .filter(f => f.properties.province === elProv.value && f.properties.constituen === elConst.value)
            .map(f => f.properties.wardnumber).filter(v => v != null)
    )].sort((a, b) => Number(a) - Number(b));
    elWard.innerHTML = '<option value="">Select Ward</option>';
    wards.forEach(w => elWard.add(new Option(w, w)));
    elWard.disabled  = false;
    document.getElementById('res-ward').innerText = 'N/A';
    updatePopulationStats(); updateWelfareStats();
    applyRoadFilter(); applyWaterFilter(); applySettlementFilter();
    updateOverviewAnalytics();
});

elWard.addEventListener('change', () => {
    const w = escapeCQL(elWard.value);
    if (!w) return;
    applyWardFilter();
    document.getElementById('res-ward').innerText = `Ward ${elWard.value}`;
    updatePopulationStats(); updateWelfareStats();
    applyRoadFilter(); applyWaterFilter(); applySettlementFilter();
    updateOverviewAnalytics();
});

// ---------------- TABS ----------------
const tabOverview   = document.getElementById('tab-overview');
const tabDemography = document.getElementById('tab-demography');
const tabWelfare    = document.getElementById('tab-welfare');
const tabHealth     = document.getElementById('tab-health');
const tabRoads      = document.getElementById('tab-roads');

const overviewContent   = document.getElementById('overview-content');
const demographyContent = document.getElementById('demography-content');
const welfareContent    = document.getElementById('welfare-content');
const healthContent     = document.getElementById('health-content');
const roadsContent      = document.getElementById('roads-content');

const popLegend  = document.getElementById('pop-legend');
const prevLegend = document.getElementById('prev-legend');
const gapLegend  = document.getElementById('gap-legend');

const btnPrev = document.getElementById('btn-prevalence');
const btnGap  = document.getElementById('btn-gap');

const btnHealthDist    = document.getElementById('btn-health-dist');
const btnHealthZone    = document.getElementById('btn-health-zone');
const btnHealthDeficit = document.getElementById('btn-health-deficit');

const btnRoadCondition = document.getElementById('btn-road-condition');
const btnRoadSurface   = document.getElementById('btn-road-surface');

btnRoadCondition.onclick = () => {
    btnRoadCondition.classList.add('active'); btnRoadSurface.classList.remove('active');
    roadsVector.setStyle(roadConditionStyle);
    document.getElementById('roads-legend-condition').style.display = 'block';
    document.getElementById('roads-legend-surface').style.display   = 'none';
    updateRoadsAnalytics();
};

btnRoadSurface.onclick = () => {
    btnRoadSurface.classList.add('active'); btnRoadCondition.classList.remove('active');
    roadsVector.setStyle(roadSurfaceStyle);
    document.getElementById('roads-legend-condition').style.display = 'none';
    document.getElementById('roads-legend-surface').style.display   = 'block';
    updateRoadsAnalytics();
};

const tabWater           = document.getElementById('tab-water');
const waterContent       = document.getElementById('water-content');
const btnWaterFunctional = document.getElementById('btn-water-functional');
const btnWaterType       = document.getElementById('btn-water-type');
const waterLegendFunctional = document.getElementById('water-legend-functional');
const waterLegendType       = document.getElementById('water-legend-type');

tabWater.onclick = () => switchTab('water');

btnWaterFunctional.onclick = () => {
    btnWaterFunctional.classList.add('active'); btnWaterType.classList.remove('active');
    applyWaterFilter();
    waterVector.setStyle(waterFunctionalStyle); waterVector.setVisible(true);
    waterLegendFunctional.style.display = 'block'; waterLegendType.style.display = 'none';
    updateWaterAnalytics();
};

btnWaterType.onclick = () => {
    btnWaterType.classList.add('active'); btnWaterFunctional.classList.remove('active');
    applyWaterFilter();
    waterVector.setStyle(waterSourceStyle); waterVector.setVisible(true);
    waterLegendFunctional.style.display = 'none'; waterLegendType.style.display = 'block';
    updateWaterAnalytics();
};

// ---------------- EDUCATION ----------------
const tabEducation        = document.getElementById('tab-education');
const educationContent    = document.getElementById('education-content');
const btnEducationPrimary   = document.getElementById('btn-education-primary');
const btnEducationSecondary = document.getElementById('btn-education-secondary');

btnEducationPrimary.onclick = () => {
    btnEducationPrimary.classList.add('active'); btnEducationSecondary.classList.remove('active');
    applySchoolFilter(); applySettlementFilter();
    schoolVector.setStyle(f => f.get('classifica') === 'Primary Schools' ? schoolPieStyle(f) : null);
    schoolVector.setVisible(true); settlementsVector.setVisible(true);
    settlementsVector.setStyle(settlementsEducationStyle);
    updateEducationAnalytics('primary');
};

btnEducationSecondary.onclick = () => {
    btnEducationSecondary.classList.add('active'); btnEducationPrimary.classList.remove('active');
    applySchoolFilter(); applySettlementFilter();
    schoolVector.setStyle(f => f.get('classifica') === 'High Schools' ? schoolPieStyle(f) : null);
    schoolVector.setVisible(true); settlementsVector.setVisible(true);
    settlementsVector.setStyle(settlementsEducationStyle);
    updateEducationAnalytics('secondary');
};

// ---------------- HEALTH LEGENDS ----------------
const healthLegendFacilities = document.getElementById('health-legend-facilities');
const healthLegendService    = document.getElementById('health-legend-service');
const healthLegendDeficit    = document.getElementById('health-legend-deficit');

// ---------------- APPLY HEALTH TAB ----------------
function applyHealthTab(tab) {
    healthVector.setVisible(false); bufferVector.setVisible(false);
    roadsVector.setVisible(false);  settlementsVector.setVisible(false);
    healthLegendFacilities.style.display = 'none';
    healthLegendService.style.display    = 'none';
    healthLegendDeficit.style.display    = 'none';

    applyHealthFilter(); applySettlementFilter(); applyRoadFilter();

    if (tab === 'facilities') {
        healthVector.setVisible(true); settlementsVector.setVisible(true);
        healthVector.setStyle(f => healthFacilitiesStyle(f));
        settlementsVector.setStyle(settlementsStyle);
        healthLegendFacilities.style.display = 'block';
    } else if (tab === 'service') {
        healthVector.setVisible(true); bufferVector.setVisible(true); settlementsVector.setVisible(true);
        healthVector.setStyle(() => new ol.style.Style({ image: new ol.style.Circle({ radius: 6, fill: new ol.style.Fill({ color: '#3182bd' }) }) }));
        bufferVector.setStyle(new ol.style.Style({ fill: new ol.style.Fill({ color: 'rgba(102,194,165,0.4)' }), stroke: new ol.style.Stroke({ color: '#555', width: 1 }) }));
        settlementsVector.setStyle(settlementsStyle);
        healthLegendService.style.display = 'block';
    } else if (tab === 'deficit') {
        healthVector.setVisible(true); bufferVector.setVisible(true);
        settlementsVector.setVisible(true); roadsVector.setVisible(true);
        healthVector.setStyle(() => new ol.style.Style({ image: new ol.style.Circle({ radius: 6, fill: new ol.style.Fill({ color: '#aaa' }) }) }));
        bufferVector.setStyle(new ol.style.Style({ fill: new ol.style.Fill({ color: 'rgba(255,255,255,0.6)' }), stroke: new ol.style.Stroke({ color: '#aaa', width: 1 }) }));
        roadsVector.setStyle(roadsDeficitStyle);
        settlementsVector.setStyle(settlementsStyle);
        healthLegendDeficit.style.display = 'block';
    }
    map.removeLayer(healthVector);
    map.addLayer(healthVector);
    updateHealthAnalytics();
}

// ---------------- TABS ----------------
tabOverview.onclick   = () => switchTab('overview');
tabDemography.onclick = () => switchTab('demography');
tabWelfare.onclick    = () => switchTab('welfare');
tabHealth.onclick     = () => switchTab('health');
tabRoads.onclick      = () => switchTab('roads');
tabEducation.onclick  = () => switchTab('education');

btnPrev.onclick = () => {
    welfareMode = 'prevalence'; btnPrev.classList.add('active'); btnGap.classList.remove('active');
    applyWelfareStyle(); updateWelfareStats();
};
btnGap.onclick = () => {
    welfareMode = 'gap'; btnGap.classList.add('active'); btnPrev.classList.remove('active');
    applyWelfareStyle(); updateWelfareStats();
};

btnHealthDist.onclick    = () => { setActiveHealthTab(btnHealthDist);    applyHealthTab('facilities'); };
btnHealthZone.onclick    = () => { setActiveHealthTab(btnHealthZone);    applyHealthTab('service'); };
btnHealthDeficit.onclick = () => { setActiveHealthTab(btnHealthDeficit); applyHealthTab('deficit'); };

function setActiveHealthTab(activeBtn) {
    [btnHealthDist, btnHealthZone, btnHealthDeficit].forEach(b => b.classList.remove('active'));
    activeBtn.classList.add('active');
}

// ---------------- ZOOM ----------------
document.getElementById('zoom-layer').onclick = () => {
    const features = wardVectorSource.getFeatures();
    if (!features.length) return;
    const extent = features.reduce((acc, f) => ol.extent.extend(acc, f.getGeometry().getExtent()), ol.extent.createEmpty());
    map.getView().fit(extent, { padding: [50, 50, 50, 50], duration: 800 });
};

// ---------------- SWITCH TAB ----------------
function switchTab(mode) {
    [overviewContent, demographyContent, welfareContent, healthContent, roadsContent,
     waterContent, educationContent].forEach(el => el.style.display = 'none');

    [popLegend, prevLegend, gapLegend, healthLegendFacilities, healthLegendService,
     healthLegendDeficit].forEach(el => el.style.display = 'none');
    document.getElementById('education-legend').style.display       = 'none';
    document.getElementById('roads-legend-condition').style.display = 'none';
    document.getElementById('roads-legend-surface').style.display   = 'none';
    waterLegendFunctional.style.display = 'none';
    waterLegendType.style.display       = 'none';

    [tabOverview, tabDemography, tabWelfare, tabHealth, tabRoads, tabWater, tabEducation]
        .forEach(t => t.classList.remove('active'));

    healthVector.setVisible(false); bufferVector.setVisible(false);
    roadsVector.setVisible(false);  settlementsVector.setVisible(false);
    waterVector.setVisible(false);  schoolVector.setVisible(false);

    wardLayer.setStyle(wardLabelStyle);

    if (mode === 'overview') {
        overviewContent.style.display = 'block';
        wardLayer.setStyle(overviewStyle);
        tabOverview.classList.add('active');
        updateOverviewAnalytics();
    }
    else if (mode === 'demography') {
        demographyContent.style.display = 'block';
        wardLayer.setStyle(demographyStyle);
        popLegend.style.display = 'block';
        tabDemography.classList.add('active');
        updatePopulationStats();
    }
    else if (mode === 'welfare') {
        welfareContent.style.display = 'block';
        tabWelfare.classList.add('active');
        applyWelfareStyle(); updateWelfareStats(); updateWelfareChart();
    }
    else if (mode === 'health') {
        healthContent.style.display = 'block';
        tabHealth.classList.add('active');
        setActiveHealthTab(btnHealthDist);
        applyHealthTab('facilities');
    }
    else if (mode === 'roads') {
        roadsContent.style.display = 'block';
        tabRoads.classList.add('active');
        roadsVector.setVisible(true); applyRoadFilter();
        roadsVector.setStyle(roadConditionStyle);
        document.getElementById('roads-legend-condition').style.display = 'block';
        btnRoadCondition.classList.add('active'); btnRoadSurface.classList.remove('active');
        updateRoadsAnalytics();
    }
    else if (mode === 'water') {
        waterContent.style.display = 'block';
        tabWater.classList.add('active');
        applyWaterFilter(); btnWaterFunctional.click();
        map.removeLayer(waterVector); map.addLayer(waterVector);
    }
    else if (mode === 'education') {
        educationContent.style.display = 'block';
        tabEducation.classList.add('active');
        document.getElementById('education-legend').style.display = 'block';
        applySchoolFilter(); applySettlementFilter();
        schoolVector.setVisible(true); settlementsVector.setVisible(true);
        map.removeLayer(schoolVector); map.addLayer(schoolVector);
        updateEducationAnalytics('primary');
    }
}

// ---------------- WELFARE HELPERS ----------------
let welfareMode = 'prevalence';

function applyWelfareStyle() {
    if (welfareMode === 'prevalence') {
        wardLayer.setStyle(prevalenceStyle); prevLegend.style.display = 'block'; gapLegend.style.display = 'none';
    } else {
        wardLayer.setStyle(gapStyle); gapLegend.style.display = 'block'; prevLegend.style.display = 'none';
    }
}

function updatePopulationStats() {
    const data  = wardVectorSource.getFeatures();
    const total = data.reduce((s, f) => s + (f.get('total_popu') || 0), 0);
    document.getElementById('pop-province').innerText     = elProv.value  || 'N/A';
    document.getElementById('pop-constituency').innerText = elConst.value || 'N/A';
    document.getElementById('pop-total').innerText        = total;
    updatePopulationCharts();
    updateDemographyAnalytics();
}

// ---------------- POPULATION CHARTS ----------------
let chart0_14, chart15_64, chart65;

function updatePopulationCharts() {
    const features = wardVectorSource.getFeatures();
    if (!features.length) return;

    let labels = [], m_0_14 = [], f_0_14 = [], m_15_64 = [], f_15_64 = [], m_65 = [], f_65 = [];

    const isWard = elWard.value, isConst = elConst.value, isProv = elProv.value;

    if (isWard) {
        const f = features.find(ft => String(ft.get('wardnumber')) === String(elWard.value));
        if (!f) return;
        labels  = ['Selected Ward'];
        m_0_14  = [f.get('m_0_14')  || 0]; f_0_14  = [f.get('f_0_14')  || 0];
        m_15_64 = [f.get('m_15_64') || 0]; f_15_64 = [f.get('f_15_64') || 0];
        m_65    = [f.get('m_65')    || 0]; f_65    = [f.get('f_65')    || 0];
    }
    else if (isConst) {
        const cf = features.filter(f => f.get('constituen') === elConst.value);
        if (!cf.length) return;
        cf.forEach(f => {
            labels.push('Ward ' + (f.get('wardnumber') || ''));
            m_0_14.push(f.get('m_0_14')  || 0); f_0_14.push(f.get('f_0_14')  || 0);
            m_15_64.push(f.get('m_15_64')|| 0); f_15_64.push(f.get('f_15_64')|| 0);
            m_65.push(f.get('m_65')      || 0); f_65.push(f.get('f_65')      || 0);
        });
    }
    else if (isProv) {
        const pf = features.filter(f => f.get('province') === elProv.value);
        if (!pf.length) return;
        const grouped = {};
        pf.forEach(f => {
            const cn = f.get('constituen') || 'Unknown';
            if (!grouped[cn]) grouped[cn] = { m_0_14:0,f_0_14:0,m_15_64:0,f_15_64:0,m_65:0,f_65:0 };
            grouped[cn].m_0_14  += f.get('m_0_14')  || 0; grouped[cn].f_0_14  += f.get('f_0_14')  || 0;
            grouped[cn].m_15_64 += f.get('m_15_64') || 0; grouped[cn].f_15_64 += f.get('f_15_64') || 0;
            grouped[cn].m_65    += f.get('m_65')    || 0; grouped[cn].f_65    += f.get('f_65')    || 0;
        });
        labels = Object.keys(grouped);
        labels.forEach(c => {
            m_0_14.push(grouped[c].m_0_14);   f_0_14.push(grouped[c].f_0_14);
            m_15_64.push(grouped[c].m_15_64); f_15_64.push(grouped[c].f_15_64);
            m_65.push(grouped[c].m_65);       f_65.push(grouped[c].f_65);
        });
    }

    if (chart0_14)  chart0_14.destroy();
    if (chart15_64) chart15_64.destroy();
    if (chart65)    chart65.destroy();

    const chartOptions = title => ({
        responsive: true,
        plugins: { title: { display: true, text: title } },
        scales: { x: { ticks: { autoSkip: false, maxRotation: 45, minRotation: 45 } } }
    });

    chart0_14 = new Chart(document.getElementById('chart_0_14'), {
        type: 'bar',
        data: { labels, datasets: [
            { label:'Male (0-14)',   data:m_0_14, backgroundColor:'#3182bd', borderColor:'#000', borderWidth:1 },
            { label:'Female (0-14)',data:f_0_14, backgroundColor:'#fc6ea8', borderColor:'#000', borderWidth:1 }
        ]},
        options: chartOptions('Population (0–14 Years)')
    });

    chart15_64 = new Chart(document.getElementById('chart_15_64'), {
        type: 'bar',
        data: { labels, datasets: [
            { label:'Male (15-64)',   data:m_15_64, backgroundColor:'#3182bd', borderColor:'#000', borderWidth:1 },
            { label:'Female (15-64)',data:f_15_64, backgroundColor:'#fc6ea8', borderColor:'#000', borderWidth:1 }
        ]},
        options: chartOptions('Population (15–64 Years)')
    });

    chart65 = new Chart(document.getElementById('chart_65'), {
        type: 'bar',
        data: { labels, datasets: [
            { label:'Male (65+)',   data:m_65, backgroundColor:'#3182bd', borderColor:'#000', borderWidth:1 },
            { label:'Female (65+)',data:f_65, backgroundColor:'#fc6ea8', borderColor:'#000', borderWidth:1 }
        ]},
        options: chartOptions('Population (65+ Years)')
    });
}

function updateWelfareStats() {
    const data  = wardVectorSource.getFeatures();
    const field = welfareMode === 'prevalence' ? 'poverty_pr' : 'poverty_ga';
    const vals  = data.map(f => f.get(field) || 0);
    const avgVal= vals.length ? (vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(2) : 'N/A';
    document.getElementById('wel-province').innerText     = elProv.value  || 'N/A';
    document.getElementById('wel-constituency').innerText = elConst.value || 'N/A';
    document.getElementById('wel-value').innerText        = avgVal;
    updateWelfareChart();
    updateWelfareAnalytics();
}

// ---------------- WELFARE CHART ----------------
let welfareChart = null;

function updateWelfareChart() {
    const features = wardVectorSource.getFeatures();
    if (!features.length) return;
    let labels = [], poorData = [], nonPoorData = [];
    const isWard = elWard.value, isConst = elConst.value;
    if (isWard) {
        const f = features.find(ft => String(ft.get('wardnumber')) === String(elWard.value));
        labels = ['Selected Ward'];
        poorData    = [f ? f.get('poor')     || 0 : 0];
        nonPoorData = [f ? f.get('none_poor')|| 0 : 0];
    } else if (isConst) {
        features.forEach(f => {
            labels.push('Ward ' + (f.get('wardnumber') || ''));
            poorData.push(f.get('poor') || 0); nonPoorData.push(f.get('none_poor') || 0);
        });
    } else {
        const grouped = {};
        features.forEach(f => {
            const cn = f.get('constituen') || 'Unknown';
            if (!grouped[cn]) grouped[cn] = { poor:0, none_poor:0 };
            grouped[cn].poor      += f.get('poor')     || 0;
            grouped[cn].none_poor += f.get('none_poor')|| 0;
        });
        labels = Object.keys(grouped);
        labels.forEach(c => { poorData.push(grouped[c].poor); nonPoorData.push(grouped[c].none_poor); });
    }
    const ctx = document.getElementById('welfareChart').getContext('2d');
    if (welfareChart) welfareChart.destroy();
    welfareChart = new Chart(ctx, {
        type: 'bar',
        data: { labels, datasets: [
            { label:'Poor',      data:poorData,    backgroundColor:'#e74c3c', borderColor:'#000', borderWidth:1 },
            { label:'None-Poor', data:nonPoorData, backgroundColor:'#2ecc71', borderColor:'#000', borderWidth:1 }
        ]},
        options: {
            responsive: true,
            plugins: {
                title: { display: true, text: isWard ? 'Welfare (Selected Ward)' : isConst ? 'Welfare Comparison by Ward' : 'Welfare Comparison by Constituency' },
                legend: { position: 'top' }
            },
            scales: { x: { stacked: false }, y: { beginAtZero: true } }
        }
    });
}

// ================= STARTUP =================
async function init() {
    const files = {
        ward:         `${DATA_PATH}/Matnort_2.geojson`,
        health:       `${DATA_PATH}/Health_2.geojson`,
        healthBuffer: `${DATA_PATH}/Health_buffer.geojson`,
        roads:        `${DATA_PATH}/lovedroads.geojson`,
        settlements:  `${DATA_PATH}/settlements_2.geojson`,
        water:        `${DATA_PATH}/Waterpoint_3.geojson`,
        school:       `${DATA_PATH}/school_4.geojson`,
    };

    await Promise.all(Object.entries(files).map(async ([key, url]) => {
        try {
            const resp = await fetch(url);
            if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
            RAW[key] = await resp.json();
        } catch(e) {
            console.error(`Failed to load ${key} from ${url}:`, e);
            RAW[key] = { type: 'FeatureCollection', features: [] };
        }
    }));

    reloadSource(wardVectorSource, RAW.ward, false);
    populateProvinces();
    switchTab('overview');
}

init();

// ================= HTML PLACEHOLDERS REQUIRED =================
// Add these empty divs inside each tab's content panel in your HTML:
//
//  Overview tab:    <div id="analytics-overview"></div>
//  Demography tab:  <div id="analytics-demography"></div>  (place after each chart canvas)
//  Welfare tab:     <div id="analytics-welfare"></div>
//  Health tab:      <div id="analytics-health"></div>
//  Roads tab:       <div id="analytics-roads"></div>
//  Water tab:       <div id="analytics-water"></div>
//  Education tab:   <div id="analytics-education"></div>
