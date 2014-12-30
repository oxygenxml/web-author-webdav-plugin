package com.oxygenxml.examples.webdav;

import java.io.IOException;
import java.io.UnsupportedEncodingException;
import java.net.PasswordAuthentication;
import java.net.Proxy;
import java.net.URL;
import java.net.URLConnection;
import java.net.URLEncoder;
import java.util.HashMap;
import java.util.Map;

import org.apache.log4j.Logger;

import ro.sync.ecss.extensions.api.webapp.plugin.URLStreamHandlerWithContext;

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
  public static Map<String, PasswordAuthentication> credentials = 
      new HashMap<String, PasswordAuthentication>();

  @Override
  protected URLConnection openConnectionInContext(String contextId, URL url, Proxy proxy) throws IOException {
    // Obtain the credentials for the current user.
    PasswordAuthentication userCredentials = credentials.get(contextId);
    
    String protocol = url.getProtocol().substring(WebdavURLHandlerExtension.WEBDAV.length());

    // Build the complete URL that contains the user and password in it.
    StringBuilder completeUrl = new StringBuilder();
    completeUrl.append(protocol).append("://");
    if (userCredentials != null) {
      String encodedUserName = encodeUrl(userCredentials.getUserName());
      String encodedPasswd = encodeUrl(new String(userCredentials.getPassword()));
      completeUrl.append(encodedUserName).append(":").append(encodedPasswd).append("@");
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
    
    URLConnection urlConnection = new URL(completeUrl.toString()).openConnection();
    return new WebdavUrlConnection(urlConnection);
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
