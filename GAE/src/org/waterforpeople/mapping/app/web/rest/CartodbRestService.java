
package org.waterforpeople.mapping.app.web.rest;

import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStreamWriter;
import java.io.UnsupportedEncodingException;
import java.net.HttpURLConnection;
import java.net.MalformedURLException;
import java.net.URL;
import java.net.URLEncoder;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.sql.Timestamp;
import java.util.Date;

import org.codehaus.jackson.JsonNode;
import org.codehaus.jackson.map.ObjectMapper;
import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestMethod;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseBody;
import org.waterforpeople.mapping.app.web.rest.dto.NamedMapPayload;
import org.waterforpeople.mapping.app.web.rest.dto.CustomMapsPayload;

import com.gallatinsystems.common.util.PropertyUtil;
import com.google.appengine.api.utils.SystemProperty;

@Controller
@RequestMapping("/cartodb")
public class CartodbRestService {

    private static final String CDB_API_KEY = PropertyUtil.getProperty("cartodbApiKey");
    private static final String CDB_ACCOUNT_NAME = SystemProperty.applicationId.get();
    private static final String CDB_HOST = PropertyUtil.getProperty("cartodbHost");

    private static final ObjectMapper objectMapper = new ObjectMapper();
    private static final Date date = new Date();

    @RequestMapping(method = RequestMethod.GET, value = "answers")
    @ResponseBody
    public Map<String, Object> getAnswers(@RequestParam("dataPointId") Long dataPointId,
            @RequestParam("surveyId") Long surveyId) {

        Map<String, Object> response = new HashMap<>();
        response.put("answers", null);
        response.put("formId", null);

        try {
            String formIdQuery = String.format("SELECT id FROM form WHERE survey_id=%d", surveyId);
            List<Map<String, Object>> formIdResponse = queryCartodb(formIdQuery);
            if (!formIdResponse.isEmpty()) {
                Integer formId = (Integer) formIdResponse.get(0).get("id");
                response.put("formId", formId);

                String rawDataQuery = String.format(
                        "SELECT * FROM raw_data_%s WHERE data_point_id=%d",
                        formId, dataPointId);
                List<Map<String, Object>> rawDataResponse = queryCartodb(rawDataQuery);
                if (!rawDataResponse.isEmpty()) {
                    response.put("answers", rawDataResponse.get(0));
                }
            }
            return response;
        } catch (IOException e) {
            return response;
        }
    }

    @RequestMapping(method = RequestMethod.GET, value = "data_point")
    @ResponseBody
    public Map<String, Object> getDataPointTableRow(@RequestParam("id") Long dataPointId) {

        Map<String, Object> response = new HashMap<>();
        response.put("row", null);

        try {
            String rawDataQuery = String.format(
                    "SELECT * FROM data_point WHERE id=%d", dataPointId);
            List<Map<String, Object>> rawDataResponse = queryCartodb(rawDataQuery);
            if (!rawDataResponse.isEmpty()) {
                response.put("row", rawDataResponse.get(0));
            }
            return response;
        } catch (IOException e) {
            return response;
        }
    }

    @RequestMapping(method = RequestMethod.GET, value = "raw_data")
    @ResponseBody
    public Map<String, Object> getPointData(@RequestParam("dataPointId") Long dataPointId,
            @RequestParam("formId") Long formId) {

        Map<String, Object> response = new HashMap<>();
        response.put("answers", null);
        response.put("formId", formId);

        try {
            String rawDataQuery = String.format(
                    "SELECT * FROM raw_data_%s WHERE data_point_id=%d",
                    formId, dataPointId);
            List<Map<String, Object>> rawDataResponse = queryCartodb(rawDataQuery);
            if (!rawDataResponse.isEmpty()) {
                response.put("answers", rawDataResponse.get(0));
            }
            return response;
        } catch (IOException e) {
            return response;
        }
    }

    @RequestMapping(method = RequestMethod.GET, value = "questions")
    @ResponseBody
    public Map<String, Object> getQuestions(
            @RequestParam(value = "form_id", required = true) Long formId) {

        Map<String, Object> response = new HashMap<>();
        response.put("questions", null);
        try {
            response.put(
                    "questions",
                    queryCartodb(String.format("SELECT * FROM question WHERE form_id = %d", formId)));
            return response;
        } catch (IOException e) {
            return response;
        }
    }

