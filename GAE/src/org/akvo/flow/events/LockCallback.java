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

import static org.akvo.flow.events.EventUtils.getCurrentLock;
import static org.akvo.flow.events.EventUtils.getReqId;

import com.google.appengine.api.datastore.DatastoreService;
import com.google.appengine.api.datastore.DatastoreServiceFactory;
import com.google.appengine.api.datastore.PrePut;
import com.google.appengine.api.datastore.PutContext;

public class LockCallback {

    private static DatastoreService DS = DatastoreServiceFactory.getDatastoreService();

    @PrePut(kinds = {
        "Lock"
    })
    void checkLock(PutContext context) {
        String currentReqId = getReqId(getCurrentLock(DS));
        String newReqId = getReqId(context.getCurrentElement());

        if (newReqId != null && currentReqId != null) {
            throw new IllegalStateException("Lock present - " + currentReqId);
        }
    }
}
