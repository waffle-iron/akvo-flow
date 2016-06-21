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
    FLOW.selectedControl.set('questions', {});
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

    //if survey groups have previously been retrieved, proceed to load map
    if(typeof FLOW.selectedControl.get('cartodbMapsSurveyGroups') !== 'undefined'){
      self.insertCartodbMap();

      // add scale indication to map
      L.control.scale({position:'topleft', maxWidth:150}).addTo(self.map);
    }else{
      //onetime get survey groups
      $.get(
        '/rest/survey_groups', /*place survey_groups endpoint here*/
        function(surveyGroupsData, status){
          FLOW.selectedControl.set('cartodbMapsSurveyGroups', surveyGroupsData);

          self.insertCartodbMap();

          // add scale indication to map
          L.control.scale({position:'topleft', maxWidth:150}).addTo(self.map);
        });
    }

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
      $('#mapDetailsHideShow').hide(); //hide the detail panel toggle
      FLOW.clearMap(self.map); //remove any previously loaded point data
    });

    self.map.on('zoomend', function() {
      $('body, html, #flowMap').scrollTop(0);
    });

    //manage folder and/or survey selection hierarchy
    FLOW.manageHierarchy(0);

    $(document).off('change', '.folder_survey_selector').on('change', '.folder_survey_selector',function(e) {
      $('#mapDetailsHideShow').hide(); //hide the detail panel toggle
      FLOW.clearMap(self.map); //remove any previously loaded point data
      $('#form_selector option[value!=""]').remove();

      //remove all 'folder_survey_selector's after current
      FLOW.cleanSurveyGroupHierarchy($(this));

      //first remove previously created form selector elements
      $(".form_selector").remove();

      if($(this).val() !== ""){
        var keyId = $(this).val();
        //if a survey is selected, load forms to form selector element.
        if($(this).find("option:selected").data('type') === 'PROJECT'){
          $.get(
            '/rest/surveys?surveyGroupId='+keyId,
            function(data, status) {
              var rows = [];
              if(data['surveys'] && data['surveys'].length > 0) {
                rows = data['surveys'];
                rows.sort(function(el1, el2) {
                  return FLOW.compare(el1, el2, 'name')
                });

                //create folder and/or survey select element
                var form_selector = $("<select></select>").attr("data-survey-id", keyId).attr("class", "form_selector");
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
      $('#mapDetailsHideShow').hide(); //hide the detail panel toggle
      FLOW.clearMap(self.map); //remove any previously loaded point data

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

    $(document).off('click', '.project-geoshape').on('click', '.project-geoshape', function(){
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
        FLOW.projectGeoshape(self.map, $(this).data('geoshape-object'));
      }
    });
  }
});
