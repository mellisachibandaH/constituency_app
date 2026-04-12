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

// ── Parliament palette (matches style.css CSS variables) ──────
const C_GREEN_DARK  = '#1a3d2b';
const C_GREEN_MID   = '#2d6a45';
const C_GREEN_LIGHT = '#4a9e6b';
const C_GOLD        = '#c8922a';
const C_GOLD_LIGHT  = '#e8b84b';
const C_RED         = '#b83232';
const C_BLUE        = '#3182bd';
const C_PINK        = '#fc6ea8';

const C_MALE     = C_GREEN_MID;
const C_FEMALE   = C_GOLD;
const C_POOR     = C_RED;
const C_NON_POOR = C_GREEN_LIGHT;

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
        if (p && f.get('province')   !== p)                 return false;
        if (c && f.get('constituen') !== c)                 return false;
        if (w && String(f.get('wardnumber')) !== String(w)) return false;
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

function section(title, bodyHTML) {
    return `
        <div class="analytics-section">
            <div class="analytics-section-title">${title}</div>
            ${bodyHTML}
        </div>`;
}

function renderAnalytics(containerId, sectionsHTML, recommendations) {
    const el = document.getElementById(containerId);
    if (!el) return;
    const recItems = recommendations.map(r => `<li>${r}</li>`).join('');
    el.innerHTML = `
        <div class="analytics-box">
            ${sectionsHTML}
            ${recommendations.length ? `
            <div class="analytics-recommendations">
                <strong></strong>
                <ul>${recItems}</ul>
            </div>` : ''}
        </div>`;
}

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
    const wardFeatures = wardVectorSource.getFeatures();
    const loc          = getLocationLabel();
    const containerId  = 'analytics-overview';

    if (!wardFeatures.length) {
        renderAnalytics(
            containerId,
            section('Area Snapshot',
                '<p>Select a province, constituency or ward to see the key indicators summary.</p>'),
            []
        );
        return;
    }

    // ── POPULATION ────────────────────────────────────────────────────────
    const totalPop  = sum(wardFeatures.map(f => f.get('total_popu') || 0));
    const numWards  = wardFeatures.length;
    const totalMale = sum(wardFeatures.map(f =>
        (f.get('m_0_14') || 0) + (f.get('m_15_64') || 0) + (f.get('m_65') || 0)));
    const totalFem  = totalPop - totalMale;
    const pctFem    = pct(totalFem,  totalPop);
    const total014  = sum(wardFeatures.map(f => (f.get('m_0_14')  || 0) + (f.get('f_0_14')  || 0)));
    const total1564 = sum(wardFeatures.map(f => (f.get('m_15_64') || 0) + (f.get('f_15_64') || 0)));
    const total65   = sum(wardFeatures.map(f => (f.get('m_65')    || 0) + (f.get('f_65')    || 0)));
    const pct014    = pct(total014,  totalPop);
    const pct1564   = pct(total1564, totalPop);
    const pct65     = pct(total65,   totalPop);
    const youthEst  = Math.round(total1564 * 0.60);
    const pctYouth  = pct(youthEst, totalPop);

    // ── POVERTY ───────────────────────────────────────────────────────────
    const poorVals  = wardFeatures.map(f => f.get('poor')       || 0);
    const prevVals  = wardFeatures.map(f => f.get('poverty_pr') || 0);
    const gapVals   = wardFeatures.map(f => f.get('poverty_ga') || 0);
    const totalPoor = sum(poorVals);
    const popForPov = totalPoor + sum(wardFeatures.map(f => f.get('none_poor') || 0));
    const avgPrev   = avg(prevVals).toFixed(1);
    const avgGap    = avg(gapVals).toFixed(1);
    const pctPoor   = pct(totalPoor, popForPov);
    const povClass  = flag(parseFloat(avgPrev), 25, 45);
    const gapClass  = flag(parseFloat(avgGap),  5,  8);

    const worstPovWard = wardFeatures.reduce((a, b) =>
        (b.get('poverty_pr') || 0) > (a.get('poverty_pr') || 0) ? b : a);
    const worstPovName = `Ward ${worstPovWard.get('wardnumber') || '?'}`;

    // ── HEALTH ────────────────────────────────────────────────────────────
    const healthFeatures = healthVectorSource.getFeatures();
    const totalHealth    = healthFeatures.length;
    const hospitals      = healthFeatures.filter(f => f.get('typeoffaci') === 'Hospital').length;
    const clinics        = healthFeatures.filter(f => f.get('typeoffaci') === 'Clinic').length;
    const healthClass    = totalHealth < 3 ? 'analytics-highlight-bad'
                         : totalHealth < 8  ? 'analytics-highlight-warn'
                         : 'analytics-highlight-good';

    // ── WATER ─────────────────────────────────────────────────────────────
    const waterFeatures = waterVectorSource.getFeatures();
    const totalWater    = waterFeatures.length;
    const fullyFunc     = waterFeatures.filter(f => f.get('functional') === 'Fully Functional').length;
    const collapsed     = waterFeatures.filter(f => f.get('functional') === 'Collapsed/Abandoned').length;
    const pctFully      = totalWater > 0 ? pct(fullyFunc, totalWater) : null;
    const waterFuncClass = pctFully === null ? ''
        : parseFloat(pctFully) > 70 ? 'analytics-highlight-good'
        : parseFloat(pctFully) > 40 ? 'analytics-highlight-warn'
        : 'analytics-highlight-bad';

    // ── ROADS ─────────────────────────────────────────────────────────────
    const roadFeatures = roadsVectorSource.getFeatures();
    const totalRoads   = roadFeatures.length;
    const pavedRoads   = roadFeatures.filter(f => f.get('road_condi') === 'paved').length;
    const poorRoads    = roadFeatures.filter(f => f.get('road_struc') === 'Poor to very Poor').length;
    const pctPaved     = totalRoads > 0 ? pct(pavedRoads, totalRoads) : null;
    const pctPoorRoads = totalRoads > 0 ? pct(poorRoads,  totalRoads) : null;
    const roadCondClass = pctPoorRoads === null ? ''
        : parseFloat(pctPoorRoads) > 50 ? 'analytics-highlight-bad'
        : parseFloat(pctPoorRoads) > 25 ? 'analytics-highlight-warn'
        : 'analytics-highlight-good';

    // ── EDUCATION ─────────────────────────────────────────────────────────
    const schoolFeatures   = schoolVectorSource.getFeatures();
    const primarySchools   = schoolFeatures.filter(f => f.get('classifica') === 'Primary Schools');
    const secondarySchools = schoolFeatures.filter(f => f.get('classifica') === 'High Schools');
    const numPrimary       = primarySchools.length;
    const numSecondary     = secondarySchools.length;
    const totalPrimaryPupils = sum(primarySchools.map(f => f.get('total_pupi') || 0));
    const totalPrimaryTeach  = sum(primarySchools.map(f => f.get('teachers')   || 0));
    const priRatio           = totalPrimaryTeach > 0 ? (totalPrimaryPupils / totalPrimaryTeach).toFixed(1) : null;
    const priRatioClass = priRatio === null ? ''
        : parseFloat(priRatio) > 40 ? 'analytics-highlight-bad'
        : parseFloat(priRatio) > 30 ? 'analytics-highlight-warn'
        : 'analytics-highlight-good';

    // ── BUILD SNAPSHOT BULLET LISTS ───────────────────────────────────────

    // Population bullets (key flags only)
    let popBullets = `<ul>
        <li><b>${numWards} ward(s)</b> — total population <b>${totalPop.toLocaleString()}</b> (${pctFem}% female)</li>
        <li>Age split: <b>${pct014}%</b> children (0–14) · <b>${pct1564}%</b> working-age · <b>${pct65}%</b> aged 65+</li>
        <li>Estimated youth (15–35): <b>${youthEst.toLocaleString()} (${pctYouth}%)</b> — constitutional duty under <b>Sec. 20</b></li>`;
    if (parseFloat(pct014) > 40)
        popBullets += `<li class="analytics-highlight-warn">High child cohort — growing demand for ECD &amp; primary health services</li>`;
    if (parseFloat(pctFem) > 52)
        popBullets += `<li class="analytics-highlight-warn">Female majority — gender-responsive programming required across all sectors</li>`;
    popBullets += `</ul>`;

    // Poverty bullets
    let povBullets = `<ul>
        <li>Poverty prevalence: <span class="${povClass}"><b>${avgPrev}%</b></span> — <b>${pctPoor}%</b> of population (<b>${totalPoor.toLocaleString()}</b> people) below the poverty line</li>
        <li>Poverty gap index: <span class="${gapClass}"><b>${avgGap}</b></span> — ${parseFloat(avgGap) > 8 ? 'severe depth; substantial transfers needed' : parseFloat(avgGap) > 5 ? 'moderate depth; targeted transfers can close gap' : 'households close to datum line; small precise transfers effective'}</li>`;
    if (numWards > 1)
        povBullets += `<li>Highest burden: <span class="analytics-highlight-bad"><b>${worstPovName}</b></span> at ${(worstPovWard.get('poverty_pr') || 0).toFixed(1)}% — must anchor resource-targeting</li>`;
    povBullets += `<li>NDS1 target: social assistance coverage from 65% → <b>85% by 2025</b></li></ul>`;

    // Health bullets
    let healthBullets = totalHealth > 0
        ? `<ul>
            <li>Facilities: <span class="${healthClass}"><b>${totalHealth}</b></span> total — ${hospitals} hospital(s) · ${clinics} clinic(s)</li>
            <li>MoH standard: 1 primary care facility within <b>5 km</b> of every household</li>
            ${totalHealth < 3 ? `<li class="analytics-highlight-bad">Coverage critically low — deploy mobile health units &amp; telemedicine immediately</li>` : totalHealth < 8 ? `<li class="analytics-highlight-warn">Coverage moderate — map 5 km service zones against settlements to confirm gaps</li>` : `<li class="analytics-highlight-good">Facility count adequate — validate geographic distribution against 5 km standard</li>`}
            ${hospitals === 0 ? `<li class="analytics-highlight-warn">No hospital — document referral pathways to nearest district hospital</li>` : ''}
          </ul>`
        : `<ul><li>No health facility data loaded — select area and switch to the <b>Health tab</b></li></ul>`;

    // Water bullets
    let waterBullets = totalWater > 0
        ? `<ul>
            <li>Water points: <b>${totalWater}</b> total — <span class="${waterFuncClass}"><b>${pctFully}%</b> fully functional</span> · <b>${collapsed}</b> collapsed/abandoned</li>
            <li>National Water Policy benchmark: borehole serves ≤250 people · deep well ≤150 people within 500 m</li>
            ${parseFloat(pctFully) < 40 ? `<li class="analytics-highlight-bad">Functionality critically low — mobilise repair teams before dry season</li>` : parseFloat(pctFully) < 70 ? `<li class="analytics-highlight-warn">Partial failures present — schedule preventive maintenance now</li>` : `<li class="analytics-highlight-good">Functionality levels acceptable — continue monitoring</li>`}
          </ul>`
        : `<ul><li>No water point data loaded — select area and switch to the <b>Water tab</b></li></ul>`;

    // Roads bullets
    let roadsBullets = totalRoads > 0
        ? `<ul>
            <li>Road network: <b>${totalRoads}</b> segments — <b>${pctPaved}%</b> paved · <span class="${roadCondClass}"><b>${pctPoorRoads}%</b> in poor to very poor condition</span></li>
            ${parseFloat(pctPoorRoads) > 50 ? `<li class="analytics-highlight-bad">Critical connectivity deficit — undermines Vision 2030 investment-readiness &amp; farm-to-market access</li>` : parseFloat(pctPoorRoads) > 25 ? `<li class="analytics-highlight-warn">Significant degradation — schedule grading &amp; drainage works before the rainy season</li>` : `<li class="analytics-highlight-good">Road condition relatively sound — maintain unpaved segments through wet season</li>`}
          </ul>`
        : `<ul><li>No road data loaded — select area and switch to the <b>Roads tab</b></li></ul>`;

    // Education bullets
    let eduBullets = (numPrimary + numSecondary) > 0
        ? `<ul>
            <li>Schools: <b>${numPrimary}</b> primary (${totalPrimaryPupils.toLocaleString()} pupils) · <b>${numSecondary}</b> secondary</li>
            ${priRatio ? `<li>Primary pupil-teacher ratio: <span class="${priRatioClass}"><b>${priRatio}:1</b></span> (recommended max 30:1)</li>` : ''}
            ${numSecondary < 2 && numPrimary > 3 ? `<li class="analytics-highlight-warn">Only ${numSecondary} secondary school(s) for ${numPrimary} primary feeders — Form 1 dropout risk is high</li>` : ''}
          </ul>`
        : `<ul><li>No school data loaded — select area and switch to the <b>Education tab</b></li></ul>`;

    const sectionsHTML =
        section('Population &amp; Demography', popBullets)  +
        section('Poverty',                     povBullets)   +
        section('Healthcare Access',           healthBullets) +
        section('Water &amp; Sanitation',      waterBullets)  +
        section('Road Infrastructure',         roadsBullets)  +
        section('Education',                   eduBullets);

    // ── PRIORITY ACTIONS (cross-sectoral, non-repetitive) ────────────────
    const recs = [];
    if (parseFloat(avgPrev) > 45)
        recs.push(`Scale up cash transfers urgently — poverty at ${avgPrev}%, prioritising ${worstPovName}. Verify coverage against NDS1's 85% social assistance target.`);
    else if (parseFloat(avgPrev) > 25)
        recs.push(`Strengthen safety nets and microfinance — poverty at ${avgPrev}%. Focus on ${worstPovName} and cross-reference with NDS1 coverage targets.`);
    if (totalHealth > 0 && totalHealth < 3)
        recs.push(`Only ${totalHealth} health facilit${totalHealth === 1 ? 'y' : 'ies'} — deploy mobile units and telemedicine to settlement clusters outside the MoH 5 km catchment standard.`);
    if (pctFully !== null && parseFloat(pctFully) < 40)
        recs.push(`Water functionality at ${pctFully}% — mobilise emergency repairs and restore collapsed points before the dry season.`);
    if (pctPoorRoads !== null && parseFloat(pctPoorRoads) > 50)
        recs.push(`${pctPoorRoads}% of roads are in poor condition — commission a rehabilitation priority list ranked by economic and access impact before the rains.`);
    if (numSecondary < 2 && numPrimary > 3 && (numPrimary + numSecondary) > 0)
        recs.push(`Build additional secondary schools or satellite classrooms to absorb Form 1 demand from ${numPrimary} primary feeders and prevent structural post-primary dropout.`);
    if (priRatio !== null && parseFloat(priRatio) > 40)
        recs.push(`Primary pupil-teacher ratio of ${priRatio}:1 is critically high — submit urgent teacher deployment request and investigate qualification rates.`);
    if (parseFloat(pctFem) > 52)
        recs.push(`Female majority at ${pctFem}% — audit gender inclusivity across health, education and economic programmes to meet constitutional equality obligations.`);

    renderAnalytics(containerId, sectionsHTML, recs);
}

