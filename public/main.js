// ================= CONFIG =================
// Place your GeoJSON files in a /data/ folder alongside this script
const DATA_PATH = '/data';

// ================= ALL RAW DATA (loaded once) =================
const RAW = {
    ward:         null,   // Matnort_2.geojson
    health:       null,   // Health_2.geojson
    healthBuffer: null,   // Health_buffer.geojson
    roads:        null,   // lovedroads.geojson
    settlements:  null,   // settlements_2.geojson
    water:        null,   // Waterpoint_3.geojson
    school:       null,   // school_4.geojson
};

const GJ_FORMAT = new ol.format.GeoJSON();

// Read features from a raw GeoJSON object, reprojected to map CRS
function featuresFrom(raw) {
    if (!raw) return [];
    return GJ_FORMAT.readFeatures(raw, { featureProjection: 'EPSG:3857' });
}

// Build a filtered feature array from raw data based on current dropdown values
function filteredFeatures(raw) {
    if (!raw) return [];
    const p = elProv  ? elProv.value  : '';
    const c = elConst ? elConst.value : '';
    const w = elWard  ? elWard.value  : '';
    return GJ_FORMAT.readFeatures(raw, { featureProjection: 'EPSG:3857' }).filter(f => {
        if (p && f.get('Province')   !== p)            return false;
        if (c && f.get('Constituen') !== c)            return false;
        if (w && String(f.get('Wardnumber')) !== String(w)) return false;
        return true;
    });
}

// Load (and optionally filter) features into a vector source
function reloadSource(source, raw, applyFilter) {
    source.clear();
    const features = applyFilter ? filteredFeatures(raw) : featuresFrom(raw);
    source.addFeatures(features);
}

// ================= MAP =================
// The overview WMS tile layer is replaced with the ward vector layer styled plainly.
// All other behaviour is identical to the original.

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

function closePopup() {
    popupOverlay.setPosition(undefined);
}

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

// ---------------- VECTOR SOURCES ----------------
const wardVectorSource  = new ol.source.Vector();
const waterVectorSource = new ol.source.Vector();
const schoolVectorSource= new ol.source.Vector();
const healthVectorSource= new ol.source.Vector();
const bufferVectorSource= new ol.source.Vector();
const roadsVectorSource = new ol.source.Vector();
const settlementsVectorSource = new ol.source.Vector();

// ---------------- VECTOR LAYERS ----------------
const wardLayer = new ol.layer.Vector({
    source: wardVectorSource,
    style: wardLabelStyle
});

const waterVector = new ol.layer.Vector({
    source: waterVectorSource,
    visible: false
});

const schoolVector = new ol.layer.Vector({
    source: schoolVectorSource,
    visible: false
});

const healthVector = new ol.layer.Vector({
    source: healthVectorSource,
    visible: false
});

const bufferVector = new ol.layer.Vector({
    source: bufferVectorSource,
    visible: false
});

const roadsVector = new ol.layer.Vector({
    source: roadsVectorSource,
    visible: false
});

const settlementsVector = new ol.layer.Vector({
    source: settlementsVectorSource,
    visible: false
});

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
            text:   String(f.get('Wardnumber') || ''),
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

