package com.oxygenxml.examples.webdav;

import java.io.IOException;

import lombok.extern.slf4j.Slf4j;
import ro.sync.ecss.extensions.api.webapp.plugin.ServletPluginExtension;
import ro.sync.ecss.extensions.api.webapp.plugin.servlet.ServletException;
import ro.sync.ecss.extensions.api.webapp.plugin.servlet.http.HttpServletRequest;
import ro.sync.ecss.extensions.api.webapp.plugin.servlet.http.HttpServletResponse;

/**
 * Servlet used to receive user credentials and propagate them to the 
 * URLStreamHandler.
 */
@Slf4j
public class LoginServlet extends ServletPluginExtension {
  
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
      
      log.debug("Credentials submitted for session: " + sessionId +  ".\n user - " + user + ", passwd - " + passwd + ", serverId -" + serverId);
      
      // Store the user and password.
      CredentialsStore.put(sessionId, serverId, user, passwd);
    }
  }
      
  @Override
  public String getPath() {
    return "login";
  }
}
