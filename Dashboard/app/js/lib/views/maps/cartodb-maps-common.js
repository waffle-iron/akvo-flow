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
  //containerNode.style.height = "150px";
  var geoshapeMap = L.map(containerNode, {scrollWheelZoom: false}).setView([0, 0], 2);

  FLOW.drawLeafletMap(geoshapeMap);

  var featureGroup = new L.featureGroup; //create a leaflet featureGroup to hold all object features
  for(var i=0; i<geoShapeObject.length; i++){
    var geoshapeCoordinatesArray, geoShapeObjectType = geoShapeObject[i]["geometry"]["type"];
    var points = [], geoShape;
    if(geoShapeObjectType === 'Polygon'){
      geoshapeCoordinatesArray = geoShapeObject[i]["geometry"]['coordinates'][0];
    } else {
      geoshapeCoordinatesArray = geoShapeObject[i]["geometry"]['coordinates'];
    }

    for(var j=0; j<geoshapeCoordinatesArray.length; j++){
      points.push([geoshapeCoordinatesArray[j][1], geoshapeCoordinatesArray[j][0]]);
    }

    //Draw geoshape based on its type
    if(geoShapeObjectType === 'Polygon'){
      geoShape = L.polygon(points).addTo(geoshapeMap);
    }else if (geoShapeObjectType === 'MultiPoint') {
      var geoShapeMarkersArray = [];
      for (var k = 0; k < points.length; k++) {
        geoShapeMarkersArray.push(L.marker([points[k][0],points[k][1]]));
      }
      geoShape = L.featureGroup(geoShapeMarkersArray).addTo(geoshapeMap);
    }else if (geoShapeObjectType === 'LineString') {
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

FLOW.getCartodbPointData = function(dataPointObject){
  var returnObject={};
  $('#'+dataPointObject.pointDetailsPane).html("");
  $.get(dataPointObject.url, function(pointData, status){
    var clickedPointContent = "";

    if (pointData['answers'] != null) {
      //get request for questions
      $.get(
          "/rest/cartodb/questions?form_id="+pointData['formId'],
          function(questionsData, status){
            var geoshapeObject, geoshapeCheck = false;
            FLOW.selectedControl.set('geoshapeCoordinates', null);

            var dataCollectionDate = pointData['answers']['created_at'];
            var date = new Date(dataCollectionDate);

            clickedPointContent += '<ul class="placeMarkBasicInfo floats-in">'
            +'<h3>'
            +((dataPointObject.dataPointName != "" && dataPointObject.dataPointName != "null" && dataPointObject.dataPointName != null) ? dataPointObject.dataPointName : "")
            +'</h3>'
            +'<li>'
            +'<span>'+Ember.String.loc('_data_point_id') +':</span>'
            +'<div style="display: inline; margin: 0 0 0 5px;">'+dataPointObject.dataPointIdentifier+'</div>'
            +'</li>'
            +'<li>'
            +'<span>'+Ember.String.loc('_collected_on') +':</span>'
            +'<div class="placeMarkCollectionDate">'
            +date.toUTCString()
            +'</div></li><li></li></ul>';

            clickedPointContent += '<div class="mapInfoDetail" style="opacity: 1; display: inherit;">';
            for (column in pointData['answers']){
              var questionAnswer = pointData['answers'][column];
              for(var i=0; i<questionsData['questions'].length; i++){
                if (column.match(questionsData['questions'][i].id)) {
                  if(questionsData['questions'][i].type === "GEOSHAPE" && questionAnswer !== null){
                    var geoshapeObject = FLOW.parseGeoshape(questionAnswer);
                    if(geoshapeObject !== null){
                      clickedPointContent += '<h4><div style="float: left">'
                      +questionsData['questions'][i].display_text
                      +'</div>&nbsp;<a style="float: right" class="projectGeoshape">'+Ember.String.loc('_project_geoshape_onto_main_map') +'</a></h4>';
                    }
                  } else {
                    clickedPointContent += '<h4>'+questionsData['questions'][i].display_text+'&nbsp;</h4>';
                  }

                  clickedPointContent += '<div style="float: left; width: 100%">';

                  if(questionAnswer !== "" && questionAnswer !== null && questionAnswer !== "null"){
                    switch (questionsData['questions'][i].type) {
                      case "PHOTO":
                        var image = '<div class=":imgContainer photoUrl:shown:hidden">';
                        var image_filename = FLOW.Env.photo_url_root+questionAnswer.substring(questionAnswer.lastIndexOf("/")+1);
                        image += '<a href="'+image_filename+'" target="_blank">'
                        +'<img src="'+image_filename+'" alt=""/></a>';

                        image += '</div>';
                        clickedPointContent += image;
                        break;
                      case "GEOSHAPE":
                        geoshapeObject = FLOW.parseGeoshape(questionAnswer);
                        FLOW.selectedControl.set('geoshapeCoordinates', geoshapeObject);

                        if(geoshapeObject !== null){
                          geoshapeCheck = true;
                          //create a container for each feature in geoshape object
                          clickedPointContent += '<div id="geoShapeMap" style="width:99%; height: 150px; float: left"></div>';
                          for(var j=0; j<geoshapeObject['features'].length; j++){
                            clickedPointContent += '<label style="font-weight: bold; color: black">'+geoshapeObject['features'][j]['geometry']['type']+'</label>';
                            if(geoshapeObject['features'][j]['geometry']['type'] === 'Polygon'
                             || geoshapeObject['features'][j]['geometry']['type'] === 'LineString'
                              || geoshapeObject['features'][j]['geometry']['type'] === 'MultiPoint'){
                              clickedPointContent += '<div style="float: left; width: 100%">'+ Ember.String.loc('_points') +': '+geoshapeObject['features'][j]['properties']['pointCount']+'</div>';
                            }

                            if(geoshapeObject['features'][j]['geometry']['type'] === 'Polygon'
                             || geoshapeObject['features'][j]['geometry']['type'] === 'LineString'){
                              clickedPointContent += '<div style="float: left; width: 100%">'+ Ember.String.loc('_length') +': '+geoshapeObject['features'][j]['properties']['length']+'m</div>';
                            }

                            if(geoshapeObject['features'][j]['geometry']['type'] === 'Polygon'){
                              clickedPointContent += '<div style="float: left; width: 100%">'+ Ember.String.loc('_area') +': '+geoshapeObject['features'][j]['properties']['area']+'m&sup2;</div>';
                            }
                            clickedPointContent += '<br>';
                          }
                        }
                        break;
                      case "DATE":
                        var dateQuestion = new Date((isNaN(questionAnswer) === false) ? parseInt(questionAnswer) : questionAnswer);
                        clickedPointContent += dateQuestion.toUTCString().slice(0, -13); //remove last 13 x-ters so only date displays
                        break;
                      case "SIGNATURE":
                        clickedPointContent += '<img src="';
                        var srcAttr = 'data:image/png;base64,', signatureJson;
                        signatureJson = JSON.parse(questionAnswer);
                        clickedPointContent += srcAttr + signatureJson.image +'"/>';
                        clickedPointContent += Ember.String.loc('_signed_by') +': '+signatureJson.name;
                        break;
                      case "CASCADE":
                      case "OPTION":
                        var cascadeString = "", cascadeJson;
                        if (questionAnswer.charAt(0) === '[') {
                          cascadeJson = JSON.parse(questionAnswer);
                          cascadeString = cascadeJson.map(function(item){
                            return (questionsData['questions'][i].type == "CASCADE") ? item.name : item.text;
                          }).join("|");
                        } else {
                          cascadeString = questionAnswer;
                        }
                        clickedPointContent += cascadeString;
                        break;
                      default:
                        clickedPointContent += questionAnswer;
                    }
                  }
                  clickedPointContent += '&nbsp;</div><hr>';
                }
              }
            }
            clickedPointContent += '</div>';
            $('#'+dataPointObject.pointDetailsPane).html(clickedPointContent);
            $('hr').show();

            //if there's geoshape, draw it
            if(geoshapeCheck){
              //pass container node, object type, and object coordinates to drawGeoShape function
              FLOW.drawGeoShape('geoShapeMap', geoshapeObject['features']);
            }
          });
    } else {
      clickedPointContent += '<p class="noDetails">'+Ember.String.loc('_no_details') +'</p>';
      $('#'+dataPointObject.pointDetailsPane).html(clickedPointContent);
    }
  });
};

FLOW.projectGeoshape = function(mapObject, geoShapeObject){
  //before fitting the geoshape to map, get the current
  //zoom level and map center first and save them
  FLOW.selectedControl.set('mapZoomLevel', mapObject.getZoom());
  FLOW.selectedControl.set('mapCenter', mapObject.getCenter());

  //create a leaflet featureGroup to hold all object features
  var featureGroup = new L.featureGroup, polygons = [];
  for(var i=0; i<geoShapeObject['features'].length; i++){
    var points = [], geoShape;
    var geoshapeCoordinatesArray, geoShapeObjectType = geoShapeObject['features'][i]['geometry']['type'];
    if(geoShapeObjectType === "Polygon"){
      geoshapeCoordinatesArray = geoShapeObject['features'][i]['geometry']['coordinates'][0];
    } else {
      geoshapeCoordinatesArray = geoShapeObject['features'][i]['geometry']['coordinates'];
    }

    for(var j=0; j<geoshapeCoordinatesArray.length; j++){
      points.push([geoshapeCoordinatesArray[j][1], geoshapeCoordinatesArray[j][0]]);
    }

    //add object to featureGroup
    if(geoShapeObjectType === "Polygon"){
      geoShape = L.polygon(points).addTo(mapObject);
    }else if (geoShapeObjectType === "MultiPoint") {
      var geoShapeMarkersArray = [];
      for (var k = 0; k < points.length; k++) {
        geoShapeMarkersArray.push(L.marker([points[k][0],points[k][1]]));
      }
      geoShape = L.featureGroup(geoShapeMarkersArray).addTo(mapObject);
    }else if (geoShapeObjectType === "LineString") {
      geoShape = L.polyline(points).addTo(mapObject);
    }
    featureGroup.addLayer(geoShape);
    polygons.push(geoShape);
  }
  FLOW.selectedControl.set('polygons', polygons);
  mapObject.fitBounds(featureGroup.getBounds()); //fit featureGroup to map bounds
}
