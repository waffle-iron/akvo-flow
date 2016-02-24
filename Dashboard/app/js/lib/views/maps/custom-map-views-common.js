FLOW.DataMapView = FLOW.View.extend({
  templateName: 'navMaps/data-map',
  showDetailsBool: false,
  detailsPaneElements: null,
  detailsPaneVisible: null,
  map: null,
  marker: null,
  geoShape: null,
  geoshapeCoordinates: null,
  polygons: [],
  mapZoomLevel: 0,
  mapCenter: null,
  hierarchyObject: [],
  lastSelectedElement: 0,
  cartodbLayer: null,
  layerExistsCheck: false,
  refreshIntervalId: null,

  init: function () {
    this._super();
    this.detailsPaneElements = "#pointDetails h2" +
      ", #pointDetails dl" +
      ", #pointDetails img" +
      ", #pointDetails .imgContainer" +
      ", .placeMarkBasicInfo" +
      ", .noDetails";
    this.detailsPaneVisible = false;
  },

  /**
    Once the view is in the DOM create the map
  */
  didInsertElement: function () {
    var self = this;

    FLOW.initAjaxSetup();

    //onetime get survey groups
    $.get('/rest/survey_groups'/*place survey_groups endpoint here*/
    , function(surveyGroupsData, status){
      FLOW.selectedControl.set('cartodbMapsSurveyGroups', surveyGroupsData);
      self.hierarchyObject = FLOW.selectedControl.get('cartodbMapsSurveyGroups')['survey_groups'];

      self.insertCartodbMap();

      // add scale indication to map
      L.control.scale({position:'topleft', maxWidth:150}).addTo(self.map);
    });

    this.$('#mapDetailsHideShow').click(function () {
      self.handleShowHideDetails();
    });

    // Slide in detailspane after 1 sec
    self.hideDetailsPane(1000);
  },

  insertCartodbMap: function() {
    var self = this;

    FLOW.initAjaxSetup();

    var filterContent = '<div id="survey_hierarchy" style="float: left"></div>&nbsp;';

    $('#dropdown-holder').prepend(filterContent);
    $('#dropdown-holder').append('<div style="clear: both"></div>');

    // create and draw leaflet map
    var map = L.map('flowMap', {scrollWheelZoom: true}).setView([26.11598592533351, 1.9335937499999998], 2);
    FLOW.drawLeafletMap(map);

    this.map = map;

    map.on('click', function(e) {
      if(self.marker != null){
        self.map.removeLayer(self.marker);
        self.hideDetailsPane();
        $('#pointDetails').html('<p class="noDetails">'+Ember.String.loc('_no_details') +'</p>');
      }

      if(self.polygons.length > 0){
        for(var i=0; i<self.polygons.length; i++){
          self.map.removeLayer(self.polygons[i]);
        }
        //restore the previous zoom level and map center
        self.map.setZoom(self.mapZoomLevel);
        self.map.panTo(self.mapCenter);
        self.polygons = [];
      }
    });

    map.on('zoomend', function() {
      $('body, html, #flowMap').scrollTop(0);
    });

    //manage folder and/or survey selection hierarchy
    self.manageHierarchy(0);

    $(document).off('change', '.folder_survey_selector').on('change', '.folder_survey_selector',function(e) {

      $('#form_selector option[value!=""]').remove();

      //remove all 'folder_survey_selector's after current
      FLOW.cleanSurveyGroupHierarchy($(this));

      //first remove previously created form selector elements
      $(".form_selector").remove();

      if($(this).val() !== ""){
        var keyId = $(this).val();
        //if a survey is selected, load forms to form selector element.
        if($(this).find("option:selected").data('type') === 'PROJECT'){
          $.get('/rest/cartodb/forms?surveyId='+keyId, function(data, status) {
            var rows = [];
            if(data['forms'] && data['forms'].length > 0) {
              rows = data['forms'];
              rows.sort(function(el1, el2) {
                return FLOW.compare(el1, el2, 'name')
              });

              var hierarchyObject = self.hierarchyObject;

              //create folder and/or survey select element
              var form_selector = $("<select></select>").attr("data-survey-id", keyId).attr("class", "form_selector");
              form_selector.append('<option value="">--' + Ember.String.loc('_choose_a_form') + '--</option>');

              for(var i=0; i<rows.length; i++) {
                //append returned forms list to the firm selector element
                form_selector.append(
                  $('<option></option>').val(rows[i]["id"]).html(rows[i]["name"]));
              }
              $("#survey_hierarchy").append(form_selector);
            }
          });

          var namedMapObject = {};
          namedMapObject['mapObject'] = map;
          namedMapObject['mapName'] = 'data_point_'+keyId;
          namedMapObject['tableName'] = 'data_point';
          namedMapObject['interactivity'] = ["name", "survey_id", "id", "identifier", "lat", "lon"];
          namedMapObject['query'] = 'SELECT * FROM data_point WHERE survey_id='+keyId;

          self.namedMapCheck(namedMapObject);
        }else{ //if a folder is selected, load the folder's children on a new 'folder_survey_selector'
          //first clear any currently overlayed cartodb layer (if any)
          self.clearCartodbLayer();

          var hierarchyObject = self.hierarchyObject;

          for(var i=0; i<hierarchyObject.length; i++){
            if(hierarchyObject[i].keyId === parseInt(keyId) && self.lastSelectedElement !== parseInt(keyId)){
              self.manageHierarchy(keyId);
              self.lastSelectedElement = parseInt(keyId);
            }
          }
        }
      }else{ //if nothing is selected, delete all children 'folder_survey_selector's and clear form selector
        self.clearCartodbLayer();
      }

    });

    $(document).off('change', '.form_selector').on('change', '.form_selector',function(e) {
      //remove all 'folder_survey_selector's after current
      FLOW.cleanSurveyGroupHierarchy($(this));

      if ($(this).val() !== "") {
        var formId = $(this).val();
        //get list of columns to be added to new named map's interactivity
        $.get('/rest/cartodb/columns?table_name=raw_data_'+formId, function(columnsData) {
          var namedMapObject = {};
          namedMapObject['mapObject'] = map;
          namedMapObject['mapName'] = 'raw_data_'+formId;
          namedMapObject['tableName'] = 'raw_data_'+formId;
          namedMapObject['interactivity'] = [];
          namedMapObject['query'] = 'SELECT * FROM raw_data_' + formId;

          if (columnsData.column_names) {
            for (var j=0; j<columnsData['column_names'].length; j++) {
              namedMapObject['interactivity'].push(columnsData['column_names'][j]['column_name']);
            }
          }

          self.namedMapCheck(namedMapObject);
        });
      } else {
        self.createLayer(map, 'data_point_'+$(this).data('survey-id'), "");
      }
    });

    $(document.body).on('click', '.projectGeoshape', function(){
      if(self.polygons.length > 0){
        $(this).html(Ember.String.loc('_project_geoshape_onto_main_map'));
        for(var i=0; i<self.polygons.length; i++){
          self.map.removeLayer(self.polygons[i]);
        }
        //restore the previous zoom level and map center
        self.map.setZoom(self.mapZoomLevel);
        self.map.panTo(self.mapCenter);
        self.polygons = [];
      }else{
        $(this).html(Ember.String.loc('_clear_geoshape_from_main_map'));
        self.projectGeoshape(self.geoshapeCoordinates);
      }
    });
  },

  /*Check if a named map exists. If one exists, call function to overlay it
  else call function to create a new one*/
  namedMapCheck: function(namedMapObject){
    var self = this;
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
          self.createLayer(namedMapObject.mapObject, namedMapObject.mapName, "");
        }else{
          //create new named map
          self.namedMaps(
            namedMapObject.mapObject,
            namedMapObject.mapName,
            namedMapObject.tableName,
            namedMapObject.query,
            namedMapObject.interactivity);
        }
      }
    });
  },

  /**
    Helper function to dispatch to either hide or show details pane
  */
  handleShowHideDetails: function () {
    if (this.detailsPaneVisible) {
      this.hideDetailsPane();
    } else {
      this.showDetailsPane();
    }
  },

  /**
    Slide in the details pane
  */
  showDetailsPane: function () {
    var button;

    button = this.$('#mapDetailsHideShow');
    button.html('Hide &rsaquo;');
    this.set('detailsPaneVisible', true);

    this.$('#flowMap').animate({
      width: '75%'
    }, 200);
    this.$('#pointDetails').animate({
      width: '24.5%'
    }, 200).css({
      overflow: 'auto',
      marginLeft: '-2px'
    });
    this.$(this.detailsPaneElements, '#pointDetails').animate({
      opacity: '1'
    }, 200).css({
      display: 'inherit'
    });
  },


  /**
    Slide out details pane
  */
  hideDetailsPane: function (delay) {
    var button;

    delay = typeof delay !== 'undefined' ? delay : 0;
    button = this.$('#mapDetailsHideShow');

    this.set('detailsPaneVisible', false);
    button.html('&lsaquo; Show');

    this.$('#flowMap').delay(delay).animate({
      width: '99.25%'
    }, 200);
    this.$('#pointDetails').delay(delay).animate({
      width: '0.25%'
    }, 200).css({
      overflow: 'scroll-y',
      marginLeft: '-2px'
    });
    this.$(this.detailsPaneElements, '#pointDetails').delay(delay).animate({
      opacity: '0',
      display: 'none'
    });
  },

  /**
    If a placemark is selected and the details pane is hidden make sure to
    slide out
  */
  handlePlacemarkDetails: function () {
    var details;

    details = FLOW.placemarkDetailController.get('content');

    if (!this.detailsPaneVisible) {
      this.showDetailsPane();
    }
    if (!Ember.empty(details) && details.get('isLoaded')) {
      this.populateDetailsPane(details);
    }
  }.observes('FLOW.placemarkDetailController.content.isLoaded'),


  /**
    Populates the details pane with data from a placemark
  */
  populateDetailsPane: function (details) {
    var rawImagePath, verticalBars;

    this.set('showDetailsBool', true);
    details.forEach(function (item) {
      rawImagePath = item.get('stringValue') || '';
      verticalBars = rawImagePath.split('|');
      if (verticalBars.length === 4) {
        FLOW.placemarkDetailController.set('selectedPointCode',
          verticalBars[3]);
      }
    }, this);
  },

  /*Place a marker to highlight clicked point of layer on cartodb map*/
  placeMarker: function(latlng){
    var markerIcon = new L.Icon({
      iconUrl: 'images/marker.svg',
      iconSize: [10, 10]
    });
    this.marker = new L.marker(latlng, {icon: markerIcon});
    this.map.addLayer(this.marker);
  },

  //create named maps
  namedMaps: function(map, mapName, table, sql, interactivity){
    var self = this;

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
          self.createLayer(map, mapName, "");
        }
      }
    });
  },

  /*this function overlays a named map on the cartodb map*/
  createLayer: function(map, mapName, interactivity){
    var self = this, pointDataUrl;

    //first clear any currently overlayed cartodb layer
    self.clearCartodbLayer();

    // add cartodb layer with one sublayer
    cartodb.createLayer(map, {
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
    .addTo(map)
    .done(function(layer) {
      layer.setZIndex(1000); //required to ensure that the cartodb layer is not obscured by the here maps base layers
      self.layerExistsCheck = true;
      self.cartodbLayer = layer;

      FLOW.addCursorInteraction(layer, 'flowMap');

      var current_layer = layer.getSubLayer(0);
      current_layer.setInteraction(true);

      current_layer.on('featureClick', function(e, latlng, pos, data) {
        if(self.marker != null){
          self.map.removeLayer(self.marker);
        }
        self.placeMarker([data.lat, data.lon]);

        self.showDetailsPane();
        if($('.form_selector').length && $('.form_selector').val() !== ""){
          pointDataUrl = '/rest/cartodb/raw_data?dataPointId='+data.data_point_id+'&formId='+$('.form_selector').val();
          $.get('/rest/cartodb/data_point?id='+data.data_point_id, function(pointData, status){
            self.getCartodbPointData(pointDataUrl, pointData['row']['name'], pointData['row']['identifier']);
          });
        }else{
          pointDataUrl = '/rest/cartodb/answers?dataPointId='+data.id+'&surveyId='+data.survey_id;
          self.getCartodbPointData(pointDataUrl, data.name, data.identifier);
        }
      });
    });
  },

  getCartodbPointData: function(url, dataPointName, dataPointIdentifier){
    var self = this;
    $("#pointDetails").html("");
    $.get(url, function(pointData, status){
      var clickedPointContent = "";

      if (pointData['answers'] != null) {
        //get request for questions
        $.get(
            "/rest/cartodb/questions?form_id="+pointData['formId'],
            function(questionsData, status){
              var geoshapeObject, geoshapeCheck = false;
              self.geoshapeCoordinates = null;

              var dataCollectionDate = pointData['answers']['created_at'];
              var date = new Date(dataCollectionDate);

              clickedPointContent += '<ul class="placeMarkBasicInfo floats-in">'
              +'<h3>'
              +((dataPointName != "" && dataPointName != "null" && dataPointName != null) ? dataPointName : "")
              +'</h3>'
              +'<li>'
              +'<span>'+Ember.String.loc('_data_point_id') +':</span>'
              +'<div style="display: inline; margin: 0 0 0 5px;">'+dataPointIdentifier+'</div>'
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
                          self.geoshapeCoordinates = geoshapeObject;

                          if(geoshapeObject !== null){
                            geoshapeCheck = true;
                            //create a container for each feature in geoshape object
                            clickedPointContent += '<div id="geoShapeMap" style="width:99%; height: 150px; float: left"></div>';
                            for(var j=0; j<geoshapeObject['features'].length; j++){
                              clickedPointContent += '<label style="font-weight: bold; color: black">'+geoshapeObject['features'][j]['geometry']['type']+'</label>';
                              if(geoshapeObject['features'][j]['geometry']['type'] === "Polygon"
                               || geoshapeObject['features'][j]['geometry']['type'] === "LineString"
                                || geoshapeObject['features'][j]['geometry']['type'] === "MultiPoint"){
                                clickedPointContent += '<div style="float: left; width: 100%">'+ Ember.String.loc('_points') +': '+geoshapeObject['features'][j]['properties']['pointCount']+'</div>';
                              }

                              if(geoshapeObject['features'][j]['geometry']['type'] === "Polygon"
                               || geoshapeObject['features'][j]['geometry']['type'] === "LineString"){
                                clickedPointContent += '<div style="float: left; width: 100%">'+ Ember.String.loc('_length') +': '+geoshapeObject['features'][j]['properties']['length']+'m</div>';
                              }

                              if(geoshapeObject['features'][j]['geometry']['type'] === "Polygon"){
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
                    clickedPointContent += "&nbsp;</div><hr>";
                  }
                }
              }
              clickedPointContent += '</div>';
              $('#pointDetails').html(clickedPointContent);
              $('hr').show();

              //if there's geoshape, draw it
              if(geoshapeCheck){
                //pass container node, object type, and object coordinates to drawGeoShape function
                FLOW.drawGeoShape('geoShapeMap', geoshapeObject['features']);
              }
            });
      } else {
        clickedPointContent += '<p class="noDetails">'+Ember.String.loc('_no_details') +'</p>';
        $('#pointDetails').html(clickedPointContent);
      }
    });
  },

  //function to project geoshape from details panel to main map canvas
  projectGeoshape: function(geoShapeObject){
    //before fitting the geoshape to map, get the current
    //zoom level and map center first and save them
    this.mapZoomLevel = this.map.getZoom();
    this.mapCenter = this.map.getCenter();

    //create a leaflet featureGroup to hold all object features
    var featureGroup = new L.featureGroup;
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
        geoShape = L.polygon(points).addTo(this.map);
      }else if (geoShapeObjectType === "MultiPoint") {
        var geoShapeMarkersArray = [];
        for (var k = 0; k < points.length; k++) {
          geoShapeMarkersArray.push(L.marker([points[k][0],points[k][1]]));
        }
        geoShape = L.featureGroup(geoShapeMarkersArray).addTo(this.map);
      }else if (geoShapeObjectType === "LineString") {
        geoShape = L.polyline(points).addTo(this.map);
      }
      featureGroup.addLayer(geoShape);
      this.polygons.push(geoShape);
    }
    this.map.fitBounds(featureGroup.getBounds()); //fit featureGroup to map bounds
  },

  manageHierarchy: function(parentFolderId){
    clearInterval(this.refreshIntervalId); //stop the interval if running
    var self = this, rows = self.hierarchyObject;

    rows.sort(function(el1, el2) {
      return FLOW.compare(el1, el2, 'name');
    });

    //create folder and/or survey select element
    var folder_survey_selector = $('<select></select>').attr("class", "folder_survey_selector");
    folder_survey_selector.append('<option value="">--' + Ember.String.loc('_choose_folder_or_survey') + '--</option>');

    for (var i=0; i<rows.length; i++) {
      //append return survey list to the survey selector element
      var surveyGroup = rows[i];

      //if a subfolder, only load folders and surveys from parent folder
      if(surveyGroup.parentId == parentFolderId){
        folder_survey_selector.append('<option value="'
          + surveyGroup.keyId + '"'
          +'data-type="'+surveyGroup.projectType+'">'
          + surveyGroup.name
          + '</option>');
      }
    }
    $("#survey_hierarchy").append(folder_survey_selector);
  },

  clearCartodbLayer: function(){
    //check to confirm that there are no layers displayed on the map
    if(this.layerExistsCheck){
      this.map.removeLayer(this.cartodbLayer);
      this.layerExistsCheck = false;
    }
  }
});