// ================= DEMOGRAPHY ANALYTICS =================
function updateDemographyAnalytics() {
    const features = wardVectorSource.getFeatures();
    const loc = getLocationLabel();
    const containerId = 'analytics-demography';

    if (!features.length) {
        renderAnalytics(containerId,
            section('Key Demographic Insight', '<p>No data available for the selected area.</p>'),
        []);
        return;
    }

    const totalPop  = sum(features.map(f => f.get('total_popu') || 0));
    const total014  = sum(features.map(f => (f.get('m_0_14')  || 0) + (f.get('f_0_14')  || 0)));
    const total1564 = sum(features.map(f => (f.get('m_15_64') || 0) + (f.get('f_15_64') || 0)));
    const total65   = sum(features.map(f => (f.get('m_65')    || 0) + (f.get('f_65')    || 0)));
    const totalMale = sum(features.map(f => (f.get('m_0_14')  || 0) + (f.get('m_15_64') || 0) + (f.get('m_65') || 0)));
    const totalFem  = totalPop - totalMale;

    const pct014  = pct(total014,  totalPop);
    const pct1564 = pct(total1564, totalPop);
    const pct65   = pct(total65,   totalPop);
    const pctMale = pct(totalMale, totalPop);
    const pctFem  = pct(totalFem,  totalPop);
    const youthEst = Math.round(total1564 * 0.60);
    const pctYouth = pct(youthEst, totalPop);

    const youthClass = parseFloat(pct014) > 45 ? 'analytics-highlight-warn' : 'analytics-highlight-good';
    const elderClass = parseFloat(pct65)  > 10 ? 'analytics-highlight-warn' : 'analytics-highlight-good';

    const insightBody = `<ul>
        <li>Total population: <b>${totalPop.toLocaleString()}</b> — <b>${pctMale}%</b> male · <b>${pctFem}%</b> female</li>
        <li>Children (0–14): <span class="${youthClass}"><b>${pct014}%</b></span> · Working-age (15–64): <b>${pct1564}%</b> · Aged 65+: <span class="${elderClass}"><b>${pct65}%</b></span></li>
        <li>Estimated youth (15–35): <b>${youthEst.toLocaleString()} (${pctYouth}%)</b> of total population</li>
        <li><b>Section 20, Zimbabwe Constitution</b> — State must take affirmative action to ensure youth participate in political, economic and social life; development plans must reflect this obligation</li>
    </ul>`;

    const implicationBody = `<ul>
        ${parseFloat(pct014) > 45
            ? `<li>Predominantly young population — high demand for expanded school capacity, ECD centres and paediatric health coverage</li>`
            : parseFloat(pct1564) > 55
                ? `<li>Large working-age cohort (<b>${pct1564}%</b>) — demographic dividend is only realised through employment creation, skills training and enterprise support; unrealised, it becomes pressure on social services</li>`
                : `<li>Broadly balanced age structure — monitor youth and elderly cohort growth to inform future service planning</li>`}
        ${parseFloat(pctFem) > 52
            ? `<li>Female majority (<b>${pctFem}%</b>) — equal access to education, health and economic resources must be a planning prerequisite, consistent with Zimbabwe's constitutional equality obligations</li>`
            : ''}
        ${parseFloat(pctYouth) > 30
            ? `<li>High youth share (<b>${pctYouth}%</b>) — develop a ward-level youth register; prioritise links to vocational training, agriculture, mining and small enterprise programmes aligned with Vision 2030</li>`
            : ''}
    </ul>`;

    const sectionsHTML =
        section('Population Profile', insightBody) +
        section('Planning Implications', implicationBody);

    const recs = [];
    if (parseFloat(pct014)  > 45) recs.push(`Youth proportion at ${pct014}% — expand primary school infrastructure, ECD centres and paediatric health facilities to match demand.`);
    if (parseFloat(pct65)   > 10) recs.push(`${pct65}% aged 65+ — scale up geriatric services and verify pension and food assistance coverage at ward level under the Older Persons Act.`);
    if (parseFloat(pctFem)  > 52) recs.push(`Female majority confirmed — audit gender inclusivity of health, education and economic empowerment programmes.`);
    if (parseFloat(pct1564) > 55) recs.push(`Working-age cohort at ${pct1564}% — invest in vocational training and entrepreneurship support; invoke Section 20 affirmative action measures for youth (15–35).`);
    if (parseFloat(pctYouth) > 30) recs.push(`Estimated ${youthEst.toLocaleString()} youth residents — link to skills development in agriculture, mining and small enterprise consistent with Vision 2030 priorities.`);

    renderAnalytics(containerId, sectionsHTML, recs);
}

// ================= WELFARE ANALYTICS =================
function updateWelfareAnalytics() {
    const features = wardVectorSource.getFeatures();
    const loc = getLocationLabel();
    const containerId = 'analytics-welfare';

    if (!features.length) {
        renderAnalytics(containerId,
            section('Poverty Overview', '<p>No data available for the selected area.</p>'),
        []);
        return;
    }

    const prevVals    = features.map(f => f.get('poverty_pr') || 0);
    const gapVals     = features.map(f => f.get('poverty_ga') || 0);
    const poorVals    = features.map(f => f.get('poor')       || 0);
    const nonPoorVals = features.map(f => f.get('none_poor')  || 0);

    const avgPrev      = avg(prevVals).toFixed(1);
    const avgGap       = avg(gapVals).toFixed(1);
    const totalPoor    = sum(poorVals);
    const totalNonPoor = sum(nonPoorVals);
    const totalPop     = totalPoor + totalNonPoor;
    const pctPoor      = pct(totalPoor, totalPop);

    const worstWard = features.reduce((a, b) => (b.get('poverty_pr') || 0) > (a.get('poverty_pr') || 0) ? b : a);
    const bestWard  = features.reduce((a, b) => (b.get('poverty_pr') || 0) < (a.get('poverty_pr') || 0) ? b : a);

    const prevClass = flag(parseFloat(avgPrev), 25, 45);
    const gapClass  = flag(parseFloat(avgGap),  5,  8);

    const overviewBody = `<ul>
        <li>Population below poverty line: <span class="${prevClass}"><b>${pctPoor}%</b></span> (<b>${totalPoor.toLocaleString()}</b> people)</li>
        <li>Average poverty prevalence: <span class="${prevClass}"><b>${avgPrev}%</b></span></li>
        ${features.length > 1
            ? `<li>Highest burden: <span class="analytics-highlight-bad"><b>Ward ${worstWard.get('wardnumber') || '?'}</b></span> at ${(worstWard.get('poverty_pr') || 0).toFixed(1)}% — must anchor resource-targeting decisions</li>
               <li>Best performer: <b>Ward ${bestWard.get('wardnumber') || '?'}</b> at ${(bestWard.get('poverty_pr') || 0).toFixed(1)}%</li>`
            : ''}
        <li><b>NDS1 target:</b> increase social assistance coverage from 65% (2020) to <b>85% by 2025</b></li>
    </ul>`;

    const depthBody = `<ul>
        <li>Poverty gap index: <span class="${gapClass}"><b>${avgGap}</b></span> — measures how far below the poverty datum line the average poor household sits</li>
        ${parseFloat(avgGap) > 8
            ? `<li class="analytics-highlight-bad">Severe depth — transfers must be <b>substantial</b> to move households above the datum line; incremental top-ups will not suffice</li>`
            : parseFloat(avgGap) > 5
                ? `<li class="analytics-highlight-warn">Moderate depth — well-targeted cash transfers and livelihood support can realistically achieve uplift; calibrate to actual shortfall, not generic amounts</li>`
                : `<li class="analytics-highlight-good">Households relatively close to the datum line — small, precise transfers can achieve rapid uplift if coverage is comprehensive</li>`}
    </ul>`;

    const sectionsHTML =
        section('Poverty Overview', overviewBody) +
        section('Depth of Poverty', depthBody);

    const recs = [];
    if (parseFloat(avgPrev) > 45)
        recs.push(`Critical poverty at ${avgPrev}% — immediately scale up cash transfers and food security interventions, prioritising Ward ${worstWard.get('wardnumber') || '?'}. Cross-reference with NDS1 social assistance coverage targets.`);
    else if (parseFloat(avgPrev) > 25)
        recs.push(`Moderate poverty at ${avgPrev}% — expand microfinance access and market linkage programmes, with Ward ${worstWard.get('wardnumber') || '?'} as the primary focus.`);
    if (parseFloat(avgGap) > 8)
        recs.push(`Poverty gap of ${avgGap} signals extreme depth — increase the value of existing social transfers; marginal top-ups will not move households above subsistence.`);
    if (features.length > 1)
        recs.push(`Run a multi-dimensional deprivation analysis overlaying poverty prevalence with water access, road condition and education enrolment to identify the most vulnerable households in Ward ${worstWard.get('wardnumber') || '?'} for priority social assistance registration.`);

    renderAnalytics(containerId, sectionsHTML, recs);
}

// ================= HEALTH ANALYTICS =================
function updateHealthAnalytics() {
    const loc = getLocationLabel();
    const containerId = 'analytics-health';
    const healthFeatures = healthVectorSource.getFeatures();
    const settFeatures   = settlementsVectorSource.getFeatures();

    if (!healthFeatures.length) {
        renderAnalytics(containerId,
            section('Health Facility Coverage', `<p>No health facility data available for <b>${loc}</b>. Select a province or constituency to load data.</p>`),
        []);
        return;
    }

    const total      = healthFeatures.length;
    const hospitals  = healthFeatures.filter(f => f.get('typeoffaci') === 'Hospital').length;
    const clinics    = healthFeatures.filter(f => f.get('typeoffaci') === 'Clinic').length;
    const pharmacies = healthFeatures.filter(f => f.get('typeoffaci') === 'Pharmacy').length;
    const numSettlements = settFeatures.length;
    const ratio = numSettlements > 0 ? (numSettlements / total).toFixed(1) : null;
    const facilityClass = total < 3 ? 'analytics-highlight-bad' : total < 8 ? 'analytics-highlight-warn' : 'analytics-highlight-good';

    const coverageBody = `<ul>
        <li>Total facilities: <span class="${facilityClass}"><b>${total}</b></span> — ${hospitals} hospital(s) · ${clinics} clinic(s) · ${pharmacies} pharmac${pharmacies === 1 ? 'y' : 'ies'}</li>
        ${ratio ? `<li>${numSettlements} settlement(s) mapped — roughly <b>1 facility per ${ratio} settlement(s)</b></li>` : ''}
        <li><b>MoH policy:</b> primary health care facility within a <b>5 km radius</b> for every community — communities beyond this face a structural access deficit</li>
        ${total < 3
            ? `<li class="analytics-highlight-bad">Coverage severely below standard — deploy <b>mobile health units and telemedicine</b> immediately as interim measures</li>`
            : total < 8
                ? `<li class="analytics-highlight-warn">Coverage moderate — map 5 km service zones against settlement clusters to quantify deficit; use mobile clinic circuits and telemedicine to bridge gaps</li>`
                : `<li class="analytics-highlight-good">Facility count appears adequate — validate geographic distribution against the 5 km threshold to confirm no settlements fall into deficit zones</li>`}
        ${pharmacies === 0 ? `<li class="analytics-highlight-warn">No pharmacy present — explore community medicine depot or mobile dispensary models</li>` : ''}
    </ul>`;

    const sectionsHTML = section('Health Facility Coverage', coverageBody);

    const recs = [];
    if (total < 3)        recs.push(`Only ${total} facilit${total === 1 ? 'y' : 'ies'} — well below the MoH 5 km standard. Deploy mobile health units and establish telemedicine access points in underserved settlement clusters immediately.`);
    if (hospitals === 0)  recs.push(`No hospital recorded — document and communicate referral pathways to the nearest district hospital for all community health workers and village health promoters.`);
    if (pharmacies === 0) recs.push(`No pharmacy present — explore community medicine depot systems or mobile dispensary models to ensure essential drug access in areas outside the facility catchment.`);
    if (clinics < 2)      recs.push(`Only ${clinics} clinic(s) — prioritise primary care clinic construction or upgrading of existing health posts, targeting settlements outside the 5 km service zone.`);
    recs.push(`Map the 5 km service zones against settlement locations to quantify the exact proportion of the constituency area and population outside the MoH catchment standard. Use this deficit map to drive mobile health scheduling and capital planning.`);

    renderAnalytics(containerId, sectionsHTML, recs);
}

// ================= ROADS ANALYTICS =================
function updateRoadsAnalytics() {
    const loc = getLocationLabel();
    const containerId = 'analytics-roads';
    const roadFeatures = roadsVectorSource.getFeatures();

    if (!roadFeatures.length) {
        renderAnalytics(containerId,
            section('Road Network Assessment', `<p>No road network data available for <b>${loc}</b>.</p>`),
        []);
        return;
    }

    const total   = roadFeatures.length;
    const paved   = roadFeatures.filter(f => f.get('road_condi') === 'paved').length;
    const unpaved = roadFeatures.filter(f => f.get('road_condi') === 'unpaved').length;
    const poor    = roadFeatures.filter(f => f.get('road_struc') === 'Poor to very Poor').length;
    const fair    = total - poor;

    const pctPaved   = pct(paved,   total);
    const pctPoor    = pct(poor,    total);
    const pctUnpaved = pct(unpaved, total);
    const pctFair    = pct(fair,    total);

    const surfClass = parseFloat(pctPaved) > 50 ? 'analytics-highlight-good' : parseFloat(pctPaved) > 20 ? 'analytics-highlight-warn' : 'analytics-highlight-bad';
    const condClass = parseFloat(pctPoor)  > 50 ? 'analytics-highlight-bad'  : parseFloat(pctPoor)  > 25 ? 'analytics-highlight-warn' : 'analytics-highlight-good';

    const assessmentBody = `<ul>
        <li>Network: <b>${total}</b> segments — <span class="${surfClass}"><b>${pctPaved}%</b> paved</span> · <b>${pctUnpaved}%</b> unpaved or gravel</li>
        <li>Structural condition: <span class="${condClass}"><b>${pctPoor}%</b> poor to very poor</span> · <b>${pctFair}%</b> fair or better</li>
        ${parseFloat(pctPoor) > 50
            ? `<li class="analytics-highlight-bad">Critical connectivity deficit — directly undermines Vision 2030 investment attraction and farm-to-market agricultural access</li>`
            : parseFloat(pctPoor) > 25
                ? `<li class="analytics-highlight-warn">Significant degradation — schedule grading, pothole repair and drainage clearing before the rainy season to protect market access</li>`
                : `<li class="analytics-highlight-good">Structural condition relatively sound — maintain unpaved segments during wet season to protect economic connectivity</li>`}
        <li>Poor roads directly suppress smallholder income by preventing timely movement of perishable goods, livestock and inputs — key constraint on Vision 2030 agricultural growth targets</li>
    </ul>`;

    const sectionsHTML = section('Road Network Assessment', assessmentBody);

    const recs = [];
    if (parseFloat(pctPaved) < 20)
        recs.push(`Only ${pctPaved}% paved — prioritise tarring of arterial routes connecting wards to markets, health facilities and schools to support Vision 2030 investment attraction and agricultural produce mobility.`);
    if (parseFloat(pctPoor) > 50)
        recs.push(`${pctPoor}% of the network is in poor condition — commission a condition survey and publish a rehabilitation priority list ranked by economic and agricultural access impact.`);
    else if (parseFloat(pctPoor) > 25)
        recs.push(`${pctPoor}% of roads show structural degradation — schedule grading, pothole patching and drainage clearing before the onset of the rainy season.`);
    if (unpaved > paved)
        recs.push(`Unpaved roads dominate at ${pctUnpaved}% — gravel re-sheeting and side-drain construction offer cost-effective near-term improvements extending wet-season usability.`);
    if (parseFloat(pctPoor) > 25)
        recs.push(`Map poor-condition road segments against agricultural production areas and health facility locations to identify access-deficit corridors suppressing economic output and emergency response capacity.`);

    renderAnalytics(containerId, sectionsHTML, recs);
}

// ================= WATER ANALYTICS =================
function updateWaterAnalytics() {
    const loc = getLocationLabel();
    const containerId = 'analytics-water';
    const waterFeatures = waterVectorSource.getFeatures();

    if (!waterFeatures.length) {
        renderAnalytics(containerId,
            section('Water Point Status', `<p>No water point data available for <b>${loc}</b>.</p>`),
        []);
        return;
    }

    const total        = waterFeatures.length;
    const fully        = waterFeatures.filter(f => f.get('functional') === 'Fully Functional').length;
    const partial      = waterFeatures.filter(f => f.get('functional') === 'Partially Functional').length;
    const collapsed    = waterFeatures.filter(f => f.get('functional') === 'Collapsed/Abandoned').length;
    const naStatus     = waterFeatures.filter(f => f.get('functional') === 'N/A').length;
    const boreholes    = waterFeatures.filter(f => f.get('type') === 'Borehole').length;
    const deepWells    = waterFeatures.filter(f => f.get('type') === 'Deep Well').length;
    const shallowWells = waterFeatures.filter(f => f.get('type') === 'Shallow Well').length;
    const dams         = waterFeatures.filter(f => f.get('type') === 'Dam').length;
    const springs      = waterFeatures.filter(f => f.get('type') === 'Spring').length;

    const pctFully    = pct(fully,     total);
    const pctPartial  = pct(partial,   total);
    const pctCollapse = pct(collapsed, total);

    const boreholeCapacity = boreholes * 250;
    const deepWellCapacity = deepWells * 150;
    const totalCapacity    = boreholeCapacity + deepWellCapacity;

    const funcClass     = parseFloat(pctFully)    > 70 ? 'analytics-highlight-good' : parseFloat(pctFully)    > 40 ? 'analytics-highlight-warn' : 'analytics-highlight-bad';
    const collapseClass = parseFloat(pctCollapse) > 20 ? 'analytics-highlight-bad'  : parseFloat(pctCollapse) > 10 ? 'analytics-highlight-warn' : 'analytics-highlight-good';

    const statusBody = `<ul>
        <li>Total water points: <b>${total}</b> — <span class="${funcClass}"><b>${pctFully}%</b> fully functional</span> · <b>${pctPartial}%</b> partially functional · <span class="${collapseClass}"><b>${pctCollapse}%</b> collapsed/abandoned</span></li>
        ${naStatus > 0 ? `<li class="analytics-highlight-warn">Status unverified for <b>${naStatus}</b> point(s) — organise field verification to eliminate blind spots</li>` : ''}
        ${parseFloat(pctFully) < 40
            ? `<li class="analytics-highlight-bad">Functionality critically low — mobilise emergency repair teams; National Water Policy recognises water access as a <b>fundamental human right</b></li>`
            : parseFloat(pctFully) < 70
                ? `<li class="analytics-highlight-warn">${partial} partially functional point(s) risk full failure — schedule preventive maintenance immediately</li>`
                : `<li class="analytics-highlight-good">Functionality levels acceptable — continue scheduled maintenance to sustain coverage</li>`}
        ${collapsed > 0 ? `<li>Collapsed/abandoned: <b>${collapsed}</b> point(s) — conduct rehabilitation feasibility assessment to recover lost capacity</li>` : ''}
    </ul>`;

    const sourceBody = `<ul>
        <li>Source mix: boreholes <b>${boreholes}</b> · deep wells <b>${deepWells}</b> · shallow wells <b>${shallowWells}</b> · dams <b>${dams}</b> · springs <b>${springs}</b></li>
        <li><b>National Water Policy benchmarks:</b> 1 borehole ≤ 250 people · 1 deep well ≤ 150 people · max service distance 500 m</li>
        <li>Policy-rated combined capacity (boreholes + deep wells): <b>${totalCapacity.toLocaleString()} people</b></li>
        ${shallowWells > boreholes
            ? `<li class="analytics-highlight-warn">Shallow wells outnumber boreholes (${shallowWells} vs ${boreholes}) — higher contamination risk and first to fail in the dry season; upgrade to protected sources is a policy priority</li>`
            : boreholes > 0
                ? `<li class="analytics-highlight-good">Boreholes form the primary supply base — consistent with the Policy preference for protected sources</li>`
                : ''}
    </ul>`;

    const sectionsHTML =
        section('Water Point Status', statusBody) +
        section('Source Mix &amp; Capacity', sourceBody);

    const recs = [];
    if (parseFloat(pctFully) < 40)
        recs.push(`Functionality rate critically low at ${pctFully}% — mobilise emergency repair teams for the ${total - fully} non-fully-functional points before the dry season.`);
    else if (parseFloat(pctFully) < 70)
        recs.push(`${partial} partially functional point(s) risk full failure — schedule preventive maintenance immediately and verify usage against Policy benchmarks.`);
    if (collapsed > 0)
        recs.push(`${collapsed} collapsed or abandoned point(s) — conduct a rehabilitation feasibility assessment to recover lost capacity.`);
    if (shallowWells > boreholes)
        recs.push(`Shallow wells outnumber boreholes (${shallowWells} vs ${boreholes}) — prioritise borehole drilling or upgrading to shift reliance to protected sources, consistent with the National Water Policy.`);
    if (naStatus > 0)
        recs.push(`${naStatus} point(s) with unknown status — organise a field verification exercise to update the dataset and eliminate blind spots in coverage planning.`);
    if (totalCapacity > 0)
        recs.push(`Rated capacity is ${totalCapacity.toLocaleString()} people per policy benchmarks. Cross-check against actual registered users to identify points operating above capacity and prioritise for supplementation.`);

    renderAnalytics(containerId, sectionsHTML, recs);
}

// ================= EDUCATION ANALYTICS =================
function updateEducationAnalytics(level) {
    const loc = getLocationLabel();
    const containerId = 'analytics-education';
    const schoolFeatures = schoolVectorSource.getFeatures().filter(f =>
        level === 'primary' ? f.get('classifica') === 'Primary Schools' : f.get('classifica') === 'High Schools'
    );

    if (!schoolFeatures.length) {
        renderAnalytics(containerId,
            section('Enrolment Overview', `<p>No ${level} school data available for <b>${loc}</b>.</p>`),
        []);
        return;
    }

    const total       = schoolFeatures.length;
    const totalMale   = sum(schoolFeatures.map(f => f.get('enrol_male') || 0));
    const totalFem    = sum(schoolFeatures.map(f => f.get('enrol_fema') || 0));
    const totalPupils = sum(schoolFeatures.map(f => f.get('total_pupi') || 0));
    const totalTeach  = sum(schoolFeatures.map(f => f.get('teachers')   || 0));

    const totalQual   = sum(schoolFeatures.map(f =>
        f.get('qualified_t') !== undefined ? (f.get('qualified_t') || 0) : (f.get('teachers') || 0)));
    const totalUnqual = totalTeach - totalQual;
    const pctQual     = totalTeach > 0 ? pct(totalQual, totalTeach) : null;

    const avgRatio    = totalTeach > 0 ? (totalPupils / totalTeach).toFixed(1) : 'N/A';
    const pctFemStr   = pct(totalFem,  totalPupils);
    const pctMaleStr  = pct(totalMale, totalPupils);
    const ratioNum    = parseFloat(avgRatio);
    const ratioClass  = ratioNum > 40 ? 'analytics-highlight-bad' : ratioNum > 30 ? 'analytics-highlight-warn' : 'analytics-highlight-good';
    const genderClass = parseFloat(pctFemStr) < 45 ? 'analytics-highlight-warn' : 'analytics-highlight-good';
    const qualClass   = pctQual === null ? ''
        : parseFloat(pctQual) > 85 ? 'analytics-highlight-good'
        : parseFloat(pctQual) > 70 ? 'analytics-highlight-warn'
        : 'analytics-highlight-bad';
    const levelLabel  = level === 'primary' ? 'Primary' : 'Secondary (High)';

    const allPrimary   = schoolVectorSource.getFeatures().filter(f => f.get('classifica') === 'Primary Schools');
    const allSecondary = schoolVectorSource.getFeatures().filter(f => f.get('classifica') === 'High Schools');
    const numPri       = allPrimary.length;
    const numSec       = allSecondary.length;

    const enrolmentBody = `<ul>
        <li><b>${total} ${levelLabel} school(s)</b> — <b>${totalPupils.toLocaleString()}</b> pupils enrolled (<span class="${genderClass}"><b>${pctFemStr}%</b> female</span> · ${pctMaleStr}% male)</li>
        ${parseFloat(pctFemStr) < 45
            ? `<li class="analytics-highlight-warn">Female enrolment below parity at ${pctFemStr}% — structural or social barriers likely exist; investigate and introduce safe sanitation, mentorship and community sensitisation</li>`
            : `<li class="analytics-highlight-good">Gender parity broadly maintained — a positive indicator for inclusive access</li>`}
    </ul>`;

    const capacityBody = `<ul>
        <li>Pupil-teacher ratio: <span class="${ratioClass}"><b>${avgRatio}:1</b></span> — recommended maximum <b>30:1</b>
            ${ratioNum > 40 ? ' · critically above ceiling; class sizes severely undermine individual learning' : ratioNum > 30 ? ' · exceeds threshold; include teacher recruitment in next planning cycle' : ratioNum > 0 ? ' · within acceptable limits' : ''}</li>
        <li>Teacher qualification: <b>${totalTeach}</b> total —
            ${pctQual !== null
                ? `<span class="${qualClass}"><b>${pctQual}%</b> qualified</span> · <b>${totalUnqual}</b> unqualified`
                : `qualification data not available`}
        </li>
        <li>Unqualified teachers disproportionately affect outcomes in lower-income communities where pupils have fewer supplementary resources at home</li>
    </ul>`;

    const structuralBody = level === 'primary' && (numPri + numSec) > 0
        ? `<ul>
            <li>Primary schools are the Form 1 feeder pipeline — insufficient secondary capacity drives post-primary dropout, reducing lifetime earnings especially for girls</li>
            ${numSec < 2 && numPri > 3
                ? `<li class="analytics-highlight-warn">Only <b>${numSec}</b> secondary school(s) serving <b>${numPri}</b> primary feeders — Form 1 dropout is near-inevitable for a portion of graduates; new secondary schools or satellite classrooms are needed</li>`
                : numSec >= numPri
                    ? `<li class="analytics-highlight-good">Secondary-to-primary ratio is relatively balanced</li>`
                    : `<li>Monitor Form 1 take-up rates as primary enrolment grows to detect emerging transition pressure before it becomes a dropout crisis</li>`}
          </ul>`
        : '';

    const sectionsHTML =
        section('Enrolment Overview',          enrolmentBody) +
        section('Capacity &amp; Teaching Load', capacityBody) +
        (structuralBody ? section('Primary–Secondary Transition Risk', structuralBody) : '');

    const recs = [];
    if (ratioNum > 40)
        recs.push(`Pupil-teacher ratio of ${avgRatio}:1 is critically high — submit an urgent teacher deployment request and explore community volunteer teacher models as a bridge solution.`);
    else if (ratioNum > 30)
        recs.push(`Ratio of ${avgRatio}:1 exceeds the 30:1 ceiling — include teacher recruitment for ${loc} in the next district staffing plan.`);
    if (parseFloat(pctFemStr) < 45)
        recs.push(`Female enrolment at ${pctFemStr}% — implement safe sanitation facilities, mentorship programmes and community sensitisation campaigns on girls' education.`);
    if (pctQual !== null && parseFloat(pctQual) < 70)
        recs.push(`Qualified teacher rate at ${pctQual}% is below acceptable levels — prioritise teacher training and upgrading programmes, and review recruitment standards.`);
    if (total < 3)
        recs.push(`Only ${total} ${levelLabel.toLowerCase()} school(s) — assess whether satellite classrooms or an additional school site can reduce travel distances for outlying communities.`);
    if (level === 'primary') {
        recs.push(`Track grade-by-grade completion rates alongside enrolment to detect dropout patterns early and deploy retention interventions before pupils disengage.`);
        if (numSec < 2 && numPri > 3)
            recs.push(`Prioritise secondary school construction or satellite classroom expansion to absorb Form 1 demand from ${numPri} primary feeders and prevent structural post-primary dropout.`);
    }

    renderAnalytics(containerId, sectionsHTML, recs);
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
        <strong>Ownership:</strong> ${ownership}<br/>
        <strong>Female:</strong> ${female} &nbsp;|&nbsp; <strong>Male:</strong> ${male}<br/>
        <strong>Total Pupils:</strong> ${total}<br/>
        <strong>Teachers:</strong> ${teachers} &nbsp;|&nbsp; <strong>Ratio:</strong> ${ratio}
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
const wardLayer         = new ol.layer.Vector({ source: wardVectorSource,        style: overviewStyle });
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

