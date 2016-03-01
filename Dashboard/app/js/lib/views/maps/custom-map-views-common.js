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

    this.$(document).off('change', '.folder_survey_selector').on('change', '.folder_survey_selector',function(e) {

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

    this.$(document).off('change', '.form_selector').on('change', '.form_selector',function(e) {
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

    this.$(document).off('click', '.projectGeoshape').on('click', '.projectGeoshape', function(){
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
      FLOW.selectedControl.set('selectedCustomMap', null);
      FLOW.router.transitionTo('navMaps.customMapEdit');
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
      console.log("Am executing even though I shouldn't be");
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
        /*customMapsList += '<td>'+modifyDate.toUTCString()+'</td>'
          +'<td>'+customMapsData.custom_maps[i].creator+'</td>';*/
        customMapsList += '<td  class="action">';
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
  lastSelectedElement: 0,
  customMapData: {},
  selectedTable: '', //cartodb table name that custom map is based on
  selectedFormColumns: null,

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
    var map = L.map('flowMap', {scrollWheelZoom: true}).setView([26.11598592533351, 1.9335937499999998], 2);
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
      });
    }else{
      FLOW.selectedControl.set('newMap', false);
      FLOW.selectedControl.set('customMapName', FLOW.selectedControl.get('selectedCustomMap'));
      //get custom map details
      $.get(
        '/rest/cartodb/custom_map_details?name='+FLOW.selectedControl.get('customMapName')
        , function(customMapDetailsData){
          if(customMapDetailsData.custom_map_details){
            //set map title and description to selected custom map
            $('#mapTitle').val(customMapDetailsData.custom_map_details[0]['custom_map_title']);
            $('#mapDescription').val(customMapDetailsData.custom_map_details[0]['custom_map_description']);
          }
      });
      FLOW.createLayer( map, FLOW.selectedControl.get('customMapName')); //load selected map
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
    FLOW.manageHierarchy(0);

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
        }
      }else{ //if nothing is selected, delete all children 'folder_survey_selector's and clear form selector
          FLOW.selectedControl.set('layerExistsCheck', FLOW.clearCartodbLayer(map, FLOW.selectedControl.get('cartodbLayer')));
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
        var queryObject = {};
        queryObject['table'] = 'raw_data_'+formId;
        queryObject['column'] = '';
        queryObject['value'] = '';
        FLOW.createNamedMapObject(map, queryObject, '');
      } else {
        FLOW.createLayer(map, FLOW.selectedControl.get('customMapName'));
      }
    });

    $(document).off('change', '.question_selector').on('change', '.question_selector',function(e) {
      if ($(this).val() !== "") {
        var columnName = $(this).val();
        //get a list of distinct values associated with this question
        $.get(
          '/rest/cartodb/distinct?column_name='+$(this).val()+'&form_id='+$('.form_selector').val(),
          function(optionsData){
            if(optionsData.distinct_values){
              var styleSelector = $('<div></div>').attr("class", "style_selector");
              for(var i=0; i<optionsData.distinct_values.length; i++){
                /*var colourPicker = $('<div class="form-group"><label for="option_'+i+'">'
                  +optionsData.distinct_values[i][$('.question_selector').val()]+'</label></div>');
                var colourPickerInput = $('<input class="question_options" id="option_'+i+'" data-column="'
                  +columnName+'" data-option="'+optionsData.distinct_values[i][$(".question_selector").val()]
                  +'" type="text" value="'+(Math.random()*0xFFFFFF<<0).toString(16)+'">');
                colourPicker.append(colourPickerInput);
                $('#survey_hierarchy').append(colourPicker);
                colourPickerInput.minicolors({});
                colourPickerInput.minicolors('value', (Math.random()*0xFFFFFF<<0).toString(16));*/
                var colourPicker = '<div id="preview-'+i+'" class="picker-preview"></div>'
                +'<div class="picker" id="picker-'+i+'" style="display:none">'
                +'<canvas id="picker-canvas-'+i+'" class="picker-canvas" var="3" height="256px" width="256px"></canvas>'
                +'<div class="picker-controls">'
                +'<div><label>R</label> <input type="text" id="rVal'+i+'" /></div>'
                +'<div><label>G</label> <input type="text" id="gVal'+i+'" /></div>'
                +'<div><label>B</label> <input type="text" id="bVal'+i+'" /></div>'
                +'<div><label>RGB</label> <input type="text" id="rgbVal'+i+'" /></div>'
                +'<div><label>HEX</label> <input type="text" id="hexVal'+i+'" /></div>'
                +'</div>'
                +'</div>';
                styleSelector.append(colourPicker);
              }
              $('#survey_hierarchy').append(colourPicker);
              self.initColourPicker(optionsData.distinct_values);
            }
          });
      }
    });

    $(document).off('click', '#saveCustomMap').on('click', '#saveCustomMap',function(e){
      if($('#mapTitle').val() !== "" && $('#mapDescription').val() !== ""){

        var cartocss = [], current_cartocss = '';
        self.customMapData['customMapTitle'] = $('#mapTitle').val();
        self.customMapData['customMapDescription'] = $('#mapDescription').val();
        self.customMapData['namedMap'] = FLOW.selectedControl.get('customMapName');
        if ($('.question_options').length) {
          $('.question_options').each( function() {
            var currentColour = {};
            currentColour['title'] = $(this).data('option');
            currentColour['colour'] = $(this).val();
            cartocss.push(currentColour);

            current_cartocss += '#'+self.selectedTable+'['+$(this).data('column')+'="'+$(this).data('option')+'"]';
    				current_cartocss += '{';
    				current_cartocss += 'marker-fill: '+$(this).val()+';';
    				current_cartocss += '}';
          });
          self.customMapData['cartocss'] = JSON.stringify(cartocss);

          //first update the named map before uploading it to cartodb
          var queryObject = {};
          queryObject['table'] = self.selectedTable;
          queryObject['column'] = '';
          queryObject['value'] = '';
          FLOW.createNamedMapObject(map, queryObject, current_cartocss);
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
            FLOW.selectedControl.set('selectedCustomMap', FLOW.selectedControl.get('customMapName'));
          }
        }, ajaxObject);
      }else{
        //prompt user to enter a map title and/or description
        alert("Please enter a title and/or description"); //TODO add translation
      }
    });
  },

  initColourPicker: function(options){
    var bCanPreview = {};
    //loop through optionsData
    for(var i=0; i<options.length; i++){
      bCanPreview['picker'+i] = true; // can preview

      // create canvas and context objects
      var canvas = $('#picker'+i);
      var ctx = canvas.getContext('2d');

      // drawing active image
      var image = new Image();
      image.onload = function () {
          ctx.drawImage(image, 0, 0, image.width, image.height); // draw the image on the canvas
      }

      // select desired colorwheel
      var imageSrc='images/colour-picker-saturation.png';
      image.src = imageSrc;

      $('#picker-canvas-'+i).mousemove(function(e) { // mouse move handler
          if (bCanPreview['picker'+i]) {
              // get coordinates of current position
              var canvasOffset = $(canvas).offset();
              var canvasX = Math.floor(e.pageX - canvasOffset.left);
              var canvasY = Math.floor(e.pageY - canvasOffset.top);

              // get current pixel
              var imageData = ctx.getImageData(canvasX, canvasY, 1, 1);
              var pixel = imageData.data;

              // update preview color
              var pixelColor = 'rgb('+pixel[0]+', '+pixel[1]+', '+pixel[2]+')';
              $('#preview-'+i).css('backgroundColor', pixelColor);

              // update controls
              $('#rVal'+i).val(pixel[0]);
              $('#gVal'+i).val(pixel[1]);
              $('#bVal'+i).val(pixel[2]);
              $('#rgbVal'+i).val(pixel[0]+','+pixel[1]+','+pixel[2]);

              var dColor = pixel[2] + 256 * pixel[1] + 65536 * pixel[0];
              $('#hexVal'+i).val('#' + ('0000' + dColor.toString(16)).substr(-6));
          }
      });
      $('#picker-canvas-'+i).click(function(e) { // click event handler
          bCanPreview['picker'+i] = !bCanPreview['picker'+i];
      });
      $('#picker-preview-'+i).click(function(e) { // preview click
          $('#picker-'+i).fadeToggle('slow', 'linear');
          bCanPreview['picker'+i] = true;
      });
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
    var map = L.map('flowMap', {scrollWheelZoom: true}).setView([26.11598592533351, 1.9335937499999998], 2);
    FLOW.drawLeafletMap(map);

    FLOW.selectedControl.set('marker', null);
    FLOW.selectedControl.set('cartodbLayer', null);
    FLOW.selectedControl.set('mapZoomLevel', map.getZoom());
    FLOW.selectedControl.set('mapCenter', map.getCenter());
    FLOW.selectedControl.set('polygons', []);

    // add scale indication to map
    L.control.scale({position:'topleft', maxWidth:150}).addTo(map);

    FLOW.createLayer(map, FLOW.selectedControl.get('selectedCustomMap'));

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
      $('body, html, #flowMap').scrollTop(0);
    });

    this.$(document).off('click', '.editCustomMap').on('click', '.editCustomMap', function(){
      FLOW.selectedControl.set('selectedCustomMap', $(this).data('customMap'));
      FLOW.router.transitionTo('navMaps.customMapEdit');
    });

    this.$(document).off('click', '.deleteCustomMap').on('click', '.deleteCustomMap', function(){
      console.log("Can confirm, am the one who should be executing");
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
