package org.waterforpeople.mapping.app.web;

import java.util.List;

import com.google.appengine.api.datastore.DatastoreService;
import com.google.appengine.api.datastore.DatastoreServiceFactory;
import com.google.appengine.api.datastore.Entity;
import com.google.appengine.api.datastore.FetchOptions;
import com.google.appengine.api.datastore.Query;

public class DataScriptBinding {

    private DatastoreService ds;

    public DataScriptBinding() {
        ds = DatastoreServiceFactory.getDatastoreService();
    }

    public Query newQuery(String kind) {
        return new Query(kind);
    }

    public List<Entity> asList(Query q) {
        return ds.prepare(q).asList(FetchOptions.Builder.withDefaults());
    }

    public void put(Entity e) {
        ds.put(e);
    }

    public void put(Iterable<Entity> entities) {
        ds.put(entities);
    }
}
