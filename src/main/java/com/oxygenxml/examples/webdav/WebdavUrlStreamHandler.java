package com.oxygenxml.examples.webdav;

import java.io.IOException;
import java.net.MalformedURLException;
import java.net.PasswordAuthentication;
import java.net.Proxy;
import java.net.URL;
import java.net.URLConnection;

import org.apache.log4j.Logger;

import ro.sync.basic.util.URLUtil;
import ro.sync.ecss.extensions.api.webapp.plugin.URLStreamHandlerWithContext;

/**
 * URL stream handler for a webdav server.
 */
public class WebdavUrlStreamHandler extends URLStreamHandlerWithContext {

  /**
   * Logger for logging.
   */
  static final Logger logger = Logger.getLogger(WebdavUrlStreamHandler.class.getName());

  /**
   * Computes a server identifier out of the requested URL.
   * 
   * @param serverUrl the URL string.
   * 
   * @return the server identifier.
   */
  public static String computeServerId(String serverUrl) {
    logger.debug("Server for which to compute the serverID :" + serverUrl);
    String serverId = null;
    try {
      URL url = new URL(serverUrl);
      serverId = url.getProtocol() + url.getHost() + url.getPort();
    } catch(MalformedURLException e) {
      logger.error("Malformed url in computeServerId", e);
    }
    logger.debug("serverID :" + serverId);
    return serverId;
  }

  @Override
  protected URLConnection openConnectionInContext(String contextId, URL url, Proxy proxy) throws IOException {
    URL completeUrl = addCredentials(contextId, url);
    URLConnection urlConnection = completeUrl.openConnection();
    
    return new WebdavUrlConnection(contextId, urlConnection);
  }
  
  /**
   * Adds credentials associated with a given user context to the URL.
   * 
   * @param sessionId The session Id.
   * @param url The URL, it should no longer contain the "webdav-" prefix.
   * 
   * @return The URL with credentials. 
   */
  static URL addCredentials(String sessionId, URL url) {
    // Obtain the credentials for the current user.
    PasswordAuthentication userCredentials = CredentialsStore.get(sessionId, computeServerId(url.toExternalForm()));
    
    String protocol = url.getProtocol().substring(WebdavURLHandlerExtension.WEBDAV.length());

    // Build the complete URL that contains the user and password in it.
    StringBuilder completeUrl = new StringBuilder();
    completeUrl.append(protocol).append("://");
    if (userCredentials != null && userCredentials.getPassword().length > 0) {
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
