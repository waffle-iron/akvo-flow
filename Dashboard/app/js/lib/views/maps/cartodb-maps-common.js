FLOW.drawLeafletMap = function(mapObject){
  mapObject.options.maxZoom = 18;
  mapObject.options.minZoom = 2;

  var hereAttr = 'Map &copy; 1987-2014 <a href="http://developer.here.com">HERE</a>',
		hereUrl = 'https://{s}.{base}.maps.cit.api.here.com/maptile/2.1/maptile/{mapID}/{scheme}/{z}/{x}/{y}/256/{format}?app_id={app_id}&app_code={app_code}',
    mbAttr = 'Map &copy; <a href="http://openstreetmap.org">OSM</a>',
    mbUrl = 'http://{s}.tiles.mapbox.com/v3/akvo.he30g8mm/{z}/{x}/{y}.png';

  var normal = L.tileLayer(hereUrl, {
    scheme: 'normal.day.transit',
    format: 'png8',
    attribution: hereAttr,
    subdomains: '1234',
    mapID: 'newest',
    app_id: FLOW.Env.hereMapsAppId,
    app_code: FLOW.Env.hereMapsAppCode,
    base: 'base'
  }).addTo(mapObject),
  terrain  = L.tileLayer(mbUrl, {
    attribution: mbAttr,
    subdomains: 'abc'
  }),
  satellite  = L.tileLayer(hereUrl, {
    scheme: 'hybrid.day',
    format: 'jpg',
    attribution: hereAttr,
    subdomains: '1234',
    mapID: 'newest',
    app_id: FLOW.Env.hereMapsAppId,
    app_code: FLOW.Env.hereMapsAppCode,
    base: 'aerial'
  });

  var baseLayers = {
		"Normal": normal,
    "Terrain": terrain,
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

  setTimeout(function() {
    geoshapeMap.fitBounds(featureGroup.getBounds()); //fit featureGroup to map bounds
  }, 0);
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
FLOW.addCursorInteraction = function (layer) {
  var hovers = [];

  layer.bind('featureOver', function(e, latlon, pxPos, data, layer) {
    hovers[layer] = 1;
    if(_.any(hovers)) {
      $('.flowMap').css('cursor', 'pointer');
    }
  });

  layer.bind('featureOut', function(m, layer) {
    hovers[layer] = 0;
    if(!_.any(hovers)) {
      $('.flowMap').css({"cursor":"-moz-grab","cursor":"-webkit-grab"});
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
          "/rest/questions?surveyId="+pointData['formId'],
          function(questionsData, status){
            //create a questions array with the correct order of questions as in the survey
            var questionsDataArr = [];
            if(questionsData.questions){
              for(var q=0; q<questionsData.questions.length; q++){
                var currentQuestion = {};
                currentQuestion['type'] = questionsData.questions[q]['questionType'];
                currentQuestion['display_text'] = questionsData.questions[q]['text'];
                currentQuestion['id'] = questionsData.questions[q]['keyId'];
                currentQuestion['order'] = questionsData.questions[q]['order'];
                questionsDataArr.push(currentQuestion);
              }
              //sort questions by order
              questionsDataArr.sort(function(a, b) {
                return parseFloat(a.order) - parseFloat(b.order);
              });

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
                for(var i=0; i<questionsDataArr.length; i++){
                  if (column.match(questionsDataArr[i].id)) {
                    if(questionsDataArr[i].type === "GEOSHAPE" && questionAnswer !== null){
                      geoshapeObject = FLOW.parseGeoshape(questionAnswer);
                      if(geoshapeObject !== null){
                        clickedPointContent += '<h4><div style="float: left">'
                        +questionsDataArr[i].display_text
                        +'</div>&nbsp;<a style="float: right" class="projectGeoshape">'+Ember.String.loc('_project_geoshape_onto_main_map') +'</a></h4>';
                      }
                    } else {
                      clickedPointContent += '<h4>'+questionsDataArr[i].display_text+'&nbsp;</h4>';
                    }

                    clickedPointContent += '<div style="float: left; width: 100%">';

                    if(questionAnswer !== "" && questionAnswer !== null && questionAnswer !== "null"){
                      switch (questionsDataArr[i].type) {
                        case "PHOTO":
                          var imageString = "", imageJson;
                          if (questionAnswer.charAt(0) === '{') {
                            imageJson = JSON.parse(questionAnswer);
                            imageString = imageJson.image
                          } else {
                            imageString = questionAnswer;
                          }

                          var image = '<div class=":imgContainer photoUrl:shown:hidden">';
                          var imageFilename = FLOW.Env.photo_url_root+imageString.substring(imageString.lastIndexOf("/")+1);
                          image += '<a href="'+imageFilename+'" target="_blank">'
                          +'<img src="'+imageFilename+'" alt=""/></a>';

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
                              return (questionsDataArr[i].type == "CASCADE") ? item.name : item.text;
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

  setTimeout(function() {
    mapObject.fitBounds(featureGroup.getBounds()); //fit featureGroup to map bounds
  }, 0);
}

FLOW.initAjaxSetup = function(){
  $.ajaxSetup({
    beforeSend: function(){
      FLOW.savingMessageControl.numLoadingChange(1);
      },
    complete: function(){
      FLOW.savingMessageControl.numLoadingChange(-1);
      }
  });
};

FLOW.clearCartodbLayer = function(mapObject, layer){
  //check to confirm that there are no layers displayed on the map
  if(layer != null){
    mapObject.removeLayer(layer);
    return false;
  }
  return true;
};

/*this function overlays a named map on the cartodb map*/
FLOW.createLayer = function(mapObject, mapName){
  var pointDataUrl, returnObject = {};

  //first clear any currently overlayed cartodb layer
  FLOW.clearCartodbLayer(mapObject, FLOW.selectedControl.get('cartodbLayer'));

  // add cartodb layer with one sublayer
  cartodb.createLayer(mapObject, {
    user_name: FLOW.Env.appId,
    type: 'namedmap',
    named_map: {
      name: mapName,
      layers: [{
        layer_name: "t",
        interactivity: "id"
      }]
    }
  },{
    tiler_domain: FLOW.Env.cartodbHost,
    tiler_port: "", //set to empty string to stop cartodb js from appending default port
    tiler_protocol: "https",
    no_cdn: true
  })
  .addTo(mapObject)
  .done(function(layer) {
    layer.setZIndex(1000); //required to ensure that the cartodb layer is not obscured by the here maps base layers
    FLOW.selectedControl.set('cartodbLayer', layer);

    FLOW.addCursorInteraction(layer);

    var current_layer = layer.getSubLayer(0);
    current_layer.setInteraction(true);

    current_layer.on('featureClick', function(e, latlng, pos, data) {
      var dataPointObject = {};
      dataPointObject['pointDetailsPane'] = 'pointDetails';
      if(FLOW.selectedControl.get('marker') != null){
        mapObject.removeLayer(FLOW.selectedControl.get('marker'));
        FLOW.selectedControl.set('marker', null);
      }
      FLOW.placeMarker(mapObject, [data.lat, data.lon]);

      FLOW.showDetailsPane();
      if(typeof data.survey_id !== "undefined"){
        pointDataUrl = '/rest/cartodb/answers?dataPointId='+data.id+'&surveyId='+data.survey_id;
        dataPointObject['url'] = pointDataUrl;
        dataPointObject['dataPointName'] = data.name;
        dataPointObject['dataPointIdentifier'] = data.identifier;
        FLOW.getCartodbPointData(dataPointObject);
      }else{
        pointDataUrl = '/rest/cartodb/raw_data?dataPointId='+data.data_point_id+'&formId='+FLOW.selectedControl.get('selectedCustomMapFormId');
        $.get('/rest/cartodb/data_point?id='+data.data_point_id, function(pointData, status){
          dataPointObject['url'] = pointDataUrl;
          dataPointObject['dataPointName'] = pointData['row']['name'];
          dataPointObject['dataPointIdentifier'] = pointData['row']['identifier'];
          FLOW.getCartodbPointData(dataPointObject);
        });
      }
    });
    return true;
  });
};

FLOW.placeMarker = function(mapObject, latlng){
  var markerIcon = new L.Icon({
    iconUrl: 'images/marker.svg',
    iconSize: [10, 10]
  });
  FLOW.selectedControl.set('marker', new L.marker(latlng, {icon: markerIcon}));
  mapObject.addLayer(FLOW.selectedControl.get('marker'));
};

/*Check if a named map exists. If one exists, call function to overlay it
else call function to create a new one*/
FLOW.namedMapCheck = function(namedMapObject){
  $.get('/rest/cartodb/named_maps', function(data, status) {
    if (data.template_ids) {
      var mapExists = false;
      for (var i=0; i<data['template_ids'].length; i++) {
        if(data['template_ids'][i] === namedMapObject.mapName) {
          //named map already exists
          mapExists = true;
          break;
        }
      }

      if (mapExists) {
        //overlay named map
        FLOW.selectedControl.set('layerExistsCheck', FLOW.createLayer(namedMapObject.mapObject, namedMapObject.mapName));
      }else{
        //create new named map
        FLOW.namedMaps(
          namedMapObject.mapObject,
          namedMapObject.mapName,
          namedMapObject.tableName,
          namedMapObject.query,
          namedMapObject.interactivity);
      }
    }
  });
};

//create named maps
FLOW.namedMaps = function(map, mapName, table, sql, interactivity){
  //style of points for new layer
  var cartocss = "#"+table+"{"
    +"marker-fill-opacity: 0.9;"
    +"marker-line-color: #FFF;"
    +"marker-line-width: 1.5;"
    +"marker-line-opacity: 1;"
    +"marker-placement: point;"
    +"marker-type: ellipse;"
    +"marker-width: 10;"
    +"marker-fill: #FF6600;"
    +"marker-allow-overlap: true;"
    +"}";

  var configJsonData = {};
  configJsonData['requestType'] = "POST";
  configJsonData['interactivity'] = interactivity;
  configJsonData['name'] = mapName;
  configJsonData['cartocss'] = cartocss;
  configJsonData['query'] = sql;

  $.ajax({
    type: 'POST',
    contentType: "application/json",
    url: '/rest/cartodb/named_maps',
    data: JSON.stringify(configJsonData), //turns out you need to stringify the payload before sending it
    dataType: 'json',
    success: function(namedMapData){
      if(namedMapData.template_id){
        FLOW.selectedControl.set('layerExistsCheck', FLOW.createLayer(map, mapName));
      }
    }
  });
};

FLOW.manageHierarchy = function(parentFolderId){
  var rows = FLOW.selectedControl.get('cartodbMapsSurveyGroups')['survey_groups'];

  rows.sort(function(el1, el2) {
    return FLOW.compare(el1, el2, 'name');
  });

  //create folder and/or survey select element
  var folderSurveySelector = $('<select></select>').attr({
    id: "selector_"+parentFolderId,
    class: "folder_survey_selector"});
  folderSurveySelector.append('<option value="">--' + Ember.String.loc('_choose_folder_or_survey') + '--</option>');

  for (var i=0; i<rows.length; i++) {
    //append return survey list to the survey selector element
    var surveyGroup = rows[i];

    //if a subfolder, only load folders and surveys from parent folder
    if(surveyGroup.parentId == parentFolderId){
      folderSurveySelector.append('<option value="'
        + surveyGroup.keyId + '"'
        +'data-type="'+surveyGroup.projectType+'">'
        + surveyGroup.name
        + '</option>');
    }
  }

  $("#survey_hierarchy").append(folderSurveySelector);
};

FLOW.createNamedMapObject = function(mapObject, queryObject, cartocss){
  /* Build a (temporary) named map based on currently selected survey/form */
  var namedMapObject = {};
  namedMapObject['name'] = FLOW.selectedControl.get('customMapName');
  namedMapObject['interactivity'] = [];
  namedMapObject['query'] = FLOW.buildQuery(queryObject.table, queryObject.column, queryObject.value);
  namedMapObject['requestType'] = (FLOW.selectedControl.get('newMap')) ? "POST" : "PUT";

  //if cartocss is not defined, create map using default style
  namedMapObject['cartocss'] = "#"+queryObject.table+"{"
    +"marker-fill-opacity: 0.9;"
    +"marker-line-color: #FFF;"
    +"marker-line-width: 1.5;"
    +"marker-line-opacity: 1;"
    +"marker-placement: point;"
    +"marker-type: ellipse;"
    +"marker-width: 10;"
    +"marker-fill: #FF6600;"
    +"marker-allow-overlap: true;"
    +"}";

  //if cartocss is defined, create map using specified style
  if(cartocss !== ""){
    namedMapObject['cartocss'] += cartocss;
  }

  //get list of columns to be added to new named map's interactivity
  $.get('/rest/cartodb/columns?table_name='+queryObject.table, function(columnsData) {
    if (columnsData.column_names) {
      for (var j=0; j<columnsData['column_names'].length; j++) {
        namedMapObject['interactivity'].push(columnsData['column_names'][j]['column_name']);
      }
    }
    FLOW.customNamedMaps(mapObject, namedMapObject);
  });

  //get points count
  $.get(
    '/rest/cartodb/points_count?table='+queryObject.table+'&column='+queryObject.column+'&value='+queryObject.value,
    function(response, status) {
      $('#show-points-number').data('count', response.count[0].count);
  });
};

//create named maps
FLOW.customNamedMaps = function(mapObject, namedMapObject){
  var configJsonData = {};

  var ajaxObject = {};
  ajaxObject['call'] = "POST";
  ajaxObject['url'] = "/rest/cartodb/named_maps";
  ajaxObject['data'] = JSON.stringify(namedMapObject);

  FLOW.ajaxCall(function(response){
    if(response.template_id){
      FLOW.selectedControl.set('customMapName', response.template_id);
      FLOW.createCustomMapLayer(mapObject, response.template_id);
    }
  }, ajaxObject);
};

/*this function overlays a named map on the cartodb map*/
FLOW.createCustomMapLayer = function(mapObject, mapName){
  //first clear any currently overlayed cartodb layer
  FLOW.selectedControl.set('layerExistsCheck', FLOW.clearCartodbLayer(mapObject, FLOW.selectedControl.get('cartodbLayer')));

  // add cartodb layer with one sublayer
  cartodb.createLayer(mapObject, {
    user_name: FLOW.Env.appId,
    type: 'namedmap',
    named_map: {
      name: mapName,
      layers: [{
        layer_name: "t",
        interactivity: "id"
      }]
    }
  },{
    tiler_domain: FLOW.Env.cartodbHost,
    tiler_port: "", //set to empty string to stop cartodb js from appending default port
    tiler_protocol: "https",
    no_cdn: true
  })
  .addTo(mapObject)
  .done(function(layer) {
    layer.setZIndex(1000); //required to ensure that the cartodb layer is not obscured by the here maps base layers
    FLOW.selectedControl.set('layerExistsCheck', true);
    FLOW.selectedControl.set('cartodbLayer', layer);

    FLOW.addCursorInteraction(layer);

    var currentLayer = layer.getSubLayer(0);
    currentLayer.setInteraction(true);

    var tooltip = layer.leafletMap.viz.addOverlay({
      type: 'tooltip',
      layer: currentLayer,
      template: '<div class="cartodb-tooltip-content-wrapper"><p>{{name}}</p></div>',
      width: 200,
      position: 'top|right',
      fields: [{ name: 'cartodb_id' }]
    });
    $('#flowMap').append(tooltip.render().el);
  });
};

FLOW.buildQuery = function(table, column, value){
  var query = "SELECT * FROM "+table;
  if(column !== ""){
    query += " WHERE "+column+" = '"+value+"'";
  }
  return query;
};

/**
  Helper function to dispatch to either hide or show details pane
*/
FLOW.handleShowHideDetails = function () {
  if (FLOW.selectedControl.get('detailsPaneVisible')) {
    FLOW.hideDetailsPane();
  } else {
    FLOW.showDetailsPane();
  }
};

/**
  Slide in the details pane
*/
FLOW.showDetailsPane = function () {
  var button;

  button = $('#mapDetailsHideShow');
  button.html('Hide &rsaquo;');
  FLOW.selectedControl.set('detailsPaneVisible', true);

  $('#flowMap').animate({
    width: '75%'
  }, 200);
  $('#pointDetails').animate({
    width: '24.5%'
  }, 200).css({
    overflow: 'auto',
    marginLeft: '-2px'
  });
  $(FLOW.selectedControl.get('detailsPaneElements'), '#pointDetails').animate({
    opacity: '1'
  }, 200).css({
    display: 'inherit'
  });
};

/**
  Slide out details pane
*/
FLOW.hideDetailsPane = function (delay) {
  var button;

  delay = typeof delay !== 'undefined' ? delay : 0;
  button = $('#mapDetailsHideShow');

  FLOW.selectedControl.set('detailsPaneVisible', false);
  button.html('&lsaquo; Show');

  $('#flowMap').delay(delay).animate({
    width: '99.25%'
  }, 200);
  $('#pointDetails').delay(delay).animate({
    width: '0.25%'
  }, 200).css({
    overflow: 'scroll-y',
    marginLeft: '-2px'
  });
  $(FLOW.selectedControl.get('detailsPaneElements'), '#pointDetails').delay(delay).animate({
    opacity: '0',
    display: 'none'
  });
};

FLOW.addSlashes = function ( str ) {
  return (str + '').replace(/[\\"']/g, '\\$&').replace(/\u0000/g, '\\0');
};

FLOW.namedMapPresetStyle = function (customMapDetailsObject){
  var presetMapStyle = {};
  presetMapStyle['cartocss'] = '';
  presetMapStyle['queryObject'] = {};
  if(customMapDetailsObject['cartocss'] != ""){
    var cartocssData = JSON.parse(customMapDetailsObject['cartocss']);
    presetMapStyle['queryObject']['table'] = 'raw_data_'+customMapDetailsObject['form_id'];
    presetMapStyle['queryObject']['column'] = '';
    presetMapStyle['queryObject']['value'] = '';
    for(var n=0; n<cartocssData.length; n++){
      presetMapStyle['cartocss'] += '#raw_data_'+customMapDetailsObject['form_id']+'['+cartocssData[n]['column']+'="'+FLOW.addSlashes(JSON.stringify(cartocssData[n]['title']))+'"]';
      presetMapStyle['cartocss'] += '{';
      presetMapStyle['cartocss'] += 'marker-fill: '+cartocssData[n]['title']['colour']+';';
      presetMapStyle['cartocss'] += '}';
    }
  }else{
    presetMapStyle['queryObject']['table'] = 'data_point';
    presetMapStyle['queryObject']['column'] = (customMapDetailsObject['survey_id'] != 0) ? 'survey_id' : '';
    presetMapStyle['queryObject']['value'] = (customMapDetailsObject['survey_id'] != 0) ? customMapDetailsObject['survey_id'] : '';
  }
  return presetMapStyle;
};
