package pageobjects;

import browsers.Browser;
import org.openqa.selenium.WebElement;
import org.openqa.selenium.support.PageFactory;
import org.openqa.selenium.support.ui.LoadableComponent;

import java.util.concurrent.TimeUnit;

import static junit.framework.Assert.assertTrue;

/**
 * Author: Ruarcc McAloon
 */
public class AdminLogInPage extends LoadableComponent<AdminLogInPage> {
    public String url;

    private static String title = "Sign in - Google Accounts";
    private WebElement Email;
    private WebElement next;
    private WebElement Passwd;
    private WebElement signIn;

    public AdminLogInPage(String url){
        this.url = url;
        PageFactory.initElements(Browser.getDriver(), this);
    }

    public void logOn(String user, String pwd){
        Browser.getDriver().manage().timeouts().implicitlyWait(10, TimeUnit.SECONDS);
        Browser.getDriver().manage().window().maximize();

        Email.sendKeys(user);
        next.click();
        Passwd.sendKeys(pwd);
        signIn.click();
    }

    @Override
    public void load() {
        Browser.open(url);
    }

    @Override
    public void isLoaded() {
        assertTrue(Browser.getDriver().getTitle().equals(title));
    }

    public String getTitle(){
        return title;
    }
}
