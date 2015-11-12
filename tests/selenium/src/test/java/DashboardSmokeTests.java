import browsers.Browser;
import org.junit.BeforeClass;
import org.junit.Test;
import org.openqa.selenium.By;
import org.openqa.selenium.WebElement;
import pageobjects.AdminLogInPage;
import pageobjects.SurveyTab;

import java.io.IOException;
import java.io.InputStream;
import java.util.List;
import java.util.Properties;

import static org.junit.Assert.*;

/**
 * Author: Ruarcc McAloon
 */
public class DashboardSmokeTests {

    //TODO: at the moment each test case creates a new session and logs in etc, to avoid some weird caching issues - presumably a faster way
    private static Properties props = new Properties();
    private static String releaseNumber;
    private AdminLogInPage logIn;

    @BeforeClass
    public static void loadProperties() {
        InputStream is = ClassLoader.getSystemResourceAsStream("test.properties");
        try{
            props.load(is);
        } catch (IOException ioe){
            fail("couldn't load test properties file: "+ioe);
        }
        releaseNumber = props.getProperty("release.number");
    }

    @Test
    public void testPropertiesLoaded(){
        assertNotNull(props);
        assertFalse(props.isEmpty());
    }

    @Test
    public void testAdminLogIn(){
        logInToDashboard();

        assertEquals("Akvo Flow - Dashboard", Browser.getDriver().getTitle());

        closeBrowser();
    }

    @Test
    public void testAddFolder() {
        logInToDashboard();

        SurveyTab.addFolder(getFolderName());
        findElement(By.xpath(getTestFolderXpathLocator())).click();

        assertTrue(findElement(By.className("breadCrumb")).getText().contains(getFolderName()));

        closeBrowser();
    }

    @Test
    public void testDeleteFolder() {
        logInToDashboard();

        assertTrue(findElement(By.xpath(getTestFolderXpathLocator())).isDisplayed());
        findElement(By.cssSelector(SurveyTab.DELETE_SURVEY_FOLDER_CSS_SELECTOR)).click();
        assertTrue(findElements(By.xpath(getTestFolderXpathLocator())).size() < 1);

        closeBrowser();
    }

    @Test
    public void testAddSurvey() {
        logInToDashboard();

        SurveyTab.addFolder(getFolderName());
        findElement(By.xpath(getTestFolderXpathLocator())).click();

        assertTrue(findElement(By.className("breadCrumb")).getText().contains(getFolderName()));

        SurveyTab.addSurvey();
        assertTrue(findElement(By.xpath(SurveyTab.NEW_FOLDER_XPATH_SELECTOR)).isDisplayed());

        closeBrowser();
    }

    @Test
    public void testDeleteSurvey() {
        logInToDashboard();
        findElement(By.xpath(getTestFolderXpathLocator())).click();
        assertTrue(findElement(By.xpath(SurveyTab.NEW_FOLDER_XPATH_SELECTOR)).isDisplayed());
        findElement(By.cssSelector(SurveyTab.DELETE_SURVEY_FOLDER_CSS_SELECTOR)).click();

        assertTrue(findElements(By.xpath(SurveyTab.NEW_FOLDER_XPATH_SELECTOR)).size() < 1);

        closeBrowser();
    }

    @Test
    public void testAddAllQuestionsSurvey(){
        logInToDashboard();

        SurveyTab.addFolder(getFolderName());
        findElement(By.xpath(getTestFolderXpathLocator())).click();

        assertTrue(findElement(By.className("breadCrumb")).getText().contains(getFolderName()));

        SurveyTab.addSurvey();
        assertTrue(findElement(By.xpath(SurveyTab.NEW_FOLDER_XPATH_SELECTOR)).isDisplayed());

        findElement(By.cssSelector(SurveyTab.EDIT_SURVEY_CSS_SELECTOR)).click();
        findElement(By.id("projectTitle")).clear();
        findElement(By.id("projectTitle")).sendKeys(releaseNumber + " All Questions Survey");
        findElement(By.className("addNewForm")).click();

        try{
            //TODO: bound to be a way to wait for add form action to return instead
            Thread.sleep(5000);
        } catch(InterruptedException ie){
            fail("Something went adding form: "+ie);
        }

        findElement(By.cssSelector(SurveyTab.SHOW_NONMF_FORM_BASICS_CSS_SELECTOR)).click();
    }

    private void logInToDashboard(){
        logIn = new AdminLogInPage(props.getProperty("test.env"));
        logIn.get();
        logIn.logOn(props.getProperty("email.address"), props.getProperty("password"));
        waitForSurveysToLoad();
    }

    private void closeBrowser(){
        Browser.close();
    }

    private void waitForSurveysToLoad() {
        try{
            //TODO: bound to be a way to wait for survey_groups to return instead of this brute
            Thread.sleep(25000);
        } catch(InterruptedException ie){
            fail("Something went wrong when waiting for the surveys to load: "+ie);
        }
    }

    private String getFolderName(){
        return releaseNumber + " UAT Folder";
    }

    private String getTestFolderXpathLocator(){
       return "//*[contains(text(),'"+getFolderName()+"')]";
    }

    private WebElement findElement(By locator){
        return Browser.getDriver().findElement(locator);
    }

    private List<WebElement> findElements(By locator){
        return Browser.getDriver().findElements(locator);
    }
}
