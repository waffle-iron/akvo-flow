//
// This file was generated by the JavaTM Architecture for XML Binding(JAXB) Reference Implementation, vJAXB 2.1.10 in JDK 6 
// See <a href="http://java.sun.com/xml/jaxb">http://java.sun.com/xml/jaxb</a> 
// Any modifications to this file will be lost upon recompilation of the source schema. 
// Generated on: 2010.08.05 at 05:55:36 PM MDT 
//

package com.gallatinsystems.survey.domain.xml;

import java.util.ArrayList;
import java.util.List;
import javax.xml.bind.annotation.XmlAccessType;
import javax.xml.bind.annotation.XmlAccessorType;
import javax.xml.bind.annotation.XmlAttribute;
import javax.xml.bind.annotation.XmlElement;
import javax.xml.bind.annotation.XmlRootElement;
import javax.xml.bind.annotation.XmlSchemaType;
import javax.xml.bind.annotation.XmlType;
import javax.xml.bind.annotation.adapters.CollapsedStringAdapter;
import javax.xml.bind.annotation.adapters.XmlJavaTypeAdapter;

/**
 * <p>
 * Java class for anonymous complex type.
 * 
 * <p>
 * The following schema fragment specifies the expected content contained within
 * this class.
 * 
 * <pre>
 * &lt;complexType>
 *   &lt;complexContent>
 *     &lt;restriction base="{http://www.w3.org/2001/XMLSchema}anyType">
 *       &lt;sequence>
 *         &lt;element ref="{}option" maxOccurs="unbounded"/>
 *       &lt;/sequence>
 *       &lt;attribute name="allowOther" use="required" type="{http://www.w3.org/2001/XMLSchema}NMTOKEN" />
 *       &lt;attribute name="allowMultiple" type="{http://www.w3.org/2001/XMLSchema}NMTOKEN" />
 *       &lt;attribute name="renderType" type="{http://www.w3.org/2001/XMLSchema}NMTOKEN" />
 *     &lt;/restriction>
 *   &lt;/complexContent>
 * &lt;/complexType>
 * </pre>
 * 
 * 
 */
@XmlAccessorType(XmlAccessType.FIELD)
@XmlType(name = "", propOrder = { "option" })
@XmlRootElement(name = "options")
public class Options {

	@XmlElement(required = true)
	protected List<Option> option;
	@XmlAttribute(required = true)
	@XmlJavaTypeAdapter(CollapsedStringAdapter.class)
	@XmlSchemaType(name = "NMTOKEN")
	protected String allowOther;
	@XmlAttribute
	@XmlJavaTypeAdapter(CollapsedStringAdapter.class)
	@XmlSchemaType(name = "NMTOKEN")
	protected String allowMultiple;
	@XmlAttribute
	@XmlJavaTypeAdapter(CollapsedStringAdapter.class)
	@XmlSchemaType(name = "NMTOKEN")
	protected String renderType;

	/**
	 * Gets the value of the option property.
	 * 
	 * <p>
	 * This accessor method returns a reference to the live list, not a
	 * snapshot. Therefore any modification you make to the returned list will
	 * be present inside the JAXB object. This is why there is not a
	 * <CODE>set</CODE> method for the option property.
	 * 
	 * <p>
	 * For example, to add a new item, do as follows:
	 * 
	 * <pre>
	 * getOption().add(newItem);
	 * </pre>
	 * 
	 * 
	 * <p>
	 * Objects of the following type(s) are allowed in the list {@link Option }
	 * 
	 * 
	 */
	public List<Option> getOption() {
		if (option == null) {
			option = new ArrayList<Option>();
		}
		return this.option;
	}

	public void setOption(List<Option> option) {
		this.option = option;
	}

	/**
	 * Gets the value of the allowOther property.
	 * 
	 * @return possible object is {@link String }
	 * 
	 */
	public String getAllowOther() {
		return allowOther;
	}

	/**
	 * Sets the value of the allowOther property.
	 * 
	 * @param value
	 *            allowed object is {@link String }
	 * 
	 */
	public void setAllowOther(String value) {
		this.allowOther = value;
	}

	/**
	 * Gets the value of the allowMultiple property.
	 * 
	 * @return possible object is {@link String }
	 * 
	 */
	public String getAllowMultiple() {
		return allowMultiple;
	}

	/**
	 * Sets the value of the allowMultiple property.
	 * 
	 * @param value
	 *            allowed object is {@link String }
	 * 
	 */
	public void setAllowMultiple(String value) {
		this.allowMultiple = value;
	}

	/**
	 * Gets the value of the renderType property.
	 * 
	 * @return possible object is {@link String }
	 * 
	 */
	public String getRenderType() {
		return renderType;
	}

	/**
	 * Sets the value of the renderType property.
	 * 
	 * @param value
	 *            allowed object is {@link String }
	 * 
	 */
	public void setRenderType(String value) {
		this.renderType = value;
	}

}