    @RequestMapping(method = RequestMethod.GET, value = "columns")
    @ResponseBody
    public Map<String, Object> getColumns(
            @RequestParam(value = "table_name", required = true) String tableName) {

        Map<String, Object> response = new HashMap<>();
        response.put("column_names", null);
        try {
            response.put(
                    "column_names",
                    queryCartodb(String
                            .format("SELECT column_name from information_schema.columns where table_name='%s'",
                                    tableName)));
            return response;
        } catch (IOException e) {
            return response;
        }
    }

    @RequestMapping(method = RequestMethod.GET, value = "surveys")
    @ResponseBody
    public Map<String, Object> listSurveys() {
        Map<String, Object> response = new HashMap<>();
        response.put("surveys", null);
        try {
            response.put("surveys", queryCartodb("SELECT * FROM survey"));
            return response;
        } catch (IOException e) {
            return response;
        }
    }

    @RequestMapping(method = RequestMethod.GET, value = "forms")
    @ResponseBody
    public Map<String, Object> getForms(@RequestParam("surveyId") Long surveyId) {
        Map<String, Object> response = new HashMap<>();
        response.put("forms", null);
        try {
            response.put("forms",
                    queryCartodb(String.format("SELECT * FROM form WHERE survey_id=%d", surveyId)));
            return response;
        } catch (IOException e) {
            return response;
        }
    }

    @RequestMapping(method = RequestMethod.GET, value = "distinct")
    @ResponseBody
    public Map<String, Object> getDistinctValues(
            @RequestParam("column_name") String columnName, @RequestParam("form_id") Long formId) {
        Map<String, Object> response = new HashMap<>();
        response.put("distinct_values", null);
        try {
            response.put("distinct_values",
                    queryCartodb(String.format("SELECT DISTINCT %s FROM raw_data_%d", columnName,
                            formId)));
            return response;
        } catch (IOException e) {
            return response;
        }
    }

    //returns a current server timestamp
    @RequestMapping(method = RequestMethod.GET, value = "timestamp")
    @ResponseBody
    public Map<String, Object> getTimestamp() {
        Map<String, Object> response = new HashMap<>();
        response.put("timestamp", System.currentTimeMillis());
        return response;
    }

    @RequestMapping(method = RequestMethod.GET, value = "custom_maps")
    @ResponseBody
    public Map<String, Object> getCustomMaps() {
      Map<String, Object> response = new HashMap<>();
      response.put("custom_maps", null);
      try {
        //first create a custom maps table in cartodb if one does not already exist
        queryCartodb(String.format("CREATE TABLE IF NOT EXISTS custom_maps"
          +"("
          +"id serial,"
          +"form_id integer,"
          +"survey_title varchar,"
          +"creator varchar,"
          +"custom_map_title varchar,"
          +"custom_map_description varchar,"
          +"named_map varchar,"
          +"cartocss varchar,"
          +"legend varchar,"
          +"permission text,"
          +"create_date timestamp,"
          +"modify_date timestamp"
          +")"));

        response.put("custom_maps", queryCartodb(String.format("SELECT * FROM custom_maps")));

        return response;
      } catch (IOException e) {
        return response;
      }
    }

    @RequestMapping(method = RequestMethod.GET, value = "custom_map_details")
    @ResponseBody
    public Map<String, Object> getCustomMapDetails(
            @RequestParam("name") String customMapName) {
        Map<String, Object> response = new HashMap<>();
        response.put("custom_map_details", null);
        try {
            response.put("custom_map_details",
                    queryCartodb(String.format("SELECT * FROM custom_maps WHERE named_map = '%s'", customMapName)));
            return response;
        } catch (IOException e) {
            return response;
        }
    }

    @RequestMapping(method = RequestMethod.POST, value = "edit_custom_map")
    @ResponseBody
    public Map<String, Object> editCustomMap(
            @RequestBody CustomMapsPayload payload)
            throws IOException {
        Map<String, Object> response = new HashMap<>();
        Timestamp currentTimestamp = new Timestamp(date.getTime());
        String query = "";
        response.put("custom_map", null);

        if(payload.getNewMap().equals("true")){
          String insertValues = "('"+payload.getFormId()+"', '"+payload.getSurveyTitle()
              +"', '"+payload.getCreator()+"', '"+payload.getCustomMapTitle()+"', '"+payload.getCustomMapDescription()
              +"', '"+payload.getNamedMap()+"', '"+payload.getCartocss()+"', '"+payload.getLegend()
              +"', '"+payload.getPermission()+"', '"+currentTimestamp+"', '"+currentTimestamp+"')";
          query = String.format("INSERT INTO custom_maps "
              +"(form_id, survey_title, creator, custom_map_title, custom_map_description,"
              +" named_map, cartocss, legend, permission, create_date, modify_date) VALUES "
              +insertValues);
        }else{
          query = "UPDATE custom_maps SET (form_id, survey_title, custom_map_title, custom_map_description,"
          +" cartocss, legend, permission, modify_date) = ('"+payload.getFormId()+"', '"+payload.getSurveyTitle()
          +"', '"+payload.getCustomMapTitle()+"', '"+payload.getCustomMapDescription()+"', '"+payload.getCartocss()
          +"', '"+payload.getLegend()+"', '"+payload.getPermission()+"', '"+currentTimestamp+"')"
          +" WHERE named_map = '"+payload.getNamedMap()+"'";
        }

        response.put("query", query);
        response.put("custom_map", queryCartodb(query));

        return response;
    }

