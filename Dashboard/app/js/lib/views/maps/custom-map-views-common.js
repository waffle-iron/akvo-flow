FLOW.DataMapView = FLOW.View.extend({
  templateName: 'navMaps/data-map',

  /**
    Once the view is in the DOM create the map
  */
  didInsertElement: function () {
    console.log("load default map");
  }
});

FLOW.CustomMapsListView = FLOW.View.extend({
  templateName: 'navMaps/custom-maps-list',

  /**
    Once the view is in the DOM populate the list
  */
  didInsertElement: function () {
    $.get('/rest/cartodb/custom_maps', function(customMapsData, status) {
      //load a list of available custom maps here
      //console.log(customMapsData);
    });

    $(document.body).on('click', '.newCustomMap', function(){
      FLOW.selectedControl.set('selectedCustomMap', null);
      FLOW.router.transitionTo('navCustomMaps.customMapEdit');
    });

    $(document.body).on('click', '.editCustomMap', function(){
      FLOW.selectedControl.set('selectedCustomMap', $(this).data('customMap'));
      FLOW.router.transitionTo('navCustomMaps.customMapEdit');
    });
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
    //console.log(FLOW.selectedControl.get('selectedCustomMap'));

    //if a new custom map, get a server timestamp to serve as part of the custom map name
    if(FLOW.selectedControl.get('selectedCustomMap') === null){
      $.get('/rest/cartodb/timestamp', function(timestampData){
        self.customMapName = 'custom_map_'+timestampData.timestamp;
        //automatically create a named map that's to me customised
        self.createNamedMapObject('data_point', '', '', '');
        self.newMap = false;
      });
    }else{
      self.customMapName = FLOW.selectedControl.get('selectedCustomMap');
    }

    $.ajaxSetup({
    	beforeSend: function(){
    		FLOW.savingMessageControl.numLoadingChange(1);
        },
    	complete: function(){
    		FLOW.savingMessageControl.numLoadingChange(-1);
        }
    });

    // create and draw leaflet map
    var map = L.map('flowMap', {scrollWheelZoom: true}).setView([26.11598592533351, 1.9335937499999998], 2);
    FLOW.drawLeafletMap(map);

    this.map = map;

    // add scale indication to map
    L.control.scale({position:'topleft', maxWidth:150}).addTo(map);

    self.showMapEditorPane();

    //initialise map payloads structures as follows
    self.customMapData['formId'] = 0;
    self.customMapData['creator'] = FLOW.currentUser.email;
    self.customMapData['customMapTitle'] = '';
    self.customMapData['customMapDescription'] = '';
    self.customMapData['cartocss'] = '';
    self.customMapData['legend'] = '';
    self.customMapData['permission'] = '';

    //manage folder and/or survey selection hierarchy
    self.checkHierarchy(0);

    $(document).off('change', '.folder_survey_selector').on('change', '.folder_survey_selector',function(e) {
      //remove all 'folder_survey_selector's after current
      FLOW.cleanSurveyGroupHierarchy($(this));

      //first remove previously created form selector elements
      $(".form_selector").remove();

      if($(this).val() !== ""){
        var surveyGroupKeyId = $(this).val();
        //if a survey is selected, load forms to form selector element.
        if($(this).find("option:selected").data('type') === 'PROJECT'){
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

      if ($(this).val() !== "") {
        var formId = $(this).val();

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
        //get a list of distinct values associated with this question
        $.get(
          '/rest/cartodb/distinct?column_name='+$(this).val()+'&form_id='+$('.form_selector').val(),
          function(optionsData){
            var styleSelector = $('<div></div>').attr("class", "style_selector");
            if(optionsData.distinct_values){
              for(var i=0; i<optionsData.distinct_values.length; i++){
                var colourPickerLabel = $('<label for="option_'+i+'">'+optionsData.distinct_values[i][$('.question_selector').val()]+'</label>');
                var colourPickerInput = $('<input id="option_'+i+'" data-option="'+optionsData.distinct_values[i][$(".question_selector").val()]
                      +'" type="text" value="#'+(Math.random()*0xFFFFFF<<0).toString(16)+'">');
                //Math.random()*0xFFFFFF<<0).toString(16)
                styleSelector.append(colourPickerLabel);
                styleSelector.append(colourPickerInput);
                colourPickerInput.minicolors();
              }
            }
            $("#survey_hierarchy").append(styleSelector);
          });
      }
    });
  },

  checkHierarchy: function(parentFolderId){
    var self = this;

    //if survey hierarchy object has previously been retrieved, no need to pull it anew
    if(self.hierarchyObject.length > 0){
      self.manageHierarchy(parentFolderId);
    }else{
      $.get('/rest/survey_groups'/*place survey_groups endpoint here*/
      , function(data, status){
        if(data['survey_groups'].length > 0){
          self.hierarchyObject = data['survey_groups'];
          self.manageHierarchy(parentFolderId);
        }
      });
    }
  },

  manageHierarchy: function(parentFolderId){
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
    if(cartocss === ""){
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
    }

    //get list of columns to be added to new named map's interactivity
    $.get('/rest/cartodb/columns?table_name='+table, function(columnsData) {
      if (columnsData.column_names) {
        for (var j=0; j<columnsData['column_names'].length; j++) {
          namedMapObject['interactivity'].push(columnsData['column_names'][j]['column_name']);
        }
      }
      self.namedMapCheck(namedMapObject);
    });
  },

  /*Check if a named map exists. If one exists, call function to overlay it
  else call function to create a new one*/
  namedMapCheck: function(namedMapObject){
    var self = this;
    console.log(namedMapObject);
    $.get('/rest/cartodb/named_maps', function(data, status) {
      if (data.template_ids) {
        var mapExists = false;
        for (var i=0; i<data['template_ids'].length; i++) {
          if(data['template_ids'][i] === namedMapObject.name && self.newMap) {
            //named map already exists
            mapExists = true;
            break;
          }
        }

        if (mapExists) {
          //overlay named map
          self.createLayer(namedMapObject.name, "");
        }else{
          //create/edit named map
          self.namedMaps(namedMapObject);
        }
      }
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

      var current_layer = layer.getSubLayer(0);
      current_layer.setInteraction(true);

      /*current_layer.on('featureOver', function(e, latlon, pos, data, subLayerIndex) {
        console.log(data);
      });

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
