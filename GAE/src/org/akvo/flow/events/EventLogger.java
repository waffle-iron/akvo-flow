/*
 *  Copyright (C) 2015-2016 Stichting Akvo (Akvo Foundation)
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

package org.akvo.flow.events;

import static com.gallatinsystems.common.util.MemCacheUtils.initCache;
import static org.akvo.flow.events.EventUtils.getEventAndActionType;
import static org.akvo.flow.events.EventUtils.newContext;
import static org.akvo.flow.events.EventUtils.newEvent;
import static org.akvo.flow.events.EventUtils.newSource;

import java.io.StringWriter;
import java.util.Date;
import java.util.Map;
import java.util.UUID;
import java.util.logging.Level;
import java.util.logging.Logger;

import net.sf.jsr107cache.Cache;

import org.akvo.flow.events.EventUtils.Action;
import org.akvo.flow.events.EventUtils.EventTypes;
import org.akvo.flow.events.EventUtils.Prop;
import org.codehaus.jackson.map.ObjectMapper;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;

import com.gallatinsystems.common.Constants;
import com.gallatinsystems.common.util.PropertyUtil;
import com.google.appengine.api.backends.BackendServiceFactory;
import com.google.appengine.api.datastore.DatastoreService;
import com.google.appengine.api.datastore.DatastoreServiceFactory;
import com.google.appengine.api.datastore.DeleteContext;
import com.google.appengine.api.datastore.Entity;
import com.google.appengine.api.datastore.PostDelete;
import com.google.appengine.api.datastore.PostPut;
import com.google.appengine.api.datastore.PutContext;
import com.google.appengine.api.datastore.Text;
import com.google.appengine.api.taskqueue.Queue;
import com.google.appengine.api.taskqueue.QueueFactory;
import com.google.appengine.api.taskqueue.TaskOptions;
import com.google.appengine.api.taskqueue.TaskOptions.Method;
import com.google.appengine.api.utils.SystemProperty;

public class EventLogger {
    private static Logger logger = Logger.getLogger(EventLogger.class.getName());

    private static final long MIN_TIME_DIFF = 1000 * 60; // 60 seconds

    private boolean shouldSchedule() {
        Cache cache = initCache(60 * 60); // 1 hour
        if (cache == null) {
            // cache is not accessible, so we will notify anyway
            logger.log(Level.WARNING,
                    "cache not accessible, but still sending notification to unified log");

            return true;
        }

        if (cache.containsKey(Action.UNIFIED_LOG_NOTIFIED)) {
            // check if the time the last notification was send is less than one minute ago
            Date cacheDate = (Date) cache.get(Action.UNIFIED_LOG_NOTIFIED);
            Date nowDate = new Date();
            Long deltaMils = nowDate.getTime() - cacheDate.getTime();
            if (deltaMils < MIN_TIME_DIFF) {
                // it is too soon, so don't send the notification
                return false;
            }
        }
        // if we are here, either the key is not in the cache, or it is too old
        // in both cases, we send the notification and add a fresh value to the cache
        cache.put(Action.UNIFIED_LOG_NOTIFIED, new Date());
        return true;
    }

    @SuppressWarnings("deprecation")
    private void schedulePush() {

        if (!shouldSchedule()) {
            return;
        }

        TaskOptions to = TaskOptions.Builder.withUrl("/app_worker/eventpush").method(Method.GET)
                .param(EventUtils.REQ_ID, UUID.randomUUID().toString())
                .header("host",
                        BackendServiceFactory.getBackendService()
                                .getBackendAddress("dataprocessor"));
        Queue q = QueueFactory.getQueue("background-processing");
        q.add(to);
    }

    private void storeEvent(Map<String, Object> event, Date timestamp) {
        try {
            DatastoreService datastore = DatastoreServiceFactory.getDatastoreService();

            ObjectMapper m = new ObjectMapper();
            StringWriter w = new StringWriter();
            m.writeValue(w, event);

            Entity entity = new Entity("EventQueue");
            entity.setProperty("createdDateTime", timestamp);
            entity.setProperty("lastUpdateDateTime", timestamp);

            String payload = w.toString();
            if (payload.length() > Constants.MAX_LENGTH) {
                entity.setProperty("payloadText", new Text(payload));
            } else {
                entity.setProperty("payload", payload);
            }

            datastore.put(entity);
            schedulePush();
        } catch (Exception e) {
            logger.log(Level.SEVERE, "could not store " + event.get("eventType")
                    + " event. Error: " + e.toString(), e);
        }
    }

    @PostPut(kinds = {
            "SurveyGroup", "Survey", "QuestionGroup", "Question", "SurveyInstance",
            "QuestionAnswerStore", "SurveyedLocale", "DeviceFiles"
    })
    void logPut(PutContext context) {

        try {
            if (!"true".equals(PropertyUtil.getProperty(Prop.ENABLE_CHANGE_EVENTS))) {
                return;
            }

            Entity current = context.getCurrentElement();

            // determine type of event and type of action
            EventTypes types = getEventAndActionType(current.getKey().getKind());

            // determine if this entity was created or updated
            Date lastUpdateDatetime = (Date) current.getProperty(Prop.LAST_UPDATE_DATE_TIME);
            Date createdDateTime = (Date) current.getProperty(Prop.CREATED_DATE_TIME);
            String actionType = createdDateTime.equals(lastUpdateDatetime) ? Action.CREATED
                    : Action.UPDATED;

            // create event source
            // get the authentication information. This seems to contain the userId, but
            // according to the documentation, should hold the 'password'
            final Authentication authentication = SecurityContextHolder.getContext()
                    .getAuthentication();

            Map<String, Object> eventSource = newSource(authentication.getPrincipal());

            Date timestamp = (Date) context.getCurrentElement().getProperty(
                    Prop.LAST_UPDATE_DATE_TIME);
            // create event context map
            Map<String, Object> eventContext = newContext(timestamp, eventSource);

            // create event
            Map<String, Object> event = newEvent(SystemProperty.applicationId.get(),
                    types.action + actionType, current, eventContext);

            // store it
            storeEvent(event, timestamp);

        } catch (Exception e) {
            logger.log(Level.SEVERE, "Could not handle datastore put event: " + e.getMessage(), e);
        }
    }

    @PostDelete(kinds = {
            "SurveyGroup", "Survey", "QuestionGroup", "Question", "SurveyInstance",
            "QuestionAnswerStore", "SurveyedLocale", "DeviceFiles"
    })
    void logDelete(DeleteContext context) {
        try {
            if (!"true".equals(PropertyUtil.getProperty(Prop.ENABLE_CHANGE_EVENTS))) {
                return;
            }

            // determine type of event and type of action
            EventTypes types = getEventAndActionType(context.getCurrentElement().getKind());

            // create event source
            // get the authentication information. This seems to contain the userId, but
            // according to the documentation, should hold the 'password'
            final Authentication authentication = SecurityContextHolder.getContext()
                    .getAuthentication();
            Object principal = authentication.getPrincipal();

            Map<String, Object> eventSource = newSource(principal);

            // create event context map
            // we create our own timestamp here, as we don't have one in the context
            Date timestamp = new Date();
            Map<String, Object> eventContext = newContext(timestamp, eventSource);

            // create event entity
            Entity deleted = new Entity(context.getCurrentElement());

            // create event
            Map<String, Object> event = newEvent(SystemProperty.applicationId.get(),
                    types.action + Action.DELETED, deleted, eventContext);

            // store it
            storeEvent(event, timestamp);

        } catch (Exception e) {
            logger.log(Level.SEVERE, "Could not handle datastore delete event: " + e.getMessage(),
                    e);
        }
    }
}
