FLOW.CustomMapEditView = FLOW.View.extend({
  templateName: 'navMaps/custom-map-edit',
  map: null,
  lastSelectedElement: 0,
  customMapData: {},
  selectedTable: '', //cartodb table name that custom map is based on
  presetMapStyle: {}, //map style before save
  customMapName: '',
  tmpCustomMapName: '',
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
    var map =
     L.map('customMapEditCanvas', {scrollWheelZoom: true}).setView([26.11598592533351, 1.9335937499999998], 2);
    FLOW.drawLeafletMap(map);

    this.map = map;

    // add scale indication to map
    L.control.scale({position:'topleft', maxWidth:150}).addTo(map);

    self.showMapEditorPane();

    //first assume that we're creating a new map
    FLOW.selectedControl.set('newMap', true);

    //initially do not allow map to be saved unless a change is made
    FLOW.selectedControl.set('mapChanged', false);

    //get timestamp from server to name the custom map
    $.get(
      '/rest/cartodb/timestamp',
      function(timestampData){
        //set a temporary custom map name
        FLOW.selectedControl.set('tmpCustomMapName', 'tmp_custom_map_'+timestampData.timestamp);
        self.tmpCustomMapName = 'tmp_custom_map_'+timestampData.timestamp;

        if(FLOW.selectedControl.get('selectedCustomMap') === null) {
          $('#manageType').html('<h3>'+Ember.String.loc('_new_custom_map')+'</h3>');
          FLOW.selectedControl.set('customMapName', 'custom_map_'+timestampData.timestamp);
          self.customMapName = 'custom_map_'+timestampData.timestamp;

          //manage folder and/or survey selection hierarchy
          FLOW.manageHierarchy(0);
        } else {
          $('#manageType').html('<h3>'+Ember.String.loc('_edit_custom_map')+'</h3>');
          FLOW.selectedControl.set('newMap', false);
          FLOW.selectedControl.set('customMapName', FLOW.selectedControl.get('selectedCustomMap'));
          self.customMapName = FLOW.selectedControl.get('selectedCustomMap');

          //get custom map details
          $.get(
            '/rest/cartodb/custom_map_details?name='+FLOW.selectedControl.get('customMapName'),
            function(data){
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
          FLOW.createCustomMapLayer( map, FLOW.selectedControl.get('customMapName')); //load selected map
        }
      });

    //initialise map payloads structures as follows
    self.customMapData['formId'] = 0;
    self.customMapData['surveyId'] = 0;
    self.customMapData['questionId'] = 0;
    self.customMapData['creator'] = FLOW.currentUser.email;
    self.customMapData['customMapTitle'] = '';
    self.customMapData['customMapDescription'] = '';
    self.customMapData['namedMap'] = '';
    self.customMapData['cartocss'] = '';
    self.customMapData['legend'] = '';
    self.customMapData['permission'] = '';
    self.customMapData['newMap'] = '';

    this.$(document).off('change', '.folder_survey_selector').on('change', '.folder_survey_selector',function(e) {
      //remove all 'folder_survey_selector's after current
      FLOW.cleanSurveyGroupHierarchy($(this));

      //allow changed map to be saved
      self.activateSaveButton();

      //first remove previously created form selector elements
      $(".form_selector").remove();
      self.customMapData['formId'] = 0;
      self.customMapData['surveyId'] = 0;
      self.customMapData['questionId'] = 0;
      self.selectedTable = '';

      //clear legend
      $('#legendOptions').html('');
      $('#legendQuestion').html('');

      if($(this).val() !== ""){
        var surveyGroupKeyId = $(this).val();
        //if a survey is selected, load forms to form selector element.
        if($(this).find("option:selected").data('type') === 'PROJECT') {
          self.selectedTable = 'data_point';
          self.customMapData['surveyId'] = $(this).find("option:selected").val();
          $.get(
            '/rest/surveys?surveyGroupId='+surveyGroupKeyId,
            function(data, status) {
              var rows = [];
              if(data['surveys'] && data['surveys'].length > 0) {
                rows = data['surveys'];
                rows.sort(function(el1, el2) {
                  return FLOW.compare(el1, el2, 'name')
                });

                //create folder and/or survey select element
                var form_selector = $('<select></select>').attr("data-survey-id", surveyGroupKeyId).attr("class", "form_selector");
                form_selector.append('<option value="">--' + Ember.String.loc('_choose_a_form') + '--</option>');

                var formIds = [];

                for(var i=0; i<rows.length; i++) {
                  //append returned forms list to the firm selector element
                  form_selector.append(
                    $('<option></option>').val(rows[i]["keyId"]).html(rows[i]["name"]));
                    formIds.push(rows[i]["keyId"]);
                }
                $("#survey_hierarchy").append(form_selector);

                for(var i=0; i<formIds.length; i++){
                  if(!(formIds[i] in FLOW.selectedControl.get('questions'))){
                    FLOW.loadQuestions(formIds[i]);
                  }
                }
              }
          });

          var queryObject = {};
          queryObject['table'] = 'data_point';
          queryObject['column'] = 'survey_id';
          queryObject['value'] = surveyGroupKeyId;
          FLOW.createNamedMapObject(map, self.tmpCustomMapName, queryObject, '');

          //load generic data point style
          $('#legendOptions').append('<div class="legend-option"><div class="bullet" style="background: #FF6600; border-radius: 0 !important"></div>'
            +Ember.String.loc('_custom_maps_data_point')+'</div>');
        } else { //if a folder is selected, load the folder's children on a new 'folder_survey_selector'
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
      } else { //if nothing is selected, delete all children 'folder_survey_selector's and clear form selector
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

      //allow changed map to be saved
      self.activateSaveButton();

      self.customMapData['formId'] = 0;
      self.customMapData['questionId'] = 0;
      self.selectedTable = '';

      //clear legend
      $('#legendOptions').html('');
      $('#legendQuestion').html('');

      if ($(this).val() !== "") {
        var formId = $(this).val(), questionsCount = 0;
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

            //get the questions from the selected form
            var questions = FLOW.selectedControl.get('questions')[formId];
            for(var i=0; i<questions.length; i++){
              //only list questions which are type option and single select
              if(questions[i].type === "OPTION" && !questions[i]['allowMultipleFlag']){
                //first pull a list of column names from the cartodb table then set the option values to the column names
                for(var j=0; j<selectedFormColumns.length; j++){
                  if(selectedFormColumns[j]['column_name'].match(questions[i].keyId)){
                    questionsCount++;
                    questionSelector.append('<option value="'
                      + selectedFormColumns[j]['column_name'] + '" data-question-id="'
                      + questions[i].keyId+'">'
                      + questions[i].text
                      + '</option>');
                  }
                }
              }
            }
            if(questionsCount > 0) {
              $("#survey_hierarchy").append(questionSelector);
            }
          }
        }, ajaxObject);
        var queryObject = {};
        queryObject['table'] = 'raw_data_'+formId;
        queryObject['column'] = '';
        queryObject['value'] = '';
        FLOW.createNamedMapObject(map, self.tmpCustomMapName, queryObject, '');
      } else {
        FLOW.createCustomMapLayer(map, FLOW.selectedControl.get('customMapName'));
      }

      //load generic data point style
      $('#legendOptions').append('<div class="legend-option"><div class="bullet" style="background: #FF6600; border-radius: 0 !important"></div>'
        +Ember.String.loc('_custom_maps_data_point')+'</div>');

      //hide legend question toggle
      $('#legend-question-toggle').css({display: 'none'});
      $('#show-question').data('text', '');
    });

    this.$(document).off('change', '.question_selector').on('change', '.question_selector', function(e) {
      //remove all 'folder_survey_selector's after current
      FLOW.cleanSurveyGroupHierarchy($(this));

      //allow changed map to be saved
      self.activateSaveButton();

      //clear legend
      $('#legendOptions').html('');
      $('#legendQuestion').html('');

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
                if (!!optionsData.distinct_values[i][$('.question_selector').val()]) {
                  cascadeString = optionsData.distinct_values[i][$('.question_selector').val()];
                  if(optionsData.distinct_values[i][$('.question_selector').val()].charAt(0) === '['){
                    cascadeJson = JSON.parse(optionsData.distinct_values[i][$('.question_selector').val()]);
                    cascadeString = cascadeJson.map(function(item){
                      return item.text;
                    }).join(" | ");
                  }
                }

                var randomColour = (Math.random()*0xFFFFFF<<0).toString(16);

                var colourPicker = $('<div class="question-option-div point-details-content"><input class="question-option-color-code" data-column="'
                  +columnName+'" data-option=\''+optionsData.distinct_values[i][$(".question_selector").val()]
                  +'\' type="color" value="#'+randomColour+'" style="padding: 2px !important">'+cascadeString+'</div>');
                $('#survey_hierarchy').append(colourPicker);

                $('#legendOptions').append('<div class="legend-option"><div class="bullet" style="background: #'
                  +randomColour+'; border-radius: 0 !important"></div>'
                  +cascadeString+'</div>');
              }
              //trigger function to update apply styles on custom map
              var queryObject = {};
              queryObject['table'] = self.selectedTable;
              queryObject['column'] = '';
              queryObject['value'] = '';
              self.applyStylingChanges(self.tmpCustomMapName, queryObject);
            }
          });

          //display legend question toggle
          $('#legend-question-toggle').css({display: 'block'});
          $('#show-question').data('text', $(this).find('option:selected').text());
          $('#show-question').data('column', $(this).val());
          if($('#show-question').is(':checked')) {
            $('#legendQuestion').html($(this).find('option:selected').text());
          }
      } else {
        self.customMapData['questionId'] = 0;

        //hide legend question toggle
        $('#legend-question-toggle').css({display: 'none'});
        $('#show-question').data('text', '');
      }
    });

    this.$(document).off('change', '.question-option-color-code').on('change', '.question-option-color-code',function(e) {
      //allow changed map to be saved
      self.activateSaveButton();

      $('#legendOptions').html('');
      $('.question-option-color-code').each( function(index) {
        var option = $(this).data('option'), optionJson;
        if (typeof option === 'object') {
          if(JSON.stringify(option).charAt(0) === '['){
            option = $(this).data('option').map(function(item){
              return item.text;
            }).join(" | ");
          }
        }
        $('#legendOptions').append('<div class="legend-option"><div class="bullet" style="background: '
          +$(this).val()+'; border-radius: 0 !important"></div>'
          +option+'</div>');
      });

      //trigger function to update apply styles on custom map
      var queryObject = {};
      queryObject['table'] = self.selectedTable;
      queryObject['column'] = '';
      queryObject['value'] = '';
      self.applyStylingChanges(self.tmpCustomMapName, queryObject);
    });

    this.$(document).off('change', '.legend-toggle').on('change', '.legend-toggle', function() {
      //allow changed map to be saved
      self.activateSaveButton();

      switch ($(this).attr('id')) {
        case 'show-legend':
          if($(this).is(':checked')) {//enable the rest of the legend toggles
            $('#customMapLegend').show();
            $('#show-title').attr('disabled', false);
            $('#show-question').attr('disabled', false);
            $('#show-points-number').attr('disabled', false);
          } else {//disable the rest of the legend toggles
            $('#customMapLegend').hide();
            $('#show-title').attr({'disabled': true, 'checked': false});
            $('#custom-map-title').val('').hide();
            $('#legendTitle').html('');
            $('#show-question').attr({'disabled': true, 'checked': false});
            $('#show-points-number').attr({'disabled': true, 'checked': false});
          }
          break;
        case 'show-title':
          if($(this).is(':checked')) {
            $('#custom-map-title').show();
            $('#legendTitle').html($('#custom-map-title').val());
          } else {
            $('#custom-map-title').val('').hide();
            $('#legendTitle').html('');
          }
          break;
        case 'show-question':
          if($(this).is(':checked')) {
            $('#legendQuestion').html($('#show-question').data('text'));
          } else {
            $('#legendQuestion').html('');
          }
          break;
        default:
      }
    });

    this.$(document).off('change', '#custom-map-title').on('change', '#custom-map-title',function(e) {
      $('#legendTitle').html($(this).val());
    });

    this.$(document).off('change', '.map-details').on('change', '.map-details',function(e) {
      //allow changed map to be saved
      self.activateSaveButton();
    });

    this.$(document).off('click', '#saveCustomMap').on('click', '#saveCustomMap',function(e) {
      if(self.customMapComplete()) {
        self.mapSaved = true;

        var cartocss = [];
        self.customMapData['customMapTitle'] = $('#mapTitle').val();
        self.customMapData['customMapDescription'] = $('#mapDescription').val();
        self.customMapData['namedMap'] = self.customMapName;
        self.presetMapStyle['cartocss'] = '';
        self.presetMapStyle['queryObject'] = {};
        self.presetMapStyle['queryObject']['table'] = ''
        self.presetMapStyle['queryObject']['column'] = '';
        self.presetMapStyle['queryObject']['value'] = '';
        if ($('.question-option-color-code').length) {
          var currentCartocss = '';
          $('.question-option-color-code').each( function(index) {
            var currentColour = {}, currentOption = $(this).data('option');
            currentOption = (typeof currentOption === 'object') ? JSON.stringify(currentOption) : currentOption;
            currentColour['title'] = currentOption;
            currentColour['colour'] = $(this).val();
            currentColour['column'] = $(this).data('column');
            cartocss.push(currentColour);

            currentCartocss += '#'+self.selectedTable+'['+$(this).data('column')+'='
              +((currentOption == null || currentOption == '')
                ? (currentOption == '')
                  ? ''
                    : 'null'
                      : '"'+((currentOption.charAt(0) === '[') ? FLOW.addSlashes(currentOption) : currentOption)+'"')
              +']';
            currentCartocss += '{';
            currentCartocss += 'marker-fill: '+$(this).val()+';';
            currentCartocss += '}';
          });
          self.customMapData['cartocss'] = JSON.stringify(cartocss);
          self.presetMapStyle['cartocss'] = currentCartocss;
        }

        //first update the named map before uploading it to cartodb
        var queryObject = {};
        queryObject['table'] = self.selectedTable;
        queryObject['column'] = (self.customMapData['surveyId'] !== 0 && self.customMapData['formId'] === 0) ? 'survey_id' : '';
        queryObject['value'] = (self.customMapData['surveyId'] !== 0 && self.customMapData['formId'] === 0) ? self.customMapData['surveyId']: '';
        self.applyStylingChanges(self.customMapName, queryObject);

        self.presetMapStyle['queryObject']['table'] = self.selectedTable;
        if(self.customMapData['surveyId'] !== 0 && self.customMapData['formId'] === 0) {
          self.presetMapStyle['queryObject']['column'] = 'survey_id';
          self.presetMapStyle['queryObject']['value'] = self.customMapData['surveyId'];
        }

        //if creating a new map set mapType to 'new'
        if(FLOW.selectedControl.get('selectedCustomMap') === null) {
          self.customMapData['newMap'] = 'true';
        } else {
          self.customMapData['newMap'] = 'false';
        }
        var customMapView = {}
        customMapView['center'] = [self.map.getCenter().lat, self.map.getCenter().lng];
        customMapView['zoom'] = self.map.getZoom();
        self.customMapData['customMapView'] = JSON.stringify(customMapView);

        //if show legend is checked, populate the legend object
        if($('#show-legend').is(':checked')) {
          self.customMapData['legend'] = {};
          self.customMapData['legend']['title'] = ($('#show-title').is(':checked')) ? $('#custom-map-title').val() : '';
          self.customMapData['legend']['question'] = {};
          self.customMapData['legend']['question']['text'] = ($('#show-question').is(':checked')) ? $('#show-question').data('text') : '';
          self.customMapData['legend']['question']['column'] = ($('#show-question').is(':checked')) ? $('#show-question').data('column') : '';
          self.customMapData['legend']['points'] = ($('#show-points-number').is(':checked')) ? 'true' : 'false';
          self.customMapData['legend'] = JSON.stringify(self.customMapData['legend']);
        } else {
          self.customMapData['legend'] = '';
        }

        var ajaxObject = {};
        ajaxObject['call'] = "POST";
        ajaxObject['url'] = "/rest/cartodb/edit_custom_map";
        ajaxObject['data'] = JSON.stringify(self.customMapData);

        FLOW.ajaxCall(function(response){
          if(response) {
            FLOW.selectedControl.set('selectedCustomMap', FLOW.selectedControl.get('customMapName'));
            self.deactivateSaveButton();
          }
        }, ajaxObject);
      }
    });

    this.$(document).off('click', '.backToCustomMaps').on('click', '.backToCustomMaps', function(){
      //update the custom map before going back to the maps list
      if(self.mapSaved) {
        //TODO add logic to detect if changes have been made to the map but not saved
      }
      FLOW.router.transitionTo('navMaps.customMapsList');
    });
  },

  applyStylingChanges: function(mapName, queryObject){
    var self = this, currentCartocss = '';
    $('.question-option-color-code').each( function(index) {
      var currentOption = $(this).data('option');
      currentOption = (typeof currentOption === 'object') ? JSON.stringify(currentOption) : currentOption;

      currentCartocss += '#'+self.selectedTable+'['+$(this).data('column')+'='
        +((currentOption == null || currentOption == '')
          ? (currentOption == '')
            ? ''
              : 'null'
                : '"'+((currentOption.charAt(0) === '[') ? FLOW.addSlashes(currentOption) : currentOption)+'"')
        +']';
      currentCartocss += '{';
      currentCartocss += 'marker-fill: '+$(this).val()+';';
      currentCartocss += '}';
    });
    FLOW.createNamedMapObject(self.map, mapName, queryObject, currentCartocss);
  },

  preLoadSurveySelection: function(data){
    var self = this, surveyGroups = FLOW.selectedControl.get('cartodbMapsSurveyGroups')['survey_groups'];

    surveyGroups.sort(function(el1, el2) {
      return FLOW.compare(el1, el2, 'name');
    });

    for (var i=0; i<surveyGroups.length; i++) {
      //if a subfolder, only load folders and surveys from parent folder
      if(surveyGroups[i]['keyId'] == data.survey_id) {
        //for each of the survey's ancestors, create append its survey group
        for(var j=0; j<surveyGroups[i]['ancestorIds'].length; j++){
          FLOW.manageHierarchy(surveyGroups[i]['ancestorIds'][j]);
          //set selected current survey/folder
          if((j+1) === surveyGroups[i]['ancestorIds'].length){
            $('#selector_'+surveyGroups[i]['ancestorIds'][j]).val(data.survey_id);
            self.customMapData['surveyId'] = data.survey_id;
            self.selectedTable = 'data_point';
            $.get(
              '/rest/surveys?surveyGroupId='+data.survey_id,
              function(formsData, status) {
                var rows = [];
                if(formsData['surveys'] && formsData['surveys'].length > 0) {
                  rows = formsData['surveys'];
                  rows.sort(function(el1, el2) {
                    return FLOW.compare(el1, el2, 'name')
                  });

                  //create folder and/or survey select element
                  var form_selector = $('<select></select>').attr("data-survey-id", data.survey_id).attr("class", "form_selector");
                  form_selector.append('<option value="">--' + Ember.String.loc('_choose_a_form') + '--</option>');

                  var formIds = [];
                  for(var k=0; k<rows.length; k++) {
                    //append returned forms list to the firm selector element
                    form_selector.append(
                      $('<option></option>').val(rows[k]["keyId"]).html(rows[k]["name"]));
                      formIds.push(rows[k]["keyId"]);
                  }
                  $("#survey_hierarchy").append(form_selector);

                  for(var k=0; k<formIds.length; k++){
                    if(!(formIds[k] in FLOW.selectedControl.get('questions'))){
                      FLOW.loadQuestions(formIds[k]);
                    }
                  }

                  //load generic data point style
                  $('#legendOptions').append('<div class="legend-option"><div class="bullet" style="background: #FF6600; border-radius: 0 !important"></div>'
                    +Ember.String.loc('_custom_maps_data_point')+'</div>');

                  //if a form ID was set when building the custom map, select it
                  if(data.form_id != 0){
                    //clear legend options div
                    $('#legendOptions').html('');

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

                        if($.active > 0){
                    			var refreshIntervalId = setInterval(function () {
                    				//keep checking if there are any pending ajax requests
                    				if($.active > 0){
                    					//keep displaying loading icon
                    				}else{ //if no pending ajax requests
                              clearInterval(refreshIntervalId);
                              self.populateQuestionOptions(data, selectedFormColumns, questionSelector);
                    				}
                    		  },500);
                    		}else{
                    			//call function to display the clicked point details
                          self.populateQuestionOptions(data, selectedFormColumns, questionSelector);
                    		}

                        //load generic data point style
                        $('#legendOptions').append('<div class="legend-option"><div class="bullet" style="background: #FF6600; border-radius: 0 !important"></div>'
                          +Ember.String.loc('_custom_maps_data_point')+'</div>');

                        //if question ID was set, select it
                        if(data.question_id !=0){
                          //clear legend options div
                          $('#legendOptions').html('');

                          self.customMapData['questionId'] = data.question_id;
                          //create a list of options and styles based on selected question
                          var cartocssData = JSON.parse(data.cartocss);
                          for(var n=0; n<cartocssData.length; n++){
                            var cascadeString = "", cascadeJson;
                            if (cartocssData[n]['title'].charAt(0) === '[') {
                              cascadeJson = JSON.parse(cartocssData[n]['title']);
                              cascadeString = cascadeJson.map(function(item){
                                return item.text;
                              }).join(" | ");
                            } else {
                              cascadeString = cartocssData[n]['title'];
                            }

                            var colourPicker = $('<div class="question-option-div point-details-content"><input class="question-option-color-code" data-column="q'
                              +data.question_id+'" type="color" data-option=\''+cartocssData[n]['title']
                              +'\' type="text" value="'+cartocssData[n]['colour']+'" style="padding: 2px !important">'
                              +cascadeString+'</div>');
                            $('#survey_hierarchy').append(colourPicker);

                            $('#legendOptions').append('<div class="legend-option"><div class="bullet" style="background: '
                              +cartocssData[n]['colour']+'; border-radius: 0 !important"></div>'
                              +cascadeString+'</div>');
                          }

                          //display legend question toggle
                          $('#legend-question-toggle').css({display: 'block'});
                          $('#legend-question-toggle').data('question', $('.question_selector').find('option:selected').text());
                        }
                      }
                    }, ajaxObject);
                  }
                }
            });
          } else {
            $('#selector_'+surveyGroups[i]['ancestorIds'][j]).val(surveyGroups[i]['ancestorIds'][j+1]);
          }
        }
      }
    }

    if(data.legend != "") {
      var legend = JSON.parse(data.legend);
      $('#show-legend').prop('checked', true);
      $('#show-title').attr('disabled', false);
      $('#show-question').attr('disabled', false);
      $('#show-points-number').attr('disabled', false);
      $('#customMapLegend').show();
      if(legend.title != "") {
        $('#show-title').prop('checked', true);
        $('#custom-map-title').show().val(legend.title);
        $('#legendTitle').html(legend.title);
      }
      if(legend.question != "") {
        $('#show-question').prop('checked', true);
        $('#show-question').data('text', legend.question.text);
        $('#show-question').data('column', legend.question.column);
        $('#legendQuestion').html(legend.question.text);
      }
      if(legend.points == "true") {
        $('#show-points-number').prop('checked', true);
      }
    }
  },

  populateQuestionOptions: function(data, selectedFormColumns, questionSelector) {
    //get the questions from the selected form
    var questions = FLOW.selectedControl.get('questions')[data.form_id];
    for(var i=0; i<questions.length; i++){
      //only list questions which are type option and single select
      if(questions[i].type === "OPTION" && !questions[i]['allowMultipleFlag']){
        var questionsCount = 0;
        for(var j=0; j<selectedFormColumns.length; j++){
          if(selectedFormColumns[j]['column_name'].match(questions[i].keyId)){
            questionsCount++;
            questionSelector.append('<option value="'
              + selectedFormColumns[j]['column_name'] + '" data-question-id="'
              + questions[i].keyId+'">'
              + questions[i].text
              + '</option>');
          }
        }
      }
    }
    if(questionsCount > 0) {
      questionSelector.insertAfter($('.form_selector'));
      if(data.question_id != 0) {
        questionSelector.val('q'+data.question_id);
      }
    }
  },

  customMapComplete: function(){
    if(!FLOW.selectedControl.get('mapChanged')) {
      FLOW.dialogControl.set('activeAction', 'ignore');
      FLOW.dialogControl.set('header', Ember.String.loc('_custom_maps_no_changes'));
      FLOW.dialogControl.set('message', Ember.String.loc('_custom_man_make_changes'));
      FLOW.dialogControl.set('showCANCEL', false);
      FLOW.dialogControl.set('showDialog', true);
      return false;
    }
    if($('#mapTitle').val() === "") {
      FLOW.dialogControl.set('activeAction', 'ignore');
      FLOW.dialogControl.set('header', Ember.String.loc('_custom_maps_incomplete_map'));
      FLOW.dialogControl.set('message', Ember.String.loc('_custom_maps_enter_map_name'));
      FLOW.dialogControl.set('showCANCEL', false);
      FLOW.dialogControl.set('showDialog', true);
      return false;
    }
    if(this.customMapData['surveyId'] == 0) {
      FLOW.dialogControl.set('activeAction', 'ignore');
      FLOW.dialogControl.set('header', Ember.String.loc('_custom_maps_incomplete_map'));
      FLOW.dialogControl.set('message', Ember.String.loc('_custom_maps_select_survey'));
      FLOW.dialogControl.set('showCANCEL', false);
      FLOW.dialogControl.set('showDialog', true);
      return false;
    }
    return true;
  },

  deactivateSaveButton: function() {
    if(!$('#saveCustomMap').hasClass('deactivate-save-button')) {
      $('#saveCustomMap').addClass('deactivate-save-button');
    }
  },

  activateSaveButton: function() {
    FLOW.selectedControl.set('mapChanged', true);
    $('#saveCustomMap').removeClass('deactivate-save-button');
  }
});
