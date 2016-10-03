/*
 *  Copyright (C) 2016 Stichting Akvo (Akvo Foundation)
 *
 *  This file is part of Akvo FLOW.
 *
 *  Akvo FLOW is free software: you can redistribute it and modify it under the terms of
 *  the GNU Affero General Public License (AGPL) as published by the Free Software Foundation,
 *  either version 3 of the License or any later version.
 *
 *  Akvo FLOW is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY;
 *  without even the implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.
 *  See the GNU Affero General Public License included below for more details.
 *
 *  The full license text can also be seen at <http://www.gnu.org/licenses/agpl.html>.
 */

package org.akvo.flow.util;

import java.util.Date;
import java.util.HashMap;
import java.util.Map;

import com.google.appengine.api.datastore.DatastoreService;
import com.google.appengine.api.datastore.Entity;
import com.google.appengine.api.datastore.EntityNotFoundException;
import com.google.appengine.api.datastore.Key;
import com.google.appengine.api.datastore.KeyFactory;

/*
 * - RuntimeProperty is like a System.getProperties but backed by the 
 * Datastore and not appengine-web.xml
 * 
 * - The idea is to have properties that can be changed without re-deployment
 * 
 * - Notice that the value can be any Object supported as property value in
 * the Datastore and not only strings
 */

public class RuntimeProperty {

    public static final String KIND_NAME = "RuntimeProperty";
    public static final String PROPERTY_VALUE = "value";
    public static final String PROPERTY_CREATED = "createdDateTime";
    public static final String PROPERTY_UPDATED = "lastUpdateDateTime";

    private static final Map<String, Key> KEYS = new HashMap<String, Key>();
    private static final Map<String, Object> VALUES = new HashMap<String, Object>();

    private static void checkNotNull(Object k, String message) {
        if (k == null) {
            throw new IllegalArgumentException(message);
        }
    }

    private static void checkDS(DatastoreService ds) {
        checkNotNull(ds, "ds can't be null");
    }

    private static void checkKey(String key) {
        checkNotNull(key, "key can't be null");
        if (key.length() == 0) {
            throw new IllegalArgumentException("key can't be empty");
        }
    }

    private static void checkParams(DatastoreService ds, String key) {
        checkDS(ds);
        checkKey(key);
    }

    private static Entity getEntity(DatastoreService ds, Key k) {
        try {
            return ds.get(k);
        } catch (EntityNotFoundException e) { // no-op
        }
        return null;
    }

    private static Key getKey(String name) {
        if (KEYS.containsKey(name)) {
            return KEYS.get(name);
        }

        Key k = KeyFactory.createKey(KIND_NAME, name);
        KEYS.put(name, k);
        return k;
    }

    /**
     * Gets the runtime property indicated by the specified key
     * 
     * @param ds DatastoreService instance
     * @param key property name
     * @return the value of the property or <code>null</code> if not present
     */
    public static Object getProperty(DatastoreService ds, String key) {

        checkParams(ds, key);

        if (VALUES.containsKey(key)) {
            return VALUES.get(key);
        }

        Entity e = getEntity(ds, getKey(key));

        if (e == null) {
            return null;
        }

        Object value = e.getProperty(PROPERTY_VALUE);
        VALUES.put(key, value);
        return value;
    }

    /**
     * Sets the runtime property indicated by the specified key
     * 
     * @param ds DatastoreService instance
     * @param key the name of the runtime property
     * @param value the value of the property
     * @return the previous value of the runtime property, or <code>null</code> if did not have one
     */
    public static Object setProperty(DatastoreService ds, String key, Object value) {

        checkParams(ds, key);

        Key k = getKey(key);
        Object previousValue = null;
        Entity e = getEntity(ds, k);
        Date d = new Date();

        if (e != null) {
            previousValue = e.getProperty(PROPERTY_VALUE);
        }

        if (e == null) {
            e = new Entity(k);
            e.setProperty(PROPERTY_CREATED, d);
        }

        e.setProperty(PROPERTY_VALUE, value);
        e.setProperty(PROPERTY_UPDATED, d);
        ds.put(e);
        VALUES.put(key, value);

        return previousValue;
    }

    /**
     * Removes the runtime property indicated by the specified key
     * 
     * @param ds DatastoreService instance
     * @param key the name of the runtime property to be removed
     * @return the previous value of the runtime property, or <code>null</code> if did not have one
     */
    public static Object clearProperty(DatastoreService ds, String key) {

        checkParams(ds, key);

        Key k = getKey(key);
        Object previousValue = null;
        Entity e = getEntity(ds, k);

        if (e != null) {
            previousValue = e.getProperty(PROPERTY_VALUE);
            ds.delete(k);
            VALUES.remove(key);
        }

        return previousValue;
    }
}
