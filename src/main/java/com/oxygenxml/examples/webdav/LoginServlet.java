package com.oxygenxml.examples.webdav;

import java.io.IOException;

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
    String sessionId = httpRequest.getSession().getId();
    String action = httpRequest.getParameter("action");
    
    if ("logout".equals(action)) {
      CredentialsStore.invalidate(sessionId);
    } else {
      String serverId = WebdavUrlStreamHandler
          .computeServerId(httpRequest.getParameter("server"));
      
      String user = httpRequest.getParameter("user");
      String passwd = httpRequest.getParameter("passwd");
      
      logger.debug("Credentials submitted for session: " + sessionId +  ".\n user - " + user + ", passwd - " + passwd + ", serverId -" + serverId);
      
      // Store the user and password.
      CredentialsStore.put(sessionId, serverId, user, passwd);
    }
  }
      
  @Override
  public String getPath() {
    return "login";
  }
}
