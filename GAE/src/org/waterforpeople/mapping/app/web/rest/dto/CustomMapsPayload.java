/*
 *  Copyright (C) 2012 Stichting Akvo (Akvo Foundation)
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

package org.waterforpeople.mapping.app.web.rest.dto;

import java.io.Serializable;
import java.util.List;

public class CustomMapsPayload implements Serializable {
  private String formId;
  private String creator;
  private String customMapTitle;
  private String customMapDescription;
  private String namedMap;
  private String cartocss;
  private String legend;
  private String permission;

  public String getFormId() {
      return formId;
  }

  public void setFormId(String formId) {
      this.formId = formId;
  }

  public String getCreator() {
      return creator;
  }

  public void setCreator(String creator) {
      this.creator = creator;
  }

  public String getCustomMapTitle() {
      return customMapTitle;
  }

  public void setCustomMapTitle(String customMapTitle) {
      this.customMapTitle = customMapTitle;
  }

  public String getCustomMapDescription() {
      return customMapDescription;
  }

  public void setNamedMap(String namedMap) {
      this.namedMap = namedMap;
  }

  public String getNamedMap() {
      return namedMap;
  }

  public void setCustomMapDescription(String customMapDescription) {
      this.customMapDescription = customMapDescription;
  }

  public String getCartocss() {
      return cartocss;
  }

  public void setCartocss(String cartocss) {
      this.cartocss = cartocss;
  }

  public String getLegend() {
      return legend;
  }

  public void setLegend(String legend) {
      this.legend = legend;
  }

  public String getPermission() {
      return permission;
  }

  public void setPermission(String permission) {
      this.permission = permission;
  }
}
