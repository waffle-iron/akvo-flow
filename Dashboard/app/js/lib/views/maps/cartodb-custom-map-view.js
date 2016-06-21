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
      '/rest/cartodb/custom_map_details?name='+FLOW.selectedControl.get('selectedCustomMap'),
      function(data) {
        if(data.custom_map_details) {
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
            if(surveyGroupsData['survey_groups'][j]['surveyList'] !== null) {
              if(surveyGroupsData['survey_groups'][j].keyId === data.custom_map_details[0].survey_id) {
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

          //display legend if available
          if(data.custom_map_details[0]['legend'] != "") {
            var legend = JSON.parse(data.custom_map_details[0]['legend']);

            $('#customMapLegend').show();
            $('#legendTitle').html(legend.title);
            $('#legendQuestion').html(legend.question.text);

            if(data.custom_map_details[0]['cartocss'] != "") {
              var style = JSON.parse(data.custom_map_details[0]['cartocss']);
              for(var n=0; n<style.length; n++){
                var cascadeString = "", cascadeJson;
                if (style[n]['title'].charAt(0) === '[') {
                  cascadeJson = JSON.parse(style[n]['title']);
                  cascadeString = cascadeJson.map(function(item){
                    return item.text;
                  }).join(" | ");
                } else {
                  cascadeString = style[n]['title'];
                }

                $('#legendOptions').append('<div class="legend-option" data-option=\''+style[n]['title']+'\'><div class="bullet" style="background: '
                  +style[n]['colour']+'; border-radius: 0 !important"></div>'
                  +cascadeString+'</div>');
              }
            } else {
              //load generic data point style
              $('#legendOptions').append('<div class="legend-option"><div class="bullet" style="background: #FF6600; border-radius: 0 !important"></div>'
                +Ember.String.loc('_custom_maps_data_point')+'</div>');
            }

            //if points count toggle was checked, get and show number of points
            if(legend.points == "true"){
              if(legend.question.column != "") {//if a map is styled by question
                var ajaxObject = {};
                ajaxObject['call'] = "GET";
                ajaxObject['url'] = '/rest/cartodb/points_count?table=raw_data_'+data.custom_map_details[0]['form_id']+'&column='+legend.question.column+'&value=';
                ajaxObject['data'] = '';

                FLOW.ajaxCall(function(pointsCountResponse){
                  if(pointsCountResponse){
                    var response = pointsCountResponse.response;
                    for (var i = 0; i < response.length; i++) {
                      $('.legend-option').each( function(index) {
                        var currentOption = (($(this).data('option') == null || $(this).data('option') == 'null' || $(this).data('option') == '')
                          ? null
                            : (typeof $(this).data('option') === 'object') ? JSON.stringify($(this).data('option')) : $(this).data('option'));
                        if(currentOption == response[i][legend.question.column]) {
                          $(this).append(' ('+response[i]['count']+')');
                        }
                      });
                    }
                  }
                }, ajaxObject);
              } else {
                var ajaxObject = {};
                ajaxObject['call'] = "GET";
                ajaxObject['url'] = '';
                if(data.custom_map_details[0]['form_id'] != 0) {//if map is based on a form
                  ajaxObject['url'] = '/rest/cartodb/points_count?table=raw_data_'+data.custom_map_details[0]['form_id']+'&column=&value=';
                } else if (data.custom_map_details[0]['survey_id'] != 0) {
                  ajaxObject['url'] = '/rest/cartodb/points_count?table=data_point&column=survey_id&value='+data.custom_map_details[0]['survey_id'];
                }
                ajaxObject['data'] = '';

                if (ajaxObject['url'] != '') {
                  FLOW.ajaxCall(function(pointsCountResponse){
                    if(pointsCountResponse) {
                      var response = pointsCountResponse.response;

                      $('.legend-option').append(' ('+response[0].count+')');
                    }
                  }, ajaxObject);
                }
              }
            }
          }

          var mapView = JSON.parse(data.custom_map_details[0]['custom_map_view']);
          map.setView(mapView.center, mapView.zoom);
        }
    });

    map.on('click', function(e) {
      FLOW.clearMap(map); //remove any previously loaded point data
    });

    map.on('zoomend', function() {
      $('body, html, #customMapViewCanvas').scrollTop(0);
    });

    this.$(document).off('click', '.editCustomMap').on('click', '.editCustomMap', function() {
      FLOW.selectedControl.set('selectedCustomMap', $(this).data('customMap'));
      FLOW.router.transitionTo('navMaps.customMapEdit');
    });

    this.$(document).off('click', '.deleteCustomMap').on('click', '.deleteCustomMap', function() {
      if(confirm(Ember.String.loc('_delete_map_confirm'))) {
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

    this.$(document).off('click', '.project-geoshape').on('click', '.project-geoshape', function() {
      if(FLOW.selectedControl.get('polygons').length > 0) {
        $(this).html(Ember.String.loc('_project_geoshape_onto_main_map'));
        for(var i=0; i<FLOW.selectedControl.get('polygons').length; i++){
          map.removeLayer(FLOW.selectedControl.get('polygons')[i]);
        }
        //restore the previous zoom level and map center
        setTimeout(function() {
          map.setView(FLOW.selectedControl.get('mapCenter'), FLOW.selectedControl.get('mapZoomLevel'));
        }, 0);
        FLOW.selectedControl.set('polygons', []);
      } else {
        $(this).html(Ember.String.loc('_clear_geoshape_from_main_map'));
        FLOW.projectGeoshape(map, $(this).data('geoshape-object'));
      }
    });

    // Slide in detailspane after 1 sec
    FLOW.hideDetailsPane(1000);
  }
});
