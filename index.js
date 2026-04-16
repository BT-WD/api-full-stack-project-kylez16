let gameState = { score: 0, currentQuestion: null };

// Initialize 3D Globe
const globe = Globe()(document.getElementById('globeViz'))
    .globeImageUrl('//unpkg.com/three-globe/example/img/earth-dark.jpg')
    .polygonCapColor(() => 'rgba(100, 100, 100, 0.3)')
    .polygonSideColor(() => 'rgba(0, 0, 0, 0.1)')
    .polygonStrokeColor(() => '#444')
    .onPolygonClick(handleCountryClick);


// Load Polygon Data and Start
fetch('https://raw.githubusercontent.com/holtzy/D3-graph-gallery/master/DATA/world.geojson')
    .then(res => res.json())
    .then(countries => {
        globe.polygonsData(countries.features);

        // Set initial size
        globe.width(window.innerWidth);
        globe.height(window.innerHeight);

        nextQuestion();
    })
    .catch(err => console.error("GeoJSON load failed:", err));

// Resize handler
window.onresize = () => {
    globe.width(window.innerWidth);
    globe.height(window.innerHeight);
};