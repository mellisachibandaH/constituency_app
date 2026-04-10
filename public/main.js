// ================= CONFIG =================
// Place your GeoJSON files in a /data/ folder alongside this script
const DATA_PATH = '/data';

const GEOJSON_FILES = {
    ward:        `${DATA_PATH}/Matnort_2.json`,
    health:      `${DATA_PATH}/Health_2.json`,
    healthBuffer:`${DATA_PATH}/Health_buffer.json`,
    roads:       `${DATA_PATH}/lovedroads.json`,
    settlements: `${DATA_PATH}/settlements_2.json`,
    water:       `${DATA_PATH}/Waterpoint_3.json`,
    school:      `${DATA_PATH}/school_4.json`,
};

// ================= DATA STORE =================
// All GeoJSON data loaded once at startup
const DATA = {
    ward: null,
    health: null,
    healthBuffer: null,
    roads: null,
    settlements: null,
    water: null,
    school: null,
};

// ================= LOAD ALL DATA =================
async function loadAllData() {
    const entries = Object.entries(GEOJSON_FILES);
    await Promise.all(entries.map(async ([key, url]) => {
        try {
            const resp = await fetch(url);
            DATA[key] = await resp.json();
        } catch(e) {
            console.error(`Failed to load ${key}:`, e);
            DATA[key] = { type: 'FeatureCollection', features: [] };
        }
    }));
}

// ================= FILTER HELPERS =================
function buildFilter() {
    const p = elProv.value;
    const c = elConst.value;
    const w = elWard.value;
    return f => {
        const props = f.properties;
        if (p && props.province !== p) return false;
        if (c && props.constituen !== c) return false;
        if (w && String(props.wardnumber) !== String(w)) return false;
        return true;
    };
}

function filterFeatures(data, filterFn) {
    if (!data) return { type: 'FeatureCollection', features: [] };
    return {
        type: 'FeatureCollection',
        features: data.features.filter(filterFn)
    };
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

// ================= VECTOR SOURCES =================
const wardVectorSource = new ol.source.Vector({ format: new ol.format.GeoJSON() });
const healthSource     = new ol.source.Vector({ format: new ol.format.GeoJSON() });
const bufferSource     = new ol.source.Vector({ format: new ol.format.GeoJSON() });
const roadsSource      = new ol.source.Vector({ format: new ol.format.GeoJSON() });
const settlementsSource= new ol.source.Vector({ format: new ol.format.GeoJSON() });
const waterSource      = new ol.source.Vector({ format: new ol.format.GeoJSON() });
const schoolSource     = new ol.source.Vector({ format: new ol.format.GeoJSON() });

// ================= VECTOR LAYERS =================
const wardLayer        = new ol.layer.Vector({ source: wardVectorSource, style: wardLabelStyle });
const healthVector     = new ol.layer.Vector({ source: healthSource,      visible: false });
const bufferVector     = new ol.layer.Vector({ source: bufferSource,      visible: false });
const roadsVector      = new ol.layer.Vector({ source: roadsSource,       visible: false });
const settlementsVector= new ol.layer.Vector({ source: settlementsSource, visible: false });
const waterVector      = new ol.layer.Vector({ source: waterSource,       visible: false });
const schoolVector     = new ol.layer.Vector({ source: schoolSource,      visible: false });

map.addLayer(wardLayer);
map.addLayer(settlementsVector);
map.addLayer(roadsVector);
map.addLayer(bufferVector);
map.addLayer(healthVector);
map.addLayer(waterVector);
map.addLayer(schoolVector);

// ================= LOAD FEATURES INTO SOURCE =================
const geojsonFormat = new ol.format.GeoJSON();

function loadSource(source, geojsonData) {
    source.clear();
    if (!geojsonData) return;
    const features = geojsonFormat.readFeatures(geojsonData, {
        featureProjection: 'EPSG:3857'
    });
    source.addFeatures(features);
}

function applyWardFilter() {
    const filtered = filterFeatures(DATA.ward, buildFilter());
    loadSource(wardVectorSource, filtered);
}

function applyRoadFilter() {
    const filtered = filterFeatures(DATA.roads, buildFilter());
    loadSource(roadsSource, filtered);
}

function applyWaterFilter() {
    const filtered = filterFeatures(DATA.water, buildFilter());
    loadSource(waterSource, filtered);
}

function applySchoolFilter() {
    const filtered = filterFeatures(DATA.school, buildFilter());
    loadSource(schoolSource, filtered);
}

function applySettlementFilter() {
    const filtered = filterFeatures(DATA.settlements, buildFilter());
    loadSource(settlementsSource, filtered);
}

function applyHealthFilter() {
    const filtered = filterFeatures(DATA.health, buildFilter());
    loadSource(healthSource, filtered);

    // Buffer uses only province/constituency (no ward field typically)
    const bufFiltered = filterFeatures(DATA.healthBuffer, buildFilter());
    loadSource(bufferSource, bufFiltered);
}

// ================= POPUP =================
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

function closePopup() {
    popupOverlay.setPosition(undefined);
}

function setSchoolPopupContent(feature) {
    const name       = feature.get('name')       || 'N/A';
    const ownership  = feature.get('responsibl') || 'N/A';
    const female     = feature.get('enrol_fema') || 0;
    const male       = feature.get('enrol_male') || 0;
    const total      = feature.get('total_pupi') || 0;
    const teachers   = feature.get('teachers')   || 0;
    const ratio      = feature.get('teacher_pu') || 'N/A';

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
        const coordinate = feature.getGeometry().getCoordinates();
        popupOverlay.setPosition(coordinate);
    } else {
        popupOverlay.setPosition(undefined);
    }
});

