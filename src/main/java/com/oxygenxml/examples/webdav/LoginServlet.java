package com.oxygenxml.examples.webdav;

import java.io.IOException;
import java.net.PasswordAuthentication;

import javax.servlet.ServletException;
import javax.servlet.http.HttpServlet;
import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;

import org.apache.log4j.Logger;

import ro.sync.ecss.extensions.api.webapp.plugin.WebappServletPluginExtension;

/**
 * Servlet used to receive user credentials and propagate them to the 
 * URLStreamHandler.
 */
@SuppressWarnings("serial")
public class LoginServlet extends HttpServlet implements WebappServletPluginExtension{
  
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
    
    String user = httpRequest.getParameter("user");
    String passwd = httpRequest.getParameter("passwd");
    
    logger.debug("Credentials submitted for session: " + userId +  ". user - " + user + ", passwd - " + passwd);

    // Store the user and password.
    WebdavUrlStreamHandler.credentials.put(userId, 
        new PasswordAuthentication(user, passwd.toCharArray()));
  }
  
  @Override
  public void doGet(HttpServletRequest httpRequest, HttpServletResponse httpResponse) throws ServletException, IOException {
    super.doGet(httpRequest, httpResponse);
  }
      
  @Override
  public String getPath() {
    return "login";
  }
}
