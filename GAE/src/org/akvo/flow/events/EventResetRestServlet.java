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

import org.akvo.flow.events.dto.EventResetRequest;

import com.gallatinsystems.framework.rest.AbstractRestApiServlet;
import com.gallatinsystems.framework.rest.RestRequest;
import com.gallatinsystems.framework.rest.RestResponse;

public class EventResetRestServlet extends AbstractRestApiServlet {

    private static final long serialVersionUID = 1194270322822710887L;

    @Override
    protected RestRequest convertRequest() throws Exception {
        RestRequest req = new EventResetRequest();
        req.populateFromHttpRequest(getRequest());
        return req;
    }

    @Override
    protected RestResponse handleRequest(RestRequest req) throws Exception {
        EventResetRequest eventRequest = (EventResetRequest) req;
        RestResponse resp = new RestResponse();
        return resp;
    }

    @Override
    protected void writeOkResponse(RestResponse resp) throws Exception {
        getResponse().setStatus(200);
    }

}
