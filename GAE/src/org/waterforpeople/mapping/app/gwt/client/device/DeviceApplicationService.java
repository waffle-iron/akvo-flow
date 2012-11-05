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
package org.waterforpeople.mapping.app.gwt.client.device;

import com.google.gwt.user.client.rpc.RemoteService;
import com.google.gwt.user.client.rpc.RemoteServiceRelativePath;

/**
 * service for managing deviceApplications
 * 
 * @author Christopher Fagiani
 * 
 */
@RemoteServiceRelativePath("deviceapprpcservice")
public interface DeviceApplicationService extends RemoteService {

	public DeviceApplicationDto getLatestDeviceApplication(String type,
			String appCode);

	public DeviceApplicationDto save(DeviceApplicationDto dto);
}