const tabButtons = document.querySelectorAll('.tabs button');
tabButtons.forEach(tab => {
    tab.addEventListener('click', () => closePopup());
});

// ================= STYLES =================
function wardLabelStyle(f) {
    return new ol.style.Style({
        text: new ol.style.Text({
            text: String(f.get('wardnumber') || ''),
            font: 'bold 14px Calibri',
            fill: new ol.style.Fill({ color: '#000' }),
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
    if      (status === 'Fully Functional')      color = '#2ca25f';
    else if (status === 'Partially Functional')  color = '#fc9272';
    else if (status === 'Collapsed/Abandoned')   color = '#3182bd';
    else if (status === 'N/A')                   color = '#800080';
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
    if      (type === 'Borehole')      color = '#3182bd';
    else if (type === 'Deep Well')     color = '#990e0e';
    else if (type === 'Shallow Well')  color = '#d838a5';
    else if (type === 'Dam')           color = '#c4dd0b';
    else if (type === 'Spring')        color = '#4daf4a';
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
    const radiusX = radiusScale;
    const radiusY = radiusScale * 0.8;
    const centerX = radiusX;
    const centerY = radiusX;
    const depth = radiusScale * 0.25;
    const canvasSize = radiusX * 2 + depth + 2;

    const canvas = document.createElement('canvas');
    canvas.width = canvasSize;
    canvas.height = canvasSize;
    const ctx = canvas.getContext('2d');

    const slices = [
        { value: male,   color: '#3182bd', shadow: '#1e488c' },
        { value: female, color: '#fc6ea8', shadow: '#b14f7c' }
    ];

    let startAngle = 0;
    slices.forEach(slice => {
        const angle = (slice.value / total) * 2 * Math.PI;
        if (angle === 0) return;
        ctx.beginPath();
        ctx.moveTo(centerX, centerY);
        ctx.ellipse(centerX, centerY + depth, radiusX, radiusY, 0, startAngle, startAngle + angle);
        ctx.lineTo(centerX, centerY);
        ctx.closePath();
        ctx.fillStyle = slice.shadow;
        ctx.fill();
        ctx.strokeStyle = '#000';
        ctx.stroke();
        startAngle += angle;
    });

    startAngle = 0;
    slices.forEach(slice => {
        const angle = (slice.value / total) * 2 * Math.PI;
        if (angle === 0) return;
        ctx.beginPath();
        ctx.moveTo(centerX, centerY);
        ctx.ellipse(centerX, centerY, radiusX, radiusY, 0, startAngle, startAngle + angle);
        ctx.closePath();
        ctx.fillStyle = slice.color;
        ctx.fill();
        ctx.strokeStyle = '#000';
        ctx.stroke();
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
        image: new ol.style.Circle({
            radius: 6,
            fill:   new ol.style.Fill({ color }),
            stroke: new ol.style.Stroke({ color: '#fff', width: 1 })
        }),
        text: new ol.style.Text({
            text:   f.get('nameoffaci') || '',
            offsetY: -10,
            font:   '12px Calibri',
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
    const cond  = f.get('road_struc');
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

// ================= DROPDOWNS =================
const elProv  = document.getElementById('select-province');
const elConst = document.getElementById('select-constituency');
const elWard  = document.getElementById('select-ward');

function getUniqueValues(field, filterFn = () => true) {
    if (!DATA.ward) return [];
    const vals = DATA.ward.features
        .filter(filterFn)
        .map(f => f.properties[field])
        .filter(v => v != null);
    return [...new Set(vals)].sort();
}

function populateProvinces() {
    const provinces = getUniqueValues('province');
    provinces.forEach(p => elProv.add(new Option(p, p)));
}

// Province change
elProv.addEventListener('change', () => {
    const p = elProv.value;

    elConst.innerHTML = '<option value="">Select Constituency</option>';
    elWard.innerHTML  = '<option value="">Select Ward</option>';
    elConst.disabled  = true;
    elWard.disabled   = true;

    document.getElementById('res-province').innerText     = p || 'N/A';
    document.getElementById('res-constituency').innerText = 'N/A';
    document.getElementById('res-ward').innerText         = 'N/A';

    if (p) {
        const consts = getUniqueValues('constituen', f => f.properties.province === p);
        consts.forEach(c => elConst.add(new Option(c, c)));
        elConst.disabled = false;

        applyWardFilter();
        applyWaterFilter();
        applyRoadFilter();
        applySettlementFilter();
    } else {
        loadSource(wardVectorSource, DATA.ward);
    }

    updatePopulationStats();
    updateWelfareStats();
});

// Constituency change
elConst.addEventListener('change', async () => {
    const p = elProv.value;
    const c = elConst.value;
    if (!c) return;

    elWard.innerHTML = '<option value="">Select Ward</option>';
    elWard.disabled  = false;

    document.getElementById('res-constituency').innerText = c;
    document.getElementById('display-title').innerText    = `${c} Overview`;
    document.getElementById('res-ward').innerText         = 'N/A';

    const wards = getUniqueValues('wardnumber', f =>
        f.properties.province === p && f.properties.constituen === c
    );
    wards.forEach(w => elWard.add(new Option(w, w)));

    applyWardFilter();
    applyWaterFilter();
    applyRoadFilter();
    applySettlementFilter();
    updatePopulationStats();
    updateWelfareStats();
});

// Ward change
elWard.addEventListener('change', () => {
    const w = elWard.value;
    if (!w) return;
    document.getElementById('res-ward').innerText = `Ward ${w}`;
    applyWardFilter();
    applyWaterFilter();
    applyRoadFilter();
    applySettlementFilter();
    updatePopulationStats();
    updateWelfareStats();
});

// ================= TABS =================
const tabOverview   = document.getElementById('tab-overview');
const tabDemography = document.getElementById('tab-demography');
const tabWelfare    = document.getElementById('tab-welfare');
const tabHealth     = document.getElementById('tab-health');
const tabRoads      = document.getElementById('tab-roads');
const tabWater      = document.getElementById('tab-water');
const tabEducation  = document.getElementById('tab-education');

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

const btnHealthDist   = document.getElementById('btn-health-dist');
const btnHealthZone   = document.getElementById('btn-health-zone');
const btnHealthDeficit= document.getElementById('btn-health-deficit');

const btnRoadCondition = document.getElementById('btn-road-condition');
const btnRoadSurface   = document.getElementById('btn-road-surface');

const btnWaterFunctional = document.getElementById('btn-water-functional');
const btnWaterType       = document.getElementById('btn-water-type');
const waterLegendFunctional = document.getElementById('water-legend-functional');
const waterLegendType       = document.getElementById('water-legend-type');

const btnEducationPrimary   = document.getElementById('btn-education-primary');
const btnEducationSecondary = document.getElementById('btn-education-secondary');

const healthLegendFacilities = document.getElementById('health-legend-facilities');
const healthLegendService    = document.getElementById('health-legend-service');
const healthLegendDeficit    = document.getElementById('health-legend-deficit');

// ---- Tab clicks ----
tabOverview.onclick   = () => switchTab('overview');
tabDemography.onclick = () => switchTab('demography');
tabWelfare.onclick    = () => switchTab('welfare');
tabHealth.onclick     = () => switchTab('health');
tabRoads.onclick      = () => switchTab('roads');
tabWater.onclick      = () => switchTab('water');
tabEducation.onclick  = () => switchTab('education');

// ---- Road sub-tabs ----
btnRoadCondition.onclick = () => {
    btnRoadCondition.classList.add('active');
    btnRoadSurface.classList.remove('active');
    roadsVector.setStyle(roadConditionStyle);
    document.getElementById('roads-legend-condition').style.display = 'block';
    document.getElementById('roads-legend-surface').style.display   = 'none';
};

btnRoadSurface.onclick = () => {
    btnRoadSurface.classList.add('active');
    btnRoadCondition.classList.remove('active');
    roadsVector.setStyle(roadSurfaceStyle);
    document.getElementById('roads-legend-condition').style.display = 'none';
    document.getElementById('roads-legend-surface').style.display   = 'block';
};

// ---- Water sub-tabs ----
btnWaterFunctional.onclick = () => {
    btnWaterFunctional.classList.add('active');
    btnWaterType.classList.remove('active');
    applyWaterFilter();
    waterVector.setStyle(waterFunctionalStyle);
    waterVector.setVisible(true);
    waterLegendFunctional.style.display = 'block';
    waterLegendType.style.display       = 'none';
};

btnWaterType.onclick = () => {
    btnWaterType.classList.add('active');
    btnWaterFunctional.classList.remove('active');
    applyWaterFilter();
    waterVector.setStyle(waterSourceStyle);
    waterVector.setVisible(true);
    waterLegendFunctional.style.display = 'none';
    waterLegendType.style.display       = 'block';
};

// ---- Education sub-tabs ----
btnEducationPrimary.onclick = () => {
    btnEducationPrimary.classList.add('active');
    btnEducationSecondary.classList.remove('active');
    applySchoolFilter();
    applySettlementFilter();
    schoolVector.setStyle(f =>
        f.get('classifica') === 'Primary Schools' ? schoolPieStyle(f) : null
    );
    schoolVector.setVisible(true);
    settlementsVector.setVisible(true);
    settlementsVector.setStyle(settlementsEducationStyle);
};

btnEducationSecondary.onclick = () => {
    btnEducationSecondary.classList.add('active');
    btnEducationPrimary.classList.remove('active');
    applySchoolFilter();
    applySettlementFilter();
    schoolVector.setStyle(f =>
        f.get('classifica') === 'High Schools' ? schoolPieStyle(f) : null
    );
    schoolVector.setVisible(true);
    settlementsVector.setVisible(true);
    settlementsVector.setStyle(settlementsEducationStyle);
};

// ---- Welfare sub-tabs ----
let welfareMode = 'prevalence';

btnPrev.onclick = () => {
    welfareMode = 'prevalence';
    btnPrev.classList.add('active');
    btnGap.classList.remove('active');
    applyWelfareStyle();
    updateWelfareStats();
};

btnGap.onclick = () => {
    welfareMode = 'gap';
    btnGap.classList.add('active');
    btnPrev.classList.remove('active');
    applyWelfareStyle();
    updateWelfareStats();
};

// ---- Health sub-tabs ----
function setActiveHealthTab(activeBtn) {
    [btnHealthDist, btnHealthZone, btnHealthDeficit].forEach(b => b.classList.remove('active'));
    activeBtn.classList.add('active');
}

btnHealthDist.onclick   = () => { setActiveHealthTab(btnHealthDist);    applyHealthTab('facilities'); };
btnHealthZone.onclick   = () => { setActiveHealthTab(btnHealthZone);    applyHealthTab('service'); };
btnHealthDeficit.onclick= () => { setActiveHealthTab(btnHealthDeficit); applyHealthTab('deficit'); };

// ================= SWITCH TAB =================
function switchTab(mode) {
    // Hide all content
    [overviewContent, demographyContent, welfareContent, healthContent,
     roadsContent, waterContent, educationContent].forEach(el => el.style.display = 'none');

    // Hide all legends
    [popLegend, prevLegend, gapLegend, healthLegendFacilities, healthLegendService,
     healthLegendDeficit].forEach(el => el.style.display = 'none');
    document.getElementById('education-legend').style.display           = 'none';
    document.getElementById('roads-legend-condition').style.display     = 'none';
    document.getElementById('roads-legend-surface').style.display       = 'none';
    waterLegendFunctional.style.display = 'none';
    waterLegendType.style.display       = 'none';

    // Remove all active tabs
    [tabOverview, tabDemography, tabWelfare, tabHealth, tabRoads, tabWater, tabEducation]
        .forEach(t => t.classList.remove('active'));

    // Hide all layers
    healthVector.setVisible(false);
    bufferVector.setVisible(false);
    roadsVector.setVisible(false);
    settlementsVector.setVisible(false);
    waterVector.setVisible(false);
    schoolVector.setVisible(false);

    // Ward layer: default label style unless overridden below
    wardLayer.setStyle(wardLabelStyle);

    if (mode === 'overview') {
        overviewContent.style.display = 'block';
        tabOverview.classList.add('active');
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
        applyWelfareStyle();
        updateWelfareStats();
        updateWelfareChart();
    }
    else if (mode === 'health') {
        healthContent.style.display = 'block';
        tabHealth.classList.add('active');
        applyHealthTab('facilities');
        setActiveHealthTab(btnHealthDist);
    }
    else if (mode === 'roads') {
        roadsContent.style.display = 'block';
        tabRoads.classList.add('active');
        applyRoadFilter();
        roadsVector.setVisible(true);
        roadsVector.setStyle(roadConditionStyle);
        document.getElementById('roads-legend-condition').style.display = 'block';
        btnRoadCondition.classList.add('active');
        btnRoadSurface.classList.remove('active');
    }
    else if (mode === 'water') {
        waterContent.style.display = 'block';
        tabWater.classList.add('active');
        applyWaterFilter();
        btnWaterFunctional.click();
        map.removeLayer(waterVector);
        map.addLayer(waterVector);
    }
    else if (mode === 'education') {
        educationContent.style.display = 'block';
        tabEducation.classList.add('active');
        document.getElementById('education-legend').style.display = 'block';
        applySchoolFilter();
        applySettlementFilter();
        schoolVector.setVisible(true);
        settlementsVector.setVisible(true);
        map.removeLayer(schoolVector);
        map.addLayer(schoolVector);
    }
}

// ================= HEALTH TAB CONTENT =================
function applyHealthTab(tab) {
    healthVector.setVisible(false);
    bufferVector.setVisible(false);
    roadsVector.setVisible(false);
    settlementsVector.setVisible(false);
    healthLegendFacilities.style.display = 'none';
    healthLegendService.style.display    = 'none';
    healthLegendDeficit.style.display    = 'none';

    applyHealthFilter();
    applySettlementFilter();

    if (tab === 'facilities') {
        healthVector.setVisible(true);
        settlementsVector.setVisible(true);
        healthVector.setStyle(f => healthFacilitiesStyle(f));
        settlementsVector.setStyle(settlementsStyle);
        healthLegendFacilities.style.display = 'block';
    }
    else if (tab === 'service') {
        healthVector.setVisible(true);
        bufferVector.setVisible(true);
        settlementsVector.setVisible(true);
        healthVector.setStyle(() => new ol.style.Style({
            image: new ol.style.Circle({ radius: 6, fill: new ol.style.Fill({ color: '#3182bd' }) })
        }));
        bufferVector.setStyle(new ol.style.Style({
            fill:   new ol.style.Fill({ color: 'rgba(102,194,165,0.4)' }),
            stroke: new ol.style.Stroke({ color: '#555', width: 1 })
        }));
        settlementsVector.setStyle(settlementsStyle);
        healthLegendService.style.display = 'block';
    }
    else if (tab === 'deficit') {
        healthVector.setVisible(true);
        bufferVector.setVisible(true);
        settlementsVector.setVisible(true);
        roadsVector.setVisible(true);
        applyRoadFilter();
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
}

// ================= WELFARE =================
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

function updateWelfareStats() {
    const features = wardVectorSource.getFeatures();
    const field = welfareMode === 'prevalence' ? 'poverty_pr' : 'poverty_ga';
    const vals  = features.map(f => f.get(field) || 0);
    const avg   = vals.length ? (vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(2) : 'N/A';

    document.getElementById('wel-province').innerText     = elProv.value  || 'N/A';
    document.getElementById('wel-constituency').innerText = elConst.value || 'N/A';
    document.getElementById('wel-value').innerText        = avg;

    updateWelfareChart();
}

// ================= POPULATION STATS =================
function updatePopulationStats() {
    const features = wardVectorSource.getFeatures();
    const total    = features.reduce((s, f) => s + (f.get('total_popu') || 0), 0);

    document.getElementById('pop-province').innerText     = elProv.value  || 'N/A';
    document.getElementById('pop-constituency').innerText = elConst.value || 'N/A';
    document.getElementById('pop-total').innerText        = total;

    updatePopulationCharts();
}

// ================= POPULATION CHARTS =================
let chart0_14, chart15_64, chart65;

function updatePopulationCharts() {
    const features = wardVectorSource.getFeatures();
    if (!features.length) return;

    let labels = [], m_0_14 = [], f_0_14 = [], m_15_64 = [], f_15_64 = [], m_65 = [], f_65 = [];

    if (elWard.value) {
        const f = features.find(ft => String(ft.get('wardnumber')) === String(elWard.value));
        if (!f) return;
        labels   = ['Selected Ward'];
        m_0_14   = [f.get('m_0_14')  || 0];
        f_0_14   = [f.get('f_0_14')  || 0];
        m_15_64  = [f.get('m_15_64') || 0];
        f_15_64  = [f.get('f_15_64') || 0];
        m_65     = [f.get('m_65')    || 0];
        f_65     = [f.get('f_65')    || 0];
    }
    else if (elConst.value) {
        features.forEach(f => {
            labels.push('Ward ' + (f.get('wardnumber') || ''));
            m_0_14.push(f.get('m_0_14')  || 0);
            f_0_14.push(f.get('f_0_14')  || 0);
            m_15_64.push(f.get('m_15_64')|| 0);
            f_15_64.push(f.get('f_15_64')|| 0);
            m_65.push(f.get('m_65')      || 0);
            f_65.push(f.get('f_65')      || 0);
        });
    }
    else if (elProv.value) {
        const grouped = {};
        features.forEach(f => {
            const cn = f.get('constituen') || 'Unknown';
            if (!grouped[cn]) grouped[cn] = { m_0_14:0,f_0_14:0,m_15_64:0,f_15_64:0,m_65:0,f_65:0 };
            grouped[cn].m_0_14  += f.get('m_0_14')  || 0;
            grouped[cn].f_0_14  += f.get('f_0_14')  || 0;
            grouped[cn].m_15_64 += f.get('m_15_64') || 0;
            grouped[cn].f_15_64 += f.get('f_15_64') || 0;
            grouped[cn].m_65    += f.get('m_65')    || 0;
            grouped[cn].f_65    += f.get('f_65')    || 0;
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

    const ds = (label, data, color) => ({ label, data, backgroundColor: color, borderColor: '#000', borderWidth: 1 });

    chart0_14  = new Chart(document.getElementById('chart_0_14'),  { type:'bar', data:{ labels, datasets:[ds('Male (0-14)',m_0_14,'#3182bd'),ds('Female (0-14)',f_0_14,'#fc6ea8')] }, options:chartOptions('Population (0–14 Years)') });
    chart15_64 = new Chart(document.getElementById('chart_15_64'), { type:'bar', data:{ labels, datasets:[ds('Male (15-64)',m_15_64,'#3182bd'),ds('Female (15-64)',f_15_64,'#fc6ea8')] }, options:chartOptions('Population (15–64 Years)') });
    chart65    = new Chart(document.getElementById('chart_65'),    { type:'bar', data:{ labels, datasets:[ds('Male (65+)',m_65,'#3182bd'),ds('Female (65+)',f_65,'#fc6ea8')] }, options:chartOptions('Population (65+ Years)') });
}

// ================= WELFARE CHART =================
let welfareChart = null;

function updateWelfareChart() {
    const features = wardVectorSource.getFeatures();
    if (!features.length) return;

    let labels = [], poorData = [], nonPoorData = [];

    if (elWard.value) {
        const f = features.find(ft => String(ft.get('wardnumber')) === String(elWard.value));
        labels     = ['Selected Ward'];
        poorData   = [f ? f.get('poor')     || 0 : 0];
        nonPoorData= [f ? f.get('none_poor')|| 0 : 0];
    }
    else if (elConst.value) {
        features.forEach(f => {
            labels.push('Ward ' + (f.get('wardnumber') || ''));
            poorData.push(f.get('poor')     || 0);
            nonPoorData.push(f.get('none_poor')|| 0);
        });
    }
    else {
        const grouped = {};
        features.forEach(f => {
            const cn = f.get('constituen') || 'Unknown';
            if (!grouped[cn]) grouped[cn] = { poor: 0, none_poor: 0 };
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
        data: {
            labels,
            datasets: [
                { label:'Poor',      data:poorData,    backgroundColor:'#e74c3c', borderColor:'#000', borderWidth:1 },
                { label:'None-Poor', data:nonPoorData, backgroundColor:'#2ecc71', borderColor:'#000', borderWidth:1 }
            ]
        },
        options: {
            responsive: true,
            plugins: {
                title: {
                    display: true,
                    text: elWard.value ? 'Welfare (Selected Ward)'
                        : elConst.value ? 'Welfare Comparison by Ward'
                        : 'Welfare Comparison by Constituency'
                },
                legend: { position: 'top' }
            },
            scales: { x: { stacked: false }, y: { beginAtZero: true } }
        }
    });
}

// ================= ZOOM =================
document.getElementById('zoom-layer').onclick = () => {
    const features = wardVectorSource.getFeatures();
    if (!features.length) return;
    const extent = features.reduce(
        (acc, f) => ol.extent.extend(acc, f.getGeometry().getExtent()),
        ol.extent.createEmpty()
    );
    map.getView().fit(extent, { padding: [50, 50, 50, 50], duration: 800 });
};

// ================= STARTUP =================
loadAllData().then(() => {
    // Load ward layer (all features initially)
    loadSource(wardVectorSource, DATA.ward);

    // Populate province dropdown
    populateProvinces();

    // Start on overview tab
    switchTab('overview');
});