package org.waterforpeople.mapping.app.web.rest;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import javax.inject.Inject;

import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestMethod;
import org.springframework.web.bind.annotation.ResponseBody;
import org.waterforpeople.mapping.app.gwt.client.device.DeviceDto;
import org.waterforpeople.mapping.app.util.DtoMarshaller;

import com.gallatinsystems.common.Constants;
import com.gallatinsystems.device.dao.DeviceDAO;
import com.gallatinsystems.device.domain.Device;

@Controller
@RequestMapping("/devices")
public class DeviceRestService {

	@Inject
	private DeviceDAO deviceDao;

	@RequestMapping(method = RequestMethod.GET, value = "")
	@ResponseBody
	public Map<String, List<DeviceDto>> listDevices() {
		final Map<String, List<DeviceDto>> response = new HashMap<String, List<DeviceDto>>();
		final List<DeviceDto> deviceList = new ArrayList<DeviceDto>();
		final List<Device> devices = deviceDao.list(Constants.ALL_RESULTS);

		if (devices != null) {
			for (Device d : devices) {
				DeviceDto deviceDto = new DeviceDto();
				DtoMarshaller.copyToDto(d, deviceDto);
				deviceList.add(deviceDto);
			}
		}
		response.put("devices", deviceList);
		return response;
	}

	@RequestMapping(method = RequestMethod.GET, value = "/{id}")
	@ResponseBody
	public Map<String, DeviceDto> findDevice(@PathVariable("id") Long id) {
		final Map<String, DeviceDto> response = new HashMap<String, DeviceDto>();
		final Device d = deviceDao.getByKey(id);
		DeviceDto dto = null;
		if (d != null) {
			dto = new DeviceDto();
			DtoMarshaller.copyToDto(d, dto);
		}
		response.put("device", dto);
		return response;
	}
}
