/*
 *  Copyright (C) 2016 Stichting Akvo (Akvo Foundation)
 *
 *  This file is part of Akvo Flow.
 *
 *  Akvo Flow is free software: you can redistribute it and modify it under the terms of
 *  the GNU Affero General Public License (AGPL) as published by the Free Software Foundation,
 *  either version 3 of the License or any later version.
 *
 *  Akvo FLOW is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY;
 *  without even the implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.
 *  See the GNU Affero General Public License included below for more details.
 *
 *  The full license text can also be seen at <http://www.gnu.org/licenses/agpl.html>.
 */

package com.gallatinsystems.survey.dao;

import java.util.Collections;
import java.util.List;

import com.gallatinsystems.framework.dao.BaseDAO;
import com.gallatinsystems.survey.domain.ApprovalStep;

public class ApprovalStepDAO extends BaseDAO<ApprovalStep> {

    public ApprovalStepDAO() {
        super(ApprovalStep.class);
    }

    public List<ApprovalStep> listByApprovalGroup(Long approvalGroupId) {
        List<ApprovalStep> stepsList = listByProperty("approvalGroupId", approvalGroupId, "Long");
        if (stepsList == null) {
            return Collections.emptyList();
        }
        return stepsList;
    }
}
