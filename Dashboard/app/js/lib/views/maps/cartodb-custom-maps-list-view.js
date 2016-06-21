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
      if(confirm(Ember.String.loc('_delete_map_confirm'))){ //TODO create translation
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
        if(customMapsData.custom_maps[i].survey_id !== 0){
          //only allow users who have access to specified survey to edit or delete custom map
          for(var j=0; j<surveyGroupsData['survey_groups'].length; j++){
            if(surveyGroupsData['survey_groups'][j].keyId === customMapsData.custom_maps[i].survey_id){
              customMapsList += '<a class="edit editCustomMap" data-custom-map="'+customMapsData.custom_maps[i].named_map+'">'
                +Ember.String.loc('_edit')
                +'</a>'
                +'<a class="remove deleteCustomMap" data-custom-map="'+customMapsData.custom_maps[i].named_map+'">'
                +Ember.String.loc('_remove')+'</a>';
            }
          }
        }
        customMapsList += '</td></tr>';

        $('#customMapsTable').append(customMapsList);
      }
    }
  }
});
