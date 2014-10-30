package com.oxygenxml.examples.webdav;

import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.URL;
import java.net.URLConnection;
import java.security.Permission;
import java.util.List;
import java.util.Map;

import org.apache.log4j.Logger;

import ro.sync.util.URLUtil;

import com.oxygenxml.examples.webdav.UserCredentials.Realm;

/**
 * URL connection to a webdav server. 
 * 
 * We just delegate to the oxygen's webdav connection for all methods, except
 * that, if the connection cannot be established because the credentials entered
 * by the user were wrong, we reset them such that the user has the chance to 
 * authenticate again.
 *  
 * @author cristi_talau
 */
public class WebdavUrlConnection extends URLConnection {

  /**
   * Logger for logging.
   */
  private static final Logger logger = Logger.getLogger(WebdavUrlConnection.class.getName());

  /**
   * The oXygen's connection to the webdav server.
   */
  private URLConnection delegateConnection;
  
  /**
   * The credentials of the user on behalf of which we are making the request.
   */
  private UserCredentials userData;

  /**
   * Constructor.
   * 
   * @param userData The user credentials.
   * @param delegateConnection The delegate connection.
   */
  public WebdavUrlConnection(UserCredentials userData, URLConnection delegateConnection) {
    super(delegateConnection.getURL());
    this.userData = userData;
    this.delegateConnection = delegateConnection;
  }

  @Override
  public InputStream getInputStream() throws IOException {
    try {
      return delegateConnection.getInputStream();
    } catch (IOException e) {
      // The credentials were rejected - reset them.
      connectionFailed(e);
      
      // Unreachable.
      return null;
    }
  }


  @Override
  public OutputStream getOutputStream() throws IOException {
    final OutputStream outputStream = delegateConnection.getOutputStream();
    return new OutputStream() {
      
      @Override
      public void write(int b) throws IOException {
        outputStream.write(b);
      }
      
      @Override
      public void close() throws IOException {
        try {
          outputStream.close();
        } catch (IOException e) {
          connectionFailed(e);
        }
      }
      
      @Override
      public void write(byte[] b, int off, int len) throws IOException {
        outputStream.write(b, off, len);
      }
      
      @Override
      public void flush() throws IOException {
        outputStream.flush();
      }
    };
  }

  /**
   * If the connection failed for authorization reasons, reset the credentials 
   * for the current connection, so that the user will be able to enter them again.
   */
  private void connectionFailed(IOException e) throws IOException {
    if (e.getMessage().indexOf("401") != -1) {
      logger.debug("Credentials reset for url: " + delegateConnection.getURL(), e);
      URL url = URLUtil.clearUserInfo(delegateConnection.getURL());
      String encodedUrl = EntryPoint.encodeUrl(url.toExternalForm());
      
      if (userData != null) {
        Realm realm = new Realm(url.getHost(), delegateConnection.getURL().getPort());
        userData.resetCredentials(realm);
      }
      
      // Throw an exception that provides more details and a link to the login page. 
      throw new IOException("Access denied for url: " + url + 
          ". Please provide the credentials again "
          + "<a rel=\"external\" href=\"../webdav/start?url=" + encodedUrl + "\">here</a> and retry.", e);
    } else {
      throw e;
    }
  }

  /**
   * Just delegate to the underlying connection for the rest of the methods.
   */
  
  @Override
  public void connect() throws IOException {
    delegateConnection.connect();
  }
  
  @Override
  public void addRequestProperty(String key, String value) {
    delegateConnection.addRequestProperty(key, value);
  }

  @Override
  public boolean equals(Object obj) {
    return delegateConnection.equals(obj);
  }

  @Override
  public boolean getAllowUserInteraction() {
    return delegateConnection.getAllowUserInteraction();
  }

  @Override
  public int getConnectTimeout() {
    return delegateConnection.getConnectTimeout();
  }

