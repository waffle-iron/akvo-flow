
package org.waterforpeople.mapping.app.web.rest.dto;

import java.io.Serializable;
import java.util.List;

public class NamedMapPayload implements Serializable {

    private static final long serialVersionUID = -2824010218094077439L;

    private String name;
    private String query;
    private String cartocss;
    private String requestType;
    private List<String> interactivity;

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }

    public String getQuery() {
        return query;
    }

    public void setQuery(String query) {
        this.query = query;
    }

    public String getCartocss() {
        return cartocss;
    }

    public void setCartocss(String cartocss) {
        this.cartocss = cartocss;
    }

    public String getRequestType() {
        return requestType;
    }

    public void setRequestType(String requestType) {
        this.requestType = requestType;
    }

    public List<String> getInteractivity() {
        return interactivity;
    }

    public void setInteractivity(List<String> interactivity) {
        this.interactivity = interactivity;
    }

}
