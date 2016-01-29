FLOW.drawLeafletMap = function(mapObject){
  var bounds = new L.LatLngBounds(mapObject.getBounds().getSouthWest(), mapObject.getBounds().getNorthEast());

  mapObject.options.maxBoundsViscosity = 1.0;
  mapObject.options.maxBounds = bounds;
  mapObject.options.maxZoom = 18;
  mapObject.options.minZoom = 2;

  var mbAttr = 'Map &copy; 1987-2014 <a href="http://developer.here.com">HERE</a>',
    mbUrl = 'https://{s}.{base}.maps.cit.api.here.com/maptile/2.1/maptile/{mapID}/{scheme}/{z}/{x}/{y}/256/{format}?app_id={app_id}&app_code={app_code}';

  var normal = L.tileLayer(mbUrl, {
    scheme: 'normal.day.transit',
    format: 'png8',
    attribution: mbAttr,
    subdomains: '1234',
    mapID: 'newest',
    app_id: FLOW.Env.hereMapsAppId,
    app_code: FLOW.Env.hereMapsAppCode,
    base: 'base'
  }).addTo(mapObject),
  satellite  = L.tileLayer(mbUrl, {
    scheme: 'hybrid.day',
    format: 'jpg',
    attribution: mbAttr,
    subdomains: '1234',
    mapID: 'newest',
    app_id: FLOW.Env.hereMapsAppId,
    app_code: FLOW.Env.hereMapsAppCode,
    base: 'aerial'
  });

  var baseLayers = {
    "Normal": normal,
    "Satellite": satellite
  };

  L.control.layers(baseLayers).addTo(mapObject);
};

FLOW.parseGeoshape = function(geoshapeString) {
  try {
    var geoshapeObject = JSON.parse(geoshapeString);
    if (geoshapeObject['features'].length > 0) {
        return geoshapeObject;
    } else {
      return null;
    }
  } catch (e) {
    return null;
  }
};

FLOW.drawGeoShape = function(containerNode, geoShapeObject){
  containerNode.style.height = "150px";
  var geoshapeMap = L.map(containerNode, {scrollWheelZoom: false}).setView([0, 0], 2);

  FLOW.drawLeafletMap(geoshapeMap);

  var featureGroup = new L.featureGroup; //create a leaflet featureGroup to hold all object features
  for(var i=0; i<geoShapeObject.length; i++){
    var geoshapeCoordinatesArray, geoShapeObjectType = geoShapeObject[i]["geometry"]["type"];
    var points = [], geoShape;
    if(geoShapeObjectType === "Polygon"){
      geoshapeCoordinatesArray = geoShapeObject[i]["geometry"]['coordinates'][0];
    } else {
      geoshapeCoordinatesArray = geoShapeObject[i]["geometry"]['coordinates'];
    }

    for(var j=0; j<geoshapeCoordinatesArray.length; j++){
      points.push([geoshapeCoordinatesArray[j][1], geoshapeCoordinatesArray[j][0]]);
    }

    //Draw geoshape based on its type
    if(geoShapeObjectType === "Polygon"){
      geoShape = L.polygon(points).addTo(geoshapeMap);
    }else if (geoShapeObjectType === "MultiPoint") {
      var geoShapeMarkersArray = [];
      for (var k = 0; k < points.length; k++) {
        geoShapeMarkersArray.push(L.marker([points[k][0],points[k][1]]));
      }
      geoShape = L.featureGroup(geoShapeMarkersArray).addTo(geoshapeMap);
    }else if (geoShapeObjectType === "LineString") {
      geoShape = L.polyline(points).addTo(geoshapeMap);
    }
    featureGroup.addLayer(geoShape);
  }
  geoshapeMap.fitBounds(featureGroup.getBounds()); //fit featureGroup to map bounds
};

FLOW.getCentroid = function (arr) {
  return arr.reduce(function (x,y) {
    return [x[0] + y[0]/arr.length, x[1] + y[1]/arr.length]
  }, [0,0])
};

FLOW.compare = function (el1, el2, index) {
  return el1[index] == el2[index] ? 0 : (el1[index] < el2[index] ? -1 : 1);
};

FLOW.cleanSurveyGroupHierarchy = function(element){
  $(element).nextAll().remove();
};

FLOW.ajaxCall = function(callback, ajaxObject){
  $.ajax({
    type: ajaxObject.call,
    contentType: "application/json",
    url: ajaxObject.url,
    data: ajaxObject.data, //turns out you need to stringify the payload before sending it
    dataType: 'json',
    success: function(responseData){
      callback(responseData);
    }
  });
};

/*function is required to manage how the cursor appears on the cartodb map canvas*/
FLOW.addCursorInteraction = function (layer, mapCanvasId) {
  var hovers = [];

  layer.bind('featureOver', function(e, latlon, pxPos, data, layer) {
    hovers[layer] = 1;
    if(_.any(hovers)) {
      $('#'+mapCanvasId).css('cursor', 'pointer');
    }
  });

  layer.bind('featureOut', function(m, layer) {
    hovers[layer] = 0;
    if(!_.any(hovers)) {
      $('#'+mapCanvasId).css({"cursor":"-moz-grab","cursor":"-webkit-grab"});
    }
  });
};
