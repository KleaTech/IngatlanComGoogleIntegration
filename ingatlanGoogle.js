// ==UserScript==
// @name         Ingatlan Térkép
// @namespace    http://tampermonkey.net/
// @version      0.1
// @description  try to take over the world!
// @author       You
// @match        https://ingatlan.com/*
// @icon         https://www.google.com/s2/favicons?domain=ingatlan.com
// @grant        none
// @run-at       document-idle
// ==/UserScript==

(function() {
async function loadMap() {
  return new Promise((resolve) => {
    const mapScript = document.createElement("script");
    mapScript.src = "https://maps.googleapis.com/maps/api/js?key=<API_KEY_OMITTED>&callback=initMap";
    mapScript.async = true;
    window.initMap = () => {
      resolve();
      delete window.initMap;
    };
    document.body.append(mapScript);
  });
}

async function findPlace(place) {
  return new Promise((resolve, reject) => {
    const geocoder = new google.maps.Geocoder();
	geocoder.geocode({
	  'address': place
	}, (res, stat) => {
	  if (stat != google.maps.GeocoderStatus.OK) {
		reject(new Error(stat));
		return;
	  }
	  resolve(res[0].geometry);
	});
  });
}

function markLocation(map, place) {
  if (markLocation.last) markLocation.last.setMap(null);
  map.setCenter(place.location);
  markLocation.last = new google.maps.Marker({
    position: place.location,
    map,
    title: place.formatted_address,
  });
}

function getBounds(foundPlace) {
  const bounds = new google.maps.LatLngBounds();
  if (foundPlace.viewport) bounds.union(foundPlace.viewport);
  bounds.extend(foundPlace.location);
  return bounds;
}

async function route(origin, destination) {
  if (!route.directionsService) route.directionsService = new google.maps.DirectionsService();
  return new Promise((resolve, reject) => route.directionsService.route({origin: origin.location, destination: destination.location, travelMode: 'DRIVING'}, (res, stat) => {
    if (stat != 'OK') {
	  reject(new Error(stat));
	  return;
    }
    resolve(res);
  }));
}

function renderRoute(map, route) {
  if (!renderRoute.directionsRenderer) {
    renderRoute.directionsRenderer = new google.maps.DirectionsRenderer();
	renderRoute.directionsRenderer.setMap(map);
  }
  map.fitBounds(route.routes[0].bounds);
  renderRoute.directionsRenderer.setDirections(route);
}

function getRouteSpecs(route) {
  const leg = route.routes[0].legs[0];
  return {distance: leg.distance, duration: leg.duration};
}

setTimeout(async () => {
  let updatedAt = document.createElement("span");
  updatedAt.innerText = new Date(JSON.parse(document.querySelector("[data-listing]")?.getAttribute("data-listing") || null)?.updatedAt)?.toLocaleString("hu-HU");
  document.querySelector(".card-title")?.parentElement?.appendChild(updatedAt);
  const address = document.getElementsByClassName("card-title")[0]?.textContent;
  await loadMap();
  const containerDiv = document.createElement("div");
  containerDiv.id = "ingatlan-terkep"
  containerDiv.style.height = "400px";
  containerDiv.style.width = "500px";
  containerDiv.style.position = "fixed";
  containerDiv.style.bottom = 0;
  containerDiv.style.right = 0;
  containerDiv.style.zIndex = 10;
  document.body.append(containerDiv);
  const statsPlaceholder = document.createElement("p");
  statsPlaceholder.style.all = "unset";
  statsPlaceholder.style.height = "40px";
  statsPlaceholder.style.fontSize = "x-large";
  statsPlaceholder.style.fontWeight = "bold";
  statsPlaceholder.style.backgroundColor = "aliceblue";
  statsPlaceholder.style.borderTopLeftRadius = "50px";
  statsPlaceholder.style.color = "blue";
  statsPlaceholder.style.textAlign = "center";
  statsPlaceholder.style.paddingTop = "10px";
  statsPlaceholder.style.display = "block";
  containerDiv.append(statsPlaceholder);
  const mapDiv = document.createElement("div");
  mapDiv.style.height = "350px";
  mapDiv.style.width = "500px";
  containerDiv.append(mapDiv);
  const map = new google.maps.Map(mapDiv, {
    center: { lat: -34.397, lng: 150.644 },
    zoom: 8,
  });
  let lastAddr;
  document.querySelectorAll(".listing__address")?.forEach(l => l.addEventListener("mouseenter", async a => {
    if (lastAddr == a.target.textContent) return;
      lastAddr = a.target.textContent;
    const addr = await findPlace(lastAddr);
    markLocation(map, addr);
    statsPlaceholder.textContent = lastAddr;
  }));
  if (!address) return;
  const pest = await findPlace("Práter street 1, Budapest");
  const dest = await findPlace(address);
  const foundRoute = await route(pest, dest);
  renderRoute(map, foundRoute);
  const routeSpecs = getRouteSpecs(foundRoute);
  statsPlaceholder.textContent = routeSpecs.duration.text + " (" + routeSpecs.distance.text + ")";
});
})();