FLOW.CustomMapsListView = FLOW.View.extend({
  templateName: 'navMaps/custom-maps-list',
  refreshIntervalId: null,

  /**
    Once the view is in the DOM populate the list
  */
  didInsertElement: function () {
    var self = this;

    FLOW.initAjaxSetup();

    $.get('/rest/cartodb/custom_maps', function(customMapsData, status) {
      //load a list of available custom maps here
      if(customMapsData.custom_maps){
        if($.active > 0){
    			self.refreshIntervalId = setInterval(function () {
    				//keep checking if there are any pending ajax requests
    				if($.active > 0){
    					//keep displaying loading icon
    				}else{ //if no pending ajax requests
    					//call function to load the custom maps list view
    					self.createCustomMapsListTable(customMapsData);
    				}
    		  },2000);
    		}else{
    			//call function to load the custom maps list view
          self.createCustomMapsListTable(customMapsData);
    		}
      }
    });

    $(document.body).on('click', '.newCustomMap', function(){
      FLOW.selectedControl.set('selectedCustomMap', null);
      FLOW.router.transitionTo('navMaps.customMapEdit');
    });

    $(document.body).on('click', '.editCustomMap', function(){
      FLOW.selectedControl.set('selectedCustomMap', $(this).data('customMap'));
      FLOW.router.transitionTo('navMaps.customMapEdit');
    });

    $(document.body).on('click', '.viewCustomMap', function(){
      FLOW.selectedControl.set('selectedCustomMap', $(this).data('customMap'));
      FLOW.selectedControl.set('selectedCustomMapFormId', $(this).data('formId'));
      FLOW.router.transitionTo('navMaps.customMap');
    });

    $(document.body).on('click', '.deleteCustomMap', function(){
      if(confirm("Are you sure you want to delete this map?")){
        $.get(
          '/rest/cartodb/delete_custom_map?map_name='+$(this).data('customMap') ,
          function(response, status){
            FLOW.router.transitionTo('navMaps.customMapsList');
        });
      }
    });
  },

  createCustomMapsListTable: function(customMapsData){
    clearInterval(this.refreshIntervalId); //stop the interval if running
    var surveyGroupsData = FLOW.selectedControl.get('cartodbMapsSurveyGroups');
    if(surveyGroupsData.survey_groups){
      for(var i=0; i<customMapsData.custom_maps.length; i++){
        var modifyDate = new Date(customMapsData.custom_maps[i].modify_date);
        var customMapsList = '';
        customMapsList += '<tr>'
          +'<td>'
          +'<a class="viewCustomMap" data-form-id="'+customMapsData.custom_maps[i].form_id
          +'" data-custom-map="'+customMapsData.custom_maps[i].named_map+'">'
          +customMapsData.custom_maps[i].custom_map_title
          +'</a></td>';
        customMapsList += '<td>';
        //if survey id is set, get its title from survey groups object else leave it empty
        if(customMapsData.custom_maps[i].survey_id !== 0){
          for(var j=0; j<surveyGroupsData['survey_groups'].length; j++){
            if(surveyGroupsData['survey_groups'][j].keyId === customMapsData.custom_maps[i].survey_id){
              customMapsList += surveyGroupsData['survey_groups'][j].name;
            }
          }
        }
        customMapsList += '</td>';
        customMapsList += '<td>'+modifyDate.toUTCString()+'</td>'
          +'<td>'+customMapsData.custom_maps[i].creator+'</td>'
          +'<td  class="action">';
        if(customMapsData.custom_maps[i].form_id !== 0){
          //only allow users who have access to specified form to edit or delete custom map
          for(var j=0; j<surveyGroupsData['survey_groups'].length; j++){
            if(surveyGroupsData['survey_groups'][j]['surveyList'] !== null){
              if(surveyGroupsData['survey_groups'][j]['surveyList'][0].keyId === customMapsData.custom_maps[i].form_id){
                //console.log(surveyGroupsData['survey_groups'][j].keyId+" confirmed...you may proceed");
                customMapsList += '<a class="edit editCustomMap" data-custom-map="'+customMapsData.custom_maps[i].named_map+'">'
                  +Ember.String.loc('_edit')
                  +'</a>'
                  +'<a class="remove deleteCustomMap" data-custom-map="'+customMapsData.custom_maps[i].named_map+'">'
                  +Ember.String.loc('_remove')+'</a>';
              }
            }
          }
        }else{
          if(customMapsData.custom_maps[i].survey_id !== 0){
            //only allow users who have access to specified survey to edit or delete custom map
            for(var j=0; j<surveyGroupsData['survey_groups'].length; j++){
              if(surveyGroupsData['survey_groups'][j]['surveyList'] !== null){
                if(surveyGroupsData['survey_groups'][j].keyId === customMapsData.custom_maps[i].survey_id){
                  customMapsList += '<a class="edit editCustomMap" data-custom-map="'+customMapsData.custom_maps[i].named_map+'">'
                    +Ember.String.loc('_edit')
                    +'</a>'
                    +'<a class="remove">'+Ember.String.loc('_remove')+'</a>';
                }
              }
            }
          }else{
            // TODO:
            //only allow dashboard administrators to be able to delete a custom map of all data points
          }
        }
        customMapsList += '</td></tr>';

        $('#customMapsTable').append(customMapsList);
      }
    }
  }
});

