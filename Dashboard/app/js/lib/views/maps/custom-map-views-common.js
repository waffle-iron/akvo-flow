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

    //create payloads structures as follows
    var testPostData = {};
    testPostData['formId'] = 0;
    testPostData['creator'] = FLOW.currentUser.email;
    testPostData['customMapTitle'] = '';
    testPostData['customMapDescription'] = '';
    testPostData['cartocss'] = '';
    testPostData['legend'] = '';
    testPostData['permission'] = '';

    //manage folder and/or survey selection hierarchy
    self.checkHierarchy(0);

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
              var form_selector = $('<select></select>').attr("data-survey-id", keyId).attr("class", "form_selector");
              form_selector.append('<option value="">--' + Ember.String.loc('_choose_a_form') + '--</option>');

              for(var i=0; i<rows.length; i++) {
                //append returned forms list to the firm selector element
                form_selector.append(
                  $('<option></option>').val(rows[i]["id"]).html(rows[i]["name"]));
              }
              $("#survey_hierarchy").append(form_selector);
            }
          });

          /*Build a (temporary) named map based on currently selected survey*/
          var namedMapObject = {};
          namedMapObject['tableName'] = 'data_point';
          namedMapObject['interactivity'] = [];
          namedMapObject['query'] = self.buildQuery('data_point', 'survey_id', keyId);

          //get a list of column names to be used for interactivity
          $.get('/rest/cartodb/columns?table_name=data_point', function(columnsData){
            if (columnsData.column_names) {
              for (var j=0; j<columnsData['column_names'].length; j++) {
                namedMapObject['interactivity'].push(columnsData['column_names'][j]['column_name']);
              }
            }
          });

          //self.namedMapCheck(namedMapObject);
        }else{ //if a folder is selected, load the folder's children on a new 'folder_survey_selector'
          //first clear any currently overlayed cartodb layer (if any)
          //self.clearCartodbLayer();

          var hierarchyObject = self.hierarchyObject;

          for(var i=0; i<hierarchyObject.length; i++){
            if(hierarchyObject[i].keyId === parseInt(keyId) && self.lastSelectedElement !== parseInt(keyId)){
              self.checkHierarchy(keyId);
              self.lastSelectedElement = parseInt(keyId);
            }
          }
        }
      }else{ //if nothing is selected, delete all children 'folder_survey_selector's and clear form selector
        //self.clearCartodbLayer();
      }

    });

    $(document).off('change', '.form_selector').on('change', '.form_selector',function(e) {
      //remove all 'folder_survey_selector's after current
      FLOW.cleanSurveyGroupHierarchy($(this));

      if ($(this).val() !== "") {
        var formId = $(this).val();

        //create a question selector element
        var question_selector = $('<select></select>').attr("class", "question_selector");
        question_selector.append('<option value="">--' + Ember.String.loc('_select_option_question') + '--</option>');

        //get a list of questions from the selected form
        $.get(
          "/rest/cartodb/questions?form_id="+formId,
          function(questionsData, status){
            //only list questions which are of type "option"
            for(var i=0; i<questionsData['questions'].length; i++){
              if(questionsData['questions'][i].type === "OPTION"){
                question_selector.append('<option value="'
                  + questionsData['questions'][i].id + '">'
                  + questionsData['questions'][i].display_text
                  + '</option>');
              }
            }
            $("#survey_hierarchy").append(question_selector);
          });

        //get list of columns to be added to new named map's interactivity
        $.get("/rest/cartodb/columns?form_id="+formId, function(columnsData) {
          var namedMapObject = {};
          namedMapObject['mapObject'] = map;
          namedMapObject['mapName'] = "raw_data_"+formId;
          namedMapObject['tableName'] = "raw_data_"+formId;
          namedMapObject['interactivity'] = [];
          namedMapObject['query'] = "SELECT * FROM raw_data_" + formId;

          if (columnsData.column_names) {
            for (var j=0; j<columnsData['column_names'].length; j++) {
              namedMapObject['interactivity'].push(columnsData['column_names'][j]['column_name']);
            }
          }

          //self.namedMapCheck(namedMapObject);
        });
      } else {
        //self.createLayer(map, "data_point_"+$(this).data('survey-id'), "");
      }
    });

    //post request test
    /*$.ajax({
      type: 'POST',
      contentType: "application/json",
      url: '/rest/cartodb/new_custom_map',
      data: JSON.stringify(testPostData), //turns out you need to stringify the payload before sending it
      dataType: 'json',
      success: function(customMapData){
        console.log(customMapData)
      }
    });*/
  },

  checkHierarchy: function(parentFolderId){
    var self = this;

    //if survey hierarchy object has previously been retrieved, no need to pull it anew
    if(self.hierarchyObject.length > 0){
      self.manageHierarchy(parentFolderId);
    }else{
      $.get('http://localhost:8080/akvo_flow_api/index.php/survey_groups/akvoflow-uat1'
      //$.get('/rest/survey_groups'/*place survey_groups endpoint here*/
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

  buildQuery: function(table, column, value){
    var query = "";
    if(column !== ""){
      query += "SELECT * FROM "+table+" WHERE "+column+" = '"+value+"'";
    }
    return query;
  }
});
