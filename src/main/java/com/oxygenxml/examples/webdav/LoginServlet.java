package com.oxygenxml.examples.webdav;

import java.io.IOException;
import java.net.PasswordAuthentication;

import javax.servlet.ServletContext;
import javax.servlet.ServletException;
import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;

import org.apache.log4j.Logger;

import com.oxygenxml.examples.webdav.HttpSessionObserver;

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

  @Override
  public void init() {
    ServletContext servletContext = getServletConfig().getServletContext();
    servletContext.addListener(HttpSessionObserver.class);
  }
  
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
  public String getPath() {
    return "login";
  }
}
