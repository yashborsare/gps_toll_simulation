const map = L.map('map').setView([21.1458, 79.0882], 10); 

L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
}).addTo(map);

let vehicleId = 1;
let vehicles = [];
let vehicleMarkers = {};

// 100x100 km area around Nagpur
const nagpurBounds = L.latLngBounds(
    [20.6458, 78.5882], // Southwest corner
    [21.6458, 79.5882]  // Northeast corner
);
L.rectangle(nagpurBounds, {color: "#007bff", weight: 2, fillColor: "#007bff", fillOpacity: 0.4}).addTo(map);

function addVehicle() {
    const vehicleList = document.getElementById('vehicleList');
    const vehicleDiv = document.createElement('div');
    vehicleDiv.classList.add('vehicle');
    vehicleDiv.id = `vehicle-${vehicleId}`;
    vehicleDiv.innerHTML = `
        <h3>Vehicle ${vehicleId}</h3>
        <label for="vehicle-id-${vehicleId}">Vehicle Identity</label>
        <input type="text" id="vehicle-id-${vehicleId}" placeholder="Enter Vehicle Identity">
        <label for="vehicle-balance-${vehicleId}">Balance</label>
        <input type="number" id="vehicle-balance-${vehicleId}" placeholder="Enter initial balance" value="1000">
        <ul class="waypoints" id="waypoints-${vehicleId}">
        </ul>
        <button class="btn" onclick="addWaypoint(${vehicleId})">Add Waypoint</button>
    `;
    vehicleList.appendChild(vehicleDiv);

    vehicles.push({
        id: vehicleId,
        identity: '',
        balance: 1000,
        waypoints: []
    });

    vehicleId++;
}

function addWaypoint(vehicleId) {
    const waypointsList = document.getElementById(`waypoints-${vehicleId}`);
    const waypointItem = document.createElement('li');
    waypointItem.innerHTML = `
        <input type="text" placeholder="Click on map to set waypoint" readonly>
    `;
    waypointsList.appendChild(waypointItem);
}

map.on('click', function(e) {
    const latLng = e.latlng;
    vehicles.forEach(vehicle => {
        const waypointsList = document.getElementById(`waypoints-${vehicle.id}`);
        const waypointItems = waypointsList.getElementsByTagName('li');
        for (let i = 0; i < waypointItems.length; i++) {
            const input = waypointItems[i].getElementsByTagName('input')[0];
            if (!input.value) {
                input.value = `${latLng.lat}, ${latLng.lng}`;
                vehicle.waypoints.push([latLng.lat, latLng.lng]);
                vehicleMarkers[vehicle.id] = L.marker(latLng).addTo(map).bindPopup(`Vehicle ${vehicle.id} Waypoint ${i + 1}`).openPopup();
                break;
            }
        }
    });
});

function runSimulation() {
    vehicles.forEach(vehicle => {
        vehicle.identity = document.getElementById(`vehicle-id-${vehicle.id}`).value;
        vehicle.balance = parseFloat(document.getElementById(`vehicle-balance-${vehicle.id}`).value);
    });

    $.ajax({
        url: '/simulate',
        type: 'POST',
        contentType: 'application/json',
        data: JSON.stringify({ vehicles: vehicles }),
        success: function(response) {
            const resultDiv = document.getElementById('result');
            resultDiv.innerHTML = '';
            response.forEach(result => {
                const resultItem = document.createElement('div');
                resultItem.classList.add('result-item');
                resultItem.innerHTML = `
                    <h4>Vehicle ${result.vehicle_id}</h4>
                    <p>Total Distance: ${result.total_distance.toFixed(2)} km</p>
                    <p>Toll Distance: ${result.toll_distance.toFixed(2)} km</p>
                    <p>Toll Charged: INR ${result.toll_charged.toFixed(2)}</p>
                    <p>Remaining Balance: INR ${result.remaining_balance.toFixed(2)}</p>
                `;
                resultDiv.appendChild(resultItem);
            });
        },
        error: function(error) {
            console.error('Error:', error);
        }
    });
}

function uploadGPSTracks() {
    const isAsync = document.getElementById('asyncCheckbox').checked;
    $.ajax({
        url: '/upload_gps_tracks',
        type: 'POST',
        contentType: 'application/json',
        data: JSON.stringify({ isAsync: isAsync }),
        success: function(response) {
            if (isAsync) {
                document.getElementById('requestId').innerText = `Request ID: ${response.requestId}`;
            } else {
                displayTollData(response);
            }
        },
        error: function(error) {
            console.error('Error:', error);
        }
    });
}

function downloadGPSTracks() {
    const requestId = document.getElementById('requestIdInput').value;
    $.ajax({
        url: '/download_gps_tracks',
        type: 'POST',
        contentType: 'application/json',
        data: JSON.stringify({ requestId: requestId }),
        success: function(response) {
            displayTollData(response);
        },
        error: function(error) {
            console.error('Error:', error);
        }
    });
}

function displayTollData(data) {
    const resultDiv = document.getElementById('result');
    resultDiv.innerHTML = '';
    data.routes.forEach(route => {
        const routeItem = document.createElement('div');
        routeItem.classList.add('route-item');
        routeItem.innerHTML = `
            <h4>Route</h4>
            <p>Total Distance: ${route.totalDistance.toFixed(2)} km</p>
            <p>Toll Distance: ${route.tollDistance.toFixed(2)} km</p>
            <p>Toll Amount: ${route.tollAmount.toFixed(2)}</p>
        `;
        resultDiv.appendChild(routeItem);
    });
}

document.getElementById('simulateBtn').addEventListener('click', runSimulation);
document.getElementById('uploadBtn').addEventListener('click', uploadGPSTracks);
document.getElementById('downloadBtn').addEventListener('click', downloadGPSTracks);
document.getElementById('addVehicleBtn').addEventListener('click', addVehicle);


fetch('/toll_zones')
    .then(response => response.json())
    .then(zones => {
        zones.forEach(zone => {
            L.polygon(zone, { color: 'red' }).addTo(map);
        });
    });

fetch('/highways')
    .then(response => response.json())
   

