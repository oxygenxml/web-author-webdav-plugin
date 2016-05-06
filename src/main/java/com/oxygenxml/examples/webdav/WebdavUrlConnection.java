package com.oxygenxml.examples.webdav;

import java.io.File;
import java.io.FileNotFoundException;
import java.io.FileOutputStream;
import java.io.FilterOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.MalformedURLException;
import java.net.PasswordAuthentication;
import java.net.URL;
import java.net.URLConnection;

import org.apache.commons.io.IOUtils;
import org.tmatesoft.svn.core.SVNDepth;
import org.tmatesoft.svn.core.SVNException;
import org.tmatesoft.svn.core.SVNURL;
import org.tmatesoft.svn.core.auth.ISVNAuthenticationManager;
import org.tmatesoft.svn.core.wc.ISVNOptions;
import org.tmatesoft.svn.core.wc.SVNClientManager;
import org.tmatesoft.svn.core.wc.SVNRevision;
import org.tmatesoft.svn.core.wc.SVNWCUtil;

import com.google.common.io.Closeables;
import com.google.common.io.Files;

import ro.sync.ecss.extensions.api.webapp.WebappMessage;
import ro.sync.ecss.extensions.api.webapp.plugin.FilterURLConnection;
import ro.sync.ecss.extensions.api.webapp.plugin.UserActionRequiredException;
import ro.sync.net.protocol.http.WebdavLockHelper;
import ro.sync.util.URLUtil;

/**
 * Wrapper over an URLConnection that reports 401 exceptions as 
 * {@link UserActionRequiredException}.
 * 
 * @author cristi_talau
 */
public class WebdavUrlConnection extends FilterURLConnection {

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
   * Returns an output stream to an SVN server.
   * 
   * @return
   * @throws MalformedURLException
   * @throws IOException
   * @throws FileNotFoundException
   */
  public OutputStream getOutputStreamToSVNServer() throws MalformedURLException, IOException, FileNotFoundException {
    PasswordAuthentication credentials = WebdavUrlStreamHandler.credentials.getIfPresent(this.contextId);
    if (credentials == null) {
      // TODO: throw exception.
    }
    ISVNOptions options = SVNWCUtil.createDefaultOptions(true);
    ISVNAuthenticationManager authManager = SVNWCUtil.createDefaultAuthenticationManager(
        credentials.getUserName(), 
        credentials.getPassword());
    final SVNClientManager manager = SVNClientManager.newInstance(options, authManager);
    File tempDir = Files.createTempDir();
    
    URL parentURL = URLUtil.getParentURL(url);
    try {
      manager.getUpdateClient().doCheckout(SVNURL.parseURIEncoded(parentURL.toExternalForm()), 
          tempDir, SVNRevision.HEAD, SVNRevision.HEAD, SVNDepth.EMPTY, true);
    } catch (SVNException e) {
      throw new IOException(e.getMessage(), e);
    }
    
    String fileName = URLUtil.extractFileName(url);
    
    final File file = new File(tempDir, fileName);
    
    return new FilterOutputStream(new FileOutputStream(file)) {
      public void close() throws IOException {
        super.close();
        try {
          manager.getWCClient().doAdd(file, false, false, false, SVNDepth.FILES, false, true);
          manager.getCommitClient().doCommit(new File[]{file}, 
              true, "msg", null, null, false, false, SVNDepth.INFINITY);
        } catch (SVNException e) {
          throw new IOException("Could not checkout the parent folder of.", e);
        }
      };
    };
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
