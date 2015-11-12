package browsers;

import org.openqa.selenium.JavascriptExecutor;
import org.openqa.selenium.WebDriver;
import org.openqa.selenium.WebElement;
import org.openqa.selenium.firefox.FirefoxDriver;

/**
 * Author: Ruarcc McAloon
 */
public class Browser {

    private static WebDriver driver = new FirefoxDriver();


    public static WebDriver getDriver() {
        return driver;
    }

    public static void open(String url) {
        driver.get(url);
    }

    public static void close(){
        driver.close();
    }

    public static void scrollBrowserToElement(WebElement element){
        ((JavascriptExecutor)driver).executeScript("arguments[0].scrollIntoView(false);", element);
    }
}
