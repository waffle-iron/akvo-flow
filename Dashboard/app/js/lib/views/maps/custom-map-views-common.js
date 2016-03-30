FLOW.DataMapView = FLOW.View.extend({
  templateName: 'navMaps/data-map',
  map: null,
  layerExistsCheck: false,

  init: function () {
    this._super();

    FLOW.selectedControl.set('layerExistsCheck', false);
    FLOW.selectedControl.set('detailsPaneElements', "#pointDetails h2" +
      ", #pointDetails dl" +
      ", #pointDetails img" +
      ", #pointDetails .imgContainer" +
      ", .placeMarkBasicInfo" +
      ", .noDetails");
    FLOW.selectedControl.set('detailsPaneVisible', false);
  },

  /**
    Once the view is in the DOM create the map
  */
  didInsertElement: function () {
    var self = this;

    FLOW.initAjaxSetup();

    // create and draw leaflet map
    var map = L.map('flowMap', {scrollWheelZoom: true}).setView([26.11598592533351, 1.9335937499999998], 2);
    var bounds = new L.LatLngBounds(map.getBounds().getSouthWest(), map.getBounds().getNorthEast());
    map.options.maxBoundsViscosity = 1.0;
    map.options.maxBounds = bounds;
    FLOW.drawLeafletMap(map);
    this.map = map;

    //onetime get survey groups
    $.get('/rest/survey_groups'/*place survey_groups endpoint here*/
    , function(surveyGroupsData, status){
      FLOW.selectedControl.set('cartodbMapsSurveyGroups', surveyGroupsData);

      self.insertCartodbMap();

      // add scale indication to map
      L.control.scale({position:'topleft', maxWidth:150}).addTo(self.map);
    });

    this.$('#mapDetailsHideShow').click(function () {
      FLOW.handleShowHideDetails();
    });

    // Slide in detailspane after 1 sec
    FLOW.hideDetailsPane(1000);
  },

  insertCartodbMap: function() {
    var self = this;

    FLOW.initAjaxSetup();

    var filterContent = '<div id="survey_hierarchy" style="float: left"></div>&nbsp;';

    $('#dropdown-holder').prepend(filterContent);
    $('#dropdown-holder').append('<div style="clear: both"></div>');

    FLOW.selectedControl.set('marker', null);
    FLOW.selectedControl.set('cartodbLayer', null);
    FLOW.selectedControl.set('mapZoomLevel', self.map.getZoom());
    FLOW.selectedControl.set('mapCenter', self.map.getCenter());
    FLOW.selectedControl.set('polygons', []);

    self.map.on('click', function(e) {
      if(FLOW.selectedControl.get('marker') != null){
        self.map.removeLayer(FLOW.selectedControl.get('marker'));
        FLOW.hideDetailsPane();
        $('#pointDetails').html('<p class="noDetails">'+Ember.String.loc('_no_details') +'</p>');
      }

      if(FLOW.selectedControl.get('polygons').length > 0){
        for(var i=0; i<FLOW.selectedControl.get('polygons').length; i++){
          self.map.removeLayer(FLOW.selectedControl.get('polygons')[i])
        }
        //restore the previous zoom level and map center
        self.map.setView(FLOW.selectedControl.get('mapCenter'), FLOW.selectedControl.get('mapZoomLevel'));
        FLOW.selectedControl.set('polygons', [])
      }
    });

    self.map.on('zoomend', function() {
      $('body, html, #flowMap').scrollTop(0);
    });

    //manage folder and/or survey selection hierarchy
    FLOW.manageHierarchy(0);

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
          namedMapObject['mapObject'] = self.map;
          namedMapObject['mapName'] = 'data_point_'+keyId;
          namedMapObject['tableName'] = 'data_point';
          namedMapObject['interactivity'] = ["name", "survey_id", "id", "identifier", "lat", "lon"];
          namedMapObject['query'] = 'SELECT * FROM data_point WHERE survey_id='+keyId;

          FLOW.namedMapCheck(namedMapObject);
        }else{ //if a folder is selected, load the folder's children on a new 'folder_survey_selector'
          //first clear any currently overlayed cartodb layer (if any)
          FLOW.selectedControl.set('layerExistsCheck', FLOW.clearCartodbLayer(self.map, FLOW.selectedControl.get('cartodbLayer')));

          for(var i=0; i<FLOW.selectedControl.get('cartodbMapsSurveyGroups')['survey_groups'].length; i++){
            if(FLOW.selectedControl.get('cartodbMapsSurveyGroups')['survey_groups'][i].keyId === parseInt(keyId) && self.lastSelectedElement !== parseInt(keyId)){
              FLOW.manageHierarchy(keyId);
              self.lastSelectedElement = parseInt(keyId);
            }
          }
        }
      }else{ //if nothing is selected, delete all children 'folder_survey_selector's and clear form selector
        FLOW.selectedControl.set('layerExistsCheck', FLOW.clearCartodbLayer(self.map, FLOW.selectedControl.get('cartodbLayer')));
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
          namedMapObject['mapObject'] = self.map;
          namedMapObject['mapName'] = 'raw_data_'+formId;
          namedMapObject['tableName'] = 'raw_data_'+formId;
          namedMapObject['interactivity'] = [];
          namedMapObject['query'] = 'SELECT * FROM raw_data_' + formId;

          if (columnsData.column_names) {
            for (var j=0; j<columnsData['column_names'].length; j++) {
              namedMapObject['interactivity'].push(columnsData['column_names'][j]['column_name']);
            }
          }

          FLOW.namedMapCheck(namedMapObject);
        });
      } else {
        FLOW.selectedControl.set('layerExistsCheck', FLOW.clearCartodbLayer(self.map, 'data_point_'+$(this).data('survey-id')));
      }
    });

    $(document).off('click', '.projectGeoshape').on('click', '.projectGeoshape', function(){
      if(FLOW.selectedControl.get('polygons').length > 0){
        $(this).html(Ember.String.loc('_project_geoshape_onto_main_map'));
        for(var i=0; i<FLOW.selectedControl.get('polygons').length; i++){
          self.map.removeLayer(FLOW.selectedControl.get('polygons')[i]);
        }

        //restore the previous zoom level and map center
        setTimeout(function() {
          self.map.setView(FLOW.selectedControl.get('mapCenter'), FLOW.selectedControl.get('mapZoomLevel'));
        }, 0);

        FLOW.selectedControl.set('polygons', []);
      }else{
        $(this).html(Ember.String.loc('_clear_geoshape_from_main_map'));
        FLOW.projectGeoshape(self.map, FLOW.selectedControl.get('geoshapeCoordinates'));
      }
    });
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

    this.$(document).off('click', '.newCustomMap').on('click', '.newCustomMap', function(){
      if($.active > 0){
        self.refreshIntervalId = setInterval(function () {
          //keep checking if there are any pending ajax requests
          if($.active > 0){
            //keep displaying loading icon
          }else{ //if no pending ajax requests
            self.newCustomMap();
          }
        },2000);
      }else{
        self.newCustomMap();
      }
    });

    this.$(document).off('click', '.editCustomMap').on('click', '.editCustomMap', function(){
      FLOW.selectedControl.set('selectedCustomMap', $(this).data('customMap'));
      FLOW.router.transitionTo('navMaps.customMapEdit');
    });

    this.$(document).off('click', '.viewCustomMap').on('click', '.viewCustomMap', function(){
      FLOW.selectedControl.set('selectedCustomMap', $(this).data('customMap'));
      FLOW.selectedControl.set('selectedCustomMapFormId', $(this).data('formId'));
      FLOW.router.transitionTo('navMaps.customMap');
    });

    this.$(document).off('click', '.deleteCustomMap').on('click', '.deleteCustomMap', function(){
      if(confirm("Are you sure you want to delete this map?")){ //TODO create translation
        $.get(
          '/rest/cartodb/delete_custom_map?map_name='+$(this).data('customMap') ,
          function(response, status){
            //FLOW.router.transitionTo('navMaps.customMapsList');
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
        });
      }
    });
  },

  newCustomMap: function(){
    clearInterval(this.refreshIntervalId); //stop the interval if running
    FLOW.selectedControl.set('selectedCustomMap', null);
    FLOW.router.transitionTo('navMaps.customMapEdit');
  },

  createCustomMapsListTable: function(customMapsData){
    clearInterval(this.refreshIntervalId); //stop the interval if running
    var surveyGroupsData = FLOW.selectedControl.get('cartodbMapsSurveyGroups');
    if(surveyGroupsData.survey_groups){
      $('#customMapsTable').html('');
      for(var i=0; i<customMapsData.custom_maps.length; i++){
        var modifyDate = new Date(customMapsData.custom_maps[i].modify_date);
        var customMapsList = '';
        customMapsList += '<tr>'
          +'<td>'
          +'<a class="viewCustomMap" data-form-id="'+customMapsData.custom_maps[i].form_id
          +'" data-custom-map="'+customMapsData.custom_maps[i].named_map+'">'
          +customMapsData.custom_maps[i].custom_map_title
          +'</a>'
          +'<p>'
          +customMapsData.custom_maps[i].custom_map_description
          +'</p>'
          +'</td>';
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
        customMapsList += '<td  class="action">';
        if(customMapsData.custom_maps[i].form_id !== 0){
          //only allow users who have access to specified form to edit or delete custom map
          for(var j=0; j<surveyGroupsData['survey_groups'].length; j++){
            if(surveyGroupsData['survey_groups'][j]['surveyList'] !== null){
              if(surveyGroupsData['survey_groups'][j]['surveyList'][0].keyId === customMapsData.custom_maps[i].form_id){
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
  lastSelectedElement: 0,
  customMapData: {},
  selectedTable: '', //cartodb table name that custom map is based on
  presetMapStyle: {}, //map style before save
  mapSaved: false, //map style before save

  init: function () {
    this._super();
  },

  /**
    Slide in the map editor pane
  */
  showMapEditorPane: function () {
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
    var map = L.map('customMapEditCanvas', {scrollWheelZoom: true}).setView([26.11598592533351, 1.9335937499999998], 2);
    FLOW.drawLeafletMap(map);

    this.map = map;

    // add scale indication to map
    L.control.scale({position:'topleft', maxWidth:150}).addTo(map);

    self.showMapEditorPane();

    //first assume that we're creating a new map
    FLOW.selectedControl.set('newMap', true);

    //if a new custom map, get a server timestamp to serve as part of the custom map name
    if(FLOW.selectedControl.get('selectedCustomMap') === null){
      $.get('/rest/cartodb/timestamp', function(timestampData){
        FLOW.selectedControl.set('customMapName', 'custom_map_'+timestampData.timestamp);
        //automatically create a named map that's to me customised
        var queryObject = {};
        queryObject['table'] = 'data_point';
        queryObject['column'] = '';
        queryObject['value'] = '';
        FLOW.createNamedMapObject(map, queryObject, ''); //TODO: only create named map object of surveys set as public
        FLOW.selectedControl.set('newMap', false); //immediately set newMap to false because a named map will have a already been created

        //manage folder and/or survey selection hierarchy
        FLOW.manageHierarchy(0);
      });
    }else{
      FLOW.selectedControl.set('newMap', false);
      FLOW.selectedControl.set('customMapName', FLOW.selectedControl.get('selectedCustomMap'));
      //get custom map details
      $.get(
        '/rest/cartodb/custom_map_details?name='+FLOW.selectedControl.get('customMapName')
        , function(data){
          if(data.custom_map_details){
            //set map title and description to selected custom map
            $('#mapTitle').val(data.custom_map_details[0]['custom_map_title']);
            $('#mapDescription').val(data.custom_map_details[0]['custom_map_description']);

            var mapView = JSON.parse(data.custom_map_details[0]['custom_map_view']);
            map.setView(mapView.center, mapView.zoom);

            //if survey is not set, load the root level survey group
            if(data.custom_map_details[0]['survey_id'] == 0){
              FLOW.manageHierarchy(0);
            }else{
              //preload the survey selection with values from current
              self.preLoadSurveySelection(data.custom_map_details[0]);
            }

            //before proceeding to update the map, save the current cartocss first
            self.presetMapStyle = FLOW.namedMapPresetStyle(data.custom_map_details[0]);
          }
      });
      FLOW.createLayer( map, FLOW.selectedControl.get('customMapName')); //load selected map
    }

    //initialise map payloads structures as follows
    self.customMapData['formId'] = 0;
    self.customMapData['surveyId'] = 0;
    self.customMapData['questionId'] = 0;
    self.customMapData['creator'] = FLOW.currentUser.email;
    self.customMapData['customMapTitle'] = '';
    self.customMapData['customMapDescription'] = '';
    self.customMapData['namedMap'] = '';
    self.customMapData['cartocss'] = '';
    self.customMapData['legend'] = {};
    self.customMapData['legend']['title'] = '';
    self.customMapData['legend']['question'] = '';
    self.customMapData['legend']['points'] = '';
    self.customMapData['permission'] = '';
    self.customMapData['newMap'] = '';

    this.$(document).off('change', '.folder_survey_selector').on('change', '.folder_survey_selector',function(e) {
      //remove all 'folder_survey_selector's after current
      FLOW.cleanSurveyGroupHierarchy($(this));

      //first remove previously created form selector elements
      $(".form_selector").remove();
      self.customMapData['formId'] = 0;
      self.customMapData['surveyId'] = 0;
      self.customMapData['questionId'] = 0;
      self.selectedTable = '';

      if($(this).val() !== ""){
        var surveyGroupKeyId = $(this).val();
        //if a survey is selected, load forms to form selector element.
        if($(this).find("option:selected").data('type') === 'PROJECT'){
          self.selectedTable = 'data_point';
          self.customMapData['surveyId'] = $(this).find("option:selected").val();
          $.get('/rest/cartodb/forms?surveyId='+surveyGroupKeyId, function(data, status) {
            var rows = [];
            if(data['forms'] && data['forms'].length > 0) {
              rows = data['forms'];
              rows.sort(function(el1, el2) {
                return FLOW.compare(el1, el2, 'name')
              });

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

          var queryObject = {};
          queryObject['table'] = 'data_point';
          queryObject['column'] = 'survey_id';
          queryObject['value'] = surveyGroupKeyId;
          FLOW.createNamedMapObject(map, queryObject, '');
        }else{ //if a folder is selected, load the folder's children on a new 'folder_survey_selector'
          //first clear any currently overlayed cartodb layer (if any)
          FLOW.selectedControl.set('layerExistsCheck', FLOW.clearCartodbLayer(map, FLOW.selectedControl.get('cartodbLayer')));

          for(var i=0; i<FLOW.selectedControl.get('cartodbMapsSurveyGroups')['survey_groups'].length; i++){
            if(FLOW.selectedControl.get('cartodbMapsSurveyGroups')['survey_groups'][i].keyId === parseInt(surveyGroupKeyId) && self.lastSelectedElement !== parseInt(surveyGroupKeyId)){
              FLOW.manageHierarchy(surveyGroupKeyId);
              self.lastSelectedElement = parseInt(surveyGroupKeyId);
            }
          }

          $('#show-points-number').data('count', 0);
        }
      }else{ //if nothing is selected, delete all children 'folder_survey_selector's and clear form selector
          FLOW.selectedControl.set('layerExistsCheck', FLOW.clearCartodbLayer(map, FLOW.selectedControl.get('cartodbLayer')));

          $('#show-points-number').data('count', 0);
      }

      //hide legend question toggle
      $('#legend-question-toggle').css({display: 'none'});
      $('#legend-question-toggle').data('question', '');
    });

    this.$(document).off('change', '.form_selector').on('change', '.form_selector',function(e) {
      //remove all 'folder_survey_selector's after current
      FLOW.cleanSurveyGroupHierarchy($(this));
      self.customMapData['formId'] = 0;
      self.customMapData['questionId'] = 0;
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
            var selectedFormColumns = response.column_names;

            //get a list of questions from the selected form
            $.get(
              "/rest/cartodb/questions?form_id="+formId,
              function(questionsData, questionsQueryStatus){
                //only list questions which are of type "option"
                for(var i=0; i<questionsData['questions'].length; i++){
                  if(questionsData['questions'][i].type === "OPTION"){
                    //first pull a list of column names from the cartodb table then set the option values to the column names
                    for(var j=0; j<selectedFormColumns.length; j++){
                      if(selectedFormColumns[j]['column_name'].match(questionsData['questions'][i].id)){
                        questionSelector.append('<option value="'
                          + selectedFormColumns[j]['column_name'] + '" data-question-id="'
                          + questionsData['questions'][i].id+'">'
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
        var queryObject = {};
        queryObject['table'] = 'raw_data_'+formId;
        queryObject['column'] = '';
        queryObject['value'] = '';
        FLOW.createNamedMapObject(map, queryObject, '');
      } else {
        FLOW.createLayer(map, FLOW.selectedControl.get('customMapName'));
      }

      //hide legend question toggle
      $('#legend-question-toggle').css({display: 'none'});
      $('#legend-question-toggle').data('question', '');
    });

    this.$(document).off('change', '.question_selector').on('change', '.question_selector',function(e) {
      //remove all 'folder_survey_selector's after current
      FLOW.cleanSurveyGroupHierarchy($(this));
      if ($(this).val() !== "") {
        self.customMapData['questionId'] = $(this).val().substring(1, $(this).val().length);

        var columnName = $(this).val();
        //get a list of distinct values associated with this question
        $.get(
          '/rest/cartodb/distinct?column_name='+$(this).val()+'&form_id='+$('.form_selector').val(),
          function(optionsData){
            if(optionsData.distinct_values){
              for(var i=0; i<optionsData.distinct_values.length; i++){
                var cascadeString = "", cascadeJson;
                if (optionsData.distinct_values[i][$('.question_selector').val()].charAt(0) === '[') {
                  cascadeJson = JSON.parse(optionsData.distinct_values[i][$('.question_selector').val()]);
                  cascadeString = cascadeJson.map(function(item){
                    return item.text;
                  }).join("|");
                } else {
                  cascadeString = optionsData.distinct_values[i][$('.question_selector').val()];
                }

                var colourPicker = $('<div class="form-group"><label id="option_'+i+'_text" for="option_'+i+'">'
                  +cascadeString+'</label></div>');
                var colourPickerInput = $('<input class="question_options" id="option_'+i+'" data-column="'
                  +columnName+'" data-option=\''+optionsData.distinct_values[i][$(".question_selector").val()]
                  +'\' type="color" value="#'+(Math.random()*0xFFFFFF<<0).toString(16)+'" style="padding: 2px !important">');
                colourPicker.append(colourPickerInput);
                $('#survey_hierarchy').append(colourPicker);
              }
            }
          });

          //display legend question toggle
          $('#legend-question-toggle').css({display: 'block'});
          $('#legend-question-toggle').data('question', $(this).find('option:selected').text());
      }else{
        self.customMapData['questionId'] = 0;

        //hide legend question toggle
        $('#legend-question-toggle').css({display: 'none'});
        $('#legend-question-toggle').data('question', '');
      }
    });

    this.$(document).off('click', '#saveCustomMap').on('click', '#saveCustomMap',function(e){
      if($('#mapTitle').val() !== "" && $('#mapDescription').val() !== ""){
        self.mapSaved = true;

        var cartocss = [], current_cartocss = '';
        self.customMapData['customMapTitle'] = $('#mapTitle').val();
        self.customMapData['customMapDescription'] = $('#mapDescription').val();
        self.customMapData['namedMap'] = FLOW.selectedControl.get('customMapName');
        self.presetMapStyle['cartocss'] = '';
        self.presetMapStyle['queryObject'] = {};
        self.presetMapStyle['queryObject']['table'] = ''
        self.presetMapStyle['queryObject']['column'] = '';
        self.presetMapStyle['queryObject']['value'] = '';
        if ($('.question_options').length) {
          $('.question_options').each( function(index) {
            var currentColour = {};
            currentColour['title'] = JSON.stringify($(this).data('option'));
            currentColour['colour'] = $(this).val();
            currentColour['column'] = $(this).data('column');
            cartocss.push(currentColour);

            current_cartocss += '#'+self.selectedTable+'['+$(this).data('column')+'="'+FLOW.addSlashes(JSON.stringify($(this).data('option')))+'"]';
    				current_cartocss += '{';
    				current_cartocss += 'marker-fill: '+$(this).val()+';';
    				current_cartocss += '}';
          });
          self.customMapData['cartocss'] = JSON.stringify(cartocss);
          self.presetMapStyle['cartocss'] = current_cartocss;

          //first update the named map before uploading it to cartodb
          var queryObject = {};
          queryObject['table'] = self.selectedTable;
          queryObject['column'] = '';
          queryObject['value'] = '';
          FLOW.createNamedMapObject(map, queryObject, current_cartocss);
        }

        self.presetMapStyle['queryObject']['table'] = self.selectedTable;
        if(self.customMapData['surveyId'] !== 0 && self.customMapData['formId'] === 0){
          self.presetMapStyle['queryObject']['column'] = 'survey_id';
          self.presetMapStyle['queryObject']['value'] = self.customMapData['surveyId'];
        }

        //if creating a new map set mapType to 'new'
        if(FLOW.selectedControl.get('selectedCustomMap') === null){
          self.customMapData['newMap'] = 'true';
        }else{
          self.customMapData['newMap'] = 'false';
        }
        var customMapView = {}
        customMapView['center'] = [self.map.getCenter().lat, self.map.getCenter().lng];
        customMapView['zoom'] = self.map.getZoom();
        self.customMapData['customMapView'] = JSON.stringify(customMapView);

        //if show legend is checked, populate the legend object
        if($('#show-legend').is(':checked')){
          self.customMapData['legend']['title'] = ($('#show-title').is(':checked')) ? $('#custom-map-title').val() : '';
          self.customMapData['legend']['question'] = ($('#show-question').is(':checked')) ? $('#show-question').data('question') : '';
          self.customMapData['legend']['points'] = ($('#show-points-number').is(':checked')) ? $('#show-points-number').data('count') : '';
          self.customMapData['legend'] = JSON.stringify(self.customMapData['legend']);
        }else{
          self.customMapData['legend'] = '';
        }

        var ajaxObject = {};
        ajaxObject['call'] = "POST";
        ajaxObject['url'] = "/rest/cartodb/edit_custom_map";
        ajaxObject['data'] = JSON.stringify(self.customMapData);

        FLOW.ajaxCall(function(response){
          if(response){
            FLOW.selectedControl.set('selectedCustomMap', FLOW.selectedControl.get('customMapName'));
          }
        }, ajaxObject);
      }else{
        //prompt user to enter a map title and/or description
        alert("Please enter a title and/or description"); //TODO add translation
      }
    });

    this.$(document).off('click', '.backToCustomMaps').on('click', '.backToCustomMaps', function(){
      //update the custom map before going back to the maps list
      if(self.mapSaved){
        FLOW.createNamedMapObject(map, self.presetMapStyle['queryObject'], self.presetMapStyle['cartocss']);
      }
      FLOW.router.transitionTo('navMaps.customMapsList');
    });

    this.$(document).off('change', '.legend-toggle').on('change', '.legend-toggle', function(){
      switch ($(this).attr('id')) {
        case 'show-legend':
          if($(this).is(':checked')){//enable the rest of the legend toggles
            $('#show-title').attr('disabled', false);
            $('#show-question').attr('disabled', false);
            $('#show-points-number').attr('disabled', false);
          }else{//disable the rest of the legend toggles
            $('#show-title').attr('disabled', true);
            $('#show-question').attr('disabled', true);
            $('#show-points-number').attr('disabled', true);
          }
          break;
        case 'show-title':
          if($(this).is(':checked')){
            $('#custom-map-title').attr('disabled', false);
          }else{
            $('#custom-map-title').attr('disabled', true);
          }
          break;
        default:
      }
    });
  },

  preLoadSurveySelection: function(data){
    var self = this, surveyGroups = FLOW.selectedControl.get('cartodbMapsSurveyGroups')['survey_groups'];

    surveyGroups.sort(function(el1, el2) {
      return FLOW.compare(el1, el2, 'name');
    });

    for (var i=0; i<surveyGroups.length; i++) {
      //if a subfolder, only load folders and surveys from parent folder
      if(surveyGroups[i]['keyId'] == data.survey_id){
        //for each of the survey's ancestors, create append its survey group
        for(var j=0; j<surveyGroups[i]['ancestorIds'].length; j++){
          FLOW.manageHierarchy(surveyGroups[i]['ancestorIds'][j]);
          //set selected current survey/folder
          if((j+1) === surveyGroups[i]['ancestorIds'].length){
            $('#selector_'+surveyGroups[i]['ancestorIds'][j]).val(data.survey_id);
            self.customMapData['surveyId'] = data.survey_id;
            self.selectedTable = 'data_point';
            $.get('/rest/cartodb/forms?surveyId='+data.survey_id, function(formsData, status) {
              var rows = [];
              if(formsData['forms'] && formsData['forms'].length > 0) {
                rows = formsData['forms'];
                rows.sort(function(el1, el2) {
                  return FLOW.compare(el1, el2, 'name')
                });

                //create folder and/or survey select element
                var form_selector = $('<select></select>').attr("data-survey-id", data.survey_id).attr("class", "form_selector");
                form_selector.append('<option value="">--' + Ember.String.loc('_choose_a_form') + '--</option>');

                for(var k=0; k<rows.length; k++) {
                  //append returned forms list to the firm selector element
                  form_selector.append(
                    $('<option></option>').val(rows[k]["id"]).html(rows[k]["name"]));
                }
                $("#survey_hierarchy").append(form_selector);

                //if a form ID was set when building the custom map, select it
                if(data.form_id != 0){
                  form_selector.val(data.form_id);
                  self.customMapData['formId'] = data.form_id;
                  self.selectedTable = 'raw_data_'+data.form_id;
                  //create a question selector element
                  var questionSelector = $('<select></select>').attr("class", "question_selector");
                  questionSelector.append('<option value="">--' + Ember.String.loc('_select_option_question') + '--</option>');

                  var ajaxObject = {};
                  ajaxObject['call'] = "GET";
                  ajaxObject['url'] = "/rest/cartodb/columns?table_name=raw_data_"+data.form_id;
                  ajaxObject['data'] = "";
                  FLOW.ajaxCall(function(columnsData){
                    if(columnsData.column_names){
                      var selectedFormColumns = columnsData.column_names;

                      //get a list of questions from the selected form
                      $.get(
                        "/rest/cartodb/questions?form_id="+data.form_id,
                        function(questionsData, questionsQueryStatus){
                          //only list questions which are of type "option"
                          for(var l=0; l<questionsData['questions'].length; l++){
                            if(questionsData['questions'][l].type === "OPTION"){
                              //first pull a list of column names from the cartodb table then set the option values to the column names
                              for(var m=0; m<selectedFormColumns.length; m++){
                                if(selectedFormColumns[m]['column_name'].match(questionsData['questions'][l].id)){
                                  questionSelector.append('<option value="'
                                    + selectedFormColumns[m]['column_name'] + '">'
                                    + questionsData['questions'][l].display_text
                                    + '</option>');
                                }
                              }
                            }
                          }
                          $("#survey_hierarchy").append(questionSelector);

                          //if question ID was set, select it
                          if(data.question_id !=0){
                            questionSelector.val('q'+data.question_id);
                            self.customMapData['questionId'] = data.question_id;
                            //create a list of options and styles based on selected question
                            var cartocssData = JSON.parse(data.cartocss);
                            for(var n=0; n<cartocssData.length; n++){
                              var cascadeString = "", cascadeJson;
                              if (cartocssData[n]['title'].charAt(0) === '[') {
                                cascadeJson = JSON.parse(cartocssData[n]['title']);
                                cascadeString = cascadeJson.map(function(item){
                                  return item.text;
                                }).join("|");
                              } else {
                                cascadeString = cartocssData[n]['title'];
                              }

                              var colourPicker = $('<div class="form-group"><label for="option_'+n+'">'
                                +cascadeString+'</label></div>');
                              var colourPickerInput = $('<input class="question_options" id="option_'+n+'" data-column="q'
                                +data.question_id+'" type="color" data-option=\''+cartocssData[n]['title']
                                +'\' type="text" value="'+cartocssData[n]['colour']+'" style="padding: 2px !important">');
                              colourPicker.append(colourPickerInput);
                              $('#survey_hierarchy').append(colourPicker);
                            }

                            //display legend question toggle
                            $('#legend-question-toggle').css({display: 'block'});
                            $('#legend-question-toggle').data('question', $('.question_selector').find('option:selected').text());
                          }
                        });
                    }
                  }, ajaxObject);
                }
              }
            });
          }else{
            $('#selector_'+surveyGroups[i]['ancestorIds'][j]).val(surveyGroups[i]['ancestorIds'][j+1]);
          }
        }
      }
    }

    if(data.legend != ""){
      var legend = JSON.parse(data.legend);
      $('#show-legend').prop('checked', true);
      if(legend.title != ""){
        $('#show-title').prop('checked', true);
        $('#custom-map-title').val(legend.title);
      }
      if(legend.question != ""){
        $('#show-question').prop('checked', true);
        $('#show-question').data('question', legend.question);
      }
      if(legend.points != "" || legend.points != 0){
        $('#show-points-number').prop('checked', true);
        $('#show-points-number').data('count', legend.points);
      }
    }
  }
});

FLOW.CustomMapView = FLOW.View.extend({
  templateName: 'navMaps/custom-map-view',
  map: null,

  init: function () {
    this._super();

    FLOW.selectedControl.set('layerExistsCheck', false);
    FLOW.selectedControl.set('detailsPaneElements', "#pointDetails h2" +
      ", #pointDetails dl" +
      ", #pointDetails img" +
      ", #pointDetails .imgContainer" +
      ", .placeMarkBasicInfo" +
      ", .noDetails");
    FLOW.selectedControl.set('detailsPaneVisible', false);
  },

  /**
    Once the view is in the DOM create the map
  */
  didInsertElement: function () {
    var self = this, pointDataUrl;

    FLOW.initAjaxSetup();

    // create and draw leaflet map
    var map = L.map('customMapViewCanvas', {scrollWheelZoom: true}).setView([26.11598592533351, 1.9335937499999998], 2);
    FLOW.drawLeafletMap(map);

    FLOW.selectedControl.set('marker', null);
    FLOW.selectedControl.set('cartodbLayer', null);
    FLOW.selectedControl.set('mapZoomLevel', map.getZoom());
    FLOW.selectedControl.set('mapCenter', map.getCenter());
    FLOW.selectedControl.set('polygons', []);

    // add scale indication to map
    L.control.scale({position:'topleft', maxWidth:150}).addTo(map);

    FLOW.createLayer(map, FLOW.selectedControl.get('selectedCustomMap'));

    var surveyGroupsData = FLOW.selectedControl.get('cartodbMapsSurveyGroups');

    //get selected custom map details
    $.get(
      '/rest/cartodb/custom_map_details?name='+FLOW.selectedControl.get('selectedCustomMap')
      , function(data){
        if(data.custom_map_details){
          //set map title and description to selected custom map
          var mapTitle = '<div style="width: 100%; float: left"><h3>'
            +data.custom_map_details[0]['custom_map_title']
            +'</h3></div>';
          var mapDescription = '<div style="width: 100%; float: left"><h4>'
            +data.custom_map_details[0]['custom_map_description']
            +'</h4></div>';
          $('#customMapDetails').html(mapTitle+mapDescription);

          //only allow users who have access to specified survey to edit or delete custom map
          for(var j=0; j<surveyGroupsData['survey_groups'].length; j++){
            if(surveyGroupsData['survey_groups'][j]['surveyList'] !== null){
              if(surveyGroupsData['survey_groups'][j].keyId === data.custom_map_details[0].survey_id
                  || surveyGroupsData['survey_groups'][j].keyId === data.custom_map_details[0].form_id){
                    $('#customMapEditOptions').html('<a class="edit editCustomMap" data-custom-map="'
                      +data.custom_map_details[0]['named_map']+'">'
                      +Ember.String.loc('_edit')
                      +'</a>'
                      +'<a class="remove deleteCustomMap"  data-custom-map="'
                      +data.custom_map_details[0]['named_map']
                      +'">'+Ember.String.loc('_remove')+'</a>');
              }
            }
          }

          var mapView = JSON.parse(data.custom_map_details[0]['custom_map_view']);
          map.setView(mapView.center, mapView.zoom);
        }
    });

    map.on('click', function(e) {
      if(FLOW.selectedControl.get('marker') != null){
        map.removeLayer(FLOW.selectedControl.get('marker'));
        FLOW.hideDetailsPane();
        $('#pointDetails').html('<p class="noDetails">'+Ember.String.loc('_no_details') +'</p>');
      }

      if(FLOW.selectedControl.get('polygons').length > 0){
        for(var i=0; i<FLOW.selectedControl.get('polygons').length; i++){
          map.removeLayer(FLOW.selectedControl.get('polygons')[i]);
        }
        //restore the previous zoom level and map center
        map.setView(FLOW.selectedControl.get('mapCenter'), FLOW.selectedControl.get('mapZoomLevel'));
        FLOW.selectedControl.set('polygons', []);
      }
    });

    map.on('zoomend', function() {
      $('body, html, #customMapViewCanvas').scrollTop(0);
    });

    this.$(document).off('click', '.editCustomMap').on('click', '.editCustomMap', function(){
      FLOW.selectedControl.set('selectedCustomMap', $(this).data('customMap'));
      FLOW.router.transitionTo('navMaps.customMapEdit');
    });

    this.$(document).off('click', '.deleteCustomMap').on('click', '.deleteCustomMap', function(){
      if(confirm("Are you sure you want to delete this map?")){ //TODO create translation
        $.get(
          '/rest/cartodb/delete_custom_map?map_name='+$(this).data('customMap') ,
          function(response, status){
            FLOW.router.transitionTo('navMaps.customMapsList');
        });
      }
    });

    this.$('#mapDetailsHideShow').click(function () {
      FLOW.handleShowHideDetails();
    });

    this.$(document).off('click', '.projectGeoshape').on('click', '.projectGeoshape', function(){
      if(FLOW.selectedControl.get('polygons').length > 0){
        $(this).html(Ember.String.loc('_project_geoshape_onto_main_map'));
        for(var i=0; i<FLOW.selectedControl.get('polygons').length; i++){
          map.removeLayer(FLOW.selectedControl.get('polygons')[i]);
        }
        //restore the previous zoom level and map center
        setTimeout(function() {
          map.setView(FLOW.selectedControl.get('mapCenter'), FLOW.selectedControl.get('mapZoomLevel'));
        }, 0);
        FLOW.selectedControl.set('polygons', []);
      }else{
        $(this).html(Ember.String.loc('_clear_geoshape_from_main_map'));
        FLOW.projectGeoshape(map, FLOW.selectedControl.get('geoshapeCoordinates'));
      }
    });

    // Slide in detailspane after 1 sec
    FLOW.hideDetailsPane(1000);
  }
});
