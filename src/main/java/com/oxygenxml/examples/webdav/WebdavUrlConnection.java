package com.oxygenxml.examples.webdav;

import java.io.FilterOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URLConnection;

import org.apache.commons.io.IOUtils;

import com.google.common.io.Closeables;

import ro.sync.ecss.extensions.api.webapp.WebappMessage;
import ro.sync.ecss.extensions.api.webapp.plugin.FilterURLConnection;
import ro.sync.ecss.extensions.api.webapp.plugin.UserActionRequiredException;
import ro.sync.exml.plugin.urlstreamhandler.CacheableUrlConnection;
import ro.sync.net.protocol.http.WebdavLockHelper;

/**
 * Wrapper over an URLConnection that reports 401 exceptions as 
 * {@link UserActionRequiredException}.
 * 
 * @author cristi_talau
 */
public class WebdavUrlConnection extends FilterURLConnection 
    implements CacheableUrlConnection {

  /**
   * The session ID.
   */
  private String contextId;

  /**
   * Constructor method for the URLConnection wrapper.
   * @param contextId The session ID.
   * 
   * @param delegate the wrapped URLConnection.
   */
  protected WebdavUrlConnection(String contextId, URLConnection delegate) {
    super(delegate);
    this.contextId = contextId;
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
    // Before trying to save a resource, add the lock header if we have one.
    new WebdavLockHelper().addLockHeader(
        this.contextId, (HttpURLConnection) delegateConnection);
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

  /**
   * Filters the exceptions.
   * 
   * @param e the exception to filter.
   *  
   * @throws UserActionRequiredException if the exception message contains a 401 status.
   * 
   * @throws IOException the param exception if it does not contain a 401 status.
   */
  private void handleException(IOException e) throws UserActionRequiredException, IOException {
    if (e.getMessage().indexOf("401") != -1) {
      throw new UserActionRequiredException(new WebappMessage(
          WebappMessage.MESSAGE_TYPE_CUSTOM, 
          "Authentication required", 
          "Authentication required", 
          true));  
    } else {
      if (delegateConnection instanceof HttpURLConnection) {
        String serverMessage = null;
        InputStream errorStream = null;
        try {
          errorStream = ((HttpURLConnection) this.delegateConnection).getErrorStream();
          serverMessage = IOUtils.toString(errorStream);
        } catch (Exception ex) {
          Closeables.closeQuietly(errorStream);
        }
        if (serverMessage != null && serverMessage.contains("<body") && serverMessage.contains("</body")) {
          throw new IOException(serverMessage, e);
        }
      }
      throw e;
    }
  }

}