  @Override
  public Object getContent() throws IOException {
    return delegateConnection.getContent();
  }

  @Override
  public Object getContent(@SuppressWarnings("rawtypes") Class[] classes) throws IOException {
    return delegateConnection.getContent(classes);
  }

  @Override
  public String getContentEncoding() {
    return delegateConnection.getContentEncoding();
  }

  @Override
  public int getContentLength() {
    return delegateConnection.getContentLength();
  }

  @Override
  public String getContentType() {
    return delegateConnection.getContentType();
  }

  @Override
  public long getDate() {
    return delegateConnection.getDate();
  }

  @Override
  public boolean getDefaultUseCaches() {
    return delegateConnection.getDefaultUseCaches();
  }

  @Override
  public boolean getDoInput() {
    return delegateConnection.getDoInput();
  }

  @Override
  public boolean getDoOutput() {
    return delegateConnection.getDoOutput();
  }

  @Override
  public long getExpiration() {
    return delegateConnection.getExpiration();
  }

  @Override
  public String getHeaderField(int n) {
    return delegateConnection.getHeaderField(n);
  }

  @Override
  public String getHeaderField(String name) {
    return delegateConnection.getHeaderField(name);
  }

  @Override
  public long getHeaderFieldDate(String name, long Default) {
    return delegateConnection.getHeaderFieldDate(name, Default);
  }

  @Override
  public int getHeaderFieldInt(String name, int Default) {
    return delegateConnection.getHeaderFieldInt(name, Default);
  }

  @Override
  public String getHeaderFieldKey(int n) {
    return delegateConnection.getHeaderFieldKey(n);
  }

  @Override
  public Map<String, List<String>> getHeaderFields() {
    return delegateConnection.getHeaderFields();
  }

  @Override
  public long getIfModifiedSince() {
    return delegateConnection.getIfModifiedSince();
  }

  @Override
  public long getLastModified() {
    return delegateConnection.getLastModified();
  }

  @Override
  public Permission getPermission() throws IOException {
    return delegateConnection.getPermission();
  }

  @Override
  public int getReadTimeout() {
    return delegateConnection.getReadTimeout();
  }

  @Override
  public Map<String, List<String>> getRequestProperties() {
    return delegateConnection.getRequestProperties();
  }

  @Override
  public String getRequestProperty(String key) {
    return delegateConnection.getRequestProperty(key);
  }

  @Override
  public URL getURL() {
    return delegateConnection.getURL();
  }

  @Override
  public boolean getUseCaches() {
    return delegateConnection.getUseCaches();
  }

  @Override
  public int hashCode() {
    return delegateConnection.hashCode();
  }

  @Override
  public void setAllowUserInteraction(boolean allowuserinteraction) {
    delegateConnection.setAllowUserInteraction(allowuserinteraction);
  }

  @Override
  public void setConnectTimeout(int timeout) {
    delegateConnection.setConnectTimeout(timeout);
  }

  @Override
  public void setDefaultUseCaches(boolean defaultusecaches) {
    delegateConnection.setDefaultUseCaches(defaultusecaches);
  }

  @Override
  public void setDoInput(boolean doinput) {
    delegateConnection.setDoInput(doinput);
  }

  @Override
  public void setDoOutput(boolean dooutput) {
    delegateConnection.setDoOutput(dooutput);
  }

  @Override
  public void setIfModifiedSince(long ifmodifiedsince) {
    delegateConnection.setIfModifiedSince(ifmodifiedsince);
  }

  @Override
  public void setReadTimeout(int timeout) {
    delegateConnection.setReadTimeout(timeout);
  }

  @Override
  public void setRequestProperty(String key, String value) {
    delegateConnection.setRequestProperty(key, value);
  }

  @Override
  public void setUseCaches(boolean usecaches) {
    delegateConnection.setUseCaches(usecaches);
  }

  @Override
  public String toString() {
    return delegateConnection.toString();
  }

}
