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
    Once the view is in the DOM create the map
  */
  didInsertElement: function () {
    console.log("load custom maps list");

    $.get('/rest/cartodb/custom_maps', function(customMapsData, status) {
      console.log(customMapsData);
    });
  },

  editCustomMap: function(customMap){
    FLOW.selectedControl.set('selectedCustomMap', customMap);
    //FLOW.router.transitionTo('navDevices.editSurveysAssignment');
    console.log(customMap);
  },

  newCustomMap: function(){
    FLOW.selectedControl.set('selectedCustomMap', null);
    //FLOW.router.transitionTo('navDevices.editSurveysAssignment');
    console.log(FLOW.selectedControl.get('selectedCustomMap'));
  }
});

FLOW.CustomMapEditView = FLOW.View.extend({
  templateName: 'navMaps/custom-map-edit',
  customMapType: null,
  customMapName: null,

  /**
    Once the view is in the DOM create the map
  */
  didInsertElement: function () {
    //create payloads structures as follows
    var testPostData = {};
    testPostData['formId'] = 0;
    testPostData['creator'] = FLOW.currentUser.email;
    testPostData['customMapTitle'] = '';
    testPostData['customMapDescription'] = '';
    testPostData['namedMap'] = 'test_named_map';
    testPostData['cartocss'] = '';
    testPostData['permission'] = '';

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
  }
});
