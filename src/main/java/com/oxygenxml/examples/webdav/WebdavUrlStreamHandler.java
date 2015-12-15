package com.oxygenxml.examples.webdav;

import java.io.IOException;
import java.net.MalformedURLException;
import java.net.PasswordAuthentication;
import java.net.Proxy;
import java.net.URL;
import java.net.URLConnection;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

import org.apache.log4j.Logger;

import ro.sync.ecss.extensions.api.webapp.plugin.URLStreamHandlerWithContext;
import ro.sync.util.URLUtil;

/**
 * URL stream handler for a webdav server.
 */
public class WebdavUrlStreamHandler extends URLStreamHandlerWithContext {
  
  /**
   * Logger for logging.
   */
  private static final Logger logger = Logger.getLogger(WebdavUrlStreamHandler.class.getName());

  
  /**
   * Credentials store.
   */
  public static final Map<String, PasswordAuthentication> credentials = 
      new ConcurrentHashMap<String, PasswordAuthentication>();

  @Override
  protected URLConnection openConnectionInContext(String contextId, URL url, Proxy proxy) throws IOException {
    URL completeUrl = addCredentials(contextId, url);
    
    URLConnection urlConnection = completeUrl.openConnection();
    return new WebdavUrlConnection(contextId, urlConnection);
  }


  /**
   * Adds credentials associated with a given user context to the URL.
   * 
   * @param contextId The context Id.
   * @param url The URL.
   * @return The URL with credentials. 
   */
  public static URL addCredentials(String contextId, URL url) {
    // Obtain the credentials for the current user.
    PasswordAuthentication userCredentials = credentials.get(contextId);
    
    String protocol = url.getProtocol().substring(WebdavURLHandlerExtension.WEBDAV.length());

    // Build the complete URL that contains the user and password in it.
    StringBuilder completeUrl = new StringBuilder();
    completeUrl.append(protocol).append("://");
    if (userCredentials != null) {
      String encodedUserName = URLUtil.encodeURIComponent(userCredentials.getUserName());
      String encodedPasswd = URLUtil.encodeURIComponent(new String(userCredentials.getPassword()));
      completeUrl.append(encodedUserName).append(":").append(encodedPasswd).append("@");
    } else if (url.getUserInfo() != null) {
      completeUrl.append(url.getUserInfo()).append("@");
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
    try {
      return new URL(completeUrl.toString());
    } catch (MalformedURLException e) {
      // Cannot happen since the URL is constructed by our code.
      return null;
    }
  }
}
