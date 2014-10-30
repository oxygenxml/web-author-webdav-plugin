package com.oxygenxml.examples.webdav;

import java.io.IOException;
import java.net.PasswordAuthentication;
import java.net.URL;
import java.net.URLConnection;
import java.net.URLStreamHandler;

import org.apache.log4j.Logger;

import com.oxygenxml.examples.webdav.UserCredentials.Realm;

/**
 * URL stream handler for a webdav server.
 */
public class WebdavUrlStreamHandler extends URLStreamHandler {
  
  /**
   * Logger for logging.
   */
  private static final Logger logger = Logger.getLogger(WebdavUrlStreamHandler.class.getName());
  
  /**
   * Opens a connection to the file specified by the given url.
   *
   * @param url The url of the file. 
   */
  @Override
  protected URLConnection openConnection(URL url) throws IOException {
    // Obtain the credentials associated with the given URL.
    String userId = url.getUserInfo();
    UserCredentials userData = WebdavManagerFilter.getUserData(userId);
    Realm realm = new Realm(url.getHost(), url.getPort());
    PasswordAuthentication credentials = userData == null ? null : userData.getCredentials(realm);
    
    String protocol = url.getProtocol().substring(WebdavURLHandlerExtension.WEBDAV.length());

    // Build the complete URL that contains the user and password in it.
    StringBuilder completeUrl = new StringBuilder();
    completeUrl.append(protocol).append("://");
    if (credentials != null) {
      completeUrl.append(credentials.getUserName()).append(":").append(credentials.getPassword()).append("@");
    }
    completeUrl.append(url.getHost());
    if (url.getPort() != -1) {
      completeUrl.append(":").append(url.getPort());
    }
    completeUrl.append(url.getPath());
    if (url.getQuery() != null) {
      completeUrl.append("?").append(url.getQuery());
    }
    if (url.getRef() != null) {
      completeUrl.append("#").append(url.getRef());
    }
    
    logger.debug("HTTP URL with credentials: " + completeUrl.toString());
    
    return new URL(completeUrl.toString()).openConnection();
  }
}