    @SuppressWarnings("unchecked")
    @RequestMapping(method = RequestMethod.GET, value = "named_maps")
    @ResponseBody
    public Map<String, Object> getNamedMaps() throws IOException {
        HttpURLConnection connection = getConnection("GET", mapsApiURL());
        return objectMapper.readValue(connection.getInputStream(), Map.class);
    }

    @RequestMapping(method = RequestMethod.POST, value = "named_maps")
    @ResponseBody
    public Map<String, Object> createNamedMaps(
            @RequestBody NamedMapPayload payload)
            throws IOException {
        URL url = (payload.getRequestType().equals("POST")) ? mapsApiURL() : editNamedMapApiURL(payload.getName());

        HttpURLConnection connection = getConnection(payload.getRequestType(), url);
        OutputStreamWriter writer = new OutputStreamWriter(connection.getOutputStream());
        objectMapper.writeValue(writer, buildNamedMap(payload));
        writer.close();

        InputStream result = connection.getInputStream();

        @SuppressWarnings("unchecked")
        Map<String, Object> resultMap = objectMapper.readValue(result, Map.class);

        return resultMap;
    }

    @SuppressWarnings("unchecked")
    private static List<Map<String, Object>> queryCartodb(String query) throws IOException {
        HttpURLConnection connection = getConnection("GET", sqlApiURL(query));
        JsonNode jsonNode = objectMapper.readTree(connection.getInputStream());
        return objectMapper.convertValue(jsonNode.get("rows"), List.class);
    }

    private static HttpURLConnection getConnection(String method, URL url)
            throws IOException {
        HttpURLConnection connection = (HttpURLConnection) url.openConnection();
        connection.setDoOutput(true);
        connection.setRequestMethod(method);
        connection.setRequestProperty("Content-Type", "application/json");
        return connection;

    }

    private static final URL mapsApiURL() throws MalformedURLException {
        return new URL(String.format("https://%s.%s/api/v1/map/named?api_key=%s",
                CDB_ACCOUNT_NAME, CDB_HOST, CDB_API_KEY));
    }

    private static final URL editNamedMapApiURL(String namedMap) throws MalformedURLException {
        return new URL(String.format("https://%s.%s/api/v1/map/named/%s?api_key=%s",
                CDB_ACCOUNT_NAME, CDB_HOST, namedMap, CDB_API_KEY));
    }

    private static final URL sqlApiURL(String query) throws MalformedURLException,
            UnsupportedEncodingException {
        String urlString = String.format("https://%s.%s/api/v2/sql?q=%s&api_key=%s",
                CDB_ACCOUNT_NAME, CDB_HOST, URLEncoder.encode(query, "UTF-8"), CDB_API_KEY);
        return new URL(urlString);
    }

    private static final Map<String, Object> buildNamedMap(NamedMapPayload namedMapPayload) {

        Map<String, Object> result = new HashMap<>();
        result.put("name", namedMapPayload.getName());
        result.put("version", "0.0.1");
        Map<String, String> authMap = new HashMap<>();
        authMap.put("method", "open");
        result.put("auth", authMap);
        Map<String, Object> layerGroupMap = new HashMap<>();
        Map<String, Object> optionsMap = new HashMap<>();
        optionsMap.put("cartocss_version", "2.1.1");
        optionsMap.put("cartocss", namedMapPayload.getCartocss());
        optionsMap.put("sql", namedMapPayload.getQuery());
        optionsMap.put("interactivity", namedMapPayload.getInteractivity());
        Map<String, Object> layerMap = new HashMap<>();
        layerMap.put("type", "cartodb");
        layerMap.put("options", optionsMap);
        List<Object> layersList = new ArrayList<>();
        layersList.add(layerMap);
        layerGroupMap.put("layers", layersList);
        result.put("layergroup", layerGroupMap);

        return result;
    }
}
