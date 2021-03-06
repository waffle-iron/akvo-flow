
FLOW.SurveySelection = Ember.ObjectController.extend({
  surveyGroups: null,
  selectionFilter: null,

  populate: function() {
    selectionFilter = this.get('selectionFilter');
    if(selectionFilter) {
        this.surveyGroups = FLOW.store.filter(FLOW.SurveyGroup, selectionFilter);
    } else {
        this.surveyGroups = FLOW.store.filter(FLOW.SurveyGroup);
    }
  },

  init: function() {
    this._super();
    this.populate();
  },

  getByParentId: function(parentId, monitoringGroupsOnly) {

    return this.get('surveyGroups').filter(function(sg) {
      if (monitoringGroupsOnly) {
        return sg.get('parentId') === parentId &&
          (sg.get('monitoringGroup') || sg.get('projectType') === 'PROJECT_FOLDER');
      } else {
        return sg.get('parentId') === parentId;
      }
    }).sort(function (survey1, survey2) {
      var s1 = survey1.get('name') || "";
      var s2 = survey2.get('name') || "";

      return s1.toLocaleLowerCase().localeCompare(
        s2.toLocaleLowerCase());
    });
  },

  getSurvey: function(keyId) {
    var surveyGroups = this.get('surveyGroups').filter(function(sg) {
      return sg.get('keyId') === keyId;
    });

    return surveyGroups[0];
  },

  isSurvey: function(keyId) {
    return this.getSurvey(keyId).get('projectType') === 'PROJECT';
  },
});
