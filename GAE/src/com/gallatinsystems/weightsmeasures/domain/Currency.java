/*
 *  Copyright (C) 2010-2012 Stichting Akvo (Akvo Foundation)
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

package com.gallatinsystems.weightsmeasures.domain;

import javax.jdo.annotations.IdentityType;
import javax.jdo.annotations.PersistenceCapable;

import com.gallatinsystems.framework.domain.BaseDomain;
import com.gallatinsystems.gis.geography.domain.Country;

@PersistenceCapable(identityType = IdentityType.APPLICATION)
public class Currency extends BaseDomain {

    private static final long serialVersionUID = 2732185712823409196L;

    private String name = null;
    private Country countryOfIssue = null;

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }

    public Country getCountryOfIssue() {
        return countryOfIssue;
    }

    public void setCountryOfIssue(Country countryOfIssue) {
        this.countryOfIssue = countryOfIssue;
    }

}
