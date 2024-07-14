from flask import Flask, render_template, request, jsonify
import simpy
import pandas as pd
from shapely.geometry import Point, Polygon
import geopy.distance
import json
import os
import requests
from urllib.parse import urlencode
from time import sleep

app = Flask(__name__)

# Example toll zones (use real data for actual implementation)
toll_zones = [
    Polygon([(21.0, 79.0), (21.5, 79.0), (21.5, 79.5), (21.0, 79.5)]),
    Polygon([(21.5, 79.5), (22.0, 79.5), (22.0, 80.0), (21.5, 80.0)])
]

# Example highways (use real data for actual implementation)
highways = [
    [(21.0, 79.0), (21.5, 79.0), (22.0, 79.5)],
    [(21.5, 79.5), (22.0, 80.0)]
]

# TollGuru API setup
TOLLGURU_API_KEY = os.environ.get("TOLLGURU_API_KEY")
TOLLGURU_API_URL = "https://apis.tollguru.com/toll/v2/route"

PARAMETERS = {
    "source": "gmaps",
    "polyline": "",
    "vehicleType": "2AxlesAuto",
    "departure_time": None,
    "currency": "INR"
}

def calculate_toll(polyline, vehicle_type="2AxlesAuto"):
    url = f"{TOLLGURU_API_URL}"
    headers = {"x-api-key": TOLLGURU_API_KEY, "Content-Type": "application/json"}
    payload = {
        "source": "gmaps",
        "polyline": polyline,
        "vehicleType": vehicle_type,
        "departure_time": None,
        "currency": "INR"
    }
    response = requests.post(url, headers=headers, json=payload)
    return response.json()

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/toll_zones')
def get_toll_zones():
    return jsonify([[list(coord) for coord in zone.exterior.coords] for zone in toll_zones])

@app.route('/highways')
def get_highways():
    return jsonify(highways)

def vehicle_movement(env, vehicle, results):
    waypoints = [Point(coord) for coord in vehicle['waypoints']]
    total_distance = sum(geopy.distance.distance((waypoints[i].y, waypoints[i].x), (waypoints[i+1].y, waypoints[i+1].x)).km for i in range(len(waypoints) - 1))
    toll_distance = 0

    for i in range(len(waypoints) - 1):
        start = waypoints[i]
        end = waypoints[i + 1]
        segment_distance = geopy.distance.distance((start.y, start.x), (end.y, end.x)).km
        current_location = start
        while current_location.distance(end) > 0.1:
            next_location = Point(
                current_location.x + (end.x - start.x) / segment_distance * 0.1,
                current_location.y + (end.y - start.y) / segment_distance * 0.1
            )
            current_location = next_location
            for zone in toll_zones:
                if zone.contains(current_location):
                    toll_distance += 0.1
                    break
            yield env.timeout(1)
    
    toll_rate = 1.75  # INR per km
    toll = toll_distance * toll_rate
    vehicle['balance'] -= toll

    results.append({
        'vehicle_id': vehicle['id'],
        'total_distance': total_distance,
        'toll_distance': toll_distance,
        'toll_charged': toll,
        'remaining_balance': vehicle['balance']
    })

@app.route('/simulate', methods=['POST'])
def simulate():
    vehicles = request.json['vehicles']
    env = simpy.Environment()
    results = []

    for vehicle in vehicles:
        env.process(vehicle_movement(env, vehicle, results))

    env.run()
    return jsonify(results)

@app.route('/calculate_toll', methods=['POST'])
def get_toll():
    data = request.json
    polyline = data.get("polyline")
    vehicle_type = data.get("vehicleType", "2AxlesAuto")
    toll_info = calculate_toll(polyline, vehicle_type)
    return jsonify(toll_info)

if __name__ == '__main__':
    app.run(debug=True)
