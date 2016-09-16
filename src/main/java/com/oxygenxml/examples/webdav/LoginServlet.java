package com.oxygenxml.examples.webdav;

import java.io.IOException;
import java.net.PasswordAuthentication;
import java.util.HashMap;
import java.util.Map;

import javax.servlet.ServletException;
import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;

import org.apache.log4j.Logger;

import ro.sync.ecss.extensions.api.webapp.plugin.WebappServletPluginExtension;

/**
 * Servlet used to receive user credentials and propagate them to the 
 * URLStreamHandler.
 */
public class LoginServlet extends WebappServletPluginExtension{
  
  /**
   * Logger for logging.
   */
  private static final Logger logger = Logger.getLogger(
      LoginServlet.class.getName());

  /**
   * Receives the user and the password for a given host. 
   */
  @Override
  public void doPost(HttpServletRequest httpRequest, HttpServletResponse httpResponse) throws ServletException, IOException {
    String userId = httpRequest.getSession().getId();
    String action = httpRequest.getParameter("action");
    String serverId = WebdavUrlStreamHandler
        .computeServerId(httpRequest.getParameter("server"));
    
    if ("logout".equals(action)) {
      WebdavUrlStreamHandler.credentials.invalidate(userId);
    } else {
      String user = httpRequest.getParameter("user");
      String passwd = httpRequest.getParameter("passwd");
      
      logger.debug("Credentials submitted for session: " + userId +  ".\n user - " + user + ", passwd - " + passwd + ", serverId -" + serverId);
      
      // Store the user and password.
      Map<String, PasswordAuthentication> userCredentialsMap = WebdavUrlStreamHandler.credentials.getIfPresent(userId);
      if(userCredentialsMap == null) {
        // if no credentials previously stored we create a new credentials map.
        userCredentialsMap = new HashMap<String, PasswordAuthentication>();
        WebdavUrlStreamHandler.credentials.put(userId, userCredentialsMap);
      } 
      userCredentialsMap.put(serverId, new PasswordAuthentication(user, passwd.toCharArray()));
    }
  }
      
  @Override
  public String getPath() {
    return "login";
  }
}
