package com.oxygenxml.examples.webdav;

import java.io.IOException;
import java.net.PasswordAuthentication;

import javax.servlet.ServletException;
import javax.servlet.http.HttpServlet;
import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;

import org.apache.log4j.Logger;

/**
 * Servlet used to receive user credentials and propagate them to the 
 * URLStreamHandler.
 */
@SuppressWarnings("serial")
public class LoginServlet extends HttpServlet {
  
  /**
   * Logger for logging.
   */
  private static final Logger logger = Logger.getLogger(
      LoginServlet.class.getName());

  /**
   * Receives the user and the password for a given host. 
   */
  @Override
  protected void doPost(HttpServletRequest httpRequest, HttpServletResponse httpResponse) throws ServletException, IOException {
    String userId = httpRequest.getSession().getId();
    
    String user = httpRequest.getParameter("user");
    String passwd = httpRequest.getParameter("passwd");
    
    logger.debug("Credentials submitted for session: " + userId +  ". user - " + user + ", passwd - " + passwd);

    // Store the user and password.
    WebdavUrlStreamHandler.credentials.put(userId, 
        new PasswordAuthentication(user, passwd.toCharArray()));
  }
}
