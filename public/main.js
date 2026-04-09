// ================== MAIN.JS TOP ==================

// ---------------- MAP INITIALIZATION ----------------
const map = new ol.Map({
    target: 'map',
    layers: [
        // Optional: Uncomment if you want OSM underneath for reference
        // new ol.layer.Tile({
        //     source: new ol.source.OSM()
        // })
    ],
    view: new ol.View({
        center: ol.proj.fromLonLat([27.5, -18.5]), // Center of Zimbabwe
        zoom: 7
    })
});

// ---------------- BASE LAYER: MATNORT_2 ----------------
const matnortSource = new ol.source.Vector({
    format: new ol.format.GeoJSON(),
    url: 'data/Matnort_2.geojson' // Make sure the path is correct
});

const matnortLayer = new ol.layer.Vector({
    source: matnortSource,
    style: new ol.style.Style({
        fill: new ol.style.Fill({
            color: 'rgba(200, 200, 255, 0.6)'
        }),
        stroke: new ol.style.Stroke({
            color: '#3333ff',
            width: 1
        })
    })
});

// Add Matnort_2 as the first layer (your base map)
map.addLayer(matnortLayer);

// ---------------- POPUP SETUP (STEP 1) ----------------
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

// ---------------- OPTIONAL: MAP CLICK HANDLER FOR POPUPS ----------------
map.on('singleclick', function(evt) {
    const feature = map.forEachFeatureAtPixel(evt.pixel, f => f);
    if (feature) {
        const props = feature.getProperties();
        popupContainer.innerHTML = `
            <b>Province:</b> ${props.province || 'N/A'}<br>
            <b>Constituency:</b> ${props.constituen || 'N/A'}<br>
            <b>Ward:</b> ${props.wardnumber || 'N/A'}
        `;
        popupOverlay.setPosition(evt.coordinate);
    } else {
        closePopup();
    }
});

// ---------------- EDUCATION POPUP ----------------

// 1️⃣ Create a popup div dynamically
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

// 2️⃣ Create an OpenLayers overlay
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

