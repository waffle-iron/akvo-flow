package pageobjects;

import browsers.Browser;
import org.openqa.selenium.By;
import org.openqa.selenium.WebElement;

/**
 * Author: Ruarcc McAloon
 */
public class SurveyTab {

    public static final String NEW_FOLDER_XPATH_SELECTOR = "//h2[contains(text(),'New survey')]";
    public static final String EDIT_SURVEY_CSS_SELECTOR = ".newlyCreated > nav > ul > li.editSurvey > a";
    public static final String SHOW_NONMF_FORM_BASICS_CSS_SELECTOR = ".formSummary > section.formDetails > a";

    // TODO: Make the below locator more robust - at the moment it simply searches for the first delete survey button on an empty folder/survey
    // TODO: I think the correct approach should be to findElement the relevant sibling node for the Selenium Test Folder element
    public static final String DELETE_SURVEY_FOLDER_CSS_SELECTOR = ".folderEmpty > nav > ul > li.deleteSurvey > a";

    public static void addFolder(String folderName){
        Browser.getDriver().findElement(By.className("addFolder")).click();
        Browser.getDriver().findElement(By.className("editFolderName")).click();
        Browser.getDriver().findElement(By.className("ember-text-field")).clear();
        Browser.getDriver().findElement(By.className("ember-text-field")).sendKeys(folderName);
        Browser.getDriver().findElement(By.className("editingFolderName")).click();
    }

    public static void addSurvey(){
        Browser.getDriver().findElement(By.className("addSurvey")).click();
    }
}
