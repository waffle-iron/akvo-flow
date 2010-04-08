package org.waterforpeople.mapping.app.gwt.client.common;

import java.io.Serializable;

public class Country implements Serializable {
	/**
	 * 
	 */
	private static final long serialVersionUID = -8915183965348771855L;
	private String displayName = null;
	private String name = null;
	private String isoAlpha2Code = null;
	private String isoAlpha3Code = null;
	private Integer isoNumeric3Code = null;

	public String getDisplayName() {
		return displayName;
	}

	public void setDisplayName(String displayName) {
		this.displayName = displayName;
	}

	public String getName() {
		return name;
	}

	public void setName(String name) {
		this.name = name;
	}

	public String getIsoAlpha2Code() {
		return isoAlpha2Code;
	}

	public void setIsoAlpha2Code(String isoAlpha2Code) {
		this.isoAlpha2Code = isoAlpha2Code;
	}

	public String getIsoAlpha3Code() {
		return isoAlpha3Code;
	}

	public void setIsoAlpha3Code(String isoAlpha3Code) {
		this.isoAlpha3Code = isoAlpha3Code;
	}

	public Integer getIsoNumeric3Code() {
		return isoNumeric3Code;
	}

	public void setIsoNumeric3Code(Integer isoNumeric3Code) {
		this.isoNumeric3Code = isoNumeric3Code;
	}
}
