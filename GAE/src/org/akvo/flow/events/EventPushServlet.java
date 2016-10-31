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

package org.akvo.flow.events;

import static org.akvo.flow.events.EventUtils.REQ_ID;
import static org.akvo.flow.events.EventUtils.debug;
import static org.akvo.flow.events.EventUtils.getCurrentLock;
import static org.akvo.flow.events.EventUtils.getReqId;
import static org.akvo.flow.events.EventUtils.newLock;
import static org.akvo.flow.events.EventUtils.pushEvents;

import java.io.IOException;
import java.util.logging.Logger;

import javax.servlet.ServletException;
import javax.servlet.http.HttpServlet;
import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;

import org.akvo.flow.events.EventUtils.Prop;
import org.akvo.flow.util.RuntimeProperty;

import com.google.appengine.api.datastore.DatastoreService;
import com.google.appengine.api.datastore.DatastoreServiceFactory;

public class EventPushServlet extends HttpServlet {

    private static final long serialVersionUID = -2863143139609299513L;
    private static final Logger log = Logger.getLogger(EventPushServlet.class.getName());

    @Override
    protected void doGet(HttpServletRequest req, HttpServletResponse resp) throws ServletException,
            IOException {

        String reqId = req.getParameter(REQ_ID);
        String urlPath = System.getProperties().getProperty(Prop.EVENT_NOTIFICATION);

        if (urlPath == null) {
            log.warning("No event notification URL configured");
            return;
        }

        if (reqId == null) {
            log.warning("No requestId parameter present in request");
            return;
        }

        DatastoreService ds = DatastoreServiceFactory.getDatastoreService();
        Boolean eventPushEnabled = (Boolean) RuntimeProperty.getProperty(ds,
                Prop.ENABLE_PUSH_EVENTS);

        if (!Boolean.TRUE.equals(eventPushEnabled)) {
            log.warning("Push events disabled");
            return;
        }

        String currentReqId = getReqId(getCurrentLock(ds));

        if (currentReqId != null && !reqId.equals(currentReqId)) {
            // Some task is running and holding the lock
            debug("Someone has the lock");
            return;
        }

        if (currentReqId == null && newLock(ds, reqId)) {
            pushEvents(ds, reqId, urlPath);
        }

    }

}
