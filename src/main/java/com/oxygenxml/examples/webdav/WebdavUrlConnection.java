package com.oxygenxml.examples.webdav;

import java.io.FilterOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.URLConnection;

import ro.sync.ecss.extensions.api.webapp.WebappMessage;
import ro.sync.ecss.extensions.api.webapp.plugin.FilterURLConnection;
import ro.sync.ecss.extensions.api.webapp.plugin.UserActionRequiredException;

/**
 * Wrapper over an URLConnection that reports 401 exceptions as 
 * {@link UserActionRequiredException}.
 * 
 * @author cristi_talau
 */
public class WebdavUrlConnection extends FilterURLConnection {

  protected WebdavUrlConnection(URLConnection delegate) {
    super(delegate);
  }
  
  @Override
  public void connect() throws IOException {
    try {
      super.connect();
    } catch (IOException e) {
      handleException(e);
    }
  }
  
  @Override
  public InputStream getInputStream() throws IOException {
    try {
      return super.getInputStream();
    } catch (IOException e) {
      handleException(e);
      
      // Unreachable.
      return null;
    }
  }
  
  @Override
  public OutputStream getOutputStream() throws IOException {
    try {
      return new FilterOutputStream(super.getOutputStream()) {
        @Override
        public void close() throws IOException {
          try {
            super.close();
          } catch (IOException e) {
            handleException(e);
          }
        }
      };
    } catch (IOException e) {
      handleException(e);
      
      // Unreachable.
      return null;
    }
  }

  private void handleException(IOException e) throws UserActionRequiredException, IOException {
    if (e.getMessage().indexOf("401") != -1) {
      throw new UserActionRequiredException(new WebappMessage(
          WebappMessage.MESSAGE_TYPE_CUSTOM, 
          "Authentication required", 
          "Authentication required", 
          true));  
    } else {
      throw e;
    }
  }

}