FLOW.CustomMapEditView = FLOW.View.extend({
  templateName: 'navMaps/custom-map-edit',
  map: null,
  mapEditorPaneVisible: null,
  hierarchyObject: [],
  lastSelectedElement: 0,
  newMap: true,
  customMapData: {},
  customMapName: null,
  selectedTable: '', //cartodb table name that custom map is based on
  selectedFormColumns: null,
  cartodbLayer: null,
  layerExistsCheck: false,

  init: function () {
    this._super();
    this.mapEditorPaneVisible = false;
  },

  /**
    Slide in the map editor pane
  */
  showMapEditorPane: function () {
    this.set('detailsPaneVisible', true);

    this.$('#flowMap').animate({
      width: '75%'
    }, 200);
    this.$('#pointDetails').animate({
      width: '24.5%'
    }, 200).css({
      overflow: 'auto',
      marginLeft: '-2px'
    });
  },

  /**
    Once the view is in the DOM create the map editor
  */
  didInsertElement: function () {
    var self = this;

    FLOW.initAjaxSetup();

    // create and draw leaflet map
    var map = L.map('flowMap', {scrollWheelZoom: true}).setView([26.11598592533351, 1.9335937499999998], 2);
    FLOW.drawLeafletMap(map);

    this.map = map;

    // add scale indication to map
    L.control.scale({position:'topleft', maxWidth:150}).addTo(map);

    self.showMapEditorPane();

    //if a new custom map, get a server timestamp to serve as part of the custom map name
    if(FLOW.selectedControl.get('selectedCustomMap') === null){
      $.get('/rest/cartodb/timestamp', function(timestampData){
        self.customMapName = 'custom_map_'+timestampData.timestamp;
        //automatically create a named map that's to me customised
        self.createNamedMapObject('data_point', '', '', '');
        self.newMap = false; //immediately set newMap to false because a named map will have a already been created
      });
    }else{
      self.newMap = false;
      self.customMapName = FLOW.selectedControl.get('selectedCustomMap');
      //get custom map details
      $.get('/rest/cartodb/custom_map_details?name='+self.customMapName, function(customMapDetailsData){
        if(customMapDetailsData.custom_map_details){
          //set map title and description to selected custom map
          $('#mapTitle').val(customMapDetailsData.custom_map_details[0]['custom_map_title']);
          $('#mapDescription').val(customMapDetailsData.custom_map_details[0]['custom_map_description']);
        }
      });
      self.createLayer(self.customMapName, ""); //load selected map
    }

    //initialise map payloads structures as follows
    self.customMapData['formId'] = 0;
    self.customMapData['surveyId'] = 0;
    self.customMapData['creator'] = FLOW.currentUser.email;
    self.customMapData['customMapTitle'] = '';
    self.customMapData['customMapDescription'] = '';
    self.customMapData['namedMap'] = '';
    self.customMapData['cartocss'] = '';
    self.customMapData['legend'] = '';
    self.customMapData['permission'] = '';
    self.customMapData['newMap'] = '';

    //manage folder and/or survey selection hierarchy
    self.checkHierarchy(0);

    $(document).off('change', '.folder_survey_selector').on('change', '.folder_survey_selector',function(e) {
      //remove all 'folder_survey_selector's after current
      FLOW.cleanSurveyGroupHierarchy($(this));

      //first remove previously created form selector elements
      $(".form_selector").remove();
      self.customMapData['formId'] = 0;
      self.customMapData['surveyId'] = 0;
      self.selectedTable = '';

      if($(this).val() !== ""){
        var surveyGroupKeyId = $(this).val();
        //if a survey is selected, load forms to form selector element.
        if($(this).find("option:selected").data('type') === 'PROJECT'){
          self.customMapData['surveyId'] = $(this).find("option:selected").val();
          $.get('/rest/cartodb/forms?surveyId='+surveyGroupKeyId, function(data, status) {
            var rows = [];
            if(data['forms'] && data['forms'].length > 0) {
              rows = data['forms'];
              rows.sort(function(el1, el2) {
                return FLOW.compare(el1, el2, 'name')
              });

              var hierarchyObject = self.hierarchyObject;

              //create folder and/or survey select element
              var form_selector = $('<select></select>').attr("data-survey-id", surveyGroupKeyId).attr("class", "form_selector");
              form_selector.append('<option value="">--' + Ember.String.loc('_choose_a_form') + '--</option>');

              for(var i=0; i<rows.length; i++) {
                //append returned forms list to the firm selector element
                form_selector.append(
                  $('<option></option>').val(rows[i]["id"]).html(rows[i]["name"]));
              }
              $("#survey_hierarchy").append(form_selector);
            }
          });

          self.createNamedMapObject('data_point', 'survey_id', surveyGroupKeyId, '');
        }else{ //if a folder is selected, load the folder's children on a new 'folder_survey_selector'
          //first clear any currently overlayed cartodb layer (if any)
          self.clearCartodbLayer();

          var hierarchyObject = self.hierarchyObject;

          for(var i=0; i<hierarchyObject.length; i++){
            if(hierarchyObject[i].keyId === parseInt(surveyGroupKeyId) && self.lastSelectedElement !== parseInt(surveyGroupKeyId)){
              self.checkHierarchy(surveyGroupKeyId);
              self.lastSelectedElement = parseInt(surveyGroupKeyId);
            }
          }
        }
      }else{ //if nothing is selected, delete all children 'folder_survey_selector's and clear form selector
        self.clearCartodbLayer();
      }

    });

    $(document).off('change', '.form_selector').on('change', '.form_selector',function(e) {
      //remove all 'folder_survey_selector's after current
      FLOW.cleanSurveyGroupHierarchy($(this));
      self.customMapData['formId'] = 0;
      self.selectedTable = '';

      if ($(this).val() !== "") {
        var formId = $(this).val();
        self.customMapData['formId'] = formId;
        self.selectedTable = 'raw_data_'+formId;

        //create a question selector element
        var questionSelector = $('<select></select>').attr("class", "question_selector");
        questionSelector.append('<option value="">--' + Ember.String.loc('_select_option_question') + '--</option>');

        var ajaxObject = {};
        ajaxObject['call'] = "GET";
        ajaxObject['url'] = "/rest/cartodb/columns?table_name=raw_data_"+formId;
        ajaxObject['data'] = "";
        FLOW.ajaxCall(function(response){
          if(response.column_names){
            self.selectedFormColumns = response.column_names;

            //get a list of questions from the selected form
            $.get(
              "/rest/cartodb/questions?form_id="+formId,
              function(questionsData, questionsQueryStatus){
                //only list questions which are of type "option"
                for(var i=0; i<questionsData['questions'].length; i++){
                  if(questionsData['questions'][i].type === "OPTION"){
                    //first pull a list of column names from the cartodb table then set the option values to the column names
                    for(var j=0; j<self.selectedFormColumns.length; j++){
                      if(self.selectedFormColumns[j]['column_name'].match(questionsData['questions'][i].id)){
                        questionSelector.append('<option value="'
                          + self.selectedFormColumns[j]['column_name'] + '">'
                          + questionsData['questions'][i].display_text
                          + '</option>');
                      }
                    }
                  }
                }
                $("#survey_hierarchy").append(questionSelector);
              });
          }
        }, ajaxObject);
        self.createNamedMapObject('raw_data_'+formId, '', '', '');
      } else {
        self.createLayer(self.customMapName, "");
      }
    });

    $(document).off('change', '.question_selector').on('change', '.question_selector',function(e) {
      if ($(this).val() !== "") {
        var columnName = $(this).val();
        //get a list of distinct values associated with this question
        $.get(
          '/rest/cartodb/distinct?column_name='+$(this).val()+'&form_id='+$('.form_selector').val(),
          function(optionsData){
            var styleSelector = $('<div></div>').attr("class", "style_selector");
            if(optionsData.distinct_values){
              for(var i=0; i<optionsData.distinct_values.length; i++){
                var colourPicker = $('<div class="form-group"><label for="option_'+i+'">'
                  +optionsData.distinct_values[i][$('.question_selector').val()]+'</label></div>');
                var colourPickerInput = $('<input class="question_options" id="option_'+i+'" data-column="'
                  +columnName+'" data-option="'+optionsData.distinct_values[i][$(".question_selector").val()]
                  +'" type="text">');
                colourPicker.append(colourPickerInput);
                styleSelector.append(colourPicker);
                colourPickerInput.minicolors({});
                colourPickerInput.minicolors('value', (Math.random()*0xFFFFFF<<0).toString(16));
              }
            }
            $('#survey_hierarchy').append(styleSelector);
          });
      }
    });

    $(document).off('click', '#saveCustomMap').on('click', '#saveCustomMap',function(e){
      if($('#mapTitle').val() !== "" && $('#mapDescription').val() !== ""){

        var cartocss = [], current_cartocss = '';
        self.customMapData['customMapTitle'] = $('#mapTitle').val();
        self.customMapData['customMapDescription'] = $('#mapDescription').val();
        self.customMapData['namedMap'] = self.customMapName;
        if ($('.question_options').length) {
          $('.question_options').each( function() {
            var currentColour = {};
            currentColour['title'] = $(this).data('option');
            currentColour['colour'] = $(this).val();
            cartocss.push(currentColour);

            current_cartocss += '#'+self.selectedTable+'['+$(this).data('column')+'="'+$(this).data('option')+'"]';
    				current_cartocss += '{';
    				//cartocss += "marker-fill: #"+Math.random().toString(16).slice(2, 8);
    				current_cartocss += 'marker-fill: '+$(this).val()+';';
    				current_cartocss += '}';
          });
          self.customMapData['cartocss'] = JSON.stringify(cartocss);

          //first update the named map before uploading it to cartodb
          self.createNamedMapObject(self.selectedTable, '', '', current_cartocss);
        }
        //if creating a new map set mapType to 'new'
        if(FLOW.selectedControl.get('selectedCustomMap') === null){
          self.customMapData['newMap'] = 'true';
        }else{
          self.customMapData['newMap'] = 'false';
        }

        var ajaxObject = {};
        ajaxObject['call'] = "POST";
        ajaxObject['url'] = "/rest/cartodb/edit_custom_map";
        ajaxObject['data'] = JSON.stringify(self.customMapData);

        FLOW.ajaxCall(function(response){
          if(response){
            FLOW.selectedControl.set('selectedCustomMap', self.customMapName);
          }
        }, ajaxObject);
      }else{
        //prompt user to enter a map title and/or description
        alert("Please enter a title and/or description");
      }
    });
  },

  checkHierarchy: function(parentFolderId){
    var self = this;

    //if survey hierarchy object has previously been retrieved, no need to pull it anew
    if(self.hierarchyObject.length > 0){
      self.manageHierarchy(parentFolderId);
    }else{
      if($.active > 0){
        self.refreshIntervalId = setInterval(function () {
          //keep checking if there are any pending ajax requests
          if($.active > 0){
            //keep displaying loading icon
          }else{ //if no pending ajax requests
            //call function to manage the hierarchy
            self.hierarchyObject = FLOW.selectedControl.get('cartodbMapsSurveyGroups')['survey_groups'];
            self.manageHierarchy(parentFolderId);
          }
        },2000);
      }else{
        //call function to manage the hierarchy
        self.hierarchyObject = FLOW.selectedControl.get('cartodbMapsSurveyGroups')['survey_groups'];
        self.manageHierarchy(parentFolderId);
      }
    }
  },

  manageHierarchy: function(parentFolderId){
    clearInterval(this.refreshIntervalId); //stop the interval if running
    var self = this, rows = self.hierarchyObject;

    rows.sort(function(el1, el2) {
      return FLOW.compare(el1, el2, 'name');
    });

    //create folder and/or survey select element
    var folder_survey_selector = $('<select></select>').attr("class", "folder_survey_selector");
    folder_survey_selector.append('<option value="">--' + Ember.String.loc('_choose_folder_or_survey') + '--</option>');

    for (var i=0; i<rows.length; i++) {
      //append return survey list to the survey selector element
      var surveyGroup = rows[i];

      //if a subfolder, only load folders and surveys from parent folder
      if(surveyGroup.parentId == parentFolderId){
        folder_survey_selector.append('<option value="'
          + surveyGroup.keyId + '"'
          +'data-type="'+surveyGroup.projectType+'">'
          + surveyGroup.name
          + '</option>');
      }
    }
    $("#survey_hierarchy").append(folder_survey_selector);
  },

  createNamedMapObject: function(table, column, value, cartocss){
    var self = this;

    /* Build a (temporary) named map based on currently selected survey/form */
    var namedMapObject = {};
    namedMapObject['name'] = self.customMapName;
    namedMapObject['interactivity'] = [];
    namedMapObject['query'] = self.buildQuery(table, column, value);
    namedMapObject['requestType'] = (self.newMap) ? "POST" : "PUT";

    //if cartocss is not defined, create map using default style
    namedMapObject['cartocss'] = "#"+table+"{"
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
    $.get('/rest/cartodb/columns?table_name='+table, function(columnsData) {
      if (columnsData.column_names) {
        for (var j=0; j<columnsData['column_names'].length; j++) {
          namedMapObject['interactivity'].push(columnsData['column_names'][j]['column_name']);
        }
      }
      self.namedMaps(namedMapObject);
    });
  },

  //create named maps
  namedMaps: function(namedMapObject){
    var self = this;

    var configJsonData = {};

    var ajaxObject = {};
    ajaxObject['call'] = "POST";
    ajaxObject['url'] = "/rest/cartodb/named_maps";
    ajaxObject['data'] = JSON.stringify(namedMapObject);

    FLOW.ajaxCall(function(response){
      if(response.template_id){
        self.customMapName = response.template_id;
        self.createLayer(response.template_id, "");
      }
    }, ajaxObject);
  },

  /*this function overlays a named map on the cartodb map*/
  createLayer: function(mapName, interactivity){
    var self = this, pointDataUrl;

    //first clear any currently overlayed cartodb layer
    self.clearCartodbLayer();

    // add cartodb layer with one sublayer
    cartodb.createLayer(self.map, {
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
    .addTo(self.map)
    .done(function(layer) {
      layer.setZIndex(1000); //required to ensure that the cartodb layer is not obscured by the here maps base layers
      self.layerExistsCheck = true;
      self.cartodbLayer = layer;

      FLOW.addCursorInteraction(layer, 'flowMap');

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

      /*currentLayer.on('featureClick', function(e, latlng, pos, data) {
        if(self.marker != null){
          self.map.removeLayer(self.marker);
        }
        self.placeMarker([data.lat, data.lon]);

        self.showDetailsPane();
        if($('.form_selector').length && $('.form_selector').val() !== ""){
          pointDataUrl = '/rest/cartodb/raw_data?dataPointId='+data.data_point_id+'&formId='+$('.form_selector').val();
          $.get('/rest/cartodb/data_point?id='+data.data_point_id, function(pointData, status){
            self.getCartodbPointData(pointDataUrl, pointData['row']['name'], pointData['row']['identifier']);
          });
        }else{
          pointDataUrl = '/rest/cartodb/answers?dataPointId='+data.id+'&surveyId='+data.survey_id;
          self.getCartodbPointData(pointDataUrl, data.name, data.identifier);
        }
      });*/
    });
  },

  clearCartodbLayer: function(){
    //check to confirm that there are no layers displayed on the map
    if(this.layerExistsCheck){
      this.map.removeLayer(this.cartodbLayer);
      this.layerExistsCheck = false;
    }
  },

  buildQuery: function(table, column, value){
    var query = "SELECT * FROM "+table;
    if(column !== ""){
      query += " WHERE "+column+" = '"+value+"'";
    }
    return query;
  }
});

FLOW.CustomMapView = FLOW.View.extend({
  templateName: 'navMaps/custom-map-view',
  detailsPaneElements: null,
  detailsPaneVisible: null,
  map: null,
  marker: null,
  geoShape: null,
  geoshapeCoordinates: null,
  polygons: [],
  mapZoomLevel: 0,
  mapCenter: null,

  init: function () {
    this._super();
    this.detailsPaneElements = "#pointDetails h2" +
      ", #pointDetails dl" +
      ", #pointDetails img" +
      ", #pointDetails .imgContainer" +
      ", .placeMarkBasicInfo" +
      ", .noDetails";
    this.detailsPaneVisible = false;
  },

  /**
    Once the view is in the DOM create the map
  */
  didInsertElement: function () {
    var self = this, pointDataUrl;

    FLOW.initAjaxSetup();

    // create and draw leaflet map
    var map = L.map('flowMap', {scrollWheelZoom: true}).setView([26.11598592533351, 1.9335937499999998], 2);
    FLOW.drawLeafletMap(map);

    FLOW.selectedControl.set('mapZoomLevel', map.getZoom());
    FLOW.selectedControl.set('mapCenter', map.getCenter());
    FLOW.selectedControl.set('polygons', []);

    this.map = map;

    //get selected custom map details
    $.get(
      '/rest/cartodb/custom_map_details?name='+FLOW.selectedControl.get('selectedCustomMap')
      , function(customMapDetailsData){
        if(customMapDetailsData.custom_map_details){
          //set map title and description to selected custom map
          var mapTitle = '<div style="width: 100%; float: left">'
            +customMapDetailsData.custom_map_details[0]['custom_map_title']
            +'</div>';
          var mapDescription = '<div style="width: 100%; float: left">'
            +customMapDetailsData.custom_map_details[0]['custom_map_description']
            +'</div>';
          $('#customMapDetails').html(mapTitle+mapDescription);
          $('#customMapEditOptions').html('<a class="edit editCustomMap" data-custom-map="'
            +customMapDetailsData.custom_map_details[0]['named_map']+'">'
            +Ember.String.loc('_edit')
            +'</a>'
            +'<a class="remove deleteCustomMap"  data-custom-map="'
            +customMapDetailsData.custom_map_details[0]['named_map']
            +'">'+Ember.String.loc('_remove')+'</a>');
        }
    });

    map.on('click', function(e) {
      if(self.marker != null){
        self.map.removeLayer(self.marker);
        self.hideDetailsPane();
        $('#pointDetails').html('<p class="noDetails">'+Ember.String.loc('_no_details') +'</p>');
      }

      if(FLOW.selectedControl.get('polygons').length > 0){
        for(var i=0; i<FLOW.selectedControl.get('polygons').length; i++){
          self.map.removeLayer(FLOW.selectedControl.get('polygons')[i]);
        }
        //restore the previous zoom level and map center
        self.map.setZoom(FLOW.selectedControl.get('mapZoomLevel'));
        self.map.panTo(FLOW.selectedControl.get('mapCenter'));
        FLOW.selectedControl.set('polygons', []);
      }
    });

    map.on('zoomend', function() {
      $('body, html, #flowMap').scrollTop(0);
    });

    $(document.body).on('click', '.editCustomMap', function(){
      FLOW.selectedControl.set('selectedCustomMap', $(this).data('customMap'));
      FLOW.router.transitionTo('navMaps.customMapEdit');
    });

    $(document.body).on('click', '.deleteCustomMap', function(){
      if(confirm("Are you sure you want to delete this map?")){
        $.get(
          '/rest/cartodb/delete_custom_map?map_name='+$(this).data('customMap') ,
          function(response, status){
            FLOW.router.transitionTo('navMaps.customMapsList');
        });
      }
    });

    // add scale indication to map
    L.control.scale({position:'topleft', maxWidth:150}).addTo(this.map);

    this.$('#mapDetailsHideShow').click(function () {
      self.handleShowHideDetails();
    });

    $(document.body).on('click', '.projectGeoshape', function(){
      if(FLOW.selectedControl.get('polygons').length > 0){
        $(this).html(Ember.String.loc('_project_geoshape_onto_main_map'));
        //restore the previous zoom level and map center
        self.map.setZoom(self.mapZoomLevel);
        self.map.panTo(self.mapCenter);
        FLOW.selectedControl.set('polygons', []);
      }else{
        $(this).html(Ember.String.loc('_clear_geoshape_from_main_map'));
        FLOW.projectGeoshape(self.map, FLOW.selectedControl.get('geoshapeCoordinates'));
      }
    });

    // Slide in detailspane after 1 sec
    this.hideDetailsPane(1000);

    // add cartodb layer with one sublayer
    cartodb.createLayer(self.map, {
      user_name: FLOW.Env.appId,
      type: 'namedmap',
      named_map: {
        name: FLOW.selectedControl.get('selectedCustomMap'),
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
    .addTo(self.map)
    .done(function(layer) {
      layer.setZIndex(1000); //required to ensure that the cartodb layer is not obscured by the here maps base layers
      self.layerExistsCheck = true;
      self.cartodbLayer = layer;

      FLOW.addCursorInteraction(layer, 'flowMap');

      var currentLayer = layer.getSubLayer(0);
      currentLayer.setInteraction(true);

      currentLayer.on('featureClick', function(e, latlng, pos, data) {
        var dataPointObject = {};
        dataPointObject['pointDetailsPane'] = 'pointDetails';
        if(self.marker != null){
          self.map.removeLayer(self.marker);
        }
        self.placeMarker([data.lat, data.lon]);

        self.showDetailsPane();
        if(typeof data.survey_id !== "undefined"){
          pointDataUrl = '/rest/cartodb/answers?dataPointId='+data.id+'&surveyId='+data.survey_id;
          //self.getCartodbPointData(pointDataUrl, data.name, data.identifier);
          dataPointObject['url'] = pointDataUrl;
          dataPointObject['dataPointName'] = data.name;
          dataPointObject['dataPointIdentifier'] = data.identifier;
          FLOW.getCartodbPointData(dataPointObject);
        }else{
          pointDataUrl = '/rest/cartodb/raw_data?dataPointId='+data.data_point_id+'&formId='+FLOW.selectedControl.get('selectedCustomMapFormId');
          $.get('/rest/cartodb/data_point?id='+data.data_point_id, function(pointData, status){
            //self.getCartodbPointData(pointDataUrl, pointData['row']['name'], pointData['row']['identifier']);
            dataPointObject['url'] = pointDataUrl;
            dataPointObject['dataPointName'] = pointData['row']['name'];
            dataPointObject['dataPointIdentifier'] = pointData['row']['identifier'];
            FLOW.getCartodbPointData(dataPointObject);
          });
        }
      });
    });
  },

  /**
    Helper function to dispatch to either hide or show details pane
  */
  handleShowHideDetails: function () {
    if (this.detailsPaneVisible) {
      this.hideDetailsPane();
    } else {
      this.showDetailsPane();
    }
  },

  /**
    Slide in the details pane
  */
  showDetailsPane: function () {
    var button;

    button = this.$('#mapDetailsHideShow');
    button.html('Hide &rsaquo;');
    this.set('detailsPaneVisible', true);

    this.$('#flowMap').animate({
      width: '75%'
    }, 200);
    this.$('#pointDetails').animate({
      width: '24.5%'
    }, 200).css({
      overflow: 'auto',
      marginLeft: '-2px'
    });
    this.$(this.detailsPaneElements, '#pointDetails').animate({
      opacity: '1'
    }, 200).css({
      display: 'inherit'
    });
  },


  /**
    Slide out details pane
  */
  hideDetailsPane: function (delay) {
    var button;

    delay = typeof delay !== 'undefined' ? delay : 0;
    button = this.$('#mapDetailsHideShow');

    this.set('detailsPaneVisible', false);
    button.html('&lsaquo; Show');

    this.$('#flowMap').delay(delay).animate({
      width: '99.25%'
    }, 200);
    this.$('#pointDetails').delay(delay).animate({
      width: '0.25%'
    }, 200).css({
      overflow: 'scroll-y',
      marginLeft: '-2px'
    });
    this.$(this.detailsPaneElements, '#pointDetails').delay(delay).animate({
      opacity: '0',
      display: 'none'
    });
  },

  placeMarker: function(latlng){
    var markerIcon = new L.Icon({
      iconUrl: 'images/marker.svg',
      iconSize: [10, 10]
    });
    this.marker = new L.marker(latlng, {icon: markerIcon});
    this.map.addLayer(this.marker);
  }
});