// ---------------- MAP STYLES ----------------
function overviewStyle(f) {
    return new ol.style.Style({
        fill:   new ol.style.Fill({ color: 'rgba(200,200,200,0.3)' }),
        stroke: new ol.style.Stroke({ color: '#555', width: 1 }),
        text:   new ol.style.Text({
            text:   String(f.get('wardnumber') || ''),
            font:   'bold 14px "DM Sans", Calibri, sans-serif',
            fill:   new ol.style.Fill({ color: '#000' }),
            stroke: new ol.style.Stroke({ color: '#fff', width: 2 })
        })
    });
}

function wardLabelStyle(f) {
    return new ol.style.Style({
        text: new ol.style.Text({
            text:   String(f.get('wardnumber') || ''),
            font:   'bold 14px "DM Sans", Calibri, sans-serif',
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
    if      (status === 'Fully Functional')     color = '#2ca25f';
    else if (status === 'Partially Functional') color = '#fc9272';
    else if (status === 'Collapsed/Abandoned')  color = '#3182bd';
    else if (status === 'N/A')                  color = '#800080';
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
    const centerX = radiusX, centerY = radiusX;
    const depth = radiusScale * 0.25;
    const canvasSize = radiusX * 2 + depth + 2;
    const canvas = document.createElement('canvas');
    canvas.width = canvasSize; canvas.height = canvasSize;
    const ctx = canvas.getContext('2d');
    let startAngle = 0;
    const slices = [
        { value: male,   color: C_BLUE, shadow: '#1e488c' },
        { value: female, color: C_PINK, shadow: '#b14f7c' }
    ];
    slices.forEach(slice => {
        const angle = (slice.value / total) * 2 * Math.PI;
        if (angle === 0) return;
        ctx.beginPath(); ctx.moveTo(centerX, centerY);
        ctx.ellipse(centerX, centerY + depth, radiusX, radiusY, 0, startAngle, startAngle + angle);
        ctx.lineTo(centerX, centerY); ctx.closePath();
        ctx.fillStyle = slice.shadow; ctx.fill();
        ctx.strokeStyle = '#000'; ctx.stroke();
        startAngle += angle;
    });
    startAngle = 0;
    slices.forEach(slice => {
        const angle = (slice.value / total) * 2 * Math.PI;
        if (angle === 0) return;
        ctx.beginPath(); ctx.moveTo(centerX, centerY);
        ctx.ellipse(centerX, centerY, radiusX, radiusY, 0, startAngle, startAngle + angle);
        ctx.closePath();
        ctx.fillStyle = slice.color; ctx.fill();
        ctx.strokeStyle = '#000'; ctx.stroke();
        startAngle += angle;
    });
    return new ol.style.Style({
        image: new ol.style.Icon({ img: canvas, imgSize: [canvasSize, canvasSize] }),
        text:  new ol.style.Text({
            text:    f.get('name') || '',
            font:    '12px "DM Sans", Calibri, sans-serif',
            fill:    new ol.style.Fill({ color: '#000' }),
            stroke:  new ol.style.Stroke({ color: '#fff', width: 2 }),
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
        image: new ol.style.Circle({
            radius: 6,
            fill:   new ol.style.Fill({ color }),
            stroke: new ol.style.Stroke({ color: '#fff', width: 1 })
        }),
        text: new ol.style.Text({
            text:   f.get('nameoffaci') || '',
            offsetY: -10,
            font:   '12px "DM Sans", Calibri, sans-serif',
            fill:   new ol.style.Fill({ color: '#000' }),
            stroke: new ol.style.Stroke({ color: '#fff', width: 2 })
        })
    });
}

function settlementsStyle() {
    return new ol.style.Style({
        fill:   new ol.style.Fill({ color: '#b87f53' }),
        stroke: new ol.style.Stroke({ color: '#b87f53', width: 1 })
    });
}

function settlementsEducationStyle() {
    return new ol.style.Style({
        fill:   new ol.style.Fill({ color: '#d14b11' }),
        stroke: new ol.style.Stroke({ color: '#820707', width: 1 })
    });
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
        RAW.ward.features.filter(f => f.properties.province === elProv.value)
            .map(f => f.properties.constituen).filter(v => v != null)
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
const tabWater      = document.getElementById('tab-water');
const tabEducation  = document.getElementById('tab-education');

tabOverview.onclick   = () => switchTab('overview');
tabDemography.onclick = () => switchTab('demography');
tabWelfare.onclick    = () => switchTab('welfare');
tabHealth.onclick     = () => switchTab('health');
tabRoads.onclick      = () => switchTab('roads');
tabWater.onclick      = () => switchTab('water');
tabEducation.onclick  = () => switchTab('education');

const overviewContent   = document.getElementById('overview-content');
const demographyContent = document.getElementById('demography-content');
const welfareContent    = document.getElementById('welfare-content');
const healthContent     = document.getElementById('health-content');
const roadsContent      = document.getElementById('roads-content');
const waterContent      = document.getElementById('water-content');
const educationContent  = document.getElementById('education-content');

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

const btnWaterFunctional    = document.getElementById('btn-water-functional');
const btnWaterType          = document.getElementById('btn-water-type');
const waterLegendFunctional = document.getElementById('water-legend-functional');
const waterLegendType       = document.getElementById('water-legend-type');

const btnEducationPrimary   = document.getElementById('btn-education-primary');
const btnEducationSecondary = document.getElementById('btn-education-secondary');

const healthLegendFacilities = document.getElementById('health-legend-facilities');
const healthLegendService    = document.getElementById('health-legend-service');
const healthLegendDeficit    = document.getElementById('health-legend-deficit');

// ---- Road sub-tabs ----
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

// ---- Water sub-tabs ----
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

// ---- Education sub-tabs ----
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

// ---- Health sub-tabs ----
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
        healthVector.setStyle(() => new ol.style.Style({
            image: new ol.style.Circle({ radius: 6, fill: new ol.style.Fill({ color: '#3182bd' }) })
        }));
        bufferVector.setStyle(new ol.style.Style({
            fill:   new ol.style.Fill({ color: 'rgba(102,194,165,0.4)' }),
            stroke: new ol.style.Stroke({ color: '#555', width: 1 })
        }));
        settlementsVector.setStyle(settlementsStyle);
        healthLegendService.style.display = 'block';
    } else if (tab === 'deficit') {
        healthVector.setVisible(true); bufferVector.setVisible(true);
        settlementsVector.setVisible(true); roadsVector.setVisible(true);
        healthVector.setStyle(() => new ol.style.Style({
            image: new ol.style.Circle({ radius: 6, fill: new ol.style.Fill({ color: '#aaa' }) })
        }));
        bufferVector.setStyle(new ol.style.Style({
            fill:   new ol.style.Fill({ color: 'rgba(255,255,255,0.6)' }),
            stroke: new ol.style.Stroke({ color: '#aaa', width: 1 })
        }));
        roadsVector.setStyle(roadsDeficitStyle);
        settlementsVector.setStyle(settlementsStyle);
        healthLegendDeficit.style.display = 'block';
    }
    map.removeLayer(healthVector);
    map.addLayer(healthVector);
    updateHealthAnalytics();
}

function setActiveHealthTab(activeBtn) {
    [btnHealthDist, btnHealthZone, btnHealthDeficit].forEach(b => b.classList.remove('active'));
    activeBtn.classList.add('active');
}

// ---- Welfare sub-tabs ----
btnPrev.onclick = () => {
    welfareMode = 'prevalence';
    btnPrev.classList.add('active'); btnGap.classList.remove('active');
    applyWelfareStyle(); updateWelfareStats();
};
btnGap.onclick = () => {
    welfareMode = 'gap';
    btnGap.classList.add('active'); btnPrev.classList.remove('active');
    applyWelfareStyle(); updateWelfareStats();
};

btnHealthDist.onclick    = () => { setActiveHealthTab(btnHealthDist);    applyHealthTab('facilities'); };
btnHealthZone.onclick    = () => { setActiveHealthTab(btnHealthZone);    applyHealthTab('service'); };
btnHealthDeficit.onclick = () => { setActiveHealthTab(btnHealthDeficit); applyHealthTab('deficit'); };

// ---------------- ZOOM ----------------
document.getElementById('zoom-layer').onclick = () => {
    const features = wardVectorSource.getFeatures();
    if (!features.length) return;
    const extent = features.reduce(
        (acc, f) => ol.extent.extend(acc, f.getGeometry().getExtent()),
        ol.extent.createEmpty()
    );
    map.getView().fit(extent, { padding: [50, 50, 50, 50], duration: 800 });
};

// ================= SWITCH TAB =================
function switchTab(mode) {
    [overviewContent, demographyContent, welfareContent, healthContent,
     roadsContent, waterContent, educationContent].forEach(el => el.style.display = 'none');

    [popLegend, prevLegend, gapLegend,
     healthLegendFacilities, healthLegendService, healthLegendDeficit].forEach(el => el.style.display = 'none');
    document.getElementById('education-legend').style.display       = 'none';
    document.getElementById('roads-legend-condition').style.display = 'none';
    document.getElementById('roads-legend-surface').style.display   = 'none';
    waterLegendFunctional.style.display = 'none';
    waterLegendType.style.display       = 'none';

    [tabOverview, tabDemography, tabWelfare, tabHealth,
     tabRoads, tabWater, tabEducation].forEach(t => t.classList.remove('active'));

    healthVector.setVisible(false);
    bufferVector.setVisible(false);
    roadsVector.setVisible(false);
    settlementsVector.setVisible(false);
    waterVector.setVisible(false);
    schoolVector.setVisible(false);

    if (mode === 'overview') {
        overviewContent.style.display = 'block';
        tabOverview.classList.add('active');
        wardLayer.setStyle(overviewStyle);
        updateOverviewAnalytics();
    }
    else if (mode === 'demography') {
        demographyContent.style.display = 'block';
        tabDemography.classList.add('active');
        wardLayer.setStyle(demographyStyle);
        popLegend.style.display = 'block';
        updatePopulationStats();
    }
    else if (mode === 'welfare') {
        welfareContent.style.display = 'block';
        tabWelfare.classList.add('active');
        applyWelfareStyle();
        updateWelfareStats();
        updateWelfareChart();
    }
    else if (mode === 'health') {
        healthContent.style.display = 'block';
        tabHealth.classList.add('active');
        wardLayer.setStyle(overviewStyle);
        setActiveHealthTab(btnHealthDist);
        applyHealthTab('facilities');
    }
    else if (mode === 'roads') {
        roadsContent.style.display = 'block';
        tabRoads.classList.add('active');
        wardLayer.setStyle(overviewStyle);
        roadsVector.setVisible(true);
        applyRoadFilter();
        roadsVector.setStyle(roadConditionStyle);
        document.getElementById('roads-legend-condition').style.display = 'block';
        btnRoadCondition.classList.add('active');
        btnRoadSurface.classList.remove('active');
        updateRoadsAnalytics();
    }
    else if (mode === 'water') {
        waterContent.style.display = 'block';
        tabWater.classList.add('active');
        wardLayer.setStyle(overviewStyle);
        applyWaterFilter();
        btnWaterFunctional.click();
        map.removeLayer(waterVector);
        map.addLayer(waterVector);
    }
    else if (mode === 'education') {
        educationContent.style.display = 'block';
        tabEducation.classList.add('active');
        wardLayer.setStyle(overviewStyle);
        document.getElementById('education-legend').style.display = 'block';
        applySchoolFilter();
        applySettlementFilter();
        schoolVector.setVisible(true);
        settlementsVector.setVisible(true);
        map.removeLayer(schoolVector);
        map.addLayer(schoolVector);
        updateEducationAnalytics('primary');
    }
}

// ---------------- WELFARE HELPERS ----------------
let welfareMode = 'prevalence';

function applyWelfareStyle() {
    if (welfareMode === 'prevalence') {
        wardLayer.setStyle(prevalenceStyle);
        prevLegend.style.display = 'block';
        gapLegend.style.display  = 'none';
    } else {
        wardLayer.setStyle(gapStyle);
        gapLegend.style.display  = 'block';
        prevLegend.style.display = 'none';
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

    const chartOptions = {
        responsive: true,
        maintainAspectRatio: true,
        plugins: {
            legend: {
                position: 'top',
                labels: {
                    font: { family: "'DM Sans', sans-serif", size: 12 },
                    usePointStyle: true,
                    padding: 16,
                    color: '#1a1a14'
                }
            }
        },
        scales: {
            x: {
                grid: { display: false },
                ticks: {
                    autoSkip: false,
                    maxRotation: 45,
                    minRotation: 30,
                    font: { family: "'DM Sans', sans-serif", size: 11 },
                    color: '#6b6555'
                }
            },
            y: {
                grid: { color: '#ece8de' },
                ticks: {
                    font: { family: "'DM Mono', monospace", size: 11 },
                    color: '#6b6555'
                }
            }
        }
    };

    const makeDatasets = (mData, fData, cohortLabel) => ([
        {
            label: `Male ${cohortLabel}`,
            data: mData,
            backgroundColor: C_MALE,
            borderColor: C_GREEN_DARK,
            borderWidth: 1,
            borderRadius: 4
        },
        {
            label: `Female ${cohortLabel}`,
            data: fData,
            backgroundColor: C_FEMALE,
            borderColor: '#a07020',
            borderWidth: 1,
            borderRadius: 4
        }
    ]);

    chart0_14 = new Chart(document.getElementById('chart_0_14'), {
        type: 'bar',
        data: { labels, datasets: makeDatasets(m_0_14, f_0_14, '(0–14)') },
        options: chartOptions
    });
    chart15_64 = new Chart(document.getElementById('chart_15_64'), {
        type: 'bar',
        data: { labels, datasets: makeDatasets(m_15_64, f_15_64, '(15–64)') },
        options: chartOptions
    });
    chart65 = new Chart(document.getElementById('chart_65'), {
        type: 'bar',
        data: { labels, datasets: makeDatasets(m_65, f_65, '(65+)') },
        options: chartOptions
    });
}

function updateWelfareStats() {
    const data   = wardVectorSource.getFeatures();
    const field  = welfareMode === 'prevalence' ? 'poverty_pr' : 'poverty_ga';
    const vals   = data.map(f => f.get(field) || 0);
    const avgVal = vals.length ? (vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(2) : 'N/A';
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
        labels      = ['Selected Ward'];
        poorData    = [f ? f.get('poor')     || 0 : 0];
        nonPoorData = [f ? f.get('none_poor')|| 0 : 0];
    } else if (isConst) {
        features.forEach(f => {
            labels.push('Ward ' + (f.get('wardnumber') || ''));
            poorData.push(f.get('poor') || 0);
            nonPoorData.push(f.get('none_poor') || 0);
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
        labels.forEach(c => {
            poorData.push(grouped[c].poor);
            nonPoorData.push(grouped[c].none_poor);
        });
    }

    const ctx = document.getElementById('welfareChart').getContext('2d');
    if (welfareChart) welfareChart.destroy();

    welfareChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels,
            datasets: [
                {
                    label: 'Poor',
                    data: poorData,
                    backgroundColor: C_POOR,
                    borderColor: '#8a1f1f',
                    borderWidth: 1,
                    borderRadius: 4
                },
                {
                    label: 'Non-Poor',
                    data: nonPoorData,
                    backgroundColor: C_NON_POOR,
                    borderColor: '#2d6a45',
                    borderWidth: 1,
                    borderRadius: 4
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                title: {
                    display: true,
                    text: isWard ? 'Welfare — Selected Ward' : isConst ? 'Welfare by Ward' : 'Welfare by Constituency',
                    font: { family: "'Playfair Display', serif", size: 14, weight: '600' },
                    color: '#1a3d2b',
                    padding: { bottom: 14 }
                },
                legend: {
                    position: 'top',
                    labels: {
                        font: { family: "'DM Sans', sans-serif", size: 12 },
                        usePointStyle: true,
                        padding: 16,
                        color: '#1a1a14'
                    }
                }
            },
            scales: {
                x: {
                    grid: { display: false },
                    ticks: {
                        font: { family: "'DM Sans', sans-serif", size: 11 },
                        color: '#6b6555'
                    }
                },
                y: {
                    beginAtZero: true,
                    grid: { color: '#ece8de' },
                    ticks: {
                        font: { family: "'DM Mono', monospace", size: 11 },
                        color: '#6b6555'
                    }
                }
            }
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