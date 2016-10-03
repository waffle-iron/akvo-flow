
package org.akvo.flow.events.dto;

import javax.servlet.http.HttpServletRequest;

import com.gallatinsystems.framework.rest.RestError;
import com.gallatinsystems.framework.rest.RestRequest;

public class EventResetRequest extends RestRequest {

    private static final long serialVersionUID = -7089494399093737806L;
    private int syncVersion = -1;

    @Override
    protected void populateFields(HttpServletRequest req) throws Exception {
        syncVersion = Integer.valueOf(req.getParameter("syncVersion"));
    }

    @Override
    protected void populateErrors() {
        if (syncVersion == -1) {
            addError(new RestError(RestError.MISSING_PARAM_ERROR_CODE,
                    RestError.MISSING_PARAM_ERROR_MESSAGE, "syncVersion is required"));
        }
    }

    public int getSyncVersion() {
        return this.syncVersion;
    }

}