// ---------------- PIE CHART STYLE ----------------
function schoolPieStyle(f) {
    const male   = f.get('enrol_male') || 0;
    const female = f.get('enrol_fema') || 0;
    const total  = male + female;
    if (total === 0) return null;

    const minRadius = 8, maxRadius = 20, maxEnrolment = 1000;
    const radiusScale = Math.min(maxRadius, minRadius + (total / maxEnrolment) * (maxRadius - minRadius));
    const radiusX  = radiusScale;
    const radiusY  = radiusScale * 0.8;
    const centerX  = radiusX;
    const centerY  = radiusX;
    const depth    = radiusScale * 0.25;
    const canvasSize = radiusX * 2 + depth + 2;

    const canvas = document.createElement('canvas');
    canvas.width = canvasSize;
    canvas.height = canvasSize;
    const ctx = canvas.getContext('2d');

    let startAngle = 0;
    const slices = [
        { value: male,   color: '#3182bd', shadow: '#1e488c' },
        { value: female, color: '#fc6ea8', shadow: '#b14f7c' }
    ];

    // Draw sides
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

    // Draw tops
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

// ---------------- HEALTH STYLES ----------------
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

// Overview ward boundary style (replaces WMS tile layer)
function overviewStyle(f) {
    return new ol.style.Style({
        fill:   new ol.style.Fill({ color: 'rgba(200,200,200,0.3)' }),
        stroke: new ol.style.Stroke({ color: '#555', width: 1 }),
        text:   wardLabelStyle(f).getText()
    });
}

// ---------------- DROPDOWNS ----------------
const elProv  = document.getElementById('select-province');
const elConst = document.getElementById('select-Constituency');
const elWard  = document.getElementById('select-ward');

function escapeCQL(str) { return str ? str.replace(/'/g, "''") : ''; }

// ---------------- FILTER FUNCTIONS ----------------
// These replace the GeoServer WFS CQL_FILTER calls.
// They reload each source from the in-memory raw data.

function applyWardFilter(cql) {
    // cql parameter ignored – filtering done from dropdown values
    reloadSource(wardVectorSource, RAW.ward, true);
}

function updateWardLabels(cql) {
    applyWardFilter(cql);
}

function applyRoadFilter() {
    reloadSource(roadsVectorSource, RAW.roads, true);
}

function applyWaterFilter() {
    reloadSource(waterVectorSource, RAW.water, true);
}

function applySchoolFilter() {
    reloadSource(schoolVectorSource, RAW.school, true);
}

function applySettlementFilter() {
    reloadSource(settlementsVectorSource, RAW.settlements, true);
}

function applyHealthFilter() {
    reloadSource(healthVectorSource,  RAW.health,       true);
    reloadSource(bufferVectorSource,  RAW.healthBuffer, true);
}

// ---------------- POPULATE PROVINCE ----------------
function populateProvinces() {
    if (!RAW.ward) return;
    const vals = RAW.ward.features
        .map(f => f.properties.Province)
        .filter(v => v != null);
    const unique = [...new Set(vals)].sort();
    unique.forEach(p => elProv.add(new Option(p, p)));
}

// ---------------- DROPDOWN EVENTS ----------------
elProv.addEventListener('change', async () => {
    const p = escapeCQL(elProv.value);

    if (!p) {
        // Reset to show all wards
        reloadSource(wardVectorSource, RAW.ward, false);
        elConst.disabled = true;
        elWard.disabled  = true;
        elConst.innerHTML = '<option value="">Select Constituency</option>';
        elWard.innerHTML  = '<option value="">Select Ward</option>';
        document.getElementById('res-province').innerText     = 'N/A';
        document.getElementById('res-Constituency').innerText = 'N/A';
        document.getElementById('res-ward').innerText         = 'N/A';
        updatePopulationStats();
        updateWelfareStats();
        return;
    }

    // Filter ward layer
    applyWardFilter();

    document.getElementById('res-province').innerText = elProv.value;

    // Populate Constituencies from raw data
    const consts = [...new Set(
        RAW.ward.features
            .filter(f => f.properties.province === elProv.value)
            .map(f => f.properties.Constituen)
            .filter(v => v != null)
    )].sort();

    elConst.innerHTML = '<option value="">Select Constituency</option>';
    consts.forEach(c => elConst.add(new Option(c, c)));
    elConst.disabled = false;

    elWard.disabled  = true;
    elWard.innerHTML = '<option value="">Select Ward</option>';

    document.getElementById('res-Constituency').innerText = 'N/A';
    document.getElementById('res-ward').innerText         = 'N/A';

    updatePopulationStats();
    updateWelfareStats();
    applyWaterFilter();
    applyRoadFilter();
    applySettlementFilter();
});

elConst.addEventListener('change', async () => {
    const c = escapeCQL(elConst.value);
    const p = escapeCQL(elProv.value);
    if (!c) return;

    applyWardFilter();

    document.getElementById('res-Constituency').innerText = elConst.value;
    document.getElementById('display-title').innerText    = `${elConst.value} Overview`;

    // Populate wards from raw data
    const wards = [...new Set(
        RAW.ward.features
            .filter(f => f.properties.province === elProv.value && f.properties.Constituen === elConst.value)
            .map(f => f.properties.Wardnumber)
            .filter(v => v != null)
    )].sort((a, b) => Number(a) - Number(b));

    elWard.innerHTML = '<option value="">Select Ward</option>';
    wards.forEach(w => elWard.add(new Option(w, w)));
    elWard.disabled  = false;

    document.getElementById('res-ward').innerText = 'N/A';

    updatePopulationStats();
    updateWelfareStats();
    applyRoadFilter();
    applyWaterFilter();
    applySettlementFilter();
});

elWard.addEventListener('change', () => {
    const w = escapeCQL(elWard.value);
    if (!w) return;

    applyWardFilter();

    document.getElementById('res-ward').innerText = `Ward ${elWard.value}`;

    updatePopulationStats();
    updateWelfareStats();
    applyRoadFilter();
    applyWaterFilter();
    applySettlementFilter();
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

const tabWater           = document.getElementById('tab-water');
const waterContent       = document.getElementById('water-content');
const btnWaterFunctional = document.getElementById('btn-water-functional');
const btnWaterType       = document.getElementById('btn-water-type');
const waterLegendFunctional = document.getElementById('water-legend-functional');
const waterLegendType       = document.getElementById('water-legend-type');

tabWater.onclick = () => switchTab('water');

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

// ---------------- TAB BUTTONS EDUCATION ----------------
const tabEducation        = document.getElementById('tab-education');
const educationContent    = document.getElementById('education-content');
const btnEducationPrimary   = document.getElementById('btn-education-primary');
const btnEducationSecondary = document.getElementById('btn-education-secondary');

btnEducationPrimary.onclick = () => {
    btnEducationPrimary.classList.add('active');
    btnEducationSecondary.classList.remove('active');
    applySchoolFilter();
    applySettlementFilter();
    schoolVector.setStyle(f => {
        if (f.get('classifica') === 'Primary Schools') return schoolPieStyle(f);
        return null;
    });
    schoolVector.setVisible(true);
    settlementsVector.setVisible(true);
    settlementsVector.setStyle(settlementsEducationStyle);
};

btnEducationSecondary.onclick = () => {
    btnEducationSecondary.classList.add('active');
    btnEducationPrimary.classList.remove('active');
    applySchoolFilter();
    applySettlementFilter();
    schoolVector.setStyle(f => {
        if (f.get('classifica') === 'High Schools') return schoolPieStyle(f);
        return null;
    });
    schoolVector.setVisible(true);
    settlementsVector.setVisible(true);
    settlementsVector.setStyle(settlementsEducationStyle);
};

// ---------------- HEALTH LEGENDS ----------------
const healthLegendFacilities = document.getElementById('health-legend-facilities');
const healthLegendService    = document.getElementById('health-legend-service');
const healthLegendDeficit    = document.getElementById('health-legend-deficit');

// ---------------- APPLY HEALTH TAB ----------------
function applyHealthTab(tab) {
    healthVector.setVisible(false);
    bufferVector.setVisible(false);
    roadsVector.setVisible(false);
    settlementsVector.setVisible(false);
    healthLegendFacilities.style.display = 'none';
    healthLegendService.style.display    = 'none';
    healthLegendDeficit.style.display    = 'none';

    // Reload all health-related sources with current filter
    applyHealthFilter();
    applySettlementFilter();
    applyRoadFilter();

    if (tab === 'facilities') {
        healthVector.setVisible(true);
        settlementsVector.setVisible(true);
        healthVector.setStyle(f => healthFacilitiesStyle(f));
        settlementsVector.setStyle(settlementsStyle);
        healthLegendFacilities.style.display = 'block';
    } else if (tab === 'service') {
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
    } else if (tab === 'deficit') {
        healthVector.setVisible(true);
        bufferVector.setVisible(true);
        settlementsVector.setVisible(true);
        roadsVector.setVisible(true);
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

// ---------------- TABS ----------------
tabOverview.onclick   = () => switchTab('overview');
tabDemography.onclick = () => switchTab('demography');
tabWelfare.onclick    = () => switchTab('welfare');
tabHealth.onclick     = () => switchTab('health');
tabRoads.onclick      = () => switchTab('roads');
tabEducation.onclick  = () => switchTab('education');

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

btnHealthDist.onclick = () => {
    setActiveHealthTab(btnHealthDist);
    applyHealthTab('facilities');
};

btnHealthZone.onclick = () => {
    setActiveHealthTab(btnHealthZone);
    applyHealthTab('service');
};

btnHealthDeficit.onclick = () => {
    setActiveHealthTab(btnHealthDeficit);
    applyHealthTab('deficit');
};

function setActiveHealthTab(activeBtn) {
    btnHealthDist.classList.remove('active');
    btnHealthZone.classList.remove('active');
    btnHealthDeficit.classList.remove('active');
    activeBtn.classList.add('active');
}

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

// ---------------- SWITCH TAB ----------------
function switchTab(mode) {

    // Hide all content panels
    overviewContent.style.display   = 'none';
    demographyContent.style.display = 'none';
    welfareContent.style.display    = 'none';
    healthContent.style.display     = 'none';
    roadsContent.style.display      = 'none';
    waterContent.style.display      = 'none';
    educationContent.style.display  = 'none';

    // Hide all legends
    popLegend.style.display  = 'none';
    prevLegend.style.display = 'none';
    gapLegend.style.display  = 'none';

    healthLegendFacilities.style.display = 'none';
    healthLegendService.style.display    = 'none';
    healthLegendDeficit.style.display    = 'none';

    document.getElementById('education-legend').style.display       = 'none';
    document.getElementById('roads-legend-condition').style.display = 'none';
    document.getElementById('roads-legend-surface').style.display   = 'none';

    waterLegendFunctional.style.display = 'none';
    waterLegendType.style.display       = 'none';

    // Remove all active tab highlights
    tabOverview.classList.remove('active');
    tabDemography.classList.remove('active');
    tabWelfare.classList.remove('active');
    tabHealth.classList.remove('active');
    tabRoads.classList.remove('active');
    tabWater.classList.remove('active');
    tabEducation.classList.remove('active');

    // Hide all overlay layers
    healthVector.setVisible(false);
    bufferVector.setVisible(false);
    roadsVector.setVisible(false);
    settlementsVector.setVisible(false);
    waterVector.setVisible(false);
    schoolVector.setVisible(false);

    // ---- OVERVIEW ----
    if (mode === 'overview') {
        overviewContent.style.display = 'block';
        // Show ward boundaries with a light fill so the map is visible
        wardLayer.setStyle(overviewStyle);
        tabOverview.classList.add('active');
    }

    // ---- DEMOGRAPHY ----
    else if (mode === 'demography') {
        demographyContent.style.display = 'block';
        wardLayer.setStyle(demographyStyle);
        popLegend.style.display = 'block';
        tabDemography.classList.add('active');
        updatePopulationStats();
    }

    // ---- WELFARE ----
    else if (mode === 'welfare') {
        welfareContent.style.display = 'block';
        tabWelfare.classList.add('active');
        applyWelfareStyle();
        updateWelfareStats();
        updateWelfareChart();
    }

    // ---- HEALTH ----
    else if (mode === 'health') {
        healthContent.style.display = 'block';
        tabHealth.classList.add('active');
        setActiveHealthTab(btnHealthDist);
        applyHealthTab('facilities');
    }

    // ---- ROADS ----
    else if (mode === 'roads') {
        roadsContent.style.display = 'block';
        tabRoads.classList.add('active');
        roadsVector.setVisible(true);
        applyRoadFilter();
        // Default sub-tab
        roadsVector.setStyle(roadConditionStyle);
        document.getElementById('roads-legend-condition').style.display = 'block';
        btnRoadCondition.classList.add('active');
        btnRoadSurface.classList.remove('active');
    }

    // ---- WATER ----
    else if (mode === 'water') {
        waterContent.style.display = 'block';
        tabWater.classList.add('active');
        applyWaterFilter();
        btnWaterFunctional.click();
        map.removeLayer(waterVector);
        map.addLayer(waterVector);
    }

    // ---- EDUCATION ----
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
    document.getElementById('pop-Constituency').innerText = elConst.value || 'N/A';
    document.getElementById('pop-total').innerText        = total;
    updatePopulationCharts();
}

// ---------------- THREE POPULATION CHARTS ----------------
let chart0_14, chart15_64, chart65;

function updatePopulationCharts() {
    const features = wardVectorSource.getFeatures();
    if (!features.length) return;

    let labels = [], m_0_14 = [], f_0_14 = [], m_15_64 = [], f_15_64 = [], m_65 = [], f_65 = [];

    const isWard  = elWard.value;
    const isConst = elConst.value;
    const isProv  = elProv.value;

    if (isWard) {
        const f = features.find(ft => String(ft.get('Wardnumber')) === String(elWard.value));
        if (!f) return;
        labels  = ['Selected Ward'];
        m_0_14  = [f.get('m_0_14')  || 0]; f_0_14  = [f.get('f_0_14')  || 0];
        m_15_64 = [f.get('m_15_64') || 0]; f_15_64 = [f.get('f_15_64') || 0];
        m_65    = [f.get('m_65')    || 0]; f_65    = [f.get('f_65')    || 0];
    }
    else if (isConst) {
        const constFeatures = features.filter(f => f.get('Constituen') === elConst.value);
        if (!constFeatures.length) return;
        constFeatures.forEach(f => {
            labels.push('Ward ' + (f.get('Wardnumber') || ''));
            m_0_14.push(f.get('m_0_14')  || 0); f_0_14.push(f.get('f_0_14')  || 0);
            m_15_64.push(f.get('m_15_64')|| 0); f_15_64.push(f.get('f_15_64')|| 0);
            m_65.push(f.get('m_65')      || 0); f_65.push(f.get('f_65')      || 0);
        });
    }
    else if (isProv) {
        const provFeatures = features.filter(f => f.get('province') === elProv.value);
        if (!provFeatures.length) return;
        const grouped = {};
        provFeatures.forEach(f => {
            const cn = f.get('Constituen') || 'Unknown';
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
    const avg   = vals.length ? (vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(2) : 'N/A';
    document.getElementById('wel-province').innerText     = elProv.value  || 'N/A';
    document.getElementById('wel-Constituency').innerText = elConst.value || 'N/A';
    document.getElementById('wel-value').innerText        = avg;
    updateWelfareChart();
}

// ---------------- WELFARE CHART ----------------
let welfareChart = null;

function updateWelfareChart() {
    const features = wardVectorSource.getFeatures();
    if (!features.length) return;

    let labels = [], poorData = [], nonPoorData = [];

    const isWard  = elWard.value;
    const isConst = elConst.value;

    if (isWard) {
        const f = features.find(ft => String(ft.get('Wardnumber')) === String(elWard.value));
        labels      = ['Selected Ward'];
        poorData    = [f ? f.get('poor')     || 0 : 0];
        nonPoorData = [f ? f.get('none_poor')|| 0 : 0];
    }
    else if (isConst) {
        features.forEach(f => {
            labels.push('Ward ' + (f.get('Wardnumber') || ''));
            poorData.push(f.get('poor')     || 0);
            nonPoorData.push(f.get('none_poor')|| 0);
        });
    }
    else {
        const grouped = {};
        features.forEach(f => {
            const cn = f.get('Constituen') || 'Unknown';
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
                { label:'Poor',      data:poorData,    backgroundColor:'#e74c3c', borderColor:'#000', borderWidth:1 },
                { label:'None-Poor', data:nonPoorData, backgroundColor:'#2ecc71', borderColor:'#000', borderWidth:1 }
            ]
        },
        options: {
            responsive: true,
            plugins: {
                title: {
                    display: true,
                    text: isWard  ? 'Welfare (Selected Ward)'
                        : isConst ? 'Welfare Comparison by Ward'
                        :           'Welfare Comparison by Constituency'
                },
                legend: { position: 'top' }
            },
            scales: { x: { stacked: false }, y: { beginAtZero: true } }
        }
    });
}

// ================= STARTUP =================
async function init() {
    // Load all GeoJSON files in parallel
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

    // Load all wards into the ward layer (overview)
    reloadSource(wardVectorSource, RAW.ward, false);

    // Populate province dropdown
    populateProvinces();

    // Start on overview tab
    switchTab('overview');
}

init();