// 3️⃣ Function to set popup content using your fields
function setSchoolPopupContent(feature){
    const name = feature.get('name') || 'N/A';
    const ownership = feature.get('responsibl') || 'N/A';
    const female = feature.get('enrol_fema') || 0;
    const male = feature.get('enrol_male') || 0;
    const total = feature.get('total_pupi') || 0;
    const teachers = feature.get('teachers') || 0;
    const ratio = feature.get('teacher_pu') || 'N/A';

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

// 4️⃣ Show popup on click
map.on('singleclick', function(evt){
    // Only show if Education tab is active
    if(!tabEducation.classList.contains('active')) return;

    // Check if a school feature was clicked
    const feature = map.forEachFeatureAtPixel(evt.pixel, function(f){
        return f.get('classifica') ? f : null; // Assuming school features have 'classifica'
    });

    if(feature){
        setSchoolPopupContent(feature);
        const coordinate = feature.getGeometry().getCoordinates();
        popupOverlay.setPosition(coordinate);
    } else {
        // Hide popup if clicked outside
        popupOverlay.setPosition(undefined);
    }
});
const tabButtons = document.querySelectorAll('.tabs button');
tabButtons.forEach(tab => {
    tab.addEventListener('click', () => {
        closePopup(); // Close the popup whenever a tab is clicked
    });
});
// ---------------- VECTOR ----------------
const wardVectorSource = new ol.source.Vector({
    format: new ol.format.GeoJSON(),
    url: 'data/Matnort_2.geojson'
});
const wardLayer = new ol.layer.Vector({
    source: wardVectorSource,
    style: wardLabelStyle
});
map.addLayer(wardLayer);
const waterVector = new ol.layer.Vector({
    source: new ol.source.Vector({
        format: new ol.format.GeoJSON(),
        url: 'data/Waterpoint_3.geojson'
    })
});
map.addLayer(waterVector);

const schoolVector = new ol.layer.Vector({
    source: new ol.source.Vector({
        format: new ol.format.GeoJSON(),
        url: 'data/school_4.geojson'
    })
});
map.addLayer(schoolVector);
// ---------------- STYLES ----------------
function wardLabelStyle(f){
    return new ol.style.Style({
        text:new ol.style.Text({
            text:String(f.get('wardnumber')||''),
            font:'bold 14px Calibri',
            fill:new ol.style.Fill({color:'#000'}),
            stroke:new ol.style.Stroke({color:'#fff',width:2})
        })
    });
}

function demographyStyle(f){
    const v = f.get('total_popu')||0;
    let c='#ffffcc';
    if(v>1200)c='#fd8d3c';
    if(v>1600)c='#e31a1c';
    if(v>1900)c='#800026';
    return new ol.style.Style({
        fill:new ol.style.Fill({color:c}),
        stroke:new ol.style.Stroke({color:'#555',width:1}),
        text: wardLabelStyle(f).getText()
    });
}

function prevalenceStyle(f){
    const v = f.get('poverty_pr')||0;
    let c='#fee5d9';
    if(v>25)c='#fcae91';
    if(v>40)c='#fb6a4a';
    if(v>55)c='#cb181d';
    return new ol.style.Style({
        fill:new ol.style.Fill({color:c}),
        stroke:new ol.style.Stroke({color:'#555',width:1}),
        text: wardLabelStyle(f).getText()
    });
}

function gapStyle(f){
    const v = f.get('poverty_ga')||0;
    let c='#eff3ff';
    if(v>3)c='#bdd7e7';
    if(v>5)c='#6baed6';
    if(v>7)c='#2171b5';
    return new ol.style.Style({
        fill:new ol.style.Fill({color:c}),
        stroke:new ol.style.Stroke({color:'#555',width:1}),
        text: wardLabelStyle(f).getText()
    });
}
function waterFunctionalStyle(f){
    const status = f.get('functional') || 'Non-Functional';
    let color = '#de2d26';
    if(status === 'Fully Functional') color = '#2ca25f';
    else if(status === 'Partially Functional') color = '#fc9272';
    else if(status === 'Collapsed/Abandoned') color ='#3182bd';
    else if(status === 'N/A') color = '#800080'; // purple;

    return new ol.style.Style({
        image: new ol.style.RegularShape({
            points: 4,
            radius: 6,
            fill: new ol.style.Fill({color: color}),
            stroke: new ol.style.Stroke({color:'#fff', width:1})
        })
    });
}

function waterSourceStyle(f){
    const type = f.get('type') || 'Other';
    let color = '#c6dbef';
    if(type === 'Borehole') color = '#3182bd';
    else if(type === 'Deep Well') color = '#990e0e';
    else if(type === 'Shallow Well') color = '#d838a5';
    else if (type == 'Dam') color = color ='#c4dd0b';
    else if(type == 'Spring') color = "#4daf4a";
    return new ol.style.Style({
        image: new ol.style.RegularShape({
            points: 4,
            radius: 6,
            fill: new ol.style.Fill({color: color}),
            stroke: new ol.style.Stroke({color:'#fff', width:1})
        })
    });
}
// ---------------- PIE CHART STYLE ----------------
function schoolPieStyle(f){
    const male = f.get('enrol_male') || 0;
    const female = f.get('enrol_fema') || 0;
    const total = male + female;
    if(total === 0) return null;

    // Scale the pie size based on total enrolment
    const minRadius = 8;   // minimum radius for small schools
    const maxRadius = 20;  // maximum radius for large schools
    const maxEnrolment = 1000; // adjust according to your data
    const radiusScale = Math.min(maxRadius, minRadius + (total / maxEnrolment) * (maxRadius - minRadius));

    const radiusX = radiusScale;         // horizontal radius
    const radiusY = radiusScale * 0.8;   // vertical radius (squished for 3D)
    const centerX = radiusX;
    const centerY = radiusX;
    const depth = radiusScale * 0.25;    // thickness of pie

    const canvasSize = radiusX * 2 + depth + 2; // add some padding
    const canvas = document.createElement('canvas');
    canvas.width = canvasSize;
    canvas.height = canvasSize;
    const ctx = canvas.getContext('2d');

    let startAngle = 0;

    const slices = [
        {value: male, color:'#3182bd', shadow:'#1e488c'},
        {value: female, color:'#fc6ea8', shadow:'#b14f7c'}
    ];

    // Draw the "side" of each slice
    slices.forEach(slice => {
        const angle = (slice.value / total) * 2 * Math.PI;
        if(angle === 0) return;

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

    // Draw the top slices
    startAngle = 0;
    slices.forEach(slice => {
        const angle = (slice.value / total) * 2 * Math.PI;
        if(angle === 0) return;

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
        image: new ol.style.Icon({
            img: canvas,
            imgSize: [canvasSize, canvasSize]
        }),
        text: new ol.style.Text({
            text: f.get('name') || '',
            font: '12px Calibri',
            fill: new ol.style.Fill({color:'#000'}),
            stroke: new ol.style.Stroke({color:'#fff', width:2}),
            offsetY: -radiusX - 5
        })
    });
}

// ---------------- DROPDOWNS ----------------
const elProv=document.getElementById('select-province');
const elConst=document.getElementById('select-constituency');
const elWard=document.getElementById('select-ward');

function featureMatchesFilter(f){
    if(elProv.value && f.get('province') !== elProv.value) return false;
    if(elConst.value && f.get('constituen') !== elConst.value) return false;
    if(elWard.value && String(f.get('wardnumber')) !== String(elWard.value)) return false;
    return true;
}
function applySettlementFilter(){
    settlementsVector.setStyle(f => {
        if(!featureMatchesFilter(f)) return null;

        if(tabEducation.classList.contains('active')){
            return settlementsEducationStyle(f);
        }

        return settlementsStyle(f);
    });
}



// ---------------- Populate Province & dropdowns ----------------
function getUniqueValues(features, field){
    const vals = features.map(f => f.get(field)).filter(v => v != null);
    return [...new Set(vals)].sort();
}

// Populate provinces after data loads
// Populate provinces first
wardVectorSource.once('change', () => {
    if (wardVectorSource.getState() !== 'ready') return;
    const features = wardVectorSource.getFeatures();

    // Provinces
    const provinces = getUniqueValues(features, 'province');
    provinces.forEach(p => elProv.add(new Option(p, p)));

    // On province change -> populate constituencies
    elProv.addEventListener('change', () => {
        // Clear lower dropdowns
        elConst.innerHTML = '<option value="">All Constituencies</option>';
        elWard.innerHTML = '<option value="">All Wards</option>';

        const consts = features
            .filter(f => f.get('province') === elProv.value)
            .map(f => f.get('constituen'))
            .filter(Boolean);
        [...new Set(consts)].sort().forEach(c => elConst.add(new Option(c, c)));

        applyHealthTab(getActiveHealthTab()); // refresh health
    });

    // On constituency change -> populate wards
    elConst.addEventListener('change', () => {
        elWard.innerHTML = '<option value="">All Wards</option>';
        const wards = features
            .filter(f => f.get('constituen') === elConst.value)
            .map(f => f.get('wardnumber'))
            .filter(Boolean);
        [...new Set(wards)].sort((a,b) => a-b).forEach(w => elWard.add(new Option(w, w)));

        applyHealthTab(getActiveHealthTab());
    });

    // On ward change -> refresh
    elWard.addEventListener('change', () => {
        applyHealthTab(getActiveHealthTab());
    });
});


elProv.addEventListener('change', ()=>{
    applyWaterFilter();
    applyRoadFilter();
    applySchoolFilter();
    applySettlementFilter();
    applyHealthFilter();
});

elConst.addEventListener('change', ()=>{
    applyWaterFilter();
    applyRoadFilter();
    applySchoolFilter();
    applySettlementFilter();
    applyHealthFilter();
});

elWard.addEventListener('change', ()=>{
    applyWaterFilter();
    applyRoadFilter();
    applySchoolFilter();
    applySettlementFilter();
    applyHealthFilter();
});

// ---------------- TABS ----------------
const tabOverview=document.getElementById('tab-overview');
const tabDemography=document.getElementById('tab-demography');
const tabWelfare=document.getElementById('tab-welfare');
const tabHealth=document.getElementById('tab-health');
const tabRoads = document.getElementById('tab-roads');

const overviewContent=document.getElementById('overview-content');
const demographyContent=document.getElementById('demography-content');
const welfareContent=document.getElementById('welfare-content');
const healthContent=document.getElementById('health-content');
const roadsContent = document.getElementById('roads-content');

const popLegend=document.getElementById('pop-legend');
const prevLegend=document.getElementById('prev-legend');
const gapLegend=document.getElementById('gap-legend');

const btnPrev=document.getElementById('btn-prevalence');
const btnGap=document.getElementById('btn-gap');

const btnHealthDist=document.getElementById('btn-health-dist');
const btnHealthZone=document.getElementById('btn-health-zone');
const btnHealthDeficit=document.getElementById('btn-health-deficit');

const btnRoadCondition = document.getElementById('btn-road-condition');
const btnRoadSurface = document.getElementById('btn-road-surface');

btnRoadCondition.onclick = () => {
    btnRoadCondition.classList.add('active');
    btnRoadSurface.classList.remove('active');

    roadsVector.setStyle(roadConditionStyle);

    document.getElementById('roads-legend-condition').style.display='block';
    document.getElementById('roads-legend-surface').style.display='none';
};

btnRoadSurface.onclick = () => {
    btnRoadSurface.classList.add('active');
    btnRoadCondition.classList.remove('active');

    roadsVector.setStyle(roadSurfaceStyle);

    document.getElementById('roads-legend-condition').style.display='none';
    document.getElementById('roads-legend-surface').style.display='block';
};
const tabWater = document.getElementById('tab-water');
const waterContent = document.getElementById('water-content');
const btnWaterFunctional = document.getElementById('btn-water-functional');
const btnWaterType = document.getElementById('btn-water-type');
const waterLegendFunctional = document.getElementById('water-legend-functional');
const waterLegendType = document.getElementById('water-legend-type');

// Main tab click
tabWater.onclick = () => {
    switchTab('water');
};

// Sub-tabs
btnWaterFunctional.onclick = () => {
    btnWaterFunctional.classList.add('active');
    btnWaterType.classList.remove('active');

    applyWaterFilter(); // ✅ ADD THIS

    waterVector.setStyle(waterFunctionalStyle);
    waterVector.setVisible(true);

    waterLegendFunctional.style.display = 'block';
    waterLegendType.style.display = 'none';
};

btnWaterType.onclick = () => {
    btnWaterType.classList.add('active');
    btnWaterFunctional.classList.remove('active');

    applyWaterFilter();  // ✅ ADD THIS

    waterVector.setStyle(waterSourceStyle);
    waterVector.setVisible(true);

    waterLegendFunctional.style.display = 'none';
    waterLegendType.style.display = 'block';
};
// ---------------- TAB BUTTONS EDUCATION ----------------
const tabEducation = document.getElementById('tab-education');
const educationContent = document.getElementById('education-content');
const btnEducationPrimary = document.getElementById('btn-education-primary');
const btnEducationSecondary = document.getElementById('btn-education-secondary');

// Sub-tab click
btnEducationPrimary.onclick = () => {
    btnEducationPrimary.classList.add('active');
    btnEducationSecondary.classList.remove('active');

    schoolVector.setStyle(f=>{
        if(f.get('classifica') === 'Primary Schools') return schoolPieStyle(f);
        return null;
    });
    schoolVector.setVisible(true);
    settlementsVector.setVisible(true); // Settlements always visible
};

btnEducationSecondary.onclick = () => {
    btnEducationSecondary.classList.add('active');
    btnEducationPrimary.classList.remove('active');

    schoolVector.setStyle(f=>{
        if(f.get('classifica') === 'High Schools') return schoolPieStyle(f);
        return null;
    });
    schoolVector.setVisible(true);
    settlementsVector.setVisible(true); // Settlements always visible
};

// ---------------- HEALTH LEGENDS ----------------
const healthLegendFacilities = document.getElementById('health-legend-facilities');
const healthLegendService = document.getElementById('health-legend-service');
const healthLegendDeficit = document.getElementById('health-legend-deficit');

// ---------------- VECTOR LAYERS FOR PUBLIC HEALTH ----------------
const healthVector = new ol.layer.Vector({
    source: new ol.source.Vector({ 
        format: new ol.format.GeoJSON(),
        url: 'data/Health_2.geojson'
    })
});
map.addLayer(healthVector);
const bufferVector = new ol.layer.Vector({
    source: new ol.source.Vector({ 
        format: new ol.format.GeoJSON(),
        url: 'data/Health_buffer.geojson'
    })
});
map.addLayer(bufferVector);
const roadsVector = new ol.layer.Vector({
    source: new ol.source.Vector({
        format: new ol.format.GeoJSON(),
        url: 'data/lovedroads.geojson'
    })
});

const settlementsVector = new ol.layer.Vector({
    source: new ol.source.Vector({
        format: new ol.format.GeoJSON(),
        url: 'data/settlements_2.geojson'
    })
});

map.addLayer(settlementsVector);


// Hide by default
healthVector.setVisible(false);
bufferVector.setVisible(false);
roadsVector.setVisible(false);
settlementsVector.setVisible(false);
schoolVector.setVisible(false);

map.addLayer(roadsVector);
map.addLayer(bufferVector);
map.addLayer(healthVector);

// ---------------- HEALTH STYLES ----------------
function healthFacilitiesStyle(f){
    const t=f.get('typeoffaci');
    let color='#3182bd';
    if(t==='Hospital') color='red';
    else if(t==='Clinic') color='green';
    else if(t==='Pharmacy') color='orange';
    return new ol.style.Style({
        image:new ol.style.Circle({radius:6, fill:new ol.style.Fill({color:color}), stroke:new ol.style.Stroke({color:'#fff', width:1})}),
        text:new ol.style.Text({text:f.get('nameoffaci')||'', offsetY:-10, font:'12px Calibri', fill:new ol.style.Fill({color:'#000'}), stroke:new ol.style.Stroke({color:'#fff', width:2})})
    });
}

function settlementsStyle(f){
    return new ol.style.Style({
        fill: new ol.style.Fill({
            color: '#b87f53'
        }),
        stroke: new ol.style.Stroke({
            color: '#b87f53',
            width: 1
        })    
    });
}

function roadsDeficitStyle(f){
    const cls=f.get('road_condi');
    let w=1, c='#000';
    if(cls==='paved'){w=3;c='#ba3434';}
    else if(cls==='unpaved'){w=2;c='#ebd45f';}
    return new ol.style.Style({
        stroke:new ol.style.Stroke({color:c, width:w})
    });
}
function settlementsEducationStyle(f){
    return new ol.style.Style({
        fill: new ol.style.Fill({
            color: '#d14b11' // green, for example
        }),
        stroke: new ol.style.Stroke({
            color: '#820707',
            width: 1
        })
    });
}    

// ---------------- Road styles ----------------

function roadConditionStyle(f){
    const cond = f.get('road_struc');
    let color = '#f1c40f'; // Fair (yellow)

    if(cond === 'Poor to very Poor'){
        color = '#e74c3c'; // red
    }

    return new ol.style.Style({
        stroke: new ol.style.Stroke({
            color: color,
            width: 3
        })
    });
}
function roadSurfaceStyle(f){
    const type = f.get('road_condi');
    let color = '#ba3434', width = 3; // paved

    if(type === 'unpaved'){
        color = '#ebd45f';
        width = 2;
    }

    return new ol.style.Style({
        stroke: new ol.style.Stroke({
            color: color,
            width: width
        })
    });
}
// ---------------- APPLY HEALTH TAB ----------------
function applyHealthTab(tab) {
    // ---------------- RESET VISIBILITY ----------------
    healthVector.setVisible(false);
    bufferVector.setVisible(false);
    roadsVector.setVisible(false);
    settlementsVector.setVisible(false);

    healthLegendFacilities.style.display = 'none';
    healthLegendService.style.display = 'none';
    healthLegendDeficit.style.display = 'none';

    // ---------------- BUILD FILTER ----------------
    const filter = escapeCQL(elProv.value)
        ? `province='${escapeCQL(elProv.value)}'` +
          (elConst.value ? ` AND constituen='${escapeCQL(elConst.value)}'` : '') +
          (elWard.value ? ` AND wardnumber='${escapeCQL(elWard.value)}'` : '')
        : '';

    // Apply filter function to health features
    const filterFunction = f => {
        if (!filter) return true; // no filter = show all
        return featureMatchesFilter(f); // your existing helper
    };

    // ---------------- SWITCH TAB ----------------
    if (tab === 'facilities') {
        healthVector.setVisible(true);
        settlementsVector.setVisible(true);
        healthVector.setStyle(f => filterFunction(f) ? healthFacilitiesStyle(f) : null);
        settlementsVector.setStyle(f => filterFunction(f) ? settlementsStyle(f) : null);
        healthLegendFacilities.style.display = 'block';
    } else if (tab === 'service') {
        healthVector.setVisible(true);
        bufferVector.setVisible(true);
        settlementsVector.setVisible(true);

        healthVector.setStyle(f => filterFunction(f) ? new ol.style.Style({
            image: new ol.style.Circle({
                radius: 6,
                fill: new ol.style.Fill({ color: '#3182bd' })
            })
        }) : null);

        bufferVector.setStyle(f => filterFunction(f) ? new ol.style.Style({
            fill: new ol.style.Fill({ color: 'rgba(102,194,165,0.4)' }),
            stroke: new ol.style.Stroke({ color: '#555', width: 1 })
        }) : null);

        settlementsVector.setStyle(f => filterFunction(f) ? settlementsStyle(f) : null);
        healthLegendService.style.display = 'block';
    } else if (tab === 'deficit') {
        healthVector.setVisible(true);
        bufferVector.setVisible(true);
        settlementsVector.setVisible(true);
        roadsVector.setVisible(true);

        healthVector.setStyle(f => filterFunction(f) ? new ol.style.Style({
            image: new ol.style.Circle({
                radius: 6,
                fill: new ol.style.Fill({ color: '#aaa' })
            })
        }) : null);

        bufferVector.setStyle(f => filterFunction(f) ? new ol.style.Style({
            fill: new ol.style.Fill({ color: 'rgba(255,255,255,0.6)' }),
            stroke: new ol.style.Stroke({ color: '#aaa', width: 1 })
        }) : null);

        roadsVector.setStyle(f => filterFunction(f) ? roadsDeficitStyle(f) : null);
        settlementsVector.setStyle(f => filterFunction(f) ? settlementsStyle(f) : null);
        healthLegendDeficit.style.display = 'block';
    }

    // ---------------- ENSURE HEALTH VECTOR ON TOP ----------------
    map.removeLayer(healthVector);
    map.addLayer(healthVector);
}

// ---------------- TABS ----------------
tabOverview.onclick=()=>switchTab('overview');
tabDemography.onclick=()=>switchTab('demography');
tabWelfare.onclick=()=>switchTab('welfare');
tabHealth.onclick=()=>switchTab('health');
tabRoads.onclick = () => switchTab('roads');
tabEducation.onclick = () => switchTab('education');
btnEducationPrimary.onclick = () => {
    btnEducationPrimary.classList.add('active');
    btnEducationSecondary.classList.remove('active');

    applySchoolFilter(); // ✅ ADD THIS
    applySettlementFilter();
    schoolVector.setStyle(f=>{
        if(f.get('classifica') === 'Primary Schools') return schoolPieStyle(f);
        return null;
    });

    schoolVector.setVisible(true);
    settlementsVector.setVisible(true);
    settlementsVector.setStyle(settlementsEducationStyle);
};
btnEducationSecondary.onclick = () => {
    btnEducationSecondary.classList.add('active');
    btnEducationPrimary.classList.remove('active');

    applySchoolFilter(); // ✅ ADD THIS
    applySettlementFilter();
    schoolVector.setStyle(f=>{
        if(f.get('classifica') === 'High Schools') return schoolPieStyle(f);
        return null;
    });

    schoolVector.setVisible(true);
    settlementsVector.setVisible(true);
    settlementsVector.setStyle(settlementsEducationStyle);
};
btnPrev.onclick=()=>{ welfareMode='prevalence'; btnPrev.classList.add('active'); btnGap.classList.remove('active'); applyWelfareStyle(); updateWelfareStats(); };
btnGap.onclick=()=>{ welfareMode='gap'; btnGap.classList.add('active'); btnPrev.classList.remove('active'); applyWelfareStyle(); updateWelfareStats(); };

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
function setActiveHealthTab(activeBtn){
    btnHealthDist.classList.remove('active');
    btnHealthZone.classList.remove('active');
    btnHealthDeficit.classList.remove('active');

    activeBtn.classList.add('active');
}


// ---------------- ZOOM ----------------
document.getElementById('zoom-layer').onclick=()=>{
    const features=wardVectorSource.getFeatures();
    if(!features.length) return;
    const extent = features.reduce((acc,f)=>ol.extent.extend(acc,f.getGeometry().getExtent()), ol.extent.createEmpty());
    map.getView().fit(extent,{padding:[50,50,50,50], duration:800});
};

// ---------------- HELPER FUNCTIONS (Population & Welfare) ----------------
function switchTab(mode){

    // ---------------- RESET EVERYTHING ----------------
    overviewContent.style.display='none';
    demographyContent.style.display='none';
    welfareContent.style.display='none';
    healthContent.style.display='none';
    roadsContent.style.display='none';
    waterContent.style.display='none';
    educationContent.style.display='none';
    

    // Legends
    popLegend.style.display='none';
    prevLegend.style.display='none';
    gapLegend.style.display='none';

    healthLegendFacilities.style.display='none';
    healthLegendService.style.display='none';
    healthLegendDeficit.style.display='none';
    
    document.getElementById('education-legend').style.display='none';

    document.getElementById('roads-legend-condition').style.display='none';
    document.getElementById('roads-legend-surface').style.display='none';

    waterLegendFunctional.style.display='none';
    waterLegendType.style.display='none';

    // Remove ALL active tabs
    tabOverview.classList.remove('active');
    tabDemography.classList.remove('active');
    tabWelfare.classList.remove('active');
    tabHealth.classList.remove('active');
    tabRoads.classList.remove('active');
    tabWater.classList.remove('active');
    tabEducation.classList.remove('active');

    // Hide ALL layers
    healthVector.setVisible(false);
    bufferVector.setVisible(false);
    roadsVector.setVisible(false);
    settlementsVector.setVisible(false);
    waterVector.setVisible(false);
    schoolVector.setVisible(false);

    // ---------------- SWITCH ----------------
    if(mode==='overview'){
        overviewContent.style.display='block';
        wardLayer.setStyle(wardLabelStyle);
        tabOverview.classList.add('active');
    }

    else if(mode==='demography'){
        demographyContent.style.display='block';
        wardLayer.setStyle(demographyStyle);
        popLegend.style.display='block';
        tabDemography.classList.add('active');
        updatePopulationStats();
    }

    else if(mode==='welfare'){
        welfareContent.style.display='block';
        tabWelfare.classList.add('active');
        applyWelfareStyle();
        updateWelfareStats();
        updateWelfareChart();
    }

    else if(mode==='health'){
        healthContent.style.display='block';
        tabHealth.classList.add('active');
        applyHealthTab('facilities');
    }

    else if(mode==='roads'){
        roadsContent.style.display='block';
        tabRoads.classList.add('active');

        roadsVector.setVisible(true);
        applyRoadFilter();

        // default
        roadsVector.setStyle(roadConditionStyle);
        document.getElementById('roads-legend-condition').style.display='block';
    }

    else if(mode==='water'){
    waterContent.style.display='block';
    tabWater.classList.add('active');

    // Apply filter first
    applyWaterFilter();

    // ✅ FORCE default button click
    btnWaterFunctional.click();

    // Ensure layer is on top
    map.removeLayer(waterVector);
    map.addLayer(waterVector);
}

else if(mode==='education'){
    educationContent.style.display='block';
    tabEducation.classList.add('active');

    document.getElementById('education-legend').style.display='block';

    // 🔥 APPLY FILTER FIRST
    applySchoolFilter();
    applySettlementFilter();

    // Show schools
    schoolVector.setVisible(true);
    settlementsVector.setVisible(true);





    // Ensure layer is on top
    map.removeLayer(schoolVector);
    map.addLayer(schoolVector);
}
}



function applyWelfareStyle(){ 
    if(welfareMode==='prevalence'){ wardLayer.setStyle(prevalenceStyle); prevLegend.style.display='block'; gapLegend.style.display='none'; } 
    else { wardLayer.setStyle(gapStyle); gapLegend.style.display='block'; prevLegend.style.display='none'; } 
}

function updatePopulationStats(){ 
    const data = wardVectorSource.getFeatures(); 
    const total = data.reduce((s,f)=>s+(f.get('total_popu')||0),0); 
    document.getElementById('pop-province').innerText = elProv.value || 'N/A'; 
    document.getElementById('pop-constituency').innerText = elConst.value || 'N/A'; 
    document.getElementById('pop-total').innerText = total;

    updatePopulationCharts();
}
// ---------------- THREE POPULATION CHARTS ----------------
let chart0_14, chart15_64, chart65;

function updatePopulationCharts() {
    const features = wardVectorSource.getFeatures();
    if (!features.length) return;

    let labels = [];
    let m_0_14 = [], f_0_14 = [];
    let m_15_64 = [], f_15_64 = [];
    let m_65 = [], f_65 = [];

    const isWard = elWard.value;
    const isConst = elConst.value;
    const isProv = elProv.value;

    // ---------------- WARD LEVEL ----------------
    if (isWard) {
        const f = features.find(ft => String(ft.get('wardnumber')) === String(elWard.value));
        if (!f) return;

        labels = ['Selected Ward'];
        m_0_14 = [f.get('m_0_14') || 0];
        f_0_14 = [f.get('f_0_14') || 0];
        m_15_64 = [f.get('m_15_64') || 0];
        f_15_64 = [f.get('f_15_64') || 0];
        m_65 = [f.get('m_65') || 0];
        f_65 = [f.get('f_65') || 0];
    }

    // ---------------- CONSTITUENCY LEVEL ----------------
    else if (isConst) {
        const constFeatures = features.filter(f => f.get('constituen') === elConst.value);
        if (!constFeatures.length) return;

        constFeatures.forEach(f => {
            labels.push("Ward " + (f.get('wardnumber') || ''));
            m_0_14.push(f.get('m_0_14') || 0);
            f_0_14.push(f.get('f_0_14') || 0);
            m_15_64.push(f.get('m_15_64') || 0);
            f_15_64.push(f.get('f_15_64') || 0);
            m_65.push(f.get('m_65') || 0);
            f_65.push(f.get('f_65') || 0);
        });
    }

    // ---------------- PROVINCE LEVEL ----------------
    else if (isProv) {
        // Filter only wards in the selected province
        const provFeatures = features.filter(f => f.get('province') === elProv.value);
        if (!provFeatures.length) return;

        // Group by constituency
        const grouped = {};
        provFeatures.forEach(f => {
            const constName = f.get('constituen') || 'Unknown';
            if (!grouped[constName]) {
                grouped[constName] = { m_0_14: 0, f_0_14: 0, m_15_64: 0, f_15_64: 0, m_65: 0, f_65: 0 };
            }
            grouped[constName].m_0_14 += f.get('m_0_14') || 0;
            grouped[constName].f_0_14 += f.get('f_0_14') || 0;
            grouped[constName].m_15_64 += f.get('m_15_64') || 0;
            grouped[constName].f_15_64 += f.get('f_15_64') || 0;
            grouped[constName].m_65 += f.get('m_65') || 0;
            grouped[constName].f_65 += f.get('f_65') || 0;
        });

        labels = Object.keys(grouped);
        labels.forEach(c => {
            m_0_14.push(grouped[c].m_0_14);
            f_0_14.push(grouped[c].f_0_14);
            m_15_64.push(grouped[c].m_15_64);
            f_15_64.push(grouped[c].f_15_64);
            m_65.push(grouped[c].m_65);
            f_65.push(grouped[c].f_65);
        });
    }

    // ---------------- DESTROY OLD CHARTS ----------------
    if (chart0_14) chart0_14.destroy();
    if (chart15_64) chart15_64.destroy();
    if (chart65) chart65.destroy();

    const chartOptions = (title) => ({
        responsive: true,
        plugins: { title: { display: true, text: title } },
        scales: { x: { ticks: { autoSkip: false, maxRotation: 45, minRotation: 45 } } }
    });

    // ---------------- CHART 1: 0-14 ----------------
    chart0_14 = new Chart(document.getElementById('chart_0_14'), {
        type: 'bar',
        data: {
            labels,
            datasets: [
                { label: 'Male (0-14)', data: m_0_14, backgroundColor: '#3182bd', borderColor: '#000', borderWidth: 1 },
                { label: 'Female (0-14)', data: f_0_14, backgroundColor: '#fc6ea8', borderColor: '#000', borderWidth: 1 }
            ]
        },
        options: chartOptions('Population (0–14 Years)')
    });

    // ---------------- CHART 2: 15-64 ----------------
    chart15_64 = new Chart(document.getElementById('chart_15_64'), {
        type: 'bar',
        data: {
            labels,
            datasets: [
                { label: 'Male (15-64)', data: m_15_64, backgroundColor: '#3182bd', borderColor: '#000', borderWidth: 1 },
                { label: 'Female (15-64)', data: f_15_64, backgroundColor: '#fc6ea8', borderColor: '#000', borderWidth: 1 }
            ]
        },
        options: chartOptions('Population (15–64 Years)')
    });

    // ---------------- CHART 3: 65+ ----------------
    chart65 = new Chart(document.getElementById('chart_65'), {
        type: 'bar',
        data: {
            labels,
            datasets: [
                { label: 'Male (65+)', data: m_65, backgroundColor: '#3182bd', borderColor: '#000', borderWidth: 1 },
                { label: 'Female (65+)', data: f_65, backgroundColor: '#fc6ea8', borderColor: '#000', borderWidth: 1 }
            ]
        },
        options: chartOptions('Population (65+ Years)')
    });
}


function updateWelfareStats(){ 
    const data = wardVectorSource.getFeatures(); 
    const field = (welfareMode==='prevalence')?'poverty_pr':'poverty_ga'; 
    const vals = data.map(f=>f.get(field)||0); 
    const avg = vals.length ? (vals.reduce((a,b)=>a+b,0)/vals.length).toFixed(2) : 'N/A'; 
    document.getElementById('wel-province').innerText = elProv.value || 'N/A'; 
    document.getElementById('wel-constituency').innerText = elConst.value || 'N/A'; 
    document.getElementById('wel-value').innerText = avg; 

    updateWelfareChart();

}
// ---------------- WELFARE CHART ----------------
let welfareChart = null;

function updateWelfareChart(){
    const features = wardVectorSource.getFeatures();
    if(!features.length) return;

    let labels = [];
    let poorData = [];
    let nonPoorData = [];

    const isWard = elWard.value;
    const isConst = elConst.value;

    // ---------------- WARD LEVEL ----------------
    if(isWard){
        const f = features.find(ft => 
            String(ft.get('wardnumber')) === String(elWard.value)
        );

        labels = ['Selected Ward'];

        poorData = [f.get('poor') || 0];
        nonPoorData = [f.get('none_poor') || 0];
    }

    // ---------------- CONSTITUENCY LEVEL ----------------
    else if(isConst){
        features.forEach(f => {
            labels.push("Ward " + (f.get('wardnumber') || ''));

            poorData.push(f.get('poor') || 0);
            nonPoorData.push(f.get('none_poor') || 0);
        });
    }

    // ---------------- PROVINCE LEVEL ----------------
    else {
        // Group by constituency
        const grouped = {};

        features.forEach(f => {
            const constName = f.get('constituen') || 'Unknown';

            if(!grouped[constName]){
                grouped[constName] = { poor: 0, none_poor: 0 };
            }

            grouped[constName].poor += f.get('poor') || 0;
            grouped[constName].none_poor += f.get('none_poor') || 0;
        });

        labels = Object.keys(grouped);

        labels.forEach(c => {
            poorData.push(grouped[c].poor);
            nonPoorData.push(grouped[c].none_poor);
        });
    }

    const ctx = document.getElementById('welfareChart').getContext('2d');

    // Destroy old chart
    if(welfareChart){
        welfareChart.destroy();
    }

    welfareChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [
                {
                    label: 'Poor',
                    data: poorData,
                    backgroundColor: '#e74c3c', // red
                    borderColor: '#000',
                    borderWidth: 1
                },
                {
                    label: 'None-Poor',
                    data: nonPoorData,
                    backgroundColor: '#2ecc71', // green
                    borderColor: '#000',
                    borderWidth: 1
                }
            ]
        },
        options: {
            responsive: true,
            plugins: {
                title: {
                    display: true,
                    text: isWard 
                        ? 'Welfare (Selected Ward)' 
                        : isConst 
                            ? 'Welfare Comparison by Ward'
                            : 'Welfare Comparison by Constituency'
                },
                legend: {
                    position: 'top'
                }
            },
            scales: {
                x: {
                    stacked: false
                },
                y: {
                    beginAtZero: true
                }
            }
        }
    });
}
function applyRoadFilter(){
    roadsVector.setStyle(f => {
        if(!featureMatchesFilter(f)) return null;

        if(btnRoadCondition.classList.contains('active')){
            return roadConditionStyle(f);
        }

        if(btnRoadSurface.classList.contains('active')){
            return roadSurfaceStyle(f);
        }

        return null;
    });
}
function applyWaterFilter(){
    waterVector.setStyle(f => {
        if(!featureMatchesFilter(f)) return null;
        return waterFunctionalStyle(f); // or waterSourceStyle
    });
}
function applySchoolFilter(){
    schoolVector.setStyle(f => {
        if(!featureMatchesFilter(f)) return null;

        if(btnEducationPrimary.classList.contains('active')){
            return f.get('classifica') === 'Primary Schools' ? schoolPieStyle(f) : null;
        }

        if(btnEducationSecondary.classList.contains('active')){
            return f.get('classifica') === 'High Schools' ? schoolPieStyle(f) : null;
        }

        return null;
    });
}
function applyHealthFilter(){
    healthVector.setStyle(f => {
        if(!featureMatchesFilter(f)) return null;
        return healthFacilitiesStyle(f);
    });

    bufferVector.setStyle(f => {
        if(!featureMatchesFilter(f)) return null;
        return new ol.style.Style({
            fill: new ol.style.Fill({color:'rgba(102,194,165,0.4)'}),
            stroke: new ol.style.Stroke({color:'#555', width:1})
        });
    });
}
