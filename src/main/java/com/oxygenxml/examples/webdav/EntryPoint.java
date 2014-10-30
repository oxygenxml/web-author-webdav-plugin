package com.oxygenxml.examples.webdav;

import java.io.IOException;
import java.io.UnsupportedEncodingException;
import java.net.PasswordAuthentication;
import java.net.URL;
import java.net.URLDecoder;
import java.net.URLEncoder;

import javax.servlet.ServletException;
import javax.servlet.http.HttpServlet;
import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;

import org.apache.log4j.Logger;

import com.oxygenxml.examples.webdav.UserCredentials.Realm;

/**
 * Entry point for the plugin that enables editing of files located on 
 * a webdav server with authentication.
 */
@SuppressWarnings("serial")
public class EntryPoint extends HttpServlet {
  
  /**
   * Logger for logging.
   */
  private static final Logger logger = Logger.getLogger(
      EntryPoint.class.getName());

  /**
   * Handler of GET request for the /webdav/start path. 
   * 
   * Its purpose is to open the webapp with the provided URL, possibly going
   * through the authentication page.
   */
  protected void doGet(HttpServletRequest httpRequest, HttpServletResponse httpResponse) throws ServletException, IOException {
    // Retrieve the credentials that we recorded so far for the current user.
    String userId = httpRequest.getSession().getId();
    UserCredentials userData = WebdavManagerFilter.getUserData(userId);
    
    String urlParam = httpRequest.getParameter("url");
    URL url = new URL(urlParam);
    PasswordAuthentication passwd = userData.getCredentials(
        new Realm(url.getHost(), url.getPort()));
    if (passwd != null) {
      logger.debug("Credentials found for URL " + urlParam + ". Redirecting to webapp...");
      redirectToWebapp(httpResponse, url, userId);
    } else {
      logger.debug("No credentials found for URL " + urlParam + ". Redirecting to auth page...");
      httpResponse.sendRedirect("auth.html?url=" + encodeUrl(urlParam));
    }
  }
  
  /**
   * Receives the user and the password for a given host. 
   */
  @Override
  protected void doPost(HttpServletRequest httpRequest, HttpServletResponse httpResponse) throws ServletException, IOException {
    String userId = httpRequest.getSession().getId();
    UserCredentials userData = WebdavManagerFilter.getUserData(userId);
    
    String user = httpRequest.getParameter("user");
    String passwd = httpRequest.getParameter("passwd");
    String urlParam = httpRequest.getParameter("url");
    
    logger.debug("Credentials submitted for url: " + urlParam + ". user - " + user + ", passwd - " + passwd);

    URL url = new URL(URLDecoder.decode(urlParam, "UTF-8"));
    // Store the user and password and redirect to the webapp.
    userData.setCredentials(
        new Realm(url.getHost(), url.getPort()), 
        new PasswordAuthentication(user, passwd.toCharArray()));
    
    redirectToWebapp(httpResponse, url, userId);
  }

  /**
   * Redirect the user to the webapp's page.
   * 
   * 
   * The url passed to the webapp will have the form:
   * 
   * webdav-http://{user-id}@host:port/path/to/file.xml
   * 
   * if the original URL looked like:
   * 
   * http://host:port/path/to/file.xml
   * 
   * 
   * @param httpResponse The response to be sent to the user.
   * @param url The URL which should be opened: an HTTP URL without 
   * username and password.
   * @param userId The id of the user on behalf of which we open the document.
   * 
   * @throws IOException If we fail to redirect the user.
   */
  private void redirectToWebapp(HttpServletResponse httpResponse, URL url, String userId) throws IOException {
    String urlWithUserId = url.toExternalForm().replace("://", "://" + userId + "@");
    String webdavUrl = WebdavURLHandlerExtension.WEBDAV + urlWithUserId;
    logger.debug("Webdav URL used: " + webdavUrl);
    String encodedUrl = encodeUrl(webdavUrl);
    
    httpResponse.sendRedirect("../app/demo-mobile.html?url=" + encodedUrl + "&showSave=true");
  }

  /**
   * Encode URL so that it is interoperable with JS encoding/decoding.
   * 
   * @param webdavUrl The URL to be encoded.
   * 
   * @return The result.
   * 
   * @throws UnsupportedEncodingException
   */
  public static String encodeUrl(String webdavUrl) throws UnsupportedEncodingException {
    return URLEncoder.encode(webdavUrl, "UTF-8").replace("+", "%20");
  }
}
